"""City wallpaper for the "City (live sky)" scheme: an original pixel city drawn once and painted four ways -
dawn, day, golden hour, dusk and night - plus sun, moon, stars, clouds and weather sprites.

Every layer is first drawn as a map of colour *roles* (sky band, building edge, window, sign...). Each time of
day then paints the same map with its own palette, so all four versions line up exactly and the app can
cross-fade between them. Windows carry a fixed random value, so more of them switch on as it gets darker.

Called from tools/make_art.py. Pieces are saved at 1 art pixel = 1 image pixel into art/city/; the CSS shows
them at 2 CSS px per art pixel with `image-rendering: pixelated`. Fixed random seeds keep re-runs identical.
"""
import math
import os
import random
from PIL import Image

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
PHASES = ('dawn', 'day', 'golden', 'dusk', 'night')

# ---------------------------------------------------------------- palettes
SKY = {
    'dawn': ('#1f1c3a', '#2a2246', '#382851', '#4b2e5a', '#61345e', '#7b3c5f', '#97465e', '#b4555c', '#cf6b57', '#e48a5a'),
    'day': ('#3a73c4', '#447ecb', '#4f89d1', '#5b94d7', '#68a0dc', '#76abe0', '#86b6e4', '#97c1e8', '#a9cceb', '#bcd7ee'),
    'golden': ('#36558f', '#466396', '#5b6f9a', '#757b9c', '#93859a', '#b08e92', '#c99a86', '#dca878', '#ebb46a', '#f5c060'),
    'dusk': ('#1c1410', '#221813', '#2a1d16', '#332218', '#3e281a', '#4b2f1c', '#5b361d', '#6d3f1e', '#81491f', '#985420'),
    'night': ('#07080f', '#090b15', '#0c0f1c', '#101423', '#13182a', '#171c31', '#1c2138', '#22263e', '#2a2b44', '#332f48'),
}
# body, sunlit edge, shade edge, window, bright window
TOWER = {
    'dawn': ('#4a3352', '#5e3d5e', '#3e2b47', '#a05a58', '#e0906a'),
    'day': ('#8ba3c0', '#a8bed6', '#7790ae', '#7088a6', '#dbe7f3'),
    'golden': ('#8a6a6a', '#7a5c62', '#e8a86c', '#6a5058', '#ffd08a'),  # the setting sun lights the right-hand edge
    'dusk': ('#3d2416', '#4d2d19', '#331e13', '#6e3a17', '#9a531d'),
    'night': ('#121626', '#181d31', '#0e111d', '#8a5a24', '#e0a040'),
}
TOWER_LIT = {'dawn': (0.10, 0.03), 'day': (0.22, 0.02), 'golden': (0.2, 0.06), 'dusk': (0.18, 0.05), 'night': (0.26, 0.08)}
# body, alt body, edge, window, bright window, hot window, unlit glass
MID = {
    'dawn': ('#3c2a44', '#3c2a44', '#4a3452', '#b5664c', '#e08a5a', '#e08a5a', None),
    'day': ('#7189a4', '#7189a4', '#86a0b8', '#c4d6e6', '#e8f1f8', '#ffffff', '#62798f'),
    'golden': ('#8a7078', '#8a7078', '#b08e86', '#e8b080', '#ffd8a0', '#ffd8a0', '#7a6070'),
    'dusk': ('#3a2418', '#3a2418', '#472c1c', '#8a4c1c', '#b8682a', '#b8682a', None),
    'night': ('#121522', '#121522', '#1a1e2e', '#b06c2a', '#e0943c', '#e0943c', None),
}
NEAR = {
    'dawn': ('#21182a', '#281d32', '#33263f', '#d0784a', '#f0a060', '#ffd7a0', None),
    'day': ('#3f4e61', '#485869', '#5a6c80', '#a9c0d6', '#dbe8f3', '#ffffff', '#33404f'),
    'golden': ('#4a3a44', '#54424a', '#8a6a5a', '#e0a070', '#ffc890', '#fff0c0', '#3e3038'),
    'dusk': ('#1a100a', '#22150d', '#2a1a10', '#c8742a', '#f09a3a', '#ffd48a', None),
    'night': ('#0b0c14', '#0f1019', '#1a1c28', '#e0943a', '#ffb54a', '#ffe2a0', None),
}
WIN_LIT = {'dawn': 0.85, 'day': 0.30, 'golden': 0.5, 'dusk': 1.0, 'night': 1.75}  # share of the dusk lit windows
# sign frame, glyph (near) / frame, glyph (mid)
SIGN = {
    'dawn': ('#f0a034', '#ffd27a', '#a8601e', '#c8803a'),
    'day': ('#6d675c', '#8b8270', '#7d8a99', '#8d98a6'),
    'golden': ('#9a7a58', '#b89468', '#8a7a78', '#9a8a86'),
    'dusk': ('#f0a034', '#ffd27a', '#a8601e', '#ffd27a'),
    'night': ('#ffb040', '#ffe6a0', '#c07028', '#e0a050'),
}
HAZE = {'dawn': ('#e08a6a', 150), 'day': ('#d4e2ef', 170), 'golden': ('#f0b070', 170), 'dusk': ('#7a4220', 150), 'night': ('#2e2640', 140)}
WATER = {
    'dawn': ('#5a3a5e', '#4a3052', '#3a2645', '#2c1d38', '#21162c'),
    'day': ('#5f93c6', '#4f84ba', '#4275ab', '#36679c', '#2b598c'),
    'golden': ('#b89a8a', '#9c8284', '#7e6a78', '#64566a', '#4c445c'),
    'dusk': ('#24160d', '#1d120b', '#170e09', '#120b07', '#0e0805'),
    'night': ('#121624', '#0e111d', '#0b0d17', '#080a12', '#06070d'),
}
REF = {
    'dawn': ('#7a4a5e', '#b0605a', '#e08a60', '#ffc080'),
    'day': ('#7fb0dc', '#a8cdee', '#d6e9f8', '#ffffff'),
    'golden': ('#c08a6a', '#e8a870', '#ffd090', '#fff0c0'),
    'dusk': ('#5a3014', '#8c4a1a', '#c8742a', '#f0a03c'),
    'night': ('#3a2a20', '#8a5a24', '#d08a34', '#ffb848'),
}
# body, top edge, plank seams, lamp, lamp halo (None = lamp off)
DOCK = {
    'dawn': ('#140d18', '#3a2a40', '#1c1322', '#ffd48a', '#7a4a50'),
    'day': ('#26303c', '#46566a', '#2f3a48', '#9aa3ad', None),
    'golden': ('#2a2026', '#5a4440', '#34282e', '#b0a090', None),
    'dusk': ('#0a0604', '#2a1a10', '#140c07', '#ffd48a', '#7a431b'),
    'night': ('#05060a', '#1c2030', '#0b0d14', '#ffe0a0', '#8a5a24'),
}

# 3x5 invented glyphs for the signs (not any real alphabet)
GLYPHS = [
    ['###', '#..', '##.', '#..', '###'], ['#.#', '#.#', '###', '..#', '..#'], ['###', '..#', '.#.', '#..', '###'],
    ['##.', '#.#', '##.', '#.#', '##.'], ['.#.', '###', '.#.', '.#.', '##.'], ['#..', '#..', '###', '#.#', '###'],
    ['###', '#.#', '#.#', '#.#', '#.#'], ['#.#', '.#.', '#.#', '.#.', '#.#'], ['###', '.#.', '.#.', '.#.', '###'],
]


# ---------------------------------------------------------------- role maps
class Roles:
    """A W x H grid of roles. A role is a key string, or (key, value) for windows."""

    def __init__(self, W, H, wrap=True):
        self.W, self.H, self.wrap = W, H, wrap
        self.g = [[None] * W for _ in range(H)]

    def put(self, x, y, role):
        if self.wrap:
            x %= self.W
        if 0 <= x < self.W and 0 <= y < self.H:
            self.g[y][x] = role

    def rect(self, x0, y0, w, h, role):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.put(x, y, role)

    def paint(self, fn):
        img = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        px = img.load()
        for y in range(self.H):
            for x in range(self.W):
                r = self.g[y][x]
                if r is None:
                    continue
                c = fn(r, x, y)
                if c:
                    px[x, y] = (HEX(c) + (255,)) if isinstance(c, str) else c
        return img


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 974711) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535


def sign(R, x, y, glyphs, rnd, kind):
    """Vertical neon sign: 1 px frame around a column of glyphs."""
    h = glyphs * 6 + 3
    for yy in range(y, y + h):
        R.put(x, yy, kind + 'frame'); R.put(x + 6, yy, kind + 'frame')
    for xx in range(x, x + 7):
        R.put(xx, y, kind + 'frame'); R.put(xx, y + h - 1, kind + 'frame')
    R.put(x + 3, y - 1, kind + 'frame'); R.put(x + 3, y - 2, kind + 'frame'); R.put(x + 3, y + h, kind + 'frame')
    for i in range(glyphs):
        g = GLYPHS[rnd.randrange(len(GLYPHS))]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == '#':
                    R.put(x + 2 + gx, y + 2 + i * 6 + gy, kind + 'glyph')


def skyline_roles(W, H, seed, wmin, wmax, hmin, hmax, win_p, signs, tall_every, kind, alt=False):
    rnd = random.Random(seed)
    R = Roles(W, H)
    x = 0
    n = 0
    spots = []
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
        body = 'alt' if (alt and rnd.random() < 0.4) else 'body'
        style = rnd.choice(['slab', 'setback', 'setback', 'stepped', 'works'])
        R.rect(x, top, w, h, body)
        R.rect(x, top, 1, h, 'edge')
        R.rect(x, top, w, 1, 'edge')
        if style == 'setback' and w > 12:
            sw = rnd.randint(w // 3, w - 6)
            sx = x + rnd.randint(2, w - sw - 2)
            sh = rnd.randint(8, 22)
            R.rect(sx, top - sh, sw, sh, body); R.rect(sx, top - sh, sw, 1, 'edge'); R.rect(sx, top - sh, 1, sh, 'edge')
            if rnd.random() < 0.6:
                R.rect(sx + sw // 2, top - sh - rnd.randint(5, 12), 1, 12, body)
        elif style == 'stepped' and w > 10:
            cx, cw, cy = x, w, top
            for _ in range(rnd.randint(2, 3)):
                cx += 2; cw -= 4; cy -= 4
                if cw < 3:
                    break
                R.rect(cx, cy, cw, 4, body); R.rect(cx, cy, cw, 1, 'edge')
            R.rect(x + w // 2, cy - 7, 1, 7, body)
        elif style == 'works' and w > 9:
            tx = x + rnd.randint(1, max(1, w - 8))
            R.rect(tx, top - 5, 7, 5, body); R.rect(tx + 1, top - 6, 5, 1, body)
            R.rect(x + w - 3, top - rnd.randint(8, 16), 2, 16, body)
        elif rnd.random() < 0.5 and w > 6:
            R.rect(x + rnd.randint(2, w - 3), top - rnd.randint(4, 10), 1, 10, body)
        # windows on a 3 x 4 grid; floors tend to light up together
        for wy in range(top + 3, H - 2, 4):
            floor = rnd.random()
            for wx in range(x + 2, x + w - 1, 3):
                score = floor * 0.55 + rnd.random() * 0.45
                R.put(wx, wy, ('win', score / max(win_p * 3.2, 1e-6)))
        if w >= 10 and h > 40:
            spots.append((x, top, w, h))
        x += w + (rnd.randint(1, 3) if rnd.random() < 0.3 else 0)
        n += 1
    rnd.shuffle(spots)
    for (bx, top, w, h) in spots[:signs]:
        g = rnd.randint(2, 4)
        sx = bx + (w - 8 if rnd.random() < 0.5 else 1)
        sy = top + rnd.randint(6, max(7, h // 3))
        if sy + g * 6 + 4 < H:
            sign(R, sx, sy, g, rnd, kind)
    # thin elevated rails with a light every so often
    for _ in range(3):
        y = rnd.randint(H // 3, H - 20)
        x0 = rnd.randrange(W)
        L = rnd.randint(40, 110)
        for xx in range(x0, x0 + L):
            R.put(xx, y, 'edge')
            if (xx - x0) % 9 == 4:
                R.put(xx, y - 1, ('win', 0.0))
    return R


def skyline_painter(pal, phase, kind):
    body, alt, edge, win, win2, hot, glass = pal[phase]
    lit_share = WIN_LIT[phase]
    fr, gl, mfr, mgl = SIGN[phase]
    signs = {'nframe': fr, 'nglyph': gl, 'mframe': mfr, 'mglyph': mgl}

    def fn(r, x, y):
        if isinstance(r, tuple):
            v = r[1]
            if v < 0.36 * lit_share:  # lit share of dusk's ~36%
                k = hsh(x, y, 3)
                return hot if k > 0.985 else win2 if k > 0.7 else win
            return glass or body
        return {'body': body, 'alt': alt, 'edge': edge}.get(r) or signs.get(r)
    return fn


def lit_columns(R, phase, include_signs):
    """How much light each column of a skyline throws onto the water."""
    lit_share = WIN_LIT[phase]
    col = [0.0] * R.W
    for y in range(R.H):
        for x in range(R.W):
            r = R.g[y][x]
            if isinstance(r, tuple) and r[1] < 0.36 * lit_share:
                col[x] += 0.5
            elif include_signs and r in ('nframe', 'nglyph'):
                col[x] += 0.7
    return col


# ---------------------------------------------------------------- pieces
def sky_tile(phase):
    H = 320
    stops = [0, 70, 120, 158, 190, 218, 244, 266, 286, 304]
    cols = [HEX(c) for c in SKY[phase]]
    img = Image.new('RGB', (4, H))
    px = img.load()
    for y in range(H):
        i = max(k for k, s in enumerate(stops) if y >= s)
        for x in range(4):
            c = cols[i]
            if i > 0 and y - stops[i] < 2 and (x + y) % 2 == 0:
                c = cols[i - 1]
            px[x, y] = c
    return img


def tower_roles(seed=3):
    rnd = random.Random(seed)
    W, H = 84, 236
    R = Roles(W, H, wrap=False)
    tiers = [(84, 44), (70, 40), (58, 36), (46, 32), (36, 28), (26, 22), (16, 16), (8, 10)]
    y = H
    cx = W // 2
    for w, h in tiers:
        x0 = cx - w // 2
        y0 = y - h
        R.rect(x0, y0, w, h, 'body')
        R.rect(x0, y0, 2, h, 'lit')
        R.rect(x0 + w - 2, y0, 2, h, 'shade')
        R.rect(x0 - 1, y0, w + 2, 1, 'lit')
        for ly in range(y0 + 4, y - 2, 4):
            for lx in range(x0 + 3, x0 + w - 3, 2):
                R.put(lx, ly, ('dot', rnd.random()))
        y = y0
    R.rect(cx - 1, y - 18, 2, 18, 'body')
    R.rect(cx - 1, y - 18, 1, 18, 'lit')
    R.rect(cx, y - 30, 1, 12, 'shade')
    R.put(cx, y - 31, 'beacon')
    return R


def tower_painter(phase):
    body, lit, shade, dot, dot2 = TOWER[phase]
    t1, t2 = TOWER_LIT[phase]

    def fn(r, x, y):
        if isinstance(r, tuple):
            return dot2 if r[1] < t2 else dot if r[1] < t1 else body
        if r == 'beacon':
            return None if phase in ('day', 'golden') else '#ffcf7a'
        return {'body': body, 'lit': lit, 'shade': shade}[r]
    return fn


def haze_tile(phase, H=70):
    img = Image.new('RGBA', (4, H), (0, 0, 0, 0))
    px = img.load()
    c, amax = HAZE[phase]
    c = HEX(c)
    for y in range(H):
        t = y / (H - 1)
        a = int(amax * t ** 1.6)
        for x in range(4):
            px[x, y] = c + (max(0, a - (40 if (x + y) % 2 else 0)),)
    return img


def water_tile(phase, W=256, H=128):
    cols = [HEX(c) for c in WATER[phase]]
    img = Image.new('RGB', (W, H))
    px = img.load()
    stops = [0, 10, 26, 52, 84]
    band = lambda y: max(k for k, s in enumerate(stops) if y >= s)
    for y in range(H):
        i = band(y)
        for x in range(W):
            c = cols[i]
            if i > 0 and y - stops[i] < 2 and (x + y) % 2 == 0:
                c = cols[i - 1]
            px[x, y] = c
    rnd = random.Random(5)
    for _ in range(70):
        y = rnd.randint(2, H - 1)
        x = rnd.randrange(W)
        for k in range(rnd.randint(3, 9)):
            px[(x + k) % W, y] = cols[max(0, band(y) - 1)]
    return img


def reflections(near, phase, seed, W=256, H=128):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    cols = [HEX(c) + (255,) for c in REF[phase]]
    col = lit_columns(near, phase, include_signs=phase not in ('day', 'golden'))
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
                    px[(x - L // 2 + k) % W, y] = cols[lvl]
    if phase in ('day', 'golden'):  # sun glints scattered across the water
        for _ in range(60 if phase == 'day' else 90):
            x, y = rnd.randrange(W), rnd.randint(2, 90)
            L = rnd.randint(1, 4)
            c = cols[3] if rnd.random() < 0.3 else cols[2] if rnd.random() < 0.6 else cols[1]
            for k in range(L):
                px[(x + k) % W, y] = c
    return img


def dock_tile(phase, W=400, H=40):
    body, edge, seam, lamp, halo = DOCK[phase]
    R = Roles(W, H)
    deck = 26
    R.rect(0, deck, W, H - deck, 'b'); R.rect(0, deck, W, 1, 'e')
    for x in range(0, W, 12):
        R.rect(x, deck + 2, 1, 3, 's')
    for x in range(4, W, 16):
        if not 236 <= x <= 262:
            R.rect(x, deck - 7, 1, 7, 'b')
    for x in range(W):
        if not 236 <= x <= 262:
            R.put(x, deck - 7, 'b')
    for lx in (34, 164):  # lamp posts
        R.rect(lx, deck - 24, 1, 24, 'b'); R.rect(lx - 2, deck - 25, 5, 1, 'b'); R.rect(lx - 1, deck - 24, 3, 2, 'l')
        for hx, hy in [(-2, -23), (2, -23), (0, -21), (-1, -21), (1, -21)]:
            R.put(lx + hx, deck + hy, 'h')
    R.rect(92, deck - 6, 9, 6, 'b'); R.rect(92, deck - 6, 9, 1, 'e')
    R.rect(101, deck - 4, 6, 4, 'b'); R.rect(101, deck - 4, 6, 1, 'e')
    R.rect(128, deck - 3, 3, 3, 'b'); R.rect(127, deck - 4, 5, 1, 'b')
    # someone sitting at the edge of the dock with a lantern, looking out at the city
    fx = 248
    R.rect(fx, deck - 9, 2, 2, 'b')            # head
    R.rect(fx - 1, deck - 7, 4, 4, 'b')        # shoulders and back
    R.rect(fx - 1, deck - 3, 6, 3, 'b')        # sitting
    R.rect(fx + 4, deck - 1, 1, 1, 'b')
    R.rect(fx - 4, deck - 4, 1, 4, 'b')        # lantern hook
    R.rect(fx - 5, deck - 3, 3, 3, 'L')        # lantern
    for hx, hy in [(-6, -4), (-2, -4), (-7, -2), (-1, -2), (-4, -6)]:
        R.put(fx + hx, deck + hy, 'h')
    # a small boat tied up beyond the dock
    bx = 300
    for i, (a, w) in enumerate([(0, 24), (1, 22), (3, 18)]):
        R.rect(bx + a, deck - 4 + i, w, 1, 'b')
    R.rect(bx + 8, deck - 8, 7, 4, 'b'); R.rect(bx + 8, deck - 8, 7, 1, 'e')
    R.put(bx + 10, deck - 6, 'L'); R.rect(bx + 3, deck - 13, 1, 9, 'b')
    for x in range(bx - 6, bx):
        R.put(x, deck - 3 + (x - bx + 6) // 3, 's')   # mooring line
    return R.paint(lambda r, x, y: {'b': body, 'e': edge, 's': seam, 'l': lamp, 'h': halo, 'L': lamp if halo else None}[r])


def ring_moon(k):
    """The moon drawn as a thin ring of light; k = how much of the ring shows (follows the moon phase)."""
    R = 9
    S = 2 * R + 5
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    c = S // 2
    span = math.pi * 2 * k
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - c, y - c)
            ang = abs(math.atan2(y - c, x - c))  # 0 = right-hand side
            if ang > span / 2 + 0.01 and k < 1:
                continue
            if R - 0.7 <= d <= R + 0.5:
                px[x, y] = HEX('#ffb456') + (255,)
            elif R + 0.5 < d <= R + 1.6 and (x + y) % 2 == 0:
                px[x, y] = HEX('#ff9a40') + (90,)
            elif R - 1.8 <= d < R - 0.7 and (x + y) % 2 == 0:
                px[x, y] = HEX('#ff9a40') + (50,)
    return img


def holo_sign(seed=4):
    """A floating sign: glyphs in a box with a bright top rail and little tick marks around it."""
    import skyline as sk
    rnd = random.Random(seed)
    W, H = 34, 18
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    frame, glyph, tick = HEX('#f0a034') + (255,), HEX('#ffd27a') + (255,), HEX('#ffb050') + (200,)
    x0, y0, w, h = 2, 4, 28, 11
    for x in range(x0, x0 + w):
        px[x, y0] = frame; px[x, y0 + h - 1] = frame
    for y in range(y0, y0 + h):
        px[x0, y] = frame; px[x0 + w - 1, y] = frame
    for x in range(x0 + 3, x0 + w - 3):
        px[x, y0 - 2] = frame if x % 3 else tick  # rail above
    for i in range(5):
        g = sk.GLYPHS[rnd.randrange(len(sk.GLYPHS))]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == '#':
                    px[x0 + 3 + i * 5 + gx, y0 + 3 + gy] = glyph
    for (tx, ty) in [(32, 2), (33, 1), (30, 1), (0, 14), (1, 16), (31, 16)]:
        px[tx, ty] = tick
    return img


def disc(R, cols, cut=None):
    S = 2 * R + 1
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    for y in range(S):
        for x in range(S):
            dx, dy = x - R, y - R
            d = math.hypot(dx, dy)
            if d > R + 0.3 or (cut and cut(dx, dy)):
                continue
            k = len(cols) - 1 - min(len(cols) - 1, int((d / R) * (len(cols) - 0.2) + (dy + R) / (2 * R) * 1.2))
            px[x, y] = HEX(cols[max(0, k)]) + (255,)
    return img


def sun_low():
    """Big low sun cut by haze bands (dawn and dusk)."""
    cuts = set()
    for off, th in [(3, 1), (7, 1), (10, 2), (13, 2), (16, 3)]:
        cuts.update(range(off, off + th))
    return disc(19, ['#b8642a', '#d07a32', '#e8943e', '#f6b25a'], cut=lambda dx, dy: dy in cuts)


def sun_day():
    """Small bright midday sun with a dithered glow ring."""
    R = 10
    S = 2 * R + 9
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    c = S // 2
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - c, y - c)
            if d <= R + 0.3:
                px[x, y] = HEX('#fffbe8' if d < R * 0.55 else '#fff3c4' if d < R * 0.85 else '#ffe39a') + (255,)
            elif d <= R + 2.5 and (x + y) % 2 == 0:
                px[x, y] = HEX('#fff4cc') + (120,)
            elif d <= R + 4.3 and (x + y) % 4 == 0:
                px[x, y] = HEX('#fff4cc') + (70,)
    return img


def moon(k):
    """Waxing moon, k = lit fraction (0.25 crescent ... 1 full); the app mirrors it for waning."""
    R = 9
    S = 2 * R + 1
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()
    craters = [(-3, -2, 2), (2, 3, 1.6), (3, -4, 1.2), (-1, 4, 1.1)]
    for y in range(S):
        for x in range(S):
            nx, ny = (x - R) / R, (y - R) / R
            if nx * nx + ny * ny > 1.02:
                continue
            edge = math.sqrt(max(0.0, 1 - ny * ny))
            lit = nx >= (1 - 2 * k) * edge
            if lit:
                c = '#efeadb'
                for cx, cy, cr in craters:
                    if math.hypot(x - R - cx, y - R - cy) < cr:
                        c = '#cfc8b5'
                px[x, y] = HEX(c) + (255,)
            else:
                px[x, y] = HEX('#2a2e44') + (110,)  # faint earthshine on the dark side
    return img


def dots_tile(W, H, seed, n, cols, plus=0):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for i in range(n):
        x, y = rnd.randrange(W), rnd.randrange(H)
        c = cols[rnd.randrange(len(cols))]
        px[x, y] = c
        if i < plus:
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                px[(x + dx) % W, (y + dy) % H] = c[:3] + (150,)
    return img


def birds(frame):
    """A few tiny birds; frame 0 wings up, frame 1 wings level."""
    W, H = 200, 70
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    c = HEX('#26303c') + (255,)
    up = [(-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)]
    flat = [(-2, 0), (-1, 0), (0, 1), (1, 0), (2, 0)]
    for (bx, by) in [(20, 30), (31, 24), (40, 33), (130, 14), (141, 19)]:
        for dx, dy in (up if frame == 0 else flat):
            px[bx + dx, by + dy] = c
    return img


def cloud_sprite(seed, W, H, puffs):
    """Neutral 3-tone pixel cloud; the app tints it for the time of day."""
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    blobs = []
    for i in range(puffs):
        cx = int(W * (0.15 + 0.7 * i / max(1, puffs - 1))) + rnd.randint(-3, 3)
        r = rnd.randint(int(H * 0.28), int(H * 0.48))
        cy = H - r - 2 + rnd.randint(-2, 2)
        blobs.append((cx, cy, r))
    for y in range(H):
        for x in range(W):
            inside = [b for b in blobs if math.hypot(x - b[0], (y - b[1]) * 1.15) <= b[2]]
            if not inside or y > H - 3:
                continue
            top = min(b[1] - b[2] for b in inside)
            depth = (y - top) / max(1, H - top)
            c = '#ffffff' if depth < 0.35 else '#e4e9f0' if depth < 0.7 else '#c3cbd7'
            px[x, y] = HEX(c) + (255,)
    return img


def deck_tile(W=128, H=48):
    """Overcast: a solid band of cloud across the top of the sky, with a lumpy lower edge."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for x in range(W):
        bottom = int(H * 0.72 + 6 * math.sin(x / W * math.tau * 3) + 3 * math.sin(x / W * math.tau * 7 + 1))
        for y in range(min(H, bottom)):
            depth = y / max(1, bottom)
            c = '#c9d0db' if depth < 0.5 else '#d8dee6' if depth < 0.85 else '#eef1f5'
            px[x, y] = HEX(c) + (255,)
    return img


def rain_tile(seed, n, color, alpha, W=64, H=96, L=4):
    rnd = random.Random(seed)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    c = HEX(color) + (alpha,)
    for _ in range(n):
        x, y = rnd.randrange(W), rnd.randrange(H)
        for k in range(L):
            px[(x - k // 3) % W, (y + k) % H] = c  # slight slant
    return img


def fog_tile(W=256, H=60):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    for y in range(H):
        for x in range(W):
            band = 0.5 + 0.5 * math.sin(y / H * math.pi)  # thickest in the middle
            wave = 0.5 + 0.5 * math.sin(x / W * math.tau * 2 + y * 0.15)
            a = int(120 * band * (0.55 + 0.45 * wave))
            if (x + y) % 2:
                a = max(0, a - 30)
            px[x, y] = HEX('#e8ecf2') + (a,)
    return img


def save_city(root):
    import skyline as sk
    out = os.path.join(root, 'art', 'city')
    os.makedirs(out, exist_ok=True)
    far = sk.layer(224, 170, seed=5, kind='far')
    mid = sk.layer(256, 150, seed=21, kind='mid')
    near = sk.layer(320, 150, seed=42, kind='near')
    side = sk.side_structure()
    pyr = sk.pyramid()
    for p in PHASES:
        sky_tile(p).save(os.path.join(out, f'sky-{p}.png'))
        pyr.paint(sk.painter(p, 'pyramid')).save(os.path.join(out, f'pyramid-{p}.png'))
        far.paint(sk.painter(p, 'far')).save(os.path.join(out, f'far-{p}.png'))
        mid.paint(sk.painter(p, 'mid')).save(os.path.join(out, f'mid-{p}.png'))
        haze_tile(p).save(os.path.join(out, f'haze-{p}.png'))
        near.paint(sk.painter(p, 'near')).save(os.path.join(out, f'near-{p}.png'))
        side.paint(sk.painter(p, 'side')).save(os.path.join(out, f'side-{p}.png'))
        water_tile(p).save(os.path.join(out, f'water-{p}.png'))
        sk.reflections(near, p, 1, WATER[p][0], REF[p]).save(os.path.join(out, f'ref-a-{p}.png'))
        sk.reflections(near, p, 2, WATER[p][0], REF[p]).save(os.path.join(out, f'ref-b-{p}.png'))
        dock_tile(p).save(os.path.join(out, f'dock-{p}.png'))
    sun_low().save(os.path.join(out, 'sun-low.png'))
    sun_day().save(os.path.join(out, 'sun-day.png'))
    for i, k in enumerate((0.34, 0.55, 0.78, 1.0), 1):
        ring_moon(k).save(os.path.join(out, f'ring-{i}.png'))
    holo_sign().save(os.path.join(out, 'holo.png'))
    star = [HEX('#c8cde0') + (255,), HEX('#9aa3c0') + (255,), HEX('#ffffff') + (255,)]
    dots_tile(128, 128, 31, 26, star, plus=2).save(os.path.join(out, 'stars-a.png'))
    dots_tile(128, 128, 32, 18, star).save(os.path.join(out, 'stars-b.png'))
    dots_tile(96, 128, 11, 14, [HEX(c) + (255,) for c in ('#6e3a17', '#6e3a17', '#a0561e', '#d98a34')]).save(os.path.join(out, 'embers.png'))
    birds(0).save(os.path.join(out, 'birds-a.png'))
    birds(1).save(os.path.join(out, 'birds-b.png'))
    cloud_sprite(1, 64, 22, 4).save(os.path.join(out, 'cloud-1.png'))
    cloud_sprite(2, 44, 16, 3).save(os.path.join(out, 'cloud-2.png'))
    cloud_sprite(3, 90, 14, 6).save(os.path.join(out, 'cloud-3.png'))
    deck_tile().save(os.path.join(out, 'cloud-deck.png'))
    rain_tile(7, 26, '#b4c8e0', 170).save(os.path.join(out, 'rain.png'))
    rain_tile(8, 30, '#8ea4c0', 110, L=3).save(os.path.join(out, 'rain-far.png'))
    dots_tile(96, 96, 9, 26, [HEX('#ffffff') + (230,), HEX('#e8eef6') + (200,)], plus=6).save(os.path.join(out, 'snow.png'))
    dots_tile(96, 96, 10, 30, [HEX('#ffffff') + (150,)]).save(os.path.join(out, 'snow-far.png'))
    fog_tile().save(os.path.join(out, 'fog.png'))


def preview(root, path, phase, W=195, H=422, water_frac=0.30, tb=27):
    """Compose one phase the way the CSS does (for checking the look; not shipped)."""
    a = lambda n: Image.open(os.path.join(root, 'art', 'city', n)).convert('RGBA')
    img = Image.new('RGBA', (W, H), HEX(SKY[phase][0]) + (255,))
    wl = int(H * (1 - water_frac))
    def row(name, x0=0, bottom=None, alpha=None):
        L = a(name)
        if alpha is not None:
            L.putalpha(L.getchannel('A').point(lambda v: int(v * alpha)))
        b = wl if bottom is None else bottom
        x = x0 % L.width - L.width
        while x < W:
            img.alpha_composite(L, (x, b - L.height)); x += L.width
    row(f'sky-{phase}.png')
    if phase == 'night':
        st = a('stars-a.png')
        for y in range(0, wl, st.height):
            for x in range(0, W, st.width):
                img.alpha_composite(st, (x, y))
    sun = a('sun-day.png' if phase == 'day' else 'ring-4.png' if phase in ('night', 'dusk') else 'sun-low.png')
    img.alpha_composite(sun, (int(W * (0.62 if phase == 'golden' else 0.44)), int(H * (0.12 if phase in ('day', 'night', 'dusk') else 0.36))))
    tw = a(f'pyramid-{phase}.png')
    img.alpha_composite(tw, (int(W * 0.52) - tw.width // 2, wl - tw.height - 30))
    row(f'far-{phase}.png', -30)
    row(f'haze-{phase}.png', bottom=wl - 30, alpha=0.6)
    row(f'mid-{phase}.png', -20)
    row(f'haze-{phase}.png')
    row(f'near-{phase}.png', -48)
    img.alpha_composite(a('holo.png'), (int(W * 0.66), int(H * 0.3)))
    sd = a(f'side-{phase}.png')
    img.alpha_composite(sd, (-4, wl - sd.height + 3))
    wt = a(f'water-{phase}.png')
    for x in range(0, W, wt.width):
        img.alpha_composite(wt, (x, wl))
    rf = a(f'ref-a-{phase}.png')
    x = -48 % rf.width - rf.width
    while x < W:
        img.alpha_composite(rf, (x, wl)); x += rf.width
    dk = a(f'dock-{phase}.png')
    for x in range(0, W, dk.width):
        img.alpha_composite(dk, (x, H - tb - dk.height + 8))
    img.resize((W * 2, H * 2), Image.NEAREST).save(path)
