// The free plan allows 5,000,000 D1 rows READ a day. A query that scans a growing table once a minute
// spends that on its own, and then every action in the app fails.
//
// WHAT HAPPENED (14 October 2026, twice in one day). A coordinator tapped Export and got "Please try
// again". It was not an export fault: the database had stopped answering. Cloudflare's own figures named
// the cause exactly:
//
//     SELECT MAX(id) AS hi, MIN(id) AS lo FROM mirror_log
//     8,588 rows read per run x 598 runs = 5,136,070 rows in 24 hours — 102.7% of the daily allowance,
//     efficiency 0.0001 (8,588 rows read to return two numbers)
//
// SQLite turns MAX(id) alone, or MIN(id) alone, into an index lookup. Asking for BOTH in one row defeats
// that and becomes a full scan. As two scalar subqueries it is two index lookups instead.
//
// The audit's existing "no new scan of a growing table" check did not catch it, because the test database
// holds a handful of rows: the SHAPE was approved, and the COST at 8,588 rows was what mattered. These
// assertions are about plans, measured against a table the size of the real one.
import { suite } from './harness.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const t = suite('read budget: no scheduled query may scan a growing table');
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/* A log the size of the live one on the day it broke. */
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE mirror_log (id INTEGER PRIMARY KEY, tbl TEXT, k1 TEXT, k2 TEXT)');
const ins = db.prepare('INSERT INTO mirror_log (tbl, k1, k2) VALUES (?, ?, ?)');
for (let i = 0; i < 8600; i++) ins.run('accounts', 'k' + i, '');
const plan = (sql) => db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((r) => r.detail).join(' | ');

/* ───────── the exact query that broke it ───────── */

t.ok(/SCAN mirror_log/.test(plan('SELECT MAX(id) AS hi, MIN(id) AS lo FROM mirror_log')),
     'the old form really does scan — this is the query that spent the whole daily allowance');
const fixed = plan('SELECT (SELECT MAX(id) FROM mirror_log) AS hi, (SELECT MIN(id) FROM mirror_log) AS lo');
t.ok(!/SCAN mirror_log/.test(fixed), `and the form in use now does not: ${fixed}`);
t.ok((fixed.match(/SEARCH mirror_log/g) || []).length === 2, 'it is two index lookups, so the cost does not grow with the log');

/* ───────── and the source really uses the cheap form ───────── */

const mirror = readFileSync(join(SRC, 'mirror.js'), 'utf8');
t.ok(!/MAX\(id\) AS hi, MIN\(id\) AS lo FROM mirror_log/.test(mirror),
     'mirror.js no longer asks for MAX and MIN in one row');
t.ok(/\(SELECT MAX\(id\) FROM mirror_log\)/.test(mirror) && /\(SELECT MIN\(id\) FROM mirror_log\)/.test(mirror),
     'it asks for each separately, which is what keeps them index lookups');

/* ───────── the status line that runs beside it ───────── */

const index = readFileSync(join(SRC, 'index.js'), 'utf8');
// while the Sheets copy is paused the backlog only drifts upward; counting it every minute is the same
// mistake one layer up, so it is written once an hour
const paused = /if \(!sheetsCopy\) \{[\s\S]*?\n      \} else if/.exec(index);
t.ok(!!paused, 'the paused branch was found');
t.ok(/if \(minute === 1\)/.test(paused[0]), 'the paused status is written once an hour, not once a minute (minute 1: minutes 0 and 30 take the registry branch and never reach here)');
// since C1 (migration 0075, 27 Oct 2026) nothing is queued while paused, so the paused status counts nothing at all;
// a count, if one ever comes back, must be capped
t.ok([...paused[0].matchAll(/mirrorBacklog\(db\b[^)]*\)/g)].every((m) => /mirrorBacklog\(db, \d+\)/.test(m[0])),
     '… and the hourly status counts nothing (or a capped count): no query\'s cost may depend on how large another table has grown');

// the running branch counts every minute, so its count must be bounded
const running = index.slice(index.indexOf('} else if (deadline ==='));
t.ok(/mirrorBacklog\(db, \d+\)/.test(running), 'the running branch caps its count, so a large log costs the same as a small one');

/* ───────── the cap works ───────── */

const { mirrorBacklog } = await import('../src/mirror.js');
const { boot } = await import('./harness.mjs');
const { DB, rows } = boot();
// 1,200 queued changes: more than any cap used below, so a cap that did not work would be obvious
DB.sql.exec("UPDATE mirror_state SET last_id = 0 WHERE tbl = 'mirror_log'");
for (let i = 0; i < 1200; i++) DB.sql.exec(`INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', 'rb${i}', '')`);
const real = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
t.ok(real >= 1200, `${real} entries queued in the test log`);
t.eq(await mirrorBacklog(DB, 500), 500, 'a capped count stops at the cap however long the log is');
t.eq(await mirrorBacklog(DB, 10), 10, '… at any cap');
t.eq(await mirrorBacklog(DB), real, 'and without a cap it still gives the true number, for the hourly status');

/* ───────── the rule, stated as a test: NOTHING on the schedule may cost more as a table grows ───────── */

const sched = index.slice(index.indexOf('async scheduled('), index.indexOf('async scheduled(') + 9000);
const uncapped = [...sched.matchAll(/mirrorBacklog\(db\)/g)];
t.eq(uncapped.length, 0,
     'every mirrorBacklog() call in the scheduled run passes a cap' +
     (uncapped.length ? ' — an uncapped one grows without limit and is how the app went down' : ''));

t.done();
