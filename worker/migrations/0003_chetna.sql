-- Positive and Negative Chetna options, as in COSATOK's Update Sadhana screen (screenshot from the head, 2 Oct 2026).
-- rules_version goes to r2 so phones fetch the new lists.
INSERT INTO chetna_options ("kind", "option", "order") VALUES
  ('POSITIVE', 'Appreciative', 1), ('POSITIVE', 'Compassionate', 2), ('POSITIVE', 'Detached', 3), ('POSITIVE', 'Determined', 4),
  ('POSITIVE', 'Disciplined', 5), ('POSITIVE', 'Enthusiastic', 6), ('POSITIVE', 'Humble', 7), ('POSITIVE', 'Spiritually Absorbed', 8),
  ('POSITIVE', 'Valued Association', 9),
  ('NEGATIVE', 'Angry', 1), ('NEGATIVE', 'Egoistic', 2), ('NEGATIVE', 'Envious', 3), ('NEGATIVE', 'Greedy', 4),
  ('NEGATIVE', 'Lazy', 5), ('NEGATIVE', 'Lusty', 6), ('NEGATIVE', 'Offensive', 7), ('NEGATIVE', 'Over Eating', 8),
  ('NEGATIVE', 'Time Wasting', 9);
UPDATE settings SET value = 'r2', changed_by = 'phase 2' WHERE key = 'rules_version';
UPDATE mirror_state SET dirty = dirty + 1 WHERE tbl IN ('chetna_options', 'settings');
