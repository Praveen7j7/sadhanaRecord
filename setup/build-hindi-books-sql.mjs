// The Hindi editions of the reading-sequence books (the head, 19 Oct 2026): "English section for English books, Hindi
// section for Hindi books ... map them according to the cantos, to the volumes".
//
// Source: the head's Drive folder 1W232SB2ZRMJzYTPt_Id3oSgHrm1v7Xhq, listed read-only with every subfolder by
//   node setup/list-drive-folder.mjs 1W232SB2ZRMJzYTPt_Id3oSgHrm1v7Xhq setup/data/book-files-hindi.json
// Writes worker/migrations/0058_book_languages.sql (do not edit it by hand) and setup/data/book-links-hindi.json.
//   node setup/build-hindi-books-sql.mjs
//
// Every file was matched by a fixed rule from its folder and name — never by similarity — and the uncertain ones were
// opened (first page) before deciding:
//   - Śrīmad-Bhāgavatam canto-wise "Hindi SB Canto NN [Part P]" → that canto's book (B59–B70), and all of them → B58
//   - Śrīmad-Bhāgavatam chapter-wise "Canto-N[/Part-P]/Chapter_NN_-_Title" → book_chapters of that canto's book,
//     read only when somebody opens a canto's chapters (books.chapters), so journals.get reads none of the 349 rows
//   - Śrī Caitanya-caritāmṛta "NN …, <lila>, <khanda>, अध्याय (a-b)" → its lila's book (B72–B74), and all → B71
//   - KRSNA_Book(Hindi) → B31; श्रीमद्-भगवद्-गीता यथारूप + the 1980 original → B55 (with the Hindi PDF already linked)
// Left out, for the head to decide (named in docs/releases): Bhagavad-gita_Yatharupa.pdf (the same 876-page edition
// already linked to B55); upadeshamrta_4th_ed_hindi.pdf (Gaudiya Vedanta Prakashan's edition, not Srila Prabhupada's
// Nectar of Instruction); The_Nectar_of_Devotion-1970 scan and Rupa_Goswami_Bhakti_rasamrta_sindhu (both English).
import { readFileSync, writeFileSync } from 'node:fs';
const files = JSON.parse(readFileSync('setup/data/book-files-hindi.json', 'utf8'));
const link = (f) => `https://drive.google.com/file/d/${f.id}/view`;
const esc = (s) => String(s).replace(/'/g, "''");
const byName = (n) => { const f = files.find((x) => x.name === n); if (!f) throw new Error('missing ' + n); return f; };

const CANTO_BOOK = (c) => 'B' + String(58 + c).padStart(2, '0');          // Canto 1 → B59 … Canto 12 → B70
const LILA = { 'आदि लीला': 'B72', 'मध्य लीला': 'B73', 'अन्त्य लीला': 'B74' };
const TITLE_HI = {
  B31: 'लीला पुरुषोत्तम भगवान् श्रीकृष्ण', B55: 'श्रीमद्-भगवद्-गीता यथारूप', B58: 'श्रीमद्-भागवतम् (सम्पूर्ण)',
  B71: 'श्रीचैतन्य-चरितामृत (सम्पूर्ण)', B72: 'श्रीचैतन्य-चरितामृत · आदि लीला', B73: 'श्रीचैतन्य-चरितामृत · मध्य लीला',
  B74: 'श्रीचैतन्य-चरितामृत · अन्त्य लीला',
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [CANTO_BOOK(i + 1), `श्रीमद्-भागवतम् · स्कन्ध ${i + 1}`])),
};

const rows = {};                                              // bookId → [{ label, url }] in reading order
const add = (b, label, f) => (rows[b] ||= []).push({ label, url: link(f) });

// Bhagavad-gita: the Devanagari-named edition first, then the 1980 original; the 876-page Hindi PDF already linked
// stays (it is relabelled below), and its duplicate in this folder is not added twice
add('B55', 'भगवद्-गीता यथारूप · 678 पृष्ठ', byName('श्रीमद्-भगवद्-गीता यथारूप.pdf'));
add('B55', 'मूल संस्करण 1980 (स्कैन)', byName('Bhagavad-gita_Yatharupa_1980_ORIGINAL_EDITION.pdf'));
add('B31', 'PDF', byName('KRSNA_Book(Hindi).pdf'));

// Śrīmad-Bhāgavatam, canto-wise: each canto's book gets its part(s); the complete set gets all, in canto order
const cantowise = files.filter((f) => /^Hindi SB Canto \d\d( Part \d)?\.pdf$/.test(f.name))
  .map((f) => { const [, c, p] = f.name.match(/Canto (\d\d)(?: Part (\d))?/); return { f, c: +c, p: p ? +p : 0 }; })
  .sort((a, b) => a.c - b.c || a.p - b.p);
if (cantowise.length !== 19) throw new Error('expected 19 canto-wise files, found ' + cantowise.length);
for (const { f, c, p } of cantowise) {
  add(CANTO_BOOK(c), p ? `Part ${p}` : `Canto ${c}`, f);
  add('B58', p ? `Canto ${c} · Part ${p}` : `Canto ${c}`, f);
}

// Śrī Caitanya-caritāmṛta: nine volumes (khaṇḍa), each in its lila's book and in the complete set
const cc = files.filter((f) => f.path.startsWith('Śrī Caitanya-caritāmṛta')).sort((a, b) => a.name.localeCompare(b.name));
if (cc.length !== 9) throw new Error('expected 9 Caitanya-caritamrta volumes, found ' + cc.length);
for (const f of cc) {
  const m = f.name.match(/^\d\d श्रीचैतन्य-चरितामृत, (\S+ लीला), (\S+ खण्ड), अध्याय \((\d+)-(\d+)\)\.pdf$/);
  if (!m) throw new Error('unexpected volume name ' + f.name);
  const label = `${m[1]} · ${m[2]} (अध्याय ${m[3]}–${m[4]})`;
  add(LILA[m[1]], `${m[2]} (अध्याय ${m[3]}–${m[4]})`, f);
  add('B71', label, f);
}

// Śrīmad-Bhāgavatam, chapter-wise: Contents and Introduction first, then the chapters in order; Canto 10 by its parts
const chapters = {};                                          // bookId → [{ part, label, url }]
const tidy = (s) => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const ch = files.filter((f) => f.path.includes('Chapterwise'));
for (const f of ch) {
  const m = f.path.match(/Canto-(\d+)(?: \/ Part-(\d))?$/);
  if (!m) throw new Error('unexpected chapter folder ' + f.path);
  f.canto = +m[1]; f.part = m[2] ? `Part ${m[2]}` : '';
  const n = f.name.match(/^Chapter_(\d+)\s*-?_?-?_?(.*)\.pdf$/);
  f.rank = n ? +n[1] : f.name.startsWith('A_Contents') ? -2 : f.name.startsWith('A_Introduction') ? -1 : NaN;
  if (Number.isNaN(f.rank)) throw new Error('unexpected chapter file ' + f.name);
  f.label = n ? `${+n[1]}. ${tidy(n[2])}` : f.rank === -2 ? 'Contents' : 'Introduction';
}
ch.sort((a, b) => a.canto - b.canto || a.part.localeCompare(b.part) || a.rank - b.rank);
for (const f of ch) (chapters[CANTO_BOOK(f.canto)] ||= []).push({ part: f.part, label: f.label, url: link(f) });
const chapterCount = (b) => (chapters[b] || []).filter((x) => /^\d+\. /.test(x.label)).length;
if (Array.from({ length: 12 }, (_, i) => chapterCount(CANTO_BOOK(i + 1))).join() !== '19,10,33,31,26,19,15,24,24,90,31,13') {
  throw new Error('chapter counts do not match the Bhagavatam');
}

const sql = [
  '-- The Hindi editions of the reading-sequence books, by canto, volume and chapter (19 Oct 2026).',
  '-- Generated by setup/build-hindi-books-sql.mjs from setup/data/book-files-hindi.json; do not edit by hand.',
  '-- Additive: every existing book_files row stays as it was and reads as English (lang defaults to en).',
  `ALTER TABLE book_files ADD COLUMN "lang" TEXT NOT NULL DEFAULT 'en';`,
  `ALTER TABLE books ADD COLUMN "title_hi" TEXT NOT NULL DEFAULT '';`,
  `ALTER TABLE books ADD COLUMN "chapters_hi" INTEGER NOT NULL DEFAULT 0;`,
  '-- chapter PDFs: read one book at a time (books.chapters), never with the book list',
  `CREATE TABLE book_chapters ("book_id" TEXT NOT NULL REFERENCES books("book_id"), "lang" TEXT NOT NULL, "n" INTEGER NOT NULL, "part" TEXT NOT NULL DEFAULT '', "label" TEXT NOT NULL, "url" TEXT NOT NULL, PRIMARY KEY ("book_id", "lang", "n"));`,
  '-- the Hindi Gita already linked (876 pages) moves to the Hindi section, named for what it is',
  `UPDATE book_files SET "lang" = 'hi', "label" = 'भगवद्-गीता यथारूप · 876 पृष्ठ' WHERE "book_id" = 'B55' AND "label" = 'Hindi';`,
];
for (const [b, list] of Object.entries(rows)) {
  list.forEach((r, i) => sql.push(`INSERT INTO book_files ("book_id", "order", "label", "url", "lang") VALUES ('${b}', ${100 + i}, '${esc(r.label)}', '${esc(r.url)}', 'hi');`));
}
for (const [b, list] of Object.entries(chapters)) {
  list.forEach((r, i) => sql.push(`INSERT INTO book_chapters ("book_id", "lang", "n", "part", "label", "url") VALUES ('${b}', 'hi', ${i + 1}, '${esc(r.part)}', '${esc(r.label)}', '${esc(r.url)}');`));
}
for (const [b, t] of Object.entries(TITLE_HI)) {
  // chapters_hi counts the chapters themselves (Canto 10: 90), not its Contents and Introduction files
  sql.push(`UPDATE books SET "title_hi" = '${esc(t)}', "chapters_hi" = ${chapterCount(b)} WHERE "book_id" = '${b}';`);
}
sql.push(`UPDATE settings SET value = 'j3', changed_by = 'hindi books' WHERE key = 'journals_version';`);
// the Sheets copy (paused since 13 Oct): the new table is copied like book_files, and the changed lists are rewritten
sql.push(`INSERT INTO mirror_state (tbl) VALUES ('book_chapters');`);
sql.push(`UPDATE mirror_state SET dirty = dirty + 1 WHERE tbl IN ('books', 'book_files', 'settings');`);
writeFileSync('worker/migrations/0058_book_languages.sql', sql.join('\n') + '\n');
writeFileSync('setup/data/book-links-hindi.json', JSON.stringify({ files: rows, chapters, titles: TITLE_HI }, null, 1));
console.log(`book_files: ${Object.values(rows).flat().length} Hindi rows in ${Object.keys(rows).length} books · `
  + `book_chapters: ${ch.length} rows in ${Object.keys(chapters).length} cantos · 0058_book_languages.sql written`);
