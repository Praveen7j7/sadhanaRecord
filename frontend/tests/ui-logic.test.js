import { describe, it, expect, vi } from 'vitest';
import { to12, to24, quickPicks, hourAt, minuteAt } from '../src/lib/time12.js';
import { fmt12 } from '../src/lib/dates.js';
import { dayPercent, pct100 } from '$shared/scoring.js';
import { dayShareText, shareText, whatsappUrl } from '../src/lib/share.js';
import { monthGrid, weeksOfMonth, mondayOf, band, dayBars, weekBars } from '../src/lib/report.js';
import { quoteFor, QUOTES } from '../src/lib/quotes.js';

describe('12-hour clock', () => {
  it('converts 12-hour to the 24-hour value that is sent', () => {
    expect(to24(12, 0, false)).toBe('00:00');      // 12:00 AM
    expect(to24(12, 30, true)).toBe('12:30');      // 12:30 PM
    expect(to24(11, 59, true)).toBe('23:59');      // 11:59 PM
    expect(to24(10, 15, true)).toBe('22:15');
    expect(to24(4, 5, false)).toBe('04:05');
  });
  it('reads 24-hour back to 12-hour, and shows AM/PM text', () => {
    expect(to12('00:00')).toEqual({ h: 12, m: 0, pm: false });
    expect(to12('12:30')).toEqual({ h: 12, m: 30, pm: true });
    expect(to12('23:59')).toEqual({ h: 11, m: 59, pm: true });
    expect(to12('')).toBeNull();
    expect(fmt12('22:15')).toBe('10:15 PM');
    expect(fmt12('04:45')).toBe('4:45 AM');
    for (const t of ['00:00', '01:07', '12:00', '12:59', '13:00', '23:59']) { const x = to12(t); expect(to24(x.h, x.m, x.pm)).toBe(t); }   // OK sends HH:MM
  });
  it('quick picks are the start times of the card ranges, with their marks', () => {
    const card = [{ label: 'Before 07:15 AM', marks: 25, from: null, to: '07:15' }, { label: '07:15 - 09:30 AM', marks: 20, from: '07:15', to: '09:30' }];
    expect(quickPicks(card)).toEqual([{ time: '07:15', marks: 20 }]);
  });
  it('dial angles map to hours and 5-minute steps', () => {
    expect(hourAt(0)).toBe(12); expect(hourAt(90)).toBe(3); expect(hourAt(180)).toBe(6); expect(hourAt(359)).toBe(12);
    expect(minuteAt(0)).toBe(0); expect(minuteAt(90)).toBe(15); expect(minuteAt(180)).toBe(30); expect(minuteAt(358)).toBe(0);
  });
});

describe('percentages are 0-100', () => {
  const m = (v) => ({ to_bed: { label: 'x', marks: v }, wake_up: { label: 'x', marks: v }, day_sleep: { label: 'x', marks: v }, japa: { label: 'x', marks: v }, pathan: { label: 'x', marks: v }, sravan: { label: 'x', marks: v } });
  it('a day below zero shows 0%, above never over 100%; option marks keep their own value', () => {
    expect(dayPercent(m(-5))).toMatchObject({ total: -30, outOf: 150, percent: 0, complete: true });
    expect(dayPercent(m(25))).toMatchObject({ total: 150, percent: 100 });
    expect(dayPercent({ to_bed: { label: 'a', marks: 20 } })).toMatchObject({ total: 20, percent: 13, complete: false });
    expect(pct100(130)).toBe(100); expect(pct100(-4)).toBe(0);
  });
  it('the share text uses the same maths', () => {
    const card = { to_bed: [{ label: '11:15 - 11:30 PM', marks: -5, from: null, to: null }], wake_up: [{ label: 'a', marks: -5, from: null, to: null }], day_sleep: [{ label: 'a', marks: -5, min: 0, max: null }],
      japa: [{ label: 'a', marks: -5, from: null, to: null }], pathan: [{ label: 'a', marks: -5, min: 0, max: null }], sravan: [{ label: 'a', marks: -5, min: 0, max: null }] };
    const t = dayShareText({ sleptAt: '23:20', wokeAt: '06:00', dayRestMin: 200, chantingSameDay: true, chantingDoneAt: '23:30', readingMin: 0, hearingMin: 0 }, '2026-10-07', { card, batchName: 'SPS' });
    expect(t).toContain('*Day score*: 0/100');
    expect(t).toContain('(11:15 – 11:30 PM · -5)');       // the card's own value still shows
  });
  it('report bars are always 0-100', () => {
    const bars = dayBars(m(-5), 0);
    expect(bars.map((b) => b.value)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(weekBars({ bed: 120, wake_up: -3, overall: 88 }).every((b) => b.value >= 0 && b.value <= 100)).toBe(true);
  });
});

describe('share: one button', () => {
  it('uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(); const open = vi.fn();
    expect(await shareText('hi', { navigator: { share }, open })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hi' }); expect(open).not.toHaveBeenCalled();
  });
  it('without a share sheet opens WhatsApp; if blocked, copies', async () => {
    const open = vi.fn().mockReturnValue({}); const writeText = vi.fn().mockResolvedValue();
    expect(await shareText('hi there', { navigator: { clipboard: { writeText } }, open })).toBe('whatsapp');
    expect(open.mock.calls[0][0]).toBe(whatsappUrl('hi there'));
    const blocked = vi.fn().mockReturnValue(null);
    expect(await shareText('hi', { navigator: { clipboard: { writeText } }, open: blocked })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hi');
  });
  it('cancelling the share sheet is not an error', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    expect(await shareText('hi', { navigator: { share } })).toBe('cancelled');
  });
});

describe('report calendar and quotes', () => {
  it('builds a Monday-first month grid', () => {
    const g = monthGrid(2026, 9);                         // October 2026 starts on a Thursday
    expect(g[0].slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(weeksOfMonth(2026, 9)[0]).toBe('2026-09-28');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
  });
  it('bands', () => { expect([band(95), band(60), band(10), band(null)]).toEqual(['p-hi', 'p-mid', 'p-lo', '']); });
  it('one quote per day, changing daily', () => {
    expect(quoteFor('2026-10-02')).toEqual(quoteFor('2026-10-02'));
    expect(quoteFor('2026-10-02')).not.toEqual(quoteFor('2026-10-03'));
    expect(QUOTES.every(([t, s]) => t && s)).toBe(true);
  });
});
