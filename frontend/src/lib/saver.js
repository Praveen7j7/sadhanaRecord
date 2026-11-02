// One day's answers: kept on the phone as they are typed, sent only when the devotee taps Save.
// The phone keeps ONE draft per day (IndexedDB key q:<login>:<weekId>:<date>), overwritten on every change and removed
// once a Save succeeds or the answers are back to the saved copy. A Save sends only the fields that differ from the
// last saved copy, with that copy's version; the server keeps one entry per day (version + 1).
import { call, ApiError, fieldErrors } from './api.js';
import { idbGet, idbSet, idbDel, idbKeys } from './idb.js';
import { applyPatch } from './daylogic.js';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const queueKey = (login, weekId, date) => `q:${login}:${weekId}:${date}`;

/** The fields of `day` that differ from `saved` (a field removed is sent as null). Empty = nothing to save. */
export function diffDay(saved = {}, day = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(saved), ...Object.keys(day)])) {
    if (k === 'v') continue;
    const a = saved[k] ?? null, b = day[k] ?? null;
    if (!same(a, b)) out[k] = b;
  }
  return out;
}

/**
 * status: 'saved' (nothing to send) | 'dirty' | 'saving' | 'offline' (not sent: no connection) | 'error'
 * onSaved(reply, sent, {weekId, date}) · onStale(current, {weekId, date}) · onRejected(fieldMap, error)
 * onBehalfOf: a coordinator filling a devotee's day (then `login` is the draft owner key "<coordinator>>for:<devotee>")
 */
export function createSaver({ login, weekId, date, version, saved = {}, local = null, onBehalfOf = undefined, onStatus, onNoStore, onSaved, onStale, onRejected }) {
  let ver = version, base = { ...saved }, cur = { ...(local || saved) }, inflight = false, dead = false, sending = null;
  const qkey = queueKey(login, weekId, date);
  const pending = () => diffDay(base, cur);
  const dirty = () => Object.keys(pending()).length > 0;
  const status = (s, info) => onStatus && !dead && onStatus(s, info);
  // the one local draft of this day: written over on every change, gone when nothing differs from the saved copy
  // pressed: Save was tapped while offline, so the phone sends it by itself once back online (8 Oct 2026). A later change
  // clears it: only what the person chose to save is ever sent.
  // Says so ONCE if the phone will not keep the draft (13 Oct 2026, audit FE-12): a failed IndexedDB write used to
  // be silent, so a day filled offline could disappear with nothing shown. The day itself is still in memory and
  // still sends when the connection returns — this only stops the person trusting a phone that cannot hold it.
  let warned = false;
  const kept = (ok) => { if (!ok && !warned) { warned = true; onNoStore && !dead && onNoStore(); } return ok; };
  const persist = (pressed = false) => (dirty()
    ? Promise.resolve(idbSet(qkey, { weekId, date, version: ver, patch: pending(), ...(pressed ? { pressed: true, onBehalfOf } : {}) })).then(kept)
    : idbDel(qkey));

  async function save() {
    if (dead || inflight || !dirty()) return;
    const sent = pending();
    inflight = true; sending = sent;
    status('saving');
    try {
      const r = await call('week.saveDay', { weekId, date, version: ver, day: sent, ...(onBehalfOf ? { onBehalfOf } : {}) });
      ver = r.version;
      base = applyPatch(base, sent);
      await persist();
      onSaved && onSaved(r, sent, { weekId, date });
      status(dirty() ? 'dirty' : 'saved');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'NETWORK';
      if (code === 'STALE') {                    // changed on another device: theirs is shown, ours is dropped
        const c = e.data?.current || { v: 0 };
        const { v, ...day } = c;
        ver = v || 0; base = { ...day }; cur = { ...day };
        await persist();
        onStale && onStale(c, { weekId, date });
        status('saved');
      } else if (code === 'NETWORK' || code === 'BUSY' || code === 'INTERNAL') {
        await persist(true);                     // the local copy stays, marked to send by itself once back online
        status('offline');
      } else if (code === 'VALIDATION') {
        onRejected && onRejected(fieldErrors(e), e);
        status('error', e);
      } else {                                   // closed week, already submitted, future day …: it can never be sent
        await idbDel(qkey);
        onRejected && onRejected({}, e);
        status('error', e);
      }
    } finally {
      inflight = false; sending = null;
    }
  }
  /* B2 (22 Oct 2026): what is NOT on its way — the answers differ from the saved copy plus the save in flight. The form
     shows "Saved ✓" the moment Save is tapped and lets the person leave, since leaving loses nothing once the answers are
     sent; an answer changed after the tap is still unsent and still holds them. */
  const unsent = () => Object.keys(diffDay(sending ? applyPatch(base, sending) : base, cur)).length > 0;

  return {
    /** A field changed (null clears it). */
    change(patch) {
      cur = applyPatch(cur, patch);
      status(dirty() ? 'dirty' : 'saved');
      return persist();
    },
    save,
    /** Back to the saved copy; the local draft is removed. */
    discard() { cur = { ...base }; status('saved'); return idbDel(qkey).then(() => ({ ...base })); },
    dirty,
    unsent,
    /** A Save is on its way to the server. */
    saving: () => inflight,
    pending,
    version: () => ver,
    saved: () => ({ ...base }),
    destroy() { dead = true; },
  };
}

/** The local draft of one day (changes not saved yet), if any. */
export const loadQueued = (login, weekId, date) => idbGet(queueKey(login, weekId, date));

/** Days with a local draft that was never saved: [{ weekId, date, pressed }] (Home: "Waiting to send" or "Not saved yet"). */
export async function queuedDays(login) {
  const out = [];
  for (const key of await idbKeys(`q:${login}:`)) {
    const q = await idbGet(key);
    if (q && q.patch && Object.keys(q.patch).length) out.push({ weekId: q.weekId, date: q.date, pressed: !!q.pressed });
    else await idbDel(key);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Sends the days whose Save was tapped while offline (pressed drafts), oldest first. Returns how many were sent.
 * A day changed on another device meanwhile keeps that version (the draft is dropped, as a Save would); a day that can
 * no longer be sent (closed week, …) loses its "pressed" mark and stays on Home as "Not saved yet". Stops at no connection.
 */
export async function sendPressed(login) {
  let sent = 0;
  for (const key of (await idbKeys(`q:${login}:`)).sort()) {
    const q = await idbGet(key);
    if (!q?.pressed || !q.patch || !Object.keys(q.patch).length) continue;
    try {
      await call('week.saveDay', { weekId: q.weekId, date: q.date, version: q.version, day: q.patch, ...(q.onBehalfOf ? { onBehalfOf: q.onBehalfOf } : {}) });
      await idbDel(key); sent++;
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'NETWORK';
      if (code === 'NETWORK' || code === 'BUSY' || code === 'INTERNAL') break;
      if (code === 'STALE') await idbDel(key);
      else await idbSet(key, { ...q, pressed: false });
    }
  }
  return sent;
}
