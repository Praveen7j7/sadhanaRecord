-- Admin › Analysis (phase 21, 23 Oct 2026; the head: "an analysis tab in the admin which gives the dashboard view batch
-- wise for the IYF head about the increase in chanting and various devotional standards across the IYF … week, month,
-- year or custom … or phase … graphs and report for increase or drop in chanting, reading and hearing and other
-- important factors like night stay").
--
-- One row per batch per CLOSED week: the sums behind every average, so a year of analysis reads ~52 × batches rows
-- instead of every submission (~260,000 at 5,000 devotees). Written by the Monday deadline job when it closes a week —
-- that week and the three before it, so a reopened week submitted late or an attendance change made after the deadline
-- is counted (~40 keyed writes a week). The current, unfinished week is never in it.
CREATE TABLE batch_weeks (
  batch_id TEXT NOT NULL,
  week_id TEXT NOT NULL,
  submitted INTEGER NOT NULL DEFAULT 0,      -- weeks submitted (each devotee once)
  missed INTEGER NOT NULL DEFAULT 0,         -- weeks closed unsubmitted
  sum_overall REAL NOT NULL DEFAULT 0, sum_body REAL NOT NULL DEFAULT 0, sum_soul REAL NOT NULL DEFAULT 0,
  sum_bed REAL NOT NULL DEFAULT 0, sum_wake REAL NOT NULL DEFAULT 0,        -- the to-bed and wake-up scores (0–100)
  n_rounds INTEGER NOT NULL DEFAULT 0, sum_rounds REAL NOT NULL DEFAULT 0,  -- rounds a day, over those who gave them
  sum_reading REAL NOT NULL DEFAULT 0, sum_hearing REAL NOT NULL DEFAULT 0, sum_seva REAL NOT NULL DEFAULT 0,   -- week minutes
  night_yes INTEGER NOT NULL DEFAULT 0, principles_yes INTEGER NOT NULL DEFAULT 0,
  present INTEGER NOT NULL DEFAULT 0, held INTEGER NOT NULL DEFAULT 0,      -- class marks: present of those marked
  at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (batch_id, week_id)
) WITHOUT ROWID;
CREATE INDEX batch_weeks_by_week ON batch_weeks (week_id);

-- every week already closed, once
INSERT INTO batch_weeks (batch_id, week_id, submitted, missed, sum_overall, sum_body, sum_soul, sum_bed, sum_wake, n_rounds, sum_rounds,
                         sum_reading, sum_hearing, sum_seva, night_yes, principles_yes, present, held, at)
SELECT k.batch_id, k.week_id, COALESCE(s.n, 0), COALESCE(x.n, 0), COALESCE(s.so, 0), COALESCE(s.sb, 0), COALESCE(s.ss, 0), COALESCE(s.sbed, 0), COALESCE(s.swake, 0),
       COALESCE(s.nr, 0), COALESCE(s.sr, 0), COALESCE(s.srd, 0), COALESCE(s.sh, 0), COALESCE(s.sv, 0), COALESCE(s.ny, 0), COALESCE(s.py, 0),
       COALESCE(a.p, 0), COALESCE(a.h, 0), 'migration 0064'
  FROM (SELECT batch_id, week_id FROM submissions UNION SELECT batch_id, week_id FROM missed_weeks) k
  LEFT JOIN (SELECT batch_id, week_id, COUNT(*) AS n, SUM(overall) AS so, SUM(body) AS sb, SUM(soul) AS ss, SUM(bed) AS sbed, SUM(wake_up) AS swake,
                    SUM(avg_rounds <> '') AS nr, SUM(CASE WHEN avg_rounds <> '' THEN CAST(avg_rounds AS REAL) ELSE 0 END) AS sr,
                    SUM(reading_minutes) AS srd, SUM(hearing_minutes) AS sh, SUM(seva_minutes) AS sv,
                    SUM(night_stay = 'YES') AS ny, SUM(principles = 'YES') AS py
               FROM submissions GROUP BY batch_id, week_id) s ON s.batch_id = k.batch_id AND s.week_id = k.week_id
  LEFT JOIN (SELECT batch_id, week_id, COUNT(*) AS n FROM missed_weeks GROUP BY batch_id, week_id) x ON x.batch_id = k.batch_id AND x.week_id = k.week_id
  LEFT JOIN (SELECT batch_id, week_id, SUM(mark_used = 'P') AS p, SUM(mark_used <> '') AS h FROM attendance GROUP BY batch_id, week_id) a ON a.batch_id = k.batch_id AND a.week_id = k.week_id
 WHERE k.week_id <= (SELECT value FROM settings WHERE key = 'deadline_done');
