<script module>
  // one canto's chapters stay in memory for the session: opening them again costs nothing
  const cache = new Map();
</script>

<script>
  // A book's chapter PDFs (Śrīmad-Bhāgavatam in Hindi, chapter by chapter; the head, 19 Oct 2026). Closed until tapped,
  // and only then read (books.chapters), so the book list itself never carries the 349 chapters. Canto 10 is grouped
  // by its four parts.
  import { call, errorMessage } from '../lib/api.js';
  import { chapterGroups } from '../lib/books.js';
  import Icon from '../ui/Icon.svelte';
  import { recall, keep } from '../lib/remember.js';
  // remember (D7): the canto whose chapters were left open opens again next visit, and reads its chapters then
  let { bookId, lang = 'hi', count = 0, remember = '' } = $props();
  const wasOpen = remember && recall(remember + '.chapters', '') === bookId + '|' + lang;
  const key = $derived(bookId + '|' + lang);
  let list = $state(null), err = $state(''), busy = $state(false);
  const groups = $derived(list ? chapterGroups(list) : []);

  async function open(e) {
    if (remember) keep(remember + '.chapters', e.currentTarget.open ? bookId + '|' + lang : null);
    if (!e.currentTarget.open || list || busy) return;
    if (cache.has(key)) { list = cache.get(key); return; }
    busy = true; err = '';
    try { const r = await call('books.chapters', { bookId, lang }); cache.set(key, r.chapters); list = r.chapters; }
    catch (x) { err = errorMessage(x); }
    busy = false;
  }
</script>

<details class="bkc" open={!!wasOpen} ontoggle={open}>
  <summary class="bkc-sum"><Icon name="book" size={16} /><span class="min-w-0 flex-1">Chapters</span><span class="bkc-n">{count}</span></summary>
  {#if busy}<p class="bkc-note" role="status">Loading chapters…</p>
  {:else if err}<p class="bkc-note" role="alert">{err}</p>
  {:else if list && !list.length}<p class="bkc-note">No chapters yet</p>
  {:else}
    {#each groups as g, gi (gi)}
      {#if g.part}<p class="bkc-part">{g.part}</p>{/if}
      <ul class="bkc-list" aria-label={g.part ? `Chapters, ${g.part}` : 'Chapters'}>
        {#each g.items as c, i (i)}
          <li><a class="rowlink bkc-row" href={c.url} target="_blank" rel="noopener noreferrer"><span class="min-w-0 break-words">{c.label}</span><Icon name="open" size={14} /><span class="sr-only"> (opens in a new tab)</span></a></li>
        {/each}
      </ul>
    {/each}
  {/if}
</details>

<style>
  .bkc { margin-top: 4px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-2); }
  .bkc-sum { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; list-style: none; cursor: pointer;
             border-radius: var(--r-md); font-size: var(--fs-sm); font-weight: 600; color: var(--accent); }
  .bkc-sum::-webkit-details-marker { display: none; }
  .bkc-sum::after { content: ''; flex: none; width: 7px; height: 7px; margin-left: 4px; border: solid currentColor; border-width: 0 2px 2px 0;
                    transform: translateY(-2px) rotate(45deg); transition: transform var(--d-2) var(--ease); }
  .bkc[open] > .bkc-sum::after { transform: translateY(1px) rotate(225deg); }
  .bkc-n { min-width: 1.75rem; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); text-align: center; font-variant-numeric: tabular-nums; }
  .bkc-part { margin: 8px 12px 4px; color: var(--text-secondary); font-size: var(--fs-xs, 0.75rem); font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }
  .bkc-list { display: grid; gap: 4px; margin: 0; padding: 0 8px 8px; list-style: none; }
  .bkc-list :global(.bkc-row) { min-height: 44px; font-size: var(--fs-sm); }
  .bkc-list :global(.bkc-row > svg) { flex: none; }          /* a long title wraps; the icon keeps its size */
  .bkc-note { margin: 0; padding: 4px 12px 12px; color: var(--text-secondary); font-size: var(--fs-sm); }
</style>
