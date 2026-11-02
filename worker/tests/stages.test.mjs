// Stage targets and the net score (the head, 17 Oct 2026).
//
// The dashboard's card has two halves: the eleven lead measures (what somebody DOES each week) and
// the stages (what it is FOR — how many students they mean to move up). Its score is
// net = (sadhana% + seva% + goal%) / 3, and goal% comes from the stages. Without them the app could
// compute only two thirds of a figure the dashboard prints whole.
import { suite } from './harness.mjs';
import { netScore, STAGES } from '../src/phases.js';

const t = suite('stages: the goal the score is a third of');

/* ── the formula, exactly as MetricsService.gs states it ────────────────── */
t.eq(netScore({ sadhana: 90, seva: 80, goal: 70 }).score, 80, '(90 + 80 + 70) / 3');
t.eq(netScore({ sadhana: 100, seva: 100, goal: 100 }).score, 100, 'everything met is 100');

/* ── the two kinds of nothing, which must not be confused ───────────────── */
t.eq(netScore({ sadhana: 90, seva: 80, goal: null }).score, 85,
  'NO TARGET SET drops the goal term: the average is over the two that exist, not a zero they were never asked for');
t.eq(netScore({ sadhana: 90, seva: 80, goal: null }).counted, ['sadhana', 'seva'],
  'and the answer says which terms it counted, so nobody compares two of three with three of three');
t.eq(netScore({ sadhana: 90, seva: null, goal: 60 }).score, 50,
  'NOT FILLED IN counts as nought while they are measured: (90 + 0 + 60) / 3');
t.eq(netScore({}).score, null,
  'but nothing reported at all has NO score — they have not been measured, which is not the same as failing');

/* ── it shows its working ───────────────────────────────────────────────── */
{
  const n = netScore({ sadhana: 90, seva: 80, goal: 70 });
  t.eq(n.parts.map(p => p.key), ['sadhana', 'seva', 'goal'], 'the three parts come back with the score');
  t.eq(n.parts.find(p => p.key === 'goal').value, 70, 'each carrying its own figure');
  t.eq(netScore({ sadhana: 90, seva: 80 }).parts.find(p => p.key === 'goal').reported, false,
    'and a term nobody asked for is marked as not reported, rather than shown as nought');
}

/* ── the six stages, as the dashboard names them ────────────────────────── */
t.eq(STAGES.map(s => s.stage), ['VL3', 'SPS', 'DPS', 'BSS', 'BVS'], 'the levels somebody is moved UP to');
t.eq(STAGES.find(s => s.stage === 'SPS').label, 'VL-3 → SPS', 'labelled as the dashboard labels them');

/* ── achieved is COUNTED from real promotions, never typed ──────────────── */
//
// The dashboard asks a facilitator to type what they achieved, because a spreadsheet cannot see the
// promotions. This app can: it knows who moved up, when, and whose student they were. A number
// nobody types is a number nobody can get wrong.
{
  const { boot } = await import('./harness.mjs');
  const { DB, call, clock, addAccount, rows } = boot();
  const FAC = 'Natvar Gopinath Prabhuji';
  clock.now = Date.parse('2026-11-02T09:00:00+05:30');
  await addAccount('master', 'MASTER', 'Master pass 2026');
  const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
  await call('phases.open', { phaseId: 'kartik-s', name: 'Kartik S', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);

  // the head is the facilitator here, so the promotions count for them
  DB.sql.exec("UPDATE accounts SET facilitator_name = 'Natvar Gopinath Prabhuji' WHERE login = 'master'");

  // aim for two moved up to DPS
  let r = await call('stages.set', { phaseId: 'kartik-s', stages: [{ stage: 'DPS', target: 2 }] }, M);
  t.code(r, 'ok', 'they set what they mean to achieve');
  t.eq(r.data.stages.find(s => s.stage === 'DPS').target, 2, 'two students to DPS');
  t.eq(r.data.stages.find(s => s.stage === 'DPS').achieved, 0, 'none yet');
  t.eq(r.data.goalPct, 0, 'so the goal figure is nought — asked, and not yet done');

  // one student is actually promoted into DPS, under that facilitator
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, to_week, facilitator, set_by, set_at)
    VALUES ('6000000240', 'SPS', 'ACTIVE', '2026-09-07', '2026-10-26', '${FAC}', 'test', '2026-09-01')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, facilitator, set_by, set_at, reason)
    VALUES ('6000000240', 'DPS', 'ACTIVE', '2026-11-02', '${FAC}', 'test', '2026-11-02', 'promoted from SPS')`);

  r = await call('stages.set', { phaseId: 'kartik-s', stages: [{ stage: 'DPS', target: 2 }] }, M);
  t.eq(r.data.stages.find(s => s.stage === 'DPS').promoted, 1,
    'the promotion is COUNTED: nobody reported it, the app saw it happen');
  // ADR 0012 (22 Oct 2026): the GOAL is scored on students who became ELIGIBLE, not on promotions — a promotion is
  // the coordinator's act, readiness is the facilitator's work. These students submitted nothing, so none is
  // eligible and the goal stays at nought; the promotion shows beside it as information.
  t.eq(r.data.goalPct, 0, 'the goal follows eligibility; a promotion with no evidence behind it does not score it');

  // a surplus at one level does not fill another's target
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, to_week, facilitator, set_by, set_at)
    VALUES ('6000000241', 'SPS', 'ACTIVE', '2026-09-07', '2026-10-26', '${FAC}', 'test', '2026-09-01')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, facilitator, set_by, set_at, reason)
    VALUES ('6000000241', 'DPS', 'ACTIVE', '2026-11-02', '${FAC}', 'test', '2026-11-02', 'promoted from SPS')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, to_week, facilitator, set_by, set_at)
    VALUES ('6000000242', 'SPS', 'ACTIVE', '2026-09-07', '2026-10-26', '${FAC}', 'test', '2026-09-01')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, facilitator, set_by, set_at, reason)
    VALUES ('6000000242', 'DPS', 'ACTIVE', '2026-11-02', '${FAC}', 'test', '2026-11-02', 'promoted from SPS')`);

  r = await call('stages.set', { phaseId: 'kartik-s', stages: [{ stage: 'DPS', target: 2 }, { stage: 'BSS', target: 1 }] }, M);
  t.eq(r.data.stages.find(s => s.stage === 'DPS').promoted, 3, 'three actually reached DPS, counted as promotions');
  t.eq(r.data.totalPromoted, 3, 'and totalled');
  // the surplus rule now holds on eligibility: tests/card-scoring.test.mjs

  t.code(await call('stages.set', { phaseId: 'kartik-s', stages: [{ stage: 'NOPE', target: 1 }] }, M), 'VALIDATION',
    'a level the app does not know is refused');
  t.code(await call('stages.set', { phaseId: 'kartik-s', stages: [{ stage: 'DPS', target: -1 }] }, M), 'VALIDATION',
    'and a negative target');
}

t.done();
