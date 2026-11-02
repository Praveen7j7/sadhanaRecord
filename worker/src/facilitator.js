// Facilitator logins (the head, 4 Oct 2026). The IYF head gives a facilitator of the facilitators list a login: a staff
// login (role COORDINATOR — the accounts table allows only three roles) with NO batches and accounts.facilitator_name
// set; that name is what grants this read-only view, nothing else (the coordinator screens leave these logins out). The facilitator sees, READ-ONLY, every devotee whose membership has
// that facilitator — any batch — with their week, their submitted weeks and scores, and calls or WhatsApps them. They
// never change anything of a devotee. The head creates, resets and switches these logins off (Admin › Facilitators).
import { apiError, invalid, isoIst, normPhone, validUsername, passwordProblem } from './util.js';
import { hashPassword } from './crypto.js';
import { q, one, all, audit, dirty, currentMembership } from './db.js';
import { endSessions } from './session.js';
import { iterations } from './auth.js';
import { boardRows, focusWeek, managed } from './coord.js';
import { validWeekId, windowOf, weekStatus, pickScores, stateOf, openWeeks, COLS } from './weeks.js';
import { weekOf } from './weekjson.js';
import { finalScores } from './classweek.js';
import { dayMarks, weekScores } from './scoring.js';
import { myFacId, FAC_ID_OF } from './names.js';

// kind: 'login' — a facilitator-only login (username + the head's temporary password); 'member' — a devotee of the app
// who is also a facilitator (the head, 7 Oct 2026): their own phone login gets "My students", no second login.
// batch: a member's batch; a facilitator with no batch is shown as TRD (temple resident devotee, the head, 7 Oct 2026)
const loginView = (a, batch = '') => ({ username: a.login, facilitator: a.facilitator_name, name: a.name, status: a.status, mustChangePassword: !!a.must_change_pw, lastLogin: a.last_login_at || null,
  kind: a.role === 'DEVOTEE' ? 'member' : 'login', batch: batch || 'TRD' });
async function facRow(db, username) {
  const a = await one(db, "SELECT * FROM accounts WHERE login = ? AND facilitator_name <> ''", String(username || '').trim().toLowerCase());
  if (!a) throw apiError('NOT_FOUND', 'No facilitator login with that username.');
  return a;
}
const viewOf = async (db, a) => loginView(a, a.role === 'DEVOTEE' ? (await currentMembership(db, a.login))?.batch_id || '' : '');

/* ---- the IYF head: facilitator logins ---- */
export async function loginsList(d, ctx) {
  const rows = await all(ctx.db, `SELECT a.*, m.batch_id AS m_batch FROM accounts a LEFT JOIN memberships m ON m.login = a.login AND m.to_week = '' AND a.role = 'DEVOTEE'
                                  WHERE a.facilitator_name <> '' AND a.role IN ('COORDINATOR', 'DEVOTEE') ORDER BY a.name`);
  return { logins: rows.map(a => loginView(a, a.m_batch || '')) };
}

/** A facilitator who already uses the app as a devotee (the head, 7 Oct 2026): their own account gets the facilitator
 *  view ("My students" in their menu). No new login; the head may still give them a temporary password. */
export async function loginsLink(d, ctx, req) {
  const db = ctx.db, problems = [], name = String(d.facilitator || ''), phone = normPhone(d.phone);
  if (!(await one(db, 'SELECT 1 AS x FROM facilitators WHERE name = ?', name))) problems.push({ path: 'facilitator', message: 'Choose a facilitator from the list.' });
  else if (await one(db, "SELECT 1 AS x FROM accounts WHERE facilitator_name = ? AND status <> 'DISABLED'", name)) problems.push({ path: 'facilitator', message: `${name} already has a login.` });
  const a = phone ? await one(db, 'SELECT * FROM accounts WHERE login = ?', phone) : null;
  if (!phone) problems.push({ path: 'phone', message: 'Enter their 10-digit mobile number.' });
  else if (!a || a.role !== 'DEVOTEE') problems.push({ path: 'phone', message: 'No devotee in the app with that number.' });
  else if (a.status !== 'ACTIVE') problems.push({ path: 'phone', message: 'That devotee is not active.' });
  else if (a.facilitator_name) problems.push({ path: 'phone', message: `${a.name} is already linked to ${a.facilitator_name}.` });
  if (problems.length) throw invalid(problems);
  await db.batch([
    // the head links a facilitator in their own right: lasting (ADR 0010), never taken back with a training
    q(db, `UPDATE accounts SET facilitator_name = ?, fac_id = ${FAC_ID_OF}, facilitation = 'lasting', updated_at = ?, updated_by = ? WHERE login = ?`, name, name, isoIst(ctx.now()), ctx.login, a.login),
    audit(db, ctx, 'facilitators.linkMember', a.login, '', null, { facilitator: name }, '', req.requestId),
    dirty(db, 'accounts', 'audit_log')]);
  return { login: await viewOf(db, await facRow(db, a.login)) };
}
/** Takes the facilitator view off a devotee's own account (their sadhana and login stay as they are). */
export async function loginsUnlink(d, ctx, req) {
  const db = ctx.db, a = await facRow(db, d.username);
  if (a.role !== 'DEVOTEE') throw apiError('CONFLICT', 'This is a facilitator login: switch it off instead.');
  await db.batch([
    q(db, "UPDATE accounts SET facilitator_name = '', fac_id = NULL, facilitation = '', updated_at = ?, updated_by = ? WHERE login = ?", isoIst(ctx.now()), ctx.login, a.login),
    audit(db, ctx, 'facilitators.unlinkMember', a.login, '', { facilitator: a.facilitator_name }, null, '', req.requestId),
    dirty(db, 'accounts', 'audit_log')]);
  return { ok: true };
}
export async function loginsCreate(d, ctx, req) {
  const db = ctx.db, problems = [], username = String(d.username || '').trim().toLowerCase(), name = String(d.facilitator || '');
  if (!validUsername(username)) problems.push({ path: 'username', message: 'Use 3–30 lowercase letters, digits, dots or dashes, starting with a letter.' });
  if (!(await one(db, 'SELECT 1 AS x FROM facilitators WHERE name = ?', name))) problems.push({ path: 'facilitator', message: 'Choose a facilitator from the list.' });
  else if (await one(db, "SELECT 1 AS x FROM accounts WHERE facilitator_name = ? AND facilitator_name <> '' AND status <> 'DISABLED'", name)) problems.push({ path: 'facilitator', message: `${name} already has a login.` });
  const pw = passwordProblem(d.tempPassword, username);
  if (pw) problems.push({ path: 'tempPassword', message: pw });
  if (problems.length) throw invalid(problems);
  const h = await hashPassword(d.tempPassword, await iterations(db), ctx.env.PW_PEPPER), now = isoIst(ctx.now());
  try {
    await db.batch([
      // a facilitator login IS that facilitator, under the same name (Phase 24): one record, renamed as one
      q(db, `INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, must_change_pw, signed_up_at, decided_at, decided_by, updated_at, updated_by, facilitator_name, facilitation, fac_id)
             VALUES (?, 'COORDINATOR', 'ACTIVE', ?, '', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'lasting', ${FAC_ID_OF})`, username, name, h.pw_hash, h.pw_salt, h.pw_iterations, now, now, ctx.login, now, ctx.login, name, name),
      q(db, "UPDATE facilitators SET login = ? WHERE id = " + FAC_ID_OF + " AND login IS NULL", username, name),
      audit(db, ctx, 'facilitators.loginCreate', username, '', null, { facilitator: name }, '', req.requestId),
      dirty(db, 'accounts', 'audit_log')
    ]);
  } catch (e) {
    if (/UNIQUE|PRIMARY KEY/i.test(String(e.message))) throw apiError('CONFLICT', `The username ${username} is taken.`);
    throw e;
  }
  return { login: loginView(await facRow(db, username)) };
}
export async function loginsSetDisabled(d, ctx, req) {
  if (typeof d.disabled !== 'boolean') throw invalid({ path: 'disabled', message: 'Choose on or off.' });
  const db = ctx.db, a = await facRow(db, d.username), status = d.disabled ? 'DISABLED' : 'ACTIVE';
  // a devotee's own account is never switched off from here (their sadhana would stop): remove the facilitator link instead
  if (a.role === 'DEVOTEE') throw apiError('CONFLICT', `${a.name} uses the app as a devotee: remove the facilitator link instead.`);
  await db.batch([
    q(db, 'UPDATE accounts SET status = ?, updated_at = ?, updated_by = ? WHERE login = ?', status, isoIst(ctx.now()), ctx.login, a.login),
    ...(d.disabled ? [endSessions(ctx, a.login, 'disabled')] : []),
    audit(db, ctx, 'facilitators.loginSetDisabled', a.login, '', { status: a.status }, { status }, '', req.requestId), dirty(db, 'accounts', 'audit_log')]);
  return { login: await viewOf(db, await facRow(db, a.login)) };
}
export async function loginsResetPassword(d, ctx, req) {
  const db = ctx.db, a = await facRow(db, d.username), problem = passwordProblem(d.tempPassword, a.login);
  if (problem) throw invalid({ path: 'tempPassword', message: problem });
  const h = await hashPassword(d.tempPassword, await iterations(db), ctx.env.PW_PEPPER);
  await db.batch([
    q(db, "UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iterations = ?, must_change_pw = 1, failed_tries = 0, locked_until = '', updated_at = ?, updated_by = ? WHERE login = ?",
      h.pw_hash, h.pw_salt, h.pw_iterations, isoIst(ctx.now()), ctx.login, a.login),
    endSessions(ctx, a.login, 'reset'),
    audit(db, ctx, 'facilitators.loginResetPassword', a.login, '', null, null, '', req.requestId), dirty(db, 'accounts', 'audit_log')]);
  return { login: await viewOf(db, await facRow(db, a.login)) };
}

/* ---- the facilitator: their devotees, read-only ---- */
const myName = ctx => ctx.scopes?.facilitator?.name || '';
// whose students: by the facilitator's permanent id (Phase 24), so a rename — or a past week under an older spelling —
// never loses one. A facilitator scope with no id yet (a row written by older code) finds nobody rather than a namesake.
const myId = ctx => (ctx.scopes?.facilitator ? myFacId(ctx) : '');
const memberView = (r, names) => ({
  login: r.login, name: r.name, iyfId: r.iyfId, phone: r.login, whatsapp: r.whatsapp || r.login, hasPhoto: r.hasPhoto, batchId: r.batchId, batchName: names[r.batchId] || r.batchId,
  active: r.membership === 'ACTIVE' && r.accountStatus === 'ACTIVE', status: r.status, daysFilled: r.daysFilled, days: r.days, overall: r.overall, attendance: r.attendance?.used || null
});
const batchNames = async db => Object.fromEntries((await all(db, 'SELECT batch_id, name FROM batches')).map(b => [b.batch_id, b.name]));

/** fac.devotees: every devotee under this facilitator for a week (default: the focus week), any batch. */
export async function devotees(d, ctx) {
  const db = ctx.db, weekId = d.weekId === undefined ? await focusWeek(db, ctx.now()) : String(d.weekId);
  if (!validWeekId(weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const rows = myId(ctx) ? await boardRows(db, [], weekId, { facilitator: myId(ctx) }) : [], names = await batchNames(db), win = await windowOf(db, weekId);
  return { weekId, closesAt: isoIst(win.closes), facilitator: myName(ctx), rows: rows.filter(r => r.login !== ctx.login).map(r => memberView(r, names)) };
}

/** The devotee, if their current membership (or one that week) has this facilitator; else NOT_FOUND. */
async function mine(ctx, loginIn, weekId = '') {
  const login = normPhone(loginIn), id = myId(ctx);
  const m = login && id ? await one(ctx.db, `SELECT m.*, a.name, a.whatsapp, a.iyf_id, a.status FROM memberships m JOIN accounts a ON a.login = m.login
      WHERE m.login = ? AND m.fac_id = ? AND ${weekId ? "m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)" : "m.to_week = ''"} ORDER BY m.id DESC LIMIT 1`,
      login, id, ...(weekId ? [weekId, weekId] : [])) : null;
  if (!m) throw apiError('NOT_FOUND', 'Not one of your devotees.');
  return m;
}

/** fac.devotee: one devotee — contact, batch, and their last weeks with scores. */
export async function devotee(d, ctx) {
  return devoteeView(ctx.db, await mine(ctx, d.login));
}

/** The student page's data for a membership row joined with its account (name, whatsapp, iyf_id, status): shared by
 *  fac.devotee and share.devotee (shares.js), which takes the contact fields off. The caller has checked access. */
export async function devoteeView(db, m) {
  const names = await batchNames(db);
  const weeks = (await all(db, `SELECT s.week_id AS week_id, 'SUBMITTED' AS status, s.overall, s.body, s.soul, s.seva, s.attendance, s.on_behalf, t.mark_used, s.days_filled, s.score_card FROM submissions s
                                LEFT JOIN attendance t ON t.login = s.login AND t.week_id = s.week_id WHERE s.login = ?
                                UNION ALL SELECT x.week_id, 'MISSED', 0, NULL, NULL, NULL, NULL, 0, NULL, x.days_filled, '' FROM missed_weeks x WHERE x.login = ? ORDER BY week_id DESC LIMIT 60`, m.login, m.login))
    .map(w => (w.status === 'SUBMITTED' ? finalScores(w, w.mark_used) : w));
  return { login: m.login, name: m.name, iyfId: m.iyf_id || null, phone: m.login, whatsapp: m.whatsapp || m.login, batchId: m.batch_id, batchName: names[m.batch_id] || m.batch_id,
    active: m.state === 'ACTIVE' && m.status === 'ACTIVE', since: m.from_week,
    weeks: weeks.map(w => ({ weekId: w.week_id, status: w.status, overall: w.overall, daysFilled: w.days_filled ?? 7, body: w.body, soul: w.soul, seva: w.seva, attendance: w.attendance })) };
}

/** fac.week: one week of one devotee — a submitted week in full (day by day, scores), else how far it is filled. */
export async function week(d, ctx) {
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  return weekRead(ctx.db, (await mine(ctx, d.login, d.weekId)).login, d.weekId);
}

/**
 * devotees.week: the same read-only view for a coordinator (own batches) or the IYF head (anyone). VIEWING a devotee's
 * sadhana is its own permission, apart from filling it for them (the head, 4 Oct 2026): facilitators view only; the
 * coordinator and the head can view and fill.
 */
export async function staffWeek(d, ctx) {
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const { a } = await managed(ctx, d.login, { allowPending: false });
  // a coordinator views (and fills) only the week the devotee is filling now; the IYF head any week (4 Oct 2026)
  if (!ctx.scopes.master && !(await openWeeks(ctx.db, a.login, ctx.now())).includes(d.weekId)) throw apiError('FORBIDDEN', 'Coordinators see only the week being filled now. Ask the IYF head for an earlier week.');
  return weekRead(ctx.db, a.login, d.weekId);
}

/**
 * How the week is going so far (the user, 11 Oct 2026). A facilitator opening a week that is still being
 * filled saw only each day's percentage and had to add them up in their head. This gives the gist:
 * the running total, and what the devotee actually read, heard and did.
 *
 * It is a PREVIEW of an unfinished week: the percentages come from the same weekScores() the final score
 * uses, so a part week is scored out of the full 175 marks and the total only rises as more days are
 * filled — the number a facilitator sees here never disagrees with the one after Submit.
 * Attendance and the week-end answers are not known until Submit, so they count as 0 and the total is
 * marked `partial`.
 */
async function weekSummary(db, days, cardName) {
  const filled = days.filter(Boolean);
  if (!filled.length) return null;
  const seven = days.map(x => x || {});
  const sevaMin = filled.reduce((n, x) => n + (Number(x.serviceMin) || 0), 0);
  const sc = weekScores(cardName, seven, '', sevaMin);          // attendance unknown while filling

  const mins = (k) => filled.reduce((n, x) => n + (Number(x[k]) || 0), 0);
  const rounds = filled.reduce((n, x) => n + (Number(x.rounds) || 0), 0);

  // what they read and heard, by name — a facilitator should not have to read ids
  const bookIds = [...new Set(filled.map(x => x.reading?.bookId).filter(Boolean))];
  const lecIds = [...new Set(filled.flatMap(x => (x.hearing || []).map(h => h.lectureId)).filter(Boolean))];
  const books = bookIds.length
    ? (await all(db, `SELECT title FROM books WHERE book_id IN (${bookIds.map(() => '?').join(',')})`, ...bookIds)).map(r => r.title) : [];
  const lectures = lecIds.length
    ? (await all(db, `SELECT title FROM lectures WHERE lecture_id IN (${lecIds.map(() => '?').join(',')})`, ...lecIds)).map(r => r.title) : [];

  return {
    daysFilled: filled.length,
    partial: true,                     // attendance and the week-end answers come at Submit
    overall: sc.overall, body: sc.body, soul: sc.soul,
    reading: { minutes: mins('readingMin'), books },
    hearing: { minutes: mins('hearingMin'), lectures },
    seva: { minutes: sevaMin },
    japa: { rounds, days: filled.filter(x => Number(x.rounds) > 0).length }
  };
}

/** One week of one devotee, read-only (fac.week, devotees.week, share.week). The caller has checked access. */
export async function weekRead(db, login, weekId) {
  const d = { weekId }, m = { login }, w = await weekStatus(db, m.login, d.weekId);
  // the batch's score card, for the week's reading / hearing list (looked up once, both branches)
  const b = await one(db, `SELECT b.score_card FROM memberships m JOIN batches b ON b.batch_id = m.batch_id
                           WHERE m.login = ? AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?) ORDER BY m.id DESC LIMIT 1`, m.login, d.weekId, d.weekId);
  if (w.status === 'SUBMITTED') {
    const a = await one(db, 'SELECT mark_used FROM attendance WHERE login = ? AND week_id = ?', m.login, d.weekId), s = finalScores(w.sub, a?.mark_used);
    const wk = weekOf(s);
    // what they read and heard across the week, by title (the user, 12 Oct 2026): this list was only sent while the
    // week was being filled, so it vanished the moment the week was submitted — exactly when a facilitator reads it.
    // Only the names and minutes: the scores of a submitted week are the final ones in `scores`, never re-derived.
    const sm = b ? await weekSummary(db, wk.days, b.score_card) : null;
    return { weekId: d.weekId, status: 'SUBMITTED', submittedAt: s.submitted_at, daysFilled: s.days_filled ?? 7, ...wk, weekEnd: { nightStay: s.night_stay, principles: s.principles, chantingAverage: s.avg_rounds }, scores: pickScores(s),
             ...(sm ? { summary: { reading: sm.reading, hearing: sm.hearing } } : {}) };
  }
  if (w.status === 'MISSED') return { weekId: d.weekId, status: 'MISSED', daysFilled: w.missed.days_filled, overall: 0 };
  // a week still being filled: each day's state and, for a day with answers, its marks (the day report works before Submit)
  const days = COLS.map(c => (w.draft?.[c] ? JSON.parse(w.draft[c]) : null));
  return { weekId: d.weekId, status: w.status,
    days: days.map(x => ({ state: stateOf(x), ...(x && b ? { marks: dayMarks(b.score_card, x) } : {}) })),
    ...(b ? { summary: await weekSummary(db, days, b.score_card) } : {}) };
}
