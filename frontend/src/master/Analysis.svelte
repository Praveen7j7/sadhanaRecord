<script>
  /*
   * Admin › Analysis (phase 21, 23 Oct 2026; the head: "the dashboard view batch wise for the IYF head about the increase
   * in chanting and various devotional standards across the IYF … week, month, year or custom … or phase … graphs and
   * report for increase or drop in chanting, reading and hearing and other important factors like night stay"; "so that
   * the entire background of the sadhana and training can be monitored across from one screen").
   *
   * One request per period (analysis.get: the period AND the one before it, from the batch_weeks summary), kept in the
   * 2-minute read cache; every figure, chart line and sentence below is worked out here from those sums. The trainings'
   * card figures come from the scoreboards' own board.get (the same cached copy Scoreboards uses), only when opened.
   */
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load as cacheLoad } from '../lib/cache.svelte.js';
  import { fmtDate } from '../lib/dates.js';
  import { pressedInView } from '../lib/chips.js';
  import { metricsFor, metric, figureOf, fmtFig, periodOf, seriesOf, movements, mondayOf } from '../lib/analysis.js';
  import Banner from '../ui/Banner.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import LineChart from '../ui/LineChart.svelte';
  import Spark from '../ui/Spark.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Icon from '../ui/Icon.svelte';

  let { tools } = $props();
  const CHOICES = [['4w', 'Last 4 weeks'], ['12w', 'Last 12 weeks'], ['phase', 'Phase'], ['52w', 'Last 52 weeks'], ['custom', 'Custom']];
  const PALETTE = ['var(--accent)', 'var(--viz-soul)', 'var(--viz-body)', 'var(--viz-seva)', 'var(--viz-att)', 'var(--gold-decorative)'];
  let choice = $state('12w'), phaseId = $state(''), from = $state(''), to = $state(''), applied = $state({ from: '', to: '' });
  let scope = $state('');          // '' = every class batch, or one batch id
  let pick = $state('rounds');     // the measure on the chart

  // the last closed week, before the server says: the Monday 9 PM deadline closes last week, so it is last week or the one before
  const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const guess = new Date(Date.parse(mondayOf(ist) + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
  const back = (w, n) => new Date(Date.parse(w + 'T00:00:00Z') - n * 7 * 864e5).toISOString().slice(0, 10);
  let known = $state({ phases: [] });       // the phases, from the first answer (for the Phase choice)
  const phase = $derived(known.phases.find((p) => p.phaseId === phaseId) || known.phases[0] || null);
  // what to ask for: the period and the one of the same length before it, and a week's margin for the deadline
  const want = $derived.by(() => {
    const p = periodOf(choice, guess, { phase, from: applied.from, to: applied.to });
    return { from: back(p.prevFrom, 1), to: p.to < guess ? p.to : guess };
  });
  const key = $derived(`analysis.get:${want.from}:${want.to}`);
  const e = $derived(entry(key));
  const d = $derived(e.data);
  const refresh = (force = false) => cacheLoad(key, () => call('analysis.get', want), { force });
  $effect(() => { key; if (choice === 'custom' && !(applied.from && applied.to)) return; refresh(); });
  $effect(() => { if (d?.phases?.length && !known.phases.length) known = { phases: d.phases }; });

  const period = $derived(d ? periodOf(choice, d.lastClosed || guess, { phase, from: applied.from, to: applied.to }) : null);
  const classBatches = $derived((d?.batches || []).filter((b) => b.active && !(d.trainings || []).some((t) => t.batchId === b.batchId) && (d.weeks || []).some((w) => w.batchId === b.batchId)));
  const ids = $derived(scope ? [scope] : classBatches.map((b) => b.batchId));
  const inScope = $derived((d?.weeks || []).filter((w) => ids.includes(w.batchId)));
  const cur = $derived(period ? inScope.filter((w) => w.weekId >= period.from && w.weekId <= period.to) : []);
  const prev = $derived(period ? inScope.filter((w) => w.weekId >= period.prevFrom && w.weekId <= period.prevTo) : []);
  const weeks = $derived.by(() => { if (!period) return []; const out = []; for (let w = period.from; w <= period.to; w = back(w, -1)) out.push(w); return out; });
  const nameOf = (id) => (d?.batches || []).find((b) => b.batchId === id)?.name || id;
  const series = $derived(seriesOf(pick, d?.weeks || [], weeks, ids).map((s, i) => ({ ...s, label: s.key === 'all' ? (ids.length > 1 ? 'All batches' : nameOf(ids[0])) : nameOf(s.key), color: PALETTE[i % PALETTE.length], dash: i >= PALETTE.length ? '5 4' : null })));
  const report = $derived(period ? movements(d?.weeks || [], (scope ? classBatches.filter((b) => b.batchId === scope) : classBatches), period) : []);
  const ups = $derived(report.filter((m) => m.up).slice(0, 6)), downs = $derived(report.filter((m) => !m.up).slice(0, 6));
  const delta = (k) => { const a = figureOf(k, prev), z = figureOf(k, cur); return a === null || z === null ? null : z - a; };
  const fmtDelta = (k, v) => { const m = metric(k); const n = Math.abs(v); return (v > 0 ? '▲ ' : '▼ ') + (m.digits ? n.toFixed(m.digits) : Math.round(n)) + (m.pct ? ' pts' : m.unit); };

  // the trainings: their counts and attendance here; their card figures from board.get when opened
  const trainings = $derived(d?.trainings || []);
  const tAtt = (t) => { const ws = t.weeks.filter((w) => period && w.weekId >= period.from && w.weekId <= period.to); const p = ws.reduce((n, w) => n + w.present, 0), h = ws.reduce((n, w) => n + w.held, 0); return h ? Math.round((p * 100) / h) : null; };
  let opened = $state({});
  const boardOf = (id) => entry('board.get:' + id).data;
  function openBoard(id) { opened = { ...opened, [id]: true }; cacheLoad('board.get:' + id, () => call('board.get', id === 'facilitators' ? {} : { batchId: id })); }
  const boardSummary = (b) => {
    const rows = b?.rows || [], ranked = rows.filter((r) => r.rank !== null), mean = (xs) => (xs.length ? Math.round(xs.reduce((n, x) => n + x, 0) / xs.length) : null);
    return { people: rows.length, set: rows.filter((r) => r.asked > 0).length, filled: rows.filter((r) => r.filled > 0).length,
      net: mean(ranked.map((r) => r.rank)), seva: mean(rows.map((r) => r.seva).filter((x) => x !== null && x !== undefined)), sadhana: mean(rows.map((r) => r.sadhana).filter((x) => x !== null && x !== undefined)) };
  };
</script>

<!-- the top bar already says Analysis: the head names the period instead -->
<PageHeader title={period ? `${fmtDate(period.from)} – ${fmtDate(period.to)}` : 'Every batch'} meta={period ? `Against the ${period.weeks} ${period.weeks === 1 ? 'week' : 'weeks'} before` : ''}>
  {#snippet actions()}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{@render tools?.()}{/snippet}</PageHeader>

<div class="chiprow one-line mb-2" role="group" aria-label="Period" {@attach pressedInView}>
  {#each CHOICES as [v, t] (v)}<button type="button" class="chipbtn" aria-pressed={choice === v} onclick={() => (choice = v)}>{t}</button>{/each}
</div>
{#if choice === 'phase' && known.phases.length > 1}
  <div class="chiprow one-line mb-2" role="group" aria-label="Phase" {@attach pressedInView}>
    {#each known.phases as p (p.phaseId)}<button type="button" class="chipbtn" aria-pressed={phase?.phaseId === p.phaseId} onclick={() => (phaseId = p.phaseId)}>{p.name}</button>{/each}
  </div>
{/if}
{#if choice === 'custom'}
  <div class="an-dates mb-3">
    <DateInput id="an-from" label="From" bind:value={from} class="mb-0" />
    <DateInput id="an-to" label="To" bind:value={to} class="mb-0" />
    <button type="button" class="btn btn-primary" disabled={!from || !to || to < from || (Date.parse(to) - Date.parse(from)) / 864e5 > 366 || (from === applied.from && to === applied.to)} onclick={() => (applied = { from, to })}>Show</button>
  </div>
{/if}

{#if e.error && !d}<Banner onretry={() => refresh(true)}>Couldn't load the analysis. {errorMessage(e.error)}</Banner>
{:else if !d}{#if choice !== 'custom' || (applied.from && applied.to)}<Skeleton kind="page" rows={4} />{/if}
{:else if !classBatches.length && !trainings.length}
  <EmptyState icon="report" title="Nothing to analyse yet">Each week appears here once its Monday deadline has closed it.</EmptyState>
{:else}
  <div class="chiprow one-line mb-3" role="group" aria-label="Batch" {@attach pressedInView}>
    <button type="button" class="chipbtn" aria-pressed={!scope} onclick={() => (scope = '')}>All batches</button>
    {#each classBatches as b (b.batchId)}<button type="button" class="chipbtn" aria-pressed={scope === b.batchId} onclick={() => (scope = b.batchId)}>{b.name}</button>{/each}
  </div>

  <!-- every measure for the period, with its move against the period before; a tile puts it on the chart -->
  <section aria-labelledby="an-m">
    <h3 id="an-m" class="sr-only">Measures</h3>
    <ul class="an-tiles">
      <!-- the Morning program tile (TRD, Phase 22) only when a batch in view is scored on it -->
      {#each metricsFor(inScope) as m (m.key)}
        {@const v = figureOf(m.key, cur)}
        {@const ch = delta(m.key)}
        <li><button type="button" class="an-tile" aria-pressed={pick === m.key} onclick={() => (pick = m.key)}>
          <span class="an-l">{m.label}</span>
          <strong>{fmtFig(m.key, v)}</strong>
          {#if ch !== null && Math.round(Math.abs(ch) * (m.digits ? 10 : 1)) !== 0}<span class="an-ch" data-up={ch > 0 || undefined}>{fmtDelta(m.key, ch)}</span>{:else}<span class="an-ch an-flat">{ch === null ? 'no earlier figure' : 'steady'}</span>{/if}
        </button></li>
      {/each}
    </ul>
  </section>

  <section class="cblock" aria-labelledby="an-c">
    <h3 id="an-c" class="m-0 mb-1">{metric(pick).label}<span class="text-sm font-normal text-muted">&nbsp;· {metric(pick).what || 'average'}, week by week</span></h3>
    <LineChart {weeks} {series} unit={metric(pick).unit.trim() === '%' ? '%' : ''} max={metric(pick).pct ? 100 : null} digits={metric(pick).digits} label={metric(pick).label} />
  </section>

  {#if ups.length || downs.length}
    <section class="an-report" aria-labelledby="an-r">
      <h3 id="an-r" class="m-0 mb-2">Increase and drop</h3>
      <div class="an-cols">
        {#if downs.length}<div><p class="t-over m-0 mb-1 an-down">Needs attention</p><ul class="an-sent">{#each downs as m (m.batchId + m.key)}<li><Icon name="down" size={14} />{m.text}</li>{/each}</ul></div>{/if}
        {#if ups.length}<div><p class="t-over m-0 mb-1 an-up">Going well</p><ul class="an-sent">{#each ups as m (m.batchId + m.key)}<li><Icon name="up" size={14} />{m.text}</li>{/each}</ul></div>{/if}
      </div>
    </section>
  {/if}

  <!-- the training side, on the same screen: each training, then the facilitators' board -->
  <section aria-labelledby="an-t" class="mt-5">
    <h3 id="an-t" class="m-0 mb-2">Training</h3>
    <ul class="an-trs">
      {#each trainings as t (t.batchId)}
        {@const att = tAtt(t)}
        {@const bs = opened[t.batchId] ? boardSummary(boardOf(t.batchId)) : null}
        <li class="cblock an-tr">
          <div class="an-trh"><strong>{t.name}</strong>{#if t.closedAt}<span class="pill">Finished</span>{:else}<span class="pill" data-tone="info">Running</span>{/if}</div>
          <p class="m-0 text-sm text-muted">{t.active} in it now{t.qualified ? ` · ${t.qualified} qualified` : ''}{t.repeat ? ` · ${t.repeat} to repeat` : ''}{t.left ? ` · ${t.left} left` : ''}{t.removed ? ` · ${t.removed} taken out` : ''}{t.startedOn ? ` · since ${fmtDate(t.startedOn)}` : ''}</p>
          <p class="m-0 mt-2 flex items-center gap-3 text-sm"><span>Training attendance <b>{att === null ? '—' : att + '%'}</b></span>
            {#if t.weeks.length > 1}<Spark values={t.weeks.map((w) => (w.held ? Math.round((w.present * 100) / w.held) : 0))} label={`${t.name}, training attendance by week`} w={96} h={28} />{/if}</p>
          {#if !opened[t.batchId]}<button type="button" class="btn btn-text btn-sm -ml-2.5 mt-1" onclick={() => openBoard(t.batchId)}>Card figures</button>
          {:else if entry('board.get:' + t.batchId).error && !boardOf(t.batchId)}<p class="m-0 mt-2 text-sm text-muted">{errorMessage(entry('board.get:' + t.batchId).error)}</p>
          {:else if !boardOf(t.batchId)}<Skeleton kind="list" rows={1} />
          {:else}<p class="m-0 mt-2 text-sm">{bs.people} on the card · {bs.set} set targets · {bs.filled} filled this week · seva {bs.seva ?? '—'}% · net {bs.net ?? '—'}%</p>{/if}
        </li>
      {/each}
      {#if true}
        {@const fs = opened.facilitators ? boardSummary(boardOf('facilitators')) : null}
        <li class="cblock an-tr">
          <div class="an-trh"><strong>Facilitators</strong></div>
          {#if !opened.facilitators}<button type="button" class="btn btn-text btn-sm -ml-2.5" onclick={() => openBoard('facilitators')}>Card figures</button>
          {:else if entry('board.get:facilitators').error && !boardOf('facilitators')}<p class="m-0 text-sm text-muted">{errorMessage(entry('board.get:facilitators').error)}</p>
          {:else if !boardOf('facilitators')}<Skeleton kind="list" rows={1} />
          {:else}<p class="m-0 text-sm">{fs.people} {fs.people === 1 ? 'facilitator' : 'facilitators'} · {fs.set} set targets · {fs.filled} filled this week · sadhana {fs.sadhana ?? '—'}% · seva {fs.seva ?? '—'}% · net {fs.net ?? '—'}%</p>{/if}
        </li>
      {/if}
    </ul>
  </section>
{/if}

<style>
  .an-dates { display: grid; grid-template-columns: 1fr 1fr auto; align-items: end; gap: var(--sp-2); }
  @media (max-width: 420px) { .an-dates { grid-template-columns: 1fr 1fr; } .an-dates .btn { grid-column: 1 / -1; } }
  /* two tiles to a 320 px row (Phase 24, V19: 9.5rem did not fit twice in 288 px — 13 tiles stood one per row) */
  .an-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(7.5rem, 100%), 1fr)); gap: var(--sp-2); margin: 0 0 var(--sp-4); padding: 0; list-style: none; }
  .an-tile { display: grid; gap: 2px; width: 100%; min-height: 84px; padding: 10px 12px; text-align: left; border: 1px solid var(--border); border-radius: var(--r-md);
             background: var(--surface-elevated); color: var(--text); font: inherit; cursor: pointer; box-shadow: var(--shadow-1); }
  .an-tile[aria-pressed='true'] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset, var(--shadow-1); }
  .an-tile strong { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .an-l { font-size: var(--fs-xs); color: var(--text-secondary); font-weight: 600; }
  .an-ch { font-size: var(--fs-xs); font-weight: 650; color: var(--danger-text, var(--danger)); font-variant-numeric: tabular-nums; }
  .an-ch[data-up] { color: var(--success-text, var(--success)); }
  .an-ch.an-flat { color: var(--text-muted); font-weight: 500; }
  .an-report { margin: var(--sp-4) 0; }
  .an-cols { display: grid; gap: var(--sp-4); }
  @media (min-width: 768px) { .an-cols { grid-template-columns: 1fr 1fr; } }
  .an-sent { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: var(--fs-sm); }
  .an-sent li { display: flex; align-items: flex-start; gap: 6px; }
  .an-sent :global(svg) { flex: none; margin-top: 3px; }
  .an-down { color: var(--danger-text, var(--danger)); }
  .an-up { color: var(--success-text, var(--success)); }
  .an-trs { display: grid; gap: var(--sp-3); margin: 0; padding: 0; list-style: none; }
  @media (min-width: 1024px) { .an-trs { grid-template-columns: 1fr 1fr; } }
  .an-tr { margin: 0; }
  .an-trh { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); margin-bottom: 4px; }
</style>
