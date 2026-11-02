<script>
  // The message under a field: an error (announced) or a success note. Renders nothing when both are empty.
  import Icon from './Icon.svelte';
  let { id = undefined, error = '', success = '' } = $props();
</script>

{#if error}<p class="err" {id} role="alert"><Icon name="alert" size={16} /><span>{error}</span></p>
{:else if success}<p class="vmsg ok" {id} role="status"><Icon name="ok" size={16} /><span>{success}</span></p>{/if}
