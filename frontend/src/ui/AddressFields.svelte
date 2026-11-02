<script>
  // A postal address that is valid by construction (the head, 4 Oct 2026): India, the state from the list, in Delhi the
  // district from the list (else the city), and a PIN code of that state. Phase 9, item 13 (the head, 9 Oct 2026): in
  // short boxes, in the order people know them — house / flat, street (optional), area, landmark (optional), PIN,
  // state, district — each with an example, the phone's autofill, a number pad for the PIN; the PIN fills the state
  // when only one state has it. An address saved as one line is split at its first comma for editing.
  // `a`: { house, street, landmark, area, city, state, pin } (bindable; `line` is built on save); `fe`: errors keyed
  // `${prefix}.<field>`.
  import { untrack } from 'svelte';
  import { COUNTRY, STATE_NAMES, DELHI_DISTRICTS, pinStates, pinInState } from '$shared/places.js';
  import TextInput from './TextInput.svelte';
  import WheelSelect from './WheelSelect.svelte';
  let { a = $bindable(), fe = {}, prefix = 'address', idp = 'ad' } = $props();
  // an older one-line address: house = before the first comma, street = the rest
  if (a && a.house === undefined) {
    const line = String(a.line || ''), i = line.indexOf(',');
    a.house = i > 0 ? line.slice(0, i).trim() : line.trim(); a.street = i > 0 ? line.slice(i + 1).trim() : ''; a.landmark = a.landmark || '';
  }
  // an address saved before the state was asked: the state from its PIN, when only one state has it
  if (a && !a.state) { const s0 = pinStates(a.pin); if (s0.length === 1) { a.state = s0[0]; if (s0[0] === 'Delhi' && !DELHI_DISTRICTS.includes(a.city)) a.city = ''; } }
  const delhi = $derived(a.state === 'Delhi');
  // a district list for Delhi: a city typed for another state does not carry over (and the other way round)
  function setState(v) { const wasDelhi = a.state === 'Delhi'; a.state = v; if (wasDelhi !== (v === 'Delhi')) a.city = ''; }
  // the PIN fills the state when exactly one state has it (79… is shared by several states in the north-east)
  // (only when the PIN changes, so a state chosen by hand afterwards stays)
  let fromPin = $state(false), lastPin = a.pin;
  $effect(() => { const p = a.pin; if (p === lastPin) return; lastPin = p; untrack(() => { const s = pinStates(p); if (s.length === 1 && s[0] !== a.state) { setState(s[0]); fromPin = true; } }); });
  // checked as the person goes: a full PIN that is not in the chosen state
  const pinErr = $derived(/^[1-9]\d{5}$/.test(String(a.pin || '')) && a.state && !pinInState(a.pin, a.state) ? `This PIN code is not in ${a.state}` : '');
</script>

<div class="addr-2">
  <TextInput id={idp + '-ah'} label="House / flat no." bind:value={a.house} error={fe[prefix + '.house'] || fe[prefix + '.line']} autocomplete="address-line1" maxlength="60" placeholder="e.g. B-12, 2nd floor" />
  <TextInput id={idp + '-as'} label="Street / gali / road" optional bind:value={a.street} error={fe[prefix + '.street']} autocomplete="address-line2" maxlength="80" placeholder="e.g. Gali no. 3" />
</div>
<div class="pair">
  <TextInput id={idp + '-aa'} label="Area / locality / colony" bind:value={a.area} error={fe[prefix + '.area']} autocomplete="address-level3" maxlength="60" placeholder="e.g. Punjabi Bagh" />
  <TextInput id={idp + '-lm'} label="Landmark" optional bind:value={a.landmark} error={fe[prefix + '.landmark']} autocomplete="off" maxlength="60" placeholder="e.g. Near the metro station" />
</div>
<div class="pair">
  <TextInput id={idp + '-ap'} label="PIN code" bind:value={a.pin} error={fe[prefix + '.pin'] || pinErr} inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="6 digits" />
  <WheelSelect id={idp + '-st'} label="State" value={a.state} options={STATE_NAMES} onchange={(v) => { fromPin = false; setState(v); }} error={fe[prefix + '.state']} hint={fromPin ? 'From the PIN code' : ''} />
</div>
{#if delhi}
  <WheelSelect id={idp + '-ci'} label="District" bind:value={a.city} options={DELHI_DISTRICTS} placeholder="Choose your district" error={fe[prefix + '.city']} />
{:else}
  <TextInput id={idp + '-ci'} label="City or town" bind:value={a.city} error={fe[prefix + '.city']} autocomplete="address-level2" maxlength="40" />
{/if}
<p class="addr-country">Country: {COUNTRY}</p>

<style>
  /* house and street: one row each on a phone (the street's label is long), side by side when there is room */
  .addr-2 { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: 12px; }
  @media (min-width: 600px) { .addr-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
  .addr-country { margin: -4px 0 var(--sp-4); color: var(--text-muted); font-size: var(--fs-caption); }
</style>
