// Phase 0 on the server (8 Oct 2026): the pending sign-up's answer, attendance in reopened weeks, the book being read,
// Activity lines for staff marking and filling, sign-up from 15 with parent consent, the bell's post times, and the
// wall's moderation (report, hide a person for oneself or for everyone, the IYF head's queue).
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';

const t = suite('phase 0: trust and store blockers');
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026', { name: 'IYF Head' });
DB.sql.exec("UPDATE accounts SET is_master = 1 WHERE login = 'master'");
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const PW = 'Devotee pass 2026';
const ADDRESS = { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' };
const signUp = (phone, name, extra = {}, dob = '2001-01-01', batchId = 'SPS2') => call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, password: PW,
  profile: { dob, bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: ADDRESS }, ...extra });
const join = async (phone, name, batchId = 'SPS2') => {
  await signUp(phone, name, {}, '2001-01-01', batchId);
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: PW })).data.token;
};

// ---- S1: a pending sign-up's answer, only after the password
let r = await signUp('6000000053', 'Kavya Sharma');
t.code(r, 'ok', 'a sign-up');
r = await call('auth.login', { login: '6000000053', password: 'Wrong pass 2026' });
t.eq([r.error.code, r.error.details], ['BAD_CREDENTIALS', undefined], 'a wrong password: the usual answer, nothing about the sign-up');
r = await call('auth.login', { login: '6000000069', password: PW });
t.code(r, 'BAD_CREDENTIALS', 'no such number: the same answer');
r = await call('auth.login', { login: '6000000053', password: PW });
t.eq([r.error.code, r.error.details], ['PENDING_APPROVAL', { firstName: 'Kavya', batchName: 'SPS Group 2', facilitatorName: FAC, requestedAt: '2026-10-05T09:00:00+05:30' }],
  'the right password: PENDING_APPROVAL with the first name, batch, facilitator and when');
await signUp('6000000054', 'Rohan Verma');
await call('requests.reject', { phone: '6000000054', reason: 'Not in this batch' }, M);
r = await call('auth.login', { login: '6000000054', password: PW });
t.eq([r.error.code, r.error.details?.firstName, r.error.details?.reason, !!r.error.details?.decidedAt], ['REJECTED', 'Rohan', 'Not in this batch', true], 'a rejected sign-up: the same details, the reason and when');
t.code(await call('auth.login', { login: '6000000054', password: 'Wrong pass 2026' }), 'BAD_CREDENTIALS', 'and with a wrong password, nothing');

// ---- S5: sign-up from 15; parent or guardian consent under 18; the privacy notice
const minor = (extra, dob = '2010-01-01') => signUp('6000000056', 'Meera Gupta', extra, dob);
r = await minor({}, '2012-01-01');
t.eq([r.error?.code, r.error?.fields?.[0]], ['VALIDATION', { path: 'profile.dob', message: 'Sign-up is open from age 15.' }], 'age 14: refused, with a clear reason');
r = await minor({});
t.eq([r.error?.fields?.map(f => f.path), r.error?.message], [['parentConsent'], "You are under 18: your parent's or guardian's name and mobile number are needed to sign up."],
  'age 16 without consent (or an older app): one clear message');
r = await minor({ parentConsent: {} });
t.eq(r.error?.fields?.map(f => f.path), ['parentConsent.name', 'parentConsent.phone'], "an empty consent: the parent's name and phone are asked for");
r = await minor({ parentConsent: { name: 'Ramesh Gupta', phone: '6000000056' } });
t.eq(r.error?.fields?.map(f => f.path), ['parentConsent.phone'], "not the applicant's own number");
r = await minor({ parentConsent: { name: 'R4mesh', phone: '12345' } });
t.eq(r.error?.fields?.map(f => f.path), ['parentConsent.name', 'parentConsent.phone'], 'a real name and a 10-digit mobile');
t.code(await minor({ parentConsent: { name: 'Ramesh Gupta', phone: '6000000069', aadhaar: '1234' } }), 'BAD_REQUEST', 'nothing else is taken (no ID of any kind)');
t.code(await minor({ parentConsent: { name: 'Ramesh Gupta', phone: '6000000068' }, privacyConsent: false }), 'VALIDATION', 'privacyConsent, when sent, must be true');
t.code(await minor({ parentConsent: { name: 'Ramesh Gupta', phone: '+91 60000 00068' }, privacyConsent: true }), 'ok', 'age 16 with a parent\'s consent: signed up (+91 and the spaces are stripped)');
t.eq(rows("SELECT parent_name, parent_phone, parent_consent_at, privacy_consent_at FROM profiles WHERE login = '6000000056'")[0],
  { parent_name: 'Ramesh Gupta', parent_phone: '6000000068', parent_consent_at: '2026-10-05T09:00:00+05:30', privacy_consent_at: '2026-10-05T09:00:00+05:30' }, 'kept with the profile, with the times');
t.code(await signUp('6000000057', 'Neha Jain', {}, '2011-10-05'), 'VALIDATION', 'exactly 15 is a child too: consent needed');
t.code(await signUp('6000000057', 'Neha Jain', { parentConsent: { name: 'Sunita Jain', phone: '6000000067' } }, '2011-10-05'), 'ok', 'and enough with it');
t.code(await signUp('6000000058', 'Old App User', { parentConsent: { name: 'Ignored Parent', phone: '6000000096' } }), 'ok', 'an adult: no consent asked; an older app sends no privacyConsent and still signs up');
t.eq(rows("SELECT parent_name, privacy_consent_at FROM profiles WHERE login = '6000000058'")[0], { parent_name: '', privacy_consent_at: '' }, "an adult's parent is not stored");
r = await call('requests.list', {}, C);
const su = Object.fromEntries(r.data.signUps.map(s => [s.phone, s]));
t.eq([su['6000000056'].parentName, su['6000000056'].parentPhone, su['6000000056'].privacyConsentAt], ['Ramesh Gupta', '6000000068', '2026-10-05T09:00:00+05:30'], 'the coordinator sees the parent on the request');
t.eq([su['6000000058'].parentName, su['6000000058'].parentPhone, su['6000000058'].privacyConsentAt], [null, null, null], 'and nothing for an adult');
await call('requests.approve', { phone: '6000000056', link: { noIdYet: true } }, C);
t.eq((await call('devotees.get', { login: '6000000056' }, C)).data.profile.parentConsent, { name: 'Ramesh Gupta', phone: '6000000068', at: '2026-10-05T09:00:00+05:30' }, "it stays on the member's record after approval");
const MEERA = (await call('auth.login', { login: '6000000056', password: PW })).data.token;
t.eq((await call('profile.get', {}, MEERA)).data.parentConsent?.name, 'Ramesh Gupta', 'and on her own profile');
t.code(await call('profile.update', { dob: '2013-01-01' }, MEERA), 'ok', 'an existing member\'s date of birth keeps the old 12–80 rule (only sign-up starts at 15)');

// ---- S3: the book being read, on the server
const A = await join('6000000059', 'Arjun Das'), B = await join('6000000060', 'Bhima Das'), X = await join('6000000061', 'Other Batch', 'BSS');
r = await call('books.setCurrent', { bookId: 'B01' }, A);
t.eq(r.data, { currentBookId: 'B01' }, 'a devotee sets the book being read');
t.eq((await call('home.get', {}, A)).data.progress.currentBookId, 'B01', 'home.get shows it');
t.eq((await call('journals.get', {}, A)).data.currentBookId, 'B01', 'journals.get gives it to the devotee too');
const jvA = (await call('journals.get', {}, A)).data.version;   // read, not written down: relinks raise it
t.eq((await call('journals.get', { have: jvA }, A)).data, { notModified: true, version: jvA, currentBookId: 'B01' }, 'also when the lists are unchanged');
const logged = () => rows("SELECT COUNT(*) AS n FROM mirror_log WHERE tbl = 'profiles'")[0].n;
let n0 = logged();
t.code(await call('books.setCurrent', { bookId: 'B01' }, A), 'ok', 'the same book again');
t.eq(logged(), n0, '… writes nothing');
t.eq((await call('books.setCurrent', { bookId: null }, A)).data, { currentBookId: null }, 'null clears it');
t.eq(logged(), n0 + 1, 'one write (one row copied to Sheets)');
t.code(await call('books.setCurrent', { bookId: 'NOPE' }, A), 'VALIDATION', 'only a book on the list');
t.code(await call('books.setCurrent', {}, A), 'VALIDATION', 'bookId is required (null to clear)');
t.eq((await call('books.setCurrent', { bookId: 'B01', onBehalfOf: '6000000060' }, C)).data, { currentBookId: 'B01' }, "the coordinator sets it for a devotee of the batch (fill-on-behalf)");
t.eq((await call('journals.get', { onBehalfOf: '6000000060' }, C)).data.currentBookId, 'B01', '… and sees it there');
t.code(await call('books.setCurrent', { bookId: 'B01', onBehalfOf: '6000000061' }, C), 'FORBIDDEN', 'not for another batch');
t.code(await call('books.setCurrent', { bookId: 'B01', onBehalfOf: '6000000060' }, A), 'FORBIDDEN', 'a devotee only for themselves');
t.code(await call('books.setCurrent', { bookId: 'B01' }, M), 'FORBIDDEN', 'the head has no reading of their own');
t.code(await call('books.setCurrent', { bookId: 'B01', onBehalfOf: '6000000061' }, M), 'ok', 'the head for anyone');

// ---- S6: the bell: the newest post's time even with an older pinned post on top, and the 10 newest times
at('2026-10-05T09:10:00');
await call('announcements.create', { title: 'Pinned notice', body: 'Always here.', audience: 'ALL', pinned: true }, M);
for (let i = 0; i < 11; i++) { at(`2026-10-05T10:${String(i).padStart(2, '0')}:00`); await call('announcements.create', { title: 'Post ' + i, body: 'Hare Krishna', audience: ['SPS2'] }, C); }
at('2026-10-05T11:00:00');
await call('announcements.create', { title: 'DPS only', body: 'Not for SPS2', audience: ['DPS'] }, M);
r = (await call('home.get', {}, A)).data;
t.eq(r.latestAnnouncementAt, '2026-10-05T10:10:00+05:30', 'latestAnnouncementAt is the newest post, not the pinned one listed first');
t.eq([r.announcementTimes.length, r.announcementTimes[0], r.announcementTimes[9]], [10, '2026-10-05T10:10:00+05:30', '2026-10-05T10:01:00+05:30'], 'announcementTimes: the 10 newest the devotee sees, newest first');
t.eq((await call('home.get', {}, X)).data.announcementTimes, ['2026-10-05T09:10:00+05:30'], 'another batch sees only what is for them');

// ---- S2 and S4: attendance in a reopened week; Activity lines for staff marking and filling
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
const W = '2026-10-05', W2 = '2026-10-12';
const L = await join('6000000062', 'Lakshman Leader');
await call('leaders.set', { login: '6000000062', leader: true }, C);
await call('leaders.assign', { leader: '6000000062', logins: ['6000000059', '6000000060'] }, C);
at('2026-10-11T10:00:00');                                    // the Sunday class
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000059', mark: 'A' }, { login: '6000000060', mark: 'P' }, { login: '6000000056', mark: null }] }, C), 'ok', 'the coordinator marks the class');
t.eq(rows("SELECT who, target, batch_id, after FROM audit_log WHERE action = 'attendance.set'").map(a => [a.who, a.target, a.batch_id, JSON.parse(a.after)]),
  [['sps', 'SPS2', 'SPS2', { weekId: W, marked: 3, present: 1, absent: 1, cleared: 1 }]], 'one Activity line for the save: batch, week and counts');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000060', mark: 'P' }] }, L), 'ok', 'the group leader marks');
t.eq(rows("SELECT who, after FROM audit_log WHERE action = 'group.mark'").map(a => [a.who, JSON.parse(a.after).present]), [['6000000062', 1]], 'one Activity line for the leader too');
at('2026-10-12T21:30:00');                                    // past the deadline: both weeks missed, attendance locked
for (let i = 0; i < 5; i++) await runDeadline({}, DB, new Date(clock.now));
t.eq(rows(`SELECT COUNT(*) AS n FROM attendance WHERE week_id = '${W}' AND locked = 1`)[0].n >= 2, true, 'the week is closed and its attendance locked');
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, A), 'WINDOW_CLOSED', 'not reopened: the devotee cannot mark');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000059', mark: 'P' }] }, L), 'WINDOW_CLOSED', '… nor the leader');
t.code(await call('weeks.reopen', { login: '6000000059', weekId: W, reason: 'Was in hospital', openUntil: '2026-10-15T21:00:00+05:30' }, M), 'ok', 'the head reopens Arjun\'s week');
at('2026-10-13T10:00:00');
r = await call('week.get', { weekId: W }, A);
t.eq([r.data.status, r.data.closesAt, r.data.attendance.locked], ['REOPENED', '2026-10-15T21:00:00+05:30', false], 'the reopened week: open until the reopen\'s deadline, attendance not locked');
r = await call('week.setAttendance', { weekId: W, mark: 'P' }, A);
t.eq([r.ok, r.data?.devotee, r.data?.used], [true, 'P', 'A'], "the devotee marks it (the coordinator's mark still counts above it)");
r = await call('devotees.list', { batchId: 'SPS2', weekId: W }, C);
const row = Object.fromEntries(r.data.rows.map(x => [x.login, x]));
t.eq([row['6000000059'].reopenUntil, row['6000000059'].attendance.locked, row['6000000060'].reopenUntil, row['6000000060'].attendance.locked],
  ['2026-10-15T21:00:00+05:30', false, null, true], 'the board: the reopened row is open until then, the others stay locked');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000060', mark: 'A' }] }, C), 'WINDOW_CLOSED', 'the coordinator: a week not reopened stays closed');
r = await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000059', mark: 'P' }, { login: '6000000060', mark: 'A' }] }, C);
t.eq([r.error?.code, r.error?.fields?.[0]?.path], ['VALIDATION', 'marks.1.login'], '… also mixed into one save');
t.eq((await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000059', mark: 'P' }] }, C)).data, { saved: 1 }, 'but marks the reopened devotee');
t.eq(rows(`SELECT coordinator_mark, mark_used FROM attendance WHERE login = '6000000059' AND week_id = '${W}'`)[0], { coordinator_mark: 'P', mark_used: 'P' }, 'and it counts');
t.eq((await call('group.mark', { weekId: W, marks: [{ login: '6000000059', mark: 'P' }] }, L)).data, { saved: 1 }, 'the group leader too');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000060', mark: 'P' }] }, L), 'WINDOW_CLOSED', '… not for a member whose week is not reopened');
const groupRow = (await call('group.list', { weekId: W }, L)).data.members.find(m => m.login === '6000000059');
t.eq(groupRow.reopenUntil, '2026-10-15T21:00:00+05:30', "the leader's list says until when");
// filling for a devotee: one Activity line per save
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
t.code(await call('week.saveDay', { weekId: W2, date: W2, version: 0, day, onBehalfOf: '6000000060' }, C), 'ok', 'the coordinator fills a day for Bhima');
t.code(await call('week.saveDay', { weekId: W2, date: W2, version: 0, day, onBehalfOf: '6000000060' }, C), 'ok', 'the same save repeated');
t.code(await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES', onBehalfOf: '6000000059' }, C), 'ok', "and Arjun's reopened week-end");
t.code(await call('week.saveDay', { weekId: W2, date: W2, version: 0, day }, A), 'ok', 'a devotee\'s own save');
t.eq(rows("SELECT action, who, target, after FROM audit_log WHERE action LIKE 'week.save%' ORDER BY id").map(a => [a.action, a.who, a.target, JSON.parse(a.after).weekId, JSON.parse(a.after).date || null]),
  [['week.saveDay.onBehalf', 'sps', '6000000060', W2, W2], ['week.saveWeekEnd.onBehalf', 'sps', '6000000059', W, null]], 'one line per save on behalf (not for a repeat, nor for the devotee\'s own)');
at('2026-10-15T21:30:00');                                    // the reopen's deadline has passed
t.code(await call('week.setAttendance', { weekId: W, mark: 'A' }, A), 'WINDOW_CLOSED', 'after the reopen\'s deadline the devotee cannot mark');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000059', mark: 'A' }] }, C), 'WINDOW_CLOSED', '… nor the coordinator');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000059', mark: 'A' }] }, L), 'WINDOW_CLOSED', '… nor the leader');

// ---- S8: data that comes with an error is inside error too (where the app reads it)
r = await call('week.saveDay', { weekId: W2, date: W2, version: 0, day: { ...day, rounds: 4 } }, A);
t.eq([r.error?.code, r.error?.data?.current?.rounds, r.data?.current?.rounds], ['STALE', 16, 16], "STALE: the stored day in error.data (and, as before, in data)");

// ---- S7: the wall's moderation
at('2026-10-16T09:00:00');
const D = await join('6000000063', 'Dhruv Rude'), E = await join('6000000064', 'Esha Kind'), F = await join('6000000065', 'Farhan Fair');
const post = (await call('announcements.create', { title: 'Kirtan night', body: 'Saturday 7 PM at the temple hall, everyone welcome.', audience: 'ALL' }, M)).data.announcement.id;
const say = async (tok, body) => (await call('announcements.comment', { id: post, body }, tok)).data.comment.id;
const c1 = await say(D, 'This is a rude comment'), c2 = await say(E, 'Hare Krishna, see you'), c3 = await say(C, 'Prasadam after kirtan');
r = await call('announcements.comments', { id: post }, E);
t.eq([r.data.canReport, r.data.commentsBlocked], [true, false], 'comments come with canReport (and whether mine are turned off)');
t.eq((await call('announcements.list', {}, E)).data.canReport, true, 'so does the wall');
t.eq((await call('announcements.report', { id: post, commentId: c1, reason: 'abusive', note: '  very   rude ' }, E)).data, { reported: true }, 'a devotee reports a comment');
t.code(await call('announcements.report', { id: post, commentId: c1, reason: 'spam' }, E), 'ok', 'again: no error');
t.eq(rows(`SELECT reporter, reason, note FROM post_reports WHERE comment_id = ${c1}`), [{ reporter: '6000000064', reason: 'abusive', note: 'very rude' }], '… and still one report from her');
t.code(await call('announcements.report', { id: post, commentId: c1, reason: 'spam' }, F), 'ok', 'another person reports it');
t.code(await call('announcements.report', { id: post, reason: 'other' }, D), 'ok', 'a post can be reported');
t.code(await call('announcements.report', { id: post, commentId: c1, reason: 'spam' }, D), 'CONFLICT', 'not one\'s own comment');
t.code(await call('announcements.report', { id: post, commentId: c2, reason: 'rude' }, F), 'VALIDATION', 'a reason from the list');
t.code(await call('announcements.report', { id: post, commentId: c2, reason: 'other', note: 'x'.repeat(201) }, F), 'VALIDATION', 'a note of at most 200 characters');
t.code(await call('announcements.report', { id: post, commentId: 99999, reason: 'spam' }, F), 'NOT_FOUND', 'a comment that is not there');
t.code(await call('announcements.reports', {}, C), 'FORBIDDEN', 'the queue is the IYF head\'s');
r = await call('announcements.reports', {}, M);
const byKey = Object.fromEntries(r.data.reports.map(x => [x.key, x]));
t.eq(r.data.total, 2, 'two items reported');
const rc = byKey['c' + c1];
t.eq([rc.kind, rc.postId, rc.commentId, rc.excerpt, rc.authorName, rc.count, rc.reasons.sort(), rc.notes, rc.removed, rc.reportIds.length],
  ['comment', post, c1, 'This is a rude comment', 'Dhruv Rude', 2, ['abusive', 'spam'], ['very rude'], false, 2], 'a reported comment: excerpt, writer, count, reasons, notes');
t.eq([byKey['p' + post].kind, byKey['p' + post].commentId, byKey['p' + post].excerpt.startsWith('Kirtan night — Saturday'), byKey['p' + post].authorName], ['post', null, true, 'IYF Head'], 'a reported post');
t.ok(!JSON.stringify(r.data).includes('98111002'), 'no phone numbers in the queue');
t.code(await call('announcements.resolve', { postId: post, commentId: c1, action: 'remove' }, C), 'FORBIDDEN', 'only the head decides');
t.code(await call('announcements.resolve', { postId: post, commentId: c1, action: 'hide' }, M), 'VALIDATION', 'dismiss or remove');
t.eq((await call('announcements.resolve', { postId: post, commentId: c1, action: 'remove' }, M)).data, { action: 'remove', closed: 2 }, 'the head removes the comment: both reports closed');
t.ok(!(await call('announcements.comments', { id: post }, E)).data.comments.some(c => c.id === c1), 'the comment is off the wall');
t.eq(rows(`SELECT removed_at <> '' AS gone FROM post_comments WHERE id = ${c1}`)[0].gone, 1, '… kept, marked removed');
t.code(await call('announcements.resolve', { postId: post, commentId: c1, action: 'remove' }, M, { requestId: 'again-0001' }), 'NOT_FOUND', 'nothing open about it any more');
t.eq((await call('announcements.resolve', { postId: post, action: 'dismiss' }, M)).data, { action: 'dismiss', closed: 1 }, 'the post\'s report is dismissed');
t.ok((await call('announcements.list', {}, E)).data.announcements.some(a => a.id === post), 'and the post stays');
t.eq((await call('announcements.reports', {}, M)).data, { reports: [], total: 0 }, 'the queue is empty');
t.eq(rows("SELECT after FROM audit_log WHERE action = 'announcements.resolve' ORDER BY id").map(a => JSON.parse(a.after).action), ['remove', 'dismiss'], 'each decision is in the Activity log');

// hide a person's comments, for me
const c4 = await say(D, 'Another comment from Dhruv');
t.code(await call('mutes.set', { commentId: c2, mute: true }, E), 'CONFLICT', 'not one\'s own comments');
r = await call('mutes.set', { commentId: c4, mute: true }, E);
t.eq([r.data.muted, r.data.name, typeof r.data.key], [true, 'Dhruv Rude', 'string'], 'Esha hides Dhruv\'s comments');
const key = r.data.key;
t.ok(!JSON.stringify(r.data).includes('6000000063'), "without being told Dhruv's phone");
t.ok(!(await call('announcements.comments', { id: post }, E)).data.comments.some(c => c.id === c4), 'his comments are gone for her');
t.ok((await call('announcements.comments', { id: post }, F)).data.comments.some(c => c.id === c4), 'not for anyone else');
t.ok((await call('announcements.comments', { id: post }, D)).data.comments.some(c => c.id === c4), 'he still sees his own');
const count = async (tok) => (await call('announcements.list', {}, tok)).data.announcements.find(a => a.id === post).comments;
t.eq([await count(E), await count(F)], [2, 3], 'the comment count is what each one sees');
r = await call('mutes.list', {}, E);
t.eq([r.data.mutes.map(m => [m.key, m.name]), r.data.everyone], [[[key, 'Dhruv Rude']], undefined], 'her hidden list: key and name only');
t.code(await call('mutes.set', { commentId: c3, mute: true }, E), 'ok', 'staff can be hidden too (their comments)');
t.ok((await call('announcements.list', {}, E)).data.announcements.length > 0 && (await call('announcements.list', {}, E)).data.announcements.some(a => a.author === 'Sps Coordinator'), "a hidden staff member's posts still show");
t.eq((await call('mutes.set', { key, mute: false }, E)).data, { muted: false, key: null, name: 'Dhruv Rude' }, 'shown again by the key');
t.eq((await call('mutes.set', { key, mute: false }, E)).data.muted, false, '… which is safe to repeat');
t.ok((await call('announcements.comments', { id: post }, E)).data.comments.some(c => c.id === c4), 'his comments are back for her');
t.code(await call('mutes.set', { key: String(Number(key) + 100), mute: true }, E), 'NOT_FOUND', 'a key that is not hers');
const many = Array.from({ length: 200 }, (_, i) => `('6000000065', 'fake${i}', '6000000065', '2026-10-16T09:00:00+05:30')`).join(',');
DB.sql.exec(`INSERT INTO post_mutes (viewer, author, by, at) VALUES ${many}`);
t.code(await call('mutes.set', { commentId: c4, mute: true }, F), 'CONFLICT', 'at most 200 people hidden');
DB.sql.exec("DELETE FROM post_mutes WHERE author LIKE 'fake%'");

// hide a person's comments for everyone (the head)
t.code(await call('mutes.setAll', { commentId: c4, mute: true }, C), 'FORBIDDEN', 'only the head hides for everyone');
r = await call('mutes.setAll', { commentId: c4, mute: true }, M);
t.eq([r.data.muted, r.data.name], [true, 'Dhruv Rude'], 'the head hides Dhruv for everyone');
t.ok(!(await call('announcements.comments', { id: post }, F)).data.comments.some(c => c.id === c4), 'gone for everyone');
r = await call('announcements.comment', { id: post, body: 'One more' }, D);
t.eq([r.error?.code, r.error?.message], ['COMMENTS_BLOCKED', 'Comments are turned off for your account. Contact your coordinator.'], 'his new comments are refused, clearly');
t.eq((await call('announcements.comments', { id: post }, D)).data.commentsBlocked, true, 'his app knows (no comment box)');
r = await call('mutes.list', {}, M);
t.eq(r.data.everyone.map(m => [m.name, m.by]), [['Dhruv Rude', 'master']], 'the head sees who is hidden for everyone');
t.code(await call('mutes.setAll', { key: r.data.everyone[0].key, mute: false }, M), 'ok', 'and shows him again');
t.code(await call('announcements.comment', { id: post, body: 'Sorry, everyone' }, D), 'ok', 'he can comment again');
t.eq(rows("SELECT action, target FROM audit_log WHERE action LIKE 'mutes.%' ORDER BY id").map(a => [a.action, a.target]), [['mutes.hideForAll', '6000000063'], ['mutes.showForAll', '6000000063']], 'both are in the Activity log');
t.code(await call('mutes.setAll', { commentId: c4, mute: true }, M, { requestId: 'mute-all-0002' }), 'ok', 'hidden for everyone again');
t.code(await call('mutes.setAll', { commentId: c4, mute: true }, M, { requestId: 'mute-all-0003' }), 'ok', 'a repeat changes nothing');
t.eq(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'mutes.hideForAll'")[0].n, 2, '… and logs nothing');

// a deleted account takes its reports and hidden lists with it
await call('mutes.set', { commentId: c4, mute: true }, F);
await call('announcements.report', { id: post, commentId: c4, reason: 'spam' }, F);
t.code(await call('account.delete', { password: PW, confirm: 'DELETE' }, F), 'ok', 'Farhan deletes his account');
t.eq(rows("SELECT COUNT(*) AS n FROM post_mutes WHERE viewer = '6000000065' OR author = '6000000065'")[0].n + rows("SELECT COUNT(*) AS n FROM post_reports WHERE reporter = '6000000065'")[0].n, 0, 'his reports and hidden list are gone');
t.code(await call('account.delete', { password: PW, confirm: 'DELETE' }, D), 'ok', 'Dhruv deletes his');
t.eq(rows("SELECT COUNT(*) AS n FROM post_mutes WHERE author = '6000000063'")[0].n, 0, 'nobody keeps his phone on a hidden list');
t.done();
