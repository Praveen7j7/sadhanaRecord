<script>
  // The first screen for a visitor who is not signed in (Phase 3, 8 Oct 2026): what the app is in one line, today's
  // darshan, Sign in / Create an account, the trust line, the verse of the day. Desktop: split screen, the darshan panel
  // (with the verse) on the left, the welcome on the right. Phones (9 Oct 2026, the head: "the image isn't complete, the
  // sloka comes at the bottom"): the same idea in one column — a compact lockup, the painting as a 4:5 hero framed on
  // its focal point with the verse on a panel at its foot, then the title and the two buttons, all on the first screen.
  // The paintings turn every 9 s, like the quotes (Darshan rotate).
  import { todayIST } from '../lib/dates.js';
  import '../styles/auth.css';
  import Icon from '../ui/Icon.svelte';
  import Darshan from '../ui/Darshan.svelte';
  // the same 1024 px switch the stylesheet uses (auth.css), as a live flag: see the panels below
  import { wide } from '../lib/wide.svelte.js';
  // the verse of the day: its list loads just after the screen (kept out of the first load), behind the splash
  let q = $state(null);
  import('../lib/quotes.js').then((m) => (q = m.QUOTES[m.shortQuoteIndex(todayIST())])).catch(() => {});
</script>

{#snippet verse(cls)}
  <figure class="wl-quote {cls}" class:wl-wait={!q}>
    {#if q}<blockquote>&ldquo;{q[0]}&rdquo;</blockquote>
    <figcaption><cite>{q[1]}</cite></figcaption>{/if}
  </figure>
{/snippet}

<div class="auth welcome wl-split" data-area="public">
  <!-- desktop: the paintings, the verse on its panel -->
  <!-- ONE painting panel is rendered, never two (22 Oct 2026). Both used to be in the page and CSS hid one, but the
       phone hero is `eager`, and an eager image downloads even inside a hidden box: a desktop fetched the phone's
       painting it never showed, beside its own. Now the panel that is not shown does not exist. The desktop panel
       is the desktop's largest paint, so it is eager too (it was lazy, with low priority). -->
  {#if wide.on}<div class="wl-side"><Darshan variant="panel" pool="flagship" sizes="50vw" eager rotate captionReady={!!q}>{@render verse('wl-in-panel')}</Darshan></div>{/if}
  <main class="auth-in" id="main">
    <!-- phones: the compact lockup, then the painting with the verse -->
    <div class="lockup lockup-sm wl-mlock" aria-label="IYF Delhi, ISKCON Youth Forum">
      <img class="lk-emblem" src="/brand/iyf-emblem-128.webp" srcset="/brand/iyf-emblem-64.webp 64w, /brand/iyf-emblem-128.webp 128w" sizes="40px" width="40" height="40" alt="" decoding="async" />
      <span class="lk-rule" aria-hidden="true"></span>
      <span class="lk-text"><span class="lk-org">IYF Delhi</span><span class="lk-sub">ISKCON Youth Forum</span></span>
    </div>
    <!-- sizes = the hero's MEASURED width (22 Oct 2026): the viewport less the two 16 px gutters, up to 420 px.
         "100vw" overstated it, so a 2.6x phone asked for 1,024 px and fetched the 1440 file (152 KB) where the
         960 (73 KB) is the true fit. Measured: 320 → 288, 390 → 358, 430 → 398, 600+ → 420. -->
    {#if !wide.on}<div class="wl-hero"><Darshan variant="hero" pool="flagship" sizes="(min-width: 452px) 420px, calc(100vw - 32px)" eager rotate captionReady={!!q}>{@render verse('wl-in-panel')}</Darshan></div>{/if}
    <header class="auth-brand">
      <div class="lockup wl-dlock" aria-label="IYF Delhi, ISKCON Youth Forum">
        <img class="lk-emblem" src="/brand/iyf-emblem-256.webp" srcset="/brand/iyf-emblem-64.webp 64w, /brand/iyf-emblem-128.webp 128w, /brand/iyf-emblem-256.webp 256w, /brand/iyf-emblem-512.webp 512w" sizes="56px" width="56" height="56" alt="" decoding="async" />
        <span class="lk-rule" aria-hidden="true"></span>
        <span class="lk-text"><span class="lk-org">IYF Delhi</span><span class="lk-sub">ISKCON Youth Forum</span></span>
      </div>
      <h1>Sādhana Record</h1>
      <!-- the byline: one line (the head, 9 Oct 2026) -->
      <p class="by-tag">Every Day, A Step Closer to Kṛṣṇa.</p>
    </header>
    <div class="grid gap-2">
      <a class="btn btn-primary" href="#/login">Sign in</a>
      <a class="btn btn-block" href="#/signup"><Icon name="plus" size={18} />Create an account</a>
    </div>
    <!-- the two lines under Create an account, on every signed-out screen (the head, 22 Oct 2026) -->
    <p class="auth-foot">New accounts require coordinator approval.</p>
    <p class="wl-trust"><Icon name="lock" size={14} />Your details stay private. · <a class="link" href="/privacy.html">Privacy</a></p>
  </main>
</div>
