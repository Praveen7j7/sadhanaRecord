-- R6 Day level: every filled day of a week (wake-up, bed, rounds, reading, hearing) from week_json
SELECT s.login, s.batch_id, s.week_id,
       json_extract(d.value, '$.date')       AS day,
       json_extract(d.value, '$.wokeAt')     AS woke_at,
       json_extract(d.value, '$.sleptAt')    AS slept_at,
       json_extract(d.value, '$.rounds')     AS rounds,
       json_extract(d.value, '$.readingMin') AS reading_min,
       json_extract(d.value, '$.hearingMin') AS hearing_min,
       json_extract(d.value, '$.serviceMin') AS seva_min,
       json_extract(d.value, '$.m.wake_up[1]') AS wake_marks
  FROM submissions s, json_each(CASE WHEN s.week_json <> '' THEN json_extract(s.week_json, '$.days') ELSE s.days_json END) d
 WHERE s.week_id = '2026-10-05' AND s.batch_id = 'SPS2'
   AND json_extract(d.value, '$.wokeAt') IS NOT NULL
 ORDER BY s.login, day;
