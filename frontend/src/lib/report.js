// Helpers for the Report screen (month calendar, bands, bars). Pure, no I/O.
import { pct100 } from '$shared/scoring.js';
import { TEMPLE_ACTIVITIES, templeAnswer } from '$shared/temple.js';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export function mondayOf(date) {
  const ms = utc(date);
  return iso(ms - ((new Date(ms).getUTCDay() + 6) % 7) * 864e5);
}
/** Rows of 7 cells (Monday first); null for days outside the month. month is 0-11. */
export function monthGrid(year, month) {
  const first = Date.UTC(year, month, 1), count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => iso(first + i * 864e5))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
}
/** Mondays of the weeks that touch the month. */
export function weeksOfMonth(year, month) {
  const g = monthGrid(year, month), out = [];
  for (const row of g) { const d = row.find(Boolean); if (d) out.push(mondayOf(d)); }
  return out;
}
export const band = (p) => (p === null || p === undefined ? '' : p >= 80 ? 'p-hi' : p >= 50 ? 'p-mid' : 'p-lo');

// plain words on the bars (the sheet's japa / pathan / sravan = chanting / reading / hearing)
const CATS = [['to_bed', 'Sleep'], ['wake_up', 'Wake-up'], ['day_sleep', 'Day rest'], ['japa', 'Chanting'], ['pathan', 'Reading'], ['sravan', 'Hearing']];
/** The category group of a score key, for its fixed colour (8 Oct 2026: the same colour for a category on every screen). */
export const CAT_OF = { overall: 'overall', total: 'overall', body: 'body', bed: 'body', to_bed: 'body', wake_up: 'body', day_sleep: 'body',
  soul: 'soul', japa: 'soul', pathan: 'soul', sravan: 'soul', seva: 'seva', attendance: 'att' };
// the TRD card's extra items (Phase 22, COSATOK's TRD scheme): their marks carry their own maximum (`of`)
const LINEAR_EXTRA = [['rounds', 'Rounds', 'soul'], ['seva', 'Service', 'seva'], ['morning', 'Morning program', 'att']];
/** One day's marks → Activity Score bars: Total then each category, every value 0-100. */
export function dayBars(marks, total) {
  const v = (k) => (marks[k] ? pct100((marks[k].marks / (marks[k].of || 25)) * 100) : 0);
  return [{ label: 'Total', value: total, cat: 'overall' }, ...CATS.map(([k, label]) => ({ label, value: v(k), cat: CAT_OF[k] })),
    ...LINEAR_EXTRA.filter(([k]) => marks[k]?.of !== undefined).map(([k, label, cat]) => ({ label, value: v(k), cat }))];
}
/** A submitted week's scores → bars (all 0-100). */
export function weekBars(scores) {
  // The week's scores in the shape the score card actually has (the user, 11 Oct 2026): Body and Soul are not
  // two more parts alongside Sleep and Chanting — they are the AVERAGE of the three under each. Shown flat, a
  // facilitator cannot tell the group from its parts. So each group carries its parts, and the screen indents them.
  //   Body    = avg(Sleep, Wake-up, Day rest)
  //   Soul    = avg(Chanting, Reading, Hearing)
  //   Overall = avg(Body, Soul, Attendance, Service)
  const v = (k) => pct100(scores[k] ?? 0);
  const part = (k, label) => ({ label, value: v(k), cat: CAT_OF[k], part: true });
  // TRD (Phase 22): Overall is every day's marks out of the week's maximum; attendance is recorded, not scored
  if (scores.morning !== undefined && scores.morning !== null) return [
    { label: 'Overall', value: v('overall'), cat: 'overall', of: "every day's marks" },
    { label: 'Body', value: v('body'), cat: 'body', group: true, of: 'the three below',
      parts: [part('bed', 'Sleep'), part('wake_up', 'Wake-up'), part('day_sleep', 'Day rest')] },
    { label: 'Soul', value: v('soul'), cat: 'soul', group: true, of: 'the three below',
      parts: [part('japa', 'Chanting'), part('pathan', 'Reading'), part('sravan', 'Hearing')] },
    { label: 'Morning program', value: v('morning'), cat: 'att' },
    { label: 'Service', value: v('seva'), cat: 'seva' },
    { label: 'Class attendance', value: v('attendance'), cat: 'att', of: 'not scored' },
  ];
  return [
    { label: 'Overall', value: v('overall'), cat: 'overall', of: 'Body, Soul, Attendance and Service' },
    { label: 'Body', value: v('body'), cat: 'body', group: true, of: 'the three below',
      parts: [part('bed', 'Sleep'), part('wake_up', 'Wake-up'), part('day_sleep', 'Day rest')] },
    { label: 'Soul', value: v('soul'), cat: 'soul', group: true, of: 'the three below',
      parts: [part('japa', 'Chanting'), part('pathan', 'Reading'), part('sravan', 'Hearing')] },
    { label: 'Attendance', value: v('attendance'), cat: 'att' },
    { label: 'Service', value: v('seva'), cat: 'seva' },
  ];
}

/** A submitted day in one short line (the head, 7 Oct 2026: a facilitator sees each day at a glance, without opening it):
 *  slept · woke · rounds (and by when) · day rest · hearing · reading · service. Only what was filled. */
export function daySummary(d, fmt12) {
  if (!d || !Object.keys(d).length) return '';
  const min = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ' ' + (n % 60) + ' min' : ''}` : `${n} min`);
  return [
    d.sleptAt && `Slept ${fmt12(d.sleptAt)}`,
    d.wokeAt && `Woke ${fmt12(d.wokeAt)}`,
    d.rounds != null && `${d.rounds} rounds${d.chantingDoneAt ? ' by ' + fmt12(d.chantingDoneAt) : ''}`,
    d.dayRestMin > 0 && `Rest ${min(d.dayRestMin)}`,
    d.hearingMin > 0 && `Hearing ${min(d.hearingMin)}`,
    d.readingMin > 0 && `Reading ${min(d.readingMin)}`,
    d.serviceMin > 0 && `Service ${min(d.serviceMin)}`,
    // a temple resident's temple activities (phase 21), only those answered
    TEMPLE_ACTIVITIES.some((a) => d[a.key]) && 'Temple: ' + TEMPLE_ACTIVITIES.filter((a) => d[a.key]).map((a) => `${a.label} ${templeAnswer(d[a.key]).toLowerCase()}`).join(', ')
  ].filter(Boolean).join(' · ');
}
