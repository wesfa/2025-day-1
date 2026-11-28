"""Extra animation frames for the City (live sky) scene.

Nothing here changes the scene itself: every image is an overlay drawn from the same role maps and painters as
the art in city_art.py (same seeds), so it lines up pixel for pixel. Run from the repo root:
    python3 tools/city_anim.py

Makes, per time of day (dawn / day / golden / dusk / night):
  ref-c, ref-d          two more water-reflection frames (4-frame shimmer instead of 2)
  near-wa/wb/wc,        windows that switch on or off over time (each overlay toggles on its own slow cycle)
  mid-wa/wb, side-wa/wb
  near-nx, side-nx      a neon sign briefly flickering off
  near-kx, side-kx      antenna beacons blinking off
and once:
  birds-0..3            a 4-step wingbeat (up, level, down, level), each bird at its own point in the beat
  stars-c               a third twinkle layer
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import skyline as sk  # noqa: E402
import city_art as ca  # noqa: E402

HEX = sk.HEX
OUT = os.path.join(os.path.dirname(__file__), '..', 'art', 'city')


def blank(R):
    return Image.new('RGBA', (R.W, R.H), (0, 0, 0, 0))


def window_overlay(R, phase, depth, seed, share=0.07):
    """Some lit windows go dark and some dark ones (that are nearly 'occupied') light up."""
    fn = sk.painter(phase, depth)
    thr = sk.DEPTH[depth][2] * sk.WIN_LIT[phase]
    img = blank(R)
    px = img.load()
    for y in range(R.H):
        for x in range(R.W):
            r = R.get(x, y)
            if not isinstance(r, tuple) or r[0] not in ('w', 'l'):
                continue
            # windows in the same small patch switch together, like one room
            if sk.hsh(x // 3, y // 3, seed) > share:
                continue
            kind, v = r
            if v < thr:
                px[x, y] = HEX(fn((kind, 99.0), x, y)) + (255,)      # light goes off
            elif v < thr + 0.45:
                px[x, y] = HEX(fn((kind, -1.0), x, y)) + (255,)      # light comes on
    return img


def groups(R, roles):
    """Connected groups of pixels with these roles (so one whole sign flickers, not random dots)."""
    seen = set()
    out = []
    for y in range(R.H):
        for x in range(R.W):
            if (x, y) in seen or R.get(x, y) not in roles:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            g = []
            while stack:
                cx, cy = stack.pop()
                g.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if (nx, ny) not in seen and 0 <= nx < R.W and 0 <= ny < R.H and R.get(nx, ny) in roles:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            out.append(g)
    return out


def neon_off(R, phase, depth, pick):
    """The chosen sign(s) drawn as dark, unlit tubes - shown for a split second to make the sign flicker."""
    img = blank(R)
    if phase not in ('dawn', 'dusk', 'night'):
        return img  # signs are off in daylight anyway
    fn = sk.painter(phase, depth)
    px = img.load()
    signs = sorted(groups(R, ('nf', 'ng')), key=len, reverse=True)
    for i in pick:
        if i < len(signs):
            for (x, y) in signs[i]:
                tube = sk.mix(fn('b', x, y), fn('nf', x, y), 0.18)
                px[x, y] = HEX(tube) + (255,)
    return img


def beacons_off(R, phase, depth):
    img = blank(R)
    if sk.BASE[phase]['beacon'] is None:
        return img
    fn = sk.painter(phase, depth)
    px = img.load()
    for y in range(R.H):
        for x in range(R.W):
            if R.get(x, y) == 'k':
                px[x, y] = HEX(fn('e', x, y)) + (255,)
    return img


def birds_frame(k):
    """Frame k of 4; each bird is offset in the beat so the flock doesn't flap in unison."""
    W, H = 200, 70
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = img.load()
    c = HEX('#26303c') + (255,)
    up = [(-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)]
    flat = [(-2, 0), (-1, 0), (0, 1), (1, 0), (2, 0)]
    down = [(-2, 1), (-1, 1), (0, 1), (1, 1), (2, 1)]
    cycle = [up, flat, down, flat]
    flock = [(20, 30, 0), (31, 24, 1), (40, 33, 3), (130, 14, 2), (141, 19, 0)]  # same spots as the old birds
    for (bx, by, off) in flock:
        for dx, dy in cycle[(k + off) % 4]:
            px[bx + dx, by + dy] = c
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    near = sk.layer(320, 150, seed=42, kind='near')
    mid = sk.layer(256, 150, seed=21, kind='mid')
    side = sk.side_structure()
    for p in ca.PHASES:
        sk.reflections(near, p, 3, ca.WATER[p][0], ca.REF[p]).save(os.path.join(OUT, f'ref-c-{p}.png'))
        sk.reflections(near, p, 4, ca.WATER[p][0], ca.REF[p]).save(os.path.join(OUT, f'ref-d-{p}.png'))
        for name, seed in (('wa', 11), ('wb', 12), ('wc', 13)):
            window_overlay(near, p, 'near', seed).save(os.path.join(OUT, f'near-{name}-{p}.png'))
        for name, seed in (('wa', 21), ('wb', 22)):
            window_overlay(mid, p, 'mid', seed).save(os.path.join(OUT, f'mid-{name}-{p}.png'))
            window_overlay(side, p, 'side', seed + 10, share=0.09).save(os.path.join(OUT, f'side-{name}-{p}.png'))
        neon_off(near, p, 'near', (1, 4)).save(os.path.join(OUT, f'near-nx-{p}.png'))
        neon_off(side, p, 'side', (0,)).save(os.path.join(OUT, f'side-nx-{p}.png'))
        beacons_off(near, p, 'near').save(os.path.join(OUT, f'near-kx-{p}.png'))
        beacons_off(side, p, 'side').save(os.path.join(OUT, f'side-kx-{p}.png'))
    for k in range(4):
        birds_frame(k).save(os.path.join(OUT, f'birds-{k}.png'))
    star = [HEX('#c8cde0') + (255,), HEX('#9aa3c0') + (255,), HEX('#ffffff') + (255,)]
    ca.dots_tile(128, 128, 33, 16, star).save(os.path.join(OUT, 'stars-c.png'))


if __name__ == '__main__':
    main()
