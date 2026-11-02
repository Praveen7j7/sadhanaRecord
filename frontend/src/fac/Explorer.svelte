<script>
  /*
   * The promotion explorer (phase 21, 23 Oct 2026; the head: "a promotion explorer … which gives list of students under
   * them eligible for promotion across the batches … with default parameters selected, and on top of that they can even
   * use their custom selection like the way explorer is implemented in the spiritual dashboard sheet").
   *
   * As the sheet's "Promotion Explorer" tab: a route, then per criterion an on/off tick and a threshold of their own
   * (blank = the rule), all of them ANDed, with "N meet · M have data" beside each. Here they also choose the period.
   * fac.eligible sends every figure once per period; the ticks and thresholds are worked out here, so trying a what-if
   * costs no request. Kept in the 2-minute read cache: a return visit draws at once.
   */
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load as cacheLoad } from '../lib/cache.svelte.js';
  import { fmtDate } from '../lib/dates.js';
  import { pressedInView } from '../lib/chips.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Seg from '../ui/Seg.svelte';
  import Icon from '../ui/Icon.svelte';

  const PERIODS = [['phase', 'Phase so far'], ['week', 'Last week'], ['month', 'Last 4 weeks'], ['year', 'Last 52 weeks'], ['custom', 'Custom']];
  const LEVEL = { VL2: 'VL-2', VL3: 'VL-3', SPS: 'SPS', DPS: 'DPS', BSS: 'BSS', BVS: 'BVS' };
  const ORDER = ['att', 'chant', 'sad', 'night', 'cls', 'pr'];
  const ORDER_L = ['VL2', 'VL3', 'SPS', 'DPS', 'BSS'];
  // fractions (attendance, night stay) are typed and shown as a percentage, the rest as they are
  const PCT = new Set(['att', 'night']);

  let period = $state('phase'), from = $state(''), to = $state(''), applied = $state({ from: '', to: '' });
  let route = $state('');                         // '' = every student, judged by their own batch's rule
  let on = $state({}), mine = $state({});         // per criterion: applied?, and their own threshold ('' = the rule)
  let show = $state('ready');                     // 'ready' | 'all'

  const key = $derived(`fac.eligible:${period}:${period === 'custom' ? applied.from + '|' + applied.to : ''}`);
  const e = $derived(entry(key));
  const d = $derived(e.data);
  $effect(() => {
    const k = key;
    if (period === 'custom' && !(applied.from && applied.to)) return;
    cacheLoad(k, () => call('fac.eligible', { period, ...(period === 'custom' ? { from: applied.from, to: applied.to } : {}) }));
  });

  const students = $derived(d?.students || []);
  const routes = $derived([...new Set(students.map((s) => s.level))].sort((a, b) => ORDER_L.indexOf(a) - ORDER_L.indexOf(b)));
  const routeLabel = (lv) => `${LEVEL[lv] || lv} → ${(students.find((s) => s.level === lv)?.next || []).map((x) => LEVEL[x] || x).join(' / ')}`;
  // the route's rule: the batch rule of its students (the first one's; a batch with its own rule shows when it differs)
  const ruleOf = $derived(route ? students.find((s) => s.level === route)?.rule || {} : {});
  // every criterion the app measures, for any route: the rule's own start ticked, the others can be added (the head:
  // "one can set and edit the parameters and conditions to check the updated list")
  const keys = ORDER;
  // a new route starts from its rule: every criterion on, no thresholds of their own
  $effect(() => { route; on = Object.fromEntries(ORDER.map((k) => [k, k in ruleOf])); mine = {}; });

  const fmt = (k, v) => (v === null || v === undefined ? '—' : k === 'pr' ? (v === 'YES' ? 'Yes' : 'No') : PCT.has(k) ? Math.round(v * 100) + '%' : String(v));
  /** The threshold in use for a criterion: their own (typed as a % for fractions), else the rule. */
  function inUse(k, rule) {
    const t = String(mine[k] ?? '').trim();
    if (k === 'pr') return rule.pr || 'YES';              // the principles are kept or not: Yes is the only threshold
    if (t === '' || !Number.isFinite(Number(t))) return rule[k];   // undefined for a criterion outside the rule, until typed
    return PCT.has(k) ? Number(t) / 100 : Number(t);
  }
  const meets = (k, got, min) => got !== null && got !== undefined && (k === 'pr' ? got === min : Number(got) >= Number(min));
  /** One student's checks: with a route chosen, the criteria ticked there (and their thresholds); otherwise their rule. */
  function checks(s) {
    const rule = s.rule || {};
    // a criterion added from outside the rule counts once it has a threshold
    const ks = route ? keys.filter((k) => on[k] && inUse(k, rule) !== undefined) : ORDER.filter((k) => k in rule);
    return ks.map((k) => { const min = route ? inUse(k, rule) : rule[k]; return { k, min, got: s.figures?.[k] ?? null, met: meets(k, s.figures?.[k], min) }; });
  }
  const judged = $derived((route ? students.filter((s) => s.level === route) : students).map((s) => {
    const c = checks(s);
    return { ...s, checks: c, ready: c.length > 0 && c.every((x) => x.met) };
  }));
  const ready = $derived(judged.filter((s) => s.ready));
  const listed = $derived(show === 'ready' ? ready : judged);
  // the sheet's counts beside each criterion: who meets it, and who has a figure for it at all
  const counts = (k) => { const pool = judged; const min = inUse(k, ruleOf); return { meet: pool.filter((s) => meets(k, s.figures?.[k], min)).length, data: pool.filter((s) => s.figures?.[k] !== null && s.figures?.[k] !== undefined).length }; };
</script>

<div class="page-read">
  <section class="cblock" aria-labelledby="ex-p">
    <h2 id="ex-p" class="t-over m-0 mb-2">Period</h2>
    <div class="chiprow one-line mb-1" role="group" aria-label="Period" {@attach pressedInView}>
      {#each PERIODS as [v, t] (v)}<button type="button" class="chipbtn" aria-pressed={period === v} onclick={() => (period = v)}>{t}</button>{/each}
    </div>
    {#if period === 'custom'}
      <div class="ex-dates mt-2">
        <DateInput id="ex-from" label="From" bind:value={from} class="mb-0" />
        <DateInput id="ex-to" label="To" bind:value={to} class="mb-0" />
        <button type="button" class="btn btn-primary" disabled={!from || !to || (from === applied.from && to === applied.to)} onclick={() => (applied = { from, to })}>Show</button>
      </div>
    {/if}
    {#if d}<p class="m-0 mt-2 text-sm text-muted" aria-live="polite">Weeks of {fmtDate(d.from)} to {fmtDate(d.to)}</p>{/if}
  </section>

  {#if e.error && !d}<Banner kind="warn">{errorMessage(e.error)}</Banner>
  {:else if !d}{#if period !== 'custom' || (applied.from && applied.to)}<Skeleton kind="list" rows={5} />{/if}
  {:else if !students.length}
    <EmptyState icon="users" title="No students on the promotion ladder">Students in VL-2, VL-3, SPS, DPS or BSS with you as their facilitator show here.</EmptyState>
  {:else}
    <div class="chiprow one-line mb-3" role="group" aria-label="Promotion route" {@attach pressedInView}>
      <button type="button" class="chipbtn" aria-pressed={!route} onclick={() => (route = '')}>All routes</button>
      {#each routes as lv (lv)}<button type="button" class="chipbtn" aria-pressed={route === lv} onclick={() => (route = lv)}>{routeLabel(lv)}</button>{/each}
    </div>

    {#if route}
      <!-- the sheet's criteria table: apply?, the rule, your threshold, and how many meet it -->
      <section class="cblock ex-crit" aria-labelledby="ex-c">
        <h2 id="ex-c" class="t-over m-0 mb-2">Criteria</h2>
        <ul class="m-0 list-none p-0">
          {#each keys as k (k)}
            {@const c = counts(k)}
            <li class="ex-row" class:ex-off={!on[k]}>
              <label class="ex-tick"><input type="checkbox" bind:checked={on[k]} /><span class="font-semibold">{d.labels?.[k] || k}</span></label>
              <span class="text-sm text-muted">{k in ruleOf ? 'Rule ' + fmt(k, ruleOf[k]) : 'Not in the rule'}</span>
              {#if k === 'pr'}<span class="text-sm text-muted">Yes</span>
              {:else}<label class="ex-own"><span class="sr-only">Your threshold for {d.labels?.[k] || k}</span>
                <input class="input" inputmode="decimal" placeholder={!(k in ruleOf) ? (PCT.has(k) ? '%' : '—') : PCT.has(k) ? Math.round(ruleOf[k] * 100) + '%' : String(ruleOf[k])} bind:value={mine[k]} disabled={!on[k]} /></label>{/if}
              <span class="text-sm ex-n">{c.meet} meet · {c.data} have data</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="ex-head">
      <p class="m-0 font-semibold" aria-live="polite">{ready.length} of {judged.length} qualify</p>
      <Seg id="ex-show" label="Show" srLabel options={[['ready', 'Qualify'], ['all', 'Everyone']]} value={show} onchange={(v) => (show = v)} />
    </div>
    {#if !listed.length}
      <EmptyState icon="search" title="Nobody qualifies">{route ? 'Untick a criterion or lower its threshold to see who is close.' : 'Choose a route to try other thresholds.'}</EmptyState>
    {:else}
      <ul class="list" aria-label="Students">
        {#each listed as s (s.login)}
          <li class="ex-st">
            <div class="ex-who">
              <span class="lt">{s.name}</span>
              <span class="ls">{s.batchName} · {LEVEL[s.level] || s.level} → {s.next.map((x) => LEVEL[x] || x).join(' / ')}{s.iyfId ? ' · ' + s.iyfId : ''} · {s.figures.weeks} {s.figures.weeks === 1 ? 'week' : 'weeks'}</span>
            </div>
            {#if s.ready}<span class="pill" data-tone="ok">Qualifies</span>{/if}
            <ul class="ex-checks" aria-label="Criteria for {s.name}">
              {#each s.checks as c (c.k)}<li class:ex-met={c.met}><Icon name={c.met ? 'check' : 'close'} size={14} /><span>{d.labels?.[c.k] || c.k} {fmt(c.k, c.got)}</span><span class="text-muted"> / {fmt(c.k, c.min)}</span></li>{/each}
            </ul>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .ex-dates { display: grid; grid-template-columns: 1fr 1fr auto; align-items: end; gap: var(--sp-2); }
  @media (max-width: 420px) { .ex-dates { grid-template-columns: 1fr 1fr; } .ex-dates .btn { grid-column: 1 / -1; } }
  .ex-row { display: grid; grid-template-columns: minmax(0, 1.6fr) auto 6.5rem auto; align-items: center; gap: var(--sp-2) var(--sp-3); padding: 10px 0; border-top: 1px solid var(--border); }
  .ex-row:first-child { border-top: 0; }
  .ex-off > :not(.ex-tick) { opacity: 0.5; }
  .ex-tick { display: flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; }
  .ex-tick input { width: 20px; height: 20px; accent-color: var(--accent); }
  .ex-own .input { min-height: var(--ctl-h); text-align: right; }
  .ex-n { color: var(--text-secondary); white-space: nowrap; }
  /* a phone: the name and its rule on the left, the threshold beside them, the counts under both */
  @media (max-width: 599px) {
    .ex-row { grid-template-columns: 1fr 6rem; row-gap: 0; }
    .ex-tick { grid-column: 1; grid-row: 1; }
    .ex-row > :nth-child(2) { grid-column: 1; grid-row: 2; }
    .ex-row > :nth-child(3) { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
    .ex-n { grid-column: 1 / -1; grid-row: 3; margin-top: 2px; }
  }
  .ex-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2); margin: var(--sp-4) 0 var(--sp-2); }
  .ex-st { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; padding: 12px 14px; }
  .ex-who { min-width: 0; }
  .ex-st > .pill { align-self: start; }
  .ex-who .lt { display: block; font-weight: 600; overflow-wrap: anywhere; }
  .ex-who .ls { display: block; color: var(--text-muted); font-size: var(--fs-sm); overflow-wrap: anywhere; }
  .ex-checks { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .ex-checks li { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: var(--r-full); font-size: var(--fs-xs); background: var(--danger-soft, var(--surface-2)); color: var(--text); }
  .ex-checks li.ex-met { background: var(--success-soft); }
</style>
