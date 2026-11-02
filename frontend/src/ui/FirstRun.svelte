<script>
  // The first-run guide (Phase 4, 9 Oct 2026): three short cards on Home until the devotee fills a first day or skips
  // them. Inline, never a dialog over the screen; loaded only while it shows. Skipping or finishing is kept on this phone.
  import Icon from './Icon.svelte';
  let { ondone } = $props();
  // titles only (22 Oct 2026, the head: no explanatory text on a screen) — each names what the screen under it does
  const CARDS = [
    { icon: 'edit', title: 'Fill each day' },
    { icon: 'check', title: 'Submit your week' },
    { icon: 'report', title: 'See your progress' },
  ];
  let i = $state(0);
  const c = $derived(CARDS[i]);
  function finish() { try { localStorage.setItem('sr.firstRun', '1'); } catch { /* storage blocked: it shows again next time */ } ondone?.(); }
</script>

<section class="cblock fr" aria-labelledby="fr-h" aria-roledescription="guide">
  <div class="fr-top">
    <p class="t-over acc m-0">Getting started · {i + 1} of {CARDS.length}</p>
    <button type="button" class="btn btn-text btn-sm" onclick={finish}>Skip</button>
  </div>
  <div class="fr-body" aria-live="polite">
    <span class="ichip" aria-hidden="true"><Icon name={c.icon} size={20} /></span>
    <div><h2 id="fr-h" class="fr-t">{c.title}</h2></div>
  </div>
  <div class="fr-foot">
    <span class="fr-dots" aria-hidden="true">{#each CARDS as _, k}<i class:on={k === i}></i>{/each}</span>
    {#if i > 0}<button type="button" class="btn btn-text" onclick={() => i--}>Back</button>{/if}
    {#if i < CARDS.length - 1}<button type="button" class="btn btn-primary" onclick={() => i++}>Next</button>
    {:else}<button type="button" class="btn btn-primary" onclick={finish}>Start</button>{/if}
  </div>
</section>

<style>
  .fr { border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
  .fr-top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); margin-top: -6px; }
  /* G12 (22 Oct 2026): titles only — the head's rule, no explanatory paragraphs; the screen under the guide explains itself */
  .fr-body { display: flex; gap: var(--sp-3); align-items: center; margin-top: var(--sp-2); }
  .fr-t { margin: 0 0 4px; font-size: 1.0625rem; font-weight: 650; }
  .fr-p { margin: 0; color: var(--text-muted); font-size: var(--fs-sm); text-wrap: pretty; }
  .fr-foot { display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-2); margin-top: var(--sp-3); }
  .fr-foot .btn { flex: none; width: auto; min-width: 6.5rem; }
  .fr-dots { display: flex; gap: 6px; margin-right: auto; }
  .fr-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--border); }
  .fr-dots i.on { width: 18px; border-radius: 4px; background: var(--accent); }
  @media (prefers-reduced-motion: no-preference) { .fr-dots i { transition: width var(--d-2) var(--ease); } }
</style>
