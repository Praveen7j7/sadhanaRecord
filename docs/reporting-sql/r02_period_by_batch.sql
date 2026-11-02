-- R2 One line per batch for a whole period (weighted by weeks submitted, not an average of averages)
SELECT bw.batch_id, b.name AS batch, COUNT(*) AS weeks_closed,
       SUM(bw.submitted) AS weeks_submitted, SUM(bw.missed) AS weeks_missed,
       ROUND(SUM(bw.sum_overall) * 1.0 / NULLIF(SUM(bw.submitted), 0), 1) AS avg_overall,
       ROUND(SUM(bw.sum_rounds)  * 1.0 / NULLIF(SUM(bw.n_rounds), 0), 1)  AS avg_rounds_a_day,
       ROUND(100.0 * SUM(bw.night_yes) / NULLIF(SUM(bw.submitted), 0))   AS night_stay_pct,
       ROUND(100.0 * SUM(bw.present)   / NULLIF(SUM(bw.held), 0))        AS attendance_pct
  FROM batch_weeks bw JOIN batches b ON b.batch_id = bw.batch_id
 WHERE bw.week_id BETWEEN '2026-09-01' AND '2026-12-31'
 GROUP BY bw.batch_id ORDER BY avg_overall DESC;
