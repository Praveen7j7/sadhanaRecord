<script>
  let { tools } = $props();   // the page's Export, from Admin.svelte, laid out in this page's own head
  // Batches (master): a list on phones, a table on wide screens; Edit opens a sheet (name, coordinators, active, pilot).
  import Status from '../ui/Status.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import { tick } from 'svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { applyBatch } from './sync.js';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import RadioGroup from '../ui/RadioGroup.svelte';
  import Button from '../ui/Button.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Seg from '../ui/Seg.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Icon from '../ui/Icon.svelte';
  import { refreshMeta } from '../lib/meta.js';
  import { batchColor } from '../lib/batchcolor.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { fmtDate } from '../lib/dates.js';
  import { isTrainingId } from '../lib/batchall.js';
  import { approving, nextNumber } from '../lib/batchreq.svelte.js';
  import { patch } from '../lib/cache.svelte.js';

  const be = entry('batches.list');
  const ce = entry('coordinators.list');
  const batches = $derived(be.data);
  const coords = $derived(ce.data || []);
  const coordName = (u) => coords.find((c) => c.username === u)?.name || u;
  let error = $state('');
  let note = $state('');
  let busyId = $state('');
  let fe = $state({});
  let editId = $state('');
  let ed = $state(null);       // the form in the sheet, seeded when it opens (a background refresh never overwrites it)
  let sheet = $state();

  const seed = (x) => ({ name: x.name, active: x.active, pilot: !!x.pilot, coordinatorLogins: [...x.coordinatorLogins], startedOn: x.startedOn || '', endsOn: x.endsOn || '' });
  /*
   * A training's dates and where it stands (Phase 22, J1; the head, 26 Oct 2026): the head sets its start and end; it ends
   * when a person ends it (Close batch); past its end date nothing happens by itself — it asks "end it?".
   */
  const trainingRunning = (b) => isTrainingId(b?.batchId) && !b.closedAt;
  const statusLine = (b) => (b.status === 'ENDED' ? `Ended ${fmtDate(String(b.closedAt).slice(0, 10))}`
    : b.status === 'PAST_END' ? `Past its end date (${fmtDate(b.endsOn)})` : b.endsOn ? `Running until ${fmtDate(b.endsOn)}` : 'Running · no end date yet');
  // "end it?": the head ends a training from its Close batch tab, as its coordinator does
  const endIt = (b) => { batchSel.id = b.batchId; location.hash = '#/closing'; };
  load('batches.list');
  load('coordinators.list');

  // a new batch (the head, 7 Oct 2026): its level gives the score card, the hearing journal and the view sheet
  let nsheet = $state(), nb = $state(null), nBusy = $state(false), nErr = $state(''), nFe = $state({});
  async function openNew() { nb = { batchId: '', name: '', level: 'SPS', pilot: false, number: '', startedOn: '', endsOn: '', coordinatorLogins: [], fromRequest: null }; nErr = ''; nFe = {}; await tick(); nsheet?.showModal(); }
  // the level picked: a numbered series offers its next number (VL2-51 exists → 52), which can still be typed over
  function pickLevel(v) { nb.level = v; if (['VL2', 'VL3', 'ETP'].includes(v)) nb.number = String(nextNumber(batches, v)); }
  /*
   * Approving a coordinator's request (Phase 23): the same form, pre-filled — the next number, the proposed dates, the
   * requester as coordinator — so a requested batch meets the same rules as any other (batches.create fromRequest). A
   * batch starts the day it is created (the head, 18 Oct 2026): one proposed for a later day is created on that day, or
   * started today instead.
   */
  const todayIso = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  let fromReq = $state(null);
  async function openFromRequest(r) {
    fromReq = r;
    nb = { batchId: '', name: '', level: r.level, pilot: false, number: String(nextNumber(batches, r.level)), startedOn: r.startsOn, endsOn: r.endsOn || '',
           coordinatorLogins: [r.by], fromRequest: r.id };
    nErr = ''; nFe = {}; await tick(); nsheet?.showModal();
  }
  // from Requests: the request waits in `approving` until this screen (and its list) is here
  $effect(() => { if (approving.req && batches && !nb) { const r = approving.req; approving.req = null; openFromRequest(r); } });
  const toggleNew = (u) => { nb.coordinatorLogins = nb.coordinatorLogins.includes(u) ? nb.coordinatorLogins.filter((x) => x !== u) : [...nb.coordinatorLogins, u]; };

  /*
   * The Vedic levels are numbered, the rest are not (ADR 0009, the head, 16 Oct 2026).
   *
   * VL-2 and VL-3 run as intakes of about three months and IYF numbers them: "Vedic Level 2, batch
   * 51". So for those two the form asks for the NUMBER and builds the id — a coordinator cannot
   * mistype VL2-51 into something nobody can close. SPS and everything after it run with no fixed
   * duration, keep their own short ids, and are never numbered.
   */
  const VEDIC_NAME = { VL2: 'Vedic Level 2', VL3: 'Vedic Level 3', ETP: 'ETP' };
  /** How a batch's level reads in the list. "Level VL2" is not what anyone calls it. */
  const levelOf = (b) => VEDIC_NAME[b.level] || `Level ${b.level || b.batchId}`;
  const isVedic = $derived(nb?.level === 'VL2' || nb?.level === 'VL3' || nb?.level === 'ETP');
  // what will actually be stored, shown back to them before they commit
  const vedicId = $derived(isVedic && nb?.number ? `${nb.level}-${String(nb.number).replace(/\D/g, '')}` : '');
  const vedicName = $derived(isVedic && nb?.number ? `${VEDIC_NAME[nb.level]} · Batch ${String(nb.number).replace(/\D/g, '')}` : '');
  async function create(e) {
    e?.preventDefault();
    if (nBusy) return;
    nBusy = true; nErr = ''; nFe = {};
    try {
      const vedic = isVedic;
      // its coordinators at creation, and the request it fulfils (Phase 23)
      const more = { coordinatorLogins: nb.coordinatorLogins, ...(nb.fromRequest ? { fromRequest: nb.fromRequest } : {}) };
      const b = await call('batches.create', vedic
        ? { batchId: vedicId, name: vedicName, level: nb.level, pilot: nb.pilot, startedOn: nb.startedOn, ...(nb.level === 'ETP' ? { endsOn: nb.endsOn } : {}), ...more }
        : { batchId: nb.batchId.trim().toUpperCase(), name: nb.name, level: nb.level, pilot: nb.pilot, ...more });
      applyBatch(b); refreshMeta().catch(() => {});
      if (nb.fromRequest) patch('batchreq.list', (x) => ({ ...x, waiting: Math.max(0, (x.waiting || 1) - 1), requests: x.requests.map((q) => (q.id === nb.fromRequest ? { ...q, state: 'STARTED', stateName: 'Started', batchId: b.batchId, batchName: b.name } : q)) }));
      toast(b.coordinatorLogins?.length ? `Added ${b.name}, coordinated by ${b.coordinatorNames.join(', ')}.` : `Added ${b.name}. Add its coordinators with Edit.`);
      nsheet?.close();
    } catch (err) { nFe = fieldErrors(err); nErr = Object.keys(nFe).length ? '' : errorMessage(err); }
    nBusy = false;
  }

  async function openEdit(b) { editId = b.batchId; ed = seed(b); fe = {}; error = ''; note = ''; rules = null; await tick(); sheet?.showModal(); loadRules(b); }

  /*
   * Promotion rules (ADR 0017): who in this batch is ready for the next level is judged by these. Each batch starts on
   * the standard set for its level (eligible.js STANDARD, the dashboard's PROMOTION_RULES); the head may set the batch's
   * own, or go back to the standard. TRD and BVS are not on the ladder, so they have none to set.
   */
  const KEYS = ['att', 'chant', 'sad', 'night', 'cls', 'pr'];
  const FRACTION = new Set(['att', 'night']);       // stored 0–1, read as a percentage
  const UNIT = { att: '% of classes held', chant: 'rounds a day', sad: 'average score', night: '% of weeks', cls: 'class score', pr: '' };
  let rules = $state(null), rsheet = $state(), rd = $state({}), rBusy = $state(false), rErr = $state(''), rFe = $state({}), rWhy = $state('');
  async function loadRules(b) {
    try { const r = await call('criteria.get', { batchId: b.batchId }); if (editId === b.batchId) rules = r; } catch { rules = null; }
  }
  const show = (k, v) => (k === 'pr' ? 'all four kept' : FRACTION.has(k) ? `${Math.round(v * 100)}%` : String(v));
  const summary = (c) => Object.keys(c || {}).map((k) => `${rules.labels[k]} ${show(k, c[k])}`).join(' · ') || 'none — nobody is declared ready';
  async function openRules() {
    const c = rules.criteria;
    rd = Object.fromEntries(KEYS.map((k) => [k, { on: k in c, v: k in c ? (k === 'pr' ? 'YES' : FRACTION.has(k) ? String(Math.round(c[k] * 100)) : String(c[k])) : '' }]));
    rErr = ''; rFe = {}; rWhy = ''; await tick(); rsheet?.showModal();
  }
  async function saveRules(back = false) {
    rBusy = true; rErr = ''; rFe = {};
    try {
      const criteria = back ? [] : KEYS.filter((k) => rd[k].on).map((k) => ({ criterion: k,
        minValue: k === 'pr' ? 'YES' : FRACTION.has(k) ? String(Number(rd[k].v) / 100) : String(rd[k].v).trim() }));
      await call('criteria.set', { batchId: rules.batchId, criteria, ...(rWhy.trim() ? { reason: rWhy.trim() } : {}) });
      rules = await call('criteria.get', { batchId: rules.batchId });
      toast(back ? 'Back on the standard rules.' : 'Promotion rules saved.');
      rsheet?.close();
    } catch (err) { rFe = fieldErrors(err); rErr = Object.keys(rFe).length ? 'Check the highlighted rule.' : errorMessage(err); }
    rBusy = false;
  }
  function toggle(u) { ed.coordinatorLogins = ed.coordinatorLogins.includes(u) ? ed.coordinatorLogins.filter((x) => x !== u) : [...ed.coordinatorLogins, u]; }

  async function save(e) {
    e?.preventDefault();
    if (busyId) return;
    const id = editId;
    busyId = id; error = ''; note = ''; fe = {};
    try {
      const was = batches?.find((x) => x.batchId === id);
      // a running training's dates go only when changed (an ended one's are a record and are not offered)
      const dates = trainingRunning(was) ? { ...(ed.startedOn !== (was.startedOn || '') ? { startedOn: ed.startedOn } : {}), ...(ed.endsOn !== (was.endsOn || '') ? { endsOn: ed.endsOn } : {}) } : {};
      const b = await call('batches.update', { batchId: id, name: ed.name, active: ed.active, pilot: ed.pilot, coordinatorLogins: ed.coordinatorLogins, ...dates });
      applyBatch(b);
      toast(`Saved ${b.name}`);
      sheet?.close();
    } catch (err) {
      const m = fieldErrors(err);
      fe = m;
      error = Object.keys(m).length ? '' : errorMessage(err);
    }
    busyId = '';
  }
</script>

{#snippet flags(b)}
  {#if b.status}<Status tone={b.status === 'PAST_END' ? 'warn' : b.status === 'RUNNING' ? 'ok' : ''} label={statusLine(b)} />{/if}
  <Status tone={b.active ? 'ok' : ''} label={b.active ? 'Offered at sign-up' : 'Not offered at sign-up'} />{#if b.pilot}<span class="pill" data-tone="info">Pilot</span>{/if}{#if !b.coordinatorLogins.length}<Status tone="warn" label="No coordinator" />{/if}
{/snippet}

<!-- the count, not a sentence about levels (the head's rule: the screen explains itself; the level is on every row) -->
<PageHeader title="Batch setup" sr meta={batches ? `${batches.length} ${batches.length === 1 ? 'batch' : 'batches'}` : ''}>
  {#snippet actions()}
    {#if batches}<Refreshing on={be.refreshing || ce.refreshing} onrefresh={() => load('batches.list', undefined, { force: true })} />{/if}
    {@render tools?.()}
    <Button variant="primary" class="w-auto" onclick={openNew}><Icon name="plus" size={18} />Add batch</Button>
  {/snippet}
</PageHeader>
{#if error && !editId}<Banner>{error}</Banner>{/if}
<!-- the batches coordinators asked to start (Phase 23): approve opens the form below, pre-filled -->
{#await import('./BatchRequests.svelte') then M}<M.default compact onapprove={openFromRequest} />{/await}
{#if be.error && !batches}<Banner onretry={() => load('batches.list', undefined, { force: true })}>{errorMessage(be.error)}</Banner>{/if}
{#if !batches && !be.error}<Skeleton kind="list" />
{:else if batches}
  {#if !batches.length}<EmptyState class="card" icon="grid" title="No batches">Add the first batch with Add batch.</EmptyState>
  {:else}
    <ul class="list tbl-narrow" aria-label="Batches">
      {#each batches as b (b.batchId)}
        <!-- the whole row opens Edit; the ID shows only when it differs from the name -->
        <li><button type="button" class="lrow bt-row" onclick={() => openEdit(b)} aria-label={'Edit ' + b.name}>
          <span class="lmain"><span class="lt"><i class="bt-sw" style:--sw={batchColor(b)} aria-hidden="true"></i>{b.name}{#if b.batchId !== b.name} <span class="bt-id">{b.batchId}</span>{/if}</span>
            <span class="ls">{levelOf(b)}{#if b.closedAt} · closed{/if} · {b.coordinatorLogins.length ? 'Coordinator: ' + b.coordinatorLogins.map(coordName).join(', ') : 'add a coordinator in Edit'}</span>
            <span class="mt-1 flex flex-wrap gap-x-3 gap-y-1">{@render flags(b)}</span></span>
          <Icon name="next" size={18} />
        </button>
        {#if b.status === 'PAST_END'}<button type="button" class="btn btn-text btn-sm bt-end" onclick={() => endIt(b)}>End it?</button>{/if}</li>
      {/each}
    </ul>
    <table class="tbl tbl-wide">
      <thead><tr><th>Batch</th><th>ID</th><th>Level</th><th>Coordinators</th><th>Status</th><th class="num"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>
        {#each batches as b (b.batchId)}
          <tr><td class="font-semibold"><i class="bt-sw" style:--sw={batchColor(b)} aria-hidden="true"></i>{b.name}</td><td class="tabular">{b.batchId}</td><td>{levelOf(b)}{#if b.closedAt} · closed{/if}</td><td>{b.coordinatorLogins.length ? b.coordinatorLogins.map(coordName).join(', ') : '—'}</td>
            <td><span class="flex flex-wrap gap-1">{@render flags(b)}</span></td>
            <!-- the name is in the accessible name, not only in the row: a screen reader announced eight buttons
                 all called "Edit" (sweep, 19 Oct). The visible word stays "Edit" — the column header says what. -->
            <td><div class="acts">{#if b.status === 'PAST_END'}<Button size="sm" aria-label={'End ' + b.name} onclick={() => endIt(b)}>End it?</Button>{/if}<Button size="sm" aria-label={'Edit ' + b.name} onclick={() => openEdit(b)}>Edit</Button></div></td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<Sheet bind:this={sheet} wide dismiss={false} titleId="bt-h" title={ed ? `Edit ${ed.name || editId}` : ''} sub={editId} onclose={() => { editId = ''; }}>
  {#if ed}
    <form onsubmit={save} novalidate>
      {#if error}<Banner>{error}</Banner>{/if}
      <TextInput id={'bn-' + editId} label="Name" bind:value={ed.name} error={fe.name} />
      {#if trainingRunning(batches?.find((x) => x.batchId === editId))}
        <div class="pair">
          <DateInput id={'bst-' + editId} label="Started on" bind:value={ed.startedOn} error={fe.startedOn} autocomplete="off" />
          <DateInput id={'ben-' + editId} label="Ends on" bind:value={ed.endsOn} error={fe.endsOn} autocomplete="off" />
        </div>
      {/if}
      <RadioGroup legend="Coordinators" error={fe.coordinatorLogins}>
        {#each coords as c (c.username)}
          <Checkbox checked={ed.coordinatorLogins.includes(c.username)} onchange={() => toggle(c.username)} label={c.name} desc={c.username} />
        {/each}
      </RadioGroup>
      <Toggle label="Active" desc="Shown on the sign-up page" bind:checked={ed.active} />
      <Toggle label="Pilot batch" bind:checked={ed.pilot} class="mb-3" />
      {#if rules?.measured}
        <button type="button" class="lrow bt-rules" onclick={openRules} aria-haspopup="dialog">
          <Icon name="check" size={20} />
          <span class="lmain"><span class="lt">Promotion rules{#if !rules.custom} <span class="pill">Standard</span>{/if}</span>
            <span class="ls">{summary(rules.criteria)}</span></span>
          <Icon name="next" size={18} />
        </button>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
        <Button variant="primary" type="submit" busy={busyId === editId} disabled={!!busyId}>Save</Button>
      </div>
    </form>
  {/if}
</Sheet>

<Sheet bind:this={rsheet} titleId="bt-rules" title="Promotion rules" sub={rules ? `${ed?.name || rules.batchId} — who is ready for the next level` : ''} onclose={() => (rd = {})}>
  {#if rules && rd.att}
    {#if rErr}<Banner>{rErr}</Banner>{/if}
    <ul class="list bt-rlist" aria-label="Rules">
      {#each KEYS as k (k)}
        <li class="bt-rrow">
          <Checkbox card={false} checked={rd[k].on} onchange={() => (rd[k] = { ...rd[k], on: !rd[k].on, v: rd[k].v || (k === 'pr' ? 'YES' : '') })}
            label={rules.labels[k]} desc={rules.standard[k] !== undefined ? `standard: ${show(k, rules.standard[k])}` : 'not in the standard set'} />
          {#if rd[k].on && k !== 'pr'}
            <TextInput id={'br-' + k} label="" class="mb-0 bt-rnum" inputmode="decimal" bind:value={rd[k].v} hint={UNIT[k]} />
          {/if}
        </li>
      {/each}
    </ul>
    <TextInput id="br-why" label="Reason" optional bind:value={rWhy} hint="Kept in Activity." />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => rsheet.close()}>Cancel</button>
      <Button variant="primary" busy={rBusy} onclick={() => saveRules(false)}>Save rules</Button>
    </div>
    {#if rules.custom}<button type="button" class="btn btn-text mt-2" disabled={rBusy} onclick={() => saveRules(true)}>Back to the standard rules</button>{/if}
  {/if}
</Sheet>

<Sheet bind:this={nsheet} dismiss={false} titleId="bt-new" title={fromReq && nb?.fromRequest ? 'Start the batch asked for' : 'Add a batch'} sub={fromReq && nb?.fromRequest ? `${fromReq.byName} asked for it` : 'Its level sets what the batch collects'} onclose={() => { nb = null; fromReq = null; }}>
  {#if nb}
    <form onsubmit={create} novalidate>
      {#if nErr}<Banner>{nErr}</Banner>{/if}
      <!--
        A list, not a segmented control (the head, 17 Oct 2026). Eight levels in a Seg wrapped
        "VL-2" onto two lines and clipped "TRD" off the edge of a 390px phone, and the list only
        grows: ETP and TRD arrived today. A Seg is for a few short choices that fit on one line.

        Each level says what it is, because "BVS" and "TRD" mean nothing to somebody who has not
        been told, and this is the one screen where a wrong choice sets a batch's whole shape.
      -->
      <WheelSelect id="bl-new" label="Level" value={nb.level} onchange={pickLevel} error={nFe.level}
        options={[['VL2', 'VL-2 — Vedic Level 2'], ['VL3', 'VL-3 — Vedic Level 3'], ['ETP', 'ETP — training batch'],
                  ['SPS', 'SPS'], ['DPS', 'DPS'], ['BSS', 'BSS — brahmachari aspirants'], ['BVS', 'BVS — those who will marry'],
                  ['TRD', 'TRD — temple residents']]} />
      {#if isVedic}
        <!-- A Vedic intake is numbered, and the number is all we ask for: the id and the name are
             built from it, so VL2-51 cannot be mistyped into a batch nobody can close. -->
        <div class="pair">
          <TextInput id="bnum-new" label="Batch number" bind:value={nb.number} error={nFe.batchId} placeholder="e.g. 51" inputmode="numeric" autocomplete="off" maxlength="4" />
          <DateInput id="bst-new" label="Started on" bind:value={nb.startedOn} error={nFe.startedOn} autocomplete="off" />
        </div>
        <!-- a training's dates are its own (Phase 22, J1): it ends when a person ends it, and asks once this date has passed -->
        {#if nb.level === 'ETP'}<DateInput id="ben-new" label="Ends on" bind:value={nb.endsOn} error={nFe.endsOn} autocomplete="off" />{/if}
        {#if nb.fromRequest && nb.startedOn > todayIso}
          <p class="m-0 mb-3 text-sm text-muted">Asked to start on {fmtDate(nb.startedOn)}. A batch starts the day it is created: create it then, or <button type="button" class="btn btn-text btn-sm h-auto p-0 align-baseline" onclick={() => (nb.startedOn = todayIso)}>start it today</button>.</p>
        {/if}
        {#if vedicId}
          <p class="m-0 mb-3 text-sm text-muted">Saved as <strong>{vedicId}</strong> — devotees will see “{vedicName}”.</p>
        {/if}
      {:else}
        <div class="pair">
          <TextInput id="bn-new" label="Name" bind:value={nb.name} error={nFe.name} placeholder="e.g. SPS Group 3" autocomplete="off" />
          <TextInput id="bi-new" label="Short ID" bind:value={nb.batchId} error={nFe.batchId} placeholder="e.g. SPS3" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8" />
        </div>
      {/if}
      <!-- its coordinators now, rather than an Edit afterwards (Phase 23); an approved request's requester is ticked -->
      <RadioGroup legend="Coordinators" error={nFe.coordinatorLogins}>
        {#each coords as c (c.username)}
          <Checkbox checked={nb.coordinatorLogins.includes(c.username)} onchange={() => toggleNew(c.username)} label={c.name} desc={c.username} />
        {/each}
      </RadioGroup>
      <Toggle label="Pilot batch" bind:checked={nb.pilot} class="mb-3" />
      <div class="grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-outline" onclick={() => nsheet.close()}>Cancel</button>
        <Button variant="primary" type="submit" busy={nBusy}>{nb.fromRequest ? 'Start the batch' : 'Add batch'}</Button>
      </div>
    </form>
  {/if}
</Sheet>

<style>
  .bt-rules { width: 100%; margin: 0 0 var(--sp-3); border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); font: inherit; text-align: left; cursor: pointer; }
  .bt-rlist { margin: 0 0 var(--sp-3); padding: 0; list-style: none; }
  .bt-rrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--sp-2) var(--sp-3); padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--border); }
  .bt-rrow:last-child { border-bottom: 0; }
  .bt-rrow :global(.bt-rnum) { width: 9rem; }
  .bt-sw { display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 3px; background: var(--sw); vertical-align: 0; }
  .bt-row { width: 100%; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
  .bt-end { margin: 0 0 var(--sp-2) var(--sp-3); }
  .bt-id { margin-left: 4px; padding: 0 6px; border-radius: 6px; background: var(--surface-2); font-size: var(--fs-caption); font-weight: 600; color: var(--text-muted); font-variant-numeric: tabular-nums; }
</style>
