-- Phase 9, item 24 (the user, 9 Oct 2026, release-blocking): a new IYF head — appointed directly (someone with no
-- coordination history) or promoted from staff — takes effect only when EVERY other active IYF head has approved
-- (the recovery login is not asked; when the appointing head is the only one, it takes effect at once). One "no"
-- turns it down; the head who asked can withdraw it; an open request lapses after 14 days.
-- A direct appointment keeps the temporary password only as its hash here, until the account is made.
-- Copied to the Access file's HeadRequests tab, without the password hash (build the tab before applying this).
CREATE TABLE head_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('CREATE', 'PROMOTE')),
  login TEXT NOT NULL,                            -- the new username (CREATE) or the staff login promoted (PROMOTE)
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  pw_hash TEXT NOT NULL DEFAULT '', pw_salt TEXT NOT NULL DEFAULT '', pw_iterations INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  needed TEXT NOT NULL,                           -- the heads who must approve (logins, comma separated)
  approved TEXT NOT NULL DEFAULT '',              -- those who did
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'DONE', 'REJECTED', 'WITHDRAWN', 'EXPIRED')),
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX head_requests_open ON head_requests (state) WHERE state = 'OPEN';

CREATE TRIGGER mirror_head_requests_ins AFTER INSERT ON head_requests BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', NEW."id", ''); END;
CREATE TRIGGER mirror_head_requests_upd AFTER UPDATE ON head_requests BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', NEW."id", ''); END;
CREATE TRIGGER mirror_head_requests_key AFTER UPDATE ON head_requests WHEN OLD."id" IS NOT NEW."id" BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', OLD."id", ''); END;
CREATE TRIGGER mirror_head_requests_del AFTER DELETE ON head_requests BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', OLD."id", ''); END;
INSERT OR IGNORE INTO mirror_state (tbl, mode) VALUES ('head_requests', 'build');
UPDATE mirror_state SET mode = 'build', last_id = 0, rows = 0, gen = 0, cursor = '' WHERE tbl = 'head_requests';
