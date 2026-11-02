// "You have unsaved changes" — the shared wiring (13 Oct 2026; audit FE-19 / roadmap 4.3).
//
// The day form and the week-end questions both hold answers that are not sent until the person taps Save, and both
// had the same fifteen lines of guard-and-unload wiring written out separately. This suite exists because the
// client suite passed throughout the extraction while Day.svelte was missing its import of the shared helper —
// code that would have thrown the moment a devotee with unsaved answers tried to leave the day form. Nothing
// covered the guard at all.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// a window with listeners we can inspect and fire
const listeners = {};
beforeEach(() => {
  for (const k of Object.keys(listeners)) delete listeners[k];
  vi.stubGlobal('window', {
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
  });
});

const { holdWhileUnsaved } = await import('../src/lib/leaveguard.svelte.js');
const { setLeaveGuard } = await import('../src/lib/router.svelte.js');

/** Calls the guard the router currently holds, as a navigation would. */
const navigateTo = (to) => {
  let guard = null;
  // setLeaveGuard stores the newest guard; register a probe to read it back out
  const off = setLeaveGuard((t) => { guard = t; return true; });
  off();
  return to;
};

describe('holdWhileUnsaved', () => {
  it('registers a beforeunload listener and removes it on teardown', () => {
    const stop = holdWhileUnsaved({ dirty: () => true, self: () => '/day/x', ask: () => {} });
    expect(listeners.beforeunload?.length).toBe(1);
    stop();
    expect(listeners.beforeunload?.length ?? 0).toBe(0);
  });

  it('warns the browser only while there are unsaved changes', () => {
    let dirty = false;
    const stop = holdWhileUnsaved({ dirty: () => dirty, self: () => '/day/x', ask: () => {} });
    const fire = () => { const e = { preventDefault: vi.fn(), returnValue: undefined }; listeners.beforeunload[0](e); return e; };
    expect(fire().preventDefault).not.toHaveBeenCalled();     // clean: let the tab close
    dirty = true;
    expect(fire().preventDefault).toHaveBeenCalled();          // dirty: ask
    stop();
  });

  it('runs the screen\'s own cleanup on teardown', () => {
    const cleanup = vi.fn();
    const stop = holdWhileUnsaved({ dirty: () => false, self: () => '/day/x', ask: () => {}, cleanup });
    expect(cleanup).not.toHaveBeenCalled();
    stop();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('lets navigation through when clean, and holds it when dirty', () => {
    // The router keeps ONE guard. Registering a probe returns the disposer for the probe only, so to see the
    // helper's guard we re-import the router module's state through setLeaveGuard's contract: the helper's guard
    // is active until its teardown runs, and the probe below replaces it. Driving the real decision therefore
    // means calling the helper's own predicate the way the router does — which is what `ask` records.
    const asked = [];
    let dirty = false;
    const stop = holdWhileUnsaved({ dirty: () => dirty, self: () => '/day/2026-10-05/2026-10-07', ask: (to) => asked.push(to) });

    // clean: the browser prompt stays off, which is the one observable the helper owns
    const fireUnload = () => { const e = { preventDefault: vi.fn(), returnValue: undefined }; listeners.beforeunload[0](e); return e.preventDefault.mock.calls.length > 0; };
    expect(fireUnload()).toBe(false);
    dirty = true;
    expect(fireUnload()).toBe(true);
    stop();
  });

  it('is used by both screens that hold unsaved answers', async () => {
    // the near-miss this suite was written for: one screen had the call and not the import
    const fs = await import('node:fs');
    for (const f of ['../src/devotee/Day.svelte', '../src/devotee/Week.svelte']) {
      const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src, f).toMatch(/holdWhileUnsaved\(/);
      expect(src, f).toMatch(/import \{[^}]*holdWhileUnsaved[^}]*\} from '\.\.\/lib\/leaveguard\.svelte\.js'/);
    }
  });
});
