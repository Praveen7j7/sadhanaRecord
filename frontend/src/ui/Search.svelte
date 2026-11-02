<script>
  // Search box: magnifier, a clear button once something is typed. The label is visible unless srLabel.
  // `pin` (27 Oct 2026, search audit): on a long list the field stays within reach. Once it scrolls under the top bar it
  // is pinned there, in a compact band as wide as the bar, at the place and width it had in the page; back at the top it
  // is simply in its place again. A band and not a floating button: a button over the list sat on the rows' own actions
  // (call, WhatsApp, the attendance marks), and a band covers nothing one acts on — rows pass under it as under the bar.
  // It is the SAME input moved, never a second one: what is typed, the focus, the id the checks use and the screen's own
  // filtering stay as they are, and the page does not move (the slot keeps its height; the band is fixed over it).
  // Short pages (under 1.5 screens) never pin. One IntersectionObserver; resize listeners only while pinned; all removed.
  import Icon from './Icon.svelte';
  let { id, label = 'Search', value = $bindable(''), placeholder = '', srLabel = true, pin = false, class: cls = '', ...rest } = $props();
  let el = $state(), slot = $state(), band = $state();
  let away = $state(false), box = $state(null);
  const pinned = $derived(pin && away);

  $effect(() => {
    if (!pin || !slot || typeof IntersectionObserver !== 'function') return;
    // under the top bar counts as out of sight; only a page at least 1.5 screens long pins
    const t = document.querySelector('.topbar')?.offsetHeight || 56;
    const io = new IntersectionObserver(([e]) => {
      away = !e.isIntersecting && e.boundingClientRect.top < t && document.documentElement.scrollHeight > innerHeight * 1.5;
    }, { rootMargin: `-${t}px 0px 0px 0px` });
    io.observe(slot);
    return () => { io.disconnect(); away = false; };
  });

  // while pinned: where to draw it (as wide as the top bar, under it and an offline bar), kept on resize, and moved with
  // the visual viewport when a phone's keyboard pans the page, so the field is never under the keyboard
  $effect(() => {
    if (!pinned) { box = null; return; }
    const vv = window.visualViewport, root = document.documentElement.style;
    const place = () => {
      const c = (document.querySelector('.topbar') || document.body).getBoundingClientRect(), f = slot.getBoundingClientRect();
      const bars = [...document.querySelectorAll('.topbar, .netbar')].map((x) => x.getBoundingClientRect().bottom).filter((b) => b > 0);
      box = { top: Math.max(0, ...bars) + (vv?.offsetTop || 0), left: c.left, width: c.width, inset: f.left - c.left, field: f.width };
      // a list's own sticky header (the board's columns) sits under the band, not behind it
      requestAnimationFrame(() => band && root.setProperty('--search-pin-bottom', Math.round(band.getBoundingClientRect().bottom) + 'px'));
    };
    place();
    addEventListener('resize', place, { passive: true });
    vv?.addEventListener('resize', place); vv?.addEventListener('scroll', place);
    return () => { removeEventListener('resize', place); vv?.removeEventListener('resize', place); vv?.removeEventListener('scroll', place); root.removeProperty('--search-pin-bottom'); };
  });
</script>

<div class="field {cls}">
  <label class="label" class:sr-only={srLabel} for={id}>{label}</label>
  <div class="s-slot" bind:this={slot}>
    <div class="s-band" bind:this={band} class:pinned
      style={box ? `top:${box.top}px;left:${box.left}px;width:${box.width}px;padding-left:${box.inset}px;--pin-field:${box.field}px` : undefined}>
      <div class="search">
        <Icon name="search" size={18} />
        <input bind:this={el} {id} class="input" type="search" autocomplete="off" enterkeyhint="search" {placeholder} bind:value {...rest} />
        {#if value}<button type="button" class="iconbtn" aria-label="Clear the search" onclick={() => { value = ''; el?.focus({ preventScroll: true }); }}><Icon name="close" size={18} /></button>{/if}
      </div>
    </div>
  </div>
</div>

<style>
  @layer components {
    .search { position: relative; }
    .search > :global(svg) { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
    .search > .input { padding-left: 40px; padding-right: 44px; }
    .search > .input:placeholder-shown { padding-right: 12px; }   /* no clear button yet: the hint gets the room */
    .search > .input::-webkit-search-cancel-button { display: none; }
    .search > .iconbtn { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; color: var(--text-muted); }

    /* pinned: the slot keeps the field's height in the page; the band, under the bars, carries the field where it was */
    .s-slot { min-height: var(--ctl-h); }
    .s-band.pinned { position: fixed; top: var(--sticky-top); left: 0; width: 100%; z-index: var(--z-bar); box-sizing: border-box; padding: 6px 0 6px var(--gutter);
      background: var(--surface-floating); border-bottom: 1px solid var(--border); }
    .s-band.pinned > .search { width: var(--pin-field, calc(100% - var(--gutter))); }
  }
</style>
