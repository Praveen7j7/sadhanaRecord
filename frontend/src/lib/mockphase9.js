// Mock of the Phase 9 Stage B server actions (worker/src/exports.js, admin.js — app IDs and new IYF heads): the same
// rules, simple data. Dev and tests only.
import { nowD, isoIst } from './mockweeks.js';
import { EXPORT_FIELDS, FIXED_EXPORTS } from '$shared/exportfields.js';

export function installPhase9(A, h) {
  const db = h.db, MASTER = ['MASTER'], STAFF = ['COORDINATOR', 'MASTER'], ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'];
  const isHead = (u) => !!h.scopesOf(u).master;
  const myBatches = (u) => (isHead(u) ? db().batches.map((b) => b.batchId) : h.scopesOf(u).coordinator);
  const nameOf = (id) => db().batches.find((b) => b.batchId === id)?.name || id;
  const n = (s, k) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, k);      // a stable "random" number
  const openM = (u) => (u.memberships || []).find((m) => !m.toWeek) || { batchId: u.batchId, facilitator: u.facilitator || '', classDay: u.classDay || '', fromWeek: '2026-08-31' };
  const members = (batchId) => Object.values(db().users).filter((u) => u.role === 'DEVOTEE' && u.status === 'ACTIVE' && openM(u).batchId === batchId);

  /* ---- exports (item 21) ---- */
  A['exports.catalog'] = [STAFF, (d, u) => h.ok({
    grains: [{ id: 'people', label: 'One row per devotee' }, { id: 'weeks', label: 'One row per devotee per week' }, { id: 'days', label: 'One row per devotee per day' },
      ...(isHead(u) ? Object.entries(FIXED_EXPORTS).map(([id, label]) => ({ id, label, fixed: true })) : [])],
    fields: EXPORT_FIELDS.filter((f) => isHead(u) || !f.head).map((f) => ({ id: f.id, label: f.label, group: f.group, grains: [...f.grains].map((g) => ({ p: 'people', w: 'weeks', d: 'days' }[g])), ...(f.head ? { personal: true } : {}) })),
    batches: myBatches(u).map((id) => ({ id, name: nameOf(id) })), maxDays: 184, perHour: 20 })];
  const value = (id, x) => {
    const u = x.u, m = openM(u), p = u.profile || {}, s = n(u.login + (x.week || ''), 7);
    const V = { name: u.name, iyfId: u.iyfId || '', phone: u.login, batch: nameOf(m.batchId), whatsapp: u.whatsapp || u.login, email: u.email || '', classDay: m.classDay || 'SUN',
      facilitator: m.facilitator || '', groupLeader: '', status: 'active', since: m.fromWeek || '', dob: p.dob || '', bloodGroup: p.bloodGroup || '', address: p.address ? [p.address.line, p.address.area, p.address.city, p.address.state].filter(Boolean).join(', ') : '',
      pin: p.address?.pin || '', emergency: p.emergency ? `${p.emergency.name} · ${p.emergency.relation}` : '', emergencyPhone: p.emergency?.phone || '', parent: '',
      weeksSubmitted: 3 + (s % 4), weeksMissed: s % 2, daysFilled: 20 + (s % 9), avgOverall: 55 + (s % 40), avgBody: 50 + (s % 45), avgSoul: 60 + (s % 35), avgJapa: 60 + (s % 40), avgRounds: 8 + (s % 9), classesPresent: 3 + (s % 2), classesAbsent: s % 2,
      week: x.week, weekStatus: s % 7 === 0 ? 'Missed' : 'Submitted', weekDays: s % 7 === 0 ? 0 : 4 + (s % 4), overall: 50 + (s % 50), body: 50 + (s % 45), soul: 55 + (s % 40), bed: 60 + (s % 40), wakeUp: 55 + (s % 45), dayRest: 70 + (s % 30),
      japa: 60 + (s % 40), reading: 50 + (s % 50), hearing: 55 + (s % 45), seva: 60 + (s % 40), attendanceScore: s % 3 ? 100 : 0, weekRounds: 8 + (s % 9), sevaMin: 120 + s, hearingMin: 90 + s, readingMin: 80 + s,
      nightStay: 'YES', principles: 'YES', submittedAt: x.week ? x.week.replace(/-(\d\d)$/, (q, d) => '-' + d) + ' 19:30' : '', filledBy: '', attendance: s % 3 ? 'Present' : 'Absent', markedBy: s % 3 ? 'Self' : 'Coordinator',
      ownMark: s % 3 ? 'Present' : '', leaderMark: '', coordinatorMark: s % 3 ? '' : 'Absent', headMark: '',
      date: x.date, sleptAt: '22:' + String(s % 60).padStart(2, '0'), wokeAt: '04:' + String((s * 7) % 60).padStart(2, '0'), dayRestMin: 30, rounds: 8 + (s % 9), chantingDoneAt: '07:10', dayHearing: 30, dayReading: 30, dayService: 45,
      marksBed: 20 + (s % 6), marksWake: 20 + (s % 6), marksRest: 25, marksJapa: 20 + (s % 6), marksReading: 20, marksHearing: 20 };
    return V[id] ?? '';
  };
  const addDays = (iso, k) => new Date(Date.parse(iso + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
  const monday = (iso) => addDays(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const counts = new Map();
  A['exports.page'] = [STAFF, (d, u) => {
    const head = isHead(u), grain = d.grain, fixed = FIXED_EXPORTS[grain] !== undefined;
    if (!['people', 'weeks', 'days'].includes(grain) && !fixed) return h.fieldFail([['grain', 'Choose what each row is.']]);
    if (fixed && !head) return h.fail('FORBIDDEN', 'Only the IYF head can export this.');
    const code = { people: 'p', weeks: 'w', days: 'd' }[grain];
    const fields = fixed ? [] : (Array.isArray(d.fields) ? d.fields : []).map((id) => EXPORT_FIELDS.find((f) => f.id === id));
    if (!fixed && (!fields.length || fields.some((f) => !f || !f.grains.includes(code)))) return h.fieldFail([['fields', 'Choose the fields.']]);
    if (fields.some((f) => f.head) && !head) return h.fail('FORBIDDEN', 'Only the IYF head can export personal details.');
    const batches = fixed ? [] : (d.batchIds || []);
    if (!fixed && !batches.length) return h.fieldFail([['batchIds', 'Choose a batch.']]);
    if (batches.some((b) => !myBatches(u).includes(b))) return h.fail('FORBIDDEN', 'You can export only your own batches.');
    const ranged = grain === 'weeks' || grain === 'days' || grain === 'activity' || fields.some((f) => f.group === 'Sadhana summary');
    if (ranged && (!d.from || !d.to)) return h.fieldFail([['from', 'Choose the dates.']]);
    if (ranged && (Date.parse(d.to) - Date.parse(d.from)) / 864e5 > 184) return h.fieldFail([['to', 'At most 6 months at a time.']]);
    if (!d.cursor) { const k = u.login, c = (counts.get(k) || 0) + 1; counts.set(k, c); if (c > 20) return h.fail('BUSY', 'At most 20 exports an hour. Please try again later.'); }
    const out = (rows, next) => h.ok({ columns: fields.map((f) => f.label), rows: rows.map((x) => fields.map((f) => value(f.id, x))), next });
    if (grain === 'people') {
      const i = d.cursor ? Number(d.cursor) : 0, fac = d.filters?.facilitator;
      return out(members(batches[i]).filter((m) => !fac || openM(m).facilitator === fac).map((m) => ({ u: m })), i + 1 < batches.length ? String(i + 1) : null);
    }
    if (grain === 'weeks' || grain === 'days') {
      const first = monday(d.from), last = monday(d.to), week = d.cursor || first, next = addDays(week, 7) <= last ? addDays(week, 7) : null, fac = d.filters?.facilitator;
      let rows = batches.flatMap((b) => members(b)).filter((m) => !fac || openM(m).facilitator === fac).map((m) => ({ u: m, week }));
      if (d.filters?.status) rows = rows.filter((x) => (value('weekStatus', x) === 'Missed') === (d.filters.status === 'missed'));
      if (grain === 'days') rows = rows.filter((x) => value('weekStatus', x) !== 'Missed').flatMap((x) => [0, 1, 2, 3, 4, 5, 6].map((k) => ({ ...x, date: addDays(week, k) }))).filter((x) => x.date >= d.from && x.date <= d.to);
      return out(rows, next);
    }
    if (grain === 'staff') return h.ok({ columns: ['Username / phone', 'Name', 'Role', 'Batches', 'Facilitator', 'Status', 'Last sign-in'], next: null,
      rows: Object.values(db().users).filter((x) => x.role !== 'DEVOTEE' || x.facilitatorName).map((x) => [x.login, x.name, x.role === 'MASTER' ? 'IYF head' : x.facilitatorName ? 'TRD facilitator' : 'Coordinator', (h.batchIdsOf(x) || []).map(nameOf).join(', '), x.facilitatorName || '', x.status.toLowerCase(), ''] ) });
    if (grain === 'batches') return h.ok({ columns: ['Batch ID', 'Name', 'Level', 'Active', 'Coordinators', 'Active devotees', 'All devotees'], next: null,
      rows: db().batches.map((b) => [b.batchId, b.name, b.level || '', 'yes', '', members(b.batchId).length, members(b.batchId).length]) });
    return h.ok({ columns: ['When', 'Who', 'Role', 'What', 'About', 'Batch', 'Reason', 'Before', 'After'], next: null, rows: [[isoIst(nowD()).replace('T', ' ').slice(0, 16), u.login, 'MASTER', 'exports.run', '', '', '', '', '']] });
  }];

  /* ---- IYF IDs created in the app (item 14) ---- */
  const appIds = [];
  // IYFD-<year they connected>-NNNN, one counter per YEAR — as the identity authority's id_sequences counts
  // (18 Oct 2026). The mock minted the retired SR<yy> series until then, so its checks tested the wrong format.
  const perYear = {};
  const yearOf = (x) => String(x?.profile?.connectedSince || '');
  const nextFor = (y) => `IYFD-${y}-${String((perYear[y] || 0) + 1).padStart(4, '0')}`;
  const makeId = (u, by, reason, y) => { perYear[y] = (perYear[y] || 0) + 1; const id = `IYFD-${y}-${String(perYear[y]).padStart(4, '0')}`; u.iyfId = id; u.profile = { ...(u.profile || {}), connectedSince: y }; appIds.unshift({ iyfId: id, login: u.login, name: u.name, batchName: nameOf(openM(u).batchId), createdAt: isoIst(nowD()), createdBy: by, state: 'ACTIVE', replacedBy: null, inUse: true, dashboardMatch: null, reason }); return id; };
  A['ids.nextApp'] = [MASTER, (d) => {
    const y = String(d.year || '') || yearOf(db().users[String(d.login || '')]);
    return h.ok(y ? { next: nextFor(y), year: y } : { next: null, needsYear: true });
  }];
  A['ids.create'] = [MASTER, (d, u) => {
    const x = db().users[String(d.login || '')];
    if (!x || x.role !== 'DEVOTEE') return h.fail('NOT_FOUND', 'No devotee with that phone.');
    if (x.status !== 'ACTIVE') return h.fail('CONFLICT', 'Approve the sign-up first.');
    if (/^IYFD-/.test(x.iyfId || '')) return h.fail('CONFLICT', `${x.name} already has an IYF ID (${x.iyfId}).`);
    const y = String(d.year || '') || yearOf(x);
    if (!y) return h.fieldFail([['year', `Add the year ${x.name} first came to IYF Delhi first — the IYF ID carries it.`]]);
    return h.ok({ iyfId: makeId(x, u.login, d.reason || '', y) });
  }];
  // + who still has no IYFD (worker admin.js idsAppList, 22 Oct 2026): asked for their year at the next open
  A['ids.appList'] = [MASTER, () => h.ok({ ids: appIds.map((a) => ({ ...a })),
    waiting: Object.values(db().users).filter((u) => u.role === 'DEVOTEE' && u.status === 'ACTIVE' && !/^IYFD-/.test(u.iyfId || ''))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200)
      .map((u) => ({ login: u.login, name: u.name, oldId: u.iyfId || '', yearOnRecord: String(u.profile?.connectedSince || '').slice(0, 4),
        batchName: nameOf(openM(u).batchId) || '', lastSeen: u.lastLogin || null })) })];
  // approving a sign-up with a new ID: wraps the mock's approve (the head only)
  const approve = A['requests.approve'];
  if (approve) A['requests.approve'] = [approve[0], (d, u) => {
    if (d.link?.createId === true) {
      if (!isHead(u)) return h.fail('FORBIDDEN', 'Only the IYF head can create a new IYF ID.');
      // the head may give the year while approving (as worker/src/requests.js, 18 Oct 2026), checked before approving
      const given = String(d.link.year ?? '');
      if (given) {
        const thisYear = nowD().getFullYear();
        if (!/^(19|20)\d{2}$/.test(given)) return h.fieldFail([['link.year', 'Choose the year they first came to IYF Delhi.']]);
        if (+given < 1980) return h.fieldFail([['link.year', 'That year is too far back.']]);
        if (+given > thisYear) return h.fieldFail([['link.year', 'That year has not happened yet.']]);
      }
      const r = approve[1]({ ...d, link: { noIdYet: true } }, u);
      if (!r.ok) return r;
      // as the worker: no year on record → approved, and the ID waits for the year rather than taking today's
      const x = db().users[d.phone], y = given || yearOf(x);
      if (!y) return h.ok({ ...(r.data || {}), iyfId: '', linked: false, created: false, needsYear: true });
      const id = makeId(x, u.login, 'created at approval', y);
      return h.ok({ ...(r.data || {}), iyfId: id, linked: true, created: true, needsYear: false });
    }
    return approve[1](d, u);
  }];

  /* ---- a new IYF head: every other active head approves (item 24) ---- */
  const reqs = [];
  let rseq = 0;
  const heads = (except) => Object.values(db().users).filter((x) => x.role === 'MASTER' && x.status === 'ACTIVE' && x.login !== except && x.login !== 'master').map((x) => x.login);
  const view = (r, u) => ({ ...r, heads: r.needed.map((l) => ({ login: l, name: db().users[l]?.name || l, approved: r.approved.includes(l) })), requestedBy: db().users[r.by]?.name || r.by,
    mine: r.state === 'OPEN' && r.needed.includes(u.login) && !r.approved.includes(u.login), canWithdraw: r.state === 'OPEN' && r.by === u.login });
  const make = (r) => { if (r.kind === 'CREATE') db().users[r.login] = { login: r.login, role: 'MASTER', name: r.name, password: r.pw, status: 'ACTIVE', mustChange: true }; else db().users[r.login].role = 'MASTER'; };
  const create = A['coordinators.create'];
  if (create) A['coordinators.create'] = [create[0], (d, u) => {
    if (d.master !== true) return create[1](d, u);
    const reason = String(d.reason || '').trim(), f = [];
    if (reason.length < 2) f.push(['reason', 'Give a short reason for appointing a new IYF head.']);
    if (!/^[a-z][a-z0-9.-]{2,29}$/.test(String(d.username || ''))) f.push(['username', 'Use 3–30 lowercase letters, digits, dots or dashes, starting with a letter.']);
    if (String(d.name || '').trim().length < 2) f.push(['name', "Enter the new IYF head's name."]);
    if (String(d.tempPassword || '').length < 8) f.push(['tempPassword', 'At least 8 characters.']);
    if (f.length) return h.fieldFail(f);
    if (db().users[d.username] || reqs.some((r) => r.login === d.username && r.state === 'OPEN')) return h.fail('CONFLICT', `The username ${d.username} is taken.`);
    const r = { id: ++rseq, kind: 'CREATE', login: d.username, name: String(d.name).trim(), phone: d.phone || '', pw: d.tempPassword, reason, by: u.login, requestedAt: isoIst(nowD()), needed: heads(u.login), approved: [], state: 'OPEN' };
    if (!r.needed.length) { make(r); return h.ok({ coordinator: { username: r.login, name: r.name, master: true, batchIds: [], status: 'ACTIVE', mustChangePassword: true } }); }
    reqs.unshift(r); return h.ok({ pending: true, request: view(r, u) });
  }];
  const setM = A['masters.set'];
  if (setM) A['masters.set'] = [setM[0], (d, u) => {
    const x = db().users[d.login];
    if (!d.master || !x || x.role === 'MASTER') return setM[1](d, u);
    if (String(d.reason || '').trim().length < 2) return h.fieldFail([['reason', 'Give a short reason.']]);
    const r = { id: ++rseq, kind: 'PROMOTE', login: x.login, name: x.name, reason: d.reason, by: u.login, requestedAt: isoIst(nowD()), needed: heads(u.login), approved: [], state: 'OPEN' };
    if (!r.needed.length) return setM[1](d, u);
    reqs.unshift(r); return h.ok({ pending: true, request: view(r, u) });
  }];
  A['heads.requests'] = [MASTER, (d, u) => h.ok({ open: reqs.filter((r) => r.state === 'OPEN').map((r) => view(r, u)), recent: reqs.filter((r) => r.state !== 'OPEN').slice(0, 20).map((r) => view(r, u)), days: 14 })];
  A['heads.decide'] = [MASTER, (d, u) => {
    const r = reqs.find((x) => x.id === Number(d.id));
    if (!r) return h.fail('NOT_FOUND', 'That request is not there any more.');
    if (r.state !== 'OPEN') return h.fail('CONFLICT', 'This request was already decided.');
    if (!r.needed.includes(u.login)) return h.fail('FORBIDDEN', 'You are not one of the heads asked to approve this.');
    if (!d.approve) { if (String(d.note || '').trim().length < 2) return h.fieldFail([['note', 'Say briefly why you decline.']]); r.state = 'REJECTED'; r.note = d.note; return h.ok({ request: view(r, u) }); }
    r.approved.push(u.login);
    const done = r.needed.every((l) => r.approved.includes(l));
    if (done) { make(r); r.state = 'DONE'; }
    return h.ok({ request: view(r, u), done });
  }];
  A['heads.withdraw'] = [MASTER, (d, u) => { const r = reqs.find((x) => x.id === Number(d.id) && x.state === 'OPEN'); if (!r) return h.fail('NOT_FOUND', 'That request is not open any more.'); if (r.by !== u.login) return h.fail('FORBIDDEN', 'Only the head who asked can withdraw it.'); r.state = 'WITHDRAWN'; return h.ok({}); }];
  return { reset() { appIds.length = 0; for (const k of Object.keys(perYear)) delete perYear[k]; reqs.length = 0; rseq = 0; counts.clear(); } };
}
