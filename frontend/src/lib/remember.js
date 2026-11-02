// Small things a screen remembers on this phone across visits (D7, 22 Oct 2026): where the list was scrolled, which
// book and canto were open. Per person (the login is in the key), and never a reason to fail: blocked storage simply
// remembers nothing.
export function recall(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function keep(key, value) {
  try { if (value === null || value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}
/** This screen's scroll, kept as it changes; restore() once the content is drawn, stop() when the screen goes. */
export function rememberScroll(key) {
  let raf = 0;
  const save = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => keep(key, Math.round(window.scrollY))); };
  addEventListener('scroll', save, { passive: true });
  return {
    // two frames: after the router's own scroll-to-top on a forward visit, and after the list has its height
    restore() { const y = recall(key, 0); if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(0, y))); },
    stop() { removeEventListener('scroll', save); cancelAnimationFrame(raf); }
  };
}
