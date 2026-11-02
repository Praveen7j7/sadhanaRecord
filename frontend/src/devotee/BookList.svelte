<script>
  // Books by level (the devotee's own level first chosen) with a title search; 8 rows, then "Show all".
  // Each row opens its own PDF (one file), lists its volumes (several), or says it is not in the library yet.
  // onPick: the day form's picker (a Choose button on each row).
  // lang (19 Oct 2026): 'en' is every book with its English PDFs, exactly as before; 'hi' only the books with a Hindi
  // PDF, under their Hindi title, with a canto's chapters behind its own toggle.
  import { levelsOf, levelIn, filterBooks, filesIn, booksIn, bookTitle } from '../lib/books.js';
  import Icon from '../ui/Icon.svelte';
  import Search from '../ui/Search.svelte';
  import EmptyState from '../ui/EmptyState.svelte';
  import { pressedInView } from '../lib/chips.js';
  import { recall, keep } from '../lib/remember.js';
  // remember: the Reading screen keeps the book left open for the next visit (D7); the day form's picker does not
  let { books = [], ownLevel = null, filters = $bindable(), idp = 'bl', onPick = null, lang = 'en', remember = '', pin = false } = $props();
  let openId = $state(remember ? recall(remember + '.open', '') : '');
  function toggled(b, e) { if (!remember) return; if (e.currentTarget.open) openId = b.bookId; else if (openId === b.bookId) openId = ''; keep(remember + '.open', openId || null); }
  const FIRST = 8;
  let all = $state(false);
  const pool = $derived(booksIn(books, lang));
  const levels = $derived(levelsOf(pool));
  const level = $derived(levelIn(filters.level, ownLevel, levels));
  const list = $derived(filterBooks(pool, level, filters.q));
  const elsewhere = $derived(level !== 'all' && filters.q.trim() && !list.length ? filterBooks(pool, 'all', filters.q).length : 0);
  const shown = $derived(all ? list : list.slice(0, FIRST));
  $effect(() => { level; filters.q; lang; all = false; });
  const filesOf = (b) => filesIn(b, lang);
  const chaptersOf = (b) => (lang === 'hi' ? b.chaptersHi || 0 : 0);
</script>

<!-- the Hindi section names a book in Hindi, with its English title under it so it is recognised either way -->
{#snippet title(b)}<span class="t" lang={lang === 'hi' && b.titleHi ? 'hi' : undefined}>{bookTitle(b, lang)}{#if lang === 'hi' && b.titleHi}<span class="bk-en" lang="en">{b.title}</span>{/if}</span>{/snippet}

<div class="chiprow one-line" role="group" aria-label="Level" {@attach pressedInView}>
  {#each levels as l}<button type="button" class="chipbtn" aria-pressed={level === l} onclick={() => (filters.level = l)}>{l}{l === ownLevel ? ' (yours)' : ''}</button>{/each}
  <button type="button" class="chipbtn" aria-pressed={level === 'all'} onclick={() => (filters.level = 'all')}>All</button>
</div>
<Search id="{idp}-q" label="Search books" placeholder="Search books" class="mb-3" maxlength="60" bind:value={filters.q} {pin} />

<!-- one grouped list; the level tag only when every level is shown (otherwise it is the chip above) -->
<ul class="list mb-2 bk-list" aria-label="Books">
  {#each shown as b (b.bookId)}
    {@const files = filesOf(b)}
    {@const pick = onPick ? b : null}
    {@const chapters = chaptersOf(b)}
    {#if files.length > 1 || chapters}
      <li><details class="bk" data-level={b.level} open={!!remember && openId === b.bookId} ontoggle={(e) => toggled(b, e)}>
        <summary class="bk-row">{@render title(b)}{#if level === 'all'}<span class="pill shrink-0">{b.level}</span>{/if}<span class="more shrink-0 text-sm font-semibold text-brand">{files.length > 1 ? files.length + ' PDFs' : 'PDF'}{chapters ? ` · ${chapters} chapters` : ''}</span></summary>
        <ul class="bk-vols">
          {#each files as f, i (i)}<li><a class="rowlink min-h-11 py-1 text-sm" href={f.url} target="_blank" rel="noopener noreferrer"><span>{f.label || 'Volume ' + (i + 1)}</span><Icon name="open" size={16} /><span class="sr-only"> (opens in a new tab)</span></a></li>{/each}
          <!-- loaded on demand: only a canto in the Hindi section needs it, so it stays out of every devotee's screens chunk -->
          {#if chapters}<li>{#await import('./BookChapters.svelte') then C}<C.default bookId={b.bookId} {lang} count={chapters} {remember} />{/await}</li>{/if}
          {#if pick}<li><button type="button" class="btn btn-primary" onclick={() => onPick({ bookId: b.bookId })}>Choose this book</button></li>{/if}
        </ul>
      </details></li>
    {:else}
      <li class="bk" data-level={b.level}><div class="bk-row">
        {@render title(b)}{#if level === 'all'}<span class="pill shrink-0">{b.level}</span>{/if}
        {#if files.length}<a class="link shrink-0 text-sm" href={files[0].url} target="_blank" rel="noopener noreferrer">Open PDF<Icon name="open" size={14} /><span class="sr-only"> of {bookTitle(b, lang)} (opens in a new tab)</span></a>
        {:else}<span class="shrink-0 text-xs text-muted">No PDF yet</span>{/if}
        {#if pick}<button type="button" class="btn btn-sm shrink-0" onclick={() => onPick({ bookId: b.bookId })}>Choose</button>{/if}
      </div></li>
    {/if}
  {:else}
    <EmptyState tag="li" icon="book" title={'No book found' + (level !== 'all' ? ' in ' + level : '')}>Try another word{elsewhere ? '' : ' or level'}.{#snippet action()}{#if elsewhere}<button type="button" class="btn" onclick={() => (filters.level = 'all')}>{elsewhere} in all levels</button>{/if}{/snippet}</EmptyState>
  {/each}
</ul>
{#if list.length > FIRST && !all}<button type="button" class="btn btn-block" onclick={() => (all = true)}>Show all {list.length}</button>{/if}

<style>
  /* inside the grouped list a book row has no box of its own */
  .bk-list .bk { border: 0; border-radius: 0; background: none; }
  .list.bk-list > li + li { border-top: 1px solid var(--border); }
  .bk-list .bk-row { min-height: 56px; }
  .bk-en { display: block; margin-top: 2px; color: var(--text-secondary); font-size: var(--fs-xs, 0.75rem); font-weight: 450; }
</style>
