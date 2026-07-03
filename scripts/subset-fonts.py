"""Font subsetting pass (plan.md §13: fonts <= 160KB total).

Subsets the shipped woff2 files to the character ranges the site can actually use:
Basic Latin + Latin-1 Supplement + typographic punctuation + the arrow glyph.
Content-safe: any future copy in those ranges renders; kerning is preserved.

Run: python scripts/subset-fonts.py  (overwrites public/fonts/*.woff2 in place)
"""
import io
from pathlib import Path
from fontTools.subset import Subsetter, Options
from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent.parent / "public" / "fonts"

# Basic Latin, Latin-1, en/em dashes, curly quotes, ellipsis, bullet, rightwards arrow
UNICODES = "U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+2192"


def parse_unicodes(spec):
    out = []
    for part in spec.split(","):
        rng = part.replace("U+", "").split("-")
        lo = int(rng[0], 16)
        hi = int(rng[1], 16) if len(rng) > 1 else lo
        out.extend(range(lo, hi + 1))
    return out


codepoints = parse_unicodes(UNICODES)
total_before = total_after = 0
for f in sorted(FONTS.glob("*.woff2")):
    before = f.stat().st_size
    font = TTFont(f)
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]  # keep kerning/ligatures
    opts.name_IDs = ["*"]
    opts.drop_tables += ["DSIG"]
    sub = Subsetter(options=opts)
    sub.populate(unicodes=codepoints)
    sub.subset(font)
    buf = io.BytesIO()
    font.save(buf)
    f.write_bytes(buf.getvalue())
    after = f.stat().st_size
    total_before += before
    total_after += after
    print(f"{f.name}: {before/1024:.1f} -> {after/1024:.1f} KB")

print(f"TOTAL: {total_before/1024:.1f} -> {total_after/1024:.1f} KB")
