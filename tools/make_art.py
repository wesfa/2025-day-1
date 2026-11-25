#!/usr/bin/env python3
"""Generate Macros' pixel art: home-screen icons (tools/key_icon.py), the Dusk wallpaper
(tools/dusk_art.py), and the older Meadow and Island scene pieces.

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

# Meadow palette: deep sky, white clouds, rolling green hills
MPAL = {
    's1': (30, 86, 214), 's2': (44, 108, 226), 's3': (66, 134, 236), 's4': (102, 166, 244), 's5': (150, 200, 250),
    'h0': (176, 228, 104), 'h1': (120, 198, 64), 'h2': (86, 172, 48), 'h3': (66, 146, 38), 'h4': (52, 122, 30), 'h5': (42, 102, 26),
    'far': (122, 170, 96), 'far2': (104, 152, 84),
    'fy': (255, 236, 92), 'fw': (250, 250, 240),
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
CLOUD_HUGE = [  # 26 x 9 - a tall summer cumulus
    '..........WWWW............',
    '.......WWWWWWWWW..........',
    '.....WWWWWWWWWWWW.WWWW....',
    '....WWWWWWWWWWWWWWWWWWWW..',
    '..WWWWWWWWWWWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWWWW',
    'cWWWWWWWWWWWWWWWWWWWWWWWWc',
    '.ccCCCCCCCCCCCCCCCCCCCCcc.',
]
CLOUD_WISP = [  # 30 x 4 - a thin high streak
    '...................WWWWWW.....',
    '...........WWWWWWWWWWWWWWWWW..',
    '....cWWWWWWWWWWWcccc....cccWWc',
    'cccc.......cccc...............',
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


# ---------------------------------------------------------------- meadow (default scheme)
def mset(px, x, y, key):
    px[x, y] = MPAL[key]


def mdither(px, x, y, a, b):
    px[x, y] = MPAL[a] if (x + y) % 2 else MPAL[b]


def paint_hills(img, ox, horizon, width, crest_x, crest_y, left_y, right_y, far=True, flowers=()):
    """Rolling hill: smooth crest, highlight on top, greens deepening downhill, a distant hill behind."""
    px = img.load()
    W, H = img.size
    def main_y(x):
        if x <= crest_x:
            t = (crest_x - x) / max(1, crest_x)
            return crest_y + (left_y - crest_y) * t * t
        t = (x - crest_x) / max(1, width - 1 - crest_x)
        return crest_y + (right_y - crest_y) * t * t
    def far_y(x):
        c = width * 0.8
        t = (x - c) / (width * 0.45)
        return horizon - 1 - (horizon - crest_y) * 0.45 * max(0, 1 - t * t)
    for X in range(W):
        x = X - ox
        if far:
            fy = int(round(far_y(x)))
            for Y in range(max(0, fy), H):
                px[X, Y] = MPAL['far'] if Y - fy < 2 else MPAL['far2']
        my = int(round(main_y(x)))
        for Y in range(max(0, my), H):
            d = Y - my
            depth = (Y - crest_y) / max(1, H - crest_y)
            if d == 0: mset(px, X, Y, 'h0')
            elif d == 1: mdither(px, X, Y, 'h0', 'h1')
            elif depth < 0.22: mset(px, X, Y, 'h1')
            elif depth < 0.28: mdither(px, X, Y, 'h1', 'h2')
            elif depth < 0.5: mset(px, X, Y, 'h2')
            elif depth < 0.56: mdither(px, X, Y, 'h2', 'h3')
            elif depth < 0.78: mset(px, X, Y, 'h3')
            elif depth < 0.84: mdither(px, X, Y, 'h3', 'h4')
            else: mset(px, X, Y, 'h4')
            # grass texture: sparse darker tufts that follow the slope
            if d > 2 and (X * 7 + Y * 13) % 29 == 0: mset(px, X, Y, 'h5' if depth > 0.5 else 'h3')
    for (x, y, key) in flowers:
        X = ox + x
        if 0 <= X < W and 0 <= y < H: mset(px, X, y, key)


def meadow_sky(img, top_rows, oy=0):
    """Deep blue overhead, lighter toward the horizon, dithered between bands."""
    px = img.load()
    W, H = img.size
    bands = ['s1', 's2', 's3', 's4', 's5']
    for y in range(H):
        f = (y - oy) / max(1, top_rows)
        i = min(len(bands) - 1, max(0, int(f * len(bands))))
        edge = (f * len(bands)) % 1
        for x in range(W):
            if i + 1 < len(bands) and edge > 0.82: mdither(px, x, y, bands[i], bands[i + 1])
            else: mset(px, x, y, bands[i])


def meadow_icon(W, H, ox=0, oy=0):
    img = Image.new('RGB', (W, H))
    meadow_sky(img, 20, oy)
    blit(img, CLOUD_MID, ox + 1, oy + 3)
    blit(img, CLOUD_SMALL, ox + 20, oy + 2)
    blit(img, CLOUD_WISP[:2], ox + 9, oy + 10)
    blit(img, CLOUD_SMALL, ox + 25, oy + 13)
    flowers = [(5, oy + 27, 'fy'), (9, oy + 30, 'fw'), (14, oy + 28, 'fy'), (19, oy + 31, 'fy'), (24, oy + 29, 'fw'), (28, oy + 30, 'fy'), (3, oy + 31, 'fy')]
    paint_hills(img, ox, oy + 20, 32, crest_x=11, crest_y=oy + 15, left_y=oy + 18, right_y=oy + 23, flowers=flowers)
    return img


def save_meadow_icons(out):
    """The previous (Meadow) home-screen icon - kept for reference, no longer written by default."""
    base = meadow_icon(32, 32)
    big = meadow_icon(36, 36, 2, 2)   # extra 2px of scene on each side for the 180px size
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

    # ---- meadow wallpaper pieces ----
    sky = Image.new('RGB', (8, 64))
    meadow_sky(sky, 64)
    sky.save(os.path.join(out, 'm-sky.png'))
    hill = Image.new('RGBA', (240, 40), (0, 0, 0, 0))
    flowers = [((x * 37) % 240, 22 + (x * 11) % 18, 'fy' if x % 3 else 'fw') for x in range(26)]
    paint_hills(hill, 0, 34, 240, crest_x=92, crest_y=4, left_y=16, right_y=30, flowers=flowers)
    # clear everything above each column's hill top (paint_hills only paints downward, so just keep alpha)
    hill.save(os.path.join(out, 'm-hill.png'))
    import random
    rnd = random.Random(7)  # fixed seed so the art is the same every run
    field = Image.new('RGB', (64, 32), MPAL['h4'])
    p = field.load()
    for y in range(32):
        for x in range(64):
            r = rnd.random()
            if r < 0.10: p[x, y] = MPAL['h3']
            elif r < 0.16: p[x, y] = MPAL['h5']
    for _ in range(9):
        p[rnd.randrange(64), rnd.randrange(32)] = MPAL['fy' if rnd.random() < 0.65 else 'fw']
    field.save(os.path.join(out, 'm-field.png'))
    sprite(CLOUD_HUGE).save(os.path.join(out, 'm-cloud-huge.png'))
    sprite(CLOUD_WISP).save(os.path.join(out, 'm-cloud-wisp.png'))

    sprite(CLOUD_BIG).save(os.path.join(out, 'cloud-1.png'))
    sprite(CLOUD_MID).save(os.path.join(out, 'cloud-2.png'))
    sprite(CLOUD_SMALL).save(os.path.join(out, 'cloud-3.png'))
    sprite(PALM_ISLAND).save(os.path.join(out, 'island.png'))


if __name__ == '__main__':
    for name, rows in [('PALM_ISLAND', PALM_ISLAND), ('CLOUD_BIG', CLOUD_BIG), ('CLOUD_MID', CLOUD_MID), ('CLOUD_SMALL', CLOUD_SMALL), ('CLOUD_HUGE', CLOUD_HUGE), ('CLOUD_WISP', CLOUD_WISP)]:
        bad = [i for i, r in enumerate(rows) if len(r) != len(rows[0])]
        assert not bad, f'{name}: rows {bad} have the wrong width'
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from key_icon import save_key_icons
    from dusk_art import save_dusk
    save_key_icons(os.path.join(ROOT, 'icons'))
    save_scene()
    save_dusk(ROOT)
    print('art generated')
