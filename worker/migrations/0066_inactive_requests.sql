-- Inactive devotees (Phase 22, I1–I3; the head, 26 Oct 2026: "If a devotee does not fill sadhana for one month, a request
-- is raised to their class coordinator, their facilitator and the admin: should they be made inactive?").
--
-- The Monday deadline job raises ONE request for an active devotee whose last four deadlines passed with no submitted
-- week (and who has been in their batch at least those four weeks). Their class coordinator, their facilitator and the
-- head all see it; any one of them approves (the membership becomes INACTIVE from that week — the login stays, and their
-- next submitted week makes them active again by itself) or rejects (not raised again until four more weeks pass).
--
--   raised_week   the week whose deadline raised it (the last of the four)
--   last_week     the last week they had submitted when it was raised ('' = never)
--   status        OPEN · APPROVED · REJECTED · CLOSED (they submitted a week, or became inactive or disabled, before
--                 anyone decided)
--   decided_week  the Monday of the week it was decided: a REJECTED one is not raised again until four deadlines after it
--
-- Additive: a new table, nothing else changes. Rows written per raise: one row and its index entries.
CREATE TABLE inactive_requests (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  facilitator TEXT NOT NULL DEFAULT '',
  raised_week TEXT NOT NULL,
  last_week TEXT NOT NULL DEFAULT '',
  raised_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  decided_week TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
-- one open request per person, ever (no duplicates for the same stretch)
CREATE UNIQUE INDEX inactive_requests_open ON inactive_requests (login) WHERE status = 'OPEN';
-- a person's past requests (the rejected-recently test at the deadline) and the open list
CREATE INDEX inactive_requests_login ON inactive_requests (login, status, decided_week);
CREATE INDEX inactive_requests_status ON inactive_requests (status, raised_at);
