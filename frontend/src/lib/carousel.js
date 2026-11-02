// Pure helpers for the home quote carousel (index wrap, swipe direction, a pausable countdown).

/** Index i wrapped into 0..n-1 (also for negative i). */
export const wrap = (i, n) => (n ? ((i % n) + n) % n : 0);

/** A horizontal swipe: +1 (next, finger moved left), -1 (previous) or 0 (a tap or a vertical scroll). */
export function swipeDir(dx, dy, min = 40) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

/** A countdown of `ms` that can be paused and resumed (keeps the time left), and reset for a new slide. */
/**
 * How long a verse stays (Phase 9, DARSHAN_AND_VERSE_STANDARD.md §4): a calm reading pace for scripture — 6 s plus
 * 0.4 s a word, at least 10 s, at most 30 s.
 */
export const readMs = (text) => Math.min(30000, Math.max(10000, 6000 + 400 * String(text || '').trim().split(/\s+/).filter(Boolean).length));
export function countdown(ms, done, clock = () => Date.now()) {
  let left = ms, since = 0, t = null;
  return {
    run() {
      if (t) return;
      since = clock();
      t = setTimeout(() => { t = null; left = ms; done(); }, left);
    },
    pause() {
      if (!t) return;
      clearTimeout(t); t = null;
      left = Math.max(0, left - (clock() - since));
    },
    // a new length for the next turn (a verse's own reading time, Phase 9)
    reset(next) { if (t) { clearTimeout(t); t = null; } if (next) ms = next; left = ms; },
    get left() { return left; },
    get running() { return !!t; },
  };
}

// The book a quote comes from, as a short label above the quote ("Bhagavad-gītā As It Is 2.40" → "Bhagavad-gītā").
const BOOKS = [
  [/^Bhagavad-g[iī]t[aā]/i, 'Bhagavad-gītā'],
  [/^(Śrīmad-|Srimad[- ])Bh[aā]gavatam/i, 'Śrīmad-Bhāgavatam'],
  [/Caitanya-carit[aā]m[ṛr]ta/i, 'Caitanya-caritāmṛta'],
  [/Nectar of Instruction|Upade[śs][aā]m[ṛr]ta/i, 'Nectar of Instruction'],
  // added with the Phase 9 quotes (9 Oct 2026)
  [/Brahma-sa[ṁm]hit[aā]/i, 'Brahma-saṁhitā'],
  [/Nectar of Devotion|Bhakti-ras[aā]m[ṛr]ta-sindhu/i, 'Nectar of Devotion'],
  [/[IĪ][śs]opani[ṣs]ad/i, 'Śrī Īśopaniṣad'],
];
/** Category label for a quote's reference; '' when the book is not a known one. */
export function categoryOf(ref) {
  const s = String(ref || '').trim();
  for (const [re, label] of BOOKS) if (re.test(s)) return label;
  return '';
}
/** Autoplay interval and crossfade of the quote carousel (ms). */
export const QUOTE_MS = 9000;

/**
 * The dots under the quotes: at most `k` (odd), the current quote always in the middle, smaller towards the edges,
 * so the total number is never shown. Returns [{ i: offset from the current one, size: 'on' | 'md' | 'sm' }].
 */
export function dotWindow(idx, n, k = 5) {
  const half = Math.floor(Math.min(k, n) / 2), out = [];
  for (let o = -half; o <= half; o++) out.push({ i: o, size: o === 0 ? 'on' : Math.abs(o) === 1 ? 'md' : 'sm' });
  return out;
}
