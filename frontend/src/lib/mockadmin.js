// Mock of the newer server actions (worker/src/push.js, coord.js master oversight, weeks.js onBehalfOf):
// filling a devotee's week on their behalf, the 9 PM reminder subscriptions, all-batch stats, the activity (audit)
// log, the slow / failed request log, and the master's settings. Dev and tests only.
import { _state, nowD, isoIst, validWeekId } from './mockweeks.js';
import { setWindowSpecs } from './mockweeks.js';
import { CAPS, ROLES } from './mockfields.js';

const dk = (login, w) => login + '|' + w;
const PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)\//;
const SPEC = /^(MON|TUE|WED|THU|FRI|SAT|SUN) ([01]\d|2[0-3]):[0-5]\d$/;
// what the activity log records for a write (never a password)
const LOGGED = ['requests.approve', 'requests.reject', 'resets.approve', 'resets.reject', 'attendance.set', 'attendance.override', 'devotees.setPeople', 'devotees.setActive',
  'devotees.setDisabled', 'devotees.delete', 'weeks.setClass', 'weeks.reopen', 'reopen.request', 'reopen.reject', 'coordinators.create', 'coordinators.update',
  'coordinators.setDisabled', 'coordinators.resetPassword', 'batches.update', 'batches.create', 'ids.link', 'ids.unlink', 'settings.update', 'week.submit', 'week.saveDay', 'photo.remove'];

export function installAdmin(A, h) {
  const db = h.db;
  let audit, runlog, push, settings, nextId;
  const log = (row) => audit.push({ id: nextId++, at: isoIst(nowD()), role: 'COORDINATOR', batchId: '', before: null, after: null, reason: '', ...row });
  function init() {
  audit = []; push = new Map(); nextId = 1;
  settings = { submit_opens: 'SUN 18:00', submit_closes: 'MON 21:00', tracking_from: '2026-08-31', reminder_time: '21:00', registry_refresh: '2026-10-03T04:00:00+05:30 · 1,284 IDs' };
  // the window the mock ENFORCES follows these settings, as the server's does (mockweeks.js setWindowSpecs)
  setWindowSpecs(() => ({ opens: settings.submit_opens, closes: settings.submit_closes }));
  // a little history to look at
  const seedAt = (minsAgo) => isoIst(new Date(nowD().getTime() - minsAgo * 60e3));
  [['sps', 'requests.approve', '6000000021', 'SPS', null, { status: 'ACTIVE', iyf_id: 'IYFD-2026-0120' }, '', 3000],
   ['sps', 'attendance.set', '6000000013', 'SPS', null, { mark: 'P' }, '', 1500],
   ['master', 'coordinators.update', 'meera', '', { batchIds: ['DPS', 'BSS'] }, { batchIds: ['DPS'] }, '', 900],
   ['master', 'weeks.reopen', '6000000016', 'SPS', { status: 'MISSED' }, { openUntil: '2026-09-30T21:00:00+05:30' }, 'Was unwell', 600],
   ['sps', 'devotees.setPeople', '6000000012', 'SPS', { classDay: 'SAT' }, { classDay: 'SUN' }, '', 240],
   ['sps', 'week.submit', '6000000013', 'SPS', null, { onBehalfOf: '6000000013' }, 'filled by the coordinator', 120]]
    .forEach(([who, action, target, batchId, before, after, reason, m]) => audit.push({ id: nextId++, at: seedAt(m), who, role: who === 'master' ? 'MASTER' : 'COORDINATOR', action, target, batchId, before, after, reason }));
  runlog = [{ at: seedAt(50), action: 'devotees.list', ms: 2840, ok: true, errorCode: '', detail: 'slow', app: 'b-2026-10-02' },
    { at: seedAt(400), action: 'week.saveDay', ms: 120, ok: false, errorCode: 'STALE', detail: 'changed on another device', app: 'b-2026-10-02' },
    { at: seedAt(1300), action: 'registry.search', ms: 3120, ok: true, errorCode: '', detail: 'slow', app: 'b-2026-10-01' }];
  }
  init();

  // ---- on behalf: a coordinator (or the master) fills an active devotee's week; same rules, own login kept ----
  function behalf(d, u) {
    if (d.onBehalfOf === undefined || String(d.onBehalfOf) === u.login) return { t: u };
    if (!h.scopesOf(u).master && !h.scopesOf(u).coordinator.length) return { err: h.fail('FORBIDDEN', 'You can fill only your own form.') };
    const t = db().users[String(d.onBehalfOf)];
    if (!t || t.role !== 'DEVOTEE') return { err: h.fail('NOT_FOUND', 'No devotee with that phone.') };
    if (t.status !== 'ACTIVE') return { err: h.fail('CONFLICT', 'That devotee is not active.') };
    const b = (t.memberships || []).find((m) => !m.toWeek)?.batchId || t.batchId;
    if (!h.batchIdsOf(u).includes(b)) return { err: h.fail('FORBIDDEN', 'That devotee is not in your batches.') };
    return { t, behalf: true };
  }
  for (const name of ['week.get', 'week.saveDay', 'week.saveWeekEnd', 'week.submit', 'history.list', 'rules.get', 'journals.get']) {
    const [roles, fn, mc] = A[name];
    A[name] = [roles, (d, u, tok) => {
      const r = behalf(d, u); if (r.err) return r.err;
      const out = fn(d, r.t, tok);
      if (r.behalf && out.ok && name === 'week.submit') { const s = _state().subs.get(dk(r.t.login, d.weekId)); if (s) s.onBehalf = true; }
      return out;
    }, mc];
  }

  // ---- the activity log: every logged write, newest first ----
  for (const name of LOGGED) {
    if (!A[name]) continue;
    const [roles, fn, mc] = A[name];
    A[name] = [roles, (d, u, tok) => {
      const out = fn(d, u, tok);
      if (out.ok && u && !(name === 'week.saveDay' && !d.onBehalfOf)) {
        const { __token, password, tempPassword, newPassword, day, ...rest } = d;
        log({ who: u.login, role: u.role, action: name, target: String(d.login || d.phone || d.username || d.onBehalfOf || d.iyfId || d.batchId || ''), batchId: d.batchId || '',
          after: Object.keys(rest).length ? rest : null, reason: d.reason || (d.onBehalfOf ? 'filled by the coordinator' : '') });
      }
      return out;
    }, mc];
  }

  // ---- the 9 PM reminder ----
  A['push.subscribe'] = [['DEVOTEE', 'COORDINATOR', 'MASTER'], (d, u) => {
    const ep = String(d.endpoint || ''), k = d.keys && typeof d.keys === 'object' ? d.keys : {};
    if (!PUSH_HOSTS.test(ep) || ep.length > 600) return h.fieldFail([['endpoint', 'Not a push address from a known browser.']]);
    if (!/^[A-Za-z0-9_-]{60,120}$/.test(String(k.p256dh || '')) || !/^[A-Za-z0-9_-]{12,40}$/.test(String(k.auth || ''))) return h.fieldFail([['keys', 'Bad keys.']]);
    if ([...push.entries()].filter(([e, l]) => l === u.login && e !== ep).length >= 5) return h.fail('CONFLICT', 'The reminder is on for 5 devices already. Turn it off on one first.');
    push.set(ep, u.login);
    return h.ok({ on: true, time: settings.reminder_time });
  }];
  // a phone with nobody signed in; logging out detaches; switching off removes the phone (as the server does)
  A['push.register'] = [null, (d) => { const ep = String(d.endpoint || ''); if (!PUSH_HOSTS.test(ep)) return h.fieldFail([['endpoint', 'Not a push address from a known browser.']]); if (!push.has(ep)) push.set(ep, ''); return h.ok({ on: true, time: settings.reminder_time }); }];
  A['push.detach'] = [['DEVOTEE', 'COORDINATOR', 'MASTER'], (d, u) => { const ep = String(d.endpoint || ''); if (push.get(ep) === u.login) push.set(ep, ''); return h.ok({ on: true }); }];
  A['push.unsubscribe'] = [null, (d) => { push.delete(String(d.endpoint || '')); return h.ok({ on: false }); }];
  A['push.message'] = [null, () => h.ok({ title: "Hare Krishna! Today's sadhana", body: 'Fill your daily sadhana in a minute. Tap to open the app.', url: '/#/home', tag: 'sadhana-reminder' })];

  // ---- master oversight ----
  A['stats.all'] = [['MASTER'], (d, u, tok) => {
    const n = d.weeks === undefined ? 8 : d.weeks;
    if (!Number.isInteger(n) || n < 1 || n > 26) return h.fieldFail([['weeks', '1 to 26.']]);
    const out = [];
    for (const b of db().batches.filter((x) => x.active)) {
      const s = A['stats.batch'][1]({ batchId: b.batchId, weeks: n }, u, tok);
      if (!s.ok) return s;
      const x = s.data;
      out.push({ batchId: b.batchId, name: b.name, level: b.level || '', weekId: x.weekId, thisWeek: x.thisWeek,
        // the server's shape (oversight.js statsAll): active = expected this week; activeNow / inactive = the open memberships now (Phase 22 I3)
        people: { active: x.thisWeek.expected, pending: x.people.pending, activeNow: x.people.active, inactive: x.people.inactive }, trend: x.trend.map((t) => ({ weekId: t.weekId, filledPct: t.filledPct, missed: t.missed })), missed: x.missedLog.length });
    }
    const sum = (k) => out.reduce((a, b) => a + (b.thisWeek[k] || 0), 0);
    return h.ok({ batches: out, totals: { expected: sum('expected'), submitted: sum('submitted'), draft: sum('draft'), notStarted: sum('notStarted'), missed: sum('missed'),
      active: out.reduce((a, b) => a + b.people.active, 0), pending: out.reduce((a, b) => a + b.people.pending, 0),
      activeNow: out.reduce((a, b) => a + b.people.activeNow, 0), inactive: out.reduce((a, b) => a + b.people.inactive, 0) } });
  }];
  // permissions per person (worker grants.js, ADR 0015)
  const CAPV = () => CAPS.map((c) => ({ id: c.id, label: c.label, give: c.give }));
  const accView = (u) => ({ login: u.login, name: u.name, role: u.role, status: u.status, master: u.role === 'MASTER' || !!u.isMaster, facilitator: u.facilitatorName || '',
    grants: Object.entries(u.grants || {}).filter(([id]) => CAPS.some((c) => c.id === id)).map(([id, v]) => ({ id, effect: v.effect, until: v.until || '', ended: !!v.until && v.until < isoIst(nowD()).slice(0, 10) })) });
  A['access.search'] = [['MASTER'], (d) => {
    const term = String(d.q || '').trim().toLowerCase();
    if (term.length < 2) return h.fieldFail([['q', 'Type at least two letters.']]);
    return h.ok({ people: Object.values(db().users).filter((u) => !String(u.login).startsWith('deleted-') && (u.name.toLowerCase().includes(term) || String(u.login).startsWith(term)))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20).map(accView) });
  }];
  A['access.get'] = [['MASTER'], (d) => {
    const u = db().users[String(d.login || '')]; if (!u) return h.fail('NOT_FOUND', 'No such person.');
    const day = isoIst(nowD()).slice(0, 10), g = u.grants || {}, meta = (r) => ({ until: g['@' + r]?.until || '', ended: !!g['@' + r]?.until && g['@' + r].until < day });
    const coordinates = db().batches.filter((b) => b.coordinator === u.login || (u.coordinates || []).includes(b.batchId)).map((b) => ({ batchId: b.batchId, name: b.name }));
    const lead = h.leaderBatch(u.login);
    const roles = [
      ...['coordinator', 'training'].map((r) => ({ role: r, label: ROLES[r].label, batches: coordinates.filter((b) => kindOf(b.batchId) === r), ...meta(r) })).filter((r) => r.batches.length),
      ...(g['@ftp'] ? [{ role: 'ftp', label: ROLES.ftp.label, batches: [], ...meta('ftp') }] : []),
      ...(lead ? [{ role: 'leader', label: ROLES.leader.label, batches: db().batches.filter((b) => b.batchId === lead).map((b) => ({ batchId: b.batchId, name: b.name })), ...meta('leader') }] : [])];
    // only what can really be given to this person (worker grants.js accessGet, the head 27 Oct 2026)
    const running = db().batches.filter((b) => b.active && !b.closedAt);
    const approved = u.status !== 'PENDING' && u.status !== 'REJECTED' && u.role !== 'MASTER' && !u.isMaster;
    const can = {
      coordinator: approved && !u.facilitatorName && running.some((b) => kindOf(b.batchId) !== 'training'),
      training: approved && !u.facilitatorName && running.some((b) => kindOf(b.batchId) === 'training'),
      leader: approved && u.status === 'ACTIVE' && u.role === 'DEVOTEE' && !!u.batchId && kindOf(u.batchId) !== 'training',
      ftp: approved
    };
    const general = CAPS.filter((c) => !Object.values(ROLES).some((R) => [...R.caps, ...R.extra].includes(c.id))).map((c) => c.id);
    const held = new Set(roles.map((r) => r.role));
    const applies = new Set([...general, ...[...held].flatMap((r) => [...ROLES[r].caps, ...ROLES[r].extra]), ...(held.has('leader') ? ['attendance'] : []),
      ...(u.facilitatorName ? ['reports'] : []),   // grants.js: a right marked `facilitators` (Reports) may be given to a facilitator login
      ...Object.keys(g).filter((k) => CAPS.some((c) => c.id === k))]);
    return h.ok({ ...accView(u), coordinates, roles, labels: Object.fromEntries(CAPS.map((c) => [c.id, c.label])),
      capabilities: CAPS.filter((c) => applies.has(c.id)).map((c) => ({ id: c.id, label: c.label, give: !!c.give && ([...held].some((r) => ROLES[r].extra.includes(c.id)) || (c.id === 'reports' && !!u.facilitatorName)) })),
      roleDefs: Object.entries(ROLES).filter(([id]) => can[id] || held.has(id)).map(([id, R]) => ({ id, label: R.label, caps: R.caps, extra: R.extra, global: !!R.global })),
      batches: db().batches.filter((b) => b.active).map((b) => ({ batchId: b.batchId, name: b.name, training: kindOf(b.batchId) === 'training' })) });
  }];
  // roles given from Access (worker grants.js accessAssign / accessRevoke, ADR 0019)
  const kindOf = (b) => (/^ETP-\d+$/.test(String(b || '')) ? 'training' : 'coordinator');
  const roleTarget = (login) => {
    const u = db().users[String(login || '')];
    if (!u || String(u.login).startsWith('deleted-')) return [null, h.fail('NOT_FOUND', 'No such person.')];
    if (u.status === 'PENDING' || u.status === 'REJECTED') return [null, h.fail('CONFLICT', `${u.name} is not approved yet.`)];
    if (u.role === 'MASTER' || u.isMaster) return [null, h.fail('CONFLICT', 'An IYF head already holds every role.')];
    return [u, null];
  };
  const heldOf = (u, role) => db().batches.filter((b) => (b.coordinator === u.login || (u.coordinates || []).includes(b.batchId)) && kindOf(b.batchId) === role).map((b) => b.batchId);
  const takeRole = (u, role) => {
    const g = { ...(u.grants || {}) };
    if (ROLES[role].global) { for (const id of [...ROLES[role].caps, ...ROLES[role].extra]) delete g[id]; }
    else if (role === 'leader') { if (h.leaderBatch(u.login)) A['leaders.set'][1]({ login: u.login, leader: false }, db().users.master); }
    else {
      const held = heldOf(u, role);
      for (const b of db().batches) if (held.includes(b.batchId) && b.coordinator === u.login) b.coordinator = null;
      u.coordinates = (u.coordinates || []).filter((b) => !held.includes(b));
      const other = role === 'coordinator' ? 'training' : 'coordinator', shared = heldOf(u, other).length ? [...ROLES[other].caps, ...ROLES[other].extra] : [];
      for (const id of [...ROLES[role].caps, ...ROLES[role].extra]) if (!shared.includes(id)) delete g[id];
    }
    delete g['@' + role];
    u.grants = g;
  };
  A['access.assign'] = [['MASTER'], (d) => {
    const role = String(d.role || ''), R = ROLES[role];
    if (!R) return h.fieldFail([['role', 'Choose a role.']]);
    const until = String(d.until || ''), day = isoIst(nowD()).slice(0, 10);
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return h.fieldFail([['until', 'A date, as 2026-12-31.']]);
    if (until && until < day) return h.fieldFail([['until', 'That date has passed.']]);
    const [u, err] = roleTarget(d.login); if (err) return err;
    const g = { ...(u.grants || {}) };
    if (R.global) {
      if (d.batchIds !== undefined) return h.fieldFail([['batchIds', `${R.label} is for all of IYF; there are no batches to choose.`]]);
      if (!Array.isArray(d.rights)) return h.fieldFail([['rights', 'Choose the rights.']]);
      const rights = d.rights.map(String), odd = rights.find((id) => !R.caps.includes(id));
      if (odd) return h.fieldFail([['rights', `${CAPS.find((c) => c.id === odd)?.label || odd} does not come with this role.`]]);
      for (const id of R.caps) { if (rights.includes(id)) { if (g[id]?.effect === 'deny') delete g[id]; } else g[id] = { effect: 'deny', until: '' }; }
    } else if (role === 'leader') {
      if (d.batchIds !== undefined || d.rights !== undefined) return h.fieldFail([['role', 'A group leader leads in their own batch; there is nothing to choose.']]);
      const r = A['leaders.set'][1]({ login: u.login, leader: true }, db().users.master); if (!r.ok) return r;
    } else {
      if (u.facilitatorName) return h.fail('CONFLICT', `${u.name}'s login is a facilitator login. Manage it under Admin › Facilitators.`);
      if (!Array.isArray(d.batchIds)) return h.fieldFail([['batchIds', 'Choose the batches.']]);
      const unknown = d.batchIds.find((b) => !db().batches.some((x) => x.batchId === String(b)));
      if (unknown) return h.fieldFail([['batchIds', `Unknown batch ${unknown}.`]]);
      const ids = d.batchIds.map(String);
      if (!ids.length) return h.fieldFail([['batchIds', 'Choose at least one batch.']]);
      const wrong = ids.find((b) => kindOf(b) !== role);
      if (wrong) return h.fieldFail([['batchIds', `${wrong} is ${role === 'training' ? 'not a training' : 'a training'} batch.`]]);
      if (!Array.isArray(d.rights)) return h.fieldFail([['rights', 'Choose the rights.']]);
      const rights = d.rights.map(String), offer = [...R.caps, ...R.extra], odd = rights.find((id) => !offer.includes(id));
      if (odd) return h.fieldFail([['rights', `${CAPS.find((c) => c.id === odd)?.label || odd} does not come with this role.`]]);
      const held = heldOf(u, role);
      for (const b of db().batches) if (held.includes(b.batchId) && !ids.includes(b.batchId) && b.coordinator === u.login) b.coordinator = null;
      u.coordinates = [...(u.coordinates || []).filter((b) => kindOf(b) !== role), ...ids];
      for (const id of R.caps) { if (rights.includes(id)) { if (g[id]?.effect === 'deny') delete g[id]; } else g[id] = { effect: 'deny', until: '' }; }
      for (const id of R.extra) { if (rights.includes(id)) g[id] = { effect: 'allow', until }; else if (g[id]?.effect === 'allow') delete g[id]; }
    }
    g['@' + role] = { until, at: isoIst(nowD()), by: 'master', reason: String(d.reason || '') };
    u.grants = g;
    log({ who: 'master', role: 'MASTER', action: 'access.assign', target: u.login, reason: String(d.reason || '') });
    return A['access.get'][1]({ login: u.login });
  }];
  A['access.revoke'] = [['MASTER'], (d) => {
    const role = String(d.role || '');
    if (!ROLES[role]) return h.fieldFail([['role', 'Choose a role.']]);
    const [u, err] = roleTarget(d.login); if (err) return err;
    const held = ROLES[role].global ? !!u.grants?.['@' + role] : role === 'leader' ? h.leaderBatch(u.login) : heldOf(u, role).length;
    if (!held) return h.fail('CONFLICT', `${u.name} is not a ${ROLES[role].label.toLowerCase()}.`);
    takeRole(u, role);
    log({ who: 'master', role: 'MASTER', action: 'access.revoke', target: u.login, reason: String(d.reason || '') });
    return A['access.get'][1]({ login: u.login });
  }];
  A['access.list'] = [['MASTER'], () => h.ok({ people: Object.values(db().users).filter((u) => u.grants && Object.keys(u.grants).length).map(accView), capabilities: CAPV() })];
  A['access.set'] = [['MASTER'], (d) => {
    const cap = CAPS.find((c) => c.id === d.capability);
    if (!cap) return h.fieldFail([['capability', 'Not a capability.']]);
    const effect = String(d.effect ?? '');
    if (!['allow', 'deny', ''].includes(effect)) return h.fieldFail([['effect', 'Give, take away, or as their role.']]);
    if (effect === 'allow' && !cap.give) return h.fieldFail([['effect', `${cap.label} can only be taken away; it comes with a role.`]]);
    const until = String(d.until || '');
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return h.fieldFail([['until', 'A date, as 2026-12-31.']]);
    if (until && until < isoIst(nowD()).slice(0, 10)) return h.fieldFail([['until', 'That date has passed.']]);
    const u = db().users[String(d.login || '')]; if (!u) return h.fail('NOT_FOUND', 'No such person.');
    if (u.role === 'MASTER' || u.isMaster) return h.fail('CONFLICT', "An IYF head's powers are managed by the heads (Staff), not here.");
    u.grants = { ...(u.grants || {}) };
    if (effect) u.grants[cap.id] = { effect, until }; else delete u.grants[cap.id];
    return A['access.get'][1]({ login: u.login });
  }];
  A['audit.list'] = [['MASTER'], (d) => {
    const limit = d.limit === undefined ? 50 : d.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return h.fieldFail([['limit', '1 to 200.']]);
    let rows = [...audit].sort((a, b) => b.id - a.id);
    if (d.who) rows = rows.filter((r) => r.who === String(d.who));
    if (d.what) rows = rows.filter((r) => r.action.startsWith(String(d.what)));
    if (d.target) rows = rows.filter((r) => r.target === String(d.target));
    if (d.from) rows = rows.filter((r) => r.at >= String(d.from));
    if (d.to) rows = rows.filter((r) => r.at <= String(d.to) + '~');
    if (d.before) rows = rows.filter((r) => r.id < Number(d.before));
    const nm = (l) => db().users[String(l || '')]?.name || '';
    // the search box (oversight.js auditList): action, reason, target, and the people's names; or a wording match
    const qs = String(d.q ?? '').trim();
    if (d.q !== undefined && qs.length === 1) return h.fieldFail([['q', 'Type at least two letters.']]);
    const acts = Array.isArray(d.actions) ? d.actions : [];
    if (qs || acts.length) {
      const has = (x) => String(x || '').toLowerCase().includes(qs.toLowerCase());
      rows = rows.filter((r) => acts.includes(r.action) || (qs && (has(r.action) || has(r.reason) || has(r.target) || has(nm(r.who)) || has(nm(r.target)) || r.who === qs)));
    }
    return h.ok({ rows: rows.slice(0, limit).map((r) => ({ ...r, whoName: nm(r.who), targetName: nm(r.target) })), more: rows.length > limit });
  }];
  A['runlog.list'] = [['MASTER'], (d) => {
    const limit = d.limit === undefined ? 50 : d.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return h.fieldFail([['limit', '1 to 200.']]);
    return h.ok({ rows: runlog.slice(0, limit) });
  }];
  const view = () => ({ submitWindow: { opens: settings.submit_opens, closes: settings.submit_closes }, trackingFrom: settings.tracking_from || null,
    reminderTime: settings.reminder_time, registryRefresh: settings.registry_refresh, pushDevices: push.size, logRetentionMonths: Number(settings.log_retention_months || 6),
    // roadmap 6.6: the sampled refusal counters; a quiet hour in the mock
    refusals: { hour: new Date().toISOString().slice(0, 13), sampled: true, forbidden: 0, unauthenticated: 0, stale: 0 },
    // F5 (22 Oct 2026), as the server: scheduled jobs that failed, newest first — none in the mock
    cronFailed: [] });
  A['settings.get'] = [['MASTER'], () => h.ok(view())];
  A['settings.update'] = [['MASTER'], (d, u) => {
    const set = {}, f = [];
    if (d.submitWindow !== undefined) {
      const w = d.submitWindow || {};
      if (!SPEC.test(String(w.opens || '').toUpperCase()) || !SPEC.test(String(w.closes || '').toUpperCase())) f.push(['submitWindow', 'Like "SUN 18:00" and "MON 21:00".']);
      else { set.submit_opens = String(w.opens).toUpperCase(); set.submit_closes = String(w.closes).toUpperCase(); }
    }
    if (d.trackingFrom !== undefined) {
      if (d.trackingFrom !== null && d.trackingFrom !== '' && !validWeekId(d.trackingFrom)) f.push(['trackingFrom', 'A Monday, or empty.']);
      else set.tracking_from = d.trackingFrom || '';
    }
    if (d.reminderTime !== undefined) {
      if (!/^(1[89]|2[0-2]):[0-5]\d$/.test(String(d.reminderTime))) f.push(['reminderTime', 'Between 18:00 and 22:59.']);
      else set.reminder_time = d.reminderTime;
    }
    if (d.logRetentionMonths !== undefined) {
      if (![3, 6, 12, 24].includes(d.logRetentionMonths)) f.push(['logRetentionMonths', 'One of 3, 6, 12, 24 months.']);
      else set.log_retention_months = String(d.logRetentionMonths);
    }
    if (f.length) return h.fieldFail(f);
    if (Object.keys(set).length) { const before = view(); Object.assign(settings, set); log({ who: u.login, role: 'MASTER', action: 'settings.update', target: 'settings', before, after: set }); }
    return h.ok(view());
  }];

  return { reset: init, reminderTime: () => settings.reminder_time,
           // meta.get carries the window so every screen can say the time the head set
           submitWindow: () => ({ opens: settings.submit_opens, closes: settings.submit_closes }) };
}
