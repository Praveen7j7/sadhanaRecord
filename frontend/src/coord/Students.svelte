<script>
  /*
   * The ETP coordinator's students (the head, 17 Oct 2026).
   *
   * "Students get added who are already the member of the app" — so this is a SEARCH over all of
   * IYF, not a list of this batch's own devotees. A training draws from the whole of it.
   *
   * Enrolling moves nobody: a student stays in their own SPS or DPS batch and keeps filling that
   * week. The screen says so, because "add to this batch" would otherwise read as a transfer and a
   * coordinator could reasonably fear they are taking somebody out of their class.
   */
  import { tick, untrack } from 'svelte';
  import { call, errorMessage } from '../lib/api.js';
  import Banner from '../ui/Banner.svelte';
  import Button from '../ui/Button.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Search from '../ui/Search.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Icon from '../ui/Icon.svelte';
  import { toast } from '../lib/pro.svelte.js';
  import { entry, load as cacheLoad, stale } from '../lib/cache.svelte.js';

  let { batchId, batchName } = $props();

  let data = $state(null);
  let error = $state('');
  let loading = $state(true);
  let q = $state('');
  let found = $state(null);      // null until a search has run
  let searching = $state(false);
  let busy = $state('');

  /**
   * `first` only on the FIRST load (18 Oct 2026).
   *
   * Refreshing after an add used to raise the full-screen skeleton over a list that was already on
   * screen: the student appeared, the screen blanked for about a second, then came back. On a phone
   * with real latency that middle state is what the coordinator sees, and it reads as "he was not
   * added" — the row was in the database the whole time.
   *
   * So a refresh leaves the list standing and swaps the rows in when they arrive.
   */
  // Which request is the current one. Two loads can be in flight at once — the effect's and the one
  // after an add — and the older reply used to land last and wipe the student off the screen
  // (18 Oct 2026). Only the newest reply is allowed to write.
  //
  // Through the shared read cache (22 Oct 2026, as G23): a return visit within two minutes shows the kept list at once
  // and asks nobody (it asked on every visit, ~1.2 s on a phone). After an add or a remove the list is fetched afresh
  // and kept, so it never shows a removed student; a read still in flight lands first, so it cannot overwrite that.
  let seq = 0;
  async function load({ first = false } = {}) {
    const mine = ++seq;
    const k = 'enrol.list:' + batchId, get = () => call('enrol.list', { batchId });
    const kept = first ? entry(k).data : undefined;
    if (kept !== undefined) { data = kept; loading = false; }
    else if (first) loading = true;
    error = '';
    if (!first && entry(k).refreshing) await cacheLoad(k, get);
    const d = await cacheLoad(k, get, { force: !first });
    if (mine !== seq) return;                   // a newer load already answered; this one is stale
    if (d !== undefined) data = d;
    else { error = errorMessage(entry(k).error); if (first && kept === undefined) data = null; }
    loading = false;
  }
  // only `batchId` may retrigger this: load() writes data/error/loading, and an effect that reads
  // them would re-run itself after every load
  $effect(() => { const id = batchId; untrack(() => load({ first: true })); void id; });

  // searched on demand, not as you type: this looks across every devotee in IYF
  async function search() {
    const term = q.trim();
    if (term.length < 2) { found = null; return; }
    searching = true; error = '';
    try { found = (await call('enrol.search', { batchId, q: term })).people; }
    catch (e) { error = errorMessage(e); found = null; }
    searching = false;
    // bring the results into view: on a phone they sit below the fold, and a coordinator who
    // cannot see them reads the search as having done nothing (the head, 18 Oct 2026)
    await tick();
    const h = document.getElementById('st-found');
    // scrolled to, NOT focused: focusing drew a blue ring around "Found 4 people" that reads as an
    // error box. The count is announced by aria-live instead (the head, 18 Oct 2026).
    if (h) h.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function add(p) {
    busy = p.login; error = '';
    try {
      await call('enrol.add', { batchId, login: p.login });
      toast(`${p.name} is in the training.`);
      const left = (found || []).filter((x) => x.login !== p.login);
      // Nothing left to add from this search: clear it rather than leave "Nobody matched" standing
      // over the person who was just added — it reads as a refusal (the head, 18 Oct 2026).
      found = left.length ? left : null;
      if (!left.length) q = '';
      stale('board.get:' + batchId);             // the training's scoreboard has a new row
      await load();
    } catch (e) { error = errorMessage(e); }
    busy = '';
  }

  async function remove(s) {
    busy = s.login; error = '';
    try {
      await call('enrol.remove', { batchId, login: s.login, reason: 'Taken out of the training' });
      toast(`${s.name} is no longer in the training.`);
      stale('board.get:' + batchId);
      await load();
    } catch (e) { error = errorMessage(e); }
    busy = '';
  }
</script>

{#if loading}
  <Skeleton kind="list" rows={5} />
{:else if error && !data}
  <EmptyState icon="info" title="Not a training">{error}</EmptyState>
{:else if data}

  {#if data.closed}
    <Banner>This training is finished. Its students are a record now and cannot be changed.</Banner>
  {/if}
  {#if error}<Banner>{error}</Banner>{/if}

  {#if !data.closed}
    <form class="st-find" onsubmit={(e) => { e.preventDefault(); search(); }}>
      <Search id="st-q" label="Add a student" placeholder="Name or phone" bind:value={q} class="mb-0" />
      <Button variant="primary" type="submit" busy={searching}>Search</Button>
    </form>

    {#if found !== null}
      <!-- The results used to appear with no heading of their own, between the explanation and
           "In this training". On a phone they landed below the fold and the coordinator saw
           "No students yet" instead — "not able to see on the screen from where i can add him"
           (the head, 18 Oct 2026). Now they are announced, counted, and scrolled to. -->
      <h3 class="st-h" class:st-none={!found.length} id="st-found" role="status" aria-live="polite">
        {found.length ? `Found ${found.length} ${found.length === 1 ? 'person' : 'people'}` : 'Nobody matched'}
      </h3>
      {#if !found.length}
        <p class="m-0 mb-4 text-sm text-muted">They may already be in this training.</p>
      {:else}
        <ul class="list st-list" aria-label="People found">
          {#each found as p (p.login)}
            <li class="st-row">
              <span class="st-who">
                <span class="st-name">{p.name}</span>
                <span class="st-sub">{p.batchId || 'no batch'}{p.iyfId ? ' · ' + p.iyfId : ''}</span>
              </span>
              <button type="button" class="btn btn-sm" disabled={busy === p.login} onclick={() => add(p)}>
                <Icon name="plus" size={16} />Add
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {/if}

  <!-- said once: the heading carries the count, and the page explains itself by what it shows
       rather than by a paragraph above it (the head, 18 Oct 2026) -->
  <h3 class="st-h"><Icon name="users" size={18} />In this training{data.students.length ? ` · ${data.students.length}` : ''}</h3>
  {#if !data.students.length}
    <EmptyState icon="users" title="No students yet">Search above to add somebody.</EmptyState>
  {:else}
    <ul class="list st-list" aria-label="Students">
      {#each data.students as s (s.login)}
        <li class="st-row">
          <span class="st-who">
            <span class="st-name">{s.name}</span>
            <!-- their OWN batch, so it is plain that the training did not take them out of it -->
            <span class="st-sub">{s.batchId || 'no batch'}{s.iyfId ? ' · ' + s.iyfId : ''}</span>
          </span>
          {#if !data.closed}
            <button type="button" class="btn btn-sm btn-text" disabled={busy === s.login} onclick={() => remove(s)}>Remove</button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .st-head { margin-bottom: var(--sp-4); }
  /* The row collapsed the box to 86px on a phone — 40px + 44px of icon padding left about two
     pixels of text, so what you typed scrolled out of sight (18 Oct 2026). The field stretches,
     and on a narrow screen the button drops to its own line rather than squeezing the input. */
  /* The field and the button share one line. They wrapped on a phone, which put a full-width blue
     Search button under the box and pushed the results further below the fold — the opposite of
     what was wanted (18 Oct 2026). 9rem leaves room for both at 320px. */
  /* The field keeps the room; the button takes only what its word needs. Earlier tries gave the
     button a full row of its own (results pushed below the fold) and then starved the box down to
     its magnifier. The field grows, the button never does (18 Oct 2026). */
  /* a lookup, not a list filter: no wider than a name needs on a desktop (27 Oct 2026; it ran ~1,000 px at 1440) */
  .st-find { display: flex; flex-wrap: nowrap; align-items: flex-end; gap: var(--sp-2); max-width: 40rem; margin-bottom: var(--sp-2); }
  .st-find :global(.field) { flex: 1 1 auto; min-width: 0; }
  .st-find :global(.field .input) { width: 100%; min-width: 0; }
  .st-find :global(button[type='submit']) { flex: 0 0 auto; width: auto; white-space: nowrap; }
  .st-find :global(.search) { width: 100%; }
  .st-find :global(.input) { width: 100%; min-width: 0; }
  .st-find :global(button[type='submit']) { flex: 0 0 auto; }
  .st-h { display: flex; align-items: center; gap: var(--sp-2); margin: var(--sp-5) 0 var(--sp-2); font-size: var(--fs-h3); }
  .st-h :global(svg) { flex: none; color: var(--accent); }
  /* "Nobody matched" is information, not a heading to be shouted; and it never takes a focus ring,
     which read as an error box sitting over a student who had just been added successfully */
  .st-h.st-none { font-size: var(--fs-base); font-weight: 600; color: var(--text-secondary); }
  .st-h:focus { outline: none; }
  .st-h:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
  .st-list { margin: 0; padding: 0; list-style: none; }
  .st-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3);
            padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border); }
  .st-row:last-child { border-bottom: 0; }
  .st-who { display: grid; min-width: 0; }
  .st-name { font-weight: 600; overflow-wrap: anywhere; }
  .st-sub { color: var(--text-secondary); font-size: var(--fs-sm); }
</style>
