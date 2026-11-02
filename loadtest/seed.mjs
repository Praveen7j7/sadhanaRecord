// Phase 6 load test: builds the test people for the SEPARATE sadhana-load database (never the live one).
//   node loadtest/seed.mjs <pepper>   → loadtest/out/seed.sql (accounts, memberships, profiles, sessions) and
//                                        loadtest/out/people.json (logins + session tokens for the load script; not in git)
// 2,000 devotees in the six batches, one coordinator per batch and a master, all with a 30-day session already open
// (at the 9 PM peak people are signed in); the same test password for everyone.
import { writeFileSync, mkdirSync } from 'node:fs';
import { hashPassword, newToken, tokenHash } from '../worker/src/crypto.js';

const pepper = process.argv[2];
if (!pepper) throw new Error('usage: node loadtest/seed.mjs <pepper>');
const BATCHES = [['SPS', 600], ['SPS2', 300], ['SPSO', 200], ['DPS', 400], ['BSS', 300], ['BVS', 200]];
const FACS = ['Abhaya Vishnu Prabhuji', 'Aditya Prabhuji', 'Deepak Prabhuji', 'Neeraj Prabhuji', 'Rohit Prabhuji', 'Suraj Prabhuji'];
const now = '2026-10-03T10:00:00+05:30', exp = '2026-12-30T10:00:00+05:30';
const h = await hashPassword('Load test pass 2026', 10000, pepper);
const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const acc = [], mem = [], prof = [], ses = [], people = { devotees: [], coordinators: [], master: null };
let n = 0;
for (const [b, count] of BATCHES) {
  for (let i = 0; i < count; i++) {
    const login = String(6000000900 + ++n), name = `Load Devotee ${n}`, cd = n % 5 === 0 ? 'SAT' : 'SUN';
    acc.push(`(${esc(login)},'DEVOTEE','ACTIVE',${esc(name)},${esc(login)},${esc(b)},${esc(h.pw_hash)},${esc(h.pw_salt)},10000,${esc(now)},${esc(now)},'seed',${esc(FACS[n % FACS.length])},'load${n}@example.com',${esc(cd)})`);
    mem.push(`(${esc(login)},${esc(b)},'ACTIVE','2026-09-07','2026-09-07','seed',${esc(now)},'approved',${esc(FACS[n % FACS.length])},${esc(cd)})`);
    prof.push(`(${esc(login)},${esc(name)},'2000-0${1 + (n % 9)}-1${n % 9}','O+','Some One','Friend','6000000800',${esc(now)},'seed')`);
    const t = newToken(); ses.push(`(${esc(await tokenHash(t))},${esc(login)},'DEVOTEE',${esc(now)},${esc(now)},${esc(exp)},'load')`);
    people.devotees.push({ login, batch: b, token: t });
  }
}
for (const [b] of BATCHES) {
  const login = 'load-' + b.toLowerCase();
  acc.push(`(${esc(login)},'COORDINATOR','ACTIVE',${esc('Load Coordinator ' + b)},'','',${esc(h.pw_hash)},${esc(h.pw_salt)},10000,${esc(now)},${esc(now)},'seed','','','')`);
  const t = newToken(); ses.push(`(${esc(await tokenHash(t))},${esc(login)},'COORDINATOR',${esc(now)},${esc(now)},${esc(exp)},'load')`);
  people.coordinators.push({ login, batch: b, token: t });
}
{
  acc.push(`('load-master','MASTER','ACTIVE','Load Master','','',${esc(h.pw_hash)},${esc(h.pw_salt)},10000,${esc(now)},${esc(now)},'seed','','','')`);
  const t = newToken(); ses.push(`(${esc(await tokenHash(t))},'load-master','MASTER',${esc(now)},${esc(now)},${esc(exp)},'load')`);
  people.master = { login: 'load-master', token: t };
}
const chunks = (rows, head) => { const out = []; for (let i = 0; i < rows.length; i += 100) out.push(head + rows.slice(i, i + 100).join(',\n') + ';'); return out.join('\n'); };
const sql = [
  chunks(acc, 'INSERT INTO accounts (login, role, status, name, phone, requested_batch, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by, requested_facilitator, email, requested_class_day) VALUES\n'),
  chunks(mem, 'INSERT INTO memberships (login, batch_id, state, from_week, level_entry_date, set_by, set_at, reason, facilitator, class_day) VALUES\n'),
  chunks(prof, 'INSERT INTO profiles (login, name, dob, blood_group, emergency_name, emergency_relation, emergency_phone, updated_at, updated_by) VALUES\n'),
  chunks(ses, 'INSERT INTO sessions (token_hash, login, role, created_at, last_used_at, expires_at, device) VALUES\n'),
  ...BATCHES.map(([b]) => `UPDATE batches SET coordinator_logins = 'load-${b.toLowerCase()}' WHERE batch_id = '${b}';`),
  "UPDATE accounts SET is_master = 1 WHERE login = 'load-master';",
  "INSERT INTO settings (key, value, changed_by, changed_at) VALUES ('tracking_from', '2026-09-07', 'seed', '2026-10-03') ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
].join('\n');
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/seed.sql', import.meta.url), sql);
writeFileSync(new URL('./out/people.json', import.meta.url), JSON.stringify(people));
console.log(`seed: ${acc.length} accounts, ${mem.length} memberships, ${ses.length} sessions · ${(sql.length / 1024).toFixed(0)} KB`);
