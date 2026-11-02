// How fast EVERY signed-in screen opens, per role, on a low-end phone profile (22 Oct 2026, audit G10).
//
// Why not Lighthouse: an audit opens a fresh tab, and against the dev/preview mock the API lives inside each page,
// so a new tab knows no session and lands on Welcome. Signed-in screens are reached by in-app navigation anyway,
// so this measures exactly that: sign in once per role through the real Login screen, throttle the page like
// Lighthouse mobile (4× CPU, ~1.6 Mbps / 150 ms RTT), then move to each route by hash and time it until the screen
// shows real content (main has text and no .sk loading placeholder). During each move it records layout shift (CLS),
// main-thread blocking (TBT ≈ Σ(long task − 50 ms)), bytes and requests. "first" = the first visit to the route
// in the session (its chunk may need fetching), "again" = a second visit (chunk and read cache warm).
// Against a mock build the API answers in ~0 ms, so the numbers are the FRONT END's share; on live add the hops.
//   node tools/perf/routevitals.mjs [baseUrl] [out.json] [--check]
// --check (G10, the release gate): exit 1 when any screen breaks the budget of prompt-63's audit §5.2 —
//   layout shift ≤ 0.1 on every visit; no main-thread blocking on a repeat visit (≤ 50 ms on a first open, which may
//   compile its chunk); a repeat visit ready within 100 ms; every screen reached, none refused or timed out.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url).pathname);
const puppeteer = require('puppeteer-core');
const BASE = process.argv[2] || 'http://localhost:5203';
const OUT = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : '';
const CHECK = process.argv.includes('--check');
export const BUDGET = { cls: 0.1, tbtAgain: 0, tbtFirst: 50, readyAgainMs: 100 };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROLES = [
  { who: 'devotee', login: '6000000001', pw: 'pass-12345', routes: ['/week', '/day', '/history', '/report', '/hearing', '/reading', '/wall', '/card', '/account', '/songs', '/home'] },
  { who: 'facilitator', login: 'natvar', pw: 'natvar-pass-1', routes: ['/my-devotees', '/explorer', '/card', '/home'] },
  { who: 'coordinator', login: 'sps', pw: 'sps-pass-12', routes: ['/requests', '/batch', '/members', '/stats', '/leaders', '/board', '/devotee/6000000001', '/home'] },
  { who: 'training-coord', login: 'etp', pw: 'etp-pass-12', routes: ['/students', '/board', '/scoreboards', '/home'] },
  { who: 'head', login: 'master', pw: 'master-pass-1', routes: ['/overview', '/analysis', '/coordinators', '/facilitators', '/batches', '/scoreboards', '/ids', '/activity', '/settings', '/home'] },
];
const OBSERVE = () => {
  window.__v = { cls: 0, tbt: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
};
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const rows = [];
for (const role of ROLES) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 820, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(OBSERVE);
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#login');
  await page.type('#login', role.login); await page.type('#password', role.pw);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('main .sk'), { timeout: 15000 }).catch(() => {});
  let day = '';
  if (role.routes.includes('/day')) {
    await page.evaluate(() => { location.hash = '#/week'; });
    await page.waitForSelector('a[href*="#/day/"]', { timeout: 10000 }).catch(() => {});
    day = await page.evaluate(() => document.querySelector('a[href*="#/day/"]')?.getAttribute('href')?.slice(1) || '');
    await page.evaluate(() => { location.hash = '#/home'; });
    await new Promise((r) => setTimeout(r, 800));
  }
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0, reqs = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
  for (const pass of ['first', 'again']) {
    for (const r0 of role.routes) {
      const route = r0 === '/day' ? day : r0;
      if (!route) { rows.push({ who: role.who, route: r0, pass, note: 'no link' }); continue; }
      await page.evaluate(() => { window.__v.cls = 0; window.__v.tbt = 0; });
      bytes = 0; reqs = 0;
      const t0 = Date.now();
      await page.evaluate((h) => { location.hash = h; }, '#' + route);
      // Ready = the app has APPLIED the route (main[data-path], set by ui/Shell.svelte) and drawn it: no skeleton, some
      // text. Not the address: a view transition holds the old screen for up to 400 ms after the address changes, so
      // "ready" used to match the page being LEFT, and the new screen's cost landed on a later visit (22 Oct 2026, R2).
      // A sub-path counts: the app itself rewrites #/week to #/week/<this week> (devotee/Devotee.svelte, R1).
      const ok = await page.waitForFunction((want) => {
        const m = document.querySelector('main[data-path]'), p = m?.dataset.path;
        return !!m && (p === want || p.startsWith(want + '/')) && !m.querySelector('.sk') && (m.innerText || '').trim().length > 20;
      }, { timeout: 20000, polling: 16 }, route.split('?')[0]).then(() => true).catch(() => false);
      const ms = Date.now() - t0;
      await new Promise((r) => setTimeout(r, 600));   // let late shifts and long tasks land
      const v = await page.evaluate(() => ({ ...window.__v, hash: location.hash, denied: /not available to you|page not found/i.test(document.body.innerText) }));
      const row = { who: role.who, route, pass, ms: ok ? ms : -1, cls: +v.cls.toFixed(3), tbt: Math.round(v.tbt), kib: Math.round(bytes / 1024), reqs, landed: v.hash, denied: v.denied };
      rows.push(row);
      console.log(`${role.who.padEnd(15)} ${route.padEnd(30)} ${pass.padEnd(5)}  ready ${ok ? ms + ' ms' : 'TIMEOUT'}  CLS ${row.cls.toFixed(3)}  TBT ${row.tbt}  ${row.kib} KiB / ${reqs} req${v.denied ? '  DENIED' : ''}${ok ? '' : '  at ' + v.hash}`);
    }
  }
  await ctx.close();
}
await browser.close();
if (OUT) fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
if (CHECK) {
  const bad = rows.filter((r) => !r.note).map((r) => {
    const why = [];
    if (r.ms < 0) why.push('never showed its content (timeout)');
    if (r.denied) why.push('refused');
    if (r.cls > BUDGET.cls) why.push(`layout shift ${r.cls} > ${BUDGET.cls}`);
    if (r.pass === 'again' && r.tbt > BUDGET.tbtAgain) why.push(`blocking ${r.tbt} ms on a repeat visit`);
    if (r.pass === 'first' && r.tbt > BUDGET.tbtFirst) why.push(`blocking ${r.tbt} ms > ${BUDGET.tbtFirst} on first open`);
    if (r.pass === 'again' && r.ms > BUDGET.readyAgainMs) why.push(`repeat visit ready in ${r.ms} ms > ${BUDGET.readyAgainMs}`);
    return why.length ? `${r.who} ${r.route} (${r.pass}): ${why.join('; ')}` : '';
  }).filter(Boolean);
  console.log(bad.length ? `routevitals: ${bad.length} over budget\n` + bad.map((b) => 'FAIL ' + b).join('\n') : `routevitals: ${rows.length} visits within budget`);
  process.exit(bad.length ? 1 : 0);
}
