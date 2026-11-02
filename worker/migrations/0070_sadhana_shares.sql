-- Share sadhana (the head, 27 Oct 2026): "By default the sadhana is shared with the facilitator, but apart from the
-- facilitator, say I do seva under Y devotee who wants to see my sadhana as well."
--
-- One row per (owner, viewer): the owner's sadhana is open, read-only, to the viewer. No acceptance step: the row is the
-- share. The owner removes it (share.remove) or the viewer drops it from their own list (share.leave); either deletes
-- the row, and every read checks the row on every call, so revoking takes effect at once.
-- The facilitator is NOT stored here: it is derived from the owner's open membership, so a change of facilitator moves
-- the default at once and nothing has to be kept in step.
--
--   id          the share's own random id (10 url-safe characters): the viewer reaches the sadhana by it, so the
--               owner's login (their phone) never reaches the viewer — not in a link, not in a reply
--   owner       the login whose sadhana is shared
--   viewer      the login who may read it
--   created_at  when it was shared (IST)
--
-- Additive: a new table, nothing else changes. Rows written per share: one row, its primary key, the id and viewer indexes.
-- Not copied to Sheets: the copy is paused (SHEETS_COPY=off since 13 Oct 2026) and no table added since 0052 has a
-- mirror_state row or triggers; a mirror_state row without a MIRRORS entry would stay in 'build' for ever.
CREATE TABLE sadhana_shares (
  id TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  viewer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner, viewer)
);
-- "Shared with me": the viewer's side of the list
CREATE INDEX sadhana_shares_viewer ON sadhana_shares (viewer);
