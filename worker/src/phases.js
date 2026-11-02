// Phases, target cards and what people fill in them (the head, 17 Oct 2026).
//
// The facilitation side moves into the app. The head opens a phase ("Kartik Phase", September to
// December); each facilitator and each ETP student holds a CARD of eleven lead measures against
// targets, fills it week by week, and is scored.
//
// ETP students fill the SAME card as a facilitator — they are training to become one, so they
// practise the real thing. There is one measure model here, not two.
//
// Two numbers that must not be confused, and the head drew the line himself:
//   · the SCOREBOARD answers "who is doing well right now" and looks at the LAST WEEK;
//   · a PROMOTION answers "has this person earned the move" and weighs the WHOLE HISTORY.
// They are computed separately below for that reason.
import { apiError, invalid, isoIst, cleanName } from './util.js';
import { q, one, all, audit, dirty, scopeBatches, reads, rows as allRows } from './db.js';
import { validWeekId } from './weeks.js';
import { requireBatch } from './requests.js';
import { focusWeek } from './staff.js';
import { mondayOf } from './util.js';
import { vedicLevel, nextLevels } from './closing.js';
import { criteriaFrom, figureReads, figuresFromReads, meets } from './eligible.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------------ */
/* Phases                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Open a phase. The head's, and the dates are theirs to choose: three four-month phases is the
 * convention, not a rule the app enforces — a phase may start a week early or late, exactly as a
 * Vedic intake is closed by a person rather than by a timer (ADR 0009).
 */
export async function phaseOpen(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now());
  const id = String(d.phaseId || '').trim().toLowerCase();
  const name = cleanName(d.name || ''), starts = String(d.startsOn || ''), ends = String(d.endsOn || '');
  const problems = [];
  if (!/^[a-z][a-z0-9-]{2,31}$/.test(id)) problems.push({ path: 'phaseId', message: 'Letters, digits and hyphens, e.g. kartik-2026.' });
  else if (await one(db, 'SELECT 1 AS x FROM phases WHERE phase_id = ?', id)) problems.push({ path: 'phaseId', message: `There is already a phase ${id}.` });
  if (name.length < 2 || name.length > 40) problems.push({ path: 'name', message: 'Give the phase a name.' });
  if (!YMD.test(starts)) problems.push({ path: 'startsOn', message: 'A date, as 2026-09-01.' });
  if (!YMD.test(ends)) problems.push({ path: 'endsOn', message: 'A date, as 2026-12-31.' });
  if (YMD.test(starts) && YMD.test(ends) && ends <= starts) problems.push({ path: 'endsOn', message: 'The phase must end after it starts.' });
  if (problems.length) throw invalid(problems);

  const year = Number(starts.slice(0, 4));
  await db.batch([
    q(db, `INSERT INTO phases (phase_id, name, season_year, starts_on, ends_on, state, opened_by, opened_at)
           VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`, id, name, year, starts, ends, ctx.login, at),
    audit(db, ctx, 'phases.open', id, '', null, { name, startsOn: starts, endsOn: ends }, '', req.requestId),
    dirty(db, 'phases', 'audit_log')]);
  return { phaseId: id, name, startsOn: starts, endsOn: ends, state: 'OPEN' };
}

/**
 * Edit a phase from Admin (the head, 22 Oct 2026: "set the phases on which the organisation functions — add, edit and
 * all from the app"). The dates are the head's: a phase may start a week early or late (ADR 0009), and every window
 * that reads them — a facilitator's card, the goal's eligibility count, the board — follows on the next read, because
 * none of them is stored. Stored week scores are never rewritten (ADR 0004).
 *
 * A CLOSED phase is a record: its name may be corrected, its dates not — moving them would change what its frozen
 * cards were measured over.
 */
export async function phaseUpdate(d, ctx, req) {
  const db = ctx.db, id = String(d.phaseId || '');
  const p = await one(db, 'SELECT * FROM phases WHERE phase_id = ?', id);
  if (!p) throw apiError('NOT_FOUND', 'No such phase.');
  const name = cleanName(d.name ?? p.name), starts = String(d.startsOn ?? p.starts_on), ends = String(d.endsOn ?? p.ends_on);
  // ADR 0018: the last day a set target may change ('' = the end of each person's first week)
  const tu = String(d.targetsUntil ?? p.targets_until ?? '');
  const problems = [];
  if (tu && !YMD.test(tu)) problems.push({ path: 'targetsUntil', message: 'A date, as 2026-09-07, or leave it empty.' });
  if (name.length < 2 || name.length > 40) problems.push({ path: 'name', message: 'Give the phase a name.' });
  if (!YMD.test(starts)) problems.push({ path: 'startsOn', message: 'A date, as 2026-09-01.' });
  if (!YMD.test(ends)) problems.push({ path: 'endsOn', message: 'A date, as 2026-12-31.' });
  if (YMD.test(starts) && YMD.test(ends) && ends <= starts) problems.push({ path: 'endsOn', message: 'The phase must end after it starts.' });
  if (problems.length) throw invalid(problems);
  if (p.state === 'CLOSED' && (starts !== p.starts_on || ends !== p.ends_on)) {
    throw apiError('CONFLICT', `${p.name} is closed, so its dates are a record and cannot be moved.`);
  }
  const year = Number(starts.slice(0, 4));
  await db.batch([
    q(db, 'UPDATE phases SET name = ?, season_year = ?, starts_on = ?, ends_on = ?, targets_until = ? WHERE phase_id = ?', name, year, starts, ends, tu, id),
    audit(db, ctx, 'phases.update', id, '', { name: p.name, startsOn: p.starts_on, endsOn: p.ends_on, targetsUntil: p.targets_until || '' },
      { name, startsOn: starts, endsOn: ends, targetsUntil: tu }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'phases', 'audit_log')]);
  return { phaseId: id, name, seasonYear: year, startsOn: starts, endsOn: ends, targetsUntil: tu, state: p.state };
}

/** Close a phase. Its cards stay readable for ever; closing only stops new filling. */
export async function phaseClose(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), id = String(d.phaseId || '');
  const p = await one(db, 'SELECT * FROM phases WHERE phase_id = ?', id);
  if (!p) throw apiError('NOT_FOUND', 'No such phase.');
  if (p.state === 'CLOSED') throw apiError('CONFLICT', `${p.name} was closed on ${p.closed_at.slice(0, 10)}.`);
  await db.batch([
    q(db, "UPDATE phases SET state = 'CLOSED', closed_by = ?, closed_at = ? WHERE phase_id = ?", ctx.login, at, id),
    audit(db, ctx, 'phases.close', id, '', { state: 'OPEN' }, { state: 'CLOSED' }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'phases', 'audit_log')]);
  return { phaseId: id, state: 'CLOSED', closedAt: at };
}

/** Every phase, newest first. The open one is what a card is filled against. */
export async function phaseList(d, ctx) {
  const rows = await all(ctx.db, 'SELECT * FROM phases ORDER BY starts_on DESC LIMIT 24');
  return { phases: rows.map(p => ({ phaseId: p.phase_id, name: p.name, seasonYear: p.season_year,
    startsOn: p.starts_on, endsOn: p.ends_on, targetsUntil: p.targets_until || '', state: p.state, openedBy: p.opened_by, closedAt: p.closed_at || '' })) };
}

/** One phase's dates, by id (what phaseAverage and stagesOf are measured over). */
// a card key: a phase's id (a facilitator's card), or a training batch's (a trainee's — Phase 22, J1: TRAINING_CARD_SQL)
const phaseRow = async (db, key, today = isoIst(new Date()).slice(0, 10)) =>
  (await one(db, 'SELECT phase_id, name, starts_on, ends_on, state, targets_until FROM phases WHERE phase_id = ?', key))
  || trainingByKey(await one(db, TRAINING_BATCH_SQL, key), today);

/** The phase a date falls in: the open one covering it, else none. */
export async function currentPhase(db, onDate) {
  return one(db, CURRENT_PHASE_SQL, onDate, onDate);
}

/* ------------------------------------------------------------------------ */
/* The card                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * The window a person's card runs for (the head, 17 Oct 2026).
 *
 *   a FACILITATOR  → the phase. Kartik runs September to December, and so does their card.
 *   an ETP STUDENT → their TRAINING BATCH's own duration, from the day it started until the
 *                    coordinator closes it.
 *
 * The distinction is not tidiness. A training that begins in December would otherwise open on a
 * four-month card already three months over, and the student would be scored against weeks that
 * happened before they joined.
 *
 * A phase still names the period for both, so the two can be read side by side; what changes is the
 * window that card is filled and averaged over.
 */
/*
 * TWO ROUTES, TWO KINDS OF CARD (Phase 22, J1; the head, 26 Oct 2026): "these are 2 different scopes although they have
 * the same pattern — the ETP way and the FTP way are 2 different routes: one is the full-time official facilitators'
 * route, which works on phases, and ETP is on custom dates as defined when starting a batch and ending a batch."
 *
 *   a FACILITATOR (FTP)  → the PHASE's card: keyed by the phase id, over the phase's dates — exactly as before.
 *   a TRAINEE (ETP)      → the TRAINING's card: keyed by the training batch id ('ETP-21'), over the training's own dates —
 *                          from started_on to ends_on, or to the day it was ended if earlier (with no end date yet, to
 *                          today). One continuous card: never clipped by, split by or keyed to a phase.
 *
 * The card tables keep their `phase_id` column; it is the card's key (migration 0068 re-keyed the trainees' rows). A
 * training's card is handed around as a "phase" of its own (trainingCard), so everything below reads both alike.
 *
 * Whose card is a training's — the three states the head set (18 Oct 2026), unchanged:
 *   ACTIVE                in the training now      → its card, open
 *   ENDED, batch closed   the training finished    → its card, a frozen RECORD (unless they facilitate in their own
 *                                                    right — facilitation 'lasting' — when the phase's card is theirs)
 *   ENDED, batch open     they were TAKEN OUT      → no training card at all
 */
const TRAINING_CARD_SQL = `SELECT b.batch_id, b.name, b.started_on, b.ends_on, b.closed_at
                             FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
                            WHERE e.login = ? AND b.started_on <> ''
                              AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting'))
                            ORDER BY (e.state = 'ACTIVE') DESC, e.id DESC LIMIT 1`;
const TRAINING_BATCH_SQL = `SELECT batch_id, name, started_on, ends_on, closed_at FROM batches WHERE batch_id = ? AND started_on <> ''
                              AND batch_id IN (SELECT batch_id FROM enrolments)`;
const CURRENT_PHASE_SQL = "SELECT * FROM phases WHERE state = 'OPEN' AND starts_on <= ? AND ends_on >= ? ORDER BY starts_on DESC";
/** A training batch row → its card, shaped as a phase: keyed by the batch id, over the training's own dates. */
export function trainingCard(b, today) {
  const ended = b.closed_at ? b.closed_at.slice(0, 10) : '';
  const to = ended ? (b.ends_on && b.ends_on < ended ? b.ends_on : ended) : b.ends_on || today;
  return { phase_id: b.batch_id, name: b.name, season_year: 0, starts_on: b.started_on, ends_on: to, state: 'OPEN',
           targets_until: '', training: true, batch_id: b.batch_id, closed: !!b.closed_at, planned_end: b.ends_on || '' };
}
const trainingByKey = (b, today) => (b ? trainingCard(b, today) : null);
/**
 * The card a person keeps, in one round trip. `key` is what a card reply's phaseId said — a phase id or a training's:
 *   · a training they were in (running, or ended and closed)  → that training's card (a finished one stays a record)
 *   · otherwise, their training's card if they have one        → whatever phase is asked, a trainee's card is the training's
 *   · otherwise the phase asked for, else the current one      → a facilitator's card
 */
const TRAINING_OF_SQL = `SELECT b.batch_id, b.name, b.started_on, b.ends_on, b.closed_at
                           FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
                          WHERE e.login = ? AND b.batch_id = ? AND b.started_on <> '' AND (e.state = 'ACTIVE' OR b.closed_at <> '')
                          ORDER BY e.id DESC LIMIT 1`;
export async function cardFor(db, login, key, today) {
  const [named, m, ph] = await reads(db, [key ? q(db, TRAINING_OF_SQL, login, key) : q(db, 'SELECT NULL AS none WHERE 0'),
    q(db, TRAINING_CARD_SQL, login),
    key ? q(db, 'SELECT * FROM phases WHERE phase_id = ?', key) : q(db, CURRENT_PHASE_SQL, today, today)]);
  if (named) return trainingCard(named, today);
  return m ? trainingCard(m, today) : ph || null;
}
/** The window a card runs over: a training's own dates, or the phase's. (`login` kept for the callers' signature.) */
export async function cardWindow(db, login, phase) { return windowFrom(phase); }
function windowFrom(phase) {
  if (phase.training) return { from: phase.starts_on, to: phase.ends_on, batchId: phase.batch_id, kind: 'batch', closed: phase.closed };
  return { from: phase.starts_on, to: phase.ends_on, batchId: '', kind: 'phase', closed: false };
}

/** The eleven measures, in order. Cached per request: every card read asks for them. */
const MEASURES_SQL = 'SELECT * FROM measures WHERE active = 1 ORDER BY seq';
export const measures = db => all(db, MEASURES_SQL);
/** The last week they submitted, up to the card's week: what the app offers for Sadhna. */
const OFFER_SQL = 'SELECT week_id, overall FROM submissions WHERE login = ? AND week_id <= ? ORDER BY week_id DESC LIMIT 1';

/*
 * A measure as the person holding the card sees it. One slot is SAID differently to the two
 * audiences — a facilitator reports FTP training attendance, a trainee reports ETP attendance
 * (the head, 17 Oct 2026) — while remaining one measure, so the two are still comparable and a
 * trainee's history follows them when they qualify.
 */
const measureView = (m, etp) => ({ measureId: m.measure_id, seq: m.seq,
  label: etp && m.etp_label ? m.etp_label : m.label, frequency: m.frequency, group: m.grp || '',
  kind: m.kind, unit: m.unit, fromApp: m.source === 'week_score' });
/** The card's groups, in the order the head's paper card draws them (ADR 0012 G; `measures.grp`, migration 0059). */
export const CARD_GROUPS = [{ id: 'sadhana', label: 'Sadhna' }, { id: 'vl2reg', label: 'Vedic Level 2 registration' }, { id: 'target', label: 'Target' }];

/**
 * One person's card for a phase: every measure, their target, and what they have filled.
 *
 * `offered` on a measure is the number the app can fill for them — today only Sadhna, from the week
 * they already submitted. It is an OFFER: they may type over it, and `fills.source` then records
 * which of the two the stored figure is. A figure the app worked out and a figure somebody typed
 * are not the same evidence, so they are never printed alike.
 */
export async function cardOf(db, login, phaseId, weekId, isTrainee = false) {
  // one round trip (22 Oct 2026, B1). The offer's submission is read beside the rest; it is used only when a
  // measure is filled from the week, which the card always has
  const [ms, tg, fl, s] = await reads(db, [
    allRows(q(db, MEASURES_SQL)),
    allRows(q(db, 'SELECT measure_id, target, per_level FROM targets WHERE login = ? AND phase_id = ?', login, phaseId)),
    allRows(q(db, 'SELECT measure_id, value, source, week_id FROM fills WHERE login = ? AND phase_id = ?', login, phaseId)),
    q(db, OFFER_SQL, login, weekId)]);
  return cardFrom(ms, tg, fl, s, weekId, isTrainee);
}
/** The card's measures from what cardOf reads (shared with the many-people read). */
function cardFrom(ms, tg, fl, s, weekId, isTrainee) {
  const tByM = Object.fromEntries(tg.map(t => [t.measure_id, t]));
  const thisWeek = Object.fromEntries(fl.filter(f => f.week_id === weekId).map(f => [f.measure_id, f]));
  /*
   * A MONTHLY measure is judged once per month (ADR 0012), so its row shows the month so far against the target, not
   * only this week's figure (phase 21, the head: "the targets and weekly input against that targets can be seen as
   * separate"): numbers added up over the month's weeks, a Yes/No met if ticked in any week of it — as monthPct counts.
   * A week belongs to the month its Monday is in.
   */
  const ym = String(weekId || '').slice(0, 7), inMonth = fl.filter(f => f.week_id.slice(0, 7) === ym);
  const monthValue = (m) => {
    const vs = inMonth.filter(f => f.measure_id === m.measure_id).map(f => f.value);
    if (!vs.length) return '';
    if (m.kind === 'YESNO') return vs.includes('YES') ? 'YES' : 'NO';
    return String(vs.reduce((n, v) => n + (Number.isFinite(Number(v)) ? Number(v) : 0), 0));
  };

  /*
   * What the app can offer for Sadhna: THE LAST WEEK they submitted (the head, 17 Oct 2026).
   *
   * Not this week's. A card is filled DURING the week it belongs to, and that week has not been
   * submitted yet — reading it would offer nothing almost every time somebody opened their card.
   * Last week's is a real score they have already earned, which is what the dashboard's Sadhna
   * figure is.
   *
   * It is still an OFFER: `fills.source` records whether the stored number is the one the app
   * worked out or one they typed over it, so the two are never printed alike.
   */
  let offered = null, offeredWeek = '';
  if (ms.some(m => m.source === 'week_score')) {
    if (s) { offered = Math.round(s.overall); offeredWeek = s.week_id; }
  }
  return {
    weekId,
    measures: ms.map(m => ({
      ...measureView(m, isTrainee),
      target: tByM[m.measure_id]?.target ?? '',
      perLevel: tByM[m.measure_id]?.per_level ? JSON.parse(tByM[m.measure_id].per_level) : null,
      value: thisWeek[m.measure_id]?.value ?? '',
      source: thisWeek[m.measure_id]?.source ?? '',
      // null when there is nothing to offer: an unfilled week offers nothing and they simply type it
      offered: m.source === 'week_score' ? offered : null,
      offeredWeek: m.source === 'week_score' ? offeredWeek : '',
      ...(m.frequency === 'MONTHLY' ? { monthValue: monthValue(m) } : {})
    })),
    filledWeeks: [...new Set(fl.map(f => f.week_id))].sort()
  };
}

/* ------------------------------------------------------------------------ */
/* Filling the card                                                          */
/* ------------------------------------------------------------------------ */

/** A value the measure's kind allows: a whole number, a Yes/No, or a per-level block. */
function cleanValue(kind, v, path) {
  if (kind === 'YESNO') {
    if (v !== 'YES' && v !== 'NO') throw invalid({ path, message: 'Choose Yes or No.' });
    return v;
  }
  if (kind === 'NUMBER' || kind === 'PER_LEVEL') {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100000 || String(v).trim() === '') throw invalid({ path, message: 'A whole number, 0 or more.' });
    return String(Math.round(n));
  }
  throw invalid({ path, message: 'Not a measure this card holds.' });
}

/**
 * Fill a week of the card — one's own, always. A coordinator does not fill somebody's card for
 * them: the figures are that person's own report, and a card filled by someone else would not mean
 * what the board says it means.
 *
 * `source` separates the Sadhna the app offered from a number they typed over it, so the board can
 * say which it is holding rather than printing them alike.
 */
export async function cardFill(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), login = ctx.login;
  // their card: a trainee's training's (its own dates), a facilitator's phase's (Phase 22, J1)
  const phase = String(d.phaseId || '') ? await cardFor(db, login, String(d.phaseId), at.slice(0, 10)) : null;
  if (!phase) throw apiError('NOT_FOUND', 'No such phase.');
  if (phase.state !== 'OPEN') throw apiError('WINDOW_CLOSED', `${phase.name} is closed; its cards cannot be changed.`);
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  // bounded by THEIR window: a facilitator's is the phase, an ETP student's is their training batch
  const win = await cardWindow(db, login, phase);
  /*
   * A FINISHED training is frozen (the head, 17 Oct 2026). Its card stays readable — to the admin
   * and to that batch's own ETP coordinator — but nobody edits it: what somebody filled during
   * their training is a record of what happened, and a record that can be rewritten afterwards is
   * not one.
   *
   * The admin may unlock one card when there is a real correction. The unlock names who allowed it
   * and why, and expires, so an opened card does not stay open by forgetting.
   */
  if (win.closed) {
    const u = await one(db, 'SELECT until FROM card_unlocks WHERE batch_id = ? AND login = ?', win.batchId, login);
    if (!u || u.until < at) throw apiError('WINDOW_CLOSED', 'Your training is finished; its card is a record now. Ask the IYF head if something needs correcting.');
  }
  if (d.weekId < win.from || d.weekId > win.to) {
    throw invalid({ path: 'weekId', message: win.kind === 'batch'
      ? 'That week is outside your training.' : `That week is outside ${phase.name}.` });
  }
  if (!Array.isArray(d.values) || !d.values.length) throw invalid({ path: 'values', message: 'Fill at least one measure.' });

  const ms = Object.fromEntries((await measures(db)).map(m => [m.measure_id, m]));
  const stmts = [];
  for (const [i, v] of d.values.entries()) {
    const m = ms[String(v?.measureId || '')];
    if (!m) throw invalid({ path: `values.${i}.measureId`, message: 'Not a measure this card holds.' });
    const value = cleanValue(m.kind, v.value, `values.${i}.value`);
    // 'app' only where the app has something to offer, and only if they did not change it
    const src = m.source === 'week_score' && v.source === 'app' ? 'app' : 'typed';
    stmts.push(q(db, `INSERT INTO fills (phase_id, login, measure_id, week_id, value, source, filled_by, filled_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                      ON CONFLICT(phase_id, login, measure_id, week_id)
                      DO UPDATE SET value = excluded.value, source = excluded.source, filled_by = excluded.filled_by, filled_at = excluded.filled_at`,
      phase.phase_id, login, m.measure_id, d.weekId, value, src, login, at));
  }
  await db.batch([...stmts,
    audit(db, ctx, 'card.fill', login, '', null, { phaseId: phase.phase_id, weekId: d.weekId, measures: d.values.length }, '', req.requestId),
    dirty(db, 'fills', 'audit_log')]);
  // a trainee's card says ETP attendance where a facilitator's says FTP training attendance
  return await cardOf(db, login, phase.phase_id, d.weekId, win.kind === 'batch');
}

/*
 * WHEN TARGETS ARE FIXED (phase 21, 23 Oct 2026 — ADR 0018; the head: "defining the targets happens in the phase
 * beginning only not afterwards").
 *
 * A target set at the start is a commitment; one moved in week ten to meet what was done is not. So a target already
 * set may change only until `targetsUntil`: the phase's own date if the head set one, else the end of the first week
 * of that person's card (a facilitator's starts with the phase, a trainee's with their training). After it:
 *   · a target that was NEVER set may still be set — somebody who starts mid-phase, or a Yes/No measure the screen
 *     could not take before this phase;
 *   · a set one is fixed, unless the head has opened that person's targets (target_unlocks: 7 days, with a reason).
 */
const plusDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const targetsUntil = (phase, win) => phase.targets_until || plusDays(win.from, 6);
/** Whether a person's set targets may change at `now`: before the date, or while the head has opened them. */
export function targetsLock(phase, win, unlock, now) {
  const until = targetsUntil(phase, win), at = isoIst(now);
  const openedUntil = unlock && unlock.until >= at ? unlock.until : '';
  return { until, open: at.slice(0, 10) <= until || !!openedUntil, openedUntil };
}
const lockedMessage = (phase, lock) => `Your targets for ${phase.name} were fixed after ${lock.until}. Ask the IYF head to open them if one must change.`;

/**
 * Set MY targets for a phase (the head, 17 Oct 2026).
 *
 * The targets are the person's own: "targets are taken by ETP members and facilitators only, and
 * targets are what they feel is feasible". The MEASURES are fixed, read from the dashboard's card
 * and seeded in migration 0052; what somebody commits to against each, for this phase, is theirs.
 *
 * So this writes the CALLER's targets and takes no login. Nobody sets another person's: a target
 * somebody else chose is not a commitment, and the board would be scoring a person against a number
 * they never agreed to.
 */
export async function targetsSet(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), login = ctx.login;
  // a trainee's targets are their training card's: fixed after its first week, not the phase's (ADR 0018; J1)
  const phase = String(d.phaseId || '') ? await cardFor(db, login, String(d.phaseId), at.slice(0, 10)) : null;
  if (!phase) throw apiError('NOT_FOUND', 'No such phase.');
  if (phase.state !== 'OPEN') throw apiError('CONFLICT', `${phase.name} is closed.`);
  if (!Array.isArray(d.targets) || !d.targets.length) throw invalid({ path: 'targets', message: 'Set at least one target.' });

  // the measures, what they have already set and any unlock, in one round trip; then their card's window (ADR 0018)
  const [msRows, setRows, unlock] = await reads(db, [allRows(q(db, MEASURES_SQL)),
    allRows(q(db, 'SELECT measure_id, target, per_level FROM targets WHERE phase_id = ? AND login = ?', phase.phase_id, login)),
    q(db, 'SELECT until FROM target_unlocks WHERE phase_id = ? AND login = ?', phase.phase_id, login)]);
  const lock = targetsLock(phase, await cardWindow(db, login, phase), unlock, ctx.now());
  const ms = Object.fromEntries(msRows.map(m => [m.measure_id, m]));
  const was = Object.fromEntries(setRows.filter(r => r.target !== '' || r.per_level).map(r => [r.measure_id, r]));
  const stmts = [];
  for (const [i, t] of d.targets.entries()) {
    const m = ms[String(t?.measureId || '')];
    if (!m) throw invalid({ path: `targets.${i}.measureId`, message: 'Not a measure this card holds.' });
    // a per-level measure carries a block (VL-3 / SPS / DPS-BSS), the rest a single figure
    const perLevel = m.kind === 'PER_LEVEL' && t.perLevel && typeof t.perLevel === 'object' ? JSON.stringify(t.perLevel) : '';
    const target = m.kind === 'YESNO' ? 'YES' : String(t.target ?? '').trim();
    if (m.kind !== 'YESNO' && !perLevel && !/^\d{1,6}$/.test(target)) {
      throw invalid({ path: `targets.${i}.target`, message: 'A whole number.' });
    }
    // fixed once the start of the phase is over: a target never set may still be set, a set one may not move
    const prev = was[m.measure_id];
    if (!lock.open && prev && (prev.target !== target || (prev.per_level || '') !== perLevel)) throw apiError('WINDOW_CLOSED', lockedMessage(phase, lock));
    stmts.push(q(db, `INSERT INTO targets (phase_id, login, measure_id, target, per_level, set_by, set_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?)
                      ON CONFLICT(phase_id, login, measure_id)
                      DO UPDATE SET target = excluded.target, per_level = excluded.per_level, set_by = excluded.set_by, set_at = excluded.set_at`,
      phase.phase_id, login, m.measure_id, target, perLevel, ctx.login, at));
  }
  await db.batch([...stmts,
    audit(db, ctx, 'targets.set', login, '', null, { phaseId: phase.phase_id, measures: d.targets.length }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'targets', 'audit_log')]);
  return { login, phaseId: phase.phase_id, set: d.targets.length };
}

/* ------------------------------------------------------------------------ */
/* The score                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * How close one week's filling came to the targets, 0–100.
 *
 * A number is capped at its target (120 of 100 is 100, not 120, or one runaway measure carries a
 * card that is otherwise empty). A Yes/No is all or nothing.
 *
 * A measure with NO TARGET is left out rather than counted as zero — the same distinction the
 * dashboard draws and the reason its score is an average of the parts that exist. Someone was not
 * asked to do a thing; failing them for it would be a lie about their week.
 */
/*
 * The three figures a facilitator is measured on (ADR 0012, 22 Oct 2026, from the head's Excel card):
 *   weekPct     a WEEK's seva: the weekly lead measures only. Sadhna is sadhana, not seva (the dashboard's
 *               SEVA_MEASURES leaves it out), and the four MONTHLY measures wait for their month — before this,
 *               both were scored every week, so the monthly four read 0 for three weeks of every month.
 *   monthPct    a MONTH's monthly measures, counted once: numbers added up across the month's weeks, a Yes/No
 *               met if ticked in any week of it.
 *   sadhanaPct  the average of their weekly Sadhna (already out of 100 — never measured against a target).
 */
const weekly = (m) => m.frequency !== 'MONTHLY' && m.source !== 'week_score';
export function weekPct(measures, targets, fills) {
  const parts = [];
  for (const m of measures) {
    if (!weekly(m)) continue;
    const t = targets[m.measure_id];
    if (!t || t.target === '' ) continue;                       // not asked of them
    const f = fills[m.measure_id];
    if (m.kind === 'YESNO') { parts.push(f?.value === 'YES' ? 100 : 0); continue; }
    const target = Number(t.target);
    if (!Number.isFinite(target) || target <= 0) continue;
    const got = Number(f?.value ?? 0);
    parts.push(Math.min(100, Math.round((Number.isFinite(got) ? got : 0) / target * 100)));
  }
  if (!parts.length) return null;                               // nothing was asked: no score exists
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** A month's monthly measures, over every week of the month that has fills (`weeks`: one fills map per week). */
export function monthPct(measures, targets, weeks) {
  const parts = [];
  for (const m of measures) {
    if (m.frequency !== 'MONTHLY') continue;
    const t = targets[m.measure_id];
    if (!t || t.target === '') continue;
    if (m.kind === 'YESNO') { parts.push(weeks.some((F) => F[m.measure_id]?.value === 'YES') ? 100 : 0); continue; }
    const target = Number(t.target);
    if (!Number.isFinite(target) || target <= 0) continue;
    const got = weeks.reduce((n, F) => { const v = Number(F[m.measure_id]?.value ?? 0); return n + (Number.isFinite(v) ? v : 0); }, 0);
    parts.push(Math.min(100, Math.round(got / target * 100)));
  }
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Their sadhana: the average of the Sadhna measure over the weeks it was filled (`weeks`: fills maps). */
export function sadhanaPct(measures, weeks) {
  const ids = measures.filter((m) => m.source === 'week_score').map((m) => m.measure_id);
  const got = weeks.flatMap((F) => ids.filter((id) => F[id] && F[id].value !== '' && Number.isFinite(Number(F[id].value))).map((id) => Number(F[id].value)));
  return got.length ? Math.round(got.reduce((a, b) => a + b, 0) / got.length) : null;
}

/** The last day of a week id's week (its Sunday). */
const weekEnd = (weekId) => new Date(Date.parse(weekId + 'T00:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
/** The last day of a YYYY-MM month. */
const monthEnd = (ym) => { const [y, mo] = ym.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };

/**
 * The SCOREBOARD: how everyone did in ONE WEEK (the head, 17 Oct 2026).
 *
 * "The scoreboard reflects the last week['s] sadhana basis possible promotion list and the
 * performance of everyone in that week." So this is a live signal and is allowed to move about. It
 * is NOT what a promotion is judged on — that reads the whole history (`phaseAverage` below).
 */
export async function boardFor(db, logins, phaseId, weekId) {
  if (!logins.length) return [];
  const P = parts(logins);
  const got = await reads(db, [allRows(q(db, MEASURES_SQL)),
    ...P.map(c => allRows(q(db, `SELECT login, measure_id, target, per_level FROM targets WHERE phase_id = ? AND login IN (${marksFor(c)})`, phaseId, ...c))),
    ...P.map(c => allRows(q(db, `SELECT login, measure_id, value, source FROM fills WHERE phase_id = ? AND week_id = ? AND login IN (${marksFor(c)})`, phaseId, weekId, ...c)))]);
  const ms = got[0], tg = got.slice(1, 1 + P.length).flat(), fl = got.slice(1 + P.length).flat();
  const by = (rows) => rows.reduce((o, r) => { (o[r.login] ||= {})[r.measure_id] = r; return o; }, {});
  const T = by(tg), F = by(fl);
  return logins.map(login => ({
    login,
    pct: weekPct(ms, T[login] || {}, F[login] || {}),
    filled: Object.keys(F[login] || {}).length,
    asked: Object.keys(T[login] || {}).length
  }));
}

/**
 * The WHOLE PHASE for one person: their average, and how much of it they actually reported.
 *
 * `weeks` and `filled` travel with the average on purpose. An average over 3 filled weeks of 16 is
 * not the same measurement as one over 16, and a screen that prints only the number misleads the
 * person reading it. The dashboard carries both for the same reason.
 */
export async function phaseAverage(db, login, phaseId, asOfWeek = '') {
  const phase = await phaseRow(db, phaseId);
  if (!phase) return null;
  return (await cardsOf(db, [login], phase, asOfWeek)).average(login);
}
/*
 * The whole-phase figure from what cardsOf read. The window is the one the card is filled over: an ETP student's
 * training, a facilitator's phase — counting a four-month phase for a three-month training would make every student
 * look thin.
 */
function averageFrom(ms, tg, fl, win, asOfWeek) {
  const T = Object.fromEntries(tg.map(t => [t.measure_id, t]));
  const weeks = [...new Set(fl.map(f => f.week_id))].sort();
  const byWeek = Object.fromEntries(weeks.map(w => [w, Object.fromEntries(fl.filter(f => f.week_id === w).map(f => [f.measure_id, f]))]));
  // a week counts for WEEKLY seva only once a weekly measure was filled in it: recording a monthly meeting in a week
  // with nothing else must not turn that week into a nought (it would make reporting the meeting cost them)
  const weeklyIds = new Set(ms.filter(weekly).map(m => m.measure_id));
  const perWeek = weeks.filter(w => Object.keys(byWeek[w]).some(id => weeklyIds.has(id)))
    .map(w => ({ weekId: w, pct: weekPct(ms, T, byWeek[w]) })).filter(x => x.pct !== null);
  // a month counts once it has ENDED (by the week being looked at) and they filled something in it — the same
  // rule as a week, which counts only once they filled it; an unfilled month is a gap in reporting, shown apart
  const asOf = asOfWeek ? weekEnd(asOfWeek) : '9999-12-31';
  const months = [...new Set(weeks.map(w => w.slice(0, 7)))].sort()
    .filter(ym => monthEnd(ym) <= asOf)
    .map(ym => ({ month: ym, pct: monthPct(ms, T, weeks.filter(w => w.slice(0, 7) === ym).map(w => byWeek[w])) }))
    .filter(x => x.pct !== null);
  const sevaParts = [...perWeek.map(x => x.pct), ...months.map(x => x.pct)];
  const seva = sevaParts.length ? Math.round(sevaParts.reduce((a, b) => a + b, 0) / sevaParts.length) : null;
  const sadhana = sadhanaPct(ms, weeks.map(w => byWeek[w]));
  const avg = seva;   // `average` is the seva figure, as every screen reading it has always meant
  // how many weeks their window HAS, so a thin average reads as thin rather than as low
  const total = Math.max(1, Math.round((Date.parse(win.to) - Date.parse(win.from)) / (7 * 86400000)));
  return { average: avg, seva, sadhana, months, filled: perWeek.length, weeks: total, from: win.from, to: win.to, period: win.kind, trend: perWeek };
}

/* ------------------------------------------------------------------------ */
/* Reading many people's cards at once                                       */
/* ------------------------------------------------------------------------ */

/*
 * Everything a card, its phase average and its stages read, for a SET of people, in at most three round trips
 * whatever the set's size (22 Oct 2026, B1 + G6).
 *
 * The scoreboard used to work person by person: phaseAverage and stagesOf for each row, each reading the measures,
 * the phase, the window, the targets and the fills again, and stagesOf then reading every student's figures one by
 * one — 11 round trips a trainee, 53 for a board of four, past what one request can do at 625. card.get read the
 * same targets and fills three times over. These are the same statements with `login IN (...)` (chunks of 90: D1
 * binds at most 100), the same rows, read once:
 *
 *   1  measures · each person's window · targets · fills  (+ stage targets and facilitator names for the stages,
 *      + the offered week for one person's card)
 *   2  the promotions and the current students of every facilitator among them           (stages only)
 *   3  those students' batches' rules, and their figures over each window in play         (stages only)
 *
 * The functions it returns compute exactly what phaseAverage, stagesOf and cardOf computed for one person.
 */
const IN_MAX = 90;
const parts = (xs) => { const out = []; for (let i = 0; i < xs.length; i += IN_MAX) out.push(xs.slice(i, i + IN_MAX)); return out; };
const marksFor = (xs) => xs.map(() => '?').join(',');
const groupBy = (rs, key = 'login') => rs.reduce((o, r) => { (o[r[key]] ||= []).push(r); return o; }, {});

async function cardsOf(db, logins, phase, asOfWeek = '', { stages = false, offerWeek = '' } = {}) {
  const pid = phase.phase_id, P = parts(logins), list = [];
  const add = (tag, item) => list.push([tag, item]);
  add('ms', allRows(q(db, MEASURES_SQL)));
  for (const c of P) {
    const m = marksFor(c);
    add('tg', allRows(q(db, `SELECT login, measure_id, target, per_level FROM targets WHERE phase_id = ? AND login IN (${m})`, pid, ...c)));
    add('fl', allRows(q(db, `SELECT login, measure_id, value, source, week_id FROM fills WHERE phase_id = ? AND login IN (${m})`, pid, ...c)));
    // the head's openings of their targets (ADR 0018), read beside the rest: no extra round trip
    add('tu', allRows(q(db, `SELECT login, until FROM target_unlocks WHERE phase_id = ? AND login IN (${m})`, pid, ...c)));
    if (stages) {
      add('st', allRows(q(db, `SELECT login, stage, target FROM stage_targets WHERE phase_id = ? AND login IN (${m})`, pid, ...c)));
      // the facilitator each of them IS, by id (Phase 24): a rename never loses their students or their promotions
      add('who', allRows(q(db, `SELECT login, fac_id FROM accounts WHERE login IN (${m})`, ...c)));
    }
  }
  if (offerWeek && logins.length === 1) add('offer', q(db, OFFER_SQL, logins[0], offerWeek));
  const R = { ms: [], win: [], tg: [], fl: [], tu: [], st: [], who: [], offer: null };
  if (logins.length) {
    const got = await reads(db, list.map(x => x[1]));
    list.forEach(([tag], i) => { if (tag === 'offer') R.offer = got[i]; else R[tag].push(...got[i]); });
  }
  const ms = R.ms, TG = groupBy(R.tg), FL = groupBy(R.fl), ST = groupBy(R.st), TU = Object.fromEntries(R.tu.map(r => [r.login, r]));
  // one card, one window for everyone read here: the phase's for facilitators, the training's for its trainees (J1)
  const win = () => windowFrom(phase);
  const FAC = Object.fromEntries(R.who.map(r => [r.login, r.fac_id || '']));

  // the stages: every facilitator's promotions and current students, then their rules and figures
  let ACH = {}, MINE = {}, CRIT = {}, FIG = {};
  if (stages) {
    const facs = [...new Set(logins.map(l => FAC[l]).filter(Boolean))];
    if (facs.length) {
      const FP = parts(facs);
      const got = await reads(db, [
        /*
         * Led by the FACILITATOR, not by the date range. Written the other way round it read `SCAN m` on EXPLAIN — a
         * scan of memberships, which grows with every devotee and every batch change. Starting from their own
         * students uses memberships_by_facilitator and reads only their rows.
         */
        ...FP.map(c => allRows(q(db, `
          SELECT prev.fac_id AS fac, b.level AS stage, COUNT(DISTINCT m.id) AS n
            FROM memberships prev
            JOIN memberships m ON m.login = prev.login AND m.from_week > prev.to_week
            JOIN batches b ON b.batch_id = m.batch_id
           WHERE prev.fac_id IN (${marksFor(c)}) AND prev.to_week <> ''
             AND m.from_week >= ? AND m.from_week <= ? AND m.reason LIKE 'promoted from%'
           GROUP BY prev.fac_id, b.level`, ...c, phase.starts_on, phase.ends_on))),
        // in memberships_by_facilitator's order, as the one-facilitator read returned them
        ...FP.map(c => allRows(q(db, `SELECT m.fac_id AS fac, m.login, m.batch_id, b.level, a.name, a.iyf_id FROM memberships m
                                         JOIN batches b ON b.batch_id = m.batch_id JOIN accounts a ON a.login = m.login
                                       WHERE m.fac_id IN (${marksFor(c)}) AND m.to_week = '' AND m.state = 'ACTIVE'
                                       ORDER BY m.fac_id, m.id`, ...c)))]);
      ACH = groupBy(got.slice(0, FP.length).flat(), 'fac');
      MINE = groupBy(got.slice(FP.length).flat(), 'fac');
      // only students on the ladder are judged (TRD, BVS move nobody up), each over THEIR facilitator's window
      const batches = new Set(), byWindow = {};
      for (const login of logins) {
        const ladder = (MINE[FAC[login]] || []).filter(st => nextLevels(st.level).length);
        if (!ladder.length) continue;
        const w = win(login), to = asOfWeek && asOfWeek < w.to ? asOfWeek : w.to, key = w.from + '|' + to;
        const set = (byWindow[key] ||= { from: w.from, to, logins: new Set() });
        for (const st of ladder) { batches.add(st.batch_id); set.logins.add(st.login); }
      }
      if (batches.size) {
        const BP = parts([...batches]), windows = Object.entries(byWindow);
        const reqs = [...BP.map(c => allRows(q(db, `SELECT batch_id, criterion, min_value FROM promotion_criteria WHERE batch_id IN (${marksFor(c)})`, ...c)))];
        const spans = windows.map(([key, w]) => { const r = figureReads(db, [...w.logins], w.from, w.to); const at = reqs.length; reqs.push(...r); return [key, at, r.length]; });
        const out = await reads(db, reqs);
        CRIT = groupBy(out.slice(0, BP.length).flat(), 'batch_id');
        for (const [key, at, n] of spans) FIG[key] = figuresFromReads(out.slice(at, at + n));
      }
    }
  }

  return {
    window: win,
    average: (login) => averageFrom(ms, TG[login] || [], FL[login] || [], win(login), asOfWeek),
    /** when their set targets are fixed, and whether they may change now (ADR 0018) */
    lock: (login, now) => targetsLock(phase, win(login), TU[login], now),
    card: (login, weekId, isTrainee) => cardFrom(ms, TG[login] || [], FL[login] || [], R.offer, weekId, isTrainee),
    /** boardFor's row for one person, from the same targets and fills: the week's figure, what they filled, what they were asked */
    week: (login, weekId) => {
      const T = Object.fromEntries((TG[login] || []).map(r => [r.measure_id, r]));
      const F = Object.fromEntries((FL[login] || []).filter(r => r.week_id === weekId).map(r => [r.measure_id, r]));
      return { login, pct: weekPct(ms, T, F), filled: Object.keys(F).length, asked: Object.keys(T).length };
    },
    stages: (login) => stagesFrom(phase, ST[login] || [], FAC[login] || '', ACH, MINE, CRIT, FIG, win(login), asOfWeek)
  };
}

/** A person's own card for a phase (their own only: `card.fill` writes only the caller's). */
export async function cardGet(d, ctx) {
  const db = ctx.db;
  // a trainee's card is their training's, over its own dates; a facilitator's the phase's (Phase 22, J1)
  const phase = await cardFor(db, ctx.login, String(d.phaseId || ''), isoIst(ctx.now()).slice(0, 10));
  if (!phase) throw apiError('NOT_FOUND', 'No phase is open.');
  const weekId = validWeekId(d.weekId) ? d.weekId : mondayOf(ctx.now());
  // the card, its average and its stages in three round trips, not thirty (22 Oct 2026, B1)
  const c = await cardsOf(db, [ctx.login], phase, weekId, { stages: true, offerWeek: weekId });
  const win = c.window(ctx.login), avg = c.average(ctx.login);
  /*
   * Whether this person has a card AT ALL (the head, 18 Oct 2026).
   *
   * The app needs one plain answer to decide whether to offer the tab: a devotee who is not in a
   * training and does not facilitate has no card, and showing them an empty one is worse than
   * showing nothing. A trainee has one while the training runs and afterwards as a record; a
   * facilitator has one because the phase gives them one.
   */
  const facilitates = !!ctx.acct?.facilitator_name;
  const hasCard = win.kind === 'batch' || facilitates || !!ctx.scopes?.master;
  return { phaseId: phase.phase_id, name: phase.name, state: phase.state,
           startsOn: phase.starts_on, endsOn: phase.ends_on,
           hasCard, batchId: win.batchId, closed: win.closed, groups: CARD_GROUPS,
           // a trainee fills the same card under their own words, and over their training's dates
           trainee: win.kind === 'batch', from: win.from, to: win.to,
           ...c.card(ctx.login, weekId, win.kind === 'batch'),
           // targets are set at the start of the phase (ADR 0018): until when, and whether they may change now
           targets: c.lock(ctx.login, ctx.now()),
           phase: avg,
           // the stages, and the net score the dashboard prints: without them the card showed two
           // thirds of a figure
           score: scoreFrom(avg, c.stages(ctx.login)) };
}

/**
 * Let one finished card be edited again (the head only, 17 Oct 2026).
 *
 * A closed training's cards are a record. When a real correction is needed the head opens ONE
 * person's, with a reason, and the permission expires on its own — an opened card left open by
 * forgetting would quietly undo the freeze.
 */
export async function cardUnlock(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), login = String(d.login || '');
  const reason = cleanName(d.reason || '');
  if (reason.length < 4) throw invalid({ path: 'reason', message: 'Say why this card is being opened.' });
  // the training they were enrolled in, not a membership — they never were a member of it
  const m = await one(db, `SELECT e.batch_id, b.closed_at FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
                            WHERE e.login = ? ORDER BY e.id DESC LIMIT 1`, login);
  if (!m) throw apiError('NOT_FOUND', 'No such person, or they were never in a batch.');
  if (!m.closed_at) throw apiError('CONFLICT', 'That batch is still running; its cards are open already.');
  // 7 days: long enough to put a mistake right, short enough that nobody has to remember to close it
  const until = isoIst(new Date(ctx.now().getTime() + 7 * 86400000));
  await db.batch([
    q(db, `INSERT INTO card_unlocks (batch_id, login, reason, allowed_by, allowed_at, until) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(batch_id, login) DO UPDATE SET reason = excluded.reason, allowed_by = excluded.allowed_by,
             allowed_at = excluded.allowed_at, until = excluded.until`, m.batch_id, login, reason, ctx.login, at, until),
    audit(db, ctx, 'card.unlock', login, m.batch_id, null, { until }, reason, req.requestId),
    dirty(db, 'card_unlocks', 'audit_log')]);
  return { login, batchId: m.batch_id, until };
}

/**
 * The trainings a person has finished, for their contact card (the head, 17 Oct 2026).
 *
 * "Once the batch finishes the ETP tab will disappear from the user's view, as that will now be
 * seen in the account's info as a record." The tab goes by itself — it is a scope, and closing ends
 * the membership — and what is left is this: which training, when, and how they did.
 */
export async function trainingsOf(db, login, today = isoIst(new Date()).slice(0, 10)) {
  // enrolments, not memberships: a student was never a MEMBER of the training (17 Oct 2026)
  /*
   * ONE ROW PER TRAINING, not per enrolment (the head, 18 Oct 2026).
   *
   * Somebody taken out of a training and put back has two enrolment rows, and the profile listed
   * the same ETP batch twice. What a person did in a training is one fact about them however many
   * times the coordinator corrected the roll, so the newest row for each batch wins and carries
   * the dates.
   */
  const rows = await all(db, `SELECT e.batch_id, b.name, b.started_on, b.ends_on, b.closed_at, e.from_week, e.to_week
                                FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
                               WHERE e.login = ?
                                 AND e.id = (SELECT MAX(e2.id) FROM enrolments e2
                                              WHERE e2.login = e.login AND e2.batch_id = e.batch_id)
                               ORDER BY e.id DESC`, login);
  const out = [];
  for (const r of rows) {
    // the training's own card (Phase 22, J1): keyed by the batch, over its dates — no phase is looked up. `phaseId` is
    // that card's key, which card.of takes to open it
    const card = r.started_on ? trainingCard(r, today) : null;
    const avg = card ? (await cardsOf(db, [login], card)).average(login) : null;
    out.push({ batchId: r.batch_id, name: r.name, startedOn: r.started_on || r.from_week,
               finishedOn: r.closed_at ? r.closed_at.slice(0, 10) : '', running: !r.closed_at,
               phaseId: card ? r.batch_id : '', average: avg?.average ?? null, filled: avg?.filled ?? 0, weeks: avg?.weeks ?? 0 });
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* The boards                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Who a person may see a board for (the head, 17 Oct 2026):
 *
 *   ETP students     their own ETP coordinator, and the admin
 *   facilitators     the admin
 *
 * A batch coordinator is not given a board. They coordinate a class, and a class's scores are the
 * devotees' weekly sadhana, which they already have — this board is the facilitation one.
 */
/**
 * ONE person's card, read by the staff who oversee them (the head, 18 Oct 2026).
 *
 * Tapping a row on a scoreboard opens what that person filled — the same card they see, with their
 * targets, the week's values and their average over the window that applies to them: a training's
 * own dates for a trainee, the phase for a facilitator.
 *
 * Who may read whom: the head reads anyone; a training's coordinator reads only the people enrolled
 * in a training they hold. Nobody reads a card for a person they do not oversee.
 */
export async function cardOfPerson(d, ctx) {
  const db = ctx.db, login = String(d.login || '');
  if (!login) throw invalid({ path: 'login', message: 'Choose a person.' });
  const acct = await one(db, 'SELECT login, name, facilitator_name FROM accounts WHERE login = ?', login);
  if (!acct) throw apiError('NOT_FOUND', 'No such person.');

  // their own card, opened from their own place on a board (ADR 0016): the same card, read-only
  if (!ctx.scopes.master && login !== ctx.login && !(wholeFacBoard(ctx) && acct.facilitator_name)) {
    const mine = await one(db, `SELECT 1 AS x FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
                                 WHERE e.login = ? AND e.state = 'ACTIVE' AND b.level = 'ETP'
                                   AND ',' || replace(b.coordinator_logins, ' ', '') || ',' LIKE '%,' || ? || ',%'`,
      login, ctx.login);
    if (!mine) throw apiError('FORBIDDEN', 'They are not in a training of yours.');
  }

  const phase = await cardFor(db, login, String(d.phaseId || ''), isoIst(ctx.now()).slice(0, 10));
  if (!phase) throw apiError('NOT_FOUND', 'No phase is open.');
  const weekId = validWeekId(d.weekId) ? d.weekId : await focusWeek(db, ctx.now());
  const c = await cardsOf(db, [login], phase, weekId, { stages: true, offerWeek: weekId });
  const win = c.window(login), avg = c.average(login);
  // the same shape as card.get, so one screen draws both: `name` is the phase's, as there; `person` is whose card it is
  return { login, person: acct.name, phaseId: phase.phase_id, name: phase.name, state: phase.state,
           startsOn: phase.starts_on, endsOn: phase.ends_on, groups: CARD_GROUPS, closed: win.closed,
           trainee: win.kind === 'batch', batchId: win.batchId, from: win.from, to: win.to,
           ...c.card(login, weekId, win.kind === 'batch'),
           targets: c.lock(login, ctx.now()),
           phase: avg,
           score: scoreFrom(avg, c.stages(login)) };
}

/**
 * Open one person's targets for 7 days (the head only — ADR 0018). After the start of a phase a set target is fixed;
 * when one genuinely must change (a facilitator's situation changed, a figure was mistyped) the head opens that
 * person's targets, with a reason, and the opening expires on its own — modelled on card.unlock.
 */
export async function targetsUnlock(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), login = String(d.login || '');
  const reason = cleanName(d.reason || '');
  if (reason.length < 4) throw invalid({ path: 'reason', message: 'Say why their targets are being opened.' });
  const acct = await one(db, 'SELECT login, facilitator_name FROM accounts WHERE login = ?', login);
  if (!acct) throw apiError('NOT_FOUND', 'No such person.');
  // the FTP coordinator (ADR 0019) opens the original facilitators' targets; anyone else's stays the head's
  if (!ctx.scopes.master && !acct.facilitator_name) throw apiError('FORBIDDEN', 'Only a facilitator’s targets are opened here.');
  // their card's key: a trainee's training, a facilitator's phase (J1)
  const phase = await cardFor(db, login, String(d.phaseId || ''), at.slice(0, 10));
  if (!phase) throw apiError('NOT_FOUND', 'No phase is open.');
  if (phase.state !== 'OPEN') throw apiError('CONFLICT', `${phase.name} is closed.`);
  const until = isoIst(new Date(ctx.now().getTime() + 7 * 86400000));
  await db.batch([
    q(db, `INSERT INTO target_unlocks (phase_id, login, reason, allowed_by, allowed_at, until) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(phase_id, login) DO UPDATE SET reason = excluded.reason, allowed_by = excluded.allowed_by,
             allowed_at = excluded.allowed_at, until = excluded.until`, phase.phase_id, login, reason, ctx.login, at, until),
    audit(db, ctx, 'targets.unlock', login, '', null, { phaseId: phase.phase_id, until }, reason, req.requestId),
    dirty(db, 'target_unlocks', 'audit_log')]);
  return { login, phaseId: phase.phase_id, until };
}

/**
 * The boards this person may open (the head, 18 Oct 2026).
 *
 * The head sees every running training and the facilitators' board; a training's coordinator sees
 * their own. Listed rather than hard-coded in the screen, so a new training — MTP, or ETP batch 22
 * — appears the day it is created without anybody editing the app.
 */
export async function boardList(d, ctx) {
  const db = ctx.db, out = [];
  const mine = ctx.scopes.master
    ? await all(db, "SELECT batch_id, name FROM batches WHERE level = 'ETP' AND active = 1 AND closed_at = '' ORDER BY batch_id")
    : await all(db, `SELECT batch_id, name FROM batches WHERE level = 'ETP' AND active = 1 AND closed_at = ''
                       AND ',' || replace(coordinator_logins, ' ', '') || ',' LIKE '%,' || ? || ',%' ORDER BY batch_id`, ctx.login);
  for (const b of mine) out.push({ kind: 'training', batchId: b.batch_id, name: b.name });
  // the facilitators' board: the whole of it for the head and the FTP coordinator, as boardScope enforces
  if (wholeFacBoard(ctx)) {
    // the FTP route's people: a trainee's facilitation (temporary) is on their training's board, not this one (J1)
    const n = await one(db, "SELECT COUNT(*) AS n FROM accounts WHERE facilitator_name <> '' AND facilitation <> 'temporary' AND status = 'ACTIVE'");
    out.push({ kind: 'facilitators', batchId: '', name: 'Facilitators', people: n?.n || 0 });
  } else {
    // everyone else on a board sees their OWN place on it (the head, 22 Oct 2026 — ADR 0016): a trainee on their
    // training's, a facilitator on the facilitators'. `self` says the board will hold their row alone.
    const tr = ctx.scopes.trainee;
    if (tr && !out.some(b => b.batchId === tr.batchId)) out.push({ kind: 'training', batchId: tr.batchId, name: tr.name, self: true });
    else if (!tr && ctx.scopes.facilitator) out.push({ kind: 'facilitators', batchId: '', name: 'Facilitators', self: true });
  }
  return { boards: out, weekId: await focusWeek(db, ctx.now()) };
}

/** The whole facilitators' board: the head, and the FTP coordinator unless the head took that right away (ADR 0019). */
const wholeFacBoard = (ctx) => !!ctx.scopes.master || (!!ctx.scopes.ftp && ctx.scopes.rights?.facBoard !== 'deny');

async function boardScope(db, ctx, d) {
  const batchId = String(d.batchId || '');
  if (batchId) {
    // a training batch's board: whole for its own coordinator or the head; a trainee IN it sees their own place
    const holds = (await scopeBatches(db, ctx)).includes(batchId);
    const self = !holds && ctx.scopes.trainee?.batchId === batchId;
    if (!holds && !self) throw apiError('FORBIDDEN', 'That batch is not yours.');
    // a training's people are ENROLLED in it; every other batch's are members
    const rows = vedicLevel(batchId) === 'ETP'
      ? await all(db, `SELECT e.login, a.name FROM enrolments e JOIN accounts a ON a.login = e.login
                        WHERE e.batch_id = ? AND e.state = 'ACTIVE' ORDER BY a.name`, batchId)
      : await all(db, `SELECT m.login, a.name FROM memberships m JOIN accounts a ON a.login = m.login
                        WHERE m.batch_id = ? AND m.to_week = '' AND m.state = 'ACTIVE' ORDER BY a.name`, batchId);
    return { kind: 'training', batchId, people: rows, self };
  }
  // the facilitators' board: whole for the head; a facilitator (not in a training — a trainee's place is on their
  // training's board) sees their own place on it. A coordinator who facilitates nobody gets their batches above.
  const whole = wholeFacBoard(ctx), self = !whole && !!ctx.scopes.facilitator && !ctx.scopes.trainee;
  if (!whole && !self) throw apiError('FORBIDDEN', 'Only the IYF head sees the facilitators’ board.');
  // the FTP route only: a trainee (temporary facilitation) is on their training's board, over its dates (J1)
  const rows = await all(db, `SELECT login, name FROM accounts
                               WHERE facilitator_name <> '' AND facilitation <> 'temporary' AND status = 'ACTIVE' ORDER BY name`);
  return { kind: 'facilitators', batchId: '', people: rows, self };
}

/**
 * The board: how everyone did in ONE WEEK.
 *
 * The head was explicit that this is a live signal, not a verdict: "the scoreboard reflects the last
 * week's sadhana, the possible promotion list, and the performance of everyone in that week". It is
 * allowed to move about. A promotion is judged on the whole history instead (`phaseAverage`), and
 * the two are never the same number.
 */
export async function boardGet(d, ctx) {
  const db = ctx.db, today = isoIst(ctx.now()).slice(0, 10);
  // a TRAINING's board is its own card's: over the training's dates, never a phase (Phase 22, J1); the facilitators'
  // board (the FTP route) and a class batch's stay on the phase
  const scope = await boardScope(db, ctx, d);
  const phase = scope.kind === 'training' && vedicLevel(scope.batchId) === 'ETP'
    ? trainingByKey(await one(db, 'SELECT batch_id, name, started_on, ends_on, closed_at FROM batches WHERE batch_id = ?', scope.batchId), today)
    : String(d.phaseId || '')
      ? await one(db, 'SELECT * FROM phases WHERE phase_id = ?', String(d.phaseId))
      : await currentPhase(db, today);
  if (!phase) throw apiError('NOT_FOUND', 'No phase is open.');
  // The week the board OPENS on: last week until its deadline passes, then this week (the head,
  // 18 Oct 2026 — "if say I am on Monday then the previous week's scorecard"). A scoreboard read on
  // Monday morning is about the week that just finished; the week in progress has barely begun and
  // would read as everybody failing. `focusWeek` is the same rule the staff screens already use.
  const weekId = validWeekId(d.weekId) ? d.weekId : await focusWeek(db, ctx.now());
  const names = Object.fromEntries(scope.people.map(p => [p.login, p.name]));
  const logins = scope.people.map(p => p.login);
  // every row's week, phase average and stages in at most three round trips (22 Oct 2026, G6: this was 11 a person)
  const c = await cardsOf(db, logins, phase, weekId, { stages: true });
  const week = logins.map(login => c.week(login, weekId));

  // A TRAINING's own class attendance, marked by its coordinator (the head, 18 Oct 2026). It sits
  // beside `filled`, which says whether they filled the card: the coordinator asked to see both —
  // did this person do their card this week, and were they at the class.
  const att = scope.kind === 'training' && scope.batchId
    ? Object.fromEntries((await all(db,
        'SELECT login, mark FROM training_attendance WHERE batch_id = ? AND week_id = ?',
        scope.batchId, weekId)).map(r => [r.login, r.mark || '']))
    : {};

  // their whole-phase figure beside the week's, so the two are never confused for each other
  const rows = [];
  for (const r of week) {
    const avg = c.average(r.login);
    const st = c.stages(r.login);
    const seva = avg?.seva ?? null, goal = st?.goalPct ?? null;
    rows.push({ login: r.login, name: names[r.login] || r.login,
                week: r.pct, filled: r.filled, asked: r.asked,
                mark: att[r.login] ?? '',
                average: seva, seva, sadhana: avg?.sadhana ?? null, goal,
                // the head's rule for this app (22 Oct 2026, ADR 0012 F): ranked on seva and goal; sadhana is shown,
                // not ranked. The Facilitator Dashboard keeps its equal thirds until the head changes it there.
                rank: goal === null ? null : Math.round(((seva ?? 0) + goal) / 2),
                weeksFilled: avg?.filled ?? 0, weeks: avg?.weeks ?? 0 });
  }
  // somebody with a target ranks before somebody never given one (the dashboard's NO_TARGET_RANKS_LAST): a person
  // not asked has no goal figure, and sorting them by seva alone among people who were would mislead
  rows.sort((a, b) => ((b.rank !== null) - (a.rank !== null))
    || (b.rank ?? -1) - (a.rank ?? -1) || (b.seva ?? -1) - (a.seva ?? -1) || a.name.localeCompare(b.name));
  // the place, "#4 of 20" as the dashboard prints it: only somebody with a rank has one, and those are first
  rows.forEach((r, i) => { r.place = r.rank === null ? null : i + 1; });
  // somebody seeing their own place gets their row alone: the others' names and figures never leave the server
  const shown = scope.self ? rows.filter(r => r.login === ctx.login) : rows;
  // the board's own dates (the head, 27 Oct 2026: "I set the ETP batch's start and end date … I don't see the duration
  // on the scoreboard"): a training's start and the end date set for it ('' until one is set), a phase's own dates
  return { phaseId: phase.phase_id, name: phase.name, weekId, kind: scope.kind, batchId: scope.batchId,
           startsOn: phase.starts_on || '', endsOn: phase.training ? phase.planned_end : phase.ends_on || '', training: !!phase.training,
           self: !!scope.self, of: rows.length, rows: shown };
}

/**
 * Mark a training's class attendance for one week. The training's coordinator, or the head.
 *
 * Its own table, not the `attendance` one: an ETP student is still a devotee of their own batch and
 * is marked there for their own class the same week. Sharing (login, week_id) would let one mark
 * overwrite the other (migration 0057).
 */
export async function trainingAttendanceSet(d, ctx, req) {
  const db = ctx.db, batchId = String(d.batchId || '');
  await requireBatch(ctx, batchId);
  const b = await one(db, 'SELECT batch_id, level, closed_at FROM batches WHERE batch_id = ?', batchId);
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  if (vedicLevel(batchId) !== 'ETP') throw apiError('CONFLICT', 'Not a training batch.');
  if (b.closed_at) throw apiError('CONFLICT', 'This training is finished, so its attendance cannot be changed.');
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  if (!Array.isArray(d.marks) || !d.marks.length) throw invalid({ path: 'marks', message: 'Mark at least one student.' });
  if (d.marks.length > 300) throw invalid({ path: 'marks', message: 'At most 300 marks in one save.' });

  // only people actually in this training, so a typo cannot mark somebody else's devotee
  const enrolled = new Set((await all(db,
    "SELECT login FROM enrolments WHERE batch_id = ? AND state = 'ACTIVE'", batchId)).map(r => r.login));
  const at = isoIst(ctx.now()), stmts = [];
  for (const [i, m] of d.marks.entries()) {
    const login = String(m?.login || '');
    if (!enrolled.has(login)) throw invalid({ path: `marks.${i}.login`, message: 'Not a student of this training.' });
    const mark = m.mark === null || m.mark === '' ? '' : String(m.mark);
    if (mark !== '' && mark !== 'P' && mark !== 'A') throw invalid({ path: `marks.${i}.mark`, message: 'P, A or null.' });
    stmts.push(db.prepare(`INSERT INTO training_attendance (login, batch_id, week_id, mark, marked_by, marked_at)
                           VALUES (?, ?, ?, ?, ?, ?)
                           ON CONFLICT(login, batch_id, week_id) DO UPDATE SET
                             mark = excluded.mark, marked_by = excluded.marked_by, marked_at = excluded.marked_at`)
      .bind(login, batchId, d.weekId, mark, ctx.login, at));
  }
  stmts.push(audit(db, ctx, 'training.attendance', '', batchId, null,
    { weekId: d.weekId, marks: d.marks.length }, '', req?.requestId));
  await db.batch(stmts);
  return { batchId, weekId: d.weekId, saved: d.marks.length };
}

/* ------------------------------------------------------------------------ */
/* Stages: how many students they mean to move up                            */
/* ------------------------------------------------------------------------ */

/** The six stages, as the dashboard names them (DataService.gs STAGES). The level moved TO. */
export const STAGES = [
  { stage: 'VL3', label: 'VL-2 → VL-3' },
  { stage: 'SPS', label: 'VL-3 → SPS' },
  { stage: 'DPS', label: 'SPS → DPS' },
  { stage: 'BSS', label: 'DPS → BSS' },
  { stage: 'BVS', label: 'DPS → BVS' }
];

/**
 * One person's stages for a phase: what they aimed for, and what actually happened.
 *
 * The TARGET is theirs. The ACHIEVED is COUNTED, not typed: this app knows who was promoted, when,
 * and by whom, so a facilitator never reports their own result. The dashboard has to ask for it
 * because a spreadsheet cannot see the promotions; the app can.
 *
 * A promotion counts for the facilitator the devotee had AT THE TIME, from the membership that
 * promotion closed — not whoever facilitates them now, or moving somebody between facilitators
 * would move their history with them.
 */
export async function stagesOf(db, login, phaseId, asOfWeek = '') {
  const phase = await phaseRow(db, phaseId);
  if (!phase) return null;
  return (await cardsOf(db, [login], phase, asOfWeek, { stages: true })).stages(login);
}
/** One person's stages from what cardsOf read: their targets, their facilitator name, and every facilitator's students. */
function stagesFrom(phase, tg, fac, ACH, MINE, CRIT, FIG, win, asOfWeek) {
  const T = Object.fromEntries(tg.map(t => [t.stage, t.target]));

  // every promotion in the window, to the level it moved somebody TO, counted for the facilitator
  // that devotee had when it happened
  /*
   * Led by the FACILITATOR, not by the date range.
   *
   * Written the other way round it read `SCAN m` on EXPLAIN — a scan of memberships, which grows
   * with every devotee and every batch change, for a figure one facilitator asked for. Starting
   * from their own students uses memberships_by_facilitator and reads only their rows.
   */
  const ach = fac ? ACH[fac] || [] : [];      // read in cardsOf, led by the facilitator (memberships_by_facilitator)
  const A = Object.fromEntries(ach.map(a => [a.stage, a.n]));

  /*
   * ELIGIBLE, not promoted, is what the goal is scored on (the head, 22 Oct 2026; ADR 0012 D–E): "how many of the
   * devotees are getting eligible for promotion, from the day their facilitation started till the previous week".
   * A student can be ready for weeks before a coordinator acts; the facilitator's work is the readiness. Promotions
   * stay on the card as `promoted`, for information. Their OWN students only (memberships.facilitator), judged by
   * the same rule as eligible.js — each batch's criteria, a missing figure never a pass — over the facilitator's
   * window: the phase for a facilitator, the training batch's dates for an ETP trainee.
   */
  const to = asOfWeek && asOfWeek < win.to ? asOfWeek : win.to;
  const mine = fac ? MINE[fac] || [] : [];
  const figures = FIG[win.from + '|' + to];
  const E = {}, crit = {}, ready = [];
  for (const st of mine) {
    const up = nextLevels(st.level);
    if (!up.length) continue;                                     // not on the ladder (TRD, BVS): nobody to move up
    crit[st.batch_id] ||= criteriaFrom(CRIT[st.batch_id] || [], st.level);
    const keys = Object.keys(crit[st.batch_id]);
    if (!keys.length) continue;                                   // a batch with no criteria declares nobody ready
    const f = figures(st.login, st.batch_id);
    if (!keys.every(k => meets(k, f[k], crit[st.batch_id][k]))) continue;
    // the level they would move TO; where there are two (DPS → BSS or BVS), the one this person aims at
    const stage = up.find(l => (T[l] ?? 0) > 0) || up[0];
    E[stage] = (E[stage] || 0) + 1;
    // who, by name, as the dashboard lists "ready to move up" under each level
    ready.push({ name: st.name, iyfId: st.iyf_id || '', batchId: st.batch_id, stage });
  }

  const stages = STAGES.map(s => ({ ...s, target: T[s.stage] ?? 0, eligible: E[s.stage] ?? 0, promoted: A[s.stage] ?? 0,
    achieved: E[s.stage] ?? 0 }));
  // capped per stage: a surplus at one level does not fill another's target (MetricsService.gs)
  const totalTarget = stages.reduce((n, s) => n + s.target, 0);
  const capped = stages.reduce((n, s) => n + (s.target > 0 ? Math.min(s.eligible, s.target) : 0), 0);
  return {
    stages, ready, totalTarget, totalAchieved: stages.reduce((n, s) => n + s.eligible, 0),
    totalPromoted: stages.reduce((n, s) => n + s.promoted, 0), from: win.from, to,
    // null, not 0, when nothing was asked: somebody given no target has no goal figure, and the
    // dashboard leaves the term out of their average rather than scoring them nought for it
    goalPct: totalTarget > 0 ? Math.max(0, Math.min(100, Math.round(capped / totalTarget * 100))) : null
  };
}

/** Set MY stage targets for a phase — how many students I mean to move up, per level. */
export async function stagesSet(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), login = ctx.login;
  const phase = String(d.phaseId || '') ? await cardFor(db, login, String(d.phaseId), at.slice(0, 10)) : null;
  if (!phase) throw apiError('NOT_FOUND', 'No such phase.');
  if (phase.state !== 'OPEN') throw apiError('CONFLICT', `${phase.name} is closed.`);
  if (!Array.isArray(d.stages)) throw invalid({ path: 'stages', message: 'Give the targets.' });
  // the level targets are targets too: fixed after the start of the phase like the measures' (ADR 0018)
  const [setRows, unlock] = await reads(db, [
    allRows(q(db, 'SELECT stage, target FROM stage_targets WHERE phase_id = ? AND login = ?', phase.phase_id, login)),
    q(db, 'SELECT until FROM target_unlocks WHERE phase_id = ? AND login = ?', phase.phase_id, login)]);
  const lock = targetsLock(phase, await cardWindow(db, login, phase), unlock, ctx.now());
  const was = Object.fromEntries(setRows.map(r => [r.stage, Number(r.target)]));
  const known = new Set(STAGES.map(s => s.stage));
  const stmts = [];
  for (const [i, x] of d.stages.entries()) {
    const stage = String(x?.stage || '');
    if (!known.has(stage)) throw invalid({ path: `stages.${i}.stage`, message: 'Not a level.' });
    const n = Number(x.target);
    if (!Number.isInteger(n) || n < 0 || n > 999) throw invalid({ path: `stages.${i}.target`, message: 'A whole number, 0 or more.' });
    // a level left at 0 reads as not set, on the card and here: it may still be set after the start of the phase
    if (!lock.open && was[stage] && was[stage] !== n) throw apiError('WINDOW_CLOSED', lockedMessage(phase, lock));
    stmts.push(q(db, `INSERT INTO stage_targets (phase_id, login, stage, target, set_by, set_at) VALUES (?, ?, ?, ?, ?, ?)
                      ON CONFLICT(phase_id, login, stage) DO UPDATE SET target = excluded.target, set_by = excluded.set_by, set_at = excluded.set_at`,
      phase.phase_id, login, stage, n, ctx.login, at));
  }
  await db.batch([...stmts,
    audit(db, ctx, 'stages.set', login, '', null, { phaseId: phase.phase_id, stages: d.stages.length }, '', req.requestId),
    dirty(db, 'stage_targets', 'audit_log')]);
  const asOf = await focusWeek(db, ctx.now());
  return (await cardsOf(db, [login], phase, asOf, { stages: true })).stages(login);
}

/**
 * The net score, as the dashboard works it out (MetricsService.gs calculateNetScore).
 *
 *     net = (sadhana % + seva % + goal %) / 3
 *
 * Two kinds of "nothing" are told apart, and keeping them apart is the point:
 *
 *   no target set    the goal term DOES NOT EXIST, so the average is over the terms that do.
 *                    Averaging a zero would punish somebody for a target nobody gave them.
 *   not filled in    sadhana or seva blank while they ARE measured counts as zero, because that is
 *                    a gap in their own reporting.
 *
 * Returned with its parts, never as a bare number: a score nobody can take apart is not something a
 * person can act on, and the dashboard shows its working for the same reason.
 */
export function netScore({ sadhana = null, seva = null, goal = null } = {}) {
  const parts = [
    { key: 'sadhana', label: 'Sadhana', value: sadhana === null ? 0 : Math.round(sadhana), reported: sadhana !== null },
    { key: 'seva', label: 'Seva', value: seva === null ? 0 : Math.round(seva), reported: seva !== null },
    // the only term that may be ABSENT rather than nought
    { key: 'goal', label: 'Goal', value: goal === null ? null : Math.round(goal), reported: goal !== null }
  ];
  // nothing reported at all is NO SCORE, not nought: sadhana and seva count as zero only while
  // somebody IS under measurement, and a person with neither has not been measured yet
  if (!parts.some(p => p.reported)) return { score: null, parts, counted: [] };
  const counted = parts.filter(p => p.value !== null);
  if (!counted.length) return { score: null, parts, counted: [] };
  return {
    score: Math.round(counted.reduce((n, p) => n + p.value, 0) / counted.length),
    parts,
    counted: counted.map(p => p.key)
  };
}

/** Everything one person's card is scored on, in one place: their week, their phase, their stages. */
export async function scoreOf(db, login, phaseId, weekId) {
  const phase = await phaseRow(db, phaseId);
  if (!phase) return scoreFrom(null, null);
  const c = await cardsOf(db, [login], phase, weekId, { stages: true });
  return scoreFrom(c.average(login), c.stages(login));
}
function scoreFrom(avg, st) {
  return {
    // sadhana and seva are two figures (22 Oct 2026): this passed the same number as both, so every net score the
    // app showed was (2 × seva + goal) ÷ 3
    ...netScore({ sadhana: avg?.sadhana ?? null, seva: avg?.seva ?? null, goal: st?.goalPct ?? null }),
    stages: st?.stages || [], ready: st?.ready || [], goalPct: st?.goalPct ?? null,
    totalTarget: st?.totalTarget ?? 0, totalAchieved: st?.totalAchieved ?? 0
  };
}
