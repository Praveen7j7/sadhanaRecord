<script>
  // The page header (Phase 24, G2 / V26): one way to start a screen. The top bar already names the screen, so a header
  // never repeats it: `title` is what THIS view is (a week, a count, a list's name), or, with `sr`, a heading kept for
  // screen readers only. One meta line under it, and one actions slot on the same row (Refresh, Export, the primary
  // action); the row wraps as a whole, never one button alone. `children` is for a control that IS the title (a picker).
  // Styles: .page-head / .ph-* in styles/screens.css.
  let { title = '', id = undefined, count = undefined, sr = false, meta = '', actions = undefined, children = undefined, class: cls = '' } = $props();
</script>

<div class="page-head ph {cls}">
  <div class="ph-main">
    {#if title}<h2 {id} class={sr ? 'sr-only' : 'ph-t'}>{title}{#if count !== undefined}{' '}<span class="pill align-middle" data-tone={count ? 'accent' : ''}>{count}</span>{/if}</h2>{/if}
    {@render children?.()}
    {#if meta}<p class="ph-meta">{meta}</p>{/if}
  </div>
  {#if actions}<div class="ph-tools">{@render actions()}</div>{/if}
</div>
