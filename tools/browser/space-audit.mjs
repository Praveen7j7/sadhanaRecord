// Space audit (the head, 10 Oct 2026: "the screen should be optimally used … minimise the empty space … on all the
// routes"). For every login and every route its menu offers, at desktop widths: how many screens tall the page is, how
// much of the content area holds something, and how empty its right third is. A page that is tall AND leaves the right
// side empty is laid out as one narrow column where the width would let it sit side by side.
//   BASE=http://localhost:5195 node tools/browser/space-audit.mjs [width…]      → table + space-audit.json (in OUT)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const puppeteer = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json')('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:5195', OUT = process.env.OUT || '.';
const WIDTHS = process.argv.slice(2).map(Number).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOGINS = [['devotee', '6000000001', 'pass-12345'], ['coordinator', 'sps', 'sps-pass-12'], ['head', 'master', 'master-pass-1'], ['facilitator', 'natvar', 'natvar-pass-1']];

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const rows = [];
for (const w of WIDTHS.length ? WIDTHS : [1440, 1280]) for (const [role, login, pw] of LOGINS) {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: w, height: w >= 1440 ? 900 : 800 });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => (await import('/src/lib/mock.js')).setLatency(10));
  await page.type('#login', login); await page.type('#password', pw); await page.click('button[type=submit]');
  await page.waitForFunction(() => location.hash.startsWith('#/home'), { timeout: 10000 }); await sleep(1500);
  // the routes this login's menu offers, plus the deeper screens one tap away
  const routes = await page.evaluate(() => [...new Set([...document.querySelectorAll('aside a[href^="#/"], nav a[href^="#/"], .side a[href^="#/"]')].map((a) => a.getAttribute('href').split('?')[0]))]);
  const deep = { devotee: ['#/week', '#/report', '#/history', '#/hearing', '#/reading', '#/wall', '#/account', '#/group'], coordinator: ['#/batch', '#/members', '#/leaders', '#/stats', '#/requests', '#/devotee/6000000001', '#/wall', '#/account'], head: ['#/overview', '#/devotees', '#/coordinators', '#/facilitators', '#/batches', '#/ids', '#/activity', '#/settings', '#/reopens', '#/groups', '#/wall'], facilitator: ['#/my-devotees', '#/wall', '#/account'] }[role];
  for (const r of [...new Set([...routes, ...deep])]) {
    if (/logout|signout/.test(r)) continue;
    await page.evaluate((h) => { location.hash = h; }, r); await sleep(1400);
    if ((await page.evaluate(() => location.hash)).startsWith('#/login')) continue;
    const m = await page.evaluate(() => {
      const box = (document.querySelector('.content') || document.querySelector('main') || document.body).getBoundingClientRect();
      const top = box.top + scrollY, H = Math.max(document.documentElement.scrollHeight - top, 1), W = box.width;
      const COLS = 24, CELL = 40, ROWS = Math.ceil(H / CELL), grid = new Uint8Array(COLS * ROWS);
      const visible = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
      const painted = (el) => {
        const s = getComputedStyle(el);
        if (/^(IMG|SVG|INPUT|BUTTON|SELECT|TEXTAREA|CANVAS|VIDEO|PICTURE)$/i.test(el.tagName)) return true;
        if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') return true;
        if (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') return true;
        return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      };
      const content = document.querySelector('.content') || document.body;
      for (const el of content.querySelectorAll('*')) {
        if (!visible(el) || !painted(el) || el.closest('dialog:not([open])')) continue;
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        // a text element counts for the width of its text, not its whole (block) box
        let left = r.left, right = r.right;
        if (![...el.children].length && el.firstChild?.nodeType === 3) { const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); if (t.width) { left = t.left; right = t.right; } }
        const c0 = Math.max(0, Math.floor(((left - box.left) / W) * COLS)), c1 = Math.min(COLS - 1, Math.floor(((right - box.left - 1) / W) * COLS));
        const r0 = Math.max(0, Math.floor((r.top + scrollY - top) / CELL)), r1 = Math.min(ROWS - 1, Math.floor((r.bottom + scrollY - top - 1) / CELL));
        for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) grid[y * COLS + x] = 1;
      }
      // rows that hold anything at all (the page's real height), and how much of each such row is used
      let used = 0, rowsWith = 0, right = 0;
      for (let y = 0; y < ROWS; y++) {
        let n = 0, nr = 0; for (let x = 0; x < COLS; x++) { if (grid[y * COLS + x]) { n++; if (x >= COLS * 2 / 3) nr++; } }
        if (n) { rowsWith++; used += n / COLS; right += nr / (COLS / 3); }
      }
      // overlaps: two side-by-side parts of a layout (children of a grid or flex box) covering each other
      const over = [];
      for (const c of content.querySelectorAll('*')) {
        const d = getComputedStyle(c).display; if (!/grid|flex/.test(d) || !visible(c)) continue;
        const kids = [...c.children].filter((k) => visible(k) && !/absolute|fixed/.test(getComputedStyle(k).position) && k.tagName !== 'DIALOG').map((k) => [k, k.getBoundingClientRect()]).filter(([, r]) => r.width > 2 && r.height > 2);
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
          const [a, A] = kids[i], [b, B] = kids[j];
          const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
          if (ox > 4 && oy > 4) over.push(`${a.tagName.toLowerCase()}.${[...a.classList].slice(0, 2).join('.')} × ${b.tagName.toLowerCase()}.${[...b.classList].slice(0, 2).join('.')}`);
        }
      }
      return { overlaps: over.length, overlapFirst: over[0] || '', screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1), fill: Math.round((used / Math.max(rowsWith, 1)) * 100), rightThird: Math.round((right / Math.max(rowsWith, 1)) * 100), w: Math.round(W), title: document.querySelector('.pagetitle, h1')?.textContent?.trim() || '' };
    });
    rows.push({ width: w, role, route: r, ...m });
  }
  await page.close();
}
await browser.close();
// tall and narrow first: the pages where a side-by-side layout would save the most scrolling
const score = (x) => (x.screens - 1) * (100 - x.rightThird);
rows.sort((a, b) => score(b) - score(a));
console.log('width role         route                         screens  fill%  right⅓%  content px  overlaps');
for (const x of rows) console.log(`${x.width}  ${x.role.padEnd(12)} ${x.route.padEnd(30)} ${String(x.screens).padStart(6)}  ${String(x.fill).padStart(5)}  ${String(x.rightThird).padStart(7)}  ${x.w}  ${x.overlaps ? x.overlaps + ' ' + x.overlapFirst : ''}`);
writeFileSync(`${OUT}/space-audit.json`, JSON.stringify(rows, null, 1));
