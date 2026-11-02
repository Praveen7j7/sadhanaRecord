// The facilitator lifecycle (ADR 0014, the head, 22 Oct 2026): a rename changes the name everywhere at once, and
// when a facilitator stops facilitating, their active students become the head's decision — a new facilitator from
// the list, or inactive — instead of keeping a facilitator who no longer exists.
import { boot, suite } from './harness.mjs';

const t = suite('facilitator lifecycle: rename with cascade; students who need a new facilitator');
const { DB, call, clock, rows, addAccount } = boot();
clock.now = Date.parse('2026-10-14T10:00:00+05:30');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'spsfl', name: 'Sps Life', batchIds: ['SPS'], tempPassword: 'Temp-spsfl-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spsfl'");
const C = (await call('auth.login', { login: 'spsfl', password: 'Temp-spsfl-2026' })).data.token;

t.code(await call('facilitators.add', { name: 'Gopal Krishna Das' }, M), 'ok', 'a facilitator on the list');
const person = (login, name, extra = '') => {
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by${extra ? ', ' + extra.split('=')[0] : ''})
    VALUES ('${login}', 'DEVOTEE', '${extra.includes('PENDING') ? 'PENDING' : 'ACTIVE'}', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test'${extra ? ", '" + extra.split('=')[1] + "'" : ''})`);
};
// two students of his (one with a closed earlier membership), his own login, a sign-up waiting for him
person('6000000201', 'Hari Om'); person('6000000202', 'Indu Bala'); person('6000000203', 'Gopal Krishna Das', 'facilitator_name=Gopal Krishna Das');
DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, to_week, facilitator, set_by, set_at) VALUES
  ('6000000201', 'SPS', 'ACTIVE', '2026-08-03', '2026-08-31', 'Gopal Krishna Das', 'test', '2026-08-01'),
  ('6000000201', 'SPS', 'ACTIVE', '2026-09-07', '', 'Gopal Krishna Das', 'test', '2026-09-01'),
  ('6000000202', 'SPS', 'ACTIVE', '2026-09-07', '', 'Gopal Krishna Das', 'test', '2026-09-01')`);
DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by, requested_facilitator, requested_batch)
  VALUES ('6000000204', 'DEVOTEE', 'PENDING', 'Jaya Sen', '6000000204', 'x', 'y', 1, '2026-10-13', '2026-10-13', 'test', 'Gopal Krishna Das', 'SPS')`);

/* ── A. rename, once, everywhere ── */
t.code(await call('facilitators.rename', { name: 'Gopal Krishna Das', newName: 'HG Gopal Krishna Das' }, C), 'FORBIDDEN', 'only the head renames');
let r = await call('facilitators.rename', { name: 'Gopal Krishna Das', newName: 'HG Gopal Krishna Das', reason: 'initiated name' }, M);
t.code(r, 'ok', 'the head renames a facilitator');
t.eq(r.data.moved, { students: 2, logins: 1, waiting: 1 }, 'it says what moved: two students, his login, one waiting sign-up');
t.ok(!('dashboard' in r.data), 'and no longer sends the head to the dashboard: the list is the app’s own (27 Oct 2026)');
t.eq(rows("SELECT facilitator AS f FROM memberships WHERE login = '6000000201' ORDER BY from_week").map(x => x.f), ['Gopal Krishna Das', 'HG Gopal Krishna Das'],
  'the open membership has the new name; the closed one keeps the name it was recorded under');
t.eq(rows("SELECT facilitator_name AS f FROM accounts WHERE login = '6000000203'")[0].f, 'HG Gopal Krishna Das', "his own login carries it (and so his facilitator scope)");
t.eq(rows("SELECT requested_facilitator AS f FROM accounts WHERE login = '6000000204'")[0].f, 'HG Gopal Krishna Das', 'the waiting sign-up too');
const list = (await call('facilitators.list', {}, M)).data.facilitators.map(f => f.name);
t.ok(list.includes('HG Gopal Krishna Das') && !list.includes('Gopal Krishna Das'), 'the pick list shows the new name only');
t.eq(rows(`SELECT n.fac_id = f.id AS same FROM facilitator_names n JOIN facilitators f ON f."name" = 'HG Gopal Krishna Das' WHERE n."name" = 'Gopal Krishna Das'`)[0]?.same, 1,
  'one row renamed, not a second one: the old spelling is kept and still finds him (Phase 24)');
t.eq(rows(`SELECT COUNT(*) AS n FROM facilitators WHERE "name" = 'Gopal Krishna Das'`)[0].n, 0, 'and no removed copy of the old name is left on the list');
t.eq(rows(`SELECT source FROM facilitators WHERE "name" = 'HG Gopal Krishna Das'`)[0].source, 'APP', "the renamed one is the app's");
t.eq(rows("SELECT reason FROM audit_log WHERE action = 'facilitators.rename'").map(x => x.reason), ['initiated name'], 'audited, with the reason');
await call('facilitators.add', { name: 'Madhava Das' }, M);
t.code(await call('facilitators.rename', { name: 'Madhava Das', newName: 'Gopal Krishna Das' }, M), 'VALIDATION', 'his old name is not given to another facilitator: it still finds him');
t.code(await call('facilitators.add', { name: 'Gopal Krishna Das' }, M), 'VALIDATION', 'nor added as a new one');
t.code(await call('facilitators.rename', { name: 'HG Gopal Krishna Das', newName: 'madhava das' }, M), 'VALIDATION', "nor another facilitator's");

/* ── D. a facilitator stops facilitating: their students are the head's decision ── */
r = await call('facilitators.orphans', {}, M);
t.eq(r.data.students, [], 'nobody needs a new facilitator while theirs is on the list');
await call('facilitators.setActive', { name: 'HG Gopal Krishna Das', active: false }, M);
r = await call('facilitators.orphans', {}, M);
t.eq(r.data.students.map(s => [s.name, s.facilitator]), [['Hari Om', 'HG Gopal Krishna Das'], ['Indu Bala', 'HG Gopal Krishna Das']],
  'switched off: his two active students wait for the head, still showing his name');
t.ok(r.data.facilitators.includes('Madhava Das') && !r.data.facilitators.includes('HG Gopal Krishna Das'), 'with the active list to choose from');
t.code(await call('devotees.setPeople', { login: '6000000201', facilitator: 'Madhava Das' }, M), 'ok', 'the head gives Hari a new facilitator');
t.code(await call('devotees.setActive', { login: '6000000202', active: false }, M), 'ok', 'and marks Indu inactive: she has left too');
t.eq((await call('facilitators.orphans', {}, M)).data.students, [], 'both decided: the list is empty');
t.eq(rows("SELECT before, after FROM audit_log WHERE action = 'devotees.setPeople' AND target = '6000000201'").map(x => [JSON.parse(x.before).facilitator, JSON.parse(x.after).facilitator]),
  [['HG Gopal Krishna Das', 'Madhava Das']], 'the change of facilitator is in Activity: who, from whom, to whom');
t.code(await call('facilitators.orphans', {}, C), 'FORBIDDEN', 'the list is the head\'s');

/* ── a facilitator's OWN login shows the new name when they sign in (27 Oct 2026: Devesa Hari Prabhuji → HG Devesa Hari Das) ── */
t.code(await call('facilitators.add', { name: 'Keshava Das Prabhuji' }, M), 'ok', 'another facilitator, with a login of his own');
DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by, facilitator_name)
  VALUES ('keshava.das', 'COORDINATOR', 'ACTIVE', 'Keshava Das Prabhuji', '', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test', 'Keshava Das Prabhuji')`);
t.code(await call('facilitators.rename', { name: 'Keshava Das Prabhuji', newName: 'HG Keshava Das' }, M), 'ok', 'the head renames him');
t.eq(rows("SELECT name, facilitator_name AS f FROM accounts WHERE login = 'keshava.das'")[0], { name: 'HG Keshava Das', f: 'HG Keshava Das' },
  'his own login now greets him by the new name, not the old one');
// Phase 24 (one name, one place, the head, 27 Oct 2026) replaced the rule of the morning of 27 Oct: a devotee whose own
// name IS the facilitator name is that facilitator — one person, one name — so the rename reaches their account too
t.eq(rows("SELECT name FROM accounts WHERE login = '6000000203'")[0].name, 'HG Gopal Krishna Das', 'a devotee who is that facilitator, under the same name, is renamed with it');
t.done();
