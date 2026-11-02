<script>
  // A book's own PDF(s), exactly the links the server gives (never built or guessed). One file: "Open PDF".
  // Several (cantos, lilas, volumes, languages): a list that opens on tap. None: a quiet note.
  // lang (19 Oct 2026): the section's PDFs; a book with none in Hindi still offers its English ones, as before
  import Icon from '../ui/Icon.svelte';
  import { filesIn } from '../lib/books.js';
  let { book, compact = false, lang = 'en' } = $props();
  const files = $derived(filesIn(book, lang).length ? filesIn(book, lang) : filesIn(book, 'en'));
  const chapters = $derived(lang === 'hi' ? book?.chaptersHi || 0 : 0);
</script>

{#if !files.length}
  <p class="m-0 mt-1 text-sm text-muted">No PDF yet</p>
{:else if files.length === 1}
  <a class="btn mt-2 {compact ? 'btn-sm' : ''}" href={files[0].url} target="_blank" rel="noopener noreferrer"><Icon name="open" size={16} />Open PDF<span class="sr-only"> of {book.title} (opens in a new tab)</span></a>
{:else}
  <details class="mt-1">
    <summary class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-brand"><Icon name="book" size={16} />{files.length} PDFs: choose a volume</summary>
    <ul class="m-0 grid list-none gap-1 p-0 pb-2">
      {#each files as f, i (i)}
        <li><a class="rowlink" href={f.url} target="_blank" rel="noopener noreferrer"><span class="min-w-0 break-words">{f.label || 'Volume ' + (i + 1)}</span><span class="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">Open<Icon name="open" size={14} /></span><span class="sr-only"> (opens in a new tab)</span></a></li>
      {/each}
    </ul>
  </details>
{/if}
{#if chapters}{#await import('./BookChapters.svelte') then C}<C.default bookId={book.bookId} {lang} count={chapters} />{/await}{/if}
