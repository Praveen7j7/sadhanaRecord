// Phase 22 F3 (26 Oct 2026). The head: "Praveen last filled last month, yet the overview shows '1 of 7 filled' under
// 'This week'". On live the count was right — his draft of the week of 19 Oct holds Monday 19 Oct — and the board was
// showing the FOCUS week, which is last week until Monday's 9 PM deadline, under a column that said "This week".
// The screen now names the week (frontend lib/staff.js weekTitle). This suite pins the server side: a board and the
// head's overview count the shown week's days and submissions only — never an earlier week's — and the focus week
// moves to this week at the deadline.
import { boot, suite } from './harness.mjs';

const t = suite("F3: a week's board counts that week only; the focus week is last week until the deadline");
const { DB, call, clock, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

const DAY = '{"v":1,"sleptAt":"22:00","wokeAt":"04:30","dayRestMin":30,"rounds":16,"chantingDoneAt":"07:00","chantingSameDay":true,"hearingMin":0,"readingMin":0,"serviceMin":0,"chetnaPositive":["Compassionate"]}';
const person = (login, name, batch = 'SPS') => {
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
    VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('${login}', '${batch}', 'ACTIVE', '2026-09-28', 'test', '2026-09-01')`);
};
const draft = (login, week, days, batch = 'SPS') => DB.sql.exec(`INSERT INTO drafts (login, week_id, batch_id, ${days.map((_, i) => 'd' + (i + 1)).join(', ')}, created_at, updated_at, updated_by)
    VALUES ('${login}', '${week}', '${batch}', ${days.map(d => (d ? `'${d}'` : 'NULL')).join(', ')}, '2026-10-01T09:00:00+05:30', '2026-10-01T09:00:00+05:30', '${login}')`);

// Praveen's live shape: a part week in September (1 day), and Monday of the week of 19 Oct filled on 20 Oct
person('6000000181', 'Pra Test'); person('6000000182', 'Ravi Test');
draft('6000000181', '2026-09-28', [DAY, DAY, DAY, DAY, DAY]);          // five days, a month back
draft('6000000181', '2026-10-19', [DAY]);                               // Monday 19 Oct only
draft('6000000182', '2026-10-12', [DAY, DAY, DAY]);                     // the week BEFORE the one shown

/* ── Monday 26 Oct, 11:00: last week's deadline (Mon 9 PM) has not passed, so the board shows the week of 19 Oct ── */
at('2026-10-26T11:00:00');
let r = await call('devotees.list', { batchId: 'SPS' }, M);
t.code(r, 'ok', 'the head opens SPS');
t.eq(r.data.weekId, '2026-10-19', 'the focus week is LAST week until its Monday deadline');
const pra = r.data.rows.find(x => x.login === '6000000181'), ravi = r.data.rows.find(x => x.login === '6000000182');
t.eq([pra.status, pra.daysFilled], ['DRAFT', 1], "1 of 7 is that week's own draft (Monday 19 Oct), not September's five days");
t.eq(pra.days, ['complete', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'], 'only Monday is complete');
t.eq([ravi.status, ravi.daysFilled], ['NOT_STARTED', 0], "a draft of an EARLIER week counts nothing in this one");

const all = await call('stats.all', {}, M);
const sps = all.data.batches.find(b => b.batchId === 'SPS');
t.eq([sps.weekId, sps.thisWeek.expected, sps.thisWeek.submitted, sps.thisWeek.draft, sps.thisWeek.notStarted], ['2026-10-19', 2, 0, 1, 1],
  "the head's overview counts the same week: 1 filling, 1 not started, none submitted");

/* ── Monday 26 Oct, 21:01: the deadline has passed, the board moves on to this week ── */
at('2026-10-26T21:01:00');
r = await call('devotees.list', { batchId: 'SPS' }, M);
t.eq(r.data.weekId, '2026-10-26', 'after the deadline the focus week is this week');
const pra2 = r.data.rows.find(x => x.login === '6000000181');
t.eq([pra2.status, pra2.daysFilled], ['NOT_STARTED', 0], 'and nothing of last week is carried into it');

/* ── an explicit week asks for exactly that week ── */
r = await call('devotees.list', { batchId: 'SPS', weekId: '2026-09-28' }, M);
t.eq(r.data.rows.find(x => x.login === '6000000181').daysFilled, 5, 'the September week shows its own five days');

t.done();
