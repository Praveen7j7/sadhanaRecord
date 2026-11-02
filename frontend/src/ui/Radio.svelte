<script>
  import '../styles/controls.css';
  // One radio option as a selectable row. Use bind:group, or checked + onchange. Complex labels go in children.
  let { name, value, group = $bindable(), checked = undefined, onchange = null, label = '', desc = '', disabled = false, class: cls = '', children } = $props();
</script>

<label class="choice {cls}">
  <input type="radio" {name} {value} {disabled} checked={checked ?? group === value} onchange={() => { group = value; onchange?.(value); }} />
  <span class="min-w-0">{#if label}<span class="block font-medium">{label}</span>{/if}{#if desc}<span class="cdesc">{desc}</span>{/if}{@render children?.()}</span>
</label>
