// The error-code registry stays true (13 October 2026; audit F26 / roadmap 3.3).
//
// Codes used to be string literals in eleven modules: the API reference listed nine while the server threw
// twenty-two, and the client's message table had its own idea again. These assertions fail the moment the three
// drift apart, which is the only way a list like this stays correct.
import { suite } from './harness.mjs';
import { ERRORS, CODE_LIST } from '../src/codes.js';
import fs from 'node:fs';

const t = suite('error codes: one list, and everything agrees with it');

const SRC = new URL('../src/', import.meta.url);
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));

// ---- every code thrown by the server is in the registry ----
const thrown = new Map();
for (const f of files) {
  const text = fs.readFileSync(new URL(f, SRC), 'utf8');
  for (const m of text.matchAll(/apiError\('([A-Z_]+)'/g)) {
    if (!thrown.has(m[1])) thrown.set(m[1], []);
    thrown.get(m[1]).push(f);
  }
}
t.ok(thrown.size > 15, `${thrown.size} distinct codes are thrown across ${files.length} modules`);
const undocumented = [...thrown.keys()].filter(c => !ERRORS[c]).sort();
t.eq(undocumented, [], 'every code thrown by the server is described in codes.js' + (undocumented.length ? ': ' + undocumented.join(', ') : ''));

// ---- the registry has no codes nobody can produce ----
// (VALIDATION comes from invalid(), INTERNAL from the catch in api.js, so they are thrown without apiError)
// DAILY_LIMIT joins them: api.js returns it directly from the catch when D1 reports the free-plan row budget
// is spent, rather than throwing it with apiError().
const INDIRECT = ['VALIDATION', 'INTERNAL', 'DAILY_LIMIT'];
const unused = CODE_LIST.filter(c => !thrown.has(c) && !INDIRECT.includes(c));
t.eq(unused, [], 'the registry lists no code the server cannot produce' + (unused.length ? ': ' + unused.join(', ') : ''));
for (const c of INDIRECT) t.ok(!!ERRORS[c], `${c} is described even though it is not thrown with apiError()`);

// ---- every entry is properly described ----
const bad = CODE_LIST.filter(c => {
  const e = ERRORS[c];
  return !e.meaning || e.meaning.length < 25 || !['never', 'later', 'fix'].includes(e.retry) || !(e.http >= 400);
});
t.eq(bad, [], 'every code has a real meaning, a retry verdict and an http equivalent');

// ---- the app's message table covers the codes a person can meet ----
const api = fs.readFileSync(new URL('../../frontend/src/lib/api.js', import.meta.url), 'utf8');
const clientCases = new Set([...api.matchAll(/case '([A-Z_]+)':/g)].map(m => m[1]));
// NETWORK and TIMEOUT are the client's own, they never come from the server
for (const own of ['NETWORK', 'TIMEOUT']) t.ok(clientCases.has(own), `the app handles its own ${own}`);
// a code the person can actually see must either have its own message or fall through to the server's text:
// the fall-through is `default: return e.message`, so the only hard requirement is that it exists
t.ok(/default:\s*return e\.message/.test(api), 'the app falls back to the server message for codes it does not name');
const clientUnknown = [...clientCases].filter(c => !ERRORS[c] && !['NETWORK', 'TIMEOUT'].includes(c)).sort();
t.eq(clientUnknown, [], 'the app names no server code that the registry does not have' + (clientUnknown.length ? ': ' + clientUnknown.join(', ') : ''));

// ---- the documented list in API_REFERENCE.md matches ----
const doc = fs.readFileSync(new URL('../../docs/API_REFERENCE.md', import.meta.url), 'utf8');
const missingFromDoc = CODE_LIST.filter(c => !doc.includes(c)).sort();
t.eq(missingFromDoc, [], 'every code appears in docs/API_REFERENCE.md' + (missingFromDoc.length ? ': ' + missingFromDoc.join(', ') : ''));

t.done();
