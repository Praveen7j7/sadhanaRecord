<script>
  import { call, normalizeLogin, errorMessage } from '../lib/api.js';
  import { deviceLabel } from '../lib/device.js';
  import { startSession } from '../lib/session.svelte.js';
  import { go, withTransition } from '../lib/router.svelte.js';
  import { tick } from 'svelte';
  import Plain from '../ui/Plain.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import Icon from '../ui/Icon.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import SlowHint from '../ui/SlowHint.svelte';
  import { fmtDateTime } from '../lib/validate.js';

  let login = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');
  // signed out by the server (expired session): say so once
  let expired = $state((() => { try { const v = sessionStorage.getItem('sr.expired') === '1'; sessionStorage.removeItem('sr.expired'); return v; } catch { return false; } })());
  let fe = $state({});
  // a sign-up still waiting for approval is a calm status page, not a red error (8 Oct 2026); the server adds the
  // person's first name, batch and facilitator once the password is right
  let pending = $state(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    error = '';
    fe = {};
    if (!login.trim()) fe.login = 'Enter your phone or username';
    if (!password) fe.password = 'Enter your password';
    if (fe.login || fe.password) return;
    busy = true;
    try {
      const d = await call('auth.login', { login: normalizeLogin(login), password, device: deviceLabel() });
      password = '';
      // the hand-off from the royal sign-in to the person's own colours: a short crossfade (none with reduced motion)
      const enter = () => { startSession(d.token, d.user); go(target); return tick(); };
      let back = '';
      try { back = sessionStorage.getItem('sr.return') || ''; sessionStorage.removeItem('sr.return'); } catch { /* storage blocked */ }
      const target = d.user.mustChangePassword ? '/change-password' : back && !/^\/(welcome|login|signup|forgot)/.test(back) ? back : '/home';
      withTransition(enter);
    } catch (err) {
      if (err.code === 'PENDING_APPROVAL' || err.code === 'REJECTED') { const x = err.data?.details || err.data || {}; pending = { rejected: err.code === 'REJECTED', firstName: x.firstName || '', batchName: x.batchName || '', facilitatorName: x.facilitatorName || '', requestedAt: x.requestedAt || '', reason: x.reason || '' }; return; }
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
  // the verse of the day for the desktop panel (the same one as Welcome); loaded after the form, never in its way
  let q = $state(null);
  if (typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches)
    Promise.all([import('../lib/quotes.js'), import('../lib/dates.js')]).then(([m, d]) => (q = m.QUOTES[m.shortQuoteIndex(d.todayIST())])).catch(() => {});
</script>

<!-- the desktop panel carries the verse of the day, as on Welcome (the head, 9 Oct 2026: instead of a byline) -->
{#snippet side()}{#if q}<figure class="wl-quote wl-in-panel"><blockquote>&ldquo;{q[0]}&rdquo;</blockquote><figcaption><cite>{q[1]}</cite></figcaption></figure>{/if}{/snippet}
<Plain title={pending ? (pending.rejected ? 'Sign-up not approved' : 'Waiting for approval') : 'Sign in'} {side} sideReady={!!q}>
  {#if pending?.rejected}
    <!-- a sign-up the coordinator did not approve (Phase 3): calm words and a way forward, never a red error -->
    <div class="pending" role="status">
      <p class="mt-0">Hare Krishna{pending.firstName ? ', ' + pending.firstName : ''}. Your sign-up{pending.batchName ? ' for ' + pending.batchName : ''} was not approved{pending.reason ? ': ' + pending.reason : '.'}</p>
      <p>Please speak to your coordinator. You can send a new sign-up with the details corrected.</p>
      <a class="btn btn-primary" href="#/signup">Send a new sign-up</a>
      <button type="button" class="btn btn-text mt-2 w-full" onclick={() => { pending = null; password = ''; }}>Use another account</button>
    </div>
  {:else if pending}
    <div class="pending" role="status">
      <p class="mt-0">Hare Krishna{pending.firstName ? ', ' + pending.firstName : ''}. Your sign-up{pending.batchName ? ' for ' + pending.batchName : ''} is with your coordinator.</p>
      <ul class="m-0 mb-4 pl-5 text-sm">
        {#if pending.requestedAt}<li>Sent on {fmtDateTime(pending.requestedAt)}</li>{/if}
        {#if pending.facilitatorName}<li>Facilitator: {pending.facilitatorName}</li>{/if}
        <li>You can log in as soon as it is approved. There is no need to sign up again.</li>
      </ul>
      <Button variant="primary" {busy} onclick={(e) => { pending = null; submit(e); }}>Check again</Button>
      <button type="button" class="btn btn-text mt-2 w-full" onclick={() => { pending = null; password = ''; }}>Use another account</button>
    </div>
  {:else}
  {#if expired && !error}<Banner kind="info">You were signed out. Please sign in again.</Banner>{/if}
  {#if error}<Banner>{error}</Banner>{/if}
  <form onsubmit={submit} novalidate>
    <TextInput id="login" label="Phone or username" bind:value={login} error={fe.login} autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="text" />
    <TextInput id="password" label="Password" type="password" bind:value={password} error={fe.password} autocomplete="current-password" class="mb-1" />
    <p class="m-0 mb-4 text-right"><a class="link text-sm" href="#/forgot">Forgot password?</a></p>
    <Button variant="primary" type="submit" {busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    <SlowHint {busy} />
  </form>
  <div class="mt-2 flex items-center gap-3 text-sm text-muted" aria-hidden="true"><span class="h-px flex-1 bg-[var(--border)]"></span></div>
  <a class="btn btn-block mt-3" href="#/signup"><Icon name="plus" size={18} />Create an account</a>
  <!-- the two lines under Create an account, as on Welcome (the head, 22 Oct 2026) -->
  <p class="auth-foot auth-approve">New accounts require coordinator approval.</p>
  <p class="auth-trust"><Icon name="lock" size={14} />Your details stay private. · <a class="link" href="/privacy.html">Privacy</a></p>
  {/if}
</Plain>
