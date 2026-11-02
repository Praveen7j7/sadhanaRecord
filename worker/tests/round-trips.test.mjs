// Round trips per action (22 Oct 2026, B1 of the speed & design lane).
//
// What a devotee and a coordinator wait for on a phone is the number of Worker → D1 round trips, not the SQL: the
// database is idle (< 1 % of the free day) and each hop is a network crossing. The 17 Oct pass took home.get from 22
// to 10; the 22 Oct pass took the actions below further, by sending reads that do not depend on each other in ONE
// batch (db.js `reads`). This suite pins each action's budget so a later change cannot quietly add hops back.
//
// A statement run alone is one hop; a batch is one hop however many statements it carries. The same world as
// coord.test.mjs: a head, a coordinator of SPS2, three devotees, last week submitted.
// If a budget fails because a NEW, NEEDED read was added, raise the budget here with one line saying why — never
// to make a slower version pass.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';

const t = suite('round trips per action');
const { DB, call, clock, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, batchId, name) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000146', 'SPS2', 'Arjun Das');
await join('6000000147', 'SPS2', 'Bhima Das');
DB.sql.exec("UPDATE settings SET value = '2026-09-21' WHERE key = 'tracking_from'");
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
for (let i = 0; i < 7; i++) { const d = new Date(Date.parse('2026-09-28T00:00:00Z') + i * 864e5).toISOString().slice(0, 10); at(d + 'T21:00:00'); await call('week.saveDay', { weekId: '2026-09-28', date: d, version: 0, day }, A); }
at('2026-10-04T19:00:00');
await call('week.submit', { weekId: '2026-09-28' }, A);
at('2026-10-05T10:00:00');                      // Monday morning: last week AND this week are both open on Home

// the facilitation card (ADR 0012): a phase, one facilitator with a target, filled weeks and a student of theirs
await call('phases.open', { phaseId: 'kartik-t', name: 'Kartik T', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
DB.sql.exec("UPDATE accounts SET facilitator_name = 'Bhima Das' WHERE login = '6000000147'");
DB.sql.exec("UPDATE memberships SET facilitator = 'Bhima Das' WHERE login = '6000000146' AND to_week = ''");
const B = (await call('auth.login', { login: '6000000147', password: 'Devotee pass 2026' })).data.token;
await call('targets.set', { phaseId: 'kartik-t', targets: [{ measureId: 'stall', target: '5' }, { measureId: 'seniorMeet', target: '1' }] }, B);
await call('card.fill', { phaseId: 'kartik-t', weekId: '2026-09-28', values: [{ measureId: 'stall', value: '4' }, { measureId: 'seniorMeet', value: '1' }] }, B);
await call('stages.set', { phaseId: 'kartik-t', stages: [{ stage: 'DPS', target: 1 }] }, B);

let hops = 0, widest = 0;
const realPrepare = DB.prepare.bind(DB), realBatch = DB.batch.bind(DB);
DB.prepare = (s) => { const wrap = (x) => ({ ...x, s: x.s, args: x.args, bind: (...a) => { widest = Math.max(widest, a.length); return wrap(x.bind(...a)); },
  first: async () => { hops++; return x.first(); }, all: async () => { hops++; return x.all(); }, run: async () => { hops++; return x.run(); } });
  return wrap(realPrepare(s)); };
DB.batch = async (list) => { hops++; return realBatch(list); };
const cost = async (action, data, token, requestId) => { hops = 0; const r = await call(action, data, token, requestId ? { requestId } : {}); return { r, hops }; };

// [action, data, token, budget, was]
for (const [action, data, token, budget, was] of [
  ['settings.get', {}, M, 4, 13],
  ['home.get', {}, A, 6, 11],
  ['devotees.get', { login: '6000000146' }, C, 6, 9],
  ['journals.get', {}, A, 5, 8],
  ['stats.all', {}, M, 5, 12],          // B5: eight per-batch aggregates in one batch, not eight requests
  ['stats.batch', { batchId: 'SPS2' }, C, 5, 16],   // the board's seven reads, then the chart's six, each one batch
  ['devotees.list', { batchId: 'SPS2' }, C, 5, 11],
  // the card, its average and its stages: read once for a set of people, not again per figure (B1 + G6)
  ['card.get', { phaseId: 'kartik-t', weekId: '2026-09-28' }, B, 6, 27],
  ['card.of', { login: '6000000147', phaseId: 'kartik-t' }, M, 8, 29],
  ['board.get', { phaseId: 'kartik-t' }, M, 8, 22],
  ['eligible.list', { batchId: 'SPS2' }, M, 4, 9],
  ['leaders.list', { batchId: 'SPS2' }, C, 4, 7],      // the level's pool from the batch list already in memory
  // Admin › Analysis (phase 21): the summary, the phases and the trainings' figures in ONE batch, however long the period
  ['analysis.get', { from: '2025-11-01', to: '2026-10-31' }, M, 3, 0],   // new in phase 21: the session, then everything in one batch
]) {
  const { r, hops: h } = await cost(action, data, token);
  t.code(r, 'ok', `${action} answers`);
  t.ok(h <= budget, `${action}: ${h} round trips, budget ${budget} (was ${was} before 22 Oct)`);
}
// the promotion explorer (phase 21): the students and the batches' rules in one batch, then their figures in one —
// the same number of hops for 3 students or 300 (figureReads groups by login)
{
  await call('facLogins.create', { username: 'fac-rt', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'fac-rt'");
  const F = (await call('auth.login', { login: 'fac-rt', password: 'Temp-fac-2026' })).data.token;
  const { r, hops } = await cost('fac.eligible', {}, F);
  t.code(r, 'ok', 'fac.eligible answers');
  t.ok(hops <= 6, `fac.eligible: ${hops} round trips, budget 6 (new in phase 21)`);
}
// the phone's usual journals call — its lists are current — answers from the version alone
const v = (await call('journals.get', {}, A)).data.version;
const nm = await cost('journals.get', { have: v }, A);
t.ok(nm.r.data.notModified === true && nm.hops <= 4, `journals.get with current lists: notModified in ${nm.hops} round trips (budget 4), reading no lecture or book rows`);


// G2: a signed-in write's replay check rides in the scope batch — a replayed save answers from it in 2 round trips
const w1 = await cost('settings.update', { reminderTime: '21:00' }, M, 'rt-remind-0001');
const w2 = await cost('settings.update', { reminderTime: '21:30' }, M, 'rt-remind-0001');
t.eq(w2.r.data, w1.r.data, 'the same request id replays the first answer');
t.ok(w2.hops <= 2, `a replayed write: ${w2.hops} round trips, budget 2 (was 3: the replay check was a hop of its own)`);
// G1: once an hour a call also moves its session's expiry. That write no longer clears the call's memory of the
// settings and batches, so the call costs what it always does, plus the one background UPDATE.
const base = await cost('settings.get', {}, M);
clock.now += 2 * 3600000;
const due = await cost('settings.get', {}, M);
t.ok(due.hops <= base.hops + 1, `a call due its hourly session refresh: ${due.hops} round trips, budget ${base.hops + 1} (was ${base.hops + 2})`);

// A board's round trips do not grow with the people on it, and no statement binds more than D1's 100 parameters. 125
// more facilitators (two IN-list chunks): the per-person loop this replaced cost about 11 more round trips EACH, and
// the IN list it did have would have failed at D1 past about 98 people.
const before = await cost('board.get', { phaseId: 'kartik-t' }, M);
for (let i = 0; i < 125; i++) {
  DB.sql.prepare(`INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, must_change_pw, facilitator_name)
                  VALUES (?, 'DEVOTEE', 'ACTIVE', ?, 'x', 'x', 1000, 0, ?)`).run(`f-${i}`, `Facilitator ${i}`, `Facilitator ${i}`);
}
widest = 0;
const big = await cost('board.get', { phaseId: 'kartik-t' }, M);
t.code(big.r, 'ok', 'a board of 126 answers');
t.eq(big.r.data.of, before.r.data.of + 125, 'with every facilitator on it');
t.eq(big.hops, before.hops, `and in the same round trips as a board of one (${big.hops})`);
t.ok(widest <= 100, `no statement binds more than 100 parameters (widest: ${widest})`);

t.done();
