// Targets are set at the start of the phase, not afterwards (phase 21, 23 Oct 2026 — ADR 0018; the head: "defining the
// targets happens in the phase beginning only not afterwards"). A set target may change until the end of the person's
// first week on the card (or a date the head sets); after it, a target never set may still be set, a set one may not
// move — unless the head opens that person's targets for 7 days, with a reason.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { targetsLock } from '../src/phases.js';

const t = suite('phase 21: targets fixed after the start of the phase');
const { DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-09-03T10:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('auth.signUp', { phone: '6000000163', name: 'Lock Tester', batchId: 'SPS', facilitator: FAC, ...CONTACT, groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
  profile: { dob: '2001-03-03', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
             address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
await call('requests.approve', { phone: '6000000163', link: { noIdYet: true } }, M);
const D = (await call('auth.login', { login: '6000000163', password: 'Devotee pass 2026' })).data.token;
const P = 'kartik-2026';
t.code(await call('phases.open', { phaseId: P, name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M), 'ok', 'the head opens the phase');
const ph = rows(`SELECT starts_on, targets_until FROM phases WHERE phase_id = '${P}'`)[0];
t.eq([ph.starts_on, ph.targets_until], ['2026-09-01', ''], 'the open phase starts 1 Sep, with no lock date of its own');

/* the rule, before the plumbing */
{
  const phase = { starts_on: '2026-09-01', targets_until: '' }, win = { from: '2026-09-01' };
  t.eq(targetsLock(phase, win, null, new Date('2026-09-07T20:00:00+05:30')), { until: '2026-09-07', open: true, openedUntil: '' }, 'open through the end of the first week');
  t.eq(targetsLock(phase, win, null, new Date('2026-09-08T08:00:00+05:30')).open, false, 'fixed from the day after');
  t.eq(targetsLock(phase, { from: '2026-10-17' }, null, new Date('2026-10-20T08:00:00+05:30')).until, '2026-10-23', 'a trainee\'s first week is their training\'s');
  t.eq(targetsLock({ ...phase, targets_until: '2026-09-20' }, win, null, new Date('2026-09-15T08:00:00+05:30')).open, true, 'a date the head set wins');
  t.eq(targetsLock(phase, win, { until: '2026-10-01T10:00:00+05:30' }, new Date('2026-09-28T08:00:00+05:30')).openedUntil, '2026-10-01T10:00:00+05:30', 'an opening the head gave keeps them open until it expires');
}

/* inside the first week: set, and change freely */
let r = await call('card.get', {}, D);
t.eq([r.data.targets.until, r.data.targets.open], ['2026-09-07', true], 'card.get says until when the targets may change, and that they may now');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '5' }] }, D), 'ok', 'targets set in the first week');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '6' }] }, D), 'ok', 'and changed, still in the first week');
t.code(await call('stages.set', { phaseId: P, stages: [{ stage: 'SPS', target: 2 }] }, D), 'ok', 'a level target too');

/* after it: a set target is fixed; a never-set one may still be set */
at('2026-09-10T10:00:00');
r = await call('card.get', {}, D);
t.eq(r.data.targets.open, false, 'after the first week card.get says they are fixed');
r = await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '9' }] }, D);
t.eq([r.ok ? 'ok' : r.error.code, /fixed after 2026-09-07[\s\S]*IYF head/.test(r.error?.message || '')], ['WINDOW_CLOSED', true], 'changing a set target is refused, and says who can open it');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '6' }] }, D), 'ok', 'sending the same figure again is not a change');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'journal', target: 'YES' }, { measureId: 'calls', target: '10' }] }, D), 'ok',
  'a target never set may still be set (a Yes/No measure among them)');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'calls', target: '12' }] }, D), 'WINDOW_CLOSED', 'and once set, it is fixed like the others');
t.code(await call('stages.set', { phaseId: P, stages: [{ stage: 'SPS', target: 3 }] }, D), 'WINDOW_CLOSED', 'a set level target is fixed too');
t.code(await call('stages.set', { phaseId: P, stages: [{ stage: 'DPS', target: 1 }] }, D), 'ok', 'a level never set may still be set');
t.eq(rows("SELECT target FROM targets WHERE login = '6000000163' AND measure_id = 'stall'")[0].target, '6', 'the refused change left the target as it was');

/* the head opens them */
t.code(await call('targets.unlock', { login: '6000000163', phaseId: P, reason: 'x' }, M), 'VALIDATION', 'the head must say why');
t.code(await call('targets.unlock', { login: '6000000163', phaseId: P, reason: 'Moved to a new area' }, D), 'FORBIDDEN', 'only the head can open them');
r = await call('targets.unlock', { login: '6000000163', phaseId: P, reason: 'Moved to a new area' }, M);
t.eq([r.ok, r.data?.until?.slice(0, 10)], [true, '2026-09-17'], 'the head opens their targets for 7 days');
t.eq(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'targets.unlock'")[0].n, 1, 'and it is logged in Activity');
r = await call('card.get', {}, D);
t.eq([r.data.targets.open, r.data.targets.openedUntil.slice(0, 10)], [true, '2026-09-17'], 'their card says they are open, and until when');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '9' }] }, D), 'ok', 'so the change goes through');
r = await call('card.of', { login: '6000000163' }, M);
t.eq(r.data.targets.openedUntil.slice(0, 10), '2026-09-17', 'the head reading their card sees the opening too');
at('2026-09-18T10:00:00');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '10' }] }, D), 'WINDOW_CLOSED', 'and it expires on its own');

/* the head can give the phase a later date */
t.code(await call('phases.update', { phaseId: P, targetsUntil: '20-09-2026' }, M), 'VALIDATION', 'a lock date is a date');
t.code(await call('phases.update', { phaseId: P, targetsUntil: '2026-09-20' }, M), 'ok', 'the head sets the phase\'s lock date');
t.eq((await call('phases.list', {}, M)).data.phases.find((p) => p.phaseId === P).targetsUntil, '2026-09-20', 'phases.list carries it');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '10' }] }, D), 'ok', 'and before it, set targets may change again');
t.code(await call('phases.update', { phaseId: P, targetsUntil: '' }, M), 'ok', 'cleared, it is the end of each person\'s first week again');
t.code(await call('targets.set', { phaseId: P, targets: [{ measureId: 'stall', target: '11' }] }, D), 'WINDOW_CLOSED', 'so they are fixed again');

t.done();
