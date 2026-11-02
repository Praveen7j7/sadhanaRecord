<script>
  // Progress ring: n of total (days complete this week). `label` and `text` let another count use it — a batch's forms
  // submitted on the staff Home (C7, 22 Oct 2026), where "n/total" would not fit a large batch.
  let { n = 0, total = 7, size = 56, label = '', text = '' } = $props();
  const r = 22, c = 2 * Math.PI * r;
  const frac = $derived(Math.max(0, Math.min(1, n / total)));
</script>

<svg width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={label || `${n} of ${total} days complete`}>
  <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="6" />
  <circle class="ring-arc" cx="28" cy="28" r={r} fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray={`${frac * c} ${c}`} transform="rotate(-90 28 28)" />
  <text x="28" y="33" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">{text || `${n}/${total}`}</text>
</svg>
