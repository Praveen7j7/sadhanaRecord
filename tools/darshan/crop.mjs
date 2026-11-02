// Crops the bottom strip holding the corner logo off each chosen picture (full resolution, kept as JPEG q95 for the
// build), then renders each result's bottom-left corner to check no trace of the logo is left.
import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/package.json');
const sharp = require('sharp'); const fs = require('node:fs'); const path = require('node:path');
const SRC = process.env.HOME + '/Downloads/Ramndom Hd pics', D = process.argv[2];
const rows = JSON.parse(fs.readFileSync(D + '/inventory.json', 'utf8')), crops = JSON.parse(fs.readFileSync(D + '/crops.json', 'utf8'));
fs.mkdirSync(D + '/cropped', { recursive: true });
const corners = [];
for (const [n, frac] of Object.entries(crops)) {
  const r = rows.find((q) => q.n === +n), cut = Math.round(r.h * frac), h = r.h - cut;
  const out = `${D}/cropped/${n}.jpg`;
  await sharp(path.join(SRC, r.file)).rotate().extract({ left: 0, top: 0, width: r.w, height: h }).jpeg({ quality: 95, mozjpeg: true }).toFile(out);
  // the bottom-left corner of the result: 45% of the width, 22% of the height
  const cw = Math.round(r.w * 0.45), ch = Math.round(h * 0.22);
  corners.push({ n, buf: await sharp(out).extract({ left: 0, top: h - ch, width: cw, height: ch }).resize(380, Math.round(380 * ch / cw)).toBuffer(), hh: Math.round(380 * ch / cw) });
}
const COLS = 4, rowH = Math.max(...corners.map((c) => c.hh)) + 26, comps = [];
corners.forEach((c, i) => { const x = (i % COLS) * 390, y = Math.floor(i / COLS) * rowH;
  comps.push({ input: Buffer.from(`<svg width="380" height="24"><rect width="100%" height="100%" fill="#000"/><text x="4" y="18" font-size="16" fill="#ffd54a" font-family="Helvetica">#${c.n}</text></svg>`), left: x, top: y });
  comps.push({ input: c.buf, left: x, top: y + 24 }); });
await sharp({ create: { width: COLS * 390, height: Math.ceil(corners.length / COLS) * rowH, channels: 3, background: '#333' } }).composite(comps).jpeg({ quality: 85 }).toFile(D + '/corners.jpg');
console.log('ok', corners.length);
