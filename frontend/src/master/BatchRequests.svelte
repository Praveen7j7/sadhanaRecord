<script>
  // The head's list of batches the coordinators asked to start (Phase 23; worker batchreq.js): approve — which opens Batch
  // setup's own form, pre-filled, so a new batch has one set of rules — or decline with a note. Used by Requests (the
  // "New batches" type) and, as a short list, by Admin › Batch setup.
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { fmtDate } from '../lib/dates.js';
  import { relTime } from '../lib/ann.js';
  import { approving } from '../lib/batchreq.svelte.js';
  import { toast } from '../lib/pro.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Button from '../ui/Button.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  // compact: Batch setup's short list (no head, nothing when none wait); onapprove: open the create form here
  let { compact = false, onapprove = null } = $props();

  const e = entry('batchreq.list');
  const refresh = (force = false) => load('batchreq.list', undefined, { force });
  refresh();
  const waiting = $derived((e.data?.requests || []).filter((r) => r.state === 'WAITING'));
  let declining = $state(0), note = $state(''), busy = $state(false), err = $state(''), fe = $state({});
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

  // in Batch setup the form is right here; from Requests the request waits in `approving` until Batch setup opens
  function approve(r) {
    if (onapprove) { onapprove(r); return; }
    approving.req = r; location.hash = '#/batches';
  }
  async function decline(r) {
    busy = true; err = ''; fe = {};
    try {
      await call('batchReq.decide', { id: r.id, decision: 'decline', note: note.trim() });
      patch('batchreq.list', (x) => ({ ...x, waiting: Math.max(0, (x.waiting || 1) - 1), requests: x.requests.map((q) => (q.id === r.id ? { ...q, state: 'DECLINED', stateName: 'Declined', decisionNote: note.trim() } : q)) }));
      toast(`Declined: ${r.levelName} for ${r.byName}`);
      declining = 0; note = '';
    } catch (x) { fe = fieldErrors(x); err = Object.keys(fe).length ? '' : errorMessage(x); }
    busy = false;
  }
</script>

{#if e.error && !e.data}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>
{:else if !e.data}{#if !compact}<Skeleton kind="list" rows={2} />{/if}
{:else if !compact || waiting.length}
  {#if !compact}
    <PageHeader id="rq-nb-h" title="New batches" count={waiting.length}>{#snippet actions()}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{/snippet}</PageHeader>
  {:else}
    <h3 class="m-0 mb-2 text-base" id="bt-asked">Asked to start <span class="pill align-middle" data-tone="accent">{waiting.length}</span></h3>
  {/if}
  <ul class="m-0 grid list-none gap-3 p-0 {compact ? 'mb-4' : 'md:grid-cols-2'}" aria-labelledby={compact ? 'bt-asked' : 'rq-nb-h'}>
    {#each waiting as r (r.id)}
      <li class="card">
        <p class="m-0 font-semibold">{r.levelName} <span class="font-normal text-muted">· asked by {r.byName}, {relTime(r.at)}</span></p>
        <p class="m-0 mt-1 text-sm">From {fmtDate(r.startsOn)}{#if r.endsOn} to {fmtDate(r.endsOn)}{/if}{#if r.startsOn > today} <span class="pill" data-tone="info">starts later</span>{/if}</p>
        {#if r.note}<blockquote class="serif m-0 mt-2 border-l-2 border-line pl-3 italic">&ldquo;{r.note}&rdquo;</blockquote>{/if}
        {#if declining === r.id}
          <div class="confirm danger mt-3">
            <TextInput id={'br-note-' + r.id} label="Why not (the coordinator reads this)" bind:value={note} error={fe.note} maxlength="300" autocomplete="off" />
            <ValidationMessage error={err} />
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="btn btn-outline" onclick={() => (declining = 0)}>Cancel</button>
              <Button variant="danger-solid" {busy} onclick={() => decline(r)}>Decline</Button>
            </div>
          </div>
        {:else}
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-danger" onclick={() => { declining = r.id; note = ''; err = ''; fe = {}; }}>Decline…</button>
            <button type="button" class="btn btn-primary" onclick={() => approve(r)}>Approve…</button>
          </div>
        {/if}
      </li>
    {:else}
      <EmptyState tag="li" class="md:col-span-2" icon="ok" title="No new batches asked for">When a coordinator asks to start a VL-2, VL-3 or training batch, it appears here.</EmptyState>
    {/each}
  </ul>
{/if}
