// Timings from real phones, sampled (22 Oct 2026, B4; the head said yes: D-5). See worker/src/vitals.js.
// About 1 open in 100 of a signed-in person: first paint, largest paint, the slowest tap's delay and layout shift, sent
// once — 20 s after the start or when the app is put away, whichever comes first. Never with Save-Data, never against
// the in-memory mock (a check run must not depend on a dice roll), never twice. Native PerformanceObserver only.
import { call } from './api.js';
import { saveData } from './tier.js';

export function startVitals({ rate = 0.01, route = () => location.hash.split('?')[0].replace(/^#/, '') || '/' } = {}) {
  if (!import.meta.env.VITE_API_URL || typeof PerformanceObserver !== 'function' || saveData() || Math.random() >= rate) return false;
  const v = { fcp: null, lcp: null, inp: null, cls: 0 };
  const watch = (type, f, extra = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(f)).observe({ type, buffered: true, ...extra }); } catch { /* not supported here */ } };
  watch('paint', (e) => { if (e.name === 'first-contentful-paint') v.fcp = e.startTime; });
  watch('largest-contentful-paint', (e) => { v.lcp = e.startTime; });
  watch('layout-shift', (e) => { if (!e.hadRecentInput) v.cls += e.value; });
  watch('event', (e) => { if (e.interactionId) v.inp = Math.max(v.inp ?? 0, e.duration); }, { durationThreshold: 40 });
  let sent = false;
  const send = () => {
    if (sent) return; sent = true;
    const n = (x) => (x === null ? null : Math.round(x * 10) / 10);
    call('vitals.report', { fcp: n(v.fcp), lcp: n(v.lcp), inp: n(v.inp), cls: Math.round(v.cls * 1000) / 1000, route: route(),
      tier: document.documentElement.dataset.tier || '', net: navigator.connection?.effectiveType || '' }).catch(() => {});
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  setTimeout(send, 20000);
  return true;
}
