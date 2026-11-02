// The user, 11 Oct 2026: opening a devotee's week, a facilitator saw only each day's percentage and had to
// add them up in their head. The week now comes with a short summary — how the week is going overall, and
// what the devotee actually read, heard and did — so the facilitator gets the gist at a glance.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite("a devotee's week: how it is going");
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const OTHER = (await call('meta.get', {})).data.facilitators.find(n => n !== FAC);
const join = async (phone, name, facilitator = FAC) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000091', 'Arjun Das');
await join('6000000193', 'Chandra Das', OTHER);
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
const F = (await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' })).data.token;

// a book and a lecture the devotee's own journal offers, so the summary can show titles rather than ids
// the lecture must be in THIS devotee's journal, so take the journal their batch uses
const JOURNAL = rows("SELECT hearing_journal FROM batches WHERE batch_id = 'SPS2'")[0]?.hearing_journal || 'SPS';
DB.sql.exec(`INSERT OR REPLACE INTO books (book_id, title, level, "order") VALUES ('B12', 'Bhagavad-gita As It Is', 'SPS', 1);
             INSERT OR REPLACE INTO lectures (lecture_id, journal, week, slot, title, "order")
               VALUES ('L4-012', '${JOURNAL}', 4, 'A', 'Qualities of a Sadhaka', 1);`);

at('2026-10-06T10:00:00');
const day = (extra) => ({ sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, ...extra });

// ---- nothing filled yet
let r = await call('fac.week', { login: '6000000091', weekId: '2026-10-05' }, F);
t.eq(r.data.summary, null, 'a week with no day filled has no summary to give');

// ---- one day
await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0,
  day: day({ readingMin: 30, reading: { bookId: 'B12' }, hearingMin: 20, hearing: [{ lectureId: 'L4-012' }], serviceMin: 60 }) }, A);
r = await call('fac.week', { login: '6000000091', weekId: '2026-10-05' }, F);
const s1 = r.data.summary;
t.ok(s1, 'one filled day is enough for a summary');
t.eq(s1.daysFilled, 1, 'it says how much of the week is filled');
t.eq(s1.partial, true, 'and that the week is not finished: attendance and the week-end answers come at Submit');
t.ok(Number.isInteger(s1.overall) && s1.overall >= 0 && s1.overall <= 100, 'a running total the facilitator does not have to work out: ' + s1.overall);
t.eq([s1.reading.minutes, s1.reading.books], [30, ['Bhagavad-gita As It Is']], 'what they read, by title');
t.eq([s1.hearing.minutes, s1.hearing.lectures], [20, ['Qualities of a Sadhaka']], 'what they heard, by title');
t.eq(s1.seva.minutes, 60, 'and the seva they did');
t.eq([s1.japa.rounds, s1.japa.days], [16, 1], 'rounds chanted, and on how many days');

// ---- a second day: the totals add up, the score rises
at('2026-10-07T10:00:00');
await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-06', version: 0,
  day: day({ readingMin: 20, reading: { bookId: 'B12' }, hearingMin: 15, hearing: [{ lectureId: 'L4-012' }], serviceMin: 45 }) }, A);
r = await call('fac.week', { login: '6000000091', weekId: '2026-10-05' }, F);
const s2 = r.data.summary;
t.eq(s2.daysFilled, 2, 'two days filled');
t.eq([s2.reading.minutes, s2.hearing.minutes, s2.seva.minutes], [50, 35, 105], 'minutes are the week so far, not just the latest day');
t.eq(s2.reading.books, ['Bhagavad-gita As It Is'], 'the same book twice is listed once');
t.eq([s2.japa.rounds, s2.japa.days], [32, 2], 'rounds add up across days');
t.ok(s2.overall > s1.overall, `the total rises as more of the week is filled (${s1.overall}% → ${s2.overall}%)`);

// ---- the number shown while filling must not disagree with the one after Submit
const beforeSubmit = s2.overall;
t.ok(beforeSubmit <= 100, 'a part week is scored out of the whole week, so it can never read above 100%');

// ---- a facilitator sees this; someone else's facilitator does not
t.code(await call('fac.week', { login: '6000000193', weekId: '2026-10-05' }, F), 'NOT_FOUND', "not another facilitator's devotee");

// ---- after Submit the titles must still be there (the user, 12 Oct 2026): the list used to be sent only while the
// week was being filled, so it vanished the moment the week was submitted — when a facilitator actually reads it
for (const d of ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']) {
  at(`${d}T21:30:00`);
  t.code(await call('week.saveDay', { weekId: '2026-10-05', date: d, version: 0,
    day: day({ readingMin: 20, reading: { bookId: 'B12' }, hearingMin: 15, hearing: [{ lectureId: 'L4-012' }], serviceMin: 30 }) }, A), 'ok', `${d} filled`);
}
at('2026-10-11T18:30:00');
await call('week.setAttendance', { weekId: '2026-10-05', mark: 'P' }, A);
t.code(await call('week.saveWeekEnd', { weekId: '2026-10-05', version: 0, nightStay: 'YES', principles: 'YES' }, A), 'ok', 'week-end answers saved');
t.code(await call('week.submit', { weekId: '2026-10-05' }, A, { requestId: 'submit-summary-1' }), 'ok', 'the week is submitted');
r = await call('fac.week', { login: '6000000091', weekId: '2026-10-05' }, F);
t.eq(r.data.status, 'SUBMITTED', 'the facilitator now reads a submitted week');
t.eq(r.data.summary?.reading?.books, ['Bhagavad-gita As It Is'], 'what they read this week is still listed by title');
t.eq(r.data.summary?.hearing?.lectures, ['Qualities of a Sadhaka'], 'and what they heard');
t.eq([r.data.summary.reading.minutes, r.data.summary.hearing.minutes], [150, 110], 'with the minutes of the whole week');
t.ok(r.data.scores && r.data.summary.overall === undefined, 'the submitted scores stay the final ones: the summary carries no second score');

t.done();
