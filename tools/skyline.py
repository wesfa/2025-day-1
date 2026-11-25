"""Skyline layers for the City wallpaper: far, mid and near rows of buildings plus a tall foreground
structure at the left edge, all drawn as colour *roles* and painted per time of day (see city_art.py).

What makes it read as a dense city rather than a row of boxes:
  - several building types: setback blocks, platforms on thin stems, blocks raised on stilts, cantilevered
    slabs, industrial works with tanks and chimneys, cranes, needle spires;
  - buildings overlap, and thin rails, pipes and sagging cables with little lights run across the whole layer;
  - lights come in strips and clusters (lit floors), with beacons on tips and neon signs (vertical and boxed);
  - every layer is tinted toward the horizon haze by its distance, so far is pale and near is nearly black.
"""
import random
from PIL import Image

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
TOHEX = lambda c: '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)


def mix(a, b, t):
    a, b = HEX(a), HEX(b)
    return TOHEX([a[i] + (b[i] - a[i]) * t for i in range(3)])


# Per time of day: darkest silhouette colour, horizon colour (haze), lights, glass (day only), neon on/off
BASE = {
    'dawn': dict(dark='#170f1c', hz='#e48a5a', lit='#d0784a', lit2='#f0a060', hot='#ffd7a0', glass=None, neon=('#f0a034', '#ffd27a'), beacon='#ffb070'),
    'day': dict(dark='#2a3748', hz='#bcd7ee', lit='#a9c0d6', lit2='#dbe8f3', hot='#ffffff', glass=0.14, neon=('#6d675c', '#8b8270'), beacon=None),
    'golden': dict(dark='#2a1f28', hz='#f5c060', lit='#e0a070', lit2='#ffc890', hot='#fff0c0', glass=0.1, neon=('#9a7a58', '#b89468'), beacon=None),
    'dusk': dict(dark='#120a06', hz='#985420', lit='#c8742a', lit2='#f09a3a', hot='#ffd48a', glass=None, neon=('#f0a034', '#ffd27a'), beacon='#ffcf7a'),
    'night': dict(dark='#07080d', hz='#332f48', lit='#e0943a', lit2='#ffb54a', hot='#ffe2a0', glass=None, neon=('#ffb040', '#ffe6a0'), beacon='#ff9a50'),
}
# The pyramid sits in the sky haze, only a little darker than the sky behind it: face, shade face, rim, glow bands
PYR = {
    'dawn': ('#4c2b4e', '#412542', '#5e3a5c', '#e08a5a'),
    'day': ('#6c98c6', '#6189b6', '#80aad4', '#dbe8f3'),
    'golden': ('#7e6e7e', '#b08a6a', '#94848e', '#ffd08a'),
    'dusk': ('#3d2718', '#332011', '#4d321e', '#d07a2e'),
    'night': ('#13172b', '#0f1222', '#1c2138', '#c8842e'),
}
WIN_LIT = {'dawn': 0.8, 'day': 0.22, 'golden': 0.42, 'dusk': 1.0, 'night': 1.6}
# distance -> how far toward the haze colour (0 = black silhouette), light dimming, base share of lit windows
DEPTH = {'side': (0.0, 0.0, 0.4), 'near': (0.04, 0.0, 0.4), 'mid': (0.24, 0.16, 0.36), 'far': (0.42, 0.34, 0.3), 'tower': (0.58, 0.5, 0.18)}

GLYPHS = [
    ['###', '#..', '##.', '#..', '###'], ['#.#', '#.#', '###', '..#', '..#'], ['###', '..#', '.#.', '#..', '###'],
    ['##.', '#.#', '##.', '#.#', '##.'], ['.#.', '###', '.#.', '.#.', '##.'], ['#..', '#..', '###', '#.#', '###'],
    ['###', '#.#', '#.#', '#.#', '#.#'], ['#.#', '.#.', '#.#', '.#.', '#.#'], ['###', '.#.', '.#.', '.#.', '###'],
    ['.##', '#..', '.#.', '..#', '##.'], ['#.#', '###', '#.#', '#.#', '#.#'],
]


class Roles:
    def __init__(self, W, H, wrap=True):
        self.W, self.H, self.wrap = W, H, wrap
        self.g = [[None] * W for _ in range(H)]

    def put(self, x, y, role, keep_lights=False):
        if self.wrap:
            x %= self.W
        if 0 <= x < self.W and 0 <= y < self.H:
            if keep_lights and isinstance(self.g[y][x], tuple):
                return
            self.g[y][x] = role

    def get(self, x, y):
        if self.wrap:
            x %= self.W
        return self.g[y][x] if 0 <= x < self.W and 0 <= y < self.H else None

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
                    px[x, y] = HEX(c) + (255,)
        return img


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 974711) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535


# ---------------------------------------------------------------- pieces of buildings
def lights(R, rnd, x0, y0, w, h, style=None, occ=None):
    """Fill a facade with lights. Each light keeps a fixed score; darker times of day light more of them."""
    if w < 3 or h < 3:
        return
    style = style or rnd.choice(['grid', 'strips', 'strips', 'clusters', 'columns'])
    occ = rnd.random() if occ is None else occ  # how "busy" this building is
    if style == 'grid':
        sx, sy = rnd.choice([2, 3]), rnd.choice([3, 4])
        for y in range(y0 + 1, y0 + h - 1, sy):
            floor = rnd.random()
            for x in range(x0 + 1, x0 + w - 1, sx):
                R.put(x, y, ('w', floor * 0.5 + rnd.random() * 0.3 + (1 - occ) * 0.4))
    elif style == 'strips':  # whole floors lit as lines
        sy = rnd.choice([3, 4, 5])
        for y in range(y0 + 1, y0 + h - 1, sy):
            score = rnd.random() * 0.75 + (1 - occ) * 0.45
            a = x0 + 1 + rnd.randint(0, max(0, w // 4))
            b = x0 + w - 1 - rnd.randint(0, max(0, w // 4))
            for x in range(a, b):
                R.put(x, y, ('l', score + (0.25 if hsh(x, y, 4) > 0.86 else 0)))
    elif style == 'columns':  # vertical light bands
        for x in range(x0 + 2, x0 + w - 1, rnd.choice([3, 4, 5])):
            score = rnd.random() * 0.8 + (1 - occ) * 0.4
            for y in range(y0 + 2, y0 + h - 1):
                if hsh(x, y, 7) > 0.2:
                    R.put(x, y, ('l', score))
    else:  # a few bright clusters
        for _ in range(max(1, w * h // 60)):
            cx, cy = rnd.randint(x0, x0 + w - 1), rnd.randint(y0, y0 + h - 1)
            score = rnd.random() * 0.7 + (1 - occ) * 0.35
            for dx in range(rnd.randint(1, 4)):
                for dy in range(0, rnd.randint(1, 3) * 2, 2):
                    if x0 <= cx + dx < x0 + w and y0 <= cy + dy < y0 + h:
                        R.put(cx + dx, cy + dy, ('w', score))


def floor_lines(R, rnd, x0, y0, w, h):
    step = rnd.choice([5, 6, 8])
    for y in range(y0 + step, y0 + h - 1, step):
        for x in range(x0 + 1, x0 + w):
            R.put(x, y, 'd', keep_lights=True)


def antenna(R, rnd, x, top, H):
    h = rnd.randint(4, 14)
    R.rect(x, top - h, 1, h, 'b')
    if rnd.random() < 0.5:
        R.rect(x - 1, top - h + 2, 3, 1, 'b')
    R.put(x, top - h - 1, 'k')


def block(R, rnd, x, w, h, H):
    top = H - h
    R.rect(x, top, w, h, 'b')
    R.rect(x, top, w, 1, 'e'); R.rect(x, top, 1, h, 'e')
    lights(R, rnd, x + 1, top + 2, w - 2, h - 3)
    if rnd.random() < 0.5:
        floor_lines(R, rnd, x, top, w, h)
    crown = rnd.random()
    if crown < 0.35 and w > 9:  # setback
        sw = rnd.randint(max(3, w // 3), w - 4)
        sx = x + rnd.randint(1, w - sw - 1)
        sh = rnd.randint(5, 16)
        R.rect(sx, top - sh, sw, sh, 'b'); R.rect(sx, top - sh, sw, 1, 'e'); R.rect(sx, top - sh, 1, sh, 'e')
        lights(R, rnd, sx + 1, top - sh + 2, sw - 2, sh - 2, style='grid')
        if rnd.random() < 0.6:
            antenna(R, rnd, sx + sw // 2, top - sh, H)
    elif crown < 0.55 and w > 8:  # stepped crown
        cx, cw, cy = x, w, top
        for _ in range(rnd.randint(2, 3)):
            cx += 2; cw -= 4; cy -= 3
            if cw < 3:
                break
            R.rect(cx, cy, cw, 3, 'b'); R.rect(cx, cy, cw, 1, 'e')
        antenna(R, rnd, x + w // 2, cy, H)
    elif crown < 0.75:
        antenna(R, rnd, x + rnd.randint(1, max(1, w - 2)), top, H)


def stem_platform(R, rnd, x, w, H):
    """A wide platform (or two) on a thin stem, lights along the underside."""
    stem_w = rnd.choice([2, 3, 3, 4])
    cap_w = max(stem_w + 6, rnd.randint(10, max(11, w + 8)))
    cap_h = rnd.randint(5, 10)
    stem_h = rnd.randint(int(H * 0.3), int(H * 0.7))
    cx = x + w // 2
    R.rect(cx - stem_w // 2, H - stem_h, stem_w, stem_h, 'b')
    R.rect(cx - stem_w // 2, H - stem_h, 1, stem_h, 'e')
    for i in range(0, stem_h, 6):  # rungs / service lights on the stem
        if rnd.random() < 0.5:
            R.put(cx, H - stem_h + i + 3, ('w', rnd.random()))
    cy = H - stem_h - cap_h
    for i in range(cap_h):
        inset = 2 if i == 0 else 1 if i == 1 or i == cap_h - 1 else 0
        R.rect(cx - cap_w // 2 + inset, cy + i, cap_w - 2 * inset, 1, 'b')
    R.rect(cx - cap_w // 2 + 2, cy, cap_w - 4, 1, 'e')
    score = rnd.random() * 0.6
    for xx in range(cx - cap_w // 2 + 2, cx + cap_w // 2 - 2):
        R.put(xx, cy + cap_h - 1, ('l', score))
    lights(R, rnd, cx - cap_w // 2 + 2, cy + 2, cap_w - 4, cap_h - 3, style='strips')
    if rnd.random() < 0.55:  # a smaller pod on top
        pw, ph = max(4, cap_w // 2), rnd.randint(3, 6)
        R.rect(cx - pw // 2, cy - ph, pw, ph, 'b'); R.rect(cx - pw // 2, cy - ph, pw, 1, 'e')
        antenna(R, rnd, cx, cy - ph, H)


def stilts(R, rnd, x, w, H):
    """A block raised on thin legs with cross-bracing; the sky shows underneath."""
    lift = rnd.randint(8, 22)
    bh = rnd.randint(12, 32)
    top = H - lift - bh
    R.rect(x, top, w, bh, 'b')
    R.rect(x, top, w, 1, 'e'); R.rect(x, top, 1, bh, 'e')
    R.rect(x, top + bh - 1, w, 1, 's')
    legs = [x + 1, x + w - 2] + ([x + w // 2] if w > 14 else [])
    for lx in legs:
        R.rect(lx, H - lift, 1, lift, 'b')
    for i in range(lift):  # X bracing between the outer legs
        a = x + 1 + int((w - 3) * i / max(1, lift))
        R.put(a, H - lift + i, 'd'); R.put(x + w - 2 - (a - x - 1), H - lift + i, 'd')
    lights(R, rnd, x + 1, top + 2, w - 2, bh - 3)
    score = rnd.random() * 0.5
    for xx in range(x + 2, x + w - 2, 2):  # lights under the belly
        R.put(xx, top + bh, ('w', score))
    if rnd.random() < 0.5:
        antenna(R, rnd, x + rnd.randint(2, max(2, w - 3)), top, H)


def cantilever(R, rnd, x, w, H):
    """A narrow tower carrying a wider slab that overhangs both sides."""
    bw = max(4, w // 2)
    bh = rnd.randint(int(H * 0.25), int(H * 0.6))
    tw = w + rnd.randint(4, 10)
    th = rnd.randint(7, 14)
    bx = x + (w - bw) // 2
    R.rect(bx, H - bh, bw, bh, 'b'); R.rect(bx, H - bh, 1, bh, 'e')
    lights(R, rnd, bx + 1, H - bh + 2, bw - 2, bh - 3, style=rnd.choice(['columns', 'grid']))
    tx = x + w // 2 - tw // 2
    ty = H - bh - th
    R.rect(tx, ty, tw, th, 'b'); R.rect(tx, ty, tw, 1, 'e'); R.rect(tx, ty, 1, th, 'e')
    R.rect(tx, ty + th - 1, tw, 1, 's')
    score = rnd.random() * 0.5
    for xx in range(tx + 1, tx + tw - 1):
        R.put(xx, ty + th, ('l', score))  # underside glow
    lights(R, rnd, tx + 1, ty + 2, tw - 2, th - 3, style='strips')
    if rnd.random() < 0.6:
        antenna(R, rnd, tx + rnd.randint(2, tw - 3), ty, H)


def works(R, rnd, x, w, H):
    """Low plant with tanks, a chimney, pipes and maybe a gantry."""
    bh = rnd.randint(8, 20)
    R.rect(x, H - bh, w, bh, 'b'); R.rect(x, H - bh, w, 1, 'e')
    lights(R, rnd, x + 1, H - bh + 2, w - 2, bh - 3, style='clusters')
    xx = x + 1
    while xx < x + w - 5:
        kind = rnd.random()
        if kind < 0.45:  # round tank
            r = rnd.randint(3, 6)
            for dy in range(r * 2):
                half = int((r * r - (dy - r) ** 2) ** 0.5) if dy < r else r
                R.rect(xx + r - half, H - bh - dy - 1, half * 2, 1, 'b')
            R.rect(xx + r - 1, H - bh - r * 2 - 1, 2, 1, 'e')
            R.put(xx + r, H - bh - r, ('w', rnd.random()))
            xx += r * 2 + 1
        elif kind < 0.7:  # chimney
            ch = rnd.randint(10, 26)
            R.rect(xx, H - bh - ch, 2, ch, 'b'); R.rect(xx, H - bh - ch, 1, ch, 'e')
            R.put(xx, H - bh - ch - 1, 'k')
            xx += 4
        else:  # gantry
            gh = rnd.randint(8, 16)
            gw = rnd.randint(5, 9)
            R.rect(xx, H - bh - gh, 1, gh, 'b'); R.rect(xx + gw, H - bh - gh, 1, gh, 'b'); R.rect(xx, H - bh - gh, gw + 1, 1, 'b')
            for i in range(gh):
                R.put(xx + int(gw * i / gh), H - bh - gh + i, 'd')
            xx += gw + 2
    py = H - bh + rnd.randint(2, max(2, bh - 3))  # a pipe along the front
    for p in range(x - 3, x + w + 3):
        R.put(p, py, 'd', keep_lights=True)


def crane(R, rnd, x, H, h):
    top = H - h
    R.rect(x, top, 1, h, 'b')
    for y in range(top, H, 3):
        R.put(x + 1, y, 'd')
    L, C = rnd.randint(14, 26), rnd.randint(5, 8)
    R.rect(x - C, top, L + C, 1, 'b')
    R.rect(x - C, top + 1, 3, 2, 'b')  # counterweight
    hook = rnd.randint(6, 16)
    hx = x + rnd.randint(L // 2, L - 1)
    for y in range(top + 1, top + hook):
        R.put(hx, y, 'd')
    R.put(x, top - 1, 'k')
    R.put(x + L - 1, top, 'k')


def pod(R, rnd, x, w, H):
    """A dark rounded canopy on a stem or legs, like a tree made of buildings, banded with lights."""
    stem_h = rnd.randint(int(H * 0.18), int(H * 0.5))
    stem_w = rnd.randint(2, 5)
    cw = max(12, w + rnd.randint(4, 12))
    ch = rnd.randint(12, 24)
    cx = x + w // 2
    base = H - stem_h
    R.rect(cx - stem_w // 2, base, stem_w, stem_h, 'b')
    if rnd.random() < 0.5:  # two splayed legs
        for i in range(stem_h):
            R.put(cx - stem_w // 2 - 1 - i // 5, base + i, 'b'); R.put(cx + stem_w // 2 + 1 + i // 5, base + i, 'b')
    top = base - ch
    for i in range(ch):
        grow = min(1.0, 0.45 + i * 0.2)
        shrink = 1.0 if i < ch - 3 else 0.9 - (i - (ch - 3)) * 0.12
        half = int(cw / 2 * grow * shrink)
        lump = 1 if (i < 4 and hsh(cx, i, 5) > 0.55) else 0
        R.rect(cx - half - lump, top + i, 2 * half + lump, 1, 'b')
    for i in range(3):  # a lumpy crown
        bx = cx - cw // 3 + rnd.randint(0, max(1, 2 * cw // 3))
        R.rect(bx, top - 2, rnd.randint(3, 6), 2, 'b')
    R.rect(cx - cw // 4, top, cw // 2, 1, 'e')
    occ = rnd.random()
    for yy in range(top + 3, base - 1, rnd.choice([3, 4])):
        score = rnd.random() * 0.8 + (1 - occ) * 0.35
        span = int(cw / 2 * 0.7)
        for xx in range(cx - span + rnd.randint(0, 3), cx + span - rnd.randint(0, 3)):
            if R.get(xx, yy) == 'b':
                R.put(xx, yy, ('l', score))
    if rnd.random() < 0.6:
        antenna(R, rnd, cx + rnd.randint(-cw // 4, cw // 4), top - 2, H)


def wedge(R, rnd, x, w, H):
    """A big monolith with one sloping side."""
    w = max(w, 16)
    h = rnd.randint(int(H * 0.55), int(H * 0.92))
    flip = rnd.random() < 0.5
    top = H - h
    for y in range(top, H):
        t = (y - top) / h
        span = 4 + int((w - 4) * t)
        x0 = x + (w - span if flip else 0)
        R.rect(x0, y, span, 1, 'b')
        R.put(x0 if flip else x0 + span - 1, y, 'e')
    R.rect(x + (w - 4 if flip else 0), top, 4, 1, 'e')
    occ = rnd.random()
    for yy in range(top + 6, H - 2, rnd.choice([4, 5, 6])):
        t = (yy - top) / h
        span = 4 + int((w - 4) * t)
        x0 = x + (w - span if flip else 0)
        score = rnd.random() * 0.8 + (1 - occ) * 0.4
        a, b = (x0 + 2, x0 + min(span - 2, rnd.randint(3, 10))) if not flip else (x0 + span - min(span - 2, rnd.randint(3, 10)), x0 + span - 2)
        for xx in range(a, b):
            R.put(xx, yy, ('l', score))
    for i in range(rnd.randint(1, 3)):
        antenna(R, rnd, x + (w - 3 if flip else 1) + i, top, H)


def spire(R, rnd, x, H, h):
    top = H - h
    R.rect(x, top, 2, h, 'b'); R.rect(x, top, 1, h, 'e')
    for y in range(top + 8, H - 4, rnd.randint(9, 16)):
        R.rect(x - 1, y, 4, 1, 'b')
        R.put(x - 1, y + 1, ('w', rnd.random() * 0.8))
    R.rect(x, top - 8, 1, 8, 'b')
    R.put(x, top - 9, 'k')


def neon_v(R, rnd, x, y, glyphs):
    h = glyphs * 6 + 3
    for yy in range(y, y + h):
        R.put(x, yy, 'nf'); R.put(x + 6, yy, 'nf')
    for xx in range(x, x + 7):
        R.put(xx, y, 'nf'); R.put(xx, y + h - 1, 'nf')
    R.put(x + 3, y - 1, 'nf'); R.put(x + 3, y - 2, 'nf'); R.put(x + 3, y + h, 'nf')
    for i in range(glyphs):
        g = GLYPHS[rnd.randrange(len(GLYPHS))]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == '#':
                    R.put(x + 2 + gx, y + 2 + i * 6 + gy, 'ng')


def neon_box(R, rnd, x, y, glyphs, pole=0):
    w = glyphs * 4 + 3
    for xx in range(x, x + w):
        R.put(xx, y, 'nf'); R.put(xx, y + 8, 'nf')
    for yy in range(y, y + 9):
        R.put(x, yy, 'nf'); R.put(x + w - 1, yy, 'nf')
    for i in range(glyphs):
        g = GLYPHS[rnd.randrange(len(GLYPHS))]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == '#':
                    R.put(x + 2 + i * 4 + gx, y + 2 + gy, 'ng')
    if pole:
        R.rect(x + w // 2, y + 9, 1, pole, 'b')


def rail(R, rnd, y, every=7, posts=0):
    """A thin line across the whole layer with a small light every few pixels, maybe on posts."""
    for x in range(R.W):
        R.put(x, y, 'd', keep_lights=True)
        if x % every == every // 2:
            R.put(x, y - 1, ('l', rnd.random() * 0.9))
    if posts:
        for x in range(rnd.randrange(posts), R.W, posts):
            for yy in range(y + 1, R.H):
                if R.get(x, yy) is not None:
                    break
                R.put(x, yy, 'd')


def deck(R, rnd, y, every=31):
    """An elevated deck right across the layer: a 3 px band with lights underneath, on legs."""
    for x in range(R.W):
        R.put(x, y, 'e'); R.put(x, y + 1, 'b'); R.put(x, y + 2, 's')
        if x % 5 == 2:
            R.put(x, y + 3, ('l', rnd.random() * 0.8))
        if x % 9 == 4:
            R.put(x, y + 1, ('w', rnd.random() * 0.9))
    for x in range(rnd.randrange(every), R.W, every):
        for yy in range(y + 3, R.H):
            if R.get(x, yy) not in (None, 'd') and not isinstance(R.get(x, yy), tuple):
                break
            R.put(x, yy, 'b'); R.put(x + 1, yy, 'b')


def cable(R, rnd, y, span=48, sag=6):
    """Sagging cables between invisible poles, beaded with lights."""
    x = rnd.randrange(span)
    while x < R.W + span:
        for i in range(span):
            t = i / span
            yy = int(y + sag * 4 * t * (1 - t))
            if i % 4 == 0:
                R.put(x + i, yy, ('l', rnd.random() * 0.9), keep_lights=False)
            elif i % 2 == 0:
                R.put(x + i, yy, 'd', keep_lights=True)
        x += span


# ---------------------------------------------------------------- layers
def layer(W, H, seed, kind):
    """kind: 'far' | 'mid' | 'near'. Returns a Roles grid that tiles horizontally."""
    rnd = random.Random(seed)
    R = Roles(W, H)
    cfg = {
        'far': dict(hmin=int(H * 0.4), hmax=int(H * 0.92), wmin=6, wmax=15, types=['block'] * 6 + ['spire'] * 3 + ['stem'] * 2 + ['cant'], gap=(-4, 0)),
        'mid': dict(hmin=int(H * 0.35), hmax=int(H * 0.88), wmin=8, wmax=20, types=['block'] * 4 + ['stem'] * 2 + ['pod'] * 2 + ['wedge'] * 2 + ['stilts'] * 2 + ['cant'] * 2 + ['works'] * 2 + ['crane'], gap=(-6, 0)),
        'near': dict(hmin=int(H * 0.3), hmax=int(H * 0.82), wmin=12, wmax=30, types=['block'] * 3 + ['stilts'] * 3 + ['works'] * 2 + ['cant'] * 2 + ['pod'] * 3 + ['wedge'] + ['crane'], gap=(-7, 1)),
    }[kind]
    x = 0
    tall_next = 0
    while x < W:
        w = rnd.randint(cfg['wmin'], cfg['wmax'])
        t = rnd.choice(cfg['types'])
        h = rnd.randint(cfg['hmin'], cfg['hmax'])
        tall_next += 1
        if tall_next >= 4 and t == 'block':
            h = min(H - 14, h + rnd.randint(14, 30)); tall_next = 0
        if t == 'block':
            block(R, rnd, x, w, h, H)
        elif t == 'stem':
            stem_platform(R, rnd, x, w, H)
        elif t == 'stilts':
            stilts(R, rnd, x, w, H)
        elif t == 'cant':
            cantilever(R, rnd, x, w, H)
        elif t == 'works':
            works(R, rnd, x, w, H)
        elif t == 'pod':
            pod(R, rnd, x, w, H)
        elif t == 'wedge':
            wedge(R, rnd, x, w, H)
        elif t == 'crane':
            crane(R, rnd, x + w // 2, H, rnd.randint(int(H * 0.45), int(H * 0.85)))
            w = max(6, w // 2)
        elif t == 'spire':
            spire(R, rnd, x + w // 2, H, rnd.randint(int(H * 0.55), H - 12))
            w = max(5, w // 2)
        x += w + rnd.randint(*cfg['gap'])
    # long horizontal lines that tie the city together
    if kind == 'far':
        rail(R, rnd, int(H * 0.55), every=9, posts=0)
    elif kind == 'mid':
        deck(R, rnd, int(H * 0.58))
        cable(R, rnd, int(H * 0.36), span=56, sag=7)
    else:
        rail(R, rnd, int(H * 0.7), every=6, posts=29)
        cable(R, rnd, int(H * 0.45), span=44, sag=5)
    # neon signs on the bigger faces
    nsigns = {'far': 1, 'mid': 3, 'near': 4}[kind]
    for _ in range(nsigns * 3):
        if nsigns <= 0:
            break
        sx = rnd.randrange(W)
        col = [y for y in range(H) if R.get(sx, y) is not None]
        if not col:
            continue
        top = col[0]
        if rnd.random() < 0.6:
            g = rnd.randint(2, 4)
            sy = top + rnd.randint(4, 12)
            if sy + g * 6 + 4 < H - 4:
                neon_v(R, rnd, sx, sy, g); nsigns -= 1
        else:
            g = rnd.randint(2, 4)
            sy = top - rnd.randint(12, 20)
            if sy > 4:
                neon_box(R, rnd, sx - 4, sy, g, pole=top - sy - 9); nsigns -= 1
    return R


def side_structure(seed=77, W=72, H=300):
    """Tall dark foreground mass for the left edge: stacked blocks, a platform, pipes and a tall neon sign up top."""
    rnd = random.Random(seed)
    R = Roles(W, H, wrap=False)
    R.rect(0, H - 120, 46, 120, 'b'); R.rect(45, H - 120, 1, 120, 'e')
    lights(R, rnd, 2, H - 116, 40, 110, style='strips', occ=0.7)
    R.rect(0, H - 170, 34, 50, 'b'); R.rect(33, H - 170, 1, 50, 'e'); R.rect(0, H - 170, 34, 1, 'e')
    lights(R, rnd, 2, H - 166, 28, 44, style='grid', occ=0.6)
    for i in range(7):  # cantilevered platform with rounded ends
        inset = 2 if i == 0 else 1 if i in (1, 6) else 0
        R.rect(0, H - 182 + i, 62 - inset, 1, 'b')
    R.rect(0, H - 182, 60, 1, 'e')
    for xx in range(4, 58, 2):
        R.put(xx, H - 176, ('l', 0.15))
    R.rect(6, H - 205, 14, 23, 'b'); R.rect(6, H - 205, 14, 1, 'e')
    lights(R, rnd, 7, H - 203, 12, 20, style='columns', occ=0.6)
    R.rect(12, H - 232, 1, 27, 'b'); R.put(12, H - 233, 'k')
    # the tall sign: a pole off the platform carrying a long column of glyphs, ticks beside it
    R.rect(44, H - 226, 1, 44, 'b'); R.rect(42, H - 190, 5, 1, 'b')
    neon_v(R, rnd, 41, H - 284, 9)
    for (tx, ty) in [(39, H - 270), (39, H - 268), (49, H - 252), (49, H - 250), (38, H - 238)]:
        R.put(tx, ty, 'nf')
    for y in (H - 60, H - 96):  # pipes running out to the right
        for x in range(40, W):
            R.put(x, y, 'd')
        R.rect(W - 4, y - 2, 4, 5, 'b')
    neon_v(R, rnd, 36, H - 160, 4)
    return R


def pyramid(seed=9, W=400, H=176):
    """The far landmark: a colossal hazy pyramid. Lit face on the left, shade on the right, two glowing
    bands across it, a capstone light and a scatter of tiny windows."""
    rnd = random.Random(seed)
    R = Roles(W, H, wrap=False)
    cx = W // 2
    for y in range(H):
        half = int((y + 1) * (W / 2) / H)
        half -= half % 2  # stepped edges, two pixels at a time
        for x in range(cx - half, cx + half):
            R.put(x, y, 'b' if x < cx else 's')
        R.put(cx - half, y, 'e')
    R.rect(cx - 2, 0, 4, 2, 'e')
    for frac, inset in ((0.2, 3), (0.58, 4)):
        y = int(H * frac)
        half = int((y + 1) * (W / 2) / H)
        for x in range(cx - half + inset, cx + half - inset):
            R.put(x, y, ('l', 0.0))
    for _ in range(140):
        y = rnd.randint(14, H - 2)
        half = int((y + 1) * (W / 2) / H) - 3
        if half > 2:
            R.put(cx + rnd.randint(-half, half), y, ('w', rnd.random() * 1.6))
    R.put(cx, 0, 'k'); R.put(cx - 1, 0, 'k')
    return R


def tower(seed=3):
    """The far landmark: a colossal stepped arcology."""
    rnd = random.Random(seed)
    W, H = 84, 236
    R = Roles(W, H, wrap=False)
    tiers = [(84, 44), (70, 40), (58, 36), (46, 32), (36, 28), (26, 22), (16, 16), (8, 10)]
    y = H
    cx = W // 2
    for w, h in tiers:
        x0 = cx - w // 2
        y0 = y - h
        R.rect(x0, y0, w, h, 'b')
        R.rect(x0, y0, 2, h, 'e')
        R.rect(x0 + w - 2, y0, 2, h, 's')
        R.rect(x0 - 1, y0, w + 2, 1, 'e')
        for ly in range(y0 + 4, y - 2, 4):
            for lx in range(x0 + 3, x0 + w - 3, 2):
                R.put(lx, ly, ('w', rnd.random() * 1.1))
        y = y0
    R.rect(cx - 1, y - 18, 2, 18, 'b')
    R.rect(cx - 1, y - 18, 1, 18, 'e')
    R.rect(cx, y - 30, 1, 12, 's')
    R.put(cx, y - 31, 'k')
    return R


# ---------------------------------------------------------------- painting
def painter(phase, depth):
    B = BASE[phase]
    if depth == 'pyramid':
        face, shade_f, rim, glow = PYR[phase]
        win = mix(glow, face, 0.45)
        beacon = B['beacon'] or rim

        def pfn(r, x, y):
            if isinstance(r, tuple):
                if r[0] == 'l':
                    return glow
                return win if r[1] < 0.22 * WIN_LIT[phase] else (face if x < 200 else shade_f)
            return {'b': face, 's': shade_f, 'e': rim, 'k': beacon}.get(r, face)
        return pfn
    k, dim, share = DEPTH[depth]
    body = mix(B['dark'], B['hz'], k)
    edge = mix(body, B['hz'], 0.2 if depth != 'tower' else 0.28)
    detail = mix(body, B['hz'], 0.1)
    shade = mix(body, B['dark'], 0.35)
    lit, lit2, hot = (mix(B[c], B['hz'], dim) for c in ('lit', 'lit2', 'hot'))
    glass = mix(body, '#000000', B['glass']) if B['glass'] else body
    nf, ng = (mix(c, B['hz'], dim * 0.7) for c in B['neon'])
    beacon = mix(B['beacon'], B['hz'], dim * 0.5) if B['beacon'] else edge
    thr = share * WIN_LIT[phase]
    if phase == 'golden':  # the low sun gilds the right-hand edges
        shade = mix(body, '#ffb860', 0.55 - k * 0.4)

    def fn(r, x, y):
        if isinstance(r, tuple):
            kind, v = r
            if v < thr:
                q = hsh(x, y, 3)
                return hot if q > 0.97 else lit2 if q > 0.66 else lit
            return glass if kind == 'w' else body
        return {'b': body, 'e': edge, 'd': detail, 's': shade, 'k': beacon, 'nf': nf, 'ng': ng}[r]
    return fn


def is_lit(r, phase, depth):
    B = BASE[phase]
    thr = DEPTH[depth][2] * WIN_LIT[phase]
    if isinstance(r, tuple):
        return r[1] < thr
    if r in ('nf', 'ng'):
        return phase in ('dawn', 'dusk', 'night')
    return r == 'k' and B['beacon'] is not None


def reflections(R, phase, seed, water_top, ref_cols, H=128):
    """Mirror the near layer into the water: dark broken silhouettes, then smeared lights."""
    rnd = random.Random(seed)
    W = R.W
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    dark = HEX(mix(water_top, BASE[phase]['dark'], 0.55)) + (255,)
    cols = [HEX(c) + (255,) for c in ref_cols]
    for x in range(W):
        top = next((y for y in range(R.H) if R.get(x, y) is not None), None)
        if top is None:
            continue
        h = int((R.H - top) * 0.42)
        for y in range(min(H, h)):
            if y % 4 == 3 and rnd.random() < 0.7:
                continue  # ripples break the reflection
            px[(x + (1 if (y // 4) % 2 else 0)) % W, y] = dark
    for y0 in range(R.H):
        for x in range(W):
            r = R.get(x, y0)
            if r is None or not is_lit(r, phase, 'near'):
                continue
            d = R.H - 1 - y0
            y = int(d * 0.42) + rnd.randint(0, 1)
            if y >= H or rnd.random() < 0.35:
                continue
            fade = y / (R.H * 0.42 + 1)
            lvl = 3 if fade < 0.15 and rnd.random() < 0.4 else 2 if fade < 0.4 else 1 if fade < 0.75 else 0
            L = rnd.randint(1, 3)
            jx = rnd.randint(-1, 1)
            for i in range(L):
                px[(x + jx + i) % W, y] = cols[lvl]
    if phase in ('day', 'golden'):  # sun glitter
        for _ in range(70 if phase == 'day' else 110):
            x, y = rnd.randrange(W), rnd.randint(2, 100)
            c = cols[3] if rnd.random() < 0.3 else cols[2] if rnd.random() < 0.6 else cols[1]
            for i in range(rnd.randint(1, 4)):
                px[(x + i) % W, y] = c
    return img
