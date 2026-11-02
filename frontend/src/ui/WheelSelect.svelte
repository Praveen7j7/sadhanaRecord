<script>
  // A choice from a list, picked on a 3D wheel (the head, 4 Oct 2026). Looks like a field showing the choice; a tap
  // opens a bottom sheet with the wheel; Done keeps the choice, Cancel (or Esc / Back) leaves it as it was.
  // A drop-in for a select: id, label, value (bindable), options [[value, text]] or strings, placeholder, onchange,
  // error, hint, circular, disabled, srLabel (label for screen readers only), class.
  import Wheel from './Wheel.svelte';
  import Icon from './Icon.svelte';
  import ValidationMessage from './ValidationMessage.svelte';
  import Sheet from './Sheet.svelte';
  let { id, label, value = $bindable(''), options = [], placeholder = 'Choose', onchange = null, error = '', hint = '', circular = false, disabled = false, srLabel = false, class: cls = '' } = $props();
  const list = $derived(options.map((o) => (Array.isArray(o) ? o : [o, String(o)])));
  const text = $derived(list.find(([v]) => v === value)?.[1] || '');
  let dlg = $state(), temp = $state(null);
  function open() {
    if (disabled || !list.length) return;
    temp = list.some(([v]) => v === value) ? value : list.find(([v]) => v !== '')?.[0] ?? list[0][0];
    dlg.showModal();
    document.getElementById(id + '-t')?.focus();          // not the Cancel button: the title, then Tab to the wheel
  }
  // Done, and a deliberate tap on a row (9 Oct 2026, Phase 9), take the same path: commit once, then close.
  // `closing` guards the double call (a tap commits, the close event must not commit again).
  let closing = false;
  function commit(v) {
    if (closing) return;
    closing = true;
    dlg.close();
    if (v !== value) { value = v; onchange?.(v); }
    closing = false;
  }
  function done() { commit(temp); }
  // Cancel, Escape and Back close without committing: `temp` is dropped and the saved value stays.
</script>

<div class="field wsel-field {cls}">
  <label class="label" class:sr-only={srLabel} for={id}>{label}</label>
  <button {id} type="button" class="input wsel" class:wsel-none={!text} aria-haspopup="dialog" class:wsel-bad={!!error} {disabled}
    aria-describedby={error ? id + '-e' : hint ? id + '-h' : undefined} onclick={open}>
    <span class="truncate">{text || placeholder}</span><Icon name="down" size={18} />
  </button>
  {#if hint && !error}<p class="hint" id={id + '-h'}>{hint}</p>{/if}
  <ValidationMessage id={id + '-e'} {error} />

<Sheet bind:this={dlg} class="wsel-sheet" titleId={id + '-t'}>
  {#snippet head()}
    <div class="sheet-head">
      <button type="button" class="btn btn-text btn-sm" onclick={() => dlg.close()}>Cancel</button>
      <h2 id={id + '-t'} class="wsel-t" tabindex="-1">{label}</h2>
      <button type="button" class="btn btn-text btn-sm font-bold" onclick={done}>Done</button>
    </div>
  {/snippet}
  {#if temp !== null}<Wheel options={list} value={temp} onchange={(v) => (temp = v)} oncommit={commit} {circular} label={label} />{/if}
</Sheet>
</div>

<style>
  .wsel-field { min-width: 0; }                  /* in a grid or a row it shrinks like a select, never pushes its neighbour out */
  .wsel { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; text-align: left; cursor: pointer; font: inherit; color: var(--text); }
  .wsel.wsel-bad { border-color: var(--danger); }
  .wsel.wsel-none { color: var(--text-muted); }
  .wsel :global(svg) { flex: none; color: var(--text-muted); }
  .wsel-t { margin: 0; font-size: 1.0625rem; text-align: center; flex: 1; }
  .wsel-t:focus { outline: none; }
  :global(.wsel-sheet) .sheet-head { align-items: center; }
  :global(.wsel-sheet .wheel) { margin-bottom: max(12px, env(safe-area-inset-bottom)); }
</style>
