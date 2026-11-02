// The facilitator list (decision 33: picked from the list, never typed), managed by the master (the head, 3 Oct 2026).
// Only names switched on (and not deleted) are offered at sign-up, at approval and in a devotee's edit; all three read
// the same rows, so a change shows everywhere at once. The list is the app's own (the head, 27 Oct 2026): nothing
// outside it adds, removes or renames a facilitator.
//
// Each facilitator has a permanent id (Phase 24, migration 0074); memberships, accounts and posts point to it, and the
// name is read from this row when shown (src/names.js). Every spelling it has had stays in facilitator_names.
import { apiError, invalid, isoIst, cleanName, validName } from './util.js';
import { q, one, all, audit, dirty } from './db.js';
import { renamePerson } from './names.js';

export const OFFERED = `active = 1 AND deleted_at = ''`;

/** Is this name on the list and switched on? (sign-up, approval, a devotee's edit) */
export async function isOffered(db, name) {
  return !!(await one(db, `SELECT 1 FROM facilitators WHERE "name" = ? AND ${OFFERED}`, String(name ?? '')));
}
export async function offeredNames(db) {
  return (await all(db, `SELECT "name" FROM facilitators WHERE ${OFFERED} ORDER BY "order", "name"`)).map(f => f.name);
}

// (`inDashboard` is gone with the dashboard, 27 Oct 2026: the list is the app's own)
const view = (f, used) => ({
  name: f.name, active: !!f.active, source: f.source,
  // an ETP trainee facilitating for the length of their training (ADR 0010); the head may make it lasting
  temporary: !!used.temporary?.[f.id], login: used.logins?.[f.id] || '',
  members: used.members[f.id] || 0, waiting: used.waiting[f.id] || 0, changedBy: f.changed_by || '', changedAt: f.changed_at || ''
});
// counted by the facilitator's id, so a student or a sign-up counts for the facilitator whatever the spelling it was made under
async function usage(db) {
  const [m, w, t] = await Promise.all([
    all(db, `SELECT m.fac_id AS id, COUNT(*) AS n FROM memberships m JOIN accounts a ON a.login = m.login
             WHERE m.to_week = '' AND a.status IN ('ACTIVE', 'INACTIVE') GROUP BY m.fac_id`),
    all(db, "SELECT requested_fac_id AS id, COUNT(*) AS n FROM accounts WHERE status = 'PENDING' GROUP BY requested_fac_id"),
    all(db, "SELECT fac_id AS id, login, facilitation FROM accounts WHERE fac_id IS NOT NULL AND status = 'ACTIVE'")]);
  return { members: Object.fromEntries(m.map(r => [r.id, r.n])), waiting: Object.fromEntries(w.map(r => [r.id, r.n])),
           temporary: Object.fromEntries(t.filter(r => r.facilitation === 'temporary').map(r => [r.id, true])),
           logins: Object.fromEntries(t.map(r => [r.id, r.login])) };
}

export async function list(d, ctx) {
  const [rows, used] = await Promise.all([all(ctx.db, `SELECT * FROM facilitators WHERE deleted_at = '' ORDER BY "order", "name"`), usage(ctx.db)]);
  const out = rows.map(f => view(f, used));
  return { facilitators: out, counts: { on: out.filter(f => f.active).length, off: out.filter(f => !f.active).length } };
}

async function current(db, name) {
  const f = await one(db, `SELECT * FROM facilitators WHERE "name" = ? AND deleted_at = ''`, String(name ?? ''));
  if (!f) throw apiError('NOT_FOUND', 'No facilitator ' + name + ' on the list.');
  return f;
}
async function fresh(db, name) { return view(await one(db, 'SELECT * FROM facilitators WHERE "name" = ?', name), await usage(db)); }

/** Adds a name (Title Case as typed, "Prabhuji" kept as written). A deleted name comes back switched on. */
export async function add(d, ctx, req) {
  const db = ctx.db, name = cleanName(d.name);
  // the shared rule (13 Oct 2026, audit F17): this was a third copy of a name regex, ASCII-only, so a facilitator
  // whose name carries a diacritic or Devanagari could not be added to the list devotees must pick from.
  if (name.length < 3 || !validName(name)) throw invalid({ path: 'name', message: 'Letters, spaces, dots and apostrophes, 3 to 60 characters.' });
  const same = await one(db, `SELECT * FROM facilitators WHERE lower("name") = lower(?)`, name);
  const at = isoIst(ctx.now());
  if (same && !same.deleted_at) throw invalid({ path: 'name', message: `${same.name} is already on the list${same.active ? '' : ' (switched off)'}.` });
  // an earlier spelling of a facilitator still finds them (old links, older records): it is not a new person's name
  const was = same ? null : await one(db, `SELECT f."name" FROM facilitator_names n JOIN facilitators f ON f.id = n.fac_id WHERE lower(n."name") = lower(?) AND n.to_at <> ''`, name);
  if (was) throw invalid({ path: 'name', message: `${name} was an earlier name of ${was.name}; choose another name.` });
  if (same) {
    await db.batch([q(db, `UPDATE facilitators SET active = 1, deleted_at = '', changed_by = ?, changed_at = ? WHERE "name" = ?`, ctx.login, at, same.name),
      audit(db, ctx, 'facilitators.add', same.name, '', { deleted: true }, { active: true }, '', req.requestId), dirty(db, 'facilitators', 'audit_log')]);
    return fresh(db, same.name);
  }
  await db.batch([q(db, `INSERT INTO facilitators ("name", "in_cohort", "order", active, source, seen, changed_by, changed_at)
                         VALUES (?, 0, (SELECT COALESCE(MAX("order"), 0) + 1 FROM facilitators), 1, 'APP', 0, ?, ?)`, name, ctx.login, at),
    audit(db, ctx, 'facilitators.add', name, '', null, { active: true, source: 'APP' }, '', req.requestId), dirty(db, 'facilitators', 'audit_log')]);
  return fresh(db, name);
}

/** Switches a name on or off. Off: no longer offered anywhere; devotees who have it keep it. */
export async function setActive(d, ctx, req) {
  const db = ctx.db, f = await current(db, d.name), on = !!d.active;
  if (!!f.active === on) return fresh(db, f.name);
  await db.batch([q(db, 'UPDATE facilitators SET active = ?, changed_by = ?, changed_at = ? WHERE "name" = ?', on ? 1 : 0, ctx.login, isoIst(ctx.now()), f.name),
    audit(db, ctx, 'facilitators.setActive', f.name, '', { active: !!f.active }, { active: on }, '', req.requestId), dirty(db, 'facilitators', 'audit_log')]);
  return fresh(db, f.name);
}

/** Deletes a switched-off name from the list (kept as a deleted row: its id is never reused, and old records still name it). */
export async function remove(d, ctx, req) {
  const db = ctx.db, f = await current(db, d.name);
  if (f.active) throw apiError('CONFLICT', 'Switch ' + f.name + ' off first; only a switched-off facilitator can be deleted.');
  await db.batch([q(db, 'UPDATE facilitators SET deleted_at = ?, changed_by = ? WHERE "name" = ?', isoIst(ctx.now()), ctx.login, f.name),
    audit(db, ctx, 'facilitators.delete', f.name, '', { active: false, source: f.source }, null, String(d.reason || ''), req.requestId), dirty(db, 'facilitators', 'audit_log')]);
  return { name: f.name, deleted: true };
}

/**
 * Rename a facilitator (ADR 0014 A; one name, one place, Phase 24). The name lives on ONE row; memberships (open and
 * closed), the login that is this facilitator, waiting sign-ups and posts to "my students" point to it by id, so the
 * rename is that row, plus the old spelling kept in facilitator_names so it still resolves. A login that IS this
 * facilitator takes the name too, through renamePerson (one person, one name). Audited old → new; the audit log and
 * closed records keep the name as it was. `moved` says what follows the new name (counted by id).
 */
export async function rename(d, ctx, req) {
  const db = ctx.db, f = await current(db, d.name), name = cleanName(d.newName);
  if (name.length < 3 || !validName(name)) throw invalid({ path: 'newName', message: 'Letters, spaces, dots and apostrophes, 3 to 60 characters.' });
  if (name === f.name) throw invalid({ path: 'newName', message: 'That is the name it has now.' });
  const clash = await one(db, `SELECT "name", deleted_at FROM facilitators WHERE lower("name") = lower(?) AND id <> ?`, name, f.id);
  if (clash) throw invalid({ path: 'newName', message: clash.deleted_at ? `${clash.name} was a facilitator once and was removed; choose another name.` : `${clash.name} is already on the list.` });
  const at = isoIst(ctx.now()), old = f.name;
  const [plan, members, logins, waiting] = await Promise.all([
    renamePerson(db, ctx, { fac: f }, name, { path: 'newName', at }),
    one(db, "SELECT COUNT(*) AS n FROM memberships WHERE fac_id = ? AND to_week = ''", f.id),
    one(db, 'SELECT COUNT(*) AS n FROM accounts WHERE fac_id = ?', f.id),
    one(db, "SELECT COUNT(*) AS n FROM accounts WHERE requested_fac_id = ? AND status = 'PENDING'", f.id)]);
  const moved = { students: members?.n || 0, logins: logins?.n || 0, waiting: waiting?.n || 0 };
  await db.batch([...plan.stmts,
    audit(db, ctx, 'facilitators.rename', name, '', { name: old }, { name, id: f.id, ...moved, ...(plan.login ? { login: plan.login } : {}) }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'facilitators', 'memberships', 'accounts', 'audit_log')]);
  return { ...(await fresh(db, name)), was: old, moved };
}

/**
 * Students who need a new facilitator (ADR 0014 D): active devotees whose facilitator is no longer facilitating —
 * switched off, removed, or a trainee whose temporary facilitation was taken back. Derived, never stored: assigning a
 * new facilitator (devotees.setPeople) or marking them inactive (devotees.setActive) takes them off the list at once,
 * and the old name stays on their record until then, so nothing is silently rewritten.
 */
export async function orphans(d, ctx) {
  // by id; the name shown is the facilitator's as it is now (a membership that names nobody on the list keeps its text)
  const [rows, offered] = await Promise.all([
    all(ctx.db, `SELECT a.login, a.name, a.iyf_id, m.batch_id, b.name AS batch_name, COALESCE(f."name", m.facilitator) AS facilitator, m.from_week
                   FROM memberships m JOIN accounts a ON a.login = m.login JOIN batches b ON b.batch_id = m.batch_id
                   LEFT JOIN facilitators f ON f.id = m.fac_id
                  WHERE m.to_week = '' AND m.state = 'ACTIVE' AND a.status = 'ACTIVE' AND a.role = 'DEVOTEE' AND m.facilitator <> ''
                    AND (m.fac_id IS NULL OR m.fac_id NOT IN (SELECT id FROM facilitators WHERE ${OFFERED} AND id IS NOT NULL))
                  ORDER BY 6, a.name`),
    offeredNames(ctx.db)]);
  return { students: rows.map(r => ({ login: r.login, name: r.name, iyfId: r.iyf_id || '', batchId: r.batch_id, batchName: r.batch_name,
                                      facilitator: r.facilitator, since: r.from_week })),
           facilitators: offered };
}

/**
 * Make a trainee's facilitation lasting (ADR 0014 C): what FTP will grant, done by the head by name until FTP exists on
 * live. After this, the end of their training no longer takes it back. Audited, with the reason.
 */
export async function setLasting(d, ctx, req) {
  const db = ctx.db, f = await current(db, d.name);
  const a = await one(db, "SELECT login, facilitation FROM accounts WHERE fac_id = ? AND status = 'ACTIVE'", f.id);
  if (!a) throw apiError('NOT_FOUND', `${f.name} has no account facilitating under that name.`);
  if (a.facilitation === 'lasting') return fresh(db, f.name);
  const at = isoIst(ctx.now());
  await db.batch([q(db, "UPDATE accounts SET facilitation = 'lasting', updated_at = ?, updated_by = ? WHERE login = ?", at, ctx.login, a.login),
    audit(db, ctx, 'facilitators.setLasting', a.login, '', { facilitation: a.facilitation || 'temporary' }, { facilitation: 'lasting', name: f.name },
      cleanName(d.reason || ''), req.requestId),
    dirty(db, 'accounts', 'audit_log')]);
  return fresh(db, f.name);
}
