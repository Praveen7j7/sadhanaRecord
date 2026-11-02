// Phase 22 F1 / F3 (26 Oct 2026): "All batches" on Batch status and the Filling chart (each batch's own answer, added
// up on the phone), and the name of the week staff screens show (the focus week is LAST week until Monday's deadline).
import { describe, it, expect } from 'vitest';
import { mergeBoards, mergeStats, isTrainingId } from '../src/lib/batchall.js';
import { weekTitle, weekName } from '../src/lib/staff.js';

// Monday 26 Oct 2026, 11:00 IST: before the 9 PM deadline the screens show the week of 19 Oct
const MON = new Date('2026-10-26T11:00:00+05:30');

describe('weekTitle: the column says which week it counts', () => {
  it('last week, this week, next week, else the dates', () => {
    expect(weekTitle('2026-10-19', MON)).toBe('Last week');
    expect(weekTitle('2026-10-26', MON)).toBe('This week');
    expect(weekTitle('2026-11-02', MON)).toBe('Next week');
    expect(weekTitle('2026-09-28', MON)).toBe('Week of 28 Sep – 4 Oct');
    expect(weekName('2026-09-28', MON)).toBe('week of 28 Sep – 4 Oct');
    expect(weekName('2026-10-19', MON)).toBe('last week');
  });
  it('by the Indian calendar: Sunday 11:30 PM IST is still that week', () => {
    expect(weekTitle('2026-10-19', new Date('2026-10-25T23:30:00+05:30'))).toBe('This week');
    expect(weekTitle('2026-10-19', new Date('2026-10-25T18:30:00Z'))).toBe('Last week');   // = Monday 00:00 IST
  });
});

const row = (login, name, batchId, status = 'NOT_STARTED') => ({ login, name, batchId, status, daysFilled: 0, days: [], attendance: {} });
const board = (rows, extra = {}) => ({ weekId: '2026-10-19', closesAt: '2026-10-26T21:00:00+05:30', attendanceOpensAt: '2026-10-25T00:00:00+05:30', attendanceOpen: true, classWeek: null, rows, ...extra });

describe('mergeBoards: one list out of each batch board', () => {
  it('rows by name, each keeping its batch; each batch answer kept for its class week and class day', () => {
    const cw = { kind: 'HOLIDAY', note: 'Diwali', everyonePresent: true };
    const m = mergeBoards([['SPS', board([row('a', 'Zed', 'SPS'), row('b', 'Amit', 'SPS', 'SUBMITTED')])],
                           ['DPS', board([row('c', 'Mira', 'DPS')], { classWeek: cw, attendanceOpensAt: '2026-10-22T00:00:00+05:30', attendanceOpen: false })]]);
    expect(m.rows.map((r) => [r.name, r.batchId])).toEqual([['Amit', 'SPS'], ['Mira', 'DPS'], ['Zed', 'SPS']]);
    expect(m.weekId).toBe('2026-10-19');
    expect(m.classWeek).toBe(null);
    expect(m.boards.DPS.classWeek).toEqual(cw);
    expect(m.boards.SPS.classWeek).toBe(null);
    expect(m.attendanceOpensAt).toBe('2026-10-22T00:00:00+05:30');
    expect(m.attendanceOpen).toBe(true);
  });
  it('a person in two of the batches that week is listed once', () => {
    const m = mergeBoards([['SPS', board([row('a', 'Amit', 'SPS')])], ['DPS', board([row('a', 'Amit', 'DPS')])]]);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].batchId).toBe('SPS');
  });
  it('nothing until a batch has answered', () => {
    expect(mergeBoards([['SPS', undefined]])).toBe(null);
  });
});

const stats = (expected, submitted, trend, missedLog = [], extra = {}) => ({
  weekId: '2026-10-19',
  thisWeek: { expected, submitted, draft: 1, notStarted: expected - submitted - 1, missed: 0, byDay: [submitted + 1, submitted, submitted, 0, 0, 0, 0] },
  trend, people: { active: expected, inactive: 1, disabled: 0, pending: 2 }, missedLog, ...extra
});
const wk = (weekId, expected, submitted) => ({ weekId, expected, submitted, missed: 0, filledPct: expected ? Math.round((submitted / expected) * 100) : 0 });

describe('mergeStats: one filling chart out of each batch chart', () => {
  it('adds the counts and works each week\'s share out again from the sums', () => {
    const m = mergeStats([
      ['SPS', stats(4, 1, [wk('2026-10-12', 4, 4), wk('2026-10-19', 4, 1)], [{ login: 'x', name: 'Xa', weekId: '2026-10-12', daysFilled: 2 }])],
      ['SPS2', stats(1, 1, [wk('2026-10-12', 1, 0), wk('2026-10-19', 1, 1)], [{ login: 'y', name: 'Yo', weekId: '2026-10-19', daysFilled: 0 }])]
    ]);
    expect(m.thisWeek).toMatchObject({ expected: 5, submitted: 2, draft: 2, notStarted: 1, missed: 0 });
    expect(m.thisWeek.byDay).toEqual([4, 2, 2, 0, 0, 0, 0]);
    // 12 Oct: 4 of 5 = 80 %, not the average of 100 % and 0 %
    expect(m.trend.map((w) => [w.weekId, w.expected, w.submitted, w.filledPct])).toEqual([['2026-10-12', 5, 4, 80], ['2026-10-19', 5, 2, 40]]);
    expect(m.people).toEqual({ active: 5, inactive: 2, disabled: 0, pending: 4 });
    expect(m.missedLog.map((x) => [x.name, x.batchId])).toEqual([['Yo', 'SPS2'], ['Xa', 'SPS']]);
  });
});

describe('training batches stay out of a combined class view', () => {
  it('ETP, MTP, FTP intakes', () => {
    expect(['ETP-21', 'MTP-3', 'FTP-1', 'SPS', 'VL3-32', 'SPSO'].filter(isTrainingId)).toEqual(['ETP-21', 'MTP-3', 'FTP-1']);
  });
});
