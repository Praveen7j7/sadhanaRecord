// The promotion explorer (phase 21, 23 Oct 2026): a facilitator's students on the promotion ladder, from any batch, with
// every figure over a period they choose and each batch's own rule — the ticks and thresholds are applied on the phone.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { periodWeeks } from '../src/explorer.js';

const t = suite('phase 21: the promotion explorer');
const { DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const OTHER = (await call('meta.get', {})).data.facilitators.find((n) => n !== FAC);
const join = async (phone, name, facilitator, batchId) => {
  await call('auth.signUp', { phone, name, batchId, facilitator, ...CONTACT, groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000164', 'Arjun Das', FAC, 'SPS2');
await join('6000000165', 'Bhima Das', FAC, 'BSS');
await join('6000000166', 'Chandra Das', FAC, 'TRD');           // temple residents move nobody up: never listed
await join('6000000167', 'Other Student', OTHER, 'SPS2');      // another facilitator's
await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
const F = (await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' })).data.token;
t.code(await call('phases.open', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M), 'ok', 'the head opens the phase');

const submit = (login, week, overall, rounds, night, pr) => DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at,
    submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall,
    seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES ('${login}-${week}', '${login}', 'x', 'SPS2', '${week}', '2026-10-01T19:00:00+05:30', '${login}', 'rq-${login}-${week}', 'r3',
    80, 80, 80, 80, 80, 80, 100, 100, 80, 80, ${overall}, 300, '${rounds}', '${night}', '${pr}', 210, 140, '[]', '{}')`);
// Arjun: three closed weeks; the latest one is weaker
submit('6000000164', '2026-09-14', 90, 16, 'YES', 'YES');
submit('6000000164', '2026-09-21', 90, 16, 'YES', 'YES');
submit('6000000164', '2026-09-28', 60, 8, 'NO', 'YES');
at('2026-10-07T10:00:00');   // the week of 28 Sep is the last closed one (its Monday 9 PM deadline has passed)

/* the periods */
{
  const phase = { starts_on: '2026-09-01' };
  t.eq(periodWeeks({}, '2026-09-28', phase), { period: 'phase', first: '2026-08-31', last: '2026-09-28' }, 'by default, the phase so far (from the week its first day is in)');
  t.eq(periodWeeks({ period: 'week' }, '2026-09-28', phase), { period: 'week', first: '2026-09-28', last: '2026-09-28' }, 'last week: the last closed week');
  t.eq(periodWeeks({ period: 'month' }, '2026-09-28', phase).first, '2026-09-07', 'last month: the last four closed weeks');
  t.eq(periodWeeks({ period: 'year' }, '2026-09-28', phase).first, '2025-10-06', 'last year: the last 52');
  t.eq(periodWeeks({ period: 'custom', from: '2026-09-15', to: '2026-12-31' }, '2026-09-28', phase), { period: 'custom', first: '2026-09-14', last: '2026-09-28' }, 'custom: Mondays, never past the last closed week');
}

/* who may ask, and who is listed */
t.code(await call('fac.eligible', {}, A), 'FORBIDDEN', 'a devotee with no students is refused');
let r = await call('fac.eligible', {}, F);
t.eq([r.ok, r.data?.period, r.data?.from, r.data?.to], [true, 'phase', '2026-08-31', '2026-09-28'], 'a facilitator gets the phase so far by default');
t.eq(r.data.students.map((s) => s.name), ['Arjun Das', 'Bhima Das'], 'their students on the ladder, from any batch — not a temple resident, not another facilitator\'s');
const arjun = r.data.students.find((s) => s.name === 'Arjun Das');
t.eq([arjun.level, arjun.next, arjun.rule], ['SPS', ['DPS', 'BVS'], { sad: 80, night: 0.8, cls: 80, chant: 8, pr: 'YES' }], 'each with their level, where they can move, and their batch\'s rule');
t.eq([arjun.figures.weeks, arjun.figures.sad, arjun.figures.chant, arjun.figures.night, arjun.figures.pr], [3, 80, 13.3, 2 / 3, 'YES'], 'and every figure over the period');
t.eq(r.data.students.find((s) => s.name === 'Bhima Das').figures.weeks, 0, 'a student who submitted nothing has no figures (weeks 0, nulls)');
t.ok(!!r.data.labels.chant && !!r.data.labels.pr, 'with the criteria\'s names');
// only an IYF ID is ever shown (migration 0056): an old KT number on the account is withheld, an IYFD one shown
DB.sql.exec("UPDATE accounts SET iyf_id = 'KT26-0042' WHERE login = '6000000164'");
DB.sql.exec("UPDATE accounts SET iyf_id = 'IYFD-2024-0007' WHERE login = '6000000165'");
r = await call('fac.eligible', {}, F);
t.eq(r.data.students.map((s) => s.iyfId), ['', 'IYFD-2024-0007'], 'an old KT number is never shown; an IYFD one is');

/* another period changes the figures */
r = await call('fac.eligible', { period: 'week' }, F);
t.eq(r.data.students.find((s) => s.name === 'Arjun Das').figures.sad, 60, 'last week alone: the weaker week');
// a batch's own rule wins over the standard one
DB.sql.exec("INSERT INTO promotion_criteria (batch_id, criterion, min_value, set_by, set_at) VALUES ('SPS2', 'sad', '60', 'test', '2026-09-01')");
r = await call('fac.eligible', { period: 'week' }, F);
t.eq(r.data.students.find((s) => s.name === 'Arjun Das').rule, { sad: 60 }, 'a batch with its own criteria is judged by them');
t.code(await call('fac.eligible', { period: 'custom', from: '2026-01-01', to: '2027-03-01' }, F), 'VALIDATION', 'a custom period is at most 400 days');
t.code(await call('fac.eligible', { period: 'decade' }, F), 'VALIDATION', 'an unknown period is refused');

t.done();
