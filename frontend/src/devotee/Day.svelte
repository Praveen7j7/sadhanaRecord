<script>
  import { tick } from 'svelte';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { wide } from '../lib/wide.svelte.js';
  import { call, errorMessage } from '../lib/api.js';
  import { HOME, homeEntry, loadHome, loadBehalf, behalfKey, findWeek, daySaved, dayReplaced } from '../lib/weekstore.js';
  import { entry, stale } from '../lib/cache.svelte.js';
  import { swipe } from '../lib/swipe.js';
  import { createSaver, loadQueued } from '../lib/saver.js';
  import { getRules, getJournals, getRulesFor, getJournalsFor, getCurrentBook, setCurrentBook } from '../lib/refdata.js';
  import { dayMarks, dayPercent } from '$shared/scoring.js';
  import { TEMPLE_ACTIVITIES, TEMPLE_ANSWERS, TEMPLE_KEYS } from '$shared/temple.js';
  import { dayShareText, shareText } from '../lib/share.js';
  import { missingOf, stripV, applyPatch, LABELS } from '../lib/daylogic.js';
  import { focusFirstProblem } from '../lib/focus.js';
  import { DAY_SHORT, DAY_LONG, fmtDate, isMissing, todayIST } from '../lib/dates.js';
  import { cachedMeta, loadMeta } from '../lib/meta.js';
  import { resume, nav } from '../lib/router.svelte.js';
  import { holdWhileUnsaved } from '../lib/leaveguard.svelte.js';
  import { buzz, buzzErr } from '../lib/pro.svelte.js';
  import Seg from '../ui/Seg.svelte';
  import NumInput from '../ui/NumInput.svelte';
  import TimePicker from '../ui/TimePicker.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import TextArea from '../ui/TextArea.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import { armNotificationPrompt } from '../lib/push.js';

  // behalf: { login, name } when a coordinator fills this day for a devotee (same rules, same explicit Save)
  let { weekId, date, focus = '', behalf = null } = $props();
  const railSc = $derived(scopesOf(session.user));

  const own = session.user?.login || '';
  // the local draft and the remembered book belong to the person filled for, kept apart from the coordinator's own
  const login = behalf ? `${own}>for:${behalf.login}` : own;
  const KEY = behalf ? behalfKey(behalf.login, weekId) : HOME;
  const he = behalf ? entry(KEY) : homeEntry();
  const pre = behalf ? '/fill/' + encodeURIComponent(behalf.login) : '';
  const week = $derived(findWeek(he.data, weekId));
  const row = $derived(week?.days.find((d) => d.date === date));
  const rv = $derived(he.data?.versions?.rules);
  const jv = $derived(he.data?.versions?.journals);
  const batchId = $derived(he.data?.profile?.batchId || (behalf ? journals?.batchId : ''));

  let day = $state({});
  let ready = $state(false);
  let status = $state('saved');
  // the phone refused to keep the draft (a full disk, private mode): said once, quietly — the day is still in
  // memory and still sends when the connection returns (13 Oct 2026, audit FE-12)
  let noStore = $state(false);
  let dirty = $state(false);
  let leaveTo = $state('');
  let leaveDlg = $state();
  let banner = $state('');
  let serverErr = $state({});
  let rules = $state(null);
  let journals = $state(null);
  let refErr = $state(false);
  let shareMsg = $state('');
  let batchName = $state('');
  let rev = $state(0);   // bumped when the server copy replaces ours, so every field re-reads its value
  let remembered = $state(getCurrentBook(login));
  let saver;
  let started = false;

  if (behalf) loadBehalf(behalf.login, weekId); else loadHome();

  $effect(() => { if (row && !started) { started = true; init(row); } });

  async function init(r) {
    const saved = stripV(r.day);
    day = saved;
    const q = await loadQueued(login, weekId, date);     // this day's local draft (typed earlier, never saved)
    if (q && q.patch && Object.keys(q.patch).length) day = applyPatch(saved, q.patch);
    saver = createSaver({
      login, weekId, date, version: r.version, saved, local: day, onBehalfOf: behalf?.login,
      onStatus: (s) => { status = s; dirty = !!saver?.dirty(); },
      onNoStore: () => (noStore = true),            // this phone cannot keep a draft (audit FE-12)
      onSaved: (reply, sent) => {
        daySaved(weekId, date, reply, sent, KEY);
        if (behalf) stale('devotees.list:');
        // roadmap 4.6: the notification prompt waits for a devotee's own first saved day — never a
        // coordinator filling for someone else, whose phone should not be asked about their reminders
        else armNotificationPrompt();
        serverErr = {}; banner = ''; buzz();
      },
      onStale: (cur) => { buzzErr(); day = stripV(cur); dayReplaced(weekId, date, cur, KEY); banner = 'This day was changed on another device. Your changes here were not saved.'; rev++; },
      onRejected: (fm, e) => {
        buzzErr();
        serverErr = Object.fromEntries(Object.entries(fm).map(([p, m]) => [p.replace(/^day\./, ''), m]));
        const n = Object.keys(fm).length;
        banner = n ? `${n} answer${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} fixing.` : errorMessage(e);
        if (n) tick().then(() => focusFirstProblem(document.querySelector('.dform')));
      },
    });
    dirty = saver.dirty();
    status = dirty ? 'dirty' : 'saved';
    ready = true;
    if (focus) setTimeout(() => { const el = document.getElementById('f-' + focus); el?.scrollIntoView({ block: 'center' }); el?.querySelector?.('input,button')?.focus?.(); }, 50);
  }
  // Nothing is sent by itself. Leaving with unsaved changes asks first (in-app links, Back, the day chips; and the
  // tab closing). The wiring is shared with the week-end questions: lib/leaveguard.svelte.js (audit FE-19).
  $effect(() => holdWhileUnsaved({
    // B2: once Save is tapped the answers are on their way, so leaving loses nothing; a change made after the tap still holds
    dirty: () => !!saver?.unsent(),
    self: () => `${pre}/day/${weekId}/${date}`,
    ask: (to) => { leaveTo = to; leaveDlg?.showModal(); },
    cleanup: () => saver?.destroy(),
  }));
  async function leave(how) {
    if (how === 'stay') { leaveDlg.close(); leaveTo = ''; return; }
    if (how === 'save') { await saver.save(); if (saver.dirty()) return; }      // not saved (offline, error): the dialog stays with the message
    else if (how === 'discard') await saver.discard();                          // 'keep': leave, the local draft stays on this phone
    const to = leaveTo; leaveTo = ''; leaveDlg.close();
    resume(to);
  }

  // The two picker sheets (the motion audit, 10 Oct 2026): their code is fetched once the form is up and a tap waits for
  // it, so a sheet opens at its full height (it opened small and grew four times taller in one frame); and its content
  // stays until it has slid away (it collapsed to its header first)
  let pickersP = null;
  const pickers = () => (pickersP ||= Promise.all([import('./HearingPicker.svelte'), import('./BookPicker.svelte')]).catch(() => {}));
  $effect(() => { const t = setTimeout(pickers, 800); return () => clearTimeout(t); });
  // and the lists themselves (the journals): a tap right after the form opens waits for them (at most 1.5 s, the row
  // busy), so the sheet opens with its list instead of the list arriving inside it a moment later
  let opening = $state('');
  async function openPick(which) {
    opening = which;
    await pickers();
    for (let t = 0; !journals && !refErr && t < 30; t++) await new Promise((r) => setTimeout(r, 50));
    opening = '';
    if (which === 'hear') { hearOpen = true; hearDlg.showModal(); } else { bookOpen = true; bookDlg.showModal(); }
  }
  // The content is dropped only AFTER the sheet has finished sliding away. The wait follows --d-3 rather than a
  // number of its own: at 420 ms, once --d-3 became 440, the content vanished mid-slide and the sheet's height
  // collapsed by 87 % in one frame — a visible snap, caught by motion-audit (12 Oct 2026).
  const SHEET_MS = (() => {
    const v = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue('--d-3') : '';
    const ms = /([\d.]+)\s*ms/.exec(v) ? +RegExp.$1 : /([\d.]+)\s*s/.exec(v) ? +RegExp.$1 * 1000 : 440;
    return Math.round(ms) + 100;                                  // the slide, plus a little
  })();
  const closedLater = (sheet, off) => setTimeout(() => { if (!sheet?.isOpen()) off(); }, SHEET_MS);   // (a Sheet: isOpen(), not .open)

  // Save tapped with no connection: this open day sends itself when the connection comes back (8 Oct 2026)
  $effect(() => { const on = () => { if (status === 'offline') saver?.save(); }; window.addEventListener('online', on); return () => window.removeEventListener('online', on); });
  // an app update waits while this day has changes not saved
  $effect(() => { nav.unsaved = dirty; });
  $effect(() => () => { nav.unsaved = false; });
  // filling for a devotee: their own card and lists (their journal, what they have heard, their current book)
  $effect(() => { if (behalf) getRulesFor(behalf.login).then((r) => (rules = r)).catch(() => (refErr = true)); else if (rv) getRules(own, rv).then((r) => (rules = r)).catch(() => (refErr = true)); });
  $effect(() => { if (behalf) getJournalsFor(behalf.login).then((j) => (journals = j)).catch(() => (refErr = true)); else if (jv) getJournals(own, jv).then((j) => (journals = j)).catch(() => (refErr = true)); });
  $effect(() => {
    if (!batchId) return;
    const hit = (cachedMeta().batches || []).find((b) => b.batchId === batchId);
    if (hit) batchName = hit.name;
    else loadMeta().then((m) => (batchName = (m.batches || []).find((b) => b.batchId === batchId)?.name || batchId)).catch(() => (batchName = batchId));
  });
  $effect(() => { const cb = he.data?.progress?.currentBookId || (behalf ? journals?.currentBookId : null); if (!remembered && cb) remembered = { bookId: cb }; });

  // a coordinator's rules carry every card of their batches: the one card when there is one
  const card = $derived(rules?.cards?.[rules.cardName || (Object.keys(rules?.cards || {}).length === 1 ? Object.keys(rules.cards)[0] : '')]);
  const marks = $derived.by(() => { try { return card ? dayMarks(card, { ...day }) : {}; } catch { return {}; } });
  const dp = $derived(dayPercent(marks));
  // TRD (Phase 22, COSATOK's TRD scheme): a linear card scores every part as it is typed — each section shows its marks
  // so far ("16.67/25"), the same marks the server stores (shared/scoring.js)
  const linear = $derived(card?.kind === 'linear');
  const mk = (keys) => { const xs = keys.map((k) => marks[k]).filter(Boolean); return `${+xs.reduce((n, m) => n + m.marks, 0).toFixed(2)}/${xs.reduce((n, m) => n + m.of, 0)}`; };
  // a linear item's two points (and, for chanting, the same-day rule), for the Scoring sheet
  const pt = (it, v) => (it.clock ? v : `${v} ${it.unit || 'min'}`);
  const ruleRows = (it) => {
    if (it.answers) return TEMPLE_ANSWERS.map(([v, l]) => [`${l}, each`, it.answers[v] ?? 0]);
    const less = it.clock || it.full < it.zero, w = it.clock ? ['earlier', 'later'] : ['less', 'more'];
    return [less ? [`${pt(it, it.full)} or ${w[0]}`, it.marks] : [`${pt(it, it.full)} or more`, it.marks],
      less ? [`${pt(it, it.zero)} or ${w[1]}`, 0] : [pt(it, it.zero), 0], ...(it.sameDay ? [['Not the same day', 0]] : [])];
  };
  const missing = $derived(missingOf(day));
  // a section's ✓ (8 Oct 2026): all of its answers are in
  // the temple activities are optional (never in `missing`): their ✓ waits for all four answers
  const secDone = (keys) => !!keys.length && keys.every((k) => !missing.includes(k) && (!TEMPLE_KEYS.includes(k) || !!day[k])) && keys.some((k) => day[k] !== undefined && day[k] !== null);
  // "Same as yesterday": the last filled day's times and book, for the answers still empty (fills, never saves)
  // the open day before / after this one in this week (not a future day)
  const stepTo = (d) => { const days = week?.days || [], i = days.findIndex((x) => x.date === date), n = days[i + d]; return n && !n.future ? `#${pre}/day/${weekId}/${n.date}` : ''; };
  const prevDay = $derived((he.data?.weeks || []).flatMap((w) => w.days).filter((d) => d.date < date && d.day && Object.keys(d.day).some((k) => k !== 'v')).sort((a, b) => (a.date < b.date ? 1 : -1))[0]);
  // D1 (22 Oct 2026): the times, the rounds and the book — the answers most days repeat; a visible tap, never pre-filled
  const SAME = ['sleptAt', 'wokeAt', 'rounds', 'chantingDoneAt', 'reading'];
  const canSame = $derived(!!prevDay && SAME.some((k) => prevDay.day[k] && (day[k] === undefined || day[k] === null)));
  function sameAsBefore() { for (const k of SAME) if (prevDay.day[k] && (day[k] === undefined || day[k] === null)) set(k, prevDay.day[k]); rev++; }
  // D3 / C8 (22 Oct 2026): the sections, for the jump bar (phone, tablet) and the desktop rail — each with its ✓
  const JUMP = $derived([['h-body', 'Body', ['sleptAt', 'wokeAt', 'dayRestMin']], ['h-chant', 'Chanting', ['rounds', 'chantingDoneAt', 'chantingSameDay']],
    ['h-hear', 'Hearing', ['hearingMin', 'hearing']], ['h-read', 'Reading', ['readingMin', 'reading']], ['h-seva', 'Seva', ['serviceMin']],
    ...(rules?.temple ? [['h-temple', linear ? 'Morning' : 'Temple', TEMPLE_KEYS]] : []),
    ...(rules?.chetnaOptions ? [['h-chetna', 'Chetna', []]] : []), ['h-comment', 'Comment', []]]);
  function jump(id) { document.getElementById(id)?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  // the bar sticks right under the day strip: its offset is the strip's real height (it changes with text size), measured
  let stripH = $state(64);
  $effect(() => {
    const el = document.querySelector('nav.sticky-top.chips'); if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => (stripH = el.offsetHeight)); ro.observe(el); return () => ro.disconnect();
  });
  const lectMap = $derived(new Map((journals?.lectures || []).map((l) => [l.lectureId, l])));
  const bookMap = $derived(new Map((journals?.books || []).map((b) => [b.bookId, b])));
  const bookTitle = (r) => (r ? (r.bookId ? bookMap.get(r.bookId)?.title || r.bookId : r.text) : '');
  const topics = $derived((day.hearing || []).map((h) => (h.lectureId ? lectMap.get(h.lectureId)?.title || h.lectureId : h.text)));
  let hearDlg = $state(), bookDlg = $state(), hearOpen = $state(false), bookOpen = $state(false);   // the lists render only while their sheet is open

  // the devotee's last value for a time field, from the days already known (earlier dates)
  function lastOf(key) {
    const all = (he.data?.weeks || []).flatMap((w) => w.days).filter((d) => d.date < date && d.day?.[key]).sort((a, b) => (a.date < b.date ? 1 : -1));
    return all[0]?.day[key] || '';
  }
  const lastSlept = $derived(lastOf('sleptAt'));
  const lastWoke = $derived(lastOf('wokeAt'));
  const lastDone = $derived(lastOf('chantingDoneAt'));

  function set(key, value) {
    if (value === null || value === undefined || value === '') delete day[key]; else day[key] = value;
    if (serverErr[key]) serverErr = { ...serverErr, [key]: '' };
    banner = '';
    saver?.change({ [key]: value === '' || value === undefined ? null : value });
  }
  const setList = (key, list) => set(key, list.length ? list : null);

  // one topic a day (the head, 8 Oct 2026): a lecture from their journal, or a topic they type; choosing replaces it
  function toggleLecture(l) {
    const cur = day.hearing || [];
    const off = cur.length === 1 && cur[0].lectureId === l.lectureId;
    setList('hearing', off ? [] : [{ lectureId: l.lectureId }]);
    if (!off) hearDlg?.close();
  }
  const addHearingText = (t) => { setList('hearing', [{ text: t }]); hearDlg?.close(); };
  const removeHearing = (i) => setList('hearing', (day.hearing || []).filter((_, k) => k !== i));
  function pickBook(item) {
    set('reading', item); setCurrentBook(login, item); remembered = item; bookDlg?.close();
    // the current book also goes to the server, so another phone remembers it (8 Oct 2026); quietly, it is only a convenience
    if (item?.bookId) call('books.setCurrent', { bookId: item.bookId, ...(behalf ? { onBehalfOf: behalf.login } : {}) }).catch(() => {});
  }
  const toggleChetna = (key, opt) => { const cur = day[key] || []; setList(key, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]); };

  const shareBody = $derived(dayShareText(stripV(day), date, { card, batchName, lectureTitle: (id) => lectMap.get(id)?.title, bookTitle: (id) => bookMap.get(id)?.title }));
  async function share() {
    const r = await shareText(shareBody);
    shareMsg = r === 'copied' ? 'Copied' : r === 'failed' ? 'Could not share. Select the text and copy it.' : '';
  }
  const save = () => saver?.save();

  // Save button states
  // "Saved ✓" only for a day the server holds; a day nobody has filled reads plain "Save" (disabled until something changes)
  // B2 (22 Oct 2026): "Saved ✓" the moment Save is tapped — the reply reconciles it; a refusal brings back "Save changes"
  // with the field marked, and a day changed on another phone replaces the form and says so (saver.js)
  const saveLabel = $derived(status === 'saving' ? 'Saved ✓' : dirty ? 'Save changes' : Object.keys(day).length ? 'Saved ✓' : 'Save');
  const savePrimary = $derived(dirty && status !== 'saving');
  const saveDisabled = $derived(status === 'saving' || !dirty);
  const idx = $derived(week ? week.days.findIndex((d) => d.date === date) : -1);
  const SYM = { complete: '✓', partial: '◐', empty: '○', missing: '!' };
  const todayD = todayIST();
  const yesterday = new Date(Date.parse(date + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  const RULE_PARTS = [['to_bed', 'Slept at'], ['wake_up', 'Woke up at'], ['day_sleep', 'Day rest (minutes)'], ['japa', 'Chanting finished at'], ['pathan', 'Reading (minutes)'], ['sravan', 'Hearing (minutes)']];
  let rulesDlg = $state();
  // on a phone the day editor has one floating bar (Save): the bottom tabs are hidden while it is open (8 Oct 2026)
  $effect(() => { const root = document.documentElement; root.classList.add('day-editor'); return () => root.classList.remove('day-editor'); });
  // while typing on a phone, the bottom tabs and the Save bar step aside, so the keyboard never pushes them over the field
  $effect(() => {
    const coarse = matchMedia('(pointer: coarse)').matches, root = document.documentElement;
    const isField = (t) => t?.matches?.('input:not([type=checkbox]):not([type=radio]), textarea');
    const on = (e) => { if (coarse && isField(e.target)) root.classList.add('typing'); };
    const off = (e) => { if (!isField(e.relatedTarget)) root.classList.remove('typing'); };
    document.addEventListener('focusin', on); document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); root.classList.remove('typing'); };
  });
</script>

{#if he.error && !he.data}
  <Banner onretry={() => (behalf ? loadBehalf(behalf.login, weekId, true) : loadHome(true))}>{errorMessage(he.error)}</Banner>
{:else if !he.data}
  <Skeleton kind="form" rows={4} />
{:else if !week || !row}
  <Banner>This day is not open.</Banner>
{:else}
  <nav class="sticky-top chips" aria-label="Days of the week">
    {#each week.days as d, i}
      {#if d.future}<span class="chip chip-off" aria-disabled="true">{DAY_SHORT[i]}<b>&middot;</b></span>
      {:else}{@const miss = isMissing(d, todayD)}<a class="chip" class:chip-on={d.date === date} class:chip-done={d.state === 'complete'} class:chip-part={d.state === 'partial'} class:chip-miss={miss} href={`#${pre}/day/${weekId}/${d.date}`} aria-current={d.date === date ? 'page' : undefined}
          aria-label={`${DAY_LONG[i]}, ${d.state === 'complete' ? 'complete' : d.state === 'partial' ? 'partly filled' : miss ? 'missing, not filled' : 'not filled'}`}>{DAY_SHORT[i]}<b>{SYM[miss ? 'missing' : d.state]}</b></a>{/if}
    {/each}
  </nav>
  <h2 class="mb-3 mt-3">{DAY_LONG[idx]}, {fmtDate(date)}</h2>
  <!-- Phase 7: [ / ] and a sideways swipe go to the day before / after (the chips above stay the buttons) -->
  {#if stepTo(-1)}<a class="sr-only" data-step="prev" href={stepTo(-1)}>The day before</a>{/if}
  {#if stepTo(1)}<a class="sr-only" data-step="next" href={stepTo(1)}>The day after</a>{/if}

  {#if row.future}
    <Banner>This day opens on {fmtDate(date)}.</Banner>
  {:else if week.status === 'SUBMITTED'}
    <Banner kind="info">This week is submitted. <a class="ilink" href={'#' + pre + '/week/' + weekId}>See the week</a></Banner>
  {:else if !ready}
    <Skeleton kind="form" rows={4} />
  {:else}
    {#if banner}<Banner>{banner}</Banner>{/if}
    {#if noStore}<p class="hint mb-3 mt-0 flex items-center gap-2"><Icon name="alert" size={16} />This phone cannot keep a copy of this day. Tap Save while you have a connection.</p>{/if}
    {#if status === 'offline'}<p class="hint mb-3 mt-0 flex items-center gap-2"><Icon name="offline" size={16} />Kept on this phone. It sends by itself when you are back online.</p>{/if}
    {#if refErr && !rules}<Banner kind="warn">Topic lists need a connection. You can still fill in the day.</Banner>{/if}
    <!-- D3: jump to a section (below 1024 px; from there it is the rail). "Scoring" opens the card's marks — one word, an
         action: the line "How your day is scored ›" went with the copy audit (G12, 22 Oct 2026) -->
    <nav class="jumpbar" aria-label="Sections" style:--strip-h="{stripH}px">
      {#each JUMP as [id, title, keys] (id)}<button type="button" class="jchip" class:done={secDone(keys)} onclick={() => jump(id)}>{title}{#if secDone(keys)}<span aria-hidden="true"> ✓</span>{/if}</button>{/each}
      {#if card}<button type="button" class="jchip jscore" aria-haspopup="dialog" onclick={() => rulesDlg.showModal()}><Icon name="info" size={14} />Scoring</button>{/if}
    </nav>
    {#if missing.length && (dirty || Object.keys(day).length)}<p class="hint mb-3 mt-0 flex flex-wrap gap-x-2"><span class="status" data-tone="warn">Still needed</span><span>{missing.map((k) => LABELS[k]).join(', ')}</span></p>{/if}

    {#if canSame}<button type="button" class="btn btn-outline mb-3 w-full sm:w-auto" onclick={sameAsBefore}><Icon name="refresh" size={18} />Same as {prevDay.date === yesterday ? 'yesterday' : DAY_LONG[(new Date(prevDay.date + 'T12:00:00Z').getUTCDay() + 6) % 7]} <span class="text-sm font-normal text-muted">(times, rounds, book)</span></button>{/if}
    {#key rev}
    <div class="day-wrap">
    <!-- one column at every width (8 Oct 2026): the form reads top to bottom; from 1024 px the rail sits beside it (C8) -->
    <div class="dform" {@attach swipe((d) => { const to = stepTo(d); if (to) location.hash = to; })}>
      <section class="section" aria-labelledby="h-body">
        <h3 id="h-body"><Icon name="moon" />Body{#if secDone(['sleptAt', 'wokeAt', 'dayRestMin'])}<span class="sec-ok"><span class="sr-only">, complete</span>✓</span>{/if}{#if linear}<span class="sec-mk">{mk(['to_bed', 'wake_up', 'day_sleep'])}</span>{/if}</h3>
        <div class="pair">
        <TimePicker id="f-sleptAt" label="Slept at (last night)" value={day.sleptAt || ''} def="22:00" last={lastSlept} onchange={(v) => set('sleptAt', v)} error={serverErr.sleptAt} />
        <TimePicker id="f-wokeAt" label="Woke up at" value={day.wokeAt || ''} def="04:30" last={lastWoke} onchange={(v) => set('wokeAt', v)} error={serverErr.wokeAt} />
        </div>
        <div id="f-dayRestMin">
          <NumInput id="dayRestMin" label="Day rest" unit="minutes" max={600} value={day.dayRestMin ?? null} onchange={(v) => set('dayRestMin', v)} serverError={serverErr.dayRestMin} />
        </div>
      </section>

      <section class="section" aria-labelledby="h-chant">
        <h3 id="h-chant"><Icon name="chant" />Chanting{#if secDone(['rounds', 'chantingDoneAt', 'chantingSameDay'])}<span class="sec-ok"><span class="sr-only">, complete</span>✓</span>{/if}{#if linear}<span class="sec-mk">{mk(['japa', 'rounds'])}</span>{/if}</h3>
        <div class="pair">
        <div id="f-rounds"><NumInput id="rounds" label="Rounds chanted" max={64} value={day.rounds ?? null} onchange={(v) => set('rounds', v)} serverError={serverErr.rounds} /></div>
        <TimePicker id="f-chantingDoneAt" label="Chanting finished at" value={day.chantingDoneAt || ''} def="07:00" last={lastDone} onchange={(v) => set('chantingDoneAt', v)} error={serverErr.chantingDoneAt} />
        </div>
        <Seg id="f-chantingSameDay" label="Completed the same day?" options={[[true, 'Yes'], [false, 'No']]} value={day.chantingSameDay ?? null} onchange={(v) => set('chantingSameDay', v)} error={serverErr.chantingSameDay} />
      </section>

      <!-- Hearing and Reading: the topic (or book) first, then how long; the lists open in a sheet, never inside the form (the head, 8 Oct 2026) -->
      <section class="section" aria-labelledby="h-hear">
        <h3 id="h-hear"><Icon name="hear" />Hearing{#if secDone(['hearingMin', 'hearing'])}<span class="sec-ok"><span class="sr-only">, complete</span>✓</span>{/if}{#if linear}<span class="sec-mk">{mk(['sravan'])}</span>{/if}</h3>
        <div id="f-hearing" class="field">
          <p class="label" id="l-hearing">Topic{day.hearingMin > 0 ? ' (required)' : ''}</p>
          <button type="button" class="pickrow" aria-haspopup="dialog" aria-describedby="l-hearing" aria-busy={opening === 'hear' || undefined} onclick={() => openPick('hear')}>
            <span class="pick-v" class:pick-none={!topics.length}>{topics.length ? topics[0] + (topics.length > 1 ? ` + ${topics.length - 1} more` : '') : 'Choose the topic'}</span><Icon name="next" size={18} />
          </button>
          <ValidationMessage error={serverErr.hearing} />
        </div>
        <div id="f-hearingMin">
          <NumInput id="hearingMin" label="Duration" unit="minutes" max={600} value={day.hearingMin ?? null} onchange={(v) => set('hearingMin', v)} serverError={serverErr.hearingMin} />
        </div>
      </section>

      <section class="section" aria-labelledby="h-read">
        <h3 id="h-read"><Icon name="book" />Reading{#if secDone(['readingMin', 'reading'])}<span class="sec-ok"><span class="sr-only">, complete</span>✓</span>{/if}{#if linear}<span class="sec-mk">{mk(['pathan'])}</span>{/if}</h3>
        <div id="f-reading" class="field">
          <p class="label" id="l-reading">Book{day.readingMin > 0 ? ' (required)' : ''}</p>
          <button type="button" class="pickrow" aria-haspopup="dialog" aria-describedby="l-reading" aria-busy={opening === 'book' || undefined} onclick={() => openPick('book')}>
            <span class="pick-v" class:pick-none={!day.reading}>{day.reading ? bookTitle(day.reading) : 'Choose the book'}</span><Icon name="next" size={18} />
          </button>
          {#if !day.reading && remembered}<button type="button" class="btn btn-text btn-sm mt-1 h-auto max-w-full py-1 text-left" onclick={() => pickBook(remembered)}>Same book: {bookTitle(remembered)}</button>{/if}
          <ValidationMessage error={serverErr.reading} />
        </div>
        <div id="f-readingMin">
          <NumInput id="readingMin" label="Duration" unit="minutes" max={600} value={day.readingMin ?? null} onchange={(v) => set('readingMin', v)} serverError={serverErr.readingMin} />
        </div>
      </section>

      <section class="section" aria-labelledby="h-seva">
        <h3 id="h-seva"><Icon name="heart" />Seva and other{#if secDone(['serviceMin'])}<span class="sec-ok"><span class="sr-only">, complete</span>✓</span>{/if}{#if linear}<span class="sec-mk">{mk(['seva'])}</span>{/if}</h3>
        <div id="f-serviceMin"><NumInput id="serviceMin" label="Service" unit="minutes" max={999} value={day.serviceMin ?? null} onchange={(v) => set('serviceMin', v)} serverError={serverErr.serviceMin} /></div>
        <TextInput id="serviceTopic" label="Service topic" optional maxlength="120" autocomplete="off" value={day.serviceTopic || ''} oninput={(e) => set('serviceTopic', e.currentTarget.value.trim() ? e.currentTarget.value : null)} />
        <NumInput id="exerciseMin" label="Exercise (optional)" unit="minutes" max={600} value={day.exerciseMin ?? null} onchange={(v) => set('exerciseMin', v)} serverError={serverErr.exerciseMin} />
        <NumInput id="studyJobHrs" label="Study / job (optional)" unit="hours" max={24} float={true} value={day.studyJobHrs ?? null} onchange={(v) => set('studyJobHrs', v)} serverError={serverErr.studyJobHrs} />
      </section>

      <!-- the temple activities (phase 21): only a batch that asks them (the Temple Residents); since Phase 22 the TRD card
           scores them as the Morning program (on time 5 · late 3 · absent 0 each) -->
      {#if rules?.temple}
        <section class="section" aria-labelledby="h-temple">
          <h3 id="h-temple"><Icon name="lotus" />{linear ? 'Morning program' : 'Temple activities'}{#if secDone(TEMPLE_KEYS)}<span class="sec-ok"><span class="sr-only">, complete</span>✓</span>{/if}{#if linear}<span class="sec-mk">{mk(['morning'])}</span>{/if}</h3>
          {#each TEMPLE_ACTIVITIES as a (a.key)}
            <Seg id="f-{a.key}" label={a.label} options={TEMPLE_ANSWERS} value={day[a.key] ?? null} onchange={(v) => set(a.key, v)} error={serverErr[a.key]} />
          {/each}
        </section>
      {/if}

      {#if rules?.chetnaOptions}
        <section class="section" aria-labelledby="h-chetna">
          <h3 id="h-chetna"><Icon name="spark" />Chetna</h3>
          {#each [['chetnaPositive', 'Positive', rules.chetnaOptions.positive], ['chetnaNegative', 'Negative', rules.chetnaOptions.negative]] as [key, title, opts]}
            <p class="label">{title}</p>
            <div class="chiprow chipgrid mb-4" role="group" aria-label={title}>
              {#each opts as o}<button type="button" class="chipbtn" aria-pressed={(day[key] || []).includes(o)} onclick={() => toggleChetna(key, o)}>{o}</button>{/each}
            </div>
          {/each}
        </section>
      {/if}

      <section class="section" aria-labelledby="h-comment">
        <h3 id="h-comment"><Icon name="msg" />Comment</h3>
        <TextArea id="comment" label="Comment" optional maxlength={500} counter class="mb-0" value={day.comment || ''} oninput={(e) => set('comment', e.currentTarget.value.trim() ? e.currentTarget.value : null)} />
      </section>
    </div>
    <aside class="dayrail" aria-label="This day">
      <p class="dr-score m-0"><span>Day score</span><strong class="tabular">{dp.percent}<small>/100</small></strong></p>
      <ul class="dr-secs">
        {#each JUMP as [id, title, keys] (id)}<li><button type="button" class:done={secDone(keys)} onclick={() => jump(id)}>{title}{#if secDone(keys)}<span aria-hidden="true">✓</span>{/if}</button></li>{/each}
      </ul>
      {#if card}<button type="button" class="btn btn-text btn-sm dr-rules" aria-haspopup="dialog" onclick={() => rulesDlg.showModal()}><Icon name="info" size={16} />Scoring</button>{/if}
      <button type="button" class="btn w-full {savePrimary ? 'btn-primary' : ''}" disabled={saveDisabled} aria-busy={status === 'saving'} onclick={save}>{saveLabel}</button>
      {#if !behalf}<button type="button" class="btn btn-outline w-full" disabled={dirty || status === 'saving'} onclick={share}><Icon name="share" size={18} />Share</button>{/if}
      <!-- E2 (phase 22): a facilitator's or trainee's own scorecard, the card screen's own component; desktop only (the rail
           is hidden below 1024 px, and nothing is asked for there), never while filling for somebody else -->
      {#if !behalf && wide.on && (railSc.trainee || railSc.facilitator)}
        {#await import('../screens/RailCard.svelte') then R}<R.default title={railSc.trainee?.name || 'My targets'} />{:catch}{/await}
      {/if}
    </aside>
    </div>
    {/key}

    <p class="hint min-h-5 text-center" role="status" id="f-share">{shareMsg}</p>

    <div class="ab-space" aria-hidden="true"></div>
    <div class="actionbar" class:behalf={!!behalf} role="region" aria-label="Day summary">
      <p class="sum m-0">
        <span class="sum-l" class:text-danger={status === 'offline' || status === 'error'} role="status" aria-live="polite">{status === 'offline' ? 'Not sent · no connection' : status === 'error' ? 'Not saved' : 'Day score'}</span>
        <strong class="tabular">{dp.percent}<span class="text-muted font-normal">/100</span></strong>
      </p>
      {#if !behalf}<button type="button" class="btn btn-outline ab-share" disabled={dirty || status === 'saving'} onclick={share} aria-label={dirty ? 'Share (save first)' : 'Share'}><Icon name="share" size={20} /></button>{/if}
      <button type="button" class="btn {savePrimary ? 'btn-primary' : ''}" disabled={saveDisabled} aria-busy={status === 'saving'} onclick={save}>{saveLabel}</button>
    </div>
    <Sheet bind:this={hearDlg} class="pick-sheet" titleId="hs-h" title="Hearing topic" sub="Choose the lecture you heard, or type the topic." onclose={() => closedLater(hearDlg, () => (hearOpen = false))}>
      {#if hearOpen}
      {#if topics.length}
        <ul class="m-0 mb-2 grid list-none gap-2 p-0" aria-label="Chosen topics">
          {#each topics as tt, i}
            <li class="rowlink py-1 pr-1"><span class="min-w-0 break-words">{tt}</span>
              <button type="button" class="btn btn-text btn-sm shrink-0 text-danger" onclick={() => removeHearing(i)} aria-label={`Remove ${tt}`}>Remove</button></li>
          {/each}
        </ul>
      {/if}
      {#await import('./HearingPicker.svelte') then P}<P.default lectures={journals?.lectures || []} heard={he.data?.progress?.heard || journals?.heard || []} selected={day.hearing || []} onToggle={toggleLecture} onAddText={addHearingText} max={99} />{/await}
      <div class="sheet-foot"><button type="button" class="btn btn-primary w-full" onclick={() => hearDlg.close()}>Done</button></div>
      {/if}
    </Sheet>
    <Sheet bind:this={bookDlg} class="pick-sheet" titleId="bs-h" title="Book" sub="Choose the book you read." onclose={() => closedLater(bookDlg, () => (bookOpen = false))}>
      {#if bookOpen}
      {#if remembered && JSON.stringify(remembered) !== JSON.stringify(day.reading)}
        <button type="button" class="btn mb-2 h-auto w-full py-2 text-left" onclick={() => pickBook(remembered)}>Same book as before: {bookTitle(remembered)}</button>
      {/if}
      {#await import('./BookPicker.svelte') then P}<P.default always books={journals?.books || []} ownLevel={journals?.ownBookLevel ?? null} bookNote={journals?.bookNote || ''} onPick={pickBook} />{/await}
      {/if}
    </Sheet>
    <Sheet bind:this={rulesDlg} class="rules-sheet" titleId="ru-h" title={`How ${behalf ? 'their' : 'your'} day is scored`} sub={`${batchName || (behalf ? 'Their batch' : 'Your batch')} · ${linear ? `out of ${card.dayMax} a day · marks slide between the two points` : 'each part up to 25 marks'}`}>
      {#if linear}
        {#each card.items as k (k)}
          <h3 class="ru-t">{card[k].label} <span class="font-normal text-muted">· up to {card[k].marks}</span></h3>
          <ul class="ru-list">{#each ruleRows(card[k]) as [t, m]}<li><span>{t}</span><b>{m}</b></li>{/each}</ul>
        {/each}
      {:else if card}
        {#each RULE_PARTS as [k, title]}
          {#if card[k]?.length}
            <h3 class="ru-t">{title}</h3>
            <ul class="ru-list">{#each card[k] as o}<li><span>{o.label.replace(/ - /g, ' – ')}</span><b class:neg={o.marks < 0}>{o.marks}</b></li>{/each}</ul>
          {/if}
        {/each}
      {/if}
    </Sheet>
    <Sheet bind:this={leaveDlg} back={false} titleId="lv-h" title="Save changes before leaving?" closeButton={false} onclose={() => (leaveTo = '')}>
      {#if status === 'offline'}<p class="err mb-3" role="alert">Not sent — no connection.</p>{/if}
      <div class="grid gap-2">
        <button type="button" class="btn btn-primary" disabled={status === 'saving'} onclick={() => leave('save')}>{#if status === 'saving'}<span class="spin" aria-hidden="true"></span>{/if}{status === 'saving' ? 'Saving…' : 'Save'}</button>
        {#if status === 'offline'}<button type="button" class="btn" onclick={() => leave('keep')}>Leave and save later</button>{/if}
        <button type="button" class="btn btn-danger" onclick={() => leave('discard')}>Discard changes</button>
        <button type="button" class="btn btn-text" onclick={() => leave('stay')}>Stay</button>
      </div>
    </Sheet>
  {/if}
{/if}

<style>
  /* D3: the section jump bar — one scrolling row under the day strip, below 1024 px */
  .jumpbar { position: sticky; top: calc(var(--sticky-top) + var(--strip-h, 64px)); z-index: var(--z-sticky);
             display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: -8px 0 var(--sp-3); padding: 6px 0;
             background: var(--bg); box-shadow: 0 1px 0 var(--border); }
  .jumpbar::-webkit-scrollbar { display: none; }
  .jchip { flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: var(--ctl-h); padding: 0 12px; border: 1px solid var(--border);
           border-radius: 999px; background: var(--surface); color: var(--text-secondary); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
  .jchip.done { color: var(--ok); border-color: var(--ok-line, var(--border)); }
  /* TRD (Phase 22): a section's marks so far, at the end of its heading */
  .sec-mk { margin-left: auto; color: var(--text-secondary); font-size: var(--fs-sm); font-weight: 600; font-variant-numeric: tabular-nums; }
  /* C8: from 1024 px the form keeps its 720 px column and a sticky rail takes the empty right third; the floating bar goes */
  .dayrail { display: none; }
  /* with the scorecard the rail can outgrow a laptop's height: it scrolls inside itself, Save staying at its top */
  :global(.dform section.section) { scroll-margin-top: calc(var(--sticky-top) + var(--strip-h, 64px) + 56px); }
  @media (min-width: 1024px) {
    .jumpbar { display: none; }
    .day-wrap { display: grid; grid-template-columns: minmax(0, 720px) minmax(220px, 280px); gap: var(--sp-5); align-items: start; }
    .dayrail { position: sticky; top: calc(var(--sticky-top) + 72px); display: grid; gap: var(--sp-3); padding: var(--sp-4);
               max-height: calc(100dvh - var(--sticky-top) - 88px); overflow-y: auto; overscroll-behavior: contain;
               border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
    .dr-score { display: flex; align-items: baseline; justify-content: space-between; color: var(--text-secondary); font-size: var(--fs-sm); }
    .dr-score strong { font-family: var(--font-serif); font-size: 1.75rem; font-weight: 650; color: var(--text); }
    .dr-score small { font-family: var(--font-sans); font-size: var(--fs-sm); color: var(--text-muted); }
    .dr-secs { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
    .dr-secs button { display: flex; justify-content: space-between; width: 100%; padding: 6px 8px; border: 0; border-radius: var(--r-sm);
                      background: none; color: var(--text-secondary); font: inherit; text-align: left; cursor: pointer; }
    .dr-secs button:hover { background: var(--surface-hover); color: var(--text); }
    .dr-secs button.done { color: var(--ok); }
    .dr-rules { justify-self: start; }
    .actionbar, .ab-space { display: none; }
  }
</style>
