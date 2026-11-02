<script>
  // A submitted week: the 11 scores as bars, Night Stay, principles, average rounds, and Share. Read from week.get.
  import { call } from '../lib/api.js';
  import { homeEntry } from '../lib/weekstore.js';
  import { weekShareText, shareText } from '../lib/share.js';
  import { weekBars } from '../lib/report.js';
  import { cachedMeta, loadMeta } from '../lib/meta.js';
  import { weekLabel } from '../lib/dates.js';
  import ErrorState from '../ui/ErrorState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Meters from '../ui/Meters.svelte';
  import Icon from '../ui/Icon.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  let { weekId, onBehalfOf = undefined } = $props();
  const he = homeEntry();
  let w = $state(null);
  let error = $state('');
  let batchName = $state('');
  let msg = $state('');

  const get = () => { error = ''; call('week.get', { weekId, ...(onBehalfOf ? { onBehalfOf } : {}) }).then((r) => (w = r)).catch((e) => (error = e)); };
  get();
  $effect(() => {
    const id = he.data?.profile?.batchId;
    if (!id) return;
    const hit = (cachedMeta().batches || []).find((b) => b.batchId === id);
    if (hit) batchName = hit.name;
    else loadMeta().then((m) => (batchName = (m.batches || []).find((b) => b.batchId === id)?.name || id)).catch(() => (batchName = id));
  });

  const yn = (v) => (v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : '-');
  const text = $derived(w?.scores ? weekShareText(weekId, w.scores, w.weekEnd, { batchName }) : '');
  async function share() { const r = await shareText(text); msg = r === 'copied' ? 'Copied' : r === 'failed' ? 'Could not share' : ''; }
</script>

{#if error}<ErrorState {error} safe="" onretry={get} />
{:else if !w}<Skeleton rows={2} />
{:else if !w.scores && w.status !== 'MISSED'}
  <!-- a week still open (draft, reopened, not started): no scores yet, so point to the week itself, never a blank page -->
  <EmptyState icon="week" title={'Week of ' + weekLabel(weekId)}>This week is not submitted yet, so it has no scores.{#snippet action()}<a class="btn" href={'#/week/' + weekId}>Open the week</a>{/snippet}</EmptyState>
{:else if w.status === 'MISSED'}
  <EmptyState icon="clock" title={'Week of ' + weekLabel(weekId)}>No complete day by the deadline, so it counts as missed (score 0). Ask your coordinator to reopen it.</EmptyState>
{:else if w.scores}
  <section class="section today center" aria-label="Overall score">
    <p class="t-over m-0 mb-2">Week of {weekLabel(weekId)} &middot; submitted &#10003;{(w.daysFilled ?? 7) < 7 ? ` · ${w.daysFilled} of 7 days` : ''}</p>
    <p class="bignum m-0">{w.scores.overall}%</p>
    <p class="m-0 mt-1 text-muted">Overall</p>
  </section>
  <div class="grid2">
    <section class="section" aria-labelledby="h-sc">
      <h3 id="h-sc"><Icon name="report" />Activity Score</h3>
      <Meters items={weekBars(w.scores)} title="Weekly scores" />
    </section>
    <section class="section">
      <h3 class="sec-h"><Icon name="moon" />End of week</h3>
      <dl class="kv">
        <dt>Night Stay</dt><dd>{yn(w.weekEnd?.nightStay)}</dd>
        <dt>4 regulative principles</dt><dd>{yn(w.weekEnd?.principles)}</dd>
        <dt>Average rounds</dt><dd>{w.weekEnd?.chantingAverage ?? '-'}</dd>
      </dl>
      <button type="button" class="btn btn-primary mt-4" onclick={share}><Icon name="share" size={18} />Share this week</button>
      <p class="hint min-h-5 text-center" role="status">{msg}</p>
    </section>
  </div>
{/if}
