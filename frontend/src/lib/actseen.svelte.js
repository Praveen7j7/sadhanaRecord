// The last activity notice a staff member has seen (Phase 23, ADR 0020): kept on this device only, like the wall's
// "seen" mark (ann.svelte.js). The bell counts the notices after it; Home's notices card moves it on when shown.
export const actSeen = $state({ id: 0, login: '' });
const key = (l) => 'sr.actseen.' + l;
/** Call from an $effect (never inside a $derived): loads this person's mark once. */
export function initActSeen(login) {
  if (!login || actSeen.login === login) return;
  actSeen.login = login;
  try { actSeen.id = Number(localStorage.getItem(key(login)) || 0) || 0; } catch { actSeen.id = 0; }
}
export function markActSeen(id) {
  if (!actSeen.login || !id || id <= actSeen.id) return;
  actSeen.id = id;
  try { localStorage.setItem(key(actSeen.login), String(id)); } catch { /* storage blocked */ }
}
/** How many notices are newer than the mark. */
export const unseenOf = (events) => (events || []).filter((e) => e.id > actSeen.id).length;
