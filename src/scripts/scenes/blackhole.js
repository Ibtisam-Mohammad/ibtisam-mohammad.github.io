// Hero art: a gravitationally lensed thin accretion disk (Schwarzschild), drawn as
// ink on paper. Everything on the canvas is computed at runtime from the geodesic
// equation — nothing is traced from a bitmap. Lab version with sliders, HUD, and the
// derivations: prototypes/blackhole.html. Physics summary (geometric units, M = 1):
//
//   geodesics    u'' + u = 3Mu^2 traced backward from the observer; u(phi) depends
//                only on the impact parameter b, so ~460 ODE solves cover the sky.
//   crossings    disk normal n = (0, sin i, cos i); pos . n = 0 gives the closed
//                form phi_k = atan2(-cos i, sin psi sin i) + k*pi.
//   occlusion    the disk is optically thick: first crossing in range wins.
//   speed        beta = sqrt(M/(r-2M)) — Keplerian speed a static observer measures.
//   redshift     g = delta * sqrt(1-2M/r); bolometric intensity scales as g^4.
//   emissivity   Page-Thorne thin disk: F ~ r^-3 (1 - sqrt(6/r)).
//   shadow       apparent radius 3*sqrt(3) M at every inclination; solid ink.
//   photon ring  emerges from log-dense b-sampling above 3*sqrt(3) M, never drawn.
//   cursor       exact point lens theta± = (beta ± sqrt(beta^2 + 4 thetaE^2))/2;
//                dust brightens by mu+, gains counter-images, and grains inside the
//                capture radius spiral in.
//
// Display choices (explicit, not physics): hue encodes the measured redshift factor
// (cobalt approaching, amber receding — the gold rim IS gravitational redshift); ink
// density follows tone-mapped flux (normalise + one GAMMA knob).
//
// Site integration constraints this module honors:
//   - the lens map builds in <=4ms idle slices after load: zero long tasks, no worker
//   - it has its own rAF loop (ambient orbital flow), a sanctioned exception like the
//     idle blink (DESIGN.md log #14): paused off-screen via IntersectionObserver,
//     paused on hidden tabs by rAF itself, absent under reduced motion (static frame)
//   - resize never rebuilds: the lens map lives in model units, scaled at draw time
//   - no-JS: the canvas stays empty; the hero is complete without it

const M = 1, R_IN = 6, R_OUT = 58;
const B_CRIT = 3 * Math.sqrt(3);
const INC = 81 * Math.PI / 180;             // fixed composition; the lab has the slider
const DPHI = 0.012, PHI_MAX = Math.PI * 3.4;
const NPSI = 1050, NR = 74, NPH = 260;
const B_MIN = 1.2, B_MAX = 62;
const LOGSPAN = Math.log(R_OUT / R_IN);
const CELLS = NR * NPH;
const NFLOW = 1200, FLOW_LEN = 8, NDOTS = 2800;
const JUMP = 6;
const SPEED = 14;
const GAMMA = 0.34;
const BAND = [0.14, 0.30, 0.50, 0.72];
const GH = [0.82, 0.97, 1.10];
const HUE_RGB = ['196,126,44', '156,132,102', '116,126,152', '43,89,195'];
const ALPHA = [0.10, 0.145, 0.20, 0.28, 0.42];
const WIDTHS = [0.55, 0.68, 0.82, 0.98, 1.18];
const EMBER = '210,124,40';
const INFALL_T = 0.8;
const CHUNK_MS = 4;                          // build-slice budget: under long-task radar

export function initBlackHole({ animate }) {
  const canvas = document.querySelector('[data-blackhole]');
  const hero = document.getElementById('hero');
  if (!canvas || !hero) return;

  const media = window.matchMedia('(min-width: 1024px)');
  if (!media.matches) {
    // desktop-only art; if the window later grows, boot it once
    media.addEventListener('change', function onGrow(e) {
      if (!e.matches) return;
      media.removeEventListener('change', onGrow);
      boot(canvas, hero, animate);
    });
    return;
  }
  boot(canvas, hero, animate);
}

function boot(canvas, hero, animate) {
  const ctx = canvas.getContext('2d');
  const cache = document.createElement('canvas');
  const cctx = cache.getContext('2d');
  const PAPER = (getComputedStyle(document.documentElement).getPropertyValue('--paper') || '#FAF7F0').trim();

  // ---- persistent buffers: build writes in place, zero allocation after boot ----
  const gux = [new Float32Array(CELLS), new Float32Array(CELLS)];
  const guy = [new Float32Array(CELLS), new Float32Array(CELLS)];
  const gfx = [new Float32Array(CELLS), new Float32Array(CELLS)];
  const gG = [new Float32Array(CELLS), new Float32Array(CELLS)];
  const go = [new Uint8Array(CELLS), new Uint8Array(CELLS)];
  const key = [new Int8Array(CELLS), new Int8Array(CELLS)];
  const MAXRUNS = 26000;
  const runPool = new Int32Array(MAXRUNS * 4);
  let runCount = 0, gMax = 0;

  const NSAMP = Math.ceil(PHI_MAX / DPHI) + 4;
  const rBuf = new Float64Array(NSAMP), duBuf = new Float64Array(NSAMP);
  const psiCos = new Float32Array(NPSI), psiSin = new Float32Array(NPSI);
  for (let p = 0; p < NPSI; p++) {
    psiCos[p] = Math.cos((p / NPSI) * 2 * Math.PI);
    psiSin[p] = Math.sin((p / NPSI) * 2 * Math.PI);
  }
  const rowOm = new Float32Array(NR);
  for (let ri = 0; ri < NR; ri++) {
    rowOm[ri] = SPEED * Math.pow(R_IN * Math.exp(LOGSPAN * (ri + 0.5) / NR), -1.5) / (2 * Math.PI);
  }
  const fRow = new Int32Array(NFLOW), fPh = new Float32Array(NFLOW);
  const dRow = new Int32Array(NDOTS), dPh = new Float32Array(NDOTS);
  const dJx = new Float32Array(NDOTS), dJy = new Float32Array(NDOTS);
  const dCap = new Float32Array(NDOTS), dOx = new Float32Array(NDOTS), dOy = new Float32Array(NDOTS);
  const SEG = new Float32Array(NPH * 2 + 8);
  const LP = [0, 0, 0];

  let W = 0, H = 0, CX = 0, CY = 0, SCALE = 1, DPR = 1;
  let ready = false, cacheValid = false, running = false, inView = false;
  let mx = -1e5, my = -1e5, tx = -1e5, ty = -1e5, influence = 0, cursorIn = false;
  let tE = 0, t = 0, lastTs = 0, raf = 0, lastFalling = 0;

  function rk4Profile(b) {
    let u = 0, du = 1 / b, n = 1;
    const f = (x) => 3 * M * x * x - x;
    rBuf[0] = Infinity; duBuf[0] = du;
    for (let phi = 0; phi < PHI_MAX; phi += DPHI) {
      const k1u = du, k1d = f(u);
      const k2u = du + 0.5 * DPHI * k1d, k2d = f(u + 0.5 * DPHI * k1u);
      const k3u = du + 0.5 * DPHI * k2d, k3d = f(u + 0.5 * DPHI * k2u);
      const k4u = du + DPHI * k3d, k4d = f(u + DPHI * k3u);
      u += DPHI * (k1u + 2 * k2u + 2 * k3u + k4u) / 6;
      du += DPHI * (k1d + 2 * k2d + 2 * k3d + k4d) / 6;
      if (u > 1 / (2 * M + 1e-4) || u < 0) break;
      rBuf[n] = 1 / u; duBuf[n] = du; n++;
      if (du < 0 && u * (R_OUT * 1.15) < 1 && phi > 1) break;
      if (n >= NSAMP - 1) break;
    }
    return n;
  }

  // ---- chunked build: one b-column of the sky per step ------------------------
  const ci = Math.cos(INC), si = Math.sin(INC);
  const e2y = ci, e2z = -si;
  const bArr = [];
  for (let i = 0; i < 50; i++) bArr.push(B_MIN + (B_CRIT - 0.08 - B_MIN) * i / 49);
  for (let i = 0; i < 120; i++) {
    bArr.push(B_CRIT + Math.exp(Math.log(0.006) + (Math.log(8) - Math.log(0.006)) * i / 119));
  }
  for (let i = 0; i < 210; i++) bArr.push(B_CRIT + 8 + (B_MAX - B_CRIT - 8) * i / 209);
  let bIndex = 0;

  function buildStep() {
    const b = bArr[bIndex++];
    const lim = (rk4Profile(b) - 2) * DPHI;
    if (lim <= 0) return;
    for (let pi = 0; pi < NPSI; pi++) {
      const cps = psiCos[pi], sps = psiSin[pi];
      let phi0 = Math.atan2(-ci, sps * si);
      if (phi0 <= 1e-6) phi0 += Math.PI;
      for (let k = 0; k < 4; k++) {
        const phi = phi0 + k * Math.PI;
        if (phi >= lim) break;
        const fi = phi / DPHI, i0 = fi | 0, fr = fi - i0;
        const r = rBuf[i0] + (rBuf[i0 + 1] - rBuf[i0]) * fr;
        if (!(r >= R_IN && r <= R_OUT)) continue;
        const du = duBuf[i0] + (duBuf[i0 + 1] - duBuf[i0]) * fr;
        const sp = Math.sin(phi), cp = Math.cos(phi);
        const dr = -du * r * r;
        let kx = -(dr * sp * cps + r * cp * cps);
        let ky = -(dr * sp * sps + r * cp * sps);
        let kz = -(dr * cp - r * sp);
        const kn = Math.hypot(kx, ky, kz) || 1; kx /= kn; ky /= kn; kz /= kn;
        const pd = Math.atan2(r * (sp * sps * e2y + cp * e2z), r * sp * cps);
        const beta = Math.sqrt(M / (r - 2 * M));
        const gLor = 1 / Math.sqrt(1 - beta * beta);
        const spd = Math.sin(pd), cpd = Math.cos(pd);
        const dop = 1 / (gLor * (1 - (beta * -spd * kx + beta * cpd * e2y * ky + beta * cpd * e2z * kz)));
        const gfac = dop * Math.sqrt(Math.max(0, 1 - 2 * M / r));
        const emis = Math.pow(r, -3) * (1 - Math.sqrt(R_IN / r));
        const flux = gfac * gfac * gfac * gfac * Math.max(0, emis);
        const ri = Math.min(NR - 1, (Math.log(r / R_IN) / LOGSPAN * NR) | 0);
        let ph = pd; if (ph < 0) ph += 2 * Math.PI;
        const cell = ri * NPH + Math.min(NPH - 1, (ph / (2 * Math.PI) * NPH) | 0);
        const s = k === 0 ? 0 : 1;
        if (!go[s][cell]) {
          go[s][cell] = 1;
          gux[s][cell] = b * cps;
          guy[s][cell] = -b * sps;
          gfx[s][cell] = flux;
          gG[s][cell] = gfac;
          if (flux > gMax) gMax = flux;
        }
        break; // optically thick: first material hit occludes the rest
      }
    }
  }

  function buildFinish() {
    // bridge 1-2 cell holes whose shores sit within the caustic threshold — honest
    // reconstruction of a curve that is provably continuous there
    for (let s = 0; s < 2; s++) {
      for (let ri = 0; ri < NR; ri++) {
        const base = ri * NPH;
        for (let p = 1; p < NPH - 1; p++) {
          const idx = base + p;
          if (go[s][idx] || !go[s][idx - 1]) continue;
          const width = go[s][idx + 1] ? 0 : (p + 2 < NPH && go[s][idx + 2] ? 1 : -1);
          if (width < 0) continue;
          const L = idx - 1, R = idx + 1 + width;
          const dx = gux[s][R] - gux[s][L], dy = guy[s][R] - guy[s][L];
          if (dx * dx + dy * dy > JUMP * JUMP) continue;
          for (let q = 0; q <= width; q++) {
            const tq = (q + 1) / (width + 2);
            const j = idx + q;
            gux[s][j] = gux[s][L] + dx * tq;
            guy[s][j] = guy[s][L] + dy * tq;
            gfx[s][j] = gfx[s][L] + (gfx[s][R] - gfx[s][L]) * tq;
            gG[s][j] = gG[s][L] + (gG[s][R] - gG[s][L]) * tq;
            go[s][j] = 1;
          }
          p += width + 1;
        }
      }
    }

    const inv = 1 / (gMax || 1e-12);
    runCount = 0;
    for (let s = 0; s < 2; s++) {
      for (let cell = 0; cell < CELLS; cell++) {
        if (!go[s][cell]) { key[s][cell] = -1; continue; }
        const tone = Math.pow(gfx[s][cell] * inv, GAMMA);
        const fb = tone < BAND[0] ? 0 : tone < BAND[1] ? 1 : tone < BAND[2] ? 2 : tone < BAND[3] ? 3 : 4;
        const g = gG[s][cell];
        const hb = g < GH[0] ? 0 : g < GH[1] ? 1 : g < GH[2] ? 2 : 3;
        key[s][cell] = hb * 5 + fb;
      }
      for (let ri = 0; ri < NR; ri++) {
        const base = ri * NPH;
        let start = -1, cur = -1, px = 0, py = 0;
        for (let p = 0; p <= NPH; p++) {
          const idx = base + p;
          const k = p < NPH ? key[s][idx] : -1;
          if (k >= 0 && start >= 0) {
            const dx = gux[s][idx] - px, dy = guy[s][idx] - py;
            if (dx * dx + dy * dy > JUMP * JUMP) {
              if (p - 1 - start >= 1 && runCount < MAXRUNS) {
                const o = runCount++ * 4;
                runPool[o] = s * NR + ri; runPool[o + 1] = cur; runPool[o + 2] = start; runPool[o + 3] = p - 1;
              }
              start = p;
            }
          }
          if (k !== cur || p === NPH) {
            if (start >= 0 && p - 1 - start >= 1 && runCount < MAXRUNS) {
              const o = runCount++ * 4;
              runPool[o] = s * NR + ri; runPool[o + 1] = cur; runPool[o + 2] = start; runPool[o + 3] = p - 1;
            }
            start = k >= 0 ? p : -1;
            cur = k;
          }
          if (k >= 0) { px = gux[s][idx]; py = guy[s][idx]; }
        }
      }
    }

    let sd = 987654321;
    const rnd = () => ((sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let n = 0; n < NFLOW; n++) {
      fRow[n] = (rnd() < 0.85 ? 0 : NR) + ((rnd() * NR) | 0);
      fPh[n] = rnd();
    }
    const wByFlux = [0.15, 0.3, 0.55, 0.8, 1];
    for (let n = 0; n < NDOTS; n++) {
      dCap[n] = 0;
      for (let tries = 0; tries < 25; tries++) {
        const s = rnd() < 0.85 ? 0 : 1;
        const cell = (rnd() * CELLS) | 0;
        const k2 = key[s][cell];
        if (k2 < 0 || rnd() > wByFlux[k2 % 5]) continue;
        dRow[n] = s * NR + ((cell / NPH) | 0);
        dPh[n] = (cell % NPH) / NPH;
        dJx[n] = (rnd() - 0.5) * 2.2; dJy[n] = (rnd() - 0.5) * 2.2;
        break;
      }
    }
  }

  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 32));
  function pump() {
    const t0 = performance.now();
    while (bIndex < bArr.length && performance.now() - t0 < CHUNK_MS) buildStep();
    if (bIndex < bArr.length) { idle(pump); return; }
    performance.mark('bh-f0');
    buildFinish();
    performance.mark('bh-f1');
    try { performance.measure('bh-finish', 'bh-f0', 'bh-f1'); } catch {}
    ready = true;
    cacheValid = false;
    canvas.classList.add('is-ready');
    if (animate) { wireInput(); maybeRun(); } else frame(performance.now()); // one static frame
  }

  // ---- cursor: exact point lens -------------------------------------------------
  function lensXY(x, y) {
    const dx = x - mx, dy = y - my;
    const d = Math.hypot(dx, dy) || 1e-6;
    const tEi = tE * influence;
    const D = (d + Math.sqrt(d * d + 4 * tEi * tEi)) / 2;
    const sc = D / d;
    LP[0] = mx + dx * sc; LP[1] = my + dy * sc; LP[2] = d;
  }

  function toX(ux) { return CX + ux * SCALE; }
  function toY(uy) { return CY + uy * SCALE; }

  function strokeSmooth(p, n) {
    p.moveTo(SEG[0], SEG[1]);
    if (n === 2) { p.lineTo(SEG[2], SEG[3]); return; }
    for (let i = 1; i < n - 1; i++) {
      const x = SEG[i * 2], y = SEG[i * 2 + 1];
      p.quadraticCurveTo(x, y, (x + SEG[i * 2 + 2]) / 2, (y + SEG[i * 2 + 3]) / 2);
    }
    p.lineTo(SEG[(n - 1) * 2], SEG[(n - 1) * 2 + 1]);
  }

  function drawBase(g, lensOn) {
    const sh = new Path2D();
    for (let a = 0; a <= 140; a++) {
      const th = (a / 140) * 2 * Math.PI;
      let x = toX(B_CRIT * Math.cos(th)), y = toY(B_CRIT * Math.sin(th));
      if (lensOn) { lensXY(x, y); x = LP[0]; y = LP[1]; }
      if (a === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
    }
    sh.closePath();
    g.fillStyle = 'rgba(23,20,16,0.95)';
    g.fill(sh);

    const paths = [];
    const navy = new Path2D(), bloomW = new Path2D(), bloomC = new Path2D();
    for (let r = 0; r < runCount; r++) {
      const o = r * 4;
      const slotRow = runPool[o], k = runPool[o + 1], i0 = runPool[o + 2], i1 = runPool[o + 3];
      const s = slotRow >= NR ? 1 : 0, ri = slotRow - s * NR, base = ri * NPH;
      const p = paths[k] || (paths[k] = new Path2D());
      const hue = (k / 5) | 0, flux = k % 5;
      const wantNavy = k === 19, wantBloomC = k >= 18, wantBloomW = hue <= 1 && flux >= 3;
      let segN = 0, pnx = 0, pny = 0, prd = 0;
      const flush = () => {
        if (segN >= 2) {
          strokeSmooth(p, segN);
          if (wantNavy) strokeSmooth(navy, segN);
          if (wantBloomC) strokeSmooth(bloomC, segN);
          if (wantBloomW) strokeSmooth(bloomW, segN);
        }
        segN = 0;
      };
      for (let i = i0; i <= i1; i++) {
        const idx = base + i;
        let x = toX(gux[s][idx]), y = toY(guy[s][idx]);
        if (lensOn) {
          const rawX = x, rawY = y;
          lensXY(x, y);
          const rd = LP[2], nx = (rawX - mx) / rd, ny = (rawY - my) / rd;
          x = LP[0]; y = LP[1];
          if (segN > 0) {
            const dRaw = Math.hypot(rawX - (mx + pnx * prd), rawY - (my + pny * prd));
            const dMap = Math.hypot(x - SEG[(segN - 1) * 2], y - SEG[(segN - 1) * 2 + 1]);
            if (nx * pnx + ny * pny < 0.2 || dMap > Math.max(60 * DPR, dRaw * 8)) flush();
          }
          pnx = nx; pny = ny; prd = rd;
        }
        SEG[segN * 2] = x; SEG[segN * 2 + 1] = y; segN++;
      }
      flush();
    }

    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = `rgba(${HUE_RGB[0]},0.11)`; g.lineWidth = 3.4 * DPR; g.stroke(bloomW);
    g.strokeStyle = `rgba(${HUE_RGB[3]},0.07)`; g.lineWidth = 3.4 * DPR; g.stroke(bloomC);
    for (let f = 0; f < 5; f++) {
      for (let h = 0; h < 4; h++) {
        const k = h * 5 + f;
        if (!paths[k]) continue;
        g.strokeStyle = `rgba(${HUE_RGB[h]},${ALPHA[f]})`;
        g.lineWidth = WIDTHS[f] * DPR;
        g.stroke(paths[k]);
      }
    }
    g.strokeStyle = 'rgba(26,45,104,0.20)'; g.lineWidth = 0.75 * DPR; g.stroke(navy);
  }

  function drawDyn(g, dt, lensOn, moving) {
    const cool = new Path2D(), warm = new Path2D();
    for (let n = 0; n < NFLOW; n++) {
      const slotRow = fRow[n], s = slotRow >= NR ? 1 : 0, ri = slotRow - s * NR;
      const base = ri * NPH;
      const ph = fPh[n] + (moving ? t * rowOm[ri] : 0);
      const headIdx = base + ((((ph % 1) + 1) % 1) * NPH | 0);
      const path = go[s][headIdx] && gG[s][headIdx] < GH[1] ? warm : cool;
      let segN = 0, pux = 0, puy = 0, pnx = 0, pny = 0, prd = 0;
      const flush = () => { if (segN >= 2) strokeSmooth(path, segN); segN = 0; };
      for (let q = 0; q < FLOW_LEN; q++) {
        const p = (((ph + q / NPH) % 1) * NPH) | 0;
        const idx = base + p;
        if (!go[s][idx]) { flush(); continue; }
        const uxv = gux[s][idx], uyv = guy[s][idx];
        if (segN > 0) {
          const dx = uxv - pux, dy = uyv - puy;
          if (dx * dx + dy * dy > JUMP * JUMP) flush();
        }
        pux = uxv; puy = uyv;
        let x = toX(uxv), y = toY(uyv);
        if (lensOn) {
          const rawX = x, rawY = y;
          lensXY(x, y);
          const rd = LP[2], nx = (rawX - mx) / rd, ny = (rawY - my) / rd;
          x = LP[0]; y = LP[1];
          if (segN > 0 && (nx * pnx + ny * pny < 0.2
            || Math.hypot(x - SEG[(segN - 1) * 2], y - SEG[(segN - 1) * 2 + 1]) > Math.max(60 * DPR, Math.hypot(rawX - (mx + pnx * prd), rawY - (my + pny * prd)) * 8))) flush();
          pnx = nx; pny = ny; prd = rd;
        }
        SEG[segN * 2] = x; SEG[segN * 2 + 1] = y; segN++;
      }
      flush();
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(60,78,120,0.22)'; g.lineWidth = 1.0 * DPR; g.stroke(cool);
    g.strokeStyle = 'rgba(186,128,52,0.30)'; g.lineWidth = 1.3 * DPR; g.stroke(warm);

    const dCool = new Path2D(), dWarm = new Path2D();
    const bCool = new Path2D(), bWarm = new Path2D(), counter = new Path2D();
    const fallA = new Path2D(), fallB = new Path2D(), fallC = new Path2D();
    const sz = Math.max(1, 1.1 * DPR);
    let falling = 0;
    for (let n = 0; n < NDOTS; n++) {
      if (dCap[n] > 0) {
        falling++;
        dCap[n] += dt / INFALL_T;
        if (dCap[n] >= 1) { dCap[n] = 0; continue; }
        const fall = dCap[n] < 0.35 ? fallA : dCap[n] < 0.7 ? fallB : fallC;
        const ang0 = Math.atan2(dOy[n] - my, dOx[n] - mx);
        const r0 = Math.hypot(dOx[n] - mx, dOy[n] - my);
        let started = false;
        for (let q = 0; q < 4; q++) {
          const sfrac = dCap[n] - q * 0.06;
          if (sfrac <= 0) break;
          const rr = r0 * (1 - sfrac);
          const aa = ang0 + 2.4 * Math.min(6, 1 / Math.sqrt(1 - sfrac) - 1) * 2;
          const fx = mx + rr * Math.cos(aa), fy = my + rr * Math.sin(aa);
          if (started) fall.lineTo(fx, fy); else { fall.moveTo(fx, fy); started = true; }
        }
        continue;
      }
      const slotRow = dRow[n], s = slotRow >= NR ? 1 : 0, ri = slotRow - s * NR;
      const ph = dPh[n] + (moving ? t * rowOm[ri] * 0.9 : 0);
      const idx = ri * NPH + ((((ph % 1) + 1) % 1) * NPH | 0);
      if (!go[s][idx]) continue;
      let x = toX(gux[s][idx] + dJx[n]), y = toY(guy[s][idx] + dJy[n]);
      const isWarm = gG[s][idx] < GH[1];
      if (lensOn) {
        lensXY(x, y);
        const d = LP[2], u = d / (tE * influence || 1e-6);
        if (u < 1.7 && influence > 0.3 && Math.random() < 0.03) {
          dCap[n] = 0.001; dOx[n] = LP[0]; dOy[n] = LP[1];
          continue;
        }
        if (u < 3) {
          const A = (u * u + 2) / (u * Math.sqrt(u * u + 4));
          const muP = (A + 1) / 2, muM = (A - 1) / 2;
          if (muM > 0.03) {
            const Dp = Math.hypot(LP[0] - mx, LP[1] - my);
            const Dm = (tE * influence) * (tE * influence) / Dp;
            counter.rect(mx - (LP[0] - mx) / Dp * Dm, my - (LP[1] - my) / Dp * Dm, sz, sz);
          }
          (muP > 1.35 ? (isWarm ? bWarm : bCool) : (isWarm ? dWarm : dCool)).rect(LP[0], LP[1], sz, sz);
          continue;
        }
        x = LP[0]; y = LP[1];
      }
      (isWarm ? dWarm : dCool).rect(x, y, sz, sz);
    }
    g.fillStyle = 'rgba(56,68,100,0.32)'; g.fill(dCool);
    g.fillStyle = 'rgba(176,118,44,0.50)'; g.fill(dWarm);
    g.fillStyle = 'rgba(56,68,100,0.60)'; g.fill(bCool);
    g.fillStyle = 'rgba(176,118,44,0.80)'; g.fill(bWarm);
    g.fillStyle = 'rgba(100,104,124,0.22)'; g.fill(counter);
    if (falling) {
      g.lineWidth = 1.2 * DPR;
      g.strokeStyle = `rgba(${EMBER},${(0.50 * influence).toFixed(3)})`; g.stroke(fallA);
      g.strokeStyle = `rgba(${EMBER},${(0.28 * influence).toFixed(3)})`; g.stroke(fallB);
      g.strokeStyle = `rgba(${EMBER},${(0.13 * influence).toFixed(3)})`; g.stroke(fallC);
    }
    lastFalling = falling;

    if (influence > 0.01) {
      g.setLineDash([3 * DPR, 5 * DPR]);
      g.beginPath(); g.arc(mx, my, tE * influence, 0, 2 * Math.PI);
      g.strokeStyle = `rgba(107,100,89,${(0.16 * influence).toFixed(3)})`;
      g.lineWidth = 1 * DPR; g.stroke();
      g.setLineDash([]);
      const knot = Math.min(1, falling / 45);
      if (knot > 0.02) {
        g.beginPath(); g.arc(mx, my, (4 + 5 * knot) * DPR, 0, 2 * Math.PI);
        g.fillStyle = `rgba(${EMBER},${(0.30 * knot * influence).toFixed(3)})`; g.fill();
      }
      g.beginPath(); g.arc(mx, my, 2.6 * DPR, 0, 2 * Math.PI);
      g.fillStyle = `rgba(23,20,16,${(0.85 * influence).toFixed(3)})`; g.fill();
    }
  }

  // ---- layout, loop, wiring -----------------------------------------------------
  function layout() {
    DPR = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    W = Math.round(r.width * DPR); H = Math.round(r.height * DPR);
    canvas.width = W; canvas.height = H; cache.width = W; cache.height = H;
    // the hole sits right of the canvas centre; outer disk bleeds off both edges and
    // dissolves into the text column through the CSS mask
    CX = W * 0.56; CY = H * 0.47;
    SCALE = Math.min(W / 58, H / 46);
    tE = 30 * Math.sqrt(1) * DPR;
    cacheValid = false;
    if (ready && !running) frame(performance.now());
  }

  function frame(ts) {
    raf = 0;
    if (!ready) return;
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
    lastTs = ts;

    influence += ((cursorIn ? 1 : 0) - influence) * Math.min(1, dt * 7);
    if (mx < -1e4) { mx = tx; my = ty; }
    mx += (tx - mx) * Math.min(1, dt * 12);
    my += (ty - my) * Math.min(1, dt * 12);

    const moving = animate;
    if (moving) t += dt;
    const lensOn = influence > 0.004;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    if (lensOn) {
      drawBase(ctx, true);
    } else {
      if (!cacheValid) {
        cctx.fillStyle = PAPER;
        cctx.fillRect(0, 0, W, H);
        drawBase(cctx, false);
        cacheValid = true;
      }
      ctx.drawImage(cache, 0, 0);
    }
    drawDyn(ctx, dt, lensOn, moving);

    if (running) raf = requestAnimationFrame(frame);
  }

  function maybeRun() {
    const want = ready && animate && inView;
    if (want && !running) {
      running = true;
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
  }

  function wireInput() {
    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      tx = (e.clientX - r.left) * DPR; ty = (e.clientY - r.top) * DPR;
      cursorIn = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { cursorIn = false; }, { passive: true });
  }

  new ResizeObserver(layout).observe(canvas);
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    maybeRun();
  }, { rootMargin: '10% 0%' }).observe(canvas);

  layout();
  performance.mark('bh0');
  if (document.readyState === 'complete') idle(pump);
  else window.addEventListener('load', () => idle(pump), { once: true });
}
