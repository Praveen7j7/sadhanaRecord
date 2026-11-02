<script>
  // A 3D wheel roller (the head, 4 Oct 2026), like a phone's own picker: swipe up or down; the row in the middle is the
  // choice (highlighted); rows above and below lean away, shrink and fade like a drum; it snaps to a row; a tick of
  // vibration on each new row where the phone supports it. `circular`: the list wraps (… 11, 12, 1, 2 …) where that makes
  // sense. Keyboard: a spin button (↑ ↓, Page Up / Down, Home / End). One component for every wheel in the app.
  //   options: [[value, text], …] (or plain strings) · value · onchange(value) · circular · disabled · label
  // oncommit(value) (9 Oct 2026, Phase 9): a deliberate tap on a row chooses that row AND confirms it, so a one-wheel
  // picker can close at once instead of asking for Done as well. Only scrolling never commits. A wheel that is one of
  // several (the time picker's hour / minute / AM-PM) leaves it unset, so a tap there only moves that wheel.
  let { options = [], value, onchange = () => {}, oncommit = null, circular = false, disabled = false, label = '', id = undefined } = $props();
  const ROW = 44, VISIBLE = 5, REP = 7;                   // px a row; rows seen; copies of a circular list
  const list = $derived(options.map((o) => (Array.isArray(o) ? o : [o, String(o)])));
  const n = $derived(list.length);
  const copies = $derived(circular && n > 2 ? REP : 1);
  const rows = $derived(Array.from({ length: n * copies }, (_, k) => ({ k, i: k % n })));
  const idxOf = (v) => Math.max(0, list.findIndex(([x]) => x === v));
  let el = $state(), pos = $state(0), cur = $state(0), settle;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the low tier (lib/tier.js) gets a flat wheel: rows fade away from the middle, no 3D turn
  const flat = typeof document !== 'undefined' && document.documentElement.dataset.tier === 'low';
  const middle = (i) => (copies > 1 ? Math.floor(copies / 2) * n + i : i);

  function place(i, smooth = false) {
    if (!el) return;
    el.scrollTo({ top: middle(i) * ROW, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    pos = middle(i);
  }
  // follows the value from outside (and the first layout)
  $effect(() => { const i = idxOf(value); n; if (el && i !== cur) { cur = i; requestAnimationFrame(() => place(i)); } });
  // a wheel in a closed sheet has no height: it centres on its value whenever it is shown again
  $effect(() => {
    if (!el) return;
    requestAnimationFrame(() => place(idxOf(value)));
    if (typeof ResizeObserver !== 'function') return;
    let h = el.clientHeight;
    const ro = new ResizeObserver(() => { if (el.clientHeight && el.clientHeight !== h) { h = el.clientHeight; place(cur); } else h = el.clientHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  });

  // the settle timer can outlive the wheel: a sheet closed within 90 ms of a scroll left `el` null when it fired
  // ("Cannot read properties of null (reading 'scrollTop')", gate 18 Oct 2026). Cleared on unmount, and guarded.
  $effect(() => () => clearTimeout(settle));
  function onScroll() {
    if (!el) return;
    pos = el.scrollTop / ROW;
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (!el) return;
      const k = Math.round(el.scrollTop / ROW), i = ((k % n) + n) % n;
      // a circular list re-centres on the middle copy (unseen), so it never runs out
      if (copies > 1 && (k < n || k >= (copies - 1) * n)) place(i);
      if (i !== cur) {
        cur = i;
        try { navigator.vibrate?.(6); } catch { /* not on this phone */ }
        onchange(list[i][0]);
      }
    }, 90);
  }
  // a deliberate tap on a row: choose it, then confirm it when the picker asked for that (oncommit)
  function tap(i) {
    if (disabled) return;
    clearTimeout(settle);                      // the scroll that the tap causes must not fire a second onchange
    const v = list[i][0], changed = i !== cur;
    cur = i; place(i, true);
    if (changed) onchange(v);
    oncommit?.(v);
  }
  function step(d) {
    if (disabled || !n) return;
    let i = cur + d;
    i = circular ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    cur = i; place(i, true); onchange(list[i][0]);
  }
  function key(e) {
    const d = { ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3 }[e.key];
    if (d !== undefined) { e.preventDefault(); step(d); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); step((e.key === 'Home' ? 0 : n - 1) - cur); }
  }
  // the drum: each row turns away from the middle by its distance. The middle row's emphasis grows with how close it is
  // (a scale that follows the scroll, frame by frame), never a jump of font size or weight when it is chosen (the head's
  // video, 10 Oct 2026: "as soon as the option arrives the smoothness is missing")
  const look = (k) => {
    const d = Math.max(-3, Math.min(3, k - pos)), a = Math.abs(d), near = Math.max(0, 1 - a);
    const sc = (1 + near * 0.12 - a * 0.07).toFixed(3);
    if (flat) return `transform: scale(${sc}); opacity: ${Math.max(0.25, 1 - a * 0.28)};`;
    return `transform: rotateX(${-d * 20}deg) translateZ(${-a * 6}px) scale(${sc}); opacity: ${Math.max(0.15, 1 - a * 0.3)};`;
  };
</script>

<div class="wheel" class:off={disabled} style:--row="{ROW}px" style:--seen={VISIBLE}>
  <div class="wheel-band" aria-hidden="true"></div>
  <div bind:this={el} {id} class="wheel-scroll" role="spinbutton" tabindex={disabled ? -1 : 0} aria-label={label}
    aria-valuetext={list[cur]?.[1] || ''} aria-valuenow={cur} aria-valuemin="0" aria-valuemax={n - 1} aria-disabled={disabled || undefined}
    onscroll={onScroll} onkeydown={key}>
    {#each rows as r (r.k)}
      <button type="button" class="wheel-row" class:on={r.i === cur} style={look(r.k)} tabindex="-1" aria-hidden="true" data-value={String(list[r.i][0])}
        onclick={() => tap(r.i)}>{list[r.i][1]}</button>
    {/each}
  </div>
</div>

<style>
  .wheel { position: relative; height: calc(var(--row) * var(--seen)); perspective: 600px; user-select: none; -webkit-user-select: none; }
  .wheel.off { opacity: 0.5; pointer-events: none; }
  .wheel-scroll { height: 100%; overflow-y: auto; scroll-snap-type: y mandatory; scrollbar-width: none; overscroll-behavior: contain;
    padding-block: calc(var(--row) * (var(--seen) - 1) / 2); box-sizing: border-box; transform-style: preserve-3d; outline: none;
    -webkit-mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent); mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent); }
  .wheel-scroll::-webkit-scrollbar { display: none; }
  .wheel-scroll:focus-visible { box-shadow: inset 0 0 0 2px var(--ring); border-radius: var(--r-md); }
  .wheel-row { display: flex; align-items: center; justify-content: center; width: 100%; height: var(--row); padding: 0 10px; border: 0; background: none;
    color: var(--text-muted); font: inherit; font-size: 1.0625rem; scroll-snap-align: center; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    transform-origin: center center; backface-visibility: hidden; will-change: transform, opacity; font-weight: 600; transition: color .2s ease; }
  .wheel-row.on { color: var(--text); }
  .wheel-band { position: absolute; left: 6px; right: 6px; top: 50%; height: var(--row); transform: translateY(-50%); border-radius: 12px;
    background: color-mix(in srgb, var(--accent) 10%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent); pointer-events: none; }
</style>
