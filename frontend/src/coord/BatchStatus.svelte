<script>
  // Batch status board for a week (opens on the focus week: last week until its Monday 9 PM deadline, then this week):
  // who submitted, who is filling, who has not started; Present / Absent marks saved together with one call; and a
  // week with no regular class (holiday, festival): everyone Present, or only those marked Present.
  import Status from '../ui/Status.svelte';
  import { untrack } from 'svelte';
  import { call, errorMessage, fieldErrors, serverNow } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { weekLabel, fmtClose, fmtLong, dowShort, todayIST } from '../lib/dates.js';
  import { markOpen, reopenedNow, isActiveRow, STATUS, CLASS_KINDS, boardCounts, boardFilter, dayCells, effectiveMark, classDefault, attendanceDiff, applyMarks, applyClass, rowReason, workOrder, weekTitle } from '../lib/staff.js';
  import { mergeBoards } from '../lib/batchall.js';
  import { waLink, telLink } from '../lib/contact.js';
  import ScopeStrip from '../ui/ScopeStrip.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Banner from '../ui/Banner.svelte';
  import { toast, buzz } from '../lib/pro.svelte.js';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Button from '../ui/Button.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import Search from '../ui/Search.svelte';
  import Radio from '../ui/Radio.svelte';
  import RadioGroup from '../ui/RadioGroup.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import WeekPicker from '../ui/WeekPicker.svelte';
  import { density, setCompact } from '../lib/density.svelte.js';
  const MARKS_PER_SAVE = 250;                 // attendance.set takes at most 300 marks a call
  // one batch (batchId), or "All batches" (Phase 22 F1): batchId '' and the batches in batchIds, each asked for its own
  // board (devotees.list, one batch a call) and shown as one list; each row keeps its batch's class day and class week
  let { batchId = '', batchIds = [], batchName = '', nameOf = (id) => id } = $props();
  const multi = $derived(!batchId);
  const ids = $derived(batchId ? [batchId] : batchIds);

  const master = $derived(scopesOf(session.user).master);
  // the week: '' = the focus week; any week of the last 12, or next week (WeekPicker: month, then week)
  let picked = $state('');
  const focusKey = $derived('devotees.list:' + (ids[0] || ''));
  const focusW = $derived(entry(focusKey).data?.weekId);
  const weekId = $derived(picked);
  const keyOf = (id, wk = weekId) => (wk ? 'devotees.list:' + id + ':' + wk : 'devotees.list:' + id);
  const key = $derived(ids.map((id) => keyOf(id)).join('|'));
  const es = $derived(ids.map((id) => entry(keyOf(id))));
  const e = $derived({ error: es.find((x) => x.error)?.error || '', refreshing: es.some((x) => x.refreshing) });
  const d = $derived(!multi ? es[0]?.data : es.length && es.every((x) => x.data) ? mergeBoards(ids.map((id, i) => [id, es[i].data])) : undefined);
  const refresh = (force = false) => Promise.all(ids.map((id) => load(keyOf(id), () => call('devotees.list', weekId ? { batchId: id, weekId } : { batchId: id }), { force })));
  $effect(() => { key; untrack(() => refresh()); });
  // the board a row belongs to: its own batch's answer on All batches (class day, class week, attendance window)
  const boardOf = (r) => (multi && d?.boards?.[r.batchId]) || d;
  const cwOf = (r) => (multi ? boardOf(r)?.classWeek || null : cw);
  const markedOf = (r) => { const c = cwOf(r); return !!c && !c.everyonePresent; };
  const opensOf = (r) => { const o = boardOf(r)?.attendanceOpensAt; return o ? dowShort(o.slice(0, 10)) : ''; };
  // the class weeks declared in the batches shown (All batches): one line each, changed from that batch's own view
  const cwList = $derived(multi && d ? ids.map((id) => [id, d.boards?.[id]?.classWeek]).filter(([, c]) => c) : []);

  let status = $state('');
  let q = $state('');
  let edits = $state({});
  let saving = $state(false);
  let saveErr = $state('');
  let saved = $state('');
  $effect(() => { key; edits = {}; saved = ''; saveErr = ''; });
  const rows = $derived(d?.rows || []);
  const cw = $derived(d?.classWeek || null);
  const counts = $derived(boardCounts(rows));
  // inactive and disabled members are not counted and sit in a folded list at the end (8 Oct 2026)
  // work order (Phase 5): not started, filling, missed, submitted — by status only, so marking never moves a row
  const shownRows = $derived(workOrder(boardFilter(rows, status, q).filter(isActiveRow)));
  const today = todayIST();
  // Phase 7: rows that changed since the last load glow once (another coordinator's marks, a devotee's new day); while
  // attendance is open the board refreshes itself every 2 minutes when the screen is visible and nothing is unsaved
  let glow = $state(new Set()), sigs = new Map(), sigKey = '';
  const sig = (r) => [r.status, r.daysFilled, r.attendance?.used, r.attendance?.coordinator, r.attendance?.leader].join('|');
  $effect(() => {
    const list = d?.rows; if (!list) return;
    const fresh = new Map(list.map((r) => [r.login, sig(r)]));
    if (sigKey === key && sigs.size) { const ch = list.filter((r) => sigs.has(r.login) && sigs.get(r.login) !== fresh.get(r.login)).map((r) => r.login); if (ch.length) { glow = new Set(ch); setTimeout(() => (glow = new Set()), 1300); } }
    sigs = fresh; sigKey = key;
  });
  $effect(() => {
    if (!d || !d.attendanceOpen || closed) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible' && !changes.length && !saving) refresh(true); }, 120e3);
    return () => clearInterval(t);
  });
  // the row menu ⋯: Fill for, open, call, WhatsApp (nothing destructive here)
  let menuRow = $state(null), menu = $state();
  /*
   * D4, Nudge all (22 Oct 2026): everyone active who has not started this week, one after the other on WhatsApp with
   * the reminder already written — one tap a person instead of three (open the row, WhatsApp, type). The app sends
   * nothing itself: there is no server message channel, and none is proposed.
   */
  let nudge = $state(), nudgeAt = $state(0);
  const toNudge = $derived(closed ? [] : rows.filter((r) => isActiveRow(r) && r.status === 'NOT_STARTED' && waLink(r.whatsapp || r.login)));
  const nudgeText = (r) => `Hare Krishna ${r.name.split(' ')[0]}! A gentle reminder to fill your sadhana for the week of ${weekLabel(d.weekId)} — it closes ${fmtClose(d.closesAt)}.`;
  const nudgeLink = (r) => `${waLink(r.whatsapp || r.login)}?text=${encodeURIComponent(nudgeText(r))}`;
  const openMenu = (r) => { menuRow = r; menu?.showModal(); };
  const canFill = (r) => isActiveRow(r) && (!closed || reopenedNow(r, tickNow)) && ['DRAFT', 'NOT_STARTED', 'REOPENED'].includes(r.status);
  const offRows = $derived(boardFilter(rows, '', q).filter((r) => !isActiveRow(r)));
  const changes = $derived(attendanceDiff(rows, edits));
  // attendance is the week's class, one on Sunday for everyone (decision 41): marked from Sunday, active devotees only
  let tickNow = $state(serverNow());
  $effect(() => { d; tickNow = serverNow(); const t = setInterval(() => (tickNow = serverNow()), 30e3); return () => clearInterval(t); });
  const canMark = (r) => markOpen(r, boardOf(r), tickNow);
  const open = $derived(rows.some(canMark));
  const opensDay = $derived(d?.attendanceOpensAt ? fmtLong(d.attendanceOpensAt.slice(0, 10)) : '');
  // the same day in three letters, for the narrow cell on a row that cannot be marked yet: opensOf(r), the row's batch
  const closed = $derived(d ? tickNow >= Date.parse(d.closesAt) : false);
  const marked = $derived(!!cw && !cw.everyonePresent);   // only those marked Present count
  const CHIPS = [['SUBMITTED', 'Submitted'], ['DRAFT', 'Filling'], ['NOT_STARTED', 'Not started'], ['MISSED', 'Missed']];
  const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const KIND = Object.fromEntries(CLASS_KINDS);

  function mark(r, m) {
    saved = '';
    const cur = r.login in edits ? edits[r.login] : r.attendance?.coordinator ?? null;
    edits = { ...edits, [r.login]: cur === m ? null : m };          // tapping the chosen mark again clears it
  }
  async function save() {
    if (!changes.length || saving) return;
    saving = true; saveErr = '';
    const marks = changes, pk = picked, wk = d.weekId;
    // attendance.set is one batch a call: on All batches the marks go to each row's own batch, with its class week
    const bOf = (login) => (multi ? rows.find((r) => r.login === login)?.batchId : batchId) || batchId || ids[0];
    const cw0 = cw, bds = d.boards || {};
    const cwFor = (b) => (multi ? bds[b]?.classWeek || null : cw0);
    const groups = (list) => { const g = new Map(); for (const m of list) { const b = bOf(m.login); if (!g.has(b)) g.set(b, []); g.get(b).push(m); } return [...g]; };
    // what each changed person had before: Undo sends it back
    const prev = marks.map((m) => ({ login: m.login, mark: rows.find((r) => r.login === m.login)?.attendance?.coordinator ?? null }));
    try {
      // the server takes at most 300 marks a save (a batch can be bigger): send them in parts, each shown once saved
      for (const [b, list] of groups(marks)) {
        const c = cwFor(b);
        for (let i = 0; i < list.length; i += MARKS_PER_SAVE) {
          const part = list.slice(i, i + MARKS_PER_SAVE);
          await call('attendance.set', { batchId: b, weekId: wk, marks: part });
          patch(keyOf(b, pk), (x) => ({ ...x, rows: applyMarks(x.rows, part, c) }));
        }
      }
      edits = {};
      buzz();
      toast(`Attendance saved for ${marks.length} devotee${marks.length === 1 ? '' : 's'}.`, { action: { label: 'Undo', run: async () => {
        try {
          for (const [b, list] of groups(prev)) {
            for (let i = 0; i < list.length; i += MARKS_PER_SAVE) await call('attendance.set', { batchId: b, weekId: wk, marks: list.slice(i, i + MARKS_PER_SAVE) });
            patch(keyOf(b, pk), (x) => ({ ...x, rows: applyMarks(x.rows, list, cwFor(b)) }));
          }
          toast('Attendance put back.', { kind: 'info' });
        }
        catch (err) { toast(errorMessage(err), { kind: 'err' }); }
      } } });
    } catch (err) { saveErr = errorMessage(err); }
    saving = false;
  }

  // ---- no regular class this week ----
  let sheet = $state();
  let kind = $state('HOLIDAY'), note = $state(''), everyone = $state(null), reason = $state('');
  let cBusy = $state(false), cErr = $state(''), cFe = $state({});
  // a class week is declared for one batch: on All batches it is changed from that batch's own view
  const canClass = $derived(!multi && (master || !closed));
  const needReason = $derived(master && closed);
  function openClass() {
    kind = cw?.kind || 'HOLIDAY'; note = cw?.note || ''; everyone = cw ? cw.everyonePresent : null; reason = ''; cErr = ''; cFe = {};
    sheet.showModal();
  }
  async function setClass(regular) {
    cErr = ''; cFe = {};
    if (!regular && everyone === null) { cFe = { everyonePresent: 'Choose one.' }; return; }
    cBusy = true;
    const k = key;
    try {
      const data = regular ? { batchId, weekId: d.weekId, kind: 'REGULAR' } : { batchId, weekId: d.weekId, kind, note: note.trim(), everyonePresent: everyone };
      if (reason.trim()) data.reason = reason.trim();
      const was = cw, wk = d.weekId;
      const r = await call('weeks.setClass', data);
      patch(k, (x) => ({ ...x, classWeek: r.classWeek, rows: applyClass(x.rows, r.classWeek) }));
      // Undo puts the week back as it was (Phase 7: inline undo)
      toast(r.classWeek ? 'Saved: no regular class this week.' : 'Back to a regular class this week.', { action: { label: 'Undo', run: async () => {
        try {
          const back = was ? { batchId, weekId: wk, kind: was.kind, note: was.note || '', everyonePresent: was.everyonePresent } : { batchId, weekId: wk, kind: 'REGULAR' };
          if (data.reason) back.reason = data.reason;
          const u = await call('weeks.setClass', back);
          patch(k, (x) => ({ ...x, classWeek: u.classWeek, rows: applyClass(x.rows, u.classWeek) })); toast('Class week put back.', { kind: 'info' });
        } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
      } } });
      sheet.close();
    } catch (x) { cErr = errorMessage(x); cFe = fieldErrors(x); }
    cBusy = false;
  }
</script>

{#snippet brow(r)}
  {@const [label, tone] = STATUS[r.status] || [r.status, '']}
  {@const rcw = cwOf(r)}
  {@const used = effectiveMark(r, edits, rcw)}
  {@const coord = r.login in edits ? edits[r.login] : r.attendance?.coordinator ?? null}
  {@const implied = coord ? null : r.attendance?.master || r.attendance?.leader || classDefault(rcw) || r.attendance?.devotee || null}
  {@const off = r.accountStatus !== 'ACTIVE' || r.membership !== 'ACTIVE'}
  <li class="brow" class:glow={glow.has(r.login)}>
    <a class="who" href={'#/devotee/' + encodeURIComponent(r.login)}>
      <b class="block truncate">{r.name}</b>
      {#if multi || off}<span class="block truncate text-xs text-muted">{multi ? nameOf(r.batchId) : ''}{multi && off ? ' · ' : ''}{off ? (r.accountStatus !== 'ACTIVE' ? r.accountStatus.toLowerCase() : 'inactive') : ''}</span>{/if}
    </a>
    <div class="sub">
      <Status {tone} {label} />
      <span class="strip" role="img" aria-label={`${r.daysFilled} of 7 days filled`}>{#each dayCells(r, d.weekId, today) as c, i}<i data-s={c} title={DAY[i]}></i>{/each}</span>
      <span class="bd-why">{rowReason(r, d.weekId, today)}{r.byCoordinator ? ' · by coordinator' : ''}</span>
      <!-- the lower marks under the coordinator's (decision 41): the group leader's and the devotee's own -->
      {#if r.attendance?.leader}<span>Leader: {r.attendance.leader === 'P' ? 'Present' : 'Absent'}</span>{/if}
      {#if r.attendance?.devotee && r.attendance?.leader && r.attendance.devotee !== r.attendance.leader}<span>Own: {r.attendance.devotee === 'P' ? 'Present' : 'Absent'}</span>{/if}
    </div>
    {#if !isActiveRow(r)}
      <span class="end bd-endw"><Status><span class="sr-only">No attendance: </span>Not active</Status>{@render more(r)}</span>
    {:else if (!closed || reopenedNow(r, tickNow)) && !r.attendance?.locked}
      {@const shut = !canMark(r)}
      {#if shut}
        <!-- before the class day: no buttons that look already chosen, just when it opens -->
        <!-- the batch's own class day, from the board (19 Oct 2026). It read "Opens Sun" for every batch, which is
             wrong for a weekday training the moment one exists — the same miss the devotee's week view had. -->
        <span class="end bd-endw"><span class="pa-wait">{opensOf(r) ? 'Opens ' + opensOf(r) : 'Not open yet'}</span>{@render more(r)}</span>
      {:else if markedOf(r)}
        <div class="end bd-endw"><div class="pa">
          <button type="button" class="px-3" aria-pressed={coord === 'P'} onclick={() => mark(r, 'P')} aria-label={'Present: ' + r.name}>{coord === 'P' ? 'Present ✓' : 'Present'}</button>
        </div>{@render more(r)}</div>
      {:else}
        <div class="end bd-endw"><div class="pa" role="group" aria-label={'Attendance for ' + r.name}>
          {#each ['P', 'A'] as m}
            <button type="button" aria-pressed={coord === m} data-self={implied === m ? '' : undefined}
              aria-label={(m === 'P' ? 'Present' : 'Absent') + ': ' + r.name + (implied === m ? (r.attendance?.leader ? " (the group leader's mark)" : rcw ? ' (the week default)' : ' (their own mark)') : '')} onclick={() => mark(r, m)}>{m}</button>
          {/each}
        </div>{@render more(r)}</div>
      {/if}
    {:else}
      <span class="end bd-endw"><Status tone={used === 'P' ? 'ok' : used === 'A' ? 'bad' : ''}><span class="sr-only">Attendance: </span>{#if used === 'P'}Present{:else if used === 'A'}Absent{:else}<span aria-hidden="true">–</span><span class="sr-only">not marked</span>{/if}</Status>{@render more(r)}</span>
    {/if}
  </li>
{/snippet}
{#snippet more(r)}<IconButton icon="more" size={18} label={'More for ' + r.name} onclick={() => openMenu(r)} aria-haspopup="dialog" />{/snippet}


{#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="board" rows={6} />
{:else if d}
  <h2 id="bd-h" class="sr-only">Week of {weekLabel(d.weekId)}</h2>
  <WeekPicker id="bd-wk" focus={focusW || d.weekId} value={picked} closes={fmtClose(d.closesAt)} {closed} onchange={(w) => (picked = w)} />
  <!-- the counts, each a filter (tap again for everyone) -->
  <div class="w-full"><ScopeStrip {counts} value={status} onpick={(k) => (status = k)} /></div>
  <!-- the search and the week's tools in one row (27 Oct 2026, search audit): a desktop had the search alone at 256 px with
       Nudge · Compact · Refresh in a row of their own; a phone keeps the search full width and the tools, right-aligned, under it -->
  <div class="bd-find">
    <Search id="bd-q" label="Search by name" placeholder="Search by name" class="mb-0 w-full sm:w-64" bind:value={q} pin />
    {#if !cw && canClass}<button type="button" class="btn btn-outline btn-sm" onclick={openClass}><Icon name="week" size={16} />No regular class this week?</button>{/if}
    {#if toNudge.length}<button type="button" class="btn btn-outline btn-sm" aria-haspopup="dialog" onclick={() => { nudgeAt = 0; nudge.showModal(); }}><Icon name="msg" size={16} />Nudge {toNudge.length} not started</button>{/if}
    <span class="flex items-center gap-1">
      <!-- #1: Comfortable or Compact rows, kept on this device -->
      <button type="button" class="btn btn-text btn-sm" aria-pressed={density.compact} onclick={() => setCompact(!density.compact)}>{density.compact ? 'Comfortable' : 'Compact'}</button>
      <Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />
    </span>
  </div>

  {#if cw}
    <div class="banner warn flex flex-wrap items-center justify-between gap-2" role="note">
      <Icon name="info" size={18} />
      <span class="min-w-0 flex-1"><b>{KIND[cw.kind] || cw.kind} · {cw.note}</b> — {cw.everyonePresent ? 'everyone marked Present' : 'only those you mark Present count; others Absent'}.</span>
      {#if canClass}<button type="button" class="btn btn-text btn-sm" onclick={openClass}>Change</button>{/if}
    </div>
  {/if}
  {#each cwList as [id, c] (id)}
    <div class="banner warn flex flex-wrap items-center gap-2" role="note">
      <Icon name="info" size={18} />
      <span class="min-w-0 flex-1"><b>{nameOf(id)} · {KIND[c.kind] || c.kind} · {c.note}</b> — {c.everyonePresent ? 'everyone marked Present' : 'only those marked Present count; others Absent'}.</span>
    </div>
  {/each}

  <Sheet bind:this={nudge} titleId="bd-nudge" title="Nudge on WhatsApp" sub={`${toNudge.length} not started · week of ${weekLabel(d.weekId)}`}>
    {#if toNudge.length}
      {@const r = toNudge[Math.min(nudgeAt, toNudge.length - 1)]}
      <p class="m-0 mb-2 text-sm text-muted">{Math.min(nudgeAt, toNudge.length - 1) + 1} of {toNudge.length}</p>
      <p class="nudge-msg">{nudgeText(r)}</p>
      <a class="btn btn-primary w-full" href={nudgeLink(r)} target="_blank" rel="noopener noreferrer" onclick={() => setTimeout(() => (nudgeAt = nudgeAt + 1 < toNudge.length ? nudgeAt + 1 : nudgeAt), 300)}>
        <Icon name="msg" size={18} />WhatsApp {r.name}<span class="sr-only"> (opens WhatsApp)</span></a>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-outline" disabled={nudgeAt === 0} onclick={() => (nudgeAt -= 1)}>Back</button>
        <button type="button" class="btn btn-outline" onclick={() => (nudgeAt + 1 < toNudge.length ? (nudgeAt += 1) : nudge.close())}>{nudgeAt + 1 < toNudge.length ? 'Skip' : 'Done'}</button>
      </div>
    {/if}
  </Sheet>
  {#if closed}<Banner kind="warn">Attendance closed {fmtClose(d.closesAt)} — the IYF head can change it.</Banner>{/if}

  <div class="board" class:dense={density.compact}>
    <!-- the week the rows count, named as it is (F3, 26 Oct 2026): until Monday's deadline that is LAST week -->
    <div class="board-head t-over" aria-hidden="true"><span>Devotee</span><span>{weekTitle(d.weekId)}</span><span class="text-right">Attendance</span></div>
    <ul class="m-0 list-none p-0" aria-label={'Devotees of ' + batchName}>
      {#each shownRows as r (r.login)}
        {@render brow(r)}
      {:else}
        <EmptyState tag="li" icon="users" title={rows.length ? 'No one matches' : 'No devotees'}>{rows.length ? 'Clear the search or the chosen status.' : multi ? 'No devotees in these batches for that week.' : 'No devotees in this batch for that week.'}</EmptyState>
      {/each}
    </ul>
    {#if offRows.length}
      <details class="board-off">
        <summary>Not active ({offRows.length})</summary>
        <ul class="m-0 list-none p-0" aria-label="Not active">
          {#each offRows as r (r.login)}{@render brow(r)}{/each}
        </ul>
      </details>
    {/if}
  </div>
  {#if open}<p class="hint">Attendance is for active devotees, from the Sunday class. {multi ? "Your mark counts over the group leader's and the devotee's own (shown dashed). Tap a chosen mark again to clear it." : marked ?'Tap Present for each devotee who came; everyone else counts as Absent.' : cw ? 'Everyone is Present (dashed) unless you mark Absent.' : "Your mark counts over the group leader's and the devotee's own (shown dashed). Tap a chosen mark again to clear it."}</p>{/if}

  {#if open && (changes.length || saveErr)}
    <div class="actionbar mt-3">
      <p class="sum m-0 text-sm" role="status">{changes.length} attendance change{changes.length === 1 ? '' : 's'} not saved</p>
      {#if saveErr}<p class="sum err m-0 justify-center" role="alert">{saveErr}</p>{/if}
      <button type="button" class="btn btn-outline" disabled={saving} onclick={() => { edits = {}; saveErr = ''; }}>Undo</button>
      <Button variant="primary" busy={saving} onclick={save}>Save attendance</Button>
    </div>
  {/if}

  <Sheet bind:this={menu} titleId="bd-m-h" title={menuRow?.name || ''} sub={menuRow ? rowReason(menuRow, d.weekId, today) : ''}>
    {#if menuRow}
      <ul class="m-0 grid list-none gap-2 p-0">
        {#if canFill(menuRow)}<li><a class="lrow" href={`#/fill/${encodeURIComponent(menuRow.login)}/week/${d.weekId}?n=${encodeURIComponent(menuRow.name)}`}><Icon name="edit" size={20} /><span class="lmain"><span class="lt">Fill for {menuRow.name.split(' ')[0]}</span><span class="ls">Saved as filled by the coordinator</span></span><Icon name="next" size={18} /></a></li>{/if}
        <li><a class="lrow" href={'#/devotee/' + encodeURIComponent(menuRow.login)}><Icon name="user" size={20} /><span class="lmain"><span class="lt">Open {menuRow.name.split(' ')[0]}'s page</span></span><Icon name="next" size={18} /></a></li>
        <li><a class="lrow" href={telLink(menuRow.login)}><Icon name="phone" size={20} /><span class="lmain"><span class="lt">Call</span></span></a></li>
        {#if waLink(menuRow.whatsapp || menuRow.login)}<li><a class="lrow" href={waLink(menuRow.whatsapp || menuRow.login)} target="_blank" rel="noopener noreferrer"><Icon name="msg" size={20} /><span class="lmain"><span class="lt">WhatsApp</span></span></a></li>{/if}
      </ul>
    {/if}
  </Sheet>
  <Sheet bind:this={sheet} titleId="cw-h" title="No regular class?" sub={`Week of ${weekLabel(d.weekId)}, ${batchName}`}>
    <div class="field">
      <p class="label" id="cw-k">Why</p>
      <div class="seg" role="group" aria-labelledby="cw-k">
        {#each CLASS_KINDS as [v, t]}<button type="button" aria-pressed={kind === v} onclick={() => (kind = v)}>{t}</button>{/each}
      </div>
    </div>
    <TextInput id="cw-note" label="What is it?" placeholder="e.g. Diwali" maxlength="80" autocomplete="off" bind:value={note} error={cFe.note} />
    <RadioGroup legend="Attendance this week" error={cFe.everyonePresent}>
      <Radio name="cw-ev" value={true} checked={everyone === true} onchange={() => (everyone = true)} label="Everyone present" desc="Everyone in the batch gets Present. You can still mark someone Absent." />
      <Radio name="cw-ev" value={false} checked={everyone === false} onchange={() => (everyone = false)} label="Only those I mark present" desc="Mark who came (for example, to the festival); everyone else is Absent. Devotees' own marks are not used." />
    </RadioGroup>
    {#if needReason}<TextInput id="cw-reason" label="Reason (the deadline has passed)" maxlength="200" autocomplete="off" bind:value={reason} error={cFe.reason} />{/if}
    {#if cErr}<p class="err" role="alert">{cErr}</p>{/if}
    <div class="mt-2 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
      <Button variant="primary" busy={cBusy} onclick={() => setClass(false)}>Save</Button>
    </div>
    {#if cw}<button type="button" class="btn btn-danger mt-2 w-full" disabled={cBusy} onclick={() => setClass(true)}>Back to a regular class</button>{/if}
  </Sheet>
{/if}

<style>
  .bd-find { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: var(--sp-3); }
  .bd-find > :global(.field) { margin-right: auto; }
  /* #2: the table's header stays in view while its rows scroll (820 px and up, where the board is a table); overflow
     clip, not hidden, so it can stick */
  .board { overflow: clip; }
  .board-head { position: sticky; top: var(--search-pin-bottom, var(--sticky-top)); z-index: 2; }   /* under a pinned search (ui/Search.svelte) */
  /* #1: compact rows */
  .board.dense .brow { padding-top: 5px; padding-bottom: 5px; }
  .nudge-msg { margin: 0 0 var(--sp-3); padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface-2); font-size: var(--fs-sm); }
  .bd-why { flex-basis: 100%; }
  /* a phone (Phase 24, V18): the reason follows the day dots when it fits, rather than always a line of its own — a row
     was ~145 px for three facts at 320 */
  @media (max-width: 479px) { .bd-why { flex-basis: auto; } .board :global(.brow) { padding: 8px 12px; column-gap: 8px; } }
  .bd-endw { display: inline-flex; align-items: center; gap: 4px; }
  .pa-wait { padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: var(--fs-caption); color: var(--text-muted); white-space: nowrap; }
  .pa { align-items: center; }
</style>
