// Roles given from Access (ADR 0019, the head, 26 Oct 2026): "I assign HG Vilas Padmanabha Prabhuji as SPS coordinator,
// and in his own login he sees the features this membership holds; on revoking he sees only the normal user menus."
// The role is given with the rights the head ticks and an optional end date; revoking takes the role and every change
// that came only with it; an end date takes it by itself.
import { boot, suite } from './harness.mjs';
import { expireRoles } from '../src/grants.js';

const t = suite('access: roles given and revoked from Access, with chosen rights');
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-26T10:00:00');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('batches.create', { batchId: 'ETP-71', name: 'ETP Batch 71', level: 'ETP', startedOn: '2026-10-19', endsOn: '2026-12-31' }, M);
// a devotee of SPS with their own personal login (the person the head makes a coordinator)
await addAccount('6000000151', 'DEVOTEE', 'Devotee pass 2026');
DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('6000000151', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);
const V = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.token;
const me = async () => (await call('auth.me', {}, V)).data.user.scopes;
const assign = (extra) => call('access.assign', { login: '6000000151', reason: 'test', ...extra }, M);
const coordRights = ['signups', 'fillFor', 'attendance', 'leaders', 'devoteeEdit', 'deleteAccounts', 'promote', 'exports', 'reopen'];

/* ── before: a devotee, nothing more ── */
t.eq((await me()).coordinator, [], 'before: no batches to coordinate');
t.code(await call('devotees.list', { batchId: 'SPS' }, V), 'FORBIDDEN', 'before: the coordinator screens are refused');

/* ── Access offers only what can really be given (the head, 27 Oct 2026) ── */
let ag = (await call('access.get', { login: '6000000151' }, M)).data;
t.eq(ag.roleDefs.map(r => r.id).sort(), ['coordinator', 'ftp', 'leader', 'training'], 'a devotee in SPS can be offered all four roles (a class batch and a training are running)');
t.eq(ag.capabilities.map(c => c.id).sort(), ['reopenAsk', 'wallComment', 'wallPost'], "and only the rights that mean something for a devotee — no sign-ups, resets or deletions");
t.ok(ag.labels.signups && ag.labels.enrol, '… while every right still has its name, for the role sheet');
await addAccount('fac.login', 'COORDINATOR', 'Fac login pass 2026');
DB.sql.exec(`UPDATE accounts SET facilitator_name = 'Radha Raman Das' WHERE login = 'fac.login'`);
ag = (await call('access.get', { login: 'fac.login' }, M)).data;
t.ok(!ag.roleDefs.some(r => r.id === 'coordinator' || r.id === 'training' || r.id === 'leader'), "a facilitator's own login is not offered coordinator, training or group-leader roles (the server refuses them)");
t.ok(ag.roleDefs.some(r => r.id === 'ftp'), '… but can be an FTP coordinator');

/* ── give: coordinator of SPS, without "reset passwords", with "reopen a missed week" ── */
const g = await assign({ role: 'coordinator', batchIds: ['SPS'], rights: coordRights });
t.code(g, 'ok', 'the head makes them coordinator of SPS');
t.eq(g.data.roles.map(r => [r.role, r.batches.map(b => b.batchId)]), [['coordinator', ['SPS']]], 'Access shows the role and its batch');
let s = await me();
t.eq(s.coordinator, ['SPS'], 'in their own login they now coordinate SPS');
t.eq(s.rights?.resets, 'deny', '… the scopes carry "reset passwords" turned off, so the app can hide it');
t.eq(s.rights?.reopen, 'allow', '… and "reopen a missed week" given');
ag = (await call('access.get', { login: '6000000151' }, M)).data;
t.ok(['signups', 'resets', 'fillFor', 'deleteAccounts', 'reopen'].every(id => ag.capabilities.some(c => c.id === id)), 'holding the coordinator role, its rights are listed for them');
t.code(await call('devotees.list', { batchId: 'SPS' }, V), 'ok', 'the coordinator screens answer them');
const fresh = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.user.scopes;
t.ok(fresh.coordinator.includes('SPS') && fresh.rights?.resets === 'deny', 'signing in again gives the same scopes and rights');
t.code(await call('resets.approve', { login: '6000000199' }, V), 'FORBIDDEN', 'the right left out is refused by the server');
t.code(await call('devotees.list', { batchId: 'DPS' }, V), 'FORBIDDEN', 'and nothing opens beyond SPS');
t.code(await call('week.get', { weekId: '2026-10-19' }, V), 'ok', 'their own sadhana form is untouched');

/* ── refusals ── */
t.code(await assign({ role: 'training', batchIds: ['SPS'], rights: [] }), 'VALIDATION', 'a class batch is not given as a training');
t.code(await assign({ role: 'coordinator', batchIds: ['SPS'], rights: ['enrol'] }), 'VALIDATION', 'a right that does not come with the role is refused');
t.code(await assign({ role: 'coordinator', batchIds: [], rights: [] }), 'VALIDATION', 'a coordinator needs a batch');
t.code(await call('access.assign', { login: 'master', role: 'coordinator', batchIds: ['SPS'], rights: [], reason: 'x' }, M), 'CONFLICT', 'a head already holds every role');
t.code(await call('access.assign', { login: '6000000151', role: 'coordinator', batchIds: ['DPS'], rights: [], reason: 'x' }, V), 'FORBIDDEN', 'only the head gives roles');

/* ── a second role beside it: training coordinator of ETP-71, until 31 Oct ── */
t.code(await assign({ role: 'training', batchIds: ['ETP-71'], rights: ['attendance', 'enrol', 'promote', 'exports'], until: '2026-10-31' }), 'ok', 'and training coordinator of ETP-71 until 31 Oct');
t.eq((await me()).coordinator.sort(), ['ETP-71', 'SPS'], 'they hold both');

/* ── revoke the coordinator role: back to the normal menus, nothing left behind ── */
const r = await call('access.revoke', { login: '6000000151', role: 'coordinator', reason: 'test' }, M);
t.code(r, 'ok', 'the head revokes the SPS coordinator role');
s = await me();
t.eq(s.coordinator, ['ETP-71'], 'SPS leaves their scopes at once; the training role stays');
t.ok(!s.rights?.resets && !s.rights?.reopen, 'the changes that came only with it are gone (nothing to come back later)');
t.code(await call('devotees.list', { batchId: 'SPS' }, V), 'FORBIDDEN', 'the SPS coordinator screens are refused again');
t.ok(!rows("SELECT coordinator_logins FROM batches WHERE batch_id = 'SPS'")[0].coordinator_logins.includes('6000000151'), 'SPS no longer lists them');
t.code(await call('access.revoke', { login: '6000000151', role: 'coordinator', reason: 'again' }, M), 'CONFLICT', 'revoking a role they do not hold is refused');

/* ── an end date: refused after it by the very next call, then removed by the daily job ── */
at('2026-11-01T09:00:00');
t.eq((await me()).coordinator, [], 'after 31 Oct the training role no longer counts, before any job runs');
t.ok(rows("SELECT coordinator_logins FROM batches WHERE batch_id = 'ETP-71'")[0].coordinator_logins.includes('6000000151'), '(still listed until the daily job)');
const ran = await expireRoles(DB, new Date(clock.now));
t.ok(/6000000151:training/.test(ran), 'the daily job takes it away');
t.ok(!rows("SELECT coordinator_logins FROM batches WHERE batch_id = 'ETP-71'")[0].coordinator_logins.includes('6000000151'), 'ETP-71 no longer lists them');
t.eq(rows("SELECT grants FROM accounts WHERE login = '6000000151'")[0].grants, '', 'and nothing is left on their row');
t.eq(await expireRoles(DB, new Date(clock.now)), '', 'run again, it has nothing to do');

/* ── group leader: given and revoked here too ── */
t.code(await assign({ role: 'leader' }), 'ok', 'the head makes them a group leader');
t.ok(!!(await me()).groupLeader, 'they lead a group in their own login');
t.code(await call('access.revoke', { login: '6000000151', role: 'leader', reason: 'test' }, M), 'ok', 'and revokes it');
t.eq((await me()).groupLeader, null, 'back to a devotee');

/* ── FTP coordinator (the head, 26 Oct): defines the original facilitators and sees all of them on one board ── */
t.code(await call('facilitators.list', {}, V), 'FORBIDDEN', 'before: the facilitator list is the head\'s');
t.code(await assign({ role: 'ftp', batchIds: ['SPS'], rights: [] }), 'VALIDATION', 'an FTP coordinator has no batches to choose');
t.code(await assign({ role: 'ftp', rights: ['facBoard', 'facManage', 'targetsOpen'] }), 'ok', 'the head makes them FTP coordinator');
t.eq((await me()).ftp, true, 'their scopes say so');
t.code(await call('facilitators.list', {}, V), 'ok', 'they see the facilitator list');
t.code(await call('facilitators.add', { name: 'Radha Raman Das' }, V), 'ok', 'and add a facilitator');
const boards = (await call('board.list', {}, V)).data;
const fb = (boards.boards || boards).find?.((b) => b.kind === 'facilitators');
t.ok(fb && !fb.self, "they get the whole facilitators' board, not just their own place");
t.code(await call('targets.unlock', { login: '6000000151', reason: 'testing it' }, V), 'FORBIDDEN', "a non-facilitator's targets stay the head's");
t.code(await call('facilitators.delete', { name: 'Radha Raman Das', reason: 'test' }, V), 'FORBIDDEN', 'deleting a facilitator stays the head\'s');
t.code(await call('card.unlock', { login: '6000000151', reason: 'testing it' }, V), 'FORBIDDEN', "a training's closed card stays the head's");
t.code(await assign({ role: 'ftp', rights: ['facBoard'] }), 'ok', 'the head keeps the board but takes "add, rename" away');
t.code(await call('facilitators.add', { name: 'Gaura Das' }, V), 'FORBIDDEN', '… and adding is refused');
t.code(await call('access.revoke', { login: '6000000151', role: 'ftp', reason: 'test' }, M), 'ok', 'revoked');
t.code(await call('facilitators.list', {}, V), 'FORBIDDEN', 'the facilitator list is closed to them again');
t.ok(!rows("SELECT grants FROM accounts WHERE login = '6000000151'")[0].grants.includes('facManage'), 'and nothing of it is left on their row');

/* ── an FTP coordinator created straight from Admin › Staff (the head, 27 Oct 2026) ── */
t.code(await call('coordinators.create', { username: 'ftp.coord', name: 'Ftp Coordinator', tempPassword: 'Temp-ftp-2026', ftp: true, batchIds: ['SPS'] }, M), 'VALIDATION', 'an FTP coordinator has no batches');
const fc = await call('coordinators.create', { username: 'ftp.coord', name: 'Ftp Coordinator', tempPassword: 'Temp-ftp-2026', ftp: true }, M);
t.code(fc, 'ok', 'the head creates an FTP coordinator from Staff');
t.eq(fc.data.coordinator.ftp, true, 'Staff shows them as the FTP coordinator');
DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = 'ftp.coord'`);
const F = (await call('auth.login', { login: 'ftp.coord', password: 'Temp-ftp-2026' })).data.token;
t.eq((await call('auth.me', {}, F)).data.user.scopes.ftp, true, 'they sign in as the FTP coordinator');
t.code(await call('facilitators.list', {}, F), 'ok', 'and look after the facilitators');
t.code(await call('devotees.list', { batchId: 'SPS' }, F), 'FORBIDDEN', 'but hold no batch');
t.eq((await call('access.get', { login: 'ftp.coord' }, M)).data.roles.map(r => r.role), ['ftp'], 'Access shows the role, to fine-tune or revoke');

t.ok(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('access.assign', 'access.revoke')")[0].n >= 6, 'every give and revoke is in Activity');
t.done();
