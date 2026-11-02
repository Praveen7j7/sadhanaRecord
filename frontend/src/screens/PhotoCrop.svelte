<script>
  // Square crop of a chosen photo: drag (or arrow keys) to move, slider (or + / -) to zoom. "Use this photo" draws
  // the square into a 400 x 400 canvas and encodes a JPEG of at most 150 KB. Redrawing drops EXIF and GPS data.
  import { coverScale, clampOffset, sourceRect, fitWithin, encodeUnder, OUT } from '../lib/crop.js';
  import Button from '../ui/Button.svelte';
  let { file, onDone, onCancel } = $props();

  let bmp = $state(null);
  let err = $state('');
  let busy = $state(false);
  let zoom = $state(1), x = $state(0), y = $state(0);
  let view = $state(0);
  let canvas = $state();
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1;

  $effect(() => {
    let gone = false;
    (async () => {
      try {
        let b = await createImageBitmap(file, { imageOrientation: 'from-image' });   // upright, as the camera took it
        const f = fitWithin(b.width, b.height);
        if (f.scaled) { const small = await createImageBitmap(b, { resizeWidth: f.w, resizeHeight: f.h, resizeQuality: 'high' }); b.close(); b = small; }
        if (gone) b.close(); else bmp = b;
      } catch { err = 'That file could not be opened as a photo. Choose a JPEG or PNG photo.'; }
    })();
    return () => { gone = true; bmp?.close?.(); };
  });

  function clamp() { if (bmp && view) ({ x, y } = clampOffset(bmp.width, bmp.height, view, zoom, x, y)); }
  $effect(() => {
    if (!bmp || !view || !canvas) return;
    zoom; clamp();
    canvas.width = canvas.height = Math.round(view * dpr);
    const g = canvas.getContext('2d'), s = coverScale(bmp.width, bmp.height, view) * zoom;
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, (view / 2 + x - (bmp.width * s) / 2) * dpr, (view / 2 + y - (bmp.height * s) / 2) * dpr, bmp.width * s * dpr, bmp.height * s * dpr);
  });

  let drag = null;
  const down = (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  function move(e) {
    if (!drag || drag.id !== e.pointerId) return;
    x += e.clientX - drag.x; y += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; clamp();
  }
  const up = () => (drag = null);
  function key(e) {
    const step = e.shiftKey ? 32 : 8;
    const m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (m) { e.preventDefault(); x += m[0]; y += m[1]; clamp(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom = Math.min(4, zoom + 0.1); }
    else if (e.key === '-') { e.preventDefault(); zoom = Math.max(1, zoom - 0.1); }
  }

  async function use() {
    if (!bmp || busy) return;
    busy = true; err = '';
    try {
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      const r = sourceRect(bmp.width, bmp.height, view, zoom, x, y), g = out.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, r.sx, r.sy, r.size, r.size, 0, 0, OUT, OUT);
      const { blob } = await encodeUnder((q) => new Promise((res) => out.toBlob(res, 'image/jpeg', q)));
      if (!blob) throw new Error('too big');
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      await onDone(b64, blob.size);
    } catch { err = 'Could not prepare the photo. Try another one.'; }
    busy = false;
  }
</script>

{#if err}<p class="err mb-2" role="alert">{err}</p>{/if}
{#if !bmp && !err}<p class="flex items-center gap-2 text-sm text-muted" role="status"><span class="spin" aria-hidden="true"></span>Opening the photo…</p>{/if}
{#if bmp}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div class="crop" bind:clientWidth={view} tabindex="0" role="group" aria-label="Photo position. Drag, or use the arrow keys, to move it; plus and minus to zoom."
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={key}>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>
  <div class="field">
    <label class="label" for="crop-zoom">Zoom</label>
    <input id="crop-zoom" class="w-full accent-[var(--accent)]" type="range" min="1" max="4" step="0.05" bind:value={zoom} />
  </div>
  <p class="hint mb-3 mt-0">Keep your face in the circle.</p>
  <div class="grid grid-cols-2 gap-2">
    <button type="button" class="btn btn-outline" disabled={busy} onclick={onCancel}>Cancel</button>
    <Button variant="primary" {busy} onclick={use}>Use this photo</Button>
  </div>
{/if}
