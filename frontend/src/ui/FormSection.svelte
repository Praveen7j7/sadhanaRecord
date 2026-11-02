<script>
  // A titled group of fields (a fieldset with a legend), with an optional one-line description and an optional icon —
  // the same icon the group carries on Account › About you, so a person meets one symbol for one thing (18 Oct 2026).
  import Icon from './Icon.svelte';
  let { title, desc = '', icon = '', tag = 'fieldset', class: cls = '', children } = $props();
</script>

{#if tag === 'fieldset'}
  <fieldset class="fsec {cls}"><legend>{#if icon}<span class="fsec-i"><Icon name={icon} size={18} /></span>{/if}{title}</legend>{#if desc}<p class="fsec-d">{desc}</p>{/if}{@render children()}</fieldset>
{:else}
  <section class="fsec {cls}"><h3 class="fsec-h">{#if icon}<span class="fsec-i"><Icon name={icon} size={18} /></span>{/if}{title}</h3>{#if desc}<p class="fsec-d">{desc}</p>{/if}{@render children()}</section>
{/if}

<style>
  .fsec-i { display: inline-flex; vertical-align: -3px; margin-right: var(--sp-2); color: var(--accent); }
</style>
