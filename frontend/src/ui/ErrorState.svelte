<script>
  // Something failed to load (Phase 24, G9 / V31): what happened, what is safe, and Try again. It is NOT EmptyState:
  // a screen asks "did it fail?" before "is it empty?", so a phone with no connection never reads "No card yet" or
  // "No class batch". `error` is the ApiError (or its message); a NETWORK / TIMEOUT error is worded as no connection.
  // Drawn with the notice strip's own styles (.banner, in the start-up CSS), so it ships no CSS of its own (precache).
  import Icon from './Icon.svelte';
  import { errorMessage } from '../lib/api.js';
  let { error = null, title = '', safe = 'Nothing you entered is lost.', onretry = null, retryLabel = 'Try again' } = $props();
  const code = $derived(typeof error === 'object' && error ? error.code || '' : '');
  const offline = $derived(code === 'NETWORK' || code === 'TIMEOUT' || (typeof navigator !== 'undefined' && navigator.onLine === false));
  const head = $derived(title || (offline ? 'No connection' : 'This could not be loaded'));
  const why = $derived(offline ? (code === 'TIMEOUT' ? 'The server did not answer in time.' : 'This phone is offline or the network dropped.')
    : (typeof error === 'string' ? error : error ? errorMessage(error) : '') || 'Something went wrong on the way.');
</script>

<div class="banner warn errstate" role="alert">
  <Icon name={offline ? 'offline' : 'alert'} size={18} />
  <div class="b-body"><b class="block">{head}</b>{why}{#if safe} {safe}{/if}</div>
  {#if onretry}<button type="button" class="btn btn-text btn-sm b-act" onclick={onretry}><Icon name="refresh" size={16} />{retryLabel}</button>{/if}
</div>
