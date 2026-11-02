<script>
  // A sparkline (Phase 5, 9 Oct 2026): the last weeks' scores, oldest left, as one small inline SVG with the average as
  // a dashed line. A missed week (0) shows as a dip. The numbers are said in words for screen readers.
  let { values = [], label = 'Last weeks', w = 120, h = 32 } = $props();
  const pts = $derived(values.filter((v) => v !== null && v !== undefined));
  const avg = $derived(pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : null);
  const y = (v) => (h - 3 - (Math.max(0, Math.min(100, v)) / 100) * (h - 6)).toFixed(1);
  const x = (i) => (pts.length < 2 ? w / 2 : 2 + (i * (w - 4)) / (pts.length - 1)).toFixed(1);
  const line = $derived(pts.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' '));
</script>

{#if pts.length}
  <span class="spark">
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${pts.join('%, ')}%. Average ${avg}%.`}>
      <line x1="0" x2={w} y1={y(avg)} y2={y(avg)} class="sp-avg" />
      {#if pts.length > 1}<path d={line} class="sp-line" />{/if}
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="2.5" class="sp-dot" />
    </svg>
    <span class="sp-txt">avg <b>{avg}%</b></span>
  </span>
{/if}

<style>
  .spark { display: inline-flex; align-items: center; gap: 8px; }
  .sp-line { fill: none; stroke: var(--accent); stroke-width: 1.75; stroke-linejoin: round; stroke-linecap: round; }
  .sp-avg { stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: .6; }
  .sp-dot { fill: var(--accent); }
  .sp-txt { font-size: var(--fs-caption); color: var(--text-muted); white-space: nowrap; }
  .sp-txt b { color: var(--text); font-variant-numeric: tabular-nums; }
</style>
