<script>
  // Go to… (Phase 7, interaction improvements): the head and coordinators jump to any screen they may open or to a
  // devotee (name, phone or IYF ID) without walking the menus. Opened by the search button in the top bar, "/" or
  // Ctrl / ⌘ K on a computer. ↑ ↓ move, Enter opens, Escape closes. Devotees come from members.list (the server's own
  // search, within what this person may see); screens from the navigation model (lib/nav.js). Loaded only when first opened.
  import { session } from '../lib/session.svelte.js';
  import { scopesOf } from '../lib/scopes.js';
  import { navFor } from '../lib/nav.js';
  import { call, errorMessage } from '../lib/api.js';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  let { onclose } = $props();

  let sheet = $state(), q = $state(''), sel = $state(0), people = $state([]), busy = $state(false), err = $state(''), input = $state();
  const screens = $derived.by(() => { const n = navFor(scopesOf(session.user)); return [...(n.top ? [n.top] : []), ...n.sections.flatMap((s) => s.items)]; });
  const norm = (s) => String(s || '').toLowerCase();
  const results = $derived([
    ...screens.filter((s) => !q.trim() || norm(s.label).includes(norm(q.trim()))).slice(0, q.trim() ? 6 : 8).map((s) => ({ key: 's:' + s.id, href: s.href, title: s.label, sub: 'Screen', icon: s.icon })),
    ...people.map((p) => ({ key: 'p:' + p.login, href: '#/devotee/' + encodeURIComponent(p.login), title: p.name, sub: [p.batchName || p.batchId, p.iyfId, p.login].filter(Boolean).join(' · '), icon: 'user' })),
  ]);
  $effect(() => { results.length; if (sel >= results.length) sel = Math.max(0, results.length - 1); });

  // devotees: ask the server once the typing pauses (2+ characters)
  let timer, asked = 0;
  $effect(() => {
    const t = q.trim();
    clearTimeout(timer);
    if (t.length < 2) { people = []; err = ''; return; }
    timer = setTimeout(async () => {
      const mine = ++asked; busy = true; err = '';
      try { const r = await call('members.list', { q: t, limit: 8 }); if (mine === asked) people = (r.rows || []).slice(0, 8); }
      catch (e) { if (mine === asked) { people = []; err = errorMessage(e); } }
      finally { if (mine === asked) busy = false; }
    }, 250);
    return () => clearTimeout(timer);
  });

  export function open() { q = ''; sel = 0; people = []; sheet.showModal(); setTimeout(() => input?.focus(), 30); }
  // a result is a plain link: the dialog's Back handling (ui/backclose.js) puts it in place of the dialog's history entry
  const go = (i) => document.querySelector(`#cs-${i} a`)?.click();
  function key(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
  }
</script>

<Sheet bind:this={sheet} titleId="cs-t" title="Go to" class="cs-sheet" {onclose}>
  <label class="sr-only" for="cs-q">Search screens and devotees</label>
  <div class="search">
    <Icon name="search" size={18} />
    <input bind:this={input} id="cs-q" class="input" type="search" autocomplete="off" placeholder="A screen, or a devotee's name, phone or IYF ID" bind:value={q} onkeydown={key}
      role="combobox" aria-expanded="true" aria-controls="cs-list" aria-activedescendant={results[sel] ? 'cs-' + sel : undefined} />
  </div>
  <ul class="cs-list" id="cs-list" role="listbox" aria-label="Results">
    {#each results as r, i (r.key)}
      <li id={'cs-' + i} role="option" aria-selected={i === sel}>
        <a class="cs-row" href={r.href} onmousemove={() => (sel = i)}>
          <span class="cs-ico" aria-hidden="true"><Icon name={r.icon} size={18} /></span>
          <span class="min-w-0 flex-1"><span class="cs-t">{r.title}</span><span class="cs-s">{r.sub}</span></span>
        </a>
      </li>
    {/each}
  </ul>
  {#if busy}<p class="cs-note" role="status">Searching…</p>
  {:else if err}<p class="cs-note" role="alert">{err}</p>
  {:else if q.trim().length >= 2 && !people.length}<p class="cs-note" role="status">No devotee matches “{q.trim()}”.</p>{/if}
  <p class="cs-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>Enter</kbd> open · <kbd>Esc</kbd> close</p>
</Sheet>

<style>
  @layer components {
    .cs-list { margin: 10px 0 0; padding: 0; list-style: none; max-height: min(52vh, 420px); overflow-y: auto; }
    .cs-row { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 10px; border-radius: var(--r-md); color: var(--text); text-decoration: none; }
    li[aria-selected='true'] .cs-row { background: var(--accent-soft); }
    .cs-ico { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--surface-muted); color: var(--accent); }
    .cs-t { display: block; font-weight: 600; overflow-wrap: anywhere; }
    .cs-s { display: block; color: var(--text-muted); font-size: var(--fs-sm); overflow-wrap: anywhere; }
    .cs-note { margin: 8px 4px 0; color: var(--text-muted); font-size: var(--fs-sm); }
    .cs-keys { margin: 12px 4px 0; color: var(--text-muted); font-size: var(--fs-caption); }
    @media (hover: none) { .cs-keys { display: none; } }
    kbd { display: inline-block; min-width: 1.6em; padding: 0 4px; margin-right: 2px; border: 1px solid var(--border-strong); border-radius: 4px; font: 600 0.75rem/1.4 var(--font-sans); text-align: center; }
  }
</style>
