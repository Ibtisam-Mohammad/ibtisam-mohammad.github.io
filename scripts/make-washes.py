"""Wash texture pipeline (plan.md §7).

Generates grayscale-alpha watercolor wash textures as static assets: pigment density
lives in the ALPHA channel (RGB is white), so CSS can tint via mask-image over a solid
accent fill. Simulates the physical signatures of a real wash — irregular deckled
boundary, edge darkening from evaporation deposition, granulation, and backrun blooms —
and ships them as files. No runtime filters, no SVG turbulence, no CSS gradients.

Output: public/textures/*.webp (target <= 60KB each, §13).
Rerun: python scripts/make-washes.py
"""
import numpy as np
from PIL import Image
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "textures"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(20260702)


def noise(shape, base=8, octaves=5, persistence=0.55):
    """Fractal value noise in [0,1] via bicubic-upsampled random grids."""
    h, w = shape
    total = np.zeros(shape, np.float64)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        res_h = max(2, int(base * 2**o))
        res_w = max(2, int(res_h * w / h))
        if res_h >= h or res_w >= w:
            break
        grid = rng.random((res_h, res_w))
        img = Image.fromarray((grid * 255).astype(np.uint8), "L").resize((w, h), Image.BICUBIC)
        total += amp * (np.asarray(img, np.float64) / 255.0)
        norm += amp
        amp *= persistence
    return total / max(norm, 1e-9)


def smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blob_field(shape, centers, warp_amp=0.22, warp_scale=3):
    """Soft union of discs with domain-warped (organic) coordinates."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    yy /= h
    xx /= w
    wx = (noise(shape, base=warp_scale, octaves=3) - 0.5) * warp_amp
    wy = (noise(shape, base=warp_scale, octaves=3) - 0.5) * warp_amp
    xw, yw = xx + wx, yy + wy
    field = np.zeros(shape, np.float64)
    for (cx, cy, r) in centers:
        d = np.sqrt(((xw - cx) * (w / h)) ** 2 + (yw - cy) ** 2)
        field = np.maximum(field, 1.0 - d / r)
    return field


def rim(alpha, strength=0.9, power=1.6):
    """Edge darkening: pigment deposits where the wash dried at its boundary."""
    band = (alpha * (1.0 - alpha)) ** power
    m = band.max()
    return alpha + strength * (band / m if m > 0 else band)


def granulate(density, shape, fine=0.5, coarse=0.35):
    g_fine = noise(shape, base=90, octaves=2, persistence=0.6)
    g_coarse = noise(shape, base=14, octaves=3)
    out = density * (1 - fine / 2 + fine * g_fine)
    out *= (1 - coarse / 2 + coarse * g_coarse)
    return out


def blooms(density, alpha, shape, n, size=(0.06, 0.14)):
    """Backruns: lighter cauliflower spots with a faint darker rim — INSIDE the wash only.
    Everything is gated by the wash alpha so no ring ever floats outside the body."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    yy /= h
    xx /= w
    interior = alpha > 0.55
    if not interior.any():
        return density
    iy, ix = np.nonzero(interior)
    for _ in range(n):
        k = rng.integers(0, len(iy))
        cx, cy = ix[k] / w, iy[k] / h
        r = rng.uniform(*size)
        rag = 1.0 + 0.35 * (noise(shape, base=24, octaves=2) - 0.5)
        d = np.sqrt(((xx - cx) * (w / h)) ** 2 + (yy - cy) ** 2) * rag
        inner = 1.0 - smoothstep(d, r * 0.4, r * 0.95)
        ring = smoothstep(d, r * 0.72, r * 0.9) * (1.0 - smoothstep(d, r * 0.93, r * 1.1))
        gate = smoothstep(alpha, 0.35, 0.6)
        density = density * (1.0 - 0.45 * inner * gate) + 0.28 * ring * gate
    return density


def save(name, alpha, quality=58):
    a = np.clip(alpha, 0.0, 1.0)
    a8 = (a * 255).astype(np.uint8)
    h, w = a8.shape
    rgba = np.dstack([np.full_like(a8, 255)] * 3 + [a8])
    img = Image.fromarray(rgba)
    p = OUT / f"{name}.webp"
    # alpha_quality: lossy alpha — the pigment lives in alpha, lossless alpha triples file size
    img.save(p, "WEBP", quality=quality, alpha_quality=55, method=6, exact=False)
    kb = p.stat().st_size / 1024
    print(f"{name}.webp  {w}x{h}  {kb:.1f} KB")


def field_wash(name, shape=(896, 1280), n_blobs=4, coverage=0.62):
    centers = [(rng.uniform(0.25, 0.75), rng.uniform(0.25, 0.75), rng.uniform(0.30, 0.55)) for _ in range(n_blobs)]
    f = blob_field(shape, centers)
    # narrower band -> harder watercolor boundary, then a strong rim right at it
    alpha = smoothstep(f, 1.0 - coverage, 1.0 - coverage + 0.16)
    d = rim(alpha, strength=1.05, power=1.2)
    d = granulate(d, shape, fine=0.4, coarse=0.32)
    d = blooms(d, alpha, shape, n=3)
    save(name, d * 0.92, quality=50)


def bloom_wash(name, shape=(960, 960)):
    f = blob_field(shape, [(0.5, 0.5, rng.uniform(0.34, 0.42))], warp_amp=0.3, warp_scale=4)
    alpha = smoothstep(f, 0.36, 0.52)
    d = rim(alpha, strength=1.3, power=1.15)
    d = granulate(d, shape, fine=0.36, coarse=0.3)
    d = blooms(d, alpha, shape, n=2, size=(0.09, 0.15))
    save(name, d * 0.95, quality=52)


def drybrush(name, shape=(512, 1280)):
    """Directional pull: long ragged streaks that break up, tapering to the right."""
    h, w = shape
    # per-row stripe field: few rows, strongly stretched horizontally, then broken by gaps
    rows = rng.random((26, 3))
    stripes = np.asarray(Image.fromarray((rows * 255).astype(np.uint8), "L").resize((w, h), Image.BICUBIC)) / 255.0
    gaps = noise(shape, base=5, octaves=4, persistence=0.6)
    tex = stripes * 0.55 + gaps * 0.45
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    yn = yy / h - 0.5
    xn = xx / w
    # pigment runs out along the stroke: threshold rises with x, edges ragged
    thresh = 0.46 + 0.34 * xn + 0.10 * (noise(shape, base=40, octaves=2) - 0.5)
    body = np.clip(1 - (np.abs(yn) * 2.4) ** 2.0, 0, 1)
    d = np.where(tex > thresh, (tex - thresh) * 3.2, 0.0) * body
    d = np.clip(d, 0, 1)
    d = granulate(d, shape, fine=0.35, coarse=0.2)
    save(name, d, quality=55)


def splatter(name, shape=(800, 1200), n=110):
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    d = np.zeros(shape, np.float64)
    for _ in range(n):
        cx = rng.uniform(0.08, 0.92) * w
        cy = (0.5 + rng.normal(0, 0.16)) * h
        r = rng.pareto(2.6) * 3.0 + 1.6
        sx = r * rng.uniform(0.8, 1.3)
        sy = r * rng.uniform(0.8, 1.3)
        spot = np.exp(-(((xx - cx) / sx) ** 2 + ((yy - cy) / sy) ** 2) * 2.2)
        d = np.maximum(d, spot * rng.uniform(0.45, 1.0))
    d = np.where(d > 0.28, d, 0)
    save(name, d * 0.9)


def deckle_band(name, shape=(320, 1280)):
    h, w = shape
    yy = np.mgrid[0:h, 0:w][0].astype(np.float64) / h

    def edge_profile():
        # low-res profile upscaled -> rolling deckled excursions, not waveform jitter
        coarse = noise((48, 150), base=3, octaves=3, persistence=0.55)[0]
        row = Image.fromarray((coarse * 255).astype(np.uint8)[None, :]).resize((w, 1), Image.BICUBIC)
        return np.asarray(row, np.float64)[0] / 255.0

    edge_top = 0.07 + 0.30 * edge_profile()
    edge_bot = 0.93 - 0.30 * edge_profile()
    alpha = smoothstep(yy, edge_top[None, :] - 0.03, edge_top[None, :] + 0.03) * (
        1 - smoothstep(yy, edge_bot[None, :] - 0.03, edge_bot[None, :] + 0.03)
    )
    d = rim(alpha, strength=1.1, power=1.2)
    # horizontal density drift so the band isn't uniform
    drift = 0.75 + 0.5 * noise((64, w), base=3, octaves=3)[0]
    d = d * drift[None, :]
    d = granulate(d, shape, fine=0.3, coarse=0.35)
    save(name, d * 0.85, quality=48)


if __name__ == "__main__":
    field_wash("wash-field-a")
    field_wash("wash-field-b", n_blobs=3, coverage=0.55)
    bloom_wash("wash-bloom-a")
    bloom_wash("wash-bloom-b")
    drybrush("wash-drybrush-a")
    splatter("wash-splatter-a")
    deckle_band("wash-deckle-a")
    print("done ->", OUT)
