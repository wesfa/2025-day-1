"""Pixel muscle map: front and back bodies on a 44 x 80 grid, one letter per pixel, each letter a muscle.
Writes js/body-grid.js. Run: python3 tools/body_art.py  (add --preview PATH to save a coloured PNG).

A muscular build: big capped delts, thick traps and neck, wide pecs, bulging arms, an 8-pack with serratus,
V-taper lats, sweeping quads, diamond calves. In the app every muscle gets a light outline and the seams
between muscles are drawn light too, like an anatomy chart.

Letters: H head, X skin (hands, knees, feet), P shorts, N neck, T traps, S front/side delts, R rear delts,
C chest, B biceps, I triceps, F forearms, A abs, O obliques/serratus, W lats, U upper back, E lower back,
G glutes, Q quads, M hamstrings, D adductors, L calves. A lowercase letter is the same muscle; it only adds
a seam where it meets its uppercase twin (ab blocks, quad heads, spine, calf heads...).
"""
import math
import os
import sys

W, H = 44, 80
C = 22  # centre line: draw the left half (x < 22), mirrored onto the right


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, ch):
    if 0 <= x < C and 0 <= y < H:
        g[y][x] = ch
        # a seam on the centre column (sternum, abs, spine) stays one pixel wide: the mirror gets the plain muscle
        g[y][W - 1 - x] = ch.upper() if (x == C - 1 and ch.islower()) else ch


def fill(g, ch, test, y0=0, y1=H):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(C):
            if test(x + 0.5, y + 0.5):
                put(g, x, y, ch)


def ell(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def line(x0, y0, x1, y1, w=0.6):
    """Pixels within w of the segment (for seams drawn with lowercase letters)."""
    def t(x, y):
        dx, dy = x1 - x0, y1 - y0
        L = dx * dx + dy * dy
        k = max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / L))
        return math.hypot(x - (x0 + k * dx), y - (y0 + k * dy)) <= w
    return t


# ---- shared outline pieces ----
DELT = ell(10.6, 18.6, 4.6, 4.6)
NECK = lambda x, y: 18.4 <= x and 11.0 <= y < 15.5
TRAP_SLOPE = lambda x, y: 11.5 <= x < 19.4 and 12.0 + (19.4 - x) * 0.55 <= y < 17.5


def arm(x, y):
    """Upper arm: a big bulge hanging from the delt."""
    return ell(8.6, 26.0, 3.3, 5.9)(x, y) and y >= 21


def forearm(x, y):
    if not 31.2 <= y < 40.5:
        return False
    t = (y - 31.2) / 9.3
    left = 4.9 + t * 1.6
    right = 11.0 - t * 2.4 - max(0, 0.5 - t) * 0.6
    return left <= x < right


def thigh(x, y, y0=41.0, y1=59.0):
    """Big sweeping thigh: bulges out at the top third, tapers to the knee, gap between the legs."""
    if not y0 <= y < y1:
        return False
    t = (y - y0) / (y1 - y0)
    outer = 13.4 - 1.0 * math.sin(min(1, t * 1.6) * math.pi * 0.9) + t * 2.6
    inner = 21.4 - t * 1.6
    return outer <= x < inner


def calf(x, y):
    """Diamond calf: wide bulge up top, slim to the ankle."""
    if not 61.5 <= y < 75.5:
        return False
    if ell(16.4, 66.5, 3.4, 5.2)(x, y):
        return True
    t = (y - 66.5) / 9.0
    return y >= 66.5 and 15.0 + t * 0.9 <= x < 19.4 - t * 0.9


def common(g, back):
    fill(g, 'H', ell(22, 6.4, 4.2, 5.5))
    fill(g, 'N', NECK)
    fill(g, 'I' if back else 'B', arm)
    fill(g, 'X', lambda x, y: 5.6 <= x < 11.2 and 30.2 <= y < 31.2)  # elbow
    fill(g, 'F', forearm)
    fill(g, 'X', ell(6.8, 42.6, 2.0, 2.7))  # hands
    fill(g, 'X', lambda x, y: 14.8 <= x < 20.6 and 59 <= y < 61.5)  # knees
    fill(g, 'X', lambda x, y: 14.4 <= x < 20.4 and 75.5 <= y < 79.5 and not (y >= 78.5 and x < 15.2))  # feet


def front():
    g = blank()
    common(g, back=False)
    fill(g, 'T', TRAP_SLOPE)
    fill(g, 'S', DELT)
    fill(g, 's', lambda x, y: DELT(x, y) and line(9.6, 15.6, 10.8, 22.6, 0.45)(x, y))  # front / side delt split
    pec_bottom = lambda x: 24.2 - max(0, 15.6 - x) ** 1.4 * 0.5
    pec = lambda x, y: 13.6 <= x < 22 and 15.2 <= y < pec_bottom(x) and not DELT(x, y)
    fill(g, 'C', pec)
    fill(g, 'c', lambda x, y: pec(x, y) and 21 <= x)  # sternum
    # inner arm: the triceps shows on the outside edge
    fill(g, 'I', lambda x, y: arm(x, y) and x < 6.9 and 22 <= y < 30)
    fill(g, 'f', lambda x, y: forearm(x, y) and line(9.6, 31.6, 7.6, 39.5, 0.45)(x, y))
    # torso: serratus + obliques on the sides, an 8-pack in the middle, tapering to the waist
    waist = lambda y: 14.0 + max(0, y - 25) * 0.16
    fill(g, 'O', lambda x, y: waist(y) <= x < 17.6 and pec_bottom(x) <= y < 37 and not pec(x, y))
    for k in range(2):
        fill(g, 'o', lambda x, y, k=k: line(14.6, 24.6 + k * 2.2, 16.6, 23.8 + k * 2.2, 0.4)(x, y) and waist(y) <= x)  # serratus
    fill(g, 'A', lambda x, y: 17.6 <= x < 22 and 23.4 <= y < 37)
    for row in (26.2, 29.2, 32.2):
        fill(g, 'a', lambda x, y, r=row: 17.6 <= x < 22 and r <= y < r + 0.9)
    fill(g, 'a', lambda x, y: 21 <= x < 22 and 23.4 <= y < 37)
    fill(g, 'P', lambda x, y: 14.6 - (y - 37) * 0.25 <= x < 22 and 37 <= y < 41.5)
    fill(g, 'Q', thigh)
    fill(g, 'D', lambda x, y: thigh(x, y) and x >= 19.4 + (y - 41) * 0.05 and y < 50)
    fill(g, 'q', lambda x, y: thigh(x, y) and ell(18.6, 55.0, 2.0, 3.0)(x, y) and not ell(18.6, 55.0, 1.2, 2.2)(x, y) and x < 19.2)  # teardrop
    fill(g, 'L', calf)
    fill(g, 'l', lambda x, y: calf(x, y) and line(17.6, 62.5, 17.4, 72.0, 0.4)(x, y))  # shin
    return g


def back():
    g = blank()
    common(g, back=True)
    # traps: from the neck out over the shoulders and down in a diamond to mid-back
    trap = lambda x, y: TRAP_SLOPE(x, y) or (y >= 16.5 and x >= 12.6 + (y - 16.5) * 0.62 and y < 31)
    fill(g, 'T', trap)
    fill(g, 'R', DELT)
    fill(g, 'r', lambda x, y: DELT(x, y) and line(9.4, 15.8, 11.2, 22.6, 0.45)(x, y))
    lat_outer = lambda y: 12.8 + max(0, y - 23) * 0.32
    lat = lambda x, y: 20.0 <= y < 37 and lat_outer(y) <= x < 21 - max(0, y - 30) * 0.2
    fill(g, 'U', lambda x, y: 13.2 <= x < 21 and 17.5 <= y < 24.5 and not trap(x, y) and not DELT(x, y))
    fill(g, 'u', lambda x, y: line(14.0, 19.0, 18.0, 23.5, 0.45)(x, y) and not trap(x, y) and not DELT(x, y) and 13.2 <= x)
    fill(g, 'W', lambda x, y: lat(x, y) and not trap(x, y) and y >= 24.5 - (15 - x) * 0.9 and not (y < 24.5 and x > 15))
    fill(g, 'E', lambda x, y: 18.6 <= x < 22 and 30 <= y < 38.5 and not trap(x, y) and (x >= 21 - max(0, y - 30) * 0.2 or y >= 37))
    fill(g, 'O', lambda x, y: lat_outer(y) <= x < 18.6 and 37 <= y < 38.5)
    fill(g, 'e', lambda x, y: 21 <= x < 22 and 15 <= y < 38.5)  # spine
    fill(g, 'G', lambda x, y: ell(18.4, 42.6, 4.4, 5.0)(x, y) and 37.8 <= y < 47.5)
    fill(g, 'g', lambda x, y: 21 <= x < 22 and 38.5 <= y < 47.5)
    fill(g, 'M', lambda x, y: thigh(x, y, 46.5))
    fill(g, 'm', lambda x, y: thigh(x, y, 46.5) and line(17.6, 48.5, 17.2, 57.6, 0.45)(x, y))
    fill(g, 'D', lambda x, y: thigh(x, y, 46.5) and x >= 20.2 and y < 52)
    fill(g, 'L', calf)
    fill(g, 'l', lambda x, y: calf(x, y) and line(16.8, 61.8, 16.8, 68.5, 0.4)(x, y))  # two calf heads
    return g


def is_line(at, x, y):
    """Light pixels: the outline, seam letters (lowercase), and where two different muscles meet."""
    ch = at(x, y)
    if ch.islower():
        return True
    if '.' in (at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)):
        return True
    other = lambda n: n != '.' and n.upper() != ch and n.upper() not in 'HXP'
    return other(at(x + 1, y)) or other(at(x, y + 1))


def rows(g):
    return [''.join(r) for r in g]


def write_js(path):
    f, b = rows(front()), rows(back())
    js = ['// Generated by tools/body_art.py - pixel muscle map, one letter per pixel (see that file for the key).',
          f'export const BODY_W = {W};', f'export const BODY_H = {H};', 'export const BODY_FRONT = [']
    js += [f"  '{r}'," for r in f] + ['];', 'export const BODY_BACK = ['] + [f"  '{r}'," for r in b] + ['];', '']
    open(path, 'w').write('\n'.join(js))


def preview(path):
    """Rough colour preview in the app's style: slate-blue muscles, light outline and seams."""
    from PIL import Image
    SK, MU, SH = (213, 217, 228), (62, 74, 120), (44, 50, 72)
    S = 6
    img = Image.new('RGB', (W * 2 * S + 8 * S, H * S), (12, 14, 26))
    for k, g in enumerate((front(), back())):
        ox = k * (W * S + 8 * S)
        at = lambda x, y: g[y][x] if 0 <= x < W and 0 <= y < H else '.'
        for y in range(H):
            for x in range(W):
                ch = at(x, y)
                if ch == '.':
                    continue
                up = ch.upper()
                if up in 'HX':
                    c = SK
                elif up == 'P':
                    c = SH
                else:
                    c = SK if is_line(at, x, y) else MU
                for dy in range(S):
                    for dx in range(S):
                        img.putpixel((ox + x * S + dx, y * S + dy), c)
    img.save(path)


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write_js(os.path.join(root, 'js', 'body-grid.js'))
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1])
    print('body grid written')
