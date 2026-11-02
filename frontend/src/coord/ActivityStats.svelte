<script>
  // Active and inactive (Phase 23, ADR 0020; worker inactive.js activity.stats): who is counted now, per batch, with a
  // tap opening the names in Devotees; how many became inactive and how many came back, month by month and day by day.
  // A coordinator sees their class batches (Batch › Filling chart); the head all of IYF Delhi (Admin › All batches).
  // batchId: one batch; '' = every batch the caller looks after.
  let { batchId = '' } = $props();
  import { untrack } from 'svelte';
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { batchColor } from '../lib/batchcolor.js';
  import LineChart from '../ui/LineChart.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Icon from '../ui/Icon.svelte';

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = (m) => `${MON[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  const monthShort = (m) => `${MON[+m.slice(5, 7) - 1]}${m.slice(5, 7) === '01' ? ' ' + m.slice(2, 4) : ''}`;
  const dayShort = (d) => String(+d.slice(8, 10));
  let month = $state('');
  const key = $derived('activity.stats:' + (batchId || 'all') + (month ? ':' + month : ''));
  const e = $derived(entry(key));
  const d = $derived(e.data);
  const refresh = (force = false) => load(key, () => call('activity.stats', { ...(batchId ? { batchId } : {}), ...(month ? { month } : {}) }), { force });
  $effect(() => { key; untrack(() => refresh()); });
  const people = (batch, status) => '#/members?' + new URLSearchParams({ status, ...(batch ? { batch } : {}) });
  const C_IN = 'var(--danger)', C_BACK = 'var(--success)';
  const anyMoves = $derived(!!d && d.months.some((m) => m.inactive || m.active));
</script>

<section class="section as" aria-labelledby="as-h">
  <h3 id="as-h"><Icon name="users" />Active and inactive</h3>
  {#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>
  {:else if !d}<Skeleton rows={3} />
  {:else}
    <!-- 1. now -->
    <table class="as-tbl">
      <caption class="sr-only">Devotees counted now, by batch</caption>
      <thead><tr><th scope="col">Batch</th><th scope="col">Active</th><th scope="col">Inactive</th></tr></thead>
      <tbody>
        {#each d.batches as b (b.batchId)}
          <tr><th scope="row"><i class="as-sw" style:--sw={batchColor(b)} aria-hidden="true"></i>{b.name}</th>
            <td><a class="ilink" href={people(b.batchId, 'ACTIVE')} aria-label={`${b.active} active in ${b.name}`}>{b.active}</a></td>
            <td>{#if b.inactive}<a class="ilink" href={people(b.batchId, 'INACTIVE')} aria-label={`${b.inactive} inactive in ${b.name}`}>{b.inactive}</a>{:else}<span class="text-muted">0</span>{/if}</td></tr>
        {/each}
      </tbody>
      {#if d.batches.length > 1}
        <tfoot><tr><th scope="row">All</th>
          <td><a class="ilink" href={people(batchId, 'ACTIVE')} aria-label={`${d.totals.active} active in all`}>{d.totals.active}</a></td>
          <td>{#if d.totals.inactive}<a class="ilink" href={people(batchId, 'INACTIVE')} aria-label={`${d.totals.inactive} inactive in all`}>{d.totals.inactive}</a>{:else}<span class="text-muted">0</span>{/if}</td></tr></tfoot>
      {/if}
    </table>
    <!-- the inactive rule is in How to use (Phase 24, V30: no explanatory paragraphs on a screen) -->

    <!-- 2. month by month -->
    <h4 class="as-h4">Became inactive · came back, by month</h4>
    {#if anyMoves}
      <LineChart weeks={d.months.map((m) => m.month)} fmtX={monthShort} xLabel="Month" label="Became inactive and came back, by month"
        series={[{ key: 'in', label: 'Became inactive', color: C_IN, values: d.months.map((m) => m.inactive) }, { key: 'back', label: 'Came back', color: C_BACK, values: d.months.map((m) => m.active) }]} />
    {:else}<p class="m-0 text-sm text-muted">Nobody has become inactive or come back in the last 12 months.</p>{/if}

    <!-- 3. day by day for a month -->
    <div class="as-dayhead">
      <h4 class="as-h4 m-0">By day</h4>
      <WheelSelect id={'as-m-' + (batchId || 'all')} label="Month" srLabel class="mb-0 w-full sm:w-48" value={d.month}
        options={[...d.months].reverse().map((m) => [m.month, monthName(m.month)])} onchange={(v) => (month = v)} />
    </div>
    {#if d.days.some((x) => x.inactive || x.active)}
      <LineChart weeks={d.days.map((x) => x.day)} fmtX={dayShort} xLabel="Day" label={'Became inactive and came back, ' + monthName(d.month)}
        series={[{ key: 'in', label: 'Became inactive', color: C_IN, values: d.days.map((x) => x.inactive) }, { key: 'back', label: 'Came back', color: C_BACK, values: d.days.map((x) => x.active) }]} />
    {:else}<p class="m-0 text-sm text-muted">No changes in {monthName(d.month)}.</p>{/if}
  {/if}
</section>

<style>
  .as-tbl { width: 100%; max-width: 560px; border-collapse: separate; border-spacing: 0; border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; background: var(--surface); font-variant-numeric: tabular-nums; }
  .as-tbl th, .as-tbl td { padding: 10px 14px; text-align: right; border-top: 1px solid var(--border); }
  .as-tbl thead th { border-top: 0; font-size: var(--fs-caption); font-weight: 650; color: var(--text-muted); }
  .as-tbl th[scope='row'], .as-tbl thead th:first-child { text-align: left; font-weight: 600; }
  .as-tbl tfoot th, .as-tbl tfoot td { font-weight: 700; background: var(--surface-2); }
  .as-tbl a { display: inline-block; min-width: 32px; padding: 4px 0; }
  .as-sw { display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 3px; vertical-align: middle; background: var(--sw); }
  .as-h4 { margin: var(--sp-4) 0 var(--sp-2); font-size: var(--fs-sm); font-weight: 650; }
  .as-dayhead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; margin: var(--sp-4) 0 var(--sp-2); }
</style>
