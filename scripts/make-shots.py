"""Case-study 'screenshots' (plan.md §10.7) — geometric UI mockups in the site
palette, obviously placeholder yet composed. Each gets the taped-frame reveal.

Rerun: python scripts/make-shots.py
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "img"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20260711)

PAPER = (252, 248, 239)
PAPER_DEEP = (244, 237, 223)
INK = (38, 34, 25)
SOFT = (91, 83, 68)
COBALT = (43, 89, 195)
TEAL = (14, 138, 120)
LEAF = (78, 155, 53)
VIOLET = (122, 79, 214)
EMBER = (224, 115, 29)

W, H = 1200, 750


def mix(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def base():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 64], fill=PAPER_DEEP)                      # app bar
    d.ellipse([24, 24, 40, 40], fill=mix(PAPER_DEEP, INK, 0.5))     # app dot
    for i, w in enumerate((90, 64, 76)):                             # bar tabs
        x = 70 + i * 110
        d.rounded_rectangle([x, 26, x + w, 40], 7, fill=mix(PAPER_DEEP, INK, 0.16))
    return img, d


def bars(d, x, y, w, h, n, color, seed=0.5):
    bw = w / (n * 1.6)
    for i in range(n):
        v = 0.25 + 0.7 * rng.random()
        bx = x + i * (w / n)
        d.rounded_rectangle([bx, y + h * (1 - v), bx + bw, y + h], 5, fill=mix(PAPER, color, 0.75))


def spark(d, x, y, w, h, color, width=5):
    pts = []
    v = 0.55
    for i in range(24):
        v = min(max(v + (rng.random() - 0.5) * 0.24, 0.06), 0.95)
        pts.append((x + i * w / 23, y + h * (1 - v)))
    d.line(pts, fill=color, width=width, joint="curve")


def text_lines(d, x, y, w, n, gap=26, color=None):
    color = color or mix(PAPER, SOFT, 0.5)
    for i in range(n):
        lw = w * (0.6 + 0.4 * rng.random())
        d.rounded_rectangle([x, y + i * gap, x + lw, y + i * gap + 11], 5, fill=color)


def finish(img, name):
    a = np.asarray(img, float) + rng.normal(0, 1.6, (H, W, 1))
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT / name, "WEBP", quality=64, method=6)
    print(name, (OUT / name).stat().st_size // 1024, "KB")


# 1 — detection dashboard (cobalt/teal)
img, d = base()
d.rounded_rectangle([24, 88, 560, 500], 14, fill=PAPER_DEEP, outline=mix(PAPER, INK, 0.15), width=2)
d.rectangle([48, 118, 536, 420], fill=mix(PAPER_DEEP, INK, 0.16))
for (bx, by, bw, bh, c) in ((90, 170, 150, 110, TEAL), (300, 240, 170, 120, TEAL), (210, 150, 90, 70, EMBER)):
    d.rectangle([bx, by, bx + bw, by + bh], outline=mix(PAPER, c, 0.9), width=4)
    d.rectangle([bx, by - 22, bx + 74, by], fill=mix(PAPER, c, 0.9))
d.rounded_rectangle([48, 440, 300, 478], 9, fill=mix(PAPER, COBALT, 0.2))
d.rounded_rectangle([600, 88, 1176, 300], 14, fill=PAPER_DEEP)
bars(d, 630, 120, 500, 140, 9, COBALT)
text_lines(d, 630, 280, 200, 1)
d.rounded_rectangle([600, 324, 1176, 500], 14, fill=PAPER_DEEP)
spark(d, 630, 360, 510, 100, TEAL)
d.rounded_rectangle([24, 524, 1176, 716], 14, fill=PAPER_DEEP)
text_lines(d, 56, 560, 1000, 4, 34)
finish(img, "shot-detection.webp")

# 2 — grounded assistant (violet)
img, d = base()
d.rounded_rectangle([24, 88, 360, 716], 14, fill=PAPER_DEEP)
text_lines(d, 52, 120, 260, 9, 42)
for (y, wdt, mine) in ((110, 520, False), (210, 430, True), (330, 560, False), (470, 380, True), (580, 500, False)):
    x = 1120 - wdt if mine else 400
    c = mix(PAPER, VIOLET, 0.16) if mine else PAPER_DEEP
    d.rounded_rectangle([x, y, x + wdt, y + 84], 16, fill=c, outline=mix(PAPER, INK, 0.12), width=2)
    text_lines(d, x + 24, y + 20, wdt - 60, 2, 24)
    if not mine:
        d.rounded_rectangle([x + 24, y + 56, x + 170, y + 74], 9, fill=mix(PAPER, VIOLET, 0.4))
finish(img, "shot-assistant.webp")

# 3 — pipeline monitor (ember/leaf)
img, d = base()
xs = (60, 300, 540, 780, 1010)
cols = (COBALT, TEAL, LEAF, VIOLET, EMBER)
for x, c in zip(xs, cols):
    d.rounded_rectangle([x, 120, x + 150, 190], 12, fill=mix(PAPER, c, 0.2), outline=mix(PAPER, INK, 0.35), width=3)
    d.ellipse([x + 118, 132, x + 138, 152], fill=mix(PAPER, LEAF, 0.85))
    if x != xs[-1]:
        d.line([x + 150, 155, x + 240, 155], fill=mix(PAPER, INK, 0.4), width=3)
d.rounded_rectangle([24, 230, 1176, 520], 14, fill=PAPER_DEEP)
area = []
v = 0.5
for i in range(40):
    v = min(max(v + (rng.random() - 0.5) * 0.18, 0.1), 0.9)
    area.append((60 + i * 27.5, 480 - 200 * v))
d.polygon(area + [(1160, 490), (60, 490)], fill=mix(PAPER_DEEP, EMBER, 0.25))
d.line(area, fill=mix(PAPER, EMBER, 0.85), width=4, joint="curve")
d.rounded_rectangle([24, 544, 1176, 716], 14, fill=PAPER_DEEP)
for i in range(3):
    y = 570 + i * 46
    d.ellipse([52, y, 68, y + 16], fill=mix(PAPER, LEAF if i else EMBER, 0.8))
    text_lines(d, 92, y + 2, 700, 1)
finish(img, "shot-pipeline.webp")
