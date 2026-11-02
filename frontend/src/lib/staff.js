// Pure helpers for the coordinator and master screens: weeks in Indian time, attendance changes, board counts.
import { cachedMeta } from './meta.js';
const IST = 5.5 * 3600e3, DAY = 864e5;
const ymd = (d) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

export const addWeeks = (weekId, n) => addDays(weekId, 7 * n);

/** The Monday (YYYY-MM-DD, Indian date) of the week containing `now`. */
export function mondayIST(now = new Date()) {
  const t = ymd(now), [y, m, d] = t.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(t, -dow);
}
/**
 * What a shown week is called beside its numbers (Phase 22 F3, 26 Oct 2026). Staff screens open on the FOCUS week,
 * which is last week until its Monday deadline: a column headed "This week" over last week's days read as if the
 * devotee had filled this week. "This week" / "Last week" / "Next week" by the Indian calendar, else its dates.
 */
export function weekTitle(weekId, now = new Date()) {
  const cur = mondayIST(now);
  if (!weekId || weekId === cur) return 'This week';
  if (weekId === addDays(cur, -7)) return 'Last week';
  if (weekId === addDays(cur, 7)) return 'Next week';
  return `Week of ${shortDay(weekId)} – ${shortDay(addDays(weekId, 6))}`;
}
/** The same, inside a sentence: "last week", "week of 5 Oct – 11 Oct" (month names keep their capital). */
export const weekName = (weekId, now = new Date()) => { const t = weekTitle(weekId, now); return t[0].toLowerCase() + t.slice(1); };
/*
 * The week's deadline is the master's `submit_closes` setting ("MON 21:00" by default), which meta.get carries
 * to every phone. It used to be arithmetic on 21:00 here, so after the head moved the window the coordinator's
 * "Last week" choice and the reopen default kept the old time while the server kept the new one. Anything
 * adjustable from Admin arrives as a value: the default argument is the setting this phone last saw, and the
 * shipped default stands in until meta has loaded (the server falls back to the same one).
 */
const DOW = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
const SPEC = /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2}):(\d{2})$/;
const pad2 = (n) => String(n).padStart(2, '0');
/** "MON 21:00" → { day: 0, hm: '21:00' } (day = days after the Monday); the shipped default for an unreadable spec. */
export function closesSpec(spec = cachedMeta().submitWindow?.closes) {
  const m = SPEC.exec(String(spec || '').trim().toUpperCase());
  return m && Number(m[2]) < 24 && Number(m[3]) < 60 ? { day: DOW[m[1]], hm: `${pad2(Number(m[2]))}:${m[3]}` } : { day: 0, hm: '21:00' };
}
/** When a week closes (the following week's `submit_closes` moment, Indian time). */
export const closesAt = (weekId, spec = cachedMeta().submitWindow?.closes) => { const c = closesSpec(spec); return new Date(`${addDays(weekId, 7 + c.day)}T${c.hm}:00+05:30`); };

/** Weeks an inactive / active change may start from: last week (only until its deadline), this week (default), next week. */
export function fromWeekChoices(now = new Date(), spec = cachedMeta().submitWindow?.closes) {
  const thisWeek = mondayIST(now), last = addDays(thisWeek, -7);
  const out = [{ weekId: thisWeek, label: 'This week' }, { weekId: addDays(thisWeek, 7), label: 'Next week' }];
  if (now < closesAt(last, spec)) out.push({ weekId: last, label: 'Last week' });
  return out;
}

/** Default "open until" for a reopened week: two days from today at the deadline's time of day, as a datetime-local value. */
export const defaultOpenUntil = (now = new Date(), spec = cachedMeta().submitWindow?.closes) => `${ymd(new Date(now.getTime() + 2 * DAY))}T${closesSpec(spec).hm}`;
/** A datetime-local value typed in Indian time -> ISO with +05:30 (what the server expects). */
export const istIso = (local) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local || '') ? `${local}:00+05:30` : '');

/** The last n week Mondays before this week (newest first): the weeks a master may override attendance for. */
export const pastWeeks = (now = new Date(), n = 8) => Array.from({ length: n }, (_, i) => addDays(mondayIST(now), -7 * (i + 1)));

/** A week with no regular class: everyone Present (everyonePresent) or Absent unless marked; null in a regular week. */
export const classDefault = (cw) => (!cw ? null : cw.everyonePresent ? 'P' : 'A');
/**
 * The mark that counts (decision 41): IYF head > coordinator > group leader > the week's no-class setting > the
 * devotee's own. `level` is the one being edited on this screen ('coordinator' on the board, 'leader' on My group):
 * its unsaved edit stands in for its saved mark.
 */
export function usedMark(att, cw = null, level = '', edit) {
  const v = (l) => (l === level && edit !== undefined ? edit : att?.[l]) || null;
  return v('master') || v('coordinator') || v('leader') || classDefault(cw) || att?.devotee || null;
}
/** The mark that counts on a screen with unsaved edits (edits: { login: 'P' | 'A' | null } at `level`). */
export function effectiveMark(row, edits = {}, cw = null, level = 'coordinator') {
  return usedMark(row.attendance, cw, level, row.login in edits ? edits[row.login] : undefined);
}
/** Who gave the mark that counts: 'master' | 'coordinator' | 'leader' | 'class' | 'devotee' | null. */
export function markBy(att, cw = null, level = '', edit) {
  const v = (l) => (l === level && edit !== undefined ? edit : att?.[l]) || null;
  return v('master') ? 'master' : v('coordinator') ? 'coordinator' : v('leader') ? 'leader' : classDefault(cw) ? 'class' : att?.devotee ? 'devotee' : null;
}
export const BY_LABEL = { master: 'IYF head', coordinator: 'Coordinator', leader: 'Group leader', class: 'No-class week', devotee: 'Own mark' };
/** The marks that changed at `level`, for one attendance.set (or group.mark) call. edits: { login: 'P' | 'A' | null }. */
export function attendanceDiff(rows, edits = {}, level = 'coordinator') {
  const out = [];
  for (const r of rows) {
    if (!(r.login in edits) || r.attendance?.locked) continue;
    const was = r.attendance?.[level] ?? null, now = edits[r.login] ?? null;
    if (was !== now) out.push({ login: r.login, mark: now });
  }
  return out;
}
/** The rows after a save (no refetch). */
export const applyMarks = (rows, marks, cw = null, level = 'coordinator') => rows.map((r) => {
  const m = marks.find((x) => x.login === r.login);
  if (!m) return r;
  const att = { ...r.attendance, [level]: m.mark };
  return { ...r, attendance: { ...att, used: usedMark(att, cw), by: markBy(att, cw) } };
});
/** The board rows after the week's class setting changed (each row's mark used follows it). */
export const applyClass = (rows, cw) => rows.map((r) => ({ ...r, attendance: { ...r.attendance, used: usedMark(r.attendance, cw), by: markBy(r.attendance, cw) } }));
export const CLASS_KINDS = [['HOLIDAY', 'Holiday'], ['FESTIVAL', 'Festival'], ['OTHER', 'Other']];

export const STATUS = {
  SUBMITTED: ['Submitted', 'ok'], DRAFT: ['Filling', 'warn'],   // "Filling" everywhere (8 Oct 2026), never "Draft"
  REOPENED: ['Reopened', 'info'], NOT_STARTED: ['Not started', ''], MISSED: ['Missed', 'bad'],
};
/**
 * Summary chip counts (a reopened week counts as a draft). Only devotees expected this week count: inactive or disabled
 * members are counted apart (INACTIVE), so every staff screen gives the same numbers (8 Oct 2026: the board counted them
 * as "Not started" and disagreed with the Filling chart). Rows without membership fields (group, students) all count.
 */
export function boardCounts(rows) {
  const c = { SUBMITTED: 0, DRAFT: 0, NOT_STARTED: 0, MISSED: 0, INACTIVE: 0 };
  for (const r of rows) {
    const k = !expected(r) ? 'INACTIVE' : r.status === 'REOPENED' ? 'DRAFT' : r.status;
    c[k] = (c[k] || 0) + 1;
  }
  return c;
}
const expected = (r) => (r.membership === undefined && r.accountStatus === undefined) || isActiveRow(r);
/** Board rows for a status chip and a name search. */
export function boardFilter(rows, status = '', q = '') {
  const t = q.trim().toLowerCase();
  return rows.filter((r) => (!status || r.status === status || (status === 'DRAFT' && r.status === 'REOPENED')) && (!t || r.name.toLowerCase().includes(t) || String(r.iyfId || '').toLowerCase().includes(t)));
}
/** The 7 day cells: a submitted week is all complete; a week with no draft is all empty. */
// a submitted part week sends its days too (complete / empty), else a submitted week is all complete
// weekId + today (YYYY-MM-DD): a past day nobody filled is 'missing' (amber), not 'empty' (8 Oct 2026)
export const dayCells = (r, weekId = '', today = '') => {
  const c = r.days?.length === 7 ? r.days : r.status === 'SUBMITTED' ? Array(7).fill('complete') : Array(7).fill('empty');
  return weekId && today && r.status !== 'SUBMITTED' ? c.map((s, i) => (s === 'empty' && addDays(weekId, i) < today ? 'missing' : s)) : c;
};


/** This row's week was reopened by the IYF head and its reopen deadline has not passed. */
export const reopenedNow = (r, now = Date.now()) => !!r.reopenUntil && now < Date.parse(r.reopenUntil);
/** A devotee who is expected this week (membership and account active): only they get attendance. */
export const isActiveRow = (r) => r.membership === 'ACTIVE' && r.accountStatus === 'ACTIVE';
/**
 * Can this row be marked now (coordinator on the board, group leader on My group)? Attendance is the week's class, on
 * Sunday for everyone (decision 41): from the board's attendanceOpensAt until the week's deadline (board.closesAt); active devotees only.
 */
export function markOpen(r, board, now = Date.now()) {
  if (!(r.active ?? isActiveRow(r)) || r.attendance?.locked || !board) return false;
  if (reopenedNow(r, now)) return true;            // a week the IYF head reopened follows the reopen's own deadline (8 Oct 2026)
  if (now >= Date.parse(board.closesAt)) return false;
  if (board.attendanceOpen) return true;
  const opens = Date.parse(board.attendanceOpensAt || '');
  return Number.isFinite(opens) && now >= opens;
}

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortDay = (iso) => `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1].slice(0, 3)}`;
/**
 * Weeks to choose from on the Status board and My group (the head, 3 Oct 2026: "a filter of month and week"): from
 * `back` weeks before `focus` to `ahead` after, grouped by the month their Monday falls in, newest month first.
 * @returns {{ key: string, label: string, weeks: { weekId: string, label: string }[] }[]}
 */
export function weekMonths(focus, back = 12, ahead = 1) {
  const out = [];
  for (let i = ahead; i >= -back; i--) {
    const w = addWeeks(focus, i), key = w.slice(0, 7);
    let m = out.find((x) => x.key === key);
    if (!m) out.push((m = { key, label: `${MON[+w.slice(5, 7) - 1].slice(0, 3)} ${w.slice(0, 4)}`, weeks: [] }));
    const sun = new Date(Date.parse(w + 'T00:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
    m.weeks.push({ weekId: w, label: `${shortDay(w)} – ${shortDay(sun)}` });
  }
  return out;
}

/* ---- Phase 5 (9 Oct 2026): one plain line per person on every staff list ---- */
const DAY3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The short names of the past days nobody filled (amber "missing"), e.g. ['Mon', 'Tue']. */
export const missingDays = (r, weekId, today) => dayCells(r, weekId, today).flatMap((c, i) => (c === 'missing' ? [DAY3[i]] : []));
/**
 * Why this person needs (or doesn't need) a call, in a few words: "Submitted · 82%", "Missed · 0", "Nothing filled since Mon",
 * "Nothing filled yet", "2 of 7 · Missing Mon, Tue", "3 of 7 filled".
 */
export function rowReason(r, weekId, today) {
  if (r.status === 'SUBMITTED') return r.overall !== null && r.overall !== undefined ? `Submitted · ${r.overall}%` : 'Submitted';
  if (r.status === 'MISSED') return `Missed · 0${r.daysFilled ? ` (${r.daysFilled} of 7 begun)` : ''}`;
  const miss = missingDays(r, weekId, today), n = r.daysFilled || 0;
  if (!n) return miss.length ? `Nothing filled since ${miss[0]}` : 'Nothing filled yet';
  return miss.length ? `${n} of 7 · Missing ${miss.join(', ')}` : `${n} of 7 filled`;
}
/** Who a staff member should reach first: not started or 2+ missing days, then the rest still filling, then submitted. */
export function needsYou(r, weekId, today) {
  if (r.status === 'SUBMITTED') return false;
  return r.status === 'NOT_STARTED' || r.status === 'MISSED' || missingDays(r, weekId, today).length >= 2;
}
/** A list in the order staff work through it: needs you, filling, missed last, submitted; A–Z inside each. */
const RANK = { NOT_STARTED: 0, DRAFT: 1, REOPENED: 1, MISSED: 2, SUBMITTED: 3 };
export const workOrder = (rows) => [...rows].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || a.name.localeCompare(b.name));
/** A score's band for its pill colour: hi ≥ 80, mid 50–79, lo < 50. */
export const band = (v) => (v === null || v === undefined ? '' : v >= 80 ? 'hi' : v >= 50 ? 'mid' : 'lo');
