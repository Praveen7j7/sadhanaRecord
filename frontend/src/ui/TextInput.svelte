<script>
  // Labelled text input: help text, error / success message, disabled and loading (spinner at the end) states.
  // Extra content (e.g. the marks line of the day form) goes in children, under the input.
  // A password field has an eye button to show what was typed (the head, 4 Oct 2026).
  import ValidationMessage from './ValidationMessage.svelte';
  import Icon from './Icon.svelte';
  let { id, label, value = $bindable(''), type = 'text', hint = '', error = '', success = '', loading = false, optional = false, el = $bindable(), class: cls = '', children, ...rest } = $props();
  let reveal = $state(false);
  const pw = $derived(type === 'password');
  const desc = $derived([error || success ? id + '-e' : '', hint && !error ? id + '-h' : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="field {cls}">
  <label class="label" for={id}>{label}{#if optional} <span class="opt">(optional)</span>{/if}</label>
  <div class:ctl-wrap={loading || (success && !error) || pw}>
    <input bind:this={el} {id} type={pw && reveal ? 'text' : type} class="input" class:is-ok={success && !error} {value} oninput={(e) => (value = e.currentTarget.value)}
      aria-invalid={error ? 'true' : undefined} aria-describedby={desc} aria-busy={loading || undefined} {...rest} />
    {#if loading}<span class="ctl-end" aria-hidden="true"><span class="spin"></span></span>
    {:else if pw}<button type="button" class="ctl-eye" aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal} aria-controls={id} onclick={() => (reveal = !reveal)}><Icon name={reveal ? 'eyeoff' : 'eye'} size={20} /></button>
    {:else if success && !error}<span class="ctl-end ok" aria-hidden="true"><Icon name="check" size={18} /></span>{/if}
  </div>
  {@render children?.()}
  {#if hint && !error}<p class="hint" id={id + '-h'}>{hint}</p>{/if}
  <ValidationMessage id={id + '-e'} {error} {success} />
</div>
