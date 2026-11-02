-- Enrolment in a training: a devotee joins ETP WITHOUT leaving their own batch (the head, 17 Oct 2026).
--
-- I built ETP as a batch somebody joins at sign-up. That was wrong, and the head had said so at the
-- start: "students get added who are already the member of the app" — an ETP coordinator enrols
-- existing devotees from a list.
--
-- It cannot be a membership. A membership IS the batch whose weekly form somebody fills, and
-- currentMembership() takes one row; a second open one would make the app guess which batch a
-- devotee belongs to. An ETP student keeps filling their SPS (or DPS) week exactly as before — the
-- training adds a target card, not a different week.
--
-- So enrolment is its own thing, the way being a group leader or a facilitator is: an identity that
-- stacks on the one they already have, rather than replacing it.
CREATE TABLE enrolments (
  id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL,              -- the training batch, e.g. ETP-51
  login TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ACTIVE',-- ACTIVE | ENDED
  from_week TEXT NOT NULL,
  to_week TEXT NOT NULL DEFAULT '',
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL,
  ended_by TEXT NOT NULL DEFAULT '',
  ended_at TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX enrolments_by_batch ON enrolments (batch_id, state);
CREATE INDEX enrolments_by_login ON enrolments (login, state);

-- A training batch is not offered when an account is created: nobody signs up INTO a training, they
-- are enrolled into one. `offered_at_signup` defaults to 1, so every batch that exists keeps
-- appearing exactly as it does now.
ALTER TABLE batches ADD COLUMN offered_at_signup INTEGER NOT NULL DEFAULT 1;
UPDATE batches SET offered_at_signup = 0 WHERE batch_id LIKE 'ETP-%';
