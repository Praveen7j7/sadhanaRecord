// The submit window is a MASTER SETTING, so every message about it must say the time that is set.
//
// THE BUG. `submit_opens` / `submit_closes` have always driven the locks: windowOf() reads them and the
// server refuses a submit outside them. What did NOT read them was the WORDING. About fifteen messages
// carried "Sunday 6 PM" or "Monday 9 PM" as literal text — the submit refusal, three attendance refusals,
// the daily notification and five screens. So the head moving the window to Sunday 2 PM changed what the
// app ALLOWED and not one word of what it SAID: devotees were told the wrong time by the app that was
// enforcing the right one.
//
// This suite sets the window to a time nobody would guess and then reads the messages back. Every string a
// devotee or coordinator can see has to contain the new time and never the old default.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { windowText, windowWords, windowPart } from '../../shared/window.js';

const t = suite('submit window: the setting drives every message, not just the lock');
const { call, addAccount, DB, rows, env } = boot();

/* ───────── the formatter, on its own ───────── */

t.eq(windowText('SUN 14:00'), 'Sunday 2 PM', 'the head types "SUN 14:00" and a devotee reads "Sunday 2 PM"');
t.eq(windowText('MON 21:00'), 'Monday 9 PM', 'the shipped default still reads as it always did');
t.eq(windowText('SUN 14:30'), 'Sunday 2:30 PM', 'a half hour is kept');
t.eq(windowText('SUN 12:00'), 'Sunday noon', '12:00 is "noon", never the ambiguous "12 PM"');
t.eq(windowText('SUN 00:00'), 'Sunday midnight', '… and 00:00 is "midnight", which about half of everyone reads wrongly as noon');
t.eq(windowText('SAT 09:05'), 'Saturday 9:05 AM', 'a Saturday morning, with the minutes');
t.eq(windowText('nonsense', 'fallback'), 'fallback', 'an unreadable setting falls back rather than throwing: a hand-edited row must not break every screen');
t.eq(windowPart('SUN 14:00'), { day: 'Sunday', time: '2 PM', text: 'Sunday 2 PM' }, 'the parts are available separately');
const w2 = windowWords({ opens: 'SUN 14:00', closes: 'MON 21:00' });
t.eq(w2.fromSentence, 'You can submit from Sunday 2 PM.', 'the sentence the submit refusal uses');
t.eq(w2.rangeSentence, 'From Sunday 2 PM until Monday 9 PM.', 'the sentence the first-run card uses');
t.eq(w2.deadlinePhrase, 'Monday 9 PM deadline', 'the phrase the attendance refusals are built from');

/* ───────── and now through the server, with the window moved ───────── */

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'SPS Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'`);
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const PW = 'Devotee pass 2026';
const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali No 3, Punjabi Bagh', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const PHONE = '6000000160';
await call('auth.signUp', { phone: PHONE, name: 'Arjun Das', batchId: 'SPS', facilitator: FAC, ...CONTACT, password: PW, profile });
t.code(await call('requests.approve', { phone: PHONE, link: { noIdYet: true } }, C), 'ok', 'a devotee to try it with');
const D = (await call('auth.login', { login: PHONE, password: PW })).data.token;

// the head moves the submit window to Sunday 2 PM, through the API a real head would use
const moved = await call('settings.update', { submitWindow: { opens: 'SUN 14:00', closes: 'MON 21:00' } }, M);
t.code(moved, 'ok', 'the head moves the window to Sunday 2 PM');
t.eq(moved.data.submitWindow, { opens: 'SUN 14:00', closes: 'MON 21:00' }, 'and the Settings screen reads it back');
t.eq(rows("SELECT value FROM settings WHERE key = 'submit_opens'")[0].value, 'SUN 14:00', 'stored as the head typed it');

/* the refusal a devotee actually sees. The harness clock is Monday 5 Oct 10:00 IST, so THIS week's window
   (opens Sunday 11 Oct 14:00) has not opened yet — which is exactly the case that produces the message. */
const early = await call('week.submit', { weekId: '2026-10-05' }, D);
t.code(early, 'WINDOW_CLOSED', 'submitting before the window is refused');
t.eq(early.error.message, 'You can submit from Sunday 2 PM.',
     'and the refusal says 2 PM — the time the head set, not the "Sunday 6 PM" that used to be written into the code');
t.ok(!/6 PM/.test(early.error.message), 'with no trace of the old default');

// move it again: the message must follow, which is what proves it is read and not cached
await call('settings.update', { submitWindow: { opens: 'SUN 07:30', closes: 'MON 21:00' } }, M);
const again = await call('week.submit', { weekId: '2026-10-05' }, D);
t.eq(again.error.message, 'You can submit from Sunday 7:30 AM.', 'moved again, and the message moves with it');

/* the deadline, in the attendance refusals. Closing at Monday 17:00 puts the harness clock (Monday 10:00)
   INSIDE the window, so set a deadline already past: Sunday 09:00 of the week before. */
await call('settings.update', { submitWindow: { opens: 'SUN 07:30', closes: 'MON 10:30' } }, M);
const dl = (await call('settings.get', {}, M)).data.submitWindow;
t.eq(dl.closes, 'MON 10:30', 'the head sets a 10:30 AM deadline');

// a week whose deadline has passed under that setting
const closedWeek = '2026-09-21';
const att = await call('attendance.set', { batchId: 'SPS', weekId: closedWeek, marks: [{ login: PHONE, mark: 'P' }] }, C);
t.code(att, 'WINDOW_CLOSED', 'marking a week past its deadline is refused');
t.ok(/Monday 10:30 AM deadline/.test(att.error.message),
     `the refusal names the deadline the head set: ${JSON.stringify(att.error.message)}`);
t.ok(!/9 PM/.test(att.error.message), 'and not the old hardcoded 9 PM');

const cw = await call('weeks.setClass', { batchId: 'SPS', weekId: closedWeek, kind: 'HELD', reason: 'the window test' }, C);
t.code(cw, 'WINDOW_CLOSED', 'declaring a closed week is refused too');
t.ok(/Monday 10:30 AM deadline/.test(cw.error.message), 'with the same, correct deadline');

/* the daily notification: the Sunday words carry the deadline, so they must follow the setting as well */
const { message } = await import('../src/push.js');
await call('push.register', { endpoint: 'https://fcm.googleapis.com/fcm/send/win-1', keys: { p256dh: 'k'.repeat(80), auth: 'a'.repeat(20) } });
await call('push.subscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/win-1', keys: { p256dh: 'k'.repeat(80), auth: 'a'.repeat(20) } }, D);
// Sunday, so the reminder is the "attendance and your week" one that mentions the deadline
const SUN = new Date('2026-10-11T21:00:00+05:30');
const msg = await message({ endpoint: 'https://fcm.googleapis.com/fcm/send/win-1' },
                           { db: DB, env, now: () => SUN, login: PHONE });
t.ok(/It closes Monday 10:30 AM\./.test(msg.body), `the Sunday notification names the real deadline: ${JSON.stringify(msg.body)}`);
t.ok(!/9 PM/.test(msg.body), 'and not the old hardcoded 9 PM');

/* back to the default, and everything reads as it always did — so this change breaks nothing for a head
   who never touches the setting */
await call('settings.update', { submitWindow: { opens: 'SUN 18:00', closes: 'MON 21:00' } }, M);
const back = await call('week.submit', { weekId: '2026-10-05' }, D);
t.eq(back.error.message, 'You can submit from Sunday 6 PM.', 'put back to the default, the wording is the familiar one');

/* a nonsense setting cannot be stored, so no screen can ever be handed one */
t.code(await call('settings.update', { submitWindow: { opens: 'whenever', closes: 'MON 21:00' } }, M), 'VALIDATION',
       'a window that is not a day and a time is refused at the door');
t.eq(rows("SELECT value FROM settings WHERE key = 'submit_opens'")[0].value, 'SUN 18:00', 'and the stored setting is untouched');

t.done();
