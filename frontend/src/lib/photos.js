// Profile photos: fetched only when shown, kept in memory for the session and in IndexedDB by login + updatedAt.
import { call } from './api.js';
import { idbGet, idbSet, idbDel } from './idb.js';

const mem = new Map();        // login -> { updatedAt, b64 }; at most MEM_MAX kept (oldest dropped), the rest stay in IndexedDB
const MEM_MAX = 60;
const remember = (login, v) => { mem.delete(login); mem.set(login, v); if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value); };
const inflight = new Map();
const key = (login) => 'photo:' + login;
export const photoSrc = (b64) => (b64 ? 'data:image/jpeg;base64,' + b64 : '');

/** The stored copy (may be old) to show at once while the current one is fetched. */
export async function peekPhoto(login) {
  const m = mem.get(login) || (await idbGet(key(login)));
  return m ? photoSrc(m.b64) : '';
}

/**
 * The photo as a data: URL. own: the caller's own photo (photo.get {}). updatedAt known (own photo): the stored copy
 * is used when it matches, so no call at all. Unknown (someone else's): one call per session.
 */
export function getPhoto(login, { own = false, updatedAt = null } = {}) {
  const m = mem.get(login);
  if (m && (!updatedAt || m.updatedAt === updatedAt)) return Promise.resolve(photoSrc(m.b64));
  if (!inflight.has(login)) {
    inflight.set(login, (async () => {
      const stored = await idbGet(key(login));
      if (stored && updatedAt && stored.updatedAt === updatedAt) { remember(login, stored); return photoSrc(stored.b64); }
      const r = await call('photo.get', own ? {} : { login });
      const v = { updatedAt: r.updatedAt, b64: r.jpegBase64 };
      remember(login, v);
      idbSet(key(login), v);
      return photoSrc(v.b64);
    })().finally(() => inflight.delete(login)));
  }
  return inflight.get(login);
}

export function putPhoto(login, b64, updatedAt) {
  const v = { updatedAt, b64 };
  remember(login, v);
  return idbSet(key(login), v);
}
export function forgetPhoto(login) {
  mem.delete(login);
  return idbDel(key(login));
}
