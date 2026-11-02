<script>
  // A section whose details are read-only until its pencil is tapped (the head, 4 Oct 2026): the saved values show as
  // plain, locked text; the small pencil at the top right opens the form, with Cancel and Save. One section is edited at
  // a time (`locked` while another is open). Focus moves into the form when it opens and back to the pencil when it closes.
  //   view: snippet of <div class="esec-row"><dt>…</dt><dd>…</dd></div> rows · children: the form
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import Banner from './Banner.svelte';
  import Button from './Button.svelte';
  import FormActions from './FormActions.svelte';
  let { id, title, icon, editing = false, locked = false, busy = false, error = '', canSave = true, onedit, oncancel, onsave, view, children } = $props();
  let sec = $state(), pen = $state();
  let was = false;
  $effect(() => {
    const now = editing;
    if (now && !was) tick().then(() => sec?.querySelector('.esec-form input, .esec-form button:not([disabled])')?.focus());
    if (!now && was) tick().then(() => pen?.focus());
    was = now;
  });
</script>

<section bind:this={sec} class="section esec" class:on={editing} aria-labelledby={id}>
  <div class="esec-head">
    <h3 {id}><Icon name={icon} />{title}</h3>
    {#if !editing}<IconButton bind:el={pen} icon="edit" size={18} label={'Edit ' + title.toLowerCase()} disabled={locked} class="esec-pen" onclick={onedit} />{/if}
  </div>
  {#if editing}
    <form class="esec-form" novalidate onsubmit={(e) => { e.preventDefault(); if (canSave && !busy) onsave(); }}>
      {#if error}<Banner>{error}</Banner>{/if}
      {@render children()}
      <FormActions class="mt-1">
        <button type="button" class="btn btn-outline" disabled={busy} onclick={oncancel}>Cancel</button>
        <Button variant="primary" type="submit" {busy} disabled={!canSave}>Save</Button>
      </FormActions>
    </form>
  {:else}
    <dl class="esec-view" aria-label={title + ' (read-only)'}>{@render view()}</dl>
  {/if}
</section>

<style>
  .esec-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; margin: -6px -6px var(--sp-3) 0; }
  .esec.on .esec-head { margin-bottom: var(--sp-4); }
  .esec-head h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: var(--fs-h3); line-height: var(--lh-h3); font-weight: var(--fw-h3); min-width: 0; }
  .esec-head h3 :global(svg) { color: var(--accent); flex: none; }
  .esec-head :global(.esec-pen) { flex: none; color: var(--text-muted); }
  @media (hover: hover) { .esec-head :global(.esec-pen:hover:not(:disabled)) { color: var(--accent); } }
  .esec-head :global(.esec-pen:disabled) { opacity: 0.35; cursor: not-allowed; }
  /* locked: values as plain text in rows split by hairlines, right in the section (no box inside the box); the pencil
     is the only way in, so they never read as fields */
  .esec-view { display: grid; margin: 0; }
  .esec-view :global(.esec-row) { display: grid; gap: 2px; padding: 10px 0; }
  .esec-view :global(.esec-row + .esec-row) { border-top: 1px solid var(--divider); }
  .esec-view :global(.esec-row:first-child) { padding-top: 0; }
  .esec-view :global(.esec-row:last-child) { padding-bottom: 0; }
  .esec-view :global(dt) { font-size: var(--fs-sm); color: var(--text-muted); }
  .esec-view :global(dd) { margin: 0; font-size: 0.9375rem; color: var(--text); overflow-wrap: anywhere; font-weight: 550; }
  .esec-view :global(dd.none) { font-weight: 400; font-style: italic; color: var(--text-muted); }
  @media (min-width: 480px) { .esec-view :global(.esec-row) { grid-template-columns: minmax(8.5rem, 34%) minmax(0, 1fr); align-items: baseline; gap: 12px; } }
  .esec.on { box-shadow: 0 0 0 2px var(--halo), var(--shadow-1); }
</style>
