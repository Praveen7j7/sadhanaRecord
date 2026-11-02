-- A week with no regular class (holiday, festival or another reason), set by the batch coordinator or the master.
-- mode ALL_PRESENT: everyone in the batch is Present that week; MARKED: only those the coordinator marks Present
-- (for example, those who came to the festival), everyone else Absent. A coordinator's mark for one person still wins.
CREATE TABLE class_weeks (
  batch_id TEXT NOT NULL, week_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('HOLIDAY','FESTIVAL','OTHER')), note TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ALL_PRESENT','MARKED')), by TEXT NOT NULL, at TEXT NOT NULL,
  PRIMARY KEY (batch_id, week_id)
);
INSERT INTO mirror_state (tbl) VALUES ('class_weeks');
