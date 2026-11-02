<script>
  import '../styles/screens.css';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  // Requests (Phase 5, 9 Oct 2026): one inbox — sign-ups, password resets and (the IYF head) reopen requests — as
  // compact rows with their age, filtered by type. A row opens its card: a page on a phone, beside the list from 1024 px
  // (#/requests?type=…&open=su:<phone> | rs:<login>, so a link opens the same card). After a decision the row leaves
  // and, on a wide screen, the next one opens.
  import { call, errorMessage } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { fmtDateTime } from '../lib/validate.js';
  import { relTime } from '../lib/ann.js';
  import { wide } from '../lib/wide.svelte.js';
  import SignUpCard from './SignUpCard.svelte';
  import TempPassword from './TempPassword.svelte';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import { cachedMeta, staffBatches } from '../lib/meta.js';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Reopens from '../master/Reopens.svelte';
  import { route } from '../lib/router.svelte.js';

  const sel = batchSel;
  const batchId = $derived(sel.id);
  let resetBusy = $state('');
  let resetErr = $state('');

  const batchIds = $derived(scopesOf(session.user).coordinator.length ? scopesOf(session.user).coordinator : session.user?.batchIds || []);
  const key = $derived(batchId ? 'requests.list:' + batchId : 'requests.list');
  const e = $derived(entry(key));
  const data = $derived(e.data);
  const loadErr = $derived(e.error ? errorMessage(e.error) : '');
  const nameOf = (id) => staffBatches().find((b) => b.batchId === id)?.name || id;
  // one inbox (8 Oct 2026): the IYF head also decides reopen requests here, and sees the wall's reports waiting
  const master = $derived(!!scopesOf(session.user).master);
  const reports = $derived(entry('announcements.reports').data?.reports?.length || 0);
  const reopenN = $derived(entry('reopen.list').data?.requests?.length ?? 0);
  $effect(() => { if (master) { load('announcements.reports'); load('reopen.list'); load('batchreq.list'); } });
  // the batches coordinators asked to start (Phase 23): the head decides them here, beside the reopens
  const newBatchN = $derived(entry('batchreq.list').data?.waiting ?? 0);
  function refresh(force = false) { load(key, () => call('requests.list', batchId ? { batchId } : {}), { force }); }
  $effect(() => { key; refresh(); });

  // the query: ?type=signup|reset|reopen and ?open=<item>
  const q = $derived(new URLSearchParams(route.path.split('?')[1] || ''));
  const type = $derived(['signup', 'reset', 'reopen', 'newbatch'].includes(q.get('type')) ? q.get('type') : '');
  const open = $derived(q.get('open') || '');
  const go = (t, o = '') => { const p = new URLSearchParams(); if (t) p.set('type', t); if (o) p.set('open', o); const s = p.toString(); location.hash = '#/requests' + (s ? '?' + s : ''); };

  const items = $derived(!data ? [] : [
    ...data.signUps.map((s) => ({ id: 'su:' + s.phone, kind: 'signup', name: s.name, sub: nameOf(s.batchId), at: s.at, s })),
    ...data.resets.map((r) => ({ id: 'rs:' + r.login, kind: 'reset', name: r.name, sub: r.role && r.role !== 'DEVOTEE' ? r.role.toLowerCase() : r.login, at: r.at, r })),
  ].sort((a, b) => (a.at || '').localeCompare(b.at || '')));                    // oldest first: who has waited longest
  const shown = $derived(type === 'reopen' || type === 'newbatch' ? [] : items.filter((x) => !type || x.kind === type));
  const cur = $derived(items.find((x) => x.id === open) || null);
  // a wide screen always shows one card: the chosen one, else the first
  const paneItem = $derived(cur || (wide.on && type !== 'reopen' && type !== 'newbatch' ? shown[0] || null : null));
  const KIND = { signup: ['Sign-up', 'accent'], reset: ['Password reset', 'warn'] };
  const TITLE = { '': 'Requests', signup: 'Sign-ups', reset: 'Password resets', reopen: 'Reopen requests' };

  // a decision: the row leaves; on a wide screen the next one opens, on a phone the list comes back
  function after(id) {
    const i = shown.findIndex((x) => x.id === id), next = shown[i + 1] || shown[i - 1];
    go(type, wide.on && next ? next.id : '');
  }
  function removeSignUp(phone, msg) {
    toast(msg);
    after('su:' + phone);
    patch(key, (d) => ({ ...d, signUps: d.signUps.filter((s) => s.phone !== phone) }));
  }
  /* Approving a reset now RETURNS the temporary password the server made, once (decision 46). It is shown
     in a dialog the coordinator must dismiss deliberately, because nothing can read it back afterwards —
     a stray tap would cost the devotee a second request. Rejecting is unchanged. */
  let tempInfo = $state(null);
  let tempDialog = $state();

  async function reset(login, action) {
    resetBusy = login + action;
    resetErr = '';
    try {
      const res = await call(action, { login });
      if (action === 'resets.approve' && res?.tempPassword) {
        tempInfo = res;
        tempDialog?.show();                       // no toast: the dialog IS the message, and it must be read
      } else {
        toast(action === 'resets.approve' ? 'Password reset approved' : 'Password reset rejected');
      }
      after('rs:' + login);
      patch(key, (d) => ({ ...d, resets: d.resets.filter((r) => r.login !== login) }));
    } catch (err) { resetErr = errorMessage(err); }
    resetBusy = '';
  }
  const TYPES = $derived([['', 'All', items.length], ['signup', 'Sign-ups', data?.signUps.length || 0], ['reset', 'Resets', data?.resets.length || 0], ...(master ? [['reopen', 'Reopens', reopenN], ['newbatch', 'New batches', newBatchN]] : [])]);
</script>

{#if loadErr}<Banner onretry={() => refresh(true)}>{loadErr}</Banner>{/if}

{#if !wide.on && cur}
  <!-- a phone: the card is the page -->
  <button type="button" class="btn btn-text btn-sm -ml-2.5 mb-2" onclick={() => go(type)}><Icon name="back" size={16} />All requests</button>
  {@render card(cur)}
{:else}
  <div class="rq-top">
    <div class="seg rq-types" role="group" aria-label="Show">
      {#each TYPES as [t, label, n]}<button type="button" aria-pressed={type === t} onclick={() => go(t)}>{label}{#if n}<span class="rq-n">{n}</span>{/if}</button>{/each}
    </div>
    {#if batchIds.length > 1}
      <WheelSelect id="rq-batch" label="Batch" srLabel class="mb-0 sm:max-w-xs" bind:value={sel.id} options={[['', 'All my batches'], ...batchIds.map((b) => [b, nameOf(b)])]} />
    {/if}
  </div>

  {#if type === 'reopen' && master}
    <section aria-labelledby="rq-ro-h" id="rq-ro"><Reopens /></section>
  {:else if type === 'newbatch' && master}
    <section aria-labelledby="rq-nb-h" id="rq-nb">{#await import('../master/BatchRequests.svelte') then M}<M.default />{/await}</section>
  {:else if !data && !loadErr}
    <Skeleton kind="list" rows={3} />
  {:else if data}
    <!-- B2/B3 (Phase 22): every tab has the Reopens head — the title and its count on the left, Refresh at the
         page edge — instead of a Refresh sitting at the end of the list column, mid-page on a desktop -->
    <PageHeader id="rq-h" title={TITLE[type]} count={shown.length}>{#snippet actions()}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{/snippet}</PageHeader>
    <div class:rq-split={wide.on}>
      <div>
        {#if shown.length}
          <ul class="mb-list" aria-labelledby="rq-h">
            {#each shown as x (x.id)}
              {@const [kl, kt] = KIND[x.kind]}
              <li class="mrow" class:rq-on={paneItem?.id === x.id}>
                <a class="mrow-main" href={'#/requests?' + new URLSearchParams({ ...(type ? { type } : {}), open: x.id })} aria-current={paneItem?.id === x.id ? 'true' : undefined}>
                  <span class="avatar rq-av" aria-hidden="true">{x.name.trim().charAt(0).toUpperCase()}</span>
                  <span class="min-w-0 flex-1">
                    <b class="block truncate">{x.name}</b>
                    <span class="mrow-sub"><span class="status" data-tone={kt}>{kl}</span><span>{x.sub}</span><span>{relTime(x.at)}</span></span>
                  </span>
                  <Icon name="next" size={18} />
                </a>
              </li>
            {/each}
          </ul>
        {:else}
          <EmptyState icon="ok" title={type === 'signup' ? 'No sign-ups waiting' : type === 'reset' ? 'No password resets waiting' : 'No requests waiting'}>
            {type ? 'Tap All to see everything waiting.' : `New sign-ups, password resets${master ? ' and reopen requests' : ''} for your batches appear here.`}
          </EmptyState>
        {/if}
        {#if master && !type && reopenN}
          <a class="rowlink mt-3" href="#/requests?type=reopen"><span class="flex items-center gap-2"><Icon name="week" size={18} />Reopen requests waiting</span><span class="pill" data-tone="accent">{reopenN}</span></a>
        {/if}
        {#if master && reports}
          <a class="rowlink mt-3" href="#/wall"><span class="flex items-center gap-2"><Icon name="alert" size={18} />Wall reports to review</span><span class="pill" data-tone="accent">{reports}</span></a>
        {/if}
      </div>
      {#if wide.on}
        <div class="rq-pane" aria-live="polite">{#if paneItem}{@render card(paneItem)}{/if}</div>
      {/if}
    </div>
  {/if}
{/if}

{#snippet card(x)}
  {#if x.kind === 'signup'}
    {#key x.id}<SignUpCard s={x.s} onDone={(msg) => removeSignUp(x.s.phone, msg)} />{/key}
  {:else}
    {@const r = x.r}
    <article class="card mb-3">
      <p class="m-0 flex flex-wrap items-center gap-2 font-semibold">{r.name}{#if r.role && r.role !== 'DEVOTEE'}<span class="pill">{r.role.toLowerCase()}</span>{/if}</p>
      <p class="mb-3 mt-0 text-sm text-muted">{r.login} · asked {fmtDateTime(r.at)} ({relTime(r.at)})</p>
      {#if resetErr}<Banner>{resetErr}</Banner>{/if}
      <!-- anyone who knows the number can ask for a reset with their own new password: confirm with the person first -->
      <p class="banner warn" role="note"><Icon name="phone" size={18} /><span>Before approving, {#if !r.role || r.role === 'DEVOTEE'}call {r.name} on <a class="ilink" href={'tel:' + r.login}>{r.login}</a>{:else}speak to {r.name}{/if} and confirm they asked for a new password. Approving lets whoever made this request log in.</span></p>
      <div class="grid grid-cols-2 gap-2">
        <Button variant="danger" busy={resetBusy === r.login + 'resets.reject'} disabled={!!resetBusy} onclick={() => reset(r.login, 'resets.reject')}>Reject</Button>
        <Button variant="primary" busy={resetBusy === r.login + 'resets.approve'} disabled={!!resetBusy} onclick={() => reset(r.login, 'resets.approve')}>Approve</Button>
      </div>
    </article>
  {/if}
{/snippet}

<!-- the once-shown temporary password (decision 46); renders nothing until an approval returns one -->
<TempPassword bind:this={tempDialog} info={tempInfo} onclose={() => (tempInfo = null)} />

<style>
  .rq-top { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-3); }
  /* one row that never wraps or spills (a phone with four types: it scrolls sideways inside itself) */
  /* The row scrolls, but the last tab used to stop 3px past the edge on a 390px phone — the .seg
     padding and border are outside the scroll area, so "Reopens" was clipped (18 Oct 2026).
     Scroll padding gives the final tab somewhere to land, and the snap keeps it tidy. */
  .rq-types { display: flex; flex: 1 1 320px; max-width: 560px; min-width: 0; overflow-x: auto; scrollbar-width: none;
              scroll-padding-inline: 3px; scroll-snap-type: x proximity; overscroll-behavior-x: contain; }
  .rq-types button { scroll-snap-align: end; }
  .rq-types::-webkit-scrollbar { display: none; }
  .rq-types button { display: inline-flex; flex: 1 0 auto; align-items: center; justify-content: center; gap: 6px; padding-inline: 12px; white-space: nowrap; }
  @media (max-width: 420px) { .rq-types button { padding-inline: 9px; gap: 4px; } .rq-n { padding: 0 5px; min-width: 18px; } }
  .rq-n { min-width: 20px; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, transparent); font-size: var(--fs-caption); font-variant-numeric: tabular-nums; }
  .rq-av { flex: none; width: 36px; height: 36px; }
  .rq-split { display: grid; grid-template-columns: minmax(340px, 440px) minmax(0, 1fr); gap: var(--sp-5); align-items: start; }
  .rq-pane { min-width: 0; }
  .rq-on { background: var(--accent-soft); }
</style>
