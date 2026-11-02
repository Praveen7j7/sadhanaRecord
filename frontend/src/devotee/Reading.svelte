<script>
  // Reading: the current book with its PDF(s), then the books of a level (the devotee's own first) with a search.
  // Level and search are kept in the address (lv, bq); the section — English or हिन्दी (19 Oct 2026) — too (bl), and it
  // is remembered on this phone for the next visit.
  import { session } from '../lib/session.svelte.js';
  import { homeEntry, loadHome } from '../lib/weekstore.js';
  import { getJournals, getCurrentBook } from '../lib/refdata.js';
  import { hashParams, replaceHashParams } from '../lib/hashq.js';
  import ErrorState from '../ui/ErrorState.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import Icon from '../ui/Icon.svelte';
  import BookList from './BookList.svelte';
  import BookFiles from './BookFiles.svelte';
  import Seg from '../ui/Seg.svelte';
  import { LANGS, normLang, bookTitle } from '../lib/books.js';
  import { rememberScroll } from '../lib/remember.js';

  const login = session.user?.login || '';
  const he = homeEntry();
  const jv = $derived(he.data?.versions?.journals);
  let j = $state(null);
  let err = $state(null);
  const p0 = hashParams();
  let filters = $state({ level: p0.get('lv') || '', q: (p0.get('bq') || '').slice(0, 60) });
  const LKEY = 'sr.booklang';
  let lang = $state(normLang(p0.get('bl') || (() => { try { return localStorage.getItem(LKEY); } catch { return null; } })()));
  function setLang(l) { lang = normLang(l); filters.level = ''; try { localStorage.setItem(LKEY, lang); } catch { /* storage blocked */ } }
  const remembered = getCurrentBook(login);
  loadHome();
  const getJ = () => { err = null; if (jv) getJournals(login, jv).then((r) => (j = r)).catch((e) => (err = e || true)); else loadHome(true); };
  $effect(() => { if (jv) getJ(); });
  $effect(() => { const v = { lv: filters.level, bq: filters.q.trim(), bl: lang === 'hi' ? 'hi' : '' }; if (j) replaceHashParams(v); });

  // D7: the list's scroll and the open book / canto come back on the next visit (this phone, this person)
  const RKEY = 'sr.rd.' + login;
  let sc = null, restored = false;
  $effect(() => { sc = rememberScroll(RKEY + '.y'); return () => sc.stop(); });
  $effect(() => { if (j && !restored) { restored = true; sc?.restore(); } });
  const bookId = $derived(remembered?.bookId || he.data?.progress?.currentBookId || '');
  const current = $derived(j?.books.find((b) => b.bookId === bookId));
</script>

{#if (err || (he.error && !jv)) && !j}<ErrorState error={err === true ? null : err || he.error} title="Books need a connection" safe="" onretry={getJ} />
{:else if !j}<Skeleton kind="list" rows={6} />
{:else}
  <div class="page-read">
    {#if current || remembered?.text}
      <!-- the one block of the screen: the book being read now, with its PDF(s) -->
      <section class="cblock" aria-labelledby="rd-cur">
        <p class="t-over m-0">Your current book</p>
        <h2 id="rd-cur" class="mb-1 mt-2 flex items-start gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-brand"><Icon name="book" size={20} /></span><span class="min-w-0 flex-1 break-words pt-1" lang={lang === 'hi' && current?.titleHi ? 'hi' : undefined}>{current ? bookTitle(current, lang) : remembered.text}</span>{#if current}<span class="pill mt-1.5 shrink-0">{current.level}</span>{/if}</h2>
        {#if current}<BookFiles book={current} {lang} />{/if}
      </section>
    {/if}
    <section aria-labelledby="rd-all">
      <h3 id="rd-all" class="sr-only">Books</h3>
      <div class="rd-lang"><Seg id="rd-lang" label="Language" srLabel options={LANGS} value={lang} onchange={setLang} /></div>
      <BookList books={j.books} ownLevel={j.ownBookLevel} bind:filters idp="rd" {lang} remember={RKEY} pin />
      {#if j.bookNote}<p class="hint mb-0 mt-3">{j.bookNote}</p>{/if}
    </section>
  </div>
{/if}

<style>
  /* the two sections sit above the levels; a narrow, even switch rather than a full-width bar on a computer */
  .rd-lang { max-width: 20rem; }
  .rd-lang :global(.field) { margin-bottom: var(--sp-3); }
</style>
