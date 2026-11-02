// Share sadhana (the head, 27 Oct 2026; migration 0070). A devotee's sadhana is seen by their facilitator by default;
// they may also open it, read-only, to anyone else in the app ("say I do seva under Y devotee who wants to see my
// sadhana as well").
//
//   the owner (DEVOTEE)   share.list · share.lookup · share.add · share.remove
//   the viewer (ANY)      share.leave · share.devotee · share.week
//
// The facilitator is never stored: it is the owner's open membership's `facilitator`, so when the coordinator or the
// head changes it the list shows the new one at once. A share is one row (owner, viewer): no acceptance step, and every
// read checks the row on THIS call, so a removal takes effect at once. The viewer sees what the facilitator's student
// page shows (facilitator.js devoteeView / weekRead) without the contact fields. Staff get nothing extra from this:
// a coordinator or the head reads a share only if one was made to them.
//
// Choosing someone is by phone; the confirm name is the first name and the last initial ("Sunil K."), so typing
// numbers does not reveal who is registered under their full name.
//
// The viewer never learns the owner's login, which is their phone ("sadhana only, no contact details"): their side works
// by the share's own random id (#/shared/<id>; share.devotee / share.week / share.leave {id}), the server finds owner
// and viewer from the row and refuses anyone but that viewer. The owner's side keeps the viewer's login: they typed it.
import { apiError, invalid, isoIst, normPhone } from './util.js';
import { q, one, audit, reads, rows, batchesAll, currentMembership } from './db.js';
import { overLimit } from './auth.js';
import { devoteeView, weekRead } from './facilitator.js';
import { validWeekId } from './weeks.js';

/** At most this many people per owner (the facilitator, derived, does not count). */
export const SHARE_LIMIT = 20;
/** Lookups and adds per owner per hour: enough to add a few people, too few to walk through phone numbers. */
export const LOOKUPS_PER_HOUR = 30;

/** "Sunil Kumar Das" → "Sunil D."; a single name stays as it is. */
export const shortName = (name) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return w.length < 2 ? (w[0] || '') : `${w[0]} ${w[w.length - 1][0].toUpperCase()}.`;
};
// what the viewer's copy of the student page leaves out: the contact fields, and the login (it is the phone)
const CONTACT = ['phone', 'whatsapp', 'login'];
/** A share id: 10 url-safe characters, the first a letter (never mistaken for a number). About 59 bits of chance. */
const URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function shareId() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return [...b].map((x, i) => URLSAFE[i === 0 ? x % 52 : x % 64]).join('');
}
const validId = (v) => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{9}$/.test(v);
// a sentence ending in a short name ("Sunil K.") gets no second full stop
const stop = (s) => (s.endsWith('.') ? s : s + '.');

/** share.list: the facilitator (derived) and the people I shared with; the people who shared with me. One read hop. */
export async function shareList(d, ctx) {
  const db = ctx.db, me = ctx.login;
  const m = await currentMembership(db, me);           // already read by scopesOf: no hop
  const [to, from] = await reads(db, [
    rows(q(db, `SELECT s.viewer AS login, s.created_at, a.name FROM sadhana_shares s JOIN accounts a ON a.login = s.viewer
                WHERE s.owner = ? ORDER BY s.created_at, s.viewer`, me)),
    rows(q(db, `SELECT s.id, s.owner, s.created_at, a.name, m.batch_id FROM sadhana_shares s JOIN accounts a ON a.login = s.owner
                LEFT JOIN memberships m ON m.login = s.owner AND m.to_week = '' WHERE s.viewer = ? ORDER BY a.name, s.owner`, me))]);
  const names = Object.fromEntries((await batchesAll(db)).map(b => [b.batch_id, b.name]));
  return {
    facilitator: m?.facilitator ? { name: m.facilitator } : null,
    sharedWith: to.map(r => ({ login: r.login, name: shortName(r.name), since: r.created_at })),
    // by the share's id, never the owner's login (their phone)
    sharedWithMe: from.map(r => ({ id: r.id, name: r.name, batchName: names[r.batch_id] || r.batch_id || '', since: r.created_at })),
    limit: SHARE_LIMIT
  };
}

/** Who this phone may be shared with, or a field error on `phone`. One read hop after the rate check. */
async function shareTarget(ctx, phoneIn) {
  const db = ctx.db, me = ctx.login, phone = normPhone(phoneIn);
  const no = (message) => invalid({ path: 'phone', message });
  if (!phone) throw no('Enter a 10-digit mobile number.');
  if (await overLimit(ctx, `share:${me}`, LOOKUPS_PER_HOUR, 3600)) throw apiError('BUSY', 'Too many numbers tried. Please wait a while and try again.');
  if (phone === me) throw no('This is your own number.');
  const m = await currentMembership(db, me);
  const [a, dup, n] = await reads(db, [
    q(db, 'SELECT login, name, role, status, facilitator_name, fac_id FROM accounts WHERE login = ?', phone),
    q(db, 'SELECT 1 AS x FROM sadhana_shares WHERE owner = ? AND viewer = ?', me, phone),
    q(db, 'SELECT COUNT(*) AS n FROM sadhana_shares WHERE owner = ?', me)]);
  // unknown, pending, switched off or a staff login: one answer, so the reply does not say which
  if (!a || a.role !== 'DEVOTEE' || a.status !== 'ACTIVE') throw no('No active devotee in the app has this number.');
  const name = shortName(a.name);
  // the same facilitator by id (Phase 24), whatever either side's spelling
  if (a.fac_id && m?.fac_id && a.fac_id === m.fac_id) throw no(`${name} is your facilitator and already sees your sadhana.`);
  if (dup) throw no(stop(`Already shared with ${name}`));
  if ((n?.n || 0) >= SHARE_LIMIT) throw no(`You can share with at most ${SHARE_LIMIT} people. Remove someone first.`);
  return { login: a.login, name, batchId: m?.batch_id || '' };
}

/** share.lookup {phone}: the confirm name ("Sunil K."), or why it cannot be shared. */
export async function shareLookup(d, ctx) {
  const t = await shareTarget(ctx, d.phone);
  return { name: t.name };
}

/** share.add {phone}: shares my sadhana with that person, at once. */
export async function shareAdd(d, ctx, req) {
  const db = ctx.db, t = await shareTarget(ctx, d.phone), at = isoIst(ctx.now());
  for (let attempt = 0; ; attempt++) {
    try {
      await db.batch([
        q(db, 'INSERT INTO sadhana_shares (id, owner, viewer, created_at) VALUES (?, ?, ?, ?)', shareId(), ctx.login, t.login, at),
        audit(db, ctx, 'share.add', t.login, t.batchId, null, { viewer: t.login }, '', req.requestId)]);
      break;
    } catch (e) {
      const m = String(e.message);
      if (/sadhana_shares\.id/.test(m) && attempt < 2) continue;          // the same random id twice: draw another
      if (/UNIQUE|PRIMARY KEY/i.test(m)) throw invalid({ path: 'phone', message: stop(`Already shared with ${t.name}`) });
      throw e;
    }
  }
  return { shared: { login: t.login, name: t.name, since: at } };
}

/** Deletes one share row, audited; NOT_FOUND when there is none. */
async function drop(ctx, req, owner, viewer, action, target) {
  const db = ctx.db;
  if (!owner || !viewer) throw invalid({ path: 'login', message: 'Choose someone from the list.' });
  if (!(await one(db, 'SELECT 1 AS x FROM sadhana_shares WHERE owner = ? AND viewer = ?', owner, viewer))) throw apiError('NOT_FOUND', 'Not on your list.');
  await db.batch([
    q(db, 'DELETE FROM sadhana_shares WHERE owner = ? AND viewer = ?', owner, viewer),
    audit(db, ctx, action, target, '', { owner, viewer }, null, '', req.requestId)]);
  return { ok: true };
}
/** share.remove {login}: the owner stops sharing with that viewer. The facilitator is not a share and cannot be removed. */
export const shareRemove = (d, ctx, req) => drop(ctx, req, ctx.login, normPhone(d.login), 'share.remove', normPhone(d.login));
/** share.leave {id}: the viewer takes that share off their own "Shared with me". */
export async function shareLeave(d, ctx, req) {
  const r = validId(d.id) ? await one(ctx.db, 'SELECT owner FROM sadhana_shares WHERE id = ? AND viewer = ?', d.id, ctx.login) : null;
  if (!r) throw apiError('NOT_FOUND', 'Not on your list.');
  return drop(ctx, req, r.owner, ctx.login, 'share.leave', r.owner);
}

/** The owner's open membership with their account, if share `id` is the caller's NOW; else FORBIDDEN. */
async function sharedWithMe(ctx, id) {
  const r = validId(id) ? await one(ctx.db, `SELECT s.owner AS shared, m.*, a.name, a.whatsapp, a.iyf_id, a.status FROM sadhana_shares s
      JOIN accounts a ON a.login = s.owner LEFT JOIN memberships m ON m.login = s.owner AND m.to_week = ''
      WHERE s.id = ? AND s.viewer = ? ORDER BY m.id DESC LIMIT 1`, id, ctx.login) : null;
  if (!r) throw apiError('FORBIDDEN', 'This sadhana is not shared with you.');
  if (!r.login) throw apiError('NOT_FOUND', 'Nothing to show yet.');
  return r;
}
/** share.devotee {id}: the facilitator's student page of the owner, without phone, WhatsApp or login. */
export async function shareDevotee(d, ctx) {
  const v = await devoteeView(ctx.db, await sharedWithMe(ctx, d.id));
  for (const k of CONTACT) delete v[k];
  return v;
}
/** share.week {id, weekId}: one week of the owner, read-only, as the facilitator reads it (it carries no login). */
export async function shareWeek(d, ctx) {
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const r = await sharedWithMe(ctx, d.id);
  return weekRead(ctx.db, r.shared, d.weekId);
}
