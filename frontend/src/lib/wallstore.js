// The announcement wall's cached list, and the only place it is changed (13 October 2026; audit FE-20 group /
// roadmap 4.2). The same shape as lib/weekstore.js does for the weekly form.
//
// Why: the wall patches its cache after every write — post, edit, delete, like, comment, uncomment, pin, post-now,
// and the optimistic rollback when a write fails — and each of those spelled out `patch(KEY, (d) => ({
// announcements: …, latestAt: latestOf(…) }))` inline. Nine copies of the same two-line shape inside a 494-line
// component, each able to forget the re-sort or the `latestAt` the bell reads. Here they are nine named functions
// over one `put()`, so a screen says what changed and this file knows how the cache is shaped.
//
// Nothing here calls the server: the component awaits the write, then tells the store what happened. That keeps
// the optimistic paths honest — a rollback is `replace(before)` with the list the screen kept.
import { patch, entry } from './cache.svelte.js';
import { sortAnns, latestOf } from './ann.js';

export const KEY = 'announcements.list';

/** The cache's shape: the list, plus the newest time the bell compares against. */
const put = (list) => ({ announcements: list, latestAt: latestOf(list) });

/** The list as the cache holds it now (never null — an empty list before the first load). */
export const current = () => entry(KEY).data?.announcements || [];

/** Replace the whole list (a rollback after a failed write; the caller keeps the copy). */
export const replace = (list) => patch(KEY, () => put(list));

/** A new post, placed in the list's own order. */
export const added = (a) => patch(KEY, (d) => put(sortAnns([a, ...d.announcements])));

/** An edited post, replaced in place and re-sorted (an edit can change `pinned` or `publishAt`). */
export const edited = (a) => patch(KEY, (d) => put(sortAnns(d.announcements.map((x) => (x.id === a.id ? a : x)))));

/** A post that is gone. */
export const removed = (id) => patch(KEY, (d) => put(d.announcements.filter((x) => x.id !== id)));

/** Fields changed on one post (likes, comment counts, reach, the pin). */
export const setPost = (id, o) => patch(KEY, (d) => put(d.announcements.map((x) => (x.id === id ? { ...x, ...o } : x))));

/** A like, applied before the server answers; `liked` and the new count come back from it afterwards. */
export const liked = (id, liked, likes) => setPost(id, { liked, likes });

/** One more or one fewer comment on a post (the count the feed shows). */
export const commented = (id, comments) => setPost(id, { comments });

/** A merge of the server's list into the cache, keeping anything the server did not return (a scheduled post the
 *  author can still see). Used after a create when the reply carries the whole list. */
export const merged = (list) => patch(KEY, (d) => {
  const byId = new Map(list.map((a) => [a.id, a]));
  const kept = (d.announcements || []).filter((a) => !byId.has(a.id) && a.scheduled);
  return put(sortAnns([...list, ...kept]));
});

/* ---- a post's comments, cached per post ---- */

export const commentsKey = (id) => 'announcements.comments:' + id;

/** A comment the server accepted. */
export const commentAdded = (postId, comment) =>
  patch(commentsKey(postId), (x) => ({ comments: [...(x?.comments || []), comment] }));

/** A comment that is gone. */
export const commentRemoved = (postId, commentId) =>
  patch(commentsKey(postId), (x) => ({ comments: (x?.comments || []).filter((y) => y.id !== commentId) }));

/** Pin or unpin, applied before the server answers (the list re-sorts, so a pin moves the post). */
export const pinned = (id, on) => patch(KEY, (d) => put(sortAnns(d.announcements.map((x) => (x.id === id ? { ...x, pinned: on } : x)))));
