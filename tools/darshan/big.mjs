// Larger previews of chosen pictures (3 a sheet, 760 px tall each), to look for marks inside the painting.
import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/package.json');
const sharp = require('sharp'); const fs = require('node:fs'); const path = require('node:path');
const SRC = process.env.HOME + '/Downloads/Ramndom Hd pics', rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), OUT = process.argv[3];
const pick = process.argv[4].split(',').map(Number); fs.mkdirSync(OUT, { recursive: true });
const TH = 900;
for (let s = 0; s * 3 < pick.length; s++) {
  const part = pick.slice(s * 3, s * 3 + 3), comps = []; let x = 0;
  for (const n of part) {
    const r = rows.find((q) => q.n === n), w = Math.round(TH * r.w / r.h);
    comps.push({ input: await sharp(path.join(SRC, r.file)).rotate().resize(w, TH).toBuffer(), left: x, top: 28 });
    comps.push({ input: Buffer.from(`<svg width="${w}" height="28"><rect width="100%" height="100%" fill="#000"/><text x="6" y="20" font-size="18" font-family="Helvetica" fill="#ffd54a">#${n}</text></svg>`), left: x, top: 0 });
    x += w + 6;
  }
  await sharp({ create: { width: x, height: TH + 28, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 82 }).toFile(path.join(OUT, `big-${String(s + 1).padStart(2, '0')}.jpg`));
}
console.log('ok');
