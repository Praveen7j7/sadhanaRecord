<script>
  // The signed-in app (moved out of App.svelte on 22 Oct 2026, A4): the shell around every screen, and which screen.
  // App.svelte keeps the routing rules and the signed-out screens, and loads this file only for a signed-in person.
  import Shell from './ui/Shell.svelte';
  import Home from './screens/Home.svelte';
  import Skeleton from './ui/Skeleton.svelte';
  import Banner from './ui/Banner.svelte';
  import { lazy, loadedOnce } from './lib/lazy.js';
  import { knownRoute } from './lib/nav.js';
  import { entry } from './lib/cache.svelte.js';
  import { whenIdle } from './lib/pro.svelte.js';
  let { path, base, screen, load: LOAD, user } = $props();
  // B4: about 1 open in 100 measures itself on this phone (lib/vitals.js) — loaded when the phone is idle, only then
  whenIdle(() => import('./lib/vitals.js').then((m) => m.startVitals()).catch(() => {}));
  // The screen's file, the SAME value every time it is asked for (22 Oct 2026). A fresh `lazy()` promise per evaluation
  // made `{#await}` resolve again whenever the address changed — and a search box writes its words into the address
  // (lib/hashq.js), so every letter redrew the whole screen and the box lost focus (Reading, Hearing, staff lists).
  // Once loaded, the module itself is returned, so the screen also draws in the same frame on a return visit.
  const screenFile = (s) => loadedOnce('screen:' + s, () => lazy(LOAD[s]));
</script>

{#snippet failed()}
  <Banner onretry={() => location.reload()} retryLabel="Reload">Could not load this screen. Check your connection and reload.</Banner>
{/snippet}

<Shell>
  {#if base !== '/' && !knownRoute(base)}
    <!-- an address the app does not have (or a broken part of one): "not found", whichever screen it starts like -->
    {#await import('./ui/EmptyState.svelte') then E}<E.default icon="info" title="Page not found">The link may be old or mistyped.{#snippet action()}<a class="btn" href="#/home">Go to Home</a>{/snippet}</E.default>{/await}
  {:else if screen}
    {#key screen}
      {#await screenFile(screen)}
        <Skeleton kind="page" rows={3} />
      {:then m}
        {#if screen === 'devotee'}<m.default {path} />
        {:else if screen === 'fac'}{#key base}<m.default path={base} />{/key}
        {:else if screen === 'devweek'}{#key base}<m.default action="devotees.week" login={decodeURIComponent(base.split('/')[2])} weekId={base.split('/')[4]} name={entry('devotees.get:' + decodeURIComponent(base.split('/')[2])).data?.name || ''} />{/key}
        {:else if screen === 'batch'}<m.default tab={base} />
        {:else if screen === 'detail'}{#key path}<m.default login={decodeURIComponent(path.split('/')[2].split('?')[0])} />{/key}
        {:else if screen === 'admin'}<m.default tab={base} />
        {:else if screen === 'songs'}<m.default path={base} />
        {:else if screen === 'share'}<m.default path={base} />
        {:else if screen === 'password'}<m.default forced={user.mustChangePassword} page />
        {:else}<m.default />{/if}
      {:catch}
        {@render failed()}
      {/await}
    {/key}
  {:else if base === '/home' || base === '/'}<Home />
  {:else}
    <!-- a screen outside this person's access: say so (never a silent Home), and never whether someone else's record
         exists (the server answers that, per record) -->
    {#await import('./ui/EmptyState.svelte') then E}
      <E.default icon="lock" title="Not available to you">This page belongs to another role.{#snippet action()}<a class="btn" href="#/home">Go to Home</a>{/snippet}</E.default>
    {/await}
  {/if}
</Shell>
