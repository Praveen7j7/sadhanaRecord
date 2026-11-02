<script>
  // Route tabs (Admin, Batch): role="tablist", arrow keys / Home / End move between tabs (roving tabindex),
  // Enter or Space opens one; the active tab has an accent underline.
  // items: [[path, label, badge?]]; current: the active path. The content goes in the tab panel (children).
  // A phone (Phase 24, V13 — the head, 28 Oct 2026): one row, never a sideways scroller cut at the edge ("Fillir…"). The
  // tabs that fit show, the current one always among them; "More" lists every tab out of sight. They all stay real tabs
  // in the one tablist, so the arrow keys still reach each of them (and bring it into the row). 600–1023 px: the row
  // wraps (below); from 1024 px the sidebar lists the same pages and there is no row.
  let { items, current, label, id = 'tabs', children } = $props();
  let list = $state();
  const active = $derived(Math.max(0, items.findIndex(([p]) => p === current)));
  let focusIdx = $state(-1);
  const roving = $derived(focusIdx < 0 ? active : focusIdx);
  $effect(() => { current; focusIdx = -1; moreOpen = false; });
  const phoneQ = typeof matchMedia === 'function' ? matchMedia('(max-width: 599px)') : null;
  let phone = $state(!!phoneQ?.matches);
  $effect(() => { if (!phoneQ) return; const f = () => (phone = phoneQ.matches); phoneQ.addEventListener('change', f); return () => phoneQ.removeEventListener('change', f); });
  // which tabs lie outside the row's visible part (left of it after a scroll, or past More on the right)
  let out = $state([]), moreOpen = $state(false), moreEl = $state(), shifted = $state(false);
  function edges() {
    shifted = !!list && phone && list.scrollLeft > 2;
    if (!list || !phone) { out = []; return; }
    const L = list.getBoundingClientRect(), cs = getComputedStyle(list), btn = moreEl?.querySelector('.tm-btn')?.getBoundingClientRect();
    // the visible part: from the left margin to where More begins (or the right margin while there is no More)
    const lo = L.left + parseFloat(cs.paddingLeft) - 1, hi = (btn?.width ? btn.left : L.right - parseFloat(cs.paddingRight)) + 1;
    out = [...list.querySelectorAll('[role=tab]')].map((t, i) => { const r = t.getBoundingClientRect(); return r.left < lo || r.right > hi ? i : -1; }).filter((i) => i >= 0);
  }
  const hasMore = $derived(phone && out.length > 0);
  // the current tab in sight (again once More takes its room at the end): from the start of the row when it fits there,
  // else the row starts AT it — whole tabs only, never a sliver of the one before it at the margin
  $effect(() => {
    active; phone; hasMore;
    const t = list?.querySelectorAll('[role=tab]')[active]; if (!t) return;
    const cs = getComputedStyle(list), room = list.clientWidth - parseFloat(cs.paddingRight);
    list.scrollLeft = t.offsetLeft + t.offsetWidth <= room ? 0 : t.offsetLeft - parseFloat(cs.paddingLeft);
    edges();
  });
  $effect(() => { if (!list) return; edges(); const ro = new ResizeObserver(edges); ro.observe(list); return () => ro.disconnect(); });
  // the menu closes on a choice, Escape, or a tap anywhere else
  $effect(() => {
    if (!moreOpen) return;
    const away = (e) => { if (!moreEl?.contains(e.target)) moreOpen = false; };
    const esc = (e) => { if (e.key === 'Escape') { moreOpen = false; moreEl?.querySelector('button')?.focus(); } };
    addEventListener('pointerdown', away, true); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', away, true); removeEventListener('keydown', esc); };
  });

  function key(e) {
    const tabs = [...list.querySelectorAll('[role=tab]')];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (e.key === ' ') { e.preventDefault(); tabs[i].click(); return; }
    if (j < 0) return;
    e.preventDefault();
    focusIdx = j;
    tabs[j].focus();
    tabs[j].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
</script>

<!-- More (phones): before the tablist, so the tablist and its panel stay side by side in the document; drawn over the
     row's right end -->
<div class="tm" bind:this={moreEl} hidden={!hasMore}>
  <button type="button" class="tm-btn" aria-haspopup="true" aria-expanded={moreOpen} aria-controls="{id}-more" onclick={() => (moreOpen = !moreOpen)}>More<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
  {#if moreOpen}
    <ul class="tm-menu" id="{id}-more" aria-label={label + ': more'}>
      {#each out as i (items[i][0])}<li><a class="tm-item" href={'#' + items[i][0]} aria-current={i === active ? 'page' : undefined} onclick={() => (moreOpen = false)}>{items[i][1]}{#if items[i][2]}<span class="pill" data-tone="accent">{items[i][2]}</span>{/if}</a></li>{/each}
    </ul>
  {/if}
</div>
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="tabbar" class:has-more={hasMore} class:shifted role="tablist" aria-label={label} bind:this={list} onkeydown={key} onscroll={edges}>
  {#each items as [path, text, badge], i (path)}
    <a class="tab" class:tab-out={out.includes(i)} role="tab" id="{id}-t{i}" href={'#' + path} aria-selected={i === active} aria-controls="{id}-p" tabindex={i === roving ? 0 : -1}>{text}{#if badge}<span class="pill" data-tone="accent">{badge}</span>{/if}</a>
  {/each}
</div>
<div role="tabpanel" id="{id}-p" aria-labelledby="{id}-t{active}">{@render children()}</div>

<style>
  @layer components {
    /* route tabs: one row on a phone, the active tab with an accent underline. The row does not scroll by hand: what does
       not fit is behind More (a tab reached by the keyboard is brought into the row) */
    .tabbar { position: relative; display: flex; gap: 4px; margin: 0 calc(var(--gutter) * -1) var(--sp-4); padding: 0 var(--gutter); overflow-x: hidden; scrollbar-width: none; border-bottom: 1px solid var(--border); scroll-padding: 0 var(--gutter); }
    .tabbar::-webkit-scrollbar { display: none; }
    .tabbar.has-more { padding-right: calc(var(--gutter) + 88px); }
    /* room after the last tab, so the row can always start exactly at the current tab — the last ones too */
    .tabbar.has-more::after { content: ''; flex: none; width: 60vw; }
    .tabbar.shifted { clip-path: inset(-2px 0 -2px var(--gutter)); }   /* tabs moved left of the row end at its margin, never half-shown at the screen edge */
    /* a tab out of sight is not drawn at all — half of one ran into More ("Batch setMore") — but stays focusable: the arrow
       keys bring it into the row, and it shows again there */
    .tab.tab-out { opacity: 0; pointer-events: none; }
    /* More: over the row's right end, to the screen edge, on the page colour so nothing shows through */
    .tm { position: relative; z-index: 3; height: 0; }
    .tm-btn { position: absolute; top: 0; right: calc(var(--gutter) * -1); display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 46px; padding: 0 var(--gutter) 0 14px;
      border: 0; background: linear-gradient(to right, transparent, var(--bg) 14px); color: var(--text-muted); font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
    .tm-btn[aria-expanded='true'] { color: var(--accent); }
    .tm-menu { position: absolute; top: 48px; right: 0; display: grid; min-width: 12rem; max-width: calc(100vw - 2 * var(--gutter)); margin: 0; padding: 6px; list-style: none;
      border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface-floating); box-shadow: var(--shadow-3); animation: rise var(--d-2) var(--ease); }
    .tm-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: var(--ctl-h); padding: 0 12px; border-radius: var(--r-md); color: var(--text); font-weight: 600; text-decoration: none; }
    @media (hover: hover) { .tm-item:hover { background: var(--surface-hover); } }
    .tab { position: relative; flex: none; display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 14px; color: var(--text-muted); font-weight: 600; font-size: 0.9375rem; text-decoration: none; white-space: nowrap;
      border-radius: var(--r-sm) var(--r-sm) 0 0; transition: color var(--d-1) var(--ease), background-color var(--d-1) var(--ease), scale var(--d-1) var(--ease); }
    @media (hover: hover) { .tab:hover { color: var(--text); background: var(--surface-hover); } }
    .tab::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 3px; border-radius: 3px 3px 0 0; background: var(--accent); transform: scaleX(0); transition: transform var(--d-2) var(--ease); }
    .tab[aria-selected='true'] { color: var(--accent); }
    .tab[aria-selected='true']::after { transform: scaleX(1); }
    .tab:focus-visible { outline-offset: -3px; }
    .tab .pill { font-size: 0.6875rem; }
    /* a tablet (600–1023 px): the tabs wrap onto a second row — every tab in sight, none cut at the edge ("…atus", the
       Admin strip's hidden half; Phase 24, V13). A phone has one row and More (above). */
    @media (min-width: 600px) and (max-width: 1023px) { .tabbar { flex-wrap: wrap; overflow: visible; row-gap: 0; } }
    /* desktop: the sidebar lists the same pages, so there is no tab row (8 Oct 2026) */
    @media (min-width: 1024px) { .tabbar { display: none; } }
    @media (max-width: 639px) { .tab { padding: 0 10px; font-size: 0.875rem; } .tabbar { gap: 0; } }
  }
</style>
