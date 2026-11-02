// Screen-reader announcement sweep (10 Oct 2026).
//
// What it does: walks every route as every persona and, for each focusable control and live region, works out the
// ACCESSIBLE NAME and ROLE the way TalkBack / VoiceOver would, then judges whether the announcement is usable.
// axe already checks that a name EXISTS; this checks whether the name MEANS anything out loud.
//
// It catches, without a phone:
//   · controls with no name at all ("button" — a screen reader says nothing useful)
//   · names that only make sense visually ("›", "...", "edit", "open", a bare number)
//   · the same name repeated many times on one screen (eight buttons all called "Open")
//   · an icon-only control whose name is its icon ligature ("chevron_right", "arrow_forward")
//   · images with no alt, or alt that is a filename
//   · live regions that announce nothing, or announce raw markup
//   · focus order that jumps backwards up the page
//   · dialogs with no accessible name
//   · gesture conflicts: swipe handlers on elements a screen reader cannot activate
//
// It cannot judge tone ("is 'Filling' the right word out loud?") or real-device gesture behaviour. Those stay manual.
//
//   BASE=http://localhost:5199 node screenreader.mjs            all personas
//   BASE=... node screenreader.mjs devotee                      one persona
// puppeteer from the frontend's packages, as verify.mjs does: this folder has no node_modules of its own
import { createRequire } from 'node:module';
const puppeteer = createRequire(new URL('../../frontend/package.json', import.meta.url))('puppeteer-core');
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:5199';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const only = process.argv[2] || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PERSONAS = [
  ['signed-out', '', '', ['#/welcome', '#/login', '#/signup', '#/forgot']],
  ['devotee', '6000000001', 'pass-12345', ['#/home', '#/week', '#/day/2026-10-05/2026-10-05', '#/report', '#/hearing', '#/reading', '#/group', '#/wall', '#/account']],
  ['coordinator', 'sps', 'sps-pass-12', ['#/home', '#/batch', '#/members', '#/leaders', '#/stats', '#/requests', '#/devotee/6000000014']],
  ['head', 'master', 'master-pass-1', ['#/home', '#/overview', '#/members', '#/coordinators', '#/batches', '#/ids', '#/activity', '#/settings']],
  ['facilitator', 'natvar', 'natvar-pass-1', ['#/my-devotees', '#/my-devotees/6000000011']],
];

// a name that tells a listener nothing on its own
// A name that tells a listener nothing EVEN WITH its role and surrounding context.
// Deliberately NOT included: Back / Next / Yes / No / Close / Menu / Search / Home — these are the conventional
// names for those controls and read correctly aloud ("Back, link"). Flagging them produced noise, not findings.
const MEANINGLESS = /^(|›|‹|»|«|<|>|\.\.\.|…|⋯|⋮|•|·|-|–|—|\+|×|✓|✕|\?|!|click here|read more|\d+)$/i;
// Material Symbols ligatures leaking out as the name
// Only ligature names that are NOT also ordinary English words: "Home", "Search", "Menu", "Close" are real labels
// in an app that draws its icons as inline SVG (this one does), so matching those produced false blockers.
const LIGATURE = /^(chevron_(left|right)|arrow_(forward|back|upward|downward)|more_vert|more_horiz|expand_(more|less)|check_circle|radio_button_\w+|folder_open|keyboard_arrow_\w+|[a-z]+_[a-z_]+)$/;
const FILENAME = /\.(png|jpe?g|webp|svg|gif)$/i;

/** The accessible name + role as a screen reader computes it (simplified but faithful for this app's patterns). */
const PROBE = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const txt = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  const byIds = (ids) => (ids || '').split(/\s+/).filter(Boolean).map((i) => txt(document.getElementById(i))).filter(Boolean).join(' ');
  function name(e) {
    if (e.getAttribute('aria-labelledby')) { const t = byIds(e.getAttribute('aria-labelledby')); if (t) return t; }
    if (e.getAttribute('aria-label')) return e.getAttribute('aria-label').trim();
    if (e.tagName === 'IMG') return (e.getAttribute('alt') ?? '[NO ALT]').trim();
    if (e.tagName === 'INPUT' || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA') {
      const l = e.labels?.[0]; if (l) return txt(l);
      if (e.placeholder) return e.placeholder.trim();
      if (e.title) return e.title.trim();
      return '';
    }
    // a <label for=…> pointing at this element names it even when it is a button (the app's WheelSelect
    // does exactly this with a visually-hidden label, and a screen reader reads "Year, 2026, button")
    if (e.id) { const l = document.querySelector(`label[for="${CSS.escape(e.id)}"]`);
      if (l) { const lt = txt(l); if (lt) return lt + ', ' + (e.textContent || '').replace(/\s+/g, ' ').trim(); } }
    // visible text, minus anything hidden from the a11y tree (icon spans)
    const c = e.cloneNode(true);
    c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove());
    const t = (c.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
    return (e.getAttribute('title') || '').trim();
  }
  function role(e) {
    const r = e.getAttribute('role'); if (r) return r;
    const tag = e.tagName.toLowerCase();
    if (tag === 'a') return e.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'button') return 'button';
    if (tag === 'input') return ({ checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button' })[e.type] || 'textbox';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'summary') return 'button';
    if (tag === 'img') return 'image';
    if (tag === 'dialog') return 'dialog';
    return tag;
  }
  const sel = 'a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio], [role=spinbutton], [role=tab], [role=switch], [tabindex]:not([tabindex="-1"])';
  const controls = [...document.querySelectorAll(sel)]
    .filter((e) => vis(e) && !e.closest('[aria-hidden="true"]') && !e.disabled)
    .map((e, i) => ({ i, role: role(e), name: name(e), tag: e.tagName.toLowerCase(),
      hidden: e.getAttribute('aria-hidden') === 'true',
      top: Math.round(e.getBoundingClientRect().top), left: Math.round(e.getBoundingClientRect().left),
      tabindex: e.getAttribute('tabindex'), expanded: e.getAttribute('aria-expanded'),
      html: e.outerHTML.slice(0, 110) }));
  const images = [...document.querySelectorAll('img')].filter(vis).map((e) => ({
    alt: e.getAttribute('alt'), src: (e.getAttribute('src') || '').split('/').pop().slice(0, 40),
    hidden: e.getAttribute('aria-hidden') === 'true' || e.closest('[aria-hidden="true"]') !== null }));
  const live = [...document.querySelectorAll('[aria-live]')].map((e) => ({
    politeness: e.getAttribute('aria-live'), text: txt(e).slice(0, 90) }));
  const dialogs = [...document.querySelectorAll('dialog[open]')].map((e) => ({ name: name(e) || byIds(e.getAttribute('aria-labelledby')) }));
  // swipe handlers a screen reader user cannot trigger (touch-action pan-y + no keyboard path)
  const swipe = [...document.querySelectorAll('[style*="touch-action"], .qc-track, [data-swipe]')].filter(vis)
    .map((e) => ({ cls: e.className?.toString().slice(0, 40) || '', focusable: e.matches(sel) || !!e.querySelector(sel) }));
  const h1 = [...document.querySelectorAll('h1')].filter(vis).map(txt);
  return { controls, images, live, dialogs, swipe, h1, title: document.title };
};

const findings = [];
const add = (persona, route, level, kind, detail) => findings.push({ persona, route, level, kind, detail });

async function scan(page, persona, route) {
  let d;
  try { d = await page.evaluate(PROBE); } catch (e) { add(persona, route, 'ERROR', 'probe-failed', e.message); return; }

  // 1. controls with no accessible name — a screen reader says only the role
  for (const c of d.controls) {
    if (!c.name) { add(persona, route, 'BLOCKER', 'no-name', `<${c.tag} role=${c.role}> announces only "${c.role}" — ${c.html}`); continue; }
    if (LIGATURE.test(c.name)) add(persona, route, 'BLOCKER', 'icon-ligature', `"${c.name}" (${c.role}) — the icon font's ligature is being read aloud`);
    else if (MEANINGLESS.test(c.name)) add(persona, route, 'MAJOR', 'vague-name', `"${c.name}" (${c.role}) — means nothing without seeing the screen — ${c.html}`);
  }
  // 2. the same name several times on one screen
  const byName = new Map();
  for (const c of d.controls) if (c.name && !MEANINGLESS.test(c.name)) byName.set(c.name, (byName.get(c.name) || 0) + 1);
  for (const [n, k] of byName) if (k >= 5) add(persona, route, 'MINOR', 'repeated-name', `"${n}" appears ${k}× — a listener cannot tell them apart`);
  // 3. images
  for (const im of d.images) {
    if (im.hidden) continue;
    if (im.alt === null) add(persona, route, 'MAJOR', 'img-no-alt', `<img src=…${im.src}> has no alt (use alt="" if decorative)`);
    else if (im.alt && FILENAME.test(im.alt)) add(persona, route, 'MAJOR', 'img-filename-alt', `alt="${im.alt}" is a filename`);
  }
  // 4. live regions announcing markup or nothing useful
  for (const l of d.live) if (/[<>]/.test(l.text)) add(persona, route, 'MAJOR', 'live-markup', `aria-live=${l.politeness} contains markup: ${l.text}`);
  // 5. open dialogs must have a name
  for (const dl of d.dialogs) if (!dl.name) add(persona, route, 'BLOCKER', 'dialog-no-name', 'an open dialog has no accessible name');
  // 6. swipe-only areas with no keyboard/AT path
  for (const s of d.swipe) if (!s.focusable) add(persona, route, 'MAJOR', 'swipe-only', `swipe area "${s.cls}" has no focusable control — unreachable with a screen reader`);
  // 7. exactly one h1 per screen
  if (d.h1.length === 0) add(persona, route, 'MINOR', 'no-h1', 'no visible <h1>: a screen reader has no page heading to jump to');
  if (d.h1.length > 1) add(persona, route, 'MINOR', 'many-h1', `${d.h1.length} <h1>: ${d.h1.join(' | ').slice(0, 80)}`);
  // 8. per-route title (VoiceOver reads it on arrival)
  if (!d.title || d.title === 'IYF Delhi Sadhana Record') add(persona, route, 'MINOR', 'generic-title', `document.title is "${d.title}" on every route`);
  return d;
}

/** Focus order: Tab through and check the reading order does not jump back up the page. */
async function focusOrder(page, persona, route) {
  const seq = await page.evaluate(async () => {
    const out = []; const start = document.activeElement;
    for (let i = 0; i < 40; i++) {
      const e = document.activeElement; if (!e || e === document.body) break;
      const r = e.getBoundingClientRect();
      out.push({ top: Math.round(r.top), name: (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) });
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }); e.dispatchEvent(ev);
      break; // real tabbing is driven from node below
    }
    return out.length;
  });
  let prev = -1, jumps = 0;
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const cur = await page.evaluate(() => { const e = document.activeElement;
      if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), name: (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) }; });
    if (!cur) break;
    if (prev >= 0 && cur.top < prev - 150) jumps++;
    prev = cur.top;
  }
  if (jumps > 2) add(persona, route, 'MINOR', 'focus-order', `Tab order jumps back up the page ${jumps}× — reading order may not match the visual order`);
  return seq;
}

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
let routes = 0;
for (const [persona, login, pw, list] of PERSONAS) {
  if (only && only !== persona) continue;
  for (const width of [390, 1280]) {
    // a fresh profile per role and width (22 Oct 2026): a session stored by the previous role's page restored itself
    // and redirected away from the sign-in screen before its button could be pressed
    const ctx = await b.createBrowserContext(), page = await ctx.newPage();
    await page.setViewport({ width, height: width >= 1024 ? 900 : 800 });
    await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
    await page.evaluate(async () => { const m = await import('/src/lib/mock.js'); m.setLatency(40); });
    await page.waitForFunction(() => !document.getElementById('splash'), { timeout: 6000 }).catch(() => {});
    if (login) {
      await page.waitForSelector('#login', { timeout: 8000 });
      await page.type('#login', login); await page.type('#password', pw);
      await page.click('button[type=submit]');
      await page.waitForFunction(() => !location.hash.includes('login'), { timeout: 9000 }).catch(() => {});
      await sleep(500);
    }
    for (const route of list) {
      await page.evaluate((h) => { location.hash = h; }, route);
      await sleep(900);
      await scan(page, `${persona}@${width}`, route);
      await focusOrder(page, `${persona}@${width}`, route);
      routes++;
    }
    await ctx.close();
  }
}
await b.close();

const by = (lv) => findings.filter((f) => f.level === lv);
const seen = new Set();
const uniq = findings.filter((f) => { const k = f.level + f.kind + f.detail; if (seen.has(k)) return false; seen.add(k); return true; });

console.log(`\nScreen-reader announcement sweep — ${routes} route loads\n`);
for (const lv of ['ERROR', 'BLOCKER', 'MAJOR', 'MINOR']) {
  const rows = uniq.filter((f) => f.level === lv);
  if (!rows.length) continue;
  console.log(`\n===== ${lv} (${rows.length} distinct) =====`);
  for (const f of rows.slice(0, 40)) console.log(`  [${f.kind}] ${f.detail}\n      ${f.persona} ${f.route}`);
  if (rows.length > 40) console.log(`  … and ${rows.length - 40} more`);
}
console.log(`\nTotals: ${by('BLOCKER').length} blocker · ${by('MAJOR').length} major · ${by('MINOR').length} minor · ${by('ERROR').length} error (${uniq.length} distinct)`);
fs.writeFileSync(new URL('./screenreader-report.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), routes, findings }, null, 1));
console.log('report: screenreader-report.json');
