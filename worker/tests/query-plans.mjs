// Query-plan audit: every SQL statement the suites run (SQL_LOG=… npm test), checked with EXPLAIN QUERY PLAN against
// the real schema. Flags a full SCAN of a table that grows with devotees or weeks (a read bomb at 5,000 devotees).
//   SQL_LOG=/tmp/sql.log npm test && node tests/query-plans.mjs /tmp/sql.log
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { report } from './audit-allow.mjs';
/* Tables whose row count grows with use. A full SCAN of one of these is a read bomb at scale.
 *
 * DERIVED FROM THE SCHEMA, not written by hand (14 Oct 2026). The hand-written list left out `mirror_log`,
 * and that is the table that took the live app down twice in one day: `SELECT MAX(id), MIN(id) FROM
 * mirror_log` scanned 8,588 rows once a minute, 5,136,070 rows in 24 hours, 102.7% of D1's free daily
 * limit. The audit reported "0 new scans" throughout, because the one table that mattered was not on its
 * list. A list of what to check is only as good as whoever remembered to add to it; the schema is not.
 *
 * So: every table counts EXCEPT the ones named below as fixed reference data, where a scan costs the same
 * for ever. A new table is therefore guarded the day it is created, and a new FIXED entry is a deliberate
 * claim that the table does not grow. */
const FIXED = new Set(['batches', 'books', 'book_files', 'book_chapters', 'card_ranges', 'chetna_options', 'lectures', 'seva_rules',
  'facilitators', 'settings', 'id_sequences', 'reminder_progress', 'group_leaders',
  // one row per table / per view: bounded by the schema, not by use
  'mirror_state', 'view_state', 'view_keys', 'view_dirty', 'mirror_free', 'd1_migrations']);
const db = new DatabaseSync(':memory:');
for (const f of fs.readdirSync(new URL('../migrations/', import.meta.url)).sort()) db.exec(fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
const GROWING = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all().map(r => r.name).filter(t => !FIXED.has(t));
const seen = new Set(fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
const bad = [];
for (const sql of seen) {
  if (!/^\s*(SELECT|WITH|UPDATE|DELETE|INSERT)/i.test(sql)) continue;
  let plan;
  try { plan = db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...Array(100).fill(null).slice(0, (sql.match(/\?/g) || []).length)); } catch (e) { continue; }
  const scans = plan.map(p => p.detail).filter(d => /^SCAN (\w+)/.test(d) && GROWING.includes(/^SCAN (\w+)/.exec(d)[1]) && !/USING (COVERING )?INDEX/.test(d));
  if (scans.length) bad.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 170), full: sql, scans });
}
// Phase 9 (item 19): only a statement not on the allow-list fails the audit
console.log(`${seen.size} distinct statements, ${bad.length} scan a growing table`);
report(bad.map(b => ({ sql: b.full, line: `${b.scans.join(' + ').padEnd(28)} ${b.sql}` })), 'scans of growing tables');
