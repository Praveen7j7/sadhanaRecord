<script>
  // Button hierarchy: primary (filled accent, full width by default), secondary (tonal, the default), outline,
  // text (tertiary), danger (tonal red) and danger-solid (the final "yes, delete"). busy shows a spinner and disables it.
  let { busy = false, variant = '', type = 'button', disabled = false, size = '', block = false, class: cls = '', children, ...rest } = $props();
  const V = { primary: 'btn-primary', secondary: '', outline: 'btn-outline', text: 'btn-text', tertiary: 'btn-text', danger: 'btn-danger', 'danger-solid': 'btn-danger-solid' };
</script>

<button {type} class="btn {V[variant] || ''} {size === 'sm' ? 'btn-sm' : ''} {block ? 'btn-block' : ''} {cls}" disabled={busy || disabled} aria-busy={busy || undefined} {...rest}>
  {#if busy}<span class="spin" aria-hidden="true"></span>{/if}
  {@render children()}
</button>
