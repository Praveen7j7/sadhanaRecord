// Contrast of the design tokens (modernization audit §16.2, phase 2 "done when"): every text / surface pair ≥ 4.5:1 and
// every control edge or state fill ≥ 3:1, in light and dark, in all four areas. Since D1 (8 Oct 2026) the accent is the
// one brand blue everywhere and each area only adds a marker colour (area tag, menu dot, overline): both are checked. The values are read from app.css itself,
// and the neutrals are checked as the browser paints them: with the area accent mixed in (color-mix in srgb).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
const block = (head) => {
  const i = css.indexOf(head);
  if (i < 0) throw new Error('missing block ' + head);
  return css.slice(i, css.indexOf('}', i));
};
const vars = (text) => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6}|[\d.]+%)/gi)].map((m) => [m[1], m[2].toLowerCase()]));

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
// color-mix(in srgb, a p, b): a straight blend of the encoded channels
const mix = (a, p, b) => hex(rgb(a).map((x, i) => x * p + rgb(b)[i] * (1 - p)));
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pct = (s) => parseFloat(s) / 100;

const BRAND = vars(block(':root, [data-area] {\n  --acc-l'));
const AREAS = { devotee: ":root, [data-area='devotee'], [data-area='public'] {", coordinator: "[data-area='coordinator'] {", admin: "[data-area='admin'] {", public: ":root, [data-area='devotee'], [data-area='public'] {" };
const THEMES = {
  light: { t: vars(block(':root, [data-area] {\n  --accent:')), acc: 'acc-l', on: 'on-l', area: 'area-l', gold: vars(block(':root { --gold-text')) },
  dark: { t: vars(block(":root[data-theme='dark'], :root[data-theme='dark'] [data-area] {")), acc: 'acc-d', on: 'on-d', area: 'area-d', gold: vars(block(":root[data-theme='dark'] { --gold-text")) },
};

/** The painted colours of one theme in one area. */
function paint(theme, area) {
  const { t, acc, on, area: ak, gold } = THEMES[theme];
  const raw = vars(block(AREAS[area]));
  const A = BRAND[acc];
  const el = t['surface-elevated'];
  const bg = mix(A, pct(t['mix-bg']), t['bg-n']);
  const P = {
    accent: A, onAccent: BRAND[on], marker: raw[ak], bg, el, floating: t['surface-floating'],
    vizBody: t['viz-body'], vizSoul: t['viz-soul'], vizSeva: t['viz-seva'], vizAtt: t['viz-att'],
    surface: mix(A, pct(t['mix-s']), t['surface-n']),
    muted: mix(A, pct(t['mix-s2']), t['muted-n']),
    hover: mix(A, pct(t['mix-s2']), t['hover-n']),
    accentSoft: mix(A, pct(t['mix-soft']), el),
    // the peak of the ambient wash (accent, then gold 9 %, over the page) and the devotional parchment
    wash: mix(gold['gold-decorative'], 0.09, mix(A, pct(t['mix-wash']), bg)),
    parchment: mix(gold['gold-decorative'], 0.09, el),
    text: t['text-primary'], text2: t['text-secondary'], muted_t: t['text-muted'], gold: gold['gold-text'],
    borderStrong: t['border-strong'],
  };
  for (const k of ['success', 'warning', 'danger', 'info']) { P[k] = t[k]; P[k + 'Soft'] = mix(t[k], pct(t['mix-sem']), el); }
  return P;
}

const cases = [];
for (const theme of Object.keys(THEMES)) for (const area of Object.keys(AREAS)) cases.push([theme, area]);

describe.each(cases)('contrast: %s theme, %s area', (theme, area) => {
  const P = paint(theme, area);
  const text = (fg, bgs, min = 4.5) => { for (const b of bgs) expect(ratio(P[fg], P[b]), `${fg} on ${b} (${P[fg]} / ${P[b]})`).toBeGreaterThanOrEqual(min); };

  it('neutral neutrals carry at most 3 % of the accent', () => {
    const t = THEMES[theme].t;
    for (const k of ['mix-bg', 'mix-s', 'mix-s2', 'mix-b']) expect(pct(t[k])).toBeLessThanOrEqual(0.03);
  });
  // the ambient wash is drawn only in the devotee area and on the signed-out screens
  const washed = area === 'devotee' || area === 'public' ? ['wash'] : [];
  it('body, secondary and muted text on every surface', () => {
    for (const fg of ['text', 'text2', 'muted_t']) text(fg, ['bg', 'surface', 'el', 'floating', 'muted', 'hover', 'parchment', ...washed]);
    // on accent-soft (the hero, a selected choice) supporting text is secondary, never muted
    for (const fg of ['text', 'text2']) text(fg, ['accentSoft']);
  });
  it('text on the semantic soft fills (notices)', () => text('text', ['successSoft', 'warningSoft', 'dangerSoft', 'infoSoft']));
  it('status words in the semantic colours on the page and raised surfaces', () => {
    for (const fg of ['success', 'warning', 'danger', 'info']) text(fg, ['bg', 'surface', 'el', fg + 'Soft']);
  });
  it('accent text: overlines, active nav, links, on the hero wash', () => text('accent', ['bg', 'surface', 'el', 'floating', 'accentSoft', ...washed]));
  it('text on the accent (primary buttons, avatars)', () => text('onAccent', ['accent']));
  it('the one brand accent is the same in every area (D1)', () => expect(P.accent).toBe(theme === 'light' ? '#004fdc' : '#78a8ff'));
  it('the area marker (area tag, overline) reads on the page and raised surfaces', () => text('marker', ['bg', 'surface', 'el', 'floating']));
  it('the category colours of the charts stand out from the surface (≥ 3:1)', () => text('vizBody', ['el', 'surface'], 3) || ['vizSoul', 'vizSeva', 'vizAtt'].forEach((k) => text(k, ['el', 'surface'], 3)));
  it('a missing day: the mark on its amber dot', () => { P.mark = P.el; text('mark', ['warning'], 3); });
  // gold words sit on raised surfaces and the parchment; the lockup's subline on the wash uses a deeper gold (auth.css)
  it('gold text only on raised surfaces and the parchment', () => text('gold', ['surface', 'el', 'parchment']));
  it('the lockup subline on the signed-out wash', () => {
    P.goldDeep = mix(P.gold, 0.7, P.text);
    text('goldDeep', ['bg', 'wash']);
  });
  it('control edges and state fills ≥ 3:1', () => {
    text('borderStrong', ['bg', 'surface', 'el'], 3);   // an input's outline against what is around it
    text('accent', ['muted', 'hover'], 3);
    text('success', ['bg', 'el'], 3);                 // the filled dot of a complete day
    expect(ratio(P.el, P.success), 'check on the success dot').toBeGreaterThanOrEqual(3);
  });
});
it('brand surfaces: white on the navy (splash, wordmark panel) and navy on the gold', () => {
  const navy = BRAND['brand-navy'];
  expect(ratio('#ffffff', navy)).toBeGreaterThanOrEqual(7);
  expect(ratio(navy, '#f8b000')).toBeGreaterThanOrEqual(4.5);
});
