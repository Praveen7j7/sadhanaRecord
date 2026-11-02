import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json');
const puppeteer = require('puppeteer-core');
const dir = '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/public/';
const em = 'data:image/png;base64,' + fs.readFileSync(new URL('../../brand/emblem/iyf-emblem-892.png', import.meta.url)).toString('base64');
const tile = (s, mask) => `<div style="width:${s}px;height:${s}px;${mask ? '' : `border-radius:${s * 0.22}px;`}background:radial-gradient(120% 90% at 30% 15%,#6a46b3,#3b2270 70%);display:grid;place-items:center;${mask ? '' : `box-shadow:inset 0 0 0 ${Math.max(2, s * 0.012)}px rgba(227,196,122,.55);`}"><img src="${em}" style="width:${s * (mask ? 0.62 : 0.8)}px;height:${s * (mask ? 0.62 : 0.8)}px;filter:drop-shadow(0 ${s * 0.02}px ${s * 0.04}px rgba(0,0,0,.35))"></div>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
for (const [name, size, mask] of [['icons/icon-192.png', 192, false], ['icons/icon-512.png', 512, false], ['icons/maskable-192.png', 192, true], ['icons/maskable-512.png', 512, true], ['/tmp/icon-preview.png', 256, false]]) {
  await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent">${tile(size, mask)}</body></html>`);
  await new Promise((r) => setTimeout(r, 200));
  await p.screenshot({ path: name === '/tmp/icon-preview.png' ? name : dir + name, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await b.close(); console.log('ok');
