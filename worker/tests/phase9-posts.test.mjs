// Phase 9, items 8 and 23 (the head, 9 Oct 2026): a facilitator posts to their own students, and any post can be
// scheduled — it appears, and its notification goes out, at its start, and leaves the wall at its end.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { webcrypto as wc } from 'node:crypto';
import { runAnnouncementPushes } from '../src/push.js';

const t = suite('phase 9: facilitator posts and scheduled posts');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const OTHER = (await call('meta.get', {})).data.facilitators.find(n => n !== FAC);
const join = async (phone, name, facilitator = FAC, batchId = 'SPS2') => {
  await call('auth.signUp', { phone, name, batchId, facilitator, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000091', 'Arjun Das');                    // FAC's student, SPS2
const B = await join('6000000192', 'Bhima Das', FAC, 'BSS');        // FAC's student, another batch
const X = await join('6000000193', 'Other Student', OTHER);         // another facilitator's student, SPS2
// FAC as a TRD facilitator login (no batch); OTHER as a youth facilitator (a devotee of a batch)
t.code(await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M), 'ok', 'a TRD facilitator login');
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
const F = (await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' })).data.token;
const Y = await join('6000000094', 'Youth Facilitator', FAC, 'DPS');
DB.sql.exec("UPDATE accounts SET facilitator_name = '" + OTHER.replace(/'/g, "''") + "' WHERE login = '6000000094'");
const Y2 = (await call('auth.login', { login: '6000000094', password: 'Devotee pass 2026' })).data.token;

const post = (tok, title, audience, more = {}) => call('announcements.create', { title, body: 'Hare Krishna.', audience, ...more }, tok);
const titles = async tok => (await call('announcements.list', {}, tok)).data.announcements.map(a => a.title).sort();

// ---- item 8: who may post to students, and who sees it
let r = await post(F, 'Japa retreat', ['STUDENTS']);
t.code(r, 'ok', 'a TRD facilitator posts to their students');
t.eq(r.data.announcement.audience, ['STU:' + FAC], 'stored as that facilitator\'s students');
t.code(await post(Y2, 'Youth meet', ['STUDENTS']), 'ok', 'a youth facilitator (a devotee) posts to theirs');
t.eq(await titles(A), ['Japa retreat'], 'a student sees their facilitator\'s post');
t.eq(await titles(B), ['Japa retreat'], 'also in another batch (any batch, as My students)');
t.eq(await titles(X), ['Youth meet'], 'another facilitator\'s student sees only their own facilitator\'s');
t.eq(await titles(F), ['Japa retreat'], 'the facilitator sees their own post');
t.ok((await call('announcements.list', {}, F)).data.announcements[0].audience !== null, 'and is told who it is for');
t.ok((await call('announcements.list', {}, A)).data.announcements.every(a => a.audience === null), 'a devotee is not told the audience');
t.eq((await titles(M)).length, 2, 'the head sees every post');
t.code(await post(F, 'To SPS2', ['SPS2']), 'FORBIDDEN', 'a facilitator cannot post to a batch');
t.code(await post(F, 'To all', 'ALL'), 'FORBIDDEN', 'nor to everyone');
t.code(await post(F, 'To another', ['STU:' + OTHER]), 'FORBIDDEN', 'nor to another facilitator\'s students');
t.code(await post(F, 'Mixed', ['STUDENTS', 'FAC_TRD']), 'FORBIDDEN', 'students on their own only');
t.code(await post(C, 'Coordinator', ['STUDENTS']), 'FORBIDDEN', 'a coordinator (not a facilitator) cannot use it');
t.code(await post(M, 'Head', ['STU:' + FAC]), 'FORBIDDEN', 'nor can the head');
t.code(await post(A, 'Devotee', ['STUDENTS']), 'FORBIDDEN', 'a plain devotee cannot post');
const fid = (await call('announcements.list', {}, F)).data.announcements[0].id;
t.code(await call('announcements.update', { id: fid, body: 'Changed.' }, F), 'ok', 'the facilitator edits their own post');
t.code(await call('announcements.update', { id: fid, body: 'Hijack.' }, Y2), 'FORBIDDEN', 'another facilitator cannot');
const yid = (await call('announcements.list', {}, Y2)).data.announcements.find(a => a.title === 'Youth meet').id;
t.code(await call('announcements.remove', { id: yid }, M), 'ok', 'the head removes any facilitator post');
t.eq(await titles(X), [], 'removed for the students');

// ---- item 23: scheduled posts
r = await post(C, 'Sunday feast', ['SPS2'], { publishAt: '2026-10-05T18:00:00+05:30', expiresAt: '2026-10-05T21:00:00+05:30' });
t.code(r, 'ok', 'a coordinator schedules a post for their batch');
const sid = r.data.announcement.id;
t.ok(r.data.announcement.scheduled && r.data.announcement.publishAt === '2026-10-05T18:00:00+05:30', 'it is marked scheduled, with its start');
t.ok(!(await titles(A)).includes('Sunday feast'), 'a devotee does not see it before the start');
t.ok((await call('announcements.list', {}, C)).data.announcements.find(a => a.id === sid)?.scheduled, 'its author sees it, marked scheduled');
t.ok((await call('announcements.list', {}, M)).data.announcements.find(a => a.id === sid)?.scheduled, 'the head sees it too');
t.code(await call('announcements.like', { id: sid, like: true }, C), 'NOT_FOUND', 'it cannot be liked before it starts');
const homeBefore = (await call('home.get', {}, A)).data.latestAnnouncementAt;
t.code(await post(C, 'Too far', ['SPS2'], { publishAt: '2026-12-10T18:00:00+05:30' }), 'VALIDATION', 'a start more than 60 days ahead is refused');
t.code(await post(C, 'Ends first', ['SPS2'], { publishAt: '2026-10-06T18:00:00+05:30', expiresAt: '2026-10-06T17:00:00+05:30' }), 'VALIDATION', 'an end before the start is refused');
t.code(await post(C, 'Too long', ['SPS2'], { expiresAt: '2027-02-01T00:00:00+05:30' }), 'VALIDATION', 'a length over 90 days is refused');
t.code(await post(C, 'Not for DPS', ['DPS'], { publishAt: '2026-10-06T18:00:00+05:30' }), 'FORBIDDEN', 'a coordinator schedules only for their own batches');
r = await post(C, 'Past start', ['SPS2'], { publishAt: '2026-10-05T08:00:00+05:30' });
t.ok(r.ok && !r.data.announcement.scheduled && !r.data.announcement.publishAt, 'a start already past means now');

// the phones: nothing before the start, its audience at the start, nothing after removal
const k = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await wc.subtle.exportKey('jwk', k.privateKey);
env.VAPID_PRIVATE_JWK = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
env.VAPID_PUBLIC = Buffer.from(await wc.subtle.exportKey('raw', k.publicKey)).toString('base64url'); env.VAPID_SUBJECT = 'mailto:test@example.org';
DB.sql.exec('DELETE FROM push_subs');
for (const [n, l] of [['a', '6000000091'], ['b', '6000000192'], ['x', '6000000193'], ['nobody', '']]) DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES ('https://fcm.googleapis.com/fcm/send/p9-${n}', '${l}', 'x', 'y', '')`);
DB.sql.exec(`UPDATE push_jobs SET state = 'DONE' WHERE ann_id <> ${sid}`);
const sent = [], f0 = globalThis.fetch;
globalThis.fetch = async (url, opt) => { if (String(url).includes('/p9-')) { sent.push(String(url).split('/p9-')[1]); return { ok: true, status: 201, json: async () => ({}) }; } return f0(url, opt); };
const drain = async () => { sent.length = 0; for (let i = 0; i < 5; i++) await runAnnouncementPushes(env, DB, new Date(clock.now)); return [...sent].sort(); };
t.eq(await drain(), [], 'no notification before the start');
// an edit moves the time
t.code(await call('announcements.update', { id: sid, publishAt: '2026-10-05T19:00:00+05:30' }, C), 'ok', 'the author moves the start');
at('2026-10-05T18:30:00');
t.eq(await drain(), [], 'the old start passes: still nothing');
t.ok(!(await titles(A)).includes('Sunday feast'), 'and still not on the wall');
at('2026-10-05T19:00:30');
t.ok((await titles(A)).includes('Sunday feast'), 'at the start it is on the wall for its batch');
t.ok(!(await titles(B)).includes('Sunday feast'), 'not for another batch');
t.eq(await drain(), ['a', 'x'], 'and its notification goes to that batch\'s phones only');
t.ok((await call('home.get', {}, A)).data.latestAnnouncementAt > (homeBefore || ''), 'the bell counts it from its start');
t.code(await call('announcements.update', { id: sid, publishAt: '2026-10-07T19:00:00+05:30' }, C), 'VALIDATION', 'a post already on the wall cannot be scheduled again');
at('2026-10-05T21:00:30');
t.ok(!(await titles(A)).includes('Sunday feast'), 'gone at its end');
t.ok(rows(`SELECT removed_at FROM announcements WHERE id = ${sid}`)[0].removed_at === '', 'kept, not removed, for the record');

// "Post now", and a removed scheduled post never notifies
r = await post(M, 'Kartik deepotsav', 'ALL', { publishAt: '2026-10-06T18:00:00+05:30' });
const nid = r.data.announcement.id;
r = await post(M, 'Cancelled class', 'ALL', { publishAt: '2026-10-06T18:00:00+05:30' });
const cid = r.data.announcement.id;
DB.sql.exec(`UPDATE push_jobs SET state = 'DONE' WHERE ann_id NOT IN (${nid}, ${cid})`);
t.code(await call('announcements.update', { id: nid, publishAt: null }, M), 'ok', 'Post now');
t.ok((await titles(A)).includes('Kartik deepotsav'), 'it is on the wall at once');
t.code(await call('announcements.remove', { id: cid }, M), 'ok', 'a scheduled post removed');
t.eq(await drain(), ['a', 'b', 'nobody', 'x'], 'Post now notifies at once (everyone); the removed one is not sent');
at('2026-10-06T18:01:00');
t.eq(await drain(), [], 'and the removed post never notifies at its start');
t.eq(rows(`SELECT state FROM push_jobs WHERE ann_id = ${cid}`)[0].state, 'DONE', 'its job is closed');

// a facilitator schedules for their students
r = await post(F, 'Japa morning', ['STUDENTS'], { publishAt: '2026-10-07T05:00:00+05:30' });
t.ok(r.ok && r.data.announcement.scheduled, 'a facilitator schedules for their students');
t.ok(!(await titles(A)).includes('Japa morning'), 'their student does not see it yet');
at('2026-10-07T05:00:30');
t.eq(await drain(), ['a', 'b'], 'at the start, only their students\' phones (two batches)');

// ---- item 18: how far a post reached (author and head only)
DB.sql.exec('DELETE FROM push_subs');
for (const [n, l] of [['ok1', '6000000091'], ['ok2', '6000000192'], ['gone', '6000000193'], ['fail', '']]) DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES ('https://fcm.googleapis.com/fcm/send/r9-${n}', '${l}', 'x', 'y', '')`);
DB.sql.exec("UPDATE push_jobs SET state = 'DONE'");
globalThis.fetch = async (url, opt) => { const u = String(url); if (u.includes('/r9-')) { const st = u.endsWith('gone') ? 410 : u.endsWith('fail') ? 500 : 201; return { ok: st < 300, status: st, json: async () => ({}) }; } return f0(url, opt); };
r = await post(M, 'Reach check', 'ALL');
const rid = r.data.announcement.id;
const reachOf = async tok => (await call('announcements.list', {}, tok)).data.announcements.find(a => a.id === rid)?.reach;
t.eq((await reachOf(M)) && { done: (await reachOf(M)).done, tried: (await reachOf(M)).tried }, { done: false, tried: 0 }, 'before sending: not done, nothing tried');
for (let i = 0; i < 3; i++) await runAnnouncementPushes(env, DB, new Date(clock.now));
const rr = await reachOf(M);
t.eq({ done: rr.done, tried: rr.tried, sent: rr.sent, gone: rr.gone, failed: rr.failed }, { done: true, tried: 4, sent: 2, gone: 1, failed: 1 }, 'after: sent to 2 of 4 phones, 1 no longer reachable, 1 failed');
t.ok(!!rr.doneAt, 'with when it finished');
t.ok((await reachOf(A)) === undefined, 'a devotee is not given the reach');
t.ok((await reachOf(C)) === undefined, 'nor a coordinator who did not write it');
t.eq(rows("SELECT COUNT(*) AS n FROM push_subs WHERE endpoint LIKE '%r9-gone'")[0].n, 0, 'the gone phone is removed, as before');
globalThis.fetch = f0;
t.done();
