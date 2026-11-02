<script>
  // The Export button on staff screens (Phase 9, item 21): opens the export sheet, which loads only now (never at start),
  // starting from the choice that fits the screen, for the batches shown.
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf, can } from '../lib/scopes.js';
  // short: beside a search on a small phone, the icon alone (the word stays for screen readers), so the search keeps its room
  let { start = 'weekly', batchIds = [], class: cls = '', short = false } = $props();
  let Sheet = $state(null), sheet = $state(), busy = $state(false);
  async function open() {
    if (!Sheet) { busy = true; try { Sheet = (await import('./ExportSheet.svelte')).default; } finally { busy = false; } }
    await tick(); sheet?.open(start, batchIds);
  }
</script>

<!-- hidden when the head has turned Export off for this person (ADR 0015/0019): the server would refuse it -->
{#if can(scopesOf(session.user), 'exports')}<button type="button" class="btn btn-sm btn-outline w-auto {cls}" class:eb-short={short} aria-haspopup="dialog" aria-busy={busy || undefined} onclick={open}><Icon name="download" size={16} />{#if short}<span class="eb-t">Export</span>{:else}Export{/if}</button>{/if}

<style>
  @media (max-width: 419px) {
    .eb-short { min-width: var(--ctl-h); min-height: var(--ctl-h); padding-inline: 0; justify-content: center; }
    .eb-t { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  }
</style>
{#if Sheet}<Sheet bind:this={sheet} />{/if}
