// Lectures to the head's own Drive (27 Oct 2026, the head): copy the lecture audio the app links to into a free Google
// account, a WHOLE journal at a time, so that every batch hears from one account only ("cover a complete batch on one
// account, instead of depending on two"). A journal is the unit: each batch follows exactly one (batches.hearing_journal).
//
//   1. node tools/lectures/make-copy-script.mjs   (reads live D1 read-only + Drive metadata as the read-only SA)
//      node tools/lectures/make-copy-script.mjs --skip "SPS/DPS"   (the next account's script: journals done elsewhere)
//      node tools/lectures/make-copy-script.mjs --from-manifest [--skip …]   (rebuild Code.gs from out/manifest.json)
//      … --only "SPS/DPS,VL3"   (a script that copies only these journals; the head, 27 Oct: SPS and VL3 first)
//   2. paste tools/lectures/out/Code.gs into a NEW Apps Script project of the account, run plan, then copyLectures
//   3. a relink migration points lectures.audio_url and lectures.link at the copies (lecture-links.json)
//
// The script reads the account's free space when it runs and takes only the journals that fit completely, keeping
// RESERVE free for mail and photos. A folder link copies the whole folder (the app opens the folder); a file both linked
// and inside a linked folder is copied once, into that folder. Nothing in the app changes until step 3.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { token, SA_EMAIL } from '../../setup/sa.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
const ROOT_NAME_DEFAULT = 'Sadhana Record lectures';
export const ORDER = ['SPS/DPS', 'VL3', 'BSS', 'BVS'];     // the journal most batches follow first; VL3 is small
// VL3 has no journal in the app yet: its lectures come from the head's workbook (tools/lectures/vl3-journal.json, 27 Oct)
const VL3 = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vl3-journal.json'), 'utf8'));
export const idOf = (url) => (/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})|folders\/([\w-]{20,})/.exec(url || '') || []).slice(1).find(Boolean) || '';
const d1 = (sql) => JSON.parse(execFileSync('npx', ['--no-install', 'wrangler', 'd1', 'execute', 'sadhana', '--remote', '--json', '--command', sql],
  { cwd: join(HERE, '../../worker'), encoding: 'utf8', maxBuffer: 64 << 20 }))[0].results;
export const lectureRows = () => d1('SELECT lecture_id, journal, audio_url, link FROM lectures');

async function api(path) {
  for (let t = 0; ; t++) {
    const r = await fetch('https://www.googleapis.com/drive/v3/' + path, { headers: { authorization: 'Bearer ' + await token() } });
    if (r.ok) return r.json();
    if (t > 4 || r.status === 404 || r.status === 403) throw new Error(`${r.status} ${path.split('?')[0]}`);
    await new Promise((s) => setTimeout(s, 2000 * (t + 1)));
  }
}

async function build() {
  const rows = lectureRows().concat(VL3.lectures.map((l) => ({ lecture_id: `VL3-W${l.week}-${l.slot}`, journal: 'VL3', audio_url: l.url, link: '' })));
  const batches = d1('SELECT batch_id, level, hearing_journal FROM batches WHERE active = 1');
  const meta = {}, children = {};
  const m = async (id) => (meta[id] ||= await api(`files/${id}?supportsAllDrives=true&fields=id,name,mimeType,size`));
  const kids = async (id) => {
    if (children[id]) return children[id];
    let out = [], pt = '';
    do {
      const j = await api(`files?q=${encodeURIComponent(`'${id}' in parents and trashed = false`)}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=nextPageToken,files(id,name,mimeType,size)${pt ? '&pageToken=' + pt : ''}`);
      for (const f of j.files) meta[f.id] ||= f;
      out = out.concat(j.files.map((f) => f.id)); pt = j.nextPageToken || '';
    } while (pt);
    return (children[id] = out);
  };
  const isFolder = (id) => meta[id].mimeType === 'application/vnd.google-apps.folder';
  const units = [];
  for (const key of ORDER) {
    const linked = new Set(), direct = new Set();
    for (const r of rows.filter((x) => x.journal === key))
      for (const u of [r.audio_url, r.link]) {
        if (!/drive\.google\.com/.test(u || '')) continue;
        const id = idOf(u); if (!id) throw new Error(`no Drive id in ${r.lecture_id}: ${u}`);
        (isFolder((await m(id)).id) ? linked : direct).add(id);
      }
    // the folder tree: every linked folder and everything under it; a linked folder inside another one stays its child
    const nodes = [], at = {}, files = [], placed = new Set();
    const add = async (fid, parent) => {
      if (fid in at) return;
      at[fid] = nodes.length; nodes.push([fid, meta[fid].name, parent]);
      for (const c of await kids(fid)) {
        if (isFolder(c)) await add(c, at[fid]);
        else { files.push([c, +(meta[c].size || 0), at[fid]]); placed.add(c); }
      }
    };
    // linked folders that sit inside another linked folder are reached from it, as its children
    for (const f of linked) await kids(f);
    for (const f of linked) if (!isNestedIn(f, linked, children)) await add(f, -1);
    for (const f of linked) if (!(f in at)) await add(f, -1);
    for (const id of direct) if (!placed.has(id)) { files.push([id, +(meta[id].size || 0), -1]); placed.add(id); }
    const bytes = [...new Map(files.map((f) => [f[0], f[1]])).values()].reduce((a, b) => a + b, 0);
    units.push({ key, dir: key.replace(/\//g, '-'), batches: batches.filter((b) => b.hearing_journal === key || (key === 'VL3' && b.level === 'VL3')).map((b) => b.batch_id).join(', '),
      bytes, folders: nodes, files });
  }
  return units;
}
function isNestedIn(f, linked, children) {
  for (const g of linked) if (g !== f && reach(g, f, children, new Set())) return true;
  return false;
}
function reach(from, to, children, seen) {
  if (seen.has(from)) return false; seen.add(from);
  for (const c of children[from] || []) if (c === to || reach(c, to, children, seen)) return true;
  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const skipAt = process.argv.indexOf('--skip'), skip = skipAt > 0 ? process.argv[skipAt + 1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  for (const s of skip) if (!ORDER.includes(s)) throw new Error(`--skip: unknown journal ${s}`);
  const onlyAt = process.argv.indexOf('--only'), only = onlyAt > 0 ? process.argv[onlyAt + 1].split(',').map((x) => x.trim()).filter(Boolean) : [];
  for (const s of only) if (!ORDER.includes(s)) throw new Error(`--only: unknown journal ${s}`);
  const all = process.argv.includes('--from-manifest') ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : await build();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(all));
  const units = only.length ? all.filter((u) => only.includes(u.key)) : all;
  writeFileSync(join(OUT, 'Code.gs'), gas(units, skip));
  for (const u of units) console.log(`${u.key}: ${u.files.length} files, ${u.folders.length} folders, ${(u.bytes / 1e9).toFixed(2)} GB (batches ${u.batches})`);
  console.log(`→ ${join(OUT, 'Code.gs')}${skip.length ? ' (skips ' + skip.join(', ') + ')' : ''}`);
}

export function gas(units, skip = []) {
  return `// Copies the Sadhana Record app's lecture audio into THIS Google account, a whole journal at a time.
// Each batch follows one journal (SPS/DPS: SPS, SPS2, SPSO, DPS, TRD · VL3 · BSS · BVS), so a journal copied whole means
// every batch hears from one account only. The script reads this account's free space and takes, in order, only the
// journals that fit completely, leaving RESERVE_BYTES free for mail and photos. Journals that do not fit are left for
// the next account (its script lists the done ones in SKIP_UNITS).
// Use a NEW Apps Script project, signed in as the account that will hold the lectures:
//   1. Run ▸ plan          shows the free space and which journals fit; copies nothing
//   2. Run ▸ copyLectures  once; a trigger then runs it every EVERY_MINUTES minutes until the chosen journals are done
// Each journal gets its OWN folder in My Drive, "${ROOT_NAME_DEFAULT} · <journal>" (for example "· SPS-DPS", "· VL3"),
// set to "Anyone with the link · Viewer" with each copy. The original files are never touched. Each journal folder holds
// its own lecture-links.json (original id → copy id, for its files and folders) for the app's relink step, and is
// shared read-only with the build service account (${SA_EMAIL}) so the relink can read it.
// This script copies: ${units.map((u) => u.key).join(', ')}.
// Same safety as the books script: a lock (no two runs at once), each copy recorded the moment it is made, a cut-off
// run's copy recognised and reused, Google rate limits waited out, a full Drive stops the job instead of looping.
// Helpers: status, retryFailed, stopCopying.
// Generated by tools/lectures/make-copy-script.mjs on ${new Date().toISOString().slice(0, 10)} · ${units.map((u) => u.key + ' ' + (u.bytes / 1e9).toFixed(2) + ' GB').join(' · ')}.
const ROOT_NAME = '${ROOT_NAME_DEFAULT}';
const SA = '${SA_EMAIL}';
const UNITS = ${JSON.stringify(units.map(({ key, dir, batches, bytes, folders, files }) => ({ key, dir, batches, bytes, folders, files })))};
const SKIP_UNITS = ${JSON.stringify(skip)};   // journals already copied into another account

const BATCH_SIZE = 60;                          // files per run (lecture files are larger than books)
const TIME_BUDGET_MS = 4 * 60 * 1000;           // no new copy starts after 4 minutes (Google stops a run at 6)
const EVERY_MINUTES = 5;                        // the recurring trigger
const SAVE_EVERY = 10;                          // rewrite lecture-links.json every 10 copies, and at the end of a run
const MAX_TRIES = 3;                            // a file that fails 3 runs (not a rate limit) is given up
const RESERVE_BYTES = 500 * 1024 * 1024;        // left free in the account for mail and photos
const TAG = 'Sadhana Record lecture · copy of ';

// ---------- planning ----------
function plan() {
  const props = PropertiesService.getScriptProperties(), st = state_(props);
  const free = freeBytes_();
  Logger.log('Account ' + Session.getEffectiveUser().getEmail() + ': ' + gb_(free) + ' free (' + gb_(RESERVE_BYTES) + ' kept in reserve).');
  let room = free - RESERVE_BYTES;
  const pl = { keys: {}, orig: {} };
  UNITS.forEach(function (u) { if (props.getProperty('unit:' + u.key) === 'claimed') { room -= remaining_(u, st, pl); addPlan_(u, pl); } });
  UNITS.forEach(function (u) {
    const s = props.getProperty('unit:' + u.key), need = remaining_(u, st, pl);
    if (SKIP_UNITS.indexOf(u.key) >= 0) { Logger.log(u.key + ': copied into another account, skipped.'); return; }
    if (s === 'done') { Logger.log(u.key + ': done here.'); return; }
    if (s === 'claimed') { Logger.log(u.key + ': being copied here, ' + gb_(remaining_(u, st)) + ' to go.'); return; }
    if (need <= room) { room -= need; addPlan_(u, pl); Logger.log(u.key + ' (batches ' + u.batches + '): ' + gb_(need) + ': FITS, copyLectures will take it.'); }
    else Logger.log(u.key + ' (batches ' + u.batches + '): ' + gb_(need) + ': does not fit (' + gb_(Math.max(room, 0)) + ' room): left for the next account.');
  });
}
function freeBytes_() {
  const limit = DriveApp.getStorageLimit(), used = DriveApp.getStorageUsed();
  return limit < 0 ? Number.MAX_SAFE_INTEGER : limit - used;
}
function gb_(b) { return (b / 1e9).toFixed(2) + ' GB'; }
// claims the journals that fit whole, in order; a claimed journal is finished even as the free space shrinks
function claim_(props, st) {
  let room = freeBytes_() - RESERVE_BYTES;
  const pl = { keys: {}, orig: {} };   // files an earlier journal will copy anyway: counted once
  UNITS.forEach(function (u) { if (props.getProperty('unit:' + u.key) === 'claimed') { room -= remaining_(u, st, pl); addPlan_(u, pl); } });
  UNITS.forEach(function (u) {
    if (SKIP_UNITS.indexOf(u.key) >= 0 || props.getProperty('unit:' + u.key)) return;
    const need = remaining_(u, st, pl);
    if (need <= room) { props.setProperty('unit:' + u.key, 'claimed'); room -= need; addPlan_(u, pl); Logger.log('Taking ' + u.key + ' (' + gb_(need) + ').'); }
  });
}
function remaining_(u, st, pl) {
  let b = 0;
  u.files.forEach(function (f) { if (!have_(u, f, st) && !(pl && (pl.keys[key_(u, f)] || (f[2] < 0 && pl.orig[f[0]])))) b += f[1]; });
  return b;
}
function addPlan_(u, pl) { u.files.forEach(function (f) { pl.keys[key_(u, f)] = 1; pl.orig[f[0]] = 1; }); }
// a file in a folder needs its own copy in that folder; a file linked on its own can use any copy already made here
function key_(u, f) { return f[2] >= 0 ? f[0] + '@' + u.folders[f[2]][0] : f[0] + '@'; }
function have_(u, f, st) { return !!(st.done[key_(u, f)] || (f[2] < 0 && st.any[f[0]])); }

// ---------- copying ----------
function copyLectures() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { Logger.log('Another run is still copying; this one exits.'); return; }
  const start = Date.now(), props = PropertiesService.getScriptProperties();
  try {
    schedule_(props);
    const st = state_(props);
    claim_(props, st);
    let copied = 0, unsaved = 0, stop = '';
    outer: for (let ui = 0; ui < UNITS.length; ui++) {
      const u = UNITS[ui];
      if (props.getProperty('unit:' + u.key) !== 'claimed') continue;
      for (let fi = 0; fi < u.files.length; fi++) {
        const f = u.files[fi], k = key_(u, f);
        if (have_(u, f, st) || parseInt(st.tries[k] || '0', 10) >= MAX_TRIES) continue;
        if (copied >= BATCH_SIZE) { stop = 'batch of ' + BATCH_SIZE + ' done'; break outer; }
        if (Date.now() - start > TIME_BUDGET_MS) { stop = 'time budget used'; break outer; }
        try {
          const id = withRetry_(function () { return copyOne_(props, u, f); });
          st.done[k] = id; st.any[f[0]] = st.any[f[0]] || id; copied++;
          props.setProperty('c:' + k, id);
          if (st.tries[k]) { props.deleteProperty('f:' + k); delete st.tries[k]; }
          if (++unsaved >= SAVE_EVERY) { save_(props, st); unsaved = 0; }
        } catch (e) {
          const msg = String(e && e.message || e);
          if (isFull_(msg)) { save_(props, st); unschedule_(props); Logger.log('This Google account is out of storage (' + msg + '). Stopped and removed the trigger: free some space, then run plan and copyLectures.'); return; }
          if (isLimit_(msg) || isTransient_(msg)) { stop = 'Google said: ' + msg; break outer; }
          const n = parseInt(st.tries[k] || '0', 10) + 1;
          st.tries[k] = n + ' · ' + msg.slice(0, 300); props.setProperty('f:' + k, st.tries[k]);
          Logger.log('Could not copy ' + f[0] + ' (' + u.key + '), try ' + n + ' of ' + MAX_TRIES + ': ' + msg);
        }
      }
      if (remainingCount_(u, st) === 0) { props.setProperty('unit:' + u.key, 'done'); Logger.log(u.key + ' is complete in this account.'); }
    }
    UNITS.forEach(function (u) { if (props.getProperty('unit:' + u.key) === 'claimed' && remainingCount_(u, st) === 0) props.setProperty('unit:' + u.key, 'done'); });
    save_(props, st);
    const busy = UNITS.filter(function (u) { return props.getProperty('unit:' + u.key) === 'claimed'; });
    if (!busy.length) {
      unschedule_(props);
      const done = UNITS.filter(function (u) { return props.getProperty('unit:' + u.key) === 'done'; }).map(function (u) { return u.key; });
      const rest = UNITS.filter(function (u) { return !props.getProperty('unit:' + u.key) && SKIP_UNITS.indexOf(u.key) < 0; }).map(function (u) { return u.key + ' ' + gb_(u.bytes); });
      Logger.log('Finished. Complete in this account: ' + (done.join(', ') || 'none') + '.' + (rest.length ? ' Not enough space for: ' + rest.join(', ') + ' (next account).' : '') + givenUp_(st));
    } else {
      Logger.log('This run copied ' + copied + ' (' + stop + '). Still copying: ' + busy.map(function (u) { return u.key + ' ' + gb_(remaining_(u, st)) + ' to go'; }).join(', ') + '; the trigger carries on within ' + EVERY_MINUTES + ' minutes.');
    }
  } finally {
    lock.releaseLock();
  }
}
function remainingCount_(u, st) {
  let n = 0;
  u.files.forEach(function (f) { if (!have_(u, f, st) && parseInt(st.tries[key_(u, f)] || '0', 10) < MAX_TRIES) n++; });
  return n;
}
function givenUp_(st) {
  const k = Object.keys(st.tries).filter(function (x) { return parseInt(st.tries[x], 10) >= MAX_TRIES; });
  return k.length ? ' Given up on ' + k.length + ' files (run status for the reasons, retryFailed to try again).' : '';
}

function copyOne_(props, u, f) {
  const into = folderFor_(props, u, f[2]);
  const orig = DriveApp.getFileById(f[0]), name = orig.getName();
  let copy = existingCopy_(into, name, f[0], f[1]);
  if (!copy) { copy = orig.makeCopy(name, into); copy.setDescription(TAG + f[0]); }
  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return copy.getId();
}
function existingCopy_(into, name, id, size) {
  let untagged = null;
  const it = into.getFilesByName(name);
  while (it.hasNext()) {
    const x = it.next();
    if (x.isTrashed()) continue;
    const d = x.getDescription() || '';
    if (d === TAG + id) return x;
    if (!d && !untagged && x.getSize() === size) untagged = x;
  }
  if (untagged) { untagged.setDescription(TAG + id); return untagged; }
  return null;
}

// The copy of a folder (made once per account, whichever journal reaches it first); -1 is the journal's "Lectures".
function folderFor_(props, u, idx) {
  if (idx < 0) return named_(props, unitFolder_(props, u), 'Lectures', 'L:' + u.key);
  const node = u.folders[idx], orig = node[0], known = props.getProperty('d:' + orig);
  if (known) { try { const f = DriveApp.getFolderById(known); if (!f.isTrashed()) return f; } catch (e) { /* made again below */ } }
  const parent = node[2] < 0 ? unitFolder_(props, u) : folderFor_(props, u, node[2]);
  const f = parent.createFolder(node[1]);
  f.setDescription(TAG + orig);
  props.setProperty('d:' + orig, f.getId());
  return f;
}
// the journal's own folder at the top of My Drive, shared by link and with the service account
function unitFolder_(props, u) {
  const key = 'U:' + u.key, had = props.getProperty(key);
  const f = named_(props, DriveApp.getRootFolder(), ROOT_NAME + ' · ' + u.dir, key);
  if (had !== f.getId()) {
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    f.setDescription('Sadhana Record lectures for ' + u.key + ' (batches ' + u.batches + ')');
    try { f.addViewer(SA); } catch (e) { Logger.log('Could not share ' + f.getName() + ' with ' + SA + ' (' + e.message + '); the relink step needs it: share it by hand, Viewer.'); }
  }
  return f;
}
function named_(props, parent, name, key) {
  const known = props.getProperty(key);
  if (known) { try { const f = DriveApp.getFolderById(known); if (!f.isTrashed()) return f; } catch (e) { /* found or made below */ } }
  const it = parent.getFoldersByName(name);
  let f = null;
  while (it.hasNext()) { const g = it.next(); if (!g.isTrashed()) { f = g; break; } }
  f = f || parent.createFolder(name);
  props.setProperty(key, f.getId());
  return f;
}
// ---------- state ----------
function state_(props) {
  const all = props.getProperties(), st = { done: {}, any: {}, tries: {} };
  for (const k in all) {
    if (k.indexOf('c:') === 0) { const key = k.slice(2); st.done[key] = all[k]; const orig = key.split('@')[0]; st.any[orig] = st.any[orig] || all[k]; }
    else if (k.indexOf('f:') === 0) st.tries[k.slice(2)] = all[k];
  }
  return st;
}
function save_(props, st) {
  UNITS.forEach(function (u) {
    const state = props.getProperty('unit:' + u.key);
    if (state !== 'claimed' && state !== 'done') return;
    const files = {}, folders = {};
    u.files.forEach(function (f) { const c = st.done[key_(u, f)] || st.any[f[0]]; if (c) files[f[0]] = c; });
    u.folders.forEach(function (n) { const c = props.getProperty('d:' + n[0]); if (c) folders[n[0]] = c; });
    const body = JSON.stringify({ account: Session.getEffectiveUser().getEmail(), journal: u.key, batches: u.batches, state: state,
      updated: new Date().toISOString(), files: files, folders: folders }, null, 1);
    const root = unitFolder_(props, u), it = root.getFilesByName('lecture-links.json');
    let f = null;
    while (it.hasNext()) { const g = it.next(); if (!g.isTrashed()) { f = g; break; } }
    if (f) f.setContent(body); else root.createFile('lecture-links.json', body, 'application/json');
  });
}

// ---------- Google errors ----------
function withRetry_(fn) {
  for (let i = 0; ; i++) {
    try { return fn(); } catch (e) {
      const msg = String(e && e.message || e);
      if (i >= 3 || isFull_(msg) || isDaily_(msg) || !(isLimit_(msg) || isTransient_(msg))) throw e;
      Utilities.sleep(2000 * Math.pow(2, i));
    }
  }
}
function isFull_(msg) { return /storage quota|storage limit|insufficient storage|out of storage|storagequotaexceeded/i.test(msg); }
function isDaily_(msg) { return /for one day|daily/i.test(msg); }
function isLimit_(msg) { return /too many times|rate limit|ratelimit|quota|limit exceeded|too many requests/i.test(msg); }
function isTransient_(msg) { return /server error|internal error|backend error|service error|timed out|timeout|try again|temporarily|unavailable/i.test(msg); }

// ---------- trigger + helpers ----------
function schedule_(props) {
  const mine = props.getProperty('triggerId'), all = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'copyLectures'; });
  if (mine && all.length === 1 && all[0].getUniqueId() === mine) return;
  all.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  props.setProperty('triggerId', ScriptApp.newTrigger('copyLectures').timeBased().everyMinutes(EVERY_MINUTES).create().getUniqueId());
}
function unschedule_(props) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'copyLectures') ScriptApp.deleteTrigger(t); });
  props.deleteProperty('triggerId');
}
function status() {
  const props = PropertiesService.getScriptProperties(), st = state_(props);
  UNITS.forEach(function (u) {
    const total = u.files.length, have = u.files.filter(function (f) { return have_(u, f, st); }).length;
    Logger.log(u.key + ': ' + (props.getProperty('unit:' + u.key) || (SKIP_UNITS.indexOf(u.key) >= 0 ? 'other account' : 'not taken')) + ', ' + have + ' of ' + total + ' files, ' + gb_(remaining_(u, st)) + ' to go.');
  });
  Logger.log('Free: ' + gb_(freeBytes_()) + '; trigger ' + (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'copyLectures'; }) ? 'on' : 'off') + '.');
  Object.keys(st.tries).forEach(function (k) { Logger.log('Failing: ' + k + ': ' + st.tries[k]); });
}
function retryFailed() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(state_(props).tries).forEach(function (k) { props.deleteProperty('f:' + k); });
  Logger.log('Failure counts cleared; run copyLectures.');
}
function stopCopying() {
  unschedule_(PropertiesService.getScriptProperties());
  Logger.log('Trigger removed. Run copyLectures to carry on later; nothing already copied is lost.');
}
`;
}
