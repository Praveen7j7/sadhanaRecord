// Live, READ-ONLY sync audit: for every table copied to Google Sheets, the D1 row count vs the sheet's non-empty rows,
// the first data row compared cell by cell, and the D1 tables that are not copied anywhere. Append-only tables (submissions,
// audit_log, run_log) are OK when every D1 row is in the sheet: the sheet may also hold older history written before D1
// (for example the Apps Script server's RunLog of 2 Oct 2026), and D1 never deletes these rows.
//   cd sadhanaRecord && node tools/sheets/sync-audit.mjs
import { execSync } from 'node:child_process';
import * as g from '../../setup/sa.mjs';
import { SCHEMA } from '../../setup/schema.mjs';
import FILES from '../../setup/files.json' with { type: 'json' };
import { MIRRORS, toSheetRow, sheetRow } from '../../worker/src/mirror.js';

const d1 = (sql) => {
  try { return JSON.parse(execSync(`npx wrangler d1 execute sadhana --remote --json --command ${JSON.stringify(sql)}`, { cwd: new URL('../../worker/', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'ignore'] }).toString()); }
  catch (e) { throw new Error('D1: ' + (JSON.parse(e.stdout.toString()).error?.text || e.message).slice(0, 300)); }
};
const tables = d1("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")[0].results.map(r => r.name);
const counts = d1(tables.map(t => `SELECT '${t}' AS t, COUNT(*) AS n FROM "${t}"`).join('; ')).map(r => r.results[0]);
const n = Object.fromEntries(counts.map(r => [r.t, r.n]));
const out = [];
for (const [tbl, [file, tab, mode, order]] of Object.entries(MIRRORS)) {
  const v = (await g.get(FILES[file], `'${tab}'!A2:ZZ`)).values || [];
  const filled = v.filter(r => r.some(c => c !== '' && c != null)).length;
  let sample = '';
  if (n[tbl]) {
    const cols = SCHEMA[file].tabs[tab];
    const first = d1(`SELECT * FROM "${tbl}" LIMIT 1`)[0].results[0];
    const want = (sheetRow ? sheetRow(tbl, cols, first) : toSheetRow(cols, first)).map(x => String(x));
    const keyIdx = 0, row = v.find(r => String(r[keyIdx] ?? '') === want[keyIdx]);
    sample = !row ? 'first DB row not found in sheet' : want.every((x, i) => x === '' || String(row[i] ?? '') === x || Number(row[i]) === Number(x)) ? 'sample row matches' : 'sample row DIFFERS';
  }
  let status = n[tbl] === filled ? 'OK' : 'MISMATCH';
  if (mode === 'append' && n[tbl] && n[tbl] !== filled) {
    // every D1 row, as its sheet row, must be in the sheet (matched on all its cells, numbers as numbers)
    const cols = SCHEMA[file].tabs[tab], key = (r) => r.map((x) => (x === '' || x == null ? '' : isNaN(Number(x)) ? String(x) : String(Number(x)))).join('\u0001');
    const have = new Set(v.map((r) => key(cols.map((_, i) => r[i] ?? ''))));
    const rows = d1(`SELECT * FROM "${tbl}" ${order || ''}`)[0].results;
    const missing = rows.filter((r) => !have.has(key((sheetRow ? sheetRow(tbl, cols, r) : toSheetRow(cols, r)).map((x) => String(x))))).length;
    status = missing ? `MISSING ${missing} D1 row(s) in the sheet` : filled > n[tbl] ? `OK (all D1 rows present; the sheet also holds ${filled - n[tbl]} older row(s))` : 'MISMATCH';
  }
  out.push([tbl, file + ' › ' + tab, n[tbl] ?? '?', filled, status, sample]);
}
console.log('table'.padEnd(18), 'sheet'.padEnd(32), 'D1'.padStart(5), 'sheet'.padStart(6), ' ', 'status');
for (const r of out) console.log(String(r[0]).padEnd(18), String(r[1]).padEnd(32), String(r[2]).padStart(5), String(r[3]).padStart(6), ' ', r[4], '·', r[5]);
// not copied by design: internal state, binaries, phone addresses; post_likes only as counts on Access › Announcements (nightly)
const internal = /^(mirror_|view_|replies|counters|sessions|photos|push_|announcement_images|reminder_progress|registry|d1_|group_leaders|post_likes)/;
console.log('\nNot copied to any sheet:', tables.filter(t => !MIRRORS[t]).map(t => `${t} (${n[t]})${internal.test(t) ? '' : ' ← check'}`).join(', '));
