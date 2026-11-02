// Audit phase 3.6 (13 Oct 2026): a profile save is all-or-nothing.
//
// profile.update used to issue up to four separate db.batch() calls — the membership's facilitator, the
// membership's class day, the accounts row, the profiles row. D1 has no transactions across calls, so a failure
// part-way through left the person with a new facilitator and an old class day, or a renamed account whose profile
// row still held the previous name, with nothing to say so. One batch is atomic, so now every statement of a save
// lands together or not at all.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('phase 3: atomic profile save, and sign out everywhere');
const { call, addAccount, DB, rows } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
await call('auth.signUp', { phone: '6000000151', name: 'Devotee Atomic', batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });
await call('requests.approve', { phone: '6000000151', link: { noIdYet: true } }, C);
const D = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.token;

const state = () => ({
  name: rows("SELECT name FROM accounts WHERE login = '6000000151'")[0].name,
  profileName: rows("SELECT name FROM profiles WHERE login = '6000000151'")[0]?.name,
  classDay: rows("SELECT class_day FROM memberships WHERE login = '6000000151' AND to_week = ''")[0]?.class_day,
  blood: rows("SELECT blood_group FROM profiles WHERE login = '6000000151'")[0]?.blood_group,
});

// ---- a save that touches all four places at once ----
const before = state();
t.code(await call('profile.update', { name: 'Devotee Renamed', classDay: 'SAT', bloodGroup: 'B+' }, D), 'ok', 'a save across accounts, profiles and the membership succeeds');
const after = state();
t.eq(after.name, 'Devotee Renamed', 'the account name changed');
t.eq(after.profileName, 'Devotee Renamed', '… and the profiles row followed it in the same write');
t.eq(after.classDay, 'SAT', '… and the membership class day changed');
t.eq(after.blood, 'B+', '… and the profile field changed');
t.ok(before.name !== after.name && before.classDay !== after.classDay, 'the save really did change several tables');

// ---- the save with the ACCOUNTS write doomed, while the MEMBERSHIP write is valid ----
//
// This is the case that tells the two versions apart. The old code wrote the membership's class day in its own
// batch FIRST and the accounts row in a later one, so a failure in the accounts write left the class day changed
// and the name not — a half-applied save with nothing to say so. A unique index on accounts.whatsapp makes that
// write fail while everything before it is perfectly valid.
DB.sql.exec("UPDATE accounts SET whatsapp = '6000000028' WHERE login = 'sps'");
// partial, so the many accounts with an empty whatsapp do not clash
DB.sql.exec("CREATE UNIQUE INDEX tmp_wa ON accounts (whatsapp) WHERE whatsapp = '6000000028'");
const mid = state();
t.eq(mid.classDay, 'SAT', 'before the doomed save, the class day is SAT');
const r = await call('profile.update', { classDay: 'SUN', whatsapp: '6000000028' }, D);
t.ok(!r.ok, 'the save fails because one of its statements cannot be applied: ' + (r.ok ? 'IT SUCCEEDED' : r.error.code));
const end = state();
t.eq(end.classDay, 'SAT', 'the membership class day did NOT change (the old code changed it here)');
t.eq(end.name, mid.name, '… and the account is untouched');
t.eq(end.profileName, mid.profileName, '… and the profiles row too');
DB.sql.exec('DROP INDEX tmp_wa');

// ---- and the save works again afterwards, so nothing was left locked or half-written ----
t.code(await call('profile.update', { name: 'Devotee Fine', classDay: 'SUN' }, D), 'ok', 'the next save succeeds');
t.eq(state().name, 'Devotee Fine', '… and is applied');
t.eq(state().classDay, 'SUN', '… including the membership');



/* ---- auth.logoutAll (audit F21 / roadmap 3.10): sign out every device ---- */
// the temporary index from the section above is dropped already; make sure no stray unique value blocks a save
DB.sql.exec("UPDATE accounts SET whatsapp = '' WHERE login = 'sps'");
// Three devices for the same person, then one of them signs out everywhere.
const t2 = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.token;
const t3 = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.token;
t.code(await call('auth.me', {}, t2), 'ok', 'a second device is signed in');
t.code(await call('auth.me', {}, t3), 'ok', '… and a third');
const out = await call('auth.logoutAll', {}, t2);
t.code(out, 'ok', 'auth.logoutAll succeeds');
t.ok(out.data.devices >= 3, `… and reports how many devices were signed out (${out.data?.devices})`);
t.code(await call('auth.me', {}, t2), 'UNAUTHENTICATED', 'the device that asked is signed out too');
t.code(await call('auth.me', {}, t3), 'UNAUTHENTICATED', '… and so is every other device');
t.code(await call('auth.me', {}, D), 'UNAUTHENTICATED', '… including the one from earlier in this suite');
t.eq(rows("SELECT COUNT(*) AS n FROM sessions WHERE login = '6000000151' AND ended_at = ''")[0].n, 0, 'no open session is left');
t.eq(rows("SELECT COUNT(*) AS n FROM sessions WHERE login = '6000000151' AND end_reason = 'logout all'")[0].n, 3, 'all three sessions carry the reason');
t.eq(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.logoutAll' AND who = '6000000151'")[0].n, 1, 'and it is audited');
// signing in again works normally
t.code(await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' }), 'ok', 'the person can sign in again afterwards');

t.done();
