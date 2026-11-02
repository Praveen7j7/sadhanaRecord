// Cache for reads. In memory + sessionStorage (per logged-in user).
// A screen shows the saved copy at once. It asks the server again only when the copy is older than MAX_AGE,
// or when the user presses Refresh (force): revisiting a screen within MAX_AGE costs no call at all.
import { call } from './api.js';
import { scopesOf, canRequests } from './scopes.js';
import { idbGet, idbSet, idbDel, idbKeys } from './idb.js';

export const MAX_AGE = 2 * 60 * 1000;

const entries = new Map(); // scoped key -> reactive { data, refreshing, error }
const inflight = new Map();
let scope = '';
const PREFIX = 'sr.c.';

// The master's two lists come from one call (admin.lists) that fills both entries.
function adminLists() {
  return call('admin.lists').then((d) => {
    for (const [key, data] of [['coordinators.list', d.coordinators], ['batches.list', d.batches]]) {
      const e = entry(key); e.data = data; e.at = Date.now(); persist(key, data, e.at);
    }
    return d;
  });
}
export const READS = {
  'requests.list': () => call('requests.list', {}),
  'home.get': () => call('home.get'),
  'announcements.list': () => call('announcements.list'),
  'announcements.reports': () => call('announcements.reports', {}),   // the IYF head's queue of reported posts and comments
  'mutes.list': () => call('mutes.list', {}),                         // people whose comments this person has hidden
  'reopen.list': () => call('reopen.list', {}),
  // asking to start a batch (Phase 23): a coordinator's own requests, or every one waiting for the head
  'batchreq.list': () => call('batchReq.list', {}),
  'birthdays.today': () => call('birthdays.today', {}),
  'profile.get': () => call('profile.get', {}),
  'ids.possibleDuplicates': () => call('ids.possibleDuplicates', {}),
  'coordinators.list': () => sharedLoad('admin.lists', adminLists).then((d) => d.coordinators),
  'batches.list': () => sharedLoad('admin.lists', adminLists).then((d) => d.batches),
};
function sharedLoad(k, fn) {
  const key = sk('#' + k);
  if (!inflight.has(key)) inflight.set(key, fn().finally(() => inflight.delete(key)));
  return inflight.get(key);
}

export function setScope(id) { scope = id || ''; }
const sk = (key) => scope + '|' + key;

function hydrate(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + sk(key));
    const v = raw ? JSON.parse(raw) : undefined;
    return v && typeof v === 'object' && 'at' in v && 'data' in v ? v : v === undefined ? undefined : { at: 0, data: v };
  } catch { return undefined; }
}
function persist(key, data, at = Date.now()) {
  try { sessionStorage.setItem(PREFIX + sk(key), JSON.stringify({ at, data })); } catch { /* storage blocked or full */ }
  if (KEEP.has(key) && scope) idbSet(ik(key), { at, data });
}
// Phase 1: the person's own screens are also kept on the phone between opens (IndexedDB), each under its login, so the
// next open (or an open with no connection) shows them at once. Never shared between people: keyed by login, and every
// kept copy is removed at log-out (clearKept).
const KEEP = new Set(['home.get', 'profile.get']);
const ik = (key) => 'c:' + sk(key);
/** Removes every copy kept between opens (log-out, a session ended by the server). */
export async function clearKept() { for (const k of await idbKeys('c:')) await idbDel(k); }



// Reactive entry for a key (created on first use, filled from sessionStorage if present).
export function entry(key) {
  const k = sk(key);
  let e = entries.get(k);
  if (!e) {
    const h = hydrate(key);
    const fresh = $state({ data: h?.data, at: h?.at || 0, refreshing: false, error: '' });
    entries.set(k, fresh);
    e = fresh;
    // nothing for this tab yet: the copy kept from the last open, if any (shown until the server's answer arrives)
    if (!h && KEEP.has(key) && scope) idbGet(ik(key)).then((v) => { if (v && fresh.data === undefined && entries.get(k) === fresh) { fresh.data = v.data; fresh.at = v.at || 0; } });
  }
  return e;
}

// Fetch in the background; shows cached data meanwhile. Concurrent calls for a key share one request.
// Skipped while the copy is younger than MAX_AGE, unless { force: true } (the Refresh link).
export function load(key, fetcher = READS[key.split(':')[0]], { force = false } = {}) {
  const k = sk(key);
  if (inflight.has(k)) return inflight.get(k);
  const e = entry(key);
  if (!force && e.data !== undefined && Date.now() - e.at < MAX_AGE) return Promise.resolve(e.data);
  e.refreshing = true;
  e.error = '';
  const p = fetcher()
    .then((d) => { e.data = d; e.at = Date.now(); persist(key, d, e.at); return d; })
    .catch((err) => { e.error = err; })
    .finally(() => { e.refreshing = false; inflight.delete(k); });
  inflight.set(k, p);
  return p;
}

// Apply a local change after a write (never refetch).
/** File an answer that came inside a bigger one (home.staff) under its own name, unless a fresher copy is there. */
export function seed(key, data, at = Date.now()) {
  if (data === undefined) return;
  const e = entry(key);
  if (e.data !== undefined && e.at >= at) return;
  e.data = data; e.at = at; e.error = '';
  persist(key, data, at);
}
export function patch(key, fn) {
  const e = entry(key);
  if (e.data === undefined) return;
  e.data = fn(e.data);
  persist(key, e.data, e.at);
}

/** Marks every copy whose key starts with `prefix` as old: the next load fetches again (the copy shows meanwhile).
 *  Used after a write elsewhere changes it, e.g. filling for a devotee changes the batch board (Phase 5). */
export function stale(prefix) { const p = sk(prefix); for (const [k, e] of entries) if (k.startsWith(p)) e.at = 0; }

export function clearAll() {
  for (const e of entries.values()) { e.data = undefined; e.error = ''; }
  entries.clear();
  inflight.clear();
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i));
    for (const k of keys) if (k && k.startsWith(PREFIX)) sessionStorage.removeItem(k);
  } catch { /* ignore */ }
}

// Warm only the screen staff open first (Requests); the admin lists load when first opened.
export function prefetch(user) {
  if (!user || user.mustChangePassword) return;
  const sc = scopesOf(user);
  if (sc.devotee) load('home.get');
  if (canRequests(sc)) load('requests.list');
  if (sc.master) load('reopen.list');                   // the count on the menu's Reopen requests
  if (sc.master) load('batchreq.list');                 // the new batches asked for: the Requests badge (Phase 23)
  if (!sc.devotee) load('announcements.list');          // devotees learn of new posts from home.get; staff-only people ask once
}
