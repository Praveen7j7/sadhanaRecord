<script>
  // Vertical bars as a slider: rounded pill bars on one baseline, the value above each, the full label below (two
  // lines at most, never cut short). As many bars as fit are shown; the rest slide in sideways (swipe, or the dots).
  // items: [{ label, value }]; heights are value / max (default percentages). The first bar (Total / Overall) stands
  // out; a bar under 50% is shown in a soft red. mono: one colour for a series over time (the filling chart).
  // it.cat (overall / body / soul / seva / att): the category's fixed colour (8 Oct 2026); under 50% it is hatched, never red.
  let { items, title = 'Activity Score', max = 100, unit = '%', mono = false } = $props();
  const h = (v) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);
  const tone = (v, i) => (mono ? undefined : i === 0 ? 'lead' : h(v) < 50 ? 'low' : 'ok');
  let el = $state(), pages = $state(1), page = $state(0);
  function measure() {
    if (!el || !el.clientWidth) return;              // not laid out yet (a tab still opening): measure on the next resize
    pages = Math.max(1, Math.ceil((el.scrollWidth - 2) / el.clientWidth));
    const end = el.scrollWidth - el.clientWidth;
    page = el.scrollLeft >= end - 2 ? pages - 1 : Math.min(pages - 1, Math.round(el.scrollLeft / el.clientWidth));
  }
  $effect(() => {
    items; measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  });
  const goPage = (p) => el.scrollTo({ left: Math.min(p * el.clientWidth, el.scrollWidth - el.clientWidth), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
</script>

<div class="barsx" data-more={page < pages - 1 ? '' : undefined}>
  <div class="bars" class:mono bind:this={el} onscroll={measure} role="img" aria-label={title + ': ' + items.map((i) => `${i.label} ${i.value}${unit}`).join(', ')}>
    {#each items as it, i}
      <div class="bar" data-tone={it.cat ? undefined : tone(it.value, i)} data-cat={it.cat} data-low={it.cat && h(it.value) < 50 ? '' : undefined}>
        <div class="plot"><b>{it.value}{unit}</b><div class="col" style:height={`calc(${h(it.value)}% * 0.82)`}></div></div>
        <span class="lbl">{it.label}</span>
      </div>
    {/each}
  </div>
  {#if pages > 1}
    <div class="bars-dots">{#each Array(pages) as _, p}<button type="button" aria-label={`Bars ${p + 1} of ${pages}`} aria-current={p === page ? 'true' : undefined} onclick={() => goPage(p)}></button>{/each}</div>
  {/if}
</div>
