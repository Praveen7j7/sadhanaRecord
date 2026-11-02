// B4 (22 Oct 2026): the phone-timing sampler — never against the mock, never with Save-Data, once per open.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let sent;
beforeEach(() => {
  vi.resetModules();
  sent = [];
  vi.doMock('../src/lib/api.js', () => ({ call: (a, d) => { sent.push([a, d]); return Promise.resolve({ kept: true }); } }));
  vi.doMock('../src/lib/tier.js', () => ({ saveData: () => false }));
  vi.stubGlobal('PerformanceObserver', class { constructor(cb) { this.cb = cb; } observe({ type }) {
    const e = { paint: [{ name: 'first-contentful-paint', startTime: 812.34 }], 'largest-contentful-paint': [{ startTime: 1904.5 }],
      'layout-shift': [{ value: 0.01, hadRecentInput: false }, { value: 0.5, hadRecentInput: true }], event: [{ interactionId: 3, duration: 96 }] }[type] || [];
    this.cb({ getEntries: () => e }); } });
  vi.stubGlobal('document', { documentElement: { dataset: { tier: 'balanced' } }, addEventListener: () => {}, visibilityState: 'visible' });
  vi.stubGlobal('navigator', { connection: { effectiveType: '4g' } });
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('startVitals', () => {
  it('never samples against the in-memory mock (no API address)', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { startVitals } = await import('../src/lib/vitals.js');
    expect(startVitals({ rate: 1 })).toBe(false);
  });
  it('a sampled open sends the four numbers once, with the screen, tier and connection', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.test');
    const { startVitals } = await import('../src/lib/vitals.js');
    expect(startVitals({ rate: 1, route: () => '/home' })).toBe(true);
    vi.advanceTimersByTime(20000); vi.advanceTimersByTime(20000);
    expect(sent).toEqual([['vitals.report', { fcp: 812.3, lcp: 1904.5, inp: 96, cls: 0.01, route: '/home', tier: 'balanced', net: '4g' }]]);
  });
  it('an open that is not sampled sends nothing', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.test');
    const { startVitals } = await import('../src/lib/vitals.js');
    expect(startVitals({ rate: 0 })).toBe(false);
    vi.advanceTimersByTime(20000);
    expect(sent).toEqual([]);
  });
});
