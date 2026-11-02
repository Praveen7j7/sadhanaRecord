-- R13 Data health: active devotees with no facilitator, no batch, or an unfinished profile
SELECT a.login, a.name,
       COALESCE(m.batch_id, '') AS batch_id,
       m.fac_id IS NULL AS no_facilitator,
       m.login IS NULL AS no_batch,
       (p.login IS NULL OR p.dob = '' OR p.addr_city = '') AS profile_incomplete
  FROM accounts a
  LEFT JOIN memberships m ON m.login = a.login AND m.state = 'ACTIVE' AND m.to_week = ''
  LEFT JOIN profiles p ON p.login = a.login
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   AND (m.login IS NULL OR m.fac_id IS NULL OR p.login IS NULL OR p.dob = '' OR p.addr_city = '');
