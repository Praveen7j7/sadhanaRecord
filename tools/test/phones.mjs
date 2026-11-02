#!/usr/bin/env node
// Roadmap 6.7 / audit T F-15: every phone number in a test, a mock or a tool must be one that cannot
// belong to a real person.
//
// WHY THIS EXISTS. An Indian mobile number is ten digits starting 6-9. A number like 6000000342 is a
// perfectly dialable Delhi number: somebody owns it. The suites used dozens of them, and a fixture that
// leaks into a notification, an export, a screenshot or a WhatsApp link reaches that stranger. The rule
// (the head, 12 Oct 2026) is that fixtures live in 60000000xx / 60000001xx, which no operator issues.
//
// This script is the sweep AND the guard:
//   node tools/test/phones.mjs            → report every number outside the safe range, exit 1 if any
//   node tools/test/phones.mjs --fix      → rewrite them to the safe range, keeping each distinct number
//                                           distinct, and write the mapping to tools/test/phones.map.json
//
// Numbers are literal strings everywhere (checked: no slicing, arithmetic or template building of a
// phone), so a one-for-one textual replacement cannot change what any assertion means.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP_FILE = join(ROOT, 'tools', 'test', 'phones.map.json');

/** Where fixtures may appear. Deliberately NOT worker/src or frontend/src components: a phone in real
 *  code is a bug of a different kind, and this script must not rewrite product code. */
const SEARCH = [
  'worker/tests', 'frontend/tests', 'tools/browser', 'tools/perf', 'tools/video',
  'frontend/src/lib/mock.js', 'frontend/src/lib/mockstaff.js'
];

/** The phones a fixture may use: 6000000000-6000000999.
 *
 *  The standing rule names 60000000xx (mocks; 6000000001 is the mock login) and 60000001xx (worker tests),
 *  which is 200 numbers. One suite needs 400 distinct phones for a bulk refresh, so the check accepts the
 *  whole 6000000xxx thousand: the same unallocated 600000 prefix, still valid for normPhone's
 *  /^[6-9]\d{9}$/, and no part of it is issued to a subscriber. Hand-written fixtures should still take the
 *  next free number in the two documented hundreds — slot() below only ever allots from those. */
const SAFE = /^6000000\d\d\d$/;
/* Two shapes, because the first version missed the second and a browser check quietly broke:
   · a number standing alone inside quotes — '6000000310'
   · a number EMBEDDED in a quoted string — '#/requests?open=su:6000000310', 'tel:6000000310'
   Both are rewritten. The boundaries stop a 10-digit run inside a longer number from matching. */
const PHONE = /(['"`])([6-9]\d{9})\1/g;
const PHONE_IN_TEXT = /(?<![\d])([6-9]\d{9})(?![\d])/g;

const files = [];
const walk = (p) => {
  if (!existsSync(p)) return;
  const st = statSync(p);
  if (st.isFile()) { if (/\.(mjs|js|json|svelte)$/.test(p)) files.push(p); return; }
  for (const e of readdirSync(p)) { if (e !== 'node_modules') walk(join(p, e)); }
};
for (const s of SEARCH) walk(join(ROOT, s));

// Collect every distinct offender, and where it occurs.
const found = new Map();                        // number -> Set(relative file)
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  // any quoted string in the file, then every 10-digit number inside it
  for (const q of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    for (const m of q[2].matchAll(PHONE_IN_TEXT)) {
      const num = m[1];
      if (SAFE.test(num)) continue;
      if (!found.has(num)) found.set(num, new Set());
      found.get(num).add(relative(ROOT, f));
    }
  }
}

const fix = process.argv.includes('--fix');

if (!found.size) {
  console.log(`phones: clean — every fixture number in ${files.length} files is inside 60000000xx/60000001xx`);
  process.exit(0);
}

if (!fix) {
  console.error(`phones: ${found.size} number${found.size === 1 ? '' : 's'} outside the safe fixture range ` +
                `(60000000xx / 60000001xx). A dialable number belongs to a real person.\n`);
  for (const [num, where] of [...found].sort()) {
    console.error(`  ${num}  ${[...where].sort().join(', ')}`);
  }
  console.error(`\nRun: node tools/test/phones.mjs --fix`);
  process.exit(1);
}

/* ---- the rewrite ---- */
// Keep a stable mapping on disk so a later run reuses the same replacements: a number that appears in two
// suites must become the SAME safe number in both, or a cross-suite fixture stops matching.
let map = {};
if (existsSync(MAP_FILE)) map = JSON.parse(readFileSync(MAP_FILE, 'utf8')).map || {};

// Safe numbers already taken: by the mapping, and by whatever the files use already.
const taken = new Set(Object.values(map));
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(PHONE_IN_TEXT)) if (SAFE.test(m[1])) taken.add(m[1]);

/* Allotting a safe number. The standing rule is to KEEP THE LAST TWO DIGITS when mapping an old number,
   so a cross-reference a human recognises ("…42 is Arjun") survives the sweep. So: try 60000001<last two>
   first (the worker-test half of the range), then 60000000<last two>, then any free slot. */
const slot = (n) => `6000000${n < 100 ? '0' : '1'}${String(n % 100).padStart(2, '0')}`;
const allot = (original) => {
  const tail = Number(original.slice(-2));
  for (const cand of [slot(100 + tail), slot(tail)]) if (!taken.has(cand)) { taken.add(cand); return cand; }
  for (let i = 0; i < 200; i++) { const cand = slot(i); if (!taken.has(cand)) { taken.add(cand); return cand; } }
  throw new Error('the safe range 60000000xx/60000001xx is full — widen SAFE and slot() together');
};

for (const num of [...found.keys()].sort()) if (!map[num]) map[num] = allot(num);

let changed = 0, touched = 0;
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let after = before;
  for (const [from, to] of Object.entries(map)) {
    /* Inside quoted strings only, so a comment or a doc line mentioning an old number is left for a human
       to read. The number may be the whole string or embedded in it ('…?open=su:6000000310'). */
    after = after.replace(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g, (whole, q, body) => {
      const next = body.replace(new RegExp(`(?<![\\d])${from}(?![\\d])`, 'g'), () => { changed++; return to; });
      return next === body ? whole : `${q}${next}${q}`;
    });
  }
  if (after !== before) { writeFileSync(f, after); touched++; }
}

writeFileSync(MAP_FILE, JSON.stringify({
  note: 'Roadmap 6.7. Fixture phone numbers rewritten into the reserved 60000000xx/60000001xx range, ' +
        'because every other 10-digit number starting 6-9 is a real Indian mobile. Kept so a repeat run ' +
        'maps each original to the same safe number. tools/test/phones.mjs',
  at: new Date().toISOString().slice(0, 10),
  map
}, null, 2) + '\n');

console.log(`phones: rewrote ${changed} occurrence${changed === 1 ? '' : 's'} of ${found.size} number${found.size === 1 ? '' : 's'} across ${touched} file${touched === 1 ? '' : 's'}`);
console.log(`mapping: ${relative(ROOT, MAP_FILE)}`);
