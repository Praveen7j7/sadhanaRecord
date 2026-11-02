-- Phases, target cards and promotion criteria (ADR 0009 follow-on; the head, 17 Oct 2026).
--
-- The facilitation side moves into the app: the head starts a phase, each facilitator and each ETP
-- student fills a card of lead measures against targets, and both are scored. ETP uses the SAME card
-- as a facilitator — they are training to become one — so there is one measure model, not two.
--
-- Nothing here replaces faciliatorDashboard, which keeps running on sheets until the head retires it.

-- A named, dated period the head opens: "Kartik Phase", September to December. Three a year by
-- convention (gaur / jagannath / kartik), but the DATES ARE DATA: a phase may start a week early or
-- late, exactly as a Vedic intake is closed by a person and not by a timer.
CREATE TABLE phases (
  phase_id TEXT PRIMARY KEY,              -- 'kartik-2026'
  name TEXT NOT NULL,                     -- 'Kartik Phase'
  season_year INTEGER NOT NULL,
  starts_on TEXT NOT NULL,                -- yyyy-mm-dd
  ends_on TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'OPEN',     -- OPEN | CLOSED
  opened_by TEXT NOT NULL DEFAULT '',
  opened_at TEXT NOT NULL DEFAULT '',
  closed_by TEXT NOT NULL DEFAULT '',
  closed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX phases_state ON phases (state, starts_on);

-- The lead measures of a card. Seeded with the eleven the dashboard uses; `kind` is the three value
-- types the sheet actually holds — a number, a Yes/No, and a per-level block (one-to-one meetings,
-- whose target differs by the level of the student being met).
CREATE TABLE measures (
  measure_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  label TEXT NOT NULL,
  frequency TEXT NOT NULL,                -- WEEKLY | MONTHLY
  kind TEXT NOT NULL,                     -- NUMBER | YESNO | PER_LEVEL
  unit TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',        -- '' = typed; 'week_score' = the app offers their own week
  -- The same slot, said differently to the two audiences (the head, 17 Oct 2026): a facilitator
  -- reports FTP training attendance, a trainee reports ETP attendance. It is one measure — the
  -- training they are required at — so it stays one row and one column of history rather than
  -- two measures whose figures could never be compared.
  etp_label TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

-- One person's target for one measure in one phase. Set by the ETP coordinator for their students,
-- and for facilitators by whoever defines them; `per_level` carries the VL-3/SPS/DPS-BSS block as
-- JSON when kind = PER_LEVEL.
CREATE TABLE targets (
  id INTEGER PRIMARY KEY,
  phase_id TEXT NOT NULL,
  login TEXT NOT NULL,
  measure_id TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  per_level TEXT NOT NULL DEFAULT '',
  set_by TEXT NOT NULL,
  set_at TEXT NOT NULL,
  UNIQUE (phase_id, login, measure_id)
);
CREATE INDEX targets_by_person ON targets (login, phase_id);

-- What they actually filled, per week. A monthly measure is filled on the week its month ends, so
-- one table serves both frequencies and a card is targets x weeks, as the sheet's columns are.
--
-- `source` is why this table is not just (value): the head asked that Sadhna be offered by the app
-- AND overridable. A figure the app computed and a figure somebody typed are not the same evidence,
-- so the row says which it is rather than printing them alike.
CREATE TABLE fills (
  id INTEGER PRIMARY KEY,
  phase_id TEXT NOT NULL,
  login TEXT NOT NULL,
  measure_id TEXT NOT NULL,
  week_id TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'typed',   -- typed | app
  filled_by TEXT NOT NULL,
  filled_at TEXT NOT NULL,
  UNIQUE (phase_id, login, measure_id, week_id)
);
CREATE INDEX fills_by_person ON fills (login, phase_id, week_id);

-- Promotion criteria per batch, from the dashboard's standard set.
--
-- THESE DECIDE ELIGIBILITY AND NOTHING ELSE (the head, 17 Oct 2026). They answer "may this devotee
-- move up a level", and they are not part of anybody's facilitation score. The two are separate on
-- purpose and must stay so: `targets`/`fills` above measure how a FACILITATOR or ETP student is
-- doing, while these measure whether a DEVOTEE has earned a promotion. Wiring one into the other
-- would make a facilitator's card move because their students did, which is not what either number
-- means.
--
-- Per BATCH, not per level, so a stricter batch is possible without disturbing anyone else; a batch
-- with no row uses the standard set for its level, which is why nothing has to be typed to keep
-- today's behaviour.
CREATE TABLE promotion_criteria (
  id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL,
  criterion TEXT NOT NULL,                -- att | chant | sad | night | cls | pr
  min_value TEXT NOT NULL,
  set_by TEXT NOT NULL,
  set_at TEXT NOT NULL,
  UNIQUE (batch_id, criterion)
);

-- The eleven lead measures, exactly as the dashboard's cards carry them (read from the live sheet,
-- 17 Oct 2026). ETP students fill the same list: they are training to become facilitators, so they
-- practise the real card rather than a different one.
--
-- `source` is set only on Sadhna: the app offers the score it already worked out from that person's
-- own week, and they may type over it. Every other measure is theirs to report.
INSERT INTO measures (measure_id, seq, label, frequency, kind, unit, source) VALUES
  ('sadhna',      0, 'Sadhna',                                                    'WEEKLY',  'NUMBER',    'score',   'week_score'),
  ('stall',       1, 'Stall preaching',                                           'WEEKLY',  'NUMBER',    'hours',   ''),
  ('calls',       2, 'Calling the new students',                                  'WEEKLY',  'NUMBER',    'calls',   ''),
  ('vl1att',      3, 'Sunday VL-1 facilitation attendance',                       'WEEKLY',  'YESNO',     '',        ''),
  ('vl23att',     4, 'Sunday VL-2 / VL-3 facilitation attendance',                'WEEKLY',  'YESNO',     '',        ''),
  ('oneToOne',    5, 'One-to-one meetings with devotees',                         'WEEKLY',  'PER_LEVEL', 'students',''),
  ('ftp',         6, 'FTP training attendance',                                   'WEEKLY',  'YESNO',     '',        ''),
  ('seniorMeet',  7, 'Meeting the senior facilitator about students',             'MONTHLY', 'NUMBER',    'meetings',''),
  ('seriousOne',  8, 'Serious students taken one-to-one with the senior',         'MONTHLY', 'NUMBER',    'students',''),
  ('allMeet',     9, 'All-students meeting with the senior facilitator',          'MONTHLY', 'NUMBER',    'meetings',''),
  ('journal',    10, 'Facilitation journal updated',                              'MONTHLY', 'YESNO',     '',        '');

-- An admin's permission to edit a FINISHED training's card (the head, 17 Oct 2026).
--
-- A closed batch is readable by the admin and by its own ETP coordinator, and frozen to everyone:
-- what somebody filled during their training is a record of what happened, and a record that can be
-- quietly rewritten afterwards is not one. When there is a genuine correction the admin opens that
-- one card, and the row below says who allowed it and why.
CREATE TABLE card_unlocks (
  id INTEGER PRIMARY KEY,
  batch_id TEXT NOT NULL,
  login TEXT NOT NULL,
  reason TEXT NOT NULL,
  allowed_by TEXT NOT NULL,
  allowed_at TEXT NOT NULL,
  until TEXT NOT NULL,
  UNIQUE (batch_id, login)
);

-- ETP students see this one measure under their own name.
UPDATE measures SET etp_label = 'ETP attendance' WHERE measure_id = 'ftp';
