// The announcement wall: who can post where, who sees what, edits and removals.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';

const t = suite('announcements: the wall');
const { call, rows, addAccount, DB } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026', { name: 'IYF Head' });
DB.sql.exec("UPDATE accounts SET is_master = 1 WHERE login = 'master'");
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const join = async (phone, batchId) => {
  await call('auth.signUp', { phone, name: batchId === 'DPS' ? 'Dps Devotee' : 'Sps Devotee', batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const S = await join('6000000051', 'SPS2'), D = await join('6000000152', 'DPS');
await call('coordinators.update', { username: '6000000051', batchIds: ['SPS2'] }, M);    // the SPS2 devotee also coordinates SPS2
const C = (await call('auth.login', { login: '6000000051', password: 'Devotee pass 2026' })).data.token;

let r = await call('announcements.create', { title: 'Kartik camp', body: 'Register by 10 Oct.', audience: 'ALL', pinned: true }, M);
t.ok(r.ok && r.data.announcement.audience === 'ALL', 'the master posts to everyone');
t.code(await call('announcements.create', { title: 'Class moved', body: 'Sunday class at 5 PM.', audience: 'ALL' }, C), 'VALIDATION', 'a coordinator cannot post to everyone');
t.code(await call('announcements.create', { title: 'Class moved', body: 'Sunday class at 5 PM.', audience: ['DPS'] }, C), 'FORBIDDEN', 'nor to a batch he does not coordinate');
r = await call('announcements.create', { title: 'SPS2 class moved', body: 'Sunday class at 5 PM.', audience: ['SPS2'] }, C);
t.ok(r.ok, 'he posts to his own batch');
const id = r.data.announcement.id;
t.code(await call('announcements.create', { title: 'x', body: '' }, C), 'VALIDATION', 'title and text required');
t.code(await call('announcements.create', { title: 'Hello', body: 'Hi' , audience: ['SPS2'] }, D), 'FORBIDDEN', 'a plain devotee cannot post');

const titles = async tok => (await call('announcements.list', {}, tok)).data.announcements.map(a => a.title);
t.eq(await titles(S), ['Kartik camp', 'SPS2 class moved'], 'an SPS2 devotee sees everyone\'s post (pinned first) and his batch\'s');
t.eq(await titles(D), ['Kartik camp'], 'a DPS devotee does not see the SPS2 post');
t.eq((await titles(M)).length, 2, 'the master sees all');
t.ok((await call('home.get', {}, D)).data.latestAnnouncementAt, 'home.get carries the newest post time for the bell');
t.ok(!(await call('announcements.list', {}, D)).data.announcements[0].canEdit, 'a devotee cannot edit');
t.ok((await call('announcements.list', {}, D)).data.announcements.every(a => a.audience === null), 'a devotee is not told who a post is for (staff only)');
t.ok((await call('announcements.list', {}, M)).data.announcements.every(a => a.audience !== null), 'staff see it');
t.code(await call('announcements.update', { id, body: 'Sunday class at 6 PM.' }, C), 'ok', 'the author edits his post');
t.code(await call('announcements.update', { id, title: 'Hijack' }, D), 'FORBIDDEN', 'a devotee cannot edit it');
t.code(await call('announcements.remove', { id }, M), 'ok', 'a master can remove any post');
t.eq(await titles(S), ['Kartik camp'], 'removed posts disappear');
t.eq(rows("SELECT COUNT(*) n FROM announcements WHERE removed_at <> ''")[0].n, 1, 'but are kept, marked removed');
t.eq(rows("SELECT action FROM audit_log WHERE action LIKE 'announcements.%' ORDER BY id").map(a => a.action), ['announcements.create', 'announcements.create', 'announcements.update', 'announcements.remove'], 'every post, edit and removal is audited');
r = await call('announcements.create', { title: 'Old news', body: 'Gone soon.', audience: 'ALL', expiresAt: '2020-01-01T00:00:00+05:30' }, M);
t.ok(!(await titles(S)).includes('Old news'), 'expired posts are not shown');
// ---- a picture with a post
const jpeg = (w, h, pad = 0) => { const b = new Uint8Array(20 + pad); b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255]); return Buffer.from(b).toString('base64'); };
t.code(await call('announcements.create', { title: 'Big poster', body: 'x', audience: 'ALL', image: jpeg(3000, 2000) }, M), 'VALIDATION', 'a picture over 1600 px is refused (the app shrinks it first)');
t.code(await call('announcements.create', { title: 'Heavy poster', body: 'x', audience: 'ALL', image: jpeg(800, 600, 250 * 1024) }, M), 'VALIDATION', 'and over 240 KB');
let rp = await call('announcements.create', { title: 'Rath Yatra poster', body: 'Details: https://iskcon.example/rath', audience: ['DPS'], image: jpeg(1200, 900) }, M);
t.eq(rp.data.announcement.image && [rp.data.announcement.image.w, rp.data.announcement.image.h], [1200, 900], 'a post with a picture: its size comes with the post (no layout jump)');
const pid = rp.data.announcement.id;
t.eq(rows('SELECT ann_id FROM push_jobs ORDER BY id DESC LIMIT 1')[0].ann_id, pid, 'its notification job points at it, picture or not');
t.eq((await call('announcements.image', { id: pid }, D)).data.jpegBase64, jpeg(1200, 900), 'its audience gets the picture when it scrolls into view');
t.code(await call('announcements.image', { id: pid }, S), 'NOT_FOUND', 'someone outside its audience does not');
rp = await call('announcements.update', { id: pid, image: null }, M);
t.eq(rp.data.announcement.image, null, 'the picture can be removed');
t.eq((await call('announcements.update', { id: pid, image: jpeg(640, 640) }, M)).data.announcement.image.w, 640, 'or replaced');

// ---- posts like social media: likes and comments (4 Oct 2026)
{
  const posts = (await call('announcements.list', {}, D)).data.announcements, all = posts.find(p => p.title === 'Kartik camp') || posts[0];
  t.eq([all.likes, all.liked, all.comments], [0, false, 0], 'each post comes with likes, whether I liked it, and comments');
  t.eq((await call('announcements.like', { id: all.id, like: true }, D)).data, { likes: 1, liked: true, comments: 0 }, 'a devotee likes a post');
  t.eq((await call('announcements.like', { id: all.id, like: true }, D)).data.likes, 1, 'liking again changes nothing');
  t.eq((await call('announcements.like', { id: all.id, like: true }, M)).data.likes, 2, 'the head likes it too');
  t.eq((await call('announcements.like', { id: all.id, like: false }, D)).data, { likes: 1, liked: false, comments: 0 }, 'unlike');
  let c = await call('announcements.comment', { id: all.id, body: '  Hare Krishna, I will come!  ' }, D);
  t.eq([c.data?.comment?.body, c.data?.comment?.mine, c.data?.comments], ['Hare Krishna, I will come!', true, 1], 'a comment, trimmed');
  t.code(await call('announcements.comment', { id: all.id, body: '   ' }, D), 'VALIDATION', 'not an empty comment');
  t.code(await call('announcements.comment', { id: all.id, body: 'x'.repeat(501) }, D), 'VALIDATION', 'at most 500 characters');
  const c2 = await call('announcements.comment', { id: all.id, body: 'See you there.' }, C);
  const list = (await call('announcements.comments', { id: all.id }, D)).data.comments;
  t.eq(list.map(x => [x.body, x.mine, x.canRemove]), [['Hare Krishna, I will come!', true, true], ['See you there.', false, false]], 'comments, oldest first; one removes only one\'s own');
  t.code(await call('announcements.uncomment', { commentId: c2.data.comment.id }, D), 'FORBIDDEN', 'not someone else\'s comment');
  t.code(await call('announcements.uncomment', { commentId: c2.data.comment.id }, M), 'ok', 'the head removes any comment');
  t.eq((await call('announcements.list', {}, D)).data.announcements.find(p => p.id === all.id).comments, 1, 'the count follows');
  const sps2 = (await call('announcements.list', {}, C)).data.announcements.find(p => p.title === 'SPS2 class moved');
  if (sps2) t.code(await call('announcements.like', { id: sps2.id, like: true }, D), 'NOT_FOUND', 'one cannot like a post one cannot see (another batch\'s)');
}
t.done();
