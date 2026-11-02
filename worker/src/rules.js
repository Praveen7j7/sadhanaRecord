// What the app needs to show marks live and to pick lectures and books (API contract §3).
// Both answers carry a version; the phone keeps a copy and sends `have` to get { notModified: true } when unchanged.
import { apiError, invalid, isoIst } from './util.js';
import { all, one, run, q, reads, rows, setting, devoteeBatch, scopeBatches, batchesAll, account, currentMembership } from './db.js';
import { requireBatch } from './requests.js';
import { DAYS_SQL } from './weekjson.js';
import { CARDS, RULES_VERSION } from './cards.js';

/** Which book level comes first for a batch level (own level first, then earlier ones; any book allowed). */
export const BOOK_LEVEL = { SPS: 'SPS/DPS', DPS: 'SPS/DPS', BSS: 'BSS/BVS', BVS: 'BSS/BVS' };

/** Lectures picked in submitted weeks (worked out by the database, so the Worker does no JSON work). */
/** The lectures a devotee has heard: the statement (so home.get can send it in its one batch, 22 Oct 2026) and the
 *  reading of its rows. heardOf runs both, as before. */
export const heardStmt = (db, login) => q(db, `SELECT DISTINCT json_extract(h.value, '$.lectureId') AS id FROM submissions s, json_each(${DAYS_SQL('s')}) d,
  json_each(COALESCE(json_extract(d.value, '$.hearing'), '[]')) h WHERE s.login = ? AND json_extract(h.value, '$.lectureId') IS NOT NULL`, login);
export const heardFrom = (rows) => rows.map(r => r.id);
export const heardOf = async (db, login) => heardFrom((await heardStmt(db, login).all()).results);

/** Filling for a devotee (the head, 7 Oct 2026: the same friendly lists the devotee has): their batch, checked like
 *  week.get onBehalfOf (the head, or a coordinator of their batch; an active devotee). */
async function behalfBatch(ctx, onBehalfOf) {
  if (!ctx.scopes.master && !ctx.scopes.coordinator.length) throw apiError('FORBIDDEN', 'You can fill only your own form.');
  const acct = await account(ctx.db, String(onBehalfOf));
  if (!acct || acct.role !== 'DEVOTEE') throw apiError('NOT_FOUND', 'No devotee with that phone.');
  const m = await currentMembership(ctx.db, acct.login);
  await requireBatch(ctx, m?.batch_id);
  const b = (await batchesAll(ctx.db)).find(x => x.batch_id === m.batch_id);
  if (!b) throw apiError('NOT_FOUND', 'No such batch.');
  return { login: acct.login, batch: b, acct };
}

async function callerBatches(ctx) {
  const batches = await batchesAll(ctx.db), own = ctx.scopes.devotee?.batchId;
  const ids = [...new Set([...(own ? [own] : []), ...(await scopeBatches(ctx.db, ctx))])];
  return ids.map(id => batches.find(b => b.batch_id === id)).filter(Boolean);       // own batch first
}

const chetnaOptions = async db => {
  const rows = await all(db, 'SELECT "kind", "option" FROM chetna_options WHERE "active" = 1 ORDER BY "kind", "order"');
  return { positive: rows.filter(r => r.kind === 'POSITIVE').map(r => r.option), negative: rows.filter(r => r.kind === 'NEGATIVE').map(r => r.option) };
};

export async function rulesGet(d, ctx) {
  const version = await setting(ctx.db, 'rules_version', RULES_VERSION);
  const behalf = d.onBehalfOf !== undefined && String(d.onBehalfOf) !== ctx.login ? await behalfBatch(ctx, d.onBehalfOf) : null;
  if (!behalf && d.have !== undefined && d.have === version) return { notModified: true, version };
  // temple: the batch asks the temple activities (phase 21) — the day form shows them only then
  if (behalf) { const n = behalf.batch.score_card; return { version, cardName: CARDS[n] ? n : null, cards: CARDS[n] ? { [n]: CARDS[n] } : {}, chetnaOptions: await chetnaOptions(ctx.db), temple: !!behalf.batch.temple_activities }; }
  const batches = await callerBatches(ctx);
  const names = [...new Set(batches.map(b => b.score_card))];
  const cards = Object.fromEntries(names.filter(n => CARDS[n]).map(n => [n, CARDS[n]]));
  const ownBatch = ctx.scopes.devotee ? batches.find((b) => b.batch_id === ctx.scopes.devotee.batchId) : null;
  return { version, cardName: ctx.scopes.devotee ? names[0] || null : null, cards, chetnaOptions: await chetnaOptions(ctx.db), temple: !!ownBatch?.temple_activities };
}

export async function journalsGet(d, ctx) {
  const version = await setting(ctx.db, 'journals_version', 'j1');
  const behalf = d.onBehalfOf !== undefined && String(d.onBehalfOf) !== ctx.login ? await behalfBatch(ctx, d.onBehalfOf) : null;
  // the caller's own book being read (a devotee), also when the lists themselves are unchanged
  const own = !behalf && ctx.scopes.devotee ? { currentBookId: await currentBook(ctx.db, ctx.login) } : {};
  if (!behalf && d.have !== undefined && d.have === version) return { notModified: true, version, ...own };
  const batches = behalf ? [behalf.batch] : await callerBatches(ctx);
  if (!batches.length) throw apiError('FORBIDDEN', 'You are not in a batch yet.');
  const journals = [...new Set(batches.map(b => b.hearing_journal))];
  // audioUrl: the lecture's own Drive file, or its folder when no single file matched (inFolder); blank when the journal has none
  /* The four reads below in ONE round trip (22 Oct 2026): they do not depend on each other, and they ran one after
     another. Only past the `notModified` return above — the common case, a phone whose lists are current, still
     answers from the version alone and reads none of these rows. */
  const [lectureRows, fileRows, bookRows, link] = await reads(ctx.db, [
    rows(q(ctx.db, `SELECT "lecture_id" AS lectureId, "journal", "week", "slot", "title", "link" AS audioUrl
                    FROM lectures WHERE "journal" IN (${journals.map(() => '?').join(',')}) ORDER BY "journal", "order"`, ...journals)),
    rows(q(ctx.db, 'SELECT "book_id", "label", "url", "lang" FROM book_files ORDER BY "book_id", "order"')),
    rows(q(ctx.db, 'SELECT "book_id" AS bookId, "title", "level", "words", "language", "title_hi", "chapters_hi" FROM books ORDER BY "order"')),
    q(ctx.db, 'SELECT "link" FROM books WHERE "link" <> \'\' LIMIT 1')
  ]);
  const lectures = lectureRows.map(l => (l.audioUrl.includes('/folders/') ? { ...l, inFolder: true } : l));
  // English and Hindi sections (19 Oct 2026): a file says lang 'hi' only when it is Hindi, and a book carries its Hindi
  // title and chapter count only when it has them — every other book keeps exactly the shape it always had
  const files = {};
  for (const f of fileRows) {
    (files[f.book_id] ||= []).push(f.lang === 'hi' ? { label: f.label, url: f.url, lang: 'hi' } : { label: f.label, url: f.url });
  }
  const books = bookRows
    .map(({ title_hi, chapters_hi, ...b }) => ({ ...b, ...(title_hi ? { titleHi: title_hi } : {}), ...(chapters_hi ? { chaptersHi: chapters_hi } : {}),
      files: files[b.bookId] || [] }));
  return {
    version, journals, lectures, books,
    ownBookLevel: behalf || ctx.scopes.devotee ? BOOK_LEVEL[batches[0].level] || null : null,
    bookLink: link ? link.link : '',
    bookNote: 'Please buy the books from ISKCON outlets.',
    // the devotee's own (home.get carries them for the devotee; filling for them, they come here)
    heard: behalf ? await heardOf(ctx.db, behalf.login) : [],
    ...(behalf ? { batchId: behalf.batch.batch_id, currentBookId: await currentBook(ctx.db, behalf.login) } : own)
  };
}

/**
 * books.chapters: one book's chapter PDFs in one language (Śrīmad-Bhāgavatam in Hindi, chapter by chapter). Read only
 * when somebody opens a canto's chapters, by its key — the 349 rows are never part of journals.get (19 Oct 2026).
 */
export async function booksChapters(d, ctx) {
  const bookId = String(d.bookId || ''), lang = String(d.lang || '');
  if (!['en', 'hi'].includes(lang)) throw invalid({ path: 'lang', message: 'English or Hindi.' });
  if (!/^B\d{2,3}$/.test(bookId)) throw invalid({ path: 'bookId', message: 'Not a book.' });
  const [book, chapters] = await reads(ctx.db, [
    q(ctx.db, 'SELECT "book_id" FROM books WHERE "book_id" = ?', bookId),
    rows(q(ctx.db, 'SELECT "part", "label", "url" FROM book_chapters WHERE "book_id" = ? AND "lang" = ? ORDER BY "n"', bookId, lang))]);
  if (!book) throw apiError('NOT_FOUND', 'No such book.');
  return { bookId, lang, chapters };
}

const currentBook = async (db, login) => (await one(db, 'SELECT current_book_id FROM profiles WHERE login = ?', login))?.current_book_id || null;

/**
 * books.setCurrent: the book being read (bookId null clears it), kept with the profile so every device shows it. One's
 * own (a devotee), or a devotee's with onBehalfOf (the head, or a coordinator of their batch, as fill-on-behalf).
 * One write; nothing when it is already that book.
 */
export async function setCurrentBook(d, ctx) {
  let who;
  if (d.onBehalfOf !== undefined && String(d.onBehalfOf) !== ctx.login) {
    const b = await behalfBatch(ctx, d.onBehalfOf);
    if (b.acct.status !== 'ACTIVE') throw apiError('CONFLICT', 'That devotee is not active.');
    who = b.acct;
  } else {
    if (!ctx.scopes.devotee) throw apiError('FORBIDDEN', 'You are not in a batch, so there is no reading for you.');
    who = ctx.acct;
  }
  if (d.bookId !== null && (typeof d.bookId !== 'string' || !d.bookId)) throw invalid({ path: 'bookId', message: 'Choose a book (or none).' });
  const bookId = d.bookId || '';
  if (bookId && !(await one(ctx.db, 'SELECT 1 FROM books WHERE "book_id" = ?', bookId))) throw invalid({ path: 'bookId', message: 'Unknown book.' });
  if (((await currentBook(ctx.db, who.login)) || '') === bookId) return { currentBookId: bookId || null };
  const at = isoIst(ctx.now());
  await run(ctx.db, `INSERT INTO profiles (login, iyf_id, name, current_book_id, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
                     ON CONFLICT(login) DO UPDATE SET current_book_id = excluded.current_book_id, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    who.login, who.iyf_id || '', who.name, bookId, at, ctx.login);
  return { currentBookId: bookId || null };
}
