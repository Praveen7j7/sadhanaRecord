<script>
  import '../styles/screens.css';
  // Staff Home (Phase 5, 9 Oct 2026), loaded only for staff: three slots —
  //   1. Needs you: only what is waiting (sign-ups with the oldest one's age, password resets, attendance still to mark
  //      on Sunday–Monday), else "All caught up";
  //   2. This week: one scope strip per batch (active members only); a tap opens that batch's status;
  //   3. People to nudge: up to five who have not started or are missing days, with Call / WhatsApp.
  // Then birthdays and the day's verse. `compact`: under a devotee's own Home (a coordinator who also fills sadhana).
  // The per-batch lists are the same cache entries the Batch status board uses, so the board then opens at once.
  import { session } from '../lib/session.svelte.js';
  import { scopesOf, canRequests } from '../lib/scopes.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { call } from '../lib/api.js';
  import { cachedMeta, staffBatches } from '../lib/meta.js';
  import { fmtClose, todayIST } from '../lib/dates.js';
  import { relTime } from '../lib/ann.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { waLink, telLink } from '../lib/contact.js';
  import { boardCounts, isActiveRow, needsYou, rowReason, workOrder, weekTitle, weekName } from '../lib/staff.js';
  import ScopeStrip from '../ui/ScopeStrip.svelte';
  import Ring from '../ui/Ring.svelte';
  import Row from '../ui/Row.svelte';
  import Icon from '../ui/Icon.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Birthdays from './Birthdays.svelte';
  let { compact = false } = $props();

  const sc = $derived(scopesOf(session.user));
  const ids = $derived(sc.coordinator || []);
  const nameOf = (id) => staffBatches().find((b) => b.batchId === id)?.name || id;
  const rq = entry('requests.list');
  $effect(() => { if (canRequests(sc)) load('requests.list'); });
  const boards = $derived(ids.map((id) => ({ id, e: entry('devotees.list:' + id) })));
  $effect(() => { for (const id of ids) load('devotees.list:' + id, () => call('devotees.list', { batchId: id })); });
  const today = todayIST();

  const oldest = (list) => list.reduce((m, x) => (x.at && (!m || x.at < m) ? x.at : m), '');
  // attendance still to mark: the class day has come, the deadline hasn't, and no active member has a coordinator or
  // group-leader mark yet
  const unmarked = $derived(boards.filter(({ e }) => {
    const d = e.data; if (!d || !d.attendanceOpen || Date.now() >= Date.parse(d.closesAt) || d.classWeek) return false;
    const act = (d.rows || []).filter(isActiveRow);
    return act.length && !act.some((r) => r.attendance?.coordinator || r.attendance?.leader);
  }));
  const needs = $derived(!rq.data ? null : [
    ...(rq.data.signUps.length ? [{ href: '#/requests', icon: 'user', t: `${rq.data.signUps.length} waiting for approval`, s: `Oldest ${relTime(oldest(rq.data.signUps))}` }] : []),
    ...(rq.data.resets.length ? [{ href: '#/requests', icon: 'lock', t: `${rq.data.resets.length} password reset${rq.data.resets.length === 1 ? '' : 's'}`, s: 'Confirm by phone first' }] : []),
    ...unmarked.map(({ id }) => ({ href: '#/batch', batch: id, icon: 'check', t: `Attendance open — ${nameOf(id)} not marked yet`, s: `Closes ${fmtClose(boards.find((b) => b.id === id).e.data.closesAt)}` })),
  ]);
  // up to five people to call: not started, missed or missing two or more days (all batches together)
  const nudge = $derived(workOrder(boards.flatMap(({ id, e }) => (e.data?.rows || []).filter((r) => isActiveRow(r) && needsYou(r, e.data.weekId, today)).map((r) => ({ ...r, weekId: e.data.weekId, batchName: nameOf(id) })))).slice(0, 5));
  const nudgeTotal = $derived(boards.reduce((n, { e }) => n + (e.data?.rows || []).filter((r) => isActiveRow(r) && needsYou(r, e.data.weekId, today)).length, 0));
  const go = (id) => (batchSel.id = id);
  // C7 (22 Oct 2026): the week's forms submitted of those expected (inactive members not counted), as the ring the
  // devotee Home uses — the share at a glance beside the strip that breaks it down
  const share = (c) => { const exp = c.SUBMITTED + c.DRAFT + c.NOT_STARTED + c.MISSED; return { n: c.SUBMITTED, exp, pct: exp ? Math.round((c.SUBMITTED / exp) * 100) : 0 }; };
</script>

<div class="sh-grid" class:sh-compact={compact} data-area="coordinator">
  <div class="sh-col">
    <!-- 1. Needs you: only what is waiting -->
    <section class="cblock needs" aria-labelledby="sh-needs">
      <h2 id="sh-needs" class="t-over m-0">Needs you</h2>
      {#if needs === null}<Skeleton rows={2} />
      {:else if !needs.length}<p class="sh-ok"><Icon name="ok" size={18} />All caught up.</p>
      {:else}
        <ul class="m-0 list-none p-0">
          {#each needs as n}<li><a class="lrow" href={n.href} onclick={() => n.batch && go(n.batch)}><Icon name={n.icon} size={20} /><span class="lmain"><span class="lt">{n.t}</span><span class="ls">{n.s}</span></span><Icon name="next" size={18} /></a></li>{/each}
        </ul>
      {/if}
    </section>
    <!-- who became inactive or came back in their batches (Phase 23, ADR 0020); nothing when there is none -->
    {#await import('./ActivityNotices.svelte') then M}<M.default />{/await}
    {#if !compact && ids.length}
      <!-- 3. People to nudge -->
      <section class="cblock" aria-labelledby="sh-nudge">
        <h2 id="sh-nudge" class="t-over m-0">People to nudge{nudgeTotal > nudge.length ? ` · ${nudge.length} of ${nudgeTotal}` : ''}</h2>
        {#if boards.some(({ e }) => !e.data && !e.error)}<Skeleton rows={3} />
        {:else if !nudge.length}<p class="sh-ok"><Icon name="ok" size={18} />Everyone is filling. Hare Krishna.</p>
        {:else}
          <ul class="m-0 list-none p-0">
            {#each nudge as r (r.login)}
              <li class="sh-p">
                <a class="sh-pm" href={'#/devotee/' + encodeURIComponent(r.login)}><b class="block truncate">{r.name}</b><span class="ls">{rowReason(r, r.weekId, today)}{ids.length > 1 ? ' · ' + r.batchName : ''}</span></a>
                <IconButton icon="phone" size={18} label={'Call ' + r.name} href={telLink(r.login)} />
                {#if waLink(r.whatsapp || r.login)}<IconButton icon="msg" size={18} label={'WhatsApp ' + r.name} href={waLink(r.whatsapp || r.login)} target="_blank" rel="noopener noreferrer" />{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
  <div class="sh-col">
    <!-- 2. This week, one strip per batch -->
    {#if ids.length}
      <section class="cblock" aria-labelledby="sh-week">
        <h2 id="sh-week" class="t-over m-0 mb-3">{weekTitle(boards.find((b) => b.e.data)?.e.data.weekId)}</h2>
        {#each boards as { id, e } (id)}
          <div class="sh-b">
            {#if ids.length > 1}<p class="sh-bn">{nameOf(id)}</p>{/if}
            {#if e.data}{@const c = boardCounts(e.data.rows || [])}{@const s = share(c)}
              <div class="sh-row"><span class="sh-ring"><Ring n={s.n} total={Math.max(1, s.exp)} size={52} text={s.pct + '%'} label={`${nameOf(id)}: ${s.n} of ${s.exp} forms submitted this week`} /></span>
              <div class="min-w-0 flex-1"><ScopeStrip counts={c} closes={fmtClose(e.data.closesAt)} href="#/batch" label={nameOf(id) + ', ' + weekName(e.data.weekId)} onnav={() => go(id)} /></div></div>
            {:else if e.error}<p class="text-sm text-muted">Couldn't load {nameOf(id)}. <a class="link" href="#/batch" onclick={() => go(id)}>Open it</a></p>
            {:else}<Skeleton rows={1} />{/if}
          </div>
        {/each}
      </section>
    {/if}
    {#if !compact}
      <ul class="list" aria-label="Batch tools">
        <li><Row href="#/batch" icon="users" title="Batch status and attendance" /></li>
        <li><Row href="#/stats" icon="report" title="Filling chart" /></li>
      </ul>
      <div class="mt-4"><Birthdays /></div>
    {/if}
  </div>
</div>

<style>
  .sh-grid { display: grid; gap: 0 var(--sp-5); }
  @media (min-width: 768px) { .sh-grid:not(.sh-compact) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
  .sh-ok { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; color: var(--success); font-weight: 600; }
  .needs .lrow, .sh-p { min-height: 56px; }
  .sh-p { display: flex; align-items: center; gap: 4px; border-top: 1px solid var(--divider); }
  .sh-p:first-child { border-top: 0; }
  .sh-pm { flex: 1; min-width: 0; padding: 8px 0; color: var(--text); text-decoration: none; }
  .sh-pm .ls { display: block; font-size: var(--fs-sm); color: var(--text-muted); }
  @media (hover: hover) { .sh-pm:hover b { text-decoration: underline; text-underline-offset: 2px; } }
  .sh-b + .sh-b { margin-top: var(--sp-3); }
  .sh-bn { margin: 0 0 6px; font-weight: 650; }
  .sh-row { display: flex; align-items: center; gap: var(--sp-3); }
  .sh-ring { flex: none; color: var(--accent); }
</style>
