-- Sign-up asks for an email address, a WhatsApp number and the class day (the head, 3 Oct 2026). There is one class
-- a week across all batches, on Sunday or Saturday; each devotee belongs to one of them (the Saturday flow comes later).
-- The group leader is no longer asked for: requested_group_leader / memberships.group_leader stay for history only.
ALTER TABLE accounts ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN requested_class_day TEXT NOT NULL DEFAULT '';
ALTER TABLE memberships ADD COLUMN class_day TEXT NOT NULL DEFAULT '';
UPDATE mirror_state SET dirty = dirty + 1 WHERE tbl IN ('accounts', 'memberships');
