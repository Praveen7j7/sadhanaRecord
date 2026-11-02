-- Temple activities (phase 21, 23 Oct 2026; the head): a batch whose devotees live in the temple also answers, each
-- day, Mangal Aarti / Darshan Aarti / Morning Class / Prasadam as On Time, Late or Absent (shared/temple.js).
-- Recorded, not scored. A flag on the batch, so it is a property of the batch and not of a level name in code.
-- Additive: one column, default off; only the Temple Residents batch turns it on.
ALTER TABLE batches ADD COLUMN temple_activities INTEGER NOT NULL DEFAULT 0;
UPDATE batches SET temple_activities = 1 WHERE level = 'TRD';
-- the rules a phone keeps (rules.get) now say whether to ask: raise the version so every phone fetches them once
UPDATE settings SET value = 'r3', changed_by = 'phase 21' WHERE key = 'rules_version';
