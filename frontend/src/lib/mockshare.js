// Mock of Share sadhana (worker/src/shares.js, migration 0070): the same shapes, refusals and limits. The facilitator is
// derived from the owner's open membership, never stored; a share is one { id, owner, viewer, at } and every read checks it.
// The viewer's side is by the share's random id, never the owner's login (their phone).
// The viewer's pages reuse the facilitator's student page and week (mockstaff.js devoteeOf / weekRead), minus contact.
// Fixture: Aarav Gupta (6000000011) shares with the mock devotee 6000000001 (id shareAarav); 6000000001 shares with Raman
// Das (6000000092, id shareRaman).
import { nowD, isoIst, validWeekId } from './mockweeks.js';

export const SHARE_LIMIT = 20, LOOKUPS_PER_HOUR = 30;
export const shortName = (name) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return w.length < 2 ? (w[0] || '') : `${w[0]} ${w[w.length - 1][0].toUpperCase()}.`;
};
const stop = (s) => (s.endsWith('.') ? s : s + '.');
// worker shares.js shareId: 10 url-safe characters, the first a letter
const URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const shareId = () => [...crypto.getRandomValues(new Uint8Array(10))].map((x, i) => URLSAFE[i === 0 ? x % 52 : x % 64]).join('');
const validId = (v) => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{9}$/.test(v);
// worker util.js normPhone
export function normPhone(v) {
  let d = String(v ?? '').replace(/[\s-]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  d = d.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

export function installShare(A, h) {
  const { ok, fail, fieldFail } = h;
  const ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'];
  let shares = [], tries = new Map();
  const reset = () => {
    const at = '2026-10-20T19:30:00+05:30';
    shares = [{ id: 'shareAarav', owner: '6000000011', viewer: '6000000001', at }, { id: 'shareRaman', owner: '6000000001', viewer: '6000000092', at }];
    tries = new Map();
  };
  reset();
  const users = () => h.db().users;
  const has = (owner, viewer) => shares.some((s) => s.owner === owner && s.viewer === viewer);
  // the server's DEVOTEE gate is a scope (an open membership of one's own), not an account role
  const notDevotee = (u) => (h.scopesOf(u).devotee ? null : fail('FORBIDDEN', 'You do not have access to this.'));
  const phoneFail = (message) => fieldFail([['phone', message]], message);

  function target(u, phoneIn) {
    const phone = normPhone(phoneIn);
    if (!phone) return { err: phoneFail('Enter a 10-digit mobile number.') };
    const now = nowD().getTime(), t = tries.get(u.login);
    const n = t && t.until > now ? t.n + 1 : 1;
    tries.set(u.login, { n, until: t && t.until > now ? t.until : now + 3600e3 });
    if (n > LOOKUPS_PER_HOUR) return { err: fail('BUSY', 'Too many numbers tried. Please wait a while and try again.') };
    if (phone === u.login) return { err: phoneFail('This is your own number.') };
    const a = users()[phone], m = h.current(u);
    if (!a || a.role !== 'DEVOTEE' || a.status !== 'ACTIVE') return { err: phoneFail('No active devotee in the app has this number.') };
    const name = shortName(a.name);
    if (a.facilitatorName && m?.facilitator && a.facilitatorName === m.facilitator) return { err: phoneFail(`${name} is your facilitator and already sees your sadhana.`) };
    if (has(u.login, phone)) return { err: phoneFail(stop(`Already shared with ${name}`)) };
    if (shares.filter((s) => s.owner === u.login).length >= SHARE_LIMIT) return { err: phoneFail(`You can share with at most ${SHARE_LIMIT} people. Remove someone first.`) };
    return { login: phone, name };
  }

  A['share.list'] = [ANY, (d, u) => {
    const no = notDevotee(u); if (no) return no;
    const m = h.current(u), names = Object.fromEntries(h.db().batches.map((b) => [b.batchId, b.name]));
    const to = shares.filter((s) => s.owner === u.login && users()[s.viewer]).sort((a, b) => a.at.localeCompare(b.at) || a.viewer.localeCompare(b.viewer));
    const from = shares.filter((s) => s.viewer === u.login && users()[s.owner]).map((s) => ({ s, a: users()[s.owner] }))
      .sort((x, y) => x.a.name.localeCompare(y.a.name) || x.s.owner.localeCompare(y.s.owner));
    return ok({
      facilitator: m?.facilitator ? { name: m.facilitator } : null,
      sharedWith: to.map((s) => ({ login: s.viewer, name: shortName(users()[s.viewer].name), since: s.at })),
      sharedWithMe: from.map(({ s, a }) => { const b = h.current(a)?.batchId || ''; return { id: s.id, name: a.name, batchName: names[b] || b, since: s.at }; }),
      limit: SHARE_LIMIT,
    });
  }];
  A['share.lookup'] = [ANY, (d, u) => {
    const no = notDevotee(u); if (no) return no;
    const t = target(u, d.phone);
    return t.err || ok({ name: t.name });
  }];
  A['share.add'] = [ANY, (d, u) => {
    const no = notDevotee(u); if (no) return no;
    const t = target(u, d.phone); if (t.err) return t.err;
    const at = isoIst(nowD());
    shares.push({ id: shareId(), owner: u.login, viewer: t.login, at });
    return ok({ shared: { login: t.login, name: t.name, since: at } });
  }];
  const drop = (owner, viewer) => {
    if (!owner || !viewer) return fieldFail([['login', 'Choose someone from the list.']], 'Choose someone from the list.');
    if (!has(owner, viewer)) return fail('NOT_FOUND', 'Not on your list.');
    shares = shares.filter((s) => !(s.owner === owner && s.viewer === viewer));
    return ok({ ok: true });
  };
  A['share.remove'] = [ANY, (d, u) => notDevotee(u) || drop(u.login, normPhone(d.login))];
  A['share.leave'] = [ANY, (d, u) => { const s = validId(d.id) && shares.find((x) => x.id === d.id && x.viewer === u.login); return s ? drop(s.owner, u.login) : fail('NOT_FOUND', 'Not on your list.'); }];

  // the owner and their open membership, if share `id` is this viewer's NOW
  function sharedWith(u, id) {
    const s = validId(id) && shares.find((x) => x.id === id && x.viewer === u.login), t = s ? users()[s.owner] : null;
    if (!t) return { err: fail('FORBIDDEN', 'This sadhana is not shared with you.') };
    const m = h.current(t);
    if (!m) return { err: fail('NOT_FOUND', 'Nothing to show yet.') };
    return { t, m };
  }
  A['share.devotee'] = [ANY, (d, u) => {
    const x = sharedWith(u, d.id); if (x.err) return x.err;
    const v = h.devoteeOf(x);
    delete v.phone; delete v.whatsapp; delete v.login;      // the login is the phone
    return ok(v);
  }];
  A['share.week'] = [ANY, (d, u) => {
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']], 'Not a week.');
    const x = sharedWith(u, d.id); if (x.err) return x.err;
    return ok(h.weekRead(x.t, d.weekId));
  }];
  // account deletion takes the person's shares with it, both ways (worker erase.js)
  const forget = (login) => { shares = shares.filter((s) => s.owner !== login && s.viewer !== login); };
  return { reset, forget, _shares: () => shares };
}
