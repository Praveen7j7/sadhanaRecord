-- Asking to start a batch (Phase 23; the head, 27 Oct 2026: "A new VL-2, VL-3 or any training batch, say ETP, can be
-- started by the admin, and the coordinators can even initiate a request, and the approval for the batch beginning the
-- admin gives").
--
-- A coordinator asks for a numbered intake — VL-2, VL-3 or a training (ETP) — with a proposed start (today or later), an
-- end date for a training, and a note. The head approves it by creating the batch in Admin › Batch setup's own form
-- (batches.create with fromRequest: the same rules, nothing duplicated), or declines it with a note. The requester may
-- withdraw it while it waits.
--   state       WAITING · STARTED (batch_id = the batch it became) · DECLINED · WITHDRAWN
--   starts_on   the proposed start; the batch's own start is set when it is created (never in the future)
--   ends_on     a training's proposed end ('' for VL-2 / VL-3)
-- Additive: a new table. Writes: one keyed row per ask / decision.
CREATE TABLE batch_requests (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'WAITING',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT '',
  batch_id TEXT NOT NULL DEFAULT ''
);
-- the head's open list (state, oldest first) and each coordinator's own (newest first)
CREATE INDEX batch_requests_state ON batch_requests (state, requested_at);
CREATE INDEX batch_requests_by ON batch_requests (requested_by, requested_at);
