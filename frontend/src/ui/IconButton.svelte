<script>
  // A 44 px round icon-only button (or link, with href). `label` is required: it is the accessible name.
  import Icon from './Icon.svelte';
  let { icon, label, href = '', size = 22, tonal = false, badge = '', el = $bindable(), class: cls = '', children, ...rest } = $props();
</script>

{#if href}
  <a bind:this={el} class="iconbtn {tonal ? 'tonal' : ''} {cls}" {href} aria-label={label} {...rest}><Icon name={icon} {size} />{#if badge}<span class="badge" aria-hidden="true">{badge}</span>{/if}{@render children?.()}</a>
{:else}
  <button bind:this={el} type="button" class="iconbtn {tonal ? 'tonal' : ''} {cls}" aria-label={label} {...rest}><Icon name={icon} {size} />{#if badge}<span class="badge" aria-hidden="true">{badge}</span>{/if}{@render children?.()}</button>
{/if}
