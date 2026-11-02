<script>
  import { route, go } from './lib/router.svelte.js';
  import { session, restore } from './lib/session.svelte.js';
  import Toaster from './ui/Toaster.svelte';
  import Banner from './ui/Banner.svelte';
  import { lazy } from './lib/lazy.js';
  import { scopesOf, canRequests } from './lib/scopes.js';
  import { areaOf } from './lib/area.js';
  import { screenOf, LOADERS, PUBLIC_PATHS, REDIRECTS } from './routes.js';
  import { setArea } from './lib/theme.js';
  import { whenIdle } from './lib/pro.svelte.js';
  import { saveData } from './lib/tier.js';
  import { signedIn } from './lib/signedin.js';

  restore();
  const SPLASH_MIN_MS = 1400;

  const PUBLIC = PUBLIC_PATHS;   // the one list (routes.js), not a copy
  // the same lists as the navigation model (lib/nav.js)
  const user = $derived(session.user);
  const path = $derived(route.path);
  const sc = $derived(scopesOf(user));

  $effect(() => {
    if (!session.ready) return;
    if (!user) {
      if (!PUBLIC.includes(path)) {
        // a deep link while signed out: back to it after signing in
        if (path !== '/' && path !== '/home') try { sessionStorage.setItem('sr.return', path); } catch { /* storage blocked */ }
        go('/welcome', true);
      }
    } else if (user.mustChangePassword) {
      if (path !== '/change-password') go('/change-password', true);
    } else if (user.needsYear) {
      // one id system (22 Oct 2026): the year comes first; the screen stands alone over Home's address, so a reload
      // or Back never lands on the sign-in page with a signed-in person
      if (PUBLIC.includes(path) || path === '/') go('/home', true);
    } else if ((PUBLIC.includes(path) && path !== '/welcome') || path === '/') {
      // '/welcome' is left out on purpose. Logging out clears the session and goes there, but this
      // effect re-runs on the old `user` and used to bounce it straight back to '/home', so logging
      // out from an admin screen never reached the welcome screen at all (17 Oct 2026). A signed-in
      // person who opens '/welcome' deliberately simply sees it; every other public page still
      // sends them home.
      go('/home', true);
    }
    // reopen requests moved into the one Requests inbox (8 Oct 2026): old links land there
    if (user && REDIRECTS[path.split('?')[0]]) go(REDIRECTS[path.split('?')[0]], true);
  });
  // the accent family of the whole page (body, overscroll, browser bar) follows the area of the screen
  $effect(() => setArea(areaOf(path, user ? sc : null, !!user?.mustChangePassword || !!user?.needsYear)));
  // when the phone is idle, fetch the screen file this person most likely opens next (code only)
  let prefetched = false;
  $effect(() => {
    if (!user || prefetched || saveData()) return;      // data saver: screens load only when opened
    prefetched = true;
    whenIdle(() => (sc.devotee ? import('./devotee/Devotee.svelte') : sc.master ? import('./master/Admin.svelte') : import('./coord/Batch.svelte')));
  });
  // notifications are a default of the app: once allowed (asked at the first tap), the phone registers itself, with the
  // signed-in person or with nobody, unless switched off by hand. Code loaded only when the phone is idle.
  let reminderFor = null;
  function reminderOn() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const login = session.user?.login || '';
    whenIdle(async () => {
      const [{ ensureDevice }, { loadMeta }] = await Promise.all([import('./lib/push.js'), import('./lib/meta.js')]);
      const m = await loadMeta().catch(() => null);
      ensureDevice(login, m?.push?.publicKey);
    });
  }
  $effect(() => { if (!session.ready) return; const l = user?.login || ''; if (l !== reminderFor) { reminderFor = l; reminderOn(); } });
  $effect(() => { const f = () => reminderOn(); window.addEventListener('sr-notify', f); return () => window.removeEventListener('sr-notify', f); });
  /* Roadmap 4.6: the first saved day arms the system notification prompt. main.js only reads that flag when
     the page loads, so within the same session this listener puts the one-shot tap handler in place — the
     devotee saves a day and the next tap asks, rather than waiting for their next visit. */
  $effect(() => {
    const arm = () => {
      if (!('PushManager' in window) || window.Notification?.permission !== 'default') return;
      const ask = () => {
        document.removeEventListener('click', ask, true);
        if (window.Notification?.permission !== 'default') return;
        Notification.requestPermission().then((p) => {
          try { localStorage.removeItem('sr.askNotify'); } catch { /* storage blocked */ }
          if (p === 'granted') reminderOn();
        }).catch(() => {});
      };
      document.addEventListener('click', ask, true);
    };
    window.addEventListener('sr-ask-notify', arm);
    return () => window.removeEventListener('sr-ask-notify', arm);
  });
  // The splash (index.html) stays at least 1.4 s from the start of a signed-out load (fresh open or reload), long enough
  // to read like an installed app's launch screen, then fades out over 420 ms once the first real screen is ready.
  // In-app navigation never shows it. Reduced motion: the same minimum, no animation.
  $effect(() => {
    if (!session.ready) return;
    const el = document.getElementById('splash');
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // signed out: the splash also waits for the first public screen's file, so it never fades onto an empty page
    const first = user ? Promise.resolve(signedIn()).catch(() => {}) : LOAD[path === '/login' ? 'login' : path === '/signup' || path === '/forgot' ? path.slice(1) : 'welcome']().catch(() => {});
    first.then(() => {
      if (!user && !saveData()) whenIdle(() => LOAD.login().catch(() => {}));   // the next screen a visitor opens
      // signed in (Phase 8, 9 Oct 2026): Home is kept on the phone, so the splash only fades through (0.35 s), never 1.4 s
      const wait = Math.max(0, (user ? 350 : SPLASH_MIN_MS) - performance.now());
      setTimeout(() => requestAnimationFrame(() => { el.classList.add('out'); setTimeout(() => el.remove(), reduce ? 0 : 440); }), wait);
    });
  });

  const base = $derived(path.split('?')[0]);
  // A4: on the sign-in screen, the signed-in app's file loads while the person types (code only; not on data saver)
  $effect(() => { if (!user && path === '/login' && !saveData()) whenIdle(() => Promise.resolve(signedIn()).catch(() => {})); });
  // signed-out screens name themselves in the tab (signed in, the shell does it)
  const PUBLIC_TITLE = { '/login': 'Sign in', '/signup': 'Create an account', '/forgot': 'Forgot password' };
  $effect(() => { if (!user) document.title = PUBLIC_TITLE[base] ? `${PUBLIC_TITLE[base]} · Sadhana Record` : 'IYF Delhi Sadhana Record'; });
  // which lazily loaded screen file the route needs (null: a screen in the main file).
  // One table decides this, the title, the accent and the prefetch: src/routes.js (audit FE-20).
  const screen = $derived(screenOf(path, sc));
  // the signed-out screens load on their own (their styles stay out of the startup CSS); precached, so they open
  // offline. Everything else comes from the route table.
  const LOAD = {
    welcome: () => import('./screens/Welcome.svelte'),
    login: () => import('./screens/Login.svelte'),
    signup: () => import('./screens/SignUp.svelte'),
    forgot: () => import('./screens/Forgot.svelte'),
    year: () => import('./screens/ConnectedSince.svelte'),
    ...LOADERS,
  };
</script>

{#snippet failed()}
  <Banner onretry={() => location.reload()} retryLabel="Reload">Could not load this screen. Check your connection and reload.</Banner>
{/snippet}

{#if !session.ready}
  <!-- the static splash in index.html covers this moment -->
{:else if !user}
  {@const pub = path === '/login' || path === '/signup' || path === '/forgot' ? path.slice(1) : 'welcome'}
  {#key pub}{#await lazy(LOAD[pub])}<div class="auth"></div>{:then m}<m.default />{:catch}<div class="wrap pt-8">{@render failed()}</div>{/await}{/key}
  <!-- signed out there is no Shell: the welcome screen shows the toasts itself ("Your account has been deleted.") -->
  {#if pub === 'welcome'}<Toaster />{/if}
{:else if user.mustChangePassword}
  <!-- the required password change stands alone: no bars, menu or bell around it (8 Oct 2026) -->
  {#await lazy(LOAD.password)}<div class="auth"></div>{:then m}<m.default forced auth />{:catch}<div class="wrap pt-8">{@render failed()}</div>{/await}
{:else if user.needsYear}
  <!-- one id system (22 Oct 2026): a devotee without an IYFD gives their year first; answering issues it -->
  {#await lazy(LOAD.year)}<div class="auth"></div>{:then m}<m.default />{:catch}<div class="wrap pt-8">{@render failed()}</div>{/await}
{:else}
  <!-- the signed-in app (SignedIn.svelte, A4): its own file, already loading on a returning phone before mount -->
  {#await signedIn()}<div class="auth"></div>{:then S}<S.default {path} {base} {screen} load={LOAD} {user} />{:catch}<div class="wrap pt-8">{@render failed()}</div>{/await}
{/if}
