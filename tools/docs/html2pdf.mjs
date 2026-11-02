import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json');
const puppeteer = require('puppeteer-core');
const [, , inp, out] = process.argv;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('file://' + inp, { waitUntil: 'networkidle0' });
await p.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:7.5pt;color:#8a82a0;padding:0 15mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>${process.argv[4] || "Sadhana Record · IYF Delhi"}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '14mm', bottom: '16mm', left: '15mm', right: '15mm' } });
await b.close(); console.log('pdf ok');
