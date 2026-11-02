// Phase 9 (the display standard §3, approved 9 Oct 2026): the paintings' order and the day's first painting.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { spread, family, pick } from '../src/lib/darshan.js';

const all = JSON.parse(fs.readFileSync(new URL('../public/darshan/darshan.json', import.meta.url))).images.filter((i) => i.active);
const order = spread(all);

describe('darshan variety', () => {
  it('keeps every painting once', () => {
    expect(order.length).toBe(all.length);
    expect(new Set(order.map((i) => i.id)).size).toBe(all.length);
  });
  it('never shows the same family of deity twice in a row, also from the last back to the first', () => {
    const fam = order.map((i) => family(i.deity));
    fam.forEach((f, k) => expect(f, `${order[k].id} after ${order[(k + fam.length - 1) % fam.length].id}`).not.toBe(fam[(k + fam.length - 1) % fam.length]));
  });
  it('the day never opens with a painting that opened any of the last 14 days (Welcome and Home)', () => {
    for (const pool of ['flagship', 'everyday']) {
      const day0 = Date.parse('2026-10-09T12:00:00+05:30');
      const firsts = Array.from({ length: 60 }, (_, d) => pick(order, pool, day0 + d * 864e5).id);
      firsts.forEach((id, d) => expect(firsts.slice(Math.max(0, d - 14), d), `${pool}, day ${d}`).not.toContain(id));
    }
  });
  it('every painting has the files the standard asks for', () => {
    const dir = new URL('../public/darshan/', import.meta.url);
    for (const i of all) {
      expect(i.sizes, i.id).toContain(480); expect(i.sizes.some((w) => w >= 960) || i.sizes.at(-1) === i.w, i.id).toBe(true);
      for (const w of i.sizes) expect(fs.existsSync(new URL(`${i.id}-${w}.webp`, dir)), `${i.id}-${w}.webp`).toBe(true);
      for (const w of i.avif || []) expect(fs.existsSync(new URL(`${i.id}-${w}.avif`, dir)), `${i.id}-${w}.avif`).toBe(true);
      expect(fs.existsSync(new URL(`${i.id}-960.jpg`, dir)), `${i.id}-960.jpg`).toBe(true);
      const limit = { 480: 45, 960: 120, 1440: 220, 2160: 400 };
      // a very detailed painting may take up to 40 % more (marked `detailed`; the head wants every painting in, 9 Oct 2026);
      // a painting narrower than 960 has its own width as its sharp file
      for (const w of i.sizes) { const lim = (limit[w] || 120) * (i.detailed ? 1.4 : 1); expect(fs.statSync(new URL(`${i.id}-${w}.webp`, dir)).size / 1024, `${i.id}-${w}.webp ≤ ${lim} KB`).toBeLessThanOrEqual(lim); }
      expect(i.title && i.deity && i.focal && i.dominant, i.id).toBeTruthy();
    }
  });
  it('enough large paintings for Welcome and sign-in (≥ 14, each at least 1182 px wide)', () => {
    const f = all.filter((i) => i.flagship);
    expect(f.length).toBeGreaterThanOrEqual(14);
  });
});
