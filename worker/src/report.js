// Admin › Reports (Phase 23 P14, docs/REPORTS_SPEC_2026-10-27.md; the head, 27 Oct 2026: "a custom-date report for the
// entire app … I select the range — phase-wise, a week or anything — click export, and it develops the report on its
// own, within the app").
//
// ONE call per report. Its own statements go in ONE reads() batch (one round trip, whatever the period): the weekly
// sums Analysis reads (batch_weeks), the Leaderboard's own statement (leaderboard.js scoresStmt) for the period and the
// one before, the people in scope, the coordinators' work from the audit log, the activity events, the promotions and
// the trainings. Beside that batch, never after it, run the functions the screens themselves use for what is theirs:
// the scoreboard (phases.js boardGet: the facilitator's scorecard), and for the head the students without a facilitator
// (facilitators.js orphans) and the possible duplicates (oversight.js). Nothing here re-works a scorecard, a board or a
// ranking: when those screens change, the report changes with them.
//
// The phone writes the report: averages, comparisons, charts and sentences are worked out there from these sums, as
// Admin › Analysis does. A blank week is never a zero: the sums keep submitted and missed apart.
//
// WHO: the head, any scope. Anyone the head gave the `reports` right (grants.js) gets their own only — a coordinator
// their class batches, a training coordinator their trainings, a facilitator their own students — and the scope is
// decided HERE, whatever was asked: a scope that is not theirs is FORBIDDEN, "all" becomes theirs.
import { apiError, invalid, csv } from './util.js';
import { q, reads, rows as allRows, batchesAll } from './db.js';
import { isTrainingBatch } from './admin.js';
import { weekView, trainingReads, trainingsView, FINAL_OVERALL } from './analysis.js';
import { scoresStmt, rank, lastClosedWeek } from './leaderboard.js';
import { boardGet, phaseList } from './phases.js';
import { orphans } from './facilitators.js';
import { idsPossibleDuplicates } from './oversight.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DAYS = 366;
/* The period before, person by person, only up to a quarter (measured 27 Oct 2026 on 5,000 devotees: the Leaderboard's
   statement reads ~4.7 rows a devotee-week, so a 12-month report compared person by person read 2.0M rows, 40% of the
   free day). Longer periods compare from the weekly sums (batch_weeks) alone: every arrow stays, the per-facilitator
   and per-batch reporting arrows go. */
export const PEOPLE_COMPARE_DAYS = 92;
/** The report's sections, in the order the screen shows them (the spec's 1–12; quiz has no data yet, so no section). */
export const SECTIONS = ['summary', 'reporting', 'quality', 'attendance', 'batches', 'facilitators', 'boards', 'trainings', 'work', 'growth', 'health', 'next'];
const KINDS = ['all', 'batch', 'facilitator', 'training'];
// the audit log lines that are the coordinators' service (section 9) and the growth (section 10)
const WORK = ['requests.approve', 'requests.reject', 'resets.approve', 'resets.reject', 'reopen.request', 'weeks.reopen', 'reopen.reject',
  'attendance.set', 'attendance.override', 'week.submit.onBehalf', 'group.mark', 'enrol.add', 'enrol.remove', 'training.attendance',
  'devotees.promote', 'batches.close', 'leaders.assign'];

const plusDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const mondayOn = (ymd) => plusDays(ymd, -((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7));
/** The Mondays of the whole weeks [from, to] holds: a week belongs to the period its Monday falls in (as the Leaderboard). */
export function weeksIn(from, to) {
  const out = [];
  for (let w = mondayOn(from) < from ? plusDays(mondayOn(from), 7) : from; w <= to; w = plusDays(w, 7)) out.push(w);
  return out;
}
const marks = (xs) => xs.map(() => '?').join(',');
const training = (b) => isTrainingBatch(b.batch_id) || String(b.level || '').toUpperCase() === 'ETP';

/* ------------------------------------------------------------------------ */
/* Who may see what                                                          */
/* ------------------------------------------------------------------------ */

/**
 * The scope the caller gets: { kind, id, label, batchIds (class batches whose sums are read), trainingIds, facId, people }.
 * `people`: null — the batches' own summary (batch_weeks); 'fac' — one facilitator's students; 'training' — enrolled
 * people. The head may ask for any; anyone else gets their own (ADR 0019: the right never opens what the role does not).
 */
function scopeFor(s, ctx, all) {
  const kind = String(s?.kind || 'all'), id = String(s?.id || '');
  if (!KINDS.includes(kind)) throw invalid({ path: 'scope.kind', message: 'All, a batch, a facilitator or a training.' });
  const cls = all.filter((b) => !training(b)), trs = all.filter(training), sc = ctx.scopes;
  const byId = (xs, x) => xs.find((b) => b.batch_id === x);
  const one = (kind_, b) => (kind_ === 'batch'
    ? { kind: 'batch', id: b.batch_id, label: b.name, batchIds: [b.batch_id], trainingIds: [], facId: '', people: null }
    : { kind: 'training', id: b.batch_id, label: b.name, batchIds: cls.map((x) => x.batch_id), trainingIds: [b.batch_id], facId: '', people: 'training' });
  const fac = (facId, label = '') => ({ kind: 'facilitator', id: facId, label, batchIds: cls.map((x) => x.batch_id), trainingIds: [], facId, people: 'fac' });
  if (sc.master) {
    if (kind === 'all') return { kind: 'all', id: '', label: 'All of IYF Delhi', batchIds: cls.map((b) => b.batch_id), trainingIds: trs.map((b) => b.batch_id), facId: '', people: null, whole: true };
    if (kind === 'facilitator') { if (!id) throw invalid({ path: 'scope.id', message: 'Choose a facilitator.' }); return fac(id); }
    const b = byId(all, id);
    if (!b) throw apiError('NOT_FOUND', 'No such batch.');
    if (kind === 'batch' && training(b)) throw invalid({ path: 'scope.id', message: `${b.name} is a training; choose it as a training.` });
    if (kind === 'training' && !training(b)) throw invalid({ path: 'scope.id', message: `${b.name} is not a training.` });
    return one(kind, b);
  }
  // given the right: their own, and nothing else
  const mineC = cls.filter((b) => sc.coordinator.includes(b.batch_id)), mineT = trs.filter((b) => sc.coordinator.includes(b.batch_id));
  const myFac = sc.facilitator ? String(ctx.acct?.fac_id || '') : '';
  const no = () => apiError('FORBIDDEN', 'That is not yours to report on.');
  if (kind === 'all') {
    if (mineC.length) return mineC.length === 1 ? { ...one('batch', mineC[0]), kind: 'batches' } : { kind: 'batches', id: '', label: 'Your batches', batchIds: mineC.map((b) => b.batch_id), trainingIds: [], facId: '', people: null };
    if (mineT.length) return mineT.length === 1 ? one('training', mineT[0]) : { ...one('training', mineT[0]), id: '', label: 'Your trainings', trainingIds: mineT.map((b) => b.batch_id) };
    if (myFac) return fac(myFac, sc.facilitator.name);
    throw apiError('FORBIDDEN', 'Reports are for your own batches, students or trainings, and you have none.');
  }
  if (kind === 'batch') { const b = byId(mineC, id); if (!b) throw no(); return one('batch', b); }
  if (kind === 'training') { const b = byId(mineT, id); if (!b) throw no(); return one('training', b); }
  if (!myFac || id !== myFac) throw no();
  return fac(myFac, sc.facilitator.name);
}

/** The logins a people-scope covers, as a subquery: a facilitator's students now, or a training's enrolled. */
const peopleSub = (S) => (S.people === 'fac'
  ? { sql: "SELECT login FROM memberships WHERE fac_id = ? AND to_week = '' AND state = 'ACTIVE'", args: [S.facId] }
  : { sql: `SELECT login FROM enrolments WHERE batch_id IN (${marks(S.trainingIds)})`, args: S.trainingIds });

/* ------------------------------------------------------------------------ */
/* report.options: what the screen may offer                                 */
/* ------------------------------------------------------------------------ */

export async function reportOptions(d, ctx) {
  const db = ctx.db, all = await batchesAll(db), sc = ctx.scopes;
  const cls = all.filter((b) => !training(b)), trs = all.filter(training);
  const [closed, ph, facs] = await Promise.all([lastClosedWeek(db, ctx.now()), phaseList({}, ctx),
    sc.master ? reads(db, [allRows(q(db, `SELECT id, "name" FROM facilitators WHERE id <> '' AND active = 1 AND deleted_at = '' ORDER BY "name"`))]).then((x) => x[0]) : []]);
  const tview = (b) => ({ id: b.batch_id, batchId: b.batch_id, name: b.name, startedOn: b.started_on || '', endsOn: b.ends_on || '', closedAt: b.closed_at || '' });
  const bview = (b) => ({ id: b.batch_id, name: b.name, active: !!b.active });
  let scopes, trainings;
  if (sc.master) {
    scopes = [{ kind: 'all', label: 'All of IYF Delhi' }, { kind: 'batch', items: cls.filter((b) => b.active).map(bview) },
      { kind: 'facilitator', items: facs.map((f) => ({ id: f.id, name: f.name })) }, { kind: 'training', items: trs.map(tview) }];
    trainings = trs.map(tview);
  } else {
    const mineC = cls.filter((b) => sc.coordinator.includes(b.batch_id)), mineT = trs.filter((b) => sc.coordinator.includes(b.batch_id));
    const myFac = sc.facilitator && ctx.acct?.fac_id ? { id: ctx.acct.fac_id, name: sc.facilitator.name } : null;
    if (!mineC.length && !mineT.length && !myFac) throw apiError('FORBIDDEN', 'Reports are for your own batches, students or trainings, and you have none.');
    const label = mineC.length ? (mineC.length > 1 ? 'Your batches' : mineC[0].name) : mineT.length ? (mineT.length > 1 ? 'Your trainings' : mineT[0].name) : 'Your students';
    scopes = [{ kind: 'all', label }, ...(mineC.length ? [{ kind: 'batch', items: mineC.map(bview) }] : []),
      ...(myFac ? [{ kind: 'facilitator', items: [myFac] }] : []), ...(mineT.length ? [{ kind: 'training', items: mineT.map(tview) }] : [])];
    trainings = mineT.map(tview);
  }
  return { lastClosed: closed, maxDays: MAX_DAYS, sections: SECTIONS, scopes, trainings,
           phases: ph.phases.map((p) => ({ phaseId: p.phaseId, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn })) };
}

/* ------------------------------------------------------------------------ */
/* report.get                                                                 */
/* ------------------------------------------------------------------------ */

const blank = () => ({ people: 0, never: 0, filled: 0, due: 0, score: 0 });
/** The Leaderboard's per-person rows → reporting by batch and by facilitator: weeks due, filled, never filled, score. */
function groups(rowsIn, facOf) {
  const out = { total: blank(), byBatch: {}, byFac: {} };
  for (const r of rowsIn) {
    const filled = r.weeks - r.missed;
    for (const g of [out.total, out.byBatch[r.batch_id] ||= blank(), out.byFac[facOf(r.login)] ||= blank()]) {
      g.people += 1; g.due += r.weeks; g.filled += filled; g.score += r.total; if (!filled) g.never += 1;
    }
  }
  return out;
}
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const hoursBetween = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) && y >= x ? (y - x) / 36e5 : null; };

export async function reportGet(d, ctx) {
  const db = ctx.db, from = String(d.from || ''), to = String(d.to || '');
  if (!YMD.test(from)) throw invalid({ path: 'from', message: 'A date, as 2026-09-01.' });
  if (!YMD.test(to)) throw invalid({ path: 'to', message: 'A date, as 2026-10-31.' });
  if (to < from) throw invalid({ path: 'to', message: 'The end comes after the start.' });
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  if (days > MAX_DAYS) throw invalid({ path: 'to', message: 'At most a year (366 days) at a time. Choose a shorter period.' });
  if (d.sections !== undefined && (!Array.isArray(d.sections) || !d.sections.length || d.sections.some((x) => !SECTIONS.includes(x))))
    throw invalid({ path: 'sections', message: 'Choose the sections.' });
  const want = new Set(d.sections || SECTIONS), has = (...xs) => xs.some((x) => want.has(x));
  if (d.scope !== undefined && (!d.scope || typeof d.scope !== 'object' || Array.isArray(d.scope))) throw invalid({ path: 'scope', message: 'Choose what to report on.' });
  const all = await batchesAll(db), S = scopeFor(d.scope, ctx, all), head = !!ctx.scopes.master;
  const compare = d.compare === true;
  const cmpFrom = plusDays(from, -days), cmpTo = plusDays(from, -1);

  // what each section needs; an unticked section is not read at all
  const needWeeks = has('summary', 'reporting', 'quality', 'attendance', 'batches', 'next');
  const needPeople = has('summary', 'reporting', 'facilitators', 'boards', 'health', 'next');
  const needBoard = has('facilitators', 'boards') && (head || S.people === 'fac' || S.kind === 'training');
  const needWork = has('work', 'growth', 'summary', 'next') && S.people !== 'fac';
  const needGrowth = has('growth', 'summary', 'next');
  const needTrain = has('trainings', 'summary', 'next') && S.trainingIds.length > 0;
  const needHealth = has('health', 'summary', 'next');

  // the last closed week (the Leaderboard's own rule, from Settings) and, for the scoreboard, the phases
  const [closed, ph] = await Promise.all([lastClosedWeek(db, ctx.now()), needBoard ? phaseList({}, ctx) : null]);
  const last = to < closed ? to : closed, cmpLast = cmpTo < closed ? cmpTo : closed;
  const weeks = weeksIn(from, last), cmpWeeks = compare ? weeksIn(cmpFrom, cmpLast) : [];
  const span0 = compare ? cmpFrom : from, dayEnd = plusDays(to, 1);

  /* ---------- the statements, all in one batch ---------- */
  const list = [], at = {};
  const add = (key, stmt) => { at[key] = list.length; list.push(stmt); };
  const P = S.people ? peopleSub(S) : null;
  if (needWeeks) {
    if (!S.people) {
      const only = S.whole ? '' : ` AND batch_id IN (${marks(S.batchIds)})`;
      add('weeks', allRows(q(db, `SELECT * FROM batch_weeks WHERE week_id >= ? AND week_id <= ?${only} ORDER BY week_id, batch_id`, span0, last, ...(S.whole ? [] : S.batchIds))));
    } else {
      // a facilitator's students or a training's people: the same sums as batch_weeks (analysis.js refreshWeeks), over
      // their own weeks only — read by login, through the (login, week_id) keys
      // the FINAL overall, as the summary sums it (analysis.js FINAL_OVERALL: the mark that counts, not the one at submit)
      add('pw.s', allRows(q(db, `SELECT sb.batch_id, sb.week_id, COUNT(*) AS submitted, SUM(${FINAL_OVERALL}) AS sum_overall, SUM(sb.body) AS sum_body, SUM(sb.soul) AS sum_soul,
                                        SUM(sb.bed) AS sum_bed, SUM(sb.wake_up) AS sum_wake, SUM(sb.avg_rounds <> '') AS n_rounds,
                                        SUM(CASE WHEN sb.avg_rounds <> '' THEN CAST(sb.avg_rounds AS REAL) ELSE 0 END) AS sum_rounds,
                                        SUM(sb.reading_minutes) AS sum_reading, SUM(sb.hearing_minutes) AS sum_hearing, SUM(sb.seva_minutes) AS sum_seva,
                                        SUM(sb.night_stay = 'YES') AS night_yes, SUM(sb.principles = 'YES') AS principles_yes, COUNT(sb.morning) AS n_morning, SUM(sb.morning) AS sum_morning
                                   FROM submissions sb
                                   LEFT JOIN attendance aa ON aa.login = sb.login AND aa.week_id = sb.week_id
                                   LEFT JOIN class_weeks cc ON cc.batch_id = sb.batch_id AND cc.week_id = sb.week_id
                                  WHERE sb.login IN (${P.sql}) AND sb.week_id >= ? AND sb.week_id <= ? GROUP BY sb.batch_id, sb.week_id`, ...P.args, span0, last)));
      add('pw.x', allRows(q(db, `SELECT batch_id, week_id, COUNT(*) AS missed FROM missed_weeks WHERE login IN (${P.sql}) AND week_id >= ? AND week_id <= ? GROUP BY batch_id, week_id`, ...P.args, span0, last)));
      add('pw.a', allRows(q(db, `SELECT batch_id, week_id, SUM(mark_used = 'P') AS present, SUM(mark_used <> '') AS held FROM attendance
                                  WHERE login IN (${P.sql}) AND week_id >= ? AND week_id <= ? GROUP BY batch_id, week_id`, ...P.args, span0, last)));
    }
  }
  if (needPeople) {
    // the Leaderboard's own statement (leaderboard.js) for the period and the one before: one row per person
    if (S.batchIds.length && from <= last) add('lb', allRows(scoresStmt(db, S.batchIds, from, last)));
    if (compare && days <= PEOPLE_COMPARE_DAYS && S.batchIds.length && cmpFrom <= cmpLast) add('lb.c', allRows(scoresStmt(db, S.batchIds, cmpFrom, cmpLast)));
  }
  if (needPeople || needHealth || needGrowth || has('facilitators')) {
    // the people in scope NOW: their batch, their facilitator (by id), whether their profile is complete, their birthday
    const cols = `m.login, m.batch_id, m.fac_id, m.facilitator, m.state, a.status, p.dob, (p.login IS NULL OR p.dob = '' OR p.addr_line = '') AS no_profile`;
    const join = `JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' LEFT JOIN profiles p ON p.login = m.login`;
    add('people', allRows(!S.people ? q(db, `SELECT ${cols} FROM memberships m ${join} WHERE m.batch_id IN (${marks(S.batchIds)}) AND m.to_week = ''`, ...S.batchIds)
      : S.people === 'fac' ? q(db, `SELECT ${cols} FROM memberships m ${join} WHERE m.fac_id = ? AND m.to_week = ''`, S.facId)
        : q(db, `SELECT DISTINCT ${cols} FROM enrolments e JOIN memberships m ON m.login = e.login AND m.to_week = '' ${join} WHERE e.batch_id IN (${marks(S.trainingIds)})`, ...S.trainingIds)));
  }
  if (has('facilitators') || S.people === 'fac') {
    add('facs', allRows(q(db, `SELECT id, "name", login, active FROM facilitators WHERE id <> ''`)));
    add('facAccts', allRows(q(db, "SELECT login, fac_id FROM accounts WHERE facilitator_name <> ''")));
  }
  if (has('facilitators', 'growth', 'summary', 'next')) {
    // promotions in the period: the membership a promotion opened (closing.js), with the facilitator it carried over
    const into = all.filter((b) => !training(b)).map((b) => b.batch_id);
    add('promo', allRows(q(db, `SELECT batch_id, fac_id, reason, CASE WHEN from_week >= ? THEN 1 ELSE 0 END AS cur, COUNT(*) AS n FROM memberships
                                 WHERE batch_id IN (${marks(into)}) AND from_week >= ? AND from_week <= ? AND reason LIKE 'promoted from%'
                                 GROUP BY batch_id, fac_id, reason, cur`, from, ...into, span0, to)));
  }
  if (needWork) {
    add('work', allRows(q(db, `SELECT l.action, l.who, MAX(a.name) AS name, l.batch_id, CASE WHEN l.at >= ? THEN 1 ELSE 0 END AS cur, COUNT(*) AS n
                                 FROM audit_log l LEFT JOIN accounts a ON a.login = l.who
                                WHERE l.at >= ? AND l.at < ? AND l.action IN (${marks(WORK)}) GROUP BY l.action, l.who, l.batch_id, cur`, from, span0, dayEnd, ...WORK)));
    // how fast a sign-up was answered: from the sign-up to the decision
    add('speed', allRows(q(db, `SELECT l.batch_id, l.at, a.signup_at, CASE WHEN l.at >= ? THEN 1 ELSE 0 END AS cur FROM audit_log l JOIN accounts a ON a.login = l.target
                                 WHERE l.at >= ? AND l.at < ? AND l.action IN ('requests.approve', 'requests.reject')`, from, span0, dayEnd)));
    add('waiting', allRows(q(db, "SELECT requested_batch AS batch_id, COUNT(*) AS n, MIN(signup_at) AS oldest FROM accounts WHERE signup_state = 'PENDING' GROUP BY requested_batch")));
  }
  if (needGrowth) {
    add('events', allRows(P
      ? q(db, `SELECT batch_id, change, how, CASE WHEN day >= ? THEN 1 ELSE 0 END AS cur, COUNT(*) AS n FROM activity_events
                WHERE day >= ? AND day <= ? AND login IN (${P.sql}) GROUP BY batch_id, change, how, cur`, from, span0, to, ...P.args)
      : q(db, `SELECT batch_id, change, how, CASE WHEN day >= ? THEN 1 ELSE 0 END AS cur, COUNT(*) AS n FROM activity_events
                WHERE day >= ? AND day <= ? GROUP BY batch_id, change, how, cur`, from, span0, to)));
  }
  if (needTrain) {
    const tr = trainingReads(db, S.trainingIds, span0, last);
    at.train = list.length; list.push(...tr);
    const coords = [...new Set(all.filter((b) => S.trainingIds.includes(b.batch_id)).flatMap((b) => csv(b.coordinator_logins)))];
    if (coords.length) add('coords', allRows(q(db, `SELECT login, name FROM accounts WHERE login IN (${marks(coords)})`, ...coords)));
  }

  // the scoreboard, and the head's two existing checks, BESIDE the batch (their own reads, at the same time)
  const boardWeek = weeks.length ? weeks[weeks.length - 1] : '';
  const boardOf = async () => {
    if (!needBoard || !boardWeek) return null;
    try {
      if (S.kind === 'training') return await boardGet({ batchId: S.trainingIds[0], weekId: boardWeek }, ctx);
      const end = plusDays(boardWeek, 6), phase = (ph?.phases || []).find((p) => p.startsOn <= end && p.endsOn >= boardWeek);
      return phase ? await boardGet({ phaseId: phase.phaseId, weekId: boardWeek }, ctx) : null;
    } catch (e) { if (e?.code === 'FORBIDDEN' || e?.code === 'NOT_FOUND') return null; throw e; }
  };
  const headChecks = head && needHealth && (S.kind === 'all' || S.kind === 'batch');
  const [got, board, orph, dups] = await Promise.all([reads(db, list), boardOf(),
    headChecks ? orphans({}, ctx) : null, headChecks && S.kind === 'all' ? idsPossibleDuplicates({}, ctx) : null]);
  const R = (k) => (at[k] === undefined ? null : got[at[k]]);

  /* ---------- the facilitator scope is checked against the list it read ---------- */
  const facRows = R('facs') || [], facById = Object.fromEntries(facRows.map((f) => [f.id, f]));
  if (S.people === 'fac') {
    if (!facById[S.facId]) throw apiError('NOT_FOUND', 'No such facilitator.');
    S.label = facById[S.facId].name;
  }

  /* ---------- the weekly sums ---------- */
  let sadhana = null;
  if (needWeeks) {
    if (!S.people) sadhana = R('weeks').map(weekView);
    else {
      // the keys a week has a summary row for: someone submitted or missed it (as refreshWeeks), sorted as Analysis
      const key = (r) => r.batch_id + '|' + r.week_id, map = new Map();
      for (const r of [...R('pw.s'), ...R('pw.x')]) map.set(key(r), { batch_id: r.batch_id, week_id: r.week_id });
      const s = Object.fromEntries(R('pw.s').map((r) => [key(r), r])), x = Object.fromEntries(R('pw.x').map((r) => [key(r), r])),
        a = Object.fromEntries(R('pw.a').map((r) => [key(r), r]));
      const SUM = ['submitted', 'sum_overall', 'sum_body', 'sum_soul', 'sum_bed', 'sum_wake', 'n_rounds', 'sum_rounds', 'sum_reading', 'sum_hearing',
        'sum_seva', 'night_yes', 'principles_yes', 'n_morning', 'sum_morning'];
      sadhana = [...map.entries()].sort(([, p], [, q2]) => (p.week_id < q2.week_id ? -1 : p.week_id > q2.week_id ? 1 : p.batch_id < q2.batch_id ? -1 : 1))
        .map(([k, r]) => weekView({ ...r, ...Object.fromEntries(SUM.map((f) => [f, s[k]?.[f] ?? 0])), missed: x[k]?.missed ?? 0,
          present: a[k]?.present ?? 0, held: a[k]?.held ?? 0 }));
    }
  }

  /* ---------- the people ---------- */
  const people = R('people');
  const inScope = people ? new Set(people.map((p) => p.login)) : null;
  const facOfLogin = Object.fromEntries((people || []).map((p) => [p.login, p.fac_id || '']));
  const facOf = (login) => (login in facOfLogin ? facOfLogin[login] : '-');
  const only = (rs) => (S.people ? rs.filter((r) => inScope.has(r.login)) : rs);
  const lbCur = R('lb') ? only(R('lb')) : null, lbCmp = R('lb.c') ? only(R('lb.c')) : null;
  const active = (people || []).filter((p) => p.state === 'ACTIVE' && p.status === 'ACTIVE');
  const count = (xs, k) => xs.reduce((o, p) => { o[k(p)] = (o[k(p)] || 0) + 1; return o; }, {});
  const students = people ? { total: active.length, byBatch: count(active, (p) => p.batch_id), byFac: count(active, (p) => p.fac_id || '') } : null;
  const reporting = needPeople ? { cur: groups(lbCur || [], facOf), cmp: lbCmp ? groups(lbCmp, facOf) : null } : null;

  /* ---------- promotions ---------- */
  const promo = R('promo'), fromOf = (reason) => String(reason).replace(/^promoted from\s*/, '').trim();
  const promoIn = (r) => (S.whole ? true : S.people === 'fac' ? r.fac_id === S.facId : S.people === 'training' ? false : S.batchIds.includes(fromOf(r.reason)));
  const promoted = (cur) => (promo || []).filter((r) => !!r.cur === cur && promoIn(r));

  /* ---------- the scoreboard ---------- */
  const acctFac = Object.fromEntries((R('facAccts') || []).map((r) => [r.login, r.fac_id]));
  const facOfBoardLogin = (login) => facRows.find((f) => f.login === login)?.id || acctFac[login] || '';
  let boardOut = null;
  if (board) {
    // the head's report on one batch: the facilitators of its students; on one facilitator: theirs alone
    const keep = S.kind === 'batch' && board.kind === 'facilitators' ? new Set(Object.keys(students?.byFac || {}))
      : S.people === 'fac' && board.kind === 'facilitators' ? new Set([S.facId]) : null;
    const shown = keep ? board.rows.filter((r) => keep.has(facOfBoardLogin(r.login))) : board.rows;
    boardOut = { ...board, of: keep ? shown.length : board.of, rows: shown };
  }

  /* ---------- the facilitators ---------- */
  let facilitators = null;
  if (has('facilitators')) {
    const card = (r) => r && { seva: r.seva, sadhana: r.sadhana, goal: r.goal, rank: r.rank, place: r.place, weeksFilled: r.weeksFilled, weeks: r.weeks, filled: r.filled, asked: r.asked };
    const rowOf = Object.fromEntries((board?.kind === 'facilitators' ? board.rows : []).map((r) => [facOfBoardLogin(r.login), r]));
    const ids = new Set([...Object.keys(students?.byFac || {}), ...Object.keys(reporting?.cur.byFac || {}),
      ...(S.whole ? Object.keys(rowOf) : [])].filter((id) => id && id !== '-' && facById[id] && (S.people !== 'fac' || id === S.facId)));
    const promoBy = promoted(true).reduce((o, r) => { o[r.fac_id] = (o[r.fac_id] || 0) + r.n; return o; }, {});
    facilitators = [...ids].map((id) => ({ facId: id, name: facById[id].name, login: facById[id].login || '', active: !!facById[id].active,
      students: students?.byFac[id] || 0, promoted: promoBy[id] || 0, card: card(rowOf[id]) || null }))
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  }

  /* ---------- the coordinators' work ---------- */
  const workIn = (r) => S.whole || S.batchIds.includes(r.batch_id) && !S.people || S.trainingIds.includes(r.batch_id) && S.people === 'training';
  let work = null;
  if (needWork) {
    const sum = (cur) => {
      const rs = R('work').filter((r) => !!r.cur === cur && workIn(r)), n = (a) => rs.filter((r) => r.action === a).reduce((k, r) => k + r.n, 0);
      const speed = R('speed').filter((r) => !!r.cur === cur && workIn(r)).map((r) => hoursBetween(r.signup_at, r.at)).filter((h) => h !== null);
      return { approved: n('requests.approve'), rejected: n('requests.reject'), resets: n('resets.approve'), resetsRejected: n('resets.reject'),
        reopenAsked: n('reopen.request'), reopened: n('weeks.reopen'), reopenRejected: n('reopen.reject'), attendance: n('attendance.set') + n('training.attendance'),
        attendanceLate: n('attendance.override'), filledFor: n('week.submit.onBehalf'), groupMarks: n('group.mark'), enrolled: n('enrol.add'), unenrolled: n('enrol.remove'),
        promotions: n('devotees.promote'), closings: n('batches.close'), decisions: speed.length, medianHours: median(speed) };
    };
    const byWho = {};
    for (const r of R('work').filter((x) => x.cur && workIn(x))) {
      const w = (byWho[r.who] ||= { who: r.who, name: r.name || r.who, actions: 0, approved: 0, attendance: 0, resets: 0, reopens: 0 });
      w.actions += r.n;
      if (r.action === 'requests.approve' || r.action === 'requests.reject') w.approved += r.n;
      if (r.action === 'attendance.set' || r.action === 'training.attendance' || r.action === 'group.mark') w.attendance += r.n;
      if (r.action === 'resets.approve' || r.action === 'resets.reject') w.resets += r.n;
      if (r.action === 'weeks.reopen' || r.action === 'reopen.request' || r.action === 'reopen.reject') w.reopens += r.n;
    }
    const wait = R('waiting').filter((r) => S.whole || S.batchIds.includes(r.batch_id) && !S.people);
    work = { cur: sum(true), cmp: compare ? sum(false) : null, byWho: Object.values(byWho).sort((a, b) => b.actions - a.actions).slice(0, 20),
      waiting: { signups: wait.reduce((k, r) => k + r.n, 0), oldest: wait.map((r) => r.oldest).filter(Boolean).sort()[0] || '' } };
  }

  /* ---------- growth and care ---------- */
  let growth = null;
  if (needGrowth) {
    const evIn = (r) => S.whole || !!S.people || S.batchIds.includes(r.batch_id);
    const ev = (cur, change) => (R('events') || []).filter((r) => !!r.cur === cur && r.change === change && evIn(r)).reduce((k, r) => k + r.n, 0);
    const lvl = Object.fromEntries(all.map((b) => [b.batch_id, b.level]));
    const byLevel = promoted(true).reduce((o, r) => { const l = lvl[r.batch_id] || r.batch_id; o[l] = (o[l] || 0) + r.n; return o; }, {});
    // birthdays in the period among the people in scope now (month and day)
    const md = (ymd) => ymd.slice(5), a0 = md(from), z0 = md(to), wraps = days >= 366 || from.slice(0, 4) !== to.slice(0, 4) && a0 > z0 || days > 365;
    const inside = (dob) => { if (!dob || dob.length < 10) return false; const x = md(dob); return days >= 365 || (a0 <= z0 && !wraps ? x >= a0 && x <= z0 : x >= a0 || x <= z0); };
    const joined = (cur) => (needWork ? R('work').filter((r) => !!r.cur === cur && r.action === 'requests.approve' && workIn(r)).reduce((k, r) => k + r.n, 0) : null);
    growth = { cur: { joined: joined(true), promoted: promoted(true).reduce((k, r) => k + r.n, 0), inactive: ev(true, 'INACTIVE'), back: ev(true, 'ACTIVE'),
                      birthdays: active.filter((p) => inside(p.dob)).length },
               cmp: compare ? { joined: joined(false), promoted: promoted(false).reduce((k, r) => k + r.n, 0), inactive: ev(false, 'INACTIVE'), back: ev(false, 'ACTIVE') } : null,
               promotedByLevel: Object.entries(byLevel).map(([level, n]) => ({ level, n })) };
  }

  /* ---------- data health ---------- */
  let health = null;
  if (needHealth) {
    const orphanN = orph ? orph.students.filter((x) => S.whole || S.batchIds.includes(x.batchId)).length : null;
    health = { people: active.length, noFacilitator: active.filter((p) => !p.fac_id && !p.facilitator).length,
      missingProfile: active.filter((p) => p.no_profile).length, orphans: orphanN, duplicates: dups ? dups.total : null,
      waiting: work ? work.waiting.signups : null };
  }

  /* ---------- the trainings ---------- */
  let trainings = needTrain ? [] : null;
  if (needTrain) {
    const g = got.slice(at.train, at.train + 3), names = Object.fromEntries((R('coords') || []).map((r) => [r.login, r.name]));
    trainings = trainingsView(all, S.trainingIds, g[0], g[1], g[2]).map((x) => {
      const b = all.find((y) => y.batch_id === x.batchId);
      return { ...x, endsOn: b?.ends_on || '', coordinators: csv(b?.coordinator_logins).map((l) => names[l] || l) };
    });
  }

  const lbOut = has('boards') && lbCur ? (() => { const ranked = rank(lbCur); return { from, to: last, total: ranked.length, rows: ranked.slice(0, 10) }; })() : null;
  const inScopeBatches = all.filter((b) => S.whole || S.batchIds.includes(b.batch_id) || S.trainingIds.includes(b.batch_id)
    || (sadhana || []).some((w) => w.batchId === b.batch_id));
  return {
    from, to, days, lastClosed: closed, weeks,
    compare: compare ? { from: cmpFrom, to: cmpTo, weeks: cmpWeeks } : null,
    scope: { kind: S.kind, id: S.id, label: S.label, batchIds: S.people ? [] : S.batchIds, trainingIds: S.trainingIds, facId: S.facId },
    sections: SECTIONS.filter((s) => want.has(s)),
    batches: inScopeBatches.map((b) => ({ batchId: b.batch_id, name: b.name, level: b.level, training: training(b), active: !!b.active })),
    sadhana, people: reporting, students,
    facilitators, board: has('boards', 'facilitators') ? boardOut : null, leaderboard: lbOut,
    trainings, work: has('work', 'summary', 'next') ? work : null, growth, health
  };
}
