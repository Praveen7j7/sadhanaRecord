<script>
  // A group of Radio rows (or Checkbox rows) with its legend, description and one error message.
  import ValidationMessage from './ValidationMessage.svelte';
  let { legend, desc = '', error = '', id = undefined, class: cls = '', children } = $props();
</script>

<fieldset class="field m-0 mb-4 border-0 p-0 {cls}" {id}>
  <legend class="label">{legend}</legend>
  {#if desc}<p class="hint mb-2 mt-0">{desc}</p>{/if}
  <div class="grid gap-2">{@render children()}</div>
  <ValidationMessage {error} />
</fieldset>
