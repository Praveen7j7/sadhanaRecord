<script>
  import Button from '../ui/Button.svelte';
  import '../styles/screens.css';
  import { session, logout, keepSession } from '../lib/session.svelte.js';
  import { APP_BUILD } from '../lib/build.js';
  import { cachedMeta } from '../lib/meta.js';
  import { scopesOf, canRequests } from '../lib/scopes.js';
  import ChangePassword from './ChangePassword.svelte';
  import Icon from '../ui/Icon.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Banner from '../ui/Banner.svelte';
  import Reminder from '../ui/Reminder.svelte';
  import { route, go } from '../lib/router.svelte.js';
  import { fmtDateTime } from '../lib/validate.js';
  import { lazy } from '../lib/lazy.js';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { patch, entry, load } from '../lib/cache.svelte.js';
  import { toast } from '../lib/pro.svelte.js';
  import TextInput from '../ui/TextInput.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import { tick, untrack } from 'svelte';
  const u = $derived(session.user);
  const sc = $derived(scopesOf(u));
  const howto = $derived(route.path.includes('f=howto'));
  let pwDlg = $state(), howDlg = $state(), HowTo = $state(null);
  // The devices this account is signed in on. Loaded when the sheet is opened, not on every visit
  // to Account: most people never look, and it is one more query on a screen that already makes
  // several (18 Oct 2026).
  let devDlg = $state(), devices = $state(null), devCount = $state(null), devErr = $state(''), devBusy = $state('');
  /* Through the shared read cache (22 Oct 2026, G23): the count kept from the last visit shows at once and is asked
     again only when over two minutes old — it was asked on every visit. Opening the list, or signing a device out,
     always asks: that is when the person is looking at exactly this. */
  const devE = entry('auth.sessions');
  // this device first, then the rest by when they were last used (the server orders those)
  const showDevices = (d) => { devices = [...d.devices].sort((a, b) => Number(b.thisOne) - Number(a.thisOne)); devCount = d.devices.length; };
  if (devE.data) showDevices(devE.data);
  async function loadDevices(force = false) {
    devErr = '';
    const d = await load('auth.sessions', () => call('auth.sessions'), { force });
    if (d) showDevices(d);
    else if (devE.error) { devErr = errorMessage(devE.error); devices = null; }
  }
  // the count on the row itself, as soon as Account opens: "Signed in on 3 devices" is the thing to notice, and it
  // should not need a tap to find (the head, 18 Oct 2026). One small read, on a screen people open rarely.
  $effect(() => { untrack(() => loadDevices().catch(() => {})); });
  async function openDevices() { devices = null; devDlg?.showModal(); await loadDevices(true); }
  // every device at once, this one included (auth.logoutAll — ADR 0017): asked twice, because it signs this phone out too
  let allConfirm = $state(false), allBusy = $state(false);
  async function endAll() {
    if (!allConfirm) { allConfirm = true; return; }
    allBusy = true; devErr = '';
    try {
      await call('auth.logoutAll');
      devDlg?.close(); await (await import('../lib/session.svelte.js')).endHere(); go('/welcome'); return;
    } catch (e) { devErr = errorMessage(e); }
    allBusy = false;
  }
  async function endDevice(x) {
    devBusy = x.id; devErr = '';
    try {
      const r = await call('auth.sessionEnd', { id: x.id });
      // signing THIS device out is a plain log-out: the token is gone, so leave rather than sit on
      // a screen whose every call would now be refused
      if (r.thisOne) { devDlg?.close(); await (await import('../lib/session.svelte.js')).endHere(); go('/welcome'); return; }
      toast(`${x.device} signed out.`);
      await loadDevices(true);
    } catch (e) { devErr = errorMessage(e); }
    devBusy = '';
  }
  // How to use loads with its sheet; #/account?f=howto (the menu, the ? key) opens it at once
  let howReady = $state(null);                    // the import promise, so opening can await it
  $effect(() => { howReady ||= import('./HowTo.svelte').then((m) => (HowTo = m.default)); });
  // Open only once the content is in and rendered (9 Oct 2026, Phase 9): opening first made the sheet animate
  // while HowTo was still loading, so it resized mid-animation and looked like a jump.
  async function openHow() { await (howReady ||= import('./HowTo.svelte').then((m) => (HowTo = m.default))); await tick(); howDlg?.showModal(); }
  $effect(() => { if (howto && howDlg) openHow(); });
  const names = $derived((u?.batchIds || []).map((id) => (cachedMeta().batches || []).find((b) => b.batchId === id)?.name || id));
  const initial = $derived((u?.name || '?').trim().charAt(0).toUpperCase());
  // one's own name, every role (the head, 4 Oct 2026)
  let naming = $state(false), newName = $state(''), nameErr = $state(''), nameBusy = $state(false);
  async function saveName(e) {
    e.preventDefault();
    if (nameBusy) return;
    nameBusy = true; nameErr = '';
    try {
      const r = await call('profile.update', { name: newName });
      if (session.user) session.user = { ...session.user, name: r.name };
      keepSession();                        // kept on this phone too, so the next start (even offline) greets them by it
      patch('profile.get', () => r);
      naming = false; toast('Name saved.');
    } catch (x) { nameErr = fieldErrors(x).name || errorMessage(x); }
    nameBusy = false;
  }
  const roles = $derived([sc.devotee && 'Devotee', sc.groupLeader && 'Group leader', sc.facilitator && 'Facilitator', sc.coordinator.length && 'Coordinator', sc.master && 'IYF head'].filter(Boolean));
  // deleting one's account (devotees; a group leader too): the sheet's file loads only when the button is pressed.
  // Staff and facilitators have their role removed by the IYF head first (the server says the same).
  const staffRole = $derived(sc.master ? 'IYF head' : sc.coordinator.length ? 'coordinator' : sc.facilitator ? 'facilitator' : '');
  let Del = $state(null), delSheet = $state(), delBusy = $state(false);
  async function openDelete() {
    if (delBusy) return;
    delBusy = true;
    try { Del ||= (await lazy(() => import('./DeleteAccount.svelte'))).default; await tick(); delSheet?.open(); }
    catch { toast('Could not open this. Check your connection and try again.', { kind: 'err' }); }
    delBusy = false;
  }
</script>

<!-- a settings area, not a dashboard: who you are on one side, how the app behaves for you on the other -->
<div class="grid2">
  <div>
    <h2 class="acc-h t-over">Profile</h2>
    <section class="section acc-hero" aria-labelledby="acc-name">
      <div class="flex items-center gap-4">
        <!-- the profile photo once set (the same picture as the menu and the Photo card), else the initial -->
        {#if u?.photoAt}{#await Promise.all([import('../ui/Photo.svelte'), import('../ui/PhotoZoom.svelte')]) then [P, Z]}<Z.default login={u.login} name={u.name} own updatedAt={u.photoAt}><span class="avatar avatar-photo h-16 w-16"><P.default login={u.login} name={u.name} hasPhoto own updatedAt={u.photoAt} size={64} /></span></Z.default>{:catch}<span class="avatar h-16 w-16 text-2xl" aria-hidden="true">{initial}</span>{/await}
        {:else}<span class="avatar h-16 w-16 text-2xl" aria-hidden="true">{initial}</span>{/if}
        <div class="min-w-0 flex-1">
          <h3 id="acc-name" class="t-h2 m-0 flex items-center gap-1 break-words">{u?.name}{#if !naming}<IconButton icon="edit" size={18} label="Change your name" onclick={() => { newName = u?.name || ''; nameErr = ''; naming = true; }} />{/if}</h3>
          <p class="m-0 mt-1 flex flex-wrap gap-1">{#each roles as r}<span class="pill" data-tone="info">{r}</span>{/each}</p>
        </div>
      </div>
      <!-- changing one's name: its own full-width row under the photo (the card around it never moves) -->
      {#if naming}
        <form class="acc-rename" onsubmit={saveName}>
          <TextInput id="acc-name-in" label="Your name" class="mb-2" bind:value={newName} error={nameErr} autocomplete="name" maxlength="60" />
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-outline" onclick={() => (naming = false)} disabled={nameBusy}>Cancel</button>
            <button type="submit" class="btn btn-primary" disabled={nameBusy || !newName.trim()}>{nameBusy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      {/if}
      <dl class="kv mt-4">
        <dt>Login</dt><dd class="break-all">{u?.login || '—'}</dd>
        <dt>{names.length > 1 ? 'Batches' : 'Batch'}</dt><dd>{names.join(', ') || (sc.facilitator ? 'TRD (temple resident)' : '—')}</dd>
      </dl>
    </section>

    <!-- photo and profile: their own small file, loaded with this screen -->
    <!-- a phone: the profile (photo and four sections, always taller than the screen) loads after the name card; its
         space is kept so the Settings below never jump (CLS 0) -->
    <div class="acc-prof">
    {#await lazy(() => import('./Profile.svelte'))}
      <Skeleton rows={2} />
    {:then m}
      <m.default />
    {:catch}
      <Banner onretry={() => location.reload()} retryLabel="Reload">Could not load your profile. Check your connection and reload.</Banner>
    {/await}
    </div>
  </div>

  <div>
    <h2 class="acc-h t-over">Settings</h2>
    <section class="section" aria-labelledby="h-rem">
      <h3 id="h-rem"><Icon name="bell" />Notifications</h3>
      <Reminder />
    </section>

    <!-- the rest as rows, each opening a sheet (8 Oct 2026: the page was 2,900 px long) -->
    <ul class="list acc-rows" aria-label="Settings">
      <li><button type="button" class="lrow w-full text-left" aria-haspopup="dialog" onclick={() => pwDlg.showModal()}><Icon name="lock" size={20} /><span class="lmain"><span class="lt">Change password</span></span><Icon name="next" size={18} /></button></li>
      <!-- Where this account is signed in, and ending any one of it from here (the head, 18 Oct 2026).
           Beside Change password: both are what somebody opens when they are worried about their
           account, and one is useless without the other. -->
      <li><button type="button" class="lrow w-full text-left" aria-haspopup="dialog" onclick={openDevices}><Icon name="phone" size={20} /><span class="lmain"><span class="lt">Devices</span>{#if devCount !== null}<span class="ls">{devCount === 1 ? 'Signed in on this device only' : `Signed in on ${devCount} devices`}</span>{/if}</span><Icon name="next" size={18} /></button></li>
      <li><button type="button" class="lrow w-full text-left" aria-haspopup="dialog" onclick={openHow}><Icon name="info" size={20} /><span class="lmain"><span class="lt">How to use</span></span><Icon name="next" size={18} /></button></li>
      <li><a class="lrow" href="/privacy.html" target="_blank" rel="noopener"><Icon name="shield" size={20} /><span class="lmain"><span class="lt">Privacy policy</span></span><Icon name="open" size={16} /><span class="sr-only"> (opens in a new tab)</span></a></li>
      <li><a class="lrow" href="/delete-account.html" target="_blank" rel="noopener"><Icon name="open" size={20} /><span class="lmain"><span class="lt">What happens to my data</span></span><Icon name="open" size={16} /><span class="sr-only"> (opens in a new tab)</span></a></li>
      <!-- app stores require deleting the account in the app -->
      <li id="h-del">
        {#if staffRole}
          <div class="lrow"><Icon name="trash" size={20} /><span class="lmain"><span class="lt">Delete account</span><span class="ls">You're {staffRole === 'IYF head' ? 'an' : 'a'} {staffRole}. {staffRole === 'IYF head' ? 'Ask another IYF head' : 'Ask the IYF head'} to remove your role first; then you can delete your account here.</span></span></div>
        {:else}
          <button type="button" class="lrow w-full text-left acc-del" aria-busy={delBusy || undefined} onclick={openDelete}><Icon name="trash" size={20} /><span class="lmain"><span class="lt">Delete my account…</span><span class="ls">Your submitted weeks stay in your batch's totals without your name.</span></span><Icon name="next" size={18} /></button>
        {/if}
      </li>
    </ul>
    {#if Del}<Del bind:this={delSheet} />{/if}

    <Sheet bind:this={pwDlg} titleId="h-pw" title="Change password" dismiss={false}><ChangePassword /></Sheet>
    <Sheet bind:this={devDlg} titleId="h-dev" title="Devices" sub="Where this account is signed in" onclose={() => (allConfirm = false)}>
      {#if devErr}<Banner>{devErr}</Banner>{/if}
      {#if !devices && !devErr}<Skeleton kind="list" rows={3} />
      {:else if devices}
        <ul class="list dev-list" aria-label="Devices">
          {#each devices as x (x.id)}
            <li class="dev-row">
              <span class="dev-who">
                <span class="dev-name">{x.device}{x.thisOne ? ' · this device' : ''}</span>
                <span class="dev-sub">Last used {fmtDateTime(x.lastUsedAt)}</span>
              </span>
              <button type="button" class="btn btn-sm btn-text" disabled={devBusy === x.id} onclick={() => endDevice(x)}>
                {x.thisOne ? 'Log out' : 'Sign out'}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
          {#if devices}
        <div class="dev-all">
          {#if allConfirm}<p class="m-0 text-sm" role="alert">Every device signs out, this one too. You sign in again with your password.</p>{/if}
          <Button variant="danger" busy={allBusy} onclick={endAll}>{allConfirm ? 'Sign out everywhere now' : 'Sign out of every device'}</Button>
        </div>
      {/if}
    </Sheet>
    <Sheet bind:this={howDlg} titleId="h-how" title="How to use" wide onclose={() => { if (howto) history.replaceState(history.state, '', '#/account'); }}>{#if HowTo}<HowTo open="day" />{/if}</Sheet>

    <button type="button" class="btn btn-danger btn-block" onclick={logout}><Icon name="out" size={18} />Log out</button>
    <!-- the version this phone runs (same as /version.json on the server): how a store app is shown to be up to date -->
    <p class="app-build m-0 text-center text-xs text-muted">App {APP_BUILD}</p>
  </div>
</div>

<style>
  .dev-all { display: grid; gap: var(--sp-2); margin-top: var(--sp-4); padding-top: var(--sp-3); border-top: 1px solid var(--border); }
  /* the devices this account is signed in on (18 Oct 2026) */
  .dev-list { margin: 0; padding: 0; list-style: none; }
  .dev-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
             padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border); }
  .dev-row:last-child { border-bottom: 0; }
  .dev-who { display: grid; min-width: 0; }
  .dev-name { font-weight: 600; overflow-wrap: anywhere; }
  .dev-sub { color: var(--text-secondary); font-size: var(--fs-sm); }
  @media (max-width: 767px) { .acc-prof { min-height: 100svh; } }
  .acc-h { margin: var(--sp-2) 0 var(--sp-3); font-family: var(--font-sans); }
  .grid2 > div + div > .acc-h { margin-top: var(--sp-6); }
  @media (min-width: 768px) { .grid2 > div + div > .acc-h { margin-top: var(--sp-2); } }
  .app-build { margin-top: var(--sp-4); }
  .acc-rows { margin-bottom: var(--sp-5); }
  .acc-rows .lrow { min-height: 56px; background: none; border: 0; font: inherit; color: inherit; cursor: pointer; }
  .acc-del, .acc-del .lt { color: var(--danger); }
  .acc-rename { margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--border); }
</style>
