// Inventory of the downloaded pictures: size, format, a perceptual hash (dHash 64-bit) for duplicates.
import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/package.json');
const sharp = require('sharp'); const fs = require('node:fs'); const path = require('node:path');
const SRC = process.env.HOME + '/Downloads/Ramndom Hd pics', OLD = '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/public/darshan';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(jpe?g|png)$/i.test(e.name) ? [path.join(d, e.name)] : []);
async function dhash(file) {
  const { data } = await sharp(file).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  return BigInt('0b' + bits);
}
const ham = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const files = walk(SRC).sort();
const rows = [];
for (const [i, f] of files.entries()) {
  const m = await sharp(f).rotate().metadata();
  const w = m.autoOrient?.width || m.width, h = m.autoOrient?.height || m.height;
  rows.push({ n: i + 1, file: path.relative(SRC, f), w, h, kb: Math.round(fs.statSync(f).size / 1024), hash: await dhash(f) });
}
const old = [];
for (const f of fs.readdirSync(OLD).filter((x) => /-960\.webp$/.test(x))) old.push({ id: f.split('-')[0], hash: await dhash(path.join(OLD, f)) });
for (const r of rows) {
  r.dupOf = rows.filter((o) => o.n < r.n && ham(o.hash, r.hash) <= 8).map((o) => o.n);
  r.oldDup = old.filter((o) => ham(o.hash, r.hash) <= 10).map((o) => o.id);
}
fs.writeFileSync(process.argv[2], JSON.stringify(rows.map(({ hash, ...r }) => r), null, 1));
console.log(rows.length, 'files;', rows.filter((r) => r.w < 1080).length, 'under 1080 wide;', rows.filter((r) => r.dupOf.length).length, 'near-duplicates within;', rows.filter((r) => r.oldDup.length).length, 'match an existing darshan');
console.log('landscape:', rows.filter((r) => r.w > r.h).length, 'portrait:', rows.filter((r) => r.h >= r.w).length);
console.log(rows.filter((r) => r.dupOf.length || r.oldDup.length).map((r) => `${r.n} ${r.w}x${r.h} dupOf=${r.dupOf} old=${r.oldDup}`).join('\n'));
