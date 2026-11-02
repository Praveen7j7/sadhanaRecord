// Searching Activity (the head, 22 Oct 2026): "if there are 1000s of logs and I want to search a particular action, I
// should be having a search bar". audit.list takes `q` — matched against the action, the reason, the names of the
// people in the line and its target — and `actions`, the actions whose wording on the screen matched (the screen holds
// the wording). Newest first, paged as before; the head only.
import { boot, suite } from './harness.mjs';

const t = suite('Activity search: one box over action, wording, reason and names');
const { DB, call, clock, addAccount } = boot();
clock.now = Date.parse('2026-10-14T10:00:00+05:30');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'spsac', name: 'Sps Activity', batchIds: ['SPS'], tempPassword: 'Temp-spsac-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spsac'");
const C = (await call('auth.login', { login: 'spsac', password: 'Temp-spsac-2026' })).data.token;
DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
  VALUES ('6000000231', 'DEVOTEE', 'ACTIVE', 'Ramesh Kulkarni', '6000000231', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
const line = (at, who, action, target, reason = '') => DB.sql.exec(`INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id)
  VALUES ('${at}', '${who}', 'COORDINATOR', '${action}', '${target}', 'SPS', '', '', '${reason}', 'rq-${Math.random()}')`);
line('2026-10-10T10:00:00+05:30', 'spsac', 'devotees.setPeople', '6000000231');
line('2026-10-11T10:00:00+05:30', 'spsac', 'devotees.promote', '6000000231', 'ready for DPS');
line('2026-10-12T10:00:00+05:30', 'master', 'phases.update', 'kartik-2026', 'started a week early');
line('2026-10-13T10:00:00+05:30', 'master', 'facilitators.rename', 'HG Gopal Krishna Das', 'initiated name');

const find = async (data) => (await call('audit.list', { limit: 50, ...data }, M)).data.rows.map(r => r.action);
t.eq(await find({ q: 'promote' }), ['devotees.promote'], 'by the action: "promote"');
t.eq(await find({ q: 'week early' }), ['phases.update'], 'by the reason written');
t.ok((await find({ q: 'Kulkarni' })).includes('devotees.promote') && (await find({ q: 'Kulkarni' })).includes('devotees.setPeople'),
  "by the name of the person it was about, not only their phone");
t.ok((await find({ q: 'Sps Activity' })).length >= 2, 'by the name of who did it');
t.eq(await find({ q: 'Gopal' }), ['facilitators.rename'], 'by a target that is a name (a facilitator renamed)');
t.eq(await find({ actions: ['devotees.setPeople'] }), ['devotees.setPeople'], 'by the wording on the screen ("facilitator" → the actions that say it)');
t.eq(await find({ q: 'zzzz-nothing' }), [], 'nothing matching is an empty list, not an error');
t.ok((await find({ q: 'promote', what: 'phases.' })).length === 0, 'and it narrows with the other filters, never widens them');
t.code(await call('audit.list', { q: 'x' }, M), 'VALIDATION', 'one letter is too little to search on');
t.code(await call('audit.list', { q: 'promote' }, C), 'FORBIDDEN', 'Activity is the head\'s');
t.done();
