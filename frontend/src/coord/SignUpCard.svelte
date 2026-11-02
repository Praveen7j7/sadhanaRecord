<script>
  import WheelSelect from '../ui/WheelSelect.svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { todayIST, fmtDateTime, defaultChoice } from '../lib/validate.js';
  import Button from '../ui/Button.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Radio from '../ui/Radio.svelte';
  import RadioGroup from '../ui/RadioGroup.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import Icon from '../ui/Icon.svelte';
  import Seg from '../ui/Seg.svelte';
  import { CLASS_DAYS, waLink, mailLink } from '../lib/contact.js';
  import Banner from '../ui/Banner.svelte';
  import { cachedMeta, loadMeta } from '../lib/meta.js';
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';

  let { s, onDone } = $props();
  // choice: '' | 'noid' | an iyfId
  let choice = $state(defaultChoice(s.matches));
  let picked = $state(null); // result chosen through "Pick another ID"
  let searching = $state(false);
  let q = $state('');
  let results = $state([]);
  let searchBusy = $state(false);
  let searchErr = $state('');
  let levelDate = $state(todayIST());
  // decision 33: confirm (or correct) the facilitator and the class day the devotee chose, from the same lists
  let facilitator = $state(s.facilitator || '');
  let classDay = $state(s.classDay || '');
  let meta = $state(cachedMeta());
  loadMeta().then((d) => (meta = d)).catch(() => {});
  const facilitators = $derived(meta.facilitators || []);
  let rejecting = $state(false);
  let reason = $state('');
  let busy = $state(false);
  let error = $state('');
  let fe = $state({});

  // Debounced registry search (400 ms, at least 3 characters)
  $effect(() => {
    const term = q.trim();
    searchErr = '';
    if (term.length < 3) { results = []; return; }
    const t = setTimeout(async () => {
      searchBusy = true;
      try {
        results = (await call('registry.search', { q: term })).results || [];
      } catch (e) { searchErr = errorMessage(e); results = []; }
      searchBusy = false;
    }, 400);
    return () => clearTimeout(t);
  });

  const why = (r) => (r.mergedInto ? `Merged into ${r.mergedInto}` : r.linked ? 'Already linked to an account' : '');

  function pick(r) {
    picked = r;
    choice = r.iyfId;
  }

  // Phase 9, item 14: the IYF head (only) can create a new IYF ID while approving. It is IYFD-<year they connected>-NNNN:
  // with no year on the sign-up, the head picks it here, so the approval and the ID happen in one step (18 Oct 2026).
  const isHead = $derived(!!scopesOf(session.user).master);
  const YEARS = Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => String(new Date().getFullYear() - i));
  let nextId = $state('');
  let needYear = $state(false);
  let idYear = $state('');
  let previewSeq = 0;
  $effect(() => {
    if (choice !== 'new') return;
    const y = idYear, n = ++previewSeq;
    call('ids.nextApp', { login: s.phone, ...(y ? { year: y } : {}) }).then((r) => {
      if (n !== previewSeq) return;                // a newer pick answered first
      if (!y) needYear = !!r.needsYear;
      nextId = r.next || '';
    }).catch(() => {});
  });

  async function approve() {
    if (busy) return;
    error = ''; fe = {};
    if (!choice) { error = 'Choose an ID match, or approve with no ID.'; return; }
    if (!facilitator) { fe = { facilitator: 'Choose the facilitator' }; return; }
    if (!classDay) { fe = { classDay: 'Choose the class day: Sunday or Saturday' }; return; }
    if (choice === 'new' && needYear && !idYear) { fe = { 'link.year': 'Choose the year they first came to IYF Delhi' }; return; }
    busy = true;
    try {
      const d = await call('requests.approve', {
        phone: s.phone,
        link: choice === 'noid' ? { noIdYet: true } : choice === 'new' ? { createId: true, ...(idYear ? { year: idYear } : {}) } : { iyfId: choice },
        levelEntryDate: levelDate,
        facilitator,
        classDay,
      });
      const msg = d.created ? `Approved with the new IYF ID ${d.iyfId}.` : d.needsYear ? 'Approved. Their IYF ID waits for the year they connected.'
        : d.linked && d.iyfId ? `Approved and linked to ${d.iyfId}` : 'Approved; the IYF ID will be linked automatically';
      onDone(msg);
    } catch (e) {
      fe = fieldErrors(e);
      error = fe.levelEntryDate || fe.facilitator || fe.classDay || fe['link.year'] ? '' : errorMessage(e);
      busy = false;
    }
  }

  async function reject() {
    if (busy) return;
    error = ''; fe = {};
    if (reason.trim().length < 2) { fe.reason = 'Give a reason'; return; }
    busy = true;
    try {
      await call('requests.reject', { phone: s.phone, reason: reason.trim() });
      onDone(`Rejected ${s.name}`);
    } catch (e) {
      fe = fieldErrors(e);
      error = fe.reason ? '' : errorMessage(e);
      busy = false;
    }
  }
</script>

<article class="card mb-4">
  <header class="mb-3 flex items-start gap-3">
    <span class="avatar" aria-hidden="true">{(s.name || '?').charAt(0).toUpperCase()}</span>
    <div class="min-w-0">
      <h3 class="m-0 break-words">{s.name}</h3>
      <p class="m-0 text-sm text-muted">{s.phone} · {(cachedMeta().batches || []).find((b) => b.batchId === s.batchId)?.name || 'Batch ' + s.batchId} · {fmtDateTime(s.at)}</p>
    </div>
  </header>
  <ul class="m-0 mb-3 flex list-none flex-wrap gap-2 p-0 text-sm">
    {#if s.email}<li><a class="btn btn-sm btn-outline" href={mailLink(s.email)}><Icon name="msg" size={16} /><span class="break-all">{s.email}</span></a></li>{:else}<li class="pill" data-tone="warn">No email given</li>{/if}
    {#if waLink(s.whatsapp)}<li><a class="btn btn-sm btn-outline" href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="phone" size={16} />WhatsApp {s.whatsapp}<span class="sr-only"> (opens WhatsApp)</span></a></li>{:else}<li class="pill">No WhatsApp</li>{/if}
  </ul>
  {#if s.parentName}
    <!-- under 18 at sign-up: the parent or guardian who agreed (DPDP Act 2023); call them before approving if unsure -->
    <p class="banner info m-0 mb-3" role="note"><Icon name="info" size={18} /><span>Under 18. Parent or guardian who agreed: <b>{s.parentName}</b>{#if s.parentPhone} · <a class="ilink" href={'tel:+91' + s.parentPhone}>{s.parentPhone}</a>{/if}</span></p>
  {/if}

  {#if error}<Banner>{error}</Banner>{/if}

  <RadioGroup legend="Registry match">
    {#each s.matches as m (m.iyfId)}
      <Radio name={'m-' + s.phone} value={m.iyfId} bind:group={choice} disabled={m.linked || !!m.mergedInto}>
        <span class="block"><strong>{m.iyfId}</strong> · {m.name}</span>
        <span class="cdesc">{m.level}{m.facilitator ? ' · ' + m.facilitator : ''} · phone {m.phoneEnd} · {m.why}{m.linked ? ' · already has an account' : ''}</span>
      </Radio>
      {#if m.nameMatches === false && !m.linked}
        <p class="banner warn m-0" role="note"><Icon name="alert" size={18} /><span>Phone matches, but the name is different — check this is the same person.</span></p>
      {/if}
    {:else}
      <p class="m-0 text-sm text-muted">The registry found no match.</p>
    {/each}
    {#if picked && !s.matches.some((m) => m.iyfId === picked.iyfId)}
      <Radio name={'m-' + s.phone} value={picked.iyfId} bind:group={choice}>
        <span class="block"><strong>{picked.iyfId}</strong> · {picked.name}</span><span class="cdesc">{picked.level} · phone {picked.phoneEnd} · picked by you</span>
      </Radio>
    {/if}
    <Radio name={'m-' + s.phone} value="noid" bind:group={choice} label="Not in the registry yet — approve with no ID" desc="An IYF ID can be given later." />
    {#if isHead}
      <Radio name={'m-' + s.phone} value="new" bind:group={choice} label="Create a new IYF ID" desc={choice === 'new' && nextId ? `They get ${nextId}.` : 'IYFD-<year they connected>-NNNN'} />
      {#if choice === 'new' && needYear}
        <div class="su-year"><WheelSelect id={'yr-' + s.phone} label="Connected since" bind:value={idYear} options={YEARS} placeholder="Choose the year" error={idYear ? '' : fe['link.year']} /></div>
      {/if}
    {/if}
  </RadioGroup>

  <button class="btn btn-text btn-sm -ml-2.5 mb-2" type="button" aria-expanded={searching} onclick={() => (searching = !searching)}><Icon name="search" size={16} />{searching ? 'Hide search' : 'Pick another ID'}</button>

  {#if searching}
    <div class="well mb-4">
      <TextInput id={'q-' + s.phone} label="Search name, IYF ID or phone" bind:value={q} hint="Type at least 3 characters" autocomplete="off" loading={searchBusy} class="mb-2" />
      <ValidationMessage error={searchErr} />
      <ul class="m-0 grid list-none gap-2 p-0">
        {#each results as r (r.iyfId)}
          <li class="card flex items-center justify-between gap-2 p-3">
            <span class="min-w-0"><strong>{r.iyfId}</strong> · {r.name}<br /><span class="text-sm text-muted">{r.level} · {r.facilitator} · phone {r.phoneEnd}{why(r) ? ' · ' + why(r) : ''}</span></span>
            <Button size="sm" disabled={!!why(r)} onclick={() => pick(r)}>Use</Button>
          </li>
        {/each}
      </ul>
      {#if q.trim().length >= 3 && !searchBusy && !results.length && !searchErr}<p class="m-0 text-sm text-muted">No results.</p>{/if}
    </div>
  {/if}

  <!-- one under the other (Phase 24): a facilitator's name is long, and half a 330 px card cut it to "Natvar Gopin…" -->
  <div>
    <WheelSelect id={'fa-' + s.phone} label="Facilitator" bind:value={facilitator} options={facilitators} placeholder="Choose the facilitator" error={fe.facilitator} hint={s.facilitator ? undefined : 'Not chosen by the devotee'} />
    <DateInput id={'lv-' + s.phone} label="Level-entry date" bind:value={levelDate} error={fe.levelEntryDate} />
  </div>
  <Seg id={'cd-' + s.phone} label="Class day" options={CLASS_DAYS} value={classDay} onchange={(v) => (classDay = v)} error={fe.classDay} />

  {#if rejecting}
    <div class="confirm danger">
      <TextInput id={'rj-' + s.phone} label="Reason for rejecting" bind:value={reason} error={fe.reason} />
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" onclick={() => (rejecting = false)}>Cancel</Button>
        <Button variant="danger-solid" {busy} onclick={reject}>Confirm reject</Button>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-[auto_1fr] gap-2">
      <button class="btn btn-danger" type="button" onclick={() => (rejecting = true)}>Reject…</button>
      <Button variant="primary" {busy} onclick={approve}>Approve</Button>
    </div>
  {/if}
</article>

<style>
  .su-year { margin: var(--sp-2) 0 var(--sp-3) 2.25rem; max-width: 16rem; }
</style>
