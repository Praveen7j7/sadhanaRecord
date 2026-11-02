<script>
  // Today's birthdays in the coordinator's batches, and the next 7 days'. Hidden when there are none.
  import { entry, load } from '../lib/cache.svelte.js';
  import { fmtShort } from '../lib/dates.js';
  import { cachedMeta } from '../lib/meta.js';
  import Icon from '../ui/Icon.svelte';
  const e = entry('birthdays.today');
  load('birthdays.today');
  const d = $derived(e.data);
  const nameOf = (id) => (cachedMeta().batches || []).find((b) => b.batchId === id)?.name || id;
</script>

{#if d && (d.today.length || d.upcoming.length)}
  <section class="section" aria-labelledby="h-bd">
    <h3 id="h-bd"><Icon name="gift" />Birthdays</h3>
    {#if d.today.length}
      <p class="t-over mb-2 mt-0">Today</p>
      <!-- plain rows like the next days' (no box inside the section); today's name stands out by weight and colour -->
      <ul class="m-0 mb-3 grid list-none p-0">
        {#each d.today as b (b.login)}
          <li><a class="flex min-h-11 items-center justify-between gap-2 border-t border-line text-ink no-underline first:border-t-0 hover:text-brand" href={'#/devotee/' + encodeURIComponent(b.login)}><span class="min-w-0 truncate font-semibold">{b.name}</span><span class="shrink-0 text-sm font-semibold text-brand">{b.age} today · {nameOf(b.batchId)}</span></a></li>
        {/each}
      </ul>
    {/if}
    {#if d.upcoming.length}
      <p class="t-over mb-1 mt-0">Next 7 days</p>
      <ul class="m-0 grid list-none p-0 text-sm">
        {#each d.upcoming as b (b.login)}
          <li><a class="flex min-h-11 items-center justify-between gap-2 border-t border-line text-ink no-underline first:border-t-0 hover:text-brand" href={'#/devotee/' + encodeURIComponent(b.login)}><span class="min-w-0 truncate font-medium">{b.name}</span><span class="shrink-0 text-muted">{fmtShort(b.date)} · {b.age}</span></a></li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
