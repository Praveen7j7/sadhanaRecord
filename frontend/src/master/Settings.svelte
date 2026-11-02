<script>
  // Settings (the IYF head; Phase 6, 9 Oct 2026): three rows that say what is set now — the submit window, the daily
  // reminder, the first tracked week, how long logs are kept (Phase 9) — each opening its own sheet with the wheel pickers. A sheet sends only its own
  // setting; Save shows only once something changed. Every change is logged in Activity. The read-only health (registry
  // copy, reminder phones) is on the head's Home.
  import { call, errorMessage, fieldErrors } from '../lib/api.js';
  import { entry, load, patch } from '../lib/cache.svelte.js';
  import { refreshMeta } from '../lib/meta.js';   // every screen's wording of the window comes from meta: fetch it again on a change
  import { weekLabel, fmt12 } from '../lib/dates.js';
  import { DAYS, splitSpec, joinSpec, isMonday, REMINDER_TIMES } from '../lib/admin.js';
  import { toast } from '../lib/pro.svelte.js';
  import Banner from '../ui/Banner.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import WheelSelect from '../ui/WheelSelect.svelte';
  import TimePicker from '../ui/TimePicker.svelte';
  import DateInput from '../ui/DateInput.svelte';
  import Seg from '../ui/Seg.svelte';
  import Button from '../ui/Button.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Icon from '../ui/Icon.svelte';

  /* The same cached copy the head's Home reads for System health (22 Oct 2026, G23): shown at once, asked again only
     when it is over two minutes old. It asked on every visit. A save puts its answer back into that copy, so Home and
     this screen agree straight away. */
  const se = entry('settings.get');
  let saved = $state(se.data ?? null), err = $state(''), fe = $state({}), busy = $state(false);
  const get = () => load('settings.get', () => call('settings.get')).then((s) => { if (s) saved = s; else if (se.error) err = errorMessage(se.error); });
  get();
  const keep = (s) => { patch('settings.get', () => s); return s; };
  const SHORT = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };
  const spec = (s) => { const x = splitSpec(s); return x.day ? `${SHORT[x.day]} ${fmt12(x.time)}` : s; };

  // one sheet at a time: what it edits, and its draft
  let which = $state(''), sheet = $state(), d = $state({});
  function edit(w) {
    fe = {}; err = ''; which = w;
    const o = splitSpec(saved.submitWindow.opens), c = splitSpec(saved.submitWindow.closes);
    d = { opensDay: o.day, opensTime: o.time, closesDay: c.day, closesTime: c.time, reminderTime: saved.reminderTime, trackingFrom: saved.trackingFrom || '', logMonths: String(saved.logRetentionMonths || 6) };
    sheet.showModal();
  }
  const change = $derived.by(() => {
    if (!saved || !which) return null;
    if (which === 'window') { const o = joinSpec(d.opensDay, d.opensTime), c = joinSpec(d.closesDay, d.closesTime); return o !== saved.submitWindow.opens || c !== saved.submitWindow.closes ? { submitWindow: { opens: o, closes: c } } : null; }
    if (which === 'reminder') return d.reminderTime !== saved.reminderTime ? { reminderTime: d.reminderTime } : null;
    if (which === 'logs') return Number(d.logMonths) !== (saved.logRetentionMonths || 6) ? { logRetentionMonths: Number(d.logMonths) } : null;
    return (d.trackingFrom || null) !== (saved.trackingFrom || null) ? { trackingFrom: d.trackingFrom || null } : null;
  });
  async function save() {
    if (which === 'first' && d.trackingFrom && !isMonday(d.trackingFrom)) { fe = { trackingFrom: 'Choose a Monday (the first day of a week).' }; return; }
    busy = true; fe = {};
    const before = saved, sent = change;
    try {
      saved = keep(await call('settings.update', sent)); sheet.close();
      // the submit window is said everywhere from the cached meta (windowSay): refresh it so this phone says the new time at once
      if (sent.submitWindow) refreshMeta().catch(() => {});
      // Undo sends the earlier value back
      toast('Saved. It applies to every batch.', { action: { label: 'Undo', run: async () => {
        const back = sent.submitWindow ? { submitWindow: before.submitWindow } : sent.reminderTime ? { reminderTime: before.reminderTime } : sent.logRetentionMonths ? { logRetentionMonths: before.logRetentionMonths || 6 } : { trackingFrom: before.trackingFrom || null };
        try { saved = keep(await call('settings.update', back)); if (back.submitWindow) refreshMeta().catch(() => {}); toast('Put back.', { kind: 'info' }); } catch (e) { toast(errorMessage(e), { kind: 'err' }); }
      } } });
    } catch (e) { fe = fieldErrors(e); if (!Object.keys(fe).length) err = errorMessage(e); }
    busy = false;
  }
  const DAY_OPTS = DAYS.map(([v]) => [v, SHORT[v]]);
  const TITLES = { window: 'Submit window', reminder: 'Daily reminder', first: 'First tracked week', logs: 'Keep logs for' };
  const LOG_OPTS = [['3', '3 months'], ['6', '6 months'], ['12', '12 months'], ['24', '24 months']];
</script>

<p class="m-0 mb-3 text-sm text-muted">For every batch. Changes are logged in Activity, and each can be undone right after.</p>
{#if err && !saved}<Banner onretry={get}>{err}</Banner>{/if}
{#if !saved && !err}<Skeleton kind="list" rows={3} />
{:else if saved}
  <ul class="list st-list" aria-label="Settings">
    <li><button type="button" class="lrow" onclick={() => edit('window')} aria-haspopup="dialog">
      <Icon name="week" size={20} /><span class="lmain"><span class="lt">Submit window · {spec(saved.submitWindow.opens)} → {spec(saved.submitWindow.closes)}</span>
      <span class="ls">Devotees submit their week in this window. A week not submitted by {spec(saved.submitWindow.closes)} is submitted with its complete days, or marked missed.</span></span><Icon name="next" size={18} /></button></li>
    <li><button type="button" class="lrow" onclick={() => edit('reminder')} aria-haspopup="dialog">
      <Icon name="bell" size={20} /><span class="lmain"><span class="lt">Daily reminder · {fmt12(saved.reminderTime)}</span>
      <span class="ls">Every evening at {fmt12(saved.reminderTime)} (Indian time), to phones with reminders on. The deadline reminder goes three hours before {spec(saved.submitWindow.closes)}.</span></span><Icon name="next" size={18} /></button></li>
    <li><button type="button" class="lrow" onclick={() => edit('first')} aria-haspopup="dialog">
      <Icon name="clock" size={20} /><span class="lmain"><span class="lt">First tracked week · {saved.trackingFrom ? 'week of ' + weekLabel(saved.trackingFrom) : 'not set'}</span>
      <span class="ls">{saved.trackingFrom ? 'From this week on, a week with no complete day by its deadline is marked missed. Earlier weeks never are.' : 'Nothing is marked missed until this is set.'}</span></span><Icon name="next" size={18} /></button></li>
    <li><button type="button" class="lrow" onclick={() => edit('logs')} aria-haspopup="dialog">
      <Icon name="clock" size={20} /><span class="lmain"><span class="lt">Keep logs for · {saved.logRetentionMonths || 6} months</span>
      <span class="ls">Activity and the technical log, here and in the Google Sheets copy. Older entries are erased at night. Sadhana, attendance, accounts and announcements are never erased.</span></span><Icon name="next" size={18} /></button></li>
  </ul>
{/if}

<Sheet bind:this={sheet} titleId="st-h" title={TITLES[which] || ''} sub="Applies to every batch at once" onclose={() => (which = '')}>
  {#if which === 'window'}
    <Seg id="st-od" label="Opens on" options={DAY_OPTS} value={d.opensDay} onchange={(v) => (d.opensDay = v)} error={fe.submitWindow} />
    <TimePicker id="st-ot" label="Opens at" value={d.opensTime} onchange={(v) => (d.opensTime = v)} def="18:00" />
    <Seg id="st-cd" label="Closes on" options={DAY_OPTS} value={d.closesDay} onchange={(v) => (d.closesDay = v)} />
    <TimePicker id="st-ct" label="Closes at" value={d.closesTime} onchange={(v) => (d.closesTime = v)} def="21:00" />
  {:else if which === 'reminder'}
    <WheelSelect id="st-rem" label="Reminder time" value={d.reminderTime} options={[...new Set([...REMINDER_TIMES, d.reminderTime])].sort().map((t) => [t, fmt12(t)])} onchange={(v) => (d.reminderTime = v)} error={fe.reminderTime} />
  {:else if which === 'logs'}
    <Seg id="st-logs" label="Keep for" options={LOG_OPTS} value={d.logMonths} onchange={(v) => (d.logMonths = v)} error={fe.logRetentionMonths} />
    <p class="hint m-0 -mt-2 mb-2">A shorter time erases the older entries over the next few nights. They can't be brought back.</p>
  {:else if which === 'first'}
    <DateInput id="st-from" label="Monday of the first week" bind:value={d.trackingFrom} error={fe.trackingFrom} hint={d.trackingFrom && isMonday(d.trackingFrom) ? 'Week of ' + weekLabel(d.trackingFrom) : 'A Monday. Empty: nothing is marked missed.'} />
    {#if d.trackingFrom}<button type="button" class="btn btn-text btn-sm -ml-2.5 -mt-2" onclick={() => (d.trackingFrom = '')}>Clear</button>{/if}
  {/if}
  {#if err}<p class="err" role="alert">{err}</p>{/if}
  <div class="mt-3 grid grid-cols-2 gap-2">
    <button type="button" class="btn btn-outline" onclick={() => sheet.close()}>Cancel</button>
    <Button variant="primary" disabled={!change} {busy} onclick={save}>{change ? 'Save' : 'No change'}</Button>
  </div>
</Sheet>

<style>
  .st-list .lrow { width: 100%; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; min-height: 72px; }
  .st-list .ls { line-height: 1.4; }
</style>
