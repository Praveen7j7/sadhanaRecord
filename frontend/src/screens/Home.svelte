<script>
  import Quotes from '../ui/Quotes.svelte';
  // Home for every login. A devotee (also a coordinator or the master) sees their own sadhana first, then a compact
  // "My batch" block; staff with no sadhana of their own see batch work first. Birthdays (staff) load on their own.
  import { session } from '../lib/session.svelte.js';
  import { scopesOf, canRequests } from '../lib/scopes.js';
  import { fmtLong } from '../lib/dates.js';
  import { todayIST } from '../lib/dates.js';
  import { cachedMeta } from '../lib/meta.js';
  import DevoteeHome from './DevoteeHome.svelte';
  import Icon from '../ui/Icon.svelte';
  import { lazy, loadedOnce } from '../lib/lazy.js';
  const u = $derived(session.user);
  const sc = $derived(scopesOf(u));
  const nameOf = (id) => (cachedMeta().batches || []).find((b) => b.batchId === id)?.name || id;
  const batches = $derived(sc.master ? 'All batches' : sc.coordinator.map(nameOf).join(', ') || (sc.facilitator && !sc.devotee ? 'TRD (temple resident)' : ''));   // TRD: a facilitator with no batch
  // a team login ("SPS Team") is greeted without a first name, never "Hare Krishna, SPS" (8 Oct 2026)
  const greetName = $derived(!u?.name || /\b(team|office|admin|desk|head)\b/i.test(u.name) ? '' : u.name.split(' ')[0]);
</script>

<!-- a row as ui/Row draws it, written out here so Row stays out of the startup file (Phase 9: startup ≤ 55 KB) -->
{#snippet row(href, icon, label, sub = '', badge = '')}
  <li><a class="lrow" {href}><span class="lico" aria-hidden="true"><Icon name={icon} size={18} /></span><span class="lmain"><span class="lt">{label}</span>{#if sub}<span class="ls">{sub}</span>{/if}</span><span class="lend">{#if badge}<span class="pill" data-tone="accent">{badge}</span>{/if}<Icon name="next" size={18} /></span></a></li>
{/snippet}

{#if sc.devotee}<DevoteeHome last={!sc.facilitator && !canRequests(sc)} />
{:else}
  <header class="greet">
    <p class="date t-over">{fmtLong(todayIST())}</p>
    <h2>Hare Krishna{greetName ? ', ' + greetName : ''}</h2>
    <p class="sub">{sc.master ? 'IYF head' : sc.coordinator.length ? 'Batch coordinator' : sc.facilitator ? 'Facilitator' : ''}{batches ? ' · ' + batches : ''}</p>
  </header>
{/if}

{#if sc.facilitator}
  <div data-area="coordinator" class:mt-2={sc.devotee}>
    <div class="block-h"><h2>Facilitator</h2></div>
    <ul class="list" aria-label="Facilitator">
      {@render row('#/my-devotees', 'users', 'My students', 'Their reports by week and by day; call or chat')}
      <!-- the target card (17 Oct 2026). It was built and routed and nothing linked to it, so a
           facilitator could not reach the one screen they are meant to fill. -->
      {@render row('#/card', 'report', 'My targets', 'What you set for this phase, and how the weeks are going')}
    </ul>
  </div>
{/if}
{#if canRequests(sc)}
  <!-- staff (Phase 5): Needs you, this week per batch, people to nudge — a staff-only file, never in a devotee's startup -->
  <div class:mt-2={sc.devotee}>
    {#if sc.devotee}<div class="block-h" data-area="coordinator"><h2>My batch</h2></div>{/if}
    {#await loadedOnce(sc.master ? 'HeadHome' : 'StaffHome', () => lazy(() => (sc.master ? import('../master/HeadHome.svelte') : import('../coord/StaffHome.svelte'))))}<div class="sk-block" style="min-height: 180px"></div>{:then m}<m.default compact={sc.devotee} />{:catch}<ul class="list">{@render row('#/requests', 'inbox', 'Requests')}{@render row('#/batch', 'users', 'Batch status')}</ul>{/await}
  </div>
{/if}
<!-- the IYF head (Phase 6): decisions, system health and the batches come first (master/HeadHome); Admin is in the menu -->
<!-- staff with no sadhana of their own: the work first, then the day's painting with the verse beneath — the same
     devotional block as a devotee's Home (the head, 10 Oct 2026: "viewing the Supreme Personalities' photos is always
     good"); loaded after the first screen, so the painting is never on Home's critical path -->
{#if !sc.devotee}
  <section class="cblock dcard staff-dcard mt-6" aria-label="The painting and the verse">
    {#await loadedOnce('Darshan', () => import('../ui/Darshan.svelte')) then D}<D.default variant="card" pool="everyday" titled rotate sizes="(min-width: 1024px) 480px, (min-width: 600px) 90vw, 100vw" />{:catch}{/await}
    <Quotes fit={!sc.devotee} />
  </section>
{/if}
<!-- birthdays: a small staff-only file, shown only when someone has one today or this week; last on the screen, so its
     late arrival never moves anything (CLS 0) -->
{#if canRequests(sc) && sc.devotee}<div data-area="coordinator" class="mt-4">{#await loadedOnce('Birthdays', () => lazy(() => import('../coord/Birthdays.svelte'))) then m}<m.default />{/await}</div>{/if}

<style>
  /* a wide screen (the head, 10 Oct 2026: "the photo on the left, the verse on the right, using the empty space"): the
     painting on the left, its title and the verse beside it, the card across the content width; a phone keeps the
     stacked card (painting, title, verse) */
  @media (min-width: 1024px) {
    .staff-dcard { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); grid-template-rows: auto auto 1fr; column-gap: var(--sp-6); padding: 0; }
    .staff-dcard > :global(figure.darshan) { grid-column: 1; grid-row: 1 / span 3; align-self: stretch; width: 100%; aspect-ratio: auto; min-height: clamp(360px, 36vw, 540px); border-radius: var(--r-lg) 0 0 var(--r-lg); }   /* its column's width, as tall as the verse beside it (the painting fills it, cover) */
    .staff-dcard > :global(:not(figure)) { grid-column: 2; margin-inline: 0 var(--sp-6); }
    .staff-dcard > :global(.dp-title) { margin-top: var(--sp-6); }
    .staff-dcard > :global(:last-child) { margin-bottom: var(--sp-6); align-self: start; }
  }
</style>
