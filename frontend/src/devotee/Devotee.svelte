<script>
  import '../styles/screens.css';
  // The devotee's screens (loaded only when first opened): week, day, history, report, hearing, reading.
  import Week from './Week.svelte';
  import Day from './Day.svelte';
  import ScoresView from './ScoresView.svelte';
  import Report from './Report.svelte';
  import Hearing from './Hearing.svelte';
  import Reading from './Reading.svelte';
  import { homeEntry, loadHome } from '../lib/weekstore.js';
  import { go } from '../lib/router.svelte.js';
  import Skeleton from '../ui/Skeleton.svelte';
  import Icon from '../ui/Icon.svelte';
  let { path } = $props();
  const all = $derived(path.split('?')[0].split('/').filter(Boolean));
  const q = $derived(new URLSearchParams(path.split('?')[1] || ''));
  const focus = $derived(q.get('f') || '');
  // #/fill/<login>/week/<weekId> · #/fill/<login>/day/<weekId>/<date>: a coordinator filling for a devotee
  const fillFor = $derived(all[0] === 'fill' ? decodeURIComponent(all[1] || '') : '');
  const parts = $derived(fillFor ? all.slice(2) : all);
  // the devotee's name travels in the first link (?n=) and is remembered for the day links of the same session
  const names = (() => { try { return JSON.parse(sessionStorage.getItem('sr.fillNames') || '{}'); } catch { return {}; } })();
  const behalf = $derived.by(() => {
    if (!fillFor) return null;
    const n = q.get('n');
    if (n && names[fillFor] !== n) { names[fillFor] = n; try { sessionStorage.setItem('sr.fillNames', JSON.stringify(names)); } catch { /* storage blocked */ } }
    return { login: fillFor, name: n || names[fillFor] || fillFor };
  });

  // old links: #/learn?f=reading -> #/reading, any other #/learn -> #/hearing
  $effect(() => { if (!fillFor && parts[0] === 'learn') go(focus === 'reading' ? '/reading' : '/hearing', true); });
  // the Week tab has no id: go to the current week
  const he = homeEntry();
  $effect(() => {
    if (fillFor || parts[0] !== 'week' || parts[1]) return;
    loadHome();
    const w = he.data?.weeks;
    if (w?.length) go('/week/' + w[w.length - 1].weekId, true);
  });
</script>

{#if behalf}
  <!-- the acting-as bar (Phase 5): stays at the top while filling for someone, with the way back -->
  <div class="acting" role="note" data-area="coordinator">
    <span class="avatar acting-av" aria-hidden="true">{(behalf.name || '?').trim().charAt(0).toUpperCase()}</span>
    <span class="min-w-0 flex-1"><b class="acting-name">Filling for {behalf.name}</b><span class="block text-xs text-muted">Saved as filled by the coordinator</span></span>
    <a class="btn btn-sm acting-done" href={'#/devotee/' + encodeURIComponent(behalf.login)}>Done<span class="sr-only">, back to {behalf.name}</span></a>
  </div>
  {#if parts[0] === 'week' && parts[1]}{#key fillFor + parts[1]}<Week weekId={parts[1]} {focus} {behalf} />{/key}
  {:else if parts[0] === 'day'}{#key fillFor + parts[1] + parts[2]}<Day weekId={parts[1]} date={parts[2]} {focus} {behalf} />{/key}
  {:else}<Skeleton rows={2} />{/if}
{:else if parts[0] === 'week' && parts[1]}{#key parts[1]}<Week weekId={parts[1]} {focus} />{/key}
{:else if parts[0] === 'week'}<Skeleton rows={3} />
{:else if parts[0] === 'day'}{#key parts[1] + parts[2]}<Day weekId={parts[1]} date={parts[2]} {focus} />{/key}
{:else if parts[0] === 'history' && parts[1]}<ScoresView weekId={parts[1]} />
{:else if parts[0] === 'report'}<Report />
{:else if parts[0] === 'hearing'}<Hearing />
{:else if parts[0] === 'reading'}<Reading />
{:else if parts[0] === 'learn'}<Skeleton rows={2} />
{:else}<Report view="weekly" />{/if}

<style>
  /* Phase 24 (V2): not sticky any more — it sat at the same line as the day chips and slid under them; the title names the person (V6) */
  .acting { display: flex; align-items: center; gap: 10px; margin-bottom: var(--sp-3); padding: 8px 8px 8px 12px; border-radius: var(--r-md); border-left: 3px solid var(--area); background: var(--surface-floating); box-shadow: var(--shadow-2); }
  .acting-av { flex: none; width: 34px; height: 34px; }
  .acting-done { flex: none; min-height: 44px; }
  /* the name is the point of the bar: two lines before it is cut, never under the Done button (Phase 24, V5) */
  .acting-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; line-height: 1.3; }
</style>
