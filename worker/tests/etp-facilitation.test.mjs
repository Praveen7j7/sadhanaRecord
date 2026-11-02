// ETP facilitation is temporary (ADR 0010, the head, 22 Oct 2026): enrolling lets a trainee facilitate; when the
// training ends for them — removed, repeat, left, or qualified — it is taken back, their name leaves the pick list and
// their students go to the head as decisions (ADR 0014 D). A facilitator in their own right is never touched, and the
// head can make a trainee's facilitation lasting (until FTP does). And (ADR 0011) a training's coordinator can never
// delete an account.
import { boot, suite } from './harness.mjs';

const t = suite('ETP facilitation: temporary, taken back when the training ends; lasting stays');
const { DB, call, clock, rows, addAccount } = boot();
clock.now = Date.parse('2026-10-14T10:00:00+05:30');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('batches.create', { batchId: 'ETP-81', name: 'ETP Batch 81', level: 'ETP', startedOn: '2026-10-12', endsOn: '2027-06-30' }, M);
await call('coordinators.create', { username: 'etp81', name: 'Etp Eightyone', batchIds: ['ETP-81'], tempPassword: 'Temp-e81-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp81'");
const E = (await call('auth.login', { login: 'etp81', password: 'Temp-e81-2026' })).data.token;

const person = (login, name, fac = '', kind = '') => {
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by, facilitator_name, facilitation)
    VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test', '${fac}', '${kind}')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('${login}', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);
};
const student = (login, name, fac) => {
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
    VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, facilitator, set_by, set_at) VALUES ('${login}', 'SPS', 'ACTIVE', '2026-09-07', '${fac}', 'test', '2026-09-01')`);
};
const facOf = (login) => rows(`SELECT facilitator_name AS f, facilitation AS k FROM accounts WHERE login = '${login}'`).map(x => [x.f, x.k])[0];
const offered = (name) => rows(`SELECT active FROM facilitators WHERE "name" = '${name}' AND deleted_at = ''`)[0]?.active === 1;

person('6000000221', 'Lata Iyer'); person('6000000222', 'Mohan Pal'); person('6000000223', 'Nanda Kishor'); person('6000000224', 'Om Prakash');
person('6000000225', 'Prema Devi', 'Prema Devi', 'lasting');               // a facilitator before she ever trained
DB.sql.exec(`INSERT INTO facilitators ("name", "in_cohort", "order", active, source) VALUES ('Prema Devi', 1, 90, 1, 'APP')`);
for (const l of ['6000000221', '6000000222', '6000000223', '6000000224', '6000000225']) t.code(await call('enrol.add', { batchId: 'ETP-81', login: l }, E), 'ok', `enrolled ${l}`);

t.eq(facOf('6000000221'), ['Lata Iyer', 'temporary'], 'enrolling grants facilitation, marked temporary');
t.ok(offered('Lata Iyer'), 'and her name joins the pick list, so students can be given to her');
t.eq(facOf('6000000225'), ['Prema Devi', 'lasting'], "a facilitator in her own right stays lasting when she enrols");
student('6000000226', 'Ravi Gupta', 'Lata Iyer');

/* ── removed from the training: taken back ── */
t.code(await call('enrol.remove', { batchId: 'ETP-81', login: '6000000221', reason: 'stopped coming' }, E), 'ok', 'Lata is taken out of the training');
t.eq(facOf('6000000221'), ['', ''], 'her temporary facilitation is taken back');
t.ok(!offered('Lata Iyer'), 'her name is off the pick list');
t.eq((await call('facilitators.orphans', {}, M)).data.students.map(s => [s.name, s.facilitator]), [['Ravi Gupta', 'Lata Iyer']],
  "and her student waits for the head's decision, still showing her name (ADR 0014 D)");

/* ── the head makes one lasting before the training closes ── */
t.code(await call('facilitators.setLasting', { name: 'Nanda Kishor', reason: 'ready' }, M), 'ok', 'the head makes Nanda lasting');

/* ── the training closes: repeat, left, qualified all take it back; lasting stays ── */
t.code(await call('batches.close', { batchId: 'ETP-81', decisions: [
  { login: '6000000222', decision: 'repeat' }, { login: '6000000223', decision: 'qualified' },
  { login: '6000000224', decision: 'qualified' }, { login: '6000000225', decision: 'left' }] }, E), 'ok', 'the training closes');
t.eq(facOf('6000000222'), ['', ''], 'repeat: taken back (they facilitate again when re-enrolled)');
t.eq(facOf('6000000224'), ['', ''], 'qualified: taken back too — FTP, or the head, makes it lasting');
t.eq(facOf('6000000223'), ['Nanda Kishor', 'lasting'], 'qualified and made lasting by the head: stays a facilitator');
t.ok(offered('Nanda Kishor'), '… and on the pick list');
t.eq(facOf('6000000225'), ['Prema Devi', 'lasting'], 'a facilitator before ETP keeps it whatever the training decided');
t.ok(offered('Prema Devi'), '… and stays on the pick list');

/* ── ADR 0011: a training's coordinator never deletes an account ── */
t.code(await call('devotees.delete', { login: '6000000222', confirmPhone: '6000000222' }, E), 'FORBIDDEN',
  "a training coordinator cannot delete a trainee's account (their batch is the class batch, which the coordinator does not hold)");

t.done();
