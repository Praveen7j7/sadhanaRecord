// rules.get and journals.get: each devotee gets their batch's card and journal, named by batch, versioned.
import { boot, suite , FAC, LEAD, CONTACT } from './harness.mjs';
import { mirrorChanged } from '../src/mirror.js';

const t = suite('phase 2: rules and journals for the app');
const { env, DB, call, rows, addAccount, google } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const join = async (phone, batchId) => {
  await call('auth.signUp', { phone, name: 'Test Devotee', batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const sps = await join('6000000040', 'SPS2'), bss = await join('6000000041', 'BSS'), bvs = await join('6000000042', 'BVS');

let r = await call('rules.get', {}, sps);
t.eq([r.data.version, r.data.cardName, Object.keys(r.data.cards)], ['r4', 'SPS', ['SPS']], 'SPS Group 2 devotee gets the SPS card (r4 since the TRD card, migration 0065)');
t.eq([r.data.chetnaOptions.positive.length, r.data.chetnaOptions.negative.length, r.data.chetnaOptions.positive[7], r.data.chetnaOptions.negative[8]], [9, 9, 'Spiritually Absorbed', 'Time Wasting'], 'the Chetna options, in COSATOK order');
t.eq(r.data.cards.SPS.pathan[5], { label: 'No Reading', marks: 0, min: 0, max: 0 }, 'with every option and its range');
t.eq((await call('rules.get', { have: 'r4' }, sps)).data, { notModified: true, version: 'r4' }, 'unchanged: notModified');
t.ok((await call('rules.get', { have: 'r1' }, sps)).data.cards, 'an older copy gets the new rules');
t.eq((await call('rules.get', {}, bss)).data.cardName, 'BVS/DPS/BSS', 'BSS devotee gets the BVS/DPS/BSS card');
t.eq(Object.keys((await call('rules.get', {}, M)).data.cards).sort(), ['BVS/DPS/BSS', 'SPS', 'TRD'], 'the master gets every card (TRD\'s own since Phase 22)');

r = await call('journals.get', {}, sps);
t.eq([r.data.journals, r.data.lectures.length, r.data.books.length, r.data.ownBookLevel], [['SPS/DPS'], 324, 76, 'SPS/DPS'], 'SPS devotee: the SPS/DPS journal (324 lectures), all 76 books, own level first');
t.eq(r.data.lectures[0].lectureId, 'SD-W001-SPL', 'lectures in journal order, week 1 first');
t.eq((await call('journals.get', {}, bss)).data.journals, ['BSS'], 'BSS devotee: only the BSS journal');
t.eq((await call('journals.get', {}, bvs)).data.journals, ['BVS'], 'BVS devotee: only the BVS journal');
t.ok(!JSON.stringify((await call('journals.get', {}, bss)).data).includes('Level '), 'no "Level 4/5" names anywhere: batches only');
// the current version, read rather than written down: every books or lectures relink raises it (0069 j4, 0076 j5)
const jv = (await call('journals.get', {}, sps)).data.version;
t.ok(+jv.slice(1) >= 5, 'journals version is at least j5 (the SPS/DPS lectures relink, 0076)');
t.eq((await call('journals.get', { have: jv }, sps)).data, { notModified: true, version: jv, currentBookId: null }, 'unchanged: notModified (with the devotee\'s own book being read, Phase 0)');
t.ok((await call('journals.get', { have: 'j3' }, sps)).data.books, 'a phone holding the list before the books relink (j3, 0069) gets the new one');
t.ok((await call('journals.get', { have: 'j4' }, sps)).data.lectures?.length === 324, 'a phone holding the lectures before their relink (j4, 0076) gets all 324 again');
t.ok((await call('journals.get', { have: 'j2' }, sps)).data.books, 'a phone holding the list before the Hindi books (j2) gets the new one');
{
  const L = Object.fromEntries(r.data.lectures.map(l => [l.lectureId, l])), B = Object.fromEntries(r.data.books.map(b => [b.bookId, b]));
  t.ok(/^https:\/\/drive\.google\.com\/file\/d\/[\w-]{25,}\/view$/.test(L['SD-W001-SPL'].audioUrl), 'a direct file link is cleaned (no ?usp=): ' + L['SD-W001-SPL'].audioUrl);
  t.ok(!L['SD-W001-SPL'].audioUrl.includes('18e50If5Ci5u1rDFD2OaWFHEcv8A7oKwe'), 'and it plays the copy in the head\'s Drive, not the original file (0076)');
  t.ok(L['SD-W060-LOW1'].audioUrl.includes('/file/d/') && !L['SD-W060-LOW1'].inFolder, 'a folder link is resolved to the lecture\'s own file by its number');
  t.eq(L['SD-W021-LOW1'].inFolder, true, 'no single matching file: the folder link stays, marked inFolder');
  t.eq(r.data.lectures.filter(l => l.audioUrl && !/^https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/[\w-]+(\/view)?$/.test(l.audioUrl)).length, 0, 'every link is a clean Drive file or folder link');
  t.eq(B.B01.files.length, 1, 'a single book: its own PDF');
  t.eq(B.B58.files.map(f => f.label).slice(0, 2), ['Canto 1', 'Canto 2'], 'Bhagavatam complete: 12 cantos, labelled');
  // English and Hindi sections (the head, 19 Oct 2026): a file is English unless it says lang 'hi'
  const en = (b) => b.files.filter(f => !f.lang).map(f => f.label), hi = (b) => b.files.filter(f => f.lang === 'hi').map(f => f.label);
  t.eq(en(B.B55), ['English'], 'Gita: the English section has the English edition only');
  t.eq(hi(B.B55), ['भगवद्-गीता यथारूप · 876 पृष्ठ', 'भगवद्-गीता यथारूप · 678 पृष्ठ', 'मूल संस्करण 1980 (स्कैन)'],
    'and the Hindi section its three Hindi editions (the one already linked, relabelled, first)');
  t.eq([B.B55.titleHi, B.B31.titleHi, hi(B.B31)], ['श्रीमद्-भगवद्-गीता यथारूप', 'लीला पुरुषोत्तम भगवान् श्रीकृष्ण', ['PDF']], 'Hindi books carry their Hindi title');
  t.eq([hi(B.B59), B.B59.chaptersHi, hi(B.B68), B.B68.chaptersHi], [['Part 1', 'Part 2'], 19, ['Part 1', 'Part 2', 'Part 3', 'Part 4'], 90],
    'Bhagavatam by canto: Canto 1 in two parts with 19 chapter files; Canto 10 in four parts (90 chapters, contents and introduction)');
  t.eq([hi(B.B58).length, hi(B.B58)[0], hi(B.B58).at(-1), B.B58.chaptersHi], [19, 'Canto 1 · Part 1', 'Canto 12', undefined],
    'the complete Bhagavatam: every Hindi canto part, in order (its chapters live with each canto)');
  t.eq([hi(B.B71).length, hi(B.B72), hi(B.B73).length, hi(B.B74).length], [9, ['प्रथम खण्ड (अध्याय 1–7)', 'द्वितीय खण्ड (अध्याय 8–17)'], 5, 2],
    'Caitanya-caritamrta: nine volumes, each under its lila');
  t.eq(en(B.B58).length, 12, 'the English section of the complete Bhagavatam is unchanged: 12 cantos');
  t.eq(Object.keys(B.B01).sort(), ['bookId', 'files', 'language', 'level', 'title', 'words'], 'a book with no Hindi edition keeps exactly its old shape');
  t.eq(r.data.books.filter(b => b.files.some(f => f.lang === 'hi')).map(b => b.bookId).join(),
    'B31,B55,B58,B59,B60,B61,B62,B63,B64,B65,B66,B67,B68,B69,B70,B71,B72,B73,B74', 'the Hindi section: 19 books');
  t.eq([B.B33.files[0].url !== B.B34.files[0].url, B.B57.files.length], [true, 0], 'Spiritual Scientist 1 and 2 are different files; a book with no PDF has none (never a wrong one)');
}
t.code(await call('journals.get', {}), 'UNAUTHENTICATED', 'needs a login');

// a canto's chapters: read only when somebody opens them, one canto at a time (never with the book list)
{
  let c = await call('books.chapters', { bookId: 'B68', lang: 'hi' }, sps);
  t.code(c, 'ok', 'a devotee opens Canto 10\'s Hindi chapters');
  t.eq([c.data.chapters.length, c.data.chapters[0], c.data.chapters[2].label, c.data.chapters.at(-1).part],
    [95, { part: 'Part 1', label: 'Contents', url: c.data.chapters[0].url }, '1. Bhagavan Sri Krishna ka Avatar', 'Part 4'], 'Contents first, then the chapters, by part');
  t.ok(c.data.chapters.every(x => /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/.test(x.url)), 'every chapter is its own Drive file');
  t.eq((await call('books.chapters', { bookId: 'B59', lang: 'hi' }, bss)).data.chapters.map(x => x.label).slice(0, 2), ['1. Muniyon ki Jigyasa', '2. Divyata Tatha Divya Seva'], 'Canto 1, chapter by chapter');
  t.eq((await call('books.chapters', { bookId: 'B01', lang: 'hi' }, sps)).data.chapters, [], 'a book with no chapter files has none');
  t.code(await call('books.chapters', { bookId: 'B68', lang: 'fr' }, sps), 'VALIDATION', 'English or Hindi only');
  t.code(await call('books.chapters', { bookId: 'B999', lang: 'hi' }, sps), 'NOT_FOUND', 'an unknown book');
  t.code(await call('books.chapters', { bookId: 'B68', lang: 'hi' }), 'UNAUTHENTICATED', 'needs a login');
}
t.eq(rows("SELECT hearing_journal FROM batches ORDER BY rowid").map(b => b.hearing_journal), ['SPS/DPS', 'SPS/DPS', 'SPS/DPS', 'SPS/DPS', 'BSS', 'BVS', 'SPS/DPS'], 'batches name their journal by batch (TRD reads the SPS/DPS one)');

google.writes.length = 0;
const report = [];
for (let run = 0; run < 12; run++) report.push(...await mirrorChanged(env, DB));      // several 300-row runs
const parts = report.filter(x => x.startsWith('lectures') && !x.endsWith('waiting'));
t.ok(parts.length >= 4 && parts.slice(0, -1).every(x => x.includes('(continues)')) && !parts.at(-1).includes('continues'), 'lectures copied over several runs of at most 300 rows: ' + parts.join(' | '));
const writes = google.writes.filter(w => w.body?.data?.some(d => d.range.startsWith("'Lectures'"))).map(w => w.body.data.find(d => d.range.startsWith("'Lectures'")));
let next = 2, joined = true;
for (const w of writes) { if (w.range !== `'Lectures'!A${next}`) joined = false; next += w.values.length; }
t.ok(joined && next - 2 === 972, `each piece starts right below the last, 972 rows in all (${writes.map(w => w.range.split('!')[1] + '+' + w.values.length).join(', ')})`);
t.ok(google.writes.every(w => !w.body?.data || w.body.data.every(d => d.values.length <= 300)), 'no run writes more than 300 rows');
/* Counted across runs, not matched as one line: a table's copy may be split by the 300-row budget,
   and which run it lands in shifts whenever a row is added anywhere (TRD, 17 Oct 2026). The figure
   that matters is that every row arrived, not that it arrived in one go. */
const totalFor = (t) => report.filter((x) => x.startsWith(t + ' ')).reduce((n, x) => n + (Number(x.split(' ')[1]) || 0), 0);
t.eq([totalFor('card_ranges'), totalFor('seva_rules'), totalFor('books')], [78, 7, 76], 'small rules tables copied whole');
t.eq(rows("SELECT dirty, last_id FROM mirror_state WHERE tbl = 'lectures'")[0], { dirty: 0, last_id: 0 }, 'and the lectures copy is marked done');
const grow = google.writes.find(w => w.body?.requests?.some(r => r.appendDimension));
t.ok(grow && grow.body.requests.some(r => r.appendDimension.sheetId === 12), 'the 500-row Lectures tab is grown before rows past 500 are written');
// (the facilitator list is no longer read from the dashboard's NameMap: the app keeps its own, 27 Oct 2026)
t.done();
