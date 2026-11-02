<script>
  // Numeric text field with a numeric keypad. Calls onchange(number | null) only for valid values.
  import ValidationMessage from './ValidationMessage.svelte';
  // The −/+ minute buttons were removed on 9 Oct 2026 (Phase 9): the numeric keypad is fewer taps than
  // stepping 5 at a time, and they doubled the height of every duration field in the day form.
  let { id, label, value = null, max, min = 0, float = false, unit = '', onchange, serverError = '', hint = '', children } = $props();
  // svelte-ignore state_referenced_locally
  let raw = $state(value === null || value === undefined ? '' : String(value));
  let touched = $state(false);
  const n = $derived(raw.trim() === '' ? null : Number(raw));
  const bad = $derived(
    raw.trim() === '' ? '' :
    !Number.isFinite(n) ? 'Numbers only' :
    n < min || n > max ? `Between ${min} and ${max}` :
    float ? (Math.round(n * 2) !== n * 2 ? 'In half hours (0.5, 1, 1.5 …)' : '') :
    !Number.isInteger(n) ? 'Whole numbers only' : ''
  );
  function input(e) {
    raw = e.currentTarget.value;
    touched = true;
    if (raw.trim() === '') onchange(null);
    else if (!bad && Number.isFinite(Number(raw))) onchange(Number(raw));
  }
  const err = $derived(touched && bad ? bad : serverError);
  // D2 (22 Oct 2026): on the Day form, Enter moves to the next answer instead of doing nothing (the keypad shows "Next").
  // Only there: in every other form Enter still submits.
  function next(e) {
    if (e.key !== 'Enter' || !e.currentTarget.closest('.dform')) return;
    e.preventDefault();
    const all = [...e.currentTarget.closest('.dform').querySelectorAll('input:not([type=hidden]):not([disabled]), button.timebtn, textarea')]
      .filter((x) => x.getClientRects().length);
    const to = all[all.indexOf(e.currentTarget) + 1];
    to?.focus(); to?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }
</script>

<div class="field">
  <label class="label" for={id}>{label}{#if unit} <span class="opt">({unit})</span>{/if}</label>
  <input {id} class="input" type="text" inputmode={float ? 'decimal' : 'numeric'} enterkeyhint="next" autocomplete="off" value={raw} oninput={input} onkeydown={next}
    aria-invalid={err ? 'true' : undefined} aria-describedby={err ? id + '-e' : undefined} />
  {@render children?.()}
  {#if hint && !err}<p class="hint">{hint}</p>{/if}
  <ValidationMessage id={id + '-e'} error={err} />
</div>

