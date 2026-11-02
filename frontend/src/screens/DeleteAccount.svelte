<script>
  // Account › Delete account (devotees only: staff ask the IYF head to remove their role first). Loaded only when the
  // button is pressed. The password and the word DELETE confirm it; the server deletes the account, keeps the submitted
  // weeks without the name, phone or IYF ID (worker/src/erase.js) and ends every session. This phone then forgets the
  // person, with no server call (the session is already gone), and shows the welcome screen.
  // The public page /delete-account.html says the same for anyone outside the app (Google Play).
  import Sheet from '../ui/Sheet.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { session, endHere } from '../lib/session.svelte.js';
  import { forgetLogin } from '../lib/forget.js';
  import { go } from '../lib/router.svelte.js';
  import { toast } from '../lib/pro.svelte.js';

  let sheet = $state(), pw = $state(''), word = $state(''), busy = $state(false), fe = $state({}), error = $state('');
  const ready = $derived(!!pw && !!word.trim());
  export function open() { pw = word = ''; fe = {}; error = ''; sheet.showModal(); }

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    busy = true; fe = {}; error = '';
    const login = session.user?.login || '';
    try {
      await call('account.delete', { password: pw, confirm: word });
    } catch (x) {
      busy = false;
      const m = fieldErrors(x);
      if (x.code === 'BAD_CREDENTIALS') fe = { password: x.message || 'Your password is wrong.' };
      else if (m.password || m.confirm) fe = m;
      else error = x.code === 'BUSY' && x.message ? x.message : errorMessage(x);
      return;
    }
    // deleted: forget the person on this phone. The welcome screen takes the sheet's Back entry (lib/router go), and
    // endHere() signs out in the same moment, so the app never sends a signed-out person anywhere else.
    await forgetLogin(login);
    go('/welcome', true);
    const out = endHere();
    toast('Your account has been deleted.');
    await out;
  }
</script>

<Sheet bind:this={sheet} titleId="da-t" title="Delete your account?" dismiss={false} class="da-sheet">
  <form onsubmit={submit} novalidate>
    <div class="da-what text-sm">
      <h3>Deleted</h3>
      <p>Your account and password, your profile and photo, days you haven't submitted, your comments and likes, and the notifications set up for you on this phone.</p>
      <h3>Kept, without your name, phone number or IYF ID</h3>
      <p>The weeks you submitted and your attendance, so your batch's past totals don't change.</p>
      <p class="da-warn"><b>This can't be undone.</b></p>
    </div>
    {#if error}<Banner>{error}</Banner>{/if}
    <TextInput id="da-pw" label="Your password" type="password" bind:value={pw} error={fe.password} autocomplete="current-password" />
    <TextInput id="da-word" label="Type DELETE to confirm" bind:value={word} error={fe.confirm} autocomplete="off" autocapitalize="characters" spellcheck="false" />
    <div class="mt-1 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" disabled={busy} onclick={() => sheet.close()}>Cancel</button>
      <Button type="submit" variant="danger-solid" {busy} disabled={!ready}>{busy ? 'Deleting…' : 'Delete account'}</Button>
    </div>
  </form>
</Sheet>

<style>
  .da-what { margin: var(--sp-2) 0 var(--sp-4); }
  .da-what h3 { margin: var(--sp-3) 0 2px; font-size: var(--fs-sm); font-weight: 650; }
  .da-what h3:first-child { margin-top: 0; }
  .da-what p { margin: 0; color: var(--text-muted); }
  .da-what .da-warn { margin-top: var(--sp-3); color: var(--danger); }
</style>
