-- R9 Coordinators' work in a period, from the audit log
SELECT who, action, COUNT(*) AS n, MIN(at) AS first, MAX(at) AS last
  FROM audit_log
 WHERE at >= '2026-10-01' AND at < '2026-11-01'
   AND action IN ('requests.approve','requests.reject','resets.approve','resets.reject','weeks.reopen','reopen.reject',
                  'attendance.set','attendance.override','week.submit.onBehalf','group.mark','enrol.add','enrol.remove',
                  'training.attendance','devotees.promote','batches.close','leaders.assign')
 GROUP BY who, action ORDER BY who, n DESC;
