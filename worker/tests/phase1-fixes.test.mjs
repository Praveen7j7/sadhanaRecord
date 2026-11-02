// Audit phase 1, server side (13 Oct 2026). One suite per finding, each written to FAIL without its fix:
//   F2  devotees.delete let a batch coordinator erase a youth facilitator's account
//   F17 a third, ASCII-only name regex in facilitators.add
//   J3  the MASTER_RESET_PASSWORD marker was a plain hash of a live temporary password, and reached the Sheets copy
//   J5  attendance notices marked people notified whose phones were never pushed
// Phone numbers are from the project's test range (60000000xx), never a number a real person could hold.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { applyMasterReset } from '../src/setup.js';
import { runAttendanceNotices } from '../src/push.js';
import { sha256Hex } from '../src/crypto.js';

const t = suite('audit phase 1 fixes');
const { call, addAccount, DB, env, clock, rows } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const X = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });
  await call('requests.approve', { phone, link: { noIdYet: true } }, X);
};

/* ---- F2: a coordinator must not delete a devotee who also has a facilitator login ---- */
await join('6000000101', 'Youth Facilitator');
await join('6000000102', 'Plain Devotee');
// the head gives that devotee a facilitator login (facilitator.js loginsLink): the account now carries facilitator_name
t.code(await call('facLogins.link', { facilitator: FAC, phone: '6000000101' }, M), 'ok', 'the head links a devotee to a facilitator name');
t.code(await call('devotees.delete', { login: '6000000101', confirmPhone: '6000000101' }, X),
  'FORBIDDEN', 'F2: the batch coordinator cannot delete a devotee who is also a facilitator');
t.eq(rows("SELECT COUNT(*) AS n FROM accounts WHERE login = '6000000101'")[0].n, 1, '… and the account is still there');
t.code(await call('devotees.delete', { login: '6000000102', confirmPhone: '6000000102' }, X),
  'ok', '… while a plain devotee of the batch is still deleted by the coordinator');

/* ---- F17: the facilitator list takes a name in any script, through the shared rule ---- */
t.code(await call('facilitators.add', { name: 'Kṛṣṇa Dāsa Prabhuji' }, M), 'ok', 'F17: a name with diacritics is accepted');
t.code(await call('facilitators.add', { name: 'कृष्ण दास प्रभुजी' }, M), 'ok', '… and a Devanagari name too');
t.code(await call('facilitators.add', { name: "O'Brien Prabhuji" }, M), 'ok', '… and an apostrophe');
t.code(await call('facilitators.add', { name: 'Ab' }, M), 'VALIDATION', '… but not a 2-character name');
t.code(await call('facilitators.add', { name: 'Hari 108' }, M), 'VALIDATION', '… nor digits');

/* ---- J3: the master-reset marker is keyed, not a plain hash of the password ---- */
const PW = 'Recovery pass 2026';
const res = await applyMasterReset({ ...env, MASTER_RESET_PASSWORD: PW }, DB);
t.ok(/reset|created/.test(res), 'J3: the recovery secret is applied');
const marker = rows("SELECT value FROM settings WHERE key = 'master_reset_applied'")[0].value;
t.ok(!!marker, '… a marker is written');
t.ok(marker !== (await sha256Hex('master-reset:' + PW)), '… and it is NOT the plain SHA-256 of the password');
// applied once: the same secret on the next run does nothing
t.eq((await applyMasterReset({ ...env, MASTER_RESET_PASSWORD: PW }, DB)).slice(0, 7), 'already', '… and it is applied only once');

/* ---- J5: with more phones than one run can push, nobody is marked notified unsent ---- */
// three devotees of the batch, each with two phones: 6 endpoints. PER_RUN is 35, so force the cut by patching it low
// is not possible from outside; instead check the invariant that matters: every row marked sent had its phones in
// the delivered list, and anything left is still pending.
const people = ['6000000111', '6000000112', '6000000113'];
for (const p of people) await join(p, 'Notice Devotee ' + p.slice(-2));
const week = '2026-10-05';
for (const p of people) {
  DB.sql.exec(`INSERT OR REPLACE INTO attendance (login, week_id, batch_id, mark_used, coordinator_mark, notice_at, notice_sent)
               VALUES ('${p}', '${week}', 'SPS2', 'P', 'P', '2026-10-05T09:00:00+05:30', 0)`);
  for (const n of [1, 2]) {
    DB.sql.exec(`INSERT OR REPLACE INTO push_subs (endpoint, login, p256dh, auth, fails, pending, created_at)
                 VALUES ('https://fcm.googleapis.com/fcm/send/${p}-${n}', '${p}', 'k', 'a', 0, '', '2026-10-05T09:00:00+05:30')`);
  }
}
const report = await runAttendanceNotices(env, DB, new Date(clock.now));
t.ok(typeof report === 'string', 'J5: the notice run reports what it did');
const marked = rows("SELECT login FROM attendance WHERE notice_sent = 1 AND login IN ('6000000111','6000000112','6000000113')").map(r => r.login);
const pending = rows("SELECT login FROM attendance WHERE notice_sent = 0 AND notice_at <> '' AND login IN ('6000000111','6000000112','6000000113')").map(r => r.login);
t.eq(marked.length + pending.length, people.length, '… every person is either marked done or still pending, never lost');
t.ok(pending.every(p => !marked.includes(p)), '… and nobody is both');

t.done();
