// Phase 9, item 11 (the head, 9 Oct 2026): logs are kept 6 months (3 · 6 · 12 · 24 in Settings), then erased at night in
// chunks; the Sheets copy of the logs is trimmed the same way. Nothing else is touched.
import { boot, suite, fakeGoogle } from './harness.mjs';
import { runRetention, trimSheetLogs, cutoffOf, CHUNK } from '../src/retention.js';

const t = suite('phase 9: log retention');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-09T12:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
DB.sql.exec("UPDATE accounts SET is_master = 1 WHERE login = 'master'");
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

// ---- the setting: the head only, one of four lengths, logged
t.eq((await call('settings.get', {}, M)).data.logRetentionMonths, 6, '6 months by default');
t.code(await call('settings.update', { logRetentionMonths: 12 }, C), 'FORBIDDEN', 'a coordinator cannot change it');
t.code(await call('settings.update', { logRetentionMonths: 5 }, M), 'VALIDATION', 'only 3, 6, 12 or 24');
t.code(await call('settings.update', { logRetentionMonths: 12 }, M), 'ok', 'the head sets 12 months');
t.eq((await call('settings.get', {}, M)).data.logRetentionMonths, 12, 'and it is kept');
t.ok(rows("SELECT after FROM audit_log WHERE action = 'settings.update' ORDER BY id DESC LIMIT 1")[0].after.includes('log_retention_months'), 'the change is in Activity');
t.code(await call('settings.update', { logRetentionMonths: 6 }, M), 'ok', 'back to 6');

t.eq(cutoffOf(new Date(Date.parse('2026-10-09T12:00:00+05:30')), 6), '2026-04-09T12:00:00+05:30', 'the cutoff: 6 calendar months back, Indian time');

// ---- old rows go, newer stay, nothing else is touched
DB.sql.exec('DELETE FROM audit_log'); DB.sql.exec('DELETE FROM run_log');
const add = (tbl, when, n) => { for (let i = 0; i < n; i++) DB.sql.exec(tbl === 'audit_log'
  ? `INSERT INTO audit_log (at, who, role, action) VALUES ('${when}', 'x', 'MASTER', 'test.old')`
  : `INSERT INTO run_log (at, action, ms, ok) VALUES ('${when}', 'test.old', 1, 0)`); };
add('audit_log', '2026-01-05T10:00:00+05:30', CHUNK + 120);      // older than 6 months
add('audit_log', '2026-06-01T10:00:00+05:30', 30);                // inside
add('run_log', '2026-02-01T10:00:00+05:30', 40);
add('run_log', '2026-09-01T10:00:00+05:30', 5);
DB.sql.exec("UPDATE mirror_state SET last_id = (SELECT MAX(id) FROM audit_log) WHERE tbl = 'audit_log'");
DB.sql.exec("UPDATE mirror_state SET last_id = (SELECT MAX(id) FROM run_log) WHERE tbl = 'run_log'");
const before = { subs: rows('SELECT COUNT(*) AS n FROM submissions')[0].n, acc: rows('SELECT COUNT(*) AS n FROM accounts')[0].n, ann: rows('SELECT COUNT(*) AS n FROM announcements')[0].n };
const count = (tbl, cond = '1') => rows(`SELECT COUNT(*) AS n FROM ${tbl} WHERE ${cond}`)[0].n;
let r = await runRetention(DB, new Date(clock.now));
t.eq(count('audit_log', "at < '2026-04'"), 120, `one run erases at most ${CHUNK} rows a log`);
t.eq(count('run_log', "at < '2026-04'"), 0, 'the old technical-log rows go');
t.ok(/audit_log 500/.test(r) && /run_log 40/.test(r), 'the run reports what it erased');
t.eq(count('run_log', "action = 'retention'"), 1, 'and notes it in the technical log');
r = await runRetention(DB, new Date(clock.now));
t.eq(count('audit_log', "at < '2026-04'"), 0, 'the next run finishes the old Activity rows');
t.eq(count('audit_log', "at >= '2026-04'"), 30, 'rows inside the period stay');
t.eq(count('run_log', "action = 'test.old'"), 5, 'newer technical-log rows stay');
r = await runRetention(DB, new Date(clock.now));
t.eq(r, '', 'nothing more to do: nothing is written');
t.eq({ subs: count('submissions'), acc: count('accounts'), ann: count('announcements') }, before, 'sadhana, accounts and announcements untouched');

// a row not yet copied to Sheets is kept
DB.sql.exec('DELETE FROM audit_log');
add('audit_log', '2025-12-01T10:00:00+05:30', 20);
DB.sql.exec("UPDATE mirror_state SET last_id = (SELECT MIN(id) + 9 FROM audit_log) WHERE tbl = 'audit_log'");   // only 10 copied so far
await runRetention(DB, new Date(clock.now));
t.eq(count('audit_log', "at < '2026-01'"), 10, 'rows not copied to Sheets yet are never erased (10 of 20 copied: 10 go)');
DB.sql.exec("UPDATE mirror_state SET last_id = (SELECT MAX(id) FROM audit_log) WHERE tbl = 'audit_log'");
await runRetention(DB, new Date(clock.now));
t.eq(count('audit_log', "at < '2026-01'"), 0, 'once copied, they go');

// a shorter setting takes effect on the next run
add('audit_log', '2026-05-01T10:00:00+05:30', 4);
DB.sql.exec("UPDATE mirror_state SET last_id = (SELECT MAX(id) FROM audit_log) WHERE tbl = 'audit_log'");
await call('settings.update', { logRetentionMonths: 3 }, M);
await runRetention(DB, new Date(clock.now)); await runRetention(DB, new Date(clock.now));
t.eq(count('audit_log', "at < '2026-07-09'"), 0, '3 months: everything before 9 Jul goes on the next nights');

// finished notification jobs
DB.sql.exec("INSERT INTO push_jobs (ann_id, audience, title, created_at, state) VALUES (1, 'ALL', 'old', '2026-01-01T10:00:00+05:30', 'DONE'), (2, 'ALL', 'old open', '2026-01-02T10:00:00+05:30', 'OPEN'), (3, 'ALL', 'new', '2026-10-01T10:00:00+05:30', 'DONE')");
await runRetention(DB, new Date(clock.now));
t.eq(rows('SELECT title FROM push_jobs ORDER BY id').map(x => x.title), ['old open', 'new'], 'old finished notification jobs go; an open one and a new one stay');

// ---- G1 (27 Oct 2026): while the Sheets copy is PAUSED, the head's period alone decides ----
// The copy position (mirror_state.last_id) froze when the copy was paused on 13 Oct, so "never erase a row not copied
// yet" erased nothing at all and the logs grew without end. Paused, nothing will copy those rows again (a resume
// re-copies the tabs whole, mirror.js), so the age is the only rule; with the copy ON the old rule stays.
{
  const P = boot();
  const old = (tbl, when, n) => { for (let i = 0; i < n; i++) P.DB.sql.exec(tbl === 'audit_log'
    ? `INSERT INTO audit_log (at, who, role, action) VALUES ('${when}', 'x', 'MASTER', 'test.paused')`
    : `INSERT INTO run_log (at, action, ms, ok) VALUES ('${when}', 'test.paused', 1, 0)`); };
  const n = (tbl, cond) => P.rows(`SELECT COUNT(*) AS n FROM ${tbl} WHERE ${cond}`)[0].n;
  P.DB.sql.exec('DELETE FROM audit_log'); P.DB.sql.exec('DELETE FROM run_log');
  old('audit_log', '2026-01-05T10:00:00+05:30', 100); old('run_log', '2026-01-05T10:00:00+05:30', 100);
  old('audit_log', '2026-09-01T10:00:00+05:30', 7);                       // inside the period: always kept
  P.DB.sql.exec("UPDATE mirror_state SET last_id = 0 WHERE tbl IN ('audit_log', 'run_log')");   // never copied (paused)
  t.eq([n('audit_log', "action = 'test.paused' AND at < '2026-04'"), n('run_log', "action = 'test.paused'")], [100, 100], 'paused: 100 old rows of each log, none ever copied');
  // the copy ON: the old rule, unchanged — an uncopied row stays
  await runRetention(P.DB, new Date(Date.parse('2026-10-27T01:12:00+05:30')), true);
  t.eq(n('audit_log', "action = 'test.paused' AND at < '2026-04'"), 100, 'copy ON: rows not copied to Sheets yet are kept, as before');
  // the copy OFF: the night run (01:12 IST) erases by age alone — through the real schedule, so the flag is wired
  const worker = (await import('../src/index.js')).default;
  P.env.SHEETS_COPY = 'off';
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.parse('2026-10-27T01:12:00+05:30') }, P.env, { waitUntil: (p) => p });
  t.eq([n('audit_log', "action = 'test.paused' AND at < '2026-04'"), n('run_log', "action = 'test.paused'")], [0, 0], 'copy OFF: the night run erases the old rows by age alone, copied or not');
  t.eq(n('audit_log', "action = 'test.paused' AND at >= '2026-04'"), 7, '… and rows inside the period stay');
  t.ok(n('run_log', "action = 'retention'") >= 1, '… and the run notes it in the technical log');
  // a run with nothing old left writes nothing
  const before = P.rows('SELECT COUNT(*) AS n FROM run_log')[0].n;
  t.eq(await runRetention(P.DB, new Date(Date.parse('2026-10-27T01:22:00+05:30')), false), '', 'nothing older left: the next night run does nothing');
  t.eq(P.rows('SELECT COUNT(*) AS n FROM run_log')[0].n, before, '… and writes nothing');
}

// ---- the Sheets copy: the oldest rows of each log tab, from the top
const g = fakeGoogle(); env.GOOGLE_SA_KEY = g.key;
const tabs = { AuditLog: ['2026-01-01T09:00:00+05:30', '2026-02-01T09:00:00+05:30', '2026-08-01T09:00:00+05:30', '2025-01-01T09:00:00+05:30'], RunLog: ['2026-09-01T09:00:00+05:30'] };
const fake = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  const u = decodeURIComponent(String(url)), m = /\/values\/'(AuditLog|RunLog)'!A2:A(\d+)/.exec(u);
  if (m) return { ok: true, status: 200, json: async () => ({ values: tabs[m[1]].map(v => [v]) }) };
  return fake(url, opt);
};
await call('settings.update', { logRetentionMonths: 6 }, M);
r = await trimSheetLogs(env, DB, new Date(clock.now));
const del = g.writes.filter(w => w.body?.requests?.[0]?.deleteDimension).map(w => w.body.requests[0].deleteDimension.range);
t.eq(del.map(x => [x.sheetId, x.startIndex, x.endIndex]), [[5, 1, 3]], 'AuditLog: the two leading old rows are deleted (sheetId 5, rows 2–3); RunLog has none');
t.ok(/AuditLog 2/.test(r), 'reported');
t.eq(del.length, 1, 'a row further down is never touched (only the leading old rows)');
globalThis.fetch = fake;
t.done();
