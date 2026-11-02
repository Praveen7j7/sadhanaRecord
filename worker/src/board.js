// The status board: one row per devotee for a week, the batch list and the batch's filling chart.
// Split out of coord.js on 13 October 2026 (audit F27 / roadmap 3.1); the code is unchanged, only its home.
// Read by groups.js, views.js and facilitator.js as well as the coordinator screens, which is why boardRows()
// lives here rather than inside a screen's module.
import { apiError, invalid, isoIst } from './util.js';
import { q, one, all, reads, rows, scopeBatches } from './db.js';
import { requireBatch } from './requests.js';
import { COLS, parse, focusWeek } from './staff.js';
import { addDays, stateOf, validWeekId, windowOf } from './weeks.js';
import { classWeeksFor, markUsed, finalScores, markLevel, attendanceOpens, classOpensFor, classView, classWeekOf } from './classweek.js';
import { isDeleted, DELETED_NAME } from './erase.js';
import { parseIso } from './util.js';

/* ------------------------------------------------------------------------ */
/* The status board: one row per devotee for a week                          */
/* ------------------------------------------------------------------------ */

/**
 * Rows for every devotee of `batchIds` in `weekId` (members that week, any status except pending). With
 * `{ facilitator }` (a facilitator login, 4 Oct 2026): instead every devotee, any batch, whose membership that week has
 * that facilitator — read by facilitator and by login, so it never reads whole batches.
 *
 * `facilitator` is the facilitator's permanent id (Phase 24), so a past week finds the students of a facilitator who
 * has been renamed since; and each row's `facilitator` is that facilitator's name as it is now (read in the same
 * statement), the membership's own text only when it names nobody on the list.
 */
export async function boardRows(db, batchIds, weekId, { facilitator = '' } = {}) {
  if (!facilitator && !batchIds.length) return [];
  const marks = (batchIds || []).map(() => '?').join(',');
  const by = (rows) => Object.fromEntries(rows.map(r => [r.login, r]));
  let people, subs, drafts, att, missed, reopens, cws;
  if (!facilitator) {
    /* A BATCH board in ONE round trip (22 Oct 2026, B1). Every read here depends only on the batch and the week, both
       known before anything is read — the people, the four per-week tables, the open reopens and the class week —
       so they go together instead of a read, then five, then one more. The statements are the ones that ran before
       (classWeeksFor's own query included). A FACILITATOR's board (below) cannot do this: its batches and logins
       come from the people it reads first, so that path is unchanged. */
    const wk = (cols, table) => rows(q(db, `SELECT login, ${cols} FROM ${table} WHERE week_id = ? AND batch_id IN (${marks})`, weekId, ...batchIds));
    let cwRows;
    [people, subs, drafts, att, missed, reopens, cwRows] = await reads(db, [
      rows(q(db, `
    SELECT a.login, a.name, a.iyf_id, a.status, a.whatsapp, m.batch_id, m.state, m.from_week, COALESCE(f."name", m.facilitator) AS facilitator, m.class_day, m.leader_login,
           EXISTS (SELECT 1 FROM photos p WHERE p.login = a.login) AS has_photo
    FROM memberships m JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' LEFT JOIN facilitators f ON f.id = m.fac_id
    WHERE ${facilitator ? 'm.fac_id = ?' : `m.batch_id IN (${marks})`} AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)
    ORDER BY a.name`, ...(facilitator ? [facilitator] : batchIds), weekId, weekId)),
      wk(`overall, body, soul, seva, attendance, score_card, submitted_at, on_behalf, days_filled, CASE WHEN days_filled < 7 AND week_json <> '' THEN (SELECT group_concat(CASE WHEN json_extract(value, '$.sleptAt') IS NULL THEN 0 ELSE 1 END, '') FROM json_each(json_extract(week_json, '$.days'))) END AS day_mask`, 'submissions'),
      wk('d1, d2, d3, d4, d5, d6, d7, week_end', 'drafts'),
      wk('devotee_mark, leader_mark, leader_by, coordinator_mark, master_mark, mark_used, locked', 'attendance'),
      wk('days_filled', 'missed_weeks'),
      rows(q(db, "SELECT login, open_until FROM reopens WHERE week_id = ? AND state = 'OPEN'", weekId)),
      rows(q(db, `SELECT * FROM class_weeks WHERE week_id = ? AND batch_id IN (${batchIds.map(() => '?').join(',')})`, weekId, ...batchIds))
    ]);
    [subs, drafts, att, missed, reopens] = [subs, drafts, att, missed, reopens].map(by);
    cws = Object.fromEntries(cwRows.map(r => [r.batch_id, r]));
  } else {
  people = await all(db, `
    SELECT a.login, a.name, a.iyf_id, a.status, a.whatsapp, m.batch_id, m.state, m.from_week, COALESCE(f."name", m.facilitator) AS facilitator, m.class_day, m.leader_login,
           EXISTS (SELECT 1 FROM photos p WHERE p.login = a.login) AS has_photo
    FROM memberships m JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' LEFT JOIN facilitators f ON f.id = m.fac_id
    WHERE ${facilitator ? 'm.fac_id = ?' : `m.batch_id IN (${marks})`} AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)
    ORDER BY a.name`, ...(facilitator ? [facilitator] : batchIds), weekId, weekId);
  if (facilitator) batchIds = [...new Set(people.map(p => p.batch_id))];
  // by batch (a batch board), or by the people's logins in parts of 90 (a facilitator's devotees)
  const logins = facilitator ? people.map(p => p.login) : [];
  const forWeek = async (cols, table) => {
    if (!facilitator) return all(db, `SELECT login, ${cols} FROM ${table} WHERE week_id = ? AND batch_id IN (${marks})`, weekId, ...batchIds).then(by);
    const out = {};
    for (let i = 0; i < logins.length; i += 90) {
      const part = logins.slice(i, i + 90);
      for (const r of await all(db, `SELECT login, ${cols} FROM ${table} WHERE week_id = ? AND login IN (${part.map(() => '?').join(',')})`, weekId, ...part)) out[r.login] = r;
    }
    return out;
  };
  [subs, drafts, att, missed, reopens] = await Promise.all([
    // a part week: which days it counted, as '1100000' (worked out by the database, so the Worker parses no JSON)
    forWeek(`overall, body, soul, seva, attendance, score_card, submitted_at, on_behalf, days_filled, CASE WHEN days_filled < 7 AND week_json <> '' THEN (SELECT group_concat(CASE WHEN json_extract(value, '$.sleptAt') IS NULL THEN 0 ELSE 1 END, '') FROM json_each(json_extract(week_json, '$.days'))) END AS day_mask`, 'submissions'),
    forWeek('d1, d2, d3, d4, d5, d6, d7, week_end', 'drafts'),
    forWeek('devotee_mark, leader_mark, leader_by, coordinator_mark, master_mark, mark_used, locked', 'attendance'),
    forWeek('days_filled', 'missed_weeks'),
    all(db, "SELECT login, open_until FROM reopens WHERE week_id = ? AND state = 'OPEN'", weekId).then(by)
  ]);
  cws = await classWeeksFor(db, batchIds, weekId);
  }
  const seen = new Set(), out = [];
  for (const p of people) {
    if (seen.has(p.login)) continue;                 // two memberships touching the same week: the first (by name) wins
    seen.add(p.login);
    const s = subs[p.login], d = drafts[p.login], a = att[p.login], x = missed[p.login];
    const days = d ? COLS.map(c => stateOf(parse(d[c]))) : s?.day_mask?.length === 7 ? [...s.day_mask].map(c => (c === '1' ? 'complete' : 'empty')) : [];
    const used = markUsed(a, cws[p.batch_id]);
    const filled = days.filter(v => v === 'complete').length;
    let status = 'NOT_STARTED';
    if (s) status = 'SUBMITTED';
    else if (x && !reopens[p.login]) status = 'MISSED';
    else if (reopens[p.login]) status = 'REOPENED';
    else if (d) status = 'DRAFT';
    out.push({
      login: p.login, name: p.name, iyfId: p.iyf_id || null, batchId: p.batch_id, accountStatus: p.status, membership: p.state,
      facilitator: p.facilitator, classDay: p.class_day || null, whatsapp: p.whatsapp || '', hasPhoto: !!p.has_photo,
      // a part week counts its complete days (4 Oct 2026); a missed week scores 0
      status, daysFilled: s ? (s.days_filled ?? 7) : x ? x.days_filled : filled, days,
      submittedAt: s?.submitted_at || null, byCoordinator: !!s?.on_behalf, overall: s ? finalScores(s, used).overall : status === 'MISSED' ? 0 : null,
      leaderLogin: p.leader_login || null,
      // a week the IYF head reopened: open (attendance too) until then, though the week's row was locked at its deadline
      reopenUntil: reopens[p.login]?.open_until || null,
      attendance: { devotee: a?.devotee_mark || null, leader: a?.leader_mark || null, coordinator: a?.coordinator_mark || null, master: a?.master_mark || null,
                    used: used || null, by: markLevel(a, cws[p.batch_id]) || null, locked: !!a?.locked && !reopens[p.login] }
    });
  }
  return out;
}
/** Who is expected to submit a week: an ACTIVE membership and an ACTIVE devotee account. The counts on
 *  every staff screen and in the head's overview are defined by this one line. */
export const expected = r => r.membership === 'ACTIVE' && r.accountStatus === 'ACTIVE';

export async function devoteesList(d, ctx) {
  await requireBatch(ctx, d.batchId);
  if (d.status !== undefined && !['ACTIVE', 'INACTIVE', 'DISABLED'].includes(d.status)) throw invalid({ path: 'status', message: 'ACTIVE, INACTIVE or DISABLED.' });
  const weekId = d.weekId === undefined ? await focusWeek(ctx.db, ctx.now()) : d.weekId;
  if (!validWeekId(weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const rows = (await boardRows(ctx.db, [String(d.batchId)], weekId)).filter(r => !d.status || r.accountStatus === d.status);
  const win = await windowOf(ctx.db, weekId);
  // attendance can be marked from this batch's own class day until the week's deadline
  const opens = (await classOpensFor(ctx.db, d.batchId, weekId)).opens;
  return { weekId, closesAt: isoIst(win.closes), attendanceOpensAt: isoIst(opens), attendanceOpen: ctx.now() < win.closes && ctx.now() >= opens,
           classWeek: classView(await classWeekOf(ctx.db, d.batchId, weekId)), rows };
}

export async function statsBatch(d, ctx) {
  await requireBatch(ctx, d.batchId);
  const db = ctx.db, batchId = String(d.batchId), n = d.weeks === undefined ? 12 : d.weeks;
  if (!Number.isInteger(n) || n < 1 || n > 26) throw invalid({ path: 'weeks', message: '1 to 26.' });
  const weekId = await focusWeek(db, ctx.now());
  const board = await boardRows(db, [batchId], weekId), exp = board.filter(expected);
  const count = st => exp.filter(r => r.status === st).length;
  // the filling chart: for each of the last n weeks, how many of those expected submitted / missed
  const weeks = Array.from({ length: n }, (_, i) => addDays(weekId, -7 * (n - 1 - i)));
  const first = weeks[0];
  // The chart, the missed log, the pending count and the people tiles read nothing from each other: ONE round trip
  // (22 Oct 2026, B1), not six. Same statements, same rows.
  const [subs, missed, members, missedRows, pend, cur] = await reads(db, [
    // bounded at both ends (13 Oct 2026, audit P-2): `week_id >= first` alone also read every week AFTER the one
    // on screen, which on a reopened or future-dated week is wasted rows.
    rows(q(db, 'SELECT week_id, COUNT(*) AS n FROM submissions WHERE batch_id = ? AND week_id >= ? AND week_id <= ? GROUP BY week_id', batchId, first, weekId)),
    rows(q(db, 'SELECT week_id, COUNT(*) AS n FROM missed_weeks WHERE batch_id = ? AND week_id >= ? AND week_id <= ? GROUP BY week_id', batchId, first, weekId)),
    // The trend's denominator as distinct membership RANGES with a count each, not one row per devotee (audit
    // P-2, the same change as statsAll): a batch has a handful of ranges because most devotees join together.
    // A deleted devotee (no account; the membership keeps a pseudonym) still counts in the weeks they belonged.
    rows(q(db, `SELECT m.from_week, m.to_week, COUNT(DISTINCT m.login) AS n FROM memberships m LEFT JOIN accounts a ON a.login = m.login
              WHERE m.batch_id = ? AND m.state = 'ACTIVE' AND (a.role = 'DEVOTEE' OR a.login IS NULL)
                AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)
              GROUP BY m.from_week, m.to_week`, batchId, weekId, first)),
    rows(q(db, `SELECT x.login, a.name, x.week_id, x.days_filled FROM missed_weeks x LEFT JOIN accounts a ON a.login = x.login
                WHERE x.batch_id = ? AND x.week_id >= ? ORDER BY x.week_id DESC, a.name LIMIT 200`, batchId, first)),
    q(db, "SELECT COUNT(*) AS n FROM accounts WHERE status = 'PENDING' AND requested_batch = ?", batchId),
    rows(q(db, "SELECT a.status, m.state FROM memberships m JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' WHERE m.batch_id = ? AND m.to_week = ''", batchId))
  ]);
  const S = Object.fromEntries(subs.map(r => [r.week_id, r.n])), M = Object.fromEntries(missed.map(r => [r.week_id, r.n]));
  const trend = weeks.map(w => {
    const expectedN = members.reduce((a, m) => a + (m.from_week <= w && (m.to_week === '' || m.to_week >= w) ? m.n : 0), 0), s = S[w] || 0;
    return { weekId: w, expected: expectedN, submitted: s, missed: M[w] || 0, filledPct: expectedN ? Math.min(100, Math.round((s / expectedN) * 100)) : 0 };
  });
  const missedLog = missedRows
    .map(r => ({ login: r.login, name: r.name || (isDeleted(r.login) ? DELETED_NAME : r.login), weekId: r.week_id, daysFilled: r.days_filled }));
  const pending = pend.n;
  return {
    weekId,
    thisWeek: { expected: exp.length, submitted: count('SUBMITTED'), draft: count('DRAFT') + count('REOPENED'), notStarted: count('NOT_STARTED'), missed: count('MISSED'),
                // how many devotees have filled each day of the week so far (drafts and submitted)
                byDay: COLS.map((_, i) => exp.filter(r => r.status === 'SUBMITTED' || r.days[i] === 'complete').length) },
    trend,
    people: { active: cur.filter(r => r.status === 'ACTIVE' && r.state === 'ACTIVE').length, inactive: cur.filter(r => r.status === 'INACTIVE' || r.state === 'INACTIVE').length,
              disabled: cur.filter(r => r.status === 'DISABLED').length, pending },
    missedLog
  };
}

/** True while a devotee's reopened week is still open (a board row's reopenUntil): attendance can still be marked. */
export const reopenOpen = (row, now) => !!row?.reopenUntil && parseIso(row.reopenUntil) > now;
