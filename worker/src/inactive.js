// Automatic inactive (Phase 23, ADR 0020; the head, 27 Oct 2026; migration 0071). It replaces the Phase 22 "Inactive?"
// requests (migration 0066's table stays, unused).
//
//   inactive  the daily job (dailyInactive, index.js, 00:13 IST): an ACTIVE devotee whose open ACTIVE membership began at
//             least 30 days ago becomes inactive when, for 30 days, BOTH are silent: no day of sadhana saved (a draft
//             saved, a week submitted, or a part week dropped at the deadline with days in it) AND no use of the app
//             (a sign-in or a signed-in call). Set-based: one INSERT … SELECT picks them into activity_events, and
//             four keyed statements change their memberships and set accounts.auto_inactive. No loop in the Worker.
//             Nothing before settings.tracking_from counts: the 30 days start at the first tracked week (the release).
//   active    filling a day or submitting a week (weeks.js) brings back anyone inactive — the app's or a coordinator's
//             (how = FILLED); using the app (session.js, auth.js sign-in) brings back only those the APP made inactive
//             (accounts.auto_inactive, read with the account on every call, so it costs nothing until it is 1; how = APP).
//             A coordinator's "Mark inactive" stays until a filled day or "Make active again" (devotees.js, MANUAL).
//   notices   activity.notices: the last 14 days of changes, a coordinator's class batches, the head all of IYF.
//   analysis  activity.stats: now (active and inactive per batch), month by month, and day by day for a month.
//
// "Inactive" is the open membership's state; the account stays ACTIVE, the login works (devotees.js effective()).
import { apiError, invalid, isoIst, ymd, mondayOf } from './util.js';
import { q, all, reads, rows, audit, batchesAll, scopeBatches } from './db.js';

/** Days of silence, of both kinds, before the app makes someone inactive. */
export const DAYS = 30;
const DAY_MS = 86400000;
const plusDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const AUTO_REASON = 'auto: 30 days with no day filled and no use of the app';
/** A training (ETP now; MTP/FTP later) is not a class batch: its people are counted in their own batch. */
const isTraining = (b) => String(b.level || '').toUpperCase() === 'ETP' || /^(ETP|MTP|FTP)-\d+$/.test(String(b.batch_id || ''));

/**
 * The once-a-day job. Returns '' when it is not due (tracking not started, or the 30 days still reach back before it),
 * else a line for the log. Safe to run twice: everything it changes is keyed on today's AUTO events and on ACTIVE states.
 */
export async function dailyInactive(db, now = new Date()) {
  const from = String((await all(db, "SELECT value FROM settings WHERE key = 'tracking_from'"))[0]?.value || '');
  const cut = new Date(now.getTime() - DAYS * DAY_MS), cutoff = isoIst(cut), cutDay = cutoff.slice(0, 10);
  if (!from || cutDay < from) return '';
  const day = ymd(now), at = isoIst(now), week = mondayOf(now), lastWeek = plusDays(week, -7);
  const today = "SELECT login FROM activity_events WHERE day = ? AND how = 'AUTO' AND change = 'INACTIVE'";
  const res = await db.batch(dailyStatements(db, { day, at, cutoff, cutDay, week, lastWeek, today }));
  const n = res?.[0]?.meta?.changes ?? 0;
  return n ? `${n} made inactive (no day filled and no use of the app since ${cutDay})` : 'nobody to make inactive';
}

function dailyStatements(db, { day, at, cutoff, cutDay, week, lastWeek, today }) {
  return [
    // 1. who: their open ACTIVE membership began on or before the cut-off, and both kinds of activity are silent since it
    q(db, `INSERT INTO activity_events (login, batch_id, day, change, how, at, by_login)
           SELECT a.login, MIN(m.batch_id), ?, 'INACTIVE', 'AUTO', ?, 'SYSTEM'
             FROM accounts a JOIN memberships m ON m.login = a.login AND m.to_week = '' AND m.state = 'ACTIVE' AND m.from_week <= ?
            WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE' AND a.last_login_at < ?
              AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.login = a.login AND s.last_used_at >= ?)
              AND NOT EXISTS (SELECT 1 FROM drafts d WHERE d.login = a.login AND d.updated_at >= ?)
              AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.login = a.login AND s.submitted_at >= ?)
              AND NOT EXISTS (SELECT 1 FROM missed_weeks x WHERE x.login = a.login AND x.days_filled > 0 AND x.at >= ?)
              AND NOT EXISTS (SELECT 1 FROM activity_events e WHERE e.day = ? AND e.how = 'AUTO' AND e.login = a.login)
            GROUP BY a.login`, day, at, cutDay, cutoff, cutoff, cutoff, cutoff, cutoff, day),
    // 2–4. their membership is INACTIVE from this week: a new row when the active one began before it, else in place
    q(db, `INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, class_day, facilitator, fac_id, leader_login, set_by, set_at, reason)
           SELECT m.login, m.iyf_id, m.batch_id, 'INACTIVE', ?, m.level_entry_date, m.class_day, m.facilitator, m.fac_id, m.leader_login, 'SYSTEM', ?, ?
             FROM memberships m WHERE m.to_week = '' AND m.state = 'ACTIVE' AND m.from_week < ? AND m.login IN (${today})`, week, at, AUTO_REASON, week, day),
    q(db, `UPDATE memberships SET to_week = ? WHERE to_week = '' AND state = 'ACTIVE' AND from_week < ? AND login IN (${today})`, lastWeek, week, day),
    q(db, `UPDATE memberships SET state = 'INACTIVE', set_by = 'SYSTEM', set_at = ?, reason = ? WHERE to_week = '' AND state = 'ACTIVE' AND from_week >= ? AND login IN (${today})`, at, AUTO_REASON, week, day),
    // 5. the flag that lets using the app bring them back (and only them)
    q(db, `UPDATE accounts SET auto_inactive = 1 WHERE auto_inactive = 0 AND login IN (${today})`, day),
    // 6. one Activity line with how many
    q(db, `INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id)
           SELECT ?, 'SYSTEM', 'SYSTEM', 'inactive.auto', '', '', '', json_object('day', ?, 'count', COUNT(*)), ?, ''
             FROM activity_events WHERE day = ? AND how = 'AUTO' AND change = 'INACTIVE' AND at = ? HAVING COUNT(*) > 0`,
      at, day, `no day filled and no use of the app for ${DAYS} days`, day, at)
  ];
}

/**
 * Back to active (set-based on the login, so two paths at once change it once): the event first (only while the open
 * membership is INACTIVE), then the membership ACTIVE from `from` (a new row, or in place when the inactive stretch began
 * that week or later), the flag cleared, and an Activity line. `how`: FILLED, APP or MANUAL.
 */
export function comeBackStatements(db, ctx, { login, from, how, at, requestId = '' }) {
  const day = at.slice(0, 10), open = "login = ? AND to_week = '' AND state = 'INACTIVE'";
  const reason = how === 'APP' ? 'came back: used the app' : how === 'FILLED' ? 'came back: filled a day' : 'reactivated';
  return [
    q(db, `INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id)
           SELECT ?, ?, ?, 'inactive.cameBack', ?, batch_id, '{"state":"INACTIVE"}', json_object('state', 'ACTIVE', 'fromWeek', CASE WHEN from_week >= ? THEN from_week ELSE ? END, 'how', ?), ?, ?
             FROM memberships WHERE ${open} LIMIT 1`, at, ctx.login || login, ctx.role || 'DEVOTEE', login, from, from, how, reason, String(requestId || ''), login),
    q(db, `INSERT INTO activity_events (login, batch_id, day, change, how, at, by_login)
           SELECT login, batch_id, ?, 'ACTIVE', ?, ?, ? FROM memberships WHERE ${open} LIMIT 1`, day, how, at, ctx.login || login, login),
    q(db, `INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, class_day, facilitator, fac_id, leader_login, set_by, set_at, reason)
           SELECT login, iyf_id, batch_id, 'ACTIVE', ?, level_entry_date, class_day, facilitator, fac_id, leader_login, ?, ?, ? FROM memberships WHERE ${open} AND from_week < ?`,
      from, ctx.login || login, at, reason, login, from),
    q(db, `UPDATE memberships SET to_week = ? WHERE ${open} AND from_week < ?`, plusDays(from, -7), login, from),
    q(db, `UPDATE memberships SET state = 'ACTIVE', set_by = ?, set_at = ?, reason = ? WHERE ${open} AND from_week >= ?`, ctx.login || login, at, reason, login, from),
    q(db, 'UPDATE accounts SET auto_inactive = 0 WHERE login = ? AND auto_inactive = 1', login)
  ];
}

/** A manual change (devotees.setActive) as an event, so the analysis counts it too. */
export const manualEvent = (db, ctx, { login, batchId, change, at }) =>
  q(db, `INSERT INTO activity_events (login, batch_id, day, change, how, at, by_login) VALUES (?, ?, ?, ?, 'MANUAL', ?, ?)`, login, batchId, at.slice(0, 10), change, at, ctx.login);

/** The class batches the caller looks after: the head all, a coordinator theirs; `batchId` narrows to one of them. */
async function scopeOf(ctx, batchId) {
  const all_ = await batchesAll(ctx.db), mine = new Set(await scopeBatches(ctx.db, ctx));
  const cls = all_.filter(b => !isTraining(b) && mine.has(b.batch_id));
  if (batchId !== undefined && batchId !== '') {
    const b = cls.find(x => x.batch_id === String(batchId));
    if (!b) throw apiError('FORBIDDEN', 'That batch is not yours.');
    return [b];
  }
  return cls;
}

/** Home's notices: who became inactive and who came back in the last 14 days, newest first (at most 60). */
export async function activityNotices(d, ctx) {
  const batches = await scopeOf(ctx), ids = batches.map(b => b.batch_id);
  const since = plusDays(ymd(ctx.now()), -13);
  if (!ids.length) return { since, events: [] };
  const ev = await all(ctx.db, `SELECT e.id, e.login, a.name, e.batch_id, e.day, e.change, e.how, e.at, e.by_login FROM activity_events e
                                  LEFT JOIN accounts a ON a.login = e.login
                                 WHERE e.batch_id IN (${ids.map(() => '?').join(',')}) AND e.day >= ? ORDER BY e.id DESC LIMIT 60`, ...ids, since);
  return { since, events: ev.map(x => ({ id: x.id, login: x.login, name: x.name || x.login, batchId: x.batch_id, day: x.day, change: x.change, how: x.how, at: x.at, by: x.by_login })) };
}

/**
 * The analysis: now (active and inactive per batch, in total), month by month for the last 12 months, and day by day
 * for one month (default this one). Three grouped reads in one round trip, over the indexed (batch_id, day) range.
 */
export async function activityStats(d, ctx) {
  const month = d.month === undefined || d.month === '' ? ymd(ctx.now()).slice(0, 7) : String(d.month);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw invalid({ path: 'month', message: 'A month, as 2026-10.' });
  const batches = await scopeOf(ctx, d.batchId), ids = batches.map(b => b.batch_id);
  const thisMonth = ymd(ctx.now()).slice(0, 7), [ty, tm] = thisMonth.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(ty, tm - 1 - (11 - i), 1)).toISOString().slice(0, 7));
  const empty = { month, batches: [], totals: { active: 0, inactive: 0 }, months: months.map(m => ({ month: m, inactive: 0, active: 0, auto: 0, manual: 0, filled: 0, app: 0 })), days: [] };
  if (!ids.length) return empty;
  const marks = ids.map(() => '?').join(',');
  const [now_, byMonth, byDay] = await reads(ctx.db, [
    // the counts now: "active" = an open ACTIVE membership and an ACTIVE account (devotees.js effective()); a disabled
    // login is neither
    rows(q(ctx.db, `SELECT m.batch_id, SUM(a.status = 'ACTIVE' AND m.state = 'ACTIVE') AS active,
                           SUM(a.status <> 'DISABLED' AND (a.status = 'INACTIVE' OR m.state = 'INACTIVE')) AS inactive
                      FROM memberships m JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE'
                     WHERE m.to_week = '' AND m.batch_id IN (${marks}) GROUP BY m.batch_id`, ...ids)),
    rows(q(ctx.db, `SELECT substr(day, 1, 7) AS month, change, how, COUNT(*) AS n FROM activity_events
                     WHERE batch_id IN (${marks}) AND day >= ? GROUP BY 1, 2, 3`, ...ids, months[0] + '-01')),
    rows(q(ctx.db, `SELECT day, change, COUNT(*) AS n FROM activity_events
                     WHERE batch_id IN (${marks}) AND day >= ? AND day <= ? GROUP BY day, change ORDER BY day`, ...ids, month + '-01', month + '-31'))
  ]);
  const N = Object.fromEntries(now_.map(r => [r.batch_id, r]));
  const list = batches.map(b => ({ batchId: b.batch_id, name: b.name, level: b.level || '', active: N[b.batch_id]?.active || 0, inactive: N[b.batch_id]?.inactive || 0 }));
  const M = Object.fromEntries(months.map(m => [m, { month: m, inactive: 0, active: 0, auto: 0, manual: 0, filled: 0, app: 0 }]));
  for (const r of byMonth) {
    const x = M[r.month]; if (!x) continue;
    x[r.change === 'INACTIVE' ? 'inactive' : 'active'] += r.n;
    x[{ AUTO: 'auto', MANUAL: 'manual', FILLED: 'filled', APP: 'app' }[r.how]] += r.n;
  }
  // every day of the month up to today, so a quiet day is a 0, not a gap
  const [y, mo] = month.split('-').map(Number), last = month === thisMonth ? Number(ymd(ctx.now()).slice(8, 10)) : new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const D = Object.fromEntries(Array.from({ length: month > thisMonth ? 0 : last }, (_, i) => { const k = `${month}-${String(i + 1).padStart(2, '0')}`; return [k, { day: k, inactive: 0, active: 0 }]; }));
  for (const r of byDay) if (D[r.day]) D[r.day][r.change === 'INACTIVE' ? 'inactive' : 'active'] += r.n;
  return { month, batches: list, totals: { active: list.reduce((a, b) => a + b.active, 0), inactive: list.reduce((a, b) => a + b.inactive, 0) },
           months: months.map(m => M[m]), days: Object.values(D) };
}
