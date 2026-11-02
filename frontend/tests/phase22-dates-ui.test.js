// Phase 22 (26 Oct 2026): A1–A3 a date field opens the calendar on tap / click / Enter; B1 Seg labels never meet the
// edge; B2/B3 every Requests tab has the Reopens head; B4 the Hearing week strip scrolls natively; G1 no "NameMap".
import { describe, it, expect, vi } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openPicker, pickerKey } from '../src/lib/datepick.js';
import DateInput from '../src/ui/DateInput.svelte';
import Seg from '../src/ui/Seg.svelte';

const SRC = new URL('../src/', import.meta.url).pathname;
const src = (p) => readFileSync(join(SRC, p), 'utf8');
const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : f.endsWith('.svelte') ? [join(d, f)] : []));
const html = (C, props) => render(C, { props }).body.replace(/<!--[^>]*-->/g, '');
const field = (o = {}) => ({ showPicker: vi.fn(), disabled: false, readOnly: false, ...o });
const keyEv = (key, o = {}) => { const el = field(o.el); return { key, isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, currentTarget: el, preventDefault: vi.fn(), ...o, el }; };

describe('A3: the calendar opens from anywhere on a date field', () => {
  it('opens the native picker of an editable field', () => {
    const el = field();
    expect(openPicker(el)).toBe(true);
    expect(el.showPicker).toHaveBeenCalledOnce();
  });
  it('does nothing on a disabled or read-only field, a browser without showPicker, or when it throws', () => {
    const off = field({ disabled: true }), ro = field({ readOnly: true });
    expect(openPicker(off)).toBe(false); expect(off.showPicker).not.toHaveBeenCalled();
    expect(openPicker(ro)).toBe(false); expect(ro.showPicker).not.toHaveBeenCalled();
    expect(openPicker({ disabled: false })).toBe(false);
    expect(openPicker(null)).toBe(false);
    // no user gesture / a cross-origin frame: the browser throws, the field just keeps taking typing
    expect(openPicker(field({ showPicker: () => { throw new DOMException('no gesture', 'NotAllowedError'); } }))).toBe(false);
  });
  it('Enter opens it (and is not also a form submit); other keys keep typing', () => {
    const e = keyEv('Enter');
    expect(pickerKey(e)).toBe(true);
    expect(e.el.showPicker).toHaveBeenCalledOnce();
    expect(e.preventDefault).toHaveBeenCalledOnce();
    for (const k of ['1', 'Tab', 'ArrowUp', 'Backspace', ' ']) {
      const x = keyEv(k);
      expect(pickerKey(x)).toBe(false);
      expect(x.el.showPicker).not.toHaveBeenCalled();
      expect(x.preventDefault).not.toHaveBeenCalled();
    }
    for (const m of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing']) expect(pickerKey(keyEv('Enter', { [m]: true }))).toBe(false);
    // a picker that cannot open leaves Enter alone (the form can still submit)
    const dis = keyEv('Enter', { el: { disabled: true } });
    expect(pickerKey(dis)).toBe(false);
    expect(dis.preventDefault).not.toHaveBeenCalled();
  });
  it('is still the labelled native date / date-and-time field', () => {
    expect(html(DateInput, { id: 'd1', label: 'From', value: '2026-10-05' })).toMatch(/<input[^>]*id="d1"[^>]*type="date"[^>]*value="2026-10-05"|<input[^>]*type="date"[^>]*id="d1"/);
    expect(html(DateInput, { id: 'd2', label: 'Open until', time: true })).toContain('type="datetime-local"');
    const d = src('ui/DateInput.svelte');
    expect(d).toMatch(/onclick=\{click\}/);
    expect(d).toMatch(/onkeydown=\{key\}/);
  });
  it('every date field in the app goes through DateInput (Explorer custom range, Leaderboard dates, Batch setup…)', () => {
    const raw = files(SRC).filter((f) => !f.endsWith('DateInput.svelte') && /type=["'](date|datetime-local)["']/.test(readFileSync(f, 'utf8')));
    expect(raw.map((f) => f.slice(SRC.length))).toEqual([]);
    expect(src('fac/Explorer.svelte')).toMatch(/<DateInput id="ex-from"/);
    expect(src('coord/Leaderboard.svelte')).toMatch(/<DateInput id="lb-from"/);
    expect(src('master/Batches.svelte')).toMatch(/<DateInput id="bst-new"/);
  });
});

describe('B1: a Seg sized to its labels gives each the room of the widest', () => {
  it('the component draws equal grid columns; hand-built .seg rows keep the flex row', () => {
    expect(html(Seg, { id: 's', label: 'Show', options: [['ready', 'Qualify'], ['all', 'Everyone']], onchange() {} })).toMatch(/class="seg seg-even"/);
    const css = readFileSync(join(SRC, 'styles/seg.css'), 'utf8');
    expect(css).toMatch(/\.seg\.seg-even \{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\); \}/);
    expect(src('coord/Requests.svelte')).toMatch(/class="seg rq-types"/);   // the scrolling tab row is not a Seg
  });
});

describe('B2/B3: every Requests tab has the Reopens head', () => {
  const r = src('coord/Requests.svelte');
  // Phase 24 (G2): drawn by ui/PageHeader — the title with its count, Refresh in the actions slot on the same row
  it('title, count and Refresh in the page header, above the list and its card', () => {
    expect(r).toMatch(/<PageHeader id="rq-h" title=\{TITLE\[type\]\} count=\{shown\.length\}>\{#snippet actions\(\)\}<Refreshing on=\{e\.refreshing\}/);
    expect(r).not.toMatch(/<div class="flex justify-end"><Refreshing/);
    expect(r.indexOf('<PageHeader')).toBeLessThan(r.indexOf('class:rq-split'));
    expect(src('master/Reopens.svelte')).toMatch(/<PageHeader id="rq-ro-h" title="Reopen requests" count=\{list\.length\}>\{#snippet actions\(\)\}<Refreshing/);
    const ph = src('ui/PageHeader.svelte');
    expect(ph).toMatch(/class="page-head ph/);
    expect(ph).toMatch(/<div class="ph-tools">\{@render actions\(\)\}<\/div>/);
  });
});

describe('B4: the Hearing week strip scrolls natively', () => {
  const l = src('devotee/LectureList.svelte');
  it('snaps, glides, keeps the page scroll, and never shifts when a week is chosen', () => {
    expect(l).toMatch(/\.wkstrip \{ touch-action: manipulation; overscroll-behavior-x: contain; scroll-snap-type: x proximity; \}/);
    expect(l).toMatch(/prefers-reduced-motion: no-preference\) \{ \.wkstrip \{ scroll-behavior: smooth; \}/);
    expect(l).toMatch(/\.wk\[aria-pressed='true'\]::before \{ content: none; \}/);
    expect(l).not.toMatch(/touch-action: pan-x;/);   // pan-x alone would take the page's vertical scroll away
  });
  it('a click after the strip moved under the finger is dropped; a key press always counts', () => {
    expect(l).toMatch(/onpointerdown=\{stripDown\} onclickcapture=\{stripClick\}/);
    const m = l.match(/const stripClick = (\(e\) => \{[^\n]*\});/);
    expect(m).toBeTruthy();
    const stripClick = new Function('sl0', `return ${m[1]}`)(100);
    const ev = (scrollLeft, detail = 1) => ({ detail, currentTarget: { scrollLeft }, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    const swiped = ev(160); stripClick(swiped); expect(swiped.preventDefault).toHaveBeenCalled(); expect(swiped.stopPropagation).toHaveBeenCalled();
    const tap = ev(102); stripClick(tap); expect(tap.preventDefault).not.toHaveBeenCalled();
    const kbd = ev(160, 0); stripClick(kbd); expect(kbd.preventDefault).not.toHaveBeenCalled();
  });
});

describe('G1: the dashboard\'s "NameMap" is not shown in the app', () => {
  it('no screen says NameMap', () => {
    const shown = files(SRC).filter((f) => {
      // markup and strings only: a comment may still name the dashboard tab for the developer
      const s = readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      return /NameMap/.test(s);
    });
    expect(shown.map((f) => f.slice(SRC.length))).toEqual([]);
    // the app is its own source (the head, 27 Oct 2026): the list no longer points the head at the dashboard at all
    expect(src('master/Facilitators.svelte')).not.toMatch(/not on the dashboard yet|on the Facilitator Dashboard too|copy from the Facilitator Dashboard/);
  });
});
