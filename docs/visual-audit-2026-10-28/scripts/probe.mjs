import { createRequire } from 'node:module';
const ROOT = '/private/tmp/claude-501/-Users-maclapctp409-Downloads-hpStuff-prompt/bfb96117-1af2-4f66-95d5-4bbb86028c04/scratchpad/visual-audit';
const require = createRequire(ROOT + '/tree/frontend/package.json');
const puppeteer = require('puppeteer-core');
const b = await puppeteer.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell', headless: true, args: ['--no-sandbox'] });
const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
await p.goto('http://127.0.0.1:5671/#/login', { waitUntil: 'networkidle0' });
for (const w of [390, 768, 1024, 1440]) {
  await p.setViewport({ width: w, height: 900 }); await new Promise((r) => setTimeout(r, 200));
  console.log(w, await p.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--gutter', '--content-max', '--nav-space'].map((k) => k + '=' + s.getPropertyValue(k).trim()).join(' '); }));
}
await ctx.close(); await b.close();
