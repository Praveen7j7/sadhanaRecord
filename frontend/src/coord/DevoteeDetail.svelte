<script>
  import Status from '../ui/Status.svelte';
  import '../styles/screens.css';
  import WheelSelect from '../ui/WheelSelect.svelte';
  // One devotee, for their coordinator (or the master): photo, phone and emergency contact, batch history, last weeks,
  // and the actions (each asks to confirm): facilitator / group leader, inactive / active, disable / enable, remove photo,
  // delete; a missed week: ask the master to reopen it (coordinator) or reopen it (master); master: attendance afterwards.
  import { tick } from 'svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch, stale } from '../lib/cache.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf, can } from '../lib/scopes.js';
  import { go } from '../lib/router.svelte.js';
  import { cachedMeta, loadMeta, staffBatches } from '../lib/meta.js';
  import { forgetPhoto } from '../lib/photos.js';
  import { weekLabel, fmtDate } from '../lib/dates.js';
  import { fmtDateTime } from '../lib/validate.js';
  import { fromWeekChoices, defaultOpenUntil, istIso, pastWeeks, mondayIST, BY_LABEL, STATUS, dayCells, rowReason, band, weekTitle } from '../lib/staff.js';
  import { todayIST } from '../lib/dates.js';
  import Spark from '../ui/Spark.svelte';
  import { CLASS_DAYS, classDayName, waLink, mailLink } from '../lib/contact.js';
  import { addressLine } from '../lib/address.js';
  import Seg from '../ui/Seg.svelte';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Button from '../ui/Button.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import Photo from '../ui/Photo.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  let { login } = $props();

  const sc = $derived(scopesOf(session.user));
  const key = $derived('devotees.get:' + login);
  const e = $derived(entry(key));
  const d = $derived(e.data);
  const refresh = (force = false) => load(key, () => call('devotees.get', { login }), { force });
  refresh();
  let meta = $state(cachedMeta());
  loadMeta().then((m) => (meta = m)).catch(() => {});
  const nameOf = (id) => staffBatches(meta).find((b) => b.batchId === id)?.name || id;
  const facilitators = $derived(meta.facilitators || []);
  const TONE = { ACTIVE: 'ok', INACTIVE: 'warn', DISABLED: 'bad', PENDING: 'info' };
  const tel = (p) => (/^\d{10}$/.test(p || '') ? 'tel:+91' + p : 'tel:' + (p || ''));

  let act = $state('');
  let busy = $state(false);
  let err = $state('');
  let fe = $state({});
  let note = $state('');
  // a finished training's card, opened for a correction by the head (card.unlock)
  let unlockFor = $state(''), unlockWhy = $state('');
  async function unlockCard() {
    busy = true; fe = {};
    try {
      const r = await call('card.unlock', { login, reason: unlockWhy.trim() });
      toast(`Their card is open for corrections until ${fmtDate(r.until.slice(0, 10))}.`);
      unlockFor = '';
    } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) toast(errorMessage(e), { kind: 'err' }); }
    busy = false;
  }
  let fac = $state(''), cd = $state('');
  let peopleOpen = $state(false);
  const choices = fromWeekChoices();
  // weeks a coordinator can fill for them now: this week, and last week until its deadline (the master's submit_closes setting)
  const fillWeeks = choices.filter((c) => c.label !== 'Next week');
  // a submitted week is not offered for filling (8 Oct 2026: "Fill this week" showed for a week already submitted)
  const fillable = $derived(fillWeeks.filter((c) => !(d?.weeks || []).some((w) => w.weekId === c.weekId && w.status === 'SUBMITTED')));
  let fromWeek = $state(choices[0].weekId);
  let reason = $state('');
  let phone2 = $state('');
  let until = $state(defaultOpenUntil());
  let weekId = $state('');
  // the head can change attendance for this week too, not only past ones (4 Oct 2026)
  const weeksBack = [mondayIST(), ...pastWeeks()];
  let ovWeek = $state(weeksBack[0]);
  let ovMark = $state('P');
  let reopened = $state({});

  async function open(a, extra = {}) {
    act = a; err = ''; fe = {}; reason = ''; phone2 = ''; fromWeek = choices[0].weekId; until = defaultOpenUntil();
    if (extra.weekId) weekId = extra.weekId;
    await tick();
    document.getElementById('cf-t')?.focus();
  }
  /*
   * Promotion (the head, 16 Oct 2026). SPS and everything after it runs with no fixed duration and
   * is never closed, so this is the only way somebody moves up from them — one devotee at a time,
   * when their coordinator judges them ready. The options come from the server, which knows the
   * ladder: a coordinator is offered only the levels above this one, the head is offered the rest
   * as well and the move is recorded as off-ladder.
   */
  let promoteOpen = $state(false);
  let promoteTo = $state('');
  let promoteOpts = $state(null);
  async function openPromote() {
    promoteOpen = true; promoteTo = ''; promoteOpts = null; open('');
    try { promoteOpts = await call('devotees.promoteOptions', { login }); } catch (x) { err = errorMessage(x); }
  }

  async function run(action, data, after, msg) {
    if (busy) return;
    busy = true; err = ''; fe = {};
    try {
      const r = await call(action, data);
      after?.(r);
      if (msg) toast(typeof msg === 'function' ? msg(r) : msg);
      act = '';
    } catch (x) { err = errorMessage(x); fe = fieldErrors(x); }
    busy = false;
  }
  // keep the batch board in step (no refetch)
  const fixRow = (fn) => patch('devotees.list:' + d.batchId, (x) => ({ ...x, rows: x.rows.map((r) => (r.login === login ? fn(r) : r)) }));
  const fixMe = (o) => patch(key, (x) => ({ ...x, ...o }));
  const setStatus = (r) => { stale('activity.notices'); fixMe({ status: r.status }); fixRow((row) => ({ ...row, accountStatus: r.status, membership: r.status === 'INACTIVE' ? 'INACTIVE' : row.membership })); };

  function savePeople() {
    const data = { login };
    if (fac !== d.facilitator) data.facilitator = fac;
    if (cd !== (d.classDay || '')) data.classDay = cd;
    run('devotees.setPeople', data, (r) => { fixMe(r); fixRow((row) => ({ ...row, ...r })); peopleOpen = false; }, 'Facilitator and class day saved.');
  }
  // Phase 5: this week's row from the batch board (already loaded when they came from it), the last weeks as a sparkline
  const boardRow = $derived(d ? (entry('devotees.list:' + d.batchId).data?.rows || []).find((r) => r.login === login) : null);
  const boardWeek = $derived(d ? entry('devotees.list:' + d.batchId).data?.weekId : '');
  const trend = $derived((d?.lastWeeks || []).map((w) => (w.status === 'SUBMITTED' ? w.overall ?? 0 : 0)).reverse());
  let asked = $state({});
  const weekName = (w) => choices.find((c) => c.weekId === w)?.label.toLowerCase() || 'the week of ' + weekLabel(w);
</script>

{#snippet ask(title, body, label, onok, danger = false)}
  <div class="confirm {danger ? 'danger' : ''}" role="group" aria-labelledby="cf-t">
    <p id="cf-t" class="q" tabindex="-1">{title}</p>
    {@render body?.()}
    <ValidationMessage error={err} />
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => (act = '')}>Cancel</button>
      <Button variant={danger ? 'danger-solid' : 'primary'} {busy} onclick={onok}>{label}</Button>
    </div>
  </div>
{/snippet}
{#snippet reasonField()}<TextInput id="cf-reason" label="Reason" bind:value={reason} error={fe.reason} maxlength="200" autocomplete="off" />{/snippet}
{#snippet fromField()}
  <WheelSelect id="cf-from" label="From" bind:value={fromWeek} options={choices.map((c) => [c.weekId, `${c.label} (week of ${weekLabel(c.weekId)})`])} error={fe.fromWeek} />
{/snippet}

{#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="detail" />
{:else if d}
  <Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />
  <div class="grid2">
    <div>
      <section class="section" aria-labelledby="dv-name">
        <div class="mb-4 flex items-center gap-4">
          <Photo login={d.login} name={d.name} hasPhoto={d.hasPhoto} updatedAt={d.photoUpdatedAt} size={80} />
          <div class="min-w-0">
            <h2 id="dv-name" class="m-0 break-words">{d.name}</h2>
            <p class="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <Status tone={TONE[d.status]} label={d.status[0] + d.status.slice(1).toLowerCase()} /><span>{nameOf(d.batchId)}{#if d.iyfId} · {d.iyfId}{/if}</span>
            </p>
          </div>
        </div>
        <!-- one row of ways to reach them (no repeats below) -->
        <div class="dv-contact">
          <a class="btn btn-primary" href={tel(d.login)}><Icon name="phone" size={18} />Call<span class="sr-only"> {d.login}</span></a>
          {#if waLink(d.whatsapp)}<a class="btn" href={waLink(d.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="msg" size={18} />WhatsApp<span class="sr-only"> {d.whatsapp} (opens WhatsApp)</span></a>{/if}
          {#if d.email}<a class="btn" href={mailLink(d.email)}><Icon name="share" size={18} />Email<span class="sr-only"> {d.email}</span></a>{/if}
        </div>
        <p class="m-0 mt-2 text-sm text-muted">{d.login}{d.whatsapp && d.whatsapp !== d.login ? ' · WhatsApp ' + d.whatsapp : ''}{d.email ? ' · ' + d.email : ''}</p>
        <details class="dv-more mt-3">
          <summary><span>Details <span class="text-sm font-normal text-muted">· birthday, blood group, address, emergency</span></span><Icon name="down" size={18} /></summary>
        <dl class="kv mt-2 text-left">
          {#if d.since}<dt>In batch since</dt><dd>week of {weekLabel(d.since)}</dd>{/if}
          {#if d.levelEntryDate}<dt>Level entry</dt><dd>{fmtDate(d.levelEntryDate)}</dd>{/if}
          {#if d.profile?.dob}<dt>Birthday</dt><dd>{fmtDate(d.profile.dob)}{d.profile.age !== null ? ` (${d.profile.age})` : ''}</dd>{/if}
          {#if d.profile?.bloodGroup}<dt>Blood group</dt><dd>{d.profile.bloodGroup}</dd>{/if}
          <!-- the address: only the devotee changes it (Account), the coordinator and the head see it -->
          {#if d.profile}<dt>Address</dt><dd class="break-words">{d.profile.address ? addressLine(d.profile.address) : 'Not added yet'}</dd>{/if}
        </dl>
        {#if d.profile?.emergency?.phone}
          <div class="dv-emg">
            <p class="t-over m-0">Emergency contact</p>
            <p class="m-0 mb-2 mt-1 font-medium">{d.profile.emergency.name} <span class="font-normal text-muted">({d.profile.emergency.relation})</span></p>
            <a class="btn btn-outline btn-block" href={tel(d.profile.emergency.phone)}><Icon name="phone" size={18} />Call {d.profile.emergency.phone}</a>
          </div>
        {/if}
        </details>
      </section>

      <!-- this week: where they are, and "Fill for" while a week is open and not submitted -->
      <section class="section" aria-labelledby="dv-tw" data-area="coordinator">
        <h3 id="dv-tw"><Icon name="week" />{weekTitle(boardWeek)}</h3>
        {#if boardRow}
          {@const [label, tone] = STATUS[boardRow.status] || [boardRow.status, '']}
          <p class="m-0 flex flex-wrap items-center gap-x-3 gap-y-1"><Status {tone} {label} /><span class="strip" role="img" aria-label={`${boardRow.daysFilled} of 7 days filled`}>{#each dayCells(boardRow, boardWeek, todayIST()) as c}<i data-s={c}></i>{/each}</span></p>
          <p class="m-0 mt-1 text-sm text-muted">{rowReason(boardRow, boardWeek, todayIST())}</p>
        {/if}
        {#if d.status === 'ACTIVE'}
          <div class="mt-3 grid gap-2">
            {#each fillable as c (c.weekId)}<div class="grid grid-cols-[1fr_auto] gap-2"><a class="btn btn-primary" href={`#/fill/${encodeURIComponent(d.login)}/week/${c.weekId}?n=${encodeURIComponent(d.name)}`}><Icon name="edit" size={18} />Fill for {d.name.split(' ')[0]} · {c.label.toLowerCase()}</a><a class="btn" href={`#/devotee/${encodeURIComponent(d.login)}/week/${c.weekId}`} aria-label={`View ${c.label.toLowerCase()} (week of ${weekLabel(c.weekId)})`}>View</a></div>{:else}<p class="hint m-0">The open weeks are already submitted.</p>{/each}
          </div>
          {#if fillable.length}<p class="hint mb-0 mt-2">When {d.name.split(' ')[0]} cannot fill the form, fill it for them. It is saved as filled by the coordinator.</p>{/if}
        {/if}
        {#if trend.length > 1}<p class="m-0 mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">Last {trend.length} weeks <Spark values={trend} label={`${d.name}, last ${trend.length} weeks`} /></p>{/if}
      </section>

      <section class="section" aria-labelledby="dv-people">
        <h3 id="dv-people"><Icon name="user" />Facilitator and class</h3>
        <dl class="kv"><dt>Facilitator</dt><dd>{d.facilitator || '—'}</dd><dt>Class day</dt><dd>{#if d.classDay}{classDayName(d.classDay)}{:else}<span class="pill" data-tone="warn">Class day not set</span>{/if}</dd></dl>
        {#if d.status !== 'PENDING'}
          {#if !peopleOpen}
            <button type="button" class="btn btn-block mt-3" onclick={() => { fac = d.facilitator; cd = d.classDay || ''; peopleOpen = true; open(''); }}><Icon name="edit" size={16} />Change</button>
          {:else}
            <div class="mt-3">
              <WheelSelect id="dv-fac" label="Facilitator" bind:value={fac} options={facilitators} error={fe.facilitator} />
              <Seg id="dv-cd" label="Class day" options={CLASS_DAYS} value={cd} onchange={(v) => (cd = v)} error={fe.classDay} />
              {#if act === 'people'}
                {@render ask(`Change to ${fac || 'no facilitator'}, ${classDayName(cd) || 'no'} class?`, null, 'Yes, save', savePeople)}
              {:else}
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" class="btn btn-outline" onclick={() => (peopleOpen = false)}>Cancel</button>
                  <button type="button" class="btn btn-primary" disabled={!cd || (fac === d.facilitator && cd === (d.classDay || ''))} onclick={() => open('people')}>Save</button>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </section>

      <section class="section" aria-labelledby="dv-mem">
        <h3 id="dv-mem"><Icon name="grid" />Batch history</h3>
        {#if d.status === 'ACTIVE'}
          {#if !promoteOpen}
            <button type="button" class="btn btn-block mb-3" onclick={openPromote}><Icon name="next" size={16} />Promote to the next level</button>
          {:else if promoteOpts}
            <div class="mb-3">
              {#if !promoteOpts.batches.length}
                <p class="m-0 text-sm text-muted">
                  {promoteOpts.nextLevels.length
                    ? `No open ${promoteOpts.nextLevels.join(' or ')} batch to move ${d.name} into. Create one first.`
                    : `There is no level above ${promoteOpts.level}.`}
                </p>
                <button type="button" class="btn btn-outline btn-block mt-2" onclick={() => (promoteOpen = false)}>Close</button>
              {:else}
                <WheelSelect id="dv-promote" label="Move up to" bind:value={promoteTo} error={fe.toBatch}
                  options={promoteOpts.batches.map((b) => [b.batchId, b.offLadder ? `${b.name} (off the usual path)` : b.name])} />
                {#if act === 'promote'}
                  {@render ask(`Move ${d.name} to ${promoteOpts.batches.find((b) => b.batchId === promoteTo)?.name}?`, null, 'Yes, promote',
                    () => run('devotees.promote', { login, toBatch: promoteTo },
                      () => { promoteOpen = false; refresh(true); }, (r) => `${d.name} is now in ${r.toBatch}.`))}
                {:else}
                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" class="btn btn-outline" onclick={() => (promoteOpen = false)}>Cancel</button>
                    <button type="button" class="btn btn-primary" disabled={!promoteTo} onclick={() => open('promote')}>Promote</button>
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        {/if}
        <ul class="list dv-list shadow-none">
          {#each d.memberships as m, i (i)}
            <li class="text-sm">
              <p class="m-0 font-medium">{nameOf(m.batchId)} <Status tone={m.state === 'ACTIVE' ? 'ok' : 'warn'} label={m.state[0] + m.state.slice(1).toLowerCase()} /></p>
              <p class="m-0 text-muted">From week of {weekLabel(m.fromWeek)}{m.toWeek ? ' to week of ' + weekLabel(m.toWeek) : ''}</p>
              {#if m.facilitator || m.classDay}<p class="m-0 text-muted">{[m.facilitator, m.classDay && classDayName(m.classDay) + ' class'].filter(Boolean).join(' · ')}</p>{/if}
              {#if m.reason}<p class="m-0 text-muted">{m.reason}</p>{/if}
            </li>
          {:else}<li class="text-sm text-muted">No batch yet.</li>{/each}
        </ul>
      </section>
      {#if d.trainings?.length}
        <!-- the trainings they have been through: a finished one is a frozen record (ADR 0010/0017). The head alone may
             let them correct ONE card for 7 days, with a reason (card.unlock); it closes again by itself. -->
        <section class="section" aria-labelledby="dv-tr">
          <h3 id="dv-tr"><Icon name="up" />Trainings</h3>
          <ul class="dv-trl">
            {#each d.trainings as tr (tr.batchId)}
              <li>
                <div class="dv-trh"><strong>{tr.name}</strong>
                  {#if tr.running}<span class="pill" data-tone="info">Running</span>{:else}<span class="pill">Finished{tr.finishedOn ? ' ' + fmtDate(tr.finishedOn) : ''}</span>{/if}</div>
                <p class="m-0 text-sm text-muted">{tr.average === null ? 'No card figures yet' : `Seva ${tr.average}% · ${tr.filled} of ${tr.weeks} weeks filled`}</p>
                {#if sc.master && !tr.running && tr === d.trainings.find((x) => !x.running)}
                  {#if unlockFor === tr.batchId}
                    <TextInput id="dv-unl" label="Why open their card?" bind:value={unlockWhy} error={fe.reason} hint="Open for 7 days, then it closes by itself. Kept in Activity." />
                    <div class="grid grid-cols-2 gap-2">
                      <button type="button" class="btn btn-outline" onclick={() => (unlockFor = '')}>Cancel</button>
                      <Button variant="primary" {busy} onclick={unlockCard}>Open their card</Button>
                    </div>
                  {:else}
                    <button type="button" class="btn btn-text btn-sm -ml-2.5" onclick={() => { unlockFor = tr.batchId; unlockWhy = ''; fe = {}; }}>Let them correct their card…</button>
                  {/if}
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>

    <div>
      <section class="section" aria-labelledby="dv-weeks">
        <h3 id="dv-weeks"><Icon name="week" />Last weeks</h3>
        <!-- one grouped list of weeks (no box per week); each keeps its attendance and reopen controls -->
        <ul class="list dv-list shadow-none">
          {#each d.lastWeeks as w (w.weekId)}
            <li>
              <div class="flex items-center justify-between gap-2">
                <span class="min-w-0"><span class="block font-medium">Week of {weekLabel(w.weekId)}</span>
                  {#if w.byCoordinator}<span class="block text-xs text-muted">filled by the coordinator</span>{/if}
                  {#if reopened[w.weekId] || w.openUntil}<span class="block text-xs text-muted">reopened until {fmtDateTime(reopened[w.weekId] || w.openUntil)}</span>{/if}</span>
                {#if sc.master && w.status === 'SUBMITTED'}<a class="ilink -my-3 inline-flex min-h-11 shrink-0 items-center px-1 text-sm" href={`#/devotee/${encodeURIComponent(d.login)}/week/${w.weekId}`}>View</a>{/if}
                {#if w.status === 'SUBMITTED'}<span class="score-pill" data-b={band(w.overall)}>{w.overall}%{(w.daysFilled ?? 7) < 7 ? ` · ${w.daysFilled}/7` : ''}</span>
                {:else if w.status === 'REOPENED' || reopened[w.weekId]}<Status class="shrink-0" label="Reopened" />
                {:else}<Status class="shrink-0" tone="bad" label="Missed" />{/if}
              </div>
              <!-- the attendance that counts that week, who gave it; the head changes it right here (with a reason, logged) -->
              <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-muted">Attendance:</span>
                <b>{w.attendance?.used === 'P' ? 'Present' : w.attendance?.used === 'A' ? 'Absent' : 'not marked'}</b>{#if w.attendance?.by && w.attendance.by !== 'devotee'}<span class="text-xs text-muted">({BY_LABEL[w.attendance.by] || w.attendance.by})</span>{/if}
                {#if sc.master && act !== 'mark-' + w.weekId}
                  <span class="pa ml-auto" role="group" aria-label={'Change attendance, week of ' + weekLabel(w.weekId)}>
                    {#each ['P', 'A'] as m}<button type="button" aria-pressed={w.attendance?.used === m} onclick={() => { ovWeek = w.weekId; ovMark = m; open('mark-' + w.weekId); }}>{m}</button>{/each}
                  </span>
                {/if}
              </div>
              {#if act === 'mark-' + w.weekId}
                {#snippet markBody()}{@render reasonField()}{/snippet}
                {@render ask(`Mark ${ovMark === 'P' ? 'Present' : 'Absent'} for the week of ${weekLabel(w.weekId)}?`, markBody, 'Save', () => run('attendance.override', { login, weekId: w.weekId, mark: ovMark, reason: reason.trim() },
                  (r) => fixMe({ lastWeeks: d.lastWeeks.map((x) => (x.weekId === w.weekId ? { ...x, attendance: { used: r.used, by: r.by || 'master' } } : x)) }),
                  `Attendance for the week of ${weekLabel(w.weekId)}: ${ovMark === 'P' ? 'present' : 'absent'}.`))}
              {/if}
              {#if w.status === 'MISSED' && !reopened[w.weekId] && d.status === 'ACTIVE'}
                {#if act === 'reopen' && weekId === w.weekId}
                  {#if sc.master}
                    {#snippet reopenBody()}
                      {@render reasonField()}
                      <DateInput id="cf-until" label="Open until (Indian time)" time bind:value={until} error={fe.openUntil} />
                      <p class="hint m-0">The week starts empty again; they fill it and submit by then.</p>
                    {/snippet}
                    {@render ask(`Reopen the week of ${weekLabel(w.weekId)}?`, reopenBody, 'Reopen', () => run('weeks.reopen', { login, weekId: w.weekId, reason: reason.trim(), openUntil: istIso(until) }, (r) => {
                      reopened = { ...reopened, [w.weekId]: r.openUntil };
                      patch('reopen.list', (x) => ({ ...x, requests: x.requests.filter((q) => !(q.login === login && q.weekId === w.weekId)) }));
                    }, `The week of ${weekLabel(w.weekId)} is open again.`))}
                  {:else}
                    {#snippet askBody()}{@render reasonField()}<p class="hint m-0">The IYF head decides; the week stays missed until then.</p>{/snippet}
                    {@render ask(`Ask the IYF head to reopen the week of ${weekLabel(w.weekId)}?`, askBody, 'Send request', () => run('reopen.request', { login, weekId: w.weekId, reason: reason.trim() }, () => (asked = { ...asked, [w.weekId]: true }), 'Request sent to the IYF head.'))}
                  {/if}
                {:else if asked[w.weekId] && !sc.master}
                  <p class="m-0 mt-2 text-sm text-muted">Waiting for the IYF head.</p>
                {:else}
                  <button type="button" class="btn btn-block mt-2" onclick={() => open('reopen', { weekId: w.weekId })}>{sc.master ? 'Reopen this week' : 'Ask to reopen'}</button>
                {/if}
              {/if}
            </li>
          {:else}<EmptyState tag="li" icon="week">No submitted or missed weeks yet.</EmptyState>{/each}
        </ul>
      </section>

      {#if sc.master}
        <section class="section" aria-labelledby="dv-att">
          <h3 id="dv-att"><Icon name="check" />Change attendance</h3>
          {#if act === 'override'}
            {#snippet ovBody()}
              <WheelSelect id="cf-ovw" label="Week" bind:value={ovWeek} options={weeksBack.map((w) => [w, 'Week of ' + weekLabel(w)])} />
              <div class="field">
                <p class="label" id="cf-ovm">Mark</p>
                <div class="seg" role="group" aria-labelledby="cf-ovm">
                  {#each [['P', 'Present'], ['A', 'Absent'], ['', 'Clear']] as [v, t]}<button type="button" aria-pressed={ovMark === v} onclick={() => (ovMark = v)}>{t}</button>{/each}
                </div>
              </div>
              {@render reasonField()}
            {/snippet}
            {@render ask('Change attendance', ovBody, 'Save', () => run('attendance.override', { login, weekId: ovWeek, mark: ovMark || null, reason: reason.trim() }, null,
              () => `Attendance for the week of ${weekLabel(ovWeek)}: ${ovMark === 'P' ? 'present' : ovMark === 'A' ? 'absent' : 'cleared'}.`))}
          {:else}
            <p class="mb-3 mt-0 text-sm text-muted">Any week: this week or one of the last eight.</p>
            <button type="button" class="btn btn-block" onclick={() => open('override')}>Change attendance</button>
          {/if}
        </section>
      {/if}

      <!-- the account actions sit apart, folded; each still asks to confirm and says what it does -->
      <details class="section dv-acts" open={!!act && ['active', 'disable', 'photo', 'delete'].includes(act)}>
        <summary><h3 id="dv-acc" class="m-0"><Icon name="more" />More actions</h3><span class="text-sm text-muted">Inactive, disable, photo, delete</span></summary>
        {#if d.status === 'PENDING'}<p class="mt-0 text-sm text-muted">Waiting for approval: <a class="ilink" href="#/requests">open Requests</a>.</p>{/if}
        <div class="grid gap-2">
          {#if d.status === 'ACTIVE' || d.status === 'INACTIVE'}
            {#if act === 'active'}
              {@render ask(d.status === 'ACTIVE' ? `Mark ${d.name} inactive?` : `Make ${d.name} active again?`, fromField, d.status === 'ACTIVE' ? 'Mark inactive' : 'Make active',
                () => run('devotees.setActive', { login, active: d.status !== 'ACTIVE', fromWeek }, setStatus, (r) => (r.status === 'ACTIVE' ? 'Active again from ' : 'Inactive from ') + weekName(r.fromWeek || fromWeek) + (r.status === 'ACTIVE' ? '.' : '; their login still works.')))}
            {:else}
              <button type="button" class="btn btn-outline btn-block" onclick={() => open('active')}>{d.status === 'ACTIVE' ? 'Mark inactive' : 'Make active again'}</button>
              <p class="hint m-0">{d.status === 'ACTIVE' ? 'Not counted from that week. They keep their login and past weeks; a day they fill makes them active again (opening the app does not).' : 'Same batch, facilitator and group leader; no new approval.'}</p>
            {/if}
          {/if}
          {#if d.status !== 'PENDING'}
            {#if act === 'disable'}
              {#snippet disBody()}<p class="m-0 text-sm">{d.status === 'DISABLED' ? 'They can log in again.' : 'They are logged out and cannot log in until you enable the account.'}</p>{/snippet}
              {@render ask(d.status === 'DISABLED' ? `Enable ${d.name}'s login?` : `Disable ${d.name}'s login?`, disBody, d.status === 'DISABLED' ? 'Enable' : 'Disable',
                () => run('devotees.setDisabled', { login, disabled: d.status !== 'DISABLED' }, setStatus, (r) => `The account is now ${r.status.toLowerCase()}.`), d.status !== 'DISABLED')}
            {:else}
              <button type="button" class="btn btn-block {d.status === 'DISABLED' ? 'btn-outline' : 'btn-danger'}" onclick={() => open('disable')}>{d.status === 'DISABLED' ? 'Enable login' : 'Disable login'}</button>
            {/if}
          {/if}
          {#if d.hasPhoto}
            {#if act === 'photo'}
              {@render ask('Remove their photo?', reasonField, 'Remove photo', () => run('photo.remove', { login, reason: reason.trim() }, () => {
                fixMe({ hasPhoto: false }); fixRow((r) => ({ ...r, hasPhoto: false })); forgetPhoto(login);
              }, 'Photo removed.'), true)}
            {:else}
              <button type="button" class="btn btn-danger btn-block" onclick={() => open('photo')}><Icon name="trash" size={16} />Remove photo</button>
            {/if}
          {/if}
          {#if act === 'delete'}
            {#snippet delBody()}
              <p class="m-0 mb-2 text-sm">Their login, unsent drafts, profile and photo are removed. Submitted weeks, missed weeks and attendance are kept. The number can sign up again.</p>
              <TextInput id="cf-phone" label={`Type the phone number (${d.login}) to confirm`} type="tel" inputmode="numeric" bind:value={phone2} error={fe.confirmPhone} autocomplete="off" />
            {/snippet}
            {@render ask(`Delete ${d.name}'s account?`, delBody, 'Delete', () => run('devotees.delete', { login, confirmPhone: phone2.trim() }, () => {
              patch('devotees.list:' + d.batchId, (x) => ({ ...x, rows: x.rows.filter((r) => r.login !== login) }));
              forgetPhoto(login);
              go('/batch');
            }, 'Account deleted.'), true)}
          {:else}
            {#if can(sc, 'deleteAccounts')}<button type="button" class="btn btn-danger btn-block" onclick={() => open('delete')}><Icon name="trash" size={16} />Delete account</button>{/if}
          {/if}
        </div>
      </details>
    </div>
  </div>
{/if}

<style>
  .dv-list > li { padding: 12px 14px; }
  .dv-contact { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
  .dv-more > summary, .dv-acts > summary { display: flex; flex-wrap: nowrap; align-items: center; justify-content: space-between; gap: 4px 12px; min-height: 44px; list-style: none; cursor: pointer; font-weight: 600; }
  .dv-more > summary::-webkit-details-marker, .dv-acts > summary::-webkit-details-marker { display: none; }
  .dv-more[open] > summary :global(svg) { transform: rotate(180deg); }
  .dv-acts > summary h3 { display: flex; align-items: center; gap: 8px; }
  .dv-acts > summary { flex-wrap: wrap; }
  .dv-acts[open] > summary { margin-bottom: var(--sp-3); }
  .dv-emg { margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--divider); }
  .dv-trl { display: grid; gap: var(--sp-3); margin: 0; padding: 0; list-style: none; }
  .dv-trh { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
</style>
