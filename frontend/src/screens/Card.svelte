<script>
  /*
   * The target card (the head, 17 Oct 2026) — one screen for two people.
   *
   * A facilitator and an ETP student fill the SAME eleven lead measures, because a trainee is
   * training to become a facilitator and practises the real card. What differs is small and the
   * server decides it, not this screen: the words on the training measure (FTP for a facilitator,
   * ETP for a trainee) and the window the card runs for (a phase, or that training's own dates).
   *
   * Two things this screen is careful about, and both are honesty rather than polish:
   *
   *   · the TARGETS ARE THEIRS. Nobody else sets them, so the screen asks rather than announces,
   *     and says plainly that it is what they think is feasible.
   *   · a figure the app worked out and a figure somebody typed ARE NOT THE SAME EVIDENCE. Sadhna
   *     arrives with a number the app already scored from their own week; the screen shows where it
   *     came from, and keeps showing it after they type over it.
   *
   * The same screen, READ-ONLY, is what a scoreboard row opens (the head, 22 Oct 2026 — ADR 0016): the head and a
   * training's coordinator tap anyone, a facilitator or trainee taps their own place, and each sees exactly the card
   * that person fills, with their place on the board — as the Facilitator Dashboard opens a facilitator's detail.
   *
   * Phase 22 (the head, 26 Oct 2026 — E1, E2): "targets and the weekly achievements against those targets in the same
   * section is confusing". Two panes — Targets (read; Edit opens them, under ADR 0018's lock exactly as before) and
   * This week (what was done against each) — side by side from 1024 px, Targets first on a phone. Editing the targets
   * is its own action with its own Save; it never saves the week. Above them the scorecard (ScoreCard.svelte, the same
   * one the weekly fill form's rail shows), one period at a time.
   */
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { weekLabel, fmtDate } from '../lib/dates.js';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import Banner from '../ui/Banner.svelte';
  import Icon from '../ui/Icon.svelte';
  import { measureIcon } from '../lib/measureicons.js';
  import Button from '../ui/Button.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import Seg from '../ui/Seg.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import ScoreCard from './ScoreCard.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import { entry, load as cacheLoad, seed, stale } from '../lib/cache.svelte.js';

  // `login` set: somebody's card opened from a board, read-only; `place` and `of` are their place on that board
  let { login = '', weekId: atWeek = '', place = undefined, of = 0 } = $props();
  const readonly = $derived(!!login);

  let card = $state(null);
  let error = $state('');
  let fe = $state({});
  let busy = $state(false);
  let loading = $state(true);
  /** measureId -> what is in the box now. Separate from the card so an unsaved edit is visible as one. */
  let edit = $state({});
  /*
   * Editing the targets is a separate action from filling the week (phase 22): the Targets pane reads until Edit opens
   * it, and its own Save sends the targets and the levels — never the week.
   */
  let editing = $state(false);
  let tedit = $state({});
  /*
   * The stages: how many students they mean to see moved up, per level. The dashboard's score is
   * (sadhana + seva + goal) / 3, and this is where the goal third comes from.
   *
   * Only the TARGET is editable. What they achieved is counted from real promotions, so it is shown
   * and never asked for — a facilitator reporting their own result is how a number goes wrong.
   */
  let sedit = $state({});
  /*
   * Targets are set at the start of the phase (phase 21, 23 Oct 2026 — ADR 0018; the head: "defining the targets happens
   * in the phase beginning only not afterwards"). card.targets says until when a SET target may change and whether it
   * may now; after that date a target never set may still be set, and only the head can open the rest again.
   */
  const lock = $derived(card?.targets || { until: '', open: true, openedUntil: '' });
  const fixed = (target) => !lock.open && target !== '' && target !== null && target !== undefined && target !== 0;
  const viewer = $derived(scopesOf(session.user));
  let openFor = $state(false), openWhy = $state('');

  /* Kept between visits (22 Oct 2026, routevitals): a return visit draws the card kept from the last one at once
     (it waited ~1.5 s for the server on every visit), and the server is still asked every time, in the background —
     the offered sadhna follows the week they just submitted, so a card is never shown out of date for long. A fresh
     answer that lands while they are typing leaves what they typed alone. */
  const cardKey = $derived(login ? `card.of:${login}:${atWeek}` : 'card.get');
  const monthsKey = (c) => `card.months:${login}:${c.phaseId}`;
  const monthsGet = (c) => () => call('card.months', login ? { login, phaseId: c.phaseId } : { phaseId: c.phaseId });
  const targetsOf = (c) => Object.fromEntries(c.measures.map((m) => [m.measureId, m.target || '']));
  const stagesOf = (c) => Object.fromEntries((c.score?.stages || []).map((x) => [x.stage, x.target || '']));
  function apply(c, keepEdits) {
    card = c;
    if (keepEdits) return;
    edit = Object.fromEntries(c.measures.map((m) => [m.measureId, m.value || '']));
    tedit = targetsOf(c);
    sedit = stagesOf(c);
    // nothing set yet: start where the work is, which is deciding the targets — the Yes/No measures counted, as the
    // paper card counts them (they could not be set from this screen before phase 21, so they were never scored)
    if (!login && c.state === 'OPEN' && c.measures.every((m) => !m.target)) {
      editing = true;
      tedit = { ...tedit, ...Object.fromEntries(c.measures.filter((m) => m.kind === 'YESNO').map((m) => [m.measureId, 'YES'])) };
    }
  }
  async function load(weekId) {
    const k = cardKey;
    const get = () => (login ? call('card.of', { login, ...(atWeek ? { weekId: atWeek } : {}) })
                             : call('card.get', weekId ? { weekId } : {}));
    const kept = weekId ? undefined : entry(k).data;      // after a save (weekId given) the screen waits for the server
    if (kept !== undefined) { apply(kept, false); loading = false; } else loading = true;
    error = '';
    if (entry(k).refreshing) await cacheLoad(k, get);    // an older read in flight lands first, never over this one
    const d = await cacheLoad(k, get, { force: true });
    // the month list sits ABOVE the levels and measures: drawn after the card, it pushed them down (layout shift 0.149,
    // the gate on live, 22 Oct 2026). A card drawn for the first time waits for it behind the skeleton (the call's own deadline bounds it).
    if (d !== undefined && kept === undefined && entry(monthsKey(d)).data === undefined)
      await cacheLoad(monthsKey(d), monthsGet(d));
    if (d !== undefined) { if (d !== kept) apply(d, kept !== undefined && (changed || tchanged || schanged)); }
    else if (kept === undefined) { error = errorMessage(entry(k).error); card = null; }
    loading = false;
  }
  load();
  /** After a save: what this card feeds — the boards rank on it — and any read-only view of it — ask again. */
  const fed = () => { stale('board.'); stale('card.of:'); stale('card.months:'); };

  const weekly = $derived((card?.measures || []).filter((m) => m.frequency === 'WEEKLY'));
  // the paper card's groups (ADR 0012 G): Sadhna, then "Vedic Level 2 registration", then "Target"
  const weeklyGroups = $derived((card?.groups || [{ id: '', label: '' }])
    .map((g) => ({ ...g, items: weekly.filter((m) => (m.group || '') === g.id) })).filter((g) => g.items.length));
  const monthly = $derived((card?.measures || []).filter((m) => m.frequency === 'MONTHLY'));
  // one row per CLOSED month (card.months): sadhana, seva, goal, net — read once, after the card
  let months = $state(null);
  $effect(() => {
    if (!card || months !== null) return;
    const k = monthsKey(card), kept = entry(k).data;
    if (kept) months = kept.months;
    cacheLoad(k, monthsGet(card)).then((r) => { months = r?.months || kept?.months || []; });
  });
  const noTargets = $derived(!!card && card.measures.every((m) => !m.target));
  // after the lock date: may they still set a target they never set? (Sadhna is the week's own score, never a target)
  const missingTargets = $derived(!!card && card.measures.some((m) => !m.target && !m.fromApp));
  // a level left at 0 reads as not set (stages.set): it too may still be set after the lock date
  const missingStages = $derived(!!card && (card.score?.stages || []).some((x) => !x.target));
  const mayEdit = $derived(!!card && !readonly && card.state === 'OPEN' && (lock.open || missingTargets || missingStages));
  // the week is filled only while the card is open and the targets are not being edited (one action at a time)
  const weekRo = $derived(readonly || editing || card?.state !== 'OPEN');
  /** A monthly measure's month so far, against its target (phase 21). */
  const monthLine = (m) => (m.kind === 'YESNO' ? (m.monthValue === 'YES' ? 'done' : 'not yet') : `${m.monthValue || 0} of ${m.target}${m.unit ? ' ' + m.unit : ''}`);
  const targetText = (m) => (m.target === 'YES' ? (m.frequency === 'MONTHLY' ? 'Every month' : 'Every week') : m.target + (m.unit ? ' ' + m.unit : ''));
  const valueText = (v) => (v === '' || v === null || v === undefined ? '—' : v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : v);
  async function openTargets() {
    busy = true; fe = {}; error = '';
    try {
      const r = await call('targets.unlock', { login, phaseId: card.phaseId, reason: openWhy.trim() });
      toast(`Their targets are open until ${fmtDate(r.until.slice(0, 10))}.`);
      openFor = false; stale('card.of:');
      await load();
    } catch (e) { fe = fieldErrors(e); error = Object.keys(fe).length ? '' : errorMessage(e); }
    busy = false;
  }
  const changed = $derived(!!card && card.measures.some((m) => (edit[m.measureId] || '') !== (m.value || '')));
  const tchanged = $derived(!!card && card.measures.some((m) => (tedit[m.measureId] || '') !== (m.target || '')));
  const schanged = $derived(!!card && (card.score?.stages || []).some((x) => String(sedit[x.stage] ?? '') !== String(x.target || '')));

  /** Take the number the app offers for a measure that has one. */
  function useOffered(m) { edit = { ...edit, [m.measureId]: String(m.offered) }; }

  function startEdit() { fe = {}; error = ''; tedit = targetsOf(card); sedit = stagesOf(card); editing = true; }
  function cancelEdit() { fe = {}; error = ''; tedit = targetsOf(card); sedit = stagesOf(card); editing = false; }

  /** The targets and the levels, each sent only when it changed (targets.set, stages.set) — never the week. */
  async function saveTargets() {
    if (!(tchanged || schanged) || busy) return;
    busy = true; error = ''; fe = {};
    const keepWeek = edit;              // a week typed but not saved yet stays in its boxes
    let sent = false;
    try {
      if (tchanged) {
        const targets = card.measures
          .filter((m) => (tedit[m.measureId] || '') !== (m.target || '') && (tedit[m.measureId] || '') !== '')
          .map((m) => ({ measureId: m.measureId, target: tedit[m.measureId] }));
        await call('targets.set', { phaseId: card.phaseId, targets });
        sent = true;
      }
      if (schanged) {
        const stages = (card.score?.stages || [])
          .filter((x) => String(sedit[x.stage] ?? '') !== String(x.target || ''))
          .map((x) => ({ stage: x.stage, target: Number(sedit[x.stage] || 0) }));
        await call('stages.set', { phaseId: card.phaseId, stages });
        sent = true;
      }
      fed();
      await load(card.weekId);
      edit = keepWeek;
      editing = false;
      toast('Your targets are set.');
    } catch (e) { if (sent) fed(); fe = fieldErrors(e); error = Object.keys(fe).length ? '' : errorMessage(e); }
    busy = false;
  }

  async function save() {
    if (!changed || busy) return;
    busy = true; error = ''; fe = {};
    try {
      const values = card.measures
        .filter((m) => (edit[m.measureId] || '') !== (m.value || '') && (edit[m.measureId] || '') !== '')
        .map((m) => ({ measureId: m.measureId, value: edit[m.measureId],
          // 'app' only while it still matches what was offered: once they change it, it is theirs
          source: m.offered !== null && String(m.offered) === edit[m.measureId] ? 'app' : 'typed' }));
      card = await call('card.fill', { phaseId: card.phaseId, weekId: card.weekId, values });
      seed(cardKey, card); fed();
      edit = Object.fromEntries(card.measures.map((m) => [m.measureId, m.value || '']));
      toast('Saved.');
    } catch (e) { fe = fieldErrors(e); error = Object.keys(fe).length ? '' : errorMessage(e); }
    busy = false;
  }
</script>

{#if loading}
  <Skeleton kind="list" rows={6} />
{:else if !card && error}
  <!-- failed before empty (Phase 24, V31): offline used to read "No card yet" -->
  <ErrorState error={entry(cardKey).error || error} safe="" onretry={() => load()} />
{:else if !card}
  <EmptyState icon="info" title="No card yet">There is no open phase, so there is nothing to fill in.</EmptyState>
{:else}
  <div class="cd-head">
    <div class="min-w-0">
      <!-- the top bar owns the title (Phase 24, G2 / V38): one's own card does not repeat it as an overline, and a trainee's
           card, whose bar already reads the training's name, does not repeat that name either -->
      {#if readonly}<p class="t-over m-0">{card.trainee ? 'Training card' : 'Phase card'}</p>{/if}
      {#if readonly || !card.trainee}<h2 class:mt-1={readonly}>{card.name}</h2>{/if}
      <p class="m-0 mt-1 text-sm text-muted">Week of {weekLabel(card.weekId)}</p>
      {#if place !== undefined}
        <!-- their place on the board it was opened from, "#4 of 20" as the dashboard prints it -->
        <p class="cd-place m-0 mt-2">{place ? `Rank #${place} of ${of}` : 'Not ranked yet'}</p>
      {/if}
    </div>
  </div>

  <!-- only what the person needs to act: a closed card cannot be changed. The "set what is feasible" note was an
       explanation shown in an error's colours, and went (the head's rule, 18 Oct 2026) -->
  {#if card.state !== 'OPEN' && !readonly}
    <Banner>{card.name} is closed. Your card is a record now and cannot be changed.</Banner>
  {/if}

  {#if error}<Banner>{error}</Banner>{/if}

  <!-- E2: the scorecard, one period at a time (the same component as the weekly fill form's rail) -->
  <ScoreCard {card} {months} id={readonly ? 'sc-of' : 'sc'} />

  {#snippet what(m, line)}
    <div class="cd-what">
      <span class="cd-ico"><Icon name={measureIcon(m.measureId)} size={18} /></span>
      <span class="cd-text">
        <span class="cd-label">{m.label}</span>
        {@render line()}
      </span>
    </div>
  {/snippet}

  <!-- the Targets pane: one row per measure, what they committed to; Edit turns the figures into fields -->
  {#snippet trow(m)}
    <li class="cd-row" class:cd-ro={!editing} class:cd-choice={editing && m.kind === 'YESNO'}>
      {#snippet line()}{#if m.fromApp && !m.target}<span class="cd-tag">from your week</span>{/if}{/snippet}
      {@render what(m, line)}
      {#if !editing}
        <span class="cd-val" class:cd-none={!m.target}>{m.target ? targetText(m) : 'not set'}</span>
      {:else if m.kind === 'YESNO'}
        <Seg id={'ct-' + m.measureId} label={m.label} srLabel options={[['YES', m.frequency === 'MONTHLY' ? 'Every month' : 'Every week'], ['', 'Not for me']]}
          value={tedit[m.measureId] || ''} disabled={fixed(m.target)} onchange={(v) => (tedit = { ...tedit, [m.measureId]: v })} />
      {:else}
        <TextInput id={'ct-' + m.measureId} label="" class="mb-0 cd-num" inputmode="numeric"
          placeholder="—" bind:value={tedit[m.measureId]} error={fe['targets']} disabled={fixed(m.target)} />
      {/if}
    </li>
  {/snippet}

  <!-- the This week pane: what was done against each target, filled and saved on its own -->
  {#snippet wrow(m)}
    <li class="cd-row" class:cd-ro={weekRo} class:cd-choice={!weekRo && m.kind === 'YESNO'}>
      {#snippet line()}
        {#if m.target}<span class="cd-target">target {m.target === 'YES' ? (m.frequency === 'MONTHLY' ? 'every month' : 'every week') : m.target + (m.unit ? ' ' + m.unit : '')}</span>
        {:else if !m.fromApp}<span class="cd-tag">no target</span>{/if}
        {#if m.frequency === 'MONTHLY' && m.target}<span class="cd-month">This month: {monthLine(m)}</span>{/if}
      {/snippet}
      {@render what(m, line)}
      {#if weekRo}
        <span class="cd-val">{valueText(readonly ? m.value : edit[m.measureId] ?? m.value)}</span>
      {:else if m.kind === 'YESNO'}
        <Seg id={'cd-' + m.measureId} label="" options={[['YES', 'Yes'], ['NO', 'No']]}
          value={edit[m.measureId] || ''} onchange={(v) => (edit = { ...edit, [m.measureId]: v })} />
      {:else}
        <TextInput id={'cd-' + m.measureId} label="" class="mb-0 cd-num" inputmode="numeric"
          bind:value={edit[m.measureId]} error={fe['values']} />
      {/if}
      {#if !weekRo && m.offered !== null && m.offered !== undefined}
        <!-- the app already scored their own week; it is offered, never imposed -->
        <p class="cd-offer">
          <!-- WHICH week it came from, not just that it came from one: the offer is the last week
               they submitted, which may not be this one, and a figure whose age is hidden is worse
               than no figure (the head, 17 Oct 2026). -->
          {#if String(m.offered) === (edit[m.measureId] || '')}
            From your week of {weekLabel(m.offeredWeek || card.weekId)}.
          {:else}
            Your week of {weekLabel(m.offeredWeek || card.weekId)} scored
            <button type="button" class="link" onclick={() => useOffered(m)}>{m.offered}</button> — use it, or put your own figure.
          {/if}
        </p>
      {/if}
    </li>
  {/snippet}

  <!-- E1: Targets on the left, This week on the right from 1024 px; on a phone Targets first -->
  <div class="cd-grid">
    <section class="cd-sec cd-pane" class:cd-editing={editing} aria-labelledby="cd-h-targets">
      <div class="cd-ph">
        <h3 class="cd-h" id="cd-h-targets">Targets</h3>
        {#if mayEdit && !editing}
          <button type="button" class="btn btn-outline btn-sm cd-edit" aria-label={lock.open ? 'Edit my targets' : undefined} onclick={startEdit}><Icon name="edit" size={16} />{lock.open ? 'Edit' : 'Set the missing targets'}</button>
        {/if}
      </div>
      {#if card.state === 'OPEN' && lock.until}
        <p class="cd-lock m-0 mb-2 text-sm" class:cd-lock-open={lock.open}><Icon name={lock.open ? 'edit' : 'lock'} size={14} />{lock.openedUntil
          ? `Targets open until ${fmtDate(lock.openedUntil.slice(0, 10))}` : lock.open ? `Targets can be changed until ${fmtDate(lock.until)}` : `Targets fixed after ${fmtDate(lock.until)}`}</p>
      {/if}
      <h4 class="cd-sub">Every week</h4>
      {#each weeklyGroups as g (g.id)}
        {#if g.label && weeklyGroups.length > 1}<p class="cd-grp">{g.label}</p>{/if}
        <ul class="cd-list">{#each g.items as m (m.measureId)}{@render trow(m)}{/each}</ul>
      {/each}
      <h4 class="cd-sub">Every month</h4>
      <ul class="cd-list">{#each monthly as m (m.measureId)}{@render trow(m)}{/each}</ul>

      <!-- the stages: the goal third of the score, as small tiles; their targets are targets too (ADR 0018) -->
      <h4 class="cd-sub">{readonly ? 'Students to move up' : 'Students you mean to move up'}</h4>
      <ul class="cd-stages">
        {#each card.score?.stages || [] as x (x.stage)}
          <li class="cd-stage" class:cd-ro={!editing}>
            <div class="cd-stage-t">
              <span class="cd-label">{x.label}</span>
              <!-- the goal is scored on ELIGIBLE students (ADR 0012); promotions are shown beside it -->
              <span class="cd-target">{x.eligible ?? x.achieved} eligible{x.promoted ? ` · ${x.promoted} promoted` : ''}</span>
            </div>
            {#if !editing}<span class="cd-val">{x.target ? `target ${x.target}` : '—'}</span>
            {:else}
              <TextInput id={'cs-' + x.stage} label="" class="mb-0 cd-num" inputmode="numeric"
                placeholder="—" bind:value={sedit[x.stage]} error={fe.stages} disabled={fixed(x.target)} />
            {/if}
          </li>
        {/each}
      </ul>
      {#if card.score?.ready?.length}
        <!-- who is behind that count, by name: the dashboard lists "ready to move up" the same way -->
        <details class="cd-ready">
          <summary><b>{card.score.ready.length}</b> {card.score.ready.length === 1 ? 'student' : 'students'} eligible to move up</summary>
          <ul class="cd-list">
            {#each card.score.ready as r (r.name + r.stage)}
              <li class="cd-rrow"><span class="cd-label">{r.name}</span><span class="cd-target">{r.batchId} → {r.stage}{r.iyfId ? ` · ${r.iyfId}` : ''}</span></li>
            {/each}
          </ul>
        </details>
      {/if}
    </section>

    <section class="cd-sec cd-pane" aria-labelledby="cd-h-week">
      <div class="cd-ph">
        <h3 class="cd-h" id="cd-h-week">This week</h3>
        <span class="cd-when">{weekLabel(card.weekId)}</span>
      </div>
      <h4 class="cd-sub">Every week</h4>
      {#each weeklyGroups as g (g.id)}
        {#if g.label && weeklyGroups.length > 1}<p class="cd-grp">{g.label}</p>{/if}
        <ul class="cd-list">{#each g.items as m (m.measureId)}{@render wrow(m)}{/each}</ul>
      {/each}
      <h4 class="cd-sub">Every month</h4>
      <ul class="cd-list">{#each monthly as m (m.measureId)}{@render wrow(m)}{/each}</ul>
    </section>
  </div>

  {#if readonly && viewer.master && card.state === 'OPEN' && !lock.open}
    <!-- ADR 0018: only the head opens somebody's fixed targets — for 7 days, with a reason, kept in Activity -->
    <section class="cd-sec cd-unlock">
      {#if openFor}
        <TextInput id="cd-why" label="Why open their targets?" bind:value={openWhy} error={fe.reason} hint="Open for 7 days, then fixed again. Kept in Activity." />
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-outline" onclick={() => (openFor = false)}>Cancel</button>
          <Button variant="primary" {busy} onclick={openTargets}>Open their targets</Button>
        </div>
      {:else}
        <button type="button" class="btn btn-text btn-sm -ml-2.5" onclick={() => { openFor = true; openWhy = ''; fe = {}; }}>Open their targets for 7 days…</button>
      {/if}
    </section>
  {/if}

  {#if card.state === 'OPEN' && !readonly}
    <div class="cd-foot">
      {#if editing}
        <button type="button" class="btn btn-outline" disabled={noTargets || busy} onclick={cancelEdit}>Cancel</button>
        <Button variant="primary" disabled={!(tchanged || schanged)} {busy} onclick={saveTargets}>Save my targets</Button>
      {:else}
        <Button variant="primary" disabled={!changed} {busy} onclick={save}>Save this week</Button>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .cd-lock { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
  .cd-lock-open { color: var(--accent); }
  .cd-month { display: block; flex-basis: 100%; margin-top: 2px; font-size: var(--fs-xs); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .cd-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  /* each part of the card is a raised card, as everywhere in the app; its title carries the gold hairline */
  .cd-sec { margin-bottom: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--r-lg);
            background: var(--surface-elevated); box-shadow: inset 0 1px 0 var(--shine), var(--shadow-1); }
  :global(:root[data-tier='low']) .cd-sec { box-shadow: var(--shadow-1); }
  /* the pane being edited is marked by its edge, so it reads as the one the footer's Save belongs to */
  .cd-editing { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
  .cd-ph { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2); margin-bottom: var(--sp-3); }
  .cd-h { position: relative; margin: 0; padding-bottom: 6px; font-size: var(--fs-h3); }
  .cd-h::after { content: ''; position: absolute; left: 0; bottom: 0; width: 40px; height: 2px; border-radius: 1px; background: linear-gradient(90deg, var(--gold-decorative), transparent); }
  .cd-edit { display: inline-flex; align-items: center; gap: 6px; }
  .cd-when { color: var(--text-secondary); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .cd-sub { margin: var(--sp-4) 0 0; font-size: var(--fs-body, 1rem); font-weight: 650; }
  .cd-ph + .cd-sub, .cd-lock + .cd-sub { margin-top: 0; }
  /* the levels as small tiles: two or three to a phone's row instead of five full-width rows */
  .cd-stages { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: var(--sp-2); margin: var(--sp-2) 0 0; padding: 0; list-style: none; }
  .cd-stage { display: grid; gap: 6px; align-content: start; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
  .cd-stage-t { display: grid; gap: 2px; }
  .cd-stage .cd-target { white-space: normal; }
  .cd-stage :global(.cd-num) { width: 100%; }
  .cd-stage.cd-ro .cd-val { justify-self: start; }
  .cd-tag { padding: 0 8px; border: 1px solid var(--border); border-radius: var(--r-full); color: var(--text-muted); font-size: var(--fs-caption); white-space: nowrap; }
  /* two panes from 1024 px, the Targets one first (left); the This week one beside it */
  @media (min-width: 1024px) {
    .cd-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 var(--sp-5); align-items: start; }
  }
  .cd-place { display: inline-block; padding: 2px var(--sp-2); border-radius: var(--r-pill, 999px);
              background: var(--accent-soft); color: var(--accent); font-size: var(--fs-sm); font-weight: 650; font-variant-numeric: tabular-nums; }
  .cd-val { font-weight: 650; font-variant-numeric: tabular-nums; justify-self: end; text-align: right; }
  .cd-val.cd-none { color: var(--text-secondary); font-weight: 400; font-style: italic; }
  .cd-ready { margin-top: var(--sp-3); }
  .cd-ready summary { cursor: pointer; padding: var(--sp-2) 0; color: var(--text-secondary); font-size: var(--fs-sm); }
  .cd-rrow { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--sp-1) var(--sp-3); padding: var(--sp-2) 0; border-bottom: 1px solid var(--border); }
  /* read-only: the figure stays on the label's line at every width — on a phone it sat alone on the next line */
  .cd-row.cd-ro { grid-template-columns: minmax(0, 1fr) max-content; align-items: center; }
  .cd-list { margin: 0; padding: 0; list-style: none; }
  .cd-grp { margin: var(--sp-3) 0 var(--sp-1); color: var(--text-secondary); font-size: var(--fs-caption); font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }
  .cd-row { display: grid; grid-template-columns: minmax(0, 1fr) max-content; align-items: center; gap: var(--sp-2) var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--divider); }
  .cd-list > :last-child { border-bottom: 0; }
  /* a figure field beside its label at every width (it stacked under it on a phone, doubling the card's length) */
  .cd-row :global(.cd-num) { width: 6.5rem; }
  .cd-row :global(.seg) { min-width: 9rem; }
  /* the icon in its own column, so a label that wraps stays aligned under itself rather than under the icon */
  .cd-what { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: var(--sp-3); min-width: 0; }
  .cd-ico { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
            background: var(--accent-soft); color: var(--accent); }
  .cd-text { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--sp-1) var(--sp-2); min-width: 0; padding-top: 5px; }
  .cd-label { font-weight: 600; text-wrap: pretty; overflow-wrap: anywhere; }   /* "facilitation" can break rather than run under the switch (V1) */
  .cd-target { color: var(--text-secondary); font-size: var(--fs-sm); white-space: nowrap; }
  .cd-offer { margin: 0; color: var(--text-secondary); font-size: var(--fs-xs); line-height: 1.5; }
  /* G7, the responsive form row (Phase 24): a Yes/No choice takes the row under its label when the LIST is narrow —
     a phone, or one of the two 340 px panes at 1024 px, where the switch sat on top of its own label (V1). The row decides
     from its own width, not the window's. A figure field (6.5rem) always stays beside its label: stacking it made the
     phone page 3,900 px long (V20). */
  .cd-list { container-type: inline-size; }
  @container (max-width: 30rem) {
    .cd-row.cd-choice { grid-template-columns: minmax(0, 1fr); }
    .cd-row.cd-choice :global(.field:has(.seg)), .cd-row.cd-choice :global(.seg) { justify-self: stretch; }
  }
  /*
   * The footer is pinned above the floating nav (bottom: var(--nav-space), not 0, or it lands behind
   * it). It must be OPAQUE: a gradient that fades to transparent let the rows behind it show through
   * the buttons, which read as though they were loose in the middle of the list.
   *
   * The two buttons sit side by side from the narrowest phone: stacking them at 390 px pushed the
   * list further behind the footer than the footer was tall.
   */
  .cd-foot { position: sticky; bottom: var(--nav-space); z-index: 2; display: grid; grid-auto-flow: column;
             grid-auto-columns: 1fr; align-items: center; gap: var(--sp-2); margin-top: var(--sp-4);
             padding: var(--sp-3) 0; background: var(--bg);
             box-shadow: 0 -12px 16px -8px var(--bg), 0 -1px 0 var(--border); }
  /* the list ends above the footer, so its last row is never hidden under it */
  .cd-offer { grid-column: 1 / -1; }
</style>
