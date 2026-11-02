<script>
  // App shell. Phones: top bar (left: menu, or Back on inner pages · centre: serif title · right: bell), floating glass
  // bottom nav, menu drawer from the left. From 1024 px: permanent left sidebar, top bar with title + bell.
  // data-area (devotee / coordinator / admin) on the root picks the accent family for everything inside.
  import { session } from '../lib/session.svelte.js';
  import { route } from '../lib/router.svelte.js';
  import { backCloses } from './backclose.js';
  import { scopesOf, canRequests } from '../lib/scopes.js';
  import { areaOf } from '../lib/area.js';
  import { navFor, isTab, railOnly, knownRoute } from '../lib/nav.js';
  import { titleOf } from '../routes.js';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import Menu from './Menu.svelte';
  import { annState } from '../lib/ann.svelte.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { call } from '../lib/api.js';
  import { actSeen, initActSeen, unseenOf } from '../lib/actseen.svelte.js';
  import { net, setBadge, whenIdle } from '../lib/pro.svelte.js';
  import Toaster from './Toaster.svelte';
  import { tick } from 'svelte';
  import { loadMotion } from '../lib/motion.js';
  let { children } = $props();
  const sc = $derived(scopesOf(session.user));
  const path = $derived(route.path.split('?')[0]);
  const area = $derived(areaOf(route.path, sc, !!session.user?.mustChangePassword));
  // the area in words and an icon, so colour is never the only sign of where one is
  const AREAS = { devotee: ['lotus', 'My sadhana'], coordinator: ['users', 'My batch'], admin: ['shield', 'Admin'] };
  // pages every role shares carry no area tag above the title: one overline only where it adds context (8 Oct 2026)
  const SHARED = /^\/(home|account|wall|change-password)$/;
  // a facilitator's screens wear the coordinator colours but say what they are
  const AREA = $derived(path.startsWith('/my-devotees') || (sc.facilitator && !sc.coordinator.length && !sc.master && area === 'coordinator') ? { ...AREAS, coordinator: ['users', 'Facilitator'] } : AREAS);
  let drawer = $state(), menuBtn = $state(), closeBtn = $state(), top = $state();
  let release = null;     // the phone's Back closes the drawer (ui/backclose.js)
  function openMenu() { if (drawer.open) return; drawer.showModal(); closeBtn?.focus(); release = backCloses(drawer); }
  const wall = entry('announcements.list');
  const home = entry('home.get');
  const unread = $derived.by(() => {
    const l = wall.data?.announcements;
    if (l) return l.filter((a) => !a.scheduled && (a.shownAt || a.createdAt) > annState.seen).length;
    // the newest post times come with Home, so the count is the same on every screen (8 Oct 2026: it showed 4, then 1)
    const times = home.data?.announcementTimes;
    if (times) return times.filter((t) => t > annState.seen).length;
    const t = home.data?.latestAnnouncementAt;
    return t && t > annState.seen ? 1 : 0;
  });
  // waiting for this person: sign-ups and resets, and for the IYF head also reopen requests and the wall's reports (one inbox)
  const pending = $derived((() => { const d = entry('requests.list').data; return (d ? d.signUps.length + d.resets.length : 0) + (sc.master ? (entry('reopen.list').data?.requests?.length || 0) + (entry('announcements.reports').data?.reports?.length || 0) + (entry('heads.requests').data?.open?.filter((r) => r.mine).length || 0) + (entry('batchreq.list').data?.waiting || 0) : 0); })());

  // one navigation model for every role and screen size (lib/nav.js): the bar shows the first items, the rail all of them
  const model = $derived(navFor(sc));
  const counts = $derived({ requests: pending, unread });
  // Titles come from the route table (audit FE-20): this was its own list of 28 regexes that had to agree with
  // App.svelte's screen map and nav.js's known-paths list. A screen in one list and not another either loaded
  // with an empty title or showed "Page not found".
  // filling for someone (Phase 5): their first name in the title — "Deepak · Week" — when the link carries it (?n=)
  // a trainee's card is titled after their training, as the sidebar names it (18 Oct 2026)
  // Phase 24 (V6): the title is read from the FULL route — the name travels in its ?n=, which `path` has dropped; the
  // day links of the same session carry no ?n=, so the name Devotee.svelte remembered (sr.fillNames) is used there
  const fillName = (p) => { const m = /^\/fill\/([^/?]+)\//.exec(p); if (!m || /[?&]n=/.test(p)) return p;
    try { const n = JSON.parse(sessionStorage.getItem('sr.fillNames') || '{}')[decodeURIComponent(m[1])]; return n ? p + (p.includes('?') ? '&' : '?') + 'n=' + encodeURIComponent(n) : p; } catch { return p; } };
  const title = $derived(path === '/card' && sc.trainee?.name ? sc.trainee.name
    : knownRoute(path) || path === '/' ? titleOf(fillName(route.path)) : 'Not found');
  // the browser tab and history name the screen (Phase 8): "Report · Sadhana Record"
  // installed (standalone), the window already shows the app's name: the title is just the screen (Phase 9)
  const installedApp = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  $effect(() => { document.title = title ? (installedApp ? title : `${title} · Sadhana Record`) : 'IYF Delhi Sadhana Record'; });
  const back = $derived.by(() => {
    let m;
    if ((m = /^\/fill\/([^/]+)\/day\/([^/]+)\//.exec(path))) return `#/fill/${m[1]}/week/${m[2]}`;
    if ((m = /^\/fill\/([^/]+)\//.exec(path))) return '#/devotee/' + m[1];
    if ((m = /^\/day\/([^/]+)\//.exec(path))) return '#/week/' + m[1];
    if (/^\/history\/.+/.test(path)) return '#/history';
    // a page reached from the bar or the menu is a root: no Back there (8 Oct 2026), only on pages that have a parent
    if ((m = /^\/devotee\/([^/]+)\/week\//.exec(path))) return '#/devotee/' + m[1];
    if (/^\/devotee\//.test(path)) return '#/batch';   // or where it was opened from (backClick)
    if ((m = /^\/my-devotees\/([^/]+)\/.+/.exec(path))) return '#/my-devotees/' + m[1];
    if (/^\/my-devotees\/.+/.test(path)) return '#/my-devotees';
    return '';
  });

  // Back on a devotee's page returns to where it was opened from (All devotees, Go to…, the board), when that was in the app
  let prevPath = '', lastPath = '';
  $effect(() => { const p = route.path; if (p !== lastPath) { prevPath = lastPath; lastPath = p; } });
  function backClick(e) { if (/^\/devotee\/[^/]+$/.test(path) && prevPath && !/^\/devotee\//.test(prevPath)) { e.preventDefault(); history.back(); } }

  // the top bar turns to glass once the page scrolls under it
  let scrolled = $state(false);
  $effect(() => {
    if (!top || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => (scrolled = !e.isIntersecting));
    io.observe(top);
    return () => io.disconnect();
  });
  // the number on the installed app's icon: waiting requests (staff) plus unread posts (anyone with their own sadhana);
  // a head or coordinator who is also a devotee sees both (8 Oct 2026: it used to show only the posts)
  $effect(() => setBadge(pending + (sc.devotee ? unread : 0)));
  // staff: who became inactive or came back (Phase 23, ADR 0020) adds to the bell; Home shows them and marks them seen
  const staffN = $derived(!!sc.master || (sc.coordinator || []).length > 0);
  $effect(() => { if (staffN) { initActSeen(session.user?.login); load('activity.notices', () => call('activity.notices')); } });
  const actNew = $derived(staffN ? (actSeen.id, unseenOf(entry('activity.notices').data?.events)) : 0);
  const bellN = $derived(unread + actNew);
  // the bell goes where the new things are: the wall for posts, Home for the notices when they are all there is
  const bellHref = $derived(!unread && actNew ? '#/home' : '#/wall');
  // a new page: focus its title (screen readers read it; keyboard users start there) and announce it
  let said = $state(''), firstPath = true, h1 = $state();
  $effect(() => {
    path;
    if (firstPath) { firstPath = false; return; }
    tick().then(() => { const el = document.querySelector('.topbar .pagetitle'); el?.focus({ preventScroll: true }); said = title || 'Home'; });
  });

  // ---- Phase 7: "Go to…" for the head and coordinators, and keyboard shortcuts on a computer ----
  // / or Ctrl / ⌘ K: Go to… · g then h / w / r / b / s / a / n: Home, Week, Report, Batch, Students, Account, Announcements
  // · ?: How to use. Never while typing in a field or with a dialog open. More keys: lib/keys.js (Phase 7).
  const canSearch = $derived(canRequests(sc));
  let Search = $state(null), searchEl = $state();
  async function openSearch() { if (!Search) Search = (await import('./CommandSearch.svelte')).default; await tick(); searchEl?.open(); }
  const GO = { h: () => '/home', w: () => sc.devotee && '/week', r: () => sc.devotee && '/report', b: () => canRequests(sc) && '/batch', s: () => sc.facilitator && '/my-devotees', a: () => '/account', n: () => '/wall' };
  let gAt = 0;
  // the bottom bar steps aside while scrolling down a long page (public/motion.css; phones only); never while a save
  // bar is showing, and back as soon as the page scrolls up or changes
  let away = $state(false), lastY = 0;
  function onScroll() {
    const y = scrollY;
    if (document.querySelector('.actionbar') || y < 140) away = false;
    else if (y > lastY + 8) away = true;
    else if (y < lastY - 8) away = false;
    lastY = y;
  }
  $effect(() => { path; away = false; });
  loadMotion();
  // "How to use" (Phase 9): a sheet over the current screen, opened from the tap itself so the phone's Back closes it.
  // From the drawer, the drawer's own Back step finishes first (its history entry), then the sheet adds its own.
  let HowToParts = $state(null), howSheet = $state();
  async function openHowTo() {
    const fromDrawer = history.state?.sheet !== undefined && !howSheet?.isOpen?.();
    if (fromDrawer) await new Promise((r) => { const t = setTimeout(r, 300); addEventListener('popstate', () => { clearTimeout(t); r(); }, { once: true }); });
    if (!HowToParts) { const [s, h] = await Promise.all([import('./Sheet.svelte'), import('../screens/HowTo.svelte')]); HowToParts = { S: s.default, H: h.default }; await tick(); }
    howSheet?.showModal();
  }
  $effect(() => { const f = () => openHowTo(); addEventListener('sr-howto', f); return () => removeEventListener('sr-howto', f); });
  // Phase 7: the list / save / step shortcuts (lib/keys.js), on computers, after the app opens
  if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) whenIdle(() => import('../lib/keys.js').then((m) => m.installKeys()));
  function keys(e) {
    if (e.defaultPrevented || e.repeat || document.querySelector('dialog[open]')) return;
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k' && canSearch) { e.preventDefault(); openSearch(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
    if (e.key === '/' && canSearch) { e.preventDefault(); openSearch(); return; }
    if (e.key === '?') { e.preventDefault(); openHowTo(); return; }
    if (e.key === 'g') { gAt = Date.now(); return; }
    if (gAt && Date.now() - gAt < 1500) { gAt = 0; const to = GO[e.key]?.(); if (to) { e.preventDefault(); location.hash = to; } }
  }
</script>

<svelte:window onkeydown={keys} onscroll={onScroll} />

<div class="shell" data-area={area}>
  <a class="skip" href="#main" onclick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
  <aside class="sidebar" aria-label="Menu">
    <a class="brand brand-row" href="#/home"><img class="brand-emblem" src="/brand/iyf-emblem-128.webp" srcset="/brand/iyf-emblem-64.webp 64w, /brand/iyf-emblem-128.webp 128w, /brand/iyf-emblem-256.webp 256w, /brand/iyf-emblem-512.webp 512w" sizes="30px" width="30" height="30" alt="IYF Delhi" decoding="async" />Sādhana Record</a>
    <!-- words only: the IYF emblem sits right above, a second symbol would repeat it (22 Oct 2026) -->
    {#if AREA[area]}<p class="area-tag">{AREA[area][1]}</p>{/if}
    <Menu pid="side" />
  </aside>
  <div class="main">
    <div class="h-px" bind:this={top} aria-hidden="true"></div>
    <header class="topbar" class:has-search={canSearch} data-scrolled={scrolled ? '' : undefined}>
      <div class="tb-l">
        {#if back}<IconButton icon="back" href={back} label="Back" size={24} onclick={backClick} />
        {:else}<IconButton icon="menu" label="Open menu" class="menu-btn" aria-haspopup="dialog" bind:el={menuBtn} onclick={openMenu} />{/if}
      </div>
      <div class="tb-c">
        {#if AREA[area] && !SHARED.test(path)}<span class="area-tag lg:!hidden" aria-hidden="true"><Icon name={AREA[area][0]} size={12} />{AREA[area][1]}</span>{/if}
        {#if path === '/home'}<h1 class="pagetitle" tabindex="-1"><span class="text-brand lg:hidden">Sādhana Record</span><span class="hidden lg:inline">Home</span></h1>
        {:else}<h1 class="pagetitle" tabindex="-1">{title}</h1>{/if}
      </div>
      <div class="tb-r">
        {#if canSearch}<IconButton icon="search" label="Go to a screen or devotee" aria-keyshortcuts="/ Control+K" onclick={openSearch} />{/if}
        {#if path !== '/wall'}<IconButton icon="bell" href={bellHref} class="bell" label={(unread ? `Announcements, ${unread} new` : 'Announcements') + (actNew ? ` · ${actNew} new inactive or back on Home` : '')} badge={bellN ? (bellN > 9 ? '9+' : String(bellN)) : ''} aria-current={path === '/wall' ? 'page' : undefined} />{/if}
      </div>
    </header>
    <!-- data-path: the route this main is SHOWING. During a view transition the address is already the new one while the
         old screen is still drawn (router.svelte.js withTransition, up to 400 ms); tools/perf/routevitals.mjs waits for it -->
    <main class="content" id="main" tabindex="-1" data-path={path}>
      {#if !net.online}<p class="netbar" role="status"><Icon name="offline" size={16} />You're offline — changes stay on this phone</p>{/if}
      {@render children()}
      <Toaster />
      {#if Search}<Search bind:this={searchEl} />{/if}
      <p class="sr-only" aria-live="polite">{said}</p>
    </main>
  </div>
  <!-- one list: the bottom bar (< 600 px) shows the first items and Account, the rail (600–1023 px) every one; each item wears its own area colour -->
  <nav class="nav" class:nav-away={away} aria-label="Main">
    {#each model.primary as it, i (it.id)}
      {@const n = it.badge ? counts[it.badge] || 0 : 0}
      <a href={it.href} onpointerdown={() => import('../lib/prefetch.js').then((m) => m.prefetch(it.href))} data-area={it.area} class:nav-rail={railOnly(model.primary, i)} aria-current={isTab(it, path, sc) ? 'page' : undefined}><span class="ind relative"><Icon name={it.barIcon || it.icon} size={22} />{#if n}<span class="badge" aria-hidden="true">{n > 9 ? '9+' : n}</span>{/if}</span><span>{it.short}{#if n}<span class="sr-only">, {n} waiting</span>{/if}</span></a>
    {/each}
  </nav>
  <!-- The drawer opens from the left, the side of its button. Esc closes it (native); so does a tap on the dimmed
       backdrop (the dialog itself, outside .drawer-in). Focus goes to the close button and returns to the menu button. -->
  <dialog bind:this={drawer} class="drawer" aria-label="Menu" onclick={(e) => { if (e.target === drawer) drawer.close(); }} onclose={() => { menuBtn?.focus(); release?.(); release = null; }}>
    <div class="drawer-in">
      <div class="drawer-head">
        <span class="brand brand-row text-xl"><img class="brand-emblem" src="/brand/iyf-emblem-128.webp" srcset="/brand/iyf-emblem-64.webp 64w, /brand/iyf-emblem-128.webp 128w, /brand/iyf-emblem-256.webp 256w, /brand/iyf-emblem-512.webp 512w" sizes="30px" width="28" height="28" alt="IYF Delhi" decoding="async" />Sādhana Record</span>
        <IconButton icon="close" label="Close menu" bind:el={closeBtn} onclick={() => drawer.close()} />
      </div>
      <Menu pid="drawer" onnav={() => drawer.close()} />
    </div>
  </dialog>
  {#if HowToParts}{@const S = HowToParts.S}{@const H = HowToParts.H}<S bind:this={howSheet} titleId="h-how-g" title="How to use" wide><H open="day" /></S>{/if}
</div>

<style>
  /* a second button (Go to…) beside the bell: both sides widen, so the title stays centred */
  .topbar.has-search { grid-template-columns: 96px minmax(0, 1fr) 96px; }
  .topbar.has-search .tb-r { display: flex; }
  /* Phase 24 (V7): on a small phone the two right buttons left the centred title ~110 px, and 17 staff titles were cut
     ("Batch s…"). Under 420 px the title starts after the menu button and takes everything up to the buttons. */
  @media (max-width: 419px) {
    .topbar.has-search { grid-template-columns: 44px minmax(0, 1fr) auto; }
    .topbar.has-search .tb-c { text-align: left; }
  }
  @media (max-width: 359px) { .topbar.has-search :global(.pagetitle) { font-size: 1.125rem; } }
  @media (min-width: 1024px) { .topbar.has-search { grid-template-columns: auto minmax(0, 1fr) auto; } }
</style>
