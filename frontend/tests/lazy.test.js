import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazy } from '../src/lib/lazy.js';

describe('lazy screens after a new version', () => {
  beforeEach(() => { sessionStorage.clear(); });
  it('loads normally and clears the retry mark', async () => {
    sessionStorage.setItem('sr.lazyReload', '1');
    await expect(lazy(async () => ({ default: 'Screen' }))).resolves.toEqual({ default: 'Screen' });
    expect(sessionStorage.getItem('sr.lazyReload')).toBe(null);
  });
  it('reloads once when the old file is gone', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    lazy(async () => { throw new TypeError('Failed to fetch dynamically imported module'); });
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('sr.lazyReload')).toBe('1');
    vi.unstubAllGlobals();
  });
  it('shows the error if it fails again after the reload', async () => {
    sessionStorage.setItem('sr.lazyReload', '1');
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    await expect(lazy(async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(reload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
