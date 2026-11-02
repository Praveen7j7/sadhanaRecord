-- TRD — the temple residents, as a batch of their own (the head, 17 Oct 2026).
--
-- "TRD" already meant something here: `facilitator.js` showed a facilitator with NO batch as TRD, a
-- label for the absence of one. That left temple residents unable to do the ordinary thing — sign
-- up, fill their sadhana, be seen by a coordinator — because every one of those needs a batch.
--
-- So TRD becomes a real batch: it appears at sign-up, its members fill the whole weekly form, and it
-- has a coordinator like any other. It is NOT a numbered intake (ETP-51, VL2-51) and never closes;
-- temple residents are not a term that ends.
--
-- The old derived label keeps working: a facilitator with no batch still reads TRD, and now there is
-- somewhere real for them to be instead.
INSERT OR IGNORE INTO batches (batch_id, name, level, score_card, hearing_journal, sheet_tab,
                               coordinator_logins, standing, active, pilot, tracks, class_day, updated_at, updated_by)
VALUES ('TRD', 'Temple Residents', 'TRD', 'SPS', 'SPS/DPS', 'TRD', '', 1, 1, 0, 'full', 'SUN', '', 'migration 0053');
