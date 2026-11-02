-- Phase 3: the weekly form. Weeks run Monday to Sunday and are named by their Monday (YYYY-MM-DD).

-- Work in progress: one row per devotee per week; each day in its own column (JSON with its version "v"),
-- so saving Tuesday never touches Monday, and two devices on the same day are told apart by the version.
CREATE TABLE drafts (
  login TEXT NOT NULL, week_id TEXT NOT NULL, batch_id TEXT NOT NULL,
  d1 TEXT, d2 TEXT, d3 TEXT, d4 TEXT, d5 TEXT, d6 TEXT, d7 TEXT,
  week_end TEXT,                         -- JSON { v, nightStay, principles }
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
  PRIMARY KEY (login, week_id)
);

-- Submitted weeks: written once, never changed (decision 26). One per devotee per week, enforced here.
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE, login TEXT NOT NULL, iyf_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
  batch_id TEXT NOT NULL, week_id TEXT NOT NULL, submitted_at TEXT NOT NULL, submitted_by TEXT NOT NULL,
  on_behalf INTEGER NOT NULL DEFAULT 0, request_id TEXT NOT NULL DEFAULT '', rules_version TEXT NOT NULL, reopened INTEGER NOT NULL DEFAULT 0,
  bed INTEGER NOT NULL, wake_up INTEGER NOT NULL, day_sleep INTEGER NOT NULL, japa INTEGER NOT NULL, pathan INTEGER NOT NULL,
  sravan INTEGER NOT NULL, seva INTEGER NOT NULL, attendance INTEGER NOT NULL, body INTEGER NOT NULL, soul INTEGER NOT NULL,
  overall INTEGER NOT NULL, seva_minutes INTEGER NOT NULL, avg_rounds TEXT NOT NULL, night_stay TEXT NOT NULL, principles TEXT NOT NULL,
  hearing_minutes INTEGER NOT NULL, reading_minutes INTEGER NOT NULL, days_json TEXT NOT NULL, marks_json TEXT NOT NULL,
  bridged_at TEXT NOT NULL DEFAULT '',
  UNIQUE (login, week_id)
);
CREATE INDEX submissions_by_week ON submissions (week_id, batch_id);

-- Attendance per devotee per week: the coordinator's mark wins; locked at the Monday 9 PM deadline (decision 30)
CREATE TABLE attendance (
  login TEXT NOT NULL, week_id TEXT NOT NULL, batch_id TEXT NOT NULL,
  devotee_mark TEXT NOT NULL DEFAULT '', coordinator_mark TEXT NOT NULL DEFAULT '', mark_used TEXT NOT NULL DEFAULT '',
  locked INTEGER NOT NULL DEFAULT 0, changed_by TEXT NOT NULL DEFAULT '', changed_at TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (login, week_id)
);

-- Weeks closed at the deadline without a submission (decision 31): the views show them as MISSED
CREATE TABLE missed_weeks (
  login TEXT NOT NULL, week_id TEXT NOT NULL, batch_id TEXT NOT NULL, days_filled INTEGER NOT NULL DEFAULT 0, at TEXT NOT NULL,
  PRIMARY KEY (login, week_id)
);

-- Missed weeks the master reopened (phase 4 screen; the deadline and submit rules read it now)
CREATE TABLE reopens (
  login TEXT NOT NULL, week_id TEXT NOT NULL, reason TEXT NOT NULL, open_until TEXT NOT NULL, by TEXT NOT NULL, at TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('OPEN','SUBMITTED','EXPIRED')),
  PRIMARY KEY (login, week_id)
);

INSERT INTO settings (key, value, note, changed_by) VALUES
  ('deadline_done', '', 'Last week whose Monday 9 PM deadline has been fully processed', 'setup'),
  ('tracking_from', '', 'First week (its Monday) the app expects submissions, i.e. the pilot start. Weeks before it are never marked missed; blank = none yet', 'setup');
INSERT INTO mirror_state (tbl) VALUES ('submissions'), ('attendance'), ('reopens');
