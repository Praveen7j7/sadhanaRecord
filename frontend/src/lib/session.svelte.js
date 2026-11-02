import { call, getToken, setToken, clearToken, hooks } from './api.js';
import { go } from './router.svelte.js';
import { setScope, clearAll, clearKept, prefetch, load, entry } from './cache.svelte.js';
import { initSeen } from './ann.svelte.js';
import { scopesOf } from './scopes.js';
import { namesVersion } from './meta.js';
// 'home.get' by name, NOT imported from weekstore.js: that module pulls the whole week store (and daylogic with
// it) into the STARTUP chunk — measured at +1.63 KB, which is the budget's whole remaining headroom (19 Oct).
const HOME = 'home.get';

export const session = $state({ user: null, ready: false });

// Phase 1: the last signed-in person is kept on this phone (with their token), so a repeat open shows their screen at once
// from the data kept here, and an open with no connection does not land on the welcome screen. Cleared at log-out and
// when the server ends the session.
const USER_KEY = 'sr.user';
const keepUser = (u) => { try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch { /* storage blocked */ } };
const keptUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } };
const forgetUser = () => { try { localStorage.removeItem(USER_KEY); } catch { /* storage blocked */ } };
/** Keeps the person as they are now on this phone (a rename on Account), so the next start shows the new name. */
export function keepSession() { if (session.user) keepUser(session.user); }
// the start's reply carries the version of the names lists; the phone refetches them only when it moved (lib/meta.js)
const namesFrom = (d) => namesVersion(d?.versions?.names);
function begin(user) {
  session.user = user;
  setScope(user.login || user.name);
  initSeen(user.login || user.name);
  keepUser(user);
}

hooks.onUnauthenticated = () => {
  // the session ended on the server: say so on the sign-in screen and come back here after signing in
  // (drafts kept on this phone stay)
  const was = session.user;
  session.user = null;
  forgetUser();
  clearAll();
  clearKept();
  try { if (was) { sessionStorage.setItem('sr.expired', '1'); sessionStorage.setItem('sr.return', location.hash.slice(1) || '/home'); } } catch { /* storage blocked */ }
  go(was ? '/login' : '/welcome', true);
};
// refused: the head may just have revoked a role or turned a right off (ADR 0019); read the access again so the menus
// stop offering it, without waiting for the next app open. At most once a minute.
let accessAt = 0;
hooks.onForbidden = () => {
  if (!session.user || Date.now() - accessAt < 60000) return;
  accessAt = Date.now();
  refreshAccess();
};
/** Read this person's access again (auth.me) and redraw the menus if it changed: after a refusal (above), or when a batch
 *  they asked for was started for them (Phase 23) — their new batch's tabs appear without reopening the app. */
export function refreshAccess() {
  if (!session.user) return Promise.resolve();
  // only for the sign-in that asked: a reply that lands after signing out (or after someone else signed in on this phone)
  // must not bring the person back
  const token = getToken(), who = session.user.login;
  return call('auth.me').then((d) => {
    if (!d?.user || !session.user || getToken() !== token || session.user.login !== who || d.user.login !== who) return;
    if (JSON.stringify(d.user.scopes) !== JSON.stringify(session.user.scopes)) begin(d.user);
  }).catch(() => {});
}
hooks.onMustChangePassword = () => {
  if (session.user) session.user.mustChangePassword = true;
  go('/change-password', true);
};

export function startSession(token, user) {
  if (token) setToken(token);
  begin(user);
  prefetch(user);
}

export async function restore() {
  if (!getToken()) { session.ready = true; return; }
  const kept = keptUser();
  // a repeat open: the person's screen at once, from the data kept on this phone; home.get starts together with auth.me
  if (kept) { begin(kept); prefetch(kept); session.ready = true; }
  /*
   * ONE CALL ON A DEVOTEE'S REPEAT OPEN (19 Oct 2026).
   *
   * Every open asked the server twice: auth.me for who this is, and home.get for their weeks — two round trips
   * before the screen is right, on a phone, often on a slow connection. home.get now carries the SAME `user`
   * object auth.me returns (worker weeks.js:303), so for a devotee whose home is being fetched anyway the second
   * question is already answered by the first.
   *
   * Only for a REPEAT open of a DEVOTEE (prefetch starts home.get for them, and `kept` proves this phone has
   * shown them before). auth.me stays the authority everywhere it mattered:
   *   · a cold open with nothing kept — no home.get is in flight to learn from;
   *   · staff with no devotee scope — prefetch does not fetch home.get for them at all;
   *   · a changed role, name or scope — home.get's `user` is built by the same server function, so it carries
   *     the change exactly as auth.me would;
   *   · a different person on this phone — the login comparison below is unchanged and still clears everything;
   *   · an ended session — home.get returns UNAUTHENTICATED and hooks.onUnauthenticated signs them out, as before.
   * If home.get is missing `user` for any reason (an older API during a release), we fall back to asking auth.me,
   * so the screen is never left on stale data.
   */
  /* The answer must be able to FAIL. `load()` keeps its error in the cache entry and RESOLVES, so a session the
     server has ended would end restore() quietly — signed out underneath, still on Home, no redirect to Login
     (caught by verify.mjs `tiers`, 19 Oct 2026). So the error is re-read from the cache entry and rethrown: the
     catch below then behaves exactly as it did when this was a plain `auth.me` call, and api.js has already run
     its UNAUTHENTICATED path (sign out, open Login) on the way through. Still ONE request: `load` shares the
     in-flight promise with prefetch's own home.get. */
  const viaHome = kept && scopesOf(kept)?.devotee
    ? load(HOME, undefined, { force: true }).then((d) => { const e = entry(HOME); if (e.error) throw e.error; namesFrom(d); return d?.user || null; })
    : Promise.resolve(null);
  try {
    const fromHome = await viaHome;
    /* If home.get did not yield a user, ASK auth.me — never just carry on (19 Oct 2026). `load()` swallows the
       error into the cache entry, so a session the server has ended would otherwise end restore() quietly with
       the person still on their own screen, signed out underneath: `session.user` null, no redirect, a dead Home.
       Asking auth.me here lets api.js's UNAUTHENTICATED path run, which signs them out and opens Login — exactly
       what happened before this shortcut existed. Caught by verify.mjs's `tiers` check, which reloads against a
       server that no longer knows the token. */
    const d = fromHome ? { user: fromHome } : await call('auth.me');
    if (!fromHome) namesFrom(d);
    if (kept && (kept.login || kept.name) !== (d.user.login || d.user.name)) { clearAll(); clearKept(); begin(d.user); prefetch(d.user); }
    else { begin(d.user); if (!kept) prefetch(d.user); }
  } catch (e) {
    // no connection, or the server silent: stay on the kept screen and check again once the phone is back online
    // (UNAUTHENTICATED is handled by hooks.onUnauthenticated: signed out, the kept data cleared)
    if (kept && (e?.code === 'NETWORK' || e?.code === 'TIMEOUT') && typeof addEventListener === 'function') {
      addEventListener('online', function again() { removeEventListener('online', again); call('auth.me').then((d) => begin(d.user)).catch(() => {}); });
    }
  }
  session.ready = true;
}

export async function logout() {
  // this phone stops reminding the person who logs out (the permission stays for whoever signs in next)
  try { await (await import('./push.js')).forgetOnLogout(); } catch { /* signed out anyway */ }
  try { await call('auth.logout'); } catch { /* ignore: clearing locally anyway */ }
  await endHere();
  // the last person's messages ("Saved", "You won't see …") are not left on screen for the next (8 Oct 2026)
  try { (await import('./pro.svelte.js')).toasts.list = []; } catch { /* nothing shown */ }
  go('/welcome');
  // the page this person was on is not where the next person on this phone lands (7 Oct 2026: a devotee signing in
  // after the head was sent to the head's page, "Not available to you"); saved while signing out, so cleared after
  try { sessionStorage.removeItem('sr.return'); } catch { /* storage blocked */ }
}
/** Signs out on this phone only, with no server call: the token, the kept person, every copy kept for them. Log-out,
 *  and account deletion (the server has already ended the session there). */
export async function endHere() {
  const who = session.user?.login || '';
  clearToken();
  session.user = null;
  forgetUser();
  clearAll();
  await clearKept();
  // and everything kept FOR THIS LOGIN: the photo, the journals, the unsent days, the batch's rules, the current
  // book. forgetLogin() already did this for account deletion; log-out never called it, so on a shared phone the
  // next person could reach the last person's photo and journals (13 Oct 2026, audit FE-3).
  // Scoped to this login on purpose: another devotee's keys on the same phone are theirs, and stay.
  if (who) { const { forgetLogin } = await import('./forget.js'); await forgetLogin(who); }
  try { sessionStorage.removeItem('sr.signupDraft'); } catch { /* storage blocked */ }
  setScope('');
}
