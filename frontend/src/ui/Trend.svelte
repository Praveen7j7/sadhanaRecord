<script>
  // Weekly trend lines (Overall, Body, Soul), hand-made SVG. Values 0-100. The same numbers are in the table underneath.
  // The drawing is as wide as its box (not scaled), so the labels stay 11 px on a phone and on a desktop.
  import { fmtShort } from '../lib/dates.js';
  let { weeks } = $props();                                  // chronological: [{ weekId, overall, body, soul }]
  let box = $state(320);
  const W = $derived(Math.max(260, Math.round(box))), H = 180, L = 30, R = 6, T = 10, B = 28;
  const SERIES = [['overall', 'Overall', 'var(--accent)'], ['body', 'Body', 'var(--viz-body)'], ['soul', 'Soul', 'var(--viz-soul)']];   // the categories' fixed colours
  const x = (i) => (weeks.length < 2 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (weeks.length - 1));
  const y = (v) => T + ((100 - Math.max(0, Math.min(100, v))) * (H - T - B)) / 100;
  const pts = (k) => weeks.map((w, i) => `${x(i)},${y(w[k])}`).join(' ');
  // a date under every point while they fit (about 44 px each), otherwise under every second or third
  const every = $derived(Math.max(1, Math.ceil((weeks.length * 44) / (W - L - R))));
</script>

<div bind:clientWidth={box}>
<svg viewBox="0 0 {W} {H}" width={W} height={H} class="block max-w-full" role="img" aria-label={`Weekly trend over the last ${weeks.length} weeks: Overall, Body and Soul, from 0 to 100 percent`}>
  {#each [0, 25, 50, 75, 100] as g}
    <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--divider)" stroke-width="1" />
    <text x={L - 6} y={y(g) + 4} text-anchor="end" font-size="11" fill="var(--text-muted)">{g}</text>
  {/each}
  <!-- Body and Soul first, Overall drawn last and thicker: the line that matters most sits on top -->
  {#each [...SERIES].reverse() as [k, , color]}
    <polyline points={pts(k)} fill="none" stroke={color} stroke-width={k === 'overall' ? 3 : 2} stroke-linejoin="round" stroke-linecap="round" />
    {#each weeks as w, i}<circle cx={x(i)} cy={y(w[k])} r={k === 'overall' ? 3.5 : 2.5} fill={color} />{/each}
  {/each}
  {#each weeks as w, i}
    {#if (weeks.length - 1 - i) % every === 0}<text x={x(i)} y={H - 8} text-anchor={i === weeks.length - 1 && weeks.length > 1 ? 'end' : 'middle'} font-size="11" fill="var(--text-muted)">{fmtShort(w.weekId)}</text>{/if}
  {/each}
</svg>
</div>
<ul class="m-0 mt-2 flex list-none flex-wrap justify-center gap-4 p-0 text-sm">
  {#each SERIES as [, label, color]}<li class="flex items-center gap-2"><svg width="14" height="14" aria-hidden="true"><rect width="14" height="14" rx="4" fill={color} /></svg>{label}</li>{/each}
</ul>
<details class="mt-2">
  <summary class="min-h-12 cursor-pointer py-3 text-center text-sm text-muted">Show the values</summary>
  <table class="w-full border-collapse text-sm">
    <thead><tr><th class="py-1 text-left font-medium">Week</th><th class="py-1 text-right font-medium">Overall</th><th class="py-1 text-right font-medium">Body</th><th class="py-1 text-right font-medium">Soul</th></tr></thead>
    <tbody>{#each weeks as w}<tr class="border-t border-line"><td class="py-1">{fmtShort(w.weekId)}</td><td class="py-1 text-right">{w.overall}%</td><td class="py-1 text-right">{w.body}%</td><td class="py-1 text-right">{w.soul}%</td></tr>{/each}</tbody>
  </table>
</details>
