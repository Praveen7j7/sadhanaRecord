// Automatic (modernization audit §16.5; the head, 4 Oct 2026): <html data-tier="high | balanced | low"> is the richest
// look this phone can comfortably sustain right now. The same screens in every tier; only glass, shadows, the page wash
// and motion change (app.css). The theme (Automatic / Light / Dark, lib/theme.js) is a separate choice and never touched.
// What Automatic weighs, and keeps weighing while the app is open:
//   · the device: memory, cores, a mouse or touch, the size of the screen to paint
//   · the connection: data saver, 2G / 3G, round-trip time, offline (network extras also follow saveData() below)
//   · the battery, where the browser tells it: low and not charging → balanced; nearly empty → low
//   · reduced transparency (always low), and slowness measured while scrolling (one step down, remembered 14 days)
// It never guesses upward: what a browser does not tell (Safari and Firefox give no memory) counts as balanced at most.
// Changes are smoothed so a flicker never flips the look: down once the new state has held 3 s; up one step after 20 s.
const ORDER = ['low', 'balanced', 'high'], SLOW = 'sr.slow', SLOW_AT = 'sr.slowAt';
export const DOWN_MS = 3000, UP_MS = 20000;
const SLOW_KEEP = 14 * 864e5;
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const nav = () => (typeof navigator === 'undefined' ? {} : navigator);
const media = (q) => { try { return matchMedia(q).matches; } catch { return false; } };

/** True when network extras should wait (pictures on tap, no prefetch, no quote autoplay): the phone's data saver,
 *  a 2G-class connection, a very slow round trip, or no connection at all. */
export function saveData(n = nav()) {
  const c = n.connection;
  return n.onLine === false || !!(c && (c.saveData || /2g$/.test(c.effectiveType || '') || c.rtt >= 1500));
}

/** The tier for these facts (pure: tests/tier.test.js). mem in GB and cores as the browser reports them (or undefined). */
export function decide({ mem, cores, fine = false, pixels = 0, net = null, battery = null, clear = false, slow = 0 }) {
  if (clear) return 'low';
  let t = (mem && mem <= 2) || (cores && cores <= 2) ? 0
    : mem >= 4 && (cores >= 6 || (fine && cores >= 4)) ? 2
    : 1;                                                             // middling or not told: balanced, never a guess up
  if (t === 2 && pixels >= 8e6 && !(mem >= 8 && cores >= 8)) t = 1;   // a 4K-class screen costs every effect more
  if (net) {
    if (net.save || /2g$/.test(net.type || '') || net.rtt >= 1500) t = 0;
    else if (net.type === '3g' || net.rtt >= 600) t = Math.min(t, 1);
  }
  if (battery && !battery.charging) { if (battery.level <= 0.1) t = 0; else if (battery.level <= 0.2) t = Math.min(t, 1); }
  return ORDER[Math.max(0, t - slow)];
}

/** Smoothing (pure): the tier to show, given the one shown, the one wanted and how long (ms) it has been wanted. */
export function settle(shown, want, wantedFor) {
  const a = ORDER.indexOf(shown), b = ORDER.indexOf(want);
  if (b < a) return wantedFor >= DOWN_MS ? want : shown;          // down: once it has held 3 s, straight there
  if (b > a) return wantedFor >= UP_MS ? ORDER[a + 1] : shown;     // up: one step at a time, after 20 s each
  return shown;
}

/** Too slow: more than 20 % of at least 30 measured frames took over 32 ms. */
export const tooSlow = (gaps) => gaps.length >= 30 && gaps.filter((g) => g > 32).length / gaps.length > 0.2;

/** Measured slowness: steps down, kept for 14 days (then this phone is measured afresh). */
function slowSteps(now = Date.now()) {
  const n = Number(read(SLOW)) || 0, at = Number(read(SLOW_AT)) || 0;
  if (n && at && now - at > SLOW_KEEP) { write(SLOW, null); write(SLOW_AT, null); return 0; }
  return n;
}

let battery = null;                       // { level, charging } once the browser has told it
/** What this phone and its connection are now. */
export function sense(n = nav()) {
  const c = n.connection, s = typeof screen === 'undefined' ? null : screen, dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
  return { mem: n.deviceMemory, cores: n.hardwareConcurrency, fine: media('(pointer: fine)'), clear: media('(prefers-reduced-transparency: reduce)'),
    pixels: s ? s.width * s.height * dpr * dpr : 0, net: c ? { type: c.effectiveType || '', rtt: c.rtt, save: !!c.saveData } : null, battery, slow: slowSteps() };
}

let shown = '', want = '', since = 0, started = 0, timer = 0;
const show = (t) => { shown = t; if (typeof document !== 'undefined') document.documentElement.dataset.tier = t; };
/** Weighs the facts again and moves the look toward them (smoothed; `now` skips the wait, for measured slowness). */
export function evaluate(at = false) {
  const now = performance.now(), w = decide(sense());
  if (w !== want) { want = w; since = now; }
  // the first two seconds (under the splash) follow at once: the battery and the connection answer a moment after start
  const next = at === true || now - started < 2000 ? want : settle(shown, want, now - since);
  if (next !== shown) { show(next); since = now; }
  clearTimeout(timer);
  if (want !== shown) timer = setTimeout(() => evaluate(), (ORDER.indexOf(want) < ORDER.indexOf(shown) ? DOWN_MS : UP_MS) - (performance.now() - since) + 50);
  return shown;
}

/** Sets the tier before the first screen, then follows the phone: connection, online / offline, battery, transparency. */
export function startTier() {
  write('sr.look', null);                 // the earlier Rich / Simple choice is gone: the look is always Automatic
  started = performance.now();
  show(decide(sense())); want = shown; since = started;
  if (typeof window === 'undefined') return shown;
  const n = nav();
  const again = () => evaluate();
  n.connection?.addEventListener?.('change', again);
  addEventListener('online', again); addEventListener('offline', again);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') evaluate(); });
  try { matchMedia('(prefers-reduced-transparency: reduce)').addEventListener('change', again); } catch { /* old browser */ }
  try {
    n.getBattery?.().then((b) => {
      const take = () => { battery = { level: b.level, charging: b.charging }; evaluate(); };
      b.addEventListener('levelchange', take); b.addEventListener('chargingchange', take); take();
    }).catch(() => {});
  } catch { /* no battery information */ }
  watchFrames();
  return shown;
}

/** The frame-gap watcher: once per opening, only while the person scrolls (8 s of it at most). */
function watchFrames() {
  if (typeof requestAnimationFrame !== 'function' || shown === 'low') return;
  const gaps = [];
  let last = 0, until = 0, spent = 0, running = false;
  const frame = (t) => {
    if (last) { const g = t - last; gaps.push(g); spent += g; }
    last = t;
    if (performance.now() < until && spent < 8000) return requestAnimationFrame(frame);
    running = false; last = 0;
    if (spent >= 8000 || gaps.length >= 240) finish();
  };
  const finish = () => {
    removeEventListener('scroll', onScroll, true);
    if (!tooSlow(gaps)) return;
    write(SLOW, String(slowSteps() + 1)); write(SLOW_AT, String(Date.now()));
    evaluate(true);                            // proven slow: no need to wait
  };
  const onScroll = () => {
    until = performance.now() + 200;           // count frames only while scrolling (and just after)
    if (!running) { running = true; requestAnimationFrame(frame); }
  };
  addEventListener('scroll', onScroll, { capture: true, passive: true });
}
