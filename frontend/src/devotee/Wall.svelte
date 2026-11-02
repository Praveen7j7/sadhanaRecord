<script>
  import { tick } from 'svelte';
  import { route } from '../lib/router.svelte.js';
  // The announcement wall. Plain text only (never HTML). Staff post, edit and remove; the cached list is patched from replies.
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { session } from '../lib/session.svelte.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { scopesOf, canRequests } from '../lib/scopes.js';
  import { markSeen, annState } from '../lib/ann.svelte.js';
  import { linkify, relTime, latestOf, isNew, shownOf, whenText, istParts } from '../lib/ann.js';
  // the cached list is changed only through lib/wallstore.js (audit roadmap 4.2): one place that knows the cache's
  // shape, so no screen has to remember the re-sort or the `latestAt` the bell reads
  import * as wall from '../lib/wallstore.js';
  import { cachedMeta, loadMeta } from '../lib/meta.js';
  import Banner from '../ui/Banner.svelte';
  import Status from '../ui/Status.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Button from '../ui/Button.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import TextArea from '../ui/TextArea.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import TimePicker from '../ui/TimePicker.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Seg from '../ui/Seg.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import RadioGroup from '../ui/RadioGroup.svelte';
  import FormActions from '../ui/FormActions.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import AnnImage from '../ui/AnnImage.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Radio from '../ui/Radio.svelte';
  import '../styles/screens.css';

  const KEY = wall.KEY;
  const e = entry(KEY);
  const sc = $derived(scopesOf(session.user));
  const staff = $derived(canRequests(sc));
  const list = $derived(e.data?.announcements);
  let meta = $state(cachedMeta());
  loadMeta().then((m) => (meta = m)).catch(() => {});
  load(KEY);
  $effect(() => { if (e.data) markSeen(e.data.latestAt || latestOf(e.data.announcements || [])); });
  // Phase 9: opening the Wall clears its notifications from the phone's tray (they have been seen)
  $effect(() => { try { navigator.serviceWorker?.ready.then((r) => r.getNotifications()).then((ns) => ns.forEach((n) => { if (/^ann-/.test(n.tag)) n.close(); })).catch(() => {}); } catch { /* no service worker */ } });
  // what was new when the wall opened stays marked New while it is open (opening the wall marks everything seen)
  const seenAtOpen = annState.seen;

  // facilitator audiences (the head, 9 Oct 2026): youth facilitators and TRD facilitators — together, every facilitator
  const FAC_AUD = [['FAC_YOUTH', 'Youth facilitators', 'Facilitators who are devotees of a batch'], ['FAC_TRD', 'TRD facilitators', 'Facilitators with no batch (temple residents)']];
  const nameOf = (id) => FAC_AUD.find((f) => f[0] === id)?.[1] || (meta.batches || []).find((b) => b.batchId === id)?.name || id;
  // a facilitator's students (Phase 9, item 8): 'STU:<facilitator>'
  const stuName = (id) => (String(id).startsWith('STU:') ? String(id).slice(4) : '');
  const audienceText = (a) => (!a.audience ? '' : a.audience === 'ALL' ? 'Everyone' : a.audience.map((id) => (stuName(id) ? (stuName(id) === sc.facilitator?.name ? 'Your students' : 'Students of ' + stuName(id)) : nameOf(id))).join(', '));
  const myBatches = $derived(sc.master ? (meta.batches || []).map((b) => b.batchId) : sc.coordinator);
  // who may post: the head and coordinators (their batches), and a facilitator (their students only)
  const canPost = $derived(staff || !!sc.facilitator);
  const studentsOnly = $derived(!staff && !!sc.facilitator);
  const bothRoles = $derived(!sc.master && sc.coordinator.length > 0 && !!sc.facilitator);
  // scheduled posts (Phase 9, item 23): "Show from" now or later; "Show for" until removed, a length, or until a time
  const LENGTHS = [['', 'Until removed'], ['30', '30 minutes'], ['60', '1 hour'], ['180', '3 hours'], ['1440', '1 day'], ['4320', '3 days'], ['10080', '1 week'], ['until', 'Until a date and time…']];
  const at530 = (date, time) => `${date}T${time}:00+05:30`;
  const sched = $derived((list || []).filter((a) => a.scheduled));
  const feed = $derived((list || []).filter((a) => !a.scheduled));

  // ---- compose / edit ----
  let form = $state(null);                       // null = closed; { id?, title, body, all, batches, pinned, ends }
  let busy = $state(false);
  let error = $state('');
  let fe = $state({});
  let confirmId = $state(0);
  let note = $state('');

  const timing = (a) => { const f = a?.scheduled ? istParts(a.publishAt) : { date: '', time: '' }, u = a?.expiresAt ? istParts(a.expiresAt) : { date: '', time: '' };
    return { from: a?.scheduled ? 'later' : 'now', fromDate: f.date, fromTime: f.time || '18:00', len: a?.expiresAt ? 'until' : '', untilDate: u.date, untilTime: u.time || '21:00' }; };
  function openNew() { showForm(); form = { title: '', body: '', all: false, batches: [...myBatches], pinned: false, who: studentsOnly ? 'students' : 'batch', image: undefined, ...timing(null) }; fe = {}; error = ''; note = ''; }
  // the picture: undefined = unchanged, null = removed, { b64, w, h, preview } = a new one (shrunk on the phone)
  let picBusy = $state(false), picErr = $state('');
  async function pickPicture(ev) {
    const file = ev.currentTarget.files?.[0]; ev.currentTarget.value = '';
    if (!file) return;
    picBusy = true; picErr = '';
    try { const { shrinkPicture } = await import('../lib/annimage.js'); form.image = await shrinkPicture(file); }
    catch (err) { picErr = err.message || 'This picture could not be used.'; }
    picBusy = false;
  }
  const hasPicture = $derived(form && (form.image ? true : form.image === undefined && !!form.current));
  // the form sits at the top: bring it into view (a post further down otherwise seemed to have no Edit, 4 Oct 2026)
  const showForm = () => tick().then(() => document.getElementById('h-form')?.closest('form')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  function openEdit(a) { showForm(); form = { id: a.id, title: a.title, body: a.body, all: a.audience === 'ALL', batches: a.audience === 'ALL' ? [...myBatches] : (a.audience || []).filter((x) => !stuName(x)), pinned: a.pinned,
    who: (a.audience || [])[0] && stuName(a.audience[0]) ? 'students' : 'batch', scheduled: !!a.scheduled, image: undefined, current: a.image ? { id: a.id, image: a.image } : null, ...timing(a) }; fe = {}; error = ''; note = ''; picErr = ''; }
  const toggleBatch = (b) => { form.batches = form.batches.includes(b) ? form.batches.filter((x) => x !== b) : [...form.batches, b]; };

  async function save(ev) {
    ev.preventDefault();
    if (busy) return;
    fe = {}; error = '';
    if (form.title.trim().length < 2) fe.title = 'A title of 2 to 80 characters.';
    if (!form.body.trim()) fe.body = 'Write the announcement (at most 1,000 characters).';
    if (sc.master && !form.all && !form.batches.length) fe.audience = 'Choose who should see it.';
    // the start can be set on a new post or one still waiting; a post already on the wall keeps its own
    const timed = !form.id || form.scheduled;
    if (timed && form.from === 'later' && !form.fromDate) fe.publishAt = 'Choose the day it appears.';
    if (form.len === 'until' && !form.untilDate) fe.expiresAt = 'Choose the day it ends.';
    if (Object.keys(fe).length) return;
    const start = timed && form.from === 'later' ? at530(form.fromDate, form.fromTime) : null;
    const base = start ? Date.parse(start) : Date.now();
    const expiresAt = !form.len ? null : form.len === 'until' ? at530(form.untilDate, form.untilTime) : new Date(base + Number(form.len) * 60e3).toISOString();
    busy = true;
    const audience = sc.master ? (form.all ? 'ALL' : form.batches) : studentsOnly || (bothRoles && form.who === 'students') ? ['STUDENTS'] : [...myBatches];
    const data = { title: form.title, body: form.body, audience, pinned: form.pinned, expiresAt, ...(timed ? { publishAt: start } : {}),
                   ...(form.image ? { image: form.image.b64 } : form.image === null && form.id ? { image: null } : {}) };
    try {
      const r = form.id ? await call('announcements.update', { id: form.id, ...data }) : await call('announcements.create', data);
      if (form.id) wall.edited(r.announcement); else wall.added(r.announcement);
      toast(r.announcement.scheduled ? `Scheduled for ${whenText(r.announcement.publishAt)}` : form.id ? 'Saved' : 'Posted');
      if (form.image?.preview) URL.revokeObjectURL(form.image.preview);
      form = null;
    } catch (err) {
      fe = fieldErrors(err);
      if (!Object.keys(fe).length) error = errorMessage(err);
    }
    busy = false;
  }
  const dataOf = (a, over = {}) => ({ title: a.title, body: a.body, audience: a.audience, pinned: a.pinned, expiresAt: a.expiresAt || null, ...(a.scheduled ? { publishAt: a.publishAt } : {}), ...over });
  // how far a post's notification reached (Phase 9, item 18): its author and the head see it on the post
  const reachText = (r) => !r ? '' : !r.done ? `Notifications going out · ${r.sent} so far`
    : !r.tried ? 'Notifications: no phone in its audience had them on'
    : `Notifications reached ${r.sent} of ${r.tried} phones${r.gone ? ` · ${r.gone} no longer reachable` : ''}${r.failed ? ` · ${r.failed} failed` : ''}`;
  // a scheduled post shown at once
  let nowBusy = $state(0);
  async function postNow(a) {
    nowBusy = a.id;
    try { const r = await call('announcements.update', { id: a.id, publishAt: null }); wall.edited(r.announcement); toast('Posted'); }
    catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    nowBusy = 0;
  }
  // optimistic: gone at once; back with an error if the server refuses; Undo posts it again
  async function remove(a) {
    if (busy) return;
    const before = e.data.announcements;
    wall.removed(a.id);
    confirmId = 0;
    try {
      await call('announcements.remove', { id: a.id });
      toast('Announcement removed', { action: { label: 'Undo', run: async () => {
        try { const r = await call('announcements.create', dataOf(a)); wall.added(r.announcement); toast('Posted again', { kind: 'info' }); }
        catch (err) { toast(errorMessage(err), { kind: 'err' }); }
      } } });
    } catch (err) { wall.replace(before); toast(errorMessage(err), { kind: 'err' }); }
  }
  // ---- like, comment, share (4 Oct 2026)
  let menuFor = $state(0), commentsFor = $state(0), draft = $state({}), sending = $state(false);
  async function like(a) {
    const before = { likes: a.likes || 0, liked: !!a.liked };
    wall.setPost(a.id, { liked: !before.liked, likes: before.likes + (before.liked ? -1 : 1) });          // at once
    try { wall.setPost(a.id, await call('announcements.like', { id: a.id, like: !before.liked })); }
    catch (err) { wall.setPost(a.id, before); toast(errorMessage(err), { kind: 'err' }); }
  }
  function toggleComments(a) {
    commentsFor = commentsFor === a.id ? 0 : a.id;
    if (commentsFor) load('announcements.comments:' + a.id, () => call('announcements.comments', { id: a.id }), { force: true });
  }
  async function sendComment(ev, a) {
    ev.preventDefault();
    const body = (draft[a.id] || '').trim();
    if (!body || sending) return;
    sending = true;
    try {
      const r = await call('announcements.comment', { id: a.id, body });
      wall.commentAdded(a.id, r.comment);
      wall.setPost(a.id, { likes: r.likes, liked: r.liked, comments: r.comments });
      draft = { ...draft, [a.id]: '' };
    } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    sending = false;
  }
  async function uncomment(a, c) {
    try {
      const r = await call('announcements.uncomment', { commentId: c.id });
      wall.commentRemoved(a.id, c.id);
      wall.setPost(a.id, r);
    } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
  }
  // Share: WhatsApp with the post ready to send (title, text, the app's address)
  const postUrl = (a) => (typeof location === 'undefined' ? '' : `${location.origin}/#/wall?post=${a.id}`);
  const shareLink = (a) => 'https://wa.me/?text=' + encodeURIComponent(`*${a.title}*\n\n${a.body}\n\n— IYF Delhi · Sadhana Record\n${postUrl(a)}`);
  // a shared link (#/wall?post=<id>) opens that post: scrolled to and highlighted (after logging in, if need be)
  const wanted = $derived(Number(new URLSearchParams(route.path.split('?')[1] || '').get('post')) || 0);
  let shown = 0;
  /** Scroll to a post and mark it, once it is on screen. */
  const reveal = (id) => tick().then(() => {
    const el = document.getElementById('post-' + id);
    if (!el) return false;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('post-hl'); setTimeout(() => el.classList.remove('post-hl'), 2600);
    return true;
  });
  $effect(() => {
    if (!wanted || !list || shown === wanted) return;
    shown = wanted;
    reveal(wanted).then(async (found) => {
      if (found) return;
      // The wall shows the 50 newest posts this person may see, and a shared WhatsApp link is exactly the one
      // people keep and forward — so a link to an older post used to say "no longer on the wall" about a post
      // that is perfectly alive (audit FE-17). Fetch that one post and put it at the top.
      try {
        const r = await call('announcements.get', { id: wanted });
        wall.added(r.announcement);
        if (!(await reveal(wanted))) toast('That post is no longer on the wall.', { kind: 'info' });
      } catch { toast('That post is no longer on the wall.', { kind: 'info' }); }
    });
  });
  // optimistic pin / unpin
  async function pin(a) {
    const before = e.data.announcements;
    wall.pinned(a.id, !a.pinned);
    try { const r = await call('announcements.update', { id: a.id, ...dataOf(a, { pinned: !a.pinned }) }); wall.edited(r.announcement); toast(a.pinned ? 'Unpinned' : 'Pinned to the top'); }
    catch (err) { wall.replace(before); toast(errorMessage(err), { kind: 'err' }); }
  }

  // ---- moderation (8 Oct 2026, an app-store rule): report a post or a comment; hide a person's comments for yourself;
  // the IYF head can hide them for everyone and works through the reports. Nothing here names who reported.
  const master = $derived(!!sc.master);
  let rep = $state(null), repReason = $state(''), repNote = $state(''), repErr = $state(''), repBusy = $state(false), repDlg = $state();
  let cmtMenu = $state(0);
  const REASONS = [['spam', 'Spam or advertising'], ['abusive', 'Abusive or hurtful'], ['inappropriate', 'Not suitable for the wall'], ['other', 'Something else']];
  function openReport(a, c = null) { rep = { a, c }; repReason = ''; repNote = ''; repErr = ''; menuFor = 0; cmtMenu = 0; repDlg.showModal(); }
  async function sendReport() {
    if (!repReason) { repErr = 'Choose a reason.'; return; }
    repBusy = true;
    try {
      await call('announcements.report', { id: rep.a.id, ...(rep.c ? { commentId: rep.c.id } : {}), reason: repReason, ...(repNote.trim() ? { note: repNote.trim() } : {}) });
      repDlg.close(); toast('Thank you. The IYF head will look at it.');
      if (master) load('announcements.reports', undefined, { force: true });
    } catch (err) { repErr = errorMessage(err); }
    repBusy = false;
  }
  const mutesE = entry('mutes.list');
  load('mutes.list');
  async function hideAuthor(a, c, all = false) {
    cmtMenu = 0;
    try {
      const r = await call(all ? 'mutes.setAll' : 'mutes.set', { commentId: c.id, mute: true });
      await Promise.all([load('announcements.comments:' + a.id, () => call('announcements.comments', { id: a.id }), { force: true }), load('mutes.list', undefined, { force: true })]);
      toast(all ? `${r.name}'s comments are hidden for everyone.` : `You won't see ${r.name}'s comments.`, { action: { label: 'Undo', run: () => showAgain(r.key, all) } });
    } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
  }
  async function showAgain(key, all = false) {
    try { await call(all ? 'mutes.setAll' : 'mutes.set', { key, mute: false }); await load('mutes.list', undefined, { force: true }); if (commentsFor) await load('announcements.comments:' + commentsFor, () => call('announcements.comments', { id: commentsFor }), { force: true }); }
    catch (err) { toast(errorMessage(err), { kind: 'err' }); }
  }
  const reportsE = entry('announcements.reports');
  $effect(() => { if (master) load('announcements.reports', undefined, { force: true }); });   // the head's queue is always current on the Wall
  let resolving = $state('');
  async function resolve(r, action) {
    resolving = r.key + action;
    try {
      await call('announcements.resolve', { postId: r.postId, ...(r.commentId ? { commentId: r.commentId } : {}), action });
      await Promise.all([load('announcements.reports', undefined, { force: true }), load(KEY, undefined, { force: true })]);
      toast(action === 'remove' ? (r.kind === 'post' ? 'Post removed.' : 'Comment removed.') : 'Report dismissed.');
    } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    resolving = '';
  }
  const REASON_WORD = Object.fromEntries(REASONS.map(([k, v]) => [k, v.split(' ')[0].toLowerCase()]));
</script>

{#if canPost && !form}<div class="mb-4 flex justify-end"><Button variant="primary" class="w-auto" onclick={openNew}><Icon name="edit" size={18} />{studentsOnly ? 'Post to my students' : 'New announcement'}</Button></div>{/if}
{#if error}<Banner>{error}</Banner>{/if}

{#if form}
  <form class="section" onsubmit={save} novalidate aria-labelledby="h-form">
    <h3 id="h-form"><Icon name="edit" />{form.id ? 'Edit announcement' : 'New announcement'}</h3>
    <TextInput id="an-title" label="Title" bind:value={form.title} error={fe.title} maxlength="80" autocomplete="off" />
    <TextArea id="an-body" label="Message" bind:value={form.body} error={fe.body} maxlength={1000} counter hint="Plain text. Links become tappable." />
    <!-- who sees it: the IYF head chooses (and can change it later); a coordinator always posts to their own batches -->
    {#if sc.master}
      <RadioGroup legend="Who sees it" error={fe.audience}>
        <Checkbox label="Everyone" desc="Every batch and every facilitator" bind:checked={form.all} />
        {#if !form.all}
          {#each myBatches as b (b)}<Checkbox label={nameOf(b)} checked={form.batches.includes(b)} onchange={() => toggleBatch(b)} />{/each}
          <p class="label mb-0 mt-2">Facilitators</p>
          {#each FAC_AUD as [id, label, desc] (id)}<Checkbox {label} {desc} checked={form.batches.includes(id)} onchange={() => toggleBatch(id)} />{/each}
        {/if}
      </RadioGroup>
    {:else if bothRoles}
      <Seg id="an-who" label="Who sees it" options={[['batch', myBatches.map(nameOf).join(', ')], ['students', 'My students']]} value={form.who} onchange={(v) => (form.who = v)} />
    {:else if studentsOnly}
      <p class="an-to"><Icon name="users" size={16} />To your students — the devotees whose facilitator you are, in every batch.</p>
    {/if}
    <div class="field">
      <p class="label">Picture <span class="opt">(optional)</span></p>
      <div class="pickpic">
        {#if form.image}<img src={form.image.preview} alt="The picture to post" />
        {:else if form.image === undefined && form.current}<span class="w-24"><AnnImage id={form.current.id} image={form.current.image} alt="The current picture" /></span>{/if}
        <label class="btn btn-sm" aria-busy={picBusy || undefined}>{#if picBusy}<span class="spin" aria-hidden="true"></span>{:else}<Icon name="plus" size={16} />{/if}{hasPicture ? 'Change picture' : 'Add a picture'}
          <input type="file" accept="image/*" class="sr-only" onchange={pickPicture} disabled={picBusy} /></label>
        {#if hasPicture}<button type="button" class="btn btn-sm btn-text" onclick={() => (form.image = null)}>Remove picture</button>{/if}
      </div>
      {#if picErr || fe.image}<p class="err" role="alert"><Icon name="alert" size={16} />{picErr || fe.image}</p>{/if}
      <p class="hint m-0 -mt-2">Shrunk on this phone before sending (at most 1280 px), so it is quick for everyone.</p>
    </div>
    <Toggle label="Pin to the top" desc="Shown first until you unpin it" bind:checked={form.pinned} class="mb-2" />
    {#if !form.id || form.scheduled}
      <Seg id="an-from" label="Show from" options={[['now', 'Now'], ['later', 'Later']]} value={form.from} onchange={(v) => (form.from = v)} error={fe.publishAt} />
      {#if form.from === 'later'}
        <div class="an-when"><DateInput id="an-from-d" label="Day" bind:value={form.fromDate} min={istParts(new Date().toISOString()).date} /><TimePicker id="an-from-t" label="Time" value={form.fromTime} onchange={(v) => (form.fromTime = v)} def="18:00" /></div>
        <p class="hint m-0 -mt-2 mb-3">Only you{sc.master ? '' : ' and the IYF head'} see it until then. Its notification goes out at that time.</p>
      {/if}
    {/if}
    <WheelSelect id="an-len" label="Show for" options={LENGTHS} value={form.len} onchange={(v) => (form.len = v)} error={form.len === 'until' ? '' : fe.expiresAt} />
    {#if form.len === 'until'}
      <div class="an-when"><DateInput id="an-until-d" label="Until (day)" bind:value={form.untilDate} error={fe.expiresAt} /><TimePicker id="an-until-t" label="Time" value={form.untilTime} onchange={(v) => (form.untilTime = v)} def="21:00" /></div>
    {/if}
    <FormActions align="end">
      <Button variant="text" onclick={() => (form = null)} disabled={busy}>Cancel</Button>
      <Button variant="primary" class="w-auto" type="submit" {busy}>{form.id ? 'Save' : (!form.id || form.scheduled) && form.from === 'later' ? 'Schedule' : 'Post'}</Button>
    </FormActions>
  </form>
{/if}

{#if e.error && !list}<Banner onretry={() => load(KEY, undefined, { force: true })}>{errorMessage(e.error)}</Banner>{/if}
{#if !list && !e.error}<Skeleton rows={3} />
{:else if list}
  <!-- Refresh ends where the feed ends, not alone at the far right of a wide screen (Phase 24, V29) -->
  <div class="page-read"><Refreshing on={e.refreshing} onrefresh={() => load(KEY, undefined, { force: true })} /></div>
  {#if master && reportsE.data?.reports?.length}
    <section class="section reports" aria-labelledby="h-rep">
      <h3 id="h-rep"><Icon name="alert" />Reports to review ({reportsE.data.reports.length})</h3>
      <ul class="m-0 grid list-none gap-3 p-0">
        {#each reportsE.data.reports as r (r.key)}
          <li class="rep">
            <p class="m-0 text-sm text-muted">{r.kind === 'post' ? 'Post' : 'Comment'} by {r.authorName} · reported {r.count === 1 ? 'once' : r.count + ' times'} · {r.reasons.map((x) => REASON_WORD[x] || x).join(', ')} · {relTime(r.lastAt)}</p>
            <p class="m-0 mt-1 break-words">{r.excerpt}</p>
            {#each r.notes || [] as n}<p class="m-0 mt-1 text-sm text-muted">“{n}”</p>{/each}
            <div class="mt-2 flex flex-wrap gap-2">
              {#if !r.removed}<Button variant="danger" class="w-auto" busy={resolving === r.key + 'remove'} onclick={() => resolve(r, 'remove')}>Remove {r.kind}</Button>{/if}
              <Button variant="outline" class="w-auto" busy={resolving === r.key + 'dismiss'} onclick={() => resolve(r, 'dismiss')}>{r.removed ? 'Close' : 'Keep it'}</Button>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if sched.length}
    <!-- scheduled posts (Phase 9, item 23): only their author and the IYF head see them, until they start -->
    <section class="section sched" aria-labelledby="h-sched">
      <h3 id="h-sched"><Icon name="clock" />Scheduled ({sched.length})</h3>
      <ul class="m-0 grid list-none gap-3 p-0">
        {#each sched as a (a.id)}
          <li class="sc-row">
            <p class="m-0 font-semibold break-words">{a.title}</p>
            <p class="m-0 mt-1 text-sm text-muted">Appears {whenText(a.publishAt)}{a.expiresAt ? ' · until ' + whenText(a.expiresAt) : ''}{a.audience ? ' · ' + audienceText(a) : ''}{a.author !== session.user?.name ? ' · by ' + a.author : ''}</p>
            {#if confirmId === a.id}
              <div class="confirm danger mt-2" role="group" aria-label="Delete this scheduled post">
                <p class="q">Delete “{a.title}”? It will not be posted.</p>
                <div class="grid grid-cols-2 gap-2"><Button variant="outline" onclick={() => (confirmId = 0)}>Keep</Button><Button variant="danger-solid" onclick={() => remove(a)}>Delete</Button></div>
              </div>
            {:else}
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="btn btn-sm" onclick={() => openEdit(a)}><Icon name="edit" size={16} />Edit</button>
                <Button variant="outline" class="btn-sm w-auto" busy={nowBusy === a.id} onclick={() => postNow(a)}>Post now</Button>
                <button type="button" class="btn btn-sm btn-danger" onclick={() => (confirmId = a.id)}><Icon name="trash" size={16} />Delete</button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  <!-- one column of posts at every width: long announcements keep a readable line length -->
  <div class="feed">
    {#each feed as a (a.id)}
      <!-- a post like social media (the head, 4 Oct 2026): author and time, the post, then Like · Comment · Share -->
      <article class="section post" id={'post-' + a.id} aria-labelledby={'an-' + a.id}>
        <header class="post-h">
          <span class="post-av" aria-hidden="true">{(a.author || '?').trim().charAt(0).toUpperCase()}</span>
          <span class="min-w-0 flex-1"><b class="block truncate">{a.author}</b><span class="post-meta">{relTime(shownOf(a))}{#if a.audience} · {audienceText(a)}{/if}{#if isNew(a, seenAtOpen) && a.author !== session.user?.name}{' · '}<Status tone="accent" label="New" />{/if}</span></span>
          {#if a.pinned}<span class="pill" data-tone="info" title="Pinned"><Icon name="pin" size={12} />Pinned</span>{/if}
          <IconButton icon="more" size={20} label="Post options" aria-expanded={menuFor === a.id} onclick={() => (menuFor = menuFor === a.id ? 0 : a.id)} />
        </header>
        {#if !a.canEdit && menuFor === a.id}
          <div class="post-menu"><button type="button" class="btn btn-sm" onclick={() => openReport(a)}><Icon name="alert" size={16} />Report this post</button></div>
        {/if}
        {#if a.canEdit && menuFor === a.id && confirmId !== a.id}
          <div class="post-menu"><button type="button" class="btn btn-sm" onclick={() => { menuFor = 0; openEdit(a); }}><Icon name="edit" size={16} />Edit</button><button type="button" class="btn btn-sm btn-outline" aria-pressed={a.pinned} onclick={() => { menuFor = 0; pin(a); }}><Icon name="pin" size={16} />{a.pinned ? 'Unpin' : 'Pin'}</button><button type="button" class="btn btn-sm btn-danger" onclick={() => (confirmId = a.id)}><Icon name="trash" size={16} />Remove</button></div>
        {/if}
        {#if a.canEdit && confirmId === a.id}
          <div class="confirm danger" role="group" aria-label="Remove this announcement">
            <p class="q">Remove “{a.title}” for everyone?</p>
            <div class="grid grid-cols-2 gap-2"><Button variant="outline" disabled={busy} onclick={() => (confirmId = 0)}>Keep</Button><Button variant="danger-solid" {busy} onclick={() => remove(a)}>Remove</Button></div>
          </div>
        {/if}
        <h2 id={'an-' + a.id} class="post-t">{a.title}</h2>
        <p class="m-0 whitespace-pre-line break-words">{#each linkify(a.body) as s}{#if s.t === 'url'}<a class="ilink break-all" href={s.v} target="_blank" rel="noopener noreferrer">{s.v}</a>{:else}{s.v}{/if}{/each}</p>
        {#if a.image}<div class="post-img"><AnnImage id={a.id} image={a.image} alt={a.title} /></div>{/if}
        {#if a.reach}<p class="post-reach"><Icon name="bell" size={14} />{reachText(a.reach)}</p>{/if}
        {#if a.likes || a.comments}
          <p class="post-counts">{#if a.likes}<span><Icon name="heart" size={14} />{a.likes}</span>{/if}{#if a.comments}<button type="button" class="ilink" onclick={() => toggleComments(a)}>{a.comments} {a.comments === 1 ? 'comment' : 'comments'}</button>{/if}</p>
        {/if}
        <div class="post-bar" role="group" aria-label="React to this post">
          <button type="button" aria-pressed={!!a.liked} onclick={() => like(a)}><Icon name="heart" size={18} />{a.liked ? 'Liked' : 'Like'}</button>
          <button type="button" aria-expanded={commentsFor === a.id} onclick={() => toggleComments(a)}><Icon name="msg" size={18} />Comment</button>
          <a href={shareLink(a)} target="_blank" rel="noopener noreferrer"><Icon name="share" size={18} />Share<span class="sr-only"> on WhatsApp</span></a>
        </div>
        {#if commentsFor === a.id}
          {@const ce = entry('announcements.comments:' + a.id)}
          <div class="post-comments">
            {#if !ce.data}<Skeleton rows={1} />
            {:else}
              {#each ce.data.comments as c (c.id)}
                <div class="cmt"><span class="post-av sm" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
                  <div class="cmt-b"><b>{c.name}</b> <span class="post-meta">{relTime(c.at)}</span><p class="m-0 whitespace-pre-line break-words">{c.body}</p></div>
                  {#if c.canRemove}<IconButton icon="trash" size={16} label="Remove this comment" onclick={() => uncomment(a, c)} />{/if}
                  {#if !c.mine}<IconButton icon="more" size={16} label={'Options for ' + c.name + "'s comment"} aria-expanded={cmtMenu === c.id} onclick={() => (cmtMenu = cmtMenu === c.id ? 0 : c.id)} />{/if}</div>
                {#if cmtMenu === c.id}
                  <div class="post-menu cmt-menu">
                    <button type="button" class="btn btn-sm" onclick={() => openReport(a, c)}><Icon name="alert" size={16} />Report</button>
                    <button type="button" class="btn btn-sm" onclick={() => hideAuthor(a, c)}><Icon name="eyeoff" size={16} />Hide {c.name.split(' ')[0]}'s comments</button>
                    {#if master}<button type="button" class="btn btn-sm btn-danger" onclick={() => hideAuthor(a, c, true)}><Icon name="eyeoff" size={16} />Hide for everyone</button>{/if}
                  </div>
                {/if}
              {:else}<p class="m-0 text-sm text-muted">No comments yet. Be the first.</p>{/each}
            {/if}
            {#if ce.data?.commentsBlocked}<p class="hint m-0">Comments are turned off for your account. Contact your coordinator.</p>
            {:else}
            <form class="cmt-new" onsubmit={(ev) => sendComment(ev, a)}>
              <label class="sr-only" for={'cm-' + a.id}>Write a comment</label>
              <input id={'cm-' + a.id} class="input" placeholder="Write a comment…" maxlength="500" bind:value={draft[a.id]} autocomplete="off" />
              <button type="submit" class="btn btn-primary btn-sm" disabled={!(draft[a.id] || '').trim() || sending}>Send</button>
            </form>
            {/if}
          </div>
        {/if}
      </article>
    {:else}
      {#if studentsOnly}<EmptyState class="md:col-span-2" icon="bell" title="No announcements yet">Post one for your students with Post to my students.</EmptyState>
      {:else if staff}<EmptyState class="md:col-span-2" icon="bell" title="No announcements yet">Post one for your batch with New announcement.</EmptyState>
      {:else}<EmptyState class="md:col-span-2" icon="bell" title="No announcements yet" />{/if}
    {/each}
  </div>
  {#if mutesE.data?.mutes?.length || mutesE.data?.everyone?.length}
    <section class="section hidden-people mt-4" aria-labelledby="h-hid">
      <h3 id="h-hid"><Icon name="eyeoff" />Hidden comments</h3>
      <ul class="m-0 grid list-none gap-2 p-0">
        {#each mutesE.data.mutes || [] as m (m.key)}<li class="rowlink py-1 pr-1"><span>{m.name} <span class="text-sm text-muted">· hidden for you</span></span><button type="button" class="btn btn-text btn-sm" onclick={() => showAgain(m.key)}>Show again</button></li>{/each}
        {#each mutesE.data.everyone || [] as m (m.key)}<li class="rowlink py-1 pr-1"><span>{m.name} <span class="text-sm text-muted">· hidden for everyone{m.by ? ' by ' + m.by : ''}</span></span><button type="button" class="btn btn-text btn-sm" onclick={() => showAgain(m.key, true)}>Show again</button></li>{/each}
      </ul>
    </section>
  {/if}
{/if}

<Sheet bind:this={repDlg} titleId="rep-h" title={rep?.c ? 'Report this comment' : 'Report this post'} sub="The IYF head sees what was reported, never who reported it.">
  {#if rep}
    <RadioGroup legend="Why?" error={repErr}>
      {#each REASONS as [k, label]}<Radio name="rep-reason" value={k} bind:group={repReason}>{label}</Radio>{/each}
    </RadioGroup>
    <TextInput id="rep-note" label="Anything to add" optional maxlength="200" bind:value={repNote} autocomplete="off" />
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" disabled={repBusy} onclick={() => repDlg.close()}>Cancel</button>
      <Button variant="primary" busy={repBusy} onclick={sendReport}>Send report</Button>
    </div>
  {/if}
</Sheet>

<style>
  .feed { display: grid; gap: var(--sp-4); max-width: var(--page-read); margin-inline: 0; }   /* under the title, not centred away from it (Phase 24, V15) */
  /* the whole Wall is one column: the post form and the head's queues share the feed's width */
  :is(form.section, .reports, .sched, .hidden-people) { max-width: var(--page-read); }
  .feed > :global(.section) { margin-bottom: 0; }
  .post-meta :global(.status) { display: inline-flex; vertical-align: baseline; }
  .post { padding-bottom: 6px; scroll-margin-top: 84px; transition: box-shadow .6s ease; }
  :global(.post.post-hl) { box-shadow: 0 0 0 3px var(--accent), var(--shadow-1); }
  .post-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .post-av { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-family: var(--font-serif); font-size: 1.1rem; }
  .post-av.sm { width: 30px; height: 30px; font-size: 0.9rem; }
  .post-meta { display: block; font-size: var(--fs-caption); color: var(--text-muted); }
  .cmt-b .post-meta { display: inline; }
  .cmt-menu { margin: -4px 0 8px 40px; }
  .post-reach { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; font-size: var(--fs-caption); color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .sched .sc-row { padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md); }
  .an-to { display: flex; align-items: center; gap: 8px; margin: 0 0 var(--sp-4); color: var(--text-secondary); font-size: var(--fs-sm); }
  .an-when { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 12px; }
  .reports .rep { padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md); }
  .post-menu { display: flex; flex-wrap: wrap; gap: 8px; margin: -2px 0 10px; }
  .post-t { margin: 0 0 6px; font-size: 1.1875rem; line-height: 1.3; }
  .post-img { margin: 12px -16px 0; }
  .post-img :global(img) { border-radius: 0; }
  .post-counts { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 10px 0 0; font-size: var(--fs-sm); color: var(--text-muted); }
  .post-counts span { display: inline-flex; align-items: center; gap: 4px; }
  .post-counts span :global(svg) { fill: var(--accent); color: var(--accent); }   /* red is kept for errors and deleting */
  .post-counts .ilink { margin-left: auto; font-size: var(--fs-sm); background: none; border: 0; padding: 0; cursor: pointer; color: var(--text-muted); }
  .post-bar { display: grid; grid-template-columns: repeat(3, 1fr); margin: 8px -8px 0; padding-top: 4px; border-top: 1px solid var(--border); }
  .post-bar > * { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; border: 0; border-radius: var(--r-md); background: none; color: var(--text-muted); font: inherit; font-size: var(--fs-sm); font-weight: 600; text-decoration: none; cursor: pointer; }
  .post-bar > *:hover { background: var(--surface-2); color: var(--text); }
  .post-bar [aria-pressed='true'] { color: var(--accent); }
  .post-bar [aria-pressed='true'] :global(svg) { fill: currentColor; }
  .post-comments { display: grid; gap: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
  .cmt { display: flex; align-items: flex-start; gap: 8px; }
  .cmt-b { flex: 1; min-width: 0; padding: 8px 12px; border-radius: 14px; background: var(--surface-2); font-size: var(--fs-sm); }
  .cmt-new { display: flex; gap: 8px; align-items: center; }
  .cmt-new .input { flex: 1 1 auto; width: auto; min-width: 0; min-height: var(--ctl-h); border-radius: 999px; padding-inline: 16px; }
  .cmt-new .btn { flex: none; width: auto; min-width: 72px; border-radius: 999px; }
</style>
