// Permissions per person (ADR 0015, the head, 22 Oct 2026): give and take, any devotee or staff, enforced in the one
// gate from the person's own row. A taken capability is refused even where the role allows it; a given one passes a role
// gate only for capabilities whose handlers narrow by batch, so it never opens a batch the person does not hold.
import { boot, suite } from './harness.mjs';

const t = suite('access: the head gives and takes permissions, per person');
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-14T10:00:00');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const coord = async (u, batch) => {
  await call('coordinators.create', { username: u, name: 'Coord ' + u.replace(/\d/g, '').replace(/^./, (c) => c.toUpperCase()), batchIds: [batch], tempPassword: `Temp-${u}-2026` }, M);
  DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = '${u}'`);
  return (await call('auth.login', { login: u, password: `Temp-${u}-2026` })).data.token;
};
const C = await coord('spsg', 'SPS'), D = await coord('dpsg', 'DPS');
await addAccount('6000000241', 'DEVOTEE', 'Devotee pass 2026');
DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('6000000241', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);
const V = (await call('auth.login', { login: '6000000241', password: 'Devotee pass 2026' })).data.token;
const set = (login, capability, effect, extra = {}) => call('access.set', { login, capability, effect, reason: 'test', ...extra }, M);

/* ── take away: refused even though the role allows it ── */
t.code(await call('requests.approve', { phone: '6000000299', link: { noIdYet: true } }, C), 'NOT_FOUND', 'by role, a coordinator may approve (nobody to approve here)');
t.code(await set('spsg', 'signups', 'deny'), 'ok', 'the head takes sign-up approval away from this coordinator');
const r = await call('requests.approve', { phone: '6000000299', link: { noIdYet: true } }, C);
t.code(r, 'FORBIDDEN', '… and the server refuses it, before the handler');
t.ok(/turned this off/.test(r.error?.message || ''), '… saying the head turned it off');
t.code(await call('requests.approve', { phone: '6000000299', link: { noIdYet: true } }, D), 'NOT_FOUND', 'another coordinator keeps it');
t.code(await call('devotees.list', { batchId: 'SPS' }, C), 'ok', 'and everything else this coordinator does is untouched');

/* ── a devotee: comments on the Wall taken away; their own week untouched ── */
const post = (await call('announcements.create', { title: 'Hari bol', body: 'Sunday feast', audience: 'ALL' }, M)).data.announcement;
t.code(await call('announcements.comment', { id: post.id, body: 'Jaya' }, V), 'ok', 'a devotee comments');
t.code(await set('6000000241', 'wallComment', 'deny'), 'ok', 'the head takes commenting away from them');
t.code(await call('announcements.comment', { id: post.id, body: 'Again' }, V), 'FORBIDDEN', 'their next comment is refused');
t.code(await call('announcements.list', {}, V), 'ok', 'they still read the Wall');

/* ── fill for someone: taken only on behalf, never their own form ── */
t.code(await set('spsg', 'fillFor', 'deny'), 'ok', 'filling for devotees taken from the coordinator');
t.code(await call('week.saveDay', { weekId: '2026-10-12', date: '2026-10-12', version: 0, day: { rounds: 16 }, onBehalfOf: '6000000241' }, C), 'FORBIDDEN',
  'filling a devotee\'s day is refused');
t.code(await call('week.saveDay', { weekId: '2026-10-12', date: '2026-10-12', version: 0, day: { rounds: 16 } }, V), 'ok',
  'the devotee filling their own day is not that capability');

/* ── give beyond the role: reopen a missed week — their own batches only ── */
DB.sql.exec(`INSERT INTO missed_weeks (login, week_id, batch_id, days_filled, at) VALUES ('6000000241', '2026-10-05', 'SPS', 0, '2026-10-12T21:00:00+05:30')`);
const reopen = (tok) => call('weeks.reopen', { login: '6000000241', weekId: '2026-10-05', reason: 'was ill', openUntil: '2026-10-20T21:00:00+05:30' }, tok);
t.code(await reopen(C), 'FORBIDDEN', 'by role, only the head reopens a week');
t.code(await set('spsg', 'reopen', 'allow'), 'ok', 'the head gives this coordinator "reopen a missed week"');
t.code(await set('dpsg', 'reopen', 'allow'), 'ok', '… and the DPS coordinator too');
t.code(await reopen(D), 'FORBIDDEN', "given, it still stops at their own batches: the DPS coordinator cannot reopen an SPS devotee's week");
t.code(await reopen(C), 'ok', 'the SPS coordinator reopens their own devotee\'s week');
t.code(await set('spsg', 'signups', 'allow'), 'VALIDATION', 'a capability that comes with a role cannot be given on its own (no batch to narrow it)');

/* ── give: personal details in exports, only those fields ── */
let cat = (await call('exports.catalog', {}, C)).data;
t.ok(!cat.fields.some(f => f.personal), 'by role a coordinator is not offered personal details');
await set('spsg', 'exportsPersonal', 'allow');
cat = (await call('exports.catalog', {}, C)).data;
t.ok(cat.fields.some(f => f.personal), 'given, the personal fields are offered');
t.ok(!cat.sources?.some?.(s => s.fixed), "and none of the head's own exports are");

/* ── an end date ── */
t.code(await set('dpsg', 'resets', 'deny', { until: '2026-10-10' }), 'VALIDATION', 'an end date in the past is refused');
t.code(await set('dpsg', 'resets', 'deny', { until: '2026-10-15' }), 'ok', 'reset passwords taken from the DPS coordinator until 15 Oct');
t.code(await call('resets.approve', { login: '6000000298' }, D), 'FORBIDDEN', 'refused on the 14th');
at('2026-10-16T10:00:00');
t.code(await call('resets.approve', { login: '6000000298' }, D), 'NOT_FOUND', 'after the 15th it is back by itself (nobody to reset here)');

/* ── put back, list, guards ── */
t.code(await set('spsg', 'signups', ''), 'ok', 'back to what the role gives');
t.code(await call('requests.approve', { phone: '6000000299', link: { noIdYet: true } }, C), 'NOT_FOUND', 'and they approve sign-ups again');
const list = (await call('access.list', {}, M)).data.people;
t.ok(list.some(p => p.login === 'spsg' && p.grants.some(g => g.id === 'reopen' && g.effect === 'allow')), 'access.list shows everyone with a change');
t.code(await set('master', 'signups', 'deny'), 'CONFLICT', "a head's powers are not changed here");
t.code(await call('access.set', { login: 'spsg', capability: 'reopen', effect: 'allow', reason: 'x' }, C), 'FORBIDDEN', 'only the head changes permissions');
t.ok(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'access.set'")[0].n >= 8, 'every change is in Activity');
const found = (await call('access.search', { q: 'Coord Spsg' }, M)).data.people;
t.eq(found.map(p => p.login), ['spsg'], 'the head finds anyone by name');
const one = (await call('access.get', { login: 'spsg' }, M)).data;
t.eq(one.coordinates.map(b => b.batchId), ['SPS'], "and sees their roles beside the capabilities: coordinator of SPS");
t.done();
