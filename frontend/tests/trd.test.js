// TRD scored the COSATOK way (Phase 22, K2): the mock is the server — the temple resident fixture (6000000092) gets the
// TRD card, Save answers with the same marks, Submit with the same scores (worker/tests/trd-scoring.test.mjs has the
// server side and the hand-worked numbers), and Admin › Analysis gets the Morning program.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';
import { figureOf, metricsFor } from '../src/lib/analysis.js';
import { dayBars, weekBars } from '../src/lib/report.js';
import { weekShareText } from '../src/lib/share.js';

beforeEach(() => { reset(); setLatency(0); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data?.token;
const WEEK = '2026-10-05';
// the server test's days A, B, P, D (each total worked by hand there: 128.42, 120, 205, 42.5 of 205)
const A = { sleptAt: '22:10', wokeAt: '04:25', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 85, hearingMin: 30, hearing: [{ text: 'Bhagavad-gita class' }],
  readingMin: 60, reading: { text: 'Bhagavad-gita As It Is' }, serviceMin: 90, mangalAarti: 'ON_TIME', darshanAarti: 'LATE', morningClass: 'ABSENT' };
const B = { sleptAt: '00:30', wokeAt: '03:30', rounds: 16, chantingDoneAt: '23:00', chantingSameDay: false, dayRestMin: 0, hearingMin: 90, hearing: [{ text: 'Kirtan lecture' }],
  readingMin: 0, serviceMin: 400, mangalAarti: 'ON_TIME', darshanAarti: 'ON_TIME', morningClass: 'ON_TIME', prasadam: 'ON_TIME' };
const P = { sleptAt: '21:45', wokeAt: '04:00', rounds: 20, chantingDoneAt: '07:15', chantingSameDay: true, dayRestMin: 60, hearingMin: 60, hearing: [{ text: 'Srimad-Bhagavatam class' }],
  readingMin: 60, reading: { text: 'Nectar of Devotion' }, serviceMin: 360, mangalAarti: 'ON_TIME', darshanAarti: 'ON_TIME', morningClass: 'ON_TIME', prasadam: 'ON_TIME' };
const D = { sleptAt: '22:30', wokeAt: '04:50', rounds: 8, chantingDoneAt: '17:00', chantingSameDay: true, dayRestMin: 110, hearingMin: 15, hearing: [{ text: 'Short talk' }],
  readingMin: 45, reading: { text: 'Bhagavad-gita As It Is' }, serviceMin: 180 };

describe('TRD in the mock (= the server)', () => {
  it('the temple resident gets the TRD card; Save and Submit score the COSATOK way', async () => {
    setNow('2026-10-11T19:00:00+05:30');
    const T = await login('6000000092', 'trd-pass-12');
    const rules = await req('rules.get', {}, T);
    expect([rules.data.cardName, rules.data.cards.TRD.dayMax, rules.data.temple]).toEqual(['TRD', 205, true]);
    const days = [A, B, P, D];
    for (let i = 0; i < 4; i++) {
      const r = await req('week.saveDay', { weekId: WEEK, date: `2026-10-0${5 + i}`, version: 0, day: days[i] }, T);
      expect(r.data.state).toBe('complete');
      if (i === 0) expect(r.data.marks.morning).toEqual({ label: '3 of 4 answered', marks: 8, of: 20 });
    }
    await req('week.saveWeekEnd', { weekId: WEEK, version: 0, nightStay: 'YES', principles: 'YES' }, T);
    await req('week.setAttendance', { weekId: WEEK, mark: 'A' }, T);
    const s = await req('week.submit', { weekId: WEEK }, T);
    // 495.92 / 1435 = 35 overall although absent; morning 48 / 140 = 34
    expect(s.data.scores).toMatchObject({ bed: 24, wake_up: 36, day_sleep: 36, japa: 29, pathan: 39, sravan: 39, seva: 39, morning: 34, attendance: 0, body: 32, soul: 36, overall: 35 });
    const h = await req('history.list', { before: '2026-10-19' }, T);
    expect(h.data.weeks[0].dayPct).toEqual([63, 59, 100, 21, 0, 0, 0]);
    // the screens' helpers read the TRD scores and marks with no card
    expect(weekBars(s.data.scores).map((b) => b.label)).toEqual(['Overall', 'Body', 'Soul', 'Morning program', 'Service', 'Class attendance']);
    const w = await req('week.get', { weekId: WEEK }, T);
    expect(dayBars(w.data.marks[0], 63).find((b) => b.label === 'Morning program').value).toBe(40);       // 8 of 20
    expect(weekShareText(WEEK, s.data.scores, {}, { batchName: 'Temple Residents' })).toContain('*Morning Program*: 34%');
  });

  it('an SPS devotee is unchanged: no Morning program, the SPS week bars', async () => {
    setNow('2026-10-11T19:00:00+05:30');
    const S = await login('6000000001', 'pass-12345');
    expect((await req('rules.get', {}, S)).data.cardName).toBe('SPS');
    const day = { sleptAt: '22:00', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 20, hearingMin: 30, hearing: [{ text: 'Topic one' }], readingMin: 30, reading: { text: 'A book' }, serviceMin: 90 };
    const r = await req('week.saveDay', { weekId: WEEK, date: '2026-10-05', version: 0, day }, S);
    expect(r.data.marks.morning).toBeUndefined();
    await req('week.saveWeekEnd', { weekId: WEEK, version: 0, nightStay: 'YES', principles: 'YES' }, S);
    await req('week.setAttendance', { weekId: WEEK, mark: 'P' }, S);
    const s = await req('week.submit', { weekId: WEEK }, S);
    expect('morning' in s.data.scores).toBe(false);
    expect(weekBars(s.data.scores).map((b) => b.label)).toEqual(['Overall', 'Body', 'Soul', 'Attendance', 'Service']);
  });
});

describe('Admin › Analysis: the Morning program', () => {
  const row = (batchId, o) => ({ batchId, weekId: WEEK, submitted: 0, missed: 0, overall: 0, body: 0, soul: 0, bed: 0, wake: 0, nRounds: 0, rounds: 0, reading: 0, hearing: 0, seva: 0, night: 0, principles: 0, present: 0, held: 0, nMorning: 0, morning: 0, ...o });
  it('is the summed scores over the weeks that have it, and its tile shows only where a batch has it', () => {
    const trd = row('TRD', { submitted: 2, nMorning: 2, morning: 48 }), sps = row('SPS', { submitted: 3 });
    expect(figureOf('morning', [trd, sps])).toBe(24);
    expect(figureOf('morning', [sps])).toBe(null);
    expect(metricsFor([trd]).some((m) => m.key === 'morning')).toBe(true);
    expect(metricsFor([sps]).some((m) => m.key === 'morning')).toBe(false);
  });
  it('the mock sends it from the submitted TRD weeks, as batch_weeks does', async () => {
    setNow('2026-10-11T19:00:00+05:30');
    const T = await login('6000000092', 'trd-pass-12');
    await req('week.saveDay', { weekId: WEEK, date: '2026-10-07', version: 0, day: P }, T);
    await req('week.saveWeekEnd', { weekId: WEEK, version: 0, nightStay: 'YES', principles: 'YES' }, T);
    await req('week.setAttendance', { weekId: WEEK, mark: 'P' }, T);
    expect((await req('week.submit', { weekId: WEEK }, T)).data.scores.morning).toBe(14);            // 20 / 140
    setNow('2026-10-13T10:00:00+05:30');
    const M = await login('master', 'master-pass-1');
    const a = await req('analysis.get', { from: '2026-09-28', to: '2026-10-12' }, M);
    const r = a.data.weeks.find((x) => x.batchId === 'TRD' && x.weekId === WEEK);
    expect([r?.nMorning, r?.morning]).toEqual([1, 14]);
  });
});
