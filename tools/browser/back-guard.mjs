// The held Back on a form with unsaved changes (10 Oct 2026, the head's phone recording: "as soon as I want to go back it
// shivers and then pops up"). Back on a dirty day form must ask ONCE: the question opens and stays open, the page is
// not re-shown (no view transition, no slide), the address stays on the day; Discard then goes Back (one step, no new
// entry); Stay keeps everything. Also: a Back the browser animated itself (hasUAVisualTransition) is not animated again.
//   BASE=http://localhost:5195 node tools/browser/back-guard.mjs
import { createRequire } from 'node:module';
const puppeteer = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/package.json')('puppeteer-core');
const BASE = process.env.BASE || 'http://localhost:5195';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); c ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A fixed clock (12 Oct 2026): Monday of this week, 11:00 IST. These checks open "the last non-future day", which on the
// real clock is a different day each day of the week; verify.mjs pins its clock (classDayIso) and these did not. Monday is
// the day every green run so far opened, so pinning to it makes the gate's result the same whatever the calendar says.
const MON_IST = (() => { const ist = new Date(Date.now() + 5.5 * 3600e3), back = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back)).toISOString().slice(0, 10) + 'T11:00:00+05:30'; })();
const browser = await puppeteer.launch({ executablePath: (process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless: true, args: ['--no-sandbox'] });
async function fresh() {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    // count the app's own view transitions
    window.__vt = 0; const o = document.startViewTransition?.bind(document);
    if (o) document.startViewTransition = (cb) => { window.__vt++; return o(cb); };
  });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 8000 }).catch(() => {});
  await page.evaluate(async (c) => { const m = await import('/src/lib/mock.js'); m.setNow(c); }, MON_IST); await page.evaluate(async () => (await import('/src/lib/mock.js')).setLatency(30));
  await page.type('#login', '6000000001'); await page.type('#password', 'pass-12345');
  await page.click('button[type=submit]'); await page.waitForFunction(() => location.hash.startsWith('#/home'), { timeout: 8000 });
  await sleep(600);
  return { page, errors };
}
// A Day form with a change not saved, reached from Home by a link (so Back has somewhere to go)
async function dirtyDay(page) {
  const { weekId, date } = await page.evaluate(async () => { const { call } = await import('/src/lib/api.js'); const h = await call('home.get', {}); const w = h.weeks.at(-1); return { weekId: w.weekId, date: w.days.filter((x) => !x.future).at(-1).date }; });
  await page.evaluate((h) => { location.hash = h; }, `#/day/${weekId}/${date}`);
  await page.waitForSelector('#rounds', { timeout: 8000 }); await sleep(500);
  await page.click('#rounds', { clickCount: 3 }); await page.type('#rounds', '12'); await sleep(300);
  return `#/day/${weekId}/${date}`;
}
// samples the screen every 20 ms for ms: the leave question's open state, the address, the view transitions
async function watch(page, ms, act) {
  await page.evaluate(() => {
    window.__s = []; window.__vt0 = window.__vt;
    const t0 = performance.now();
    const tick = () => { const d = document.getElementById('lv-h')?.closest('dialog'); window.__s.push({ t: Math.round(performance.now() - t0), open: !!d?.open, hash: location.hash }); if (performance.now() - t0 < 2500) setTimeout(tick, 20); };
    tick();
  });
  await act(); await sleep(ms);
  return page.evaluate(() => ({ s: window.__s, vt: window.__vt - window.__vt0 }));
}

// 1. Back on a dirty day: asked once, steady
{
  const { page, errors } = await fresh();
  const day = await dirtyDay(page);
  const lenBefore = await page.evaluate(() => history.length);
  const r = await watch(page, 1600, () => page.evaluate(() => history.back()));
  const opened = r.s.findIndex((x) => x.open);
  const after = r.s.slice(opened);
  ok(opened >= 0, `Back on a dirty day asks "Save changes before leaving?" (after ${r.s[opened]?.t ?? '-'} ms)`);
  ok(opened >= 0 && after.every((x) => x.open), 'the question opens once and stays open (no close and re-open)');
  ok(r.s.at(-1).hash === day, 'the address stays on the day');
  ok(r.vt === 0, `no page transition while the step is undone (${r.vt})`);
  // Discard: one step Back, no new entry
  const idxBefore = await page.evaluate(() => history.state?.i);
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /Discard changes/.test(b.textContent)).click());
  await page.waitForFunction(() => location.hash.startsWith('#/home'), { timeout: 4000 }).catch(() => {});
  await sleep(500);
  const st = await page.evaluate(() => ({ hash: location.hash, i: history.state?.i, len: history.length, open: !!document.querySelector('dialog[open]') }));
  ok(st.hash.startsWith('#/home') && !st.open, 'Discard goes to Home and closes the question');
  ok(st.i === idxBefore - 1 && st.len === lenBefore, `as the one Back step: no new history entry (index ${idxBefore} → ${st.i}, entries ${lenBefore} → ${st.len})`);
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await page.close();
}
// 2. Stay keeps the change; Save leaves with it saved
{
  const { page, errors } = await fresh();
  const day = await dirtyDay(page);
  await page.evaluate(() => history.back()); await sleep(900);
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /^Stay$/.test(b.textContent.trim())).click()); await sleep(400);
  await page.waitForSelector('#rounds', { timeout: 8000 }).catch(() => {});   // Stay keeps the day page: wait for it rather than assume it (12 Oct 2026)
  ok((await page.evaluate(() => location.hash)) === day && (await page.$eval('#rounds', (e) => e.value)) === '12' && !(await page.$('dialog[open]')), 'Stay: the day, the change kept, the question closed');
  const r = await watch(page, 1200, () => page.evaluate(() => history.back()));
  ok(r.s.some((x) => x.open) && r.s.slice(r.s.findIndex((x) => x.open)).every((x) => x.open), 'a second Back asks again, steadily');
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /^Save$/.test(b.textContent.trim())).click());
  await page.waitForFunction(() => location.hash.startsWith('#/home'), { timeout: 5000 }).catch(() => {});
  ok((await page.evaluate(() => location.hash)).startsWith('#/home'), 'Save: saved, then Back to Home');
  await page.evaluate((h) => { location.hash = h; }, day); await page.waitForSelector('#rounds'); await sleep(500);
  ok((await page.$eval('#rounds', (e) => e.value)) === '12', 'the saved change is there when the day is opened again');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await page.close();
}
// 3. A link (not Back) on a dirty day: asked once; Discard follows the link
{
  const { page, errors } = await fresh();
  await dirtyDay(page);
  const r = await watch(page, 1200, () => page.evaluate(() => { location.hash = '#/report'; }));
  ok(r.s.some((x) => x.open) && r.s.slice(r.s.findIndex((x) => x.open)).every((x) => x.open) && r.vt === 0, 'a link on a dirty day asks once, steadily, with no page transition');
  await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find((b) => /Discard changes/.test(b.textContent)).click());
  await page.waitForFunction(() => location.hash.startsWith('#/report'), { timeout: 4000 }).catch(() => {});
  ok((await page.evaluate(() => location.hash)).startsWith('#/report'), 'Discard follows the link to Report');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await page.close();
}
// 4. A Back the browser animated itself is not animated again; a plain Back still is
{
  const { page } = await fresh();
  await page.evaluate(() => { location.hash = '#/report'; }); await sleep(900);
  const plain = await watch(page, 900, () => page.evaluate(() => history.back()));
  ok(plain.vt === 1, `a plain Back slides once (${plain.vt})`);
  await page.evaluate(() => { location.hash = '#/report'; }); await sleep(900);
  // Chrome's gesture: popstate carries hasUAVisualTransition; the hashchange follows
  const ua = await watch(page, 900, () => page.evaluate(() => {
    history.replaceState(history.state, '', '#/home');          // the address changes as the gesture lands
    dispatchEvent(new PopStateEvent('popstate', { state: history.state, hasUAVisualTransition: true }));
    dispatchEvent(new HashChangeEvent('hashchange'));
  }));
  ok(ua.vt === 0 && (await page.evaluate(() => location.hash)).startsWith('#/home'), `a Back the browser animated is not animated again (${ua.vt})`);
  await page.close();
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);   // the gate reads this line
