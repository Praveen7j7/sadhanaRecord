<script>
  // Horizontal meters (Phase 4, 8 Oct 2026): every score at once, the headline (Total / Overall) first, then the rest
  // weakest first, each in its category's fixed colour; under 50 % hatched and marked "low" (never colour alone).
  // Replaces the sideways bar carousel on Report and a week's scores. "Show as table" gives the same numbers as a table.
  // items: [{ label, value, cat }] with values 0–100.
  let { items, title = 'Scores', sort = true } = $props();
  let table = $state(false);
  const head = $derived(items[0]);
  // An item may carry `parts`: it is the AVERAGE of them, so it keeps them with it and they are shown indented
  // underneath (the user, 11 Oct 2026 — flat, a facilitator cannot tell Body from the three things Body averages).
  // Weakest-first sorting applies within a level, never across one, or the grouping would be scrambled again.
  const bySize = (a, b) => a.value - b.value;
  const rest = $derived.by(() => {
    const r = items.slice(1);
    const out = sort ? [...r].sort(bySize) : r;
    return out.flatMap((it) => (it.parts ? [it, ...(sort ? [...it.parts].sort(bySize) : it.parts)] : [it]));
  });
</script>

<div class="meters">
  {#if table}
    <table class="m-table">
      <caption class="sr-only">{title}</caption>
      <thead><tr><th scope="col">Part</th><th scope="col">Score</th></tr></thead>
      <tbody>{#each [head, ...rest] as it}<tr><th scope="row">{it.part ? '— ' : ''}{it.label}{#if it.of} (average of {it.of}){/if}</th><td>{it.value}%</td></tr>{/each}</tbody>
    </table>
  {:else}
    <ul class="m-list" aria-label={title}>
      {#each [head, ...rest] as it, i}
        <li class:m-head={i === 0} class:m-group={it.group} class:m-part={it.part} data-cat={it.cat || 'overall'} data-low={it.value < 50 ? '' : undefined}>
          <span class="m-l">{it.label}{#if it.of}<span class="m-of">average of {it.of}</span>{/if}</span>
          <span class="m-bar" aria-hidden="true"><i style:width={Math.max(2, Math.min(100, it.value)) + '%'}></i></span>
          <span class="m-v">{it.value}%{#if it.value < 50}<span class="m-low"> low</span>{/if}</span>
        </li>
      {/each}
    </ul>
  {/if}
  <button type="button" class="btn btn-text btn-sm m-toggle" aria-pressed={table} onclick={() => (table = !table)}>{table ? 'Show as bars' : 'Show as table'}</button>
</div>

<style>
  .m-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .m-list li.m-group > .m-l { font-weight: 700; }
  .m-list li.m-part > .m-l { padding-left: 14px; position: relative; color: var(--text-secondary); }
  .m-list li.m-part > .m-l::before { content: ''; position: absolute; left: 4px; top: 50%; width: 6px; height: 1px; background: var(--border); }
  .m-of { display: block; font-size: var(--fs-caption); font-weight: 400; color: var(--text-muted); line-height: 1.2; margin-top: 1px; }
  .m-list li { display: grid; grid-template-columns: minmax(84px, 7.5rem) minmax(0, 1fr) 4.5rem; align-items: center; gap: 10px; font-size: var(--fs-sm); }
  .m-list li { --c: var(--accent); }
  .m-list li[data-cat='body'] { --c: var(--viz-body); } .m-list li[data-cat='soul'] { --c: var(--viz-soul); }
  .m-list li[data-cat='seva'] { --c: var(--viz-seva); } .m-list li[data-cat='att'] { --c: var(--viz-att); }
  .m-l { min-width: 0; overflow-wrap: anywhere; }
  .m-bar { height: 10px; border-radius: 5px; background: var(--surface-muted); overflow: hidden; }
  .m-bar i { display: block; height: 100%; border-radius: 5px; background: var(--c); transform-origin: left; animation: m-in var(--d-3) var(--ease) both; }
  li[data-low] .m-bar i { background: repeating-linear-gradient(135deg, var(--c) 0 5px, color-mix(in srgb, var(--c) 40%, var(--surface)) 5px 9px); }
  .m-v { text-align: right; font-weight: 650; font-variant-numeric: tabular-nums; }
  .m-low { font-weight: 500; color: var(--text-muted); font-size: var(--fs-caption); }
  .m-head { padding-bottom: 10px; border-bottom: 1px solid var(--divider); font-weight: 650; }
  .m-head .m-bar { height: 14px; border-radius: 7px; }
  .m-head .m-v { font-size: 1.0625rem; }
  @keyframes m-in { from { transform: scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { .m-bar i { animation: none; } }
  .m-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
  .m-table th, .m-table td { padding: 6px 4px; border-bottom: 1px solid var(--divider); text-align: left; }
  .m-table td { text-align: right; font-variant-numeric: tabular-nums; }
  .m-toggle { margin-top: 6px; }
</style>
