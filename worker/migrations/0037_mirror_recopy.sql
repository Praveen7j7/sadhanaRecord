-- 10 Oct 2026: the Sheets copy of the changing tables stalled from 7 Oct (the nightly trim emptied mirror_log, SQLite
-- numbered new entries from 1 again, and the copy read only ids above its position 354; the next trim deleted them
-- unread). The code fix (worker/src/mirror.js) keeps the log from emptying and reads a log below its position from the
-- start. This recopies every keyed tab whole, once, so the changes of 7–10 Oct reach the Sheets. Data only; the
-- database is the source and lost nothing.
UPDATE mirror_state SET mode = 'build', last_id = 0, rows = 0
WHERE tbl IN ('accounts', 'batches', 'memberships', 'reset_requests', 'profiles', 'settings', 'attendance', 'reopens',
  'class_weeks', 'facilitators', 'announcements', 'duplicate_reviews', 'missed_weeks', 'reopen_requests', 'drafts',
  'leaders', 'post_comments', 'post_reports', 'post_mutes', 'app_ids', 'head_requests');
