<script>
  import Status from '../ui/Status.svelte';
  import Row from '../ui/Row.svelte';
  import { call, errorMessage } from '../lib/api.js';
  import { weekLabel } from '../lib/dates.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  let weeks = $state([]);
  let more = $state(false);
  let loading = $state(true);
  let error = $state('');

  async function load(before) {
    loading = true; error = '';
    try {
      const r = await call('history.list', before ? { before, limit: 8 } : { limit: 8 });
      weeks = [...weeks, ...r.weeks];
      more = r.more;
    } catch (e) { error = errorMessage(e); }
    loading = false;
  }
  load();
</script>

{#if error}<Banner onretry={() => load(weeks.length ? weeks[weeks.length - 1].weekId : undefined)}>{error}</Banner>{/if}
{#if loading && !weeks.length}<Skeleton kind="list" rows={4} />{/if}
<!-- one grouped list, newest first: the week, its Body / Soul line, and the overall score where the eye ends -->
{#if weeks.length}
  <ul class="list mb-4 hs-list">
    {#each weeks as w (w.weekId)}
      <li>
        {#if w.status === 'SUBMITTED'}
          <Row href={'#/history/' + w.weekId} icon="check" title={'Week of ' + weekLabel(w.weekId)} sub={`Body ${w.body}% · Soul ${w.soul}%${(w.daysFilled ?? 7) < 7 ? ` · ${w.daysFilled} of 7 days` : ''}`}>
            {#snippet end()}<b class="serif text-xl text-brand tabular-nums">{w.overall}%</b>{/snippet}
          </Row>
        {:else}
          <Row icon="clock" title={'Week of ' + weekLabel(w.weekId)} sub="No complete day by the deadline">{#snippet end()}<Status tone="bad" label="Missed · 0%" />{/snippet}</Row>
        {/if}
      </li>
    {/each}
  </ul>
{:else if !loading && !error}
  <EmptyState icon="week" title="No weeks yet" darshan>Submitted weeks appear here.{#snippet action()}<a class="btn" href="#/week">Open this week</a>{/snippet}</EmptyState>
{/if}
{#if more}<button type="button" class="btn w-full hs-list" aria-busy={loading || undefined} disabled={loading} onclick={() => load(weeks[weeks.length - 1].weekId)}>Show earlier weeks</button>{/if}

<style>
  /* a readable line length on wide screens: the list never stretches across a desktop */
  .hs-list { max-width: var(--page-read); }
</style>
