// C3 / C10 (22 Oct 2026): a number that counts up — never on a low-end phone or with reduced motion, always ending on the value.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { countUp } from '../src/lib/countup.js';

const env = (tier, reduce = false) => {
  vi.stubGlobal('document', { documentElement: { dataset: { tier } } });
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
  let t = 0; const q = [];
  vi.stubGlobal('performance', { now: () => t });
  vi.stubGlobal('requestAnimationFrame', (f) => { q.push(f); return q.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return { run: () => { while (q.length) { t += 50; q.shift()(t); } } };
};
afterEach(() => vi.unstubAllGlobals());

describe('countUp', () => {
  it('a low-end phone gets the final number at once', () => {
    env('low'); const seen = [];
    countUp(85, (v) => seen.push(v));
    expect(seen).toEqual([85]);
  });
  it('reduced motion gets the final number at once', () => {
    env('high', true); const seen = [];
    countUp(85, (v) => seen.push(v));
    expect(seen).toEqual([85]);
  });
  it('a capable phone counts from 0 and lands exactly on the value, never past it', () => {
    const { run } = env('high'); const seen = [];
    countUp(85, (v) => seen.push(v)); run();
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(85);
    expect(Math.max(...seen)).toBe(85);
    expect(seen.length).toBeGreaterThan(5);
  });
});
