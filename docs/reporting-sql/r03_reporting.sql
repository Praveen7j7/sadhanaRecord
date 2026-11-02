-- R3 Reporting: who was due a week, who submitted, who missed, who has no record (per batch, per closed week)
WITH weeks AS (SELECT DISTINCT week_id FROM batch_weeks WHERE week_id BETWEEN '2026-09-01' AND '2026-12-31'),
due AS (
  SELECT w.week_id, m.login, MIN(m.batch_id) AS batch_id
    FROM weeks w
    JOIN memberships m ON m.state = 'ACTIVE' AND m.from_week <= w.week_id AND (m.to_week = '' OR m.to_week >= w.week_id)
    JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   GROUP BY w.week_id, m.login)
SELECT d.week_id, d.batch_id, COUNT(*) AS due,
       SUM(s.login IS NOT NULL) AS submitted,
       SUM(x.login IS NOT NULL) AS missed,
       SUM(s.login IS NULL AND x.login IS NULL) AS no_record,
       ROUND(100.0 * SUM(s.login IS NOT NULL) / COUNT(*)) AS reporting_pct
  FROM due d
  LEFT JOIN submissions  s ON s.login = d.login AND s.week_id = d.week_id
  LEFT JOIN missed_weeks x ON x.login = d.login AND x.week_id = d.week_id
 GROUP BY d.week_id, d.batch_id ORDER BY d.week_id, d.batch_id;
