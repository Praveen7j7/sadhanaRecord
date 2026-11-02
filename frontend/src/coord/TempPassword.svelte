<script>
  /*
   * The temporary password, shown ONCE — decision 46 (the head, 14 Oct 2026).
   *
   * The server generated this password at approval and kept only its hash. It exists in readable form in
   * that one response and nowhere else: there is no action that can read it back, by the head's explicit
   * decision. A coordinator who loses it asks the devotee to send a fresh request.
   *
   * So this dialog cannot be closed by accident. No tap outside, no Escape, no ✕ — an accidental tap would
   * cost the devotee a second round trip. The only way out is the button that says the password has been
   * handed over.
   *
   * It is never sent anywhere from here. The WhatsApp link opens the coordinator's OWN WhatsApp with the
   * message prepared, which they then choose to send; the app itself messages nobody (decision 15).
   */
  import Sheet from '../ui/Sheet.svelte';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../lib/pro.svelte.js';

  let { info = null, onclose } = $props();
  let sheet = $state();
  let copied = $state(false);

  export function show() { copied = false; sheet?.showModal(); }

  const first = $derived(String(info?.name || '').trim().split(/\s+/)[0] || 'them');
  // the coordinator's own WhatsApp, with the words ready; they send it, not the app
  const waText = $derived(
    `Hare Krishna ${first}. Your Sadhana app password has been reset.\n\n` +
    `Temporary password: ${info?.tempPassword || ''}\n\n` +
    `Please log in with it and choose your own password straight away. It stops working in ` +
    `${info?.expiresInHours || 24} hours.`
  );
  const waHref = $derived(
    info?.whatsapp ? `https://wa.me/91${String(info.whatsapp).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(waText)}` : ''
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(info?.tempPassword || '');
      copied = true;
      toast('Password copied');
    } catch {
      // clipboard refused (an insecure context, or permission denied): the password is on screen to read out
      toast('Could not copy — read it out from the screen');
    }
  }

  function shared() {
    sheet?.close();
    onclose?.();
  }
</script>

<Sheet bind:this={sheet} titleId="tp-h" dismiss={false} closeButton={false} escapeCloses={false} back={false}>
  <div class="tp">
    <div class="tp-ic" aria-hidden="true"><Icon name="lock" /></div>
    <h2 id="tp-h" class="tp-h">Give this password to {info?.name || 'them'}</h2>
    <p class="tp-s">
      Read it out, or send it from your own WhatsApp. <b>It is shown only here, only now.</b>
      {#if info?.expiresInHours}It stops working in {info.expiresInHours} hours.{/if}
    </p>

    <div class="tp-pw" role="group" aria-label="Temporary password">
      <code class="tp-code">{info?.tempPassword || ''}</code>
      <button type="button" class="tp-copy" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>

    <p class="tp-note">
      {info?.name || 'They'} will have to choose their own password as soon as they log in.
    </p>

    <div class="tp-acts">
      {#if waHref}
        <a class="btn btn-outline" href={waHref} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
      {/if}
      <Button variant="primary" onclick={shared}>I have shared it</Button>
    </div>
    <p class="tp-last">
      Lost it before sharing? Ask {first} to tap “I forgot my password” again, then approve the new request.
    </p>
  </div>
</Sheet>

<style>
  .tp { display: grid; gap: var(--sp-3); text-align: center; padding-top: var(--sp-2); }
  .tp-ic { display: grid; place-items: center; width: 44px; height: 44px; margin: 0 auto; border-radius: 50%;
           background: var(--surface-2); color: var(--text-secondary); }
  .tp-h { margin: 0; font-size: var(--fs-lg); line-height: 1.3; text-wrap: balance; }
  .tp-s { margin: 0; color: var(--text-secondary); font-size: var(--fs-sm); line-height: 1.5; text-wrap: pretty; }
  .tp-pw { display: flex; align-items: stretch; gap: var(--sp-2); margin: var(--sp-2) 0; }
  /* the password is the one thing on this screen that must be read without mistakes */
  .tp-code { flex: 1; min-width: 0; padding: var(--sp-3) var(--sp-2); border-radius: var(--radius-md);
             background: var(--surface-2); border: 1px solid var(--border);
             font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
             font-size: clamp(1.05rem, 5vw, 1.4rem); letter-spacing: .06em; font-variant-ligatures: none;
             overflow-wrap: anywhere; user-select: all; }
  .tp-copy { flex: 0 0 auto; padding: 0 var(--sp-4); border-radius: var(--radius-md); border: 1px solid var(--border);
             background: var(--surface-1); color: var(--text-primary); font-size: var(--fs-sm); font-weight: 600;
             cursor: pointer; min-height: 44px; }
  .tp-copy:hover { background: var(--surface-2); }
  .tp-note { margin: 0; color: var(--text-secondary); font-size: var(--fs-sm); line-height: 1.5; }
  .tp-acts { display: grid; gap: var(--sp-2); margin-top: var(--sp-2); }
  .tp-last { margin: var(--sp-1) 0 0; color: var(--text-tertiary, var(--text-secondary)); font-size: var(--fs-xs); line-height: 1.5; }
  @media (min-width: 420px) { .tp-acts { grid-auto-flow: column; justify-content: center; } }
</style>
