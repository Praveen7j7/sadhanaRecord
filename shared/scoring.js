// Scoring: typed answers → card options → marks → percentages (design §7a, §7a-1).
// Shared by the server (worker/src/scoring.js) and the app (live marks while typing): pure functions, no I/O,
// working on a card object as rules.get sends it, so both always score the same way.
export const CATEGORIES = ['to_bed', 'wake_up', 'day_sleep', 'japa', 'pathan', 'sravan'];

/** "HH:MM" (24-hour) → minutes after midnight, or NaN. */
export function clockMinutes(t) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(t || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** Rounds half away from zero, like Excel's ROUND (JavaScript's Math.round rounds −2.5 to −2). */
export const roundHalfAway = x => Math.sign(x) * Math.round(Math.abs(x));
/** Every score is a percentage from 0 to 100, never more and never less (the head, 2 Oct 2026). */
export const pct100 = x => Math.max(0, Math.min(100, roundHalfAway(x)));

/**
 * The option a clock time falls in. `wrapBeforeNoon`: for bedtimes, 00:00–11:59 counts as after midnight,
 * i.e. later than any evening time. Before the first option → the first; after the last → the last.
 */
function clockOption(options, minutes, wrapBeforeNoon) {
  const shift = v => (wrapBeforeNoon && v < 720 ? v + 1440 : v);
  const t = shift(minutes);
  for (const o of options) {
    const from = o.from === null ? -Infinity : shift(clockMinutes(o.from));
    const to = o.to === null ? Infinity : shift(clockMinutes(o.to));
    if (t >= from && t < to) return o;
  }
  return t < shift(clockMinutes(options[0].from ?? '00:00')) ? options[0] : options[options.length - 1];
}

/** The option a number of minutes falls in (min and max both included). Beyond the top → the top option. */
function minuteOption(options, minutes) {
  for (const o of options) if (minutes >= o.min && (o.max === null || minutes <= o.max)) return o;
  const top = options.reduce((a, b) => ((b.max ?? Infinity) > (a.max ?? Infinity) ? b : a));
  return minutes > (top.max ?? Infinity) ? top : options[options.length - 1];
}

/**
 * One day's answers → { category: { label, marks } }. Only the answers present are scored, so a part-filled
 * day can be previewed. `day` fields (API contract §3): sleptAt, wokeAt, chantingDoneAt, chantingSameDay,
 * dayRestMin, readingMin, hearingMin.
 */
export function dayMarks(card, day) {
  if (!card || !card.to_bed) throw new Error('Unknown card');
  if (card.kind === 'linear') return linearDayMarks(card, day || {});
  const out = {};
  const pick = o => ({ label: o.label, marks: o.marks });
  const t = k => clockMinutes(day[k]);
  if (!isNaN(t('sleptAt'))) out.to_bed = pick(clockOption(card.to_bed, t('sleptAt'), true));
  if (!isNaN(t('wokeAt'))) out.wake_up = pick(clockOption(card.wake_up, t('wokeAt'), false));
  if (Number.isInteger(day.dayRestMin)) out.day_sleep = pick(minuteOption(card.day_sleep, day.dayRestMin));
  if (day.chantingSameDay === false) out.japa = pick(card.japa[card.japa.length - 1]);      // not finished the same day
  else if (day.chantingSameDay === true && !isNaN(t('chantingDoneAt'))) out.japa = pick(clockOption(card.japa, t('chantingDoneAt'), false));
  if (Number.isInteger(day.readingMin)) out.pathan = pick(minuteOption(card.pathan, day.readingMin));
  if (Number.isInteger(day.hearingMin)) out.sravan = pick(minuteOption(card.sravan, day.hearingMin));
  return out;
}

/** The week's Seva score from its total minutes, 0–100 (decision 29). */
export function sevaScore(card, weekMinutes) {
  const rule = card.seva, m = Math.max(0, Number(weekMinutes) || 0);
  if (rule.rule === 'divide') return pct100((m / rule.by) * 100);
  for (const [below, score] of rule.steps) if (m < below) return score;
  return rule.top;
}

/**
 * A week → the percentages the sadhana sheets hold.
 *   days: 7 day objects (Monday … Sunday; {} for a day not filled) · attendance: 'P' | 'A' (anything else: absent) · sevaMinutes: the week's total
 * Each category = the week's marks ÷ 175 × 100 (7 days × 25), rounded, kept between 0 and 100. An option's own marks stay as
 * the card has them (−5 included); only the percentage is held to 0–100. A day not filled adds 0 marks (the head, 4 Oct 2026:
 * a part week is an option), so a part week's score is capped by its days: 1 perfect day = 14%, 5 = 71%, 7 = 100%.
 * Body = avg(bed, wake up, day sleep); Soul = avg(japa, pathan, sravan); Overall = avg(Body, Soul, Attendance, Seva).
 */
export function weekScores(card, days, attendance, sevaMinutes) {
  if (!Array.isArray(days) || days.length !== 7) throw new Error('A week has 7 days');
  if (card && card.kind === 'linear') return linearWeekScores(card, days, attendance);
  const marks = days.map(d => dayMarks(card, d));
  const pct = {};
  for (const c of CATEGORIES) {
    pct[c] = pct100((marks.reduce((s, m) => s + (m[c] ? m[c].marks : 0), 0) / 175) * 100);
  }
  const seva = sevaScore(card, sevaMinutes);
  const att = attendance === 'P' ? 100 : 0;
  const avg = (...v) => pct100(v.reduce((a, b) => a + b, 0) / v.length);
  const body = avg(pct.to_bed, pct.wake_up, pct.day_sleep), soul = avg(pct.japa, pct.pathan, pct.sravan);
  return { bed: pct.to_bed, wake_up: pct.wake_up, day_sleep: pct.day_sleep, japa: pct.japa, pathan: pct.pathan, sravan: pct.sravan,
           seva, attendance: att, body, soul, overall: avg(body, soul, att, seva), marks };
}

/**
 * A day's marks out of 150 (6 categories × 25) and its percentage, held to 0–100 (for the app and Share).
 * A linear card's marks (TRD) carry each item's maximum as `of`, so they are out of the sum of those (205), with no
 * card needed: a submitted week read back from week_json scores the same here as on the server (weeks.js day_pct).
 */
export function dayPercent(marks) {
  const items = Object.values(marks || {}).filter(Boolean);
  if (items.some(m => m.of !== undefined)) {
    const total = r2(items.reduce((s, m) => s + m.marks, 0)), outOf = items.reduce((s, m) => s + (m.of || 0), 0);
    return { total, outOf, percent: outOf ? pct100((total / outOf) * 100) : 0, complete: items.every(m => m.label !== NOT_FILLED) };
  }
  const cats = CATEGORIES.filter(c => marks[c]);
  const total = cats.reduce((s, c) => s + marks[c].marks, 0);
  return { total, outOf: 150, percent: pct100((total / 150) * 100), complete: cats.length === CATEGORIES.length };
}

/* ------------------------------------------------------------------------------------------------------------------
 * The linear card (TRD, the temple residents; Phase 22, the head 23 Oct 2026: "COSATOK's way"). COSATOK's "Marking
 * Scheme · Level: TRD": every item slides in a straight line between two points (no steps, no negative marks), an
 * unfilled field is 0, and chanting not finished the same day is 0 — both its time and its rounds. The card says, per
 * item, which answer it reads and its two points (worker/src/cards.js); this is only the arithmetic.
 *   clock item:  { field, clock: true, full: 'HH:MM', zero: 'HH:MM', marks [, night] [, sameDay] }
 *   number item: { field, full: n, zero: n, marks [, sameDay] }          (full < zero: less is better, as day rest)
 *   choice item: { fields: [...], answers: { VALUE: marks }, marks }    (the Morning program: 4 × on time 5 / late 3)
 * ------------------------------------------------------------------------------------------------------------------ */
export const NOT_FILLED = 'Not filled';
const r2 = x => Math.round(x * 100) / 100;                       // marks to 2 decimals: 25 × 20/30 = 16.67
/** marks at `full`, 0 at `zero`, a straight line between; beyond either end, that end's marks. */
export function slide(x, full, zero, marks) {
  if (full === zero) return x <= full ? marks : 0;
  const f = (x - zero) / (full - zero);                          // 0 at zero, 1 at full, whichever way round
  return r2(marks * Math.max(0, Math.min(1, f)));
}
const night = v => (v < 720 ? v + 1440 : v);                     // a bedtime after midnight is later than any evening
const hm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function linearItem(it, day) {
  const out = (label, marks) => ({ label, marks, of: it.marks });
  if (it.fields) {                                               // a choice item: each answer's marks, added
    const given = it.fields.filter(k => it.answers[day[k]] !== undefined);
    if (!given.length) return out(NOT_FILLED, 0);
    return out(`${given.length} of ${it.fields.length} answered`, r2(given.reduce((s, k) => s + it.answers[day[k]], 0)));
  }
  const v = day[it.field];
  if (it.sameDay && day.chantingSameDay === false) return out('Not the same day', 0);
  if (it.clock) {
    let t = clockMinutes(v);
    if (isNaN(t) || (it.sameDay && day.chantingSameDay !== true)) return out(NOT_FILLED, 0);
    const label = hm(t), adj = it.night ? night : x => x;
    t = adj(t);
    return out(label, slide(t, adj(clockMinutes(it.full)), adj(clockMinutes(it.zero)), it.marks));
  }
  if (!Number.isInteger(v) || (it.sameDay && day.chantingSameDay !== true)) return out(NOT_FILLED, 0);
  return out(`${v} ${it.unit || 'min'}`, slide(v, it.full, it.zero, it.marks));
}
function linearDayMarks(card, day) {
  return Object.fromEntries(card.items.map(k => [k, linearItem(card[k], day)]));
}
/**
 * A week on the linear card. Overall = all the week's day marks ÷ (7 × the day's maximum) × 100. The per-measure
 * columns stay filled for reports: each = the week's marks ÷ (7 × that item's maximum) × 100 (÷ 175 for a 25-mark item),
 * Morning program ÷ 140; Body = avg(bed, wake up, day sleep), Soul = avg(japa, pathan, sravan). Class attendance is
 * recorded (100 / 0) but not scored. A day not filled is {} and adds 0, as on the other cards.
 */
function linearWeekScores(card, days, attendance) {
  const marks = days.map(d => (d && Object.keys(d).length ? linearDayMarks(card, d) : {}));
  const week = k => marks.reduce((s, m) => s + (m[k] ? m[k].marks : 0), 0);
  const pct = k => pct100((week(k) / (7 * card[k].marks)) * 100);
  const total = card.items.reduce((s, k) => s + week(k), 0);
  const avg = (...v) => pct100(v.reduce((a, b) => a + b, 0) / v.length);
  const bed = pct('to_bed'), wake_up = pct('wake_up'), day_sleep = pct('day_sleep'), japa = pct('japa'), pathan = pct('pathan'), sravan = pct('sravan');
  return { bed, wake_up, day_sleep, japa, pathan, sravan, seva: pct('seva'), morning: pct('morning'), attendance: attendance === 'P' ? 100 : 0,
           body: avg(bed, wake_up, day_sleep), soul: avg(japa, pathan, sravan), overall: pct100((total / (7 * card.dayMax)) * 100),
           attendanceScored: false, marks };
}
