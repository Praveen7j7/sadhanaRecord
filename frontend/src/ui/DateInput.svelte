<script>
  // Native date (or date and time, with `time`) picker: the phone's own calendar, labelled like every field.
  // A tap / click / Enter anywhere on the field opens the calendar (A3, Phase 22); typing still works.
  import TextInput from './TextInput.svelte';
  import { openPicker, pickerKey } from '../lib/datepick.js';
  let { value = $bindable(''), time = false, onclick, onkeydown, ...rest } = $props();
  const click = (e) => { onclick?.(e); if (!e.defaultPrevented) openPicker(e.currentTarget); };
  const key = (e) => { onkeydown?.(e); if (!e.defaultPrevented) pickerKey(e); };
</script>

<TextInput type={time ? 'datetime-local' : 'date'} bind:value onclick={click} onkeydown={key} {...rest} />
