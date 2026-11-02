<script>
  /*
   * "I forgot my password" — decision 46 (the head, 14 Oct 2026), audit finding F1.
   *
   * This screen used to ask for the NEW PASSWORD. That was the finding: anyone who knew a devotee's phone
   * number could choose a password for an account that was not theirs and wait for a coordinator to approve
   * it. Now it asks for the phone number and nothing else — the server makes the password when the
   * coordinator approves, and the coordinator hands it over in person or on their own WhatsApp.
   */
  import { call, normalizeLogin, errorMessage } from '../lib/api.js';
  import Plain from '../ui/Plain.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Button from '../ui/Button.svelte';
  import Icon from '../ui/Icon.svelte';
  import Banner from '../ui/Banner.svelte';

  let login = $state('');
  let busy = $state(false);
  let error = $state('');
  let fe = $state({});
  let done = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = '';
    fe = {};
    const l = normalizeLogin(login);
    if (!l) { fe.login = 'Enter your phone or username'; return; }
    busy = true;
    try {
      await call('auth.requestReset', { login: l });
      done = true;
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<Plain title={done ? 'Request sent' : 'Forgot password'} back="#/login" backLabel="Back to log in">
  {#if done}
    <EmptyState icon="ok" title="Ask your coordinator for the password">
      Your coordinator will give you a temporary password to log in with. You will choose your own as soon as
      you are in. Until then your old password still works, if you remember it.
      {#snippet action()}<a class="btn btn-primary" href="#/login">Back to log in</a>{/snippet}
    </EmptyState>
  {:else}
    <!-- what happens, before the field (Phase 3, 8 Oct 2026) -->
    <p class="fp-note">
      Your coordinator gives you a <b>temporary password</b>.
    </p>
    {#if error}<Banner>{error}</Banner>{/if}
    <form onsubmit={submit} novalidate>
      <TextInput id="fp-login" label="Phone or username" bind:value={login} error={fe.login} autocomplete="username" autocapitalize="none" spellcheck="false" />
      <Button variant="primary" type="submit" {busy}><Icon name="lock" size={16} />Ask for reset</Button>
    </form>
    <p class="m-0 mt-3 text-center"><a class="link" href="#/login">Back to log in</a></p>
  {/if}
</Plain>

<style>
  .fp-note { margin: 0 0 var(--sp-5); color: var(--text-secondary); font-size: var(--fs-sm); line-height: 1.5; text-wrap: pretty; }
</style>
