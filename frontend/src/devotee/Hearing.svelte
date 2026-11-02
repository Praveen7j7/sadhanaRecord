<script>
  // Hearing: the lectures of the devotee's journal, one week at a time or all with filters (kept in the address).
  import { session } from '../lib/session.svelte.js';
  import { homeEntry, loadHome } from '../lib/weekstore.js';
  import { getJournals } from '../lib/refdata.js';
  import { readFilters, filterParams, lectureLink } from '../lib/lectures.js';
  import { suggestedWeek } from '../lib/refdata.js';
  import Icon from '../ui/Icon.svelte';
  import { hashParams, replaceHashParams } from '../lib/hashq.js';
  import ErrorState from '../ui/ErrorState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import LectureList from './LectureList.svelte';
  import { rememberScroll } from '../lib/remember.js';

  const login = session.user?.login || '';
  const he = homeEntry();
  const jv = $derived(he.data?.versions?.journals);
  let j = $state(null);
  let err = $state(null);
  let filters = $state(readFilters(hashParams()));
  // lectures picked in submitted weeks (home.get; the journal copy on the phone stays the same between versions)
  const heard = $derived(he.data?.progress?.heard || j?.heard || []);
  loadHome();
  const getJ = () => { err = null; if (jv) getJournals(login, jv).then((r) => (j = r)).catch((e) => (err = e || true)); else loadHome(true); };
  $effect(() => { if (jv) getJ(); });
  $effect(() => { const p = filterParams({ ...filters }); if (j) replaceHashParams(p); });
  // Continue (Phase 4, 8 Oct 2026): the next lecture not heard yet, one tap away
  const next = $derived(j ? suggestedWeek(j.lectures, heard).lectures.find((l) => !heard.includes(l.lectureId)) : null);
  const nextLink = $derived(next ? lectureLink(next) : null);
  // D7: the list's scroll comes back on the next visit (this phone, this person)
  const SKEY = 'sr.hr.' + login + '.y';
  let sc = null, restored = false;
  $effect(() => { sc = rememberScroll(SKEY); return () => sc.stop(); });
  $effect(() => { if (j && !restored) { restored = true; sc?.restore(); } });
</script>

{#if (err || (he.error && !jv)) && !j}<ErrorState error={err === true ? null : err || he.error} title="Lectures need a connection" safe="" onretry={getJ} />
{:else if !j}<Skeleton kind="list" rows={5} />
{:else}
  <!-- no box around the page: progress, the week / filters, then one grouped list of lectures -->
  <section class="page-read" aria-label="Lectures">
    <div class="mb-4 flex items-center gap-3">
      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true"><div class="h-full rounded-full bg-[var(--accent)]" style:width={(j.lectures.length ? (heard.length / j.lectures.length) * 100 : 0) + '%'}></div></div>
      <span class="shrink-0 text-sm font-semibold">{heard.length} of {j.lectures.length} heard</span>
    </div>
    {#if next}
      <div class="cblock hr-next">
        <p class="t-over m-0">Continue · lesson week {next.week}</p>
        <p class="m-0 mt-1 font-semibold">{next.title}</p>
        <p class="m-0 text-sm text-muted">{next.slot}</p>
        {#if nextLink && nextLink.kind !== 'none'}<a class="btn btn-primary mt-3" href={nextLink.url} target="_blank" rel="noopener noreferrer"><Icon name="play" size={18} />{nextLink.kind === 'file' ? 'Listen' : 'Open folder'}<span class="sr-only"> (opens in a new tab)</span></a>{/if}
      </div>
    {/if}
    <LectureList lectures={j.lectures} {heard} bind:filters idp="ln" pin />
  </section>
{/if}
