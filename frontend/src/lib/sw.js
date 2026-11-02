// Keeps the installed app on the latest version. The service worker (the offline copy that makes the app open
// instantly) installs a new version in the background; without this, the page already open keeps running the
// old code until it is closed, and the old code asks for screen files that no longer exist.
//   · a newer version taking over → reload once (never on the very first install: there is nothing old to replace)
//   · look for a newer version every hour, and whenever the app comes back on screen
//   · a day with changes not saved yet (busy()) postpones the reload until it is saved or left (onWait() tells the person)
// Whether a screen has work the person has not saved, and what to say while a reload waits for it. Set once by
// main.js; read by registerServiceWorker() below AND by reloadWhenIdle(), so an upgrade that arrives through the
// API answers the same way as one that arrives through the service worker (13 Oct 2026, audit FE-9).
let isBusy = () => false, sayWait = () => {};

/**
 * Reload, but not on top of unsaved answers. A day form or the week-end questions hold what the person typed
 * until they tap Save; reloading then throws it away without asking. Waits (telling them why) and reloads as soon
 * as the screen is clean.
 */
export function reloadWhenIdle() {
  const go = () => { try { sessionStorage.setItem('sr.updated', '1'); } catch { /* storage blocked */ } location.reload(); };
  if (!isBusy()) return go();
  sayWait();
  const t = setInterval(() => { if (!isBusy()) { clearInterval(t); go(); } }, 1000);
}

export function registerServiceWorker({ busy = () => false, onWait = () => {} } = {}) {
  isBusy = busy; sayWait = onWait;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.MODE === 'development') return;
  // Track it as it goes, not only at load: a page opened while the first version was still installing gets that
  // version a moment later (no reload needed) and must still reload for every version after it.
  let controlled = !!navigator.serviceWorker.controller, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled && !reloading) { reloading = true; reloadWhenIdle(); }
    controlled = true;
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const check = () => reg.update().catch(() => { /* offline: try later */ });
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    } catch { /* no offline copy: the app still works online */ }
  });
}
