// WhatsApp-ready text for a day or a submitted week (design decision 32). Built on the phone from the devotee's
// own data and the card from rules.get, with the same marks the server gives ($shared/scoring.js). Sends nothing.
import { dayMarks, dayPercent } from '$shared/scoring.js';
import { TEMPLE_ACTIVITIES, templeAnswer } from '$shared/temple.js';

import { fmtDate, fmt12 } from './dates.js';
export { fmtDate, fmt12 };
// a linear card's item (TRD) has no range, only its marks out of its maximum
const range = (o) => (!o ? '' : o.of !== undefined ? ` (${o.marks}/${o.of})` : ` (${o.label.replace(/ - /g, ' – ')} · ${o.marks})`);
const list = (a) => (a && a.length ? a.join(', ') : '-');

/** A day's marks and its score out of 100 (shared/scoring.js); the app shows only the score. */
export const dayTotal = (marks) => dayPercent(marks);

/**
 * ctx: { card, batchName, lectureTitle(id), bookTitle(id) }
 */
export function dayShareText(day, date, ctx) {
  const marks = ctx.card ? dayMarks(ctx.card, day) : {};
  const t = dayPercent(marks);
  const topics = (day.hearing || []).map((h) => (h.lectureId ? ctx.lectureTitle?.(h.lectureId) || h.lectureId : h.text));
  const book = day.reading ? (day.reading.bookId ? ctx.bookTitle?.(day.reading.bookId) || day.reading.bookId : day.reading.text) : '-';
  const min = (v) => (Number.isInteger(v) ? `${v} min` : '-');
  const L = [
    'Hare Krishna!',
    `Daily Sadhana: ${fmtDate(date)}`,
    `*Batch*: ${ctx.batchName || '-'}`,
    `*Day score*: ${t.percent}/100`,
    '',
    `*Prev Night Sleep Time*: ${fmt12(day.sleptAt)}${range(marks.to_bed)}`,
    `*Wake-Up Time*: ${fmt12(day.wokeAt)}${range(marks.wake_up)}`,
    '',
    `*Chanting Rounds*: ${Number.isInteger(day.rounds) ? day.rounds : '-'}${range(marks.rounds)}`,
    `*Chanting Finished At*: ${fmt12(day.chantingDoneAt)}${range(marks.japa)}`,
    `*Completed Same Day*: ${day.chantingSameDay === true ? 'Yes' : day.chantingSameDay === false ? 'No' : '-'}`,
    '',
    `*Exercise*: ${Number.isInteger(day.exerciseMin) ? day.exerciseMin + ' min' : '-'}`,
    `*Day Rest*: ${min(day.dayRestMin)}${range(marks.day_sleep)}`,
    `*Study/Job*: ${typeof day.studyJobHrs === 'number' ? day.studyJobHrs + ' hrs' : '-'}`,
    '',
    `*Hearing*: ${list(topics)}`,
    `*Hearing Duration*: ${min(day.hearingMin)}${range(marks.sravan)}`,
    '',
    `*Reading*: ${book}`,
    `*Reading Duration*: ${min(day.readingMin)}${range(marks.pathan)}`,
    '',
    `*Service*: ${day.serviceTopic || '-'}`,
    `*Service Duration*: ${min(day.serviceMin)}${range(marks.seva)}`,
    '',
    `*Positive Chetna*: ${list(day.chetnaPositive)}`,
    `*Negative Chetna*: ${list(day.chetnaNegative)}`,
    // a temple resident's temple activities (phase 21): only when the day has them, so every other share is unchanged
    ...(TEMPLE_ACTIVITIES.some((a) => day[a.key]) ? ['', `*${marks.morning ? 'Morning Program' : 'Temple Activities'}*${range(marks.morning)}`, ...TEMPLE_ACTIVITIES.filter((a) => day[a.key]).map((a) => `${a.label}: ${templeAnswer(day[a.key])}`)] : []),
  ];
  return L.join('\n');
}

export const SCORE_LABELS = [
  ['bed', 'To Bed'], ['wake_up', 'Wake-Up'], ['day_sleep', 'Day Sleep'], ['japa', 'Japa'], ['pathan', 'Pathan (Reading)'],
  ['sravan', 'Sravan (Hearing)'], ['seva', 'Seva'], ['attendance', 'Attendance'], ['body', 'Body'], ['soul', 'Soul'], ['overall', 'Overall'],
];

export function weekShareText(weekId, scores, weekEnd, ctx) {
  const yn = (v) => (v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : '-');
  const L = ['Hare Krishna!', `Weekly Sadhana: week of ${fmtDate(weekId)}`, `*Batch*: ${ctx.batchName || '-'}`, ''];
  for (const [k, label] of SCORE_LABELS) L.push(`*${label}*: ${scores[k]}%`);
  // TRD (Phase 22): the Morning program column; class attendance is shown but not scored
  if (scores.morning !== undefined && scores.morning !== null) L.splice(L.length - 4, 0, `*Morning Program*: ${scores.morning}%`);
  L.push('', `*Night Stay*: ${yn(weekEnd?.nightStay)}`, `*4 Regulative Principles*: ${yn(weekEnd?.principles)}`,
    `*Average Rounds*: ${weekEnd?.chantingAverage ?? '-'}`);
  return L.join('\n');
}

export const whatsappUrl = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);

/**
 * One Share button: the phone's share sheet (WhatsApp is in it). Where there is none (most desktops) the WhatsApp link
 * opens; if that is blocked, the text is copied. Returns 'shared' | 'whatsapp' | 'copied' | 'cancelled' | 'failed'.
 */
export async function shareText(text, env = globalThis) {
  const nav = env.navigator;
  if (nav && nav.share) {
    try { await nav.share({ text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  } else if (env.open) {
    const w = env.open(whatsappUrl(text), '_blank', 'noopener');
    if (w) return 'whatsapp';
  }
  try { await nav.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
