// English and Hindi sections of the books (the head, 19 Oct 2026): a file is English unless the server marks it 'hi';
// the Hindi section holds only books that have a Hindi PDF, under their Hindi title, searchable in either script.
import { describe, it, expect } from 'vitest';
import { filesIn, booksIn, filterBooks, bookTitle, chapterGroups, normLang } from '../src/lib/books.js';

const gita = { bookId: 'B55', title: 'Bhagavad Gita As It Is', titleHi: 'श्रीमद्-भगवद्-गीता यथारूप', level: 'BSS/BVS',
  files: [{ label: 'English', url: 'https://x/en' }, { label: 'यथारूप', url: 'https://x/hi1', lang: 'hi' }, { label: '1980', url: 'https://x/hi2', lang: 'hi' }] };
const canto = { bookId: 'B68', title: 'Srimad Bhagavatam Canto 10', titleHi: 'श्रीमद्-भागवतम् · स्कन्ध 10', chaptersHi: 95, level: 'BSS/BVS',
  files: [{ label: 'PDF', url: 'https://x/c10' }, { label: 'Part 1', url: 'https://x/p1', lang: 'hi' }] };
const dys = { bookId: 'B02', title: 'DYS Book', level: 'VL-1', files: [] };
const all = [dys, gita, canto];

describe('book languages', () => {
  it('splits a book\'s files by language; English is every unmarked file', () => {
    expect(filesIn(gita, 'en').map((f) => f.url)).toEqual(['https://x/en']);
    expect(filesIn(gita, 'hi').map((f) => f.url)).toEqual(['https://x/hi1', 'https://x/hi2']);
    expect(filesIn(dys, 'hi')).toEqual([]);
  });
  it('the English section keeps every book (as before); the Hindi one only books with a Hindi PDF', () => {
    expect(booksIn(all, 'en')).toEqual(all);
    expect(booksIn(all, 'hi').map((b) => b.bookId)).toEqual(['B55', 'B68']);
  });
  it('shows the Hindi title in the Hindi section, and finds a book by either title', () => {
    expect([bookTitle(gita, 'hi'), bookTitle(gita, 'en'), bookTitle(dys, 'hi')]).toEqual([gita.titleHi, gita.title, 'DYS Book']);
    expect(filterBooks(all, 'all', 'gita').map((b) => b.bookId)).toEqual(['B55']);
    expect(filterBooks(all, 'all', 'भागवतम्').map((b) => b.bookId)).toEqual(['B68']);
  });
  it('groups chapters by part, keeping their order', () => {
    const g = chapterGroups([{ part: 'Part 1', label: 'Contents' }, { part: 'Part 1', label: '1. A' }, { part: 'Part 2', label: '14. B' }]);
    expect(g.map((x) => [x.part, x.items.length])).toEqual([['Part 1', 2], ['Part 2', 1]]);
    expect(chapterGroups([{ part: '', label: '1. A' }]).map((x) => x.part)).toEqual(['']);
  });
  it('accepts only the two sections', () => {
    expect([normLang('hi'), normLang('en'), normLang('fr'), normLang(null)]).toEqual(['hi', 'en', 'en', 'en']);
  });
});
