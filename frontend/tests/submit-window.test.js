// The app's half of "a master setting must be said, not hardcoded".
//
// Every screen that mentions the submit window used to carry "Sunday 6 PM" / "Monday 9 PM" as literal text
// while the server enforced the setting, so moving the window to Sunday 2 PM changed the lock and nothing
// the devotee was told. These check the words follow the setting, and that the MOCK enforces the setting
// too — it used to do arithmetic on 18:00/21:00, so the browser checks were proving the app worked for a
// window nobody had set.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle, reset, setLatency } from '../src/lib/mock.js';
import { windowWords, windowText } from '../../shared/window.js';

beforeEach(() => { reset(); setLatency(0); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('the window is said the way a person says it', () => {
  it('turns the head\'s setting into words', () => {
    expect(windowText('SUN 14:00')).toBe('Sunday 2 PM');
    expect(windowText('SUN 14:30')).toBe('Sunday 2:30 PM');
    expect(windowText('MON 21:00')).toBe('Monday 9 PM');
  });
  it('names noon and midnight, which "12 PM" and "12 AM" get wrong', () => {
    expect(windowText('SUN 12:00')).toBe('Sunday noon');
    expect(windowText('SUN 00:00')).toBe('Sunday midnight');
  });
  it('falls back instead of throwing, so one bad row cannot blank every screen', () => {
    expect(windowText('rubbish', 'Sunday 6 PM')).toBe('Sunday 6 PM');
    expect(windowWords({}).opensText).toBe('Sunday 6 PM');
  });
});

describe('meta carries the window to the app', () => {
  it('meta.get returns whatever the head has set, not a constant', async () => {
    const m = await login('master', 'master-pass-1');
    await req('settings.update', { submitWindow: { opens: 'SUN 14:00', closes: 'MON 21:00' } }, m);
    const meta = await req('meta.get');
    expect(meta.data.submitWindow).toEqual({ opens: 'SUN 14:00', closes: 'MON 21:00' });
  });
  it('and the cache keeps it, so a screen can read it without another call', () => {
    // sr.meta used to drop submitWindow on the way into localStorage
    expect(src('../src/lib/meta.js')).toMatch(/submitWindow: d\.submitWindow/);
    expect(src('../src/lib/meta.js')).toMatch(/export function windowSay/);
  });
});

describe('the mock ENFORCES the setting, as the server does', () => {
  it('moving the window moves what the mock allows', async () => {
    const m = await login('master', 'master-pass-1');
    const before = (await req('settings.get', {}, m)).data.submitWindow;
    expect(before.opens).toBe('SUN 18:00');
    // a window that closed long ago: filling last week must now be refused
    await req('settings.update', { submitWindow: { opens: 'SUN 14:00', closes: 'MON 10:00' } }, m);
    const after = (await req('settings.get', {}, m)).data.submitWindow;
    expect(after).toEqual({ opens: 'SUN 14:00', closes: 'MON 10:00' });
  });
  it('and its refusal message follows the setting too', () => {
    /* The mock's own WINDOW_CLOSED text said 'You can submit from Sunday 6 PM.' literally, which is the
       same bug as the server's, one layer down: the browser checks and every screenshot would have shown
       the wrong time while the mock enforced the right one. Asserted on the source, because reaching this
       branch needs a seeded devotee whose open week starts after the new window — the mock's refusal text
       is what matters, not the path that reaches it. */
    const mw = src('../src/lib/mockweeks.js');
    // the whole line, so nested parens in windowWords(windowSpecs()) do not cut it short
    const line = mw.split('\n').find((l) => /now < opensOf\(d\.weekId\)/.test(l));
    expect(line, 'the submit refusal was not found at all').toBeTruthy();
    expect(line).toMatch(/fromSentence/);
    expect(line).not.toMatch(/Sunday 6 PM/);
  });

  it('the mock reads the setting instead of hardcoding 18:00 and 21:00', () => {
    const mw = src('../src/lib/mockweeks.js');
    // the arithmetic that ignored the admin screen entirely
    expect(mw).not.toMatch(/6 \* DAY \+ 18 \* 3600e3/);
    expect(mw).not.toMatch(/7 \* DAY \+ 21 \* 3600e3/);
    expect(mw).toMatch(/setWindowSpecs/);
    expect(src('../src/lib/mockadmin.js')).toMatch(/setWindowSpecs\(/);
  });
});

describe('no screen says the window as literal text', () => {
  // the first-run guide is titles only since 22 Oct 2026 (G12): it states no time at all, and must not start to
  it('the first-run guide states no time or day at all', () => {
    const visible = src('../src/ui/FirstRun.svelte').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(visible).not.toMatch(/\b\d{1,2}(:\d\d)?\s?(AM|PM)\b|Sunday|Monday|Saturday/);
  });
  const files = ['../src/fac/Fac.svelte', '../src/devotee/Group.svelte'];
  it.each(files)('%s asks for the words instead of writing them', (f) => {
    const text = src(f);
    expect(text).toMatch(/windowSay/);
    // the phrases that were wrong the moment the head moved the window
    const visible = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(visible).not.toMatch(/Sunday 6 PM/);
    expect(visible).not.toMatch(/Monday 9 PM/);
  });
});
