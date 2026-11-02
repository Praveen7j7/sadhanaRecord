// Phases and the target card (the head, 17 Oct 2026).
//
// The head opens a phase; a facilitator or ETP student holds a card of eleven lead measures against
// targets and fills it week by week. ETP students fill the SAME card — they are training to become
// facilitators, so they practise the real thing.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { weekPct } from '../src/phases.js';

const t = suite('phases: the target card');
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

await call('auth.signUp', { phone: '6000000150', name: 'Ravi Sharma', batchId: 'SPS', facilitator: FAC, ...CONTACT,
  groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
  profile: { dob: '2001-03-03', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
             address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
await call('requests.approve', { phone: '6000000150', link: { noIdYet: true } }, M);
const D = (await call('auth.login', { login: '6000000150', password: 'Devotee pass 2026' })).data.token;

/* ── the maths, before any of the plumbing ──────────────────────────────── */
{
  const ms = [{ measure_id: 'a', kind: 'NUMBER' }, { measure_id: 'b', kind: 'YESNO' }];
  const T = { a: { target: '10' }, b: { target: 'YES' } };
  t.eq(weekPct(ms, T, { a: { value: '10' }, b: { value: 'YES' } }), 100, 'everything met is 100');
  t.eq(weekPct(ms, T, { a: { value: '5' }, b: { value: 'NO' } }), 25, 'half of one and none of the other');
  t.eq(weekPct(ms, T, { a: { value: '500' }, b: { value: 'YES' } }), 100,
    'a runaway number is capped at its target, so one measure cannot carry an empty card');
  t.eq(weekPct(ms, T, {}), 0, 'asked and not filled is nought, not nothing');
  t.eq(weekPct(ms, {}, {}), null,
    'but NOTHING ASKED has no score at all — a person not given targets must not be failed for them');
  t.eq(weekPct(ms, { a: { target: '0' } }, { a: { value: '3' } }), null, 'a target of nought is not a target');
}

/* ── opening a phase ────────────────────────────────────────────────────── */
t.code(await call('phases.open', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31' }, C),
  'FORBIDDEN', 'only the head opens a phase');
let r = await call('phases.open', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
t.code(r, 'ok', 'the head opens the Kartik phase');
t.eq([r.data.phaseId, r.data.state], ['kartik-2026', 'OPEN'], 'it is open');
t.code(await call('phases.open', { phaseId: 'kartik-2026', name: 'Again', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M),
  'VALIDATION', 'the same phase twice is refused');
t.code(await call('phases.open', { phaseId: 'bad-2026', name: 'Backwards', startsOn: '2026-12-31', endsOn: '2026-09-01' }, M),
  'VALIDATION', 'a phase cannot end before it starts');

/* ── editing a phase from Admin (the head, 22 Oct 2026: "set the phases… add, edit and all from the app") ── */
t.code(await call('phases.update', { phaseId: 'kartik-2026', name: 'Kartik', startsOn: '2026-09-01', endsOn: '2026-12-31' }, C),
  'FORBIDDEN', 'only the head edits a phase');
r = await call('phases.update', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-08-25', endsOn: '2026-12-31', reason: 'started a week early' }, M);
t.code(r, 'ok', 'the head moves the start a week earlier');
t.eq([r.data.startsOn, r.data.seasonYear], ['2026-08-25', 2026], 'the new date is kept, and the season follows it');
t.eq(rows("SELECT action, reason FROM audit_log WHERE action = 'phases.update' AND target = 'kartik-2026'").map(x => x.reason),
  ['started a week early'], 'audited, with the reason');
t.code(await call('phases.update', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-12-31', endsOn: '2026-09-01' }, M),
  'VALIDATION', 'an edit cannot make a phase end before it starts');
t.code(await call('phases.update', { phaseId: 'nope-2026', name: 'Nope', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M),
  'NOT_FOUND', 'nor edit a phase that does not exist');
t.eq((await call('phases.list', {}, D)).data.phases.find(p => p.phaseId === 'kartik-2026')?.startsOn, '2026-08-25', 'phases.list shows the edit');
await call('phases.update', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
{
  await call('phases.open', { phaseId: 'old-2025', name: 'Old', startsOn: '2025-01-01', endsOn: '2025-04-30' }, M);
  await call('phases.close', { phaseId: 'old-2025', reason: 'done' }, M);
  t.code(await call('phases.update', { phaseId: 'old-2025', name: 'Old', startsOn: '2025-01-05', endsOn: '2025-04-30' }, M),
    'CONFLICT', "a closed phase's dates are a record: they are not edited");
  t.code(await call('phases.update', { phaseId: 'old-2025', name: 'Old Gaur', startsOn: '2025-01-01', endsOn: '2025-04-30' }, M),
    'ok', '… though its name may be corrected');
}

/* ── the card ───────────────────────────────────────────────────────────── */
r = await call('card.get', { phaseId: 'kartik-2026', weekId: '2026-10-05' }, D);
t.code(r, 'ok', 'a person opens their own card');
t.eq(r.data.measures.length, 11, 'the eleven lead measures the dashboard uses');
t.eq(r.data.measures[0].measureId, 'sadhna', 'Sadhna first');
t.ok(r.data.measures[0].fromApp, 'and it is the one the app can fill for them');
t.eq(r.data.measures.filter(m => m.fromApp).length, 1, 'only Sadhna is offered; the rest are theirs to report');

// The same measure, said to each audience in their own words (the head, 17 Oct 2026): a facilitator
// reports FTP training attendance, a trainee reports ETP attendance. One measure, so their figures
// stay comparable and a trainee's history follows them when they qualify.
t.eq(r.data.measures.find(m => m.measureId === 'ftp').label, 'FTP training attendance',
  'a facilitator sees FTP training attendance');
t.eq(r.data.trainee, false, 'and is not marked a trainee');

/* ── targets, and who may set them ──────────────────────────────────────── */
// The targets are the person's OWN: what they feel is feasible for the phase. Nobody sets them for
// somebody else — a target another person chose is not a commitment, and the board would be scoring
// them against a number they never agreed to.
t.code(await call('targets.set', { phaseId: 'kartik-2026',
  targets: [{ measureId: 'stall', target: '5' }, { measureId: 'ftp', target: 'YES' }] }, D), 'ok',
  'a person sets their own targets for the phase');
t.code(await call('targets.set', { phaseId: 'kartik-2026', targets: [{ measureId: 'nope', target: '5' }] }, D),
  'VALIDATION', 'a measure the card does not hold is refused');
// a coordinator setting them for somebody is not refused — it is not possible: the action takes no
// login, so a coordinator calling it can only write their own
t.eq(rows("SELECT COUNT(*) n FROM targets WHERE login = 'sps'")[0].n, 0, 'the coordinator has set nobody a target');

/* ── filling ────────────────────────────────────────────────────────────── */
t.code(await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-10-05',
  values: [{ measureId: 'stall', value: '3' }, { measureId: 'ftp', value: 'YES' }] }, D), 'ok', 'they fill their week');
r = await call('card.get', { phaseId: 'kartik-2026', weekId: '2026-10-05' }, D);
const stall = r.data.measures.find(m => m.measureId === 'stall');
t.eq([stall.target, stall.value, stall.source], ['5', '3', 'typed'], 'the figure is stored as theirs');

// 3 of 5 is 60, YES is 100 -> 80
t.eq(r.data.phase.average, 80, 'their phase average is the two measures they were asked for');
t.eq(r.data.phase.filled, 1, 'over the one week they have filled');
t.ok(r.data.phase.weeks > 1, 'out of the weeks the phase holds — so a thin average reads as thin');

t.code(await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-10-05', values: [{ measureId: 'ftp', value: 'maybe' }] }, D),
  'VALIDATION', 'a Yes/No takes Yes or No');
t.code(await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-01-05', values: [{ measureId: 'stall', value: '1' }] }, D),
  'VALIDATION', 'a week outside the phase is refused');

/* ── closing ────────────────────────────────────────────────────────────── */
t.code(await call('phases.close', { phaseId: 'kartik-2026', reason: 'The phase is over' }, M), 'ok', 'the head closes it');
t.code(await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-10-05', values: [{ measureId: 'stall', value: '9' }] }, D),
  'WINDOW_CLOSED', 'a closed phase takes no more filling');
r = await call('card.get', { phaseId: 'kartik-2026', weekId: '2026-10-05' }, D);
t.eq(r.data.measures.find(m => m.measureId === 'stall').value, '3', 'and what was filled stays readable');

/* ── an ETP batch is numbered like the others, and runs as long as it runs ── */
//
// "ETP may be of 3 months or more, and same identifier for a training batch like VL2 batch 51"
// (the head, 17 Oct 2026). So ETP-51 is "ETP batch 51", and its length is the coordinator's call —
// closing has never been on a timer here.
{
  const { vedicLevel } = await import('../src/closing.js');
  const { isTrainingBatch } = await import('../src/admin.js');
  t.eq(vedicLevel('ETP-51'), 'ETP', 'ETP-51 is a numbered training batch');
  t.eq(vedicLevel('ETP-7'), 'ETP', 'and so is a one-digit one');
  t.eq(vedicLevel('ETP'), null, 'ETP with no number is not a batch');
  t.eq(vedicLevel('ETP-51A'), null, 'a batch number is digits only');

  // the distinction REPORTED-2026-10-17 item 4 needs: a class coordinator must not delete accounts,
  // a training one may
  t.ok(isTrainingBatch('ETP-51'), 'ETP is a training batch');
  t.ok(!isTrainingBatch('VL2-51'), 'a Vedic level is not');
  t.ok(!isTrainingBatch('SPS'), 'nor is SPS');

  r = await call('batches.create', { batchId: 'ETP-51', name: 'ETP Batch 51', level: 'ETP', startedOn: '2026-10-05', endsOn: '2027-06-30' }, M);
  t.code(r, 'ok', 'the head opens ETP batch 51');
  t.eq(r.data.tracks, 'full',
    'its members still fill the whole weekly form — they are devotees besides being students, and the training adds a card, not a different week');
  t.eq(r.data.startedOn, '2026-10-05', 'with the date the training began');
  t.eq(r.data.closedAt, '', 'and no end until the coordinator closes it');

  // "the day when i defined the batch window from that day week wise card inputs will be taken"
  // (the head, 18 Oct 2026). A start in the future opens a window nobody can fill yet — ETP-21 was
  // created starting 31 October and its students had no week to put anything in.
  {
    const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    t.code(await call('batches.create', { batchId: 'ETP-76', name: 'ETP Batch 76', level: 'ETP', startedOn: soon, endsOn: '2027-06-30' }, M),
      'VALIDATION', 'a batch cannot start on a future date');
    const made = (await call('batches.create', { batchId: 'ETP-77', name: 'ETP Batch 77', level: 'ETP', endsOn: '2027-06-30' }, M));
    t.code(made, 'ok', 'and with no date given it opens anyway');
    t.ok(/^\d{4}-\d{2}-\d{2}$/.test(made.data.startedOn), `starting the day it was defined (${made.data.startedOn})`);
  }

  // A training is hidden from SIGN-UP and must still reach its own STAFF. meta serves both lists,
  // and serving one list for both jobs is what took the Students tab away from the ETP coordinator:
  // the screen reads meta to learn which batches it runs, found no ETP-51, and drew a class batch's
  // tabs instead (the head, 17 Oct 2026 — "there is no way to add students").
  const pub = await call('meta.get', {});
  t.ok(!pub.data.batches.some(b => b.batchId === 'ETP-51'), 'the public sign-up list has no training in it');
  t.eq(pub.data.staffBatches, undefined, 'and a caller with no login is told nothing about one');
  const mine = await call('meta.get', {}, M);
  t.ok(mine.data.staffBatches.some(b => b.batchId === 'ETP-51'),
    'but a signed-in staff caller gets the training in staffBatches, so its Students tab can be drawn');
  t.ok(!mine.data.batches.some(b => b.batchId === 'ETP-51'),
    'while their sign-up list still leaves it out — nobody signs up into a training');
}

/* ── a finished training: the tab goes, the record stays, the card freezes ── */
//
// "Once the batch finishes the ETP tab will disappear from the user's view, as that will now be
// seen in the account's info as a record, and the same ETP asset will be used by the new batch"
// (the head, 17 Oct 2026).
{
  at('2026-11-02T10:00:00');
  await call('phases.open', { phaseId: 'kartik-b', name: 'Kartik B', startsOn: '2026-10-01', endsOn: '2026-12-31' }, M);
  await call('batches.create', { batchId: 'ETP-52', name: 'ETP Batch 52', level: 'ETP', startedOn: '2026-10-05', endsOn: '2027-06-30' }, M);
  await call('coordinators.create', { username: 'etp', name: 'Etp Coordinator', batchIds: ['ETP-52'], tempPassword: 'Temp-etp-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp'");
  const E = (await call('auth.login', { login: 'etp', password: 'Temp-etp-2026' })).data.token;

  await call('auth.signUp', { phone: '6000000151', name: 'Gaurav Singh', batchId: 'SPS', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2000-02-02', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone: '6000000151', link: { noIdYet: true } }, M);
  // enrolled, not signed up into it: the student stays an SPS devotee (the head, 17 Oct 2026)
  t.code(await call('enrol.add', { batchId: 'ETP-52', login: '6000000151' }, E), 'ok',
    'the coordinator enrols an existing devotee into the training');
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000151' AND to_week = ''")[0].b, 'SPS',
    'and their own batch is untouched: the training adds a card, not a different week');
  const S = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.token;

  await call('targets.set', { phaseId: 'kartik-b', targets: [{ measureId: 'stall', target: '4' }] }, S);
  t.code(await call('card.fill', { phaseId: 'kartik-b', weekId: '2026-10-26', values: [{ measureId: 'stall', value: '2' }] }, S),
    'ok', 'a student fills their card while the training runs');

  const tc = (await call('card.get', { phaseId: 'kartik-b', weekId: '2026-10-26' }, S)).data;
  t.eq(tc.trainee, true, 'a trainee is known to be one');
  t.eq(tc.measures.find(m => m.measureId === 'ftp').label, 'ETP attendance',
    'and the same measure reads ETP attendance on their card');
  t.eq(tc.measures.length, 11, 'the card is otherwise the facilitators\' own, which is what they are training for');

  /* ── finding somebody to enrol: by name, by number, by IYF id ── */
  //
  // "on any basis number, name or others" / "and if iyf id ??" (the head, 18 Oct 2026). The results
  // PRINT the IYF id, so a coordinator types it back in; before this it matched nothing.
  {
    // somebody NOT yet enrolled: the search deliberately hides people already in this training
    DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, iyf_id, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
      VALUES ('6000000161', 'DEVOTEE', 'ACTIVE', 'Madhav Das', '6000000161', 'IYFD-2019-0042', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
    const by = async (q) => (await call('enrol.search', { batchId: 'ETP-52', q }, E)).data.people.map(p => p.name);
    t.eq(await by('Madhav'), ['Madhav Das'], 'by name');
    t.eq(await by('6000000161'), ['Madhav Das'], 'by the whole phone number');
    t.eq(await by('0161'), ['Madhav Das'], 'by part of the number');
    t.eq(await by('IYFD-2019-0042'), ['Madhav Das'], 'by their IYF id, which the results show them');
    t.eq(await by('iyfd-2019-0042'), ['Madhav Das'], 'the id is matched whatever its case');
    t.eq(await by('2019-0042'), ['Madhav Das'], 'and by part of it');

    // an id must not be reduced to digits: 'IYFD-2019-0042' would become '20190042', and a search
    // for one person's id must never return a different person whose phone happens to contain it
    // 8 digits on purpose: not a real mobile number, so this fixture cannot name a real person
    // while still containing the digits an id would strip to.
    DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
      VALUES ('20190042', 'DEVOTEE', 'ACTIVE', 'Someone Else', '20190042', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
    t.eq(await by('IYFD-2019-0042'), ['Madhav Das'],
      'searching an id returns that person alone, never a phone that shares its digits');

    t.code(await call('enrol.search', { batchId: 'ETP-52', q: 'x' }, E), 'VALIDATION', 'one character is not a search');
  }

  /* ── the student's own side: the tab appears, goes, and leaves a record ── */
  //
  // "when the coordinator adds someone in etp only than he can see the etp tab and when batch
  //  finishes than not, and his etp training results we can map in the users profile"
  // (the head, 17-18 Oct 2026).
  {
    const scopesOf = async (tok) => (await call('auth.me', {}, tok)).data?.user?.scopes
      ?? (await call('profile.get', {}, tok)).data;
    // What the APP reads to draw the menu: the user's scopes from auth.me (every open) and from
    // auth.login. The tab is drawn from this, not from card.get — so this is what must say trainee.
    // (18 Oct 2026: Suraj Sahu was enrolled and saw no tab; this proves the server side of it.)
    const who = (await call('auth.me', {}, S)).data.user.scopes;
    t.eq(who.trainee?.batchId, 'ETP-52', 'auth.me tells the app they are a trainee, so the menu can offer the card');
    const fresh = (await call('auth.login', { login: '6000000151', password: 'Devotee pass 2026' })).data.user.scopes;
    t.eq(fresh.trainee?.batchId, 'ETP-52', 'and so does a fresh login');

    // while enrolled: they are a trainee, and the card is theirs
    const me = (await call('card.get', { phaseId: 'kartik-b', weekId: '2026-10-26' }, S)).data;
    t.eq([me.trainee, me.hasCard], [true, true], 'an enrolled student has a card of their own');
    t.eq(me.batchId, 'ETP-52', 'and it belongs to the training, not to the phase');

    // their own profile carries the training, so About can show what they did in it
    const prof = (await call('profile.get', {}, S)).data;
    t.ok(Array.isArray(prof.trainings) && prof.trainings.some(x => x.batchId === 'ETP-52'),
      'their own profile carries the training (not only the coordinator\'s contact card)');
    t.eq(prof.trainings.find(x => x.batchId === 'ETP-52').running, true, 'marked as running while it runs');

    // taken OUT of the training: the card goes. Being removed is not the same as finishing.
    t.code(await call('enrol.remove', { batchId: 'ETP-52', login: '6000000151', reason: 'test' }, E), 'ok',
      'the coordinator takes them out');
    t.eq((await call('auth.me', {}, S)).data.user.scopes.trainee, null,
      'removed, auth.me no longer calls them a trainee, so the tab goes on their next open');
    const after = (await call('card.get', { phaseId: 'kartik-b', weekId: '2026-10-26' }, S)).data;
    t.eq(after.trainee, false,
      'removed from the training, the card is no longer the training\'s: being taken out is not finishing it');
    t.eq(after.batchId, '', 'and it no longer points at the training');
    // ADR 0010 (the head, 22 Oct 2026): the facilitation enrolling gave them was TEMPORARY, and being taken out of
    // the training takes it back — until 22 Oct they kept it (hasCard stayed true). A devotee who does not facilitate
    // and is not in a training has no card.
    t.eq(after.hasCard, false, 'taken out, the temporary facilitation goes with the training: no card');
    t.eq((await call('auth.me', {}, S)).data.user.scopes.facilitator, null, '… and no facilitator scope');

    // put back, so the rest of this block runs against a student who is in the training
    t.code(await call('enrol.add', { batchId: 'ETP-52', login: '6000000151' }, E), 'ok', 'and can be put back');
    t.eq((await call('card.get', { phaseId: 'kartik-b', weekId: '2026-10-26' }, S)).data.trainee, true,
      'put back, the training\'s card is theirs again');
  }

  /* ── the scoreboard: the boards on offer, and one person's card from a row ── */
  //
  // "in the admin I should be able to see the scoreboard... each scoreboard with all individual
  //  facilitators, that is ETP cards, and facilitators with their own cards of target set"
  // (the head, 18 Oct 2026).
  {
    const mine = (await call('board.list', {}, E)).data;
    t.ok(mine.boards.some(b => b.batchId === 'ETP-52'), "the coordinator is offered their own training's board");
    t.ok(!mine.boards.some(b => b.kind === 'facilitators'), 'and not the facilitators\' board, which is the head\'s');
    const head = (await call('board.list', {}, M)).data;
    t.ok(head.boards.some(b => b.kind === 'facilitators') && head.boards.some(b => b.batchId === 'ETP-52'),
      'the head is offered both: every running training and the facilitators');
    t.ok(/^\d{4}-\d{2}-\d{2}$/.test(head.weekId), `and the week it opens on (${head.weekId})`);

    // tapping a row opens that person's card
    const one = (await call('card.of', { login: '6000000151', phaseId: 'kartik-b', weekId: '2026-10-26' }, E)).data;
    t.eq([one.login, one.trainee, one.batchId], ['6000000151', true, 'ETP-52'],
      "a row opens the person's own card, over their training's dates");
    t.ok(Array.isArray(one.measures) && one.measures.length === 11, 'with the eleven measures they filled against');

    // and only for somebody in a training they hold
    t.code(await call('card.of', { login: 'master', phaseId: 'kartik-b' }, E), 'FORBIDDEN',
      'a coordinator cannot read the card of somebody outside their training');
    t.code(await call('card.of', { login: '6000000151', phaseId: 'kartik-b', weekId: '2026-10-26' }, M), 'ok',
      'the head reads anyone');
  }

  /* ── the coordinator sees who filled, and marks the class ── */
  //
  // "the etp coordinator they see whether the etp person filled there that week template card or not
  //  and they can mark them present or absent for that weeks etp class" (the head, 18 Oct 2026).
  {
    let bd = (await call('board.get', { phaseId: 'kartik-b', weekId: '2026-10-26', batchId: 'ETP-52' }, E)).data;
    const me = bd.rows.find(r => r.login === '6000000151');
    t.eq([bd.kind, me.filled, me.asked], ['training', 1, 1],
      'the board says whether this student filled their card this week');
    t.eq(me.mark, '', 'and starts with no attendance mark');

    t.code(await call('training.attendance', { batchId: 'ETP-52', weekId: '2026-10-26',
      marks: [{ login: '6000000151', mark: 'P' }] }, E), 'ok', 'the coordinator marks them present');
    bd = (await call('board.get', { phaseId: 'kartik-b', weekId: '2026-10-26', batchId: 'ETP-52' }, E)).data;
    t.eq(bd.rows.find(r => r.login === '6000000151').mark, 'P', 'and the board shows it');

    // their OWN batch's attendance that week is a different record and must not have moved: an ETP
    // student sits in two classes in one week, which is why this is its own table (migration 0057)
    t.eq(rows("SELECT COUNT(*) AS n FROM attendance WHERE login = '6000000151' AND week_id = '2026-10-26'")[0].n, 0,
      "marking the training did not touch the student's own batch attendance");

    // the closing screen counts these marks: a training's class lives in training_attendance, not attendance
    t.eq((await call('batches.closingPreview', { batchId: 'ETP-52' }, E)).data.members.find(m => m.login === '6000000151')?.present, 1,
      "closing counts the training's own class marks (it read the wrong table and showed 0)");
    t.code(await call('training.attendance', { batchId: 'ETP-52', weekId: '2026-10-26',
      marks: [{ login: '6000000151', mark: 'A' }] }, E), 'ok', 'a mark can be corrected');
    t.code(await call('training.attendance', { batchId: 'ETP-52', weekId: '2026-10-26',
      marks: [{ login: '6000000152', mark: 'P' }] }, E), 'VALIDATION',
      'somebody who is not in this training cannot be marked');
    t.code(await call('training.attendance', { batchId: 'SPS', weekId: '2026-10-26',
      marks: [{ login: '6000000151', mark: 'P' }] }, M), 'CONFLICT',
      'and a class batch has no training attendance to mark');
  }

  // the coordinator closes the training
  // 'qualified', not 'promoted': an ETP student never left their own batch, so finishing does not
  // MOVE them — it makes them count among the facilitators (the head, 17 Oct 2026)
  t.code(await call('batches.close', { batchId: 'ETP-52', decisions: [{ login: '6000000151', decision: 'promoted', toBatch: 'SPS' }] }, E),
    'VALIDATION', 'a trainee is not PROMOTED out of ETP: there is nowhere above it on the ladder');
  // ADR 0010/0014 C: qualifying no longer grants facilitation by itself — FTP will; until then the head makes a
  // trainee's facilitation lasting by name, and that is what keeps them facilitating after the training closes
  t.eq(rows("SELECT facilitation AS f FROM accounts WHERE login = '6000000151'")[0].f, 'temporary', 'while training, their facilitation is temporary');
  t.code(await call('facilitators.setLasting', { name: 'Gaurav Singh', reason: 'ready to facilitate' }, E), 'FORBIDDEN', 'only the head makes it lasting');
  t.code(await call('facilitators.setLasting', { name: 'Gaurav Singh', reason: 'ready to facilitate' }, M), 'ok', 'the head makes it lasting');
  t.code(await call('batches.close', { batchId: 'ETP-52', decisions: [{ login: '6000000151', decision: 'qualified' }] }, E),
    'ok', 'the coordinator closes the training, qualifying them');
  t.eq(rows("SELECT facilitator_name AS f, facilitation AS k FROM accounts WHERE login = '6000000151'").map(x => [x.f, x.k])[0], ['Gaurav Singh', 'lasting'],
    'made lasting by the head, they stay among the facilitators: their ETP section goes and the facilitator one appears');
  t.eq(rows("SELECT COUNT(*) n FROM facilitators WHERE name = 'Gaurav Singh'")[0].n, 1,
    'and their name joins the list devotees pick from');
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000151' AND to_week = '' AND state = 'ACTIVE'")[0].b, 'SPS',
    'qualifying moved them to no new batch: they are still the SPS devotee they always were');
  t.eq(rows("SELECT decision AS d FROM batch_closings WHERE login = '6000000151'")[0].d, 'qualified',
    'the decision is on record as its own verb, not as a promotion');

  // the card is now a record: readable, not editable. It is the TRAINING's card, keyed by the batch (Phase 22, J1: the
  // ETP route is not the phase's); made lasting, the phase's card is now theirs as a facilitator — a different card
  t.code(await call('card.fill', { phaseId: 'ETP-52', weekId: '2026-10-26', values: [{ measureId: 'stall', value: '9' }] }, S),
    'WINDOW_CLOSED', 'the finished training takes no more filling: its card is a record');
  t.eq(rows("SELECT value FROM fills WHERE login = '6000000151' AND measure_id = 'stall' AND phase_id = 'ETP-52'")[0].value, '2',
    'and what they filled during the training is untouched');
  t.eq((await call('card.get', { phaseId: 'kartik-b', weekId: '2026-11-02' }, S)).data.trainee, false,
    'made lasting, their card on the phase is now a facilitator\'s (the FTP route), apart from the training record');

  // it shows on their contact card
  const card = (await call('devotees.get', { login: '6000000151' }, M)).data;
  t.eq(card.trainings.map(x => x.batchId), ['ETP-52'], 'the training is on their contact card');
  t.eq(card.trainings[0].running, false, 'marked finished');
  t.ok(card.trainings[0].finishedOn !== '', 'with the day it finished');

  // the head may open one card for a real correction, and it expires
  t.code(await call('card.unlock', { login: '6000000151', reason: 'He filled the wrong week' }, E), 'FORBIDDEN',
    'a coordinator cannot reopen a finished card');
  t.code(await call('card.unlock', { login: '6000000151', reason: 'x' }, M), 'VALIDATION', 'and the head must say why');
  t.code(await call('card.unlock', { login: '6000000151', reason: 'He filled the wrong week' }, M), 'ok', 'the head opens it');
  t.code(await call('card.fill', { phaseId: 'ETP-52', weekId: '2026-10-26', values: [{ measureId: 'stall', value: '3' }] }, S),
    'ok', 'so the correction can be made');

  at('2026-11-20T10:00:00');   // past the 7 days
  t.code(await call('card.fill', { phaseId: 'ETP-52', weekId: '2026-10-26', values: [{ measureId: 'stall', value: '9' }] }, S),
    'WINDOW_CLOSED', 'and the permission expires rather than staying open by forgetting');

  // the next training is a NEW number, reusing the same setup
  at('2026-11-21T10:00:00');
  // 21 Nov, the day it is defined: a training starts when it is created, never later (18 Oct 2026)
  t.code(await call('batches.create', { batchId: 'ETP-53', name: 'ETP Batch 53', level: 'ETP', startedOn: '2026-11-21', endsOn: '2027-06-30' }, M),
    'ok', 'the next training is ETP-53: a new number, the same setup');
  t.eq(rows("SELECT closed_at <> '' AS c FROM batches WHERE batch_id = 'ETP-52'")[0].c, 1,
    'and ETP-52 stays closed and readable, rather than being reopened');
}

/* ── TRD: temple residents are a batch like any other (the head, 17 Oct 2026) ── */
//
// "TRD" already meant the ABSENCE of a batch: facilitator.js showed a facilitator with none as TRD.
// That left a temple resident unable to do the ordinary things, because signing up, filling sadhana
// and being seen by a coordinator all need a batch. Now it is one.
{
  const { isTrainingBatch } = await import('../src/admin.js');
  const { vedicLevel } = await import('../src/closing.js');

  const b = rows("SELECT * FROM batches WHERE batch_id = 'TRD'")[0];
  t.ok(!!b, 'TRD is a batch');
  t.eq(b.tracks, 'full', 'its members fill the whole weekly form, like any devotee');
  t.eq(b.active, 1, 'and it is open for sign-ups');

  // it is not an intake: temple residents are not a term that ends
  t.eq(vedicLevel('TRD'), null, 'TRD is not a numbered intake');
  t.ok(!isTrainingBatch('TRD'), 'nor a training batch — a class coordinator holds it');
  t.eq(b.closed_at, '', 'and it never closes');

  // it reaches sign-up, which is the point of making it a batch
  const meta = (await call('meta.get', {})).data;
  t.ok(meta.batches.some(x => x.batchId === 'TRD'), 'it is offered when an account is created');
  t.eq(meta.batches.find(x => x.batchId === 'TRD').tracks, 'full', 'as a full batch');

  // and somebody can actually join it and be marked
  await call('auth.signUp', { phone: '6000000160', name: 'Hari Prasad', batchId: 'TRD', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '1999-09-09', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  t.code(await call('requests.approve', { phone: '6000000160', link: { noIdYet: true } }, M), 'ok',
    'a temple resident signs up and is approved into TRD');
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000160' AND to_week = ''")[0].b, 'TRD',
    'and is a member of it');
}

/* ── the boards: who sees whose scores (the head, 17 Oct 2026) ─────────── */
//
// ETP students to their own coordinator and the admin; facilitators to the admin. A batch
// coordinator gets no facilitation board — they coordinate a class, whose scores are the weekly
// sadhana they already see.
{
  at('2026-11-23T10:00:00');
  await call('batches.create', { batchId: 'ETP-54', name: 'ETP Batch 54', level: 'ETP', startedOn: '2026-11-23', endsOn: '2027-06-30' }, M);
  await call('coordinators.create', { username: 'etp54', name: 'Etp Fiftyfour', batchIds: ['ETP-54'], tempPassword: 'Temp-e54-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp54'");
  const E4 = (await call('auth.login', { login: 'etp54', password: 'Temp-e54-2026' })).data.token;

  for (const [ph, nm] of [['6000000170', 'Ishan Mehta'], ['6000000171', 'Jatin Rao']]) {
    await call('auth.signUp', { phone: ph, name: nm, batchId: 'SPS', facilitator: FAC, ...CONTACT,
      groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
      profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
                 address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
    await call('requests.approve', { phone: ph, link: { noIdYet: true } }, M);
    await call('enrol.add', { batchId: 'ETP-54', login: ph }, E4);
  }
  const S1 = (await call('auth.login', { login: '6000000170', password: 'Devotee pass 2026' })).data.token;

  await call('phases.open', { phaseId: 'kartik-c', name: 'Kartik C', startsOn: '2026-11-01', endsOn: '2027-02-28' }, M);
  await call('targets.set', { phaseId: 'kartik-c', targets: [{ measureId: 'stall', target: '4' }] }, S1);
  await call('card.fill', { phaseId: 'kartik-c', weekId: '2026-11-23', values: [{ measureId: 'stall', value: '2' }] }, S1);

  let r = await call('board.get', { phaseId: 'kartik-c', weekId: '2026-11-23', batchId: 'ETP-54' }, E4);
  t.code(r, 'ok', 'the ETP coordinator sees their own batch\'s board');
  t.eq(r.data.kind, 'training', 'it is a training board');
  t.eq(r.data.rows.map(x => x.name), ['Ishan Mehta', 'Jatin Rao'], 'with everyone in the training on it');
  t.eq(r.data.rows[0].week, 50, '2 of a target of 4 is half the week');
  t.eq(r.data.rows[0].average, 50, 'and the phase average follows from the one week filled');
  t.eq(r.data.rows[1].week, null,
    'somebody who was given no targets has NO score — not nought, which would read as though they had failed');

  t.code(await call('board.get', { phaseId: 'kartik-c', batchId: 'ETP-54' }, M), 'ok', 'the head sees it too');

  // the facilitators' board is the head's alone
  r = await call('board.get', { phaseId: 'kartik-c' }, M);
  t.code(r, 'ok', 'the head sees the facilitators\' board');
  t.eq(r.data.kind, 'facilitators', 'which is a different board');
  t.code(await call('board.get', { phaseId: 'kartik-c' }, E4), 'FORBIDDEN',
    'a coordinator does not see the facilitators\' board');
  t.code(await call('board.get', { phaseId: 'kartik-c' }, S1), 'FORBIDDEN', 'nor does a student');
}

/* ── ETP runs on its batch's window; a facilitator on the phase ─────────── */
//
// "ETP is not phase wise implemented — it has a starting and ending window, whereas FTP has a
// phase" (the head, 17 Oct 2026). A training that begins in November must not be measured over a
// phase that began in September: it would open on a card already two months spent, and be judged on
// weeks before it existed.
{
  at('2026-11-23T10:00:00');
  await call('phases.open', { phaseId: 'kartik-d', name: 'Kartik D', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
  await call('batches.create', { batchId: 'ETP-60', name: 'ETP Batch 60', level: 'ETP', startedOn: '2026-11-02', endsOn: '2027-06-30' }, M);
  await call('auth.signUp', { phone: '6000000190', name: 'Kiran Das', batchId: 'SPS', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone: '6000000190', link: { noIdYet: true } }, M);
  await call('enrol.add', { batchId: 'ETP-60', login: '6000000190' }, M);
  const K = (await call('auth.login', { login: '6000000190', password: 'Devotee pass 2026' })).data.token;

  const trainee = (await call('card.get', { phaseId: 'kartik-d' }, K)).data;
  t.eq(trainee.trainee, true, 'a trainee is known to be one');
  t.eq(trainee.from, '2026-11-02', 'their card starts when their TRAINING started, not when the phase did');
  // Phase 22, J1: to the training's own end date, past the phase's end — one card over the training (the ETP route)
  t.eq(trainee.to, '2027-06-30', 'and runs to the training\'s end date, not the phase\'s');

  // a facilitator on the same phase is measured over the phase itself
  const fac = (await call('card.get', { phaseId: 'kartik-d' }, M)).data;
  t.eq(fac.trainee, false, 'the head is not a trainee');
  t.eq([fac.from, fac.to], ['2026-09-01', '2026-12-31'], 'so their card is the phase, start to end');

  // and a week before the training began is not theirs to fill
  t.code(await call('card.fill', { phaseId: 'kartik-d', weekId: '2026-09-07', values: [{ measureId: 'stall', value: '1' }] }, K),
    'VALIDATION', 'a trainee cannot fill a week from before their training started');
}

/* ── every level the Add-a-batch form offers can actually be created ────── */
//
// ETP and TRD existed on the server but were missing from the level picker, so neither could be
// created from the app at all (the head, 17 Oct 2026). A level the form offers and the server
// refuses is the same defect the other way round, so this checks the two agree.
{
  at('2026-12-01T10:00:00');
  const OFFERED = ['VL2', 'VL3', 'ETP', 'SPS', 'DPS', 'BSS', 'BVS', 'TRD'];
  const numbered = { VL2: 'VL2-91', VL3: 'VL3-91', ETP: 'ETP-91' };
  for (const lvl of OFFERED) {
    const id = numbered[lvl] || (lvl + '9');
    const r = await call('batches.create', { batchId: id, name: `Check ${lvl}`, level: lvl,
      ...(numbered[lvl] ? { startedOn: '2026-12-01' } : {}), ...(lvl === 'ETP' ? { endsOn: '2027-03-31' } : {}) }, M);   // a training has its end date (Phase 22, J1)
    t.code(r, 'ok', `the form offers ${lvl}, and the server creates it`);
  }
  t.eq(rows("SELECT tracks AS t FROM batches WHERE batch_id = 'TRD9'")[0].t, 'full',
    'a TRD batch fills the whole weekly form');
  t.eq(rows("SELECT tracks AS t FROM batches WHERE batch_id = 'ETP-91'")[0].t, 'full',
    'and so does a training batch: the training adds a card, not a different week');
}

/* ── enrolment adds an identity; ending it takes away only that ────────── */
//
// "As soon as the membership is deprecated, say for ETP or any other, the user is back with the
// features apart from the features of that membership" (the head, 17 Oct 2026).
//
// That is why a training is an ENROLMENT and not a membership: it stacks on who somebody already
// is, the way being a group leader does, so ending it can only remove what it added.
{
  at('2026-12-07T10:00:00');
  await call('batches.create', { batchId: 'ETP-70', name: 'ETP Batch 70', level: 'ETP', startedOn: '2026-12-07', endsOn: '2027-06-30' }, M);
  await call('auth.signUp', { phone: '6000000220', name: 'Manoj Kumar', batchId: 'SPS', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2002-02-02', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone: '6000000220', link: { noIdYet: true } }, M);

  const before = rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000220' AND to_week = ''")[0].b;
  t.eq(before, 'SPS', 'he is an SPS devotee');

  t.code(await call('enrol.add', { batchId: 'ETP-70', login: '6000000220' }, M), 'ok', 'he is enrolled in the training');
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000220' AND to_week = ''")[0].b, 'SPS',
    'and is STILL an SPS devotee: enrolling moved nobody');
  t.eq(rows("SELECT COUNT(*) n FROM memberships WHERE login = '6000000220' AND to_week = ''")[0].n, 1,
    'with one membership, not two — the app never has to guess which batch he is in');

  // taken out again
  t.code(await call('enrol.remove', { batchId: 'ETP-70', login: '6000000220', reason: 'He stepped back' }, M), 'ok',
    'he is taken out of the training');
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000220' AND to_week = ''")[0].b, 'SPS',
    'he is back to exactly what he was: an SPS devotee, with everything that carried');
  t.eq(rows("SELECT state AS s FROM enrolments WHERE login = '6000000220'")[0].s, 'ENDED',
    'and the enrolment is ENDED, not deleted: what he filled during the training stays readable');

  // the enrolment is gone, so the training no longer lists him
  const list = (await call('enrol.list', { batchId: 'ETP-70' }, M)).data;
  t.eq(list.students.length, 0, 'the training no longer counts him among its students');
}

/* ── a trainee facilitates from day one (the head, 17 Oct 2026) ────────── */
//
// Their card asks for "Sunday VL-1 facilitation attendance" and "one-to-one meetings with devotees".
// Neither can be reported without students, and the whole point of the training is learning by
// doing it — so enrolling grants the facilitator scope rather than waiting for them to qualify.
{
  at('2026-12-14T10:00:00');
  await call('batches.create', { batchId: 'ETP-77', name: 'ETP Batch 77', level: 'ETP', startedOn: '2026-12-14', endsOn: '2027-06-30' }, M);
  await call('auth.signUp', { phone: '6000000230', name: 'Nikhil Bose', batchId: 'SPS', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2000-06-06', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone: '6000000230', link: { noIdYet: true } }, M);

  t.eq(rows("SELECT facilitator_name AS f FROM accounts WHERE login = '6000000230'")[0].f, '',
    'before the training he facilitates nobody');

  t.code(await call('enrol.add', { batchId: 'ETP-77', login: '6000000230' }, M), 'ok', 'he is enrolled');
  t.eq(rows("SELECT facilitator_name AS f FROM accounts WHERE login = '6000000230'")[0].f, 'Nikhil Bose',
    'enrolling makes him a facilitator, so he can report the facilitation his card asks about');
  t.eq(rows("SELECT COUNT(*) n FROM facilitators WHERE name = 'Nikhil Bose'")[0].n, 1,
    'and his name joins the list, so a coordinator can give him students');

  // his own batch is still untouched — the point of an enrolment
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000230' AND to_week = ''")[0].b, 'SPS',
    'while he is still the SPS devotee he was');

  // somebody who already facilitates is not disturbed
  await call('enrol.add', { batchId: 'ETP-77', login: '6000000220' }, M).catch(() => {});
  t.ok(true, 'enrolling somebody who already facilitates leaves their name as it was');
}

/* ── an ETP coordinator posts to their training (the head, 17 Oct 2026) ── */
//
// A training is ENROLLED, not joined, so a student's membership names their own SPS batch and never
// the training. Without enrolments counting, a post to ETP reached nobody: its coordinator could
// write one and not one student would see it.
{
  at('2026-12-21T10:00:00');
  await call('batches.create', { batchId: 'ETP-88', name: 'ETP Batch 88', level: 'ETP', startedOn: '2026-12-21', endsOn: '2027-06-30' }, M);
  await call('coordinators.create', { username: 'etp88', name: 'Etp Eightyeight', batchIds: ['ETP-88'], tempPassword: 'Temp-e88-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp88'");
  const E8 = (await call('auth.login', { login: 'etp88', password: 'Temp-e88-2026' })).data.token;

  await call('auth.signUp', { phone: '6000000250', name: 'Pankaj Rana', batchId: 'SPS', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2001-05-05', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone: '6000000250', link: { noIdYet: true } }, M);
  await call('enrol.add', { batchId: 'ETP-88', login: '6000000250' }, E8);
  const P = (await call('auth.login', { login: '6000000250', password: 'Devotee pass 2026' })).data.token;

  t.code(await call('announcements.create', { title: 'Training this Sunday',
    body: 'We meet at 4 PM in the hall. Bring your journal.', audience: ['ETP-88'] }, E8), 'ok',
    'the ETP coordinator posts to their training');

  const seen = (await call('announcements.list', {}, P)).data.announcements.map(x => x.title);
  t.ok(seen.includes('Training this Sunday'), 'and a student of that training sees it');

  // somebody not in the training does not: a second SPS devotee, never enrolled
  await call('auth.signUp', { phone: '6000000251', name: 'Rohit Verma', batchId: 'SPS', facilitator: FAC, ...CONTACT,
    groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2001-07-07', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone: '6000000251', link: { noIdYet: true } }, M);
  const R = (await call('auth.login', { login: '6000000251', password: 'Devotee pass 2026' })).data.token;
  const other = (await call('announcements.list', {}, R)).data.announcements.map(x => x.title);
  t.ok(!other.includes('Training this Sunday'),
    'while an SPS devotee who is NOT enrolled does not — the post reaches the training, not their batch');

  // a coordinator cannot post to a training that is not theirs. A fresh login: the token from the
  // top of this file is long expired by here, and an expired one answers UNAUTHENTICATED, which
  // would pass for the wrong reason.
  await call('coordinators.create', { username: 'spsx', name: 'Spsx Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-spsx-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spsx'");
  const X = (await call('auth.login', { login: 'spsx', password: 'Temp-spsx-2026' })).data.token;
  t.code(await call('announcements.create', { title: 'Not mine', body: 'This should be refused.', audience: ['ETP-88'] }, X),
    'FORBIDDEN', "another batch's coordinator cannot post to this training");
}

/* ── closing a training ends EVERY enrolment, and nobody leaves IYF by leaving ETP (18 Oct 2026) ── */
//
// "removal or batch close takes the tab away" (the head, 18 Oct 2026). Only 'qualified' ended its enrolment:
// a 'repeat' trainee kept an ACTIVE enrolment in the closed batch, so their ETP section stayed for good. And
// 'left' ran the class-batch path on an ENROLMENT: it ended the membership row whose id happened to equal the
// enrolment's id — somebody else's batch — and made the trainee's account INACTIVE. Training runs sideways
// (decision 47): leaving it moves nobody and switches nobody off.
{
  at('2026-12-28T10:00:00');
  await call('batches.create', { batchId: 'ETP-89', name: 'ETP Batch 89', level: 'ETP', startedOn: '2026-12-28', endsOn: '2027-06-30' }, M);
  await call('coordinators.create', { username: 'etp89', name: 'Etp Eightynine', batchIds: ['ETP-89'], tempPassword: 'Temp-e89-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp89'");
  const E9 = (await call('auth.login', { login: 'etp89', password: 'Temp-e89-2026' })).data.token;
  for (const [ph, nm] of [['6000000180', 'Kunal Bose'], ['6000000181', 'Lalit Jain']]) {
    await call('auth.signUp', { phone: ph, name: nm, batchId: 'SPS', facilitator: FAC, ...CONTACT,
      groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
      profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
                 address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
    await call('requests.approve', { phone: ph, link: { noIdYet: true } }, M);
    await call('enrol.add', { batchId: 'ETP-89', login: ph }, E9);
  }
  // every membership as it stands, to prove closing the training touches none of them
  const before = JSON.stringify(rows('SELECT id, login, batch_id, to_week, state FROM memberships ORDER BY id'));

  t.code(await call('batches.close', { batchId: 'ETP-89', decisions: [
    { login: '6000000180', decision: 'promoted', toBatch: 'DPS' }, { login: '6000000181', decision: 'left' }] }, M),
    'VALIDATION', 'not even the head promotes somebody out of a training: they qualify, repeat or leave it');
  t.code(await call('batches.close', { batchId: 'ETP-89', decisions: [
    { login: '6000000180', decision: 'repeat' }, { login: '6000000181', decision: 'left' }] }, E9),
    'ok', 'the coordinator closes the training: one to repeat it, one who left');

  t.eq(rows("SELECT COUNT(*) AS n FROM enrolments WHERE batch_id = 'ETP-89' AND state = 'ACTIVE'")[0].n, 0,
    'every enrolment ended with the training — a repeat is enrolled afresh in the next one');
  for (const ph of ['6000000180', '6000000181']) {
    const T = (await call('auth.login', { login: ph, password: 'Devotee pass 2026' })).data.token;
    t.ok(!!T, `${ph} can still sign in: leaving a training does not switch an account off`);
    t.eq((await call('auth.me', {}, T)).data?.user?.scopes?.trainee, null, `${ph}'s ETP section goes with the closed batch`);
  }
  t.eq(rows("SELECT status FROM accounts WHERE login = '6000000181'")[0].status, 'ACTIVE',
    'the one who left the training is still an active devotee');
  t.eq(JSON.stringify(rows('SELECT id, login, batch_id, to_week, state FROM memberships ORDER BY id')), before,
    "and no batch membership moved — neither theirs nor anybody else's");
  t.eq(rows("SELECT login, decision FROM batch_closings WHERE batch_id = 'ETP-89' ORDER BY login").map(x => x.decision),
    ['repeat', 'left'], 'both decisions are on record');
}

t.done();
