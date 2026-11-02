<script>
  import Seg from '../ui/Seg.svelte';
  import { wide } from '../lib/wide.svelte.js';
  import { untrack } from 'svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import { pressedInView } from '../lib/chips.js';
  // IYF IDs (master): search the registry, see an ID's details, link it to an account or unlink it (with a reason);
  // and "Possible duplicates" (same phone or same name): the master reviews each group once ("Not duplicates" hides it
  // until another ID joins it). (The dashboard is no longer read, 27 Oct 2026: the registry is a frozen snapshot.)
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { weekLabel } from '../lib/dates.js';
  import TextInput from '../ui/TextInput.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Icon from '../ui/Icon.svelte';
  import { fmtDateTime } from '../lib/validate.js';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Button from '../ui/Button.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';

  let view = $state('search');
  let kind = $state('all'), reviewing = $state('');
  async function notDup(g) {
    reviewing = g.key;
    try {
      await call('ids.reviewDuplicate', { ids: g.ids.map((r) => r.iyfId), decision: 'NOT_DUPLICATE', why: g.why });
      patch('ids.possibleDuplicates', (x) => ({ ...x, groups: x.groups.filter((y) => y.key !== g.key), total: x.total - 1, reviewedCount: (x.reviewedCount || 0) + 1,
        byKind: { ...x.byKind, [g.why === 'same phone' ? 'samePhone' : 'sameName']: Math.max(0, (x.byKind?.[g.why === 'same phone' ? 'samePhone' : 'sameName'] || 1) - 1) } }));
      toast('Marked as not duplicates.', { action: { label: 'Undo', run: async () => { await call('ids.reviewDuplicate', { ids: g.ids.map((r) => r.iyfId), decision: 'UNDO' }); load('ids.possibleDuplicates', undefined, { force: true }); } } });
    } catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    reviewing = '';
  }
  // Person records (migration 0038, imported 11 Oct 2026): the lasting person behind every login — every name
  // they have ever been known by, every phone, every id they have held. Searching an OLD name must find them,
  // or a facilitator makes a second record by mistake.
  let pq = $state(''), people = $state([]), pbusy = $state(false), perr = $state('');
  let open = $state(null);                 // the person whose details are open
  let mintYear = $state(''), acting = $state(''), aerr = $state('');
  const thisYear = new Date().getFullYear();
  // Search as they type. The effect reads only `pq` and `view` — never `people`, or writing the results
  // would re-trigger it.
  $effect(() => {
    const term = pq.trim(), on = view === 'people';
    if (!on || term.length < 2) { untrack(() => { people = []; perr = ''; }); return; }
    const t = setTimeout(async () => {
      pbusy = true; perr = '';
      try { const r = await call('identity.search', { q: term }); people = r.people || []; }
      catch (err) { perr = errorMessage(err); people = []; }
      pbusy = false;
    }, 300);
    return () => clearTimeout(t);
  });
  /*
   * Merge (ADR 0017; the merge rules): two records of one person, side by side, and the head says which is kept and
   * why. Nothing merges by itself. The kept record's IYF ID stays; the other's IDs are superseded by it and still find
   * them; phones, names and app accounts move across.
   */
  let mergeFor = $state(''), mq = $state(''), mHits = $state([]), other = $state(null), keepId = $state(''), mWhy = $state(''), mFe = $state({});
  function startMerge(p) { mergeFor = p.id; mq = ''; mHits = []; other = null; keepId = p.id; mWhy = ''; mFe = {}; linkFor = ''; }
  $effect(() => {
    const term = mq.trim(), forId = mergeFor;
    if (!forId || term.length < 2) { untrack(() => (mHits = [])); return; }
    const t = setTimeout(async () => {
      try { mHits = ((await call('identity.search', { q: term })).people || []).filter((x) => x.id !== forId && !x.mergedInto); } catch { mHits = []; }
    }, 300);
    return () => clearTimeout(t);
  });
  async function pickOther(x, p) {
    try { other = await call('identity.get', { personId: x.id }); } catch (e) { aerr = errorMessage(e); return; }
    // keep the record that already carries an IYFD by default; the head can choose the other
    keepId = /^IYFD-/.test(other.iyfId) && !/^IYFD-/.test(p.iyfId) ? other.id : p.id;
  }
  async function doMerge(p) {
    acting = 'identity.merge'; aerr = ''; mFe = {};
    try {
      const r = await call('identity.merge', { keep: keepId, lose: keepId === p.id ? other.id : p.id, reason: mWhy.trim() });
      open = r.keep; mergeFor = ''; other = null;
      if (pq.trim()) people = (await call('identity.search', { q: pq.trim() })).people || [];
      toast(`Merged into ${r.keep.name}. ${r.moved.identifiers === 1 ? 'The old ID still finds them.' : `${r.moved.identifiers} old IDs still find them.`}`);
    } catch (e) { mFe = fieldErrors(e); if (!Object.keys(mFe).length) aerr = errorMessage(e); }
    acting = '';
  }
  // an app account belongs to this person (identity.link): the account then carries their IYF ID
  let linkFor = $state(''), linkLogin = $state(''), linkWhy = $state('');
  async function personAct(what, body, ok) {
    acting = what; aerr = '';
    try {
      const r = await call(what, body);
      open = r.person || open;
      if (pq.trim()) people = (await call('identity.search', { q: pq.trim() })).people || [];
      toast(ok);
      mintYear = '';
    } catch (err) { aerr = errorMessage(err); }
    acting = '';
  }

  let q = $state('');
  let results = $state([]);
  let busy = $state(false);
  let error = $state('');

  $effect(() => {
    const term = q.trim();
    error = '';
    if (term.length < 3) { results = []; return; }
    const t = setTimeout(async () => {
      busy = true;
      try { results = (await call('ids.search', { q: term })).results || []; }
      catch (e) { error = errorMessage(e); results = []; }
      busy = false;
    }, 400);
    return () => clearTimeout(t);
  });

  // details / link / unlink, one card at a time
  let openId = $state('');
  let mode = $state('');          // 'details' | 'link' | 'unlink'
  let detail = $state(null);
  let login = $state(''), reason = $state('');
  let aBusy = $state(false), aErr = $state(''), fe = $state({}), note = $state('');
  async function start(r, m) {
    openId = r.iyfId; mode = m; aErr = ''; fe = {}; reason = ''; login = ''; detail = null;
    if (m === 'details') {
      aBusy = true;
      try { detail = await call('ids.get', { iyfId: r.iyfId }); } catch (e) { aErr = errorMessage(e); }
      aBusy = false;
    }
  }
  async function act(r) {
    aBusy = true; aErr = ''; fe = {};
    try {
      if (mode === 'link') {
        await call('ids.link', { login: login.trim(), iyfId: r.iyfId, reason: reason.trim() });
        results = results.map((x) => (x.iyfId === r.iyfId ? { ...x, linked: true, linkedAccount: { login: login.trim(), name: '' } } : x));
        toast(`${r.iyfId} is now linked to ${login.trim()}.`);
      } else {
        await call('ids.unlink', { login: r.linkedAccount.login, reason: reason.trim() });
        results = results.map((x) => (x.iyfId === r.iyfId ? { ...x, linked: false, linkedAccount: null } : x));
        toast(`${r.iyfId} is no longer linked.`);
      }
      openId = ''; mode = '';
    } catch (e) { aErr = errorMessage(e); fe = fieldErrors(e); }
    aBusy = false;
  }

  const dup = entry('ids.possibleDuplicates');
  $effect(() => { if (view === 'dups') load('ids.possibleDuplicates'); });

  // IDs created in the app (Phase 9, item 14): IYFD-<year>-NNNN from the identity authority — the app is the only issuer
  const app = entry('ids.appList');
  const loadApp = (force = false) => load('ids.appList', () => call('ids.appList'), { force });
  $effect(() => { if (view === 'app') loadApp(); });
  // An IYF ID carries the year they came to IYF, so creating one needs it (18 Oct 2026): the year on their profile
  // if they gave one, else the year the head picks here. The preview shows the authority's next number for THAT
  // year — never a number taken from any other year.
  let newPhone = $state(''), newWhy = $state(''), newYear = $state(''), newBusy = $state(false), newErr = $state({}), next = $state('');
  const YEARS = Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => String(new Date().getFullYear() - i));
  $effect(() => {
    const y = newYear, ph = newPhone.replace(/\D/g, '').slice(-10);
    if (view !== 'app' || (!y && !/^[6-9]\d{9}$/.test(ph))) { next = ''; return; }
    call('ids.nextApp', { ...(y ? { year: y } : {}), ...(/^[6-9]\d{9}$/.test(ph) ? { login: ph } : {}) })
      .then((r) => (next = r.next || '')).catch(() => (next = ''));
  });
  async function createId() {
    newErr = {};
    const ph = newPhone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(ph)) { newErr = { login: 'Enter the 10-digit phone of an approved devotee.' }; return; }
    newBusy = true;
    try { const r = await call('ids.create', { login: ph, reason: newWhy.trim(), ...(newYear ? { year: newYear } : {}) }); toast(`Created ${r.iyfId}.`); newPhone = ''; newWhy = ''; newYear = ''; next = ''; await loadApp(true); }
    catch (e) { newErr = fieldErrors(e); if (!Object.keys(newErr).length) newErr = { login: errorMessage(e) }; }
    newBusy = false;
  }
  let useBusy = $state('');
  async function useDashboard(x) {
    useBusy = x.iyfId;
    try { await call('ids.link', { login: x.login, iyfId: x.dashboardMatch.iyfId, reason: 'The dashboard registered them' }); toast(`${x.name} now has ${x.dashboardMatch.iyfId}; ${x.iyfId} is retired.`); await loadApp(true); }
    catch (e) { toast(errorMessage(e), { kind: 'err' }); }
    useBusy = '';
  }
  async function downloadApp() {
    const { toCsv, fileName, saveCsv } = await import('../lib/csv.js');
    const rows = (app.data?.ids || []).filter((x) => x.state === 'ACTIVE').map((x) => [x.iyfId, x.name, x.login, x.batchName, x.createdAt.slice(0, 10), x.createdBy]);
    await saveCsv(fileName('IYF', 'IDs-created-in-the-app', new Date().toISOString().slice(0, 10)), toCsv(['IYF ID', 'Name', 'Phone', 'Batch', 'Created', 'Created by'], rows));
  }
</script>

<h2 class="sr-only">IYF IDs</h2>   <!-- the top bar already says it (27 Oct 2026, search audit): a second title row was all this held -->
<div class="seg ids-tools mb-4 sm:max-w-md" role="group" aria-label="IYF ID tools">
  <button type="button" aria-pressed={view === 'search'} onclick={() => (view = 'search')}>Search</button>
  <button type="button" aria-pressed={view === 'dups'} onclick={() => (view = 'dups')}>Duplicates</button>
  <button type="button" aria-pressed={view === 'app'} onclick={() => (view = 'app')}>Created here</button>
  <button type="button" aria-pressed={view === 'people'} onclick={() => (view = 'people')}>Person records</button>
</div>

{#if view === 'search'}
  <TextInput id="ids-q" label="Search name, IYF ID or phone" bind:value={q} hint="Type at least 3 characters" autocomplete="off" loading={busy} class="sm:max-w-md" />
  {#if error}<Banner>{error}</Banner>{/if}
  {#if busy}<p class="sr-only" role="status">Searching…</p>{/if}
  <ul class="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
    {#each results as r (r.iyfId)}
      <li class="card">
        <p class="m-0 flex flex-wrap items-center gap-2"><strong>{r.iyfId}</strong><span>· {r.name}</span>{#if r.mergedInto}<span class="pill" data-tone="warn">Merged into {r.mergedInto}</span>{/if}</p>
        <p class="m-0 text-sm text-muted">{r.level} · {r.facilitator || 'no facilitator'} · phone {r.phoneEnd}</p>
        <p class="m-0 mt-1 flex items-center gap-2 text-sm"><i class="inline-block h-2 w-2 shrink-0 rounded-full {r.linkedAccount || r.linked ? 'bg-[var(--ok)]' : 'bg-[var(--border-strong)]'}" aria-hidden="true"></i>{r.linkedAccount ? 'Linked to ' + (r.linkedAccount.name || r.linkedAccount.login) + (r.linkedAccount.name ? ' (' + r.linkedAccount.login + ')' : '') : r.linked ? 'Linked to an account' : 'Not linked to an account'}</p>
        {#if openId === r.iyfId && mode === 'details'}
          {#if aBusy}<p class="m-0 mt-2 flex items-center gap-2 text-sm text-muted" role="status"><span class="spin" aria-hidden="true"></span>Loading…</p>{/if}
          {#if detail}
            <dl class="kv well mt-3 text-sm">
              <!-- The person record first, when this id belongs to one (the head, 16 Oct 2026). The card's
                   heading is the id that was SEARCHED — often an old batch number — so the current id has
                   to be said here or the screen quietly disagrees with the Devotees screen. -->
              {#if detail.person}
                {#if detail.person.iyfId && detail.person.iyfId !== r.iyfId}
                  <dt>IYF ID</dt>
                  <dd><strong>{detail.person.iyfId}</strong> <span class="text-muted">· {r.iyfId} also belongs to them</span></dd>
                {/if}
                {#if detail.person.names?.length > 1}
                  <dt>Known as</dt>
                  <dd>{detail.person.names.map((n) => n.name).join(' · ')}</dd>
                {/if}
                {#if detail.person.identifiers?.length > 1}
                  <dt>All IDs</dt>
                  <dd>{detail.person.identifiers.map((i) => i.fid + (i.state && i.state !== 'current' ? ' (' + i.state + ')' : '')).join(' · ')}</dd>
                {/if}
                {#if detail.person.connectedSince}
                  <dt>Connected since</dt><dd>{detail.person.connectedSince}</dd>
                {/if}
                {#if detail.person.matchedBy === 'phone'}
                  <dt>Note</dt>
                  <dd class="text-muted">Matched to this person by phone number, not by ID — check it is the same person before relying on it.</dd>
                {/if}
              {/if}
              <dt>Phones</dt><dd>{detail.phones.join(', ') || '—'}</dd>
              {#each detail.batchHistory as h}<dt>{h.batchId}</dt><dd>{h.state.toLowerCase()} from week of {weekLabel(h.fromWeek)}{h.toWeek ? ' to ' + weekLabel(h.toWeek) : ''}</dd>{/each}
            </dl>
          {/if}
          <ValidationMessage error={aErr} />
          <button type="button" class="btn btn-text btn-sm mt-1" onclick={() => (openId = '')}>Close</button>
        {:else if openId === r.iyfId}
          <div class="confirm {mode === 'unlink' ? 'danger' : ''}">
            {#if mode === 'link'}<TextInput id="ids-login" label="Phone of the devotee's account" type="tel" inputmode="numeric" bind:value={login} error={fe.login} autocomplete="off" />{/if}
            <TextInput id="ids-reason" label="Reason" bind:value={reason} error={fe.reason} maxlength="200" autocomplete="off" />
            <ValidationMessage error={aErr} />
            <div class="grid grid-cols-2 gap-2">
              <button type="button" class="btn btn-outline" onclick={() => (openId = '')}>Cancel</button>
              <Button variant={mode === 'unlink' ? 'danger-solid' : 'primary'} busy={aBusy} onclick={() => act(r)}>{mode === 'link' ? 'Link' : 'Unlink'}</Button>
            </div>
          </div>
        {:else}
          <div class="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <button type="button" class="btn btn-sm" onclick={() => start(r, 'details')}>Details</button>
            {#if r.linkedAccount}<button type="button" class="btn btn-sm btn-danger" onclick={() => start(r, 'unlink')}>Unlink…</button>
            {:else if !r.mergedInto && !r.linked}<button type="button" class="btn btn-sm btn-outline" onclick={() => start(r, 'link')}>Link to an account…</button>{/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if q.trim().length >= 3 && !busy && !results.length && !error}<EmptyState icon="search" title="No results">Try part of the name, the full IYF ID, or the last digits of the phone.</EmptyState>{/if}
{:else if view === 'dups'}
  <Banner kind="info">The groups below share a phone (often family members) or a name: check each once and mark it <strong>Not duplicates</strong>.</Banner>
  {#if dup.error && !dup.data}<Banner onretry={() => load('ids.possibleDuplicates', undefined, { force: true })}>{errorMessage(dup.error)}</Banner>{/if}
  {#if !dup.data && !dup.error}<Skeleton rows={2} />
  {:else if dup.data}
    <Refreshing on={dup.refreshing} onrefresh={() => load('ids.possibleDuplicates', undefined, { force: true })} />
    <div class="chiprow counts one-line" role="group" aria-label="Show" {@attach pressedInView}>
      <button type="button" class="chipbtn" aria-pressed={kind === 'all'} onclick={() => (kind = 'all')}><b>{dup.data.total}</b>To review</button>
      <button type="button" class="chipbtn" aria-pressed={kind === 'same phone'} onclick={() => (kind = 'same phone')}><b>{dup.data.byKind?.samePhone ?? 0}</b>Same phone</button>
      <button type="button" class="chipbtn" aria-pressed={kind === 'same name'} onclick={() => (kind = 'same name')}><b>{dup.data.byKind?.sameName ?? 0}</b>Same name</button>
    </div>
    {#if dup.data.reviewedCount}<p class="mb-2 mt-0 text-sm text-muted">{dup.data.reviewedCount} group{dup.data.reviewedCount === 1 ? '' : 's'} already reviewed and hidden.</p>{/if}
    <ul class="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
      {#each dup.data.groups.filter((g) => kind === 'all' || g.why === kind) as g (g.key)}
        <li class="card">
          <p class="m-0 mb-2 flex items-center justify-between gap-2"><span class="pill" data-tone={g.why === 'same phone' ? 'info' : 'warn'}>{g.why === 'same phone' ? 'Same phone, different names' : 'Same name, different phones'}</span>
            <Button variant="secondary" size="sm" busy={reviewing === g.key} onclick={() => notDup(g)}>Not duplicates</Button></p>
          <ul class="m-0 grid list-none gap-2 p-0">
            {#each g.ids as r (r.iyfId)}
              <li class="well text-sm">
                <p class="m-0"><strong>{r.iyfId}</strong> · {r.name}</p>
                <p class="m-0 text-muted">{r.level} · {r.facilitator || 'no facilitator'} · phone {r.phoneEnd}</p>
                <p class="m-0">{r.linkedAccount ? 'Account: ' + (r.linkedAccount.name || r.linkedAccount.login) : 'No account linked'}{r.mergedInto ? ' · merged into ' + r.mergedInto : ''}</p>
              </li>
            {/each}
          </ul>
        </li>
      {:else}<EmptyState tag="li" icon="ok" title="No possible duplicates">Nothing to review right now.</EmptyState>{/each}
    </ul>
  {/if}
{:else if view === 'app'}
  <section class="section">
    <h3><Icon name="plus" />Create an ID</h3>
    <div class="grid gap-x-3 sm:grid-cols-2">
      <TextInput id="ids-new" label="Phone of an approved devotee" type="tel" inputmode="numeric" bind:value={newPhone} error={newErr.login} autocomplete="off" />
      <WheelSelect id="ids-year" label="Connected since" bind:value={newYear} options={YEARS} placeholder="Their year, if not on their profile" error={newErr.year} hint={next ? `They get ${next}.` : ''} />
      <TextInput id="ids-why" label="Why" optional bind:value={newWhy} maxlength="200" autocomplete="off" />
    </div>
    <Button variant="primary" class="w-auto" busy={newBusy} onclick={createId}>Create IYF ID</Button>
  </section>
  {#if app.error && !app.data}<Banner onretry={() => loadApp(true)}>{errorMessage(app.error)}</Banner>{/if}
  {#if !app.data && !app.error}<Skeleton rows={2} />
  {:else if app.data}
    <!-- one id system (22 Oct 2026): who still has no IYFD. Each is asked for their year at their next open and is
         issued one by answering; the list empties as they do. -->
    {#if app.data.waiting?.length}
      <section class="mb-4" aria-labelledby="ids-wait">
        <h3 id="ids-wait" class="sec-h"><Icon name="clock" />Waiting for their year · {app.data.waiting.length}</h3>
        <ul class="list ids-wait">
          {#each app.data.waiting as w (w.login)}
            <li class="ids-wrow">
              <span class="min-w-0"><strong>{w.name}</strong><span class="block text-sm text-muted">{w.batchName || '—'} · {w.oldId || 'no ID yet'}{w.yearOnRecord ? ' · year on record ' + w.yearOnRecord : ''}</span></span>
              <span class="shrink-0 text-sm text-muted">{w.lastSeen ? 'Last open ' + fmtDateTime(w.lastSeen) : 'Not signed in yet'}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    <div class="mb-2 flex items-center justify-between gap-2"><p class="m-0 text-sm text-muted">{app.data.ids.filter((x) => x.state === 'ACTIVE').length} to add to the dashboard</p>
      {#if app.data.ids.some((x) => x.state === 'ACTIVE')}<button type="button" class="btn btn-sm btn-outline w-auto" onclick={downloadApp}><Icon name="download" size={16} />Download the list</button>{/if}</div>
    <ul class="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
      {#each app.data.ids as x (x.iyfId)}
        <li class="card">
          <p class="m-0 flex flex-wrap items-center gap-2"><strong>{x.iyfId}</strong><span>· {x.name}</span>{#if x.state === 'RETIRED'}<span class="pill">{x.replacedBy ? 'Replaced by ' + x.replacedBy : 'Retired'}</span>{/if}</p>
          <p class="m-0 text-sm text-muted">{x.batchName} · {x.login} · created {x.createdAt.slice(0, 10)} by {x.createdBy}</p>
          <!-- only an IYFD can replace an IYFD (one id system; the server refuses an older number since 18 Oct) -->
          {#if x.dashboardMatch && x.state === 'ACTIVE' && /^IYFD-/.test(x.dashboardMatch.iyfId)}
            <p class="banner info m-0 mt-2" role="note"><Icon name="info" size={18} /><span>The dashboard now has <b>{x.dashboardMatch.iyfId}</b> ({x.dashboardMatch.name}) with this phone.</span></p>
            <Button variant="secondary" size="sm" class="mt-2 w-auto" busy={useBusy === x.iyfId} onclick={() => useDashboard(x)}>Use {x.dashboardMatch.iyfId}</Button>
          {/if}
        </li>
      {:else}<EmptyState tag="li" icon="ok" title="None created in the app">IDs created here, or while approving a sign-up, are listed for adding to the dashboard.</EmptyState>{/each}
    </ul>
  {/if}

{:else if view === 'people'}
  <p class="hint mt-0">The lasting record behind every devotee. Search a name they go by <em>now</em>, a name
    they used <em>before</em>, a phone number, or any IYF ID they have ever held — old ones still find them.</p>
  <TextInput id="pid-q" label="Search" bind:value={pq} placeholder="Name, previous name, phone or IYF ID" autocomplete="off" />
  {#if perr}<Banner>{perr}</Banner>{/if}
  {#if pbusy}<Skeleton rows={3} />{/if}

  <!-- #10 (22 Oct 2026): one person's record — inline under their row on a phone, beside the list from 1024 px -->
  {#snippet pbody(p)}
          <div class="pid-body">
            <dl class="pid-dl">
              <dt>Connected since</dt>
              <dd>{p.connectedSince || '— not known, so no IYF ID yet'}{#if p.connectedSinceSource}<span class="pid-src">({p.connectedSinceSource})</span>{/if}</dd>
              <dt>Names</dt>
              <dd>{#each p.names as n, i}{i ? ' · ' : ''}{n.name}<span class="pid-src">({n.kind.replace('_', ' ')}{n.current ? ', now' : ''})</span>{/each}</dd>
              <dt>Phones</dt>
              <dd>{#each p.phones as h, i}{i ? ' · ' : ''}{h.phone}{#if !h.active}<span class="pid-src">(old)</span>{/if}{/each}</dd>
              <dt>IYF IDs</dt>
              <dd>{#each p.identifiers as x, i}{i ? ' · ' : ''}{x.fid}<span class="pid-src">({x.state}{x.supersededBy ? ' → ' + x.supersededBy : ''})</span>{/each}</dd>
              {#if p.facilitators.length}<dt>Facilitators</dt><dd>{p.facilitators.join(' → ')}</dd>{/if}
              {#if p.levels.length}<dt>Levels</dt><dd>{p.levels.join(' → ')}</dd>{/if}
              <dt>App accounts</dt>
              <dd>{p.accounts.length ? p.accounts.map((a) => a.account).join(' · ') : 'none linked'}</dd>
            </dl>

            {#if aerr}<Banner>{aerr}</Banner>{/if}

            {#snippet side(x, label)}
              <div class="pid-side" class:keep={keepId === x.id}>
                <p class="t-over m-0">{label}</p>
                <strong>{x.name}</strong>
                <span>{x.iyfId || 'No IYF ID'}</span>
                <span class="pid-src">{x.phones.map((h) => h.phone).join(' · ') || 'no phone'}</span>
                <span class="pid-src">{x.identifiers.map((i) => i.fid).join(' · ') || 'no IDs'}</span>
                <span class="pid-src">{x.accounts.length ? x.accounts.map((a) => a.account).join(' · ') : 'no app account'}</span>
              </div>
            {/snippet}
            {#if mergeFor === p.id}
              <div class="pid-act">
                {#if !other}
                  <TextInput id={`pid-mq-${p.id}`} label="The other record" bind:value={mq} placeholder="Name, previous name, phone or IYF ID" autocomplete="off" />
                  <ul class="pid-hits">
                    {#each mHits as x (x.id)}<li><button type="button" class="btn btn-sm btn-outline" onclick={() => pickOther(x, p)}>{x.name} · {x.iyfId || x.identifiers[0]?.fid || x.phones[0]?.phone || 'no ID'}</button></li>{/each}
                  </ul>
                {:else}
                  <div class="pid-two">{@render side(p, 'This record')}{@render side(other, 'The other record')}</div>
                  <Seg id={`pid-keep-${p.id}`} label="Keep" options={[[p.id, p.name + ' (this)'], [other.id, other.name]]} value={keepId} onchange={(v) => (keepId = v)} />
                  <TextInput id={`pid-mw-${p.id}`} label="Why are they one person?" bind:value={mWhy} error={mFe.reason} hint="Kept in Activity with both records." />
                {/if}
                <div class="pid-row">
                  <button type="button" class="btn btn-outline" onclick={() => { mergeFor = ''; other = null; }}>Cancel</button>
                  {#if other}<Button variant="primary" busy={acting === 'identity.merge'} onclick={() => doMerge(p)}>Merge into {keepId === p.id ? p.name : other.name}</Button>{/if}
                </div>
              </div>
            {:else if linkFor === p.id}
              <div class="pid-act">
                <TextInput id={`pid-ll-${p.id}`} label="Their app login (phone)" bind:value={linkLogin} inputmode="numeric" autocomplete="off" />
                <TextInput id={`pid-lw-${p.id}`} label="Reason" optional bind:value={linkWhy} />
                <div class="pid-row">
                  <button type="button" class="btn btn-outline" onclick={() => (linkFor = '')}>Cancel</button>
                  <Button variant="primary" busy={acting === 'identity.link'} disabled={!linkLogin.trim()}
                    onclick={async () => { await personAct('identity.link', { personId: p.id, login: linkLogin.trim(), reason: linkWhy.trim() }, 'Linked. The account carries their IYF ID.'); if (!aerr) linkFor = ''; }}>Link account</Button>
                </div>
              </div>
            {:else if !p.mergedInto}
              <div class="pid-more">
                <button type="button" class="btn btn-text btn-sm" onclick={() => startMerge(p)}>Same person as another record…</button>
                <button type="button" class="btn btn-text btn-sm" onclick={() => { linkFor = p.id; linkLogin = ''; linkWhy = ''; mergeFor = ''; }}>Link an app account…</button>
              </div>
            {/if}

            {#if !p.iyfId}
              <div class="pid-act">
                <p class="hint m-0">No year of connection, so no IYF ID. It is created when they sign up and give
                  the year — or here, if you know it.</p>
                <div class="pid-row">
                  <TextInput id={`pid-y-${p.id}`} label="Year they first came" bind:value={mintYear}
                    inputmode="numeric" maxlength="4" placeholder={String(thisYear)} />
                  <Button onclick={() => personAct('identity.mint', { personId: p.id, year: mintYear }, 'IYF ID created.')}
                    busy={acting === 'identity.mint'} disabled={!/^\d{4}$/.test(mintYear)}>Create IYF ID</Button>
                </div>
              </div>
            {:else}
              <div class="pid-act">
                <p class="hint m-0">The year is <em>in</em> the IYF ID, so it is never renumbered. A wrong year is
                  corrected by replacing the ID — the old one keeps working for every record that uses it.</p>
                <div class="pid-row">
                  <TextInput id={`pid-sy-${p.id}`} label="Correct year" bind:value={mintYear}
                    inputmode="numeric" maxlength="4" placeholder={p.connectedSince || String(thisYear)} />
                  <Button variant="ghost" onclick={() => personAct('identity.supersede', { personId: p.id, year: mintYear }, 'IYF ID replaced; the old one still works.')}
                    busy={acting === 'identity.supersede'} disabled={!/^\d{4}$/.test(mintYear) || mintYear === p.connectedSince}>Replace the ID</Button>
                </div>
              </div>
            {/if}
          </div>
  {/snippet}
  <div class:pid-split={wide.on}>
  <ul class="pid-list">
    {#each people as p (p.id)}
      <li class="pid">
        <button type="button" class="pid-head" aria-expanded={open?.id === p.id}
          onclick={() => { open = open?.id === p.id ? null : p; aerr = ''; mintYear = ''; }}>
          <span class="pid-n">
            {p.name}
            {#if p.names.length > 1}<span class="pid-also">was {p.names.filter((n) => !n.current).map((n) => n.name).join(' · ')}</span>{/if}
          </span>
          <span class="pid-id">{#if p.mergedInto}<span class="pill">Merged</span>{:else}{p.iyfId || 'No IYF ID yet'}{/if}</span>
        </button>

        {#if open?.id === p.id && !wide.on}{@render pbody(p)}{/if}
      </li>
    {:else}
      {#if pq.trim().length >= 2 && !pbusy}
        <EmptyState tag="li" icon="search" title="No one found">No person with that name, number or IYF ID.</EmptyState>
      {/if}
    {/each}
  </ul>
  {#if wide.on}<section class="pid-pane" aria-live="polite" aria-label="Person record">{#if open}{@render pbody(open)}{:else}<EmptyState icon="user" title="No one chosen" />{/if}</section>{/if}
  </div>
{/if}

<style>
  /* #10: list + detail from 1024 px */
  .pid-split { display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); gap: var(--sp-5); align-items: start; }
  .pid-pane { position: sticky; top: calc(var(--sticky-top) + var(--sp-3)); min-width: 0; padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
  .pid-more { display: flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-3); margin-top: var(--sp-2); }
  .pid-hits { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin: 0 0 var(--sp-3); padding: 0; list-style: none; }
  .pid-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-3); }
  .pid-side { display: grid; gap: 2px; padding: var(--sp-3); border: 1px solid var(--border); border-radius: var(--r-md); min-width: 0; overflow-wrap: anywhere; }
  .pid-side.keep { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .ids-wrow { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; padding: var(--sp-3) var(--sp-4); }

  /* four tools do not fit one row on a 320 px phone ("Duplicates" ran into "Created here"): two rows of two there */
  @media (max-width: 399px) { .ids-tools { display: grid; grid-template-columns: 1fr 1fr; } }

  .pid-list { list-style: none; margin: var(--sp-3) 0 0; padding: 0; display: grid; gap: 8px; }
  .pid { border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); overflow: hidden; }
  .pid-head { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; text-align: left; background: none; border: 0; color: inherit; cursor: pointer; }
  .pid-n { flex: 1; min-width: 0; font-weight: 650; }
  .pid-also { display: block; font-size: var(--fs-caption); font-weight: 400; color: var(--text-muted); }
  .pid-id { font-size: var(--fs-sm); color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .pid-body { padding: 0 14px 14px; border-top: 1px solid var(--border); }
  .pid-dl { display: grid; grid-template-columns: minmax(110px, auto) 1fr; gap: 8px 14px; margin: 12px 0 0; font-size: var(--fs-sm); }
  .pid-dl dt { color: var(--text-muted); }
  .pid-dl dd { margin: 0; overflow-wrap: anywhere; line-height: 1.6; }
  /* a qualifier always stands clear of the value it describes — "…Das (initiated, now)", never "…Dasinitiated" */
  .pid-src { color: var(--text-muted); font-size: var(--fs-caption); margin-left: 5px; white-space: nowrap; }
  .pid-dl dd { line-height: 1.6; }
  .pid-act { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--border); }
  .pid-row { display: flex; gap: 10px; align-items: flex-end; margin-top: 8px; flex-wrap: wrap; }
  .pid-row :global(.field) { flex: 1 1 140px; margin: 0; }
</style>
