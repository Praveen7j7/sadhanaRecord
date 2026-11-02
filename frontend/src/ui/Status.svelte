<script>
  // A state in a list: a dot and a word in the semantic colour ("● Submitted", "● Missed"), never colour alone: the
  // word says it. tone: ok · warn · bad · info · accent · '' (muted). For counts and tags keep .pill; for states, this.
  let { tone = '', label = '', class: cls = '', children, ...rest } = $props();
</script>

<span class="status {cls}" data-tone={tone || undefined} {...rest}>{#if children}{@render children()}{:else}{label}{/if}</span>
