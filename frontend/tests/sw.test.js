// The open app moves to a new version by itself, but never reloads for the very first install.
import { describe, it, expect, vi, afterEach } from 'vitest';

function setup(controllerAtLoad) {
  const listeners = {};
  const sw = { controller: controllerAtLoad ? {} : null, addEventListener: (t, f) => { listeners[t] = f; }, register: vi.fn(async () => ({ update: vi.fn(async () => {}) })) };
  const reload = vi.fn();
  vi.stubGlobal('navigator', { serviceWorker: sw });
  vi.stubGlobal('location', { reload });
  vi.stubGlobal('sessionStorage', { setItem: () => {} });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' });
  return { fire: () => listeners.controllerchange(), reload };
}

describe('staying on the latest version', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('first install while the page is open: no reload; the next version: reload', async () => {
    const s = setup(false);
    (await import('../src/lib/sw.js')).registerServiceWorker();
    s.fire(); expect(s.reload).not.toHaveBeenCalled();
    s.fire(); expect(s.reload).toHaveBeenCalledTimes(1);
  });
  it('page opened from the offline copy: a new version reloads it once', async () => {
    const s = setup(true);
    (await import('../src/lib/sw.js')).registerServiceWorker();
    s.fire(); s.fire();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });
  it('a day with changes not saved: the reload waits until it is saved, and the person is told', async () => {
    vi.useFakeTimers();
    const s = setup(true);
    let unsaved = true; const onWait = vi.fn();
    (await import('../src/lib/sw.js')).registerServiceWorker({ busy: () => unsaved, onWait });
    s.fire();
    expect(s.reload).not.toHaveBeenCalled();
    expect(onWait).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000); expect(s.reload).not.toHaveBeenCalled();
    unsaved = false; vi.advanceTimersByTime(1000);
    expect(s.reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

// An upgrade can also arrive through the API: the server answers UPGRADE_REQUIRED when the app is older than the
// contract. That path used to call location.reload() directly, throwing away a half-filled day form without
// asking — and reloading before the new service worker had taken over, so the old index.html came back and sent
// the old version again (audit FE-9 / roadmap 5.3). Both paths share reloadWhenIdle() now.
describe('an upgrade that arrives through the API', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('reloads at once when nothing is unsaved', async () => {
    const s = setup(true);
    const sw = await import('../src/lib/sw.js');
    sw.registerServiceWorker({ busy: () => false });
    sw.reloadWhenIdle();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it('waits for a day with unsaved changes, tells the person, then reloads', async () => {
    vi.useFakeTimers();
    const s = setup(true);
    const sw = await import('../src/lib/sw.js');
    let unsaved = true;
    const onWait = vi.fn();
    sw.registerServiceWorker({ busy: () => unsaved, onWait });
    sw.reloadWhenIdle();
    expect(s.reload).not.toHaveBeenCalled();
    expect(onWait).toHaveBeenCalledOnce();          // "it will apply after you save"
    vi.advanceTimersByTime(3000);
    expect(s.reload).not.toHaveBeenCalled();        // still waiting, not reloading under them
    unsaved = false;
    vi.advanceTimersByTime(1000);
    expect(s.reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('is the function the API client calls, so the two paths cannot drift apart', async () => {
    const { readFileSync } = await import('node:fs');
    const api = readFileSync(new URL('../src/lib/api.js', import.meta.url), 'utf8');
    expect(api).toMatch(/import \{ reloadWhenIdle \} from '\.\/sw\.js'/);
    // and the old unconditional reload is gone from the branch — comments stripped first, since the comment
    // there explains what it used to do and would otherwise match
    const branch = api.slice(api.indexOf('UPGRADE_REQUIRED'), api.indexOf('MUST_CHANGE_PASSWORD'))
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(branch).toMatch(/reloadWhenIdle\(\)/);
    expect(branch).not.toMatch(/location\.reload\(\)/);
  });
});
