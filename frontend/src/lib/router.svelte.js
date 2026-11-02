// Tiny hash router: #/path. New pages start at the top; Back / Forward return to where the page was scrolled.
// Route changes use a short view transition where the browser has one (never with reduced motion).
import { tick } from 'svelte';
function read() {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}
export const route = $state({ path: read(), back: false });
/** Set by a screen with changes not saved yet (the day form, the week-end answers): an app update waits for it. */
export const nav = $state({ unsaved: false });
const scrolls = new Map();       // history index → scroll position
/** Runs a DOM change inside a short view transition where supported (one at a time; never with reduced motion). */
let inTransition = false, latest = 0;
export function withTransition(apply) {
  // Every change is numbered; a change still waiting for its transition never runs over a newer one. (Opening the app
  // signed out redirects to the welcome screen inside a transition; a tap on Login before that transition ran was
  // undone by it, and the screen stayed on Welcome.)
  const mine = ++latest;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // none in the low tier (lib/tier.js): a plain swap costs nothing on a slow phone
  if (inTransition || typeof document === 'undefined' || !document.startViewTransition || reduce || document.visibilityState !== 'visible' || document.documentElement.dataset.tier === 'low') return void apply();
  inTransition = true;
  // The change runs once, and only while it is the newest. Chrome can hold a transition's update for seconds (seen
  // right after the app opens): if it has not started within 400 ms, it is skipped and the change is made directly.
  let ran = false;
  const run = () => { if (ran) return; ran = true; if (mine === latest) return apply(); };
  const vt = document.startViewTransition(run);
  for (const p of [vt.ready, vt.finished, vt.updateCallbackDone]) p?.catch?.(() => {});
  const done = () => (inTransition = false);
  vt.finished.then(done, done);
  setTimeout(() => { if (!ran) { try { vt.skipTransition(); } catch { /* already over */ } run(); done(); } }, 400);
}
// Where the newest navigation is going (12 Oct 2026). A view transition can hold its update for a moment, so for
// that moment route.path still shows the page being LEFT. A hashchange back to that same page in that moment used
// to be read as "same page, nothing to do" — then the held transition applied and moved away after all, leaving
// the address on one page and the screen on another (the day page reopened right after Save showed Home).
// Comparing against the pending target instead lets that hashchange go through show(), whose numbering cancels
// the held step.
let pendingTo = null;
// C4 (22 Oct 2026): Home's week card travels into the Week's header, and its day chips into the Day's strip
// (public/motion.css, vt-week / vt-days). The browser photographs the new page as soon as the change returns, and
// these screens draw a moment later, so the change waits for the matching element: only when one of the travelling
// elements is on screen now, only where a transition runs, and never longer than 100 ms (taps are dropped while a
// transition is held or running, so the hold is kept short).
const TRAVEL = { home: '.hero-card', week: '.wk-head', day: 'nav.sticky-top.chips' };
const TRAVELLERS = '.hero-card, .wk-head, nav.sticky-top.chips';
function arrived(to) {
  const sel = TRAVEL[to.split('/')[1]];
  if (!sel || typeof document === 'undefined' || !document.startViewTransition || document.documentElement.dataset.tier === 'low') return null;
  if ((typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || !document.querySelector(TRAVELLERS)) return null;
  return () => new Promise((res) => { const t0 = Date.now(); const look = () => (document.querySelector(sel) || Date.now() - t0 > 100 ? res() : setTimeout(look, 16)); look(); });
}
function show(to, back, drawn = false) {
  pendingTo = to;
  // the page slides in the direction of travel (public/motion.css): forward from the right, Back from the left
  if (typeof document !== 'undefined') document.documentElement.dataset.nav = back ? 'back' : 'fwd';
  const wait = drawn ? null : arrived(to);
  const apply = () => { route.path = to; route.back = back; return tick().then(wait).then(() => { if (typeof scrollTo === 'function') scrollTo(0, back ? scrolls.get(idx) || 0 : 0); }); };
  // a Back the browser has already animated (Android's back gesture) is not animated a second time
  if (drawn) apply(); else withTransition(apply);
}

// A screen with unsaved changes can hold navigation: guard(to) returns false to stay (it then asks the person, opening
// its question with whenSettled, once the held step has been undone) and continues with resume(to) when they choose
// to leave.
// 10 Oct 2026 (the head's phone recording, Android back gesture): the undo of a held Back came back as a second
// hashchange that was shown as a page change of its own — a slide over the same page, hiding and re-showing the open
// question ("it shivers and then pops up"); and leaving afterwards added a new entry instead of going Back.
let guard = null, undoing = false, held = null, pass = false, waiting = [];
export function setLeaveGuard(fn) {
  guard = fn;
  return () => { if (guard === fn) guard = null; };
}
const flush = () => { const w = waiting; waiting = []; for (const f of w) f(); };
/** Runs fn once a held navigation has been undone (at once when nothing is being undone). */
export function whenSettled(fn) {
  if (!undoing) return void fn();
  waiting.push(fn);
  setTimeout(() => { if (waiting.length) { undoing = false; flush(); } }, 700);   // the undo never arrived: ask anyway
}
/** Goes where the held navigation was going: a held Back is the one Back step (no new entry), anything else go(to). */
export function resume(to) {
  const h = held; held = null;
  if (h?.back && typeof history !== 'undefined') { pass = true; history.back(); }
  else go(h?.to || to);
}
// Back / Forward the browser already animated itself (PopStateEvent.hasUAVisualTransition, Chrome's back gesture on
// Android): popstate comes just before hashchange
let drawn = false;
// Each history entry gets a number, so a held navigation can be undone in the right direction (no duplicate entry,
// so Back still takes one tap): a new entry (link, typed hash) is stepped back over; Back / Forward is reversed.
let idx = 0;
if (typeof window !== 'undefined') {
  try { history.scrollRestoration = 'manual'; } catch { /* old browser */ }
  if (Number.isInteger(history.state?.i)) idx = history.state.i;
  else history.replaceState({ ...(history.state || {}), i: 0 }, '');
  window.addEventListener('popstate', (e) => { drawn = !!e.hasUAVisualTransition; });
  window.addEventListener('hashchange', () => {
    const to = read(), st = history.state, fresh = !Number.isInteger(st?.i), ua = drawn, skip = pass;
    drawn = false; pass = false;
    // the same page (the undo of a held step coming back): only the history number follows, nothing is shown again
    // — unless a move AWAY from it is still pending, which this hashchange must cancel (see pendingTo)
    if (to === route.path && (pendingTo === null || pendingTo === to)) {
      if (fresh) history.replaceState({ ...(st || {}), i: ++idx }, ''); else idx = st.i;
      if (undoing) { undoing = false; flush(); }
      return;
    }
    if (guard && !skip) {
      undoing = true;
      if (!guard(to)) {
        held = { to, back: !fresh && st.i < idx };
        if (fresh || st.i > idx) history.back(); else history.forward();
        return;
      }
      undoing = false;
    }
    scrolls.set(idx, scrollY);
    if (fresh) history.replaceState({ ...(st || {}), i: ++idx }, '');
    else idx = st.i;
    show(to, !fresh, ua);
  });
}
export function go(path, replace = false) {
  // from an open dialog's Back entry (ui/backclose.js), the new screen takes that entry's place: Back then returns to the
  // screen under the dialog in one press
  if (replace || (typeof history !== 'undefined' && history.state?.sheet)) location.replace('#' + path);
  else location.hash = path;
  route.path = path;
}

/**
 * Tells the router the address changed underneath it — for a replaceState that fires no hashchange, so route.path
 * would otherwise keep the old query string (lib/hashq.js; 13 Oct 2026, audit FE-5). The PAGE must be the same:
 * this only takes on a new query, it never navigates.
 */
export function setPath(path) {
  if (path && path.split('?')[0] === route.path.split('?')[0]) route.path = path;
}

