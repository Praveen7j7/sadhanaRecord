-- Phase 9, item 13 (the head, 9 Oct 2026): the address in parts, as people know them — house / flat number, street /
-- gali / road (optional), landmark (optional) — beside the area, district or city, state and PIN already kept.
-- addr_line stays the one line staff see ("B-12, 2nd floor, Gali no. 3"), built from house and street; addresses
-- given before this keep their line and have no parts. Additive; copied to Sheets as three new columns at the end of
-- the Profiles tab (build them before applying this). Empty defaults: nothing to copy again.
ALTER TABLE profiles ADD COLUMN addr_house TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN addr_street TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN addr_landmark TEXT NOT NULL DEFAULT '';
