-- R7 Leaderboard over a period, as the app ranks it: final Overall, a missed week counts 0, average of the weeks
WITH w AS (
  SELECT s.login, s.batch_id,
         CASE WHEN s.score_card IN ('TRD') THEN s.overall ELSE
           CASE COALESCE(NULLIF(at.master_mark,''), NULLIF(at.coordinator_mark,''), NULLIF(at.leader_mark,''),
                         CASE WHEN cw.batch_id IS NULL THEN NULL WHEN cw.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END,
                         NULLIF(at.devotee_mark,''), '')
             WHEN 'P' THEN CASE WHEN s.attendance = 100 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + 100 + s.seva) / 4.0))) END
             WHEN 'A' THEN CASE WHEN s.attendance = 0   THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + s.seva) / 4.0))) END
             ELSE s.overall END END AS score, 0 AS missed
    FROM submissions s
    LEFT JOIN attendance  at ON at.login = s.login AND at.week_id = s.week_id
    LEFT JOIN class_weeks cw ON cw.batch_id = s.batch_id AND cw.week_id = s.week_id
   WHERE s.week_id BETWEEN '2026-09-01' AND '2026-12-31'
  UNION ALL
  SELECT x.login, x.batch_id, 0, 1 FROM missed_weeks x
   WHERE x.week_id BETWEEN '2026-09-01' AND '2026-12-31'
     AND NOT EXISTS (SELECT 1 FROM submissions s2 WHERE s2.login = x.login AND s2.week_id = x.week_id)
     AND NOT EXISTS (SELECT 1 FROM reopens r WHERE r.login = x.login AND r.week_id = x.week_id AND r.state = 'OPEN'))
SELECT w.login, a.name, MAX(w.batch_id) AS batch_id, COUNT(*) AS weeks, SUM(w.missed) AS missed,
       ROUND(SUM(w.score) * 1.0 / COUNT(*)) AS score
  FROM w JOIN accounts a ON a.login = w.login
 WHERE w.login NOT LIKE 'deleted-%'
 GROUP BY w.login ORDER BY score DESC, a.name;
