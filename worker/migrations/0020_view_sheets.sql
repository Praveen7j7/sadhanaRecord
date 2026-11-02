-- The four batch view sheets, kept up to date piece by piece (phase 6, 3 Oct 2026; src/views.js).
-- Before: any change in a batch cleared and rewrote the whole view (12 weeks of scores, 4 weeks of daily answers), and
-- the change check read the batch's whole history up to four times a minute. That is far beyond the free plan's 10 ms
-- per run at 1,000+ devotees. Now: a new submission is inserted as one row at its place (newest week first, names A–Z),
-- an attendance change rewrites that week's rows, "This week" rewrites only rows that changed, and old weeks are
-- dropped once a week. The layout of every tab is unchanged.

-- What changed since the last write, per view: 'board' (This week tab) or 'att:<week>' (attendance of that week).
-- Set by triggers, only when not set already (a mark already set costs no write; not INSERT OR IGNORE: inside a trigger
-- the firing statement's own conflict rule would override it); cleared by the view job.
CREATE TABLE view_dirty (view TEXT NOT NULL, part TEXT NOT NULL, PRIMARY KEY (view, part)) WITHOUT ROWID;
-- Per view: the sorted row keys of each week shown (part = week), and the row fingerprints of This week (part = 'board').
CREATE TABLE view_keys (view TEXT NOT NULL, part TEXT NOT NULL, keys TEXT NOT NULL, PRIMARY KEY (view, part)) WITHOUT ROWID;
-- mode 'build' = start again from empty tabs; focus = the week the tabs are built for; last_id = the last submission
-- placed; blocks = [{ w, n }] rows per week in Scores / Week-end (Days: 7 a row); board_at = This week last written.
ALTER TABLE view_state ADD COLUMN mode TEXT NOT NULL DEFAULT 'build';
ALTER TABLE view_state ADD COLUMN focus TEXT NOT NULL DEFAULT '';
ALTER TABLE view_state ADD COLUMN last_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE view_state ADD COLUMN blocks TEXT NOT NULL DEFAULT '[]';
ALTER TABLE view_state ADD COLUMN board_at TEXT NOT NULL DEFAULT '';

CREATE TRIGGER view_drafts_ins AFTER INSERT ON drafts BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_drafts_upd AFTER UPDATE ON drafts BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_drafts_del AFTER DELETE ON drafts BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = OLD.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_subs_ins AFTER INSERT ON submissions BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_att_ins AFTER INSERT ON attendance BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board');
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'att:' || NEW.week_id FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'att:' || NEW.week_id); END;
CREATE TRIGGER view_att_upd AFTER UPDATE OF devotee_mark, coordinator_mark, mark_used ON attendance BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board');
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'att:' || NEW.week_id FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'att:' || NEW.week_id); END;
CREATE TRIGGER view_mem_ins AFTER INSERT ON memberships BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_mem_upd AFTER UPDATE ON memberships BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id IN (NEW.batch_id, OLD.batch_id) AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_acc_upd AFTER UPDATE OF name, status, iyf_id ON accounts BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || b.level, 'board' FROM memberships m JOIN batches b ON b.batch_id = m.batch_id
    WHERE m.login = NEW.login AND m.to_week = '' AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || b.level AND x.part = 'board'); END;
CREATE TRIGGER view_cw_ins AFTER INSERT ON class_weeks BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_cw_upd AFTER UPDATE ON class_weeks BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_cw_del AFTER DELETE ON class_weeks BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = OLD.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_missed_ins AFTER INSERT ON missed_weeks BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = NEW.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_missed_del AFTER DELETE ON missed_weeks BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || level, 'board' FROM batches WHERE batch_id = OLD.batch_id AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || level AND x.part = 'board'); END;
CREATE TRIGGER view_reopens_ins AFTER INSERT ON reopens BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || b.level, 'board' FROM memberships m JOIN batches b ON b.batch_id = m.batch_id
    WHERE m.login = NEW.login AND m.to_week = '' AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || b.level AND x.part = 'board'); END;
CREATE TRIGGER view_reopens_upd AFTER UPDATE ON reopens BEGIN
  INSERT INTO view_dirty (view, part) SELECT DISTINCT 'view' || b.level, 'board' FROM memberships m JOIN batches b ON b.batch_id = m.batch_id
    WHERE m.login = NEW.login AND m.to_week = '' AND NOT EXISTS (SELECT 1 FROM view_dirty x WHERE x.view = 'view' || b.level AND x.part = 'board'); END;
