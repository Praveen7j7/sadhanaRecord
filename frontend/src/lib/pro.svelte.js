// Small app-wide services: toasts, connection status, the install prompt, haptics, the app badge, idle prefetch.
// All native browser features; each does nothing where it is not supported.

// ---- toasts: success / info / error; an optional action (Undo); errors are announced assertively ----
export const toasts = $state({ list: [] });
let tid = 0;
export function toast(text, { kind = 'ok', action = null, ms = kind === 'err' ? 7000 : 5000 } = {}) {
  const id = ++tid;
  toasts.list = [...toasts.list.slice(-2), { id, text, kind, action, ms }];
  setTimeout(() => dismiss(id), ms);
  return id;
}
export const dismiss = (id) => { toasts.list = toasts.list.filter((t) => t.id !== id); };

// ---- connection: the browser's online / offline events, and calls that failed for want of a network ----
export const net = $state({ online: typeof navigator === 'undefined' || navigator.onLine !== false });
export function setOnline(v) {
  if (v === net.online) return;
  net.online = v;
  if (v) toast('Back online', { kind: 'info', ms: 3000 });
}
if (typeof window !== 'undefined') {
  addEventListener('online', () => setOnline(true));
  addEventListener('offline', () => setOnline(false));
}

// ---- install: Chrome / Edge / Samsung offer it through beforeinstallprompt; iPhone through Share → Add to Home Screen ----
export const install = $state({ prompt: null, installed: false });
export const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
export const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.prompt = e; });
  addEventListener('appinstalled', () => { install.prompt = null; install.installed = true; });
}
/** Shows the browser's install dialog; true when installed. */
export async function installApp() {
  const p = install.prompt;
  if (!p) return false;
  install.prompt = null;
  p.prompt();
  const r = await p.userChoice.catch(() => null);
  return r?.outcome === 'accepted';
}

// ---- a short tap of the vibration motor on success (touch phones only, never with reduced motion) ----
export function buzz(pattern = 10) {
  try { if (matchMedia('(pointer: coarse)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(pattern); } catch { /* not supported */ }
}
/** Phase 7: a save or submit that failed gives a short double buzz (a success, one tap). */
export const buzzErr = () => buzz([30, 60, 30]);

// ---- the number on the installed app's icon (unread posts for a devotee, waiting requests for staff) ----
export function setBadge(n) {
  try { if (n > 0) navigator.setAppBadge?.(n)?.catch?.(() => {}); else navigator.clearAppBadge?.()?.catch?.(() => {}); } catch { /* not supported */ }
}

// ---- when the phone is idle, fetch the screen file the person most likely opens next (code only, never data) ----
export function whenIdle(fn) {
  if (typeof window === 'undefined') return;
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => { try { fn(); } catch { /* ignore */ } }, { timeout: 4000 });
}
