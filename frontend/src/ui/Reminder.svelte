<script>
  import '../styles/controls.css';
  // The 9 PM reminder on this phone: a switch (Account), or, on Home (ask), one button to allow notifications when the
  // browser's permission was never answered (the reminder itself is on by default). Permission is asked only from a tap. Explains what blocks it: an old browser, an iPhone not added to the Home Screen,
  // notifications blocked for this site.
  import { pushState, turnOn, turnOff, dismissAsk, ensureDevice } from '../lib/push.js';
  import { session } from '../lib/session.svelte.js';
  import { cachedMeta, loadMeta } from '../lib/meta.js';
  import { errorMessage } from '../lib/api.js';
  import { fmt12 } from '../lib/dates.js';
  import Icon from './Icon.svelte';
  let { ask = false } = $props();
  let state = $state('checking');
  let busy = $state(false), err = $state(''), done = $state(false), gone = $state(false);
  let push = $state(cachedMeta().push || null);
  loadMeta().then((m) => (push = m.push || null)).catch(() => {});
  // Account: when this phone shows On, make sure the server has it with the person signed in (re-links a phone whose
  // address the browser renewed, or one registered before signing in). One small call each time Account opens.
  // the check never hangs: after 4 s with no answer (the service worker still starting, a stuck browser) it says so
  const slow = setTimeout(() => { if (state === 'checking') state = 'slow'; }, 4000);
  pushState().then(async (s) => {
    clearTimeout(slow); state = s;
    if (!ask && s === 'on' && session.user?.login) { const m = push?.publicKey ? push : await loadMeta().then((x) => x.push).catch(() => null); ensureDevice(session.user.login, m?.publicKey, { force: true }); }
  });
  const time = $derived(fmt12(push?.time || '21:00').replace(':00', ''));
  const NOTE = {
    unsupported: "Your browser can't show reminders.",
    'ios-install': 'On iPhone: Share → Add to Home Screen, then open it from there.',
    denied: 'Notifications are blocked. Allow them in your browser settings.',
    slow: 'Could not check this phone. Close and reopen the app, then try again.',
  };
  async function set(on) {
    busy = true; err = '';
    try {
      state = on ? await turnOn(push?.publicKey) : await turnOff();
      if (ask && state === 'on') { done = true; dismissAsk(); }
    } catch (e) { err = e?.code ? errorMessage(e) : e?.message === 'NO_SW' ? 'Reminders work in the installed app or the published site, not here.' : e?.message || 'Could not change the reminder.'; }
    busy = false;
  }
  const notNow = () => { dismissAsk(); gone = true; };
</script>

{#if ask}
  {#if !gone && (state === 'off' || done)}
    <section class="today mb-4" aria-labelledby="rm-h">
      {#if done}
        <p class="m-0 flex items-center gap-2 font-semibold" role="status"><Icon name="ok" size={18} />Your {time} reminder is on. Hare Krishna!</p>
      {:else}
        <div class="flex items-start gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-brand"><Icon name="bell" size={18} /></span>
          <p id="rm-h" class="m-0 min-w-0 flex-1"><b class="block">Get the {time} reminder</b></p>
          <button type="button" class="btn btn-text btn-sm -mr-2 -mt-1" aria-label="Close" onclick={notNow}><Icon name="close" size={16} /></button>
        </div>
        {#if err}<p class="err" role="alert"><Icon name="alert" size={16} />{err}</p>{/if}
        <button type="button" class="btn btn-primary btn-block mt-3" disabled={busy} aria-busy={busy || undefined} onclick={() => set(true)}>{#if busy}<span class="spin" aria-hidden="true"></span>{/if}Allow notifications</button>
      {/if}
    </section>
  {/if}
{:else}
  <label class="toggle" class:opacity-70={NOTE[state]}>
    <span class="min-w-0"><span class="block font-medium">{time} reminder and announcements</span>
      {#if NOTE[state] || state === 'checking'}<span class="tdesc">{NOTE[state] || 'Checking…'}</span>{/if}</span>
    <input type="checkbox" role="switch" checked={state === 'on'} disabled={busy || state === 'checking' || !!NOTE[state]} aria-busy={busy || undefined} onchange={async (e) => { const el = e.currentTarget; await set(el.checked); el.checked = state === 'on'; }} />
    <span class="switch" aria-hidden="true"></span>
  </label>
  {#if err}<p class="err" role="alert"><Icon name="alert" size={16} />{err}</p>{/if}
{/if}
