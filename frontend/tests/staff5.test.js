// Phase 5 (9 Oct 2026): the plain reason line, "needs you" and the work order on staff lists
import { describe, it, expect } from 'vitest';
import { rowReason, missingDays, needsYou, workOrder, band } from '../src/lib/staff.js';

const W = '2026-10-05', TODAY = '2026-10-09';            // a Friday: Mon–Thu are past
const row = (status, days, extra = {}) => ({ name: extra.name || 'A', status, daysFilled: days.filter((d) => d === 'complete' || d === 'partial').length, days, overall: null, ...extra });
const E = 'empty', C = 'complete', P = 'partial';

describe('rowReason', () => {
  it('names the missing past days', () => {
    expect(missingDays(row('DRAFT', [C, E, E, P, E, E, E]), W, TODAY)).toEqual(['Tue', 'Wed']);
    expect(rowReason(row('DRAFT', [C, E, E, P, E, E, E]), W, TODAY)).toBe('2 of 7 · Missing Tue, Wed');
  });
  it('nothing filled, submitted, missed', () => {
    expect(rowReason(row('NOT_STARTED', Array(7).fill(E)), W, TODAY)).toBe('Nothing filled since Mon');
    expect(rowReason(row('NOT_STARTED', Array(7).fill(E)), W, '2026-10-05')).toBe('Nothing filled yet');
    expect(rowReason(row('SUBMITTED', Array(7).fill(C), { overall: 82 }), W, TODAY)).toBe('Submitted · 82%');
    expect(rowReason({ status: 'MISSED', daysFilled: 2 }, W, TODAY)).toBe('Missed · 0 (2 of 7 begun)');
    expect(rowReason(row('DRAFT', [C, C, C, C, E, E, E]), W, TODAY)).toBe('4 of 7 filled');
  });
});
describe('needsYou and the order', () => {
  it('not started, missed, or two missing days', () => {
    expect(needsYou(row('NOT_STARTED', Array(7).fill(E)), W, TODAY)).toBe(true);
    expect(needsYou(row('DRAFT', [C, E, C, C, E, E, E]), W, TODAY)).toBe(false);
    expect(needsYou(row('DRAFT', [C, E, E, C, E, E, E]), W, TODAY)).toBe(true);
    expect(needsYou(row('SUBMITTED', Array(7).fill(C)), W, TODAY)).toBe(false);
  });
  it('work order and bands', () => {
    const rs = [row('SUBMITTED', [], { name: 'Zed' }), row('DRAFT', [], { name: 'Bo' }), row('NOT_STARTED', [], { name: 'Cy' }), row('MISSED', [], { name: 'Al' })];
    expect(workOrder(rs).map((r) => r.name)).toEqual(['Cy', 'Bo', 'Al', 'Zed']);
    expect([band(85), band(50), band(49), band(null)]).toEqual(['hi', 'mid', 'lo', '']);
  });
});
