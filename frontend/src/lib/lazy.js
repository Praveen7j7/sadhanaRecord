// Loads a screen that is only downloaded when first opened (coordinator and master screens).
// After a new version is published, the old screen files are gone; a phone still running the old version then
// fails to load them. In that case: fetch the new version and reload once. A second failure is a real
// connection problem and is shown as an error.
const KEY = 'sr.lazyReload';

export function lazy(load) {
  return load().then(
    m => { try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ } return m; },
    async err => {
      let tried = false;
      try { tried = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
      if (tried || typeof location === 'undefined') throw err;
      try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch { /* offline */ }
      location.reload();
      return new Promise(() => {});                     // the page is reloading
    }
  );
}

/*
 * A part of a screen loaded on demand, drawn in the SAME frame once it has loaded (22 Oct 2026, G22).
 *
 * `{#await import(...)}` makes a new promise on every visit, and a promise always shows its pending branch for one
 * frame first — even when the file is long loaded. On Home that frame is a gap: the staff block (a 180 px placeholder
 * for a 500–1,300 px block) and the first-run guide above "This week" arrived a frame late on EVERY return to Home and
 * pushed everything under them down (layout shift 0.19–0.38, "poor"). Given the module itself instead of a promise,
 * `{#await}` draws its `then` branch at once. The first visit is unchanged: it still waits for the file.
 */
const loadedParts = new Map();
export function loadedOnce(key, load) {
  if (loadedParts.has(key)) return loadedParts.get(key);
  return load().then((m) => { loadedParts.set(key, m); return m; });
}
