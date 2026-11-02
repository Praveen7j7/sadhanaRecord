import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url).pathname);
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
for (const [login, pw] of [['sps', 'sps-pass-12'], ['master', 'master-pass-1'], ['6000000001', 'pass-12345']]) {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage();   // each person in a fresh profile (no sign-in carried over)
  await p.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:5199/#/login', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => !document.getElementById('splash'), { timeout: 6000 }).catch(() => {});
  await p.type('#login', login); await p.type('#password', pw); await p.click('button[type=submit]');
  await p.waitForFunction(() => !location.hash.includes('login'), { timeout: 8000 }).catch(() => {}); await sleep(800);
  await p.click('.menu-btn'); await sleep(500);
  const r = await p.evaluate(() => { const d = document.querySelector('dialog.drawer'); const w = d.clientWidth; const over = [...d.querySelectorAll('.drawer-in *')].filter((e) => e.getBoundingClientRect().right > d.getBoundingClientRect().right + 1).length; return { w, sw: d.scrollWidth, over }; });
  console.log(login, JSON.stringify(r));
  if (login === 'sps') await p.screenshot({ path: 'drawer-sps.png' });
  await ctx.close();
}
await b.close();
