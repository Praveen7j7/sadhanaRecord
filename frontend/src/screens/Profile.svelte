<script>
  import WheelSelect from '../ui/WheelSelect.svelte';
  // Your profile (loaded only when Account is opened): face photo, date of birth, blood group, contact details (email,
  // WhatsApp, address, emergency contact: only the devotee changes them; coordinators and the head see them). Each section is
  // read-only until its pencil is tapped, then saved with its own Save; the photo is cropped on the phone (that code loads only when needed).
  import { session } from '../lib/session.svelte.js';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { putPhoto, forgetPhoto } from '../lib/photos.js';
  import { BLOOD_GROUPS, RELATIONS } from '../lib/validate.js';
  import { CLASS_DAYS, classDayName, emailProblem, normWhatsapp } from '../lib/contact.js';
  import Seg from '../ui/Seg.svelte';
  import { addressErrors, cleanAddress, addressLine } from '../lib/address.js';
  import { fmtDate } from '../lib/dates.js';
  import EditSection from '../ui/EditSection.svelte';
  import Photo from '../ui/Photo.svelte';
  import PhotoZoom from '../ui/PhotoZoom.svelte';
  import AddressFields from '../ui/AddressFields.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import Icon from '../ui/Icon.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import { scopesOf } from '../lib/scopes.js';
  import { cachedMeta, loadMeta } from '../lib/meta.js';

  const u = $derived(session.user);
  const e = entry('profile.get');
  load('profile.get');
  const p = $derived(e.data);
  // the facilitator (the head, 5 Oct 2026: it can change after sign-up): a devotee's own, picked from the head's list, never typed
  const isDevotee = $derived(!!scopesOf(u).devotee);
  // the years someone can have come to IYF Delhi, newest first (the server checks the same range)
  const YEARS = Array.from({ length: new Date().getFullYear() - 1979 }, (_, i) => String(new Date().getFullYear() - i));
  let facList = $state(cachedMeta().facilitators || []);
  loadMeta().then((d) => (facList = d.facilitators || []), () => {});

  // ---- details: four read-only sections, each opened for editing by its pencil (the head, 4 Oct 2026) ----
  let f = $state(null);
  const fromServer = (d) => ({ connectedSince: d.connectedSinceYear || '', classDay: d.classDay || '', email: d.email || '', whatsapp: d.whatsapp || '', dob: d.dob || '', bloodGroup: d.bloodGroup || '', emName: d.emergency?.name || '', emRelation: d.emergency?.relation || '', emPhone: d.emergency?.phone || '', facilitator: d.facilitator || '',
    // house / street / landmark travel with the rest (13 Oct 2026, audit FE-1): they were dropped here, so
    // AddressFields re-derived them by splitting `line` at the first comma — and a house number with a comma in
    // it ("B-12, Gali 3") lost a piece on every save.
    addr: { line: d.address?.line || '', house: d.address?.house || '', street: d.address?.street || '', landmark: d.address?.landmark || '',
            area: d.address?.area || '', city: d.address?.city || '', state: d.address?.state || (d.address ? '' : 'Delhi'), pin: d.address?.pin || '' } });
  const base = $derived(p ? fromServer(p) : null);
  // which section is open ('' = none) and the fields each one owns
  let editing = $state('');
  const OWNS = { about: ['connectedSince', 'classDay', 'dob', 'bloodGroup'], contact: ['email', 'whatsapp'], address: ['addr'], emergency: ['emName', 'emRelation', 'emPhone'], facilitator: ['facilitator'] };
  const changed = $derived(!!(editing && f && base) && OWNS[editing].some((k) => JSON.stringify(f[k]) !== JSON.stringify(base[k])));
  let busy = $state(false), err = $state(''), fe = $state({});
  function open(sec) { f = fromServer(p); fe = {}; err = ''; editing = sec; }
  function close() { editing = ''; fe = {}; err = ''; }
  async function save() {
    if (!changed) { close(); return; }
    const data = {}, cfe = {};
    if (editing === 'about') {
      if (f.classDay !== base.classDay) data.classDay = f.classDay;
      if (f.dob !== base.dob) data.dob = f.dob;
      if (f.bloodGroup !== base.bloodGroup) data.bloodGroup = f.bloodGroup;
      if (p.connectedSinceSettable && f.connectedSince && f.connectedSince !== base.connectedSince) data.connectedSince = f.connectedSince;
    } else if (editing === 'contact') {
      if (f.email.trim() !== base.email) { const m = emailProblem(f.email); if (m) cfe.email = m; else data.email = f.email.trim().toLowerCase(); }
      if (f.whatsapp.trim() !== base.whatsapp) { const w = normWhatsapp(f.whatsapp); if (w === null) cfe.whatsapp = 'Enter a 10-digit WhatsApp number, or leave it empty'; else data.whatsapp = w; }
    } else if (editing === 'address') {
      const ae = addressErrors(f.addr);
      if (Object.keys(ae).length) Object.assign(cfe, ae); else data.address = cleanAddress(f.addr);
    } else if (editing === 'emergency') {
      data.emergency = { name: f.emName.trim(), relation: f.emRelation, phone: f.emPhone.trim() };
    } else if (editing === 'facilitator') {
      if (!f.facilitator) cfe.facilitator = 'Choose your facilitator from the list.'; else data.facilitator = f.facilitator;
    }
    if (Object.keys(cfe).length) { fe = cfe; err = ''; document.querySelector('.esec.on [aria-invalid="true"]')?.focus(); return; }
    busy = true; err = ''; fe = {};
    try {
      const r = await call('profile.update', data);
      patch('profile.get', () => r);
      toast(TITLES[editing] + ' saved.');
      close();
    } catch (x) { err = errorMessage(x); fe = fieldErrors(x); }
    busy = false;
  }
  const TITLES = { about: 'About you', contact: 'Contact details', address: 'Address', emergency: 'Emergency contact', facilitator: 'Facilitator' };
  // read-only text: '' shows as "Not added"
  const dobText = (d) => (d ? fmtDate(d) : '');

  // ---- photo ----
  let file = $state(null);
  let crop = $state(null);
  let pBusy = $state(false), pErr = $state(''), pOk = $state(''), removing = $state(false);
  async function chosen(ev) {
    const fl = ev.currentTarget.files?.[0];
    ev.currentTarget.value = '';
    if (!fl) return;
    pErr = ''; pOk = '';
    if (!/^image\//.test(fl.type)) { pErr = 'Choose a photo (JPEG or PNG).'; return; }
    crop ||= (await import('./PhotoCrop.svelte')).default;
    file = fl;
  }
  async function upload(b64) {
    pErr = '';
    try {
      const r = await call('photo.upload', { jpegBase64: b64 });
      await putPhoto(u.login, b64, r.photoUpdatedAt);
      patch('profile.get', (d) => ({ ...d, ...r }));
      // the menu's round avatar shows it at once
      if (session.user) session.user = { ...session.user, photoAt: r.photoUpdatedAt };
      file = null; pOk = 'Photo saved.'; toast('Photo saved.');
    } catch (x) { pErr = errorMessage(x); }
  }
  async function remove() {
    pBusy = true; pErr = '';
    try {
      await call('photo.remove', {});
      await forgetPhoto(u.login);
      patch('profile.get', (d) => ({ ...d, hasPhoto: false, photoUpdatedAt: null }));
      if (session.user) session.user = { ...session.user, photoAt: null };
      removing = false; pOk = 'Photo removed.';
    } catch (x) { pErr = errorMessage(x); }
    pBusy = false;
  }
  const Crop = $derived(crop);
</script>

{#if e.error && !p}<Banner onretry={() => load('profile.get', undefined, { force: true })}>{errorMessage(e.error)}</Banner>{/if}
{#if !p && !e.error}<Skeleton rows={2} />
{:else if p}
  <section class="section" aria-labelledby="h-photo">
    <h3 id="h-photo"><Icon name="user" />Photo</h3>
    {#if file && Crop}
      <Crop {file} onDone={upload} onCancel={() => (file = null)} />
      <ValidationMessage error={pErr} />
    {:else}
      <div class="flex items-center gap-4">
        {#if p.hasPhoto}<PhotoZoom login={u.login} name={u.name} own updatedAt={p.photoUpdatedAt}><Photo login={u.login} name={u.name} hasPhoto own updatedAt={p.photoUpdatedAt} size={88} /></PhotoZoom>
        {/if}<!-- no photo yet: the initial is already at the top of Account, so only the button shows here -->
        <div class="grid min-w-0 flex-1 gap-2">
          <label class="btn cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]">
            <input class="sr-only" type="file" accept="image/*" onchange={chosen} /><Icon name="edit" size={18} />{p.hasPhoto ? 'Change photo' : 'Add a photo'}
          </label>
          {#if p.hasPhoto && !removing}<button type="button" class="btn btn-danger" onclick={() => (removing = true)}><Icon name="trash" size={18} />Remove photo</button>{/if}
        </div>
      </div>
      {#if removing}
        <div class="confirm danger" role="group" aria-label="Remove your photo">
          <p class="q">Remove your photo?</p>
          <div class="grid grid-cols-2 gap-2"><button type="button" class="btn btn-outline" onclick={() => (removing = false)}>Cancel</button><Button variant="danger-solid" busy={pBusy} onclick={remove}>Remove</Button></div>
        </div>
      {/if}
      <ValidationMessage error={pErr} success={pOk} />
    {/if}
  </section>

  {#snippet row(label, value)}<div class="esec-row"><dt>{label}</dt><dd class:none={!value}>{value || 'Not added'}</dd></div>{/snippet}
  {#snippet sec(key, icon, viewRows, form)}
    <EditSection id={'h-' + key} title={TITLES[key]} {icon} editing={editing === key} locked={!!editing && editing !== key} {busy} error={err && !Object.keys(fe).length ? err : ''}
      canSave={changed} onedit={() => open(key)} oncancel={close} onsave={save} view={viewRows}>{@render form()}</EditSection>
  {/snippet}

  <!-- The IYF ID is theirs and is what every IYF record refers to them by, so they should be able to
       read it here rather than ask a coordinator (the head, 17 Oct 2026). It is shown only once the
       identity authority has minted one; before that the row would only raise a question nobody on
       this screen can answer. Not editable: the app issues it, nobody types it. -->
  {#snippet aboutView()}{#if p.iyfId}{@render row('IYF ID', p.iyfId)}{/if}{@render row('Connected since', p.connectedSinceYear)}{@render row('Class you attend', classDayName(p.classDay) ? classDayName(p.classDay) + ' class' : '')}{@render row('Date of birth', dobText(p.dob))}{@render row('Blood group', p.bloodGroup)}{/snippet}
  {#snippet aboutForm()}
    <!-- Set once (the head, 18 Oct 2026): people from before sign-up asked for the year had no way to give it.
         Saving it issues their IYFD id at once — the hint says so, because it cannot be undone here. -->
    <!-- only while NO year is on record (22 Oct 2026): a year on record is confirmed on the year screen, never changed -->
    {#if p.connectedSinceSettable && !p.connectedSinceYear}
      <WheelSelect id="pf-cs" label="Connected since" bind:value={f.connectedSince} options={YEARS} placeholder="The year you came to IYF Delhi"
        error={fe.connectedSince} hint="Your IYF ID carries this year. It can be set once." />
    {/if}
    <Seg id="pf-cd" label="Which class do you attend?" options={CLASS_DAYS} value={f.classDay} onchange={(v) => (f.classDay = v)} error={fe.classDay} />
    <div class="pair">
      <DateInput id="pf-dob" label="Date of birth" bind:value={f.dob} error={fe.dob} />
      <WheelSelect id="pf-bg" label="Blood group" bind:value={f.bloodGroup} options={BLOOD_GROUPS} error={fe.bloodGroup} />
    </div>
  {/snippet}
  {#snippet contactView()}{@render row('Email', p.email)}{@render row('WhatsApp', p.whatsapp)}{/snippet}
  {#snippet contactForm()}
    <TextInput id="pf-email" label="Email" type="email" inputmode="email" bind:value={f.email} error={fe.email} autocomplete="email" autocapitalize="none" spellcheck="false" />
    <TextInput id="pf-wa" label="WhatsApp number" optional type="tel" inputmode="numeric" maxlength="13" bind:value={f.whatsapp} error={fe.whatsapp} autocomplete="off" />
  {/snippet}
  {#snippet addressView()}{@render row('Address', p.address ? addressLine(p.address) : '')}{/snippet}
  {#snippet addressForm()}<AddressFields bind:a={f.addr} {fe} prefix="address" idp="pf-ad" />{/snippet}
  {#snippet emergencyView()}{@render row('Name', p.emergency?.name)}{@render row('Relation', p.emergency?.relation)}{@render row('Mobile', p.emergency?.phone)}{/snippet}
  {#snippet emergencyForm()}
    <TextInput id="pf-emn" label="Name" bind:value={f.emName} error={fe['emergency.name']} autocomplete="off" maxlength="60" />
    <div class="pair">
      <WheelSelect id="pf-emr" label="Relation" bind:value={f.emRelation} options={f.emRelation && !RELATIONS.includes(f.emRelation) ? [...RELATIONS, f.emRelation] : RELATIONS} error={fe['emergency.relation']} />
      <TextInput id="pf-emp" label="Mobile" type="tel" inputmode="numeric" maxlength="10" bind:value={f.emPhone} error={fe['emergency.phone']} autocomplete="off" />
    </div>
  {/snippet}

  {#snippet facilitatorView()}{@render row('Your facilitator', p.facilitator)}{/snippet}
  {#snippet facilitatorForm()}
    <!-- a name the head has switched off stays shown while it is still this devotee's own -->
    <WheelSelect id="pf-fac" label="Your facilitator" bind:value={f.facilitator} options={f.facilitator && !facList.includes(f.facilitator) ? [...facList, f.facilitator] : facList}
      placeholder="Choose your facilitator" error={fe.facilitator} hint="If your facilitator has changed, choose the new one." />
  {/snippet}

  <!-- a login with no sadhana of its own (team, facilitator, head) keeps only the photo and contact details (8 Oct 2026) -->
  {#if isDevotee}{@render sec('about', 'heart', aboutView, aboutForm)}{/if}
  {@render sec('contact', 'msg', contactView, contactForm)}
  {#if isDevotee}
    {@render sec('address', 'home', addressView, addressForm)}
    {@render sec('emergency', 'phone', emergencyView, emergencyForm)}
    {@render sec('facilitator', 'users', facilitatorView, facilitatorForm)}
  {/if}
  {#if p.trainings?.length}
    <!-- the trainings they have been through: a finished one stays here as a record (the head, 18 Oct 2026) -->
    <section class="section" aria-labelledby="h-tr">
      <h3 id="h-tr"><Icon name="up" />Trainings</h3>
      <ul class="pf-trl">
        {#each p.trainings as tr (tr.batchId)}
          <li><strong>{tr.name}</strong>
            {#if tr.running}<span class="pill" data-tone="info">Running</span>{:else}<span class="pill">Finished{tr.finishedOn ? ' ' + fmtDate(tr.finishedOn) : ''}</span>{/if}
            {#if tr.average !== null}<span class="text-sm text-muted">Seva {tr.average}% · {tr.filled} of {tr.weeks} weeks</span>{/if}</li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  .pf-trl { display: grid; gap: var(--sp-2); margin: 0; padding: 0; list-style: none; }
  .pf-trl li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
</style>
