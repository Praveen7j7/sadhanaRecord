import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { call, normalizeLogin, normalizePhone, getToken, setToken, config, hooks, ApiError } from '../src/lib/api.js';

let store, calls, replies;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] });
  vi.stubEnv('VITE_API_URL', 'https://example.test/exec');
  calls = [];
  replies = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { json: async () => replies.shift() };
  }));
  config.busyDelayMs = 1;
  hooks.onUnauthenticated = () => {};
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const ok = (data = {}) => ({ ok: true, data });
const err = (code, extra = {}) => ({ ok: false, error: { code, message: code, ...extra } });

describe('envelope', () => {
  it('posts text/plain JSON with v, action, token, requestId, app, data', async () => {
    setToken('tok1');
    replies.push(ok({ x: 1 }));
    const out = await call('requests.reject', { phone: '6000000087', reason: 'dup' });
    expect(out).toEqual({ x: 1 });
    const { url, init, body } = calls[0];
    expect(url).toBe('https://example.test/exec');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(body).toMatchObject({ v: 1, action: 'requests.reject', token: 'tok1', app: 'test-build', data: { phone: '6000000087', reason: 'dup' } });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('omits token on public actions and requestId on reads', async () => {
    setToken('tok1');
    replies.push(ok(), ok());
    await call('auth.login', { login: 'x', password: 'y' });
    await call('requests.list');
    expect(calls[0].body.token).toBeUndefined();
    expect(calls[1].body.requestId).toBeUndefined();
    expect(calls[1].body.token).toBe('tok1');
  });

  // the other public routes never read a session (22 Oct 2026, G16): the sign-up name check and a phone's push address
  // are answered for anyone, so a signed-in person's token has no business travelling with them
  it('omits the token on auth.lookup, push.register and push.unsubscribe', async () => {
    setToken('tok1');
    for (const a of ['auth.lookup', 'push.register', 'push.unsubscribe']) { replies.push(ok()); await call(a, {}); }
    expect(calls.map((c) => c.body.token)).toEqual([undefined, undefined, undefined]);
  });

  // meta.get is the exception among the public routes: it works with no login (sign-up calls it
  // first) AND answers a signed-in caller with their staff batch list, which is how a training
  // batch reaches the screens that run it. Stripping its token hid ETP-21 from its own coordinator
  // (the head, 17 Oct 2026), so the token goes when there is one — and only then.
  it('sends the token on meta.get when there is one, and nothing when there is not', async () => {
    setToken('tok1');
    replies.push(ok());
    await call('meta.get');
    expect(calls[0].body.token).toBe('tok1');

    setToken('');
    replies.push(ok());
    await call('meta.get');
    expect(calls[1].body.token).toBeUndefined();
  });
});

describe('BUSY retry', () => {
  it('retries up to 3 times with the same requestId', async () => {
    replies.push(err('BUSY'), err('BUSY'), ok({ done: true }));
    const out = await call('batches.update', { batchId: 'SPS', active: true });
    expect(out).toEqual({ done: true });
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((c) => c.body.requestId)).size).toBe(1);
  });
  it('gives up after 3 retries', async () => {
    replies.push(err('BUSY'), err('BUSY'), err('BUSY'), err('BUSY'));
    await expect(call('batches.update', { batchId: 'SPS' })).rejects.toMatchObject({ code: 'BUSY' });
    expect(calls).toHaveLength(4);
  });
  it('reuses the requestId when the user retries after a network failure', async () => {
    fetch.mockRejectedValueOnce(new TypeError('offline'));
    await expect(call('requests.reject', { phone: '9', reason: 'x' })).rejects.toMatchObject({ code: 'NETWORK', message: 'No connection, try again' });
    replies.push(ok());
    await call('requests.reject', { phone: '9', reason: 'x' });
    // first attempt threw before our capture; compare via fetch mock
    const ids = fetch.mock.calls.map((c) => JSON.parse(c[1].body).requestId);
    expect(ids[0]).toBe(ids[1]);
  });
});

describe('errors', () => {
  it('UNAUTHENTICATED clears the token and notifies', async () => {
    setToken('tok1');
    const spy = vi.fn();
    hooks.onUnauthenticated = spy;
    replies.push(err('UNAUTHENTICATED'));
    await expect(call('requests.list')).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBe('');
    expect(spy).toHaveBeenCalled();
  });
  it('carries VALIDATION fields', async () => {
    replies.push(err('VALIDATION', { fields: [{ path: 'phone', message: 'bad' }] }));
    await expect(call('auth.signUp', {})).rejects.toMatchObject({ fields: [{ path: 'phone', message: 'bad' }] });
  });
});

describe('phone normalisation', () => {
  it.each([
    ['60000 00087', '6000000087'],
    ['+91 60000 00087', '6000000087'],
    ['+916000000087', '6000000087'],
    ['06000000087', '6000000087'],
    ['6000000087', '6000000087'],
  ])('%s -> %s', (i, o) => expect(normalizePhone(i)).toBe(o));
  it('lowercases usernames and keeps phones numeric', () => {
    expect(normalizeLogin('  SPS ')).toBe('sps');
    expect(normalizeLogin('+91 60000 00087')).toBe('6000000087');
  });
});
