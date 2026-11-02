<script>
  import '../styles/controls.css';
  import Icon from './Icon.svelte';
  // Several answers from a fixed list, collapsed to one row so a long list does not stretch the form
  // (the user, 11 Oct 2026). Closed it reads "3 selected"; open it shows the options as wrapping chips.
  // `value` is an array of the chosen option strings.
  let { id, label = '', options = [], value = $bindable([]), hint = '', error = '', optional = false } = $props();
  let open = $state(false);
  const has = (o) => value.includes(o);
  const toggle = (o) => { value = has(o) ? value.filter((x) => x !== o) : [...value, o]; };
  const listId = `${id}-list`;
  const count = $derived(value.length);
</script>

<div class="ms field">
  <button type="button" class="ms-head" aria-expanded={open} aria-controls={listId}
    onclick={() => (open = !open)} id={`${id}-toggle`}>
    <span class="ms-label">{label}{#if optional}<span class="ms-opt">&nbsp;(optional)</span>{/if}</span>
    <span class="ms-count">{count ? `${count} selected` : 'None chosen'}</span>
    <span class="ms-chev" class:open aria-hidden="true"><Icon name="down" size={18} /></span>
  </button>

  <div id={listId} class="ms-body" hidden={!open}>
    <ul class="ms-chips" role="group" aria-labelledby={`${id}-toggle`}>
      {#each options as o (o)}
        <li>
          <button type="button" class="ms-chip" class:on={has(o)} aria-pressed={has(o)} onclick={() => toggle(o)}>{o}</button>
        </li>
      {/each}
    </ul>
  </div>

  {#if value.length && !open}
    <p class="ms-sel">{value.join(' · ')}</p>
  {/if}
  {#if hint && !error}<p class="hint">{hint}</p>{/if}
  {#if error}<p class="err" id={`${id}-e`}>{error}</p>{/if}
</div>

<style>
  .ms { display: block; }
  .ms-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; text-align: left;
    background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); color: inherit; cursor: pointer; }
  .ms-head:hover { border-color: var(--border-strong, var(--accent)); }
  .ms-label { flex: 1; min-width: 0; font-size: var(--fs-sm); font-weight: 650; }
  .ms-opt { font-weight: 400; color: var(--text-muted); }
  .ms-count { font-size: var(--fs-sm); color: var(--text-secondary); white-space: nowrap; }
  .ms-chev { display: inline-flex; color: var(--text-muted); transition: transform .18s ease; }
  .ms-chev.open { transform: rotate(180deg); }
  .ms-body { margin-top: 8px; }
  .ms-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .ms-chip { padding: 8px 12px; font-size: var(--fs-sm); line-height: 1.2; background: transparent; color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: 999px; cursor: pointer; }
  .ms-chip.on { border-color: var(--accent); color: var(--text); background: color-mix(in srgb, var(--accent) 12%, transparent); font-weight: 650; }
  .ms-sel { margin: 8px 0 0; font-size: var(--fs-caption); color: var(--text-muted); line-height: 1.45; overflow-wrap: anywhere; }
  @media (prefers-reduced-motion: reduce) { .ms-chev { transition: none; } }
</style>
