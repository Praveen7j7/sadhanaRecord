// Phase 9 (9 Oct 2026): the approved reading pace for verses, the short verse for painting panels, the 4 s gap
import { describe, it, expect } from 'vitest';
import { readMs } from '../src/lib/carousel.js';
import { QUOTES, shortQuoteIndex } from '../src/lib/quotes.js';
import { pace, quietFor, changed, GAP } from '../src/lib/pace.js';

describe('the readable pace', () => {
  it('a verse stays 6 s + 0.4 s a word, 10–30 s', () => {
    expect(readMs('one two three')).toBe(10000);
    expect(readMs(Array(20).fill('w').join(' '))).toBe(14000);
    expect(readMs(Array(45).fill('w').join(' '))).toBe(24000);
    expect(readMs(Array(90).fill('w').join(' '))).toBe(30000);
  });
  it('the verse on a painting is at most 240 characters, every day of a year', () => {
    for (let d = 0; d < 366; d++) { const iso = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10); expect(QUOTES[shortQuoteIndex(iso)][0].length).toBeLessThanOrEqual(240); }
  });
  it('never two changes within 4 s', () => {
    changed(1000);
    expect(quietFor(1000 + 1000)).toBe(GAP - 1000);
    expect(quietFor(1000 + GAP)).toBe(0);
    pace.last = 0;
  });
});
