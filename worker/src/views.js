// The four read-only batch view spreadsheets (design §2d): This week, Scores, Days, Week-end, for the coordinator
// (and anyone they share them with, view-only). Columns follow setup/schema.mjs (VIEW_TABS).
//
// Kept up to date piece by piece (phase 6, 3 Oct 2026; migration 0020), one small step a scheduled run, writing to
// Google only what changed:
//   · a new submission is INSERTED as one row at its place (Scores and Week-end: newest week first, names A–Z within
//     a week; Days: its 7 rows), so nothing below it is rewritten;
//   · an attendance mark given after a submission rewrites that week's Scores rows (Attendance and Overall change);
//   · This week rewrites only the rows whose content changed (row fingerprints), at most every 10 minutes;
//   · once a week the oldest week leaves Scores / Week-end (12 weeks kept) and Days (4 weeks kept);
//   · a deleted devotee's weeks are written again (erase.js: their rows now read "Deleted devotee", in name order).
// What changed is flagged by triggers (view_dirty), so an idle view costs a handful of reads. The layout is exactly the
// one buildView() makes (still here: the tests compare the two row for row).
import { SCHEMA } from '../../setup/schema.mjs';
import FILES from '../../setup/files.json' with { type: 'json' };
import { all, one, q } from './db.js';
import { isoIst } from './util.js';
import { addDays } from './weeks.js';
import { focusWeek, boardRows } from './coord.js';
import { finalScores, DAY_NAME } from './classweek.js';
import { clearRanges, sheetGrid, sheetRequests } from './google.js';
import { weekOf } from './weekjson.js';

export const VIEWS = ['viewSPS', 'viewDPS', 'viewBSS', 'viewBVS'];
const SCORE_WEEKS = 12, DAY_WEEKS = 4;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const STATUS = { SUBMITTED: 'Submitted', DRAFT: 'Draft', REOPENED: 'Reopened', NOT_STARTED: 'Not started', MISSED: 'Missed' };
const MARK = { P: 'Present', A: 'Absent' };
const BOARD_EVERY_MS = 10 * 60e3;             // This week: at most every 10 minutes
const SCAN = 300, PLACE = 40;                 // submissions looked at / placed per run (Days: 7 rows each)
const SCORE_COLS = 'id, login, name, iyf_id, batch_id, week_id, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, night_stay, principles, avg_rounds, score_card';

async function viewBatches(db, view) {
  return all(db, 'SELECT batch_id, name FROM batches WHERE level = ? ORDER BY rowid', view.slice(4));
}

const cell = (o) => (o ? `${o.label} · ${o.marks}` : '');
const thisWeekRow = (r, names) => [r.name, r.iyfId || '', names[r.batchId] || r.batchId, DAY_NAME[r.classDay] || '',
  r.accountStatus === 'ACTIVE' ? STATUS[r.status] : (r.accountStatus === 'DISABLED' ? 'Disabled' : 'Inactive'),
  `${r.daysFilled}/7`, r.submittedAt ? r.submittedAt.slice(0, 16).replace('T', ' ') : '', MARK[r.attendance.used] || '', r.overall ?? ''];
const scoreRow = (s, names) => [s.week_id, s.name, s.iyf_id, names[s.batch_id] || s.batch_id,
  s.bed, s.wake_up, s.day_sleep, s.japa, s.pathan, s.sravan, s.seva, s.attendance, s.body, s.soul, s.overall];
const weekEndRow = (s, names) => [s.week_id, s.name, names[s.batch_id] || s.batch_id, yn(s.night_stay), yn(s.principles), s.avg_rounds];
const yn = (v) => (v === 'YES' ? 'Yes' : v ? 'No' : '');   // blank: a part week the deadline submitted without the answer
function dayRows(s, ds, marks, names, topic) {
  return ds.map((d, i) => {
    // a day a part week left out (4 Oct 2026): one plain row, not zeros
    if (!d || !Object.keys(d).length) return [s.week_id, s.name, names[s.batch_id] || s.batch_id, DAY_NAMES[i], 'Not filled', '', '', '', '', '', '', ''];
    const mk = marks[i] || {};
    return [s.week_id, s.name, names[s.batch_id] || s.batch_id, DAY_NAMES[i], cell(mk.to_bed), cell(mk.wake_up),
      d.chantingSameDay === false ? `${cell(mk.japa)} (not the same day)` : cell(mk.japa), d.rounds ?? '',
      `${d.dayRestMin ?? 0} min · ${mk.day_sleep?.marks ?? ''}`,
      d.hearingMin ? `${d.hearingMin} min · ${(d.hearing || []).map(topic).join('; ')}` : '0',
      d.readingMin ? `${d.readingMin} min · ${d.reading ? topic(d.reading.bookId ? { lectureId: d.reading.bookId } : d.reading) : ''}` : '0',
      d.serviceMin ?? 0];
  });
}
/** Lecture and book titles for the topics of these parsed days. */
async function topicNamer(db, parsedDays) {
  const lectureIds = new Set(), bookIds = new Set();
  for (const ds of parsedDays) for (const d of ds) {
    for (const h of d.hearing || []) if (h.lectureId) lectureIds.add(h.lectureId);
    if (d.reading?.bookId) bookIds.add(d.reading.bookId);
  }
  const titles = {};
  const L = [...lectureIds], B = [...bookIds];
  for (let i = 0; i < L.length; i += 80) for (const r of await all(db, `SELECT "lecture_id" AS id, "title" FROM lectures WHERE "lecture_id" IN (${L.slice(i, i + 80).map(() => '?').join(',')})`, ...L.slice(i, i + 80))) titles[r.id] = r.title;
  for (let i = 0; i < B.length; i += 80) for (const r of await all(db, `SELECT "book_id" AS id, "title" FROM books WHERE "book_id" IN (${B.slice(i, i + 80).map(() => '?').join(',')})`, ...B.slice(i, i + 80))) titles[r.id] = r.title;
  return h => (h.lectureId ? titles[h.lectureId] || h.lectureId : h.text);
}

/** The values of the four tabs (without headers), built whole. The reference the step-by-step job must equal. */
export async function buildView(db, batches, weekId) {
  const ids = batches.map(b => b.batch_id), names = Object.fromEntries(batches.map(b => [b.batch_id, b.name]));
  const m = ids.map(() => '?').join(',');
  const thisWeek = (await boardRows(db, ids, weekId)).map(r => thisWeekRow(r, names));
  const from = addDays(weekId, -7 * (SCORE_WEEKS - 1));
  // scores with the final attendance mark (a coordinator may mark after the devotee submitted)
  const subs = (await all(db, `SELECT s.*, COALESCE(a.mark_used, '') AS att FROM submissions s LEFT JOIN attendance a ON a.login = s.login AND a.week_id = s.week_id
                               WHERE s.batch_id IN (${m}) AND s.week_id >= ?`, ...ids, from)).map(s => finalScores(s, s.att)).sort(byWeekThenKey);
  const scores = subs.map(s => scoreRow(s, names)), weekEnd = subs.map(s => weekEndRow(s, names));
  const dayFrom = addDays(weekId, -7 * (DAY_WEEKS - 1));
  const parsed = subs.filter(s => s.week_id >= dayFrom).map(s => ({ s, ...weekOf(s) }));
  const topic = await topicNamer(db, parsed.map(p => p.days));
  const days = parsed.flatMap(({ s, days: ds, marks }) => dayRows(s, ds, marks, names, topic));
  return { 'This week': thisWeek, Scores: scores, Days: days, 'Week-end': weekEnd };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* The step-by-step job                                                                                              */
/* ---------------------------------------------------------------------------------------------------------------- */

// order inside a week: name A–Z, then login (two people with one name keep a fixed order)
const keyOf = s => `${s.name}\u0000${s.login}`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function byWeekThenKey(a, b) { return cmp(b.week_id, a.week_id) || cmp(keyOf(a), keyOf(b)); }
function lowerBound(arr, x) { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < x) lo = mid + 1; else hi = mid; } return lo; }

/** Google cell values for one row (RAW: text stays text, numbers stay numbers, nothing is run as a formula). */
const cells = row => ({ values: row.map(v => (v === '' || v === null || v === undefined ? {} : typeof v === 'number' ? { userEnteredValue: { numberValue: v } } : { userEnteredValue: { stringValue: String(v) } })) });
const update = (sheetId, rowIndex, rows) => ({ updateCells: { start: { sheetId, rowIndex, columnIndex: 0 }, rows: rows.map(cells), fields: 'userEnteredValue' } });
const insert = (sheetId, startIndex, n) => ({ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + n }, inheritFromBefore: startIndex > 1 } });
const remove = (sheetId, startIndex, n) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + n } } });

/** FNV-1a fingerprint of a row (This week: only rows whose fingerprint changed are written). */
function fingerprint(row) {
  const s = JSON.stringify(row); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const saveState = (db, view, set) => q(db, `UPDATE view_state SET ${Object.keys(set).map(k => `${k} = ?`).join(', ')} WHERE view = ?`, ...Object.values(set), view);
const putKeys = (db, view, part, keys) => q(db, 'INSERT INTO view_keys (view, part, keys) VALUES (?, ?, ?) ON CONFLICT(view, part) DO UPDATE SET keys = excluded.keys', view, part, JSON.stringify(keys));
const clean = (db, view, part) => q(db, 'DELETE FROM view_dirty WHERE view = ? AND part = ?', view, part);

/**
 * One step for the view that most needs it (the stalest first). Returns a short report, or '' when every view is
 * current. Steps: build (start from empty tabs) · roll (a new focus week: old weeks leave) · place (new submissions)
 * · redo (a deleted devotee's week, written again) · attendance (a week's marks changed) · board (This week).
 */
export async function refreshOneView(env, db, now = new Date()) {
  const focus = await focusWeek(db, now);
  const states = (await all(db, 'SELECT * FROM view_state')).filter(s => FILES[s.view]).sort((a, b) => cmp(a.synced_at || '', b.synced_at || ''));
  if (!states.length) return '';
  const dirty = await all(db, 'SELECT view, part FROM view_dirty');
  const maxId = (await one(db, 'SELECT COALESCE(MAX(id), 0) AS m FROM submissions')).m;
  for (const st of states) {
    const parts = new Set(dirty.filter(d => d.view === st.view).map(d => d.part));
    const att = [...parts].filter(p => p.startsWith('att:')).sort().reverse();
    const redo = [...parts].filter(p => p.startsWith('redo:')).sort().reverse();
    const boardDue = parts.has('board') && (!st.board_at || now - Date.parse(st.board_at) >= BOARD_EVERY_MS);
    const step = st.mode === 'build' ? 'build' : st.focus !== focus ? 'roll' : maxId > st.last_id ? 'place' : redo.length ? 'redo' : att.length ? 'attendance' : boardDue ? 'board' : '';
    if (!step) continue;
    const batches = await viewBatches(db, st.view);
    if (!batches.length) continue;
    const v = { env, db, now, focus, st, batches, id: FILES[st.view], ids: batches.map(b => b.batch_id), names: Object.fromEntries(batches.map(b => [b.batch_id, b.name])),
      blocks: JSON.parse(st.blocks || '[]') };
    const report = step === 'build' ? await build(v) : step === 'roll' ? await roll(v) : step === 'place' ? await place(v, maxId)
      : step === 'redo' ? await redoWeek(v, redo[0].slice(5)) : step === 'attendance' ? await attendance(v, att[0].slice(4)) : await board(v);
    return `${st.view}: ${report}`;
  }
  return '';
}

async function sheetIds(v, grid = null) {
  const g = grid || await sheetGrid(v.env, v.id);
  const out = {};
  for (const t of ['This week', 'Scores', 'Days', 'Week-end']) { if (!g[t]) throw new Error(`${v.st.view}: tab ${t} is missing`); out[t] = g[t].sheetId; }
  return out;
}
const scoreFrom = focus => addDays(focus, -7 * (SCORE_WEEKS - 1));
const dayFrom = focus => addDays(focus, -7 * (DAY_WEEKS - 1));
/** Rows before week w's block: Scores / Week-end (one per submission) and Days (seven per submission, recent weeks only). */
function offsets(blocks, w, focus) {
  let s = 0, d = 0;
  for (const b of blocks) { if (b.w === w) break; s += b.n; if (b.w >= dayFrom(focus)) d += 7 * b.n; }
  return { s, d };
}

/** Empty tabs, then everything is placed again by the next steps (first run, or a repair). */
async function build(v) {
  const { db, st } = v;
  await clearRanges(v.env, v.id, ['This week', 'Scores', 'Days', 'Week-end'].map(t => `'${t}'!A2:ZZ`));
  await db.batch([saveState(db, st.view, { mode: 'live', focus: v.focus, last_id: 0, blocks: '[]', board_at: '', synced_at: isoIst(v.now), note: 'rebuilding' }),
    q(db, 'DELETE FROM view_keys WHERE view = ?', st.view), q(db, 'DELETE FROM view_dirty WHERE view = ?', st.view),
    q(db, "INSERT OR IGNORE INTO view_dirty (view, part) VALUES (?, 'board')", st.view)]);
  return 'emptied, rebuilding step by step';
}

/** A new focus week: weeks older than 12 leave Scores / Week-end, older than 4 leave Days (bottom rows, deleted). */
async function roll(v) {
  const { db, st, focus } = v, old = st.focus || focus, tabs = await sheetIds(v), req = [];
  // from the bottom up, so earlier rows keep their places while later ones go
  let s = v.blocks.reduce((t, b) => t + b.n, 0), d = v.blocks.filter(b => b.w >= dayFrom(old)).reduce((t, b) => t + 7 * b.n, 0);
  for (const b of [...v.blocks].reverse()) {
    s -= b.n;
    const inDays = b.w >= dayFrom(old);
    if (inDays) d -= 7 * b.n;
    if (b.n && b.w < scoreFrom(focus)) req.push(remove(tabs.Scores, 1 + s, b.n), remove(tabs['Week-end'], 1 + s, b.n));
    if (b.n && inDays && b.w < dayFrom(focus)) req.push(remove(tabs.Days, 1 + d, 7 * b.n));
  }
  if (req.length) await sheetRequests(v.env, v.id, req);
  const keep = v.blocks.filter(b => b.w >= scoreFrom(focus)), gone = v.blocks.filter(b => b.w < scoreFrom(focus));
  await db.batch([saveState(db, st.view, { focus, blocks: JSON.stringify(keep), board_at: '', synced_at: isoIst(v.now) }),
    ...gone.map(b => q(db, 'DELETE FROM view_keys WHERE view = ? AND part = ?', st.view, b.w)),
    q(db, "INSERT OR IGNORE INTO view_dirty (view, part) VALUES (?, 'board')", st.view)]);
  return `new week ${focus}: ${gone.length} old week(s) out`;
}

/** New submissions (in id order): each inserted at its place in Scores, Week-end and (recent weeks) Days. */
async function place(v, maxId) {
  const { db, st, focus, names } = v;
  const seen = await all(db, 'SELECT id, batch_id, week_id FROM submissions WHERE id > ? ORDER BY id LIMIT ?', st.last_id, SCAN);
  const mine = seen.filter(r => v.ids.includes(r.batch_id) && r.week_id >= scoreFrom(focus)).slice(0, PLACE);
  const lastId = mine.length === PLACE ? mine[PLACE - 1].id : seen.length ? seen[seen.length - 1].id : maxId;
  if (!mine.length) {
    await db.batch([saveState(db, st.view, { last_id: lastId })]);
    return `nothing new for this view (up to ${lastId})`;
  }
  const subs = (await all(db, `SELECT s.*, COALESCE(a.mark_used, '') AS att FROM submissions s LEFT JOIN attendance a ON a.login = s.login AND a.week_id = s.week_id
                               WHERE s.id IN (${mine.map(() => '?').join(',')}) ORDER BY s.id`, ...mine.map(r => r.id))).map(s => finalScores(s, s.att));
  const parsed = new Map(subs.filter(s => s.week_id >= dayFrom(focus)).map(s => [s.id, weekOf(s)]));
  const topic = await topicNamer(db, [...parsed.values()].map(p => p.days));
  const tabs = await sheetIds(v), req = [], keys = new Map();
  for (const s of subs) {
    let b = v.blocks.find(x => x.w === s.week_id);
    if (!b) { b = { w: s.week_id, n: 0 }; v.blocks.push(b); v.blocks.sort((x, y) => cmp(y.w, x.w)); }
    if (!keys.has(b.w)) keys.set(b.w, await loadKeys(v, b, st.last_id));
    const k = keys.get(b.w), rank = lowerBound(k, keyOf(s)), at = offsets(v.blocks, b.w, focus);
    req.push(insert(tabs.Scores, 1 + at.s + rank, 1), update(tabs.Scores, 1 + at.s + rank, [scoreRow(s, names)]),
             insert(tabs['Week-end'], 1 + at.s + rank, 1), update(tabs['Week-end'], 1 + at.s + rank, [weekEndRow(s, names)]));
    if (b.w >= dayFrom(focus)) {
      const p = parsed.get(s.id);
      req.push(insert(tabs.Days, 1 + at.d + 7 * rank, 7), update(tabs.Days, 1 + at.d + 7 * rank, dayRows(s, p.days, p.marks, names, topic)));
    }
    k.splice(rank, 0, keyOf(s)); b.n++;
  }
  await sheetRequests(v.env, v.id, req);
  await db.batch([saveState(db, st.view, { last_id: lastId, blocks: JSON.stringify(v.blocks), synced_at: isoIst(v.now),
                    note: v.blocks.map(b => `${b.w} ${b.n}`).join(', ') }),
    ...[...keys].map(([w, k]) => putKeys(db, st.view, w, k))]);
  return `${subs.length} submission(s) placed`;
}

/** The sorted keys of a week already in the tabs (kept in view_keys; read from submissions the first time). */
async function loadKeys(v, b, upToId) {
  const r = await one(v.db, 'SELECT keys FROM view_keys WHERE view = ? AND part = ?', v.st.view, b.w);
  if (r) return JSON.parse(r.keys);
  if (!b.n) return [];
  const rows = await all(v.db, `SELECT name, login FROM submissions WHERE week_id = ? AND batch_id IN (${v.ids.map(() => '?').join(',')}) AND id <= ?`, b.w, ...v.ids, upToId);
  return rows.map(keyOf).sort();
}

/** A week's attendance changed: its Scores rows are written again (Attendance and Overall follow the final mark). */
async function attendance(v, w) {
  const { db, st, focus, names } = v, b = v.blocks.find(x => x.w === w);
  if (b && b.n && w >= scoreFrom(focus)) {
    const subs = (await all(db, `SELECT ${SCORE_COLS.split(', ').map(c => 's.' + c).join(', ')}, COALESCE(a.mark_used, '') AS att
                                 FROM submissions s LEFT JOIN attendance a ON a.login = s.login AND a.week_id = s.week_id
                                 WHERE s.week_id = ? AND s.batch_id IN (${v.ids.map(() => '?').join(',')}) AND s.id <= ?`, w, ...v.ids, st.last_id))
      .map(s => finalScores(s, s.att)).sort(byWeekThenKey);
    if (subs.length !== b.n) {                       // the tabs and the database disagree: start again rather than guess
      await db.batch([saveState(db, st.view, { mode: 'build' })]);
      return `week ${w}: ${subs.length} rows in the database, ${b.n} in the sheet — rebuilding`;
    }
    const tabs = await sheetIds(v);
    await sheetRequests(v.env, v.id, [update(tabs.Scores, 1 + offsets(v.blocks, w, focus).s, subs.map(s => scoreRow(s, names)))]);
  }
  await db.batch([clean(db, st.view, 'att:' + w), saveState(db, st.view, { synced_at: isoIst(v.now) })]);
  return `week ${w}: attendance written`;
}

/**
 * A week a deleted devotee was in (erase.js): its Scores, Week-end and (recent weeks) Days rows are written again in
 * place — same number of rows, the new name moves the person within the week's A–Z order — and its sorted keys saved.
 */
async function redoWeek(v, w) {
  const { db, st, focus, names } = v, b = v.blocks.find(x => x.w === w);
  if (b && b.n && w >= scoreFrom(focus)) {
    const subs = (await all(db, `SELECT s.*, COALESCE(a.mark_used, '') AS att FROM submissions s LEFT JOIN attendance a ON a.login = s.login AND a.week_id = s.week_id
                                 WHERE s.week_id = ? AND s.batch_id IN (${v.ids.map(() => '?').join(',')}) AND s.id <= ?`, w, ...v.ids, st.last_id))
      .map(s => finalScores(s, s.att)).sort(byWeekThenKey);
    if (subs.length !== b.n) {                       // the tabs and the database disagree: start again rather than guess
      await db.batch([saveState(db, st.view, { mode: 'build' })]);
      return `week ${w}: ${subs.length} rows in the database, ${b.n} in the sheet — rebuilding`;
    }
    const tabs = await sheetIds(v), at = offsets(v.blocks, w, focus);
    const req = [update(tabs.Scores, 1 + at.s, subs.map(s => scoreRow(s, names))), update(tabs['Week-end'], 1 + at.s, subs.map(s => weekEndRow(s, names)))];
    if (w >= dayFrom(focus)) {
      const parsed = subs.map(s => ({ s, ...weekOf(s) })), topic = await topicNamer(db, parsed.map(p => p.days));
      req.push(update(tabs.Days, 1 + at.d, parsed.flatMap(({ s, days, marks }) => dayRows(s, days, marks, names, topic))));
    }
    await sheetRequests(v.env, v.id, req);
    await db.batch([putKeys(db, st.view, w, subs.map(keyOf))]);
  }
  await db.batch([clean(db, st.view, 'redo:' + w), saveState(db, st.view, { synced_at: isoIst(v.now) })]);
  return `week ${w}: written again (a deleted devotee)`;
}

/** This week: built whole (it is one row per devotee), but only rows whose content changed are written. */
async function board(v) {
  const { db, st, names } = v;
  await db.batch([clean(db, st.view, 'board')]);           // first: a change made while this step runs flags it again
  try { return await boardWrite(v); }
  catch (e) { await db.batch([q(db, "INSERT OR IGNORE INTO view_dirty (view, part) VALUES (?, 'board')", st.view)]); throw e; }   // try again next run
}
async function boardWrite(v) {
  const { db, st, names } = v;
  const rows = (await boardRows(db, v.ids, v.focus)).map(r => thisWeekRow(r, names)), fp = rows.map(fingerprint);
  const old = JSON.parse((await one(db, "SELECT keys FROM view_keys WHERE view = ? AND part = 'board'", st.view))?.keys || '[]');
  const grid = await sheetGrid(v.env, v.id), tabs = await sheetIds(v, grid), req = [];
  let changed = 0;
  for (let i = 0; i < rows.length; i++) {
    if (fp[i] === old[i]) continue;
    let j = i; while (j + 1 < rows.length && fp[j + 1] !== old[j + 1]) j++;
    req.push(update(tabs['This week'], 1 + i, rows.slice(i, j + 1))); changed += j - i + 1; i = j;
  }
  if (old.length > rows.length) req.push(update(tabs['This week'], 1 + rows.length, Array.from({ length: old.length - rows.length }, () => Array(9).fill(''))));
  if (req.length) {
    const need = Math.max(rows.length, old.length) + 1 - (grid['This week']?.rows || 0);
    if (need > 0) req.unshift({ appendDimension: { sheetId: tabs['This week'], dimension: 'ROWS', length: need + 200 } });
    await sheetRequests(v.env, v.id, req);
  }
  await db.batch([putKeys(db, st.view, 'board', fp), saveState(db, st.view, { board_at: isoIst(v.now), synced_at: isoIst(v.now) })]);
  return `This week: ${changed} of ${rows.length} rows written`;
}

export { SCHEMA };
