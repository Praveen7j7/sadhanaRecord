<script>
  // Share sadhana (the head, 27 Oct 2026; worker/src/shares.js). Two tabs:
  //   #/share           I've shared with — my facilitator first (derived from my batch, never removable), then the
  //                     people I added by phone, each with Remove; a phone shows "Sunil K." to confirm before Share
  //   #/share/with-me   Shared with me — each opens #/shared/<share id> (the facilitator's student page, read-only,
  //                     without contact; never the owner's phone); "Remove from my list" drops it
  import { untrack } from 'svelte';
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load } from '../lib/cache.svelte.js';
  import { toast } from '../lib/pro.svelte.js';
  import Tabs from '../ui/Tabs.svelte';
  import TextInput from '../ui/TextInput.svelte';
  import Button from '../ui/Button.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Icon from '../ui/Icon.svelte';

  let { path = '/share' } = $props();
  const tab = $derived(path.split('?')[0] === '/share/with-me' ? '/share/with-me' : '/share');

  const KEY = 'share.list';
  const e = $derived(entry(KEY));
  const d = $derived(e.data);
  const refresh = (force = false) => load(KEY, () => call('share.list'), { force });
  $effect(() => { untrack(() => refresh()); });

  // ---- add by phone: Find (share.lookup) → "Share with Sunil K.?" → Share (share.add)
  let phone = $state(''), phoneErr = $state(''), finding = $state(false);
  // the one confirm sheet: { kind: 'add' | 'remove' | 'leave', phone? (add), login? (remove), id? (leave), name }
  let ask = $state(null), busy = $state(false), askErr = $state(''), sheet = $state();
  async function find() {
    phoneErr = '';
    if (!phone.trim()) { phoneErr = 'Enter a 10-digit mobile number.'; return; }
    finding = true;
    try {
      const r = await call('share.lookup', { phone: phone.trim() });
      open({ kind: 'add', phone: phone.trim(), name: r.name });
    } catch (err) { phoneErr = fieldErrors(err).phone || errorMessage(err); }
    finding = false;
  }
  function open(a) { ask = a; askErr = ''; sheet?.showModal(); }
  async function confirm() {
    const a = ask;
    busy = true; askErr = '';
    try {
      if (a.kind === 'add') await call('share.add', { phone: a.phone });
      else if (a.kind === 'remove') await call('share.remove', { login: a.login });
      else await call('share.leave', { id: a.id });
      sheet.close();
      toast(a.kind === 'add' ? `Shared with ${a.name}` : a.kind === 'remove' ? `${a.name} can no longer see your sadhana` : `${a.name} is off your list`);
      if (a.kind === 'add') phone = '';
      await refresh(true);
    } catch (err) { askErr = fieldErrors(err).phone || errorMessage(err); }
    busy = false;
  }
  const initial = (n) => String(n || '?').trim().charAt(0).toUpperCase();
  const count = $derived(d ? (d.facilitator ? 1 : 0) + d.sharedWith.length : 0);
  const SAY = {
    add: (a) => [`Share with ${a.name}?`, 'They will see your weeks, days and scores. Not your phone or address.', 'Share', 'primary'],
    remove: (a) => [`Stop sharing with ${a.name}?`, 'They will no longer see your sadhana.', 'Remove', 'danger-solid'],
    leave: (a) => [`Remove ${a.name} from your list?`, 'You will no longer see their sadhana.', 'Remove', 'danger-solid'],
  };
  const said = $derived(ask ? SAY[ask.kind](ask) : null);
</script>

<Tabs id="sh" label="Share sadhana" current={tab} items={[['/share', "I've shared with"], ['/share/with-me', 'Shared with me', d?.sharedWithMe.length || '']]}>
  {#if e.error && !d}<Banner onretry={() => refresh(true)}>{errorMessage(e.error)}</Banner>
  {:else if !d}<Skeleton kind="list" rows={3} />
  {:else if tab === '/share'}
    <form class="sh-find" onsubmit={(ev) => { ev.preventDefault(); find(); }}>
      <TextInput id="sh-phone" label="Share with" type="tel" inputmode="numeric" autocomplete="off" placeholder="10-digit mobile number" bind:value={phone} error={phoneErr} class="mb-0" />
      <Button variant="primary" type="submit" busy={finding}>Find</Button>
    </form>

    <h3 class="sh-h"><Icon name="eye" size={18} />Can see my sadhana{count ? ` · ${count}` : ''}</h3>
    {#if !count}
      <EmptyState icon="lock" title="Only you see your sadhana" />
    {:else}
      <ul class="list sh-list" aria-label="Can see my sadhana">
        {#if d.facilitator}
          <li class="sh-row" data-kind="facilitator">
            <span class="avatar sh-av" aria-hidden="true">{initial(d.facilitator.name)}</span>
            <span class="sh-who"><span class="sh-name">{d.facilitator.name}</span></span>
            <span class="pill" data-tone="accent">Facilitator</span>
          </li>
        {/if}
        {#each d.sharedWith as p (p.login)}
          <li class="sh-row">
            <span class="avatar sh-av" aria-hidden="true">{initial(p.name)}</span>
            <span class="sh-who"><span class="sh-name">{p.name}</span></span>
            <button type="button" class="btn btn-sm btn-text" aria-label={'Remove ' + p.name} onclick={() => open({ kind: 'remove', login: p.login, name: p.name })}>Remove</button>
          </li>
        {/each}
      </ul>
      {#if d.sharedWith.length >= d.limit}<p class="m-0 mt-2 text-sm text-muted" role="status">{d.limit} people at most</p>{/if}
    {/if}
  {:else}
    {#if !d.sharedWithMe.length}
      <EmptyState icon="users" title="Nobody has shared their sadhana with you" />
    {:else}
      <ul class="list sh-list" aria-label="Shared with me">
        {#each d.sharedWithMe as p (p.id)}
          <li class="sh-row sh-link">
            <a class="sh-main" href={'#/shared/' + encodeURIComponent(p.id)}>
              <span class="avatar sh-av" aria-hidden="true">{initial(p.name)}</span>
              <span class="sh-who"><span class="sh-name">{p.name}</span>{#if p.batchName}<span class="sh-sub">{p.batchName}</span>{/if}</span>
              <Icon name="next" size={18} />
            </a>
            <button type="button" class="btn btn-sm btn-text" aria-label={'Remove ' + p.name + ' from my list'} onclick={() => open({ kind: 'leave', id: p.id, name: p.name })}>Remove</button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Tabs>

<Sheet bind:this={sheet} titleId="sh-ask-t" title={said?.[0] || ''} onclose={() => { ask = null; askErr = ''; }}>
  {#if ask && said}
    <p class="m-0 mb-2 text-sm">{said[1]}</p>
    {#if askErr}<p class="m-0 mb-2 text-sm sh-err" role="alert">{askErr}</p>{/if}
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" disabled={busy} onclick={() => sheet.close()}>Cancel</button>
      <Button variant={said[3]} busy={busy} onclick={confirm}>{said[2]}</Button>
    </div>
  {/if}
</Sheet>

<style>
  .sh-find { display: flex; flex-wrap: nowrap; align-items: flex-start; gap: var(--sp-2); max-width: var(--page-form); }
  .sh-find :global(.field) { flex: 1 1 auto; min-width: 0; }
  .sh-find :global(.input) { width: 100%; min-width: 0; }
  /* the button sits level with the input, under the label */
  .sh-find :global(button[type='submit']) { flex: 0 0 auto; width: auto; white-space: nowrap; margin-top: calc(var(--fs-label) * var(--lh-label) + 6px); }
  .sh-h { display: flex; align-items: center; gap: var(--sp-2); margin: var(--sp-5) 0 var(--sp-2); font-size: var(--fs-h3); }
  .sh-h :global(svg) { flex: none; color: var(--accent); }
  .sh-list { margin: 0; padding: 0; list-style: none; max-width: var(--page-read); }
  .sh-row { display: flex; align-items: center; gap: var(--sp-3); min-height: 56px; padding: var(--sp-2) var(--sp-4); border-bottom: 1px solid var(--border); }
  .sh-row:last-child { border-bottom: 0; }
  .sh-link { padding-left: 0; }
  .sh-main { display: flex; flex: 1 1 auto; align-items: center; gap: var(--sp-3); min-width: 0; min-height: 48px; padding-left: var(--sp-4); color: inherit; text-decoration: none; }
  .sh-main :global(svg) { flex: none; margin-left: auto; color: var(--text-muted); }
  .sh-av { flex: none; width: 36px; height: 36px; }
  .sh-who { display: grid; flex: 1 1 auto; min-width: 0; }
  .sh-name { font-weight: 600; overflow-wrap: anywhere; }
  .sh-sub { color: var(--text-secondary); font-size: var(--fs-sm); }
  .sh-row > :global(.pill), .sh-row > :global(button) { flex: none; }
  .sh-err { color: var(--danger); }
</style>
