// ADR 0021 rule 12: the old tables cannot carry foreign keys (ADR 0003), so their links are CHECKED instead.
// For every column that links to a parent (login → accounts, batch_id → batches, person_id → persons, phase_id → phases,
// book_id → books), counts the rows whose value is set but has no parent row. The links are read from the schema, so a
// new table is covered without editing this file. Read only: on live, one call for the table list, then the checks in
// groups of GROUP (D1 caps the terms of one compound SELECT well below SQLite's 500).
//
//   node tools/ops/integrity.mjs            the schema the migrations build (in memory; proves the queries run)
//   node tools/ops/integrity.mjs --remote   the live database, read only (wrangler d1 execute … --command)
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const WORKER = new URL('../../worker/', import.meta.url);
// a column may have more than one possible parent: since 0068 a trainee's card rows hold their TRAINING batch in phase_id
const PARENT = { login: [['accounts', 'login']], batch_id: [['batches', 'batch_id']], person_id: [['persons', 'id']],
  phase_id: [['phases', 'phase_id'], ['batches', 'batch_id']], book_id: [['books', 'book_id']] };
// rows that keep a link to a parent that may be gone ON PURPOSE: a record of what happened, not a live reference
const HISTORY = new Set(['audit_log', 'run_log', 'activity_events', 'batch_requests', 'batch_closings', 'head_requests']);

const schema = new DatabaseSync(':memory:');
schema.exec('PRAGMA foreign_keys = OFF');          // only the shape is needed here; a draft migration may be mid-edit
const dir = new URL('migrations/', WORKER);
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) schema.exec(fs.readFileSync(new URL(f, dir), 'utf8'));
const tables = schema.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").all().map((r) => r.name);

const checks = [];
for (const tbl of tables) for (const { name: col } of schema.prepare('SELECT name FROM pragma_table_info(?)').all(tbl)) {
  const p = PARENT[col];
  if (!p || p.some(([t]) => t === tbl)) continue;
  const none = p.map(([t, k]) => `NOT EXISTS (SELECT 1 FROM "${t}" p WHERE p."${k}" = c."${col}")`).join(' AND ');
  checks.push({ tbl, col, parents: p.map((x) => x.join('.')), parent: p.map((x) => x.join('.')).join(' or '), history: HISTORY.has(tbl),
    sql: `SELECT '${tbl}' AS tbl, '${col}' AS col, COUNT(*) AS n FROM "${tbl}" c WHERE c."${col}" IS NOT NULL AND c."${col}" <> '' AND ${none}` });
}
const remote = process.argv.includes('--remote'), GROUP = 5;
const run = (sql) => (remote
  ? JSON.parse(execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'sadhana', '--remote', '--json', '--command', sql], { cwd: WORKER, encoding: 'utf8', maxBuffer: 1 << 24 }))[0].results
  : schema.prepare(sql).all());
// only the columns (and parent keys) this database has: live may not have the newest migrations yet
const have = new Set(run("SELECT m.name || '.' || p.name AS k FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE '_cf_%'").map((r) => r.k));
const due = checks.filter((c) => have.has(`${c.tbl}.${c.col}`) && c.parents.every((x) => have.has(x)));
const rows = [];
for (let i = 0; i < due.length; i += GROUP) rows.push(...run(due.slice(i, i + GROUP).map((c) => c.sql).join('\nUNION ALL\n')));

const by = new Map(rows.map((r) => [`${r.tbl}.${r.col}`, r.n]));
let live = 0, hist = 0;
for (const c of due) {
  const n = by.get(`${c.tbl}.${c.col}`) || 0;
  if (!n) continue;
  if (c.history) hist += n; else live += n;
  console.log(`${c.history ? 'history' : 'ORPHAN '}  ${String(n).padStart(6)}  ${c.tbl}.${c.col} → ${c.parent}`);
}
console.log(`\n${due.length} links checked${due.length < checks.length ? ` (${checks.length - due.length} not in this database yet)` : ''} · ${live} orphan rows in live references · ${hist} in history (kept on purpose)`);
process.exit(live ? 1 : 0);
