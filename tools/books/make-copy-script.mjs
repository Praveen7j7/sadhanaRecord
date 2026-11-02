// Phase 22 D1 (the head, 26 Oct 2026): copy every book the app links to into the head's "books" Drive folder.
//
// The service accounts own no storage, so the copy runs as the folder's owner, in Apps Script: Google copies
// file to file inside Drive, nothing passes through this machine. This writes that script, with the list of files
// built in.
//
//   1. node tools/books/make-copy-script.mjs        (reads live D1 read-only + Drive metadata as the read-only SA)
//      node tools/books/make-copy-script.mjs --from-manifest   (rebuilds Code.gs from out/manifest.json only)
//   2. paste tools/books/out/Code.gs into script.google.com, signed in as the folder's owner, and run copyBooks
//   3. node tools/books/relink-sql.mjs              (reads the script's app-links.json, writes the migration)
//
// Nothing in the app changes until step 3's migration is applied. The original files are never touched.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { token } from '../../setup/sa.mjs';

export const TARGET = '1bg9AMv4qfN4IlpikXX2VxoprApR1gmNf';      // "books", owned by iyfdelhireadinghearing@gmail.com
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
export const idOf = (url) => (/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})|folders\/([\w-]{20,})/.exec(url) || []).slice(1).find(Boolean) || '';

export function linkRows() {
  const sql = `SELECT 'books' AS t, book_id, '' AS lang, title AS label, link AS url FROM books WHERE link <> ''
    UNION ALL SELECT 'book_files', book_id, COALESCE(lang, ''), label, url FROM book_files
    UNION ALL SELECT 'book_chapters', book_id, lang, label, url FROM book_chapters`;
  const out = execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'sadhana', '--remote', '--json', '--command', sql],
    { cwd: join(HERE, '../../worker'), encoding: 'utf8', maxBuffer: 64 << 20 });
  return JSON.parse(out)[0].results;
}

async function meta(id) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,mimeType,size`,
    { headers: { authorization: 'Bearer ' + await token() } });
  if (!r.ok) throw new Error(`${r.status} reading ${id}`);
  return r.json();
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--from-manifest')) {
  const list = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
  writeFileSync(join(OUT, 'Code.gs'), gas(list));
  console.log(`${list.length} files (from out/manifest.json) → ${join(OUT, 'Code.gs')}`);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = linkRows();
  const title = Object.fromEntries(rows.filter((r) => r.t === 'books').map((r) => [r.book_id, r.label.trim()]));
  // one entry per Drive file, placed under the first book that links it: English/<title> or Hindi/<title>
  const files = new Map();
  for (const r of rows) {
    if (r.t === 'books') continue;
    const id = idOf(r.url);
    if (!id) throw new Error(`no Drive id in ${r.t} ${r.book_id} ${r.url}`);
    if (!files.has(id)) files.set(id, { id, folder: `${r.lang === 'hi' ? 'Hindi' : 'English'}/${title[r.book_id] || r.book_id}` });
  }
  const list = [...files.values()];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < list.length) {
      const f = list[i++], m = await meta(f.id);
      if (m.mimeType === 'application/vnd.google-apps.folder') throw new Error(`a book file is a folder: ${f.id}`);
      Object.assign(f, { name: m.name, size: +(m.size || 0) });
    }
  }));
  list.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  const gb = list.reduce((a, f) => a + f.size, 0) / 1e9;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(list, null, 1));
  writeFileSync(join(OUT, 'Code.gs'), gas(list));
  console.log(`${list.length} files, ${gb.toFixed(2)} GB → ${join(OUT, 'Code.gs')}`);
}

export function gas(list) {
  return `// Copies the Sadhana Record app's books into the "books" folder (${TARGET}), in batches.
// Run as the folder's owner: Run ▸ copyBooks once. It copies at most BATCH_SIZE files per run and adds a trigger that
// runs it again every EVERY_MINUTES minutes until every file is copied; then it removes that trigger.
// Sized for Apps Script's limits on a gmail.com account: 6 min per run, 90 min of trigger runtime per day, 20 triggers
// per script, Script Properties 9 KB per value / 500 KB in all. A run that is killed or hits a Google rate limit loses
// nothing: each copy is recorded the moment it is made, and the next run carries on from there.
// Safe to run again: a file already copied, or a copy already sitting in its folder, is never copied twice.
// Each copy is set to "Anyone with the link · Viewer", and so is the folder.
// The result, app-links.json (original id → copy id), is written into the folder for the app's relink step.
// Helpers to run by hand: status (progress), retryFailed (try given-up files again), stopCopying (remove the trigger).
// Generated by tools/books/make-copy-script.mjs on ${new Date().toISOString().slice(0, 10)} · ${list.length} files.
const TARGET = '${TARGET}';
const FILES = ${JSON.stringify(list.map(({ id, folder, name }) => [id, folder, name]))};

const BATCH_SIZE = 100;                // files per run; a 4.5-minute run copied 134, so 100 ends well inside the limit
const TIME_BUDGET_MS = 4 * 60 * 1000;  // no new copy starts after 4 minutes (Google stops a run at 6)
const EVERY_MINUTES = 5;               // the recurring trigger: allowed values are 1, 5, 10, 15, 30
const SAVE_EVERY = 10;                 // rewrite app-links.json every 10 copies, and at the end of each run
const MAX_TRIES = 3;                   // a file that fails 3 runs in a row (not a rate limit) is given up
const TAG = 'Sadhana Record book · copy of ';

function copyBooks() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { Logger.log('Another run is still copying; this one exits.'); return; }
  const start = Date.now(), props = PropertiesService.getScriptProperties();
  try {
    schedule_(props);   // first, so a run that Google kills is still picked up by the next one
    const root = DriveApp.getFolderById(TARGET);
    if (props.getProperty('folderShared') !== 'yes') {
      root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      props.setProperty('folderShared', 'yes');
    }
    const done = Object.assign(readLinks_(root), withPrefix_(props, 'c:')), tries = withPrefix_(props, 'f:'), folders = {};
    let copied = 0, unsaved = 0, stop = '';
    for (const [id, path, name] of FILES) {
      if (done[id] || parseInt(tries[id] || '0', 10) >= MAX_TRIES) continue;
      if (copied >= BATCH_SIZE) { stop = 'batch of ' + BATCH_SIZE + ' done'; break; }
      if (Date.now() - start > TIME_BUDGET_MS) { stop = 'time budget used'; break; }
      try {
        const copyId = withRetry_(function () { return copyOne_(root, folders, id, path, name); });
        done[id] = copyId; copied++;
        props.setProperty('c:' + id, copyId);
        if (tries[id]) { props.deleteProperty('f:' + id); delete tries[id]; }
        if (++unsaved >= SAVE_EVERY) { save_(root, done); unsaved = 0; }
      } catch (e) {
        const msg = String(e && e.message || e);
        if (isLimit_(msg) || isTransient_(msg)) { stop = 'Google said: ' + msg; break; }   // not the file's fault
        const n = parseInt(tries[id] || '0', 10) + 1;
        tries[id] = n + ' · ' + msg.slice(0, 300);
        props.setProperty('f:' + id, tries[id]);
        Logger.log('Could not copy ' + path + '/' + name + ' (' + id + '), try ' + n + ' of ' + MAX_TRIES + ': ' + msg);
      }
    }
    save_(root, done);
    const left = FILES.filter(function (f) { return !done[f[0]] && parseInt(tries[f[0]] || '0', 10) < MAX_TRIES; }).length;
    const gaveUp = FILES.filter(function (f) { return !done[f[0]] && parseInt(tries[f[0]] || '0', 10) >= MAX_TRIES; });
    const total = Object.keys(done).filter(function (k) { return FILES.some(function (f) { return f[0] === k; }); }).length;
    if (left === 0) {
      unschedule_(props);
      Logger.log('Finished: ' + total + ' of ' + FILES.length + ' copied.' + (gaveUp.length
        ? ' Given up on ' + gaveUp.length + ' (run status for the reasons, retryFailed to try again): ' + gaveUp.map(function (f) { return f[1] + '/' + f[2]; }).join(' | ')
        : ''));
    } else {
      Logger.log('This run copied ' + copied + ' (' + stop + '). ' + total + ' of ' + FILES.length + ' done, ' + left +
        ' left; the trigger carries on within ' + EVERY_MINUTES + ' minutes.');
    }
  } finally {
    lock.releaseLock();
  }
}

// One file: reuse a copy already in its folder (left by a run that was cut off), or make one.
function copyOne_(root, folders, id, path, name) {
  const into = folders[path] || (folders[path] = folderAt_(root, path));
  let copy = existingCopy_(into, name, id);
  if (!copy) {
    copy = DriveApp.getFileById(id).makeCopy(name, into);
    copy.setDescription(TAG + id);   // straight away, so a cut-off run's copy is recognised next time
  }
  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return copy.getId();
}
function existingCopy_(into, name, id) {
  let sameNameUntagged = null;
  const it = into.getFilesByName(name);
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed()) continue;
    const d = f.getDescription() || '';
    if (d === TAG + id) return f;
    if (!d && !sameNameUntagged) sameNameUntagged = f;
  }
  // a copy cut off before its description was set: same name, no description and the same size as the original
  if (sameNameUntagged && sameNameUntagged.getSize() === DriveApp.getFileById(id).getSize()) {
    sameNameUntagged.setDescription(TAG + id);
    return sameNameUntagged;
  }
  return null;
}

// Retries a short-lived Google error (rate limit, server error) up to 3 times, waiting 2, 4 and 8 seconds.
function withRetry_(fn) {
  for (let i = 0; ; i++) {
    try { return fn(); } catch (e) {
      const msg = String(e && e.message || e);
      if (i >= 3 || isDaily_(msg) || !(isLimit_(msg) || isTransient_(msg))) throw e;
      Utilities.sleep(2000 * Math.pow(2, i));
    }
  }
}
function isDaily_(msg) { return /for one day|daily/i.test(msg); }
function isLimit_(msg) { return /too many times|rate limit|ratelimit|quota|limit exceeded|too many requests/i.test(msg); }
function isTransient_(msg) { return /server error|internal error|backend error|service error|timed out|timeout|try again|temporarily|unavailable/i.test(msg); }

function folderAt_(root, path) {
  let f = root;
  for (const part of path.split('/')) {
    const it = f.getFoldersByName(part);
    let found = null;
    while (it.hasNext()) { const g = it.next(); if (!g.isTrashed()) { found = g; break; } }
    f = found || f.createFolder(part);
  }
  return f;
}
function linksFile_(root) {
  const it = root.getFilesByName('app-links.json');
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}
function readLinks_(root) {
  const f = linksFile_(root);
  return f ? JSON.parse(f.getBlob().getDataAsString() || '{}') : {};
}
function save_(root, done) {
  const body = JSON.stringify(done, null, 1), f = linksFile_(root);
  if (f) f.setContent(body); else root.createFile('app-links.json', body, 'application/json');
}
function withPrefix_(props, prefix) {
  const all = props.getProperties(), out = {};
  for (const k in all) if (k.indexOf(prefix) === 0) out[k.slice(prefix.length)] = all[k];
  return out;
}

// Exactly one recurring trigger for copyBooks. Clears the old script's one-minute trigger too.
function schedule_(props) {
  const mine = props.getProperty('triggerId'), all = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'copyBooks'; });
  if (mine && all.length === 1 && all[0].getUniqueId() === mine) return;
  all.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  const t = ScriptApp.newTrigger('copyBooks').timeBased().everyMinutes(EVERY_MINUTES).create();
  props.setProperty('triggerId', t.getUniqueId());
}
function unschedule_(props) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'copyBooks') ScriptApp.deleteTrigger(t); });
  props.deleteProperty('triggerId');
}

function status() {
  const props = PropertiesService.getScriptProperties(), root = DriveApp.getFolderById(TARGET);
  const done = Object.assign(readLinks_(root), withPrefix_(props, 'c:')), tries = withPrefix_(props, 'f:');
  const copied = FILES.filter(function (f) { return done[f[0]]; }).length;
  const running = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'copyBooks'; });
  Logger.log(copied + ' of ' + FILES.length + ' copied; trigger ' + (running ? 'on' : 'off') + '.');
  FILES.forEach(function (f) { if (!done[f[0]] && tries[f[0]]) Logger.log('Failing: ' + f[1] + '/' + f[2] + ' (' + f[0] + '): ' + tries[f[0]]); });
}
function retryFailed() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(withPrefix_(props, 'f:')).forEach(function (id) { props.deleteProperty('f:' + id); });
  Logger.log('Failure counts cleared; run copyBooks.');
}
function stopCopying() {
  unschedule_(PropertiesService.getScriptProperties());
  Logger.log('Trigger removed. Run copyBooks to carry on later; nothing already copied is lost.');
}
`;
}
