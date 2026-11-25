"""Pixel muscle map: front and back bodies on a 45 x 80 grid, one letter per pixel, each letter a muscle.
Writes js/body-grid.js. Run: python3 tools/body_art.py  (add --preview PATH to save a coloured PNG).

An aesthetic athletic build (a fit tennis player, not a bodybuilder): round capped delts, thick arms, a
moderate chest, a narrow waist with a 6-pack, sweeping quads with a teardrop and diamond calves. The width
is odd so there is a true centre column, and the art is mirror-symmetric (write_js checks it). In the app every muscle gets a
light outline and the seams between muscles are drawn light, like an anatomy chart.

Letters: H head, X skin (hands, knees, feet), P shorts (unused), N neck, T traps, S front/side delts, R rear delts,
C chest, B biceps, I triceps, F forearms, A abs, O obliques/serratus, W lats, U upper back, E lower back,
G glutes, Q quads, M hamstrings, D adductors, L calves. A lowercase letter is the same muscle; it only adds
a seam (ab blocks, sternum, spine, calf heads...).
"""
import math
import os
import sys

W, H = 45, 80
MID = 22          # the centre column
CX = MID + 0.5    # centre line in pixel coordinates


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, ch):
    """Paint a left-half pixel (x <= MID) and its mirror."""
    if 0 <= x <= MID and 0 <= y < H:
        g[y][x] = ch
        g[y][W - 1 - x] = ch


def fill(g, ch, test, y0=0, y1=H):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(MID + 1):
            if test(x + 0.5, y + 0.5):
                put(g, x, y, ch)


def ell(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def seg(x0, y0, x1, y1, w=0.5):
    """Pixels within w of the segment (for seams drawn with lowercase letters)."""
    def t(x, y):
        dx, dy = x1 - x0, y1 - y0
        L = dx * dx + dy * dy
        k = max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / L))
        return math.hypot(x - (x0 + k * dx), y - (y0 + k * dy)) <= w
    return t


centre = lambda x: abs(x - CX) < 0.5  # the single middle column


def seam_centre(g, y0, y1):
    """A one-pixel seam down the middle (sternum, linea alba, spine): the same muscle, lowercased."""
    for y in range(y0, y1):
        if g[y][MID] != '.':
            g[y][MID] = g[y][MID].lower()


# ---- shared shapes (left half; x grows toward the centre at 22.5) ----
# Proportions: shoulders (delt to delt) about 3.8 head-widths, waist about 2, upper arm almost a head wide,
# thighs together wider than the waist.
DELT = ell(12.9, 18.8, 3.5, 4.0)
NECK = lambda x, y: x >= 19.9 and 11.4 <= y < 16.0
TRAP_SLOPE = lambda x, y: 14.0 <= x < 20.2 and 12.8 + (20.2 - x) * 0.40 <= y < 17.0


def interp(pts, t):
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * (t - t0) / (t1 - t0)
    return pts[-1][1]


def side(y):
    """Left edge of the torso: chest at the armpits, tapering to a narrow waist, then the hips flare."""
    if y < 36.4:
        return 15.2 + max(0, y - 23) * 0.09
    return 16.4 - (y - 36.4) * 0.5


def arm(x, y):
    return ell(11.2, 26.2, 2.85, 5.4)(x, y) and y >= 21.0


def forearm(x, y):
    if not 32.0 <= y < 41.0:
        return False
    t = (y - 32.0) / 9.0
    return 9.0 - t * 1.0 <= x < 14.0 - t * 2.6


def thigh(x, y):
    if not 41.0 <= y < 58.6:
        return False
    t = (y - 41.0) / 17.6
    outer = interp([(0, 14.4), (0.25, 13.4), (0.5, 13.8), (0.75, 15.0), (1, 16.2)], t)  # the outer sweep
    inner = interp([(0, 22.0), (0.4, 21.9), (0.7, 21.6), (1, 21.2)], t)  # the centre column stays empty
    return outer <= x < inner


def calf(x, y):
    if not 61.0 <= y < 75.2:
        return False
    if y < 63.5 and 16.0 <= x < 21.2:  # just below the knee
        return True
    if ell(18.3, 66.0, 3.0, 4.6)(x, y):  # the diamond
        return True
    t = (y - 66.0) / 9.2
    return y >= 66.0 and 16.8 + t * 1.0 <= x < 21.0 - t * 1.0


def common(g, back):
    fill(g, 'H', ell(CX, 6.0, 4.0, 5.2))
    fill(g, 'N', NECK)
    fill(g, 'I' if back else 'B', arm)
    fill(g, 'X', lambda x, y: 9.0 <= x < 13.8 and 31.2 <= y < 32.0)  # elbow
    fill(g, 'F', forearm)
    fill(g, 'X', ell(9.6, 43.4, 2.0, 2.6))  # hands
    fill(g, 'X', lambda x, y: 16.0 <= x < 21.2 and 58.6 <= y < 61.0)  # knees
    fill(g, 'X', lambda x, y: 16.6 <= x < 21.2 and 75.2 <= y < 79.0)  # feet
    fill(g, 'M' if back else 'Q', thigh)
    fill(g, 'L', calf)


def front():
    g = blank()
    common(g, back=False)
    fill(g, 'T', TRAP_SLOPE)
    torso = lambda x, y: side(y) <= x and 15.6 <= y < 36.4
    pec_bottom = lambda x: 22.8 - max(0, 18.8 - x) * 0.85
    fill(g, 'O', lambda x, y: torso(x, y) and y >= 19.6)  # serratus / obliques down the sides
    fill(g, 'C', lambda x, y: torso(x, y) and y < pec_bottom(x))
    fill(g, 'A', lambda x, y: 18.4 <= x and 22.8 <= y < 36.4)
    fill(g, 'a', lambda x, y: 18.4 <= x and int(y) in (25, 28, 31))  # a 6-pack: three seams
    # below the navel the lower abs narrow to a V at the groin; the hips and upper thighs sit either side
    vline = lambda y: 18.4 + (y - 36.4) * 0.9
    fill(g, 'Q', lambda x, y: side(y) <= x and 36.4 <= y < 41.0)
    fill(g, 'A', lambda x, y: 36.4 <= y < 41.0 and x >= vline(y))
    seam_centre(g, 16, 41)  # sternum + linea alba down to the V
    fill(g, 'S', DELT)
    # adductors: the inner-thigh wedge just below the V, so the V lines run on down the inner thigh
    fill(g, 'D', lambda x, y: thigh(x, y) and x >= 19.2 + (y - 41) * 0.25)
    # the teardrop (vastus medialis) above the knee
    tear = lambda x, y: seg(19.6, 51.0, 18.4, 54.6, 0.45)(x, y) or seg(18.4, 54.6, 19.0, 58.0, 0.45)(x, y)
    fill(g, 'q', lambda x, y: thigh(x, y) and tear(x, y))
    return g


def back():
    g = blank()
    common(g, back=True)
    torso = lambda x, y: side(y) <= x and 15.6 <= y < 37.8
    lat = lambda x, y: torso(x, y) and 21.6 <= y < 36.4 and y >= 21.6 + (x - 15.0) and x < 21.2 - max(0, y - 29) * 0.25
    trap = lambda x, y: TRAP_SLOPE(x, y) or (15.4 <= y < 30.2 and x >= 14.6 + (y - 16.6) * 0.58)
    fill(g, 'U', lambda x, y: torso(x, y) and y < 30.5)  # rhomboids / teres, between traps and lats
    fill(g, 'W', lat)
    fill(g, 'E', lambda x, y: torso(x, y) and y >= 29 and not lat(x, y))  # erectors
    fill(g, 'O', lambda x, y: side(y) <= x < 19.4 and 36.4 <= y < 37.8)
    fill(g, 'T', trap)
    fill(g, 'R', DELT)
    # glutes: glute med on the upper outer hip, two round glute max below with the cleft between
    glute_max = ell(19.6, 42.2, 4.3, 4.4)
    fill(g, 'G', lambda x, y: (side(y) <= x and 37.8 <= y < 41.0) or (glute_max(x, y) and 37.8 <= y < 46.0))
    fill(g, 'g', lambda x, y: side(y) <= x < 19.0 and 37.8 <= y < 41.0 and ell(19.6, 42.2, 5.0, 5.1)(x, y) and not glute_max(x, y))
    seam_centre(g, 16, 46)  # spine + cleft
    fill(g, 'm', lambda x, y: thigh(x, y) and y >= 46.5 and seg(19.0, 47.5, 18.8, 56.5, 0.4)(x, y))  # hamstring split
    fill(g, 'l', lambda x, y: calf(x, y) and seg(18.6, 62.0, 18.6, 68.0, 0.4)(x, y))  # two calf heads
    return g


def is_line(at, x, y):
    """Light pixels: the outline, seam letters, and where two different muscles meet. The side test always looks
    toward the centre (and the down test is symmetric), so the left and right halves mirror exactly."""
    ch = at(x, y)
    if ch.islower():
        return True
    if '.' in (at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)):
        return True
    other = lambda n: n != '.' and n.upper() != ch and n.upper() not in 'HXP'
    side = at(x + 1, y) if x <= MID else at(x - 1, y)
    return other(side) or other(at(x, y + 1))


def rows(g):
    return [''.join(r) for r in g]


def write_js(path):
    f, b = rows(front()), rows(back())
    for name, rr in (('front', f), ('back', b)):
        assert all(r == r[::-1] for r in rr), f'{name} is not symmetric'
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
                c = SK if up in 'HX' else SH if up == 'P' else (SK if is_line(at, x, y) else MU)
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
