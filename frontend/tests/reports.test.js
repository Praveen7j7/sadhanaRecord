// Admin › Reports (Phase 23 P14): the period picker's maths and the plain-sentence builder, both pure (lib/reportbuild.js).
import { describe, it, expect } from 'vitest';
import { periodFor, weeksIn, coverText, summaryNumbers, findings, MAX_DAYS } from '../src/lib/reportbuild.js';

describe('the period picker', () => {
  const today = '2026-10-27';                                      // a Tuesday
  it('this week and last week are whole Monday–Sunday weeks', () => {
    expect(periodFor('thisWeek', today)).toMatchObject({ from: '2026-10-26', to: '2026-11-01', days: 7 });
    expect(periodFor('lastWeek', today)).toMatchObject({ from: '2026-10-19', to: '2026-10-25', days: 7 });
    expect(periodFor('lastWeek', '2026-10-26')).toMatchObject({ from: '2026-10-19', to: '2026-10-25' });   // on a Monday
  });
  it('this month is the calendar month', () => {
    expect(periodFor('thisMonth', today)).toMatchObject({ from: '2026-10-01', to: '2026-10-31', days: 31 });
    expect(periodFor('thisMonth', '2028-02-10')).toMatchObject({ from: '2028-02-01', to: '2028-02-29', days: 29 });
  });
  it('a phase and a training take their own dates; a running training ends today', () => {
    expect(periodFor('phase', today, { phase: { startsOn: '2026-09-01', endsOn: '2026-12-31' } })).toMatchObject({ from: '2026-09-01', to: '2026-12-31', days: 122 });
    expect(periodFor('training', today, { training: { startedOn: '2026-09-28', endsOn: '', closedAt: '' } })).toMatchObject({ from: '2026-09-28', to: today });
    expect(periodFor('training', today, { training: { startedOn: '2026-09-28', endsOn: '2026-12-20', closedAt: '' } })).toMatchObject({ to: '2026-12-20' });
    expect(periodFor('training', today, { training: { startedOn: '2026-09-28', endsOn: '2026-12-20', closedAt: '2026-11-03T10:00:00+05:30' } })).toMatchObject({ to: '2026-11-03' });
    expect(periodFor('phase', today, {}).error).toBeTruthy();
  });
  it('custom: from–to, a year at most, the end after the start', () => {
    expect(periodFor('custom', today, { from: '2026-10-01', to: '2026-10-14' })).toMatchObject({ from: '2026-10-01', to: '2026-10-14', days: 14, error: '' });
    expect(periodFor('custom', today, { from: '2025-10-01', to: '2026-09-30' }).error).toBe('');
    expect(MAX_DAYS).toBe(366);
    expect(periodFor('custom', today, { from: '2025-09-30', to: '2026-10-01' }).error).toMatch(/year/);
    expect(periodFor('custom', today, { from: '2026-10-14', to: '2026-10-01' }).error).toMatch(/after/);
    expect(periodFor('custom', today, { from: '', to: '' }).error).toMatch(/Choose/);
  });
  it('a period counts the weeks whose Monday falls in it, and says which', () => {
    expect(weeksIn('2026-10-01', '2026-10-31')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    expect(weeksIn('2026-10-05', '2026-10-11')).toEqual(['2026-10-05']);
    expect(weeksIn('2026-10-06', '2026-10-11')).toEqual([]);
    expect(coverText('2026-10-01', '2026-10-31', '2026-10-19')).toBe('3 closed weeks: 5 Oct – 25 Oct (1 still open)');
    expect(coverText('2026-10-26', '2026-11-01', '2026-10-19')).toMatch(/still open/);
    expect(coverText('2026-10-06', '2026-10-09', '2026-10-19')).toMatch(/no whole week/);
  });
});

// a small report, as report.get answers
const row = (batchId, weekId, o) => ({ batchId, weekId, submitted: 0, missed: 0, overall: 0, body: 0, soul: 0, bed: 0, wake: 0, nRounds: 0, rounds: 0,
  reading: 0, hearing: 0, seva: 0, night: 0, principles: 0, present: 0, held: 0, nMorning: 0, morning: 0, ...o });
const rep = (over = {}) => ({
  from: '2026-10-05', to: '2026-11-01', days: 28, weeks: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'],
  compare: { from: '2026-09-07', to: '2026-10-04', weeks: ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'] },
  batches: [{ batchId: 'SPS', name: 'SPS', level: 'SPS' }, { batchId: 'DPS', name: 'DPS', level: 'DPS' }],
  sadhana: [
    // now: SPS 10 filled of 20 due; wake-up weak (40), bed fine (70); rounds 9 a day; DPS 8 of 8
    row('SPS', '2026-10-12', { submitted: 10, missed: 10, overall: 700, bed: 700, wake: 400, nRounds: 10, rounds: 90, night: 6, principles: 8, present: 12, held: 20 }),
    row('DPS', '2026-10-12', { submitted: 8, missed: 0, overall: 680, bed: 640, wake: 560, nRounds: 8, rounds: 128, night: 8, principles: 8, present: 8, held: 8 }),
    // before: SPS 6 of 20 filled, wake-up 30; rounds 8
    row('SPS', '2026-09-14', { submitted: 6, missed: 14, overall: 390, bed: 420, wake: 180, nRounds: 6, rounds: 48, night: 3, principles: 4, present: 8, held: 20 }),
    row('DPS', '2026-09-14', { submitted: 8, missed: 0, overall: 680, bed: 640, wake: 560, nRounds: 8, rounds: 128, night: 8, principles: 8, present: 8, held: 8 }),
  ],
  people: { cur: { total: { people: 28, never: 6, filled: 18, due: 28, score: 1380 }, byBatch: { SPS: { people: 20, never: 6, filled: 10, due: 20, score: 700 } }, byFac: {} },
            cmp: { total: { people: 28, never: 9, filled: 14, due: 28, score: 1070 }, byBatch: {}, byFac: {} } },
  students: { total: 30, byBatch: { SPS: 21, DPS: 9 }, byFac: {} },
  health: { people: 30, noFacilitator: 2, missingProfile: 0, orphans: 0, duplicates: null, waiting: 3 },
  work: { cur: { approved: 4 }, cmp: { approved: 1 }, waiting: { signups: 3, oldest: '2026-10-20T10:00:00+05:30' }, byWho: [] },
  ...over,
});

describe('the summary numbers', () => {
  it('reporting is weeks filled ÷ weeks due, on its own; quality is over filled weeks only', () => {
    const n = Object.fromEntries(summaryNumbers(rep()).map((x) => [x.key, x]));
    expect(n.filling.value).toBe(18 / 28 * 100);
    expect(n.filling.base).toBe('18 of 28 weeks');
    expect(n.filling.prev).toBe(50);
    expect(n.overall.value).toBe(1380 / 18);                         // 76.7 on filled weeks, never 1380 / 28
    expect(n.overall.base).toBe('18 filled weeks');
    expect(n.attendance.value).toBe(20 / 28 * 100);
    expect(n.rounds.value).toBeCloseTo(218 / 18);
    expect(n.people.value).toBe(30);
  });
  it('a figure on fewer than 5 weeks is shown but not called a trend', () => {
    const r = rep({ people: { cur: { total: { people: 3, never: 0, filled: 3, due: 3, score: 240 }, byBatch: {}, byFac: {} }, cmp: { total: { people: 3, never: 1, filled: 2, due: 3, score: 100 }, byBatch: {}, byFac: {} } } });
    const n = Object.fromEntries(summaryNumbers(r).map((x) => [x.key, x]));
    expect(n.overall.thin).toBe(true);
  });
});

describe('the sentences', () => {
  it('good news first, with numbers and their base', () => {
    const f = findings(rep());
    expect(f.good[0]).toMatch(/weeks filled rose from 50% to 64% \(18 of 28 weeks\)/i);
    expect(f.good.some((s) => /SPS: class attendance rose from 40% to 60%/.test(s))).toBe(true);
  });
  it('names what worries, and the weakest practice where it is weakest', () => {
    const f = findings(rep());
    expect(f.worry.some((s) => /6 of 28 people filled no week/.test(s))).toBe(true);
    expect(f.worry.some((s) => /Waking up on time is the weakest practice \(53% on 18 filled weeks\)/.test(s))).toBe(true);
  });
  it('the three most useful actions, never more', () => {
    const f = findings(rep());
    expect(f.actions.length).toBe(3);
    expect(f.actions[0]).toMatch(/6 people.*SPS/);
    expect(f.actions.some((s) => /waking up on time/i.test(s) && /SPS/.test(s))).toBe(true);
  });
  it('a period with no closed week says so, and claims nothing', () => {
    const f = findings(rep({ weeks: [], sadhana: [], people: { cur: { total: { people: 0, never: 0, filled: 0, due: 0, score: 0 }, byBatch: {}, byFac: {} }, cmp: null } }));
    expect(f.good).toEqual([]);
    expect(f.worry.join(' ')).not.toMatch(/weakest/);
  });
});

// the mock answers as report.js does (lib/mockreport.js): the same shape, the same gate and the same forced scope
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';
describe('the mock report', () => {
  const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
  const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
  it('the head gets every scope; a coordinator only after the head gives Reports, and only their own batches', async () => {
    reset(); setLatency(0); setNow('2026-10-27T10:00:00+05:30');
    const M = await login('master', 'master-pass-1'), S = await login('sps', 'sps-pass-12');
    const o = await req('report.options', {}, M);
    expect(o.data.scopes.map((s) => s.kind)).toEqual(['all', 'batch', 'facilitator', 'training']);
    const r = await req('report.get', { from: '2026-09-28', to: '2026-10-25', compare: true, scope: { kind: 'all' } }, M);
    expect(r.ok).toBe(true);
    expect(r.data.weeks.length).toBeGreaterThan(0);
    expect(r.data.sadhana.length).toBeGreaterThan(0);
    expect(Object.keys(r.data)).toEqual(['from', 'to', 'days', 'lastClosed', 'weeks', 'compare', 'scope', 'sections', 'batches', 'sadhana', 'people', 'students',
      'facilitators', 'board', 'leaderboard', 'trainings', 'work', 'growth', 'health']);
    expect((await req('report.get', { from: '2025-09-30', to: '2026-10-01' }, M)).error.code).toBe('VALIDATION');
    expect((await req('report.get', { from: '2026-09-28', to: '2026-10-25' }, S)).error.code).toBe('FORBIDDEN');
    expect((await req('access.set', { login: 'sps', capability: 'reports', effect: 'allow', reason: 'test' }, M)).ok).toBe(true);
    const S2 = await login('sps', 'sps-pass-12');
    const own = await req('report.get', { from: '2026-09-28', to: '2026-10-25', scope: { kind: 'all' } }, S2);
    expect(own.data.scope.kind).toBe('batches');
    expect(own.data.sadhana.every((w) => ['SPS', 'SPS2', 'SPSO'].includes(w.batchId))).toBe(true);
    expect((await req('report.get', { from: '2026-09-28', to: '2026-10-25', scope: { kind: 'batch', id: 'DPS' } }, S2)).error.code).toBe('FORBIDDEN');
  });
});
