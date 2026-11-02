// Admin › Analysis (phase 21, 23 Oct 2026): the IYF head's view of how the devotional standards move, batch by batch.
//
// Read from `batch_weeks` (migration 0064): one row per batch per closed week holding the SUMS behind every average,
// so any period — a month or a year, every batch at once — is ~52 × batches rows and one round trip, never a scan of
// submissions. The Monday deadline job writes it (refreshWeeks below, inside the job's own closing batch); the
// averages, the period comparisons and the plain-sentence report are worked out on the phone from these sums.
import { invalid } from './util.js';
import { q, reads, rows as allRows, batchesAll } from './db.js';
import { addDays } from './weeks.js';
import { isTrainingBatch } from './admin.js';
import { NO_ATTENDANCE_CARDS } from './cards.js';

/*
 * A submitted week's FINAL overall, in SQL (C4, 27 Oct 2026): classweek.js finalScores(s, markUsed(att, classWeek)), the
 * score the Board, History and the Leaderboard show (leaderboard.js SCORE is the same rule). The mark that counts is the
 * first of head, coordinator, group leader, the class week's default, the devotee's own; a P or A that differs from the
 * attendance the week was scored with re-works overall as (body + soul + att + seva) / 4, rounded half away from zero
 * and held to 0–100; a card that does not score attendance (TRD) keeps its overall. sb = submissions, aa = attendance,
 * cc = class_weeks. Until this, the summary summed the overall stored at submit, so a later mark made Analysis disagree.
 */
const NO_ATT = NO_ATTENDANCE_CARDS.map(n => `'${n.replace(/'/g, "''")}'`).join(', ') || "''";
export const FINAL_OVERALL = `CASE WHEN sb.score_card IN (${NO_ATT}) THEN sb.overall ELSE CASE COALESCE(NULLIF(aa.master_mark, ''), NULLIF(aa.coordinator_mark, ''), NULLIF(aa.leader_mark, ''),
        CASE WHEN cc.batch_id IS NULL THEN NULL WHEN cc.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END, NULLIF(aa.devotee_mark, ''), '')
      WHEN 'P' THEN CASE WHEN sb.attendance = 100 THEN sb.overall ELSE MAX(0, MIN(100, ROUND((sb.body + sb.soul + 100 + sb.seva) / 4.0))) END
      WHEN 'A' THEN CASE WHEN sb.attendance = 0 THEN sb.overall ELSE MAX(0, MIN(100, ROUND((sb.body + sb.soul + sb.seva) / 4.0))) END
      ELSE sb.overall END END`;

/**
 * The statements that (re)write the summary of these closed weeks, one per week: the sums of that week's
 * submissions, missed weeks and class marks, per batch. Keyed upserts (batch, week) — the free plan counts writes.
 * `batchId`: only that batch's row (a late change to one batch's closed week, refreshClosed below).
 */
export function refreshWeeks(db, weekIds, at, batchId = null) {
  const one = batchId === null ? '' : ' AND batch_id = ?', b = batchId === null ? [] : [String(batchId)];
  return weekIds.map((w) => q(db, `
    INSERT INTO batch_weeks (batch_id, week_id, submitted, missed, sum_overall, sum_body, sum_soul, sum_bed, sum_wake, n_rounds, sum_rounds,
                             sum_reading, sum_hearing, sum_seva, night_yes, principles_yes, present, held, n_morning, sum_morning, at)
    SELECT k.batch_id, ?, COALESCE(s.n, 0), COALESCE(x.n, 0), COALESCE(s.so, 0), COALESCE(s.sb, 0), COALESCE(s.ss, 0), COALESCE(s.sbed, 0), COALESCE(s.swake, 0),
           COALESCE(s.nr, 0), COALESCE(s.sr, 0), COALESCE(s.srd, 0), COALESCE(s.sh, 0), COALESCE(s.sv, 0), COALESCE(s.ny, 0), COALESCE(s.py, 0),
           COALESCE(a.p, 0), COALESCE(a.h, 0), COALESCE(s.nm, 0), COALESCE(s.sm, 0), ?
      FROM (SELECT batch_id FROM submissions WHERE week_id = ?${one} UNION SELECT batch_id FROM missed_weeks WHERE week_id = ?${one}) k
      LEFT JOIN (SELECT sb.batch_id, COUNT(*) AS n, SUM(${FINAL_OVERALL}) AS so, SUM(sb.body) AS sb, SUM(sb.soul) AS ss, SUM(sb.bed) AS sbed, SUM(sb.wake_up) AS swake,
                        SUM(sb.avg_rounds <> '') AS nr, SUM(CASE WHEN sb.avg_rounds <> '' THEN CAST(sb.avg_rounds AS REAL) ELSE 0 END) AS sr,
                        SUM(sb.reading_minutes) AS srd, SUM(sb.hearing_minutes) AS sh, SUM(sb.seva_minutes) AS sv,
                        SUM(sb.night_stay = 'YES') AS ny, SUM(sb.principles = 'YES') AS py,
                        -- the Morning program (TRD, Phase 22): over the weeks that have the column
                        COUNT(sb.morning) AS nm, SUM(sb.morning) AS sm
                   FROM submissions sb
                   LEFT JOIN attendance aa ON aa.login = sb.login AND aa.week_id = sb.week_id
                   LEFT JOIN class_weeks cc ON cc.batch_id = sb.batch_id AND cc.week_id = sb.week_id
                  WHERE sb.week_id = ?${one ? ' AND sb.batch_id = ?' : ''} GROUP BY sb.batch_id) s ON s.batch_id = k.batch_id
      LEFT JOIN (SELECT batch_id, COUNT(*) AS n FROM missed_weeks WHERE week_id = ?${one} GROUP BY batch_id) x ON x.batch_id = k.batch_id
      LEFT JOIN (SELECT batch_id, SUM(mark_used = 'P') AS p, SUM(mark_used <> '') AS h FROM attendance WHERE week_id = ?${one} GROUP BY batch_id) a ON a.batch_id = k.batch_id
     WHERE k.batch_id IS NOT NULL
    ON CONFLICT(batch_id, week_id) DO UPDATE SET submitted = excluded.submitted, missed = excluded.missed, sum_overall = excluded.sum_overall,
      sum_body = excluded.sum_body, sum_soul = excluded.sum_soul, sum_bed = excluded.sum_bed, sum_wake = excluded.sum_wake, n_rounds = excluded.n_rounds,
      sum_rounds = excluded.sum_rounds, sum_reading = excluded.sum_reading, sum_hearing = excluded.sum_hearing, sum_seva = excluded.sum_seva,
      night_yes = excluded.night_yes, principles_yes = excluded.principles_yes, present = excluded.present, held = excluded.held,
      n_morning = excluded.n_morning, sum_morning = excluded.sum_morning, at = excluded.at`,
    w, at, w, ...b, w, ...b, w, ...b, w, ...b, w, ...b));
}
/**
 * A late change to a CLOSED week — an attendance mark after its deadline, a reopened week submitted — re-writes that
 * one batch-week summary row in the same batch as the change (C4), so Analysis says at once what the Board says.
 * Nothing while the week is still open: the Monday deadline sums it. `closedThrough`: settings.deadline_done, which
 * the caller reads BEFORE preparing its writes (the settings are memoised until a write is prepared).
 */
export const refreshClosed = (db, closedThrough, batchId, weekId, at) =>
  (closedThrough && batchId && String(weekId) <= String(closedThrough) ? refreshWeeks(db, [String(weekId)], at, String(batchId)) : []);
/** The week the job closes and the three before it: late submissions and attendance changes land within a month. */
export const refreshedWeeks = (due) => [due, addDays(due, -7), addDays(due, -14), addDays(due, -21)];

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** analysis.get: every batch's weekly sums over [from, to] (Mondays), with the batches and the phases to filter by. */
export async function analysisGet(d, ctx) {
  const db = ctx.db, from = String(d.from || ''), to = String(d.to || '');
  if (!YMD.test(from)) throw invalid({ path: 'from', message: 'A date, as 2026-09-01.' });
  if (!YMD.test(to)) throw invalid({ path: 'to', message: 'A date, as 2026-10-31.' });
  if (to < from) throw invalid({ path: 'to', message: 'The end comes after the start.' });
  // two years at most: ~104 weeks × batches rows
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 731) throw invalid({ path: 'to', message: 'At most two years at a time.' });
  // the batches are already in memory (scopesOf read them); the trainings among them are few (ETP-21 now), so their
  // figures are read live, beside the sadhana summary, in the same round trip (the head: "the entire background of the
  // sadhana and training … monitored across from one screen")
  const all = await batchesAll(db), tr = all.filter((b) => isTrainingBatch(b.batch_id)).map((b) => b.batch_id);
  const [weeks, phases, done, enr, dec, tatt] = await reads(db, [
    allRows(q(db, `SELECT * FROM batch_weeks WHERE week_id >= ? AND week_id <= ? ORDER BY week_id, batch_id`, from, to)),
    allRows(q(db, 'SELECT phase_id, name, starts_on, ends_on FROM phases ORDER BY starts_on DESC LIMIT 12')),
    q(db, "SELECT value FROM settings WHERE key = 'deadline_done'"),
    ...trainingReads(db, tr, from, to)]);
  const batches = all.map((b) => ({ batchId: b.batch_id, name: b.name, level: b.level, active: !!b.active }));
  return {
    trainings: trainingsView(all, tr, enr, dec, tatt),
    from, to, lastClosed: done?.value || '', batches,
    phases: phases.map((p) => ({ phaseId: p.phase_id, name: p.name, startsOn: p.starts_on, endsOn: p.ends_on })),
    weeks: weeks.map(weekView)
  };
}

/** One batch_weeks row as the phone reads it (analysis.get, and Admin › Reports, report.js, send the same shape). */
export const weekView = (r) => ({ batchId: r.batch_id, weekId: r.week_id, submitted: r.submitted, missed: r.missed,
  overall: r.sum_overall, body: r.sum_body, soul: r.sum_soul, bed: r.sum_bed, wake: r.sum_wake, nRounds: r.n_rounds, rounds: r.sum_rounds,
  reading: r.sum_reading, hearing: r.sum_hearing, seva: r.sum_seva, night: r.night_yes, principles: r.principles_yes, present: r.present, held: r.held,
  // the Morning program (TRD, Phase 22): the sum of the weeks' Morning program scores, over nMorning weeks
  nMorning: r.n_morning ?? 0, morning: r.sum_morning ?? 0 });

/** The trainings' live figures (enrolments by state, how it ended, training attendance by week), read beside the rest. */
export function trainingReads(db, tr, from, to) {
  if (!tr.length) return [];
  const marks = tr.map(() => '?').join(',');
  return [
    allRows(q(db, `SELECT batch_id, state, COUNT(*) AS n FROM enrolments WHERE batch_id IN (${marks}) GROUP BY batch_id, state`, ...tr)),
    allRows(q(db, `SELECT batch_id, decision, COUNT(*) AS n FROM batch_closings WHERE batch_id IN (${marks}) GROUP BY batch_id, decision`, ...tr)),
    allRows(q(db, `SELECT batch_id, week_id, SUM(mark = 'P') AS present, SUM(mark <> '') AS held FROM training_attendance
                    WHERE batch_id IN (${marks}) AND week_id >= ? AND week_id <= ? GROUP BY batch_id, week_id`, ...tr, from, to))];
}
/** Each training from what trainingReads read: in it now, how it ended for those who left, its attendance week by week. */
export function trainingsView(all, tr, enr, dec, tatt) {
  const count = (rs, id, f, v) => (rs || []).filter((r) => r.batch_id === id && r[f] === v).reduce((n, r) => n + r.n, 0);
  return all.filter((b) => tr.includes(b.batch_id)).map((b) => {
    const ended = count(enr, b.batch_id, 'state', 'ENDED'), qualified = count(dec, b.batch_id, 'decision', 'qualified'),
      repeat = count(dec, b.batch_id, 'decision', 'repeat'), left = count(dec, b.batch_id, 'decision', 'left');
    return { batchId: b.batch_id, name: b.name, level: b.level, startedOn: b.started_on || '', closedAt: b.closed_at || '',
      active: count(enr, b.batch_id, 'state', 'ACTIVE'), qualified, repeat, left, removed: Math.max(0, ended - qualified - repeat - left),
      weeks: (tatt || []).filter((r) => r.batch_id === b.batch_id).map((r) => ({ weekId: r.week_id, present: r.present, held: r.held })) };
  });
}
