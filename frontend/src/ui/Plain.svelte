<script>
  // Frame for logged-out screens (log in, sign up, forgot password): calm devotee-blue entry with the serif brand,
  // a short devotional line, then the form card (the verse of the day is on the welcome screen only). Safe areas respected; wide forms (sign-up) get a wider column.
  // back={null}: no back arrow (a required step, such as the forced password change).
  import '../styles/auth.css';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import Darshan from './Darshan.svelte';
  // side: a snippet for the desktop's darshan panel (Phase 3, 8 Oct 2026): sign-in and sign-up get today's painting on the
  // left with a short note; phones never load it
  // byline: the screen's own devotional line under the name (sign-in, create account); none elsewhere (9 Oct 2026)
  let { title, wide = false, back = '#/welcome', backLabel = 'Back to the welcome screen', children, foot, side, sideReady = true, byline = '' } = $props();
</script>

<div class="auth" class:wide class:auth-split={!!side} data-area="public">
  {#if side}<div class="auth-side"><Darshan variant="panel" pool="flagship" sizes="50vw" rotate captionReady={sideReady}>{@render side()}</Darshan></div>{/if}
  {#if back}<IconButton icon="back" href={back} label={backLabel} class="auth-back glass" />{/if}
  <main class="auth-in" id="main">
    <header class="auth-brand">
      <div class="lockup lockup-sm" aria-label="IYF Delhi, ISKCON Youth Forum">
        <img class="lk-emblem" src="/brand/iyf-emblem-128.webp" srcset="/brand/iyf-emblem-64.webp 64w, /brand/iyf-emblem-128.webp 128w, /brand/iyf-emblem-256.webp 256w, /brand/iyf-emblem-512.webp 512w" sizes="40px" width="40" height="40" alt="" decoding="async" />
        <span class="lk-rule" aria-hidden="true"></span>
        <span class="lk-text"><span class="lk-org">IYF Delhi</span><span class="lk-sub">ISKCON Youth Forum</span></span>
      </div>
      <h1>Sādhana Record</h1>
      {#if byline}<p class="byline">{byline}</p>{/if}
    </header>
    <section class="auth-card" aria-labelledby="auth-h">
      <h2 id="auth-h">{title}</h2>
      {@render children()}
    </section>
    {#if foot}<div class="auth-foot">{@render foot()}</div>{/if}
  </main>
</div>
