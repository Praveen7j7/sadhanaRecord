// A tiny key-value wrapper over IndexedDB (one store). Falls back to memory when IndexedDB is unavailable,
// so nothing here ever throws. Used for the unsent day changes and the journal list.
const mem = new Map();
let dbp;

function open() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbp ||= new Promise((resolve) => {
    try {
      const r = indexedDB.open('sr', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = r.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
function tx(db, mode, fn, wantOk = false) {
  return new Promise((resolve) => {
    try {
      const t = db.transaction('kv', mode);
      const r = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(wantOk ? true : (r && 'result' in r ? r.result : undefined));
      t.onerror = t.onabort = () => resolve(wantOk ? false : undefined);
    } catch { resolve(wantOk ? false : undefined); }
  });
}
const plain = (v) => JSON.parse(JSON.stringify(v));

export async function idbGet(key) {
  const db = await open();
  return db ? tx(db, 'readonly', (s) => s.get(key)) : mem.get(key);
}
/** True when the value is stored. False means it is NOT on the phone — a full disk, private mode, a blocked store
 *  (13 Oct 2026, audit FE-12). It used to fail silently, so an unsent day could vanish without a word. */
export async function idbSet(key, value) {
  const v = plain(value);
  const db = await open();
  if (!db) { mem.set(key, v); return true; }                 // no IndexedDB at all: memory is the honest best here
  const ok = await tx(db, 'readwrite', (s) => s.put(v, key), true);
  if (!ok) mem.set(key, v);                                  // keep it for this tab at least
  return ok;
}
export async function idbDel(key) {
  const db = await open();
  if (!db) mem.delete(key); else await tx(db, 'readwrite', (s) => s.delete(key));
}
export async function idbKeys(prefix = '') {
  const db = await open();
  if (!db) return [...mem.keys()].filter((k) => k.startsWith(prefix));
  const all = (await tx(db, 'readonly', (s) => s.getAllKeys())) || [];
  return all.filter((k) => typeof k === 'string' && k.startsWith(prefix));
}
