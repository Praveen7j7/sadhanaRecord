<script>
  // The one dialog of the app: a bottom sheet on phones, a centred dialog from 600 px (both from the .sheet styles, so
  // the tier materials and reduced motion apply). A native <dialog>, so Escape / Back, the focus trap and the top
  // layer come with it. Adds what every sheet repeated: the title (and an optional line under it) with a close button,
  // tap outside to close, and focus back on what opened it. bind:this and call showModal() / close().
  // titleId names the heading (aria-labelledby). head: a snippet replacing the standard head (e.g. Cancel · title · Done).
  // closeButton={false}: no ✕ (a choice must be made; Escape still closes). dismiss={false}: a tap outside does nothing
  // (long forms, where a stray tap would lose typing). No data or decisions here: the caller owns both.
  // The phone's Back closes it (ui/backclose.js). back={false} only for a sheet opened from a leave guard.
  // escapeCloses={false}: Escape does nothing either, for the ONE case where closing destroys something that
  // cannot be recovered — the once-shown reset password (decision 46). Use it with dismiss={false} and
  // closeButton={false}, and give the sheet its own explicit button, or there is no way out at all.
  import '../styles/sheet.css';
  import IconButton from './IconButton.svelte';
  import { backCloses } from './backclose.js';
  let { titleId, title = '', sub = '', wide = false, dismiss = true, closeButton = true, back = true, escapeCloses = true, onclose, head, class: cls = '', children, ...rest } = $props();
  let dlg = $state(), opener = null, downOutside = false, release = null;
  $effect(() => () => { release?.(); release = null; });   // the screen left with the sheet open

  export function showModal() {
    if (dlg.open) return;
    opener = document.activeElement; dlg.showModal();
    if (back && escapeCloses) release = backCloses(dlg);     // no Back entry either when Escape is refused
  }
  // a native <dialog> fires `cancel` for Escape; preventing it is the only way to refuse that one route out
  function cancel(e) { if (!escapeCloses) e.preventDefault(); }
  export function close(v) { dlg?.close(v); }
  export const isOpen = () => !!dlg?.open;

  const outside = (e) => { const r = dlg.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
  // only a tap that starts and ends on the backdrop closes: a drag out of a text field or a wheel never does
  function down(e) { downOutside = e.target === dlg && outside(e); }
  function click(e) { if (dismiss && downOutside && e.target === dlg && outside(e)) dlg.close(); downOutside = false; }
  function closed(e) {
    // the screen may be leaving with the sheet open: then the dialog is already gone (dlg null) and focus stays put
    if (dlg && opener?.isConnected && (document.activeElement === document.body || dlg.contains(document.activeElement))) opener.focus();
    opener = null;
    onclose?.(e);
    release?.(); release = null;           // after onclose: a navigation there has already taken the Back entry's place
  }
</script>

<dialog bind:this={dlg} class="sheet {cls}" class:wide aria-labelledby={titleId} onpointerdown={down} onclick={click} oncancel={cancel} onclose={closed} {...rest}>
  {#if head}{@render head()}
  {:else if title}
    <div class="sheet-head">
      <div class="min-w-0"><h2 id={titleId}>{title}</h2>{#if sub}<p class="m-0 text-sm text-muted">{sub}</p>{/if}</div>
      {#if closeButton}<IconButton icon="close" label="Close" onclick={() => dlg.close()} />{/if}
    </div>
  {/if}
  {@render children?.()}
</dialog>
