// The promotion explorer, for a facilitator (phase 21, 23 Oct 2026; the head: "a promotion explorer … which gives list of
// students under them eligible for promotion across the batches, based on the filters which the facilitator decides …
// last week, last month or year or between custom dates", "with default parameters selected, and on top of that they can
// even use their custom selection like the way explorer is implemented in the spiritual dashboard sheet").
//
// The sheet's "Promotion Explorer" tab is the model: a route, and per criterion an "apply?" tick and a threshold of your
// own (blank = the rule), all ANDed. Its figures are the phase so far; here the facilitator also picks the period.
//
// The server does the one costly thing — each student's figures over the period, two GROUP BY reads in one round trip
// at any number of students (eligible.js figureReads) — and sends every figure with each student's batch rule. The
// ticks and thresholds are applied on the phone, so trying a what-if costs no call; only a new period asks again.
// It is a what-if view: who is officially ready is still the batch's own rule (eligible.list, Ready to move up).
import { apiError, invalid, isoIst } from './util.js';
import { q, reads, rows as allRows } from './db.js';
import { addDays } from './weeks.js';
import { lastClosedWeek } from './leaderboard.js';
import { criteriaFrom, figureReads, figuresFromReads, MEASURED, LABEL } from './eligible.js';
import { nextLevels } from './closing.js';
import { currentPhase } from './phases.js';
import { APP_ID } from './admin.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** Custom periods: up to 400 days (a facilitator's students are tens, not thousands: ~30 × 57 weeks of rows). */
export const EXPLORER_MAX_DAYS = 400;
const mondayOfYmd = (ymd) => { const d = new Date(ymd + 'T00:00:00Z'), back = (d.getUTCDay() + 6) % 7; return addDays(ymd, -back); };

/**
 * The weeks [first, last] (Mondays) a period covers, never past the last closed week:
 *   phase   the open phase so far (the sheet's window, and the default)
 *   week    the last closed week · month  the last 4 closed weeks · year  the last 52
 *   custom  from–to (dates), each week counted by its Monday
 */
export function periodWeeks(d, closed, phase) {
  const period = String(d.period || 'phase');
  let first, last = closed;
  if (period === 'phase') {
    if (!phase) throw apiError('NOT_FOUND', 'No phase is open; choose a period.');
    first = mondayOfYmd(phase.starts_on);
  } else if (period === 'week') first = closed;
  else if (period === 'month') first = addDays(closed, -21);
  else if (period === 'year') first = addDays(closed, -51 * 7);
  else if (period === 'custom') {
    const from = String(d.from || ''), to = String(d.to || '');
    if (!YMD.test(from)) throw invalid({ path: 'from', message: 'A date, as 2026-09-01.' });
    if (!YMD.test(to)) throw invalid({ path: 'to', message: 'A date, as 2026-10-31.' });
    if (to < from) throw invalid({ path: 'to', message: 'The end comes after the start.' });
    if ((Date.parse(to) - Date.parse(from)) / 864e5 > EXPLORER_MAX_DAYS) throw invalid({ path: 'to', message: 'At most 400 days at a time.' });
    first = mondayOfYmd(from); last = mondayOfYmd(to) > closed ? closed : mondayOfYmd(to);
  } else throw invalid({ path: 'period', message: 'Phase, week, month, year or custom.' });
  return { period, first, last };
}

/** fac.eligible: the caller's students on the promotion ladder, any batch, with every figure and their batch's rule. */
export async function facEligible(d, ctx) {
  // their students by the facilitator's permanent id (Phase 24), whatever spelling they were given under
  const db = ctx.db, name = ctx.scopes?.facilitator?.name || '', id = String(ctx.acct?.fac_id || '');
  if (!name) throw apiError('FORBIDDEN', 'Only a facilitator has students.');
  const [closed, phase] = await Promise.all([lastClosedWeek(db, ctx.now()), currentPhase(db, isoIst(ctx.now()).slice(0, 10))]);
  const w = periodWeeks(d, closed, phase);
  // their students now (memberships_by_facilitator), each with their batch, and every batch's own rule — one round trip
  const [students, crit] = await reads(db, [
    allRows(q(db, `SELECT m.login, m.batch_id, b.name AS batch_name, b.level, a.name, a.iyf_id FROM memberships m
                     JOIN batches b ON b.batch_id = m.batch_id JOIN accounts a ON a.login = m.login
                    WHERE m.fac_id = ? AND m.to_week = '' AND m.state = 'ACTIVE' AND a.status = 'ACTIVE'
                    ORDER BY a.name`, id || '-')),
    allRows(q(db, `SELECT pc.batch_id, pc.criterion, pc.min_value FROM promotion_criteria pc
                     JOIN memberships m ON m.batch_id = pc.batch_id
                    WHERE m.fac_id = ? AND m.to_week = '' AND m.state = 'ACTIVE' GROUP BY pc.batch_id, pc.criterion`, id || '-'))]);
  // only the ladder: TRD, BVS and trainings move nobody up (eligible.js MEASURED); never themselves
  const ladder = students.filter((s) => MEASURED.includes(String(s.level || '').toUpperCase()) && s.login !== ctx.login);
  const byBatch = {};
  for (const r of crit) (byBatch[r.batch_id] ||= []).push(r);
  const fig = w.first <= w.last && ladder.length ? figuresFromReads(await reads(db, figureReads(db, ladder.map((s) => s.login), w.first, w.last))) : () => null;
  return {
    period: w.period, from: w.first, to: w.last, lastClosed: closed, phase: phase ? { phaseId: phase.phase_id, name: phase.name, startsOn: phase.starts_on } : null,
    labels: LABEL,
    students: ladder.map((s) => {
      const level = String(s.level).toUpperCase();
      // only an IYF ID identifies somebody (the head, 17 Oct 2026; migration 0056): an old GP/JN/KT number is never shown
      return { login: s.login, name: s.name, iyfId: APP_ID.test(s.iyf_id || '') ? s.iyf_id : '', batchId: s.batch_id, batchName: s.batch_name, level,
        next: nextLevels(level), rule: criteriaFrom(byBatch[s.batch_id] || [], level),
        figures: fig(s.login, s.batch_id) || { weeks: 0, att: null, heldClasses: 0, sad: null, chant: null, cls: null, night: null, pr: null } };
    })
  };
}
