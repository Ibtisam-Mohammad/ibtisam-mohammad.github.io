// Build-time drawing helpers for .astro frontmatter (deterministic, seeded).
// Everything here runs at build only — no runtime cost.

export function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hand-wobbled closed ellipse (contour lines, hulls)
export function wobbleEllipse(cx, cy, rx, ry, rand, { wobble = 0.05, points = 30, rot = 0 } = {}) {
  const pts = [];
  const phase = rand() * Math.PI * 2;
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  for (let i = 0; i < points; i++) {
    const th = (i / points) * Math.PI * 2;
    const w = 1 + wobble * (Math.sin(th * 3 + phase) * 0.6 + (rand() - 0.5));
    const x0 = Math.cos(th) * rx * w, y0 = Math.sin(th) * ry * w;
    pts.push(`${(cx + x0 * cosR - y0 * sinR).toFixed(1)} ${(cy + x0 * sinR + y0 * cosR).toFixed(1)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
}

// hand-wobbled rectangle (bounding boxes, frames)
export function wobbleRect(x, y, w, h, rand, { step = 40, amp = 4 } = {}) {
  const pts = [];
  const j = (v) => (v + (rand() - 0.5) * amp).toFixed(1);
  for (let t = x; t <= x + w; t += step) pts.push(`${j(t)} ${j(y)}`);
  for (let t = y; t <= y + h; t += step) pts.push(`${j(x + w)} ${j(t)}`);
  for (let t = x + w; t >= x; t -= step) pts.push(`${j(t)} ${j(y + h)}`);
  for (let t = y + h; t >= y; t -= step) pts.push(`${j(x)} ${j(t)}`);
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
}

// gaussian-ish scatter around a center (point clouds)
export function scatter(cx, cy, sx, sy, n, rand, rot = 0) {
  const pts = [];
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const gx = (rand() + rand() + rand() - 1.5) * sx;
    const gy = (rand() + rand() + rand() - 1.5) * sy;
    pts.push([cx + gx * cosR - gy * sinR, cy + gx * sinR + gy * cosR]);
  }
  return pts;
}
