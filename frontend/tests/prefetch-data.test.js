// B3 (22 Oct 2026): pressing a tab warms that screen's first read as well as its code, under the SAME cache key the
// screen reads — so the screen opens on a copy that is already there, and no call is ever made twice.
import { describe, it, expect, beforeEach, vi } from 'vitest';

let store;
beforeEach(() => {
  store = {};
  const ls = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k],
    get length() { return Object.keys(store).length; }, key: (i) => Object.keys(store)[i] ?? null };
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', ls);
  vi.stubGlobal('location', { hash: '', replace() {}, reload() {} });
  vi.stubEnv('VITE_API_URL', '');
});

async function setup(login, password) {
  vi.resetModules();
  const mock = await import('../src/lib/mock.js');
  mock.setLatency(0);
  const actions = [];
  const realHandle = mock.handle;
  vi.doMock('../src/lib/mock.js', () => ({ ...mock, handle: (b) => { actions.push(b.action); return realHandle(b); } }));
  const api = await import('../src/lib/api.js');
  const cache = await import('../src/lib/cache.svelte.js');
  const { prefetch } = await import('../src/lib/prefetch.js');
  const d = await api.call('auth.login', { login, password });
  api.setToken(d.token);
  actions.length = 0;
  return { api, cache, prefetch, actions };
}
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('pressing a tab warms its first read', () => {
  it('Report: history.list is fetched once, into the key Report reads', async () => {
    const { api, cache, prefetch, actions } = await setup('6000000001', 'pass-12345');
    prefetch('#/report'); await settle();
    expect(actions.filter((a) => a === 'history.list')).toHaveLength(1);
    expect(cache.entry('history.list').data).toBeTruthy();
    // what Report.svelte then does: no second call
    await cache.load('history.list', () => api.call('history.list', { limit: 26 }));
    expect(actions.filter((a) => a === 'history.list')).toHaveLength(1);
  });
  it('a second press within two minutes costs nothing', async () => {
    const { prefetch, actions } = await setup('6000000001', 'pass-12345');
    prefetch('#/report'); await settle(); prefetch('#/report'); await settle();
    expect(actions.filter((a) => a === 'history.list')).toHaveLength(1);
  });
  it('a screen with nothing to warm makes no call', async () => {
    const { prefetch, actions } = await setup('6000000001', 'pass-12345');
    prefetch('#/week'); prefetch('#/account'); await settle();
    expect(actions).toHaveLength(0);
  });
});
