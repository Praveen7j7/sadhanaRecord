// The sadhana leaderboard (ADR 0013, the head, 22 Oct 2026). Staff rank a batch weekly, monthly, yearly or over
// custom dates; the head any batch or all of IYF; a devotee sees only their own place. It ranks the week's score as the
// weekly board shows it, counts a missed week as 0, shares a place on a tie, and — the wiring rule — takes the week
// from settings.submit_closes, so moving the deadline in Settings moves the board.
import { boot, suite } from './harness.mjs';
import { rank } from '../src/leaderboard.js';

const t = suite('leaderboard: ranked by the weekly score, windows by role, the week from the settings');
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-12T22:00:00');          // Monday night: last week's deadline (Mon 21:00) has just passed

/* ── pure: ties share a place ── */
t.eq(rank([{ login: 'a', name: 'A', batch_id: 'X', weeks: 1, missed: 0, total: 90 }, { login: 'b', name: 'B', batch_id: 'X', weeks: 1, missed: 0, total: 70 },
           { login: 'c', name: 'C', batch_id: 'X', weeks: 1, missed: 0, total: 70 }, { login: 'd', name: 'D', batch_id: 'X', weeks: 1, missed: 0, total: 50 }])
  .map(r => [r.name, r.rank]), [['A', 1], ['B', 2], ['C', 2], ['D', 4]], 'equal scores share a place: two 2nds, then 4th');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'spslb', name: 'Sps Board', batchIds: ['SPS'], tempPassword: 'Temp-spslb-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spslb'");
const C = (await call('auth.login', { login: 'spslb', password: 'Temp-spslb-2026' })).data.token;

const person = (login, name, batch = 'SPS') => {
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
    VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('${login}', '${batch}', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);
};
const sub = (login, week, overall, { batch = 'SPS', body = 80, soul = 80, seva = 80, att = 100 } = {}) => DB.sql.exec(`INSERT INTO submissions
    (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan,
     seva, attendance, body, soul, overall, seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES ('${login}-${week}', '${login}', 'x', '${batch}', '${week}', '2026-10-01T19:00:00+05:30', '${login}', 'rq-${login}-${week}', 'r1',
    80, 80, 80, 80, 80, 80, ${seva}, ${att}, ${body}, ${soul}, ${overall}, 300, '8', 'YES', 'YES', 210, 140, '[]', '{}')`);
const missed = (login, week, batch = 'SPS') => DB.sql.exec(`INSERT INTO missed_weeks (login, week_id, batch_id, days_filled, at) VALUES ('${login}', '${week}', '${batch}', 0, '2026-10-05T21:00:00+05:30')`);

person('6000000191', 'Arun Lal'); person('6000000192', 'Bina Rao'); person('6000000193', 'Chetan Joshi'); person('6000000194', 'Dev Mehra', 'DPS');
sub('6000000191', '2026-10-05', 90); sub('6000000191', '2026-09-28', 80);
sub('6000000192', '2026-10-05', 85, { body: 80, soul: 80, seva: 80, att: 100 }); sub('6000000192', '2026-09-28', 70);
missed('6000000193', '2026-10-05'); sub('6000000193', '2026-09-28', 60);
sub('6000000194', '2026-10-05', 99, { batch: 'DPS' });
sub('6000000191', '2026-10-12', 100);        // this week: still open, never ranked

/* ── the week: the last CLOSED one by default ── */
let r = await call('leaderboard.get', { batchId: 'SPS' }, C);
t.code(r, 'ok', "the batch's coordinator ranks their batch");
t.eq([r.data.period, r.data.from, r.data.to], ['week', '2026-10-05', '2026-10-05'], 'by default the last closed week (5 Oct), not the one still open');
t.eq(r.data.rows.map(x => [x.name, x.score, x.rank]), [['Arun Lal', 90, 1], ['Bina Rao', 85, 2], ['Chetan Joshi', 0, 3]],
  'highest first; a missed week is 0, and is ranked, not left out');
t.eq(r.data.rows.find(x => x.name === 'Chetan Joshi').missed, 1, 'the missed week is said as such');
t.code(await call('leaderboard.get', { batchId: 'SPS', weekId: '2026-10-12' }, C), 'VALIDATION', 'a week still open is not ranked');

/* ── the score is the board's: an attendance mark that differs re-works it ── */
DB.sql.exec("INSERT INTO attendance (login, week_id, batch_id, coordinator_mark, mark_used) VALUES ('6000000192', '2026-10-05', 'SPS', 'A', 'A')");
r = await call('leaderboard.get', { batchId: 'SPS' }, C);
t.eq(r.data.rows.find(x => x.name === 'Bina Rao').score, 60, "marked absent by the coordinator: (80 + 80 + 0 + 80) / 4 = 60, as the weekly board scores it");

/* ── ties share a place ── */
person('6000000195', 'Esha Nair'); sub('6000000195', '2026-10-05', 60);
r = await call('leaderboard.get', { batchId: 'SPS' }, C);
t.eq(r.data.rows.map(x => [x.name, x.rank]), [['Arun Lal', 1], ['Bina Rao', 2], ['Esha Nair', 2], ['Chetan Joshi', 4]], 'two 2nds on 60, then 4th');

/* ── month, year, custom ── */
r = await call('leaderboard.get', { batchId: 'SPS', period: 'month', month: '2026-09' }, C);
t.eq(r.data.rows.map(x => [x.name, x.score]), [['Arun Lal', 80], ['Bina Rao', 70], ['Chetan Joshi', 60]], 'September: the week of 28 Sep');
r = await call('leaderboard.get', { batchId: 'SPS', period: 'custom', from: '2026-09-01', to: '2026-10-31' }, C);
t.eq(r.data.rows.map(x => [x.name, x.score, x.weeks]), [['Arun Lal', 85, 2], ['Bina Rao', 65, 2], ['Esha Nair', 60, 1], ['Chetan Joshi', 30, 2]],
  'a range is the average of its weeks (and 12 Oct, still open, is not one of them)');
t.eq(r.data.to, '2026-10-05', 'a range never reaches past the last closed week');
r = await call('leaderboard.get', { batchId: 'SPS', period: 'year', year: '2026' }, C);
t.eq(r.data.rows[0].name, 'Arun Lal', 'the year');
t.code(await call('leaderboard.get', { batchId: 'SPS', period: 'custom', from: '2026-01-01', to: '2026-10-31' }, C), 'VALIDATION',
  'a custom range is bounded, as exports are (6 months)');
t.code(await call('leaderboard.get', { batchId: 'SPS', period: 'day' }, C), 'VALIDATION', 'there is no daily board (the head dropped it)');

/* ── who sees what ── */
t.code(await call('leaderboard.get', { batchId: 'DPS' }, C), 'FORBIDDEN', "a coordinator does not rank another coordinator's batch");
// "All batches" (Phase 22 F2): a coordinator ranks every class batch THEY hold together — never another's, never a training
r = await call('leaderboard.get', {}, C);
t.code(r, 'ok', "a coordinator's All batches answers");
t.eq([...new Set(r.data.rows.map(x => x.batchId))], ['SPS'], 'and holds only their own batch (no DPS row)');
t.ok(!r.data.rows.some(x => x.name === 'Dev Mehra'), "the DPS devotee is not on an SPS coordinator's board");
t.code(await call('batches.create', { batchId: 'ETP-81', name: 'ETP Batch 81', level: 'ETP', startedOn: '2026-10-05', endsOn: '2027-06-30' }, M), 'ok', 'a training exists');
await call('coordinators.create', { username: 'twolb', name: 'Two Boards', batchIds: ['SPS', 'DPS', 'ETP-81'], tempPassword: 'Temp-twolb-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'twolb'");
const C2 = (await call('auth.login', { login: 'twolb', password: 'Temp-twolb-2026' })).data.token;
r = await call('leaderboard.get', {}, C2);
t.code(r, 'ok', 'a coordinator of SPS and DPS asks for all their batches');
t.eq(r.data.rows.map(x => [x.name, x.batchId, x.rank]), [['Dev Mehra', 'DPS', 1], ['Arun Lal', 'SPS', 2], ['Bina Rao', 'SPS', 3], ['Esha Nair', 'SPS', 3], ['Chetan Joshi', 'SPS', 5]],
  'one ranking across SPS and DPS, each row with its batch');
t.eq(r.data.batchId, '', 'the reply names no single batch');
await call('coordinators.create', { username: 'etplb', name: 'Etp Board', batchIds: ['ETP-81'], tempPassword: 'Temp-etplb-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etplb'");
const CT = (await call('auth.login', { login: 'etplb', password: 'Temp-etplb-2026' })).data.token;
t.code(await call('leaderboard.get', {}, CT), 'FORBIDDEN', 'a training-only coordinator has no class leaderboard (trainings are ranked in their own batch)');
r = await call('leaderboard.get', {}, M);
t.code(r, 'ok', 'the head ranks all of IYF Delhi');
t.eq(r.data.rows[0].name, 'Dev Mehra', 'across batches: the DPS 99 comes first');
t.eq(r.data.rows[0].batchId, 'DPS', 'each row says its batch');
DB.sql.exec("UPDATE submissions SET login = 'deleted-ab12' WHERE login = '6000000194'");
DB.sql.exec("INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by) VALUES ('deleted-ab12', 'DEVOTEE', 'INACTIVE', 'Deleted devotee', '', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')");
r = await call('leaderboard.get', {}, M);
t.ok(!r.data.rows.some(x => x.login.startsWith('deleted-')), 'a deleted account is not ranked (its weeks stay in the batch totals)');

/* ── a devotee: their own place, nobody else's ── */
DB.sql.exec("UPDATE accounts SET pw_hash = (SELECT pw_hash FROM accounts WHERE login = 'master'), pw_salt = (SELECT pw_salt FROM accounts WHERE login = 'master'), pw_iterations = (SELECT pw_iterations FROM accounts WHERE login = 'master') WHERE login = '6000000195'");
const E = (await call('auth.login', { login: '6000000195', password: 'Master pass 2026' })).data.token;
const mine = await call('leaderboard.mine', {}, E);
t.code(mine, 'ok', 'a devotee asks for their own place');
t.eq([mine.data.weekId, mine.data.rank, mine.data.of, mine.data.score], ['2026-10-05', 2, 4, 60], '2nd of 4 in SPS for the week of 5 Oct');
t.eq(Object.keys(mine.data).sort(), ['batchId', 'of', 'rank', 'score', 'weekId'], 'and nothing about anybody else');
t.code(await call('leaderboard.get', { batchId: 'SPS' }, E), 'FORBIDDEN', 'the ranked list is staff-only');

/* ── the wiring rule: the week is whatever Settings says ── */
// move the deadline to Tuesday 9 PM: on Monday night the week of 5 Oct is still open, so the board goes back to 28 Sep
t.code(await call('settings.update', { submitWindow: { opens: 'SUN 18:00', closes: 'TUE 21:00' } }, M), 'ok', 'the head moves the deadline');
r = await call('leaderboard.get', { batchId: 'SPS' }, C);
t.eq(r.data.from, '2026-09-28', 'and the board follows at once: last closed week is now 28 Sep, with no code change');
t.eq((await call('leaderboard.mine', {}, E)).data.weekId, '2026-09-28', "as does a devotee's own place");
at('2026-10-13T21:01:00');
t.eq((await call('leaderboard.get', { batchId: 'SPS' }, C)).data.from, '2026-10-05', 'Tuesday past 9 PM: 5 Oct closes');

t.done();
