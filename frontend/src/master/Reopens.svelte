<script>
  let { tools } = $props();   // the page's Export, from Admin.svelte, laid out in this page's own head
  import Icon from '../ui/Icon.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  // Master: coordinators' requests to reopen a missed week. Reopen (open until a time, by default two days ahead,
  // 9 PM) or reject; each with a reason.
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { cachedMeta } from '../lib/meta.js';
  import { weekLabel } from '../lib/dates.js';
  import { fmtDateTime } from '../lib/validate.js';
  import { defaultOpenUntil, istIso } from '../lib/staff.js';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Button from '../ui/Button.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';

  const e = entry('reopen.list');
  const refresh = (force = false) => load('reopen.list', undefined, { force });
  refresh();
  const list = $derived(e.data?.requests || []);
  const nameOf = (id) => (cachedMeta().batches || []).find((b) => b.batchId === id)?.name || id;
  const k = (r) => r.login + '|' + r.weekId;

  let open = $state('');      // 'reopen|key' or 'reject|key'
  let reason = $state('');
  let until = $state(defaultOpenUntil());
  let busy = $state(false);
  let err = $state('');
  let fe = $state({});
  let notes = $state([]);
  function start(kind, r) { open = kind + '|' + k(r); reason = kind === 'reopen' ? r.reason : ''; until = defaultOpenUntil(); err = ''; fe = {}; }
  async function act(kind, r) {
    busy = true; err = ''; fe = {};
    try {
      const res = kind === 'reopen'
        ? await call('weeks.reopen', { login: r.login, weekId: r.weekId, reason: reason.trim(), openUntil: istIso(until) })
        : await call('reopen.reject', { login: r.login, weekId: r.weekId, reason: reason.trim() });
      patch('reopen.list', (x) => ({ ...x, requests: x.requests.filter((q) => k(q) !== k(r)) }));
      toast(kind === 'reopen' ? `${r.name}: the week of ${weekLabel(r.weekId)} is open until ${fmtDateTime(res.openUntil)}.` : `${r.name}: request rejected.`);
      open = '';
    } catch (x) { err = errorMessage(x); fe = fieldErrors(x); }
    busy = false;
  }
</script>

{#if e.error && !e.data}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !e.data && !e.error}<Skeleton kind="list" rows={2} />
{:else if e.data}
  <!-- no explanatory paragraph (Phase 24, V30): what to do is on each card's buttons -->
  <PageHeader id="rq-ro-h" title="Reopen requests" count={list.length}>{#snippet actions()}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{@render tools?.()}{/snippet}</PageHeader>
  <ul class="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
    {#each list as r (k(r))}
      <li class="card">
        <p class="m-0 font-semibold"><a class="ilink" href={'#/devotee/' + encodeURIComponent(r.login)}>{r.name}</a> <span class="font-normal text-muted">· {nameOf(r.batchId)}</span></p>
        <p class="ro-when m-0 text-sm text-muted"><Icon name="clock" size={16} />Week of {weekLabel(r.weekId)} · asked by {r.by} on {fmtDateTime(r.at)}</p>
        <blockquote class="serif m-0 mt-2 border-l-2 border-line pl-3 italic">&ldquo;{r.reason}&rdquo;</blockquote>
        {#if open.endsWith('|' + k(r))}
          {@const kind = open.split('|')[0]}
          <div class="confirm {kind === 'reopen' ? '' : 'danger'}">
            <TextInput id="ro-reason" label={kind === 'reopen' ? 'Reason (kept in the log)' : 'Why not'} bind:value={reason} error={fe.reason} maxlength="200" autocomplete="off" />
            {#if kind === 'reopen'}<DateInput id="ro-until" label="Open until (Indian time)" time bind:value={until} error={fe.openUntil} />{/if}
            <ValidationMessage error={err} />
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="btn btn-outline" onclick={() => (open = '')}>Cancel</button>
              <Button variant={kind === 'reopen' ? 'primary' : 'danger-solid'} {busy} onclick={() => act(kind, r)}>{kind === 'reopen' ? 'Reopen' : 'Reject'}</Button>
            </div>
          </div>
        {:else}
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-danger" onclick={() => start('reject', r)}>Reject…</button>
            <button type="button" class="btn btn-primary" onclick={() => start('reopen', r)}>Reopen…</button>
          </div>
        {/if}
      </li>
    {:else}
      <EmptyState tag="li" class="md:col-span-2" icon="ok" title="No requests are waiting">When a coordinator asks to reopen a missed week, it appears here.</EmptyState>
    {/each}
  </ul>
{/if}

<style>
  .ro-when { display: flex; align-items: center; gap: var(--sp-2); }
  .ro-when :global(svg) { flex: none; }
</style>
