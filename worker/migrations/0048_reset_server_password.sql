-- Decision 46 (the head, 14 Oct 2026): the SERVER makes the reset password, and the coordinator sees it once.
-- Audit finding F1 (P1), roadmap 1.1.
--
-- THE BUG THIS CLOSES. "I forgot my password" used to take the NEW PASSWORD from whoever filled in the form.
-- So anyone who knew a devotee's phone number could queue a password of their choosing against that account
-- and wait for a coordinator to approve it, and nothing forced the real owner to change it afterwards. The
-- coordinator saw a name and a phone number, with no way to tell a real request from an impostor's.
--
-- AFTER THIS. The request carries the phone number only. On approval the server generates the password,
-- stores only its hash, forces a change at first sign-in, and returns the password ONCE in the approval
-- response, for the coordinator to hand over in person or on their own WhatsApp. It is never stored in
-- clear and there is no endpoint that can read it back.
--
-- The three password columns are KEPT, not dropped: rows written before today hold a requester-chosen hash
-- and are part of the audit history. New rows write '' into them. SQLite cannot drop a NOT NULL constraint
-- without rebuilding the table, and rebuilding a table that the Sheets copy tracks (mirror_rows keyed on
-- reset_requests) would force a full re-copy for no gain.

-- When the temporary password stops working. '' on every existing row: those were requester-chosen and are
-- all decided or superseded by now; a blank here reads as "no expiry recorded" and the login path ignores it.
ALTER TABLE reset_requests ADD COLUMN temp_expires_at TEXT NOT NULL DEFAULT '';

-- Which flow wrote the row, so the history stays readable after today. 'REQUESTER' = the old flow (the
-- person filling the form chose the password); 'SERVER' = decision 46. Existing rows are the old flow.
ALTER TABLE reset_requests ADD COLUMN pw_source TEXT NOT NULL DEFAULT 'REQUESTER';

-- A coordinator opening Requests asks for the PENDING rows by status, and the login path now cancels an
-- account's pending requests on a successful sign-in, which looks them up by login. Both were table scans.
CREATE INDEX IF NOT EXISTS idx_reset_login_status ON reset_requests (login, status);
