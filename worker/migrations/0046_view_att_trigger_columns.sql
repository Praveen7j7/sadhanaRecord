-- The attendance → view-sheet trigger watches every mark column (13 Oct 2026; audit B16 / roadmap 2.6).
--
-- 0020 created it as `AFTER UPDATE OF devotee_mark, coordinator_mark, mark_used`. 0023 then added `leader_mark`
-- (the group leader's mark, decision 41) and `master_mark` (the head's correction) — the trigger was never
-- extended, so an UPDATE touching only one of those two does not mark the batch's view sheet as needing a refresh.
--
-- Today nothing hits that gap: classweek.js writeMark() always writes `mark_used` in the same statement, which is
-- in the list. It is a trap for the next change rather than a live defect — a statement that corrects only
-- `master_mark`, or only `leader_mark`, would leave the coordinator's view sheet showing the old mark until some
-- other change to that week happened to refresh it.
--
-- Same body as 0020, only the watched column list grows. Additive and re-runnable.

DROP TRIGGER IF EXISTS view_att_upd;

CREATE TRIGGER view_att_upd AFTER UPDATE OF devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used ON attendance BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board');
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'att:' || NEW.week_id FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'att:' || NEW.week_id); END;
