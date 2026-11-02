<script>
  import '../styles/controls.css';
  // A checkbox with its label (and optional description). card: a bordered, selectable row.
  let { label = '', desc = '', checked = $bindable(false), card = true, onchange = null, class: cls = '', children, ...rest } = $props();
</script>

<label class="{card ? 'choice' : 'check'} {cls}">
  <input type="checkbox" bind:checked onchange={(e) => onchange?.(e.currentTarget.checked)} {...rest} />
  <span class="min-w-0">{#if label}<span class="block">{label}</span>{/if}{#if desc}<span class="cdesc">{desc}</span>{/if}{@render children?.()}</span>
</label>
