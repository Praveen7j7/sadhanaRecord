// Real mobile browsers: iPhone Safari (iOS Simulator, via safaridriver) and Android Chrome (emulator, via adb + the
// DevTools socket). The same checks on both:
//   live (production, signed out): welcome, login, look tier, theme, no sideways scroll
//   app with the mock data (this Mac's dev server, the same code as live): home, bar, week statuses, day form,
//   sheets (✕, tap outside, Escape / Back), staff board statuses, the staff day view, the theme row
// iOS note: taps are the element's click() (safaridriver's touch taps never click on this simulator); Android taps are real.
// Usage:  node phone-check.mjs ios      (safaridriver must be running: safaridriver -p 4447)
//         node phone-check.mjs android  (emulator running; adb forward tcp:9222 localabstract:chrome_devtools_remote)
// Screenshots: tools/devices/results/<platform>/
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const PLATFORM = process.argv[2] || 'ios';
const LIVE = 'https://sadhana-record.iyfdelhi-sadhana.workers.dev';
const APP = process.env.APP || 'http://localhost:5195'   // Android reaches it through adb reverse tcp:5195 tcp:5195 (localhost is a secure context);
const OUT = new URL(`./results/${PLATFORM}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (c, m) => { results.push((c ? 'PASS ' : 'FAIL ') + m); console.log((c ? 'PASS ' : 'FAIL ') + m); };

// ---- the two drivers, one shape: go(url) · run(fn, ...args) (async, in the page) · tap(css) · type(css, text) · key(name) · shot(name)
async function iosDriver() {
  const WD = process.env.WD || 'http://localhost:4447';
  const req = async (method, path, body) => { const r = await fetch(WD + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (j.value?.error) throw new Error(path + ': ' + j.value.message); return j.value; };
  const s = await req('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari', platformName: 'iOS', 'safari:useSimulator': true, 'safari:deviceType': 'iPhone' } } });
  const sid = s.sessionId, P = `/session/${sid}`;
  const el = async (css) => Object.values(await req('POST', P + '/element', { using: 'css selector', value: css }))[0];
  return {
    name: `${s.capabilities['safari:deviceName']} · iOS ${s.capabilities['safari:platformVersion']} · Safari ${s.capabilities.browserVersion}`,
    go: (url) => req('POST', P + '/url', { url }),
    run: (fn, ...args) => req('POST', P + '/execute/async', { script: `const done = arguments[arguments.length - 1]; Promise.resolve((${fn}).apply(null, Array.from(arguments).slice(0, -1))).then(done, (e) => done({ __err: String(e) }));`, args }),
    // safaridriver's simulated taps on the iOS 27 simulator give touchstart but never a click (even on a plain test page):
    // so on iOS a tap is the element's own click(), and a tap outside is a pointerdown + click at that point
    tap: async (css) => req('POST', P + '/execute/sync', { script: 'const e = document.querySelector(arguments[0]); e.scrollIntoView({ block: "center" }); e.click();', args: [css] }),
    // typing goes the same way (the field's value, then the input event the app listens to)
    type: async (css, text) => req('POST', P + '/execute/sync', { script: 'const e = document.querySelector(arguments[0]); e.focus(); e.value = (e.value || "") + arguments[1]; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true }));', args: [css, text] }),
    key: (k) => req('POST', P + '/actions', { actions: [{ type: 'key', id: 'kb', actions: [{ type: 'keyDown', value: k === 'Escape' ? '' : k }, { type: 'keyUp', value: k === 'Escape' ? '' : k }] }] }),
    back: () => req('POST', P + '/back', {}),
    tapAt: (x, y) => req('POST', P + '/execute/sync', { script: 'const [x, y] = arguments, t = document.elementFromPoint(x, y); for (const [T, C] of [["pointerdown", PointerEvent], ["pointerup", PointerEvent], ["click", MouseEvent]]) t.dispatchEvent(new C(T, { bubbles: true, clientX: x, clientY: y }));', args: [x, y] }),
    shot: async (name) => writeFileSync(OUT + name + '.png', Buffer.from(await req('GET', P + '/screenshot'), 'base64')),
    quit: () => req('DELETE', P),
  };
}
async function androidDriver() {
  const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
  const puppeteer = require('puppeteer-core');
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = (await b.pages())[0] || (await b.newPage());
  const ADB = new URL('./android-sdk/platform-tools/adb', import.meta.url).pathname;
  const ver = await b.version();
  return {
    name: `Android emulator · ${execSync(`${ADB} shell getprop ro.build.version.release`).toString().trim() ? 'Android ' + execSync(`${ADB} shell getprop ro.build.version.release`).toString().trim() : ''} · ${ver}`,
    go: (url) => page.goto(url, { waitUntil: 'load' }),
    run: (fn, ...args) => page.evaluate(`(${fn})(...${JSON.stringify(args)})`),
    tap: async (css) => (await page.$(css)).tap(),
    type: async (css, text) => { await page.focus(css); await page.keyboard.type(text); },
    key: (k) => page.keyboard.press(k),
    back: () => { execSync(`${ADB} shell input keyevent 4`); },          // the phone's own Back
    tapAt: (x, y) => page.touchscreen.tap(x, y),
    shot: (name) => page.screenshot({ path: OUT + name + '.png' }),
    quit: () => b.disconnect(),
  };
}

const d = PLATFORM === 'android' ? await androidDriver() : await iosDriver();
console.log('device:', d.name);
const W = `[${PLATFORM}]`;
const state = () => d.run(() => ({ w: innerWidth, h: innerHeight, over: document.documentElement.scrollWidth > innerWidth + 1, tier: document.documentElement.dataset.tier, theme: document.documentElement.dataset.theme, hash: location.hash }));
// sign in: Android submits with the keyboard's Enter (a tap computed while the on-screen keyboard is up can land on the
// button below it); iOS uses the button
const submit = () => (PLATFORM === 'android' ? d.key('Enter') : d.tap('button[type=submit]'));
const waitFor = async (css, ms = 15000) => { for (let t = 0; t < ms; t += 300) { if (await d.run((c) => !!document.querySelector(c), css)) return true; await sleep(300); } return false; };

// ---------------- live (production): signed-out screens ----------------
await d.go(LIVE + '/#/welcome');
ok(await waitFor('.welcome'), `${W} live: the welcome screen opens`);
await sleep(1800);
let s = await state();
ok(['high', 'balanced', 'low'].includes(s.tier) && !s.over, `${W} live: look tier "${s.tier}", theme ${s.theme}, ${s.w}×${s.h}, no sideways scroll`);
const live = await d.run(() => [...document.scripts].map((x) => x.src).find((x) => x.includes('/assets/index-'))?.split('/').pop());
ok(!!live, `${W} live build: ${live}`);
await d.shot('live-welcome');
await d.tap('a[href="#/login"]');
ok(await waitFor('#login'), `${W} live: Login opens from Welcome`);
await d.shot('live-login');

// ---------------- the app with mock data (same code as live) ----------------
// start signed out with nothing kept from an earlier run (the phone's browser keeps its storage between runs)
await d.go(APP + '/#/welcome'); await sleep(1500);
await d.run(async () => { try { localStorage.clear(); sessionStorage.clear(); for (const db of (await indexedDB.databases?.()) || []) indexedDB.deleteDatabase(db.name); } catch { /* nothing kept */ } });
// to the login screen; tried again if a slow load (both phones at once on one dev server) left it on Welcome
let atLogin = false;
for (let i = 0; i < 3 && !atLogin; i++) {
  await d.go(APP + '/#/login'); await sleep(500); await d.run(() => location.reload()); await sleep(2500);
  if (!(await d.run(() => location.hash === '#/login'))) await d.run(() => { location.hash = '#/login'; });
  atLogin = await waitFor('#login');
}
ok(atLogin, `${W} app: the login screen (mock data)`);
await d.run(async () => {
  const m = await import('/src/lib/mock.js'); m.setLatency(0); m.setNow('2026-10-11T19:00:00+05:30');
  const call = async (t, a, x) => { const r = await m.handle({ v: 1, action: a, token: t, requestId: crypto.randomUUID(), data: x }); if (!r.ok) throw new Error(a + JSON.stringify(r.error)); return r.data; };
  const t = (await call(undefined, 'auth.login', { login: '6000000001', password: 'pass-12345' })).token;
  const lec = (await call(t, 'journals.get', {})).lectures[0];
  const base = { sleptAt: '22:10', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 20, serviceMin: 60 };
  for (let i = 0; i < 6; i++) await call(t, 'week.saveDay', { weekId: '2026-10-05', date: '2026-10-' + String(5 + i).padStart(2, '0'), version: 0, day: { ...base, hearingMin: 35, hearing: [{ lectureId: lec.lectureId }, { text: 'Sunday feast class' }], readingMin: 25, reading: { bookId: 'B03' } } });
});
await sleep(2000);
await d.type('#login', '6000000001'); await d.type('#password', 'pass-12345');
await submit();
ok(await waitFor('.qc'), `${W} app: signed in, Home shows`);
await sleep(800);
s = await state();
const bar = await d.run(() => { const n = document.querySelector('nav.nav'), r = n.getBoundingClientRect(); return { items: [...n.querySelectorAll('a')].filter((a) => getComputedStyle(a).display !== 'none').map((a) => a.lastElementChild.firstChild.textContent.trim()), bottom: r.bottom, h: innerHeight }; });
// (this devotee also leads a group: the bar then has Group too)
ok(['Home|Week|Report|Account', 'Home|Week|Group|Report|Account'].includes(bar.items.join('|')) && bar.bottom <= bar.h, `${W} app: bottom bar ${bar.items.join(', ')}, inside the screen (${Math.round(bar.bottom)} ≤ ${bar.h})`);
ok(!s.over, `${W} app: Home, no sideways scroll at ${s.w}px`);
await d.shot('app-home');

// Week: the dot-and-word statuses
await d.go(APP + '/#/week/2026-10-05'); await sleep(1500);
const st = await d.run(() => [...document.querySelectorAll('.status')].map((e) => ({ t: e.textContent.trim(), dot: getComputedStyle(e, '::before').content !== 'none' && getComputedStyle(e, '::before').width !== 'auto' })));
ok(st.length > 0 && st.every((x) => x.t && x.dot), `${W} app: Week shows statuses as a dot and a word (${st.map((x) => x.t).slice(0, 4).join(', ')})`);
ok(!(await state()).over, `${W} app: Week, no sideways scroll`);
await d.shot('app-week');

// Day form and its sheet: ✕, tap outside, Escape / Back
await d.go(APP + '/#/day/2026-10-05/2026-10-11'); await waitFor('.rulesnote');
const openRules = async () => { await d.tap('.rulesnote'); await sleep(700); return d.run(() => { const x = document.querySelector('dialog.rules-sheet'); if (!x?.open) return null; const r = x.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: innerWidth, h: innerHeight }; }); };
let r = await openRules();
ok(!!r && Math.abs(r.bottom - r.h) < 3 && r.left < 2, `${W} app: "How your day is scored" opens as a bottom sheet`);
await d.shot('app-day-sheet');
await d.tap('dialog.rules-sheet[open] button[aria-label="Close"]'); await sleep(600);
ok(await d.run(() => !document.querySelector('dialog.rules-sheet')?.open), `${W} app: the sheet's ✕ closes it`);
r = await openRules();
if (r) { await d.tapAt(r.w / 2, Math.max(8, r.top / 2)); await sleep(700); }
ok(await d.run(() => !document.querySelector('dialog.rules-sheet')?.open), `${W} app: a tap outside the sheet closes it`);
r = await openRules();
if (PLATFORM === 'android') await d.back(); else await d.key('Escape');
await sleep(700);
ok(await d.run(() => !document.querySelector('dialog.rules-sheet')?.open && location.hash.startsWith('#/day/')), `${W} app: ${PLATFORM === 'android' ? "the phone's Back button" : 'Escape'} closes the sheet and stays on the day`);
// whatever Back did, carry on from the day form (and with no sheet left open)
if (!(await d.run(() => location.hash.startsWith('#/day/')))) { await d.go(APP + '/#/day/2026-10-05/2026-10-11'); await waitFor('#f-sleptAt-btn'); }
await d.run(() => document.querySelector('dialog.rules-sheet[open]')?.close()); await sleep(300);
// the time wheel sheet
await d.tap('#f-sleptAt-btn'); await sleep(800);
const wheel = await d.run(() => { const x = document.querySelector('dialog.tp-sheet[open]'); return x ? { rows: x.querySelectorAll('.wheel-row[data-value]').length, btns: [...x.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t === 'Cancel' || t === 'Done').length } : null; });
ok(wheel && wheel.rows > 10 && wheel.btns === 2, `${W} app: the time wheel opens with Cancel and Done (${JSON.stringify(wheel)})`);
await d.shot('app-time-wheel');
await d.run(() => [...document.querySelectorAll('dialog.tp-sheet[open] button')].find((b) => b.textContent.trim() === 'Cancel').click()); await sleep(500);
ok(!(await state()).over, `${W} app: Day form, no sideways scroll`);

// Account and the theme row
await d.go(APP + '/#/account'); await sleep(1500);
ok(await d.run(() => ![...document.querySelectorAll('main h3')].some((h) => /Appearance/.test(h.textContent))), `${W} app: Account has no Appearance section`);
await d.tap('.menu-btn'); await sleep(800);
// one fixed row (the head, 5 Oct 2026): each tap moves on, Automatic → Light → Dark → Automatic; no list of choices
const themeRow = () => d.run(() => document.querySelector('dialog.drawer [id$="-theme"]').getAttribute('aria-label'));
ok(/^Theme: Automatic/.test(await themeRow()) && !(await d.run(() => !!document.querySelector('dialog.drawer [role=radio]'))), `${W} app: the Theme row says Automatic, no list of choices`);
await d.tap('dialog.drawer [id$="-theme"]'); await sleep(500);
ok((await state()).theme === 'light' && /^Theme: Light/.test(await themeRow()), `${W} app: one tap: Light`);
await d.tap('dialog.drawer [id$="-theme"]'); await sleep(500);
ok((await state()).theme === 'dark' && /^Theme: Dark/.test(await themeRow()), `${W} app: another tap: Dark`);
await d.shot('app-theme-menu');
await d.tap('dialog.drawer [id$="-theme"]'); await sleep(500);
ok(/^Theme: Automatic/.test(await themeRow()), `${W} app: a third tap: back to Automatic`);
const menu = await d.run(() => ({ vis: [...document.querySelectorAll('dialog.drawer a.mi')].filter((a) => a.getClientRects().length).map((a) => a.getAttribute('href')), issue: !!document.querySelector('dialog.drawer a[href^="mailto:praveenj811@gmail.com"]') }));
ok(!menu.vis.includes('#/week') && !menu.vis.includes('#/report') && menu.issue, `${W} app: the menu leaves out This week and Report (on the bar) and has Report issue`);
await d.run(() => document.querySelector('dialog.drawer').close()); await sleep(400);
// Report: Daily and Weekly each inside its button (the head's phone, 5 Oct 2026: "Weekly" spilled out)
await d.go(APP + '/#/report'); await waitFor('#rp-mode'); await sleep(800);
const tg = await d.run(() => { const g = document.querySelector('#rp-mode').getBoundingClientRect(); return [...document.querySelectorAll('#rp-mode button')].every((b) => { const r = b.getBoundingClientRect(); return b.scrollWidth <= b.clientWidth + 1 && r.left >= g.left - 1 && r.right <= g.right + 1; }); });
ok(tg && !(await state()).over, `${W} app: Report, Daily and Weekly each inside its button`);
await d.shot('app-report-toggle');

// Account › Delete account (phase 9): opened and cancelled only, never confirmed (mock data)
await d.go(APP + '/#/account'); await waitFor('#h-del'); await sleep(800);
await d.run(() => { const b = [...document.querySelectorAll('button')].find((x) => /Delete my account/.test(x.textContent)); b.scrollIntoView({ block: 'center' }); b.click(); });
const sheetUp = await waitFor('dialog.da-sheet[open] #da-pw', 8000);
const del = () => d.run(() => { const b = [...document.querySelectorAll('dialog.da-sheet[open] button[type=submit]')][0]; return { disabled: !!b?.disabled, over: document.documentElement.scrollWidth > innerWidth + 1, warn: /can't be undone/.test(document.querySelector('dialog.da-sheet[open]')?.textContent || '') }; });
const d0 = await del();
ok(sheetUp && d0.disabled && d0.warn && !d0.over, `${W} app: Delete account opens a sheet (password + DELETE), warns it can't be undone, Delete disabled until both are filled`);
await d.shot('app-delete-account');
await d.run(() => [...document.querySelectorAll('dialog.da-sheet[open] button')].find((b) => b.textContent.trim() === 'Cancel').click()); await sleep(600);
ok(!(await d.run(() => !!document.querySelector('dialog.da-sheet[open]'))) && (await state()).hash.startsWith('#/account'), `${W} app: Cancel closes it, still on Account, nothing deleted`);

// staff: the batch board's statuses and the day view with hearing and reading
await d.go(APP + '/#/login'); await sleep(1500);
await d.run(async () => { const { logout } = await import('/src/lib/session.svelte.js'); await logout(); });
await sleep(1500);
await d.go(APP + '/#/login'); await waitFor('#login');
await d.type('#login', 'sps'); await d.type('#password', 'sps-pass-12'); await submit();
await sleep(2500);
await d.go(APP + '/#/batch'); await sleep(2500);
const bs = await d.run(() => [...document.querySelectorAll('main .status')].map((e) => e.textContent.trim()));
ok(bs.length > 3 && bs.every(Boolean), `${W} staff: the batch board shows dot-and-word statuses (${[...new Set(bs)].join(', ')})`);
ok(!(await state()).over, `${W} staff: batch board, no sideways scroll`);
await d.shot('staff-board');
await d.go(APP + '/#/devotee/6000000001/week/2026-10-05'); await waitFor('.wr-day');
await d.run(() => document.querySelector('.wr-day:not(:disabled)')?.click()); await sleep(900);
const dp = await d.run(() => ({ shown: !!document.querySelector('.wr-dayrep'), text: document.querySelector('.dp')?.textContent.replace(/\s+/g, ' ').trim() || '' }));
ok(dp.shown && /Hearing|Reading/.test(dp.text), `${W} staff: a devotee's day with "That day's practice" (${dp.text.slice(0, 80)})`);
ok(!(await state()).over, `${W} staff: day view, no sideways scroll`);
await d.shot('staff-day');

await d.quit();
writeFileSync(OUT + 'results.txt', `${d.name}\n${results.join('\n')}\n`);
console.log(`\n${d.name}\n${results.filter((x) => x.startsWith('PASS')).length} passed, ${results.filter((x) => x.startsWith('FAIL')).length} failed`);
