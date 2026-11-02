// The production gate between modernization phases (Phase 4 → 5 → 6 …). State-aware, never time-based: a phase may
// deploy only when the phase before it is recorded LIVE, production still serves exactly that release, the live smoke
// checks pass now, and this phase's own checks passed on the very source being deployed. One run, no retries:
// a closed gate prints why and exits 2.
//
//   node tools/release/gate.mjs status                         what is recorded, and what is live now
//   node tools/release/gate.mjs smoke [--expect index-X.js]    the live smoke checks only
//   node tools/release/gate.mjs record <n> --dist <index.html> phase n is live: the live app must be that build
//   node tools/release/gate.mjs checks <n>                     run phase n's checks here; stamp the source if green
//   node tools/release/gate.mjs check <n>                      may phase n deploy now? (exit 0 open, 2 blocked)
//
// npm run release calls `check` before publishing and `record` after, when frontend/release-phase.json names a phase.
import { execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);        // sadhanaRecord/
const FE = path.join(ROOT, 'frontend');
const LEDGER = process.env.GATE_LEDGER || path.join(ROOT, 'tools/release/phases.json');
const APP = 'https://sadhana-record.iyfdelhi-sadhana.workers.dev/';
const API = 'https://sadhana-record-api.iyfdelhi-sadhana.workers.dev';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' IST';
const indexOf = (html) => (html.match(/assets\/index-[\w-]+\.js/) || [''])[0];

const read = () => { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { phases: {} }; } };
const write = (l) => fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n');

/** The source that makes the app: any change here makes earlier checks stale. */
function fingerprint() {
  const h = createHash('sha256');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else h.update(path.relative(ROOT, p) + '\0').update(fs.readFileSync(p));
  });
  // Phase 9: the server too (its code, migrations and tests ship in the same release)
  for (const d of ['frontend/src', 'frontend/public', 'frontend/tests', 'shared', 'worker/src', 'worker/migrations', 'worker/tests']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  for (const f of ['frontend/index.html', 'frontend/package.json', 'frontend/vite.config.js']) h.update(f + '\0').update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest('hex').slice(0, 16);
}

/** The live smoke checks: the expected build is served; it starts with no page errors; public screens render; the
 *  service worker installs; every lazy screen file loads; the manifest and the API answer. */
async function smoke(expect = '') {
  const out = { at: now(), checks: [] };
  const ok = (pass, what) => { out.checks.push((pass ? 'PASS ' : 'FAIL ') + what); return pass; };
  const html = await (await fetch(APP, { cache: 'no-store' })).text();
  out.index = indexOf(html);
  ok(!!out.index, `the app answers (${out.index || 'no index script'})`);
  if (expect) ok(out.index === expect, `production serves the expected release (${expect})`);
  const js = await (await fetch(APP + out.index, { cache: 'no-store' })).text().catch(() => '');
  out.build = (js.match(/20\d\d\.\d\d\.\d\d-\d{4}/) || [''])[0];
  for (const m of [...new Set(js.match(/assets\/[\w-]+\.js/g) || [])].slice(0, 12)) {           // the startup chunks
    if (out.build) break;
    out.build = ((await (await fetch(APP + m)).text()).match(/20\d\d\.\d\d\.\d\d-\d{4}/) || [''])[0];
  }
  const man = await fetch(APP + 'manifest.webmanifest').then((r) => r.ok && r.json()).catch(() => null);
  ok(!!man?.name, 'the manifest loads');
  const meta = await fetch(API, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ v: 1, action: 'meta.get', app: 'gate', data: {} }) }).then((r) => r.json()).catch(() => null);
  ok(meta?.ok === true, 'the API answers meta.get');

  const puppeteer = createRequire(path.join(FE, 'package.json'))('puppeteer-core');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sadhana-gate-'));
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: profile });
  try {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.setViewport({ width: 390, height: 800 });
    await p.goto(APP + '#/login', { waitUntil: 'networkidle0', timeout: 45000 });
    ok(await p.waitForSelector('#login', { timeout: 15000 }).then(() => true).catch(() => false), 'the sign-in screen renders');
    for (const [hash, sel] of [['#/welcome', '.welcome'], ['#/forgot', 'form'], ['#/signup', 'form']]) {
      await p.evaluate((h) => { location.hash = h; }, hash);
      ok(await p.waitForSelector(sel, { timeout: 10000 }).then(() => true).catch(() => false), `navigation works: ${hash} renders`);
    }
    ok(await p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 30000))])), 'the service worker installs (PWA / offline)');
    const lazy = await p.evaluate(async () => {
      const src = [...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-'));
      const txt = await (await fetch(src)).text(), res = [];
      for (const f of [...new Set(txt.match(/(?<![\w-])(staff-[\w-]+|Devotee-[\w-]+)\.js/g) || [])]) { try { await import('/assets/' + f); res.push(f + ' ok'); } catch (e) { res.push(f + ' FAILED'); } }
      return res;
    });
    ok(lazy.length > 0 && !lazy.some((s) => s.includes('FAILED')), `every lazy screen file loads (${lazy.length})`);
    ok(!errs.length, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  } finally { await b.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  out.pass = out.checks.every((c) => c.startsWith('PASS'));
  return out;
}

function blocked(n, why) {
  console.log(`\nPhase ${n} deployment blocked:\n${why}\n`);
  process.exit(2);
}

const [cmd, nArg] = process.argv.slice(2);
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const n = Number(nArg);
const L = read();

if (cmd === 'status') {
  const live = indexOf(await (await fetch(APP, { cache: 'no-store' })).text());
  console.log(`live now: ${live}\nledger: ${LEDGER}`);
  for (const [k, v] of Object.entries(L.phases)) console.log(`  phase ${k}: ${v.status}${v.index ? ' · ' + v.index : ''}${v.build ? ' · build ' + v.build : ''}${v.at ? ' · ' + v.at : ''}${v.checks ? ' · checks ' + v.checks.fingerprint + ' ' + v.checks.at : ''}`);
} else if (cmd === 'smoke') {
  const s = await smoke(arg('--expect'));
  console.log(s.checks.join('\n') + `\nlive ${s.index} · build ${s.build || '?'} → ${s.pass ? 'SMOKE OK' : 'SMOKE FAILED'}`);
  process.exit(s.pass ? 0 : 1);
} else if (cmd === 'record' && n) {
  // phase n is live only if production serves exactly the build in --dist and the smoke checks pass on it
  const dist = arg('--dist') || path.join(FE, 'dist/index.html');
  const want = indexOf(fs.readFileSync(dist, 'utf8'));
  const s = await smoke(want);
  console.log(s.checks.join('\n'));
  if (!s.pass) { console.log(`\nPhase ${n} NOT recorded live: production is ${s.index}, expected ${want}, or a smoke check failed.`); process.exit(1); }
  L.phases[n] = { ...(L.phases[n] || {}), status: 'live', index: s.index, build: s.build, at: s.at, dist, smoke: s.checks };
  write(L);
  console.log(`\nPhase ${n} recorded LIVE: ${s.index} · build ${s.build} · ${s.at}. The phase ${n + 1} gate may now open.`);
} else if (cmd === 'checks' && n) {
  // this phase's checks, on this tree: app tests, build + size budgets, the whole browser suite and the phase's own
  // browser checks, against a dev server started here on a free port. Green → the source fingerprint is stamped.
  const fp = fingerprint();
  const run = (c) => execSync(c, { cwd: FE, stdio: 'inherit' });
  run('npm test --silent'); run('npm run build --silent'); run('npm run size --silent');
  // Phase 9: the server suites and the two database audits (a scan or bulk write not on tests/audit-allow.mjs fails)
  execSync('npm run audit:sql --silent', { cwd: path.join(ROOT, 'worker'), stdio: 'inherit' });
  const port = 5400 + Math.floor(Math.random() * 400);
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: FE, stdio: 'ignore', detached: true });
  try {
    await sleep(5000);
    // back-guard.mjs (10 Oct 2026): Back on a form with unsaved changes asks once, steadily (the head's phone recording)
    // motion-audit.mjs (10 Oct 2026): sheets, the menu, the wheel and page changes glide (no pop, no stutter)
    const suites = ['verify.mjs', 'components.mjs', 'back-guard.mjs', 'motion-audit.mjs'].map((f) => path.join(ROOT, 'tools/browser', f)).filter((f) => f.endsWith('verify.mjs') || fs.existsSync(f));
    const summary = [];
    for (const s of suites) {
      // A suite that CRASHES (an uncaught throw — a $eval on an element that is not there yet) used to escape execSync as
      // an exception here, so the gate died with no verdict, no FAIL lines and no stamp, and a chain reading this log
      // could not tell a crash from a pass (12 Oct 2026, 06:27). A crash is a failure with a reason, reported like one.
      let o;
      try { o = execSync(`node ${s}`, { cwd: path.dirname(s), env: { ...process.env, BASE: `http://localhost:${port}`, OUT: path.join(FE, 'screenshots') }, maxBuffer: 64e6 }).toString(); }
      catch (e) {
        const out = `${e.stdout || ''}\n${e.stderr || ''}`, why = out.split('\n').filter((x) => /Error|failed to find element|PAGEERR/.test(x)).slice(-2).join(' · ') || `exit ${e.status}`;
        console.log(out.split('\n').filter((x) => x.startsWith('FAIL') || x.startsWith('PASS')).slice(-6).join('\n'));
        summary.push(`${path.basename(s)}: CRASHED (${why.slice(0, 160)})`);
        console.log(`\nPhase ${n} checks FAILED: ${path.basename(s)} crashed — ${why.slice(0, 200)}\n(${summary.join(' · ')}). Not stamped.`); process.exit(1);
      }
      const line = (o.match(/(\d+) passed, (\d+) failed/) || []);
      summary.push(`${path.basename(s)}: ${line[0] || 'no summary'}`);
      const pageErrs = o.split('\n').filter((x) => /PAGEERR/.test(x));
      if (pageErrs.length) { console.log(pageErrs.join('\n')); console.log(`\nPhase ${n} checks FAILED: page errors in ${path.basename(s)}. Not stamped.`); process.exit(1); }
      if (!line[0] || line[2] !== '0') { console.log(o.split('\n').filter((x) => x.startsWith('FAIL')).join('\n')); console.log(`\nPhase ${n} checks FAILED (${summary.join(' · ')}). Not stamped.`); process.exit(1); }
    }
    // G10 (22 Oct 2026): every signed-in screen, every role, on a low-end phone profile — layout shift, main-thread
    // blocking and repeat-visit readiness within the audit's budget (tools/perf/routevitals.mjs --check). Lighthouse
    // cannot reach the signed-in screens of a mock build; this measures them through the real Login screen.
    try {
      const vo = execSync(`node ${path.join(ROOT, 'tools/perf/routevitals.mjs')} http://localhost:${port} ${path.join(FE, 'screenshots', 'routevitals.json')} --check`, { cwd: ROOT, maxBuffer: 64e6 }).toString();
      summary.push((vo.match(/routevitals: .*/) || ['routevitals: no summary'])[0]);
    } catch (e) {
      const out = `${e.stdout || ''}\n${e.stderr || ''}`;
      console.log(out.split('\n').filter((x) => /^FAIL|routevitals:|Error/.test(x)).join('\n'));
      console.log(`\nPhase ${n} checks FAILED: screens over the speed budget (routevitals). Not stamped.`); process.exit(1);
    }
    // Phase 7 (22 Oct 2026): the screen-reader sweep — every route, every role, what TalkBack / VoiceOver would announce.
    // Any blocker, major or crashed route fails the gate; minors are listed in its report, not counted against it.
    {
      let so = '';
      try { so = execSync(`node ${path.join(ROOT, 'tools/browser/screenreader.mjs')}`, { cwd: path.join(ROOT, 'tools/browser'), env: { ...process.env, BASE: `http://localhost:${port}` }, maxBuffer: 64e6 }).toString(); }
      catch (e) { so = `${e.stdout || ''}\n${e.stderr || ''}`; }
      const m = so.match(/Totals: (\d+) blocker · (\d+) major · (\d+) minor · (\d+) error/);
      if (!m) { console.log(so.split('\n').slice(-8).join('\n')); console.log(`\nPhase ${n} checks FAILED: the screen-reader sweep gave no totals. Not stamped.`); process.exit(1); }
      summary.push(`screenreader: ${m[1]} blocker · ${m[2]} major · ${m[3]} minor`);
      if (+m[1] || +m[2] || +m[4]) {
        console.log(so.split('\n').filter((x) => /=====|\[/.test(x)).slice(0, 40).join('\n'));
        console.log(`\nPhase ${n} checks FAILED: screen-reader sweep found ${m[1]} blocker, ${m[2]} major, ${m[4]} error. Not stamped.`); process.exit(1);
      }
    }
    if (fingerprint() !== fp) { console.log('The source changed while the checks ran. Not stamped: run again.'); process.exit(1); }
    L.phases[n] = { ...(L.phases[n] || { status: 'ready' }), checks: { fingerprint: fp, at: now(), summary } };
    write(L);
    console.log(`\nPhase ${n} checks green (${summary.join(' · ')}); source ${fp} stamped.`);
  } finally { try { process.kill(-vite.pid); } catch { /* gone */ } }
} else if (cmd === 'check' && n) {
  const prev = L.phases[n - 1];
  if (!prev || prev.status !== 'live') blocked(n, `Phase ${n - 1} production gate has not been satisfied.\n(Phase ${n - 1} is not recorded LIVE: run \`gate.mjs record ${n - 1} --dist <its dist/index.html>\` once it is released.)`);
  if (L.phases[n]?.status === 'live') { console.log(`Phase ${n} is already recorded LIVE (${L.phases[n].index}). Nothing to do.`); process.exit(3); }
  const s = await smoke(prev.index);
  console.log(s.checks.join('\n'));
  if (!s.pass) blocked(n, `Phase ${n - 1} production gate has not been satisfied.\n(production serves ${s.index}, recorded phase ${n - 1} release is ${prev.index}, or a live smoke check failed.)`);
  const c = L.phases[n]?.checks, fp = fingerprint();
  if (!c || c.fingerprint !== fp) blocked(n, `Phase ${n} checks have not passed on this source (${fp}${c ? `; last green: ${c.fingerprint} at ${c.at}` : ''}).\nRun \`gate.mjs checks ${n}\`.`);
  console.log(`\nPhase ${n} gate OPEN: phase ${n - 1} live (${prev.index}, smoke ok now), phase ${n} checks green on ${fp} (${c.at}).`);
} else {
  console.log('usage: gate.mjs status | smoke [--expect index-X.js] | record <n> --dist <index.html> | checks <n> | check <n>');
  process.exit(1);
}
