// Sign-up, login, logout, password change and reset requests (API contract §1, §2).
import { withAccess } from './grants.js';
import { apiError, invalid, isoIst, ymd, parseIso, clockIst, ageOn, validYmd, normPhone, normLogin, cleanName, validName, passwordProblem, mondayOf } from './util.js';
import { hashPassword, verifyPassword, dummyVerify } from './crypto.js';
import { q, one, all, run, setting, account, scopesOf, audit, dirty, batchesAll } from './db.js';
import { isOffered } from './facilitators.js';
import { FAC_ID_OF } from './names.js';
import { newSession, endSessions, endSession } from './session.js';
import { comeBackStatements } from './inactive.js';
import { CLASS_DAYS, normEmail, emailProblem, normWhatsapp, checkAddress } from './contact.js';
import { SKILLS } from '../../shared/skills.js';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't know"];
export const SIGNUPS_PER_HOUR = 1000, RESETS_PER_DAY = 3;
// IYF, 8 Oct 2026: sign-up from age 15. Under the DPDP Act 2023 anyone under 18 is a child, so their sign-up needs a
// parent's or guardian's consent (their name and phone are kept with the profile). Members who joined younger keep their
// accounts: profile.update still accepts 12–80 (coord.js).
export const SIGNUP_MIN_AGE = 15, ADULT_AGE = 18;
// Per network (the caller's IP, as Cloudflare sees it). Generous: a class on one Wi-Fi shares an address.
export const PER_IP = { login: [200, 600], signUp: [100, 3600], reset: [30, 3600], lookup: [60, 600] };   // [attempts, seconds]

export async function iterations(db) {
  const n = parseInt(await setting(db, 'pbkdf2_iterations', ''), 10);
  return n >= 1000 ? Math.min(n, 100000) : 10000;            // Cloudflare allows at most 100,000
}

/** Counts one attempt (in a single atomic step); true when it goes over the limit. */
export async function overLimit(ctx, key, limit, seconds) {
  const now = ctx.now().getTime();
  const r = await one(ctx.db, `INSERT INTO counters (key, n, expires) VALUES (?, 1, ?)
                               ON CONFLICT(key) DO UPDATE SET n = CASE WHEN expires > ? THEN n + 1 ELSE 1 END,
                                                            expires = CASE WHEN expires > ? THEN expires ELSE excluded.expires END
                               RETURNING n`, key, now + seconds * 1000, now, now);
  return r.n > limit;
}
async function ipLimit(ctx, what) {
  if (!ctx.ip) return;
  const [n, sec] = PER_IP[what];
  if (await overLimit(ctx, `ip:${what}:${ctx.ip}`, n, sec)) throw apiError('BUSY', 'Too many attempts from this network. Please wait a few minutes and try again.');
}

/**
 * Sign-up step 1: ask for the phone, then tell them only that we recognise them.
 *
 * A devotee who has been with IYF Delhi for years is already in `persons` (imported from the two
 * Facilitation Journals, 11 Oct 2026), and we do not want them retyping it. But this endpoint is
 * PUBLIC and there is no OTP, so whoever types a number is not yet known to be its owner.
 *
 * So it returns a MASKED name and nothing else (the user, 11 Oct 2026): enough that the real person
 * recognises themselves and knows their history is waiting, useless to someone who typed a number
 * that is not theirs. The record itself — facilitator, level, profession, education, area — is
 * matched server-side at sign-up and applied when a coordinator approves, never shown here.
 *
 * `found: false` has the same shape as a hit, so the endpoint is not a way to learn who is in the
 * records; the per-network limit caps volume on top of that.
 */
export const maskName = (name) => String(name || '').trim().split(/\s+/)
  .map(w => w.length <= 1 ? w : w[0] + '•'.repeat(Math.min(w.length - 1, 4)))
  .join(' ');

export async function lookup(d, ctx) {
  const db = ctx.db, phone = normPhone(d.phone);
  if (!phone) throw invalid({ path: 'phone', message: 'Enter the 10-digit mobile number.' });
  await ipLimit(ctx, 'lookup');

  // already has an account: send them to sign-in, never a second account for one number
  if (await one(db, 'SELECT login FROM accounts WHERE login = ?', phone)) return { found: false, hasAccount: true };

  const ph = await one(db, 'SELECT person_id FROM person_phones WHERE phone = ? AND active = 1', phone);
  if (!ph) return { found: false, hasAccount: false };
  const per = await one(db, "SELECT display_name, iyf_id FROM persons WHERE id = ? AND merged_into = ''", ph.person_id);
  if (!per) return { found: false, hasAccount: false };

  return {
    found: true,
    hasAccount: false,
    maskedName: maskName(per.display_name),
    // the year is in their IYF ID and can never be renumbered, so the form shows it read-only
    connectedSinceLocked: !!per.iyf_id
  };
}

export async function signUp(d, ctx) {
  const db = ctx.db, problems = [];
  const phone = normPhone(d.phone);
  if (!phone) problems.push({ path: 'phone', message: 'Enter a 10-digit mobile number.' });
  const name = cleanName(d.name);
  if (!validName(name)) problems.push({ path: 'name', message: 'Enter your name (letters and spaces).' });
  const batch = await one(db, 'SELECT * FROM batches WHERE batch_id = ? AND active = 1', String(d.batchId ?? ''));
  if (!batch) problems.push({ path: 'batchId', message: 'Choose your batch.' });
  const pw = passwordProblem(d.password, phone);
  if (pw) problems.push({ path: 'password', message: pw });
  // decision 33: the facilitator comes from the list, never typed. The group leader is no longer asked for (the head,
  // 3 Oct 2026); an older app may still send it, and it is ignored.
  // only names the master has switched on are offered (and accepted)
  if (!(await isOffered(db, d.facilitator))) problems.push({ path: 'facilitator', message: 'Choose your facilitator from the list.' });
  // one class a week across all batches, on Sunday or Saturday
  if (!CLASS_DAYS.includes(d.classDay)) problems.push({ path: 'classDay', message: 'Choose your class day: Sunday or Saturday.' });
  const email = normEmail(d.email);
  if (!email) problems.push({ path: 'email', message: 'Enter a valid email address.' });
  const whatsapp = normWhatsapp(d.whatsapp);
  if (whatsapp === null) problems.push({ path: 'whatsapp', message: 'Enter a 10-digit WhatsApp number, or leave it empty.' });
  const p = d.profile && typeof d.profile === 'object' && !Array.isArray(d.profile) ? d.profile : {};
  for (const k of Object.keys(p)) if (!['dob', 'bloodGroup', 'emergency', 'address', 'profession', 'skills', 'connectedSince'].includes(k)) throw apiError('BAD_REQUEST', 'Unknown field profile.' + k);
  // About you (the user, 10 Oct 2026): profession and skills OPTIONAL — an empty answer is never a reason to refuse a sign-up.
  const profession = cleanName(p.profession).slice(0, 80);
  const connectedSince = String(p.connectedSince ?? '').trim();
  if (profession.length > 80) problems.push({ path: 'profile.profession', message: 'At most 80 characters.' });
  // Service skills: chosen from the fixed list (the user, 11 Oct 2026), never typed — a coordinator must be able to
  // ask "who can lead kirtan?", and free text cannot be searched. Stored as a JSON array in profiles.skills.
  let skills = [];
  if (p.skills !== undefined && p.skills !== null && p.skills !== '') {
    if (!Array.isArray(p.skills)) problems.push({ path: 'profile.skills', message: 'Choose your skills from the list.' });
    else if (p.skills.length > SKILLS.length) problems.push({ path: 'profile.skills', message: 'Too many chosen.' });
    else if (p.skills.some((x) => !SKILLS.includes(x))) problems.push({ path: 'profile.skills', message: 'Choose your skills from the list.' });
    else skills = [...new Set(p.skills)];
  }
  // "With IYF Delhi since" is REQUIRED at sign-up (the user, 11 Oct 2026: profession and hobbies optional, "connected
  // since" not), and it is a YEAR only — the IYF ID carries it (IYFD-2019-0044) and the identity import holds years;
  // someone new chooses this year. An older copy of the app still open on a phone sends no such key at all: its
  // sign-up is taken as before rather than refused with an error that screen cannot show.
  if ('connectedSince' in p) {
    const thisYear = new Date(Date.now() + 5.5 * 3600e3).getUTCFullYear();
    if (!/^\d{4}$/.test(connectedSince) || +connectedSince < 1980) problems.push({ path: 'profile.connectedSince', message: 'Choose the year you first came to IYF Delhi (this year if you are new).' });
    else if (+connectedSince > thisYear) problems.push({ path: 'profile.connectedSince', message: 'That year has not come yet.' });
  }
  const dob = validYmd(p.dob);
  if (!dob) problems.push({ path: 'profile.dob', message: 'Enter your date of birth.' });
  const age = dob ? ageOn(dob, ctx.now()) : null;
  if (dob && age < SIGNUP_MIN_AGE) problems.push({ path: 'profile.dob', message: `Sign-up is open from age ${SIGNUP_MIN_AGE}.` });
  else if (dob && age > 80) problems.push({ path: 'profile.dob', message: 'Check your date of birth.' });
  // under 18: the parent's or guardian's name and phone (not the applicant's own); asked of nobody else, and ignored if sent
  let parent = null;
  const child = !!dob && age >= SIGNUP_MIN_AGE && age < ADULT_AGE;
  if (child && (d.parentConsent === undefined || d.parentConsent === null)) {
    // not sent at all (an older app has no such fields): one clear message
    problems.push({ path: 'parentConsent', message: "You are under 18: your parent's or guardian's name and mobile number are needed to sign up." });
  } else if (child) {
    const pc = d.parentConsent && typeof d.parentConsent === 'object' && !Array.isArray(d.parentConsent) ? d.parentConsent : {};
    for (const k of Object.keys(pc)) if (!['name', 'phone'].includes(k)) throw apiError('BAD_REQUEST', 'Unknown field parentConsent.' + k);
    parent = { name: cleanName(pc.name), phone: normPhone(pc.phone) };
    if (!validName(parent.name)) problems.push({ path: 'parentConsent.name', message: "Enter your parent's or guardian's name." });
    if (!parent.phone) problems.push({ path: 'parentConsent.phone', message: "Enter your parent's or guardian's 10-digit mobile number." });
    else if (parent.phone === phone) problems.push({ path: 'parentConsent.phone', message: "Use your parent's or guardian's number, not your own." });
  }
  // the privacy notice: newer apps send true (its time is kept); older apps send nothing and still sign up
  if (d.privacyConsent !== undefined && d.privacyConsent !== true) problems.push({ path: 'privacyConsent', message: 'Please agree to the privacy notice to sign up.' });
  if (!BLOOD_GROUPS.includes(p.bloodGroup)) problems.push({ path: 'profile.bloodGroup', message: 'Choose your blood group (or "Don\'t know").' });
  const em = p.emergency && typeof p.emergency === 'object' ? p.emergency : {};
  const emName = cleanName(em.name), emRel = cleanName(em.relation), emPhone = normPhone(em.phone);
  if (!validName(emName)) problems.push({ path: 'profile.emergency.name', message: "Enter the emergency contact's name." });
  if (!emRel || emRel.length > 30) problems.push({ path: 'profile.emergency.relation', message: 'Enter how they are related to you.' });
  if (!emPhone) problems.push({ path: 'profile.emergency.phone', message: 'Enter their 10-digit mobile number.' });
  else if (emPhone === phone) problems.push({ path: 'profile.emergency.phone', message: "Use someone else's number, not your own." });
  // the address is asked of everyone signing up from 3 Oct 2026; earlier devotees add it in Account
  const addr = checkAddress(p.address, 'profile.address');
  problems.push(...addr.problems);
  if (problems.length) throw invalid(problems);
  // the per-network limit before the email check: that check asks an outside DNS service (security review, 3 Oct 2026)
  await ipLimit(ctx, 'signUp');
  const emailMsg = await emailProblem(email);
  if (emailMsg) throw invalid({ path: 'email', message: emailMsg });

  if (await overLimit(ctx, 'signups:' + isoIst(ctx.now()).slice(0, 13), SIGNUPS_PER_HOUR, 3700)) {
    throw apiError('BUSY', 'Many people are signing up right now. Please try again in an hour.');
  }
  const h = await hashPassword(d.password, await iterations(db), ctx.env.PW_PEPPER);
  const now = isoIst(ctx.now());
  try {
    await db.batch([
      // the chosen facilitator's name and its id (Phase 24): the id is what follows a rename while they wait
      q(db, `INSERT INTO accounts (login, role, status, name, phone, requested_batch, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by, requested_facilitator,
             email, whatsapp, requested_class_day, requested_fac_id) VALUES (?, 'DEVOTEE', 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${FAC_ID_OF})`, phone, name, phone, batch.batch_id, h.pw_hash, h.pw_salt, h.pw_iterations, now, now, phone,
        String(d.facilitator), email, whatsapp, d.classDay, String(d.facilitator)),
      q(db, `INSERT INTO profiles (login, name, dob, blood_group, emergency_name, emergency_relation, emergency_phone, addr_line, addr_area, addr_city, addr_state, addr_pin, updated_at, updated_by,
             parent_name, parent_phone, parent_consent_at, privacy_consent_at, addr_house, addr_street, addr_landmark,
             profession, skills, connected_since)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, phone, name, dob, p.bloodGroup, emName, emRel, emPhone,
        addr.value.addr_line, addr.value.addr_area, addr.value.addr_city, addr.value.addr_state, addr.value.addr_pin, now, phone,
        parent?.name || '', parent?.phone || '', parent ? now : '', d.privacyConsent === true ? now : '', addr.value.addr_house, addr.value.addr_street, addr.value.addr_landmark,
        profession, JSON.stringify(skills), connectedSince),
      dirty(db, 'accounts', 'profiles')
    ]);
  } catch (e) {
    if (/UNIQUE|PRIMARY KEY/i.test(String(e.message))) throw apiError('CONFLICT', 'This number already has an account. Log in, or use Forgot password.');
    throw e;
  }
  return { status: 'PENDING' };
}

export async function login(d, ctx) {
  const db = ctx.db, pepper = ctx.env.PW_PEPPER, n = await iterations(db);
  const id = normLogin(d.login), pw = typeof d.password === 'string' ? d.password : '';
  const bad = () => apiError('BAD_CREDENTIALS', 'Phone or password is wrong.');
  await ipLimit(ctx, 'login');
  if (!id || !pw || pw.length > 256) { await dummyVerify(pw || 'x', n, pepper); throw bad(); }
  const acct = await account(db, id);
  if (!acct) { await dummyVerify(pw, n, pepper); throw bad(); }

  const now = ctx.now(), lockedUntil = parseIso(acct.locked_until);
  if (lockedUntil && lockedUntil > now) {
    throw apiError('LOCKED_OUT', `Too many wrong tries. Try again after ${clockIst(lockedUntil)}.`, { data: { until: isoIst(lockedUntil) } });
  }
  if (!(await verifyPassword(pw, acct, pepper))) {
    // one atomic step, so wrong passwords sent at the same moment are all counted
    const { failed_tries: tries } = await one(db, 'UPDATE accounts SET failed_tries = failed_tries + 1 WHERE login = ? RETURNING failed_tries', acct.login);
    const max = Number(await setting(db, 'lockout_tries', '5')) || 5;
    if (tries >= max) {
      const until = new Date(now.getTime() + (Number(await setting(db, 'lockout_minutes', '15')) || 15) * 60000);
      await run(db, 'UPDATE accounts SET failed_tries = 0, locked_until = ?, updated_at = ?, updated_by = ? WHERE login = ?', isoIst(until), isoIst(now), 'SYSTEM', acct.login);
      throw apiError('LOCKED_OUT', `Too many wrong tries. Try again after ${clockIst(until)}.`, { data: { until: isoIst(until) } });
    }
    throw bad();
  }
  /* Decision 46: a temporary password from an approved reset stops working after TEMP_PW_HOURS. Checked
     here, AFTER the password matched, so an expired one is never revealed by a different answer to someone
     guessing. `must_change_pw` is the marker that this is still a temporary password: once the person
     changes it the flag clears and this check no longer applies. */
  if (acct.must_change_pw) {
    const exp = await one(db, `SELECT temp_expires_at FROM reset_requests
                                WHERE login = ? AND status = 'APPROVED' AND temp_expires_at <> ''
                                ORDER BY id DESC LIMIT 1`, acct.login);
    if (exp && parseIso(exp.temp_expires_at) && parseIso(exp.temp_expires_at) <= now) {
      throw apiError('RESET_EXPIRED', 'That temporary password has expired. Tap "I forgot my password" again and your coordinator will give you a new one.');
    }
  }
  // the password is right: only now say anything about the account's state
  if (acct.status === 'PENDING') throw apiError('PENDING_APPROVAL', "Your sign-up is waiting for your coordinator's approval.", { details: await signUpDetails(db, acct) });
  if (acct.status === 'REJECTED') throw apiError('REJECTED', `Your sign-up was not approved${acct.reject_reason ? ': ' + acct.reject_reason : '.'} Please speak to your coordinator.`,
    { details: { ...await signUpDetails(db, acct), reason: acct.reject_reason || null, decidedAt: acct.decided_at || null } });
  if (acct.status === 'DISABLED') throw apiError('ACCOUNT_DISABLED', 'This account is switched off. Please speak to your coordinator.');
  // an INACTIVE account (Phase 22 I2): only a person who left a closed intake (closing.js) or one left so by the old rule —
  // marking someone inactive now keeps their login (devotees.setActive / inactive.js change the membership only)
  if (acct.status === 'INACTIVE') throw apiError('ACCOUNT_DISABLED', 'This login is not in use now. Please speak to your coordinator.');
  if (acct.status !== 'ACTIVE') throw bad();

  const s = await newSession(ctx, acct, d.device);
  const stmts = [s.stmt];
  if ((acct.pw_iterations || 0) < n) {                 // a stronger setting since this hash was made
    const h = await hashPassword(pw, n, pepper);
    stmts.push(q(db, 'UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iterations = ? WHERE login = ?', h.pw_hash, h.pw_salt, h.pw_iterations, acct.login));
  }
  stmts.push(q(db, "UPDATE accounts SET failed_tries = 0, locked_until = '', last_login_at = ? WHERE login = ?", isoIst(now), acct.login), dirty(db, 'accounts'));
  /* Decision 46 / roadmap 1.1: the real owner signing in CANCELS any reset request waiting on their account.
     Whoever asked for it did not need it — this person knows their password. It also closes the window in
     which an impostor's request sits in a coordinator's queue looking legitimate. Cheap: one indexed UPDATE
     (idx_reset_login_status, migration 0048) in the batch that was already being sent. */
  stmts.push(q(db, "UPDATE reset_requests SET status = 'SUPERSEDED', decided_at = ?, decided_by = 'SYSTEM' WHERE login = ? AND status = 'PENDING'", isoIst(now), acct.login),
             dirty(db, 'reset_requests'));
  // signing in brings back someone the APP made inactive (ADR 0020; never a coordinator's "Mark inactive"): the flag is
  // on the account row read above, so this adds statements to the batch already being sent, and only for them
  if (acct.auto_inactive) stmts.push(...comeBackStatements(db, { login: acct.login, role: acct.role }, { login: acct.login, from: mondayOf(now), how: 'APP', at: isoIst(now) }));
  await db.batch(stmts);
  return { token: s.token, expiresAt: s.expiresAt, user: await userInfo(ctx, acct) };
}

/** What the pending (or rejected) sign-up page shows; sent only after the password was checked. */
async function signUpDetails(db, acct) {
  const b = (await batchesAll(db)).find(x => x.batch_id === acct.requested_batch);
  return { firstName: String(acct.name || '').split(' ')[0], batchName: b?.name || acct.requested_batch || null,
           facilitatorName: acct.requested_facilitator || null, requestedAt: acct.signed_up_at || null };
}

/**
 * The user object every login and auth.me returns.
 *
 * `known` is the caller's already-computed scopes (17 Oct 2026). sessionCtx works them out for every
 * authenticated call, and auth.me asked for them a SECOND time here — the same three reads, and
 * `SELECT batch_id FROM leaders` twice in one call. Passing them in is the whole fix; a caller that has
 * none (auth.login, where the session is being created) still gets them read here, unchanged.
 */
// `photoRow`: the photos row already read by the caller (home.get batches it with its other reads, 22 Oct 2026);
// undefined → read it here, exactly as before. null is a real answer (no photo) and is used as given.
export async function userInfo(ctx, a, known, photoRow) {
  const scopes = known || await scopesOf(ctx.db, a);
  // asked without the call's scopes (sign-in): the same end dates and rights the gate applies (ADR 0019)
  if (!known) withAccess({ now: ctx.now, acct: a, scopes });
  // a master's batchIds are every batch — already in the per-call memo, so this is no extra query (db.js batchesAll)
  const staff = scopes.master ? (await batchesAll(ctx.db)).map(b => b.batch_id) : scopes.coordinator;
  // photoAt: when the person's own photo was last set (null: none), so the app shows it in the menu and caches it by version
  const photo = photoRow !== undefined ? photoRow : await one(ctx.db, 'SELECT updated_at FROM photos WHERE login = ?', a.login);
  return { login: a.login, role: a.role, name: a.name, iyfId: a.iyf_id || null, scopes, photoAt: photo?.updated_at || null,
           batchIds: staff.length ? staff : scopes.devotee ? [scopes.devotee.batchId] : [], mustChangePassword: !!a.must_change_pw,
           // one id system (the head, 22 Oct 2026): a devotee without an IYFD is asked for their year at the next open,
           // and answering issues it. Read from the account row already in hand — no extra query.
           needsYear: a.role === 'DEVOTEE' && !/^IYFD-/.test(a.iyf_id || '') };
}

export async function me(d, ctx) {
  return { user: await userInfo(ctx, ctx.acct, ctx.scopes),
           // names: see weeks.js homeGet — the phone refetches its lists only when this moved (Phase 24)
           versions: { rules: await setting(ctx.db, 'rules_version', 'r0'), journals: await setting(ctx.db, 'journals_version', 'j0'), names: await setting(ctx.db, 'names_version', '1') },
           today: ymd(ctx.now()), openWeeks: [] };
}

export async function logout(d, ctx) { await endSession(ctx, ctx.sessionHash, 'logout'); return {}; }

/**
 * Sign out everywhere (13 Oct 2026, audit F21 / roadmap 3.10). A person who used a shared or lost phone could
 * only end THIS device's session; the other sessions stayed valid for 30 days unless they changed their password.
 * This ends every session of the login, including the one making the call, and says how many devices were signed
 * out so the app can tell them. Audited, because "someone ended all my sessions" should be answerable.
 */
export async function logoutAll(d, ctx, req) {
  const db = ctx.db;
  const open = (await one(db, "SELECT COUNT(*) AS n FROM sessions WHERE login = ? AND ended_at = ''", ctx.login))?.n || 0;
  await db.batch([
    endSessions(ctx, ctx.login, 'logout all'),                   // every other device
    q(db, "UPDATE sessions SET ended_at = ?, end_reason = 'logout all' WHERE token_hash = ?", isoIst(ctx.now()), ctx.sessionHash),
    audit(db, ctx, 'auth.logoutAll', ctx.login, '', null, { devices: open }, '', req.requestId)
  ]);
  return { devices: open };
}

/**
 * The devices this account is signed in on (the head, 18 Oct 2026).
 *
 * One account may be signed in in several places — a coordinator marks attendance on their phone at
 * class and exports from a laptop afterwards, and forcing one session would log them out each time
 * they moved. What was missing is being able to SEE where, and to end one without ending them all:
 * "if I am logged in at phone, I can make someone using my ID on the laptop to get logged out".
 *
 * Only ever the caller's own sessions. The token itself is never stored or returned — each row is
 * identified by a short prefix of its hash, which is enough to end it and reveals nothing.
 */
export async function sessionsList(d, ctx) {
  const rows = await all(ctx.db, `SELECT token_hash, device, created_at, last_used_at, expires_at
                                    FROM sessions WHERE login = ? AND ended_at = ''
                                   ORDER BY last_used_at DESC LIMIT 50`, ctx.login);
  return { devices: rows.map(r => ({
    id: String(r.token_hash).slice(0, 16),
    device: r.device || 'Unknown device',
    thisOne: r.token_hash === ctx.sessionHash,
    signedInAt: r.created_at, lastUsedAt: r.last_used_at, expiresAt: r.expires_at })) };
}

/** End ONE of the caller's own sessions — the laptop they left signed in, from the phone in hand. */
export async function sessionsEnd(d, ctx, req) {
  const db = ctx.db, id = String(d.id || '');
  if (!/^[0-9a-f]{16}$/.test(id)) throw invalid({ path: 'id', message: 'Choose a device.' });
  const row = await one(db, `SELECT token_hash, device FROM sessions
                              WHERE login = ? AND ended_at = '' AND substr(token_hash, 1, 16) = ?`, ctx.login, id);
  if (!row) throw apiError('NOT_FOUND', 'That device is already signed out.');
  // ending the one you are holding is a plain log-out, and is allowed: it is still your session
  await db.batch([
    q(db, "UPDATE sessions SET ended_at = ?, end_reason = 'signed out from another device' WHERE token_hash = ?",
      isoIst(ctx.now()), row.token_hash),
    audit(db, ctx, 'auth.sessionEnd', ctx.login, '', null, { device: row.device }, '', req.requestId)]);
  return { ended: true, thisOne: row.token_hash === ctx.sessionHash };
}

export async function changePassword(d, ctx, req) {
  const db = ctx.db, pepper = ctx.env.PW_PEPPER;
  if (typeof d.current !== 'string' || !(await verifyPassword(d.current, ctx.acct, pepper))) throw apiError('BAD_CREDENTIALS', 'Your current password is wrong.');
  const problem = passwordProblem(d.new, ctx.login);
  if (problem) throw invalid({ path: 'new', message: problem });
  if (d.new === d.current) throw invalid({ path: 'new', message: 'Choose a password different from the current one.' });
  const h = await hashPassword(d.new, await iterations(db), pepper);
  await db.batch([
    q(db, 'UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iterations = ?, must_change_pw = 0, updated_at = ?, updated_by = ? WHERE login = ?',
      h.pw_hash, h.pw_salt, h.pw_iterations, isoIst(ctx.now()), ctx.login, ctx.login),
    endSessions(ctx, ctx.login, 'password change', ctx.sessionHash),
    audit(db, ctx, 'auth.changePassword', ctx.login, '', null, null, '', req.requestId),
    dirty(db, 'accounts', 'audit_log')
  ]);
  return {};
}

/**
 * "I forgot my password" — decision 46 (the head, 14 Oct 2026), audit finding F1.
 *
 * The request carries THE PHONE NUMBER ONLY. It used to carry the new password as well, which meant anyone
 * who knew a devotee's number could queue a password of their own choosing against that account and wait for
 * a coordinator to approve it. The server now generates the password at approval instead (requests.js
 * resetApprove), so there is nothing here for an impostor to choose.
 *
 * Always the same answer, so nobody can find out which numbers have accounts. An older app that still sends
 * `newPassword` gets the same answer too: the field is no longer in the route's whitelist, so it never
 * arrives, and such an app's user simply finds that the password they typed does not work — they are told
 * to collect the temporary one from their coordinator, which is the new flow.
 */
export async function requestReset(d, ctx) {
  const db = ctx.db, id = normLogin(d.login);
  await ipLimit(ctx, 'reset');
  const done = { status: 'RESET_REQUESTED' };
  if (!id) return done;
  if (await overLimit(ctx, 'resets:' + id + ':' + ymd(ctx.now()), RESETS_PER_DAY, 90000)) return done;
  const acct = await account(db, id);
  if (!acct || !['ACTIVE', 'INACTIVE', 'DISABLED'].includes(acct.status) || acct.login === 'master') return done;   // the recovery login uses the MASTER_RESET_PASSWORD secret
  const now = isoIst(ctx.now());
  await db.batch([
    q(db, "UPDATE reset_requests SET status = 'SUPERSEDED', decided_at = ?, decided_by = 'SYSTEM' WHERE login = ? AND status = 'PENDING'", now, id),
    // the three password columns stay NOT NULL for the old rows' sake (migration 0048) and are written blank:
    // there is no password at request time any more
    q(db, `INSERT INTO reset_requests (login, requested_at, new_pw_hash, new_pw_salt, new_pw_iterations, status, pw_source)
           VALUES (?, ?, '', '', 0, 'PENDING', 'SERVER')`, id, now),
    dirty(db, 'reset_requests')
  ]);
  return done;
}
