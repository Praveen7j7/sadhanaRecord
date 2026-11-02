<script>
  import { pressedInView } from '../lib/chips.js';
  // Activity (the audit log; Phase 6, 9 Oct 2026): plain sentences with names — "SPS Team changed the facilitator of
  // Bhavesh Jain" — under day headings (Today, Yesterday, Mon, 5 Oct), newest first. Five common types as chips, every
  // type under "More types". A line opens what changed as a table (Field · Before · After), the raw record inside it.
  // The slow / refused calls are the app keeper's: folded at the bottom (the head's Home says them in plain words).
  import { call, errorMessage } from '../lib/api.js';
  import { entry, seed } from '../lib/cache.svelte.js';
  import { fmtDateTime } from '../lib/validate.js';
  import { ACTION_GROUPS, auditParts, auditDiff, actionsSaying } from '../lib/admin.js';
  import Search from '../ui/Search.svelte';
  import { cachedMeta } from '../lib/meta.js';
  import { todayIST } from '../lib/dates.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Icon from '../ui/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  let { tools = null } = $props();   // the page's Export, from Admin.svelte, beside the search
  let f = $state({ what: '', who: '', target: '', from: '', to: '' }), q = $state('');
  let rows = $state(null), more = $state(false), busy = $state(false), err = $state('');
  let runs = $state(null);
  async function fetchRows(before) {
    busy = true; err = '';
    const data = { limit: 30, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim())) };
    // the search box (the head, 22 Oct 2026): the text, and the actions whose sentence here says it
    const term = q.trim();
    if (term.length >= 2) { data.q = term; const acts = actionsSaying(term); if (acts.length) data.actions = acts; }
    if (before) data.before = before;
    // The newest page, unfiltered, is kept between visits (22 Oct 2026, routevitals): a return visit draws it at once
    // (it waited ~1.5 s each time) while the server is still asked, so the log is never shown out of date for long.
    const plain = Object.keys(data).length === 1;
    const kept = plain && rows === null ? entry('audit.list').data : undefined;
    if (kept) { rows = kept.rows; more = kept.more; }
    try {
      const r = await call('audit.list', data); rows = before ? [...rows, ...r.rows] : r.rows; more = r.more;
      if (plain) seed('audit.list', { rows: r.rows, more: r.more });
    } catch (e) { err = errorMessage(e); }
    busy = false;
  }
  // filters apply as they change (typed ones after a short pause)
  $effect(() => { f.what; f.from; f.to; const w = f.who, t = f.target, s = q.trim(); if (s.length === 1) return; const h = setTimeout(() => fetchRows(), w || t || s ? 350 : 0); return () => clearTimeout(h); });
  let techOpen = $state(false);
  $effect(() => { if (techOpen && runs === null) call('runlog.list', { limit: 30 }).then((r) => (runs = r.rows)).catch(() => (runs = [])); });

  // five common types as chips; every type in a sheet
  const MAIN = ['', 'requests.', 'attendance.', 'devotees.', 'settings.'];
  const mainChips = ACTION_GROUPS.filter(([, p]) => MAIN.includes(p));
  const otherOn = $derived(f.what && !MAIN.includes(f.what) ? ACTION_GROUPS.find(([, p]) => p === f.what)?.[0] : '');
  let typesDlg = $state();

  // day headings in Indian time: Today, Yesterday, then "Mon, 5 Oct"
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ymdIst = (iso) => new Date(Date.parse(iso) + 5.5 * 3600e3).toISOString().slice(0, 10);
  const today = todayIST(), yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  const dayHead = (d) => (d === today ? 'Today' : d === yesterday ? 'Yesterday' : (() => { const x = new Date(d + 'T12:00:00Z'); return `${DAYS[x.getUTCDay()]}, ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; })());
  const timeOf = (iso) => { const t = new Date(Date.parse(iso) + 5.5 * 3600e3), h = t.getUTCHours(), m = String(t.getUTCMinutes()).padStart(2, '0'); return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`; };
  const groups = $derived.by(() => { const out = []; for (const r of rows || []) { const d = ymdIst(r.at); if (out.at(-1)?.d !== d) out.push({ d, rows: [] }); out.at(-1).rows.push(r); } return out; });
  const batchName = (id) => (cachedMeta().batches || []).find((b) => b.batchId === id)?.name || id;

  // the detail sheet
  let cur = $state(null), dlg = $state();
  const openRow = (r) => { cur = r; dlg.showModal(); };
</script>

<!-- the search and Export in one row (27 Oct 2026): Export had a row of its own above it -->
<div class="ac-find">
  <Search id="ac-q" label="Search Activity" placeholder="Action, name or reason" bind:value={q} class="mb-0 min-w-0 flex-1" pin />
  {#if tools}<span class="ac-tools">{@render tools()}</span>{/if}
</div>
<div class="chiprow one-line" role="group" aria-label="What" {@attach pressedInView}>
  {#each mainChips as [label, p]}<button type="button" class="chipbtn" aria-pressed={f.what === p} onclick={() => (f.what = p)}>{label}</button>{/each}
  <button type="button" class="chipbtn" aria-pressed={!!otherOn} aria-haspopup="dialog" onclick={() => typesDlg.showModal()}>{otherOn || 'More types'}<Icon name="down" size={14} /></button>
</div>
<details class="disclose mb-2"><summary class="text-sm">By, about, dates{f.who || f.target || f.from || f.to ? ' (on)' : ''}</summary>
  <div class="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
    <TextInput id="ac-who" label="By (username or phone)" bind:value={f.who} autocomplete="off" autocapitalize="none" placeholder="e.g. sps" />
    <TextInput id="ac-target" label="About (phone or username)" bind:value={f.target} autocomplete="off" autocapitalize="none" />
    <DateInput id="ac-from" label="From" bind:value={f.from} />
    <DateInput id="ac-to" label="To" bind:value={f.to} />
  </div>
</details>
{#if err}<Banner onretry={() => fetchRows()}>{err}</Banner>{/if}
{#if rows === null && !err}<Skeleton kind="list" rows={5} />
{:else if rows}
  {#each groups as g (g.d)}
    <h3 class="ac-day">{dayHead(g.d)}</h3>
    <ul class="list" aria-label={dayHead(g.d)}>
      {#each g.rows as r (r.id)}
        {@const p = auditParts(r)}
        <li><button type="button" class="ac-row" onclick={() => openRow(r)} aria-haspopup="dialog">
          <span class="ac-line"><b>{p.who}</b>{' ' + p.verb}{#if p.target}{' '}<b>{p.target}</b>{/if}{#if p.extra}<span class="ac-x">{' · ' + p.extra}</span>{/if}</span>
          <span class="ac-meta">{timeOf(r.at)}{r.batchId ? ' · ' + batchName(r.batchId) : ''}{r.reason ? ' · “' + r.reason + '”' : ''}</span>
        </button></li>
      {/each}
    </ul>
  {:else}<EmptyState icon="clock" title="Nothing found">Try another type, or clear the filters.</EmptyState>{/each}
  {#if more}<button type="button" class="btn btn-block mt-3" disabled={busy} aria-busy={busy || undefined} onclick={() => fetchRows(rows.at(-1).id)}>{#if busy}<span class="spin" aria-hidden="true"></span>{/if}Load more</button>
  {:else if rows.length}<p class="m-0 mt-3 text-center text-sm text-muted">That's everything{f.from ? ' from ' + f.from : ''}.</p>{/if}
{/if}

<details class="disclose mt-6" bind:open={techOpen}>
  <summary class="text-sm">Technical log (for the app keeper)</summary>
  {#if !techOpen}<!-- body drawn only while open: a closed log kept a skeleton in <main> forever -->
  {:else if runs === null}<Skeleton kind="list" rows={2} />
  {:else if !runs.length}<p class="m-0 mt-2 text-sm text-muted">Nothing slow or refused was logged.</p>
  {:else}
    <ul class="m-0 mt-2 grid list-none gap-1 p-0 text-sm">
      {#each runs as r, i (i)}<li class="ac-tech"><b>{r.ok ? 'Slow' : r.errorCode || 'Refused'}</b> · {r.action} · {r.ms} ms · {fmtDateTime(r.at)}{r.detail ? ' · ' + r.detail : ''}</li>{/each}
    </ul>
  {/if}
</details>

<Sheet bind:this={typesDlg} titleId="ac-t-h" title="Show only">
  <div class="grid gap-2">
    {#each ACTION_GROUPS as [label, p]}<button type="button" class="btn" class:btn-primary={f.what === p} aria-pressed={f.what === p} onclick={() => { f.what = p; typesDlg.close(); }}>{label}</button>{/each}
  </div>
</Sheet>

<Sheet bind:this={dlg} titleId="ac-d-h" title="What changed" sub={cur ? `${timeOf(cur.at)}, ${dayHead(ymdIst(cur.at))}` : ''} onclose={() => (cur = null)}>
  {#if cur}
    {@const p = auditParts(cur)}
    {@const diff = auditDiff(cur)}
    <p class="m-0 mb-3"><b>{p.who}</b>{' ' + p.verb}{#if p.target}{' '}<b>{p.target}</b>{/if}.</p>
    {#if cur.target && cur.targetName}<p class="m-0 mb-3 text-sm text-muted">{cur.targetName} · {cur.target}</p>{/if}
    {#if cur.reason}<p class="m-0 mb-3 text-sm">Reason: “{cur.reason}”</p>{/if}
    {#if diff.length}
      <table class="ac-diff"><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
        <tbody>{#each diff as x}<tr><th scope="row">{x.field}</th><td>{x.before}</td><td>{x.after}</td></tr>{/each}</tbody></table>
    {:else}<p class="m-0 text-sm text-muted">No field details were kept for this change.</p>{/if}
    {#if cur.before || cur.after}
      <details class="disclose mt-3"><summary class="text-sm">Show raw</summary>
        <div class="grid gap-2 text-xs sm:grid-cols-2"><pre class="well m-0 overflow-x-auto whitespace-pre-wrap break-all">{cur.before ? JSON.stringify(cur.before, null, 1) : '—'}</pre><pre class="well m-0 overflow-x-auto whitespace-pre-wrap break-all">{cur.after ? JSON.stringify(cur.after, null, 1) : '—'}</pre></div>
      </details>
    {/if}
  {/if}
</Sheet>

<style>
  .ac-find { display: flex; align-items: center; gap: 8px; min-width: 0; margin-bottom: var(--sp-3); }
  .ac-tools { flex: none; display: flex; }
  .ac-day { margin: var(--sp-4) 0 var(--sp-2); font-size: var(--fs-sm); font-weight: 650; color: var(--text-muted); }
  .ac-row { display: flex; flex-direction: column; gap: 2px; width: 100%; min-height: 56px; padding: 10px 14px; border: 0; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
  @media (hover: hover) { .ac-row:hover { background: var(--surface-hover); } }
  .ac-line { overflow-wrap: anywhere; }
  .ac-line b { font-weight: 650; }
  .ac-x { color: var(--text-secondary); }
  .ac-meta { font-size: var(--fs-caption); color: var(--text-muted); }
  .ac-tech { padding: 6px 0; border-bottom: 1px solid var(--divider); overflow-wrap: anywhere; }
  .ac-diff { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
  .ac-diff th, .ac-diff td { padding: 8px 6px; border-bottom: 1px solid var(--divider); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .ac-diff thead th { font-size: var(--fs-caption); color: var(--text-muted); }
  .ac-diff td:last-child { font-weight: 600; }
</style>
