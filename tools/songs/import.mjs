// Vaishnava Songs (phase 21, 23 Oct 2026): turns the English song book (ISKCON Desire Tree, compiled by ISKCON
// Chowpatty) into frontend/public/songs/en.json, the data behind the Songs screen.
//
//   swift tools/songs/pdftext.swift <Vaishnava-song-book.pdf> 1 999 > /tmp/songs-en.txt
//   node tools/songs/import.mjs /tmp/songs-en.txt
//
// The book's layout, as the PDF gives it: every page starts "ISKCON desire tree" and ends with its own number "(n)";
// each song starts "Song Name:", then optional "Official Name:", "Author:" / "Composed By:" / "Spoken by:" / "Sung by:",
// "Book Name:", any of which can wrap onto the next line; then the verses, then "TRANSLATION". The pages before the
// first "Song Name:" are the Pranama Mantras, kept as one entry. The Hindi book's text is in an old font encoding
// (it extracts as gibberish), so it is offered as its PDF only.
import fs from 'node:fs';
import path from 'node:path';
import { enrich, writeSongs } from './tags.mjs';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/songs/import.mjs <text from pdftext.swift>'); process.exit(1); }
const OUT = path.resolve(new URL('../../frontend/public/songs/en.json', import.meta.url).pathname);

// 1. pages → clean lines (no page header, no page number)
const pages = fs.readFileSync(src, 'utf8').split(/^=== page (\d+)$/m);
const lines = [];   // { t, page }
for (let i = 1; i < pages.length; i += 2) {
  const page = +pages[i];
  const ls = pages[i + 1].split('\n').map((l) => l.replace(/\s+$/, '').replace(/￼/g, ''));
  while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
  if (ls.length && ls[ls.length - 1].trim() === `(${page})`) ls.pop();
  // the last page carries its number at the top, under the header
  const top = ls.findIndex((l) => l.trim() && l.trim() !== 'ISKCON desire tree');
  if (top >= 0 && ls[top].trim() === `(${page})`) ls.splice(top, 1);
  for (const t of ls) if (t.trim() && t.trim() !== 'ISKCON desire tree') lines.push({ t: t.trim(), page });
}

// 2. the book's own index (page 4–6): every title, used to rejoin a wrapped "Song Name:"
const start = lines.findIndex((l) => l.t === 'INDEX:');
const titles = new Set();
for (let i = start + 1; i < lines.length && lines[i].page <= 6; i++) {
  const m = lines[i].t.match(/^(.+), \d+$/);
  if (m) titles.add(norm(m[1]));
}
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘'`]/g, "'").replace(/\s+/g, ' ').trim(); }

// 3. sections ("Songs by …") from the contents list, so a section heading that wraps is matched whole
const SECTIONS = [];
for (const l of lines) {
  if (l.page > 3) break;
  const m = l.t.match(/^(Songs by .+?|Pranama Mantras|Temple Program Prayers|Miscellaneous Bhajans and Chants)\s*\.{2,}\s*\d+$/) || l.t.match(/^(Songs by .+?)\d+$/);
  if (m) SECTIONS.push(m[1].trim());
}

const KEYS = { 'Song Name': 'title', 'Official Name': 'official', 'Author': 'author', 'Composed By': 'author', 'Spoken by': 'by', 'Spoken By': 'by', 'Sung by': 'by', 'Book Name': 'book' };
const keyOf = (t) => { const m = t.match(/^([A-Z][A-Za-z ]+?):\s*(.*)$/); return m && KEYS[m[1]] ? [KEYS[m[1]], m[2]] : null; };
const open = (s) => (s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length;
const authors = new Set(SECTIONS.filter((s) => s.startsWith('Songs by ')).map((s) => norm(s.slice(9))));

// 4. walk: sections, the front pages, songs
const songs = [];
let section = '', cur = null;
const body = [];
const first = lines.findIndex((l, i) => i > start && l.t === 'Pranama Mantras');
let front = null;
const flush = () => {
  if (!cur) return;
  cur.body = body.splice(0);
  songs.push(cur); cur = null;
};
for (let i = first; i < lines.length; i++) {
  const { t, page } = lines[i];
  // the book ends with an index by official name: not a song
  if (/^INDEX: \(Official/.test(t)) break;
  // a section heading (possibly wrapped over two lines)
  const sec = SECTIONS.find((s) => s === t || (s.startsWith(t) && t.length > 8 && s === `${t} ${lines[i + 1]?.t}`));
  if (sec && !(sec === 'Miscellaneous Bhajans and Chants')) {
    if (front) { songs.push(front); front = null; }
    flush(); section = sec; if (sec !== t) i++;
    // the front pages: the Pranama Mantras have no "Song Name:", so the whole section is one entry
    if (sec === 'Pranama Mantras') front = { title: sec, section: sec, page, body: [] };
    continue;
  }
  const k = keyOf(t);
  if (k && k[0] === 'title') {
    if (front) { songs.push(front); front = null; }
    flush();
    cur = { title: k[1], section: section || 'Temple Program Prayers', page };
    // The details block runs until the verses start. A line belongs to it when it is a detail ("Author: …"), when
    // another detail follows within three lines (a wrapped value), when the value so far has an open bracket, or when
    // it completes the title as the book's index spells it or an author's name as the contents spell it.
    const detailSoon = (j) => [1, 2, 3].some((d) => { const x = lines[j + d] && keyOf(lines[j + d].t); return x && x[0] !== 'title'; });
    let last = 'title';
    while (lines[i + 1]) {
      const n = lines[i + 1].t, nk = keyOf(n);
      if (nk && nk[0] === 'title') break;
      if (nk) {
        // "Spoken by" / "Sung by" next to an "Author": keep both
        if (nk[0] === 'author' && cur.author) { cur.by = cur.author; }
        cur[nk[0]] = nk[1]; last = nk[0]; i++; continue;
      }
      const val = cur[last] || '';
      const titleWrap = last === 'title' && [...titles].some((x) => x.startsWith(norm(`${val} ${n}`)));
      const authorWrap = last === 'author' && authors.has(norm(`${val} ${n}`));
      if (!(detailSoon(i + 1) || open(val) || (last !== 'title' && open(n)) || titleWrap || authorWrap)) break;
      // a bracketed line under the title is its subtitle
      if (last === 'title' && /^\(.*\)$/.test(n) && !cur.official) { cur.official = n.slice(1, -1); i++; continue; }
      cur[last] = `${val} ${n}`; i++;
    }
    continue;
  }
  if (front) front.body.push(t); else if (cur) body.push(t);
}
flush();

// 4b. corrections the general rules cannot make (checked against the PDF, 23 Oct 2026)
const FIX = {
  'Sujanarbuda Radhita Pada Yugam': (s) => { if (s.body[0] === 'Deva Goswami Maharaja') { s.author += ' ' + s.body.shift(); } },
};
for (const s of songs) FIX[s.title]?.(s);

// 5. body → parts, in the book's order: { v } verses (line breaks kept, a 1–2 word wrap rejoined), { t } translation
// (prose rejoined, numbered items kept apart), { h } a heading inside an entry. An entry with several prayers (the
// Pranama Mantras) alternates verses and translations; a translation ends at a short Title-Case heading that is
// followed by a verse line.
const LOWER = /^[(]?[a-zāīūṛṝḷṅñṭḍṇśṣḥṁ’'"-]/;
const out = songs.map((s, n) => {
  const b = s.body || [];
  const parts = [];
  let mode = 'v';
  const push = (k, l) => { const p = parts[parts.length - 1]; if (p && p.k === k) p.lines.push(l); else parts.push({ k, lines: [l] }); };
  for (let i = 0; i < b.length; i++) {
    const l = b[i];
    if (/^TRANSLATION$/i.test(l)) { mode = 't'; parts.push({ k: 't', lines: [] }); continue; }
    if (mode === 't' && l.split(/\s+/).length <= 5 && /^[A-ZŚṢ]/.test(l) && !/[.,;:!?"”)]$/.test(l) && LOWER.test(b[i + 1] || '')) {
      parts.push({ k: 'h', lines: [l] }); mode = 'v'; continue;
    }
    push(mode, l);
  }
  const verse = (ls) => {
    const v = [];
    for (const l of ls) {
      const prev = v[v.length - 1];
      if (prev && !/^\(\w+\)$/.test(prev) && !/^\(\w+\)$/.test(l) && l.split(/\s+/).length <= 2 && LOWER.test(l) && prev.length >= 30) v[v.length - 1] = `${prev} ${l}`;
      else v.push(l);
    }
    return v.join('\n');
  };
  const prose = (ls) => {
    const ps = [];
    for (const l of ls) {
      const item = /^\(?\d+\)|^\(refrain\)|^refrain:|^PURPORT/i.test(l);
      if (!ps.length || item) ps.push(l);
      else { const p = ps[ps.length - 1]; ps[ps.length - 1] = /\w-$/.test(p) ? p + l : `${p} ${l}`; }
    }
    return ps.join('\n\n');
  };
  const clean = (x) => (x || '').replace(/\s+/g, ' ').trim();
  return {
    id: `s${String(n + 1).padStart(3, '0')}`,
    title: clean(s.title), ...(s.official ? { official: clean(s.official) } : {}), ...(s.author ? { author: clean(s.author) } : {}), ...(s.by ? { by: clean(s.by) } : {}),
    ...(s.book ? { book: clean(s.book) } : {}), section: s.section, page: s.page,
    parts: parts.filter((p) => p.lines.length).map((p) => (p.k === 'v' ? { v: verse(p.lines) } : p.k === 't' ? { t: prose(p.lines) } : { h: p.lines[0] })),
  };
});

const sections = [...new Set(out.map((s) => s.section))].map((title) => ({ title, songs: out.filter((s) => s.section === title).map((s) => s.id) }));
const doc = { source: 'Vaishnava Songs, compiled by ISKCON Chowpatty (ISKCON Desire Tree)', lang: 'en', count: out.length, sections, songs: out };
// phase 22: every song's poet / language / categories / collection, and the songs added in the app (tools/songs/tags.mjs)
enrich(doc, { skipUnproofread: process.argv.includes('--skip-unproofread') });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
writeSongs(doc, OUT);
console.log(`${doc.count} entries in ${doc.sections.length} sections → ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
