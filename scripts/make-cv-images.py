"""Computer-vision section imagery (plan.md §10.4, §8 variant 1).

Stylized placeholder images in the site's illustrated register — an inspection-line
scene for the bounding-box reveal, a striding figure for the pose skeleton, and an
alpha segmentation mask for the scroll-scrubbed tint overlay. All clearly fake,
replaced by the owner's real project imagery later.

Rerun: python scripts/make-cv-images.py
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "img"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20260710)

PAPER = (252, 248, 239)
PAPER_DEEP = (244, 237, 223)
INK = (38, 34, 25)
LEAF = (78, 155, 53)
TEAL = (14, 138, 120)
ROSE = (212, 83, 126)
COBALT = (43, 89, 195)


def noise2d(shape, base=8, octaves=4, persistence=0.55):
    h, w = shape
    total = np.zeros(shape, float)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        rh = max(2, int(base * 2**o))
        rw = max(2, int(rh * w / h))
        if rh >= h or rw >= w:
            break
        grid = rng.random((rh, rw))
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        total += amp * (np.asarray(img, float) / 255.0)
        norm += amp
        amp *= persistence
    return total / max(norm, 1e-9)


def grain(img, sigma=2.0, gran=0.10):
    a = np.asarray(img, float)
    g = noise2d(a.shape[:2], base=80, octaves=2)[..., None]
    a = a * (1 - gran / 2 + gran * g) + rng.normal(0, sigma, a.shape)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def rr(draw, box, r, **kw):
    draw.rounded_rectangle(box, radius=r, **kw)


def mix(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


# ---------------- inspection-line scene (3:2) ----------------
W, H = 1280, 853
img = Image.new("RGB", (W, H), PAPER_DEEP)
d = ImageDraw.Draw(img)

# back wall band + conveyor band
d.rectangle([0, 0, W, 420], fill=mix(PAPER_DEEP, PAPER, 0.5))
d.rectangle([0, 420, W, 560], fill=mix(PAPER_DEEP, INK, 0.10))
d.rectangle([0, 560, W, H], fill=mix(PAPER_DEEP, INK, 0.22))
# belt rollers
for x in range(30, W, 84):
    d.ellipse([x, 540, x + 40, 580], fill=mix(PAPER_DEEP, INK, 0.32))

# parts on the belt: rounded plates with a machined hole
parts = [(150, 430, 300, 170, 0.0), (560, 400, 260, 150, 0.05), (960, 445, 250, 160, -0.04)]
for (px, py, pw, ph, _tilt) in parts:
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    rr(sd, [px + 10, py + 18, px + pw + 10, py + ph + 18], 26, fill=(30, 26, 18, 60))
    img.paste(Image.alpha_composite(img.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(8))).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(img)
    rr(d, [px, py, px + pw, py + ph], 24, fill=mix(PAPER, TEAL, 0.16), outline=mix(INK, PAPER, 0.25), width=3)
    d.ellipse([px + pw * 0.38, py + ph * 0.3, px + pw * 0.62, py + ph * 0.7], fill=mix(PAPER, INK, 0.16), outline=mix(INK, PAPER, 0.35), width=3)
    d.line([px + 24, py + ph - 26, px + pw - 24, py + ph - 26], fill=mix(INK, PAPER, 0.4), width=3)

# the defect: a rose-tinted bloom + scratch on the middle part
dx, dy = 700, 430
d.ellipse([dx - 26, dy - 20, dx + 30, dy + 24], fill=mix(mix(PAPER, TEAL, 0.16), ROSE, 0.55))
d.line([dx - 40, dy + 30, dx + 44, dy - 26], fill=mix(ROSE, INK, 0.45), width=4)
img = img.filter(ImageFilter.GaussianBlur(0.6))

# overhead gantry hint
d = ImageDraw.Draw(img)
d.rectangle([0, 60, W, 92], fill=mix(PAPER_DEEP, INK, 0.16))
for x in range(80, W, 320):
    d.rectangle([x, 92, x + 26, 190], fill=mix(PAPER_DEEP, INK, 0.14))

img = grain(img, sigma=2.4, gran=0.12)
img.save(OUT / "cv-scene.webp", "WEBP", quality=68, method=6)
print("cv-scene.webp", (OUT / "cv-scene.webp").stat().st_size // 1024, "KB")

# segmentation mask: alpha over the three parts + defect (for the leaf tint overlay)
seg = Image.new("L", (W, H), 0)
sd = ImageDraw.Draw(seg)
for (px, py, pw, ph, _t) in parts:
    rr(sd, [px, py, px + pw, py + ph], 24, fill=210)
seg = seg.filter(ImageFilter.GaussianBlur(3))
rgba = np.dstack([np.full((H, W), 255, np.uint8)] * 3 + [np.asarray(seg)])
Image.fromarray(rgba).save(OUT / "cv-seg.webp", "WEBP", quality=60, alpha_quality=50, method=6)
print("cv-seg.webp", (OUT / "cv-seg.webp").stat().st_size // 1024, "KB")

# ---------------- striding figure for the pose skeleton (4:3) ----------------
PW, PH = 1000, 750
p = Image.new("RGB", (PW, PH), mix(PAPER_DEEP, PAPER, 0.4))
pd = ImageDraw.Draw(p)
pd.rectangle([0, 560, PW, PH], fill=mix(PAPER_DEEP, INK, 0.12))  # ground

# soft teal backdrop wash
wash = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
wd = ImageDraw.Draw(wash)
wd.ellipse([120, 80, 880, 620], fill=(*TEAL, 34))
p = Image.alpha_composite(p.convert("RGBA"), wash.filter(ImageFilter.GaussianBlur(60))).convert("RGB")
pd = ImageDraw.Draw(p)

# capsule figure, mid-stride (matches the skeleton joints in Vision.astro)
body = mix(INK, PAPER, 0.18)


def capsule(a, b, w, fill):
    (x1, y1), (x2, y2) = a, b
    pd.line([x1, y1, x2, y2], fill=fill, width=w)
    r = w // 2
    for (cx, cy) in (a, b):
        pd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


HEAD = (505, 148)
NECK = (500, 210)
HIP = (490, 385)
KNEE_F, FOOT_F = (560, 480), (600, 585)
KNEE_B, FOOT_B = (420, 490), (365, 590)
ELB_F, HAND_F = (585, 300), (620, 370)
ELB_B, HAND_B = (415, 295), (385, 360)
pd.ellipse([HEAD[0] - 34, HEAD[1] - 36, HEAD[0] + 34, HEAD[1] + 36], fill=body)
capsule(NECK, HIP, 58, body)
capsule(NECK, ELB_F, 30, body); capsule(ELB_F, HAND_F, 26, body)
capsule(NECK, ELB_B, 30, mix(body, PAPER_DEEP, 0.25)); capsule(ELB_B, HAND_B, 26, mix(body, PAPER_DEEP, 0.25))
capsule(HIP, KNEE_F, 40, body); capsule(KNEE_F, FOOT_F, 34, body)
capsule(HIP, KNEE_B, 40, mix(body, PAPER_DEEP, 0.25)); capsule(KNEE_B, FOOT_B, 34, mix(body, PAPER_DEEP, 0.25))
p = p.filter(ImageFilter.GaussianBlur(1.2))
p = grain(p, sigma=2.2, gran=0.10)
p.save(OUT / "cv-pose.webp", "WEBP", quality=66, method=6)
print("cv-pose.webp", (OUT / "cv-pose.webp").stat().st_size // 1024, "KB")
