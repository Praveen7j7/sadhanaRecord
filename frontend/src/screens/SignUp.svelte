<script>
  import { tick } from 'svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import { call, normalizePhone, errorMessage, fieldErrors, ApiError } from '../lib/api.js';
  import { cachedMeta, loadMeta } from '../lib/meta.js';
  import { BLOOD_GROUPS, RELATIONS, SKILLS, signUpErrors, isMinor } from '../lib/validate.js';
  import Checkbox from '../ui/Checkbox.svelte';
  import MultiSelect from '../ui/MultiSelect.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import { CLASS_DAYS, normWhatsapp, emailProblem } from '../lib/contact.js';
  import { cleanAddress } from '../lib/address.js';
  import AddressFields from '../ui/AddressFields.svelte';
  import Seg from '../ui/Seg.svelte';
  import Plain from '../ui/Plain.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import FormSection from '../ui/FormSection.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import SlowHint from '../ui/SlowHint.svelte';

  let batches = $state([]);
  let facilitators = $state([]);   // the dashboard's canonical names (decision 33): picked, never typed
  let metaError = $state('');
  let f = $state({ phone: '', name: '', email: '', waSame: null, whatsapp: '', batchId: '', classDay: '', facilitator: '', password: '', confirm: '', dob: '', bloodGroup: '', emName: '', emRelation: '', emPhone: '', parentName: '', parentPhone: '', parentAgreed: false, privacy: false, addr: { line: '', area: '', city: '', state: 'Delhi', pin: '' }, profession: '', skills: [], connectedSince: '' });
  // a gentle hint while typing: a likely typo of a big mail provider ("Did you mean …@gmail.com?")
  const emailHint = $derived(/@.+\./.test(f.email) && /^Did you mean/.test(emailProblem(f.email)) ? emailProblem(f.email) : '');
  let busy = $state(false);
  // Sign-up step 1 (the user, 11 Oct 2026): a devotee who has been with IYF Delhi for years is already in our
  // records. As soon as the number is typed we say we recognise them, so they know their history is waiting and
  // do not make a second record. Only a MASKED name comes back — the endpoint is public and there is no OTP, so
  // whoever typed the number is not yet known to be its owner; the record itself is matched server-side and
  // applied when a coordinator approves.
  let known = $state(null);        // { maskedName, connectedSinceLocked } once recognised
  let hasAccount = $state(false);  // already signed up: send them to sign in, never a second account
  let looking = $state(false);
  let lookedUp = '';
  async function lookupPhone() {
    const phone = normalizePhone(f.phone);
    if (!/^\d{10}$/.test(phone) || phone === lookedUp) return;
    lookedUp = phone; looking = true;
    try {
      const r = await call('auth.lookup', { phone });
      hasAccount = !!r.hasAccount;
      known = r.found ? { maskedName: r.maskedName, connectedSinceLocked: !!r.connectedSinceLocked } : null;
    } catch { known = null; hasAccount = false; }   // never block sign-up because the lookup failed
    finally { looking = false; }
  }
  let error = $state('');
  let fe = $state({});
  let done = $state(false);
  // four steps (Phase 3, 8 Oct 2026): about you · batch and class · address · emergency contact and password. Each step
  // is checked before the next; the answers (never the passwords) are kept on this phone as a draft until sent.
  const STEPS = ['About you', 'Your batch and class', 'Your address', 'Emergency contact and password'];
  // With IYF Delhi since: a YEAR only (the user, 11 Oct 2026 — the IYF ID carries the year, IYFD-2019-0044, and the
  // old journals only ever recorded a year): this year back to 1990, newest first
  const SINCE_YEARS = (() => { const y = new Date().getFullYear(), out = []; for (let k = y; k >= 1990; k--) out.push([String(k), String(k)]); return out; })();
  const KEYS = [['phone', 'waSame', 'whatsapp', 'name', 'email', 'profile.dob', 'profile.bloodGroup', 'parentConsent'], ['batchId', 'classDay', 'facilitator', 'profile.profession', 'profile.skills', 'profile.connectedSince'],
    ['profile.address'], ['profile.emergency', 'password', 'confirm', 'privacy']];
  const stepOf = (k) => Math.max(0, KEYS.findIndex((ks) => ks.some((p) => k === p || k.startsWith(p + '.'))));
  let step = $state(0);
  // The furthest step reached, so a person can go back and look at what they filled without losing
  // their place. Going BACK is always allowed; going forward still has to pass that step's checks,
  // which is why this is not simply "any step" (the head, 18 Oct 2026).
  let seen = $state(0);
  $effect(() => { if (step > seen) seen = step; });
  const DRAFT = 'sr.signupDraft';
  try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d) { Object.assign(f, d.f, { password: '', confirm: '' }); step = Math.min(d.step || 0, 3); seen = step; } } catch { /* no draft */ }
  $effect(() => { const { password, confirm, ...keep } = f; const s = JSON.stringify({ f: keep, step }); if (!done) try { localStorage.setItem(DRAFT, s); } catch { /* storage blocked */ } });
  function check(all) {
    const phone = normalizePhone(f.phone), emPhone = normalizePhone(f.emPhone), parentPhone = normalizePhone(f.parentPhone);
    const whatsapp = f.waSame ? phone : normWhatsapp(f.whatsapp);
    const e = signUpErrors({ ...f, phone, emPhone, whatsapp, parentPhone });
    return all ? e : Object.fromEntries(Object.entries(e).filter(([k]) => stepOf(k) === step));
  }
  async function next() {
    fe = check(false); error = '';
    if (Object.keys(fe).length) { await tick(); document.getElementById('su-form')?.querySelector('[aria-invalid="true"]')?.focus(); return; }
    step++; await tick(); document.getElementById('su-step-h')?.focus();
  }
  async function prev() { fe = {}; error = ''; step--; await tick(); document.getElementById('su-step-h')?.focus(); }
  // Jump to a step already reached. Backwards only: moving forward still goes through next(), which
  // checks the step being left, so this can never skip a required field.
  async function goStep(i) {
    if (i > seen || i === step) return;
    fe = {}; error = ''; step = i; await tick(); document.getElementById('su-step-h')?.focus();
  }

  // meta.get is public: show the last copy instantly, refresh in the background.
  // Through lib/meta.js, which owns sr.meta (13 Oct 2026, audit FE-6): this screen used to write that key itself
  // with only { batches, facilitators }, dropping the classDays the rest of the app reads from it.
  { const m = cachedMeta(); batches = m.batches || []; facilitators = m.facilitators || []; }
  loadMeta()
    .then((d) => { batches = d.batches || []; facilitators = d.facilitators || []; })
    .catch((e) => { if (!batches.length) metaError = errorMessage(e); });


  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    error = '';
    const phone = normalizePhone(f.phone);
    const emPhone = normalizePhone(f.emPhone);
    const parentPhone = normalizePhone(f.parentPhone);
    const minor = isMinor(f.dob);
    const whatsapp = f.waSame ? phone : normWhatsapp(f.whatsapp);
    fe = signUpErrors({ ...f, phone, emPhone, whatsapp, parentPhone });
    if (Object.keys(fe).length) {
      step = Math.min(...Object.keys(fe).map(stepOf)); await tick();
      document.getElementById('su-form')?.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    busy = true;
    try {
      await call('auth.signUp', {
        phone, name: f.name.trim(), email: f.email.trim().toLowerCase(), whatsapp, batchId: f.batchId, classDay: f.classDay, facilitator: f.facilitator, password: f.password,
        profile: { dob: f.dob, bloodGroup: f.bloodGroup, emergency: { name: f.emName.trim(), relation: f.emRelation, phone: emPhone },
                   address: cleanAddress(f.addr),
                   profession: f.profession.trim(), skills: f.skills, connectedSince: f.connectedSince },
        consentPhoto: false,
        privacyConsent: true,
        ...(minor ? { parentConsent: { name: f.parentName.trim(), phone: parentPhone } } : {}),
      });
      f.password = f.confirm = '';
      done = true;
      try { localStorage.removeItem(DRAFT); } catch { /* storage blocked */ }
    } catch (err) {
      fe = fieldErrors(err);
      if (Object.keys(fe).length) step = Math.min(...Object.keys(fe).map(stepOf));
      error = err instanceof ApiError && err.code === 'VALIDATION' && Object.keys(fe).length ? 'Please fix the marked fields.' : errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet side()}
  <p class="side-note">What happens next</p>
  <ol class="side-steps"><li>You send your details (about 3 minutes).</li><li>Your batch's coordinator approves you, usually within a day.</li><li>You sign in and fill your first day.</li></ol>
{/snippet}
<Plain title={done ? 'Sign-up sent' : 'Create your account'} wide {side}>
  {#if done}
    <EmptyState icon="ok" title="Waiting for your coordinator's approval">
      You can sign in once it is approved. Your details are saved; there is no need to sign up again.
      {#snippet action()}<a class="btn btn-primary" href="#/login">Back to sign in</a>{/snippet}
    </EmptyState>
  {:else}
    {#if error}<Banner>{error}</Banner>{/if}
    {#if metaError}<Banner>{metaError}</Banner>{/if}
    <!-- Tap any step already reached to go straight back to it, instead of pressing Back three times
         (the head, 18 Oct 2026). A step not yet reached is disabled, not hidden, so the shape of the
         form stays the same from the first screen to the last. -->
    <nav class="su-prog" aria-label="Sign-up steps">
      {#each STEPS as name, i}
        <button type="button" class="su-dot" class:on={i <= step} disabled={i > seen}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${name}${i > seen ? ' (not reached yet)' : ''}`}
                onclick={() => goStep(i)}><i></i></button>
      {/each}
    </nav>
    <h3 id="su-step-h" class="su-step" tabindex="-1">Step {step + 1} of 4 <span class="sr-only">· {STEPS[step]}</span></h3>
    <form id="su-form" onsubmit={step === 3 ? submit : (e) => { e.preventDefault(); next(); }} novalidate>
      <div hidden={step !== 0}>
      <FormSection title="About you" icon="user">
        <TextInput id="su-phone" label="Mobile number" bind:value={f.phone} error={fe.phone} type="tel" inputmode="numeric" autocomplete="tel-national" onblur={lookupPhone} />
        {#if looking}<p id="su-looking" class="su-known muted">Checking our records…</p>{/if}
        {#if hasAccount}
          <Banner>This number already has an account. <a href="#/login">Sign in</a>, or use <a href="#/forgot">Forgot password</a>.</Banner>
        {:else if known}
          <p id="su-known" class="su-known">We have you in our records as <strong>{known.maskedName}</strong>. Fill in the form and your facilitator will see your history once a coordinator approves you.</p>
        {/if}
        <!-- asked right after the number (the head, 4 Oct 2026) -->
        <Seg id="su-wa-q" label="Is this number on WhatsApp?" options={[[true, 'Yes'], [false, 'No']]} value={f.waSame} onchange={(v) => (f.waSame = v)} error={fe.waSame} />
        {#if f.waSame === false}<TextInput id="su-wa" label="Your WhatsApp number" optional bind:value={f.whatsapp} error={fe.whatsapp} type="tel" inputmode="numeric" autocomplete="off" />{/if}
        <TextInput id="su-name" label="Full name" bind:value={f.name} error={fe.name} autocomplete="name" />
        <TextInput id="su-email" label="Email" type="email" inputmode="email" bind:value={f.email} error={fe.email} hint={emailHint} autocomplete="email" autocapitalize="none" spellcheck="false" />
        <div class="pair">
          <DateInput id="su-dob" label="Date of birth" bind:value={f.dob} error={fe['profile.dob']} autocomplete="bday" />
          <WheelSelect id="su-bg" label="Blood group" bind:value={f.bloodGroup} options={BLOOD_GROUPS} error={fe['profile.bloodGroup']} />
        </div>
      </FormSection>
      {#if isMinor(f.dob)}
        <!-- 15–17: a parent or guardian agrees to the sign-up (DPDP Act 2023; IYF, 8 Oct 2026) -->
        <FormSection title="Parent or guardian" icon="shield">
          <p class="hint mt-0">You are under 18, so a parent or guardian must agree to your sign-up. Your coordinator may call them.</p>
          <div class="pair">
            <TextInput id="su-pn" label="Their name" bind:value={f.parentName} error={fe['parentConsent.name']} autocomplete="off" />
            <TextInput id="su-pp" label="Their mobile" bind:value={f.parentPhone} error={fe['parentConsent.phone']} type="tel" inputmode="numeric" autocomplete="off" />
          </div>
          <Checkbox id="su-pa" bind:checked={f.parentAgreed} label="My parent or guardian agrees to this sign-up" aria-invalid={fe['parentConsent.agreed'] ? 'true' : undefined} aria-describedby={fe['parentConsent.agreed'] ? 'su-pa-e' : undefined} />
          <ValidationMessage id="su-pa-e" error={fe['parentConsent.agreed']} />
        </FormSection>
      {/if}
      </div>
      <div hidden={step !== 1}>
      <FormSection title="Your batch and class" icon="users">
        <WheelSelect id="su-batch" label="Batch" bind:value={f.batchId} options={batches.map((b) => [b.batchId, b.name])} placeholder="Choose your batch" error={fe.batchId}
          hint={batches.find((b) => b.batchId === f.batchId)?.coordinatorName ? 'Coordinator: ' + batches.find((b) => b.batchId === f.batchId).coordinatorName : ''} />
        <Seg id="su-cd" label="Which class do you attend?" options={CLASS_DAYS} value={f.classDay} onchange={(v) => (f.classDay = v)} error={fe.classDay} />
        <WheelSelect id="su-fac" label="Your facilitator" bind:value={f.facilitator} options={facilitators} placeholder="Choose your facilitator" error={fe.facilitator} />
      </FormSection>
      <!-- About you (the user, 10 Oct 2026): all optional — it helps a facilitator know you, nothing more -->
      <FormSection title="A little about you" icon="heart">
        <p class="hint mt-0">Optional. It helps your facilitator know you a little before you meet.</p>
        <WheelSelect id="su-since" label="With IYF Delhi since" bind:value={f.connectedSince} options={SINCE_YEARS}
          placeholder="Choose the year" error={fe['profile.connectedSince']}
          hint={known?.connectedSinceLocked ? 'We already hold this year, and your IYF ID is built from it. A coordinator can change it if it is wrong.' : 'Just joining? Choose this year.'} />
        <TextInput id="su-occ" label="Profession" optional bind:value={f.profession} error={fe['profile.profession']}
          hint="Studying, working — and in what" maxlength="80" autocomplete="off" />
        <MultiSelect id="su-skills" label="Skills you can offer" optional options={SKILLS} bind:value={f.skills}
          error={fe['profile.skills']} hint="Any seva you could help with. Choose as many as you like." />
      </FormSection>
      </div>
      <div hidden={step !== 2}>
      <FormSection title="Your address" icon="home">
        <AddressFields bind:a={f.addr} {fe} prefix="profile.address" idp="su-ad" />
      </FormSection>
      </div>
      <div hidden={step !== 3}>
      <FormSection title="Password" icon="lock">
        <div class="pair">
          <TextInput id="su-pw" label="Password" type="password" bind:value={f.password} error={fe.password} hint="8 to 64 characters" autocomplete="new-password" />
          <TextInput id="su-pw2" label="Confirm password" type="password" bind:value={f.confirm} error={fe.confirm} autocomplete="new-password" />
        </div>
      </FormSection>
      <FormSection title="Emergency contact" icon="phone">
        <TextInput id="su-en" label="Name" bind:value={f.emName} error={fe['profile.emergency.name']} />
        <div class="pair">
          <WheelSelect id="su-er" label="Relation" bind:value={f.emRelation} options={RELATIONS} error={fe['profile.emergency.relation']} />
          <TextInput id="su-ep" label="Mobile" bind:value={f.emPhone} error={fe['profile.emergency.phone']} type="tel" inputmode="numeric" />
        </div>
      </FormSection>
      <Checkbox id="su-priv" bind:checked={f.privacy} card={false} aria-invalid={fe.privacy ? 'true' : undefined} aria-describedby={fe.privacy ? 'su-priv-e' : undefined}>
        I have read the <a class="link" href="/privacy.html" target="_blank" rel="noopener">privacy policy<span class="sr-only"> (opens in a new tab)</span></a> and agree that IYF Delhi keeps these details for my batch.
      </Checkbox>
      <ValidationMessage id="su-priv-e" error={fe.privacy} />
      </div>
      <div class="su-nav">
        {#if step > 0}<button type="button" class="btn btn-outline su-back" onclick={prev}>Back</button>{/if}
        {#if step < 3}<Button variant="primary" type="submit">Next</Button>{:else}<Button variant="primary" type="submit" {busy}>Sign up</Button>{/if}
      </div>
      <SlowHint {busy} />
    </form>
    <p class="m-0 mt-2 text-center"><a class="link" href="#/login">I already have an account</a></p>
  {/if}
</Plain>
