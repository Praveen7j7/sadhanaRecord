-- Phase 6 (3 Oct 2026): the batch status board, the batch view sheets and the Monday lock look attendance up by week
-- and batch. Without this index each of them read every attendance row ever kept (about 130,000 at 5,000 devotees after
-- six months, per batch-status opening). Costs one extra row written per new attendance row (one per devotee a week).
CREATE INDEX IF NOT EXISTS attendance_by_week ON attendance (week_id, batch_id);
