<script>
  import Icon from './Icon.svelte';
  import '../styles/seg.css';
  // Segmented choice: two or more buttons, one pressed (Yes / No, Present / Absent).
  import ValidationMessage from './ValidationMessage.svelte';
  // srLabel: the label kept for screen readers, hidden on screen — as WheelSelect (G12, 22 Oct 2026)
  let { label, options, value = null, onchange, id, error = '', disabled = false, srLabel = false } = $props();
</script>

<div class="field" {id}>
  <p class="label" class:sr-only={srLabel} id={id + '-l'}>{label}</p>
  <div class="seg seg-even" role="group" aria-labelledby={id + '-l'}>
    <!-- an optional third element names an icon, shown before the word — never instead of it (18 Oct 2026) -->
    {#each options as [v, t, ic]}
      <button type="button" aria-pressed={value === v} {disabled} onclick={() => onchange(v)}>{#if ic}<Icon name={ic} size={16} />{/if}{t}</button>
    {/each}
  </div>
  <ValidationMessage {error} />
</div>
