<script>
  let { tools } = $props();   // the page's Export, from Admin.svelte, laid out in this page's own head
  // All batches this week (the IYF head; #/overview, Phase 6, 9 Oct 2026): one strip of totals (active members only),
  // then every batch worst first — submitted as a bar and "4 of 10", filling, not started, missed, the 8-week trend, and
  // an amber chip where a batch has no coordinator. Batches with nobody expected go to one line underneath. A row opens
  // that batch's status. Waiting sign-ups live in Requests, not here.
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { weekLabel, fmtClose } from '../lib/dates.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import ScopeStrip from '../ui/ScopeStrip.svelte';
  import Spark from '../ui/Spark.svelte';
  import { batchColor } from '../lib/batchcolor.js';
  import { weekName } from '../lib/staff.js';
  // the same eight weeks the head's Home reads (home.staff files them under this name): opening this after Home is free
  const KEY = 'stats.all:8';
  const e = entry(KEY);
  const refresh = (force = false) => load(KEY, () => call('stats.all', { weeks: 8 }), { force });
  refresh();
  const bl = entry('batches.list');
  load('batches.list');
  const d = $derived(e.data);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const noCoord = (id) => !!bl.data && !bl.data.find((b) => b.batchId === id)?.coordinatorLogins?.length;
  const coordOf = (id) => bl.data?.find((b) => b.batchId === id)?.coordinatorNames?.join(', ') || '';
  const rows = $derived((d?.batches || []).filter((b) => b.thisWeek.expected).sort((a, b) => pct(a.thisWeek.submitted, a.thisWeek.expected) - pct(b.thisWeek.submitted, b.thisWeek.expected) || a.name.localeCompare(b.name)));
  const empty = $derived((d?.batches || []).filter((b) => !b.thisWeek.expected).map((b) => b.name));
  const counts = $derived(d ? { SUBMITTED: d.totals.submitted, DRAFT: d.totals.draft, NOT_STARTED: d.totals.notStarted, MISSED: d.totals.missed } : {});
  const open = (b) => (batchSel.id = b.batchId);

</script>

<PageHeader title={d?.batches?.[0] ? 'Week of ' + weekLabel(d.batches[0].weekId) : 'This week'}
  meta={d ? `${d.totals.submitted} of ${d.totals.expected} submitted · ${d.totals.active} active devotees${d.batches?.[0]?.closesAt ? ' · closes ' + fmtClose(d.batches[0].closesAt) : ''}` : ''}>
  {#snippet actions()}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{@render tools?.()}{/snippet}</PageHeader>
{#if e.error && !d}<Banner onretry={() => refresh(true)}>Couldn't load this week's numbers. {errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="page" rows={3} />
{:else if d}
  <ScopeStrip {counts} label={'Every batch · ' + weekName(d.batches?.[0]?.weekId)} />
  {#if !rows.length}
    <EmptyState icon="grid" title="No active devotees yet">Batches marked active in Batch setup appear here once they have devotees.</EmptyState>
  {:else}
    <ul class="ov-list" aria-label="Batches, the lowest share submitted first">
      {#each rows as b (b.batchId)}
        {@const t = b.thisWeek}
        {@const tr = b.trend.map((w) => w.filledPct)}
        {@const ch = tr.length > 1 ? tr[tr.length - 1] - tr[tr.length - 2] : null}
        <li style:--sw={batchColor(b)}><a class="ov-row" href="#/batch" onclick={() => open(b)}>
          <span class="ov-name"><i class="ov-sw" aria-hidden="true"></i><b>{b.name}</b>{#if ch !== null && ch !== 0}<span class="ov-ch" data-up={ch > 0 || undefined}>{ch > 0 ? '▲' : '▼'} {Math.abs(ch)} pts</span>{/if}{#if noCoord(b.batchId)}<span class="pill" data-tone="warn">No coordinator</span>{:else if coordOf(b.batchId)}<span class="ov-co">{coordOf(b.batchId)}</span>{/if}</span>
          <span class="ov-sub"><span class="ov-bar ov-stack" aria-hidden="true"><i class="s-ok" style:width={pct(t.submitted, t.expected) + '%'}></i><i class="s-warn" style:width={pct(t.draft, t.expected) + '%'}></i><i class="s-none" style:width={pct(t.notStarted, t.expected) + '%'}></i><i class="s-bad" style:width={pct(t.missed, t.expected) + '%'}></i></span><b class="ov-of">{t.submitted} of {t.expected}</b> submitted</span>
          <span class="ov-k">{t.draft} filling · {t.notStarted} not started{#if t.missed} · <span class="text-danger">{t.missed} missed</span>{/if}</span>
          <span class="ov-tr"><Spark values={b.trend.map((w) => w.filledPct)} label={`${b.name}, share submitted, last ${b.trend.length} weeks`} w={96} h={28} /></span>
        </a></li>
      {/each}
    </ul>
    {#if empty.length}<p class="m-0 mt-3 text-sm text-muted">{empty.join(', ')} — no active devotees yet.</p>{/if}
  {/if}
  <!-- active and inactive now, per batch and in total (a count opens the names), and who became inactive or came back
       month by month and day by day (Phase 23, ADR 0020); lazy, so the Admin chunk stays small -->
  {#await import('../coord/ActivityStats.svelte') then M}<div class="ov-ppl"><M.default /></div>{/await}
{/if}

<style>
  .ov-list { margin: 0; padding: 0; list-style: none; border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; background: var(--surface); }
  .ov-list li + li { border-top: 1px solid var(--border); }
  .ov-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; padding: 12px 14px; color: var(--text); text-decoration: none; }
  @media (hover: hover) { .ov-row:hover { background: var(--surface-hover); } }
  .ov-name { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .ov-name b { font-size: 1.0625rem; }
  .ov-co { font-size: var(--fs-sm); color: var(--text-muted); }
  .ov-sub { display: flex; align-items: center; gap: 10px; font-size: var(--fs-sm); color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .ov-of { color: var(--text); }
  .ov-bar { flex: 0 0 min(180px, 40%); height: 8px; border-radius: 4px; background: var(--surface-muted); overflow: hidden; }
  .ov-bar i { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
  .ov-k { font-size: var(--fs-sm); color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .ov-tr { display: none; }
  /* #9: the batch's colour; one stacked bar (submitted · filling · not started · missed); the change on last week */
  .ov-sw { flex: none; width: 10px; height: 10px; border-radius: 3px; background: var(--sw); }
  .ov-ch { font-size: var(--fs-caption); font-weight: 650; color: var(--danger); }
  .ov-ch[data-up] { color: var(--success); }
  .ov-stack { display: flex; }
  .ov-ppl { margin-top: var(--sp-5); }
  .ov-stack i { flex: none; border-radius: 0; }
  .ov-stack .s-ok { background: var(--success); } .ov-stack .s-warn { background: var(--warning); }
  .ov-stack .s-none { background: var(--border); } .ov-stack .s-bad { background: var(--danger); }
  /* ladder #17 (22 Oct 2026): from 720 px the batches are a grid of cards, the worst first, each with its trend */
  @media (min-width: 720px) {
    .ov-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; border: 0; background: none; overflow: visible; }
    .ov-list li + li { border-top: 0; }
    .ov-list li { border: 1px solid var(--border); border-top: 3px solid var(--sw, var(--border)); border-radius: var(--r-lg); background: var(--surface); overflow: hidden; }
    .ov-row { height: 100%; align-content: start; gap: 8px; padding: 14px 16px; }
    .ov-sub .ov-bar { flex: 1 1 auto; }
    .ov-tr { display: block; margin-top: 4px; }
  }
</style>
