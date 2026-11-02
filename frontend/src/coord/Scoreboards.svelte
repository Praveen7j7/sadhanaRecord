<script>
  /*
   * The scoreboards (the head, 18 Oct 2026).
   *
   * Two kinds, and the head sees both: every running TRAINING, and the FACILITATORS. A training's
   * coordinator sees their own board and nothing else — board.list answers for whoever asks.
   *
   * It opens on the week that has FINISHED, not the one in progress: a board read on Monday morning
   * is about last week, and the week just begun would read as everybody failing.
   *
   * Tapping a row opens that person's own card — the targets they set and what they filled against
   * them, over the window that applies to them: a training's dates for a trainee, the phase for a
   * facilitator.
   *
   * 22 Oct 2026 (ADR 0016): that card is the SAME screen the person fills (Card.svelte, read-only), as the
   * Facilitator Dashboard opens a facilitator's detail from its scoreboard. And a facilitator or a trainee now has
   * this screen too, holding their own row only — their place ("#4 of 20") and their own card, nobody else's.
   */
  import '../styles/screens.css';
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load as cacheLoad } from '../lib/cache.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Seg from '../ui/Seg.svelte';
  import Card from '../screens/Card.svelte';
  import { weekLabel, addDaysIso, todayIST, fmtDate } from '../lib/dates.js';

  /* Through the shared read cache (22 Oct 2026, as G23): the list and each board kept from the last visit show at once,
     and the server is asked again only when a copy is over two minutes old. Both were asked on EVERY visit (~3 s on a
     phone for the training coordinator). A board shares its copy with the Board tab (FacilitationBoard, same key). */
  const le = entry('board.list');
  const listBoards = (force = false) => cacheLoad('board.list', () => call('board.list'), { force });
  const boards = $derived(le.data?.boards ?? null);
  let chosen = $state('');
  const pick = $derived(chosen || (boards?.length ? key(boards[0]) : ''));
  const bk = $derived('board.get:' + pick);
  const be = $derived(entry(bk));
  const board = $derived(pick ? be.data ?? null : null);
  const loading = $derived(le.data === undefined && !le.error);
  const error = $derived(le.error && le.data === undefined ? errorMessage(le.error)
    : be.error && be.data === undefined ? errorMessage(be.error) : '');

  /* E3 (phase 22, the head, 26 Oct 2026): one period at a time — the board's week (focusWeek, the finished one until its
     deadline) or the phase so far — for every viewer of this screen, the head included. The same board.get reply holds
     both figures, so switching asks the server nothing; scores and places are the server's, unchanged. */
  let period = $state('week');
  // a training runs on its own dates, a facilitators' board on the phase's: say which, and over what dates (27 Oct 2026)
  const wholeWord = $derived(board?.training ? 'Whole training' : 'This phase');
  const span = $derived(board?.startsOn ? `${fmtDate(board.startsOn)} – ${board.endsOn ? fmtDate(board.endsOn) : 'no end date yet'}` : '');
  const weekWord = $derived(board?.weekId && addDaysIso(board.weekId, 6) < todayIST() ? 'Last week' : 'This week');

  // the person whose card is open
  let who = $state(null), cardDlg = $state();

  function key(b) { return b.kind === 'facilitators' ? 'facilitators' : b.batchId; }

  $effect(() => { listBoards(); });
  $effect(() => { const k = bk, p = pick; if (p) cacheLoad(k, () => call('board.get', p === 'facilitators' ? {} : { batchId: p })); });

  function openCard(r) { who = r; cardDlg?.showModal(); }

  /** A figure that may not exist. "—" is not 0, and the two must not look alike. */
  const pct = (n) => (n === null || n === undefined ? '—' : n + '%');
  const tone = (n) => (n === null || n === undefined ? 'none' : n >= 100 ? 'ok' : n >= 80 ? 'good' : n >= 50 ? 'mid' : 'low');
</script>

{#if loading && !boards}
  <Skeleton kind="list" rows={4} />
{:else if error && !boards}
  <Banner onretry={() => listBoards(true)}>{error}</Banner>
{:else if boards && !boards.length}
  <EmptyState icon="report" title="No boards yet">A board appears when a training is running, or when there are facilitators.</EmptyState>
{:else if boards}
  {#if boards.length > 1}
    <div class="sb-pick"><Seg id="sb-board" label="Board" srLabel options={boards.map((b) => [key(b), b.name])} value={pick} onchange={(v) => (chosen = v)} /></div>
  {:else}
    <h2 class="sb-only">{boards[0].name}</h2>
  {/if}

  {#if error}<Banner>{error}</Banner>{/if}
  {#if !board}
    <Skeleton kind="list" rows={5} />
  {:else}
    <div class="sb-period">
      <Seg id="sb-period" label="Period" srLabel options={[['week', weekWord], ['phase', wholeWord]]} value={period} onchange={(v) => (period = v)} />
      <p class="sb-week m-0">{period === 'week' ? weekLabel(board.weekId) : `${board.name} · ${span}`}</p>
    </div>
    {#if board.self && board.rows[0]}
      <!-- their own place only: the others' names and figures never reach this screen -->
      <p class="sb-self m-0">{board.rows[0].place ? `Your rank: #${board.rows[0].place} of ${board.of}` : `Not ranked yet · ${board.of} on this board`}</p>
    {/if}
    {#if !board.rows.length}
      <EmptyState icon="users" title="Nobody on this board yet">
        {board.kind === 'training' ? 'Add students to the training.' : 'Facilitators appear here once they are named.'}
      </EmptyState>
    {:else}
      <div class="sb-key" aria-hidden="true"><span></span><span>{period === 'week' ? weekWord : wholeWord}</span></div>
      <ul class="list sb-list" aria-label="Scores">
        {#each board.rows as r (r.login)}
          <li>
            <button type="button" class="sb-row" aria-haspopup="dialog" onclick={() => openCard(r)}>
              <!-- rank by the phase average, as the dashboard ranks; somebody with no targets has no rank rather than a last
                   place (the rows already put them last). The number is a reading aid; the figures say the same thing. -->
              <span class="sb-name"><span class="sb-rank" class:none={!r.place} data-p={r.place && r.place <= 3 ? r.place : undefined}>{r.place || ''}</span><span class="sb-who">{r.name}</span></span>
              {#if period === 'week'}
                <span class="sb-fig" data-label={weekWord} data-tone={tone(r.week)}>
                  {pct(r.week)}
                  {#if r.week !== null && r.week !== undefined}<i class="sb-bar" aria-hidden="true"><b style:width={Math.max(3, Math.min(100, r.week)) + '%'}></b></i>{/if}
                  <small>{r.asked ? `${r.filled} of ${r.asked} filled` : 'no targets set'}</small>
                </span>
              {:else}
                <span class="sb-fig" data-label="This phase" data-tone={tone(r.average)}>
                  {pct(r.average)}
                  {#if r.average !== null && r.average !== undefined}<i class="sb-bar" aria-hidden="true"><b style:width={Math.max(3, Math.min(100, r.average)) + '%'}></b></i>{/if}
                  <small>{r.weeksFilled} of {r.weeks} weeks</small>
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <Sheet bind:this={cardDlg} titleId="sb-card" title={who?.name || 'Card'} sub={board?.self ? 'Your card' : board?.kind === 'training' ? 'Their training card' : 'Their phase card'} wide>
    {#if who}{#key who.login}<Card login={who.login} weekId={board?.weekId} place={who.place} of={board?.of} />{/key}{/if}
  </Sheet>
{/if}

<style>
  /* 9rem, not 5.5rem (18 Oct 2026): "no targets set" and "0 of 11 weeks" are wider than 5.5rem, and
     with the small print forbidden to wrap the two columns ran into each other on a desktop —
     "no targets se0 of 11 weel". The phone layout below stacks them instead. */

  .sb-pick { margin-bottom: var(--sp-4); }
  .sb-only { margin: 0 0 var(--sp-3); font-size: var(--fs-h3); }
  .sb-self { display: inline-block; margin-bottom: var(--sp-3); padding: 2px var(--sp-2); border-radius: 999px;
             background: var(--accent-soft); color: var(--accent); font-weight: 650; font-variant-numeric: tabular-nums; }
  .sb-week { margin-bottom: var(--sp-3); color: var(--text-secondary); font-size: var(--fs-caption); font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
  .sb-period { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-3); }
  /* G6 (Phase 24, V12): a segment is as wide as its longest label and never wraps one ("Whole training" broke in two) */
  .sb-period :global(.field) { flex: 0 0 auto; min-width: min(100%, 12rem); max-width: 100%; margin: 0; }
  .sb-period :global(.seg button) { white-space: nowrap; padding-inline: 14px; }
  .sb-period .sb-week { margin-bottom: 0; }
  .sb-key { display: grid; grid-template-columns: minmax(0, 1fr) 9rem; gap: var(--sp-2);
            padding: 0 var(--sp-4) var(--sp-2); color: var(--text-secondary); font-size: var(--fs-xs);
            text-transform: uppercase; letter-spacing: .04em; }
  .sb-key span { text-align: right; }
  .sb-list { margin: 0; padding: 0; list-style: none; }
  /* padding on BOTH sides: the list is a bordered box, and with none the figures sat 1px from its
     edge on a phone and read as spilling out of it (18 Oct 2026) */
  .sb-row { display: grid; grid-template-columns: minmax(0, 1fr) 9rem; gap: var(--sp-2);
            align-items: center; width: 100%; padding: var(--sp-3) var(--sp-4); border: 0; border-bottom: 1px solid var(--border);
            background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  @media (hover: hover) { .sb-row:hover { background: var(--surface-hover); } }
  .sb-name { display: flex; align-items: center; gap: var(--sp-3); font-weight: 600; min-width: 0; }
  .sb-who { min-width: 0; overflow-wrap: anywhere; }
  .sb-rank { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
             background: var(--accent-soft); color: var(--accent); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  .sb-rank.none { background: transparent; border: 1px dashed var(--border); }
  /* the design pass (22 Oct 2026, phase 5b): the first three places in gold, as a podium; figures in the app's serif
     numbers with a thin bar in their band (100 / 80 / 50, the dashboard's bands) */
  .sb-rank[data-p] { background: var(--gold-decorative); color: #3a2a00; font-weight: 700; box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold-decorative) 25%, transparent); }
  .sb-fig { font-family: var(--font-serif); font-size: 1.125rem; }
  .sb-fig small, .sb-fig::before { font-family: var(--font-sans); font-size: var(--fs-caption); }
  .sb-bar { display: block; width: 100%; max-width: 7rem; height: 4px; margin: 3px 0 2px; border-radius: 2px; background: var(--surface-2); overflow: hidden; }
  .sb-bar b { display: block; height: 100%; border-radius: inherit; background: currentColor; }
  .sb-fig[data-tone='good'] { color: var(--accent); }
  .sb-fig[data-tone='mid'] { color: var(--text); }
  .sb-fig { display: grid; justify-items: end; text-align: right; font-variant-numeric: tabular-nums; font-weight: 650; }
  .sb-fig small { font-weight: 400; color: var(--text-secondary); font-size: var(--fs-xs); white-space: normal; overflow-wrap: anywhere; }
  .sb-fig[data-tone='none'] { color: var(--text-tertiary, var(--text-secondary)); font-weight: 400; }
  .sb-fig[data-tone='ok'] { color: var(--ok); }
  .sb-fig[data-tone='low'] { color: var(--warn, var(--text)); }
  .sb-list li:last-child .sb-row { border-bottom: 0; }
  /* a phone: the name takes its own line and the figures sit under it, as the Board screen does */
  @media (max-width: 420px) {
    .sb-key { display: none; }
    .sb-row { grid-template-columns: 1fr; gap: var(--sp-1) var(--sp-3); }
    .sb-name { grid-column: 1 / -1; }
    .sb-fig { justify-items: start; text-align: left; font-size: var(--fs-sm); }
    .sb-fig small { white-space: normal; }
    .sb-fig::before { content: attr(data-label); display: block; color: var(--text-secondary);
                      font-size: var(--fs-xs); font-weight: 400; text-transform: uppercase; letter-spacing: .04em; }
  }
</style>
