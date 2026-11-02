// What coordinators approve: sign-ups and password resets (API contract §4).
// A coordinator sees and acts on their own batches only; the master on all, plus coordinators' resets.
import { CLASS_DAYS, addressView } from './contact.js';
import { createAppId } from './admin.js';
import { personForApproval, yearProblem } from './identity.js';
import { apiError, invalid, isoIst, ymd, validYmd, normPhone, normLogin, cleanName } from './util.js';
import { newTempPassword, hashPassword } from './crypto.js';
import { iterations } from './auth.js';
import { q, one, all, account, devoteeBatch, scopeBatches, audit, dirty, mondayOf, isStaffAccount } from './db.js';
import { isOffered } from './facilitators.js';
import { FAC_ID_OF } from './names.js';
import { endSessions } from './session.js';
import { registryRows, registryMatches, registrySearchRows, checkIyfId, linkedLogins } from './registry.js';

export async function requireBatch(ctx, batchId) {
  if (!(await scopeBatches(ctx.db, ctx)).includes(String(batchId))) throw apiError('FORBIDDEN', 'That batch is not yours.');
}

export async function list(d, ctx) {
  const db = ctx.db;
  let scope = await scopeBatches(db, ctx);
  if (d.batchId !== undefined) { await requireBatch(ctx, d.batchId); scope = [String(d.batchId)]; }
  const marks = scope.map(() => '?').join(',') || "''";
  // the chosen facilitator by id, named as they are now (Phase 24)
  const pending = (await all(db, `SELECT a.login, a.name, a.requested_batch, a.signed_up_at, COALESCE(rf."name", a.requested_facilitator) AS requested_facilitator, a.requested_class_day, a.email, a.whatsapp, p.dob, p.blood_group, p.emergency_name, p.emergency_relation, p.emergency_phone, p.addr_line, p.addr_area, p.addr_city, p.addr_state, p.addr_pin, p.addr_house, p.addr_street, p.addr_landmark,
                                        p.parent_name, p.parent_phone, p.parent_consent_at, p.privacy_consent_at
                                 FROM accounts a LEFT JOIN profiles p ON p.login = a.login LEFT JOIN facilitators rf ON rf.id = a.requested_fac_id
                                 WHERE a.role = 'DEVOTEE' AND a.status = 'PENDING' AND a.requested_batch IN (${marks})
                                 ORDER BY a.signed_up_at`, ...scope)).filter(a => a.login !== ctx.login);
  const rows = pending.length ? await registryRows(db) : [], linked = pending.length ? await linkedLogins(db) : {};
  const signUps = pending.map(a => ({
    phone: a.login, name: a.name, batchId: a.requested_batch, at: a.signed_up_at,
    facilitator: a.requested_facilitator || null, classDay: a.requested_class_day || null, email: a.email || '', whatsapp: a.whatsapp || '',
    profile: { dob: a.dob || '', bloodGroup: a.blood_group || '', emergency: { name: a.emergency_name || '', relation: a.emergency_relation || '', phone: a.emergency_phone || '' }, address: addressView(a) },
    // under 18 (8 Oct 2026): the parent or guardian who consented (null for adults); the privacy notice's time (null: older app)
    parentName: a.parent_name || null, parentPhone: a.parent_phone || null, parentConsentAt: a.parent_consent_at || null, privacyConsentAt: a.privacy_consent_at || null,
    matches: registryMatches(rows, a.login, a.name).map(m => ({ ...m, linked: !!linked[m.iyfId] }))
  }));

  const resets = [];
  for (const r of await all(db, `SELECT r.login, r.requested_at, a.name, a.role, a.is_master, a.requested_batch FROM reset_requests r JOIN accounts a ON a.login = r.login
                                 WHERE r.status = 'PENDING' ORDER BY r.requested_at`)) {
    const ok = r.login !== ctx.login && (r.role === 'DEVOTEE' && !(await isStaffAccount(db, r)) ? scope.includes(await devoteeBatch(db, r))
      : ctx.scopes.master && d.batchId === undefined);
    if (ok) resets.push({ login: r.login, name: r.name, role: r.role, at: r.requested_at });
  }
  return { signUps, resets };
}

/** The PENDING sign-up the caller may decide on. */
async function pendingSignUp(ctx, phoneIn) {
  const phone = normPhone(phoneIn), acct = phone ? await account(ctx.db, phone) : null;
  if (!acct || acct.role !== 'DEVOTEE') throw apiError('NOT_FOUND', 'That sign-up was not found.');
  if (acct.login === ctx.login) throw apiError('FORBIDDEN', 'You cannot approve your own sign-up.');
  await requireBatch(ctx, acct.requested_batch);
  if (acct.status !== 'PENDING') throw apiError('CONFLICT', 'That sign-up was already decided.');
  return acct;
}

export async function approve(d, ctx, req) {
  const db = ctx.db, acct = await pendingSignUp(ctx, d.phone);
  const levelEntry = d.levelEntryDate === undefined ? ymd(ctx.now()) : validYmd(d.levelEntryDate);
  if (!levelEntry) throw invalid({ path: 'levelEntryDate', message: 'Choose the date they joined this level.' });
  if (levelEntry > ymd(ctx.now())) throw invalid({ path: 'levelEntryDate', message: 'The level-entry date cannot be in the future.' });
  const link = d.link && typeof d.link === 'object' ? d.link : {};
  let iyfId = null;
  if (link.iyfId !== undefined) iyfId = String(link.iyfId).trim().toUpperCase();
  // Phase 9, item 14: the IYF head may create a new IYF ID (IYFD-<connected year>-NNNN) while approving; nobody else
  else if (link.createId === true) {
    if (!ctx.scopes.master) throw apiError('FORBIDDEN', 'Only the IYF head can create a new IYF ID.');
    // the head may give the year they connected, when the sign-up has none — checked before anything is written
    if (link.year !== undefined && link.year !== '') {
      const bad = yearProblem(link.year, isoIst(ctx.now()));
      if (bad) throw invalid({ path: 'link.year', message: bad });
    }
  }
  else if (link.noIdYet !== true) throw invalid({ path: 'link', message: 'Choose an IYF ID, or approve with no ID yet.' });
  if (iyfId) await checkIyfId(ctx, iyfId, acct.login);
  // decision 33: the coordinator confirms (or corrects) the facilitator (required) and the group leader (optional), from the lists
  // decision 33: the coordinator confirms (or corrects) the facilitator (required) from the list, and the class day.
  // The group leader is no longer used (the head, 3 Oct 2026); an older app may still send it and it is ignored.
  const facilitator = String(d.facilitator ?? acct.requested_facilitator ?? ''), classDay = String(d.classDay ?? acct.requested_class_day ?? '');
  const people = [];
  if (!(await isOffered(db, facilitator))) people.push({ path: 'facilitator', message: facilitator && facilitator === acct.requested_facilitator
    ? `${facilitator} is no longer on the facilitator list. Choose the facilitator from the list.` : 'Choose the facilitator from the list.' });
  if (!CLASS_DAYS.includes(classDay)) people.push({ path: 'classDay', message: 'Choose the class day: Sunday or Saturday.' });
  if (people.length) throw invalid(people);

  const now = isoIst(ctx.now()), batchId = acct.requested_batch;
  const since = (await one(db, 'SELECT connected_since FROM profiles WHERE login = ?', acct.login))?.connected_since || '';
  const person = await personForApproval(db, ctx, { login: acct.login, name: acct.name, iyfId: iyfId || '', connectedSince: since });
  try {
    const res = await db.batch([
      // only if still PENDING: two coordinators approving at once cannot both succeed
      q(db, "UPDATE accounts SET status = 'ACTIVE', iyf_id = ?, id_source = ?, decided_at = ?, decided_by = ?, updated_at = ?, updated_by = ? WHERE login = ? AND status = 'PENDING'",
        iyfId, iyfId ? 'COORDINATOR' : '', now, ctx.login, now, ctx.login, acct.login),
      q(db, `INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, set_by, set_at, reason, facilitator, class_day, fac_id)
             SELECT ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 'approved', ?, ?, ${FAC_ID_OF} WHERE changes() = 1`, acct.login, iyfId || '', batchId, mondayOf(ctx.now()), levelEntry, ctx.login, now, facilitator, classDay, facilitator),
      q(db, 'UPDATE profiles SET iyf_id = ?, updated_at = ?, updated_by = ? WHERE login = ? AND changes() = 1', iyfId || '', now, ctx.login, acct.login),
      audit(db, ctx, 'requests.approve', acct.login, batchId, { status: 'PENDING' }, { status: 'ACTIVE', iyf_id: iyfId || '', facilitator, classDay }, '', req.requestId),
      dirty(db, 'accounts', 'memberships', 'profiles', 'audit_log'),
      /* The person, in the identity tables (16 Oct 2026; roadmap 3.8).
         Approving used to stamp an IYF ID on the account and stop there, so the devotee existed on the
         Batch board and nowhere in `persons` — the head could read the ID and could not trace the person
         behind it. The IYF ID is how a devotee is identified, so creating the person is part of approving
         them, in the SAME batch: the person and the membership either both land or neither does.
         personForApproval reuses an existing person whenever phone, ID or name already matches (the
         dashboard's 1,345 people are in there), so this never makes a second copy of someone. */
      ...person.stmts
    ]);
    if (!res[0].meta.changes) throw apiError('CONFLICT', 'That sign-up was already decided.');
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw apiError('CONFLICT', `${iyfId} already belongs to another account.`);
    throw e;
  }
  // An IYF ID carries the year they came to IYF. Asked to create one for somebody with no year on record,
  // the approval still stands — they are approved — and the ID waits until the year is known, rather than
  // being minted under today's date (18 Oct 2026).
  let needsYear = false;
  if (link.createId === true) {
    try { iyfId = await createAppId(ctx, { ...acct, status: 'ACTIVE' }, batchId, 'created at approval', req.requestId, String(link.year || '')); }
    catch (e) { if (e?.code === 'VALIDATION' && (e.details?.fields || e.fields || []).some((f) => f.path === 'year')) { needsYear = true; iyfId = ''; } else throw e; }
  }
  return { iyfId, linked: !!iyfId, ...(link.createId === true ? { created: !!iyfId, needsYear } : {}) };
}

export async function reject(d, ctx, req) {
  const db = ctx.db, reason = cleanName(d.reason);
  if (reason.length < 2 || reason.length > 200) throw invalid({ path: 'reason', message: 'Give a short reason.' });
  const acct = await pendingSignUp(ctx, d.phone), now = isoIst(ctx.now());
  const res = await db.batch([
    q(db, "UPDATE accounts SET status = 'REJECTED', reject_reason = ?, decided_at = ?, decided_by = ?, updated_at = ?, updated_by = ? WHERE login = ? AND status = 'PENDING'",
      reason, now, ctx.login, now, ctx.login, acct.login),
    audit(db, ctx, 'requests.reject', acct.login, acct.requested_batch, { status: 'PENDING' }, { status: 'REJECTED' }, reason, req.requestId),
    dirty(db, 'accounts', 'audit_log')
  ]);
  if (!res[0].meta.changes) throw apiError('CONFLICT', 'That sign-up was already decided.');
  return {};
}

/** The account and its PENDING reset request, if the caller may decide it. */
async function pendingReset(ctx, loginIn) {
  const id = normLogin(loginIn), acct = id ? await account(ctx.db, id) : null;
  if (!acct) throw apiError('NOT_FOUND', 'That request was not found.');
  if (acct.login === ctx.login) throw apiError('FORBIDDEN', 'Someone else must approve your own reset.');
  // a coordinator (of any batch) or the IYF head: only a master decides their reset (security review, 3 Oct 2026)
  if (acct.role !== 'DEVOTEE' || await isStaffAccount(ctx.db, acct)) { if (!ctx.scopes.master) throw apiError('FORBIDDEN', 'Only a master can decide this request.'); }
  else await requireBatch(ctx, await devoteeBatch(ctx.db, acct));
  const req = await one(ctx.db, "SELECT * FROM reset_requests WHERE login = ? AND status = 'PENDING' ORDER BY id DESC LIMIT 1", id);
  if (!req) throw apiError('NOT_FOUND', 'There is no open reset request for this account.');
  return { acct, req };
}

/** How long a temporary password works for. Decision 46: long enough to hand over today, not long enough
 *  for an approval nobody collected to be useful next week. */
export const TEMP_PW_HOURS = 24;

/**
 * Approving a reset — decision 46 (the head, 14 Oct 2026), audit finding F1.
 *
 * THE SERVER makes the password here. It used to apply the hash the REQUESTER supplied at request time,
 * which is what let anyone who knew a phone number choose a password for an account they did not own.
 *
 * The password is returned ONCE, in this response, and nowhere else:
 *   · only its hash is stored, so no later request can read it back
 *   · there is no "show it again" action, by the head's explicit decision — a coordinator who loses it
 *     before handing it over asks the devotee to send a fresh request, and approves that
 *   · `must_change_pw` forces a change at first sign-in, so even an overheard password is good for one
 *     sign-in at most
 *   · every session on the account ends, as before
 *   · the devotee's phones get a notification saying a reset was approved and to collect the password from
 *     their coordinator — never the password itself (push.js; decision 15 still bars sending it anywhere)
 *
 * An older app calling this still works: it ignores the extra fields in the response, and the coordinator
 * using it sees nothing to hand over, which is why the app must be released together with this.
 */
export async function resetApprove(d, ctx, request) {
  const db = ctx.db, { acct, req } = await pendingReset(ctx, d.login), now = isoIst(ctx.now());
  const tempPassword = newTempPassword();
  const h = await hashPassword(tempPassword, await iterations(db), ctx.env.PW_PEPPER);
  const expires = isoIst(new Date(ctx.now().getTime() + TEMP_PW_HOURS * 3600000));
  const res = await db.batch([
    q(db, "UPDATE reset_requests SET status = 'APPROVED', decided_by = ?, decided_at = ?, pw_source = 'SERVER', temp_expires_at = ?, new_pw_hash = '', new_pw_salt = '', new_pw_iterations = 0 WHERE id = ? AND status = 'PENDING'",
      ctx.login, now, expires, req.id),
    // must_change_pw = 1: the temporary password gets them in and no further. changes() = 1 ties this to the
    // row above, so two coordinators approving at the same moment cannot both set a password.
    q(db, "UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iterations = ?, must_change_pw = 1, failed_tries = 0, locked_until = '', updated_at = ?, updated_by = ? WHERE login = ? AND changes() = 1",
      h.pw_hash, h.pw_salt, h.pw_iterations, now, ctx.login, acct.login),
    endSessions(ctx, acct.login, 'reset'),
    audit(db, ctx, 'resets.approve', acct.login, acct.role === 'DEVOTEE' ? await devoteeBatch(db, acct) : '', null, null, '', request.requestId),
    dirty(db, 'accounts', 'reset_requests', 'audit_log')
  ]);
  if (!res[0].meta.changes) throw apiError('NOT_FOUND', 'There is no open reset request for this account.');
  // the password is in the response and in no table: this is the only moment it exists in readable form
  return { tempPassword, expiresAt: expires, expiresInHours: TEMP_PW_HOURS, name: acct.name || '', login: acct.login,
           whatsapp: acct.whatsapp || '', shownOnce: true };
}

export async function resetReject(d, ctx, request) {
  const db = ctx.db, { acct, req } = await pendingReset(ctx, d.login);
  await db.batch([
    q(db, "UPDATE reset_requests SET status = 'REJECTED', decided_by = ?, decided_at = ? WHERE id = ?", ctx.login, isoIst(ctx.now()), req.id),
    audit(db, ctx, 'resets.reject', acct.login, '', null, null, '', request.requestId),
    dirty(db, 'reset_requests', 'audit_log')
  ]);
  return {};
}

export async function registrySearch(d, ctx) {
  const linked = await linkedLogins(ctx.db);
  return { results: registrySearchRows(await registryRows(ctx.db), d.q).map(r => ({ ...r, linked: !!linked[r.iyfId] })) };
}
