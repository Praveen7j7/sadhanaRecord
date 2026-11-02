<script>
  // A time field: shows the time ("10:15 PM"); tapping opens a bottom sheet with three scroll wheels (hour, minute,
  // AM/PM) — the shared 3D Wheel — like a phone's own clock. Minutes go in 5s. No marks or score ranges here: those are in "Scoring rules".
  // Value is "HH:MM" (24-hour). Keyboard: each wheel is a spin button (↑ ↓, Page Up / Down, Home / End).
  import { to12, to24 } from '../lib/time12.js';
  import { fmt12 } from '../lib/dates.js';
  import Icon from './Icon.svelte';
  import Wheel from './Wheel.svelte';
  import Sheet from './Sheet.svelte';
  let { id, label, value = '', onchange, last = '', def = '22:00', error = '' } = $props();

  const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], MINS = Array.from({ length: 12 }, (_, i) => i * 5), HALF = ['AM', 'PM'];
  let dlg;
  let hi = $state(9), mi = $state(0), pi = $state(1);     // selected indexes
  const pad = (n) => String(n).padStart(2, '0');
  const preview = $derived(`${HOURS[hi]}:${pad(MINS[mi])} ${HALF[pi]}`);

  function seat(t) {
    const s = to12(t) || to12(def) || { h: 10, m: 0, pm: true };
    hi = HOURS.indexOf(s.h); mi = Math.round(s.m / 5) % 12; pi = s.pm ? 1 : 0;
  }
  function openSheet() {
    seat(value);
    dlg.showModal();
  }
  const close = () => dlg.close();
  function done() { onchange(to24(HOURS[hi], MINS[mi], pi === 1)); close(); }
  function useLast() { onchange(last); close(); }

</script>

<div class="field" {id}>
  <label class="label" for={id + '-btn'}>{label}</label>
  <button id={id + '-btn'} type="button" class="timebtn" class:empty={!value} aria-haspopup="dialog" onclick={openSheet} aria-describedby={error ? id + '-e' : undefined}>
    <span>{value ? fmt12(value) : 'Set time'}</span><Icon name="clock" size={20} />
  </button>
  {#if error}<p class="err" id={id + '-e'} role="alert">{error}</p>{/if}
</div>

<Sheet bind:this={dlg} class="tp-sheet" titleId={id + '-t'}>
  {#snippet head()}
    <div class="tp-head">
      <h3 id={id + '-t'} class="m-0 text-base font-semibold">{label}</h3>
      <p class="tp-preview m-0" aria-live="polite">{preview}</p>
    </div>
  {/snippet}
  <!-- the shared 3D wheel: hours and minutes go round; AM / PM does not -->
  <div class="tp-wheels">
    <Wheel label="Hour" options={HOURS.map((h, i) => [i, String(h)])} value={hi} circular onchange={(v) => (hi = v)} />
    <Wheel label="Minute" options={MINS.map((m, i) => [i, pad(m)])} value={mi} circular onchange={(v) => (mi = v)} />
    <Wheel label="AM or PM" options={HALF.map((x, i) => [i, x])} value={pi} onchange={(v) => (pi = v)} />
  </div>
  {#if last}<button type="button" class="chipbtn tp-last" onclick={useLast}><Icon name="clock" size={16} />Same as last time · {fmt12(last)}</button>{/if}
  <div class="mt-3 grid grid-cols-2 gap-2">
    <button type="button" class="btn" onclick={close}>Cancel</button>
    <button type="button" class="btn btn-primary" onclick={done}>Done</button>
  </div>
</Sheet>
