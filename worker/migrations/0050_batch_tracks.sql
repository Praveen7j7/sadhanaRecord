-- Vedic levels: what a batch COLLECTS, and when an intake ran (ADR 0009, the head, 16 Oct 2026).
--
-- VL-2 takes attendance and nothing else; VL-3 takes attendance and chanting rounds; everything from
-- SPS onwards takes the full week. Until now the weekly form asked the same nine questions of
-- everybody, because REQUIRED in weeks.js is a fixed list — a VL-2 devotee would have been asked for
-- hearing minutes and a reading topic they do not keep.
--
-- `tracks` says what to ask for. It is additive and defaults to 'full', so every batch that exists
-- today keeps behaving exactly as it does (ADR 0003: additive migrations, no foreign keys).
ALTER TABLE batches ADD COLUMN tracks TEXT NOT NULL DEFAULT 'full';

-- An intake is its own batch row (VL2-2026-01, then VL2-2026-02), so a closed run stays readable and
-- "which intake was he in?" has an answer. These three columns carry the run.
--
-- `closed_at` is set BY A COORDINATOR, never by a timer: three months is the shape of an intake, not
-- a rule the app enforces. An empty string means still running — the same 'empty is unset' convention
-- the rest of the schema uses, so nothing has to handle NULL.
ALTER TABLE batches ADD COLUMN started_on TEXT NOT NULL DEFAULT '';
ALTER TABLE batches ADD COLUMN closed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE batches ADD COLUMN closed_by TEXT NOT NULL DEFAULT '';

-- What the coordinator decided for each devotee when the intake closed (ADR 0009): promoted to the
-- next level, repeating in the next intake, or left. Nobody is moved automatically, so every row here
-- is a decision somebody took, with their name on it.
--
-- One row per devotee per closing. `to_batch` is empty for 'repeat' and 'left' — only a promotion
-- names where they went.
CREATE TABLE batch_closings (
  id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL,
  login TEXT NOT NULL,
  decision TEXT NOT NULL,              -- 'promoted' | 'repeat' | 'left'
  to_batch TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL
);
CREATE INDEX batch_closings_batch ON batch_closings (batch_id);
CREATE INDEX batch_closings_login ON batch_closings (login);
