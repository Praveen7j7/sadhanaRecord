<script>
  // Home's notices (Phase 23, ADR 0020; worker inactive.js activity.notices): who became inactive and who came back in
  // the last 14 days — a coordinator's class batches, the head all of IYF Delhi. In the app only: no message, no push.
  // Shown, they count as seen (the bell's number goes); "new" marks the ones not seen before.
  import { call } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { staffBatches } from '../lib/meta.js';
  import { fmtShort } from '../lib/dates.js';
  import { actSeen, initActSeen, markActSeen } from '../lib/actseen.svelte.js';
  import Icon from '../ui/Icon.svelte';

  const e = entry('activity.notices');
  load('activity.notices', () => call('activity.notices'));
  const list = $derived(e.data?.events || []);
  const nameOf = (id) => staffBatches().find((b) => b.batchId === id)?.name || id;
  let more = $state(false);
  // the mark as it was when the card opened: what is new is said once, then the bell's number goes
  let seenAt = $state(-1);
  $effect(() => { initActSeen(session.user?.login); });
  $effect(() => {
    if (!list.length || !actSeen.login) return;
    if (seenAt < 0) seenAt = actSeen.id;
    markActSeen(Math.max(...list.map((x) => x.id)));
  });
  const WHY = { AUTO: '30 days with no day filled and no use of the app', MANUAL: 'marked by staff', FILLED: 'filled a day', APP: 'opened the app' };
  const shown = $derived(more ? list : list.slice(0, 6));
</script>

{#if list.length}
  <section class="cblock an" aria-labelledby="an-h">
    <h2 id="an-h" class="t-over m-0">Inactive and back · 14 days</h2>
    <ul class="m-0 mt-2 list-none p-0">
      {#each shown as x (x.id)}
        <li><a class="lrow" href={'#/devotee/' + encodeURIComponent(x.login)}>
          <Icon name={x.change === 'INACTIVE' ? 'clock' : 'ok'} size={20} />
          <span class="lmain"><span class="lt">{x.name} {x.change === 'INACTIVE' ? 'is inactive' : 'is back'}{#if seenAt >= 0 && x.id > seenAt}<span class="pill an-new" data-tone="accent">New</span>{/if}</span>
            <span class="ls">{nameOf(x.batchId)} · {fmtShort(x.day)} · {WHY[x.how] || x.how}</span></span>
          <Icon name="next" size={18} /></a></li>
      {/each}
    </ul>
    {#if list.length > 6}<button type="button" class="btn btn-text btn-sm mt-1" aria-expanded={more} onclick={() => (more = !more)}>{more ? 'Show fewer' : `Show all ${list.length}`}</button>{/if}
  </section>
{/if}

<style>
  .an-new { margin-left: 8px; vertical-align: middle; }
</style>
