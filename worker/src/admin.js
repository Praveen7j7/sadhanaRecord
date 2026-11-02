// Public meta, and the master's screens: coordinators, batches, IYF ID links (API contract §1, §5).
import { apiError, invalid, isoIst, normPhone, cleanName, validName, validUsername, passwordProblem, csv } from './util.js';
import { hashPassword } from './crypto.js';
import { q, one, all, settings, batchesAll, account, devoteeBatch, audit, dirty } from './db.js';
import { renamePerson } from './names.js';
import { endSessions, sessionCtx } from './session.js';
import { iterations } from './auth.js';
import { offeredNames } from './facilitators.js';
import { registryRows, registryPublic, registrySearchRows, checkIyfId, linkedLogins, ID_PATTERN } from './registry.js';
import { personView, resolve, issueForAccount, previewId } from './identity.js';
import { vedicLevel } from './closing.js';
import { fulfilling } from './batchreq.js';

/** Names of the people listed as coordinators of these batches, looked up by login (the primary key): a few rows
 *  read, never a scan of every account (meta.get runs on every app open; phase 6 load test, 3 Oct 2026). */
async function coordinatorNames(db, batches) {
  const logins = [...new Set(batches.flatMap(b => csv(b.coordinator_logins)))].slice(0, 90), out = {};
  if (!logins.length) return out;
  // by login only: with "AND status = ?" in the SQL the planner picks the status index and walks every active account
  for (const a of await all(db, `SELECT login, name, status FROM accounts WHERE login IN (${logins.map(() => '?').join(',')})`, ...logins)) if (a.status === 'ACTIVE') out[a.login] = a.name;
  return out;
}

export async function meta(d, ctx, req) {
  const db = ctx.db;
  // meta is PUBLIC (the sign-up screen calls it before anyone has logged in), so ctx carries no
  // session. A staff caller DOES send a token, so resolve it here — failing softly, because a
  // stale token must still leave the sign-up list working.
  let staff = null;
  if (req?.token) { try { staff = await sessionCtx(ctx, req.token); } catch { staff = null; } }
  const [batches, st, facs] = await Promise.all([batchesAll(db), settings(db), offeredNames(db)]);
  const names = await coordinatorNames(db, batches.filter(b => b.active));
  return {
    // `tracks` travels with the batch so the app knows what to ask for before it draws a week: a
    // VL-2 week is the attendance mark alone, a VL-3 week adds rounds (ADR 0009). A closed intake
    // keeps its devotees but takes no new sign-ups, so the sign-up list drops it.
    // a TRAINING batch is not offered when an account is created (the head, 17 Oct 2026): nobody
    // signs up into a training, an ETP coordinator enrols existing devotees into it
    batches: batches.filter(b => b.active && !b.closed_at && b.offered_at_signup !== 0).map(b => ({
      batchId: b.batch_id, name: b.name, tracks: b.tracks || 'full', level: b.level || '',
      coordinatorName: csv(b.coordinator_logins).map(l => names[l]).filter(Boolean).join(', ') })),
    // The list above is the SIGN-UP list and must stay free of trainings. But the staff screens ask
    // meta for "which batches do I run", and a training that is hidden from sign-up is still a batch
    // its coordinator works in every day — filtering it out of both lists took the Students tab away
    // from the one person meant to use it (the head, 17 Oct 2026). So staff get their own list, and
    // only when signed in: a training is never disclosed to the public sign-up screen.
    staffBatches: staff?.login ? batches.filter(b => b.active && !b.closed_at).map(b => ({
      batchId: b.batch_id, name: b.name, tracks: b.tracks || 'full',
      coordinatorName: csv(b.coordinator_logins).map(l => names[l]).filter(Boolean).join(', '),
      // a training's dates and where it stands (Phase 22, J1): its screens say "Past its end date — end it?"
      ...trainingDates(b, isoIst(ctx.now()).slice(0, 10)) })) : undefined,
    facilitators: facs,
    classDays: [{ id: 'SUN', name: 'Sunday' }, { id: 'SAT', name: 'Saturday' }],
    push: ctx.env.VAPID_PUBLIC ? { publicKey: ctx.env.VAPID_PUBLIC, time: st.reminder_time || '21:00' } : null,
    submitWindow: { opens: (st.submit_opens || 'SUN 18:00').toUpperCase(), closes: (st.submit_closes || 'MON 21:00').toUpperCase() },
    minApp: st.min_app || '',
    // the version of these names (Phase 24): auth.me / home.get carry it too, so a phone refetches only when it moved
    version: st.names_version || '1'
  };
}

const coordinatorView = (a, batches) => ({
  username: a.login, name: a.name, phone: a.phone || '', status: a.status, personal: a.role === 'DEVOTEE', master: !!a.is_master,
  batchIds: batches.filter(b => csv(b.coordinator_logins).includes(a.login)).map(b => b.batch_id),
  mustChangePassword: !!a.must_change_pw, lastLogin: a.last_login_at || '',
  ftp: /"@ftp"/.test(a.grants || '')
});
async function coordinatorFresh(db, username) { return coordinatorView(await account(db, username), await batchesAll(db)); }

/** The person being given or changed as coordinator: a coordinator login, or any approved person (their phone). */
export async function coordinatorRow(db, username) {
  const raw = String(username || '').trim(), u = normPhone(raw) || raw.toLowerCase(), a = u ? await account(db, u) : null;
  if (!a || a.status === 'PENDING' || a.status === 'REJECTED') throw apiError('NOT_FOUND', 'No approved person with the login ' + u + '.');
  // a facilitator login is managed under Admin › Facilitators and never gets batches
  if (a.facilitator_name) throw apiError('CONFLICT', `${u} is a facilitator login. Manage it under Admin › Facilitators.`);
  return a;
}
export async function checkBatchIds(db, ids) {
  if (!Array.isArray(ids)) throw invalid({ path: 'batchIds', message: 'Choose the batches.' });
  const known = (await batchesAll(db)).map(b => b.batch_id);
  for (const id of ids) if (!known.includes(String(id))) throw invalid({ path: 'batchIds', message: `Unknown batch ${id}.` });
  return ids.map(String);
}
/** Statements making `username` the coordinator of exactly `batchIds`. */
export async function setCoordinatorBatches(ctx, username, batchIds) {
  const out = [];
  for (const b of await batchesAll(ctx.db)) {
    let list = csv(b.coordinator_logins);
    const has = list.includes(username), want = batchIds.includes(b.batch_id);
    if (has === want) continue;
    list = want ? [...list, username] : list.filter(l => l !== username);
    out.push(q(ctx.db, 'UPDATE batches SET coordinator_logins = ?, updated_at = ?, updated_by = ? WHERE batch_id = ?', list.join(','), isoIst(ctx.now()), ctx.login, b.batch_id));
  }
  return out;
}

/** Everyone with coordinator scope (coordinator logins, and people whose own login coordinates a batch). */
export async function coordinatorsList(d, ctx) {
  const batches = await batchesAll(ctx.db), logins = new Set(batches.flatMap(b => csv(b.coordinator_logins)));
  return (await all(ctx.db, "SELECT * FROM accounts WHERE role = 'COORDINATOR' OR is_master = 1 OR login IN (SELECT value FROM json_each(?)) ORDER BY name", JSON.stringify([...logins])))
    .filter(a => (a.role === 'COORDINATOR' && !a.facilitator_name) || logins.has(a.login))
    .map(a => ({ ...coordinatorView(a, batches), personal: a.role === 'DEVOTEE', master: !!a.is_master }));
}

/**
 * coordinators.create: a new staff login from nothing, with a temporary password (changed at first sign-in). Phase 9,
 * item 24 (the user, 9 Oct 2026, release-blocking): `master: true` appoints an IYF head directly — e.g. someone coming
 * from outside IYF Delhi with no coordination history. A reason is then required (the user: a reason only, no second
 * approval). Such a head is staff-only (role MASTER: no sadhana — "above the system"; db.js gives devotee scope only to
 * role DEVOTEE), has no batches, and the Activity line says what happened: masters.create, not coordinators.create.
 */
export async function coordinatorsCreate(d, ctx, req) {
  const db = ctx.db, problems = [], username = String(d.username || '').trim().toLowerCase(), name = cleanName(d.name);
  const head = d.master === true, reason = cleanName(d.reason || '');
  // an FTP coordinator (the head, 27 Oct 2026): "similar to the ETP coordinator, but for the full-time facilitators, who
  // can define everything for the facilitators". A staff login with no batches, given the FTP role (ADR 0019) at once
  const ftp = d.ftp === true;
  if (d.ftp !== undefined && typeof d.ftp !== 'boolean') problems.push({ path: 'ftp', message: 'Choose a role.' });
  if (ftp && head) problems.push({ path: 'ftp', message: 'An IYF head already holds every role.' });
  if (ftp && Array.isArray(d.batchIds) && d.batchIds.length) problems.push({ path: 'batchIds', message: 'An FTP coordinator has no batches: they look after the facilitators.' });
  if (d.master !== undefined && typeof d.master !== 'boolean') problems.push({ path: 'master', message: 'Choose coordinator or IYF head.' });
  if (head && reason.length < 2) problems.push({ path: 'reason', message: 'Give a short reason for appointing a new IYF head.' });
  if (head && Array.isArray(d.batchIds) && d.batchIds.length) problems.push({ path: 'batchIds', message: 'An IYF head has no batches (they see every batch).' });
  if (!validUsername(username)) problems.push({ path: 'username', message: 'Use 3–30 lowercase letters, digits, dots or dashes, starting with a letter.' });
  if (!validName(name)) problems.push({ path: 'name', message: head ? "Enter the new IYF head's name." : ftp ? "Enter the FTP coordinator's name." : "Enter the coordinator's name." });
  const phone = d.phone === undefined || d.phone === '' ? '' : normPhone(d.phone);
  if (d.phone !== undefined && d.phone !== '' && !phone) problems.push({ path: 'phone', message: 'Enter a 10-digit mobile number, or leave it empty.' });
  const pw = passwordProblem(d.tempPassword, username);
  if (pw) problems.push({ path: 'tempPassword', message: pw });
  if (problems.length) throw invalid(problems);
  const batchIds = head || ftp ? [] : await checkBatchIds(db, d.batchIds || []);
  const h = await hashPassword(d.tempPassword, await iterations(db), ctx.env.PW_PEPPER), now = isoIst(ctx.now());
  // a new head waits for every other active head's approval (the user, 9 Oct 2026); alone, it takes effect now
  if (head) {
    const needed = await otherHeads(db, ctx.login);
    if (needed.length) {
      if (await account(db, username) || await one(db, "SELECT 1 AS x FROM head_requests WHERE login = ? AND state = 'OPEN'", username)) throw apiError('CONFLICT', `The username ${username} is taken.`);
      return { pending: true, request: await askHeads(ctx, { kind: 'CREATE', login: username, name, phone, h, reason, needed }, req) };
    }
  }
  try {
    await db.batch([
      q(db, `INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, must_change_pw, signed_up_at, decided_at, decided_by, updated_at, updated_by, is_master, grants)
             VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`, username, head ? 'MASTER' : 'COORDINATOR', name, phone, h.pw_hash, h.pw_salt, h.pw_iterations, now, now, ctx.login, now, ctx.login, head ? 1 : 0,
             ftp ? JSON.stringify({ '@ftp': { until: '', at: now, by: ctx.login, reason } }) : ''),
      ...(head ? [] : await setCoordinatorBatches(ctx, username, batchIds)),
      head ? audit(db, ctx, 'masters.create', username, '', null, { name, master: true }, reason, req.requestId)
           : audit(db, ctx, 'coordinators.create', username, batchIds.join(','), null, { name, batchIds, ...(ftp ? { ftp: true } : {}) }, reason, req.requestId),
      dirty(db, 'accounts', 'batches', 'audit_log')
    ]);
  } catch (e) {
    if (/UNIQUE|PRIMARY KEY/i.test(String(e.message))) throw apiError('CONFLICT', `The username ${username} is taken.`);
    throw e;
  }
  return { coordinator: await coordinatorFresh(db, username) };
}

export async function coordinatorsUpdate(d, ctx, req) {
  const db = ctx.db, a = await coordinatorRow(db, d.username), now = isoIst(ctx.now()), stmts = [];
  if (d.name !== undefined) {
    const n = cleanName(d.name);
    if (!validName(n)) throw invalid({ path: 'name', message: "Enter the coordinator's name." });
    // the one rename (Phase 24, src/names.js): account, profile and identity record together; their posts follow
    stmts.push(...(await renamePerson(db, ctx, { login: a.login }, n, { at: now })).stmts);
  }
  if (d.phone !== undefined) {
    const p = d.phone === '' ? '' : normPhone(d.phone);
    if (d.phone !== '' && !p) throw invalid({ path: 'phone', message: 'Enter a 10-digit mobile number, or leave it empty.' });
    stmts.push(q(db, 'UPDATE accounts SET phone = ? WHERE login = ?', p, a.login));
  }
  if (d.batchIds !== undefined) stmts.push(...(await setCoordinatorBatches(ctx, a.login, await checkBatchIds(db, d.batchIds))));
  stmts.push(q(db, 'UPDATE accounts SET updated_at = ?, updated_by = ? WHERE login = ?', now, ctx.login, a.login),
    audit(db, ctx, 'coordinators.update', a.login, '', null, d, '', req.requestId), dirty(db, 'accounts', 'batches', 'audit_log'));
  await db.batch(stmts);
  return { coordinator: await coordinatorFresh(db, a.login) };
}

export async function coordinatorsSetDisabled(d, ctx, req) {
  if (typeof d.disabled !== 'boolean') throw invalid({ path: 'disabled', message: 'Choose on or off.' });
  const db = ctx.db, a = await coordinatorRow(db, d.username), status = d.disabled ? 'DISABLED' : 'ACTIVE';
  // a person's own login is never switched off from here: take their batches away instead
  if (a.role !== 'COORDINATOR') throw apiError('CONFLICT', 'This is a personal login. To stop them coordinating, remove their batches.');
  await db.batch([
    q(db, 'UPDATE accounts SET status = ?, updated_at = ?, updated_by = ? WHERE login = ?', status, isoIst(ctx.now()), ctx.login, a.login),
    ...(d.disabled ? [endSessions(ctx, a.login, 'disabled')] : []),
    audit(db, ctx, 'coordinators.setDisabled', a.login, '', { status: a.status }, { status }, '', req.requestId),
    dirty(db, 'accounts', 'audit_log')
  ]);
  return { coordinator: await coordinatorFresh(db, a.login) };
}

export async function coordinatorsResetPassword(d, ctx, req) {
  const db = ctx.db, a = await coordinatorRow(db, d.username), problem = passwordProblem(d.tempPassword, a.login);
  if (problem) throw invalid({ path: 'tempPassword', message: problem });
  const h = await hashPassword(d.tempPassword, await iterations(db), ctx.env.PW_PEPPER);
  await db.batch([
    q(db, "UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iterations = ?, must_change_pw = 1, failed_tries = 0, locked_until = '', updated_at = ?, updated_by = ? WHERE login = ?",
      h.pw_hash, h.pw_salt, h.pw_iterations, isoIst(ctx.now()), ctx.login, a.login),
    endSessions(ctx, a.login, 'reset'),
    audit(db, ctx, 'coordinators.resetPassword', a.login, '', null, null, '', req.requestId),
    dirty(db, 'accounts', 'audit_log')
  ]);
  return { coordinator: await coordinatorFresh(db, a.login) };
}

const batchView = (b, names, today = '') => {
  const logins = csv(b.coordinator_logins);
  return { batchId: b.batch_id, name: b.name, level: b.level, active: !!b.active, pilot: !!b.pilot, standing: !!b.standing,
           // what the batch collects, and the intake it is: empty for everything from SPS onwards,
           // which runs with no fixed duration and is never numbered or closed (ADR 0009)
           tracks: b.tracks || 'full', startedOn: b.started_on || '', closedAt: b.closed_at || '', closedBy: b.closed_by || '',
           coordinatorLogins: logins, coordinatorNames: logins.map(l => names[l] || l),
           // a training's end date and status (Phase 22, J1); nothing for any other batch
           ...(isTrainingBatch(b.batch_id) ? { endsOn: b.ends_on || '', status: trainingStatus(b, today) } : {}) };
};
/*
 * Where a TRAINING stands (Phase 22, J1; the head, 26 Oct 2026). It has a start and an end date the head sets, and it
 * ends when a person ends it — "Close batch" (closing.js), which decides each student (qualified / repeat / left).
 * Nothing ends by itself: once the end date has gone by, the coordinator and the head are asked "Past its end date —
 * end it?" (PAST_END), and the batch keeps running until one of them does.
 *   ENDED     closed_at is set: a record; no new attendance or cards (phases.js), its history readable
 *   PAST_END  today is after ends_on and nobody has ended it
 *   RUNNING   otherwise (also when no end date is set yet, as ETP-21 on 26 Oct)
 */
export const trainingStatus = (b, today) => (b.closed_at ? 'ENDED' : b.ends_on && today > b.ends_on ? 'PAST_END' : 'RUNNING');
/** A training's dates and status for meta's staff list; {} for any other batch. */
const trainingDates = (b, today) => (isTrainingBatch(b.batch_id)
  ? { startedOn: b.started_on || '', endsOn: b.ends_on || '', status: trainingStatus(b, today) } : {});
export async function batchesList(d, ctx) {
  const batches = await batchesAll(ctx.db), names = await coordinatorNames(ctx.db, batches);
  return batches.map(b => batchView(b, names, isoIst(ctx.now()).slice(0, 10)));
}

/** The master's two lists in one call (one request per screen): coordinators and batches. */
export async function adminLists(d, ctx) {
  const [coordinators, batches] = await Promise.all([coordinatorsList(d, ctx), batchesList(d, ctx)]);
  return { coordinators, batches };
}

/** Grants or removes master scope (decision 34). The recovery login and the last master can never lose it. */
export async function mastersSet(d, ctx, req) {
  const db = ctx.db, reason = cleanName(d.reason);
  if (typeof d.master !== 'boolean') throw invalid({ path: 'master', message: 'Choose yes or no.' });
  if (reason.length < 2) throw invalid({ path: 'reason', message: 'Give a short reason.' });
  const a = await coordinatorRow(db, d.login);
  // making someone a head needs every other active head's approval too (else creating a coordinator and promoting
  // them would skip it); removing head access does not
  if (d.master && !a.is_master) {
    const needed = await otherHeads(db, ctx.login);
    if (needed.length) {
      if (await one(db, "SELECT 1 AS x FROM head_requests WHERE login = ? AND state = 'OPEN'", a.login)) throw apiError('CONFLICT', `${a.name} is already waiting for the heads' approval.`);
      return { pending: true, request: await askHeads(ctx, { kind: 'PROMOTE', login: a.login, name: a.name, phone: a.phone || '', h: null, reason, needed }, req) };
    }
  }
  if (!d.master && a.login === 'master') throw apiError('CONFLICT', 'The recovery login always stays a master.');
  if (!d.master && (await one(db, 'SELECT COUNT(*) AS n FROM accounts WHERE is_master = 1 AND status = ?', 'ACTIVE')).n <= 1 && a.is_master) throw apiError('CONFLICT', 'There must always be at least one master.');
  await db.batch([
    q(db, 'UPDATE accounts SET is_master = ?, updated_at = ?, updated_by = ? WHERE login = ?', d.master ? 1 : 0, isoIst(ctx.now()), ctx.login, a.login),
    ...(d.master ? [] : [endSessions(ctx, a.login, 'master scope removed')]),
    audit(db, ctx, 'masters.set', a.login, '', { master: !!a.is_master }, { master: d.master }, reason, req.requestId),
    dirty(db, 'accounts', 'audit_log')
  ]);
  return { coordinator: await coordinatorFresh(db, a.login) };
}

/* ---- a new IYF head: every other active head approves (Phase 9, item 24; the user, 9 Oct 2026) ---- */
const RECOVERY = 'master';          // the recovery login is an emergency key, not a person: it is not asked
export const HEAD_DAYS = 14;        // an open request lapses after this
async function otherHeads(db, except) {
  return (await all(db, "SELECT login FROM accounts WHERE is_master = 1 AND status = 'ACTIVE' AND login <> ? AND login <> ? ORDER BY login", except, RECOVERY)).map(r => r.login);
}
async function askHeads(ctx, x, req) {
  const db = ctx.db, now = isoIst(ctx.now());
  const res = await db.batch([
    q(db, `INSERT INTO head_requests (kind, login, name, phone, pw_hash, pw_salt, pw_iterations, reason, requested_by, requested_at, needed)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, x.kind, x.login, x.name, x.phone || '', x.h?.pw_hash || '', x.h?.pw_salt || '', x.h?.pw_iterations || 0, x.reason, ctx.login, now, x.needed.join(',')),
    audit(db, ctx, 'masters.request', x.login, '', null, { kind: x.kind, name: x.name, needs: x.needed }, x.reason, req.requestId),
    dirty(db, 'head_requests', 'audit_log')]);
  return headView(ctx, await one(db, 'SELECT * FROM head_requests WHERE id = ?', res[0].meta.last_row_id), await staffNames(db));
}
const staffNames = async (db) => Object.fromEntries((await all(db, "SELECT login, name FROM accounts WHERE is_master = 1 OR role IN ('COORDINATOR', 'MASTER')")).map(r => [r.login, r.name]));
function headView(ctx, r, names) {
  const needed = csv(r.needed), approved = csv(r.approved);
  return { id: r.id, kind: r.kind, login: r.login, name: r.name, phone: r.phone, reason: r.reason, requestedBy: names[r.requested_by] || r.requested_by, requestedAt: r.requested_at,
    heads: needed.map(l => ({ login: l, name: names[l] || l, approved: approved.includes(l) })), state: r.state, decidedBy: r.decided_by ? names[r.decided_by] || r.decided_by : null,
    decidedAt: r.decided_at || null, note: r.note || null,
    mine: r.state === 'OPEN' && needed.includes(ctx.login) && !approved.includes(ctx.login), canWithdraw: r.state === 'OPEN' && r.requested_by === ctx.login };
}
async function expireHeads(ctx) {
  const cut = isoIst(new Date(ctx.now().getTime() - HEAD_DAYS * 864e5));
  await ctx.db.batch([q(ctx.db, "UPDATE head_requests SET state = 'EXPIRED', pw_hash = '', pw_salt = '', decided_at = ? WHERE state = 'OPEN' AND requested_at < ?", isoIst(ctx.now()), cut)]);
}
/** heads.requests (the head): the open requests (and the last 20 decided), newest first. */
export async function headsRequests(d, ctx) {
  await expireHeads(ctx);
  const names = await staffNames(ctx.db);
  const open = await all(ctx.db, "SELECT * FROM head_requests WHERE state = 'OPEN' ORDER BY id DESC");
  const recent = await all(ctx.db, "SELECT * FROM head_requests WHERE state <> 'OPEN' ORDER BY id DESC LIMIT 20");
  return { open: open.map(r => headView(ctx, r, names)), recent: recent.map(r => headView(ctx, r, names)), days: HEAD_DAYS };
}
/** heads.decide (the head): approve or decline a request one is asked on. The last approval makes the new head. */
export async function headsDecide(d, ctx, req) {
  const db = ctx.db, note = cleanName(d.note || '');
  if (typeof d.approve !== 'boolean') throw invalid({ path: 'approve', message: 'Approve or decline.' });
  if (!d.approve && note.length < 2) throw invalid({ path: 'note', message: 'Say briefly why you decline.' });
  await expireHeads(ctx);
  const r = await one(db, 'SELECT * FROM head_requests WHERE id = ?', Number(d.id) || 0);
  if (!r) throw apiError('NOT_FOUND', 'That request is not there any more.');
  if (r.state !== 'OPEN') throw apiError('CONFLICT', r.state === 'EXPIRED' ? `This request lapsed after ${HEAD_DAYS} days.` : 'This request was already decided.');
  const needed = csv(r.needed), approved = csv(r.approved), now = isoIst(ctx.now());
  if (!needed.includes(ctx.login)) throw apiError('FORBIDDEN', 'You are not one of the heads asked to approve this.');
  if (approved.includes(ctx.login)) throw apiError('CONFLICT', 'You already approved this.');
  if (!d.approve) {
    const res = await db.batch([q(db, "UPDATE head_requests SET state = 'REJECTED', decided_by = ?, decided_at = ?, note = ?, pw_hash = '', pw_salt = '' WHERE id = ? AND state = 'OPEN'", ctx.login, now, note, r.id),
      audit(db, ctx, 'masters.decline', r.login, '', null, { kind: r.kind, name: r.name }, note, req.requestId), dirty(db, 'head_requests', 'audit_log')]);
    if (!res[0].meta.changes) throw apiError('CONFLICT', 'This request was already decided.');
    return { request: headView(ctx, await one(db, 'SELECT * FROM head_requests WHERE id = ?', r.id), await staffNames(db)) };
  }
  // the heads still to approve: those asked who are still active heads (one who stopped being a head drops out)
  const active = new Set(await otherHeads(db, ''));
  const now2 = [...approved, ctx.login], waiting = needed.filter(l => active.has(l) && !now2.includes(l));
  const stmts = [q(db, "UPDATE head_requests SET approved = ? WHERE id = ? AND state = 'OPEN' AND approved = ?", now2.join(','), r.id, r.approved)];
  if (!waiting.length) {
    const by = `approved by every head (${now2.join(', ')})`;
    if (r.kind === 'CREATE') {
      if (await account(db, r.login)) throw apiError('CONFLICT', `The username ${r.login} was taken meanwhile. Decline this and ask again with another.`);
      stmts.push(q(db, `INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, must_change_pw, signed_up_at, decided_at, decided_by, updated_at, updated_by, is_master)
                        VALUES (?, 'MASTER', 'ACTIVE', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1)`, r.login, r.name, r.phone, r.pw_hash, r.pw_salt, r.pw_iterations, r.requested_at, now, ctx.login, now, ctx.login),
        audit(db, { ...ctx, login: r.requested_by }, 'masters.create', r.login, '', null, { name: r.name, master: true }, `${r.reason} · ${by}`, req.requestId));
    } else {
      const a = await account(db, r.login);
      if (!a || a.status !== 'ACTIVE') throw apiError('CONFLICT', `${r.name} is no longer an active staff login. Decline this request.`);
      stmts.push(q(db, 'UPDATE accounts SET is_master = 1, updated_at = ?, updated_by = ? WHERE login = ?', now, ctx.login, r.login),
        audit(db, { ...ctx, login: r.requested_by }, 'masters.set', r.login, '', { master: false }, { master: true }, `${r.reason} · ${by}`, req.requestId));
    }
    stmts.push(q(db, "UPDATE head_requests SET state = 'DONE', decided_by = ?, decided_at = ?, pw_hash = '', pw_salt = '' WHERE id = ?", ctx.login, now, r.id));
  } else stmts.push(audit(db, ctx, 'masters.approve', r.login, '', null, { kind: r.kind, name: r.name, waitingFor: waiting }, '', req.requestId));
  stmts.push(dirty(db, 'head_requests', 'accounts', 'audit_log'));
  let res;
  try { res = await db.batch(stmts); } catch (e) { if (/UNIQUE|PRIMARY KEY/i.test(String(e.message))) throw apiError('CONFLICT', `The username ${r.login} was taken meanwhile.`); throw e; }
  if (!res[0].meta.changes) throw apiError('CONFLICT', 'Another head decided at the same moment. Please look again.');
  return { request: headView(ctx, await one(db, 'SELECT * FROM head_requests WHERE id = ?', r.id), await staffNames(db)), done: !waiting.length };
}
/** heads.withdraw: the head who asked takes the request back. */
export async function headsWithdraw(d, ctx, req) {
  const db = ctx.db, r = await one(db, 'SELECT * FROM head_requests WHERE id = ?', Number(d.id) || 0);
  if (!r || r.state !== 'OPEN') throw apiError('NOT_FOUND', 'That request is not open any more.');
  if (r.requested_by !== ctx.login) throw apiError('FORBIDDEN', 'Only the head who asked can withdraw it.');
  await db.batch([q(db, "UPDATE head_requests SET state = 'WITHDRAWN', decided_by = ?, decided_at = ?, pw_hash = '', pw_salt = '' WHERE id = ? AND state = 'OPEN'", ctx.login, isoIst(ctx.now()), r.id),
    audit(db, ctx, 'masters.withdraw', r.login, '', null, { kind: r.kind, name: r.name }, '', req.requestId), dirty(db, 'head_requests', 'audit_log')]);
  return {};
}

/** A new batch (the head, 7 Oct 2026). Its level decides everything else, as for the six first batches: the score
 *  card, the hearing journal and which view sheet shows it (one view sheet per level). Coordinators are added with Edit. */
// [score card, hearing journal] — journal names as renamed in 0002_rules.sql. TRD joined on 17 Oct
// 2026: temple residents fill the whole weekly form and read the SPS/DPS journal; since Phase 22 (the head,
// 23 Oct 2026) they are scored on their own card, COSATOK's TRD scheme (cards.js CARD_TRD, migration 0065).
const LEVELS = { SPS: ['SPS', 'SPS/DPS'], DPS: ['BVS/DPS/BSS', 'SPS/DPS'], BSS: ['BVS/DPS/BSS', 'BSS'],
                 BVS: ['BVS/DPS/BSS', 'BVS'], TRD: ['TRD', 'SPS/DPS'] };

/*
 * THE VEDIC LEVELS (ADR 0009, the head, 16 Oct 2026).
 *
 * VL-2 and VL-3 are not like the others. They run as numbered intakes of about three months —
 * "Vedic Level 2, batch 51" is how IYF says it, and the number is the real-world identity people
 * already use, not something the app invents. Each level counts SEPARATELY, so VL2-51 and VL3-51
 * are two different batches and the level prefix is part of the identity.
 *
 * Everything from SPS onwards continues with no fixed duration: no batch number, no closing. That
 * is why these two are a table of their own rather than another entry in LEVELS — the screens ask
 * `vedicLevel()` whether a batch is one of them before offering to number or close it.
 *
 * They carry no score card and no hearing journal: a VL-2 week is the attendance mark, a VL-3 week
 * is attendance and rounds (see `tracks` in weeks.js).
 */
const VEDIC = {
  VL2: { tracks: 'attendance', name: 'Vedic Level 2', prefix: 'VL2' },
  VL3: { tracks: 'attendance,rounds', name: 'Vedic Level 3', prefix: 'VL3' },
  // A TRAINING batch (the head, 17 Oct 2026): ETP-51 is "ETP batch 51", numbered the way the Vedic
  // levels are. It runs about three months or more — the coordinator closes it when the training is
  // done, which is what closing already is here.
  //
  // Its members keep filling the full weekly form, because they are devotees of their own batch
  // besides being students here; what the training adds is the target card, not a different week.
  ETP: { tracks: 'full', name: 'ETP', prefix: 'ETP', training: true }
};
/** True for a TRAINING batch (ETP today). Class batches are everything else (REPORTED-2026-10-17 item 4). */
export const isTrainingBatch = id => VEDIC[vedicLevel(id)]?.training === true;
/** The Vedic level a batch id belongs to (VL2-51 → VL2), or null for SPS and everything after it. */
export { vedicLevel } from './closing.js';   // ONE definition, in closing.js: two copies had already drifted (17 Oct 2026)
export async function batchesCreate(d, ctx, req) {
  const db = ctx.db, problems = [], id = String(d.batchId || '').trim().toUpperCase(), name = cleanName(d.name), level = String(d.level || '');
  // VL2-51 / VL3-51 for a Vedic intake; the old rule for everything else, which is unchanged
  const vedic = vedicLevel(id);
  if (!vedic && !/^[A-Z][A-Z0-9]{1,7}$/.test(id)) problems.push({ path: 'batchId', message: '2–8 capital letters or digits, starting with a letter (e.g. SPS3) — or VL2-51 for a Vedic Level intake.' });
  else if (await one(db, 'SELECT 1 AS x FROM batches WHERE batch_id = ?', id)) problems.push({ path: 'batchId', message: `There is already a batch ${id}.` });
  if (name.length < 2 || name.length > 40) problems.push({ path: 'name', message: 'Give the batch a name.' });
  else if (await one(db, 'SELECT 1 AS x FROM batches WHERE lower(name) = lower(?)', name)) problems.push({ path: 'name', message: 'Another batch has this name.' });
  // a Vedic intake takes its level from its id (VL2-51 is Vedic Level 2); everything else is chosen
  if (!vedic && !LEVELS[level]) problems.push({ path: 'level', message: 'Choose the level.' });
  if (vedic && level && level !== vedic) problems.push({ path: 'level', message: `${id} is a ${VEDIC[vedic].name} batch.` });
  if (d.pilot !== undefined && typeof d.pilot !== 'boolean') problems.push({ path: 'pilot', message: 'Choose yes or no.' });
  if (d.startedOn !== undefined && d.startedOn !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.startedOn))) {
    problems.push({ path: 'startedOn', message: 'A date, as 2026-01-05.' });
  }
  // A batch cannot begin after the day it is defined (the head, 18 Oct 2026): "the day when i
  // defined the batch window from that day week wise card inputs will be taken". A start in the
  // future opens a card window nobody can fill yet — ETP-21 was created starting 31 October and
  // its students had no week to put anything in.
  if (d.startedOn && /^\d{4}-\d{2}-\d{2}$/.test(String(d.startedOn)) && String(d.startedOn) > isoIst(ctx.now()).slice(0, 10)) {
    problems.push({ path: 'startedOn', message: 'A batch starts today or earlier, never on a future date.' });
  }
  // A training's END date (Phase 22, J1): the head sets it with the start; it must come after the start. The start keeps
  // the rule above — never in the future — for a training too: its card window opens on started_on, and ETP-21, created
  // to start on 31 October, left its students with no week to fill (the head, 18 Oct 2026).
  const training = isTrainingBatch(id), endsOn = String(d.endsOn ?? '').trim();
  const endProblem = trainingEndProblem(training, endsOn, String(d.startedOn || '').trim() || isoIst(ctx.now()).slice(0, 10), true);
  if (endProblem) problems.push(endProblem);
  // its coordinators at creation (Phase 23: the head's form, and an approved request's requester) — the same check as
  // batches.update: approved people only
  let coordinators = [];
  if (d.coordinatorLogins !== undefined) {
    if (!Array.isArray(d.coordinatorLogins) || d.coordinatorLogins.length > 10) problems.push({ path: 'coordinatorLogins', message: 'Choose the coordinators.' });
    else {
      coordinators = [...new Set(d.coordinatorLogins.map(l => String(l).trim().toLowerCase()).filter(Boolean))];
      for (const l of coordinators) { const a = await account(db, l); if (!a || !['ACTIVE', 'INACTIVE'].includes(a.status)) { problems.push({ path: 'coordinatorLogins', message: `No approved person with the login ${l}.` }); break; } }
    }
  }
  if (problems.length) throw invalid(problems);
  // a coordinator's request this batch fulfils (Phase 23, batchreq.js): marked STARTED in the same write as the batch
  const fromReq = d.fromRequest !== undefined ? await fulfilling(db, ctx, d.fromRequest, vedic, id) : null;
  const now = isoIst(ctx.now());
  // The Vedic levels keep no score card and no hearing journal: a VL-2 week is the attendance mark
  // and a VL-3 week is attendance and rounds, so there is nothing for a card to score. `tracks` says
  // which, and `started_on` is the intake's own start (ADR 0009).
  const [card, journal] = vedic ? ['', ''] : LEVELS[level];
  const lvl = vedic || level, tracks = vedic ? VEDIC[vedic].tracks : 'full';
  // left blank, a training starts TODAY: the week-by-week card runs from the day it was defined,
  // so there is never a batch whose card cannot yet be filled (the head, 18 Oct 2026)
  const startedOn = vedic ? (String(d.startedOn || '').trim() || now.slice(0, 10)) : '';
  await db.batch([
    // temple_activities: a TRD-level batch asks the Morning program its card scores (Phase 22; 0062 set it only for TRD)
    q(db, `INSERT INTO batches (batch_id, name, level, score_card, hearing_journal, sheet_tab, coordinator_logins, standing, active, pilot, tracks, started_on, offered_at_signup, temple_activities, ends_on, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)`, id, name, lvl, card, journal, name, coordinators.join(','), d.pilot ? 1 : 0, tracks, startedOn, vedic === 'ETP' ? 0 : 1, lvl === 'TRD' ? 1 : 0, training ? endsOn : '', now, ctx.login),
    audit(db, ctx, 'batches.create', id, id, null, { name, level: lvl, pilot: !!d.pilot, tracks, startedOn, ...(training ? { endsOn } : {}),
      ...(coordinators.length ? { coordinatorLogins: coordinators } : {}), ...(fromReq ? { fromRequest: fromReq.r.id } : {}) }, '', req.requestId),
    ...(fromReq ? fromReq.stmts : []),
    dirty(db, 'batches', 'audit_log')
  ]);
  const fresh = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', id);
  return batchView(fresh, await coordinatorNames(db, [fresh]), now.slice(0, 10));
}

/**
 * What is wrong with a training's end date, or null (Phase 22, J1). Only a training has one; it is a date, after the
 * start. `required`: a NEW training must be given one (its dates are custom); ETP-21, made before, may wait for Edit.
 */
export function trainingEndProblem(training, endsOn, startsOn, required) {
  if (!training) return endsOn ? { path: 'endsOn', message: 'Only a training batch has an end date.' } : null;
  if (!endsOn) return required ? { path: 'endsOn', message: 'When does this training end?' } : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || isNaN(Date.parse(endsOn))) return { path: 'endsOn', message: 'A date, as 2026-12-31.' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(startsOn) && endsOn <= startsOn) return { path: 'endsOn', message: 'The end comes after the start.' };
  return null;
}

export async function batchesUpdate(d, ctx, req) {
  const db = ctx.db, b = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', String(d.batchId || ''));
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  const sets = [], args = [];
  if (d.name !== undefined) {
    const n = cleanName(d.name);
    if (n.length < 2 || n.length > 40) throw invalid({ path: 'name', message: 'Give the batch a name.' });
    sets.push('name = ?'); args.push(n);
  }
  for (const k of ['active', 'pilot']) {
    if (d[k] === undefined) continue;
    if (typeof d[k] !== 'boolean') throw invalid({ path: k, message: 'Choose yes or no.' });
    sets.push(`${k} = ?`); args.push(d[k] ? 1 : 0);
  }
  if (d.coordinatorLogins !== undefined) {
    if (!Array.isArray(d.coordinatorLogins)) throw invalid({ path: 'coordinatorLogins', message: 'Choose the coordinators.' });
    const logins = d.coordinatorLogins.map(l => String(l).trim().toLowerCase());
    for (const l of logins) { const a = await account(db, l); if (!a || !['ACTIVE', 'INACTIVE'].includes(a.status)) throw invalid({ path: 'coordinatorLogins', message: `No approved person with the login ${l}.` }); }
    sets.push('coordinator_logins = ?'); args.push(logins.join(','));
  }
  /*
   * A training's dates (Phase 22, J1): the head moves its start or end while it runs. An ended training's dates are a
   * record, as its cards are. The start keeps the create rule (today or earlier); the end comes after the start.
   */
  if (d.startedOn !== undefined || d.endsOn !== undefined) {
    const which = d.endsOn !== undefined ? 'endsOn' : 'startedOn';
    if (!isTrainingBatch(b.batch_id)) throw invalid({ path: which, message: 'Only a training batch has its own dates here.' });
    if (b.closed_at) throw apiError('CONFLICT', `${b.name} has ended; its dates are a record now.`);
    const today = isoIst(ctx.now()).slice(0, 10), start = d.startedOn !== undefined ? String(d.startedOn).trim() : (b.started_on || '');
    if (d.startedOn !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || isNaN(Date.parse(start))) throw invalid({ path: 'startedOn', message: 'A date, as 2026-01-05.' });
      if (start > today) throw invalid({ path: 'startedOn', message: 'A batch starts today or earlier, never on a future date.' });
      sets.push('started_on = ?'); args.push(start);
    }
    const end = d.endsOn !== undefined ? String(d.endsOn).trim() : (b.ends_on || '');
    const p = trainingEndProblem(true, end, start, d.endsOn !== undefined);
    if (p) throw invalid(p);
    if (d.endsOn !== undefined) { sets.push('ends_on = ?'); args.push(end); }
  }
  sets.push('updated_at = ?', 'updated_by = ?'); args.push(isoIst(ctx.now()), ctx.login);
  await db.batch([
    q(db, `UPDATE batches SET ${sets.join(', ')} WHERE batch_id = ?`, ...args, b.batch_id),
    audit(db, ctx, 'batches.update', b.batch_id, b.batch_id, null, d, '', req.requestId),
    dirty(db, 'batches', 'audit_log')
  ]);
  const fresh = await one(db, 'SELECT * FROM batches WHERE batch_id = ?', b.batch_id);
  return batchView(fresh, await coordinatorNames(db, [fresh]), isoIst(ctx.now()).slice(0, 10));
}

/* ---- IYF ID links (the registry itself is read-only) ---- */

export async function idsSearch(d, ctx) {
  const linked = await linkedLogins(ctx.db);
  return { results: registrySearchRows(await registryRows(ctx.db), d.q).map(r => ({ ...r, linked: !!linked[r.iyfId], linkedAccount: linked[r.iyfId] || null })) };
}

/*
 * One ID's details.
 *
 * The registry row is what this screen has always shown, and it is the DASHBOARD's view of a person:
 * the ID that batch gave them, the name as typed there. It knows nothing of the identity authority,
 * so a person who has since been given a real IYFD- id still appeared under their old batch number
 * with no sign the newer one existed — Amrit showing GP26-0001 while his record said IYFD-2016-0003
 * (the head, 16 Oct 2026).
 *
 * So when the id belongs to a person record, the person is what comes back: their current id, every
 * name they have been known by (the initiated one included) and every id they have ever held, the
 * same view the Devotees screen gives. The registry fields stay beside it, because the batch, the
 * facilitator and the membership history live there and nowhere else.
 *
 * `person` is null when no record exists — which is most of the registry today, 236 of the 250 GP26-
 * rows. The screen shows what it has rather than inventing an id, and those rows read exactly as
 * before. `matchedBy` says how the person was found: 'id' is certain, 'phone' is a guess the screen
 * must label, since a number can be shared or reassigned.
 */
export async function idsGet(d, ctx) {
  const id = String(d.iyfId || '').trim().toUpperCase();
  const r = ID_PATTERN.test(id) ? (await registryRows(ctx.db)).find(x => x.iyf_id === id) : null;
  if (!r) throw apiError('UNKNOWN_ID', id + ' is not in the registry.');
  // The person this id belongs to. The ID is asked FIRST and on its own: resolve() tries phone before
  // fid, and a registry row's number can belong to someone else — a shared family phone, or a number
  // that changed hands — which would answer with the wrong person's names and ids. Only when the id
  // itself is attached to nobody is the phone worth trying, and then it is a guess, marked as one.
  const byId = await resolve(ctx.db, { fid: id });
  const byPhone = byId ? null : (r.phone ? await resolve(ctx.db, { phone: r.phone }) : null);
  const personId = byId || byPhone;
  const person = personId ? { ...(await personView(ctx.db, personId)), matchedBy: byId ? 'id' : 'phone' } : null;
  const phones = new Set(r.phone ? [r.phone] : []);
  for (const k of r.aliases) { const p = k.split('|')[0]; if (p) phones.add(p); }
  const linkedAccount = (await linkedLogins(ctx.db))[id] || null;
  const history = linkedAccount ? await all(ctx.db, 'SELECT batch_id, state, from_week, to_week FROM memberships WHERE login = ? ORDER BY id', linkedAccount.login) : [];
  return { ...registryPublic(r, ''), phones: [...phones], linkedAccount, person,
           batchHistory: history.map(m => ({ batchId: m.batch_id, state: m.state, fromWeek: m.from_week, toWeek: m.to_week })) };
}

async function devoteeAccount(db, login) {
  const p = normPhone(login), a = p ? await account(db, p) : null;
  if (!a || a.role !== 'DEVOTEE') throw apiError('NOT_FOUND', 'No devotee with that phone.');
  if (a.status === 'PENDING' || a.status === 'REJECTED') throw apiError('CONFLICT', 'Approve the sign-up first.');
  return a;
}
/*
 * The id an account is LABELLED with, which every screen prints (the head, 17 Oct 2026).
 *
 * Linking a devotee to a registry row used to write that row's number — GP26-0001, JN26-0075 — and
 * that is what the board, the contact card and the exports then showed. Once somebody has a real
 * IYF id, only that identifies them: "not G type ids or K or J type", everywhere.
 *
 * So the id being linked is resolved to the person's CURRENT one when they have it. Nothing is
 * lost: the legacy number stays in person_identifiers and a search for it still finds them. What
 * changes is what is displayed, which is a different thing from what resolves.
 */
export async function currentIdFor(db, iyfId) {
  const id = String(iyfId || '').trim();
  if (!id || /^IYFD-/i.test(id)) return id;
  const p = await one(db, `SELECT p.iyf_id FROM person_identifiers pi JOIN persons p ON p.id = pi.person_id
                            WHERE upper(pi.fid) = upper(?) AND p.iyf_id LIKE 'IYFD-%' LIMIT 1`, id);
  return p?.iyf_id || id;   // no current one: their old number stays rather than being invented
}

function linkStatements(ctx, a, iyfId, source) {
  const db = ctx.db, now = isoIst(ctx.now());
  return [
    q(db, 'UPDATE accounts SET iyf_id = ?, id_source = ?, updated_at = ?, updated_by = ? WHERE login = ?', iyfId || null, source, now, ctx.login, a.login),
    q(db, 'UPDATE profiles SET iyf_id = ?, updated_at = ?, updated_by = ? WHERE login = ?', iyfId || '', now, ctx.login, a.login),
    q(db, 'UPDATE memberships SET iyf_id = ? WHERE login = ?', iyfId || '', a.login)
  ];
}

/* ---- IYF IDs created in the app: the head only ----
 *
 * ONE FORMAT, EVERYWHERE: IYFD-<the year they connected with IYF>-NNNN (the head, repeatedly, most
 * recently 18 Oct 2026). The app used to mint its own SR<yy>-NNNN series "never the dashboard's",
 * which is exactly the second kind of identifier the rule exists to prevent — a temple resident was
 * shown SR26-0001 while everybody around him read IYFD-2016-0003.
 *
 * The year is THEIRS — the year they came to IYF, from profiles.connected_since — and is required. It is
 * never filled in with today's date: a cohort that falls back to the creation date numbers people into the
 * wrong year permanently.
 *
 * The number comes from the identity authority (`identity.js issueForAccount` → `nextId`), which counts per
 * YEAR. Never a counter of this module's own: one kept here (the highest number it could see, plus one)
 * would have issued numbers the authority's per-year counter reaches later, for somebody else (18 Oct 2026).
 */
export const APP_ID = /^IYFD-\d{4}-\d{4,}$/;
/* Ids this app minted, INCLUDING the retired SR<yy>-NNNN series. Used only to decide whether an id
   came from here and should be retired when the dashboard's own id replaces it — a handful of SR
   ids were issued before the format was corrected, and they must still retire cleanly. */
export const APP_MINTED = /^(IYFD-\d{4}|SR\d{2})-\d{4,}$/;
/** The year on record for when they came to IYF, or '' — never a guess. */
export async function connectedYear(ctx, login) {
  const p = await one(ctx.db, 'SELECT connected_since FROM profiles WHERE login = ?', login);
  const y = String(p?.connected_since || '').trim().slice(0, 4);
  return /^\d{4}$/.test(y) ? y : '';
}
// an app ID retired: the dashboard's own ID replaced it (or it was unlinked)
const retireApp = (ctx, oldId, by) => q(ctx.db, "UPDATE app_ids SET state = 'RETIRED', replaced_by = ?, retired_at = ? WHERE iyf_id = ? AND state = 'ACTIVE'", by || '', isoIst(ctx.now()), oldId);

/** An IYF ID for account `a`, from the authority. `year` overrides the one on record (the head may give it). */
export async function createAppId(ctx, a, batchId, reason, requestId, year = '') {
  const y = String(year || '') || await connectedYear(ctx, a.login);
  if (!y) throw invalid({ path: 'year', message: `Add the year ${a.name || 'they'} first came to IYF Delhi first — the IYF ID carries it.` });
  const r = await issueForAccount(ctx.db, ctx, { login: a.login, name: a.name, year: y, reason, batchId });
  return r.fid;
}
/** ids.nextApp (the head): the ID the next creation would get, WITHOUT taking it. */
export async function idsNextApp(d, ctx) {
  const login = String(d.login || ''), y = String(d.year || '') || (login ? await connectedYear(ctx, login) : '');
  if (!y) return { next: null, needsYear: true };
  return { next: await previewId(ctx.db, y), year: y };
}
/** ids.create (the head): an IYF ID for a devotee with none, or with an old-style one (GP/JN/KT/SR). */
export async function idsCreate(d, ctx, req) {
  const reason = cleanName(d.reason || '');
  const db = ctx.db, a = await devoteeAccount(db, d.login);
  if (APP_ID.test(a.iyf_id || '')) throw apiError('CONFLICT', `${a.name} already has an IYF ID (${a.iyf_id}).`);
  return { iyfId: await createAppId(ctx, a, await devoteeBatch(db, a), reason, req.requestId, d.year) };
}
/** ids.appList (the head): the IDs created in the app, newest first, with a possible dashboard match by phone (to add
 *  them to the dashboard, or to link the dashboard's own ID when it has the person — the dashboard's ID wins). */
export async function idsAppList(d, ctx) {
  const rows = await all(ctx.db, `SELECT x.*, a.iyf_id AS now_id, r.iyf_id AS dash_id, r.name AS dash_name FROM app_ids x
    LEFT JOIN accounts a ON a.login = x.login LEFT JOIN registry r ON r.phone = x.login AND x.state = 'ACTIVE' ORDER BY x.id DESC LIMIT 500`);
  const names = Object.fromEntries((await batchesAll(ctx.db)).map(b => [b.batch_id, b.name]));
  // still to answer (22 Oct 2026): active devotees with no IYFD — they are asked for their year at their next open
  const waiting = await all(ctx.db, `SELECT a.login, a.name, a.iyf_id, p.connected_since,
        (SELECT m.batch_id FROM memberships m WHERE m.login = a.login AND m.to_week = '' ORDER BY m.id DESC LIMIT 1) AS batch_id,
        (SELECT MAX(s.last_used_at) FROM sessions s WHERE s.login = a.login) AS last_seen
      FROM accounts a LEFT JOIN profiles p ON p.login = a.login
      WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE' AND COALESCE(a.iyf_id, '') NOT LIKE 'IYFD-%' ORDER BY a.name LIMIT 200`);
  return { ids: rows.filter(r => r.iyf_id).map(r => ({ iyfId: r.iyf_id, login: r.login, name: r.name, batchName: names[r.batch_id] || r.batch_id, createdAt: r.created_at, createdBy: r.created_by,
    state: r.state, replacedBy: r.replaced_by || null, inUse: r.now_id === r.iyf_id, dashboardMatch: r.dash_id ? { iyfId: r.dash_id, name: r.dash_name } : null })),
    waiting: waiting.map(w => ({ login: w.login, name: w.name, oldId: w.iyf_id || '', yearOnRecord: String(w.connected_since || '').slice(0, 4),
      batchName: names[w.batch_id] || w.batch_id || '', lastSeen: w.last_seen || null })) };
}

export async function idsLink(d, ctx, req) {
  const reason = cleanName(d.reason);
  if (reason.length < 2) throw invalid({ path: 'reason', message: 'Give a short reason.' });
  const db = ctx.db, a = await devoteeAccount(db, d.login), id = String(d.iyfId || '').trim().toUpperCase();
  await checkIyfId(ctx, id, a.login);
  // label them with their CURRENT id: linking by a legacy number must not print that number back
  const shown = await currentIdFor(db, id);
  // Never a downgrade (18 Oct 2026): somebody who holds an IYFD id keeps it. Linking an older GP/JN/KT number
  // over it would put a superseded format back on their record — the IYFD-only rule. The old number belongs on
  // their person record as a superseded identifier, where it still resolves to them.
  if (APP_ID.test(a.iyf_id || '') && !APP_ID.test(shown)) {
    throw apiError('CONFLICT', `${a.name} already has ${a.iyf_id}. ${id} is an older number and cannot replace it.`);
  }
  try {
    await db.batch([...linkStatements(ctx, a, shown, 'MASTER'), ...(APP_MINTED.test(a.iyf_id || '') ? [retireApp(ctx, a.iyf_id, shown)] : []),
      audit(db, ctx, 'ids.link', a.login, await devoteeBatch(db, a), { iyf_id: a.iyf_id || '' }, { iyf_id: shown, ...(shown !== id ? { linkedBy: id } : {}) }, reason, req.requestId),
      dirty(db, 'accounts', 'profiles', 'memberships', 'audit_log')]);
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw apiError('CONFLICT', `${id} already belongs to another account.`);
    throw e;
  }
  return {};
}

export async function idsUnlink(d, ctx, req) {
  const reason = cleanName(d.reason);
  if (reason.length < 2) throw invalid({ path: 'reason', message: 'Give a short reason.' });
  const db = ctx.db, a = await devoteeAccount(db, d.login);
  if (!a.iyf_id) throw apiError('CONFLICT', 'This account has no IYF ID linked.');
  await db.batch([...linkStatements(ctx, a, null, ''), ...(APP_MINTED.test(a.iyf_id) ? [retireApp(ctx, a.iyf_id, '')] : []),
    audit(db, ctx, 'ids.unlink', a.login, await devoteeBatch(db, a), { iyf_id: a.iyf_id }, { iyf_id: '' }, reason, req.requestId),
    dirty(db, 'accounts', 'profiles', 'memberships', 'audit_log')]);
  return {};
}
