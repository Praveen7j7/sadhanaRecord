// Phase 23 (ADR 0020) in the mock — the server is worker/tests/phase23-auto-inactive.test.mjs: 30 days with no day filled
// and no use of the app make someone inactive; signing in brings back only the app's own marks; a filled day brings
// anyone back; coordinators see their batches' notices, the head all; the analysis counts by month and by day.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency } from '../src/lib/mock.js';
import { setNow } from '../src/lib/mockweeks.js';
import { runDailyInactive } from '../src/lib/mockstaff.js';

const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
beforeEach(() => { reset(); setLatency(0); setNow(new Date('2026-11-24T00:13:00+05:30')); });

describe('mock: automatic inactive', () => {
  it('Sunil (no week in the mock, never signed in) becomes inactive; the made-up weekly fillers do not', async () => {
    expect(runDailyInactive()).toBeGreaterThan(0);
    const c = await login('sps', 'sps-pass-12');
    const mem = await req('members.list', { batchId: 'SPS', status: 'INACTIVE' }, c);
    expect(mem.data.rows.map((x) => x.login)).toContain('6000000001');
    expect(mem.data.rows.map((x) => x.login)).not.toContain('6000000011');
    const n = await req('activity.notices', {}, c);
    expect(n.data.events.find((e) => e.login === '6000000001')).toMatchObject({ change: 'INACTIVE', how: 'AUTO', batchId: 'SPS' });
    expect(runDailyInactive()).toBe(0);                     // a second run the same day changes nothing
  });
  it('signing in brings back only the app\'s own marks', async () => {
    runDailyInactive();
    await login('6000000001', 'pass-12345');
    const c = await login('sps', 'sps-pass-12');
    expect((await req('devotees.get', { login: '6000000001' }, c)).data.status).toBe('ACTIVE');
    const ev = (await req('activity.notices', {}, c)).data.events.filter((e) => e.login === '6000000001').map((e) => [e.change, e.how]);
    expect(ev).toEqual([['ACTIVE', 'APP'], ['INACTIVE', 'AUTO']]);
    // a coordinator's mark is not undone by using the app
    expect((await req('devotees.setActive', { login: '6000000012', active: false }, c)).data.status).toBe('INACTIVE');
    await login('6000000012', 'pass-12345');
    expect((await req('devotees.get', { login: '6000000012' }, c)).data.status).toBe('INACTIVE');
  });
  it('the analysis: now, by month and by day; the coordinator their batches, the head all', async () => {
    runDailyInactive();
    const m = await login('master', 'master-pass-1'), c = await login('sps', 'sps-pass-12');
    const r = await req('activity.stats', { month: '2026-11' }, m);
    const nov = r.data.months.find((x) => x.month === '2026-11');
    expect(nov.inactive).toBeGreaterThan(0);
    expect(nov.auto).toBe(nov.inactive);
    expect(r.data.days.find((x) => x.day === '2026-11-24').inactive).toBe(nov.inactive);
    expect(r.data.batches.find((b) => b.batchId === 'SPS').inactive).toBeGreaterThan(0);
    expect((await req('activity.stats', { batchId: 'BVS' }, c)).error.code).toBe('FORBIDDEN');
    expect((await req('activity.stats', { month: '2026-13' }, c)).error.code).toBe('VALIDATION');
    expect((await req('inactive.list', {}, m)).ok).toBe(false);     // no more requests
  });
});
