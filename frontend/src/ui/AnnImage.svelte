<script>
  // A post's picture: its space is kept from the size the post carries (no jump), fetched when it scrolls near the
  // screen, tap to see it full size. With the phone's data saver on (lib/tier.js) it is fetched only when tapped.
  import { annImage } from '../lib/annimage.js';
  import { saveData } from '../lib/tier.js';
  import Icon from './Icon.svelte';
  import { backCloses } from './backclose.js';
  let { id, image, alt = '' } = $props();
  let el, full, release = null, src = $state(''), failed = $state(false), busy = $state(false);
  const onTap = saveData();
  function open() { if (full.open) return; full.showModal(); release = backCloses(full); }
  $effect(() => () => release?.());
  const fetchIt = () => { busy = true; annImage(id, image.v).then((u) => (src = u)).catch(() => (failed = true)).finally(() => (busy = false)); };
  $effect(() => {
    if (!image || !el || onTap) return;
    const io = new IntersectionObserver((es) => {
      if (!es.some((x) => x.isIntersecting)) return;
      io.disconnect();
      fetchIt();
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  });
</script>

{#if image}
  <button type="button" bind:this={el} class="annimg" style:aspect-ratio="{image.w} / {image.h}" aria-label={'Open the picture: ' + alt} onclick={() => (src ? open() : onTap && !busy && fetchIt())} disabled={!src && !(onTap && !busy)}>
    {#if src}<img {src} {alt} width={image.w} height={image.h} decoding="async" />
    {:else if failed}<span class="annimg-msg"><Icon name="offline" size={18} />Picture not loaded</span>
    {:else if onTap && !busy}<span class="annimg-msg"><Icon name="down" size={18} />Data saver on · tap to load the picture</span>
    {:else}<span class="sk sk-block annimg-sk" aria-hidden="true"></span>{/if}
  </button>
  <dialog bind:this={full} class="annimg-full" aria-label={alt} onclick={() => full.close()} onclose={() => { release?.(); release = null; }}>
    {#if src}<img {src} {alt} />{/if}
    <span class="sr-only">Tap anywhere to close</span>
  </dialog>
{/if}
