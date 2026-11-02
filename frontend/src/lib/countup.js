// A number that counts up to its value (22 Oct 2026, C3 / C10): a moment of reward when a week is submitted or a score
// first shows. Native requestAnimationFrame, no library; ~0.7 s ease-out. A low-end phone and reduced motion get the
// final number at once. The caller shows the moving number to sight only (aria-hidden) and the final one to a screen
// reader, so it never hears the count.
export function countUp(to, set, { duration = 700, tiers = ['high', 'balanced'] } = {}) {
  const n = Number(to);
  if (!Number.isFinite(n)) { set(to); return () => {}; }
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tier = typeof document !== 'undefined' ? document.documentElement.dataset.tier : '';
  if (still || !tiers.includes(tier) || typeof requestAnimationFrame !== 'function') { set(n); return () => {}; }
  let raf = 0;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    set(Math.round(n * (1 - (1 - p) ** 3)));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  set(0);
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
