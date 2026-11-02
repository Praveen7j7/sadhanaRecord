<script>
  // One id system (the head, 22 Oct 2026): a devotee without an IYFD answers one question at their next open, and the
  // answer issues their IYF ID in the same save (profile.update → issueForAccount). Nobody is removed and nothing they
  // have is lost. A year already on record (given at sign-up, or Vilash's 2013) is shown to CONFIRM, never to change;
  // with none on record they choose it. Stands alone like the forced password change: no bars, menu or bell.
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { session, logout } from '../lib/session.svelte.js';
  import { go } from '../lib/router.svelte.js';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Button from '../ui/Button.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Plain from '../ui/Plain.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';

  const NOW = new Date().getFullYear();
  const YEARS = Array.from({ length: NOW - 1979 }, (_, i) => String(NOW - i));
  let onRecord = $state(''), year = $state(''), loading = $state(true), busy = $state(false), error = $state(''), fe = $state('');

  $effect(() => {
    call('profile.get').then((p) => { onRecord = p.connectedSinceYear || ''; year = onRecord; })
      .catch((e) => { error = errorMessage(e); }).finally(() => { loading = false; });
  });

  async function submit(e) {
    e.preventDefault();
    error = ''; fe = '';
    if (!year) { fe = 'Choose the year you first came to IYF Delhi'; return; }
    busy = true;
    try {
      const p = await call('profile.update', { connectedSince: year });
      if (session.user) { session.user.iyfId = p.iyfId || session.user.iyfId; session.user.needsYear = false; }
      go('/home');
    } catch (err) {
      fe = fieldErrors(err).connectedSince || '';
      if (!fe) error = errorMessage(err);
      busy = false;
    }
  }
</script>

<Plain title="When did you first come to IYF Delhi?" back={null}>
  {#if loading}<Skeleton rows={2} />
  {:else}
    {#if error}<Banner>{error}</Banner>{/if}
    <form onsubmit={submit} novalidate>
      {#if onRecord}
        <!-- on record: confirm it, never change it (a wrong year is the head's to correct) -->
        <p class="cs-year" aria-live="polite"><span class="cs-label">Connected since</span><strong>{onRecord}</strong></p>
        <ValidationMessage error={fe} />
        <Button variant="primary" type="submit" {busy}>Confirm and get my IYF ID</Button>
      {:else}
        <WheelSelect id="cs-year" label="Connected since" bind:value={year} options={YEARS} placeholder="Choose the year" error={fe} hint="Your IYF ID carries this year. It can be set once." />
        <Button variant="primary" type="submit" {busy}>Get my IYF ID</Button>
      {/if}
    </form>
  {/if}
  {#snippet foot()}<button type="button" class="btn btn-text" onclick={() => logout()}>Log out</button>{/snippet}
</Plain>

<style>
  .cs-year { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); margin: 0 0 var(--sp-4);
             padding: var(--sp-3) var(--sp-4); border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); }
  .cs-label { color: var(--text-secondary); font-size: var(--fs-sm); }
  .cs-year strong { font-size: var(--fs-h3); font-variant-numeric: tabular-nums; }
</style>
