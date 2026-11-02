// ADR 0021 (27 Oct 2026): every table and column a migration adds from 0074 on follows the database standards — a
// primary key, real foreign keys with an index each, NULL (not '') for "no link", no name as a key, checked closed sets.
// Older tables keep their shape (ADR 0003); for them the last check is that the whole schema holds no broken link.
// A rule is broken only with a reason in ALLOW.
import { suite } from './harness.mjs';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const t = suite('ADR 0021: database standards for every new table and column (0074 on)');

const FROM = '0074';
// 'table.column' (or 'table' for a whole table) → why the rule does not apply
const ALLOW = {
};

const DIR = new URL('../migrations/', import.meta.url);
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const build = (list) => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');                      // as D1 runs
  for (const f of list) db.exec(fs.readFileSync(new URL(f, DIR), 'utf8'));
  return db;
};
const before = build(files.filter((f) => f < FROM)), after = build(files);
const tables = (db) => db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").all();
const cols = (db, tbl) => db.prepare('SELECT name, type, "notnull" AS nn, dflt_value AS dflt, pk FROM pragma_table_info(?)').all(tbl);
const fks = (db, tbl) => db.prepare('SELECT "from" AS col, "table" AS parent, "to" AS pcol FROM pragma_foreign_key_list(?)').all(tbl);
const indexFirst = (db, tbl) => new Set(db.prepare('SELECT il.name AS idx FROM pragma_index_list(?) il').all(tbl)
  .map((i) => db.prepare('SELECT name FROM pragma_index_info(?) WHERE seqno = 0').get(i.idx)?.name).filter(Boolean));
const allowed = (key) => Object.prototype.hasOwnProperty.call(ALLOW, key);

const old = new Map(tables(before).map((x) => [x.name, new Set(cols(before, x.name).map((c) => c.name))]));
const added = [];                                           // { tbl, col, sql, newTable }
for (const { name: tbl, sql } of tables(after)) {
  const known = old.get(tbl);
  for (const c of cols(after, tbl)) if (!known || !known.has(c.name)) added.push({ tbl, sql, newTable: !known, ...c });
}
const newTables = tables(after).filter((x) => !old.has(x.name));
t.ok(files.some((f) => f >= FROM), `migrations from ${FROM} are present (${files.filter((f) => f >= FROM).join(', ') || 'none'})`);

// rule 3 — a primary key; rule 2 — never a name
for (const { name: tbl } of newTables) {
  if (allowed(tbl)) continue;
  const pk = cols(after, tbl).filter((c) => c.pk > 0).map((c) => c.name);
  t.ok(pk.length > 0, `${tbl}: has a primary key`);
  // a name may be PART of a key (one row per spelling of one facilitator), never the whole of it
  t.ok(!pk.length || !pk.every((c) => /name/i.test(c)), `${tbl}: its key is not a name alone (${pk.join(', ')})`);
}

// rules 4 and 5 — a link column is a real foreign key, defaults to NULL, and leads an index
const LINK = /(^|_)(id|login)$/i;
const uniqueAlone = (tbl, col) => after.prepare('SELECT il.name AS idx FROM pragma_index_list(?) il WHERE il."unique" = 1').all(tbl)
  .some((i) => { const k = after.prepare('SELECT name FROM pragma_index_info(?)').all(i.idx); return k.length === 1 && k[0].name === col; });
for (const c of added) {
  const key = `${c.tbl}.${c.name}`;
  if (allowed(key) || c.pk > 0) continue;
  // a row's own permanent id (rule 2): unique, never empty
  if (/^id$/i.test(c.name)) { t.ok(uniqueAlone(c.tbl, c.name), `${key}: the row's own id is UNIQUE`); continue; }
  if (!LINK.test(c.name)) continue;
  const fk = fks(after, c.tbl).find((f) => f.col === c.name);
  t.ok(!!fk, `${key}: a real foreign key (REFERENCES …)`);
  if (!fk) continue;
  const parentKey = fk.pcol || cols(after, fk.parent).find((p) => p.pk === 1)?.name;
  const unique = cols(after, fk.parent).some((p) => p.name === parentKey && p.pk === 1 && cols(after, fk.parent).filter((q) => q.pk > 0).length === 1)
    || uniqueAlone(fk.parent, parentKey);
  t.ok(unique, `${key}: its parent ${fk.parent}.${parentKey} is a primary key or UNIQUE`);
  t.ok(c.dflt === null || /^null$/i.test(c.dflt), `${key}: "no link" is NULL, not ${c.dflt}`);
  t.ok(indexFirst(after, c.tbl).has(c.name) || cols(after, c.tbl).find((x) => x.name === c.name)?.pk === 1, `${key}: leads an index`);
}

// rule 6 — a closed set is checked
const CLOSED = /(^|_)(status|state|kind|role|type)$/i;
for (const c of added) {
  const key = `${c.tbl}.${c.name}`;
  if (allowed(key) || !CLOSED.test(c.name)) continue;
  t.ok(new RegExp(`CHECK\\s*\\([^)]*"?${c.name}"?\\s+IN\\s*\\(`, 'i').test(c.sql || ''), `${key}: CHECK (${c.name} IN (…))`);
}

// rule 12 — no broken link anywhere in the schema the migrations build (seed rows included)
const broken = after.prepare('PRAGMA foreign_key_check').all();
t.ok(broken.length === 0, `no row points to a missing parent (${broken.slice(0, 3).map((b) => b.table + '→' + b.parent).join(', ') || 'none'})`);

// every allow-list entry names something that exists and gives a reason
for (const [k, why] of Object.entries(ALLOW)) {
  const [tbl, col] = k.split('.');
  t.ok(String(why).trim().length >= 10 && (col ? added.some((c) => c.tbl === tbl && c.name === col) : newTables.some((x) => x.name === tbl)), `ALLOW ${k}: exists and has a reason`);
}
t.done();
