// Today's darshan (8 Oct 2026): one painting a day, the same for everyone, chosen by the Indian date from
// public/darshan/darshan.json. The list is fetched once (and kept by the service worker); never part of the install.
// The Welcome and sign-in panel use the four flagship paintings; the devotee Home card uses the everyday pool.
const DAY = 864e5, IST = 5.5 * 3600e3;
let list = null, blurs = null;
export async function loadDarshan() {
  if (list) return list;
  try { const r = await fetch('/darshan/darshan.json'); list = r.ok ? spread((await r.json()).images.filter((i) => i.active)) : []; } catch { list = []; }
  return list;
}
/**
 * The blur placeholders, in their own file (22 Oct 2026).
 *
 * Each is a 24 px thumbnail inlined as a data URI, and only the 17 flagship paintings have one — but they were
 * carried inside `darshan.json`, which `index.html` PRELOADS on every page. That made the catalogue 50 KB of
 * placeholder for 17 images out of 119, on every first open, for a screen most opens never show: 29.8 KB gzipped,
 * of which 24.5 KB was blur. Split out, the catalogue is 5.3 KB and the placeholders are fetched only where a
 * flagship is actually drawn.
 *
 * Merged onto the image objects, so every reader (`Darshan.svelte` reads `img.blur`) is unchanged. Failure is
 * silent and harmless: without a placeholder the panel falls back to the painting's dominant colour, which is
 * what it already does for the 102 everyday images.
 */
export async function loadBlur(images) {
  if (!blurs) {
    try { const r = await fetch('/darshan/blur.json'); blurs = r.ok ? await r.json() : {}; } catch { blurs = {}; }
  }
  for (const im of images || []) if (blurs[im.id] && !im.blur) im.blur = blurs[im.id];
  return images;
}
/** The deity's family, for variety: every form of Vishnu, of Krishna, of Lord Caitanya counts as one. */
export const family = (d) => (/vishnu/i.test(d || '') ? 'vishnu' : /caitanya|pancha/i.test(d || '') ? 'caitanya' : /krishna|balarama/i.test(d || '') ? 'krishna' : String(d || ''));
/**
 * The paintings in an order where the same family of deity never comes twice in a row (the display standard §3,
 * 9 Oct 2026), also from the last back to the first (the order goes round). Deterministic: the same for everyone.
 * Each step takes, from the families other than the one just shown, the one with the most left (so none is left to
 * bunch at the end), its first painting in list order.
 */
export function spread(images) {
  const left = new Map();
  for (const im of images) { const f = family(im.deity); if (!left.has(f)) left.set(f, []); left.get(f).push(im); }
  const out = [];
  let prev = '';
  while (out.length < images.length) {
    const fams = [...left.entries()].filter(([, l]) => l.length).sort((a, b) => b[1].length - a[1].length);
    const pickF = fams.find(([f]) => f !== prev) || fams[0];
    out.push(pickF[1].shift()); prev = pickF[0];
  }
  // the last and the first of the same family: move the last one back to the latest place it fits
  if (out.length > 2 && family(out.at(-1).deity) === family(out[0].deity)) {
    const last = out.pop(), f = family(last.deity);
    const i = out.findLastIndex((x, k) => k > 0 && family(x.deity) !== f && family(out[k - 1].deity) !== f);
    out.splice(i < 0 ? out.length : i, 0, last);
  }
  return out;
}
/** The day number in India (days since 1 Jan 1970, IST): the same image all day, for everyone. */
export const istDay = (now = Date.now()) => Math.floor((now + IST) / DAY);
/** Today's image from the pool ('flagship' or 'everyday'); null when there is none. */
export function pick(images, pool = 'everyday', now = Date.now()) {
  const p = pool === 'flagship' ? images.filter((i) => i.flagship) : images;
  return p.length ? p[istDay(now) % p.length] : null;
}
/**
 * The order to show paintings in when they rotate (9 Oct 2026): today's pick from the pool first, then the rest of all
 * the paintings in day order from today, so each day starts somewhere new and the same for everyone.
 */
export function sequence(images, pool = 'everyday', now = Date.now()) {
  const first = pick(images, pool, now);
  if (!first) return [];
  const k = istDay(now) % images.length, rest = [...images.slice(k), ...images.slice(0, k)].filter((i) => i !== first);
  return [first, ...rest];
}
// AVIF where the browser decodes it and the painting has it (Phase 9: 20 % or more smaller), else WebP; decided once,
// so a painting is never fetched in both formats
let avifOk = false;
if (typeof Image === 'function') {
  const t = new Image();
  t.onload = () => (avifOk = t.width === 1);
  t.src = 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAABoAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAibWRhdBIACgc4AAaQENBpMg0ZQmMEwAA0AASQQM1A';
}
/** srcset of an image's sizes (AVIF when it has them all and the browser takes it, else WebP), and the JPEG fallback. */
export const srcset = (img) => {
  const avif = avifOk && img.avif && img.sizes.every((w) => img.avif.includes(w));
  return img.sizes.map((w) => `/darshan/${img.id}-${w}.${avif ? 'avif' : 'webp'} ${w}w`).join(', ');
};
export const jpeg = (img) => `/darshan/${img.id}-960.jpg`;
/** No image on the Low tier, with Save-Data on, or offline before the first view (the verse shows alone). */
export function showImages() {
  if (typeof document === 'undefined') return false;
  const low = document.documentElement.dataset.tier === 'low';
  const save = typeof navigator !== 'undefined' && navigator.connection?.saveData;
  return !low && !save;
}
