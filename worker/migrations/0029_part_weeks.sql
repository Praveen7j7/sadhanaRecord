-- 4 Oct 2026 (the head): a part week is an option, not an exception. A week can be submitted with the days that are
-- complete (at least one); a day not filled scores 0, so the week's score is capped by its days. At the Monday 9 PM
-- deadline a draft with a complete day is submitted as it stands; a week with none is MISSED (scored 0).
-- days_filled: the complete days the submission counted (1–7). Every week submitted before this was a whole week: 7.
ALTER TABLE submissions ADD COLUMN days_filled INTEGER NOT NULL DEFAULT 7;
