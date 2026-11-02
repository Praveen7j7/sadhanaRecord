-- ETP class attendance, marked by the training's coordinator (the head, 18 Oct 2026).
--
-- "the etp coordinator they see whether the etp person filled there that week template card or not
--  and they can mark them present or absent for that weeks etp class"
--
-- WHY A SEPARATE TABLE, and not the `attendance` one every batch already uses:
-- `attendance` is keyed (login, week_id). An ETP student is still a devotee of their OWN batch and
-- is marked there every week for their own class. Writing their ETP mark into the same table would
-- collide on that key — one of the two marks would silently overwrite the other, and the devotee
-- would appear absent from a class they attended. They are two different classes in the same week,
-- so they are two rows in two tables.
--
-- The ETP student's card also carries a self-reported "ETP attendance" measure. That stays: what a
-- trainee reports about themselves and what their coordinator observed are different evidence, and
-- the board shows them side by side rather than letting one quietly stand in for the other.
CREATE TABLE training_attendance (
  login TEXT NOT NULL,
  batch_id TEXT NOT NULL,                 -- the TRAINING batch (ETP-21), never the devotee's own
  week_id TEXT NOT NULL,
  mark TEXT NOT NULL DEFAULT '',          -- 'P' | 'A' | '' (not marked)
  marked_by TEXT NOT NULL DEFAULT '',
  marked_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (login, batch_id, week_id)
);
-- the board reads one training's week: lead with the batch and the week, so it is a SEARCH
CREATE INDEX training_attendance_week ON training_attendance (batch_id, week_id);
