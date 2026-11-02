// Write audit (phase 6): every INSERT / UPDATE / DELETE the suites run, classified. "Keyed" = touches the rows it
// names through the primary key or an index; "MASS" = reaches rows by scanning a table, or has no WHERE at all
// (a whole-table rewrite). Every MASS write on a table that grows must be justified or made incremental.
//   SQL_LOG=… npm test && node tests/write-audit.mjs <log>
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { report } from './audit-allow.mjs';
const db = new DatabaseSync(':memory:');
for (const f of fs.readdirSync(new URL('../migrations/', import.meta.url)).sort()) db.exec(fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
const seen = [...new Set(fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)))];
const rows = [];
for (const sql of seen) {
  const m = /^\s*(INSERT(?: OR \w+)? INTO|UPDATE|DELETE FROM)\s+"?(\w+)"?/i.exec(sql);
  if (!m) continue;
  const tbl = m[2], kind = m[1].split(' ')[0].toUpperCase();
  let plan = [];
  try { plan = db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...Array((sql.match(/\?/g) || []).length).fill(null)).map(p => p.detail); } catch { /* */ }
  const noWhere = kind !== 'INSERT' && !/\bWHERE\b/i.test(sql);
  const scans = plan.filter(d => /^SCAN \w+$/.test(d) || /^SCAN \w+ (?!USING)/.test(d));
  const mass = noWhere || scans.length > 0 || /INSERT[^;]*\bSELECT\b/i.test(sql);
  rows.push({ mass, tbl, kind, why: noWhere ? 'no WHERE' : scans.join(' + ') || (/SELECT/i.test(sql) ? 'INSERT…SELECT' : ''), sql: sql.replace(/\s+/g, ' ').slice(0, 140), full: sql });
}
rows.sort((a, b) => b.mass - a.mass || a.tbl.localeCompare(b.tbl));
// Phase 9 (item 19): only a MASS write not on the allow-list fails the audit
console.log(`${rows.length} write statements: ${rows.filter(r => !r.mass).length} keyed, ${rows.filter(r => r.mass).length} mass`);
report(rows.filter(r => r.mass).map(r => ({ sql: r.full, line: `MASS  ${r.tbl.padEnd(16)} ${r.why.padEnd(26)} ${r.sql}` })), 'mass writes');
