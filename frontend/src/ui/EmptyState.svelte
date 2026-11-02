<script>
  // Nothing to show yet: an icon, what it means, and what to do next (optional action snippet).
  import Icon from './Icon.svelte';
  let { icon = 'info', title = '', tag = 'div', children, action, class: cls = '', darshan = false } = $props();
  /* C9 (22 Oct 2026, D-6): on a devotee's welcoming "nothing yet" state, today's painting sits in the gold-ringed halo
     instead of the icon. Opt-in, never on a refusal or a missed week. Sized for 56 px, so the phone takes the smallest
     file; the icon stays while it loads, if it fails, and wherever paintings are off (Low tier, Save-Data). */
  let pic = $state(null);
  $effect(() => {
    if (!darshan) return;
    import('../lib/darshan.js').then(async (d) => {
      if (!d.showImages()) return;
      const img = d.pick(await d.loadDarshan(), 'everyday');
      if (img) pic = { set: d.srcset(img), src: d.jpeg(img) };
    }).catch(() => {});
  });
  let failed = $state(false);
</script>

<svelte:element this={tag} class="empty {cls}">
  <span class="e-ico" class:e-pic={pic && !failed} aria-hidden="true">{#if pic && !failed}<img srcset={pic.set} sizes="56px" src={pic.src} alt="" loading="lazy" decoding="async" onerror={() => (failed = true)} />{:else}<Icon name={icon} size={24} />{/if}</span>
  {#if title}<p class="e-title">{title}</p>{/if}
  {#if children}<p>{@render children()}</p>{/if}
  {@render action?.()}
</svelte:element>

<style>
  @layer components {
    /* empty state: an icon in an area-tinted halo with a thin gold ring, a title naming what is missing, why, and an action */
    .empty { display: grid; justify-items: center; gap: 6px; padding: var(--sp-7) var(--sp-4); text-align: center; color: var(--text-muted); font-size: var(--fs-sm); list-style: none; }
    .empty .e-ico { display: grid; place-items: center; width: 56px; height: 56px; margin-bottom: 8px; border-radius: 50%; background: var(--accent-soft); color: var(--accent);
      box-shadow: 0 0 0 1px var(--gold-decorative), 0 0 0 7px var(--halo); }
    .empty .e-pic { overflow: hidden; background: var(--surface-muted); }
    .empty .e-pic img { width: 100%; height: 100%; object-fit: cover; }
    .empty .e-title { margin: 0; color: var(--text); font-weight: 650; font-size: var(--fs-h3); line-height: var(--lh-h3); text-wrap: balance; }
    .empty p { margin: 0; max-width: 36ch; }
    .empty :global(.btn) { margin-top: 10px; }
  }
</style>
