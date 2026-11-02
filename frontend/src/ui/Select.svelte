<script>
  // Labelled native select (options as children): help text and error message like TextInput.
  import ValidationMessage from './ValidationMessage.svelte';
  let { id, label, value = $bindable(''), hint = '', error = '', optional = false, srLabel = false, onchange = null, class: cls = '', children, ...rest } = $props();
  const desc = $derived([error ? id + '-e' : '', hint && !error ? id + '-h' : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="field {cls}">
  <label class="label" class:sr-only={srLabel} for={id}>{label}{#if optional} <span class="opt">(optional)</span>{/if}</label>
  <select {id} class="input" {value} onchange={(e) => { value = e.currentTarget.value; onchange?.(value); }} aria-invalid={error ? 'true' : undefined} aria-describedby={desc} {...rest}>
    {@render children()}
  </select>
  {#if hint && !error}<p class="hint" id={id + '-h'}>{hint}</p>{/if}
  <ValidationMessage id={id + '-e'} {error} />
</div>
