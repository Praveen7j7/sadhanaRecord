// Prints gzip sizes of dist/assets and fails if the devotee-facing initial load exceeds the budget.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_JS = 60 * 1024, BUDGET_CSS = 15 * 1024, BUDGET_LAZY = 35 * 1024;
// The first install: what the service worker downloads before the app is usable offline. The modernization plan
// §18 set 800 KB; it was never checked by anything, and the audit found 757 KB with 68 lazy chunks in it
// (roadmap 5.1). Measured uncompressed, because that is what the install actually transfers and stores.
// 850 KB since 28 Oct 2026 (the head, Phase 24: the visual rebuild left 799 of 800 KB and no room for the next feature)
const BUDGET_PRECACHE = 850 * 1024, TARGET_PRECACHE = 700 * 1024;
const TARGET_JS = 55 * 1024, TARGET_CSS = 13.5 * 1024, TARGET_LAZY = 30 * 1024;
const dist = process.argv[2] || 'dist';          // a path argument checks another build (tests, before/after)
const gz = (f) => gzipSync(readFileSync(join(dist, f)), { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(2) + ' KB';

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\//, ''));
const js = [...new Set([...refs(/<script[^>]+src="([^"]+)"/g), ...refs(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)])];
// a stylesheet linked with a media query (contrast.css: only for "more contrast" / high contrast) is not render-blocking
// for anyone else: counted on its own line, not in the startup CSS
const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0]).filter((l) => !/\smedia="/.test(l)).map((l) => /href="([^"]+)"/.exec(l)[1].replace(/^\//, ''));
const condCss = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0]).filter((l) => /\smedia="/.test(l)).map((l) => /href="([^"]+)"/.exec(l)[1].replace(/^\//, ''));

console.log('All assets (gzip):');
for (const f of readdirSync(join(dist, 'assets')).sort()) console.log('  ' + f.padEnd(44) + kb(gz('assets/' + f)));

const sum = (l) => l.reduce((a, f) => a + gz(f), 0);
const jsTotal = sum(js), cssTotal = sum(css);
console.log('\nInitial JS  :', js.join(', '), '=', kb(jsTotal), `(budget ${kb(BUDGET_JS)})`);
console.log('Initial CSS :', css.join(', '), '=', kb(cssTotal), `(budget ${kb(BUDGET_CSS)})`);
if (condCss.length) console.log('Conditional CSS (media query, not render-blocking):', condCss.map((f) => `${f} ${kb(gz(f))}`).join(', '));
// A release build talks to the real API (22 Oct 2026, G14). With VITE_API_URL unset, Vite builds the in-memory mock into
// the app instead (staff-mock-*.js, 41.6 KB gz) and everyone would be signed into fake data. Only the uncommitted
// .env.production.local set it, so a clean checkout would have shipped the mock: release.mjs and the gate both run
// this check after their build, and it refuses that build.
const mockFiles = readdirSync(join(dist, 'assets')).filter((f) => /^staff-mock\b|^mock[-.]/.test(f));
if (mockFiles.length) {
  console.error(`FAIL: this build carries the in-memory mock (${mockFiles.join(', ')}): VITE_API_URL was not set. ` +
    'Set it (frontend/.env.production.local, see .env.example) and build again.');
  process.exit(1);
}
if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html) || /\sstyle="/.test(html) || /<style/.test(html)) {
  console.error('FAIL: inline script/style in index.html (CSP forbids it)');
  process.exit(1);
}
// lazy chunks (staff screens, the devotee form, …): each loads on its own when a screen opens
const lazy = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js') && !js.includes('assets/' + f) && !/^(sw|workbox)/.test(f));
const [bigName, bigSize] = lazy.map((f) => [f, gz('assets/' + f)]).sort((a, b) => b[1] - a[1])[0] || ['–', 0];
console.log('Largest lazy:', bigName, '=', kb(bigSize), `(target ${kb(TARGET_LAZY)}, budget ${kb(BUDGET_LAZY)})`);
// targets (the modernization plan, §18): above one is a warning to look at; above a budget fails
for (const [what, n, t] of [['initial JS', jsTotal, TARGET_JS], ['initial CSS', cssTotal, TARGET_CSS], ['largest lazy chunk', bigSize, TARGET_LAZY]])
  if (n > t) console.warn(`WARN: ${what} ${kb(n)} is above its target ${kb(t)}`);
// The precache: every file the service worker fetches at install, read from the generated manifest.
let preFail = '';
try {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  let bytes = 0;
  const gone = [];
  for (const u of urls) { try { bytes += readFileSync(join(dist, u)).length; } catch { gone.push(u); } }
  console.log('\nPrecache    :', urls.length, 'entries =', kb(bytes), `(budget ${kb(BUDGET_PRECACHE)})`);
  if (gone.length) console.warn('WARN: precached but not in dist:', gone.join(', '));
  if (bytes > TARGET_PRECACHE) console.warn(`WARN: precache ${kb(bytes)} is above its target ${kb(TARGET_PRECACHE)}`);
  if (bytes > BUDGET_PRECACHE) preFail = `precache ${kb(bytes)} is over its budget ${kb(BUDGET_PRECACHE)}`;
  // A devotee's phone must not pre-download staff code. Anything named staff-* is excluded by globIgnores, so
  // what this catches is a staff screen whose chunk or stylesheet did NOT get the prefix — which is exactly how
  // 33.8 KB of coordinator code sat in the precache until 13 Oct 2026 (audit FE-15).
  const STAFF = /(WeekRead|Export|Reopens|Admin|Batch|DevoteeDetail|Requests|StaffHome|HeadHome|Members|Board|Leaders|Stats|Coordinators|Facilitators|Ids|Activity|Settings|SignUpCard|Birthdays|Overview|Fac|sync|csv|exportfields)[-.]/;
  const leaked = urls.filter((u) => STAFF.test(u.split('/').pop() || '') && !/\/staff-/.test(u));
  if (leaked.length) preFail += (preFail ? ' · ' : '') + `staff-only files are in the precache (they need the staff- prefix in vite.config.js): ${leaked.join(', ')}`;
  if (urls.some((u) => /\/darshan\//.test(u))) preFail += (preFail ? ' · ' : '') + 'darshan paintings are in the precache';
  // The other direction (22 Oct 2026, G13): a precached file that IMPORTS one left out of the precache fails offline —
  // the screen opens from the install and its import goes to a network that is not there. lib/staff.js was emitted as
  // staff-<hash>.js, so My group and the week picker imported a file no phone had installed. Static imports only: a
  // dynamic import() is a screen opened on demand, which is allowed to need the network.
  const pre = new Set(urls), broken = [];
  for (const u of urls.filter((x) => x.endsWith('.js') && x.startsWith('assets/'))) {
    for (const m of readFileSync(join(dist, u), 'utf8').matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
      if (!pre.has('assets/' + m[1])) broken.push(`${u.slice(7)} → ${m[1]}`);
    }
  }
  if (broken.length) preFail += (preFail ? ' · ' : '') + `precached files import files that are not precached (they would fail offline): ${broken.join(', ')}`;
} catch (e) {
  console.warn('WARN: could not read the precache manifest (dist/sw.js):', e.message);
}

if (jsTotal > BUDGET_JS || cssTotal > BUDGET_CSS || bigSize > BUDGET_LAZY || preFail) {
  console.error('FAIL: ' + (preFail || 'over budget'));
  process.exit(1);
}
console.log('OK: within budget');
