-- Birthdays on Home (the head, 27 Oct 2026: "the birthday reminder: firstly the devotee's entire batch gets it, and the
-- coordinator and the admin"). A devotee's Home names the batch-mates whose birthday is today — name only, no age or date.
--
-- Home is opened constantly, so the read must not walk the batch: home.get starts FROM profiles through this index (the
-- day's month-day, 'MM-DD' of profiles.dob, which is always 'YYYY-MM-DD' or '' — util.js validYmd), then looks each
-- match up by login in memberships and accounts. Rows read per Home open ≈ the people born on this day across IYF × 3.
-- Partial: the blank dobs (no birthday known) are not indexed at all.
-- Additive: one index, nothing else changes. Writes: one index entry per profile with a dob.
CREATE INDEX profiles_by_birthday ON profiles (substr(dob, 6, 5)) WHERE dob <> '';
