// The sadhana leaderboard (ADR 0013, the head, 22 Oct 2026): devotees ordered by their weekly sadhana score.
//
//   staff   weekly, monthly, yearly or custom dates; a coordinator over one of their batches or all of them
//           together, the head over any batch or all of IYF Delhi — the full ranked list
//   devotee their OWN place in their batch for the last closed week ("7th of 12"), never another person's name or score
//
// What it ranks: the week's score exactly as the weekly board shows it — the stored `overall`, re-worked only where
// the attendance mark used differs from the one the week was scored with (classweek.js finalScores + markUsed, here
// in SQL so a year of all IYF is one aggregated read, not a JavaScript loop over every week). A missed week is 0.
// A range is the average of its weeks. Ties share a place.
//
// The week is the one the settings define (E): the last CLOSED week is found through windowOf, which reads
// settings.submit_closes. Nothing here works out a deadline of its own, so moving the submit time in Settings moves
// the board with it.
import { apiError, invalid } from './util.js';
import { q, batchesAll, scopeBatches } from './db.js';
import { mondayOf } from './util.js';
import { addDays, validWeekId, windowOf } from './weeks.js';
import { MAX_DAYS } from './exports.js';
import { NO_ATTENDANCE_CARDS } from './cards.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** A training (ETP now; MTP/FTP later) by its level or its id: not a class batch, so never on a class leaderboard. */
const isTraining = b => String(b.level || '').toUpperCase() === 'ETP' || /^(ETP|MTP|FTP)-\d+$/.test(String(b.batch_id || ''));
export const PAGE = 100;

/** The latest week whose deadline (settings.submit_closes) has passed. */
export async function lastClosedWeek(db, now) {
  const lastWeek = addDays(mondayOf(now), -7);
  return now >= (await windowOf(db, lastWeek)).closes ? lastWeek : addDays(lastWeek, -7);
}

/** The Mondays [first, last] a window covers, never past the last closed week. */
function windowOfPeriod(d, closed) {
  const period = String(d.period || 'week');
  let first, last, label;
  if (period === 'week') {
    const w = d.weekId === undefined || d.weekId === '' ? closed : String(d.weekId);
    if (!validWeekId(w)) throw invalid({ path: 'weekId', message: 'Not a week.' });
    if (w > closed) throw invalid({ path: 'weekId', message: 'That week is still open; it is ranked once its deadline passes.' });
    first = last = w; label = w;
  } else if (period === 'month') {
    const m = String(d.month || closed.slice(0, 7));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw invalid({ path: 'month', message: 'A month, as 2026-10.' });
    first = `${m}-01`; last = `${m}-31`; label = m;
  } else if (period === 'year') {
    const y = String(d.year || closed.slice(0, 4));
    if (!/^\d{4}$/.test(y)) throw invalid({ path: 'year', message: 'A year, as 2026.' });
    first = `${y}-01-01`; last = `${y}-12-31`; label = y;
  } else if (period === 'custom') {
    const from = String(d.from || ''), to = String(d.to || '');
    if (!YMD.test(from)) throw invalid({ path: 'from', message: 'A date, as 2026-09-01.' });
    if (!YMD.test(to)) throw invalid({ path: 'to', message: 'A date, as 2026-10-31.' });
    if (to < from) throw invalid({ path: 'to', message: 'The end comes after the start.' });
    // the exports' bound (ADR 0013 Consequences): one request never scans an unbounded span
    if ((Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) throw invalid({ path: 'to', message: 'At most 6 months at a time.' });
    first = from; last = to; label = `${from}…${to}`;
  } else throw invalid({ path: 'period', message: 'Week, month, year or custom.' });
  // a week belongs to the window its Monday falls in (as the card's months do); never a week still open
  return { period, label, first, last: last > closed ? closed : last };
}

/*
 * One row per person over the window: weeks counted, weeks missed, and the sum of the week scores. The CASE is
 * finalScores(s, markUsed(att, classWeek)) spelt in SQL: the first mark present among head, coordinator, group leader,
 * the class week's default (ALL_PRESENT → P, any other declared week → A), the devotee's own; a P or A that differs
 * from the attendance the week was scored with re-works overall as (body + soul + att + seva) / 4, held to 0–100.
 */
// TRD (Phase 22, migration 0065): a week scored on a card that does not score attendance keeps its overall whatever the mark
const NO_ATT = NO_ATTENDANCE_CARDS.map(n => `'${n.replace(/'/g, "''")}'`).join(', ') || "''";
const SCORE = `CASE WHEN s.score_card IN (${NO_ATT}) THEN s.overall ELSE CASE COALESCE(NULLIF(a.master_mark, ''), NULLIF(a.coordinator_mark, ''), NULLIF(a.leader_mark, ''),
                       CASE WHEN cw.batch_id IS NULL THEN NULL WHEN cw.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END,
                       NULLIF(a.devotee_mark, ''), '')
    WHEN 'P' THEN CASE WHEN s.attendance = 100 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + 100 + s.seva) / 4.0))) END
    WHEN 'A' THEN CASE WHEN s.attendance = 0 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + s.seva) / 4.0))) END
    ELSE s.overall END END`;

/** The statement behind scoresOver, for a caller that sends it inside its own reads() batch (Admin › Reports, report.js). */
export function scoresStmt(db, batchIds, first, last) {
  const marks = batchIds.map(() => '?').join(',');
  return q(db, `
    WITH w AS (
      SELECT s.login, s.batch_id, s.week_id, ${SCORE} AS score, 0 AS missed
        FROM submissions s
        LEFT JOIN attendance a ON a.login = s.login AND a.week_id = s.week_id
        LEFT JOIN class_weeks cw ON cw.batch_id = s.batch_id AND cw.week_id = s.week_id
       WHERE s.week_id BETWEEN ? AND ? AND s.batch_id IN (${marks})
      UNION ALL
      -- a missed week scores 0 (decision 45) — unless it was reopened and is still open, or filled after all
      SELECT x.login, x.batch_id, x.week_id, 0, 1
        FROM missed_weeks x
       WHERE x.batch_id IN (${marks}) AND x.week_id BETWEEN ? AND ?
         AND NOT EXISTS (SELECT 1 FROM submissions s2 WHERE s2.login = x.login AND s2.week_id = x.week_id)
         AND NOT EXISTS (SELECT 1 FROM reopens r WHERE r.login = x.login AND r.week_id = x.week_id AND r.state = 'OPEN'))
    SELECT w.login, ac.name, MAX(w.batch_id) AS batch_id, COUNT(*) AS weeks, SUM(w.missed) AS missed, SUM(w.score) AS total
      FROM w JOIN accounts ac ON ac.login = w.login
     WHERE w.login NOT LIKE 'deleted-%'
     GROUP BY w.login`, first, last, ...batchIds, ...batchIds, first, last);
}
async function scoresOver(db, batchIds, first, last) {
  if (!batchIds.length || last < first) return [];
  return (await scoresStmt(db, batchIds, first, last).all()).results;
}

/** Highest first; equal scores share a place (two 4ths, then 6th), by name within it. */
export function rank(rows) {
  const out = rows.map(r => ({ login: r.login, name: r.name, batchId: r.batch_id, weeks: r.weeks, missed: r.missed,
                               score: Math.round(r.total / r.weeks) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  out.forEach((r, i) => { r.rank = i && out[i - 1].score === r.score ? out[i - 1].rank : i + 1; });
  return out;
}

/** The ranked list, for staff: a batch of theirs (the head: any, or all of IYF). */
export async function leaderboardGet(d, ctx) {
  const db = ctx.db, closed = await lastClosedWeek(db, ctx.now());
  const win = windowOfPeriod(d, closed);
  let batchIds;
  if (d.batchId) {
    const id = String(d.batchId);
    if (!(await scopeBatches(db, ctx)).includes(id)) throw apiError('FORBIDDEN', 'That batch is not yours.');
    batchIds = [id];
  } else {
    // "All batches" (Phase 22 F2, 26 Oct 2026): the head — every class batch of IYF Delhi; a coordinator — every
    // class batch they hold, ranked together. A training's people are scored in their own batch, never in the
    // training, so trainings stay out of both (the route's own rule, routes.js /leaderboard).
    const mine = ctx.scopes.master ? null : new Set(await scopeBatches(db, ctx));
    batchIds = (await batchesAll(db)).filter(b => !isTraining(b) && (!mine || mine.has(b.batch_id))).map(b => b.batch_id);
    if (!batchIds.length) throw apiError('FORBIDDEN', 'A leaderboard is for a class batch you coordinate.');
  }
  const ranked = rank(await scoresOver(db, batchIds, win.first, win.last));
  const page = Math.max(0, Math.floor(Number(d.page) || 0));
  return { period: win.period, label: win.label, from: win.first, to: win.last, lastClosedWeek: closed,
           batchId: d.batchId ? String(d.batchId) : '', total: ranked.length,
           page, pages: Math.max(1, Math.ceil(ranked.length / PAGE)), rows: ranked.slice(page * PAGE, (page + 1) * PAGE) };
}

/** A devotee's own place in their batch for the last closed week: a position, never anybody else's name or score. */
export async function leaderboardMine(d, ctx) {
  const db = ctx.db, batchId = ctx.scopes.devotee?.batchId;
  if (!batchId) throw apiError('FORBIDDEN', 'You are not in a batch.');
  const weekId = await lastClosedWeek(db, ctx.now());
  const ranked = rank(await scoresOver(db, [batchId], weekId, weekId));
  const me = ranked.find(r => r.login === ctx.login);
  return { weekId, batchId, rank: me ? me.rank : null, of: ranked.length, score: me ? me.score : null };
}
