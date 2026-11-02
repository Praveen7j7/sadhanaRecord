-- R5 Facilitator view: each facilitator's current students, and how their weeks went in the period
SELECT COALESCE(f.name, '(no facilitator)') AS facilitator, f.id AS fac_id,
       COUNT(DISTINCT m.login) AS students,
       COUNT(s.login) AS weeks_submitted,
       ROUND(AVG(s.overall), 1) AS avg_overall_stored,
       ROUND(AVG(NULLIF(s.avg_rounds, '') + 0), 1) AS avg_rounds_a_day
  FROM memberships m
  JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
  LEFT JOIN facilitators f ON f.id = m.fac_id
  LEFT JOIN submissions s ON s.login = m.login AND s.week_id BETWEEN '2026-09-01' AND '2026-12-31'
 WHERE m.state = 'ACTIVE' AND m.to_week = ''
 GROUP BY f.id ORDER BY students DESC;
