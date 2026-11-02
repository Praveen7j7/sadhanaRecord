<script>
  // Quotes from Śrīla Prabhupāda's books as a calm "status" stream (the head, 3 Oct 2026). Each phone goes through all
  // the quotes in its own shuffled order, and every open starts at one not shown yet (quotes.js › openDeck):
  //   · no count is shown (never "12 / 46"): at most five dots that slide along, the current one in the middle
  //   · a thin line fills over the 9 s each quote is shown, like a WhatsApp status
  //   · it holds still while pressed (touch and hold), under the mouse, or with keyboard focus, and goes on when let go
//     (9 Oct 2026, the head: no pause button on the verse); swipe, ← → or the arrows to move; Enter keeps it still
  //   · moves with a short slide in the direction of travel; stops off screen or with the app hidden
  // Reduced motion or data saver: no autoplay, no slide. All quotes share one grid cell, so the box never changes height —
  // unless `fit` (Phase 24, V17: sized to the longest of 78 it left 120–200 px of blank under a short one): where the
  // block is last on the page, it is as tall as the quote on screen, and nothing below it can move.
  import { QUOTES, openDeck, seen } from '../lib/quotes.js';
  import { wrap, swipeDir, countdown, categoryOf, readMs, dotWindow } from '../lib/carousel.js';
  import { quietFor, changed } from '../lib/pace.js';
  import Icon from './Icon.svelte';
  import { saveData } from '../lib/tier.js';

  let { fit = false } = $props();
  const N = QUOTES.length;
  // reduced motion, or the phone's data saver: no autoplay and no slide (arrows and swipe still turn the quote)
  const reduce = (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || saveData();
  const deck = openDeck(N);
  const SLIDES = deck.order.map((i) => QUOTES[i]);
  let idx = $state(deck.at);                             // place in this phone's order
  let dir = $state(1);                                   // +1 forward, -1 back: the slide's direction
  let frozen = $state(reduce);                           // reduced motion, or Enter from the keyboard: stays until Enter again
  let holding = $state(false), focused = $state(false), hovered = $state(false), inView = $state(true);
  let shown = $state(typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const running = $derived(!frozen && !holding && !focused && !hovered && inView && shown);
  // each verse stays for its own reading time; it waits if a painting nearby changed in the last 4 s (Phase 9)
  const timer = countdown(readMs(SLIDES[deck.at]?.[0]), () => { const w = quietFor(); if (w) setTimeout(() => running && go(1), w); else go(1); });
  const dur = $derived(readMs(SLIDES[idx]?.[0]));
  let runId = $state(0);                                 // restarts the status line's animation for each quote
  const go = (d) => { dir = d >= 0 ? 1 : -1; idx = wrap(idx + d, N); if (d > 0) seen(deck, idx); changed(); };
  let el, lastIdx = -1, sx = 0, sy = 0, downAt = 0, holdT = null, moved = false;

  $effect(() => {
    const i = idx, r = running;
    if (i !== lastIdx) { if (lastIdx < 0) seen(deck, i); lastIdx = i; timer.reset(readMs(SLIDES[i]?.[0])); runId++; }
    if (r) timer.run(); else timer.pause();
  });
  $effect(() => {
    const vis = () => (shown = document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', vis);
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => (inView = es[es.length - 1].isIntersecting)) : null;
    io?.observe(el);
    return () => { document.removeEventListener('visibilitychange', vis); io?.disconnect(); timer.reset(); clearTimeout(holdT); };
  });

  // on the quote: pressing holds it still until the finger lifts; a swipe moves
  function down(e) {
    if (e.button > 0) return;
    sx = e.clientX; sy = e.clientY; downAt = Date.now(); moved = false;
    holding = true;
  }
  function up(e) {
    clearTimeout(holdT);
    holding = false;
    const d = swipeDir(e.clientX - sx, e.clientY - sy);
    if (d) go(d);
  }
  function cancel() { clearTimeout(holdT); holding = false; }
  function key(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(e.key === 'ArrowLeft' ? -1 : 1); }
    else if (e.key === ' ' || e.key === 'Enter') { if (e.target === e.currentTarget) { e.preventDefault(); frozen = !frozen; } }
  }
  const dots = $derived(dotWindow(idx, N, 5));
</script>

<section class="qc" class:still={reduce} class:fit bind:this={el} aria-roledescription="carousel" aria-label="Quotes from Śrīla Prabhupāda's books" data-paused={running ? undefined : ''}
  onfocusin={() => (focused = true)} onfocusout={(e) => { if (!el.contains(e.relatedTarget)) focused = false; }}>
  <div class="qc-status" aria-hidden="true">{#key runId}<i class:run={running} style:animation-duration="{dur}ms"></i>{/key}</div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="qc-track" tabindex="0" role="group" aria-label={frozen ? 'Quote, held still. Press Enter to go on' : 'Quote. It holds still while focused; press Enter to keep it'} aria-live={running ? 'off' : 'polite'}
    onpointerdown={down} onpointerup={up} onpointercancel={cancel} onpointerleave={cancel} onpointerenter={(e) => { if (e.pointerType === 'mouse') hovered = true; }} onmouseleave={() => (hovered = false)} onpointermove={(e) => { if (Math.abs(e.clientX - sx) > 8) moved = true; }} onkeydown={key}>
    {#each SLIDES as [text, ref], i}
      <figure class="qc-slide" class:qc-mid={text.length > 170 && text.length <= 240} class:qc-long={text.length > 240} role="group" aria-roledescription="slide"
        data-on={i === idx ? '' : undefined} data-dir={dir > 0 ? 'next' : 'prev'}>
        <p class="qc-cat t-over" aria-hidden="true">{categoryOf(ref)}</p>
        <blockquote>&ldquo;{text}&rdquo;</blockquote>
        <figcaption><cite>{ref}</cite></figcaption>
      </figure>
    {/each}
  </div>
  <div class="qc-foot">
    <p class="qc-by m-0">Śrīla Prabhupāda's translation</p>
    <div class="qc-dots" aria-hidden="true">{#each dots as d (d.i)}<i data-s={d.size}></i>{/each}</div>
    <div class="qc-ctl">
      <button type="button" class="glass" aria-label="Previous quote" onclick={() => go(-1)}><Icon name="back" size={18} /></button>
      <button type="button" class="glass" aria-label="Next quote" onclick={() => go(1)}><Icon name="next" size={18} /></button>
    </div>
  </div>
</section>

<style>
  @layer components {
    /* devotional block: a parchment tint (gold 9 % over the raised surface), a gold rule, serif verse, the source as a gold overline.
       Every slide sits in the same grid cell: the box is as tall as the longest quote and never jumps — or, with .fit, the
       quote on screen sets the height and the others lie over it, out of the flow, while they fade (V17). */
    .qc { position: relative; margin: 0 0 var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-4); border-radius: 0 var(--r-lg) var(--r-lg) 0; border-left: 3px solid var(--gold-decorative); touch-action: pan-y; container-type: inline-size;
      background: color-mix(in srgb, var(--gold-decorative) 9%, var(--surface-elevated)); }
    /* the night: a little gold over the raised surface, so it stays in the navy family instead of a warm brown (V35) */
    :global(:root[data-theme='dark']) .qc { background: color-mix(in srgb, var(--gold-decorative) 5%, var(--surface-elevated)); }
    @supports not (color: color-mix(in srgb, red 50%, blue)) { .qc { background: var(--surface-elevated); } }
    @media (min-width: 640px) { .qc { padding: var(--sp-6) var(--sp-6) var(--sp-4); } }
    @media (max-width: 399px) { .qc { padding: var(--sp-4) var(--sp-4) var(--sp-3); } .qc-status { left: var(--sp-4); right: var(--sp-4); } }
    .qc-track { position: relative; display: grid; cursor: pointer; border-radius: var(--r-sm); outline-offset: 6px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    .qc-slide { grid-area: 1 / 1; margin: 0; display: flex; flex-direction: column; gap: var(--sp-3); opacity: 0; visibility: hidden;
      transition: opacity var(--d-quote) ease, visibility 0s linear var(--d-quote); }
    .qc-slide[data-on] { opacity: 1; visibility: visible; transition: opacity var(--d-quote) ease; }
    .qc.fit .qc-track { overflow: clip; overflow-clip-margin: 6px; }
    .qc.fit .qc-slide:not([data-on]) { position: absolute; inset: 0 0 auto 0; }
    .qc-cat { color: var(--gold-text); margin: 0; }                 /* the quote starts right under its label; spare room for shorter quotes falls below */
    .qc-slide blockquote { position: relative; margin: 0; padding-left: 2px; font-family: var(--font-serif); font-size: var(--fs-quote); line-height: var(--lh-quote); font-weight: 400; text-wrap: pretty; hanging-punctuation: first; }
    .qc-slide figcaption { display: flex; align-items: center; gap: 10px; margin-bottom: auto; font-size: var(--fs-sm); color: var(--text-muted); }
    .qc-slide figcaption::before { content: ''; width: 24px; height: 1px; background: var(--gold-decorative); flex: none; }
    .qc-slide cite { font-style: normal; font-weight: 550; }
    /* longer verses a little smaller, so the card (as tall as its tallest slide, for zero layout shift) stays compact */
    .qc-mid blockquote { font-size: calc(var(--fs-quote) * .95); }
    .qc-long blockquote { font-size: calc(var(--fs-quote) * .9); }
    .qc-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px 12px; margin-top: var(--sp-4); }
    .qc-by { grid-column: 1 / -1; grid-row: 2; font-family: var(--font-serif); font-size: var(--fs-caption); font-style: italic; color: var(--text-muted); }
    /* one row once the card itself is wide enough (a phone, or Home's narrower side column, keeps two) */
    @container (min-width: 460px) { .qc-foot { grid-template-columns: auto minmax(0, 1fr) auto; } .qc-by { grid-column: 1; grid-row: 1; } }
    /* a status line for the quote on screen (fills over its 9 s; holds while paused), five sliding dots, a "Paused" chip */
    .qc-status { position: absolute; top: 0; left: var(--sp-5); right: var(--sp-5); height: 2px; border-radius: 2px; background: color-mix(in srgb, var(--gold-decorative) 22%, transparent); overflow: hidden; }
    .qc-status i { position: absolute; inset: 0 auto 0 0; width: 100%; border-radius: inherit; background: var(--gold-decorative); transform: scaleX(0); transform-origin: left; animation: qc-fill linear forwards paused; }
    .qc-status i.run { animation-play-state: running; }
    @keyframes qc-fill { to { transform: scaleX(1); } }
    .qc-dots { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 64px; }
    .qc-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-muted); opacity: .55; transition: transform var(--d-2) var(--ease), opacity var(--d-2) var(--ease), background-color var(--d-2) var(--ease); }
    .qc-dots i[data-s='on'] { background: var(--accent); opacity: 1; transform: scale(1.35); }
    .qc-dots i[data-s='sm'] { transform: scale(.6); opacity: .35; }
    .qc:not(.still) .qc-slide[data-on][data-dir='next'] { animation: qc-in-next 420ms var(--ease); }
    .qc:not(.still) .qc-slide[data-on][data-dir='prev'] { animation: qc-in-prev 420ms var(--ease); }
    @keyframes qc-in-next { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
    @keyframes qc-in-prev { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
    .qc-ctl { display: flex; align-items: center; gap: 2px; }
    .qc-ctl button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border-radius: var(--r-full); color: var(--text); cursor: pointer; }
    .qc-ctl button:active { transform: scale(0.94); }
  }
</style>
