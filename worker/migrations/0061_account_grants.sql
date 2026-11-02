-- ADR 0015 (the head, 22 Oct 2026): permissions per person, given and taken by the head. A small JSON value on the
-- person's own row, so the gate reads it with the session and no extra round trip:
--   { "<capability>": { "effect": "allow" | "deny", "until": "YYYY-MM-DD" | "" } }
-- '' = nothing changed: the person has exactly what their roles give them. Every change is an access.set line in Activity.
ALTER TABLE accounts ADD COLUMN grants TEXT NOT NULL DEFAULT '';
-- the head's "everyone with a change" list reads only those rows, never the whole accounts table
CREATE INDEX IF NOT EXISTS accounts_with_grants ON accounts (name) WHERE grants <> '';
