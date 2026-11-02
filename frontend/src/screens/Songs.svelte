<script>
  // Vaishnava Songs (phase 21, 23 Oct 2026; the head: "a vaishnava songs sidebar tab for users"). #/songs lists the
  // English song book by its sections, with a search over titles, poets and every verse line; #/songs/<id> is one
  // song: its verses, then the translation. Both books are also offered as their PDFs, to open or to save.
  // Phase 22 (26 Oct, C1–C5): browse by language, poet, category and book (collection); a song page set like a prayer
  // book (a reading measure, verse in the book face with numbers in a quiet gutter, each verse's translation beneath it,
  // text size, the same song in the other script, a page turn at the foot); the songs transcribed from the official
  // books, marked "Awaiting proofreading" until the head has checked them. Search words and filters stay in the address.
  // Phase 23 (the head, 27 Oct: "switches for prayers, for songs, for bhajans … filter by composer"): one-tap chip rows —
  // Type (All · Prayers · Songs · Bhajans · Āratis) and Composer (the main poets, the rest behind "More…"); a second tap
  // clears; book and category behind one chip; a filter keeps the list grouped by section.
  import { loadSongs, loadText, browse, groupBy, facets, labelOf, neighbours, awaitsProof, BOOKS, lastSearch, fold } from '../lib/songs.js';
  import { pressedInView } from '../lib/chips.js';
  import { whenIdle } from '../lib/pro.svelte.js';
  import '../styles/screens.css';
  import { hashParams, replaceHashParams } from '../lib/hashq.js';
  import Search from '../ui/Search.svelte';
  import Seg from '../ui/Seg.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import Icon from '../ui/Icon.svelte';
  import ErrorState from '../ui/ErrorState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import EmptyState from '../ui/EmptyState.svelte';

  let { path = '/songs' } = $props();
  let d = $state(null);
  let err = $state(false);
  const KEYS = ['q', 'type', 'lang', 'poet', 'cat', 'col'];
  // the address's words and filters first (a reload, a shared link, a poet tapped on a song), else this visit's last
  let q = $state(''), type = $state(''), lang = $state(''), poet = $state(''), cat = $state(''), col = $state('');
  function restore() {
    const p = hashParams(), from = KEYS.some((k) => p.get(k)) ? Object.fromEntries(KEYS.map((k) => [k, p.get(k) || ''])) : lastSearch;
    q = (from.q || '').slice(0, 60); type = from.type || ''; lang = from.lang || ''; poet = from.poet || ''; cat = from.cat || ''; col = from.col || '';
  }
  function load() { err = false; loadSongs().then((x) => (d = x)).catch(() => (err = true)); }
  load();

  const id = $derived(path.split('/')[2] || '');
  // entering the list (first open, or back from a song) reads the address again
  let shownId = null;
  $effect.pre(() => { const cur = id; if (cur !== shownId) { shownId = cur; if (!cur) restore(); } });
  // the address changed from outside while the list is shown (Back between two searches, a link to the list with other
  // filters): follow it. This screen's own updates use replaceState, which fires no hashchange (Phase 22)
  $effect(() => {
    const follow = () => { if (!id && KEYS.some((k) => (hashParams().get(k) || '') !== (current()[k] || ''))) restore(); };
    addEventListener('hashchange', follow);
    return () => removeEventListener('hashchange', follow);
  });

  const song = $derived(d && id ? d.byId.get(id) || null : null);
  const near = $derived(d && song ? neighbours(d, song.id) : { prev: null, next: null });
  const f = $derived({ type, lang, poet, cat, col });
  const filtered = $derived(!!(type || lang || poet || cat || col));
  // words → the matching songs, strongest first; a filter alone → the book's sections, each with only its matching songs
  const hits = $derived(d && !id && q.trim() ? browse(d, q, f) : null);
  const groups = $derived(d && !id && !q.trim() ? (filtered ? groupBy(d, f) : d.sections) : null);
  const shown = $derived(hits ? hits.length : groups ? groups.reduce((n, g) => n + g.songs.length, 0) : 0);
  // The sections draw their first songs at once and the rest when the phone is idle (27 Oct 2026, routevitals: all
  // ~300 rows in one go blocked the first open 68 ms > 50). FIRST is well over a screen, so nothing visible waits, and
  // each heading keeps its full count.
  const FIRST = 40;
  let all = $state(false);
  $effect(() => { if (groups && !all) whenIdle(() => (all = true)); });
  const capped = (gs, n) => {
    const out = [];
    for (const g of gs) { if (n <= 0) break; out.push(g.songs.length <= n ? g : { ...g, songs: g.songs.slice(0, n), total: g.songs.length }); n -= g.songs.length; }
    return out;
  };
  const drawn = $derived(!groups || all ? groups : capped(groups, FIRST));
  const fx = $derived(d ? facets(d) : null);
  // Composer: the poets with several songs as chips (most first); the rest in the wheel behind "More…"
  const MAIN = 4;
  const mainPoets = $derived(fx ? fx.poets.filter(([, n]) => n >= MAIN) : []);
  const otherPoet = $derived(poet && !mainPoets.some(([p]) => p === poet) ? poet : '');
  const poetCount = (p) => fx?.poets.find(([x]) => x === p)?.[1] || 0;
  let moreOpen = $state(false);
  const more = $derived(moreOpen || !!(cat || col));
  const toggle = (cur, v) => (cur === v ? '' : v);   // a second tap on the chosen chip clears it
  const current = () => ({ q: q.trim(), type, lang, poet, cat, col });
  $effect(() => { if (d && !id) { const s = current(); Object.assign(lastSearch, s); replaceHashParams(s); } });
  const query = (s) => { const p = new URLSearchParams(); for (const k of KEYS) if (s[k]) p.set(k, s[k]); const t = p.toString(); return t ? '?' + t : ''; };
  // the list keeps the words and filters it was searched with: a song opened from the results comes back to them
  const listHref = $derived('#/songs' + query(id ? lastSearch : current()));
  const poetHref = (p) => '#/songs' + query({ poet: p });
  const colHref = (c) => '#/songs' + query({ col: c });
  function clearAll() { q = ''; type = ''; lang = ''; poet = ''; cat = ''; col = ''; moreOpen = false; }

  // Devanagari songs carry their language; a Roman-letter text says so (sa-Latn), so a reader voices it sensibly
  const textLang = (s) => (s.script === 'deva' ? s.lang : s.lang && s.lang !== 'en' ? s.lang + '-Latn' : undefined);
  const titleLang = (s) => (s.script === 'deva' ? s.lang : undefined);

  // text size on a song: kept on this phone (a convenience; the page works without it)
  const SIZES = [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']];
  let size = $state((() => { try { return localStorage.getItem('sg-size') || 'm'; } catch { return 'm'; } })());
  function setSize(v) { size = v; try { localStorage.setItem('sg-size', v); } catch { /* private mode */ } }

  // a verse block → stanzas: the book's "(1)" / "(refrain)" lines become each stanza's small label
  function stanzas(v) {
    const out = [];
    for (const l of v.split('\n')) {
      const m = l.match(/^\((\d+|refrain|invocation)\)\s*(.*)$/i);
      if (m) out.push({ n: /^\d/.test(m[1]) ? m[1] : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), lines: m[2] ? [m[2]] : [] });
      else if (out.length) out[out.length - 1].lines.push(l);
      else out.push({ n: '', lines: [l] });
    }
    return out.filter((x) => x.lines.length);
  }
  // a book that gives each verse its own translation: it sits beneath its verse (its "1) " number is the gutter's);
  // the English book's one translation block per song keeps its own quiet heading
  // an added book's texts arrive with its file (/songs/books/<book>.json), the first time one of its songs opens
  let loaded = $state(0), textErr = $state(false), attempt = $state(0);
  $effect(() => {
    const s = song; void attempt;
    if (d && s && !s.parts) { textErr = false; loadText(d, s).then(() => loaded++).catch(() => (textErr = true)); }
  });
  const parts = $derived((void loaded, song?.parts || null));
  const inlineTr = $derived(!!parts && parts.filter((p) => p.t).length > 1);
  const gloss = (t) => t.split('\n\n').map((x) => x.replace(/^\s*\d+\)\s*/, ''));
  const glossN = (t) => (t.match(/^\s*(\d+)\)/) || [])[1] || '';
  const verseName = (n) => (/^\d/.test(n) ? 'Verse ' + n : n);
  const other = $derived(song?.also ? d.byId.get(song.also) || null : null);
  // the other printed books a song is also in
  const alsoIn = $derived(song ? song.sources : []);
</script>

{#snippet row(s, line)}
  <li><a class="lrow" href="#/songs/{s.id}">
    <span class="lmain"><span class="lt" lang={titleLang(s)}>{s.title}</span>{#if line}<span class="ls sg-line" lang={textLang(s)}>{line}</span>{:else if s.poet}<span class="ls">{s.poet}</span>{/if}</span>
    <Icon name="next" size={18} />
  </a></li>
{/snippet}

{#if err && !d}<ErrorState title="The songs need a connection the first time" safe="" onretry={load} />
{:else if !d}<Skeleton kind="list" rows={8} />
{:else if id}
  {#if !song}
    <EmptyState icon="info" title="Song not found">{#snippet action()}<a class="btn" href="#/songs">All songs</a>{/snippet}</EmptyState>
  {:else}
    <article class="sg-song" data-size={size} data-script={song.script === 'deva' ? 'deva' : 'latn'} aria-labelledby="sg-t">
      <a class="link text-sm" href={listHref}><Icon name="back" size={16} />All songs</a>
      <header class="sg-head">
        <p class="sg-over">{song.cats.map((c) => labelOf(d.categories, c)).filter(Boolean).join(' · ') || song.section}</p>
        <h2 id="sg-t" lang={titleLang(song)}>{song.title}</h2>
        {#if song.official}<p class="sg-official">{song.official}</p>{/if}
        <p class="sg-by">
          {#if song.poet}<a class="sg-a" href={poetHref(song.poet)}>{song.poet}</a>{/if}{#each song.collections as c, i (c)}{#if song.poet || i}<span class="sg-dot" aria-hidden="true">·</span>{/if}<a class="sg-a" href={colHref(c)}>{c}</a>{/each}
        </p>
        {#if song.by}<p class="sg-said">{song.by}</p>{/if}
        <div class="sg-meta">
          {#if labelOf(d.languages, song.lang)}<span class="pill sg-pill">{labelOf(d.languages, song.lang)}{song.script === 'deva' ? ' · देवनागरी' : ''}</span>{/if}
          {#if awaitsProof(song)}<span class="pill sg-pill" data-tone="warn">Awaiting proofreading</span>{/if}
        </div>
      </header>
      <div class="sg-tools">
        {#if other}<a class="link text-sm sg-other" href="#/songs/{other.id}">{other.script === 'deva' ? 'Read in देवनागरी' : 'Read in Roman letters'}<Icon name="next" size={16} /></a>{/if}
        <div class="sg-size"><Seg id="sg-size" label="Text size" srLabel options={SIZES} value={size} onchange={setSize} /></div>
      </div>
      <div class="sg-body">
        {#if !parts}
          {#if textErr}<ErrorState title="This song needs a connection the first time" safe="" onretry={() => attempt++} />{:else}<Skeleton kind="list" rows={4} />{/if}
        {:else}
        {#each parts as p, i (i)}
          {#if p.h}<h3 class="sg-h">{p.h}</h3>
          {:else if p.v}{#each stanzas(p.v) as st, k (k)}<div class="sg-st">{#if st.n}<span class="sg-n" class:sg-nw={!/^\d/.test(st.n)} aria-label={verseName(st.n)}>{st.n}</span>{/if}<p class="sg-v" lang={textLang(song)}>{st.lines.join('\n')}</p></div>{/each}
          {:else if inlineTr}<div class="sg-st sg-tst"><span class="sg-n sg-tn" aria-hidden="true">{glossN(p.t)}</span><div class="sg-gloss" lang={p.lang || 'en'}>{#each gloss(p.t) as para, k (k)}<p>{para}</p>{/each}</div></div>
          {:else}<section class="sg-tr" aria-label="Translation" lang={p.lang || 'en'}><h3 class="sg-trh">Translation</h3>{#each p.t.split('\n\n') as para, k (k)}<p>{para}</p>{/each}</section>{/if}
        {/each}
        {/if}
      </div>
      <footer class="sg-foot">
        {#if song.page}<p class="sg-src">From <i>Vaishnava Songs</i>, compiled by ISKCON Chowpatty (ISKCON Desire Tree), page {song.page}.</p>
        {:else if song.cite}<p class="sg-src">From {song.cite}.</p>{/if}
        {#if alsoIn.length}<p class="sg-src">Also in {alsoIn.join(' · ')}.</p>{/if}
        <nav class="sg-near" aria-label="Songs">
          {#if near.prev}<a class="sg-turn" href="#/songs/{near.prev.id}"><span class="sg-turn-l"><Icon name="back" size={14} />Previous</span><span class="sg-turn-t" lang={titleLang(near.prev)}>{near.prev.title}</span></a>{:else}<span></span>{/if}
          {#if near.next}<a class="sg-turn sg-next" href="#/songs/{near.next.id}"><span class="sg-turn-l">Next<Icon name="next" size={14} /></span><span class="sg-turn-t" lang={titleLang(near.next)}>{near.next.title}</span></a>{/if}
        </nav>
      </footer>
    </article>
  {/if}
{:else}
  <div class="page-read">
    <!-- the two song books as one light strip (U7: two bordered rows with tall Download buttons took ~200–300 px before
         the search): open the PDF (the row), or save it (the icon) -->
    <section class="sg-bookbar" aria-labelledby="sg-books">
      <h2 id="sg-books" class="t-over m-0 mb-2">Song books</h2>
      <ul class="m-0 list-none p-0 sg-books">
        {#each BOOKS as b (b.lang)}<li class="sg-book">
          <a class="sg-open" href={b.url} target="_blank" rel="noopener noreferrer" lang={b.lang}><Icon name="book" size={18} /><span class="min-w-0 flex-1"><span class="block truncate font-semibold">{b.label}</span><span class="block text-xs text-muted" lang="en">PDF · {b.pages} pages</span></span><Icon name="open" size={16} /><span class="sr-only" lang="en"> (opens in a new tab)</span></a>
          <a class="iconbtn sg-dl" href={b.url} download={b.file} aria-label="Download the {b.lang === 'hi' ? 'Hindi' : 'English'} song book"><Icon name="download" size={18} /></a>
        </li>{/each}
      </ul>
    </section>
    <Search id="sg-q" label="Search songs" placeholder="Search songs, poets or a line" class="mb-3" maxlength="60" bind:value={q} pin />
    <div class="sg-filters">
      <div class="chiprow one-line counts sg-row" role="group" aria-label="Type" {@attach pressedInView}>
        <button type="button" class="chipbtn" aria-pressed={!type} onclick={() => (type = '')}>All</button>
        {#each fx.types as [c, l, n] (c)}<button type="button" class="chipbtn" aria-pressed={type === c} onclick={() => (type = toggle(type, c))}>{l}<span class="sg-n2">{n}</span></button>{/each}
        <button type="button" class="chipbtn sg-morebtn" aria-pressed={!!(cat || col)} aria-expanded={more} aria-controls="sg-more" onclick={() => (moreOpen = !more)}>Book &amp; category<Icon name={more ? 'up' : 'down'} size={16} /></button>
      </div>
      <div class="chiprow one-line counts sg-row" role="group" aria-label="Composer" {@attach pressedInView}>
        {#each mainPoets as [p, n] (p)}<button type="button" class="chipbtn" aria-pressed={poet === p} onclick={() => (poet = toggle(poet, p))}>{p}<span class="sg-n2">{n}</span></button>{/each}
        <button type="button" class="chipbtn" aria-pressed={!!otherPoet} aria-haspopup="dialog" onclick={() => (otherPoet ? (poet = '') : document.getElementById('sg-poet')?.click())}>{#if otherPoet}{otherPoet}<span class="sg-n2">{poetCount(otherPoet)}</span>{:else}More…{/if}</button>
      </div>
      <!-- the full list of poets, opened by "More…" (its own field stays out of sight) -->
      <div class="sg-wheel"><WheelSelect id="sg-poet" label="Composer" srLabel bind:value={poet} options={[['', 'All composers'], ...fx.poets.map(([p, n]) => [p, `${p} · ${n}`])]} /></div>
      {#if more}<div id="sg-more" class="sg-more">
        <WheelSelect id="sg-col" label="Book" srLabel bind:value={col} options={[['', 'All books'], ...fx.collections.map(([c, n]) => [c, `${c} · ${n}`])]} />
        <WheelSelect id="sg-cat" label="Category" srLabel bind:value={cat} options={[['', 'All categories'], ...fx.categories.map(([c, l, n]) => [c, `${l} · ${n}`])]} />
      </div>{/if}
    </div>
    {#if q.trim() || filtered}
      <div class="sg-count mb-2">
        <p class="m-0 text-sm text-muted" aria-live="polite">{hits && hits.length === 60 ? 'First 60 songs' : shown === 1 ? '1 song' : shown + ' songs'}</p>
        <button type="button" class="btn btn-text btn-sm" onclick={clearAll}>Clear</button>
      </div>
    {/if}
    {#if hits}
      {#if hits.length}
        <ul class="list" aria-label="Songs found">{#each hits as h (h.song.id)}{@render row(h.song, h.line)}{/each}</ul>
      {:else}<EmptyState icon="search" title="No song found">Try fewer words, or another filter.</EmptyState>{/if}
    {:else if groups.length}
      {#each drawn as sec, i (sec.title)}
        {@const n = sec.total ?? sec.songs.length}
        {#if n === 1 && fold(d.byId.get(sec.songs[0])?.title || '') === fold(sec.title)}
          <!-- one song named as its section ("Pranama Mantras · 1", U8): the song alone -->
          <ul class="list mb-5" aria-label={sec.title}>{@render row(d.byId.get(sec.songs[0]), '')}</ul>
        {:else}
        <section class="mb-5" aria-labelledby="sg-s{i}">
          <h3 id="sg-s{i}" class="sg-sec">{sec.title}{#if n > 1}<span class="text-sm font-normal text-muted">&nbsp;· {n}</span>{/if}</h3>
          <ul class="list">{#each sec.songs as sid (sid)}{@render row(d.byId.get(sid), '')}{/each}</ul>
        </section>
        {/if}
      {/each}
    {:else}<EmptyState icon="search" title="No song found">Try another filter.</EmptyState>{/if}
  </div>
{/if}

<style>
  @layer components {
    .sg-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-style: italic; }
    .sg-sec { margin: 0 0 var(--sp-2); font-size: var(--fs-body); }
    /* the books: open in a tab (the row), or save the file (the icon beside it); side by side from 600 px */
    .sg-bookbar { margin: 0 0 var(--sp-4); }
    .sg-books { display: grid; gap: var(--sp-2); }
    @media (min-width: 600px) { .sg-books { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .sg-book { display: flex; align-items: center; gap: var(--sp-1); min-width: 0; padding: 2px 2px 2px 0; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-elevated); }
    .sg-open { display: flex; flex: 1; align-items: center; gap: var(--sp-3); min-width: 0; min-height: var(--ctl-h); padding: 4px var(--sp-2) 4px var(--sp-3); border-radius: var(--r-md); color: var(--text); text-decoration: none; }
    .sg-open > :global(svg) { flex: none; color: var(--text-muted); }
    @media (hover: hover) { .sg-open:hover { background: var(--surface-hover); } }
    .sg-dl { color: var(--accent); }
    /* browse (phase 23): two one-line chip rows — Type, then Composer — each scrolls sideways on its own, never the page */
    .sg-filters { display: grid; gap: var(--sp-1); margin-bottom: var(--sp-3); min-width: 0; }
    .sg-row { margin-bottom: 0; }
    /* G6 (Phase 24, V25 / U6): one line that scrolls, and its LAST chip (More…, Book & category) pinned at the right end —
       the row never ends on a name cut in half ("Visvanatha Cakravarti Thakur…" read as broken with a mouse), and the
       full list is always one tap away. The pinned chip's own shadow hides what passes under it, so no edge fade. */
    .sg-row { mask-image: none !important; }
    .sg-row > :last-child { position: sticky; right: 0; z-index: 1; box-shadow: -12px 0 10px -2px var(--bg); }
    .sg-row .chipbtn { gap: 8px; }
    /* a chip's count: quiet, tabular, after the word */
    .sg-n2 { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text-muted); }
    .sg-row .chipbtn[aria-pressed='true'] .sg-n2 { color: inherit; opacity: 0.8; }
    .sg-morebtn :global(svg) { margin-right: -4px; color: var(--text-muted); }
    .sg-morebtn[aria-pressed='true'] :global(svg) { color: inherit; }
    /* the composer wheel's own field is out of sight: "More…" opens it (its sheet is a top-layer dialog) */
    .sg-wheel { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .sg-more { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); margin-top: var(--sp-2); }
    .sg-more > :global(*) { margin: 0; min-width: 0; }
    @media (max-width: 359px) { .sg-more { grid-template-columns: 1fr; } }
    .sg-count { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); min-height: 36px; }

    /* ——— the song, set like a prayer book: one reading measure, from the content's left edge ——— */
    .sg-song { --measure: 38em; --verse: 1.125rem; max-width: calc(var(--measure) + 3rem); margin-inline: 0; }   /* one left edge with the title (Phase 24, V15) */
    .sg-song[data-size='s'] { --verse: 1rem; }
    .sg-song[data-size='l'] { --verse: 1.375rem; }
    .sg-head { margin: var(--sp-5) 0 var(--sp-4); text-align: start; }   /* one left axis with the tools and the verse (V24) */
    .sg-over { margin: 0; font-size: var(--fs-caption); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
    .sg-head h2 { margin: var(--sp-2) 0 0; font-family: var(--font-serif); font-size: clamp(1.375rem, 1.2rem + 0.9vw, 1.75rem); font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; text-wrap: balance; }
    .sg-official { margin: var(--sp-1) 0 0; font-family: var(--font-serif); font-style: italic; color: var(--text-secondary); text-wrap: balance; }
    .sg-by { margin: var(--sp-3) 0 0; font-size: var(--fs-sm); font-variant-caps: all-small-caps; letter-spacing: 0.04em; color: var(--text-secondary); }
    .sg-dot { margin: 0 0.5em; color: var(--text-muted); }
    .sg-a { color: inherit; text-decoration: underline; text-decoration-color: var(--accent-line, currentColor); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    @media (hover: hover) { .sg-a:hover { color: var(--accent); } }
    .sg-said { margin: var(--sp-1) 0 0; font-size: var(--fs-sm); color: var(--text-muted); }
    .sg-meta { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: var(--sp-2); margin-top: var(--sp-3); }
    .sg-pill { font-size: var(--fs-caption); }
    /* the reading tools sit apart, under a hairline, so they never compete with the text */
    .sg-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2) var(--sp-4); padding-bottom: var(--sp-3); margin-bottom: var(--sp-6); border-bottom: 1px solid var(--border); }
    .sg-tools .link { min-height: var(--ctl-h); }
    .sg-size { width: min(100%, 17rem); margin-left: auto; }
    .sg-size :global(.field) { margin: 0; }
    .sg-body { max-width: calc(var(--measure) + 3rem); margin-inline: 0; }
    /* a stanza: its number hangs in a quiet gutter, the verse never justified, never hyphenated */
    .sg-st { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); align-items: baseline; margin: 0 0 var(--sp-6); break-inside: avoid; }
    .sg-n { padding-right: var(--sp-3); text-align: right; font-size: var(--fs-caption); font-style: normal; font-weight: 600; letter-spacing: 0.02em; color: var(--text-muted); font-variant-numeric: tabular-nums lining-nums; }
    .sg-st:not(:has(.sg-n)) > * { grid-column: 1 / -1; }
    /* a word, not a number (Refrain, Invocation): a small caption above the stanza, in the verse's column — in the 2.25rem
       gutter it ran over the first line at every width (U3) */
    .sg-n.sg-nw { grid-column: 2; padding: 0; margin-bottom: var(--sp-1); text-align: start; text-transform: uppercase; letter-spacing: 0.08em; }
    .sg-v { grid-column: 2; margin: 0; white-space: pre-line; text-align: start; hyphens: none; overflow-wrap: anywhere;
      font-family: var(--font-serif); font-style: italic; font-size: var(--verse); line-height: 1.7;
      text-rendering: optimizeLegibility; font-kerning: normal; font-variant-ligatures: common-ligatures; font-variant-numeric: tabular-nums; hanging-punctuation: first; }
    /* Devanagari: upright, in the phone's own Devanagari face, with room for the marks above and below */
    .sg-song[data-script='deva'] .sg-v { font-family: var(--font-sans); font-style: normal; line-height: 1.9; }
    /* a verse's own translation, beneath it: the body face, muted, a little smaller than the verse */
    .sg-tst { margin-top: calc(-1 * var(--sp-4)); }
    .sg-tn { visibility: hidden; }
    .sg-gloss { grid-column: 2; font-size: var(--fs-body); line-height: 1.65; color: var(--text-secondary); text-wrap: pretty; }
    .sg-gloss p { margin: 0 0 var(--sp-2); }
    .sg-gloss p:last-child { margin-bottom: 0; }
    .sg-h { margin: var(--sp-7) 0 var(--sp-4); text-align: start; font-size: var(--fs-caption); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
    /* the English book's one translation per song, under a quiet heading */
    .sg-tr { margin: var(--sp-7) 0 var(--sp-6); padding-top: var(--sp-5); border-top: 1px solid var(--border); }
    .sg-trh { margin: 0 0 var(--sp-3); font-size: var(--fs-caption); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
    .sg-tr p { margin: 0 0 var(--sp-3); line-height: 1.65; color: var(--text-secondary); text-wrap: pretty; }
    .sg-tr p:last-child { margin-bottom: 0; }
    /* the foot: where it comes from, then a page turn */
    .sg-foot { margin-top: var(--sp-7); }
    .sg-src { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); color: var(--text-muted); text-align: start; text-wrap: pretty; }
    .sg-near { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-top: var(--sp-5); padding-top: var(--sp-4); border-top: 1px solid var(--border); }
    .sg-turn { display: flex; flex-direction: column; gap: 2px; min-width: 0; min-height: 48px; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); color: var(--text); text-decoration: none; }
    @media (hover: hover) { .sg-turn:hover { background: var(--surface-hover); } }
    .sg-turn-l { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-caption); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
    .sg-turn-t { font-family: var(--font-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sg-next { grid-column: 2; align-items: flex-end; text-align: right; }
    @media (max-width: 420px) { .sg-near { grid-template-columns: 1fr; } .sg-next { grid-column: 1; } }
  }
</style>
