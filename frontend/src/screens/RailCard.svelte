<script>
  /*
   * The scorecard in the weekly fill form's rail (phase 22, the head, 26 Oct 2026 — E2): the same ScoreCard the card
   * screen shows, for a facilitator or a trainee filling their own week. It reads card.get through the shared cache
   * (the card screen's own key), so a visit within two minutes of either asks the server nothing.
   */
  import { call } from '../lib/api.js';
  import { entry, load as cacheLoad } from '../lib/cache.svelte.js';
  import ScoreCard from './ScoreCard.svelte';

  let { title = 'My targets' } = $props();
  const e = entry('card.get');
  cacheLoad('card.get', () => call('card.get', {}));
  // nobody without a card is shown an empty one (card.get hasCard)
  const card = $derived(e.data?.hasCard && e.data?.measures ? e.data : null);
</script>

{#if card}<ScoreCard {card} compact id="rc" {title} />{/if}
