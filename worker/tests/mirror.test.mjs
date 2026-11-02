// The copy to Sheets (src/mirror.js, migration 0018): every Google write is replayed onto a model of the spreadsheets,
// and each changing tab must equal its D1 table — after the first whole copy, edits, deletes, a failed Google call, and
// a change that lands while a copy is in flight. Tabs are never cleared before being rewritten.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { mirrorChanged, MIRRORS, sheetRow, tabCols } from '../src/mirror.js';
import { KEYED } from '../src/mirrorkeys.js';
import { SCHEMA } from '../../setup/schema.mjs';
import FILES from '../../setup/files.json' with { type: 'json' };

const t = suite('copy to Sheets: changed rows only, tabs always complete');
const { env, DB, call, rows, addAccount, google } = boot();
const byId = Object.fromEntries(Object.entries(FILES).filter(([k]) => k !== 'owner').map(([k, v]) => [v, k]));
const sheets = {};                                   // fileKey → tab → [row arrays by sheet row number]
const clearedWhole = [];
function apply(w) {
  const m = /spreadsheets\/([^/:?]+)/.exec(w.url); if (!m) return;
  const file = byId[m[1]]; if (!file) return;
  const tabs = (sheets[file] ||= {});
  const cell = (r) => { const x = /^'([^']+)'!A(\d+)(?::ZZ(\d*))?$/.exec(r); return { tab: x[1], from: +x[2], to: x[3] === undefined ? null : x[3] === '' ? Infinity : +x[3] }; };
  if (w.url.includes('values:batchUpdate')) for (const d of w.body.data) { const c = cell(d.range), tab = (tabs[c.tab] ||= []); d.values.forEach((v, i) => (tab[c.from + i] = v)); }
  else if (w.url.includes('values:batchClear')) for (const r of w.body.ranges) {
    const c = cell(r), tab = (tabs[c.tab] ||= []);
    if (c.from === 2 && c.to === Infinity) clearedWhole.push(c.tab);
    for (let i = c.from; i < tab.length && i <= c.to; i++) tab[i] = undefined;
  } else if (w.url.includes(':append')) {
    const tabName = /'([^']+)'/.exec(decodeURIComponent(w.url))[1], tab = (tabs[tabName] ||= []);
    let at = Math.max(2, tab.length); w.body.values.forEach(v => (tab[at++] = v));
  }
}
let seen = 0;
const sync = async (max = 40) => {
  let reps = [];
  for (let i = 0; i < max; i++) { const r = await mirrorChanged(env, DB, 300); for (; seen < google.writes.length; seen++) apply(google.writes[seen]); if (!r.length) return reps; reps.push(...r); }
  return reps;
};
const norm = (v) => JSON.stringify(v.map(x => (x === '' ? '' : String(x))));
function same(tbl) {
  const [file, tab] = MIRRORS[tbl], cols = tabCols(file, tab);
  const sql = tbl === 'drafts' ? 'SELECT t.*, x.devotee_mark AS __self FROM drafts t LEFT JOIN attendance x ON x.login = t.login AND x.week_id = t.week_id'
    : tbl === 'announcements' ? "SELECT t.*, (SELECT COUNT(*) FROM post_likes l WHERE l.ann_id = t.id) AS likes, (SELECT COUNT(*) FROM post_comments c WHERE c.ann_id = t.id AND c.removed_at = '') AS comments FROM announcements t"
    : `SELECT * FROM ${tbl}`;
  const want = rows(sql).map(r => norm(sheetRow(tbl, cols, r))).sort();
  const got = (sheets[file]?.[tab] || []).slice(2).filter(v => v && v.some(x => x !== '')).map(norm).sort();
  return JSON.stringify(got) === JSON.stringify(want) ? true : { tbl, sheetRows: got.length, tableRows: want.length };
}
const allSame = () => Object.keys(KEYED).map(same).filter(x => x !== true);

// ---- people and activity
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
};
// 6000000140-45: the reserved fixture range (roadmap 6.7); built as a string so the six stay consecutive
for (let i = 0; i < 6; i++) await join('60000001' + (40 + i), 'Devotee Number ' + 'ABCDEF'[i]);

// ---- first run: every changing table copied whole, over whatever the tab had, then live
let rep = await sync();
t.ok(rep.some(r => /accounts \d+ \(copied whole\)/.test(r)), 'first run copies each table whole: ' + rep.filter(r => /whole/.test(r)).slice(0, 3).join(', '));
t.eq(rows("SELECT COUNT(*) AS n FROM mirror_state WHERE mode = 'build'")[0].n, 0, 'every table is live afterwards');
t.eq(allSame(), [], 'every changing tab equals its table');
const tblOf = Object.fromEntries(Object.entries(MIRRORS).map(([k, v]) => [v[1], k]));
t.eq(clearedWhole.filter(tab => rows(`SELECT COUNT(*) AS n FROM ${tblOf[tab]}`)[0].n > 0), [], 'no tab holding rows was cleared whole (only empty tables: ' + clearedWhole.join(', ') + ')');
t.eq(await mirrorChanged(env, DB, 300), [], 'nothing changed: nothing copied');

// ---- edits: only the changed rows are written, at their own row
const before = google.writes.length;
await call('facilitators.add', { name: 'Madhav Das Prabhuji' }, M);
await call('devotees.setPeople', { login: '6000000142', classDay: 'SAT' }, M);
rep = await sync();
const sent = google.writes.slice(before).filter(w => w.url.includes('values:batchUpdate')).flatMap(w => w.body.data.map(d => d.range));
t.ok(sent.every(r => /![A]\d+$/.test(r)) && sent.length <= 4, 'only the changed rows are written (' + sent.join(', ') + ')');
t.eq(allSame(), [], 'tabs equal tables after edits');

// ---- a delete leaves that row blank; the rest stay where they are
const accRowBefore = rows("SELECT \"row\" FROM mirror_rows WHERE tbl = 'accounts' AND k1 = '6000000145'")[0].row;
await call('devotees.setActive', { login: '6000000145', active: false }, M);
t.code(await call('devotees.delete', { login: '6000000145', confirmPhone: '6000000145' }, M), 'ok', 'a devotee is deleted');
await sync();
t.eq(allSame(), [], 'tabs equal tables after a delete');
t.eq((sheets.access.Accounts[accRowBefore] || []).every(x => x === undefined || x === ''), true, "the deleted person's row is blank");
t.eq(rows("SELECT COUNT(*) AS n FROM mirror_rows WHERE tbl = 'accounts' AND k1 = '6000000145'")[0].n, 0, 'and forgotten in the row map');

// ---- Google down: nothing is lost; the next run copies it
google.state.failSheets = true;
await call('facilitators.add', { name: 'Govind Das Prabhuji' }, M);
rep = await mirrorChanged(env, DB, 300);
t.ok(rep.some(r => /failed/.test(r)), 'a failed Google call is reported');
t.ok(rows("SELECT COUNT(*) AS n FROM mirror_log WHERE tbl = 'facilitators' AND id > (SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log')")[0].n > 0, 'and the change waits in the log');
google.state.failSheets = false;
await sync();
t.eq(allSame(), [], 'copied once Google is back');

// ---- a change landing while its row is being copied is not lost (the version differs, so it stays logged)
const realFetch = globalThis.fetch;
let raced = false;
globalThis.fetch = async (url, opt) => {
  if (!raced && String(url).includes('values:batchUpdate')) { raced = true; DB.sql.exec("UPDATE facilitators SET changed_by = 'mid-copy' WHERE name = 'Govind Das Prabhuji'"); }
  return realFetch(url, opt);
};
await call('facilitators.setActive', { name: 'Govind Das Prabhuji', active: false }, M);
await sync();
globalThis.fetch = realFetch;
t.ok(raced, 'a change was made during the copy');
t.eq(allSame(), [], 'the later change reached the sheet too');

// ---- attendance and settings (upserts fire the triggers too)
DB.sql.exec("UPDATE settings SET value = '2026-09-28' WHERE key = 'tracking_from'");
await sync();
t.eq(allSame(), [], 'settings change copied');
t.eq(rows("SELECT COUNT(*) AS n FROM mirror_log WHERE id > (SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log')")[0].n, 0, 'nothing is left to copy in the log');

// ---- attendance as it is marked, and drafts as they are filled (the head, 3 Oct 2026)
const logins = rows("SELECT login FROM accounts WHERE role = 'DEVOTEE' ORDER BY login").map(r => r.login);
logins.forEach((l, i) => DB.sql.exec(`INSERT INTO attendance (login, week_id, batch_id, devotee_mark, mark_used) VALUES ('${l}', '2026-09-28', '${i % 2 ? 'SPS' : 'DPS'}', 'P', 'P')`));
await sync();
t.eq(same('attendance'), true, 'open-week attendance reaches the sheet within a run');
DB.sql.exec(`UPDATE attendance SET coordinator_mark = 'A', mark_used = 'A' WHERE login = '${logins[0]}'`);
await sync();
t.eq(same('attendance'), true, "a coordinator's mark is copied");
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
const T1 = (await call('auth.login', { login: logins[1], password: 'Devotee pass 2026' })).data.token;
const sd = await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day }, T1);
t.code(sd, 'ok', 'a devotee saves a day');
await sync();
t.eq(same('drafts'), true, 'the draft reaches the Drafts tab');
const drow = (sheets.drafts.Drafts || []).find(v => v && v[0] === `${logins[1]}|2026-10-05`);
t.ok(drow && drow[1] === logins[1] && /"rounds":16/.test(drow[4]), 'Drafts tab row: key login|week, the day in Monday\'s column');
const again = await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day }, T1);
t.eq([again.ok, again.data?.version], [true, 1], 'the same save repeated (a lost answer) is a success, not "changed on another device"');
const other = await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day: { ...day, rounds: 4 } }, T1);
t.code(other, 'STALE', 'a different save on an old version is still refused');
// a draft removed (submitted / deadline): its row is blanked and reused by the next new draft
const usedRow = rows(`SELECT "row" FROM mirror_rows WHERE tbl = 'drafts' AND k1 = '${logins[1]}'`)[0].row;
DB.sql.exec(`DELETE FROM drafts WHERE login = '${logins[1]}'`);
await sync();
t.eq(same('drafts'), true, 'a removed draft leaves the Drafts tab');
const T2 = (await call('auth.login', { login: logins[2], password: 'Devotee pass 2026' })).data.token;
await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day }, T2);
await sync();
t.eq(rows(`SELECT "row" FROM mirror_rows WHERE tbl = 'drafts' AND k1 = '${logins[2]}'`)[0].row, usedRow, 'the next new draft takes the freed row (no growing gaps)');
t.eq(same('drafts'), true, 'Drafts tab equals the table');

// ---- group leaders and the new columns (migration 0023) reach the sheets
DB.sql.exec(`INSERT INTO leaders (login, batch_id, appointed_by, appointed_at) VALUES ('${logins[0]}', 'SPS', 'master', '2026-10-03T12:00:00+05:30')`);
DB.sql.exec(`UPDATE memberships SET leader_login = '${logins[0]}' WHERE login = '${logins[3]}'`);
DB.sql.exec(`UPDATE attendance SET leader_mark = 'P', leader_by = '${logins[0]}' WHERE login = '${logins[3]}'`);
DB.sql.exec(`UPDATE profiles SET addr_line = '12 Hare Krishna Marg', addr_area = 'East of Kailash', addr_city = 'Delhi', addr_pin = '110065' WHERE login = '${logins[3]}'`);
await sync();
t.eq(['leaders', 'memberships', 'attendance', 'profiles'].map(same), [true, true, true, true], 'Leaders tab, leader on the membership, the leader\'s mark and the address all copied');
t.ok((sheets.access.Leaders || []).some(v => v && v[0] === logins[0] && v[1] === 'SPS'), 'the Leaders tab has the appointed leader');
DB.sql.exec(`DELETE FROM leaders WHERE login = '${logins[0]}'`);
await sync();
t.eq(same('leaders'), true, 'a leader stepping down leaves the tab');

// ---- comments row by row; like and comment counts on the Announcements tab (migration 0026)
DB.sql.exec("INSERT INTO announcements (title, body, audience, author_login, author_name, created_at, updated_at) VALUES ('Kirtan', 'Sunday 6 PM', 'ALL', 'master', 'IYF Head', '2026-10-04T10:00:00+05:30', '2026-10-04T10:00:00+05:30')");
await sync();
const annId = rows("SELECT MAX(id) AS id FROM announcements")[0].id;
DB.sql.exec(`INSERT INTO post_comments (ann_id, login, name, body, at) VALUES (${annId}, '${logins[1]}', 'Devotee', 'Hare Krishna, I will come', '2026-10-04T11:00:00+05:30')`);
await sync();
t.eq(same('post_comments'), true, 'a comment reaches the PostComments tab');
const annRow = () => (sheets.access.Announcements || []).find(v => v && String(v[0]) === String(annId));
t.eq(annRow()?.[12], 1, "its post's comment count updates at once");
DB.sql.exec(`INSERT INTO post_likes (ann_id, login, at) VALUES (${annId}, '${logins[1]}', '2026-10-04T11:00:00+05:30'), (${annId}, '${logins[2]}', '2026-10-04T11:01:00+05:30')`);
await sync();
t.eq(annRow()?.[11], 0, 'likes are not copied one by one (count refreshed at night)');
t.eq(rows("SELECT COUNT(*) AS n FROM mirror_log WHERE tbl = 'post_likes'")[0].n, 0, 'a like adds no copy-log write');
await mirrorChanged(env, DB, 300, new Date('2026-10-04T20:31:00Z'));     // 02:01 IST: the nightly recopy starts
await sync();
t.eq([annRow()?.[11], annRow()?.[12]], [2, 1], 'after the nightly recopy the like count is current');
t.eq(same('announcements'), true, 'Announcements tab equals the table with its counts');

// ---- Phase 0 (migration 0030): reports and mutes row by row; the consent columns at the end of the Profiles tab
DB.sql.exec(`INSERT INTO post_reports (ann_id, comment_id, reporter, reason, note, at) VALUES (${annId}, 0, '${logins[2]}', 'spam', 'ads', '2026-10-04T12:00:00+05:30')`);
DB.sql.exec(`INSERT INTO post_mutes (viewer, author, by, at) VALUES ('${logins[2]}', '${logins[1]}', '${logins[2]}', '2026-10-04T12:01:00+05:30'), ('*', '${logins[3]}', 'master', '2026-10-04T12:02:00+05:30')`);
DB.sql.exec(`UPDATE profiles SET parent_name = 'Ramesh Kumar', parent_phone = '6000000180', parent_consent_at = '2026-10-04T12:03:00+05:30', privacy_consent_at = '2026-10-04T12:03:00+05:30' WHERE login = '${logins[2]}'`);
await sync();
t.eq(['post_reports', 'post_mutes', 'profiles'].map(same), [true, true, true], 'PostReports and PostMutes tabs, and the consent columns of Profiles, equal their tables');
t.ok((sheets.access.PostMutes || []).some(v => v && v[1] === '*' && v[2] === logins[3]), 'a person hidden for everyone shows as viewer *');
const prof = (sheets.profiles.Profiles || []).find(v => v && v[0] === logins[2]);
// 15 identity / sign-up columns were added at the end on 11 Oct 2026 (migration 0038), so the
// parent and address blocks are no longer the tail: count back past them.
t.eq(prof?.slice(-23, -19), ['Ramesh Kumar', '6000000180', '2026-10-04 12:03', '2026-10-04 12:03'], 'parent name, phone, consent and privacy times come next in Profiles');
t.eq(prof?.slice(-19, -16).length, 3, 'then the address parts (Phase 9: house, street, landmark)');
t.eq(prof?.slice(-16, -1).length, 15, 'then the sign-up and identity columns (0038), fifteen');
// `hobbies` is the last Sheets column and is NOT used: sign-up asks for service skills from a fixed list
// instead (11 Oct 2026), which go in `skills`. A Sheets column is only ever added, never removed.
t.eq(prof?.slice(-1).length, 1, 'and the unused hobbies column at the very end');
DB.sql.exec(`UPDATE post_reports SET state = 'DISMISSED', decided_by = 'master', decided_at = '2026-10-04T13:00:00+05:30'`);
DB.sql.exec(`DELETE FROM post_mutes WHERE viewer = '*'`);
await sync();
t.eq(['post_reports', 'post_mutes'].map(same), [true, true], 'a decided report and a mute taken back follow');

// ---- old log entries are trimmed on a quiet night, never ones not yet copied
const logBefore = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
DB.sql.exec("INSERT INTO settings (key, value, changed_by, changed_at) VALUES ('probe', '1', 't', 't')");   // one new, uncopied entry
await mirrorChanged(env, DB, 300, new Date('2026-10-07T20:40:00Z'));        // Thursday 02:10 IST (a trim night), copies it
const rep2 = await mirrorChanged(env, DB, 300, new Date('2026-10-07T20:41:00Z'));
t.ok(rep2.some(r => /log trimmed/.test(r)) && rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n < logBefore, 'copied entries are trimmed at night: ' + rep2.join(', '));
const sundayTrim = await mirrorChanged(env, DB, 300, new Date('2026-10-04T20:41:00Z'));   // Monday 02:11 IST: not a trim night
t.ok(!sundayTrim.some(r => /trimmed/.test(r)), 'not on the busy nights (Sunday / Monday)');

// ---- 10 Oct 2026: the trim emptied the log, SQLite numbered new entries from 1 again, and the copy (reading ids above
//      its position) skipped them — and the next trim deleted them unread. The trim now keeps the entry at the position,
//      and a log below the position is read from its start.
t.ok(rows("SELECT COUNT(*) AS n FROM mirror_log WHERE id = (SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log')")[0].n === 1, 'the trim keeps the entry at the position (the log is never emptied)');
DB.sql.exec("INSERT INTO settings (key, value, changed_by, changed_at) VALUES ('probe2', '1', 't', 't')");
t.ok(rows("SELECT MAX(id) AS m FROM mirror_log")[0].m > rows("SELECT last_id AS p FROM mirror_state WHERE tbl = 'mirror_log'")[0].p, 'so a new entry gets an id above the position');
await sync();
// the stalled state as found live: position 354, the log holding only new entries 1–3
DB.sql.exec('DELETE FROM mirror_log');
DB.sql.exec("UPDATE mirror_state SET last_id = 354 WHERE tbl = 'mirror_log'");
DB.sql.exec("INSERT INTO settings (key, value, changed_by, changed_at) VALUES ('probe3', '1', 't', 't')");
t.ok(rows('SELECT MAX(id) AS m FROM mirror_log')[0].m < 354, 'the stalled state: new entries numbered below the position');
const { mirrorBacklog } = await import('../src/mirror.js');
t.eq(await mirrorBacklog(DB), 1, 'the backlog counts them (it read 0 while stalled)');
await sync();
t.eq(same('settings'), true, 'the stalled entries are copied: the Settings tab matches again');
t.ok(rows("SELECT last_id AS p FROM mirror_state WHERE tbl = 'mirror_log'")[0].p < 354, 'and the position follows the log down');
t.eq(await mirrorBacklog(DB), 0, 'nothing waits afterwards');

// ---- the copy reads only what changed
t.ok(rows("SELECT COUNT(*) AS n FROM mirror_rows WHERE tbl = 'accounts'")[0].n === rows('SELECT COUNT(*) AS n FROM accounts')[0].n, 'one row-map entry per account');
t.done();
