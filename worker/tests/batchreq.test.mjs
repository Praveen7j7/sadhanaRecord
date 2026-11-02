// Asking to start a batch (Phase 23; the head, 27 Oct 2026: "A new VL-2, VL-3 or any training batch, say ETP, can be
// started by the admin, and the coordinators can even initiate a request, and the approval for the batch beginning the
// admin gives"). A coordinator asks; the head approves by creating the batch (batches.create fromRequest, the one set of
// rules) or declines with a note; the requester may withdraw while it waits. Another coordinator never sees it.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('phase 23: asking to start a batch, and the head starting it');
const { DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-27T10:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const coordinator = async (username, batchIds) => {
  await call('coordinators.create', { username, name: username.toUpperCase() + ' Coordinator', batchIds, tempPassword: `Temp-${username}-2026` }, M);
  DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = '${username}'`);
  return (await call('auth.login', { login: username, password: `Temp-${username}-2026` })).data.token;
};
const SPS = await coordinator('sps', ['SPS']), DPS = await coordinator('dps', ['DPS']);
await call('auth.signUp', { phone: '6000000191', name: 'Asha Devi', batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
  profile: { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
             address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
await call('requests.approve', { phone: '6000000191', link: { noIdYet: true } }, M);
const D = (await call('auth.login', { login: '6000000191', password: 'Devotee pass 2026' })).data.token;
const field = (r) => r.error?.fields?.[0]?.path || r.error?.details?.[0]?.path || '';

/* ── asking: the rules ── */
const ask = (o, tok = SPS) => call('batchReq.create', { level: 'VL2', startsOn: '2026-10-27', ...o }, tok);
t.code(await ask({}, D), 'FORBIDDEN', 'a devotee cannot ask to start a batch');
t.eq(field(await ask({ level: 'SPS' })), 'level', 'only VL-2, VL-3 or a training (ETP)');
t.eq(field(await ask({ startsOn: '2026-10-26' })), 'startsOn', 'the proposed start is today or later');
t.eq(field(await ask({ endsOn: '2026-12-31' })), 'endsOn', 'a VL-2 intake has no end date');
t.eq(field(await ask({ level: 'ETP', startsOn: '2026-11-02' })), 'endsOn', 'a training needs its end date');
t.eq(field(await ask({ level: 'ETP', startsOn: '2026-11-02', endsOn: '2026-11-01' })), 'endsOn', 'which comes after the start');
let r = await ask({ note: 'Fifty new students from the college fest' });
t.code(r, 'ok', 'the SPS coordinator asks for a VL-2 intake starting today');
const vl2 = r.data;
t.eq([vl2.level, vl2.startsOn, vl2.state, vl2.byName, vl2.mine], ['VL2', '2026-10-27', 'WAITING', 'SPS Coordinator', true], 'it waits, as theirs');
t.code(await ask({}), 'CONFLICT', 'a second VL-2 ask while the first waits is refused');
r = await ask({ level: 'ETP', startsOn: '2026-11-02', endsOn: '2027-01-31', note: 'ETP for the new facilitators' }, DPS);
t.code(r, 'ok', 'the DPS coordinator asks for a training from 2 Nov to 31 Jan');
const etp = r.data;
r = await ask({ level: 'VL3' }, DPS);
const vl3 = r.data;

/* ── who sees what ── */
t.eq((await call('batchReq.list', {}, SPS)).data.requests.map((x) => x.id), [vl2.id], 'a coordinator lists their own requests only');
t.eq((await call('batchReq.list', {}, DPS)).data.requests.map((x) => x.id).sort(), [etp.id, vl3.id].sort(), '… each their own');
r = await call('batchReq.list', {}, M);
t.eq([r.data.waiting, r.data.requests.map((x) => x.id)], [3, [vl2.id, etp.id, vl3.id]], 'the head sees every waiting request, oldest first');
t.code(await call('batchReq.list', {}, D), 'FORBIDDEN', 'a devotee sees none');
t.code(await call('batchReq.withdraw', { id: vl2.id }, DPS), 'NOT_FOUND', "another coordinator cannot withdraw it");
t.code(await call('batchReq.decide', { id: vl2.id, decision: 'decline', note: 'no' }, SPS), 'FORBIDDEN', 'a coordinator cannot decide one');

/* ── the head approves: the batch is created by Batch setup's own form, pre-filled, with the requester as coordinator ── */
t.ok(!(await call('auth.me', {}, SPS)).data.user.scopes.coordinator.includes('VL2-51'), 'before: the requester has no VL2-51');
r = await call('batches.create', { batchId: 'VL2-51', name: 'Vedic Level 2 · Batch 51', level: 'VL2', startedOn: '2026-10-27', coordinatorLogins: ['sps'], fromRequest: vl2.id }, M);
t.code(r, 'ok', 'the head approves: VL2-51 is created from the request');
t.eq([r.data.batchId, r.data.coordinatorLogins, r.data.startedOn], ['VL2-51', ['sps'], '2026-10-27'], 'with the requester as its coordinator, from its start');
t.eq(rows(`SELECT state, batch_id, decided_by FROM batch_requests WHERE id = ${vl2.id}`), [{ state: 'STARTED', batch_id: 'VL2-51', decided_by: 'master' }], 'the request is Started, naming its batch');
t.ok((await call('auth.me', {}, SPS)).data.user.scopes.coordinator.includes('VL2-51'), 'the requester now coordinates VL2-51 (their scopes, at once)');
t.ok(((await call('meta.get', {}, SPS, { token: SPS })).data.staffBatches || []).some((b) => b.batchId === 'VL2-51'), "… and it is in their batch list (meta's staff list)");
{ const x = (await call('batchReq.list', {}, SPS)).data.requests[0];
  t.eq([x.state, x.stateName, x.batchId, x.batchName], ['STARTED', 'Started', 'VL2-51', 'Vedic Level 2 · Batch 51'], 'the requester reads it as Started, with the batch it became'); }
t.code(await call('batches.create', { batchId: 'VL2-52', name: 'Vedic Level 2 · Batch 52', level: 'VL2', fromRequest: vl2.id }, M), 'CONFLICT', 'a request starts one batch, once');
t.eq(rows("SELECT COUNT(*) AS n FROM batches WHERE batch_id = 'VL2-52'")[0].n, 0, '… and the refused create made nothing');
t.eq(field(await call('batches.create', { batchId: 'VL2-53', name: 'Vedic Level 2 · Batch 53', level: 'VL2', fromRequest: etp.id }, M)), 'batchId', 'a training request is not fulfilled by a VL-2 batch');
t.eq(rows(`SELECT state FROM batch_requests WHERE id = ${etp.id}`)[0].state, 'WAITING', '… and stays waiting');

// a training proposed for a later day: a batch starts the day it is created (the head, 18 Oct 2026) — so it is created
// on its day, not before, and not by a timer
r = await call('batches.create', { batchId: 'ETP-22', name: 'ETP · Batch 22', level: 'ETP', startedOn: '2026-11-02', endsOn: '2027-01-31', coordinatorLogins: ['dps'], fromRequest: etp.id }, M);
t.eq([r.error?.code, field(r)], ['VALIDATION', 'startedOn'], 'approving before its proposed start is refused by the batch rule: it starts on the day it is created');
t.eq(rows(`SELECT state FROM batch_requests WHERE id = ${etp.id}`)[0].state, 'WAITING', '… and the request still waits');
at('2026-11-02T09:00:00');
const M2 = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
r = await call('batches.create', { batchId: 'ETP-22', name: 'ETP · Batch 22', level: 'ETP', startedOn: '2026-11-02', endsOn: '2027-01-31', coordinatorLogins: ['dps'], fromRequest: etp.id }, M2);
t.code(r, 'ok', 'on 2 Nov the head creates ETP-22 from it');
t.eq([r.data.endsOn, r.data.status, r.data.coordinatorLogins], ['2027-01-31', 'RUNNING', ['dps']], 'with its end date, Running, the requester as coordinator');
const DPS2 = (await call('auth.login', { login: 'dps', password: 'Temp-dps-2026' })).data.token;
t.ok((await call('auth.me', {}, DPS2)).data.user.scopes.coordinator.includes('ETP-22'), 'the DPS coordinator now holds the training (Students, Board, Close batch)');
t.code(await call('enrol.list', { batchId: 'ETP-22' }, DPS2), 'ok', '… and can open its students');

/* ── decline with a note; withdraw ── */
t.eq(field(await call('batchReq.decide', { id: vl3.id, decision: 'decline' }, M2)), 'note', 'a decline says why');
t.eq(field(await call('batchReq.decide', { id: vl3.id, decision: 'approve' }, M2)), 'decision', 'approving is creating the batch, not a decision here');
r = await call('batchReq.decide', { id: vl3.id, decision: 'decline', note: 'Start VL-3 after the VL-2 intake finishes' }, M2);
t.eq([r.data?.state, r.data?.decisionNote, r.data?.decidedByName], ['DECLINED', 'Start VL-3 after the VL-2 intake finishes', 'master'], 'the head declines, with a note the coordinator reads');
t.code(await call('batchReq.withdraw', { id: vl3.id }, DPS2), 'CONFLICT', 'a decided request cannot be withdrawn');
r = await call('batchReq.create', { level: 'VL3', startsOn: '2026-11-09', note: 'again later' }, DPS2);
t.code(await call('batchReq.withdraw', { id: r.data.id }, DPS2), 'ok', 'the requester withdraws one that waits');
t.eq(rows(`SELECT state FROM batch_requests WHERE id = ${r.data.id}`)[0].state, 'WITHDRAWN', 'it reads Withdrawn');
t.eq((await call('batchReq.list', {}, M2)).data.waiting, 0, "nothing waits for the head now (the Requests badge reads 0)");

/* ── Activity ── */
t.eq(rows("SELECT action FROM audit_log WHERE action LIKE 'batchReq.%' ORDER BY id").map((x) => x.action),
  ['batchReq.create', 'batchReq.create', 'batchReq.create', 'batchReq.approve', 'batchReq.approve', 'batchReq.decline', 'batchReq.create', 'batchReq.withdraw'],
  'every ask, start, decline and withdrawal is in Activity');

/* ── the head's own path: a coordinator at creation ── */
r = await call('batches.create', { batchId: 'VL3-33', name: 'Vedic Level 3 · Batch 33', level: 'VL3', coordinatorLogins: ['nobody'] }, M2);
t.eq(field(r), 'coordinatorLogins', 'a coordinator must be an approved person');
r = await call('batches.create', { batchId: 'VL3-33', name: 'Vedic Level 3 · Batch 33', level: 'VL3', coordinatorLogins: ['sps', 'dps'] }, M2);
t.eq([r.ok, r.data?.coordinatorLogins, r.data?.coordinatorNames], [true, ['sps', 'dps'], ['SPS Coordinator', 'DPS Coordinator']], 'the head starts VL3-33 directly, with its coordinators');

t.done();
