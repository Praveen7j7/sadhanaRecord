-- Possible duplicate IYF IDs the master reviewed and marked "not duplicates" (e.g. brothers on one family phone, two
-- people with the same name). Keyed by the sorted IDs of the group: if another ID joins the group it shows again.
CREATE TABLE duplicate_reviews (group_key TEXT PRIMARY KEY, why TEXT NOT NULL, decision TEXT NOT NULL CHECK (decision IN ('NOT_DUPLICATE')), by TEXT NOT NULL, at TEXT NOT NULL);
