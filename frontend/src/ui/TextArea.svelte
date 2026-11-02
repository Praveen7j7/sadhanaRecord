<script>
  // Labelled multi-line text with help, error and an optional character counter (needs maxlength).
  import ValidationMessage from './ValidationMessage.svelte';
  let { id, label, value = $bindable(''), hint = '', error = '', optional = false, counter = false, maxlength = undefined, class: cls = '', ...rest } = $props();
  const desc = $derived([error ? id + '-e' : '', hint && !error ? id + '-h' : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="field {cls}">
  <label class="label" for={id}>{label}{#if optional} <span class="opt">(optional)</span>{/if}</label>
  <textarea {id} class="input" {maxlength} {value} oninput={(e) => (value = e.currentTarget.value)} aria-invalid={error ? 'true' : undefined} aria-describedby={desc} {...rest}></textarea>
  {#if (hint && !error) || counter}
    <p class="hint flex justify-between gap-3" id={id + '-h'}><span>{error ? '' : hint}</span>{#if counter && maxlength}<span class="shrink-0 tabular-nums">{(value || '').length}/{maxlength}</span>{/if}</p>
  {/if}
  <ValidationMessage id={id + '-e'} {error} />
</div>
