<script>
  import { windowSay } from '../lib/meta.js';
  import Row from '../ui/Row.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import Status from '../ui/Status.svelte';
  import '../styles/screens.css';
  // A facilitator's screens (the head, 4 Oct 2026), READ-ONLY, like a group leader's tab: "My students" — the devotees
  // whose facilitator they are (any batch) — each student's weeks, and their reports by week and by day. They call or
  // chat (WhatsApp) with a student; they never change anyone's sadhana.
  //   /my-devotees · /my-devotees/<login> · /my-devotees/<login>/<weekId>
  // The same student page and week serve Share sadhana (27 Oct 2026): /shared/<login> · /shared/<login>/<weekId> is a
  // sadhana somebody shared with the reader — no list, no contact, no actions; share.devotee / share.week decide access.
  // Phase 5 (9 Oct 2026): the list is grouped — Needs you (not started, 2+ missing days, missed) · Filling · Submitted
  // (folded) — each row with a plain reason; the counts filter; a ring row to scan. From 1024 px a student opens beside
  // the list (the URL stays the student's, so links keep working); on a phone it is its own page.
  import { untrack } from 'svelte';
  import { wide as W } from '../lib/wide.svelte.js';
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { weekLabel, fmtClose, todayIST, addDaysIso } from '../lib/dates.js';
  import { waLink, telLink } from '../lib/contact.js';
  import { STATUS, boardCounts, boardFilter, dayCells, mondayIST, rowReason, needsYou, missingDays, workOrder, band, weekTitle } from '../lib/staff.js';
  import WeekPicker from '../ui/WeekPicker.svelte';
  import WeekRead from '../ui/WeekRead.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import ScopeStrip from '../ui/ScopeStrip.svelte';
  import RingRow from '../ui/RingRow.svelte';
  import Spark from '../ui/Spark.svelte';
  // the submit window is a master setting: say the time that is set, never a literal "Sunday 6 PM"
  const w = $derived(windowSay());
  let { path } = $props();
  const parts = $derived(path.split('?')[0].split('/').filter(Boolean));     // ['my-devotees', login?, weekId?]
  const login = $derived(parts[1] ? decodeURIComponent(parts[1]) : '');
  const weekId = $derived(parts[2] || '');
  // which pair of actions, and whether contact shows: a facilitator's student, or a sadhana shared with the reader
  // `arg`: what the path's second part is — the student's login, or the share's id (the viewer never holds the owner's phone)
  const MODES = { 'my-devotees': { dev: 'fac.devotee', week: 'fac.week', arg: 'login', contact: true, list: true }, shared: { dev: 'share.devotee', week: 'share.week', arg: 'id', contact: false, list: false } };
  const mode = $derived(MODES[parts[0]] || MODES['my-devotees']);
  const base = $derived('#/' + (MODES[parts[0]] ? parts[0] : 'my-devotees') + '/');

  // list + detail from 1024 px (the student beside the list)
  const wide = $derived(W.on);
  const showList = $derived(mode.list && (!login || (wide && !weekId)));

  // ---- the list
  const FOCUS = 'fac.devotees';
  let picked = $state('');
  const focusW = $derived(entry(FOCUS).data?.weekId);
  // "Older weeks" opens on the week BEFORE the one shown above it, never on "This week" (Phase 24, V37)
  const olderW = $derived(focusW ? (dv?.since && addDaysIso(focusW, -7) < dv.since ? dv.since : addDaysIso(focusW, -7)) : dv?.since || '');
  const KEY = $derived(picked ? FOCUS + ':' + picked : FOCUS);
  const e = $derived(entry(KEY));
  const d = $derived(e.data);
  const refresh = (force = false) => load(KEY, () => call('fac.devotees', picked ? { weekId: picked } : {}), { force });
  $effect(() => { if (mode.list && (showList || login)) { KEY; untrack(() => refresh()); } });
  const rows = $derived(workOrder(d?.rows || []));
  const counts = $derived(boardCounts(rows));
  const closed = $derived(d ? Date.now() >= Date.parse(d.closesAt) : false);
  const today = todayIST();
  let only = $state('');
  const filtered = $derived(only ? boardFilter(rows, only) : null);
  const groups = $derived([
    ['needs', 'Needs you', rows.filter((r) => needsYou(r, d?.weekId, today))],
    ['filling', 'Filling', rows.filter((r) => r.status !== 'SUBMITTED' && !needsYou(r, d?.weekId, today))],
    ['done', 'Submitted', rows.filter((r) => r.status === 'SUBMITTED')],
  ]);
  const stuHref = (r) => '#/my-devotees/' + encodeURIComponent(r.login) + (picked && !wide ? '/' + picked : '');

  // ---- one devotee
  const DK = $derived(login ? mode.dev + ':' + login : '');
  const de = $derived(DK ? entry(DK) : null);
  const dv = $derived(de?.data);
  $effect(() => { if (DK && !weekId) { const k = DK, l = login; untrack(() => load(k, () => call(mode.dev, { [mode.arg]: l }), { force: !mode.list })); } });   // a share is checked afresh on every open
  const thisRow = $derived(login ? (d?.rows || []).find((r) => r.login === login) : null);
  // the last 12 weeks, oldest first, for the sparkline (a missed week counts 0)
  const trend = $derived((dv?.weeks || []).slice(0, 12).map((w) => (w.status === 'SUBMITTED' ? w.overall ?? 0 : 0)).reverse());
</script>

{#if login && weekId}
  <WeekRead action={mode.week} {login} {weekId} name={dv?.name || ''} />
{:else}
  <div class:fc-split={wide && login && mode.list}>
    {#if showList}
      <div class="fc-list">{@render list()}</div>
    {/if}
    {#if login}
      <div class="fc-pane" aria-live={wide ? 'polite' : undefined}>{@render student()}</div>
    {/if}
  </div>
{/if}

{#snippet list()}
  <PageHeader title={d ? rows.length + (rows.length === 1 ? ' student' : ' students') : ' '}>{#snippet actions()}{#if d}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{/if}{/snippet}</PageHeader>
  {#if d}<WeekPicker id="fc-wk" focus={focusW || d.weekId} value={picked} back={52} closes={fmtClose(d.closesAt)} {closed} onchange={(w) => (picked = w)} />{/if}
  {#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>
  {:else if !d}<Skeleton kind="list" rows={5} />
  {:else if !rows.length}
    <EmptyState icon="users" title="No students yet">Devotees who choose you as their facilitator appear here.</EmptyState>
  {:else}
    <ScopeStrip {counts} value={only} onpick={(k) => (only = k)} />
    {#if !wide}<RingRow people={rows.map((r) => ({ ...r, missing: missingDays(r, d.weekId, today).length }))} href={stuHref} />{/if}
    {#if filtered}
      {#if filtered.length}<ul class="mb-list" aria-label={'Only ' + (STATUS[only]?.[0] || only)}>{#each filtered as r (r.login)}{@render srow(r)}{/each}</ul>
      {:else}<EmptyState icon="users" title={`No one is ${(STATUS[only]?.[0] || '').toLowerCase()}`}><button type="button" class="btn btn-text btn-sm" onclick={() => (only = '')}>Clear the filter</button></EmptyState>{/if}
    {:else}
      {#if !groups[0][2].length && !groups[1][2].length}<p class="fc-all" role="status"><Icon name="ok" size={18} />Everyone has submitted this week.</p>{/if}
      {#each groups as [k, title, rs] (k)}
        {#if rs.length}
          {#if k === 'done'}
            <details class="fc-fold" open={!groups[0][2].length && !groups[1][2].length}>
              <summary class="fc-h"><span>{rs.length} submitted</span><Icon name="down" size={18} /></summary>
              <ul class="mb-list" aria-label="Submitted">{#each rs as r (r.login)}{@render srow(r)}{/each}</ul>
            </details>
          {:else}
            <h3 class="fc-h"><span>{title}</span> <span class="fc-n">{rs.length}</span></h3>
            <ul class="mb-list" class:fc-needs={k === 'needs'} aria-label={title}>{#each rs as r (r.login)}{@render srow(r)}{/each}</ul>
          {/if}
        {/if}
      {/each}
    {/if}
  {/if}
{/snippet}

{#snippet srow(r)}
  {@const [label, tone] = STATUS[r.status] || [r.status, '']}
  <li class="mrow" class:fc-on={r.login === login}>
    <a class="mrow-main" href={stuHref(r)} aria-current={r.login === login ? 'page' : undefined}>
      <span class="min-w-0">
        <b class="block truncate">{r.name}</b>
        <span class="mrow-sub">
          <Status {tone} {label} />
          <span class="strip" role="img" aria-label={`${r.daysFilled} of 7 days filled`}>{#each dayCells(r, d?.weekId, today) as c}<i data-s={c}></i>{/each}</span>
          <span>{r.batchName}</span>
        </span>
        <span class="fc-why">{rowReason(r, d?.weekId, today)}</span>
      </span>
    </a>
    <span class="mrow-act">
      <IconButton icon="phone" size={18} label={'Call ' + r.name} href={telLink(r.phone)} />
      {#if waLink(r.whatsapp)}<IconButton icon="msg" size={18} label={'Chat with ' + r.name + ' on WhatsApp'} href={waLink(r.whatsapp)} target="_blank" rel="noopener noreferrer" />{/if}
    </span>
  </li>
{/snippet}

{#snippet student()}
  {#if !mode.list && de?.error?.code === 'FORBIDDEN'}
    <!-- the owner removed the share (or never made one): never a kept copy of what is no longer theirs to see -->
    <EmptyState icon="lock" title="Not shared with you">{#snippet action()}<a class="btn" href="#/share/with-me">Shared with me</a>{/snippet}</EmptyState>
  {:else if de?.error && (!dv || !mode.list)}<Banner onretry={() => load(DK, () => call(mode.dev, { [mode.arg]: login }), { force: true })}>{errorMessage(de.error)}</Banner>
  {:else if !dv}<Skeleton rows={3} />
  {:else}
    <section class="section" aria-labelledby="fd-h">
      <div class="fd-head">
        <span class="avatar fd-av" aria-hidden="true">{dv.name.trim().charAt(0).toUpperCase()}</span>
        <div class="min-w-0 flex-1">
          <h2 id="fd-h" class="m-0">{dv.name}</h2>
          <p class="m-0 mt-1 text-sm text-muted">{dv.batchName}{dv.iyfId ? ' · ' + dv.iyfId : ''}{dv.active ? '' : ' · not active'} <span class="pill fd-chip">{mode.contact ? 'Facilitator view' : 'Shared with you'}</span></p>
        </div>
      </div>
      {#if mode.contact}<div class="mt-3 grid grid-cols-2 gap-2">
        <a class="btn" href={telLink(dv.phone)}><Icon name="phone" size={18} />Call</a>
        {#if waLink(dv.whatsapp)}<a class="btn" href={waLink(dv.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="msg" size={18} />Chat<span class="sr-only"> with {dv.name} on WhatsApp</span></a>{/if}
      </div>{/if}
    </section>
    <section class="section" aria-labelledby="fd-tw">
      <h3 id="fd-tw"><Icon name="week" />{weekTitle(d?.weekId || focusW)}</h3>
      <a class="lrow fd-this" href={`${base}${encodeURIComponent(login)}/${focusW || mondayIST()}`}>
        <span class="lmain">
          {#if thisRow}
            {@const [label, tone] = STATUS[thisRow.status] || [thisRow.status, '']}
            <span class="flex flex-wrap items-center gap-x-3 gap-y-1"><Status {tone} {label} /><span class="strip" role="img" aria-label={`${thisRow.daysFilled} of 7 days filled`}>{#each dayCells(thisRow, d?.weekId, today) as c}<i data-s={c}></i>{/each}</span></span>
            <span class="ls">{rowReason(thisRow, d?.weekId, today)}</span>
          {:else}<span class="lt">Open this week</span>{/if}
        </span><Icon name="next" size={18} />
      </a>
      {#if trend.length > 1}<p class="m-0 mt-3 flex items-center gap-2 text-sm text-muted">Last {trend.length} weeks <Spark values={trend} label={`${dv.name}, last ${trend.length} weeks`} /></p>{/if}
    </section>
    <section class="section" aria-labelledby="fd-w">
      <h3 id="fd-w"><Icon name="report" />Weeks</h3>
      <ul class="m-0 grid list-none gap-2 p-0">
        {#each dv.weeks as w (w.weekId)}
          <li><Row href={`${base}${encodeURIComponent(login)}/${w.weekId}`}>Week of {weekLabel(w.weekId)}
            {#snippet end()}{#if w.status === 'SUBMITTED'}{#if (w.daysFilled ?? 7) < 7}<span class="text-sm text-muted">{w.daysFilled}/7 days</span>{/if}<span class="score-pill" data-b={band(w.overall)}>{w.overall}%</span>{:else}<Status tone="bad" label="Missed · 0" />{/if}{/snippet}
          </Row></li>
        {:else}<EmptyState tag="li" icon="week">No submitted weeks yet — a week appears here as soon as they submit it. Submitting opens {w.opensText} and closes {w.closesText}; after that only a coordinator can reopen it.</EmptyState>{/each}
      </ul>
      <!-- any past week since they joined (the head, 7 Oct 2026): one picker, at the end -->
      {#if focusW || dv.since}<div class="mt-3"><p class="label m-0 mb-1">Older weeks</p><WeekPicker id="fd-any" focus={olderW} value="" back={156} ahead={0} from={dv.since || ''} onchange={(w) => (location.hash = `${base}${encodeURIComponent(login)}/${w || olderW || mondayIST()}`)} /></div>{/if}
    </section>
  {/if}
{/snippet}

<style>
  .fc-h { display: flex; align-items: center; gap: 8px; min-height: var(--ctl-h); margin: 14px 0 6px; font-size: var(--fs-sm); font-weight: 650; color: var(--text-muted); }
  .fc-n { min-width: 22px; padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--text); text-align: center; font-variant-numeric: tabular-nums; }
  .fc-needs { border-left: 3px solid var(--warn-line); }
  .fc-why { display: block; margin-top: 2px; font-size: var(--fs-sm); color: var(--text-muted); }
  .fc-fold > summary { justify-content: space-between; list-style: none; cursor: pointer; min-height: 44px; }
  .fc-fold > summary::-webkit-details-marker { display: none; }
  .fc-fold[open] > summary :global(svg) { transform: rotate(180deg); }
  .fc-all { display: flex; align-items: center; gap: 8px; margin: 8px 0; padding: 12px 14px; border-radius: var(--r-md); background: var(--success-soft); color: var(--success); font-weight: 600; }
  .fd-head { display: flex; align-items: center; gap: 12px; }
  .fd-av { width: 48px; height: 48px; font-size: 1.125rem; }
  .fd-chip { margin-left: 4px; vertical-align: 1px; }
  .fd-this { min-height: 64px; }
  /* list + detail (≥ 1024 px): the list keeps its place, the student opens beside it */
  .fc-split { display: grid; grid-template-columns: minmax(360px, 440px) minmax(0, 1fr); gap: var(--sp-5); align-items: start; }
  .fc-split .fc-list { position: sticky; top: calc(var(--sticky-top) + var(--sp-2)); max-height: calc(100vh - var(--sticky-top) - var(--sp-2) - var(--sp-8));   /* fits between the bar and the page's 48 px foot: taller, the page's end pushed it under the bar (V2) */ overflow: auto; padding-right: 4px; }
  .fc-split .fc-pane { min-width: 0; }
  .fc-on { background: var(--accent-soft); }
  .fc-on .mrow-main b { color: var(--accent-strong); }
</style>
