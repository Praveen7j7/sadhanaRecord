<script>
  import { density } from '../lib/density.svelte.js';
  import Status from '../ui/Status.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  // Members: every devotee of the caller's batches (the master: all of IYF Delhi), active, inactive and disabled,
  // searched, filtered and paged on the server (members.list). Each opens the devotee page with its actions;
  // deleting someone who is long inactive is manual (the phone is typed again) and can be done from here too.
  import { untrack } from 'svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { fmtShort } from '../lib/dates.js';
  import { BLOOD_GROUPS } from '../lib/validate.js';
  import { telLink, waLink } from '../lib/contact.js';
  import { forgetPhoto } from '../lib/photos.js';
  import { toast } from '../lib/pro.svelte.js';
  import Search from '../ui/Search.svelte';
  import Photo from '../ui/Photo.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';
  import Button from '../ui/Button.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Refreshing from '../ui/Refreshing.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import { route } from '../lib/router.svelte.js';
  let { batchIds = [], nameOf = (id) => id, all = false, tools = null } = $props();   // tools: the page's Export (Batch.svelte), in the count row

  const PAGE = 50;
  const STATUS = [['ALL', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['DISABLED', 'Disabled']];
  // a link may open the list on a batch and status (Admin › All batches, Phase 22 I3: #/members?batch=SPS&status=INACTIVE)
  const QS = new URLSearchParams(route.path.split('?')[1] || '');
  let status = $state(STATUS.some(([k]) => k === QS.get('status')) ? QS.get('status') : 'ALL'), batch = $state(batchIds.includes(QS.get('batch')) ? QS.get('batch') : ''), classDay = $state(''), sort = $state('name'), q = $state(''), typed = $state(''), blood = $state('');
  let extra = $state([]), moreBusy = $state(false);
  let timer;
  $effect(() => { const v = typed; clearTimeout(timer); timer = setTimeout(() => (q = v.trim()), 300); return () => clearTimeout(timer); });

  const params = $derived({ ...(batch ? { batchId: batch } : {}), status, ...(classDay ? { classDay } : {}), ...(blood ? { bloodGroup: blood } : {}), ...(q ? { q } : {}), sort, limit: PAGE });
  const key = $derived('members.list:' + JSON.stringify(params));
  const e = $derived(entry(key));
  const d = $derived(e.data);
  const rows = $derived([...(d?.rows || []), ...extra]);
  // a list with any ⋯ keeps that column on every row, so Call and WhatsApp line up (Phase 24, G5 / V32)
  const anyMore = $derived(rows.some((m) => m.status !== 'ACTIVE'));
  function refresh(force = false) { extra = []; load(key, () => call('members.list', params), { force }); }
  $effect(() => { key; untrack(() => refresh()); });
  const more = $derived(!!d && rows.length < d.total);   // a pure derivation, not an effect (audit FE-11)

  async function loadMore() {
    moreBusy = true;
    try { const r = await call('members.list', { ...params, offset: rows.length }); extra = [...extra, ...r.rows]; }
    catch (err) { toast(errorMessage(err), { kind: 'err' }); }
    moreBusy = false;
  }

  let moreDlg = $state(), menuFor = $state(null);
  // delete from the list (behind ⋯): only offered for someone already inactive or disabled
  let sheet;
  let del = $state(null), phone2 = $state(''), delErr = $state(''), delBusy = $state(false);
  async function confirmDelete() {
    delBusy = true; delErr = '';
    try {
      await call('devotees.delete', { login: del.login, confirmPhone: phone2.trim() });
      forgetPhoto(del.login);
      patch(key, (x) => ({ ...x, rows: x.rows.filter((r) => r.login !== del.login), total: x.total - 1,
        counts: { ...x.counts, [del.status]: Math.max(0, (x.counts[del.status] || 1) - 1) } }));
      extra = extra.filter((r) => r.login !== del.login);
      toast(`${del.name}'s account was deleted. Their submitted weeks are kept.`);
      sheet.close();
    } catch (err) { delErr = fieldErrors(err).confirmPhone || errorMessage(err); }
    delBusy = false;
  }

  // the filters applied, as chips (sort counts only when not by name)
  let filtDlg = $state();
  const CLASS = { SUN: 'Sunday class', SAT: 'Saturday class' }, SORT = { inactive: 'Inactive first', lastSubmitted: 'Last submitted' };
  const applied = $derived([...(batch ? [['batch', nameOf(batch)]] : []), ...(classDay ? [['classDay', CLASS[classDay]]] : []), ...(blood ? [['blood', 'Blood ' + blood]] : []), ...(sort !== 'name' ? [['sort', 'Sort: ' + SORT[sort]]] : [])]);
  const nFilters = $derived(applied.length);
  const clear = (k) => { if (k === 'batch') batch = ''; else if (k === 'classDay') classDay = ''; else if (k === 'blood') blood = ''; else sort = 'name'; };
  const tone = (s) => (s === 'ACTIVE' ? 'ok' : s === 'INACTIVE' ? 'warn' : 'bad');
</script>

<div class="members">
  <div class="mb-filters">
    <!-- one row: the search, and beside it the Filters sheet (batch, class, blood group, sort; Phase 5). It used to sit
         alone in a row under the search (27 Oct 2026 search audit); what is applied shows as chips that remove it -->
    <div class="mb-find">
      <Search id="mb-q" label="Search members" placeholder="Name, phone or IYF ID" bind:value={typed} class="mb-0 min-w-0 flex-1" pin />
      <button type="button" class="btn btn-outline mb-fbtn" aria-haspopup="dialog" onclick={() => filtDlg.showModal()}><Icon name="grid" size={18} /><span class="mb-ft">Filters</span>{nFilters ? ` (${nFilters})` : ''}</button>
    </div>
    {#if applied.length}<div class="mb-chips">
      {#each applied as [k, label] (k)}<button type="button" class="chip-x" onclick={() => clear(k)} aria-label={'Remove filter: ' + label}>{label}<span aria-hidden="true">×</span></button>{/each}
    </div>{/if}
    <div class="seg mb-seg" role="group" aria-label="Status">
      {#each STATUS as [v, t]}
        <button type="button" aria-pressed={status === v} onclick={() => (status = v)}>{t}{#if d}<b>{v === 'ALL' ? (d.counts.ACTIVE + d.counts.INACTIVE + d.counts.DISABLED) : d.counts[v]}</b>{/if}</button>
      {/each}
    </div>
  </div>

  {#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>{/if}
  {#if !d && !e.error}<Skeleton kind="list" rows={6} />
  {:else if d}
    <div class="mb-head">
      <p class="m-0 text-sm text-muted" aria-live="polite">{d.total} {d.total === 1 ? 'member' : 'members'}{q ? ` matching “${q}”` : ''}</p>
      <span class="ph-tools"><Refreshing on={e.refreshing} onrefresh={() => refresh(true)} />{@render tools?.()}</span>
    </div>
    {#if !rows.length}
      <EmptyState icon="users" title="No one here">{q || status !== 'ALL' || classDay || blood ? 'Nobody matches these filters — clear them.' : 'Approved devotees of your batches appear here.'}</EmptyState>
    {:else}
      <ul class="mb-list" aria-label="Members">
        {#each rows as m (m.login)}
          <li class="mrow" class:dense={density.compact}>
            <a class="mrow-main" href={'#/devotee/' + encodeURIComponent(m.login)}>
              <Photo login={m.login} name={m.name} hasPhoto={m.hasPhoto} size={40} />
              <span class="min-w-0">
                <b class="mrow-name">{m.name}</b>
                <span class="mrow-sub">
                  {#if m.status !== 'ACTIVE'}<Status tone={tone(m.status)} label={m.status === 'INACTIVE' ? 'Inactive' : 'Disabled'} />{/if}
                  {#if all || batchIds.length > 1}<span>{m.batchName}</span>{/if}
                  {#if m.iyfId}<span class="tabular">{m.iyfId}</span>{/if}
                  {#if blood && m.bloodGroup}<span class="pill" data-tone="bad">{m.bloodGroup}</span>{/if}
                  <span>{m.inactiveSince ? `Inactive since ${fmtShort(m.inactiveSince)}` : m.lastSubmitted ? `Last week ${fmtShort(m.lastSubmitted)}` : 'Nothing submitted yet'}</span>
                </span>
              </span>
            </a>
            <!-- one tap to call or WhatsApp them (the head, 3 Oct 2026) -->
            <span class="mrow-act">
              <IconButton icon="phone" size={18} label={'Call ' + m.name} href={telLink(m.login)} />
              {#if waLink(m.whatsapp || m.login)}<IconButton icon="msg" size={18} label={'WhatsApp ' + m.name + ' (opens WhatsApp)'} href={waLink(m.whatsapp || m.login)} target="_blank" rel="noopener noreferrer" />{/if}
            </span>
            {#if m.status !== 'ACTIVE'}
              <!-- no delete button in the row (8 Oct 2026): it sits behind ⋯, then the confirm sheet -->
              <IconButton icon="more" size={18} class="mrow-del" label={'More for ' + m.name} aria-haspopup="dialog" onclick={() => { menuFor = m; moreDlg.showModal(); }} />
            {:else if anyMore}<span class="mrow-del-gap" aria-hidden="true"></span>{/if}
          </li>
        {/each}
      </ul>
      {#if more}<div class="mt-3 text-center"><Button variant="secondary" busy={moreBusy} onclick={loadMore}>Show more ({d.total - rows.length} left)</Button></div>{/if}
    {/if}
  {/if}
</div>

<Sheet bind:this={filtDlg} titleId="mb-f-t" title="Filters" sub="Who to show in the list">
  {#if batchIds.length > 1}
    <WheelSelect id="mb-batch" label="Batch" srLabel value={batch} options={[['', all ? 'All of IYF Delhi' : 'All my batches'], ...batchIds.map((b) => [b, nameOf(b)])]} onchange={(v) => (batch = v)} />
  {/if}
  <WheelSelect id="mb-day" label="Class" value={classDay} options={[['', 'Any class'], ['SUN', 'Sunday class'], ['SAT', 'Saturday class']]} onchange={(v) => (classDay = v)} />
  <!-- blood group (the head, 3 Oct 2026): someone needs blood, find who can give -->
  <WheelSelect id="mb-blood" label="Blood group" value={blood} options={[['', 'Any blood group'], ...BLOOD_GROUPS]} onchange={(v) => (blood = v)} />
  <WheelSelect id="mb-sort" label="Sort" value={sort} options={[['name', 'Name'], ['inactive', 'Inactive first'], ['lastSubmitted', 'Last submitted']]} onchange={(v) => (sort = v)} />
  <div class="mt-2 grid grid-cols-2 gap-2">
    <button type="button" class="btn btn-outline" disabled={!nFilters} onclick={() => { batch = ''; classDay = ''; blood = ''; sort = 'name'; }}>Clear all</button>
    <button type="button" class="btn btn-primary" onclick={() => filtDlg.close()}>Show {d ? d.total : ''}</button>
  </div>
</Sheet>

<Sheet bind:this={moreDlg} titleId="mb-more-t" title={menuFor?.name || ''} sub={menuFor ? (menuFor.status === 'INACTIVE' ? 'Inactive' : 'Disabled') : ''} onclose={() => (menuFor = null)}>
  {#if menuFor}
    {@const m = menuFor}
    <div class="grid gap-2">
      <a class="btn" href={'#/devotee/' + encodeURIComponent(m.login)}>Open their page</a>
      <button type="button" class="btn btn-danger" onclick={() => { moreDlg.close(); del = m; phone2 = ''; delErr = ''; sheet.showModal(); }}><Icon name="trash" size={16} />Delete account…</button>
    </div>
  {/if}
</Sheet>

<Sheet bind:this={sheet} titleId="mb-del-t" title={del ? `Delete ${del.name}'s account?` : ''} onclose={() => (del = null)}>
  {#if del}
    <p class="m-0 mb-2 text-sm">{del.status === 'INACTIVE' && del.inactiveSince ? `Inactive since ${fmtShort(del.inactiveSince)}. ` : ''}Their login, unsent drafts, profile and photo are removed. Submitted weeks, missed weeks and attendance are kept. The number can sign up again later.</p>
    <TextInput id="mb-phone" label={`Type the phone number (${del.login}) to confirm`} type="tel" inputmode="numeric" bind:value={phone2} error={delErr} autocomplete="off" />
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" disabled={delBusy} onclick={() => sheet.close()}>Cancel</button>
      <Button variant="danger-solid" busy={delBusy} disabled={phone2.replace(/\D/g, '').slice(-10) !== del.login} onclick={confirmDelete}>Delete</Button>
    </div>
  {/if}
</Sheet>

<style>
  /* #1: compact rows (the toggle is on Batch status; one setting for every staff list) */
  .mrow.dense { padding-top: 4px; padding-bottom: 4px; }
  .mb-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .mb-find { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
  .mb-fbtn { flex: none; width: auto; padding-inline: 14px; }
  /* a small phone: the icon alone (the word stays for screen readers), so the search keeps its placeholder */
  @media (max-width: 379px) { .mb-fbtn { padding-inline: 12px; } .mb-ft { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; } }
  .chip-x { display: inline-flex; align-items: center; gap: 6px; min-height: var(--ctl-h); padding: 0 6px 0 12px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--accent-soft); color: var(--text); font: inherit; font-size: var(--fs-sm); cursor: pointer; }
  .chip-x span { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font-size: 1rem; color: var(--text-muted); }
  @media (hover: hover) { .chip-x:hover span { background: var(--surface-hover); } }
</style>
