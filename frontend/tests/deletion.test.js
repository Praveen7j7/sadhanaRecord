// Account deletion (Account › Delete account): the mock answers as the server does (worker/src/erase.js, its order of
// checks), and after it this phone keeps nothing of that login (lib/forget.js + session endHere()).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ownIdbKey, ownLocalKey } from '../src/lib/forget.js';

describe('the keys kept for one login', () => {
  const idb = ownIdbKey('6000000001'), local = ownLocalKey('6000000001');
  it('IndexedDB: unsent days, photo, journals, kept screens of that login only', () => {
    for (const k of ['q:6000000001:2026-09-28:2026-10-01', 'photo:6000000001', 'journals:6000000001', 'c:6000000001|home.get']) expect(idb(k)).toBe(true);
    for (const k of ['q:60000000011:x:y', 'photo:6000000087', 'ann:12', 'c:sps|requests.list', 'journals:']) expect(idb(k)).toBe(false);
  });
  it('localStorage: that login\'s keys and the notification mark, nothing shared', () => {
    for (const k of ['sr.annSeen.6000000001', 'sr.rules.6000000001', 'sr.book.6000000001', 'sr.pushFor']) expect(local(k)).toBe(true);
    for (const k of ['sr.theme', 'sr.meta', 'sr.reminderOff', 'sr.annSeen.6000000087', 'sr.quotes']) expect(local(k)).toBe(false);
  });
  it('no login: nothing personal matches', () => {
    expect(ownIdbKey('')('photo:')).toBe(false);
    expect(ownLocalKey('')('sr.annSeen.')).toBe(false);
  });
});

let store;
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
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem() {}, removeItem() {}, length: 0, key: () => null });
  vi.stubGlobal('location', { hash: '', replace() {}, reload() {} });
  vi.stubEnv('VITE_API_URL', '');
});
async function app() {
  vi.resetModules();
  const mock = await import('../src/lib/mock.js'); mock.reset(); mock.setLatency(0);
  const api = await import('../src/lib/api.js'); api.config.busyRetries = 0;
  return { api, ses: await import('../src/lib/session.svelte.js'), cache: await import('../src/lib/cache.svelte.js'), forget: await import('../src/lib/forget.js') };
}
async function signIn(a, login, password) {
  const d = await a.api.call('auth.login', { login, password });
  a.ses.startSession(d.token, d.user);
  return d.user;
}
const codeOf = (p) => p.then(() => 'OK', (e) => e.code);

describe('account.delete (mock, the server\'s order of checks)', () => {
  it('staff: FORBIDDEN, whatever they type', async () => {
    const a = await app();
    for (const [l, p] of [['sps', 'sps-pass-12'], ['master', 'master-pass-1'], ['natvar', 'natvar-pass-1']]) {
      await signIn(a, l, p);
      const e = await a.api.call('account.delete', { password: p, confirm: 'DELETE' }).catch((x) => x);
      expect([l, e.code, e.message]).toEqual([l, 'FORBIDDEN', 'Ask the IYF head to remove your role first.']);
    }
  });
  it('wrong password, then no DELETE, then deleted: the token is dead and the login is gone', async () => {
    const a = await app();
    await signIn(a, '6000000001', 'pass-12345');
    const bad = await a.api.call('account.delete', { password: 'nope-nope', confirm: 'DELETE' }).catch((x) => x);
    expect([bad.code, bad.message]).toEqual(['BAD_CREDENTIALS', 'Your password is wrong.']);
    const word = await a.api.call('account.delete', { password: 'pass-12345', confirm: 'delet' }).catch((x) => x);
    expect(word.code).toBe('VALIDATION');
    expect(a.api.fieldErrors(word)).toEqual({ confirm: 'Type DELETE to confirm.' });
    expect(await a.api.call('account.delete', { password: 'pass-12345', confirm: ' delete ' })).toEqual({});
    expect(await codeOf(a.api.call('auth.me'))).toBe('UNAUTHENTICATED');
    expect(await codeOf(a.api.call('auth.login', { login: '6000000001', password: 'pass-12345' }))).toBe('BAD_CREDENTIALS');
  });
  it('5 tries in 15 minutes, then BUSY (even with the right password)', async () => {
    const a = await app();
    await signIn(a, '6000000001', 'pass-12345');
    for (let i = 0; i < 5; i++) expect(await codeOf(a.api.call('account.delete', { password: 'wrong-' + i, confirm: 'DELETE' }))).toBe('BAD_CREDENTIALS');
    expect(await codeOf(a.api.call('account.delete', { password: 'pass-12345', confirm: 'DELETE' }))).toBe('BUSY');
  });
});

describe('after deleting, this phone keeps nothing of that login', () => {
  it('token, kept person, kept screens, drafts, photo, journals and per-login keys gone; others\' stay', async () => {
    const a = await app();
    await signIn(a, '6000000001', 'pass-12345');
    await a.cache.load('home.get');
    for (const k of ['q:6000000001:w:d', 'photo:6000000001', 'journals:6000000001', 'photo:6000000087', 'ann:1']) phoneDb.set(k, 1);
    Object.assign(store, { 'sr.annSeen.6000000001': 'x', 'sr.rules.6000000001': '{}', 'sr.book.6000000001': '{}', 'sr.pushFor': '{}', 'sr.theme': 'dark' });
    expect(store['sr.token'] && store['sr.user']).toBeTruthy();
    await a.api.call('account.delete', { password: 'pass-12345', confirm: 'DELETE' });
    await a.forget.forgetLogin('6000000001');
    await a.ses.endHere();
    expect(a.ses.session.user).toBe(null);
    expect(Object.keys(store).sort()).toEqual(['sr.theme']);
    expect([...phoneDb.keys()].sort()).toEqual(['ann:1', 'photo:6000000087']);
  });
});

// Log-out, not deletion (13 Oct 2026, audit FE-3). endHere() cleared the token, the kept person and the read
// cache, but never the things kept FOR THAT LOGIN — the photo, the journals, the unsent days, the batch's rules,
// the current book. On a shared phone the next person to sign in could reach the last person's photo. The suite
// covered deletion only, which is why the gap survived.
describe('after logging out, this phone keeps nothing of that login', () => {
  it('photo, journals, drafts and per-login keys gone WITHOUT deleting the account; another login untouched', async () => {
    const a = await app();
    await signIn(a, '6000000001', 'pass-12345');
    await a.cache.load('home.get');
    for (const k of ['q:6000000001:w:d', 'photo:6000000001', 'journals:6000000001', 'photo:6000000087', 'ann:1']) phoneDb.set(k, 1);
    Object.assign(store, { 'sr.annSeen.6000000001': 'x', 'sr.rules.6000000001': '{}', 'sr.book.6000000001': '{}',
                           'sr.annSeen.6000000087': 'keep', 'sr.theme': 'dark' });

    await a.ses.endHere();                       // log out only — no account.delete, no explicit forgetLogin

    expect(a.ses.session.user).toBe(null);
    expect(store['sr.token']).toBeUndefined();
    // this login's keys are gone
    for (const k of ['sr.annSeen.6000000001', 'sr.rules.6000000001', 'sr.book.6000000001']) expect(store[k]).toBeUndefined();
    expect(phoneDb.has('photo:6000000001')).toBe(false);
    expect(phoneDb.has('journals:6000000001')).toBe(false);
    expect(phoneDb.has('q:6000000001:w:d')).toBe(false);
    // another person's, and the shared settings, are untouched
    expect(store['sr.theme']).toBe('dark');
    expect(store['sr.annSeen.6000000087']).toBe('keep');
    expect([...phoneDb.keys()].sort()).toEqual(['ann:1', 'photo:6000000087']);
  });
});
