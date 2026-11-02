<script>
  /*
   * Access (ADR 0015, the head, 22 Oct 2026): "the auth manager should have the full scope auths, using which I can give
   * and take permissions from any devotee or any staff".
   *
   * Find anyone; see their roles (changed where they always were: Batch setup, Staff, Facilitators); and per capability
   * keep what their role gives, take it away, or — where the server can still keep it to their own batches — give it.
   * The server enforces every change in its one gate (worker/src/grants.js); this screen only shows and sets them.
   */
  import { tick } from 'svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { fmtDate } from '../lib/dates.js';
  import { toast } from '../lib/pro.svelte.js';
  import Search from '../ui/Search.svelte';
  import PageHeader from '../ui/PageHeader.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Seg from '../ui/Seg.svelte';
  import Button from '../ui/Button.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import Checkbox from '../ui/Checkbox.svelte';
  import RadioGroup from '../ui/RadioGroup.svelte';
  import Radio from '../ui/Radio.svelte';

  let { tools } = $props();
  let q = $state(''), found = $state(null), changed = $state(null), caps = $state([]), err = $state('');
  let person = $state(null), pErr = $state('');
  const loadChanged = () => call('access.list').then((r) => { changed = r.people; caps = r.capabilities; }).catch((e) => (err = errorMessage(e)));
  loadChanged();
  $effect(() => {
    const term = q.trim();
    if (term.length < 2) { found = null; return; }
    const t = setTimeout(() => call('access.search', { q: term }).then((r) => (found = r.people)).catch((e) => (err = errorMessage(e))), 300);
    return () => clearTimeout(t);
  });
  async function open(login) {
    pErr = '';
    try { person = await call('access.get', { login }); } catch (e) { pErr = errorMessage(e); }
  }
  const effectOf = (id) => person?.grants.find((g) => g.id === id) || null;
  const roleWords = (p) => [p.master ? 'IYF head' : '', p.role === 'COORDINATOR' || p.coordinates?.length ? 'Coordinator' : '', p.facilitator ? 'Facilitator' : '', p.role === 'DEVOTEE' ? 'Devotee' : ''].filter(Boolean).join(' · ');

  // one capability at a time, in a sheet: keep / take away / give, an optional end date, and why
  let sheet = $state(), cap = $state(null), eff = $state(''), until = $state(''), why = $state(''), busy = $state(false), fe = $state({});
  function edit(c) { cap = c; const g = effectOf(c.id); eff = g?.effect || ''; until = g?.until || ''; why = ''; fe = {}; sheet.showModal(); }
  async function save() {
    busy = true; fe = {};
    try {
      person = await call('access.set', { login: person.login, capability: cap.id, effect: eff, ...(eff && until ? { until } : {}), ...(why.trim() ? { reason: why.trim() } : {}) });
      sheet.close(); loadChanged();
      toast(eff === 'deny' ? `${cap.label}: taken away from ${person.name}.` : eff === 'allow' ? `${cap.label}: given to ${person.name}.` : `${cap.label}: back to what ${person.name}'s role gives.`);
    } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) toast(errorMessage(e), { kind: 'err' }); }
    busy = false;
  }
  const label = (g) => (g.effect === 'deny' ? 'Taken away' : 'Given') + (g.until ? ` until ${fmtDate(g.until)}` : '') + (g.ended ? ' (ended)' : '');

  // roles (ADR 0019): give one with the rights the head ticks and an optional end date; revoke takes it and all it brought
  let rsheet = $state(), rf = $state(null), rbusy = $state(false), rfe = $state({});
  const defOf = (id) => person?.roleDefs.find((r) => r.id === id);
  const ROLE_SCOPE = { coordinator: 'Class batches', training: 'Training batches, on their own dates', leader: 'A group in their own batch', ftp: 'All facilitators, phase by phase' };
  const heldRole = (id) => person?.roles.find((r) => r.role === id);
  const capLabel = (id) => person?.labels?.[id] || person?.capabilities.find((c) => c.id === id)?.label || id;
  const flip = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  // a right both batch roles use is one switch for the person: say so while they hold the other role
  const sharedWith = (id) => {
    const other = rf?.role === 'coordinator' ? 'training' : rf?.role === 'training' ? 'coordinator' : '';
    return other && heldRole(other) && [...defOf(other).caps, ...defOf(other).extra].includes(id) ? `Also for their ${defOf(other).label.toLowerCase()} role` : '';
  };
  function giveRole(id) {
    const def = defOf(id), held = heldRole(id), eff = (c) => effectOf(c)?.effect;
    rf = { role: id, batchIds: held ? held.batches.map((b) => b.batchId) : [], until: held?.until || '', why: '',
           rights: [...def.caps.filter((c) => eff(c) !== 'deny'), ...def.extra.filter((c) => eff(c) === 'allow')] };
    rfe = {}; rerr = '';
    rsheet.showModal();
  }
  let rerr = $state('');
  async function saveRole() {
    rbusy = true; rfe = {}; rerr = '';
    const r = rf, given = !heldRole(r.role);
    try {
      person = await call('access.assign', { login: person.login, role: r.role, ...(r.role === 'leader' ? {} : defOf(r.role).global ? { rights: r.rights } : { batchIds: r.batchIds, rights: r.rights }),
        ...(r.until ? { until: r.until } : {}), ...(r.why.trim() ? { reason: r.why.trim() } : {}) });
      rsheet.close(); loadChanged();
      toast(given ? `${defOf(r.role).label}: given to ${person.name}.` : `${defOf(r.role).label}: changed for ${person.name}.`);
    } catch (e) {
      // a refusal is always seen (27 Oct 2026: "clicking on save, it was not getting saved"): the reason beside Save, and
      // the field it is about scrolled into view — an error at the top of a long sheet looked like nothing happened
      rfe = fieldErrors(e);
      rerr = Object.values(rfe)[0] || errorMessage(e);
      await tick(); document.querySelector('dialog[open] [role=alert]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    rbusy = false;
  }
  // a batch role needs a batch before it can be saved
  const roleReady = $derived(!!rf && (rf.role === 'leader' || defOf(rf.role)?.global || rf.batchIds.length > 0));
  let vsheet = $state(), vrole = $state(null), vwhy = $state(''), vbusy = $state(false);
  function askRevoke(r) { vrole = r; vwhy = ''; vsheet.showModal(); }
  async function revoke() {
    vbusy = true;
    const r = vrole;
    try {
      person = await call('access.revoke', { login: person.login, role: r.role, ...(vwhy.trim() ? { reason: vwhy.trim() } : {}) });
      vsheet.close(); loadChanged();
      toast(`${r.label}: taken from ${person.name}.`);
    } catch (e) { toast(errorMessage(e), { kind: 'err' }); }
    vbusy = false;
  }
</script>

<!-- no explanatory paragraph (the project rule; Phase 24, V30): the bar says Access, the screen shows what it does -->
<PageHeader title="Access" sr actions={tools} />
<Search id="acc-q" label="Find a person" placeholder="Name, phone or username" bind:value={q} class="sm:max-w-md" />
{#if err}<Banner>{err}</Banner>{/if}

{#if person}
  <section class="card acc-person" aria-labelledby="acc-p">
    <div class="acc-ph">
      <div class="min-w-0"><h3 id="acc-p" class="m-0">{person.name}</h3><p class="m-0 text-sm text-muted">{person.login} · {roleWords(person) || person.role}</p></div>
      <button type="button" class="btn btn-text btn-sm" onclick={() => (person = null)}>Close</button>
    </div>
    {#if person.master}<Banner kind="info">An IYF head's powers are managed by the heads, under Staff.</Banner>
    {:else}
      <h4 class="acc-sh">Roles</h4>
      {#if person.roles.length}
        <ul class="list acc-roles mb-2" aria-label="Roles">
          {#each person.roles as r (r.role)}
            <li><div class="lrow acc-role">
              <span class="lmain"><span class="lt">{r.label}</span><span class="ls">{r.batches.map((b) => b.name).join(', ')}{r.until ? ` · until ${fmtDate(r.until)}` : ''}{r.ended ? ' (ended)' : ''}</span></span>
              {#if r.role !== 'leader'}<button type="button" class="btn btn-text btn-sm" onclick={() => giveRole(r.role)} aria-haspopup="dialog">Change</button>{/if}
              <button type="button" class="btn btn-text btn-sm" onclick={() => askRevoke(r)} aria-haspopup="dialog">Revoke</button>
            </div></li>
          {/each}
        </ul>
      {:else}<p class="m-0 mb-2 text-sm text-muted">No roles yet.</p>{/if}
      {#if person.roleDefs.some((r) => !heldRole(r.id))}<button type="button" class="btn btn-outline btn-sm mb-3" onclick={() => giveRole((person.roleDefs.find((r) => !heldRole(r.id)) || person.roleDefs[0]).id)} aria-haspopup="dialog"><Icon name="plus" size={16} />Give a role</button>{/if}
      <h4 class="acc-sh">Rights</h4>
      <ul class="list acc-caps" aria-label="Capabilities">
        {#each person.capabilities as c (c.id)}
          {@const g = effectOf(c.id)}
          <li><button type="button" class="lrow acc-cap" onclick={() => edit(c)} aria-haspopup="dialog">
            <span class="lmain"><span class="lt">{c.label}</span><span class="ls">{g ? label(g) : 'As their role'}</span></span>
            {#if g}<span class="pill" data-tone={g.effect === 'deny' ? 'bad' : 'ok'}>{g.effect === 'deny' ? 'Off' : 'On'}</span>{/if}
            <Icon name="next" size={18} /></button></li>
        {/each}
      </ul>
    {/if}
  </section>
{:else if pErr}<Banner>{pErr}</Banner>
{:else if found}
  {#if !found.length}<EmptyState icon="search" title="No one found">No person with that name, phone or username.</EmptyState>
  {:else}
    <ul class="list" aria-label="People">
      {#each found as p (p.login)}
        <li><button type="button" class="lrow acc-cap" onclick={() => open(p.login)}><span class="lmain"><span class="lt">{p.name}</span><span class="ls">{p.login} · {roleWords(p) || p.role}{p.grants.length ? ` · ${p.grants.length} changed` : ''}</span></span><Icon name="next" size={18} /></button></li>
      {/each}
    </ul>
  {/if}
{:else if changed === null}<Skeleton kind="list" rows={3} />
{:else if changed.length}
  <h3 class="acc-h">Changed for</h3>
  <ul class="list" aria-label="Changed for">
    {#each changed as p (p.login)}
      <li><button type="button" class="lrow acc-cap" onclick={() => open(p.login)}><span class="lmain"><span class="lt">{p.name}</span>
        <span class="ls">{p.grants.map((g) => `${caps.find((c) => c.id === g.id)?.label || g.id}: ${g.effect === 'deny' ? 'off' : 'on'}`).join(' · ')}</span></span><Icon name="next" size={18} /></button></li>
    {/each}
  </ul>
{:else}<EmptyState icon="shield" title="Everyone has what their role gives">Find a person to give or take something.</EmptyState>{/if}

<Sheet bind:this={sheet} titleId="acc-s" title={cap?.label || ''} sub={person?.name || ''} onclose={() => (cap = null)}>
  {#if cap}
    <Seg id="acc-eff" label="For this person" options={[['', 'As their role'], ['deny', 'Take away'], ...(cap.give ? [['allow', 'Give']] : [])]} value={eff} onchange={(v) => (eff = v)} error={fe.effect} />
    {#if cap.give && eff === 'allow'}<p class="m-0 mb-2 text-sm text-muted">Only for their own batches.</p>{/if}
    {#if eff}<DateInput id="acc-until" label="Until (optional)" bind:value={until} error={fe.until} />{/if}
    <TextInput id="acc-why" label="Reason" optional bind:value={why} hint="Kept in Activity." />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
      <Button variant="primary" {busy} onclick={save}>Save</Button>
    </div>
  {/if}
</Sheet>

<Sheet bind:this={rsheet} titleId="acc-r" title={rf && heldRole(rf.role) ? 'Change role' : 'Give a role'} sub={person?.name || ''} dismiss={false} onclose={() => (rf = null)}>
  {#if rf && person}
    {@const def = defOf(rf.role)}
    <!-- four roles with long names: rows, not a segmented switch (it clipped "Coordinator" at 390 px) -->
    <RadioGroup legend="Role" id="acc-role" error={rfe.role}>
      {#each person.roleDefs as r (r.id)}
        <Radio name="acc-role" value={r.id} checked={rf.role === r.id} onchange={() => giveRole(r.id)} label={r.label}
          desc={[ROLE_SCOPE[r.id], heldRole(r.id) ? 'held now' : ''].filter(Boolean).join(' · ')} />
      {/each}
    </RadioGroup>
    {#if rf.role === 'leader'}
      <p class="m-0 mb-3 text-sm text-muted">Leads a group in their own batch.</p>
    {:else}
      {#if !def.global}<RadioGroup legend="Batches" error={rfe.batchIds}>
        {#each person.batches.filter((b) => b.training === (rf.role === 'training')) as b (b.batchId)}
          <Checkbox checked={rf.batchIds.includes(b.batchId)} onchange={() => (rf.batchIds = flip(rf.batchIds, b.batchId))} label={b.name} />
        {:else}<p class="m-0 text-sm text-muted">No {rf.role === 'training' ? 'training' : 'class'} batch is running.</p>{/each}
      </RadioGroup>{/if}
      <RadioGroup legend="Rights" error={rfe.rights}>
        {#each [...def.caps, ...def.extra] as id (id)}
          <Checkbox card={false} checked={rf.rights.includes(id)} onchange={() => (rf.rights = flip(rf.rights, id))} label={capLabel(id)}
            desc={def.extra.includes(id) ? 'Beyond the role · their own batches only' : sharedWith(id)} />
        {/each}
      </RadioGroup>
    {/if}
    <DateInput id="acc-runtil" label="Until (optional)" bind:value={rf.until} error={rfe.until} />
    <TextInput id="acc-rwhy" label="Reason" optional bind:value={rf.why} hint="Kept in Activity." />
    {#if rerr}<Banner>{rerr}</Banner>{/if}
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => rsheet.close()}>Cancel</button>
      <Button variant="primary" busy={rbusy} disabled={!roleReady} onclick={saveRole}>{heldRole(rf.role) ? 'Save' : 'Give'}</Button>
    </div>
  {/if}
</Sheet>

<Sheet bind:this={vsheet} titleId="acc-v" title={vrole ? `Revoke ${vrole.label.toLowerCase()}` : ''} sub={person?.name || ''} onclose={() => (vrole = null)}>
  {#if vrole}
    <p class="m-0 mb-3 text-sm">{vrole.batches.length ? `${vrole.batches.map((b) => b.name).join(', ')} ${vrole.batches.length === 1 ? 'leaves' : 'leave'} their login at once, with the rights that came with this role.` : 'Its screens leave their login at once, with the rights that came with it.'}</p>
    <TextInput id="acc-vwhy" label="Reason" optional bind:value={vwhy} hint="Kept in Activity." />
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" onclick={() => vsheet.close()}>Cancel</button>
      <Button variant="danger" busy={vbusy} onclick={revoke}>Revoke</Button>
    </div>
  {/if}
</Sheet>

<style>
  .acc-person { margin-top: var(--sp-3); }
  .acc-ph { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-3); }
  .acc-caps, .acc-roles { margin: 0; padding: 0; list-style: none; }
  .acc-cap { width: 100%; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; }
  .acc-h { margin: var(--sp-4) 0 var(--sp-2); font-size: var(--fs-h3); }
  .acc-sh { margin: var(--sp-2) 0 var(--sp-2); font-size: var(--fs-sm); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .acc-role { gap: var(--sp-1); }
</style>
