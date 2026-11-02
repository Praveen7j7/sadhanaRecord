<script>
  // Calm hint when a call is still running after ~2 s. Space is always reserved (no layout shift).
  let { busy = false } = $props();
  let slow = $state(false);
  $effect(() => {
    if (!busy) { slow = false; return; }
    const t = setTimeout(() => (slow = true), 2000);
    return () => clearTimeout(t);
  });
</script>

<p class="hint mb-0 mt-2 min-h-5 text-center" role="status">{slow ? 'Still working — this can take a few seconds' : ''}</p>
