<script>
  // Weekly lines for any measure (phase 21, Admin › Analysis): one line per series, hand-made SVG, no chart library.
  // The scale fits the numbers (rounds 0–16, minutes 0–60, percentages 0–100), a week with no figure is a gap, and the
  // same numbers are in the table underneath. As wide as its box, so the labels stay 11 px on a phone and a desktop.
  import { fmtShort } from '../lib/dates.js';
  // weeks: [weekId] chronological · series: [{ key, label, color, values: [number|null] }] · unit: '%', ' rounds', …
  // fmtX / xLabel (Phase 23): the same chart over months or days — how a point is named, and the table's first column
  let { weeks = [], series = [], unit = '', max = null, label = 'Weekly trend', digits = 0, fmtX = fmtShort, xLabel = 'Week' } = $props();
  let box = $state(320);
  const W = $derived(Math.max(260, Math.round(box))), H = 200, L = 36, R = 8, T = 10, B = 28;
  // four round steps that cover the biggest figure: 15 rounds draws 0 5 10 15 20, never 3.8 7.5 11.3
  const nice = (x) => { const p = 10 ** Math.floor(Math.log10(x)), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const top = $derived(max || 4 * nice(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v !== null && v !== undefined))) / 4));
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f * 100) / 100));
  const x = (i) => (weeks.length < 2 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (weeks.length - 1));
  const y = (v) => T + ((top - Math.max(0, Math.min(top, v))) * (H - T - B)) / top;
  // a line broken where a week has no figure: one polyline per run of figures
  const runs = (vals) => { const out = []; let cur = []; vals.forEach((v, i) => { if (v === null || v === undefined) { if (cur.length) out.push(cur); cur = []; } else cur.push(`${x(i)},${y(v)}`); }); if (cur.length) out.push(cur); return out; };
  const every = $derived(Math.max(1, Math.ceil((weeks.length * 44) / (W - L - R))));
  const fmt = (v) => (v === null || v === undefined ? '—' : (digits ? v.toFixed(digits) : Math.round(v)) + unit);
</script>

<div bind:clientWidth={box}>
  <svg viewBox="0 0 {W} {H}" width={W} height={H} class="block max-w-full" role="img" aria-label={`${label}, ${weeks.length} ${xLabel === 'Week' ? 'weeks' : xLabel.toLowerCase() + 's'}: ${series.map((s) => s.label).join(', ')}`}>
    {#each ticks as g}
      <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--divider)" stroke-width="1" />
      <text x={L - 6} y={y(g) + 4} text-anchor="end" font-size="11" fill="var(--text-muted)">{g}</text>
    {/each}
    {#each series as s, si (s.key)}
      {#each runs(s.values) as pts}<polyline points={pts.join(' ')} fill="none" stroke={s.color} stroke-width={si === 0 ? 3 : 2} stroke-dasharray={s.dash || null} stroke-linejoin="round" stroke-linecap="round" />{/each}
      {#if weeks.length <= 26}{#each s.values as v, i}{#if v !== null && v !== undefined}<circle cx={x(i)} cy={y(v)} r={si === 0 ? 3 : 2.25} fill={s.color} />{/if}{/each}{/if}
    {/each}
    {#each weeks as w, i}
      <!-- the last date is drawn ending at its point: a date closer than 60 px before it would run into it -->
      {#if (weeks.length - 1 - i) % every === 0 && (i === weeks.length - 1 || x(weeks.length - 1) - x(i) >= 60)}<text x={x(i)} y={H - 8} text-anchor={i === weeks.length - 1 && weeks.length > 1 ? 'end' : 'middle'} font-size="11" fill="var(--text-muted)">{fmtX(w)}</text>{/if}
    {/each}
  </svg>
</div>
{#if series.length > 1}
  <ul class="m-0 mt-2 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 text-sm">
    {#each series as s (s.key)}<li class="flex items-center gap-2"><svg width="18" height="10" aria-hidden="true"><line x1="1" x2="17" y1="5" y2="5" stroke={s.color} stroke-width="3" stroke-dasharray={s.dash || null} stroke-linecap="round" /></svg>{s.label}</li>{/each}
  </ul>
{/if}
<details class="mt-2">
  <summary class="min-h-12 cursor-pointer py-3 text-center text-sm text-muted">Show the values</summary>
  <div class="lc-tbl">
    <table class="w-full border-collapse text-sm">
      <thead><tr><th class="py-1 text-left font-medium">{xLabel}</th>{#each series as s (s.key)}<th class="py-1 text-right font-medium">{s.label}</th>{/each}</tr></thead>
      <tbody>{#each weeks as w, i}<tr class="border-t border-line"><td class="py-1">{fmtX(w)}</td>{#each series as s (s.key)}<td class="py-1 text-right">{fmt(s.values[i])}</td>{/each}</tr>{/each}</tbody>
    </table>
  </div>
</details>

<style>
  .lc-tbl { overflow-x: auto; }
  .lc-tbl th, .lc-tbl td { padding-inline: 6px; white-space: nowrap; }
</style>
