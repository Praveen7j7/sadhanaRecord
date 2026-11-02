// Attendance rules shared by the weekly form, the group leaders and the coordinator tools (design decisions 30, 36, 41).
// One class a week, on Sunday, for everyone (the head, 3 Oct 2026). The mark used for a devotee's week is the highest
// one set: IYF head (master_mark) > coordinator (coordinator_mark) > group leader (leader_mark) > the week's no-class
// setting (class_weeks: Present for everyone, or Absent unless marked) > the devotee's own mark. Each level writes only
// its own column, so a lower level never overwrites a higher one.
import { one, all, batchesAll } from './db.js';
import { pct100 } from './scoring.js';
import { scoresAttendance } from './cards.js';

export const CLASS_KINDS = ['HOLIDAY', 'FESTIVAL', 'OTHER'];
export const classWeekOf = (db, batchId, weekId) => one(db, 'SELECT * FROM class_weeks WHERE batch_id = ? AND week_id = ?', String(batchId || ''), String(weekId));
/** { batchId: row } for one week. */
export async function classWeeksFor(db, batchIds, weekId) {
  if (!batchIds.length) return {};
  return Object.fromEntries((await all(db, `SELECT * FROM class_weeks WHERE week_id = ? AND batch_id IN (${batchIds.map(() => '?').join(',')})`, weekId, ...batchIds)).map(r => [r.batch_id, r]));
}
/** The mark a no-class week gives someone the coordinator has not marked ('' in a regular week). */
export const classDefault = cw => (!cw ? '' : cw.mode === 'ALL_PRESENT' ? 'P' : 'A');
export const classView = cw => (cw ? { kind: cw.kind, note: cw.note, everyonePresent: cw.mode === 'ALL_PRESENT', by: cw.by, at: cw.at } : null);
/*
 * Which day of the week a batch's class falls on, counted from the Monday a weekId names.
 *
 * Until 17 Oct 2026 attendance opened on day 6 (Sunday) for EVERY batch, Saturday ones included —
 * the batches that existed all met at the weekend, so one day served. The training batches do not:
 * a coordinator's class may sit on a weekday, and on the old rule their attendance would not open
 * until the Sunday after the class they are marking.
 *
 * So the day is a value now. A batch with none set still means Sunday, which is what every existing
 * batch gets and why nothing of theirs moves.
 */
const DAY_OFFSET = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
export const DAY_NAME = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };
/** The class day of a batch (its setting, or Sunday), as a key of DAY_NAME. */
export const classDayOf = (day) => (DAY_OFFSET[String(day || '').toUpperCase()] === undefined ? 'SUN' : String(day).toUpperCase());

/** When attendance for a week can first be marked: 00:00 IST on the batch's own class day. */
export const attendanceOpens = (weekId, classDay) =>
  new Date(new Date(`${weekId}T00:00:00+05:30`).getTime() + DAY_OFFSET[classDayOf(classDay)] * 86400000);
/**
 * A batch's class day and when its attendance opens, in one read.
 *
 * batchesAll() is memoised per request (db.js remember()), so this costs no extra query however many
 * times a handler asks — which is what lets every call site below be honest about the day instead of
 * assuming Sunday.
 */
export async function classOpensFor(db, batchId, weekId) {
  const list = await batchesAll(db);
  const b = list.find(x => x.batch_id === String(batchId || ''));
  const day = classDayOf(b?.class_day);
  return { day, name: DAY_NAME[day], opens: attendanceOpens(weekId, day) };
}

/** When Night Stay and the 4 regulative principles open: Saturday 18:00 IST of the week. */
export const weekEndOpens = (weekId) => new Date(new Date(`${weekId}T18:00:00+05:30`).getTime() + 5 * 86400000);

/** The mark used, from an attendance row (or null) and the week's class setting. */
export const markUsed = (row, cw) => row?.master_mark || row?.coordinator_mark || row?.leader_mark || classDefault(cw) || row?.devotee_mark || '';
/** Who gave the mark used: 'master' | 'coordinator' | 'leader' | 'class' | 'devotee' | ''. */
export const markLevel = (row, cw) => (row?.master_mark ? 'master' : row?.coordinator_mark ? 'coordinator' : row?.leader_mark ? 'leader' : classDefault(cw) ? 'class' : row?.devotee_mark ? 'devotee' : '');
export const LEVEL_COLS = { master: 'master_mark', coordinator: 'coordinator_mark', leader: 'leader_mark', devotee: 'devotee_mark' };
/**
 * SQL for mark_used after `level` writes `excluded.<its column>` in an upsert (the other levels keep their stored value).
 * One bound parameter: the week's no-class default ('' in a regular week).
 */
export function usedAfter(level) {
  const v = (l) => (l === level ? `NULLIF(excluded.${LEVEL_COLS[l]}, '')` : `NULLIF(${LEVEL_COLS[l]}, '')`);
  return `COALESCE(${v('master')}, ${v('coordinator')}, ${v('leader')}, NULLIF(?, ''), ${v('devotee')}, '')`;
}
/**
 * Statement: sets one level's mark (or clears it with '') for one devotee-week, keeping mark_used right. A higher level's
 * mark that differs from the devotee's own (and the mark used changes to it) sets notice_at, so the devotee is told
 * (a note in the app and one push) without an extra row. Only while the week is open, unless `force` (the IYF head).
 */
export function writeMark(db, { level, login, weekId, batchId, mark, by, at, reason = '', def = '', force = false }) {
  const col = LEVEL_COLS[level], used = usedAfter(level);
  const notice = level === 'devotee' ? "notice_at" : `CASE WHEN devotee_mark <> '' AND excluded.${col} <> '' AND excluded.${col} <> devotee_mark AND ${used} <> devotee_mark THEN excluded.changed_at ELSE notice_at END`;
  const sent = level === 'devotee' ? 'notice_sent' : `CASE WHEN devotee_mark <> '' AND excluded.${col} <> '' AND excluded.${col} <> devotee_mark AND ${used} <> devotee_mark THEN 0 ELSE notice_sent END`;
  const initialUsed = mark || def || '';
  return db.prepare(`INSERT INTO attendance (login, week_id, batch_id, ${col}, mark_used, changed_by, changed_at, reason${level === 'leader' ? ', leader_by' : ''})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?${level === 'leader' ? ', ?' : ''})
    ON CONFLICT(login, week_id) DO UPDATE SET ${col} = excluded.${col}, mark_used = ${used},
      notice_at = ${notice}, notice_sent = ${sent},
      changed_by = excluded.changed_by, changed_at = excluded.changed_at, reason = excluded.reason${level === 'leader' ? ', leader_by = excluded.leader_by' : ''}
    WHERE ${force ? '1 = 1' : 'locked = 0'}`)
    .bind(login, weekId, batchId, mark, initialUsed, by, at, reason, ...(level === 'leader' ? [by] : []), ...(level === 'devotee' ? [def] : [def, def, def]));
}

/**
 * A submitted week's scores with its final attendance mark. The submission row keeps the scores worked out at
 * submit and is never changed; a later mark by the coordinator or master (or a no-class week) changes the
 * Attendance and Overall the app, the view sheets and the bridge use.
 */
export function finalScores(s, mark) {
  const att = mark === 'P' ? 100 : mark === 'A' ? 0 : s.attendance;
  if (att === s.attendance) return s;
  // TRD (Phase 22, migration 0065): attendance is recorded and shown, not scored — the mark changes, Overall does not.
  // A row without score_card (before 0065, or a reader that did not select it) scores attendance, as before.
  if (!scoresAttendance(s.score_card)) return { ...s, attendance: att };
  return { ...s, attendance: att, overall: pct100((s.body + s.soul + att + s.seva) / 4) };
}
