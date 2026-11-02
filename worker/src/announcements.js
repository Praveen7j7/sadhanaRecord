// The announcement wall (in-app only, decision 15). Plain text; the app never renders it as HTML.
//   · masters post to everyone ('ALL') or to chosen batches; coordinators only to batches they coordinate
//   · a person sees what was posted for everyone, for their own batch, or for a batch they coordinate (masters: all)
//   · the author or a master can edit, pin or remove a post; removals are kept (removed_at) and audited
//   · posts like social media (the head, 4 Oct 2026): anyone who sees a post can like it and comment; the writer, the
//     post's author or a master removes a comment; counts come with the list (the likes are counted, never copied row by row)
//   · moderation (the store rules, 8 Oct 2026): anyone reports a post or comment (once per item); the IYF head sees the open
//     reports and dismisses them or removes the item; anyone hides a person's comments for themselves (mutes), and the
//     head for everyone (that person's new comments are then refused). Posts themselves are never hidden by a mute
//   · a facilitator posts to their own students (Phase 9, item 8): the audience 'STU:<facilitator id>' (by name until
//     Phase 24, migration 0074), the same people as "My students" (any batch); only that facilitator can use it. It is
//     shown as 'STU:<their name as it is now>', so the reply reads as it always did and follows a rename
//   · the author's and a commenter's name are read from their account as it is now (the text stored with the post is
//     what it was written under, and is shown only when the account is gone)
//   · scheduled posts (Phase 9, item 23): publish_at ('' = at once) — until then only its author and the head see it
//     (scheduled: true) and no notification goes out; it ends at expires_at. Times are the server's, never the phone's
import { apiError, invalid, isoIst, parseIso, csv } from './util.js';
import { q, one, all, run, batchesAll, audit, dirty, currentMembership } from './db.js';
import { queueAnnouncement } from './push.js';
import { myFacId } from './names.js';
import { checkJpeg } from './image.js';

const LIMIT = 50;
export const REPORT_REASONS = ['spam', 'abusive', 'inappropriate', 'other'];
export const MAX_MUTES = 200;
const EVERYONE = '*';                // post_mutes.viewer for a person the IYF head hid for everyone
/** SQL: the comment `c` is shown to the viewer (two bound parameters, the viewer's login twice): its writer is not hidden
 *  for them or for everyone. The writer always sees their own. */
const SHOWN = "(c.login = ? OR NOT EXISTS (SELECT 1 FROM post_mutes m WHERE m.author = c.login AND m.viewer IN (?, '*')))";
const myBatches = ctx => [...new Set([...(ctx.scopes.devotee ? [ctx.scopes.devotee.batchId] : []), ...ctx.scopes.coordinator])];
// facilitator audiences (the head, 9 Oct 2026): youth facilitators (devotees who are facilitators) and TRD facilitators
// (facilitator logins with no batch); together every facilitator. Kept in `audience` beside batch ids.
export const FAC_AUDIENCES = { FAC_YOUTH: 'Youth facilitators', FAC_TRD: 'TRD facilitators' };
// a facilitator's students (Phase 9, item 8): the tag carries the facilitator's permanent id (Phase 24; it carried the
// name until migration 0074 rewrote those posts, and a comma in a name was written ';')
export const stuTag = facId => 'STU:' + String(facId || '');
const myGroups = async ctx => {
  const m = ctx.scopes.devotee ? await currentMembership(ctx.db, ctx.login) : null;     // (remembered for the request)
  /*
   * A training is ENROLLED, not joined (17 Oct 2026), so an ETP student's membership names their own
   * SPS or DPS batch and never the training. Without this a post to ETP-21 reached nobody at all:
   * its coordinator could write one and not a single student would see it.
   */
  const tr = await all(ctx.db, "SELECT batch_id FROM enrolments WHERE login = ? AND state = 'ACTIVE'", ctx.login);
  return [...(!ctx.scopes.facilitator ? [] : [ctx.scopes.devotee || ctx.acct?.role === 'DEVOTEE' ? 'FAC_YOUTH' : 'FAC_TRD']),
          ...(m?.fac_id ? [stuTag(m.fac_id)] : []),
          ...tr.map(x => x.batch_id)];
};
/** May post: the IYF head, a coordinator, or a facilitator (to their students). */
const canPost = ctx => !!(ctx.scopes.master || ctx.scopes.coordinator.length || ctx.scopes.facilitator);
const DAY_MS = 864e5, AHEAD_DAYS = 60, LENGTH_DAYS = 90;
const view = (a, ctx) => ({
  // who a post is for is shown to staff only (the head, 4 Oct 2026): a devotee gets no audience
  // (and to a post's own author, e.g. a facilitator, who sees "To: your students")
  id: a.id, title: a.title, body: a.body, audience: !(ctx.scopes.master || ctx.scopes.coordinator.length || a.author_login === ctx.login) ? null : a.audience === 'ALL' ? 'ALL' : csv(a.stu_shown || a.audience), pinned: !!a.pinned,
  expiresAt: a.expires_at || null, author: a.author_now || a.author_name, createdAt: a.created_at, updatedAt: a.updated_at,
  // when it shows (its start, or when it was written), and whether it is still waiting to start
  publishAt: a.publish_at || null, shownAt: a.shown_at || a.created_at, scheduled: !!a.scheduled,
  canEdit: a.author_login === ctx.login || ctx.scopes.master,
  // the picture, if any: its size (so the app keeps its space before it loads) and a version for the phone's cache
  image: a.img_w ? { w: a.img_w, h: a.img_h, v: a.img_at } : null
});
// the author's name now (their account), and a post to "my students" named by its facilitator as they are now — read in
// the same statement (two keyed lookups a post), so the wall costs no extra round trip
const WITH_IMAGE = `SELECT a.*, max(a.created_at, a.publish_at) AS shown_at, i.w AS img_w, i.h AS img_h, i.updated_at AS img_at, au.name AS author_now,
    CASE WHEN a.audience LIKE 'STU:%' THEN (SELECT 'STU:' || replace(f."name", ',', ';') FROM facilitators f WHERE f.id = substr(a.audience, 5)) END AS stu_shown
  FROM announcements a LEFT JOIN announcement_images i ON i.ann_id = a.id LEFT JOIN accounts au ON au.login = a.author_login`;
const one1 = async (ctx, id) => { const a = await one(ctx.db, `${WITH_IMAGE} WHERE a.id = ?`, id); if (a) a.scheduled = !!a.publish_at && a.publish_at > isoIst(ctx.now()); return a; };

/** A picture for a post: JPEG only, 64–1600 px a side, at most 240 KB (the app shrinks any photo first). */
const MAX_IMG = 240 * 1024;
const imageOf = (b64) => checkJpeg(b64, { path: 'image', maxBytes: MAX_IMG, min: 64, max: 1600,
  tooBig: 'The picture must be a JPEG of at most 240 KB.', wrongSize: 'The picture must be 64 to 1600 pixels a side.' });
const putImage = (db, img, at) => q(db, `INSERT INTO announcement_images (ann_id, jpeg, bytes, w, h, updated_at) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?)`, img.s, img.bytes, img.w, img.h, at);
const setImage = (db, id, img, at) => q(db, `INSERT INTO announcement_images (ann_id, jpeg, bytes, w, h, updated_at) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(ann_id) DO UPDATE SET jpeg = excluded.jpeg, bytes = excluded.bytes, w = excluded.w, h = excluded.h, updated_at = excluded.updated_at`, id, img.s, img.bytes, img.w, img.h, at);

/** What the caller may see, newest first (pinned on top). Also used by home.get for the unread badge. With `scheduled`,
 *  also the posts not started yet that the caller wrote (the head: all of them), marked scheduled (the Wall only). */
/**
 * The wall's query as a statement plus the step that reads its rows (22 Oct 2026), so home.get can send it in its one
 * batch. visible() runs the two together and answers exactly as it did.
 */
export async function visibleQuery(ctx, limit = LIMIT, { scheduled = false } = {}) {
  const now = isoIst(ctx.now()), mine = [...myBatches(ctx), ...(await myGroups(ctx))];
  // The audience test is in the SQL, not applied afterwards (13 Oct 2026, audit F9). It used to read the newest
  // 200 posts and THEN filter: once the wall holds more than 200 unexpired posts, a devotee whose batch's posts
  // are older than that cut-off sees fewer than their limit — or an empty wall — and `announcements.image` and
  // the like and comment actions, which look the post up through this same list, start answering NOT_FOUND for a
  // post that plainly exists. With the predicate in the query, the LIMIT counts posts the caller can actually see.
  //
  // `audience` is stored as 'ALL' or a comma-separated list of batch ids and STU:<facilitator> keys, so a batch is
  // matched on the whole-field equality or as a comma-delimited substring — the same test csv(...).includes() did,
  // expressed in SQL. A master sees everything; an author always sees their own.
  const forMe = mine.length
    ? `OR a.audience = 'ALL' OR ${mine.map(() => "(',' || a.audience || ',') LIKE ?").join(' OR ')}`
    : "OR a.audience = 'ALL'";
  const stmt = q(ctx.db, `${WITH_IMAGE} WHERE a.removed_at = '' AND (a.expires_at = '' OR a.expires_at > ?)
      AND (? = 1 OR a.author_login = ? ${forMe})
      ORDER BY a.pinned DESC, shown_at DESC LIMIT ?`,
    now, ctx.scopes.master ? 1 : 0, ctx.login, ...mine.map(b => `%,${b},%`), Math.min(limit * 2, 400));
  // scheduled posts are still sorted out here: whether one is "not started yet" depends on the clock, and only
  // its author (or the head) may see it at all
  const finish = (rows) => rows.map(a => ({ ...a, scheduled: !!a.publish_at && a.publish_at > now }))
    .filter(a => (a.scheduled ? scheduled && (a.author_login === ctx.login || ctx.scopes.master) : true))
    .slice(0, limit);
  return { stmt, finish };
}
export async function visible(ctx, limit = LIMIT, opts = {}) {
  const v = await visibleQuery(ctx, limit, opts);
  return v.finish((await v.stmt.all()).results);
}

/** How far each post's notification reached (Phase 9, item 18), for the posts the caller may edit (its author, the head). */
async function reach(ctx, rows) {
  const ids = rows.filter(a => a.author_login === ctx.login || ctx.scopes.master).map(a => a.id);
  if (!ids.length) return () => null;
  const jobs = await all(ctx.db, `SELECT ann_id, state, tried, sent, gone, failed, done_at FROM push_jobs WHERE ann_id IN (${ids.map(() => '?').join(',')})`, ...ids);
  const by = Object.fromEntries(jobs.map(j => [j.ann_id, { done: j.state === 'DONE', tried: j.tried, sent: j.sent, gone: j.gone, failed: j.failed, doneAt: j.done_at || null }]));
  return id => by[id] || null;
}
export async function list(d, ctx) {
  const rows = await visible(ctx, LIMIT, { scheduled: true }), ids = rows.map(a => a.id), [soc, r] = await Promise.all([social(ctx, ids), reach(ctx, rows)]);
  return { announcements: rows.map(a => ({ ...view(a, ctx), ...soc(a.id), ...(r(a.id) ? { reach: r(a.id) } : {}) })), latestAt: rows.filter(a => !a.scheduled).reduce((m, a) => (a.shown_at > m ? a.shown_at : m), '') || null,
           canReport: true, canPost: canPost(ctx) };
}

/**
 * One post by its id, for a shared link (13 October 2026; audit FE-17 / roadmap 4.5).
 *
 * The wall shows the 50 newest posts a person may see, so a WhatsApp link to anything older — which is exactly the
 * link people keep and forward — landed on the wall with "That post is no longer on the wall" for a post that is
 * perfectly alive. This fetches that one post, through the SAME visibility rule as the list (the audience test is
 * in the query, so no unexpired post is hidden merely by being old), and the app inserts it at the top when the
 * link names a post the list did not carry.
 */
export async function get(d, ctx) {
  const id = Number(d.id);
  if (!Number.isInteger(id) || id < 1) throw invalid({ path: 'id', message: 'Not a post.' });
  // `limit` is the whole visible set rather than a page: the point is to reach a post the page did not include.
  // The audience predicate is in the SQL, so this is one indexed read, not a scan of the wall.
  const rows = await visible(ctx, 10000, { scheduled: true });
  const a = rows.find(x => x.id === id);
  if (!a) throw apiError('NOT_FOUND', 'That announcement is not there any more.');
  const [soc, r] = await Promise.all([social(ctx, [id]), reach(ctx, [a])]);
  return { announcement: { ...view(a, ctx), ...soc(id), ...(r(id) ? { reach: r(id) } : {}) }, canReport: true };
}

/** Likes, whether the caller liked, and comments (those shown to the caller), for these posts (three small reads by the posts' ids). */
async function social(ctx, ids) {
  if (!ids.length) return () => ({ likes: 0, liked: false, comments: 0 });
  const marks = ids.map(() => '?').join(',');
  const [likes, mine, comments] = await Promise.all([
    all(ctx.db, `SELECT ann_id, COUNT(*) AS n FROM post_likes WHERE ann_id IN (${marks}) GROUP BY ann_id`, ...ids),
    all(ctx.db, `SELECT ann_id FROM post_likes WHERE login = ? AND ann_id IN (${marks})`, ctx.login, ...ids),
    all(ctx.db, `SELECT c.ann_id, COUNT(*) AS n FROM post_comments c WHERE c.ann_id IN (${marks}) AND c.removed_at = '' AND ${SHOWN} GROUP BY c.ann_id`, ...ids, ctx.login, ctx.login)]);
  const L = Object.fromEntries(likes.map(r => [r.ann_id, r.n])), M = new Set(mine.map(r => r.ann_id)), C = Object.fromEntries(comments.map(r => [r.ann_id, r.n]));
  return id => ({ likes: L[id] || 0, liked: M.has(id), comments: C[id] || 0 });
}
/** The post, if the caller can see it (else NOT_FOUND: one can only like or comment on what one sees). */
async function seen(ctx, id) {
  const a = (await visible(ctx, 200)).find(x => x.id === Number(id));
  if (!a) throw apiError('NOT_FOUND', 'That post is not there any more.');
  return a;     // (a post not started yet is not liked, commented on or reported)
}
/** announcements.like: like (true) or unlike (false). */
export async function like(d, ctx) {
  if (typeof d.like !== 'boolean') throw invalid({ path: 'like', message: 'true or false.' });
  const a = await seen(ctx, d.id);
  await (d.like ? q(ctx.db, 'INSERT OR IGNORE INTO post_likes (ann_id, login, at) VALUES (?, ?, ?)', a.id, ctx.login, isoIst(ctx.now())).run()
               : q(ctx.db, 'DELETE FROM post_likes WHERE ann_id = ? AND login = ?', a.id, ctx.login).run());
  return (await social(ctx, [a.id]))(a.id);
}
const commentView = (c, ctx, a) => ({ id: c.id, name: c.name_now || c.name, body: c.body, at: c.at, mine: c.login === ctx.login, canRemove: c.login === ctx.login || a.author_login === ctx.login || !!ctx.scopes.master });
/** announcements.comments: the comments of a post, oldest first (at most 200), without those of people the caller hid
 *  (or the IYF head hid for everyone). commentsBlocked: the caller's own comments are turned off. */
export async function comments(d, ctx) {
  const a = await seen(ctx, d.id);
  // the writer's name as it is now (their account, same statement); the stored text only when the account is gone
  const rows = await all(ctx.db, `SELECT c.*, w.name AS name_now FROM post_comments c LEFT JOIN accounts w ON w.login = c.login
                                   WHERE c.ann_id = ? AND c.removed_at = '' AND ${SHOWN} ORDER BY c.id LIMIT 200`, a.id, ctx.login, ctx.login);
  return { comments: rows.map(c => commentView(c, ctx, a)), canReport: true, commentsBlocked: await commentsBlocked(ctx.db, ctx.login) };
}
const commentsBlocked = async (db, login) => !!(await one(db, 'SELECT 1 AS x FROM post_mutes WHERE viewer = ? AND author = ?', EVERYONE, login));
/** announcements.comment: a comment, plain text, 1 to 500 characters. */
export async function comment(d, ctx) {
  const a = await seen(ctx, d.id), body = String(d.body ?? '').replace(/\r/g, '').trim();
  if (!body || body.length > 500) throw invalid({ path: 'body', message: 'Write a comment of at most 500 characters.' });
  if (await commentsBlocked(ctx.db, ctx.login)) throw apiError('COMMENTS_BLOCKED', 'Comments are turned off for your account. Contact your coordinator.');
  const at = isoIst(ctx.now()), r = await q(ctx.db, 'INSERT INTO post_comments (ann_id, login, name, body, at) VALUES (?, ?, ?, ?, ?)', a.id, ctx.login, ctx.name, body, at).run();
  return { comment: commentView({ id: r.meta.last_row_id, login: ctx.login, name: ctx.name, body, at }, ctx, a), ...(await social(ctx, [a.id]))(a.id) };
}
/** announcements.uncomment: removes a comment (its writer, the post's author or a master); kept with removed_at. */
export async function uncomment(d, ctx, req) {
  const c = await one(ctx.db, "SELECT * FROM post_comments WHERE id = ? AND removed_at = ''", Number(d.commentId));
  if (!c) throw apiError('NOT_FOUND', 'That comment is not there any more.');
  const a = await seen(ctx, c.ann_id);
  if (!(c.login === ctx.login || a.author_login === ctx.login || ctx.scopes.master)) throw apiError('FORBIDDEN', 'Only its writer, the post\'s author or the IYF head can remove a comment.');
  await ctx.db.batch([q(ctx.db, 'UPDATE post_comments SET removed_at = ? WHERE id = ?', isoIst(ctx.now()), c.id),
    ...(c.login !== ctx.login ? [audit(ctx.db, ctx, 'announcements.uncomment', c.login, '', { body: c.body }, null, '', req.requestId)] : [])]);
  return (await social(ctx, [a.id]))(a.id);
}

async function audienceOf(ctx, audience) {
  // a facilitator's students: asked for as ['STUDENTS'] (or the tag itself); only the facilitator, and on its own
  // (their own tag, by id; the tag as it is SHOWN — 'STU:<their name>' — is accepted too, as before)
  const stu = ctx.scopes.facilitator && myFacId(ctx) ? stuTag(myFacId(ctx)) : '';
  const shown = ctx.scopes.facilitator ? 'STU:' + String(ctx.scopes.facilitator.name || '').replace(/,/g, ';') : '';
  if (Array.isArray(audience) && audience.some(x => x === 'STUDENTS' || String(x).startsWith('STU:'))) {
    if (!stu) throw apiError('FORBIDDEN', 'Only a facilitator can post to their students.');
    if (audience.length !== 1 || !(audience[0] === 'STUDENTS' || audience[0] === stu || audience[0] === shown)) throw apiError('FORBIDDEN', 'A facilitator posts only to their own students, on their own.');
    return stu;
  }
  if (!ctx.scopes.master && !ctx.scopes.coordinator.length) throw apiError('FORBIDDEN', 'A facilitator posts to their own students.');
  if (audience === 'ALL') {
    if (!ctx.scopes.master) throw invalid({ path: 'audience', message: 'Only a master can post to everyone. Choose your batch.' });
    return 'ALL';
  }
  if (!Array.isArray(audience) || !audience.length) throw invalid({ path: 'audience', message: 'Choose who should see it.' });
  const known = (await batchesAll(ctx.db)).map(b => b.batch_id), ids = [...new Set(audience.map(String))];
  for (const id of ids) {
    if (FAC_AUDIENCES[id]) {
      if (!ctx.scopes.master) throw apiError('FORBIDDEN', 'Only the IYF head can post to facilitators.');
      continue;
    }
    if (!known.includes(id)) throw invalid({ path: 'audience', message: `Unknown batch ${id}.` });
    if (!ctx.scopes.master && !ctx.scopes.coordinator.includes(id)) throw apiError('FORBIDDEN', `You can post only to the batches you coordinate (${id} is not one).`);
  }
  return ids.join(',');
}
function text(d, partial) {
  const out = {}, problems = [];
  if (!partial || d.title !== undefined) {
    const t = String(d.title ?? '').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 80) problems.push({ path: 'title', message: 'A title of 2 to 80 characters.' }); else out.title = t;
  }
  if (!partial || d.body !== undefined) {
    const b = String(d.body ?? '').replace(/\r\n/g, '\n').trim();
    if (b.length < 1 || b.length > 1000) problems.push({ path: 'body', message: 'Write the announcement (at most 1,000 characters).' }); else out.body = b;
  }
  if (d.pinned !== undefined) { if (typeof d.pinned !== 'boolean') problems.push({ path: 'pinned', message: 'Yes or no.' }); else out.pinned = d.pinned ? 1 : 0; }
  if (d.publishAt !== undefined) {
    if (d.publishAt === null || d.publishAt === '') out.publish_at = '';
    else if (!parseIso(d.publishAt)) problems.push({ path: 'publishAt', message: 'Choose a date and time.' });
    else out.publish_at = isoIst(parseIso(d.publishAt));
  }
  if (d.expiresAt !== undefined) {
    if (d.expiresAt === null || d.expiresAt === '') out.expires_at = '';
    else if (!parseIso(d.expiresAt)) problems.push({ path: 'expiresAt', message: 'Choose a date and time.' });
    else out.expires_at = isoIst(parseIso(d.expiresAt));
  }
  if (problems.length) throw invalid(problems);
  return out;
}

/** The start and end make sense (checked against the server's clock): a start at most 60 days ahead (a start already
 *  past means "now"), an end after the start and at most 90 days after it. Changes `t` in place. */
function checkTimes(t, ctx, was = null) {
  const nowMs = ctx.now().getTime(), now = isoIst(ctx.now());
  if (t.publish_at !== undefined && t.publish_at && Date.parse(t.publish_at) <= nowMs) t.publish_at = '';
  const start = t.publish_at !== undefined ? t.publish_at : was ? was.publish_at : '';
  const end = t.expires_at !== undefined ? t.expires_at : was ? was.expires_at : '';
  const problems = [];
  if (start && Date.parse(start) - nowMs > AHEAD_DAYS * DAY_MS) problems.push({ path: 'publishAt', message: `Choose a start within ${AHEAD_DAYS} days.` });
  // checked only when the start or end changes (pinning an older post with a long end keeps working)
  const changed = (t.expires_at !== undefined && (!was || t.expires_at !== was.expires_at)) || (t.publish_at !== undefined && (!was || t.publish_at !== was.publish_at));
  if (end && changed) {
    const from = start ? Date.parse(start) : was && !(was.publish_at > now) ? Date.parse(was.created_at) : nowMs;
    if (Date.parse(end) <= Math.max(from, nowMs)) problems.push({ path: 'expiresAt', message: 'The end must be after the start.' });
    else if (Date.parse(end) - Math.max(from, nowMs) > LENGTH_DAYS * DAY_MS) problems.push({ path: 'expiresAt', message: `Show it for at most ${LENGTH_DAYS} days.` });
  }
  if (problems.length) throw invalid(problems);
}

export async function create(d, ctx, req) {
  if (!canPost(ctx)) throw apiError('FORBIDDEN', 'You do not have access to this.');
  const t = text(d, false), audience = await audienceOf(ctx, d.audience), now = isoIst(ctx.now());
  checkTimes(t, ctx);
  const img = d.image === undefined || d.image === null ? null : imageOf(d.image);
  const res = await ctx.db.batch([
    q(ctx.db, `INSERT INTO announcements (title, body, audience, pinned, expires_at, author_login, author_name, created_at, updated_at, publish_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, t.title, t.body, audience, t.pinned || 0, t.expires_at || '', ctx.login, ctx.name, now, now, t.publish_at || ''),
    // the picture, then the notifications to the phones of its audience, right after the insert: last_insert_rowid() is
    // this announcement (the batch is one transaction; the picture's key IS the announcement id, so it stays so);
    // a scheduled post's notifications wait for its start (runAnnouncementPushes)
    ...(img ? [putImage(ctx.db, img, now)] : []),
    queueAnnouncement(ctx.db, audience, t.title, now),
    audit(ctx.db, ctx, 'announcements.create', '', audience, null, { title: t.title, ...(t.publish_at ? { publishAt: t.publish_at } : {}) }, '', req.requestId), dirty(ctx.db, 'announcements', 'audit_log')
  ]);
  return { announcement: view(await one1(ctx, res[0].meta.last_row_id), ctx) };
}

async function editable(ctx, id) {
  const a = await one(ctx.db, "SELECT * FROM announcements WHERE id = ? AND removed_at = ''", Number(id));
  if (!a) throw apiError('NOT_FOUND', 'That announcement is not there any more.');
  if (a.author_login !== ctx.login && !ctx.scopes.master) throw apiError('FORBIDDEN', 'Only its author or a master can change it.');
  return a;
}

export async function update(d, ctx, req) {
  const a = await editable(ctx, d.id), t = text(d, true), at = isoIst(ctx.now());
  if (d.audience !== undefined) t.audience = await audienceOf(ctx, d.audience);
  // the start can change only while the post waits ("Post now" sends publishAt: null); a post already shown keeps it
  if (t.publish_at !== undefined && !(a.publish_at > at)) { if (t.publish_at) throw invalid({ path: 'publishAt', message: 'This post is already on the wall.' }); delete t.publish_at; }
  checkTimes(t, ctx, a);
  // image: a new JPEG replaces the picture, null removes it, absent leaves it
  const img = d.image === undefined || d.image === null ? null : imageOf(d.image);
  const keys = Object.keys(t);
  if (!keys.length && d.image === undefined) throw invalid({ path: 'id', message: 'Nothing to change.' });
  await ctx.db.batch([
    q(ctx.db, `UPDATE announcements SET ${keys.map(k => `${k} = ?, `).join('')}updated_at = ? WHERE id = ?`, ...keys.map(k => t[k]), at, a.id),
    ...(img ? [setImage(ctx.db, a.id, img, at)] : d.image === null ? [q(ctx.db, 'DELETE FROM announcement_images WHERE ann_id = ?', a.id)] : []),
    audit(ctx.db, ctx, 'announcements.update', String(a.id), a.audience, { title: a.title }, t, '', req.requestId), dirty(ctx.db, 'announcements', 'audit_log')
  ]);
  return { announcement: view(await one1(ctx, a.id), ctx) };
}

/** The picture of a post the caller can see. */
export async function image(d, ctx) {
  const id = Number(d.id);
  if (!(await visible(ctx, 200, { scheduled: true })).some(a => a.id === id)) throw apiError('NOT_FOUND', 'That announcement is not there any more.');
  const r = await one(ctx.db, 'SELECT jpeg, updated_at FROM announcement_images WHERE ann_id = ?', id);
  if (!r) throw apiError('NOT_FOUND', 'No picture.');
  return { jpegBase64: r.jpeg, v: r.updated_at };
}

export async function remove(d, ctx, req) {
  const a = await editable(ctx, d.id);
  await ctx.db.batch([
    q(ctx.db, 'UPDATE announcements SET removed_at = ? WHERE id = ?', isoIst(ctx.now()), a.id),
    // a removed post never notifies (also one that was still scheduled)
    q(ctx.db, "UPDATE push_jobs SET state = 'DONE' WHERE ann_id = ? AND state = 'OPEN'", a.id),
    audit(ctx.db, ctx, 'announcements.remove', String(a.id), a.audience, { title: a.title }, null, '', req.requestId), dirty(ctx.db, 'announcements', 'audit_log')
  ]);
  return { removed: a.id };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Moderation: reports, and hiding a person's comments                                                                */
/* ---------------------------------------------------------------------------------------------------------------- */

/** announcements.report: a post (or one of its comments) reported to the IYF head, once per person and item (a repeat
 *  changes nothing). One's own post or comment is not reported (it can be removed). */
export async function report(d, ctx) {
  const a = await seen(ctx, d.id);
  let c = null;
  if (d.commentId !== undefined && d.commentId !== null) {
    c = await one(ctx.db, "SELECT * FROM post_comments WHERE id = ? AND ann_id = ? AND removed_at = ''", Number(d.commentId), a.id);
    if (!c) throw apiError('NOT_FOUND', 'That comment is not there any more.');
  }
  if ((c ? c.login : a.author_login) === ctx.login) throw apiError('CONFLICT', c ? 'This is your own comment: you can remove it instead.' : 'This is your own post: you can edit or remove it instead.');
  const problems = [];
  if (!REPORT_REASONS.includes(d.reason)) problems.push({ path: 'reason', message: 'Choose why: spam, abusive, inappropriate or other.' });
  const note = typeof d.note === 'string' ? d.note.replace(/\s+/g, ' ').trim() : '';
  if ((d.note !== undefined && d.note !== null && typeof d.note !== 'string') || note.length > 200) problems.push({ path: 'note', message: 'At most 200 characters.' });
  if (problems.length) throw invalid(problems);
  await run(ctx.db, 'INSERT OR IGNORE INTO post_reports (ann_id, comment_id, reporter, reason, note, at) VALUES (?, ?, ?, ?, ?, ?)',
    a.id, c ? c.id : 0, ctx.login, d.reason, note, isoIst(ctx.now()));
  return { reported: true };
}

const excerpt = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > 140 ? t.slice(0, 139) + '…' : t; };

/** announcements.reports (the IYF head): the open reports, one entry per reported post or comment, newest first. */
export async function reports(d, ctx) {
  const open = await all(ctx.db, `SELECT ann_id, comment_id, COUNT(*) AS n, group_concat(id) AS ids, group_concat(DISTINCT reason) AS reasons,
      group_concat(CASE WHEN note <> '' THEN note END, char(31)) AS notes, MIN(at) AS first_at, MAX(at) AS last_at
    FROM post_reports WHERE state = 'OPEN' GROUP BY ann_id, comment_id ORDER BY last_at DESC LIMIT 200`);
  if (!open.length) return { reports: [], total: 0 };
  const byIds = async (sql, ids) => (ids.length ? Object.fromEntries((await all(ctx.db, `${sql} (${ids.map(() => '?').join(',')})`, ...ids)).map(r => [r.id, r])) : {});
  const posts = await byIds('SELECT id, title, body, author_name, removed_at FROM announcements WHERE id IN', [...new Set(open.map(r => r.ann_id))]);
  const comms = await byIds('SELECT id, name, body, removed_at FROM post_comments WHERE id IN', open.filter(r => r.comment_id).map(r => r.comment_id));
  return {
    reports: open.map(r => {
      const p = posts[r.ann_id], c = r.comment_id ? comms[r.comment_id] : null, kind = r.comment_id ? 'comment' : 'post';
      return { key: kind === 'post' ? `p${r.ann_id}` : `c${r.comment_id}`, reportIds: String(r.ids).split(',').map(Number), kind, postId: r.ann_id, commentId: r.comment_id || null,
        excerpt: excerpt(kind === 'post' ? (p ? `${p.title} — ${p.body}` : '') : c?.body), authorName: (kind === 'post' ? p?.author_name : c?.name) || null,
        count: r.n, reasons: String(r.reasons || '').split(',').filter(Boolean), notes: r.notes ? r.notes.split('\x1f').slice(0, 10) : [],
        firstAt: r.first_at, lastAt: r.last_at,
        // already gone from the wall (its writer or staff removed it): only "dismiss" is left to do
        removed: kind === 'post' ? !p || !!p.removed_at : !c || !!c.removed_at || !p || !!p.removed_at };
    }),
    total: open.length
  };
}

/**
 * announcements.resolve (the IYF head): closes every open report about a post or comment. 'dismiss' leaves it on the
 * wall; 'remove' takes it off, as announcements.remove / uncomment do (kept, marked removed). Removing a post closes the
 * reports on its comments too. One Activity line.
 */
export async function resolve(d, ctx, req) {
  if (!['dismiss', 'remove'].includes(d.action)) throw invalid({ path: 'action', message: 'dismiss or remove.' });
  const db = ctx.db, postId = Number(d.postId), commentId = d.commentId === undefined || d.commentId === null ? 0 : Number(d.commentId);
  const a = await one(db, 'SELECT * FROM announcements WHERE id = ?', postId);
  if (!a) throw apiError('NOT_FOUND', 'That post is not there any more.');
  const c = commentId ? await one(db, 'SELECT * FROM post_comments WHERE id = ? AND ann_id = ?', commentId, postId) : null;
  if (commentId && !c) throw apiError('NOT_FOUND', 'That comment is not there any more.');
  const n = (await one(db, "SELECT COUNT(*) AS n FROM post_reports WHERE ann_id = ? AND comment_id = ? AND state = 'OPEN'", postId, commentId)).n;
  if (!n) throw apiError('NOT_FOUND', 'There are no open reports about that.');
  const at = isoIst(ctx.now()), remove = d.action === 'remove', wholePost = remove && !commentId;
  await db.batch([
    q(db, `UPDATE post_reports SET state = ?, decided_by = ?, decided_at = ? WHERE ann_id = ? AND state = 'OPEN'${wholePost ? '' : ' AND comment_id = ?'}`,
      remove ? 'REMOVED' : 'DISMISSED', ctx.login, at, postId, ...(wholePost ? [] : [commentId])),
    ...(!remove ? [] : commentId ? [q(db, "UPDATE post_comments SET removed_at = ? WHERE id = ? AND removed_at = ''", at, commentId)]
      : [q(db, "UPDATE announcements SET removed_at = ? WHERE id = ? AND removed_at = ''", at, postId)]),
    audit(db, ctx, 'announcements.resolve', c ? c.login : String(postId), a.audience, c ? { body: c.body } : { title: a.title },
      { action: d.action, kind: c ? 'comment' : 'post', postId, commentId: commentId || null, reports: n }, '', req.requestId),
    dirty(db, 'announcements', 'audit_log')
  ]);
  return { action: d.action, closed: n };
}

/** Whose comments a mute is about: a comment's writer (on a post the caller can see), or a person already hidden, by the
 *  key mutes.list gave (one of `viewers`' rows). null when the key is not (or no longer) there. Never says their phone. */
async function muteTarget(ctx, d, viewers) {
  let author;
  if (d.commentId !== undefined && d.commentId !== null) {
    const c = await one(ctx.db, 'SELECT ann_id, login, name FROM post_comments WHERE id = ?', Number(d.commentId));
    if (!c) throw apiError('NOT_FOUND', 'That comment is not there any more.');
    await seen(ctx, c.ann_id);
    author = { login: c.login, name: c.name };
  } else if (d.key !== undefined && d.key !== null) {
    const m = await one(ctx.db, `SELECT author FROM post_mutes WHERE id = ? AND viewer IN (${viewers.map(() => '?').join(',')})`, Number(d.key) || 0, ...viewers);
    if (!m) return null;
    author = { login: m.author, name: '' };
  } else throw invalid({ path: 'commentId', message: 'Choose a comment.' });
  const acct = await one(ctx.db, 'SELECT name FROM accounts WHERE login = ?', author.login);
  return { login: author.login, name: acct?.name || author.name || 'Someone' };
}

/** mutes.set: hide (mute true) or show again (false) a person's comments, for the caller only. By a comment of theirs,
 *  or by the key from mutes.list. At most MAX_MUTES people; never oneself. Safe to repeat. */
export async function mutesSet(d, ctx) {
  if (typeof d.mute !== 'boolean') throw invalid({ path: 'mute', message: 'true or false.' });
  const who = await muteTarget(ctx, d, [ctx.login]);
  if (!who) { if (d.mute) throw apiError('NOT_FOUND', 'That person is not on your hidden list.'); return { muted: false, key: null, name: null }; }
  if (who.login === ctx.login) throw apiError('CONFLICT', 'You cannot hide your own comments.');
  const was = await one(ctx.db, 'SELECT id FROM post_mutes WHERE viewer = ? AND author = ?', ctx.login, who.login);
  if (!d.mute) {
    if (was) await run(ctx.db, 'DELETE FROM post_mutes WHERE id = ?', was.id);
    return { muted: false, key: null, name: who.name };
  }
  if (was) return { muted: true, key: String(was.id), name: who.name };
  if ((await one(ctx.db, 'SELECT COUNT(*) AS n FROM post_mutes WHERE viewer = ?', ctx.login)).n >= MAX_MUTES)
    throw apiError('CONFLICT', `You have hidden ${MAX_MUTES} people. Show someone's comments again first.`);
  const r = await run(ctx.db, 'INSERT OR IGNORE INTO post_mutes (viewer, author, by, at) VALUES (?, ?, ?, ?)', ctx.login, who.login, ctx.login, isoIst(ctx.now()));
  return { muted: true, key: String(r.meta.last_row_id), name: who.name };
}

/** mutes.setAll (the IYF head): a person's comments hidden for everyone (and their new comments refused), or shown again.
 *  By a comment of theirs, or a key from mutes.list (the head's own list or the everyone list). Logged. */
export async function mutesSetAll(d, ctx, req) {
  if (typeof d.mute !== 'boolean') throw invalid({ path: 'mute', message: 'true or false.' });
  const who = await muteTarget(ctx, d, [ctx.login, EVERYONE]);
  if (!who) { if (d.mute) throw apiError('NOT_FOUND', 'That person is not on the hidden list.'); return { muted: false, key: null, name: null }; }
  if (who.login === ctx.login) throw apiError('CONFLICT', 'You cannot hide your own comments.');
  const was = await one(ctx.db, 'SELECT id FROM post_mutes WHERE viewer = ? AND author = ?', EVERYONE, who.login);
  if (d.mute === !!was) return { muted: d.mute, key: was ? String(was.id) : null, name: who.name };
  const res = await ctx.db.batch([
    d.mute ? q(ctx.db, 'INSERT OR IGNORE INTO post_mutes (viewer, author, by, at) VALUES (?, ?, ?, ?)', EVERYONE, who.login, ctx.login, isoIst(ctx.now()))
      : q(ctx.db, 'DELETE FROM post_mutes WHERE id = ?', was.id),
    audit(ctx.db, ctx, d.mute ? 'mutes.hideForAll' : 'mutes.showForAll', who.login, '', { hiddenForAll: !d.mute }, { hiddenForAll: d.mute, name: who.name }, '', req.requestId),
    dirty(ctx.db, 'audit_log')
  ]);
  return { muted: d.mute, key: d.mute ? String(res[0].meta.last_row_id) : null, name: who.name };
}

/** mutes.list: the people whose comments the caller hid ({ key, name, at }); for the IYF head also those hidden for
 *  everyone. The key is the list row's own number, never the person's phone. */
export async function mutesList(d, ctx) {
  const rows = async (viewer) => (await all(ctx.db, `SELECT m.id, m.at, m.by, a.name FROM post_mutes m LEFT JOIN accounts a ON a.login = m.author
                                                    WHERE m.viewer = ? ORDER BY m.id DESC LIMIT 500`, viewer))
    .map(r => ({ key: String(r.id), name: r.name || 'Someone', at: r.at, ...(viewer === EVERYONE ? { by: r.by } : {}) }));
  return { mutes: await rows(ctx.login), ...(ctx.scopes.master ? { everyone: await rows(EVERYONE) } : {}) };
}
