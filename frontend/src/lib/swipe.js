// Phase 7 (9 Oct 2026): a sideways swipe on a page goes to the previous / next one (a day, a week). A swipe is quick,
// mostly sideways and long enough; one that starts on something that scrolls or moves sideways itself (chip rows, time
// wheels, sliders, fields, an open sheet) is left alone. The page keeps its buttons: the swipe is a shortcut.
const SKIP = 'input, textarea, select, [contenteditable], .chips, .chiprow, .wheel, .rg-row, .qc, dialog, .sk, [data-noswipe]';
/** Attachment: onswipe(-1) for a swipe to the right (back), onswipe(1) for one to the left (next). */
export const swipe = (onswipe) => (node) => {
  let x = 0, y = 0, t = 0, on = false;
  // the page still scrolls up and down; a sideways move is left to us instead of being taken as a scroll (no cancel)
  node.style.touchAction = 'pan-y';
  const down = (e) => { on = e.isPrimary && e.pointerType !== 'mouse' && !e.target.closest(SKIP); x = e.clientX; y = e.clientY; t = Date.now(); };
  const up = (e) => {
    if (!on) return; on = false;
    const dx = e.clientX - x, dy = e.clientY - y;
    if (Date.now() - t < 600 && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.5) onswipe(dx < 0 ? 1 : -1);
  };
  node.addEventListener('pointerdown', down, { passive: true });
  node.addEventListener('pointerup', up, { passive: true });
  node.addEventListener('pointercancel', () => (on = false), { passive: true });
  return () => { node.removeEventListener('pointerdown', down); node.removeEventListener('pointerup', up); };
};
