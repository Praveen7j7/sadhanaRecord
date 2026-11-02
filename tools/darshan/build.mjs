// Builds each chosen painting per the display standard (§2): WebP at 480 / 960 / 1440 / 2160 (only up to the
// original's width), AVIF where it saves 20 % or more, a JPEG at 960, a ~1 KB blurred preview, the dominant colour,
// within the size limits (quality stepped down until each file fits). Adds them to darshan.json.
import { createRequire } from 'node:module';
const require = createRequire('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/package.json');
const sharp = require('sharp'); const fs = require('node:fs');
const D = process.argv[2], OUT = '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord-revamp/frontend/public/darshan';
const meta = JSON.parse(fs.readFileSync(D + '/meta.json', 'utf8'));
const LIMIT = { 480: 45, 960: 120, 1440: 220, 2160: 400 };
const fit = async (fn, limitKb) => { for (let q = 80; q >= 20; q -= 5) { const b = await fn(q); if (b.length <= limitKb * 1024) return { b, q }; } return null; };
const qs = {};
const jsonPath = OUT + '/darshan.json', doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const report = [];
for (const [n, m] of Object.entries(meta)) {
  const id = 'v' + String(n).padStart(3, '0'), src = `${D}/cropped/${n}.jpg`, info = await sharp(src).metadata();
  const sizes = [], avif = [];
  for (const w of [480, 960, 1440, 2160]) {
    if (w > info.width) continue;
    const base = () => sharp(src).resize(w);
    const webp = await fit((q) => base().webp({ quality: q, effort: 6 }).toBuffer(), LIMIT[w]);
    if (!webp) { report.push(`${id} ${w}: no WebP fits ${LIMIT[w]} KB`); continue; }
    fs.writeFileSync(`${OUT}/${id}-${w}.webp`, webp.b); sizes.push(w); (qs[id] ||= []).push(w + ':q' + webp.q);
    const av = await base().avif({ quality: Math.max(35, webp.q - 25), effort: 5 }).toBuffer();
    if (av.length <= webp.b.length * 0.8) { fs.writeFileSync(`${OUT}/${id}-${w}.avif`, av); avif.push(w); }
  }
  const jw = Math.min(960, info.width);
  await sharp(src).resize(jw).jpeg({ quality: 78, mozjpeg: true }).toFile(`${OUT}/${id}-960.jpg`);
  const blur = 'data:image/webp;base64,' + (await sharp(src).resize(24).blur(1.2).webp({ quality: 40 }).toBuffer()).toString('base64');
  // the average colour (what a 1-pixel version shows): the frame's colour before anything loads
  const px = await sharp(src).resize(1, 1, { kernel: 'cubic' }).removeAlpha().raw().toBuffer();
  const hex = '#' + [...px].map((v) => v.toString(16).padStart(2, '0')).join('');
  const entry = { id, title: m.title, deity: m.deity, pastime: m.pastime, focal: m.focal, dominant: hex, w: info.width, h: info.height, sizes, ...(avif.length ? { avif } : {}), blur, flagship: !!m.flagship, active: true, source: 'IYF collection (Phase 9, 9 Oct 2026)' };
  doc.images = doc.images.filter((x) => x.id !== id).concat(entry);
  report.push(`${id} [${(qs[id] || []).join(' ')}] ${info.width}x${info.height} webp ${sizes.join('/')} avif ${avif.join('/') || '-'} blur ${blur.length}B ${hex}${m.flagship ? ' FLAGSHIP' : ''}`);
}
doc.note = 'Darshan images (IYF holds the rights; no credit line). Each day starts from a painting chosen by the Indian date, the same for everyone; the display standard (docs/revamp/DARSHAN_AND_VERSE_STANDARD.md). Sizes: <id>-<w>.webp (480/960/1440/2160 up to the original width), <id>-<w>.avif where 20 % smaller, <id>-960.jpg; blur: a ~1 KB preview. 8 Oct 2026 from the Drive folder; 9 Oct 2026 (Phase 9) 20 more, corner logos cropped off.';
doc.version = 2;
fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 1) + '\n');
console.log(report.join('\n'));
console.log('total', doc.images.length, 'active', doc.images.filter((x) => x.active).length, 'flagship', doc.images.filter((x) => x.active && x.flagship).length);
