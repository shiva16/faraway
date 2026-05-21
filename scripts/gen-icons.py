#!/usr/bin/env python3
"""Generate PNG icons for Faraway PWA from the SVG design."""
from PIL import Image, ImageDraw
import math, os

def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 512  # scale factor

    def sc(pts):
        return [(x * s, y * s) for x, y in pts]

    def c(x, y, r):
        return (x*s - r*s, y*s - r*s, x*s + r*s, y*s + r*s)

    # Background with rounded corners
    r_bg = int(88 * s)
    d.rounded_rectangle([0, 0, size-1, size-1], radius=r_bg, fill=(9, 26, 9, 255))

    # Ground fog
    fog_box = c(256, 470, 200)
    # draw as ellipse
    d.ellipse([fog_box[0], fog_box[1] - 28*s, fog_box[0]+400*s, fog_box[1] + 28*s],
              fill=(13, 42, 13, 178))

    # Tree glow aura (radial gradient approximation via concentric ellipses)
    for i in range(20, 0, -1):
        alpha = int((1 - i/20) * 55)
        rx = int(130 * s * i / 20)
        ry = int(190 * s * i / 20)
        cx, cy = int(256*s), int(210*s)
        d.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=(32, 160, 48, alpha))

    # Tier 3 base (two layered triangles)
    d.polygon(sc([(256,448),(56,334),(456,334)]),  fill=(22, 60, 16))
    d.polygon(sc([(256,436),(76,334),(436,334)]),  fill=(28, 82, 22))

    # Tier 2 middle
    d.polygon(sc([(256,366),(100,248),(412,248)]), fill=(34, 96, 24))
    d.polygon(sc([(256,355),(118,248),(394,248)]), fill=(40,140, 32))

    # Tier 1 upper
    d.polygon(sc([(256,278),(148,166),(364,166)]), fill=(46,168, 40))
    d.polygon(sc([(256,268),(162,166),(350,166)]), fill=(54,204, 48))

    # Tip apex
    d.polygon(sc([(256,196),(196,112),(316,112)]), fill=(66,224, 56))
    d.polygon(sc([(256,185),(208,112),(304,112)]), fill=(82,255, 72))

    # Star glow rings
    for i in range(8, 0, -1):
        alpha = int(220 * (1 - i/8))
        r = int(32 * s * i / 8)
        d.ellipse(c(256, 94, r), fill=(92, 216, 96, alpha))

    # Star core
    d.ellipse(c(256, 94, int(16*s)), fill=(92, 216, 96, 242))
    d.ellipse(c(256, 94, int(8*s)),  fill=(192, 255, 160, 255))

    # Sparkle cross rays
    lw = max(2, int(3*s))
    def line(x0, y0, x1, y1, a=190):
        d.line([(x0*s, y0*s), (x1*s, y1*s)], fill=(128, 255, 96, a), width=lw)
    line(256,60, 256,128)
    line(222,94, 290, 94)
    lw2 = max(1, int(2*s))
    d.line([(232*s,70*s),(280*s,118*s)], fill=(128,255,96,115), width=lw2)
    d.line([(280*s,70*s),(232*s,118*s)], fill=(128,255,96,115), width=lw2)

    # Trunk
    tr = int(4*s)
    d.rounded_rectangle([240*s, 442*s, 272*s, 488*s], radius=tr, fill=(90, 58, 24))
    d.rounded_rectangle([246*s, 442*s, 256*s, 488*s], radius=tr, fill=(122, 78, 40))

    # Fireflies
    flies = [(128,308,5,204),(96,390,4,153),(158,228,4,140),(394,290,5,179),
             (422,370,3,128),(342,178,3,115),(162,428,3,140),(356,424,4,153)]
    for fx, fy, fr, fa in flies:
        r = max(1, int(fr*s))
        d.ellipse(c(fx, fy, r), fill=(92,216,96,fa))

    return img


def main():
    out = os.path.join(os.path.dirname(__file__), '..', 'public')
    os.makedirs(out, exist_ok=True)

    for sz in [192, 512]:
        img = draw_icon(sz)
        # For icon-192 and icon-512
        path = os.path.join(out, f'icon-{sz}.png')
        img.save(path, 'PNG')
        print(f'  wrote {path}')

    # Apple touch icon (180x180)
    apple = draw_icon(180)
    apple.save(os.path.join(out, 'apple-touch-icon.png'), 'PNG')
    print('  wrote apple-touch-icon.png')

    # Favicon 32x32 (as PNG, browsers will use favicon.svg first but fallback is nice)
    fav = draw_icon(32)
    fav.save(os.path.join(out, 'favicon-32.png'), 'PNG')
    print('  wrote favicon-32.png')

if __name__ == '__main__':
    main()
