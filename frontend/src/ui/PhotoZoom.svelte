<script>
  // Tap a profile photo to see it large (as WhatsApp does; the head, 4 Oct 2026): a dark full-screen view, closed by a
  // tap anywhere, the close button, Esc or Back. The photo comes from the same store as the small one (no extra download).
  import { getPhoto } from '../lib/photos.js';
  import Icon from './Icon.svelte';
  import { backCloses } from './backclose.js';
  let { login, name = '', own = false, updatedAt = null, children } = $props();
  let dlg = $state(), src = $state(''), release = null;
  $effect(() => () => release?.());
  async function open() {
    if (dlg.open) return;
    dlg.showModal(); release = backCloses(dlg);
    try { src = await getPhoto(login, { own, updatedAt }); } catch { src = ''; }
  }
</script>

<button type="button" class="pz" aria-label={'View the photo of ' + (name || 'this person')} onclick={open}>{@render children?.()}</button>
<dialog bind:this={dlg} class="pz-dlg" aria-label={'Photo of ' + (name || 'this person')} onclick={() => dlg.close()} onclose={() => { release?.(); release = null; }}>
  {#if src}<img {src} alt={'Photo of ' + (name || 'this person')} />{:else}<span class="spin" aria-hidden="true"></span>{/if}
  {#if name}<p class="pz-name">{name}</p>{/if}
  <button type="button" class="pz-x" aria-label="Close" onclick={() => dlg.close()}><Icon name="close" size={24} /></button>
</dialog>

<style>
  .pz { padding: 0; border: 0; background: none; border-radius: 50%; cursor: zoom-in; line-height: 0; }
  .pz:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
  .pz-dlg { width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: rgba(0, 0, 0, 0.92); display: none; place-items: center; align-content: center; gap: 14px; }
  .pz-dlg[open] { display: grid; }
  .pz-dlg::backdrop { background: rgba(0, 0, 0, 0.92); }
  .pz-dlg img { max-width: min(92vw, 560px); max-height: 74dvh; width: auto; height: auto; border-radius: 14px; object-fit: contain; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); }
  .pz-name { margin: 0; color: #fff; font-weight: 600; text-align: center; }
  .pz-x { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 12px); right: 12px; display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.14); color: #fff; cursor: pointer; }
</style>
