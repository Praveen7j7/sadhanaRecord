<script>
  // The side menu (drawer on phones, permanent sidebar on wide screens): only the sections the person has scope for.
  // Each section carries its own area: its dot (the area marker) is that area's colour; actions are the one brand blue.
  import { session, logout } from '../lib/session.svelte.js';
  import { APP_BUILD } from '../lib/build.js';
  import { route } from '../lib/router.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { navFor, railOnly, ownArea as areaOfOwn } from '../lib/nav.js';
  import { entry } from '../lib/cache.svelte.js';
  import { getTheme, setTheme, getTextSize, setTextSize, TEXT_SIZES } from '../lib/theme.js';
  import { cachedMeta, staffBatches } from '../lib/meta.js';
  import { annState } from '../lib/ann.svelte.js';
  import Icon from './Icon.svelte';
  import { install, installApp, standalone, isIOS } from '../lib/pro.svelte.js';
  let { onnav = () => {}, pid = 'm' } = $props();

  const u = $derived(session.user);
  const sc = $derived(scopesOf(u));
  const path = $derived(route.path.split('?')[0]);
  // Theme (the head, 4 Oct 2026): one compact row, as in a phone's own menu: its choice on the right; a tap shows the three
  // one fixed row (the head, 5 Oct 2026): a tap moves to the next mode, Automatic → Light → Dark → Automatic
  let theme = $state(getTheme());
  const THEMES = [['system', 'Automatic', 'theme'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']];
  const themeNow = $derived(THEMES.find(([v]) => v === theme) || THEMES[0]);
  let textSize = $state(getTextSize());
  const tsNow = $derived(TEXT_SIZES.find((x) => x[0] === textSize) || TEXT_SIZES[0]);
  function nextTextSize() { const i = TEXT_SIZES.findIndex((x) => x[0] === textSize); textSize = TEXT_SIZES[(i + 1) % TEXT_SIZES.length][0]; setTextSize(textSize); }
  function nextTheme() { const i = THEMES.findIndex(([v]) => v === theme); theme = THEMES[(i + 1) % THEMES.length][0]; setTheme(theme); }
  // Report issue (the head, 5 Oct 2026): an email to the app's keeper, with what helps to find the problem filled in
  const issueHref = $derived(`mailto:praveenj811@gmail.com?subject=${encodeURIComponent('Sadhana Record: an issue')}&body=${encodeURIComponent(
    `What happened, and what did you expect?\n\n\n—\nScreen: ${route.path}\nApp version: ${APP_BUILD}\nLogin: ${u?.login || ''}\nDevice: ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`)}`);
  const nameOf = (id) => staffBatches().find((b) => b.batchId === id)?.name || id;
  // a facilitator with no batch is a temple resident devotee: TRD (the head, 7 Oct 2026)
  const batchLine = $derived([sc.devotee?.batchId, ...sc.coordinator].filter(Boolean).map(nameOf).join(', ') || (sc.facilitator && !sc.master ? 'TRD (temple resident)' : ''));
  const roleLine = $derived([sc.devotee && 'Devotee', sc.groupLeader && 'Group leader', sc.facilitator && 'Facilitator', sc.coordinator.length && 'Coordinator', sc.master && 'IYF head'].filter(Boolean).join(' · '));
  const pending = $derived((() => { const d = entry('requests.list').data; return d ? d.signUps.length + d.resets.length : 0; })());

  // the same navigation model as the bar and the rail (lib/nav.js): only the sections this person has scope for
  const model = $derived(navFor(sc));
  const reopens = $derived(entry('reopen.list').data?.requests?.length || 0);
  const unread = $derived((entry('announcements.list').data?.announcements || []).filter((a) => !a.scheduled && (a.shownAt || a.createdAt) > annState.seen).length);
  const initial = $derived((u?.name || '?').trim().charAt(0).toUpperCase());
  const ownArea = $derived(areaOfOwn(sc));
  const counts = $derived({ requests: pending, reopens, unread });
  // the slide-out menu leaves out what the bottom bar (and, 600–1023 px, the rail) already shows: one place for each
  // screen (the head, 5 Oct 2026). The desktop sidebar is the only navigation there, so it keeps everything.
  const dupOf = (id) => { if (pid !== 'drawer') return ''; const i = model.primary.findIndex((x) => x.id === id); return i < 0 ? '' : railOnly(model.primary, i) ? 'dup-rail' : 'dup-all'; };
  // every page of every section is always listed (the head, 10 Oct 2026: "don't contract the sidebar options";
  // "traversing should be made easy"): nothing folds into an area entry, so a page is always where it was
</script>

{#snippet item(href, label, icon, active, badge, dup = '')}
  <a class="mi {dup}" {href} aria-current={active ? 'page' : undefined} onclick={onnav}><Icon name={icon} size={20} /><span class="min-w-0 flex-1 truncate">{label}</span>{#if badge}<span class="pill" data-tone="accent">{badge}</span>{/if}</a>
{/snippet}

<nav class="menu" aria-label="Sections">
  <a class="mprofile" href="#/account" onclick={onnav} data-area={ownArea}>
    {#if u?.photoAt}{#await import('./Photo.svelte') then P}<span class="avatar avatar-photo" aria-hidden="true"><P.default login={u.login} name={u.name} hasPhoto own updatedAt={u.photoAt} size={40} /></span>{:catch}<span class="avatar" aria-hidden="true">{initial}</span>{/await}
    {:else}<span class="avatar" aria-hidden="true">{initial}</span>{/if}
    <span class="min-w-0"><span class="mp-name">{u?.name}</span><span class="mp-role">{roleLine}{batchLine ? ' · ' + batchLine : ''}</span></span>
  </a>

  {#if model.top && dupOf(model.top.id) !== 'dup-all'}<div class="menu mt-2" data-area={ownArea}>{@render item(model.top.href, model.top.label, model.top.icon, model.top.match(path), '', dupOf(model.top.id))}</div>{/if}
  {#each model.sections.filter((x) => x.id !== 'you' && x.items.some((it) => dupOf(it.id) !== 'dup-all')) as sec (sec.id)}
    <div class="menu" data-area={sec.area}>
      <p class="menu-h t-over"><span class="menu-area">{sec.label}</span></p>
      <!-- no batch picker here (the head, 28 Oct 2026, Phase 24 V33): every batch screen has its own on the page, and a
           second one in the menu was the same choice twice -->
      {#each sec.items as it (it.id)}{@render item(it.href, it.label, it.icon, it.match(path), it.badge ? counts[it.badge] || '' : '', dupOf(it.id))}{/each}
    </div>
  {/each}

  <div class="menu" data-area={ownArea}>
    <p class="menu-h t-over">You</p>
    {#each model.sections.find((x) => x.id === 'you')?.items || [] as it (it.id)}{@render item(it.href, it.label, it.icon, it.match(path), it.badge ? counts[it.badge] || '' : '', dupOf(it.id))}{/each}
    <a class="mi" href={issueHref} onclick={onnav}><Icon name="alert" size={20} /><span class="flex-1">Report issue</span></a>
    <!-- opens over the current screen, straight from the tap (Phase 9: a sheet opened later, on another screen, was skipped by the phone's Back) -->
    <button type="button" class="mi w-full text-left" aria-haspopup="dialog" onclick={() => { onnav?.(); dispatchEvent(new CustomEvent('sr-howto')); }}><Icon name="info" size={20} /><span class="flex-1">How to use</span></button>
    {#if install.prompt}<button type="button" class="mi w-full text-left" onclick={() => { onnav(); installApp(); }}><Icon name="down" size={20} /><span class="flex-1">Install the app</span></button>
    {:else if isIOS() && !standalone()}<p class="m-0 px-3 py-2 text-xs text-muted">Install on iPhone: Share → Add to Home Screen.</p>{/if}
    <button type="button" class="mi w-full text-left" id={pid + '-theme'} onclick={nextTheme} aria-label={`Theme: ${themeNow[1]}. Tap for ${THEMES[(THEMES.indexOf(themeNow) + 1) % THEMES.length][1]}`}>
      <Icon name={themeNow[2]} size={20} /><span class="flex-1">Theme</span> <span class="mi-val">{themeNow[1]}</span>
    </button>
    <button type="button" class="mi w-full text-left" id={pid + '-text'} onclick={nextTextSize} aria-label={`Text size: ${tsNow[1]}. Tap for ${TEXT_SIZES[(TEXT_SIZES.indexOf(tsNow) + 1) % TEXT_SIZES.length][1]}`}>
      <Icon name="edit" size={20} /><span class="flex-1">Text size</span> <span class="mi-val">{tsNow[1]}</span>
    </button>
    <button type="button" class="mi mi-danger w-full text-left" onclick={logout}><Icon name="out" size={20} /><span class="flex-1">Log out</span></button>
  </div>
</nav>

<style>
  /* the theme row's value on the right */
  .mi-val { font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
  /* in the slide-out menu, what the bar (under 600 px) or the rail (600–1023 px) already shows */
  @media (max-width: 1023px) { .mi.dup-all { display: none; } }
  @media (min-width: 600px) and (max-width: 1023px) { .mi.dup-rail { display: none; } }
</style>
