-- Group leaders, attendance by level, address (the head, 3 Oct 2026; design decision 41).
-- Group leaders: student devotees the batch coordinator appoints; each leads one group of devotees of the same batch
-- (a devotee is in at most one group: memberships.leader_login). The leader marks the Sunday class attendance of the
-- group and follows its sadhana. The old group_leaders name list (before decision 37) is kept only as history.
CREATE TABLE leaders (login TEXT PRIMARY KEY, batch_id TEXT NOT NULL, appointed_by TEXT NOT NULL, appointed_at TEXT NOT NULL);
CREATE INDEX leaders_by_batch ON leaders (batch_id);
ALTER TABLE memberships ADD COLUMN leader_login TEXT NOT NULL DEFAULT '';
CREATE INDEX memberships_by_leader ON memberships (leader_login, to_week);

-- Attendance by level: IYF head > coordinator > group leader > devotee. The highest mark set is the one used (with a
-- no-class week's setting between the group leader and the devotee). Each level writes only its own column, so a lower
-- level can never overwrite a higher one; master_mark is the head's correction (any time, with a reason).
ALTER TABLE attendance ADD COLUMN leader_mark TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance ADD COLUMN leader_by TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance ADD COLUMN master_mark TEXT NOT NULL DEFAULT '';

-- A higher mark that differs from the devotee's own: the devotee sees a note in the app and gets one push. Set in the
-- same write as the higher mark (no extra row); the evening schedule pushes those not sent yet (notice_sent = 1).
ALTER TABLE attendance ADD COLUMN notice_at TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance ADD COLUMN notice_sent INTEGER NOT NULL DEFAULT 0;
CREATE INDEX attendance_notices ON attendance (notice_at) WHERE notice_at <> '' AND notice_sent = 0;

-- Address (required at sign-up from 3 Oct 2026; existing devotees add it from Account). Seen by the batch coordinator and
-- the IYF head; changed only by the devotee.
ALTER TABLE profiles ADD COLUMN addr_line TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN addr_area TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN addr_city TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN addr_pin TEXT NOT NULL DEFAULT '';

-- The whole submitted week as ONE compact JSON (the head, 3 Oct 2026): every day's answers with that day's card marks,
-- the week-end answers, the attendance used at submit and the scores. The daily report reads it, and so will the
-- facilitator dashboard (phase 5 bridge). Older rows keep days_json / marks_json (read by worker/src/weekjson.js).
ALTER TABLE submissions ADD COLUMN week_json TEXT NOT NULL DEFAULT '';
