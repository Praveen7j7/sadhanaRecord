// The IYF identity record (migration 0038, imported 11 Oct 2026): one lasting person behind every login,
// so a devotee keeps one IYF ID through a name change, a new phone or a new app.
//
// This file is the authority other things ask. The app mints; the facilitator dashboard's hourly job stops
// incrementing its own counter and calls `identity.mintBatch` instead, so two systems can never hand the same
// number to two people.
//
//   IYFD-<year>-<seq>   e.g. IYFD-2019-0044
//   The year is the year they first came to IYF Delhi. It is IN the id, so it can never be renumbered:
//   a wrong year is fixed by SUPERSEDING the id, and the old one keeps resolving for ever.
import { apiError, invalid, isoIst, normPhone } from './util.js';
import { q, one, all, audit, dirty } from './db.js';
import { newSession, endSessions } from './session.js';

export const ID_RE = /^IYFD-(19|20)\d{2}-\d{4,}$/;
const ulid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** The year must be a real one: it goes into an id that is never reissued. */
export function yearProblem(y, nowIso) {
  const s = String(y ?? '').trim();
  if (!/^(19|20)\d{2}$/.test(s)) return 'Choose the year they first came to IYF Delhi.';
  const n = +s, thisYear = +nowIso.slice(0, 4);
  if (n < 1980) return 'That year is too far back.';
  if (n > thisYear) return 'That year has not happened yet.';
  return '';
}

/**
 * Mint one id for a year. The sequence is per YEAR, so it resets每 year and stays four digits
 * (the busiest year on record is 333 people against a 9,999 ceiling) — and it widens on its own
 * rather than truncating, because a truncated number would duplicate a real person.
 *
 * Advanced with a conditional UPDATE and protected by UNIQUE(fid): two callers racing cannot both win.
 */
async function nextId(db, year) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await one(db, "SELECT next_seq FROM id_sequences WHERE series = 'IYFD' AND year = ?", year);
    const seq = row ? row.next_seq : 1;
    const now = isoIst(new Date());
    const res = row
      ? await db.prepare("UPDATE id_sequences SET next_seq = next_seq + 1, updated_at = ? WHERE series = 'IYFD' AND year = ? AND next_seq = ?")
          .bind(now, year, seq).run()
      : await db.prepare("INSERT OR IGNORE INTO id_sequences (series, year, next_seq, updated_at) VALUES ('IYFD', ?, 2, ?)")
          .bind(year, now).run();
    if (res.meta.changes) return `IYFD-${year}-${String(seq).padStart(4, '0')}`;   // %04d is a MINIMUM width
  }
  throw apiError('BUSY', 'Could not allocate an IYF ID just now. Please try again.');
}

/**
 * Give an ACCOUNT its IYF ID from the one authority (18 Oct 2026).
 *
 * There must be exactly one minter of IYFD numbers: `nextId`, counting per YEAR in `id_sequences`. The account
 * path once kept a counter of its own (the highest number it could see, plus one). With 2018 at 30 and 2022 at 336
 * in the authority, that would have handed out IYFD-2018-0234 — a number the 2018 counter reaches later, for
 * somebody else. Every account ID now comes from here.
 *
 *   1. the person record: found or made with `personForApproval`, linked to the account; a legacy ID they carry
 *      (GP26-, JN26-, KT26-, SR26-) is kept on the person as an identifier
 *   2. the number: `nextId(year)`, atomically — a number burned by a failed write below is never reissued
 *   3. every identifier they held becomes `superseded` by the new one, so an old ID on a sheet or a certificate
 *      still resolves to them for ever; an app-minted SR id is retired in `app_ids` as well
 *
 * The year is THEIRS — the year they came to IYF — and is required. Never today's date in its place: a cohort
 * that falls back to the import or creation date numbers people into the wrong year for good.
 */
export async function issueForAccount(db, ctx, { login, name, year, reason = '', batchId = '' }) {
  const bad = yearProblem(year, isoIst(ctx.now()));
  if (bad) throw invalid({ path: 'year', message: bad });
  const acct = await one(db, 'SELECT login, name, iyf_id FROM accounts WHERE login = ?', String(login));
  if (!acct) throw apiError('NOT_FOUND', 'No such account.');
  const was = String(acct.iyf_id || '');
  if (/^IYFD-/.test(was)) throw apiError('CONFLICT', `They already have ${was}. A wrong year is fixed by superseding it.`);

  // 1. the person, with the legacy id they carry kept as one of their identifiers
  const pf = await personForApproval(db, ctx, { login: acct.login, name: name || acct.name, iyfId: was, connectedSince: year });
  if (pf.stmts.length) await db.batch(pf.stmts);
  const personId = pf.personId;

  // 2. the number, from the authority
  const fid = await nextId(db, String(year));
  const now = isoIst(ctx.now());

  // 3. supersede everything they held, record the new id everywhere the app reads it
  await db.batch([
    q(db, "UPDATE person_identifiers SET state = 'superseded', superseded_by = ?, ended_at = ? WHERE person_id = ? AND state = 'current'", fid, now, personId),
    q(db, "INSERT INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at) VALUES (?, ?, 'IYFD', 'current', 'app', ?)", fid, personId, now),
    q(db, "UPDATE persons SET iyf_id = ?, connected_since = ?, connected_since_src = 'app', updated_at = ? WHERE id = ?", fid, String(year), now, personId),
    q(db, "UPDATE accounts SET iyf_id = ?, id_source = 'APP', updated_at = ?, updated_by = ? WHERE login = ?", fid, now, ctx.login || 'SYSTEM', acct.login),
    q(db, "UPDATE profiles SET iyf_id = ?, connected_since = ?, updated_at = ?, updated_by = ? WHERE login = ?", fid, String(year), now, ctx.login || 'SYSTEM', acct.login),
    q(db, "UPDATE memberships SET iyf_id = ? WHERE login = ? AND to_week = ''", fid, acct.login),
    q(db, "UPDATE app_ids SET state = 'RETIRED', replaced_by = ?, retired_at = ? WHERE login = ? AND state = 'ACTIVE'", fid, now, acct.login),
    // and recorded as issued here, so the head's "Created here" list keeps showing what the app gave out
    q(db, `INSERT INTO app_ids (iyf_id, login, name, batch_id, created_by, created_at, reason, state)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`, fid, acct.login, name || acct.name, batchId, ctx.login || 'SYSTEM', now, reason),
    audit(db, ctx, 'identity.issue', acct.login, '', { iyfId: was }, { iyfId: fid, year: String(year) }, reason),
    dirty(db, 'persons', 'person_identifiers', 'id_sequences', 'accounts', 'profiles', 'memberships', 'app_ids'),
  ]);
  return { fid, was, personId };
}

/** The id `issueForAccount` would give for this year, WITHOUT taking it — for the head's confirm step. */
export async function previewId(db, year) {
  const row = await one(db, "SELECT next_seq FROM id_sequences WHERE series = 'IYFD' AND year = ?", String(year));
  return `IYFD-${year}-${String(row ? row.next_seq : 1).padStart(4, '0')}`;
}

/** Everything known about one person, by their internal id. */
export async function personView(db, id) {
  const p = await one(db, 'SELECT * FROM persons WHERE id = ?', id);
  if (!p) return null;
  const names = await all(db, 'SELECT name, kind, is_current, from_at FROM person_names WHERE person_id = ? ORDER BY is_current DESC, id', id);
  const phones = await all(db, 'SELECT phone, is_primary, active FROM person_phones WHERE person_id = ? ORDER BY is_primary DESC, active DESC', id);
  const ids = await all(db, 'SELECT fid, state, superseded_by, issued_by, issued_at FROM person_identifiers WHERE person_id = ? ORDER BY state, issued_at', id);
  const hist = await all(db, 'SELECT kind, value, seq, source FROM person_history WHERE person_id = ? ORDER BY kind, seq', id);
  const links = await all(db, 'SELECT service, account_ref, linked_at FROM person_links WHERE person_id = ?', id);
  return {
    id: p.id, iyfId: p.iyf_id || '', name: p.display_name,
    connectedSince: p.connected_since || '', connectedSinceSource: p.connected_since_src || '',
    status: p.status, mergedInto: p.merged_into || '',
    names: names.map(n => ({ name: n.name, kind: n.kind, current: !!n.is_current, from: n.from_at || '' })),
    phones: phones.map(x => ({ phone: x.phone, primary: !!x.is_primary, active: !!x.active })),
    identifiers: ids.map(x => ({ fid: x.fid, state: x.state, supersededBy: x.superseded_by || '', issuedBy: x.issued_by, at: x.issued_at })),
    facilitators: hist.filter(h => h.kind === 'facilitator').map(h => h.value),
    levels: hist.filter(h => h.kind === 'level').map(h => h.value),
    sources: hist.filter(h => h.kind === 'source_row').map(h => h.value),
    accounts: links.map(l => ({ service: l.service, account: l.account_ref, at: l.linked_at })),
  };
}

/** Find a person by phone, by any id they have ever held, or by any name they have ever been known by. */
export async function resolve(db, { phone, fid, name }) {
  if (phone) {
    const ph = await one(db, 'SELECT person_id FROM person_phones WHERE phone = ?', normPhone(phone) || phone);
    if (ph) return ph.person_id;
  }
  if (fid) {
    const i = await one(db, 'SELECT person_id FROM person_identifiers WHERE fid = ?', String(fid).toUpperCase().trim());
    if (i) return i.person_id;
  }
  if (name) {
    const n = await one(db, 'SELECT person_id FROM person_names WHERE lower(name) = ?', String(name).toLowerCase().trim());
    if (n) return n.person_id;
  }
  return null;
}

/* ───────────────────────── master screens ───────────────────────── */

/** Search every name a person has ever held, every phone and every id — old ones included. */
export async function identitySearch(d, ctx) {
  const db = ctx.db, raw = String(d.q || '').trim();
  if (raw.length < 2) throw invalid({ path: 'q', message: 'Type at least two characters.' });
  const like = '%' + raw.toLowerCase() + '%', ph = normPhone(raw);
  const rows = await all(db, `
    SELECT DISTINCT p.id FROM persons p
      LEFT JOIN person_names n ON n.person_id = p.id
      LEFT JOIN person_phones h ON h.person_id = p.id
      LEFT JOIN person_identifiers i ON i.person_id = p.id
     WHERE lower(n.name) LIKE ?1 OR h.phone = ?2 OR upper(i.fid) = ?3 OR p.iyf_id = ?3
     LIMIT 25`, like, ph || '\u0000', raw.toUpperCase());
  const out = [];
  for (const r of rows) out.push(await personView(db, r.id));
  return { people: out.filter(Boolean) };
}

export async function identityGet(d, ctx) {
  const db = ctx.db;
  const id = d.personId || await resolve(db, { phone: d.phone, fid: d.iyfId, name: d.name });
  if (!id) throw apiError('NOT_FOUND', 'No person with that name, number or IYF ID.');
  const v = await personView(db, id);
  if (!v) throw apiError('NOT_FOUND', 'No person with that name, number or IYF ID.');
  return v;
}

/** Link an app account to a person by hand — the non-phone logins cannot be matched automatically. */
export async function identityLink(d, ctx) {
  const db = ctx.db, login = String(d.login || '').trim(), personId = String(d.personId || '').trim();
  if (!login || !personId) throw invalid({ path: 'login', message: 'Choose the account and the person.' });
  const a = await one(db, 'SELECT login FROM accounts WHERE login = ?', login);
  if (!a) throw apiError('NOT_FOUND', 'No such account.');
  const p = await personView(db, personId);
  if (!p) throw apiError('NOT_FOUND', 'No such person.');
  const taken = await one(db, "SELECT person_id FROM person_links WHERE service = 'sadhana' AND account_ref = ?", login);
  if (taken && taken.person_id !== personId) throw apiError('CONFLICT', 'That account is already linked to another person. Unlink it first.');
  const now = isoIst(ctx.now());
  const st = [q(db, "INSERT OR REPLACE INTO person_links (service, account_ref, person_id, linked_at) VALUES ('sadhana', ?, ?, ?)", login, personId, now)];
  // the account carries the person's current id, so exports and screens agree
  if (p.iyfId) st.push(q(db, 'UPDATE accounts SET iyf_id = ?, id_source = ?, updated_at = ?, updated_by = ? WHERE login = ?', p.iyfId, 'MASTER', now, ctx.login, login));
  st.push(audit(db, ctx, 'identity.link', login, '', {}, { personId, iyfId: p.iyfId }, d.reason || ''));
  st.push(dirty(db, 'accounts', 'person_links'));
  await db.batch(st);
  return { ok: true, person: await personView(db, personId) };
}

/** Give a person their IYF ID, once the year they connected is known. */
export async function identityMint(d, ctx) {
  const db = ctx.db, personId = String(d.personId || '').trim(), year = String(d.year || '').trim();
  const p = await one(db, 'SELECT id, iyf_id, display_name FROM persons WHERE id = ?', personId);
  if (!p) throw apiError('NOT_FOUND', 'No such person.');
  if (p.iyf_id) throw apiError('CONFLICT', `${p.display_name} already has ${p.iyf_id}. A wrong year is fixed by superseding it, never by renumbering.`);
  const bad = yearProblem(year, isoIst(ctx.now()));
  if (bad) throw invalid({ path: 'year', message: bad });
  const fid = await nextId(db, year), now = isoIst(ctx.now());
  await db.batch([
    q(db, "UPDATE persons SET iyf_id = ?, connected_since = ?, connected_since_src = 'coordinator', updated_at = ? WHERE id = ?", fid, year, now, personId),
    q(db, "INSERT INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at) VALUES (?, ?, 'IYFD', 'current', 'app', ?)", fid, personId, now),
    q(db, `UPDATE accounts SET iyf_id = ?, id_source = 'MASTER', updated_at = ?, updated_by = ?
             WHERE login IN (SELECT account_ref FROM person_links WHERE service = 'sadhana' AND person_id = ?)`, fid, now, ctx.login, personId),
    audit(db, ctx, 'identity.mint', personId, '', {}, { fid, year }, d.reason || ''),
    dirty(db, 'persons', 'person_identifiers', 'id_sequences', 'accounts'),
  ]);
  return { fid, person: await personView(db, personId) };
}

/**
 * Replace a person's id — when the year turns out to be wrong. The old id is NEVER deleted and never
 * reissued: it becomes `superseded` and still resolves, because years of records point at it.
 */
export async function identitySupersede(d, ctx) {
  const db = ctx.db, personId = String(d.personId || '').trim(), year = String(d.year || '').trim();
  const p = await one(db, 'SELECT id, iyf_id FROM persons WHERE id = ?', personId);
  if (!p) throw apiError('NOT_FOUND', 'No such person.');
  if (!p.iyf_id) throw apiError('CONFLICT', 'That person has no IYF ID yet — mint one instead.');
  const bad = yearProblem(year, isoIst(ctx.now()));
  if (bad) throw invalid({ path: 'year', message: bad });
  if (year === String(p.iyf_id).slice(5, 9)) throw apiError('CONFLICT', 'That is already the year in their IYF ID.');
  const fid = await nextId(db, year), now = isoIst(ctx.now());
  await db.batch([
    q(db, "UPDATE person_identifiers SET state = 'superseded', superseded_by = ?, ended_at = ? WHERE fid = ?", fid, now, p.iyf_id),
    q(db, "INSERT INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at) VALUES (?, ?, 'IYFD', 'current', 'app', ?)", fid, personId, now),
    q(db, "UPDATE persons SET iyf_id = ?, connected_since = ?, connected_since_src = 'coordinator', updated_at = ? WHERE id = ?", fid, year, now, personId),
    q(db, `UPDATE accounts SET iyf_id = ?, updated_at = ?, updated_by = ?
             WHERE login IN (SELECT account_ref FROM person_links WHERE service = 'sadhana' AND person_id = ?)`, fid, now, ctx.login, personId),
    audit(db, ctx, 'identity.supersede', personId, '', { iyfId: p.iyf_id }, { iyfId: fid, year }, d.reason || ''),
    dirty(db, 'persons', 'person_identifiers', 'id_sequences', 'accounts'),
  ]);
  return { fid, was: p.iyf_id, person: await personView(db, personId) };
}

/**
 * Fold one person record into another (13 October 2026; audit B8 / roadmap 3.9). The IYF head only.
 *
 * Until now nothing could undo a duplicate: two records for one human — a re-registration under a second phone, a
 * sibling signed up on the family number, an import that did not match — stayed two for ever, and
 * `persons.merged_into`, `person_identifiers.state = 'superseded'` and `superseded_by` were columns with no
 * producer. The duplicate-review screen (ids.possibleDuplicates) finds the candidates; this is what a head does
 * about one.
 *
 * What it does, in one atomic write:
 *   · the losing record is marked `merged_into` the keeper and set Inactive — it is never deleted, so a link or an
 *     export that still names it resolves to the keeper rather than to nothing;
 *   · every identifier of the loser moves to the keeper as `superseded`, pointing at the keeper's current id, so
 *     an old IYF ID on a certificate or in a sheet keeps resolving for ever (the promise in 0038);
 *   · phones, names, history rows and account links move to the keeper (a phone the keeper already has is left
 *     alone — `INSERT OR IGNORE` cannot re-point a row, so the loser's copy is updated only where it is free);
 *   · accounts carrying the loser's IYF ID are re-stamped with the keeper's.
 *
 * What it deliberately does NOT do: decide which record to keep, or merge anything by itself. A human chooses.
 */
export async function identityMerge(d, ctx, req) {
  const db = ctx.db, keepId = String(d.keep || '').trim(), loseId = String(d.lose || '').trim();
  const reason = String(d.reason || '').trim();
  if (!keepId || !loseId) throw invalid({ path: 'lose', message: 'Give both person records.' });
  if (keepId === loseId) throw apiError('CONFLICT', 'That is one person, not two.');
  if (reason.length < 2 || reason.length > 200) throw invalid({ path: 'reason', message: 'Say why these are one person.' });

  const keep = await one(db, 'SELECT * FROM persons WHERE id = ?', keepId);
  const lose = await one(db, 'SELECT * FROM persons WHERE id = ?', loseId);
  if (!keep || !lose) throw apiError('NOT_FOUND', 'No such person.');
  if (keep.merged_into) throw apiError('CONFLICT', 'The record you are keeping was itself merged away; merge into the newer one.');
  if (lose.merged_into) throw apiError('CONFLICT', 'That record is already merged.');

  const now = isoIst(ctx.now());
  // what moves, read before the write so the audit row can say exactly what happened
  const ids = await all(db, 'SELECT fid, state FROM person_identifiers WHERE person_id = ?', loseId);
  const phones = await all(db, 'SELECT phone FROM person_phones WHERE person_id = ?', loseId);
  const links = await all(db, "SELECT account_ref FROM person_links WHERE service = 'sadhana' AND person_id = ?", loseId);

  await db.batch([
    // the loser points at the keeper and stops being current
    q(db, "UPDATE persons SET merged_into = ?, status = 'Inactive', updated_at = ? WHERE id = ?", keepId, now, loseId),
    // its identifiers belong to the keeper now, superseded by the keeper's current id (if it has one)
    q(db, `UPDATE person_identifiers SET person_id = ?, state = 'superseded', superseded_by = ?, ended_at = CASE WHEN ended_at = '' THEN ? ELSE ended_at END
             WHERE person_id = ?`, keepId, keep.iyf_id || '', now, loseId),
    // phones: move the ones the keeper does not already hold
    q(db, `UPDATE person_phones SET person_id = ?, is_primary = 0 WHERE person_id = ?
             AND phone NOT IN (SELECT phone FROM person_phones WHERE person_id = ?)`, keepId, loseId, keepId),
    // names: keep them as past names of the keeper, never as a second "current" one (0038 has a partial unique
    // index on is_current = 1, so a second current row would be refused outright)
    q(db, "UPDATE person_names SET person_id = ?, is_current = 0 WHERE person_id = ?", keepId, loseId),
    q(db, 'UPDATE person_history SET person_id = ? WHERE person_id = ?', keepId, loseId),
    // account links move, unless that account is already linked to the keeper
    q(db, `UPDATE person_links SET person_id = ?, linked_at = ? WHERE service = 'sadhana' AND person_id = ?
             AND account_ref NOT IN (SELECT account_ref FROM person_links WHERE service = 'sadhana' AND person_id = ?)`, keepId, now, loseId, keepId),
    // and any account still stamped with the loser's IYF ID carries the keeper's
    ...(keep.iyf_id && lose.iyf_id ? [q(db, `UPDATE accounts SET iyf_id = ?, id_source = 'MASTER', updated_at = ?, updated_by = ? WHERE iyf_id = ?`,
      keep.iyf_id, now, ctx.login, lose.iyf_id)] : []),
    audit(db, ctx, 'identity.merge', loseId, '', { person: loseId, iyfId: lose.iyf_id || null, name: lose.display_name, identifiers: ids.map(x => x.fid), phones: phones.map(x => x.phone), accounts: links.map(x => x.account_ref) },
      { mergedInto: keepId, iyfId: keep.iyf_id || null, name: keep.display_name }, reason, req?.requestId),
    dirty(db, 'persons', 'person_identifiers', 'person_phones', 'person_names', 'person_history', 'person_links', 'accounts', 'audit_log')
  ]);
  return { keep: await personView(db, keepId), moved: { identifiers: ids.length, phones: phones.length, accounts: links.length } };
}

/* ───────────────────────── the dashboard's hourly job ───────────────────────── */

/**
 * Ids for a batch of people, in ONE call (the user, 11 Oct 2026): the facilitator dashboard's hourly
 * registration job asks for the numbers instead of incrementing its own counter, so the two systems can
 * never hand the same number to two people.
 *
 * Idempotent on the phone: a timeout and a retry return the SAME id rather than burning a number.
 * A row we cannot place (no phone, no usable year) comes back with `fid: ''` and a reason — the job must
 * leave that id blank and carry on, never fail the whole run.
 *
 * VL-1 → VL-2 and VL-2 → VL-3 registrations may send `year` as the registration year (a course runs about
 * three months, so it is the year they connected) — but only for someone we do not already hold. If the
 * phone matches a person who already has a year, THAT year wins: someone who joined in 2019 and is only
 * now moving up a level must not be stamped 2026 for ever.
 */
export async function mintBatch(d, ctx) {
  const db = ctx.db, rows = Array.isArray(d.rows) ? d.rows : null;
  if (!rows) throw invalid({ path: 'rows', message: 'Send the rows to allocate.' });
  if (rows.length > 200) throw invalid({ path: 'rows', message: 'At most 200 rows in one call.' });
  const by = String(d.requestedBy || 'dashboard').slice(0, 40);
  const nowIso = isoIst(ctx.now());
  const out = [];
  for (const r of rows) {
    const key = String(r?.key ?? r?.phone ?? '').trim();
    const phone = normPhone(r?.phone);
    if (!phone) { out.push({ key, fid: '', why: 'no usable phone number' }); continue; }

    let personId = await resolve(db, { phone });
    if (personId) {
      const p = await one(db, 'SELECT iyf_id, connected_since FROM persons WHERE id = ?', personId);
      // already has one: hand back the same id, every time
      if (p?.iyf_id) { out.push({ key, fid: p.iyf_id, why: 'already had one' }); continue; }
      // known person, no year yet: the registration year is the best evidence we have
      const year = String(p?.connected_since || r?.year || '').trim();
      const bad = yearProblem(year, nowIso);
      if (bad) { out.push({ key, fid: '', why: 'no year of connection yet' }); continue; }
      const fid = await nextId(db, year);
      await db.batch([
        q(db, "UPDATE persons SET iyf_id = ?, connected_since = ?, connected_since_src = CASE WHEN connected_since = '' THEN 'inferred: course registration' ELSE connected_since_src END, updated_at = ? WHERE id = ?", fid, year, nowIso, personId),
        q(db, "INSERT INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at) VALUES (?, ?, 'IYFD', 'current', ?, ?)", fid, personId, by, nowIso),
        dirty(db, 'persons', 'person_identifiers', 'id_sequences'),
      ]);
      out.push({ key, fid, why: 'minted for a person we already held' });
      continue;
    }

    // someone new: a VL-1→VL-2 or VL-2→VL-3 registration carries the year
    const year = String(r?.year || '').trim();
    const bad = yearProblem(year, nowIso);
    if (bad) { out.push({ key, fid: '', why: 'no year of connection' }); continue; }
    const name = String(r?.name || '').replace(/\s+/g, ' ').trim();
    if (!name) { out.push({ key, fid: '', why: 'no name' }); continue; }
    const fid = await nextId(db, year), pid = 'p' + ulid();
    await db.batch([
      q(db, `INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, import_batch, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'inferred: course registration', 'Active', ?, ?, ?)`, pid, name, fid, year, 'cron:' + by, nowIso, nowIso),
      q(db, "INSERT INTO person_names (person_id, name, kind, is_current, added_at) VALUES (?, ?, 'given', 1, ?)", pid, name, nowIso),
      q(db, 'INSERT OR IGNORE INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES (?, ?, 1, 1, ?)', phone, pid, nowIso),
      q(db, "INSERT INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at) VALUES (?, ?, 'IYFD', 'current', ?, ?)", fid, pid, by, nowIso),
      dirty(db, 'persons', 'person_names', 'person_phones', 'person_identifiers', 'id_sequences'),
    ]);
    out.push({ key, fid, why: 'new person' });
  }
  return { ids: Object.fromEntries(out.map(o => [o.key, o.fid])), detail: out };
}

/**
 * Creates (or re-keys) the facilitator dashboard's service account and returns a fresh token — once.
 *
 * The dashboard's hourly registry job has to authenticate, and the only token that reached
 * `identity.mintBatch` used to be a master's own session token: 49 actions, including devotees.delete and
 * coordinators.resetPassword, sitting in an Apps Script Property that any dashboard editor can read, and
 * dying whenever that person changed their password. This account is scoped by `only_actions` (migration
 * 0041) to the ONE action the job calls, so the Script Property is no longer worth stealing, and revoking
 * it never touches a human's access.
 *
 * The token is returned ONCE and never stored anywhere readable: D1 keeps only its SHA-256. Run it again to
 * roll the key — the old sessions end, so a leaked token is cut off by re-running this and pasting the new
 * value. Sliding expiry (session.js) renews it on every hourly run, so it does not expire while the job runs.
 */
export async function serviceToken(d, ctx, req) {
  const db = ctx.db, login = String(d.login || 'dashboard-cron').trim().toLowerCase();
  if (!/^[a-z][a-z0-9.-]{2,29}$/.test(login)) throw invalid({ path: 'login', message: 'Use 3–30 lowercase letters, digits, dots or dashes, starting with a letter.' });
  const only = 'identity.mintBatch';
  const nowIso = isoIst(ctx.now());
  const existing = await one(db, 'SELECT login, role, only_actions FROM accounts WHERE login = ?', login);
  // Never re-key a person's login by mistake: only an account that is already scoped to these actions.
  if (existing && existing.only_actions !== only) {
    throw apiError('CONFLICT', `${login} already exists and is not a service account for ${only}.`);
  }
  const note = String(d.note || "The facilitator dashboard's hourly registry job (RegistryService.gs). Mints IYF IDs; can do nothing else.").slice(0, 200);
  const st = [];
  if (!existing) {
    // No password is ever set: this login cannot sign in through the app at all, it only carries the token.
    // pw_salt is EMPTY, which verifyPassword already treats as "never matches" — a placeholder that is not
    // valid base64 would instead make atob throw, turning a wrong-password attempt into an INTERNAL error.
    st.push(q(db, `INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations,
                                         must_change_pw, signed_up_at, decided_at, decided_by, updated_at, updated_by,
                                         is_master, only_actions, service_note)
                   VALUES (?, 'MASTER', 'ACTIVE', ?, '', '', '', 1, 0, ?, ?, ?, ?, ?, 1, ?, ?)`,
      login, 'Dashboard registry (service account)', nowIso, nowIso, ctx.login, nowIso, ctx.login, only, note));
  } else {
    st.push(q(db, 'UPDATE accounts SET only_actions = ?, service_note = ?, status = \'ACTIVE\', updated_at = ?, updated_by = ? WHERE login = ?',
      only, note, nowIso, ctx.login, login));
    st.push(endSessions(ctx, login, 'rekey'));           // rolling the key cuts off the old token
  }
  const acct = { login, role: 'MASTER' };
  const s = await newSession(ctx, acct, 'dashboard-cron');
  st.push(s.stmt);
  st.push(audit(db, ctx, 'identity.serviceToken', login, '', {}, { only, rekey: !!existing }, String(d.reason || ''), req?.requestId));
  st.push(dirty(db, 'accounts', 'audit_log'));
  await db.batch(st);
  return { login, token: s.token, onlyActions: only, expiresAt: s.expiresAt, rekeyed: !!existing };
}

/**
 * Make sure an approved devotee EXISTS in the identity tables, and is linked to their account.
 *
 * WHY (16 Oct 2026, found by the head). A devotee approved through the app got an IYF ID — either the
 * dashboard's, picked at approval, or one minted for them — and was then invisible to identity search,
 * because `requests.approve` never wrote to `persons` at all. The head could see the ID on the account and
 * could not trace the person behind it. Decision: the IYF ID is how a devotee is identified, so an approval
 * has to create the person, not just stamp a string on an account.
 *
 * NEVER CREATES A DUPLICATE. resolve() is asked first — by phone, then by the ID, then by the exact name —
 * and an existing person is reused. The dashboard's people are already in here (1,345 of them), so a
 * devotee IYF already knows is linked rather than invented a second time. A person is created only when
 * none of the three matches.
 *
 * It also never OVERWRITES. A name is added as a spelling variant beside what is there, a phone is added,
 * the IYF ID is recorded as an identifier. Nothing a human decided is replaced — that is what
 * identity.merge and identity.supersede are for, and they stay deliberate.
 *
 * Returns the statements to run INSIDE the approval's own batch, so the person and the membership either
 * both land or neither does.
 *
 * @returns {Promise<{ stmts: any[], personId: string, created: boolean }>}
 */
export async function personForApproval(db, ctx, { login, name, iyfId, connectedSince }) {
  const now = isoIst(ctx.now()), phone = normPhone(login) || login;
  const fid = String(iyfId || '').toUpperCase().trim();

  let personId = await resolve(db, { phone, fid, name });
  const created = !personId;
  const stmts = [];

  if (!personId) {
    personId = 'p' + ulid();
    stmts.push(q(db, `INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, created_at, updated_at)
                      VALUES (?, ?, ?, ?, 'app', 'Active', ?, ?)`,
      personId, name, fid, String(connectedSince || ''), now, now));
  } else {
    // known already: keep them active and give them an ID if they had none, but never replace one
    stmts.push(q(db, "UPDATE persons SET status = 'Active', updated_at = ?, iyf_id = CASE WHEN iyf_id = '' THEN ? ELSE iyf_id END WHERE id = ?",
      now, fid, personId));
  }

  // the identifier: OR IGNORE, because the dashboard's copy may already hold it
  if (fid) stmts.push(q(db, `INSERT OR IGNORE INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at)
                             VALUES (?, ?, ?, 'current', 'app', ?)`, fid, personId, fid.split(/[-0-9]/)[0] || 'IYFD', now));

  // the phone, and the name beside whatever names they already have
  stmts.push(q(db, 'INSERT OR IGNORE INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES (?, ?, 1, 1, ?)', phone, personId, now));
  stmts.push(q(db, `INSERT INTO person_names (person_id, name, kind, is_current, added_at)
                    SELECT ?, ?, 'given', ?, ? WHERE NOT EXISTS (SELECT 1 FROM person_names WHERE person_id = ? AND lower(name) = lower(?))`,
    personId, name, created ? 1 : 0, now, personId, name));

  // and the link the app reads back
  stmts.push(q(db, "INSERT OR IGNORE INTO person_links (service, account_ref, person_id, linked_at) VALUES ('sadhana', ?, ?, ?)", login, personId, now));
  stmts.push(dirty(db, 'persons', 'person_identifiers', 'person_names', 'person_phones', 'person_links'));
  return { stmts, personId, created };
}
