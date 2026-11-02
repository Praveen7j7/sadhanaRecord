<script>
  // Devotee home, ordered by "what do I need in the first five seconds": greeting and date, today's one action,
  // this week's days, the quote, the latest announcement, then compact quick actions. Only data already loaded
  // (home.get, the announcements list when home.get says there is one, drafts kept on this phone).
  import { session } from '../lib/session.svelte.js';
  import { homeEntry, loadHome } from '../lib/weekstore.js';
  import { call, errorMessage } from '../lib/api.js';
  import { scopesOf } from '../lib/scopes.js';
  import { queuedDays, sendPressed } from '../lib/saver.js';
  import { toast } from '../lib/pro.svelte.js';
  import { weekLabel, fmtClose, fmtShort, fmtLong, DAY_SHORT, DAY_LONG } from '../lib/dates.js';
  import { todayIST, isMissing } from '../lib/dates.js';
  import { cachedMeta } from '../lib/meta.js';
  import Quotes from '../ui/Quotes.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Icon from '../ui/Icon.svelte';
  import { entry as cacheEntry, load } from '../lib/cache.svelte.js';
  import { relTime, isNew, shownOf } from '../lib/ann.js';
  import { annState } from '../lib/ann.svelte.js';
  import { askDismissed, askedToday } from '../lib/pushask.js';
  import { install, installApp, standalone, isIOS } from '../lib/pro.svelte.js';
  import { loadedOnce } from '../lib/lazy.js';
  import { birthdayLines } from '../lib/birthdays.js';
  // last: nothing of Home.svelte follows this screen (no facilitator or staff block), so the verse box may fit its quote
  let { last = true } = $props();

  const u = $derived(session.user);
  const e = homeEntry();
  const SYM = { complete: '✓', partial: '◐', empty: '○', missing: '!' };
  const NAME = { complete: 'complete', partial: 'partly filled', empty: 'not filled' };
  const first = $derived((u?.name || '').split(' ')[0]);
  const batchId = $derived(e.data?.profile?.batchId);
  // batch-mates born today, by name only (home.get, 27 Oct 2026); the reader's own birthday first
  const bday = $derived(birthdayLines(e.data?.birthdays, first));
  const batchName = $derived((cachedMeta().batches || []).find((b) => b.batchId === batchId)?.name || batchId || '');

  // One home.get when the app opens; again only when the app comes back on screen after more than 2 minutes.
  loadHome();
  $effect(() => {
    const vis = () => { if (document.visibilityState === 'visible') loadHome(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  });

  // The newest post (one call, only when home.get says there is something, and not again within 2 minutes)
  const wall = cacheEntry('announcements.list');
  $effect(() => { if (e.data?.latestAnnouncementAt) load('announcements.list'); });
  const latest = $derived((wall.data?.announcements || []).find((a) => !a.scheduled));   // (a facilitator's own scheduled post waits)
  const unread = $derived((wall.data?.announcements || []).filter((a) => isNew(a, annState.seen)).length);

  // Days with changes kept on this phone that were never saved (nothing is sent by itself): open the day and tap Save.
  let unsaved = $state([]);
  $effect(() => { if (u?.login) queuedDays(u.login).then((l) => (unsaved = l)); });
  // Saves tapped with no connection go by themselves once it is back (8 Oct 2026): on opening Home and on "online"
  async function flush() {
    if (!u?.login || !navigator.onLine) return;
    const n = await sendPressed(u.login);
    if (n) { toast(`${n} day${n === 1 ? '' : 's'} sent — saved while you were offline.`); loadHome(true); }
    unsaved = await queuedDays(u.login);
  }
  $effect(() => { flush(); window.addEventListener('online', flush); return () => window.removeEventListener('online', flush); });
  const waiting = $derived(unsaved.filter((q) => q.pressed)), notSaved = $derived(unsaved.filter((q) => !q.pressed));

  // "Today": the latest day that has started in the newest open week
  const cur = $derived(e.data?.weeks?.[e.data.weeks.length - 1]);
  const today = $derived(cur ? [...cur.days].reverse().find((d) => !d.future) : null);
  const done = (w) => w.days.filter((d) => d.state === 'complete').length;
  const submittable = $derived((e.data?.weeks || []).find((w) => w.canSubmit && w.status !== 'SUBMITTED'));
  const dayHref = $derived(today && cur ? `#/day/${cur.weekId}/${today.date}` : '#/week');
  const STATE_LINE = { complete: 'done ✓', partial: 'partly filled', empty: 'not filled yet' };
  // ---- the status block (Phase 4, 8 Oct 2026): one count of days, the next action always names a day ----
  const todayD = todayIST();
  const missing = $derived(cur ? cur.days.filter((d) => isMissing(d, todayD)) : []);
  const dayName = (w, d) => DAY_LONG[w.days.indexOf(d)];
  const statusLine = $derived(!cur ? '' : cur.status === 'SUBMITTED' ? 'This week is submitted ✓'
    : missing.length ? `${missing.length} day${missing.length === 1 ? '' : 's'} to fill — ${missing.map((d) => DAY_SHORT[cur.days.indexOf(d)]).join(', ')}`
    : today && today.state !== 'complete' ? `Today is ${STATE_LINE[today.state]}` : 'Every day so far is filled ✓');
  const target = $derived(cur && cur.status !== 'SUBMITTED' ? missing[0] || (today && today.state !== 'complete' ? today : null) : null);
  const action = $derived(target ? { href: `#/day/${cur.weekId}/${target.date}`, icon: 'edit', label: `${target.state === 'partial' ? 'Continue' : 'Fill'} ${target === today ? 'today' : dayName(cur, target)}` }
    : submittable ? { href: `#/week/${submittable.weekId}?f=submit`, icon: 'check', label: 'Submit week' }
    : { href: `${dayHref}?f=share`, icon: 'share', label: 'Today is done ✓ — Share' });
  const tone = $derived(!cur ? 'empty' : cur.status === 'SUBMITTED' || (!target && !submittable) ? 'complete' : missing.length ? 'partial' : 'empty');
  const initial = $derived((u?.name || '?').trim().charAt(0).toUpperCase());
  // ---- Needs you (group leader, facilitator): who in their care still has to submit ----
  const sc = $derived(scopesOf(u));
  $effect(() => { if (sc.groupLeader) load('group.list', () => call('group.list', {})); if (sc.facilitator) load('fac.devotees', () => call('fac.devotees', {})); });
  const gl = $derived(sc.groupLeader ? (cacheEntry('group.list').data?.members || []).filter((m) => m.status !== 'SUBMITTED' && m.active !== false) : []);
  const fac = $derived(sc.facilitator ? (cacheEntry('fac.devotees').data?.rows || []).filter((r) => r.status === 'NOT_STARTED' || r.status === 'MISSED') : []);
  const heard = $derived(e.data?.progress?.heard?.length);
  // the reminder is offered once, after the first day with answers saved (never on page load, never by itself)
  const filledOnce = $derived((e.data?.weeks || []).some((w) => w.days.some((d) => d.state !== 'empty')));
  // once someone fills, ask the browser to keep this phone's drafts even when space runs low (8 Oct 2026)
  $effect(() => { if (filledOnce) try { navigator.storage?.persist?.(); } catch { /* not offered */ } });
  // the reminder is on by default; Home only asks the browser's permission when it was never answered on this phone
  const askReminder = $derived(!askDismissed() && typeof Notification !== 'undefined' && Notification.permission === 'default');
  // install: once, after the first saved day, never on the same day as the reminder card, never when installed
  let installGone = $state((() => { try { return localStorage.getItem('sr.installAsk') === '1'; } catch { return true; } })());
  const askInstall = $derived(filledOnce && !askReminder && !askedToday() && !installGone && !standalone() && (!!install.prompt || isIOS()));
  // the first-run guide (Phase 4): until the first day is filled, or skipped / finished on this phone
  let guideGone = $state((() => { try { return localStorage.getItem('sr.firstRun') === '1'; } catch { return false; } })());
  const showGuide = $derived(!filledOnce && !guideGone);
  const noInstall = () => { installGone = true; try { localStorage.setItem('sr.installAsk', '1'); } catch { /* storage blocked */ } };
  // Today and This week are the hero and the week card right above: the quick actions are the other places
  // the four places Home leads to that the bar does not (8 Oct 2026: no Report, no Notices: the bar and the bell have them);
  // each icon in its category's colour, the words neutral
  const ACTIONS = $derived([
    ['hear', 'Hearing', heard ? `${heard} heard` : '', '#/hearing', 'soul'],
    ['book', 'Reading', '', '#/reading', 'soul'],
    ['clock', 'History', '', '#/history', 'body'],
    ['share', 'Share today', '', today && cur ? `#/day/${cur.weekId}/${today.date}?f=share` : '#/week', ''],
  ]);
</script>

<div class="home">
{#if e.error && !e.data}<Banner onretry={() => loadHome(true)}>{errorMessage(e.error)}</Banner>{/if}

<header class="greet">
  <p class="date t-over acc">{fmtLong(todayIST())}</p>
  <h2>Hare Krishna{first ? ', ' + first : ''}</h2>
  {#if batchName}<p class="sub">{batchName}</p>{/if}
</header>

{#if !e.data && !e.error}
  <Skeleton kind="home" />
{:else if e.data}
  <!-- Phase 24 (V16): the day's work, the quick tiles included, on the left; the news and the devotional block on the
       right, the painting and verse LAST on a phone — the verse box sizes to its quote, and nothing below it can move -->
  <div class="home-g">
  <div class="home-main">

  {#if bday.mine || bday.others}
    <p class="bday" role="status"><Icon name="gift" size={18} /><span>{#if bday.mine}<b>{bday.mine}</b>{/if}{#if bday.mine && bday.others}<br />{/if}{bday.others}</span></p>
  {/if}
  {#if showGuide}{#await loadedOnce('FirstRun', () => import('../ui/FirstRun.svelte'))}<div class="fr-wait" aria-hidden="true"></div>{:then F}<F.default ondone={() => (guideGone = true)} />{:catch}{/await}{/if}
  {#if cur}
    <!-- the one hero: the week's status line, its days, and the next action naming a day (Phase 4, 8 Oct 2026) -->
    <section class="hero-card sblock" data-s={tone} aria-labelledby="h-status">
      <p class="t-over acc m-0" id="h-status">This week · {weekLabel(cur.weekId)}</p>
      <p class="s-line">{statusLine}</p>
      {#if cur.status !== 'SUBMITTED'}<p class="s-meta">{done(cur)} of 7 days filled · closes {fmtClose(cur.closesAt)}</p>{/if}
      {#if cur.status !== 'SUBMITTED'}
        <nav class="days" aria-label="Days of this week">
          {#each cur.days as d, i}
            {#if d.future}<span class="chip chip-off" aria-label={d.name + ', opens that day'}>{DAY_SHORT[i]}<b>&middot;</b></span>
            {:else}{@const miss = isMissing(d, todayD)}<a class="chip" class:chip-done={d.state === 'complete'} class:chip-part={d.state === 'partial'} class:chip-miss={miss} class:chip-on={today && d.date === today.date} href={`#/day/${cur.weekId}/${d.date}`} aria-label={d.name + ', ' + (miss ? 'missing, not filled' : NAME[d.state])}>{DAY_SHORT[i]}<b>{SYM[miss ? 'missing' : d.state]}</b></a>{/if}
          {/each}
        </nav>
      {/if}
      <!-- the next action as a row with the person's photo or initial (the composer idea) -->
      <a class="s-pill" href={action.href}>
        {#if u?.photoAt}{#await import('../ui/Photo.svelte') then P}<span class="avatar avatar-photo" aria-hidden="true"><P.default login={u.login} name={u.name} hasPhoto own updatedAt={u.photoAt} size={32} /></span>{:catch}<span class="avatar" aria-hidden="true">{initial}</span>{/await}
        {:else}<span class="avatar" aria-hidden="true">{initial}</span>{/if}
        <span class="min-w-0 flex-1">{action.label}</span><Icon name="next" size={18} />
      </a>
      <div class="s-acts">
        {#if target && submittable}<a class="link" href={`#/week/${submittable.weekId}?f=submit`}>Submit the week of {weekLabel(submittable.weekId)}</a>{/if}
        <a class="link" href={`#/week/${cur.weekId}`}>Open the week</a>
      </div>
      {#if waiting.length}
        <p class="s-warn" role="status"><Icon name="offline" size={16} />Waiting to send (no connection):
          {#each waiting as q, i}{i ? ', ' : ' '}{DAY_LONG[(new Date(q.date + 'T12:00:00Z').getUTCDay() + 6) % 7]} {fmtShort(q.date)}{/each}. They go by themselves when you are back online.</p>
      {/if}
      {#if notSaved.length}
        <p class="s-warn" role="status"><Icon name="alert" size={16} />Not saved yet:
          {#each notSaved as q, i}{i ? ', ' : ' '}<a class="ilink" href={`#/day/${q.weekId}/${q.date}`}>{DAY_LONG[(new Date(q.date + 'T12:00:00Z').getUTCDay() + 6) % 7]} {fmtShort(q.date)}</a>{/each}.</p>
      {/if}
    </section>
  {/if}
  <!-- the other weeks still open (or just submitted): one compact row each -->
  {#if e.data.weeks.length > 1}
    <ul class="list mb-4" aria-label="Your other weeks">
      {#each e.data.weeks.filter((w) => w !== cur) as w (w.weekId)}
        <li><a class="lrow" href={`#/week/${w.weekId}${w.canSubmit && w.status !== 'SUBMITTED' ? '?f=submit' : ''}`}><span class="lmain"><span class="lt">Week of {weekLabel(w.weekId)}</span>
          <span class="ls">{w.status === 'SUBMITTED' ? 'Submitted ✓' : `${done(w)} of 7 days · ${w.canSubmit ? 'submit by ' + fmtClose(w.closesAt) : 'closes ' + fmtClose(w.closesAt)}`}</span></span><Icon name="next" size={18} /></a></li>
      {/each}
    </ul>
  {/if}
  {#if gl.length || fac.length}
    <!-- Needs you: only what is waiting, amber edge (a group leader, a facilitator) -->
    <section class="cblock needs" aria-labelledby="h-needs">
      <h2 id="h-needs" class="t-over m-0">Needs you</h2>
      <ul class="m-0 list-none p-0">
        {#if gl.length}<li><a class="lrow" href="#/group"><Icon name="users" size={20} /><span class="lmain"><span class="lt">{gl.length} in your group still to submit</span><span class="ls">{gl.slice(0, 3).map((m) => m.name.split(' ')[0]).join(', ')}{gl.length > 3 ? ' …' : ''}</span></span><Icon name="next" size={18} /></a></li>{/if}
        {#if fac.length}<li><a class="lrow" href="#/my-devotees"><Icon name="users" size={20} /><span class="lmain"><span class="lt">{fac.length} student{fac.length === 1 ? '' : 's'} not started or missed</span></span><Icon name="next" size={18} /></a></li>{/if}
      </ul>
    </section>
  {/if}

  {#if askReminder}{#await import('../ui/Reminder.svelte') then m}<m.default ask />{/await}
  {:else if askInstall}
    <section class="cblock" aria-labelledby="in-h">
      <p id="in-h" class="m-0 flex items-start gap-3"><span class="ichip" aria-hidden="true"><Icon name="down" size={18} /></span>
        <span><b class="block">Install Sadhana Record</b>{#if !install.prompt}<span class="text-sm text-muted">On iPhone: tap Share, then Add to Home Screen.</span>{/if}</span></p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-text" onclick={noInstall}>Not now</button>
        {#if install.prompt}<button type="button" class="btn btn-primary" onclick={async () => { if (await installApp()) noInstall(); }}>Install</button>{:else}<button type="button" class="btn" onclick={noInstall}>Got it</button>{/if}
      </div>
    </section>
  {/if}

  <div class="block-h mt-2 sr-only"><Refreshing on={e.refreshing} onrefresh={() => loadHome(true)} /></div>

  <div class="block-h"><h2>More</h2></div>
  <ul class="qa mb-4">
    {#each ACTIONS as [icon, label, sub, href, cat]}
      <li><a {href}><span class="ico" data-cat={cat || undefined} aria-hidden="true"><Icon name={icon} size={20} /></span><span class="qt" style:grid-row={sub ? undefined : '1 / 3'}>{label}</span>{#if sub}<span class="qs">{sub}</span>{/if}</a></li>
    {/each}
  </ul>
  </div>

  <div>
  {#if latest && unread}
    <a class="ann-teaser" href="#/wall">
      <span class="ico" aria-hidden="true"><Icon name={latest.pinned ? 'pin' : 'bell'} size={18} /></span>
      <span class="min-w-0"><span class="at">{latest.title}</span><span class="ab">{latest.author} · {relTime(shownOf(latest))} — {latest.body}</span></span>
      <Icon name="next" size={18} />
    </a>
  {/if}
  <!-- today's darshan with the verse beneath (one devotional block, Phase 4) -->
  <section class="cblock dcard" aria-label="The painting and the verse">
    <!-- loaded after the first screen: the painting is never on Home's critical path -->
    {#await loadedOnce('Darshan', () => import('../ui/Darshan.svelte')) then D}<D.default variant="card" pool="everyday" titled rotate sizes="(min-width: 1024px) 360px, (min-width: 600px) 45vw, 100vw" />{:catch}{/await}
    <Quotes fit={last} />
  </section>
  </div>
  </div>
{/if}
</div>

<style>
  /* today's birthdays in the batch: one quiet line above the week (light and dark from the tokens) */
  .bday { display: flex; align-items: flex-start; gap: var(--sp-2); margin: 0 0 var(--sp-3); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); background: var(--accent-soft); color: var(--text); font-size: var(--fs-sm); overflow-wrap: anywhere; }
  .bday :global(svg) { flex: none; margin-top: 1px; color: var(--accent); }
</style>
