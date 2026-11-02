// When this person last opened the wall (per login, in localStorage): drives the bell's dot.
export const annState = $state({ seen: '', login: '' });
const key = (l) => 'sr.annSeen.' + l;
export function initSeen(login) {
  annState.login = login || '';
  try { annState.seen = login ? localStorage.getItem(key(login)) || '' : ''; } catch { annState.seen = ''; }
}
export function markSeen(latest) {
  if (!latest || latest <= annState.seen) return;
  annState.seen = latest;
  try { localStorage.setItem(key(annState.login), latest); } catch { /* storage blocked */ }
}
