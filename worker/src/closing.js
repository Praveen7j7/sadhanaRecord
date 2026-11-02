// Closing a Vedic intake, and deciding where each devotee goes (ADR 0009, the head, 16 Oct 2026).
//
// VL-2 and VL-3 run as numbered intakes of about three months. The run ends WHEN THE COORDINATOR
// SAYS SO — three months is the shape of it, not a rule the app enforces, because a batch slips by
// a few weeks for festivals, exams and everything else that happens to real people.
//
// Closing is where promotion happens, and it is the only place in the app that moves somebody from
// one batch to another. Every devotee leaves with a decision a person took:
//
//   promoted  → their membership of this intake ends and a new one opens in the next batch
//   repeat    → they stay as they are, to be added to the next intake by hand
//   left      → their membership ends and they become inactive
//
// Nothing is decided automatically, and a closing cannot be half done: the whole batch is settled in
// one call, or none of it is.
import { apiError, invalid, isoIst, cleanName } from './util.js';
import { q, one, all, audit, dirty, batchesAll, reads, rows } from './db.js';
import { requireBatch } from './requests.js';
import { boardRows } from './board.js';
import { addDays } from './weeks.js';
import { startWeek } from './devotees.js';
import { endSessions } from './session.js';
import { managed } from './staff.js';
import { takeBack } from './enrol.js';

/**
 * The numbered-intake series a batch id belongs to: VL2, VL3 or ETP. Null for everything that runs
 * with no fixed duration (SPS and after), which is never numbered and never closed.
 *
 * A training batch is numbered the same way IYF numbers the others — "ETP batch 51" is ETP-51 (the
 * head, 17 Oct 2026) — and runs about three months OR MORE: the coordinator closes it when the
 * training is done, which is what closing has always been here.
 */
export const vedicLevel = id => (String(id || '').match(/^(VL[23]|ETP)-\d{1,4}$/) || [])[1] || null;

const DECISIONS = ['promoted', 'qualified', 'repeat', 'left'];

/*
 * 'qualified' is the ETP decision, and it is a different VERB from 'promoted' (the head, 17 Oct 2026).
 *
 * An ETP student never left their own batch — they are an SPS or DPS devotee who is also in training.
 * Finishing does not MOVE them anywhere; it makes them count among the facilitators. So their ETP
 * section disappears and the facilitator one appears, and their batch is untouched.
 *
 *   promoted   a devotee MOVES from one batch to the next   (VL-2 → VL-3 → SPS → …)
 *   qualified  a trainee GAINS the facilitator scope        (ETP; nobody changes batch)
 *
 * Keeping the two apart matters: a promotion closes a membership and opens another, while this
 * closes only the training and adds a role somebody now holds.
 */

/*
 * WHERE SOMEBODY MAY BE PROMOTED TO (the head, 16 Oct 2026).
 *
 * The journey is VL-1 → VL-2 → VL-3 → SPS → DPS → BSS or BVS, with two sideways moves the head
 * described: SPS → BVS directly, and BSS → BVS. BVS is for those who will marry; BSS is for those
 * aspiring to brahmachari life, which is why the move runs that way and not back.
 *
 * Before this, closing offered EVERY open batch, so one mis-tap could send a VL-2 devotee straight
 * into BSS — a jump of four levels, with no sign anything odd had happened.
 *
 * A coordinator is held to the ladder. The head is not: a real journey sometimes skips a step for
 * reasons the app has no way to know, and the head is the person who carries that judgement. An
 * off-ladder move by the head is recorded as one (`offLadder` in the audit), so it can be found
 * later rather than quietly becoming the new normal.
 */
const LADDER = {
  VL2: ['VL3'],
  VL3: ['SPS'],
  SPS: ['DPS', 'BVS'],          // BVS directly: those who will marry
  DPS: ['BSS', 'BVS'],
  BSS: ['BVS'],                 // a brahmachari aspirant who will marry instead
  BVS: []                       // BVS is the end of the ladder
};
/** The levels somebody in `level` may be promoted to. An unknown level has no ladder, so nothing is offered. */
export const nextLevels = level => LADDER[String(level || '').toUpperCase()] || [];

/**
 * Who is in this intake and what has to be decided about them.
 *
 * Shown before anything is closed, so the coordinator sees the whole list and how many weeks each
 * person actually attended — the number the promotion decision rests on.
 */
export async function closingPreview(d, ctx) {
  await requireBatch(ctx, d.batchId);
  const db = ctx.db, batchId = String(d.batchId);
  const b = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', batchId);
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  if (!vedicLevel(batchId)) throw apiError('CONFLICT', `${b.name} runs with no fixed duration, so it is never closed.`);
  if (b.closed_at) throw apiError('CONFLICT', `${b.name} was already closed on ${b.closed_at.slice(0, 10)}.`);

  /*
   * Who is in this batch: a TRAINING holds enrolments, every other batch holds memberships (the
   * head, 17 Oct 2026). An ETP student never left their own batch, so there is no membership of the
   * training to read.
   */
  const training = vedicLevel(batchId) === 'ETP';
  const members = training
    ? await all(db, `SELECT e.login, a.name, e.from_week FROM enrolments e JOIN accounts a ON a.login = e.login
                      WHERE e.batch_id = ? AND e.state = 'ACTIVE' ORDER BY a.name`, batchId)
    : await all(db, `SELECT m.login, a.name, m.from_week
                       FROM memberships m JOIN accounts a ON a.login = m.login
                      WHERE m.batch_id = ? AND m.to_week = '' AND m.state = 'ACTIVE'
                      ORDER BY a.name`, batchId);
  // how many weeks each was actually present: one keyed count per person, not a scan of the table
  const out = [];
  // A training's class is marked in its OWN table (training_attendance, migration 0057): a trainee is marked in
  // their own batch's `attendance` the same week, under that batch's id. Reading `attendance` for a training found
  // nothing, so every trainee showed 0 weeks present at closing (18 Oct 2026).
  // Everyone's count in ONE round trip (22 Oct 2026, G6: it was one per member, 629 at 625): the same keyed count,
  // grouped by login, the IN list in chunks of 90 (D1 binds at most 100). Somebody never present has no row: 0.
  const presentSql = (marks) => training
    ? `SELECT login, COUNT(*) AS n FROM training_attendance WHERE login IN (${marks}) AND batch_id = ? AND mark = 'P' GROUP BY login`
    : `SELECT login, COUNT(*) AS n FROM attendance WHERE login IN (${marks}) AND batch_id = ? AND mark_used = 'P' GROUP BY login`;
  const stmts = [];
  for (let i = 0; i < members.length; i += 90) {
    const part = members.slice(i, i + 90).map(m => m.login);
    stmts.push(rows(q(db, presentSql(part.map(() => '?').join(',')), ...part, batchId)));
  }
  const present = new Map((await reads(db, stmts)).flat().map(r => [r.login, r.n]));
  for (const m of members) out.push({ login: m.login, name: m.name, fromWeek: m.from_week, present: present.get(m.login) || 0 });
  // only the batches this level may move up to. The head sees the others too, marked offLadder, so
  // they can make the judgement the ladder cannot — a coordinator is not offered them at all.
  const allowed = nextLevels(b.level);
  const open = (await batchesAll(db)).filter(x => x.active && !x.closed_at && x.batch_id !== batchId);
  const onLadder = open.filter(x => allowed.includes(String(x.level || '').toUpperCase()));
  const nextBatches = (ctx.scopes.master ? open : onLadder)
    .map(x => ({ batchId: x.batch_id, name: x.name, level: x.level,
                 offLadder: !allowed.includes(String(x.level || '').toUpperCase()) }));
  return { batchId, name: b.name, startedOn: b.started_on || '', level: vedicLevel(batchId),
           batchLevel: b.level, nextLevels: allowed, members: out, nextBatches };
}

/**
 * Close the intake, with one decision per devotee.
 *
 * Every active member must appear exactly once: a closing that silently left somebody out would
 * strand them in a batch nobody looks at any more. The whole thing is one batch of statements, so a
 * failure leaves the intake open and nobody moved.
 */
export async function closingClose(d, ctx, req) {
  await requireBatch(ctx, d.batchId);
  const db = ctx.db, now = ctx.now(), at = isoIst(now), batchId = String(d.batchId);
  const b = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', batchId);
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  if (!vedicLevel(batchId)) throw apiError('CONFLICT', `${b.name} runs with no fixed duration, so it is never closed.`);
  if (b.closed_at) throw apiError('CONFLICT', `${b.name} was already closed on ${b.closed_at.slice(0, 10)}.`);
  if (!Array.isArray(d.decisions)) throw invalid({ path: 'decisions', message: 'Decide about each devotee.' });

  // a training's people are enrolled, not members (see closingPreview above)
  const isTraining = vedicLevel(batchId) === 'ETP';
  const members = isTraining
    ? await all(db, `SELECT e.id, e.login, a.iyf_id, '' AS level_entry_date, '' AS class_day, '' AS facilitator, NULL AS fac_id, a.name
                       FROM enrolments e JOIN accounts a ON a.login = e.login
                      WHERE e.batch_id = ? AND e.state = 'ACTIVE'`, batchId)
    : await all(db, `SELECT m.id, m.login, m.iyf_id, m.level_entry_date, m.class_day, m.facilitator, m.fac_id, a.name
                       FROM memberships m JOIN accounts a ON a.login = m.login
                      WHERE m.batch_id = ? AND m.to_week = '' AND m.state = 'ACTIVE'`, batchId);
  const byLogin = new Map(members.map(m => [m.login, m]));
  const seen = new Set();
  const batches = await batchesAll(db);
  const open = new Map(batches.filter(x => x.active && !x.closed_at).map(x => [x.batch_id, x]));
  const allowedLevels = nextLevels(b.level);

  for (const [i, row] of d.decisions.entries()) {
    const login = String(row?.login || '');
    if (!byLogin.has(login)) throw invalid({ path: `decisions.${i}.login`, message: 'Not an active devotee of this batch.' });
    if (seen.has(login)) throw invalid({ path: `decisions.${i}.login`, message: `${byLogin.get(login).name} appears twice.` });
    seen.add(login);
    if (!DECISIONS.includes(row.decision)) throw invalid({ path: `decisions.${i}.decision`, message: 'Promoted, repeat or left.' });
    if (row.decision === 'qualified' && !isTraining) {
      throw invalid({ path: `decisions.${i}.decision`, message: 'Only a training batch has people qualify; choose promoted, repeat or left.' });
    }
    // nobody is promoted out of a training, not even by the head: they never left their own batch, so there is
    // no membership to move (decision 47). The class-batch path below would end the membership whose id equals
    // the ENROLMENT's id — somebody else's batch (18 Oct 2026).
    if (row.decision === 'promoted' && isTraining) {
      throw invalid({ path: `decisions.${i}.decision`, message: 'Nobody is promoted out of a training: choose qualified, repeat or left.' });
    }
    if (row.decision === 'promoted') {
      const to = String(row.toBatch || '');
      if (!open.has(to)) throw invalid({ path: `decisions.${i}.toBatch`, message: 'Choose the batch they move up to.' });
      if (to === batchId) throw invalid({ path: `decisions.${i}.toBatch`, message: 'That is this batch.' });
      // the ladder: a coordinator is held to it, the head may step off it with the move recorded
      const toLevel = String(open.get(to).level || '').toUpperCase();
      if (!allowedLevels.includes(toLevel) && !ctx.scopes.master) {
        throw invalid({ path: `decisions.${i}.toBatch`,
          message: `${byLogin.get(login).name} cannot move from ${b.level} to ${toLevel}. Ask the IYF head.` });
      }
    }
  }
  // nobody may be left undecided: they would stay in a batch that is closed and unwatched
  const missing = members.filter(m => !seen.has(m.login));
  if (missing.length) {
    throw invalid({ path: 'decisions', message: `Decide about ${missing.length === 1 ? missing[0].name : `${missing.length} more devotees`} before closing.` });
  }

  const from = await startWeek(db, now, d.fromWeek), lastWeek = addDays(from, -7), stmts = [];
  for (const row of d.decisions) {
    const m = byLogin.get(String(row.login)), note = cleanName(row.note || '');
    if (row.decision === 'qualified') {
      // their training ends; their batch does not change — they were never in the training as a member, only
      // enrolled. Qualifying no longer GRANTS facilitation (ADR 0010, the head, 22 Oct 2026): the temporary one the
      // training gave them is taken back like everyone else's, and FTP — or, until FTP exists, the head in Admin ›
      // Facilitators — makes it lasting. A head who made them lasting before closing keeps them facilitating.
      stmts.push(q(db, "UPDATE enrolments SET state = 'ENDED', to_week = ?, ended_by = ?, ended_at = ? WHERE id = ?",
        lastWeek, ctx.login, at, m.id));
      stmts.push(...takeBack(db, ctx, m.login, at));
      stmts.push(q(db, `INSERT INTO batch_closings (batch_id, login, decision, to_batch, note, decided_by, decided_at)
                        VALUES (?, ?, 'qualified', '', ?, ?, ?)`, batchId, m.login, note, ctx.login, at));
      continue;
    }
    if (isTraining) {
      // repeat or left a TRAINING: the enrolment ends with it, and nothing else moves. A repeat is enrolled afresh
      // in the next intake; somebody who left the training is still a devotee of their own batch. Before 18 Oct
      // a repeat kept an ACTIVE enrolment in a closed batch (their ETP section never went), and 'left' ran the
      // class-batch path: the wrong membership ended and the account was switched off.
      stmts.push(q(db, "UPDATE enrolments SET state = 'ENDED', to_week = ?, ended_by = ?, ended_at = ? WHERE id = ?",
        lastWeek, ctx.login, at, m.id));
      // and the facilitation the training gave them goes back (ADR 0010)
      stmts.push(...takeBack(db, ctx, m.login, at));
      stmts.push(q(db, `INSERT INTO batch_closings (batch_id, login, decision, to_batch, note, decided_by, decided_at)
                        VALUES (?, ?, ?, '', ?, ?, ?)`, batchId, m.login, row.decision, note, ctx.login, at));
      continue;
    }
    if (row.decision === 'repeat') {
      // nothing moves: they stay where they are and the coordinator adds them to the next intake
      stmts.push(q(db, `INSERT INTO batch_closings (batch_id, login, decision, to_batch, note, decided_by, decided_at)
                        VALUES (?, ?, 'repeat', '', ?, ?, ?)`, batchId, m.login, note, ctx.login, at));
      continue;
    }
    stmts.push(q(db, 'UPDATE memberships SET to_week = ? WHERE id = ?', lastWeek, m.id));
    if (row.decision === 'promoted') {
      stmts.push(q(db, `INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, class_day, facilitator, fac_id, set_by, set_at, reason)
                        VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.login, m.iyf_id || '', String(row.toBatch), from, from, m.class_day, m.facilitator, m.fac_id ?? null, ctx.login, at, `promoted from ${batchId}`));
      stmts.push(q(db, `INSERT INTO batch_closings (batch_id, login, decision, to_batch, note, decided_by, decided_at)
                        VALUES (?, ?, 'promoted', ?, ?, ?, ?)`, batchId, m.login, String(row.toBatch), note, ctx.login, at));
    } else {
      // left: the membership ends and the account goes quiet, the same as making someone inactive
      stmts.push(q(db, "UPDATE accounts SET status = 'INACTIVE', updated_at = ?, updated_by = ? WHERE login = ?", at, ctx.login, m.login));
      stmts.push(endSessions(ctx, m.login, 'left the batch'));
      stmts.push(q(db, `INSERT INTO batch_closings (batch_id, login, decision, to_batch, note, decided_by, decided_at)
                        VALUES (?, ?, 'left', '', ?, ?, ?)`, batchId, m.login, note, ctx.login, at));
    }
  }
  const counts = DECISIONS.reduce((o, k) => ({ ...o, [k]: d.decisions.filter(x => x.decision === k).length }), {});
  // a move the ladder does not allow is findable afterwards, rather than quietly becoming normal
  const offLadder = d.decisions.filter(x => x.decision === 'promoted'
    && !allowedLevels.includes(String(open.get(String(x.toBatch))?.level || '').toUpperCase()))
    .map(x => `${byLogin.get(String(x.login)).name} → ${x.toBatch}`);
  await db.batch([...stmts,
    q(db, 'UPDATE batches SET closed_at = ?, closed_by = ?, updated_at = ?, updated_by = ? WHERE batch_id = ?', at, ctx.login, at, ctx.login, batchId),
    audit(db, ctx, 'batches.close', batchId, batchId, null, { ...counts, fromWeek: from, ...(offLadder.length ? { offLadder } : {}) }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'batches', 'memberships', 'enrolments', 'accounts', 'facilitators', 'batch_closings', 'audit_log')]);
  return { batchId, closedAt: at, ...counts };
}


/**
 * Promote ONE devotee, without closing anything (the head, 16 Oct 2026).
 *
 * SPS, DPS, BSS and BVS run with no fixed duration, so they are never closed — which left them with
 * no way to promote anybody at all: VL-2 and VL-3 could move people up and everything above them
 * could not. A coordinator promotes "as and when they are promoted, based on their sadhana and
 * other factors", one person at a time, when that person is ready.
 *
 * The same ladder as a closing, and the same rule about it: a coordinator is held to it, the head
 * may step off it and the move says so. Their membership of the old batch is closed and a new one
 * opens — nothing is deleted, so the history keeps its answer.
 *
 * It works on a Vedic batch too. Closing is for a whole intake at its end; this is for the one
 * devotee who is ready before the rest.
 */
export async function devoteePromote(d, ctx, req) {
  const db = ctx.db, now = ctx.now(), at = isoIst(now);
  const { a, m, batchId } = await managed(ctx, d.login, { change: true });
  if (!m) throw apiError('CONFLICT', `${a.name} is not in a batch.`);
  if (a.status !== 'ACTIVE') throw apiError('CONFLICT', `${a.name} is not active.`);
  const to = String(d.toBatch || '');
  const from = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', m.batch_id);
  const dest = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', to);
  if (!dest || !dest.active || dest.closed_at) throw invalid({ path: 'toBatch', message: 'Choose the batch they move up to.' });
  if (to === m.batch_id) throw invalid({ path: 'toBatch', message: `${a.name} is already in that batch.` });

  const allowed = nextLevels(from?.level), toLevel = String(dest.level || '').toUpperCase();
  if (!allowed.includes(toLevel) && !ctx.scopes.master) {
    throw invalid({ path: 'toBatch', message: `${a.name} cannot move from ${from?.level} to ${toLevel}. Ask the IYF head.` });
  }
  const offLadder = !allowed.includes(toLevel);
  const week = await startWeek(db, now, d.fromWeek), reason = cleanName(d.reason || '');
  await db.batch([
    q(db, 'UPDATE memberships SET to_week = ? WHERE id = ?', addDays(week, -7), m.id),
    q(db, `INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, class_day, facilitator, fac_id, set_by, set_at, reason)
           VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)`,
      a.login, a.iyf_id || '', to, week, week, m.class_day, m.facilitator, m.fac_id ?? null, ctx.login, at, reason || `promoted from ${m.batch_id}`),
    audit(db, ctx, 'devotees.promote', a.login, batchId, { batchId: m.batch_id, level: from?.level || '' },
      { batchId: to, level: toLevel, fromWeek: week, ...(offLadder ? { offLadder: true } : {}) }, reason, req.requestId),
    dirty(db, 'memberships', 'audit_log')]);
  return { login: a.login, name: a.name, fromBatch: m.batch_id, toBatch: to, fromWeek: week, offLadder };
}

/** Where this devotee may be promoted to, for the screen that offers it. */
export async function promoteOptions(d, ctx) {
  const db = ctx.db, { a, m } = await managed(ctx, d.login);
  if (!m) throw apiError('CONFLICT', `${a.name} is not in a batch.`);
  const from = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', m.batch_id);
  const allowed = nextLevels(from?.level);
  const open = (await batchesAll(db)).filter(x => x.active && !x.closed_at && x.batch_id !== m.batch_id);
  const onLadder = open.filter(x => allowed.includes(String(x.level || '').toUpperCase()));
  return { login: a.login, name: a.name, batchId: m.batch_id, level: from?.level || '', nextLevels: allowed,
           batches: (ctx.scopes.master ? open : onLadder).map(x => ({ batchId: x.batch_id, name: x.name, level: x.level,
             offLadder: !allowed.includes(String(x.level || '').toUpperCase()) })) };
}
