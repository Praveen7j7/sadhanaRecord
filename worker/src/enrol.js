// Enrolling existing devotees in a training (the head, 17 Oct 2026).
//
// "Students get added who are already the member of the app" — an ETP coordinator searches IYF for a
// devotee by name or phone and adds them. Nobody signs up INTO a training.
//
// An enrolment is NOT a membership. A membership is the batch whose weekly form somebody fills, and
// currentMembership() takes one row; a second would make the app guess which batch a devotee is in.
// An ETP student keeps filling their SPS or DPS week exactly as before — the training adds a target
// card, not a different week. So this stacks on who they already are, the way being a group leader
// or a facilitator does.
import { q, one, all, audit, dirty } from './db.js';
import { FAC_ID_OF } from './names.js';
import { apiError, invalid, isoIst, cleanName, mondayOf } from './util.js';
import { requireBatch } from './requests.js';
import { vedicLevel } from './closing.js';

/** A training batch, and nothing else: only these enrol people (ETP today). */
async function trainingBatch(db, batchId) {
  const b = await one(db, 'SELECT batch_id, name, closed_at FROM batches WHERE batch_id = ?', String(batchId || ''));
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  if (vedicLevel(batchId) !== 'ETP') throw apiError('CONFLICT', `${b.name} is not a training batch; its members join it at sign-up.`);
  return b;
}

/**
 * Search IYF for somebody to enrol: by name or by phone, across every batch.
 *
 * Deliberately NOT narrowed to the coordinator's own batches — a training draws from the whole of
 * IYF, which is the point of enrolling rather than signing up. What it will not show is somebody
 * already enrolled in this training, so the same person cannot be added twice by two people.
 */
export async function enrolSearch(d, ctx) {
  const db = ctx.db, batchId = String(d.batchId || '');
  await requireBatch(ctx, batchId);
  await trainingBatch(db, batchId);
  const raw = String(d.q || '').trim();
  if (raw.length < 2) throw invalid({ path: 'q', message: 'Type at least two characters.' });
  const like = '%' + raw.toLowerCase() + '%';
  // An IYF id is searchable too (the head, 18 Oct 2026): the results PRINT it, so a coordinator
  // reasonably types it back in. It is matched whole-string, and a term that looks like an id is
  // NOT also reduced to digits — 'IYFD-2016-0003' would strip to '20160003' and match a phone
  // number belonging to somebody else entirely.
  const looksLikeId = /[A-Za-z]/.test(raw) && /\d/.test(raw) && raw.includes('-');
  const digits = looksLikeId ? '' : raw.replace(/\D/g, '');
  const idLike = '%' + raw.toLowerCase().trim() + '%';
  const rows = await all(db, `
    SELECT a.login, a.name, a.iyf_id, a.facilitator_name, m.batch_id
      FROM accounts a
      LEFT JOIN memberships m ON m.login = a.login AND m.to_week = '' AND m.state = 'ACTIVE'
     WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
       AND (lower(a.name) LIKE ?1
            OR (?2 <> '' AND a.login LIKE ?3)
            OR (a.iyf_id IS NOT NULL AND a.iyf_id <> '' AND lower(a.iyf_id) LIKE ?5))
       AND NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.login = a.login AND e.batch_id = ?4 AND e.state = 'ACTIVE')
     ORDER BY a.name LIMIT 20`, like, digits, '%' + digits + '%', batchId, idLike);
  return { people: rows.map(r => ({ login: r.login, name: r.name, iyfId: r.iyf_id || '', batchId: r.batch_id || '' })) };
}

/** Everyone enrolled in a training, with the batch each of them actually belongs to. */
export async function enrolList(d, ctx) {
  const db = ctx.db, batchId = String(d.batchId || '');
  await requireBatch(ctx, batchId);
  const b = await trainingBatch(db, batchId);
  const rows = await all(db, `
    SELECT e.login, e.from_week, e.added_at, a.name, a.iyf_id, m.batch_id
      FROM enrolments e
      JOIN accounts a ON a.login = e.login
      LEFT JOIN memberships m ON m.login = e.login AND m.to_week = '' AND m.state = 'ACTIVE'
     WHERE e.batch_id = ? AND e.state = 'ACTIVE' ORDER BY a.name`, batchId);
  return { batchId, name: b.name, closed: !!b.closed_at,
           students: rows.map(r => ({ login: r.login, name: r.name, iyfId: r.iyf_id || '',
                                      batchId: r.batch_id || '', fromWeek: r.from_week, addedAt: r.added_at })) };
}

/** Add one devotee to the training. Their own batch is untouched. */
export async function enrolAdd(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), batchId = String(d.batchId || ''), login = String(d.login || '');
  await requireBatch(ctx, batchId);
  const b = await trainingBatch(db, batchId);
  if (b.closed_at) throw apiError('CONFLICT', `${b.name} is finished; it takes no more students.`);
  // facilitator_name is read so an existing facilitator is recognised (until 22 Oct it was not selected, so `already`
  // was always false: enrolling a facilitator overwrote their facilitator name with their account name)
  const a = await one(db, "SELECT login, name, status, role, facilitator_name FROM accounts WHERE login = ?", login);
  if (!a || a.role !== 'DEVOTEE') throw apiError('NOT_FOUND', 'No devotee with that login.');
  if (a.status !== 'ACTIVE') throw apiError('CONFLICT', `${a.name} is not active.`);
  if (await one(db, "SELECT 1 AS x FROM enrolments WHERE login = ? AND batch_id = ? AND state = 'ACTIVE'", login, batchId)) {
    throw apiError('CONFLICT', `${a.name} is already in this training.`);
  }
  const week = mondayOf(ctx.now());
  /*
   * A TRAINEE FACILITATES FROM DAY ONE (the head, 17 Oct 2026).
   *
   * Their card asks them to report "Sunday VL-1 facilitation attendance" and "one-to-one meetings
   * with devotees" — they cannot report either without students, and the whole point of the
   * training is that they are learning by doing it. So enrolling grants the facilitator scope, and
   * they see My students in the same shape a facilitator does.
   *
   * facilitator_name is what grants it (db.js scopesOf), and their name joins the list devotees pick
   * from, so a coordinator can assign students to them. Qualifying at closing then only makes
   * permanent what they already held, rather than granting it for the first time.
   */
  const already = !!a.facilitator_name;
  await db.batch([
    q(db, `INSERT INTO enrolments (batch_id, login, state, from_week, added_by, added_at)
           VALUES (?, ?, 'ACTIVE', ?, ?, ?)`, batchId, login, week, ctx.login, at),
    ...(already ? [] : [
      q(db, `INSERT OR IGNORE INTO facilitators ("name", "in_cohort", "order")
             VALUES (?, 1, (SELECT COALESCE(MAX("order"), 0) + 1 FROM facilitators))`, a.name),
      // temporary (ADR 0010): taken back when the training ends for them, unless the head makes it lasting first. The
      // facilitator's id beside the name (Phase 24); under their own name they ARE that facilitator (facilitators.login,
      // set by the database), so a rename of either is a rename of both
      q(db, `UPDATE accounts SET facilitator_name = ?, fac_id = ${FAC_ID_OF}, facilitation = 'temporary', updated_at = ?, updated_by = ? WHERE login = ?`,
        a.name, a.name, at, ctx.login, login)]),
    audit(db, ctx, 'enrol.add', login, batchId, null,
      { batchId, fromWeek: week, ...(already ? {} : { facilitator: a.name }) }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'enrolments', 'accounts', 'facilitators', 'audit_log')]);
  return { login, name: a.name, batchId, fromWeek: week, facilitator: a.name };
}

/** Take somebody out of a training. Their own batch is untouched; the enrolment is ended, not deleted. */
export async function enrolRemove(d, ctx, req) {
  const db = ctx.db, at = isoIst(ctx.now()), batchId = String(d.batchId || ''), login = String(d.login || '');
  await requireBatch(ctx, batchId);
  await trainingBatch(db, batchId);
  const e = await one(db, "SELECT id FROM enrolments WHERE login = ? AND batch_id = ? AND state = 'ACTIVE'", login, batchId);
  if (!e) throw apiError('NOT_FOUND', 'They are not in this training.');
  await db.batch([
    // ended, never deleted: what they filled during the training stays readable afterwards
    q(db, "UPDATE enrolments SET state = 'ENDED', to_week = ?, ended_by = ?, ended_at = ?, reason = ? WHERE id = ?",
      mondayOf(ctx.now()), ctx.login, at, cleanName(d.reason || ''), e.id),
    ...takeBack(db, ctx, login, at),
    audit(db, ctx, 'enrol.remove', login, batchId, { state: 'ACTIVE' }, { state: 'ENDED' }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'enrolments', 'accounts', 'facilitators', 'audit_log')]);
  return { login, batchId, state: 'ENDED' };
}

/**
 * Take back the facilitation a training granted (ADR 0010): when the training ends for somebody — removed, or the
 * batch closed whatever the decision — and it was TEMPORARY and they are in no other running training, their
 * facilitator scope goes and their name is switched off the pick list. Their students then appear on the head's
 * "Needs a new facilitator" list (ADR 0014 D); nobody is reassigned automatically.
 *
 * Statements only, conditions in SQL: run AFTER the enrolment is ended, in the same batch, with no extra read. A
 * lasting facilitator — everyone who facilitated before ETP, or made lasting by the head — is untouched.
 */
export function takeBack(db, ctx, login, at) {
  const temporary = `EXISTS (SELECT 1 FROM accounts t WHERE t.login = ? AND t.facilitation = 'temporary')
                     AND NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.login = ? AND e.state = 'ACTIVE')`;
  return [
    q(db, `UPDATE facilitators SET active = 0, changed_by = ?, changed_at = ?
            WHERE id = (SELECT fac_id FROM accounts WHERE login = ? AND fac_id IS NOT NULL) AND ${temporary}
              AND NOT EXISTS (SELECT 1 FROM accounts o WHERE o.fac_id = facilitators.id AND o.login <> ? AND o.status = 'ACTIVE')`,
      ctx.login, at, login, login, login, login),
    q(db, `UPDATE accounts SET facilitator_name = '', fac_id = NULL, facilitation = '', updated_at = ?, updated_by = ?
            WHERE login = ? AND facilitation = 'temporary' AND NOT EXISTS (SELECT 1 FROM enrolments e WHERE e.login = ? AND e.state = 'ACTIVE')`,
      at, ctx.login, login, login)];
}

/** The training somebody is currently enrolled in, if any — what gives them the ETP card. */
export async function trainingOf(db, login) {
  return one(db, `SELECT e.batch_id, e.from_week, b.name, b.started_on, b.closed_at
                    FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id
                   WHERE e.login = ? AND e.state = 'ACTIVE' ORDER BY e.id DESC LIMIT 1`, login);
}
