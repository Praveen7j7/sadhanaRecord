<script>
  // Column bars (Phase 5, 9 Oct 2026): every column visible at once — no sideways carousel — in one colour, the value
  // above each column, an optional dashed average line, and "Show as table" with the same numbers.
  // items: [{ label, value, short?, sub? }] (short + sub: a compact two-line label for narrow columns, e.g. "17" / "Aug"); max: the top of the scale; unit: '%' or ''.
  let { items = [], max = 100, unit = '%', avg = false, title = '' } = $props();
  let table = $state(false);
  const top = $derived(Math.max(1, max, ...items.map((x) => x.value || 0)));
  const mean = $derived(items.length ? Math.round(items.reduce((a, x) => a + (x.value || 0), 0) / items.length) : 0);
</script>

<div class="cb">
  {#if table}
    <table class="cb-table"><caption class="sr-only">{title}</caption>
      <thead><tr><th scope="col">{items.length === 7 ? 'Day' : 'Week'}</th><th scope="col">Value</th></tr></thead>
      <tbody>{#each items as it}<tr><th scope="row">{it.label}</th><td>{it.value}{unit}</td></tr>{/each}{#if avg}<tr><th scope="row">Average</th><td>{mean}{unit}</td></tr>{/if}</tbody>
    </table>
  {:else}
    <div class="cb-plot" role="img" aria-label={`${title}: ${items.map((x) => `${x.label} ${x.value}${unit}`).join(', ')}${avg ? `. Average ${mean}${unit}` : ''}`} style:--n={items.length}>
      {#if avg}<span class="cb-avg" style:bottom={`${34 + (mean / top) * 114}px`}><i>avg {mean}{unit}</i></span>{/if}
      {#each items as it}
        <span class="cb-col">
          <b>{it.value}{unit}</b>
          <span class="cb-bar"><i style:height={`${Math.max(2, ((it.value || 0) / top) * 100)}%`}></i></span>
          <span class="cb-l">{it.short ?? it.label}{#if it.sub}<small>{it.sub}</small>{/if}</span>
        </span>
      {/each}
    </div>
  {/if}
  <button type="button" class="btn btn-text btn-sm cb-toggle" aria-pressed={table} onclick={() => (table = !table)}>{table ? 'Show as bars' : 'Show as table'}</button>
</div>

<style>
  .cb-plot { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; height: 168px; align-items: end; }   /* 16 value + 4 + 114 bars + 4 + 30 label */
  .cb-col { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; min-width: 0; }
  .cb-col b { height: 16px; line-height: 16px; font-size: var(--fs-caption); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cb-bar { flex: 1; display: flex; align-items: flex-end; width: min(28px, 100%); }
  .cb-bar i { display: block; width: 100%; border-radius: 6px 6px 2px 2px; background: var(--accent); transform-origin: bottom; animation: cb-in var(--d-3) var(--ease) both; }
  .cb-l small { display: block; font-size: 0.6875rem; line-height: 1.1; }
  .cb-l { height: 30px; text-align: center; line-height: 1.2; font-size: var(--fs-caption); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .cb-avg { position: absolute; left: 0; right: 0; border-top: 1.5px dashed color-mix(in srgb, var(--text-muted) 70%, transparent); pointer-events: none; }
  .cb-avg i { position: absolute; right: 0; top: -18px; font-style: normal; font-size: var(--fs-caption); color: var(--text-muted); background: var(--surface); padding: 0 4px; }
  @keyframes cb-in { from { transform: scaleY(0); } }
  @media (prefers-reduced-motion: reduce) { .cb-bar i { animation: none; } }
  :global(:root[data-tier='low']) .cb-bar i { animation: none; }
  .cb-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
  .cb-table th, .cb-table td { padding: 6px 4px; border-bottom: 1px solid var(--divider); text-align: left; }
  .cb-table td { text-align: right; font-variant-numeric: tabular-nums; }
  .cb-toggle { margin-top: 6px; }
</style>
