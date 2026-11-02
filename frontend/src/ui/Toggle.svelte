<script>
  import '../styles/controls.css';
  // An on / off switch (a checkbox with role="switch"): label on the left, switch on the right.
  let { label, desc = '', checked = $bindable(false), onchange = null, disabled = false, class: cls = '' } = $props();
</script>

<label class="toggle {cls}">
  <span class="min-w-0"><span class="block font-medium">{label}</span>{#if desc}<span class="tdesc">{desc}</span>{/if}</span>
  <input type="checkbox" role="switch" bind:checked {disabled} onchange={(e) => onchange?.(e.currentTarget.checked)} />
  <span class="switch" aria-hidden="true"></span>
</label>
