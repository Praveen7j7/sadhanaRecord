<script>
  import { tick } from 'svelte';
  import Row from '../ui/Row.svelte';
  import Status from '../ui/Status.svelte';
  import { call, errorMessage, ApiError, serverNow } from '../lib/api.js';
  import { HOME, homeEntry, loadHome, loadBehalf, behalfKey, findWeek, weekEndSaved, attendanceSet, weekSubmitted } from '../lib/weekstore.js';
  import { forgetFor } from '../lib/refdata.js';
  import { entry, stale } from '../lib/cache.svelte.js';
  import { mapGaps, gapHref } from '../lib/gaps.js';
  import { resume, nav } from '../lib/router.svelte.js';
  import { holdWhileUnsaved } from '../lib/leaveguard.svelte.js';
  import { buzz, buzzErr, toast } from '../lib/pro.svelte.js';
  import { weekLabel, fmtShort, fmtClose, DAY_LONG, isMissing, DAY_SHORT } from '../lib/dates.js';
  import { todayIST } from '../lib/validate.js';
  import Seg from '../ui/Seg.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Button from '../ui/Button.svelte';
  import ScoresView from './ScoresView.svelte';
  import Icon from '../ui/Icon.svelte';
  import Ring from '../ui/Ring.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import { weekBars } from '../lib/report.js';

  // behalf: { login, name } when a coordinator fills this week for a devotee (same rules; they also submit it)
  let { weekId, focus = '', behalf = null } = $props();
  const KEY = behalf ? behalfKey(behalf.login, weekId) : HOME;
  const he = behalf ? entry(KEY) : homeEntry();
  const pre = behalf ? '/fill/' + encodeURIComponent(behalf.login) : '';
  const ob = behalf ? { onBehalfOf: behalf.login } : {};
  const link = (h) => h.replace(/^#\//, '#' + pre + '/');
  const week = $derived(findWeek(he.data, weekId));
  let error = $state('');
  let confirming = $state(false);
  let submitting = $state(false);
  let gaps = $state([]);
  let jumped = false;

  if (behalf) loadBehalf(behalf.login, weekId); else loadHome();
  $effect(() => {
    if (week && focus && !jumped) {
      jumped = true;
      setTimeout(() => { const el = document.getElementById('f-' + focus); el?.scrollIntoView({ block: 'center' }); el?.querySelector?.('button,input')?.focus?.(); }, 50);
    }
  });

  // the clock for the gates below, so an open screen unlocks by itself at the time
  let now = $state(serverNow());
  $effect(() => { now = serverNow(); const t = setInterval(() => (now = serverNow()), 30e3); return () => clearInterval(t); });
  // attendance is for the week's class, one on Sunday for everyone: the devotee's own mark opens on Sunday
  const attOpens = $derived(week?.attendance?.opensAt ? Date.parse(week.attendance.opensAt) : 0);
  const attEarly = $derived(!!attOpens && now < attOpens);
  // Night Stay and the 4 regulative principles open on Saturday at 6 PM (decision 41)
  const weOpens = $derived(week?.weekEnd?.opensAt ? Date.parse(week.weekEnd.opensAt) : 0);
  const weEarly = $derived(!!weOpens && now < weOpens);
  // who gave the mark that counts, when it is not the devotee's own
  const WHO = { leader: 'Your group leader', coordinator: 'Your coordinator', master: 'The IYF head' };
  const markWord = (m) => (m === 'P' ? 'Present' : 'Absent');
  const notDone = $derived((week?.days || []).filter((d) => !d.future && d.state !== 'complete').length);
  // a part week is an option (the head, 4 Oct 2026): the complete days count; a day not complete scores 0, so the week
  // can score at most about (complete ÷ 7) of each category
  const complete = $derived((week?.days || []).filter((d) => d.state === 'complete').length);
  const leftOut = $derived((week?.days || []).map((d, i) => (d.state === 'complete' ? '' : DAY_LONG[i])).filter(Boolean));
  const cap = $derived(Math.round((complete / 7) * 100));
  const listDays = (a) => (a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a.at(-1));
  // the dot of <Status> carries the state's colour and shape; the word says it (no second symbol)
  const STATE = { complete: 'Complete', partial: 'Partly filled', empty: 'Not filled', missing: 'Missing' };
  const today = todayIST();
  const TONE = { complete: 'ok', partial: 'warn', empty: '', missing: 'warn' };
  // the icon reinforces the word beside it, never stands in for it (docs/ICON_SCOPE_AUDIT_2026-10-18.md §5)
  const DAY_ICON = { complete: 'check', partial: 'edit', empty: 'week', missing: 'alert' };
  // the readiness checklist (Phase 4, 8 Oct 2026): what is still needed before Submit, each line taking you there
  const missDays = $derived((week?.days || []).filter((d) => !d.future && d.state !== 'complete').map((d) => DAY_SHORT[week.days.indexOf(d)]));
  const weDone = $derived(!!(week?.weekEnd?.nightStay && week?.weekEnd?.principles));
  const attDone = $derived(!!(week?.attendance?.used || week?.attendance?.devotee || week?.attendance?.classWeek));
  const READY = $derived(!week ? [] : [
    { ok: !missDays.length, text: missDays.length ? `Days to complete: ${missDays.join(', ')}` : 'Every day so far is complete', f: 'days' },
    { ok: weDone, wait: weEarly, text: weEarly ? 'Night Stay and the 4 principles open on Saturday at 6 PM' : weDone ? 'Night Stay and the 4 principles answered' : 'Answer Night Stay and the 4 principles', f: 'nightStay' },
    ...(behalf ? [] : [{ ok: attDone, wait: attEarly && !week.attendance.classWeek, text: attEarly && !week.attendance.classWeek ? 'Attendance opens on Sunday, the day of the class' : attDone ? 'Attendance marked' : 'Mark your attendance', f: 'attendance' }]),
    // the one place that says when (Phase 24, V23): the cards below show only the action
    { ok: week.canSubmit, wait: !week.canSubmit, text: week.canSubmit ? `Submit by ${fmtClose(week.closesAt)} — then complete days submit themselves` : `Submit opens ${fmtClose(week.opensAt)}`, f: 'submit' },
  ]);

  // Week-end answers: kept here as they are tapped, sent only with Save (one call with what changed and the section's version).
  let weLocal = $state(null);
  let weBusy = $state(false);
  let leaveDlg = $state(), leaveTo = $state('');
  const weSaved = $derived(week ? { nightStay: week.weekEnd.nightStay, principles: week.weekEnd.principles } : {});
  const weCur = $derived(weLocal || weSaved);
  const weDirty = $derived(!!weLocal && (weLocal.nightStay !== weSaved.nightStay || weLocal.principles !== weSaved.principles));
  const setWe = (k, v) => (weLocal = { ...weCur, [k]: v });
  async function saveWeekEnd() {
    if (!weDirty || weBusy) return false;
    const patch = Object.fromEntries(['nightStay', 'principles'].filter((k) => weLocal[k] !== weSaved[k]).map((k) => [k, weLocal[k]]));
    weBusy = true; error = '';
    try {
      const r = await call('week.saveWeekEnd', { weekId, version: week.weekEnd.version, ...patch, ...ob });
      weekEndSaved(weekId, patch, r.version, KEY);
      weLocal = null;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'STALE') {
        const c = e.data?.current || {};
        weekEndSaved(weekId, { nightStay: c.nightStay || null, principles: c.principles || null }, c.v || 0, KEY);
        weLocal = null;
        error = 'Updated on another device. Showing the latest answers.';
      } else error = e instanceof ApiError && e.code === 'NETWORK' ? 'Not sent — no connection. Tap Save again when online.' : errorMessage(e);
    }
    weBusy = false;
    return !weDirty;
  }
  $effect(() => { nav.unsaved = weDirty; });
  $effect(() => () => { nav.unsaved = false; });
  // leaving with unsaved week-end answers asks first (same wiring as the day form: audit FE-19)
  $effect(() => holdWhileUnsaved({
    dirty: () => weDirty,
    self: () => `${pre}/week/${weekId}`,
    ask: (to) => { leaveTo = to; leaveDlg?.showModal(); },
  }));
  async function leave(how) {
    if (how === 'save' && !(await saveWeekEnd())) return;
    if (how === 'stay') { leaveDlg.close(); return; }
    if (how === 'discard') weLocal = null;
    const to = leaveTo; leaveDlg.close(); resume(to);
  }

  async function setAttendance(mark) {
    const prev = { ...week.attendance };
    attendanceSet(weekId, { devotee: mark, used: prev.master || prev.coordinator || prev.leader || mark });
    error = '';
    try { attendanceSet(weekId, await call('week.setAttendance', { weekId, mark })); }
    catch (e) { attendanceSet(weekId, prev); error = errorMessage(e); }
  }

  let doneDlg = $state(), doneScore = $state(null), doneOpen = $state(false), shownScore = $state(0);
  async function submit() {
    if (submitting) return;
    submitting = true; error = ''; gaps = [];
    try {
      const r = await call('week.submit', { weekId, ...ob });
      confirming = false;
      weekSubmitted(weekId, r, KEY);
      if (behalf) stale('devotees.list:');   // the batch board shows it submitted
      if (behalf) forgetFor(behalf.login);                    // their heard list grows with this week
      buzz();
      // Phase 7: a devotee's own week ends on a small moment — today's darshan, the score, the way to the report
      if (behalf) toast(`Submitted for ${behalf.name}`); else { doneScore = r.scores ? weekBars(r.scores)[0].value : null; doneOpen = true; tick().then(() => { doneDlg?.showModal(); if (doneScore !== null) import('../lib/countup.js').then((m) => m.countUp(doneScore, (v) => (shownScore = v))); }); }
    } catch (e) {
      confirming = false; buzzErr();
      if (e instanceof ApiError && e.code === 'INCOMPLETE') { gaps = mapGaps(e.fields); error = e.message; tick().then(() => document.querySelector('.gap-list a')?.focus()); }
      else error = errorMessage(e);
    }
    submitting = false;
  }
</script>

{#if he.error && !he.data}
  <Banner onretry={() => (behalf ? loadBehalf(behalf.login, weekId, true) : loadHome(true))}>{errorMessage(he.error)}</Banner>
{:else if !he.data}
  <Skeleton kind="list" rows={7} />
{:else if !week}
  <Banner>This week is not open.</Banner>
{:else if week.status === 'MISSED'}
  <Banner kind="warn">The week of {weekLabel(weekId)} had no complete day by the deadline, so it counts as missed (score 0). Ask your coordinator to reopen it.</Banner>
{:else if week.status === 'SUBMITTED'}
  <ScoresView {weekId} onBehalfOf={behalf?.login} />
{:else}
  <div class="wk-head mb-4 mt-1 flex items-center gap-4">
    <span class="text-brand"><Ring n={week.days.filter((d) => d.state === 'complete').length} size={64} /></span>
    <div class="min-w-0">
      <h2 class="m-0">Week of {weekLabel(weekId)}</h2>
      <p class="m-0 mt-1 text-sm text-muted">Closes {fmtClose(week.closesAt)}{notDone ? ` · ${notDone} day${notDone === 1 ? '' : 's'} to finish` : ' · every day complete ✓'}</p>
    </div>
  </div>
  <!-- before you submit: one line per part, its state in words and a mark, each taking you to it -->
  <ul class="list ready mb-4" aria-label="Before you submit">
    {#each READY as r}
      <li><a class="lrow" href={`#${pre}/week/${weekId}?f=${r.f}`}><span class="rd" data-s={r.ok ? 'ok' : r.wait ? 'wait' : 'todo'} aria-hidden="true">{r.ok ? '✓' : r.wait ? '·' : '!'}</span>
        <span class="lmain"><span class="lt">{r.text}</span></span><Icon name="next" size={16} /></a></li>
    {/each}
  </ul>
  {#if error}<Banner>{error}</Banner>{/if}
  {#if gaps.length}
    <Banner>
      <ul class="gap-list m-0 grid list-none gap-1 p-0">
        {#each gaps as g}<li><a class="ilink inline-flex min-h-11 items-center" href={link(gapHref(weekId, g))}>{g.message}</a></li>{/each}
      </ul>
    </Banner>
  {/if}

  <div class="grid2">
    <!-- the days are the week: one grouped list, not a card holding a card; today is marked -->
    <section class="wk-days" aria-labelledby="h-days" id="f-days" tabindex="-1">
      <h3 id="h-days" class="sec-h"><Icon name="week" />Days</h3>
      <ul class="list">
        {#each week.days as d, i (d.date)}
          <li>
            {#if d.future}<Row disabled icon="clock" title={`${DAY_LONG[i]}, ${fmtShort(d.date)}`}>{#snippet end()}<span class="text-sm text-muted">Not yet</span>{/snippet}</Row>
            {:else}<Row href={`#${pre}/day/${weekId}/${d.date}`} icon={DAY_ICON[isMissing(d, today) ? 'missing' : d.state] || 'week'} title={`${DAY_LONG[i]}, ${fmtShort(d.date)}`} sub={d.date === today ? 'Today' : ''} aria-current={d.date === today ? 'date' : undefined} class={d.date === today ? 'wk-today' : ''}>{#snippet end()}{@const st = isMissing(d, today) ? 'missing' : d.state}<Status tone={TONE[st]} label={STATE[st]} />{/snippet}</Row>{/if}
          </li>
        {/each}
      </ul>
    </section>

    <div>
      <section class="section" aria-labelledby="h-we">
        <h3 id="h-we"><Icon name="moon" />End of week</h3>
        {#if weEarly}
          <!-- these questions are for the end of the week: shown from Saturday 6 PM (the head, 4 Oct 2026); WHEN is said once,
               in the list above (Phase 24, V23) -->
          <Status label="Not open yet" />
        {:else}
        <Seg id="f-nightStay" label="Night Stay" options={[['YES', 'Yes'], ['NO', 'No']]} value={weCur.nightStay} onchange={(v) => setWe('nightStay', v)} />
        <Seg id="f-principles" label="4 regulative principles followed" options={[['YES', 'Yes'], ['NO', 'No']]} value={weCur.principles} onchange={(v) => setWe('principles', v)} />
        <button type="button" class="btn mb-3 w-full {weDirty ? 'btn-primary' : ''}" aria-busy={weBusy || undefined} disabled={!weDirty || weBusy} onclick={saveWeekEnd}>{#if weBusy}<span class="spin" aria-hidden="true"></span>Saving…{:else}{weDirty ? 'Save changes' : 'Saved ✓'}{/if}</button>
        {/if}
      </section>

      <section class="section" aria-labelledby="h-att">
        <h3 id="h-att"><Icon name="check" />Attendance</h3>
        {#if behalf}
          <p class="m-0 text-sm text-muted">{behalf.name || 'The devotee'}'s attendance is marked on the batch board{week.attendance.used ? ` (now ${week.attendance.used === 'P' ? 'Present' : 'Absent'})` : ''}.</p>
        {:else if week.attendance.classWeek}
          <!-- a week with no regular class: the coordinator gives attendance, the devotee's own mark is not asked for -->
          <p id="f-attendance" class="banner warn m-0" role="note">No regular class this week ({week.attendance.classWeek.note}).
            {#if week.attendance.used}You are marked <b>{week.attendance.used === 'P' ? 'Present' : 'Absent'}</b>.{/if}</p>
        {:else}
          <Seg id="f-attendance" label="Attendance" srLabel options={[['P', 'Present'], ['A', 'Absent']]} value={attEarly ? null : week.attendance.devotee} onchange={setAttendance} disabled={week.attendance.locked || attEarly} />
          {#if week.attendance.notice && WHO[week.attendance.by]}
            <!-- a higher mark that differs from the devotee's own counts (decision 41); they are told here and by a notification -->
            <p class="banner warn m-0" role="note">{WHO[week.attendance.by]} marked you <b>{markWord(week.attendance.used)}</b>. You had marked {markWord(week.attendance.devotee)}; their mark counts. Talk to them if this is wrong.</p>
          {:else if WHO[week.attendance.by] && week.attendance.used}<p class="hint">{WHO[week.attendance.by]} marked you {markWord(week.attendance.used)}.</p>{/if}
        {/if}
      </section>

      <section class="section" aria-labelledby="h-sub" id="f-submit">
        <h3 id="h-sub"><Icon name="share" />Submit</h3>
        {#if complete < 7}
          <p class="banner {complete ? '' : 'warn'} mb-3 mt-0" role="note">
            <span class="b-body">{#if complete}<b>{complete} of 7 days complete.</b> Days not complete count as 0, so this week can score at most about {cap}% in each daily part. You can still fill the rest before you submit.
            {:else}One whole day needed to submit.{/if}</span>
          </p>
        {/if}
        {#if week.canSubmit}
          {#if confirming}
            <div role="alertdialog" aria-labelledby="cf-t" class="confirm mt-0 grid gap-2">
              <p id="cf-t" class="q m-0">{#if behalf}Submit for {behalf.name}? {complete === 7 ? 'All 7 days count.' : `${complete} of 7 days count; ${listDays(leftOut)} count 0.`} It cannot be changed afterwards.{:else if complete === 7}Submit this week? You cannot change it afterwards.{:else}Submit with {complete} of 7 days? {listDays(leftOut)} will count as not filled (0). You cannot change it afterwards.{/if}</p>
              <Button variant="primary" busy={submitting} onclick={submit}>Yes, submit</Button>
              <Button variant="text" disabled={submitting} onclick={() => (confirming = false)}>Cancel</Button>
            </div>
          {:else}
            {#if weDirty}<p class="hint mb-2 mt-0">Save the end-of-week answers first.</p>{/if}
            <Button variant="primary" disabled={weDirty || !complete} onclick={() => (confirming = true)}>{complete && complete < 7 ? `Submit ${complete} of 7 days` : 'Submit week'}</Button>
          {/if}
        {:else}
          <Status label="Not open yet" />
        {/if}
      </section>
    </div>
  </div>
  <Sheet bind:this={leaveDlg} back={false} titleId="wl-h" title="Save changes before leaving?" closeButton={false} onclose={() => (leaveTo = '')}>
    <div class="grid gap-2">
      <button type="button" class="btn btn-primary" disabled={weBusy} onclick={() => leave('save')}>{weBusy ? 'Saving…' : 'Save'}</button>
      <button type="button" class="btn btn-danger" onclick={() => leave('discard')}>Discard changes</button>
      <button type="button" class="btn btn-text" onclick={() => leave('stay')}>Stay</button>
    </div>
  </Sheet>
{/if}
<!-- outside the branches above: submitting swaps the form for the scores, and this sheet must stay -->
  <Sheet bind:this={doneDlg} titleId="wd-h" title="Week submitted ✓" sub={`Week of ${weekLabel(weekId)}`}>
    <div class="wd-pic">{#if doneOpen}{#await import('../ui/Darshan.svelte') then D}<D.default variant="card" pool="flagship" sizes="(min-width: 600px) 420px, 90vw" titled />{:catch}{/await}{/if}</div>
    <p class="m-0 mt-3 text-center">{#if doneScore !== null}This week: <b class="tabular"><span aria-hidden="true">{shownScore}%</span><span class="sr-only">{doneScore}%</span></b>.{' '}{/if}Hare Krishna — thank you for your sadhana.</p>
    <div class="mt-4 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => doneDlg.close()}>Done</button>
      <a class="btn btn-primary" href="#/report" onclick={() => doneDlg.close()}>See my report</a>
    </div>
  </Sheet>

<style>
  .wd-pic :global(.dv-card) { border-radius: var(--r-xl); aspect-ratio: 3 / 2; }
  .wk-days { margin-bottom: var(--sp-4); }
  .ready .lrow { min-height: 48px; }
  .rd { display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 50%; font-size: 0.8125rem; font-weight: 700; box-shadow: inset 0 0 0 1.5px var(--border-strong); color: var(--text-muted); }
  .rd[data-s='ok'] { background: var(--success); color: var(--surface-elevated); box-shadow: none; }
  .rd[data-s='todo'] { background: var(--warning); color: var(--surface-elevated); box-shadow: none; }
  .wk-days:focus { outline: none; }
  /* today: an accent bar at the start and its "Today" line in the accent */
  .wk-days :global(.wk-today) { box-shadow: inset 3px 0 0 var(--accent); }
  .wk-days :global(.wk-today .ls) { color: var(--accent); font-weight: 600; }
</style>
