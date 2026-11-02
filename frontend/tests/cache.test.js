import { describe, it, expect, beforeEach, vi } from 'vitest';

let store;
beforeEach(() => {
  store = {};
  const ls = {
    getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k],
    get length() { return Object.keys(store).length; }, key: (i) => Object.keys(store)[i] ?? null,
  };
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', ls);
  vi.stubGlobal('location', { hash: '', replace() {}, reload() {} });
  vi.stubEnv('VITE_API_URL', '');
});

async function mods() {
  vi.resetModules();
  (await import('../src/lib/mock.js')).setLatency(0);
  const api = await import('../src/lib/api.js');
  const cache = await import('../src/lib/cache.svelte.js');
  const sync = await import('../src/master/sync.js');
  return { api, cache, sync };
}
async function loginMaster(api) {
  const d = await api.call('auth.login', { login: 'master', password: 'master-pass-1' });
  api.setToken(d.token);
}

describe('write replies patch the cache', () => {
  it('create coordinator updates the list from the reply with no extra read', async () => {
    const { api, cache, sync } = await mods();
    await loginMaster(api);
    cache.setScope('master');
    await cache.load('coordinators.list');
    await cache.load('batches.list');
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('no network expected'); });
    const d = await api.call('coordinators.create', { username: 'dps1', name: 'Dps One', batchIds: ['BSS'], tempPassword: 'temp-pass-1' });
    sync.upsertCoordinator(d.coordinator);
    const list = cache.entry('coordinators.list').data;
    expect(list.map((c) => c.username)).toContain('dps1');
    expect(list.find((c) => c.username === 'dps1').mustChangePassword).toBe(true);
    const bss = cache.entry('batches.list').data.find((b) => b.batchId === 'BSS');
    expect(bss.coordinatorLogins).toEqual(['dps1']);
    expect(bss.coordinatorNames).toEqual(['Dps One']);
    spy.mockRestore();
  });
  it('moving a batch removes it from the previous coordinator row', async () => {
    const { api, cache, sync } = await mods();
    await loginMaster(api);
    cache.setScope('master');
    await cache.load('coordinators.list');
    await cache.load('batches.list');
    const d = await api.call('coordinators.create', { username: 'ex1', name: 'Ex One', batchIds: ['SPS'], tempPassword: 'temp-pass-1' });
    sync.upsertCoordinator(d.coordinator);
    const sps = cache.entry('coordinators.list').data.find((c) => c.username === 'sps');
    expect(sps.batchIds).toEqual(['SPS2', 'SPSO']);
  });
});

describe('cache lifecycle', () => {
  it('is cleared on logout / unauthenticated, memory and sessionStorage', async () => {
    const { api, cache } = await mods();
    await loginMaster(api);
    cache.setScope('master');
    await cache.load('coordinators.list');
    expect(cache.entry('coordinators.list').data.length).toBeGreaterThan(0);
    expect(Object.keys(store).some((k) => k.startsWith('sr.c.'))).toBe(true);
    cache.clearAll();
    expect(Object.keys(store).some((k) => k.startsWith('sr.c.'))).toBe(false);
    expect(cache.entry('coordinators.list').data).toBeUndefined();
  });
  it('hydrates from sessionStorage for the same user only', async () => {
    const { api, cache } = await mods();
    await loginMaster(api);
    cache.setScope('master');
    await cache.load('batches.list');
    const m2 = await mods();
    m2.cache.setScope('master');
    expect(m2.cache.entry('batches.list').data).toBeDefined();
    const m3 = await mods();
    m3.cache.setScope('someone-else');
    expect(m3.cache.entry('batches.list').data).toBeUndefined();
  });
  it('session logout clears the cache', async () => {
    vi.resetModules();
    (await import('../src/lib/mock.js')).setLatency(0);
    const api = await import('../src/lib/api.js');
    const cache = await import('../src/lib/cache.svelte.js');
    const sess = await import('../src/lib/session.svelte.js');
    const d = await api.call('auth.login', { login: 'master', password: 'master-pass-1' });
    sess.startSession(d.token, d.user);
    await cache.load('batches.list');
    expect(cache.entry('batches.list').data).toBeDefined();
    await sess.logout();
    expect(cache.entry('batches.list').data).toBeUndefined();
    expect(Object.keys(store).some((k) => k.startsWith('sr.c.'))).toBe(false);
  });
});
