<script>
  // The quote carousel, loaded after the first screen (its 78 verses are ~8 KB of the first load otherwise, 3 Oct 2026;
  // 78 verses since Phase 9, 9 Oct 2026).
  // The slot keeps the carousel's height while it loads, so nothing below it moves.
  import { lazy } from '../lib/lazy.js';
  // fit: the box follows the quote on screen — only where nothing comes after it on the page (Phase 24, V17)
  let { fit = false } = $props();
</script>

<div class="qc-slot" class:fit>
  {#await lazy(() => import('./QuoteCarousel.svelte')) then m}<m.default {fit} />{:catch}{/await}
</div>

<style>
  .qc-slot { min-height: 268px; }
  .qc-slot.fit { min-height: 200px; }
</style>
