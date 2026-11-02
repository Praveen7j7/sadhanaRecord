-- TRD scored the COSATOK way (Phase 22, K2; the head, 23 Oct 2026). The temple residents leave the SPS card for their
-- own: COSATOK's "Marking Scheme · Level: TRD" (worker/src/cards.js CARD_TRD, shared/scoring.js). Every item slides in a
-- straight line between two points; the Morning program (the four temple activities of migration 0062, already asked
-- on the TRD day form) scores on time 5 · late 3 · absent 0 each. Overall = the week's day marks ÷ (7 × the day's
-- maximum) × 100; class attendance is recorded and shown but not scored. Additive only.
--
-- Rollback: UPDATE batches SET score_card = 'SPS' WHERE batch_id = 'TRD'; UPDATE settings SET value = 'r3' WHERE key = 'rules_version';
-- (the new columns can stay: every reader treats '' / NULL as "scored as before").

-- the card a week was scored with ('' = a week from before this column: SPS or BVS/DPS/BSS, attendance scored). A later
-- attendance mark re-works Overall only for a card that scores attendance (classweek.js finalScores, leaderboard.js).
ALTER TABLE submissions ADD COLUMN score_card TEXT NOT NULL DEFAULT '';
-- the Morning program column (0–100: the week's marks ÷ 140); NULL for a card without it
ALTER TABLE submissions ADD COLUMN morning INTEGER;

-- Admin › Analysis: the Morning program per batch per closed week (refreshWeeks in analysis.js), over the weeks that have it
ALTER TABLE batch_weeks ADD COLUMN n_morning INTEGER NOT NULL DEFAULT 0;
ALTER TABLE batch_weeks ADD COLUMN sum_morning REAL NOT NULL DEFAULT 0;

-- the Temple Residents batch takes the TRD card (live on 26 Oct: one member, no TRD week submitted yet)
UPDATE batches SET score_card = 'TRD', updated_at = '2026-10-26T00:00:00+05:30', updated_by = 'migration 0065' WHERE level = 'TRD' AND score_card = 'SPS';
-- the rules a phone keeps (rules.get) now carry the TRD card: raise the version so every phone fetches them once
UPDATE settings SET value = 'r4', changed_by = 'phase 22' WHERE key = 'rules_version';
