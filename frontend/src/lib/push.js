// Notifications on this phone (Web Push): a DEFAULT of the app (the head, 3 Oct 2026). The system permission is asked
// once, at the first tap after opening the app (main.js), signed in or not; then the phone registers itself and the
// signed-in person is attached. Switching off is manual (Account) and remembered on this phone. Session expiry (30 days)
// changes nothing; logging out detaches the person, the phone keeps its notifications.
// State: 'unsupported' | 'ios-install' (iPhone: add to Home Screen first) | 'denied' | 'on' | 'off'.
import { call } from './api.js';

/** base64url (the server's VAPID public key) → bytes for applicationServerKey. */
export function b64urlToBytes(s) {
  const b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
/** iPhone / iPad Safari shows web reminders only for an app added to the Home Screen. */
export function iosNeedsInstall(ua = '', standalone = false, touch = 0) {
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
  return ios && !standalone;
}
const env = () => (typeof window === 'undefined' ? {} : window);
export function supported() {
  const w = env();
  return !!(w.navigator?.serviceWorker && w.PushManager && w.Notification);
}
const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
async function registration() {
  const sw = navigator.serviceWorker;
  const reg = await Promise.race([sw.ready, new Promise((r) => setTimeout(() => r(null), 4000))]);
  if (!reg?.pushManager) throw new Error('NO_SW');
  return reg;
}
/** What the switch shows right now. */
export async function pushState() {
  const w = env();
  if (iosNeedsInstall(w.navigator?.userAgent, standalone(), w.navigator?.maxTouchPoints || 0)) return 'ios-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try { const sub = await (await registration()).pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; }
  catch { return 'unsupported'; }
}
const OFF = 'sr.reminderOff', SYNC = 'sr.pushFor';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } } };
import { userTurnedOff } from './pushask.js';
export { userTurnedOff, askDismissed, dismissAsk, askedToday } from './pushask.js';

/**
 * Registers this phone for notifications by itself when it may (allowed, not switched off by hand): with the signed-in
 * person (push.subscribe) or with nobody (push.register). Tells the server at most once a week per person and phone,
 * unless `force` (Account checks the link each time it is opened). Calls run one after another: two at once (the app
 * opening while notifications are just allowed) could otherwise leave the phone registered with nobody (3 Oct 2026).
 */
let queue = Promise.resolve('skip');
export function ensureDevice(login, publicKey, { force = false } = {}) {
  queue = queue.catch(() => 'skip').then(() => syncDevice(login, publicKey, force));
  return queue;
}
async function syncDevice(login, publicKey, force) {
  if (!publicKey || !supported() || userTurnedOff() || Notification.permission !== 'granted') return 'skip';
  try {
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) }));
    const j = sub.toJSON(), mark = `${login || ''}|${j.endpoint}`, last = JSON.parse(ls.get(SYNC) || 'null');
    if (!force && last && last.mark === mark && Date.now() - last.at < 7 * 864e5) return 'on';
    await call(login ? 'push.subscribe' : 'push.register', { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
    ls.set(SYNC, JSON.stringify({ mark, at: Date.now() }));
    return 'on';
  } catch { return 'skip'; }
}

/** On logout: the phone keeps its notifications, without that person (push.detach). */
export async function forgetOnLogout() {
  if (!supported() || Notification.permission !== 'granted') return;
  try { const sub = await (await registration()).pushManager.getSubscription(); if (sub) await call('push.detach', { endpoint: sub.endpoint }); } catch { /* signed out anyway */ }
  ls.set(SYNC, null);
}

/** Turn the reminder on (called from a tap). Returns the new state; throws with a message on failure. */
export async function turnOn(publicKey) {
  ls.set(OFF, null);
  if (!publicKey) throw new Error('Reminders are not set up yet. Try again later.');
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(publicKey) }));
  const j = sub.toJSON();
  try { await call('push.subscribe', { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }); ls.set(SYNC, null); }
  catch (e) { await sub.unsubscribe().catch(() => {}); throw e; }
  return 'on';
}
/** Turn it off on this phone (remembered: it is not turned on again by itself). */
export async function turnOff() {
  ls.set(OFF, '1'); ls.set(SYNC, null);
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) { const endpoint = sub.endpoint; await call('push.unsubscribe', { endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  return 'off';
}

/*
 * Arm the system notification prompt (roadmap 4.6, audit FE-14; the head, 14 Oct 2026).
 *
 * The prompt used to fire on the first tap after opening the app, signed in or not — so a devotee opening
 * the link for the first time was asked to allow notifications from a site they did not recognise yet. The
 * honest answer then is "Block", and a browser makes Block permanent: nothing in the app can ask again, and
 * that devotee loses the 9 PM reminder for good.
 *
 * Called after the first saved day instead. Browsers only show the prompt from a user gesture, so this sets
 * a flag and the next tap asks (main.js reads it on load; App.svelte arms it live within the same session).
 */
export const ASK_FLAG = 'sr.askNotify';
export function armNotificationPrompt() {
  try {
    if (!('PushManager' in window) || window.Notification?.permission !== 'default') return false;
    if (localStorage.getItem('sr.reminderOff') === '1') return false;      // switched off by hand: respect it
    if (localStorage.getItem(ASK_FLAG) === '1') return false;              // already armed
    localStorage.setItem(ASK_FLAG, '1');
    window.dispatchEvent(new Event('sr-ask-notify'));                      // arm it in THIS session too
    return true;
  } catch { return false; }                                                // storage blocked: arms after the next save
}
