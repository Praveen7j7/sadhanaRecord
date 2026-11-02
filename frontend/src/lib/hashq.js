import { setPath } from './router.svelte.js';
// Screen state kept in the hash query (#/path?x=1), replaced in place: Back leaves the screen with it kept,
// and returning (or reloading) restores it. Does not fire hashchange, so the screen is not re-rendered.
export const hashParams = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.hash.split('?')[1] || '');

/** Sets (or, for '' / null / false, removes) these keys in the hash query. */
export function replaceHashParams(values) {
  const p = hashParams();
  for (const [k, v] of Object.entries(values)) { if (v === '' || v === null || v === undefined || v === false) p.delete(k); else p.set(k, String(v)); }
  const q = p.toString(), next = '#' + location.hash.slice(1).split('?')[0] + (q ? '?' + q : '');
  if (next !== location.hash) {
    history.replaceState(history.state, '', next);
    // replaceState fires no hashchange, so the router never hears it and route.path keeps the OLD query string.
    // Tapping the active tab then looked like a different route and pushed a duplicate entry, and a filter saved
    // in the query was lost on the next navigation (13 Oct 2026, audit FE-5).
    setPath(next.slice(1));
  }
}
