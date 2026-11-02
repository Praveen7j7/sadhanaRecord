// Vaishnava Songs (phase 21, 23 Oct 2026): the English song book as data (public/songs/en.json, made by
// tools/songs/import.mjs, then tagged by tools/songs/tags.mjs), fetched once when the Songs screen opens and kept by
// the service worker after that. The Hindi book is its PDF only: its text is in an old font encoding.
// Phase 22 (26 Oct, C2–C4): every song carries poet, lang, cats and (when known) collections (the works it belongs to)
// and sources (the other printed books it is in); the songs transcribed from the official books (tools/songs/books/)
// carry `added` and `proofread`. The list browses by poet, language, category and collection.

// `file`: the name the phone saves the PDF under (the link's download attribute; same origin, so it is honoured)
export const BOOKS = [
  { lang: 'en', label: 'English', url: '/songs/vaishnava-songs-en.pdf', file: 'Vaishnava-Songs-English.pdf', pages: 115 },
  { lang: 'hi', label: 'हिन्दी', url: '/songs/vaishnava-songs-hi.pdf', file: 'Vaishnava-Songs-Hindi.pdf', pages: 149 },
];

/** The lead's switch: true shows "Awaiting proofreading" on a song not yet checked. Off: the head, 26 Oct ("live, no
 *  marker"); each song keeps its `proofread` flag in tools/songs/books/ for later. */
export const SHOW_PROOF_MARK = false;
export const awaitsProof = (s) => SHOW_PROOF_MARK && s?.proofread === false;

let doc = null, pending = null;

/** The list's last search words and filters, kept for this visit: "All songs" returns to them. */
export const lastSearch = { q: '', type: '', lang: '', poet: '', cat: '', col: '' };

// each data file's content hash (vite.config.js), so a changed file has a new address (Phase 24, U1); none in the tests
const SONGS_V = typeof __SONGS_V__ === 'object' && __SONGS_V__ ? __SONGS_V__ : {};
const versioned = (u, key) => (SONGS_V[key] ? `${u}?v=${SONGS_V[key]}` : u);

/** The song book (cached for the session); rejects when there is no connection and no kept copy. */
export function loadSongs(fetcher = (u) => fetch(u)) {
  if (doc) return Promise.resolve(doc);
  if (!pending) {
    pending = fetcher(versioned('/songs/en.json', 'en'))
      .then((r) => { if (!r.ok) throw new Error('songs ' + r.status); return r.json(); })
      .then((d) => (doc = index(d)))
      .finally(() => { pending = null; });
  }
  return pending;
}

/** Letters only, no diacritics, lower case: "Gopīnātha" and "gopinath" meet. */
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").toLowerCase();

/**
 * fold, plus the ways people type these names: "Damodarashtakam" meets "Damodarastakam", "Krishna" meets "Krsna",
 * "Vrindavan" meets "Vrndavana". Devanagari: chandrabindu = anusvara, the nukta dropped. Used on both sides of a search.
 */
export const loose = (s) => fold(s).replace(/ँ/g, 'ं').replace(/़/g, '')
  .replace(/krishn/g, 'krsn').replace(/rishi/g, 'rsi').replace(/vrind/g, 'vrnd').replace(/amrit/g, 'amrt')
  .replace(/sh/g, 's').replace(/ch/g, 'c').replace(/ph/g, 'f').replace(/w/g, 'v').replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u');

const WORD = /[^a-z0-9'ऀ-ॿ]+/;

function index(d) {
  d.byId = new Map(d.songs.map((s) => [s.id, s]));
  for (const s of d.songs) indexSong(s);
  d.categories ||= [];
  d.languages ||= [];
  d.types ||= [];
  return d;
}

// a song's search keys; a song whose text is still in its book file searches by its first lines until it arrives
function indexSong(s) {
  s.cats ||= [];
  s.collections ||= [];
  s.sources ||= [];
  s.key = loose([s.title, s.roman, s.official, s.author, s.poet, s.by, ...s.collections].filter(Boolean).join(' '));
  s.text = s.parts ? s.parts.filter((p) => p.v).map((p) => p.v).join('\n') : s.first || '';
  s.fold = loose(s.text);
}

// Split by book (the head, 26 Oct): an added book's texts are in /songs/books/<book>.json, fetched the first time one of
// its songs is opened, then kept by the service worker like the list.
const bookLoads = new Map();
/** Resolves once this song's text is here (at once for the English book's songs); rejects with no connection. */
export function loadText(d, song, fetcher = (u) => fetch(u)) {
  if (!song || song.parts) return Promise.resolve(song);
  if (!bookLoads.has(song.book)) {
    bookLoads.set(song.book, fetcher(versioned(`/songs/books/${song.book}.json`, song.book))
      .then((r) => { if (!r.ok) throw new Error('songs ' + r.status); return r.json(); })
      .then((b) => { for (const [id, parts] of Object.entries(b.songs)) { const s = d.byId.get(id); if (s && !s.parts) { s.parts = parts; indexSong(s); } } })
      .catch((e) => { bookLoads.delete(song.book); throw e; }));
  }
  return bookLoads.get(song.book).then(() => song);
}

/** Does the song pass the chosen type, language, poet, category and collection ('' = any)? Āratis is the category. */
export const matches = (s, f = {}) => (!f.type || (f.type === 'arati' ? s.cats.includes('arati') : s.type === f.type))
  && (!f.lang || s.lang === f.lang) && (!f.poet || s.poet === f.poet)
  && (!f.cat || s.cats.includes(f.cat)) && (!f.col || s.collections.includes(f.col));

/** The list's sections with only the songs that pass the filters (empty sections left out): a filter keeps the book's grouping. */
export function groupBy(d, f = {}) {
  return d.sections.map((sec) => ({ title: sec.title, songs: sec.songs.filter((id) => matches(d.byId.get(id), f)) })).filter((x) => x.songs.length);
}

/**
 * Songs matching every word of q (and the filters), the strongest first: a title / poet match before a match in the
 * verses. Each hit carries the verse line that matched (for the row's second line), or '' when the title did.
 */
export function searchSongs(d, q, limit = 60, f = {}) {
  const words = loose(q).split(WORD).filter((w) => w.length > 1);
  if (!words.length) return [];
  const hits = [];
  for (const s of d.songs) {
    if (!matches(s, f)) continue;
    const inKey = words.every((w) => s.key.includes(w));
    if (!inKey && !words.every((w) => s.key.includes(w) || s.fold.includes(w))) continue;
    let line = '';
    if (!inKey) {
      const lines = s.text.split('\n'), folded = s.fold.split('\n');
      const at = folded.findIndex((l) => words.some((w) => l.includes(w)));
      line = at >= 0 ? lines[at] : '';
    }
    hits.push({ song: s, line, rank: inKey ? (loose(s.title + ' ' + (s.roman || '')).startsWith(words[0]) ? 0 : 1) : 2 });
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, limit);
}

/** The list for a search and/or filters: search hits when there are words, else every song that passes, in book order. */
export function browse(d, q, f = {}) {
  if (String(q || '').trim()) return searchSongs(d, q, 60, f);
  return d.songs.filter((s) => matches(s, f)).map((song) => ({ song, line: '', rank: 0 }));
}

const counted = (m) => [...m.entries()];
/**
 * The choices to browse by, each with its number of songs: poets (most songs first), collections (most first),
 * categories and languages (the data's order; a language with a single song is left out of the choice).
 */
export function facets(d) {
  const poets = new Map(), cols = new Map(), cats = new Map(), langs = new Map(), types = new Map();
  for (const s of d.songs) {
    if (s.poet) poets.set(s.poet, (poets.get(s.poet) || 0) + 1);
    for (const c of s.collections) cols.set(c, (cols.get(c) || 0) + 1);
    for (const c of s.cats) cats.set(c, (cats.get(c) || 0) + 1);
    langs.set(s.lang, (langs.get(s.lang) || 0) + 1);
    if (s.type) types.set(s.type, (types.get(s.type) || 0) + 1);
    if (s.cats.includes('arati')) types.set('arati', (types.get('arati') || 0) + 1);
  }
  const byCount = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]);
  return {
    poets: counted(poets).sort(byCount),
    collections: counted(cols).sort(byCount),
    categories: d.categories.filter(([c]) => cats.has(c)).map(([c, label]) => [c, label, cats.get(c)]),
    languages: d.languages.filter(([c]) => (langs.get(c) || 0) > 1).map(([c, label]) => [c, label, langs.get(c)]),
    types: d.types.filter(([c]) => types.has(c)).map(([c, label]) => [c, label, types.get(c)]),
  };
}

/** The label of a category / language code ('' when unknown). */
export const labelOf = (list, code) => (list.find(([c]) => c === code) || [])[1] || '';

/** The songs before and after this one, in the book's order. */
export function neighbours(d, id) {
  const i = d.songs.findIndex((s) => s.id === id);
  return { prev: i > 0 ? d.songs[i - 1] : null, next: i >= 0 && i < d.songs.length - 1 ? d.songs[i + 1] : null };
}
