// Phase 1 (speed and reliability): a server that does not answer fails fast; a repeat open shows the kept screen at
// once and starts home.get together with auth.me; an open with no connection stays signed in; the kept data never
// crosses between people on one phone and is gone after log-out.
import { describe, it, expect, beforeEach, vi } from 'vitest';

let store;
// the phone's IndexedDB outlives the app between opens (in tests the app's modules are reset; this store is not)
const phoneDb = new Map();
vi.mock('../src/lib/idb.js', () => ({
  idbGet: async (k) => phoneDb.get(k), idbSet: async (k, v) => { phoneDb.set(k, JSON.parse(JSON.stringify(v))); }, idbDel: async (k) => { phoneDb.delete(k); },
  idbKeys: async (prefix = '') => [...phoneDb.keys()].filter((k) => k.startsWith(prefix)),
}));
beforeEach(() => {
  phoneDb.clear();
  store = {};
  const ls = {
    getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k],
    get length() { return Object.keys(store).length; }, key: (i) => Object.keys(store)[i] ?? null,
  };
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null });   // a new tab
  vi.stubGlobal('location', { hash: '', replace() {}, reload() {} });
  vi.stubEnv('VITE_API_URL', '');
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A fresh app (as after closing and reopening it): new modules, the same phone storage. */
async function app({ offline = false, latency = 0 } = {}) {
  vi.resetModules();
  const mock = await import('../src/lib/mock.js'); mock.setLatency(latency); mock.setOffline(offline);
  return { mock, api: await import('../src/lib/api.js'), cache: await import('../src/lib/cache.svelte.js'), ses: await import('../src/lib/session.svelte.js'), idb: await import('../src/lib/idb.js') };
}
async function signIn(a, login = '6000000001', password = 'pass-12345') {
  const d = await a.api.call('auth.login', { login, password, device: 'Browser' });
  a.ses.startSession(d.token, d.user);
  await a.cache.load('home.get');
  await sleep(10);
  return d.user;
}

describe('a server that does not answer', () => {
  it('fails after the timeout with a clear message (no endless wait)', async () => {
    const a = await app({ latency: 3000 });                // the server would take 3 s
    a.api.config.timeoutMs = 60;
    const t0 = Date.now();
    const e = await a.api.call('meta.get').catch((x) => x);
    expect(e.code).toBe('TIMEOUT');
    expect(a.api.errorMessage(e)).toMatch(/not answering/);
    expect(Date.now() - t0).toBeLessThan(1500);           // well before it (room for a busy test machine)
  });
  it('a write that timed out keeps its request id, so trying again can never save twice', async () => {
    const a = await app({ latency: 400 });
    a.api.config.timeoutMs = 60;
    const first = await a.api.call('auth.requestReset', { login: '6000000001' }).catch((x) => x);
    expect(first.code).toBe('TIMEOUT');
    a.mock.setLatency(0);
    a.api.config.timeoutMs = 15000;
    await expect(a.api.call('auth.requestReset', { login: '6000000001' }).catch((x) => x.code)).resolves.not.toBe('TIMEOUT');
  });
});

describe('opening the app again', () => {
  // 19 Oct 2026: home.get now carries `user`, so a devotee's repeat open is ONE call — the kept screen still
  // shows at once, and home.get is what confirms who they are (cache-calls.test.js counts the calls).
  it('shows the kept person at once while home.get is still on its way', async () => {
    let a = await app();
    const user = await signIn(a);
    a = await app({ latency: 200 });                      // reopen: the server is slow to answer
    const p = a.ses.restore();
    await sleep(20);
    expect(a.ses.session.user?.login).toBe(user.login);   // before auth.me has answered
    expect(a.ses.session.ready).toBe(true);
    expect(a.cache.entry('home.get').refreshing).toBe(true);   // home.get already on its way
    await p;
    // let that home.get finish here: answered late (a busy machine), its "log in again" would sign out the next test's person
    await vi.waitFor(() => expect(a.cache.entry('home.get').refreshing).toBe(false), { timeout: 3000 });
  });
  it('with no connection: still signed in, the kept Home shown, no welcome screen', async () => {
    let a = await app();
    const user = await signIn(a);
    a = await app({ offline: true });
    await a.ses.restore();
    expect(a.ses.session.user?.login).toBe(user.login);
    // from the copy kept on the phone (waits for it: a fixed pause was too short on a busy machine)
    await vi.waitFor(() => expect(a.cache.entry('home.get').data?.weeks?.length).toBeGreaterThan(0), { timeout: 3000 });
  });
  it('a session the server has ended: signed out, and the kept person and data are forgotten', async () => {
    let a = await app();
    await signIn(a);
    a = await app();                                     // a fresh mock does not know the old token: UNAUTHENTICATED
    await a.ses.restore();
    expect(a.ses.session.user).toBe(null);
    expect(store['sr.user']).toBeUndefined();
    await vi.waitFor(async () => expect(await a.idb.idbKeys('c:')).toEqual([]), { timeout: 3000 });
  });
  // the same TAB reloaded (19 Oct 2026): its sessionStorage still holds a Home under two minutes old, and that Home
  // carries `user` since the one-call-at-open change. Taken from that copy, the person was signed in without asking the
  // server, so a session ended elsewhere (Account › Devices, a password reset) stayed open. Red on that code (proven
  // against it), green since home.get is fetched fresh at open and its error re-raised (session.svelte.js).
  it('a reload of the same tab after the server ended the session: signed out, the kept Home is no proof', async () => {
    const tab = new Map();
    vi.stubGlobal('sessionStorage', { getItem: (k) => tab.get(k) ?? null, setItem: (k, v) => tab.set(k, String(v)), removeItem: (k) => tab.delete(k),
      get length() { return tab.size; }, key: (i) => [...tab.keys()][i] ?? null });
    let a = await app();
    await signIn(a);
    expect([...tab.keys()].some((k) => k.includes('home.get'))).toBe(true);   // the fresh Home is kept in the tab
    a = await app();                                     // a fresh mock does not know the old token: UNAUTHENTICATED
    await a.ses.restore();
    expect(a.ses.session.user).toBe(null);
    expect(store['sr.user']).toBeUndefined();
  });
});

// Phase 4 (19 Oct 2026): the failure paths the one-call-at-open change could have damaged, driven rather than
// reasoned about. Both pass on the new code; both would be the first place a wrong shortcut showed.
describe('a repeat open that goes wrong', () => {
  // A role or name changed on the server: NOT testable in this harness — each app() builds a fresh mock that
  // does not know the old token, so restore() signs the person out (that is what the "session the server has
  // ended" test above relies on). The guarantee is structural instead: home.get's `user` is built by the SAME
  // server function as auth.me's (worker auth.js userInfo), so it carries a change exactly as auth.me would, and
  // begin() always overwrites the kept copy with what the server sent. The browser suite drives the real thing.
  it('logging out while the open is still in flight leaves nobody signed in', async () => {
    let a = await app();
    await signIn(a);
    a = await app({ latency: 150 });
    const p = a.ses.restore();                 // home.get on its way
    await sleep(10);
    await a.ses.endHere();                     // the person logs out before it answers
    await p;
    await sleep(60);
    expect(a.ses.session.user).toBe(null);
    expect(store['sr.user']).toBeUndefined();
  });
});

describe('a late answer about an earlier sign-in', () => {
  it('does not sign out the person signed in now', async () => {
    const a = await app();
    await signIn(a);
    a.ses.session.user = null; localStorage.setItem('sr.token', 'old-token');      // an expired sign-in, its request still out
    a.mock.setLatency(150);
    const late = a.api.call('home.get').catch((x) => x);
    await sleep(20);
    a.mock.setLatency(0);
    await signIn(a, 'master', 'master-pass-1');                                    // signed in again before it is answered
    expect((await late).code).toBe('UNAUTHENTICATED');
    expect(a.api.getToken()).toBeTruthy();
    expect(a.ses.session.user?.login).toBe('master');
  });
});

describe('kept data never crosses between people', () => {
  it('kept under each login, and removed at log-out', async () => {
    const a = await app();
    const u = await signIn(a);
    await vi.waitFor(async () => expect((await a.idb.idbKeys('c:')).some((k) => k.startsWith('c:' + u.login + '|'))).toBe(true), { timeout: 3000 });
    await a.ses.logout();
    expect(await a.idb.idbKeys('c:')).toEqual([]);
    expect(store['sr.user']).toBeUndefined();
    expect(a.ses.session.user).toBe(null);
  });
  it('the next person on the same phone sees only their own', async () => {
    const a = await app();
    await signIn(a);
    await a.ses.logout();
    const b = await signIn(a, 'master', 'master-pass-1');
    expect(a.cache.entry('home.get').data?.profile?.login).not.toBe('6000000001');   // nothing of the first person
    expect((await a.idb.idbKeys('c:')).every((k) => k.startsWith('c:' + b.login + '|'))).toBe(true);
  });
});
