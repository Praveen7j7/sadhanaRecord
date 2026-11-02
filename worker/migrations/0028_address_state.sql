-- 4 Oct 2026 (the head): a valid postal address — India, the state chosen from the list, in Delhi the district from the
-- list (else the city), and a PIN code of that state. The state is its own column (addresses saved before have none).
ALTER TABLE profiles ADD COLUMN addr_state TEXT NOT NULL DEFAULT '';
