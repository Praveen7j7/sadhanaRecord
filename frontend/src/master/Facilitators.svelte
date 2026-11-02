<script>
  let { tools } = $props();   // the page's Export, from Admin.svelte, laid out in this page's own head
  import Status from '../ui/Status.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import '../styles/controls.css';
  // Facilitators (master): the one list offered at sign-up, at a coordinator's approval and in a devotee's edit.
  // Switch a name off to stop offering it (their students then wait for the head's decision, ADR 0014 D); delete it
  // once it is off; add a new one.
  // Every change shows on all three at once and is copied to the Access sheet (Facilitators tab).
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { refreshMeta } from '../lib/meta.js';
  import { toast } from '../lib/pro.svelte.js';
  import Search from '../ui/Search.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import Button from '../ui/Button.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Seg from '../ui/Seg.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import { pressedInView } from '../lib/chips.js';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf, can } from '../lib/scopes.js';

  // the FTP coordinator opens this screen too (ADR 0019, the head, 26 Oct 2026): the list, adding, renaming, switching off
  // and making facilitation lasting. Deleting a name, facilitator logins and the students who need a new facilitator
  // stay the head's, so they are neither shown nor asked for.
  const sc = $derived(scopesOf(session.user)), head = $derived(sc.master), manage = $derived(can(sc, 'facManage'));

  const KEY = 'facilitators.list';
  const fetcher = () => call('facilitators.list');
  const e = entry(KEY);
  const d = $derived(e.data);
  const refresh = (force = false) => load(KEY, fetcher, { force });
  refresh();

  let q = $state(''), show = $state('ALL');
  const rows = $derived((d?.facilitators || []).filter((f) => (show === 'ALL' || (show === 'ON') === f.active) && (!q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()))));
  const after = (f) => { patch(KEY, (x) => { const l = x.facilitators.some((y) => y.name === f.name) ? x.facilitators.map((y) => (y.name === f.name ? f : y)) : [...x.facilitators, f];
    return { ...x, facilitators: l, counts: { on: l.filter((y) => y.active).length, off: l.filter((y) => !y.active).length } }; }); refreshMeta().catch(() => {}); };

  // add
  let name = $state(''), addErr = $state(''), adding = $state(false);
  async function add(ev) {
    ev.preventDefault();
    if (adding) return;
    adding = true; addErr = '';
    try { const f = await call('facilitators.add', { name }); after(f); name = ''; toast(`${f.name} added. It is offered at sign-up now.`); }
    catch (err) { addErr = fieldErrors(err).name || errorMessage(err); }
    adding = false;
  }

  // switch on / off
  let busy = $state('');
  async function setActive(f, on) {
    busy = f.name;
    try {
      const r = await call('facilitators.setActive', { name: f.name, active: on }); after(r); loadOrphans();
      toast(on ? `${f.name} is offered again.` : `${f.name} is switched off. Any students of theirs wait under Needs a new facilitator.`, { action: { label: 'Undo', run: () => setActive(f, !on) } });
    }
    catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    busy = '';
  }

  // delete (only a switched-off name)
  let sheet, del = $state(null), delBusy = $state(false), delErr = $state('');
  async function confirmDelete() {
    delBusy = true; delErr = '';
    try {
      await call('facilitators.delete', { name: del.name });
      patch(KEY, (x) => { const l = x.facilitators.filter((y) => y.name !== del.name); return { ...x, facilitators: l, counts: { on: l.filter((y) => y.active).length, off: l.filter((y) => !y.active).length } }; });
      refreshMeta().catch(() => {});
      toast(`${del.name} was deleted from the list.`);
      sheet.close();
    } catch (err) { delErr = errorMessage(err); }
    delBusy = false;
  }
  // ---- ADR 0014: rename once, everywhere; make a trainee's facilitation lasting; students who need a new facilitator
  let rsheet, ren = $state(null), newName = $state(''), renWhy = $state(''), renBusy = $state(false), renErr = $state('');
  async function doRename() {
    renBusy = true; renErr = '';
    try {
      const r = await call('facilitators.rename', { name: ren.name, newName, ...(renWhy.trim() ? { reason: renWhy.trim() } : {}) });
      rsheet.close(); await refresh(true); refreshMeta().catch(() => {}); loadOrphans();
      // one name, one place (Phase 24): the row is renamed and everything pointing to it follows; the app is its own source
      toast(`Renamed to ${r.name}. ${r.moved.students} ${r.moved.students === 1 ? 'student follows' : 'students follow'} the new name.`);
    } catch (err) { renErr = fieldErrors(err).newName || errorMessage(err); }
    renBusy = false;
  }
  async function makeLasting(f) {
    busy = f.name;
    try { after(await call('facilitators.setLasting', { name: f.name })); toast(`${f.name} now facilitates for good: the end of their training no longer takes it away.`); }
    catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    busy = '';
  }
  // one cache entry with Admin Home's Decisions, refreshed on every change here, so neither shows a stale answer
  const orphE = entry('facilitators.orphans'), orph = $derived(orphE.data);
  let pick = $state({}), oBusy = $state('');
  const loadOrphans = () => (head ? load('facilitators.orphans', () => call('facilitators.orphans'), { force: true }) : Promise.resolve());
  loadOrphans();
  async function decide(s, inactive) {
    oBusy = s.login;
    try {
      if (inactive) await call('devotees.setActive', { login: s.login, active: false });
      else await call('devotees.setPeople', { login: s.login, facilitator: pick[s.login] });
      toast(inactive ? `${s.name} is inactive: not counted from this week; the login stays.` : `${s.name}'s facilitator is ${pick[s.login]}.`);
      await loadOrphans(); refresh(true);
    } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    oBusy = '';
  }
  // ---- facilitator logins (4 Oct 2026): a facilitator signs in to see their devotees' sadhana, read-only
  const LK = 'facLogins.list';
  const le = entry(LK);
  if (head) load(LK, () => call('facLogins.list'));
  const loginOf = (name) => (le.data?.logins || []).find((l) => l.facilitator === name && l.status !== 'DISABLED') || (le.data?.logins || []).find((l) => l.facilitator === name) || null;
  // a facilitator who already uses the app as a devotee is linked by their phone (their own login gets "My students");
  // one who does not gets a login with a temporary password (the head, 7 Oct 2026)
  let lsheet, lfor = $state(null), lmode = $state(''), lkind = $state('member'), lphone = $state(''), luser = $state(''), lpw = $state(''), lBusy = $state(false), lErr = $state(''), lFe = $state({});
  function openLogin(f) {
    const l = loginOf(f.name);
    lfor = f; lmode = l ? 'manage' : 'create'; lkind = 'member'; lphone = ''; lErr = ''; lFe = {}; lpw = '';
    luser = l ? l.username : f.name.toLowerCase().replace(/\b(prabhuji|prabhu|pr|mataji|ji)\b/g, '').replace(/[^a-z]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30);
    lsheet.showModal();
  }
  async function loginCall(action, data, msg) {
    lBusy = true; lErr = ''; lFe = {};
    try {
      const r = await call(action, data);
      const gone = r.login ? r.login.username : data.username;
      patch(LK, (x) => ({ logins: [...(x?.logins || []).filter((y) => y.username !== gone), ...(r.login ? [r.login] : [])] }));
      toast(msg); lsheet.close();
    } catch (err) { lFe = fieldErrors(err); lErr = Object.keys(lFe).length ? '' : errorMessage(err); }
    lBusy = false;
  }
  const uses = (f) => [f.members ? `${f.members} ${f.members === 1 ? 'devotee' : 'devotees'}` : 'No devotees', f.waiting ? `${f.waiting} waiting sign-up${f.waiting === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
</script>

<!-- the top bar already says Facilitators: the heading stays for screen readers only (27 Oct 2026, search audit); no
     explanatory paragraph (Phase 24, V30) -->
<PageHeader title="Facilitators" sr actions={tools} />

{#if head && orph?.students.length}
  <!-- ADR 0014 D: their facilitator stopped facilitating; the head decides each one. Nothing is reassigned by itself. -->
  <section class="card fac-orph" aria-labelledby="fac-orph-h">
    <h3 id="fac-orph-h" class="m-0"><span class="fac-orh"><Icon name="alert" size={18} />Needs a new facilitator · {orph.students.length}</span></h3>
    <ul class="list fac-orl">
      {#each orph.students as s (s.login)}
        <li class="fac-or">
          <span class="lmain"><span class="lt">{s.name}</span><span class="ls">{s.batchName} · was with {s.facilitator}</span></span>
          <div class="fac-ora">
            <WheelSelect id={'fac-or-' + s.login} label="" class="mb-0" value={pick[s.login] || ''} placeholder="New facilitator"
              options={orph.facilitators.map((n) => [n, n])} onchange={(v) => (pick = { ...pick, [s.login]: v })} />
            <Button size="sm" variant="primary" disabled={!pick[s.login]} busy={oBusy === s.login} onclick={() => decide(s, false)}>Assign</Button>
            <Button size="sm" disabled={!!oBusy} onclick={() => decide(s, true)}>Mark inactive</Button>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if manage}<form class="card fac-add" onsubmit={add}>
  <TextInput id="fac-new" label="Add a facilitator" placeholder="e.g. Madhav Das Prabhuji" bind:value={name} error={addErr} autocomplete="off" class="mb-0" />
  <Button type="submit" busy={adding} disabled={name.trim().length < 3}><Icon name="plus" size={18} />Add</Button>
</form>{/if}

{#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="list" rows={6} />
{:else if d}
  <div class="fac-tools">
    <Search id="fac-q" label="Search facilitators" placeholder="Name" bind:value={q} class="mb-0" pin />
    <div class="chiprow counts one-line mb-0" role="group" aria-label="Show" {@attach pressedInView}>
      {#each [['ALL', 'All', d.counts.on + d.counts.off], ['ON', 'Switched on', d.counts.on], ['OFF', 'Switched off', d.counts.off]] as [v, t, n]}
        <button type="button" class="chipbtn" aria-pressed={show === v} onclick={() => (show = v)}><b>{n}</b>{t}</button>
      {/each}
    </div>
  </div>
  <div class="mb-head"><p class="m-0 text-sm text-muted" aria-live="polite">{rows.length} {rows.length === 1 ? 'name' : 'names'}</p><Refreshing on={e.refreshing} onrefresh={() => refresh(true)} /></div>
  {#if !rows.length}<EmptyState icon="users" title="No one here">{q ? 'No name matches the search.' : 'Nothing in this group.'}</EmptyState>
  {:else}
    <ul class="list" aria-label="Facilitators">
      {#each rows as f (f.name)}
        <li class="lrow fac-row" data-off={f.active ? undefined : ''}>
          <span class="lmain">
            <span class="lt">{f.name}</span>
            <span class="ls">{uses(f)}</span>
            <span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Status tone={f.active ? 'ok' : 'warn'} label={f.active ? 'Offered' : 'Switched off'} />
              {#if loginOf(f.name)}{@const l = loginOf(f.name)}<span class="pill" data-tone={l.status === 'DISABLED' ? 'warn' : 'info'}>{l.kind === 'member' ? 'In the app' : 'Login: ' + l.username}{l.status === 'DISABLED' ? ' (off)' : ''} · {l.batch}</span>{/if}
              {#if f.temporary}<span class="pill" data-tone="warn">ETP · until the training ends</span>
                {#if manage}<button type="button" class="btn btn-text btn-sm" disabled={busy === f.name} onclick={() => makeLasting(f)}>Make lasting</button>{/if}{/if}
            </span>
          </span>
          {#if manage}<label class="toggle fac-switch">
            <span class="sr-only">{f.active ? 'Switch off ' : 'Switch on '}{f.name}</span>
            <input type="checkbox" role="switch" checked={f.active} disabled={busy === f.name} aria-busy={busy === f.name || undefined}
              onchange={async (ev) => { const el = ev.currentTarget; await setActive(f, el.checked); el.checked = !!d.facilitators.find((y) => y.name === f.name)?.active; }} />
            <span class="switch" aria-hidden="true"></span>
          </label>
          <IconButton icon="edit" size={18} label={'Rename ' + f.name} onclick={() => { ren = f; newName = f.name; renWhy = ''; renErr = ''; rsheet.showModal(); }} />{/if}
          {#if head}<IconButton icon="lock" size={18} label={(loginOf(f.name) ? 'Manage the login of ' : 'Give a login to ') + f.name} onclick={() => openLogin(f)} />{/if}
          {#if head && !f.active}<IconButton icon="trash" size={18} label={'Delete ' + f.name} onclick={() => { del = f; delErr = ''; sheet.showModal(); }} />{/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<Sheet bind:this={lsheet} titleId="fac-l-t" title={lmode === 'create' ? 'Give access' : 'Access'} sub={lfor ? `${lfor.name} · sees their students' sadhana, cannot change it` : ''} onclose={() => (lfor = null)}>
  {#if lfor}
    {@const l = loginOf(lfor.name)}
    {#if lErr}<Banner>{lErr}</Banner>{/if}
    {#if lmode === 'create'}
      <Seg id="fl-kind" label="Do they use the app already?" options={[['member', 'Yes, as a devotee'], ['login', 'No, a new login']]} value={lkind} onchange={(v) => { lkind = v; lFe = {}; lErr = ''; }} />
      {#if lkind === 'member'}
        <TextInput id="fl-ph" label="Their mobile number" type="tel" inputmode="numeric" maxlength="10" bind:value={lphone} error={lFe.phone || lFe.facilitator} hint="My students appears in their own menu. No second login." autocomplete="off" />
        <Button variant="primary" busy={lBusy} disabled={lphone.replace(/\D/g, '').length < 10} onclick={() => loginCall('facLogins.link', { facilitator: lfor.name, phone: lphone.replace(/\D/g, '').slice(-10) }, `${lfor.name} now sees My students in their own login.`)}>Give access</Button>
      {:else}
        <TextInput id="fl-u" label="Username" bind:value={luser} error={lFe.username || lFe.facilitator} autocomplete="off" autocapitalize="none" spellcheck="false" />
        <TextInput id="fl-p" label="Temporary password" type="password" bind:value={lpw} error={lFe.tempPassword} hint="They choose their own at the first sign-in" autocomplete="new-password" />
        <Button variant="primary" busy={lBusy} onclick={() => loginCall('facLogins.create', { username: luser.trim().toLowerCase(), facilitator: lfor.name, tempPassword: lpw }, `Login ${luser} created. Tell ${lfor.name} the username and the temporary password.`)}>Create login</Button>
      {/if}
    {:else if l}
      <dl class="kv">
        <dt>{l.kind === 'member' ? 'Their login' : 'Username'}</dt><dd>{l.username}{l.kind === 'member' ? ' (their own, as a devotee)' : ''}</dd>
        <dt>Batch</dt><dd>{l.batch}</dd>
        <dt>Status</dt><dd>{l.status === 'DISABLED' ? 'Switched off' : l.mustChangePassword ? 'Temporary password' : 'Active'}</dd>
      </dl>
      <TextInput id="fl-p2" label="New temporary password" type="password" bind:value={lpw} error={lFe.tempPassword} hint={l.kind === 'member' ? 'Replaces their own password; they choose a new one at the next sign-in' : ''} autocomplete="new-password" />
      <div class="mt-1 grid grid-cols-2 gap-2">
        <Button busy={lBusy} disabled={!lpw} onclick={() => loginCall('facLogins.resetPassword', { username: l.username, tempPassword: lpw }, 'New temporary password set.')}>Reset password</Button>
        {#if l.kind === 'member'}
          <Button variant="danger" busy={lBusy} onclick={() => loginCall('facLogins.unlink', { username: l.username }, 'Facilitator access removed. Their own sadhana is unchanged.')}>Remove access</Button>
        {:else}
          <Button variant={l.status === 'DISABLED' ? 'primary' : 'danger'} busy={lBusy} onclick={() => loginCall('facLogins.setDisabled', { username: l.username, disabled: l.status !== 'DISABLED' }, l.status === 'DISABLED' ? 'Login switched on.' : 'Login switched off.')}>{l.status === 'DISABLED' ? 'Switch on' : 'Switch off'}</Button>
        {/if}
      </div>
    {/if}
  {/if}
</Sheet>

<Sheet bind:this={rsheet} titleId="fac-ren-t" title={ren ? `Rename ${ren.name}` : ''} sub="Changes it everywhere: the list, their students, their login, waiting sign-ups" onclose={() => (ren = null)}>
  {#if ren}
    <TextInput id="fac-ren" label="New name" bind:value={newName} error={renErr} autocomplete="off" />
    <TextInput id="fac-ren-why" label="Reason" optional bind:value={renWhy} hint="Kept in Activity." />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => rsheet.close()}>Cancel</button>
      <Button variant="primary" busy={renBusy} disabled={newName.trim().length < 3 || newName.trim() === ren.name} onclick={doRename}>Rename</Button>
    </div>
  {/if}
</Sheet>

<Sheet bind:this={sheet} titleId="fac-del-t" title={del ? `Delete ${del.name}?` : ''} onclose={() => (del = null)}>
  {#if del}
    <p class="m-0 mb-2 text-sm">The name leaves the list for good: it is no longer offered anywhere. {del.members ? `The ${del.members} ${del.members === 1 ? 'devotee who has' : 'devotees who have'} it keep it on their record.` : ''} You can add the name again later.</p>
    {#if delErr}<Banner>{delErr}</Banner>{/if}
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" disabled={delBusy} onclick={() => sheet.close()}>Cancel</button>
      <Button variant="danger-solid" busy={delBusy} onclick={confirmDelete}>Delete</Button>
    </div>
  {/if}
</Sheet>

<style>
  /* ADR 0014 D: students whose facilitator stopped facilitating */
  .fac-orph { margin-bottom: var(--sp-4); border-color: var(--warn-line, var(--border)); }
  .fac-orph h3 { font-size: var(--fs-h3); }
  .fac-orh { display: inline-flex; align-items: center; gap: var(--sp-2); }
  .fac-orl { margin: var(--sp-3) 0 0; padding: 0; list-style: none; }
  .fac-or { display: grid; gap: var(--sp-2); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); }
  .fac-or:last-child { border-bottom: 0; }
  .fac-or .lmain { display: grid; gap: 2px; min-width: 0; }
  .fac-ora { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: end; gap: var(--sp-2); }
  @media (max-width: 420px) { .fac-ora { grid-template-columns: 1fr 1fr; } .fac-ora :global(.field) { grid-column: 1 / -1; } }
</style>
