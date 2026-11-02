// Exports (Phase 9, item 21; the head, 9 Oct 2026, and "professional selection ways by which any data can be fetched
// from the sadhana to profile perspective"): the person chooses the rows (one per devotee, per devotee per week, or per
// devotee per day), exactly which fields (person, contact, membership, personal, week scores, attendance, day answers,
// a sadhana summary over the range), the batches, the dates and filters. exports.catalog says what this person may
// choose; exports.page gives the rows a page at a time ({ columns, rows, next }); the app joins the pages into a CSV.
// Rules (server-checked):
//   · a coordinator exports only the batches they coordinate, the head any batch; personal fields (date of birth,
//     blood group, address, emergency contact, parent) and the staff / batches / Activity exports are the head's only
//   · only the fields asked for are read and sent
//   · a range of at most 6 months; at most 20 exports an hour a person (the free plan's daily reads); each export is
//     logged in Activity (rows, fields, batches, range, filters) when its first page is asked for
//   · each page reads through an index: one week of the chosen batches, or one batch, or 500 Activity rows by id;
//     profile and membership fields come by a join on the person's login (never a list of bound logins)
import { can } from './grants.js';
import { apiError, invalid, validYmd, mondayOf, ymd, csv } from './util.js';
import { all, batchesAll, scopeBatches, audit, dirty } from './db.js';
import { FAC_ID_OF } from './names.js';
import { eligibleIn } from './eligible.js';
import { addDays } from './weeks.js';
import { overLimit } from './auth.js';
import { weekOf } from './weekjson.js';
import { EXPORT_FIELDS, GRAIN_CODE, FIXED_EXPORTS } from '../../shared/exportfields.js';

export const MAX_DAYS = 184, PER_HOUR = 20, ACTIVITY_PAGE = 500;
const DAY_MS = 864e5;
const MARK = { P: 'Present', A: 'Absent', N: 'No class' };
const mark = (m) => MARK[m] || m || '';
const timeOf = (iso) => String(iso || '').replace('T', ' ').slice(0, 16);
const LEVEL = (a) => (!a ? '' : a.master_mark ? 'IYF head' : a.coordinator_mark ? 'Coordinator' : a.leader_mark ? 'Group leader' : a.devotee_mark ? 'Self' : '');
const status = (r) => (!r.a_status ? '' : r.a_status !== 'ACTIVE' ? r.a_status.toLowerCase() : r.m_state === 'ACTIVE' ? 'active' : r.m_state ? 'inactive' : '');
const avg = (v) => (v === null || v === undefined ? '' : Math.round(v));

/* How each field (shared/exportfields.js: its label, group, rows and whether it is the head's only) gets its value. */
const F = (id, label, group, grains, get) => ({ id, get });
const GETTERS = [
  // person (from the account; on week / day rows the submission's own name and IYF ID)
  F('name', 'Name', 'Person', 'pwd', r => r.a_name || r.s_name || ''),
  F('iyfId', 'IYF ID', 'Person', 'pwd', r => r.a_iyf || r.s_iyf || ''),
  F('phone', 'Phone', 'Person', 'pwd', r => r.login),
  F('batch', 'Batch', 'Person', 'pwd', (r, x) => x.bn(r.batch_id)),
  // contact
  F('whatsapp', 'WhatsApp', 'Contact', 'pwd', r => r.a_whatsapp || r.login),
  F('email', 'Email', 'Contact', 'pwd', r => r.a_email || ''),
  // membership (the open membership now)
  F('classDay', 'Class day', 'Membership', 'pwd', r => r.m_class_day || ''),
  F('facilitator', 'Facilitator', 'Membership', 'pwd', r => r.m_facilitator || ''),
  F('groupLeader', 'Group leader', 'Membership', 'pwd', r => r.l_name || ''),
  F('status', 'Status', 'Membership', 'pwd', r => status(r)),
  F('since', 'Member since (week)', 'Membership', 'pwd', r => r.m_from_week || ''),
  // personal (the head only, and only when ticked)
  F('dob', 'Date of birth', 'Personal', 'pwd', r => r.p_dob || '', true),
  F('bloodGroup', 'Blood group', 'Personal', 'pwd', r => r.p_blood_group || '', true),
  F('address', 'Address', 'Personal', 'pwd', r => [r.p_addr_line, r.p_addr_area, r.p_addr_city, r.p_addr_state].filter(Boolean).join(', '), true),
  F('pin', 'PIN code', 'Personal', 'pwd', r => r.p_addr_pin || '', true),
  F('emergency', 'Emergency contact', 'Personal', 'pwd', r => [r.p_emergency_name, r.p_emergency_relation].filter(Boolean).join(' · '), true),
  F('emergencyPhone', 'Emergency phone', 'Personal', 'pwd', r => r.p_emergency_phone || '', true),
  F('parent', 'Parent / guardian', 'Personal', 'pwd', r => [r.p_parent_name, r.p_parent_phone].filter(Boolean).join(' · '), true),
  // the summary of the range, per devotee
  F('weeksSubmitted', 'Weeks submitted', 'Sadhana summary', 'p', r => r.g_subs ?? 0),
  F('weeksMissed', 'Weeks missed', 'Sadhana summary', 'p', r => r.g_missed ?? 0),
  F('daysFilled', 'Days filled', 'Sadhana summary', 'p', r => r.g_days ?? 0),
  F('avgOverall', 'Average overall', 'Sadhana summary', 'p', r => avg(r.g_overall)),
  F('avgBody', 'Average body', 'Sadhana summary', 'p', r => avg(r.g_body)),
  F('avgSoul', 'Average soul', 'Sadhana summary', 'p', r => avg(r.g_soul)),
  F('avgJapa', 'Average japa', 'Sadhana summary', 'p', r => avg(r.g_japa)),
  F('avgRounds', 'Average rounds', 'Sadhana summary', 'p', r => (r.g_rounds === null || r.g_rounds === undefined ? '' : Math.round(r.g_rounds * 10) / 10)),
  F('classesPresent', 'Classes present', 'Sadhana summary', 'p', r => r.g_present ?? 0),
  F('classesAbsent', 'Classes absent', 'Sadhana summary', 'p', r => r.g_absent ?? 0),
  // a week
  F('week', 'Week (Monday)', 'Week', 'wd', r => r.week_id),
  F('weekStatus', 'Week status', 'Week', 'w', r => (r.kind === 'missed' ? 'Missed' : 'Submitted')),
  F('weekDays', 'Days filled', 'Week', 'w', r => r.days_filled),
  F('overall', 'Overall', 'Week scores', 'w', r => (r.kind === 'missed' ? 0 : r.overall)),
  F('body', 'Body', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.body)),
  F('soul', 'Soul', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.soul)),
  F('bed', 'To bed', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.bed)),
  F('wakeUp', 'Wake-up', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.wake_up)),
  F('dayRest', 'Day rest', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.day_sleep)),
  F('japa', 'Japa', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.japa)),
  F('reading', 'Reading', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.pathan)),
  F('hearing', 'Hearing', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.sravan)),
  F('seva', 'Seva', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.seva)),
  F('attendanceScore', 'Attendance score', 'Week scores', 'w', r => (r.kind === 'missed' ? '' : r.attendance)),
  F('weekRounds', 'Average rounds', 'Week totals', 'w', r => r.avg_rounds ?? ''),
  F('sevaMin', 'Seva (minutes)', 'Week totals', 'w', r => r.seva_minutes ?? ''),
  F('hearingMin', 'Hearing (minutes)', 'Week totals', 'w', r => r.hearing_minutes ?? ''),
  F('readingMin', 'Reading (minutes)', 'Week totals', 'w', r => r.reading_minutes ?? ''),
  F('nightStay', 'Night stay', 'Week totals', 'w', r => r.night_stay ?? ''),
  F('principles', '4 regulative principles', 'Week totals', 'w', r => r.principles ?? ''),
  F('submittedAt', 'Submitted at', 'Week totals', 'w', r => timeOf(r.submitted_at)),
  F('filledBy', 'Submitted for them by', 'Week totals', 'w', r => (r.on_behalf ? r.submitted_by : '')),
  // attendance of the week
  F('attendance', 'Attendance', 'Attendance', 'w', r => mark(r.t_mark_used)),
  F('markedBy', 'Marked by', 'Attendance', 'w', r => LEVEL(r.t)),
  F('ownMark', 'Own mark', 'Attendance', 'w', r => mark(r.t_devotee_mark)),
  F('leaderMark', 'Group leader\'s mark', 'Attendance', 'w', r => mark(r.t_leader_mark)),
  F('coordinatorMark', 'Coordinator\'s mark', 'Attendance', 'w', r => mark(r.t_coordinator_mark)),
  F('headMark', 'IYF head\'s mark', 'Attendance', 'w', r => mark(r.t_master_mark)),
  // a day
  F('date', 'Date', 'Day answers', 'd', r => r.date),
  F('sleptAt', 'Slept at', 'Day answers', 'd', r => r.day.sleptAt || ''),
  F('wokeAt', 'Woke at', 'Day answers', 'd', r => r.day.wokeAt || ''),
  F('dayRestMin', 'Day rest (minutes)', 'Day answers', 'd', r => r.day.dayRestMin ?? ''),
  F('rounds', 'Rounds', 'Day answers', 'd', r => r.day.rounds ?? ''),
  F('chantingDoneAt', 'Chanting done at', 'Day answers', 'd', r => r.day.chantingDoneAt || ''),
  F('dayHearing', 'Hearing (minutes)', 'Day answers', 'd', r => r.day.hearingMin ?? ''),
  F('dayReading', 'Reading (minutes)', 'Day answers', 'd', r => r.day.readingMin ?? ''),
  F('dayService', 'Service (minutes)', 'Day answers', 'd', r => r.day.serviceMin ?? ''),
  F('marksBed', 'To bed (marks)', 'Day marks', 'd', r => r.m.to_bed?.marks ?? ''),
  F('marksWake', 'Wake-up (marks)', 'Day marks', 'd', r => r.m.wake_up?.marks ?? ''),
  F('marksRest', 'Day rest (marks)', 'Day marks', 'd', r => r.m.day_sleep?.marks ?? ''),
  F('marksJapa', 'Japa (marks)', 'Day marks', 'd', r => r.m.japa?.marks ?? ''),
  F('marksReading', 'Reading (marks)', 'Day marks', 'd', r => r.m.pathan?.marks ?? ''),
  F('marksHearing', 'Hearing (marks)', 'Day marks', 'd', r => r.m.sravan?.marks ?? '')
];
const GET = Object.fromEntries(GETTERS.map(g => [g.id, g.get]));
export const FIELDS = EXPORT_FIELDS.map(f => ({ ...f, get: GET[f.id] }));
const BY_ID = Object.fromEntries(FIELDS.map(f => [f.id, f]));
export const GRAINS = GRAIN_CODE;
export const OTHER = FIXED_EXPORTS;   // the head's fixed exports
/** Every shared field has a value here and nothing extra (checked by the tests). */
export const fieldGaps = () => ({ noValue: EXPORT_FIELDS.filter(f => !GET[f.id]).map(f => f.id), notShared: GETTERS.filter(g => !EXPORT_FIELDS.some(f => f.id === g.id)).map(g => g.id) });

/** exports.catalog: what this person may export — the row kinds, the fields by group, their batches. */
export async function catalog(d, ctx) {
  const head = !!ctx.scopes.master, personal = can(ctx, 'exportsPersonal', head), batches = await scopeBatches(ctx.db, ctx), names = Object.fromEntries((await batchesAll(ctx.db)).map(b => [b.batch_id, b.name]));
  return {
    grains: [{ id: 'people', label: 'One row per devotee' }, { id: 'weeks', label: 'One row per devotee per week' }, { id: 'days', label: 'One row per devotee per day' },
      ...(head ? Object.entries(OTHER).map(([id, label]) => ({ id, label, fixed: true })) : [])],
    fields: FIELDS.filter(f => personal || !f.head).map(f => ({ id: f.id, label: f.label, group: f.group, grains: [...f.grains].map(g => ({ p: 'people', w: 'weeks', d: 'days' }[g])), ...(f.head ? { personal: true } : {}) })),
    batches: batches.map(id => ({ id, name: names[id] || id })),
    /*
     * The filters the screen may offer. `ready` is the promotion one (the head, 17 Oct 2026): a
     * coordinator checking somebody before they move them up, on their own batches only, which
     * scopeBatches above already settles.
     *
     * It is advertised rather than assumed so the screen never offers a filter the server would
     * ignore — a filter that silently does nothing is worse than none, because the export looks
     * narrowed when it is not.
     */
    filters: [
      { id: 'status', label: 'Week status', grains: ['weeks'], options: [{ id: 'submitted', label: 'Submitted' }, { id: 'missed', label: 'Missed' }] },
      { id: 'ready', label: 'Meets the promotion criteria', grains: ['people'],
        options: [{ id: 'yes', label: 'Ready for the next level' }, { id: 'no', label: 'Not yet' }] }
    ],
    maxDays: MAX_DAYS, perHour: PER_HOUR
  };
}

/** exports.page: one page of an export. The first call (no cursor) is checked, rate-limited and logged in Activity. */
export async function page(d, ctx, req) {
  const head = !!ctx.scopes.master, grain = d.grain;
  // personal details: the head, or somebody the head gave them to (ADR 0015) — only those fields, never the head's
  // other exports, and still only their own batches (the batch rule below is untouched)
  const personal = can(ctx, 'exportsPersonal', head);
  const fixed = OTHER[grain] !== undefined;
  if (!GRAINS[grain] && !fixed) throw invalid({ path: 'grain', message: 'Choose what each row is.' });
  if (fixed && !head) throw apiError('FORBIDDEN', 'Only the IYF head can export this.');
  // the fields: known, offered for these rows, personal ones the head's only
  let fields = [];
  if (!fixed) {
    const ids = Array.isArray(d.fields) ? [...new Set(d.fields.map(String))] : [];
    if (!ids.length) throw invalid({ path: 'fields', message: 'Choose at least one field.' });
    for (const id of ids) {
      const f = BY_ID[id];
      if (!f || !f.grains.includes(GRAINS[grain])) throw invalid({ path: 'fields', message: `"${id}" is not a field of this export.` });
      if (f.head && !personal) throw apiError('FORBIDDEN', 'Only the IYF head can export personal details.');
    }
    fields = ids.map(id => BY_ID[id]);
  }
  // the batches: the caller's own (a coordinator), any (the head)
  let batches = [];
  if (!fixed) {
    const mine = await scopeBatches(ctx.db, ctx), ids = Array.isArray(d.batchIds) ? [...new Set(d.batchIds.map(String))] : [];
    if (!ids.length) throw invalid({ path: 'batchIds', message: 'Choose a batch.' });
    for (const id of ids) if (!mine.includes(id)) throw apiError('FORBIDDEN', `You can export only your own batches (${id} is not one).`);
    batches = ids;
  }
  // the range (weeks, days, activity, and a devotee list with summary fields): at most 6 months
  const ranged = grain === 'weeks' || grain === 'days' || grain === 'activity' || fields.some(f => f.group === 'Sadhana summary');
  let from = '', to = '';
  if (ranged) {
    from = validYmd(d.from); to = validYmd(d.to);
    if (!from || !to) throw invalid({ path: 'from', message: 'Choose the dates.' });
    if (to < from) throw invalid({ path: 'to', message: 'The end is before the start.' });
    if ((Date.parse(to) - Date.parse(from)) / DAY_MS > MAX_DAYS) throw invalid({ path: 'to', message: 'At most 6 months at a time.' });
  }
  /*
   * Filters: the week's status (weeks), a facilitator (any devotee rows), and whether somebody meets
   * their batch's promotion criteria (the head, 17 Oct 2026) — "so when we decide to promote someone
   * his data can be verified".
   *
   * `ready` reuses eligible.js rather than restating the thresholds here. Two copies of a promotion
   * rule is how one of them quietly becomes wrong, and this one decides who gets moved up a level.
   */
  const f0 = d.filters && typeof d.filters === 'object' ? d.filters : {};
  const filters = {
    status: ['submitted', 'missed'].includes(f0.status) ? f0.status : '',
    facilitator: typeof f0.facilitator === 'string' ? f0.facilitator.slice(0, 80) : '',
    ready: ['yes', 'no'].includes(f0.ready) ? f0.ready : ''
  };
  const cursor = d.cursor === undefined || d.cursor === null ? null : String(d.cursor);
  if (cursor === null) {
    if (await overLimit(ctx, 'export:' + ctx.login, PER_HOUR, 3600)) throw apiError('BUSY', `At most ${PER_HOUR} exports an hour. Please try again later.`);
    const personal = fields.some(f => f.head);
    await ctx.db.batch([audit(ctx.db, ctx, 'exports.run', '', batches.join(','), null,
      { rows: grain, ...(fields.length ? { fields: fields.map(f => f.id) } : {}), ...(batches.length ? { batches } : {}), ...(from ? { from, to } : {}),
        ...(filters.status ? { status: filters.status } : {}), ...(filters.facilitator ? { facilitator: filters.facilitator } : {}),
        ...(filters.ready ? { ready: filters.ready } : {}), ...(personal ? { personal: true } : {}) }, '', req?.requestId || ''),
      dirty(ctx.db, 'audit_log')]);
  }
  const names = Object.fromEntries((await batchesAll(ctx.db)).map(b => [b.batch_id, b.name]));
  const x = { bn: (id) => names[id] || id };
  const out = (rows, next) => ({ columns: fields.map(f => f.label), rows: rows.map(r => fields.map(f => f.get(r, x))), next });

  if (grain === 'weeks' || grain === 'days') {
    // one week a page: the Mondays from the week of `from` to the week of `to`
    const first = mondayOf(new Date(`${from}T12:00:00+05:30`)), last = mondayOf(new Date(`${to}T12:00:00+05:30`));
    const week = cursor && /^\d{4}-\d{2}-\d{2}$/.test(cursor) ? cursor : first;
    if (week < first || week > last) throw invalid({ path: 'cursor', message: 'Not a page of this export.' });
    const next = addDays(week, 7) <= last ? addDays(week, 7) : null;
    let rows = await weekRows(ctx, week, batches, grain === 'weeks' ? filters.status : 'submitted', filters.facilitator);
    if (grain === 'days') {
      rows = rows.flatMap(r => { const { days, marks } = weekOf(r); return days.map((day, i) => ({ ...r, day: day || {}, m: marks[i] || {}, date: addDays(week, i) }))
        .filter(r => r.date >= from && r.date <= to); });
    }
    return out(rows, next);
  }
  if (grain === 'people') {
    const i = cursor ? Number(cursor) : 0;
    if (!Number.isInteger(i) || i < 0 || i >= batches.length) throw invalid({ path: 'cursor', message: 'Not a page of this export.' });
    let rows = await peopleRows(ctx, batches[i], filters.facilitator, ranged ? { from, to } : null);
    // who meets their batch's criteria, judged over the same range the export covers
    if (filters.ready) rows = await onlyReady(ctx, batches[i], rows, filters.ready, from, to);
    return out(rows, i + 1 < batches.length ? String(i + 1) : null);
  }
  if (grain === 'staff') return staff(ctx, x.bn);
  if (grain === 'batches') return batchList(ctx);
  // activity: 500 rows a page, oldest first, by id (times sort as text: the day after `to` comes after every time on it)
  const after = cursor ? Number(cursor) : 0, dayAfter = ymd(new Date(Date.parse(`${to}T12:00:00+05:30`) + DAY_MS));
  const rows = await all(ctx.db, 'SELECT id, at, who, role, action, target, batch_id, reason, before, after FROM audit_log WHERE id > ? AND at >= ? AND at < ? ORDER BY id LIMIT ?',
    after, from, dayAfter, ACTIVITY_PAGE);
  return { columns: ['When', 'Who', 'Role', 'What', 'About', 'Batch', 'Reason', 'Before', 'After'],
    rows: rows.map(r => [timeOf(r.at), r.who, r.role, r.action, r.target, r.batch_id ? x.bn(r.batch_id) : '', r.reason, r.before, r.after]),
    next: rows.length === ACTIVITY_PAGE ? String(rows[rows.length - 1].id) : null };
}

// the person's account, open membership, group leader and profile, joined on the login of the row's table `t`
const PERSON = (t) => `LEFT JOIN accounts a ON a.login = ${t}.login
  LEFT JOIN memberships m ON m.login = ${t}.login AND m.to_week = ''
  LEFT JOIN accounts l ON l.login = m.leader_login
  LEFT JOIN profiles p ON p.login = ${t}.login`;
const PERSON_COLS = `a.name AS a_name, a.iyf_id AS a_iyf, a.status AS a_status, a.email AS a_email, a.whatsapp AS a_whatsapp,
  m.state AS m_state, m.from_week AS m_from_week, COALESCE((SELECT f."name" FROM facilitators f WHERE f.id = m.fac_id), m.facilitator) AS m_facilitator, m.class_day AS m_class_day, l.name AS l_name,
  p.dob AS p_dob, p.blood_group AS p_blood_group, p.emergency_name AS p_emergency_name, p.emergency_relation AS p_emergency_relation,
  p.emergency_phone AS p_emergency_phone, p.addr_line AS p_addr_line, p.addr_area AS p_addr_area, p.addr_city AS p_addr_city,
  p.addr_state AS p_addr_state, p.addr_pin AS p_addr_pin, p.parent_name AS p_parent_name, p.parent_phone AS p_parent_phone`;
const ATT_COLS = `t.mark_used AS t_mark_used, t.devotee_mark AS t_devotee_mark, t.leader_mark AS t_leader_mark,
  t.coordinator_mark AS t_coordinator_mark, t.master_mark AS t_master_mark`;

/** One week of some batches: the submitted weeks and (unless only submitted) the missed ones, with the person and the
 *  week's attendance. Each table is read by its (week, batch) index. */
async function weekRows(ctx, week, batches, onlyStatus, facilitator) {
  // the facilitator chosen by name, matched by id (Phase 24): every student of theirs, whatever spelling they joined under
  const marks = batches.map(() => '?').join(','), fac = facilitator ? ` AND m.fac_id = ${FAC_ID_OF}` : '', fa = facilitator ? [facilitator] : [];
  const [subs, missed] = await Promise.all([
    onlyStatus === 'missed' ? [] : all(ctx.db, `SELECT s.*, s.name AS s_name, s.iyf_id AS s_iyf, 'sub' AS kind, ${PERSON_COLS}, ${ATT_COLS}
      FROM submissions s ${PERSON('s')} LEFT JOIN attendance t ON t.login = s.login AND t.week_id = s.week_id
      WHERE s.week_id = ? AND s.batch_id IN (${marks})${fac} ORDER BY s.batch_id, s.name`, week, ...batches, ...fa),
    onlyStatus === 'submitted' ? [] : all(ctx.db, `SELECT w.login, w.week_id, w.batch_id, w.days_filled, 'missed' AS kind, ${PERSON_COLS}, ${ATT_COLS}
      FROM missed_weeks w ${PERSON('w')} LEFT JOIN attendance t ON t.login = w.login AND t.week_id = w.week_id
      WHERE w.week_id = ? AND w.batch_id IN (${marks})${fac} ORDER BY w.batch_id, a.name`, week, ...batches, ...fa)]);
  return [...subs, ...missed].map(r => ({ ...r, t: { master_mark: r.t_master_mark, coordinator_mark: r.t_coordinator_mark, leader_mark: r.t_leader_mark, devotee_mark: r.t_devotee_mark } }));
}

/** A batch's devotees now, with (when `range`) their sadhana summary over the range: submitted / missed weeks, days,
 *  average scores and rounds, classes present / absent — three grouped reads by (week, batch). */
async function peopleRows(ctx, batchId, facilitator, range) {
  const rows = await all(ctx.db, `SELECT m.login, m.batch_id, ${PERSON_COLS} FROM memberships mm ${PERSON('mm')}
    WHERE mm.batch_id = ? AND mm.to_week = ''${facilitator ? ` AND mm.fac_id = ${FAC_ID_OF}` : ''} ORDER BY a.name`, batchId, ...(facilitator ? [facilitator] : []));
  if (!range) return rows.map(r => ({ ...r, login: r.login || '' }));
  const w1 = mondayOf(new Date(`${range.from}T12:00:00+05:30`)), w2 = mondayOf(new Date(`${range.to}T12:00:00+05:30`));
  const [subs, missed, att] = await Promise.all([
    all(ctx.db, `SELECT login, COUNT(*) AS n, SUM(days_filled) AS days, AVG(overall) AS overall, AVG(body) AS body, AVG(soul) AS soul, AVG(japa) AS japa,
      AVG(CAST(avg_rounds AS REAL)) AS rounds FROM submissions WHERE week_id >= ? AND week_id <= ? AND batch_id = ? GROUP BY login`, w1, w2, batchId),
    all(ctx.db, 'SELECT login, COUNT(*) AS n FROM missed_weeks WHERE batch_id = ? AND week_id >= ? AND week_id <= ? GROUP BY login', batchId, w1, w2),
    all(ctx.db, "SELECT login, SUM(mark_used = 'P') AS p, SUM(mark_used = 'A') AS a FROM attendance WHERE week_id >= ? AND week_id <= ? AND batch_id = ? GROUP BY login", w1, w2, batchId)]);
  const S = Object.fromEntries(subs.map(s => [s.login, s])), Mi = Object.fromEntries(missed.map(s => [s.login, s.n])), A = Object.fromEntries(att.map(s => [s.login, s]));
  return rows.map(r => { const s = S[r.login];
    return { ...r, g_subs: s?.n || 0, g_missed: Mi[r.login] || 0, g_days: s?.days || 0, g_overall: s?.overall ?? null, g_body: s?.body ?? null, g_soul: s?.soul ?? null,
      g_japa: s?.japa ?? null, g_rounds: s?.rounds ?? null, g_present: A[r.login]?.p || 0, g_absent: A[r.login]?.a || 0 }; });
}

/** Coordinators, the head and facilitator logins (the head). */
async function staff(ctx, bn) {
  const batches = await batchesAll(ctx.db);
  const rows = await all(ctx.db, "SELECT login, name, role, status, is_master, facilitator_name, last_login_at FROM accounts WHERE role IN ('COORDINATOR', 'MASTER') OR is_master = 1 OR facilitator_name <> '' ORDER BY name");
  const coord = (l) => batches.filter(b => csv(b.coordinator_logins).includes(l));
  return { columns: ['Username / phone', 'Name', 'Role', 'Batches', 'Facilitator', 'Status', 'Last sign-in'], next: null,
    rows: rows.map(r => [r.login, r.name, r.is_master || r.role === 'MASTER' ? 'IYF head' : r.role === 'DEVOTEE' ? 'Youth facilitator' : r.facilitator_name && !coord(r.login).length ? 'TRD facilitator' : 'Coordinator',
      coord(r.login).map(b => bn(b.batch_id)).join(', '), r.facilitator_name || '', r.status.toLowerCase(), timeOf(r.last_login_at)]) };
}

/** Every batch, with its coordinators and how many devotees it has now (the head). */
async function batchList(ctx) {
  const [batches, counts, staffNames] = await Promise.all([batchesAll(ctx.db),
    all(ctx.db, "SELECT batch_id, SUM(state = 'ACTIVE') AS active, COUNT(*) AS n FROM memberships WHERE to_week = '' GROUP BY batch_id"),
    all(ctx.db, "SELECT login, name FROM accounts WHERE role IN ('COORDINATOR', 'MASTER') OR is_master = 1")]);
  const C = Object.fromEntries(counts.map(c => [c.batch_id, c])), N = Object.fromEntries(staffNames.map(s => [s.login, s.name]));
  return { columns: ['Batch ID', 'Name', 'Level', 'Active', 'Coordinators', 'Active devotees', 'All devotees'], next: null,
    rows: batches.map(b => [b.batch_id, b.name, b.level, b.active ? 'yes' : 'no', csv(b.coordinator_logins).map(l => N[l] || l).join(', '), C[b.batch_id]?.active || 0, C[b.batch_id]?.n || 0]) };
}

/**
 * Narrow rows to those who do (or do not) meet their batch's promotion criteria.
 *
 * It calls eligibleIn() rather than repeating the thresholds: the export and the eligibility screen
 * must never disagree about who is ready, and two copies of a rule is how they would.
 *
 * The window is the export's own range, so "ready" means ready over what was asked for — not over
 * all time, which would make a six-month export and a one-month export of the same batch disagree
 * for reasons nobody could see.
 */
async function onlyReady(ctx, batchId, rows, want, from, to) {
  const e = await eligibleIn(ctx.db, batchId, from || '0000-00-00', to || '9999-99-99');
  if (!e) return rows;
  const ready = new Set(e.rows.filter(r => r.ready).map(r => r.login));
  return rows.filter(r => (want === 'yes' ? ready.has(r.login) : !ready.has(r.login)));
}
