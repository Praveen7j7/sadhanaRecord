<script>
  import '../styles/screens.css';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  // Coordinator tools for one batch (loaded only when first opened): status board with attendance, filling chart.
  // The batch is the one chosen in the menu (or here). "All my batches" ('' in batchSel, as on the menu and Requests) is
  // one combined view on Status and Filling chart when the person holds more than one class batch (Phase 22 F1); on the
  // tabs that work on one batch (group leaders, ready to move up, close, a training's students and board) it is the first.
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { cachedMeta, loadMeta, staffBatches } from '../lib/meta.js';
  import BatchStatus from './BatchStatus.svelte';
  import Stats from './Stats.svelte';
  import Members from './Members.svelte';
  import Leaders from './Leaders.svelte';
  import Closing from './Closing.svelte';
  import FacilitationBoard from './FacilitationBoard.svelte';
  import Students from './Students.svelte';
  import Ready from './Ready.svelte';
  import Tabs from '../ui/Tabs.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import ExportButton from '../ui/ExportButton.svelte';
  import { isTrainingId } from '../lib/batchall.js';
  import Banner from '../ui/Banner.svelte';
  import { fmtDate } from '../lib/dates.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { refreshAccess } from '../lib/session.svelte.js';
  import { refreshMeta } from '../lib/meta.js';
  let { tab } = $props();

  const sc = $derived(scopesOf(session.user));
  let meta = $state(cachedMeta());
  loadMeta().then((d) => (meta = d)).catch(() => {});
  const ids = $derived(sc.master ? staffBatches(meta).map((b) => b.batchId) : sc.coordinator);
  const nameOf = (id) => staffBatches(meta).find((b) => b.batchId === id)?.name || id;
  // class batches only in the combined view: a training's people are counted in their own batch
  const classIds = $derived(ids.filter((id) => !isTrainingId(id) && String(staffBatches(meta).find((b) => b.batchId === id)?.level || '').toUpperCase() !== 'ETP'));
  const canAll = $derived(classIds.length > 1);
  const allView = $derived(canAll && batchSel.id === '' && (tab === '/batch' || tab === '/stats'));
  // with "All my batches" chosen, the tabs and the one-batch screens follow the first class batch
  const batchId = $derived(ids.includes(batchSel.id) ? batchSel.id : (canAll && batchSel.id === '' ? classIds[0] : ids[0]) || '');
  const ALL_LABEL = $derived(sc.master ? 'All of IYF Delhi' : 'All my batches');
  // Closing belongs to the Vedic intakes alone: SPS and everything after it runs with no fixed
  // duration, so there is nothing to close (ADR 0009). The tab is hidden rather than disabled —
  // a tab that exists but refuses is worse than one that was never offered.
  const vedic = $derived(/^VL[23]-\d+$/.test(batchId));
  // a training batch has a facilitation board; a class batch does not — its scores are the weekly
  // sadhana the coordinator already sees on Status (the head, 17 Oct 2026)
  const training = $derived(/^ETP-\d+$/.test(batchId));
  // who is ready for the next level (ADR 0017): only a batch on the ladder has rules to meet (eligible.js MEASURED)
  const ladder = $derived(['VL2', 'VL3', 'SPS', 'DPS', 'BSS'].includes(String(staffBatches(meta).find((b) => b.batchId === batchId)?.level || '').toUpperCase()));
  const closed = $derived(!!staffBatches(meta).find((b) => b.batchId === batchId)?.closedAt);
  // a training's dates and where it stands (Phase 22, J1; meta's staff list): past its end date it asks, never ends itself
  const tb = $derived(training ? staffBatches(meta).find((b) => b.batchId === batchId) : null);
  const dates = $derived(tb?.startedOn ? `${fmtDate(tb.startedOn)} – ${tb.endsOn ? fmtDate(tb.endsOn) : 'no end date yet'}` : '');
  // A training has no members, no group leaders and no filling chart: its people are ENROLLED and
  // keep filling their own batch's week, so those tabs read 0 or empty for ever (the head, 18 Oct
  // 2026). It keeps Status — the week and its attendance — and gains Students and Board.
  const TABS = $derived([['/batch', 'Status'],
    ...(training ? [] : [['/members', 'Devotees'], ['/leaders', 'Group leaders'], ['/stats', 'Filling chart']]),
    ...(ladder && !training ? [['/ready', 'Ready to move up']] : []),
    // a training's own tabs: its coordinator and the head both reach these, since both hold the
    // batch (requireBatch on the server). Students comes first — a training has to have some.
    ...(training ? [['/students', 'Students'], ['/board', 'Board']] : []),
    ...((vedic || training) && !closed ? [['/closing', 'Close batch']] : []),
    // asking the IYF head to start a new VL-2 / VL-3 intake or a training (Phase 23); the head starts one in Batch setup
    ...(!sc.master ? [['/newbatch', 'New batch']] : [])]);
  /*
   * A batch they asked for, started by the head (Phase 23): it appears here at once — their access (auth.me) and the batch
   * list (meta) are read again, so its tabs (Students / Board / Close batch for a training) and the pickers show it.
   */
  const asked = $derived(entry('batchreq.list').data?.requests || []);
  let seenStarted = '';
  $effect(() => { if (!sc.master && sc.coordinator.length) load('batchreq.list'); });
  $effect(() => {
    const fresh = asked.filter((r) => r.state === 'STARTED' && r.batchId && !sc.coordinator.includes(r.batchId)).map((r) => r.batchId).join(',');
    if (!fresh || fresh === seenStarted) return;
    seenStarted = fresh;
    refreshAccess().then(() => refreshMeta()).then((d) => { if (d) meta = d; }).catch(() => {});
  });
</script>

<!-- the tabs stay at the top on every tab (they never jump); the batch picker sits in the panel, except on Members,
     which has its own batch filter -->
<!-- Members' Export sits in its count row, beside Refresh (27 Oct 2026): it had a row of its own above the search -->
{#snippet membersTools()}<ExportButton start="contacts" batchIds={ids} />{/snippet}
<Tabs items={TABS} current={tab} label="Batch tools" id="bt">
  {#if tab !== '/members' && tab !== '/newbatch'}
  <!-- one row, never Export alone on a line of its own (Phase 24, G2 / V18): the picker or the batch name, then Export -->
  <!-- the batch's name, or the picker standing for it (the head, 28 Oct 2026: the page's picker is the one picker, V33) -->
  <PageHeader class="ph-one" title={ids.length > 1 ? '' : batchId ? nameOf(batchId) : '—'}>
    {#if ids.length > 1}
      <WheelSelect id="bt-batch" label="Batch" srLabel class="mb-0 min-w-0 sm:w-64" value={allView ? '' : batchId}
        options={[...(canAll && (tab === '/batch' || tab === '/stats') ? [['', ALL_LABEL]] : []), ...ids.map((b) => [b, nameOf(b)])]} onchange={(v) => (batchSel.id = v)} />
    {/if}
    {#snippet actions()}{#if batchId}<ExportButton start={tab === '/leaders' ? 'contacts' : 'weekly'} batchIds={allView ? classIds : [batchId]} short />{/if}{/snippet}
  </PageHeader>
  {/if}
  {#if training && tb?.status === 'PAST_END' && tab !== '/closing' && tab !== '/newbatch'}
    <Banner kind="warn">Past its end date ({fmtDate(tb.endsOn)}) — end it? <a class="ilink" href="#/closing">Close batch</a></Banner>
  {:else if training && dates && tab === '/batch'}<p class="m-0 mb-3 text-sm text-muted">Running · {dates}</p>{/if}
  {#if tab === '/newbatch'}{#await import('./BatchAsk.svelte') then M}<M.default />{/await}
  {:else if !batchId}<EmptyState icon="users" title="No batch yet">No batch is assigned to you yet. The IYF head assigns batches to coordinators.</EmptyState>
  {:else if tab === '/members'}<Members batchIds={ids} {nameOf} all={sc.master} tools={batchId ? membersTools : null} />
  {:else if tab === '/stats'}{#if allView}<Stats batchId="" batchIds={classIds} {nameOf} />{:else}{#key batchId}<Stats {batchId} />{/key}{/if}
  {:else if tab === '/leaders'}{#key batchId}<Leaders {batchId} batchName={nameOf(batchId)} />{/key}
  {:else if tab === '/students'}{#key batchId}<Students {batchId} batchName={nameOf(batchId)} />{/key}
  {:else if tab === '/board'}{#key batchId}<FacilitationBoard {batchId} />{/key}
  {:else if tab === '/ready'}{#key batchId}<Ready {batchId} />{/key}
  {:else if tab === '/closing'}{#key batchId}<Closing {batchId} batchName={nameOf(batchId)} />{/key}
  {:else if allView}{#key classIds.join(',')}<BatchStatus batchId="" batchIds={classIds} batchName={ALL_LABEL} {nameOf} />{/key}
  {:else}{#key batchId}<BatchStatus {batchId} batchName={nameOf(batchId)} />{/key}{/if}
</Tabs>
