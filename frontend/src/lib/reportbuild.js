// Admin › Reports (Phase 23 P14): the period picker's maths and the report's plain sentences, worked out on the phone from
// what report.get sends (worker/src/report.js). Pure: no I/O. The method is the 26 Oct 3-month analysis's, so reports
// compare: a blank week is never a zero (quality over filled weeks, reporting on its own), every number says what it
// rests on, and a figure on fewer than 5 weeks is shown but never called a trend.
import { figureOf, fmtFig, metric, sumRows, movements } from './analysis.js';
import { fmtShort } from './dates.js';

export const MAX_DAYS = 366;
export const THIN = 5;
const plus = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const mondayOf = (ymd) => plus(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7));
const daysOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

/** The Mondays of the whole weeks [from, to] holds: a week belongs to the period its Monday falls in (as the server). */
export function weeksIn(from, to) {
  const out = [];
  if (!from || !to || to < from) return out;
  for (let w = mondayOf(from) < from ? plus(mondayOf(from), 7) : from; w <= to; w = plus(w, 7)) out.push(w);
  return out;
}

/**
 * A choice → { from, to, days, error }.
 *   thisWeek / lastWeek  whole Monday–Sunday weeks · thisMonth  the calendar month · phase / training  their own dates
 *   (a running training ends today, or on its planned end) · custom  from–to, a year at most
 */
export function periodFor(choice, today, { phase = null, training = null, from = '', to = '' } = {}) {
  let a = '', b = '', error = '';
  if (choice === 'thisWeek') { a = mondayOf(today); b = plus(a, 6); }
  else if (choice === 'lastWeek') { a = plus(mondayOf(today), -7); b = plus(a, 6); }
  else if (choice === 'thisMonth') { a = today.slice(0, 8) + '01'; const [y, m] = today.split('-').map(Number); b = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
  else if (choice === 'phase') { if (phase) { a = phase.startsOn; b = phase.endsOn; } else error = 'Choose a phase.'; }
  else if (choice === 'training') {
    if (training) { a = training.startedOn; b = training.closedAt ? training.closedAt.slice(0, 10) : training.endsOn || today; if (training.closedAt && training.endsOn && training.endsOn < b) b = training.endsOn; }
    else error = 'Choose a training.';
  } else { a = from; b = to; if (!a || !b) error = 'Choose the first and the last day.'; }
  if (!error && (!a || !b)) error = 'This has no dates yet.';
  if (!error && b < a) error = 'The end comes after the start.';
  const days = !error ? daysOf(a, b) : 0;
  if (!error && days > MAX_DAYS) error = 'At most a year (366 days) at a time. Choose a shorter period.';
  return { from: a, to: b, days, error };
}

/** Which weeks a period covers, in words: only whole weeks, only closed ones. */
export function coverText(from, to, lastClosed) {
  const all = weeksIn(from, to), closed = all.filter((w) => w <= lastClosed);
  if (!all.length) return 'This range holds no whole week (a week counts from its Monday).';
  if (!closed.length) return 'Its week is still open: the sadhana appears once the Monday deadline closes it.';
  const n = closed.length, end = plus(closed[n - 1], 6);
  const open = closed.length < all.length ? ` (${all.length - closed.length} still open)` : '';
  // the dates are already on the screen when the weeks are exactly the period's
  if (closed[0] === from && end === to) return `${n} closed ${n === 1 ? 'week' : 'weeks'}${open}`;
  return `${n} closed ${n === 1 ? 'week' : 'weeks'}: ${fmtShort(closed[0])} – ${fmtShort(end)}${open}`;
}

/* ------------------------------------------------------------------------ */
/* The figures                                                               */
/* ------------------------------------------------------------------------ */

const inWeeks = (rows, ws) => { const s = new Set(ws); return (rows || []).filter((r) => s.has(r.weekId)); };
/** The period's and the earlier period's rows. */
export const split = (rep) => ({ cur: inWeeks(rep.sadhana, rep.weeks), prev: rep.compare ? inWeeks(rep.sadhana, rep.compare.weeks) : [] });
const pct = (n, d) => (d > 0 ? (n * 100) / d : null);
/** A reporting group's figures: weeks filled ÷ due (%), and the score over filled weeks. */
export const fillPct = (g) => (g ? pct(g.filled, g.due) : null);
export const quality = (g) => (g && g.filled > 0 ? g.score / g.filled : null);

/** The five numbers that matter, each with its base, the earlier figure and whether it is too thin to call a trend. */
export function summaryNumbers(rep) {
  const { cur, prev } = split(rep), s = sumRows(cur), sp = sumRows(prev);
  // the per-person rows (the Leaderboard's) when there are any; otherwise the weekly sums alone
  const t = rep.people?.cur?.total?.due ? rep.people.cur.total : null, tp = t ? rep.people?.cmp?.total : null;
  const out = [];
  // the earlier figure person by person when the server sent it (periods up to a quarter), else from the weekly sums
  if (t) out.push({ key: 'filling', label: 'Weeks filled', unit: '%', value: fillPct(t), prev: tp ? fillPct(tp) : prev.length ? figureOf('filling', prev) : null, base: `${t.filled} of ${t.due} weeks`, thin: t.due < THIN });
  else if (cur.length) out.push({ key: 'filling', label: 'Weeks filled', unit: '%', value: figureOf('filling', cur), prev: prev.length ? figureOf('filling', prev) : null, base: `${s.submitted} of ${s.submitted + s.missed} weeks`, thin: s.submitted + s.missed < THIN });
  const filled = t ? t.filled : s.submitted;
  out.push({ key: 'overall', label: 'Sadhana score', unit: '%', value: t ? quality(t) : figureOf('overall', cur), prev: tp ? quality(tp) : prev.length ? figureOf('overall', prev) : null,
    base: `${filled} filled ${filled === 1 ? 'week' : 'weeks'}`, thin: filled < THIN });
  out.push({ key: 'attendance', label: 'Class attendance', unit: '%', value: figureOf('attendance', cur), prev: prev.length ? figureOf('attendance', prev) : null, base: `${s.present} of ${s.held} classes`, thin: s.held < THIN });
  out.push({ key: 'rounds', label: 'Chanting', unit: ' rounds', digits: 1, value: figureOf('rounds', cur), prev: prev.length ? figureOf('rounds', prev) : null, base: `${s.nRounds} weeks with rounds`, thin: s.nRounds < THIN });
  if (rep.students) out.push({ key: 'people', label: 'Devotees now', unit: '', value: rep.students.total, prev: null, base: 'active in scope', thin: false });
  return out;
}
/** A figure as the report prints it. */
export const fmtNum = (v, unit = '', digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (digits ? v.toFixed(digits) : Math.round(v)) + unit);
/** The change in words for a tile: "▲ 4 pts", "▼ 0.3 rounds", "steady", or why there is none. */
export function changeOf(n) {
  if (n.value === null || n.value === undefined || n.prev === null || n.prev === undefined) return { text: '', dir: 0 };
  const d = n.value - n.prev, k = n.digits ? 10 ** n.digits : 1;
  if (Math.round(Math.abs(d) * k) === 0) return { text: 'steady', dir: 0 };
  return { text: `${d > 0 ? '▲' : '▼'} ${n.digits ? Math.abs(d).toFixed(n.digits) : Math.round(Math.abs(d))}${n.unit === '%' ? ' pts' : n.unit}`, dir: d > 0 ? 1 : -1 };
}

// the practices compared with each other: all on the card's 0–100 scale or a share of weeks
export const PRACTICES = ['bed', 'wake', 'night', 'principles', 'morning'];
const PRACTICE_LABEL = { bed: 'To bed', wake: 'Wake-up', night: 'Night stay', principles: 'The four principles', morning: 'The morning program' };
// the same practices in a sentence ("Waking up on time is the weakest practice")
const PRACTICE_WORDS = { bed: 'Going to bed on time', wake: 'Waking up on time', night: 'Night stay', principles: 'Keeping the four principles', morning: 'The morning program' };
/** The practices over these rows, weakest first (only those with a figure). */
export function practices(rows) {
  return PRACTICES.map((k) => ({ key: k, label: PRACTICE_LABEL[k], words: PRACTICE_WORDS[k], value: figureOf(k, rows) })).filter((p) => p.value !== null).sort((a, b) => a.value - b.value);
}

/* ------------------------------------------------------------------------ */
/* The sentences                                                             */
/* ------------------------------------------------------------------------ */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/**
 * What improved, what worries, and the three most useful things to do — in plain words, each with its numbers and what
 * they rest on. Good news first. Nothing is claimed for a period with no closed week, or on fewer than 5 weeks.
 */
export function findings(rep) {
  const good = [], worry = [], actions = [];
  const { cur, prev } = split(rep), s = sumRows(cur);
  const t = rep.people?.cur?.total, tp = rep.people?.cmp?.total;
  const nameOf = (id) => (rep.batches || []).find((b) => b.batchId === id)?.name || id;
  if (!rep.weeks?.length) return { good, worry: ['No closed week in this period yet: the sadhana sections fill in once a Monday deadline closes one.'], actions };

  // reporting, the first-order question
  if (t && t.due) {
    const was0 = sumRows(prev), now = fillPct(t), was = tp ? fillPct(tp) : was0.submitted + was0.missed ? fillPct({ filled: was0.submitted, due: was0.submitted + was0.missed }) : null;
    if (was !== null && t.due >= THIN && Math.round(now) !== Math.round(was)) (now > was ? good : worry).push(`Weeks filled ${now > was ? 'rose' : 'fell'} from ${fmtNum(was, '%')} to ${fmtNum(now, '%')} (${t.filled} of ${t.due} weeks).`);
    if (t.never) worry.push(`${t.never} of ${plural(t.people, 'person', 'people')} filled no week in the period.`);
  }
  // batch by batch, the biggest moves (the Analysis rule), only on enough weeks
  if (rep.compare?.weeks?.length && cur.length && prev.length) {
    const period = { from: rep.weeks[0], to: rep.weeks[rep.weeks.length - 1], prevFrom: rep.compare.weeks[0], prevTo: rep.compare.weeks[rep.compare.weeks.length - 1] };
    const enough = (b) => sumRows(cur.filter((r) => r.batchId === b)).submitted >= THIN && sumRows(prev.filter((r) => r.batchId === b)).submitted >= THIN;
    const moves = movements(rep.sadhana, (rep.batches || []).filter((b) => enough(b.batchId)), period, ['rounds', 'wake', 'bed', 'reading', 'hearing', 'night', 'principles', 'morning', 'attendance', 'overall']);
    for (const m of moves.filter((x) => x.up).slice(0, 3)) good.push(`${m.text}.`);
    for (const m of moves.filter((x) => !x.up).slice(0, 3)) worry.push(`${m.text}.`);
  }
  // the weakest and the strongest practice, and where the weakest is weakest
  const pr = s.submitted >= THIN ? practices(cur) : [];
  let weakAt = null;
  if (pr.length > 1) {
    const w = pr[0], strong = pr[pr.length - 1];
    const by = (rep.batches || []).map((b) => ({ b, rows: cur.filter((r) => r.batchId === b.batchId) })).filter((x) => sumRows(x.rows).submitted >= THIN)
      .map((x) => ({ name: x.b.name, value: figureOf(w.key, x.rows) })).filter((x) => x.value !== null).sort((a, b) => a.value - b.value);
    weakAt = by.length > 1 ? by[0] : null;
    worry.push(`${w.words} is the weakest practice (${fmtNum(w.value, '%')} on ${s.submitted} filled weeks)${weakAt ? `, lowest in ${weakAt.name} (${fmtNum(weakAt.value, '%')})` : ''}.`);
    good.push(`${strong.words} is the strongest practice (${fmtNum(strong.value, '%')}).`);
  }
  // the work that waits
  const h = rep.health || {}, waiting = rep.work?.waiting?.signups || 0;

  // the three most useful actions, most useful first
  if (t?.never) {
    const worst = Object.entries(rep.people.cur.byBatch || {}).sort((a, b) => b[1].never - a[1].never)[0];
    actions.push(`Call the ${plural(t.never, 'person', 'people')} who filled no week${worst && worst[1].never ? `, most of them in ${nameOf(worst[0])} (${worst[1].never})` : ''}: reporting comes before scores.`);
  }
  if (pr.length > 1) actions.push(`Make ${pr[0].words.toLowerCase()} the theme of the next facilitator round${weakAt ? ` in ${weakAt.name}` : ''}: one small commitment per devotee, followed up on the weekly call.`);
  if (waiting) actions.push(`Answer the ${plural(waiting, 'sign-up', 'sign-ups')} waiting${rep.work.waiting.oldest ? ` (the oldest since ${fmtShort(rep.work.waiting.oldest.slice(0, 10))})` : ''}.`);
  if (h.noFacilitator) actions.push(`Give a facilitator to the ${plural(h.noFacilitator, 'devotee', 'devotees')} who have none.`);
  if (h.orphans) actions.push(`Find a new facilitator for the ${plural(h.orphans, 'student', 'students')} whose facilitator stopped.`);
  const att = figureOf('attendance', cur);
  if (att !== null && s.held >= THIN && att < 50) actions.push(`Bring class attendance up from ${fmtNum(att, '%')} (${s.present} of ${s.held} classes): a call before each class.`);
  if (h.missingProfile) actions.push(`Ask the ${plural(h.missingProfile, 'devotee', 'devotees')} with an incomplete profile to finish it.`);
  return { good, worry, actions: actions.slice(0, 3) };
}

/** The metric's own label and unit, re-exported for the screen's tables. */
export { metric, fmtFig, figureOf, sumRows };
