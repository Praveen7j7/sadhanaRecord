<script>
  // The batch filling chart: this week by day, the last 8 weeks' share of forms submitted, people, and who missed.
  import { untrack } from 'svelte';
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { weekLabel, fmtShort, DAY_SHORT } from '../lib/dates.js';
  import ColBars from '../ui/ColBars.svelte';
  import ScopeStrip from '../ui/ScopeStrip.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Icon from '../ui/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import { weekTitle } from '../lib/staff.js';
  import { mergeStats } from '../lib/batchall.js';
  // one batch (batchId), or "All batches" (Phase 22 F1): batchId '' and each of batchIds asked for its own chart
  // (stats.batch, one batch a call), added up by mergeStats
  let { batchId = '', batchIds = [], nameOf = (id) => id } = $props();
  const multi = $derived(!batchId);
  const ids = $derived(batchId ? [batchId] : batchIds);

  const keyOf = (id) => 'stats.batch:' + id;
  const key = $derived(ids.map(keyOf).join('|'));
  const es = $derived(ids.map((id) => entry(keyOf(id))));
  const e = $derived({ error: es.find((x) => x.error)?.error || '', refreshing: es.some((x) => x.refreshing) });
  const d = $derived(!multi ? es[0]?.data : es.length && es.every((x) => x.data) ? mergeStats(ids.map((id, i) => [id, es[i].data])) : undefined);
  const refresh = (force = false) => Promise.all(ids.map((id) => load(keyOf(id), () => call('stats.batch', { batchId: id, weeks: 8 }), { force })));
  $effect(() => { key; untrack(() => refresh()); });
  let more = $state(10);
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const t = $derived(d?.thisWeek);
</script>


{#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="chart" />
{:else if d}
  <Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />
  <div class="grid2">
    <section class="section" aria-labelledby="st-w">
      <h3 id="st-w"><Icon name="week" />Week of {weekLabel(d.weekId)}</h3>
      <ScopeStrip counts={{ SUBMITTED: t.submitted, DRAFT: t.draft, NOT_STARTED: t.notStarted, MISSED: t.missed }} label={weekTitle(d.weekId)} />
      <p class="t-over mb-2 mt-0">Devotees who filled each day · out of {t.expected}</p>
      <ColBars items={t.byDay.map((v, i) => ({ label: DAY_SHORT[i], value: v }))} max={Math.max(1, t.expected)} unit="" title={`Devotees who filled each day, out of ${t.expected}`} />
    </section>

    <section class="section" aria-labelledby="st-t">
      <h3 id="st-t"><Icon name="report" />Forms submitted, by week</h3>
      <ColBars items={d.trend.map((w, i) => ({ label: fmtShort(w.weekId), short: String(+w.weekId.slice(8, 10)), sub: !i || w.weekId.slice(5, 7) !== d.trend[i - 1].weekId.slice(5, 7) ? MON3[+w.weekId.slice(5, 7) - 1] : '', value: w.filledPct }))} avg title="Share of expected devotees who submitted, by week" />
    </section>

    <section class="section" aria-labelledby="st-p">
      <h3 id="st-p"><Icon name="user" />People</h3>
      <p class="m-0 st-people"><b>{d.people.active}</b> active · <b>{d.people.inactive}</b> inactive · <b>{d.people.disabled}</b> disabled{#if d.people.pending}{' · '}<b>{d.people.pending}</b> waiting approval{/if}</p>
      {#if d.people.pending}<a class="btn btn-block mt-3" href="#/requests"><Icon name="inbox" size={18} />Open requests</a>{/if}
    </section>

    <section class="section" aria-labelledby="st-m">
      <h3 id="st-m"><Icon name="clock" />Missed weeks</h3>
      {#if d.missedLog.length}
        <ul class="m-0 grid list-none gap-2 p-0">
          {#each d.missedLog.slice(0, more) as m (m.login + m.weekId + (m.batchId || ''))}
            <li><a class="rowlink" href={'#/devotee/' + encodeURIComponent(m.login)}>
              <span class="min-w-0"><span class="block truncate font-medium">{m.name}</span><span class="block text-xs text-muted">{multi && m.batchId ? nameOf(m.batchId) + ' · ' : ''}Week of {weekLabel(m.weekId)}</span></span>
              <span class="shrink-0 text-sm text-muted">{m.daysFilled} of 7 days</span>
            </a></li>
          {/each}
        </ul>
        {#if d.missedLog.length > more}<button type="button" class="btn btn-block mt-2" onclick={() => (more += 20)}>Show more ({d.missedLog.length - more} left)</button>{/if}
      {:else}<EmptyState icon="ok" title="No missed weeks">Everyone submitted in the last {d.trend.length} weeks.</EmptyState>{/if}
    </section>
  </div>
  <!-- who is counted now, and who became inactive or came back by month and by day (Phase 23, ADR 0020): this batch, or
       every batch on "All my batches" -->
  {#await import('./ActivityStats.svelte') then M}<M.default {batchId} />{/await}
{/if}

<style>
  .st-people { font-size: var(--fs-sm); color: var(--text-muted); }
  .st-people b { color: var(--text); font-variant-numeric: tabular-nums; }
</style>
