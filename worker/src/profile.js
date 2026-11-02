// A person's own profile and photo: what they may change about themselves, and the picture staff see next to
// their name. Split out of coord.js on 13 October 2026 (audit F27 / roadmap 3.1); the code is unchanged, only its
// home. The JPEG checking itself is shared with the wall in image.js.
import { apiError, invalid, isoIst, ymd, validYmd, ageOn, cleanName, validName, normPhone } from './util.js';
import { q, one, all, account, currentMembership, audit, dirty } from './db.js';
import { trainingsOf } from './phases.js';
import { reasonOf, managed, readSkills } from './staff.js';
import { resolve, issueForAccount, yearProblem } from './identity.js';
import { BLOOD_GROUPS } from './auth.js';
import { isOffered } from './facilitators.js';
import { CLASS_DAYS, normEmail, emailProblem, normWhatsapp, checkAddress, addressView } from './contact.js';
import { checkJpeg } from './image.js';
import { renamePerson, FAC_ID_OF } from './names.js';


/* ------------------------------------------------------------------------ */
/* Own profile and photo                                                      */
/* ------------------------------------------------------------------------ */

/** Consent given at sign-up (8 Oct 2026): a parent's or guardian's for an under-18 (null for others and earlier
 *  sign-ups), and when the privacy notice was agreed to (null: an earlier app that did not ask). */
export const consentView = (p) => ({
  parentConsent: p?.parent_name ? { name: p.parent_name, phone: p.parent_phone, at: p.parent_consent_at || null } : null,
  privacyConsentAt: p?.privacy_consent_at || null
});

export async function profileGet(d, ctx) {
  const p = await one(ctx.db, 'SELECT * FROM profiles WHERE login = ?', ctx.login);
  const photo = await one(ctx.db, 'SELECT updated_at FROM photos WHERE login = ?', ctx.login);
  const acct = ctx.acct || {}, m = await currentMembership(ctx.db, ctx.login);
  // their IYF ID: the one the identity authority holds, so About can say it (the head, 17 Oct 2026).
  // It is theirs and they should be able to read it without asking a coordinator — it is what every
  // IYF record refers to them by.
  // The year they came to IYF: on record, or read from an IYFD id that carries it. Theirs to set ONCE, while
  // no year is on record and no IYFD id carries one yet (18 Oct 2026) — after that it is locked, because the
  // id carries it, and a wrong year is the head's to correct by superseding.
  const idYear = /^IYFD-(\d{4})-/.exec(acct.iyf_id || '')?.[1] || '';
  // the ID's year wins over a profile year that disagrees (IYFD-2024-0006 with a profile saying 2025): the ID is what carries it
  const csYear = idYear || String(p?.connected_since || '').slice(0, 4);
  // settable until an IYFD carries the year (22 Oct 2026). A year on record with no IYFD — Vilash, SR26-0001 with
  // 2013 — was locked out for ever: nothing could issue his id but the head. Now it is offered pre-filled.
  return { name: acct.name || ctx.name || '', iyfId: acct.iyf_id || '',
           connectedSinceYear: csYear, connectedSinceSettable: !idYear,
           email: acct.email || '', whatsapp: acct.whatsapp || '', classDay: m?.class_day || acct.requested_class_day || null, facilitator: m?.facilitator || acct.requested_facilitator || null,
           dob: p?.dob || null, bloodGroup: p?.blood_group || null,
           profession: p?.profession || '', skills: readSkills(p?.skills), connectedSince: p?.connected_since || '',
           emergency: p ? { name: p.emergency_name, relation: p.emergency_relation, phone: p.emergency_phone } : null, address: addressView(p), ...consentView(p),
           readingPagesPerHour: p?.reading_pages_per_hour ?? 20, hasPhoto: !!photo, photoUpdatedAt: photo?.updated_at || null,
           // Every training they have been through, with what they scored in it (the head, 18 Oct
           // 2026): "his entire batch's ETP net score should be getting reflected in his about
           // section". The coordinator's contact card already carried this; the person it is about
           // could not see their own.
           trainings: await trainingsOf(ctx.db, ctx.login) };
}

export async function profileUpdate(d, ctx, req) {
  const db = ctx.db, problems = [], set = {};
  if (d.dob !== undefined) {
    const dob = validYmd(d.dob), age = dob ? ageOn(dob, ctx.now()) : -1;
    if (!dob || age < 12 || age > 80) problems.push({ path: 'dob', message: 'Check your date of birth.' }); else set.dob = dob;
  }
  if (d.bloodGroup !== undefined) { if (!BLOOD_GROUPS.includes(d.bloodGroup)) problems.push({ path: 'bloodGroup', message: 'Choose from the list.' }); else set.blood_group = d.bloodGroup; }
  // About you (10–11 Oct 2026): profession and skills optional (an empty value clears them).
  // "Connected since" may be set ONCE here, by a devotee who has no year on record and no IYFD id yet — people
  // from before sign-up asked for it (the head, 18 Oct 2026). Setting it issues their IYFD id at once, superseding
  // any old GP/JN/KT/SR number. Once set it is locked: the id carries the year, and changing it is the head's
  // (identity.supersede), as decided on 11 Oct.
  if (d.profession !== undefined) { const v = cleanName(d.profession);
    if (v.length > 80) problems.push({ path: 'profession', message: 'At most 80 characters.' }); else set.profession = v; }
  // service skills, chosen from the fixed list — never typed, so a coordinator can search them
  if (d.skills !== undefined) {
    if (d.skills === '' || d.skills === null) set.skills = '[]';
    else if (!Array.isArray(d.skills) || d.skills.some((x) => !SKILLS.includes(x))) problems.push({ path: 'skills', message: 'Choose your skills from the list.' });
    else set.skills = JSON.stringify([...new Set(d.skills)]);
  }
  if (d.emergency !== undefined) {
    const em = d.emergency && typeof d.emergency === 'object' ? d.emergency : {};
    const n = cleanName(em.name), r = cleanName(em.relation), ph = normPhone(em.phone);
    if (!validName(n)) problems.push({ path: 'emergency.name', message: "Enter the emergency contact's name." });
    if (!r || r.length > 30) problems.push({ path: 'emergency.relation', message: 'Enter how they are related to you.' });
    if (!ph) problems.push({ path: 'emergency.phone', message: 'Enter their 10-digit mobile number.' });
    else if (ph === ctx.login) problems.push({ path: 'emergency.phone', message: "Use someone else's number, not your own." });
    Object.assign(set, { emergency_name: n, emergency_relation: r, emergency_phone: ph });
  }
  // only the devotee changes their own address (coordinators and the head see it)
  if (d.address !== undefined) { const ad = checkAddress(d.address, 'address'); problems.push(...ad.problems); if (ad.value) Object.assign(set, ad.value); }
  if (d.readingPagesPerHour !== undefined) {
    if (!Number.isInteger(d.readingPagesPerHour) || d.readingPagesPerHour < 1 || d.readingPagesPerHour > 200) problems.push({ path: 'readingPagesPerHour', message: '1 to 200 pages.' });
    else set.reading_pages_per_hour = d.readingPagesPerHour;
  }
  const acctSet = {};
  // one's own name, any role (the head, 4 Oct 2026): letters and spaces, logged
  if (d.name !== undefined) {
    const n = cleanName(d.name);
    if (!validName(n)) problems.push({ path: 'name', message: 'Enter your name (letters and spaces).' });
    else if (n !== (ctx.acct?.name || ctx.name)) acctSet.name = n;
  }
  // one's own class day (the head, 4 Oct 2026): Sunday or Saturday, on the current membership (or the sign-up's choice)
  let classDay = null;
  if (d.classDay !== undefined) { if (!CLASS_DAYS.includes(d.classDay)) problems.push({ path: 'classDay', message: 'Sunday or Saturday.' }); else classDay = d.classDay; }
  // one's own facilitator (the head, 5 Oct 2026: it can change after sign-up): picked from the list, never typed; a name
  // the head has switched off is kept if it is the current one, but cannot be newly chosen (as devotees.setPeople)
  let facilitator = null, facM = null, reqFac = null;
  if (d.facilitator !== undefined) {
    facM = await currentMembership(db, ctx.login);
    const was = facM ? facM.facilitator : (ctx.acct?.requested_facilitator || '');
    if (String(d.facilitator) !== was && !(await isOffered(db, d.facilitator))) problems.push({ path: 'facilitator', message: 'Choose your facilitator from the list.' });
    else facilitator = String(d.facilitator);
  }
  if (d.email !== undefined) {
    const e = normEmail(d.email);
    if (!e) problems.push({ path: 'email', message: 'Enter a valid email address.' });
    else { const msg = await emailProblem(e); if (msg) problems.push({ path: 'email', message: msg }); else acctSet.email = e; }
  }
  if (d.whatsapp !== undefined) {
    const w = normWhatsapp(d.whatsapp);
    if (w === null) problems.push({ path: 'whatsapp', message: 'Enter a 10-digit WhatsApp number, or leave it empty.' }); else acctSet.whatsapp = w;
  }
  // the year they came to IYF — set once (see the note above), and only while nothing carries one yet
  let newYear = '';
  if (d.connectedSince !== undefined) {
    const y = String(d.connectedSince ?? '').trim();
    const have = await one(db, 'SELECT connected_since FROM profiles WHERE login = ?', ctx.login);
    // 22 Oct 2026, the head: an IYFD that carries the year locks it; a year already on record (given at sign-up, or
    // Vilash's 2013) may only be CONFIRMED, never changed — confirming issues the id; no year at all may be chosen.
    const held = /^IYFD-(\d{4})-/.exec(ctx.acct?.iyf_id || '')?.[1] || '';
    const onRecord = String(have?.connected_since || '').slice(0, 4);
    if (held) problems.push({ path: 'connectedSince', message: 'Your year is already set. Ask the IYF head if it is wrong.' });
    else if (onRecord && y !== onRecord) problems.push({ path: 'connectedSince', message: `Your year is on record as ${onRecord}. Ask the IYF head if it is wrong.` });
    else { const bad = yearProblem(y, isoIst(ctx.now())); if (bad) problems.push({ path: 'connectedSince', message: bad }); else newYear = y; }
  }
  if (problems.length) throw invalid(problems);
  const keys = Object.keys(set), at = isoIst(ctx.now());

  // ONE atomic write for the whole save (13 Oct 2026, audit F16 / roadmap 3.6). This used to run up to four
  // separate db.batch() calls — membership facilitator, membership class day, accounts, profiles — so a failure
  // part-way left the person with a new facilitator and an old class day, or a renamed account whose profile row
  // still held the previous name. D1 has no transactions, but one batch IS atomic, so every statement below either
  // lands together or not at all. The statements are collected first and run once.
  const st = [];
  if (facilitator !== null) {
    // the name and its id together (Phase 24): the id is what every read follows
    if (facM && facM.facilitator !== facilitator) st.push(q(db, `UPDATE memberships SET facilitator = ?, fac_id = ${FAC_ID_OF} WHERE id = ?`, facilitator, facilitator, facM.id), dirty(db, 'memberships', 'audit_log'),
      audit(db, ctx, 'profile.facilitator', ctx.login, facM.batch_id, { facilitator: facM.facilitator || null }, { facilitator }, '', req?.requestId));
    else if (!facM) { acctSet.requested_facilitator = facilitator; reqFac = facilitator; }
  }
  if (classDay) {
    const m = await currentMembership(db, ctx.login);
    if (m && m.class_day !== classDay) st.push(q(db, 'UPDATE memberships SET class_day = ? WHERE id = ?', classDay, m.id), dirty(db, 'memberships'),
      audit(db, ctx, 'profile.classDay', ctx.login, m.batch_id, { classDay: m.class_day || null }, { classDay }, '', req?.requestId));
    else if (!m) acctSet.requested_class_day = classDay;
  }
  // one's own name goes through the one rename (Phase 24, src/names.js): the account, the profile, the identity record,
  // and the facilitator they are, if they are one — so a trainee or a facilitator login keeps ONE name everywhere
  const renamed = acctSet.name ? await renamePerson(db, ctx, { login: ctx.login }, acctSet.name, { at }) : null;
  // acctSet may have gained requested_* keys above, so it is read after both blocks
  const ak = Object.keys(acctSet).filter(k => k !== 'name');
  if (ak.length) {
    st.push(q(db, `UPDATE accounts SET ${ak.map(k => `${k} = ?`).join(', ')}${reqFac !== null ? `, requested_fac_id = ${FAC_ID_OF}` : ''}, updated_at = ?, updated_by = ? WHERE login = ?`,
      ...ak.map(k => acctSet[k]), ...(reqFac !== null ? [reqFac] : []), at, ctx.login, ctx.login), dirty(db, 'accounts'));
  }
  if (renamed) {
    st.push(...renamed.stmts, dirty(db, 'accounts', 'facilitators'),
      audit(db, ctx, 'profile.rename', ctx.login, '', { name: ctx.acct?.name || ctx.name }, { name: acctSet.name, ...(renamed.fac && renamed.old.facilitator !== acctSet.name ? { facilitator: renamed.fac.id } : {}) }, '', req?.requestId));
  }
  if (keys.length) {
    st.push(
      q(db, 'INSERT OR IGNORE INTO profiles (login, iyf_id, name, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)', ctx.login, ctx.iyfId || '', ctx.name, at, ctx.login),
      q(db, `UPDATE profiles SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ?, updated_by = ? WHERE login = ?`, ...keys.map(k => set[k]), at, ctx.login, ctx.login),
      dirty(db, 'profiles'));
  }
  if (st.length) await db.batch(st);
  // the in-memory account follows only once the write succeeded
  if (Object.keys(acctSet).length) Object.assign(ctx.acct || {}, acctSet);

  // The identity record follows the profile (the user, 11 Oct 2026). A facilitator (or anyone) who gives their
  // number or name on ANY screen must have it reach their person record — otherwise the data sits in `accounts`
  // and their own identity stays empty while they appear as a facilitator on other people's rows.
  // Best effort: a profile save must never fail because the identity tables disagree.
  try { await syncPerson(db, ctx, at); } catch (e) { console.error('profile: identity sync skipped: ' + e.message); }
  // their IYFD id, now that the year is known — from the one authority, superseding any old number
  if (newYear) {
    const r = await issueForAccount(db, ctx, { login: ctx.login, name: ctx.acct?.name || ctx.name, year: newYear,
      reason: 'year set by the devotee', batchId: (await currentMembership(db, ctx.login))?.batch_id || '' });
    if (ctx.acct) ctx.acct.iyf_id = r.fid;
  }
  return profileGet({}, ctx);
}

/**
 * Carries what the account knows into the person record: the phone, the WhatsApp number as another phone, and the
 * current name. Finds the person by IYF ID first, then by any phone they already have — never creates a second
 * record for someone we already hold, and never mints an id (that needs a year of connection).
 */
async function syncPerson(db, ctx, at) {
  const a = ctx.acct || {};
  const phones = [...new Set([normPhone(a.phone), normPhone(a.whatsapp), normPhone(ctx.login)].filter(Boolean))];
  const fid = String(a.iyf_id || ctx.iyfId || '').trim();
  if (!fid && !phones.length) return;                       // nothing to attach them by
  let personId = await resolve(db, { fid, phone: phones[0] });
  for (let i = 1; !personId && i < phones.length; i++) personId = await resolve(db, { phone: phones[i] });
  if (!personId) return;                                    // not someone the import holds: identity.mint creates them
  const st = [];
  // every number they have given, kept as a phone of theirs; the first stays primary
  for (const ph of phones) {
    st.push(q(db, 'INSERT OR IGNORE INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES (?, ?, 0, 1, ?)', ph, personId, at));
  }
  const name = String(a.name || ctx.name || '').trim();
  if (name) st.push(q(db, "INSERT OR IGNORE INTO person_names (person_id, name, kind, is_current, from_at, added_at) VALUES (?, ?, 'given', 0, '', ?)", personId, name, at));
  // the email too (the user, 11 Oct 2026): person_history.kind is free text, so it needs no migration, and a
  // devotee who changes address keeps the old one in the history rather than overwriting it
  const email = String(a.email || '').trim().toLowerCase();
  if (email && !(await one(db, "SELECT 1 AS x FROM person_history WHERE person_id = ? AND kind = 'email' AND value = ?", personId, email))) {
    st.push(q(db, "INSERT INTO person_history (person_id, kind, value, seq, source, recorded_at) VALUES (?, 'email', ?, 0, 'app', ?)", personId, email, at));
  }
  // the account carries the id it is linked to, so exports and the dashboard agree
  if (fid) st.push(q(db, 'INSERT OR IGNORE INTO person_links (person_id, service, account_ref, linked_at) VALUES (?, ?, ?, ?)', personId, 'sadhana', ctx.login, at));
  if (!st.length) return;
  st.push(dirty(db, 'person_phones', 'person_names', 'person_links', 'person_history'));
  await db.batch(st);
}

/** Width and height of a baseline or progressive JPEG, or null if it is not one. */
const MAX_PHOTO = 150 * 1024;

export async function photoUpload(d, ctx, req) {
  const img = checkJpeg(d.jpegBase64, { path: 'jpegBase64', maxBytes: MAX_PHOTO, min: 64, max: 400,
    tooBig: 'The photo must be a JPEG of at most 150 KB.', wrongSize: 'The photo must be between 64 and 400 pixels square.' });
  const s = img.s, bytes = { length: img.bytes };
  const db = ctx.db, at = isoIst(ctx.now());
  await db.batch([
    q(db, `INSERT INTO photos (login, jpeg, bytes, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(login) DO UPDATE SET jpeg = excluded.jpeg, bytes = excluded.bytes, updated_at = excluded.updated_at, updated_by = excluded.updated_by`, ctx.login, s, bytes.length, at, ctx.login),
    q(db, 'UPDATE profiles SET photo_updated_at = ? WHERE login = ?', at, ctx.login), dirty(db, 'profiles')]);
  return { hasPhoto: true, photoUpdatedAt: at };
}

/** Whose photo: the caller's own, or (staff) a devotee of their batches. */
async function photoOwner(ctx, login, change = false) {
  if (login === undefined || normPhone(login) === ctx.login || String(login) === ctx.login) return { login: ctx.login, own: true };
  // Someone else's photo is a STAFF matter (13 Oct 2026, audit F4). These two actions are gated ANY so that a
  // person can fetch and remove their OWN picture; reading another login is only for a coordinator working through
  // their batch, or the head. A devotee asking about any other number — including a batch-mate's — gets the same
  // answer as for a number that has never signed up, so nothing can be told apart. (Before this, a batch-mate
  // answered "No photo." where a stranger answered "No devotee with that phone.", which confirmed the number.)
  const staff = ctx.scopes?.master || (ctx.scopes?.coordinator?.length > 0);
  if (!staff) throw apiError('NOT_FOUND', 'No devotee with that phone.');
  const { a, batchId } = await managed(ctx, login, { allowPending: true, change });
  return { login: a.login, own: false, batchId };
}

export async function photoGet(d, ctx) {
  const o = await photoOwner(ctx, d.login);
  const p = await one(ctx.db, 'SELECT jpeg, updated_at FROM photos WHERE login = ?', o.login);
  if (!p) throw apiError('NOT_FOUND', 'No photo.');
  return { jpegBase64: p.jpeg, updatedAt: p.updated_at };
}

export async function photoRemove(d, ctx, req) {
  const o = await photoOwner(ctx, d.login, true), db = ctx.db;
  const reason = o.own ? '' : reasonOf(d.reason);
  await db.batch([q(db, 'DELETE FROM photos WHERE login = ?', o.login), q(db, "UPDATE profiles SET photo_updated_at = '' WHERE login = ?", o.login),
    ...(o.own ? [] : [audit(db, ctx, 'photo.remove', o.login, o.batchId, null, null, reason, req.requestId)]), dirty(db, 'profiles', 'audit_log')]);
  return { hasPhoto: false };
}
