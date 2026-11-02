// Who is ready for the next level (the head, 17 Oct 2026) — computed from this app's own data.
//
// The dashboard does not compute this: it reads a column an Eligibility tab's formulas fill. Every
// input is already a column here, so the rule becomes code — and the rule that matters most is that
// a MISSING number counts as not yet, never as a pass. Somebody with no weeks has not met a
// threshold; they have not been measured, and promoting on that is promoting on no evidence.
import { suite } from './harness.mjs';
import { STANDARD, meets, criteriaFor } from '../src/eligible.js';

const t = suite('eligibility: computed, not read from a sheet');

/* ── the rule that carries the rest ─────────────────────────────────────── */
t.eq(meets('sad', null, 80), false, 'a missing figure NEVER passes');
t.eq(meets('sad', undefined, 80), false, '… nor an absent one');
t.eq(meets('att', null, 0.5), false, '… nor a missing attendance');
t.eq(meets('pr', null, 'YES'), false, '… nor missing principles');
t.eq(meets('chant', 0, 4), false, 'nought rounds is a measurement, and it does not meet four');

/* ── the thresholds, exactly at the line ────────────────────────────────── */
t.eq(meets('sad', 80, 80), true, '80 meets 80: the threshold is "at least", not "more than"');
t.eq(meets('sad', 79.9, 80), false, 'and 79.9 does not');
t.eq(meets('att', 0.5, 0.5), true, 'half the classes held meets a half');
t.eq(meets('att', 0.49, 0.5), false, 'just under does not');
t.eq(meets('pr', 'YES', 'YES'), true, 'the four principles are met by YES');
t.eq(meets('pr', 'NO', 'YES'), false, 'and not by NO');

/* ── the standard set, as the dashboard states it ───────────────────────── */
t.eq(STANDARD.VL2, { att: 0.5 }, 'VL-2 asks only for attendance');
t.eq(STANDARD.VL3, { att: 0.5, chant: 4 }, 'VL-3 adds four rounds');
t.eq(Object.keys(STANDARD.SPS).sort(), ['chant', 'cls', 'night', 'pr', 'sad'], 'SPS asks for five things');
t.eq(STANDARD.SPS.chant, 8, 'eight rounds at SPS');
t.eq(STANDARD.DPS.chant, 12, 'and twelve at DPS, as the sheet has it');

/* ── against real submitted weeks ───────────────────────────────────────── */
//
// Seeded rather than filled week by week: what is under test is the reading of the figures, not the
// weekly form, which weeks.test.mjs covers.
{
  const { boot } = await import('./harness.mjs');
  const { DB, call, clock, addAccount, rows } = boot();
  clock.now = Date.parse('2026-11-02T09:00:00+05:30');
  await addAccount('master', 'MASTER', 'Master pass 2026');
  const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

  const seed = (login, name, week, overall, rounds, night, pr) => {
    DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
      VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')
      ON CONFLICT(login) DO NOTHING`);
    DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at)
      VALUES ('${login}', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01') ON CONFLICT DO NOTHING`);
    DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, request_id,
        rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, seva_minutes,
        avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
      VALUES ('${login}-${week}', '${login}', '${name}', 'SPS', '${week}', '2026-10-04T19:00:00+05:30', '${login}', 'rq-${login}-${week}',
        'r1', 80, 80, 80, 80, 80, 80, 100, 100, 80, 80, ${overall}, 300, '${rounds}', '${night}', '${pr}', 210, 140, '[]', '{}')`);
    DB.sql.exec(`INSERT INTO attendance (login, week_id, batch_id, coordinator_mark, mark_used, changed_by, changed_at)
      VALUES ('${login}', '${week}', 'SPS', 'P', 'P', 'test', '2026-10-05T10:00:00+05:30') ON CONFLICT DO NOTHING`);
  };

  // Padma meets everything; Raghav chants too little; Tara has submitted nothing at all
  for (const w of ['2026-09-07', '2026-09-14', '2026-09-21']) seed('6000000200', 'Padma Devi', w, 88, 16, 'YES', 'YES');
  for (const w of ['2026-09-07', '2026-09-14', '2026-09-21']) seed('6000000201', 'Raghav Das', w, 85, 4, 'YES', 'YES');
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
    VALUES ('6000000202', 'DEVOTEE', 'ACTIVE', 'Tara Devi', '6000000202', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at)
    VALUES ('6000000202', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);

  const r = await call('eligible.list', { batchId: 'SPS' }, M);
  t.code(r, 'ok', 'the head sees who is ready in a batch');
  t.eq(r.data.level, 'SPS', 'judged by the batch\'s own level');
  t.eq(Object.keys(r.data.criteria).sort(), ['chant', 'cls', 'night', 'pr', 'sad'], 'against the standard SPS set');

  const by = Object.fromEntries(r.data.rows.map(x => [x.name, x]));
  t.eq(by['Padma Devi']?.ready, true, 'somebody who meets every threshold is ready');
  t.eq(by['Raghav Das']?.ready, false, 'somebody four rounds short is not');
  t.eq(by['Raghav Das']?.checks.find(c => c.key === 'chant').met, false, 'and the screen can say WHICH one he missed');
  t.eq(by['Raghav Das']?.checks.find(c => c.key === 'sad').met, true, '… while saying what he did meet');

  // the one that matters
  t.eq(by['Tara Devi']?.ready, false, 'somebody who has submitted NOTHING is not ready');
  t.eq(by['Tara Devi']?.weeks, 0, 'she has no weeks');
  t.eq(by['Tara Devi']?.checks.every(c => !c.met), true,
    'and meets nothing — a blank is NOT YET MEASURED, never a pass');

  /* ── criteria per batch ───────────────────────────────────────────────── */
  t.code(await call('criteria.set', { batchId: 'SPS', criteria: [{ criterion: 'chant', minValue: '4' }] }, M), 'ok',
    'the head sets this batch\'s own criteria');
  const r2 = await call('eligible.list', { batchId: 'SPS' }, M);
  t.eq(Object.keys(r2.data.criteria), ['chant'], 'the batch is now judged by its own set alone');
  t.eq(r2.data.rows.find(x => x.name === 'Raghav Das').ready, true,
    'and Raghav, four rounds short of eight, meets a batch that asks for four');

  t.code(await call('criteria.set', { batchId: 'SPS', criteria: [] }, M), 'ok', 'clearing them is allowed');
  const r3 = await call('eligible.list', { batchId: 'SPS' }, M);
  t.eq(Object.keys(r3.data.criteria).sort(), ['chant', 'cls', 'night', 'pr', 'sad'],
    'which puts the batch back on the standard set for its level');

  t.code(await call('criteria.set', { batchId: 'SPS', criteria: [{ criterion: 'nope', minValue: '1' }] }, M), 'VALIDATION',
    'a criterion the app does not know is refused');

  // what Batch setup reads to show and edit a batch's rules (ADR 0017): light — the rules, not every member's figures
  let g = await call('criteria.get', { batchId: 'SPS' }, M);
  t.code(g, 'ok', 'the head reads a batch\'s promotion rules');
  t.eq([g.data.custom, g.data.measured, Object.keys(g.data.criteria).sort()], [false, true, ['chant', 'cls', 'night', 'pr', 'sad']],
    'SPS on the standard set for its level');
  t.eq(g.data.labels.att, 'Attendance', 'with the words for each rule');
  await call('criteria.set', { batchId: 'SPS', criteria: [{ criterion: 'chant', minValue: '6' }, { criterion: 'att', minValue: '0.6' }], reason: 'stricter this term' }, M);
  g = await call('criteria.get', { batchId: 'SPS' }, M);
  t.eq([g.data.custom, g.data.criteria.chant, g.data.criteria.att, Object.keys(g.data.criteria).length], [true, 6, 0.6, 2], 'its own rules once set, numbers as numbers');
  t.eq(Object.keys(g.data.standard).sort(), ['chant', 'cls', 'night', 'pr', 'sad'], 'and the standard set beside them, to go back to');
  await call('criteria.set', { batchId: 'SPS', criteria: [] }, M);
  await call('coordinators.create', { username: 'spsel', name: 'Sps Eligible', batchIds: ['SPS'], tempPassword: 'Temp-spsel-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spsel'");
  const C = (await call('auth.login', { login: 'spsel', password: 'Temp-spsel-2026' })).data.token;
  await call('batches.create', { batchId: 'TRD', name: 'Temple residents', level: 'TRD' }, M);
  t.code(await call('criteria.get', { batchId: 'SPS' }, C), 'FORBIDDEN', 'a coordinator does not read or change the rules');
  t.code(await call('criteria.get', { batchId: 'NOPE' }, M), 'NOT_FOUND', 'nor is there a batch NOPE');
  t.eq((await call('criteria.get', { batchId: 'TRD' }, M)).data?.measured, false, 'TRD is not on the ladder: nothing to set');
}

/* ── the same rule in the export (the head, 17 Oct 2026) ───────────────── */
//
// "integrate the promotion criteria in the export filters, so when we decide to promote someone his
// data can be verified". The export must never disagree with the eligibility screen about who is
// ready, which is why it calls eligibleIn() rather than restating the thresholds.
{
  const { boot } = await import('./harness.mjs');
  const { DB, call, clock, addAccount } = boot();
  clock.now = Date.parse('2026-11-02T09:00:00+05:30');
  await addAccount('master', 'MASTER', 'Master pass 2026');
  const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

  const seed = (login, name, week, overall, rounds) => {
    DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
      VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test') ON CONFLICT(login) DO NOTHING`);
    DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, request_id,
        rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, seva_minutes,
        avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
      VALUES ('${login}-${week}', '${login}', '${name}', 'SPS', '${week}', '2026-10-04T19:00:00+05:30', '${login}', 'rq-${login}-${week}',
        'r1', 80, 80, 80, 80, 80, 80, 100, 100, 80, 80, ${overall}, 300, '${rounds}', 'YES', 'YES', 210, 140, '[]', '{}')`);
    DB.sql.exec(`INSERT INTO attendance (login, week_id, batch_id, coordinator_mark, mark_used, changed_by, changed_at)
      VALUES ('${login}', '${week}', 'SPS', 'P', 'P', 'test', '2026-10-05T10:00:00+05:30') ON CONFLICT DO NOTHING`);
  };
  // memberships has no unique key: one row per devotee, or the export reports each of them twice
  const join = (login) => DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at)
    VALUES ('${login}', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);
  for (const w of ['2026-09-07', '2026-09-14']) seed('6000000210', 'Uma Devi', w, 90, 16);   // ready
  join('6000000210');
  for (const w of ['2026-09-07', '2026-09-14']) seed('6000000211', 'Vivek Das', w, 85, 4);   // short on rounds
  join('6000000211');

  // one name per ROW: the same name appears in several columns of the same row
  const ids = (r) => (r.data.rows || []).map(row => row.find(x => typeof x === 'string' && /Devi|Das/.test(x)))
    .filter(Boolean).sort();

  const all_ = await call('exports.page', { grain: 'people', fields: ['name'], batchIds: ['SPS'] }, M);
  t.ok(ids(all_).includes('Uma Devi') && ids(all_).includes('Vivek Das'), 'both are in an unfiltered export');

  const yes = await call('exports.page', { grain: 'people', fields: ['name'], batchIds: ['SPS'], filters: { ready: 'yes' } }, M);
  t.eq(ids(yes), ['Uma Devi'], 'ready: only the devotee who meets every criterion');

  const no = await call('exports.page', { grain: 'people', fields: ['name'], batchIds: ['SPS'], filters: { ready: 'no' } }, M);
  t.ok(ids(no).includes('Vivek Das') && !ids(no).includes('Uma Devi'), 'not yet: the one who is short, and not the one who is not');

  // the export and the screen must say the same thing about the same people
  const screen = await call('eligible.list', { batchId: 'SPS' }, M);
  const screenReady = screen.data.rows.filter(x => x.ready).map(x => x.name).sort();
  t.eq(ids(yes), screenReady, 'the export and the eligibility screen agree about who is ready');

  // and the catalog says the filter exists, so a screen never offers one the server ignores
  const cat = await call('exports.catalog', {}, M);
  t.ok(cat.data.filters.some(f => f.id === 'ready'), 'the catalog advertises the promotion filter');
  t.eq(cat.data.filters.find(f => f.id === 'ready').grains, ['people'], 'on the one-row-per-devotee export');
}

/* ── the ladder stops at DPS, and TRD is not on it ── */
//
// "with the expected list of students eligible for promotion across the batches in which TRD is
// excluded, and till DPS only we will measure" (the head, 18 Oct 2026).
{
  const { boot } = await import('./harness.mjs');
  const { call, addAccount } = boot();
  await addAccount('master', 'MASTER', 'Master pass 2026');
  const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
  const { STANDARD, MEASURED } = await import('../src/eligible.js');
  t.eq(MEASURED, ['VL2', 'VL3', 'SPS', 'DPS', 'BSS'], 'the measured ladder, written down rather than implied');
  t.eq(STANDARD.TRD, undefined, 'TRD has no promotion criteria: a temple resident is not on the batch ladder');
  t.eq(STANDARD.BVS, undefined, 'and BVS is the end of the ladder, not a level promoted out of');

  // the behaviour that matters: a batch with no criteria declares NOBODY ready, rather than
  // everybody ready because "every check passed" is vacuously true over an empty list.
  const trd = await call('eligible.list', { batchId: 'TRD' }, M);
  t.code(trd, 'ok', 'the head may still open TRD and look');
  t.eq(trd.data.criteria, {}, 'it has no criteria');
  t.eq(trd.data.rows.filter(r => r.ready).length, 0,
    'and not one temple resident is listed as ready for promotion');
}

t.done();
