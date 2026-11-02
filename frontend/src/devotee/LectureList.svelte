<script>
  import WheelSelect from '../ui/WheelSelect.svelte';
  import { pressedInView } from '../lib/chips.js';
  // The devotee's journal of lectures. Opens on one week at a time (the suggested week: the first with a lecture not
  // heard yet), chosen on a strip of the journal's weeks (phase 21, 23 Oct 2026; the head: "a slider to switch between
  // the weeks instead of < and >") or by swipe / ←→; "All weeks" lists the whole journal with filters (week, slot, heard).
  // One search box sits above both views: typing searches the whole journal (it switches to All weeks). Shared by Hearing (tap: the recording opens in Google Drive, in a new tab; no player in the app)
  // and the day form's picker (onToggle: Choose / Chosen). The full list shows 30 at a time.
  import { suggestedWeek } from '../lib/refdata.js';
  import { SLOTS, filterLectures, lectureLink, weeksOf, isFiltered, weekLectures, stepWeek } from '../lib/lectures.js';
  import { swipeDir } from '../lib/carousel.js';
  import Icon from '../ui/Icon.svelte';
  import Search from '../ui/Search.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  let { lectures = [], heard = [], filters = $bindable(), idp = 'll', selected = [], onToggle = null, full = false, pin = false } = $props();
  const STEP = 30;
  let shown = $state(STEP);
  const heardSet = $derived(new Set(heard));
  // the whole journal allotted to the devotee, on the Hearing page and in the day form alike (the head, 8 Oct 2026: the
  // 7 Oct limit to the weeks "reached" left some on week 1 of 1); it still opens on the suggested week, never week 81
  const all = $derived(lectures);
  const sugg = $derived(all.length ? suggestedWeek(all, heard) : null);
  const reached = $derived(all);
  const weeks = $derived(weeksOf(reached));
  const last = $derived(weeks[weeks.length - 1]);
  // one-week view: the stepper's week (the suggested week until the devotee moves)
  $effect(() => { if (!filters.all && sugg && !weeks.includes(filters.week)) filters.week = sugg.week; });
  const list = $derived(filters.all ? filterLectures(reached, filters, heard) : weekLectures(reached, filters.week));
  const filtered = $derived(isFiltered(filters));
  const isOn = (id) => selected.some((s) => s.lectureId === id);
  $effect(() => { filters.all; filters.week; filters.slot; filters.q; filters.heard; shown = STEP; });
  const clear = () => Object.assign(filters, { week: '', slot: '', q: '', heard: '' });
  const ACT = { file: 'Listen', folder: 'Open folder' };
  // Hearing: one grouped list; the day form's picker: separate rows, each with its Choose button
  const UL = $derived(onToggle ? 'm-0 grid list-none gap-2 p-0' : 'list');
  let oneWeek = '';
  function view(all) {
    if (all === filters.all) return;
    if (all) { oneWeek = filters.week; Object.assign(filters, { all: true, week: '' }); }
    else Object.assign(filters, { all: false, week: oneWeek || sugg?.week || weeks[0], slot: '', q: '', heard: '' });
  }
  const step = (d) => (filters.week = stepWeek(weeks, filters.week, d));
  // the strip keeps the chosen week in view whenever it changes (a tap, a swipe, a key, "back to the suggested week")
  let strip = $state();
  // B4 (Phase 22): the strip glides to the chosen week (CSS scroll-behavior) — except the first time a strip is drawn,
  // when it jumps there at once, so the page never opens with the strip sliding in from week 1
  let placed = null;
  $effect(() => {
    filters.week;
    if (!strip) return;
    if (strip !== placed) strip.style.scrollBehavior = 'auto';
    pressedInView(strip);
    strip.style.scrollBehavior = '';
    placed = strip;
  });
  // a tap that ends a swipe or stops a fling never chooses a week: a click after the strip moved under the finger is
  // dropped (a key press has detail 0 and always counts)
  let sl0 = 0;
  const stripDown = (e) => { sl0 = e.currentTarget.scrollLeft; };
  const stripClick = (e) => { if (e.detail && Math.abs(e.currentTarget.scrollLeft - sl0) > 4) { e.preventDefault(); e.stopPropagation(); } };
  // typing in the search looks through the whole journal, not only the week on screen
  function typed() { if (!filters.all && String(filters.q || '').trim()) view(true); }

  // swipe left / right over the week's lectures (a swipe never opens a lecture)
  let sx = 0, sy = 0, swiped = false;
  const down = (e) => { sx = e.clientX; sy = e.clientY; swiped = false; };
  function up(e) { const d = swipeDir(e.clientX - sx, e.clientY - sy); if (d) { swiped = true; step(d); } }
  // ←/→ on the strip: the next week, and the keyboard focus follows it
  function key(e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1); queueMicrotask(() => strip?.querySelector('[aria-pressed="true"]')?.focus()); } }
</script>

{#snippet row(l)}
  {@const link = lectureLink(l)}
  {@const was = heardSet.has(l.lectureId)}
  {#if onToggle}
    <li class="action items-start {isOn(l.lectureId) ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : ''}">
      <span class="min-w-0 flex-1">
        <span class="block text-xs text-muted">{l.slot} · week {l.week}{was ? ' · heard' : ''}</span>
        <span class="block break-words font-medium">{l.title}</span>
        {#if link.kind !== 'none'}<a class="link min-h-9 text-sm" href={link.url} target="_blank" rel="noopener noreferrer">{ACT[link.kind]}<Icon name="open" size={14} /><span class="sr-only"> (opens in a new tab)</span></a>
        {:else}<span class="block text-xs text-muted">No recording linked</span>{/if}
      </span>
      <button type="button" class="btn btn-sm shrink-0 {isOn(l.lectureId) ? 'btn-primary w-auto' : ''}" aria-pressed={isOn(l.lectureId)} disabled={!isOn(l.lectureId) && full} onclick={() => onToggle(l)}>{isOn(l.lectureId) ? 'Chosen ✓' : 'Choose'}</button>
    </li>
  {:else if link.kind !== 'none'}
    <!-- a row of the grouped list: the whole row opens the recording (Google Drive, a new tab) -->
    <li><a class="lrow items-start" href={link.url} target="_blank" rel="noopener noreferrer">
      <span class="lc-ico" class:lc-heard={was} aria-hidden="true"><Icon name={was ? 'check' : 'hear'} size={18} /></span>
      <span class="lmain">
        <span class="ls lc-meta">{l.slot} · week {l.week}{#if was}{' · '}<b>heard</b>{/if}</span>
        <span class="lt font-medium">{l.title}</span>
      </span>
      <span class="lend self-center text-sm font-semibold text-brand">{ACT[link.kind]}<Icon name="open" size={16} /></span>
      <span class="sr-only"> (opens in a new tab)</span>
    </a></li>
  {:else}
    <li class="lrow items-start">
      <span class="lc-ico" class:lc-heard={was} aria-hidden="true"><Icon name={was ? 'check' : 'hear'} size={18} /></span>
      <span class="lmain">
        <span class="ls lc-meta">{l.slot} · week {l.week}{#if was}{' · '}<b>heard</b>{/if}</span>
        <span class="lt font-medium">{l.title}</span>
      </span>
      <span class="lend self-center text-xs text-muted">No recording linked</span>
    </li>
  {/if}
{/snippet}

<Search id="{idp}-q" label="Search lectures" placeholder="Search lectures" class="mb-3" maxlength="60" bind:value={filters.q} oninput={typed} {pin} />
<div class="seg mb-4" role="group" aria-label="Show lectures">
  <button type="button" aria-pressed={!filters.all} onclick={() => view(false)}>One week</button>
  <button type="button" aria-pressed={filters.all} onclick={() => view(true)}>All weeks</button>
</div>

{#if !filters.all}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="chiprow one-line wkstrip mb-1" role="group" aria-label="Journal week" data-noswipe bind:this={strip} onkeydown={key} onpointerdown={stripDown} onclickcapture={stripClick}>
    {#each weeks as w (w)}<button type="button" class="chipbtn wk" class:wk-sugg={sugg?.week === w} aria-pressed={filters.week === w} aria-label="Week {w}{sugg?.week === w ? ', suggested' : ''}" onclick={() => (filters.week = w)}>{w}</button>{/each}
  </div>
  <p class="wknow m-0 mb-2 flex min-h-11 flex-wrap items-center justify-center gap-x-2 text-center text-sm">
    <span aria-live="polite"><b>Lesson week {filters.week}</b> <span class="text-muted">of {last}</span></span>
    {#if sugg && filters.week === sugg.week}<span class="pill" data-tone="info">Suggested</span>
    {:else if sugg}<button type="button" class="link text-sm" onclick={() => (filters.week = sugg.week)}>Back to the suggested week ({sugg.week})</button>{/if}
  </p>
  <ul class="swipe mb-2 {UL}" onpointerdown={down} onpointerup={up} onclickcapture={(e) => { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }}>
    {#each list as l (l.lectureId)}{@render row(l)}{:else}<EmptyState tag="li" icon="hear">No lectures in this week.</EmptyState>{/each}
  </ul>
{:else}
  <div class="mb-2 grid gap-2">
    {#if sugg}
      <div class="chiprow m-0" role="group" aria-label="Quick filters">
        <button type="button" class="chipbtn" aria-pressed={filters.week === sugg.week} onclick={() => (filters.week = filters.week === sugg.week ? '' : sugg.week)}>Suggested: week {sugg.week}</button>
        {#if filtered}<button type="button" class="chipbtn" onclick={clear}>Clear filters</button>{/if}
      </div>
    {/if}
    <div class="pair">
      <WheelSelect id="{idp}-w" label="Week" class="mb-2" value={String(filters.week)} options={[['', 'All weeks'], ...weeks.map((w) => [String(w), 'Week ' + w])]} onchange={(v) => (filters.week = v ? Number(v) : '')} />
      <WheelSelect id="{idp}-h" label="Heard" class="mb-2" bind:value={filters.heard} options={[['', 'All'], ['no', 'Not heard yet'], ['yes', 'Heard']]} />
    </div>
    <div class="chiprow one-line mb-0" role="group" aria-label="Slot" {@attach pressedInView}>
      <button type="button" class="chipbtn" aria-pressed={!filters.slot} onclick={() => (filters.slot = '')}>All slots</button>
      {#each SLOTS as s}<button type="button" class="chipbtn" aria-pressed={filters.slot === s} onclick={() => (filters.slot = filters.slot === s ? '' : s)}>{s}</button>{/each}
    </div>
  </div>
  <p class="mb-2 mt-0 text-sm text-muted" role="status">{list.length === reached.length ? `All ${list.length} lectures` : `${list.length} of ${reached.length} lectures`}</p>
  <ul class="mb-2 {UL}">
    {#each list.slice(0, shown) as l (l.lectureId)}{@render row(l)}
    {:else}<EmptyState tag="li" icon="search" title="No lecture matches">Try other filters.{#snippet action()}<button type="button" class="btn" onclick={clear}>Clear filters</button>{/snippet}</EmptyState>{/each}
  </ul>
  {#if list.length > shown}<button type="button" class="btn w-full" onclick={() => (shown += STEP)}>Show more ({list.length - shown} left)</button>{/if}
{/if}

<style>
  .lc-ico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); }
  .lc-ico.lc-heard { background: var(--success-soft); color: var(--success); }
  .lc-meta { font-size: var(--fs-caption); }
  .lc-meta b { color: var(--text); font-weight: 650; }   /* full contrast on any row tint (axe, 9 Oct 2026) */
  /* the week strip: one number per lesson week, the chosen one filled; the suggested week carries a dot */
  .wk { min-width: 44px; justify-content: center; padding: 0 10px; font-variant-numeric: tabular-nums; position: relative; }
  .wk[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }
  /* B4 (Phase 22): native momentum scrolling that settles on a week; a vertical drag on the strip still scrolls the
     page, a sideways one never pulls the page or the browser back. A chip keeps its size when chosen (no tick, one
     weight) and does not sink while a finger drags across it, so nothing in the strip shifts or jiggles. */
  .wkstrip { touch-action: manipulation; overscroll-behavior-x: contain; scroll-snap-type: x proximity; }
  @media (prefers-reduced-motion: no-preference) { .wkstrip { scroll-behavior: smooth; } }
  .wk, .wk[aria-pressed='true'] { font-weight: 650; scroll-snap-align: start; }
  .wk[aria-pressed='true']::before { content: none; }
  .wk:active { scale: none; }
  .wk-sugg::after { content: ''; position: absolute; top: 5px; right: 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--gold-decorative); }
  .wk[aria-pressed='true'].wk-sugg::after { background: currentColor; }
</style>
