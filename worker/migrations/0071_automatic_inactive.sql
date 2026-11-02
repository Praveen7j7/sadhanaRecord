-- Automatic inactive (Phase 23, ADR 0020; the head, 27 Oct 2026): "Once a person has not filled sadhana in the app even a
-- single day for more than a month, or hasn't logged in to his account for more than a month, then automatically he
-- becomes inactive and the coordinators and every admin are notified. He becomes active as soon as he again starts
-- filling sadhana or logs in." Decided: BOTH silent for 30 days (no saved day AND no use of the app), so nobody
-- flip-flops; filling a day or using the app brings them back at once. It replaces the Phase 22 "Inactive?" requests.
--
-- accounts.auto_inactive  1 while the app itself made their membership INACTIVE (the daily job, inactive.js). Session and
--                         sign-in read the account row anyway, so this one flag tells them, for free, that using the app
--                         should make the person active again. A coordinator's "Mark inactive" never sets it, so using
--                         the app does not undo a person's decision (only a filled day or "Make active again" does).
-- activity_events         one row per change of who is counted: INACTIVE or ACTIVE, and how — AUTO (the daily job),
--                         MANUAL (Mark inactive / Make active again), FILLED (a saved day or a submitted week), APP (they
--                         used the app). The Home notices and the month-by-month and day-by-day analysis read it.
--                         day = the Indian date. Additive; a few rows a day.
--
-- The Phase 22 inactive_requests table stays (additive, unused from now on); its open rows are closed here.
ALTER TABLE accounts ADD COLUMN auto_inactive INTEGER NOT NULL DEFAULT 0;

CREATE TABLE activity_events (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  day TEXT NOT NULL,
  change TEXT NOT NULL CHECK (change IN ('INACTIVE', 'ACTIVE')),
  how TEXT NOT NULL CHECK (how IN ('AUTO', 'MANUAL', 'FILLED', 'APP')),
  at TEXT NOT NULL,
  by_login TEXT NOT NULL DEFAULT ''
);
-- the analysis (a batch's months and days) and the notices (a batch's last days)
CREATE INDEX activity_events_batch_day ON activity_events (batch_id, day);
-- all of IYF (the head) by day
CREATE INDEX activity_events_day ON activity_events (day);
-- the daily job finds the people it just changed by (day, how)
CREATE INDEX activity_events_day_how ON activity_events (day, how, login);

UPDATE inactive_requests SET status = 'CLOSED', decided_by = 'SYSTEM', decided_at = '2026-10-27T00:00:00+05:30',
       note = 'replaced by the automatic rule (0071)' WHERE status = 'OPEN';
