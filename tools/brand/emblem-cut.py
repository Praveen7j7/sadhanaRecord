# Cuts the round IYF emblem out of the 4× upscaled official logo and writes every size the app uses.
#   python3 tools/brand/emblem-cut.py        (needs Pillow; reads brand/iyf-logo-full-3540x1120.png)
# The emblem in the 885×280 original: centre (129, 135.5), radius 111.5 → ×4 in the upscaled file.
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
R = Path(__file__).resolve().parents[2]
src = Image.open(R / 'brand/iyf-logo-full-3540x1120.png').convert('RGBA')
cx, cy, r = 129 * 4, 135.5 * 4, 111.5 * 4
em = src.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))
n = em.size[0]
mask = Image.new('L', (n * 4, n * 4), 0); ImageDraw.Draw(mask).ellipse((2, 2, n * 4 - 3, n * 4 - 3), fill=255)
em.putalpha(ImageChops.multiply(em.split()[3], mask.resize((n, n), Image.LANCZOS)))
em.save(R / 'brand/emblem/iyf-emblem-892.png')
for s in (64, 128, 256, 512):
    e = em.resize((s, s), Image.LANCZOS)
    e.save(R / f'brand/emblem/iyf-emblem-{s}.png')
    e.save(R / f'frontend/public/brand/iyf-emblem-{s}.webp', 'WEBP', quality=92, method=6)
print('emblem', em.size, '→ brand/emblem and frontend/public/brand')
