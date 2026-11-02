<script>
  /*
   * Closing a Vedic intake (ADR 0009, the head, 16 Oct 2026).
   *
   * VL-2 and VL-3 run as numbered intakes of about three months, and the coordinator closes one when
   * they judge it done — no timer does it. Closing is the only place in the app that moves somebody
   * from one batch to another, so it is also where promotion happens.
   *
   * Every devotee needs a decision before the batch can close. That is not a form rule for its own
   * sake: a devotee left undecided would stay in a batch that is closed and nobody looks at again,
   * so the button stays out of reach until the last one is settled, and the screen says how many are
   * left rather than making anyone hunt for them.
   */
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Icon from '../ui/Icon.svelte';
  import Button from '../ui/Button.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Seg from '../ui/Seg.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import { stale } from '../lib/cache.svelte.js';

  let { batchId, batchName } = $props();
  /* A TRAINING closes differently (the head, 17 Oct 2026; found missing from this screen 18 Oct): nobody is promoted out
     of ETP — the server refuses it — they QUALIFY, gaining the facilitator's card while staying in their own batch.
     This screen offered only Promote / Repeat / Left, so an ETP coordinator could not close a training at all. */
  const training = $derived(/^(ETP|MTP|FTP)-\d+$/.test(batchId || ''));
  const CHOICES = $derived(training
    ? [['qualified', 'Qualified', 'ok'], ['repeat', 'Repeat', 'refresh'], ['left', 'Left', 'out']]
    : [['promoted', 'Promote', 'up'], ['repeat', 'Repeat', 'refresh'], ['left', 'Left', 'out']]);

  let loading = $state(true);
  let error = $state('');
  let info = $state(null);
  /** login → { decision, toBatch } — nothing is pre-filled: every choice is somebody's. */
  let picks = $state({});
  let busy = $state(false);
  let confirm = $state();

  async function load() {
    loading = true; error = ''; info = null; picks = {};
    try {
      info = await call('batches.closingPreview', { batchId });
    } catch (e) { error = errorMessage(e); }
    loading = false;
  }
  $effect(() => { if (batchId) load(); });

  const decided = $derived(Object.values(picks).filter((p) => p?.decision).length);
  const total = $derived(info?.members.length || 0);
  const left = $derived(total - decided);
  // a promotion needs somewhere to go, so an unfinished one does not count as decided
  const incomplete = $derived(
    (info?.members || []).filter((m) => picks[m.login]?.decision === 'promoted' && !picks[m.login]?.toBatch).length
  );
  const ready = $derived(total > 0 && left === 0 && incomplete === 0);

  function set(login, decision) {
    picks = { ...picks, [login]: { ...(picks[login] || {}), decision, ...(decision === 'promoted' ? {} : { toBatch: '' }) } };
  }
  function setTo(login, toBatch) { picks = { ...picks, [login]: { ...(picks[login] || {}), toBatch } }; }

  // the whole batch at once, for a term where everybody moves up together
  function allPromoted(toBatch) {
    const next = {};
    for (const m of info.members) next[m.login] = { decision: 'promoted', toBatch };
    picks = next;
  }
  // a training's shortcut: everyone who finished it qualifies
  function allQualified() {
    const next = {};
    for (const m of info.members) next[m.login] = { decision: 'qualified', toBatch: '' };
    picks = next;
  }

  async function close() {
    busy = true; error = '';
    try {
      const decisions = info.members.map((m) => ({ login: m.login, decision: picks[m.login].decision,
        ...(picks[m.login].decision === 'promoted' ? { toBatch: picks[m.login].toBatch } : {}) }));
      const r = await call('batches.close', { batchId, decisions });
      confirm?.close();
      stale('board.'); stale('enrol.list:' + batchId);   // a closed training leaves the scoreboards; its students are a record
      toast(`${batchName} is closed — ${training ? `${r.qualified} qualified` : `${r.promoted} promoted`}, ${r.repeat} repeating, ${r.left} left.`);
      await load();
    } catch (e) {
      const fe = fieldErrors(e);
      error = Object.values(fe)[0] || errorMessage(e);
    }
    busy = false;
  }
</script>

{#if loading}
  <p class="m-0 flex items-center gap-2 text-sm text-muted" role="status"><span class="spin" aria-hidden="true"></span>Loading…</p>
{:else if error && !info}
  <EmptyState icon="info" title="This batch has no closing">{error}</EmptyState>
{:else if info}
  <PageHeader title={'Close ' + info.name} meta={(info.startedOn ? `Started ${info.startedOn} · ` : '') + `${total} ${training ? (total === 1 ? 'student' : 'students') : (total === 1 ? 'devotee' : 'devotees')}`} />

  <!-- what closing does, before the irreversible step — the one kind of explanation a screen keeps -->
  {#if training}
    <p class="cl-why">Qualified students gain the facilitator's card. Everyone keeps their own batch. Nothing happens until you close it.</p>
    <div class="cl-all">
      <button type="button" class="btn btn-outline btn-sm" onclick={allQualified}><Icon name="ok" size={16} />Everyone qualified</button>
    </div>
  {:else}
  <p class="cl-why">
    Decide about everyone, then close the batch. Promoted devotees move to their new batch from this week;
    the rest stay as they are, to be added to the next intake by hand. Nothing happens until you close it.
  </p>
  {/if}
  {#if training}{:else if info.nextLevels?.length === 0}
    <Banner>There is no level above {info.batchLevel}, so nobody here can be promoted.</Banner>
  {:else if !info.nextBatches.length}
    <Banner>No open {info.nextLevels.join(' or ')} batch to promote anyone into. Create one first.</Banner>
  {/if}

  {#if !training && info.nextBatches.length}
    <div class="cl-all">
      <span class="text-sm text-muted">Everyone moving up together?</span>
      <WheelSelect id="cl-all" label="" class="mb-0 w-full sm:w-56" value="" placeholder="Promote all to…"
        options={info.nextBatches.map((b) => [b.batchId, b.name])} onchange={(v) => v && allPromoted(v)} />
    </div>
  {/if}

  {#if error}<Banner>{error}</Banner>{/if}

  <ul class="list" aria-label={training ? "Students of this training" : "Devotees of this batch"}>
    {#each info.members as m (m.login)}
      <li class="cl-row">
        <div class="cl-who">
          <span class="cl-name">{m.name}</span>
          <span class="cl-sub">{m.present} {m.present === 1 ? 'week' : 'weeks'} present</span>
        </div>
        <Seg id={'cl-' + m.login} label={'Decision for ' + m.name}
          options={CHOICES}
          value={picks[m.login]?.decision || ''} onchange={(v) => set(m.login, v)} />
        {#if picks[m.login]?.decision === 'promoted'}
          <WheelSelect id={'clto-' + m.login} label="" class="mb-0 cl-to" value={picks[m.login]?.toBatch || ''}
            placeholder="Move up to…" options={info.nextBatches.map((b) => [b.batchId, b.name])}
            onchange={(v) => setTo(m.login, v)} />
        {/if}
      </li>
    {/each}
  </ul>

  <div class="cl-foot">
    <p class="m-0 text-sm text-muted" role="status">
      {#if left > 0}{left} still to decide{:else if incomplete > 0}{incomplete} {incomplete === 1 ? 'promotion needs' : 'promotions need'} a batch{:else}Everyone is decided.{/if}
    </p>
    <Button variant="primary" disabled={!ready} onclick={() => confirm?.showModal()}>Close this batch</Button>
  </div>
{/if}

<Sheet bind:this={confirm} titleId="cl-h" title="Close {batchName}?" dismiss={false}>
  {#if info}
    <p class="m-0 text-sm">
      {#if training}{Object.values(picks).filter((p) => p.decision === 'qualified').length} qualified,{:else}{Object.values(picks).filter((p) => p.decision === 'promoted').length} promoted,{/if}
      {Object.values(picks).filter((p) => p.decision === 'repeat').length} repeating,
      {Object.values(picks).filter((p) => p.decision === 'left').length} left.
    </p>
    <p class="m-0 mt-2 text-sm text-muted">
      {#if training}The training ends for everyone in it and nobody new can be enrolled. Their cards stay readable.{:else}The batch stops taking attendance and no new devotee can join it. Everything it recorded stays readable.{/if}
    </p>
    {#if error}<Banner>{error}</Banner>{/if}
    <div class="mt-4 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => confirm.close()}>Cancel</button>
      <Button variant="primary" {busy} onclick={close}>Close the batch</Button>
    </div>
  {/if}
</Sheet>

<style>
  .cl-why { margin: 0 0 var(--sp-4); color: var(--text-secondary); font-size: var(--fs-sm); line-height: 1.5; text-wrap: pretty; }
  .cl-all { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-4); }
  /* inner padding: the list is bordered, and a name on the border reads as overflow (the head, 18 Oct 2026) */
  .cl-row { display: grid; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); }
  /* the choice is named for screen readers by its label, which the row's name already shows on screen */
  .cl-row :global(.field) { margin: 0; }
  .cl-row :global(.field > .label) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .cl-who { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-2); min-width: 0; }
  .cl-name { font-weight: 600; }
  .cl-sub { color: var(--text-secondary); font-size: var(--fs-sm); }
  /* the footer stays reachable on a long batch without hunting for the button */
  .cl-foot { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
             gap: var(--sp-3); margin-top: var(--sp-4); padding: var(--sp-3) 0 calc(var(--safe-b) + var(--sp-3));
             background: linear-gradient(to bottom, transparent, var(--bg) 35%); }
  @media (min-width: 640px) {
    .cl-row { grid-template-columns: minmax(0, 1fr) max-content; align-items: center; }
    .cl-row :global(.cl-to) { grid-column: 2; }
  }
</style>
