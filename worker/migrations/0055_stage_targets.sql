-- Stage targets: how many students a facilitator means to move up, per level (the head, 17 Oct 2026).
--
-- The dashboard's facilitator card carries two halves. The eleven LEAD MEASURES (migration 0052) are
-- what somebody does each week. The STAGES are what it is for: "VL-3: 8, SPS: 6, DPS/BSS: 5" — how
-- many students they mean to see promoted in the phase. Its score is
--
--     net = (sadhana % + seva % + goal %) / 3
--
-- and `goal %` comes from the stages. Without them the app could compute only two thirds of a
-- figure the dashboard prints whole.
--
-- The TARGET is theirs to set, like their lead-measure targets. The ACHIEVED is NOT typed here as
-- it is in the sheet: this app knows who was promoted and when (batch_closings, and the membership
-- a promotion opens), so it is counted rather than reported. A number nobody types is a number
-- nobody can get wrong.
CREATE TABLE stage_targets (
  id INTEGER PRIMARY KEY,
  phase_id TEXT NOT NULL,
  login TEXT NOT NULL,
  stage TEXT NOT NULL,                 -- 'VL2'|'VL3'|'SPS'|'DPS'|'BSS'|'BVS' — the level moved TO
  target INTEGER NOT NULL DEFAULT 0,
  set_by TEXT NOT NULL,
  set_at TEXT NOT NULL,
  UNIQUE (phase_id, login, stage)
);
CREATE INDEX stage_targets_by_person ON stage_targets (login, phase_id);
