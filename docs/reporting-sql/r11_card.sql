-- R11 Facilitator lead-measure card: targets against what was filled, per person and measure, in a phase
SELECT t.phase_id AS card, t.login, a.name, m.seq, m.label, m.frequency, m.kind, t.target,
       COUNT(fl.id) AS weeks_filled,
       SUM(CASE WHEN m.kind = 'YESNO' THEN fl.value = 'YES' ELSE 0 END) AS yes_weeks,
       SUM(CASE WHEN m.kind <> 'YESNO' THEN fl.value + 0 ELSE 0 END)     AS total_filled
  FROM targets t
  JOIN measures m ON m.measure_id = t.measure_id
  JOIN accounts a ON a.login = t.login
  LEFT JOIN fills fl ON fl.phase_id = t.phase_id AND fl.login = t.login AND fl.measure_id = t.measure_id
 WHERE t.phase_id IN ('kartik-2026', 'ETP-21')   -- a facilitator's card: the phase id; a trainee's: the training batch id
 GROUP BY t.login, t.measure_id ORDER BY a.name, m.seq;
