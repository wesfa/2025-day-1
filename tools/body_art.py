"""Pixel muscle map: front and back bodies on a 36 x 76 grid, one letter per pixel, each letter a muscle.
Writes js/body-grid.js. Run: python3 tools/body_art.py  (add --preview PATH to save a coloured PNG).

Letters: H head, X skin (hands, knees, feet), P shorts, N neck, T traps, S front/side delts, R rear delts,
C chest, B biceps, I triceps, F forearms, A abs, O obliques, W lats, U upper back, E lower back, G glutes,
Q quads, M hamstrings, D adductors, L calves. A lowercase letter is the same muscle; it only draws a
seam where it meets its uppercase twin (ab blocks, quad heads, the spine...).
"""
import os
import sys

W, H = 36, 76
C = 18  # centre line: left half is x < 18, mirrored onto the right


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, ch):
    """Paint the left-half pixel and its mirror."""
    if 0 <= x < C and 0 <= y < H:
        g[y][x] = ch
        g[y][W - 1 - x] = ch


def fill(g, ch, test, y0=0, y1=H):
    for y in range(y0, y1):
        for x in range(C):
            if test(x + 0.5, y + 0.5):
                put(g, x, y, ch)


def ell(cx, cy, rx, ry):
    return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def common(g, back):
    fill(g, 'H', ell(18, 6.4, 4.3, 5.7))
    fill(g, 'N', lambda x, y: 15.6 <= x and 11.5 <= y < 15)
    # upper arm: biceps in front, triceps behind; a sliver of the other shows at the edge
    fill(g, 'I' if back else 'B', lambda x, y: ell(8.4, 23.2, 2.15, 4.9)(x, y) and y >= 19.5)
    if not back:
        fill(g, 'I', lambda x, y: 6.1 <= x < 6.9 and 21 <= y < 27)
    fill(g, 'X', lambda x, y: 6.5 <= x < 10.1 and 27.6 <= y < 28.6)
    fill(g, 'F', lambda x, y: 5.8 + (y - 28.6) * 0.07 <= x < 10.0 - (y - 28.6) * 0.17 and 28.6 <= y < 36.5)
    fill(g, 'X', ell(6.9, 38.6, 1.8, 2.4))
    # knees and feet
    fill(g, 'X', lambda x, y: 12.9 <= x < 16.6 and 54.5 <= y < 57.5)
    fill(g, 'X', lambda x, y: 12.0 <= x < 16.6 and 70.5 <= y < 74.5 and not (y >= 73.5 and x < 12.6))


def thigh(x, y, y0=39, y1=54.5):
    """Thigh outline: wide at the hip, tapering to the knee, a gap between the legs."""
    t = (y - y0) / (y1 - y0)
    return y0 <= y < y1 and 11.4 + t * 1.6 <= x < 17.3 - t * 0.7


def calf(x, y):
    return ell(14.4, 61.0, 2.3, 4.6)(x, y) or (13.3 + max(0, y - 63) * 0.05 <= x < 16.2 and 57.5 <= y < 70.5)


def front():
    g = blank()
    common(g, back=False)
    fill(g, 'T', lambda x, y: 11.4 <= x < 15.6 and 13.2 + (15.6 - x) * 0.32 <= y < 15.6)
    fill(g, 'S', ell(9.9, 17.4, 3.4, 3.7))
    pec_bottom = lambda x: 21.6 - max(0, 14.6 - x) ** 1.5 * 0.55
    fill(g, 'C', lambda x, y: 12.3 <= x < 18 and 15.2 <= y < pec_bottom(x) and not ell(9.9, 17.4, 3.4, 3.7)(x, y))
    fill(g, 'c', lambda x, y: 17 <= x < 18 and 15.5 <= y < 21.5)  # sternum
    fill(g, 'O', lambda x, y: 12.3 + max(0, y - 24) * 0.12 <= x < 14.8 and pec_bottom(x) <= y < 34)
    fill(g, 'A', lambda x, y: 14.8 <= x < 18 and 21.6 <= y < 34)
    for row in (24.5, 27.5, 30.5):
        fill(g, 'a', lambda x, y, r=row: 14.8 <= x < 18 and r <= y < r + 1)
    fill(g, 'a', lambda x, y: 17 <= x < 18 and 21.6 <= y < 34)
    fill(g, 'P', lambda x, y: 12.0 - (y - 34) * 0.1 <= x < 18 and 34 <= y < 39.5)
    fill(g, 'Q', thigh)
    fill(g, 'D', lambda x, y: thigh(x, y) and x >= 15.6 + (y - 39) * 0.15 and y < 48)
    fill(g, 'q', lambda x, y: thigh(x, y) and abs(x - (12.6 + (y - 39) * 0.11)) < 0.55 and 41 <= y < 53)
    fill(g, 'q', lambda x, y: ell(15.6, 52.2, 1.2, 1.8)(x, y) and x >= 15.6 - 1.2 and (x - 15.6) ** 2 + (y - 52.2) ** 2 > 0.9)
    fill(g, 'L', calf)
    fill(g, 'l', lambda x, y: calf(x, y) and 15.3 <= x < 15.9 and 58 <= y < 68)
    return g


def back():
    g = blank()
    common(g, back=True)
    trap = lambda x, y: (11.4 <= x and 13.2 + (15.6 - x) * 0.32 <= y < 16) or (y >= 15.5 and x >= 11.4 + (y - 15.5) * 0.62 and y < 26)
    fill(g, 'T', trap)
    fill(g, 'R', ell(9.9, 17.4, 3.4, 3.7))
    lat = lambda x, y: 19.5 <= y < 33 and 12.2 + max(0, y - 22) * 0.2 <= x < 16.6 - max(0, y - 27) * 0.1
    fill(g, 'U', lambda x, y: 12.2 <= x < 17 and 17 <= y < 23 and not trap(x, y) and not ell(9.9, 17.4, 3.4, 3.7)(x, y))
    fill(g, 'W', lambda x, y: lat(x, y) and not trap(x, y) and y >= 22.5 - (13.5 - x) * 0.8)
    fill(g, 'E', lambda x, y: 15.4 <= x < 18 and 26 <= y < 35 and not lat(x, y))
    fill(g, 'O', lambda x, y: 12.4 + max(0, y - 31) * 0.2 <= x < 15.4 and 33 <= y < 35)
    fill(g, 'e', lambda x, y: 17 <= x < 18 and 16 <= y < 35)  # spine
    fill(g, 'G', lambda x, y: ell(15.0, 39.4, 3.5, 4.6)(x, y) and 34.5 <= y < 44)
    fill(g, 'g', lambda x, y: 17 <= x < 18 and 35 <= y < 44)
    fill(g, 'M', lambda x, y: thigh(x, y, 43.5) )
    fill(g, 'm', lambda x, y: thigh(x, y, 43.5) and 14.5 <= x < 15.2 and 45 <= y < 54)
    fill(g, 'D', lambda x, y: thigh(x, y, 43.5) and x >= 16.6 and y < 49)
    fill(g, 'L', calf)
    fill(g, 'l', lambda x, y: calf(x, y) and 14.6 <= x < 15.2 and 57.5 <= y < 64)
    return g


def rows(g):
    return [''.join(r) for r in g]


def write_js(path):
    f, b = rows(front()), rows(back())
    js = ['// Generated by tools/body_art.py - pixel muscle map, one letter per pixel (see that file for the key).',
          f'export const BODY_W = {W};', f'export const BODY_H = {H};', 'export const BODY_FRONT = [']
    js += [f"  '{r}'," for r in f] + ['];', 'export const BODY_BACK = ['] + [f"  '{r}'," for r in b] + ['];', '']
    open(path, 'w').write('\n'.join(js))


def preview(path):
    from PIL import Image
    pal = {'H': (190, 160, 140), 'X': (190, 160, 140), 'P': (60, 70, 95), 'N': (200, 120, 120), 'T': (230, 150, 90),
           'S': (240, 190, 80), 'R': (240, 170, 60), 'C': (240, 110, 90), 'B': (110, 170, 240), 'I': (90, 140, 220),
           'F': (120, 200, 200), 'A': (250, 220, 120), 'O': (220, 200, 100), 'W': (150, 120, 230), 'U': (180, 140, 240),
           'E': (200, 160, 220), 'G': (240, 120, 180), 'Q': (120, 220, 120), 'M': (100, 200, 140), 'D': (160, 230, 160),
           'L': (110, 180, 110)}
    S = 6
    img = Image.new('RGB', (W * 2 * S + 3 * S * 2, H * S), (20, 16, 24))
    for k, g in enumerate((front(), back())):
        ox = k * (W * S + 6 * S)
        for y in range(H):
            for x in range(W):
                ch = g[y][x]
                if ch == '.':
                    continue
                c = pal[ch.upper()]
                if ch.islower():
                    c = tuple(int(v * 0.72) for v in c)
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
