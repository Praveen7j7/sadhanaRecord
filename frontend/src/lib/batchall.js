// "All batches" on Batch status and the Filling chart (Phase 22 F1, 26 Oct 2026). The screens ask each batch's own
// action (devotees.list, stats.batch) once per batch and add the answers up here. The server keeps one batch per
// call on purpose: a board's CPU grows with its rows (devotees.list 13–27 ms at 2,000 devotees for ONE batch), so a
// single all-batch call would cross the free plan's 10 ms long before a per-batch one does; each batch's answer is
// also filed under the same cache name its own view uses, so switching to one batch afterwards costs nothing.

/** Training batches (ETP and, later, MTP/FTP) are not class batches: their people are counted in their own batch. */
export const isTrainingId = (id) => /^(ETP|MTP|FTP)-\d+$/.test(String(id || ''));

/**
 * One board out of each batch's devotees.list answer for the same week. `list` is [[batchId, answer], ...].
 * Rows are by name; a person in two of the batches that week (moved mid-week) is listed once, under the first.
 * `boards` keeps each batch's own answer: its class day, class week and attendance window still apply to its rows.
 */
export function mergeBoards(list) {
  const ok = list.filter(([, b]) => b);
  if (!ok.length) return null;
  const seen = new Set(), rows = [];
  for (const [, b] of ok) for (const r of b.rows || []) if (!seen.has(r.login)) { seen.add(r.login); rows.push(r); }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const opens = ok.map(([, b]) => b.attendanceOpensAt).filter(Boolean).sort();
  return {
    weekId: ok[0][1].weekId, closesAt: ok[0][1].closesAt, attendanceOpensAt: opens[0] || null,
    attendanceOpen: ok.some(([, b]) => b.attendanceOpen), classWeek: null, rows,
    boards: Object.fromEntries(ok)
  };
}

/**
 * One filling chart out of each batch's stats.batch answer (same focus week, same number of weeks). Counts add up;
 * a week's share is worked out again from the summed expected and submitted, never averaged across batches.
 * Missed weeks keep their batch, newest week first, then by name.
 */
export function mergeStats(list) {
  const ok = list.filter(([, s]) => s);
  if (!ok.length) return null;
  const sum = (f) => ok.reduce((a, [, s]) => a + (Number(f(s)) || 0), 0);
  const t = (k) => sum((s) => s.thisWeek?.[k]);
  const weekIds = [...new Set(ok.flatMap(([, s]) => (s.trend || []).map((w) => w.weekId)))].sort();
  const trend = weekIds.map((w) => {
    const at = (s) => (s.trend || []).find((x) => x.weekId === w) || {};
    const expected = sum((s) => at(s).expected), submitted = sum((s) => at(s).submitted);
    return { weekId: w, expected, submitted, missed: sum((s) => at(s).missed), filledPct: expected ? Math.min(100, Math.round((submitted / expected) * 100)) : 0 };
  });
  const missedLog = ok.flatMap(([id, s]) => (s.missedLog || []).map((m) => ({ ...m, batchId: id })))
    .sort((a, b) => (a.weekId < b.weekId ? 1 : a.weekId > b.weekId ? -1 : String(a.name).localeCompare(String(b.name))));
  return {
    weekId: ok[0][1].weekId,
    thisWeek: { expected: t('expected'), submitted: t('submitted'), draft: t('draft'), notStarted: t('notStarted'), missed: t('missed'),
                byDay: Array.from({ length: 7 }, (_, i) => sum((s) => s.thisWeek?.byDay?.[i])) },
    trend,
    people: { active: sum((s) => s.people?.active), inactive: sum((s) => s.people?.inactive), disabled: sum((s) => s.people?.disabled), pending: sum((s) => s.people?.pending) },
    missedLog
  };
}
