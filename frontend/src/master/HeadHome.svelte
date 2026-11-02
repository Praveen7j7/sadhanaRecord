<script>
  import '../styles/screens.css';
  // The IYF head's Home (Phase 6, 9 Oct 2026): never a list of links — every row says what needs a decision and goes
  // straight to it.
  //   Decisions: sign-ups (oldest one's age), password resets, weeks to reopen (who), reported posts — or "All caught up"
  //   System health: plain facts, each a link to where it is fixed (reminder phones, the registry copy, batches with no
  //     coordinator, slow or refused saves today) — or "Everything is running normally"
  //   Batches this week: worst first; a row opens that batch's status
  // Light on the free plan: this week only (stats.all, 1 week), the small lists; nothing heavy (no duplicate scan).
  import { call } from '../lib/api.js';
  import { entry, load, seed } from '../lib/cache.svelte.js';
  import { batchColor } from '../lib/batchcolor.js';
  import Spark from '../ui/Spark.svelte';
  import { relTime } from '../lib/ann.js';
  import { batchSel } from '../lib/batchsel.svelte.js';
  import { todayIST } from '../lib/dates.js';
  import { weekName } from '../lib/staff.js';
  import Icon from '../ui/Icon.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Birthdays from '../coord/Birthdays.svelte';
  let { compact = false } = $props();

  const rq = entry('requests.list'), ro = entry('reopen.list'), rp = entry('announcements.reports'), hr = entry('heads.requests');
  const st = entry('settings.get'), bl = entry('batches.list'), rl = entry('runlog.list'), sa = entry('stats.all:8');
  // ADR 0014 D: students whose facilitator stopped facilitating
  const orphE = entry('facilitators.orphans');
  // the batches coordinators asked to start (Phase 23): loaded once at sign-in for the badge; read here
  const brE = entry('batchreq.list');
  /*
   * One request (Phase 6, 22 Oct 2026): home.staff answers the eight reads this screen opened with. Each part is filed
   * under its own name, so Requests, Settings and the rest open at once afterwards, and this screen reads the same
   * entries it always did. Eight weeks of each batch, for the bars, the change on last week and the sparkline.
   */
  // Each part is filed with the time home.staff was ASKED, not now: coming back to Home replays the kept answer, and a
  // part changed since (a decision on Facilitators, an approval on Requests) is newer and must not be overwritten.
  const PARTS = [['requests.list', 'requests'], ['reopen.list', 'reopens'], ['announcements.reports', 'reports'], ['heads.requests', 'heads'],
    ['settings.get', 'settings'], ['batches.list', 'batches'], ['runlog.list', 'runlog'], ['stats.all:8', 'stats'], ['facilitators.orphans', 'orphans']];
  const hs = entry('home.staff');
  const fill = (d) => { if (d) for (const [key, part] of PARTS) seed(key, d[part], hs.at); };
  const refreshAll = (force = false) => load('home.staff', () => call('home.staff', { weeks: 8 }), { force }).then(fill);
  refreshAll();

  // "2026-10-03T04:00:00+05:30" inside a status line → "3 Oct, 4:00 am" (dates in full, never raw)
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const human = (t) => t.replace(/(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::\d\d)?(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?/g, (_, y, mo, d, h, mi) => `${+d} ${MON[+mo - 1]}, ${+h % 12 || 12}:${mi} ${+h < 12 ? 'am' : 'pm'}`);
  const oldest = (l) => l.reduce((m, x) => (x.at && (!m || x.at < m) ? x.at : m), '');
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const decisions = $derived(!rq.data ? null : [
    ...(rq.data.signUps.length ? [{ href: '#/requests?type=signup', icon: 'user', t: `${plural(rq.data.signUps.length, 'sign-up')} waiting for approval`, s: 'Oldest ' + relTime(oldest(rq.data.signUps)) }] : []),
    ...(rq.data.resets.length ? [{ href: '#/requests?type=reset', icon: 'lock', t: plural(rq.data.resets.length, 'password reset'), s: 'Call them first to confirm they asked' }] : []),
    ...((ro.data?.requests || []).length ? [{ href: '#/requests?type=reopen', icon: 'week', t: `${plural(ro.data.requests.length, 'week')} to reopen`, s: ro.data.requests.slice(0, 2).map((r) => r.name).join(', ') + (ro.data.requests.length > 2 ? ' …' : '') }] : []),
    ...((rp.data?.reports || []).length ? [{ href: '#/wall', icon: 'alert', t: `${plural(rp.data.reports.length, 'post')} reported on the Wall`, s: 'Keep it or take it off' }] : []),
    ...((orphE.data?.students || []).length ? [{ href: '#/facilitators', icon: 'users', t: `${plural(orphE.data.students.length, 'student')} need a new facilitator`, s: [...new Set(orphE.data.students.map((x) => x.facilitator))].join(', ') + ' stopped facilitating' }] : []),
    // a batch a coordinator asked to start (Phase 23)
    ...(brE.data?.waiting ? [{ href: '#/requests?type=newbatch', icon: 'plus', t: `${plural(brE.data.waiting, 'new batch', 'new batches')} asked for`, s: (brE.data.requests || []).filter((r) => r.state === 'WAITING').slice(0, 2).map((r) => `${r.levelName} by ${r.byName}`).join(', ') }] : []),
    // a new IYF head waiting for this head's approval (Phase 9, item 24)
    ...((hr.data?.open || []).filter((r) => r.mine).length ? [{ href: '#/coordinators', icon: 'shield', t: `${plural(hr.data.open.filter((r) => r.mine).length, 'new IYF head')} to approve`, s: hr.data.open.filter((r) => r.mine).map((r) => r.name).join(', ') }] : []),
  ]);

  // health: each fact with its tone ('' fine, 'warn' needs a look) and where it is fixed
  const today = todayIST();
  const health = $derived.by(() => {
    const out = [];
    if (st.data) {
      const n = st.data.pushDevices ?? 0;
      out.push(n ? { tone: '', href: '#/settings', t: `Reminders on ${plural(n, 'phone')}` } : { tone: 'warn', href: '#/settings', t: 'No phone has reminders on' });
      const reg = String(st.data.registryRefresh || '');
      if (reg) out.push({ tone: /^failed/i.test(reg) ? 'warn' : '', href: '#/ids', t: /^failed/i.test(reg) ? 'The registry copy failed — the IDs may be old' : 'Registry copied · ' + human(reg.replace(/^ok\s*·\s*/i, '')) });
      /* Roadmap 6.6: refusals in the last hour. Said plainly, because a handful is ordinary (somebody's
         session ended mid-tap) and a few hundred is a broken app version or somebody trying numbers. The
         counts are sampled, so they are shown as "about". */
      const rf = st.data.refusals || {};
      const turned = (Number(rf.forbidden) || 0) + (Number(rf.unauthenticated) || 0) + (Number(rf.stale) || 0);
      if (turned >= 100) {
        const parts = [];
        if (rf.unauthenticated) parts.push(`${rf.unauthenticated} asked to sign in again`);
        if (rf.forbidden) parts.push(`${rf.forbidden} not allowed`);
        if (rf.stale) parts.push(`${rf.stale} already changed elsewhere`);
        out.push({ tone: turned >= 500 ? 'warn' : '', href: '#/activity',
                   t: `About ${turned} calls turned away this hour · ${parts.join(', ')}` });
      }
      // a scheduled job that failed in the last day (F5, 22 Oct 2026): the Monday deadline, the 9 PM reminder, the
      // night's clean-up. Until now only Cloudflare's log knew, and nobody reads that day to day.
      const dayAgo = Date.now() - 864e5;
      for (const f of st.data.cronFailed || []) {
        if (Date.parse(f.at) > dayAgo) out.push({ tone: 'warn', href: '#/activity', t: `The ${f.name} run failed · ${human(f.at)} · ${String(f.message || '').slice(0, 60)}` });
      }
    }
    if (bl.data) {
      const none = bl.data.filter((b) => b.active && !b.coordinatorLogins?.length);
      if (none.length) out.push({ tone: 'warn', href: '#/batches', t: `${plural(none.length, 'batch', 'batches')} with no coordinator: ${none.map((b) => b.name).join(', ')}` });
    }
    if (rl.data) {
      const day = (rl.data.rows || []).filter((r) => String(r.at || '').slice(0, 10) === today);
      const slow = day.filter((r) => r.ok && /slow/i.test(r.detail || '')).length, bad = day.filter((r) => !r.ok).length;
      if (slow) out.push({ tone: slow > 5 ? 'warn' : '', href: '#/activity', t: `Saving was slow ${plural(slow, 'time')} today` });
      if (bad) out.push({ tone: 'warn', href: '#/activity', t: `${plural(bad, 'call')} refused today (for example, a day changed on another phone)` });
    }
    return out;
  });
  const healthOk = $derived(health.length && health.every((h) => !h.tone));
  const loadingHealth = $derived(!st.data && !st.error);

  // batches this week, worst first; batches with nobody expected go to one line under the table
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const rows = $derived((sa.data?.batches || []).filter((b) => b.thisWeek.expected).sort((a, b) => pct(a.thisWeek.submitted, a.thisWeek.expected) - pct(b.thisWeek.submitted, b.thisWeek.expected)));
  const empty = $derived((sa.data?.batches || []).filter((b) => !b.thisWeek.expected).map((b) => b.name));
  const open = (b) => (batchSel.id = b.batchId);
</script>

<div class="hh" class:hh-compact={compact} data-area="admin">
  <div class="hh-side">
    <!-- Decisions -->
    <section class="cblock needs" aria-labelledby="hh-dec">
      <h2 id="hh-dec" class="t-over m-0">Decisions</h2>
      {#if decisions === null}<Skeleton rows={2} />
      {:else if !decisions.length}<p class="hh-ok"><Icon name="ok" size={18} />All caught up — nothing waiting for you.</p>
      {:else}
        <ul class="m-0 list-none p-0">{#each decisions as n}<li><a class="lrow" href={n.href}><Icon name={n.icon} size={20} /><span class="lmain"><span class="lt">{n.t}</span><span class="ls">{n.s}</span></span><Icon name="next" size={18} /></a></li>{/each}</ul>
      {/if}
    </section>
    <!-- who became inactive or came back, all of IYF Delhi (Phase 23, ADR 0020); nothing when there is none -->
    {#await import('../coord/ActivityNotices.svelte') then M}<M.default />{/await}
    <!-- System health -->
    <section class="cblock" aria-labelledby="hh-health">
      <h2 id="hh-health" class="t-over m-0">System health</h2>
      {#if loadingHealth}<Skeleton rows={2} />
      {:else if st.error && !st.data}<p class="m-0 mt-2 text-sm text-muted">Couldn't load system health. <button type="button" class="link" onclick={() => load('settings.get', () => call('settings.get'), { force: true })}>Retry</button></p>
      {:else}
        {#if healthOk}<p class="hh-ok"><Icon name="ok" size={18} />Everything is running normally.</p>{/if}
        <ul class="hh-facts">
          {#each health as h}<li><a href={h.href} data-tone={h.tone || undefined}><span class="hh-dot" aria-hidden="true"></span><span class="min-w-0 flex-1">{h.t}</span><Icon name="next" size={16} /></a></li>{/each}
        </ul>
      {/if}
    </section>
  </div>

  <!-- Batches this week, worst first -->
  <section class="cblock hh-main" aria-labelledby="hh-b">
    <div class="flex items-center justify-between gap-2"><h2 id="hh-b" class="t-over m-0">Batches · {weekName(sa.data?.batches?.[0]?.weekId)}</h2><a class="link text-sm" href="#/overview">All batches</a></div>
    {#if !sa.data && !sa.error && !hs.error}<Skeleton rows={3} />
    {:else if (sa.error || hs.error) && !sa.data}<p class="m-0 mt-2 text-sm text-muted">Couldn't load this week's numbers. <button type="button" class="link" onclick={() => refreshAll(true)}>Retry</button></p>
    {:else if !rows.length}<p class="m-0 mt-2 text-sm text-muted">No active devotees in any batch yet.</p>
    {:else}
      <ul class="hh-list" aria-label="Batches this week, the lowest share submitted first">
        {#each rows as b (b.batchId)}
          {@const t = b.thisWeek}
          {@const tr = (b.trend || []).map((w) => w.filledPct)}
          {@const ch = tr.length > 1 ? tr[tr.length - 1] - tr[tr.length - 2] : null}
          <li><a class="hh-row" href="#/batch" onclick={() => open(b)}>
            <span class="hh-bh"><i class="hh-sw" style:--sw={batchColor(b)} aria-hidden="true"></i><b class="hh-bn">{b.name}</b>
              {#if ch !== null && ch !== 0}<span class="hh-ch" data-up={ch > 0 || undefined}>{ch > 0 ? '▲' : '▼'} {Math.abs(ch)} pts</span>{/if}
              {#if tr.length > 1}<span class="hh-sp"><Spark values={tr} label={`${b.name}, share filled over the last ${tr.length} weeks`} w={72} h={20} /></span>{/if}</span>
            <!-- C7 (22 Oct 2026): the whole week in one bar — submitted, filling, not started, missed -->
            <span class="hh-sub"><span class="hh-bar hh-stack" aria-hidden="true">
                <i class="s-ok" style:width={pct(t.submitted, t.expected) + '%'}></i><i class="s-warn" style:width={pct(t.draft, t.expected) + '%'}></i><i class="s-none" style:width={pct(t.notStarted, t.expected) + '%'}></i><i class="s-bad" style:width={pct(t.missed, t.expected) + '%'}></i></span>
              <span class="hh-of"><b>{t.submitted} of {t.expected}</b> submitted</span></span>
            <span class="hh-k">{t.draft} filling · {t.notStarted} not started{#if t.missed} · <span class="hh-bad">{t.missed} missed</span>{/if}</span>
          </a></li>
        {/each}
      </ul>
      {#if empty.length}<p class="m-0 mt-3 text-sm text-muted">{empty.join(', ')} — no active devotees yet.</p>{/if}
    {/if}
  </section>
  {#if !compact}<div class="hh-bd"><Birthdays /></div>{/if}
</div>

<style>
  .hh { display: grid; gap: 0 var(--sp-5); }
  /* phones: decisions, health, batches, birthdays; desktop: the batches on the left, the rest on the right */
  @media (min-width: 1024px) { .hh:not(.hh-compact) { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: start; }
    .hh:not(.hh-compact) .hh-main { grid-row: 1 / span 2; grid-column: 1; } .hh:not(.hh-compact) .hh-side, .hh:not(.hh-compact) .hh-bd { grid-column: 2; } }
  .hh-ok { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; color: var(--success); font-weight: 600; }
  .needs .lrow { min-height: 56px; }
  .hh-facts { margin: 6px 0 0; padding: 0; list-style: none; }
  .hh-facts a { display: flex; align-items: center; gap: 10px; min-height: 44px; color: var(--text); text-decoration: none; font-size: var(--fs-sm); border-top: 1px solid var(--divider); }
  .hh-facts li:first-child a { border-top: 0; }
  .hh-facts a :global(svg) { color: var(--text-muted); }
  .hh-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
  .hh-facts a[data-tone='warn'] .hh-dot { background: var(--warn-line); }
  .hh-facts a[data-tone='warn'] { font-weight: 600; }
  @media (hover: hover) { .hh-facts a:hover span { text-decoration: underline; text-underline-offset: 2px; } }
  .hh-list { margin: var(--sp-3) 0 0; padding: 0; list-style: none; }
  .hh-list li + li { border-top: 1px solid var(--divider); }
  .hh-row { display: grid; gap: 4px; padding: 10px 0; color: var(--text); text-decoration: none; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }
  @media (hover: hover) { .hh-row:hover .hh-bn { text-decoration: underline; text-underline-offset: 2px; } }
  .hh-bn { font-size: 1rem; }
  .hh-sub { display: flex; align-items: center; gap: 10px; color: var(--text-muted); }
  .hh-sub b { color: var(--text); }
  .hh-k { color: var(--text-muted); }
  .hh-bad { color: var(--danger); font-weight: 650; }
  .hh-bar { flex: 0 0 min(160px, 40%); height: 8px; border-radius: 4px; background: var(--surface-muted); overflow: hidden; }
  .hh-bar i { display: block; height: 100%; border-radius: 4px; background: var(--accent); }
  /* C7: one stacked bar per batch; #5: the change on last week and eight weeks in a sparkline; #9: the batch's colour */
  .hh-stack { display: flex; }
  .hh-stack i { border-radius: 0; flex: none; }
  .hh-stack .s-ok { background: var(--success); } .hh-stack .s-warn { background: var(--warning); }
  .hh-stack .s-none { background: var(--border); } .hh-stack .s-bad { background: var(--danger); }
  .hh-bh { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .hh-sw { flex: none; width: 10px; height: 10px; border-radius: 3px; background: var(--sw); }
  .hh-ch { font-size: var(--fs-caption); color: var(--danger); font-weight: 650; }
  .hh-ch[data-up] { color: var(--success); }
  .hh-sp { margin-left: auto; }
  .hh-sp :global(.sp-txt) { display: none; }
  .hh-of { white-space: nowrap; }
  /* The counts are one phrase and must never break across lines: "1 filling · 3 not" on one line and
     "started" on the next is what made this card look broken (the head, 16 Oct 2026). */
  .hh-k { white-space: nowrap; }

  /* Three columns only when there is ROOM for three. The old rule turned the row into three columns at a
     768px WINDOW, but this card sits in a two-column page, so the row itself was ~380px wide and every
     column wrapped mid-phrase. A container query measures the card, not the window, which is the thing that
     actually decides whether the text fits. Below that width the row stays stacked, which reads cleanly. */
  .hh-list { container-type: inline-size; }
  @container (min-width: 620px) {
    .hh-row { grid-template-columns: minmax(110px, 0.9fr) minmax(190px, 1.5fr) max-content; align-items: center; gap: 16px; }
    .hh-k { text-align: right; }
  }
  /* no container query (older WebKit): fall back to the window, at a width where the card is wide enough */
  @supports not (container-type: inline-size) {
    @media (min-width: 1280px) { .hh-row { grid-template-columns: minmax(110px, 0.9fr) minmax(190px, 1.5fr) max-content; align-items: center; gap: 16px; } .hh-k { text-align: right; } }
  }
</style>
