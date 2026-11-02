import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url).pathname);
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await p.goto('https://sadhana-record.iyfdelhi-sadhana.workers.dev/#/welcome', { waitUntil: 'networkidle0' });
await p.evaluate(() => navigator.serviceWorker.ready); await sleep(4000);       // let the offline copy finish
await p.setOfflineMode(true);
await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500);
const r = await p.evaluate(() => [...document.querySelectorAll('img.lk-emblem, img.brand-emblem')].map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth })));
console.log('offline emblem:', JSON.stringify(r));
await p.screenshot({ path: 'offline-welcome.png' });
await b.close();
