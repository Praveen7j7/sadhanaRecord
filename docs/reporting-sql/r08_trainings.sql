-- R8 Trainings: enrolled by state, and training attendance by week
SELECT b.batch_id, b.name, b.started_on, b.ends_on, b.closed_at,
       (SELECT COUNT(*) FROM enrolments e WHERE e.batch_id = b.batch_id AND e.state = 'ACTIVE') AS enrolled_now,
       (SELECT COUNT(*) FROM enrolments e WHERE e.batch_id = b.batch_id AND e.state = 'ENDED')  AS ended,
       (SELECT SUM(mark = 'P') FROM training_attendance t WHERE t.batch_id = b.batch_id) AS present_marks,
       (SELECT SUM(mark <> '') FROM training_attendance t WHERE t.batch_id = b.batch_id) AS marks_given
  FROM batches b WHERE b.level = 'ETP' OR b.batch_id GLOB '[EMF]TP-*';
