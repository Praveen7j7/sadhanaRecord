-- A training batch's planned end date (Phase 22, J1; the head, 26 Oct 2026: "In ETP there is no way to mark the batch
-- ended, or to define a new batch's start and end date; its dates are custom"). The head sets it in Admin › Batch setup
-- (batches.create / batches.update, training batches only, after the start). It drives the trainee card's window
-- (phases.js windowFrom) and the status the coordinator and the head see: Running · Past its end date · Ended.
-- Nothing ends by itself: ending stays the coordinator's "Close batch" (closing.js), which sets closed_at as before.
-- Additive: '' = no end date set (ETP-21 on live, and every class batch).
ALTER TABLE batches ADD COLUMN ends_on TEXT NOT NULL DEFAULT '';
