<script>
  // A row of a grouped list (.list): an optional icon chip or lead (avatar, photo), a title and a line under it, an
  // end (status, score, count) and a chevron when the row goes somewhere. A link with href; otherwise a plain <div>
  // (or tag="li" when the row is the list item itself). The caller keeps the <li> for links, so a list can mix rows
  // with other items. disabled: dimmed, not a link (e.g. a day not reached yet). children replace title/sub.
  // Only what to show and where a tap goes: no data loading or decisions here.
  import Icon from './Icon.svelte';
  let { href = '', tag = 'div', icon = '', title = '', sub = '', disabled = false, lead, end, children, class: cls = '', ...rest } = $props();
  const link = $derived(!!href && !disabled);
</script>

{#snippet inner()}
  {#if lead}{@render lead()}{:else if icon}<span class="lico" aria-hidden="true"><Icon name={icon} size={18} /></span>{/if}
  <span class="lmain">{#if children}{@render children()}{:else}<span class="lt">{title}</span>{#if sub}<span class="ls">{sub}</span>{/if}{/if}</span>
  {#if end || link}<span class="lend">{@render end?.()}{#if link}<Icon name="next" size={18} />{/if}</span>{/if}
{/snippet}

{#if link}<a class="lrow {cls}" {href} {...rest}>{@render inner()}</a>
{:else if tag === 'li'}<li class="lrow {cls}" {...rest}>{@render inner()}</li>
{:else}<div class="lrow {cls}" class:opacity-60={disabled} aria-disabled={disabled || undefined} {...rest}>{@render inner()}</div>{/if}

<style>
  .lico { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); }
</style>
