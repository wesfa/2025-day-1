"""Home-screen icon: a boulder resting between two hazy peaks under a pale blue-grey sky - an homage to
the idea of Magritte's "The Glass Key", drawn from scratch as a simple 24 x 24 pixel painting (not a copy
of the painting). One character per pixel; edit the rows and re-run tools/make_art.py.

Called from tools/make_art.py.
"""
import os
from PIL import Image

PAL = {
    '1': '#7d9bc6',
    '2': '#93aed3',
    '3': '#aec4e0',
    'h': '#9fb3ce',
    'a': '#dce4ee',
    'b': '#bfcbdb',
    'c': '#97a9c1',
    'd': '#7c8faa',
    'r': '#a3b394',
    's': '#7b8c70',
    't': '#617257',
    'u': '#4c5a44',
    'B': '#eeede6',
    'C': '#d0d0c7',
    'D': '#aeafa6',
    'E': '#87887f',
    'F': '#666760',
}
# 1-3 sky bands, h far haze, a-d left peak (lit -> shade), r-u right slope (ridge -> dark), B-F boulder (light -> dark)
ART = [
    '111111111111111111111111',
    '111111111111111111111111',
    '11111111111111111111111r',
    '11111111111111111111111r',
    '11111111111BBC11111111rt',
    '1111111111BBCCD111111rst',
    '111111a11BBCCCDD11111rts',
    '22222aac2BCCCDDE2222rsts',
    '2222aaaccCCCDDEE222rstss',
    '222abaacdCCDDDEE222rstss',
    '22abaaaacDDDDEEF22rstsss',
    'aabaaaaaccEEEFF22rsstsss',
    'abaaaabaccdd33hh3rstssss',
    'aaaaabaaadccchhhrsstssss',
    'aaaabaaaacdccchrsstssssu',
    'aaabaaaaaccdcccrsstssstu',
    'aabaaaaabaccdcrsstssstut',
    'aaaaaaabaadccrssstssttut',
    'aaaaaabaaacdrssstssttutt',
    'aaaaabaaaaacrssststttutt',
    'aababaaaabarssststttuttt',
    'abaaaaaabarsssstttttuttt',
    'baaaaaabaarssstttttutttt',
    'aaaaaaaaarssssuttttutttt',
]

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def base():
    assert all(len(r) == len(ART[0]) for r in ART) and len(ART) == len(ART[0]), 'icon rows must be square'
    im = Image.new('RGB', (len(ART[0]), len(ART)))
    for y, row in enumerate(ART):
        for x, ch in enumerate(row):
            im.putpixel((x, y), HEX(PAL[ch]))
    return im


def sized(size):
    """Exact-size icon with even pixels: scale up by a whole number, then box-shrink to the size."""
    im = base()
    n = im.width
    k = max(1, -(-size * 2 // n))  # whole-number factor at least 2x the target
    return im.resize((n * k, n * k), Image.NEAREST).resize((size, size), Image.BOX)


def save_key_icons(out):
    im = base()
    im.resize((192, 192), Image.NEAREST).save(os.path.join(out, 'icon-192.png'))  # exactly 8x
    sized(512).save(os.path.join(out, 'icon-512.png'))
    sized(512).save(os.path.join(out, 'maskable-512.png'))  # full bleed; the boulder sits inside the safe zone
    sized(180).save(os.path.join(out, 'apple-touch-icon.png'))
    sized(32).save(os.path.join(out, 'favicon-32.png'))
