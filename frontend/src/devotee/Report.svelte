<script>
  import Status from '../ui/Status.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  // Report: a month calendar coloured by each day's percent, with Activity Score bars for the chosen day or week.
  // Reads only what the app already has (open-week drafts) plus history.list for the month, and week.get for the
  // ONE week the person opens (roadmap 5.4: the month used to cost a week.get per submitted week in view).
  import { session } from '../lib/session.svelte.js';
  import { call } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { homeEntry, loadHome, findWeek } from '../lib/weekstore.js';
  import { getRules, getJournals } from '../lib/refdata.js';
  import { dayMarks, dayPercent } from '$shared/scoring.js';
  import { dayShareText, weekShareText, shareText } from '../lib/share.js';
  import { MONTHS, monthGrid, weeksOfMonth, mondayOf, band, dayBars, weekBars } from '../lib/report.js';
  import { fmtDate, weekLabel, DAY_SHORT } from '../lib/dates.js';
  import { todayIST } from '../lib/validate.js';
  import { cachedMeta } from '../lib/meta.js';
  import Meters from '../ui/Meters.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Trend from '../ui/Trend.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  const login = session.user?.login || '';
  const he = homeEntry();
  const hist = entry('history.list');
  const today = todayIST();
  let year = $state(+today.slice(0, 4));
  let month = $state(+today.slice(5, 7) - 1);
  // view: 'weekly' when opened as History (#/history: History lives in Report since Phase 4, 8 Oct 2026)
  let { view = 'daily' } = $props();
  // svelte-ignore state_referenced_locally
  let mode = $state(view);
  let selDate = $state(today);
  let selWeek = $state('');
  let rules = $state(null);
  let msg = $state('');

  loadHome();
  load('history.list', () => call('history.list', { limit: 26 }));
  // ADR 0013: their own place, once per visit; nothing shows if they had no closed week
  let place = $state(null);
  call('leaderboard.mine').then((r) => (place = r)).catch(() => {});
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const rv = $derived(he.data?.versions?.rules);
  $effect(() => { if (rv) getRules(login, rv).then((r) => (rules = r)).catch(() => {}); });
  const card = $derived(rules?.cards?.[rules.cardName]);

  const years = $derived(Array.from({ length: Math.max(1, +today.slice(0, 4) - 2025) }, (_, i) => 2026 + i));
  const grid = $derived(monthGrid(year, month));
  const weeks = $derived(weeksOfMonth(year, month));
  const histMap = $derived(new Map((hist.data?.weeks || []).map((w) => [w.weekId, w])));
  const submitted = (w) => histMap.get(w)?.status === 'SUBMITTED' || findWeek(he.data, w)?.status === 'SUBMITTED';
  const missedWeek = (w) => histMap.get(w)?.status === 'MISSED';

  // The calendar's squares come from history.list's `dayPct` — the seven days' percentages, which travel with the
  // list itself (roadmap 5.4). This used to fetch week.get once per submitted week in view: up to six extra round
  // trips on opening a month, each a whole week of answers and marks, when seven numbers were wanted.
  //
  // A week is still fetched in full when one is SELECTED (below), because that view shows each day's answers and
  // Share needs the week-end questions. So the month costs one request, and opening a week costs one more.
  const dayPctOf = (w) => histMap.get(w)?.dayPct || null;
  // the whole week, once, when the person opens one (its answers and the week-end questions, which Share needs)
  $effect(() => {
    const key = 'week.get:' + selWeek;
    if (selWeek && submitted(selWeek) && !entry(key).data) load(key, () => call('week.get', { weekId: selWeek }));
  });
  const sub = (w) => entry('week.get:' + w).data;
  // a week still being filled: the average of the rounds filled so far (moved here from the weekly form, 3 Oct 2026)
  function roundsSoFar(w) {
    const r = (findWeek(he.data, w)?.days || []).map((d) => d.day?.rounds).filter((x) => Number.isInteger(x));
    return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
  }

  function dayInfo(date) {
    const wk = mondayOf(date), idx = Math.round((Date.parse(date) - Date.parse(wk)) / 864e5);
    const s = sub(wk);
    // the full week if it happens to be loaded (a selected week), otherwise the percentage from the history
    if (s?.days && s.marks?.[idx]) return { source: 'submitted', marks: s.marks[idx], day: s.days[idx], percent: dayPercent(s.marks[idx]).percent };
    const pct = dayPctOf(wk);
    if (pct && submitted(wk)) return { source: 'submitted', marks: null, day: null, percent: pct[idx] ?? 0 };
    const hw = findWeek(he.data, wk);
    if (hw && hw.status !== 'SUBMITTED') {
      const d = hw.days[idx];
      if (d && d.state !== 'empty' && card) { const marks = dayMarks(card, { ...d.day }); return { source: 'draft', marks, day: d.day, percent: dayPercent(marks).percent }; }
    }
    if (missedWeek(wk)) return { source: 'missed' };
    // a past day of an open week that nobody filled: amber "Missing" (8 Oct 2026)
    if (hw && hw.status !== 'SUBMITTED' && hw.days[idx]?.state === 'empty' && !hw.days[idx]?.future && date < today) return { source: 'missing' };
    return null;
  }
  const info = $derived(selDate ? dayInfo(selDate) : null);
  /* C6 (22 Oct 2026): the month in numbers beside its calendar — from the same day percentages the squares are
     coloured by (history.list's dayPct and the open weeks' drafts), so no new read. Days up to today only. */
  const monthNums = $derived.by(() => {
    const days = grid.flat().filter((d) => d && d <= today);
    let filled = 0, sum = 0, best = null, run = 0, longest = 0;
    for (const d of days) {
      const p = dayInfo(d)?.percent;
      if (p === undefined || p === null) { run = 0; continue; }
      filled++; sum += p; run++; longest = Math.max(longest, run);
      if (!best || p > best.p) best = { d, p };
    }
    return { filled, of: days.length, avg: filled ? Math.round(sum / filled) : null, best, longest };
  });
  const loadingWeeks = $derived(!hist.data && !hist.error);

  async function ctx() {
    let j = null;
    try { j = await getJournals(login, he.data?.versions?.journals); } catch { /* titles fall back to ids */ }
    const lect = new Map((j?.lectures || []).map((l) => [l.lectureId, l.title])), bk = new Map((j?.books || []).map((b) => [b.bookId, b.title]));
    const id = he.data?.profile?.batchId;
    return { card, batchName: (cachedMeta().batches || []).find((b) => b.batchId === id)?.name || id, lectureTitle: (x) => lect.get(x), bookTitle: (x) => bk.get(x) };
  }
  async function shareDay() {
    const r = await shareText(dayShareText(info.day, selDate, await ctx()));
    msg = r === 'copied' ? 'Copied' : r === 'failed' ? 'Could not share' : '';
  }
  async function shareWeek() {
    const w = sub(selWeek);
    const r = await shareText(weekShareText(selWeek, w.scores, w.weekEnd, await ctx()));
    msg = r === 'copied' ? 'Copied' : r === 'failed' ? 'Could not share' : '';
  }
  // a missed week counts 0 in the trend (4 Oct 2026)
  /* C3 (22 Oct 2026): the latest score counts up as it first shows — on a high-tier phone only; everyone else sees the
     number at once, and a screen reader hears only the number (lib/countup.js) */
  let shownLast = $state(null), countedFor = null;
  $effect(() => {
    const v = lastSub?.overall;
    if (v === null || v === undefined || v === countedFor) return;
    countedFor = v;
    import('../lib/countup.js').then((m) => m.countUp(v, (x) => (shownLast = x), { tiers: ['high'] }));
  });
  const trend = $derived((hist.data?.weeks || []).filter((w) => (w.status === 'SUBMITTED' && w.overall !== null) || w.status === 'MISSED').map((w) => (w.status === 'MISSED' ? { ...w, overall: 0 } : w)).sort((a, b) => (a.weekId < b.weekId ? -1 : 1)).slice(-12));
  const yn = (v) => (v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : '-');
  const selSub = $derived(selWeek ? sub(selWeek) : null);
  // the newest submitted week leads the screen (history.list is newest first); the same numbers as History
  const lastSub = $derived((hist.data?.weeks || []).find((w) => w.status === 'SUBMITTED'));
  // one sentence that says what the numbers mean (Phase 4): the change on the week before, and the stronger half
  const prevSub = $derived((hist.data?.weeks || []).filter((w) => w.status === 'SUBMITTED')[1]);
  const insight = $derived.by(() => {
    if (!lastSub) return '';
    const d = prevSub ? lastSub.overall - prevSub.overall : null;
    const ch = d === null ? '' : d > 0 ? `Up ${d} point${d === 1 ? '' : 's'} on the week before. ` : d < 0 ? `Down ${-d} point${d === -1 ? '' : 's'} on the week before. ` : 'The same as the week before. ';
    const hi = lastSub.body >= lastSub.soul ? ['Body', lastSub.body, 'Soul', lastSub.soul] : ['Soul', lastSub.soul, 'Body', lastSub.body];
    return ch + (hi[1] === hi[3] ? `Body and Soul were level (${hi[1]}%).` : `${hi[0]} was the stronger half (${hi[1]}%); ${hi[2]} ${hi[3]}%.`);
  });
</script>

{#if lastSub}
  <!-- what matters first: the latest result and the direction over the last weeks; the calendar below is for looking closer -->
  <section class="cblock rp-sum" aria-labelledby="h-last">
    <div class="rp-g">
      <div class="rp-last">
        <h2 id="h-last" class="t-over acc m-0">Last submitted week</h2>
        <p class="bignum m-0 mt-2"><span aria-hidden="true">{shownLast ?? lastSub.overall}</span><span class="sr-only">{lastSub.overall}</span><small>%</small></p>
        <p class="m-0 mt-1"><a class="ilink font-semibold" href={'#/history/' + lastSub.weekId}>Week of {weekLabel(lastSub.weekId)}</a></p>
        <p class="m-0 text-sm text-muted">Body {lastSub.body}% · Soul {lastSub.soul}%{(lastSub.daysFilled ?? 7) < 7 ? ` · ${lastSub.daysFilled} of 7 days` : ''}</p>
        <p class="rp-insight">{insight}</p>
        <!-- ADR 0013: their own place in their batch for the last closed week — a position, never anyone else's name or
             score. Its own block (prompt-5b's D lane merges around it); leaderboard.mine is one small call, made here only. -->
        {#if place?.rank}<p class="rp-place m-0 mt-2"><Icon name="report" size={16} />{ordinal(place.rank)} of {place.of} in your batch · week of {weekLabel(place.weekId)}</p>{/if}
      </div>
      <div class="min-w-0">
        <h3 class="t-over m-0 mb-2">Your weekly trend</h3>
        {#if trend.length > 1}<Trend weeks={trend} />
        {:else}<p class="m-0 text-sm text-muted">Shown after two submitted weeks.</p>{/if}
      </div>
    </div>
  </section>
{/if}

<!-- G12 (22 Oct 2026): the Daily / Weekly switch says which; the heading stays for screen-reader navigation only -->
<h2 class="sr-only">{mode === 'daily' ? 'Day by day' : 'Week by week'}</h2>

<!-- one compact row: month · year · Daily / Weekly -->
<div class="rp-bar" role="group" aria-label="What to show">
  <!-- month and year on wheels; the month wheel goes round (December → January) -->
  <!-- Daily / Weekly first: what to look at, then when (8 Oct 2026) -->
  <div class="seg rp-mode" id="rp-mode" role="group" aria-label="View">
    {#each [['daily', 'Daily'], ['weekly', 'Weekly']] as [v, t]}<button type="button" aria-pressed={mode === v} onclick={() => (mode = v)}>{t}</button>{/each}
  </div>
  <WheelSelect id="rp-m" label="Month" srLabel class="mb-0 rp-wsel" value={String(month)} options={MONTHS.map((m, i) => [String(i), m])} circular onchange={(v) => { month = +v; selWeek = ''; }} />
  <WheelSelect id="rp-y" label="Year" srLabel class="mb-0 rp-wsel" value={String(year)} options={years.map((y) => [String(y), String(y)])} onchange={(v) => { year = +v; selWeek = ''; }} />
</div>
{#if hist.error && !hist.data}<Banner onretry={() => load('history.list', () => call('history.list', { limit: 26 }), { force: true })}>Could not load your history.</Banner>{/if}

<div class="grid2 rp-grid">
  {#if mode === 'daily'}
    <section class="section" aria-labelledby="h-cal">
      <h3 id="h-cal" class="sr-only">{MONTHS[month]} {year}</h3>
      <!-- a group of day buttons (each says its date and score); the weekday letters are for the eye only -->
      <div class="cal" role="group" aria-label={`Days of ${MONTHS[month]} ${year}`}>
        {#each DAY_SHORT as d}<span class="cal-h" aria-hidden="true">{d.slice(0, 1)}</span>{/each}
        {#each grid.flat() as date}
          {#if date}
            {@const di = dayInfo(date)}
            <button type="button" class="cal-d {di?.source === 'missed' || di?.source === 'missing' ? di.source : band(di?.percent)}" class:cal-today={date === today} aria-pressed={selDate === date}
              aria-label={fmtDate(date) + (di?.percent !== undefined ? ', ' + di.percent + ' percent' : di?.source === 'missed' ? ', not submitted' : di?.source === 'missing' ? ', missing, not filled' : ', no record')} onclick={() => { selDate = date; msg = ''; }}>
              {+date.slice(8)}
            </button>
          {:else}<span></span>{/if}
        {/each}
      </div>
      <!-- two short rows (Phase 4): the score colours, then the two kinds of empty day; each fits a 320 px phone -->
      <ul class="cal-key" aria-label="Score colours">
        <li><i class="p-hi"></i>80%+</li><li><i class="p-mid"></i>50–79%</li><li><i class="p-lo"></i>&lt;50%</li>
      </ul>
      <ul class="cal-key cal-key-2" aria-label="Empty days">
        <li><i class="missing"></i>Missing · open</li><li><i class="missed"></i>Missed</li>
      </ul>
      {#if monthNums.of}
        <ul class="rp-nums" aria-label={`${MONTHS[month]} in numbers`}>
          <li class="stat"><span>Days filled</span><b>{monthNums.filled}<small>{' '}of {monthNums.of}</small></b></li>
          <li class="stat"><span>Average</span><b>{monthNums.avg ?? '–'}{#if monthNums.avg !== null}<small>%</small>{/if}</b></li>
          <li class="stat"><span>Best day</span><b>{monthNums.best ? monthNums.best.p : '–'}{#if monthNums.best}<small>%{' '}· {+monthNums.best.d.slice(8)} {MONTHS[month].slice(0, 3)}</small>{/if}</b></li>
          <li class="stat"><span>Longest run</span><b>{monthNums.longest}<small>{' '}day{monthNums.longest === 1 ? '' : 's'}</small></b></li>
        </ul>
      {/if}
    </section>

    <section class="section" aria-labelledby="h-act">
      <h3 id="h-act"><Icon name="report" />Activity score</h3>
      {#if loadingWeeks && !info}<Skeleton rows={2} />
      {:else if info?.marks}
        <p class="m-0 mb-4 text-sm text-muted">{fmtDate(selDate)}{info.source === 'draft' ? ' · not submitted yet' : ''}</p>
        <Meters items={dayBars(info.marks, info.percent)} title="Activity score" />
        <button type="button" class="btn btn-primary mt-4" onclick={shareDay}><Icon name="share" size={18} />Share</button>
        <p class="hint min-h-5 text-center" role="status">{msg}</p>
      {:else if info?.source === 'missing'}
        <EmptyState icon="edit" title={fmtDate(selDate) + ' is missing'}>This day was not filled.{#snippet action()}<a class="btn" href={`#/day/${mondayOf(selDate)}/${selDate}`}>Fill it now</a>{/snippet}</EmptyState>
      {:else if info?.source === 'missed'}
        <EmptyState icon="clock" title={fmtDate(selDate)}>Not submitted in time.</EmptyState>
      {:else}
        <EmptyState icon="report" title={'No record for ' + fmtDate(selDate)} />
      {/if}
    </section>
  {:else}
    <section class="section" aria-labelledby="h-wk">
      <h3 id="h-wk"><Icon name="week" />Weeks of {MONTHS[month]} {year}</h3>
      <ul class="m-0 grid list-none gap-2 p-0">
        {#each weeks as w (w)}
          {@const h = histMap.get(w)}
          <li>
            <button type="button" class="action w-full text-left" aria-pressed={selWeek === w} onclick={() => { selWeek = w; msg = ''; }}>
              <span class="ico"><Icon name={missedWeek(w) ? 'clock' : 'check'} /></span>
              <span class="flex-1 font-medium">{weekLabel(w)}</span>
              {#if h?.status === 'SUBMITTED'}<b class="serif text-xl text-brand">{h.overall}%</b>{:else if missedWeek(w)}<Status tone="bad" label="Missed · 0%" />{:else if findWeek(he.data, w)}<Status tone="warn" label="In progress" />{:else}<span class="text-sm text-muted">&ndash;</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
    <section class="section" aria-labelledby="h-wa">
      <h3 id="h-wa" class="justify-center"><Icon name="report" />Weekly score</h3>
      {#if selSub?.scores}
        <p class="center m-0 mb-3 text-sm text-muted">Week of {weekLabel(selWeek)}</p>
        <Meters items={weekBars(selSub.scores)} title="Weekly scores" />
        <dl class="kv mt-4">
          <dt>Average rounds</dt><dd>{selSub.weekEnd?.chantingAverage ?? '–'}</dd>
          <dt>Night Stay</dt><dd>{yn(selSub.weekEnd?.nightStay)}</dd>
          <dt>4 regulative principles</dt><dd>{yn(selSub.weekEnd?.principles)}</dd>
        </dl>
        <button type="button" class="btn btn-primary mt-4" onclick={shareWeek}><Icon name="share" size={18} />Share</button>
        <p class="hint min-h-5 text-center" role="status">{msg}</p>
      {:else if selWeek && missedWeek(selWeek)}
        <EmptyState icon="clock" title="Not submitted in time" />
      {:else if selWeek && submitted(selWeek)}<Skeleton rows={2} />
      {:else}
        <EmptyState icon="report" title={selWeek ? 'Not submitted yet' : 'Choose a week'}>{#if selWeek && roundsSoFar(selWeek) !== null}Average rounds so far: <b>{roundsSoFar(selWeek)}</b>{/if}</EmptyState>
      {/if}
    </section>
  {/if}
</div>
{#if mode === 'weekly'}
  <!-- every week, newest first (what was the History screen) -->
  <div class="block-h mt-2"><h2>All your weeks</h2></div>
  {#await import('./History.svelte') then H}<H.default />{/await}
{/if}

<style>
  .rp-sum { container-type: inline-size; }
  /* the calendar and the day's score side by side only where both have room: at a tablet's width the score card sat as a
     230 px block beside a 540 px calendar (Phase 24, V21) */
  @media (min-width: 768px) and (max-width: 1023px) { .rp-grid { grid-template-columns: minmax(0, 1fr); } }
  .rp-nums { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: var(--sp-4) 0 0; padding: 0; list-style: none; }
  @media (min-width: 1024px) { .rp-nums { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .rp-nums b small { font-family: var(--font-sans); font-size: var(--fs-caption); font-weight: 500; color: var(--text-muted); }
  .rp-g { display: grid; gap: var(--sp-5); }
  @container (min-width: 640px) { .rp-g { grid-template-columns: minmax(190px, 1fr) minmax(0, 2.2fr); align-items: start; } }
  .rp-last :global(.bignum small) { font-size: 0.55em; color: var(--text-muted); }
  :global(.rp-wsel .wsel) { min-height: var(--ctl-h); border-radius: 999px; padding-inline: 14px; font-weight: 600; }
  :global(.rp-wsel) { min-width: 0; }
  .rp-insight { margin: var(--sp-2) 0 0; font-size: var(--fs-sm); color: var(--text-secondary); }
</style>
