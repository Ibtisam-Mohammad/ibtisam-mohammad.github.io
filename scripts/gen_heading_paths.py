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

# deduplicated storage: each unique glyph outline is stored once at the origin;
# headings reference glyphs by index with a per-use x offset. Repeated letters
# (every 'e', 'n', ...) cost one integer instead of a full path string.
glyph_paths: list[str] = []
glyph_index: dict[str, int] = {}


def glyph_ref(ch: str) -> int | None:
    gname = cmap.get(ord(ch))
    if gname is None:
        return None
    if gname in glyph_index:
        return glyph_index[gname]
    pen = SVGPathPen(glyph_set, ntos=lambda v: f"{v:.1f}")
    # glyph units are y-up; SVG is y-down: scale, flip, baseline at ascent, origin x
    tpen = TransformPen(pen, Transform(scale, 0, 0, -scale, 0, ascent * scale))
    glyph_set[gname].draw(tpen)
    d = pen.getCommands()
    if not d:
        return None
    glyph_index[gname] = len(glyph_paths)
    glyph_paths.append(d)
    return glyph_index[gname]


headings_out = {}
for h in HEADINGS:
    x = 0.0
    glyphs = []
    for ch in h["text"]:
        gname = cmap.get(ord(ch))
        ref = glyph_ref(ch)
        if ref is not None:
            glyphs.append([ref, round(x * scale, 1)])
        x += glyph_set[gname].width if gname else 0.5 * upem
    width = x * scale
    height = (ascent - descent) * scale
    headings_out[h["id"]] = {
        "text": h["text"],
        "width": round(width, 1),
        "height": round(height, 1),
        "glyphs": glyphs,
    }
    print(f"{h['id']}: {len(glyphs)} glyphs, {width:.0f}x{height:.0f}")

out = {"paths": glyph_paths, "headings": headings_out}
bad = sum("nan" in p.lower() for p in glyph_paths)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out))
print(f"wrote {OUT}: {len(glyph_paths)} unique glyph outlines, NaN paths: {bad}")
