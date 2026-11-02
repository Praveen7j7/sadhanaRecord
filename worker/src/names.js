// One name, one place (Phase 24, the head, 27 Oct 2026; docs/NAMES_ONE_SOURCE_2026-10-27.md).
//
// A name is stored ONCE, on the person or the facilitator it belongs to. Everything else points to that record by a
// permanent id (a login; a facilitator's `F014`) and reads the name from it when it is shown. So a rename is one change
// and every screen, list, picker, post and count follows on its own. History — the audit log, a closed weekly record —
// keeps the name as it was; that is what it is for.
//
// renamePerson is the ONE way a name changes. profile.update (one's own name), the head's coordinator edit and the
// head's facilitator rename all build their statements here, so a facilitator who IS a login (facilitators.login: a
// facilitator login, an ETP trainee under their own name) is renamed on both sides at once: one person, one name.
import { invalid, isoIst, cleanName, validName } from './util.js';
import { q, reads } from './db.js';

/** SQL: the facilitator id for a name, any spelling it has had (one bound parameter); NULL when it is nobody's
 *  (the id columns are foreign keys to facilitators(id): "no facilitator" is NULL, never '', ADR 0021). */
export const FAC_ID_OF = `(SELECT fac_id FROM facilitator_names WHERE "name" = ?)`;
/** The id of the facilitator the CALLER is (their own login's), or ''. Read with the session's account row. */
export const myFacId = ctx => String(ctx.acct?.fac_id || '');

// the person record(s) of a login (one bound parameter)
const PERSON_OF = "SELECT person_id FROM person_links WHERE service = 'sadhana' AND account_ref = ?";

/**
 * Why `name` cannot be facilitator `facId`'s name, or ''. A name another facilitator holds — or once held, so that an
 * old link or record still finds them — is taken. A facilitator's OWN earlier spelling may be taken back (a typo undone).
 */
function clashOf(row, name) {
  if (!row) return '';
  return row.to_at ? `${name} was an earlier name of ${row.now_name || 'another facilitator'}; choose another name.`
                   : `${row.now_name || name} is already on the list.`;
}
const CLASH = `SELECT n."name", n.fac_id, n.to_at, f."name" AS now_name FROM facilitator_names n LEFT JOIN facilitators f ON f.id = n.fac_id
                WHERE lower(n."name") = lower(?) AND n.fac_id <> ? LIMIT 1`;

/**
 * The statements that rename a person and/or the facilitator they are, everywhere it is stored ONCE; plus, for one
 * release, the name copies older code reads (memberships.facilitator of open rows, accounts.facilitator_name,
 * accounts.requested_facilitator of waiting sign-ups), so a rollback of the code still shows the right name.
 *
 *   who: { login } — a person's own account (profile.update, the coordinator edit); the facilitator they are follows
 *        { fac }   — a facilitator row (facilitators.rename); the login that IS them follows
 * Returns { stmts, name, login, fac, old } or throws a field error on `path`. Reads (one round trip) only what it needs.
 */
export async function renamePerson(db, ctx, who, newName, { path = 'name', at = isoIst(ctx.now()) } = {}) {
  const name = cleanName(newName);
  if (!validName(name)) throw invalid({ path, message: 'Letters, spaces, dots and apostrophes, 3 to 60 characters.' });
  let fac = who.fac || null, login = who.login || '', acct = null, clash = null;
  // the other side of the person, and whether the name is free — together, in one round trip
  const want = [];
  if (!fac && login) want.push(['fac', q(db, `SELECT * FROM facilitators WHERE login = ? ORDER BY deleted_at = '' DESC LIMIT 1`, login)]);
  if (fac && fac.login) { login = fac.login; want.push(['acct', q(db, 'SELECT login, name FROM accounts WHERE login = ?', login)]); }
  else if (login) want.push(['acct', q(db, 'SELECT login, name FROM accounts WHERE login = ?', login)]);
  if (fac && name !== fac.name) want.push(['clash', q(db, CLASH, name, fac.id)]);
  const got = Object.fromEntries((await reads(db, want.map(w => w[1]))).map((r, i) => [want[i][0], r]));
  if (!fac && got.fac) fac = got.fac;
  acct = got.acct || null;
  if (acct === null) login = '';                                   // a facilitator whose linked login is gone
  // a person who is a facilitator: is the name free on the list? (a second read only then — a rare write)
  clash = 'clash' in got ? got.clash : fac && name !== fac.name ? (await reads(db, [q(db, CLASH, name, fac.id)]))[0] : null;
  const why = clashOf(clash, name);
  if (why) throw invalid({ path, message: why });
  const stmts = [], by = ctx.login || 'SYSTEM';
  if (fac && name !== fac.name) {
    // the one row (its trigger keeps the spellings: the new one current, the old one kept and still resolving)
    stmts.push(q(db, `UPDATE facilitators SET "name" = ?, source = 'APP', changed_by = ?, changed_at = ? WHERE id = ?`, name, by, at, fac.id),
      // the copies, for one release only (step 5 of the plan stops writing them after a clean week)
      q(db, "UPDATE memberships SET facilitator = ? WHERE fac_id = ? AND to_week = ''", name, fac.id),
      q(db, 'UPDATE accounts SET facilitator_name = ?, updated_at = ?, updated_by = ? WHERE fac_id = ?', name, at, by, fac.id),
      q(db, "UPDATE accounts SET requested_facilitator = ? WHERE requested_fac_id = ? AND status = 'PENDING'", name, fac.id));
  }
  if (login && acct && name !== acct.name) {
    stmts.push(q(db, 'UPDATE accounts SET name = ?, updated_at = ?, updated_by = ? WHERE login = ?', name, at, by, login),
      q(db, 'UPDATE profiles SET name = ? WHERE login = ?', name, login),
      // the identity record: its shown name, and the name added to the person's names (never replacing the old one)
      q(db, `UPDATE persons SET display_name = ?, updated_at = ? WHERE id IN (${PERSON_OF}) AND merged_into = ''`, name, at, login),
      q(db, `UPDATE person_names SET is_current = 0 WHERE is_current = 1 AND "name" <> ? AND person_id IN (${PERSON_OF})`, name, login),
      q(db, `INSERT INTO person_names (person_id, "name", kind, is_current, from_at, added_at)
             SELECT l.person_id, ?, 'given', 1, ?, ? FROM person_links l WHERE l.service = 'sadhana' AND l.account_ref = ?
                AND NOT EXISTS (SELECT 1 FROM person_names n WHERE n.person_id = l.person_id AND n."name" = ?)`, name, at, at, login, name),
      q(db, `UPDATE person_names SET is_current = 1 WHERE is_current = 0 AND id IN (
               SELECT MIN(n.id) FROM person_names n WHERE n."name" = ? AND n.person_id IN (${PERSON_OF}) GROUP BY n.person_id)
               AND NOT EXISTS (SELECT 1 FROM person_names c WHERE c.person_id = person_names.person_id AND c.is_current = 1)`, name, login));
  }
  return { stmts, name, login, fac, old: { person: acct?.name ?? null, facilitator: fac?.name ?? null } };
}
