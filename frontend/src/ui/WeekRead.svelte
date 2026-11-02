<script>
  // One devotee's week, READ-ONLY (4 Oct 2026: viewing a devotee's sadhana is its own permission, apart from filling it).
  // Used by a facilitator (fac.week, their devotees) and by staff (devotees.week: a coordinator the open week, the IYF
  // head any week). A submitted week: the scores as bars, each day's percent, the week-end answers. A week being filled:
  // how far each day is.
  import Status from './Status.svelte';
  import { call, errorMessage } from '../lib/api.js';
  import { weekBars, dayBars, band, daySummary } from '../lib/report.js';
  import { weekLabel, fmtShort, fmtLong, fmt12, DAY_LONG } from '../lib/dates.js';
  import { dayPercent } from '$shared/scoring.js';
  import Bars from './Bars.svelte';
  import Meters from './Meters.svelte';
  import Icon from './Icon.svelte';
  import { untrack } from 'svelte';
  import { swipe } from '../lib/swipe.js';
  import { mondayIST, STATUS, band as band5 } from '../lib/staff.js';
  import Banner from './Banner.svelte';
  import Skeleton from './Skeleton.svelte';
  import EmptyState from './EmptyState.svelte';
  import DayPractice from './DayPractice.svelte';
  // name: the devotee's, when the screen that opened this already has it (no extra call)
  let { action, login, weekId, name = '' } = $props();
  // a day's report: tap a day to see its activity bars (the head, 4 Oct 2026: reports by day and by week)
  let openDay = $state(-1);
  let w = $state(null), error = $state('');
  // refetched when the week changes (the ‹ › stepper keeps this screen and changes its week)
  $effect(() => { const a = action, l = login, wk = weekId; untrack(() => { w = null; error = ''; openDay = -1; call(a, a === 'share.week' ? { id: l, weekId: wk } : { login: l, weekId: wk }).then((r) => { if (wk === weekId) w = r; }).catch((e) => (error = errorMessage(e))); }); });
  // `login` is the share's id for share.week (a shared sadhana is reached by its id, never the owner's phone)
  // where a week of this person opens (a facilitator's, a shared sadhana's or a coordinator's route); never past this week
  const hrefOf = (wk) => (action === 'fac.week' ? `#/my-devotees/${encodeURIComponent(login)}/${wk}` : action === 'share.week' ? `#/shared/${encodeURIComponent(login)}/${wk}` : `#/devotee/${encodeURIComponent(login)}/week/${wk}`);
  const prevW = $derived(plus(weekId, -7)), nextW = $derived(plus(weekId, 7));
  const hasNext = $derived(nextW <= mondayIST());
  // a coordinator may fill a week that is open and not submitted (the same rule as the batch board)
  const canFill = $derived(action === 'devotees.week' && w && ['DRAFT', 'NOT_STARTED', 'REOPENED'].includes(w.status));
  const overall = $derived(w?.status === 'SUBMITTED' ? weekBars(w.scores)[0].value : null);
  const plus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const STATE = { complete: 'Filled', partial: 'Part filled', empty: 'Not filled' };
  const yn = (v) => (v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : '–');
  // a submitted part week (4 Oct 2026): a day left out has no answers and no marks
  // 95 → "1 hr 35 min", 45 → "45 min", 0 → "none"
  const mins = (n) => (!n ? 'none' : n < 60 ? `${n} min` : `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ''}`);
  const leftOut = (i) => w.status === 'SUBMITTED' && !Object.keys(w.days?.[i] || {}).length;
  const marksOf = (i) => (leftOut(i) ? null : (w.status === 'SUBMITTED' ? w.marks?.[i] : w.days?.[i]?.marks) || null);
</script>

{#snippet dayList()}
  <ul class="wr-days" aria-label="Day by day">
    {#each w.days as d, i}
      {@const mk = marksOf(i)}
      {@const p = mk ? dayPercent(mk).percent : null}
      {@const sum = w.status === 'SUBMITTED' ? daySummary(w.days?.[i], fmt12) : ''}
      <li>
        <button type="button" class="wr-day" disabled={!mk} aria-expanded={openDay === i} onclick={() => (openDay = openDay === i ? -1 : i)}>
          <span class="wr-dname">{DAY_LONG[i]}, {fmtShort(plus(w.weekId, i))}{#if sum}<small>{sum}</small>{/if}</span>
          {#if leftOut(i)}<Status label="Not filled" />
          {:else if w.status !== 'SUBMITTED' && d.state !== 'complete'}<Status tone={d.state === 'partial' ? 'warn' : ''} label={STATE[d.state]} />{/if}
          <b class="cal-pill {band(p)}">{p === null ? '–' : p + '%'}</b>
          <!-- the row opens the day: say so with a turning chevron (no chevron when there is nothing to open) -->
          <span class="wr-chev" aria-hidden="true"></span>
        </button>
        {#if openDay === i && mk}
          <!-- the day's scores, and beside them (below on a phone) what was heard and read that day -->
          <div class="wr-dayrep" role="region" aria-label={`${fmtLong(plus(w.weekId, i))}${name ? ', ' + name : ''}`}>
            <p class="wr-dayh">{fmtLong(plus(w.weekId, i))}{#if name}<span>{' · ' + name}</span>{/if}</p>
            <div class="wr-split">
              <Bars items={dayBars(mk, p)} title={'Activity score, ' + DAY_LONG[i]} />
              <DayPractice day={w.status === 'SUBMITTED' ? w.days[i] : null} />
            </div>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<!-- the week stepper stays while the week loads -->
<nav class="wr-step" aria-label="Weeks">
  <a class="btn btn-text btn-sm" data-step="prev" href={hrefOf(prevW)} aria-label={'Week of ' + weekLabel(prevW)}><Icon name="back" size={16} />Earlier</a>
  <span class="wr-wk">Week of {weekLabel(weekId)}</span>
  {#if hasNext}<a class="btn btn-text btn-sm" data-step="next" href={hrefOf(nextW)} aria-label={'Week of ' + weekLabel(nextW)}>Later<Icon name="next" size={16} /></a>{:else}<span class="wr-sp"></span>{/if}
</nav>
{#if error}<Banner>{error}</Banner>
{:else if !w}<Skeleton rows={3} />
{:else}
  {@const [sl, st] = STATUS[w.status] || [w.status, '']}
  <section class="section" aria-labelledby="wr-h" {@attach swipe((d) => { if (d < 0) location.hash = hrefOf(prevW); else if (hasNext) location.hash = hrefOf(nextW); })}>
    <div class="wr-head">
      <div class="min-w-0">
        {#if name}<p class="t-over acc m-0">{name}</p>{/if}
        <h2 id="wr-h" class="m-0">Week of {weekLabel(w.weekId)}</h2>
        <p class="m-0 mt-1 flex flex-wrap items-center gap-2"><Status tone={st} label={sl} />{#if w.status === 'SUBMITTED' && (w.daysFilled ?? 7) < 7}<span class="text-sm text-muted">{w.daysFilled} of 7 days · the others count 0</span>{/if}</p>
      </div>
      {#if overall !== null}<span class="score-pill wr-ov" data-b={band5(overall)}>{overall}%</span>{/if}
      {#if canFill}<a class="btn btn-sm" href={`#/fill/${encodeURIComponent(login)}/week/${w.weekId}${name ? '?n=' + encodeURIComponent(name) : ''}`}>Fill for {name ? name.split(' ')[0] : 'them'}<Icon name="next" size={16} /></a>{/if}
    </div>
    {#if w.status === 'SUBMITTED'}
      <div class="wr-body">
        <div><Meters items={weekBars(w.scores)} title="Weekly scores" /></div>
        <div>
          {@render dayList()}
          <!-- the week-end answers, three small tiles -->
          <ul class="wr-tiles" aria-label="End of week">
            <li><span>Average rounds</span><b>{w.weekEnd?.chantingAverage ?? '–'}</b></li>
            <li><span>Night Stay</span><b>{yn(w.weekEnd?.nightStay)}</b></li>
            <li><span>4 principles</span><b>{yn(w.weekEnd?.principles)}</b></li>
          </ul>
          <!-- what they read and heard this week, by title (the user, 12 Oct 2026): shown while the week was being
               filled, it disappeared on Submit — the moment a facilitator actually reads the week. Same lines as below. -->
          {#if w.summary?.reading && (w.summary.reading.books.length || w.summary.reading.minutes)}
            <p class="wr-sofar-l"><span>Reading</span> {mins(w.summary.reading.minutes)}{#if w.summary.reading.books.length}{' · '}{w.summary.reading.books.join(', ')}{/if}</p>
          {/if}
          {#if w.summary?.hearing && (w.summary.hearing.lectures.length || w.summary.hearing.minutes)}
            <p class="wr-sofar-l"><span>Hearing</span> {mins(w.summary.hearing.minutes)}{#if w.summary.hearing.lectures.length}{' · '}{w.summary.hearing.lectures.join(', ')}{/if}</p>
          {/if}
        </div>
      </div>
    {:else if w.status === 'MISSED'}
      <EmptyState icon="clock" title="Missed · score 0">No complete day by the deadline{w.daysFilled ? ` (${w.daysFilled} of 7 days begun)` : ''}.</EmptyState>
    {:else}
      <p class="m-0 mt-2 text-sm text-muted">{w.status === 'NOT_STARTED' ? 'Not started yet' : 'Being filled · not submitted yet'}</p>
      <!-- how the week is going so far (the user, 11 Oct 2026): a facilitator should see the gist without
           adding the days up. Scored the same way as the final week, so this number never disagrees with
           the one after Submit — it only rises as more days are filled. -->
      {#if w.summary}
        {@const sm = w.summary}
        <section class="wr-sofar" aria-label="How the week is going">
          <p class="wr-sofar-h">
            <span class="score-pill" data-b={band5(Math.min(100, Math.round((sm.overall * 7) / Math.max(1, sm.daysFilled))))}>{sm.overall}%</span>
            <span>so far · {sm.daysFilled} of 7 days filled</span>
          </p>
          <ul class="wr-sofar-g">
            <li><span>Body</span><b>{sm.body}%</b></li>
            <li><span>Soul</span><b>{sm.soul}%</b></li>
            <li><span>Japa</span><b>{sm.japa.rounds} rounds</b><i>on {sm.japa.days} {sm.japa.days === 1 ? 'day' : 'days'}</i></li>
            <li><span>Seva</span><b>{mins(sm.seva.minutes)}</b><i>&nbsp;</i></li>
          </ul>
          {#if sm.reading.books.length || sm.reading.minutes}
            <p class="wr-sofar-l"><span>Reading</span> {mins(sm.reading.minutes)}{#if sm.reading.books.length}{' · '}{sm.reading.books.join(', ')}{/if}</p>
          {/if}
          {#if sm.hearing.lectures.length || sm.hearing.minutes}
            <p class="wr-sofar-l"><span>Hearing</span> {mins(sm.hearing.minutes)}{#if sm.hearing.lectures.length}{' · '}{sm.hearing.lectures.join(', ')}{/if}</p>
          {/if}
          <p class="wr-sofar-n">Attendance and the end-of-week answers come when they submit.</p>
        </section>
      {/if}
      {@render dayList()}
    {/if}
  </section>
{/if}

<style>
  .wr-step { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; margin-bottom: var(--sp-3); }
  .wr-wk { text-align: center; font-weight: 600; font-size: var(--fs-sm); }
  .wr-sp { width: 1px; }
  .wr-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
  .wr-head > div { flex: 1 1 200px; }
  .wr-ov { font-size: 1.125rem; padding: 4px 12px; }
  .wr-body { display: grid; gap: var(--sp-4); margin-top: var(--sp-4); }
  @media (min-width: 1024px) { .wr-body { grid-template-columns: 340px minmax(0, 1fr); align-items: start; } .wr-body .wr-days { margin-top: 0; } }
  .wr-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: var(--sp-4) 0 0; padding: 0; list-style: none; }
  .wr-tiles li { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: var(--r-md); background: var(--surface-2); }
  .wr-tiles span { font-size: var(--fs-caption); color: var(--text-muted); }
  .wr-tiles b { font-size: 1.0625rem; font-variant-numeric: tabular-nums; }
  /* how the week is going so far — a preview, so it is quieter than the submitted week's meters */
  .wr-sofar { margin: var(--sp-3) 0 0; padding: var(--sp-3); border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
  .wr-sofar-h { display: flex; align-items: center; gap: 10px; margin: 0 0 var(--sp-3); font-size: var(--fs-sm); color: var(--text-secondary); }
  .wr-sofar-g { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
  .wr-sofar-g li { display: flex; flex-direction: column; gap: 1px; }
  .wr-sofar-g span { font-size: var(--fs-caption); color: var(--text-muted); }
  .wr-sofar-g b { font-size: 1rem; font-variant-numeric: tabular-nums; }
  .wr-sofar-g i { font-size: var(--fs-caption); font-style: normal; color: var(--text-muted); }
  .wr-sofar-l { margin: var(--sp-3) 0 0; font-size: var(--fs-sm); line-height: 1.45; overflow-wrap: anywhere; }
  .wr-sofar-l span { color: var(--text-muted); }
  .wr-sofar-n { margin: var(--sp-3) 0 0; font-size: var(--fs-caption); color: var(--text-muted); }
  @media (max-width: 420px) { .wr-sofar-g { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 12px; } }
  .wr-days { list-style: none; margin: 14px 0 0; padding: 0; border-top: 1px solid var(--border); }
  .wr-days li { border-bottom: 1px solid var(--border); font-size: var(--fs-sm); }
  .wr-day { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 0 4px; border: 0; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  .wr-day > span:first-child { flex: 1; min-width: 0; padding-block: 8px; }
  .wr-dname small { display: block; margin-top: 2px; font-size: var(--fs-caption); color: var(--text-muted); line-height: 1.35; overflow-wrap: anywhere; }
  .wr-day:disabled { cursor: default; }
  @media (hover: hover) { .wr-day:not(:disabled):hover { background: var(--surface-2); } }
  .wr-chev { flex: none; width: 8px; height: 8px; margin: 0 6px 3px 2px; border: solid var(--text-muted); border-width: 0 2px 2px 0; transform: rotate(45deg); transition: transform var(--d-2) var(--ease); }
  .wr-day[aria-expanded='true'] .wr-chev { transform: translateY(3px) rotate(225deg); }
  .wr-day:disabled .wr-chev { visibility: hidden; }
  .wr-dayrep { padding: 6px 0 14px; container-type: inline-size; }
  .wr-dayh { margin: 0 0 8px; font-size: var(--fs-caption); font-weight: 650; color: var(--text-secondary); overflow-wrap: anywhere; }
  .wr-split { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); align-items: start; }
  /* 520, not 560 (Phase 24): with the desktop's real 32 px margins (V14) the submitted week's day column at 1280 is 538 px */
  @container (min-width: 520px) { .wr-split { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); } }
  .cal-pill { min-width: 52px; padding: 2px 8px; border-radius: 999px; text-align: center; font-variant-numeric: tabular-nums; background: var(--surface-2); }
  .cal-pill.p-hi { background: var(--ok-soft); color: var(--ok); }
  .cal-pill.p-mid { background: var(--warn-soft); color: var(--warn); }
  .cal-pill.p-lo { background: var(--danger-soft); color: var(--danger); }
</style>
