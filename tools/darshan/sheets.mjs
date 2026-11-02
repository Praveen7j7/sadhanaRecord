import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/package.json');
const sharp = require('sharp'); const fs = require('node:fs'); const path = require('node:path');
const SRC = process.env.HOME + '/Downloads/Ramndom Hd pics', OUT = process.argv[3];
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const TW = 400, TH = 500, COLS = 3, PER = 6;
for (let s = 0; s * PER < rows.length; s++) {
  const part = rows.slice(s * PER, s * PER + PER), H = Math.ceil(part.length / COLS) * (TH + 30);
  const comps = [];
  for (const [k, r] of part.entries()) {
    const x = (k % COLS) * TW, y = Math.floor(k / COLS) * (TH + 30);
    const img = await sharp(path.join(SRC, r.file)).rotate().resize(TW - 8, TH, { fit: 'contain', background: '#222' }).toBuffer();
    comps.push({ input: img, left: x + 4, top: y + 30 });
    const label = `<svg width="${TW}" height="30"><rect width="100%" height="100%" fill="#000"/><text x="6" y="21" font-size="18" font-family="Helvetica" fill="#ffd54a">#${r.n}  ${r.w}x${r.h}${r.dupOf.length ? '  dup?' + r.dupOf : ''}${r.oldDup.length ? '  old:' + r.oldDup : ''}</text></svg>`;
    comps.push({ input: Buffer.from(label), left: x, top: y });
  }
  await sharp({ create: { width: TW * COLS, height: H, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 78 }).toFile(path.join(OUT, `sheet-${String(s + 1).padStart(2, '0')}.jpg`));
}
console.log('ok');
