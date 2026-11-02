#!/usr/bin/env python3
"""
Build the Android launcher icons from the web app's maskable artwork.

WHY. The shell first shipped one 512px PNG: a rounded square with its own border drawn almost to
the edge. Android masks a launcher icon into the shape the phone uses — on most phones a circle —
so that border was sliced off and the emblem ended up jammed against the edge with no margin,
while every other icon on the home screen sat comfortably inside its circle.

An adaptive icon fixes it. It is two layers on a 108dp canvas of which only the middle 72dp is
guaranteed visible; the outer ring is margin the launcher may crop into any shape. The layers are
kept SEPARATE because the system can shift them independently (the parallax some launchers apply
on touch): a background that is really a copy of the foreground would show seams when it moves.

  background  flat purple, sampled from the artwork's own field
  foreground  the emblem alone, on transparency, scaled into the safe zone

Source: frontend/public/icons/maskable-512.png — the PWA's maskable icon, already drawn with the
margin this needs. Run after the artwork changes:  python3 tools/store/make-icons.py
"""
from PIL import Image, ImageDraw, ImageFilter
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'frontend', 'public', 'icons', 'maskable-512.png')
RES = os.path.join(ROOT, 'tools', 'store', 'twa', 'src', 'main', 'res')

# densities: dp -> px multiplier
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
SAFE = 72 / 108          # the fraction of the adaptive canvas that is always visible
# The emblem is a circle, so it is cut out as one. A square crop would carry a patch of the purple
# field with it and that patch shows as a visible box once the background layer moves underneath.
CENTRE = (256.0, 259.0)  # measured on the 512px source
RADIUS = 161.0

def main():
    if not os.path.exists(SRC):
        sys.exit(f'missing source artwork: {SRC}')
    im = Image.open(SRC).convert('RGBA')
    w, h = im.size

    # the purple field, taken from a corner the emblem never reaches
    bg = im.getpixel((4, h - 5))[:3]

    # cut the emblem out of its field along its own circular edge, with a one-pixel feather so the
    # rim does not alias into a staircase when it is scaled down
    mask = Image.new('L', (w, h), 0)
    cx, cy = CENTRE
    ImageDraw.Draw(mask).ellipse(
        (cx - RADIUS, cy - RADIUS, cx + RADIUS, cy + RADIUS), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    cut = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    cut.paste(im, (0, 0), mask)
    box = int(RADIUS) + 1
    emblem = cut.crop((int(cx) - box, int(cy) - box, int(cx) + box, int(cy) + box))

    for name, s in DENS.items():
        d = os.path.join(RES, f'mipmap-{name}')
        os.makedirs(d, exist_ok=True)

        # --- adaptive layers, 108dp canvas ---
        side = int(round(108 * s))
        # background: flat colour, fully opaque, no detail to misalign when it parallaxes
        Image.new('RGBA', (side, side), bg + (255,)).save(
            os.path.join(d, 'ic_launcher_background.png'), optimize=True)
        # foreground: emblem centred, sized to sit inside the safe zone with room to spare
        fg = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        # 0.78 of the safe zone, not the whole of it: the emblem then sits inside the mask with a
        # ring of its field showing, the way the other icons on a home screen do. Filling the safe
        # zone edge to edge is technically legal and still looks cramped.
        target = int(round(side * SAFE * 0.78))
        e = emblem.resize((target, target), Image.LANCZOS)
        off = (side - target) // 2
        fg.paste(e, (off, off), e)
        fg.save(os.path.join(d, 'ic_launcher_foreground.png'), optimize=True)

        # --- legacy icon for Android 7 and older, 48dp, art as drawn ---
        lg = int(round(48 * s))
        im.resize((lg, lg), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'), optimize=True)
        im.resize((lg, lg), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_round.png'), optimize=True)
        print(f'{name:8s} adaptive {side}x{side}  legacy {lg}x{lg}')

    # the Play listing icon is a plain 512 square, not masked by the launcher
    im.save(os.path.join(ROOT, 'tools', 'store', 'play-icon-512.png'), optimize=True)
    print(f'\nbackground colour: rgb{bg}')
    print('play listing icon: tools/store/play-icon-512.png')

if __name__ == '__main__':
    main()
