<script>
  // The toasts (bottom, above the nav): polite for success and info, assertive for errors; an action button (Undo).
  import { toasts, dismiss } from '../lib/pro.svelte.js';
  import Icon from './Icon.svelte';
  const ICON = { ok: 'ok', info: 'info', err: 'alert' };
</script>

<!-- one stack: errors (read out at once) and the rest (read out politely), never on top of each other -->
<div class="toasts">
  <div class="tq" aria-live="polite" role="status">{#each toasts.list.filter((t) => t.kind !== 'err') as t (t.id)}{@render one(t)}{/each}</div>
  <div class="tq" aria-live="assertive" role="alert">{#each toasts.list.filter((t) => t.kind === 'err') as t (t.id)}{@render one(t)}{/each}</div>
</div>

{#snippet one(t)}
  <div class="toast" data-kind={t.kind} style:--ms={(t.ms || 5000) + 'ms'}>
    <span class="t-ic" aria-hidden="true"><Icon name={ICON[t.kind] || 'info'} size={18} /></span>
    <span class="min-w-0 flex-1">{t.text}</span>
    {#if t.action}<button type="button" class="btn btn-text btn-sm" onclick={() => { dismiss(t.id); t.action.run(); }}>{t.action.label}</button>{/if}
    <button type="button" class="iconbtn" aria-label="Dismiss" onclick={() => dismiss(t.id)}><Icon name="close" size={16} /></button>
  </div>
{/snippet}
