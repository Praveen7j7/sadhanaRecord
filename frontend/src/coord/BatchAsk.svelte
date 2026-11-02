<script>
  // Asking the IYF head to start a new batch (Phase 23; the head, 27 Oct 2026: "the coordinators can even initiate a
  // request, and the approval for the batch beginning the admin gives"). A VL-2 or VL-3 intake, or a training (ETP) with
  // its end date; then where each request stands — Waiting (withdraw it), Started (open the batch), Declined (the head's
  // note). The head starts it in Admin › Batch setup.
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { fmtDate } from '../lib/dates.js';
  import { relTime } from '../lib/ann.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { toast } from '../lib/pro.svelte.js';
  import { LEVEL_NAME } from '../lib/batchreq.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Button from '../ui/Button.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import TextArea from '../ui/TextArea.svelte';
  import Status from '../ui/Status.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';

  const e = entry('batchreq.list');
  const refresh = (force = false) => load('batchreq.list', undefined, { force });
  refresh(true);
  const list = $derived(e.data?.requests || []);
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  let f = $state({ level: 'VL2', startsOn: today, endsOn: '', note: '' });
  let busy = $state(false), err = $state(''), fe = $state({}), wBusy = $state(0);
  const TONE = { WAITING: 'warn', STARTED: 'ok', DECLINED: 'bad', WITHDRAWN: '' };

  async function ask(ev) {
    ev?.preventDefault();
    if (busy) return;
    busy = true; err = ''; fe = {};
    try {
      const r = await call('batchReq.create', { level: f.level, startsOn: f.startsOn, ...(f.level === 'ETP' ? { endsOn: f.endsOn } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) });
      patch('batchreq.list', (x) => ({ ...(x || {}), waiting: (x?.waiting || 0) + 1, requests: [r, ...(x?.requests || [])] }));
      toast(`Asked: a ${r.levelName} batch from ${fmtDate(r.startsOn)}. The IYF head decides.`);
      f = { level: f.level, startsOn: today, endsOn: '', note: '' };
    } catch (x) { fe = fieldErrors(x); err = Object.keys(fe).length ? '' : errorMessage(x); }
    busy = false;
  }
  async function withdraw(r) {
    wBusy = r.id;
    try {
      const n = await call('batchReq.withdraw', { id: r.id });
      patch('batchreq.list', (x) => ({ ...x, waiting: Math.max(0, (x.waiting || 1) - 1), requests: x.requests.map((q) => (q.id === r.id ? n : q)) }));
      toast('Request withdrawn');
    } catch (x) { toast(errorMessage(x)); }
    wBusy = 0;
  }
  const openBatch = (id) => { batchSel.id = id; location.hash = '#/batch'; };
</script>

<section class="card mb-4" aria-labelledby="na-h">
  <h2 id="na-h" class="m-0 mb-3 text-lg">Ask to start a batch</h2>
  <form onsubmit={ask} novalidate>
    {#if err}<Banner>{err}</Banner>{/if}
    <WheelSelect id="na-level" label="Level" value={f.level} onchange={(v) => (f.level = v)} error={fe.level}
      options={[['VL2', 'VL-2 — Vedic Level 2'], ['VL3', 'VL-3 — Vedic Level 3'], ['ETP', 'ETP — training batch']]} />
    <div class="pair">
      <DateInput id="na-start" label="Start on" bind:value={f.startsOn} error={fe.startsOn} autocomplete="off" />
      {#if f.level === 'ETP'}<DateInput id="na-end" label="Ends on" bind:value={f.endsOn} error={fe.endsOn} autocomplete="off" />{/if}
    </div>
    <TextArea id="na-note" label="Note for the IYF head" optional maxlength={300} counter bind:value={f.note} error={fe.note} />
    <Button variant="primary" type="submit" {busy} class="w-full sm:w-auto">Ask the IYF head</Button>
  </form>
</section>

{#if e.error && !e.data}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>
{:else if !e.data}<Skeleton kind="list" rows={2} />
{:else}
  <PageHeader id="na-mine" title="My requests">{#snippet actions()}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{/snippet}</PageHeader>
  <ul class="m-0 grid list-none gap-3 p-0 md:grid-cols-2" aria-labelledby="na-mine">
    {#each list as r (r.id)}
      <li class="card">
        <p class="m-0 flex flex-wrap items-center gap-2 font-semibold">{LEVEL_NAME[r.level] || r.levelName}<Status tone={TONE[r.state]} label={r.stateName} /></p>
        <p class="m-0 mt-1 text-sm text-muted">From {fmtDate(r.startsOn)}{#if r.endsOn} to {fmtDate(r.endsOn)}{/if} · asked {relTime(r.at)}</p>
        {#if r.note}<p class="m-0 mt-2 text-sm">{r.note}</p>{/if}
        {#if r.state === 'DECLINED' && r.decisionNote}<blockquote class="serif m-0 mt-2 border-l-2 border-line pl-3 italic">&ldquo;{r.decisionNote}&rdquo; — {r.decidedByName}</blockquote>{/if}
        {#if r.state === 'WAITING'}
          <button type="button" class="btn btn-outline btn-sm mt-3" disabled={wBusy === r.id} onclick={() => withdraw(r)}>Withdraw</button>
        {:else if r.state === 'STARTED' && r.batchId}
          <button type="button" class="btn btn-primary btn-sm mt-3" onclick={() => openBatch(r.batchId)}>Open {r.batchName || r.batchId}</button>
        {/if}
      </li>
    {:else}
      <EmptyState tag="li" class="md:col-span-2" icon="plus" title="Nothing asked yet">Ask above; the IYF head starts the batch or says why not.</EmptyState>
    {/each}
  </ul>
{/if}
