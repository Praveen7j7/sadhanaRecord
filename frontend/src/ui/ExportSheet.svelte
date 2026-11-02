<script>
  // Export (Phase 9, item 21; the head, 9 Oct 2026: "professional selection ways by which any data can be fetched from the
  // sadhana to profile perspective"). One sheet: start from a ready-made choice, then say what each row is (a devotee,
  // a devotee's week, a devotee's day), tick exactly the fields (grouped: person, contact, membership, personal, week
  // scores, attendance, day answers, a sadhana summary), the batches, the dates and filters; Download makes a CSV that
  // opens in Excel and Google Sheets. The server sends only the ticked fields, a page at a time, and checks every rule;
  // the choices are remembered on this phone for next time. Loaded only when Export is pressed.
  import Sheet from './Sheet.svelte';
  import Seg from './Seg.svelte';
  import DateInput from './DateInput.svelte';
  import WheelSelect from './WheelSelect.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import { call, errorMessage } from '../lib/api.js';
  import { cachedMeta } from '../lib/meta.js';
  import { todayIST, addDaysIso, fmtShort } from '../lib/dates.js';
  import { toast } from '../lib/pro.svelte.js';
  import { toCsv, fileName, saveCsv } from '../lib/csv.js';
  import { EXPORT_PRESETS } from '$shared/exportfields.js';

  let dlg = $state(), cat = $state(null), err = $state(''), busy = $state(false), progress = $state(''), fe = $state({});
  let presetId = $state(''), grain = $state('weeks'), chosen = $state([]), batches = $state([]), range = $state('month'), from = $state(''), to = $state(''), status = $state(''), facilitator = $state('');
  const KEY = 'sr.export';
  const remembered = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const remember = () => { try { localStorage.setItem(KEY, JSON.stringify({ presetId, grain, chosen, range, status })); } catch { /* storage blocked */ } };

  // the dates, in Indian time: quick choices or any range (at most 6 months)
  const RANGES = [['week', 'This week'], ['4w', 'Last 4 weeks'], ['month', 'This month'], ['lastMonth', 'Last month'], ['3m', 'Last 3 months'], ['custom', 'Choose dates']];
  function rangeOf(r) {
    const t = todayIST(), dow = (new Date(t + 'T12:00:00Z').getUTCDay() + 6) % 7, mon = addDaysIso(t, -dow), first = t.slice(0, 8) + '01';
    if (r === 'week') return [mon, t];
    if (r === '4w') return [addDaysIso(mon, -21), t];
    if (r === 'month') return [first, t];
    if (r === 'lastMonth') { const end = addDaysIso(first, -1); return [end.slice(0, 8) + '01', end]; }
    if (r === '3m') return [addDaysIso(t, -91), t];
    return [from || first, to || t];
  }
  const setRange = (r) => { range = r; if (r !== 'custom') [from, to] = rangeOf(r); };

  /** Opens the sheet, starting from a ready-made choice (or what was used last), for these batches. */
  export async function open(startFrom = '', batchIds = []) {
    err = ''; fe = {}; progress = '';
    const last = remembered(), p = EXPORT_PRESETS.find((x) => x.id === startFrom);
    if (['staff', 'batches', 'activity'].includes(startFrom)) { presetId = ''; grain = startFrom; setRange('month'); }
    else if (p) usePreset(p); else if (last) { presetId = last.presetId || ''; grain = last.grain || 'weeks'; chosen = last.chosen || []; status = last.status || ''; setRange(last.range || 'month'); }
    else usePreset(EXPORT_PRESETS[0]);
    dlg.showModal();
    if (!cat) { try { cat = await call('exports.catalog'); } catch (e) { err = errorMessage(e); return; } }
    const mine = cat.batches.map((b) => b.id);
    batches = batchIds.filter((b) => mine.includes(b)).length ? batchIds.filter((b) => mine.includes(b)) : mine.slice(0, 1);
    chosen = chosen.filter((id) => cat.fields.some((f) => f.id === id));
  }
  function usePreset(p) { presetId = p.id; grain = p.grain; chosen = [...p.fields]; status = p.status || ''; facilitator = ''; setRange(p.range || 'month'); }

  const fixed = $derived(['staff', 'batches', 'activity'].includes(grain));
  const offered = $derived((cat?.fields || []).filter((f) => f.grains.includes(grain)));
  const groups = $derived.by(() => { const out = []; for (const f of offered) { if (out.at(-1)?.name !== f.group) out.push({ name: f.group, fields: [] }); out.at(-1).fields.push(f); } return out; });
  const picked = $derived(offered.filter((f) => chosen.includes(f.id)));
  const needsDates = $derived(grain === 'weeks' || grain === 'days' || grain === 'activity' || picked.some((f) => f.group === 'Sadhana summary'));
  const toggle = (id) => { chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]; presetId = ''; };
  const setGroup = (g, on) => { const ids = g.fields.map((f) => f.id); chosen = on ? [...new Set([...chosen, ...ids])] : chosen.filter((x) => !ids.includes(x)); presetId = ''; };
  const facs = $derived((cachedMeta().facilitators || []).map((n) => [n, n]));
  const weeksIn = $derived(needsDates && from && to && to >= from ? Math.floor((Date.parse(to) - Date.parse(from)) / 864e5 / 7) + 1 : 0);

  async function download() {
    fe = {}; err = '';
    if (!fixed && !batches.length) fe.batches = 'Choose a batch.';
    if (!fixed && !picked.length) fe.fields = 'Tick at least one field.';
    if (needsDates && (!from || !to)) fe.dates = 'Choose the dates.';
    else if (needsDates && to < from) fe.dates = 'The end is before the start.';
    else if (needsDates && (Date.parse(to) - Date.parse(from)) / 864e5 > (cat?.maxDays || 184)) fe.dates = 'At most 6 months at a time.';
    if (Object.keys(fe).length) return;
    busy = true; remember();
    const data = { grain, ...(fixed ? {} : { fields: picked.map((f) => f.id), batchIds: batches }), ...(needsDates ? { from, to } : {}),
      ...(!fixed && (status || facilitator) ? { filters: { ...(grain === 'weeks' && status ? { status } : {}), ...(facilitator ? { facilitator } : {}) } } : {}) };
    const total = grain === 'weeks' || grain === 'days' ? weeksIn : grain === 'people' ? batches.length : 0;
    let cursor, columns = null, rows = [], page = 0;
    try {
      do {
        page++; progress = total > 1 ? `Getting ${grain === 'people' ? 'batch' : 'week'} ${Math.min(page, total)} of ${total}…` : 'Getting the rows…';
        const r = await call('exports.page', { ...data, ...(cursor ? { cursor } : {}) });
        columns ||= r.columns; rows = rows.concat(r.rows); cursor = r.next;
      } while (cursor && page < 200);
      if (!rows.length) { toast('Nothing to export for these choices.', { kind: 'info' }); }
      else {
        const label = presetId ? EXPORT_PRESETS.find((p) => p.id === presetId)?.label : fixed ? grain : `by ${grain === 'people' ? 'devotee' : grain === 'weeks' ? 'week' : 'day'}`;
        const names = (cat?.batches || []).filter((b) => batches.includes(b.id)).map((b) => b.id);
        const name = fileName('IYF', fixed ? '' : names.length > 2 ? 'batches' : names.join('-'), label, needsDates ? `${from}-to-${to}` : todayIST());
        await saveCsv(name, toCsv(columns, rows));
        toast(`Saved ${name} · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`);
        dlg.close();
      }
    } catch (e) { err = errorMessage(e); }
    busy = false; progress = '';
  }
</script>

<Sheet bind:this={dlg} titleId="ex-h" title="Export" sub="A CSV file that opens in Excel and Google Sheets" wide>
  {#if !cat && !err}<p class="m-0 text-sm text-muted">Loading the choices…</p>
  {:else if cat}
    <!-- start from a ready-made choice; everything below can be changed -->
    <p class="label mb-1.5">Start from</p>
    <div class="chiprow" role="group" aria-label="Start from">
      {#each EXPORT_PRESETS as p (p.id)}<button type="button" class="chipbtn" aria-pressed={presetId === p.id} onclick={() => usePreset(p)}>{p.label}</button>{/each}
    </div>

    <Seg id="ex-grain" label="Each row is one…" options={[['people', 'Devotee'], ['weeks', 'Week'], ['days', 'Day']]} value={fixed ? null : grain} onchange={(v) => { grain = v; presetId = ''; }} />
    {#if cat.grains.some((g) => g.fixed)}
      <p class="label mb-1.5">Or export</p>
      <div class="chiprow mb-3" role="group" aria-label="Or export">
        {#each cat.grains.filter((g) => g.fixed) as g (g.id)}<button type="button" class="chipbtn" aria-pressed={grain === g.id} onclick={() => { grain = g.id; presetId = ''; if (g.id === 'activity') setRange(range === 'custom' ? 'custom' : range); }}>{g.label}</button>{/each}
      </div>
    {/if}

    {#if !fixed}
      <fieldset class="ex-set">
        <legend class="label">Batches</legend>
        <div class="chiprow">{#each cat.batches as b (b.id)}<button type="button" class="chipbtn" aria-pressed={batches.includes(b.id)} onclick={() => (batches = batches.includes(b.id) ? batches.filter((x) => x !== b.id) : [...batches, b.id])}>{b.name}</button>{/each}</div>
        {#if fe.batches}<p class="err" role="alert"><Icon name="alert" size={16} />{fe.batches}</p>{/if}
      </fieldset>
    {/if}

    {#if needsDates}
      <fieldset class="ex-set">
        <legend class="label">Dates</legend>
        <div class="chiprow">{#each RANGES as [id, label] (id)}<button type="button" class="chipbtn" aria-pressed={range === id} onclick={() => setRange(id)}>{label}</button>{/each}</div>
        {#if range === 'custom'}<div class="ex-two"><DateInput id="ex-from" label="From" bind:value={from} /><DateInput id="ex-to" label="To" bind:value={to} /></div>
        {:else}<p class="m-0 text-sm text-muted">{fmtShort(from)} – {fmtShort(to)}{weeksIn ? ` · ${weeksIn} ${weeksIn === 1 ? 'week' : 'weeks'}` : ''}</p>{/if}
        {#if fe.dates}<p class="err" role="alert"><Icon name="alert" size={16} />{fe.dates}</p>{/if}
      </fieldset>
    {/if}

    {#if !fixed}
      <fieldset class="ex-set">
        <legend class="label">Fields <span class="opt">({picked.length} ticked)</span></legend>
        {#each groups as g (g.name)}
          {@const on = g.fields.filter((f) => chosen.includes(f.id)).length}
          <div class="ex-group">
            <div class="ex-gh"><b>{g.name}</b>{#if g.name === 'Personal'}<span class="pill" data-tone="warn">IYF head only · noted in Activity</span>{/if}
              <button type="button" class="btn btn-text btn-sm ml-auto" onclick={() => setGroup(g, on < g.fields.length)}>{on < g.fields.length ? 'All' : 'None'}</button></div>
            <div class="chiprow">{#each g.fields as f (f.id)}<button type="button" class="chipbtn" aria-pressed={chosen.includes(f.id)} onclick={() => toggle(f.id)}>{f.label}</button>{/each}</div>
          </div>
        {/each}
        {#if fe.fields}<p class="err" role="alert"><Icon name="alert" size={16} />{fe.fields}</p>{/if}
      </fieldset>

      <details class="disclose mb-3"><summary class="text-sm">Filters{status || facilitator ? ' (on)' : ''}</summary>
        {#if grain === 'weeks'}<Seg id="ex-status" label="Weeks" options={[['', 'All'], ['submitted', 'Submitted'], ['missed', 'Missed']]} value={status} onchange={(v) => (status = v)} />{/if}
        <WheelSelect id="ex-fac" label="Facilitator" value={facilitator} options={[['', 'Any facilitator'], ...facs]} onchange={(v) => (facilitator = v)} />
      </details>
    {/if}
  {/if}
  {#if err}<p class="err" role="alert"><Icon name="alert" size={16} />{err}</p>{/if}
  <div class="ex-foot">
    <p class="m-0 text-sm text-muted" aria-live="polite">{progress || (fixed ? '' : `${picked.length} fields · ${batches.length} ${batches.length === 1 ? 'batch' : 'batches'}`)}</p>
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-outline" disabled={busy} onclick={() => dlg.close()}>Cancel</button>
      <Button variant="primary" {busy} disabled={!cat} onclick={download}><Icon name="download" size={18} />Download CSV</Button>
    </div>
  </div>
</Sheet>

<style>
  .ex-set { margin: 0 0 var(--sp-4); padding: 0; border: 0; min-width: 0; }
  .ex-set > legend { padding: 0; margin-bottom: 6px; }
  .ex-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 12px; }
  .ex-group { padding: 10px 0; border-top: 1px solid var(--divider); }
  .ex-group:first-of-type { border-top: 0; padding-top: 0; }
  .ex-gh { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: var(--fs-sm); }
  .ex-group .chiprow { margin-bottom: 0; }
  /* the download stays in reach at the foot of a long sheet */
  /* (it spans the sheet's own padding: the gutter and the safe area on a phone, 24 px on a wider screen) */
  .ex-foot { --pb: calc(var(--safe-b) + 16px); position: sticky; bottom: calc(-1 * var(--pb)); z-index: 1; display: grid; gap: 10px;
    margin: var(--sp-3) calc(-1 * var(--gutter)) calc(-1 * var(--pb)); padding: 12px var(--gutter) var(--pb); border-top: 1px solid var(--divider); background: var(--panel-bg); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); }
  @media (min-width: 600px) { .ex-foot { --pb: 24px; margin-inline: -24px; padding-inline: 24px; } }
</style>
