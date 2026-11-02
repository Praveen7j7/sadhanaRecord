// Vaishnava Songs (phase 21): the imported book and its search, on the real public/songs/en.json.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadSongs, loadText, groupBy, matches, searchSongs, neighbours, fold, loose, browse, facets, awaitsProof, SHOW_PROOF_MARK, BOOKS } from '../src/lib/songs.js';
import { enrich, songKey, split, join, typeOf, TYPES } from '../../tools/songs/tags.mjs';
import { gzipSync } from 'node:zlib';
import { readBooks } from '../../tools/songs/added.mjs';
import { allowed } from '../src/routes.js';
import { navFor } from '../src/lib/nav.js';

const raw = fs.readFileSync(new URL('../public/songs/en.json', import.meta.url), 'utf8');
// the app's fetches, served from public/ (the list, and each book's texts file); `asked` records every URL fetched
const asked = [];
const fetcher = async (u) => { asked.push(u); const f = new URL('../public' + u, import.meta.url); return fs.existsSync(f) ? { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) } : { ok: false, status: 404 }; };
const bookFiles = () => Object.fromEntries(JSON.parse(raw).books.map((k) => [k, JSON.parse(fs.readFileSync(new URL(`../public/songs/books/${k}.json`, import.meta.url), 'utf8'))]));
const full = () => join(JSON.parse(raw), bookFiles());   // the whole song book, every text

describe('the song book', () => {
  it('holds every section and song of the English book, each with verses', async () => {
    const d = await loadSongs(fetcher);
    expect(d.count).toBe(d.songs.length);
    expect(d.songs.length).toBeGreaterThanOrEqual(165);
    expect(d.sections.map((s) => s.title)).toEqual(expect.arrayContaining(['Pranama Mantras', 'Temple Program Prayers', 'Songs by Bhaktivinoda Thakura', 'Songs by Narottama Das Thakura']));
    for (const s of full().songs) {
      expect(s.parts.some((p) => p.v), s.title).toBe(true);
      s.text = s.parts.filter((p) => p.v).map((p) => p.v).join('\n');
      // no detail line leaked into the verses (the importer's main risk)
      expect(s.text, s.title).not.toMatch(/^(Song Name|Author|Book Name|Official Name):/m);
      // nor a line of the book's contents or indexes ("Ajna Tahal ......40"), nor its back cover
      expect(s.parts.map((p) => p.v || p.t || '').join('\n'), s.title).not.toMatch(/\.{4,}\s*\d+\s*$|iskcondesiretree/m);
    }
    // every song is in exactly one section
    expect(d.sections.flatMap((s) => s.songs).sort()).toEqual(d.songs.map((s) => s.id).sort());
  });
  it('keeps the details of a well-known song', async () => {
    const d = await loadSongs(fetcher);
    const s = d.songs.find((x) => x.title === 'Gopinath Mama Nivedana Suno');
    expect(s).toBeTruthy();
    expect(s.author).toMatch(/Bhaktivinoda/);
    expect(s.section).toBe('Songs by Bhaktivinoda Thakura');
    expect(s.parts.some((p) => p.t)).toBe(true);
  });
});

describe('search', () => {
  it('finds a title with or without the diacritics', async () => {
    const d = await loadSongs(fetcher);
    expect(fold('Gopīnātha')).toBe('gopinatha');
    const hits = searchSongs(d, 'gopinath');
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits[0].song.title).toMatch(/^Gopinath/);
    expect(hits[0].line).toBe('');   // a title match shows the author, not a verse line
  });
  it('finds a song by a line of its verses, and shows that line', async () => {
    const d = await loadSongs(fetcher);
    const hits = searchSongs(d, 'ceto darpana marjanam');
    expect(hits.map((h) => h.song.title)).toContain('Ceto Darpana Marjanam');
    const byVerse = searchSongs(d, 'bhava maha davagni');
    expect(byVerse.length).toBeGreaterThan(0);
    expect(fold(byVerse[0].line)).toMatch(/dav/);
  });
  it('ranks a title match before a verse match, and needs every word', async () => {
    const d = await loadSongs(fetcher);
    const hits = searchSongs(d, 'radha');
    const firstVerse = hits.findIndex((h) => h.rank === 2);
    expect(hits.slice(0, firstVerse < 0 ? hits.length : firstVerse).every((h) => h.rank < 2)).toBe(true);
    expect(searchSongs(d, 'gopinath zzzz')).toEqual([]);
    expect(searchSongs(d, ' ')).toEqual([]);
  });
});

describe('around a song', () => {
  it('links to the songs before and after it, in the book order', async () => {
    const d = await loadSongs(fetcher);
    const { prev, next } = neighbours(d, d.songs[1].id);
    expect(prev.id).toBe(d.songs[0].id);
    expect(next.id).toBe(d.songs[2].id);
    expect(neighbours(d, d.songs[0].id).prev).toBe(null);
    expect(neighbours(d, d.songs.at(-1).id).next).toBe(null);
  });
  it('offers both books as PDFs that exist', () => {
    for (const b of BOOKS) expect(fs.existsSync(new URL('../public' + b.url, import.meta.url)), b.url).toBe(true);
  });
});

// Phase 22 (26 Oct 2026, C1–C5): browse by poet / language / category / book, the songs transcribed from the official
// books, no song twice, the download
const VSB = 170;   // s001–s170: the English song book; their ids are links people keep
describe('browse tags (C2)', () => {
  it('gives every song a language, its categories and, when the book names one, its poet', async () => {
    const d = await loadSongs(fetcher);
    const langs = new Set(d.languages.map(([c]) => c)), cats = new Set(d.categories.map(([c]) => c));
    for (const s of d.songs) {
      expect(langs.has(s.lang), s.id).toBe(true);
      expect(s.cats.length > 0 && s.cats.every((c) => cats.has(c)), s.id).toBe(true);
      if (s.author) expect(s.poet, s.id).toBeTruthy();
    }
    // one name per poet: the book's spellings meet
    const poets = new Set(d.songs.map((s) => s.poet));
    for (const old of ['Narottama Das Thakura', 'Bhaktivinoda Thakur', 'Mira Bai', 'Mira Bhāi', 'Sūra Dasa', 'Bhaktisiddhanta Saraswti']) expect(poets.has(old), old).toBe(false);
  });
  it('browses by poet, language, category and book, alone or together, in the book’s order', async () => {
    const d = await loadSongs(fetcher);
    const nar = browse(d, '', { poet: 'Narottama Dasa Thakura' });
    expect(nar.length).toBeGreaterThan(50);
    expect(nar.every((h) => h.song.poet === 'Narottama Dasa Thakura')).toBe(true);
    expect(browse(d, '', { lang: 'sa' }).every((h) => h.song.lang === 'sa')).toBe(true);
    const gv = browse(d, '', { col: 'Gītāvalī', cat: 'arati' });
    expect(gv.length).toBeGreaterThan(0);
    expect(gv.every((h) => h.song.collections.includes('Gītāvalī') && h.song.cats.includes('arati'))).toBe(true);
    const order = d.songs.map((s) => s.id);
    expect(gv.map((h) => order.indexOf(h.song.id))).toEqual([...gv.map((h) => order.indexOf(h.song.id))].sort((a, b) => a - b));
    expect(browse(d, 'gopinath', { poet: 'Vrndavana Dasa Thakura' })).toEqual([]);
    expect(browse(d, 'gopinath', { lang: 'bn' }).length).toBeGreaterThanOrEqual(3);
  });
  it('offers each choice with its count, and only choices that have songs', async () => {
    const d = await loadSongs(fetcher);
    const fx = facets(d);
    expect(fx.poets[0][0]).toBe('Bhaktivinoda Thakura');
    expect(fx.poets.every(([, n]) => n > 0)).toBe(true);
    expect(fx.languages.map(([c]) => c)).toEqual(['bn', 'sa', 'hi']);
    expect(fx.collections.map(([c]) => c)).toEqual(expect.arrayContaining(['Gītāvalī', 'Śaraṇāgati', 'Prema-bhakti-candrikā', 'Prārthanā']));
    expect(fx.categories.every(([, label, n]) => label && n > 0)).toBe(true);
  });
  it('finds songs the way people type them', async () => {
    const d = await loadSongs(fetcher);
    expect(loose('Damodarashtakam')).toBe(loose('Dāmodarāṣṭakam'));
    expect(searchSongs(d, 'damodarashtakam').map((h) => h.song.id)).toEqual(expect.arrayContaining(['s107', 's171']));
    expect(searchSongs(d, 'krishna nama dhare').map((h) => h.song.id).length).toBeGreaterThan(0);
    expect(searchSongs(d, 'saranagati', 200).length).toBeGreaterThanOrEqual(50);
    expect(searchSongs(d, 'नमामीश्वरं').map((h) => h.song.id)).toContain('s171');
  });
});

describe('songs from the official books only (C3/C4)', () => {
  it('has no song that is not in one of the books: nothing from memory', async () => {
    const d = await loadSongs(fetcher);
    for (const s of d.songs.filter((x) => x.added)) {
      expect(s.cite, s.id).toMatch(/\(Gaudiya Books\), p\. \d+|Hindi song book/);
      expect(s.proofread, s.id).toBe(false);
      // the head, 26 Oct: live, no marker — the flag is kept, the pill is not shown
      expect(awaitsProof(s), s.id).toBe(false);
    }
    expect(SHOW_PROOF_MARK).toBe(false);
    for (const b of readBooks()) for (const s of b.songs) expect(s.source, s.id).toMatch(/\.pdf, p\. \d+|Hindi song book/);
    for (const gone of ['Surdas', 'Mirabai', 'Tulsidas']) expect(d.songs.some((s) => s.added && s.poet === gone), gone).toBe(false);
    expect(d.sections.map((x) => x.title)).not.toEqual(expect.arrayContaining(['Songs by Surdas']));
    expect(d.sections.map((x) => x.title)).not.toEqual(expect.arrayContaining(['Hindi Bhajans']));
  });
  it('keeps the English book’s ids, and numbers the added songs after them, each in a section', async () => {
    const d = await loadSongs(fetcher);
    for (let n = 1; n <= VSB; n++) expect(d.byId.has('s' + String(n).padStart(3, '0')), String(n)).toBe(true);
    const route = fs.readFileSync(new URL('../src/routes.js', import.meta.url), 'utf8').match(/re: (\/\^\\\/songs[^,]+),/)[1];
    const re = new Function(`return ${route}`)();
    for (const s of d.songs.filter((x) => x.added)) {
      expect(+s.id.slice(1), s.id).toBeGreaterThan(VSB);
      expect(re.test('/songs/' + s.id), s.id).toBe(true);
      expect(d.sections.some((x) => x.songs.includes(s.id)), s.id).toBe(true);
    }
  });
  it('fills the three collections the head named from their books', async () => {
    const d = await loadSongs(fetcher);
    const of = (c) => d.songs.filter((s) => s.collections.includes(c));
    expect(of('Śaraṇāgati').length).toBe(50);
    expect(of('Gītāvalī').length).toBeGreaterThanOrEqual(67);
    expect(of('Prema-bhakti-candrikā').length).toBe(9);
    expect(of('Prema-bhakti-candrikā')[0].id).toBe('s009');
  });
  it('the Devanagari Damodarastakam is the Hindi book’s own text, linked to the Roman one', async () => {
    const d = await loadSongs(fetcher);
    const rom = d.byId.get('s107'), dev = d.byId.get('s171');
    expect(dev.lang).toBe('sa');
    expect(dev.script).toBe('deva');
    expect(dev.cite).toMatch(/Hindi song book/);
    expect([rom.also, dev.also]).toEqual(['s171', 's107']);
    expect(neighbours(d, 's107').next.id).toBe('s171');
    expect(dev.parts.filter((p) => p.v)).toHaveLength(8);
    expect(dev.parts.filter((p) => p.t).every((p) => p.lang === 'hi')).toBe(true);
  });
  it('a verse’s translation follows its verse in the transcribed books', () => {
    for (const b of readBooks()) for (const s of b.songs) {
      expect(s.parts.some((p) => p.v), s.id).toBe(true);
      for (const p of s.parts) expect(Object.keys(p).every((k) => ['v', 't', 'h', 'lang'].includes(k)), s.id).toBe(true);
    }
  });
});

describe('the list is not redundant (C4)', () => {
  it('no two songs share their first lines and poet; no id, section or poet spelling twice', async () => {
    const d = full();
    const keys = new Map();
    for (const s of d.songs) {
      const k = songKey(s);
      expect(keys.get(k), `${s.id} repeats ${keys.get(k)}`).toBeUndefined();
      keys.set(k, s.id);
    }
    expect(new Set(d.songs.map((s) => s.id)).size).toBe(d.songs.length);
    expect(new Set(d.sections.map((s) => s.title)).size).toBe(d.sections.length);
    const fold2 = (x) => fold(x).replace(/[^a-z]/g, '');
    const poets = [...new Set(d.songs.map((s) => s.poet).filter(Boolean))];
    expect(new Set(poets.map(fold2)).size).toBe(poets.length);
  });
  it('the guard is real: the same song twice is refused', () => {
    const doc = JSON.parse(raw);
    doc.songs.find((s) => s.id === 's036').parts = doc.songs.find((s) => s.id === 's035').parts;   // s036 now opens as s035
    expect(() => enrich(doc)).toThrow(/s036 .* same song as s035/);
  });
  it('tagging is repeatable, and a release can leave every unproofread song out', () => {
    const once = enrich(JSON.parse(raw));
    expect(once.count).toBe(JSON.parse(raw).count);
    const strict = enrich(JSON.parse(raw), { skipUnproofread: true });
    expect(strict.songs.some((s) => s.added)).toBe(false);
    expect(strict.songs.find((s) => s.id === 's107').also).toBeUndefined();
    expect(strict.count).toBe(VSB);
    expect(strict.sections.flatMap((x) => x.songs).sort()).toEqual(strict.songs.map((s) => s.id).sort());
  });
});

describe('split by book (the head, 26 Oct)', () => {
  it('the list carries every song’s title, poet, tags and first lines, and only the English book’s texts', () => {
    const idx = JSON.parse(raw);
    expect(gzipSync(raw, { level: 9 }).length).toBeLessThan(180 * 1024);
    for (const s of idx.songs) {
      if (s.parts) continue;
      expect(s.added && idx.books.includes(s.book), s.id).toBe(true);
      expect(s.first, s.id).toBeTruthy();
      expect(s.title && s.poet && s.cats.length, s.id).toBeTruthy();
    }
    expect(idx.songs.filter((s) => !s.added).every((s) => s.parts)).toBe(true);
    expect(idx.books.sort()).toEqual(['gitavali', 'nityanandastaka', 'pbc', 'prarthana', 'saranagati', 'vct-gitavali']);
  });
  it('the list and the book files join back into exactly the tagged book (nothing lost, nothing extra)', () => {
    const whole = enrich(full());
    const again = split(whole);
    expect(again.index.songs.map((s) => s.id)).toEqual(JSON.parse(raw).songs.map((s) => s.id));
    const files = bookFiles();
    for (const [k, b] of Object.entries(again.books)) expect(b).toEqual(files[k]);
    expect(Object.values(files).flatMap((b) => Object.keys(b.songs)).length).toBe(JSON.parse(raw).songs.filter((s) => !s.parts).length);
  });
  it('a song from a book gets its text when it is opened: one fetch per book, then kept', async () => {
    const d = await loadSongs(fetcher);
    const s = d.byId.get('s202'), t = d.byId.get('s203');
    expect(s.parts).toBeUndefined();
    asked.length = 0;
    await loadText(d, s, fetcher);
    await loadText(d, t, fetcher);
    expect(asked).toEqual(['/songs/books/gitavali.json']);
    expect(s.parts.some((p) => p.v) && t.parts.some((p) => p.v)).toBe(true);
    expect(s.text.split('\n').length).toBeGreaterThan(2);   // its search now reaches every verse
    await loadText(d, d.byId.get('s035'), fetcher);          // an English book song needs no fetch
    expect(asked).toHaveLength(1);
  });
  it('a missing book file rejects, and a later try fetches again', async () => {
    const d = await loadSongs(fetcher);
    const s = d.byId.get('s279');
    let n = 0;
    const offline = async () => { n++; return { ok: false, status: 503 }; };
    await expect(loadText(d, s, offline)).rejects.toThrow();
    await loadText(d, s, fetcher);
    expect(n).toBe(1);
    expect(s.parts.length).toBeGreaterThan(0);
  });
  it('search finds every song by its title, poet and first lines without its book file', async () => {
    const d = await loadSongs(fetcher);
    const pr = d.byId.get('s250');
    expect(pr.parts).toBeUndefined();   // Prārthanā's file is not fetched in this file's tests
    expect(searchSongs(d, pr.first.split('\n')[0], 200).map((h) => h.song.id)).toContain('s250');
    expect(searchSongs(d, 'Vrndavana Dasa', 200).map((h) => h.song.id)).toContain('s298');
  });
  it('the service worker keeps the list and each book file, and never precaches them', () => {
    const cfg = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
    const pat = cfg.match(/urlPattern: \(\{ url \}\) => (\/\^\\\/songs[^\n]*?)\.test\(url\.pathname\)/)[1];
    const re = new Function(`return ${pat}`)();
    for (const u of ['/songs/en.json', '/songs/books/gitavali.json', '/songs/books/vct-gitavali.json']) expect(re.test(u), u).toBe(true);
    expect(re.test('/songs/vaishnava-songs-en.pdf')).toBe(false);
    expect(cfg).toMatch(/globPatterns: \['\*\*\/\*\.\{js,css,html,svg,png,webp,webmanifest\}'\]/);   // no json in the install
  });
});

// Phase 23 (the head, 27 Oct: "switches for prayers, for songs, for bhajans … filter by composer")
describe('one-tap switches: type and composer (phase 23)', () => {
  it('every song carries its type in the data, from its language: Sanskrit prayers, Bengali songs, Hindi bhajans', () => {
    const idx = JSON.parse(raw);
    expect(idx.types).toEqual(TYPES);
    for (const s of idx.songs) {
      const want = { sa: 'prayer', bn: 'song', hi: 'bhajan' }[s.lang];
      if (want) expect(s.type, s.id).toBe(want); else expect(s.type, s.id).toBeUndefined();
      expect(typeOf(s), s.id).toBe(want || '');
    }
    expect(idx.songs.find((s) => s.id === 's107').type).toBe('prayer');
    expect(idx.songs.find((s) => s.id === 's035').type).toBe('song');
  });
  it('the Type chips carry their counts; Āratis is the category and overlaps the others', async () => {
    const d = await loadSongs(fetcher);
    const t = Object.fromEntries(facets(d).types.map(([c, , n]) => [c, n]));
    expect(Object.keys(t)).toEqual(['prayer', 'song', 'bhajan', 'arati']);
    expect(t.prayer).toBe(d.songs.filter((s) => s.lang === 'sa').length);
    expect(t.song).toBe(d.songs.filter((s) => s.lang === 'bn').length);
    expect(t.bhajan).toBe(d.songs.filter((s) => s.lang === 'hi').length);
    expect(t.arati).toBe(d.songs.filter((s) => s.cats.includes('arati')).length);
    const aratis = browse(d, '', { type: 'arati' }).map((h) => h.song);
    expect(aratis.some((s) => s.type === 'prayer') && aratis.some((s) => s.type === 'song')).toBe(true);
    expect(browse(d, '', { type: 'bhajan' }).every((h) => h.song.lang === 'hi')).toBe(true);
  });
  it('the Composer chips are the main poets, most songs first; the rest stay in the wheel', async () => {
    const d = await loadSongs(fetcher);
    const poets = facets(d).poets;
    expect(poets.slice(0, 3).map(([p]) => p)).toEqual(['Bhaktivinoda Thakura', 'Narottama Dasa Thakura', 'Visvanatha Cakravarti Thakura']);
    expect(poets.map(([, n]) => n)).toEqual([...poets.map(([, n]) => n)].sort((a, b) => b - a));
  });
  it('a type or composer with no words keeps the book’s sections, each with only its matching songs and its count', async () => {
    const d = await loadSongs(fetcher);
    const f = { type: 'song', poet: 'Narottama Dasa Thakura' };
    const g = groupBy(d, f);
    expect(g.length).toBeGreaterThan(1);
    expect(g.every((sec) => sec.songs.length > 0 && sec.songs.every((id) => matches(d.byId.get(id), f)))).toBe(true);
    expect(g.reduce((n, sec) => n + sec.songs.length, 0)).toBe(browse(d, '', f).length);
    const order = d.sections.map((x) => x.title);
    expect(g.map((x) => order.indexOf(x.title))).toEqual([...g.map((x) => order.indexOf(x.title))].sort((a, b) => a - b));
    expect(groupBy(d, {})).toHaveLength(d.sections.length);
  });
  it('the screen keeps type in the address with the other filters, and a second tap clears a chip', () => {
    const src = fs.readFileSync(new URL('../src/screens/Songs.svelte', import.meta.url), 'utf8');
    expect(src).toMatch(/const KEYS = \['q', 'type', 'lang', 'poet', 'cat', 'col'\];/);
    expect(src).toMatch(/const toggle = \(cur, v\) => \(cur === v \? '' : v\);/);
    expect(src).toMatch(/onclick=\{\(\) => \(type = toggle\(type, c\)\)\}/);
    expect(src).toMatch(/onclick=\{\(\) => \(poet = toggle\(poet, p\)\)\}/);
    expect(src).not.toMatch(/id="sg-lang"/);   // the type replaces the language switch
  });
});

describe('the song books download (C1)', () => {
  it('names the saved file, same origin', () => {
    for (const b of BOOKS) { expect(b.file).toMatch(/^Vaishnava-Songs-\w+\.pdf$/); expect(b.url.startsWith('/songs/')).toBe(true); }
  });
});

describe('who has the songs (C5)', () => {
  // the head, 26 Oct: "only visible to the user's login" — someone with their own sadhana form, not a staff-only login
  // the scopes' shape as tests/nav.test.js has it (auth.me)
  const DEV = { devotee: { batchId: 'SPS' }, groupLeader: null, facilitator: null, coordinator: [], master: false };
  const COORD = { devotee: null, groupLeader: null, facilitator: null, coordinator: ['SPS'], master: false };
  const MASTER = { devotee: null, groupLeader: null, facilitator: null, coordinator: [], master: true };
  const COORD_DEV = { ...DEV, coordinator: ['SPS'] }, MASTER_DEV = { ...DEV, master: true };
  const inMenu = (sc) => navFor(sc).sections.flatMap((x) => x.items).some((i) => i.id === 'songs');
  it('a devotee (and staff who fill their own sadhana) has Songs in the menu and opens it', () => {
    for (const sc of [DEV, COORD_DEV, MASTER_DEV]) { expect(inMenu(sc)).toBe(true); expect(allowed('/songs', sc)).toBe(true); expect(allowed('/songs/s171', sc)).toBe(true); }
  });
  it('a staff-only or head-only login has neither the entry nor the route', () => {
    for (const sc of [COORD, MASTER]) { expect(inMenu(sc)).toBe(false); expect(allowed('/songs', sc)).toBe(false); expect(allowed('/songs/s001', sc)).toBe(false); }
  });
});
