// Phase 5 checks: the shared Sheet, Row and Status in a real browser, at every layout width, light and dark, and the
// three look tiers. Against a vite dev server in mock mode (no Cloudflare quota). Kept apart from verify.mjs so the
// phases' check files never collide. Usage: BASE=http://localhost:5298 node components.mjs [sheets|dismiss|rows|tiers]
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url).pathname);
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:5199';
const OUT = process.env.OUT || new URL('../../frontend/screenshots', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || '';
const results = [], errs = [];
const ok = (cond, msg) => { results.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) console.log('FAIL', msg); };
const browser = await puppeteer.launch({ executablePath: (process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: true, args: ['--no-sandbox'] });
const shot = (page, name) => page.screenshot({ path: `${OUT}/phase5-${name}.png` });

// the same device emulation as verify.mjs › tiers: what the tier code reads, nothing more
const DESKTOP = { mem: 8, cores: 8, coarse: false, net: { effectiveType: '4g', rtt: 50, saveData: false }, battery: { level: 1, charging: true } };
const ANDROID_MID_3G = { mem: 4, cores: 8, coarse: true, net: { effectiveType: '3g', rtt: 400, saveData: false }, battery: { level: 0.7, charging: false } };   // balanced (on fast 4G it is high)
const ANDROID_LOW = { mem: 2, cores: 4, coarse: true, net: { effectiveType: '4g', rtt: 100, saveData: false }, battery: { level: 0.7, charging: false } };

async function page_(width, { height = 0, env = null, theme = '', reduce = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: height || (width >= 1024 ? 900 : 800), deviceScaleFactor: 1 });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const tag = `[${width}${height ? 'x' + height : ''}]`;
  page.on('pageerror', (e) => errs.push(`${tag} PAGEERR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} console.error ${m.text()}`); });
  if (env) await page.evaluateOnNewDocument((env) => {
    const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch { /* fixed */ } };
    def(Navigator.prototype, 'deviceMemory', env.mem); def(Navigator.prototype, 'hardwareConcurrency', env.cores);
    const c = new EventTarget(); Object.assign(c, env.net); def(Navigator.prototype, 'connection', c);
    const b = new EventTarget(); Object.assign(b, env.battery); def(Navigator.prototype, 'getBattery', () => Promise.resolve(b));
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q === '(pointer: fine)' || q === '(pointer: coarse)' ? { matches: q === '(pointer: coarse)' ? env.coarse : !env.coarse, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q));
  }, env);
  if (theme) await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('sr.theme', t); } catch { /* */ } }, theme);
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  return page;
}
async function login(page, l, p) {
  await page.waitForSelector('#login', { timeout: 8000 });
  await page.type('#login', l); await page.type('#password', p);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 8000 });
  await sleep(500);
}
async function go(page, hash, sel) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(sel, { timeout: 15000 }).catch(() => console.log('timeout waiting for', sel, 'on', hash));
  await sleep(300);
}
async function toDay(page) {
  await page.waitForSelector('a.s-pill[href^="#/day/"]', { timeout: 15000 });
  const href = await page.evaluate(() => document.querySelector('a.s-pill[href^="#/day/"]').getAttribute('href'));
  await go(page, href, '.jscore, .dr-rules');
}
// G12 (22 Oct 2026): "How your day is scored" became "Scoring" — the jump bar's chip below 1024 px, the rail's button above
const openRules = async (page) => { await page.evaluate(() => { const b = [...document.querySelectorAll('.jscore, .dr-rules')].find((x) => x.getClientRects().length); b.scrollIntoView({ block: 'center' }); b.focus(); }); await page.keyboard.press('Enter'); await sleep(450); };
const isOpen = (page, sel) => page.$eval(sel, (d) => d.open).catch(() => false);
const box = (page, sel) => page.$eval(sel, (d) => { const r = d.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth }; });

// ---------------- Sheet at every width: bottom sheet / centred, fits, the four ways to close ----------------
async function sheets(width, height = 0) {
  const W = `[${width}${height ? '×' + height : ''} sheet]`;
  const page = await page_(width, { height });
  await login(page, '6000000001', 'pass-12345');
  await toDay(page);
  await openRules(page);
  const S = 'dialog.rules-sheet';
  ok(await isOpen(page, S), `${W} "How your day is scored" opens from the keyboard (Enter)`);
  const r = await box(page, S);
  ok(r.t >= -1 && r.b <= r.h + 1 && r.l >= -1 && r.r <= r.w + 1, `${W} the sheet fits the screen (${Math.round(r.l)},${Math.round(r.t)} → ${Math.round(r.r)},${Math.round(r.b)} in ${r.w}×${r.h})`);
  if (width < 600) ok(Math.abs(r.b - r.h) < 2 && r.l < 1 && Math.abs(r.r - r.w) < 1, `${W} a bottom sheet under 600 px`);
  else ok(Math.abs((r.l + r.r) / 2 - r.w / 2) < 2, `${W} a centred dialog from 600 px`);
  ok(r.sw <= r.w + 1, `${W} no sideways scroll with the sheet open`);
  const named = await page.$eval(S, (d) => document.getElementById(d.getAttribute('aria-labelledby'))?.textContent.trim());
  ok(named === 'How your day is scored', `${W} the dialog is named by its title (${named})`);
  ok(await page.$eval(S, (d) => d.contains(document.activeElement)), `${W} focus moves into the sheet`);
  const xs = await page.$eval(`${S} .sheet-head .iconbtn`, (b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
  ok(xs[0] >= 44 && xs[1] >= 44, `${W} the close button is a 44 px target (${xs.join('×')})`);
  if (width === 390 || width === 1280) await shot(page, `sheet-${width}`);

  // a drag that starts inside (selecting text, scrolling the wheel) and ends on the backdrop must not close it
  const h2 = await page.$eval(`${S} h2`, (e) => { const r = e.getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.move(h2[0], h2[1]); await page.mouse.down(); await page.mouse.move(3, 3, { steps: 4 }); await page.mouse.up(); await sleep(300);
  ok(await isOpen(page, S), `${W} a drag from inside out to the backdrop leaves it open`);
  // a tap on the backdrop closes it, and focus goes back to what opened it
  await page.mouse.click(3, 3); await sleep(450);
  ok(!(await isOpen(page, S)), `${W} a tap outside closes it`);
  ok(await page.evaluate(() => /jscore|dr-rules/.test(document.activeElement?.className || '')), `${W} focus returns to "Scoring"`);
  await openRules(page);
  await page.keyboard.press('Escape'); await sleep(450);
  ok(!(await isOpen(page, S)) && (await page.evaluate(() => /jscore|dr-rules/.test(document.activeElement?.className || ''))), `${W} Escape closes it; focus returns`);
  await openRules(page);
  await page.click(`${S} button[aria-label="Close"]`); await sleep(450);
  ok(!(await isOpen(page, S)), `${W} ✕ closes it`);
  // leaving the screen with the sheet open (Back, a nav tap, a notification link): the sheet goes with it, no error
  await openRules(page);
  const before = errs.length;
  await page.evaluate(() => { location.hash = '#/week'; }); await sleep(900);
  ok(errs.length === before && !(await page.$('dialog[open]')) && (await page.$('.list .lrow')), `${W} leaving the screen with the sheet open: no error, no sheet left behind`);
  await page.browserContext().close();
}

// ---------------- dismiss={false}: a form where a stray tap must not lose typing ----------------
async function dismiss(width) {
  const W = `[${width} sheet form]`;
  const page = await page_(width);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/coordinators', 'button.btn-primary');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Add (staff|coordinator)$/.test(b.textContent.trim()))?.click()); await sleep(500);
  const S = 'dialog[aria-labelledby="co-h"]';
  ok(await isOpen(page, S), `${W} "Add staff" opens the form`);
  await page.type('#co-n', 'Test name'); await page.mouse.click(3, 3); await sleep(400);
  ok(await isOpen(page, S) && (await page.$eval('#co-n', (i) => i.value)) === 'Test name', `${W} a tap outside the form keeps it open with the typing`);
  if (width === 1280) await shot(page, 'sheet-form-1280');
  await page.keyboard.press('Escape'); await sleep(400);
  ok(!(await isOpen(page, S)), `${W} Escape still closes it`);
  await page.browserContext().close();
}

// ---------------- Row and Status: targets, focus, the dot, contrast, light and dark ----------------
const contrast = (page, sel) => page.$$eval(sel, (els) => els.map((el) => {
  // "rgb(r, g, b)" / "rgba(…, a)" / "color(srgb r g b / a)" (what color-mix() computes to: 0–1 channels) → [r, g, b, a?] in 0–255
  // any other form (oklab(), mid-way through a hover fade) is not read as a colour: the walk goes on to the parent
  const rgb = (c) => { const n = (c.match(/[\d.]+/g) || []).map(Number); return /^color\(srgb/.test(c) ? [...n.slice(0, 3).map((v) => v * 255), ...n.slice(3)] : /^rgba?\(/.test(c) ? n : []; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let n = el, bg = null;
  while (n && n.nodeType === 1) { const c = getComputedStyle(n).backgroundColor; const v = rgb(c); if (v.length >= 3 && (v.length < 4 || v[3] > 0.9)) { bg = v; break; } n = n.parentElement; }
  bg = bg || [255, 255, 255];
  const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(bg)];
  const dot = getComputedStyle(el, '::before');
  return { t: el.textContent.trim(), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), dot: dot.width === '8px' && dot.borderRadius === '50%' };
}));
async function rows(width, theme) {
  const W = `[${width} ${theme} rows]`;
  const page = await page_(width, { theme });
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/week', '#f-days .list .lrow');
  const rs = await page.$$eval('#f-days .list .lrow', (l) => l.map((e) => ({ tag: e.tagName, h: e.getBoundingClientRect().height, dis: e.getAttribute('aria-disabled') })));
  ok(rs.length === 7 && rs.every((x) => x.h >= 44), `${W} the week's 7 day rows are ≥ 44 px (${rs.map((x) => Math.round(x.h)).join(',')})`);
  ok(rs.every((x) => (x.tag === 'A') !== (x.dis === 'true')), `${W} a day is a link, or dimmed and marked disabled, never both`);
  await page.mouse.move(0, 0); await sleep(300);                       // the resting colours, not a row's hover fade
  const st = await contrast(page, '#f-days .list .status');
  ok(st.length > 0 && st.every((s) => s.dot && s.t), `${W} each day's state is a dot and a word (${st.map((s) => s.t).join(', ')})`);
  ok(st.every((s) => s.ratio >= 4.5), `${W} status words meet 4.5:1 (${st.map((s) => s.t + " " + s.ratio.toFixed(1)).join(', ')})`);
  await page.$eval('.list a.lrow', (a) => a.focus());
  await page.keyboard.press('Tab'); await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return document.activeElement.classList.contains('lrow') && (s.outlineStyle !== 'none' || s.boxShadow !== 'none'); });
  ok(ring, `${W} a row shows a focus ring from the keyboard`);
  if (width === 390) await shot(page, `week-rows-${theme}-390`);
  await page.browserContext().close();

  // staff: the batch board's states
  const p2 = await page_(width, { theme });
  await login(p2, 'sps', 'sps-pass-12');
  await go(p2, '#/batch', 'li.brow');
  const bs = await contrast(p2, 'li.brow .status');
  ok(bs.length > 0 && bs.every((s) => s.dot), `${W} board: ${bs.length} states shown as dot + word`);
  ok(bs.every((s) => s.ratio >= 4.5), `${W} board: status words meet 4.5:1 (lowest ${Math.min(...bs.map((s) => s.ratio)).toFixed(1)})`);
  // the week wheel: Done closes its sheet and reloads the board at once, so the sheet's close event arrives after
  // the picker was rebuilt (the page error prompt-f5 found, 4 Oct). Pick another week: no error, focus not lost.
  const e0 = errs.length;
  await p2.$eval('#bd-wk-w', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); }); await sleep(400);
  const picked = await p2.evaluate(() => {
    const d = document.querySelector('dialog.wsel-sheet[open]'); if (!d) return '';
    const rows = [...d.querySelectorAll('.wheel-row')], on = d.querySelector('.wheel-row.on');
    const other = rows.find((r) => r !== on && r.dataset.value && r.dataset.value !== on?.dataset.value);
    other?.click(); [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Done')?.click();
    return other?.dataset.value || '';
  });
  await sleep(1200);
  ok(!!picked && errs.length === e0 && !(await p2.$('dialog[open]')), `${W} board: another week from the wheel (${picked}), no page error, no sheet left open`);
  const pills = await p2.$$eval('.pill', (l) => l.map((p) => p.textContent.trim()).filter((t) => /^(Missed|Inactive|Disabled|Active|Not active|Present|Absent|Reopened|In progress|Not filled)$/i.test(t)));
  ok(!pills.length, `${W} board: no state left as a grey pill${pills.length ? ' (' + pills.join(', ') + ')' : ''}`);
  if (width === 390 || width === 1280) await shot(p2, `board-${theme}-${width}`);
  await p2.browserContext().close();
}

// ---------------- the look tiers: the sheet's material follows the tier; structure never does ----------------
async function tiers(width) {
  const out = {};
  for (const [name, env] of [['high', DESKTOP], ['balanced', ANDROID_MID_3G], ['low', ANDROID_LOW]]) {
    const page = await page_(width, { env });
    await login(page, '6000000001', 'pass-12345');
    await toDay(page); await openRules(page);
    out[name] = await page.evaluate(() => { const d = document.querySelector('dialog.rules-sheet'); const s = getComputedStyle(d); const r = d.getBoundingClientRect();
      return { tier: document.documentElement.dataset.tier, blur: s.backdropFilter, bg: s.backgroundColor, w: Math.round(r.width), x: Math.round(r.left) }; });
    await shot(page, `sheet-tier-${name}-${width}`);
    await page.browserContext().close();
  }
  const W = `[${width} tiers]`;
  ok(out.high.tier === 'high' && /blur/.test(out.high.blur), `${W} High: the sheet is glass (${out.high.blur})`);
  ok(out.low.tier === 'low' && (out.low.blur === 'none' || !out.low.blur) && !/rgba?\([^)]*,\s*0?\.\d+\)$/.test(out.low.bg), `${W} Low: opaque, no blur (${out.low.bg})`);
  ok(out.balanced.tier === 'balanced', `${W} Balanced device → balanced (${out.balanced.tier}, ${out.balanced.blur})`);
  ok(out.high.w === out.low.w && out.high.x === out.low.x && out.balanced.w === out.high.w, `${W} same size and place in every tier (${out.high.w}/${out.balanced.w}/${out.low.w} px)`);
  // reduced motion: no slide
  const page = await page_(width, { reduce: true });
  await login(page, '6000000001', 'pass-12345'); await toDay(page); await openRules(page);
  const tr = await page.$eval('dialog.rules-sheet', (d) => getComputedStyle(d).transitionDuration);
  ok(tr.split(',').every((t) => parseFloat(t) < 0.02), `${W} reduced motion: the sheet does not animate (${tr})`);
  await page.browserContext().close();
}

const WIDTHS = [320, 390, 600, 768, 900, 1024, 1280, 1440, 1920];
if (!only || only === 'sheets') { for (const w of WIDTHS) await sheets(w); await sheets(740, 360); }
if (!only || only === 'dismiss') { for (const w of [390, 1280]) await dismiss(w); }
if (!only || only === 'rows') { for (const w of [320, 390, 768, 1280]) for (const t of ['light', 'dark']) await rows(w, t); }
if (!only || only === 'tiers') { for (const w of [390, 1280]) await tiers(w); }
ok(!errs.length, `no page errors or console errors in any of the above${errs.length ? ' (' + errs.length + ')' : ''}`);
await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
console.log('\nConsole / page errors:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none');
