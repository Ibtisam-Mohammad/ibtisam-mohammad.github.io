"""OG image: 1200x630, the painted turtle beside the name and positioning on warm
paper. Run with python scripts/make-og.py; fonts are derived from the shipped woff2.
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
CACHE.mkdir(exist_ok=True)

# derive TTFs PIL can rasterize from the shipped woff2
FACES = {
    "display": "bricolage-grotesque-latin-700-normal",
    "serif": "source-serif-4-latin-400-normal",
    "mono": "ibm-plex-mono-latin-400-normal",
}
for key, name in FACES.items():
    src = ROOT / "public" / "fonts" / f"{name}.woff2"
    dst = CACHE / f"{name}.ttf"
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        f = TTFont(src)
        f.flavor = None
        f.save(dst)

PAPER = (252, 248, 239)
INK = (38, 34, 25)
SOFT = (91, 83, 68)
ACCENTS = [(43, 89, 195), (14, 138, 120), (78, 155, 53), (122, 79, 214), (224, 115, 29)]

W, H = 1200, 630
img = Image.new("RGB", (W, H), PAPER)

# soft violet wash behind the turtle (a real texture, tinted)
wash = Image.open(ROOT / "public" / "textures" / "wash-bloom-a.webp").convert("RGBA").resize((560, 560))
alpha = np.asarray(wash, float)[..., 3:4] / 255.0 * 0.30
tint = np.zeros((560, 560, 4), np.uint8)
tint[..., :3] = (122, 79, 214)
tint[..., 3] = (alpha[..., 0] * 255).astype(np.uint8)
img.paste(Image.fromarray(tint), (700, 60), Image.fromarray(tint))

d = ImageDraw.Draw(img)

# ---- the painted turtle, heading right ----
CX, CY, R = 930, 330, 132
SEAMS = [-36, 36, 108, 180, 252, 324]
for i in range(5):
    d.pieslice([CX - R, CY - R, CX + R, CY + R], SEAMS[i], SEAMS[i + 1], fill=ACCENTS[i])
for a in SEAMS[:5]:
    rad = math.radians(a)
    d.line([CX, CY, CX + R * math.cos(rad), CY + R * math.sin(rad)], fill=INK, width=5)
d.ellipse([CX - R, CY - R, CX + R, CY + R], outline=INK, width=9)
# head (the Logo arrowhead), feet, tail
head = [(CX + R + 6, CY - 56), (CX + R + 98, CY), (CX + R + 6, CY + 56)]
d.polygon(head, fill=PAPER, outline=INK)
d.line(head + [head[0]], fill=INK, width=8, joint="curve")
for ang in (45, 135, 225, 315):
    rad = math.radians(ang)
    x1, y1 = CX + (R - 8) * math.cos(rad), CY + (R - 8) * math.sin(rad)
    x2, y2 = CX + (R + 42) * math.cos(rad), CY + (R + 42) * math.sin(rad)
    d.line([x1, y1, x2, y2], fill=INK, width=16)
d.line([CX - R, CY, CX - R - 46, CY], fill=INK, width=14)

# ---- type ----
display = ImageFont.truetype(str(CACHE / f"{FACES['display']}.ttf"), 88)
serif = ImageFont.truetype(str(CACHE / f"{FACES['serif']}.ttf"), 40)
mono = ImageFont.truetype(str(CACHE / f"{FACES['mono']}.ttf"), 26)

d.text((84, 168), "Ibtisam", font=display, fill=INK)
d.text((86, 300), "AI engineer & physicist", font=serif, fill=SOFT)
d.text((86, 352), "building production systems.", font=serif, fill=SOFT)
for i, c in enumerate(ACCENTS):
    d.ellipse([86 + i * 40, 452, 110 + i * 40, 476], fill=c)
d.text((86, 508), "vision · generative AI · agents · MLOps", font=mono, fill=SOFT)

# no grain: flat fills keep the PNG small, and OG thumbnails hide texture anyway
img.save(ROOT / "public" / "og.png", optimize=True)
print("og.png", (ROOT / "public" / "og.png").stat().st_size // 1024, "KB")
