// Moves the duplicate book copies in the "books" folder to the Drive trash (27 Oct 2026, the head: "remove them").
// Add this as a second file (Cleanup.gs) in the SAME Apps Script project as Code.gs: it uses TARGET, TAG and readLinks_
// from there. Then Run ▸ removeDuplicates.
// A file is trashed only when ALL of these hold: it carries this script's "copy of <id>" description, it is not the copy
// the app uses (app-links.json), and the copy the app uses for that book is still there and not in the trash.
// Anything else in the folder is left alone. Trashed files stay recoverable from the Drive trash for 30 days; they
// still count against the account's storage until the trash is emptied. Safe to run again.
function removeDuplicates() {
  const start = Date.now(), root = DriveApp.getFolderById(TARGET), links = readLinks_(root), keep = {};
  Object.keys(links).forEach(function (k) { keep[links[k]] = true; });
  if (Object.keys(links).length < FILES.length) { Logger.log('app-links.json lists ' + Object.keys(links).length + ' of ' + FILES.length + ' books: finish copyBooks first. Nothing trashed.'); return; }
  const alive = {};   // the app's copy of a book is still there
  let trashed = 0, bytes = 0, left = 0, stopped = false;
  (function walk(folder) {
    const files = folder.getFiles();
    while (files.hasNext() && !stopped) {
      if (Date.now() - start > 5 * 60 * 1000) { stopped = true; return; }
      const f = files.next(), id = f.getId();
      if (keep[id] || f.isTrashed() || f.getName() === 'app-links.json') continue;
      const d = f.getDescription() || '';
      if (d.indexOf(TAG) !== 0) { left++; continue; }            // not made by this script: leave it
      const orig = d.slice(TAG.length), kept = links[orig];
      if (!kept) { left++; continue; }                            // its book has no copy in use: leave it
      if (!(kept in alive)) { try { alive[kept] = !DriveApp.getFileById(kept).isTrashed(); } catch (e) { alive[kept] = false; } }
      if (!alive[kept]) { left++; continue; }
      bytes += f.getSize(); f.setTrashed(true); trashed++;
    }
    const subs = folder.getFolders();
    while (subs.hasNext() && !stopped) { const s = subs.next(); if (!s.isTrashed()) walk(s); }
  })(root);
  Logger.log('Moved ' + trashed + ' duplicate copies (' + (bytes / 1e6).toFixed(0) + ' MB) to the trash.' +
    (left ? ' Left alone: ' + left + ' other files.' : '') + (stopped ? ' Stopped at 5 minutes: run removeDuplicates again to finish.' : ' Done.'));
}
