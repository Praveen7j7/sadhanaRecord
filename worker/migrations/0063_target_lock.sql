-- Targets are set at the start of a phase, not afterwards (phase 21, 23 Oct 2026; the head: "defining the targets
-- happens in the phase beginning only not afterwards"). See ADR 0018.
--
-- targets_until: the last day a target already set may still be changed. '' = the end of the person's first week on
-- the card (a facilitator's card starts with the phase, a trainee's with their training). The head can set a date.
-- After it, a target that was never set may still be set (somebody who starts mid-phase, or a measure the screen could
-- not take before), but a set one is fixed — unless the head opens that person's targets for a while, with a reason.
ALTER TABLE phases ADD COLUMN targets_until TEXT NOT NULL DEFAULT '';

CREATE TABLE target_unlocks (
  id INTEGER PRIMARY KEY,
  phase_id TEXT NOT NULL,
  login TEXT NOT NULL,
  reason TEXT NOT NULL,
  allowed_by TEXT NOT NULL,
  allowed_at TEXT NOT NULL,
  until TEXT NOT NULL,
  UNIQUE (phase_id, login)
);
