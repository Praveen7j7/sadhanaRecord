<script>
  /*
   * The facilitation board (the head, 17 Oct 2026) — one screen for two boards.
   *
   *   a training batch's   its own ETP coordinator, and the admin
   *   the facilitators'    the admin alone
   *
   * Each row carries TWO figures, and keeping them apart is the point of the screen. The head drew
   * the line: the board answers "who is doing well right now" from the last week, while a promotion
   * weighs the whole history. One number would merge two questions nobody asked together.
   *
   * A person with no targets shows "—", never 0%. They were not asked to do a thing, and a zero
   * beside somebody who tried and fell short would be a lie about both of them.
   */
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load as cacheLoad, patch } from '../lib/cache.svelte.js';
  import { weekLabel } from '../lib/dates.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';

  let { batchId = '' } = $props();

  /* Through the shared read cache (22 Oct 2026, G23), as every other staff screen: the board kept from the last visit
     shows at once, and the server is asked again only when that copy is over two minutes old. It asked on EVERY visit
     (~1.5 s on a phone each time the training coordinator came back to the tab). */
  const key = $derived('board.get:' + (batchId || 'facilitators'));
  const be = $derived(entry(key));
  $effect(() => { const k = key, b = batchId; cacheLoad(k, () => call('board.get', b ? { batchId: b } : {})); });
  let markErr = $state('');
  const board = $derived(be.data ?? null);
  const loading = $derived(be.data === undefined && !be.error);
  const error = $derived(markErr || (be.error && be.data === undefined ? errorMessage(be.error) : ''));

  // Marking the training's own class (the head, 18 Oct 2026). A training only: a class batch's
  // attendance is marked on the Status screen, against that batch's own week.
  let marking = $state('');
  async function mark(r, m) {
    if (marking) return;
    const want = r.mark === m ? '' : m;        // tapping the same mark again clears it
    marking = r.login;
    try {
      await call('training.attendance', { batchId: board.batchId, weekId: board.weekId,
                                          marks: [{ login: r.login, mark: want || null }] });
      r.mark = want;                            // shown at once; reloading would lose the scroll position
      patch(key, (b) => b);                     // …and kept, so coming back within two minutes shows the new mark
    } catch (e) { markErr = errorMessage(e); }
    marking = '';
  }

  /** A figure that may not exist. "—" is not 0, and the screen must not let them look alike. */
  const pct = (n) => (n === null || n === undefined ? '—' : n + '%');
  const tone = (n) => (n === null || n === undefined ? 'none' : n >= 100 ? 'ok' : n >= 80 ? 'good' : n >= 50 ? 'mid' : 'low');
</script>

{#if loading}
  <Skeleton kind="list" rows={5} />
{:else if error}
  <EmptyState icon="info" title="No board">{error}</EmptyState>
{:else if board}
  <PageHeader title={board.name} meta={'Week of ' + weekLabel(board.weekId)} />

  {#if !board.rows.length}
    <EmptyState icon="users" title="Nobody here yet">
      {board.kind === 'training' ? 'No students have joined this training.' : 'No facilitators yet.'}
    </EmptyState>
  {:else}
    <!-- the two figures are labelled, not left to be guessed at from position -->
    <div class="bd-key" class:training={board.kind === 'training'} aria-hidden="true"><span></span><span>This week</span><span>Whole phase</span>{#if board.kind === 'training'}<span>Class</span>{/if}</div>
    <ul class="bd-list" class:training={board.kind === 'training'} aria-label="Scores">
      {#each board.rows as r (r.login)}
        <li class="bd-row">
          <span class="bd-name">{r.name}</span>
          <span class="bd-fig" data-label="This week" data-tone={tone(r.week)}>
            {pct(r.week)}
            <small>{r.asked ? `${r.filled} of ${r.asked} filled` : 'no targets set'}</small>
          </span>
          <span class="bd-fig" data-label="Whole phase" data-tone={tone(r.average)}>
            {pct(r.average)}
            <!-- weeks AND filled: an average over 3 of 16 is not the same measurement as one over 16 -->
            <small>{r.weeksFilled} of {r.weeks} weeks</small>
          </span>
          {#if board.kind === 'training'}
            <!-- the class they sat in, beside whether they filled the card: two different questions -->
            <span class="bd-att" role="group" aria-label={`Attendance for ${r.name}`}>
              <button type="button" class="bd-mk" aria-pressed={r.mark === 'P'} disabled={marking === r.login}
                      onclick={() => mark(r, 'P')}>P</button>
              <button type="button" class="bd-mk" aria-pressed={r.mark === 'A'} disabled={marking === r.login}
                      onclick={() => mark(r, 'A')}>A</button>
            </span>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="bd-note">
      “—” means no targets were set, which is not the same as nothing done. This week’s figure moves about;
      the phase average is the one a promotion rests on.
    </p>
  {/if}
{/if}

<style>
  /* 9rem, not 5.5rem (18 Oct 2026): "no targets set" and "0 of 11 weeks" are wider than 5.5rem, and
     with the small print forbidden to wrap the two columns ran into each other on a desktop —
     "no targets se0 of 11 weel". The phone layout below stacks them instead. */

  .bd-key { display: grid; grid-template-columns: minmax(0, 1fr) 9rem 9rem; gap: var(--sp-2);
            padding: 0 0 var(--sp-2); color: var(--text-secondary); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em; }
  .bd-key span { text-align: right; }
  .bd-list { margin: 0; padding: 0; list-style: none; }
  .bd-row { display: grid; grid-template-columns: minmax(0, 1fr) 9rem 9rem; gap: var(--sp-2);
            align-items: center; padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); }
  .bd-name { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
  .bd-fig { display: grid; justify-items: end; text-align: right; font-variant-numeric: tabular-nums; font-weight: 650; }
  .bd-fig small { font-weight: 400; color: var(--text-secondary); font-size: var(--fs-xs); white-space: normal; overflow-wrap: anywhere; }
  /* a missing figure must not read as a low one */
  .bd-fig[data-tone='none'] { color: var(--text-tertiary, var(--text-secondary)); font-weight: 400; }
  .bd-fig[data-tone='ok'] { color: var(--ok); }
  .bd-fig[data-tone='low'] { color: var(--warn, var(--text)); }
  /* A training has a fourth column: the class mark. 5.5rem + 5.5rem + 5rem would reach past a 390px
     phone, which this row has overflowed once before, so the marks take only what two 40px buttons
     need and the phone layout below gives them a line of their own. */
  .bd-key.training, .bd-list.training .bd-row { grid-template-columns: minmax(0, 1fr) 9rem 9rem auto; }
  .bd-att { display: flex; gap: 4px; justify-content: flex-end; }
  .bd-mk { min-width: var(--ctl-h); min-height: var(--ctl-h); padding: 0 var(--sp-2); border: 1px solid var(--border);
           border-radius: var(--r-md); background: var(--surface); color: var(--text);
           font: inherit; font-weight: 650; cursor: pointer;
           transition: background-color var(--d-1) var(--ease), color var(--d-1) var(--ease); }
  .bd-mk[aria-pressed='true'] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .bd-mk:disabled { opacity: .55; cursor: progress; }
  @media (hover: hover) { .bd-mk:not(:disabled):not([aria-pressed='true']):hover { background: var(--surface-hover); } }
  @media (prefers-reduced-motion: reduce) { .bd-mk { transition: none; } }
  .bd-note { margin: var(--sp-4) 0 0; color: var(--text-secondary); font-size: var(--fs-xs); line-height: 1.5; text-wrap: pretty; }
  /*
   * Two fixed columns of 5.5rem plus the gaps did not fit 390 px once "no targets set" and
   * "0 of 17 weeks" were under the figures: the row came to 404 px and the page scrolled sideways.
   *
   * So the figures take the width their own words need (max-content) and the name gives way, and
   * below 420 px the smaller print wraps instead of forcing the row wider. A name is the one thing
   * here that can be truncated without losing a number.
   */
  /*
   * Below 420 px the name takes a line of its own and the two figures sit under it. Side by side
   * they came to 404 px on a 390 px phone, and squeezing them ran "no targets set" and
   * "0 of 17 weeks" together into one phrase that reads as neither.
   */
  @media (max-width: 420px) {
    .bd-key { display: none; }
    .bd-row { grid-template-columns: 1fr 1fr; gap: var(--sp-1) var(--sp-3); }
    .bd-name { grid-column: 1 / -1; }
    .bd-fig { justify-items: start; text-align: left; font-size: var(--fs-sm); }
    .bd-fig small { white-space: normal; }
    /* with the headers gone, each figure says which it is */
    .bd-fig::before { content: attr(data-label); display: block; color: var(--text-secondary);
                      font-size: var(--fs-xs); font-weight: 400; text-transform: uppercase; letter-spacing: .04em; }
    /* the marks get the full width under the two figures, rather than a fourth column nothing fits in */
    .bd-list.training .bd-row { grid-template-columns: 1fr 1fr; }
    .bd-att { grid-column: 1 / -1; justify-content: flex-start; margin-top: var(--sp-1); }
  }
</style>
