-- R12 A devotee with their IYF ID, connected-since year and current name from the identity record
SELECT a.login, a.name AS app_name, a.status, m.batch_id,
       pi.fid AS iyf_id, p.connected_since, pn.name AS identity_name
  FROM accounts a
  LEFT JOIN memberships m ON m.login = a.login AND m.state = 'ACTIVE' AND m.to_week = ''
  LEFT JOIN person_links pl ON pl.service = 'sadhana' AND pl.account_ref = a.login
  LEFT JOIN persons p ON p.id = pl.person_id
  LEFT JOIN person_identifiers pi ON pi.person_id = p.id AND pi.state = 'current' AND pi.series = 'IYFD'
  LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_current = 1
 WHERE a.role = 'DEVOTEE'
 ORDER BY a.name LIMIT 50;
