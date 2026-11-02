// What the IYF head watches: every batch at a glance, the Activity log, the technical run log, the settings, and
// possible duplicate IYF IDs. Split out of coord.js on 13 October 2026 (audit F27 / roadmap 3.1); the code is
// unchanged, only its home — apart from stats.all, which was rewritten in phase 2 and carries its own notes.
import { apiError, invalid, isoIst } from './util.js';
import { q, one, all, audit, dirty, scopeBatches, setting, settings, reads, rows } from './db.js';
import { cronFailures } from './cronfail.js';
import { reasonOf, focusWeek } from './staff.js';
import { addDays, validWeekId } from './weeks.js';
import { isDeleted, DELETED_NAME } from './erase.js';
import { linkedLogins, registryPublic, registryRows, idNameParts } from './registry.js';
import { RETENTION_MONTHS, DEFAULT_MONTHS } from './retention.js';
import { expected } from './board.js';

/* ------------------------------------------------------------------------ */
/* Possible duplicate IYF IDs (review only; merging stays in the dashboard)   */
/* ------------------------------------------------------------------------ */

export async function idsPossibleDuplicates(d, ctx) {
  const rows = (await registryRows(ctx.db)).filter(r => !r.merged_into), linked = await linkedLogins(ctx.db);
  const byPhone = new Map(), byName = new Map();
  for (const r of rows) {
    if (r.phone) (byPhone.get(r.phone) || byPhone.set(r.phone, []).get(r.phone)).push(r);
    // the whole name, as strict as the dashboard's merge rule (RegistryService regNameKey_): honorifics, case, w/v, a
    // silent h and doubled letters ignored, vowels kept, so "Amit Kumar" and "Mohit Kumar" are NOT the same name
    const parts = idNameParts(r.name).map(p => p.replace(/w/g, 'v').replace(/h/g, '').replace(/(.)\1+/g, '$1')).filter(Boolean);
    if (parts.length >= 2) { const k = [...parts].sort().join(' '); (byName.get(k) || byName.set(k, []).get(k)).push(r); }
  }
  const view = r => ({ ...registryPublic(r, ''), linkedAccount: linked[r.iyf_id] || null });
  const groups = [], used = new Set();
  for (const [, list] of byPhone) if (list.length > 1) { groups.push({ why: 'same phone', ids: list.map(view) }); used.add(list.map(r => r.iyf_id).sort().join()); }
  for (const [, list] of byName) if (list.length > 1 && !used.has(list.map(r => r.iyf_id).sort().join())) groups.push({ why: 'same name', ids: list.map(view) });
  // groups the master already marked "not duplicates" (by their exact set of IDs) are left out unless asked for
  const reviewed = Object.fromEntries((await all(ctx.db, 'SELECT group_key, by, at FROM duplicate_reviews')).map(r => [r.group_key, r]));
  const keyed = groups.map(g => ({ ...g, key: g.ids.map(i => i.iyfId).sort().join(',') }))
    .map(g => (reviewed[g.key] ? { ...g, reviewed: { by: reviewed[g.key].by, at: reviewed[g.key].at } } : g));
  const open = keyed.filter(g => !g.reviewed);
  const shown = d.showReviewed ? keyed : open;
  return { groups: shown.slice(0, 300), total: open.length, reviewedCount: keyed.length - open.length,
           byKind: { samePhone: open.filter(g => g.why === 'same phone').length, sameName: open.filter(g => g.why === 'same name').length } };
}

/** The master marks a possible-duplicate group as "not duplicates" (or takes that back). Logged. */
export async function idsReviewDuplicate(d, ctx, req) {
  const ids = Array.isArray(d.ids) ? [...new Set(d.ids.map(x => String(x).trim().toUpperCase()))].sort() : [];
  if (ids.length < 2 || ids.length > 20 || ids.some(x => !/^(GP|JN|KT)\d{2}-\d{4}$/.test(x))) throw invalid({ path: 'ids', message: 'The IDs of the group.' });
  if (!['NOT_DUPLICATE', 'UNDO'].includes(d.decision)) throw invalid({ path: 'decision', message: 'NOT_DUPLICATE or UNDO.' });
  const key = ids.join(','), db = ctx.db, at = isoIst(ctx.now());
  await db.batch([
    d.decision === 'UNDO' ? q(db, 'DELETE FROM duplicate_reviews WHERE group_key = ?', key)
      : q(db, `INSERT INTO duplicate_reviews (group_key, why, decision, by, at) VALUES (?, ?, 'NOT_DUPLICATE', ?, ?)
               ON CONFLICT(group_key) DO UPDATE SET by = excluded.by, at = excluded.at`, key, String(d.why || ''), ctx.login, at),
    audit(db, ctx, d.decision === 'UNDO' ? 'ids.duplicate.reopen' : 'ids.duplicate.notDuplicate', key, '', null, { ids }, String(d.reason || ''), req.requestId),
    dirty(db, 'duplicate_reviews', 'audit_log')]);
  return { key, decision: d.decision };
}
/* ------------------------------------------------------------------------ */
/* Master oversight and settings                                             */
/* ------------------------------------------------------------------------ */

/**
 * The head's overview: one compact line per active batch, and the totals (#/overview).
 *
 * Counted by the database, not by reading every devotee (13 Oct 2026, audit P-1 / roadmap 2.1). It used to call
 * statsBatch() once per batch, which builds the whole board — every member's row, their submission, draft,
 * attendance and reopen — only to count the statuses. Measured on a seeded database, stats.all read
 *   1,000 devotees → 4,119 rows · 2,000 → 7,318 · 5,000 → 16,318
 * and the Worker's free-plan CPU allowance is 10 ms a call. Nothing on the screen needs a person: it shows counts,
 * an 8-week trend of percentages, and how many weeks were missed. So each number is now one GROUP BY over an
 * indexed week, and the cost no longer follows the number of devotees in any one batch.
 *
 * `byDay` (which day of the week people have filled) stays out of this action deliberately: it needs the drafts'
 * JSON per person, and only the batch screen (stats.batch) shows it.
 */
export async function statsAll(d, ctx) {
  const n = d.weeks === undefined ? 8 : d.weeks;
  if (!Number.isInteger(n) || n < 1 || n > 26) throw invalid({ path: 'weeks', message: '1 to 26.' });
  const db = ctx.db;
  const batches = await all(db, 'SELECT batch_id, name, level FROM batches WHERE active = 1 ORDER BY rowid');
  if (!batches.length) return { batches: [], totals: { expected: 0, submitted: 0, draft: 0, notStarted: 0, missed: 0, active: 0, pending: 0, activeNow: 0, inactive: 0 } };
  const ids = batches.map(b => b.batch_id), marks = ids.map(() => '?').join(',');
  const weekId = await focusWeek(db, ctx.now());
  const weeks = Array.from({ length: n }, (_, i) => addDays(weekId, -7 * (n - 1 - i))), first = weeks[0];

  // Six aggregates, all keyed on (batch_id, week_id) or (batch_id, to_week): one row per batch (or batch+week),
  // never one per devotee. `expected` repeats the board's own rule — an ACTIVE membership of an ACTIVE devotee
  // (and a deleted devotee whose membership keeps a pseudonym), counted once per login.
  /* The eight aggregates in ONE round trip (22 Oct 2026, B5). They were already per batch, never per devotee (audit P-1,
     13 Oct); what remained was that Promise.all still sent eight separate requests to D1. One batch sends them
     together: the same statements and the same rows read, one hop instead of eight. */
  const [members, subs, drafts, missed, pending, trendSubs, trendMissed, trendMembers, standing] = await reads(db, [
    // the board's own rule (expected(), coord.js:127): an ACTIVE membership AND an ACTIVE devotee account.
    // A deleted devotee keeps a membership with no account row and is NOT expected to submit.
    rows(q(db, `SELECT m.batch_id, COUNT(DISTINCT m.login) AS n FROM memberships m JOIN accounts a ON a.login = m.login
             WHERE m.batch_id IN (${marks}) AND m.state = 'ACTIVE' AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
               AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?) GROUP BY m.batch_id`, ...ids, weekId, weekId)),
    // Every count below is restricted to the SAME people, through the same join: a submission or draft belonging
    // to a devotee who is no longer expected (left the batch, went inactive, was deleted) must not be counted, or
    // the screen could show more submitted than expected. `open` is that membership test, used by all of them.
    // …and the board's precedence: SUBMITTED beats everything, so a draft or a missed row for a week the person
    // already submitted is not a second status. `notSubmitted` applies that to drafts and missed_weeks.
    ...['submissions', 'drafts', 'missed_weeks'].map((tbl) =>
      // COUNT(*) is enough: submissions is UNIQUE (login, week_id) (0005:24) and drafts/missed_weeks have
      // (login, week_id) as their primary key, so one person cannot appear twice in one week.
      rows(q(db, `SELECT t.batch_id, COUNT(*) AS n FROM ${tbl} t
               JOIN memberships m ON m.login = t.login AND m.batch_id = t.batch_id AND m.state = 'ACTIVE'
                 AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)
               JOIN accounts a ON a.login = t.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
               WHERE t.week_id = ? AND t.batch_id IN (${marks})
                 ${tbl === 'submissions' ? '' : "AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.login = t.login AND s.week_id = t.week_id)"}
                 ${tbl === 'drafts' ? "AND NOT EXISTS (SELECT 1 FROM missed_weeks x WHERE x.login = t.login AND x.week_id = t.week_id AND NOT EXISTS (SELECT 1 FROM reopens r WHERE r.login = t.login AND r.week_id = t.week_id AND r.state = 'OPEN'))" : ''}
                 ${tbl === 'missed_weeks' ? "AND NOT EXISTS (SELECT 1 FROM reopens r WHERE r.login = t.login AND r.week_id = t.week_id AND r.state = 'OPEN')" : ''}
               GROUP BY t.batch_id`, weekId, weekId, weekId, ...ids))),
    rows(q(db, `SELECT requested_batch AS batch_id, COUNT(*) AS n FROM accounts WHERE status = 'PENDING' AND requested_batch IN (${marks}) GROUP BY requested_batch`, ...ids)),
    // the trend: per week, counted over everyone who HAD a row that week (the old code counted submissions and
    // missed weeks as they stand, without re-checking membership, and the denominator comes from trendMembers)
    rows(q(db, `SELECT batch_id, week_id, COUNT(*) AS n FROM submissions WHERE week_id >= ? AND week_id <= ? AND batch_id IN (${marks}) GROUP BY batch_id, week_id`, first, weekId, ...ids)),
    rows(q(db, `SELECT batch_id, week_id, COUNT(*) AS n FROM missed_weeks WHERE week_id >= ? AND week_id <= ? AND batch_id IN (${marks}) GROUP BY batch_id, week_id`, first, weekId, ...ids)),
    // The trend's denominator. Not one row per devotee, and not one join per week either: the database returns
    // the distinct membership RANGES that overlap the window with a count each (a batch has a handful, because
    // most devotees joined in the same week), and the Worker turns ranges into per-week numbers. Measured at
    // 5,000 devotees: ranges 2.7 ms / 6 rows, versus 16.2 ms / 48 rows for a per-week join, versus one row per
    // devotee before (audit P-1).
    rows(q(db, `SELECT m.batch_id, m.from_week, m.to_week, COUNT(DISTINCT m.login) AS n
               FROM memberships m LEFT JOIN accounts a ON a.login = m.login
              WHERE m.batch_id IN (${marks}) AND m.state = 'ACTIVE' AND (a.role = 'DEVOTEE' OR a.login IS NULL)
                AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)
              GROUP BY m.batch_id, m.from_week, m.to_week`, ...ids, weekId, first)),
    // Admin › Overview, active and inactive now (Phase 22 I3): over the OPEN memberships, one row per batch. Inactive =
    // the account or the membership inactive (made inactive by staff, or for four weeks with no week — inactive.js);
    // a disabled login is neither.
    rows(q(db, `SELECT m.batch_id, SUM(a.status = 'ACTIVE' AND m.state = 'ACTIVE') AS active,
                       SUM(a.status <> 'DISABLED' AND (a.status = 'INACTIVE' OR m.state = 'INACTIVE')) AS inactive
                  FROM memberships m JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE'
                 WHERE m.to_week = '' AND m.batch_id IN (${marks}) GROUP BY m.batch_id`, ...ids))
  ]);
  const byBatch = (rows) => Object.fromEntries(rows.map(r => [r.batch_id, r.n]));
  const N = Object.fromEntries(standing.map(r => [r.batch_id, r]));
  const M = byBatch(members), S = byBatch(subs), D = byBatch(drafts), X = byBatch(missed), P = byBatch(pending);
  const TS = {}, TX = {};
  for (const r of trendSubs) (TS[r.batch_id] ||= {})[r.week_id] = r.n;
  for (const r of trendMissed) (TX[r.batch_id] ||= {})[r.week_id] = r.n;
  // ranges → a count per week, done once per batch
  const TM = {};
  for (const r of trendMembers) {
    const per = (TM[r.batch_id] ||= {});
    for (const w of weeks) if (r.from_week <= w && (r.to_week === '' || r.to_week >= w)) per[w] = (per[w] || 0) + r.n;
  }

  const out = batches.map(b => {
    const expected = M[b.batch_id] || 0, submitted = S[b.batch_id] || 0, draft = D[b.batch_id] || 0, miss = X[b.batch_id] || 0;
    const mem = TM[b.batch_id] || {}, sub = TS[b.batch_id] || {}, mw = TX[b.batch_id] || {};
    return {
      // `level` as the batch row holds it (22 Oct 2026): the colour a batch is drawn in follows its real level, never a
      // guess from its id (SPSO is level SPS on live)
      batchId: b.batch_id, name: b.name, level: b.level || '', weekId,
      // a devotee is "not started" when the week holds nothing of theirs at all
      thisWeek: { expected, submitted, draft, notStarted: Math.max(0, expected - submitted - draft - miss), missed: miss },
      trend: weeks.map(w => {
        const exp = mem[w] || 0, s = sub[w] || 0;
        return { weekId: w, filledPct: exp ? Math.min(100, Math.round((s / exp) * 100)) : 0, missed: mw[w] || 0 };
      }),
      people: { active: expected, pending: P[b.batch_id] || 0, activeNow: N[b.batch_id]?.active || 0, inactive: N[b.batch_id]?.inactive || 0 },
      // `missed` on a batch line is how many missed weeks the window holds (what missedLog.length used to report,
      // which the old code capped at 200 — the sum below is the honest number), NOT this week's count.
      missed: weeks.reduce((a, w) => a + (mw[w] || 0), 0)
    };
  });
  const sum = k => out.reduce((a, b) => a + (b.thisWeek[k] || 0), 0);
  return { batches: out, totals: { expected: sum('expected'), submitted: sum('submitted'), draft: sum('draft'), notStarted: sum('notStarted'), missed: sum('missed'),
           active: out.reduce((a, b) => a + b.people.active, 0), pending: out.reduce((a, b) => a + b.people.pending, 0),
           activeNow: out.reduce((a, b) => a + b.people.activeNow, 0), inactive: out.reduce((a, b) => a + b.people.inactive, 0) } };
}

/** The AuditLog, newest first, filtered. */
export async function auditList(d, ctx) {
  const limit = d.limit === undefined ? 50 : d.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid({ path: 'limit', message: '1 to 200.' });
  const where = [], args = [];
  if (d.who) { where.push('who = ?'); args.push(String(d.who)); }
  if (d.what) { where.push('action LIKE ?'); args.push(String(d.what).replace(/[%_]/g, '') + '%'); }
  if (d.target) { where.push('target = ?'); args.push(String(d.target)); }
  if (d.from) { where.push('at >= ?'); args.push(String(d.from)); }
  if (d.to) { where.push('at <= ?'); args.push(String(d.to) + '~'); }
  if (d.before) { where.push('id < ?'); args.push(Number(d.before) || 0); }
  /*
   * One search box (the head, 22 Oct 2026: "if there are 1000s of logs and I want to search a particular action, I should
   * be having a search bar"). `q` matches the action, the reason, and the people — by name or login, who did it and whom
   * it was about — and a target that is itself a name (a renamed facilitator, a phase). `actions` are the ones whose
   * wording on the screen matched (lib/admin.js holds the wording): "facilitator" finds "changed the facilitator of".
   * It narrows the other filters, never widens them; newest first, so a common word stops after one page of rows.
   */
  const qs = String(d.q ?? '').trim().replace(/[%_]/g, '').slice(0, 60);
  if (d.q !== undefined && qs.length === 1) throw invalid({ path: 'q', message: 'Type at least two letters.' });
  const acts = Array.isArray(d.actions) ? d.actions.filter(a => /^[a-zA-Z]+\.[a-zA-Z]+$/.test(String(a))).slice(0, 40) : [];
  const ors = [];
  if (qs) {
    const like = '%' + qs + '%';
    ors.push('action LIKE ?', 'reason LIKE ?', 'target LIKE ?',
      'who IN (SELECT login FROM accounts WHERE name LIKE ? OR login = ?)', 'target IN (SELECT login FROM accounts WHERE name LIKE ?)');
    args.push(like, like, like, like, qs, like);
  }
  if (acts.length) { ors.push(`action IN (${acts.map(() => '?').join(',')})`); args.push(...acts); }
  if (ors.length) where.push('(' + ors.join(' OR ') + ')');
  const rows = await all(ctx.db, `SELECT id, at, who, role, action, target, batch_id, before, after, reason FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`, ...args, limit + 1);
  // Phase 6 (9 Oct 2026): the names of the people in these lines, so Activity reads in names, not phone numbers
  // (one lookup per page, in parts of 90 so D1's bound-parameter limit is never reached)
  const page = rows.slice(0, limit), ids = [...new Set(page.flatMap(r => [r.who, r.target]).filter(Boolean).map(String))], names = {};
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    for (const a of await all(ctx.db, `SELECT login, name FROM accounts WHERE login IN (${part.map(() => '?').join(',')})`, ...part)) names[a.login] = a.name;
  }
  return { rows: page.map(r => ({ id: r.id, at: r.at, who: r.who, role: r.role, action: r.action, target: r.target, batchId: r.batch_id,
           whoName: names[r.who] || '', targetName: names[r.target] || '',
           before: r.before ? JSON.parse(r.before) : null, after: r.after ? JSON.parse(r.after) : null, reason: r.reason })), more: rows.length > limit };
}

/** Slow or failed calls (only those are logged), newest first. */
export async function runlogList(d, ctx) {
  const limit = d.limit === undefined ? 50 : d.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid({ path: 'limit', message: '1 to 200.' });
  return { rows: (await all(ctx.db, 'SELECT at, action, ms, ok, error_code, detail, app_build FROM run_log ORDER BY id DESC LIMIT ?', limit))
    .map(r => ({ at: r.at, action: r.action, ms: r.ms, ok: !!r.ok, errorCode: r.error_code, detail: r.detail, app: r.app_build })) };
}

const SPEC = /^(MON|TUE|WED|THU|FRI|SAT|SUN) ([01]\d|2[0-3]):[0-5]\d$/;
/* Roadmap 6.6 / audit T F-10. src/api.js counts one refusal in ten and keeps a running estimate for the
   current hour in `settings`, as `2026-10-14T11|120`. Read back: the estimate when the stored hour IS this
   hour, and 0 when it is not (the counter has simply not fired yet this hour). Sampled, so these are
   estimates to the nearest ten — enough to tell "something is wrong" from "nothing is happening", which is
   all they are for. */
const REFUSAL_KEYS = { forbidden: 'refusals_forbidden', unauthenticated: 'refusals_unauthenticated', stale: 'refusals_stale' };
async function refusalsView(db, g, now) {
  // the request's clock, not new Date(): the suites run on a fixed clock, and so does the load-test Worker
  const hour = isoIst(now).slice(0, 13);
  const out = { hour, sampled: true };
  for (const [name, key] of Object.entries(REFUSAL_KEYS)) {
    const raw = await g(key, '');
    const [at, n] = String(raw).split('|');
    out[name] = at === hour ? Number(n) || 0 : 0;
  }
  return out;
}
async function settingsView(db, now) {
  /* The per-call settings memo (db.js `setting`), not one query per key (22 Oct 2026). This read each of ~10 keys
     with its own SELECT — the submit window, the reminder, the retention, and every refusal counter — so the head's
     Settings screen made 13 round trips, the slowest staff call after the cards (live run_log: 2.7 s average among
     slow calls). `setting` reads the whole small table ONCE per call and answers every key from it; its rule is the
     same as before (a missing or empty value gives the fallback). A write clears the memo (db.js requestDb), so
     settingsUpdate's read-after-write is still fresh. */
  const g = (k, f) => setting(db, k, f);
  return { submitWindow: { opens: await g('submit_opens', 'SUN 18:00'), closes: await g('submit_closes', 'MON 21:00') },
           trackingFrom: await g('tracking_from', '') || null, reminderTime: await g('reminder_time', '21:00'),
           registryRefresh: await g('registry_refresh', ''), mirrorStatus: await g('mirror_status', ''), pushDevices: (await one(db, 'SELECT COUNT(*) AS n FROM push_subs')).n,
           // how long the Activity and technical logs are kept (Phase 9, item 11), in months
           logRetentionMonths: Number(await g('log_retention_months', String(DEFAULT_MONTHS))) || DEFAULT_MONTHS,
           /* Roadmap 6.6: refusals this hour, so a broken client or somebody probing is visible without
              reading Cloudflare's logs. Each row is `<hour>|<estimate>`; a row from an earlier hour means
              none so far this hour, which is the ordinary case and reads as 0. */
           refusals: await refusalsView(db, g, now),
           /* F5 (22 Oct 2026): scheduled jobs that failed (cronfail.js), newest first, read from the settings this call
              already holds — no extra round trip. The head's Home warns for one under a day old. */
           cronFailed: cronFailures(await settings(db)) };
}
export async function settingsGet(d, ctx) { return settingsView(ctx.db, ctx.now()); }

/** Submit window, the pilot's first week (from then on unsubmitted weeks are marked missed), the reminder time. */
export async function settingsUpdate(d, ctx, req) {
  const db = ctx.db, set = {}, problems = [];
  if (d.submitWindow !== undefined) {
    const w = d.submitWindow || {};
    if (!SPEC.test(String(w.opens || '').toUpperCase()) || !SPEC.test(String(w.closes || '').toUpperCase())) problems.push({ path: 'submitWindow', message: 'Like "SUN 18:00" and "MON 21:00".' });
    else { set.submit_opens = String(w.opens).toUpperCase(); set.submit_closes = String(w.closes).toUpperCase(); }
  }
  if (d.trackingFrom !== undefined) {
    if (d.trackingFrom !== null && d.trackingFrom !== '' && !validWeekId(d.trackingFrom)) problems.push({ path: 'trackingFrom', message: 'A Monday, or empty.' });
    else set.tracking_from = d.trackingFrom || '';
  }
  if (d.reminderTime !== undefined) {
    if (!/^(1[89]|2[0-2]):[0-5]\d$/.test(String(d.reminderTime))) problems.push({ path: 'reminderTime', message: 'Between 18:00 and 22:59.' });
    else set.reminder_time = d.reminderTime;
  }
  if (d.logRetentionMonths !== undefined) {
    if (!RETENTION_MONTHS.includes(d.logRetentionMonths)) problems.push({ path: 'logRetentionMonths', message: `One of ${RETENTION_MONTHS.join(', ')} months.` });
    else set.log_retention_months = String(d.logRetentionMonths);
  }
  if (problems.length) throw invalid(problems);
  const keys = Object.keys(set);
  if (!keys.length) return settingsView(db, ctx.now());
  const before = await settingsView(db, ctx.now()), at = isoIst(ctx.now());
  await db.batch([...keys.map(k => q(db, `INSERT INTO settings (key, value, changed_by, changed_at) VALUES (?, ?, ?, ?)
                                          ON CONFLICT(key) DO UPDATE SET value = excluded.value, changed_by = excluded.changed_by, changed_at = excluded.changed_at`, k, set[k], ctx.login, at)),
    audit(db, ctx, 'settings.update', 'settings', '', before, set, '', req.requestId), dirty(db, 'settings', 'audit_log')]);
  return settingsView(db, ctx.now());
}
