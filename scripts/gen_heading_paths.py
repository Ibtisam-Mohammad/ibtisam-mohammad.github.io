"""Heading letter-outline generator (plan.md §6 drawing law, rule 2) — fontTools edition.

opentype.js emits NaN coordinates for some Bricolage glyphs, so paths are extracted
with fontTools instead: cmap -> glyphSet -> SVGPathPen per glyph, transformed into a
y-down SVG space at font-size 100. Output committed to src/assets/generated/.

Run: python scripts/gen_heading_paths.py
"""
import json
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

ROOT = Path(__file__).resolve().parent.parent
WOFF2 = ROOT / "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2"
OUT = ROOT / "src/assets/generated/headings.json"
SIZE = 100.0

HEADINGS = [
    {"id": "foundations", "text": "Physics & mathematics"},
    {"id": "ml", "text": "AI & machine learning"},
    {"id": "vision", "text": "Computer vision"},
    {"id": "generative-ai", "text": "Generative AI"},
    {"id": "mlops", "text": "MLOps & production"},
    {"id": "work", "text": "Selected case studies"},
    {"id": "notes", "text": "Notes"},
    {"id": "contact", "text": "Contact"},
]

font = TTFont(WOFF2)
cmap = font.getBestCmap()
glyph_set = font.getGlyphSet()
upem = font["head"].unitsPerEm
ascent = font["hhea"].ascent
descent = font["hhea"].descent  # negative
scale = SIZE / upem

out = {}
for h in HEADINGS:
    x = 0.0
    paths = []
    for ch in h["text"]:
        gname = cmap.get(ord(ch))
        if gname is None:
            x += 0.5 * SIZE
            continue
        glyph = glyph_set[gname]
        pen = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.1f}")
        # glyph units are y-up; SVG is y-down: scale, flip, shift baseline to ascent
        tpen = TransformPen(pen, Transform(scale, 0, 0, -scale, x * scale, ascent * scale))
        glyph.draw(tpen)
        d = pen.getCommands()
        if d:
            paths.append(d)
        x += glyph.width
    width = x * scale
    height = (ascent - descent) * scale
    out[h["id"]] = {
        "text": h["text"],
        "width": round(width, 1),
        "height": round(height, 1),
        "paths": paths,
    }
    bad = sum("nan" in p.lower() for p in paths)
    print(f"{h['id']}: {len(paths)} glyph paths, {width:.0f}x{height:.0f}, NaN paths: {bad}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out))
print("wrote", OUT)
