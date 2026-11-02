<script>
  /*
   * The scorecard (phase 22, the head, 26 Oct 2026 — E2): ONE period at a time, the week or the phase so far, never both
   * at once. One component for the card screen (Card.svelte) and the weekly fill form's rail (RailCard.svelte, from
   * Day.svelte), so the two can never drift: sadhana, seva and the targets beside what was done.
   *
   * It draws what card.get / card.of already answer and works nothing out of its own: the week's seva is the server's
   * own figure for that week (phase.trend), the week's sadhana the Sadhna they filled, the phase's figures card.score.
   */
  import { weekLabel, addDaysIso, todayIST } from '../lib/dates.js';
  import Seg from '../ui/Seg.svelte';
  import Spark from '../ui/Spark.svelte';

  let { card, months = null, compact = false, id = 'sc', title = 'Scorecard' } = $props();
  let period = $state('week');

  // the week a card opened from a board is the finished one (focusWeek), so it is named for what it is
  const weekWord = $derived(card?.weekId && addDaysIso(card.weekId, 6) < todayIST() ? 'Last week' : 'This week');
  const measures = $derived(card?.measures || []);
  const trend = $derived(card?.phase?.trend || []);
  const weekSeva = $derived(trend.find((w) => w.weekId === card?.weekId)?.pct ?? null);
  const sadhna = $derived(measures.find((m) => m.fromApp));
  const weekSadhana = $derived(sadhna && sadhna.value !== '' && sadhna.value !== null && sadhna.value !== undefined ? Number(sadhna.value) : null);
  const asked = $derived(measures.filter((m) => m.target));
  const filled = $derived(asked.filter((m) => m.value !== '' && m.value !== null && m.value !== undefined).length);
  // the rail lists each target with what was done against it (the card screen has its own two panes for that)
  const lines = $derived(asked.filter((m) => !m.fromApp));
  const pc = (n) => (n === null || n === undefined ? '—' : n + '%');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yes = (m) => (m.frequency === 'MONTHLY' ? (m.monthValue === 'YES' ? 'done' : 'not yet') : m.value === 'YES' ? 'Yes' : m.value === 'NO' ? 'No' : '—');
  const got = (m) => (m.kind === 'YESNO' ? yes(m)
    : `${(m.frequency === 'MONTHLY' ? m.monthValue : m.value) || 0} of ${m.target}${m.unit ? ' ' + m.unit : ''}`);
  const net = $derived(card?.score?.score ?? null);
</script>

<section class="sc" class:sc-hero={!compact} class:sc-compact={compact} aria-labelledby={id + '-h'}>
  <div class="sc-top">
    <h3 class="sc-h" id={id + '-h'}>{title}</h3>
    <Seg id={id + '-period'} label="Period" srLabel options={[['week', weekWord], ['phase', 'This phase']]} value={period} onchange={(v) => (period = v)} />
  </div>

  {#if period === 'week'}
    {#if compact}<p class="sc-when m-0">Week of {weekLabel(card.weekId)}</p>{/if}
    <ul class="sc-figs" aria-label={weekWord}>
      <li><span>Sadhana</span><b>{pc(weekSadhana)}</b></li>
      <li><span>Seva</span><b>{pc(weekSeva)}</b></li>
      <li><span>Filled</span><b>{asked.length ? `${filled} of ${asked.length}` : '—'}</b></li>
    </ul>
    {#if compact}
      {#if lines.length}
        <ul class="sc-lines" aria-label="Targets">
          {#each lines as m (m.measureId)}
            <li><span>{m.label}</span><b>{got(m)}</b></li>
          {/each}
        </ul>
      {:else}<p class="sc-when m-0">No targets set</p>{/if}
    {/if}
  {:else}
    {#if compact}<p class="sc-when m-0">{card.name}</p>{/if}
    <div class="sc-net"><strong>{pc(net)}</strong><span>Net score</span></div>
    <ul class="sc-figs" aria-label="This phase">
      {#each card.score?.parts || [] as p (p.key)}
        <li><span>{p.label}</span><b>{p.reported ? p.value + '%' : 'not set'}</b></li>
      {/each}
    </ul>
    {#if card.phase}<p class="sc-when m-0">Seva · {card.phase.filled} of {card.phase.weeks} weeks filled</p>{/if}
    {#if trend.length > 1}
      <p class="sc-trend m-0">Seva, last {trend.length} weeks <Spark values={trend.map((w) => w.pct)} label={`Seva, last ${trend.length} weeks`} w={compact ? 96 : 120} /></p>
    {/if}
    {#if !compact && months?.length}
      <!-- the month scorecard (ADR 0012 D): each month once it has ended; a month nobody filled reads "not filled" -->
      <h4 class="sc-sub">Month by month</h4>
      <ul class="cd-months" aria-label="Month by month">
        {#each months as mo (mo.month)}
          <li class="cd-mrow">
            <span class="sc-mlabel">{MON[+mo.month.slice(5) - 1]} {mo.month.slice(0, 4)}</span>
            {#if mo.filled}
              <span class="sc-mfig"><small>Sadhana</small>{pc(mo.sadhana)}</span><span class="sc-mfig"><small>Seva</small>{pc(mo.seva)}</span>
              <span class="sc-mfig"><small>Goal</small>{pc(mo.goal)}</span><span class="sc-mfig sc-mnet"><small>Net</small>{pc(mo.net)}</span>
            {:else}<span class="sc-none">not filled</span>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if compact}<a class="btn btn-text btn-sm sc-open" href="#/card">Open my card</a>{/if}
</section>

<style>
  /* a raised card, as every part of the card screen (Card.svelte .cd-sec); the full one leads with the hero wash */
  .sc { display: grid; gap: var(--sp-3); margin-bottom: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--border);
        border-radius: var(--r-lg); background: var(--surface-elevated); box-shadow: inset 0 1px 0 var(--shine), var(--shadow-1); }
  :global(:root[data-tier='low']) .sc { box-shadow: var(--shadow-1); }
  .sc-hero { border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
             background: linear-gradient(160deg, color-mix(in srgb, var(--accent) var(--hero-mix, 14%), var(--surface-elevated)), var(--surface-elevated) 62%); }
  :global(:root[data-theme='dark']) .sc-hero { --hero-mix: 20%; }
  :global(:root[data-tier='low']) .sc-hero { background: var(--accent-soft); }
  .sc-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2) var(--sp-3); }
  .sc-top :global(.field) { flex: 0 1 16rem; min-width: 12rem; margin: 0; }
  .sc-h { position: relative; margin: 0; padding-bottom: 6px; font-size: var(--fs-h3); }
  .sc-h::after { content: ''; position: absolute; left: 0; bottom: 0; width: 40px; height: 2px; border-radius: 1px; background: linear-gradient(90deg, var(--gold-decorative), transparent); }
  .sc-when { color: var(--text-secondary); font-size: var(--fs-sm); }
  .sc-net { display: flex; align-items: baseline; gap: var(--sp-2); }
  .sc-net strong { color: var(--accent); font-family: var(--font-serif); font-size: var(--fs-h1); font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
  .sc-net span { color: var(--text-secondary); font-size: var(--fs-sm); }
  .sc-figs { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: var(--sp-2); margin: 0; padding: 0; list-style: none; }
  .sc-figs li { display: grid; gap: 4px; padding: 8px 10px; border-radius: var(--r-md); background: color-mix(in srgb, var(--surface-elevated) 70%, transparent); }
  .sc-figs span { color: var(--text-secondary); font-size: var(--fs-xs); }
  .sc-figs b { font-variant-numeric: tabular-nums; }
  .sc-trend { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); color: var(--text-secondary); font-size: var(--fs-sm); }
  .sc-sub { margin: var(--sp-2) 0 0; color: var(--text-secondary); font-size: var(--fs-caption); font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }
  .cd-months { margin: 0; padding: 0; list-style: none; }
  .cd-mrow { display: grid; grid-template-columns: minmax(5rem, 1fr) repeat(4, minmax(3.5rem, auto)); align-items: center; gap: var(--sp-2);
             padding: var(--sp-2) 0; border-bottom: 1px solid var(--border); }
  .cd-mrow:last-child { border-bottom: 0; }
  .sc-mlabel { font-weight: 600; }
  .sc-mfig { display: grid; justify-items: end; font-weight: 650; font-variant-numeric: tabular-nums; }
  .sc-mfig small { color: var(--text-secondary); font-size: var(--fs-xs); font-weight: 400; }
  .sc-mnet { color: var(--accent); }
  .sc-none { color: var(--text-secondary); font-size: var(--fs-sm); font-style: italic; }
  .sc-lines { display: grid; margin: 0; padding: 0; list-style: none; }
  .sc-lines li { display: grid; grid-template-columns: minmax(0, 1fr) max-content; align-items: baseline; gap: var(--sp-2);
                 padding: 6px 0; border-bottom: 1px solid var(--divider); font-size: var(--fs-sm); }
  .sc-lines li:last-child { border-bottom: 0; }
  .sc-lines span { min-width: 0; color: var(--text-secondary); text-wrap: pretty; }
  .sc-lines b { font-variant-numeric: tabular-nums; }
  .sc-open { justify-self: start; margin-left: -10px; }
  /* the rail is narrow (220–280 px): the toggle takes its own line, the figures stack label beside figure */
  .sc-compact { gap: var(--sp-2); margin: 0; padding: var(--sp-3); box-shadow: none; background: var(--surface); }
  .sc-compact .sc-top :global(.field) { flex: 1 1 100%; min-width: 0; }
  .sc-compact .sc-h { font-size: var(--fs-body, 1rem); }
  .sc-compact .sc-net strong { font-size: var(--fs-h2); }
  .sc-compact .sc-figs { grid-auto-flow: row; grid-auto-columns: auto; gap: var(--sp-1); }
  .sc-compact .sc-figs li { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); padding: 4px 8px; }
  /* on a phone the parts stack, label and figure on one line each — side by side they read as one word ("Sadhananot set") */
  @media (max-width: 420px) {
    .sc-figs { grid-auto-flow: row; grid-auto-columns: auto; gap: var(--sp-1); }
    .sc-figs li { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); }
    .cd-mrow { grid-template-columns: repeat(4, 1fr); }
    .cd-mrow .sc-mlabel { grid-column: 1 / -1; }
  }
</style>
