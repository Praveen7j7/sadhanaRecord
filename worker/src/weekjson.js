// The submitted week as one compact JSON (design decision 42, the head 3 Oct 2026): what the daily report shows and
// what the facilitator dashboard will read. Compact = no whitespace, no empty or null fields; a day's card marks sit
// on the day as m: { category: [range label, marks] }. Version v lets the shape grow without breaking readers.
//
// { "v": 1, "week": "2026-09-28", "login": "98…", "iyfId": "KT26-0042", "name": "…", "batch": "SPS", "daysFilled": 7,
//   (daysFilled: the complete days counted, 1–7; a day not filled is {} with no marks, 4 Oct 2026)
//   "days": [ { "date": "2026-09-28", "sleptAt": "22:15", "wokeAt": "04:30", "dayRestMin": 30, "rounds": 16,
//               "chantingSameDay": true, "chantingDoneAt": "07:10", "hearingMin": 30, "hearing": [ { "lectureId": "L4-012" } ],
//               "readingMin": 30, "reading": { "bookId": "B12" }, "serviceMin": 45, …,
//               "m": { "to_bed": ["10:00 - 10:15 PM", 25], "wake_up": […], "day_sleep": […], "japa": […], "pathan": […], "sravan": […] } }, … 7 ],
//   "weekEnd": { "nightStay": "YES", "principles": "YES", "avgRounds": 16 },
//   "attendance": "P", "sevaMinutes": 315,
//   "scores": { "bed": 90, "wake_up": 80, "day_sleep": 100, "japa": 70, "pathan": 85, "sravan": 90, "seva": 100, "attendance": 100,
//               "body": 90, "soul": 82, "overall": 93 } }
const drop = (k, v) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? undefined : v);
const plusDays = (week, i) => new Date(Date.parse(week + 'T00:00:00Z') + i * 864e5).toISOString().slice(0, 10);

/** The compact JSON text for a submitted week. */
export function weekJson({ week, login, iyfId, name, batch, days, marks, daysFilled, weekEnd, attendance, sevaMinutes, scores }) {
  return JSON.stringify({
    v: 1, week, login, iyfId, name, batch, daysFilled,
    days: days.map((d, i) => ({ date: plusDays(week, i), ...d,
      // a linear card's marks (TRD) keep each item's maximum as a third element: [label, marks, of]
      m: Object.fromEntries(Object.entries(marks[i] || {}).map(([k, o]) => [k, o.of === undefined ? [o.label, o.marks] : [o.label, o.marks, o.of]])) })),
    weekEnd, attendance, sevaMinutes, scores
  }, drop);
}

/** { days, marks } of a submission row, from week_json (or, for rows from before it, days_json / marks_json). */
export function weekOf(s) {
  if (s.week_json) {
    const w = JSON.parse(s.week_json);
    return {
      days: w.days.map(({ date, m, ...day }) => day),
      marks: w.days.map(d => Object.fromEntries(Object.entries(d.m || {}).map(([k, [label, marks, of]]) => [k, of === undefined ? { label, marks } : { label, marks, of }])))
    };
  }
  return { days: JSON.parse(s.days_json || '[]'), marks: JSON.parse(s.marks_json || '[]') };
}

/** SQL for a submission's days array, for json_each (new rows: week_json › days; older rows: days_json). */
export const DAYS_SQL = (alias) => `(CASE WHEN ${alias}.week_json <> '' THEN json_extract(${alias}.week_json, '$.days') ELSE ${alias}.days_json END)`;
