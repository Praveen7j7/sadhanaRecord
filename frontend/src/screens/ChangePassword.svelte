<script>
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { passwordProblem } from '../lib/validate.js';
  import { session } from '../lib/session.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import TextInput from '../ui/TextInput.svelte';
  import Icon from '../ui/Icon.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import Plain from '../ui/Plain.svelte';
  import { logout } from '../lib/session.svelte.js';

  // auth: the forced change after a temporary password, on its own sign-in style page (no app bars around it, 8 Oct 2026)
  let { forced = false, page = false, auth = false } = $props();
  let cur = $state('');
  let pw = $state('');
  let pw2 = $state('');
  let busy = $state(false);
  let error = $state('');
  let fe = $state({});
  let ok = $state(false);

  async function submit(e) {
    e.preventDefault();
    error = '';
    fe = {};
    if (!cur) fe.current = 'Enter your current password';
    const pp = passwordProblem(pw, session.user?.login || '');
    if (pp) fe.password = pp;
    else if (pw !== pw2) fe.confirm = 'Passwords do not match';
    if (Object.keys(fe).length) return;
    busy = true;
    const wasForced = forced;      // the prop follows session.user, which the next lines change
    try {
      await call('auth.changePassword', { current: cur, new: pw });
      cur = pw = pw2 = '';
      if (session.user) session.user.mustChangePassword = false;
      ok = true;
      if (wasForced) go('/home');
    } catch (err) {
      const m = fieldErrors(err);
      if (m.new) fe.password = m.new;
      else if (err.code === 'BAD_CREDENTIALS') fe.current = 'Your current password is wrong';
      else error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>


{#snippet form()}
  {#if ok}<Banner kind="ok">Password changed.</Banner>{/if}
  {#if error}<Banner>{error}</Banner>{/if}
  <form onsubmit={submit} novalidate>
    <TextInput id="cp-cur" label={forced ? 'Temporary password' : 'Current password'} type="password" bind:value={cur} error={fe.current} autocomplete="current-password" />
    <TextInput id="cp-new" label="New password" type="password" bind:value={pw} error={fe.password} hint="8 to 64 characters" autocomplete="new-password" />
    <TextInput id="cp-new2" label="Confirm new password" type="password" bind:value={pw2} error={fe.confirm} autocomplete="new-password" />
    <Button variant="primary" type="submit" {busy}>Change password</Button>
  </form>
{/snippet}

{#if auth}
  <Plain title="Choose your password" back={null}>
    <p class="mb-4 mt-0">You signed in with a temporary password. Choose your own password to continue.</p>
    {@render form()}
    {#snippet foot()}<button type="button" class="btn btn-text" onclick={() => logout()}>Log out</button>{/snippet}
  </Plain>
{:else if page}
  <div class="page-form">
    <section class="section" aria-labelledby="h-cpw">
      <h3 id="h-cpw"><Icon name="lock" />{forced ? 'Choose your password' : 'Change password'}</h3>
      {@render form()}
    </section>
  </div>
{:else}{@render form()}{/if}
