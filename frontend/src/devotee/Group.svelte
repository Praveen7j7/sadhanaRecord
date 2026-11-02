<script>
  import Status from '../ui/Status.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import '../styles/screens.css';
  // My group (decision 41, the head 3 Oct 2026): a group leader — a devotee of the batch appointed by the coordinator —
  // sees the week of each member of their group, calls or messages those who have not filled it (the links sit next to
  // each name), and marks the group's Sunday class attendance, from Sunday until the Monday 9 PM deadline. The
  // coordinator's (and the IYF head's) mark counts over the leader's; the leader's counts over the devotee's own.
  import { untrack } from 'svelte';
  import { call, errorMessage, serverNow } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { fmtClose, fmtLong, dowShort, todayIST } from '../lib/dates.js';
  import { waLink, telLink } from '../lib/contact.js';
  import { STATUS, boardCounts, dayCells, effectiveMark, classDefault, attendanceDiff, applyMarks, markOpen, reopenedNow, rowReason, missingDays, workOrder } from '../lib/staff.js';
  import { toast, buzz } from '../lib/pro.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Button from '../ui/Button.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import WeekPicker from '../ui/WeekPicker.svelte';
  import ScopeStrip from '../ui/ScopeStrip.svelte';
  import RingRow from '../ui/RingRow.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import { windowSay } from '../lib/meta.js';   // the fallback deadline follows the master setting too

  // the week: '' = the focus week (last week until its Monday 9 PM deadline, then this week); WeekPicker for others
  const FOCUS = 'group.list';
  let picked = $state('');
  const focusW = $derived(entry(FOCUS).data?.weekId);
  const KEY = $derived(picked ? FOCUS + ':' + picked : FOCUS);
  const e = $derived(entry(KEY));
  const d = $derived(e.data);
  const refresh = (force = false) => load(KEY, () => call('group.list', picked ? { weekId: picked } : {}), { force });
  $effect(() => { KEY; untrack(() => { edits = {}; saveErr = ''; refresh(); }); });

  // those who still need a call first: not started, then filling, then missed, then submitted. The order is kept while
  // marking (rows never jump under a finger); it follows the server's list again on the next load.
  const members = $derived(workOrder(d?.members || []));
  const today = todayIST();
  const counts = $derived(boardCounts(members));
  const cw = $derived(d?.classWeek || null);
  let edits = $state({}), saving = $state(false), saveErr = $state('');
  const changes = $derived(attendanceDiff(members, edits, 'leader'));
  let tickNow = $state(serverNow());
  $effect(() => { d; tickNow = serverNow(); const t = setInterval(() => (tickNow = serverNow()), 30e3); return () => clearInterval(t); });
  const canMark = (r) => markOpen(r, d, tickNow);
  const open = $derived(members.some(canMark));
  const closed = $derived(d ? tickNow >= Date.parse(d.closesAt) : false);

  function mark(r, m) {
    const cur = r.login in edits ? edits[r.login] : r.attendance?.leader ?? null;
    edits = { ...edits, [r.login]: cur === m ? null : m };          // tapping the chosen mark again clears it
  }
  async function save() {
    if (!changes.length || saving) return;
    saving = true; saveErr = '';
    const marks = changes, c = cw, k = KEY, wk = d.weekId;
    // what each changed person had before: Undo sends it back (Phase 7: inline undo, as on the batch board)
    const prev = marks.map((m) => ({ login: m.login, mark: members.find((r) => r.login === m.login)?.attendance?.leader ?? null }));
    try {
      await call('group.mark', { weekId: wk, marks });
      patch(k, (x) => ({ ...x, members: applyMarks(x.members, marks, c, 'leader') }));
      edits = {};
      buzz();
      toast(`Attendance saved for ${marks.length} devotee${marks.length === 1 ? '' : 's'}.`, { action: { label: 'Undo', run: async () => {
        try { await call('group.mark', { weekId: wk, marks: prev }); patch(k, (x) => ({ ...x, members: applyMarks(x.members, prev, c, 'leader') })); toast('Attendance put back.', { kind: 'info' }); }
        catch (err) { toast(errorMessage(err), { kind: 'err' }); }
      } } });
    } catch (err) { saveErr = errorMessage(err); }
    saving = false;
  }
  const word = (m) => (m === 'P' ? 'Present' : m === 'A' ? 'Absent' : '');
  const first = (n) => n.split(' ')[0];
  // a row opens the call sheet (Call / WhatsApp); "Nudge all" lists who gets the message, one WhatsApp at a time
  let who = $state(null), callSheet = $state(), nudgeSheet = $state(), sent = $state({});
  const openCall = (r) => { who = r; callSheet?.showModal(); };
  const nudge = (r) => {
    const base = waLink(r.whatsapp);
    if (!base) return '';
    const msg = r.status === 'SUBMITTED' ? `Hare Krishna ${first(r.name)} Prabhu! Thank you for submitting your sadhana this week.`
      : `Hare Krishna ${first(r.name)} Prabhu! A gentle reminder to fill and submit your sadhana for this week in the app (it closes ${d ? fmtClose(d.closesAt) : windowSay().closesText}).`;
    return base + '?text=' + encodeURIComponent(msg);
  };
</script>

<PageHeader title={d ? d.members.length + (d.members.length === 1 ? ' devotee' : ' devotees') : ' '}>{#snippet actions()}{#if d}<Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{/if}{/snippet}</PageHeader>
{#if d}<WeekPicker id="gl-wk" focus={focusW || d.weekId} value={picked} closes={fmtClose(d.closesAt)} {closed} onchange={(w) => (picked = w)} />{/if}

{#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="list" rows={5} />
{:else if d}
  {#if !members.length}
    <EmptyState icon="users" title="No one in your group yet">Your coordinator adds devotees to your group. Ask them if this looks wrong.</EmptyState>
  {:else}
    {@const todo = members.filter((r) => r.status !== 'SUBMITTED')}
    {@const done = members.filter((r) => r.status === 'SUBMITTED')}
    {@const canNudge = todo.filter((r) => nudge(r))}
    <!-- one summary (Phase 5): the counts and when the week closes -->
    <ScopeStrip {counts} />
    <RingRow people={members.map((r) => ({ ...r, missing: missingDays(r, d.weekId, today).length }))} onpick={openCall} />
    {#if closed}<Banner kind="warn">Attendance closed {fmtClose(d.closesAt)}. Ask your coordinator to change a mark.</Banner>
    {:else if !d.attendanceOpen && !open}<Banner kind="info">Attendance opens {fmtLong(d.attendanceOpensAt.slice(0, 10))} — the class day.</Banner>{/if}
    {#if cw}<Banner kind="warn">No regular class this week ({cw.note}). {cw.everyonePresent ? 'Everyone is Present unless marked Absent.' : 'Only those marked Present count.'}</Banner>{/if}

    {#if todo.length}
      <div class="gl-h"><h3 class="m-0">Still to submit <span>{todo.length}</span></h3>
        {#if canNudge.length && !closed}<button type="button" class="btn btn-text btn-sm" onclick={() => nudgeSheet?.showModal()}><Icon name="msg" size={16} />Nudge all ({canNudge.length})</button>{/if}
      </div>
      <div class="board gl-todo">{@render list(todo, 'Still to submit')}</div>
    {:else}
      <p class="gl-all" role="status"><Icon name="ok" size={18} />Everyone in your group has submitted. Hare Krishna.</p>
    {/if}
    {#if done.length}
      {#if done.length > 8}
        <details class="gl-fold"><summary class="gl-h"><h3 class="m-0">Submitted <span>{done.length}</span></h3><Icon name="down" size={18} /></summary>
          <div class="board">{@render list(done, 'Submitted')}</div></details>
      {:else}
        <div class="gl-h"><h3 class="m-0">Submitted <span>{done.length}</span></h3></div>
        <div class="board">{@render list(done, 'Submitted')}</div>
      {/if}
    {/if}

    {#if open}<p class="hint">Tap P or A for who came to the Sunday class, then Save. Dashed: their own mark. Tap a chosen mark again to clear it.</p>{/if}
    {#if open && (changes.length || saveErr)}
      <div class="actionbar mt-3">
        <p class="sum m-0 text-sm" role="status">{changes.length} attendance change{changes.length === 1 ? '' : 's'} not saved</p>
        {#if saveErr}<p class="sum err m-0 justify-center" role="alert">{saveErr}</p>{/if}
        <button type="button" class="btn btn-outline" disabled={saving} onclick={() => { edits = {}; saveErr = ''; }}>Undo</button>
        <Button variant="primary" busy={saving} onclick={save}>Save attendance</Button>
      </div>
    {/if}

    <Sheet bind:this={callSheet} titleId="gl-call-h" title={who?.name || ''} sub={who ? rowReason(who, d.weekId, today) : ''}>
      {#if who}
        <div class="grid grid-cols-2 gap-2">
          <a class="btn btn-primary" href={telLink(who.phone)}><Icon name="phone" size={18} />Call</a>
          {#if nudge(who)}<a class="btn" href={nudge(who)} target="_blank" rel="noopener noreferrer"><Icon name="msg" size={18} />WhatsApp<span class="sr-only"> (opens WhatsApp)</span></a>{/if}
        </div>
        {#if nudge(who)}<p class="mt-3 mb-0 text-sm text-muted">WhatsApp opens with a {who.status === 'SUBMITTED' ? 'thank-you' : 'gentle reminder'} ready to send.</p>{/if}
      {/if}
    </Sheet>
    <Sheet bind:this={nudgeSheet} titleId="gl-nudge-h" title="Nudge on WhatsApp" sub={`A gentle reminder to each of these ${canNudge.length}, one at a time.`}>
      <ul class="m-0 grid list-none gap-2 p-0">
        {#each canNudge as r (r.login)}
          <li><a class="lrow nd-row" href={nudge(r)} target="_blank" rel="noopener noreferrer" onclick={() => (sent = { ...sent, [r.login]: true })}>
            <span class="lmain"><span class="lt">{r.name}</span><span class="ls">{rowReason(r, d.weekId, today)}</span></span>
            {#if sent[r.login]}<span class="status" data-tone="ok">Opened</span>{:else}<Icon name="msg" size={18} />{/if}
          </a></li>
        {/each}
      </ul>
    </Sheet>
  {/if}
{/if}

{#snippet list(rows, name)}
      <ul class="m-0 list-none p-0" aria-label={name}>
        {#each rows as r (r.login)}
          {@const [label, tone] = STATUS[r.status] || [r.status, '']}
          {@const mine = r.login in edits ? edits[r.login] : r.attendance?.leader ?? null}
          {@const above = r.attendance?.master || r.attendance?.coordinator || null}
          {@const used = effectiveMark(r, edits, cw, 'leader')}
          <li class="brow gl-row">
            <!-- the whole left part is the target: it opens Call / WhatsApp -->
            <button type="button" class="who gl-who" onclick={() => openCall(r)} aria-haspopup="dialog">
              <b class="block truncate">{r.name}</b>
              <span class="gl-sub">
                <Status {tone} {label} />
                <span class="strip" role="img" aria-label={`${r.daysFilled} of 7 days filled`}>{#each dayCells(r, d.weekId, today) as c}<i data-s={c}></i>{/each}</span>
              </span>
              <span class="gl-why">{rowReason(r, d.weekId, today)}{#if above}{' · '}{r.attendance.master ? 'IYF head' : 'Coordinator'}: {word(above)}{/if}</span>
            </button>
            {#if !r.active}
              <Status class="end"><span class="sr-only">No attendance: </span>Not active</Status>
            {:else if (!closed || reopenedNow(r, tickNow)) && !r.attendance?.locked}
              {#if !canMark(r)}
                <!-- before the class day: no buttons that look already chosen, just when it opens -->
                <!-- the batch's own class day, from the board (19 Oct 2026); it said "Sun" for every batch -->
                <span class="end pa-wait">{d?.attendanceOpensAt ? 'Opens ' + dowShort(d.attendanceOpensAt.slice(0, 10)) : 'Not open yet'}</span>
              {:else}
                {@const implied = mine ? null : above || classDefault(cw) || r.attendance?.devotee || null}
                <div class="end pa" role="group" aria-label={'Attendance for ' + r.name}>
                  {#each ['P', 'A'] as m}
                    <button type="button" aria-pressed={mine === m} data-self={implied === m ? '' : undefined}
                      aria-label={(m === 'P' ? 'Present' : 'Absent') + ': ' + r.name + (implied === m ? (above ? " (the coordinator's mark)" : cw ? ' (the week default)' : ' (their own mark)') : '')} onclick={() => mark(r, m)}>{m}</button>
                  {/each}
                </div>
              {/if}
            {:else}
              <Status class="end" tone={used === 'P' ? 'ok' : used === 'A' ? 'bad' : ''}><span class="sr-only">Attendance: </span>{#if word(used)}{word(used)}{:else}<span aria-hidden="true">–</span><span class="sr-only">not marked</span>{/if}</Status>
            {/if}
          </li>
        {/each}
      </ul>
{/snippet}

<style>
  .gl-row { grid-template-columns: minmax(0, 1fr) auto; }
  .gl-row > .who { grid-row: 1 / 3; }
  .gl-who { align-items: stretch; gap: 3px; width: 100%; padding: 4px 0; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
  .gl-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
  .gl-why { font-size: var(--fs-sm); color: var(--text-muted); }
  .gl-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; margin: 12px 0 4px; }
  .gl-h h3 { display: flex; align-items: center; gap: 8px; font-size: var(--fs-sm); font-weight: 650; color: var(--text-muted); }
  .gl-h h3 span { min-width: 22px; padding: 0 7px; border-radius: 999px; background: var(--surface-2); color: var(--text); text-align: center; font-variant-numeric: tabular-nums; }
  /* who still has to submit: an amber edge, full contrast; submitted rows are full contrast too (no greying) */
  .gl-todo { border-left: 3px solid var(--warn-line); }
  .gl-fold > summary { list-style: none; cursor: pointer; }
  .gl-fold > summary::-webkit-details-marker { display: none; }
  .gl-fold[open] > summary :global(svg) { transform: rotate(180deg); }
  .gl-all { display: flex; align-items: center; gap: 8px; margin: 8px 0 12px; padding: 12px 14px; border-radius: var(--r-md); background: var(--success-soft, var(--surface-2)); color: var(--success); font-weight: 600; }
  .pa-wait { padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: var(--fs-caption); color: var(--text-muted); white-space: nowrap; }
  .nd-row { min-height: 56px; }
  @media (min-width: 600px) { .gl-row { grid-template-columns: minmax(0, 1fr) auto; } .gl-row > .end { grid-column: 2; grid-row: 1 / 3; } }
</style>
