<script>
  let { tools } = $props();   // the page's Export, from Admin.svelte, laid out in this page's own head
  // Coordinators (master): a list on phones, a table on wide screens. New / Edit / Reset password open in a sheet;
  // Disable asks first (Enable does not). Phase 9, item 24 (the user, 9 Oct 2026): "Add staff" can also appoint a new
  // IYF head directly — with a reason, no batches, no sadhana — and it takes effect only when every other active IYF
  // head approves ("Waiting for approval" at the top, where the asked heads approve or decline).
  import Status from '../ui/Status.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import { tick } from 'svelte';
  import { call, errorMessage, fieldErrors, normalizePhone } from '../lib/api.js';
  import { isUsername, isPhone } from '../lib/validate.js';
  import TextInput from '../ui/TextInput.svelte';
  import Seg from '../ui/Seg.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import RadioGroup from '../ui/RadioGroup.svelte';
  import Button from '../ui/Button.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import SlowHint from '../ui/SlowHint.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { upsertCoordinator } from './sync.js';
  import { wide } from '../lib/wide.svelte.js';

  const le = entry('coordinators.list');
  const be = entry('batches.list');
  const list = $derived(le.data);
  const batches = $derived(be.data || []);
  const nameOf = (id) => batches.find((b) => b.batchId === id)?.name || id;
  let error = $state('');
  let note = $state('');
  let busy = $state('');
  let mode = $state(''); // '' | 'new' | username being edited
  let f = $state({ username: '', name: '', phone: '', batchIds: [], tempPassword: '', role: 'coordinator', reason: '' });
  let fe = $state({});
  let resetFor = $state('');
  let resetPw = $state('');
  let menuFor = $state(null), menuSheet = $state();
  let disabling = $state(null);   // the coordinator whose Disable is being confirmed
  let sheet = $state(), resetSheet = $state(), disSheet = $state();

  load('coordinators.list');
  load('batches.list');
  // new IYF heads waiting for every other head's approval
  const hr = entry('heads.requests');
  const loadHeads = (force = false) => load('heads.requests', () => call('heads.requests'), { force });
  loadHeads();
  let decl = $state(null), declNote = $state(''), declSheet = $state();
  async function decide(r, approve) {
    if (busy) return;
    if (!approve && declNote.trim().length < 2) { fe = { note: 'Say briefly why you decline.' }; return; }
    busy = 'hr' + r.id; fe = {};
    try {
      const d = await call('heads.decide', { id: r.id, approve, ...(approve ? {} : { note: declNote.trim() }) });
      declSheet?.close(); decl = null;
      toast(!approve ? `Declined: ${r.name} will not be a head.` : d.done ? `${r.name} is now an IYF head.` : `Approved. Waiting for ${d.request.heads.filter((h) => !h.approved).map((h) => h.name).join(', ')}.`);
      await Promise.all([loadHeads(true), d.done ? load('coordinators.list', undefined, { force: true }) : null]);
    } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) toast(errorMessage(e), { kind: 'err' }); }
    busy = '';
  }
  async function withdraw(r) {
    if (busy) return;
    busy = 'hr' + r.id;
    try { await call('heads.withdraw', { id: r.id }); toast('Withdrawn'); await loadHeads(true); } catch (e) { toast(errorMessage(e), { kind: 'err' }); }
    busy = '';
  }

  async function openNew() { mode = 'new'; f = { username: '', name: '', phone: '', batchIds: [], tempPassword: '', role: 'coordinator', reason: '' }; fe = {}; note = ''; error = ''; await tick(); sheet?.showModal(); }
  async function openEdit(c) { mode = c.username; f = { username: c.username, name: c.name, phone: c.phone || '', batchIds: [...c.batchIds], tempPassword: '', role: 'coordinator', reason: '' }; fe = {}; note = ''; error = ''; await tick(); sheet?.showModal(); }
  const asHead = $derived(mode === 'new' && f.role === 'head');
  // the full-time facilitators' coordinator (the head, 27 Oct 2026): no batches; every FTP right (ADR 0019)
  const asFtp = $derived(mode === 'new' && f.role === 'ftp');
  function toggle(id) { f.batchIds = f.batchIds.includes(id) ? f.batchIds.filter((x) => x !== id) : [...f.batchIds, id]; }

  // Runs a write whose reply is { coordinator }; patches the cached lists from it. Never refetches.
  async function run(key, fn, msg) {
    if (busy) return false;
    busy = key; error = ''; note = '';
    try {
      const d = await fn();
      if (d.coordinator) upsertCoordinator(d.coordinator);
      toast(msg);
      return true;
    } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) error = errorMessage(e); return false; }
    finally { busy = ''; }
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    fe = {};
    if (mode === 'new') {
      f.username = f.username.trim().toLowerCase();
      if (!isUsername(f.username)) fe.username = 'Use 3 to 30 lowercase letters, digits, . _ -';
      if (f.tempPassword.length < 8 || f.tempPassword.length > 64) fe.tempPassword = 'Use 8 to 64 characters';
    }
    if (f.name.trim().length < 2) fe.name = 'Enter a name';
    if (asHead && f.reason.trim().length < 2) fe.reason = 'Give a short reason for appointing a new IYF head.';
    const ph = normalizePhone(f.phone);
    if (ph && !isPhone(ph)) fe.phone = 'Enter a 10-digit mobile number';
    if (Object.keys(fe).length) return;
    if (asHead) {
      // a new head: made at once only when no other head has to approve; otherwise it waits for them
      busy = 'save'; error = '';
      try {
        const d = await call('coordinators.create', { username: f.username, name: f.name.trim(), ...(ph ? { phone: ph } : {}), tempPassword: f.tempPassword, master: true, reason: f.reason.trim() });
        if (d.pending) { toast(`Sent for approval to ${d.request.heads.map((h) => h.name).join(', ')}. ${f.name.trim()} can sign in once every head approves.`); await loadHeads(true); }
        else { if (d.coordinator) upsertCoordinator(d.coordinator); toast(`${f.name.trim()} is now an IYF head. They must change the temporary password at first login.`); }
        sheet?.close(); mode = '';
      } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) error = errorMessage(e); }
      busy = '';
      return;
    }
    const ok = await run('save', () => mode === 'new'
      ? call('coordinators.create', { username: f.username, name: f.name.trim(), ...(ph ? { phone: ph } : {}), ...(asFtp ? { ftp: true } : { batchIds: f.batchIds }), tempPassword: f.tempPassword })
      : call('coordinators.update', { username: mode, name: f.name.trim(), ...(ph ? { phone: ph } : {}), batchIds: f.batchIds }),
    mode === 'new' ? `Created ${f.username}. They must change the temporary password at first login.` : 'Saved');
    if (ok) { sheet?.close(); mode = ''; }
  }

  async function openReset(c) { resetFor = c.username; resetPw = ''; fe = {}; error = ''; note = ''; await tick(); resetSheet?.showModal(); }
  async function doReset(e) {
    e.preventDefault();
    fe = {};
    if (resetPw.length < 8 || resetPw.length > 64) { fe.tempPassword = 'Use 8 to 64 characters'; return; }
    const u = resetFor;
    const ok = await run('reset', () => call('coordinators.resetPassword', { username: u, tempPassword: resetPw }), `Temporary password set for ${u}. They must change it at next login.`);
    if (ok) { resetSheet?.close(); resetFor = ''; resetPw = ''; }
  }

  // Disable asks first; Enable is immediate. Optimistic: flip at once, roll back with an error banner if refused.
  async function askDisable(c) { if (c.status === 'DISABLED') return toggleDisabled(c); disabling = c; await tick(); disSheet?.showModal(); }
  async function toggleDisabled(c) {
    if (busy) return;
    const disabled = c.status !== 'DISABLED';
    const before = c.status;
    const set = (status) => patch('coordinators.list', (l) => l.map((x) => (x.username === c.username ? { ...x, status } : x)));
    busy = 'dis' + c.username; error = ''; note = '';
    set(disabled ? 'DISABLED' : 'ACTIVE');
    disSheet?.close();
    try {
      const d = await call('coordinators.setDisabled', { username: c.username, disabled });
      if (d.coordinator) upsertCoordinator(d.coordinator);
      toast(disabled ? `Disabled ${c.username}` : `Enabled ${c.username}`, { action: { label: 'Undo', run: () => toggleDisabled({ ...c, status: disabled ? 'DISABLED' : 'ACTIVE' }) } });
    } catch (e) {
      set(before);
      toast(errorMessage(e), { kind: 'err' });
    } finally { busy = ''; disabling = null; }
  }
  // head access (masters.set — ADR 0017): making somebody a head needs every other active head's approval, so the
  // answer may be "asked" rather than done; removing it is immediate and signs them out of head screens
  let headFor = $state(null), headSheet = $state(), headWhy = $state(''), headFe = $state({}), headBusy = $state(false);
  async function openHead(c) { headFor = c; headWhy = ''; headFe = {}; await tick(); headSheet?.showModal(); }
  async function setHead() {
    headBusy = true; headFe = {};
    const c = headFor, make = !c.master;
    try {
      const r = await call('masters.set', { login: c.username, master: make, reason: headWhy.trim() });
      headSheet?.close();
      if (r.pending) { toast(`Asked the other heads to approve ${c.name}.`); loadHeads(true); }
      else { if (r.coordinator) upsertCoordinator(r.coordinator); else load('coordinators.list', undefined, { force: true }); toast(make ? `${c.name} is now an IYF head.` : `${c.name} is no longer an IYF head.`); }
    } catch (e) { headFe = fieldErrors(e); if (!Object.keys(headFe).length) toast(errorMessage(e), { kind: 'err' }); }
    headBusy = false;
  }
  // #10 (22 Oct 2026): from 1024 px, list and detail side by side — the chosen person's details and actions beside the
  // list, instead of a table with a menu per row (the Requests pattern)
  let pickU = $state('');
  const pick = $derived(list?.find((c) => c.username === pickU) || list?.[0] || null);
  const others = (b) => b.coordinatorLogins.filter((l) => l !== mode && l !== f.username);
</script>

<!-- Phase 6: one ⋯ per coordinator (Edit, Reset password, Disable / Enable); nothing destructive in the row -->
{#snippet actions(c)}
  <IconButton icon="more" size={18} label={'More for ' + c.name} aria-haspopup="dialog" onclick={(e) => { e.stopPropagation(); menuFor = c; menuSheet.showModal(); }} />
{/snippet}
{#snippet status(c)}<Status tone={c.status === 'DISABLED' ? 'bad' : 'ok'} label={c.status === 'DISABLED' ? 'Disabled' : 'Active'} />{#if c.mustChangePassword}<Status tone="warn" label="Temporary password" />{/if}{#if !c.batchIds.length}<Status tone="warn" label="No batch" />{/if}{/snippet}

<PageHeader title="Coordinators" sr meta={list ? `${list.length} coordinator${list.length === 1 ? '' : 's'}` : ''}>
  {#snippet actions()}
    {#if list}<Refreshing on={le.refreshing || be.refreshing} onrefresh={() => load('coordinators.list', undefined, { force: true })} />{/if}
    {@render tools?.()}
    <Button variant="primary" class="w-auto" onclick={openNew}><Icon name="plus" size={18} />Add staff</Button>
  {/snippet}
</PageHeader>
{#if hr.data?.open?.length}
  <!-- new IYF heads waiting for every other head's approval (Phase 9, item 24) -->
  <section class="section hr-box" aria-labelledby="hr-h">
    <h3 id="hr-h"><Icon name="shield" />Waiting for approval ({hr.data.open.length})</h3>
    <ul class="m-0 grid list-none gap-3 p-0">
      {#each hr.data.open as r (r.id)}
        <li class="hr-row">
          <p class="m-0"><b>{r.name}</b> <span class="text-sm text-muted">· {r.kind === 'CREATE' ? 'new IYF head · ' + r.login : 'staff login made IYF head'}</span></p>
          <p class="m-0 mt-1 text-sm">“{r.reason}” <span class="text-muted">— {r.requestedBy}</span></p>
          <p class="m-0 mt-2 flex flex-wrap gap-x-3 gap-y-1">{#each r.heads as h (h.login)}<Status tone={h.approved ? 'ok' : 'warn'} label={(h.approved ? 'Approved: ' : 'Waiting: ') + h.name} />{/each}</p>
          {#if r.mine || r.canWithdraw}
            <div class="mt-3 flex flex-wrap gap-2">
              {#if r.mine}<Button variant="primary" class="w-auto" busy={busy === 'hr' + r.id} onclick={() => decide(r, true)}>Approve</Button>
                <button type="button" class="btn btn-outline w-auto" onclick={async () => { decl = r; declNote = ''; fe = {}; await tick(); declSheet.showModal(); }}>Decline…</button>{/if}
              {#if r.canWithdraw}<button type="button" class="btn btn-text w-auto" onclick={() => withdraw(r)}>Withdraw</button>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="m-0 mt-3 text-xs text-muted">A new IYF head can sign in only when every head asked has approved. A request lapses after {hr.data.days} days.</p>
  </section>
{/if}
{#if error && !mode && !resetFor}<Banner>{error}</Banner>{/if}

{#if le.error && !list}<Banner onretry={() => load('coordinators.list', undefined, { force: true })}>{errorMessage(le.error)}</Banner>{/if}
{#if !list && !le.error}<Skeleton kind="list" />
{:else if list}
  {#if !list.length}<EmptyState class="card" icon="users" title="No coordinators yet">Add the first coordinator and give them their batches.</EmptyState>
  {:else}
    {#if wide.on}
      <div class="co-split">
        <ul class="list" aria-label="Staff">
          {#each list as c (c.username)}
            <li><button type="button" class="lrow co-main" class:co-on={pick?.username === c.username} aria-current={pick?.username === c.username ? 'true' : undefined} onclick={() => (pickU = c.username)}>
              <span class="avatar h-10 w-10 text-base" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
              <span class="lmain"><span class="lt">{c.name}</span><span class="ls">{c.username} · {c.batchIds.map(nameOf).join(', ') || (c.ftp ? 'FTP coordinator' : 'no batch')}</span></span>
            </button></li>
          {/each}
        </ul>
        <section class="card co-pane" aria-live="polite" aria-label={pick ? pick.name : 'Staff member'}>
          {#if pick}
            <div class="flex items-center gap-3"><span class="avatar h-12 w-12 text-lg" aria-hidden="true">{pick.name.charAt(0).toUpperCase()}</span>
              <div class="min-w-0"><h3 class="m-0">{pick.name}</h3><p class="m-0 text-sm text-muted">{pick.username}{pick.phone ? ' · ' + pick.phone : ''}</p></div></div>
            <p class="m-0 mt-3 flex flex-wrap gap-x-3 gap-y-1">{@render status(pick)}{#if pick.master}<span class="pill" data-tone="info">IYF head</span>{/if}</p>
            <dl class="kv mt-3"><dt>Batches</dt><dd>{pick.batchIds.map(nameOf).join(', ') || (pick.ftp ? 'FTP coordinator' : 'none')}</dd>{#if pick.lastLogin}<dt>Last signed in</dt><dd>{pick.lastLogin.slice(0, 10)}</dd>{/if}</dl>
            <div class="co-acts">
              <button type="button" class="btn btn-outline" onclick={() => openEdit(pick)}><Icon name="edit" size={18} />Edit…</button>
              <button type="button" class="btn btn-outline" onclick={() => openReset(pick)}><Icon name="lock" size={18} />Reset password…</button>
              <button type="button" class="btn btn-outline" onclick={() => openHead(pick)}><Icon name="shield" size={18} />{pick.master ? 'Remove head access…' : 'Make IYF head…'}</button>
              <button type="button" class="btn {pick.status === 'DISABLED' ? 'btn-outline' : 'btn-danger'}" onclick={() => askDisable(pick)}><Icon name={pick.status === 'DISABLED' ? 'ok' : 'alert'} size={18} />{pick.status === 'DISABLED' ? 'Enable' : 'Disable…'}</button>
            </div>
          {/if}
        </section>
      </div>
    {:else}
    <ul class="list tbl-narrow" aria-label="Coordinators">
      {#each list as c (c.username)}
        <li class="co-row">
          <button type="button" class="lrow co-main" onclick={() => openEdit(c)} aria-label={'Edit ' + c.name}>
            <span class="avatar h-10 w-10 text-base" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
            <span class="lmain"><span class="lt">{c.name}</span><span class="ls">{c.username} · {c.batchIds.map(nameOf).join(', ') || (c.ftp ? 'FTP coordinator' : 'no batch')}</span>
              <span class="mt-1 flex flex-wrap gap-x-3 gap-y-1">{@render status(c)}</span></span>
          </button>
          {@render actions(c)}
        </li>
      {/each}
    </ul>
    <table class="tbl tbl-wide">
      <thead><tr><th>Name</th><th>Username</th><th>Phone</th><th>Batches</th><th>Status</th><th class="num"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>
        {#each list as c (c.username)}
          <tr><td class="font-semibold">{c.name}</td><td>{c.username}</td><td>{c.phone || '—'}</td><td>{c.batchIds.map(nameOf).join(', ') || (c.ftp ? 'FTP coordinator' : 'none')}</td>
            <td><span class="flex flex-wrap gap-1">{@render status(c)}</span></td><td><div class="acts">{@render actions(c)}</div></td></tr>
        {/each}
      </tbody>
    </table>
    {/if}
  {/if}
{/if}

<Sheet bind:this={sheet} wide dismiss={false} titleId="co-h" title={mode === 'new' ? 'Add staff' : 'Edit ' + mode} onclose={() => (mode = '')}>
  <form onsubmit={save} novalidate>
    {#if error}<Banner>{error}</Banner>{/if}
    {#if mode === 'new'}<Seg id="co-role" label="Role" options={[['coordinator', 'Coordinator'], ['ftp', 'FTP coordinator'], ['head', 'IYF head']]} value={f.role} onchange={(v) => (f.role = v)} />{/if}
    {#if mode === 'new'}<TextInput id="co-u" label="Username" bind:value={f.username} error={fe.username} autocapitalize="none" spellcheck="false" autocomplete="off" hint="3 to 30 lowercase letters, digits, . _ -" />{/if}
    <div class="pair">
      <TextInput id="co-n" label="Name" bind:value={f.name} error={fe.name} autocomplete="off" />
      <TextInput id="co-ph" label="Phone" optional bind:value={f.phone} error={fe.phone} type="tel" inputmode="numeric" autocomplete="off" />
    </div>
    {#if asHead}
      <TextInput id="co-why" label="Why they are being appointed" bind:value={f.reason} error={fe.reason} maxlength="200" autocomplete="off" hint="Kept in Activity. Every other IYF head must approve before they can sign in." />
      <p class="hr-note"><Icon name="shield" size={16} />An IYF head sees every batch and every devotee's details. They have no sadhana form of their own.</p>
    {:else if asFtp}
      <p class="hr-note"><Icon name="users" size={16} />Looks after the full-time facilitators: every facilitator's scoreboard, phase by phase; adding, renaming and switching off facilitators; making facilitation lasting; opening their targets. Fine-tune in Access.</p>
    {:else}
    <RadioGroup legend="Batches" desc="Moving a batch ends the other coordinator's access to it at once." error={fe.batchIds}>
      {#each batches as b (b.batchId)}
        <Checkbox checked={f.batchIds.includes(b.batchId)} onchange={() => toggle(b.batchId)} label={b.name} desc={others(b).length ? 'Now with ' + others(b).join(', ') : ''} />
      {/each}
    </RadioGroup>
    {/if}
    {#if mode === 'new'}
      <TextInput id="co-p" label="Temporary password" bind:value={f.tempPassword} error={fe.tempPassword} hint="They must change it at first login." autocomplete="off" />
    {/if}
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
      <Button variant="primary" type="submit" busy={busy === 'save'}>{mode !== 'new' ? 'Save' : asHead ? 'Ask for approval' : asFtp ? 'Create FTP coordinator' : 'Create coordinator'}</Button>
    </div>
    <SlowHint busy={busy === 'save'} />
  </form>
</Sheet>

<Sheet bind:this={resetSheet} titleId="rp-h" title="Reset password" sub={resetFor} onclose={() => (resetFor = '')}>
  <form onsubmit={doReset} novalidate>
    {#if error}<Banner>{error}</Banner>{/if}
    <TextInput id={'rp-' + resetFor} label="New temporary password" bind:value={resetPw} error={fe.tempPassword} hint="They must change it at next login; their sessions end now." autocomplete="off" />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => resetSheet.close()}>Cancel</button>
      <Button variant="primary" type="submit" busy={busy === 'reset'}>Set password</Button>
    </div>
    <SlowHint busy={busy === 'reset'} />
  </form>
</Sheet>

<Sheet bind:this={headSheet} titleId="co-hd" title={headFor ? (headFor.master ? `Remove ${headFor.name}'s head access` : `Make ${headFor.name} an IYF head`) : ''} sub={headFor?.username || ''} onclose={() => (headFor = null)}>
  {#if headFor}
    <p class="m-0 mb-3 text-sm">{headFor.master ? 'They lose the Admin screens at once. Their batches stay theirs.' : 'An IYF head sees and changes everything. Every other active head is asked to approve first.'}</p>
    <TextInput id="co-hd-why" label="Reason" bind:value={headWhy} error={headFe.reason} hint="Kept in Activity." />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => headSheet.close()}>Cancel</button>
      <Button variant={headFor.master ? 'danger' : 'primary'} busy={headBusy} onclick={setHead}>{headFor.master ? 'Remove head access' : 'Ask to make head'}</Button>
    </div>
  {/if}
</Sheet>

<Sheet bind:this={menuSheet} titleId="co-m-h" title={menuFor?.name || ''} sub={menuFor ? menuFor.username : ''} onclose={() => (menuFor = null)}>
  {#if menuFor}
    {@const c = menuFor}
    <ul class="m-0 grid list-none gap-2 p-0">
      <li><button type="button" class="lrow co-mi" onclick={() => { menuSheet.close(); openEdit(c); }}><Icon name="edit" size={20} /><span class="lmain"><span class="lt">Edit…</span><span class="ls">Name, phone and batches</span></span></button></li>
      <li><button type="button" class="lrow co-mi" onclick={() => { menuSheet.close(); openHead(c); }}><Icon name="shield" size={20} /><span class="lmain"><span class="lt">{c.master ? 'Remove head access…' : 'Make IYF head…'}</span><span class="ls">{c.master ? 'They keep their batches; the Admin screens go' : 'Every other active head approves first'}</span></span></button></li>
      <li><button type="button" class="lrow co-mi" onclick={() => { menuSheet.close(); openReset(c); }}><Icon name="lock" size={20} /><span class="lmain"><span class="lt">Reset password…</span><span class="ls">A temporary password they change at sign-in</span></span></button></li>
      <li><button type="button" class="lrow co-mi" class:co-danger={c.status !== 'DISABLED'} onclick={() => { menuSheet.close(); askDisable(c); }}><Icon name={c.status === 'DISABLED' ? 'ok' : 'alert'} size={20} /><span class="lmain"><span class="lt">{c.status === 'DISABLED' ? 'Enable' : 'Disable…'}</span><span class="ls">{c.status === 'DISABLED' ? 'They can sign in again' : 'Logged out at once; their batches stay assigned'}</span></span></button></li>
    </ul>
  {/if}
</Sheet>

<Sheet bind:this={disSheet} titleId="ds-h" title={disabling ? `Disable ${disabling.name}?` : ''} onclose={() => { if (!busy) disabling = null; }}>
  {#if disabling}
    <p class="mb-4 mt-0 text-sm text-muted">{disabling.username} is logged out at once and cannot log in until you enable the account again. Their batches stay assigned.</p>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => disSheet.close()}>Cancel</button>
      <Button variant="danger-solid" onclick={() => toggleDisabled(disabling)}>Disable</Button>
    </div>
  {/if}
</Sheet>

<Sheet bind:this={declSheet} titleId="hr-d-h" title={decl ? `Decline ${decl.name}?` : ''} sub="They will not become an IYF head." onclose={() => (decl = null)}>
  {#if decl}
    <TextInput id="hr-note" label="Why" bind:value={declNote} error={fe.note} maxlength="200" autocomplete="off" hint="Kept in Activity; the head who asked sees it." />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => declSheet.close()}>Cancel</button>
      <Button variant="danger-solid" busy={busy === 'hr' + decl.id} onclick={() => decide(decl, false)}>Decline</Button>
    </div>
  {/if}
</Sheet>

<style>
  /* #10: list + detail from 1024 px */
  .co-split { display: grid; grid-template-columns: minmax(300px, 400px) minmax(0, 1fr); gap: var(--sp-5); align-items: start; }
  .co-split .co-main { width: 100%; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
  .co-split .co-on { background: var(--surface-hover); box-shadow: inset 3px 0 0 var(--accent); }
  .co-pane { position: sticky; top: calc(var(--sticky-top) + var(--sp-3)); padding: var(--sp-4); }
  .co-acts { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-4); }

  .hr-box .hr-row { padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md); }
  .hr-note { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 var(--sp-4); color: var(--text-secondary); font-size: var(--fs-sm); }
  .co-row { display: flex; align-items: center; gap: 4px; padding-right: 8px; }
  .co-main, .co-mi { flex: 1; min-width: 0; width: 100%; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
  .co-danger .lt { color: var(--danger); }
</style>
