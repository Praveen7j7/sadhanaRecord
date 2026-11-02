<script>
  // The week of the Status board and My group (the head, 3 Oct 2026). D5 (22 Oct 2026): a strip — ‹ the week › — because
  // the commonest move is one week back or forward, which took two selects; the month and week lists stay, in a sheet
  // opened from the week's own label. D6: [ and ] move the week too — lib/keys.js presses the buttons marked data-step.
  // `focus` is the week the screen opens on; `value` the chosen week ('' = the focus week).
  import { weekMonths, weekTitle } from '../lib/staff.js';
  import WheelSelect from './WheelSelect.svelte';
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  // back / ahead: how many weeks before and after the focus week; from: no week before this one (e.g. a devotee's start)
  let { id, focus, value = '', closes = '', closed = false, back = 12, ahead = 1, from = '', onchange = () => {} } = $props();
  const months = $derived(focus ? weekMonths(focus, back, ahead).map((m) => ({ ...m, weeks: m.weeks.filter((w) => !from || w.weekId >= from) })).filter((m) => m.weeks.length) : []);
  const cur = $derived(value || focus);
  const month = $derived(months.find((m) => m.weeks.some((w) => w.weekId === cur)) || months[0]);
  const all = $derived(months.flatMap((m) => m.weeks).sort((a, b) => (a.weekId < b.weekId ? -1 : 1)));
  const at = $derived(all.findIndex((w) => w.weekId === cur));
  const label = $derived(all[at]?.label || '');
  const choose = (w) => onchange(w === focus ? '' : w);
  const step = (d) => { const w = all[at + d]; if (w) choose(w.weekId); };
  function pickMonth(key) {
    const m = months.find((x) => x.key === key);
    if (!m) return;
    // the month's current week if it has one, else its last week
    const w = m.weeks.find((x) => x.weekId === focus) || m.weeks[0];
    choose(w.weekId);
  }
  let sheet = $state();
</script>

{#if month}
  <div class="wstrip" role="group" aria-label="Week">
    <button type="button" id={id + '-prev'} class="ws-step" data-step="prev" disabled={at <= 0} onclick={() => step(-1)} aria-label="The week before" aria-keyshortcuts="["><Icon name="back" size={18} /></button>
    <button type="button" id={id + '-pick'} class="ws-label" aria-haspopup="dialog" onclick={() => sheet.showModal()}>
      <span>{label}</span><small>{cur === focus ? weekTitle(cur) : 'Change week'}</small></button>
    <button type="button" id={id + '-next'} class="ws-step" data-step="next" disabled={at < 0 || at >= all.length - 1} onclick={() => step(1)} aria-label="The week after" aria-keyshortcuts="]"><Icon name="next" size={18} /></button>
  </div>
  {#if closes}<p class="m-0 mb-3 text-center text-xs text-muted">{cur === focus ? weekTitle(cur) + ' · ' : ''}{closed ? 'Closed' : 'Closes'} {closes}</p>{/if}
  <Sheet bind:this={sheet} titleId={id + '-sh'} title="Choose the week">
    <div class="wpick">
      <WheelSelect id={id + '-m'} label="Month" class="mb-0" value={month.key} options={months.map((m) => [m.key, m.label])} onchange={pickMonth} />
      <WheelSelect id={id + '-w'} label="Week" class="mb-0" value={cur} options={month.weeks.map((w) => [w.weekId, w.label])} onchange={(v) => { choose(v); sheet.close(); }} />
    </div>
  </Sheet>
{/if}

<style>
  .wstrip { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: stretch; gap: 6px; max-width: 520px; margin: 0 auto 6px; }
  .ws-step { display: grid; place-items: center; min-height: 44px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--text); cursor: pointer; }
  .ws-step:disabled { opacity: .4; cursor: default; }
  .ws-label { display: grid; justify-items: center; align-content: center; min-height: 44px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--r-md);
              background: var(--surface); color: var(--text); font: inherit; font-weight: 650; cursor: pointer; }
  .ws-label small { color: var(--text-secondary); font-size: var(--fs-xs); font-weight: 400; }
  .wpick { display: grid; gap: var(--sp-3); }
</style>
