// Headless-Chrome screenshots of every main screen against the mock (dev server, no VITE_API_URL).
//   node scripts/shots.mjs            (starts nothing: run `npx vite --port 5199` first)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:5199';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });
const CONFIGS = [
  ['360-dark', 360, 'dark'], ['360-light', 360, 'light'], ['768', 768, 'dark'], ['1280', 1280, 'light'],
];
const only = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });

async function fresh(width, scheme) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: width >= 1024 ? 900 : 800, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  return page;
}
async function boot(page) {
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
}
async function login(page, l, p) {
  await page.type('#login', l); await page.type('#password', p);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 5000 });
  await sleep(300);
}
async function go(page, hash, wait = 400) { await page.evaluate((h) => { location.hash = h; }, hash); await sleep(wait); }
async function drawer(page, name) {
  const b = await page.$('.menu-btn');
  if (b && await b.isVisible()) { await b.click(); await sleep(300); await page.screenshot({ path: `${OUT}/${name}.png` }); await page.keyboard.press('Escape'); await sleep(200); }
}
async function shot(page, name, full = true) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); }

// a devotee with a submitted week (5-11 Oct) and a part-filled Monday of the next week
async function seed(page) {
  await page.evaluate(async () => {
    const m = await import('/src/lib/mock.js');
    const call = async (token, action, data) => { const r = await m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r.error)); return r.data; };
    const t = (await call(undefined, 'auth.login', { login: '6000000001', password: 'pass-12345' })).token;
    m.setNow('2026-10-11T19:00:00+05:30');
    const times = [['22:05', '04:35'], ['22:20', '04:50'], ['22:40', '05:10'], ['23:20', '05:40'], ['22:10', '04:30'], ['22:00', '04:40'], ['22:30', '04:55']];
    for (let i = 0; i < 7; i++) {
      const date = '2026-10-' + String(5 + i).padStart(2, '0');
      await call(t, 'week.saveDay', { weekId: '2026-10-05', date, version: 0, day: { sleptAt: times[i][0], wokeAt: times[i][1], rounds: 16, chantingDoneAt: i % 2 ? '08:10' : '07:00', chantingSameDay: true, dayRestMin: 20 + i * 10, hearingMin: 20 + i * 4, hearing: [{ text: 'Bhagavatam class' }], readingMin: 15 + i * 3, reading: { text: 'Bhagavad-gita As It Is' }, serviceMin: 60 } });
    }
    await call(t, 'week.saveWeekEnd', { weekId: '2026-10-05', version: 0, nightStay: 'YES', principles: 'YES' });
    await call(t, 'week.setAttendance', { weekId: '2026-10-05', mark: 'P' });
    await call(t, 'week.submit', { weekId: '2026-10-05' });
    m.setNow('2026-10-13T10:00:00+05:30');   // Tuesday of the next week
    await call(t, 'week.saveDay', { weekId: '2026-10-12', date: '2026-10-12', version: 0, day: { sleptAt: '22:15', wokeAt: '04:45', rounds: 16, chantingDoneAt: '07:10', chantingSameDay: true, dayRestMin: 30, hearingMin: 30, hearing: [{ text: 'SPL lecture' }], readingMin: 20, reading: { text: 'Own book' }, serviceMin: 90 } });
    await call(t, 'week.saveDay', { weekId: '2026-10-12', date: '2026-10-13', version: 0, day: { rounds: 12, sleptAt: '22:30' } });
  });
}

for (const [name, width, scheme] of CONFIGS) {
  if (only && only !== name) continue;
  // ---- devotee ----
  let page = await fresh(width, scheme);
  await boot(page);
  await shot(page, `${name}-login`);
  await page.goto(BASE + '/#/signup', { waitUntil: 'networkidle0' }); await sleep(300);
  await shot(page, `${name}-signup`);
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await boot(page);
  await seed(page);
  await login(page, '6000000001', 'pass-12345');
  await shot(page, `${name}-home`);
  await go(page, '#/day/2026-10-12/2026-10-13', 1500);
  await shot(page, `${name}-day`);
  await page.screenshot({ path: `${OUT}/${name}-day-viewport.png` });
  await page.click('#f-wokeAt-btn'); await sleep(300);
  await page.screenshot({ path: `${OUT}/${name}-timepicker.png` });
  await page.keyboard.press('Escape'); await sleep(200);
  await go(page, '#/week', 700);
  await shot(page, `${name}-week`);
  await go(page, '#/report', 800);
  await page.evaluate(() => { [...document.querySelectorAll('button.cal-d')].find((b) => b.getAttribute('aria-label')?.startsWith('07 Oct'))?.click(); });
  await sleep(500);
  await shot(page, `${name}-report-day`);
  await page.evaluate(() => { [...document.querySelectorAll('.seg button')].find((b) => b.textContent === 'Weekly')?.click(); });
  await sleep(300);
  await page.evaluate(() => { [...document.querySelectorAll('button.action')].find((b) => b.textContent.includes('%'))?.click(); });
  await sleep(500);
  await shot(page, `${name}-report-week`);
  await go(page, '#/hearing', 800);
  await shot(page, `${name}-hearing`);
  await go(page, '#/history', 600);
  await shot(page, `${name}-history`);
  await go(page, '#/wall', 900);
  await shot(page, `${name}-wall-devotee`);
  await go(page, '#/account', 500);
  await shot(page, `${name}-account`);
  await page.close();

  // ---- coordinator and master ----
  page = await fresh(width, scheme);
  await boot(page);
  await login(page, 'sps', 'sps-pass-12');
  await shot(page, `${name}-coordinator-home`);
  await go(page, '#/requests', 800);
  await shot(page, `${name}-coordinator-requests`);
  await drawer(page, `${name}-coordinator-drawer`);
  await go(page, '#/wall', 900);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('New announcement'))?.click());
  await sleep(300);
  await shot(page, `${name}-wall-coordinator`);
  await page.close();
  page = await fresh(width, scheme);
  await boot(page);
  await login(page, 'meera', 'meera-pass-1');
  await shot(page, `${name}-mixed-home`);
  await drawer(page, `${name}-mixed-drawer`);
  await page.close();
  page = await fresh(width, scheme);
  await boot(page);
  await login(page, 'master', 'master-pass-1');
  await shot(page, `${name}-master-home`);
  await drawer(page, `${name}-master-drawer`);
  await go(page, '#/coordinators', 900);
  await shot(page, `${name}-master-admin`);
  await go(page, '#/batches', 700);
  await shot(page, `${name}-master-batches`);
  await page.close();
}
await browser.close();
console.log(JSON.stringify([...new Set(errs)], null, 1));
