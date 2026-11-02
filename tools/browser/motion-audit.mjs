// Motion audit (the head, 10 Oct 2026: "judge all these where a new modal pops up or closes, going backwards or forwards
// … wherever these places are smooth or not"). Every kind of movement in the app, measured frame by frame in Chrome:
//   pop    — most of a movement lands in ONE frame (a jump instead of a glide), or a font size / height jumps mid-move
//   jank   — frames that took longer than two frame times (a stutter), with the CPU slowed 4× on the phone run
// Each movement follows one element (the sheet, the drawer, the page, the wheel's rows) every animation frame.
//   BASE=http://localhost:5195 node tools/browser/motion-audit.mjs        → table; exit summary "N passed, M failed"
import { createRequire } from 'node:module';
const puppeteer = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json')('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:5195';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const results = [];

// A fixed clock (12 Oct 2026): Monday of this week, 11:00 IST. These checks open "the last non-future day", which on the
// real clock is a different day each day of the week; verify.mjs pins its clock (classDayIso) and these did not. Monday is
// the day every green run so far opened, so pinning to it makes the gate's result the same whatever the calendar says.
const MON_IST = (() => { const ist = new Date(Date.now() + 5.5 * 3600e3), back = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back)).toISOString().slice(0, 10) + 'T11:00:00+05:30'; })();
// in the page: follow `sel` (the newest match) for ms, one sample per animation frame
const RECORDER = () => {
  window.__rec = (sel, ms, wheel) => new Promise((done) => {
    const out = [], t0 = performance.now(); let last = t0, ref = null;
    // follow the element that is open (a sheet, the drawer) or the one named; once found, keep following that same
    // element as it closes (it loses [open] at once but stays drawn while it slides away)
    const pick = () => { if (!ref || !ref.isConnected) ref = document.querySelector(sel); return ref; };
    const frame = (t) => {
      const el = pick(), s = { dt: Math.round(t - last), t: Math.round(t - t0) };
      last = t;
      if (el) {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        s.x = r.left; s.y = r.top; s.w = r.width; s.h = r.height; s.o = +cs.opacity; s.vh = innerHeight; s.vw = innerWidth;
        if (!r.width || !r.height || cs.display === 'none') s.gone = true;
        if (wheel) {   // the wheel: each row's font size and drawn scale
          s.rows = [...el.querySelectorAll('.wheel-row')].map((row) => { const m = new DOMMatrixReadOnly(getComputedStyle(row).transform); const rr = row.getBoundingClientRect(); return { fs: parseFloat(getComputedStyle(row).fontSize), fw: +getComputedStyle(row).fontWeight, sc: Math.hypot(m.a, m.b), y: rr.top }; });
        }
      } else s.gone = true;
      // a page change animates a snapshot (::view-transition), not the element: count those animations
      s.vt = document.getAnimations().filter((x) => String(x.effect?.pseudoElement || '').startsWith('::view-transition')).length;
      out.push(s);
      if (t - t0 < ms) requestAnimationFrame(frame); else done(out);
    };
    requestAnimationFrame(frame);
  });
};
// one movement → its verdict
function judge(name, frames, { expectMove = true, page = false, closing = false } = {}) {
  if (page) {   // a page change: a view transition that runs over several frames, without stutter
    const f = frames.slice(1), jank = f.filter((x) => x.dt > 34).length, worst = Math.max(0, ...f.map((x) => x.dt));
    const vtFrames = frames.filter((x) => x.vt > 0).length;
    const problems = [];
    if (vtFrames < 6) problems.push(vtFrames ? `the page animation lasts only ${vtFrames} frames` : 'no page animation: the new page replaces the old in one frame');
    if (jank > 2) problems.push(`${jank} stuttering frames (worst ${worst} ms)`);
    const ok = !problems.length; ok ? pass++ : fail++;
    results.push({ name, ok, frames: f.length, jank, worst, problems });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · page animation over ${vtFrames} frames, ${jank} stutters (worst ${worst} ms)${ok ? '' : ' — ' + problems.join('; ')}`);
    return;
  }
  const f = frames.slice(1);                                   // the first sample has no frame time of its own
  const jank = f.filter((x) => x.dt > 34).length, worst = Math.max(0, ...f.map((x) => x.dt));
  const seen = frames.filter((x) => !x.gone);
  // position + size + opacity as one number; total change and the biggest single-frame step
  const v = seen.map((x) => x.y + x.x + x.h * 0.5 + x.o * 300);
  let total = 0, step = 0, stepAt = -1;
  for (let i = 1; i < v.length; i++) { const d = Math.abs(v[i] - v[i - 1]); total += d; if (d > step) { step = d; stepAt = i; } }
  // a height jump in one frame bigger than a quarter of the element (content appearing / vanishing mid-move)
  // (only what can be seen: a change while the element is still wholly off screen or invisible is not a pop)
  const onScreen = (x) => x.y < x.vh && x.y + x.h > 0 && x.x < x.vw && x.x + x.w > 0 && x.o > 0.05;
  let hJump = 0; for (let i = 1; i < seen.length; i++) if (seen[i - 1].h > 40 && onScreen(seen[i - 1]) && onScreen(seen[i])) hJump = Math.max(hJump, Math.abs(seen[i].h - seen[i - 1].h) / seen[i - 1].h);
  // the wheel: a font size change on any row between two frames, or a row's scale jumping by more than 0.06
  // (a row's scale follows the scroll position continuously, so its per-frame change is the scroll's own speed: only a
  // font size or weight switching between two frames is a jump)
  let fsJump = 0, fwJump = 0;
  for (let i = 1; i < seen.length; i++) {
    const a = seen[i - 1].rows, b = seen[i].rows; if (!a || !b) continue;
    for (let k = 0; k < Math.min(a.length, b.length); k++) { fsJump = Math.max(fsJump, Math.abs(a[k].fs - b[k].fs)); fwJump = Math.max(fwJump, Math.abs(a[k].fw - b[k].fw)); }
  }
  // closing: when it finally disappears it must already have slid away or faded (else it vanished mid-move)
  const lastSeen = seen.at(-1);
  const vanished = closing && lastSeen && frames.at(-1).gone && !(lastSeen.y > lastSeen.vh * 0.85 || lastSeen.o < 0.15 || lastSeen.y + lastSeen.h < 0 || lastSeen.x + lastSeen.w < lastSeen.w * 0.15 || lastSeen.x > lastSeen.vw * 0.85);
  const moved = total > 8;
  const share = moved ? step / total : 0;
  const problems = [];
  if (expectMove && !moved && !seen[0]?.rows) problems.push('no movement at all (it appears or vanishes in one frame)');
  if (moved && share > 0.45 && !seen[0]?.rows) problems.push(`${Math.round(share * 100)}% of the movement in one frame (frame ${stepAt})`);
  if (hJump > 0.25) problems.push(`its height jumps ${Math.round(hJump * 100)}% in one frame`);
  if (fsJump > 0.5) problems.push(`a row's font size jumps ${fsJump.toFixed(1)} px in one frame`);
  if (fwJump >= 50) problems.push(`a row's weight jumps ${fwJump} in one frame`);
  if (vanished) problems.push(`it disappears while still on screen (opacity ${lastSeen.o.toFixed(2)}, left ${Math.round(lastSeen.x)}, top ${Math.round(lastSeen.y)})`);
  if (jank > 2) problems.push(`${jank} stuttering frames (worst ${worst} ms)`);
  const ok = !problems.length;
  ok ? pass++ : fail++;
  results.push({ name, ok, frames: f.length, jank, worst, share: Math.round(share * 100), problems });
  if (process.env.MOTION_DEBUG && !ok) {
    console.log('   debug:', JSON.stringify(seen.map((x) => ({ t: x.t, x: Math.round(x.x), y: Math.round(x.y), o: +x.o.toFixed(2) }))));
    console.log(`   total=${Math.round(total)} step=${Math.round(step)} at frame ${stepAt}`);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${f.length} frames, ${moved ? Math.round(share * 100) + '% max in one frame' : 'still'}, ${jank} stutters (worst ${worst} ms)${ok ? '' : ' — ' + problems.join('; ')}`);
}

// Reduce Motion on (the phone's setting): nothing slides. A sheet is in place from its first visible frame and gone
// within a few frames; a page change has no animation at all.
function judgeReduced(name, frames, kind) {
  const seen = frames.filter((x) => !x.gone && x.h > 0), problems = [];
  if (kind === 'page') { const vt = frames.filter((x) => x.vt > 0).length; if (vt) problems.push(`a page animation runs (${vt} frames)`); }
  else if (kind === 'open') {
    if (!seen.length) problems.push('it never appeared');
    else { const end = seen.at(-1), moved = seen.some((x) => Math.abs(x.y - end.y) > 2 || Math.abs(x.x - end.x) > 2); if (moved) problems.push('it slides in although motion is reduced'); }
  } else if (kind === 'close') {
    const last = frames.findIndex((x, i) => i > 0 && x.gone && !frames.slice(i).some((y) => !y.gone));
    if (last < 0 || last > 12) problems.push(`it stays on screen for ${last < 0 ? 'the whole' : last + ' frames of the'} measurement`);
    if (seen.length > 1 && seen.some((x) => Math.abs(x.y - seen[0].y) > 2)) problems.push('it slides away although motion is reduced');
  }
  const ok = !problems.length; ok ? pass++ : fail++;
  results.push({ name, ok, problems });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' — ' + problems.join('; ')}`);
}

const browser = await puppeteer.launch({ executablePath: (process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: true, args: ['--no-sandbox', '--disable-renderer-backgrounding'] });
async function session(login, pw, width, slow, reduce = false) {
  const page = await (await browser.createBrowserContext()).newPage();
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(width < 600 ? { width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width, height: 800 });
  await page.evaluateOnNewDocument(RECORDER);
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  await page.evaluate(async (c) => { const m = await import('/src/lib/mock.js'); m.setNow(c); m.setLatency(10); }, MON_IST);
  await page.type('#login', login); await page.type('#password', pw); await page.click('button[type=submit]');
  await page.waitForFunction(() => location.hash.startsWith('#/home'), { timeout: 10000 }); await sleep(1500);
  if (slow) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  return page;
}
// run `act`, follow `sel` for ms
async function measure(page, name, sel, act, ms = 700, opts = {}) {
  const rec = page.evaluate((s, m, w) => window.__rec(s, m, w), sel, ms, !!opts.wheel);
  await sleep(30); await act();
  if (process.env.MOTION_CSS) {
    await sleep(60);
    const css = await page.evaluate((s) => { const el = document.querySelector(s.replace('[open]','')) || document.querySelector(s);
      if (!el) return 'no element'; const c = getComputedStyle(el);
      return { dur: c.transitionDuration, prop: c.transitionProperty, ease: c.transitionTimingFunction, d3: getComputedStyle(document.documentElement).getPropertyValue('--d-3').trim() }; }, sel);
    console.log('   CSS', name, JSON.stringify(css));
  }
  if (opts.reduced) judgeReduced(name, await rec, opts.reduced); else judge(name, await rec, opts);
}
/**
 * Waits until a button with this text is drawn (12 Oct 2026). clickText() returns false, silently, when the button
 * is not there yet — and then nothing opens, and a perfectly good animation is read as "no movement at all".
 * Two checks waited a fixed time instead: the day page's "How your day is scored" appears ~1.9 s after the form
 * at 4× CPU (the audit waited ~1 s, so it always failed) and Filters on #/members appears 1.2–1.9 s after the
 * route change (the audit waited 1.5 s, so it failed about half the time). Measured, not guessed.
 */
const waitForText = (page, sel, re, timeout = 15000) =>
  page.waitForFunction((s, r) => !![...document.querySelectorAll(s)].find((x) => new RegExp(r).test(x.textContent.trim()) && x.offsetParent), { timeout }, sel, re.source);
const clickText = (page, sel, re) => page.evaluate((s, r) => { const b = [...document.querySelectorAll(s)].find((x) => new RegExp(r).test(x.textContent.trim()) && x.offsetParent); b?.click(); return !!b; }, sel, re.source);

// ---- the phone (390 px, CPU 4× slower): sheets, the time wheel, the drawer, going forward and back
{
  const W = '[phone]';
  const page = await session('6000000001', 'pass-12345', 390, true);
  const { weekId, date } = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const h = await call('home.get', {}); const w = h.weeks.at(-1); return { weekId: w.weekId, date: w.days.filter((x) => !x.future).at(-1).date }; });
  // going forward and back between screens
  await measure(page, `${W} forward: Home → Week (the page)`, '.content', () => page.evaluate(() => { location.hash = '#/week'; }), 900, { page: true });
  await sleep(500);
  await measure(page, `${W} back: Week → Home (the page)`, '.content', () => page.evaluate(() => history.back()), 900, { page: true });
  await sleep(500);
  // the drawer
  await measure(page, `${W} menu opens (the drawer)`, 'dialog.drawer[open]', () => page.evaluate(() => document.querySelector('button[aria-label="Open menu"]')?.click()), 700);
  await sleep(400);
  await measure(page, `${W} menu closes (Escape)`, 'dialog.drawer[open]', () => page.keyboard.press('Escape'), 700, { closing: true });
  await sleep(400);
  // the day form's sheets
  await page.evaluate((h) => { location.hash = h; }, `#/day/${weekId}/${date}`); await page.waitForSelector('#rounds'); await waitForText(page, 'button', /^Scoring$/); await sleep(400);
  await measure(page, `${W} sheet opens: How your day is scored`, 'dialog.sheet[open]', () => clickText(page, 'button', /^Scoring$/), 800);
  await sleep(400);
  await measure(page, `${W} sheet closes (✕)`, 'dialog.sheet[open]', () => page.evaluate(() => document.querySelector('dialog[open] [aria-label="Close"]')?.click()), 800, { closing: true });
  await sleep(400);
  await measure(page, `${W} sheet opens: Hearing topic`, 'dialog.sheet[open]', () => page.waitForSelector('#f-hearing .pickrow', { timeout: 15000 }).then(() => page.click('#f-hearing .pickrow')), 800);
  await sleep(500);
  await measure(page, `${W} sheet closes: Hearing topic (Done)`, 'dialog.sheet[open]', () => clickText(page, 'dialog[open] button', /^Done$/), 800, { closing: true });
  await sleep(400);
  await measure(page, `${W} sheet closes by the phone's Back`, 'dialog.sheet[open]', async () => { await clickText(page, 'button', /^Scoring$/); await sleep(700); await page.evaluate(() => history.back()); }, 1500, { closing: true });
  await sleep(400);
  // the time wheel: open, roll two rows, Done
  await measure(page, `${W} time wheel opens`, 'dialog.sheet[open]', () => page.waitForSelector('#f-sleptAt-btn', { timeout: 15000 }).then(() => page.click('#f-sleptAt-btn')), 800);
  await sleep(500);
  await measure(page, `${W} wheel rolls (the rows)`, 'dialog[open] .wheel', () => page.evaluate(() => { const w = document.querySelector('dialog[open] .wheel-scroll'); w.scrollBy({ top: 88, behavior: 'smooth' }); }), 900, { wheel: true, expectMove: false });
  await sleep(300);
  await measure(page, `${W} time wheel closes (Done)`, 'dialog.sheet[open]', () => clickText(page, 'dialog[open] button', /^Done$/), 800, { closing: true });
  await page.close();
}
// ---- the desktop (1280 px): the Filters sheet and its Sort wheel turned by a trackpad, the sidebar's pages, Add staff
{
  const W = '[desktop]';
  const page = await session('master', 'master-pass-1', 1280, false);
  await page.evaluate(() => { location.hash = '#/members'; }); await waitForText(page, 'button', /^Filters/); await sleep(400);
  await measure(page, `${W} sheet opens: Filters`, 'dialog.sheet[open]', () => clickText(page, 'button', /^Filters/), 800);
  await sleep(500);
  const wheelBox = await page.evaluate(() => { const w = [...document.querySelectorAll('dialog[open] .wheel-scroll, dialog[open] [id*=sort]')].find((x) => x.offsetParent); if (!w) return null; w.scrollIntoView({ block: 'center' }); const r = w.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (wheelBox) {
    await page.mouse.move(wheelBox.x, wheelBox.y);
    await measure(page, `${W} Sort wheel turned by the trackpad (the rows)`, 'dialog[open] .wheel', async () => { for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: 16 }); await sleep(16); } }, 1000, { wheel: true, expectMove: false });
  } else { const sortBtn = await clickText(page, 'dialog[open] button', /Sort|Name/); await sleep(600); console.log('   (no inline wheel in Filters; opened', sortBtn, ')'); }
  await sleep(300);
  await measure(page, `${W} sheet closes: Filters (Escape)`, 'dialog.sheet[open]', () => page.keyboard.press('Escape'), 800, { closing: true });
  await sleep(400);
  for (const [from, to] of [['#/members', '#/coordinators'], ['#/coordinators', '#/ids']]) {
    await measure(page, `${W} sidebar: ${from} → ${to} (the page)`, '.content', () => page.evaluate((h) => { location.hash = h; }, to), 900, { page: true });
    await sleep(500);
  }
  await measure(page, `${W} back (the page)`, '.content', () => page.evaluate(() => history.back()), 900, { page: true });
  await sleep(500);
  await page.evaluate(() => { location.hash = '#/coordinators'; }); await sleep(1200);
  await measure(page, `${W} sheet opens: Add staff`, 'dialog.sheet[open]', () => clickText(page, 'button', /^Add staff$/), 800);
  await sleep(500);
  await measure(page, `${W} sheet closes: Add staff (Cancel)`, 'dialog.sheet[open]', () => clickText(page, 'dialog[open] button', /^Cancel$/), 800, { closing: true });
  await page.close();
}
// ---- Reduce Motion on (phone): sheets in place at once, no slides, no page animation
{
  const W = '[reduce motion]';
  const page = await session('6000000001', 'pass-12345', 390, false, true);
  await measure(page, `${W} forward: Home → Week`, '.content', () => page.evaluate(() => { location.hash = '#/week'; }), 600, { reduced: 'page' });
  await sleep(300);
  await measure(page, `${W} menu opens`, 'dialog.drawer[open]', () => page.evaluate(() => document.querySelector('button[aria-label="Open menu"]')?.click()), 500, { reduced: 'open' });
  await measure(page, `${W} menu closes`, 'dialog.drawer[open]', () => page.keyboard.press('Escape'), 500, { reduced: 'close' });
  const { weekId, date } = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const h = await call('home.get', {}); const w = h.weeks.at(-1); return { weekId: w.weekId, date: w.days.filter((x) => !x.future).at(-1).date }; });
  await page.evaluate((h) => { location.hash = h; }, `#/day/${weekId}/${date}`); await page.waitForSelector('#rounds'); await waitForText(page, 'button', /^Scoring$/); await sleep(400);
  await measure(page, `${W} sheet opens: How your day is scored`, 'dialog.sheet[open]', () => clickText(page, 'button', /^Scoring$/), 500, { reduced: 'open' });
  await measure(page, `${W} sheet closes (✕)`, 'dialog.sheet[open]', () => page.evaluate(() => document.querySelector('dialog[open] [aria-label="Close"]')?.click()), 500, { reduced: 'close' });
  await measure(page, `${W} time wheel opens`, 'dialog.sheet[open]', () => page.waitForSelector('#f-sleptAt-btn', { timeout: 15000 }).then(() => page.click('#f-sleptAt-btn')), 500, { reduced: 'open' });
  await measure(page, `${W} time wheel closes (Done)`, 'dialog.sheet[open]', () => clickText(page, 'dialog[open] button', /^Done$/), 500, { reduced: 'close' });
  await page.close();
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
