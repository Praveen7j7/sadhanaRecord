// Vaishnava Songs (phase 22, C3/C4, 26 Oct 2026): the songs added in the app. The head: "add only those songs which
// are literally there" in the official books. So every added song is transcribed from one of them, never from memory:
//
//   books/hindi.json            गौड़ीय वैष्णव गीत (the Hindi song book, public/songs/vaishnava-songs-hi.pdf)
//   books/saranagati.json       Śaraṇāgati (Bhaktivinoda Ṭhākura), Bhaktivinoda_Thakura_Saranagati2.pdf
//   books/gitavali.json         Gītāvalī (Bhaktivinoda Ṭhākura), Bhaktivinoda_Thakura_Gitavali.pdf
//   books/prarthana.json        Prārthanā (Narottama dāsa Ṭhākura), Narottama_dasa_Thakura_Prarthana.pdf
//   books/pbc.json              Śrī Prema-bhakti-candrikā (Narottama dāsa Ṭhākura)
//   books/vct-gitavali.json     Śrī Gītāvalī (Viśvanātha Cakravartī Ṭhākura)
//   books/nityanandastaka.json  Śrī Nityānandāṣṭaka (Vṛndāvana dāsa Ṭhākura)
//
// (the Gaudiya books from ebooks.iskcondesiretree.com, downloaded by the head on 26 Oct 2026). Each file holds the
// transcribed songs (with their ids, fixed once: s171 onward, so links keep working), the songs of that book already in
// the English song book (`present`, which only adds the book as a collection of that song), and what was left out and
// why (`leftOut`). `notes`, `uncertain` and `source` (file + PDF page) are for the proofreader and never reach the app.
// Every song stays `proofread: false` until the head (or the devotee they name) checks it against the printed page; the
// app shows no marker for it (the head, 26 Oct: "live, no marker"). Viśvanātha's three aṣṭakas printed after his
// Gītāvalī are in vct-gitavali.json's leftOut (the head excluded them, 26 Oct).
import fs from 'node:fs';

const DIR = new URL('./books/', import.meta.url);
export const BOOK_FILES = ['hindi', 'saranagati', 'gitavali', 'prarthana', 'pbc', 'vct-gitavali', 'nityanandastaka'];

// a book's collection name as the app shows it (one spelling each), and the section its added songs are listed under
export const COLLECTION_NAME = {
  'Śaraṇāgati': 'Śaraṇāgati', 'Gītāvalī': 'Gītāvalī', 'Prārthanā': 'Prārthanā',
  'Śrī Prema-bhakti-candrikā': 'Prema-bhakti-candrikā', 'Śrī Gītāvalī': 'Gītāvalī of Viśvanātha Cakravartī',
  'Śrī Nityānandāṣṭaka': 'Nityānandāṣṭaka',
};
const SECTION = {
  saranagati: 'Śaraṇāgati · Bhaktivinoda Thakura', gitavali: 'Gītāvalī · Bhaktivinoda Thakura',
  prarthana: 'Prārthanā · Narottama Dasa Thakura', pbc: 'Prema-bhakti-candrikā · Narottama Dasa Thakura',
  'vct-gitavali': 'Gītāvalī · Visvanatha Cakravarti Thakura', nityanandastaka: 'Nityānandāṣṭaka · Vrndavana Dasa Thakura',
};

// how the song page names the book (the data keeps the file name and its PDF page, for the proofreader)
const BOOK_LABEL = {
  saranagati: 'Śaraṇāgati (Gaudiya Books)', gitavali: 'Gītāvalī (Gaudiya Books)', prarthana: 'Prārthanā (Gaudiya Books)',
  pbc: 'Śrī Prema-bhakti-candrikā (Gaudiya Books)', 'vct-gitavali': 'Śrī Gītāvalī (Gaudiya Books)', nityanandastaka: 'Śrī Nityānandāṣṭaka (Gaudiya Books)',
};

export function readBooks() {
  return BOOK_FILES.map((key) => ({ key, ...JSON.parse(fs.readFileSync(new URL(key + '.json', DIR), 'utf8')) }));
}

/** The added songs in the app's shape, and the tags each book gives to songs already in the English book. */
export function addedSongs() {
  const added = [], tags = [];
  for (const b of readBooks()) {
    const collection = COLLECTION_NAME[b.collection] || '';
    const cite = (src) => (BOOK_LABEL[b.key] ? `${BOOK_LABEL[b.key]}, p. ${(String(src).match(/p\. (\d+)/) || [])[1] || '?'}` : src);
    for (const s of b.songs) {
      added.push({
        id: s.id, book: b.key, title: s.title, ...(s.roman ? { roman: s.roman } : {}), ...(s.heading && s.heading !== s.title ? { official: s.heading } : {}),
        poet: s.poetOverride || b.poet, lang: s.lang, ...(s.script ? { script: s.script } : {}), cats: s.cats,
        collections: collection ? [collection] : [], sources: [],   // the file + PDF page stays in the book file, for the proofreader
        cite: cite(s.source),
        ...(s.after ? { after: s.after } : { section: SECTION[b.key] }), ...(s.also ? { also: s.also } : {}),
        proofread: s.proofread === true ? true : false, parts: s.parts,
      });
    }
    for (const p of b.present || []) tags.push({ id: p.existingId, collection, source: cite(p.source) });
  }
  return { added, tags };
}
