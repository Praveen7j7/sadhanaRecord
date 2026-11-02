<script>
  // "Refreshing…" while a list is being fetched; otherwise a small Refresh button (lists are reused for 2 minutes
  // without asking the server again, so this is how to get the latest at once).
  import Icon from './Icon.svelte';
  let { on = false, onrefresh = null } = $props();
</script>

<div class="refresh">
  <p class="m-0 text-xs text-muted" role="status">{#if on}<span class="spin mr-1" aria-hidden="true"></span>Refreshing…{/if}</p>
  {#if !on && onrefresh}<button type="button" class="btn btn-text" onclick={onrefresh}><Icon name="refresh" size={16} />Refresh</button>{/if}
</div>
