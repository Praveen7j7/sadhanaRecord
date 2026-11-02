// The wall's cached list is changed only through lib/wallstore.js (13 Oct 2026; roadmap 4.2).
//
// This exists because of a real near-miss: while moving the wall's nine inline cache patches into the store, the
// pin path was left calling two helpers that no longer existed — code that would have thrown the moment a
// coordinator pinned a post — and the whole client suite still passed, because nothing exercised it. These
// assertions drive every store function, so a missing or misshapen patch fails here instead of on a phone.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/api.js', () => ({ call: vi.fn(), errorMessage: (e) => String(e?.message || e), fieldErrors: () => ({}) }));

const { setScope, entry } = await import('../src/lib/cache.svelte.js');
// patch() deliberately does nothing when a key has never been loaded (cache.svelte.js:102), so a test seeds the
// entry the way a real screen gets it: load() fills e.data. Assigning it directly is the same end state.
const seed = (key, data) => { entry(key).data = data; };
const wall = await import('../src/lib/wallstore.js');

const post = (id, over = {}) => ({ id, title: 'Post ' + id, body: 'x', audience: 'ALL', pinned: false, likes: 0, liked: false, comments: 0, createdAt: `2026-10-0${id}T10:00:00+05:30`, ...over });

beforeEach(() => {
  setScope('tester');
  seed(wall.KEY, { announcements: [post(3), post(2), post(1)], latestAt: '2026-10-03T10:00:00+05:30' });
});

const list = () => entry(wall.KEY).data.announcements;
const ids = () => list().map((a) => a.id);

describe('the wall store', () => {
  it('reads the current list', () => {
    expect(wall.current().map((a) => a.id)).toEqual([3, 2, 1]);
  });

  it('adds a post and keeps the list in its own order', () => {
    wall.added(post(4, { createdAt: '2026-10-04T10:00:00+05:30' }));
    expect(ids()).toContain(4);
    // newest first, pinned above all — whatever sortAnns decides, the store must have applied it
    expect(ids()[0]).toBe(4);
  });

  it('puts a pinned post at the top wherever it was', () => {
    wall.pinned(1, true);
    expect(ids()[0]).toBe(1);
    expect(list().find((a) => a.id === 1).pinned).toBe(true);
    wall.pinned(1, false);
    expect(ids()[0]).toBe(3);
  });

  it('replaces an edited post in place and re-sorts', () => {
    wall.edited(post(1, { title: 'Edited', pinned: true }));
    expect(list().find((a) => a.id === 1).title).toBe('Edited');
    expect(ids()[0]).toBe(1);                       // the edit pinned it, so it moved
  });

  it('removes a post', () => {
    wall.removed(2);
    expect(ids()).toEqual([3, 1]);
  });

  it('changes fields on one post and leaves the others alone', () => {
    wall.setPost(2, { likes: 5, liked: true });
    expect(list().find((a) => a.id === 2)).toMatchObject({ likes: 5, liked: true });
    expect(list().find((a) => a.id === 3).likes).toBe(0);
  });

  it('applies a like and can roll it back', () => {
    wall.liked(3, true, 1);
    expect(list().find((a) => a.id === 3)).toMatchObject({ liked: true, likes: 1 });
    wall.liked(3, false, 0);
    expect(list().find((a) => a.id === 3)).toMatchObject({ liked: false, likes: 0 });
  });

  it('updates a comment count', () => {
    wall.commented(1, 4);
    expect(list().find((a) => a.id === 1).comments).toBe(4);
  });

  it('restores the whole list on a rollback', () => {
    const before = wall.current();
    wall.removed(1);
    wall.removed(2);
    expect(ids()).toEqual([3]);
    wall.replace(before);
    expect(ids()).toEqual([3, 2, 1]);
  });

  it('keeps latestAt in step, because the bell reads it', () => {
    const was = entry(wall.KEY).data.latestAt;
    wall.added(post(9, { createdAt: '2026-10-09T10:00:00+05:30' }));
    expect(entry(wall.KEY).data.latestAt).not.toBe(was);
    expect(entry(wall.KEY).data.latestAt).toContain('2026-10-09');
  });

  it('holds comments per post, added and removed', () => {
    seed(wall.commentsKey(2), { comments: [{ id: 11, body: 'first' }] });
    wall.commentAdded(2, { id: 12, body: 'second' });
    expect(entry(wall.commentsKey(2)).data.comments.map((c) => c.id)).toEqual([11, 12]);
    wall.commentRemoved(2, 11);
    expect(entry(wall.commentsKey(2)).data.comments.map((c) => c.id)).toEqual([12]);
    // and a different post's comments are untouched
    expect(entry(wall.commentsKey(3)).data).toBeUndefined();
  });

  it('merges a server list while keeping a scheduled post only the author sees', () => {
    seed(wall.KEY, { announcements: [post(5, { scheduled: true }), post(3), post(1)], latestAt: '' });
    wall.merged([post(3), post(1)]);
    expect(ids()).toContain(5);                     // kept: the server's list does not carry it
    expect(ids()).toContain(3);
  });

  it('never leaves the cache without the two keys the screen reads', () => {
    for (const change of [() => wall.added(post(7)), () => wall.removed(7), () => wall.setPost(1, { likes: 2 }), () => wall.pinned(2, true)]) {
      change();
      const d = entry(wall.KEY).data;
      expect(Array.isArray(d.announcements), 'announcements').toBe(true);
      expect(typeof d.latestAt, 'latestAt').toBe('string');
    }
  });
});
