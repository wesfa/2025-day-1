"""Dusk wallpaper: an original pixel-art city at amber dusk (sky, hazy megastructure, two skyline
layers with lit windows and glyph signs, water with shimmering reflections, a dock in front).

Called from tools/make_art.py. Pieces are saved at 1 art pixel = 1 image pixel; the CSS shows them
at 2 CSS px per art pixel with `image-rendering: pixelated`. Everything is generated from fixed
random seeds, so re-running gives the same images.
"""
import os
import random
from PIL import Image

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

# sky, top -> horizon glow
SKY = [HEX(c) for c in ('#1c1410', '#221813', '#2a1d16', '#332218', '#3e281a', '#4b2f1c', '#5b361d', '#6d3f1e', '#81491f', '#985420')]
FAR = HEX('#3d2416'); FAR_LIT = HEX('#4d2d19'); FAR_SH = HEX('#331e13'); FAR_DOT = HEX('#6e3a17'); FAR_DOT2 = HEX('#9a531d')
MID = HEX('#3a2418'); MID_EDGE = HEX('#472c1c'); MID_WIN = HEX('#8a4c1c'); MID_WIN2 = HEX('#b8682a')
NEAR = HEX('#1a100a'); NEAR_EDGE = HEX('#2a1a10'); NEAR_ALT = HEX('#22150d'); NEAR_WIN = HEX('#c8742a'); NEAR_WIN2 = HEX('#f09a3a'); HOT = HEX('#ffd48a')
SIGN = HEX('#f0a034'); SIGN_DIM = HEX('#a8601e'); GLYPH = HEX('#ffd27a')
WATER = [HEX(c) for c in ('#24160d', '#1d120b', '#170e09', '#120b07', '#0e0805')]
REF = [HEX('#5a3014'), HEX('#8c4a1a'), HEX('#c8742a'), HEX('#f0a03c')]
DOCK = HEX('#0a0604'); DOCK_EDGE = HEX('#2a1a10'); DOCK_MID = HEX('#140c07'); LAMP = HEX('#ffd48a'); LAMP_HALO = HEX('#7a431b')
SUN = [HEX('#b8642a'), HEX('#d07a32'), HEX('#e8943e'), HEX('#f6b25a')]
DUST = [HEX('#6e3a17'), HEX('#a0561e'), HEX('#d98a34')]

# 3x5 invented glyphs for the signs (not any real alphabet)
GLYPHS = [
    ['###', '#..', '##.', '#..', '###'], ['#.#', '#.#', '###', '..#', '..#'], ['###', '..#', '.#.', '#..', '###'],
    ['##.', '#.#', '##.', '#.#', '##.'], ['.#.', '###', '.#.', '.#.', '##.'], ['#..', '#..', '###', '#.#', '###'],
    ['###', '#.#', '#.#', '#.#', '#.#'], ['#.#', '.#.', '#.#', '.#.', '#.#'], ['###', '.#.', '.#.', '.#.', '###'],
]


def put(px, img, x, y, c, wrap=True):
    if wrap:
        x %= img.width
    if 0 <= x < img.width and 0 <= y < img.height:
        px[x, y] = c + (255,) if img.mode == 'RGBA' else c


def rect(px, img, x0, y0, w, h, c, wrap=True):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(px, img, x, y, c, wrap)


def glyph_column(px, img, x, y, n, rnd, c=GLYPH):
    """n glyphs stacked vertically starting at (x, y); 3 px wide, 5 tall, 1 px gap."""
    for i in range(n):
        g = GLYPHS[rnd.randrange(len(GLYPHS))]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == '#':
                    put(px, img, x + gx, y + i * 6 + gy, c)


def sign(px, img, x, y, glyphs, rnd, frame=SIGN):
    """Vertical neon sign: 1 px frame around a column of glyphs, with small caps top and bottom."""
    h = glyphs * 6 + 3
    for yy in range(y, y + h):
        put(px, img, x, yy, frame); put(px, img, x + 6, yy, frame)
    for xx in range(x, x + 7):
        put(px, img, xx, y, frame); put(px, img, xx, y + h - 1, frame)
    put(px, img, x + 3, y - 1, frame); put(px, img, x + 3, y - 2, frame); put(px, img, x + 3, y + h, frame)
    glyph_column(px, img, x + 2, y + 2, glyphs, rnd)


# ---------------------------------------------------------------- sky
def sky_tile():
    """4 x 320: the 320 art px of sky above the waterline. Bands get dithered seams."""
    H = 320
    stops = [0, 70, 120, 158, 190, 218, 244, 266, 286, 304]  # row where each SKY band starts
    img = Image.new('RGB', (4, H))
    px = img.load()
    for y in range(H):
        i = max(k for k, s in enumerate(stops) if y >= s)
        for x in range(4):
            c = SKY[i]
            # 2-row checkerboard seam with the band above
            if i > 0 and y - stops[i] < 2 and (x + y) % 2 == 0:
                c = SKY[i - 1]
            px[x, y] = c
    return img


def sun_sprite():
    """Big low sun cut by haze bands that get thicker toward the bottom."""
    R = 19
    S = 2 * R + 1
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    cuts = {}
    # haze bands across the lower half: (row offset from centre, thickness)
    for off, th in [(3, 1), (7, 1), (10, 2), (13, 2), (16, 3)]:
        for t in range(th):
            cuts[off + t] = True
    for y in range(S):
        for x in range(S):
            dx, dy = x - R, y - R
            d = (dx * dx + dy * dy) ** 0.5
            if d > R + 0.3 or cuts.get(dy):
                continue
            # brighter toward the top-left, darker at the rim
            k = 3 - min(3, int((d / R) * 3.2 + (dy + R) / (2 * R) * 1.2))
            px[x, y] = SUN[max(0, min(3, k))] + (255,)
    return img


def dust_tile(seed=11):
    W, H = 96, 128
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for _ in range(14):
        c = DUST[0] if rnd.random() < 0.6 else DUST[1] if rnd.random() < 0.8 else DUST[2]
        px[rnd.randrange(W), rnd.randrange(H)] = c + (255,)
    return img


# ---------------------------------------------------------------- far megastructure
def tower_sprite(seed=3):
    """A colossal stepped arcology, hazy and low-contrast, lit from the left by the sun."""
    rnd = random.Random(seed)
    W, H = 84, 236
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    tiers = [(84, 44), (70, 40), (58, 36), (46, 32), (36, 28), (26, 22), (16, 16), (8, 10)]
    y = H
    cx = W // 2
    for w, h in tiers:
        x0 = cx - w // 2
        y0 = y - h
        rect(px, img, x0, y0, w, h, FAR, wrap=False)
        rect(px, img, x0, y0, 2, h, FAR_LIT, wrap=False)        # sunlit edge
        rect(px, img, x0 + w - 2, y0, 2, h, FAR_SH, wrap=False)  # shade
        rect(px, img, x0 - 1, y0, w + 2, 1, FAR_LIT, wrap=False)  # ledge
        # rows of tiny lights give it scale
        for ly in range(y0 + 4, y - 2, 4):
            for lx in range(x0 + 3, x0 + w - 3, 2):
                r = rnd.random()
                if r < 0.05: put(px, img, lx, ly, FAR_DOT2, wrap=False)
                elif r < 0.18: put(px, img, lx, ly, FAR_DOT, wrap=False)
        y = y0
    # spire + antenna
    rect(px, img, cx - 1, y - 18, 2, 18, FAR, wrap=False)
    rect(px, img, cx - 1, y - 18, 1, 18, FAR_LIT, wrap=False)
    rect(px, img, cx, y - 30, 1, 12, FAR_SH, wrap=False)
    # side platforms sticking out, like docking rings
    for py, pw in [(H - 70, 104), (H - 140, 70)]:
        pass
    return img


# ---------------------------------------------------------------- skylines
def skyline(W, H, seed, wmin, wmax, hmin, hmax, body, edge, win, win2, win_p, signs, tall_every=5, hot=None, alt=None):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    x = 0
    n = 0
    sign_spots = []
    while x < W:
        w = rnd.randint(wmin, wmax)
        if x + w > W:
            w = W - x
            if w < 4:
                break
        h = rnd.randint(hmin, hmax)
        if n % tall_every == tall_every - 1:
            h = min(H - 12, h + rnd.randint(18, 34))
        top = H - h
        col = alt if (alt and rnd.random() < 0.4) else body
        kind = rnd.choice(['slab', 'setback', 'setback', 'stepped', 'works'])
        rect(px, img, x, top, w, h, col)
        rect(px, img, x, top, 1, h, edge)
        rect(px, img, x, top, w, 1, edge)
        if kind == 'setback' and w > 12:        # narrower upper block
            sw = rnd.randint(w // 3, w - 6)
            sx = x + rnd.randint(2, w - sw - 2)
            sh = rnd.randint(8, 22)
            rect(px, img, sx, top - sh, sw, sh, col); rect(px, img, sx, top - sh, sw, 1, edge); rect(px, img, sx, top - sh, 1, sh, edge)
            if rnd.random() < 0.6:
                rect(px, img, sx + sw // 2, top - sh - rnd.randint(5, 12), 1, 12, col)
        elif kind == 'stepped' and w > 10:      # wedding-cake crown
            cx, cw, cy = x, w, top
            for _ in range(rnd.randint(2, 3)):
                cx += 2; cw -= 4; cy -= 4
                if cw < 3: break
                rect(px, img, cx, cy, cw, 4, col); rect(px, img, cx, cy, cw, 1, edge)
            rect(px, img, x + w // 2, cy - 7, 1, 7, col)
        elif kind == 'works' and w > 9:          # tanks, pipes, chimney
            tx = x + rnd.randint(1, max(1, w - 8))
            rect(px, img, tx, top - 5, 7, 5, col); rect(px, img, tx + 1, top - 6, 5, 1, col)
            ch = x + w - 3
            rect(px, img, ch, top - rnd.randint(8, 16), 2, 16, col)
        elif rnd.random() < 0.5 and w > 6:       # plain antenna
            rect(px, img, x + rnd.randint(2, w - 3), top - rnd.randint(4, 10), 1, 10, col)
        # windows: lit floors come in runs, not random dots
        for wy in range(top + 3, H - 2, 4):
            floor_on = rnd.random() < win_p * 2.2
            for wx in range(x + 2, x + w - 1, 3):
                q = rnd.random()
                lit = q < (0.55 if floor_on else win_p * 0.35)
                if lit:
                    put(px, img, wx, wy, win2 if rnd.random() < 0.3 else win)
                elif hot and q > 0.995:
                    put(px, img, wx, wy, hot)
        if w >= 10 and h > 40:
            sign_spots.append((x, top, w, h))
        x += w + (rnd.randint(1, 3) if rnd.random() < 0.3 else 0)
        n += 1
    rnd.shuffle(sign_spots)
    for (bx, top, w, h) in sign_spots[:signs]:
        g = rnd.randint(2, 4)
        sx = bx + (w - 8 if rnd.random() < 0.5 else 1)
        sy = top + rnd.randint(6, max(7, h // 3))
        if sy + g * 6 + 4 < H:
            sign(px, img, sx, sy, g, rnd, frame=SIGN if win2 == NEAR_WIN2 else SIGN_DIM)
    return img


def walkways(img, seed, color, light):
    """Thin elevated rails between buildings, with a light every so often."""
    rnd = random.Random(seed)
    px = img.load()
    for _ in range(3):
        y = rnd.randint(img.height // 3, img.height - 20)
        x0 = rnd.randrange(img.width)
        L = rnd.randint(40, 110)
        for x in range(x0, x0 + L):
            put(px, img, x, y, color)
            if (x - x0) % 9 == 4:
                put(px, img, x, y - 1, light)


# ---------------------------------------------------------------- water + reflections
def water_tile(W=256, H=128):
    img = Image.new('RGB', (W, H))
    px = img.load()
    stops = [0, 10, 26, 52, 84]
    for y in range(H):
        i = max(k for k, s in enumerate(stops) if y >= s)
        for x in range(W):
            c = WATER[i]
            if i > 0 and y - stops[i] < 2 and (x + y) % 2 == 0:
                c = WATER[i - 1]
            px[x, y] = c
    # faint ripple lines
    rnd = random.Random(5)
    for _ in range(70):
        y = rnd.randint(2, H - 1)
        x = rnd.randrange(W)
        for k in range(rnd.randint(3, 9)):
            px[(x + k) % W, y] = WATER[max(0, min(4, stops.index(max(s for s in stops if y >= s)) - 1))]
    return img


def reflections(near, seed, W=256, H=128):
    """Broken horizontal dashes under each lit column of the near skyline."""
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    src = near.load()
    col = [0.0] * W
    for x in range(W):
        for y in range(near.height):
            c = src[x, y]
            if c[3] and sum(c[:3]) > 300:
                col[x] += sum(c[:3]) / 765
    for x in range(W):
        strength = min(3.0, col[x])
        if strength <= 0:
            continue
        for y in range(1, 70):
            p = strength * 0.11 * (1 - y / 70) ** 1.8
            if rnd.random() < p:
                L = rnd.randint(2, 5)
                lvl = 3 if (y < 6 and strength > 2 and rnd.random() < 0.3) else 2 if y < 16 and rnd.random() < 0.4 else 1 if y < 36 and rnd.random() < 0.7 else 0
                for k in range(L):
                    put(px, img, x - L // 2 + k, y, REF[lvl])
    return img


# ---------------------------------------------------------------- dock
def dock_tile(W=160, H=40):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    deck = 26
    rect(px, img, 0, deck, W, H - deck, DOCK)
    rect(px, img, 0, deck, W, 1, DOCK_EDGE)
    for x in range(0, W, 12):                      # plank seams
        rect(px, img, x, deck + 2, 1, 3, DOCK_MID)
    for x in range(4, W, 16):                      # railing posts + rail
        rect(px, img, x, deck - 7, 1, 7, DOCK)
    rect(px, img, 0, deck - 7, W, 1, DOCK)
    # lamp post
    lx = 34
    rect(px, img, lx, deck - 24, 1, 24, DOCK)
    rect(px, img, lx - 2, deck - 25, 5, 1, DOCK)
    rect(px, img, lx - 1, deck - 24, 3, 2, LAMP)
    for hx, hy in [(-2, -23), (2, -23), (0, -21), (-1, -21), (1, -21)]:
        put(px, img, lx + hx, deck + hy, LAMP_HALO)
    # crates and a bollard
    rect(px, img, 92, deck - 6, 9, 6, DOCK); rect(px, img, 92, deck - 6, 9, 1, DOCK_EDGE)
    rect(px, img, 101, deck - 4, 6, 4, DOCK); rect(px, img, 101, deck - 4, 6, 1, DOCK_EDGE)
    rect(px, img, 128, deck - 3, 3, 3, DOCK); rect(px, img, 127, deck - 4, 5, 1, DOCK)
    return img


def haze_tile(H=70):
    """Warm fog that sits on the waterline between the two skylines (thicker near the water)."""
    img = Image.new('RGBA', (4, H), (0, 0, 0, 0))
    px = img.load()
    c = HEX('#7a4220')
    for y in range(H):
        t = y / (H - 1)
        a = int(150 * t ** 1.6)
        for x in range(4):
            # ordered dither on the alpha so it stays pixel-y
            px[x, y] = c + (max(0, a - (40 if (x + y) % 2 else 0)),)
    return img


def save_dusk(root):
    out = os.path.join(root, 'art')
    haze_tile().save(os.path.join(out, 'd-haze.png'))
    sky_tile().save(os.path.join(out, 'd-sky.png'))
    sun_sprite().save(os.path.join(out, 'd-sun.png'))
    dust_tile().save(os.path.join(out, 'd-dust.png'))
    tower_sprite().save(os.path.join(out, 'd-tower.png'))
    mid = skyline(192, 150, seed=21, wmin=8, wmax=20, hmin=60, hmax=120, body=MID, edge=MID_EDGE, win=MID_WIN, win2=MID_WIN2, win_p=0.08, signs=2, tall_every=3)
    walkways(mid, 8, MID_EDGE, MID_WIN)
    mid.save(os.path.join(out, 'd-mid.png'))
    near = skyline(256, 140, seed=42, wmin=12, wmax=34, hmin=26, hmax=86, body=NEAR, edge=NEAR_EDGE, win=NEAR_WIN, win2=NEAR_WIN2, win_p=0.10, signs=4, tall_every=4, hot=HOT, alt=NEAR_ALT)
    walkways(near, 9, NEAR_EDGE, NEAR_WIN2)
    near.save(os.path.join(out, 'd-near.png'))
    water_tile().save(os.path.join(out, 'd-water.png'))
    reflections(near, 1).save(os.path.join(out, 'd-ref-a.png'))
    reflections(near, 2).save(os.path.join(out, 'd-ref-b.png'))
    dock_tile().save(os.path.join(out, 'd-dock.png'))


def preview(root, path, W=195, H=422, water_frac=0.30, tb=27):
    """Compose the layers the way the CSS does, for checking the look (not shipped)."""
    a = lambda n: Image.open(os.path.join(root, 'art', n)).convert('RGBA')
    img = Image.new('RGBA', (W, H), SKY[1] + (255,))
    wl = int(H * (1 - water_frac))  # waterline row
    sky = a('d-sky.png')
    for x in range(0, W, sky.width):
        img.alpha_composite(sky, (x, wl - sky.height))
    dust = a('d-dust.png')
    for y in range(0, wl, dust.height):
        for x in range(0, W, dust.width):
            img.alpha_composite(dust, (x, y))
    img.alpha_composite(a('d-sun.png'), (int(W * 0.16), int(H * 0.13)))
    tw = a('d-tower.png')
    tx = int(W * 0.70) - tw.width // 2
    # beam above the spire
    for y in range(0, wl - tw.height + 2):
        t = y / max(1, wl - tw.height)
        c = (255, 150, 60, int(110 * t))
        img.alpha_composite(Image.new('RGBA', (1, 1), c), (tx + tw.width // 2, y))
    img.alpha_composite(tw, (tx, wl - tw.height + 6))
    L = a('d-mid.png')
    for x in range(0, W, L.width):
        img.alpha_composite(L, (x, wl - L.height))
    haze = a('d-haze.png')
    for x in range(0, W, haze.width):
        img.alpha_composite(haze, (x, wl - haze.height))
    L = a('d-near.png')
    for x in range(0, W, L.width):
        img.alpha_composite(L, (x, wl - L.height))
    wt = a('d-water.png'); rf = a('d-ref-a.png')
    for x in range(0, W, wt.width):
        img.alpha_composite(wt, (x, wl)); img.alpha_composite(rf, (x, wl))
    dk = a('d-dock.png')
    for x in range(0, W, dk.width):
        img.alpha_composite(dk, (x, H - tb - dk.height + 8))
    img.resize((W * 2, H * 2), Image.NEAREST).save(path)
