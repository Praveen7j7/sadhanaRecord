// Vaishnava Songs (phase 22, C2/C3, 26 Oct 2026): the browse tags of every song (poet, language, categories,
// collection) and the songs added in the app (tools/songs/added.mjs), applied to frontend/public/songs/en.json.
// import.mjs runs this after it reads the book; it can also be run alone, any number of times:
//
//   node tools/songs/tags.mjs                       tags + added songs → public/songs/en.json + public/songs/books/*.json
//   node tools/songs/tags.mjs --skip-unproofread    the same, leaving out every added song not yet proofread
//
// Split by book (the head, 26 Oct): en.json is the list (every song's title, poet, tags and first lines) with the English
// book's texts; each added book's texts are in public/songs/books/<book>.json, fetched when one of its songs is opened.
//
// A song gets `"proofread": true` in its tools/songs/books/<book>.json once the head (or the devotee they name) has
// checked it against the printed page (the head, 26 Oct: the songs go live with no marker; the flag is kept for later).
import fs from 'node:fs';
import path from 'node:path';
import { addedSongs } from './added.mjs';

export const CATEGORIES = [
  ['arati', 'Temple programme'], ['prayers', 'Prayers & stotras'], ['name', 'Holy Name'], ['guru', 'Guru & Vaishnavas'],
  ['gaura', 'Gaura & Nitai'], ['krsna', 'Radha & Krishna'], ['surrender', 'Humility & longing'],
];
// the language a song is written in (its text in the app may be Roman letters or Devanagari: `script`)
export const LANGUAGES = [['bn', 'Bengali'], ['sa', 'Sanskrit'], ['hi', 'Hindi'], ['en', 'English']];
// Phase 23 (the head, 27 Oct: "switches for prayers, for songs, for bhajans"): the kind of song, one tap in the list.
// It follows the language: Sanskrit = prayers (stotras, praṇāmas, aṣṭakas), Bengali / Brajabuli = the ācāryas' songs,
// Hindi = bhajans. Āratis are the category `arati`, a filter that may overlap the three (not a type of its own).
export const TYPES = [['prayer', 'Prayers'], ['song', 'Songs'], ['bhajan', 'Bhajans'], ['arati', 'Āratis']];
const TYPE_OF_LANG = { sa: 'prayer', bn: 'song', hi: 'bhajan' };
export const typeOf = (s) => TYPE_OF_LANG[s.lang] || '';

// the book's "Author:" spellings → one name per poet
const POET = {
  'Bhaktivinoda Thakur': 'Bhaktivinoda Thakura', 'Narottama Das Thakura': 'Narottama Dasa Thakura',
  'A.C. Bhaktivedanta Swami (at Boston Harbor, September 18, 1965)': 'A.C. Bhaktivedanta Swami Prabhupada',
  'A.C. Bhaktivedanta Swami (on board the ship Jaladuta, September 13, 1965)': 'A.C. Bhaktivedanta Swami Prabhupada',
  'Locana Das Thakura': 'Locana Dasa Thakura', 'Bhaktisiddhanta Saraswati': 'Bhaktisiddhanta Sarasvati Thakura',
  'Bhaktisiddhanta Saraswti': 'Bhaktisiddhanta Sarasvati Thakura', 'Krsnadasa Kaviraja': 'Krsnadasa Kaviraja Goswami',
  'Krsnadasa Kaviraj Goawami': 'Krsnadasa Kaviraja Goswami', 'Vrndavana Das Thakura': 'Vrndavana Dasa Thakura',
  'Mira Bhāi': 'Mirabai', 'Mira Bai': 'Mirabai', 'Sūra Dasa': 'Surdas', 'Sri Vāsudeva Ghosa': 'Vasudeva Ghosh',
  'Sri Vallabhacarya': 'Vallabhacarya', 'Srila Vidyapati': 'Vidyapati',
  'Sri Srimad Bhakti Raksaka Sridhara Deva Goswami Maharaja': 'Bhakti Raksaka Sridhara Deva Goswami',
};
// a poet the book leaves out or names otherwise: Gopinath parts two and three are Bhaktivinoda's like part one;
// the Damodarastakam is spoken by Satyavrata Muni (the book lists Vyasadeva, who recorded it in the Padma Purana)
// Hari He Dayala Mor has no poet in the book; Songs of the Vaiṣṇava Ācāryas (BBT, p. 58) gives Narottama dāsa Ṭhākura
const POET_OF = { s036: 'Bhaktivinoda Thakura', s037: 'Bhaktivinoda Thakura', s107: 'Satyavrata Muni', s149: 'Narottama Dasa Thakura' };

// the songs of the English book that are also in Songs of the Vaiṣṇava Ācāryas (BBT, 1974), with its page (C4: the
// BBT book adds no song the app lacks; its "Jaya Rādhā-Govinda" (p. 78) is the app's s151 in another order of verses)
const SVA = { s001: 1, s002: 14, s134: 19, s007: 24, s072: 28, s044: 29, s033: 30, s035: 31, s036: 31, s037: 31, s038: 35,
  s056: 36, s013: 37, s065: 38, s011: 39, s045: 40, s046: 41, s070: 43, s023: 46, s015: 48, s075: 49, s071: 50, s061: 51,
  s073: 52, s074: 54, s079: 56, s085: 57, s149: 58, s082: 59, s084: 60, s092: 62, s087: 63, s081: 64, s009: 68, s093: 69,
  s091: 71, s094: 74, s098: 75, s118: 76, s151: 78, s107: 79, s106: 82, s116: 84, s125: 85, s104: 86, s006: 88, s156: 89,
  s003: 90, s124: 90 };
const SVA_NAME = 'Songs of the Vaiṣṇava Ācāryas (BBT)';

// a book name (before its "(Section: …)") → the collection's name as people write it
const COLLECTION = {
  'Gitavali': 'Gītāvalī', 'Saranagati': 'Śaraṇāgati', 'Prema Bhakti Candrika': 'Prema-bhakti-candrikā',
  'Kalyana Kalpataru': 'Kalyāṇa-kalpataru', 'Prarthana': 'Prārthanā', 'Gitamala': 'Gītamālā', 'Stavamala': 'Stavamālā',
  'Stavavali': 'Stavāvalī', 'Stavamrta Lahari': 'Stavāmṛta-laharī', 'Gita Govinda': 'Gīta-govinda',
  'Caitanya Caritamrta': 'Caitanya-caritāmṛta', 'Caitanya Mangala': 'Caitanya-maṅgala', 'Brahma Samhita': 'Brahma-saṁhitā',
  'Bhagavata Purana': 'Śrīmad-Bhāgavatam', 'Padma Purana': 'Padma Purāṇa',
};

// every song of the book: categories (comma-separated) and language. Sanskrit / Bengali / Hindi is the language of
// the verses; the Brajabuli songs (Govinda Dasa, Vidyapati, Narottama's Gora Pahun) are sung as Bengali and listed so.
const TAGS = `
s001 prayers sa|s002 arati,guru sa|s003 arati,prayers sa|s004 arati,prayers sa|s005 prayers sa|s006 arati bn|s007 prayers,name sa
s008 name en|s009 guru,arati bn|s010 prayers,krsna sa|s011 krsna,name bn|s012 arati sa|s013 arati bn|s014 arati bn
s015 arati,gaura bn|s016 surrender bn|s017 krsna bn|s018 surrender bn|s019 surrender bn|s020 surrender bn|s021 surrender bn
s022 surrender bn|s023 arati,gaura bn|s024 surrender bn|s025 arati,gaura bn|s026 surrender bn|s027 name bn|s028 name,gaura bn
s029 name,gaura bn|s030 surrender bn|s031 surrender bn|s032 surrender bn|s033 name,gaura bn|s034 name,gaura bn
s035 surrender,krsna bn|s036 surrender,krsna bn|s037 surrender,krsna bn|s038 guru bn|s039 guru bn|s040 guru bn
s041 surrender bn|s042 name bn|s043 arati,krsna bn|s044 name,gaura bn|s045 gaura bn|s046 surrender bn|s047 surrender bn
s048 guru bn|s049 gaura,surrender bn|s050 name,gaura bn|s051 name bn|s052 surrender bn|s053 surrender bn|s054 guru bn
s055 krsna bn|s056 surrender bn|s057 name,gaura bn|s058 name bn|s059 surrender bn|s060 name,gaura bn|s061 guru bn
s062 surrender bn|s063 surrender bn|s064 surrender bn|s065 name,krsna bn|s066 krsna bn|s067 surrender bn
s068 surrender,gaura bn|s069 name bn|s070 guru bn|s071 surrender,krsna bn|s072 name,gaura bn|s073 name,krsna bn
s074 surrender bn|s075 name,krsna bn|s076 gaura sa|s077 gaura bn|s078 gaura bn|s079 guru bn|s080 gaura,surrender bn
s081 gaura bn|s082 gaura bn|s083 gaura,surrender bn|s084 name bn|s085 surrender bn|s086 krsna bn|s087 guru bn|s088 gaura bn
s089 guru,surrender bn|s090 krsna bn|s091 gaura bn|s092 krsna bn|s093 gaura bn|s094 guru,krsna bn|s095 guru bn|s096 guru bn
s097 guru bn|s098 krsna bn|s099 surrender bn|s100 surrender,krsna bn|s101 gaura bn|s102 gaura bn|s103 gaura bn|s104 gaura bn
s105 guru bn|s106 guru bn|s107 prayers,krsna sa|s108 krsna sa|s109 krsna,prayers sa|s110 krsna,prayers sa|s111 gaura bn
s112 gaura bn|s113 gaura bn|s114 prayers sa|s115 krsna,prayers sa|s116 krsna,prayers sa|s117 gaura sa|s118 krsna bn
s119 krsna hi|s120 krsna,prayers sa|s121 krsna,name sa|s122 krsna,prayers sa|s123 name,krsna sa|s124 prayers,krsna sa
s125 krsna sa|s126 krsna,prayers sa|s127 gaura,prayers sa|s128 gaura,prayers sa|s129 gaura,prayers sa|s130 gaura bn
s131 gaura,name bn|s132 guru,surrender sa|s133 krsna sa|s134 guru sa|s135 krsna,surrender bn|s136 guru bn|s137 prayers sa
s138 prayers,krsna sa|s139 krsna sa|s140 krsna sa|s141 gaura bn|s142 krsna bn|s143 krsna bn|s144 krsna bn|s145 gaura,name bn
s146 krsna,prayers hi|s147 gaura bn|s148 surrender bn|s149 surrender bn|s150 krsna,name hi|s151 krsna,name bn|s152 krsna,name hi
s153 krsna,name hi|s154 krsna,prayers sa|s155 krsna bn|s156 arati bn|s157 krsna hi|s158 krsna,prayers sa|s159 krsna bn
s160 krsna bn|s161 krsna,name hi|s162 krsna bn|s163 guru sa|s164 gaura hi|s165 krsna,name hi|s166 krsna bn
s167 krsna,surrender bn|s168 name,krsna hi|s169 krsna hi|s170 name,guru sa`;

const TAG = new Map(TAGS.trim().split(/[|\n]/).map((x) => { const [id, cats, lang] = x.trim().split(' '); return [id, { cats: cats.split(','), lang }]; }));
const LANG = new Set(LANGUAGES.map(([c]) => c)), CAT = new Set(CATEGORIES.map(([c]) => c));

export function collectionOf(book) {
  const name = String(book || '').replace(/\s*\(Section:.*$/, '').replace(/\s*\(Mahabharata\)$/, '').trim();
  return name ? COLLECTION[name] || name : '';
}

/**
 * A song's identity for "the list is not redundant" (the head, 26 Oct): its first two verse lines, folded (lower case,
 * no diacritics, letters and digits only), plus its poet. Two songs that open with the same line but go on differently
 * (Narottama's several "hari hari kabe mora hoibe su-dina") are different songs; the same song in two books is one.
 */
export function songKey(s) {
  const fold = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, '');
  const lines = (s.parts || []).filter((p) => p.v).flatMap((p) => p.v.split('\n')).map((l) => l.trim())
    .filter((l) => l && !/^\(.*\)$/.test(l) && !(/!\)?$/.test(l) && l.split(/\s+/).length <= 3));
  return fold(s.poet || '') + '|' + lines.slice(0, 2).map(fold).join('|');
}

/** Tags every book song and adds the songs transcribed from the official books. Idempotent. */
export function enrich(doc, { skipUnproofread = false } = {}) {
  const book = doc.songs.filter((s) => !s.added);
  for (const s of book) {
    const t = TAG.get(s.id);
    if (!t) throw new Error(`songs/tags: ${s.id} "${s.title}" has no tags`);
    const poet = POET_OF[s.id] || POET[s.author] || s.author || '';
    Object.assign(s, { poet, lang: t.lang, cats: t.cats });
    delete s.collection; delete s.also;
    const col = collectionOf(s.book);
    s.collections = col ? [col] : [];
    s.sources = SVA[s.id] ? [`${SVA_NAME}, p. ${SVA[s.id]}`] : [];
  }
  const byId = new Map(book.map((s) => [s.id, s]));
  const { added: all, tags } = addedSongs();
  // a book's song that the English book already has: one song, the book added as its collection and source
  for (const t of tags) {
    const s = byId.get(t.id);
    if (!s) throw new Error(`songs/tags: a book lists ${t.id} as present, which is not in the English book`);
    if (t.collection && !s.collections.includes(t.collection)) s.collections.push(t.collection);
    if (t.source && !s.sources.includes(t.source)) s.sources.push(t.source);
  }
  const added = all.filter((a) => !skipUnproofread || a.proofread).map((a) => ({ ...a, added: true, parts: a.parts.map((p) => ({ ...p })) }));
  for (const a of added) if (a.also) { const o = byId.get(a.also); if (o) o.also = a.id; }
  for (const s of [...book, ...added]) {
    if (!LANG.has(s.lang)) throw new Error(`songs/tags: ${s.id} has an unknown language ${s.lang}`);
    if (!s.cats.length || !s.cats.every((c) => CAT.has(c))) throw new Error(`songs/tags: ${s.id} has an unknown category ${s.cats}`);
    if (!s.collections.length) delete s.collections;
    if (!s.sources.length) delete s.sources;
    if (typeOf(s)) s.type = typeOf(s); else delete s.type;
  }
  // no song twice (the same first lines and poet), and no id twice
  const seen = new Map();
  for (const s of [...book, ...added]) {
    if (seen.has('id:' + s.id)) throw new Error(`songs/tags: id ${s.id} is used twice`);
    seen.set('id:' + s.id, s.id);
    const k = songKey(s);
    if (seen.has(k)) throw new Error(`songs/tags: ${s.id} "${s.title}" is the same song as ${seen.get(k)}`);
    seen.set(k, s.id);
  }
  // sections: the book's own (without added songs), then each added song after its `after` song, or in its book's section
  const sections = doc.sections.map((sec) => ({ title: sec.title, songs: sec.songs.filter((id) => byId.has(id)) }));
  for (const a of added) {
    if (a.after) {
      const sec = sections.find((x) => x.songs.includes(a.after));
      if (!sec) throw new Error(`songs/tags: ${a.id} goes after ${a.after}, which is in no section`);
      const at = sec.songs.indexOf(a.after);
      sec.songs.splice(at + 1 + sec.songs.slice(at + 1).filter((id) => added.some((x) => x.id === id && x.after === a.after)).length, 0, a.id);
      a.section = sec.title;
    } else {
      let sec = sections.find((x) => x.title === a.section);
      if (!sec) sections.push((sec = { title: a.section, songs: [] }));
      sec.songs.push(a.id);
    }
  }
  for (const a of added) delete a.after;
  const byAll = new Map([...book, ...added].map((s) => [s.id, s]));
  doc.sections = sections.filter((x) => x.songs.length);
  if (new Set(doc.sections.map((x) => x.title)).size !== doc.sections.length) throw new Error('songs/tags: a section title is used twice');
  doc.songs = doc.sections.flatMap((x) => x.songs).map((id) => byAll.get(id));   // the book's order, the list's order
  doc.count = doc.songs.length;
  doc.categories = CATEGORIES;
  doc.languages = LANGUAGES;
  doc.types = TYPES;
  return doc;
}

// books whose texts stay in the list file (one short song, beside its Roman twin)
const INLINE = new Set(['hindi']);

/** The first two verse lines of a song: what the list shows and searches when its text is in a book file. */
export function firstLines(s) {
  return (s.parts || []).filter((p) => p.v).flatMap((p) => p.v.split('\n')).map((l) => l.trim())
    .filter((l) => l && !/^\(.*\)$/.test(l)).slice(0, 2).join('\n');
}

/** The full song book → the list file (texts of the English book only) and one texts file per added book. */
export function split(doc) {
  const books = {};
  const songs = doc.songs.map((s) => {
    if (!s.added || INLINE.has(s.book)) { const { book, ...rest } = s; return rest; }
    (books[s.book] ||= { book: s.book, songs: {} }).songs[s.id] = s.parts;
    const { parts, ...rest } = s;
    return { ...rest, first: firstLines(s) };
  });
  return { index: { ...doc, songs, books: Object.keys(books) }, books };
}

/** The list file and the book files back into one song book (tests; and the start of the next run). */
export function join(index, books) {
  const doc = { ...index, songs: index.songs.map((s) => (s.parts ? s : { ...s, parts: books[s.book]?.songs[s.id] })) };
  delete doc.books;
  for (const s of doc.songs) delete s.first;
  return doc;
}

export const OUT = path.resolve(new URL('../../frontend/public/songs/en.json', import.meta.url).pathname);
/** Writes the list file and the book files (removing a book file no longer used). */
export function writeSongs(doc, out = OUT) {
  const dir = path.join(path.dirname(out), 'books');
  const { index, books } = split(doc);
  fs.writeFileSync(out, JSON.stringify(index));
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json') && !books[f.slice(0, -5)]) fs.unlinkSync(path.join(dir, f));
  for (const [k, b] of Object.entries(books)) fs.writeFileSync(path.join(dir, k + '.json'), JSON.stringify(b));
  return { index, books };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const doc = enrich(JSON.parse(fs.readFileSync(OUT, 'utf8')), { skipUnproofread: process.argv.includes('--skip-unproofread') });
  const { books } = writeSongs(doc);
  const kb = (f) => Math.round(fs.statSync(f).size / 1024) + ' KB';
  const n = doc.songs.filter((s) => s.added).length;
  console.log(`${doc.count} songs (${n} added) → ${OUT} (${kb(OUT)}); books: ${Object.keys(books).map((k) => k + ' ' + kb(path.join(path.dirname(OUT), 'books', k + '.json'))).join(', ')}`);
}
