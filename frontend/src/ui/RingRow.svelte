<script>
  // The avatar ring row (Phase 5, 9 Oct 2026): a sideways row of people's initials, each in a ring of their week — full
  // green = submitted, part = days filled, amber = past days missing. A quick scan; the list below is the record. Not on
  // the Low look tier. people: [{ login, name, status, daysFilled, missing }]; href(person) = where a tap goes.
  let { people = [], href = null, onpick = null, label = 'This week at a glance' } = $props();
  const ini = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const pct = (p) => (p.status === 'SUBMITTED' || tone(p) === 'miss' ? 100 : Math.round(((p.daysFilled || 0) / 7) * 100));   // missing days: a full amber ring
  const tone = (p) => (p.status === 'SUBMITTED' ? 'ok' : p.status === 'MISSED' || p.missing >= 2 ? 'miss' : p.daysFilled ? 'part' : 'none');
</script>

{#if people.length > 1}
  <ul class="rg-row" aria-label={label}>
    {#each people as p (p.login)}
      {@const al = `${p.name}: ${p.status === 'SUBMITTED' ? 'submitted' : `${p.daysFilled || 0} of 7 days`}${p.missing ? `, ${p.missing} missing` : ''}`}
      <li>{#if href}<a class="rg" href={href(p)} style:--p={pct(p)} data-t={tone(p)} aria-label={al}>{@render face(p)}</a>
        {:else}<button type="button" class="rg" style:--p={pct(p)} data-t={tone(p)} aria-label={al} onclick={() => onpick?.(p)}>{@render face(p)}</button>{/if}</li>
    {/each}
  </ul>
{/if}

{#snippet face(p)}
  <span class="rg-i" aria-hidden="true">{ini(p.name)}</span>
  <span class="rg-n" aria-hidden="true">{p.name.split(' ')[0]}</span>
{/snippet}

<style>
  .rg-row { display: flex; gap: 12px; margin: 0 -16px var(--sp-3); padding: 2px 16px 6px; list-style: none; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
  .rg-row::-webkit-scrollbar { display: none; }
  :global(:root[data-tier='low']) .rg-row { display: none; }
  .rg { padding: 0; border: 0; background: none; font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 56px; color: var(--text); text-decoration: none; scroll-snap-align: start; }
  .rg-i { --c: var(--accent); display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; font-weight: 700; font-size: .9375rem;
    background: radial-gradient(closest-side, var(--surface-elevated) 84%, transparent 85%), conic-gradient(var(--c) calc(var(--p) * 1%), var(--border) 0); }
  [data-t='ok'] .rg-i { --c: var(--success); } [data-t='part'] .rg-i { --c: var(--warn-line); } [data-t='miss'] .rg-i { --c: var(--warning); } [data-t='none'] .rg-i { --c: var(--border-strong); }
  [data-t='miss'] .rg-i { box-shadow: 0 0 0 2px var(--warning-soft); }
  .rg-n { max-width: 56px; overflow: hidden; font-size: var(--fs-caption); color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; }
  .rg:focus-visible { outline: 2px solid var(--focus, var(--accent)); outline-offset: 2px; border-radius: 12px; }
</style>
