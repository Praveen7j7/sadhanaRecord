<script module>
  // one look-up of the journals per person while the app is open (a facilitator's is refused: asked once, not per day)
  let asked = null, askedFor = '';
</script>

<script>
  // "That day's practice": what a devotee heard and read on one day, for the staff reading their week (facilitator,
  // coordinator, the IYF head). Only what the day already holds: hearing minutes and topics (a journal lecture or a typed
  // topic), reading minutes and the book (from the list or typed). Lecture and book names come from the journals this
  // phone already keeps (refdata); when they are not here (a facilitator has no journal of their own), a lecture is named
  // by its journal week and a book plainly.
  import { session } from '../lib/session.svelte.js';
  import { getJournals } from '../lib/refdata.js';
  import Icon from './Icon.svelte';
  // day: the day's answers (a submitted week), or null when the week is still being filled (only its state is shared)
  let { day = null } = $props();

  let journals = $state(null);
  const me = session.user?.login || '';
  if (!asked || askedFor !== me) { askedFor = me; asked = getJournals(me).catch(() => null); }
  asked.then((j) => (journals = j));
  const lectures = $derived(new Map((journals?.lectures || []).map((l) => [l.lectureId, l])));
  const books = $derived(new Map((journals?.books || []).map((b) => [b.bookId, b.title])));

  const lectureName = (id) => lectures.get(id)?.title || (/-W0*(\d+)-/.exec(id) ? `Journal lecture, week ${/-W0*(\d+)-/.exec(id)[1]}` : 'Journal lecture');
  const lectureWhere = (id) => { const l = lectures.get(id); return l ? `${l.journal} journal · week ${l.week}` : ''; };
  const heard = $derived((day?.hearing || []).map((h) => (h.lectureId ? { name: lectureName(h.lectureId), where: lectureWhere(h.lectureId) } : { name: h.text, where: '' })));
  const book = $derived(day?.reading ? (day.reading.bookId ? books.get(day.reading.bookId) || 'A book from the list' : day.reading.text) : '');
  const mins = (n) => (n > 0 ? `${n} min` : '');
</script>

<section class="dp" aria-label="That day's practice">
  <p class="t-over m-0">That day's practice</p>
  {#if !day}
    <p class="dp-none">Hearing and reading show here once the week is submitted.</p>
  {:else}
    <div class="dp-item">
      <span class="dp-ico" aria-hidden="true"><Icon name="hear" size={18} /></span>
      <div class="min-w-0">
        <p class="dp-h">Hearing{#if mins(day.hearingMin)}<span class="dp-min">{' · ' + mins(day.hearingMin)}</span>{/if}</p>
        {#if heard.length}
          <ul class="dp-list">{#each heard as h}<li>{h.name}{#if h.where}<span class="dp-where">{h.where}</span>{/if}</li>{/each}</ul>
        {:else}<p class="dp-none">{day.hearingMin > 0 ? 'No topic given' : 'No hearing that day'}</p>{/if}
      </div>
    </div>
    <div class="dp-item">
      <span class="dp-ico" aria-hidden="true"><Icon name="book" size={18} /></span>
      <div class="min-w-0">
        <p class="dp-h">Reading{#if mins(day.readingMin)}<span class="dp-min">{' · ' + mins(day.readingMin)}</span>{/if}</p>
        {#if book}<p class="dp-book">{book}</p>
        {:else}<p class="dp-none">{day.readingMin > 0 ? 'No book given' : 'No reading that day'}</p>{/if}
      </div>
    </div>
  {/if}
</section>

<style>
  @layer components {
    /* visually below the day's scores: a quiet muted panel, no border, small type */
    .dp { display: grid; gap: 12px; align-content: start; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface-muted); font-size: var(--fs-sm); line-height: var(--lh-sm); min-width: 0; }
    .dp-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; }
    .dp-ico { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); }
    .dp-h { margin: 0 0 2px; font-weight: 650; color: var(--text); }
    .dp-min { font-weight: 500; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .dp-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
    .dp-list li, .dp-book { margin: 0; color: var(--text); overflow-wrap: anywhere; }
    .dp-where { display: block; color: var(--text-muted); font-size: var(--fs-caption); }
    .dp-none { margin: 0; color: var(--text-muted); }
  }
</style>
