<script>
  // The scope strip (Phase 5, 9 Oct 2026): one row of the week's counts — Submitted · Filling · Not started · Missed —
  // with when the week closes. The same on My group, My students, Batch status and staff Home (boardCounts: active
  // members only). With `onpick` each count is a filter (tap again for everyone); without it, plain numbers.
  import { countUp } from '../lib/motion.js';
  let { counts, closes = '', value = '', onpick = null, label = 'This week', href = '', onnav = null } = $props();
  const CELLS = [['SUBMITTED', 'Submitted', 'ok'], ['DRAFT', 'Filling', 'warn'], ['NOT_STARTED', 'Not started', ''], ['MISSED', 'Missed', 'bad']];
</script>

<div class="scope">
  {#if href}
    <a class="sc-row" {href} onclick={() => onnav?.()} aria-label={`${label}: ${CELLS.map(([k, t]) => `${counts[k] || 0} ${t.toLowerCase()}`).join(', ')}`}>
      {#each CELLS as [k, t, tone]}<span class="sc-cell" data-tone={tone || undefined}><b {@attach countUp(counts[k] || 0, label + k)}>{counts[k] || 0}</b><span>{t}</span></span>{/each}
    </a>
  {:else}
    <div class="sc-row" class:sc-five={!!onpick} role="group" aria-label={onpick ? 'Show only' : label}>
      {#if onpick}
        <!-- #6 (22 Oct 2026): everyone, with the total, before the four — "All 10 · Submitted 4 · …" -->
        <button type="button" class="sc-cell" aria-pressed={value === ''} onclick={() => onpick('')}><b>{CELLS.reduce((n, [k]) => n + (counts[k] || 0), 0)}</b><span>All</span></button>
      {/if}
      {#each CELLS as [k, t, tone]}
        {#if onpick}<button type="button" class="sc-cell" data-tone={tone || undefined} aria-pressed={value === k} onclick={() => onpick(value === k ? '' : k)}><b {@attach countUp(counts[k] || 0, label + k)}>{counts[k] || 0}</b><span>{t}</span></button>
        {:else}<span class="sc-cell" data-tone={tone || undefined}><b {@attach countUp(counts[k] || 0, label + k)}>{counts[k] || 0}</b><span>{t}</span></span>{/if}
      {/each}
    </div>
  {/if}
  {#if closes}<p class="sc-close">Closes {closes}</p>{/if}
</div>

<style>
  .scope { margin-bottom: var(--sp-3); container-type: inline-size; }
  .sc-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px; padding: 3px; border-radius: var(--r-md); background: var(--surface-muted); color: inherit; text-decoration: none; }
  .sc-row.sc-five { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .sc-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 52px; padding: 4px 2px; border: 0; border-radius: calc(var(--r-md) - 3px); background: transparent; color: var(--text); font: inherit; line-height: 1.15; }
  button.sc-cell { cursor: pointer; }
  @media (hover: hover) { button.sc-cell:hover { background: var(--surface-hover); } a.sc-row:hover { background: var(--surface-hover); } }
  .sc-cell b { font-size: 1.125rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .sc-cell span { font-size: var(--fs-caption); color: var(--text-muted); white-space: nowrap; }
  .sc-cell[data-tone='ok'] b { color: var(--success); } .sc-cell[data-tone='warn'] b { color: var(--warning); } .sc-cell[data-tone='bad'] b { color: var(--danger); }
  .sc-cell[aria-pressed='true'] { background: var(--surface-elevated); box-shadow: var(--shadow-1), inset 0 0 0 1.5px var(--accent); }
  /* a narrow strip (a 320 px phone, five tiles): a label takes two lines rather than running into the next one —
     "Not started" touched "Missed" (Phase 24, V3 / V39); decided by the strip's own width, not the window's */
  @container (max-width: 400px) {
    .sc-cell span { white-space: normal; text-align: center; text-wrap: balance; }
    /* five filters: All · Submitted · Filling on one row, Not started · Missed on the next — never five 54 px tiles */
    .sc-row.sc-five { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .sc-row.sc-five > :nth-child(-n + 3) { grid-column: span 2; }
    .sc-row.sc-five > :nth-child(n + 4) { grid-column: span 3; }
  }
  .sc-close { margin: 6px 2px 0; font-size: var(--fs-caption); color: var(--text-muted); }
  @media (prefers-reduced-motion: no-preference) { .sc-cell { transition: background-color 120ms var(--ease); } }
</style>
