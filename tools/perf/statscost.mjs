// What the head's and coordinators' screens cost: statements and ROWS READ per action, on a seeded database.
// Rows read is what the free plan charges for and what grows with the batch; the wall time is Node's synchronous
// SQLite, useful only as a relative signal, never as a Worker CPU figure (use loadtest/ for that).
//
//   node tools/perf/statscost.mjs 5000
//
// Baseline on 13 Oct 2026 after the phase 2 change (audit P-1/P-2), 6 active batches, 12 weeks of data:
//   devotees   stats.all            stats.batch
//   2,000      15 stmts / 148 rows  19 stmts / 1,584 rows
//   5,000      15 stmts / 148 rows  19 stmts / 3,584 rows
// Before it, stats.all was 85 statements and 7,318 rows at 2,000 devotees, 16,318 at 5,000.
// stats.batch and devotees.list still grow with the batch BY DESIGN: both screens list every devotee.
// Not a Worker CPU number — it counts STATEMENTS and ROWS READ, which is what the free-plan budget is spent on,
// and wall time in Node as a relative signal. Run: node measure-stats.mjs [devotees]
import { boot } from '../../worker/tests/harness.mjs';

const N = Number(process.argv[2] || 2000);
const { env, DB, call, clock, addAccount, rows } = boot();

// ---- count every statement and every row the DB returns (the shim exposes prepare() directly) ----
let stmts = 0, rowsRead = 0;
const realPrepare = DB.prepare.bind(DB);
const wrap = (st) => ({
  // keep .s and .args: harness batch() reads .s to tell SELECTs from writes
  s: st.s, args: st.args,
  bind: (...a) => wrap(st.bind(...a)),
  first: async () => { stmts++; const r = await st.first(); if (r) rowsRead++; return r; },
  all: async () => { stmts++; const r = await st.all(); rowsRead += (r.results || []).length; return r; },
  run: async () => { stmts++; return st.run(); },
});
DB.prepare = (sql) => wrap(realPrepare(sql));
const reset = () => { stmts = 0; rowsRead = 0; };

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

// ---- seed directly in SQL (fast): N devotees spread over the active batches, 12 weeks of submissions ----
const batches = rows("SELECT batch_id FROM batches WHERE active = 1 ORDER BY rowid").map(r => r.batch_id);
// Weeks are named by their MONDAY in IST (util.mondayOf). The harness clock is Mon 2026-10-05 10:00 +05:30, and
// focusWeek() picks the PREVIOUS week until the deadline passes, so the newest week with data must be 2026-09-28.
const WEEKS = Array.from({ length: 12 }, (_, i) => {
  const monday = Date.parse('2026-09-28T00:00:00+05:30') - (11 - i) * 7 * 86400000;
  return new Date(monday + 5.5 * 3600e3).toISOString().slice(0, 10);
});
console.log(`seeding ${N} devotees over ${batches.length} batches × ${WEEKS.length} weeks …`);
// Build the INSERTs from the schema, so NOT NULL columns we do not care about get a typed zero value.
const colsOf = (t) => DB.sql.prepare(`PRAGMA table_info(${t})`).all();
const fill = (t, given) => {
  const cols = colsOf(t).filter(c => c.name !== 'id' && (c.name in given || (c.notnull && c.dflt_value === null)));
  const vals = cols.map(c => (c.name in given ? given[c.name] : (/INT|REAL|NUM/i.test(c.type) ? 0 : '')));
  return { sql: `INSERT INTO ${t} (${cols.map(c => '"' + c.name + '"').join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals };
};
const put = (t, given) => { const { sql, vals } = fill(t, given); DB.sql.prepare(sql).run(...vals); };

DB.sql.exec('BEGIN');
for (let i = 0; i < N; i++) {
  const login = String(6000000000 + i), b = batches[i % batches.length], name = 'Devotee ' + i;
  put('accounts', { login, role: 'DEVOTEE', status: 'ACTIVE', name, pw_hash: 'h', pw_salt: 's', pw_iterations: 1000, must_change_pw: 0, requested_batch: b });
  put('memberships', { login, batch_id: b, from_week: WEEKS[0], to_week: '', state: 'ACTIVE' });
  for (const w of WEEKS) {
    if (i % 7 === 0) { put('missed_weeks', { login, week_id: w, batch_id: b, days_filled: 0, at: '2026-10-05T10:00:00+05:30' }); continue; }
    put('submissions', { submission_id: login + '-' + w, login, week_id: w, batch_id: b, name, submitted_at: '2026-10-05T10:00:00+05:30',
      submitted_by: login, week_json: '{}', overall: 70, days_filled: 7, rules_version: 'r1' });
  }
  if (i % 3 === 0) put('drafts', { login, week_id: WEEKS[11], batch_id: b, d1: '{"v":1}', created_at: '2026-10-05T10:00:00+05:30', updated_at: '2026-10-05T10:00:00+05:30', updated_by: login });
}
DB.sql.exec('COMMIT');
console.log('seeded.\n');

const t = async (label, fn) => {
  reset();
  const t0 = performance.now();
  const r = await fn();
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(26)} ${ms.toFixed(0).padStart(6)} ms  ${String(stmts).padStart(5)} statements  ${String(rowsRead).padStart(7)} rows`);
  if (r && !r.ok) console.log('   !! ' + JSON.stringify(r.error));
  return r;
};

console.log(`--- ${N} devotees, ${batches.length} active batches ---`);
await t('stats.all (8 weeks)', () => call('stats.all', {}, M));
await t('stats.all (26 weeks)', () => call('stats.all', { weeks: 26 }, M));
await t('stats.batch (12 weeks)', () => call('stats.batch', { batchId: batches[0], weeks: 12 }, M));
await t('devotees.list', () => call('devotees.list', { batchId: batches[0] }, M));
await t('members.list (page 1)', () => call('members.list', { batchId: batches[0], limit: 25 }, M));
await t('members.list (search)', () => call('members.list', { q: 'Devotee 1', limit: 25 }, M));
await t('home.get-ish: auth.me', () => call('auth.me', {}, M));
