-- A service account: a login that belongs to a machine, not a person (11 Oct 2026).
--
-- The facilitator dashboard's hourly registry job needs ONE action, identity.mintBatch. Until now the
-- only way to call it was a master session token, which reaches 49 actions including devotees.delete and
-- coordinators.resetPassword. That token has to sit in an Apps Script Property that any dashboard editor
-- can read, so the job's credential was far stronger than the job.
--
-- `only_actions` is an allowlist. Empty (the default, and so every existing account) means no restriction:
-- the account behaves exactly as before. Non-empty means the session may call ONLY those actions, whatever
-- its role otherwise permits. Checked in api.js next to the role gate, so there is one place to pass.
--
-- Additive and defaulted: old code ignores the column, every current account keeps its access.
ALTER TABLE accounts ADD COLUMN only_actions TEXT NOT NULL DEFAULT '';

-- Why the account exists, for whoever reads the accounts list in a year and wonders what 'dashboard-cron' is.
ALTER TABLE accounts ADD COLUMN service_note TEXT NOT NULL DEFAULT '';
