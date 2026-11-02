// Who is ready for the next level — computed here, from this app's own data (the head, 17 Oct 2026).
//
// The dashboard does not compute this: readEligibleDevotees_() READS a column from an Eligibility
// tab that somebody else's formulas fill, so the rule lives in spreadsheet cells where it cannot be
// tested and drifts unnoticed. Every input it needs is already a column this app owns, so the rule
// becomes code with tests around it.
//
// THE RULE THAT MATTERS MOST: a missing number counts as NOT YET, never as a pass. Somebody with no
// weeks submitted has not met a threshold — they have not been measured. Treating a blank as a pass
// would promote people on evidence nobody has.
//
// The criteria are per BATCH (promotion_criteria), defaulting to the standard set for its level, so
// a stricter batch is possible without disturbing anyone else.
import { q, all, one, audit, dirty, reads, rows as allRows } from './db.js';
import { apiError, invalid, isoIst, cleanName } from './util.js';
import { requireBatch } from './requests.js';
import { nextLevels } from './closing.js';

/*
 * The standard set, as the dashboard's PROMOTION_RULES states it (DataService.gs:346).
 *
 *   att    attendance, as a fraction of the classes actually HELD — a cancelled class or a festival
 *          week counts against nobody (the head, 17 Oct 2026)
 *   chant  chanting rounds
 *   sad    the sadhana score the app already works out at submit
 *   night  night stay answered "YES", as a fraction of the weeks submitted
 *   cls    class attendance, the same mark as `att` but averaged as a score
 *   pr     the four regulative principles, answered YES
 */
// Promotion is measured up to DPS and no further, and TRD is left out altogether (the head,
// 18 Oct 2026): a temple resident is not on the batch ladder, and BSS/BVS are not promoted FROM by
// these figures. A level with no row here gets {} — no criteria, so `ready` stays false for everyone
// in it rather than everyone being declared eligible. That is deliberate, and `promotion.test.mjs`
// holds it: a batch nobody is promoted out of must never produce an eligible list.
export const STANDARD = {
  VL2: { att: 0.5 },
  VL3: { att: 0.5, chant: 4 },
  SPS: { sad: 80, night: 0.8, cls: 80, chant: 8, pr: 'YES' },
  DPS: { sad: 80, night: 0.8, cls: 80, chant: 12, pr: 'YES' },
  BSS: { sad: 80, night: 0.8, cls: 80, chant: 12, pr: 'YES' }
};
/** Levels promotion is measured for. TRD, BVS and anything else are not on the ladder. */
export const MEASURED = ['VL2', 'VL3', 'SPS', 'DPS', 'BSS'];
export const LABEL = { att: 'Attendance', chant: 'Chanting rounds', sad: 'Sadhana average',
                       night: 'Night stay', cls: 'Class attendance', pr: '4 regulative principles' };

/** The criteria a batch is judged by: its own rows, else the standard set for its level. */
export async function criteriaFor(db, batchId, level) {
  return criteriaFrom(await all(db, 'SELECT criterion, min_value FROM promotion_criteria WHERE batch_id = ?', batchId), level);
}
/** A batch's criteria from its promotion_criteria rows: its own when it has any, else the standard set for its level. */
export function criteriaFrom(rows, level) {
  if (rows.length) return Object.fromEntries(rows.map(r => [r.criterion, r.criterion === 'pr' ? r.min_value : Number(r.min_value)]));
  return STANDARD[String(level || '').toUpperCase()] || {};
}

/**
 * One devotee's figures over a window, from what they have submitted.
 *
 * Everything here is `null` when there is nothing to measure, and a null never passes. That is the
 * whole safety of this file: `null >= 80` is false in JavaScript, but relying on that would be
 * luck, so every check below asks `x !== null && x >= min` in so many words.
 */
export async function figuresFor(db, login, batchId, from, to) {
  // the two aggregates read nothing from each other: one round trip (22 Oct 2026, B1)
  const [s, a] = await reads(db, [
    q(db, `SELECT COUNT(*) AS weeks,
                  AVG(overall) AS sad, AVG(avg_rounds) AS chant, AVG(attendance) AS cls,
                  SUM(night_stay = 'YES') AS nights, SUM(principles = 'YES') AS prs
             FROM submissions WHERE login = ? AND week_id >= ? AND week_id <= ?`, login, from, to),
    // attendance as a fraction of the classes actually HELD: a week with no class counts for nobody
    q(db, `SELECT COUNT(*) AS held, SUM(mark_used = 'P') AS present
             FROM attendance WHERE login = ? AND batch_id = ? AND week_id >= ? AND week_id <= ?
              AND mark_used <> ''`, login, batchId, from, to)]);
  return figuresFrom(s, a);
}

/*
 * The same figures for MANY people over one window, in one round trip (22 Oct 2026, G6). The per-person loop cost two
 * round trips a member — 1,255 for a 625-person batch, past what one request can do. These are the same two
 * aggregates, grouped by login, so they read the same rows; the IN list goes in chunks of 90 (D1 binds at most 100).
 *
 * `figureReads` gives the statements, to send in a `reads()` batch with anything else; `figuresFromReads` turns the
 * answers (in the same order) into `(login, batchId) => figures`, exactly what figuresFor returns for that person.
 */
export function figureReads(db, logins, from, to) {
  const out = [];
  for (let i = 0; i < logins.length; i += 90) {
    const part = logins.slice(i, i + 90), marks = part.map(() => '?').join(',');
    out.push(
      allRows(q(db, `SELECT login, COUNT(*) AS weeks,
                            AVG(overall) AS sad, AVG(avg_rounds) AS chant, AVG(attendance) AS cls,
                            SUM(night_stay = 'YES') AS nights, SUM(principles = 'YES') AS prs
                       FROM submissions WHERE login IN (${marks}) AND week_id >= ? AND week_id <= ? GROUP BY login`, ...part, from, to)),
      allRows(q(db, `SELECT login, batch_id, COUNT(*) AS held, SUM(mark_used = 'P') AS present
                       FROM attendance WHERE login IN (${marks}) AND week_id >= ? AND week_id <= ?
                        AND mark_used <> '' GROUP BY login, batch_id`, ...part, from, to)));
  }
  return out;
}
export function figuresFromReads(results) {
  const S = new Map(), A = new Map();
  for (let i = 0; i < results.length; i += 2) {
    for (const r of results[i]) S.set(r.login, r);
    for (const r of results[i + 1]) A.set(r.login + '|' + r.batch_id, r);
  }
  return (login, batchId) => figuresFrom(S.get(login), A.get(login + '|' + batchId));
}

/** One person's figures from their two aggregate rows (either may be missing: nothing submitted, no class held). */
export function figuresFrom(s, a) {
  const weeks = s?.weeks || 0;
  const held = a?.held || 0;
  return {
    weeks,
    att: held ? (a.present || 0) / held : null,
    heldClasses: held,
    sad: weeks ? Math.round(s.sad) : null,
    chant: weeks ? Math.round(s.chant * 10) / 10 : null,
    cls: weeks ? Math.round(s.cls) : null,
    night: weeks ? (s.nights || 0) / weeks : null,
    pr: weeks ? ((s.prs || 0) === weeks ? 'YES' : 'NO') : null
  };
}

/** Does one figure meet one threshold? A missing figure never does. */
export function meets(key, got, min) {
  if (got === null || got === undefined) return false;
  if (key === 'pr') return got === min;
  return Number(got) >= Number(min);
}

/**
 * Everyone in a batch, with their figures, which criteria they meet, and whether they are ready.
 *
 * It reports rather than decides: a coordinator promotes somebody, not this function. The head was
 * clear that the board shows who LOOKS promotable from the last week while a promotion weighs the
 * whole history — this is the history half, and it is still a person who acts on it.
 */
export async function eligibleIn(db, batchId, from, to) {
  // the batch, its rules and its members in one round trip, then every member's figures in one more (22 Oct 2026, G6:
  // this was 3 + 2 per member). A batch that does not exist has no rules and no members, so nothing extra is read.
  const [b, critRows, members] = await reads(db, [
    q(db, 'SELECT batch_id, name, level FROM batches WHERE batch_id = ?', batchId),
    allRows(q(db, 'SELECT criterion, min_value FROM promotion_criteria WHERE batch_id = ?', batchId)),
    allRows(q(db, `SELECT m.login, a.name FROM memberships m JOIN accounts a ON a.login = m.login
                    WHERE m.batch_id = ? AND m.to_week = '' AND m.state = 'ACTIVE' ORDER BY a.name`, batchId))]);
  if (!b) return null;
  const crit = criteriaFrom(critRows, b.level);
  const keys = Object.keys(crit);
  const figs = members.length ? figuresFromReads(await reads(db, figureReads(db, members.map(m => m.login), from, to))) : null;
  const rows = [];
  for (const m of members) {
    const f = figs(m.login, batchId);
    const checks = keys.map(k => ({ key: k, label: LABEL[k] || k, min: crit[k], got: f[k], met: meets(k, f[k], crit[k]) }));
    rows.push({ login: m.login, name: m.name, weeks: f.weeks, heldClasses: f.heldClasses,
                checks, ready: checks.length > 0 && checks.every(c => c.met) });
  }
  return { batchId, name: b.name, level: b.level, from, to,
           nextLevels: nextLevels(b.level), criteria: crit, rows };
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

/** Who in this batch meets its criteria. The batch's own coordinator, or the head. */
export async function eligibleList(d, ctx) {
  const db = ctx.db, batchId = String(d.batchId || '');
  await requireBatch(ctx, batchId);
  // the window: given, or everything this batch has. A promotion weighs the whole history, so the
  // default is the whole of it rather than a recent slice (the head, 17 Oct 2026)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(d.from)) ? d.from : '0000-00-00';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(d.to)) ? d.to : '9999-99-99';
  const out = await eligibleIn(db, batchId, from, to);
  if (!out) throw apiError('NOT_FOUND', 'No such batch.');
  return out;
}

/**
 * A batch's promotion rules, for Batch setup to show and edit (ADR 0017). The head's. Light on purpose: the rules and
 * the standard set for its level, never every member's figures (that is eligible.list).
 */
export async function criteriaGet(d, ctx) {
  const db = ctx.db, batchId = String(d.batchId || '');
  // one round trip: a batch that does not exist has no rules, so reading them beside it costs nothing
  const [b, rows] = await reads(db, [q(db, 'SELECT batch_id, level FROM batches WHERE batch_id = ?', batchId),
    allRows(q(db, 'SELECT criterion, min_value FROM promotion_criteria WHERE batch_id = ?', batchId))]);
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  const level = String(b.level || '').toUpperCase();
  const own = Object.fromEntries(rows.map(r => [r.criterion, r.criterion === 'pr' ? r.min_value : Number(r.min_value)]));
  return { batchId, level, measured: MEASURED.includes(level), custom: rows.length > 0,
           criteria: rows.length ? own : (STANDARD[level] || {}), standard: STANDARD[level] || {}, labels: LABEL };
}

/** Set this batch's criteria, or clear them back to the standard set. The head's. */
export async function criteriaSet(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), batchId = String(d.batchId || '');
  const b = await one(db, 'SELECT batch_id, level FROM batches WHERE batch_id = ?', batchId);
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  if (!Array.isArray(d.criteria)) throw invalid({ path: 'criteria', message: 'Give the criteria.' });

  const stmts = [q(db, 'DELETE FROM promotion_criteria WHERE batch_id = ?', batchId)];
  for (const [i, c] of d.criteria.entries()) {
    const key = String(c?.criterion || '');
    if (!LABEL[key]) throw invalid({ path: `criteria.${i}.criterion`, message: 'Not a criterion.' });
    const v = String(c.minValue ?? '').trim();
    if (key === 'pr' ? !['YES', 'NO'].includes(v) : !/^\d+(\.\d+)?$/.test(v)) {
      throw invalid({ path: `criteria.${i}.minValue`, message: key === 'pr' ? 'YES or NO.' : 'A number.' });
    }
    stmts.push(q(db, `INSERT INTO promotion_criteria (batch_id, criterion, min_value, set_by, set_at) VALUES (?, ?, ?, ?, ?)`,
      batchId, key, v, ctx.login, at));
  }
  await db.batch([...stmts,
    audit(db, ctx, 'criteria.set', batchId, batchId, null, { count: d.criteria.length }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'promotion_criteria', 'audit_log')]);
  // empty means "back to the standard set for this level", which is why it is allowed
  return { batchId, criteria: await criteriaFor(db, batchId, b.level), standard: d.criteria.length === 0 };
}
