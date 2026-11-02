// Book list logic shared by Reading and the day form's book picker: levels, search, the hash query.
export const LEVELS = ['VL-1', 'VL-2', 'VL-3', 'SPS/DPS', 'BSS/BVS'];

/** The levels present, in course order (unknown ones last). */
export function levelsOf(books) {
  const have = [...new Set(books.map((b) => b.level).filter(Boolean))];
  return [...LEVELS.filter((l) => have.includes(l)), ...have.filter((l) => !LEVELS.includes(l))];
}
/** The level chip in use: the chosen one, else the devotee's own level, else all ('all'). */
export const levelIn = (chosen, own, levels) => (chosen === 'all' || levels.includes(chosen) ? chosen : levels.includes(own) ? own : 'all');

/** Books of a level ('all' = every level) whose title — English or Hindi — has every typed word. */
export function filterBooks(books, level = 'all', q = '') {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (b) => `${b.title || ''} ${b.titleHi || ''}`.toLowerCase();
  return books.filter((b) => (level === 'all' || b.level === level) && terms.every((t) => hay(b).includes(t)));
}

// English and Hindi sections (the head, 19 Oct 2026). The server marks a Hindi PDF lang 'hi'; every other file is
// English, so a list from before the Hindi books reads exactly as it did.
export const LANGS = [['en', 'English'], ['hi', 'हिन्दी']];
export const normLang = (l) => (l === 'hi' ? 'hi' : 'en');
const isLink = (f) => /^https:\/\//.test(f?.url || '');
/** A book's PDFs in one section. */
export const filesIn = (b, lang) => (b?.files || []).filter((f) => isLink(f) && (lang === 'hi' ? f.lang === 'hi' : f.lang !== 'hi'));
/** The English section is every book, as before; the Hindi one only the books with a Hindi PDF. */
export const booksIn = (books, lang) => (lang === 'hi' ? books.filter((b) => filesIn(b, 'hi').length) : books);
/** The title a section shows. */
export const bookTitle = (b, lang) => (lang === 'hi' && b?.titleHi) || b?.title || '';
/** Chapters (books.chapters) in runs of the same part, in their order: Canto 10's four parts, or one run with no part. */
export function chapterGroups(chapters = []) {
  const out = [];
  for (const c of chapters) { const last = out.at(-1); if (last && last.part === c.part) last.items.push(c); else out.push({ part: c.part, items: [c] }); }
  return out;
}
