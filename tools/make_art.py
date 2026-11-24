#!/usr/bin/env python3
"""Generate Trenches' pixel art: home-screen icons and the Island scene pieces.

Run from the repo root:  python3 tools/make_art.py
Needs Pillow. Every sprite is drawn as text, one character per pixel, from the
limited palette below. The scene PNGs are saved at 1 art-pixel = 1 image pixel;
the CSS scales them up 4x with `image-rendering: pixelated`.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAL = {
    # sky (top -> horizon)
    '1': (24, 112, 236), '2': (52, 146, 255), '3': (96, 185, 255), '4': (154, 216, 255),
    # clouds
    'W': (255, 255, 255), 'c': (214, 236, 255), 'C': (160, 205, 245),
    # ocean (horizon -> deep)
    'h': (190, 243, 255), 'H': (92, 211, 245), 'a': (22, 137, 216), 'b': (13, 108, 194),
    'd': (10, 84, 166), 'e': (8, 63, 134), 'v': (70, 190, 245), 'x': (188, 236, 255),
    # sand
    'Y': (250, 226, 150), 'y': (234, 192, 98), 's': (196, 146, 62),
    # palm
    'G': (52, 196, 60), 'g': (22, 128, 40), 'L': (150, 230, 96), 'k': (10, 70, 24),
    'T': (140, 90, 43), 't': (186, 130, 68), 'D': (88, 54, 24),
}

# ---------------------------------------------------------------- sprites
PALM_ISLAND = [  # 24 x 22
    '.........kgGGgk.........',
    '....kgGGgkgLLGgkgGGgk...',
    '..kgGLLGGgGGGGGgGLLGGgk.',
    '.kgGGgkkgGGGGGGGgkkgGGgk',
    '.kgGgk.kgGGDkDGGgk..kgGg',
    'kgGk...kgGg.D.kgGgk..kgk',
    'kgk...kgGk..tT..kgGk...k',
    'kk....kgk...tT...kgGk...',
    '......kk....tT....kgk...',
    '............tT.....k....',
    '...........tT...........',
    '...........tT...........',
    '...........tD...........',
    '..........tT............',
    '..........tT............',
    '..........tD............',
    '.......YYYtTYYY.........',
    '.....YYYYYYYYYYYYY......',
    '...YYYYYYYYYYYYYYYYYy...',
    '..hyyyyyyyyyyyyyyyyyyyh.',
    '.hhHsssssssssssssssssHhh',
    '..H.h..H...h...H..h.H...',
]

CLOUD_BIG = [  # 16 x 6
    '.....WWWW.......',
    '...WWWWWWWW.WW..',
    '.WWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWW',
    'cWWWWWWWWWWWWWWc',
    '.cccCCCCCCCCccc.',
]
CLOUD_MID = [  # 11 x 5
    '...WWW.....',
    '.WWWWWWWW..',
    'WWWWWWWWWWW',
    'cWWWWWWWWWc',
    '.ccCCCCCcc.',
]
CLOUD_SMALL = [  # 7 x 3
    '..WWW..',
    'WWWWWWW',
    '.cCCCc.',
]


def blit(img, rows, ox, oy):
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.' or ch not in PAL:
                continue
            X, Y = ox + x, oy + y
            if 0 <= X < img.width and 0 <= Y < img.height:
                px[X, Y] = PAL[ch] + ((255,) if img.mode == 'RGBA' else ())


def sprite(rows):
    img = Image.new('RGBA', (len(rows[0]), len(rows)), (0, 0, 0, 0))
    blit(img, rows, 0, 0)
    return img


def dither(px, x, y, c1, c2):
    px[x, y] = PAL[c1] if (x + y) % 2 else PAL[c2]


# ---------------------------------------------------------------- icon scene
def icon_scene(W, H, ox=0, oy=0):
    """32x32 beach scene; (ox, oy) shifts the content so bigger canvases keep it centered."""
    img = Image.new('RGB', (W, H), PAL['1'])
    px = img.load()
    horizon = 18 + oy
    # sky bands with checker dither between them (bright at the horizon, deeper overhead)
    for y in range(horizon):
        r = y - oy
        for x in range(W):
            if r < 5: px[x, y] = PAL['1']
            elif r == 5: dither(px, x, y, '1', '2')
            elif r < 10: px[x, y] = PAL['2']
            elif r == 10: dither(px, x, y, '2', '3')
            elif r < 14: px[x, y] = PAL['3']
            elif r == 14: dither(px, x, y, '3', '4')
            else: px[x, y] = PAL['4']
    # ocean bands
    for y in range(horizon, H):
        r = y - horizon
        for x in range(W):
            if r == 0: px[x, y] = PAL['h']
            elif r == 1: px[x, y] = PAL['H']
            elif r < 5: px[x, y] = PAL['a']
            elif r == 5: dither(px, x, y, 'a', 'b')
            elif r < 9: px[x, y] = PAL['b']
            elif r == 9: dither(px, x, y, 'b', 'd')
            elif r < 12: px[x, y] = PAL['d']
            else: px[x, y] = PAL['e'] if (x + y) % 2 == 0 or r > 12 else PAL['d']
    # gentle wave lines (light crest over a darker trough)
    for (x, r, n) in [(0, 3, 4), (28, 4, 4), (3, 7, 3), (22, 8, 4), (9, 11, 4), (26, 12, 3), (15, 13, 3)]:
        for i in range(n):
            X, Y = ox + x + i, horizon + r
            if 0 <= X < W and Y < H:
                px[X, Y] = PAL['v']
                if Y + 1 < H: px[X, Y + 1] = PAL['e'] if r > 8 else PAL['b']
    # clouds
    blit(img, CLOUD_MID, ox + 0, oy + 1)
    blit(img, CLOUD_SMALL, ox + 25, oy + 12)
    blit(img, CLOUD_SMALL, ox - 2, oy + 9)
    # island + palm
    blit(img, PALM_ISLAND, ox + 4, oy + 3)
    # sparkle glints: white plus shapes + single pixels
    for (x, y) in [(4, 28), (28, 26), (19, 29)]:
        X, Y = ox + x, oy + y
        px[X, Y] = PAL['W']
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            px[X + dx, Y + dy] = PAL['x']
    for (x, y) in [(12, 27), (30, 30), (1, 25), (24, 31), (9, 30)]:
        px[ox + x, oy + y] = PAL['W']
    return img


def save_icons():
    out = os.path.join(ROOT, 'icons')
    base = icon_scene(32, 32)
    big = icon_scene(36, 36, 2, 2)   # extra 2px of scene on each side for the 180px size
    base.resize((192, 192), Image.NEAREST).save(os.path.join(out, 'icon-192.png'))
    base.resize((512, 512), Image.NEAREST).save(os.path.join(out, 'icon-512.png'))
    base.resize((512, 512), Image.NEAREST).save(os.path.join(out, 'maskable-512.png'))  # full-bleed scene; island sits in the safe zone
    big.resize((180, 180), Image.NEAREST).save(os.path.join(out, 'apple-touch-icon.png'))
    base.save(os.path.join(out, 'favicon-32.png'))


# ---------------------------------------------------------------- in-app scene pieces
def save_scene():
    out = os.path.join(ROOT, 'art')
    os.makedirs(out, exist_ok=True)

    # sky: 8 x 40 strip, anchored to the horizon and repeated sideways; solid '1' fills above it
    sky = Image.new('RGB', (8, 40), PAL['1'])
    p = sky.load()
    for y in range(40):
        for x in range(8):
            if y < 8: p[x, y] = PAL['1']
            elif y < 10: p[x, y] = PAL['2'] if (x + y) % 2 and y == 9 or ((x + y) % 4 == 0) else PAL['1']
            elif y < 18: p[x, y] = PAL['2']
            elif y < 20: dither(p, x, y, '2', '3')
            elif y < 30: p[x, y] = PAL['3']
            elif y < 32: dither(p, x, y, '3', '4')
            else: p[x, y] = PAL['4']
    sky.save(os.path.join(out, 'sky.png'))

    # horizon shimmer: 8 x 3
    hz = Image.new('RGB', (8, 3))
    p = hz.load()
    for x in range(8):
        p[x, 0] = PAL['h']
        p[x, 1] = PAL['H']
        dither(p, x, 2, 'H', 'a')
    hz.save(os.path.join(out, 'horizon.png'))

    # waves: 32 x 24 transparent tile of crest/trough dashes (water color comes from CSS)
    wv = Image.new('RGBA', (32, 24), (0, 0, 0, 0))
    p = wv.load()
    for (x, y, n) in [(2, 3, 5), (19, 7, 6), (8, 13, 4), (25, 17, 5), (13, 21, 5)]:
        for i in range(n):
            p[(x + i) % 32, y] = PAL['v'] + (255,)
            p[(x + i + 1) % 32, y + 1] = (5, 40, 100, 90)
    wv.save(os.path.join(out, 'waves.png'))

    # sparkles: two 48 x 32 frames that alternate for the shimmer
    def sparkles(points, singles):
        im = Image.new('RGBA', (48, 32), (0, 0, 0, 0))
        q = im.load()
        for (x, y) in points:
            q[x, y] = PAL['W'] + (255,)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q[x + dx, y + dy] = PAL['x'] + (255,)
        for (x, y) in singles:
            q[x, y] = PAL['W'] + (255,)
        return im
    sparkles([(6, 5), (33, 20)], [(22, 11), (41, 3), (14, 27)]).save(os.path.join(out, 'spark-a.png'))
    sparkles([(24, 8), (11, 22), (42, 27)], [(37, 14), (3, 15)]).save(os.path.join(out, 'spark-b.png'))

    # shore strip for small spaces (wizard side panel): 32 x 12, varied so the repeat isn't obvious
    sh = Image.new('RGB', (32, 12))
    p = sh.load()
    for x in range(32):
        for y in range(12):
            if y == 0: p[x, y] = PAL['h']
            elif y == 1: p[x, y] = PAL['H']
            elif y < 5: p[x, y] = PAL['a']
            elif y == 5: dither(p, x, y, 'a', 'b')
            elif y < 9: p[x, y] = PAL['b']
            else: p[x, y] = PAL['d']
    for (x, y, n) in [(2, 3, 4), (17, 4, 3), (9, 7, 4), (25, 8, 5)]:
        for i in range(n):
            p[(x + i) % 32, y] = PAL['v']
    p[22, 6] = PAL['W']
    p[5, 10] = PAL['W']
    sh.save(os.path.join(out, 'shore.png'))

    sprite(CLOUD_BIG).save(os.path.join(out, 'cloud-1.png'))
    sprite(CLOUD_MID).save(os.path.join(out, 'cloud-2.png'))
    sprite(CLOUD_SMALL).save(os.path.join(out, 'cloud-3.png'))
    sprite(PALM_ISLAND).save(os.path.join(out, 'island.png'))


if __name__ == '__main__':
    for name, rows in [('PALM_ISLAND', PALM_ISLAND), ('CLOUD_BIG', CLOUD_BIG), ('CLOUD_MID', CLOUD_MID), ('CLOUD_SMALL', CLOUD_SMALL)]:
        bad = [i for i, r in enumerate(rows) if len(r) != len(rows[0])]
        assert not bad, f'{name}: rows {bad} have the wrong width'
    save_icons()
    save_scene()
    print('art generated')
