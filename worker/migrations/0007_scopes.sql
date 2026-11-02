-- Decision 34: one person, one login. Scopes come from what the person is:
--   devotee     an approved account with a batch membership (fills their own sadhana)
--   coordinator listed in Batches.coordinator_logins (any account, devotee included)
--   master      is_master = 1 (granted by a master)
ALTER TABLE accounts ADD COLUMN is_master INTEGER NOT NULL DEFAULT 0;
UPDATE accounts SET is_master = 1 WHERE role = 'MASTER';
UPDATE mirror_state SET dirty = dirty + 1 WHERE tbl = 'accounts';
