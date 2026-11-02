<script>
  import BookList from './BookList.svelte';
  import ValidationMessage from '../ui/ValidationMessage.svelte';
  import Icon from '../ui/Icon.svelte';
  // The current book is remembered, so a normal day is one tap. Any book can be chosen (by level, or searched);
  // "Other book" takes anything typed. always: the list is shown at once, with no toggle (inside the day form's book sheet).
  let { books, ownLevel, bookNote = '', onPick, always = false } = $props();
  let open = $state(always);
  let filters = $state({ level: '', q: '' });
  let text = $state('');
  let textErr = $state('');
  const pick = (item) => { onPick(item); open = always; };
  function pickText() {
    const t = text.trim();
    if (t.length < 2 || t.length > 120) { textErr = 'Type 2 to 120 characters'; return; }
    textErr = ''; pick({ text: t }); text = '';
  }
</script>

<div class="mt-2">
  {#if !always}
  <button type="button" class="btn" aria-expanded={open} onclick={() => (open = !open)}><Icon name={open ? 'up' : 'book'} size={18} />{open ? 'Close book list' : 'Change book'}</button>
  {#if open}<div class="mt-3"></div>{/if}
  {/if}
  {#if open}
    <BookList {books} {ownLevel} bind:filters idp="bp" onPick={pick} />
    <label class="label mt-4" for="bp-t">Other book</label>
    <div class="row items-start gap-2">
      <input id="bp-t" class="input" type="text" maxlength="120" autocomplete="off" placeholder="Type the book" bind:value={text} aria-invalid={textErr ? 'true' : undefined} aria-describedby={textErr ? 'bp-t-e' : undefined} />
      <button type="button" class="btn shrink-0" onclick={pickText}>Use</button>
    </div>
    <ValidationMessage id="bp-t-e" error={textErr} />
    {#if bookNote}<p class="hint">{bookNote}</p>{/if}
  {/if}
</div>
