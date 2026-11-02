-- R10 Growth: sign-ups and approvals per month, promotions and closings
SELECT substr(signed_up_at, 1, 7) AS month, COUNT(*) AS signed_up,
       SUM(status = 'ACTIVE') AS active_now, SUM(status = 'PENDING') AS still_pending, SUM(status = 'REJECTED') AS rejected
  FROM accounts WHERE role = 'DEVOTEE' AND signed_up_at <> ''
 GROUP BY month ORDER BY month;
