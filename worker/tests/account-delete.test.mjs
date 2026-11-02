// A devotee deletes their own account (store rules; the head's decisions, 5 Oct 2026): password + the word DELETE;
// staff and facilitators cannot; afterwards no table and no Sheets tab holds their name, phone or IYF ID, their
// submitted weeks still count in the batch's numbers (under a pseudonym), and the phone can sign up again from nothing.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { mirrorChanged, MIRRORS } from '../src/mirror.js';
import { eraseSheets } from '../src/erase.js';
import { refreshOneView } from '../src/views.js';
import { runDeadline } from '../src/weeks.js';
import FILES from '../../setup/files.json' with { type: 'json' };

const t = suite('account deletion: nothing of the person left, the batch numbers unchanged');
const { env, DB, call, clock, rows, addAccount, google } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, name, emergencyPhone = '6000000035') => {
  await call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator: FAC, ...CONTACT, groupLeader: LEAD.SPS2, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: emergencyPhone }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const PHONE = '6000000141', NAME = 'Zorawar Vrajesh Das', IYF = 'GP26-0941', FIRST = 'Zorawar';
let D = await join(PHONE, NAME);
const K = await join('6000000142', 'Keshava Kumar', PHONE);          // his emergency contact is the deleted person's phone
DB.sql.exec(`UPDATE accounts SET iyf_id = '${IYF}' WHERE login = '${PHONE}'`);
DB.sql.exec(`UPDATE memberships SET iyf_id = '${IYF}' WHERE login = '${PHONE}'`);
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
// he leads a group with Keshava in it (decision 41): the moves name him in the audit log
t.code(await call('leaders.set', { login: PHONE, leader: true, reason: 'Steady sadhana' }, C), 'ok', 'he is made a group leader');
t.code(await call('leaders.assign', { leader: PHONE, logins: ['6000000142'] }, C), 'ok', 'with Keshava in his group');

// ---- a week each: Damodar and Keshava submit; the master later marks Damodar absent with a reason that names him
const W = '2026-10-05', dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
for (const date of dates) {
  at(`${date}T21:30:00`);
  for (const tok of [D, K]) await call('week.saveDay', { weekId: W, date, version: 0, day }, tok);
}
at('2026-10-11T18:30:00');
for (const tok of [D, K]) {
  await call('week.setAttendance', { weekId: W, mark: 'P' }, tok);
  await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES' }, tok);
  t.code(await call('week.submit', { weekId: W }, tok), 'ok', 'a week submitted');
}
// a post with Damodar's like and comment
const ann = (await call('announcements.create', { title: 'Kirtan on Sunday', body: 'All welcome', audience: 'ALL' }, M)).data;
await call('announcements.like', { id: ann.id, like: true }, D);
await call('announcements.comment', { id: ann.id, body: 'Hare Krishna, I will come' }, D);
DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES ('https://push.example/abc', '${PHONE}', 'k', 'a', '2026-10-11')`);
// next week: begun, not submitted (a draft); after the deadline the master overrides last week's attendance
at('2026-10-13T08:00:00');
await call('week.saveDay', { weekId: '2026-10-12', date: '2026-10-12', version: 0, day: { sleptAt: '22:00' } }, D);
at('2026-10-13T10:00:00');
await runDeadline(env, DB);
t.code(await call('attendance.override', { login: PHONE, weekId: W, mark: 'A', reason: 'Zorawar told us he was unwell' }, M), 'ok', 'an attendance override with a reason');

// ---- the Sheets copies, as Google holds them (a model built from the writes), and the batch view sheets
const byId = Object.fromEntries(Object.entries(FILES).filter(([k]) => k !== 'owner').map(([k, v]) => [v, k]));
const sheets = {};
function apply(w) {
  const m = /spreadsheets\/([^/:?]+)/.exec(w.url); if (!m) return;
  const file = byId[m[1]]; if (!file) return;
  const tabs = (sheets[file] ||= {});
  const cell = (r) => { const x = /^'([^']+)'!A(\d+)(?::ZZ(\d*))?$/.exec(r); return { tab: x[1], from: +x[2], to: x[3] === undefined ? null : x[3] === '' ? Infinity : +x[3] }; };
  if (w.url.includes('values:batchUpdate')) for (const d of w.body.data) { const c = cell(d.range), tab = (tabs[c.tab] ||= []); d.values.forEach((v, i) => (tab[c.from + i] = v)); }
  else if (w.url.includes('values:batchClear')) for (const r of w.body.ranges) { const c = cell(r), tab = (tabs[c.tab] ||= []); for (let i = c.from; i < tab.length && i <= c.to; i++) tab[i] = undefined; }
  else if (w.url.includes(':append')) { const name = /'([^']+)'/.exec(decodeURIComponent(w.url))[1], tab = (tabs[name] ||= []); let p = Math.max(2, tab.length); w.body.values.forEach(v => (tab[p++] = v)); }
}
google.state.read = (u, range) => {
  const file = byId[/spreadsheets\/([^/:?]+)/.exec(u)[1]], x = /^'([^']+)'!A(\d+):([A-Z]+)(\d+)$/.exec(range);
  const tab = sheets[file]?.[x[1]] || [], width = [...x[3]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const out = [];
  for (let r = +x[2]; r <= +x[4]; r++) out.push((tab[r] || []).slice(0, width));
  return out;
};
let seen = 0;
const settle = async () => {
  for (let i = 0; i < 200; i++) {
    let did = (await mirrorChanged(env, DB, 300)).length;
    if (!did) did = (await eraseSheets(env, DB)) ? 1 : 0;
    if (!did) did = (await refreshOneView(env, DB, new Date(clock.now))) ? 1 : 0;
    for (; seen < google.writes.length; seen++) apply(google.writes[seen]);
    if (!did) return i;
  }
  return -1;
};
t.ok((await settle()) >= 0, 'the copies settle');
const sheetCells = () => [...Object.values(sheets).flatMap(tabs => Object.values(tabs).flat(2)),
  ...Object.values(FILES).flatMap(id => ['This week', 'Scores', 'Days', 'Week-end'].flatMap(tab => (google.state.tab(id, tab)?.rows || []).flat()))].map(x => String(x ?? ''));
const has = (cells, s) => cells.filter(x => x.includes(s)).length;
t.ok(has(sheetCells(), NAME) > 3 && has(sheetCells(), PHONE) > 3, 'before: the sheets hold his name and phone (Submissions, AuditLog, views …)');
const stats = async () => (await call('stats.batch', { batchId: 'SPS2' }, C)).data;
const before = await stats();
const subsBefore = rows('SELECT COUNT(*) AS n FROM submissions')[0].n;

// ---- who may, and the checks
t.code(await call('account.delete', { password: 'wrong password', confirm: 'DELETE' }, D), 'BAD_CREDENTIALS', 'a wrong password is refused');
t.code(await call('account.delete', { password: 'Devotee pass 2026', confirm: 'yes' }, D), 'VALIDATION', 'without the word DELETE: refused');
t.eq((await call('account.delete', { password: 'Devotee pass 2026' }, D)).error.fields?.[0]?.path, 'confirm', 'and the confirm field is named');
t.code(await call('account.delete', { password: 'Temp-sps-2026', confirm: 'DELETE' }, C), 'FORBIDDEN', 'a coordinator cannot delete their account here');
t.code(await call('account.delete', { password: 'Master pass 2026', confirm: 'DELETE' }, M), 'FORBIDDEN', 'nor the IYF head');
t.eq(rows(`SELECT COUNT(*) AS n FROM accounts WHERE login = '${PHONE}'`)[0].n, 1, 'nothing deleted so far');

// ---- the deletion
t.code(await call('account.delete', { password: 'Devotee pass 2026', confirm: ' delete ' }, D), 'ok', 'password + DELETE (any case): deleted');
t.code(await call('auth.me', {}, D), 'UNAUTHENTICATED', 'the session ended with it');
t.code(await call('auth.login', { login: PHONE, password: 'Devotee pass 2026' }), 'BAD_CREDENTIALS', 'the phone can no longer sign in');
const P = rows("SELECT login FROM submissions WHERE login LIKE 'deleted-%'")[0]?.login || '';
t.ok(/^deleted-[0-9a-f]{12}$/.test(P), 'his submitted week is kept under a random pseudonym (' + P + ')');
t.eq(rows(`SELECT name, iyf_id, submission_id FROM submissions WHERE login = '${P}'`)[0], { name: 'Deleted devotee', iyf_id: '', submission_id: `${P}-${W}` }, 'named "Deleted devotee", no IYF ID');
t.eq(rows('SELECT COUNT(*) AS n FROM submissions')[0].n, subsBefore, 'no submission lost');
t.eq(rows(`SELECT reason FROM attendance WHERE login = '${P}'`)[0], { reason: '' }, 'the attendance reason about him is blanked');
t.eq(rows(`SELECT reason, who, target FROM audit_log WHERE action = 'attendance.override'`)[0], { reason: '', who: 'master', target: P }, 'and the audit entry: reason blanked, target the pseudonym');
const del = rows("SELECT who, target, before, after FROM audit_log WHERE action = 'account.delete'")[0];
t.eq([del.who, del.target, JSON.parse(del.after)], [P, P, { by: 'self', weeksKept: 1 }], 'the deletion is logged, without saying who it was');
t.eq(rows("SELECT COUNT(*) AS n FROM post_comments")[0].n + rows('SELECT COUNT(*) AS n FROM post_likes')[0].n + rows('SELECT COUNT(*) AS n FROM push_subs')[0].n, 0, 'comment, like and phone notification address gone');
t.eq([rows("SELECT COUNT(*) AS n FROM leaders")[0].n, rows("SELECT leader_login FROM memberships WHERE login = '6000000142' AND to_week = ''")[0].leader_login], [0, ''], "he leads no group any more; Keshava's group is free");
t.code(await call('home.get', {}, K), 'ok', 'Keshava carries on as usual');
t.eq(rows("SELECT emergency_phone FROM profiles WHERE login = '6000000142'")[0].emergency_phone, PHONE, "someone else's emergency contact number is theirs: untouched");

// the batch's numbers: unchanged
const after = await stats();
const past = (tr) => tr.filter(x => x.weekId < '2026-10-12');
t.eq(past(after.trend), past(before.trend), "the batch's past weekly numbers are unchanged (he still counts in the weeks he belonged)");
t.eq([before.trend.at(-1).expected, after.trend.at(-1).expected], [2, 1], 'from this week on he is no longer expected');
// order-insensitive (22 Oct 2026): the list is ordered by week, then NAME, and deleting renames the person, so when
// both rows fall in the same week the deleted one legitimately moves. It failed only on dates where they did.
const byKey = (l) => [...l].sort((x, y) => `${x.weekId}|${x.login}`.localeCompare(`${y.weekId}|${y.login}`));
t.eq(byKey(after.missedLog), byKey(before.missedLog.map(x => (x.login === PHONE ? { ...x, login: P, name: 'Deleted devotee' } : x))), 'the missed-weeks list shows "Deleted devotee"');

// ---- the Sheets: every copy, the append-only tabs and the batch view sheets
clock.now += 11 * 60e3;                                   // This week is rewritten at most every 10 minutes
t.ok((await settle()) >= 0, 'the copies settle again');
// nowhere in the database (the registry is the dashboard's own list, copied read-only; Keshava's emergency contact excepted)
const leftovers = [];
for (const { name: tbl } of rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'registry'")) {
  const cols = rows(`PRAGMA table_info("${tbl}")`).map(c => c.name);
  for (const r of rows(`SELECT * FROM "${tbl}"`)) for (const c of cols) {
    const v = String(r[c] ?? '');
    if (tbl === 'profiles' && c === 'emergency_phone' && r.login === '6000000142') continue;
    for (const s of [PHONE, NAME, IYF, FIRST]) if (v.includes(s)) leftovers.push(`${tbl}.${c} has ${s}`);
  }
}
t.eq(leftovers, [], 'no table holds his phone, name, first name or IYF ID');

const cells = sheetCells();
if (process.env.DEBUG) for (const [f, tabs] of Object.entries(sheets)) for (const [tab, rs] of Object.entries(tabs)) rs.forEach((r, i) => r && r.forEach((c, j) => String(c ?? '').includes(NAME) && console.log('   ', f, tab, 'row', i, 'col', j, String(c).slice(0, 160))));
if (process.env.DEBUG) for (const id of Object.values(FILES)) for (const tab of ['This week', 'Scores', 'Days', 'Week-end']) (google.state.tab(id, tab)?.rows || []).forEach((r, i) => r.some(c => String(c ?? '').includes(NAME)) && console.log('    view', byId[id], tab, 'row', i, JSON.stringify(r).slice(0, 200)));
if (process.env.DEBUG) console.log('    view_state', JSON.stringify(rows('SELECT view, mode, focus, last_id, blocks FROM view_state')), JSON.stringify(rows('SELECT * FROM view_dirty')));
t.eq([has(cells, PHONE), has(cells, NAME), has(cells, IYF), has(cells, FIRST)], [1, 0, 0, 0], "no sheet cell holds his name or IYF ID; the phone only as Keshava's emergency contact");
t.ok(has(cells, 'Deleted devotee') >= 3, 'his rows read "Deleted devotee" (Submissions, Scores, Week-end, Days)');
t.eq(rows("SELECT COUNT(*) AS n FROM counters WHERE key LIKE 'erase:%'")[0].n, 0, 'the Sheets clean-up finished and left no queue behind');
const subTab = (sheets.submissions2026?.Submissions || []).filter(Boolean);
t.eq(subTab.length, subsBefore, 'the Submissions tab still has every row');

// ---- the same phone can sign up again, from nothing
at('2026-10-14T10:00:00');
D = await join(PHONE, 'Zorawar Das');
t.ok(typeof D === 'string', 'the phone signs up again');
const wk = (await call('week.get', { weekId: W }, D)).data;
t.ok(!wk?.submitted && !wk?.submission, 'and starts empty: last week is not his any more');

t.done();
