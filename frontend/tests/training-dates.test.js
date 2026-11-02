// A training batch's dates and status in the mock (= the server, worker/tests/training-dates.test.mjs; Phase 22, J1):
// the head creates ETP-22 with a start and an end, moves them, sees Running / Past its end date / Ended; nothing ends by
// itself; an ended training's dates are a record.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';

beforeEach(() => { reset(); setLatency(0); setNow('2026-10-20T10:00:00+05:30'); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const field = (r) => r.error?.fields?.[0]?.path || r.error?.details?.[0]?.path || '';
const make = (M, o) => req('batches.create', { batchId: 'ETP-22', name: 'ETP · Batch 22', level: 'ETP', ...o }, M);

describe('a training batch has its own dates (mock)', () => {
  it('is created with a start and an end, validated as the server does', async () => {
    const M = await login('master', 'master-pass-1');
    expect(field(await make(M, { startedOn: '2026-10-19' }))).toBe('endsOn');
    expect(field(await make(M, { startedOn: '2026-10-19', endsOn: '2026-10-19' }))).toBe('endsOn');
    expect(field(await make(M, { startedOn: '2026-11-02', endsOn: '2027-01-31' }))).toBe('startedOn');
    expect(field(await req('batches.create', { batchId: 'SPS9', name: 'SPS Group 9', level: 'SPS', endsOn: '2026-12-31' }, M))).toBe('endsOn');
    const r = await make(M, { startedOn: '2026-10-19', endsOn: '2026-11-08' });
    expect([r.data.startedOn, r.data.endsOn, r.data.status, r.data.closedAt]).toEqual(['2026-10-19', '2026-11-08', 'RUNNING', '']);
    const list = (await req('batches.list', {}, M)).data;
    expect('status' in list.find((b) => b.batchId === 'SPS')).toBe(false);
    expect(list.find((b) => b.batchId === 'ETP-21').status).toBe('RUNNING');          // live has no end date yet: still Running
  });

  it('the head moves the dates; past the end it asks, never ends; ended, its dates are a record', async () => {
    const M = await login('master', 'master-pass-1');
    await make(M, { startedOn: '2026-10-19', endsOn: '2026-11-08' });
    expect(field(await req('batches.update', { batchId: 'ETP-22', endsOn: '2026-10-18' }, M))).toBe('endsOn');
    expect(field(await req('batches.update', { batchId: 'ETP-22', startedOn: '2026-10-25' }, M))).toBe('startedOn');
    expect(field(await req('batches.update', { batchId: 'SPS', endsOn: '2026-12-31' }, M))).toBe('endsOn');
    expect((await req('batches.update', { batchId: 'ETP-22', endsOn: '2026-11-15' }, M)).data.endsOn).toBe('2026-11-15');
    await req('batches.update', { batchId: 'ETP-22', endsOn: '2026-11-08' }, M);
    setNow('2026-11-10T21:30:00+05:30');
    expect((await req('batches.list', {}, M)).data.find((b) => b.batchId === 'ETP-22')).toMatchObject({ status: 'PAST_END', closedAt: '' });
    const staff = (await req('meta.get', {}, M)).data.staffBatches.find((b) => b.batchId === 'ETP-22');
    expect([staff.status, staff.startedOn, staff.endsOn]).toEqual(['PAST_END', '2026-10-19', '2026-11-08']);
    expect((await req('batches.close', { batchId: 'ETP-22', decisions: [] }, M)).ok).toBe(true);
    expect((await req('batches.list', {}, M)).data.find((b) => b.batchId === 'ETP-22').status).toBe('ENDED');
    expect((await req('batches.update', { batchId: 'ETP-22', endsOn: '2026-12-31' }, M)).error.code).toBe('CONFLICT');
    expect((await req('meta.get', {}, M)).data.staffBatches.some((b) => b.batchId === 'ETP-22')).toBe(false);
  });


  // two routes (the head, 26 Oct 2026): a trainee's card is the TRAINING's, over its own dates, across phases
  it("a trainee's card is one card over the training's dates; a facilitator's stays on the phase", async () => {
    const M = await login('master', 'master-pass-1');
    await req('batches.update', { batchId: 'ETP-21', endsOn: '2027-02-28' }, M);
    expect((await req('enrol.add', { batchId: 'ETP-21', login: '6000000001' }, M)).ok).toBe(true);
    const S = await login('6000000001', 'pass-12345');
    let c = (await req('card.get', {}, S)).data;
    expect([c.phaseId, c.name, c.from, c.to, c.trainee, c.targets.until]).toEqual(['ETP-21', 'ETP · Batch 21', '2026-10-17', '2027-02-28', true, '2026-10-23']);
    setNow('2026-12-16T10:00:00+05:30');
    expect((await req('card.fill', { phaseId: 'ETP-21', weekId: '2026-12-14', values: [{ measureId: 'stall', value: '2' }] }, S)).ok).toBe(true);
    // Kartik is over and no phase is open: the training's card goes on regardless
    setNow('2027-01-13T10:00:00+05:30');
    const S2 = await login('6000000001', 'pass-12345'), M2 = await login('master', 'master-pass-1');
    expect((await req('card.fill', { phaseId: 'kartik-2026', weekId: '2027-01-11', values: [{ measureId: 'stall', value: '3' }] }, S2)).ok).toBe(true);
    c = (await req('card.get', { weekId: '2027-01-11' }, S2)).data;
    expect([c.phaseId, c.from, c.to, c.filledWeeks]).toEqual(['ETP-21', '2026-10-17', '2027-02-28', ['2026-12-14', '2027-01-11']]);
    expect((await req('board.get', { batchId: 'ETP-21', weekId: '2027-01-11' }, M2)).data.phaseId).toBe('ETP-21');
    // the head's own (phase) card: no phase open in January here
    expect((await req('card.get', {}, M2)).error?.code).toBe('NOT_FOUND');
  });
});
