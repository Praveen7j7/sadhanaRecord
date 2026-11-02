// The devotees a coordinator manages: the searchable member list, one devotee's record, active / inactive,
// disable, delete, and correcting their facilitator or class day — plus a devotee deleting their own account, and
// today's birthdays. Split out of coord.js on 13 October 2026 (audit F27 / roadmap 3.1); the code is unchanged,
// only its home.
import { apiError, invalid, isoIst, ymd, parseIso, validYmd, ageOn, normPhone, cleanName, mondayOf } from './util.js';
import { q, one, all, reads, rows, account, currentMembership, scopeBatches, audit, dirty, isStaffAccount } from './db.js';
import { requireBatch } from './requests.js';
import { manualEvent } from './inactive.js';
import { reasonOf, focusWeek, managed, readSkills } from './staff.js';
import { endSessions } from './session.js';
import { overLimit, BLOOD_GROUPS } from './auth.js';
import { verifyPassword } from './crypto.js';
import { eraseDevotee, isDeleted, DELETED_NAME } from './erase.js';
import { addDays, validWeekId, windowOf } from './weeks.js';
import { classDefault, finalScores, markLevel, markUsed } from './classweek.js';
import { trainingsOf } from './phases.js';
import { CLASS_DAYS, addressView } from './contact.js';
import { isOffered } from './facilitators.js';
import { FAC_ID_OF } from './names.js';
import { consentView } from './profile.js';
import { registryRows, registryPublic, idNameParts } from './registry.js';
import { expected } from './board.js';

/* ------------------------------------------------------------------------ */
/* Devotees                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Members: every devotee of the caller's batches (a master: all of IYF Delhi) — active, inactive and disabled — by their
 * latest membership, filtered and paged on the server. Deleted accounts are gone; pending sign-ups are under Requests.
 */
/* A devotee's status as staff read it (Phase 22 I2): the account's, except that an ACTIVE account whose membership is
   INACTIVE — made inactive for not filling (inactive.js), the login kept — reads INACTIVE too. */
const EFFECTIVE = "CASE WHEN a.status = 'ACTIVE' AND m.state = 'INACTIVE' THEN 'INACTIVE' ELSE a.status END";
export const effective = (status, state) => (status === 'ACTIVE' && state === 'INACTIVE' ? 'INACTIVE' : status);

export async function membersList(d, ctx) {
  const db = ctx.db, mine = await scopeBatches(db, ctx);
  let batches = mine;
  if (d.batchId !== undefined && d.batchId !== '') { await requireBatch(ctx, d.batchId); batches = [String(d.batchId)]; }
  if (!batches.length) return { rows: [], total: 0, counts: { ACTIVE: 0, INACTIVE: 0, DISABLED: 0 } };
  const status = d.status === undefined || d.status === '' ? 'ALL' : String(d.status);
  if (!['ALL', 'ACTIVE', 'INACTIVE', 'DISABLED'].includes(status)) throw invalid({ path: 'status', message: 'ALL, ACTIVE, INACTIVE or DISABLED.' });
  if (d.classDay !== undefined && d.classDay !== '' && !CLASS_DAYS.includes(d.classDay)) throw invalid({ path: 'classDay', message: 'SUN or SAT.' });
  const limit = d.limit === undefined ? 50 : d.limit, offset = d.offset === undefined ? 0 : d.offset;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid({ path: 'limit', message: '1 to 200.' });
  if (!Number.isInteger(offset) || offset < 0) throw invalid({ path: 'offset', message: '0 or more.' });
  const sort = d.sort === undefined ? 'name' : d.sort;
  if (!['name', 'inactive', 'lastSubmitted'].includes(sort)) throw invalid({ path: 'sort', message: 'name, inactive or lastSubmitted.' });
  const marks = batches.map(() => '?').join(',');
  const where = [`m.batch_id IN (${marks})`], args = [...batches];
  if (d.classDay) { where.push('m.class_day = ?'); args.push(d.classDay); }
  // blood group (the head, 3 Oct 2026): from the profile; "Don't know" finds those who said so
  if (d.bloodGroup !== undefined && d.bloodGroup !== '') {
    if (!BLOOD_GROUPS.includes(d.bloodGroup)) throw invalid({ path: 'bloodGroup', message: 'One of ' + BLOOD_GROUPS.join(', ') + '.' });
    where.push('EXISTS (SELECT 1 FROM profiles bp WHERE bp.login = a.login AND bp.blood_group = ?)'); args.push(d.bloodGroup);
  }
  const text = String(d.q || '').trim().toLowerCase();
  if (text) { where.push("(LOWER(a.name) LIKE ? OR a.login LIKE ? OR LOWER(COALESCE(a.iyf_id, '')) LIKE ?)"); args.push(`%${text}%`, `%${text.replace(/\D/g, '') || text}%`, `%${text}%`); }
  const base = `FROM accounts a JOIN memberships m ON m.id = (SELECT id FROM memberships x WHERE x.login = a.login ORDER BY x.id DESC LIMIT 1)
                WHERE a.role = 'DEVOTEE' AND a.status IN ('ACTIVE', 'INACTIVE', 'DISABLED') AND ${where.join(' AND ')}`;
  const counts = { ACTIVE: 0, INACTIVE: 0, DISABLED: 0 };
  for (const c of await all(db, `SELECT ${EFFECTIVE} AS status, COUNT(*) AS n ${base} GROUP BY 1`, ...args)) counts[c.status] = c.n;
  const order = sort === 'inactive' ? `CASE WHEN ${EFFECTIVE} = 'INACTIVE' THEN 0 ELSE 1 END, m.from_week, a.name`
              : sort === 'lastSubmitted' ? "last_submitted IS NULL DESC, last_submitted, a.name" : 'a.name COLLATE NOCASE';
  // the facilitator by id, named as they are now (Phase 24); a membership naming nobody on the list keeps its text
  const rows = await all(db, `SELECT a.login, a.name, a.iyf_id, a.status, a.whatsapp, a.email, a.last_login_at, m.batch_id, m.state, m.from_week, m.class_day,
      COALESCE((SELECT f."name" FROM facilitators f WHERE f.id = m.fac_id), m.facilitator) AS facilitator,
      (SELECT MAX(week_id) FROM submissions s WHERE s.login = a.login) AS last_submitted,
      (SELECT COUNT(*) FROM submissions s WHERE s.login = a.login) AS weeks_submitted,
      EXISTS (SELECT 1 FROM photos p WHERE p.login = a.login) AS has_photo,
      (SELECT blood_group FROM profiles bp WHERE bp.login = a.login) AS blood_group
      ${base} ${status === 'ALL' ? '' : `AND ${EFFECTIVE} = ?`} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, ...(status === 'ALL' ? [] : [status]), limit, offset);
  const names = Object.fromEntries((await all(db, 'SELECT batch_id, name FROM batches')).map(b => [b.batch_id, b.name]));
  return {
    rows: rows.map(r => ({ login: r.login, name: r.name, iyfId: r.iyf_id || null, status: effective(r.status, r.state), batchId: r.batch_id, batchName: names[r.batch_id] || r.batch_id,
      // an inactive membership row starts the week the person became inactive
      inactiveSince: r.status === 'INACTIVE' || r.state === 'INACTIVE' ? r.from_week : null, since: r.state === 'ACTIVE' ? r.from_week : null,
      classDay: r.class_day || null, facilitator: r.facilitator || '', whatsapp: r.whatsapp || '', email: r.email || '', hasPhoto: !!r.has_photo, bloodGroup: r.blood_group || null,
      lastSubmitted: r.last_submitted || null, weeksSubmitted: r.weeks_submitted, lastLogin: r.last_login_at || null })),
    total: status === 'ALL' ? counts.ACTIVE + counts.INACTIVE + counts.DISABLED : counts[status], counts
  };
}

export async function devoteesGet(d, ctx) {
  const db = ctx.db, { a, m, batchId } = await managed(ctx, d.login, { allowPending: true });
  /* Profile, membership history, recent weeks and photo in ONE round trip (22 Oct 2026): they are independent, and
     ran one after another after the access check. The attendance read below needs the weeks, so it follows; the
     trainings come from phases.js (trainingsOf, the product lane's file) and are left as they are. */
  const [p, history, weekRows, ph] = await reads(db, [
    q(db, 'SELECT * FROM profiles WHERE login = ?', a.login),
    rows(q(db, 'SELECT batch_id, state, from_week, to_week, facilitator, class_day, reason FROM memberships WHERE login = ? ORDER BY id', a.login)),
    rows(q(db, `SELECT s.week_id AS week_id, 'SUBMITTED' AS status, s.overall, s.body, s.soul, s.seva, s.attendance, s.on_behalf, t.mark_used, s.days_filled, s.score_card FROM submissions s
                                LEFT JOIN attendance t ON t.login = s.login AND t.week_id = s.week_id WHERE s.login = ?
                                UNION ALL SELECT x.week_id, CASE WHEN r.login IS NULL THEN 'MISSED' ELSE 'REOPENED' END, CASE WHEN r.login IS NULL THEN 0 END, NULL, NULL, NULL, NULL, 0, r.open_until, x.days_filled, '' FROM missed_weeks x
                                  LEFT JOIN reopens r ON r.login = x.login AND r.week_id = x.week_id AND r.state = 'OPEN' WHERE x.login = ? ORDER BY week_id DESC LIMIT 8`, a.login, a.login)),
    q(db, 'SELECT updated_at FROM photos WHERE login = ?', a.login)
  ]);
  const weeks = weekRows.map(w => (w.status === 'SUBMITTED' ? finalScores(w, w.mark_used) : w));
  const att = weeks.length ? Object.fromEntries((await all(db, `SELECT week_id, devotee_mark, leader_mark, coordinator_mark, master_mark FROM attendance WHERE login = ? AND week_id IN (${weeks.map(() => '?').join(',')})`,
    a.login, ...weeks.map(w => w.week_id))).map(r => [r.week_id, r])) : {};
  return {
    login: a.login, name: a.name, iyfId: a.iyf_id || null, status: effective(a.status, m?.state), batchId,
    facilitator: m?.facilitator || a.requested_facilitator || '', classDay: m?.class_day || a.requested_class_day || null,
    email: a.email || '', whatsapp: a.whatsapp || '',
    since: m?.from_week || null, levelEntryDate: m?.level_entry_date || null,
    hasPhoto: !!ph, photoUpdatedAt: ph?.updated_at || null,
    profile: p ? { dob: p.dob || null, age: p.dob ? ageOn(p.dob, ctx.now()) : null, bloodGroup: p.blood_group || null,
                   profession: p.profession || '', skills: readSkills(p.skills), connectedSince: p.connected_since || '',
                   emergency: { name: p.emergency_name, relation: p.emergency_relation, phone: p.emergency_phone }, address: addressView(p), ...consentView(p) } : null,
    memberships: history.map(h => ({ batchId: h.batch_id, state: h.state, fromWeek: h.from_week, toWeek: h.to_week || null, facilitator: h.facilitator, classDay: h.class_day || null, reason: h.reason })),
    // trainings they have been through: the ETP tab goes when the batch closes, and this is what
    // remains of it — which training, when, and how they did (the head, 17 Oct 2026)
    trainings: await trainingsOf(db, a.login),
    // REOPENED: a missed week the master reopened, open until openUntil
    // each week's attendance that counts and who gave it (the head can change it right there, 4 Oct 2026)
    lastWeeks: weeks.map(w => ({ weekId: w.week_id, status: w.status, overall: w.overall, daysFilled: w.days_filled ?? 7, byCoordinator: !!w.on_behalf, ...(w.status === 'REOPENED' ? { openUntil: w.mark_used } : {}),
      attendance: att[w.week_id] ? { used: markUsed(att[w.week_id], null) || null, by: markLevel(att[w.week_id], null) || null } : null }))
  };
}

/** Weeks a status change may start from: this week, last week while it is open, or next week. */
export async function startWeek(db, now, fromWeek) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7), ok = [thisWeek, addDays(thisWeek, 7)];
  if (now < (await windowOf(db, lastWeek)).closes) ok.unshift(lastWeek);
  const w = fromWeek === undefined ? thisWeek : String(fromWeek);
  if (!ok.includes(w)) throw invalid({ path: 'fromWeek', message: 'Choose this week, next week, or last week until its deadline.' });
  return w;
}

/**
 * Inactive from a week (the head, 26 Oct 2026, Phase 22 I2): the devotee drops off every count from that week — the
 * open MEMBERSHIP is INACTIVE, the same state the daily automatic job sets (inactive.js, ADR 0020). The account stays
 * ACTIVE: the login and its sessions keep working, the history is kept, and their next submitted week makes them
 * active again by itself (inactive.js cameBack). Blocking the login is devotees.setDisabled, not this.
 * Active again: the membership is ACTIVE from that week, same batch, facilitator, class day and group; no approval.
 * An account left INACTIVE by the old rule (or a closed intake) is made ACTIVE by either, so the login works again.
 * A coordinator, facilitator or head among the devotees is changed only by the head (managed({ change: true })).
 */
export async function devoteesSetActive(d, ctx, req) {
  if (typeof d.active !== 'boolean') throw invalid({ path: 'active', message: 'true or false.' });
  const db = ctx.db, now = ctx.now(), at = isoIst(now), { a, m, batchId } = await managed(ctx, d.login, { change: true });
  if (a.status === 'DISABLED') throw apiError('CONFLICT', 'Enable the account first.');
  // nothing to do when the login is ACTIVE and the membership already says so — except a person the APP made inactive
  // being marked inactive by a person: that becomes their decision, so using the app no longer undoes it (ADR 0020)
  if (a.status === 'ACTIVE' && (m?.state === 'ACTIVE') === d.active && !(a.auto_inactive && !d.active)) return { status: effective(a.status, m?.state) };
  if (!m) throw apiError('CONFLICT', 'This devotee has no batch.');
  const from = await startWeek(db, now, d.fromWeek), state = d.active ? 'ACTIVE' : 'INACTIVE', reason = d.active ? 'reactivated' : 'inactive';
  const stmts = m.state === state
    // the membership already says so (an account left INACTIVE by the old rule): only the account changes below
    ? []
    : m.from_week >= from
    // the open membership starts that same week (or later): change it in place
    ? [q(db, 'UPDATE memberships SET state = ?, from_week = ?, set_by = ?, set_at = ?, reason = ? WHERE id = ?', state, from, ctx.login, at, reason, m.id)]
    : [q(db, 'UPDATE memberships SET to_week = ? WHERE id = ?', addDays(from, -7), m.id),
       q(db, `INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, class_day, facilitator, fac_id, leader_login, set_by, set_at, reason)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, a.login, m.iyf_id || a.iyf_id || '', m.batch_id, state, from, m.level_entry_date, m.class_day, m.facilitator, m.fac_id ?? null, m.leader_login || '', ctx.login, at, reason)];
  await db.batch([...stmts,
    ...(a.status === 'INACTIVE' ? [q(db, "UPDATE accounts SET status = 'ACTIVE', updated_at = ?, updated_by = ? WHERE login = ?", at, ctx.login, a.login)] : []),
    // a person's decision replaces the app's: the flag that lets using the app bring them back goes (ADR 0020)
    ...(a.auto_inactive ? [q(db, 'UPDATE accounts SET auto_inactive = 0 WHERE login = ?', a.login)] : []),
    // the change of who is counted, for the notices and the analysis (inactive.js); none when the membership already said so
    ...(stmts.length ? [manualEvent(db, ctx, { login: a.login, batchId: m.batch_id, change: state, at })] : []),
    audit(db, ctx, d.active ? 'devotees.reactivate' : 'devotees.inactive', a.login, batchId, { status: effective(a.status, m.state) }, { status: state, fromWeek: from }, '', req.requestId),
    dirty(db, 'accounts', 'memberships', 'audit_log')]);
  return { status: state, fromWeek: from };
}

export async function devoteesSetDisabled(d, ctx, req) {
  if (typeof d.disabled !== 'boolean') throw invalid({ path: 'disabled', message: 'true or false.' });
  const db = ctx.db, at = isoIst(ctx.now()), { a, batchId } = await managed(ctx, d.login, { change: true });
  if (!d.disabled && a.status !== 'DISABLED') return { status: a.status };
  if (d.disabled && a.status === 'DISABLED') return { status: a.status };
  // enabling always returns the LOGIN to ACTIVE (Phase 22 I2): whether they are counted is the membership's state, which
  // this does not touch — an inactive membership stays inactive, and reads INACTIVE on staff screens (effective)
  const m = await currentMembership(db, a.login), status = d.disabled ? 'DISABLED' : 'ACTIVE';
  await db.batch([
    q(db, 'UPDATE accounts SET status = ?, updated_at = ?, updated_by = ? WHERE login = ?', status, at, ctx.login, a.login),
    ...(d.disabled ? [endSessions(ctx, a.login, 'disabled')] : []),
    audit(db, ctx, d.disabled ? 'devotees.disable' : 'devotees.enable', a.login, batchId, { status: a.status }, { status }, '', req.requestId),
    dirty(db, 'accounts', 'audit_log')]);
  return { status: d.disabled ? status : effective(status, m?.state) };
}

/** Removes the login, drafts, profile and photo; submitted weeks, missed weeks and attendance are kept. The phone may sign up again. */
export async function devoteesDelete(d, ctx, req) {
  // change: true (13 Oct 2026, audit F2) — isStaffAccount() also covers a facilitator login, which the inline check
  // below did not: a batch coordinator could erase a youth facilitator's account. managed() refuses that for anyone
  // but the head, exactly as devotees.setActive / setDisabled / setPeople and photo.remove already did.
  const { a } = await managed(ctx, d.login, { allowPending: true, change: true });
  if (normPhone(d.confirmPhone) !== a.login) throw invalid({ path: 'confirmPhone', message: 'Type the phone number again to confirm.' });
  // kept for the head, whom managed({ change: true }) lets through: the head still may not delete a coordinator
  // or another head without removing that role first.
  if (a.is_master || a.facilitator_name || (await all(ctx.db, 'SELECT coordinator_logins FROM batches')).some(b => (b.coordinator_logins || '').split(',').map(s => s.trim()).includes(a.login)))
    throw apiError('FORBIDDEN', 'This person is a coordinator, facilitator or master; that role is removed first.');
  // the same as the person deleting their own account (the head, 5 Oct 2026): weeks kept, anonymised (erase.js)
  await eraseDevotee(ctx, a, 'coordinator', req.requestId);
  return {};
}

/** A devotee deletes their own account (store rules): their password and the word DELETE. Staff and facilitators ask
 *  the IYF head to remove that role first. Everything is removed or anonymised as in erase.js; the session ends with it. */
export async function accountDelete(d, ctx, req) {
  const a = ctx.acct;
  if (await overLimit(ctx, 'del:' + ctx.login, 5, 900)) throw apiError('BUSY', 'Too many tries. Please wait 15 minutes and try again.');
  if (a.role !== 'DEVOTEE' || a.facilitator_name || await isStaffAccount(ctx.db, a)) throw apiError('FORBIDDEN', 'Ask the IYF head to remove your role first.');
  if (typeof d.password !== 'string' || !(await verifyPassword(d.password, a, ctx.env.PW_PEPPER))) throw apiError('BAD_CREDENTIALS', 'Your password is wrong.');
  if (String(d.confirm ?? '').trim().toUpperCase() !== 'DELETE') throw invalid({ path: 'confirm', message: 'Type DELETE to confirm.' });
  await eraseDevotee(ctx, a, 'self', req.requestId);
  return {};
}

/** The coordinator corrects the facilitator (decision 33: from the list only) or the class day (Sunday / Saturday). */
export async function devoteesSetPeople(d, ctx, req) {
  const db = ctx.db, { a, m, batchId } = await managed(ctx, d.login, { change: true });
  if (!m) throw apiError('CONFLICT', 'This devotee has no batch.');
  const next = { facilitator: m.facilitator, class_day: m.class_day }, problems = [];
  if (d.facilitator !== undefined) {
    // a name switched off by the master is kept if it is the devotee's current one, but cannot be newly chosen
    if (String(d.facilitator) !== m.facilitator && !(await isOffered(db, d.facilitator))) problems.push({ path: 'facilitator', message: 'Choose the facilitator from the list.' });
    next.facilitator = String(d.facilitator);
  }
  if (d.classDay !== undefined) {
    if (!CLASS_DAYS.includes(d.classDay)) problems.push({ path: 'classDay', message: 'Sunday or Saturday.' });
    next.class_day = d.classDay;
  }
  if (problems.length) throw invalid(problems);
  // the name and the facilitator's id together (Phase 24): reads follow the id
  await db.batch([q(db, `UPDATE memberships SET facilitator = ?, fac_id = ${FAC_ID_OF}, class_day = ? WHERE id = ?`, next.facilitator, next.facilitator, next.class_day, m.id),
    audit(db, ctx, 'devotees.setPeople', a.login, batchId, { facilitator: m.facilitator, classDay: m.class_day }, { facilitator: next.facilitator, classDay: next.class_day }, '', req.requestId),
    dirty(db, 'memberships', 'audit_log')]);
  return { facilitator: next.facilitator, classDay: next.class_day || null };
}
/* ------------------------------------------------------------------------ */
/* Birthdays                                                                  */
/* ------------------------------------------------------------------------ */

/** Today's birthdays in the caller's batches, and the next 7 days'. */
export async function birthdaysToday(d, ctx) {
  const batches = await scopeBatches(ctx.db, ctx);
  if (!batches.length) return { today: [], upcoming: [] };
  const rows = await all(ctx.db, `SELECT a.login, a.name, m.batch_id, p.dob FROM memberships m
    JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE' JOIN profiles p ON p.login = a.login AND p.dob <> ''
    WHERE m.to_week = '' AND m.state = 'ACTIVE' AND m.batch_id IN (${batches.map(() => '?').join(',')})`, ...batches);
  const now = ctx.now(), days = Array.from({ length: 8 }, (_, i) => ymd(new Date(now.getTime() + i * 86400000)));
  const today = [], upcoming = [];
  for (const r of rows) {
    const i = days.findIndex(x => x.slice(5) === r.dob.slice(5) || (r.dob.slice(5) === '02-29' && x.slice(5) === '03-01' && !days.some(y => y.slice(5) === '02-29')));
    if (i < 0) continue;
    const item = { login: r.login, name: r.name, batchId: r.batch_id, date: days[i], age: ageOn(r.dob, new Date(`${days[i]}T12:00:00+05:30`)) };
    (i === 0 ? today : upcoming).push(item);
  }
  upcoming.sort((x, y) => x.date.localeCompare(y.date) || x.name.localeCompare(y.name));
  return { today: today.sort((x, y) => x.name.localeCompare(y.name)), upcoming };
}
