// The weekly form (API contract §3, design §6). Weeks run Monday to Sunday and are named by their Monday.
//   · a day can be filled from its own date onwards, never in advance
//   · the week is open for filling until its deadline (the next Monday 9 PM); Submit only inside the window
//     (Sunday 6 PM to Monday 9 PM, both settings)
//   · each day is saved separately with a version, so two devices are told apart (STALE) and Tuesday never touches Monday
//   · Submit takes the days that are complete, at least one (the head, 4 Oct 2026: a part week is an option, not an
//     exception); a day not filled counts 0 marks, so the score is capped by the days filled (marks ÷ 175). At the
//     deadline a draft with a complete day is submitted as it stands; a week with none is MISSED (scored 0).
//     Scores are worked out here, from the batch's card (never the phone's)
import { apiError, invalid, isoIst, ymd, mondayOf, parseIso } from './util.js';
import { windowWords } from '../../shared/window.js';
import { TEMPLE_KEYS, TEMPLE_ANSWERS } from '../../shared/temple.js';
import { q, one, all, setting, account, currentMembership, audit, dirty, reads, rows, batchesAll, settingsRead, keepSettings } from './db.js';
import { requireBatch } from './requests.js';
import { dayMarks, weekScores } from './scoring.js';
import { RULES_VERSION } from './cards.js';
import { heardOf, heardStmt, heardFrom } from './rules.js';
import { visible as visibleAnnouncements, visibleQuery } from './announcements.js';
import { userInfo } from './auth.js';
import { weekJson, weekOf, DAYS_SQL } from './weekjson.js';
import { classWeekOf, classView, markUsed, markLevel, writeMark, finalScores, classOpensFor, weekEndOpens } from './classweek.js';
import { LIMITS } from './limits.js';
import { refreshWeeks, refreshedWeeks, refreshClosed } from './analysis.js';
import { comeBackStatements } from './inactive.js';

const DAY_MS = 86400000;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** The seven day columns of `drafts`, Monday first. The one definition — facilitator.js, push.js and the staff
 *  modules all import it from here (13 Oct 2026, roadmap 3.2: it was spelled out in four files). */
export const COLS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
const DOW = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

export const weekStart = weekId => new Date(`${weekId}T00:00:00+05:30`);
export const addDays = (weekId, n) => ymd(new Date(weekStart(weekId).getTime() + n * DAY_MS + 12 * 3600000));
export const validWeekId = w => /^\d{4}-\d{2}-\d{2}$/.test(String(w || '')) && mondayOf(weekStart(w)) === w;

/** "SUN 18:00" → milliseconds after the week's Monday 00:00 (IST); `nextWeek` for the deadline (the following Monday). */
function offset(spec, nextWeek) {
  const m = /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{2}):(\d{2})$/.exec(String(spec || '').trim().toUpperCase());
  if (!m) throw new Error('Bad submit window setting: ' + spec);
  return ((nextWeek ? 7 : 0) + DOW[m[1]]) * DAY_MS + (Number(m[2]) * 60 + Number(m[3])) * 60000;
}
export async function windowOf(db, weekId) {
  const start = weekStart(weekId).getTime();
  const opensSpec = await setting(db, 'submit_opens', 'SUN 18:00'), closesSpec = await setting(db, 'submit_closes', 'MON 21:00');
  /* `words` comes back with the dates because every message about the window has to say the time the head
     actually set. They used to be literal text ("Sunday 6 PM") in about fifteen places, so moving the
     window changed what the app allowed and nothing it said (shared/window.js). */
  return { opens: new Date(start + offset(opensSpec, false)),
           closes: new Date(start + offset(closesSpec, true)),
           words: windowWords({ opens: opensSpec, closes: closesSpec }) };
}

/** Weeks this devotee may fill now: this week; last week until its deadline; a reopened week until its end. */
export async function openWeeks(db, login, now) {
  return openWeeksFrom(db, now, await all(db, REOPENS_SQL, login));
}
/** The devotee's OPEN reopens — what openWeeks reads; the Sunday path sends it inside its one read batch (S2). */
const REOPENS_SQL = "SELECT week_id, open_until FROM reopens WHERE login = ? AND state = 'OPEN'";
const reopensStmt = (db, login) => rows(q(db, REOPENS_SQL, login));
/** openWeeks from the reopens rows, however they were read (windowOf reads only the settings this call holds). */
async function openWeeksFrom(db, now, reopenRows) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7);
  const out = [];
  if (now < (await windowOf(db, lastWeek)).closes) out.push(lastWeek);
  out.push(thisWeek);
  for (const r of reopenRows) {
    if (parseIso(r.open_until) > now && !out.includes(r.week_id)) out.unshift(r.week_id);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Whose week: the devotee, or a coordinator acting on their behalf          */
/* ------------------------------------------------------------------------ */

async function target(ctx, onBehalfOf) {
  if (onBehalfOf === undefined || String(onBehalfOf) === ctx.login) {
    if (!ctx.scopes.devotee) throw apiError('FORBIDDEN', 'You are not in a batch, so there is no weekly form for you.');
    return { acct: ctx.acct, batchId: ctx.scopes.devotee.batchId, behalf: false };
  }
  if (!ctx.scopes.master && !ctx.scopes.coordinator.length) throw apiError('FORBIDDEN', 'You can fill only your own form.');
  const acct = await account(ctx.db, String(onBehalfOf));
  if (!acct || acct.role !== 'DEVOTEE') throw apiError('NOT_FOUND', 'No devotee with that phone.');
  if (acct.status !== 'ACTIVE') throw apiError('CONFLICT', 'That devotee is not active.');
  const m = await currentMembership(ctx.db, acct.login);
  await requireBatch(ctx, m?.batch_id);
  return { acct, batchId: m.batch_id, behalf: true };
}
/**
 * A coordinator acting on a devotee's behalf sees only the week being filled now; an earlier week needs the IYF
 * head (the user's decision, 13 Oct 2026; audit F10 / roadmap 3.5).
 *
 * `devotees.week` has always said exactly this — "Coordinators see only the week being filled now. Ask the IYF
 * head for an earlier week." — while `week.get onBehalfOf` and `history.list onBehalfOf` handed over any week, so
 * the same question had two answers depending on which screen asked. This is the one rule, in one place.
 * A devotee's own week is never restricted, and the head is never restricted.
 */
async function behalfWeekAllowed(ctx, t, weekId) {
  if (!t.behalf || ctx.scopes.master) return;
  const open = await openWeeks(ctx.db, t.acct.login, ctx.now());
  // The week the board is showing counts as current even once its deadline has passed (focusWeek(), the same week
  // every staff screen is on until the next one begins). Without this, a coordinator would lose the week they had
  // been following the moment the Monday 21:00 deadline ran — they would be looking at a board row they could no
  // longer open, which is not what "only the week being filled now" is meant to mean.
  const onBoard = await focusWeekOf(ctx.db, ctx.now());
  if (!open.includes(weekId) && weekId !== onBoard) {
    throw apiError('FORBIDDEN', 'Coordinators see only the week being filled now. Ask the IYF head for an earlier week.');
  }
}

/** The week the staff boards are on: last week until its deadline, then this week. (Same rule as coord's
 *  focusWeek(); kept here to avoid weeks.js importing from a staff module.) */
async function focusWeekOf(db, now) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7);
  return now < (await windowOf(db, lastWeek)).closes ? lastWeek : thisWeek;
}

/** The batch's card from the batch list this call already holds (scopesOf read it): cardFor without the query. */
async function cardOf(db, batchId) {
  const b = (await batchesAll(db)).find(x => x.batch_id === String(batchId || ''));
  if (!b) throw apiError('FORBIDDEN', 'You are not in a batch yet.');
  return b;
}
async function cardFor(db, batchId) {
  const b = await one(db, 'SELECT score_card, hearing_journal, tracks, temple_activities FROM batches WHERE batch_id = ?', String(batchId || ''));
  if (!b) throw apiError('FORBIDDEN', 'You are not in a batch yet.');
  return b;
}

/* ------------------------------------------------------------------------ */
/* One day                                                                    */
/* ------------------------------------------------------------------------ */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const REQUIRED = ['sleptAt', 'wokeAt', 'rounds', 'chantingDoneAt', 'chantingSameDay', 'dayRestMin', 'hearingMin', 'readingMin', 'serviceMin'];

/*
 * WHAT A BATCH ASKS FOR (ADR 0009, the head, 16 Oct 2026).
 *
 * The Vedic levels sit before SPS and keep less: VL-2 takes attendance and nothing else, VL-3 takes
 * attendance and chanting rounds. Everything from SPS onwards takes the full day. Before this, every
 * batch was asked the same nine questions, because REQUIRED is one fixed list — a VL-2 devotee would
 * have been asked for hearing minutes and a reading topic they do not keep, and could never finish a
 * day.
 *
 * The batch's `tracks` column names its set. It defaults to 'full' in the schema, so a batch that
 * predates this reads exactly as it did.
 */
const TRACK_REQUIRED = {
  attendance: [],                 // VL-2: the week is the attendance mark; there is no daily form
  'attendance,rounds': ['rounds'] // VL-3: rounds, and nothing else
};
/** The required keys for a batch's track. Anything unrecognised is treated as the full day. */
export const requiredFor = tracks => TRACK_REQUIRED[String(tracks || 'full').trim()] ?? REQUIRED;
const LABEL = { sleptAt: 'Sleep time (previous night)', wokeAt: 'Wake-up time', rounds: 'Chanting rounds', chantingDoneAt: 'Chanting finished at',
  chantingSameDay: 'Completed the same day', dayRestMin: 'Day rest', hearingMin: 'Hearing minutes', hearing: 'Hearing topic',
  readingMin: 'Reading minutes', reading: 'Reading topic', serviceMin: 'Service minutes' };
// the temple activities (phase 21) are asked only of a batch with the flag; never required, never scored
const FIELDS = [...REQUIRED, 'hearing', 'reading', 'serviceTopic', 'exerciseMin', 'studyJobHrs', 'chetnaPositive', 'chetnaNegative', 'comment', ...TEMPLE_KEYS];
const TEMPLE_OK = TEMPLE_ANSWERS.map(([v]) => v);

/**
 * The reads cleanDay checks a day's answers against — each lecture picked, the book, the Chetna lists — as [key,
 * statement], so saveDay sends them in its one read batch (S2) instead of one round trip each. The same statements
 * cleanDay would run; a lecture picked twice is read once.
 */
function cleanDayReads(db, journal, patch) {
  const out = new Map();
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || journal == null) return [];
  if (Array.isArray(patch.hearing) && patch.hearing.length <= 8) {
    for (const h of patch.hearing) if (h && typeof h.lectureId === 'string' && !out.has('lecture:' + h.lectureId))
      out.set('lecture:' + h.lectureId, q(db, 'SELECT 1 FROM lectures WHERE "lecture_id" = ? AND "journal" = ?', h.lectureId, journal));
  }
  if (patch.reading && typeof patch.reading.bookId === 'string') out.set('book:' + patch.reading.bookId, q(db, 'SELECT 1 FROM books WHERE "book_id" = ?', patch.reading.bookId));
  for (const [k, kind] of [['chetnaPositive', 'POSITIVE'], ['chetnaNegative', 'NEGATIVE']]) {
    if (patch[k] !== undefined && patch[k] !== null) out.set('chetna:' + kind, rows(q(db, 'SELECT "option" FROM chetna_options WHERE "kind" = ? AND "active" = 1', kind)));
  }
  return [...out];
}

/** Checks the fields being saved; returns them cleaned. `null` clears a field. `temple`: the batch asks the temple activities.
 *  `look`: what cleanDayReads read, by key; anything not in it is read here, as before. */
async function cleanDay(ctx, journal, patch, temple = false, look = null) {
  const seen = async (key, read) => (look && look.has(key) ? look.get(key) : read());
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw apiError('BAD_REQUEST', 'Bad day');
  const out = {}, problems = [], bad = (k, m) => problems.push({ path: 'day.' + k, message: m });
  for (const [k, v] of Object.entries(patch)) {
    if (!FIELDS.includes(k)) throw apiError('BAD_REQUEST', 'Unknown field day.' + k);
    if (v === null) { out[k] = null; continue; }
    if (TEMPLE_KEYS.includes(k)) {
      if (!temple) bad(k, 'Temple activities are asked only in the Temple Residents batch.');
      else if (!TEMPLE_OK.includes(v)) bad(k, 'Choose On Time, Late or Absent.');
      else out[k] = v;
      continue;
    }
    switch (k) {
      case 'sleptAt': case 'wokeAt': case 'chantingDoneAt':
        if (!TIME.test(String(v))) bad(k, `${LABEL[k]}: choose a time.`); else out[k] = v; break;
      case 'rounds': if (!int(v, 0, 64)) bad(k, 'Rounds: a whole number from 0 to 64.'); else out[k] = v; break;
      case 'chantingSameDay': if (typeof v !== 'boolean') bad(k, 'Choose Yes or No.'); else out[k] = v; break;
      case 'dayRestMin': case 'hearingMin': case 'readingMin': case 'exerciseMin':
        if (!int(v, 0, 600)) bad(k, 'Minutes: a whole number from 0 to 600.'); else out[k] = v; break;
      case 'serviceMin': if (!int(v, 0, 999)) bad(k, 'Service minutes: a whole number from 0 to 999.'); else out[k] = v; break;
      case 'studyJobHrs': if (typeof v !== 'number' || v < 0 || v > 24 || Math.round(v * 2) !== v * 2) bad(k, 'Hours: 0 to 24, in half hours.'); else out[k] = v; break;
      case 'serviceTopic': if (typeof v !== 'string' || v.trim().length > 120) bad(k, 'At most 120 characters.'); else out[k] = v.trim(); break;
      case 'comment': if (typeof v !== 'string' || v.length > 500) bad(k, 'At most 500 characters.'); else out[k] = v.trim(); break;
      case 'hearing': {
        if (!Array.isArray(v) || v.length > 8) { bad(k, 'Choose the lectures you heard.'); break; }
        const list = [];
        for (const h of v) {
          if (h && typeof h.lectureId === 'string') {
            const ok = await seen('lecture:' + h.lectureId, () => one(ctx.db, 'SELECT 1 FROM lectures WHERE "lecture_id" = ? AND "journal" = ?', h.lectureId, journal));
            if (!ok) { bad(k, 'That lecture is not in your journal.'); break; }
            list.push({ lectureId: h.lectureId });
          } else if (h && typeof h.text === 'string' && h.text.trim().length >= 2 && h.text.trim().length <= 120) list.push({ text: h.text.trim() });
          else { bad(k, 'Type the topic (2–120 characters), or pick a lecture.'); break; }
        }
        out[k] = list; break;
      }
      case 'reading': {
        if (v && typeof v.bookId === 'string') {
          if (!(await seen('book:' + v.bookId, () => one(ctx.db, 'SELECT 1 FROM books WHERE "book_id" = ?', v.bookId)))) bad(k, 'Unknown book.'); else out[k] = { bookId: v.bookId };
        } else if (v && typeof v.text === 'string' && v.text.trim().length >= 2 && v.text.trim().length <= 120) out[k] = { text: v.text.trim() };
        else bad(k, 'Type the book (2–120 characters), or pick one.');
        break;
      }
      case 'chetnaPositive': case 'chetnaNegative': {
        const kind = k === 'chetnaPositive' ? 'POSITIVE' : 'NEGATIVE';
        const allowed = (await seen('chetna:' + kind, () => all(ctx.db, 'SELECT "option" FROM chetna_options WHERE "kind" = ? AND "active" = 1', kind))).map(r => r.option);
        if (!Array.isArray(v) || v.some(x => !allowed.includes(x))) bad(k, 'Choose from the list.'); else out[k] = [...new Set(v)];
        break;
      }
    }
  }
  if (problems.length) throw invalid(problems);
  return out;
}

/** The required answers a day still lacks (keys). */
export function missingOf(day, tracks) {
  const d = day || {}, req = requiredFor(tracks), miss = req.filter(k => d[k] === undefined || d[k] === null);
  // the follow-up questions belong to minutes that only the full day asks for, so they follow the set
  if (req.includes('hearingMin') && d.hearingMin > 0 && !(Array.isArray(d.hearing) && d.hearing.length)) miss.push('hearing');
  if (req.includes('readingMin') && d.readingMin > 0 && !d.reading) miss.push('reading');
  return miss;
}
export const stateOf = (day, tracks) => { const n = Object.keys(day || {}).filter(k => k !== 'v').length; return !n ? 'empty' : missingOf(day, tracks).length ? 'partial' : 'complete'; };
const parse = s => (s ? JSON.parse(s) : null);

/* ------------------------------------------------------------------------ */
/* Actions                                                                    */
/* ------------------------------------------------------------------------ */

/** The four statements weekStatus reads, in the order its answers are judged. */
const statusStmts = (db, login, weekId) => [
  q(db, 'SELECT * FROM submissions WHERE login = ? AND week_id = ?', login, weekId),
  q(db, "SELECT * FROM reopens WHERE login = ? AND week_id = ? AND state = 'OPEN'", login, weekId),
  q(db, 'SELECT * FROM missed_weeks WHERE login = ? AND week_id = ?', login, weekId),
  q(db, 'SELECT * FROM drafts WHERE login = ? AND week_id = ?', login, weekId)
];
/** The verdict, from those four rows. The ONLY place the precedence is written (submitted > missed-unless-reopened
 *  > reopened > draft > not started), so the batched and unbatched paths cannot drift apart. */
const statusOf = ([sub, reopen, missed, draft]) => {
  if (sub) return { status: 'SUBMITTED', sub };
  if (missed && !reopen) return { status: 'MISSED', missed };
  return { status: reopen ? 'REOPENED' : draft ? 'DRAFT' : 'NOT_STARTED', draft, reopen };
};

/**
 * A devotee's week, one read at a time.
 *
 * Kept SEQUENTIAL on purpose (17 Oct 2026). A submitted week answers on the FIRST read, and that is the common
 * case on the screens that call this one week at a time, so batching all four here would read three tables the
 * short circuit skips — more rows for fewer hops, the wrong trade on the free plan. Where every row is needed
 * anyway (weekView, below), the batched form is used instead and `statusOf` keeps the two in step.
 */
export async function weekStatus(db, login, weekId) {
  const sub = await one(db, 'SELECT * FROM submissions WHERE login = ? AND week_id = ?', login, weekId);
  if (sub) return { status: 'SUBMITTED', sub };
  const reopen = await one(db, "SELECT * FROM reopens WHERE login = ? AND week_id = ? AND state = 'OPEN'", login, weekId);
  const missed = await one(db, 'SELECT * FROM missed_weeks WHERE login = ? AND week_id = ?', login, weekId);
  if (missed && !reopen) return { status: 'MISSED', missed };
  const draft = await one(db, 'SELECT * FROM drafts WHERE login = ? AND week_id = ?', login, weekId);
  return { status: reopen ? 'REOPENED' : draft ? 'DRAFT' : 'NOT_STARTED', draft, reopen };
}

/** The six statements one open week needs (weekStatus's four, the class week, the attendance row). */
const weekStmts = (db, login, weekId, batchId) => [
  ...statusStmts(db, login, weekId),
  q(db, 'SELECT * FROM class_weeks WHERE batch_id = ? AND week_id = ?', String(batchId || ''), String(weekId)),
  q(db, 'SELECT devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used, locked, notice_at FROM attendance WHERE login = ? AND week_id = ?', login, weekId)
];

/** The view of one week from its six rows, however they were read (one week alone, or home.get's single batch). */
async function weekViewFrom(ctx, login, weekId, now, batchId, [sub, reopen, missed, draft, cw, att]) {
  const db = ctx.db;
  /* ONE round trip for the six rows this view always needs (17 Oct 2026). They were six sequential awaits —
   * weekStatus's four, the class week and the attendance row — and home.get does this for EVERY open week, so a
   * devotee with last week still open waited for twelve hops before the screen could be drawn. Every statement,
   * every row and every rule below is the one that ran before; only the waiting is gone. windowOf is not here:
   * it reads `settings`, which the per-call memo already holds (db.js), so it costs no query at all. */
  const w = statusOf([sub, reopen, missed, draft]), win = await windowOf(db, weekId);
  const today = ymd(now);
  const closes = w.reopen ? parseIso(w.reopen.open_until) : win.closes;
  const days = COLS.map((c, i) => {
    const date = addDays(weekId, i), day = parse(w.draft?.[c]);
    return { date, name: DAY_NAMES[i], future: date > today, state: stateOf(day), version: day?.v || 0, day: day || {} };
  });
  const we = parse(w.draft?.week_end) || {};
  /* the batch's own class day, not Sunday for everyone (17 Oct 2026). The gates in attendance.js, groups.js and
   * board.js moved to classOpensFor with the class-day change; THIS view did not, so a weekday batch's devotee was
   * told attendance opened on the Sunday while the server already accepted their mark on the class day.
   * batchesAll is memoised per call, so it costs no query. */
  const attOpens = (await classOpensFor(db, batchId, weekId)).opens;
  return {
    weekId, status: w.status, opensAt: isoIst(win.opens), closesAt: isoIst(closes),
    canSubmit: (w.status === 'DRAFT' || w.status === 'REOPENED' || w.status === 'NOT_STARTED') && now >= win.opens && now < closes,
    // Night Stay and the 4 regulative principles open on Saturday 18:00 IST (the head, 3 Oct 2026)
    days, weekEnd: { version: we.v || 0, nightStay: we.nightStay || null, principles: we.principles || null, opensAt: isoIst(weekEndOpens(weekId)), open: now >= weekEndOpens(weekId),
                     state: we.nightStay && we.principles ? 'complete' : (we.nightStay || we.principles ? 'partial' : 'missing') },
    // classWeek: no regular class this week; the coordinator gives attendance and the devotee's own mark is not asked for
    // by: who gave the mark that counts (master > coordinator > leader > class week > devotee); a higher mark that differs
    // from the devotee's own is shown to them (notice: when it was given)
    attendance: { devotee: att?.devotee_mark || null, leader: att?.leader_mark || null, coordinator: att?.coordinator_mark || null, master: att?.master_mark || null,
                  used: markUsed(att, cw) || null, by: markLevel(att, cw) || null, notice: att?.notice_at && att.devotee_mark && markUsed(att, cw) !== att.devotee_mark ? att.notice_at : null,
                  // a reopened week's attendance is open again until the reopen's own deadline (closesAt), though the
                  // week's row was locked at its Monday deadline
                  locked: !!att?.locked && !w.reopen, classWeek: classView(cw),
                  opensAt: isoIst(attOpens) }
  };
}

/**
 * Today's birthdays in the caller's batch, for Home (the head, 27 Oct 2026; migration 0073): name only, no age or date.
 * Driven FROM profiles through profiles_by_birthday, then each match by login — never a walk of the batch. CROSS JOIN
 * fixes that order (SQLite's planner otherwise starts from every active account), and the unary + keeps memberships on
 * its login index instead of the batch index. md2: a 29 February birthday is kept on 1 March in a year without one.
 */
export function birthdayDays(now) {
  const day = isoIst(now).slice(0, 10), y = +day.slice(0, 4), md = day.slice(5);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return [md, md === '03-01' && !leap ? '02-29' : md];
}
const birthdayStmt = (db, batchId, now) => q(db, `SELECT a.login, a.name FROM profiles p
    CROSS JOIN memberships m ON m.login = p.login AND +m.to_week = '' AND m.state = 'ACTIVE' AND +m.batch_id = ?
    CROSS JOIN accounts a ON a.login = p.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
  WHERE substr(p.dob, 6, 5) IN (?, ?) AND p.dob <> '' ORDER BY a.name LIMIT 20`, batchId, ...birthdayDays(now));

export async function homeGet(d, ctx) {
  const t = await target(ctx, undefined), now = ctx.now(), login = t.acct.login, db = ctx.db;
  const open = await openWeeks(db, login, now);
  /* EVERYTHING else Home needs in ONE round trip (22 Oct 2026): each open week's six rows, the book, the lectures
     heard, the posts the caller may see, and their photo. They used to be a batch per week and then four more reads
     one after another — 11 hops on a devotee's every open. None depends on another; the statements, the rows and
     every rule are the ones that ran before (weekViewFrom, heardFrom, the wall's own `finish`). */
  const ann = await visibleQuery(ctx);                      // its SQL depends on the caller's scopes, already in memory
  const per = open.map((w) => weekStmts(db, login, w, t.batchId));
  const got = await reads(db, [
    ...per.flat(),
    q(db, 'SELECT current_book_id FROM profiles WHERE login = ?', login),
    rows(heardStmt(db, login)),
    rows(ann.stmt),
    q(db, 'SELECT updated_at FROM photos WHERE login = ?', ctx.acct.login),
    // last, and only with a batch: who in it has a birthday today (rides in the same round trip)
    ...(t.batchId ? [rows(birthdayStmt(db, t.batchId, now))] : [])
  ]);
  const weeks = [];
  for (let i = 0; i < open.length; i++) weeks.push(await weekViewFrom(ctx, login, open[i], now, t.batchId, got.slice(i * 6, i * 6 + 6)));
  const [prof, heardRows, annRows, photoRow, bdayRows = []] = got.slice(open.length * 6);
  const heard = heardFrom(heardRows);
  // the posts the caller sees (as announcements.list), newest first: pinned ones are first in that list, not newest
  const times = ann.finish(annRows).map(a => a.shown_at || a.created_at).sort().reverse();
  /* `user` is the SAME object auth.me returns (17 Oct 2026), so a repeat open can be one call instead of two:
   * the app already holds the person from the last open and only needs to know they are still who they were.
   * It is added, never substituted — auth.me is unchanged and still the authority on an app that has no kept
   * user, on sign-in, and after a role change. Only the caller's own home is ever described here (homeGet
   * passes no onBehalfOf), so this can never carry another person's scopes. */
  return {
    profile: { login, iyfId: t.acct.iyf_id || null, name: t.acct.name, batchId: t.batchId || null },
    user: await userInfo(ctx, ctx.acct, ctx.scopes, photoRow),
    weeks,
    // names: moves when a facilitator or batch name changes (migration 0074's triggers); the phone then fetches the
    // lists once (meta.get), so the wheel and batch names are fresh on start at no call otherwise. Settings are read once a call
    versions: { rules: await setting(ctx.db, 'rules_version', RULES_VERSION), journals: await setting(ctx.db, 'journals_version', 'j1'), names: await setting(ctx.db, 'names_version', '1') },
    progress: { currentBookId: prof?.current_book_id || null, heard },
    // the newest post on the wall, so the bell can show "new" without another call; announcementTimes: the 10 newest
    // posts' times, so it can count how many are new since the wall was last opened
    latestAnnouncementAt: times[0] || null,
    announcementTimes: times.slice(0, 10),
    // batch-mates born today, by name only (no login, no date, no age); self: the caller's own birthday
    birthdays: bdayRows.map(r => ({ name: r.name, self: r.login === login }))
  };
}

/**
 * Checks a week can still be changed by this devotee. Returns its status (weekStatus's answer) and the rows of `extra`.
 *
 * ONE round trip (S2, 27 Oct 2026; it was up to six one after another): the four status rows, the reopens openWeeks
 * needs, the settings if this call does not hold them yet, and whatever the caller needs next (`extra`: the class week
 * and attendance row for Submit, the lookups for a day's answers). weekStatus's short circuit is given up here on
 * purpose: on the Sunday path the week is almost never submitted, so it saved three keyed reads that find nothing
 * (0 rows) at the cost of three hops on every save. The precedence is statusOf's, the same as weekStatus's.
 */
async function editable(ctx, login, weekId, extra = []) {
  if (!validWeekId(weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const db = ctx.db, st = settingsRead(db);
  const got = await reads(db, [...statusStmts(db, login, weekId), reopensStmt(db, login), ...extra, ...(st ? [st] : [])]);
  if (st) keepSettings(db, got[got.length - 1]);
  const w = statusOf(got.slice(0, 4));
  if (w.status === 'SUBMITTED') throw apiError('ALREADY_SUBMITTED', 'This week was already submitted.');
  if (w.status === 'MISSED' || !(await openWeeksFrom(db, ctx.now(), got[4])).includes(weekId)) throw apiError('WINDOW_CLOSED', 'This week is closed.');
  return { w, extra: got.slice(5, 5 + extra.length) };
}

export async function weekGet(d, ctx) {
  const t = await target(ctx, d.onBehalfOf), login = t.acct.login, now = ctx.now();
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  await behalfWeekAllowed(ctx, t, d.weekId);
  /* S2 (27 Oct 2026): two batches at most, where it was the four status reads one by one and then the same four AGAIN
   * inside weekView. First the status rows and the attendance row (a submitted week answers from these alone, the
   * rows it read before); then, only for a week still open, the class week, the reopens and the settings. */
  const db = ctx.db;
  const [sub, reopen, missed, draft, att] = await reads(db, [...statusStmts(db, login, d.weekId),
    q(db, 'SELECT devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used, locked, notice_at FROM attendance WHERE login = ? AND week_id = ?', login, d.weekId)]);
  const w = statusOf([sub, reopen, missed, draft]);
  if (w.status === 'SUBMITTED') {
    const s = finalScores(w.sub, att?.mark_used);
    return { weekId: d.weekId, status: 'SUBMITTED', submittedAt: s.submitted_at, daysFilled: s.days_filled ?? 7, ...weekOf(s),
             weekEnd: { nightStay: s.night_stay, principles: s.principles, chantingAverage: s.avg_rounds },
             scores: pickScores(s) };
  }
  // a missed week scores 0 (the head, 4 Oct 2026); daysFilled: the days it had begun
  if (w.status === 'MISSED') return { weekId: d.weekId, status: 'MISSED', daysFilled: w.missed.days_filled, overall: 0 };
  const st = settingsRead(db);
  const [cw, reopens, set] = await reads(db, [q(db, 'SELECT * FROM class_weeks WHERE batch_id = ? AND week_id = ?', String(t.batchId || ''), String(d.weekId)),
    reopensStmt(db, login), ...(st ? [st] : [])]);
  if (st) keepSettings(db, set);
  if (!(await openWeeksFrom(db, now, reopens)).includes(d.weekId)) throw apiError('NOT_FOUND', 'Nothing was filled for that week.');
  return weekViewFrom(ctx, login, d.weekId, now, t.batchId, [sub, reopen, missed, draft, cw, att]);
}

const SCORE_KEYS = ['bed', 'wake_up', 'day_sleep', 'japa', 'pathan', 'sravan', 'seva', 'attendance', 'body', 'soul', 'overall'];
// morning: the Morning program column, only on a card that has it (TRD, Phase 22); every other week's scores are unchanged
export const pickScores = s => ({ ...Object.fromEntries(SCORE_KEYS.map(k => [k, s[k]])), ...(s.morning !== undefined && s.morning !== null ? { morning: s.morning } : {}) });

/** Statement: creates the draft row if it is not there yet (a no-op otherwise). */
const ensureDraft = (ctx, login, weekId, batchId) => q(ctx.db,
  'INSERT OR IGNORE INTO drafts (login, week_id, batch_id, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
  login, weekId, batchId, isoIst(ctx.now()), isoIst(ctx.now()), ctx.login);
/**
 * Runs a draft's versioned UPDATE; returns the rows it changed. With no draft row yet, the row is created in the SAME
 * round trip (one batch: the insert, then the update). The version check inside the UPDATE is what decides STALE, as
 * it always did; the draft row it is judged against is the one editable() read.
 */
async function writeDraft(ctx, had, login, weekId, batchId, update) {
  if (had) return (await update.run()).meta.changes;
  return (await ctx.db.batch([ensureDraft(ctx, login, weekId, batchId), update]))[1].meta.changes;
}

export async function saveDay(d, ctx, req) {
  const t = await target(ctx, d.onBehalfOf), login = t.acct.login;
  // read before any write (the per-call memory is cleared by a write): scopesOf / target() already hold it
  const inactiveNow = (await currentMembership(ctx.db, login))?.state === 'INACTIVE';
  // S2: the lookups the day's answers are checked against ride in editable()'s one read batch; the batch's card is the
  // one scopesOf already read (batchesAll is memoised), not a query of its own
  const b0 = (await batchesAll(ctx.db)).find(x => x.batch_id === String(t.batchId || ''));
  const looks = b0 ? cleanDayReads(ctx.db, b0.hearing_journal, d.day) : [];
  const { w, extra } = await editable(ctx, login, d.weekId, looks.map(x => x[1]));
  const i = COLS.findIndex((c, k) => addDays(d.weekId, k) === d.date);
  if (i < 0) throw invalid({ path: 'date', message: 'That day is not in this week.' });
  if (d.date > ymd(ctx.now())) throw apiError('FUTURE_DAY', 'A day can be filled from that day onwards.');
  if (!Number.isInteger(d.version) || d.version < 0) throw invalid({ path: 'version', message: 'Missing version.' });
  const b = await cardOf(ctx.db, t.batchId);
  const patch = await cleanDay(ctx, b.hearing_journal, d.day, !!b.temple_activities, new Map(looks.map((x, k) => [x[0], extra[k]])));
  // the day as editable() read it (no draft row yet: an empty day at version 0, which is what a new row holds)
  const col = COLS[i], had = w.draft || null;
  const cur = parse(had?.[col]) || { v: 0 };
  // the same save arriving twice (a retry after the answer was lost): already stored, so it is a success. This is what
  // makes a save safe to repeat without a replay-cache row (one database write less per save; api.js › noReplay)
  if (cur.v === d.version + 1 && sameAnswers(cur, patch)) return { version: cur.v, state: stateOf(cur, b.tracks), missing: missingOf(cur, b.tracks), marks: dayMarks(b.score_card, cur) };
  if (cur.v !== d.version) throw apiError('STALE', 'This day was updated on another device.', { data: { current: cur } });
  const next = { ...cur, ...patch, v: cur.v + 1 };
  for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
  // the version check again inside the write: a save from another device in between makes this one STALE
  const changed = await writeDraft(ctx, had, login, d.weekId, t.batchId, q(ctx.db, `UPDATE drafts SET ${col} = ?, updated_at = ?, updated_by = ? WHERE login = ? AND week_id = ? AND COALESCE(json_extract(${col}, '$.v'), 0) = ?`,
    JSON.stringify(next), isoIst(ctx.now()), ctx.login, login, d.weekId, cur.v));
  if (!changed) throw apiError('STALE', 'This day was updated on another device.', { data: { current: parse((await one(ctx.db, `SELECT ${col} AS day FROM drafts WHERE login = ? AND week_id = ?`, login, d.weekId)).day) } });
  // a day saved for a devotee by staff: one line in the Activity log (the devotee's own saves are not logged)
  if (t.behalf) await audit(ctx.db, ctx, 'week.saveDay.onBehalf', login, t.batchId, null, { weekId: d.weekId, date: d.date, fields: Object.keys(patch) }, '', req?.requestId).run();
  // a saved day brings an inactive devotee back (ADR 0020, how = FILLED): one batch, only while their membership is
  // INACTIVE (read already by scopesOf / target()), so an active devotee's save costs nothing more
  if (inactiveNow) await ctx.db.batch(comeBackStatements(ctx.db, ctx, { login, from: d.weekId, how: 'FILLED', at: isoIst(ctx.now()), requestId: req?.requestId }));
  return { version: next.v, state: stateOf(next, b.tracks), missing: missingOf(next, b.tracks), marks: dayMarks(b.score_card, next) };
}

export async function saveWeekEnd(d, ctx, req) {
  const t = await target(ctx, d.onBehalfOf), login = t.acct.login;
  const { w } = await editable(ctx, login, d.weekId);
  const problems = [];
  for (const k of ['nightStay', 'principles']) if (d[k] !== undefined && !['YES', 'NO'].includes(d[k])) problems.push({ path: k, message: 'Choose Yes or No.' });
  if (problems.length) throw invalid(problems);
  if (!Number.isInteger(d.version) || d.version < 0) throw invalid({ path: 'version', message: 'Missing version.' });
  // Night Stay and the 4 regulative principles open on Saturday 18:00 IST (the head, 3 Oct 2026)
  if (ctx.now() < weekEndOpens(d.weekId)) throw apiError('FUTURE_DAY', 'Night Stay and the 4 regulative principles open on Saturday at 6 PM.');
  // the draft row as editable() read it (S2: no second read after creating it; a new row is empty)
  const row = w.draft || null;
  const cur = parse(row?.week_end) || { v: 0 };
  if (cur.v === d.version + 1 && sameAnswers(cur, { ...(d.nightStay !== undefined ? { nightStay: d.nightStay } : {}), ...(d.principles !== undefined ? { principles: d.principles } : {}) }))
    return { version: cur.v, chantingAverage: chantingAverage(COLS.map(c => parse(row?.[c]))) };   // a retried save, already stored
  if (cur.v !== d.version) throw apiError('STALE', 'Updated on another device.', { data: { current: cur } });
  const next = { ...cur, v: cur.v + 1 };
  if (d.nightStay !== undefined) next.nightStay = d.nightStay;
  if (d.principles !== undefined) next.principles = d.principles;
  const changed = await writeDraft(ctx, row, login, d.weekId, t.batchId, q(ctx.db, `UPDATE drafts SET week_end = ?, updated_at = ?, updated_by = ? WHERE login = ? AND week_id = ? AND COALESCE(json_extract(week_end, '$.v'), 0) = ?`,
    JSON.stringify(next), isoIst(ctx.now()), ctx.login, login, d.weekId, cur.v));
  if (!changed) throw apiError('STALE', 'Updated on another device.', { data: { current: parse((await one(ctx.db, 'SELECT week_end FROM drafts WHERE login = ? AND week_id = ?', login, d.weekId)).week_end) } });
  if (t.behalf) await audit(ctx.db, ctx, 'week.saveWeekEnd.onBehalf', login, t.batchId, null, { weekId: d.weekId, nightStay: next.nightStay || null, principles: next.principles || null }, '', req?.requestId).run();
  return { version: next.v, chantingAverage: chantingAverage(COLS.map(c => parse(row?.[c]))) };
}

/** True when every answer in patch is already what saved holds (null = cleared). */
function sameAnswers(saved, patch) {
  return Object.entries(patch).every(([k, v]) => (v === null ? saved[k] === undefined : JSON.stringify(saved[k]) === JSON.stringify(v)));
}

function chantingAverage(days) {
  const r = days.filter(x => x && Number.isInteger(x.rounds)).map(x => x.rounds);
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
}

export async function setAttendance(d, ctx, req) {
  const t = await target(ctx, d.onBehalfOf), login = t.acct.login, now = ctx.now();
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  if (!['P', 'A'].includes(d.mark)) throw invalid({ path: 'mark', message: 'Choose Present or Absent.' });
  /* S2 (27 Oct 2026): one read batch — the devotee's open reopens (this week's is among them: reopens is keyed by login
   * and week), the class week and the settings if not held — where it was four round trips one after another. */
  const db = ctx.db, st = settingsRead(db);
  const [reopens, cw, set] = await reads(db, [reopensStmt(db, login), q(db, 'SELECT * FROM class_weeks WHERE batch_id = ? AND week_id = ?', String(t.batchId || ''), String(d.weekId)), ...(st ? [st] : [])]);
  if (st) keepSettings(db, set);
  // a week the IYF head reopened follows the reopen's own deadline (its row was locked at the Monday deadline)
  const reopen = reopens.find(r => r.week_id === d.weekId) || null;
  const reopened = !!reopen && parseIso(reopen.open_until) > now;
  if ((now >= (await windowOf(db, d.weekId)).closes && !reopened) || !(await openWeeksFrom(db, now, reopens)).includes(d.weekId)) throw apiError('WINDOW_CLOSED', 'Attendance for this week is closed.');
  // attendance is for the week's class, on the day that batch meets (17 Oct 2026; it was Sunday for
  // everyone until the training batches, which meet on a weekday)
  const cls = await classOpensFor(ctx.db, t.batchId, d.weekId);
  if (now < cls.opens) throw apiError('FUTURE_DAY', `Mark attendance after the ${cls.name} class.`);
  if (cw) throw apiError('CONFLICT', `No regular class this week (${cw.note}): your coordinator gives attendance.`);
  // past its deadline only a reopened week gets here: its closed summary follows the mark (C4; read before any write)
  const done = await setting(db, 'deadline_done', '');
  // the devotee's own mark: the lowest level; a group leader's, coordinator's or head's mark for the week stays above it.
  // The mark and the row as it now stands, in one batch (one round trip; the read sees the write)
  const [, back] = await db.batch([writeMark(db, { level: 'devotee', login, weekId: d.weekId, batchId: t.batchId, mark: d.mark, by: ctx.login, at: isoIst(now), force: reopened }),
    q(db, 'SELECT devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used, notice_at FROM attendance WHERE login = ? AND week_id = ?', login, d.weekId),
    ...refreshClosed(db, done, t.batchId, d.weekId, isoIst(now))]);
  const a = back.results[0];
  return { devotee: a.devotee_mark || null, leader: a.leader_mark || null, coordinator: a.coordinator_mark || null, master: a.master_mark || null,
           used: a.mark_used || null, by: markLevel(a, null) || null, notice: a.notice_at && a.mark_used !== a.devotee_mark ? a.notice_at : null };
}

export async function submit(d, ctx, req) {
  const t = await target(ctx, d.onBehalfOf), login = t.acct.login, now = ctx.now(), db = ctx.db;
  // read before any statement is prepared (preparing a write clears the per-call memory): scopesOf / target() hold it
  const m0 = await currentMembership(db, login);
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  // S2: the class week and the attendance row ride in editable()'s one read batch
  const { w, extra: [cw, attRow] } = await editable(ctx, login, d.weekId, [
    q(db, 'SELECT * FROM class_weeks WHERE batch_id = ? AND week_id = ?', String(t.batchId || ''), String(d.weekId)),
    q(db, 'SELECT * FROM attendance WHERE login = ? AND week_id = ?', login, d.weekId)]);
  const win = await windowOf(db, d.weekId);
  const closes = w.reopen ? parseIso(w.reopen.open_until) : win.closes;
  if (now < win.opens) throw apiError('WINDOW_CLOSED', win.words.fromSentence);
  if (now >= closes) throw apiError('WINDOW_CLOSED', 'This week is closed.');
  const days = COLS.map(c => parse(w.draft?.[c]) || {}), we = parse(w.draft?.week_end) || {};
  const mark = markUsed(attRow, cw);
  // the batch is read BEFORE the gaps are judged: what a week must contain depends on what the batch
  // collects (ADR 0009), and a VL-2 week has no days, no night stay and no principles to report
  const b = await cardOf(db, t.batchId), at = isoIst(now);
  const asksDays = requiredFor(b.tracks).length > 0;
  const gaps = [];
  if (asksDays && !days.some(day => stateOf(day, b.tracks) === 'complete')) gaps.push({ path: 'days', message: 'Fill at least one whole day' });
  // the week-end questions belong to the full card; the Vedic levels keep attendance (and rounds) only
  if (b.tracks === 'full' || !b.tracks) {
    if (!we.nightStay) gaps.push({ path: 'weekEnd.nightStay', message: 'Night Stay missing' });
    if (!we.principles) gaps.push({ path: 'weekEnd.principles', message: '4 regulative principles missing' });
  }
  if (!mark) gaps.push({ path: 'attendance', message: 'Attendance: mark Present or Absent' });
  if (gaps.length) throw apiError('INCOMPLETE', `${gaps.length} answer${gaps.length === 1 ? ' is' : 's are'} missing.`, { fields: gaps });

  // a reopened week submitted after its deadline: the closed week's summary counts it at once (C4). Read BEFORE the
  // submission's statement is prepared — preparing a write clears the call's memory of the settings (one more hop)
  const done = await setting(db, 'deadline_done', ''), rulesVersion = await setting(db, 'rules_version', RULES_VERSION);
  const sub = submissionRow(db, { login, acct: t.acct, batchId: t.batchId, weekId: d.weekId, days, weekEnd: we, mark, card: b.score_card, tracks: b.tracks,
    rulesVersion, at, by: ctx.login, behalf: t.behalf, requestId: String(req.requestId || ''), reopened: !!w.reopen });
  const s = sub.scores;
  // a submitted week makes an INACTIVE membership active again by itself (ADR 0020, inactive.js; how = FILLED), whoever
  // made it inactive. The membership is the one scopesOf / target() already read: no extra round trip, and nothing at all
  // is added for someone active.
  const back = m0?.state === 'INACTIVE' ? comeBackStatements(db, ctx, { login, from: d.weekId, how: 'FILLED', at, requestId: req.requestId }) : [];
  try {
    await db.batch([
      sub.stmt,
      q(db, 'DELETE FROM drafts WHERE login = ? AND week_id = ?', login, d.weekId),
      // a no-class week gave the mark: keep it in the Attendance tab too
      q(db, 'INSERT OR IGNORE INTO attendance (login, week_id, batch_id, mark_used, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)', login, d.weekId, t.batchId, mark, 'class week', at),
      q(db, "UPDATE reopens SET state = 'SUBMITTED' WHERE login = ? AND week_id = ? AND state = 'OPEN'", login, d.weekId),
      q(db, 'DELETE FROM missed_weeks WHERE login = ? AND week_id = ?', login, d.weekId),
      ...back,
      ...(t.behalf ? [audit(db, ctx, 'week.submit.onBehalf', login, t.batchId, null, { weekId: d.weekId }, '', req.requestId)] : []),
      ...refreshClosed(db, done, t.batchId, d.weekId, at),
      dirty(db, 'submissions', 'reopens', 'attendance', 'missed_weeks', 'audit_log')
    ]);
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) throw apiError('ALREADY_SUBMITTED', 'This week was already submitted.');
    throw e;
  }
  return { submittedAt: at, scores: pickScores(s), daysFilled: sub.daysFilled };
}

/**
 * The submissions row for a week (Submit and the deadline share it). Only complete days count; a day not complete is
 * left out and scores 0, so each category is the week's marks ÷ 175 and a part week's score is capped by its days.
 */
function submissionRow(db, { login, acct, batchId, weekId, days, weekEnd, mark, card, tracks, rulesVersion, at, by, behalf, requestId, reopened }) {
  const clean = days.map(day => { if (stateOf(day, tracks) !== 'complete') return {}; const { v, ...rest } = day; return rest; });
  const daysFilled = clean.filter(x => Object.keys(x).length).length;
  const total = k => clean.reduce((n, x) => n + (x[k] || 0), 0);
  const sevaMinutes = total('serviceMin'), avgRounds = chantingAverage(clean);
  const s = weekScores(card, clean, mark, sevaMinutes);
  const stmt = q(db, `INSERT INTO submissions (submission_id, login, iyf_id, name, batch_id, week_id, submitted_at, submitted_by, on_behalf, request_id, rules_version, reopened,
         bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, seva_minutes, avg_rounds, night_stay, principles,
         hearing_minutes, reading_minutes, days_json, marks_json, week_json, days_filled, score_card, morning) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    `${login}-${weekId}`, login, acct.iyf_id || '', acct.name, batchId, weekId, at, by, behalf ? 1 : 0, requestId, rulesVersion, reopened ? 1 : 0,
    s.bed, s.wake_up, s.day_sleep, s.japa, s.pathan, s.sravan, s.seva, s.attendance, s.body, s.soul, s.overall,
    sevaMinutes, String(avgRounds ?? ''), weekEnd.nightStay || '', weekEnd.principles || '', total('hearingMin'), total('readingMin'),
    // the whole week as one compact JSON (decision 42); the two older per-part columns stay empty for new weeks
    '', '', weekJson({ week: weekId, login, iyfId: acct.iyf_id || '', name: acct.name, batch: batchId, days: clean, marks: s.marks, daysFilled,
      weekEnd: { nightStay: weekEnd.nightStay, principles: weekEnd.principles, avgRounds }, attendance: mark || '', sevaMinutes, scores: pickScores(s) }),
    // the card it was scored with (a later attendance mark re-works Overall only where the card scores attendance) and,
    // on the TRD card, the Morning program column (migration 0065)
    daysFilled, String(card || ''), s.morning ?? null);
  return { stmt, scores: s, daysFilled };
}

export async function historyList(d, ctx) {
  const t = await target(ctx, d.onBehalfOf), login = t.acct.login;
  // the same rule as week.get (audit F10): history is by definition earlier weeks, so a coordinator asking on
  // someone else's behalf is refused. The head sees it; so does the devotee for their own.
  if (t.behalf && !ctx.scopes.master) throw apiError('FORBIDDEN', 'Coordinators see only the week being filled now. Ask the IYF head for earlier weeks.');
  const limit = d.limit === undefined ? 8 : d.limit;
  if (!int(limit, 1, 26)) throw invalid({ path: 'limit', message: '1 to 26.' });
  if (d.before !== undefined && !validWeekId(d.before)) throw invalid({ path: 'before', message: 'Not a week.' });
  const before = d.before || '9999-12-31';
  // a missed week reads as 0 everywhere a score is shown or averaged (the head, 4 Oct 2026)
  // `dayPct` (13 Oct 2026, audit FE-7 / roadmap 5.4): the seven days' percentages, so the Report screen's month
  // calendar can colour its squares from THIS reply. It used to fetch week.get once per submitted week in view —
  // up to six extra round trips on opening a month, each one a full week with its answers and marks, on a phone
  // that only needed seven numbers. Computed by the database from the marks already stored in week_json, so this
  // adds no work per row and no new column; `week.get` is still what the screen calls when a week is opened.
  const subs = await all(ctx.db, `SELECT s.week_id, s.overall, s.body, s.soul, s.attendance, s.seva, s.days_filled, 'SUBMITTED' AS status, a.mark_used, s.score_card,
                                    -- The seven days' percentages, for the Report screen's month calendar.
                                    -- Marks are stored under "m" as [label, marks] pairs (weekjson.js), so the
                                    -- value is element 1 of each pair; COALESCE keeps a day nobody filled at 0
                                    -- IN ITS PLACE, because group_concat drops a NULL and the array would stop
                                    -- lining up with the week. Checked against shared/scoring.js dayPercent():
                                    -- 63,23,47,0,0,0,0 computed both ways on the same week.
                                    -- A linear card's marks (TRD, Phase 22) are [label, marks, of] triples: the day is
                                    -- out of the sum of its items' maxima (205), as dayPercent() does; others out of 150.
                                    (SELECT group_concat(CAST(ROUND(COALESCE(
                                        (SELECT SUM(CAST(json_extract(mv.value, '$[1]') AS REAL)) FROM json_each(json_extract(d.value, '$.m')) mv), 0)
                                        / COALESCE((SELECT SUM(CAST(json_extract(mv.value, '$[2]') AS REAL)) FROM json_each(json_extract(d.value, '$.m')) mv), 150.0)
                                        * 100) AS INTEGER), ',')
                                     FROM json_each(${DAYS_SQL('s')}) d) AS day_pct
                                  FROM submissions s
                                    LEFT JOIN attendance a ON a.login = s.login AND a.week_id = s.week_id WHERE s.login = ? AND s.week_id < ?
                                  UNION ALL SELECT week_id, 0, 0, 0, 0, 0, days_filled, 'MISSED', NULL, '', NULL FROM missed_weeks WHERE login = ? AND week_id < ?
                                  ORDER BY week_id DESC LIMIT ?`, login, before, login, before, limit + 1);
  return { weeks: subs.slice(0, limit).map(x => { const r = x.status === 'SUBMITTED' ? finalScores(x, x.mark_used) : x;
             return { weekId: r.week_id, status: r.status, overall: r.overall, body: r.body, soul: r.soul, attendance: r.attendance, seva: r.seva, daysFilled: r.days_filled ?? 7,
                      ...(x.day_pct ? { dayPct: String(x.day_pct).split(',').map(n => Number(n)) } : {}) }; }),
           more: subs.length > limit };
}

/* ------------------------------------------------------------------------ */
/* The Monday 9 PM deadline (run by the schedule, in pieces)                  */
/* ------------------------------------------------------------------------ */

// per run: LIMITS.DEADLINE_PER_RUN devotees, LIMITS.DEADLINE_AUTO_PER_RUN of them auto-submitted — scoring a week costs
// more CPU than marking one missed (free plan: 10 ms a run; limits.js)

/**
 * Closes the most recent week whose deadline has passed. Every active devotee without a submission:
 *   · with at least one complete day in the draft: the week is submitted as it stands (the head, 4 Oct 2026), by
 *     "DEADLINE", scored like Submit (days not filled count 0); the week-end answers and attendance as far as given;
 *   · otherwise: a MISSED row (scored 0), the draft deleted and the drop written to AuditLog (devotee, week, days filled).
 * Attendance for the week then locks. Works through at most PER_RUN devotees (AUTO_PER_RUN submissions) a run.
 */
export async function runDeadline(env, db, now = new Date()) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7);
  const due = now >= (await windowOf(db, lastWeek)).closes ? lastWeek : addDays(lastWeek, -7);
  const done = await setting(db, 'deadline_done', '');
  if (done && done >= due) return 'up to date';
  const ctx = { login: 'SYSTEM', role: 'SYSTEM', now: () => now }, at = isoIst(now);
  // nobody is expected to submit before the pilot starts: such weeks are closed without marking anyone missed
  const from = await setting(db, 'tracking_from', '');
  const tracked = !!from && due >= from;
  // Active devotees who belonged to a batch that week and have neither submitted nor been marked missed.
  //
  // GROUP BY a.login (13 Oct 2026, audit B5): nothing in the schema stops a devotee holding two ACTIVE
  // memberships that both cover one week — requests.approve inserts a membership without closing an earlier one,
  // and boardRows() already dedupes exactly this case ("two memberships touching the same week: the first wins").
  // Without the grouping such a devotee appeared twice here, the run tried to write the same submission_id twice,
  // and because the whole write is ONE atomic batch, the UNIQUE constraint rolled back EVERY person in the run —
  // again the next minute, for ever, so nobody's week ever closed. MIN(m.batch_id) keeps the choice deterministic.
  const pending = await all(db, `
    SELECT a.login, a.name, a.iyf_id, MIN(m.batch_id) AS batch_id, d.d1, d.d2, d.d3, d.d4, d.d5, d.d6, d.d7, d.week_end
    FROM accounts a JOIN memberships m ON m.login = a.login AND m.state = 'ACTIVE' AND m.from_week <= ? AND (m.to_week = '' OR m.to_week >= ?)
    LEFT JOIN drafts d ON d.login = a.login AND d.week_id = ?
    WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.login = a.login AND s.week_id = ?)
      AND NOT EXISTS (SELECT 1 FROM missed_weeks x WHERE x.login = a.login AND x.week_id = ?)
      AND NOT EXISTS (SELECT 1 FROM reopens r WHERE r.login = a.login AND r.week_id = ? AND r.state = 'OPEN')
    GROUP BY a.login
    LIMIT ?`, due, due, due, due, due, due, tracked ? LIMITS.DEADLINE_PER_RUN : 0);
  if (pending.length) {
    const stmts = [], cards = new Map(), classWeeks = new Map(), marks = new Map();
    let missed = 0, auto = 0, waiting = 0, rulesVersion = null;
    const full = pending.filter(p => COLS.some(c => stateOf(parse(p[c])) === 'complete'));
    // attendance rows of those to submit, in one read (chunks of 90 for the IN list)
    for (let i = 0; i < full.length; i += 90) {
      const chunk = full.slice(i, i + 90).map(p => p.login);
      for (const a of await all(db, `SELECT * FROM attendance WHERE week_id = ? AND login IN (${chunk.map(() => '?').join(',')})`, due, ...chunk)) marks.set(a.login, a);
    }
    for (const p of pending) {
      const days = COLS.map(c => parse(p[c]) || {});
      // a batch without a card (should never happen) must not stop the deadline: that week falls to MISSED below
      if (!cards.has(p.batch_id)) cards.set(p.batch_id, await cardFor(db, p.batch_id).then(c => c.score_card, () => null));
      if (cards.get(p.batch_id) && days.some(day => stateOf(day) === 'complete')) {
        if (auto >= LIMITS.DEADLINE_AUTO_PER_RUN) { waiting++; continue; }                 // the next run takes it
        if (!classWeeks.has(p.batch_id)) classWeeks.set(p.batch_id, await classWeekOf(db, p.batch_id, due));
        rulesVersion ??= await setting(db, 'rules_version', RULES_VERSION);
        const cw = classWeeks.get(p.batch_id), mark = markUsed(marks.get(p.login), cw) || null;
        const sub = submissionRow(db, { login: p.login, acct: p, batchId: p.batch_id, weekId: due, days, weekEnd: parse(p.week_end) || {}, mark,
          card: cards.get(p.batch_id), rulesVersion, at, by: 'DEADLINE', behalf: false, requestId: '', reopened: false });
        stmts.push(sub.stmt, q(db, 'DELETE FROM drafts WHERE login = ? AND week_id = ?', p.login, due),
                   ...(mark ? [q(db, 'INSERT OR IGNORE INTO attendance (login, week_id, batch_id, mark_used, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)', p.login, due, p.batch_id, mark, 'class week', at)] : []),
                   audit(db, ctx, 'week.autoSubmitted', p.login, p.batch_id, null, { weekId: due, daysFilled: sub.daysFilled, overall: sub.scores.overall }, 'submitted at the deadline with the days filled', ''));
        auto++;
        continue;
      }
      const filled = days.filter(day => Object.keys(day).some(k => k !== 'v')).length;
      stmts.push(q(db, 'INSERT OR IGNORE INTO missed_weeks (login, week_id, batch_id, days_filled, at) VALUES (?, ?, ?, ?, ?)', p.login, due, p.batch_id, filled, at),
                 q(db, 'DELETE FROM drafts WHERE login = ? AND week_id = ?', p.login, due),
                 audit(db, ctx, 'week.dropped', p.login, p.batch_id, null, { weekId: due, daysFilled: filled }, 'not submitted by the deadline', ''));
      missed++;
    }
    stmts.push(dirty(db, 'missed_weeks', 'audit_log', ...(auto ? ['submissions', 'attendance'] : [])));
    await db.batch(stmts);
    const parts = [...(auto ? [`${auto} submitted as filled`] : []), ...(missed ? [`${missed} marked missed`] : [])];
    return `${due}: ${parts.join(', ')}${pending.length === LIMITS.DEADLINE_PER_RUN || waiting ? ' (continues)' : ''}`;
  }
  // everyone handled: lock attendance, drop leftover drafts (devotees no longer active), expire reopens, mark done
  await db.batch([
    q(db, 'UPDATE attendance SET locked = 1 WHERE week_id = ? AND locked = 0', due),
    q(db, 'DELETE FROM drafts WHERE week_id <= ? AND login NOT IN (SELECT login FROM reopens WHERE state = \'OPEN\')', due),
    q(db, "UPDATE reopens SET state = 'EXPIRED' WHERE state = 'OPEN' AND open_until <= ?", at),
    q(db, "UPDATE settings SET value = ?, changed_by = 'deadline', changed_at = ? WHERE key = 'deadline_done'", due, at),
    // Admin › Analysis (phase 21): the summary of the week just closed and the three before it (late changes)
    ...refreshWeeks(db, refreshedWeeks(due), at),
    dirty(db, 'attendance', 'reopens', 'settings')
  ]);
  return `${due}: closed`;
}
