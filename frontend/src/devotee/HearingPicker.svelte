<script>
  // The day form's topic picker: a typed topic first, then the whole journal with the same filters as Hearing (Choose / Chosen).
  import LectureList from './LectureList.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  let { lectures, heard = [], selected = [], onToggle, onAddText, max = 8 } = $props();
  let filters = $state({ week: '', slot: '', q: '', heard: '' });
  let text = $state('');
  let textErr = $state('');
  const full = $derived(selected.length >= max);
  function addText() {
    const t = text.trim();
    if (t.length < 2 || t.length > 120) { textErr = 'Type 2 to 120 characters'; return; }
    textErr = '';
    onAddText(t);
    text = '';
  }
</script>

<!-- the typed topic first, the journal's list after it (the head, 4 Oct 2026) -->
<div class="mt-2">
  <label class="label" for="hp-t">Type the topic, if it is not in the list</label>
  <div class="row items-start gap-2">
    <input id="hp-t" class="input" type="text" maxlength="120" autocomplete="off" placeholder="What you heard" bind:value={text}
      aria-invalid={textErr ? 'true' : undefined} aria-describedby={textErr ? 'hp-t-e' : undefined}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!full) addText(); } }} />
    <button type="button" class="btn shrink-0" disabled={full} onclick={addText}>Use</button>
  </div>
  <ValidationMessage id="hp-t-e" error={textErr} />
  {#if full}<p class="hint">You can choose up to {max} topics.</p>{/if}

  <p class="label mt-4 mb-1">Or choose from the lectures</p>
  <LectureList {lectures} {heard} bind:filters idp="hp" {selected} {onToggle} {full} />
</div>
