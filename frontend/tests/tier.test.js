// Automatic (modernization audit §16.5; the head, 4 Oct 2026): the richest look this phone can comfortably sustain,
// never a guess upward, and smoothed so small fluctuations never flip it.
import { describe, it, expect } from 'vitest';
import { decide, settle, tooSlow, saveData, DOWN_MS, UP_MS } from '../src/lib/tier.js';

const DESKTOP = { mem: 8, cores: 8, fine: true, pixels: 1920 * 1080 };
const PHONE_GOOD = { mem: 8, cores: 8, fine: false, pixels: 1080 * 2400 };

describe('Automatic: the device', () => {
  it('high on a strong device: 4 GB or more with 6 cores, or a mouse with 4', () => {
    expect(decide(DESKTOP)).toBe('high');
    expect(decide(PHONE_GOOD)).toBe('high');
    expect(decide({ mem: 4, cores: 4, fine: true })).toBe('high');
  });
  it('balanced when middling, and when the browser does not say (Safari, Firefox, iPhone): never a guess up', () => {
    expect(decide({ mem: 4, cores: 4 })).toBe('balanced');
    expect(decide({ mem: 3, cores: 8 })).toBe('balanced');
    expect(decide({ mem: undefined, cores: 6 })).toBe('balanced');
    expect(decide({ mem: undefined, cores: undefined, fine: true })).toBe('balanced');
  });
  it('low on 2 GB or less, or 2 cores', () => {
    expect(decide({ mem: 2, cores: 8 })).toBe('low');
    expect(decide({ mem: 1, cores: 4 })).toBe('low');
    expect(decide({ mem: 4, cores: 2 })).toBe('low');
  });
  it('a 4K-class screen keeps high only on a very strong device', () => {
    expect(decide({ mem: 4, cores: 6, pixels: 3840 * 2160 })).toBe('balanced');
    expect(decide({ mem: 8, cores: 8, pixels: 3840 * 2160 })).toBe('high');
  });
  it('reduced transparency is always low', () => { expect(decide({ ...DESKTOP, clear: true })).toBe('low'); });
});

describe('Automatic: the connection and the battery', () => {
  it('fast connection: as the device allows', () => { expect(decide({ ...DESKTOP, net: { type: '4g', rtt: 50 } })).toBe('high'); });
  it('a slower connection (3G, or a round trip of 600 ms or more): balanced at most', () => {
    expect(decide({ ...DESKTOP, net: { type: '3g', rtt: 300 } })).toBe('balanced');
    expect(decide({ ...DESKTOP, net: { type: '4g', rtt: 800 } })).toBe('balanced');
  });
  it('data saver, 2G or a very slow round trip: low', () => {
    expect(decide({ ...DESKTOP, net: { type: '4g', rtt: 50, save: true } })).toBe('low');
    expect(decide({ ...DESKTOP, net: { type: 'slow-2g', rtt: 2000 } })).toBe('low');
    expect(decide({ ...DESKTOP, net: { type: '4g', rtt: 1600 } })).toBe('low');
  });
  it('battery: low and not charging → balanced; nearly empty → low; charging → as the device allows', () => {
    expect(decide({ ...DESKTOP, battery: { level: 0.18, charging: false } })).toBe('balanced');
    expect(decide({ ...DESKTOP, battery: { level: 0.08, charging: false } })).toBe('low');
    expect(decide({ ...DESKTOP, battery: { level: 0.08, charging: true } })).toBe('high');
    expect(decide({ ...DESKTOP, battery: { level: 0.9, charging: false } })).toBe('high');
  });
  it('measured slowness steps down one tier each time, never below low', () => {
    expect(decide({ ...DESKTOP, slow: 1 })).toBe('balanced');
    expect(decide({ ...DESKTOP, slow: 2 })).toBe('low');
    expect(decide({ mem: 4, cores: 4, slow: 5 })).toBe('low');
  });
});

describe('Automatic: smoothing (no flip-flop)', () => {
  it('a step down waits until the new state has held 3 s, then goes straight there', () => {
    expect(settle('high', 'low', 1000)).toBe('high');
    expect(settle('high', 'low', DOWN_MS)).toBe('low');
  });
  it('a step up waits 20 s and climbs one tier at a time', () => {
    expect(settle('low', 'high', 5000)).toBe('low');
    expect(settle('low', 'high', UP_MS)).toBe('balanced');
    expect(settle('balanced', 'high', UP_MS)).toBe('high');
  });
  it('no change when the wanted tier is the shown one', () => { expect(settle('balanced', 'balanced', 99999)).toBe('balanced'); });
});

describe('frame-gap watcher', () => {
  const frames = (fast, slow) => [...Array(fast).fill(16.7), ...Array(slow).fill(48)];
  it('too slow only when more than 20 % of at least 30 frames take over 32 ms', () => {
    expect(tooSlow(frames(100, 30))).toBe(true);
    expect(tooSlow(frames(100, 20))).toBe(false);
    expect(tooSlow(frames(10, 15))).toBe(false);
    expect(tooSlow([])).toBe(false);
  });
});

describe('network extras wait (pictures on tap, no prefetch, no quote autoplay)', () => {
  it('with data saver, 2G, a very slow round trip, or no connection', () => {
    expect(saveData({ connection: { saveData: true, effectiveType: '4g' } })).toBe(true);
    expect(saveData({ connection: { saveData: false, effectiveType: '2g' } })).toBe(true);
    expect(saveData({ connection: { saveData: false, effectiveType: '4g', rtt: 1800 } })).toBe(true);
    expect(saveData({ onLine: false })).toBe(true);
  });
  it('not on a normal connection, nor where the browser does not report one', () => {
    expect(saveData({ connection: { saveData: false, effectiveType: '3g', rtt: 400 } })).toBe(false);
    expect(saveData({ onLine: true })).toBe(false);
    expect(saveData({})).toBe(false);
  });
});
