// Asking to start a batch, in the mock (= the server, worker/tests/batchreq.test.mjs; Phase 23): a coordinator asks, the
// head approves by creating the batch from the request (or declines with a note), the requester may withdraw; another
// coordinator sees none of it; the new batch is the requester's at once.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';
import { nextNumber } from '../src/lib/batchreq.svelte.js';

beforeEach(() => { reset(); setLatency(0); setNow('2026-10-27T10:00:00+05:30'); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const field = (r) => r.error?.fields?.[0]?.path || r.error?.details?.[0]?.path || '';

describe('asking to start a batch (mock)', () => {
  it('validates as the server does, and only staff may ask', async () => {
    const S = await login('sps', 'sps-pass-12'), D = await login('6000000001', 'pass-12345');
    expect((await req('batchReq.create', { level: 'VL2', startsOn: '2026-10-27' }, D)).error.code).toBe('FORBIDDEN');
    expect(field(await req('batchReq.create', { level: 'SPS', startsOn: '2026-10-27' }, S))).toBe('level');
    expect(field(await req('batchReq.create', { level: 'VL2', startsOn: '2026-10-26' }, S))).toBe('startsOn');
    expect(field(await req('batchReq.create', { level: 'VL2', startsOn: '2026-10-27', endsOn: '2026-12-31' }, S))).toBe('endsOn');
    expect(field(await req('batchReq.create', { level: 'ETP', startsOn: '2026-11-02', endsOn: '2026-11-01' }, S))).toBe('endsOn');
    expect((await req('batchReq.create', { level: 'VL2', startsOn: '2026-10-27' }, S)).ok).toBe(true);
    expect((await req('batchReq.create', { level: 'VL2', startsOn: '2026-10-28' }, S)).error.code).toBe('CONFLICT');
  });

  it('the head approves by creating the batch; it is the requester\'s at once', async () => {
    const S = await login('sps', 'sps-pass-12'), E = await login('etp', 'etp-pass-12'), M = await login('master', 'master-pass-1');
    const r = (await req('batchReq.create', { level: 'ETP', startsOn: '2026-10-27', endsOn: '2027-01-31', note: 'New facilitators' }, S)).data;
    expect([r.state, r.levelName, r.mine]).toEqual(['WAITING', 'ETP', true]);
    expect((await req('batchReq.list', {}, E)).data.requests).toEqual([]);                 // another coordinator: none
    expect((await req('batchReq.withdraw', { id: r.id }, E)).error.code).toBe('NOT_FOUND');
    const list = (await req('batchReq.list', {}, M)).data;
    expect([list.waiting, list.requests[0].byName]).toEqual([1, 'SPS Team']);
    // Batch setup's form, pre-filled: the next number after ETP-21 is 22
    const batches = (await req('batches.list', {}, M)).data;
    expect(nextNumber(batches, 'ETP')).toBe(22);
    expect(nextNumber(batches, 'VL2')).toBe(1);
    const b = await req('batches.create', { batchId: 'ETP-22', name: 'ETP · Batch 22', level: 'ETP', startedOn: '2026-10-27', endsOn: '2027-01-31', coordinatorLogins: ['sps'], fromRequest: r.id }, M);
    expect(b.ok).toBe(true);
    expect((await req('batchReq.list', {}, S)).data.requests[0]).toMatchObject({ state: 'STARTED', batchId: 'ETP-22', batchName: 'ETP · Batch 22' });
    expect((await req('auth.me', {}, S)).data.user.scopes.coordinator).toContain('ETP-22');
    expect((await req('meta.get', {}, S)).data.staffBatches.some((x) => x.batchId === 'ETP-22')).toBe(true);
    expect((await req('batches.create', { batchId: 'ETP-23', name: 'ETP · Batch 23', level: 'ETP', endsOn: '2027-01-31', fromRequest: r.id }, M)).error.code).toBe('CONFLICT');
  });

  it('a future start is created on its day; decline needs a note; the requester withdraws', async () => {
    const S = await login('sps', 'sps-pass-12'), M = await login('master', 'master-pass-1');
    const v = (await req('batchReq.create', { level: 'VL2', startsOn: '2026-11-02' }, S)).data;
    expect(field(await req('batches.create', { batchId: 'VL2-1', name: 'Vedic Level 2 · Batch 1', level: 'VL2', startedOn: '2026-11-02', fromRequest: v.id }, M))).toBe('startedOn');
    expect(field(await req('batchReq.decide', { id: v.id, decision: 'decline' }, M))).toBe('note');
    const d = await req('batchReq.decide', { id: v.id, decision: 'decline', note: 'After Kartik' }, M);
    expect([d.data.state, d.data.decisionNote]).toEqual(['DECLINED', 'After Kartik']);
    const w = (await req('batchReq.create', { level: 'VL3', startsOn: '2026-10-27' }, S)).data;
    expect((await req('batchReq.decide', { id: w.id, decision: 'decline', note: 'x y' }, S)).error.code).toBe('FORBIDDEN');
    expect((await req('batchReq.withdraw', { id: w.id }, S)).data.state).toBe('WITHDRAWN');
    expect((await req('batchReq.list', {}, M)).data.waiting).toBe(0);
  });
});
