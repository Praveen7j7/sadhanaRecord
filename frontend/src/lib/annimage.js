// Pictures on the announcement wall: shrunk on the phone before posting (at most 1280 px a side, 240 KB JPEG, upright,
// location details stripped by the redraw) and, when shown, fetched only once they scroll into view and kept on the
// phone (memory for the session, IndexedDB by post + version) so a post's picture downloads once.
import { call } from './api.js';
import { idbGet, idbSet } from './idb.js';
import { fitWithin, encodeUnder } from './crop.js';

export const MAX_SIDE = 1280, MAX_BYTES = 240 * 1024;
const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

/** A picked file → { b64, w, h, preview } ready to post; throws Error(message) when it cannot be used. */
export async function shrinkPicture(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Choose a picture (JPEG, PNG or similar).');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('This picture could not be read. Try another one.'); }
  const f = fitWithin(bmp.width, bmp.height, MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = f.w; canvas.height = f.h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, f.w, f.h);                         // transparent PNGs get a white background
  g.drawImage(bmp, 0, 0, f.w, f.h);
  bmp.close?.();
  const { blob } = await encodeUnder((q) => new Promise((res) => canvas.toBlob(res, 'image/jpeg', q)), MAX_BYTES);
  canvas.width = canvas.height = 0;                                           // free the pixels at once (small phones)
  if (!blob) throw new Error('This picture is too detailed to send. Try a smaller one.');
  return { b64: await toB64(blob), w: f.w, h: f.h, preview: URL.createObjectURL(blob) };
}

const mem = new Map(), inflight = new Map(), MEM_MAX = 20;
/** The picture of post `id` (version `v`) as a data: URL. */
export function annImage(id, v) {
  const k = `ann:${id}:${v}`;
  if (mem.has(k)) return Promise.resolve(mem.get(k));
  if (!inflight.has(k)) inflight.set(k, (async () => {
    let b64 = await idbGet(k);
    if (!b64) { b64 = (await call('announcements.image', { id })).jpegBase64; idbSet(k, b64); }
    const url = 'data:image/jpeg;base64,' + b64;
    mem.set(k, url); if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
    return url;
  })().finally(() => inflight.delete(k)));
  return inflight.get(k);
}
