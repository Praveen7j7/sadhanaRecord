<script>
  /*
   * The sadhana leaderboard (ADR 0013, the head, 22 Oct 2026): devotees ordered by their weekly sadhana score, for a
   * week, a month, a year or chosen dates. A coordinator ranks their own batches; the head any batch or all of IYF
   * Delhi. The server ranks (leaderboard.js) on the score the weekly board shows, a missed week as 0, ties sharing a
   * place, and only weeks whose deadline — the one in Settings — has passed. A staff screen: no imagery.
   */
  import '../styles/screens.css';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { cachedMeta, loadMeta, staffBatches } from '../lib/meta.js';
  import { weekLabel, addDaysIso, fmtShort } from '../lib/dates.js';
  import { toCsv, fileName, saveCsv } from '../lib/csv.js';
  import { toast } from '../lib/pro.svelte.js';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Seg from '../ui/Seg.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import Icon from '../ui/Icon.svelte';
  import { batchColor } from '../lib/batchcolor.js';
  import { isTrainingId } from '../lib/batchall.js';

  const sc = $derived(scopesOf(session.user));
  let meta = $state(cachedMeta()), metaErr = $state(null);
  const getMeta = () => { metaErr = null; loadMeta().then((m) => (meta = m)).catch((e) => (metaErr = e)); };
  getMeta();
  // class batches only: a training's people are ranked in their own batch
  const mine = $derived(staffBatches(meta).filter((b) => b.level !== 'ETP' && !isTrainingId(b.batchId) && (sc.master || sc.coordinator.includes(b.batchId))));
  // "All batches" (Phase 22 F2): the head all of IYF Delhi; a coordinator of two or more class batches all of theirs, ranked together
  const ALL_LABEL = $derived(sc.master ? 'All of IYF Delhi' : 'All my batches');
  const bName = (id) => mine.find((b) => b.batchId === id)?.name || id;
  const ALL = '__all';
  let scope = $state(''), period = $state('week'), weekId = $state(''), month = $state(''), year = $state(''), from = $state(''), to = $state('');
  const batchId = $derived(scope || (sc.master ? ALL : mine[0]?.batchId || ''));

  let d = $state(null), rows = $state([]), err = $state(''), fe = $state({}), loading = $state(false), more = $state(false);
  let closed = $state('');      // the last closed week, from the server: the pickers count back from it
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weeks = $derived(closed ? Array.from({ length: 26 }, (_, i) => addDaysIso(closed, -7 * i)) : []);
  const months = $derived(closed ? Array.from({ length: 12 }, (_, i) => { const [y, m] = closed.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 - i, 1)); return t.toISOString().slice(0, 7); }) : []);
  const years = $derived(closed ? [0, 1, 2].map((i) => String(+closed.slice(0, 4) - i)) : []);

  function ask(page = 0) {
    const q = { period, ...(batchId && batchId !== ALL ? { batchId } : {}), ...(page ? { page } : {}) };
    if (period === 'week' && weekId) q.weekId = weekId;
    if (period === 'month' && month) q.month = month;
    if (period === 'year' && year) q.year = year;
    if (period === 'custom') { q.from = from; q.to = to; }
    return call('leaderboard.get', q);
  }
  let seq = 0;
  async function load() {
    if (!batchId || (period === 'custom' && (!from || !to))) return;
    const n = ++seq; loading = true; err = ''; fe = {};
    try {
      const r = await ask();
      if (n !== seq) return;
      d = r; rows = r.rows; closed = r.lastClosedWeek;
    } catch (e) { if (n === seq) { fe = fieldErrors(e); err = Object.keys(fe).length ? '' : e; d = null; rows = []; } }
    if (n === seq) loading = false;
  }
  $effect(() => { batchId; period; weekId; month; year; from; to; load(); });

  async function showMore() {
    more = true;
    try { const r = await ask(d.page + 1); d = r; rows = [...rows, ...r.rows]; } catch (e) { toast(errorMessage(e), { kind: 'err' }); }
    more = false;
  }
  // the whole list, every page, as the person sees it ranked
  async function exportCsv() {
    try {
      let all = [...rows], p = d.page;
      while (p + 1 < d.pages) { p += 1; all = [...all, ...(await ask(p)).rows]; }
      const cols = ['Rank', 'Name', 'Batch', 'Score %', 'Weeks', 'Missed'];
      await saveCsv(fileName('leaderboard', batchId === ALL ? (sc.master ? 'all-IYF' : 'all-my-batches') : batchId, d.label),
        toCsv(cols, all.map((r) => [r.rank, r.name, bName(r.batchId), r.score, r.weeks, r.missed])));
    } catch (e) { toast(errorMessage(e), { kind: 'err' }); }
  }
  // a range runs from its first Monday to the Sunday that ends its last week: "5 Oct – 18 Oct"
  const windowText = $derived(!d ? '' : d.from === d.to ? `Week of ${weekLabel(d.from)}` : `${fmtShort(d.from)} – ${fmtShort(addDaysIso(d.to, 6))}`);
</script>

<PageHeader class="lb-head ph-one" title={mine.length > 1 || sc.master ? '' : mine[0]?.name || ''}>
  {#if mine.length > 1 || sc.master}
    <WheelSelect id="lb-batch" label="Batch" srLabel class="mb-0 w-full sm:w-64" value={batchId}
      options={[...(sc.master || mine.length > 1 ? [[ALL, ALL_LABEL]] : []), ...mine.map((b) => [b.batchId, b.name])]} onchange={(v) => (scope = v)} />
  {/if}
  {#snippet actions()}{#if d?.rows.length}<button type="button" class="btn btn-outline btn-sm" onclick={exportCsv}><Icon name="download" size={16} />Export</button>{/if}{/snippet}
</PageHeader>

<div class="lb-pick"><Seg id="lb-period" label="Period" options={[['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Dates']]} value={period} onchange={(v) => (period = v)} /></div>
<div class="lb-when">
  {#if period === 'week' && weeks.length}
    <WheelSelect id="lb-week" label="Week" class="mb-0" value={weekId || closed} options={weeks.map((w) => [w, weekLabel(w)])} onchange={(v) => (weekId = v)} />
  {:else if period === 'month' && months.length}
    <WheelSelect id="lb-month" label="Month" class="mb-0" value={month || closed.slice(0, 7)} options={months.map((m) => [m, `${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`])} onchange={(v) => (month = v)} />
  {:else if period === 'year' && years.length}
    <WheelSelect id="lb-year" label="Year" class="mb-0" value={year || years[0]} options={years.map((y) => [y, y])} onchange={(v) => (year = v)} />
  {:else if period === 'custom'}
    <div class="pair"><DateInput id="lb-from" label="From" bind:value={from} error={fe.from} /><DateInput id="lb-to" label="To" bind:value={to} error={fe.to} hint="Up to 6 months" /></div>
  {/if}
</div>

{#if err}<ErrorState error={err} safe="" onretry={load} />{/if}
<!-- the batch list could not be read (offline): that is not "no class batch" (Phase 24, V31) -->
{#if !batchId && metaErr}<ErrorState error={metaErr} safe="" onretry={getMeta} />
{:else if !batchId}<EmptyState icon="users" title="No class batch">A leaderboard is for a class batch you coordinate.</EmptyState>
{:else if loading && !d}<Skeleton kind="list" rows={6} />
{:else if d}
  <p class="lb-win m-0">{windowText} · {d.total} {d.total === 1 ? 'devotee' : 'devotees'}</p>
  {#if !rows.length}
    <EmptyState icon="report" title="No weeks to rank">{batchId === ALL ? (sc.master ? 'Nobody' : 'Nobody in your batches') : 'Nobody in this batch'} has a closed week in this period yet.</EmptyState>
  {:else}
    <ol class="list lb-list" aria-label="Leaderboard">
      {#each rows as r (r.login)}
        <li class="lb-row">
          <span class="lb-rank" class:top={r.rank <= 3}>{r.rank}</span>
          <span class="lb-who"><span class="lb-name">{r.name}</span>
            <small>{#if batchId === ALL}<i class="lb-sw" style:--sw={batchColor(mine.find((b) => b.batchId === r.batchId) || r.batchId)} aria-hidden="true"></i>{bName(r.batchId)} · {/if}{r.weeks} {r.weeks === 1 ? 'week' : 'weeks'}{r.missed ? ` · ${r.missed} missed` : ''}</small></span>
          <span class="lb-score">{r.score}%</span>
        </li>
      {/each}
    </ol>
    {#if d.page + 1 < d.pages}<div class="mt-3 flex justify-center"><Button busy={more} onclick={showMore}>Show more</Button></div>{/if}
  {/if}
{/if}

<style>
  .lb-pick { margin-bottom: var(--sp-3); max-width: 480px; }
  .lb-when { margin-bottom: var(--sp-3); max-width: 480px; }
  .lb-win { margin-bottom: var(--sp-3); color: var(--text-secondary); font-size: var(--fs-sm); }
  .lb-list { margin: 0; padding: 0; list-style: none; }
  .lb-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: var(--sp-3);
            padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border); }
  .lb-row:last-child { border-bottom: 0; }
  .lb-rank { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--surface-2);
             font-size: var(--fs-sm); font-weight: 650; font-variant-numeric: tabular-nums; }
  .lb-rank.top { background: var(--accent-soft); color: var(--accent); }
  .lb-who { display: grid; min-width: 0; }
  .lb-name { font-weight: 600; overflow-wrap: anywhere; }
  .lb-who small { color: var(--text-secondary); font-size: var(--fs-xs); }
  .lb-sw { display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 2px; background: var(--sw); }
  .lb-score { font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
