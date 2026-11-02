-- The facilitation card's two groups, as the head's Excel card draws them (ADR 0012 G, 22 Oct 2026).
--
--   sadhana   0      Sadhna, above both groups
--   vl2reg    1–4    "Vedic Level 2 registration": stall preaching, calling new students, the two Sunday attendances
--   target    5–10   "Target" (the per-level promotion targets, VL-3 · SPS · DPS/BSS · BVS, sit beside this group):
--                    one-to-one meetings, FTP/ETP attendance, and the four MONTHLY measures
--
-- Additive: one column, data only. The weekly/monthly split already exists (`frequency`, migration 0052) and matches
-- the card; this adds the grouping the screen needs so that what is due, and what it is for, are visible.
ALTER TABLE measures ADD COLUMN grp TEXT NOT NULL DEFAULT '';
UPDATE measures SET grp = 'sadhana' WHERE measure_id = 'sadhna';
UPDATE measures SET grp = 'vl2reg'  WHERE measure_id IN ('stall', 'calls', 'vl1att', 'vl23att');
UPDATE measures SET grp = 'target'  WHERE measure_id IN ('oneToOne', 'ftp', 'seniorMeet', 'seriousOne', 'allMeet', 'journal');
