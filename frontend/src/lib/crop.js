// Square photo crop maths (pure; the canvas work lives in PhotoCrop.svelte).
// The image is centred in a square view of `view` px, scaled to cover it, then zoomed (>= 1) and moved by (x, y).
export const OUT = 400;              // the uploaded photo: 400 x 400 JPEG
export const MAX_BYTES = 150 * 1024; // the server's limit

/** Scale at zoom 1: the shorter side just fills the view. */
export const coverScale = (w, h, view) => view / Math.min(w, h);

/** Keep the image covering the whole view: the furthest it may move from the centre. */
export function clampOffset(w, h, view, zoom, x, y) {
  const s = coverScale(w, h, view) * zoom;
  const mx = Math.max(0, (w * s - view) / 2), my = Math.max(0, (h * s - view) / 2);
  return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
}

/** The part of the image (in image pixels) that the view shows: draw it into the 400 x 400 canvas. */
export function sourceRect(w, h, view, zoom, x, y) {
  const s = coverScale(w, h, view) * zoom, size = view / s;
  return { sx: w / 2 - (view / 2 + x) / s, sy: h / 2 - (view / 2 + y) / s, size };
}

/** A big camera photo is first shrunk so its longer side is at most `max` (memory on small phones). */
export function fitWithin(w, h, max = 1600) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k), scaled: k < 1 };
}

/** Encodes at falling qualities until the result is at most maxBytes. encode(q) -> Promise<Blob>. */
export async function encodeUnder(encode, maxBytes = MAX_BYTES, qualities = [0.82, 0.72, 0.62, 0.52, 0.42, 0.32]) {
  let last = null;
  for (const q of qualities) {
    last = await encode(q);
    if (last && last.size <= maxBytes) return { blob: last, quality: q };
  }
  return { blob: null, quality: null, size: last?.size ?? 0 };
}
