// Phase 7 (9 Oct 2026): motion that helps but is never needed.
//   loadMotion(): public/motion.css (page slides, row glow, sparkline draw, the bottom bar hiding), fetched after the
//     app opens, never on the Low tier or with reduced motion
//   countUp(n): a number counts up from 0 over 400 ms the first time it is shown this session (High / Balanced tier)
import { whenIdle } from './pro.svelte.js';
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const low = () => typeof document !== 'undefined' && document.documentElement.dataset.tier === 'low';
let loaded = false;
export function loadMotion() {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  whenIdle(() => {
    if (reduce() || low()) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/motion.css';
    document.head.appendChild(l);
  });
}
const counted = new Set();          // "key:value" counted this session: never twice
/** Attachment: shows `n`; the first time this session it counts up to it. `key` tells the places apart. */
export const countUp = (n, key = '') => (node) => {
  const v = Number(n) || 0, k = key + ':' + location.hash.split('?')[0];
  if (reduce() || low() || counted.has(k) || v < 2) { node.textContent = String(v); counted.add(k); return; }
  counted.add(k);
  const t0 = performance.now();
  let raf = 0;
  const step = (t) => { const p = Math.min(1, (t - t0) / 400); node.textContent = String(Math.round(v * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
  node.textContent = '0'; raf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(raf); node.textContent = String(v); };
};
