// Visual audit capture: every route × role × width × theme, full-page shots + the in-page layout sweep.
// Usage: node capture.mjs <mode: shots|states> <role,role,...>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const ROOT = '/private/tmp/claude-501/-Users-maclapctp409-Downloads-hpStuff-prompt/bfb96117-1af2-4f66-95d5-4bbb86028c04/scratchpad/visual-audit';
const require = createRequire(ROOT + '/tree/frontend/package.json');
const puppeteer = require('puppeteer-core');
const BASE = 'http://127.0.0.1:5671';
const CHROME = process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const SHOTS = ROOT + '/shots', DATA = ROOT + '/data/sweep';
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DATA, { recursive: true });
const SWEEP_SRC = fs.readFileSync(ROOT + '/scripts/sweep.js', 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mode = process.argv[2] || 'shots';
const want = (process.argv[3] || '').split(',').filter(Boolean);
const WIDTHS = (process.env.WIDTHS || (mode === 'states' ? '390,1440' : '320,390,768,1024,1440')).split(',').map(Number);
const THEMES = mode === 'states' ? ['light'] : ['light', 'dark'];

function weekId(offsetWeeks = 0) {
  const ist = new Date(Date.now() + 5.5 * 3600e3), back = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back + 7 * offsetWeeks)).toISOString().slice(0, 10);
}
const W = weekId(0), LW = weekId(-1);
const R = (key, hash) => ({ key, hash });
const ROLES = {
  public: { login: null, routes: [R('welcome', '/welcome'), R('login', '/login'), R('signup', '/signup'), R('forgot', '/forgot')] },
  devotee: { login: ['6000000001', 'pass-12345'], routes: [
    R('home', '/home'), R('week', '/week'), R('week-past', `/week/${LW}`), R('day', `/day/${W}/${W}`), R('history', '/history'), R('history-week', `/history/${LW}`),
    R('report', '/report'), R('hearing', '/hearing'), R('reading', '/reading'), R('learn', '/learn'), R('share', '/share'), R('share-with-me', '/share/with-me'),
    R('shared', '/shared/shareAarav'), R('shared-week', `/shared/shareAarav/${LW}`), R('wall', '/wall'), R('account', '/account'), R('songs', '/songs'), R('song', '/songs/s034'),
    R('songs-empty', '/songs?q=zzqx'), R('change-password', '/change-password'), R('group', '/group'), R('card', '/card'), R('notfound', '/no-such-page')] },
  trd: { login: ['6000000092', 'trd-pass-12'], routes: [R('home', '/home'), R('week', '/week'), R('day', `/day/${W}/${W}`), R('report', '/report')] },
  sps: { login: ['sps', 'sps-pass-12'], routes: [
    R('home', '/home'), R('requests', '/requests'), R('batch', '/batch'), R('members', '/members'), R('members-empty', '/members?q=zzqx'), R('stats', '/stats'), R('leaders', '/leaders'),
    R('closing', '/closing'), R('newbatch', '/newbatch'), R('board', '/board'), R('ready', '/ready'), R('students', '/students'), R('devotee', '/devotee/6000000011'),
    R('devotee-week', `/devotee/6000000011/week/${LW}`), R('fill-week', `/fill/6000000011/week/${W}?n=Aarav%20Gupta`), R('fill-day', `/fill/6000000011/day/${W}/${W}?n=Aarav%20Gupta`),
    R('leaderboard', '/leaderboard'), R('wall', '/wall'), R('account', '/account'), R('card', '/card')] },
  etp: { login: ['etp', 'etp-pass-12'], routes: [R('home', '/home'), R('batch', '/batch'), R('students', '/students'), R('board', '/board'), R('scoreboards', '/scoreboards'), R('newbatch', '/newbatch'), R('requests', '/requests')] },
  natvar: { login: ['natvar', 'natvar-pass-1'], routes: [R('home', '/home'), R('my-devotees', '/my-devotees'), R('my-devotees-student', '/my-devotees/6000000011'), R('my-devotees-week', `/my-devotees/6000000011/${LW}`),
    R('explorer', '/explorer'), R('scoreboards', '/scoreboards'), R('card', '/card'), R('account', '/account')] },
  trainee: { login: ['6000000092', 'trd-pass-12'], setup: 'trainee', routes: [R('home', '/home'), R('card', '/card'), R('scoreboards', '/scoreboards'), R('week', '/week')] },
  ftp: { login: ['ftpco', 'ftp-pass-456'], setup: 'ftp', routes: [R('home', '/home'), R('fac-team', '/fac-team'), R('scoreboards', '/scoreboards')] },
  master: { login: ['master', 'master-pass-1'], routes: [
    R('home', '/home'), R('overview', '/overview'), R('analysis', '/analysis'), R('reports', '/reports'), R('members', '/members'), R('leaders', '/leaders'), R('coordinators', '/coordinators'),
    R('access', '/access'), R('facilitators', '/facilitators'), R('phases', '/phases'), R('batches', '/batches'), R('scoreboards', '/scoreboards'), R('ids', '/ids'), R('requests', '/requests'),
    R('requests-reopen', '/requests?type=reopen'), R('activity', '/activity'), R('settings', '/settings'), R('leaderboard', '/leaderboard'), R('batch', '/batch'), R('stats', '/stats'),
    R('board', '/board'), R('ready', '/ready'), R('students', '/students'), R('closing', '/closing'), R('newbatch', '/newbatch'), R('devotee', '/devotee/6000000011'),
    R('devotee-week', `/devotee/6000000011/week/${LW}`), R('fill-week', `/fill/6000000011/week/${W}?n=Aarav%20Gupta`), R('wall', '/wall'), R('account', '/account'), R('card', '/card')] },
};

const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--js-flags=--max-old-space-size=512'], protocolTimeout: 60000 });
let browser = await launch();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function newPage(width) {
  if (!browser.connected) browser = await launch();
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const h = width >= 1024 ? 900 : width >= 768 ? 1024 : 800;
  await page.setViewport({ width, height: h, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    const b = new EventTarget(); b.level = 1; b.charging = true; b.chargingTime = 0; b.dischargingTime = Infinity;
    try { Object.defineProperty(Navigator.prototype, 'getBattery', { get: () => () => Promise.resolve(b), configurable: true }); } catch { /* */ }
    const c = new EventTarget(); c.effectiveType = '4g'; c.rtt = 50; c.downlink = 10; c.saveData = false;
    try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch { /* */ }
    try { localStorage.setItem('sr.theme', 'light'); } catch { /* */ }
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }]);
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error ' + m.text().slice(0, 200)); });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(60); });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  return { ctx, page, errs, h };
}
async function login(page, l, p) {
  await page.evaluate(() => { location.hash = '/login'; });
  await page.waitForSelector('#login', { timeout: 10000 });
  await page.$eval('#login', (e) => { e.value = ''; }); await page.$eval('#password', (e) => { e.value = ''; });
  await page.type('#login', l); await page.type('#password', p);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 10000 });
  await sleep(600);
}
const callApi = (page, action, data) => page.evaluate(async (a, d) => { const { call } = await import('/src/lib/api.js'); try { return { ok: true, r: await call(a, d) }; } catch (e) { return { ok: false, e: String(e?.message || e) }; } }, action, data);
const logout = (page) => page.evaluate(async () => { try { await (await import('/src/lib/session.svelte.js')).logout(); } catch { /* */ } });

async function setup(page, kind) {
  if (kind === 'trainee') {
    await login(page, 'master', 'master-pass-1');
    const r = await callApi(page, 'enrol.add', { batchId: 'ETP-21', login: '6000000092' });
    if (!r.ok) log('trainee setup failed', r.e);
    await logout(page); await sleep(700);
  }
  if (kind === 'ftp') {
    await login(page, 'master', 'master-pass-1');
    const r = await callApi(page, 'coordinators.create', { username: 'ftpco', name: 'Madhavi Devi', batchIds: [], tempPassword: 'ftp-pass-123', ftp: true });
    if (!r.ok) log('ftp setup failed', r.e);
    await logout(page); await sleep(700);
    await login(page, 'ftpco', 'ftp-pass-123');
    const c = await callApi(page, 'auth.changePassword', { current: 'ftp-pass-123', new: 'ftp-pass-456' });
    if (!c.ok) log('ftp change failed', c.e);
    await logout(page); await sleep(700);
  }
}
async function go(page, hash, signedIn) {
  const bare = hash.split('?')[0];
  await page.evaluate((h) => { location.hash = h; }, hash);
  if (signedIn) await page.waitForFunction((p) => document.querySelector('main#main')?.dataset.path === p || !!document.querySelector('main#main') && location.hash.split('?')[0] !== '#' + p, { timeout: 10000 }, bare).catch(() => log('no data-path', hash));
  await sleep(250);
  // the page's data: wait for skeletons and "Loading…" to go
  await page.waitForFunction(() => !document.querySelector('main .sk, main .skw, main [aria-busy="true"]') && !/Loading…/.test(document.querySelector('main')?.textContent || ''), { timeout: 8000, polling: 100 }).catch(() => {});
  await page.waitForFunction(() => !document.activeViewTransition, { timeout: 3000, polling: 50 }).catch(() => {});
  await sleep(450);
}
async function setThemeIn(page, t) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: t }]);
  await page.evaluate(async (t) => { const m = await import('/src/lib/theme.js'); m.setTheme(t); }, t);
  await sleep(320);
}
async function fullShot(page, file, h, width) {
  const docH = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const H = Math.min(Math.max(docH, h), 14000);
  if (H > h) { await page.setViewport({ width, height: H, deviceScaleFactor: 1 }); await sleep(250); }
  await page.screenshot({ path: file, captureBeyondViewport: false });
  if (H > h) { await page.setViewport({ width, height: h, deviceScaleFactor: 1 }); await sleep(120); }
  return { docH, cappedAt: docH > 14000 ? 14000 : 0 };
}

const summary = [];
for (const role of (want.length ? want : Object.keys(ROLES))) {
  const cfg = ROLES[role];
  for (const width of WIDTHS) {
    let P;
    try {
      P = await newPage(width);
      const { page, errs, h } = P;
      if (cfg.setup) await setup(page, cfg.setup);
      if (cfg.login) await login(page, ...cfg.login);
      if (mode === 'states-offline') { /* not used */ }
      let offline = false;
      for (const r of cfg.routes) {
        const tag = mode === 'shots' ? '' : '';
        for (const variant of (mode === 'states' ? ['loading', 'offline'] : [''])) {
          if (variant) continue;   // states handled below
        }
        if (mode === 'shots') try {
          await go(page, r.hash, !!cfg.login);
          for (const theme of THEMES) {
            await setThemeIn(page, theme);
            const name = `${r.key}-${role}-${width}-${theme}`;
            const e0 = errs.length;
            let sw = null;
            // our own sweep source (scripts/sweep.js), run inside the page: no outside input
            try { sw = await page.evaluate(`(${SWEEP_SRC})({ inventory: ${theme === 'light' && (width === 390 || width === 1440)} })`); }
            catch (e) { sw = { error: String(e.message).slice(0, 200) }; }
            const shot = await fullShot(page, `${SHOTS}/${name}.png`, h, width);
            const actual = await page.evaluate(() => location.hash);
            fs.writeFileSync(`${DATA}/${name}.json`, JSON.stringify({ name, role, route: r.key, hash: r.hash, actualHash: actual, width, theme, ...shot, errors: errs.slice(e0), sweep: sw }));
            summary.push(name);
          }
        } catch (e) { log('ROUTE ERROR', role, width, r.key, String(e.message).slice(0, 120)); }
      }
      if (mode === 'states') {
        // loading: a slow network from here on; each route's first visit shows its loading state
        await setThemeIn(page, 'light');
        await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(7000); });
        for (const r of cfg.routes) {
          if (r.key === 'home' && cfg.login) continue;
          await page.evaluate((x) => { location.hash = x; }, r.hash);
          await sleep(650);
          const name = `${r.key}-${role}-${width}-light-loading`;
          await page.screenshot({ path: `${SHOTS}/${name}.png` });
          summary.push(name);
        }
      }
    } catch (e) { log('ERROR', role, width, String(e.message).slice(0, 200)); }
    finally { if (P) await P.ctx.close().catch(() => {}); }
    if (mode === 'states') {
      // offline (the mock's switch): a fresh sign-in, then no connection; every route visited for the first time
      let Q;
      try {
        Q = await newPage(width);
        const { page, errs, h } = Q;
        if (cfg.setup) await setup(page, cfg.setup);
        if (cfg.login) await login(page, ...cfg.login);
        await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setOffline(true); });
        for (const r of cfg.routes) {
          if (r.key === 'home' && cfg.login) continue;
          await page.evaluate((x) => { location.hash = x; }, r.hash);
          await sleep(1800);
          const name = `${r.key}-${role}-${width}-light-offline`;
          let sw = null;
          try { sw = await page.evaluate(`(${SWEEP_SRC})({ inventory: false })`); } catch (e) { sw = { error: String(e.message).slice(0, 200) }; }
          const shot = await fullShot(page, `${SHOTS}/${name}.png`, h, width);
          fs.writeFileSync(`${DATA}/${name}.json`, JSON.stringify({ name, role, route: r.key, hash: r.hash, width, theme: 'light', state: 'offline', ...shot, sweep: sw }));
          summary.push(name);
        }
      } catch (e) { log('ERROR offline', role, width, String(e.message).slice(0, 200)); }
      finally { if (Q) await Q.ctx.close().catch(() => {}); }
    }
    log('done', mode, role, width, summary.length);
  }
}
log('finished', summary.length);
await Promise.race([browser.close().catch(() => {}), sleep(5000)]);
try { browser.process()?.kill('SIGKILL'); } catch { /* gone */ }
process.exit(0);
