-- R4 Each devotee over a period: weeks filled, final Overall (as the app shows it), rounds, night stay, principles
SELECT s.login, a.name, s.batch_id,
       COUNT(*) AS weeks_submitted,
       ROUND(AVG(CASE WHEN s.score_card IN ('TRD') THEN s.overall ELSE
         CASE COALESCE(NULLIF(at.master_mark,''), NULLIF(at.coordinator_mark,''), NULLIF(at.leader_mark,''),
                       CASE WHEN cw.batch_id IS NULL THEN NULL WHEN cw.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END,
                       NULLIF(at.devotee_mark,''), '')
           WHEN 'P' THEN CASE WHEN s.attendance = 100 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + 100 + s.seva) / 4.0))) END
           WHEN 'A' THEN CASE WHEN s.attendance = 0   THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + s.seva) / 4.0))) END
           ELSE s.overall END END), 1) AS avg_overall,
       ROUND(AVG(s.body), 1) AS avg_body, ROUND(AVG(s.soul), 1) AS avg_soul,
       ROUND(AVG(NULLIF(s.avg_rounds, '') + 0), 1) AS avg_rounds_a_day,
       SUM(s.night_stay = 'YES') AS nights_yes, SUM(s.principles = 'YES') AS principles_yes,
       ROUND(AVG(s.days_filled), 1) AS avg_days_filled
  FROM submissions s
  JOIN accounts a ON a.login = s.login
  LEFT JOIN attendance  at ON at.login = s.login AND at.week_id = s.week_id
  LEFT JOIN class_weeks cw ON cw.batch_id = s.batch_id AND cw.week_id = s.week_id
 WHERE s.week_id BETWEEN '2026-09-01' AND '2026-12-31' AND s.login NOT LIKE 'deleted-%'
 GROUP BY s.login ORDER BY avg_overall DESC;
