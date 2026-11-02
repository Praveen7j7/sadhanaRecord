<script>
  // The buttons of a form or panel: equal columns on wide screens (secondary first, primary last), stacked on phones;
  // align="end" keeps them their natural width, right-aligned.
  let { align = '', class: cls = '', children } = $props();
</script>

<div class="factions {align === 'end' ? 'end' : ''} {cls}">{@render children()}</div>
