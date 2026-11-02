<script>
  // Today's darshan (8 Oct 2026): paintings chosen by the Indian date (lib/darshan.js), the same for everyone.
  //   variant 'hero'  (Welcome on phones, 9 Oct 2026): 4:5, at most ~60 % of the screen, the verse on a panel at its foot
  //   variant 'panel' (Welcome and sign-in on desktop): full height, the verse on a panel at its foot
  //   variant 'card'  (Home): 3:2 on phones, 4:5 on wide screens, its title under the picture (titled)
  // rotate (9 Oct 2026, the head: "the images should rotate like the quotes"): every 20 s the next painting fades in,
  // starting from today's; at most six are fetched a visit, then those six go round again (no more data). A pause
  // press-and-hold (or the mouse over it, or keyboard focus) holds it still; it goes on when let go (9 Oct 2026, the
  // head: no pause button on the picture). No rotation with reduced motion; no images at all on the Low tier or with Save-Data (the colour
  // panel and its words stay). Never on the critical path: lazy unless `eager`, sized up front, its dominant colour
  // shows until the first one fades in.
  import { loadDarshan, loadBlur, sequence, srcset, jpeg, showImages } from '../lib/darshan.js';
  import { quietFor, changed } from '../lib/pace.js';
  let { variant = 'band', pool = 'flagship', sizes = '100vw', eager = false, titled = false, rotate = false, captionReady = true, class: cls = '', children } = $props();   // captionReady: the words have arrived (no empty panel that then grows)
  const ROT_MS = 20000, MAX = 6;   // 20 s a painting, a 1.2 s cross-fade (the approved standard, 9 Oct 2026)
  // showImages() reads <html data-tier>, which tier.js sets ASYNCHRONOUSLY and keeps changing (connection,
  // battery, visibility, measured frames). Read once at mount it was often still 'low', so no painting was ever
  // fetched and the panel stayed on its navy fallback for good — the intermittent blue screen (11 Oct 2026).
  // Watched instead: the moment the tier settles above 'low', the paintings load.
  let on = $state(showImages());
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seq = $state([]), at = $state(0), layers = $state([]), fig = $state();
  let holding = $state(false), hovered = $state(false), focused = $state(false), kept = $state(false);
  const paused = $derived(holding || hovered || focused || kept);
  let asked = false;
  // The manifest is read even when the paintings are off (low battery, data saver): it is a few KB of JSON and
  // it carries each painting's `blur` — a 24 px thumbnail inlined as a data URI — and its dominant colour. The
  // panel can then still show a painting, softly, with NO image request at all (the user, 12 Oct 2026), instead
  // of the flat navy that looked like a broken screen.
  let still = $state(null);
  const begin = () => {
    if (asked) return;
    asked = true;
    loadDarshan().then(async (l) => {
      const s = sequence(l, pool);
      /* The placeholders live in their own file now (lib/darshan.js loadBlur). Fetch them for the few paintings
         this panel will actually draw — and WAIT for them when the paintings are off, because then the blur is
         the only thing shown and a flat navy panel looked like a broken screen (the user, 12 Oct 2026). */
      if (!on) { await loadBlur(s.slice(0, 1)); still = s[0] || null; return; }
      seq = s.slice(0, rotate && !reduce ? MAX : 1);
      if (seq[0]) layers = [layerOf(seq[0], 0)];
      loadBlur(seq).then(() => { if (!gone && layers[0]) layers = [...layers]; });   // redraw once they arrive
    });
  };
  begin();
  /* Timers that outlive the panel (19 Oct 2026). A painting's decode and an <img> onload both fire on their own
     clock, so their timers could run after the person had left the screen and write to a destroyed component's
     state — the same shape as the wheel picker's settle timer, which reached a devotee as a page error (phase 18).
     Every one is tracked and cleared on unmount, and each checks `gone` in case it was already in flight. */
  /** A layer, with the files it will use decided once (see the <img> below). */
  const layerOf = (img, k) => ({ img, k, in: false, set: srcset(img), src: jpeg(img) });
  let timers = [], gone = false;
  const track = (t) => { timers.push(t); return t; };
  $effect(() => () => { gone = true; for (const t of timers) clearTimeout(t); timers = []; });
  // the tier is an attribute on <html>: watch it rather than poll, and stop as soon as the paintings are on their way
  $effect(() => {
    if (asked || typeof MutationObserver !== 'function') return;
    const mo = new MutationObserver(() => {
      if (!showImages()) return;
      on = true; asked = false; still = null; begin(); mo.disconnect();   // the tier rose: load the real paintings
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tier'] });
    return () => mo.disconnect();
  });
  const img = $derived(layers.at(-1)?.img || null);
  const turns = $derived(rotate && !reduce && seq.length > 1);

  // the next painting: fetched and decoded first, then faded in over the one showing; the old layer then leaves
  function next() {
    const n = (at + 1) % seq.length, im = seq[n], pre = new Image();
    const L = layerOf(im, Date.now());                 // the same frozen set preloads and then paints: one fetch
    pre.sizes = sizes; pre.srcset = L.set; pre.src = L.src;
    (pre.decode ? pre.decode() : Promise.resolve()).then(() => track(setTimeout(() => { if (gone) return; at = n; changed(); layers = [...layers.slice(-1), L]; }, quietFor()))).catch(() => {});
  }
  // the first painting shows the moment it has loaded (no fade: it is the Welcome's largest paint); the next ones fade in
  const shown = (L) => { L.in = true; track(setTimeout(() => { if (!gone && layers.length > 1 && layers.at(-1) === L) layers = [L]; }, 1300)); };
  // A painting that does not arrive (it is fetched at runtime, never precached — vite.config.js) used to leave the
  // panel on its navy fallback for ever: `in` is set by onload alone, so a failed fetch never faded anything in.
  // Try the small webp once, then show the layer anyway: the dominant colour and the blur placeholder are already
  // on the figure, so the panel looks deliberate instead of empty. (11 Oct 2026)
  const failed = (L, el) => {
    if (!L.retried) {
      L.retried = true;
      el.removeAttribute('srcset'); el.removeAttribute('sizes');
      el.src = `/darshan/${L.img.id}-480.webp`;
      return;
    }
    L.in = true;                                   // give up on the file; the colour behind it stands in
  };
  $effect(() => {
    if (!turns || paused) return;
    // only while it is on screen: the hidden copy (Welcome has a phone one and a desktop one) fetches nothing
    const t = setInterval(() => { if (document.visibilityState === 'visible' && fig?.getClientRects().length) next(); }, ROT_MS);
    return () => clearInterval(t);
  });
</script>

<!-- images off (Low tier, Save-Data): the desktop panel stays as a plain navy panel with its words; elsewhere the words
     stay on a calm colour panel (hero) or nothing (card) -->
{#if on || variant === 'panel' || (variant === 'hero' && children)}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <figure bind:this={fig} class="darshan dv-{variant} {cls}" tabindex={turns ? 0 : undefined}
    aria-roledescription={turns ? 'carousel' : undefined} aria-description={turns ? (kept ? 'Held still. Press Enter to go on.' : 'The paintings change every few seconds; they hold still while this is focused. Press Enter to keep one.') : undefined}
    onpointerdown={(e) => { if (turns && e.button < 1) holding = true; }} onpointerup={() => (holding = false)} onpointercancel={() => (holding = false)}
    onpointerleave={() => { holding = false; hovered = false; }} onpointerenter={(e) => { if (e.pointerType === 'mouse') hovered = true; }}
    oncontextmenu={(e) => { if (turns) e.preventDefault(); }} onfocusin={() => (focused = true)} onfocusout={() => (focused = false)}
    onkeydown={(e) => { if (turns && (e.key === 'Enter' || e.key === ' ') && e.target === fig) { e.preventDefault(); kept = !kept; } }} class:dv-off={!on} style:background-color={(on ? img?.dominant : still?.dominant) || (on ? 'var(--surface-muted)' : 'var(--brand-navy)')} style:background-image={(on ? (layers[0]?.img?.blur && !layers[0]?.in ? layers[0].img.blur : null) : still?.blur) ? `url(${on ? layers[0].img.blur : still.blur})` : undefined} aria-label={img ? 'Darshan: ' + img.title : undefined}>
    {#each layers as L (L.k)}
      <!-- ONE fetch per painting (22 Oct 2026). The first painting used to load its 480 webp, then switch on the srcset
           50 ms after it loaded, so the browser fetched the 960 avif as well: two downloads of the Welcome's largest
           paint (Lighthouse: 42 KB + 50 KB, LCP 3.2 s). The blur placeholder now covers the wait, so the browser picks
           the right size once, at high priority. The set is frozen on the layer (layerOf): a redraw can never
           switch AVIF/WebP mid-load and fetch the painting a second time. -->
      <img srcset={L.set} {sizes} src={L.src} width={L.img.w} height={L.img.h} alt={'Darshan: ' + L.img.title + (L.img.pastime ? ' — ' + L.img.pastime : '')}
        loading={eager || L.k ? 'eager' : 'lazy'} fetchpriority={eager && !L.k ? 'high' : 'low'} decoding="async" style:object-position={L.img.focal}
        class:in={L.in} class:first={!L.k} onload={() => shown(L)} onerror={(e) => failed(L, e.currentTarget)} draggable="false" />
    {/each}
    {#if children && captionReady}<figcaption class="dp-text">{@render children()}</figcaption>{/if}
  </figure>
  <!-- just the painting's words (the head, 9 Oct 2026: no "Today's darshan" line): its title and what it shows -->
  {#if titled && img}<p class="dp-title">{img.title}</p>{#if img.pastime}<p class="dp-sub">{img.pastime}</p>{/if}{/if}
{/if}

<style>
  :where(.darshan) { position: relative; margin: 0; overflow: hidden; -webkit-touch-callout: none; touch-action: pan-y; background-size: cover; background-position: center; }   /* the blurred preview (Phase 9) under the first painting */
  /* Paintings off (low battery, data saver): a 24 px thumbnail is all there is, so it is drawn on a ::before
     layer and softened there. The filter must NOT sit on the figure itself — that blurs the verse and the
     caption with it, which is unreadable (seen on the first try, 12 Oct 2026). */
  /* A light blur only: at 24 px the thumbnail is already soft, and more than a touch loses the deity. The
     children keep their own positioning — adding `position: relative` to them moved the verse (12 Oct 2026). */
  .darshan.dv-off::before { content: ''; position: absolute; inset: -4%; z-index: 0; pointer-events: none;
    background: inherit; background-size: cover; background-position: center;
    filter: blur(1px) saturate(1.08) brightness(0.9); }
  .darshan:focus-visible { outline: 2px solid var(--focus, var(--accent)); outline-offset: 3px; }   /* :where: a page may give it its own margin */
  .darshan img { pointer-events: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 1200ms var(--ease); }
  .darshan img.in { opacity: 1; }
  .darshan img.first { transition: none; }
  @media (prefers-reduced-motion: reduce) { .darshan img { transition: none; } }
  .dv-band { height: 200px; border-radius: var(--r-xl); }
  .dv-hero { aspect-ratio: 4 / 5; width: 100%; max-height: min(54vh, 500px); border-radius: var(--r-xl); box-shadow: var(--shadow-2); }
  .dv-hero.dv-off { aspect-ratio: auto; min-height: 0; max-height: none; background: var(--surface-elevated) !important; box-shadow: none; }
  .dv-card { aspect-ratio: 3 / 2; border-radius: var(--r-xl) var(--r-xl) 0 0; }
  @media (min-width: 1024px) { .dv-card { aspect-ratio: 4 / 5; } }
  .dp-title { margin-top: var(--sp-3); margin-bottom: 0; font-family: var(--font-serif); font-size: 1.0625rem; font-weight: 600; }
  .dp-sub { margin-top: 2px; margin-bottom: var(--sp-2); color: var(--text-secondary); font-size: var(--fs-sm); }   /* (no margin-inline: the card sets it) */
  .dv-panel { height: 100%; min-height: 100vh; }
  /* the full-height panel crops the painting's lower corners a little, where an artist's signature or a watermark sat
     beside the words' card (Phase 24, V36): 8 % larger from the top centre, so the faces are never cut */
  .dv-panel img { scale: 1.08; transform-origin: 50% 0; }
  /* the words over the painting sit on their own readable panel, never on the picture itself */
  .dp-text { position: absolute; z-index: 1; left: 24px; right: 24px; bottom: 24px; padding: var(--sp-4) var(--sp-5); border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--surface-floating) 88%, transparent); color: var(--text); box-shadow: var(--shadow-2); }
  :global(:root[data-tier='high']) .dp-text { background: color-mix(in srgb, var(--surface-floating) 72%, transparent); -webkit-backdrop-filter: blur(12px) saturate(140%); backdrop-filter: blur(12px) saturate(140%); }
  .dv-band .dp-text, .dv-hero .dp-text { left: 10px; right: 10px; bottom: 10px; padding: var(--sp-3) var(--sp-4); }
  .dv-hero .dp-text :global(blockquote) { font-size: 0.9375rem; line-height: 1.45; }
  .dv-hero .dp-text :global(figcaption) { margin-top: 4px; font-size: var(--fs-caption); }
  .dv-hero.dv-off .dp-text { position: static; box-shadow: none; background: none; }
</style>
