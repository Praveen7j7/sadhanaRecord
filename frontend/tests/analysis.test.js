// Admin › Analysis (phase 21): the measures from weekly sums, the periods, and the increase/drop report.
import { describe, it, expect } from 'vitest';
import { figureOf, fmtFig, periodOf, seriesOf, movements, mondayOf } from '../src/lib/analysis.js';

const row = (batchId, weekId, o) => ({ batchId, weekId, submitted: 0, missed: 0, overall: 0, body: 0, soul: 0, bed: 0, wake: 0, nRounds: 0, rounds: 0, reading: 0, hearing: 0, seva: 0, night: 0, principles: 0, present: 0, held: 0, ...o });

describe('measures from sums', () => {
  it('is summed numerator over summed denominator, never an average of averages', () => {
    const rows = [row('SPS', '2026-10-05', { submitted: 1, nRounds: 1, rounds: 16, overall: 90 }), row('SPS', '2026-10-12', { submitted: 3, nRounds: 3, rounds: 24, overall: 210 })];
    expect(figureOf('rounds', rows)).toBe(10);          // (16 + 24) / 4, not (16 + 8) / 2
    expect(figureOf('overall', rows)).toBe(75);
    expect(fmtFig('rounds', 10)).toBe('10.0 rounds');
  });
  it('reads minutes as a day\'s, percentages of the weeks submitted, and attendance of those marked', () => {
    const rows = [row('SPS', '2026-10-05', { submitted: 2, missed: 2, reading: 420, night: 1, present: 3, held: 4 })];
    expect(figureOf('reading', rows)).toBe(30);
    expect(figureOf('night', rows)).toBe(50);
    expect(figureOf('attendance', rows)).toBe(75);
    expect(figureOf('filling', rows)).toBe(50);
  });
  it('has no figure when there is nothing to measure', () => {
    expect(figureOf('rounds', [row('SPS', '2026-10-05', { submitted: 2 })])).toBe(null);
    expect(figureOf('overall', [])).toBe(null);
    expect(fmtFig('overall', null)).toBe('—');
  });
});

describe('periods', () => {
  it('the last N closed weeks, and the same length before them', () => {
    expect(periodOf('4w', '2026-10-19')).toEqual({ from: '2026-09-28', to: '2026-10-19', weeks: 4, prevFrom: '2026-08-31', prevTo: '2026-09-21' });
    expect(periodOf('52w', '2026-10-19').from).toBe('2025-10-27');
  });
  it('a phase so far, from the week its first day is in', () => {
    expect(periodOf('phase', '2026-10-19', { phase: { startsOn: '2026-09-01', endsOn: '2026-12-31' } })).toMatchObject({ from: '2026-08-31', to: '2026-10-19', weeks: 8 });
  });
  it('a custom span, counted by Mondays and never past the last closed week', () => {
    expect(periodOf('custom', '2026-10-19', { from: '2026-09-10', to: '2026-12-01' })).toMatchObject({ from: '2026-09-07', to: '2026-10-19' });
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
  });
});

describe('series and the report', () => {
  const rows = [
    row('SPS', '2026-09-21', { submitted: 10, nRounds: 10, rounds: 120, reading: 1400 }), row('SPS', '2026-09-28', { submitted: 10, nRounds: 10, rounds: 150, reading: 700 }),
    row('DPS', '2026-09-21', { submitted: 5, nRounds: 5, rounds: 80 }), row('DPS', '2026-09-28', { submitted: 5, nRounds: 5, rounds: 81 }),
  ];
  it('one line for all of IYF, then one per batch, with a gap for a week without figures', () => {
    const s = seriesOf('rounds', rows, ['2026-09-21', '2026-09-28', '2026-10-05'], ['SPS', 'DPS']);
    expect(s.map((x) => x.key)).toEqual(['all', 'SPS', 'DPS']);
    expect(s[1].values).toEqual([12, 15, null]);
    expect(s[0].values[0]).toBeCloseTo(200 / 15);
  });
  it('says what rose and what fell, biggest first, ignoring noise', () => {
    const period = { from: '2026-09-28', to: '2026-09-28', prevFrom: '2026-09-21', prevTo: '2026-09-21' };
    const m = movements(rows, [{ batchId: 'SPS', name: 'SPS' }, { batchId: 'DPS', name: 'DPS' }], period, ['rounds', 'reading']);
    expect(m.map((x) => x.text)).toEqual(['SPS: reading fell from 20 min to 10 min', 'SPS: chanting rose from 12.0 rounds to 15.0 rounds']);
    expect(m.some((x) => x.batchId === 'DPS')).toBe(false);   // 16 → 16.2 rounds is noise
  });
});
