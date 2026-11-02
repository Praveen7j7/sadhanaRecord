// One name, one place (Phase 24), in the mock — which must be the server (worker/tests/names-one-source.test.mjs):
// renaming a facilitator as the head reaches every place a name is shown, the login that IS the facilitator takes it,
// posts to "my students" keep reaching them, the start-up replies say the lists moved, and the phone's copy of the
// lists (sr.meta) is read reactively and refreshed only when that version moved.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';

beforeEach(() => { reset(); setLatency(0); setNow('2026-10-27T10:00:00+05:30'); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const FAC = 'Natvar Gopinath Prabhuji', NEW = 'HG Natvar Gopinath Das';

describe('renaming a facilitator (mock = server)', () => {
  it('reaches the wheel, the students, the login that is him, his posts and the version the phone checks', async () => {
    const M = await login('master', 'master-pass-1'), N = await login('natvar', 'natvar-pass-1'), D = await login('6000000001', 'pass-12345');
    const post = await req('announcements.create', { title: 'For my students', body: 'Japa at six.', audience: ['STUDENTS'] }, N);
    expect(post.ok).toBe(true);
    const v0 = (await req('auth.me', {}, D)).data.versions.names;
    const r = await req('facilitators.rename', { name: FAC, newName: NEW }, M);
    expect(r.ok).toBe(true);
    expect(r.data).not.toHaveProperty('dashboard');                                   // the app is its own source
    const meta = (await req('meta.get', {})).data;
    expect(meta.facilitators).toContain(NEW);
    expect(meta.facilitators).not.toContain(FAC);
    expect((await req('auth.me', {}, D)).data.versions.names).not.toBe(v0);           // the phone will fetch the wheel again
    expect(meta.version).toBe((await req('auth.me', {}, D)).data.versions.names);
    expect((await req('profile.get', {}, D)).data.facilitator).toBe(NEW);             // a student's own record
    const me = (await req('auth.me', {}, N)).data.user;
    expect([me.name, me.scopes.facilitator?.name]).toEqual([NEW, NEW]);               // his own login: one record, one name
    const wall = (await req('announcements.list', {}, D)).data.announcements;
    expect(wall.find((a) => a.title === 'For my students')?.author).toBe(NEW);        // his earlier post still reaches them
    const mine = (await req('announcements.list', {}, N)).data.announcements.find((a) => a.title === 'For my students');
    expect(mine.audience).toEqual(['STU:' + NEW]);
    expect((await req('fac.devotees', {}, N)).data.rows.length).toBeGreaterThan(0);  // his students are still his
    expect((await req('facilitators.add', { name: FAC }, M)).ok).toBe(false);         // his old name still finds him
  });

  it('a person renaming themselves renames the facilitator they are', async () => {
    const M = await login('master', 'master-pass-1'), N = await login('natvar', 'natvar-pass-1');
    expect((await req('profile.update', { name: 'Natvar Gopinath Das' }, N)).ok).toBe(true);
    const list = (await req('facilitators.list', {}, M)).data.facilitators.map((f) => f.name);
    expect(list).toContain('Natvar Gopinath Das');
    expect(list).not.toContain(FAC);
    expect((await req('facilitators.list', {}, M)).data.facilitators.every((f) => !('inDashboard' in f))).toBe(true);
  });
});

describe('the phone’s lists follow the server at no extra call', () => {
  it('cachedMeta() is reactive to a fresh copy, and meta.get is asked only when the version moved', async () => {
    vi.resetModules();
    const store = new Map([['sr.meta', JSON.stringify({ batches: [{ batchId: 'SPS', name: 'Old SPS' }], facilitators: ['Old Name'], v: '7' })]]);
    vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
    const calls = [];
    vi.doMock('../src/lib/api.js', () => ({ call: async (a) => { calls.push(a); return { batches: [{ batchId: 'SPS', name: 'SPS' }], facilitators: ['New Name'], version: '8' }; } }));
    const meta = await import('../src/lib/meta.js');
    expect(meta.cachedMeta().facilitators).toEqual(['Old Name']);
    meta.namesVersion('7');                                                           // unchanged: nothing asked
    expect(calls).toEqual([]);
    meta.namesVersion('8');                                                           // moved: one meta.get
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(['meta.get']);
    expect(meta.cachedMeta().facilitators).toEqual(['New Name']);
    expect(meta.cachedMeta().batches[0].name).toBe('SPS');
    expect(meta.cachedMeta().v).toBe('8');
    vi.doUnmock('../src/lib/api.js'); vi.unstubAllGlobals();
  });
});
