-- R1 Batch trend per week, from the weekly sums (cheap: one row per batch per closed week)
SELECT bw.week_id, bw.batch_id, b.name AS batch,
       bw.submitted, bw.missed,
       ROUND(bw.sum_overall * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_overall,
       ROUND(bw.sum_body    * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_body,
       ROUND(bw.sum_soul    * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_soul,
       ROUND(bw.sum_wake    * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_wake_score,
       ROUND(bw.sum_bed     * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_bed_score,
       ROUND(bw.sum_rounds  * 1.0 / NULLIF(bw.n_rounds, 0), 1)  AS avg_rounds_a_day,
       ROUND(bw.sum_reading * 1.0 / NULLIF(bw.submitted, 0))    AS reading_min_a_week,
       ROUND(bw.sum_hearing * 1.0 / NULLIF(bw.submitted, 0))    AS hearing_min_a_week,
       ROUND(bw.sum_seva    * 1.0 / NULLIF(bw.submitted, 0))    AS seva_min_a_week,
       ROUND(100.0 * bw.night_yes      / NULLIF(bw.submitted, 0)) AS night_stay_pct,
       ROUND(100.0 * bw.principles_yes / NULLIF(bw.submitted, 0)) AS principles_pct,
       bw.present, bw.held,
       ROUND(100.0 * bw.present / NULLIF(bw.held, 0))           AS attendance_pct
  FROM batch_weeks bw JOIN batches b ON b.batch_id = bw.batch_id
 WHERE bw.week_id BETWEEN '2026-09-01' AND '2026-12-31'
 ORDER BY bw.week_id, bw.batch_id;
