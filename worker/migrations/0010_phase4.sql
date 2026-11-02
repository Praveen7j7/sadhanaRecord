-- Phase 4: coordinator and master tools.

-- Profile photos (design §3a). Kept here, not in Drive: Google gives the service account no Drive storage.
-- One small JPEG (≤ 400 × 400 px, ≤ 150 KB) per login, base64. Never copied to Sheets.
CREATE TABLE photos (login TEXT PRIMARY KEY, jpeg TEXT NOT NULL, bytes INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);

-- A coordinator asks the master to reopen a missed week (API contract §4); the master decides
CREATE TABLE reopen_requests (
  login TEXT NOT NULL, week_id TEXT NOT NULL, batch_id TEXT NOT NULL, reason TEXT NOT NULL, by TEXT NOT NULL, at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','DONE','REJECTED')), decided_by TEXT NOT NULL DEFAULT '', decided_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (login, week_id)
);

-- The four batch view spreadsheets: what was last written to each, so an unchanged view is not rewritten
CREATE TABLE view_state (view TEXT PRIMARY KEY, sig TEXT NOT NULL DEFAULT '', synced_at TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '');
INSERT INTO view_state (view) VALUES ('viewSPS'), ('viewDPS'), ('viewBSS'), ('viewBVS');

CREATE INDEX memberships_by_batch ON memberships (batch_id, to_week);
CREATE INDEX missed_by_batch ON missed_weeks (batch_id, week_id);
CREATE INDEX drafts_by_batch ON drafts (batch_id, week_id);
