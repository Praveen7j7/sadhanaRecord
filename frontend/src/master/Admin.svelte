<script>
  import '../styles/screens.css';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Overview from './Overview.svelte';
  import Members from '../coord/Members.svelte';
  import Leaders from '../coord/Leaders.svelte';
  import { cachedMeta, loadMeta, staffBatches } from '../lib/meta.js';
  import Coordinators from './Coordinators.svelte';
  import Batches from './Batches.svelte';
  import Facilitators from './Facilitators.svelte';
  import Ids from './Ids.svelte';
  import Reopens from './Reopens.svelte';
  import Activity from './Activity.svelte';
  import Settings from './Settings.svelte';
  import Tabs from '../ui/Tabs.svelte';
  import ExportButton from '../ui/ExportButton.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import { entry } from '../lib/cache.svelte.js';
  import { go } from '../lib/router.svelte.js';
  let { tab } = $props();
  // Group leaders, for any batch (the head, 3 Oct 2026): the same screen as a coordinator's, with a batch to choose
  let glBatch = $state('');
  const glId = $derived(allIds.includes(glBatch) ? glBatch : allIds[0] || '');
  let meta = $state(cachedMeta());
  loadMeta().then((d) => (meta = d)).catch(() => {});
  const allIds = $derived(staffBatches(meta).map((b) => b.batchId));
  const nameOf = (id) => staffBatches(meta).find((b) => b.batchId === id)?.name || id;
  const reopens = $derived(entry('reopen.list').data?.requests?.length || '');
  // Phase 6 (9 Oct 2026): seven groups instead of nine tabs; People and Staff each hold two pages (a switch inside);
  // every old route is kept
  // 10 Oct 2026 (the head): one tab per page, nothing grouped behind a switch; People's two pages were the batch tools'
  // Devotees and Group leaders again (the same screens, every batch), so their old addresses go there
  const GROUPS = [['/overview', 'All batches'], ['/analysis', 'Analysis'], ['/reports', 'Reports'], ['/coordinators', 'Staff'], ['/access', 'Access'], ['/facilitators', 'Facilitators'], ['/phases', 'Phases'], ['/batches', 'Batch setup'], ['/ids', 'IYF IDs'], ['/activity', 'Activity'], ['/settings', 'Settings']];
  const TABS = GROUPS.map(([p, l]) => [p, l]);
  const group = $derived(GROUPS.find((g) => g[0] === tab || g.slice(2).some((x) => x[0] === tab)) || GROUPS[0]);
  const subs = $derived(group.slice(2));
  // Export (Phase 9, item 21): what the button starts from on each page
  // the pages whose own page-head takes Export (as `tools`); the others keep the row above
  const HEADED = new Set(['/overview', '/analysis', '/coordinators', '/access', '/facilitators', '/phases', '/batches', '/reopens', '/activity']);
  const EXPORT = { '/overview': 'progress', '/devotees': 'contacts', '/groups': 'contacts', '/coordinators': 'staff', '/facilitators': 'staff', '/batches': 'batches', '/activity': 'activity' };
</script>

{#snippet tools()}{#if EXPORT[tab]}<ExportButton start={EXPORT[tab]} batchIds={tab === '/groups' ? [glId] : allIds} short={tab === '/activity'} />{/if}{/snippet}
<!-- One tools row per page (19 Oct 2026). Export used to sit in its own row above every page, the page then put
     its count and primary action in a second row and Refresh in a third: three lines of chrome on a phone before
     the list, each aligned differently. A page that has a page-head takes Export as `tools` and lays Refresh,
     Export and its primary action out in ONE cluster (.ph-tools); the row here stays only for the pages that
     have no head of their own. -->
<Tabs items={TABS} current={group[0]} label="Admin sections" id="ad">
  {#if subs.length || (EXPORT[tab] && !HEADED.has(tab))}
    <div class="ad-tools">
      {#if subs.length}
        <nav class="seg ad-sub" aria-label={group[1]}>
          {#each subs as [p, l]}<a href={'#' + p} aria-current={tab === p ? 'page' : undefined}>{l}</a>{/each}
        </nav>
      {/if}
      {#if EXPORT[tab] && !HEADED.has(tab)}<span class="ml-auto">{@render tools()}</span>{/if}
    </div>
  {/if}
  {#if tab === '/overview'}<Overview {tools} />
  {:else if tab === '/devotees'}<Members batchIds={allIds} {nameOf} all />
  {:else if tab === '/groups'}
    <WheelSelect id="ad-gl-batch" label="Batch" class="w-full sm:w-64" value={glId} options={allIds.map((b) => [b, nameOf(b)])} onchange={(v) => (glBatch = v)} />
    {#if glId}{#key glId}<Leaders batchId={glId} batchName={nameOf(glId)} />{/key}{/if}
  {:else if tab === '/coordinators'}<Coordinators {tools} />
  {:else if tab === '/facilitators'}<Facilitators {tools} />
  <!-- the newer tabs load on demand, each in its own chunk: staff-Admin stays under its 35 KB budget (size.mjs). While a
       tab's file loads it shows its skeleton, not a blank panel (Phase 24: a blank panel also read as "ready" to the speed
       check, which then left before the screen had asked for its data, and the next visit paid for it) -->
  {:else if tab === '/access'}{#await import('./Access.svelte')}<Skeleton kind="list" rows={4} />{:then M}<M.default {tools} />{/await}
  {:else if tab === '/phases'}{#await import('./Phases.svelte')}<Skeleton kind="list" rows={3} />{:then M}<M.default {tools} />{/await}
  <!-- Admin › Analysis (phase 21): its own chunk, with its chart -->
  {:else if tab === '/analysis'}{#await import('./Analysis.svelte')}<Skeleton kind="page" rows={4} />{:then M}<M.default {tools} />{/await}
  {:else if tab === '/batches'}<Batches {tools} />
  {:else if tab === '/reopens'}<Reopens {tools} />
  {:else if tab === '/activity'}<Activity {tools} />
  {:else if tab === '/settings'}<Settings />
  {:else}<Ids />{/if}
</Tabs>

<style>
  .ad-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: var(--sp-4); }
  .ad-sub { flex: 1 1 260px; max-width: 420px; }
  .ad-sub a { display: flex; flex: 1; align-items: center; justify-content: center; min-height: var(--ctl-h); padding: 0 12px; border-radius: inherit; color: var(--text-secondary); font-size: var(--fs-sm); font-weight: 600; text-decoration: none; white-space: nowrap; }
  .ad-sub a[aria-current='page'] { background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow-1); }
</style>
