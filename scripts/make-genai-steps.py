"""GenAI noise->structure sequence (plan.md §8, sanctioned variant 2).

Renders the four pre-rendered scrub steps for the Generative AI hero visual:
  step 4 (final): abstract layered-ridge composition in the site's violet/rose register
                  — PLACEHOLDER standing in for the owner's real generative output
  step 3: soft forms   (mild blur + light noise)
  step 2: coarse blobs (heavy blur + quantization + mid noise)
  step 1: pure noise   (fine noise + 8% ghost of the final)

No runtime generation — these are static assets scrubbed by scroll.
Rerun: python scripts/make-genai-steps.py
"""
import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "img"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20260705)
W, H = 1280, 800

PAPER = np.array([252, 248, 239], float)
VIOLET = np.array([122, 79, 214], float)
ROSE = np.array([212, 83, 126], float)
COBALT = np.array([43, 89, 195], float)
INK = np.array([38, 34, 25], float)


def noise2d(shape, base=8, octaves=5, persistence=0.55):
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


def row_noise(w, base=3, octaves=4, res=140):
    """1D ridge profile: generated at low horizontal resolution then upscaled,
    so ridgelines roll instead of jittering."""
    coarse = noise2d((64, res), base=base, octaves=octaves)[0]
    img = Image.fromarray((coarse * 255).astype(np.uint8)[None, :]).resize((w, 1), Image.BICUBIC)
    return np.asarray(img, float)[0] / 255.0


def lerp(a, b, t):
    t = np.asarray(t, float)[..., None] if np.ndim(t) == 2 else t
    return a + (b - a) * t


def make_final():
    yy = np.mgrid[0:H, 0:W][0] / H
    # sky: paper warmed toward pale violet-rose
    sky_t = np.clip(yy * 1.6, 0, 1)
    img = lerp(PAPER, lerp(PAPER, (VIOLET * 0.25 + ROSE * 0.2 + PAPER * 0.55), 0.9), sky_t * 0.5)

    # pale rose disc, off-center focal
    xx = np.mgrid[0:H, 0:W][1] / W
    d = np.sqrt(((xx - 0.68) * (W / H)) ** 2 + (yy - 0.30) ** 2)
    disc = np.clip(1 - d / 0.11, 0, 1) ** 0.8
    img = lerp(img, ROSE * 0.55 + PAPER * 0.45, disc * 0.55)

    # layered ridges, back to front: violet -> rose blend, each with a deposition rim
    layers = [
        (0.46, 0.10, VIOLET * 0.35 + PAPER * 0.65, 0.85),
        (0.58, 0.14, VIOLET * 0.55 + ROSE * 0.15 + PAPER * 0.30, 0.9),
        (0.70, 0.16, VIOLET * 0.45 + ROSE * 0.40 + PAPER * 0.15, 0.95),
        (0.84, 0.18, lerp(VIOLET, ROSE, 0.5) * 0.62 + INK * 0.05 + PAPER * 0.33, 1.0),
    ]
    land = np.zeros((H, W))
    for base_y, amp, color, op in layers:
        ridge = base_y + (row_noise(W, base=2, octaves=3) - 0.5) * amp
        mask = 1 / (1 + np.exp(-(yy - ridge[None, :]) * 220))  # soft top edge
        rim = np.clip(1 - np.abs(yy - ridge[None, :]) * 60, 0, 1) * 0.3
        img = lerp(img, color, np.clip(mask * op + rim * mask, 0, 1))
        land = np.maximum(land, mask)

    # granulation: watercolor texture in the land, nearly clean sky
    gran = noise2d((H, W), base=90, octaves=2)
    strength = 0.03 + 0.11 * land
    img *= (1 - strength[..., None] / 2 + strength[..., None] * gran[..., None])
    grain = rng.normal(0, 1.2, (H, W, 1))
    img = np.clip(img + grain, 0, 255)
    return Image.fromarray(img.astype(np.uint8))


def save(img, name, q=74, downscale=None):
    p = OUT / name
    if downscale:
        img = img.resize(downscale, Image.LANCZOS)
    img.save(p, "WEBP", quality=q, method=6)
    print(f"{name}  {p.stat().st_size / 1024:.1f} KB")


final = make_final()
save(final, "gen-step-4.webp", q=76)

# step 3 — soft forms: close to final, softened with light residual noise
s3 = final.filter(ImageFilter.GaussianBlur(5))
a3 = np.asarray(s3, float)
n3 = noise2d((H, W), base=60, octaves=2)[..., None]
a3 = np.clip(a3 * (0.93 + 0.14 * n3) + rng.normal(0, 6, (H, W, 3)), 0, 255)
save(Image.fromarray(a3.astype(np.uint8)), "gen-step-3.webp", q=64)

# step 2 — coarse blobs: must sit clearly between noise and soft forms.
# blur -> quantize -> re-blur (kills crisp band edges) -> heavy mid-noise + fine noise
s2 = final.filter(ImageFilter.GaussianBlur(30))
a2 = np.asarray(s2, float)
a2 = np.round(a2 / 40) * 40
a2 = np.asarray(Image.fromarray(a2.astype(np.uint8)).filter(ImageFilter.GaussianBlur(10)), float)
n2 = noise2d((H, W), base=14, octaves=3)[..., None]
# noise-dominated steps ship at 1024x640: invisible under the crossfade, half the bytes
a2 = a2 * (0.7 + 0.6 * n2) + rng.normal(0, 26, (H, W, 3))
save(Image.fromarray(np.clip(a2, 0, 255).astype(np.uint8)), "gen-step-2.webp", q=42, downscale=(1024, 640))

# step 1 — (almost) pure noise, violet-gray, with an 8% ghost of the final
ghost = np.asarray(final.filter(ImageFilter.GaussianBlur(60)), float)
base_gray = PAPER * 0.35 + VIOLET * 0.12 + INK * 0.35
nz = rng.normal(0, 1, (H // 2, W // 2, 3)) * 34
nz = np.asarray(Image.fromarray(np.clip(base_gray + nz, 0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), float)
a1 = np.clip(nz * 0.92 + ghost * 0.08, 0, 255)
save(Image.fromarray(a1.astype(np.uint8)), "gen-step-1.webp", q=46, downscale=(1024, 640))

print("done ->", OUT)
