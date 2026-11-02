<script>
  import Status from '../ui/Status.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  // Group leaders of a batch (decision 41, the head 3 Oct 2026): the coordinator (or the IYF head, for any batch)
  // appoints student devotees of the batch as group leaders and decides who is in each group — a devotee is in at most
  // one group, of their own batch. A leader is in no group: their own attendance is the coordinator's to mark on the
  // Status board. Removing a leader leaves their members in no group.
  import { untrack } from 'svelte';
  import { call, errorMessage } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { waLink, telLink } from '../lib/contact.js';
  import { STATUS } from '../lib/staff.js';
  import { toast } from '../lib/pro.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import Button from '../ui/Button.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  let { batchId, batchName = '' } = $props();

  const key = $derived('leaders.list:' + batchId);
  const e = $derived(entry(key));
  const d = $derived(e.data);
  const refresh = (force = false) => load(key, () => call('leaders.list', { batchId }), { force });
  $effect(() => { key; untrack(() => refresh()); });

  const groups = $derived(d?.groups || []);
  // one pool per level (SPS, SPS Group 2 and SPS Online together): its name, and each member's batch when it has several
  const pool = $derived(d?.batches?.length > 1 ? d.batches.map((b) => b.name).join(', ').replace(/, ([^,]*)$/, ' and $1') : batchName || 'this batch');
  const many = $derived((d?.batches?.length || 0) > 1);
  const bname = (id) => d?.batches?.find((b) => b.batchId === id)?.name || id;
  const unassigned = $derived(d?.unassigned || []);
  // anyone active who is not a leader yet can be appointed (someone in a group leaves it)
  const candidates = $derived([...unassigned, ...groups.flatMap((g) => g.members.filter((m) => m.active))].sort((a, b) => a.name.localeCompare(b.name)));
  let busy = $state(''), err = $state('');

  async function act(what, fn, done) {
    busy = what; err = '';
    try { await fn(); await refresh(true); if (done) toast(done); return true; }
    catch (x) { err = errorMessage(x); return false; }
    finally { busy = ''; }
  }

  // ---- appoint ----
  let pick = $state('');
  const appoint = () => pick && act('appoint', () => call('leaders.set', { login: pick, leader: true }), `${candidates.find((c) => c.login === pick)?.name} is now a group leader.`).then((ok) => { if (ok) pick = ''; });

  // ---- remove a leader (asked first) ----
  let removing = $state('');
  const removeLeader = (g) => act('rm:' + g.leader.login, () => call('leaders.set', { login: g.leader.login, leader: false }), `${g.leader.name} is no longer a group leader; the group's devotees are in no group now.`).then(() => (removing = ''));

  // ---- members ----
  // taking someone out acts at once, so it can be undone from the message (8 Oct 2026: there was no way back)
  async function takeOut(g, m) {
    if (!(await act('out:' + m.login, () => call('leaders.assign', { leader: '', logins: [m.login] })))) return;
    toast(`${m.name} is in no group now.`, { action: { label: 'Undo', run: async () => {
      try { await call('leaders.assign', { leader: g.leader.login, logins: [m.login] }); await refresh(true); toast(`${m.name} is back in ${g.leader.name}'s group.`, { kind: 'info' }); }
      catch (x) { toast(errorMessage(x), { kind: 'err' }); }
    } } });
  }
  let appointDlg = $state();
  let sheet = $state(), forG = $state(null), chosen = $state({});
  function openAdd(g) { forG = g; chosen = Object.fromEntries(unassigned.map((m) => [m.login, false])); err = ''; sheet.showModal(); }
  const chosenLogins = $derived(Object.keys(chosen).filter((k) => chosen[k]));
  async function addChosen() {
    const n = chosenLogins.length;
    if (await act('add', () => call('leaders.assign', { leader: forG.leader.login, logins: chosenLogins }), `${n} devotee${n === 1 ? '' : 's'} added to ${forG.leader.name}'s group.`)) sheet.close();
  }
  const [stLabel, stTone] = [(s) => (STATUS[s] || [s])[0], (s) => (STATUS[s] || [s, ''])[1]];
</script>

{#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
{#if !d && !e.error}<Skeleton kind="list" rows={4} />
{:else if d}
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <p class="m-0 text-sm text-muted" aria-live="polite">{groups.length} group{groups.length === 1 ? '' : 's'} · {unassigned.length} devotee{unassigned.length === 1 ? '' : 's'} in no group</p>
    <span class="flex flex-wrap items-center gap-2">
      <button type="button" class="btn btn-outline btn-sm" aria-haspopup="dialog" onclick={() => { err = ''; appointDlg.showModal(); }}><Icon name="plus" size={16} />Appoint a group leader</button>
      <Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />
    </span>
  </div>
  {#if err && !sheet?.isOpen() && !appointDlg?.isOpen()}<Banner>{err}</Banner>{/if}

  {#if !groups.length}
    <EmptyState icon="users" title="No group leaders yet">Appoint a devotee, then add devotees to their group.</EmptyState>
  {/if}
  <div class="gl-grid">
  {#each groups as g (g.leader.login)}
    {@const sub = g.members.filter((m) => m.status === 'SUBMITTED').length}
    <section class="section" aria-labelledby={'gl-' + g.leader.login}>
      <div class="flex items-center gap-1">
        <div class="min-w-0 flex-1"><h3 id={'gl-' + g.leader.login} class="sec-h m-0"><Icon name="users" /><span class="gl-lname">{g.leader.name}</span><span class="gl-n">{g.members.length}</span></h3>
          {#if g.members.length}<p class="m-0 mt-1 text-sm text-muted">{sub} of {g.members.length} submitted this week</p>{/if}</div>
        <IconButton icon="phone" size={18} label={'Call ' + g.leader.name} href={telLink(g.leader.phone)} />
        {#if waLink(g.leader.whatsapp)}<IconButton icon="msg" size={18} label={'WhatsApp ' + g.leader.name + ' (opens WhatsApp)'} href={waLink(g.leader.whatsapp)} target="_blank" rel="noopener noreferrer" />{/if}
      </div>
      {#if g.members.length}
        <ul class="gl-list" aria-label={g.leader.name + "'s group"}>
          {#each g.members as m (m.login)}
            <li>
              <a class="gl-nm" href={'#/devotee/' + encodeURIComponent(m.login)}>{m.name}{#if many}<span class="gl-b">{bname(m.batchId)}</span>{/if}</a>
              <Status class="gl-st" tone={stTone(m.status)} label={stLabel(m.status)} />
              <IconButton icon="close" class="gl-x" label={'Take ' + m.name + ' out of the group'} disabled={!!busy} onclick={() => takeOut(g, m)} />
            </li>
          {/each}
        </ul>
      {:else}<p class="m-0 mt-2 text-sm text-muted">No one in this group yet.</p>{/if}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        {#if unassigned.length}<button type="button" class="btn btn-outline btn-sm" disabled={!!busy} onclick={() => openAdd(g)}><Icon name="plus" size={16} />Add devotees</button>
        {:else}<span class="text-xs text-muted">Everyone is already in a group.</span>{/if}
        {#if removing !== g.leader.login}
          <button type="button" class="btn btn-text btn-sm ml-auto text-danger" disabled={!!busy} onclick={() => (removing = g.leader.login)}>Remove leader</button>
        {/if}
      </div>
      {#if removing === g.leader.login}
        <div class="confirm danger mt-3" role="group" aria-label={'Remove ' + g.leader.name + ' as group leader'}>
          <p class="q">Remove {g.leader.name} as group leader? The {g.members.length} devotee{g.members.length === 1 ? '' : 's'} of the group will be in no group.</p>
          <div class="grid grid-cols-2 gap-2"><button type="button" class="btn btn-outline" onclick={() => (removing = '')}>Cancel</button><Button variant="danger-solid" busy={busy === 'rm:' + g.leader.login} onclick={() => removeLeader(g)}>Remove</Button></div>
        </div>
      {/if}
    </section>
  {/each}
  </div>

  {#if unassigned.length}
    <details class="section disclose" aria-label="In no group">
      <summary class="sec-h m-0"><Icon name="user" />In no group ({unassigned.length})</summary>
      <p class="m-0 mt-2 text-sm">{unassigned.map((m) => m.name + (many ? ` (${bname(m.batchId)})` : '')).join(', ')}</p>
    </details>
  {/if}
{/if}

<Sheet bind:this={appointDlg} titleId="gl-ap-t" title="Appoint a group leader" sub={`An active devotee of ${pool}`}>
  {#if candidates.length}
    <WheelSelect id="gl-pick" label="Devotee" bind:value={pick} options={candidates.map((c) => [c.login, c.name + (many ? ' · ' + bname(c.batchId) : '')])} placeholder="Choose a devotee" />
    {#if err}<p class="err" role="alert">{err}</p>{/if}
    <div class="mt-2 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => appointDlg.close()}>Cancel</button>
      <Button variant="primary" busy={busy === 'appoint'} disabled={!pick || !!busy} onclick={() => appoint().then(() => { if (!err) appointDlg.close(); })}>Appoint</Button>
    </div>
  {:else}<p class="m-0 text-sm text-muted">{groups.length ? `Every active devotee of ${pool} is already a group leader.` : `No active devotees in ${pool} yet. Approve sign-ups in Requests first.`}</p>{/if}
</Sheet>

<Sheet bind:this={sheet} titleId="gl-add-t" title={forG ? `Add to ${forG.leader.name}'s group` : ''} sub={`Devotees of ${pool} in no group`} onclose={() => (forG = null)}>
  {#if forG}
    <div class="gl-pick">
      {#each unassigned as m (m.login)}<Checkbox label={m.name + (many ? ' · ' + bname(m.batchId) : '')} bind:checked={chosen[m.login]} />{/each}
    </div>
    {#if err}<p class="err" role="alert">{err}</p>{/if}
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
      <Button variant="primary" busy={busy === 'add'} disabled={!chosenLogins.length} onclick={addChosen}>Add {chosenLogins.length || ''}</Button>
    </div>
  {/if}
</Sheet>

<style>
  .gl-list { list-style: none; margin: var(--sp-3) 0 0; padding: 0; border-top: 1px solid var(--border); }
  /* G5, the list row (Phase 24, V11): the name gets the width and wraps, never "Aarav Gupt…"; in a narrow card the status
     goes under the name, and the remove button keeps its own column */
  .gl-list { container-type: inline-size; }
  .gl-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; grid-template-areas: 'n s x'; align-items: center; column-gap: 10px; min-height: 48px; padding: 4px 0; border-bottom: 1px solid var(--border); }
  .gl-nm { grid-area: n; min-width: 0; overflow-wrap: anywhere; }
  .gl-list :global(.gl-st) { grid-area: s; }
  .gl-list :global(.gl-x) { grid-area: x; }
  @container (max-width: 22rem) { .gl-list li { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'n x' 's x'; row-gap: 2px; } }
  .gl-lname { min-width: 0; overflow-wrap: anywhere; }
  .gl-list a { color: var(--text); font-weight: 550; text-decoration: none; }
  .gl-list a:hover { text-decoration: underline; text-underline-offset: 2px; }
  .gl-n { margin-left: 6px; min-width: 22px; padding: 0 7px; border-radius: 999px; background: var(--surface-2); font-size: var(--fs-caption); font-weight: 650; text-align: center; color: var(--text-muted); }
  .gl-b { margin-left: 8px; font-size: var(--fs-caption); font-weight: 500; color: var(--text-muted); }
  .gl-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 var(--sp-4); }
  @media (min-width: 900px) { .gl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } }
  .gl-pick { display: grid; gap: 8px; max-height: 50vh; overflow: auto; }
</style>
