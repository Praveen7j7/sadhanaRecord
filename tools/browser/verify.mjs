// Phase 4 user-level checks against the dev server (mock mode). Usage: node verify.mjs [part]
import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json');
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:5199';   // another dev server: BASE=http://localhost:5195
const OUT = process.env.OUT || '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/screenshots';   // another copy: OUT=<its folder>
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2] || '';
const results = [];
const errs = [];
const ok = (cond, msg) => { results.push((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) console.log('FAIL', msg); };
// A tab Chrome closes under load must not end the whole run (gate runs 1 and 2, 27 Oct 2026: "Attempted to use detached
// Frame", "Target closed" — every part after it never ran). Such a part runs once more on fresh pages; any other error
// still stops the run, and a second crash of the same part is a FAIL, so nothing passes by being skipped.
// …and the browser itself can die mid-run on a busy machine (gate run 10: "Connection closed" in `logins`): then a new
// one is started before the retry, and before the next part.
const TAB_GONE = /detached Frame|Target closed|Session closed|Execution context was destroyed|Connection closed/i;
const revive = async () => { if (!browser.connected) { browser = await launch(); OPEN_CONTEXTS.length = 0; } };
async function part(name, fn) {
  try { await fn(); } catch (e) {
    if (!TAB_GONE.test(String(e?.message || e))) throw e;
    console.log(`part ${name}: a tab or the browser closed under it (${String(e.message).slice(0, 90)}); running it once more`);
    await revive();
    try { await fn(); } catch (e2) { ok(false, `[${name}] crashed twice: ${String(e2?.message || e2).slice(0, 160)}`); await revive(); }
  }
}

// CHROME from the environment, falling back to the Mac's own path (13 Oct 2026, audit F-02): the hard-coded path
// was why these 1,800 checks could only ever run on one laptop. tools/release/gate.mjs already did this.
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
let browser = await launch();

// the mock's clock: Sunday (the class day) or Saturday of this week, 11:00 / 10:00 Indian time
/* A class day to pin the mock clock to, so checks that need an OPEN attendance window do not depend on the
 * day of the week they happen to run on.
 *
 * `weeks` shifts whole weeks; the default -1 is the Sunday just gone. This matters more than it looks.
 * Monday-of-this-week + 6 days is a Sunday in the FUTURE on every day but Sunday itself, and a week's
 * attendance only opens between its own Sunday and the Monday 21:00 after it (mockweeks.js
 * `attendanceOpens` / `closesOf`). A clock set to next Sunday therefore put the board on a week whose class
 * had not happened: no Present/Absent buttons rendered at all, the board showed "Opens Sun", and the
 * coordinator checks crashed on a row with no buttons to click. Run on a Sunday it passed, which is why it
 * survived so long.
 */
/* The week a devotee can fill TODAY, and a day inside it.
 *
 * These checks used to navigate to a hardcoded fillableDay(). That was the current week when
 * it was written and is now a week that closed at its Monday deadline, so the day form refuses to open, the
 * selector never appears and the run dies on a null element. A date written into a check has a shelf life;
 * this does not. */
function thisWeekId() {
  const ist = new Date(Date.now() + 5.5 * 3600e3), back = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back)).toISOString().slice(0, 10);
}
/** A day inside the current week that has already happened: its Monday, which is always fillable. */
const fillableDay = () => `#/day/${thisWeekId()}/${thisWeekId()}`;

/*
 * A clock pinned to a class day on which attendance is actually OPEN.
 *
 * `weeks = -1` meant last week's class day, chosen so the class had already happened. But the board
 * shows the week whose deadline has not passed (focusWeek), and once last week's Monday 9 PM has
 * gone that is the CURRENT week — whose class day is still ahead, so attendance is shut and the
 * board has no marks to click. Run on a Saturday, the checks that mark attendance crashed on null.
 *
 * So the clock is the class day of the week the board will actually be showing: this week's, moved
 * back only while last week is still open. The date it is run on stops deciding whether it passes.
 */
function classDayIso(dow = 'SUN') {
  const ist = new Date(Date.now() + 5.5 * 3600e3), back = (ist.getUTCDay() + 6) % 7;
  const thisMon = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back));
  // last week is still the board's week until its Monday 9 PM deadline
  const lastClose = new Date(thisMon.getTime() + 21 * 3600e3 - 5.5 * 3600e3);
  const mon = ist < lastClose ? new Date(thisMon.getTime() - 7 * 864e5) : thisMon;
  const d = new Date(mon.getTime() + (dow === 'SAT' ? 5 : 6) * 864e5).toISOString().slice(0, 10);
  return d + (dow === 'SAT' ? 'T10:00:00+05:30' : 'T11:00:00+05:30');
}
// Only the newest few pages stay open (27 Oct 2026, gate 23 runs 3–7: "Connection closed" at a different part each
// time, never when a part ran alone). fresh() is called from ~96 places, many per width, and most never close their
// page: a full run kept hundreds of live app pages — each polling, rotating paintings — in one browser until Chrome
// gave out. No part holds more than two pages at once, so the four newest are kept and older ones are closed.
const OPEN_CONTEXTS = [];
async function fresh(width, { reduce = false, clock = '' } = {}) {
  while (OPEN_CONTEXTS.length >= 4) await OPEN_CONTEXTS.shift().close().catch(() => { /* closed by its part */ });
  const ctx = await browser.createBrowserContext();
  OPEN_CONTEXTS.push(ctx);
  const page = await ctx.newPage();
  await page.setViewport({ width, height: width >= 1024 ? 900 : 800, deviceScaleFactor: 1 });
  // A charged battery, always (12 Oct 2026). tier.js correctly drops to 'low' at 10 % and stops loading the
  // paintings, so on a laptop running low these checks failed for a reason that has nothing to do with the code:
  // a release must not depend on the charge of the machine it is checked on. The tests that mean to try a flat
  // battery fake their own (DESKTOP / ANDROID_LOW below) and are unaffected.
  await page.evaluateOnNewDocument(() => {
    const b = new EventTarget(); b.level = 1; b.charging = true; b.chargingTime = 0; b.dischargingTime = Infinity;
    try { Object.defineProperty(Navigator.prototype, 'getBattery', { get: () => () => Promise.resolve(b), configurable: true }); } catch { /* fixed */ }
    // and a good connection, for the same reason: tier.js drops to 'low' on data saver, 2G or rtt ≥ 1500 ms
    const c = new EventTarget(); c.effectiveType = '4g'; c.rtt = 50; c.downlink = 10; c.saveData = false;
    try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch { /* fixed */ }
  });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.on("pageerror", (e) => errs.push(`[${width}] PAGEERR ${e.message}${process.env.STACK ? " " + (e.stack || "").split("\n").slice(1, 4).join(" | ") : ""}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${width}] console.${m.type()} ${m.text()}`); });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  /*
   * BOTH clocks move, or neither answer is honest (17 Oct 2026).
   *
   * setNow moves the MOCK API's clock. The screens compare against the browser's Date.now() —
   * markOpen() in lib/staff.js does exactly that — so moving only one left the API reporting
   * attendance open while the board, reading real time, drew no marks at all. Every attendance
   * check then failed, and one clicked a button that was not there and took the run down, for a
   * reason that had nothing to do with the app.
   *
   * A subclass of Date, applied before any script runs: `new Date()` with no arguments is shifted
   * and EVERYTHING ELSE is untouched — an explicit date still parses, arithmetic and JSON still
   * work, and `instanceof Date` still holds. A plain function with a reassigned prototype does not
   * manage that, and broke 42 checks that had nothing to do with time.
   */
  if (clock) {
    const at = Date.parse(clock);
    await page.evaluateOnNewDocument((t) => {
      const R = Date, off = t - R.now();
      class D extends R {
        constructor(...a) { if (a.length === 0) super(R.now() + off); else super(...a); }
        static now() { return R.now() + off; }
      }
      globalThis.Date = D;
    }, at);
    await page.reload({ waitUntil: 'networkidle0' });
  }
  await page.evaluate(async (c) => { const m = await import('/src/lib/mock.js'); m.setLatency(60); if (c) m.setNow(c); }, clock);
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 5000 }).catch(() => console.log('splash still there'));
  return page;
}
async function login(page, l, p) {
  await page.waitForSelector('#login', { timeout: 8000 });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 5000 }).catch(() => {});
  await page.type('#login', l); await page.type('#password', p);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 8000 });
  await sleep(500);
}
async function go(page, hash, wait = 600, sel = '') {
  await page.evaluate((h) => { location.hash = h; }, hash);
  if (sel) await page.waitForSelector(sel, { timeout: 15000 }).catch(() => console.log('timeout waiting for', sel, 'on', hash));
  await sleep(sel ? 250 : wait);
  // ...and, when the caller waited for the page to be ready, for the page change's view transition to end (22 Oct 2026).
  // While one runs, Chrome hit-tests every tap to <html>, so a real click is simply lost. Since C4 (the travelling week
  // card and nav pill, public/motion.css) a page change runs ~370 ms, past the 250 ms above: the Hearing ‹ and the
  // Account pencil were tapped mid-transition and nothing happened (14 + 2 reds; the screens themselves were right).
  if (sel) await page.waitForFunction(() => !document.activeViewTransition, { timeout: 3000, polling: 16 }).catch(() => console.log('view transition still running on', hash));
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/phase4-${name}.png` });
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
/* Type into a search box and WAIT for the app to catch up, instead of sleeping a fixed 200 ms and hoping.
   A fixed sleep is what made these checks flaky before (12 Oct 2026: 13 motion and 4 darshan false reds),
   and it is why "filters kept in the hash" failed with q=s — one keystroke had landed, the debounce had not
   finished, and the assertion read a half-typed value. This waits for the hash to actually carry the whole
   word, with a real timeout so a genuine break still fails. */
/* Wait until the Save has its reply. A fixed sleep was asserting while the request was still in flight. Since B2
   (22 Oct 2026) the label says "Saved ✓" the moment Save is tapped, so the reply is read from aria-busy, which the
   button keeps until the server answers. The visible Save: the floating bar, or on a desktop the Day rail (C8).
   A real timeout keeps a genuine hang failing. */
async function saveSettles(page, ms = 8000) {
  try {
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('.actionbar button, .dayrail button')].filter((x) => x.getClientRects().length && /^Save/.test(x.textContent.trim())).at(-1)
        || [...document.querySelectorAll('.actionbar button')].at(-1);
      return b && b.getAttribute('aria-busy') !== 'true';
    }, { timeout: ms });
  } catch { /* leave it to the assertion that follows to report what the button says */ }
}
async function typeAndSettle(page, sel, value, { key = 'q', ms = 4000 } = {}) {
  /* Set the whole value and fire one `input`, rather than page.type()'s keystroke at a time. The list
     re-renders as the filter narrows, the input loses focus mid-word, and the remaining keystrokes go
     nowhere — which is exactly how this check came to assert on `q=s` after typing "soul". */
  await page.$eval(sel, (el, v) => {
    el.focus();
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const want = `${key}=${encodeURIComponent(value)}`;
  try {
    await page.waitForFunction((w) => decodeURIComponent(location.hash).includes(decodeURIComponent(w)), { timeout: ms }, want);
  } catch {
    // leave it to the assertion that follows to report what the hash actually says
  }
}
async function clickText(page, sel, re) {
  const ok = await page.evaluate((sel, src) => { const re = new RegExp(src); const el = [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent.replace(/\s+/g, " ").trim()) && e.getClientRects().length); if (el) { el.click(); return true; } return false; }, sel, re.source);
  await sleep(250);
  return ok;
}
async function setRounds(page, v) {
  await page.$eval('#rounds', (e) => { e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); });
  await page.keyboard.type(v);
}

/** Chooses a value in a native select, or on a wheel (WheelSelect: tap the field, tap the row, Done). */
/** A wheel field's choices and its current one (opens the sheet, reads the rows, Cancel). */
async function wheelChoices(page, selector) {
  await page.$eval(selector, (e) => { e.scrollIntoView({ block: 'center' }); e.click(); });
  // wait for the sheet rather than guessing at 250 ms: a slower frame left `d` null and threw
  // inside page.evaluate, which reads as a crash rather than as the check it belongs to
  await page.waitForSelector('dialog.wsel-sheet[open]', { timeout: 4000 }).catch(() => {});
  await sleep(120);
  const r = await page.evaluate(() => {
    const d = document.querySelector('dialog.wsel-sheet[open]');
    if (!d) return { values: [], current: null, missing: true };
    const rows = [...d.querySelectorAll('.wheel-row')];
    const out = { values: [...new Set(rows.map((x) => x.dataset.value))], current: d.querySelector('.wheel-row.on')?.dataset.value ?? null };
    [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancel')?.click();
    return out;
  });
  await sleep(200);
  return r;
}
async function sel(page, selector, value) {
  const tag = await page.$eval(selector, (e) => e.tagName).catch(() => '');
  if (tag === 'SELECT') return page.select(selector, value);
  await page.$eval(selector, (e) => { e.scrollIntoView({ block: 'center' }); e.click(); });
  await sleep(250);
  await page.evaluate((v) => {
    const d = document.querySelector('dialog.wsel-sheet[open]');
    const row = [...d.querySelectorAll('.wheel-row')].find((r) => r.dataset.value === String(v));
    row?.click();
    [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Done')?.click();
  }, value);
  await sleep(250);
}
const hScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

// ---------------- devotee ----------------
async function devotee(width) {
  const page = await fresh(width);
  await login(page, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 });
  await sleep(500);
  // carousel: no layout shift
  await page.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); });
  // Phase 24 (V17): the verse box is as tall as the quote ON SCREEN (sized to the tallest of 78 it left 120–200 px blank),
  // which is safe only because the devotional block is the LAST thing on this Home: nothing below it can move
  const fits = () => page.evaluate(() => {
    const q = document.querySelector('.qc'), on = document.querySelector('.qc-slide[data-on]'), tr = document.querySelector('.qc-track');
    const blk = q.closest('.dcard').getBoundingClientRect(), main = document.querySelector('main.content');
    const after = [...main.querySelectorAll('*')].filter((e) => !e.closest('.dcard') && !e.contains(q) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().top >= blk.bottom - 1 && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().left < blk.right && e.getBoundingClientRect().right > blk.left && !e.closest('.toasts, .sr-only, dialog'));   // in its column: the other column's rows never move with it
    return { fit: q.classList.contains('fit'), track: tr.getBoundingClientRect().height, quote: on.getBoundingClientRect().height, below: after.map((e) => e.tagName + '.' + e.className).slice(0, 3) };
  });
  const f0 = await fits();
  ok(f0.fit && Math.abs(f0.track - f0.quote) < 1, `[${width}] verse box as tall as the quote on screen (${f0.track.toFixed(0)} vs ${f0.quote.toFixed(0)})`);
  ok(!f0.below.length, `[${width}] the painting and verse are last on Home: nothing below them can move (${f0.below.join(', ') || 'none'})`);
  const cur = () => page.$eval('.qc-slide[data-on] cite', (e) => e.textContent.trim());
  const n0 = await cur();
  await page.$eval('.qc', (e) => e.scrollIntoView({ block: 'center' })); await sleep(100);
  for (let i = 0; i < 5; i++) {
    try { await page.click('button[aria-label="Next quote"]'); } catch (x) { console.log('DBG', i, await page.evaluate(() => location.hash + ' ' + document.querySelector('.content')?.innerText.slice(0, 300))); throw x; }
    await sleep(120);
  }
  const f1 = await fits();
  ok(f1.fit && Math.abs(f1.track - f1.quote) < 1 && !f1.below.length, `[${width}] after 5 slides: still the quote's own height, still last (${f1.track.toFixed(0)}px)`);
  const n1 = await cur();
  ok(n0 !== n1, `[${width}] Next turns the quote (${n0} -> ${n1})`);
  const dots = await page.$$eval('.qc-dots i', (l) => l.length);
  ok(!(await page.$('.qc-n')) && dots >= 3 && dots <= 5 && !/\b\d+ ?\/ ?\d+\b/.test(await text(page, '.qc-foot')), `[${width}] no quote count shown, ${dots} dots`);
  const cat = await page.$eval('.qc-slide[data-on] .qc-cat', (e) => e.textContent.trim());
  ok(['Bhagavad-gītā', 'Śrīmad-Bhāgavatam', 'Caitanya-caritāmṛta', 'Nectar of Instruction', 'Brahma-saṁhitā', 'Nectar of Devotion', 'Śrī Īśopaniṣad'].includes(cat), `[${width}] quote shows its book (${cat})`);
  ok(/Śrīla Prabhupāda's translation/.test(await text(page, '.qc') || '') && (await page.$$('.qc-by')).length === 1, `[${width}] "Śrīla Prabhupāda's translation" shown once`);
  await page.focus('button[aria-label="Next quote"]'); await page.keyboard.press('ArrowLeft'); await sleep(100);
  ok((await page.$eval('.qc-track', (e) => e.getAttribute('aria-live'))) === 'polite', `[${width}] focus inside pauses: aria-live polite`);
  await page.evaluate(() => document.activeElement.blur()); await page.mouse.move(1, 1); await sleep(100);
  const cls = await page.evaluate(() => window.__cls);
  ok(cls < 0.01, `[${width}] CLS while turning quotes = ${cls.toFixed(4)}`);
  if (width === 390) {
    // 9 Oct 2026: no pause button — pressing holds the quote still, letting go lets it go on; autoplay; hidden tab pauses
    await page.evaluate(() => document.querySelector('.qc').scrollIntoView({ block: 'center' }));
    const tb = await (await page.$('.qc-track')).boundingBox();
    ok(!(await page.$('.qc-play')) && !(await page.$('.qc-frozen')), '[390] no pause button on the verse');
    await page.mouse.move(tb.x + tb.width / 2, tb.y + 30); await page.mouse.down(); await sleep(150);
    ok(await page.$eval('.qc', (e) => e.hasAttribute('data-paused')), '[390] pressing holds the quote still');
    const f0 = await cur(); await sleep(31000);
    ok((await cur()) === f0, '[390] held quote stays past its longest time (30 s)');
    await page.mouse.up(); await page.evaluate(() => document.activeElement.blur()); await page.mouse.move(1, 1); await sleep(100);
    ok(!(await page.$eval('.qc', (e) => e.hasAttribute('data-paused'))), '[390] letting go: it goes on');
    // Phase 9: each verse stays for its own reading time (6 s + 0.4 s a word, 10–30 s); the progress line shows it
    const a = await cur();
    const dur = await page.$eval('.qc-status i', (i) => parseFloat(getComputedStyle(i).animationDuration) * 1000).catch(() => 30000);
    // (+4 s: a verse never changes within 4 s of a painting change — lib/pace.js GAP — so it may wait that long)
    await sleep(dur + 4000 + 900);
    const b = await cur();
    ok(a !== b && dur >= 10000 && dur <= 30000, `[390] autoplay advanced after the verse's reading time (${Math.round(dur / 1000)} s: ${a} -> ${b})`);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(100);
    ok(await page.$eval('.qc', (e) => e.hasAttribute('data-paused')), '[390] hidden tab pauses the carousel');
    const hb = await cur();
    await sleep(31000);
    ok((await cur()) === hb, '[390] no advance while the tab is hidden');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.focus('.qc-track'); await page.keyboard.press('Enter'); await page.evaluate(() => document.activeElement.blur()); await sleep(100);
    ok(await page.$eval('.qc', (e) => e.hasAttribute('data-paused')), '[390] Enter from the keyboard keeps it still');
    await page.focus('.qc-track'); await page.keyboard.press('Enter');
    await page.evaluate(() => document.activeElement.blur());
    await page.evaluate(() => document.querySelector('.qc').scrollIntoView({ block: 'center' }));
    await shot(page, 'home-carousel-390');
    // swipe
    const box = await (await page.$('.qc-track')).boundingBox();
    const c0 = await cur();
    await page.touchscreen.touchStart(box.x + box.width * 0.8, box.y + 40);
    await page.touchscreen.touchMove(box.x + box.width * 0.2, box.y + 45);
    await page.touchscreen.touchEnd();
    await sleep(200);
    ok((await cur()) !== c0, `[390] swipe left turns the quote (${c0} -> ${await cur()})`);
  }
  // drawer
  if (width < 1024) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('.menu-btn'); await sleep(400);
    const r = await page.$eval('dialog.drawer', (d) => { const b = d.getBoundingClientRect(); return { open: d.open, left: b.left, right: b.right, focusIn: d.contains(document.activeElement) }; });
    ok(r.open && Math.abs(r.left) < 2 && r.right < width, `[${width}] drawer opens from the LEFT edge, the side of its button (left ${r.left.toFixed(0)}, right ${r.right.toFixed(0)})`);
    ok(r.focusIn, `[${width}] focus moves into the drawer`);
    if (width === 390) await shot(page, 'drawer-390');
    await page.keyboard.press('Escape'); await sleep(350);
    const back = await page.evaluate(() => ({ open: document.querySelector('dialog.drawer').open, focus: document.activeElement?.classList.contains('menu-btn') }));
    ok(!back.open && back.focus, `[${width}] Esc closes it and focus returns to the menu button`);
    await page.click('.menu-btn'); await sleep(350);
    await page.mouse.click(width - 5, 300); await sleep(350);
    ok(!(await page.$eval('dialog.drawer', (d) => d.open)), `[${width}] tapping the backdrop closes it`);
    await page.click('.menu-btn'); await sleep(350);
    await page.click('dialog.drawer button[aria-label="Close menu"]'); await sleep(350);
    ok(!(await page.$eval('dialog.drawer', (d) => d.open)), `[${width}] close button closes it`);
  } else {
    const vis = await page.evaluate(() => ({ btn: getComputedStyle(document.querySelector('.menu-btn')).display, side: getComputedStyle(document.querySelector('.sidebar')).display }));
    ok(vis.btn === 'none' && vis.side === 'block', `[${width}] wide screen: permanent sidebar, no menu button`);
  }
  ok(!(await hScroll(page)), `[${width}] home: no horizontal scroll`);

  // hearing
  await go(page, '#/hearing', 900, '.wkstrip');
  ok((await text(page, '.pagetitle')) === 'Hearing', `[${width}] #/hearing has its own title`);
  const wk = await text(page, '.wknow [aria-live]');
  // the whole allotted journal (8 Oct 2026), opening on the suggested week, never on week 81
  ok(/^Lesson week 3 of 81$/.test(wk), `[${width}] hearing opens on the suggested week of the whole journal (${wk})`);
  ok((await page.$$('section .swipe > li')).length === 4, `[${width}] one week shows its 4 lectures`);
  // phase 21 (the head, 23 Oct 2026): a strip of the journal's weeks replaces the ‹ › buttons
  ok(await page.$$eval('.wkstrip button', (b) => b.length === 81 && !b.at(-1).disabled), `[${width}] later weeks can be opened too (a chip for each of the 81 weeks)`);
  const strip = await page.evaluate(() => { const s = document.querySelector('.wkstrip'), on = s.querySelector('[aria-pressed=true]'), r = s.getBoundingClientRect(), e = on?.getBoundingClientRect();
    return { on: on?.textContent.trim(), sugg: on?.classList.contains('wk-sugg'), inView: !!e && e.left >= r.left - 1 && e.right <= r.right + 1 }; });
  ok(strip.on === '3' && strip.sugg && strip.inView, `[${width}] the strip shows the suggested week chosen, marked and in view (${JSON.stringify(strip)})`);
  // the week line is read once it says what is expected (a real timeout keeps a dead button failing), not after a sleep
  const weekIs = (w) => page.waitForFunction((w) => document.querySelector('.wknow [aria-live]')?.textContent.replace(/\s+/g, ' ').trim() === `Lesson week ${w} of 81`, { timeout: 3000 }, w).catch(() => {});
  await page.evaluate(() => [...document.querySelectorAll('.wkstrip button')].find((b) => b.textContent.trim() === '2')?.click()); await weekIs(2);
  ok((await text(page, '.wknow [aria-live]')) === 'Lesson week 2 of 81', `[${width}] a week on the strip opens that week (${await text(page, '.wknow [aria-live]')})`);
  await page.focus('.wkstrip button[aria-pressed=true]'); await page.keyboard.press('ArrowRight'); await weekIs(3);
  ok((await text(page, '.wknow [aria-live]')) === 'Lesson week 3 of 81', `[${width}] → key steps forward (${await text(page, '.wknow [aria-live]')})`);
  const tgt = await page.$eval('.swipe a.lrow', (a) => [a.target, a.rel]);
  ok(tgt[0] === '_blank' && tgt[1].includes('noopener'), `[${width}] a lecture opens in a new tab (noopener)`);
  if (width === 390) {
    await shot(page, 'hearing-week-390');
    const box = await (await page.$('.swipe')).boundingBox();
    await page.touchscreen.touchStart(box.x + box.width * 0.15, box.y + 30);
    await page.touchscreen.touchMove(box.x + box.width * 0.85, box.y + 34);
    await page.touchscreen.touchEnd(); await weekIs(2);
    ok((await text(page, '.wknow [aria-live]')) === 'Lesson week 2 of 81', `[390] swipe on the list steps the week (${await text(page, '.wknow [aria-live]')})`);
  }
  await clickText(page, '.seg button', /^All weeks$/);
  // the whole journal (8 Oct 2026): 81 weeks, 4 lectures each, 30 shown at a time
  ok(/All 324 lectures/.test(await text(page, '[role=status].text-sm') || ''), `[${width}] All weeks lists the whole journal (324)`);
  ok((await page.$$('section[aria-label=Lectures] ul > li')).length === 30 && (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /^Show more/.test(b.textContent.trim())))), `[${width}] 30 at a time, then Show more`);
  await clickText(page, '.chipbtn', /^SPL$/);
  await typeAndSettle(page, '#ln-q', 'soul');
  // the address settles before the list redraws: wait for the count itself (intermittent "undefined", 19 Oct 2026)
  await page.waitForFunction(() => [...document.querySelectorAll('p[role=status]')].some((p) => /^\d+ of 324 lectures$/.test(p.textContent)), { timeout: 8000 }).catch(() => {});
  const cnt = await page.evaluate(() => [...document.querySelectorAll('p[role=status]')].map((p) => p.textContent).find((t) => /lectures/.test(t)));
  const why = cnt ? '' : await page.evaluate(() => JSON.stringify({ hash: location.hash, st: [...document.querySelectorAll('[role=status],[role=alert]')].map((x) => x.tagName + ':' + x.textContent.trim().slice(0, 50)), main: document.querySelector('main')?.innerText.slice(0, 160) }));
  ok(/^\d+ of 324 lectures$/.test(cnt), `[${width}] slot + search narrow it (${cnt}${why})`);
  const hash = await page.evaluate(() => location.hash);
  ok(hash.includes('v=all') && hash.includes('s=SPL') && hash.includes('q=soul'), `[${width}] filters kept in the hash (${hash})`);
  await page.evaluate(() => { document.querySelector('#ln-q').value = ''; document.querySelector('#ln-q').dispatchEvent(new Event('input', { bubbles: true })); });
  await clickText(page, '.chipbtn', /^All slots$/);
  const folder = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Lectures] li')].some((li) => /Open folder/.test(li.textContent)));
  const none = await page.evaluate(() => [...document.querySelectorAll('section[aria-label=Lectures] li')].some((li) => /No recording linked/.test(li.textContent) && !li.querySelector('a')));
  ok(folder && none, `[${width}] folder lectures say "Open folder"; empty links say "No recording linked" with no button`);
  if (width === 390) await shot(page, 'hearing-all-390');
  ok(!(await hScroll(page)), `[${width}] hearing: no horizontal scroll`);
  // phase 21: one search box above both views; typing in the one-week view searches the whole journal, keeping its focus
  await clickText(page, '.seg button', /^One week$/);
  await page.waitForSelector('.wkstrip', { timeout: 6000 }).catch(() => {});
  await page.$eval('#ln-q', (i) => { i.focus(); i.select(); }); await page.keyboard.type('soul', { delay: 20 });
  await page.waitForFunction(() => [...document.querySelectorAll('p[role=status]')].some((p) => /^\d+ of 324 lectures$/.test(p.textContent)), { timeout: 6000 }).catch(() => {});
  const hs = await page.evaluate(() => ({ id: document.activeElement?.id, v: document.getElementById('ln-q')?.value, all: document.querySelector('.seg [aria-pressed=true]')?.textContent.trim(),
    n: [...document.querySelectorAll('p[role=status]')].map((p) => p.textContent).find((t) => /lectures/.test(t)) }));
  ok(hs.id === 'ln-q' && hs.v === 'soul' && hs.all === 'All weeks' && /^\d+ of 324 lectures$/.test(hs.n || ''), `[${width}] the hearing search keeps its focus while typing and searches every week (${JSON.stringify(hs)})`);
  await page.evaluate(() => { document.querySelector('#ln-q').value = ''; document.querySelector('#ln-q').dispatchEvent(new Event('input', { bubbles: true })); });
  // Back keeps filters
  await go(page, '#/home', 500);
  await page.goBack(); await sleep(700);
  ok((await page.evaluate(() => location.hash)).includes('v=all'), `[${width}] Back returns with the filters`);

  // reading
  await go(page, '#/reading', 800, 'ul[aria-label=Books]');
  ok((await text(page, '.pagetitle')) === 'Reading', `[${width}] #/reading has its own title`);
  const pressed = await text(page, '.chipbtn[aria-pressed=true]');
  ok(/SPS\/DPS/.test(pressed), `[${width}] reading opens on the devotee's level (${pressed})`);
  const rows = (await page.$$('ul[aria-label=Books] > li')).length;
  ok(rows <= 8, `[${width}] at most 8 books at first (${rows})`);
  ok(!!(await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Show all \d+$/.test(b.textContent.trim())))), `[${width}] "Show all N" offered`);
  await clickText(page, '.chipbtn', /^All$/);
  // 22 Oct 2026 (the head): typing in a search box must keep its focus. Each letter is written into the address, and
  // the screen used to be re-mounted on every address change, so the box lost focus after one letter
  await page.$eval('#rd-q', (i) => { i.focus(); i.select(); }); await page.keyboard.type('pra'); await sleep(300);
  const kept = await page.evaluate(() => ({ id: document.activeElement?.id, v: document.getElementById('rd-q')?.value }));
  ok(kept.id === 'rd-q' && kept.v === 'pra', `[${width}] the reading search keeps its focus while typing (${JSON.stringify(kept)})`);
  await typeAndSettle(page, '#rd-q', 'Srimad');
  await page.click('ul[aria-label=Books] details summary'); await sleep(150);
  const vols = await page.$$eval('ul[aria-label=Books] details[open] .bk-vols a', (l) => l.map((a) => [a.textContent.trim(), a.target, a.rel]));
  ok(vols.length === 12 && vols.every((v) => v[1] === '_blank' && v[2].includes('noreferrer')), `[${width}] Srimad Bhagavatam Complete lists 12 cantos, each its own link (${vols.length})`);
  if (width === 390) await shot(page, 'reading-volumes-390');
  await page.evaluate(() => { const i = document.querySelector('#rd-q'); i.value = 'DYS'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(150);
  ok(/No PDF yet/.test(await text(page, 'ul[aria-label=Books]')), `[${width}] a book with no files says so`);
  ok((await page.evaluate(() => location.hash)).includes('lv=all'), `[${width}] reading level kept in the hash`);
  ok(!(await hScroll(page)), `[${width}] reading: no horizontal scroll`);
  await go(page, '#/learn?f=reading', 700);
  ok((await page.evaluate(() => location.hash)).startsWith('#/reading'), `[${width}] old #/learn?f=reading redirects`);

  // day save flow
  const wk2 = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.endsWith('|home.get')))).data.weeks.at(-1));
  const day = wk2.days.filter((d) => !d.future).at(-1).date;
  await go(page, `#/day/${wk2.weekId}/${day}`, 1200, '.actionbar');
  const sb = () => page.evaluate(() => { const b = [...document.querySelectorAll('.actionbar button')].at(-1); return { t: b.textContent.trim(), d: b.disabled }; });
  // 8 Oct 2026: a day nobody has filled reads plain "Save" (disabled), never a false "Saved ✓"
  ok((await sb()).d && (await sb()).t === 'Save', `[${width}] an untouched day opens with "Save" disabled (not "Saved ✓")`);
  await setRounds(page, '16'); await page.keyboard.press('Tab'); await sleep(200);
  let s1 = await sb();
  ok(!s1.d && s1.t === 'Save changes', `[${width}] typing enables Save (${s1.t})`);
  ok(await page.$eval('.actionbar .ab-share', (b) => b.disabled && /save first/.test(b.getAttribute('aria-label'))), `[${width}] Share waits until saved ("Share (save first)", disabled)`);
  if (width === 390) await shot(page, 'day-unsaved-390');
  await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].at(-1).click()); await saveSettles(page);
  s1 = await sb();
  ok(s1.d && s1.t === "Saved ✓", `[${width}] Save -> "Saved ✓" disabled (${JSON.stringify(s1)} · ${await text(page, ".actionbar")})`);
  await setRounds(page, '12'); await page.keyboard.press('Tab'); await sleep(200);
  ok(!(await sb()).d, `[${width}] change again enables it`);
  await setRounds(page, '16'); await page.keyboard.press('Tab'); await sleep(200);
  ok((await sb()).d, `[${width}] editing back to the saved value disables it`);
  await setRounds(page, '10'); await page.keyboard.press('Tab'); await sleep(200);
  // leave with changes -> prompt
  // phones: the bottom tabs are hidden on the day editor (8 Oct 2026), so leave by an in-app link instead
  ok(width >= 600 || await page.$eval('nav.nav', (n) => getComputedStyle(n).display === 'none'), `[${width}] the day editor hides the bottom tabs on a phone`);
  if (width < 600) await page.evaluate(() => (location.hash = '#/report')); else if (width < 1024) await page.click('nav.nav a[href="#/report"]'); else await page.click('aside a[href="#/report"]');
  await sleep(400);
  const dlg = await page.evaluate(() => ({ open: [...document.querySelectorAll('dialog.sheet')].some((d) => d.open), hash: location.hash }));
  ok(dlg.open && dlg.hash.startsWith('#/day/'), `[${width}] leaving with changes asks first and stays on the day`);
  if (width === 390) await shot(page, 'day-leave-390');
  await clickText(page, 'dialog.sheet[open] button', /^Stay$/);
  // offline save
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(true); });
  await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].at(-1).click()); await sleep(500);
  const off = await text(page, '.actionbar');
  ok(/Not sent · no connection/.test(off) && !(await sb()).d, `[${width}] offline: message shown, Save stays enabled`);
  const q = await page.evaluate(async () => { const { idbKeys, idbGet } = await import('/src/lib/idb.js'); const k = await idbKeys('q:'); return { n: k.length, v: k.length ? await idbGet(k[0]) : null }; });
  ok(q.n === 1 && q.v?.patch?.rounds === 10, `[${width}] one local draft kept for the day (${JSON.stringify(q.v?.patch)})`);
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(false); });
  await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].at(-1).click()); await saveSettles(page);
  ok((await sb()).t === 'Saved ✓', `[${width}] back online, Save sends it`);
  const q2 = await page.evaluate(async () => (await (await import('/src/lib/idb.js')).idbKeys('q:')).length);
  ok(q2 === 0, `[${width}] the local draft is removed after the save`);
  ok(!(await hScroll(page)), `[${width}] day: no horizontal scroll`);

  // account: profile + photo
  await go(page, '#/account', 1200, '#h-about');
  // details are read-only until a section's pencil is tapped (4 Oct 2026)
  ok(!(await page.$('#pf-dob')) && (await page.$$('.esec-view')).length === 5 && (await page.$$('.esec-view input')).length === 0, `[${width}] profile on Account: five read-only sections (with Facilitator), no fields showing`);
  await page.click('button[aria-label="Edit about you"]'); await sleep(300);
  ok(!!(await page.$('#pf-dob')) && (await page.$$eval('.esec-pen', (l) => l.every((b) => b.disabled))), `[${width}] the pencil opens that section only (the others locked)`);
  await clickText(page, '.esec.on button', /^Cancel$/); await sleep(200);
  ok(!(await page.$('#pf-dob')) && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Edit about you', `[${width}] Cancel closes it and focus returns to the pencil`);
  if (width === 390 || width === 1280) {
    const input = await page.$('input[type=file]');
    await input.uploadFile('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/public/icons/icon-512.png');
    await page.waitForSelector('.crop canvas', { timeout: 5000 });
    await sleep(300);
    await page.focus('.crop'); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('+'); await page.keyboard.press('+');
    if (width === 390) await shot(page, 'photo-crop-390');
    await clickText(page, 'button', /^Use this photo$/);
    await page.waitForFunction(() => /Photo saved/.test(document.body.textContent), { timeout: 6000 }).catch(() => {});
    const img = await page.evaluate(() => { const i = document.querySelector('.photo img'); return i ? { w: i.naturalWidth, h: i.naturalHeight, len: i.src.length } : null; });
    ok(img && img.w === 400 && img.h === 400, `[${width}] photo cropped to 400x400 and shown (${JSON.stringify(img)})`);
    ok(img && img.len * 0.75 < 150 * 1024, `[${width}] photo under 150 KB (~${img ? Math.round(img.len * 0.75 / 1024) : '?'} KB)`);
  }
  ok(!(await hScroll(page)), `[${width}] account: no horizontal scroll`);
  await page.close();
}

// ---------------- coordinator ----------------
async function coordinator(width) {
  const page = await fresh(width, { clock: classDayIso('SUN') });
  await login(page, 'sps', 'sps-pass-12');
  await sleep(800);
  ok(/Birthdays/.test(await text(page, 'main, .content') || ''), `[${width}] staff home shows the birthdays card`);
  if (width < 1024) ok((await page.$$eval('nav.nav a', (l) => l.map((a) => a.textContent.trim()))).includes('Batch'), `[${width}] bottom tabs include Batch`);
  await go(page, '#/batch', 1000, 'li.brow');
  // Phase 22 F1: a coordinator of several class batches opens on "All my batches"; the one-batch tools (no regular class,
  // the class week) are on a single batch's board, so the checks below choose SPS first
  ok(/All my batches/.test(await page.$eval('#bt-batch', (s) => (s.selectedOptions ? s.selectedOptions[0].textContent : s.textContent)).catch(() => '')), `[${width}] several batches: the board opens on All my batches`);
  await sel(page, '#bt-batch', 'SPS'); await page.waitForFunction(() => /SPS/.test(document.querySelector('#bt-batch')?.textContent || document.querySelector('#bt-batch')?.value || ''), { timeout: 4000 }).catch(() => {});
  await sleep(600);
  const rows = (await page.$$('li.brow')).length;
  ok(rows === 12, `[${width}] board lists the batch (${rows})`);
  const chips = await page.$$eval('.scope button.sc-cell', (l) => l.map((b) => b.textContent.trim()));
  // #6 (22 Oct 2026): "All N" first, then the four, in one row
  // Phase 24 (V39): one row where the strip has room; in a strip under 400 px, All · Submitted · Filling over Not started ·
  // Missed — never five 54 px tiles with their words touching
  const strip = await page.$eval('.scope .sc-row', (e) => { const c = [...e.querySelectorAll('.sc-cell')].map((x) => x.getBoundingClientRect()); const sp = [...e.querySelectorAll('.sc-cell span')];
    return { w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, tops: c.map((r) => Math.round(r.top)), fit: sp.every((s) => s.scrollWidth <= s.parentElement.clientWidth + 1) }; });
  const twoRows = strip.tops[0] === strip.tops[2] && strip.tops[3] === strip.tops[4] && strip.tops[3] > strip.tops[0];
  ok(chips.length === 5 && /All/.test(chips[0]) && strip.fit && (strip.w > 400 ? strip.h < 70 : twoRows && strip.h < 130), `[${width}] summary counts, All first, ${strip.w > 400 ? 'one row' : '3 + 2 rows'}, every word inside its tile: ${chips.join(' | ')} (${Math.round(strip.h)} px)`);
  // D5 (22 Oct 2026): a strip — ‹ the week › — with the month and week lists in a sheet behind the week's label
  ok(!!(await page.$('#bd-wk-prev')) && !!(await page.$('#bd-wk-pick')) && !!(await page.$('#bd-wk-next')), `[${width}] week strip: before, the week, after`);
  // scrolled to the middle first: just into view, the strip sits under the sticky top bar and the tap lands on the bar
  await page.$eval('#bd-wk-pick', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); }); await page.waitForSelector('dialog[open] #bd-wk-m', { timeout: 4000 }).catch(() => {});
  ok(!!(await page.$('dialog[open] #bd-wk-m')) && !!(await page.$('dialog[open] #bd-wk-w')), `[${width}] … the month and week lists in its sheet`);
  await page.keyboard.press('Escape'); await sleep(300);
  await clickText(page, '.scope button.sc-cell', /Submitted/);
  const sub = (await page.$$('li.brow')).length;
  ok(sub > 0 && sub < rows, `[${width}] tapping a chip filters (${sub})`);
  await clickText(page, '.scope button.sc-cell', /Submitted/);
  ok(!!(await page.$('.pa button[data-self]')), `[${width}] the devotee's own mark shows dashed`);
  // Two marks, one save — on two rows that CAN be marked, rather than at positions 3 and 5. Which
  // rows carry buttons depends on who is active and what the filter left, so fixed positions made
  // the check depend on the fixture's order and clicked null when it changed.
  const marked = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('li.brow')].filter((r) => r.querySelectorAll('.pa button').length >= 2);
    if (rows.length < 2) return 0;
    rows[0].querySelectorAll('.pa button')[1].click();
    rows[1].querySelectorAll('.pa button')[0].click();
    return 2;
  });
  ok(marked === 2, `[${width}] two rows that can be marked (${marked})`);
  await sleep(200);
  ok(/2 attendance changes not saved/.test(await text(page, '.actionbar') || ''), `[${width}] unsaved marks counted`);
  if (width === 390) await shot(page, 'board-390');
  await clickText(page, '.actionbar button', /Save attendance/); await sleep(500);
  ok(/Attendance saved for 2 devotees/.test(await text(page, '.content') || ''), `[${width}] one Save saves both marks`);
  await page.evaluate(() => [...document.querySelectorAll('.toast button')].find((b) => b.textContent.trim() === 'Undo')?.click()); await sleep(500);
  ok(/Attendance put back/.test(await text(page, '.toasts') || ''), `[${width}] toast Undo puts the marks back`);
  const inactive = await page.$$eval('li.brow', (l) => l.filter((li) => /Not active/.test(li.textContent)).map((li) => li.querySelectorAll('.pa button').length));
  ok(inactive.length === 2 && inactive.every((n) => n === 0), `[${width}] inactive / disabled devotees get no attendance controls (${inactive.length})`);
  // no class this week
  await clickText(page, 'button', /No regular class this week\?/);
  await clickText(page, 'dialog.sheet[open] .seg button', /^Festival$/);
  await page.type('#cw-note', 'Diwali');
  await page.evaluate(() => document.querySelectorAll('dialog.sheet[open] input[type=radio]')[1].click());
  if (width === 390) await shot(page, 'classweek-sheet-390');
  await clickText(page, 'dialog.sheet[open] button', /^Save$/); await sleep(500);
  ok(/Festival · Diwali — only those you mark Present count/.test(await text(page, '.content') || ''), `[${width}] no-class banner shown`);
  ok((await page.$$eval('.pa', (l) => l.filter((p) => p.querySelectorAll('button').length === 1).length)) > 5, `[${width}] marked-only week: a single Present toggle per person`);
  if (width === 390 || width === 1280) await shot(page, `board-classweek-${width}`);
  await clickText(page, 'button', /^Change$/);
  await clickText(page, 'dialog.sheet[open] button', /Back to a regular class/); await sleep(500);
  ok(!/Diwali/.test(await text(page, '.content') || ''), `[${width}] back to a regular class`);
  // an earlier week, one tap on the strip (D5)
  await page.$eval('#bd-wk-prev', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); });
  await sleep(900);
  ok(/Attendance closed/.test(await text(page, '.content') || ''), `[${width}] an earlier week is read-only (closed)`);
  ok(!(await hScroll(page)), `[${width}] board: no horizontal scroll`);
  // stats
  await go(page, '#/stats', 1000, '.cb-plot');
  ok((await page.$$('.cb .cb-plot')).length === 2 && (await page.$$eval('.cb .cb-plot', (l) => l.map((p) => p.querySelectorAll('.cb-col').length))).join() === '7,8', `[${width}] filling chart: all 7 days and all 8 weeks at once`);
  const missed = await page.$$('section[aria-labelledby=st-m] a.rowlink');
  ok(missed.length > 0, `[${width}] missed list (${missed.length})`);
  if (width === 390 || width === 1280) await shot(page, `stats-${width}`);
  await missed[0].evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(150);   // never tap what sits behind the floating nav
  await missed[0].click(); await sleep(1000);
  ok((await page.evaluate(() => location.hash)).startsWith('#/devotee/'), `[${width}] missed row opens the devotee`);
  // devotee detail (one with a photo)
  await go(page, '#/devotee/6000000011', 1200, '#dv-name');
  await page.waitForSelector('.photo img', { timeout: 4000 }).catch(() => {});
  ok(!!(await page.$('.photo img')), `[${width}] devotee photo loads when on screen`);
  const tels = await page.$$eval('a[href^="tel:"]', (l) => l.map((a) => a.getAttribute('href')));
  ok(tels.length === 2 && tels[0] === 'tel:+916000000011', `[${width}] tap-to-call phone and emergency phone (${tels.join(', ')})`);
  const links = await page.evaluate(() => ({ wa: !!document.querySelector('a[href="https://wa.me/916000000011"]'), mail: !!document.querySelector('a[href="mailto:aarav.gupta@gmail.com"]') }));
  ok(links.wa && links.mail, `[${width}] devotee detail: WhatsApp (wa.me) and email (mailto) links`);
  await clickText(page, 'button', /^Change$/);
  await clickText(page, '#dv-cd button', /^Saturday$/);
  await clickText(page, 'button', /^Save$/);
  ok(!!(await page.$('#cf-t')) && (await page.evaluate(() => document.activeElement?.id)) === 'cf-t', `[${width}] actions confirm first (focus moves to the question)`);
  await clickText(page, '.confirm button', /Yes, save/); await sleep(500);
  ok(/Facilitator and class day saved/.test(await text(page, '.content') || '') && /Saturday/.test(await text(page, 'section[aria-labelledby=dv-people]') || ''), `[${width}] class day changed (no group leader any more)`);
  await clickText(page, 'button', /^Mark inactive$/);
  const fromOpts = (await wheelChoices(page, '#cf-from')).values;
  ok(fromOpts.length >= 2, `[${width}] inactive asks from which week (${fromOpts.length} choices)`);
  await clickText(page, '.confirm button', /^Mark inactive$/); await sleep(500);
  ok(/Inactive from this week/.test(await text(page, '.content') || ''), `[${width}] marked inactive`);
  if (width === 390) await shot(page, 'devotee-390');
  await go(page, '#/devotee/6000000016', 1000, '#dv-name');
  await clickText(page, 'button', /^Ask to reopen$/);
  await page.type('#cf-reason', 'Was unwell');
  await clickText(page, '.confirm button', /^Send request$/); await sleep(400);
  ok(/Request sent to the IYF head/.test(await text(page, '.content') || ''), `[${width}] coordinator asks to reopen a missed week`);
  await clickText(page, 'button', /^Delete account$/);
  await clickText(page, '.confirm button', /^Delete$/); await sleep(300);
  ok(/Type the phone number again/.test(await text(page, '.confirm') || ''), `[${width}] delete needs the phone typed again`);
  await clickText(page, '.confirm button', /^Cancel$/);
  ok(!(await hScroll(page)), `[${width}] devotee detail: no horizontal scroll`);
  // group leaders are back as appointed student devotees (decision 41): #/leaders opens their tab
  await go(page, '#/leaders', 900);
  ok((await page.evaluate(() => location.hash)) === '#/leaders' && (await page.$$eval('[role=tab]', (l) => l.some((t) => /Group leaders/.test(t.textContent) && t.getAttribute('aria-selected') === 'true'))), `[${width}] #/leaders opens the Group leaders tab`);
  // requests: the sign-up card shows email and WhatsApp, and asks for the class day
  // Phase 5: one inbox of rows; a row opens its card (a page on a phone, beside the list from 1024 px)
  await go(page, '#/requests', 900, '.mrow');
  ok((await page.$$('.mrow')).length >= 2 && /Sign-up/.test(await text(page, '.mb-list') || ''), `[${width}] requests: one inbox, each row with its type`);
  await go(page, '#/requests?open=su:6000000087', 900, 'article.card');
  const card = await page.evaluate(() => ({ mail: !!document.querySelector('article a[href^="mailto:"]'), wa: !!document.querySelector('article a[href^="https://wa.me/91"]'), cd: !!document.querySelector('article [id^="cd-"] .seg') }));
  ok(card.mail && card.wa && card.cd, `[${width}] sign-up card: email, WhatsApp, class day choice`);
  ok(!(await hScroll(page)), `[${width}] requests: no horizontal scroll`);
  await page.close();
}

// ---------------- master ----------------
async function master(width) {
  const page = await fresh(width);
  await login(page, 'master', 'master-pass-1');
  await sleep(800);
  if (width < 1024) { await page.click('.menu-btn'); await sleep(350); }
  if (width < 1024) { await page.keyboard.press('Escape'); await sleep(300); }
  // reopen requests are in the one Requests inbox (8 Oct 2026): their count is there, and #/reopens lands on it
  await go(page, '#/requests', 1200, '.rq-types');
  await page.waitForFunction(() => [...document.querySelectorAll('.rq-types button')].some((b) => /^Reopens\s*\d/.test(b.textContent.trim())), { timeout: 6000 }).catch(() => {});
  const tab = await page.$$eval('.rq-types button', (l) => l.map((b) => b.textContent.replace(/\s+/g, ' ').trim()).find((t) => /^Reopens/.test(t)) || '');
  await go(page, '#/requests?type=reopen', 1200, '#rq-ro-h');
  const badge = await text(page, '#rq-ro-h .pill');
  ok(/^Reopens ?1$/.test(tab) && badge === '1', `[${width}] Requests shows the reopen requests (${tab} · ${badge})`);
  await go(page, '#/reopens', 900, 'li.card, li.empty');
  ok((await page.$$('li.card')).length === 1, `[${width}] one reopen request`);
  await clickText(page, 'button', /^Reopen…$/);
  const until = await page.$eval('#ro-until', (i) => i.value);
  ok(/T21:00$/.test(until), `[${width}] open-until defaults to 9 PM, two days ahead (${until})`);
  if (width === 390) await shot(page, 'reopens-390');
  await clickText(page, '.confirm button', /^Reopen$/); await sleep(500);
  ok(/is open until/.test(await text(page, '.content') || '') && (await page.$$('li.card')).length === 0, `[${width}] reopened; the request leaves the list`);
  await go(page, '#/ids', 700, '#ids-q');
  await clickText(page, '.seg button', /^(Possible duplicates|Duplicates)$/); await sleep(500);
  const groups = await page.$$eval('.pill[data-tone]', (l) => l.map((p) => p.textContent));
  ok(groups.includes('Same phone, different names') && groups.includes('Same name, different phones'), `[${width}] duplicates, by kind: ${groups.join(', ')}`);
  ok(/share a phone \(often family members\) or a name/.test(await text(page, '.content') || '') && (await page.$$eval('button', (l) => l.filter((b) => b.textContent.trim() === 'Not duplicates').length)) >= 2, `[${width}] merge note and a "Not duplicates" button per group`);
  if (width === 390) await shot(page, 'duplicates-390');
  await clickText(page, '.seg button', /^Search$/);
  await page.type('#ids-q', 'Rahul'); await sleep(900);
  await clickText(page, 'li.card button', /^Details$/); await sleep(400);
  ok(/Phones/.test(await text(page, 'li.card') || ''), `[${width}] ID details`);
  // master on a devotee: attendance override
  await go(page, '#/devotee/6000000012', 1000, '#dv-name');
  await clickText(page, 'button', /^Change attendance$/);
  await clickText(page, '.confirm .seg button', /^Absent$/);
  await page.type('#cf-reason', 'Came late, marked absent');
  await clickText(page, '.confirm button', /^Save$/); await sleep(500);
  ok(/Attendance for the week of .*: absent/.test(await text(page, '.content') || ''), `[${width}] master attendance override`);
  ok(!(await hScroll(page)), `[${width}] master: no horizontal scroll`);
  await page.close();
}

// before the class day (Saturday): the board says when attendance opens; one Sunday class for everyone (decision 41), so nobody can be marked yet
async function beforeClass(width) {
  const page = await fresh(width, { clock: classDayIso('SAT') });
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/batch', 1000, 'li.brow');
  const t = `[${width} Saturday]`;
  // G12 (22 Oct 2026): the banner "Attendance opens Sunday … — the class day." went; the "Opens Sun" chip on each row says it
  ok(!/the class day\./.test(await text(page, '.content') || ''), `${t} board: no banner repeating what the row chips say`);
  // Phase 5: before the class day no P / A buttons at all (none that look already chosen) — an "Opens Sun" chip instead
  const r = await page.$$eval('li.brow', (l) => l.map((li) => ({ pa: li.querySelectorAll('.pa button').length, wait: /Opens Sun/.test(li.textContent), active: !/Not active/.test(li.textContent) })));
  ok(r.filter((x) => x.active).length > 0 && r.filter((x) => x.active).every((x) => !x.pa && x.wait), `${t} Saturday: nobody can be marked yet — "Opens Sun" on every active row, Saturday-class devotees too`);
  if (width === 390) await shot(page, 'board-saturday-390');
  await page.close();
}

// the master's facilitator list: add, switch off (gone from sign-up), delete; one list for every route
async function facilitatorsAdmin(width) {
  const page = await fresh(width);
  const t = `[${width} facilitators]`;
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/facilitators', 700, '.fac-row');
  const names = () => page.$$eval('.fac-row .lt', (l) => l.map((e) => e.textContent.trim()));
  const start = (await names()).length;   // the mock's list, however long it is
  ok(start >= 4 && (await page.$$eval('.fac-row input[role=switch]', (l) => l.every((e) => e.checked))), `${t} every name starts switched on (${start})`);
  ok(/Facilitators/.test(await text(page, 'h1, .topbar, header') || '') || (await page.$eval('[aria-current="page"], [aria-selected="true"]', (e) => e.textContent).catch(() => '')).includes('Facilitators'), `${t} Admin › Facilitators tab`);
  await page.type('#fac-new', 'madhav  das prabhuji'); await page.click('.fac-add button[type=submit]'); await sleep(500);
  // the list is the app's own (the head, 27 Oct 2026): an added name carries no "not on the dashboard yet" mark any more
  ok((await names()).includes('madhav das prabhuji') && !/dashboard/i.test(await text(page, '.list') || ''), `${t} added; no dashboard mark (the list is the app's own)`);
  const row = (n) => page.evaluateHandle((n) => [...document.querySelectorAll('.fac-row')].find((r) => r.querySelector('.lt').textContent.trim() === n), n);
  await (await row('Jaya Vamandev Prabhuji')).asElement().$eval('input[role=switch]', (e) => e.click()); await sleep(500);
  ok(await (await row('Jaya Vamandev Prabhuji')).asElement().$eval('input[role=switch]', (e) => !e.checked), `${t} switched off`);
  const meta = await page.evaluate(async () => (await (await import('/src/lib/meta.js')).refreshMeta()).facilitators);
  ok(!meta.includes('Jaya Vamandev Prabhuji') && meta.includes('madhav das prabhuji'), `${t} sign-up list follows at once (${meta.length} offered)`);
  const su = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); try { await call('auth.signUp', { phone: '6000000177', name: 'Test Person', batchId: 'SPS', facilitator: 'Jaya Vamandev Prabhuji', classDay: 'SUN', email: 'a@gmail.com', password: 'lotus-feet-108', profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Father', phone: '6000000066' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } }); return 'ok'; } catch (e) { return e.code || String(e); } });
  ok(su === 'VALIDATION', `${t} a sign-up with a switched-off name is refused (${su})`);
  await clickText(page, '.chipbtn', /Switched off/);
  ok((await names()).join() === 'Jaya Vamandev Prabhuji', `${t} "Switched off" filter`);
  await page.$eval('button[aria-label="Delete Jaya Vamandev Prabhuji"]', (e) => { e.scrollIntoView({ block: 'start' }); e.click(); }); await sleep(300);
  ok(await page.$eval('dialog[aria-labelledby=fac-del-t]', (d) => d.open), `${t} delete asks first`);
  if (width === 390) await shot(page, 'facilitators-delete-390');
  await clickText(page, 'dialog.sheet button', /^Delete$/); await sleep(600);
  await clickText(page, '.chipbtn', /^\d*All$/);
  ok(!(await names()).includes('Jaya Vamandev Prabhuji') && (await names()).length === start, `${t} deleted from the list (one added, one deleted: ${start})`);
  ok(!(await hScroll(page)), `${t} no sideways scroll`);
  await shot(page, `facilitators-${width}`);
  await page.close();
}

// the devotee form and report as redesigned (3 Oct): wheels, rules sheet, day score /100, docked Save bar, report layout
async function devoteeDesign(width) {
  const page = await fresh(width);
  const t = `[${width} design]`;
  await login(page, '6000000001', 'pass-12345');
  const today = await page.evaluate(() => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  const mon = await page.evaluate((x) => { const d = new Date(x + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }, today);
  await go(page, `#/day/${mon}/${today}`, 800, '#f-sleptAt-btn');
  ok(!(await page.$('.mark')) && !/\+\d{2}\b/.test(await text(page, '.grid2') || ''), `${t} no marks or score ranges beside the answers`);
  await page.evaluate(() => [...document.querySelectorAll('.jscore, .dr-rules')].find((b) => b.getClientRects().length)?.click()); await sleep(400);
  ok(await page.evaluate(() => { const d = document.querySelector('dialog.rules-sheet'); return d.open && d.querySelectorAll('.ru-list li').length > 10 && /How your day is scored/.test(d.textContent); }), `${t} "How your day is scored" opens the batch's score card`);
  await page.evaluate(() => document.querySelector('dialog.rules-sheet').close()); await sleep(200);
  ok(/Day score\s*0\s*\/100/.test(await text(page, '.actionbar') || ''), `${t} day score shown out of 100 (${await text(page, '.actionbar .sum')})`);
  const pos = await page.$eval('.actionbar', (e) => getComputedStyle(e).position);
  ok(width < 1024 ? pos === 'fixed' : pos === 'sticky', `${t} Save bar docked (${pos})`);
  const y0 = await page.$eval('.actionbar', (e) => e.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollBy(0, 600)); await sleep(300);
  const y1 = await page.$eval('.actionbar', (e) => e.getBoundingClientRect().top);
  if (width < 1024) ok(Math.abs(y1 - y0) < 1, `${t} Save bar stays put while scrolling (${Math.round(y0)} → ${Math.round(y1)})`);
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  await page.click('#f-sleptAt-btn'); await sleep(500);
  ok((await page.$$('dialog[open] [role=spinbutton]')).length === 3, `${t} time sheet: hour, minute and AM/PM wheels`);
  await page.focus('dialog[open] [role=spinbutton][aria-label=Hour]'); await page.keyboard.press('ArrowDown'); await sleep(400);
  const pv = await text(page, '.tp-preview');
  await clickText(page, 'dialog[open] button', /^Done$/); await sleep(300);
  ok(pv === '11:00 PM' && (await text(page, '#f-sleptAt-btn')) === '11:00 PM', `${t} a wheel moves with the keyboard; Done sets the time (${pv})`);
  ok(/Day score\s*\d+\s*\/100/.test(await text(page, '.actionbar') || ''), `${t} score updates`);
  // the visible Save: the floating bar on a phone, the rail from 1024 px (C8, 22 Oct 2026)
  await clickText(page, '.actionbar button, .dayrail button', /^Save changes$/); await sleep(900);
  await go(page, '#/report', 1200, '.cal');
  // one line when Daily / Weekly fits beside month and year at its natural width; else (most phones, 5 Oct 2026: never
  // squeezed, "Weekly" spilled out) month and year on one line and the toggle on its own, full width
  // Phase 4: Daily / Weekly first, then month and year (one line, or the toggle above at full width)
  const bar = await page.evaluate(() => { const b = document.querySelector('.rp-bar'), k = [...b.children].map((e) => e.getBoundingClientRect()), mid = (r) => Math.round(r.top + r.height / 2);
    return { n: k.length, one: Math.max(...k.map(mid)) - Math.min(...k.map(mid)) <= 2, pair: Math.abs(mid(k[1]) - mid(k[2])) <= 2, above: k[1].top >= k[0].bottom, full: Math.abs(k[0].width - b.clientWidth) <= 1 }; });
  ok(bar.n === 3 && (bar.one || (bar.pair && bar.above && bar.full)), `${t} Daily/Weekly first; month and year together on one line (${bar.one ? 'one line' : 'toggle above'})`);
  const rows = await page.$eval('.cal', (g) => getComputedStyle(g).gridTemplateRows.split(' ').slice(1));
  ok(new Set(rows).size === 1, `${t} calendar rows all the same height (${rows.join(' ')})`);
  ok(!(await page.$('.cal-d i')), `${t} calendar shows numbers only (no dots)`);
  await page.evaluate((d) => [...document.querySelectorAll('.cal-d')].find((x) => x.getAttribute('aria-label')?.startsWith(d))?.click(), await page.evaluate((x) => { const [y, m, d] = x.split('-'); return `${d} `; }, today)); await sleep(500);
  // Phase 4: meters — every score at once, full labels, the total first
  const lbl = await page.evaluate(() => [...document.querySelectorAll('.m-list .m-l')].map((l) => [l.textContent.trim(), l.scrollWidth <= l.clientWidth + 1]));
  ok(lbl.length === 7 && lbl.every((x) => x[1]) && lbl[0][0] === 'Total' && [...lbl.map((x) => x[0])].sort().join() === ['Total', 'Sleep', 'Wake-up', 'Day rest', 'Chanting', 'Reading', 'Hearing'].sort().join(), `${t} activity meters: full labels, nothing cut (${lbl.map((x) => x[0]).join(', ')})`);
  ok(await page.$eval('.m-list', (e) => e.scrollWidth <= e.clientWidth + 1), `${t} meters: all shown at once (no sideways slide)`);
  ok(!(await hScroll(page)), `${t} no sideways page scroll`);
  await page.close();
}

// 3 Oct (2): the verse is on the welcome screen only; the Account card shows the profile photo once set
async function authAndAvatar(width) {
  const page = await fresh(width);
  const t = `[${width} auth+avatar]`;
  for (const h of ['#/login', '#/signup', '#/forgot']) {
    await go(page, h, 900);
    // (Phase 9: the desktop sign-in panel beside the form carries the verse of the day — never one by the form itself)
    ok(!(await page.$('.wl-quote:not(.wl-in-panel)')) && !(await page.$('.auth-card .wl-quote')) && !!(await page.$('.auth-card')), `${t} ${h}: the form, no verse below it`);
  }
  await go(page, '#/welcome', 900);
  ok(!!(await page.$('.wl-quote')), `${t} the welcome screen keeps the verse of the day`);
  await go(page, '#/login', 700, '#login');
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/account', 1200, '#acc-name');
  ok(!(await page.$('section[aria-labelledby="acc-name"] .avatar-photo')), `${t} no photo yet: the initial`);
  await page.evaluate(async () => { const { session } = await import('/src/lib/session.svelte.js'); session.user = { ...session.user, photoAt: '2026-10-03T11:47:00+05:30' }; });
  await sleep(600);
  ok(!!(await page.$('section[aria-labelledby="acc-name"] .avatar-photo')), `${t} photo set: the Account card shows it (as the menu does)`);
  await page.close();
}

// sign-up in 4 steps (Phase 3, 8 Oct 2026): each step checked before the next; the draft survives a reload; the
// server's own message (email typo) brings you back to its step; age 15+ and a parent or guardian for 15–17
async function signUpFlow(width) {
  let page = await fresh(width);
  await go(page, '#/signup', 700, '#su-form');
  const t = `[${width} sign-up]`;
  const fill = async (sel, v) => { await page.$eval(sel, (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.type(sel, v); };
  const stepIs = () => text(page, '#su-step-h');
  const next = async () => { await page.click('#su-form button[type=submit]'); await sleep(350); };
  const setDob = (v) => page.$eval('#su-dob', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  ok(/^Step 1 of 4 · About you$/.test(await stepIs() || ''), `${t} step 1 of 4: About you`);
  await fill('#su-phone', '6000000055'); await fill('#su-name', 'Madhav Sharma'); await fill('#su-email', 'madhav@gmial.com');
  await setDob('2001-05-05'); await sel(page, '#su-bg', 'O+');
  ok(/Did you mean madhav@gmail\.com\?/.test(await text(page, '#su-email-h') || ''), `${t} common email typo hinted while typing`);
  ok(!!(await page.$('#su-wa-q')) && !(await page.$('#su-wa')), `${t} "Is this number on WhatsApp?" asked right after the number, unanswered`);
  // the number is looked up as soon as it is typed (the user, 11 Oct 2026): a devotee we already hold is told so,
  // a number we do not hold is told nothing at all — and the lookup must never block anyone from signing up
  /* The number is looked up on blur, so filling the next field starts a request that is still in flight
     here. Wait for it to finish before asserting it left nothing behind — the old fixed sleeps asserted
     mid-request, and the spinner they caught then failed every later step of this flow. */
  await page.waitForFunction(() => !document.getElementById('su-looking'), { timeout: 8000 }).catch(() => {});
  ok(!(await page.$('#su-known')), `${t} a number we do not hold says nothing: the lookup cannot be used to learn who is in the records`);
  ok(!(await page.$('#su-looking')), `${t} and nothing is left spinning`);
  await next();
  ok(/Step 1 of 4/.test(await stepIs() || '') && /Choose Yes or No/.test(await text(page, '#su-form') || '') && /Did you mean madhav@gmail\.com\?/.test(await text(page, '#su-email-e') || ''), `${t} Next checks this step first (the WhatsApp answer, the email typo)`);
  // an address only the server refuses (it cannot receive mail): sent later, it must bring the person back here
  await fill('#su-email', 'madhav@nomail.test');
  // age: under 15 refused; 15–17 a parent or guardian (DPDP Act 2023)
  await clickText(page, '#su-wa-q button', /^No$/); await sleep(100);
  ok(!!(await page.$('#su-wa')), `${t} "No": an optional WhatsApp number field`);
  await setDob('2013-05-05'); await next();
  ok(/at least 15/.test(await text(page, '#su-dob-e') || '') && !(await page.$('#su-pn')), `${t} under 15 refused`);
  await setDob('2010-05-05'); await sleep(200);
  ok(!!(await page.$('#su-pn')) && !!(await page.$('#su-pp')) && !!(await page.$('#su-pa')), `${t} 15–17: a parent or guardian section appears`);
  await next();
  ok(/must agree/.test(await text(page, '#su-pa-e') || '') && /2 to 60 letters/.test(await text(page, '#su-pn-e') || ''), `${t} …and is required`);
  await setDob('2001-05-05'); await sleep(200);
  ok(!(await page.$('#su-pn')), `${t} 18 or over: no parent section`);
  await next();
  ok(/^Step 2 of 4 · Your batch and class$/.test(await stepIs() || ''), `${t} step 2: batch and class`);
  await sel(page, '#su-batch', 'SPS'); await sel(page, '#su-fac', 'Natvar Gopinath Prabhuji');
  await next();
  ok(/Step 2 of 4/.test(await stepIs() || '') && /Choose Sunday or Saturday/.test(await text(page, '#su-cd') || ''), `${t} the class day is required`);
  await clickText(page, '#su-cd button', /^Saturday$/); await next();
  // 11 Oct 2026 (the user): "with IYF Delhi since" is required; profession and the service skills stay optional.
  // Skills replaced the old free-text "hobbies" box the same day: they are chosen from a fixed list (shared/skills.js)
  // so a coordinator can search them, and the list is collapsed to one row so the form does not grow.
  const field = (id) => page.evaluate((i) => document.getElementById(i)?.closest('.field')?.textContent.replace(/\s+/g, ' ') || '', id);
  ok(/Step 2 of 4/.test(await stepIs() || '') && /Choose the year you first came to IYF Delhi/.test(await field('su-since')), `${t} "with IYF Delhi since" is required (Next stops on it)`);
  const skillsRow = () => page.evaluate(() => document.getElementById('su-skills-toggle')?.textContent.replace(/\s+/g, ' ') || '');
  ok(!/optional/i.test(await field('su-since')) && /optional/i.test(await field('su-occ')) && /optional/i.test(await skillsRow()), `${t} profession and skills are marked optional; "since" is not`);
  ok(/None chosen/.test(await skillsRow()), `${t} skills start with none chosen, collapsed to one row`);
  const thisYear = await page.evaluate(() => String(new Date().getFullYear()));
  await sel(page, '#su-since', thisYear); await next();
  ok(/^Step 3 of 4 · Your address$/.test(await stepIs() || ''), `${t} step 3: address (someone new chose this year)`);
  // the draft: a reload keeps the answers and the step (never the passwords)
  await page.reload({ waitUntil: 'networkidle0' }); await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 5000 }).catch(() => {}); await sleep(300);
  await page.evaluate(async () => (await import('/src/lib/mock.js')).setLatency(60));   // the mock's speed resets with the page
  ok(/Step 3 of 4/.test(await stepIs() || '') && (await page.$eval('#su-name', (e) => e.value)) === 'Madhav Sharma', `${t} a reload keeps the draft and the step`);
  // the Back button only exists past step 0, and the reload above restores the step asynchronously: wait for
  // the button rather than clicking into a form that has not finished rehydrating
  await page.waitForSelector('#su-form .su-back', { timeout: 8000 });
  await page.click('#su-form .su-back'); await sleep(300);
  ok(/Step 2 of 4/.test(await stepIs() || ''), `${t} Back returns to the step before`);
  await next();
  // Phase 9 (item 13): the address in parts; a PIN of another state fills that state (and asks for the city instead)
  ok(!!(await page.$('#su-ad-ah')) && !!(await page.$('#su-ad-as')) && !!(await page.$('#su-ad-lm')) && (await page.$eval('#su-ad-ap', (e) => e.inputMode)) === 'numeric', `${t} step 3: house, street, landmark, and a number pad for the PIN`);
  await fill('#su-ad-ap', '560001'); await sleep(300);
  ok(!!(await page.$('#su-ad-ci[type=text], input#su-ad-ci')) && /From the PIN code/.test(await page.evaluate(() => document.getElementById('su-ad-st')?.closest('.field')?.textContent || '')), `${t} a Bengaluru PIN fills Karnataka and asks for the city`);
  await page.$eval('#su-ad-ap', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await fill('#su-ad-ap', '110026'); await sleep(300);
  await sel(page, '#su-ad-ci', 'West Delhi'); await fill('#su-ad-ah', 'House 12'); await fill('#su-ad-as', 'Gali 3'); await fill('#su-ad-aa', 'Punjabi Bagh');
  await next();
  ok(/^Step 4 of 4 · Emergency contact and password$/.test(await stepIs() || ''), `${t} step 4: emergency contact and password`);
  await fill('#su-pw', 'lotus-feet-108'); await fill('#su-pw2', 'lotus-feet-108');
  await fill('#su-en', 'Gopal Sharma'); await sel(page, '#su-er', 'Father'); await fill('#su-ep', '6000000066');
  await next();
  ok(/Agree to the privacy policy/.test(await text(page, '#su-priv-e') || '') && !!(await page.$('label a[href="/privacy.html"]')), `${t} privacy policy agreement required, with a link to the policy`);
  await page.click('#su-priv'); await next();
  await page.waitForFunction(() => /Step 1 of 4/.test(document.getElementById('su-step-h')?.textContent || ''), { timeout: 6000 }).catch(() => {});
  ok(/Step 1 of 4/.test(await stepIs() || '') && /cannot receive email/.test(await text(page, '#su-email-e') || ''), `${t} the server's email message brings you back to step 1, under the field`);
  await fill('#su-email', 'madhav@gmail.com');
  for (let i = 0; i < 3; i++) await next();
  await fill('#su-pw', 'lotus-feet-108'); await fill('#su-pw2', 'lotus-feet-108');
  await next();
  await page.waitForFunction(() => /Waiting for your coordinator's approval/.test(document.querySelector('main')?.textContent || ''), { timeout: 6000 }).catch(() => {});
  ok(/Waiting for your coordinator's approval/.test(await text(page, 'main') || ''), `${t} sent: waiting for approval`);
  ok(await page.evaluate(() => !localStorage.getItem('sr.signupDraft')), `${t} the draft is cleared once sent`);
  ok(!(await hScroll(page)), `${t} no horizontal scroll`);
  await page.close();
}

// devotee: profile email / WhatsApp / class day; own attendance opens after the class day
async function devoteeContact(width) {
  const page = await fresh(width);
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/account', 1200, '#h-contact');
  const t = `[${width} devotee profile]`;
  // centred first: just above the floating bottom bar, a tap at its spot would land on the bar
  await page.$eval('button[aria-label="Edit contact details"]', (b) => b.scrollIntoView({ block: 'center' }));
  await page.waitForSelector('button[aria-label="Edit contact details"]', { timeout: 8000 }).catch(() => {}); await page.$eval('button[aria-label="Edit contact details"]', (b) => b.scrollIntoView({ block: 'center' })); await page.click('button[aria-label="Edit contact details"]'); await sleep(300);
  ok((await page.$eval('#pf-email', (e) => e.value)) === 'sunil.kumar@gmail.com', `${t} contact details open for editing with the saved email`);
  await clickText(page, '.esec.on button', /^Cancel$/); await sleep(200);
  const aboutText = () => page.$eval('#h-about', (h) => h.closest('section').textContent);
  ok(/Sunday class/.test(await aboutText()), `${t} class day shown read-only (Sunday class)`);
  // the class day is the devotee's own choice (4 Oct 2026): About you › pencil › Saturday › Save, and back
  await page.waitForSelector('button[aria-label="Edit about you"]', { timeout: 8000 }).catch(() => {});
  await page.$eval('button[aria-label="Edit about you"]', (b) => b.scrollIntoView({ block: 'center' }));
  await page.waitForSelector('button[aria-label="Edit about you"]', { timeout: 8000 }).catch(() => {}); await page.$eval('button[aria-label="Edit about you"]', (b) => b.scrollIntoView({ block: 'center' })); await page.click('button[aria-label="Edit about you"]'); await sleep(300);
  ok((await page.$$eval('#pf-cd button', (l) => l.map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')).join())) === 'Sunday:true,Saturday:false', `${t} class day changeable once About you is opened`);
  await clickText(page, '#pf-cd button', /^Saturday$/); await clickText(page, '.esec.on button', /^Save$/);
  await page.waitForFunction(() => !document.getElementById('pf-cd'), { timeout: 5000 }).catch(() => {}); await sleep(200);
  ok(/About you saved/.test(await text(page, 'body') || '') && /Saturday class/.test(await aboutText()) && !(await page.$('#pf-cd')), `${t} class day changed to Saturday, section locked again`);
  await page.waitForSelector('button[aria-label="Edit about you"]', { timeout: 8000 }).catch(() => {});
  await page.$eval('button[aria-label="Edit about you"]', (b) => b.scrollIntoView({ block: 'center' }));
  await page.waitForSelector('button[aria-label="Edit about you"]', { timeout: 8000 }).catch(() => {}); await page.$eval('button[aria-label="Edit about you"]', (b) => b.scrollIntoView({ block: 'center' })); await page.click('button[aria-label="Edit about you"]'); await sleep(300);
  await clickText(page, '#pf-cd button', /^Sunday$/); await clickText(page, '.esec.on button', /^Save$/);
  await page.waitForFunction(() => !document.getElementById('pf-cd'), { timeout: 5000 }).catch(() => {}); await sleep(300);
  await page.waitForSelector('button[aria-label="Edit contact details"]', { timeout: 8000 }).catch(() => {}); await page.$eval('button[aria-label="Edit contact details"]', (b) => b.scrollIntoView({ block: 'center' })); await page.click('button[aria-label="Edit contact details"]'); await sleep(300);
  await page.$eval('#pf-email', (e) => { e.value = 'sunil@gmial.com'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await clickText(page, '.esec.on button', /^Save$/); await sleep(300);
  ok(/Did you mean sunil@gmail\.com\?/.test(await text(page, '#pf-email-e') || ''), `${t} email typo caught before sending`);
  const wk = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.endsWith('|home.get')))).data.weeks.at(-1));
  await go(page, '#/week/' + wk.weekId, 1000, '#f-attendance');
  const r = await page.evaluate((o) => ({ early: Date.now() < Date.parse(o), dis: [...document.querySelectorAll('#f-attendance button')].every((b) => b.disabled), hint: /Attendance opens on Sunday/.test(document.querySelector('ul.ready')?.textContent || '') }), wk.attendance.opensAt);   // when: said once, in the readiness list (Phase 24, V23)
  ok(r.early ? r.dis && r.hint : !r.dis, `${t} own attendance ${r.early ? 'waits for the Sunday class (disabled, explained)' : 'is open after the class'}`);
  await page.close();
}


// ---------------- welcome, splash, theme colour per area ----------------
const themeColor = (page) => page.$eval('meta[name="theme-color"]', (m) => m.content);
// D1 (8 Oct 2026): one brand colour (the logo blue) in every area, so the browser bar is the same everywhere; the area
// shows only as a marker (the area tag, the menu dot), in its own colour
const ACCENT = { public: '#004fdc', devotee: '#004fdc', coordinator: '#004fdc', admin: '#004fdc' };
const MARKER = { devotee: 'rgb(0, 79, 220)', coordinator: 'rgb(161, 74, 8)', admin: 'rgb(122, 35, 70)' };
async function welcomeFlow(width) {
  const t = `[${width} welcome]`;
  const html = await (await fetch(BASE + '/')).text();
  ok(/id="splash"/.test(html) && /IYF Delhi/.test(html) && /class="sp-name[^"]*">Sādhana Record</.test(html) && /class="sp-sub[^"]*">Every Day, A Step Closer to Kṛṣṇa.</.test(html) && !/<style|\sstyle="/.test(html), `${t} the splash is plain HTML in index.html (no inline style: CSP)`);
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: 800 });
  await page.evaluateOnNewDocument(() => {            // a charged battery: see fresh() above
    const b = new EventTarget(); b.level = 1; b.charging = true; b.chargingTime = 0; b.dischargingTime = Infinity;
    try { Object.defineProperty(Navigator.prototype, 'getBattery', { get: () => () => Promise.resolve(b), configurable: true }); } catch { /* fixed */ }
    // and a good connection, for the same reason: tier.js drops to 'low' on data saver, 2G or rtt ≥ 1500 ms
    const c = new EventTarget(); c.effectiveType = '4g'; c.rtt = 50; c.downlink = 10; c.saveData = false;
    try { Object.defineProperty(Navigator.prototype, 'connection', { get: () => c, configurable: true }); } catch { /* fixed */ }
  });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  page.on("pageerror", (e) => errs.push(`[${width}] PAGEERR ${e.message}${process.env.STACK ? " " + (e.stack || "").split("\n").slice(1, 4).join(" | ") : ""}`));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(2400);                                         // the splash stays at least 1.4 s, then fades over 420 ms
  ok(!(await page.$('#splash')), `${t} the splash fades out and leaves the page`);
  ok((await page.evaluate(() => location.hash)) === '#/welcome' && /^Sādhana Record$/.test(await text(page, 'h1') || '') && /ISKCON Youth Forum/.test(await text(page, '.lockup') || ''), `${t} signed out: the welcome screen`);
  ok(/^New accounts require coordinator approval\.$/.test(await text(page, '.auth-foot') || '') && /^Your details stay private\. · Privacy$/.test((await text(page, '.wl-trust') || '').trim()), `${t} under Create an account: the approval line, then the privacy line`);
  // today's darshan (Phase 3): the hero on phones, the side panel on the desktop; it starts from today's painting
  await page.waitForFunction(() => [...document.querySelectorAll('.darshan img')].some((i) => i.complete && i.naturalWidth && i.getClientRects().length), { timeout: 8000 }).catch(() => {});
  const dv = await page.evaluate(() => { const i = [...document.querySelectorAll('.darshan img')].find((x) => x.getClientRects().length); return i ? { alt: i.alt, panel: !!i.closest('.wl-side'), src: i.currentSrc } : null; });
  ok(!!dv && /^Darshan: /.test(dv.alt) && dv.panel === (width >= 1024) && /\/darshan\/[dv]\d\d+-\d+\.(webp|avif)$/.test(dv.src), `${t} today's darshan as ${width >= 1024 ? 'the side panel' : 'the hero'} (${dv?.alt}, ${dv?.src?.split('/').pop()})`);
  // the verse sits on the painting: the side panel on the desktop, the hero on phones (9 Oct 2026)
  const q = await page.$eval(width >= 1024 ? '.wl-side .wl-in-panel' : '.wl-hero .wl-in-panel', (e) => e.textContent);
  ok(/“.+”/.test(q) && /(Bhagavad|Bhāgavatam|Caitanya)/.test(q), `${t} a verse with its reference, on the painting`);
  if (width < 1024) {
    const L = await page.evaluate(() => { const h = document.querySelector('.wl-hero figure').getBoundingClientRect(), b = document.querySelector('a[href="#/login"]').getBoundingClientRect(); return { r: h.width / h.height, hh: h.height, vh: innerHeight, signIn: b.bottom, pause: !!document.querySelector('.dv-pause, .wl-hero button') }; });
    ok(L.hh <= L.vh * 0.56 && L.r >= 0.78 && L.signIn <= L.vh && !L.pause, `${t} phone: the painting framed (${(L.r).toFixed(2)}, ${Math.round(L.hh)} px), Sign in on the first screen (${Math.round(L.signIn)} ≤ ${L.vh}), no button on the picture`);
  }
  ok((await areaNow(page)).html === 'public' && (await themeColor(page)) === ACCENT.public, `${t} the brand blue before sign-in too; browser bar ${await themeColor(page)}`);
  ok(!(await hScroll(page)), `${t} no horizontal scroll`);
  if (width === 390) await shot(page, 'welcome-390');
  await page.click('a[href="#/login"]'); await sleep(500);
  ok((await page.evaluate(() => location.hash)) === '#/login' && !!(await page.$('#login')), `${t} Sign in → the sign-in form`);
  await page.click('a[aria-label="Back to the welcome screen"]'); await sleep(400);
  await page.click('a[href="#/signup"]'); await sleep(900);
  ok((await page.evaluate(() => location.hash)) === '#/signup' && !!(await page.$('#su-form')), `${t} Create an account → sign-up`);
  // signed in: straight to Home on the next visit, no welcome; the bar follows the area
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
  await go(page, '#/login', 500, '#login');
  await page.type('#login', '6000000001'); await page.type('#password', 'pass-12345'); await page.click('button[type=submit]');
  await page.waitForFunction(() => location.hash === '#/home', { timeout: 8000 }).catch(() => {});
  await sleep(600);
  ok((await themeColor(page)) === ACCENT.devotee, `${t} after sign-in the browser bar is the same brand blue (${await themeColor(page)})`);
  await page.close(); await ctx.close();
}
async function areaColours(width) {
  const page = await fresh(width);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await login(page, 'guru', 'guru-pass-12');
  const t = `[${width} theme-color]`;
  for (const [h, a, label] of [['#/home', 'devotee', 'My sadhana'], ['#/batch', 'coordinator', 'My batch'], ['#/overview', 'admin', 'Admin']]) {
    await go(page, h, 900);
    const [tag, col] = await page.evaluate((w) => { const l = [...document.querySelectorAll(w < 1024 ? '.topbar .area-tag' : '.sidebar .area-tag')]; return [l.map((e) => e.textContent.trim()).join(''), l[0] ? getComputedStyle(l[0]).color : '']; }, width);
    ok((await themeColor(page)) === ACCENT[a] && (h === '#/home' && width < 1024 ? true : tag === label && col === MARKER[a]), `${t} ${h}: bar ${await themeColor(page)}, area named "${tag}" in its marker colour (${col})`);
  }
  // danger (scarlet) is not the admin colour (burgundy)
  const c = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.shell')); return [s.getPropertyValue('--danger').trim(), s.getPropertyValue('--accent').trim()]; });
  ok(c[0] !== c[1], `${t} admin area: danger ${c[0]} ≠ accent ${c[1]}`);
  await page.evaluate(async () => (await import('/src/lib/session.svelte.js')).logout());
  await page.waitForFunction(() => location.hash === '#/welcome', { timeout: 4000 }).catch(() => {}); await sleep(200);
  ok((await page.evaluate(() => location.hash)) === '#/welcome' && (await themeColor(page)) === ACCENT.public, `${t} log out: back to the welcome screen, brand bar`);
  await page.close();
}

// ---------------- professional touches ----------------
async function proFeatures(width) {
  const t = `[${width} pro]`;
  // skeletons: shown on a slow connection, then the content swaps in without layout shift
  let page = await fresh(width);
  await login(page, '6000000001', 'pass-12345');
  await page.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(1500); });
  await go(page, '#/reading', 0);
  await sleep(450);
  const sk = await page.evaluate(() => ({ n: document.querySelectorAll('.skw .sk').length, op: getComputedStyle(document.querySelector('.skw') || document.body).opacity }));
  ok(sk.n > 3, `${t} slow load: a shimmer skeleton shaped like the list (${sk.n} shapes)`);
  await page.waitForSelector('ul[aria-label=Books]', { timeout: 8000 }).catch(() => {});
  await sleep(300);
  ok(!(await page.$('.skw')) && (await page.evaluate(() => window.__cls)) < 0.05, `${t} content replaces it without layout shift (CLS ${(await page.evaluate(() => window.__cls)).toFixed(3)})`);
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(60); });
  // focus and announce on a new page
  await go(page, '#/hearing', 900, '.wkstrip');
  ok(await page.evaluate(() => document.activeElement?.classList.contains('pagetitle') && document.activeElement.textContent.includes('Hearing')), `${t} a new page focuses its title`);
  ok(/Hearing/.test(await page.$eval('main .sr-only[aria-live]', (e) => e.textContent)), `${t} …and announces it`);
  // offline: the slim bar, then "Back online"
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(true); });
  await page.evaluate(async () => { try { await (await import('/src/lib/api.js')).call('announcements.list'); } catch { /* offline */ } });
  await sleep(200);
  ok(/You're offline — changes stay on this phone/.test(await text(page, '.netbar') || ''), `${t} offline bar after a failed call`);
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(false); await (await import('/src/lib/api.js')).call('announcements.list'); });
  await sleep(200);
  ok(!(await page.$('.netbar')) && /Back online/.test(await text(page, '.toasts') || ''), `${t} back online: bar gone, a toast says so`);
  // install: the browser's offer appears in the menu
  await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); dispatchEvent(e); });
  await sleep(150);
  ok(await page.evaluate(() => [...document.querySelectorAll('.menu .mi')].some((m) => /Install the app/.test(m.textContent))), `${t} "Install the app" offered in the menu`);
  await page.close();
  // already installed (standalone): no install offer
  const ctx = await browser.createBrowserContext();
  page = await ctx.newPage();
  await page.setViewport({ width, height: 800 });
  await page.evaluateOnNewDocument(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(60); });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 5000 }).catch(() => {});
  await login(page, '6000000001', 'pass-12345');
  await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; e.userChoice = Promise.resolve({}); dispatchEvent(e); localStorage.setItem('sr.reminderAsk', '1'); });
  await sleep(300);
  ok(!(await page.evaluate(() => /Install Sadhana Record/.test(document.body.textContent))), `${t} installed app (standalone): no install card`);
  // the reminder switch: permission asked only from the tap, then push.subscribe
  await page.evaluateOnNewDocument(() => {});
  await page.evaluate(() => {
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-1', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/test-1', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }), unsubscribe: async () => true };
    let have = null;
    const reg = { pushManager: { getSubscription: async () => have, subscribe: async () => (have = sub) } };
    Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), controller: null, addEventListener() {} }, configurable: true });
    window.PushManager = function () {};
    let perm = 'default';
    window.Notification = { get permission() { return perm; }, requestPermission: async () => (window.__asked = (perm = 'granted')) };
  });
  await go(page, '#/account', 1200, '#h-rem');
  ok(!(await page.evaluate(() => window.__asked)), `${t} the reminder never asks for permission by itself`);
  await page.evaluate(() => document.querySelector('#h-rem').parentElement.querySelector('input[role=switch]').click());
  await sleep(800);
  ok(await page.evaluate(() => window.__asked === 'granted' && document.querySelector('#h-rem').parentElement.querySelector('input[role=switch]').checked), `${t} reminder on: permission from the tap, subscribed`);
  await page.close(); await ctx.close();
}

// Phase 5: "Fill for" sits in a board row's ⋯ sheet: open rows' sheets until one offers it; returns its link (sheet left open)
async function fillLink(page) {
  const n = (await page.$$('li.brow button[aria-label^="More for"]')).length;
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => document.querySelectorAll('li.brow button[aria-label^="More for"]')[k].click(), i); await sleep(350);
    const h = await page.evaluate(() => [...document.querySelectorAll('dialog[open] a[href^="#/fill/"]')].pop()?.getAttribute('href') || '');
    if (h) return h;
    await page.keyboard.press('Escape'); await sleep(250);
  }
  return '';
}
const clickFill = (page) => page.evaluate(() => [...document.querySelectorAll('dialog[open] a[href^="#/fill/"]')].pop().click());
// ---------------- a coordinator fills a devotee's week ----------------
async function onBehalf(width) {
  const page = await fresh(width, { clock: classDayIso('SUN') });
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/batch', 1200, 'li.brow');
  const t = `[${width} on behalf]`;
  const href = await fillLink(page);
  ok(/^#\/fill\/\d+\/week\/\d{4}-\d{2}-\d{2}\?n=/.test(href), `${t} a board row's ⋯ offers "Fill for" (${href.split('?')[0]})`);
  await clickFill(page); await sleep(1200);
  const name = decodeURIComponent(href.split('n=')[1]);
  ok(new RegExp('Filling for ' + name + '[\\s\\S]*Saved as filled by the coordinator').test(await text(page, 'main') || '') && !!(await page.$('.acting a[href^="#/devotee/"]')) && (await areaNow(page)).html === 'coordinator', `${t} clear banner, coordinator colours`);
  ok(!(await page.$('#f-attendance .seg')), `${t} attendance is not asked here (the board marks it)`);
  const dayHref = await page.$eval('a.lrow[href*="/day/"]', (a) => a.getAttribute('href'));
  ok(dayHref.startsWith('#/fill/'), `${t} the day links stay in on-behalf mode`);
  await page.click('a.lrow[href*="/day/"]'); await page.waitForSelector('.actionbar', { timeout: 8000 }); await sleep(400);
  await setRounds(page, '16'); await page.keyboard.press('Tab'); await sleep(200);
  ok((await page.$$('.actionbar button')).length === 1, `${t} day: Save only (no Share for someone else)`);
  await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].at(-1).click()); await sleep(700);
  ok(await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].at(-1).textContent.trim() === 'Saved ✓'), `${t} the same explicit Save`);
  const own = await page.evaluate(() => Object.keys(sessionStorage).some((k) => k.endsWith('|home.get')));
  ok(!own, `${t} the coordinator's own form cache is untouched`);
  if (width === 390) await shot(page, 'onbehalf-day-390');
  await go(page, '#/batch', 1200, 'li.brow');
  ok(/Filling|Draft/.test(await page.evaluate((n) => [...document.querySelectorAll('li.brow')].find((li) => li.textContent.includes(n))?.textContent || '', name)), `${t} the board shows their week being filled`);
  await page.close();
}

// ---------------- master oversight ----------------
async function oversight(width) {
  const page = await fresh(width);
  await login(page, 'master', 'master-pass-1');
  const t = `[${width} oversight]`;
  // Phase 6: All batches — a strip of totals, batches worst first, the empty ones on one line
  await go(page, '#/overview', 1500, '.ov-row');
  ok((await page.$$('.ov-list > li')).length >= 1 && /submitted/.test(await text(page, 'main') || '') && /no active devotees yet/.test(await text(page, 'main') || ''), `${t} all batches: totals, rows worst first, the empty ones named`);
  if (width === 390 || width === 1280) await shot(page, `overview-${width}`);
  await page.evaluate(() => [...document.querySelectorAll('.ov-row')].find((a) => a.querySelector('.ov-name b')?.textContent.trim() === 'SPS').click()); await sleep(1200);
  ok((await page.evaluate(() => location.hash)) === '#/batch' && /SPS/.test(await page.$eval('#bt-batch', (s) => (s.selectedOptions ? s.selectedOptions[0].textContent : s.textContent))), `${t} tapping a batch opens its board`);
  // Settings: a row opens its sheet; Save only when changed; a toast with Undo
  await go(page, '#/settings', 1000, '.st-list');
  await clickText(page, '.st-list button', /Daily reminder/); await sleep(400);
  const noChange = await page.evaluate(() => [...document.querySelectorAll('dialog.sheet[open] button')].find((b) => /No change/.test(b.textContent))?.disabled);
  await sel(page, '#st-rem', '20:30'); await sleep(150);
  await clickText(page, 'dialog.sheet[open] button', /^Save$/); await sleep(700);
  ok(noChange && /Daily reminder · 8:30 PM/.test(await text(page, '.st-list') || '') && /Saved/.test(await text(page, '.toasts') || ''), `${t} settings: a row's sheet saves only a change; the row shows it`);
  // Activity: sentences under day headings; a type filter; the technical log folded
  await go(page, '#/activity', 1200, '.ac-row');
  ok(/IYF head changed the settings/.test(await text(page, 'main') || '') && /Today/.test(await text(page, '.ac-day') || ''), `${t} activity: the change in words, under Today`);
  await clickText(page, '.chipbtn', /^Sign-ups$/); await sleep(700);
  ok((await page.$$eval('.ac-row', (l) => l.every((b) => /sign-up/.test(b.textContent)))), `${t} activity filter by type`);
  await page.evaluate(() => { const d = [...document.querySelectorAll('details')].find((x) => /Technical log/.test(x.textContent)); d.open = true; }); await sleep(700);
  ok(/Technical log/.test(await text(page, 'main') || '') && (await page.$$('.ac-tech')).length > 0, `${t} slow or refused calls, folded as the technical log`);
  if (width === 390 || width === 1280) await shot(page, `activity-${width}`);
  ok(!(await hScroll(page)), `${t} no horizontal scroll`);
  await page.close();
}

// devotee sees a no-class week
async function devoteeClassWeek() {
  const page = await fresh(390);
  await login(page, 'sps', 'sps-pass-12');
  const wk = await page.evaluate(async () => {
    const { call } = await import('/src/lib/api.js');
    const b = await call('devotees.list', { batchId: 'SPS' });
    await call('weeks.setClass', { batchId: 'SPS', weekId: b.weekId, kind: 'FESTIVAL', note: 'Diwali', everyonePresent: true });
    await call('auth.logout');
    return b.weekId;
  });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); location.hash = '#/login'; }); await sleep(500);
  await page.reload({ waitUntil: 'networkidle0' });
  // the mock state is per page load: set it again after the reload, then log in as the devotee
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(60); });
  await page.evaluate(async (w) => {
    const m = await import('/src/lib/mock.js');
    const r = await m.handle({ v: 1, action: 'auth.login', data: { login: 'sps', password: 'sps-pass-12' } });
    await m.handle({ v: 1, action: 'weeks.setClass', token: r.data.token, requestId: crypto.randomUUID(), data: { batchId: 'SPS', weekId: w, kind: 'FESTIVAL', note: 'Diwali', everyonePresent: true } });
  }, wk);
  await go(page, '#/login', 500);       // signed out, the app opens on the welcome screen now
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/week/' + wk, 1200, '#f-attendance');
  const t = await text(page, '#f-attendance');
  ok(/No regular class this week \(Diwali\)/.test(t || '') && !/\bPresent\b.*\bAbsent\b/.test(t || ''), `[390] devotee sees the no-class note instead of Present/Absent (${t})`);
  await page.evaluate(() => document.querySelector('#f-attendance').scrollIntoView({ block: 'center' }));
  await shot(page, 'week-noclass-390');
  await page.close();
}


// ---------------- design system: shell, areas, nav, tabs, every kind of login ----------------
const areaNow = (page) => page.evaluate(() => ({ shell: document.querySelector('.shell')?.dataset.area || null, html: document.documentElement.dataset.area }));
async function areaIs(page, hash, want, tag) {
  await go(page, hash, 900);
  // a fresh dev server reloads the page once when it has prepared its dependencies: read again after it (not the app)
  const a = await areaNow(page).catch(async (e) => {
    if (!/detached|context was destroyed/i.test(e.message)) throw e;
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 }).catch(() => {});
    await go(page, hash, 1500);
    return areaNow(page);
  });
  ok(a.html === want && (a.shell === want || a.shell === null), `${tag} ${hash} → data-area ${want} (${a.shell}/${a.html})`);
}
// the items a person can see at this width (the bar hides the rail-only ones under 600 px)
const navLabels = (page) => page.$$eval('nav.nav a', (l) => l.filter((a) => getComputedStyle(a).display !== 'none').map((a) => a.lastElementChild.firstChild.textContent.trim()));
// the menu's sections; on the desktop sidebar a folded area (8 Oct 2026) is one entry under its area's name, no heading
const FOLDED = { 'My sadhana': 'My Sadhana', Batches: 'My batch', Admin: 'Admin', 'My students': 'Facilitator' };
const sections = (page, width) => page.$$eval(width < 1024 ? 'dialog.drawer .menu-h' : 'aside.sidebar .menu-h, aside.sidebar .menu > a.mi:first-child', (l, F) => l.map((e) => e.textContent.trim()).map((x) => F[x] || x), FOLDED);
async function oldStyle(page, tag) {
  const r = await page.evaluate(() => ({ old: document.querySelectorAll('.hero, nav.tabs, .qc-bar').length,
    loading: [...document.querySelectorAll('body *')].some((e) => e.children.length === 0 && /^Loading…$/.test(e.textContent.trim()) && !e.closest('.sr-only') && !e.classList.contains('sr-only') && e.getClientRects().length) }));
  ok(!r.old && !r.loading, `${tag} no old-style blocks or bare "Loading…" text`);
}
async function topbar(page, width, tag) {
  const r = await page.evaluate(() => {
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height, vis: getComputedStyle(e).display !== 'none' && b.width > 0 }; };
    return { m: R(document.querySelector('.topbar .menu-btn')), b: R(document.querySelector('.topbar .bell')), t: R(document.querySelector('.topbar .pagetitle')), bar: R(document.querySelector('.topbar')) };
  });
  if (width < 1024) {
    // measured from the top bar's own left edge (600–1023 px: the bar starts after the navigation rail)
    ok(r.m?.vis && r.m.l - r.bar.l < 40 && r.m.w >= 44 && r.m.h >= 44, `${tag} menu button on the LEFT, 44 px (left ${r.m?.l.toFixed(0)} in a bar from ${r.bar?.l.toFixed(0)}, ${r.m?.w}×${r.m?.h})`);
    ok(r.b?.vis && r.b.r > width - 40 && r.b.w >= 44 && r.b.h >= 44, `${tag} bell on the RIGHT, 44 px (right ${r.b?.r.toFixed(0)})`);
    ok(r.m.r + 8 <= r.t.l + 1 && r.t.r <= r.b.l + 1 && r.m.r < r.b.l, `${tag} menu, title and bell have separate hit areas`);
  } else ok(!r.m?.vis && r.b?.vis && r.b.w >= 44, `${tag} wide: no menu button, bell present`);
}
async function navClear(page, width, tag) {
  if (width >= 1024) return;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(250);
  const r = await page.evaluate(() => {
    const kids = [...document.querySelector('main.content').children].filter((e) => e.tagName !== 'DIALOG' && e.getClientRects().length);
    const last = kids.at(-1), nav = document.querySelector('nav.nav').getBoundingClientRect();
    // 600–1023 px in the devotee area: a navigation rail on the left (full height) instead of the bottom bar
    const rail = nav.height > innerHeight / 2 && nav.left <= 0.5;
    return { rail, bottom: last.getBoundingClientRect().bottom, navTop: nav.top, navRight: nav.right, minLeft: Math.min(...kids.map((e) => e.getBoundingClientRect().left)), lastBottom: last.getBoundingClientRect().bottom, vh: innerHeight };
  });
  if (r.rail) ok(r.minLeft >= r.navRight - 0.5 && r.lastBottom <= r.vh + 0.5, `${tag} navigation rail does not cover any content (content from ${r.minLeft.toFixed(0)} ≥ rail ${r.navRight.toFixed(0)})`);
  else ok(r.bottom <= r.navTop + 0.5, `${tag} bottom nav does not cover the last content (${r.bottom.toFixed(0)} ≤ ${r.navTop.toFixed(0)})`);
}
async function typeLogin(page, l, p) {
  /* Wait for the form instead of assuming the previous navigation has finished. Reaching #/login from the
     welcome screen after a logout takes longer than the fixed sleep the caller used, and the whole run then
     died here with "failed to find element #login" — in the LAST section, after everything had passed. */
  /* Make sure the login form is actually on screen. Setting location.hash right after a logout can land
     back on #/welcome (the app redirects while it is still tearing the session down), and the whole run
     then died here on a missing #login — in the LAST section, after everything else had passed. So: ask
     again if we are not there yet, then wait properly. */
  for (let i = 0; i < 5 && !(await page.$('#login')); i++) {
    await page.evaluate(() => { location.hash = '#/login'; });
    await sleep(400);
  }
  await page.waitForSelector('#login', { timeout: 10000 });
  await page.$eval('#login', (e) => (e.value = '')); await page.$eval('#password', (e) => (e.value = ''));
  await page.type('#login', l); await page.type('#password', p);
  await page.click('button[type=submit]');
}
async function asUser(width, l, p, tag, exp) {
  const page = await fresh(width);
  await login(page, l, p);
  await sleep(700);
  const t = `[${width} ${tag}]`;
  if (width < 1024) ok(JSON.stringify(await navLabels(page)) === JSON.stringify(exp.nav), `${t} bottom nav: ${(await navLabels(page)).join(' | ')}`);
  const secs = await sections(page, width);
  ok(exp.sections.every((x) => secs.includes(x)) && exp.notSections.every((x) => !secs.includes(x)), `${t} menu sections: ${secs.join(' | ')}`);
  ok(new RegExp(exp.home).test(await text(page, 'main.content') || ''), `${t} home shows ${exp.home}`);
  await topbar(page, width, t + ' home:');
  await oldStyle(page, t + ' home:');
  ok(!(await hScroll(page)), `${t} home: no horizontal scroll`);
  await navClear(page, width, t + ' home:');
  for (const [hash, area] of exp.areas) {
    await areaIs(page, hash, area, t);
    await oldStyle(page, `${t} ${hash}:`);
    ok(!(await hScroll(page)), `${t} ${hash}: no horizontal scroll`);
  }
  // tabs only under 1024 px; on the desktop the sidebar lists the same pages (8 Oct 2026)
  if ((exp.tabs || exp.batchTabs) && width >= 1024) {
    await go(page, exp.tabs ? '#/coordinators' : '#/batch', 900, '[role=tablist]');
    ok(await page.$eval('[role=tablist]', (e) => getComputedStyle(e).display === 'none'), `${t} desktop: no tab row (the sidebar has these pages)`);
  }
  if (exp.tabs && width < 1024) {
    await go(page, '#/coordinators', 900, '[role=tab]');
    await page.focus('[role=tab][aria-selected=true]');
    const k = async (key) => { await page.keyboard.press(key); await sleep(80); return page.evaluate(() => [document.activeElement.textContent.trim(), document.activeElement.getAttribute('tabindex'), document.activeElement.getAttribute('role')]); };
    const a1 = await k('ArrowRight'), a2 = await k('End'), a3 = await k('Home'), a4 = await k('ArrowLeft');
    ok(a1[0] === 'Access' && a1[1] === '0' && a1[2] === 'tab' && a2[0] === 'Settings' && a3[0] === 'All batches' && a4[0] === 'Settings', `${t} admin tabs: arrow keys / Home / End move focus (roving) (${[a1, a2, a3, a4].map((x) => x[0]).join(' → ')})`);
    await page.keyboard.press('Enter'); await sleep(700);
    ok((await page.evaluate(() => location.hash)) === '#/settings' && (await page.$eval('[role=tab][aria-selected=true]', (e) => e.textContent.trim())) === 'Settings', `${t} Enter opens the focused tab`);
    const clipped = await page.$$eval('[role=tab]', (l) => l.some((e) => e.scrollWidth > e.clientWidth + 1));
    ok(!clipped, `${t} admin tab labels never clipped (7 tabs, the bar scrolls)`);
    ok(!!(await page.$('[role=tablist][aria-label] + [role=tabpanel]')), `${t} tablist has its tabpanel`);
  }
  if (exp.batchTabs && width < 1024) {
    await go(page, '#/batch', 1000, '[role=tab]');
    const tabs = await page.$$eval('[role=tab]', (l) => l.map((e) => [e.textContent.trim(), e.getAttribute('aria-selected')]));
    ok(tabs.map((x) => x[0]).join('|') === 'Status|Devotees|Group leaders|Filling chart|Ready to move up|New batch' && tabs[0][1] === 'true', `${t} batch tabs (${tabs.map((x) => x.join(':')).join(', ')})`);
    await page.focus('[role=tab][aria-selected=true]'); for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await sleep(60); } await page.keyboard.press(' '); await sleep(900);
    ok((await page.evaluate(() => location.hash)) === '#/stats', `${t} batch tabs: → → → then Space opens Filling chart`);
    const clipped = await page.$$eval('[role=tab]', (l) => l.some((e) => e.scrollWidth > e.clientWidth + 1));
    ok(!clipped, `${t} no tab label is clipped`);
  }
  await page.close();
}

async function publicScreens(width) {
  const page = await fresh(width);
  const t = `[${width} public]`;
  ok((await areaNow(page)).html === 'public' && !!(await page.$('.auth')), `${t} sign-in screen is the royal public brand`);
  ok(!!(await page.$('a[href="#/forgot"]')) && /Create an account/.test(await text(page, 'a[href="#/signup"]') || ''), `${t} "Forgot password" and "Create an account" offered`);
  await page.click('button[type=submit]'); await sleep(200);
  ok((await page.$$('[aria-invalid=true]')).length === 2, `${t} empty log in marks both fields`);
  ok(!(await hScroll(page)), `${t} login: no horizontal scroll`);
  await oldStyle(page, `${t} login:`);
  await go(page, '#/signup', 600, '#su-form');
  // 6 titled sections: About you · batch and class · a little about you (11 Oct) · address (3 Oct) · password · emergency
  // contact. "Parent or guardian" is a 7th, shown only once a date of birth under 18 is given.
  ok((await areaNow(page)).html === 'public' && (await page.$$('#su-form fieldset legend')).length === 6, `${t} sign-up: 6 titled sections`);
  ok(!(await hScroll(page)), `${t} sign-up: no horizontal scroll`);
  await go(page, '#/forgot', 600, '#fp-login');
  /* Decision 46 (14 Oct 2026): this screen asks for the phone number and NOTHING else. It used to collect
     the new password, which is the whole of audit finding F1 — anyone who knew a number could choose a
     password for an account that was not theirs. So the two password fields must be ABSENT, and the screen
     has to say where the password now comes from. */
  const fp = await page.evaluate(() => ({
    pw: !!document.querySelector('#fp-pw, #fp-pw2'),
    says: /temporary password/i.test(document.querySelector('main')?.textContent || '')
  }));
  ok(!fp.pw && fp.says && !(await hScroll(page)), `${t} forgot password asks only for the number, and says where the password comes from`);
  await go(page, '#/login', 600, '#login');
  await typeLogin(page, '6000000087', 'pass-12345'); await sleep(900);
  // 8 Oct 2026: a calm status page with their own details, not a red error
  ok(/Waiting for approval/.test(await text(page, 'main') || '') && /Rahul/.test(await text(page, '[role=status]') || '') && !(await page.$('[role=alert]')) && (await page.evaluate(() => location.hash)) === '#/login', `${t} pending devotee sees "Waiting for approval" with their name, not an error`);
  await page.close();
}

async function forcedChange(width) {
  const page = await fresh(width);
  await login(page, 'master', 'master-pass-1');
  await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); await call('coordinators.create', { username: 'newco', name: 'New Coordinator', batchIds: ['BVS'], tempPassword: 'temp-pass-99' }); (await import('/src/lib/session.svelte.js')).logout(); });
  await page.waitForFunction(() => location.hash === '#/welcome', { timeout: 5000 }).catch(() => {});
  ok((await page.evaluate(() => location.hash)) === '#/welcome', `[${width}] log out → the welcome screen`);
  await go(page, '#/login', 500, '#login');
  await typeLogin(page, 'newco', 'temp-pass-99');
  await page.waitForFunction(() => location.hash.includes('change-password'), { timeout: 8000 }).catch(() => {});
  await sleep(500);
  const t = `[${width} forced change]`;
  ok((await page.evaluate(() => location.hash)) === '#/change-password' && !!(await page.$('#cp-cur')), `${t} first login goes to Change password`);
  // 8 Oct 2026: the required change stands alone, in the sign-in layout: no app bars, menu or bell
  ok((await areaNow(page)).html === 'public' && /Choose your password/.test(await text(page, 'main') || '') && !(await page.$('nav.nav, aside.sidebar, .topbar')) && !!(await page.$('.auth')), `${t} the forced change stands alone (sign-in layout, no app bars)`);
  await oldStyle(page, t);
  if (width === 390) await shot(page, 'forced-change-390');
  await page.type('#cp-cur', 'temp-pass-99'); await page.type('#cp-new', 'fresh-pass-123'); await page.type('#cp-new2', 'fresh-pass-123');
  await page.click('main button[type=submit]'); await sleep(1200);
  ok((await page.evaluate(() => location.hash)) === '#/home', `${t} after the change, Home`);
  await page.close();
}

const DEV_NAV = ['Home', 'Week', 'Group', 'Report', 'Account'];   // Sunil is a group leader: My group is on his bar (8 Oct 2026)
async function allLogins(width) {
  await publicScreens(width);
  await asUser(width, '6000000001', 'pass-12345', 'devotee', { nav: DEV_NAV, sections: ['My Sadhana', 'You'], notSections: ['My batch', 'Admin'], home: 'Hare Krishna, Sunil',
    areas: [['#/home', 'devotee'], ['#/week', 'devotee'], ['#/report', 'devotee'], ['#/hearing', 'devotee'], ['#/reading', 'devotee'], ['#/history', 'devotee'], ['#/wall', 'devotee'], ['#/account', 'devotee']] });
  await asUser(width, 'sps', 'sps-pass-12', 'coordinator', { nav: ['Home', 'Batch', 'Requests', 'Account'], sections: ['My batch', 'You'], notSections: ['My Sadhana', 'Admin'], home: 'Needs you', batchTabs: true,
    areas: [['#/home', 'coordinator'], ['#/batch', 'coordinator'], ['#/stats', 'coordinator'], ['#/leaders', 'coordinator'], ['#/requests', 'coordinator'], ['#/devotee/6000000011', 'coordinator'], ['#/wall', 'coordinator'], ['#/account', 'coordinator']] });
  await asUser(width, 'master', 'master-pass-1', 'master', { nav: ['Home', 'Requests', 'Admin', 'Batch', 'Account'], sections: ['My batch', 'Admin', 'You'], notSections: ['My Sadhana'], home: 'Decisions[\\s\\S]*System health[\\s\\S]*Batches · (this|last) week', tabs: true,
    areas: [['#/home', 'admin'], ['#/overview', 'admin'], ['#/activity', 'admin'], ['#/settings', 'admin'], ['#/coordinators', 'admin'], ['#/batches', 'admin'], ['#/ids', 'admin'], ['#/reopens', 'coordinator'], ['#/batch', 'coordinator'], ['#/requests', 'coordinator'], ['#/account', 'admin'], ['#/wall', 'admin']] });
  // Phase 4: one navigation from the person's scopes (no longer devotee tabs only): the bar keeps 5, the rail shows all
  await asUser(width, 'meera', 'meera-pass-1', 'devotee+coordinator', { nav: width < 600 ? ['Home', 'Week', 'Requests', 'Batch', 'Account'] : ['Home', 'Week', 'Requests', 'Batch', 'Report', 'Account'], sections: ['My Sadhana', 'My batch', 'You'], notSections: ['Admin'], home: 'Hare Krishna, Meera[\\s\\S]*My batch',
    areas: [['#/home', 'devotee'], ['#/week', 'devotee'], ['#/batch', 'coordinator'], ['#/requests', 'coordinator'], ['#/account', 'devotee']] });
  await asUser(width, 'guru', 'guru-pass-12', 'devotee+master', { nav: width < 600 ? ['Home', 'Week', 'Requests', 'Admin', 'Account'] : ['Home', 'Week', 'Requests', 'Admin', 'Batch', 'Report', 'Account'], sections: ['My Sadhana', 'My batch', 'Admin', 'You'], notSections: [], home: 'Hare Krishna, Govinda[\\s\\S]*My batch[\\s\\S]*Decisions',
    areas: [['#/home', 'devotee'], ['#/report', 'devotee'], ['#/batch', 'coordinator'], ['#/coordinators', 'admin'], ['#/reopens', 'coordinator'], ['#/account', 'devotee']] });
}

// no horizontal scroll anywhere, at every width (one person with all three scopes reaches every screen)
async function sweep(width) {
  const page = await fresh(width);
  const bad = [];
  for (const h of ['#/login', '#/signup', '#/forgot']) { await go(page, h, 400); if (await hScroll(page)) bad.push(h); }
  await go(page, '#/login', 400);
  await login(page, 'guru', 'guru-pass-12');
  const wk = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.endsWith('|home.get')))).data.weeks.at(-1));
  const day = wk.days.filter((d) => !d.future).at(-1).date;
  for (const h of ['#/home', `#/week/${wk.weekId}`, `#/day/${wk.weekId}/${day}`, '#/report', '#/history', '#/hearing', '#/reading', '#/wall', '#/account',
    '#/batch', '#/stats', '#/leaders', '#/requests', '#/devotee/6000000011', '#/coordinators', '#/batches', '#/ids', '#/reopens']) {
    await go(page, h, 700);
    if (await hScroll(page)) bad.push(h);
  }
  ok(!bad.length, `[${width}] no horizontal scroll on 21 screens${bad.length ? ': ' + bad.join(', ') : ''}`);
  await page.close();
}


/*
 * The ETP coordinator's own journey (18 Oct 2026).
 *
 * This screen had no check at all, and the mock's ETP batch had NO coordinator — so every earlier
 * run drove it as the master. The one login that actually uses it was never exercised, which is how
 * "I search and nothing appears" survived a green suite: the results had no heading of their own,
 * so on a phone they rendered below the fold and the screen still read "No students yet".
 */
async function etpCoordinator(width) {
  const t = `[${width} etp]`;
  const page = await fresh(width);
  await login(page, 'etp', 'etp-pass-12');
  await go(page, '#/batch', 900);
  const tabs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a,button')].map((e) => e.textContent.trim()))]);
  ok(tabs.some((x) => /^Students$/i.test(x)), `${t} the training's coordinator gets the Students tab`);

  await page.evaluate(() => { [...document.querySelectorAll('a,button')].find((x) => /^students$/i.test(x.textContent.trim())).click(); });
  await page.waitForFunction(() => !!document.getElementById('st-q'), { timeout: 9000 }).catch(() => {});
  ok(await page.$('#st-q'), `${t} with a search box to add somebody`);

  // the box must be usable: it collapsed to 86px once, leaving about two pixels for the text
  const w = await page.evaluate(() => { const i = document.getElementById('st-q'); const r = i.getBoundingClientRect();
    return { box: Math.round(r.width), scroll: i.scrollWidth, client: i.clientWidth }; });
  ok(w.box > 200, `${t} the search box is usable, not squeezed (${w.box}px)`);

  for (const [term, label] of [['Harish', 'by name'], ['60000000', 'by number'], ['IYFD-2026-01', 'by IYF id']]) {
    await page.evaluate(() => { const i = document.getElementById('st-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('#st-q', term, { delay: 40 });
    await page.evaluate(() => { [...document.querySelectorAll('form.st-find button')].find((x) => /search/i.test(x.textContent)).click(); });
    await sleep(900);
    const r = await page.evaluate(() => {
      const h = document.getElementById('st-found');
      const row = document.querySelector('[aria-label="People found"] .st-row');
      const add = row && [...row.querySelectorAll('button')].find((b) => /add/i.test(b.textContent));
      const box = add && add.getBoundingClientRect();
      return { heading: h ? h.textContent.trim() : '', rows: document.querySelectorAll('[aria-label="People found"] .st-row').length,
               addInView: box ? box.top >= 0 && box.bottom <= window.innerHeight : false };
    });
    ok(r.rows > 0, `${t} search ${label} finds somebody (${term})`);
    ok(/^Found \d+/.test(r.heading), `${t} and says so: "${r.heading}"`);
    ok(r.addInView, `${t} with the Add button on screen, not below the fold`);
  }

  // Adding puts them in the training. Counted from the LIST itself, not from a sentence: the screen
  // says things in as few words as it can, and a check that reads prose breaks whenever the wording
  // is tightened (18 Oct 2026) — the rows are the fact, the sentence is decoration.
  const named = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Students"] .st-name')].map((e) => e.textContent.trim()));
  const before = await named();
  const who = await page.evaluate(() => document.querySelector('[aria-label="People found"] .st-row .st-name').textContent.trim());
  await page.evaluate(() => { const row = document.querySelector('[aria-label="People found"] .st-row');
    [...row.querySelectorAll('button')].find((b) => /add/i.test(b.textContent)).click(); });
  await page.waitForFunction((n) => [...document.querySelectorAll('[aria-label="Students"] .st-name')].length === n,
    { timeout: 9000 }, before.length + 1).catch(() => {});
  const after = await named();
  ok(after.length === before.length + 1 && after.includes(who),
    `${t} adding a student puts them in the training (${before.length} to ${after.length}: ${who})`);
  // and the list does not blank out while it refreshes: that middle state read as "he was not added"
  ok(!(await page.evaluate(() => !!document.querySelector('.sk'))), `${t} the list is not replaced by a skeleton while it refreshes`);

  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${t} no horizontal scroll`);
  await page.close();
}

const widths = [320, 390, 768, 1280];
for (const w of widths) {
  if (!only || only === 'devotee') await part('devotee', async () => { await devotee(w); });
  if (!only || only === 'coord') await part('coord', async () => { await coordinator(w); });
  if (!only || only === 'master') await part('master', async () => { await master(w); });
}
if (!only || only === 'logins') await part('logins', async () => { for (const w of [320, 390, 820, 1280]) await allLogins(w); });
if (!only || only === 'logins') await part('logins', async () => { await forcedChange(390); });
if (!only || only === 'welcome') await part('welcome', async () => { for (const w of [390, 1280]) { await welcomeFlow(w); await areaColours(w); } });
if (!only || only === 'pro') await part('pro', async () => { for (const w of [390, 1280]) { await proFeatures(w); await onBehalf(w); await oversight(w); } });
if (!only || only === 'rules') await part('rules', async () => { { for (const w of [390, 1280]) { await beforeClass(w); await signUpFlow(w); await devoteeContact(w); } } });
if (!only || only === 'today') await part('today', async () => { for (const w of [390, 1280]) await authAndAvatar(w); });
if (!only || only === 'design') await part('design', async () => { for (const w of [390, 1280]) await devoteeDesign(w); });
if (!only || only === 'facs') await part('facs', async () => { for (const w of [390, 1280]) await facilitatorsAdmin(w); });
if (!only || only === 'etp') await part('etp', async () => { for (const w of [390, 1280]) await etpCoordinator(w); });
if (!only || only === 'sweep') await part('sweep', async () => { for (const w of [320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920]) await sweep(w); });
// Group leaders, the attendance levels and times, contact details, blood group (decision 41, 3 Oct 2026)
async function groups(width) {
  const W = `[${width} groups]`, sat = classDayIso('SAT'), sun = classDayIso('SUN');
  // Saturday 10 AM: week-end and attendance locked, with the times said
  let page = await fresh(width, { clock: sat });
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/week', 1200, '#h-we');     // (the questions themselves are hidden until Saturday 6 PM, 4 Oct 2026)
  let r = await page.evaluate(() => ({ ws: !document.getElementById('f-nightStay') && !document.getElementById('f-principles'), att: [...document.querySelectorAll('#f-attendance button')].every((b) => b.disabled),
    ready: document.querySelector('ul.ready')?.textContent || '', card: document.getElementById('h-we')?.closest('section')?.textContent || '' }));
  // Phase 24 (V23): WHEN is said once, in the readiness list; the End of week card only says it is not open yet
  ok(r.ws && /open on Saturday at 6 PM/.test(r.ready) && /Not open yet/.test(r.card) && !/6 PM/.test(r.card), `${W} Saturday 10 AM: Night Stay and the 4 principles hidden, "open on Saturday at 6 PM" said once`);
  ok(r.att && /Attendance opens on Sunday/.test(r.ready), `${W} Saturday: attendance locked until Sunday (one class for all)`);
  // the menu shows My group to a leader
  r = await page.evaluate(() => [...document.querySelectorAll('a.mi')].some((a) => a.getAttribute('href') === '#/group'));
  ok(r, `${W} the leader's menu has My group`);
  await page.close();
  // Sunday: the leader's group, call links next to names, marks saved
  page = await fresh(width, { clock: sun });
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/group', 1200, '.brow');
  // Phase 5: a row opens the call sheet (Call / WhatsApp); P / A sit at the end of the row
  r = await page.evaluate(() => [...document.querySelectorAll('.brow')].map((li) => ({ name: li.querySelector('.who b')?.textContent, who: li.querySelector('button.who') ? 1 : 0, pa: li.querySelectorAll('.pa button').length, off: [...li.querySelectorAll('.pa button')].some((b) => b.disabled) })));
  ok(r.length === 4 && r.every((x) => x.who && x.pa === 2 && !x.off), `${W} My group: 4 members, each row opens Call / WhatsApp, marks open on Sunday (${r.map((x) => x.name).join(', ')})`);
  const callSheet = async (i) => { await page.evaluate((k) => document.querySelectorAll('.brow button.who')[k].click(), i); await sleep(400);
    const v = await page.evaluate(() => { const d = [...document.querySelectorAll('dialog[open]')].pop(); return { tel: !!d?.querySelector('a[href^="tel:+91"]'), wa: !!d?.querySelector('a[href^="https://wa.me/91"]') }; });
    await page.keyboard.press('Escape'); await sleep(300); return v; };
  const sheets = []; for (let i = 0; i < 4; i++) sheets.push(await callSheet(i));
  ok(sheets.every((x) => x.tel), `${W} every member's sheet has a Call link`);
  ok(sheets.filter((x) => x.wa).length >= 2, `${W} WhatsApp links where a number is on WhatsApp`);
  await page.evaluate(() => document.querySelectorAll('.brow')[0].querySelectorAll('.pa button')[1].click());
  await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Save attendance')).click());
  await sleep(800);
  r = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const g = await call('group.list', {}); return g.members.find((m) => m.attendance.leader === 'A'); });
  ok(!!r && r.attendance.used === 'A', `${W} the leader's Absent is saved and counts over the devotee's own`);
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${W} My group: no sideways scroll`);
  await page.close();
  // the coordinator: Group leaders tab, appoint and add
  page = await fresh(width, { clock: sun });
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/leaders', 1200, '#gl-pick');
  r = await page.evaluate(() => ({ groups: document.querySelectorAll('.gl-list').length, tab: document.querySelector('[aria-selected="true"], [aria-current="page"]')?.textContent }));
  ok(r.groups === 1, `${W} Group leaders tab: Sunil's group shown`);
  await sel(page, '#gl-pick', '6000000015');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Appoint').click());
  await sleep(900);
  r = await page.evaluate(() => document.querySelectorAll('.gl-list, section h3.sec-h').length);
  ok(r >= 2, `${W} a second leader appointed`);
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Add devotees'))[0].click());
  await sleep(400);
  await page.evaluate(() => document.querySelector('.gl-pick input').click());
  await page.evaluate(() => [...document.querySelectorAll('dialog button')].find((b) => /^Add/.test(b.textContent.trim())).click());
  await sleep(900);
  r = await page.evaluate(() => document.querySelector('.gl-list').children.length);
  ok(r === 5, `${W} a devotee added to the group (${r} members)`);
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${W} Group leaders: no sideways scroll`);
  await page.close();
  // the head: members by blood group; the devotee's address on the detail page
  page = await fresh(width);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/members', 1000, '#mb-blood');
  await sel(page, '#mb-blood', 'B+');
  await sleep(800);
  r = await page.evaluate(() => [...document.querySelectorAll('.mrow b')].map((b) => b.textContent));
  ok(r.length >= 1 && r.includes('Sunil Kumar'), `${W} Members filtered by blood group B+ (${r.join(', ')})`);
  await go(page, '#/devotee/6000000001', 1000, '.kv');
  r = await page.evaluate(() => document.querySelector('.kv').textContent);
  ok(/Punjabi Bagh/.test(r), `${W} the coordinator / head sees the address`);
  await page.close();
}
if (!only || only === 'groups') await part('groups', async () => { for (const w of [390, 1280]) await groups(w); });
if (!only || only === 'classweek') await part('classweek', async () => { await devoteeClassWeek(); });
if (!only || only === 'classweek') {
  const page = await fresh(320, { reduce: true });
  await login(page, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 });
  const r = await page.evaluate(() => ({ paused: document.querySelector('.qc').hasAttribute('data-paused'), btn: document.querySelector('.qc-track').getAttribute('aria-label'), live: document.querySelector('.qc-track').getAttribute('aria-live'),
    trans: getComputedStyle(document.querySelector('.qc-slide')).transitionDuration, drawer: getComputedStyle(document.querySelector('dialog.drawer')).transitionDuration }));
  ok(r.paused && /held still/.test(r.btn) && r.live === 'polite', `[320 reduced motion] no autoplay (${r.btn}, aria-live ${r.live})`);
  ok(/^0s/.test(r.trans) && /^0s/.test(r.drawer), `[320 reduced motion] no fade / slide (${r.trans}, drawer ${r.drawer})`);
  await page.close();
}
// ---------------- Automatic: the look follows the phone, the connection and the battery (the head, 4 Oct 2026) ----------------
// The browser is made to report a given device: memory, cores, a mouse or touch, the connection, the battery, the screen.
// Values left out are what headless Chrome reports; `null` means the browser does not tell (as Safari / Firefox).
const DESKTOP = { mem: 8, cores: 8, coarse: false, net: { effectiveType: '4g', rtt: 50, saveData: false }, battery: { level: 1, charging: true } };
const IPHONE = { mem: null, cores: 6, coarse: true, net: null, battery: null, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
const ANDROID_LOW = { mem: 2, cores: 4, coarse: true, net: { effectiveType: '4g', rtt: 100, saveData: false }, battery: { level: 0.7, charging: false } };
const ANDROID_MID = { mem: 4, cores: 8, coarse: true, net: { effectiveType: '4g', rtt: 100, saveData: false }, battery: { level: 0.7, charging: false } };
async function envPage(width, env = {}, { scheme = '', height = 0 } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height: height || (width >= 1024 ? 900 : 800), deviceScaleFactor: 1 });
  if (scheme) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  if (env.ua) await page.setUserAgent(env.ua);
  page.on('pageerror', (e) => errs.push(`[${width} automatic] PAGEERR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${width} automatic] console.${m.type()} ${m.text()}`); });
  await page.evaluateOnNewDocument((env) => {
    const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch { /* fixed */ } };
    if ('mem' in env) def(Navigator.prototype, 'deviceMemory', env.mem === null ? undefined : env.mem);
    if ('cores' in env) def(Navigator.prototype, 'hardwareConcurrency', env.cores);
    if ('net' in env) { let c; if (env.net) { c = new EventTarget(); Object.assign(c, env.net); } window.__conn = c; def(Navigator.prototype, 'connection', c); }
    if ('battery' in env) { let b; if (env.battery) { b = new EventTarget(); Object.assign(b, env.battery); } window.__bat = b; def(Navigator.prototype, 'getBattery', b ? () => Promise.resolve(b) : undefined); }
    if (env.screen) { def(Screen.prototype, 'width', env.screen[0]); def(Screen.prototype, 'height', env.screen[1]); def(window, 'devicePixelRatio', env.screen[2]); }
    if ('coarse' in env) { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (q === '(pointer: fine)' || q === '(pointer: coarse)' ? { matches: q === '(pointer: coarse)' ? env.coarse : !env.coarse, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); }
  }, env);
  await page.goto(BASE + '/#/welcome', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  await sleep(600);                                   // the battery answers a moment after start
  return page;
}
const tierNow = (page) => page.evaluate(() => document.documentElement.dataset.tier);
/** Changes the reported connection or battery while the app is open, as the phone would. */
const netChange = (page, net) => page.evaluate((n) => { Object.assign(window.__conn, n); window.__conn.dispatchEvent(new Event('change')); }, net);
const batChange = (page, b) => page.evaluate((x) => { Object.assign(window.__bat, x); window.__bat.dispatchEvent(new Event('levelchange')); }, b);

async function automaticDevices() {
  const W = '[automatic]';
  const cases = [
    ['high-end desktop', 1440, DESKTOP, 'high'],
    ['iPhone (memory not told: never a guess up)', 390, IPHONE, 'balanced'],
    ['low-end Android (2 GB)', 390, ANDROID_LOW, 'low'],
    ['mid Android, fast network', 390, ANDROID_MID, 'high'],
    ['mid Android on 3G', 390, { ...ANDROID_MID, net: { effectiveType: '3g', rtt: 400, saveData: false } }, 'balanced'],
    ['slow network (2G)', 390, { ...ANDROID_MID, net: { effectiveType: '2g', rtt: 1800, saveData: false } }, 'low'],
    ['data saver on', 390, { ...ANDROID_MID, net: { effectiveType: '4g', rtt: 80, saveData: true } }, 'low'],
    ['battery 15 %, not charging', 1440, { ...DESKTOP, battery: { level: 0.15, charging: false } }, 'balanced'],
    ['battery 8 %, not charging', 1440, { ...DESKTOP, battery: { level: 0.08, charging: false } }, 'low'],
    ['battery 8 % but charging', 1440, { ...DESKTOP, battery: { level: 0.08, charging: true } }, 'high'],
    ['4K-class screen, mid device', 1440, { ...DESKTOP, mem: 4, cores: 6, screen: [1920, 1080, 2] }, 'balanced'],
    ['tablet, landscape phone sizes', 820, ANDROID_MID, 'high'],
  ];
  for (const [label, width, env, want] of cases) {
    const page = await envPage(width, env);
    ok((await tierNow(page)) === want, `${W} ${label} → ${want} (${await tierNow(page)})`);
    await page.browserContext().close();
  }
  // offline: the look stays; network extras wait (no prefetch, pictures on tap) — saveData() turns on
  {
    const page = await envPage(1440, DESKTOP);
    await page.setOfflineMode(true); await sleep(DOWN + 500);
    const r = await page.evaluate(async () => ({ t: document.documentElement.dataset.tier, save: (await import('/src/lib/tier.js')).saveData() }));
    ok(r.t === 'high' && r.save === true, `${W} offline: the look stays, network extras wait (${JSON.stringify(r)})`);
    await page.setOfflineMode(false); await page.browserContext().close();
  }
}
const DOWN = 3000, UP = 20000;
async function automaticRuntime() {
  const W = '[automatic, while open]';
  // the battery runs down: low after the state has held 3 s; plugged in: one step up after 20 s
  let page = await envPage(1440, DESKTOP);
  await sleep(1500);                                  // past the first two seconds, when changes follow at once
  ok((await tierNow(page)) === 'high', `${W} starts high`);
  await batChange(page, { level: 0.08, charging: false });
  await sleep(1000);
  ok((await tierNow(page)) === 'high', `${W} battery nearly empty: not at once (smoothing)`);
  await sleep(DOWN);
  ok((await tierNow(page)) === 'low', `${W} … then low once it has held 3 s`);
  await batChange(page, { level: 0.09, charging: true });
  await sleep(5000);
  ok((await tierNow(page)) === 'low', `${W} plugged in: no jump back up straight away`);
  await sleep(UP - 5000 + 1500);
  ok((await tierNow(page)) === 'balanced', `${W} … one step up after 20 s (${await tierNow(page)})`);
  await page.browserContext().close();
  // a flickering connection never flips the look; a lasting slow one does
  page = await envPage(1440, DESKTOP);
  await sleep(1500);
  for (let k = 0; k < 4; k++) { await netChange(page, { effectiveType: '2g', rtt: 1800 }); await sleep(400); await netChange(page, { effectiveType: '4g', rtt: 50 }); await sleep(400); }
  await sleep(DOWN + 500);
  ok((await tierNow(page)) === 'high', `${W} connection flickers 2G ↔ 4G: the look holds (high)`);
  await netChange(page, { effectiveType: '2g', rtt: 1800 });
  await sleep(DOWN + 800);
  ok((await tierNow(page)) === 'low', `${W} connection stays at 2G: low`);
  await page.browserContext().close();
}
async function themeMenu(width) {
  const W = `[${width} theme]`;
  for (const scheme of ['light', 'dark']) {
    const page = await envPage(width, {}, { scheme });
    await go(page, '#/login', 0, '#login');
    await login(page, '6000000001', 'pass-12345');
    await page.waitForSelector('.qc', { timeout: 15000 });
    ok((await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('sr.theme')])).join() === `${scheme},`, `${W} Automatic is the default and follows the phone's ${scheme} setting`);
    // the one theme control: a row in the menu (sidebar on wide screens, drawer on phones)
    const root = width >= 1024 ? 'aside.sidebar' : 'dialog.drawer';
    if (width < 1024) { await page.click('.menu-btn'); await sleep(350); }
    const row = await page.$eval(`${root} [id$="-theme"]`, (b) => ({ text: b.textContent.replace(/\s+/g, ' ').trim(), h: b.getBoundingClientRect().height }));
    // a finger's 44 px on a touch screen; the desktop sidebar's rows are a mouse's 36 px (10 Oct 2026: every page listed)
    const minH = width >= 1024 && (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) ? 36 : 44;
    ok(row.text === 'Theme Automatic' && row.h >= minH, `${W} the menu shows one fixed row: "${row.text}" (${Math.round(row.h)} px, at least ${minH})`);
    if (scheme === 'light') {
      // one tap moves to the next mode (the head, 5 Oct 2026): Automatic → Light → Dark → Automatic
      const tapRow = async () => { await page.click(`${root} [id$="-theme"]`); await sleep(250); return page.evaluate((r) => ({ t: document.documentElement.dataset.theme, saved: localStorage.getItem('sr.theme'), row: document.querySelector(r + ' [id$="-theme"]').textContent.replace(/\s+/g, ' ').trim() }), root); };
      const l = await tapRow();
      ok(l.t === 'light' && l.saved === 'light' && l.row === 'Theme Light', `${W} one tap: Light (${JSON.stringify(l)})`);
      const after = await tapRow();
      ok(after.t === 'dark' && after.saved === 'dark' && after.row === 'Theme Dark', `${W} next tap: Dark, even though the phone is light (${JSON.stringify(after)})`);
      ok(!(await page.$(`${root} [role=radio]`)), `${W} no list of choices: the row itself changes`);
      // a manual choice is never overridden by Automatic: the look tier may change, the theme does not
      const tierBefore = await tierNow(page);
      await page.evaluate(() => window.dispatchEvent(new Event('offline'))); await sleep(DOWN + 300);
      ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && (await tierNow(page)) === tierBefore, `${W} the chosen theme stays when conditions change`);
      await page.screenshot({ path: `${OUT}/automatic-theme-menu-${width}.png` });
    }
    if (width < 1024) await page.keyboard.press('Escape');
    // Account has no Appearance section any more
    await go(page, '#/account', 0, 'h3');
    ok(!(await page.evaluate(() => [...document.querySelectorAll('main h3')].some((h) => /Appearance/.test(h.textContent)) || !!document.querySelector('main #theme, main #look'))), `${W} Account: no Appearance section, no second theme control`);
    await page.browserContext().close();
  }
}
/** The three looks on screen: glass, the page wash and the time wheel (each tier from a device that brings it). */
async function tierLooks(width) {
  const W = `[${width} looks]`;
  for (const [want, env] of [['high', DESKTOP], ['balanced', IPHONE], ['low', ANDROID_LOW]]) {
    const page = await envPage(width, { ...env, ua: undefined });
    await go(page, '#/login', 0, '#login');
    await login(page, '6000000001', 'pass-12345');
    await page.waitForSelector('.qc', { timeout: 15000 });
    ok((await tierNow(page)) === want, `${W} ${want} device → data-tier ${want}`);
    await page.evaluate(() => window.scrollTo(0, 400)); await sleep(400);
    const r = await page.evaluate(() => {
      const cs = (sel) => getComputedStyle(document.querySelector(sel));
      return { nav: cs('nav.nav').backdropFilter, bar: cs('.topbar').backdropFilter, wash: cs('.shell').backgroundImage, shadow3: cs('.shell').getPropertyValue('--shadow-3').trim(), shadow1: cs('.shell').getPropertyValue('--shadow-1').trim() };
    });
    const navBlur = width >= 600 && width < 1024 ? null : r.nav;
    if (want === 'high') ok((navBlur === null || /blur\(16px\)/.test(navBlur)) && /blur\(16px\)/.test(r.bar), `${W} high: strong glass on the nav and the scrolled top bar`);
    if (want === 'balanced') ok((navBlur === null || /blur\(8px\)/.test(navBlur)) && r.bar === 'none', `${W} balanced: light glass on the nav only, top bar opaque`);
    if (want === 'low') ok(r.nav === 'none' && r.bar === 'none' && r.shadow3 === r.shadow1, `${W} low: no blur anywhere, one shadow level`);
    ok(want === 'low' ? /linear-gradient/.test(r.wash) && !/radial/.test(r.wash) : /radial-gradient/.test(r.wash), `${W} ${want}: ${want === 'low' ? 'one flat band' : 'the two radial washes'} at the top`);
    await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
    await page.screenshot({ path: `${OUT}/automatic-${want}-home-${width}.png` });
    const href = await page.evaluate(() => document.querySelector('a.s-pill[href^="#/day/"], a.btn-primary[href^="#/day/"]')?.getAttribute('href'));
    if (href) {
      await go(page, href, 0, '#f-sleptAt-btn');
      await page.click('#f-sleptAt-btn'); await sleep(500);
      const st = await page.evaluate(() => [...document.querySelectorAll('dialog.tp-sheet[open] .wheel-row[data-value]')].map((e) => e.getAttribute('style') || '').join(' '));
      ok(want === 'low' ? !/rotateX/.test(st) && /opacity/.test(st) : /rotateX/.test(st), `${W} ${want}: ${want === 'low' ? 'flat' : '3D'} time wheel`);
      await page.keyboard.press('Escape');
    }
    await page.browserContext().close();
  }
}
async function dataSaver(width) {
  const W = `[${width} data saver]`;
  const page = await envPage(width, { net: { saveData: true, effectiveType: '4g', rtt: 80 } });
  // a post with a picture, from the head (through the mock, as the screen would)
  await page.evaluate(async () => {
    const m = await import('/src/lib/mock.js');
    const call = async (token, action, data) => { const r = await m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r.error)); return r.data; };
    const t = (await call(undefined, 'auth.login', { login: 'master', password: 'master-pass-1' })).token;
    const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#1d6b34'; g.fillRect(0, 0, 320, 200);
    await call(t, 'announcements.create', { title: 'Kirtan photo', body: 'From Sunday', audience: 'ALL', image: c.toDataURL('image/jpeg', 0.8).split(',')[1] });
  });
  await go(page, '#/login', 0, '#login');
  await login(page, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 });
  ok((await tierNow(page)) === 'low', `${W} the phone's data saver → low tier`);
  const q = await page.evaluate(() => ({ paused: document.querySelector('.qc').hasAttribute('data-paused'), still: document.querySelector('.qc').classList.contains('still') }));
  ok(q.paused && q.still, `${W} the quote does not turn or slide by itself`);
  await go(page, '#/wall', 0, '.annimg');
  await sleep(800);
  const before = await page.evaluate(() => ({ img: !!document.querySelector('.annimg img'), msg: document.querySelector('.annimg')?.textContent.trim() }));
  ok(!before.img && /tap to load/i.test(before.msg || ''), `${W} the post's picture waits for a tap (${before.msg})`);
  await page.click('.annimg'); await page.waitForSelector('.annimg img', { timeout: 8000 }).catch(() => {});
  ok(!!(await page.$('.annimg img')), `${W} a tap loads the picture`);
  await page.screenshot({ path: `${OUT}/phase3-data-saver-wall-${width}.png` });
  await page.browserContext().close();
}
async function measuredSlowness(width) {
  const W = `[${width} slow phone]`;
  const page = await envPage(width, DESKTOP);
  await go(page, '#/login', 0, '#login');
  await login(page, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 });
  ok((await tierNow(page)) === 'high', `${W} starts high on this computer`);
  // a slow phone: the CPU slowed 6× and every frame held up by 45 ms of work, while the person scrolls for ~9 s
  const slowScroll = async () => {
    const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await page.evaluate(() => new Promise((done) => {
      const end = performance.now() + 9500; let dir = 1;
      const jank = () => { const t = performance.now(); while (performance.now() - t < 45) { /* busy */ } if (performance.now() < end) requestAnimationFrame(jank); };
      requestAnimationFrame(jank);
      const iv = setInterval(() => { window.scrollBy(0, 60 * dir); if (window.scrollY > document.body.scrollHeight - innerHeight - 80 || window.scrollY < 10) dir = -dir; if (performance.now() >= end) { clearInterval(iv); done(); } }, 50);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await sleep(400);
  };
  await slowScroll();
  ok((await tierNow(page)) === 'balanced' && (await page.evaluate(() => localStorage.getItem('sr.slow'))) === '1', `${W} slow scrolling steps down once: balanced, remembered (${await tierNow(page)})`);
  // reopen the app (the mock's data lives in the page, so sign in again; the tier step is kept in localStorage)
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
  // signed out by the fresh mock (Phase 1: the kept person shows first, then the server's "session ended" opens Login)
  const out = await page.waitForSelector('#login, .welcome', { timeout: 15000 }).then(() => true, () => false);
  if (!out) console.log('DIAG measuredSlowness after reload', await page.evaluate(() => JSON.stringify({ hash: location.hash, splash: !!document.getElementById('splash'),
    tier: document.documentElement.dataset.tier, user: (localStorage.getItem('sr.user') || '').slice(0, 30), body: document.body.innerText.slice(0, 200) })));
  ok(out, `${W} reopened after the server forgot the session: Login`);
  await go(page, '#/login', 0, '#login');
  await login(page, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 }); await sleep(300);
  ok((await tierNow(page)) === 'balanced', `${W} still balanced after reopening`);
  await slowScroll();
  ok((await tierNow(page)) === 'low', `${W} slow again: low (${await tierNow(page)})`);
  await page.browserContext().close();
}
if (!only || only === 'tiers') await part('tiers', async () => { { await automaticDevices(); await automaticRuntime(); for (const w of [390, 1280]) await themeMenu(w); for (const w of [390, 820, 1280]) await tierLooks(w); await dataSaver(390); await measuredSlowness(390); } });
// ---------------- staff: a devotee's day with what they heard and read (4 Oct 2026) ----------------
const LONG_TOPIC = 'Śrīmad-Bhāgavatam-Canto-Ten-Prayers-of-Lord-Brahmā-to-Kṛṣṇa-with-the-purports-of-Śrīla-Prabhupāda-and-questions';
const LONG_BOOK = 'Kṛṣṇa-the-Supreme-Personality-of-Godhead-Volume-One-with-the-pastimes-of-Vṛndāvana-and-Mathurā-read-aloud';
/** Sunil's week of 5 Oct, day by day: both, hearing only, reading only, neither, long titles, then two plain days. */
async function seedPractice(page, submit) {
  return page.evaluate(async (submit, LT, LB) => {
    const m = await import('/src/lib/mock.js');
    const call = async (token, action, data) => { const r = await m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r.error)); return r.data; };
    m.setNow('2026-10-11T19:00:00+05:30');
    const t = (await call(undefined, 'auth.login', { login: '6000000001', password: 'pass-12345' })).token;
    const lec = (await call(t, 'journals.get', {})).lectures[0];
    const base = { sleptAt: '22:10', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 20, serviceMin: 60 };
    const days = [
      { hearingMin: 35, hearing: [{ lectureId: lec.lectureId }, { text: 'Sunday feast class' }], readingMin: 25, reading: { bookId: 'B03' } },
      { hearingMin: 30, hearing: [{ text: 'Japa workshop' }], readingMin: 0 },
      { hearingMin: 0, readingMin: 20, reading: { text: 'Bhagavad-gita As It Is' } },
      { hearingMin: 0, readingMin: 0 },
      { hearingMin: 40, hearing: [{ text: LT }], readingMin: 30, reading: { text: LB } },
      { hearingMin: 20, hearing: [{ text: 'Kirtan talk' }], readingMin: 15, reading: { text: 'Nectar of Devotion' } },
      { hearingMin: 20, hearing: [{ text: 'Kirtan talk' }], readingMin: 15, reading: { text: 'Nectar of Devotion' } },
    ];
    for (let i = 0; i < 7; i++) await call(t, 'week.saveDay', { weekId: '2026-10-05', date: '2026-10-' + String(5 + i).padStart(2, '0'), version: 0, day: { ...base, ...days[i] } });
    if (submit) {
      await call(t, 'week.saveWeekEnd', { weekId: '2026-10-05', version: 0, nightStay: 'YES', principles: 'YES' });
      await call(t, 'week.setAttendance', { weekId: '2026-10-05', mark: 'P' });
      await call(t, 'week.submit', { weekId: '2026-10-05' });
    }
    return { lectureTitle: lec.title, lectureWeek: lec.week };
  }, submit, LONG_TOPIC, LONG_BOOK);
}
/** Opens day i of the week on screen and reads its panel. */
async function openPracticeDay(page, i) {
  await page.evaluate((i) => { const b = document.querySelectorAll('.wr-day')[i]; b.scrollIntoView({ block: 'center' }); if (b.getAttribute('aria-expanded') !== 'true') b.click(); }, i);
  await page.waitForSelector('.wr-dayrep .dp', { timeout: 8000 }).catch(() => {});
  await sleep(250);
  return page.evaluate(() => {
    const rep = document.querySelector('.wr-dayrep'), dp = rep?.querySelector('.dp'), bars = rep?.querySelector('.wr-split > :first-child');
    const items = [...(dp?.querySelectorAll('.dp-item') || [])];
    const part = (k) => (items[k] ? { head: items[k].querySelector('.dp-h')?.textContent.trim(), lines: [...items[k].querySelectorAll('.dp-list li, .dp-book')].map((e) => e.textContent.trim()), none: items[k].querySelector('.dp-none')?.textContent.trim() || '' } : null);
    const r = (e) => e?.getBoundingClientRect();
    return { heading: rep?.querySelector('.wr-dayh')?.textContent.trim(), label: rep?.getAttribute('aria-label'), none: dp && !items.length ? dp.querySelector('.dp-none')?.textContent.trim() : '',
      hearing: part(0), reading: part(1), wraps: dp ? dp.scrollWidth <= dp.clientWidth + 1 : false,
      beside: dp && bars ? Math.abs(r(dp).top - r(bars).top) < 40 && r(dp).left > r(bars).left + 20 : null, below: dp && bars ? r(dp).top >= r(bars).bottom - 1 : null };
  });
}
async function dayView(width) {
  const W = `[${width} day view]`;
  // a facilitator, while the week is still being filled: the day's scores, and a note that hearing and reading come with the submit
  let page = await fresh(width);
  const seed = await seedPractice(page, false);
  await login(page, 'natvar', 'natvar-pass-1');
  await go(page, '#/my-devotees/6000000001', 0, '#fd-h');
  await go(page, '#/my-devotees/6000000001/2026-10-05', 0, '.wr-day');
  let d = await openPracticeDay(page, 0);
  ok(d.heading === 'Monday, 5 October · Sunil Kumar', `${W} facilitator opens a day: it names the day and the devotee (${d.heading})`);
  ok(/once the week is submitted/.test(d.none || ''), `${W} week being filled: hearing and reading wait for the submit (${d.none})`);
  // the same week submitted
  await page.evaluate(async () => {
    const m = await import('/src/lib/mock.js');
    const call = async (token, action, data) => { const r = await m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r.error)); return r.data; };
    const t = (await call(undefined, 'auth.login', { login: '6000000001', password: 'pass-12345' })).token;
    await call(t, 'week.saveWeekEnd', { weekId: '2026-10-05', version: 0, nightStay: 'YES', principles: 'YES' });
    await call(t, 'week.setAttendance', { weekId: '2026-10-05', mark: 'P' });
    await call(t, 'week.submit', { weekId: '2026-10-05' });
  });
  await go(page, '#/my-devotees/6000000001', 0, '#fd-h');
  await go(page, '#/my-devotees/6000000001/2026-10-05', 0, '.wr-day');
  ok(/Sunil Kumar/.test(await text(page, '.section .t-over') || ''), `${W} the week names the devotee`);
  d = await openPracticeDay(page, 0);
  ok(d.hearing && /^Hearing · 35 min$/.test(d.hearing.head) && d.hearing.lines.includes('Sunday feast class') && d.hearing.lines.some((l) => l === `Journal lecture, week ${seed.lectureWeek}`),
    `${W} hearing: minutes, the typed topic and the journal lecture (a facilitator has no journal: named by its week) ${JSON.stringify(d.hearing)}`);
  ok(d.reading && /^Reading · 25 min$/.test(d.reading.head) && d.reading.lines[0] === 'A book from the list', `${W} reading: minutes and the book ${JSON.stringify(d.reading)}`);
  ok(d.hearing.lines.length && d.reading.lines.length, `${W} both shown when the day has both`);
  if (width < 560) ok(d.below === true, `${W} phone: hearing and reading below the day's scores`);
  else ok(d.beside === true, `${W} wider screen: hearing and reading beside the day's scores`);
  await page.screenshot({ path: `${OUT}/dayview-fac-${width}.png` });
  d = await openPracticeDay(page, 1);
  ok(d.hearing.lines[0] === 'Japa workshop' && d.reading.none === 'No reading that day', `${W} hearing only: reading says "No reading that day"`);
  d = await openPracticeDay(page, 2);
  ok(d.hearing.none === 'No hearing that day' && d.reading.lines[0] === 'Bhagavad-gita As It Is', `${W} reading only: hearing says "No hearing that day"`);
  d = await openPracticeDay(page, 3);
  ok(d.hearing.none === 'No hearing that day' && d.reading.none === 'No reading that day', `${W} neither: both say so`);
  d = await openPracticeDay(page, 4);
  ok(d.hearing.lines[0] === LONG_TOPIC && d.reading.lines[0] === LONG_BOOK && d.wraps && !(await hScroll(page)), `${W} long topic and book titles wrap inside the panel, no sideways scroll`);
  await page.screenshot({ path: `${OUT}/dayview-long-${width}.png` });
  // not one of this facilitator's devotees (Bhavesh is with the other facilitator): no week, no day
  await go(page, '#/my-devotees/6000000012/2026-10-05', 0, '.banner');
  ok(/Not one of your devotees/.test(await text(page, '.banner') || '') && !(await page.$('.wr-days')) && !(await page.$('.dp')), `${W} another facilitator's devotee: refused, nothing shown`);
  await page.close();

  // the IYF head (with a journal): lecture and book by their names
  page = await fresh(width);
  await seedPractice(page, true);
  await login(page, 'guru', 'guru-pass-12');
  await go(page, '#/devotee/6000000001', 0, 'h2');
  await go(page, '#/devotee/6000000001/week/2026-10-05', 0, '.wr-day');
  d = await openPracticeDay(page, 0);
  ok(d.hearing.lines.some((l) => l.startsWith(seed.lectureTitle)) && d.reading.lines[0] === 'Beyond Birth and Death', `${W} the head sees the lecture and the book by name ${JSON.stringify([d.hearing.lines, d.reading.lines])}`);
  await page.screenshot({ path: `${OUT}/dayview-head-${width}.png` });
  await page.close();
}
async function dayViewAccess() {
  const W = '[390 day view access]';
  const page = await fresh(390);
  await seedPractice(page, true);
  // a devotee cannot read another devotee's week through either staff action
  const r = await page.evaluate(async () => {
    const m = await import('/src/lib/mock.js');
    const call = async (token, action, data) => m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data });
    const t = (await call(undefined, 'auth.login', { login: '6000000001', password: 'pass-12345' })).data.token;
    const a = await call(t, 'fac.week', { login: '6000000012', weekId: '2026-10-05' }), b = await call(t, 'devotees.week', { login: '6000000012', weekId: '2026-10-05' });
    return [a.ok, a.error?.code, b.ok, b.error?.code];
  });
  ok(!r[0] && !r[2], `${W} a devotee asking for another devotee's week is refused (${r.join(' ')})`);
  // a coordinator sees only the week being filled now; an earlier week is the head's
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/devotee/6000000001/week/2026-09-28', 0, '.banner');
  ok(/Coordinators see only the week being filled now/.test(await text(page, '.banner') || '') && !(await page.$('.dp')), `${W} a coordinator opening an earlier week is refused, nothing shown`);
  await go(page, '#/devotee/6000000001/week/2026-10-05', 0, '.wr-day');
  const d = await openPracticeDay(page, 0);
  ok(d.hearing?.lines.includes('Sunday feast class'), `${W} the coordinator sees this week's day with its hearing and reading`);
  await page.close();
}
if (!only || only === 'dayview') await part('dayview', async () => { { for (const w of [390, 820, 1280]) await dayView(w); await dayViewAccess(); } });
// ---------------- Phase 4: one navigation model, four layout classes, not-found / not-available ----------------
/** The navigation as drawn: where it is (bar / rail / sidebar), its visible items and the lit one. */
const navState = (page) => page.evaluate(() => {
  const vis = (e) => e && getComputedStyle(e).display !== 'none' && e.getClientRects().length;
  const nav = document.querySelector('nav.nav'), side = document.querySelector('aside.sidebar'), r = nav.getBoundingClientRect();
  const links = [...nav.querySelectorAll('a')].filter(vis);
  const kind = !vis(nav) ? (vis(side) ? 'sidebar' : 'none') : r.height > innerHeight / 2 && r.left <= 0.5 ? 'rail' : 'bar';
  const lit = kind === 'sidebar' ? [...side.querySelectorAll('a[aria-current="page"]')] : links.filter((a) => a.getAttribute('aria-current') === 'page');
  const main = document.querySelector('main.content').getBoundingClientRect();
  return { kind, items: links.map((a) => a.lastElementChild.firstChild.textContent.trim()), lit: lit.map((a) => a.textContent.replace(/\s+/g, ' ').trim()), litArea: lit[0]?.dataset.area || lit[0]?.closest('[data-area]')?.dataset.area || '',
    navRight: kind === 'rail' ? r.right : kind === 'sidebar' ? side.getBoundingClientRect().right : 0, mainLeft: main.left, navBottom: r.bottom, vh: innerHeight };
});
async function navLogin(width, login, pass, opts = {}) {
  const page = await envPage(width, opts.env || {}, { scheme: opts.scheme || '', height: opts.height || 0 });
  await go(page, '#/login', 0, '#login');
  await login_(page, login, pass);
  return page;
}
const login_ = (page, l, p) => login(page, l, p);
async function navLayouts() {
  for (const [width, scheme] of [[390, 'light'], [390, 'dark'], [768, 'light'], [768, 'dark'], [1280, 'light'], [1280, 'dark']]) {
    const W = `[${width} ${scheme} nav]`;
    const page = await navLogin(width, '6000000001', 'pass-12345', { scheme });
    await page.waitForSelector('.qc', { timeout: 15000 });
    let n = await navState(page);
    const want = width < 600 ? 'bar' : width < 1024 ? 'rail' : 'sidebar';
    ok(n.kind === want, `${W} drawn as the ${want} (${n.kind})`);
    if (want !== 'sidebar') ok(n.items.join('|') === 'Home|Week|Group|Report|Account', `${W} devotee items (a group leader): ${n.items.join(', ')}`);
    if (want === 'bar') ok(Math.abs(n.navBottom - n.vh) < 40, `${W} the bar floats at the bottom`);
    if (want !== 'bar') ok(n.mainLeft >= n.navRight - 0.5, `${W} content starts right of the ${want} (${n.mainLeft.toFixed(0)} ≥ ${n.navRight.toFixed(0)})`);
    ok(n.lit.length === 1 && /Home/.test(n.lit[0]) && n.litArea === 'devotee', `${W} Home is lit (aria-current), in the devotee colour`);
    await go(page, '#/week', 0, '.chip, .wk-row, h2');
    n = await navState(page); ok(n.lit.length === 1 && /week/i.test(n.lit[0]), `${W} #/week lights Week (${n.lit})`);
    await go(page, '#/history', 600);
    n = await navState(page); ok(n.lit.length === 1 && /Report/.test(n.lit[0]), `${W} #/history (nested) lights Report (${n.lit})`);
    await page.goBack(); await sleep(700);
    let hh = await page.evaluate(() => location.hash);
    n = await navState(page); ok(/^#\/week/.test(hh) && /week/i.test(n.lit[0] || ''), `${W} Back returns to Week, lit (${hh}, ${n.lit})`);
    await page.goForward(); await sleep(700);
    hh = await page.evaluate(() => location.hash);
    n = await navState(page); ok(hh === '#/history' && /Report/.test(n.lit[0] || ''), `${W} Forward to History, Report lit (${hh}, ${n.lit})`);
    if (width === 390 && scheme === 'light') {
      // keyboard: the first Tab reaches "Skip to content"; Enter on a nav link moves
      // keyboard: "Skip to content" is the first thing Tab reaches on every screen, and shows itself when focused
      const sk = await page.evaluate(() => { const f = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].find((e) => e.getClientRects().length || e.classList.contains('skip'));
        const s = document.querySelector('.skip'); s.focus(); const r = s.getBoundingClientRect(); return { first: f === s, shown: r.top >= 0 && r.bottom <= innerHeight }; });
      ok(sk.first && sk.shown, `${W} "Skip to content" comes first for the keyboard and shows when focused`);
      await page.focus('nav.nav a[href="#/report"]'); await page.keyboard.press('Enter'); await sleep(600);
      ok((await page.evaluate(() => location.hash)) === '#/report', `${W} Enter on a nav link opens it`);
    }
    await page.browserContext().close();
  }
}
async function navRoles() {
  const cases = [['sps', 'sps-pass-12', 'Home|Batch|Requests|Account', 'Home|Batch|Requests|Account'], ['master', 'master-pass-1', 'Home|Requests|Admin|Batch|Account', 'Home|Requests|Admin|Batch|Account'],
    // 8 Oct 2026: staff who also fill their own sadhana keep Requests (and the head, Admin) on the phone bar
    ['natvar', 'natvar-pass-1', 'Home|Students|Account', 'Home|Students|Account'], ['meera', 'meera-pass-1', 'Home|Week|Requests|Batch|Account', 'Home|Week|Requests|Batch|Report|Account'],
    ['guru', 'guru-pass-12', 'Home|Week|Requests|Admin|Account', 'Home|Week|Requests|Admin|Batch|Report|Account']];
  for (const [login, pass, phone, tablet] of cases) {
    for (const width of [390, 768]) {
      const page = await navLogin(width, login, pass);
      const W = `[${width} nav · ${login}]`;
      await sleep(500);
      const n = await navState(page), want = width < 600 ? phone : tablet;
      ok(n.items.join('|') === want, `${W} ${width < 600 ? 'bar' : 'rail'}: ${n.items.join(', ')}`);
      if (login === 'meera' || login === 'guru') {
        // one model whatever screen is open: the same items, the same rail, on an own screen and on a batch screen
        await go(page, '#/batch', 0, 'h2, .board, .empty');
        const b = await navState(page);
        ok(b.items.join('|') === want && b.kind === n.kind, `${W} the same navigation on #/batch (${b.kind}: ${b.items.join(', ')})`);
        // a phone bar without Batch (the head with a sadhana) lights nothing there; the menu shows where you are
        if (want.includes('Batch')) ok(/Batch/.test(b.lit[0] || '') && b.litArea === 'coordinator', `${W} Batch lit in the coordinator colour (${b.litArea})`);
        else ok(!b.lit.length, `${W} Batch is not on this bar, so nothing is lit (${b.lit})`);
      }
      await page.browserContext().close();
    }
  }
}
async function navAccess() {
  const W = '[390 not found / not available]';
  let page = await navLogin(390, '6000000001', 'pass-12345');
  for (const [hash, title] of [['#/batch', 'Not available to you'], ['#/overview', 'Not available to you'], ['#/nowhere', 'Page not found'], ['#/devotee/', 'Page not found'], ['#/week/abc', 'Page not found']]) {
    await go(page, hash, 0, '.empty .e-title');
    const r = await page.evaluate(() => ({ t: document.querySelector('.empty .e-title')?.textContent.trim(), home: !!document.querySelector('.empty a[href="#/home"]'), board: !!document.querySelector('.board, .wr-days, .qc'), bar: document.querySelector('.topbar .pagetitle')?.textContent.trim() }));
    ok(r.t === title && r.home && !r.board, `${W} devotee ${hash}: "${r.t}", a way Home, nothing else shown`);
    if (title === 'Page not found') ok(r.bar === 'Not found', `${W} ${hash}: top bar says "Not found" (${r.bar})`);
  }
  await page.browserContext().close();
  page = await navLogin(390, 'sps', 'sps-pass-12');
  for (const hash of ['#/overview', '#/week', '#/my-devotees']) {
    await go(page, hash, 0, '.empty .e-title');
    ok((await text(page, '.empty .e-title')) === 'Not available to you', `[390 not available] coordinator ${hash}: not available`);
  }
  await page.browserContext().close();
  // a direct link to a nested screen opened while signed out: after signing in, the person lands on it, lit
  // (a reload with a live session keeps the screen; the mock's data does not survive a reload, so that is checked live)
  page = await envPage(768, {});
  await page.evaluate(() => { location.hash = '#/history'; }); await sleep(300);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(0); });
  await page.waitForSelector('.welcome', { timeout: 15000 });
  await go(page, '#/login', 0, '#login');
  await login(page, '6000000001', 'pass-12345'); await sleep(800);
  const n = await navState(page), hh = await page.evaluate(() => location.hash);
  ok(hh === '#/history' && /Report/.test(n.lit[0] || ''), `[768 nav] a direct link to #/history: after signing in, there, Report lit (${hh})`);
  await page.browserContext().close();
}
async function navSheets() {
  for (const width of [390, 768, 1280]) {
    const W = `[${width} sheets]`;
    const page = await navLogin(width, '6000000001', 'pass-12345');
    await page.waitForSelector('.qc', { timeout: 15000 });
    const href = await page.evaluate(() => document.querySelector('a.s-pill[href^="#/day/"], a.btn-primary[href^="#/day/"]')?.getAttribute('href'));
    await go(page, href, 0, '#f-sleptAt-btn');
    await page.click('#f-sleptAt-btn'); await sleep(600);
    const r = await page.evaluate(() => { const d = document.querySelector('dialog.tp-sheet[open]').getBoundingClientRect(); return { l: d.left, r: d.right, b: d.bottom, t: d.top, w: innerWidth, h: innerHeight }; });
    if (width < 600) ok(Math.abs(r.b - r.h) < 2 && r.l < 1 && Math.abs(r.r - r.w) < 1, `${W} the time picker is a bottom sheet (full width, at the bottom)`);
    else ok(Math.abs((r.l + r.r) / 2 - r.w / 2) < 2 && Math.abs((r.t + r.b) / 2 - r.h / 2) < 2, `${W} the time picker is a centred dialog`);
    await page.keyboard.press('Escape'); await sleep(400);
    ok(!(await page.$('dialog.tp-sheet[open]')) && (await page.evaluate(() => document.activeElement?.id)) === 'f-sleptAt-btn', `${W} Escape closes it and focus returns to the field`);
    await page.browserContext().close();
  }
}
// Phase 7 (Android, 5 Oct 2026): the phone's Back closes an open sheet or the drawer instead of leaving the screen
// (Chrome does not route Back to a <dialog>); closing any other way leaves no extra Back step; a link in the drawer
// replaces the dialog's entry; the day's leave guard still asks on a real leave.
async function navBack() {
  const W = '[390 back]';
  const back = async (page) => { await page.evaluate(() => history.back()); await sleep(500); };
  const openSheets = (page) => page.evaluate(() => [...document.querySelectorAll('dialog')].filter((d) => d.open).map((d) => d.className));
  const page = await navLogin(390, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 });
  const home = await page.evaluate(() => location.hash);
  const href = await page.evaluate(() => document.querySelector('a.s-pill[href^="#/day/"], a.btn-primary[href^="#/day/"]')?.getAttribute('href'));
  await go(page, href, 0, '.jumpbar, .dayrail');
  const day = await page.evaluate(() => location.hash);
  await page.evaluate(() => [...document.querySelectorAll('.jscore, .dr-rules')].find((b) => b.getClientRects().length)?.click()); await sleep(400);
  ok((await openSheets(page)).some((c) => /rules-sheet/.test(c)), `${W} the scoring sheet opens`);
  await back(page);
  ok((await openSheets(page)).length === 0 && (await page.evaluate(() => location.hash)) === day, `${W} Back closes the sheet and stays on the day`);
  await page.evaluate(() => [...document.querySelectorAll('.jscore, .dr-rules')].find((b) => b.getClientRects().length)?.click()); await sleep(400);
  await page.keyboard.press('Escape'); await sleep(500);
  ok((await openSheets(page)).length === 0, `${W} Escape closes the sheet`);
  await back(page);
  ok((await page.evaluate(() => location.hash)) === home, `${W} after Escape, one Back returns to Home (no extra step)`);
  await go(page, href, 0, '.jumpbar, .dayrail');
  await page.click('#f-sleptAt-btn'); await sleep(500);
  await back(page);
  ok((await openSheets(page)).length === 0 && (await page.evaluate(() => location.hash)) === day, `${W} Back closes the time picker and stays on the day`);
  // unsaved changes: Back closes the sheet only; the next Back is a real leave and asks first
  await setRounds(page, '10'); await page.keyboard.press('Tab'); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('.jscore, .dr-rules')].find((b) => b.getClientRects().length)?.click()); await sleep(400);
  await back(page);
  ok((await openSheets(page)).length === 0 && (await page.evaluate(() => location.hash)) === day, `${W} with unsaved changes, Back closes the sheet without asking`);
  await back(page);
  const asked = await page.evaluate(() => ({ title: document.querySelector('dialog.sheet[open] h2')?.textContent || '', hash: location.hash }));
  ok(/Save changes before leaving/.test(asked.title) && asked.hash === day, `${W} the next Back asks before leaving (${JSON.stringify(asked)})`);
  await clickText(page, 'dialog.sheet[open] button', /^Stay$/); await sleep(300);
  ok((await openSheets(page)).length === 0 && (await page.evaluate(() => location.hash)) === day, `${W} Stay keeps the day`);
  await clickText(page, 'dialog.sheet[open] button, .actionbar button', /^Save/);
  // the save must have LANDED before leaving: late in the gate's run a save took longer than 8 s, so leaving rightly
  // asked "Save changes before leaving?", that sheet covered the menu button, and the drawer check failed (19 Oct 2026)
  const saved = await page.waitForFunction(() => /Saved ✓/.test(document.querySelector('.actionbar')?.textContent || ''), { timeout: 30000 }).then(() => true, () => false);
  ok(saved, `${W} the day saves before leaving it`);
  // the drawer
  await go(page, home, 0, '.menu-btn');
  // wait for the drawer, never a fixed sleep: 400 ms was not enough 16 minutes into the gate's run (18 Oct 2026)
  const drawerOpen = () => page.waitForFunction(() => !!document.querySelector('dialog.drawer[open]'), { timeout: 8000 }).catch(() => {});
  await page.click('.menu-btn'); await drawerOpen();
  const seen = async () => JSON.stringify({ hash: await page.evaluate(() => location.hash), sheets: await openSheets(page) });
  ok((await openSheets(page)).some((c) => /drawer/.test(c)), `${W} the menu drawer opens (${await seen()})`);
  await back(page);
  ok((await openSheets(page)).length === 0 && (await page.evaluate(() => location.hash)) === home, `${W} Back closes the drawer and stays on Home`);
  await page.waitForSelector('.menu-btn', { timeout: 8000 }).catch(() => {});
  // a failure above is reported there; it must not crash the run (no menu button = the next check fails, with a reason)
  await page.$eval('.menu-btn', (b) => b.click()).catch(() => {}); await drawerOpen();
  await page.evaluate(() => document.querySelector('dialog.drawer a.mi[href^="#/account"]')?.click()); await sleep(700);
  const acc = await page.evaluate(() => location.hash);
  ok(/^#\/account/.test(acc) && (await openSheets(page)).length === 0, `${W} a drawer link opens its screen and closes the drawer (${acc})`);
  await back(page);
  ok((await page.evaluate(() => location.hash)) === home, `${W} one Back from there returns to Home`);
  await page.browserContext().close();
}
async function navTiers() {
  // the look tier changes richness, never structure: High and Low draw the same navigation in the same place
  for (const width of [768, 1280]) {
    const shape = async (env) => { const page = await navLogin(width, '6000000001', 'pass-12345', { env }); await page.waitForSelector('.qc', { timeout: 15000 }); const n = await navState(page); n.tier = await tierNow(page); await page.browserContext().close(); return n; };
    const hi = await shape(DESKTOP), lo = await shape(ANDROID_LOW);
    ok(hi.tier === 'high' && lo.tier === 'low' && hi.kind === lo.kind && hi.items.join() === lo.items.join() && Math.abs(hi.navRight - lo.navRight) < 1 && Math.abs(hi.mainLeft - lo.mainLeft) < 1,
      `[${width} tiers] High and Low: the same ${hi.kind} and layout (${hi.items.join(', ')})`);
  }
}
async function navOverflow() {
  // no sideways scroll on representative screens of every role, at every layout class and a phone on its side
  const sizes = [[320, 740], [390, 844], [600, 900], [768, 1024], [820, 1180], [900, 1000], [1023, 768], [1024, 768], [1280, 900], [1440, 900], [1920, 1080], [740, 360]];
  const plan = [['6000000001', 'pass-12345', ['#/home', '#/week', '#/report', '#/account', '#/wall']], ['sps', 'sps-pass-12', ['#/batch', '#/members', '#/requests', '#/devotee/6000000001']], ['master', 'master-pass-1', ['#/overview', '#/coordinators', '#/settings']]];
  for (const [login, pass, hashes] of plan) {
    const page = await navLogin(390, login, pass);
    const bad = [];
    for (const h of hashes) {
      await go(page, h, 900);
      for (const [w, ht] of sizes) { await page.setViewport({ width: w, height: ht, deviceScaleFactor: 1 }); await sleep(120); if (await hScroll(page)) bad.push(`${h}@${w}x${ht}`); }
    }
    ok(!bad.length, `[nav overflow · ${login}] no sideways scroll on ${hashes.length} screens × ${sizes.length} sizes${bad.length ? ': ' + bad.join(', ') : ''}`);
    await page.browserContext().close();
  }
  // a very long name in the menu and the top of the week: cut with …, never pushing the layout
  const page = await navLogin(390, '6000000001', 'pass-12345');
  await page.evaluate(async () => { const { session } = await import('/src/lib/session.svelte.js'); session.user = { ...session.user, name: 'Śrīmatī Rādhārāṇī Devī Dāsī Bhaktivedanta Gaudiya Vaishnava Long Surname Example' }; });
  await page.click('.menu-btn'); await sleep(400);
  const r = await page.evaluate(() => { const d = document.querySelector('dialog.drawer .mprofile'); return { fits: d.scrollWidth <= d.clientWidth + 1, page: document.documentElement.scrollWidth <= innerWidth + 1 }; });
  ok(r.fits && r.page, '[390 nav] a very long name in the menu: cut to fit, no sideways scroll');
  await page.browserContext().close();
}
async function chartLabels() {
  // chart labels (the head, 4 Oct 2026: "Attendance" broke as "Attendanc / e"): a one-word label stays on one line,
  // also with the phone's font set larger
  for (const [width, font] of [[320, 16], [390, 16], [390, 20], [768, 20]]) {
    const page = await fresh(width);
    await seedPractice(page, true);
    await login(page, '6000000001', 'pass-12345');
    await page.evaluate((f) => { document.documentElement.style.fontSize = f + 'px'; }, font);
    const broken = [];
    for (const h of ['#/week/2026-10-05', '#/report']) {
      await go(page, h, 0, '.bars .lbl, .m-list .m-l');
      await sleep(400);
      broken.push(...await page.evaluate((h) => [...document.querySelectorAll('.bars .lbl, .m-list .m-l')].filter((l) => !/\s/.test(l.textContent.trim())).filter((l) => {
        const r = document.createRange(); r.selectNodeContents(l); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1;
      }).map((l) => h + ' ' + l.textContent.trim()), h));
    }
    ok(!broken.length, `[${width} charts, ${font}px text] one-word labels on one line${broken.length ? ': ' + broken.join(', ') : ''}`);
    await page.close();
  }
}
if (!only || only === 'charts' || !only) await part('charts', async () => { await chartLabels(); });
if (!only || only === 'nav') await part('nav', async () => { { await navLayouts(); await navRoles(); await navAccess(); await navSheets(); await navTiers(); await navOverflow(); } });
if (!only || only === 'nav' || only === 'back') await part('nav', async () => { await navBack(); });
// ---------------- Phase 1: a silent server fails fast; an open with no connection keeps the person and their Home ----------------
async function phase1() {
  const W = '[390 phase 1]';
  // a server that does not answer: Login says so (instead of spinning), and trying again works
  let page = await fresh(390);
  await page.waitForSelector('#login'); await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  await page.evaluate(async () => { (await import('/src/lib/api.js')).config.timeoutMs = 1500; (await import('/src/lib/mock.js')).setLatency(6000); });
  await page.type('#login', '6000000001'); await page.type('#password', 'pass-12345');
  const t0 = Date.now(); await page.click('button[type=submit]');
  await page.waitForFunction(() => /not answering/.test(document.querySelector('[role=alert]')?.textContent || ''), { timeout: 6000 }).catch(() => {});
  const msg = await text(page, '[role=alert]');
  ok(/not answering/.test(msg || '') && Date.now() - t0 < 4500, `${W} a silent server: "${msg}" after ${((Date.now() - t0) / 1000).toFixed(1)} s, not a 40 s spinner`);
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setLatency(0); (await import('/src/lib/api.js')).config.timeoutMs = 15000; });
  await page.click('button[type=submit]');            // the typed phone and password are still there: just try again
  await page.waitForSelector('.qc', { timeout: 15000 }).catch(() => {});
  ok(!!(await page.$('.qc')), `${W} trying again signs in`);
  await sleep(800);
  // reopen with no connection: still the person, on Home with the kept data, the offline note shown, not the welcome screen
  await page.evaluate(() => localStorage.setItem('sr.mockOffline', '1'));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.hero-card, .cblock', { timeout: 8000 }).catch(() => {});
  // the note follows the first request that fails, a moment after the kept Home shows (1 run in 3 read it too early)
  await page.waitForSelector('.netbar', { timeout: 5000 }).catch(() => {});
  const off = await page.evaluate(() => ({ hash: location.hash, welcome: !!document.querySelector('.welcome'), home: !!document.querySelector('.hero-card, .cblock'), name: document.querySelector('.greet h2')?.textContent || '', note: document.querySelector('.netbar')?.textContent || '' }));
  ok(off.hash === '#/home' && !off.welcome && off.home && /Sunil/.test(off.name), `${W} reopened with no connection: Home with the kept data (${off.name.trim()})`);
  ok(/offline/i.test(off.note), `${W} … and says it is offline ("${off.note.trim()}")`);
  await page.screenshot({ path: `${OUT}/phase1-offline-home.png` });
  await page.evaluate(() => localStorage.removeItem('sr.mockOffline'));
  await page.close();
  // log out: nothing of the person stays on the phone
  page = await fresh(390);
  await login(page, '6000000001', 'pass-12345'); await page.waitForSelector('.qc', { timeout: 15000 }); await sleep(800);
  const before = await page.evaluate(async () => (await (await import('/src/lib/idb.js')).idbKeys('c:')).length);
  await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(800);
  const after = await page.evaluate(async () => ({ kept: (await (await import('/src/lib/idb.js')).idbKeys('c:')).length, user: localStorage.getItem('sr.user') }));
  ok(before > 0 && after.kept === 0 && after.user === null, `${W} log-out removes the kept person and data (${before} kept → ${after.kept})`);
  await page.close();
}
if (!only || only === 'phase1') await part('phase1', async () => { await phase1(); });
// ---------------- Phase 7: inline Undo, Go to… (head and coordinators), keyboard shortcuts; the head's UI fixes (5 Oct) ----------------
async function phase7() {
  const W = '[phase 7]';
  const toastUndo = (page) => page.evaluate(() => [...document.querySelectorAll('.toast button')].find((b) => b.textContent.trim() === 'Undo')?.click());
  // Undo: a group leader's attendance
  let page = await fresh(390, { clock: classDayIso('SUN') });
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/group', 1200, '.brow');
  const lead = () => page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); return JSON.stringify((await call('group.list', {})).members.map((m) => m.attendance)); });
  const g0 = await lead();
  await page.evaluate(() => document.querySelectorAll('.brow')[0].querySelectorAll('.pa button')[1].click()); await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Save attendance')).click()); await sleep(800);
  const g1 = await lead();
  const gUndo = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent.trim()));
  await toastUndo(page); await sleep(900);
  const g2 = await lead();
  ok(g1 !== g0 && g2 === g0 && /Attendance put back/.test(await text(page, '.toasts') || ''), `${W} group attendance saved, then Undo puts it back` + (g1 !== g0 && g2 === g0 ? '' : ` ${JSON.stringify({ g0: g0.slice(0, 200), g1: g1.slice(0, 200), g2: g2.slice(0, 200), gUndo })}`));
  await page.close();
  // Undo: no regular class this week (coordinator)
  page = await fresh(390, { clock: classDayIso('SUN') });
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/batch', 1200, 'li.brow');
  // several batches open on "All my batches" (Phase 22 F1); "no regular class" is a single batch's, so choose SPS
  await sel(page, '#bt-batch', 'SPS'); await sleep(600);
  await clickText(page, 'button', /No regular class this week\?/);
  await clickText(page, 'dialog.sheet[open] .seg button', /^Festival$/);
  await page.type('#cw-note', 'Diwali');
  await page.evaluate(() => document.querySelectorAll('dialog.sheet[open] input[type=radio]')[1].click());
  await clickText(page, 'dialog.sheet[open] button', /^Save$/); await sleep(600);
  const set = /Diwali/.test(await text(page, '.content') || '');
  await toastUndo(page); await sleep(900);
  ok(set && !/Diwali/.test(await text(page, '.content') || '') && /Class week put back/.test(await text(page, '.toasts') || ''), `${W} "no regular class" saved, then Undo makes it a regular class again`);
  await page.close();
  // Undo: switching a facilitator off (the head)
  page = await fresh(390);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/facilitators', 800, '.fac-row');
  const sw = () => page.evaluate(() => [...document.querySelectorAll('.fac-row')].find((r) => r.querySelector('.lt').textContent.trim() === 'Jaya Vamandev Prabhuji').querySelector('input[role=switch]').checked);
  await page.evaluate(() => [...document.querySelectorAll('.fac-row')].find((r) => r.querySelector('.lt').textContent.trim() === 'Jaya Vamandev Prabhuji').querySelector('input[role=switch]').click()); await sleep(600);
  const off = !(await sw());
  await toastUndo(page); await sleep(900);
  ok(off && (await sw()), `${W} a facilitator switched off, then Undo switches them on again`);
  // Go to…: the search button, "/" and Ctrl K; a screen and a devotee; ↑ ↓ Enter; Back returns
  await go(page, '#/overview', 900, '.content h2, .content h3');
  const csOpen = () => page.evaluate(() => !!document.querySelector('dialog.cs-sheet[open]'));
  // a tap during the page change's animation is not delivered: let it finish (a busy page can take ~1 s)
  await page.evaluate(async () => { const t = performance.now(); while (document.activeViewTransition && performance.now() - t < 8000) await new Promise((r) => setTimeout(r, 50)); });
  await page.click('.topbar button[aria-label="Go to a screen or devotee"]'); await page.waitForSelector('dialog.cs-sheet[open]', { timeout: 8000 }).catch(() => {}); await sleep(200);
  ok(await csOpen(), `${W} the head: the search button opens Go to…`);
  await page.keyboard.press('Escape'); await sleep(400);
  await page.keyboard.press('/'); await sleep(400);
  ok(await csOpen(), `${W} "/" opens Go to…`);
  await page.keyboard.type('sett'); await sleep(300);
  await page.keyboard.press('Enter'); await sleep(800);
  ok((await page.evaluate(() => location.hash)) === '#/settings' && !(await csOpen()), `${W} typing "sett" + Enter opens Settings`);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control'); await sleep(400);
  ok(await csOpen(), `${W} Ctrl K opens Go to…`);
  await page.keyboard.type('Sunil'); await sleep(900);
  const found = await page.evaluate(() => [...document.querySelectorAll('dialog.cs-sheet[open] .cs-row')].map((a) => a.getAttribute('href')));
  const at = found.indexOf('#/devotee/6000000001');
  ok(at >= 0, `${W} a devotee by name: Sunil Kumar is found (${found.length} results)`);
  for (let i = 0; i < at; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); await sleep(1200);
  ok((await page.evaluate(() => location.hash)) === '#/devotee/6000000001', `${W} ↓ and Enter open the devotee`);
  await page.goBack(); await sleep(900);
  ok((await page.evaluate(() => location.hash)) === '#/settings' && !(await csOpen()), `${W} one Back returns to the screen underneath, the search closed`);
  // shortcuts: g then a letter; never while typing
  await page.keyboard.press('g'); await page.keyboard.press('b'); await sleep(800);
  ok((await page.evaluate(() => location.hash)).startsWith('#/batch'), `${W} g b: Batch`);
  await page.keyboard.press('g'); await page.keyboard.press('h'); await sleep(800);
  ok((await page.evaluate(() => location.hash)) === '#/home', `${W} g h: Home`);
  await page.close();
  // a devotee: no Go to…; their own shortcuts; typing in a field never jumps; ? opens How to use with the shortcuts
  page = await fresh(1280);
  await login(page, '6000000001', 'pass-12345'); await page.waitForSelector('.qc', { timeout: 15000 });
  ok(!(await page.$('.topbar button[aria-label="Go to a screen or devotee"]')), `${W} a devotee has no Go to… button`);
  await page.keyboard.press('/'); await sleep(300);
  ok(!(await page.$('dialog.cs-sheet[open]')), `${W} "/" does nothing for a devotee`);
  await page.keyboard.press('g'); await page.keyboard.press('w'); await sleep(900);
  ok((await page.evaluate(() => location.hash)).startsWith('#/week'), `${W} g w: Week`);
  await page.keyboard.press('g'); await page.keyboard.press('r'); await sleep(900);
  ok((await page.evaluate(() => location.hash)) === '#/report', `${W} g r: Report`);
  await go(page, '#/account', 900, 'h3');
  const field = await page.$('main input:not([type=hidden]), main textarea');
  if (field) { await field.focus(); await page.keyboard.type('gh'); await sleep(500); }
  ok((await page.evaluate(() => location.hash)).startsWith('#/account'), `${W} typing "gh" in a field does not jump`);
  await page.evaluate(() => document.activeElement?.blur());
  // (Phase 9: How to use opens as a sheet over the current screen, wherever you are — the page stays)
  await page.keyboard.press('?');
  await page.waitForSelector('dialog[open] [id^=h-how]', { timeout: 5000 }).catch(() => {}); await sleep(400);
  const how = await page.evaluate(() => ({ hash: location.hash, open: !!document.querySelector('dialog[open] [id^=h-how]'), keys: [...document.querySelectorAll('dialog[open] details summary')].some((x) => x.textContent.trim() === 'Keyboard shortcuts') }));
  ok(how.open && how.hash.startsWith('#/account') && how.keys, `${W} ? opens How to use over the screen, which lists the shortcuts (${JSON.stringify(how)})`);
  await page.close();

  // the head's UI fixes (5 Oct): the slide-out menu leaves out what the bar shows; Report issue; theme row; Daily / Weekly
  for (const width of [390, 768]) {
    page = await fresh(width);
    await login(page, '6000000001', 'pass-12345'); await page.waitForSelector('.qc', { timeout: 15000 });
    await page.click('.menu-btn'); await sleep(450);
    const m = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('dialog.drawer a.mi, dialog.drawer button.mi')].filter((a) => a.getClientRects().length).map((a) => a.getAttribute('href') || a.textContent.trim());
      const bar = [...document.querySelectorAll('nav.nav a')].filter((a) => getComputedStyle(a).display !== 'none').map((a) => a.getAttribute('href'));
      return { vis, dup: vis.filter((h) => bar.includes(h)), issue: document.querySelector('dialog.drawer a[href^="mailto:praveenj811@gmail.com"]')?.getAttribute('href') || '' };
    });
    ok(!m.dup.length && !m.vis.includes('#/week') && !m.vis.includes('#/report'), `[${width} menu] no duplicates of the ${width < 600 ? 'bar' : 'rail'} (This week and Report gone) · ${m.vis.filter((x) => x.startsWith('#')).join(' ')}`);
    ok(/subject=Sadhana%20Record/.test(m.issue) && /App%20version/.test(m.issue) && /Screen/.test(m.issue), `[${width} menu] Report issue: an email to praveenj811@gmail.com with the screen and app version filled in`);
    await page.keyboard.press('Escape'); await page.close();
  }
  page = await fresh(1280);
  await login(page, '6000000001', 'pass-12345'); await page.waitForSelector('.qc', { timeout: 15000 });
  const side = await page.evaluate(() => [...document.querySelectorAll('aside.sidebar a.mi')].map((a) => a.getAttribute('href')));
  ok(side.includes('#/week') && side.includes('#/report'), `[1280 menu] the desktop sidebar (the only navigation there) keeps This week and Report`);
  await page.close();
  // Daily / Weekly: each word inside its button, also with a larger phone font
  for (const [width, font] of [[320, 16], [360, 18], [363, 20], [363, 24], [363, 28], [390, 20], [412, 20], [412, 28], [768, 20], [1280, 28]]) {
    page = await fresh(width);
    await login(page, '6000000001', 'pass-12345');
    await page.evaluate((f) => { document.documentElement.style.fontSize = f + 'px'; }, font);
    await go(page, '#/report', 0, '#rp-mode');
    await sleep(400);
    const r = await page.evaluate(() => [...document.querySelectorAll('#rp-mode button')].map((b) => ({ t: b.textContent.trim(), fits: b.scrollWidth <= b.clientWidth + 1, h: b.parentElement.getBoundingClientRect().height, inside: (() => { const g = b.parentElement.getBoundingClientRect(), x = b.getBoundingClientRect(); return x.left >= g.left - 1 && x.right <= g.right + 1; })() })));
    ok(r.length === 2 && r.every((x) => x.fits && x.inside && x.h >= 40) && !(await hScroll(page)), `[${width}, ${font}px text] Report: Daily and Weekly each inside its button, no sideways scroll` + (r.every((x) => x.fits && x.inside && x.h >= 40) ? '' : ' ' + JSON.stringify(r)));
    if (width === 363) await page.screenshot({ path: `${OUT}/report-toggle-363-${font}px.png` });
    await page.close();
  }
}
// ---------------- the devotee changes their own facilitator in Account (the head, 5 Oct 2026) ----------------
async function facilitatorEdit() {
  for (const [width, dark] of [[360, false], [390, true], [768, false], [1280, true]]) {
    const page = await fresh(width);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
    await login(page, '6000000001', 'pass-12345'); await page.waitForSelector('.qc', { timeout: 15000 });
    await go(page, '#/account', 0, '#h-facilitator');
    await sleep(500);
    const v = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('section.esec')].map((x) => x.getAttribute('aria-labelledby'));
      const sec = document.querySelector('#h-facilitator').closest('section');
      return { ids, text: sec.querySelector('.esec-view')?.textContent.replace(/\s+/g, ' ').trim(), w: sec.getBoundingClientRect().width, emW: document.querySelector('#h-emergency').closest('section').getBoundingClientRect().width };
    });
    ok(v.ids.indexOf('h-facilitator') === v.ids.indexOf('h-emergency') + 1 && /Your facilitator/.test(v.text) && Math.abs(v.w - v.emW) < 1 && !(await hScroll(page)),
      `[${width} account] Facilitator section right after Emergency contact, same width, shows "${v.text}"`);
    const before = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); return (await call('profile.get', {})).facilitator; });
    await page.$eval('section:has(#h-facilitator) .esec-pen', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); });
    await sleep(400);
    const w = await wheelChoices(page, '#pf-fac');
    const other = w.values.find((x) => x && x !== before);
    ok(w.current === before && w.values.length > 1, `[${width} account] the list of facilitators, the current one chosen (${w.values.length} names)`);
    if (width === 390 || width === 1280) await page.screenshot({ path: `${OUT}/account-facilitator-edit-${width}-${dark ? 'dark' : 'light'}.png` });
    await sel(page, '#pf-fac', other);
    await page.evaluate(() => [...document.querySelectorAll('section:has(#h-facilitator) button')].find((b) => b.textContent.trim() === 'Save')?.click());
    await sleep(900);
    const after = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); return (await call('profile.get', {})).facilitator; });
    const shown = await page.evaluate(() => document.querySelector('#h-facilitator').closest('section').querySelector('.esec-view')?.textContent || '');
    ok(after === other && shown.includes(other) && /Facilitator saved/.test(await text(page, '.toasts') || ''), `[${width} account] changed to ${other}: saved, shown, "Facilitator saved."`);
    if (width === 390 || width === 1280) { await page.$eval('#h-facilitator', (e) => e.scrollIntoView({ block: 'center' })); await sleep(300); await page.screenshot({ path: `${OUT}/account-facilitator-${width}-${dark ? 'dark' : 'light'}.png` }); }
    await page.close();
  }
  // a typed name never reaches the server; the head and a coordinator (not devotees) have no Facilitator section
  let page = await fresh(390);
  await login(page, '6000000001', 'pass-12345'); await page.waitForSelector('.qc', { timeout: 15000 });
  const typed = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); try { await call('profile.update', { facilitator: 'Typed Name Prabhuji' }); return 'saved'; } catch (e) { return e.code; } });
  ok(typed === 'VALIDATION', `[account] a name not on the list is refused (${typed})`);
  await page.close();
  page = await fresh(390);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/account', 0, '#h-emergency');
  await sleep(400);
  ok(!(await page.$('#h-facilitator')), `[account] the head has no Facilitator section`);
  await page.close();
}
if (!only || only === 'phase7') await part('phase7', async () => { await phase7(); });
if (!only || only === 'facilitator') await part('facilitator', async () => { await facilitatorEdit(); });

// ---------------- 7 Oct 2026: filling for someone with their own lists; group greying; member facilitators; TRD; admin ----------------
async function phase10() {
  const W = '[7 Oct]';
  // 1. a coordinator filling a devotee's day sees the devotee's own journal, heard marks and week (not week 1 of 81)
  let page = await fresh(390, { clock: classDayIso('SUN') });
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/batch', 1200, 'li.brow');
  // several batches open on "All my batches" (Phase 22 F1): this is about an SPS devotee's journal, so choose SPS
  await sel(page, '#bt-batch', 'SPS'); await sleep(600);
  await fillLink(page); await clickFill(page);
  await page.waitForSelector('a.lrow[href*="/day/"]', { timeout: 10000 }).catch(() => {}); await sleep(1200);   // and the page change settled
  await page.click('a.lrow[href*="/day/"]'); await page.waitForSelector('.actionbar', { timeout: 8000 }); await sleep(500);
  await page.click('#f-hearing .pickrow'); await page.waitForSelector('dialog[open] .wkstrip', { timeout: 8000 }).catch(() => {}); await sleep(300);
  const fw = await page.evaluate(() => ({ step: document.querySelector('.wknow [aria-live]')?.textContent.replace(/\s+/g, ' ').trim() || '', next: document.querySelectorAll('dialog[open] .wkstrip button').length !== 81,
    heard: [...document.querySelectorAll('.action .text-xs')].some((x) => /heard/.test(x.textContent)) }));
  ok(/^Lesson week \d+ of 81$/.test(fw.step) && !/^Lesson week 81 /.test(fw.step) && fw.next === false, `${W} filling for a devotee: their whole journal, opening at their week (${fw.step})`);
  await page.evaluate(() => { const b = [...document.querySelectorAll('dialog[open] .wkstrip button')], i = b.findIndex((x) => x.getAttribute('aria-pressed') === 'true'); b[Math.max(0, i - 1)]?.click(); }); await sleep(200);
  ok(await page.evaluate(() => [...document.querySelectorAll('.action .text-xs')].some((x) => /heard/.test(x.textContent))), `${W} …with the lectures they have heard marked "heard"`);
  await page.close();

  // 2. a group leader: who still has to submit (amber edge), then the submitted ones — full contrast since Phase 5 (the
  //    greying read poorly in dark mode); one summary strip instead of three counts
  page = await fresh(390, { clock: classDayIso('SUN') });
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/group', 1200, '.brow');
  const g = await page.evaluate(() => ({ heads: [...document.querySelectorAll('.gl-h h3')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()), strips: document.querySelectorAll('.scope').length,
    done: [...document.querySelectorAll('ul[aria-label=Submitted] li.brow')].map((li) => +getComputedStyle(li.querySelector('.who')).opacity),
    edge: getComputedStyle(document.querySelector('.gl-todo') || document.body).borderLeftWidth }));
  ok(g.strips === 1 && /^Still to submit \d+$/.test(g.heads[0] || '') && /^Submitted \d+$/.test(g.heads[1] || '') && g.done.length && g.done.every((o) => o === 1) && g.edge === '3px', `${W} group: one strip; still to submit (amber edge) before submitted (full contrast): ${g.heads.join(' / ')}`);
  if (g.done.length) await page.screenshot({ path: `${OUT}/oct7-group-390.png` });
  await page.close();

  // 3. a facilitator who uses the app as a devotee: the head links their phone; their own login gets My students
  page = await fresh(390);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/facilitators', 900, '.fac-row');
  const chipsOneLine = await page.evaluate(() => { const t = [...document.querySelectorAll('.fac-tools .chipbtn')].map((b) => Math.round(b.getBoundingClientRect().top)); return t.length > 1 && new Set(t).size === 1; });
  ok(chipsOneLine, `${W} admin › Facilitators: the All / Switched on / off chips on one line`);
  await page.screenshot({ path: `${OUT}/oct7-facilitators-390.png` });
  const addOneLine = await page.evaluate(() => { const i = document.querySelector('.fac-add input').getBoundingClientRect(), b = document.querySelector('.fac-add button').getBoundingClientRect(); return Math.abs((i.top + i.bottom) / 2 - (b.top + b.bottom) / 2) < 12; });
  ok(addOneLine, `${W} admin › Facilitators: "Add a facilitator" and its Add button on one line`);
  // the logins arrive in their own call after the list: wait for them, or a name WITH a login (Natvar's) looks free
  await page.waitForFunction(() => [...document.querySelectorAll('.fac-row')].some((r) => /Login:|In the app/.test(r.textContent)), { timeout: 8000 }).catch(() => {});
  const free = await page.evaluate(() => [...document.querySelectorAll('.fac-row')].find((r) => !/Login:|In the app/.test(r.textContent) && !r.hasAttribute('data-off'))?.querySelector('.lt').textContent.trim());
  await page.evaluate((n) => [...document.querySelectorAll('.fac-row')].find((r) => r.querySelector('.lt').textContent.trim() === n).querySelector('button[aria-label^="Give a login"]').click(), free); await sleep(500);
  ok(await page.evaluate(() => /Yes, as a devotee/.test(document.querySelector('dialog[open]')?.textContent || '')), `${W} the access sheet asks: do they use the app already?`);
  await page.type('#fl-ph', '6000000001'); await sleep(100);
  await clickText(page, 'dialog[open] button', /^Give access$/);
  // wait for the save to finish (the sheet closes), not a fixed time: the first save on a page can take a second or two
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 10000 }).catch(() => {}); await sleep(300);
  const pill = await page.evaluate((n) => [...document.querySelectorAll('.fac-row')].find((r) => r.querySelector('.lt').textContent.trim() === n)?.querySelector('.pill')?.textContent.trim() || '', free);
  ok(/^In the app · SPS$/.test(pill), `${W} ${free}: linked to the devotee's own account (${pill})`);
  await page.evaluate(async () => { const { logout } = await import('/src/lib/session.svelte.js'); await logout(); }); await sleep(800);
  await go(page, '#/login', 0, '#login');
  await login(page, '6000000001', 'pass-12345');
  const landed = await page.waitForSelector('.qc', { timeout: 15000 }).then(() => '').catch(async () => page.evaluate(() => location.hash + ' | ' + (document.querySelector('main')?.textContent || '').replace(/\s+/g, ' ').slice(0, 160)));
  ok(!landed, `${W} the devotee signs in to their own Home${landed ? ' (landed: ' + landed + ')' : ''}`);
  await page.click('.menu-btn'); await sleep(450);
  // in the bottom bar or the menu (the menu leaves out what the bar shows)
  const menu = await page.evaluate(() => [...document.querySelectorAll('dialog.drawer a.mi, nav.nav a')].filter((a) => a.getClientRects().length).map((a) => a.getAttribute('href') + ' ' + a.textContent.trim()));
  ok(menu.some((x) => x.startsWith('#/my-devotees')), `${W} that devotee now has My students (${menu.find((x) => x.startsWith('#/my-devotees')) || 'missing: ' + menu.join(', ')})`);
  await page.keyboard.press('Escape'); await sleep(300);
  await go(page, '#/my-devotees', 1200, '.page-head');
  ok(!(await page.evaluate(() => [...document.querySelectorAll('a.mrow-main')].some((a) => a.getAttribute('href').includes('6000000001')))), `${W} …and never sees themself among their students`);
  await page.close();

  // 4. a facilitator with no batch shows TRD; any past week; each day of a submitted week in one line
  page = await fresh(390);
  await login(page, 'natvar', 'natvar-pass-1');
  await sleep(1200);
  await page.click('.menu-btn'); await sleep(450);
  ok(/TRD/.test(await text(page, 'dialog.drawer') || ''), `${W} a facilitator with no batch shows as TRD`);
  await page.keyboard.press('Escape'); await sleep(300);
  await go(page, '#/my-devotees', 1200, 'a.mrow-main');
  await page.click('a.mrow-main'); await sleep(1200);
  ok(!!(await page.$('#fd-any-m')) && !!(await page.$('#fd-any-w')), `${W} a student's page: pick any past week (month and week)`);
  const sub = await page.evaluate(() => [...document.querySelectorAll('a.lrow')].find((a) => /%/.test(a.textContent) && /\/\d{4}-\d{2}-\d{2}$/.test(a.getAttribute('href')))?.getAttribute('href'));
  if (sub) {
    await page.evaluate((h) => { location.hash = h; }, sub); await sleep(1200);
    const sm = await page.evaluate(() => [...document.querySelectorAll('.wr-dname small')].map((x) => x.textContent));
    ok(sm.length > 0 && sm.every((x) => /Slept|Woke|rounds/.test(x)), `${W} a submitted week: each day in one line ("${(sm[0] || '').slice(0, 60)}…")`);
    await page.screenshot({ path: `${OUT}/oct7-fac-week-390.png`, fullPage: true });
  } else ok(false, `${W} a submitted week to open`);
  await page.close();

  // 5. admin: Activity chips on one line and sentences, a new batch
  page = await fresh(360);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/activity', 1200, '.chiprow');
  const act = await page.evaluate(() => ({ tops: new Set([...document.querySelectorAll('.chiprow.one-line .chipbtn')].map((b) => Math.round(b.getBoundingClientRect().top))).size,
    raw: [...document.querySelectorAll('ul[aria-label=Activity] li .font-medium')].map((x) => x.textContent).filter((t) => /\b[a-z]+\.[a-z][A-Za-z]+\b/.test(t)) }));
  ok(act.tops === 1 && !act.raw.length && !(await hScroll(page)), `${W} admin › Activity: filters on one line, every entry a sentence${act.raw.length ? ' (raw: ' + act.raw[0] + ')' : ''}`);
  await page.screenshot({ path: `${OUT}/oct7-activity-360.png` });
  await go(page, '#/batches', 1200, '.page-head');
  await clickText(page, 'button', /Add batch/); await sleep(500);
  await page.type('#bn-new', 'SPS Group 3'); await page.type('#bi-new', 'sps3');
  await clickText(page, 'dialog[open] .seg button', /^SPS$/);
  await page.screenshot({ path: `${OUT}/oct7-add-batch-360.png` });
  await clickText(page, 'dialog[open] button[type=submit]', /Add batch/); await sleep(900);
  ok(/SPS Group 3/.test(await text(page, 'main') || ''), `${W} admin › Batches: a new batch (SPS Group 3 · SPS3) is added`);
  await page.close();

  // 6. press feedback: one shared rule, never hover-only
  page = await fresh(390); await page.goto(BASE + '/#/welcome'); await sleep(1500);
  const press = await page.evaluate(() => [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } }).flatMap(function flat(r) { return r.cssRules?.length && !r.selectorText ? [...r.cssRules].flatMap(flat) : [r]; })
    .some((r) => /:active/.test(r.selectorText || '') && /chipbtn/.test(r.selectorText || '') && /scale/.test(r.cssText)));
  ok(press, `${W} chips, tabs, rows and toggles sink a little when pressed (one shared :active rule)`);
  await page.close();
}
if (!only || only === 'oct7') await part('oct7', async () => { await phase10(); });

// ---------------- 8 Oct 2026 (Phase 0): the wall's moderation, compact Hearing / Reading ----------------
async function phase0() {
  const W = '[8 Oct]';
  // one page (the mock keeps its data while the page lives): Meera comments; Sunil reports it and hides her comments;
  // the IYF head sees the report (not who sent it) and removes the comment
  const page = await fresh(390);
  const switchTo = async (l, p) => {
    await page.evaluate(async () => { try { await (await import('/src/lib/session.svelte.js')).logout(); } catch { /* signed out already */ } });
    await page.waitForFunction(() => location.hash === '#/welcome', { timeout: 5000 }).catch(() => {});
    await go(page, '#/login', 500, '#login'); await typeLogin(page, l, p);
    await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 8000 }).catch(() => {}); await sleep(600);
  };
  await login(page, 'meera', 'meera-pass-1');
  const post = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const p = (await call('announcements.list')).announcements.find((a) => a.audience === 'ALL' || !a.audience) || (await call('announcements.list')).announcements[0]; await call('announcements.comment', { id: p.id, body: 'Rude words here' }); return p.id; });
  await switchTo('6000000001', 'pass-12345');
  await go(page, '#/wall', 1200, '.post');
  await page.$eval(`#post-${post} .post-bar button[aria-expanded]`, (b) => b.click()); await sleep(800);
  const more = await page.$(`#post-${post} .cmt button[aria-label^="Options for"]`);
  ok(!!more, `${W} someone else's comment has an options button`);
  if (more) {
    await more.click(); await sleep(200);
    await clickText(page, '.cmt-menu button', /^Report$/); await sleep(300);
    ok(await page.$eval('dialog[aria-labelledby=rep-h]', (d) => d.open), `${W} Report opens a sheet`);
    await clickText(page, 'dialog[open] button', /^Send report$/); await sleep(200);
    ok(/Choose a reason/.test(await text(page, 'dialog[open]') || ''), `${W} a reason is required`);
    await page.click('dialog[open] input[value=abusive]'); await clickText(page, 'dialog[open] button', /^Send report$/); await sleep(700);
    ok(!(await page.$('dialog[aria-labelledby=rep-h][open]')) && /Thank you/.test(await page.evaluate(() => document.body.innerText)), `${W} report sent, thanked`);
    await page.click(`#post-${post} .cmt button[aria-label^="Options for"]`); await sleep(200);
    await clickText(page, '.cmt-menu button', /^Hide .*'s comments$/); await sleep(900);
    ok(!/Rude words here/.test(await text(page, `#post-${post} .post-comments`) || '') && /Hidden comments/.test(await text(page, '.hidden-people') || ''), `${W} hidden for me, listed under Hidden comments`);
    await shot(page, 'oct8-wall-hidden-390');
    await clickText(page, '.hidden-people button', /^Show again$/); await sleep(900);
    ok(!(await page.$('.hidden-people')), `${W} Show again`);
  }
  await switchTo('master', 'master-pass-1');
  await go(page, '#/wall', 1500, '.post');
  await page.waitForFunction(() => /Reports to review/.test(document.querySelector('.reports')?.textContent || ''), { timeout: 10000 }).catch(() => {});   // the review queue arrives just after the posts
  ok(/Reports to review \(1\)/.test(await text(page, '.reports') || ''), `${W} the head sees the report (${await text(page, '.reports h3')})`);
  ok(!/6000000001|Sunil/.test(await text(page, '.reports') || ''), `${W} …without who reported it`);
  await shot(page, 'oct8-reports-390');
  await clickText(page, '.reports button', /^Remove comment$/); await sleep(1200);
  ok(!(await page.$('.reports')), `${W} removed: the queue is empty`);
  await page.close();
}
// one hearing topic a day, from the whole journal or typed (the head, 8 Oct 2026)
async function oneTopic() {
  const W = '[8 Oct topic]';
  const page = await fresh(390);
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/week', 1500);
  const day = await page.$eval('a[href*="/day/"]', (a) => a.getAttribute('href'));
  await go(page, day, 1500, '.actionbar');
  await page.click('#f-hearing .pickrow'); await page.waitForSelector('dialog[open] .wkstrip'); await sleep(300);
  ok(/^Lesson week \d+ of 81$/.test(await text(page, 'dialog[open] .wknow [aria-live]') || ''), `${W} the day form's list is the whole journal (${await text(page, 'dialog[open] .wknow [aria-live]')})`);
  const pick = async (n) => { await page.evaluate((n) => [...document.querySelectorAll('dialog[open] li.action button')].filter((b) => /^Choose/.test(b.textContent.trim()))[n].click(), n); await sleep(400); };
  await pick(0);
  ok(!(await page.$('dialog.pick-sheet[open]')), `${W} choosing a lecture closes the list`);
  const first = await text(page, '#f-hearing .pick-v');
  await page.click('#f-hearing .pickrow'); await sleep(500);
  await pick(1);
  const second = await text(page, '#f-hearing .pick-v');
  ok(second && second !== first && !/more$/.test(second), `${W} a second choice replaces the first: one topic a day ("${first}" → "${second}")`);
  await page.click('#f-hearing .pickrow'); await sleep(500);
  await page.type('#hp-t', 'Sunday feast class'); await clickText(page, 'dialog[open] button', /^Use$/); await sleep(400);
  ok((await text(page, '#f-hearing .pick-v')) === 'Sunday feast class', `${W} or a topic of their own, typed`);
  await page.close();
}
// Phase 3 (8 Oct 2026): the sign-in screens
async function phase3() {
  const W = '[9 Oct sign-in]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await go(page, '#/login', 600, '#login');
    await page.waitForFunction(() => [...document.querySelectorAll('.auth-side img')].some((i) => i.complete && i.naturalWidth), { timeout: width >= 1024 ? 8000 : 1500 }).catch(() => {});
    const side = await page.evaluate(() => { const s = document.querySelector('.auth-side'); return { shown: !!s && getComputedStyle(s).display !== 'none', img: !!s?.querySelector('img')?.naturalWidth }; });
    ok(width >= 1024 ? side.shown && side.img : !side.shown && !side.img, `[${width}] ${W} sign-in: ${width >= 1024 ? "today's darshan beside the form" : 'no image on a phone (nothing downloaded)'}`);
    // Phase 9 (the head, 9 Oct 2026): the desktop panel carries the verse of the day (as on Welcome), not a byline
    if (width >= 1024) { await page.waitForSelector('.auth-side blockquote', { timeout: 6000 }).catch(() => {}); const v = await text(page, '.auth-side figcaption.dp-text'); ok(/“.+”/.test(v || '') && /(Bhagavad|Bhāgavatam|Caitanya|Nectar|Teachings|Śrī|Sri)/.test(v || '') && !/steady and simple/.test(v || ''), `[${width}] ${W} sign-in panel: the verse of the day with its reference (${(v || '').slice(0, 40)}…)`); }
    ok(/^New accounts require coordinator approval\.$/.test(await text(page, '.auth-approve') || ''), `[${width}] ${W} under Create an account: the approval line`);
    ok(/^Your details stay private\. · Privacy$/.test((await text(page, '.auth-trust') || '').trim()) && !!(await page.$('.auth-trust a[href="/privacy.html"]')), `[${width}] ${W} the trust line with the privacy link`);
    await go(page, '#/forgot', 600, '#fp-login');
    /* Decision 46 (14 Oct 2026) changed what this note SAYS — the person no longer chooses the password, so
       "keep using your old one until it is approved" is gone. What must still hold is the same two things:
       the explanation comes BEFORE the field, and it says where the password now comes from. */
    const fpNote = await text(page, '.fp-note') || '';
    const fpBefore = await page.evaluate(() => document.querySelector('.fp-note').compareDocumentPosition(document.getElementById('fp-login')) & 4);
    ok(/temporary password/i.test(fpNote) && /coordinator/i.test(fpNote) && !!fpBefore,
       `[${width}] ${W} Forgot explains what happens before the fields (one short note: ${JSON.stringify(fpNote.slice(0, 60))})`);
    await page.close();
  }
  // a sign-up the coordinator did not approve: a calm page with the reason and a way forward, never a red error
  const page = await fresh(390);
  await page.evaluate(async () => (await import('/src/lib/mock.js'))._patchUser('6000000087', { status: 'REJECTED', rejectReason: 'Please use your own number' }));
  await typeLogin(page, '6000000087', 'pass-12345'); await sleep(900);
  ok(/Sign-up not approved/.test(await text(page, 'main') || '') && /Please use your own number/.test(await text(page, '[role=status]') || '') && !(await page.$('[role=alert]')) && !!(await page.$('a[href="#/signup"]')), `${W} a rejected sign-up: the reason and "Send a new sign-up", no error`);
  await page.close();
}
// Phase 4 (9 Oct 2026): the first-run guide — three skippable cards at the top of Home until the first day is filled
async function firstRun() {
  const W = '[9 Oct first-run]';
  for (const width of [320, 390, 1280]) {
    const page = await fresh(width);
    await login(page, '6000000001', 'pass-12345');
    const shown = await page.waitForSelector('.fr', { timeout: 8000 }).then(() => true).catch(() => false);
    const first = await page.evaluate(() => { const f = document.querySelector('.fr'), h = document.querySelector('.hero-card'); return { pos: !!f && !!h && !!(f.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING), t: f?.querySelector('h2')?.textContent, step: f?.querySelector('.t-over')?.textContent, dialog: !!f?.closest('dialog,[role=dialog]') }; });
    ok(shown && first.pos && !first.dialog && first.t === 'Fill each day' && /1 of 3/.test(first.step || ''), `[${width}] ${W} nothing filled yet: the guide sits above the week, inline (not a dialog), card 1 of 3`);
    if (width === 390) await page.screenshot({ path: `${OUT}/phase4-firstrun-390.png` });
    await page.click('.fr .btn-primary'); await sleep(150);
    ok(/2 of 3/.test(await text(page, '.fr .t-over') || '') && (await text(page, '.fr h2')) === 'Submit your week' && !!(await page.$('.fr .fr-foot .btn-text')), `[${width}] ${W} Next: card 2, with Back`);
    await page.click('.fr .btn-primary'); await sleep(150);
    ok((await text(page, '.fr .btn-primary')) === 'Start' && (await text(page, '.fr h2')) === 'See your progress', `[${width}] ${W} the last card ends with Start`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `[${width}] ${W} the page doesn't scroll sideways`);
    await page.click('.fr .fr-top .btn-text'); await sleep(200);
    ok(!(await page.$('.fr')), `[${width}] ${W} Skip hides it`);
    await go(page, '#/week', 0, '#f-days'); await go(page, '#/home', 0, '.hero-card'); await sleep(300);
    ok(!(await page.$('.fr')) && (await page.evaluate(() => localStorage.getItem('sr.firstRun'))) === '1', `[${width}] ${W} skipped: it stays away on this phone`);
    await page.browserContext().close();
  }
}
if (!only || only === 'oct10') await part('oct10', async () => { await firstRun(); });
// Phase 8 (9 Oct 2026): axe-core (WCAG 2.2 A / AA) on every main screen of every role, phone and desktop, light and dark
const AXE = new URL('../../frontend/node_modules/axe-core/axe.min.js', import.meta.url).pathname;
async function axeSweep() {
  const PERSONAS = [
    ['devotee', '6000000001', 'pass-12345', ['#/home', '#/week', fillableDay(), '#/report', '#/hearing', '#/reading', '#/group', '#/wall', '#/account']],
    ['coordinator', 'sps', 'sps-pass-12', ['#/home', '#/batch', '#/members', '#/leaders', '#/stats', '#/requests', '#/devotee/6000000014', '#/devotee/6000000014/week/2026-10-05']],
    ['head', 'master', 'master-pass-1', ['#/home', '#/overview', '#/members', '#/coordinators', '#/batches', '#/ids', '#/activity', '#/settings', '#/requests?type=reopen']],
    ['facilitator', 'natvar', 'natvar-pass-1', ['#/my-devotees', '#/my-devotees/6000000011', '#/my-devotees/6000000011/2026-09-28']],
  ];
  const found = new Map();
  for (const [width, theme] of [[390, 'light'], [390, 'dark'], [1280, 'light']]) {
    // signed out
    let page = await fresh(width);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    const scan = async (where) => {
      await sleep(900);
      if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], resultTypes: ['violations'] })).violations
        .map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.slice(0, 3).map((n) => n.target.join(' ')) })));
      for (const x of v) { const k = x.id + ' @ ' + where; if (!found.has(k)) found.set(k, x.nodes.join(' | ')); }
    };
    for (const h of ['#/welcome', '#/login', '#/signup', '#/forgot']) { await go(page, h, 600); await scan(`${width} ${theme} ${h}`); }
    await page.close();
    for (const [who, l, p, routes] of PERSONAS) {
      page = await fresh(width);
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await login(page, l, p);
      for (const h of routes) { await go(page, h, 900); await scan(`${width} ${theme} ${who} ${h}`); }
      await page.close();
    }
  }
  for (const [k, n] of found) console.log('AXE', k, '→', n);
  ok(found.size === 0, `[a11y] axe: no WCAG 2.2 A/AA violations on the main screens of every role (phone light/dark, desktop) — ${found.size} found`);
}
// Phase 8: the app's own text size (Largest, 125 %) on the smallest phone: nothing scrolls sideways
async function textSizeCheck() {
  const bad = [];
  for (const [l, p, routes] of [['6000000001', 'pass-12345', ['#/home', '#/week', fillableDay(), '#/report', '#/hearing', '#/account']], ['sps', 'sps-pass-12', ['#/home', '#/batch', '#/requests', '#/devotee/6000000014']]]) {
    const page = await fresh(320);
    await page.evaluate(() => { localStorage.setItem('sr.textSize', 'xl'); document.documentElement.style.fontSize = '125%'; });
    await login(page, l, p);
    for (const h of routes) { await go(page, h, 1000); if (await hScroll(page)) bad.push(l + ' ' + h); }
    if (l === '6000000001') {
      await page.click('.menu-btn'); await sleep(400);
      const row = await text(page, 'dialog.drawer [id$="-text"]');
      ok(/Text size\s*Largest/.test(row || ''), `[a11y] the menu shows the text size (${row})`);
      await page.keyboard.press('Escape');
    }
    await page.close();
  }
  ok(!bad.length, `[a11y] text size Largest at 320 px: no sideways scroll${bad.length ? ' — ' + bad.join(', ') : ''}`);
}
if (only === 'a11y') { await axeSweep(); await textSizeCheck(); }

// Phase 7 (9 Oct 2026): motion and interaction
async function phase7b() {
  const W = '[9 Oct motion]';
  // phone: direction of travel, motion.css, the bar stepping aside on scroll, a swipe between days, counts that settle
  let page = await fresh(390);
  await page.setViewport({ width: 390, height: 800, hasTouch: true, isMobile: true });
  await login(page, '6000000001', 'pass-12345');
  await page.waitForFunction(() => !!document.querySelector('link[href="/motion.css"]'), { timeout: 8000 }).catch(() => {});
  ok(!!(await page.$('link[href="/motion.css"]')), `${W} the motion styles load after the app opens`);
  await go(page, '#/week', 900, '#f-days');
  const fwd = await page.evaluate(() => document.documentElement.dataset.nav);
  await page.evaluate(() => history.back()); await sleep(700);
  const back = await page.evaluate(() => document.documentElement.dataset.nav);
  ok(fwd === 'fwd' && back === 'back', `${W} pages know the direction of travel (${fwd}, then ${back})`);
  await go(page, '#/home', 900, '.hero-card');
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  for (const y of [200, 400, 600]) { await page.evaluate((v) => window.scrollTo(0, v), y); await sleep(120); }
  const hidden = await page.$eval('nav.nav', (n) => n.classList.contains('nav-away'));
  await page.evaluate(() => window.scrollTo(0, 300)); await sleep(150);
  const shown = await page.$eval('nav.nav', (n) => !n.classList.contains('nav-away'));
  ok(hidden && shown, `${W} the bottom bar steps aside scrolling down and comes back scrolling up`);
  await go(page, fillableDay(), 900, '.dform');
  const box = await (await page.$('.dform')).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + 40;
  await page.touchscreen.touchStart(cx + 120, cy); for (let i = 1; i <= 6; i++) await page.touchscreen.touchMove(cx + 120 - i * 40, cy); await page.touchscreen.touchEnd(); await sleep(900);
  // the day after the one we opened, derived like the day itself — not a date written down last week
  const nextDay = new Date(Date.parse(thisWeekId() + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  // on a Monday the next day has not happened yet, and a future day never opens: the swipe stays put (it failed
  // every Monday, 19 Oct 2026). Any other day it moves on.
  const todayIst = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const want = nextDay > todayIst ? `#/day/${thisWeekId()}/${thisWeekId()}` : `#/day/${thisWeekId()}/${nextDay}`;
  ok((await page.evaluate(() => location.hash)) === want, `${W} a swipe to the left on the day goes to the next day, never into the future (${await page.evaluate(() => location.hash)})`);
  await page.close();
  // computer: j / k through a list, Ctrl+S saves the day, [ steps a week back, counts end on the real numbers
  page = await fresh(1280);
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/batch', 1200, 'li.brow');
  await sleep(1500);   // the keys load when the app is idle
  await page.keyboard.press('j'); await sleep(100); const r1 = await page.evaluate(() => [...document.querySelectorAll('li.brow')].findIndex((r) => r.contains(document.activeElement)));
  await page.keyboard.press('j'); await sleep(100); const r2 = await page.evaluate(() => [...document.querySelectorAll('li.brow')].findIndex((r) => r.contains(document.activeElement)));
  await page.keyboard.press('k'); await sleep(100); const r3 = await page.evaluate(() => [...document.querySelectorAll('li.brow')].findIndex((r) => r.contains(document.activeElement)));
  ok(r1 >= 0 && r2 === r1 + 1 && r3 === r1, `${W} j / k move through the board's rows (${r1}, ${r2}, ${r3})`);
  await sleep(500);
  const strip = await page.$$eval('.scope .sc-cell b', (l) => l.map((b) => b.textContent.trim()));
  ok(strip.length === 5 && strip.every((t) => /^\d+$/.test(t)), `${W} the counts settle on whole numbers, All included (${strip.join(' · ')})`);
  await go(page, '#/devotee/6000000014/week/2026-10-05', 1200, '.wr-step');
  const wk0 = await page.evaluate(() => location.hash);
  await page.keyboard.press('['); await sleep(800);
  ok((await page.evaluate(() => location.hash)) === '#/devotee/6000000014/week/2026-09-28', `${W} [ steps to the week before (${wk0} → ${await page.evaluate(() => location.hash)})`);
  await page.close();
  page = await fresh(1280);
  await login(page, '6000000001', 'pass-12345');
  await sleep(1500);
  await go(page, fillableDay(), 900, '.actionbar');
  await page.evaluate(() => document.querySelector('#f-rounds input').focus());
  await page.keyboard.type('12'); await sleep(200);
  await page.keyboard.down('Control'); await page.keyboard.press('s'); await page.keyboard.up('Control');
  await page.waitForFunction(() => /Saved ✓/.test(document.querySelector('.actionbar')?.textContent || ''), { timeout: 6000 }).catch(() => {});
  ok(/Saved ✓/.test(await text(page, '.actionbar') || ''), `${W} Ctrl+S saves the day, even while typing`);
  await page.close();
}
// the success sheet after a devotee submits their own week (today's darshan, the score, the way to the report)
async function submitSheet() {
  const W = '[9 Oct motion]';
  const page = await fresh(390);
  await login(page, '6000000001', 'pass-12345');
  await seedPractice(page, false);
  await page.evaluate(async () => { const m = await import('/src/lib/mock.js'), { call } = await import('/src/lib/api.js');
    await call('week.saveWeekEnd', { weekId: '2026-10-05', version: 0, nightStay: 'YES', principles: 'YES' }); await call('week.setAttendance', { weekId: '2026-10-05', mark: 'P' }); });
  await page.evaluate(async () => (await import('/src/lib/weekstore.js')).loadHome(true)); await sleep(500);   // the app's copy predates the seeding
  await go(page, '#/week/2026-10-05?f=submit', 1200, '#f-submit');
  await clickText(page, '#f-submit button', /^Submit/); await sleep(300);
  await clickText(page, '.confirm button', /^Yes, submit$/); await sleep(1200);
  const d = await page.evaluate(() => { const x = [...document.querySelectorAll('dialog[open]')].pop(); return x ? { t: x.querySelector('h2')?.textContent || '', score: /This week: \d+%/.test(x.textContent), report: !!x.querySelector('a[href="#/report"]') } : null; });
  ok(!!d && /Week submitted/.test(d.t) && d.score && d.report, `${W} submitting the week ends on a small "Week submitted ✓" sheet with the score and the report (${JSON.stringify(d)})`);
  await page.screenshot({ path: `${OUT}/phase7-submitted-390.png` });
  await page.close();
}
if (!only || only === 'p7') await part('p7', async () => { { await phase7b(); await submitSheet(); } });

// 9 Oct 2026: announcements to youth facilitators and to TRD facilitators (together, every facilitator)
async function facAudience() {
  const W = '[9 Oct facilitator audiences]';
  let page = await fresh(390);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/wall', 900, 'button');
  await clickText(page, 'button', /New announcement/); await sleep(400);
  const labels = await page.$$eval('.checkbox, label', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(labels.some((t) => /^Youth facilitators/.test(t)) && labels.some((t) => /^TRD facilitators/.test(t)), `${W} the head can choose youth or TRD facilitators`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Cancel$/.test(b.textContent.trim()))?.click());
  // post two (the mock keeps its data while the page stays open), then sign in as others on the same page
  await page.evaluate(async () => { const { call } = await import('/src/lib/api.js');
    await call('announcements.create', { title: 'TRD only', body: 'x', audience: ['FAC_TRD'] });
    await call('announcements.create', { title: 'Youth only', body: 'x', audience: ['FAC_YOUTH'] }); });
  // read as other people straight through the mock (signing out reloads the page and would clear the mock's posts)
  const as = (l, p) => page.evaluate(async (l, p) => { const { handle } = await import('/src/lib/mock.js');
    const tok = (await handle({ v: 1, action: 'auth.login', app: 'check', data: { login: l, password: p } })).data.token;
    return (await handle({ v: 1, action: 'announcements.list', app: 'check', token: tok, data: {} })).data.announcements.map((a) => a.title).filter((t) => / only$/.test(t)); }, l, p);
  const seen = { trd: await as('natvar', 'natvar-pass-1'), devotee: await as('6000000001', 'pass-12345') };
  ok(seen.trd.join() === 'TRD only' && !seen.devotee.length, `${W} a TRD-only post: the TRD facilitator sees it, a devotee doesn't (${JSON.stringify(seen)})`);
  await page.close();
}
if (!only || only === 'oct10') await part('oct10', async () => { await facAudience(); });

// Phase 9, items 8 and 23 (the head, 9 Oct 2026): a facilitator posts to their students; the head schedules a post,
// which waits (author and head only, no badge) until its start or "Post now"
async function posts9() {
  const W = '[posts9]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    const out = async () => { await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(500); await go(page, '#/login', 0, '#login');
      await page.$eval('#login', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); };
    const titles = () => page.$$eval('.feed .post-t', (x) => x.map((e) => e.textContent.trim()));
    const wall = () => go(page, '#/wall', 0, '.feed');
    await login(page, 'natvar', 'natvar-pass-1'); await wall();
    ok(await clickText(page, 'button', /^Post to my students$/), `[${width}] ${W} a TRD facilitator has "Post to my students"`);
    ok(/To your students/.test(await text(page, '.an-to') || '') && !(await page.$('#an-who')) && !(await page.evaluate(() => /Who sees it/.test(document.querySelector('form')?.textContent || ''))), `[${width}] ${W} the audience is fixed: their students (no batch choice)`);
    await page.type('#an-title', 'Japa retreat on Sunday'); await page.type('#an-body', 'Bring your beads. 6 AM at the temple.');
    if (width === 390) await page.screenshot({ path: `${OUT}/p9b-fac-form-390.png`, fullPage: true });
    await clickText(page, 'form button[type=submit]', /^Post$/); await page.waitForFunction(() => [...document.querySelectorAll('.feed .post-t')].some((e) => /Japa retreat/.test(e.textContent)), { timeout: 6000 }).catch(() => {});
    ok((await titles()).includes('Japa retreat on Sunday'), `[${width}] ${W} posted, on their own wall`);
    ok(/Your students/.test(await page.evaluate(() => [...document.querySelectorAll('.post')].find((p) => /Japa retreat/.test(p.textContent))?.querySelector('.post-meta')?.textContent || '')), `[${width}] ${W} marked "Your students" for its author`);
    await out(); await login(page, '6000000001', 'pass-12345'); await wall();
    ok((await titles()).includes('Japa retreat on Sunday'), `[${width}] ${W} their student sees it`);
    // the head schedules a post to everyone for tomorrow, 6 pm
    await out(); await login(page, 'master', 'master-pass-1'); await wall();
    await clickText(page, 'button', /^New announcement$/);
    await page.type('#an-title', 'Kartik deepotsav'); await page.type('#an-body', 'Lamps at 7 PM, all welcome.');
    await page.evaluate(() => [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('Everyone'))?.click());
    await clickText(page, 'button', /^Later$/);
    const tomorrow = new Date(Date.now() + 5.5 * 3600e3 + 864e5).toISOString().slice(0, 10);
    await page.$eval('#an-from-d', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, tomorrow);
    ok(!!(await page.$('#an-from-t')) && !!(await page.$('#an-len')), `[${width}] ${W} "Show from" later has a day and a time, and "Show for" a length`);
    if (width === 390) await page.screenshot({ path: `${OUT}/p9b-head-schedule-390.png`, fullPage: true });
    await clickText(page, 'form button[type=submit]', /^Schedule$/);
    await page.waitForSelector('.sched .sc-row', { timeout: 6000 }).catch(() => {});
    ok(/Kartik deepotsav.*Appears .*6:00 pm.*Everyone/.test(await text(page, '.sched') || ''), `[${width}] ${W} under Scheduled, with when it appears and who sees it`);
    ok(!(await titles()).includes('Kartik deepotsav'), `[${width}] ${W} not in the feed yet`);
    if (width === 390) await page.screenshot({ path: `${OUT}/p9b-head-scheduled-390.png`, fullPage: true });
    await out(); await login(page, '6000000001', 'pass-12345'); await wall();
    ok(!(await titles()).includes('Kartik deepotsav'), `[${width}] ${W} a devotee does not see it before its start`);
    await out(); await login(page, 'master', 'master-pass-1'); await wall();
    await page.waitForSelector('.sched .sc-row', { timeout: 6000 }).catch(() => {});
    await clickText(page, '.sched button', /^Post now$/);
    await page.waitForFunction(() => !document.querySelector('.sched'), { timeout: 6000 }).catch(() => {});
    ok(!(await page.$('.sched')) && (await titles()).includes('Kartik deepotsav'), `[${width}] ${W} Post now: on the wall at once`);
    ok(/^Notifications reached \d+ of \d+ phones/.test(await page.evaluate(() => [...document.querySelectorAll('.post')].find((p) => /Kartik deepotsav/.test(p.textContent))?.querySelector('.post-reach')?.textContent.trim() || '')), `[${width}] ${W} its author sees how far the notification reached (item 18)`);
    await out(); await login(page, '6000000001', 'pass-12345'); await wall();
    ok((await titles()).includes('Kartik deepotsav'), `[${width}] ${W} and the devotee sees it`);
    ok(!(await page.$('.post-reach')), `[${width}] ${W} a devotee is not shown the reach`);
    await page.close();
  }
}
if (!only || only === 'posts9') await part('posts9', async () => { await posts9(); });
// Phase 9, item 11: the head's Settings has "Keep logs for", 3 · 6 · 12 · 24 months
async function logs9() {
  const W = '[logs9]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/settings', 0, '.st-list');
    ok(/Keep logs for · 6 months/.test(await text(page, '.st-list') || ''), `[${width}] ${W} Settings shows "Keep logs for · 6 months"`);
    await clickText(page, '.st-list button', /^Keep logs for/);
    await page.waitForSelector('dialog[open] #st-logs', { timeout: 5000 }).catch(() => {});
    if (width === 390) await page.screenshot({ path: `${OUT}/p9b-settings-logs-390.png` });
    await clickText(page, 'dialog[open] button', /^12 months$/);
    await clickText(page, 'dialog[open] button', /^Save$/);
    await page.waitForFunction(() => /Keep logs for · 12 months/.test(document.querySelector('.st-list')?.textContent || ''), { timeout: 5000 }).catch(() => {});
    ok(/Keep logs for · 12 months/.test(await text(page, '.st-list') || ''), `[${width}] ${W} changed to 12 months`);
    await page.close();
  }
}
if (!only || only === 'logs9') await part('logs9', async () => { await logs9(); });
// Phase 9, items 24 and 14: a new IYF head waits for every other head; the head creates a new IYF ID while approving
async function heads9() {
  const W = '[heads9]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    const out = async () => { await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(500); await go(page, '#/login', 0, '#login');
      await page.$eval('#login', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); };
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/coordinators', 0, '.page-head');
    await clickText(page, 'button', /^Add staff$/);
    await page.waitForSelector('dialog[open] #co-role', { timeout: 5000 }).catch(() => {});
    await clickText(page, 'dialog[open] #co-role button', /^IYF head$/);
    ok(!!(await page.$('dialog[open] #co-why')) && !(await page.evaluate(() => /Batches/.test(document.querySelector('dialog[open]')?.textContent || ''))), `[${width}] ${W} Add staff › IYF head: a reason, no batches`);
    await page.type('#co-u', 'madhava'); await page.type('#co-n', 'Madhava Das'); await page.type('#co-p', 'Temp-head-2026'); await page.type('#co-why', 'Coming from Chennai to lead');
    if (width === 390) await page.screenshot({ path: `${OUT}/p9b-add-head-390.png` });
    await clickText(page, 'dialog[open] button', /^Ask for approval$/);
    await page.waitForSelector('.hr-box', { timeout: 6000 }).catch(() => {});
    ok(/Madhava Das/.test(await text(page, '.hr-box') || '') && /Waiting: Govinda Das/.test(await text(page, '.hr-box') || ''), `[${width}] ${W} it waits for the other head (Govinda Das)`);
    if (width === 1280) await page.screenshot({ path: `${OUT}/p9b-head-waiting-1280.png` });
    await out(); await login(page, 'guru', 'guru-pass-12');
    await go(page, '#/home', 0, 'main');
    await page.waitForFunction(() => /new IYF head to approve/.test(document.querySelector('main')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    ok(/1 new IYF head to approve/.test(await text(page, 'main') || ''), `[${width}] ${W} the other head sees it on Home`);
    await go(page, '#/coordinators', 0, '.hr-box');
    await clickText(page, '.hr-box button', /^Approve$/);
    await page.waitForFunction(() => !document.querySelector('.hr-box'), { timeout: 6000 }).catch(() => {});
    ok(!(await page.$('.hr-box')), `[${width}] ${W} approved by every head: no longer waiting`);
    // the head approves a sign-up with a new IYF ID (the app's own series)
    await out(); await login(page, 'master', 'master-pass-1');
    await go(page, '#/requests', 0, 'main');
    await sleep(800);
    // (on a phone the requests are a list: open the first sign-up)
    if (!(await page.$('input[type=radio][value=new]'))) await page.evaluate(() => [...document.querySelectorAll('button, a')].find((e) => /Rahul Sharma/.test(e.textContent) && /Sign-up/.test(e.textContent))?.click());
    await page.waitForFunction(() => [...document.querySelectorAll('input[type=radio][value=new]')].length > 0, { timeout: 8000 }).catch(() => {});
    const hasNew = await page.evaluate(() => { const r = document.querySelector('input[type=radio][value=new]'); if (r) r.click(); return !!r; });
    ok(hasNew, `[${width}] ${W} the head has "Create a new IYF ID" when approving`);
    // IYFD-<year they connected>-NNNN (18 Oct 2026; the SR series is retired). Rahul's sign-up has no year, so the
    // head picks it on the card, and the preview follows the pick
    await page.waitForSelector('#yr-6000000087', { timeout: 6000 }).catch(() => {});
    ok(!!(await page.$('#yr-6000000087')), `[${width}] ${W} no year on the sign-up: the card asks for Connected since`);
    await clickText(page, 'button', /^Approve$/);
    await page.waitForFunction(() => /Choose the year/.test(document.querySelector('main')?.textContent || ''), { timeout: 4000 }).catch(() => {});
    ok(/Choose the year/.test(await text(page, 'main') || '') && !(await page.$('.toast')), `[${width}] ${W} Approve without the year is held, not approved with no ID`);
    await sel(page, '#yr-6000000087', '2019');
    const label = () => page.evaluate(() => document.querySelector('input[type=radio][value=new]')?.closest('label')?.textContent || '');
    await page.waitForFunction(() => /They get IYFD-2019-\d{4}/.test(document.querySelector('input[type=radio][value=new]')?.closest('label')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    ok(/They get IYFD-2019-\d{4}/.test(await label()), `[${width}] ${W} it shows the ID they will get`);
    if (width === 390) await page.screenshot({ path: `${OUT}/p18-approve-year-390.png` });
    await clickText(page, 'button', /^Approve$/);
    await page.waitForFunction(() => /new IYF ID IYFD-2019-\d{4}/.test(document.querySelector('.toast')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    ok(/Approved with the new IYF ID IYFD-2019-\d{4}/.test(await text(page, '.toast') || ''), `[${width}] ${W} approved with the new ID`);
    await go(page, '#/ids', 0, 'main');
    await clickText(page, 'button', /^Created here$/);
    await page.waitForSelector('.card', { timeout: 6000 }).catch(() => {});
    ok(/IYFD-2019-\d{4}/.test(await text(page, 'main') || '') && /1 to add to the dashboard/.test(await text(page, 'main') || ''), `[${width}] ${W} listed under Created in the app, to add to the dashboard`);
    if (width === 390) await page.screenshot({ path: `${OUT}/p9b-ids-app-390.png`, fullPage: true });
    await page.close();
  }
}
if (!only || only === 'heads9') await part('heads9', async () => { await heads9(); });

// English and Hindi books (the head, 19 Oct 2026): "English section for English books, Hindi section for Hindi books ...
// map them according to the cantos, to the volumes". English stays exactly as it was; Hindi holds only the books with a
// Hindi PDF, under their Hindi title; a canto's chapters load only when opened, grouped by part.
async function booklang() {
  const W = '[booklang]';
  for (const width of [320, 390, 1280]) {
    const page = await fresh(width);
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/reading', 0, 'ul[aria-label=Books]');
    const listText = () => text(page, 'ul[aria-label=Books]');
    ok(/English/.test(await text(page, '#rd-lang [aria-pressed=true]') || ''), `[${width}] ${W} Reading opens on the English books`);
    ok(/Bhagavad Gita/.test(await listText() || '') && !/श्रीमद्/.test(await listText() || ''), `[${width}] ${W} English titles only`);
    await clickText(page, '#rd-lang button', /हिन्दी/);
    await page.waitForFunction(() => /श्रीमद्-भगवद्-गीता यथारूप/.test(document.querySelector('ul[aria-label=Books]')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    ok(/श्रीमद्-भगवद्-गीता यथारूप/.test(await listText() || '') && /Bhagavad Gita/.test(await listText() || ''), `[${width}] ${W} हिन्दी: the Hindi title, with the English one under it`);
    ok(!/Nectar of Devotion/.test(await listText() || ''), `[${width}] ${W} a book with no Hindi PDF is not in the Hindi section`);
    ok((await page.evaluate(() => location.hash)).includes('bl=hi'), `[${width}] ${W} the section is kept in the address`);
    await clickText(page, '.chipbtn', /^BSS\/BVS/);
    await page.waitForFunction(() => /स्कन्ध 10/.test(document.querySelector('ul[aria-label=Books]')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    const opened = await page.evaluate(() => { const d = [...document.querySelectorAll('ul[aria-label=Books] details.bk')].find((x) => /स्कन्ध 10/.test(x.textContent)); if (d) d.querySelector('summary').click(); return !!d; });
    ok(opened, `[${width}] ${W} the canto is a row that opens`);
    await sleep(200);
    const parts = await page.$$eval('ul[aria-label=Books] details.bk[open] .bk-vols > li > a', (l) => l.map((a) => [a.textContent.trim(), a.target, a.rel]));
    ok(parts.length === 2 && parts.every((x) => /^Part \d/.test(x[0]) && x[1] === '_blank' && x[2].includes('noreferrer')), `[${width}] ${W} its Hindi parts, each its own link (${parts.map((x) => x[0]).join(', ')})`);
    ok(!(await page.$('.bkc-list a')), `[${width}] ${W} chapters are not loaded until asked for`);
    await page.evaluate(() => document.querySelector('ul[aria-label=Books] details.bk[open] details.bkc summary')?.click());
    await page.waitForFunction(() => document.querySelectorAll('.bkc-list a').length > 0, { timeout: 6000 }).catch(() => {});
    const ch = await page.evaluate(() => ({ parts: [...document.querySelectorAll('.bkc-part')].map((x) => x.textContent.trim()),
      first: document.querySelector('.bkc-list a')?.textContent.trim(), n: document.querySelectorAll('.bkc-list a').length,
      blank: [...document.querySelectorAll('.bkc-list a')].every((a) => a.target === '_blank' && a.rel.includes('noreferrer')) }));
    ok(ch.n === 8 && ch.parts.join() === 'Part 1,Part 2' && /^Contents/.test(ch.first || '') && ch.blank, `[${width}] ${W} the chapters, by part, each opening in a new tab (${JSON.stringify(ch)})`);
    ok(!(await hScroll(page)), `[${width}] ${W} no sideways scroll with the chapters open`);
    if (width === 390) await shot(page, 'booklang-chapters-390');
    // the choice survives a reload (address, then this phone)
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('ul[aria-label=Books]', { timeout: 15000 }).catch(() => {});
    ok(/हिन्दी/.test(await text(page, '#rd-lang [aria-pressed=true]') || ''), `[${width}] ${W} a reload stays in the Hindi section`);
    await clickText(page, '#rd-lang button', /^English$/);
    await page.waitForFunction(() => !/श्रीमद्/.test(document.querySelector('ul[aria-label=Books]')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    ok(!/श्रीमद्/.test(await listText() || '') && !(await page.evaluate(() => location.hash)).includes('bl='), `[${width}] ${W} back to English: English titles, and the address forgets the section`);
    await page.browserContext().close();
  }
}
if (!only || only === 'booklang') await part('booklang', async () => { await booklang(); });

// Temple activities (phase 21, 23 Oct 2026; the head's "Update Sadhana" screenshot): a temple resident (TRD) also
// answers Mangal Aarti, Darshan Aarti, Morning Class and Prasadam each day — On Time / Late / Absent. Nobody else sees it.
async function temple() {
  const W = '[temple]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, '6000000092', 'trd-pass-12');
    const T = `[${width} TRD] ${W}`;
    await go(page, fillableDay(), 0, '#f-sleptAt-btn');
    await page.waitForSelector('#h-temple', { timeout: 8000 }).catch(() => {});
    const block = await page.evaluate(() => {
      const s = document.getElementById('h-temple')?.closest('section');
      return s && { h: document.getElementById('h-temple').textContent.trim(), rows: [...s.querySelectorAll('.field')].map((f) => [f.querySelector('.label')?.textContent.trim(), [...f.querySelectorAll('.seg button')].map((b) => b.textContent.trim())]) };
    });
    // Phase 22 K2: TRD is scored the COSATOK way, so the block is the Morning program (still the temple activities)
    ok(!!block && /^Morning program/.test(block.h), `${T} the day form has the Morning program block`);
    ok(JSON.stringify(block?.rows) === JSON.stringify([['Mangal Aarti', ['On Time', 'Late', 'Absent']], ['Darshan Aarti', ['On Time', 'Late', 'Absent']], ['Morning Class', ['On Time', 'Late', 'Absent']], ['Prasadam', ['On Time', 'Late', 'Absent']]]),
      `${T} Mangal Aarti, Darshan Aarti, Morning Class and Prasadam, each On Time / Late / Absent (${JSON.stringify(block?.rows)})`);
    if (width < 1024) ok(await page.evaluate(() => [...document.querySelectorAll('.jumpbar .jchip')].some((b) => /^Morning/.test(b.textContent.trim()))), `${T} the jump bar has "Morning"`);
    // answer two, save, and they come back after a reload
    const press = (id, label) => page.evaluate((i, l) => [...document.querySelectorAll(`#${i} .seg button`)].find((b) => b.textContent.trim() === l)?.click(), id, label);
    await press('f-mangalAarti', 'On Time'); await press('f-darshanAarti', 'Late');
    ok(await page.evaluate(() => document.querySelector('#f-mangalAarti button[aria-pressed=true]')?.textContent.trim() === 'On Time'), `${T} an answer shows as chosen`);
    await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].at(-1)?.click()); await saveSettles(page);
    await page.waitForFunction(() => !document.querySelector('.actionbar [aria-busy=true]'), { timeout: 8000 }).catch(() => {});
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#f-mangalAarti', { timeout: 15000 }).catch(() => {});
    const kept = await page.evaluate(() => ['f-mangalAarti', 'f-darshanAarti', 'f-morningClass'].map((i) => document.querySelector(`#${i} button[aria-pressed=true]`)?.textContent.trim() || ''));
    ok(kept.join() === 'On Time,Late,', `${T} the answers are saved and come back after a reload (${kept.join(' | ')})`);
    ok(!(await hScroll(page)), `${T} no sideways scroll`);
    if (width === 390) await shot(page, 'temple-day-390');
    await page.browserContext().close();
  }
  // a class devotee never sees it
  const page = await fresh(390);
  await login(page, '6000000001', 'pass-12345');
  await go(page, fillableDay(), 0, '#f-sleptAt-btn');
  await page.waitForSelector('#h-comment', { timeout: 8000 }).catch(() => {});
  ok(!(await page.$('#h-temple')) && !(await page.evaluate(() => [...document.querySelectorAll('.jumpbar .jchip')].some((b) => /^Temple/.test(b.textContent.trim())))), `[390 SPS] ${W} an SPS devotee's day has no temple block and no "Temple" chip`);
  await page.browserContext().close();
}
if (!only || only === 'temple') await part('temple', async () => { await temple(); });

// Vaishnava Songs (phase 21, 23 Oct 2026; the head: "a vaishnava songs sidebar tab for users"): the English book is read
// in the app with a search, and both books are offered as their PDFs. Phase 22 (26 Oct): C5 — only a login with its own
// sadhana form has it (a staff-only or head-only login does not); C1 — each book also downloads; C2 — browse by book;
// C4 — the songs transcribed from the official books (their texts in one file per book, fetched on open), the Devanagari
// Damodarastakam from the Hindi book; no proofreading marker (the head: live, no marker).
async function songs() {
  const W = '[songs]';
  for (const [width, l, p, who] of [[320, '6000000001', 'pass-12345', 'devotee'], [390, '6000000001', 'pass-12345', 'devotee'], [1280, '6000000001', 'pass-12345', 'devotee'], [1280, 'sps', 'sps-pass-12', 'coordinator'], [1280, 'master', 'master-pass-1', 'head']]) {
    const page = await fresh(width);
    await login(page, l, p);
    const T = `[${width} ${who}] ${W}`;
    const has = who === 'devotee';
    // the menu entry: the sidebar on a desktop, the drawer on a phone — only for a login with its own sadhana form
    if (width >= 1024) {
      const inSide = /Vaishnava Songs/.test(await page.evaluate(() => document.querySelector('nav, aside')?.closest('body')?.innerText || ''));
      ok(inSide === has, `${T} "Vaishnava Songs" ${has ? 'is' : 'is not'} in the sidebar`);
    } else {
      await page.evaluate(() => document.querySelector('button[aria-label="Open menu"]')?.click());
      await page.waitForSelector('dialog.drawer[open]', { timeout: 6000 }).catch(() => {});
      ok(!!(await page.evaluate(() => [...document.querySelectorAll('dialog.drawer[open] a')].find((a) => a.getAttribute('href') === '#/songs' && /Vaishnava Songs/.test(a.textContent)))), `${T} "Vaishnava Songs" is in the menu`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog.drawer[open]'), { timeout: 4000 }).catch(() => {});
    }
    if (!has) {
      // C5: typed into the address, the route does not open for a staff-only login
      await go(page, '#/songs/s035', 0, 'main');
      await page.waitForFunction(() => !!document.querySelector('main') && !document.querySelector('.sg-song'), { timeout: 6000 }).catch(() => {});
      ok(!(await page.$('.sg-song')) && !(await page.$('#sg-q')), `${T} the songs route does not open for this login`);
      await page.browserContext().close();
      continue;
    }
    await go(page, '#/songs', 0, '#sg-q');
    await page.waitForFunction(() => document.querySelectorAll('main ul.list li').length > 100, { timeout: 15000 }).catch(() => {});
    const rows = await page.$$eval('main ul.list li a.lrow', (a) => a.length);
    ok(rows >= 290, `${T} every song is listed by section (${rows})`);
    const books = await page.$$eval('.sg-books a.sg-open', (a) => a.map((x) => [x.getAttribute('href'), x.target, x.rel, x.textContent.replace(/\s+/g, ' ').trim()]));
    ok(books.length === 2 && books.every((b) => /\.pdf$/.test(b[0]) && b[1] === '_blank' && b[2].includes('noreferrer')) && /English/.test(books[0][3]) && /हिन्दी/.test(books[1][3]), `${T} both books as PDFs, opening in a new tab (${JSON.stringify(books.map((b) => b[3]))})`);
    // C1 (the head: "when I click on download it is not downloading"): a second link per book saves the file
    const saves = await page.$$eval('.sg-books a.sg-dl', (a) => a.map((x) => [x.getAttribute('href'), x.getAttribute('download'), x.getAttribute('aria-label')]));
    ok(saves.length === 2 && saves.every((x, i) => x[0] === books[i]?.[0] && /^Vaishnava-Songs-\w+\.pdf$/.test(x[1] || '') && /^Download the /.test(x[2] || '')), `${T} each book also downloads, under its own file name (${JSON.stringify(saves)})`);
    if (width === 390) {
      const served = await page.evaluate(async (urls) => Promise.all(urls.map((u) => fetch(u, { method: 'HEAD' }).then((r) => r.status + ' ' + r.headers.get('content-type')))), books.map((b) => b[0]));
      ok(served.every((s) => /^200 application\/pdf/.test(s)), `${T} both PDFs are served (${served.join(', ')})`);
    }
    // the search keeps its focus while typing (each letter goes into the address)
    await page.$eval('#sg-q', (i) => { i.focus(); i.select(); }); await page.keyboard.type('gopinath', { delay: 20 });
    await page.waitForFunction(() => document.querySelectorAll('ul[aria-label="Songs found"] li').length > 0, { timeout: 6000 }).catch(() => {});
    const kept = await page.evaluate(() => ({ id: document.activeElement?.id, v: document.getElementById('sg-q')?.value, hash: location.hash }));
    ok(kept.id === 'sg-q' && kept.v === 'gopinath' && kept.hash.includes('q=gopinath'), `${T} the search keeps its focus while typing, and the words go into the address (${JSON.stringify(kept)})`);
    const found = await page.$$eval('ul[aria-label="Songs found"] .lt', (t) => t.map((x) => x.textContent.trim()));
    ok(found[0] === 'Gopinath Mama Nivedana Suno' && found.includes('Gopinath Ghucao Samsara'), `${T} a title search finds the songs, the title matches first (${found.slice(0, 3).join(' · ')})`);
    // a line of the verses, typed without its diacritics
    await page.$eval('#sg-q', (i) => { i.focus(); i.select(); }); await page.keyboard.type('bhava maha davagni', { delay: 10 });
    await page.waitForFunction(() => /Ceto Darpana Marjanam/.test(document.querySelector('ul[aria-label="Songs found"]')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    const byLine = await page.evaluate(() => { const li = [...document.querySelectorAll('ul[aria-label="Songs found"] li')].find((x) => /Ceto Darpana Marjanam/.test(x.textContent)); return li?.querySelector('.sg-line')?.textContent || ''; });
    ok(/dāvāgni/.test(byLine), `${T} a verse line finds its song, and the row shows that line (${byLine})`);
    // open a song, then back to the same results
    await page.$eval('#sg-q', (i) => { i.focus(); i.select(); }); await page.keyboard.type('gopinath mama', { delay: 10 });
    await page.waitForFunction(() => /Gopinath Mama Nivedana Suno/.test(document.querySelector('ul[aria-label="Songs found"]')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('ul[aria-label="Songs found"] a')].find((a) => /Gopinath Mama Nivedana Suno/.test(a.textContent))?.click());
    await page.waitForFunction(() => document.querySelector('#sg-t')?.textContent.trim() === 'Gopinath Mama Nivedana Suno' && !document.activeViewTransition, { timeout: 8000 }).catch(() => {});
    const song = await page.evaluate(() => ({ t: document.querySelector('#sg-t')?.textContent.trim(), by: document.querySelector('.sg-song header')?.textContent || '',
      n: [...document.querySelectorAll('.sg-v')].map((x) => x.previousElementSibling?.textContent.trim()).slice(0, 3), tr: !!document.querySelector('.sg-tr'), hash: location.hash }));
    ok(song.t === 'Gopinath Mama Nivedana Suno' && /Bhaktivinoda Thakura/.test(song.by) && song.n.join() === '1,2,3' && song.tr && /^#\/songs\/s\d{3}$/.test(song.hash), `${T} a song: its title, author, numbered verses and translation (${JSON.stringify(song)})`);
    // the reading measure: verse lines never wider than ~40em, never justified
    const meas = await page.evaluate(() => { const v = document.querySelector('.sg-v'); const cs = v && getComputedStyle(v); return v ? { w: v.getBoundingClientRect().width, em: parseFloat(cs.fontSize), align: cs.textAlign } : null; });
    ok(!!meas && meas.w <= meas.em * 42 && meas.align !== 'justify', `${T} verse set to a reading measure (${JSON.stringify(meas)})`);
    ok(!(await hScroll(page)), `${T} no sideways scroll on a song`);
    if (width === 390) await shot(page, 'songs-song-390');
    const next = await page.$eval('.sg-near .sg-next .sg-turn-t', (a) => a.textContent.trim()).catch(() => '');
    await page.click('.sg-near .sg-next').catch(() => {});
    // taps are dropped while a page change animates: wait for it to end before the next tap
    await page.waitForFunction((t) => document.querySelector('#sg-t')?.textContent.trim() === t && !document.activeViewTransition, { timeout: 6000 }, next).catch(() => {});
    ok(!!next && (await text(page, '#sg-t')) === next, `${T} "next" opens the following song (${next})`);
    await page.click('.sg-song a.link');
    await page.waitForFunction(() => /Gopinath Mama Nivedana Suno/.test(document.querySelector('ul[aria-label="Songs found"]')?.textContent || ''), { timeout: 8000 }).catch(() => {});
    const back = await page.evaluate(() => ({ v: document.getElementById('sg-q')?.value, hash: location.hash }));
    ok(back.v === 'gopinath mama', `${T} "All songs" returns to the same search (${JSON.stringify(back)})`);
    await go(page, '#/songs/s999', 0, 'main');
    await page.waitForFunction(() => /Song not found/.test(document.querySelector('main')?.textContent || ''), { timeout: 6000 }).catch(() => {});
    ok(/Song not found/.test(await text(page, 'main') || ''), `${T} an unknown song says so`);
    if (width === 320) { await go(page, '#/songs', 0, '#sg-q'); ok(!(await hScroll(page)), `${T} no sideways scroll on the list`); }
    // C2/C4: browse by book (an address, as a book tapped on a song gives): Śaraṇāgati, complete, all Bhaktivinoda's,
    // still grouped by section (phase 23), the Book & category panel open with the book chosen
    await go(page, '#/songs?col=' + encodeURIComponent('Śaraṇāgati'), 0, '#sg-q');
    await page.waitForFunction(() => document.querySelectorAll('main ul.list li a.lrow').length === 50, { timeout: 8000 }).catch(() => {});
    const sar = await page.evaluate(() => ({ rows: [...document.querySelectorAll('main ul.list .ls')].map((x) => x.textContent.trim()), sections: document.querySelectorAll('main section h3.sg-sec').length, pick: document.getElementById('sg-col')?.textContent.trim() || '' }));
    ok(sar.rows.length === 50 && sar.rows.every((x) => x === 'Bhaktivinoda Thakura') && sar.sections >= 2 && /^Śaraṇāgati/.test(sar.pick), `${T} browse by book: Śaraṇāgati's 50 songs by section, the picker shows it (${sar.rows.length}, ${sar.sections} sections, ${sar.pick})`);
    if (width === 320) ok(!(await hScroll(page)), `${T} no sideways scroll with a filter`);
    // phase 23 (the head, 27 Oct): one-tap Type and Composer chips; one tap filters, a second tap on the same chip clears
    await go(page, '#/songs', 0, '#sg-q');
    await page.evaluate(() => document.querySelector('.sg-count button')?.click());
    await page.waitForFunction(() => document.querySelectorAll('main ul.list li a.lrow').length > 290, { timeout: 8000 }).catch(() => {});
    const chips = await page.evaluate(() => ({ type: [...document.querySelectorAll('[role=group][aria-label="Type"] .chipbtn')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      comp: [...document.querySelectorAll('[role=group][aria-label="Composer"] .chipbtn')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      tall: [...document.querySelectorAll('.sg-row')].map((r) => Math.round(r.getBoundingClientRect().height)) }));
    ok(/^All$/.test(chips.type[0]) && /^Prayers ?\d+$/.test(chips.type[1]) && /^Songs ?\d+$/.test(chips.type[2]) && /^Bhajans ?\d+$/.test(chips.type[3]) && /^Āratis ?\d+$/.test(chips.type[4]),
      `${T} Type chips with counts (${chips.type.join(' · ')})`);
    ok(/^Bhaktivinoda Thakura ?\d+$/.test(chips.comp[0]) && /^Narottama Dasa Thakura ?\d+$/.test(chips.comp[1]) && chips.comp.at(-1) === 'More…', `${T} Composer chips, most songs first, then More… (${chips.comp.slice(0, 3).join(' · ')} … ${chips.comp.at(-1)})`);
    ok(chips.tall.every((h) => h < 64), `${T} each chip row is one line, not a tall block (${chips.tall.join(', ')} px)`);
    const tap = async (group, re) => page.evaluate((g, src) => { const b = [...document.querySelectorAll(`[role=group][aria-label="${g}"] .chipbtn`)].find((x) => new RegExp(src).test(x.textContent.trim())); b?.click(); return !!b; }, group, re.source);
    await tap('Type', /^Bhajans/);
    await page.waitForFunction(() => location.hash.includes('type=bhajan') && document.querySelectorAll('main ul.list li a.lrow').length < 40, { timeout: 6000 }).catch(() => {});
    const bh = await page.evaluate(() => ({ rows: document.querySelectorAll('main ul.list li a.lrow').length, pressed: document.querySelector('[role=group][aria-label="Type"] [aria-pressed=true]')?.textContent.trim(), hash: location.hash, clear: !!document.querySelector('.sg-count button'), secs: document.querySelectorAll('main section h3.sg-sec').length }));
    ok(bh.rows > 0 && bh.rows < 40 && /^Bhajans/.test(bh.pressed || '') && bh.clear && bh.secs >= 1, `${T} one tap on Bhajans filters, still by section, Clear shown (${JSON.stringify(bh)})`);
    await tap('Composer', /^Narottama/);
    await page.waitForFunction(() => location.hash.includes('poet=Narottama'), { timeout: 6000 }).catch(() => {});
    await tap('Type', /^Bhajans/);
    await page.waitForFunction(() => !location.hash.includes('type='), { timeout: 6000 }).catch(() => {});
    const nar = await page.evaluate(() => ({ rows: [...document.querySelectorAll('main ul.list .ls')].map((x) => x.textContent.trim()), type: document.querySelector('[role=group][aria-label="Type"] [aria-pressed=true]')?.textContent.trim(), hash: location.hash }));
    ok(nar.rows.length > 50 && nar.rows.every((x) => x === 'Narottama Dasa Thakura') && nar.type === 'All' && !nar.hash.includes('type='), `${T} a second tap clears the type; the composer stays (${nar.rows.length}, ${nar.type}, ${nar.hash})`);
    await tap('Composer', /^Narottama/);
    await page.waitForFunction(() => document.querySelectorAll('main ul.list li a.lrow').length > 290, { timeout: 6000 }).catch(() => {});
    ok((await page.$$eval('main ul.list li a.lrow', (a) => a.length)) > 290 && !(await page.evaluate(() => location.hash.includes('poet='))), `${T} a second tap on the composer clears it: every song again`);
    ok(!(await hScroll(page)), `${T} no sideways scroll on the page (the chip rows scroll themselves)`);
    if (width === 390 || width === 1280) await shot(page, `songs-chips-${width}`);
    // a song transcribed from a book: each verse's translation beneath it, marked for proofreading, its book named
    await go(page, '#/songs/s172', 0, '#sg-t');
    await page.waitForFunction(() => !!document.querySelector('.sg-gloss'), { timeout: 10000 }).catch(() => {});   // its book file arrives first
    const tx = await page.evaluate(() => ({ gl: document.querySelectorAll('.sg-gloss').length, v: document.querySelectorAll('.sg-v').length, proof: /Awaiting proofreading/.test(document.querySelector('main')?.textContent || ''), src: document.querySelector('.sg-src')?.textContent || '' }));
    ok(tx.gl > 0 && tx.gl === tx.v && !tx.proof && /Śaraṇāgati \(Gaudiya Books\), p\. \d+/.test(tx.src), `${T} a transcribed song, its text fetched from its book file: a translation under each verse, its book page named, no proofreading marker (${JSON.stringify(tx)})`);
    // the Devanagari Damodarastakam: the Hindi book's text, found by the usual spelling, linked to the Roman one
    await go(page, '#/songs', 0, '#sg-q');
    await page.evaluate(() => document.querySelector('.sg-count button')?.click());   // Clear empties the filter
    await page.$eval('#sg-q', (i) => { i.focus(); i.select(); }); await page.keyboard.type('damodarashtakam', { delay: 10 });
    await page.waitForFunction(() => document.querySelectorAll('ul[aria-label="Songs found"] li').length >= 2, { timeout: 6000 }).catch(() => {});
    const dam = await page.$$eval('ul[aria-label="Songs found"] a', (a) => a.map((x) => x.getAttribute('href')));
    ok(dam.includes('#/songs/s107') && dam.includes('#/songs/s171'), `${T} "damodarashtakam" finds it in Roman letters and in Devanagari (${dam.join(' ')})`);
    await go(page, '#/songs/s171', 0, '#sg-t');
    await page.waitForFunction(() => document.querySelector('#sg-t')?.getAttribute('lang') === 'sa', { timeout: 6000 }).catch(() => {});
    const dev = await page.evaluate(() => ({ lang: document.querySelector('#sg-t')?.getAttribute('lang'), v: document.querySelector('.sg-v')?.getAttribute('lang'), gl: document.querySelector('.sg-gloss')?.getAttribute('lang'),
      proof: /Awaiting proofreading/.test(document.querySelector('main')?.textContent || ''), also: document.querySelector('.sg-tools a[href="#/songs/s107"]') !== null, src: document.querySelector('.sg-src')?.textContent || '' }));
    ok(dev.lang === 'sa' && dev.v === 'sa' && dev.gl === 'hi' && !dev.proof && dev.also && /Hindi song book/.test(dev.src), `${T} the Devanagari Damodarastakam: lang sa, the Hindi book's meanings, no proofreading marker, linked to the Roman one (${JSON.stringify(dev)})`);
    ok(!(await hScroll(page)), `${T} no sideways scroll on a Devanagari song`);
    if (width === 390) await shot(page, 'songs-devanagari-390');
    await page.browserContext().close();
  }
}
if (!only || only === 'songs') await part('songs', async () => { await songs(); });

// One id system (the head, 22 Oct 2026): a devotee with no IYFD answers one question at their next open — the year
// they came to IYF Delhi — and that answer issues their IYF ID. Nothing they have is lost; the head sees who is
// still to answer in IYF IDs › Created here.
async function yearPrompt() {
  const W = '[yearPrompt]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    // a sign-up approved with no ID: the coordinator approves, then they sign in
    await login(page, 'sps', 'sps-pass-12');
    await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); await call('requests.approve', { phone: '6000000087', link: { noIdYet: true }, levelEntryDate: '2026-10-02' }); });
    await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400);
    await go(page, '#/login', 0, '#login');
    await login(page, '6000000087', 'pass-12345');
    await page.waitForFunction(() => /When did you first come to IYF Delhi/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    ok(/When did you first come to IYF Delhi/.test(await text(page, 'body') || ''), `[${width}] ${W} no IYFD: the year is asked before anything else`);
    ok(!(await page.$('nav.nav')) && !(await page.$('.sidebar')), `[${width}] ${W} it stands alone: no bars or menu around it`);
    if (width === 390) await shot(page, 'year-prompt-390');
    await sel(page, '#cs-year', '2021');
    await clickText(page, 'button', /^Get my IYF ID$/);
    await page.waitForFunction(() => !/When did you first come/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    ok((await page.evaluate(() => location.hash)).startsWith('#/home'), `[${width}] ${W} answering goes straight to Home`);
    const id = await page.evaluate(async () => (await (await import('/src/lib/api.js')).call('auth.me')).user.iyfId);
    ok(/^IYFD-2021-\d{4}$/.test(id || ''), `[${width}] ${W} and their IYF ID is issued (${id})`);
    // the head sees who is still waiting, and this person is no longer on it
    await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400);
    await go(page, '#/login', 0, '#login');
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/ids', 0, 'main');
    await clickText(page, 'button', /^Created here$/);
    await page.waitForSelector('#ids-wait, .card', { timeout: 8000 }).catch(() => {});
    const waitText = await text(page, 'main') || '';
    ok(/Waiting for their year/.test(waitText) && !/Rahul Sharma/.test((await page.$eval('#ids-wait', (h) => h.closest('section').innerText).catch(() => '')) || ''),
      `[${width}] ${W} the head's list of who is still waiting no longer has them`);
    ok(!(await hScroll(page)), `[${width}] ${W} no sideways scroll`);
    if (width === 1280) await shot(page, 'year-waiting-1280');
    await page.browserContext().close();
  }
}
if (!only || only === 'yearPrompt') await part('yearPrompt', async () => { await yearPrompt(); });

// The facilitation card and the scoreboard (ADR 0012, 22 Oct 2026). Nothing in this suite opened either before, which
// is how the server and the mock both scored sadhana and seva as one figure without a single check noticing.
async function facCard() {
  const W = '[facCard]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, 'natvar', 'natvar-pass-1');
    // targets and one week, through the app's own calls (the screen's own forms are the next checks' business)
    await page.evaluate(async () => {
      const { call } = await import('/src/lib/api.js');
      const ph = (await call('phases.list')).phases.find((p) => p.state === 'OPEN');
      await call('targets.set', { phaseId: ph.phaseId, targets: [{ measureId: 'sadhna', target: '80' }, { measureId: 'stall', target: '5' },
        { measureId: 'ftp', target: 'YES' }, { measureId: 'journal', target: 'YES' }] });
      await call('stages.set', { phaseId: ph.phaseId, stages: [{ stage: 'DPS', target: 2 }] });
    });
    await go(page, '#/card', 0, 'main');
    await page.waitForFunction(() => /Every month/.test(document.querySelector('main')?.innerText || ''), { timeout: 10000 }).catch(() => {});
    const t = await text(page, 'main') || '';
    ok(/Every week/.test(t) && /Every month/.test(t), `[${width}] ${W} weekly and monthly apart`);
    ok(/Vedic Level 2 registration/i.test(t) && /\bTarget\b/i.test(t), `[${width}] ${W} the card's two groups, as the paper card`);
    // phase 22 (E1): two panes, Targets then This week, each with its own "Every month" list
    const panes = await page.$$eval('main .cd-pane .cd-h', (xs) => xs.map((x) => x.textContent.trim())).catch(() => []);
    ok(panes.join('|') === 'Targets|This week', `[${width}] ${W} two panes, Targets first (${panes.join(' | ')})`);
    const monthly = await page.evaluate(() => { const h = [...document.querySelectorAll('h3, h4')].find((x) => /Every month/.test(x.textContent));
      return h?.nextElementSibling?.querySelectorAll('li').length || 0; });
    ok(monthly === 4, `[${width}] ${W} four monthly measures (${monthly})`);
    ok(/eligible/.test(t), `[${width}] ${W} each level shows how many students are eligible`);
    // the month scorecard (ADR 0012 D): every ended month of the phase, one row each — September ended unfilled
    // E2: the scorecard shows one period at a time; the month scorecard is part of This phase
    ok(!(await page.$('main .cd-months')) && /Sadhana/.test(await text(page, 'main .sc') || ''), `[${width}] ${W} the scorecard opens on the week alone`);
    await clickText(page, 'main .sc .seg button', /^This phase$/).catch(() => {});
    await page.waitForSelector('.cd-months', { timeout: 8000 }).catch(() => {});
    ok(/Net score/.test(await text(page, 'main .sc') || ''), `[${width}] ${W} This phase shows the net score`);
    const mrows = await page.$$eval('.cd-mrow', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim())).catch(() => []);
    ok(mrows.some((r) => /^Sep 2026/.test(r)), `[${width}] ${W} Month by month lists each ended month (${mrows.join(' | ')})`);
    ok(mrows.every((r) => /not filled|Sadhana/.test(r)) && !mrows.some((r) => /^Oct 2026/.test(r)), `[${width}] ${W} … unfilled reads "not filled", and October (still running) is not there`);
    ok(!(await hScroll(page)), `[${width}] ${W} no sideways scroll`);
    if (width === 390) await shot(page, 'faccard-390');
    // ADR 0016: the facilitator has a Scoreboard of their own — their row and place only, and their card read-only
    const menu = await page.evaluate(async () => (await import('/src/lib/nav.js')).navFor((await import('/src/lib/session.svelte.js')).session.user.scopes)
      .sections.flatMap((s) => s.items.map((i) => i.id))).catch(() => []);
    ok(menu.includes('myboard'), `[${width}] ${W} the facilitator's menu has their Scoreboard (${menu.join(',')})`);
    await go(page, '#/scoreboards', 0, 'main');
    await page.waitForSelector('.sb-row', { timeout: 10000 }).catch(() => {});
    const own = await page.$$eval('.sb-row .sb-who', (xs) => xs.map((x) => x.textContent.trim())).catch(() => []);
    ok(own.length === 1 && /Natvar/.test(own[0]), `[${width}] ${W} the facilitator sees their own row only (${own.join(' | ')})`);
    ok(/Your rank: #\d+ of \d+|Not ranked yet/.test(await text(page, 'main') || ''), `[${width}] ${W} … with their place on the board`);
    await page.waitForFunction(() => { const b = document.querySelector('.sb-row'); if (!b) return false;
      if (!document.querySelector('dialog[open]')) b.click(); return /Every month/.test(document.querySelector('dialog[open]')?.innerText || ''); },
      { timeout: 10000, polling: 300 }).catch(() => {});
    const dlg = await page.evaluate(() => { const d = document.querySelector('dialog[open]');
      return { t: d?.innerText || '', inputs: d?.querySelectorAll('input').length ?? -1, rank: !!d?.querySelector('.cd-place') }; });
    ok(/Every week/.test(dlg.t) && /Every month/.test(dlg.t) && /Vedic Level 2 registration/i.test(dlg.t),
      `[${width}] ${W} a tap opens the same card they fill, grouped`);
    ok(dlg.inputs === 0 && dlg.rank, `[${width}] ${W} … read-only, with the place on it (inputs ${dlg.inputs})`);
    ok(!(await hScroll(page)), `[${width}] ${W} own scoreboard: no sideways scroll`);
    await shot(page, `faccard-myboard-${width}`);
    await page.keyboard.press('Escape');
    // the head's board ranks on seva and goal
    await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400);
    await go(page, '#/login', 0, '#login');
    await page.$eval('#login', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await login(page, 'master', 'master-pass-1');
    const rows = await page.evaluate(async () => {
      const { call } = await import('/src/lib/api.js');
      return (await call('board.get', {})).rows.map((r) => ({ n: r.name, seva: r.seva, goal: r.goal, rank: r.rank, sad: r.sadhana }));
    });
    const nv = rows.find((r) => /Natvar/.test(r.n));
    ok(!!nv && 'seva' in nv && 'goal' in nv && 'rank' in nv && 'sad' in nv,
      `[${width}] ${W} the board lists the facilitator, with seva, goal, rank and sadhana (${JSON.stringify(nv)})`);
    ok(rows.findIndex((r) => r.rank !== null) <= rows.findIndex((r) => r.rank === null) || rows.every((r) => r.rank !== null) || rows.every((r) => r.rank === null),
      `[${width}] ${W} somebody with a target ranks before somebody never given one`);
    // the head sees the WHOLE facilitators' board, and a tap opens that facilitator's own card — the dashboard's detail
    await go(page, '#/scoreboards', 0, 'main');
    await page.waitForSelector('.sb-row', { timeout: 10000 }).catch(() => {});
    await clickText(page, 'button[aria-pressed], [role="radio"], .seg button', /^Facilitators$/).catch(() => {});
    await page.waitForFunction(() => [...document.querySelectorAll('.sb-who')].some((x) => /Natvar/.test(x.textContent)), { timeout: 10000 }).catch(() => {});
    const all = await page.$$eval('.sb-row .sb-who', (xs) => xs.length).catch(() => 0);
    // the mock has one facilitator; that the others' rows are withheld from a facilitator is proven in card-scoring.test.mjs
    ok(all === rows.length && all >= 1, `[${width}] ${W} the head sees every facilitator (${all} of ${rows.length})`);
    // phase 22 (E3): the head's board shows one period at a time, the finished week first, then the phase so far
    const wk = await page.$$eval('.sb-row .sb-fig small', (xs) => xs.map((x) => x.textContent.trim())).catch(() => []);
    ok(wk.length === all && wk.every((x) => /filled|no targets set/.test(x)), `[${width}] ${W} the head's board opens on the week alone (${wk.join(' | ')})`);
    await clickText(page, '#sb-period .seg button', /^This phase$/).catch(() => {});
    const ph = await page.$$eval('.sb-row .sb-fig small', (xs) => xs.map((x) => x.textContent.trim())).catch(() => []);
    ok(ph.length === all && ph.every((x) => /\d+ of \d+ weeks/.test(x)), `[${width}] ${W} …and This phase shows the phase figure alone (${ph.join(' | ')})`);
    ok(!(await hScroll(page)), `[${width}] ${W} head's board: no sideways scroll`);
    await page.evaluate(() => [...document.querySelectorAll('.sb-row')].find((b) => /Natvar/.test(b.textContent))?.click());
    await page.waitForFunction(() => /Every month/.test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 10000 }).catch(() => {});
    const hd = await page.evaluate(() => { const d = document.querySelector('dialog[open]');
      return { t: d?.innerText || '', inputs: d?.querySelectorAll('input').length ?? -1 }; });
    ok(/Natvar/.test(hd.t) && /Every week/.test(hd.t) && /Students to move up/.test(hd.t) && hd.inputs === 0,
      `[${width}] ${W} a row opens that facilitator's full card, read-only`);
    ok(/Rank #\d+ of \d+|Not ranked yet/.test(hd.t), `[${width}] ${W} … with their place`);
    await shot(page, `faccard-headdetail-${width}`);
    await page.browserContext().close();
  }
}
if (!only || only === 'facCard') await part('facCard', async () => { await facCard(); });

// Targets are set at the start of the phase (phase 21, 23 Oct 2026 — ADR 0018). The mock's Kartik phase began 1 Sep, so
// today its set targets are fixed: a first visit still sets them (never set), a set one cannot move, and the head opens them.
async function targets21() {
  const W = '[targets21]';
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, 'natvar', 'natvar-pass-1');
    const T = `[${width}] ${W}`;
    await go(page, '#/card', 0, 'main');
    await page.waitForFunction(() => /Save my targets/.test(document.querySelector('main')?.innerText || ''), { timeout: 10000 }).catch(() => {});
    const first = await page.evaluate(() => ({ t: document.querySelector('main')?.innerText || '', lock: document.querySelector('.cd-lock')?.textContent.trim() || '',
      yes: [...document.querySelectorAll('[id^="ct-"] .seg button[aria-pressed=true]')].map((b) => b.textContent.trim()) }));
    ok(/Save my targets/.test(first.t), `${T} a first visit opens on setting targets`);
    ok(/^Targets fixed after 7 Sep 2026$/.test(first.lock), `${T} the card says when targets were fixed (${first.lock})`);
    ok(first.yes.length === 4 && first.yes.includes('Every week') && first.yes.includes('Every month'), `${T} the Yes/No measures can be set, and start counted (${first.yes.join(', ')})`);
    // a target never set may still be set after the start of the phase
    await page.$eval('#ct-stall', (i) => { i.focus(); i.select(); }); await page.keyboard.type('5');
    await page.evaluate(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Save my targets')?.click());
    await page.waitForFunction(() => /Save this week/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    // phase 22 (E1): editing the targets is the Targets pane's own button; the footer only saves the week
    const after = await page.evaluate(() => ({ t: document.querySelector('main')?.innerText || '', btn: [...document.querySelectorAll('main .cd-ph button')].map((b) => b.textContent.trim()),
      foot: [...document.querySelectorAll('main .cd-foot button')].map((b) => b.textContent.trim()) }));
    ok(/target 5/.test(after.t) && after.btn.includes('Set the missing targets') && !after.btn.includes('Edit'), `${T} saved; only the missing targets can be set now (${after.btn.join(' | ')})`);
    ok(after.foot.join('|') === 'Save this week', `${T} …and the footer saves the week alone (${after.foot.join(' | ')})`);
    ok(/This month: (not yet|done|\d+ of )/.test(after.t), `${T} a monthly measure shows the month so far against its target`);
    // a set target cannot move: greyed on the screen, refused by the server
    await page.evaluate(() => [...document.querySelectorAll('main .cd-ph button')].find((b) => b.textContent.trim() === 'Set the missing targets')?.click());
    await page.waitForSelector('#ct-stall', { timeout: 6000 }).catch(() => {});
    ok(await page.$eval('#ct-stall', (i) => i.disabled).catch(() => false), `${T} a set target is greyed out after the start of the phase`);
    const refused = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const ph = (await call('phases.list')).phases.find((p) => p.state === 'OPEN');
      try { await call('targets.set', { phaseId: ph.phaseId, targets: [{ measureId: 'stall', target: '9' }] }); return 'ok'; } catch (e) { return e.code + ' ' + e.message; } });
    ok(/^WINDOW_CLOSED .*IYF head/.test(refused), `${T} …and the server refuses to move it (${refused})`);
    ok(!(await hScroll(page)), `${T} no sideways scroll`);
    if (width === 390) await shot(page, 'targets21-390');
    // the head opens their targets from the scoreboard
    await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400);
    await go(page, '#/login', 0, '#login');
    await page.$eval('#login', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/scoreboards', 0, 'main');
    await page.waitForSelector('.sb-row', { timeout: 10000 }).catch(() => {});
    await clickText(page, 'button[aria-pressed], [role="radio"], .seg button', /^Facilitators$/).catch(() => {});
    await page.waitForFunction(() => [...document.querySelectorAll('.sb-who')].some((x) => /Natvar/.test(x.textContent)), { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('.sb-row')].find((b) => /Natvar/.test(b.textContent))?.click());
    await page.waitForFunction(() => /Open their targets for 7 days/.test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 10000 }).catch(() => {});
    ok(/Open their targets for 7 days/.test(await page.evaluate(() => document.querySelector('dialog[open]')?.innerText || '')), `${T} the head sees "Open their targets" on a facilitator's fixed card`);
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /Open their targets for 7 days/.test(b.textContent))?.click());
    await page.waitForSelector('dialog[open] #cd-why', { timeout: 5000 }).catch(() => {});
    await page.type('dialog[open] #cd-why', 'Moved to a new area');
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim() === 'Open their targets')?.click());
    await page.waitForFunction(() => /Targets open until/.test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(/Targets open until/.test(await page.evaluate(() => document.querySelector('dialog[open]')?.innerText || '')), `${T} …with a reason, and their card says they are open`);
    ok(await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const r = await call('card.of', { login: 'natvar' }); return !!r.targets.openedUntil; }), `${T} the server holds the opening`);
    await page.keyboard.press('Escape');
    await page.browserContext().close();
  }
}
if (!only || only === 'targets21') await part('targets21', async () => { await targets21(); });

// The promotion explorer (phase 21): a facilitator's students on the ladder, any batch, with the rule applied by default
// and thresholds of their own, over a period they choose — as the dashboard's Promotion Explorer tab.
async function explorer() {
  const W = '[explorer]';
  const count = (page) => page.evaluate(() => (document.querySelector('main')?.innerText.match(/(\d+) of (\d+) qualify/) || []).slice(1).map(Number));
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, 'natvar', 'natvar-pass-1');
    const T = `[${width}] ${W}`;
    const menu = await page.evaluate(async () => (await import('/src/lib/nav.js')).navFor((await import('/src/lib/session.svelte.js')).session.user.scopes).sections.flatMap((s) => s.items.map((i) => i.id))).catch(() => []);
    ok(menu.includes('explorer'), `${T} a facilitator's menu has the Promotion explorer`);
    await go(page, '#/explorer', 0, 'main');
    await page.waitForFunction(() => /qualify/.test(document.querySelector('main')?.innerText || ''), { timeout: 12000 }).catch(() => {});
    const first = await page.evaluate(() => ({ p: document.querySelector('[aria-label=Period] [aria-pressed=true]')?.textContent.trim(), weeks: /Weeks of \d+ \w+ \d{4} to \d+ \w+ \d{4}/.test(document.querySelector('main')?.innerText || ''),
      routes: [...document.querySelectorAll('[aria-label="Promotion route"] button')].map((b) => b.textContent.trim()) }));
    ok(first.p === 'Phase so far' && first.weeks, `${T} it opens on the phase so far, saying which weeks (${first.p})`);
    const [n0, of0] = await count(page);
    ok(of0 > 0 && n0 >= 0 && n0 <= of0, `${T} "N of M qualify" with the batch rules (${n0} of ${of0})`);
    const pills = await page.$$eval('ul[aria-label=Students] .pill', (x) => x.length);
    ok(pills === n0, `${T} each one listed says Qualifies (${pills})`);
    // a route: the sheet's criteria table, then a threshold of their own and an unticked criterion
    await page.evaluate(() => document.querySelectorAll('[aria-label="Promotion route"] button')[1]?.click());
    await page.waitForSelector('.ex-crit', { timeout: 6000 }).catch(() => {});
    const crit = await page.$$eval('.ex-row', (r) => r.map((x) => x.querySelector('.ex-tick')?.textContent.trim()));
    ok(crit.length >= 1 && crit.every(Boolean), `${T} a route shows its criteria, each with a tick (${crit.join(', ')})`);
    const [n1] = await count(page);
    const sad = await page.evaluate(() => [...document.querySelectorAll('.ex-row')].findIndex((r) => /Sadhana average/.test(r.textContent)));
    if (sad >= 0) {
      await page.evaluate((i) => { const inp = document.querySelectorAll('.ex-row')[i].querySelector('.ex-own input'); inp.focus(); }, sad);
      await page.keyboard.type('100');
      await page.waitForFunction((n) => { const m = document.querySelector('main')?.innerText.match(/(\d+) of \d+ qualify/); return m && Number(m[1]) < n; }, { timeout: 4000 }, n1 || 1).catch(() => {});
      const [n2] = await count(page);
      ok(n1 > 0 ? n2 < n1 : n2 === 0, `${T} a higher threshold of their own narrows the list at once (${n1} → ${n2}), with no request`);
      await page.evaluate((i) => document.querySelectorAll('.ex-row')[i].querySelector('.ex-tick input').click(), sad);
      await page.waitForFunction((n) => { const m = document.querySelector('main')?.innerText.match(/(\d+) of \d+ qualify/); return m && Number(m[1]) >= n; }, { timeout: 4000 }, n1).catch(() => {});
      const [n3] = await count(page);
      ok(n3 >= n1, `${T} unticking that criterion brings them back (${n3})`);
    } else ok(false, `${T} the SPS route has a Sadhana average criterion`);
    // a criterion outside the route's rule can be added: it starts unticked and counts once it has a threshold
    const att = await page.evaluate(() => { const r = [...document.querySelectorAll('.ex-row')].find((x) => /^Attendance/.test(x.querySelector('.ex-tick')?.textContent.trim() || ''));
      return r ? { on: r.querySelector('.ex-tick input').checked, why: r.textContent.includes('Not in the rule') } : null; });
    ok(!!att && !att.on && att.why, `${T} a criterion outside the rule is offered, unticked (${JSON.stringify(att)})`);
    if (att) {
      const [before] = await count(page);
      await page.evaluate(() => [...document.querySelectorAll('.ex-row')].find((x) => /^Attendance/.test(x.querySelector('.ex-tick')?.textContent.trim() || ''))?.querySelector('.ex-tick input').click());
      await page.evaluate(() => [...document.querySelectorAll('.ex-row')].find((x) => /^Attendance/.test(x.querySelector('.ex-tick')?.textContent.trim() || ''))?.querySelector('.ex-own input').focus());
      await page.keyboard.type('101');
      await page.waitForFunction(() => /^0 of \d+ qualify/.test(document.querySelector('main')?.innerText.match(/\d+ of \d+ qualify/)?.[0] || ''), { timeout: 4000 }).catch(() => {});
      const [after] = await count(page);
      ok(after === 0 && before >= 0, `${T} …ticked with a threshold of their own, it narrows the list (${before} → ${after})`);
      await page.evaluate(() => [...document.querySelectorAll('.ex-row')].find((x) => /^Attendance/.test(x.querySelector('.ex-tick')?.textContent.trim() || ''))?.querySelector('.ex-tick input').click());
    }
    // everyone, with why each one is short
    await page.evaluate(() => [...document.querySelectorAll('#ex-show button')].find((b) => /Everyone/.test(b.textContent))?.click());
    const everyone = await page.$$eval('ul[aria-label=Students] > li', (x) => x.length).catch(() => 0);
    const [, of1] = await count(page);
    ok(everyone === of1, `${T} "Everyone" lists every student of the route (${everyone} of ${of1}), each criterion ✓ or ✗ with its figure`);
    // another period asks the server once and says the weeks
    await page.evaluate(() => [...document.querySelectorAll('[aria-label=Period] button')].find((b) => b.textContent.trim() === 'Last week')?.click());
    await page.waitForFunction(() => { const m = document.querySelector('main')?.innerText.match(/Weeks of (\d+ \w+ \d{4}) to (\d+ \w+ \d{4})/); return m && m[1] === m[2]; }, { timeout: 8000 }).catch(() => {});
    ok(await page.evaluate(() => { const m = document.querySelector('main')?.innerText.match(/Weeks of (\d+ \w+ \d{4}) to (\d+ \w+ \d{4})/); return !!m && m[1] === m[2]; }), `${T} "Last week" is one week`);
    await page.evaluate(() => [...document.querySelectorAll('[aria-label=Period] button')].find((b) => b.textContent.trim() === 'Custom')?.click());
    await page.waitForSelector('#ex-from', { timeout: 4000 }).catch(() => {});
    await page.$eval('#ex-from', (i) => { i.value = '2026-09-01'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#ex-to', (i) => { i.value = '2026-09-30'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => [...document.querySelectorAll('.ex-dates button')].find((b) => b.textContent.trim() === 'Show')?.click());
    await page.waitForFunction(() => /Weeks of 31 Aug 2026 to 28 Sep 2026/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(/Weeks of 31 Aug 2026 to 28 Sep 2026/.test(await text(page, 'main') || ''), `${T} a custom period, counted by the weeks' Mondays`);
    ok(!(await hScroll(page)), `${T} no sideways scroll`);
    if (width === 390) await shot(page, 'explorer-390');
    // a return visit draws at once, from the kept copy
    await go(page, '#/home', 0, 'main');
    await page.evaluate(() => { location.hash = '#/explorer'; });
    await page.waitForFunction(() => location.hash === '#/explorer' && document.querySelector('main[data-path="/explorer"]'), { timeout: 6000 }).catch(() => {});
    ok(await page.evaluate(() => !document.querySelector('main .sk') && /qualify/.test(document.querySelector('main')?.innerText || '')), `${T} a return visit draws at once (no skeleton)`);
    await page.browserContext().close();
  }
  const page = await fresh(390);
  await login(page, '6000000001', 'pass-12345');
  await go(page, '#/explorer', 0, 'main');
  await page.waitForFunction(() => /Not available to you/.test(document.querySelector('main')?.innerText || ''), { timeout: 6000 }).catch(() => {});
  ok(/Not available to you/.test(await text(page, 'main') || ''), `[390] ${W} a devotee who is not a facilitator cannot open it`);
  await page.browserContext().close();
}
if (!only || only === 'explorer') await part('explorer', async () => { await explorer(); });

// Admin › Analysis (phase 21): the head's one screen for sadhana and training — every measure for a period against the
// one before, a chart per measure by batch, the increase/drop report, and each training with its card figures.
async function analysis() {
  const W = '[analysis]';
  const head = (page) => page.evaluate(() => document.querySelector('.page-head h2')?.textContent.trim() || '');
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, 'master', 'master-pass-1');
    const T = `[${width}] ${W}`;
    const menu = await page.evaluate(async () => (await import('/src/lib/nav.js')).navFor((await import('/src/lib/session.svelte.js')).session.user.scopes).sections.flatMap((s) => s.items.map((i) => i.id))).catch(() => []);
    ok(menu.includes('analysis'), `${T} the head's menu has Analysis`);
    await go(page, '#/analysis', 0, 'main');
    await page.waitForSelector('.an-tile', { timeout: 15000 }).catch(() => {});
    const first = await page.evaluate(() => ({ tab: document.querySelector('[role=tablist] [aria-selected=true], .tabs [aria-current=page]')?.textContent.trim() || '',
      p: document.querySelector('[aria-label=Period] [aria-pressed=true]')?.textContent.trim(), tiles: [...document.querySelectorAll('.an-tile')].map((x) => x.querySelector('.an-l')?.textContent.trim()),
      lines: document.querySelectorAll('section.cblock svg polyline').length }));
    ok(first.p === 'Last 12 weeks' && /^\d+ \w+ \d{4} – \d+ \w+ \d{4}$/.test(await head(page)), `${T} it opens on the last 12 weeks, naming them (${await head(page)})`);
    ok(['Chanting', 'Reading', 'Hearing', 'Night stay', '4 principles', 'Class attendance', 'Submitted'].every((l) => first.tiles.includes(l)), `${T} every measure has a tile (${first.tiles.length})`);
    ok(first.lines >= 1, `${T} the chart draws the chanting lines`);
    // a tile puts its measure on the chart
    await page.evaluate(() => [...document.querySelectorAll('.an-tile')].find((x) => /Reading/.test(x.textContent))?.click());
    await page.waitForFunction(() => /^Reading/.test(document.querySelector('#an-c')?.textContent || ''), { timeout: 4000 }).catch(() => {});
    ok(/^Reading/.test(await text(page, '#an-c') || ''), `${T} a tile puts its measure on the chart`);
    // another period: one request, the heading follows
    const before = await head(page);
    await page.evaluate(() => [...document.querySelectorAll('[aria-label=Period] button')].find((b) => b.textContent.trim() === 'Last 4 weeks')?.click());
    // a new period loads behind the skeleton (its figures are never drawn under the old heading): wait for them
    await page.waitForFunction(() => [...document.querySelectorAll('.page-head p')].some((x) => /Against the 4 weeks before/.test(x.textContent)) && document.querySelector('.an-tile'), { timeout: 10000 }).catch(() => {});
    const four = await page.evaluate(() => [...document.querySelectorAll('.page-head p')].map((x) => x.textContent.trim()).find((x) => /^Against/.test(x)) || '');
    ok(/Against the 4 weeks before/.test(four), `${T} the last 4 weeks, against the 4 before (${four})`);
    // one batch
    const chips = await page.$$eval('[aria-label=Batch] button', (b) => b.map((x) => x.textContent.trim()));
    if (chips.length > 1) {
      await page.evaluate(() => document.querySelectorAll('[aria-label=Batch] button')[1].click());
      await page.waitForFunction(() => document.querySelectorAll('[aria-label=Batch] button')[1]?.getAttribute('aria-pressed') === 'true', { timeout: 4000 }).catch(() => {});
      ok(await page.evaluate(() => document.querySelectorAll('[aria-label=Batch] button')[1]?.getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.an-tile').length > 0), `${T} one batch on its own (${chips[1]})`);
      await page.evaluate(() => document.querySelectorAll('[aria-label=Batch] button')[0].click());
    } else ok(false, `${T} the batch chips list the batches (${chips.join(', ')})`);
    // the training side, on the same screen; card figures only when asked for
    ok(/ETP · Batch 21/.test(await text(page, '#an-t + .an-trs') || '') && /in it now/.test(await text(page, '#an-t + .an-trs') || ''), `${T} each training: who is in it, and its attendance`);
    await page.evaluate(() => [...document.querySelectorAll('.an-tr button')].forEach((b) => b.click()));
    await page.waitForFunction(() => [...document.querySelectorAll('.an-tr')].every((x) => /on the card|facilitator/.test(x.textContent)), { timeout: 10000 }).catch(() => {});
    ok(await page.evaluate(() => [...document.querySelectorAll('.an-tr')].every((x) => /set targets/.test(x.textContent))), `${T} the trainings' and facilitators' card figures, when opened`);
    // custom
    await page.evaluate(() => [...document.querySelectorAll('[aria-label=Period] button')].find((b) => b.textContent.trim() === 'Custom')?.click());
    await page.waitForSelector('#an-from', { timeout: 4000 }).catch(() => {});
    await page.$eval('#an-from', (i) => { i.value = '2026-09-01'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#an-to', (i) => { i.value = '2026-09-30'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => [...document.querySelectorAll('.an-dates button')].find((b) => b.textContent.trim() === 'Show')?.click());
    await page.waitForFunction(() => /^31 Aug 2026 – 28 Sep 2026$/.test(document.querySelector('.page-head h2')?.textContent.trim() || ''), { timeout: 8000 }).catch(() => {});
    ok((await head(page)) === '31 Aug 2026 – 28 Sep 2026', `${T} a custom period, counted by Mondays (${await head(page)})`);
    ok(!(await hScroll(page)), `${T} no sideways scroll`);
    await shot(page, `analysis-${width}`);
    // a return visit draws at once
    await page.evaluate(() => [...document.querySelectorAll('[aria-label=Period] button')].find((b) => b.textContent.trim() === 'Last 12 weeks')?.click());
    await page.waitForSelector('.an-tile', { timeout: 8000 }).catch(() => {});
    await go(page, '#/overview', 0, 'main');
    await page.evaluate(() => { location.hash = '#/analysis'; });
    await page.waitForFunction(() => document.querySelector('main[data-path="/analysis"]') && document.querySelector('.an-tile'), { timeout: 6000 }).catch(() => {});
    ok(await page.evaluate(() => !!document.querySelector('.an-tile') && !document.querySelector('main .sk')), `${T} a return visit draws at once (no skeleton)`);
    await page.browserContext().close();
  }
  const page = await fresh(390);
  await login(page, 'sps', 'sps-pass-12');
  await go(page, '#/analysis', 0, 'main');
  await page.waitForFunction(() => /Not available to you/.test(document.querySelector('main')?.innerText || ''), { timeout: 6000 }).catch(() => {});
  ok(/Not available to you/.test(await text(page, 'main') || ''), `[390] ${W} a coordinator cannot open it`);
  await page.browserContext().close();
}
if (!only || only === 'analysis') await part('analysis', async () => { await analysis(); });
// ADR 0017 (the head, 22 Oct 2026): every head setting that was built gets its screen — phases, promotion rules, ready to
// move up, a finished trainee's card reopened, IYF ID merge, head access, sign out everywhere. Walked as the person who
// uses each, at a phone and a desktop width.
async function admin17() {
  const W = '[admin17]';
  const dlg = (page) => page.evaluate(() => document.querySelector('dialog[open]')?.innerText.replace(/\s+/g, ' ') || '');
  const waitDlg = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 10000 }, re.source).catch(() => {});
  const waitMain = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('main')?.innerText || ''), { timeout: 10000 }, re.source).catch(() => {});
  for (const width of [390, 1280]) {
    let page = await fresh(width);
    await login(page, 'master', 'master-pass-1');

    // Phases: the list, the next one offered from the dashboard's cycle, an edit
    await go(page, '#/phases', 0, 'main');
    await waitMain(page, /Kartik Phase/);
    let t = await text(page, 'main') || '';
    ok(/Kartik Phase/.test(t) && /\bNow\b/.test(t), `[${width}] ${W} Phases lists Kartik, marked Now`);
    await clickText(page, 'button', /Add phase/);
    await waitDlg(page, /Add a phase/);
    const prefill = await page.evaluate(() => ({ id: document.querySelector('#pz-id')?.value, name: document.querySelector('#pz-name')?.value, from: document.querySelector('#pz-from')?.value, to: document.querySelector('#pz-to')?.value }));
    ok(prefill.id === 'gaur-2027' && prefill.name === 'Gaur Purnima Phase' && prefill.from === '2027-01-01' && prefill.to === '2027-04-30',
      `[${width}] ${W} Add offers the next in the cycle, filled in (${JSON.stringify(prefill)})`);
    await clickText(page, 'dialog[open] button', /^Add phase$/);
    await waitMain(page, /Gaur Purnima Phase/);
    t = await text(page, 'main') || '';
    ok(/Gaur Purnima Phase/.test(t) && /\bNext\b/.test(t), `[${width}] ${W} the new phase is listed as Next`);
    ok(/Kartik Phase/.test(t) && /\bNow\b/.test(t), `[${width}] ${W} … and Kartik stays the current one`);
    await clickText(page, '.pz-list .lrow', /Kartik Phase/);
    await waitDlg(page, /Every card and board/);
    await page.$eval('#pz-to', (e) => { e.value = '2027-01-07'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
    await clickText(page, 'dialog[open] button', /^Save$/);
    await waitMain(page, /7 Jan 2027/);
    ok(/7 Jan 2027/.test(await text(page, 'main') || ''), `[${width}] ${W} an edited end date is saved and shown`);
    ok(!(await hScroll(page)), `[${width}] ${W} Phases: no sideways scroll`);
    await shot(page, `admin17-phases-${width}`);

    // Batch setup → SPS → Promotion rules
    await go(page, '#/batches', 0, 'main');
    await page.waitForSelector('.bt-row, .tbl-wide button', { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Edit SPS$/.test(b.getAttribute('aria-label') || '') && b.getClientRects().length)?.click());
    await waitDlg(page, /Promotion rules/);
    ok(/Promotion rules.*Standard/.test(await dlg(page)), `[${width}] ${W} a batch shows its promotion rules (standard)`);
    await clickText(page, 'dialog[open] .bt-rules', /Promotion rules/);
    await waitDlg(page, /Save rules/);
    await page.evaluate(() => { const box = [...document.querySelectorAll('dialog[open] .bt-rrow')].find((r) => /Night stay/.test(r.textContent))?.querySelector('input[type=checkbox]'); box?.click(); });
    await clickText(page, 'dialog[open] button', /^Save rules$/);
    await page.waitForFunction(() => !/Save rules/.test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    const after = await dlg(page);
    ok(/Promotion rules/.test(after) && !/Night stay/.test(after.split('Promotion rules')[1] || '') && !/Standard/.test(after.split('Promotion rules')[1]?.slice(0, 20) || ''),
      `[${width}] ${W} saving the batch's own rules: night stay gone, no longer Standard`);
    await shot(page, `admin17-rules-${width}`);
    await page.keyboard.press('Escape'); await sleep(300);

    // Staff → ⋯ → Make IYF head…
    // a phone: the person's ⋯ menu; a desktop (console pattern #10, 22 Oct 2026): the list beside the chosen person's
    // panel, whose actions are buttons, so the same step is one press there
    await go(page, '#/coordinators', 0, 'main');
    if (width >= 1024) {
      await page.waitForSelector('.co-pane .btn', { timeout: 10000 }).catch(() => {});
      const paneBtn = await page.evaluate(() => [...document.querySelectorAll('.co-pane .btn')].map((b) => b.textContent.trim()).find((t) => /Make IYF head…|Remove head access…/.test(t)) || '');
      ok(!!paneBtn, `[${width}] ${W} Staff offers head access in the chosen person's panel (${paneBtn})`);
      await clickText(page, '.co-pane .btn', /Make IYF head…|Remove head access…/);
    } else {
      await page.waitForSelector('[aria-label^="More for"]', { timeout: 10000 }).catch(() => {});
      await page.evaluate(() => [...document.querySelectorAll('[aria-label^="More for"]')].find((b) => b.getClientRects().length)?.click());
      await waitDlg(page, /head/i);
      ok(/Make IYF head…|Remove head access…/.test(await dlg(page)), `[${width}] ${W} Staff offers head access in a person's menu`);
      await clickText(page, 'dialog[open] .co-mi', /Make IYF head…|Remove head access…/);
    }
    await waitDlg(page, /Reason/);
    ok(/Every other active head is asked|They lose the Admin screens/.test(await dlg(page)), `[${width}] ${W} … with what happens next, and a reason asked`);
    await page.keyboard.press('Escape'); await sleep(300);

    // IYF IDs → Person records → merge two records of one person
    await go(page, '#/ids', 0, 'main');
    await clickText(page, 'button[aria-pressed]', /^Person records$/);
    await page.waitForSelector('#pid-q', { timeout: 8000 }).catch(() => {});
    await page.type('#pid-q', 'Dey');
    await page.waitForFunction(() => [...document.querySelectorAll('.pid-head')].some((b) => /Debojeet Dey/.test(b.textContent)), { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('.pid-head')].find((b) => /Debojeet Dey/.test(b.textContent) && !/Devesa/.test(b.textContent))?.click());
    await clickText(page, '.pid-more button', /Same person as another record/);
    await page.waitForSelector('[id^="pid-mq-"]', { timeout: 8000 }).catch(() => {});
    await page.type('[id^="pid-mq-"]', 'Devesa');
    await page.waitForFunction(() => document.querySelector('.pid-hits button'), { timeout: 8000 }).catch(() => {});
    await page.click('.pid-hits button').catch(() => {});
    await page.waitForSelector('.pid-two', { timeout: 8000 }).catch(() => {});
    const two = await page.$$eval('.pid-side', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' '))).catch(() => []);
    ok(two.length === 2 && /Debojeet Dey/.test(two[0]) && /IYFD-2020-0017/.test(two[1]), `[${width}] ${W} merge shows both records side by side`);
    ok(await page.$eval('.pid-side.keep', (e) => /IYFD-2020-0017/.test(e.textContent)).catch(() => false), `[${width}] ${W} … keeping the one with the IYFD by default`);
    await page.type('[id^="pid-mw-"]', 'Same person: given and initiated name, one phone family');
    await clickText(page, '.pid-act button', /^Merge into/);
    await page.waitForFunction(() => /Merged into/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    ok(/Merged into HG Devesa Hari Das/.test(await page.evaluate(() => document.body.innerText)), `[${width}] ${W} merged, and said so`);
    await shot(page, `admin17-merge-${width}`);

    // Leaderboard (ADR 0013): the head ranks all of IYF or any batch, by period
    await go(page, '#/leaderboard', 0, 'main');
    await waitMain(page, /devotee|No weeks to rank/);
    t = await text(page, 'main') || '';
    ok(/All of IYF Delhi/.test(await page.evaluate(() => document.querySelector('main').innerText + (document.querySelector('#lb-batch')?.value || '') + [...document.querySelectorAll('#lb-batch option, [id^=lb-batch]')].map((o) => o.textContent).join(' '))),
      `[${width}] ${W} the head's leaderboard offers all of IYF Delhi`);
    ok(/Week of .* · \d+ devotees?|No weeks to rank/.test(t), `[${width}] ${W} it opens on the last closed week (${t.slice(0, 80)})`);
    await clickText(page, 'button[aria-pressed]', /^Month$/);
    await waitMain(page, /Month/);
    ok(/Month/.test(await text(page, 'main') || ''), `[${width}] ${W} … and switches to a month`);
    ok(!(await hScroll(page)), `[${width}] ${W} Leaderboard: no sideways scroll`);
    await shot(page, `admin17-leaderboard-${width}`);

    // Facilitators (ADR 0014/0010): rename once everywhere; a trainee shows as temporary; a switched-off facilitator's
    // students become the head's decision
    await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); await call('enrol.add', { batchId: 'ETP-21', login: '6000000011' }).catch(() => {}); });
    await go(page, '#/facilitators', 0, '.fac-row');
    await page.waitForFunction(() => /until the training ends/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(/ETP · until the training ends/.test(await text(page, 'main') || '') && /Make lasting/.test(await text(page, 'main') || ''),
      `[${width}] ${W} a trainee facilitating shows as temporary, with Make lasting`);
    await page.evaluate(() => document.querySelector('button[aria-label="Rename Ankit Narula Prabhuji"]')?.click());
    await waitDlg(page, /Changes it everywhere/);
    await page.$eval('#fac-ren', (e) => { e.value = 'HG Ankit Narula Prabhuji'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await clickText(page, 'dialog[open] button', /^Rename$/);
    await page.waitForFunction(() => [...document.querySelectorAll('.fac-row .lt')].some((x) => x.textContent.trim() === 'HG Ankit Narula Prabhuji'), { timeout: 8000 }).catch(() => {});
    const fnames = await page.$$eval('.fac-row .lt', (l) => l.map((e) => e.textContent.trim()));
    ok(fnames.includes('HG Ankit Narula Prabhuji') && !fnames.includes('Ankit Narula Prabhuji'), `[${width}] ${W} renamed once, and the old name is gone from the list`);
    // the app is its own source (the head, 27 Oct 2026): the toast says who follows the new name, and sends nobody to the dashboard
    ok(/follows? the new name/.test(await page.evaluate(() => document.body.innerText)) && !/NameMap|Facilitator Dashboard/.test(await page.evaluate(() => document.body.innerText)), `[${width}] ${W} … and the head is told the students follow it (no dashboard, no "NameMap" on screen)`);
    await page.evaluate(() => [...document.querySelectorAll('.fac-row')].find((r) => r.querySelector('.lt').textContent.trim() === 'Vilasa Padmanabha Prabhuji')?.querySelector('input[role=switch]')?.click());
    await page.evaluate(async () => { location.hash = '#/overview'; }); await sleep(400);
    await go(page, '#/facilitators', 0, '.fac-row');
    await page.waitForSelector('.fac-orph', { timeout: 8000 }).catch(() => {});
    t = await text(page, '.fac-orph') || '';
    ok(/Needs a new facilitator · \d+/.test(t) && /was with Vilasa Padmanabha Prabhuji/.test(t), `[${width}] ${W} switching Vilasa off puts his students on "Needs a new facilitator" (${t.slice(0, 60)})`);
    const before = await page.$$eval('.fac-or', (l) => l.length);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.fac-or button')].find((x) => /Mark inactive/.test(x.textContent)); b?.click(); });
    await page.waitForFunction((n) => document.querySelectorAll('.fac-or').length < n, { timeout: 8000 }, before).catch(() => {});
    ok((await page.$$eval('.fac-or', (l) => l.length)) === before - 1, `[${width}] ${W} a decision takes the student off the list (${before} → ${before - 1})`);
    ok(!(await hScroll(page)), `[${width}] ${W} Facilitators: no sideways scroll`);
    await shot(page, `admin17-facilitators-${width}`);
    await go(page, '#/overview', 0, 'main'); await go(page, '#/home', 0, 'main');
    await page.waitForFunction(() => /need a new facilitator|All caught up/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(/need a new facilitator/.test(await text(page, 'main') || ''), `[${width}] ${W} Admin Home lists it among the decisions`);
    // put things back for the steps after: Vilasa on again, and Aarav out of the training
    await page.evaluate(async () => { const { call } = await import('/src/lib/api.js');
      await call('facilitators.setActive', { name: 'Vilasa Padmanabha Prabhuji', active: true }).catch(() => {});
      await call('enrol.remove', { batchId: 'ETP-21', login: '6000000011' }).catch(() => {}); });

    // a finished trainee's card reopened: enrol a devotee, close the training, open their page
    await page.evaluate(async () => {
      const { call } = await import('/src/lib/api.js');
      await call('enrol.add', { batchId: 'ETP-21', login: '6000000001' }).catch(() => {});
      await call('batches.close', { batchId: 'ETP-21', decisions: [{ login: '6000000001', decision: 'repeat' }] }).catch(() => {});
    });
    await go(page, '#/devotee/6000000001', 0, 'main');
    await waitMain(page, /Trainings/);
    t = await text(page, 'main') || '';
    ok(/Trainings/.test(t) && /ETP · Batch 21/.test(t) && /Finished/.test(t), `[${width}] ${W} the devotee's page keeps the finished training as a record`);
    await clickText(page, 'button', /Let them correct their card/);
    await page.waitForSelector('#dv-unl', { timeout: 8000 }).catch(() => {});
    await page.type('#dv-unl', 'Week of 12 Oct was typed in the wrong row');
    await clickText(page, 'button', /^Open their card$/);
    await page.waitForFunction(() => /open for corrections until/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    ok(/open for corrections until/.test(await page.evaluate(() => document.body.innerText)), `[${width}] ${W} the head opens it for 7 days, with a reason`);

    await page.browserContext().close();

    // a coordinator: Ready to move up
    page = await fresh(width);
    await login(page, 'sps', 'sps-pass-12');
    await go(page, '#/ready', 0, 'main');
    await waitMain(page, /Ready \(\d+\)/);
    t = await text(page, 'main') || '';
    ok(/Ready to move up/.test(t) && /Ready \(\d+\)/.test(t) && /Everyone \(\d+\)/.test(t), `[${width}] ${W} a coordinator sees who is ready to move up`);
    await clickText(page, 'button[aria-pressed]', /^Everyone/);
    await page.waitForSelector('.rd-row', { timeout: 8000 }).catch(() => {});
    ok((await page.$$('.rd-row')).length > 0 && /Not yet/.test(await text(page, 'main') || ''), `[${width}] ${W} … and, under Everyone, what each still needs`);
    ok(!(await hScroll(page)), `[${width}] ${W} Ready: no sideways scroll`);
    await shot(page, `admin17-ready-${width}`);

    // promote one devotee from their page (closing.js devoteePromote) — the mock had no handler, so this sheet could
    // not be checked at all (G15): SPS → DPS, on the coordinator's own ladder
    await go(page, '#/devotee/6000000013', 0, 'main');
    await clickText(page, 'button', /Promote to the next level/);
    await page.waitForSelector('#dv-promote', { timeout: 8000 }).catch(() => {});
    await sel(page, '#dv-promote', 'DPS');
    await clickText(page, 'button', /^Promote$/);
    await clickText(page, 'button', /^Yes, promote$/);
    await page.waitForFunction(() => /is now in DPS/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    ok(/is now in DPS/.test(await page.evaluate(() => document.body.innerText)), `[${width}] ${W} a coordinator promotes one devotee, SPS → DPS`);

    // the coordinator's own leaderboard: their batch only, no "All of IYF"
    await go(page, '#/leaderboard', 0, 'main');
    await waitMain(page, /devotee|No weeks to rank/);
    ok(!/All of IYF Delhi/.test(await page.evaluate(() => document.querySelector('main').innerText)), `[${width}] ${W} a coordinator's leaderboard is their batches only`);

    // Account → Devices → Sign out of every device (asked twice)
    await go(page, '#/account', 0, 'main');
    await clickText(page, 'button.lrow', /Devices/);
    await waitDlg(page, /Sign out of every device/);
    await clickText(page, 'dialog[open] button', /^Sign out of every device$/);
    await waitDlg(page, /this one too/);
    ok(/this one too/.test(await dlg(page)), `[${width}] ${W} signing out everywhere says it includes this phone first`);
    await clickText(page, 'dialog[open] button', /^Sign out everywhere now$/);
    await page.waitForFunction(() => /welcome|login/.test(location.hash), { timeout: 8000 }).catch(() => {});
    ok(/welcome|login/.test(await page.evaluate(() => location.hash)), `[${width}] ${W} … then every device, this one included, is signed out`);
    await page.browserContext().close();
  }
  // a devotee: their own place on Report, never anybody else's
  for (const width of [390, 1280]) {
    const page = await fresh(width);
    await login(page, '6000000001', 'pass-12345');
    // Sunil submits the week of 5 Oct, then the clock passes its deadline (Mon 12 Oct 9 PM): it is the last closed week
    await seedPractice(page, true);
    await page.evaluate(async () => (await import('/src/lib/mock.js')).setNow('2026-10-14T10:00:00+05:30'));
    await go(page, '#/home', 0, 'main'); await go(page, '#/report', 0, 'main');
    await page.waitForSelector('.rp-place', { timeout: 10000 }).catch(() => {});
    const place = await text(page, '.rp-place') || '';
    ok(/^\d+(st|nd|rd|th) of \d+ in your batch · week of 5 Oct/.test(place), `[${width}] ${W} Report: their own place for the last closed week (${place})`);
    ok(!/Aarav|Bhavesh|Chetan|%/.test(place), `[${width}] ${W} … a position only: no other name, no score`);
    ok(!(await hScroll(page)), `[${width}] ${W} Report: no sideways scroll`);
    await page.browserContext().close();
  }
}
if (!only || only === 'admin17') await part('admin17', async () => { await admin17(); });

// ADR 0015 (the head, 22 Oct 2026): Admin › Access gives and takes permissions per person, and the server enforces it;
// and Activity has one search box over thousands of lines.
async function access15() {
  const W = '[access15]';
  for (const width of [390, 1280]) {
    let page = await fresh(width);
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/access', 0, 'main');
    await page.waitForSelector('#acc-q', { timeout: 8000 }).catch(() => {});
    ok(/Everyone has what their role gives|Changed for/.test(await text(page, 'main') || ''), `[${width}] ${W} Access opens on who has a change (nobody yet)`);
    await page.type('#acc-q', 'SPS Team');
    await page.waitForFunction(() => [...document.querySelectorAll('main .lrow')].some((b) => /SPS Team/.test(b.textContent)), { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('main .lrow')].find((b) => /SPS Team/.test(b.textContent))?.click());
    await page.waitForSelector('.acc-caps', { timeout: 8000 }).catch(() => {});
    // ADR 0019 (Phase 22): the roles are a list of their own, each with its batches and a Revoke
    const roles = await text(page, '.acc-roles') || '';
    ok(/Coordinator/.test(roles) && /SPS/.test(roles) && /Revoke/.test(roles) && (await page.$$('.acc-caps li')).length >= 10, `[${width}] ${W} a person: their roles, and every capability (${roles.replace(/\s+/g, ' ').slice(0, 60)})`);
    await page.evaluate(() => [...document.querySelectorAll('.acc-cap')].find((b) => /Approve or reject sign-ups/.test(b.textContent))?.click());
    await page.waitForFunction(() => /As their role/.test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(!/\bGive\b/.test(await page.evaluate(() => document.querySelector('dialog[open] [role=group], dialog[open] .seg')?.innerText || '')),
      `[${width}] ${W} a capability that comes with a role can only be taken away, not given`);
    await clickText(page, 'dialog[open] button', /^Take away$/);
    await clickText(page, 'dialog[open] button', /^Save$/);
    await page.waitForFunction(() => /taken away from/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
    ok(/Taken away/.test(await text(page, '.acc-caps') || ''), `[${width}] ${W} taken away, and the list says so`);
    ok(!(await hScroll(page)), `[${width}] ${W} Access: no sideways scroll`);
    await shot(page, `access15-${width}`);
    // ADR 0019: "Give a role" — the role, its batches, and the rights it brings (ticked as the role gives them)
    await clickText(page, 'main button', /Give a role/);
    await page.waitForSelector('dialog[open] #acc-role', { timeout: 8000 }).catch(() => {});
    const gr = await page.evaluate(() => { const d = document.querySelector('dialog[open]'); const t = d?.innerText || '';
      return { role: /Coordinator/.test(t) && /Training coordinator/.test(t) && /FTP coordinator/.test(t), batches: /Batches/.test(t), rights: [...(d?.querySelectorAll('input[type=checkbox]') || [])].filter((c) => c.checked).length }; });
    // SPS Team already coordinates, so the sheet opens on the next role, training coordinator: its 4 rights ticked
    ok(gr.role && gr.batches && gr.rights === 4, `[${width}] ${W} Give a role: the roles, the batches and the role's rights ticked (${JSON.stringify(gr)})`);
    if (width === 390) await shot(page, 'access-give-role-390');
    await clickText(page, 'dialog[open] button', /^Cancel$/); await sleep(300);
    // the head's own case (27 Oct 2026): a devotee made SPS coordinator from Access — Save waits for a batch, then it
    // saves, the card shows the role, and the devotee's own login gets the coordinator's screens
    if (width === 390) {
      await clickText(page, '.acc-person button', /^Close$/); await sleep(300);
      await page.$eval('#acc-q', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.type('#acc-q', 'Sunil');
      await page.waitForFunction(() => [...document.querySelectorAll('main .lrow')].some((b) => /Sunil/.test(b.textContent)), { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => [...document.querySelectorAll('main .lrow')].find((b) => /Sunil/.test(b.textContent))?.click());
      await page.waitForSelector('.acc-person', { timeout: 8000 }).catch(() => {});
      const dcaps = await page.$$eval('.acc-caps li', (l) => l.map((x) => x.textContent));
      ok(dcaps.length > 0 && !dcaps.some((x) => /sign-ups|Reset passwords|Delete/.test(x)), `[${width}] ${W} a devotee's rights list only what applies to a devotee (${dcaps.length})`);
      await clickText(page, 'main button', /Give a role/);
      await page.waitForSelector('dialog[open] #acc-role', { timeout: 8000 }).catch(() => {});
      await page.evaluate(() => document.querySelector('dialog[open] input[type=radio][value=coordinator]')?.click()); await sleep(300);
      const save = () => page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /^(Give|Save)$/.test(b.textContent.trim())));
      ok(await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /^(Give|Save)$/.test(b.textContent.trim()))?.disabled === true), `[${width}] ${W} Give waits until a batch is ticked`);
      await page.evaluate(() => [...document.querySelectorAll('dialog[open] label')].find((l) => /^SPS$/.test(l.textContent.trim()))?.querySelector('input')?.click()); await sleep(200);
      await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /^(Give|Save)$/.test(b.textContent.trim()))?.click());
      await page.waitForFunction(() => !document.querySelector('dialog[open]') && /Coordinator/.test(document.querySelector('.acc-roles')?.textContent || ''), { timeout: 8000 }).catch(() => {});
      ok(/Coordinator/.test(await text(page, '.acc-roles') || '') && /given to/.test(await text(page, '.toasts') || ''), `[${width}] ${W} it saves: the role is on the card and the toast says so`);
      if (width === 390) await shot(page, 'access-given-390');
      const sc = await page.evaluate(async () => { const m = await import('/src/lib/mock.js');
        const t = (await m.handle({ v: 1, action: 'auth.login', requestId: crypto.randomUUID(), data: { login: '6000000001', password: 'pass-12345' } })).data.token;
        return (await m.handle({ v: 1, action: 'auth.me', token: t, data: {} })).data.user.scopes.coordinator; });
      ok(sc.includes('SPS'), `[${width}] ${W} and the devotee's own login now coordinates SPS (${JSON.stringify(sc)})`);
    }
    // the server enforces it: the coordinator's approval is refused
    const r = await page.evaluate(async () => { const m = await import('/src/lib/mock.js');
      const t = (await m.handle({ v: 1, action: 'auth.login', requestId: crypto.randomUUID(), data: { login: 'sps', password: 'sps-pass-12' } })).data.token;
      return (await m.handle({ v: 1, action: 'requests.approve', token: t, requestId: crypto.randomUUID(), data: { phone: '6000000150', link: { noIdYet: true } } })).error?.message || 'ok'; });
    ok(/turned this off/.test(r), `[${width}] ${W} … and the coordinator's approval is refused (${r})`);
    // Activity: one search box
    await go(page, '#/activity', 0, 'main');
    await page.waitForSelector('#ac-q', { timeout: 8000 }).catch(() => {});
    ok(!!(await page.$('#ac-q')), `[${width}] ${W} Activity has a search box`);
    await page.type('#ac-q', 'zzqq-nothing');
    await page.waitForFunction(() => /No activity|Nothing|No lines/i.test(document.querySelector('main')?.innerText || '') || !document.querySelector('.ac-row'), { timeout: 8000 }).catch(() => {});
    ok(!(await page.$('.ac-row')), `[${width}] ${W} a search that matches nothing shows no lines`);
    await page.browserContext().close();
  }
}
if (!only || only === 'access15') await part('access15', async () => { await access15(); });

// The D lane (22 Oct 2026, from prompt-5b): fewer taps on the Day form and the boards, and screens that remember.
async function dlane() {
  const W = '[dlane]';
  for (const width of [390, 1280]) {
    // the browser's clock and the mock's on Sunday 11 Oct, while the week of 5 Oct is still open
    let page = await fresh(width, { clock: '2026-10-11T19:00:00+05:30' });
    await login(page, '6000000001', 'pass-12345');
    // seed: only Sunil's Monday of the week of 5 Oct (16 rounds); Tuesday stays open and empty
    await page.evaluate(async () => {
      const m = await import('/src/lib/mock.js');
      const call = async (token, action, data) => { const r = await m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r.error)); return r.data; };
      const t = (await call(undefined, 'auth.login', { login: '6000000001', password: 'pass-12345' })).token;
      await call(t, 'week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day: { sleptAt: '22:10', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 20, serviceMin: 60, hearingMin: 30, hearing: [{ text: 'Japa workshop' }], readingMin: 20, reading: { text: 'Bhagavad-gita As It Is' } } });
    });
    // the page's Home copy was read at sign-in, before the seed: read it again, as a return to the app would
    await page.evaluate(async () => (await import('/src/lib/weekstore.js')).loadHome(true));
    await go(page, '#/day/2026-10-05/2026-10-06', 0, '#f-sleptAt-btn');
    // D1: the visible tap copies times, rounds and book — never on its own
    ok(await page.$eval('#rounds', (e) => e.value === '').catch(() => false), `[${width}] ${W} Tuesday starts empty: nothing is pre-filled`);
    await clickText(page, 'button', /^Same as yesterday/);
    await sleep(300);
    ok((await page.$eval('#rounds', (e) => e.value).catch(() => '')) === '16', `[${width}] ${W} "Same as yesterday" copies the rounds too (D1)`);
    // D2: Enter in a number field moves on, with "next" on the keypad
    ok((await page.$eval('#rounds', (e) => e.getAttribute('enterkeyhint')).catch(() => '')) === 'next', `[${width}] ${W} the keypad says Next (D2)`);
    await page.focus('#dayRestMin'); await page.keyboard.press('Enter'); await sleep(250);
    ok(await page.evaluate(() => document.activeElement?.id !== 'dayRestMin' && !!document.activeElement?.closest('.dform')), `[${width}] ${W} Enter moves to the next answer (D2)`);
    if (width < 1024) {
      // D3: the section bar, under the day strip
      const chips = await page.$$eval('.jumpbar .jchip', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
      ok(chips.some((c) => /^Body/.test(c)) && chips.some((c) => /^Comment/.test(c)) && chips.some((c) => /Scoring/.test(c)), `[${width}] ${W} the section bar lists the sections and Scoring (D3: ${chips.join(' · ')})`);
      await page.evaluate(() => [...document.querySelectorAll('.jchip')].find((b) => /^Reading/.test(b.textContent))?.click()); await sleep(700);
      ok(await page.$eval('#h-read', (h) => { const r = h.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight / 2; }).catch(() => false), `[${width}] ${W} a section chip jumps to its section`);
      // save before leaving, as a person would (leaving with changes asks first, and the check would stay on the Day)
      await page.evaluate(() => [...document.querySelectorAll('.actionbar button')].find((b) => /^Save/.test(b.textContent.trim()) && !b.disabled)?.click());
      await page.waitForFunction(() => /Saved/.test(document.querySelector('.actionbar')?.innerText || ''), { timeout: 6000 }).catch(() => {});
    } else {
      // C8: the rail beside the form; the floating bar is gone; Ctrl/⌘ S still saves
      ok(await page.$eval('.dayrail', (e) => e.getClientRects().length > 0).catch(() => false) && !(await page.$eval('.actionbar', (e) => e.getClientRects().length > 0).catch(() => true)),
        `[${width}] ${W} the desktop rail is shown, the floating bar is not (C8)`);
      ok(/Day score/.test(await text(page, '.dayrail') || '') && /Scoring/.test(await text(page, '.dayrail') || ''), `[${width}] ${W} … with the score, the sections and Scoring`);
      await page.keyboard.down('Control'); await page.keyboard.press('s'); await page.keyboard.up('Control');
      await page.waitForFunction(() => /Saved/.test(document.querySelector('.dayrail')?.innerText || ''), { timeout: 6000 }).catch(() => {});
      ok(/Saved/.test(await text(page, '.dayrail') || ''), `[${width}] ${W} Ctrl+S saves from the rail`);
    }
    ok(!(await hScroll(page)), `[${width}] ${W} Day: no sideways scroll`);
    await shot(page, `dlane-day-${width}`);
    // D7: Reading remembers the open book and the scroll
    await go(page, '#/reading', 0, '.bk-list');
    await page.waitForSelector('.bk[data-level]', { timeout: 25000 }).catch(() => {});   // the books, not just their list (a cold dev server compiles Reading on first use)
    const lv = await page.$$eval('.bk[data-level]', (l) => l.length).catch(() => 0);
    ok(lv > 0, `[${width}] ${W} every book carries its level (data-level, for the colour band) (${lv})`);
    const opened = await page.evaluate(() => { const d = document.querySelector('details.bk'); if (!d) return ''; d.open = true; d.dispatchEvent(new Event('toggle')); return d.querySelector('.t')?.textContent.trim() || 'x'; });
    await go(page, '#/home', 0, 'main'); await go(page, '#/reading', 0, '.bk-list'); await sleep(400);
    ok(!opened || await page.evaluate((t) => [...document.querySelectorAll('details.bk')].some((d) => d.open && d.querySelector('.t')?.textContent.trim() === t), opened),
      `[${width}] ${W} Reading opens the book left open last time (D7${opened ? ': ' + opened : ': no multi-file book in this list'})`);
    await page.browserContext().close();

    // D4 + D5: the coordinator's board
    page = await fresh(width);
    await login(page, 'sps', 'sps-pass-12');
    await go(page, '#/batch', 0, 'li.brow');
    const nudge = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Nudge \d+ not started/.test(b.textContent.trim()))?.textContent.trim() || '');
    if (nudge) {
      await clickText(page, 'button', /^Nudge \d+ not started/);
      await page.waitForFunction(() => /WhatsApp/.test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 6000 }).catch(() => {});
      const href = await page.$eval('dialog[open] a.btn-primary', (a) => a.href).catch(() => '');
      ok(/^https:\/\/wa\.me\/91\d{10}\?text=Hare%20Krishna/.test(href), `[${width}] ${W} Nudge: one person at a time, the reminder already written (D4)`);
      await page.keyboard.press('Escape'); await sleep(300);
    } else ok(false, `[${width}] ${W} Nudge: the button is missing — the mock's board has devotees who have not started, so it must show (D4)`);
    const before = await text(page, '#bd-wk-pick');
    await page.keyboard.press('['); await sleep(800);
    ok((await text(page, '#bd-wk-pick')) !== before, `[${width}] ${W} [ moves the board a week back (D6)`);
    await page.browserContext().close();
  }
}
if (!only || only === 'dlane') await part('dlane', async () => { await dlane(); });

if (!only || only === 'oct9') await part('oct9', async () => { await phase3(); });
if (!only || only === 'oct8') await part('oct8', async () => { await phase0(); });
if (!only || only === 'oct8') await part('oct8', async () => { await oneTopic(); });

// Phase 8: filter chips (Hearing slots, Reading levels) and the Report colour key each stay on one line; a chip row
// that doesn't fit scrolls sideways inside itself (the page never scrolls sideways) and shows its chosen chip whole.
// Account names the build the phone runs (the store apps are shown to be up to date by it).
async function phase8() {
  const lines = (page, sel) => page.$eval(sel, (e) => new Set([...e.children].map((c) => Math.round(c.getBoundingClientRect().top))).size).catch(() => -1);
  for (const w of [320, 360, 390, 820, 1280]) {
    const page = await fresh(w);
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/hearing', 0, 'button[aria-pressed]');
    await clickText(page, 'button[aria-pressed]', /^All weeks$/);
    await page.waitForSelector('[aria-label="Slot"]', { timeout: 8000 }).catch(() => {});
    ok(await lines(page, '[aria-label="Slot"]') === 1, `[${w} phase8] Hearing: the slot chips are on one line`);
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(await wide(), `[${w} phase8] Hearing: the page doesn't scroll sideways`);
    await go(page, '#/reading', 0, '[aria-label="Level"]');
    ok(await lines(page, '[aria-label="Level"]') === 1, `[${w} phase8] Reading: the level chips are on one line`);
    ok(await page.$eval('[aria-label="Level"]', (row) => { const b = row.querySelector('[aria-pressed="true"]'); if (!b) return false; const r = row.getBoundingClientRect(), e = b.getBoundingClientRect(); return e.left >= r.left - 1 && e.right <= r.right + 1; }).catch(() => false), `[${w} phase8] Reading: the chosen level chip is shown whole`);
    ok(await wide(), `[${w} phase8] Reading: the page doesn't scroll sideways`);
    await go(page, '#/report', 0, '.cal-key');
    ok(await page.$$eval('.cal-key', (ks) => ks.length === 2 && ks.every((k) => new Set([...k.children].map((c) => Math.round(c.getBoundingClientRect().top))).size === 1)).catch(() => false), `[${w} phase8] Report: the colour key is two rows (scores, empty days), each on one line`);
    await go(page, '#/account', 0, '.app-build');
    ok(/^App 20\d\d\.\d\d\.\d\d-\d{4}$|^App dev$/.test((await text(page, '.app-build')) || ''), `[${w} phase8] Account: shows the app version`);
    if (w === 390) await page.screenshot({ path: `${OUT}/phase8-account-${w}.png`, fullPage: true });
    await page.browserContext().close();
  }
}
if (!only || only === 'phase8') await part('phase8', async () => { await phase8(); });

// Account deletion (5 Oct 2026; docs/account-deletion-plan.md): a devotee deletes their own account from Account (the
// password and the word DELETE), lands on the welcome screen with nothing of them left on the phone, and can't sign in
// again; staff see why they can't; the public page for Google Play loads under the site's CSP with no errors.
async function deletion() {
  const { readFileSync } = await import('node:fs');
  const CSP = readFileSync(new URL('../../frontend/public/_headers', import.meta.url), 'utf8').match(/Content-Security-Policy: (.*)/)[1].trim();
  const retype = async (page, sel, v) => { await page.click(sel, { clickCount: 3 }); await page.keyboard.press('Backspace'); if (v) await page.type(sel, v); };
  const submitOff = (page) => page.$eval('dialog.da-sheet button[type=submit]', (b) => b.disabled).catch(() => null);
  for (const w of [390, 1280]) {
    const W = `[${w} deletion]`;
    const page = await fresh(w);
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/account', 0, '#h-del');
    await page.waitForFunction(() => document.querySelectorAll('.esec-view').length >= 5, { timeout: 8000 }).catch(() => {});
    const s = await page.evaluate(() => {
      // 8 Oct 2026: Delete is a row in the settings list (it opens the sheet); the data page is a row above it
      const sec = document.querySelector('#h-del'), out = document.querySelector('.btn-danger.btn-block');
      return { plain: !sec.classList.contains('esec'), btn: sec.querySelector('.acc-del .lt')?.textContent.trim() || '', link: !!document.querySelector('.acc-rows a[href="/delete-account.html"]'),
        before: !!(sec.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING), esec: document.querySelectorAll('.esec-view').length, build: !!out.parentElement.querySelector('.app-build') };
    });
    ok(s.plain && s.btn === 'Delete my account…' && s.before, `${W} devotee: a "${s.btn}" row in the settings list, before Log out`);
    ok(s.link, `${W} … with a "What happens to my data" link to the public page`);
    ok(s.esec === 5 && s.build, `${W} still exactly 5 .esec-view sections (${s.esec}) and the App build line`);
    ok(!(await page.$('dialog.da-sheet')), `${W} the sheet's code is not loaded before the button is pressed`);
    // the button in the middle of the screen first: on a phone the profile above it loads late and moves it, and a tap
    // that lands on the bottom bar opens nothing (seen in the full run under load)
    await page.$eval('.acc-del', (b) => b.scrollIntoView({ block: 'center' })); await sleep(300);
    await page.click('.acc-del');
    if (!(await page.waitForSelector('dialog.da-sheet[open]', { timeout: 5000 }).catch(() => null))) {
      await page.$eval('.acc-del', (b) => b.click());
      await page.waitForSelector('dialog.da-sheet[open]', { timeout: 15000 }).catch(() => {});
    }
    await sleep(500);                                  // the sheet slides in
    ok(!!(await page.$('dialog.da-sheet[open]')), `${W} the button opens the Delete sheet`);
    const copy = await text(page, 'dialog.da-sheet');
    ok(/Deleted/.test(copy) && /without your name, phone number or IYF ID/.test(copy) && /can't be undone/.test(copy), `${W} the sheet says what is deleted, what is kept and that it can't be undone`);
    ok(await submitOff(page), `${W} Delete is disabled with both fields empty`);
    await page.type('#da-pw', 'wrong-pass-1');
    ok(await submitOff(page), `${W} … and with only the password`);
    await page.type('#da-word', 'DELETE');
    ok(!(await submitOff(page)), `${W} … and on once both are filled`);
    await page.click('dialog.da-sheet button[type=submit]');
    await page.waitForSelector('#da-pw-e', { timeout: 8000 }).catch(() => {});
    ok((await text(page, '#da-pw-e')) === 'Your password is wrong.', `${W} a wrong password: "${await text(page, '#da-pw-e')}" under the password`);
    await retype(page, '#da-pw', 'pass-12345'); await retype(page, '#da-word', 'DELET');
    await page.click('dialog.da-sheet button[type=submit]');
    await page.waitForSelector('#da-word-e', { timeout: 8000 }).catch(() => {});
    ok((await text(page, '#da-word-e')) === 'Type DELETE to confirm.' && !(await page.$('#da-pw-e')), `${W} without DELETE: "${await text(page, '#da-word-e')}" under the confirm field`);
    await retype(page, '#da-word', 'delete');
    await page.click('dialog.da-sheet button[type=submit]');
    await page.waitForFunction(() => location.hash === '#/welcome' && document.querySelector('.welcome') && /Your account has been deleted\./.test(document.querySelector('.toast')?.textContent || ''), { timeout: 10000 }).catch(() => {});
    const after = await page.evaluate(async () => ({ hash: location.hash, welcome: !!document.querySelector('.welcome'), toast: document.querySelector('.toast')?.textContent.trim() || '',
      token: localStorage.getItem('sr.token'), user: localStorage.getItem('sr.user'), mine: Object.keys(localStorage).filter((k) => k.includes('6000000001')),
      idb: (await (await import('/src/lib/idb.js')).idbKeys('')).filter((k) => k.includes('6000000001') || k.startsWith('c:')) }));
    ok(after.hash === '#/welcome' && after.welcome && after.toast === 'Your account has been deleted.', `${W} deleted: the welcome screen (${after.hash}) with "${after.toast}"`);
    ok(after.token === null && after.user === null && !after.mine.length, `${W} localStorage: no sr.token, no sr.user, no key of that login (${after.mine.join(', ') || 'none'})`);
    ok(!after.idb.length, `${W} IndexedDB: no key of that login (${after.idb.join(', ') || 'none'})`);
    if (w === 390) await page.screenshot({ path: `${OUT}/deletion-welcome-${w}.png` });
    await go(page, '#/login', 0, '#login');
    await page.type('#login', '6000000001'); await page.type('#password', 'pass-12345'); await page.click('button[type=submit]');
    await page.waitForFunction(() => /wrong/i.test(document.querySelector('[role=alert]')?.textContent || ''), { timeout: 8000 }).catch(() => {});
    ok(/wrong/i.test((await text(page, '[role=alert]')) || '') && (await page.evaluate(() => location.hash)) !== '#/home', `${W} signing in again with that phone fails ("${await text(page, '[role=alert]')}")`);
    await page.browserContext().close();
    // staff: why they can't, and no button
    for (const [l, p, who] of [['sps', 'sps-pass-12', 'coordinator'], ['master', 'master-pass-1', 'IYF head'], ['natvar', 'natvar-pass-1', 'facilitator']]) {
      const sp = await fresh(w);
      await login(sp, l, p);
      await go(sp, '#/account', 0, '#h-del');
      const t = await sp.evaluate(() => { const sec = document.querySelector('#h-del'); return { text: sec?.textContent.replace(/\s+/g, ' ').trim() || '', btn: !!sec?.querySelector('.acc-del, button') }; });
      ok(t.text.includes(who) && /remove your role first/.test(t.text) && !t.btn, `${W} ${l}: the explanation ("…${who}…remove your role first…"), no button`);
      await sp.browserContext().close();
    }
  }
  // the public page (Google Play): under the site's own CSP (public/_headers), no console or CSP errors, no sideways scroll
  for (const w of [360, 1280]) {
    const W = `[${w} deletion page]`;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
    const bad = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.text()); });
    page.on('pageerror', (e) => bad.push(e.message));
    page.on('requestfailed', (r) => bad.push('failed ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await page.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    await page.setRequestInterception(true);
    page.on('request', async (r) => {
      if (!r.url().endsWith('/delete-account.html')) return r.continue();
      const res = await fetch(r.url());
      r.respond({ status: res.status, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP }, body: await res.text() });
    });
    await page.goto(BASE + '/delete-account.html', { waitUntil: 'networkidle0' });
    const p = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), csp: window.__csp, styled: getComputedStyle(document.querySelector('section')).borderRadius !== '0px',
      wide: document.documentElement.scrollWidth > innerWidth + 1, home: !!document.querySelector('a[href="/"]'), mail: !!document.querySelector('a[href^="mailto:iyfdelhi.database@gmail.com"]') }));
    ok(p.h1 === 'Delete your Sadhana Record account' && p.styled, `${W} loads, styled by legal.css: "${p.h1}"`);
    ok(!p.csp.length && !bad.length, `${W} no CSP or console errors (${[...p.csp, ...bad].join('; ') || 'none'})`);
    ok(!p.wide && p.home && p.mail, `${W} no sideways scroll; links to the app and the contact email`);
    await ctx.close();
  }
}
if (!only || only === 'deletion') await part('deletion', async () => { await deletion(); });

/* Share sadhana (27 Oct 2026; worker/src/shares.js, lib/mockshare.js). The mock devotee 6000000001 (Sunil Kumar) has
   shared with Raman Das and Aarav Gupta (6000000011) has shared with him. As Sunil: the facilitator comes first with its
   pill and no Remove; add Bhavesh Jain by phone and see "Bhavesh J." to confirm; open Aarav's shared report (by its share id,
   never his phone) and a week as the viewer, with no call or chat; remove Bhavesh; drop Aarav from "Shared with me" and the link then says so. */
async function share() {
  for (const w of [390, 1280]) {
    const W = `[${w} share]`, page = await fresh(w);
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/share', 0, '#sh-phone');
    const wide = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const rowsNow = () => page.$$eval('.sh-list .sh-row', (l) => l.map((r) => ({ name: r.querySelector('.sh-name')?.textContent.trim(), kind: r.dataset.kind || '',
      pill: r.querySelector('.pill')?.textContent.trim() || '', remove: !!r.querySelector('button') })));
    let rs = await rowsNow();
    ok(rs[0]?.kind === 'facilitator' && rs[0].name === 'Natvar Gopinath Prabhuji' && rs[0].pill === 'Facilitator' && !rs[0].remove, `${W} the facilitator comes first, with the pill and no Remove: ${JSON.stringify(rs[0])}`);
    ok(rs.some((r) => r.name === 'Raman D.' && r.remove), `${W} the person already shared with, masked, with Remove`);
    ok(!(await wide()), `${W} no sideways scroll`);

    // add by phone: Find → the confirm name → Share
    await page.$eval('#sh-phone', (el) => { el.focus(); el.value = '6000000012'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('.sh-find button[type=submit]');
    await page.waitForSelector('dialog[open]', { timeout: 8000 }).catch(() => {});
    const asked = await text(page, 'dialog[open] h2, dialog[open] [id="sh-ask-t"]');
    ok(asked === 'Share with Bhavesh J.?', `${W} the confirm shows first name and last initial: "${asked}"`);
    await shot(page, `share-confirm-${w}`);
    ok(await clickText(page, 'dialog[open] button', /^Share$/), `${W} Share in the sheet`);
    await page.waitForFunction(() => [...document.querySelectorAll('.sh-list .sh-name')].some((e) => e.textContent.trim() === 'Bhavesh J.'), { timeout: 8000 }).catch(() => {});
    rs = await rowsNow();
    ok(rs.map((r) => r.name).join('|') === 'Natvar Gopinath Prabhuji|Raman D.|Bhavesh J.', `${W} listed at once: ${rs.map((r) => r.name).join(', ')}`);
    await shot(page, `share-mine-${w}`);

    // the viewer's side: Aarav's report by its share id (shareAarav), read-only, no contact and no phone
    await go(page, '#/share/with-me', 0, 'a[href="#/shared/shareAarav"]');
    ok(!(await wide()), `${W} Shared with me: no sideways scroll`);
    await shot(page, `share-withme-${w}`);
    await page.click('a[href="#/shared/shareAarav"]');
    await page.waitForSelector('#fd-h', { timeout: 8000 }).catch(() => {});
    const rep = await page.evaluate(() => ({ name: document.getElementById('fd-h')?.textContent.trim(), pill: document.querySelector('.fd-chip')?.textContent.trim(),
      contact: document.querySelectorAll('a[href^="tel:"], a[href*="wa.me"], a[href*="whatsapp"]').length, weeks: document.querySelectorAll('a[href^="#/shared/shareAarav/"]').length,
      list: !!document.querySelector('.fc-list'), digits: (document.body.innerText.match(/\d{10}/g) || []).concat([...document.querySelectorAll('a[href]:not([href^="mailto:"])')].flatMap((a) => a.getAttribute('href').match(/\d{10}/g) || [])) }));
    ok(rep.name === 'Aarav Gupta' && rep.pill === 'Shared with you', `${W} the shared report opens: ${rep.name} · ${rep.pill}`);
    ok(!rep.digits.length, `${W} no phone number on the page or in its links (${rep.digits.join(', ') || 'none'})`);
    ok(rep.contact === 0 && !rep.list, `${W} no call, no chat, no student list (${rep.contact} contact links)`);
    ok(rep.weeks > 1, `${W} their weeks are there (${rep.weeks} links)`);
    ok(!(await wide()), `${W} the report: no sideways scroll`);
    await shot(page, `share-report-${w}`);
    // the first week's own link, followed (a click could land on the pinned search band or the bottom bar over it)
    const firstWeek = await page.$eval('a[href^="#/shared/shareAarav/"]', (a) => a.getAttribute('href'));
    await page.evaluate((h) => { location.hash = h; }, firstWeek);
    await page.waitForSelector('.wr-step a', { timeout: 8000 }).catch(() => {});
    const step = await page.$$eval('.wr-step a', (l) => l.map((a) => a.getAttribute('href')));
    ok(step.length > 0 && step.every((h) => h.startsWith('#/shared/shareAarav/')), `${W} a week opens, and its ‹ › stay on the shared route: ${step.join(' ')}`);

    // remove: the owner stops sharing with Bhavesh
    await go(page, '#/share', 0, '#sh-phone');
    await page.click('button[aria-label="Remove Bhavesh J."]');
    await page.waitForSelector('dialog[open]', { timeout: 8000 }).catch(() => {});
    ok((await text(page, 'dialog[open] h2, dialog[open] [id="sh-ask-t"]')) === 'Stop sharing with Bhavesh J.?', `${W} removing asks first`);
    ok(await clickText(page, 'dialog[open] button', /^Remove$/), `${W} Remove in the sheet`);
    await page.waitForFunction(() => ![...document.querySelectorAll('.sh-list .sh-name')].some((e) => e.textContent.trim() === 'Bhavesh J.'), { timeout: 8000 }).catch(() => {});
    rs = await rowsNow();
    ok(!rs.some((r) => r.name === 'Bhavesh J.') && rs[0]?.kind === 'facilitator', `${W} gone; the facilitator stays: ${rs.map((r) => r.name).join(', ')}`);

    // leave: Aarav off my list, and his link answers "Not shared with you"
    await go(page, '#/share/with-me', 0, 'button[aria-label="Remove Aarav Gupta from my list"]');
    await page.click('button[aria-label="Remove Aarav Gupta from my list"]');
    await page.waitForSelector('dialog[open]', { timeout: 8000 }).catch(() => {});
    ok(await clickText(page, 'dialog[open] button', /^Remove$/), `${W} Remove from my list`);
    await page.waitForFunction(() => !document.querySelector('a[href="#/shared/shareAarav"]'), { timeout: 8000 }).catch(() => {});
    ok(!(await page.$('a[href="#/shared/shareAarav"]')), `${W} off the list`);
    await go(page, '#/shared/shareAarav', 0, '.empty .e-title');
    ok((await text(page, '.empty .e-title')) === 'Not shared with you', `${W} the old link is refused at once`);
    await page.browserContext().close();
  }
}
if (!only || only === 'share') await part('share', async () => { await share(); });

/* Birthdays on Home (27 Oct 2026; worker weeks.js homeGet, lib/mockstaff.js birthdaysIn). The mock seeds Bhavesh Jain
   (SPS) on today. A devotee of SPS sees one quiet line, by name only; on their own birthday "Happy birthday, Sunil!" comes
   first. A coordinator and the head keep their Birthdays card (age, the next 7 days) and get no line. */
async function birthday() {
  for (const w of [390, 1280]) {
    const W = `[${w} birthday]`;
    let page = await fresh(w);
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/home', 0, '.bday');
    const line = await text(page, '.bday');
    ok(line === "Today is Bhavesh Jain's birthday", `${W} a batch-mate's birthday by name: "${line}"`);
    ok(!/\d/.test(line || '1'), `${W} no age, no date, no number`);
    const box = await page.evaluate(() => { const b = document.querySelector('.bday').getBoundingClientRect(), h = document.querySelector('.hero-card')?.getBoundingClientRect();
      return { wide: document.documentElement.scrollWidth > innerWidth + 1, above: !h || b.bottom <= h.top + 1, tall: b.height }; });
    ok(!box.wide && box.above && box.tall < 90, `${W} near the top, above the week, small, no sideways scroll: ${JSON.stringify(box)}`);
    await shot(page, `birthday-${w}`);
    await page.browserContext().close();

    // their own birthday: "Happy birthday" first, the batch-mate after it
    page = await fresh(w);
    await page.evaluate(async () => {
      const m = await import('/src/lib/mock.js'), day = new Date(Date.parse(window.__mock.now()) + 5.5 * 3600e3).toISOString().slice(5, 10);
      m._patchUser('6000000001', { profile: { dob: '2002-' + day, bloodGroup: 'B+', emergency: { name: 'Ramesh Kumar', relation: 'Father', phone: '6000000077' } } });
    });
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/home', 0, '.bday');
    const mine = await page.evaluate(() => ({ b: document.querySelector('.bday b')?.textContent.trim(), all: document.querySelector('.bday').textContent.replace(/\s+/g, ' ').trim() }));
    ok(mine.b === 'Happy birthday, Sunil!' && /Bhavesh Jain's birthday$/.test(mine.all), `${W} their own birthday first: "${mine.all}"`);
    await shot(page, `birthday-self-${w}`);
    await page.browserContext().close();

    // staff keep their card, with no line: the coordinator, then the head
    for (const [l, p] of [['sps', 'sps-pass-12'], ['master', 'master-pass-1']]) {
      page = await fresh(w);
      await login(page, l, p);
      await go(page, '#/home', 0, '#h-bd');
      const st = await page.evaluate(() => ({ card: !!document.getElementById('h-bd'), line: !!document.querySelector('.bday'), age: /\d+ today/.test(document.getElementById('h-bd')?.closest('section')?.textContent || '') }));
      ok(st.card && st.age && !st.line, `${W} ${l}: the Birthdays card, with age, unchanged; no Home line (${JSON.stringify(st)})`);
      await page.browserContext().close();
    }
  }
}
if (!only || only === 'birthday') await part('birthday', async () => { await birthday(); });
// Phase 23 (ADR 0020): automatic inactive replaces the "Inactive?" requests. A coordinator's mark shows on Home (the
// notices) and in the bell; Batch › Filling chart and Admin › All batches carry the analysis (now, by month, by day);
// Requests has no "Inactive?" tab and the facilitator's list no request block.
async function autoInactive() {
  for (const width of [390, 1280]) {
    const W = `[${width} auto-inactive]`;
    const wideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    let page = await fresh(width);
    await login(page, 'sps', 'sps-pass-12');
    await go(page, '#/devotee/6000000013', 1200, '#dv-name');
    await clickText(page, 'button', /^Mark inactive$/);
    await clickText(page, '.confirm button', /^Mark inactive$/);
    await page.waitForFunction(() => /Inactive from/.test(document.querySelector('.content')?.textContent || ''), { timeout: 8000 }).catch(() => {});
    ok(/their login still works/.test(await text(page, '.content') || ''), `${W} marking inactive says the login stays`);
    await go(page, '#/home', 0, '#an-h');
    const notes = await page.evaluate(() => [...document.querySelectorAll('section[aria-labelledby=an-h] .lt')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    ok(notes.some((t) => /^Chetan Arora is inactive/.test(t)), `${W} Home names who became inactive (${notes.join(' | ')})`);
    ok(!(await page.$('a[href="#/requests?type=inactive"]')), `${W} no "Inactive?" request row`);
    ok(!(await wideScroll(page)), `${W} Home: no sideways scroll`);
    await shot(page, `auto-inactive-home-${width}`);
    await go(page, '#/stats', 0, '#as-h');
    await page.waitForSelector('.as-tbl', { timeout: 10000 }).catch(() => {});
    const a = await page.evaluate(() => ({ rows: document.querySelectorAll('.as-tbl tbody tr').length, inactive: [...document.querySelectorAll('.as-tbl a')].some((x) => /status=INACTIVE/.test(x.getAttribute('href') || '')),
      lines: document.querySelectorAll('section.as svg polyline').length, month: !!document.querySelector('[id^=as-m-]') }));
    ok(a.rows >= 1 && a.inactive && a.month, `${W} Filling chart: active and inactive now, with a link to the names, and a month to pick (${JSON.stringify(a)})`);
    ok(a.lines >= 1, `${W} the month-by-month trend is drawn`);
    ok(!(await wideScroll(page)), `${W} Filling chart: no sideways scroll`);
    await shot(page, `auto-inactive-stats-${width}`);
    await go(page, '#/requests', 0, '.rq-types');
    ok(!(await page.evaluate(() => [...document.querySelectorAll('.rq-types button')].some((b) => /Inactive/.test(b.textContent)))), `${W} Requests: no "Inactive?" tab`);
    await page.browserContext().close();
    // the head: All batches carries the same analysis, all of IYF Delhi, and Home the notice
    page = await fresh(width);
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/overview', 0, '#as-h');
    await page.waitForSelector('.as-tbl', { timeout: 10000 }).catch(() => {});
    const rows = await page.evaluate(() => document.querySelectorAll('.as-tbl tbody tr').length);
    ok(rows >= 3, `${W} Admin › All batches: active and inactive for every batch (${rows} rows)`);
    ok(!(await wideScroll(page)), `${W} All batches: no sideways scroll`);
    await shot(page, `auto-inactive-overview-${width}`);
    await page.browserContext().close();
    // the facilitator decides nothing any more
    page = await fresh(width);
    await login(page, 'natvar', 'natvar-pass-1');
    await go(page, '#/my-devotees', 1500, 'main');
    ok(!(await page.$('#ia-h')), `${W} My students: no "Inactive?" block`);
    await page.browserContext().close();
  }
}
if (!only || only === 'autoInactive') await part('autoInactive', async () => { await autoInactive(); });

// Asking to start a batch (Phase 23; the head, 27 Oct 2026): a coordinator asks on Batch status › New batch, the head
// approves it from Requests › New batches (Batch setup's own form, pre-filled), and the new batch is the coordinator's —
// the request reads Started and its tabs appear. One page per width: the mock's state lives in the page.
async function batchreq() {
  for (const width of [390, 1280]) {
    const W = `[${width} batchreq]`;
    const wideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const relogin = async (page, l, p) => {
      await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400);
      await go(page, '#/login', 0, '#login');
      await page.$eval('#login', (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
      await login(page, l, p);
    };
    const page = await fresh(width);
    // the coordinator asks
    await login(page, 'sps', 'sps-pass-12');
    await go(page, '#/newbatch', 0, '#na-level');
    ok(await page.evaluate(() => [...document.querySelectorAll('[role=tab], .tabs a, nav a')].some((a) => /New batch/.test(a.textContent))), `${W} Batch status has a New batch tab`);
    await page.type('#na-note', 'Fifty new students from the college fest');
    await clickText(page, 'button', /^Ask the IYF head$/);
    await page.waitForFunction(() => /Waiting/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    const mine = await page.evaluate(() => document.querySelector('main')?.innerText || '');
    ok(/Vedic Level 2/.test(mine) && /Waiting/.test(mine) && /Withdraw/.test(mine), `${W} the request shows under My requests, Waiting, with Withdraw`);
    ok(!(await wideScroll(page)), `${W} New batch: no sideways scroll`);
    await shot(page, `batchreq-ask-${width}`);
    // the head sees it in Requests, with its count, and approves it in Batch setup's form
    await relogin(page, 'master', 'master-pass-1');
    await go(page, '#/requests?type=newbatch', 0, '#rq-nb-h');
    const tab = await page.evaluate(() => [...document.querySelectorAll('.rq-types button')].find((b) => /New batches/.test(b.textContent))?.textContent || '');
    ok(/New batches\s*1/.test(tab), `${W} Requests has a New batches type with its count (${tab})`);
    ok(/asked by SPS Team/.test(await text(page, 'main') || ''), `${W} the head sees who asked`);
    await shot(page, `batchreq-requests-${width}`);
    await clickText(page, 'button', /^Approve…$/);
    await page.waitForSelector('dialog[open] #bnum-new', { timeout: 10000 }).catch(() => {});
    const form = await page.evaluate(() => ({ title: document.querySelector('dialog[open] h2, dialog[open] [id=bt-new]')?.textContent || '', num: document.querySelector('#bnum-new')?.value || '',
      ticked: [...document.querySelectorAll('dialog[open] input[type=checkbox]')].filter((c) => c.checked).map((c) => c.closest('label')?.textContent.replace(/\s+/g, ' ').trim() || '') }));
    ok(/Start the batch asked for/.test(form.title) && form.num === '1' && form.ticked.some((t) => /SPS Team/.test(t)), `${W} Approve opens Batch setup's form, pre-filled: number ${form.num}, the requester ticked (${form.ticked.join(', ')})`);
    await shot(page, `batchreq-approve-${width}`);
    await clickText(page, 'dialog[open] button[type=submit]', /^Start the batch$/);
    await page.waitForFunction(() => /Vedic Level 2 · Batch 1/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(/Vedic Level 2 · Batch 1/.test(await text(page, 'main') || ''), `${W} the batch is in Batch setup`);
    // the coordinator: Started, and the batch is theirs, with its tabs
    await relogin(page, 'sps', 'sps-pass-12');
    await go(page, '#/newbatch', 0, '#na-level');
    await page.waitForFunction(() => /Started/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    ok(/Started/.test(await text(page, 'main') || ''), `${W} the coordinator reads their request as Started`);
    await page.waitForFunction(async () => (await import('/src/lib/session.svelte.js')).session.user?.scopes?.coordinator?.includes('VL2-1'), { timeout: 8000 }).catch(() => {});
    await clickText(page, 'button', /^Open Vedic Level 2 · Batch 1$/);
    await page.waitForFunction(() => /Close batch/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
    const bt = await text(page, 'main') || '';
    ok(/Vedic Level 2 · Batch 1/.test(bt) && /Close batch/.test(bt), `${W} the new batch opens on their Batch screen, with Close batch`);
    ok(!(await wideScroll(page)), `${W} Batch status: no sideways scroll`);
    await shot(page, `batchreq-started-${width}`);
    await page.browserContext().close();
  }
}
if (!only || only === 'batchreq') await part('batchreq', async () => { await batchreq(); });
/* Search within reach on long lists (27 Oct 2026, search audit; ui/Search.svelte `pin`). Songs is long at every width:
   scrolled down, the SAME field is pinned in a compact band under the top bar (edge to edge with it, the field where and
   as wide as it was), with no floating button over the rows; the page does not move when it pins or unpins; a tap focuses
   it without scrolling; typing still filters (Songs in the page, Members on the server). A list under 1.5 screens never
   pins. The board's own sticky column header sits under the band. Nothing at 320 / 390 / 768 / 1280 scrolls sideways on
   any search screen, pinned or not. */
async function searchReach() {
  const st = (page, id) => page.evaluate((id) => {
    const i = document.getElementById(id), band = i?.closest('.s-band'), bar = document.querySelector('.topbar'), nav = document.querySelector('nav.nav');
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), width: Math.round(b.width) }; };
    const navShown = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().height < 120;   // the bottom bar, not the rail
    return { y: Math.round(scrollY), focus: document.activeElement?.id || '', pinned: !!band?.classList.contains('pinned'), band: r(band), input: r(i), slot: r(band?.parentElement),
      bar: r(bar), fab: !!document.querySelector('.s-fab'), navTop: navShown ? Math.round(nav.getBoundingClientRect().top) : null, vh: innerHeight,
      long: document.documentElement.scrollHeight > innerHeight * 1.5, wide: document.documentElement.scrollWidth > innerWidth + 1 };
  }, id);
  const scrollTo = async (page, y) => { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForFunction((y) => Math.abs(scrollY - Math.min(y, document.documentElement.scrollHeight - innerHeight)) < 2, { timeout: 3000 }, y).catch(() => {}); };
  const pinnedNow = (page, id, want) => page.waitForFunction((id, want) => !!document.getElementById(id)?.closest('.s-band')?.classList.contains('pinned') === want, { timeout: 3000 }, id, want).catch(() => {});
  // where a list row sits in the PAGE (not the screen): unchanged by pinning means nothing jumped
  const rowAt = (page, sel) => page.$eval(sel, (e) => Math.round(e.getBoundingClientRect().top + scrollY)).catch(() => null);
  for (const width of [320, 390, 768, 1280]) {
    const T = `[${width} search]`;
    const page = await fresh(width);
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/songs', 0, '#sg-q');
    await page.waitForSelector('main .list li:nth-child(3)', { timeout: 8000 }).catch(() => {});
    let s = await st(page, 'sg-q');
    ok(s.long && !s.pinned && !s.fab, `${T} Songs is a long list (≥ 1.5 screens); at the top the field is in its place (pinned ${s.pinned})`);
    const row0 = await rowAt(page, 'main section .list li:nth-child(3)');
    await scrollTo(page, 2400);
    await pinnedNow(page, 'sg-q', true);
    s = await st(page, 'sg-q');
    ok(s.pinned && !s.fab, `${T} scrolled down: the same field is pinned, and no floating button sits over the rows`);
    ok(s.band && s.bar && Math.abs(s.band.top - s.bar.bottom) <= 1 && Math.abs(s.band.left - s.bar.left) <= 1 && Math.abs(s.band.width - s.bar.width) <= 1 && s.band.bottom <= s.vh && (s.navTop === null || s.band.bottom < s.navTop),
      `${T} the band is right under the top bar and edge to edge with it, clear of the bottom nav (band ${JSON.stringify(s.band)}, bar ${JSON.stringify(s.bar)})`);
    ok(s.input && s.slot && Math.abs(s.input.left - s.slot.left) <= 1 && Math.abs(s.input.width - s.slot.width) <= 1 && !!s.band && s.band.bottom - s.band.top <= 60,
      `${T} the field keeps its place and width in the band, which is compact (${s.band ? s.band.bottom - s.band.top : 'no band'} px; input ${JSON.stringify(s.input)}, slot ${JSON.stringify(s.slot)})`);
    ok(row0 !== null && (await rowAt(page, 'main section .list li:nth-child(3)')) === row0 && Math.abs(s.y - 2400) <= 1 && !s.wide, `${T} pinning moved nothing: a row is where it was in the page, the page still at ${s.y}; no sideways scroll`);
    await shot(page, `search-pinned-${width}`);
    await page.click('#sg-q');
    await page.waitForFunction(() => document.activeElement?.id === 'sg-q', { timeout: 3000 }).catch(() => {});
    s = await st(page, 'sg-q');
    ok(s.focus === 'sg-q' && Math.abs(s.y - 2400) <= 1, `${T} a tap on it focuses it and the page stays at ${s.y}`);
    // typing still filters, through the pinned field
    const before = await text(page, '.sg-count p');
    await page.keyboard.type('gopinath', { delay: 15 });
    await page.waitForFunction(() => /songs?$/.test(document.querySelector('.sg-count p')?.textContent.trim() || ''), { timeout: 5000 }).catch(() => {});
    const after = await page.evaluate(() => ({ n: document.querySelector('.sg-count p')?.textContent.trim(), rows: document.querySelectorAll('ul[aria-label="Songs found"] > li').length, v: document.getElementById('sg-q')?.value, focus: document.activeElement?.id }));
    ok(before === null && after.v === 'gopinath' && after.rows > 0 && /^(\d+ songs?|First 60 songs)$/.test(after.n || '') && after.focus === 'sg-q', `${T} typing in it still filters, and keeps the focus (${JSON.stringify(after)})`);
    // back at the top: in its place again, nothing jumped
    await page.evaluate(() => { const i = document.getElementById('sg-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); });
    await page.waitForSelector('main section .list li:nth-child(3)', { timeout: 5000 }).catch(() => {});
    await scrollTo(page, 0);
    await pinnedNow(page, 'sg-q', false);
    s = await st(page, 'sg-q');
    ok(!s.pinned && s.y === 0 && (await rowAt(page, 'main section .list li:nth-child(3)')) === row0, `${T} back at the top: the field is in its place, the page at 0, the rows where they were`);
    // a phone keyboard: the screen shrinks to ~half; the pinned field stays inside what is left
    if (width === 390) {
      await page.setViewport({ width: 390, height: 420 });
      await scrollTo(page, 3000);
      await pinnedNow(page, 'sg-q', true);
      await page.click('#sg-q').catch(() => {});
      await page.waitForFunction(() => document.activeElement?.id === 'sg-q', { timeout: 3000 }).catch(() => {});
      s = await st(page, 'sg-q');
      ok(s.pinned && s.input && s.input.top >= 0 && s.input.bottom <= s.vh && s.focus === 'sg-q', `${T} 390 × 420 (keyboard up): the pinned field is inside the visible screen (input ${JSON.stringify(s.input)}, height ${s.vh})`);
      await shot(page, 'search-keyboard-390');
    }
    await page.browserContext().close();
  }
  // Members: the server's search through the pinned field (a phone); a short list on a large screen never pins
  for (const width of [390, 1280]) {
    const T = `[${width} search members]`, page = await fresh(width);
    await login(page, 'sps', 'sps-pass-12');
    await go(page, '#/members', 0, '#mb-q');
    await page.waitForSelector('.mb-list .mrow', { timeout: 8000 }).catch(() => {});
    let s = await st(page, 'mb-q');
    if (width === 390) {
      ok(s.long, `${T} the list is long here (≥ 1.5 screens)`);
      await scrollTo(page, 600);
      await pinnedNow(page, 'mb-q', true);
      const y0 = (await st(page, 'mb-q')).y;
      await page.click('#mb-q');
      await page.waitForFunction(() => document.activeElement?.id === 'mb-q', { timeout: 3000 }).catch(() => {});
      s = await st(page, 'mb-q');
      ok(s.pinned && s.focus === 'mb-q' && y0 > 0 && Math.abs(s.y - y0) <= 1, `${T} pinned; a tap focuses the members search and the page stays at ${s.y}`);
      await page.keyboard.type('Aarav', { delay: 20 });
      await page.waitForFunction(() => /matching “Aarav”/.test(document.querySelector('.mb-head p')?.textContent || ''), { timeout: 6000 }).catch(() => {});
      const r = await page.evaluate(() => ({ head: document.querySelector('.mb-head p')?.textContent.trim(), names: [...document.querySelectorAll('.mb-list .mrow b')].map((b) => b.textContent.trim()) }));
      ok(/^1 member matching “Aarav”$/.test(r.head || '') && r.names.join() === 'Aarav Gupta', `${T} typing still searches (server, debounced): ${JSON.stringify(r)}`);
      ok(!(await hScroll(page)), `${T} no sideways scroll`);
    } else {
      ok(!s.long, `${T} the list is short here (under 1.5 screens), so this checks the short case`);
      await scrollTo(page, 10000);
      s = await st(page, 'mb-q');
      ok(!s.pinned, `${T} scrolled to the end of a short list: the field is not pinned`);
    }
    await page.browserContext().close();
  }
  // the board's own sticky column header (820 px and up) sits under the band, never behind it
  {
    const T = '[820 search board]', page = await fresh(820);
    await login(page, 'sps', 'sps-pass-12');
    await go(page, '#/batch', 0, '#bd-q');
    await page.waitForSelector('.board-head', { visible: true, timeout: 8000 }).catch(() => {});
    const long = (await st(page, 'bd-q')).long;
    ok(long, `${T} the board is long here (≥ 1.5 screens)`);
    await scrollTo(page, 700);
    await pinnedNow(page, 'bd-q', true);
    await page.waitForFunction(() => { const h = document.querySelector('.board-head')?.getBoundingClientRect(), b = document.querySelector('.s-band.pinned')?.getBoundingClientRect(); return h && b && h.top >= b.bottom - 1; }, { timeout: 3000 }).catch(() => {});
    const g = await page.evaluate(() => ({ head: Math.round(document.querySelector('.board-head').getBoundingClientRect().top), band: Math.round(document.querySelector('.s-band.pinned')?.getBoundingClientRect().bottom ?? -1), bg: getComputedStyle(document.querySelector('.board-head')).backgroundColor }));
    ok(g.band > 0 && Math.abs(g.head - g.band) <= 1, `${T} the column header sticks right under the pinned search (header top ${g.head}, band bottom ${g.band})`);
    ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(g.bg), `${T} the stuck header is opaque, so the rows passing under it do not show through (${g.bg})`);
    await shot(page, 'search-board-820');
    await page.browserContext().close();
  }
  // every search screen, every width: nothing scrolls sideways, at the top and scrolled to the end; every field 44–48 px
  const SCREENS = { sps: [['sps-pass-12'], ['#/members', '#mb-q'], ['#/batch', '#bd-q']], master: [['master-pass-1'], ['#/activity', '#ac-q'], ['#/facilitators', '#fac-q'], ['#/access', '#acc-q'], ['#/ids', '#ids-q']],
    '6000000001': [['pass-12345'], ['#/songs', '#sg-q'], ['#/hearing', '#ln-q'], ['#/reading', '#rd-q']], etp: [['etp-pass-12'], ['#/students', '#st-q']] };
  for (const width of [320, 390, 768, 1280]) {
    for (const [who, [[pass], ...list]] of Object.entries(SCREENS)) {
      const page = await fresh(width);
      await login(page, who, pass);
      for (const [hash, sel] of list) {
        await go(page, hash, 0, sel);
        const top = await hScroll(page);
        await scrollTo(page, 100000);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const end = await hScroll(page);
        const h = await page.$eval(sel, (i) => Math.round(i.getBoundingClientRect().height));
        ok(!top && !end && h >= 44 && h <= 48, `[${width} search] ${hash}: no sideways scroll at the top or the end; the field is ${h} px`);
        if (width === 390 || width === 1280) await shot(page, `search-${hash.slice(2)}-${width}`);
      }
      await page.browserContext().close();
    }
  }
}
if (!only || only === 'search') await part('search', async () => { await searchReach(); });

// ── One name, one place (Phase 24, 27 Oct 2026; docs/NAMES_ONE_SOURCE_2026-10-27.md) ──────────────────────────────
// The head renames a facilitator ONCE, in Admin › Facilitators, and the new name is what every place shows: the
// sign-up wheel, a student's Account, the facilitator's own greeting, the facilitators' board, his EARLIER post to his
// students on the wall, and the promotion on his phase card. One page per width — the mock lives in the page.
async function namesOne() {
  const OLD = 'Natvar Gopinath Prabhuji', NEW = 'HG Natvar Gopinath Das';
  const dlg = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('dialog[open]')?.innerText || ''), { timeout: 10000 }, re.source).catch(() => {});
  for (const width of [390, 1280]) {
    const W = `[${width} names]`, page = await fresh(width);
    const api = (a, d) => page.evaluate(async (a, d) => { const { call } = await import('/src/lib/api.js'); try { return { ok: true, data: await call(a, d) }; } catch (e) { return { ok: false, code: e.code }; } }, a, d);
    const out = async () => { await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400); await go(page, '#/login', 0, '#login'); };
    const promoted = async () => {
      await go(page, '#/card', 0, 'main');
      await page.waitForFunction(() => /eligible/.test(document.querySelector('main')?.innerText || ''), { timeout: 10000 }).catch(() => {});
      return page.evaluate(() => [...document.querySelectorAll('.cd-target')].map((x) => x.textContent.trim()).find((x) => /promoted/.test(x)) || '');
    };
    // before: he posts to his students; the head promotes one of them (Aarav, SPS → DPS) inside the phase
    await login(page, 'natvar', 'natvar-pass-1');
    ok((await api('announcements.create', { title: 'Japa at six', body: 'For my students.', audience: ['STUDENTS'] })).ok, `${W} the facilitator posts to his students`);
    await out();
    await login(page, 'master', 'master-pass-1');
    ok((await api('devotees.promote', { login: '6000000011', toBatch: 'DPS' })).ok, `${W} the head promotes his student Aarav to DPS`);
    await out();
    await login(page, 'natvar', 'natvar-pass-1');
    const before = await promoted();
    ok(/1 promoted/.test(before), `${W} before: his card counts the promotion ("${before}")`);
    await out();
    // the rename, on the screen
    await login(page, 'master', 'master-pass-1');
    await go(page, '#/facilitators', 0, '.fac-row');
    await page.evaluate((n) => document.querySelector(`button[aria-label="Rename ${n}"]`)?.click(), OLD);
    await dlg(page, /Changes it everywhere/);
    await page.$eval('#fac-ren', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, NEW);
    await clickText(page, 'dialog[open] button', /^Rename$/);
    await page.waitForFunction((n) => [...document.querySelectorAll('.fac-row .lt')].some((x) => x.textContent.trim() === n), { timeout: 8000 }, NEW).catch(() => {});
    const list = await page.$$eval('.fac-row .lt', (l) => l.map((e) => e.textContent.trim()));
    ok(list.includes(NEW) && !list.includes(OLD), `${W} renamed once on the list`);
    ok(!/NameMap|Facilitator Dashboard/.test(await page.evaluate(() => document.body.innerText)), `${W} … and nothing sends the head to the dashboard`);
    if (width === 390) await shot(page, 'names-renamed-390');
    // the facilitators' board: his row, under the new name
    await go(page, '#/scoreboards', 0, 'main');
    await clickText(page, 'button[aria-pressed], [role="radio"], .seg button', /^Facilitators$/).catch(() => {});
    await page.waitForFunction((n) => [...document.querySelectorAll('.sb-who')].some((x) => x.textContent.includes(n)), { timeout: 10000 }, NEW).catch(() => {});
    const who = await page.$$eval('.sb-row .sb-who', (xs) => xs.map((x) => x.textContent.trim())).catch(() => []);
    ok(who.some((x) => x.includes(NEW)) && !who.some((x) => x.includes(OLD)), `${W} the board shows him as ${NEW} (${who.join(' | ')})`);
    await out();
    // the sign-up wheel (signed out): the new name is offered, the old one is not
    await go(page, '#/signup', 700, '#su-form');
    const fill = async (sel, v) => { await page.$eval(sel, (e) => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await page.type(sel, v); };
    await fill('#su-phone', '6000000156'); await fill('#su-name', 'Gopal Sharma'); await fill('#su-email', 'gopal.sharma@gmail.com');
    await page.$eval('#su-dob', (e) => { e.value = '2001-05-05'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await sel(page, '#su-bg', 'O+');
    await page.waitForFunction(() => !document.getElementById('su-looking'), { timeout: 8000 }).catch(() => {});
    await clickText(page, '#su-wa-q button', /^Yes$/).catch(() => {}); await sleep(100);
    await page.click('#su-form button[type=submit]'); await sleep(400);
    await page.waitForSelector('#su-fac', { timeout: 8000 }).catch(() => {});
    const wheel = (await page.$('#su-fac')) ? (await wheelChoices(page, '#su-fac')).values : [];
    ok(wheel.includes(NEW) && !wheel.includes(OLD), `${W} the sign-up wheel offers ${NEW}, not the old name (${wheel.length} names)`);
    // a student's own Account: "Your facilitator" is the new name
    await go(page, '#/login', 0, '#login');
    await login(page, '6000000001', 'pass-12345');
    await go(page, '#/account', 0, 'main');
    await page.waitForFunction((n) => (document.querySelector('main')?.innerText || '').includes(n), { timeout: 10000 }, NEW).catch(() => {});
    const acct = await text(page, 'main') || '';
    ok(acct.includes(NEW) && !acct.includes(OLD), `${W} Sunil's Account names his facilitator ${NEW}`);
    // his EARLIER post still reaches Sunil, under the name he has now
    await go(page, '#/wall', 0, '.feed');
    await page.waitForFunction(() => /Japa at six/.test(document.querySelector('main')?.innerText || ''), { timeout: 10000 }).catch(() => {});
    const post = await page.evaluate(() => [...document.querySelectorAll('.post')].find((p) => /Japa at six/.test(p.innerText))?.innerText || '');
    ok(/Japa at six/.test(post) && post.includes(NEW) && !post.includes(OLD), `${W} his earlier post to his students is still on Sunil's wall, by ${NEW}`);
    if (width === 390) await shot(page, 'names-wall-390');
    await out();
    // the facilitator himself: greeted by the new name; his post still says "Your students"; his card still counts Aarav
    await login(page, 'natvar', 'natvar-pass-1');
    await go(page, '#/home', 0, 'main');
    await page.waitForSelector('.greet h2', { timeout: 8000 }).catch(() => {});
    ok(/Hare Krishna, HG\b/.test(await text(page, '.greet h2') || ''), `${W} his own login greets him by the new name ("${await text(page, '.greet h2')}")`);
    await go(page, '#/wall', 0, '.feed');
    await page.waitForFunction(() => /Japa at six/.test(document.querySelector('main')?.innerText || ''), { timeout: 10000 }).catch(() => {});
    const mine = await page.evaluate(() => [...document.querySelectorAll('.post')].find((p) => /Japa at six/.test(p.innerText))?.innerText || '');
    ok(/Your students/.test(mine), `${W} on his own wall the post is still to "Your students"`);
    const after = await promoted();
    ok(/1 promoted/.test(after), `${W} the phase card still counts Aarav's promotion after the rename ("${after}")`);
    if (width === 1280) await shot(page, 'names-card-1280');
    ok(!(await hScroll(page)), `${W} no sideways scroll`);
    await page.browserContext().close();
  }
}
if (!only || only === 'names') await part('names', async () => { await namesOne(); });

// ── Admin › Reports (Phase 23 P14, docs/REPORTS_SPEC_2026-10-27.md) ───────────────────────────────────────────────
// The head builds a phase report and a custom range; a coordinator sees Reports only once the head gives the right, and
// then only their own batches; no sideways scroll; the print style leaves only the report on paper. Screenshots of the
// picker, the whole report and the print preview at five widths, light and dark (SHOTS=<folder>, default OUT).
async function reportsPart() {
  const SHOTS = process.env.SHOTS || OUT;
  const snap = (page, name, full = false) => page.screenshot({ path: `${SHOTS}/reports-${name}.png`, fullPage: full });
  const api = (page, a, d) => page.evaluate(async (a, d) => { const { call } = await import('/src/lib/api.js'); try { return { ok: true, data: await call(a, d) }; } catch (e) { return { ok: false, code: e.code }; } }, a, d);
  const out = async (page) => { await page.evaluate(async () => { await (await import('/src/lib/session.svelte.js')).logout(); }); await sleep(400); await go(page, '#/login', 0, '#login'); };
  const built = (page) => page.waitForFunction(() => document.querySelectorAll('#rpt .rp-sec').length >= 3 && !document.querySelector('.rp-go [aria-busy]'), { timeout: 15000 }).catch(() => {});
  const chip = (page, re) => clickText(page, '.rp-pick .chipbtn', re);
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const T = `[${width} ${theme} reports]`, page = await fresh(width);
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
      await login(page, 'master', 'master-pass-1');
      await go(page, '#/reports', 0, '.rp-pick');
      ok(!!(await page.$('.rp-pick')) && !(await hScroll(page)), `${T} the head opens Reports: the picker, no sideways scroll`);
      await snap(page, `picker-${width}-${theme}`);
      // a phase
      await chip(page, /^A phase$/);
      await page.waitForSelector('#rp-phase', { timeout: 5000 }).catch(() => {});
      await page.$eval('.rp-go button', (b) => b.click());
      await built(page);
      const head = await text(page, '#rpt .rp-cover h1'), secs = await page.$$eval('#rpt .rp-sec h2', (x) => x.length);
      ok(/All of IYF Delhi/.test(head || '') && secs >= 10, `${T} a phase report: "${head}", ${secs} sections`);
      ok(!(await hScroll(page)), `${T} the whole report: no sideways scroll`);
      await snap(page, `report-${width}-${theme}`, true);
      // the print preview: only the report, A4 style
      await page.emulateMediaType('print');
      const pr = await page.evaluate(() => ({ bar: getComputedStyle(document.querySelector('.topbar')).display, pick: getComputedStyle(document.querySelector('.rp-noprint')).display,
        paper: getComputedStyle(document.getElementById('rpt')).backgroundColor, ink: getComputedStyle(document.querySelector('#rpt .rp-tile strong')).color,
        doc: getComputedStyle(document.getElementById('rpt')).display, nav: [...document.querySelectorAll('.sidebar, nav.nav')].every((e) => getComputedStyle(e).display === 'none') }));
      ok(pr.bar === 'none' && pr.pick === 'none' && pr.nav && pr.doc !== 'none', `${T} the print style applies: no bars, menu or picker, the report kept (${JSON.stringify(pr)})`);
      ok(pr.paper === 'rgb(255, 255, 255)' && pr.ink === 'rgb(30, 26, 21)', `${T} … on white paper with dark ink, whatever the screen's theme (${pr.paper}, ${pr.ink})`);
      await snap(page, `print-${width}-${theme}`, true);
      if (width === 1440 && theme === 'light') await page.pdf({ path: `${SHOTS}/reports-sample.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await page.emulateMediaType('screen');
      if (width === 390 || width === 1440) {
        // a custom range
        await chip(page, /^Custom$/);
        await page.waitForSelector('#rp-from', { timeout: 5000 }).catch(() => {});
        const set = (sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
        await set('#rp-from', '2026-09-01'); await set('#rp-to', '2026-10-25');
        await page.waitForFunction(() => /closed weeks?/.test(document.querySelector('.rp-pick .rp-hint')?.textContent || ''), { timeout: 5000 }).catch(() => {});
        const cov = await text(page, '.rp-pick .rp-hint');
        ok(/1 Sept? 2026 – 25 Oct 2026/.test(cov || '') && /closed week/.test(cov || ''), `${T} a custom range says which weeks it covers ("${cov}")`);
        await page.$eval('.rp-go button', (b) => b.click());
        await page.waitForFunction(() => /1 Sept? 2026 – 25 Oct 2026/.test(document.querySelector('#rpt .rp-when')?.textContent || ''), { timeout: 15000 }).catch(() => {});
        ok(/1 Sept? 2026 – 25 Oct 2026/.test(await text(page, '#rpt .rp-when') || ''), `${T} … and the report is for those dates (${await text(page, '#rpt .rp-when')})`);
        // 367 days: refused on the screen before anything is asked
        await set('#rp-from', '2025-09-30'); await set('#rp-to', '2026-10-01');
        await page.waitForFunction(() => /year/.test(document.querySelector('.rp-pick .rp-err')?.textContent || ''), { timeout: 5000 }).catch(() => {});
        ok(/year/.test(await text(page, '.rp-pick .rp-err') || '') && !!(await page.$('.rp-go button[disabled]')), `${T} longer than a year: the screen asks for a shorter period`);
      }
      if (width === 390 && theme === 'light') {
        // the coordinator: no Reports until the head gives it, then their own batches only
        await out(page);
        await login(page, 'sps', 'sps-pass-12');
        const menu0 = await page.$$eval('a[href="#/reports"]', (x) => x.length);
        await go(page, '#/reports', 0, 'main');
        await page.waitForFunction(() => /Not available to you/.test(document.querySelector('main')?.innerText || ''), { timeout: 8000 }).catch(() => {});
        ok(menu0 === 0 && /Not available to you/.test(await text(page, 'main') || ''), `${T} a coordinator without the right: no menu item, the page is not available`);
        await out(page);
        await login(page, 'master', 'master-pass-1');
        ok((await api(page, 'access.set', { login: 'sps', capability: 'reports', effect: 'allow', reason: 'browser check' })).ok, `${T} the head gives SPS Team Reports`);
        await out(page);
        await login(page, 'sps', 'sps-pass-12');
        await page.evaluate(() => document.querySelector('.menu-btn')?.click());
        await page.waitForSelector('a[href="#/reports"]', { timeout: 5000 }).catch(() => {});
        ok((await page.$$eval('a[href="#/reports"]', (x) => x.length)) > 0, `${T} … now Reports is in their menu`);
        await go(page, '#/reports', 0, '.rp-pick');
        const kinds = await page.$$eval('#rp-kind button', (b) => b.map((x) => x.textContent.trim())).catch(() => []);
        ok(!kinds.some((k) => /All of IYF|facilitator|training/i.test(k)), `${T} the coordinator is offered only their own (${kinds.join(' | ') || 'one choice'})`);
        await page.$eval('.rp-go button', (b) => b.click());
        await built(page);
        const label = await text(page, '#rpt .rp-cover h1');
        const doc = await text(page, '#rpt');
        ok(!/All of IYF/.test(label || '') && !/\bDPS\b|\bBVS\b|\bBSS\b|Temple Residents/.test(doc || ''), `${T} … the report is theirs: "${label}", no other batch named`);
        ok(!(await hScroll(page)), `${T} … no sideways scroll`);
        await snap(page, 'coordinator-390-light', true);
      }
      await page.browserContext().close();
    }
  }
}
if (!only || only === 'reports') await part('reports', async () => { await reportsPart(); });

// ---------------- Phase 24 (28 Oct 2026): the controls the visual audit found no check clicked (VISUAL_AUDIT §d),
// and the rebuild's new behaviour — each check creates what it looks at, then asserts the effect ----------------
// a missing element is a FAIL line, never a crash: a crashed suite fails the whole gate with no verdict (gate.mjs)
const safeEval = (page, sel, fn) => page.$eval(sel, fn).catch(() => null);
const press = (page, scope, label) => page.evaluate((s, l) => {
  // a button's word, without a count after it ("Active3" is "Active")
  const b = [...document.querySelectorAll(s + ' button')].find((x) => x.textContent.replace(/\s+/g, ' ').trim().replace(/\s*\d+$/, '') === l);
  if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); return true;
}, scope, label);
const pressed = (page, scope, label) => page.evaluate((s, l) => [...document.querySelectorAll(s + ' button')].find((x) => x.textContent.replace(/\s+/g, ' ').trim().replace(/\s*\d+$/, '') === l)?.getAttribute('aria-pressed') === 'true', scope, label);
const openSummary = (page, re) => page.evaluate((src) => {
  const s = [...document.querySelectorAll('summary')].find((x) => new RegExp(src).test(x.textContent)); if (!s) return null;
  s.scrollIntoView({ block: 'center' }); s.click(); return s.parentElement.open;
}, re.source);
const dialogOpen = (page) => page.evaluate(() => !!document.querySelector('dialog[open]'));
const closeDialogs = (page) => page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
async function p24Devotee(width) {
  const T = `[${width} p24 devotee]`;
  const page = await fresh(width);
  await login(page, '6000000001', 'pass-12345');
  await page.waitForSelector('.qc', { timeout: 15000 });
  // Home: "Previous quote" turns the verse back
  const cite = () => safeEval(page, '.qc-slide[data-on] cite', (e) => e.textContent.trim());
  const c0 = await cite();
  await safeEval(page, 'button[aria-label="Previous quote"]', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); }); await sleep(300);
  ok((await cite()) !== c0, `${T} Home: Previous quote turns the verse (${c0} → ${await cite()})`);
  // Wall: Like turns to Liked
  await go(page, '#/wall', 0, 'article.post');
  const liked = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('article.post button')].find((x) => /^Like$/.test(x.textContent.trim())); if (!b) return null;
    b.click(); await new Promise((r) => setTimeout(r, 600)); return b.getAttribute('aria-pressed') === 'true' && /Liked/.test(b.textContent);
  });
  ok(liked === true, `${T} Wall: Like turns to Liked (${liked})`);
  // Reading: a book collection opens
  await go(page, '#/reading', 0, 'details.bk');
  ok((await page.evaluate(() => { const d = document.querySelector('details.bk:not([open])'); if (!d) return null; d.querySelector('summary').click(); return d.open; })) === true, `${T} Reading: a book's disclosure opens`);
  // Songs: text size Small and Medium; Clear the search; the row's last chip pinned at its end
  await go(page, '#/songs/s034', 0, '.sg-song');
  for (const [l, v] of [['Small', 's'], ['Medium', 'm']]) {
    await press(page, '[aria-labelledby="sg-size-l"]', l); await sleep(200);
    ok((await safeEval(page, '.sg-song', (e) => e.dataset.size)) === v, `${T} Songs: text size ${l}`);
  }
  ok(await page.evaluate(() => { const n = document.querySelector('.sg-nw'); if (!n) return null; const v = n.nextElementSibling.getBoundingClientRect(), r = n.getBoundingClientRect(); return r.bottom <= v.top + 1; }) === true,
    `${T} Songs: "Refrain" sits above its stanza, not over the first line (U3)`);
  await go(page, '#/songs?q=gopinath', 0, '#sg-q');
  await page.waitForSelector('button[aria-label="Clear the search"]', { timeout: 6000 }).catch(() => {});
  await safeEval(page, 'button[aria-label="Clear the search"]', (b) => b.click()).catch(() => {}); await sleep(300);
  ok((await safeEval(page, '#sg-q', (i) => i.value)) === '', `${T} Songs: Clear the search empties it`);
  const pin = await page.evaluate(() => [...document.querySelectorAll('.sg-row')].map((r) => { const l = r.lastElementChild.getBoundingClientRect(), b = r.getBoundingClientRect(); return l.right <= b.right + 1 && l.left >= b.left; }));
  ok(pin.length === 2 && pin.every(Boolean), `${T} Songs: each chip row ends on its whole last chip (More… / Book & category), never a cut name (V25)`);
  // My group: the week before and after
  await go(page, '#/group', 0, '#gl-wk-prev');
  const lab = () => text(page, '#gl-wk-pick');
  const g0 = await lab();
  await safeEval(page, '#gl-wk-prev', (b) => b.click()); await sleep(500);
  const g1 = await lab();
  await safeEval(page, '#gl-wk-next', (b) => b.click()); await sleep(500);
  ok(g1 !== g0 && (await lab()) === g0, `${T} My group: week before, then after, comes back (${g0} → ${g1})`);
  // offline: My targets says it failed, not "No card yet" (V31)
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(true); });   // this page has not opened My targets yet: nothing kept to show
  await go(page, '#/card', 0, '.errstate, .empty');
  const off = await page.evaluate(() => ({ err: !!document.querySelector('.errstate'), retry: !!document.querySelector('.errstate button'), empty: /No card yet/.test(document.querySelector('main').innerText) }));
  ok(off.err && off.retry && !off.empty, `${T} offline My targets: an error with Try again, never "No card yet" (${JSON.stringify(off)})`);
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(false); });
  // last: the Day form (choosing "No" leaves the day with a change, and leaving it then asks first)
  await go(page, '#/home', 0, '.qc'); await page.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.endsWith('|home.get')), { timeout: 8000 }).catch(() => {});
  // the Day form: Set time opens its sheet; "Completed the same day?" No; the Seva jump chip (below 1024 px)
  const wk = await page.evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find((k) => k.endsWith('|home.get')))).data.weeks.at(-1));
  const day = wk.days.find((x) => !x.future);
  await go(page, `#/day/${wk.weekId}/${day.date}`, 0, '#f-wokeAt-btn');
  for (const id of ['#f-wokeAt-btn', '#f-chantingDoneAt-btn']) {
    await safeEval(page, id, (b) => { b.scrollIntoView({ block: 'center' }); b.click(); }); await sleep(350);
    ok(await dialogOpen(page), `${T} Day: ${id.slice(3, -4)} "Set time" opens the time sheet`);
    await closeDialogs(page); await sleep(250);
  }
  const no = await press(page, '[aria-labelledby="f-chantingSameDay-l"]', 'No'); await sleep(200);
  ok(no && await pressed(page, '[aria-labelledby="f-chantingSameDay-l"]', 'No'), `${T} Day: "Completed the same day?" No is chosen`);
  if (width < 1024) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await press(page, 'nav.jumpbar', 'Seva'); await sleep(700);
    const top = await safeEval(page, '#h-seva', (h) => h.getBoundingClientRect().top);
    ok(top >= 0 && top < innerHeightOf(width), `${T} Day: the Seva chip brings the Seva section into view (top ${Math.round(top)})`);
  }
  await page.close();
}
const innerHeightOf = (width) => (width >= 1024 ? 900 : 800);
async function p24Coord(width) {
  const T = `[${width} p24 coordinator]`;
  const page = await fresh(width, { clock: classDayIso('SUN') });
  await login(page, 'sps', 'sps-pass-12');
  // one batch picker, on the page (the head, 28 Oct 2026, V33): none in the menu
  await go(page, '#/batch', 1000, 'li.brow');
  ok(!(await page.$('aside.sidebar select, dialog.drawer select, nav.menu select')) && !!(await page.$('#bt-batch')), `${T} one batch picker, on the page; none in the menu`);
  ok(await openSummary(page, /^Not active \(/) === true, `${T} Batch status: "Not active (n)" opens`);
  // Devotees: the status filter
  await go(page, '#/members', 0, '[role=group][aria-label="Status"]');
  for (const l of ['Active', 'Disabled', 'All']) { await press(page, '[role=group][aria-label="Status"]', l); await sleep(500); ok(await pressed(page, '[role=group][aria-label="Status"]', l), `${T} Devotees: status ${l}`); }
  // Requests: Resets, then All
  await go(page, '#/requests', 0, '.rq-types');
  for (const l of ['Resets', 'All']) {
    const ok1 = await page.evaluate((x) => { const b = [...document.querySelectorAll('.rq-types button')].find((y) => y.textContent.trim().startsWith(x)); b?.click(); return !!b; }, l); await sleep(400);
    ok(ok1 && await page.evaluate((x) => [...document.querySelectorAll('.rq-types button')].find((y) => y.textContent.trim().startsWith(x))?.getAttribute('aria-pressed') === 'true', l), `${T} Requests: ${l}`);
  }
  // a devotee's page: More actions opens
  await go(page, '#/devotee/6000000011', 0, '#dv-name');
  ok(await openSummary(page, /More actions/) === true, `${T} devotee page: More actions opens`);
  // Leaderboard: Dates shows the two date fields; offline it says it failed, not "No class batch" (V31)
  await go(page, '#/leaderboard', 0, '#lb-period-l');
  await press(page, '[aria-labelledby="lb-period-l"]', 'Dates'); await sleep(300);
  ok(!!(await page.$('#lb-from')) && !!(await page.$('#lb-to')), `${T} Leaderboard: Dates shows From and To`);
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(true); });
  await press(page, '[aria-labelledby="lb-period-l"]', 'Week'); await sleep(900);
  const off = await page.evaluate(() => ({ err: !!document.querySelector('.errstate'), wrong: /No class batch/.test(document.querySelector('main').innerText) }));
  ok(off.err && !off.wrong, `${T} offline Leaderboard: an error with Try again, never "No class batch" (${JSON.stringify(off)})`);
  await page.evaluate(async () => { (await import('/src/lib/mock.js')).setOffline(false); });
  await page.close();
}
async function p24Head(width) {
  const T = `[${width} p24 head]`;
  const page = await fresh(width);
  await login(page, 'master', 'master-pass-1');
  await go(page, '#/coordinators', 900, '[role=tab]');
  const n = await page.$$eval('[role=tab]', (l) => l.length);
  if (width < 600) {
    // V13: one row and More — every tab still a tab (the keyboard reaches all of them), the rest one tap away
    const m = await page.evaluate(() => { const b = document.querySelector('.tm-btn'); const r = b?.getBoundingClientRect(); return { shown: !!b && r.width > 0 && b.closest('.tm').hidden === false, right: r ? r.right : 0, sw: document.documentElement.scrollWidth }; });
    ok(m.shown && m.right <= innerWidthOf(page) + 1 && n >= 7, `${T} admin tabs: one row with More (${n} tabs)`);
    await safeEval(page, '.tm-btn', (b) => b.click()); await sleep(250);
    const items = await page.$$eval('.tm-menu a', (l) => l.map((a) => [a.textContent.trim(), a.getAttribute('href')]));
    // out of sight = outside the row's own visible part: past its left margin, or under More
    const hidden = await page.evaluate(() => { const l = document.querySelector('[role=tablist]'), L = l.getBoundingClientRect(), lo = L.left + parseFloat(getComputedStyle(l).paddingLeft) - 1; return [...document.querySelectorAll('[role=tab]')].filter((t) => { const r = t.getBoundingClientRect(); return r.left < lo || r.right > document.querySelector('.tm-btn').getBoundingClientRect().left + 1; }).map((t) => t.textContent.trim()); });
    ok(items.length > 0 && items.every(([t]) => hidden.includes(t)), `${T} More lists exactly the tabs out of sight (${items.map((x) => x[0]).join(', ')})`);
    const to = items.at(-1)?.[1];
    await safeEval(page, '.tm-menu li:last-child a', (a) => a.click()); await sleep(800);
    ok((await page.evaluate(() => location.hash)) === to && (await safeEval(page, '[role=tab][aria-selected=true]', (t) => { const r = t.getBoundingClientRect(); return r.right <= document.querySelector('.tm-btn').getBoundingClientRect().left + 1 && r.left >= 0; }).catch(() => false)),
      `${T} a tab chosen from More opens, and is in the row (${to})`);
    ok(!(await hScroll(page)), `${T} admin tabs: no sideways scroll`);
  }
  // Coordinators: a row's More for … opens its sheet (the phone layout's ⋯; a computer has the side pane)
  if (width < 1024) {
  await go(page, '#/coordinators', 900, 'button[aria-label^="More for "]');
  const more = await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label^="More for "]')].find((x) => x.getClientRects().length); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }); await sleep(400);
  ok(more && await dialogOpen(page), `${T} Coordinators: "More for …" opens its sheet`);
  await closeDialogs(page);
  }
  // Facilitators: Manage / Give a login opens its sheet
  await go(page, '#/facilitators', 900, 'button[aria-label^="Manage the login of "], button[aria-label^="Give a login to "]');
  await safeEval(page, 'button[aria-label^="Manage the login of "], button[aria-label^="Give a login to "]', (b) => { b.scrollIntoView({ block: 'center' }); b.click(); }); await sleep(400);
  ok(await dialogOpen(page), `${T} Facilitators: a facilitator's login button opens its sheet`);
  await closeDialogs(page);
  await page.close();
}
const innerWidthOf = (page) => page.viewport().width;
async function p24Staff(width) {
  // the training coordinator's Board tab; the facilitator's week stepper, Explorer and card switch; Scoreboards' period
  let T = `[${width} p24 etp]`;
  let page = await fresh(width);
  await login(page, 'etp', 'etp-pass-12');
  await go(page, '#/batch', 900, '[role=tab]');
  const board = await page.evaluate(() => { const t = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === 'Board'); t?.click(); return !!t; }); await sleep(800);
  ok(board && (await page.evaluate(() => location.hash)) === '#/board', `${T} the Board tab opens the board`);
  await go(page, '#/scoreboards', 900, '[aria-labelledby="sb-period-l"]');
  const opts = await page.$$eval('[aria-labelledby="sb-period-l"] button', (l) => l.map((b) => b.textContent.trim()));
  await press(page, '[aria-labelledby="sb-period-l"]', opts[1]); await sleep(500);
  const seg = await page.$$eval('[aria-labelledby="sb-period-l"] button', (l) => l.map((b) => ({ p: b.getAttribute('aria-pressed'), fits: b.scrollWidth <= b.clientWidth + 1, h: b.getBoundingClientRect().height })));
  ok(seg[1]?.p === 'true' && seg.every((x) => x.fits && x.h < 56), `${T} Scoreboards: "${opts[1]}" chosen, both labels on one line (V12)`);
  await page.close();
  T = `[${width} p24 facilitator]`;
  page = await fresh(width);
  await login(page, 'natvar', 'natvar-pass-1');
  await go(page, '#/my-devotees', 0, '#fc-wk-prev');
  const l0 = await text(page, '#fc-wk-pick');
  await safeEval(page, '#fc-wk-prev', (b) => b.click()); await sleep(600);
  const l1 = await text(page, '#fc-wk-pick');
  await safeEval(page, '#fc-wk-next', (b) => b.click()); await sleep(600);
  ok(l1 !== l0 && (await text(page, '#fc-wk-pick')) === l0, `${T} My students: week before, then after (${l0} → ${l1})`);
  await go(page, '#/explorer', 0, '[aria-labelledby="ex-show-l"]');
  await press(page, '[aria-labelledby="ex-show-l"]', 'Everyone'); await sleep(300);
  await press(page, '[aria-labelledby="ex-show-l"]', 'Qualify'); await sleep(300);
  ok(await pressed(page, '[aria-labelledby="ex-show-l"]', 'Qualify'), `${T} Explorer: Qualify chosen`);
  await go(page, '#/card', 0, '.cd-list');
  await page.evaluate(() => document.querySelector('.cd-edit')?.click()); await sleep(400);   // already editing on a first visit: no Edit
  const nf = await page.evaluate(async () => { const b = [...document.querySelectorAll('.seg[aria-labelledby^="ct-"] button')].find((x) => x.textContent.trim() === 'Not for me' && !x.disabled && x.getAttribute('aria-pressed') !== 'true'); if (!b) return null; b.scrollIntoView({ block: 'center' }); b.click(); await new Promise((r) => setTimeout(r, 300)); return b.getAttribute('aria-pressed'); });
  ok(nf === 'true', `${T} My targets: "Not for me" chosen on a measure (${nf})`);
  if (width >= 1024) {
    // V1: no switch sits on its label in the two 340 px panes
    const over = await page.evaluate(() => [...document.querySelectorAll('.cd-row.cd-choice')].filter((r) => { const l = r.querySelector('.cd-label')?.getBoundingClientRect(), s = r.querySelector('.seg')?.getBoundingClientRect(); return l && s && l.right > s.left + 1 && l.bottom > s.top + 1 && l.top < s.bottom - 1; }).length);
    ok(over === 0, `${T} My targets: no Yes/No switch over its label (${over}, V1)`);
  }
  await page.close();
}
// the three the first p24 pass could not reach (28 Oct 2026): each makes what it needs, then checks it
async function p24Gaps(width) {
  // 1. the training board's P / A: the head enrols a devotee into the training, its coordinator marks the class
  let T = `[${width} p24 training board]`;
  let page = await fresh(width);
  const seeded = await page.evaluate(async () => {
    const m = await import('/src/lib/mock.js');
    const call = async (token, action, data) => { const r = await m.handle({ v: 1, action, token, requestId: crypto.randomUUID(), data }); if (!r.ok) throw new Error(action + ' ' + JSON.stringify(r.error)); return r.data; };
    const head = (await call(undefined, 'auth.login', { login: 'master', password: 'master-pass-1' })).token;
    const etp = (await call(undefined, 'auth.login', { login: 'etp', password: 'etp-pass-12' })).token;
    const me = await call(etp, 'auth.me', {});
    const batchId = (me.user?.scopes?.coordinator || me.scopes?.coordinator || []).find((b) => /^ETP-/.test(b)) || 'ETP-21';
    const r = await call(head, 'enrol.add', { batchId, login: '6000000011', reason: 'Phase 24 check' });
    return { batchId, login: r.login, name: r.name };
  }).catch((e) => ({ err: String(e.message || e) }));
  ok(!!seeded.name, `${T} a devotee enrolled into the training to mark (${JSON.stringify(seeded)})`);
  await login(page, 'etp', 'etp-pass-12');
  await go(page, '#/board', 0, '.bd-mk');
  const row = (n) => page.evaluate((nm) => { const li = [...document.querySelectorAll('li')].find((x) => x.querySelector('.bd-mk') && x.textContent.includes(nm)); return li ? [...li.querySelectorAll('.bd-mk')].map((b) => b.getAttribute('aria-pressed')) : null; }, n);
  const tap = (n, mk) => page.evaluate((nm, k) => { const li = [...document.querySelectorAll('li')].find((x) => x.querySelector('.bd-mk') && x.textContent.includes(nm)); const b = li && [...li.querySelectorAll('.bd-mk')].find((x) => x.textContent.trim() === k); b?.scrollIntoView({ block: 'center' }); b?.click(); return !!b; }, n, mk);
  const server = () => page.evaluate(async (b, l) => {
    const m = await import('/src/lib/mock.js');
    const t = (await m.handle({ v: 1, action: 'auth.login', requestId: crypto.randomUUID(), data: { login: 'etp', password: 'etp-pass-12' } })).data.token;
    const r = await m.handle({ v: 1, action: 'board.get', token: t, requestId: crypto.randomUUID(), data: { batchId: b } });
    return (r.data?.rows || []).find((x) => x.login === l)?.mark ?? null;
  }, seeded.batchId, seeded.login);
  const steps = [['P', 'P', ['true', 'false']], ['A', 'A', ['false', 'true']], ['A', '', ['false', 'false']]];
  for (const [mk, want, pressed] of steps) {
    const did = await tap(seeded.name, mk); await sleep(700);
    const ui = await row(seeded.name), sv = await server();
    ok(did && JSON.stringify(ui) === JSON.stringify(pressed) && (sv || '') === want,
      `${T} ${mk === 'A' && !want ? 'A again clears the mark' : mk + ' marks the class'}: buttons ${JSON.stringify(ui)}, server "${sv || ''}"`);
  }
  await page.close();
  // 2. a toast's Dismiss (×): My targets saved, its "Saved." closed at once (not by its 5 s timer)
  T = `[${width} p24 toast]`;
  page = await fresh(width);
  await login(page, 'natvar', 'natvar-pass-1');
  await go(page, '#/card', 0, '.cd-list');
  await page.evaluate(() => document.querySelector('.cd-edit')?.click()); await sleep(400);
  const saved = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Save my targets$/.test(x.textContent.trim())); b?.click(); return !!b; });
  await page.waitForSelector('.toast', { timeout: 6000 }).catch(() => {});
  const shown = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent.trim()));
  ok(saved && shown.length > 0, `${T} saving My targets shows a toast (${shown.join(' | ')})`);
  const t0 = Date.now();
  await page.evaluate(() => document.querySelector('.toast button[aria-label="Dismiss"]')?.click()); await sleep(300);
  const left = await page.$$eval('.toast', (l) => l.length);
  ok(shown.length > 0 && left === shown.length - 1 && Date.now() - t0 < 2000, `${T} Dismiss (×) closes it at once (${shown.length} → ${left})`);
  await page.close();
  // 3. sign-up: "Is this number on WhatsApp?" No asks for the WhatsApp number; Yes takes the field away again
  T = `[${width} p24 sign-up]`;
  page = await fresh(width);
  await go(page, '#/signup', 0, '[aria-labelledby="su-wa-q-l"]');
  await press(page, '[aria-labelledby="su-wa-q-l"]', 'No'); await sleep(300);
  const no = await page.evaluate(() => ({ p: [...document.querySelectorAll('[aria-labelledby="su-wa-q-l"] button')].find((b) => b.textContent.trim() === 'No')?.getAttribute('aria-pressed'), wa: !!document.getElementById('su-wa') }));
  ok(no.p === 'true' && no.wa, `${T} WhatsApp "No" is chosen and asks for the WhatsApp number (${JSON.stringify(no)})`);
  await press(page, '[aria-labelledby="su-wa-q-l"]', 'Yes'); await sleep(300);
  ok(!(await page.$('#su-wa')), `${T} back to "Yes": the extra number field goes`);
  await page.close();
}
if (!only || only === 'p24') await part('p24', async () => { for (const w of [390, 1280]) { await p24Devotee(w); await p24Coord(w); await p24Staff(w); await p24Gaps(w); } for (const w of [320, 1280]) await p24Head(w); });

await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
console.log('\nConsole / page errors:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none');
