-- A trainee's card is the TRAINING's, not a phase's (Phase 22, J1; the head, 26 Oct 2026: "the ETP way and the FTP way
-- are 2 different routes: one is the full-time official facilitators' route, which works on phases, and ETP is on custom
-- dates as defined when starting a batch and ending a batch").
--
-- The card tables are keyed by `phase_id` (migrations 0052, 0055, 0063). From now on that key holds, for a trainee, their
-- TRAINING BATCH id (e.g. 'ETP-21'): one continuous card over the training's own dates, never clipped or split by a
-- phase. A facilitator's rows keep the phase id, unchanged. No new column: the key is a card's key, and nothing joins it
-- to phases (no foreign key), so the least invasive correct change is to give the trainee rows their training's key.
--
-- Whose card is a training's: the same rule as phases.js TRAINING_CARD_SQL — enrolled now, or in a training that was
-- ended, unless they are a facilitator in their own right (facilitation = 'lasting'); the newest enrolment first.
-- Live on 26 Oct 2026: two trainees of ETP-21 (test data), 11 fills, 10 targets, 10 stage targets under 'kartik-2026'
-- (backed up in impl/baseline/trainee-cards-before-0068.json). Rollback: set those rows' phase_id back to 'kartik-2026'.
UPDATE fills SET phase_id = (
    SELECT e.batch_id FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
     WHERE e.login = fills.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting'))
     ORDER BY (e.state = 'ACTIVE') DESC, e.id DESC LIMIT 1)
 WHERE phase_id IN (SELECT phase_id FROM phases)
   AND EXISTS (SELECT 1 FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
                WHERE e.login = fills.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting')));
UPDATE targets SET phase_id = (
    SELECT e.batch_id FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
     WHERE e.login = targets.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting'))
     ORDER BY (e.state = 'ACTIVE') DESC, e.id DESC LIMIT 1)
 WHERE phase_id IN (SELECT phase_id FROM phases)
   AND EXISTS (SELECT 1 FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
                WHERE e.login = targets.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting')));
UPDATE stage_targets SET phase_id = (
    SELECT e.batch_id FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
     WHERE e.login = stage_targets.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting'))
     ORDER BY (e.state = 'ACTIVE') DESC, e.id DESC LIMIT 1)
 WHERE phase_id IN (SELECT phase_id FROM phases)
   AND EXISTS (SELECT 1 FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
                WHERE e.login = stage_targets.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting')));
UPDATE target_unlocks SET phase_id = (
    SELECT e.batch_id FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
     WHERE e.login = target_unlocks.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting'))
     ORDER BY (e.state = 'ACTIVE') DESC, e.id DESC LIMIT 1)
 WHERE phase_id IN (SELECT phase_id FROM phases)
   AND EXISTS (SELECT 1 FROM enrolments e JOIN batches b ON b.batch_id = e.batch_id JOIN accounts a ON a.login = e.login
                WHERE e.login = target_unlocks.login AND b.started_on <> '' AND (e.state = 'ACTIVE' OR (b.closed_at <> '' AND a.facilitation <> 'lasting')));
