<script>
  /*
   * Ready to move up (ADR 0017): who in this batch meets its promotion rules, judged by the server (eligible.js — the
   * batch's own rules, or the standard set for its level; a missing figure is NOT YET, never a pass). The dashboard
   * lists the same people as "ready to move up" under each level. Ready first, then by name; each row shows every rule
   * with what they have against it, so a "not yet" says what is missing.
   */
  import { call, errorMessage } from '../lib/api.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import Seg from '../ui/Seg.svelte';

  let { batchId } = $props();
  let d = $state(null), err = $state(''), show = $state('ready');
  const get = () => call('eligible.list', { batchId }).then((r) => { d = r; err = ''; }).catch((e) => (err = errorMessage(e)));
  get();

  const FRACTION = new Set(['att', 'night']);
  const LABEL = { att: 'Attendance', chant: 'Chanting rounds', sad: 'Sadhana average', night: 'Night stay', cls: 'Class attendance', pr: '4 regulative principles' };
  const fig = (k, v) => (v === null || v === undefined ? '—' : k === 'pr' ? (v === 'YES' ? 'kept' : 'not yet') : FRACTION.has(k) ? `${Math.round(v * 100)}%` : String(Math.round(v * 10) / 10));
  const ready = $derived((d?.rows || []).filter((r) => r.ready));
  const rows = $derived(show === 'ready' ? ready : d?.rows || []);
  const rules = $derived(Object.keys(d?.criteria || {}));
</script>

{#if err && !d}<Banner onretry={get}>{err}</Banner>
{:else if !d}<Skeleton kind="list" rows={4} />
{:else if !rules.length}
  <EmptyState icon="up" title="No promotion from this batch">This batch is not on the promotion ladder, so nobody is declared ready.</EmptyState>
{:else}
  <p class="rd-rules m-0">{d.nextLevels?.length ? `Next: ${d.nextLevels.join(' or ')} · ` : ''}{rules.map((k) => `${LABEL[k] || k} ${fig(k, d.criteria[k])}`).join(' · ')}</p>
  <div class="rd-pick"><Seg id="rd-show" label="Show" options={[['ready', `Ready (${ready.length})`], ['all', `Everyone (${d.rows.length})`]]} value={show} onchange={(v) => (show = v)} /></div>
  {#if !rows.length}
    <EmptyState icon="users" title={show === 'ready' ? 'Nobody ready yet' : 'Nobody in this batch'}>{show === 'ready' ? 'Everyone is shown under Everyone, with what each still needs.' : ''}</EmptyState>
  {:else}
    <ul class="list rd-list" aria-label="Devotees">
      {#each rows as r (r.login)}
        <li class="rd-row">
          <div class="rd-who"><span class="rd-name">{r.name}</span>
            <span class="pill" data-tone={r.ready ? 'ok' : ''}>{r.ready ? 'Ready' : 'Not yet'}</span>
            <span class="rd-weeks">{r.weeks} {r.weeks === 1 ? 'week' : 'weeks'}</span></div>
          <ul class="rd-checks" aria-label={'Rules for ' + r.name}>
            {#each r.checks as c (c.key)}
              <li class:met={c.met}><span>{c.label}</span><b>{fig(c.key, c.got)}</b>{#if c.key !== 'pr'}<small>of {fig(c.key, c.min)}</small>{/if}</li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .rd-rules { margin-bottom: var(--sp-3); color: var(--text-secondary); font-size: var(--fs-sm); }
  .rd-pick { margin-bottom: var(--sp-3); max-width: 420px; }
  .rd-list { margin: 0; padding: 0; list-style: none; }
  .rd-row { display: grid; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border); }
  .rd-row:last-child { border-bottom: 0; }
  .rd-who { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
  .rd-name { font-weight: 650; min-width: 0; overflow-wrap: anywhere; }
  .rd-weeks { margin-left: auto; color: var(--text-secondary); font-size: var(--fs-xs); }
  .rd-checks { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin: 0; padding: 0; list-style: none; }
  .rd-checks li { display: inline-flex; align-items: baseline; gap: 4px; padding: 2px var(--sp-2); border: 1px solid var(--border);
                  border-radius: 999px; font-size: var(--fs-xs); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .rd-checks li b { color: var(--warn, var(--text)); }
  .rd-checks li.met b { color: var(--ok); }
</style>
