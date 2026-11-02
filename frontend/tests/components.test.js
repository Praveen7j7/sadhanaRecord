// Phase 5 core components: Sheet (every dialog), Row (grouped-list row), Status (dot + word). Rendered on the server
// (svelte/server, no DOM library); the behaviour in a browser (tap outside, Escape, focus) is in verify.mjs › components.
import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Sheet from '../src/ui/Sheet.svelte';
import Row from '../src/ui/Row.svelte';
import Status from '../src/ui/Status.svelte';

const html = (C, props) => render(C, { props }).body.replace(/<!--[^>]*-->/g, '');
const SRC = new URL('../src/', import.meta.url).pathname;
const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : f.endsWith('.svelte') ? [join(d, f)] : []));
const ALL = files(SRC).map((f) => [f.slice(SRC.length), readFileSync(f, 'utf8')]);

describe('Status', () => {
  it('a dot and the word, in the tone given; no tone = muted', () => {
    expect(html(Status, { tone: 'ok', label: 'Submitted' })).toMatch(/<span class="status[^"]*" data-tone="ok">Submitted<\/span>/);
    expect(html(Status, { label: 'Not filled' })).not.toContain('data-tone');
  });
  it('passes a class and attributes through (e.g. the end column of a row)', () => {
    expect(html(Status, { tone: 'bad', label: 'Missed', class: 'end', title: 'x' })).toMatch(/class="status end"[^>]*title="x"/);
  });
});

describe('Row', () => {
  it('with href: a link with a title, a line under it and a chevron', () => {
    const h = html(Row, { href: '#/week', title: 'This week', sub: 'Mon 5 – Sun 11' });
    expect(h).toMatch(/^<a class="lrow[^"]*" href="#\/week"/);
    expect(h).toContain('<span class="lt">This week</span>');
    expect(h).toContain('<span class="ls">Mon 5 – Sun 11</span>');
    expect(h).toMatch(/<span class="lend">.*<svg/s);
  });
  it('without href: plain, no chevron; disabled: dimmed and announced, never a link', () => {
    expect(html(Row, { title: 'Info' })).not.toMatch(/<a |lend/);
    const d = html(Row, { href: '#/day/x', title: 'Friday', disabled: true });
    expect(d).not.toContain('<a ');
    expect(d).toMatch(/aria-disabled="true"/);
    expect(d).toContain('opacity-60');
  });
  it('tag="li" makes the row the list item; the icon chip is decorative', () => {
    const h = html(Row, { tag: 'li', icon: 'week', title: 'x' });
    expect(h).toMatch(/<li class="lrow/);
    expect(h).toMatch(/<span class="lico[^"]*" aria-hidden="true">/);
  });
});

describe('Sheet', () => {
  it('a dialog.sheet named by its title, with a close button and the line under the title', () => {
    const h = html(Sheet, { titleId: 'x-h', title: 'Delete Ram?', sub: 'This cannot be undone' });
    expect(h).toMatch(/<dialog class="sheet\s*"[^>]*aria-labelledby="x-h"/);
    expect(h).toContain('<h2 id="x-h">Delete Ram?</h2>');
    expect(h).toContain('This cannot be undone');
    expect(h).toMatch(/aria-label="Close"/);
  });
  it('closeButton={false} drops the ✕ (a choice must be made); wide and class reach the dialog', () => {
    const h = html(Sheet, { titleId: 'y', title: 'Save changes before leaving?', closeButton: false, wide: true, class: 'rules-sheet' });
    expect(h).not.toMatch(/aria-label="Close"/);
    expect(h).toMatch(/<dialog class="sheet rules-sheet\s*wide"|<dialog class="sheet rules-sheet wide"/);
  });
});

describe('consolidation guards', () => {
  it('every sheet goes through ui/Sheet.svelte (no hand-made <dialog class="sheet"> left)', () => {
    const hand = ALL.filter(([f, s]) => f !== 'ui/Sheet.svelte' && /<dialog[^>]*class="sheet/.test(s)).map(([f]) => f);
    expect(hand).toEqual([]);
  });
  it('states are Status, not pills (pills stay for counts, scores and tags)', () => {
    const STATE = /<span class="[^"]*\bpill\b[^"]*"[^>]*>\s*(Missed|missed|Inactive|Disabled|Active|Not active|Not filled|Reopened|reopened|In progress|Present|Absent)\b/;
    expect(ALL.filter(([, s]) => STATE.test(s)).map(([f]) => f)).toEqual([]);
  });
  it('the shared components hold no data or decisions: no API, cache, session or scoring imports', () => {
    for (const f of ['ui/Sheet.svelte', 'ui/Row.svelte', 'ui/Status.svelte']) {
      const s = readFileSync(join(SRC, f), 'utf8');
      expect(s, f).not.toMatch(/from '\.\.\/lib\/|\$shared|call\(|fetch\(/);
    }
  });
  it('ui/Mark.svelte (unused since the Day redesign) is gone', () => {
    expect(existsSync(join(SRC, 'ui/Mark.svelte'))).toBe(false);
  });
});
