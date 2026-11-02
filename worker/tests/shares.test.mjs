// Share sadhana (the head, 27 Oct 2026; migration 0070, src/shares.js). The facilitator sees a devotee's sadhana by
// default (derived from the open membership, never stored); the devotee may also share it, by phone, with anyone in the
// app, who then reads it as the facilitator's student page shows it, minus phone and WhatsApp. No acceptance step; the
// owner removes, the viewer leaves; every read checks the share row on that call. Staff get nothing extra from it.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('share sadhana: owner, viewer, facilitator by default');
const { DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const OTHER = (await call('meta.get', {})).data.facilitators.find((n) => n !== FAC);
const PROFILE = { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const signUp = (phone, name, batchId = 'SPS2') => call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: PROFILE });
const join = async (phone, name, batchId = 'SPS2') => {
  await signUp(phone, name, batchId);
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const O_ = '6000000161', V_ = '6000000162', X_ = '6000000163', F_ = '6000000165', R_ = '6000000166';
const O = await join(O_, 'Sunil Kumar');                 // the owner, in SPS2, facilitator FAC
const V = await join(V_, 'Vikram Singh', 'BSS');         // the person they do seva under
const X = await join(X_, 'Outside Person');              // nobody shared anything with them
await signUp('6000000164', 'Pending Person');            // signed up, not approved
const F = await join(F_, 'Facilitator Member Das', 'BSS');
t.code(await call('facLogins.link', { facilitator: FAC, phone: F_ }, M), 'ok', "a devotee of the app is linked as FAC's own login (My students)");
const F2 = (await call('auth.login', { login: F_, password: 'Devotee pass 2026' })).data.token;
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");

// ---- the owner's list: the facilitator first, derived, with nothing stored
let r = await call('share.list', {}, O);
t.eq(r.data, { facilitator: { name: FAC }, sharedWith: [], sharedWithMe: [], limit: 20 }, 'the facilitator is there by default; nobody else yet');
t.eq(rows('SELECT COUNT(*) AS n FROM sadhana_shares')[0].n, 0, '… and nothing is stored for it');

// ---- lookup: the confirm name is masked; refusals are field errors on phone
r = await call('share.lookup', { phone: V_ }, O);
t.eq(r.data, { name: 'Vikram S.' }, 'a phone shows first name and last initial, never the full name');
t.eq((await call('share.lookup', { phone: '+91 ' + V_ }, O)).data, { name: 'Vikram S.' }, 'a +91 number is the same number');
const fieldOf = (x) => [x.error?.code, x.error?.fields?.[0]?.path, x.error?.message];
t.eq(fieldOf(await call('share.lookup', { phone: O_ }, O)), ['VALIDATION', 'phone', 'This is your own number.'], 'not yourself');
const unknown = fieldOf(await call('share.lookup', { phone: '6000000169' }, O));
t.eq(unknown, ['VALIDATION', 'phone', 'No active devotee in the app has this number.'], 'an unknown number is refused');
t.eq(fieldOf(await call('share.lookup', { phone: '6000000164' }, O)), unknown, 'a pending sign-up gets the very same answer (the reply does not tell them apart)');
t.code(await call('share.lookup', { phone: 'abc' }, O), 'VALIDATION', 'not a phone number');
t.eq(fieldOf(await call('share.lookup', { phone: F_ }, O)), ['VALIDATION', 'phone', 'Facilitator D. is your facilitator and already sees your sadhana.'], "the facilitator's own login: pointless, so refused with the reason");

// ---- add: at once, no acceptance step; duplicates refused; audited
r = await call('share.add', { phone: V_ }, O);
t.eq([r.data?.shared?.login, r.data?.shared?.name], [V_, 'Vikram S.'], 'shared');
t.eq(fieldOf(await call('share.add', { phone: V_ }, O)).slice(0, 2), ['VALIDATION', 'phone'], 'a duplicate is refused');
t.eq(fieldOf(await call('share.lookup', { phone: V_ }, O))[2], 'Already shared with Vikram S.', '… and lookup says so before Share');
t.eq(rows('SELECT owner, viewer FROM sadhana_shares'), [{ owner: O_, viewer: V_ }], 'one row');
t.eq(rows("SELECT who, target FROM audit_log WHERE action = 'share.add'"), [{ who: O_, target: V_ }], 'in Activity: who shared with whom');

r = await call('share.list', {}, O);
t.eq([r.data.facilitator, r.data.sharedWith.map((x) => [x.login, x.name])], [{ name: FAC }, [[V_, 'Vikram S.']]], "owner: the facilitator, then the people added (masked)");
r = await call('share.list', {}, V);
t.eq(r.data.sharedWithMe.map((x) => Object.keys(x).sort()), [['batchName', 'id', 'name', 'since']], "viewer: by the share's id, with no login");
t.eq(r.data.sharedWithMe.map((x) => [x.name, x.batchName]), [['Sunil Kumar', 'SPS Group 2']], '… it appears at once in Shared with me');
let SID = r.data.sharedWithMe[0].id;
t.ok(/^[A-Za-z][A-Za-z0-9_-]{9}$/.test(SID) && rows('SELECT id FROM sadhana_shares')[0].id === SID, 'the id is 10 url-safe characters, the one in the row');
t.eq(r.data.sharedWith, [], "… and it is not the viewer's own share");

// ---- the viewer reads it as the facilitator does, without the contact fields
at('2026-10-06T10:00:00');
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
t.code(await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day }, O), 'ok', 'the owner fills a day');
const facView = (await call('fac.devotee', { login: O_ }, F2)).data;
const shared = await call('share.devotee', { id: SID }, V);
t.code(shared, 'ok', 'the viewer opens the report');
t.eq([shared.data.name, shared.data.batchName, shared.data.since], [facView.name, facView.batchName, facView.since], 'the same page the facilitator sees');
t.eq(shared.data.weeks, facView.weeks, '… with the same weeks');
t.eq([facView.phone, facView.whatsapp], [O_, CONTACT.whatsapp || O_], 'the facilitator has phone and WhatsApp');
t.eq(['phone', 'whatsapp', 'email', 'address', 'dob', 'birthday', 'emergency'].filter((k) => k in shared.data), [], 'the viewer has no phone, WhatsApp, email, address or birthday');
t.ok(!JSON.stringify(shared.data).includes(CONTACT.email) && !JSON.stringify(shared.data).includes('Punjabi Bagh'), '… nowhere in the reply');
const fw = (await call('fac.week', { login: O_, weekId: '2026-10-05' }, F2)).data;
r = await call('share.week', { id: SID, weekId: '2026-10-05' }, V);
t.eq(r.data, fw, 'a week reads exactly as the facilitator reads it');
t.eq(r.data.days?.[0]?.state, 'complete', '… with the day just filled');
// the head's rule: sadhana only. Nothing the viewer is sent holds the owner's login or any phone-like number
const tenDigits = (x) => (JSON.stringify(x).match(/\d{10}/g) || []);
t.eq([...tenDigits((await call('share.list', {}, V)).data.sharedWithMe), ...tenDigits(shared.data), ...tenDigits(r.data)], [], 'no 10-digit number anywhere in the viewer\'s list, report or week');
t.ok(!JSON.stringify(shared.data).includes(O_) && !JSON.stringify(r.data).includes(O_), "… and never the owner's login");
t.code(await call('share.week', { id: SID, weekId: 'x' }, V), 'VALIDATION', 'a week id is checked');

// ---- nobody else: an outsider, the owner's own coordinator, the head
for (const [who, tok] of [['an outsider', X], ["the owner's coordinator", C], ['the IYF head', M]]) {
  t.code(await call('share.devotee', { id: SID }, tok), 'FORBIDDEN', `${who} gets FORBIDDEN on the report`);
  t.code(await call('share.week', { id: SID, weekId: '2026-10-05' }, tok), 'FORBIDDEN', `… and on a week`);
}
t.code(await call('share.devotee', { id: SID }, O), 'FORBIDDEN', "the id works only for its viewer: not even for the owner");
t.code(await call('share.devotee', { id: '6000000161' }, V), 'FORBIDDEN', 'a login is not an id');
t.code(await call('share.list', {}, C), 'FORBIDDEN', 'a coordinator with no sadhana of their own has no share screen');

// ---- the facilitator follows a change of facilitator; the old one loses the default
t.code(await call('devotees.setPeople', { login: O_, facilitator: OTHER }, M), 'ok', 'the head gives the owner a new facilitator');
t.eq((await call('share.list', {}, O)).data.facilitator, { name: OTHER }, 'the default is the new facilitator at once');
t.code(await call('fac.devotee', { login: O_ }, F2), 'NOT_FOUND', 'the old facilitator no longer sees them (that access was only ever My students)');
t.eq((await call('share.lookup', { phone: F_ }, O)).data, { name: 'Facilitator D.' }, '… and may now be shared with like anyone else');
t.code(await call('share.remove', { login: F_ }, O), 'NOT_FOUND', 'the facilitator is not a share and cannot be removed');

// ---- at most 20
for (let i = 0; i < 19; i++) DB.sql.prepare('INSERT INTO sadhana_shares (id, owner, viewer, created_at) VALUES (?, ?, ?, ?)').run('fillerId' + String(i).padStart(2, '0'), O_, 'filler-' + i, '2026-10-06T10:00:00+05:30');
t.eq(fieldOf(await call('share.lookup', { phone: X_ }, O))[2], 'You can share with at most 20 people. Remove someone first.', 'a 21st is refused');
t.code(await call('share.add', { phone: X_ }, O), 'VALIDATION', '… on add too');
DB.sql.exec("DELETE FROM sadhana_shares WHERE viewer LIKE 'filler-%'");

// ---- remove (the owner) and leave (the viewer) revoke at once
t.code(await call('share.remove', { login: V_ }, O), 'ok', 'the owner removes the viewer');
t.code(await call('share.devotee', { id: SID }, V), 'FORBIDDEN', 'the viewer is refused on the very next call');
t.code(await call('share.week', { id: SID, weekId: '2026-10-05' }, V), 'FORBIDDEN', '… for a week too');
t.eq((await call('share.list', {}, V)).data.sharedWithMe, [], "gone from the viewer's list");
t.code(await call('share.remove', { login: V_ }, O), 'NOT_FOUND', 'removing again: nothing to remove');
t.code(await call('share.add', { phone: V_ }, O), 'ok', 'shared again');
const OLD = SID;
SID = (await call('share.list', {}, V)).data.sharedWithMe[0].id;
t.ok(SID !== OLD, 'a new share has a new id');
t.code(await call('share.devotee', { id: OLD }, V), 'FORBIDDEN', 'the old link stays dead');
t.code(await call('share.leave', { id: 'Nnothere00' }, V), 'NOT_FOUND', 'leaving a share that does not exist: nothing to leave');
t.code(await call('share.leave', { id: SID }, X), 'NOT_FOUND', "nobody leaves a share that is somebody else's");
t.code(await call('share.leave', { id: SID }, V), 'ok', 'the viewer removes it from their own list');
t.code(await call('share.devotee', { id: SID }, V), 'FORBIDDEN', '… and is refused at once');
t.eq((await call('share.list', {}, O)).data.sharedWith, [], "gone from the owner's list");
t.eq(rows("SELECT action, who, target FROM audit_log WHERE action IN ('share.remove', 'share.leave') ORDER BY id").map((x) => [x.action, x.who, x.target]),
  [['share.remove', O_, V_], ['share.leave', V_, O_]], 'both are in Activity');

// ---- share.list is one round trip of reads beyond the session
let hops = 0;
const realPrepare = DB.prepare.bind(DB), realBatch = DB.batch.bind(DB);
DB.prepare = (s) => { const wrap = (x) => ({ ...x, s: x.s, args: x.args, bind: (...a) => wrap(x.bind(...a)),
  first: async () => { hops++; return x.first(); }, all: async () => { hops++; return x.all(); }, run: async () => { hops++; return x.run(); } });
  return wrap(realPrepare(s)); };
DB.batch = async (list) => { hops++; return realBatch(list); };
const hopsOf = async (action, tok) => { hops = 0; await call(action, {}, tok); return hops; };
const session = await hopsOf('admin.lists', O);         // refused at the gate: the session's own reads only
await call('share.add', { phone: V_ }, O);
t.eq((await hopsOf('share.list', O)) - session, 1, 'share.list costs one round trip beyond the session');
DB.prepare = realPrepare; DB.batch = realBatch;

// ---- a lookup limit per owner, so the box is not a way to walk through numbers
const R = await join(R_, 'Ratan Lal');
let busy = '';
for (let i = 0; i < 31 && !busy; i++) { const x = await call('share.lookup', { phone: '60000001' + String(70 + (i % 20)) }, R); if (!x.ok && x.error.code === 'BUSY') busy = `after ${i}`; }
t.eq(busy, 'after 30', '30 lookups an hour, then BUSY');
at('2026-10-06T11:05:00');
t.code(await call('share.lookup', { phone: V_ }, R), 'ok', 'an hour later it works again');

// ---- deleting an account takes its shares with it, both ways
await call('share.add', { phone: O_ }, V);
t.eq(rows('SELECT COUNT(*) AS n FROM sadhana_shares WHERE owner = ? OR viewer = ?', V_, V_)[0].n, 2, 'the viewer is in two shares (one each way)');
t.code(await call('account.delete', { password: 'Devotee pass 2026', confirm: 'DELETE' }, V), 'ok', 'the viewer deletes their account');
t.eq(rows('SELECT COUNT(*) AS n FROM sadhana_shares WHERE owner = ? OR viewer = ?', V_, V_)[0].n, 0, '… and both shares are gone');
t.eq((await call('share.list', {}, O)).data.sharedWith, [], "the owner's list is empty");

t.done();
