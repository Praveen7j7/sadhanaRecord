import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json');
const puppeteer = require('puppeteer-core');
const dir = '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/public/';
const logo = 'data:image/png;base64,' + fs.readFileSync(new URL('../../brand/iyf-logo-full-3540x1120.png', import.meta.url)).toString('base64');
const em = 'data:image/png;base64,' + fs.readFileSync(new URL('../../brand/emblem/iyf-emblem-892.png', import.meta.url)).toString('base64');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
// link preview (WhatsApp, Telegram, Facebook, X): 1200 x 630, the official logo as it is, never stretched
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@500;600&display=block" rel="stylesheet"></head>
<body style="margin:0;width:1200px;height:630px;background:radial-gradient(120% 100% at 20% 0%,#5a3a9e 0%,#3b2270 45%,#1d1238 100%);font-family:Inter,system-ui,sans-serif;color:#fff;display:grid;place-items:center;overflow:hidden">
<div style="display:grid;justify-items:center;gap:30px;text-align:center">
  <img src="${logo}" style="width:708px;height:224px;object-fit:contain;filter:drop-shadow(0 14px 28px rgba(0,0,0,.35))">
  <div style="width:220px;height:2px;background:linear-gradient(90deg,transparent,#e3c47a,transparent)"></div>
  <div style="font-family:Fraunces,Georgia,serif;font-size:76px;font-weight:600;letter-spacing:.005em;line-height:1">Sadhana Record</div>
  <div style="font-size:28px;font-weight:500;color:#e3c47a;letter-spacing:.02em">Fill your daily sadhana · see your progress · stay with your batch</div>
</div></body></html>`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 300));
await p.screenshot({ path: dir + 'brand/og-image.jpg', type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1200, height: 630 } });
// browser-tab icons: the round emblem alone (transparent corners), and the iPhone home-screen tile
for (const [name, s] of [['brand/favicon-32.png', 32], ['brand/favicon-48.png', 48], ['brand/favicon-192.png', 192]]) {
  await p.setViewport({ width: s, height: s, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent"><img src="${em}" style="width:${s}px;height:${s}px;display:block"></body></html>`);
  await new Promise((r) => setTimeout(r, 150));
  await p.screenshot({ path: dir + name, omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
}
await p.setViewport({ width: 180, height: 180, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0"><div style="width:180px;height:180px;background:radial-gradient(120% 90% at 30% 15%,#6a46b3,#3b2270 70%);display:grid;place-items:center"><img src="${em}" style="width:140px;height:140px;filter:drop-shadow(0 4px 7px rgba(0,0,0,.35))"></div></body></html>`);
await new Promise((r) => setTimeout(r, 150));
await p.screenshot({ path: dir + 'brand/apple-touch-icon.png', clip: { x: 0, y: 0, width: 180, height: 180 } });
await b.close(); console.log('ok');
