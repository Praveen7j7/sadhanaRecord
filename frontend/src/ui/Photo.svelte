<script>
  // A round profile photo, fetched only once it is on screen; the name's initial until then (or when there is none).
  import { getPhoto, peekPhoto } from '../lib/photos.js';
  let { login, name = '', hasPhoto = false, own = false, updatedAt = null, size = 96 } = $props();
  let src = $state('');
  let el;
  const initial = $derived((name || '?').trim().charAt(0).toUpperCase());

  $effect(() => {
    src = '';
    if (!hasPhoto || !login || !el) return;
    let gone = false;
    const show = () => {
      if (!own) peekPhoto(login).then((s) => { if (!gone && s && !src) src = s; });
      getPhoto(login, { own, updatedAt }).then((s) => { if (!gone) src = s; }).catch(() => {});
    };
    if (typeof IntersectionObserver === 'undefined') { show(); return () => (gone = true); }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); show(); } });
    io.observe(el);
    return () => { gone = true; io.disconnect(); };
  });
</script>

<span class="photo" bind:this={el} style:width={size + 'px'} style:height={size + 'px'} style:font-size={Math.round(size / 2.4) + 'px'}>
  {#if src}<img {src} alt={name ? 'Photo of ' + name : 'Photo'} width={size} height={size} />{:else}<span aria-hidden="true">{initial}</span>{/if}
</span>
