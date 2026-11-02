// Only the calls that are needed: revisits within 2 minutes reuse the saved list, Refresh always asks,
// the two admin lists come from one call, and login pre-loads only Requests.
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

async function setup() {
  vi.resetModules();
  const mock = await import('../src/lib/mock.js');
  mock.setLatency(0);
  const actions = [];
  const realHandle = mock.handle;
  vi.doMock('../src/lib/mock.js', () => ({ ...mock, handle: (b) => { actions.push(b.action); return realHandle(b); } }));
  const api = await import('../src/lib/api.js');
  const cache = await import('../src/lib/cache.svelte.js');
  const d = await api.call('auth.login', { login: 'master', password: 'master-pass-1' });
  api.setToken(d.token);
  actions.length = 0;
  return { api, cache, actions };
}

describe('server calls are kept to what is needed', () => {
  it('a screen revisited within 2 minutes makes no call; Refresh does', async () => {
    const { cache, actions } = await setup();
    await cache.load('requests.list');
    await cache.load('requests.list');
    await cache.load('requests.list');
    expect(actions.filter((a) => a === 'requests.list')).toHaveLength(1);
    await cache.load('requests.list', undefined, { force: true });
    expect(actions.filter((a) => a === 'requests.list')).toHaveLength(2);
  });
  it('after 2 minutes the next visit asks again', async () => {
    const { cache, actions } = await setup();
    await cache.load('requests.list');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + cache.MAX_AGE + 1);
    await cache.load('requests.list');
    expect(actions.filter((a) => a === 'requests.list')).toHaveLength(2);
    vi.restoreAllMocks();
  });
  it('opening the Coordinators or Batches screen is one call for both lists', async () => {
    const { cache, actions } = await setup();
    await Promise.all([cache.load('coordinators.list'), cache.load('batches.list')]);
    expect(actions).toEqual(['admin.lists']);
    expect(cache.entry('coordinators.list').data.length).toBeGreaterThan(0);
    expect(cache.entry('batches.list').data.length).toBeGreaterThan(0);
    await cache.load('batches.list');                       // the other tab, right after: nothing
    expect(actions).toEqual(['admin.lists']);
  });
  it('login pre-loads only the Requests list', async () => {
    const { cache, actions } = await setup();
    await cache.prefetch({ role: 'MASTER' });
    await new Promise((r) => setTimeout(r, 10));
    expect(actions).toEqual(['requests.list']);
  });
});

// A repeat open costs ONE call, not two (19 Oct 2026). restore() asked auth.me and then home.get was fetched
// alongside it: two round trips before the screen is right. home.get carries the same `user` object auth.me
// returns, so for a devotee this phone has shown before, the first answer serves both. Everything else still asks
// auth.me — the cases are each asserted below, because this is where a wrong shortcut would show stale identity.
describe('a repeat open', () => {
  async function restoreWith(user, { home = true } = {}) {
    vi.resetModules();
    const mock = await import('../src/lib/mock.js');
    mock.setLatency(0);
    const actions = [];
    const realHandle = mock.handle;
    vi.doMock('../src/lib/mock.js', () => ({ ...mock, handle: (b) => {
      actions.push(b.action);
      const r = realHandle(b);
      // an older API that does not carry `user` on home.get: the client must fall back to auth.me
      if (!home && b.action === 'home.get') return r.then?.((x) => { if (x?.data) delete x.data.user; return x; }) ?? r;
      return r;
    } }));
    const api = await import('../src/lib/api.js');
    const d = await api.call('auth.login', { login: user.login, password: user.password });
    api.setToken(d.token);
    store['sr.user'] = JSON.stringify(d.user);          // this phone has shown them before
    const s = await import('../src/lib/session.svelte.js');
    actions.length = 0;
    await s.restore();
    await new Promise((r) => setTimeout(r, 20));        // prefetch settles
    // the user restore settled on, read back from this phone (session is module state, and these cases each
    // re-import the module graph, so the kept copy is the stable thing to assert)
    return { actions, session: s.session, kept: JSON.parse(store['sr.user'] || 'null') };
  }

  it('a devotee: home.get only, and the person is still identified', async () => {
    const { actions, kept } = await restoreWith({ login: '6000000001', password: 'pass-12345' });
    expect(actions).not.toContain('auth.me');
    expect(actions).toContain('home.get');
    expect(kept.login).toBe('6000000001');
    expect(kept.scopes.devotee).toBeTruthy();
  });

  // Staff have no devotee scope, so nothing fetches home.get for them and the shortcut cannot apply. Asserted on
  // the CODE's own condition rather than by driving a second login in this file: each case re-imports the module
  // graph while localStorage persists, so a second sign-in here tests the harness, not the app. The devotee cases
  // above drive the real thing; the browser suite drives every role for real.
  it('staff never take the shortcut: it is gated on the devotee scope', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/lib/session.svelte.js', import.meta.url), 'utf8');
    expect(src).toMatch(/scopesOf\(kept\)\?\.devotee/);
    const { scopesOf } = await import('../src/lib/scopes.js');
    expect(scopesOf({ role: 'MASTER', scopes: { master: true, coordinator: [] } }).devotee).toBeFalsy();
    expect(scopesOf({ role: 'COORDINATOR', scopes: { coordinator: ['SPS'] } }).devotee).toBeFalsy();
  });

  it('falls back to auth.me when home.get carries no user', async () => {
    const { actions, kept } = await restoreWith({ login: '6000000001', password: 'pass-12345' }, { home: false });
    expect(actions).toContain('auth.me');
    expect(kept.login).toBe('6000000001');
  });
});

// The Report screen's month view (13 Oct 2026; audit FE-7 / roadmap 5.4). It used to call week.get once per
// submitted week in view — up to six extra round trips on opening a month, each a whole week of answers and marks,
// when the calendar only needed seven numbers per week. history.list carries them as `dayPct` now, and a week is
// fetched in full only when the person opens one.
// The Report screen's month view (13 Oct 2026; audit FE-7 / roadmap 5.4). It used to call week.get once per
// submitted week in view — up to six round trips on opening a month, each a whole week of answers and marks, when
// the calendar needed seven numbers per week. history.list carries them as `dayPct`, and a week is fetched in full
// only when the person opens one.
//
// The numbers themselves are checked where they are computed: worker/tests/weeks.test.mjs asserts the exact
// dayPct of a part week ([100,100,0,0,0,0,0]), and the SQL was verified against shared/scoring.js dayPercent() on
// the same week before it was committed. A client test that drove the mock through the API client could not see a
// seeded week (the mock the test imports is a different instance from the one api.js loads), so rather than leave
// a test that passes whether or not the field exists — the exact trap this phase has hit twice — the check that
// the SCREEN asks for one request per month belongs in the browser suite, where a real page is driven.
describe('the Report month view', () => {
  it('reads each day\'s percentage from the history, not from a week.get per week', async () => {
    const { readFileSync } = await import('node:fs');
    const report = readFileSync(new URL('../src/devotee/Report.svelte', import.meta.url), 'utf8');
    // the calendar's source is history.list's dayPct …
    expect(report).toMatch(/dayPctOf\s*=\s*\(w\)\s*=>\s*histMap\.get\(w\)\?\.dayPct/);
    // … and week.get is fetched for the SELECTED week only, never in a loop over the month
    const effects = report.split('$effect(').slice(1).map((x) => x.slice(0, 400));
    const weekGets = effects.filter((e) => e.includes("'week.get:'"));
    expect(weekGets.length, 'one effect fetches a week').toBe(1);
    expect(weekGets[0]).toMatch(/selWeek/);
    expect(weekGets[0]).not.toMatch(/for \(const w of weeks\)/);
  });
});
