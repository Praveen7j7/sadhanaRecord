// Checking a picture a phone sent: it must really be a JPEG, within a size in bytes, and within a size in pixels.
// One place for it (13 October 2026; audit F27 / roadmap 3.2) — profile photos and the wall's images each had
// their own copy of the decode and the header walk, and the wall reached into the coordinator module to borrow
// jpegSize(), which is how a "coordinator" file became a dependency of the announcements wall.
//
// Nothing here trusts the client: the base64 is length-checked before it is decoded (so a huge string cannot be
// expanded in memory first), the bytes must start with the JPEG marker, and the width and height are read from the
// frame header rather than taken on trust.
import { invalid } from './util.js';

/**
 * The pixel size from a JPEG's own frame header, or null when the bytes are not a JPEG.
 * Walks the marker segments looking for a start-of-frame; never decodes pixel data.
 */
export function jpegSize(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return null;
}

/**
 * A base64 JPEG the caller sent, checked against the limits for its purpose. Returns
 * `{ s, bytes, w, h }` — the string as given, its length in bytes, and its pixel size.
 * Throws VALIDATION with `path` and the caller's own wording; both limits are inclusive.
 *
 *   checkJpeg(d.jpegBase64, { path: 'jpegBase64', maxBytes: 150 * 1024, min: 64, max: 400, tooBig: '…', wrongSize: '…' })
 */
export function checkJpeg(b64, { path, maxBytes, min, max, tooBig, wrongSize }) {
  const s = String(b64 || '');
  // the shape and the length first: a string too long to be allowed is never decoded
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length > Math.ceil(maxBytes / 3) * 4) throw invalid({ path, message: tooBig });
  let bytes;
  try { bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0)); } catch { throw invalid({ path, message: 'That is not a picture.' }); }
  const size = jpegSize(bytes);
  if (!size || bytes.length > maxBytes) throw invalid({ path, message: tooBig });
  if (size.w > max || size.h > max || size.w < min || size.h < min) throw invalid({ path, message: wrongSize });
  return { s, bytes: bytes.length, w: size.w, h: size.h };
}
