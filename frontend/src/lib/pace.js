// The readable pace (Phase 9, DARSHAN_AND_VERSE_STANDARD.md §4, approved 9 Oct 2026): in one view the painting and the
// verse never change at the same moment — each waits until 4 s after the other's last change.
export const pace = { last: 0 };
export const GAP = 4000;
/** How long to wait (ms) before changing, so as not to change within GAP of the last change; 0 = go now. */
export const quietFor = (now = Date.now()) => Math.max(0, pace.last + GAP - now);
export const changed = (now = Date.now()) => { pace.last = now; };
