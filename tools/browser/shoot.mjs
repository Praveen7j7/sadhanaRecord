// Small JPEG screenshots for the revamp (before / after). Usage: node shoot.mjs <prefix> [filter]
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url).pathname);
const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:5199';
const OUT = process.env.OUT || new URL('../../frontend/screenshots', import.meta.url).pathname;   // this tree's own folder
const prefix = process.argv[2] || 'revamp-after';
const filter = process.argv[3] || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });

async function fresh(width, scheme) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: width >= 1024 ? 860 : 820, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on('pageerror', (e) => errs.push(`[${width} ${scheme}] PAGEERR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`[${width} ${scheme}] console ${m.text()}`); });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 5000 }).catch(() => {});
  return page;
}
async function login(page, l, p) {
  await page.type('#login', l); await page.type('#password', p);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 8000 });
  await sleep(700);
}
/*
 * Moves to a screen and waits until it shows REAL content (22 Oct 2026, G20): no loading placeholder (.sk, .skw,
 * .sk-block) left in <main> and some text in it. A fixed 700 ms sleep shot 12 screens as skeletons on a busy machine
 * (coord-stats, coord-leaders, master-activity, master-settings, guru-home …), and their review rows were then about
 * the placeholder. A short settle after that lets a transition or a painting finish; a screen still loading after
 * 15 s is shot anyway and named in the output, so nothing waits for ever and nothing is silently a skeleton.
 */
async function go(page, hash, settle = 250) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  const ready = await page.waitForFunction((want) => location.hash.split('?')[0] === want.split('?')[0]
      && document.querySelector('main') && !document.querySelector('main .sk, main .skw, main .sk-block')
      && (document.querySelector('main').innerText || '').trim().length > 20,
    { timeout: 15000, polling: 50 }, hash).then(() => true, () => false);
  if (!ready) console.log(`still loading after 15 s, shot as it is: ${hash}`);
  await sleep(Math.min(settle, 400));
}
async function shot(page, name, full = false) {
  if (filter && !name.includes(filter)) return;
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.jpg`, type: 'jpeg', quality: 72, fullPage: full, captureBeyondViewport: false });
}
async function drawer(page, name) {
  const b = await page.$('.menu-btn');
  if (b && await b.isVisible()) { await b.click(); await sleep(450); await shot(page, name); await page.keyboard.press('Escape'); await sleep(300); }
}

const SETS = process.env.SETS ? process.env.SETS.split(',').map((x) => { const [w, s] = x.split('-'); return [+w, s]; }) : [[390, 'light'], [390, 'dark'], [820, 'light'], [1280, 'light'], [1280, 'dark'], [1920, 'light']];
for (const [w, s] of SETS) {
  const tag = `${w}-${s}`;
  // splash (before any script) and the welcome screen
  {
    const ctx = await browser.createBrowserContext(); const sp = await ctx.newPage();
    await sp.setViewport({ width: w, height: w >= 1024 ? 860 : 820 });
    await sp.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: s }]);
    await sp.setJavaScriptEnabled(false);
    await sp.goto(BASE + '/', { waitUntil: 'load' }); await sleep(300);
    await shot(sp, `${tag}-splash`);
    await sp.close(); await ctx.close();
  }
  let p = await fresh(w, s);
  await go(p, '#/welcome', 700); await shot(p, `${tag}-welcome`);
  await go(p, '#/login', 500);
  await shot(p, `${tag}-login`);
  if (w === 390) { await go(p, '#/signup'); await shot(p, `${tag}-signup`); await go(p, '#/forgot'); await shot(p, `${tag}-forgot`); await go(p, '#/login'); }
  // devotee
  await login(p, '6000000001', 'pass-12345');
  await p.waitForSelector('.qc', { timeout: 15000 }).catch(() => {});
  await sleep(500);
  await shot(p, `${tag}-devotee-home`);
  if (w === 390 && s === 'light') await shot(p, `${tag}-devotee-home-full`, true);
  await drawer(p, `${tag}-devotee-drawer`);
  if (w === 390 || w === 1280) {
    const wk = await p.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.endsWith('|home.get')))).data.weeks.at(-1));
    const day = wk.days.filter((d) => !d.future).at(-1).date;
    await go(p, `#/week/${wk.weekId}`, 900); await shot(p, `${tag}-week`);
    await go(p, `#/day/${wk.weekId}/${day}`, 1200); await shot(p, `${tag}-day`);
    await go(p, '#/report', 1000); await shot(p, `${tag}-report`);
    await go(p, '#/hearing', 900); await shot(p, `${tag}-hearing`);
    await go(p, '#/reading', 900); await shot(p, `${tag}-reading`);
    await go(p, '#/wall', 900); await shot(p, `${tag}-wall`);
    await go(p, '#/account', 1200); await shot(p, `${tag}-account`);
    await go(p, '#/history', 900); await shot(p, `${tag}-history`);
  }
  await p.close();
  // coordinator
  p = await fresh(w, s);
  await login(p, 'sps', 'sps-pass-12');
  await sleep(600);
  await shot(p, `${tag}-coord-home`);
  await drawer(p, `${tag}-coord-drawer`);
  await go(p, '#/batch', 1200); await shot(p, `${tag}-coord-board`);
  if (w === 390 || w === 1280) {
    await go(p, '#/stats', 1000); await shot(p, `${tag}-coord-stats`);
    await go(p, '#/leaders', 900); await shot(p, `${tag}-coord-leaders`);
    await go(p, '#/requests', 1000); await shot(p, `${tag}-coord-requests`);
    await go(p, '#/devotee/6000000011', 1200); await shot(p, `${tag}-coord-devotee`);
    await go(p, '#/fill/6000000013/week/' + (await p.evaluate(() => { const ist = new Date(Date.now() + 5.5 * 3600e3); ist.setUTCDate(ist.getUTCDate() - ((ist.getUTCDay() + 6) % 7)); return ist.toISOString().slice(0, 10); })) + '?n=Chetan%20Arora', 1300); await shot(p, `${tag}-coord-onbehalf`);
  }
  await p.close();
  // master
  p = await fresh(w, s);
  await login(p, 'master', 'master-pass-1');
  await sleep(600);
  await shot(p, `${tag}-master-home`);
  await drawer(p, `${tag}-master-drawer`);
  await go(p, '#/overview', 1200); await shot(p, `${tag}-master-overview`);
  await go(p, '#/coordinators', 1000); await shot(p, `${tag}-master-coordinators`);
  if (w === 390 || w === 1280) {
    await go(p, '#/batches', 1000); await shot(p, `${tag}-master-batches`);
    await go(p, '#/ids', 800); await shot(p, `${tag}-master-ids`);
    await go(p, '#/reopens', 900); await shot(p, `${tag}-master-reopens`);
    await go(p, '#/activity', 1000); await shot(p, `${tag}-master-activity`);
    await go(p, '#/settings', 1000); await shot(p, `${tag}-master-settings`);
  }
  await p.close();
  // devotee + master
  p = await fresh(w, s);
  await login(p, 'guru', 'guru-pass-12');
  await sleep(800);
  await shot(p, `${tag}-guru-home`);
  await drawer(p, `${tag}-guru-drawer`);
  await p.close();
  // mixed devotee + coordinator
  p = await fresh(w, s);
  await login(p, 'meera', 'meera-pass-1');
  await sleep(800);
  await shot(p, `${tag}-mixed-home`);
  if (w === 390) await shot(p, `${tag}-mixed-home-full`, true);
  await drawer(p, `${tag}-mixed-drawer`);
  await p.close();
}
await browser.close();
console.log('errors:', errs.length ? [...new Set(errs)].join('\n') : 'none');
