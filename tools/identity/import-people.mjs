#!/usr/bin/env node
// Load the consolidated devotees into D1 (migration 0038 tables).
//
//   node import-people.mjs --local              dry run against the local DB
//   node import-people.mjs --local --apply      write to the local DB
//   node import-people.mjs --remote             dry run against production
//   node import-people.mjs --remote --apply     write to production
//
// Dry run is the default: nothing is written unless --apply is passed.
// Every row carries an import_batch so one run can be undone in a single statement:
//   DELETE FROM persons WHERE import_batch = '<batch>';
//
// Idempotent: re-running updates the same persons rather than duplicating them.
// A person already linked to an app account is never overwritten (INJECTION-PLAN D2).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');                       // prompt/
const SRC  = join(ROOT, 'aiOpsPlatform', 'identity', 'consolidated.json');
const WORKER = join(ROOT, 'sadhanaRecord', 'worker');

const args   = process.argv.slice(2);
const REMOTE = args.includes('--remote');
const APPLY  = args.includes('--apply');
const LIMIT  = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0);
if (!REMOTE && !args.includes('--local')) {
  console.error('Pass --local or --remote.'); process.exit(1);
}

const BATCH = 'import-' + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const NOW   = new Date().toISOString();
const q     = s => "'" + String(s ?? '').replace(/'/g, "''") + "'";
const ulid  = (() => { let n = 0; return p => `${p}${Date.now().toString(36)}${(n++).toString(36).padStart(4, '0')}`; })();

// ── run SQL through wrangler ────────────────────────────────────────────────
// Reads MUST go through --command: with --file, wrangler answers with a summary block
// ({ "Total queries executed": 1, "Rows read": 1, … }) instead of the rows, and that summary reads
// back as one bogus row — which is exactly how an empty table once looked like "1 account".
// Writes stay on --file: they are thousands of statements and far too long for one argument.
function sql(statements, { quiet = false, read = false } = {}) {
  const text = Array.isArray(statements) ? statements.join('\n') : statements;
  const args = ['wrangler', 'd1', 'execute', 'sadhana', REMOTE ? '--remote' : '--local'];
  let file = null;
  if (read) args.push('--command', text);
  else { file = join('/tmp', `imp-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`); writeFileSync(file, text); args.push('--file', file); }
  args.push('--json');
  const out = execFileSync('npx', args,
    { cwd: WORKER, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'] });
  const j = out.slice(out.indexOf('['));
  try { return JSON.parse(j); } catch { return null; }
}
/** A row set, never a summary block: anything carrying "Total queries executed" is not data. */
const readRows = (q) => {
  const r = sql(q, { quiet: true, read: true });
  const rs = (Array.isArray(r) && r[0] && Array.isArray(r[0].results)) ? r[0].results : [];
  return rs.filter((x) => !('Total queries executed' in x));
};
const rows = r => (Array.isArray(r) && r[0] && Array.isArray(r[0].results)) ? r[0].results : [];

// ── read the consolidated people ────────────────────────────────────────────
const data = JSON.parse(readFileSync(SRC, 'utf8'));
let people = data.clean;
if (LIMIT) people = people.slice(0, LIMIT);
console.log(`source            : ${people.length} people (${data.clean.length} in file)`);
console.log(`target            : ${REMOTE ? 'REMOTE (production)' : 'local'}`);
console.log(`mode              : ${APPLY ? 'APPLY — will write' : 'DRY RUN — no writes'}`);
console.log(`batch             : ${BATCH}\n`);

// ── what is already there ───────────────────────────────────────────────────
const existingPhones = new Map(readRows('SELECT phone, person_id FROM person_phones;').map(r => [r.phone, r.person_id]));
const accounts = readRows('SELECT login, iyf_id, name FROM accounts;');
const accByPhone = new Map(accounts.filter(a => /^\d{10}$/.test(a.login)).map(a => [a.login, a]));
const accByIyf   = new Map(accounts.filter(a => a.iyf_id).map(a => [a.iyf_id, a]));
console.log(`already in DB     : ${existingPhones.size} phones, ${accounts.length} accounts`);

// ── plan ────────────────────────────────────────────────────────────────────
const plan = { create: [], update: [], linkAccount: [], supersede: [], skip: [] };
for (const p of people) {
  const known = existingPhones.get(p.phone);
  const acc   = accByPhone.get(p.phone);
  const entry = { p, personId: known || ulid('p'), isNew: !known, account: acc || null };
  (known ? plan.update : plan.create).push(entry);
  if (acc) {
    plan.linkAccount.push(entry);
    // they hold a dashboard-series ID and we minted a new one -> supersede the old
    if (acc.iyf_id && p.iyfId && acc.iyf_id !== p.iyfId) plan.supersede.push({ ...entry, oldFid: acc.iyf_id });
  }
}
const withId = people.filter(p => p.iyfId).length;

console.log(`\n── plan ──────────────────────────────────────────`);
console.log(`  create persons        : ${plan.create.length}`);
console.log(`  update existing       : ${plan.update.length}`);
console.log(`  with a minted IYF ID  : ${withId}`);
console.log(`  deferred (no ID yet)  : ${people.length - withId}`);
console.log(`  link to app accounts  : ${plan.linkAccount.length}`);
console.log(`  supersede old IDs     : ${plan.supersede.length}`);
if (plan.supersede.length) {
  for (const s of plan.supersede.slice(0, 12))
    console.log(`      ${s.oldFid.padEnd(14)} -> ${s.p.iyfId.padEnd(16)} ${s.p.name}`);
}

// ── safety checks, before any write ─────────────────────────────────────────
const problems = [];
const seenId = new Set(), seenPh = new Set();
for (const p of people) {
  if (p.iyfId) { if (seenId.has(p.iyfId)) problems.push(`duplicate IYF ID in source: ${p.iyfId}`); seenId.add(p.iyfId); }
  if (seenPh.has(p.phone)) problems.push(`duplicate phone in source: ${p.phone}`); seenPh.add(p.phone);
  if (!/^\d{10}$/.test(p.phone)) problems.push(`bad phone: ${p.phone} (${p.name})`);
  if (p.iyfId && !/^IYFD-(19|20)\d{2}-\d{4,}$/.test(p.iyfId)) problems.push(`bad ID format: ${p.iyfId}`);
}
// Don't build an IN list of ~850 ids: that statement is far over D1's limits, it fails, and the failure
// reads back as a bogus row. Pull what is already issued and compare in memory instead.
const issued = new Set(readRows('SELECT fid FROM person_identifiers;').map(r => r.fid).filter(Boolean));
for (const fid of seenId) if (issued.has(fid)) problems.push(`ID already issued in DB: ${fid}`);

console.log(`\n── checks ────────────────────────────────────────`);
console.log(problems.length ? `  ${problems.length} PROBLEM(S):` : '  all clear');
problems.slice(0, 20).forEach(x => console.log('   ! ' + x));
if (problems.length) { console.error('\nAborting — fix the source data first.'); process.exit(2); }

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to write.');
  process.exit(0);
}

// ── write ───────────────────────────────────────────────────────────────────
const stmts = [];
const esc = (o, k) => q(o[k] || '');
for (const e of [...plan.create, ...plan.update]) {
  const { p, personId, isNew } = e;
  if (isNew) {
    stmts.push(`INSERT INTO persons (id,display_name,iyf_id,connected_since,connected_since_src,status,import_batch,created_at,updated_at)
      VALUES (${q(personId)},${q(p.name)},${q(p.iyfId || '')},${q(p.since || '')},'import',${q(p.statusFinal || 'Inactive')},${q(BATCH)},${q(NOW)},${q(NOW)});`);
  } else {
    // never clobber a person who already has data; fill blanks only
    stmts.push(`UPDATE persons SET
        display_name    = CASE WHEN display_name = '' THEN ${q(p.name)} ELSE display_name END,
        iyf_id          = CASE WHEN iyf_id = '' THEN ${q(p.iyfId || '')} ELSE iyf_id END,
        connected_since = CASE WHEN connected_since = '' THEN ${q(p.since || '')} ELSE connected_since END,
        updated_at      = ${q(NOW)}
      WHERE id = ${q(personId)};`);
  }
  // names: current + every historical spelling, all searchable
  const names = [];
  if (p.originalName) names.push([p.originalName, 'given', 0]);
  if (p.initiatedName) names.push([p.initiatedName, 'initiated', 0]);
  (p.alt || '').split('|').map(s => s.trim()).filter(Boolean)
    .forEach(n => names.push([n, 'spelling_variant', 0]));
  names.push([p.name, p.initiatedName === p.name ? 'initiated' : 'given', 1]);
  const seen = new Set();
  for (const [name, kind, cur] of names) {
    const k = name.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    stmts.push(`INSERT INTO person_names (person_id,name,kind,is_current,added_at)
      SELECT ${q(personId)},${q(name)},${q(kind)},${cur},${q(NOW)}
      WHERE NOT EXISTS (SELECT 1 FROM person_names WHERE person_id=${q(personId)} AND lower(name)=${q(k)});`);
  }
  // phones
  stmts.push(`INSERT OR IGNORE INTO person_phones (phone,person_id,is_primary,active,added_at)
    VALUES (${q(p.phone)},${q(personId)},1,1,${q(NOW)});`);
  if (p.phone2) stmts.push(`INSERT OR IGNORE INTO person_phones (phone,person_id,is_primary,active,added_at)
    VALUES (${q(p.phone2)},${q(personId)},0,1,${q(NOW)});`);
  // identifier
  if (p.iyfId) stmts.push(`INSERT OR IGNORE INTO person_identifiers (fid,person_id,series,state,issued_by,issued_at)
    VALUES (${q(p.iyfId)},${q(personId)},'IYFD','current','import',${q(NOW)});`);
  // history: facilitators, levels, provenance
  (p.facHistory || '').split('→').map(s => s.trim()).filter(Boolean).forEach((f, i) =>
    stmts.push(`INSERT INTO person_history (person_id,kind,value,seq,source,recorded_at)
      SELECT ${q(personId)},'facilitator',${q(f)},${i},'import',${q(NOW)}
      WHERE NOT EXISTS (SELECT 1 FROM person_history WHERE person_id=${q(personId)} AND kind='facilitator' AND value=${q(f)});`));
  (p.levelHistory || '').split('→').map(s => s.trim()).filter(Boolean).forEach((l, i) =>
    stmts.push(`INSERT INTO person_history (person_id,kind,value,seq,source,recorded_at)
      SELECT ${q(personId)},'level',${q(l)},${i},'import',${q(NOW)}
      WHERE NOT EXISTS (SELECT 1 FROM person_history WHERE person_id=${q(personId)} AND kind='level' AND value=${q(l)});`));
  if (p.sources) stmts.push(`INSERT INTO person_history (person_id,kind,value,seq,source,recorded_at)
    SELECT ${q(personId)},'source_row',${q(String(p.sources).slice(0, 1500))},0,'import',${q(NOW)}
    WHERE NOT EXISTS (SELECT 1 FROM person_history WHERE person_id=${q(personId)} AND kind='source_row');`);
}
// link app accounts, and supersede their old IDs
for (const e of plan.linkAccount)
  stmts.push(`INSERT OR IGNORE INTO person_links (service,account_ref,person_id,linked_at)
    VALUES ('sadhana',${q(e.account.login)},${q(e.personId)},${q(NOW)});`);
for (const s of plan.supersede) {
  stmts.push(`INSERT OR IGNORE INTO person_identifiers (fid,person_id,series,state,superseded_by,issued_by,issued_at,ended_at)
    VALUES (${q(s.oldFid)},${q(s.personId)},${q(s.oldFid.slice(0,2))},'superseded',${q(s.p.iyfId)},'dashboard',${q(NOW)},${q(NOW)});`);
  stmts.push(`UPDATE accounts SET iyf_id = ${q(s.p.iyfId)} WHERE login = ${q(s.account.login)};`);
}
// per-year sequence high-water marks, so future minting continues correctly
const maxSeq = new Map();
for (const p of people) if (p.iyfId) {
  const [, y, n] = p.iyfId.split('-'); const v = parseInt(n, 10);
  if (v > (maxSeq.get(y) || 0)) maxSeq.set(y, v);
}
for (const [y, n] of maxSeq)
  stmts.push(`INSERT INTO id_sequences (series,year,next_seq,updated_at) VALUES ('IYFD',${q(y)},${n + 1},${q(NOW)})
    ON CONFLICT(series,year) DO UPDATE SET next_seq=max(next_seq,${n + 1}), updated_at=${q(NOW)};`);

console.log(`\n── applying ${stmts.length} statements ──`);
const CH = 400;
for (let i = 0; i < stmts.length; i += CH) {
  sql(stmts.slice(i, i + CH), { quiet: true });
  process.stdout.write(`\r  ${Math.min(i + CH, stmts.length)}/${stmts.length}`);
}
console.log('\n');

// ── verify ──────────────────────────────────────────────────────────────────
const v = n => readRows(`SELECT COUNT(*) n FROM ${n};`)[0]?.n;
console.log('── after ─────────────────────────────────────────');
for (const t of ['persons', 'person_names', 'person_phones', 'person_identifiers', 'person_links', 'person_history'])
  console.log(`  ${t.padEnd(20)} ${v(t)}`);
const dupe = readRows(`SELECT iyf_id, COUNT(*) c FROM persons WHERE iyf_id<>'' GROUP BY iyf_id HAVING c>1;`);
console.log(`  duplicate IYF IDs    ${dupe.length}`);
console.log(`\nbatch ${BATCH}`);
console.log(`undo:  DELETE FROM persons WHERE import_batch = '${BATCH}';`);
