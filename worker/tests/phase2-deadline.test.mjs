// Audit phase 2.4 (13 Oct 2026): the Monday deadline job must survive a devotee with two overlapping memberships.
//
// The `pending` query joined memberships without grouping by login, so such a devotee appeared twice and the run
// tried to insert the same submission_id twice. The whole db.batch is atomic, so the UNIQUE constraint rolled back
// EVERY person in that run — and it happened again the next minute, for ever, until someone fixed the data by hand.
// Nobody's week would close. boardRows() already dedupes exactly this case (coord.js: "two memberships touching
// the same week: the first (by name) wins"), which is what proves the overlap is expected to occur.
import { boot, suite } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';

const t = suite('phase 2: the deadline job with overlapping memberships');
const { env, DB, clock, rows } = boot();

// The harness clock is Monday 2026-10-05 10:00 IST. Last week (2026-09-28) closes at Monday 21:00, which has NOT
// happened yet, so the week the job is working on is the one before: 2026-09-21 (weeks.js runDeadline → `due`).
const DUE = '2026-09-21';
DB.sql.exec(`UPDATE settings SET value = '2026-09-01' WHERE key = 'tracking_from'`);

const colsOf = (tb) => DB.sql.prepare(`PRAGMA table_info(${tb})`).all();
const put = (tb, given) => {
  const cols = colsOf(tb).filter(c => c.name !== 'id' && (c.name in given || (c.notnull && c.dflt_value === null)));
  DB.sql.prepare(`INSERT INTO ${tb} (${cols.map(c => '"' + c.name + '"').join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map(c => (c.name in given ? given[c.name] : (/INT|REAL|NUM/i.test(c.type) ? 0 : ''))));
};

// three ordinary devotees, one of them with a complete day so it auto-submits
const mk = (login, batch) => put('accounts', { login, role: 'DEVOTEE', status: 'ACTIVE', name: 'Devotee ' + login.slice(-2),
  pw_hash: 'h', pw_salt: 's', pw_iterations: 1000, must_change_pw: 0, requested_batch: batch });
// a COMPLETE day: every field in weeks.js REQUIRED, and zero hearing/reading minutes so no topic or book is
// needed (missingOf asks for those only when the minutes are above zero)
const day = JSON.stringify({ v: 1, sleptAt: '21:30', wokeAt: '04:30', rounds: 16, chantingDoneAt: '09:00',
  chantingSameDay: true, dayRestMin: 0, hearingMin: 0, readingMin: 0, serviceMin: 0 });

mk('6000000010', 'SPS'); put('memberships', { login: '6000000010', batch_id: 'SPS', from_week: '2026-09-01', to_week: '', state: 'ACTIVE' });
put('drafts', { login: '6000000010', week_id: DUE, batch_id: 'SPS', d1: day, created_at: 'x', updated_at: 'x', updated_by: '6000000010' });

mk('6000000022', 'SPS'); put('memberships', { login: '6000000022', batch_id: 'SPS', from_week: '2026-09-01', to_week: '', state: 'ACTIVE' });

// THE CASE: one devotee, two ACTIVE memberships that both cover the due week (moved between batches without the
// old row being closed — nothing in the schema prevents it, and requests.approve does not close one).
mk('6000000023', 'SPS');
put('memberships', { login: '6000000023', batch_id: 'SPS', from_week: '2026-09-01', to_week: '', state: 'ACTIVE' });
put('memberships', { login: '6000000023', batch_id: 'SPS2', from_week: '2026-09-14', to_week: '', state: 'ACTIVE' });
put('drafts', { login: '6000000023', week_id: DUE, batch_id: 'SPS2', d1: day, created_at: 'x', updated_at: 'x', updated_by: '6000000023' });

const report = await runDeadline(env, DB, new Date(clock.now));
t.ok(typeof report === 'string' && !/error/i.test(report), 'the run finishes instead of throwing: ' + report);

// everyone is handled exactly once
const subs = rows(`SELECT login, COUNT(*) AS n FROM submissions WHERE week_id = ? GROUP BY login`, DUE);
const missed = rows(`SELECT login, COUNT(*) AS n FROM missed_weeks WHERE week_id = ? GROUP BY login`, DUE);
t.ok(subs.every(r => r.n === 1), 'no devotee gets two submissions for the same week');
t.ok(missed.every(r => r.n === 1), 'no devotee gets two missed rows for the same week');
const handled = new Set([...subs, ...missed].map(r => r.login));
for (const l of ['6000000010', '6000000022', '6000000023']) t.ok(handled.has(l), `${l} was handled`);
t.eq(subs.find(r => r.login === '6000000010')?.n, 1, 'the devotee with a complete day is submitted');
t.eq(missed.find(r => r.login === '6000000022')?.n, 1, 'the devotee with nothing filled is marked missed');
t.eq(subs.find(r => r.login === '6000000023')?.n, 1, 'the devotee with two memberships is submitted once, not twice');

// and the run reaches its end state: nothing pending, so the week closes
const again = await runDeadline(env, DB, new Date(clock.now));
t.ok(/closed|up to date/.test(again), 'the next run closes the week rather than failing: ' + again);
t.eq(rows(`SELECT COUNT(*) AS n FROM submissions WHERE week_id = ?`, DUE)[0].n, subs.length, 'a second run writes no duplicates');

t.done();
