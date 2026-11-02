<script>
  // A message strip: err (alert), ok, info, warn. onretry adds a "Try again" button (error with retry).
  import Icon from './Icon.svelte';
  let { kind = 'err', onretry = null, retryLabel = 'Try again', children } = $props();
  const CLS = { err: 'banner-err', ok: 'banner-ok', info: 'banner-info', warn: 'warn' };
  const ICON = { err: 'alert', ok: 'ok', info: 'info', warn: 'alert' };
</script>

<div class="banner {CLS[kind] || ''}" role={kind === 'err' ? 'alert' : 'status'}>
  <Icon name={ICON[kind] || 'info'} size={18} />
  <div class="b-body">{@render children()}</div>
  {#if onretry}<button type="button" class="btn btn-text btn-sm b-act" onclick={onretry}><Icon name="refresh" size={16} />{retryLabel}</button>{/if}
</div>
