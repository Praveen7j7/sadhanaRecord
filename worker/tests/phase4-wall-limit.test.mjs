// Audit F9 / roadmap 4.5 (13 Oct 2026): the wall's audience test belongs in the query, not after it.
//
// visible() used to read the newest 200 unexpired posts and THEN drop the ones outside the caller's audience. Once
// the wall holds more than 200 unexpired posts, a devotee whose batch's posts are older than that cut-off sees
// fewer than their limit — or an empty wall — and announcements.image, like and comment, which look a post up
// through the same list, answer NOT_FOUND for a post that plainly exists.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('phase 4: the wall counts posts the caller can see');
const { call, addAccount, DB, rows } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
await call('auth.signUp', { phone: '6000000191', name: 'Devotee Wall', batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });
await call('requests.approve', { phone: '6000000191', link: { noIdYet: true } }, C);
const D = (await call('auth.login', { login: '6000000191', password: 'Devotee pass 2026' })).data.token;

// One post for the devotee's batch, then 230 posts for a DIFFERENT batch on top of it. With the old code the
// devotee's own post is pushed past the 200-row cut-off and vanishes.
// `shown_at` is computed in the query (publish_at or created_at), so only created_at is set here
const put = (audience, at) => DB.sql.prepare(
  `INSERT INTO announcements (title, body, audience, author_login, author_name, pinned, created_at, updated_at, publish_at, expires_at, removed_at)
   VALUES (?, 'x', ?, 'sps', 'Sps Coordinator', 0, ?, ?, '', '', '')`).run('Post ' + at, audience, at, at);
put('SPS', '2026-09-01T10:00:00+05:30');
for (let i = 0; i < 230; i++) put('DPS', `2026-10-0${1 + (i % 9)}T10:${String(i % 60).padStart(2, '0')}:00+05:30`);
t.eq(rows("SELECT COUNT(*) AS n FROM announcements")[0].n, 231, '231 unexpired posts on the wall');

const mine = (await call('announcements.list', {}, D)).data.announcements;
t.ok(mine.length > 0, `the devotee still sees their batch's post (${mine.length} post(s))`);
// a devotee is not told a post's audience (announcements.js:43), so the check is on WHICH posts arrive: exactly
// the one addressed to their batch, none of the 230 addressed to DPS
t.eq(mine.length, 1, 'the devotee sees exactly their own batch\'s post, not a page of other batches\'');
const own = mine[0];
t.eq(own.title, 'Post 2026-09-01T10:00:00+05:30', 'the one SPS post is there even though 230 newer posts are not for them');
t.eq(own.audience, null, '… and its audience is not disclosed to them');

// and the actions that look a post up through the same list still find it
t.code(await call('announcements.like', { id: own.id, like: true }, D), 'ok', '… and can be liked');
t.code(await call('announcements.comment', { id: own.id, body: 'Hare Krishna' }, D), 'ok', '… and commented on');

// the coordinator who wrote them sees their own, the head sees everything
const head = (await call('announcements.list', {}, M)).data.announcements;
t.ok(head.length >= 20, `the head sees the wall (${head.length} posts, capped by the page limit)`);
// for a head the audience comes back as a list of batch ids (announcements.js:43)
const dps = head.filter((a) => Array.isArray(a.audience) && a.audience.includes('DPS')).length;
t.ok(dps > 0, '… including the DPS posts');

t.done();
