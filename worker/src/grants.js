// Permissions per person (ADR 0015, the head, 22 Oct 2026): "the auth manager should have the full scope auths, using
// which I can give and take permissions from any devotee or any staff".
//
// A person's roles (devotee, group leader, facilitator, coordinator of batches, head) give them their actions, through
// the registry's gates. On top of that the head can, per person and per capability:
//
//   take it away  (deny)   the action is refused even though a role allows it
//   give it       (allow)  the action passes a role gate that would refuse it — only for the capabilities marked
//                           `give`, whose handlers already narrow by batch or person, so a grant never opens a batch
//                           the person does not hold
//
// Stored on the person's own row (accounts.grants, migration 0061), which the session already reads: the gate costs
// no extra round trip. Every change is an `access.set` line in Activity.
import { apiError, invalid, isoIst, cleanName, csv } from './util.js';
import { q, one, all, audit, dirty, batchesAll, currentMembership } from './db.js';
import { isTrainingBatch, checkBatchIds, setCoordinatorBatches } from './admin.js';
import { leadersSet } from './groups.js';

const ON_BEHALF = (d) => d && d.onBehalfOf !== undefined && d.onBehalfOf !== '';
/** The capabilities, in the order the screen shows them. `actions`: the registry actions it covers (an object maps an
 *  action to a test of its data, for "only when filling for somebody"). `give`: may be given beyond a role. */
export const CAPS = [
  { id: 'signups', label: 'Approve or reject sign-ups', actions: ['requests.approve', 'requests.reject'] },
  { id: 'resets', label: 'Reset passwords', actions: ['resets.approve', 'resets.reject'] },
  { id: 'fillFor', label: 'Fill a week for a devotee', actions: { 'week.saveDay': ON_BEHALF, 'week.saveWeekEnd': ON_BEHALF, 'week.submit': ON_BEHALF } },
  { id: 'attendance', label: 'Mark attendance and class weeks', actions: ['attendance.set', 'weeks.setClass', 'training.attendance', 'group.mark'] },
  { id: 'attendanceLate', label: 'Change attendance after the deadline', actions: ['attendance.override'], give: true },
  { id: 'reopen', label: 'Reopen a missed week', actions: ['weeks.reopen'], give: true },
  { id: 'leaders', label: 'Assign group leaders', actions: ['leaders.set', 'leaders.assign'] },
  { id: 'devoteeEdit', label: "Change a devotee's facilitator, active or access", actions: ['devotees.setPeople', 'devotees.setActive', 'devotees.setDisabled'] },
  { id: 'deleteAccounts', label: 'Delete (anonymise) accounts', actions: ['devotees.delete'] },
  { id: 'promote', label: 'Promote, or close a batch', actions: ['devotees.promote', 'batches.close'] },
  { id: 'enrol', label: 'Enrol in a training', actions: ['enrol.add', 'enrol.remove'] },
  { id: 'exports', label: 'Export', actions: ['exports.page'] },
  { id: 'exportsPersonal', label: 'Export personal details', actions: [], give: true },
  { id: 'wallPost', label: 'Post on the Wall', actions: ['announcements.create', 'announcements.update'] },
  { id: 'wallComment', label: 'Comment and like on the Wall', actions: ['announcements.comment', 'announcements.uncomment', 'announcements.like'] },
  { id: 'reopenAsk', label: 'Ask to reopen a week', actions: ['reopen.request'] },
  // the FTP coordinator's (ADR 0019, the head, 26 Oct 2026): the Facilitator Training Program works on the original
  // facilitators, phase by phase. `facBoard` is a field rule in phases.js (the whole facilitators' board)
  { id: 'facBoard', label: "See every facilitator's scoreboard", actions: [] },
  { id: 'facManage', label: 'Add, rename or switch off facilitators; make facilitation lasting', actions: ['facilitators.add', 'facilitators.rename', 'facilitators.setActive', 'facilitators.setLasting'] },
  { id: 'targetsOpen', label: "Open a facilitator's targets for 7 days", actions: ['targets.unlock'] },
  // Admin › Reports (Phase 23 P14, the head, 27 Oct 2026): the head's own; given, it reports only on the person's own batches,
  // students or trainings — report.js forces that scope. `facilitators`: may be given to a facilitator login too
  { id: 'reports', label: 'Build reports for their own batches or students', actions: ['report.get', 'report.options'], give: true, facilitators: true }
];
const BY_ID = Object.fromEntries(CAPS.map(c => [c.id, c]));
const CAP_OF = {};
for (const c of CAPS) for (const [a, when] of Array.isArray(c.actions) ? c.actions.map(a => [a, null]) : Object.entries(c.actions)) (CAP_OF[a] ||= []).push({ id: c.id, when });

/** The person's changes in force today: { capability: 'allow' | 'deny' } (an ended one no longer counts). */
export function grantsOf(acct, today) {
  if (!acct?.grants) return {};
  let g; try { g = JSON.parse(acct.grants); } catch { return {}; }
  const out = {};
  for (const [id, v] of Object.entries(g || {})) if (BY_ID[id] && (v.effect === 'allow' || v.effect === 'deny') && (!v.until || v.until >= today)) out[id] = v.effect;
  return out;
}
/** The capability an action (with its data) belongs to, or null. */
export const capabilityOf = (action, data) => (CAP_OF[action] || []).find(x => !x.when || x.when(data))?.id || null;
/** For a handler's own rule (a field, not an action): does this person have it — by role (`byRole`) or given? */
export function can(ctx, id, byRole) {
  const g = grantsOf(ctx.acct, isoIst(ctx.now()).slice(0, 10));
  if (g[id] === 'deny' && !ctx.scopes?.master) return false;
  return !!byRole || (g[id] === 'allow' && !!BY_ID[id]?.give);
}

/**
 * The gate, after the role check (api.js handle). `byRole`: whether the role gate let them through.
 * Returns true when the action may proceed. A head's own powers are never taken (heads are managed by the heads).
 */
export function gate(ctx, action, data, byRole) {
  const id = capabilityOf(action, data);
  if (!id) return byRole;
  const g = grantsOf(ctx.acct, isoIst(ctx.now()).slice(0, 10));
  if (g[id] === 'deny' && !ctx.scopes?.master) throw apiError('FORBIDDEN', 'The IYF head has turned this off for you.');
  return byRole || (g[id] === 'allow' && !!BY_ID[id].give);
}

/* ------------------------------------------------------------------------ */
/* The head's screen: Admin › Access                                         */
/* ------------------------------------------------------------------------ */

const view = (a, today) => {
  let raw = {}; try { raw = a.grants ? JSON.parse(a.grants) : {}; } catch { raw = {}; }
  return { login: a.login, name: a.name, role: a.role, status: a.status, master: !!a.is_master, facilitator: a.facilitator_name || '',
           grants: Object.entries(raw).filter(([id]) => BY_ID[id]).map(([id, v]) => ({ id, effect: v.effect, until: v.until || '', ended: !!v.until && v.until < today })) };
};

/** Find anyone — devotee or staff — by name, phone or username (the head). */
export async function accessSearch(d, ctx) {
  const term = String(d.q || '').trim();
  if (term.length < 2) throw invalid({ path: 'q', message: 'Type at least two letters.' });
  const like = '%' + term.replace(/[%_]/g, '') + '%', today = isoIst(ctx.now()).slice(0, 10);
  const rows = await all(ctx.db, `SELECT login, name, role, status, is_master, facilitator_name, grants FROM accounts
                                   WHERE login NOT LIKE 'deleted-%' AND (name LIKE ? OR login LIKE ?) ORDER BY name LIMIT 20`, like, term + '%');
  return { people: rows.map(a => view(a, today)) };
}

/** One person: their roles (as the screen shows them), the capabilities, and what the head has changed. */
export async function accessGet(d, ctx) {
  const a = await one(ctx.db, `SELECT login, name, role, status, is_master, facilitator_name, grants FROM accounts WHERE login = ?`, String(d.login || ''));
  if (!a) throw apiError('NOT_FOUND', 'No such person.');
  const [batches, leads] = await Promise.all([batchesAll(ctx.db), one(ctx.db, 'SELECT batch_id FROM leaders WHERE login = ?', a.login)]);
  const coordinates = batches.filter(b => csv(b.coordinator_logins).includes(a.login)).map(b => ({ batchId: b.batch_id, name: b.name }));
  // the roles they hold (ADR 0019), with the end date Access set, if any
  const g = parse(a.grants), day = isoIst(ctx.now()).slice(0, 10), meta = (r) => ({ until: g['@' + r]?.until || '', ended: !!g['@' + r]?.until && g['@' + r].until < day });
  const roles = [
    ...BATCH_ROLES.map(r => ({ role: r, label: ROLES[r].label, batches: coordinates.filter(b => kindOf(b.batchId) === r), ...meta(r) })).filter(r => r.batches.length),
    ...(g['@ftp'] ? [{ role: 'ftp', label: ROLES.ftp.label, batches: [], ...meta('ftp') }] : []),
    ...(leads ? [{ role: 'leader', label: ROLES.leader.label, batches: batches.filter(b => b.batch_id === leads.batch_id).map(b => ({ batchId: b.batch_id, name: b.name })), ...meta('leader') }] : [])];
  // What can really be given to THIS person (the head, 27 Oct 2026: "only show those functionalities which exist … based
  // on the current feasibility of the access"): the same rules accessAssign enforces, worked out here so the screen
  // never offers what the server would refuse.
  const m = a.role === 'DEVOTEE' ? await currentMembership(ctx.db, a.login) : null;
  const running = batches.filter(b => b.active && !b.closed_at);
  const approved = a.status !== 'PENDING' && a.status !== 'REJECTED' && !a.is_master && a.role !== 'MASTER';
  const can = {
    coordinator: approved && !a.facilitator_name && running.some(b => !isTrainingBatch(b.batch_id)),
    training: approved && !a.facilitator_name && running.some(b => isTrainingBatch(b.batch_id)),
    leader: approved && a.status === 'ACTIVE' && !!m && m.state === 'ACTIVE' && !isTrainingBatch(m.batch_id),
    ftp: approved
  };
  // the rights that mean something for them: everyone's own (the Wall, asking to reopen a week), and those of the roles
  // they hold; one already changed stays listed, so it can be put back
  const general = CAPS.filter(c => !Object.values(ROLES).some(R => [...R.caps, ...R.extra].includes(c.id))).map(c => c.id);
  const held = new Set(roles.map(r => r.role));
  const applies = new Set([...general, ...[...held].flatMap(r => [...ROLES[r].caps, ...ROLES[r].extra]),
    ...(held.has('leader') ? ['attendance'] : []), ...(a.facilitator_name ? CAPS.filter(c => c.facilitators).map(c => c.id) : []), ...Object.keys(g).filter(k => BY_ID[k])]);
  return { ...view(a, day), coordinates, roles, labels: Object.fromEntries(CAPS.map(c => [c.id, c.label])),
           capabilities: CAPS.filter(c => applies.has(c.id)).map(c => ({ id: c.id, label: c.label, give: !!c.give && ([...held].some(r => ROLES[r].extra.includes(c.id)) || (!!c.facilitators && !!a.facilitator_name)) })),
           roleDefs: Object.entries(ROLES).filter(([id]) => can[id] || held.has(id))
             .map(([id, R]) => ({ id, label: R.label, caps: R.caps, extra: R.extra, global: !!R.global })),
           batches: batches.filter(b => b.active).map(b => ({ batchId: b.batch_id, name: b.name, training: isTrainingBatch(b.batch_id) })) };
}

/** Everyone the head has changed something for, so nothing given or taken is forgotten. */
export async function accessList(d, ctx) {
  const today = isoIst(ctx.now()).slice(0, 10);
  const rows = await all(ctx.db, `SELECT login, name, role, status, is_master, facilitator_name, grants FROM accounts WHERE grants <> '' ORDER BY name`);
  return { people: rows.map(a => view(a, today)).filter(p => p.grants.length), capabilities: CAPS.map(c => ({ id: c.id, label: c.label, give: !!c.give })) };
}

/** Give, take away, or put back to what their roles give (effect ''), one capability for one person. The head. */
export async function accessSet(d, ctx, req) {
  const db = ctx.db, id = String(d.capability || ''), effect = String(d.effect ?? '');
  const cap = BY_ID[id];
  if (!cap) throw invalid({ path: 'capability', message: 'Not a capability.' });
  if (!['allow', 'deny', ''].includes(effect)) throw invalid({ path: 'effect', message: 'Give, take away, or as their role.' });
  if (effect === 'allow' && !cap.give) throw invalid({ path: 'effect', message: `${cap.label} can only be taken away; it comes with a role.` });
  const until = String(d.until || '');
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw invalid({ path: 'until', message: 'A date, as 2026-12-31.' });
  if (until && until < isoIst(ctx.now()).slice(0, 10)) throw invalid({ path: 'until', message: 'That date has passed.' });
  const reason = cleanName(d.reason || '');
  const a = await one(db, 'SELECT login, name, is_master, role, grants FROM accounts WHERE login = ?', String(d.login || ''));
  if (!a) throw apiError('NOT_FOUND', 'No such person.');
  if (a.is_master || a.role === 'MASTER') throw apiError('CONFLICT', 'An IYF head\'s powers are managed by the heads (Staff), not here.');
  let g = {}; try { g = a.grants ? JSON.parse(a.grants) : {}; } catch { g = {}; }
  const before = g[id] || null;
  if (effect) g[id] = { effect, until }; else delete g[id];
  const value = Object.keys(g).length ? JSON.stringify(g) : '';
  await db.batch([
    q(db, 'UPDATE accounts SET grants = ?, updated_at = ?, updated_by = ? WHERE login = ?', value, isoIst(ctx.now()), ctx.login, a.login),
    audit(db, ctx, 'access.set', a.login, '', { [id]: before }, { [id]: effect ? { effect, until } : null }, reason, req.requestId),
    dirty(db, 'accounts', 'audit_log')]);
  return accessGet({ login: a.login }, ctx);
}

/* ------------------------------------------------------------------------ */
/* Roles given from Access (ADR 0019, the head, 26 Oct 2026)                 */
/* ------------------------------------------------------------------------ */
// "I assign HG Vilas Padmanabha Prabhuji as SPS coordinator, and in his own login he sees the features this holds; on
// revoking he sees only the normal user menus." A role stays stored where it always was (batches.coordinator_logins,
// leaders), so every handler and screen keeps working as it did. Access adds which of the role's rights come with it
// (a deny for each one left out, an allow for each extra one ticked) and an optional end date, `@<role>` on the same
// accounts.grants value. Revoking takes the role and every change that came only with it, so nothing stays behind to
// come back when the person is given a batch again. Facilitator rights: later (the head, 26 Oct).

/** The roles Access gives. `caps`: what the role brings (all ticked unless unticked); `extra`: may be added to it. */
export const ROLES = {
  coordinator: { label: 'Coordinator', training: false,
    caps: ['signups', 'resets', 'fillFor', 'attendance', 'leaders', 'devoteeEdit', 'deleteAccounts', 'promote', 'exports'],
    extra: ['attendanceLate', 'reopen', 'exportsPersonal', 'reports'] },
  training: { label: 'Training coordinator', training: true,
    caps: ['attendance', 'enrol', 'promote', 'exports'], extra: ['attendanceLate', 'exportsPersonal', 'reports'] },
  leader: { label: 'Group leader', caps: [], extra: [] },
  // "similar to the ETP coordinator … the FTP coordinator defines the existing facilitators and sees the scoreboards of
  // all in one view; original facilitators, who work on phases, not custom dates" (the head, 26 Oct 2026)
  ftp: { label: 'FTP coordinator', global: true, caps: ['facBoard', 'facManage', 'targetsOpen'], extra: [] }
};
const BATCH_ROLES = ['coordinator', 'training'];
const parse = (v) => { try { const g = v ? JSON.parse(v) : {}; return g && typeof g === 'object' ? g : {}; } catch { return {}; } };
const kindOf = (batchId) => (isTrainingBatch(batchId) ? 'training' : 'coordinator');
const today = (ctx) => isoIst(ctx.now()).slice(0, 10);

/**
 * After the session is read (api.js handle): a role past its end date no longer counts — its batches leave the
 * scopes on this very call, before the daily job removes it for good — and the scopes carry the person's rights,
 * so the app's menus show only what the server would allow. No read: everything comes from the account row.
 */
export function withAccess(ctx) {
  const s = ctx.scopes;
  if (!s || !ctx.acct) return;
  const g = parse(ctx.acct.grants), day = today(ctx), ended = (r) => !!g['@' + r]?.until && g['@' + r].until < day;
  if (!s.master) for (const r of BATCH_ROLES) if (ended(r)) s.coordinator = s.coordinator.filter((b) => kindOf(b) !== r);
  if (ended('leader')) s.groupLeader = null;
  s.ftp = !s.master && !!g['@ftp'] && !ended('ftp');
  s.rights = grantsOf(ctx.acct, day);
}

/** The person Access gives a role to: an approved person, never a head (heads hold everything already). */
async function roleTarget(db, login) {
  const a = await one(db, 'SELECT * FROM accounts WHERE login = ?', String(login || ''));
  if (!a || a.login.startsWith('deleted-')) throw apiError('NOT_FOUND', 'No such person.');
  if (a.status === 'PENDING' || a.status === 'REJECTED') throw apiError('CONFLICT', `${a.name} is not approved yet.`);
  if (a.is_master || a.role === 'MASTER') throw apiError('CONFLICT', 'An IYF head already holds every role.');
  return a;
}

/** Statements taking `role` from the person `a` (whose grants are `g`, changed in place), and what it held. */
async function revokeStmts(ctx, a, g, role) {
  const db = ctx.db, out = [];
  let held;
  if (ROLES[role].global) {
    held = g['@' + role] ? true : null;
    for (const id of [...ROLES[role].caps, ...ROLES[role].extra]) delete g[id];
  } else if (role === 'leader') {
    held = (await one(db, 'SELECT batch_id FROM leaders WHERE login = ?', a.login))?.batch_id || null;
    if (held) out.push(q(db, 'DELETE FROM leaders WHERE login = ?', a.login),
      q(db, "UPDATE memberships SET leader_login = '' WHERE leader_login = ? AND to_week = ''", a.login));
  } else {
    const mine = (await batchesAll(db)).filter((b) => csv(b.coordinator_logins).includes(a.login)).map((b) => b.batch_id);
    held = mine.filter((b) => kindOf(b) === role);
    const keep = mine.filter((b) => kindOf(b) !== role);
    out.push(...(await setCoordinatorBatches(ctx, a.login, keep)));
    // the rights that came only with this role go with it; a right the other role also uses stays while it is held
    const other = BATCH_ROLES.find((r) => r !== role), shared = keep.length ? [...ROLES[other].caps, ...ROLES[other].extra] : [];
    for (const id of [...ROLES[role].caps, ...ROLES[role].extra]) if (!shared.includes(id)) delete g[id];
  }
  delete g['@' + role];
  return { out, held };
}

const rightsOf = (d, R) => {
  if (!Array.isArray(d.rights)) throw invalid({ path: 'rights', message: 'Choose the rights.' });
  const rights = d.rights.map(String), offer = [...R.caps, ...R.extra], odd = rights.find((id) => !offer.includes(id));
  if (odd) throw invalid({ path: 'rights', message: `${BY_ID[odd]?.label || odd} does not come with this role.` });
  return rights;
};

/** Give a role, or change the batches, rights or end date of one the person holds. The head. */
export async function accessAssign(d, ctx, req) {
  const db = ctx.db, role = String(d.role || ''), R = ROLES[role];
  if (!R) throw invalid({ path: 'role', message: 'Choose a role.' });
  const until = String(d.until || ''), day = today(ctx);
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw invalid({ path: 'until', message: 'A date, as 2026-12-31.' });
  if (until && until < day) throw invalid({ path: 'until', message: 'That date has passed.' });
  const reason = cleanName(d.reason || '');
  let a = await roleTarget(db, d.login);
  const before = parse(a.grants), g = parse(a.grants), stmts = [];
  let after;
  if (R.global) {
    if (d.batchIds !== undefined) throw invalid({ path: 'batchIds', message: `${R.label} is for all of IYF; there are no batches to choose.` });
    const rights = rightsOf(d, R);
    for (const id of R.caps) { if (rights.includes(id)) { if (g[id]?.effect === 'deny') delete g[id]; } else g[id] = { effect: 'deny', until: '' }; }
    after = { rights };
  } else if (role === 'leader') {
    if (d.batchIds !== undefined || d.rights !== undefined) throw invalid({ path: 'role', message: 'A group leader leads in their own batch; there is nothing to choose.' });
    await leadersSet({ login: a.login, leader: true }, ctx, req);              // checks they are a devotee in a batch
    after = { batchId: (await one(db, 'SELECT batch_id FROM leaders WHERE login = ?', a.login))?.batch_id };
  } else {
    if (a.facilitator_name) throw apiError('CONFLICT', `${a.name}'s login is a facilitator login. Manage it under Admin › Facilitators.`);
    const ids = await checkBatchIds(db, d.batchIds);
    if (!ids.length) throw invalid({ path: 'batchIds', message: 'Choose at least one batch.' });
    const wrong = ids.find((b) => kindOf(b) !== role);
    if (wrong) throw invalid({ path: 'batchIds', message: `${wrong} is ${role === 'training' ? 'not a training' : 'a training'} batch.` });
    const rights = rightsOf(d, R);
    const mine = (await batchesAll(db)).filter((b) => csv(b.coordinator_logins).includes(a.login)).map((b) => b.batch_id);
    stmts.push(...(await setCoordinatorBatches(ctx, a.login, [...mine.filter((b) => kindOf(b) !== role), ...ids])));
    for (const id of R.caps) { if (rights.includes(id)) { if (g[id]?.effect === 'deny') delete g[id]; } else g[id] = { effect: 'deny', until: '' }; }
    for (const id of R.extra) { if (rights.includes(id)) g[id] = { effect: 'allow', until }; else if (g[id]?.effect === 'allow') delete g[id]; }
    after = { batchIds: ids, rights };
  }
  g['@' + role] = { until, at: isoIst(ctx.now()), by: ctx.login, reason };
  stmts.push(q(db, 'UPDATE accounts SET grants = ?, updated_at = ?, updated_by = ? WHERE login = ?', JSON.stringify(g), isoIst(ctx.now()), ctx.login, a.login),
    audit(db, ctx, 'access.assign', a.login, '', { [role]: before['@' + role] || null }, { [role]: { ...after, until } }, reason, req.requestId),
    dirty(db, 'accounts', 'batches', 'audit_log'));
  await db.batch(stmts);
  return accessGet({ login: a.login }, ctx);
}

/** Take a role away, and with it every right that came only with it. The head. */
export async function accessRevoke(d, ctx, req) {
  const db = ctx.db, role = String(d.role || '');
  if (!ROLES[role]) throw invalid({ path: 'role', message: 'Choose a role.' });
  const a = await roleTarget(db, d.login), g = parse(a.grants);
  const { out, held } = await revokeStmts(ctx, a, g, role);
  if (!(Array.isArray(held) ? held.length : held)) throw apiError('CONFLICT', `${a.name} is not a ${ROLES[role].label.toLowerCase()}.`);
  await db.batch([...out,
    q(db, 'UPDATE accounts SET grants = ?, updated_at = ?, updated_by = ? WHERE login = ?', Object.keys(g).length ? JSON.stringify(g) : '', isoIst(ctx.now()), ctx.login, a.login),
    audit(db, ctx, 'access.revoke', a.login, '', { [role]: held }, { [role]: null }, cleanName(d.reason || ''), req.requestId),
    dirty(db, 'accounts', 'batches', 'audit_log')]);
  return accessGet({ login: a.login }, ctx);
}

/** The daily job (index.js): a role past its end date is taken away, as if the head revoked it that night. */
export async function expireRoles(db, now) {
  const ctx = { db, now: () => now, login: 'SYSTEM', role: 'SYSTEM' }, day = today(ctx), done = [];
  for (const a of await all(db, `SELECT login, name, grants FROM accounts WHERE grants LIKE '%"@%'`)) {
    const g = parse(a.grants), ended = Object.keys(ROLES).filter((r) => g['@' + r]?.until && g['@' + r].until < day);
    if (!ended.length) continue;
    const stmts = [];
    for (const r of ended) {
      const { out, held } = await revokeStmts(ctx, a, g, r);
      stmts.push(...out, audit(db, ctx, 'access.revoke', a.login, '', { [r]: held }, { [r]: null }, 'end date passed', ''));
    }
    stmts.push(q(db, 'UPDATE accounts SET grants = ?, updated_at = ?, updated_by = ? WHERE login = ?', Object.keys(g).length ? JSON.stringify(g) : '', isoIst(now), 'SYSTEM', a.login),
      dirty(db, 'accounts', 'batches', 'audit_log'));
    await db.batch(stmts);
    done.push(`${a.login}:${ended.join('+')}`);
  }
  return done.join(' ');
}
