"""Home-screen icon: an original pixel drawing of a boulder resting in the notch between two hazy
mountain peaks under a pale blue-grey sky (an homage to the idea of Magritte's "The Glass Key",
drawn from scratch - not a copy of the painting).

Called from tools/make_art.py. draw(N) paints an N x N image; sizes are scaled up with NEAREST.
"""
from PIL import Image

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

SKY = [HEX(c) for c in ('#7d95bb', '#879fc3', '#93a9ca', '#9fb3d0', '#abbdd6', '#b6c6dc')]
HAZE = [HEX('#a3b4cc'), HEX('#98aac4')]
LEFT_LIT = [HEX(c) for c in ('#dfe6ee', '#c2cddb', '#adbacc', '#97a6bb')]
LEFT_SH = [HEX(c) for c in ('#a3b1c4', '#8b9ab1', '#76869f', '#63728c')]
RIGHT = [HEX(c) for c in ('#a3ad9c', '#87947f', '#6e7c68', '#566553', '#435140')]
ROCK = [HEX(c) for c in ('#e2e3de', '#c9cbc5', '#adb0a9', '#8e918a', '#6f726c')]


def h(x, y, s=0):
    """Small deterministic hash -> 0..1 for texture."""
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535


def lerp_line(pts, u):
    for (u0, v0), (u1, v1) in zip(pts, pts[1:]):
        if u0 <= u <= u1:
            t = (u - u0) / (u1 - u0) if u1 != u0 else 0
            return v0 + (v1 - v0) * t
    return pts[-1][1] if u > pts[-1][0] else pts[0][1]


LEFT_TOP = [(-0.1, 0.52), (0.0, 0.47), (0.12, 0.38), (0.27, 0.25), (0.33, 0.31), (0.42, 0.40), (0.52, 0.49), (0.66, 0.68), (0.86, 1.05)]
LEFT_PEAK = 0.27
RIGHT_TOP = [(0.36, 1.1), (0.46, 0.80), (0.55, 0.58), (0.64, 0.45), (0.74, 0.33), (0.86, 0.24), (1.0, 0.15), (1.1, 0.12)]
FAR_TOP = [(0.25, 0.70), (0.38, 0.56), (0.47, 0.60), (0.56, 0.52), (0.66, 0.60), (0.8, 0.70)]
BOULDER = (0.47, 0.335, 0.125, 0.16)  # centre u, v, radius u, radius v


def draw(N):
    img = Image.new('RGB', (N, N))
    px = img.load()
    cu, cv, ru, rv = BOULDER
    for y in range(N):
        for x in range(N):
            u, v = (x + 0.5) / N, (y + 0.5) / N
            # sky in soft bands, a 1-px dithered seam between them, lighter toward the haze
            k = v / 0.62 * (len(SKY) - 1)
            i = min(len(SKY) - 1, int(k))
            seam = (k - i) * N / ((len(SKY) - 1) / 0.62) if i < len(SKY) - 1 else 9
            c = SKY[i + 1] if (i < len(SKY) - 1 and (k - i) > 0.82 and (x + y) % 2) else SKY[i]
            if v > lerp_line(FAR_TOP, u) and 0.25 < u < 0.8:
                c = HAZE[0] if h(x, y, 3) > 0.25 else HAZE[1]
            yl = lerp_line(LEFT_TOP, u) + (h(x // 2, 1, 21) - 0.5) * 2.2 / N  # rough rocky edge
            if v > yl:  # left mountain: blue-grey; lit face left of the ridge, shade on the right
                depth = (v - yl) * N
                ridge_u = LEFT_PEAK + (v - 0.25) * 0.22
                if u < ridge_u:
                    streak = h((x + y * 1) // 2, 3, 13)        # snow/rock streaks running down-left
                    j = 1 if streak > 0.45 else 2
                    if streak > 0.85: j = 0
                    if h(x, y, 14) > 0.9: j = 3
                    if depth < 1.2: j = 0
                    c = LEFT_LIT[j]
                else:
                    streak = h((x + y) // 2, 0, 5)
                    j = 1 if streak > 0.5 else 2
                    if streak > 0.88: j = 0
                    if h(x, y, 2) > 0.9: j = 3
                    if depth < 1.2: j = 0
                    c = LEFT_SH[j]
            yr = lerp_line(RIGHT_TOP, u) + (h(x // 2, 2, 22) - 0.5) * 2.0 / N
            if v > yr:  # right mountain: darker green-grey, in front
                depth = (v - yr) * N
                gully = h((x * 2 - y) // 3, 0, 9) * 0.7 + h((x * 3 - y) // 5, 1, 19) * 0.3
                j = 0 if depth < 1.2 else 1 if depth < 3 and h(x, y, 4) > 0.4 else 2
                if gully > 0.62: j = min(4, j + 1)
                if gully > 0.86: j = min(4, j + 2)
                if h(x, y, 6) > 0.93: j = max(0, j - 1)
                c = RIGHT[j]
            # boulder (in front of the left mountain, behind nothing)
            du, dv = (u - cu) / ru, (v - cv) / rv
            dv2 = dv * (0.92 if dv > 0 else 1.0)  # a touch flatter at the bottom
            if du * du + dv2 * dv2 <= 1.0:
                light = -(du * 0.62 + dv * 0.78)  # lit from the upper left
                rim = du * du + dv2 * dv2
                t = 0.5 - light * 0.55 + rim * 0.35
                j = max(0, min(4, int(t * 4.2)))
                if h(x, y, 8) > 0.82: j = min(4, j + 1)
                elif h(x, y, 11) > 0.9: j = max(0, j - 1)
                c = ROCK[j]
            px[x, y] = c
    # contact shadow where the boulder sits
    by = int((cv + rv) * N)
    for x in range(int((cu - ru * 0.5) * N), int((cu + ru * 0.6) * N)):
        if 0 <= by < N:
            r, g, b = px[x, by]
            px[x, by] = (int(r * 0.78), int(g * 0.78), int(b * 0.8))
    return img


def save_key_icons(out):
    import os
    base = draw(64)
    base.resize((192, 192), Image.NEAREST).save(os.path.join(out, 'icon-192.png'))
    base.resize((512, 512), Image.NEAREST).save(os.path.join(out, 'icon-512.png'))
    base.resize((512, 512), Image.NEAREST).save(os.path.join(out, 'maskable-512.png'))  # full bleed; the boulder sits in the safe zone
    draw(60).resize((180, 180), Image.NEAREST).save(os.path.join(out, 'apple-touch-icon.png'))
    draw(32).save(os.path.join(out, 'favicon-32.png'))
