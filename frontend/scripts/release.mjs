// npm run release — publishes the app, and proves that an app already open on a phone moves to the new
// version by itself (the "Could not load this screen" problem of 2 Oct 2026 must never come back).
//   1. tests, build, size budget, the previous releases' files carried over
//                                       2. open the live app like an installed phone app (offline copy on)
//   3. publish                          4. the open page must reload onto the new version, and the staff
//                                          screens of the new version must load
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { carryAssets } from './carry-assets.mjs';

const URL_ = 'https://sadhana-record.iyfdelhi-sadhana.workers.dev/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const run = cmd => execSync(cmd, { stdio: 'inherit' });
// Roadmap 0.4 (audit T F-06, F-22): the deploy must use the wrangler this repo DECLARES, not whichever
// version happens to be on PATH. `--no-install` fails loudly rather than silently fetching a different one,
// so `npm ci` in worker/ is a prerequisite and a missing install is reported instead of guessed at.
const WRANGLER = 'npx --no-install wrangler';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const liveIndex = async () => ((await (await fetch(URL_, { cache: 'no-store' })).text()).match(/assets\/index-[\w-]+\.js/) || [''])[0];

// the phase gate (tools/release/gate.mjs): when this tree is a modernization phase, it publishes only if the phase
// before it is recorded live and still serving, and this phase's checks passed on this exact source
const PHASE = (() => { try { return JSON.parse(fs.readFileSync('release-phase.json', 'utf8')).phase; } catch { return 0; } })();
const GATE = path.resolve('../tools/release/gate.mjs');
if (PHASE) {
  const g = spawnSync('node', [GATE, 'check', String(PHASE)], { stdio: 'inherit' });
  if (g.status === 3) console.log(`phase ${PHASE} is already live: this is a fix on top of it; it will be recorded again after publishing`);
  else if (g.status !== 0) process.exit(g.status || 2);
}

run('npm test --silent');
run('npm run build --silent');
run('npm run size --silent');
// after the size check (it measures this build only): the two previous releases' files go out with this one, so a page
// still on an older version can load its screens until it reloads (scripts/carry-assets.mjs)
{ const c = await carryAssets('dist'); console.log(`old release files carried: ${c.copied} (${c.kb} KB, via ${c.source})`); }
const newIndex = (fs.readFileSync('dist/index.html', 'utf8').match(/assets\/index-[\w-]+\.js/) || [''])[0];

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sadhana-release-'));
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: profile });
// declared out here because the catch below needs them (roadmap 6.5)
let published = false, liveVersion = '';
try {
  const p = await b.newPage();
  await p.goto(URL_ + '#/login', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 30000 });
  const before = await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/assets/index-')));
  console.log(`\nopen app before publishing: ${before.split('/').pop()}`);

  if (before.endsWith(newIndex)) { console.log('this build is identical to the live version: nothing new to publish'); process.exit(0); }

  /* Roadmap 6.5 (audit T F-14): what used to happen when a check AFTER the deploy failed was that the
     script threw and the half-checked build stayed live, with the person running it left to work out the
     rollback by hand at the worst possible moment. So: remember the version that is serving now, and if
     anything below fails, put it back automatically and say so. */
  liveVersion = (() => {
    try {
      // `deployments list`, NOT `versions list`: a version can be uploaded without carrying traffic, so only
      // the deployments tell you what is actually being served. Both lists are OLDEST-FIRST (checked against
      // the live Worker on 14 Oct 2026), so the deployment in force is the LAST entry, and within it the
      // version at 100 %. Taking the first entry would roll the app back to a build from five days earlier.
      // the APP's own Worker (frontend/wrangler.jsonc). It read ../worker until phase 22: the API's deployments, so the
      // automatic rollback redeployed the API's current version — a no-op that never rolled the app back (23 Oct 2026)
      const out = execSync(`${WRANGLER} deployments list --json`, { cwd: '.', encoding: 'utf8' });
      const ds = JSON.parse(out);
      const cur = Array.isArray(ds) && ds.length ? ds[ds.length - 1] : null;
      const full = cur && (cur.versions || []).find(v => Number(v.percentage) === 100);
      return full ? full.version_id : '';
    } catch (e) { console.warn(`could not read the live version id, so an automatic rollback is NOT available: ${e.message}`); return ''; }
  })();
  if (liveVersion) console.log(`live version before publishing: ${liveVersion} (rollback target if a check below fails)`);

  // the bare wrangler, on purpose: this script has already run the app's tests, build and budgets above, and
  // worker/scripts/deploy.mjs is the gate for a WORKER-only deploy. Going through it here would re-run the
  // server suites for a frontend release.
  run(`${WRANGLER} deploy`);
  published = true;
  for (let i = 0; i < 30 && (await liveIndex()) !== newIndex; i++) await sleep(2000);   // Cloudflare takes ~5–15 s
  if ((await liveIndex()) !== newIndex) throw new Error('the new version is not being served yet');

  // what the app does hourly and whenever it comes back on screen: look for a new version (repeated here, because
  // Cloudflare may serve the new service worker a few seconds after the new page)
  const moved = async () => p.evaluate(v => !![document.scripts.length] && ![...document.scripts].some(s => s.src === v), before).catch(() => false);
  // up to 5 minutes (phase 21 timed out at 2 with the old worker still active and nothing installing: the edge served the
  // old sw.js for a while after the deploy; a local swap moved in 6 s). Each round asks the registration to update.
  for (let i = 0; i < 60 && !(await moved()); i++) {
    await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
    await sleep(5000);
  }
  if (!(await moved())) {
    const st = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return JSON.stringify({ active: r?.active?.scriptURL && r.active.state, installing: r?.installing?.state, waiting: r?.waiting?.state }); });
    throw new Error('the open app did not move to the new version within 5 minutes · service worker ' + st);
  }
  await sleep(1500);
  const after = await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/assets/index-')) || '');
  if (!after.endsWith(newIndex)) throw new Error(`the open app did not move to the new version (still ${after})`);
  const screens = await p.evaluate(async () => {
    const txt = await (await fetch([...document.scripts].map(s => s.src).find(s => s.includes('/assets/index-')))).text();
    const out = [];
    // every screen file the app loads on demand (staff screens, the devotee form), by the names this build gave them
    for (const f of [...new Set(txt.match(/(?<![\w-])(staff-[\w-]+|Devotee-[\w-]+)\.js/g) || [])]) { try { await import('/assets/' + f); out.push(f + ' ok'); } catch (e) { out.push(f + ' FAILED: ' + e.message); } }
    return out;
  });
  if (screens.some(s => s.includes('FAILED')) || !screens.length) throw new Error('staff screens: ' + screens.join(', '));
  console.log(`open app moved by itself to: ${after.split('/').pop()} · ${screens.join(' · ')}\nrelease OK`);
  // the live checks again, on the published build; only then is the phase recorded LIVE (and the next gate may open)
  if (PHASE && spawnSync('node', [GATE, 'record', String(PHASE), '--dist', path.resolve('dist/index.html')], { stdio: 'inherit' }).status !== 0)
    throw new Error(`published, but phase ${PHASE} is NOT verified live: see the smoke checks above`);
} catch (e) {
  /* Roadmap 6.5: a failure after publishing leaves a version live that did not pass its checks. Put the
     previous one back before reporting, so the app is never left on an unverified build while somebody
     reads a stack trace. A rollback that itself fails is stated plainly with the manual command. */
  if (published && liveVersion) {
    console.error(`\nrelease FAILED after publishing: ${e.message}`);
    console.error(`rolling back to ${liveVersion} …`);
    try {
      execSync(`${WRANGLER} rollback ${liveVersion} --message "automatic rollback: a release check failed"`,
        { cwd: '.', stdio: 'inherit' });
      for (let i = 0; i < 30 && (await liveIndex()) === newIndex; i++) await sleep(2000);
      console.error((await liveIndex()) === newIndex
        ? `ROLLBACK DID NOT TAKE EFFECT: ${newIndex} is still being served. Roll back by hand now: cd frontend && npx --no-install wrangler deployments list, then npx --no-install wrangler rollback <id>`
        : `rolled back: the app is serving ${liveVersion} again. Fix the cause, then run npm run release once more.`);
    } catch (re) {
      console.error(`THE ROLLBACK ALSO FAILED (${re.message}). The app is still on the unverified build.`);
      console.error(`Roll back by hand now: cd frontend && npx --no-install wrangler rollback ${liveVersion}`);
    }
  } else if (published) {
    console.error(`\nrelease FAILED after publishing, and no rollback target was recorded: ${e.message}`);
    console.error('Roll back by hand: cd frontend && npx --no-install wrangler deployments list, then npx --no-install wrangler rollback <id>');
  }
  throw e;
} finally {
  await b.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
