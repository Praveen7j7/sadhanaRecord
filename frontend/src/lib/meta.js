// The public lists (batches, the canonical facilitators, the two class days) and the submit window: the last
// copy at once, refreshed from the server once per page load. Shared by sign-up, the coordinator's approval
// card, and every screen that tells a devotee when they can submit.
import { call } from './api.js';
import { windowWords } from '$shared/window.js';
import { metaRaw, metaChanged } from './metastore.svelte.js';
let fresh = null;
/** The last copy of the lists. Reactive (lib/metastore.svelte.js): a screen drawing from it redraws when a fresh copy lands. */
export function cachedMeta() {
  try { return JSON.parse(metaRaw()); } catch { return {}; }
}
export function loadMeta() {
  fresh ||= call('meta.get').then((d) => {
    // submitWindow is kept too: it is a master setting, and every message about it must say the time that is set;
    // `v` is the version of the names in it (Phase 24), compared on every start with the one auth.me / home.get carry
    try { localStorage.setItem('sr.meta', JSON.stringify({ batches: d.batches || [], staffBatches: d.staffBatches || null, facilitators: d.facilitators || [], classDays: d.classDays || [], push: d.push || null, submitWindow: d.submitWindow || null, v: d.version ?? null })); } catch { /* storage blocked */ }
    metaChanged();
    return d;
  }).catch((e) => { fresh = null; throw e; });
  return fresh;
}
/**
 * The names on this phone are fresh on every start, at no extra call (Phase 24, one name, one place): auth.me and
 * home.get — the calls a start makes anyway — carry `versions.names`, which moves whenever a facilitator or a batch
 * name changes on the server. Only when it differs from the copy's is meta.get asked, once; every screen reading
 * cachedMeta() then redraws with the new names.
 */
export function namesVersion(v) {
  if (v == null || String(cachedMeta().v ?? '') === String(v)) return;
  // after the start's own calls (a tick later): the lists never hold up the screen the person opened
  setTimeout(() => refreshMeta().catch(() => {}), 0);
}
/**
 * Every batch a staff caller may work in, trainings included.
 *
 * `batches` is the SIGN-UP list and leaves trainings out on purpose: nobody signs up into an ETP
 * batch, its coordinator enrols existing devotees. But the staff screens were reading that same
 * list to answer "which batches do I run", so a training was invisible to the one person meant to
 * run it and its Students tab never appeared (the head, 17 Oct 2026).
 *
 * The server sends `staffBatches` only to a signed-in caller; falling back to `batches` keeps a
 * devotee, and a staff member on an old cached copy, exactly where they were.
 */
export function staffBatches(m) {
  const d = m || cachedMeta();
  return d.staffBatches || d.batches || [];
}

/** After the master changes a list (facilitators, batches): fetch it again, so this page offers the new list at once. */
export function refreshMeta() { fresh = null; return loadMeta(); }

/**
 * The words for the submit window, from whatever copy of meta this page holds.
 *
 * Before this, screens said "Sunday 6 PM" and "Monday 9 PM" as literal text while the server enforced the
 * master setting, so moving the window to Sunday 2 PM changed the lock and not one word of what devotees
 * were told. Any screen that mentions the window asks here instead.
 *
 * Falls back to the shipped default when meta has not arrived yet (first load, offline), which is the same
 * default the server uses, so the wording is never blank.
 */
export function windowSay() {
  return windowWords(cachedMeta().submitWindow || {});
}
