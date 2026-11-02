<script>
  /*
   * Phases (the head, 22 Oct 2026 — ADR 0017): "set the phases on which the organisation functions — add, edit and all —
   * from the app itself, which the facilitators and all the batches work under."
   *
   * The dashboard's cycle (MetricsService.gs PHASES): Gaur Purnima (Jan–Apr), Jagannath (May–Aug), Kartik (Sep–Dec).
   * Add offers the NEXT one in that cycle with its name and dates filled in; the head changes anything, because a phase
   * may start a week early or late (ADR 0009). A closed phase is a record: only its name may be corrected.
   */
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { fmtDate, todayIST } from '../lib/dates.js';
  import { toast } from '../lib/pro.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Button from '../ui/Button.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Icon from '../ui/Icon.svelte';

  let { tools } = $props();
  let list = $state(null), err = $state('');
  const get = () => call('phases.list').then((d) => { list = d.phases; err = ''; }).catch((e) => (err = errorMessage(e)));
  get();

  const CYCLE = [
    { key: 'gaur', name: 'Gaur Purnima Phase', from: '01-01', to: '04-30' },
    { key: 'jagannath', name: 'Jagannath Phase', from: '05-01', to: '08-31' },
    { key: 'kartik', name: 'Kartik Phase', from: '09-01', to: '12-31' }
  ];
  const today = todayIST();
  /** the one a date falls in, as the server's currentPhase: open, covering it, latest start first */
  const current = $derived((list || []).filter((p) => p.state === 'OPEN' && p.startsOn <= today && p.endsOn >= today)
    .sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0] || null);
  /** the next in the cycle after the latest phase; with none, the one covering today */
  function nextPhase() {
    const last = [...(list || [])].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0];
    let i, year;
    if (last) {
      const m = +last.startsOn.slice(5, 7);
      i = (m <= 4 ? 0 : m <= 8 ? 1 : 2) + 1; year = +last.startsOn.slice(0, 4);
      if (i === 3) { i = 0; year += 1; }
    } else {
      const m = +today.slice(5, 7); i = m <= 4 ? 0 : m <= 8 ? 1 : 2; year = +today.slice(0, 4);
    }
    const c = CYCLE[i];
    return { phaseId: `${c.key}-${year}`, name: c.name, startsOn: `${year}-${c.from}`, endsOn: `${year}-${c.to}` };
  }

  // one sheet: adding (mode 'add') or editing a phase (mode = its id)
  let sheet = $state(), mode = $state(''), f = $state({ phaseId: '', name: '', startsOn: '', endsOn: '', targetsUntil: '', reason: '' }), fe = $state({}), serr = $state(''), busy = $state(false), confirmClose = $state(false);
  const editing = $derived(mode && mode !== 'add' ? (list || []).find((p) => p.phaseId === mode) : null);
  const closed = $derived(editing?.state === 'CLOSED');
  function add() { mode = 'add'; f = { ...nextPhase(), reason: '' }; fe = {}; serr = ''; confirmClose = false; sheet.showModal(); }
  function edit(p) { mode = p.phaseId; f = { phaseId: p.phaseId, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn, targetsUntil: p.targetsUntil || '', reason: '' }; fe = {}; serr = ''; confirmClose = false; sheet.showModal(); }
  const changed = $derived(mode === 'add' || (!!editing && (f.name !== editing.name || f.startsOn !== editing.startsOn || f.endsOn !== editing.endsOn || (f.targetsUntil || '') !== (editing.targetsUntil || ''))));

  async function save() {
    busy = true; fe = {}; serr = '';
    try {
      if (mode === 'add') {
        await call('phases.open', { phaseId: f.phaseId.trim(), name: f.name, startsOn: f.startsOn, endsOn: f.endsOn });
        toast(`${f.name} is set.`);
      } else {
        await call('phases.update', { phaseId: mode, name: f.name, startsOn: f.startsOn, endsOn: f.endsOn, targetsUntil: f.targetsUntil || '', ...(f.reason.trim() ? { reason: f.reason.trim() } : {}) });
        toast('Saved. Every card and board reads the new dates.');
      }
      sheet.close(); await get();
    } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) serr = errorMessage(e); }
    busy = false;
  }
  async function closePhase() {
    if (!confirmClose) { confirmClose = true; return; }
    busy = true; serr = '';
    try {
      await call('phases.close', { phaseId: mode, ...(f.reason.trim() ? { reason: f.reason.trim() } : {}) });
      toast(`${editing.name} is closed.`); sheet.close(); await get();
    } catch (e) { serr = errorMessage(e); }
    busy = false;
  }
  const span = (p) => `${fmtDate(p.startsOn)} – ${fmtDate(p.endsOn)}`;
</script>

<!-- no explanatory paragraph (Phase 24, V30) -->
<PageHeader title="Phases" sr meta={list ? `${list.length} ${list.length === 1 ? 'phase' : 'phases'}` : ''}>
  {#snippet actions()}{@render tools?.()}<button type="button" class="btn btn-primary btn-sm" onclick={add} disabled={!list}><Icon name="plus" size={16} />Add phase</button>{/snippet}
</PageHeader>

{#if err && !list}<Banner onretry={get}>{err}</Banner>
{:else if !list}<Skeleton kind="list" rows={3} />
{:else if !list.length}
  <EmptyState icon="week" title="No phases yet">Add the phase running now, and facilitators can set their targets.</EmptyState>
{:else}
  <ul class="list pz-list" aria-label="Phases">
    {#each list as p (p.phaseId)}
      <li><button type="button" class="lrow" onclick={() => edit(p)} aria-haspopup="dialog">
        <Icon name="week" size={20} />
        <span class="lmain"><span class="lt">{p.name}
          {#if current?.phaseId === p.phaseId}<span class="pill" data-tone="ok">Now</span>
          {:else if p.state === 'CLOSED'}<span class="pill">Closed</span>
          {:else if p.startsOn > today}<span class="pill" data-tone="info">Next</span>{/if}</span>
          <span class="ls">{span(p)} · {p.phaseId}</span></span>
        <Icon name="edit" size={18} /></button></li>
    {/each}
  </ul>
{/if}

<Sheet bind:this={sheet} titleId="pz-h" title={mode === 'add' ? 'Add a phase' : editing?.name || ''} sub={mode === 'add' ? 'The next in the cycle, filled in — change anything' : closed ? 'Closed: a record. Only the name can be corrected.' : 'Every card and board reads these dates'} onclose={() => (mode = '')}>
  {#if mode}
  {#if mode === 'add'}
    <TextInput id="pz-id" label="Short id" bind:value={f.phaseId} error={fe.phaseId} hint="Letters, digits and hyphens, e.g. gaur-2027. It cannot be changed later." />
  {/if}
  <TextInput id="pz-name" label="Name" bind:value={f.name} error={fe.name} />
  <DateInput id="pz-from" label="Starts on" bind:value={f.startsOn} error={fe.startsOn} disabled={closed} />
  <DateInput id="pz-to" label="Ends on" bind:value={f.endsOn} error={fe.endsOn} disabled={closed} />
  <!-- ADR 0018 (phase 21): the last day a set target may change; empty = the end of each person's first week -->
  {#if mode !== 'add'}<DateInput id="pz-tu" label="Targets fixed after" optional bind:value={f.targetsUntil} error={fe.targetsUntil} disabled={closed} hint="Empty: each person's first week" />{/if}
  {#if mode !== 'add'}
    <TextInput id="pz-why" label="Reason" optional bind:value={f.reason} error={fe.reason} hint="Kept in Activity with the change." />
  {/if}
  {#if serr}<p class="err" role="alert">{serr}</p>{/if}
  <div class="mt-3 grid grid-cols-2 gap-2">
    <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
    <Button variant="primary" disabled={!changed} {busy} onclick={save}>{mode === 'add' ? 'Add phase' : changed ? 'Save' : 'No change'}</Button>
  </div>
  {#if editing && !closed}
    <div class="pz-close">
      {#if confirmClose}<p class="m-0 text-sm" role="alert">Closing stops new filling on every card in {editing.name}. The cards stay readable. It cannot be reopened.</p>{/if}
      <Button variant="danger" {busy} onclick={closePhase}>{confirmClose ? `Close ${editing.name}` : 'Close this phase…'}</Button>
    </div>
  {/if}
  {/if}
</Sheet>

<style>
  .pz-list .lrow { width: 100%; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; min-height: 64px; }
  .pz-list .lt { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
  .pz-close { display: grid; gap: var(--sp-2); margin-top: var(--sp-4); padding-top: var(--sp-3); border-top: 1px solid var(--border); }
</style>
