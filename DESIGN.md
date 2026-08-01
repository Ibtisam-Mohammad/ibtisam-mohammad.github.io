# Phase 0 — Design document

**Project:** "Drawn from first principles" — scroll-driven turtle-graphics portfolio.
**Status:** Phase 0 deliverable per plan.md §0/§15. Everything here restates or resolves the brief; nothing overrides a decided item. Unspecified items are resolved in the Decision Log with reasons.

---

## 1. Design tokens

### 1.1 Color

Palette is fixed by §5. Contrast measured (WCAG 2.x relative luminance) on both grounds; text-safe variants derived by darkening at constant hue, as §5 explicitly permits.

| Token | Hex | On `paper` | On `paper-deep` | Usage rule |
|---|---|---|---|---|
| `paper` | `#FCF8EF` | — | — | page ground |
| `paper-deep` | `#F4EDDF` | — | — | cards, bands, ≥92% scrims |
| `ink` | `#262219` | **14.95:1** | 13.60:1 | body text, all turtle strokes (≥7:1 ✓) |
| `ink-soft` | `#5B5344` | **7.16:1** | 6.52:1 | secondary text, captions (≥4.5:1 ✓) |
| `cobalt` | `#2B59C3` | 5.97:1 | 5.43:1 | physics/math — usable as label text as-is |
| `teal` | `#0E8A78` | 4.02:1 ✗ | 3.66:1 ✗ | AI/ML — strokes/fills only |
| `teal-text` | `#0C7768` | 5.14:1 | 4.68:1 | teal for text ≥14px medium |
| `leaf` | `#4E9B35` | 3.27:1 ✗ | 2.97:1 ✗ | CV — strokes/fills only |
| `leaf-text` | `#3D7929` | 5.00:1 | 4.55:1 | leaf for text |
| `violet` | `#7A4FD6` | 5.06:1 | 4.60:1 | GenAI — usable as label text as-is |
| `ember` | `#E0731D` | 2.98:1 ✗ | 2.71:1 ✗ | MLOps — strokes/fills only |
| `ember-text` | `#A55515` | 5.07:1 | 4.61:1 | ember for text |
| `marker` | `#F5C64F` | 1.52:1 | — | under turtle-drawn emphasis strokes ONLY, never text |
| `rose-wash` | `#D4537E` | 3.71:1 | — | GenAI washes ONLY, never text |

Wash opacity tokens: `--wash-lo: 0.12`, `--wash-hi: 0.25` (§7 range); `--wash-near-text: 0.15` max within 80px of text; scrim `--scrim: rgba(252,248,239,0.92)` minimum.

### 1.2 Typography

| Role | Face | Files (self-hosted, subset, `font-display: swap`) |
|---|---|---|
| Display | Bricolage Grotesque | 500, 700 |
| Body | Source Serif 4 | 400, 400-italic, 600 (two weights; italic is the essay voice) |
| Utility | IBM Plex Mono | 400, 500 |
| Math | KaTeX (build-time) | KaTeX Main/Math-Italic/Size1 only, subset |

Fluid scale (16px root; exact clamp coefficients fitted in Phase 1 between 360–1440px viewports):

| Token | Range | Use | Leading |
|---|---|---|---|
| `--step-5` | 44 → 72px | h1 name only | 1.05 |
| `--step-4` | 32 → 46px | h2 section headings (stroke-reveal + hidden real text) | 1.1 |
| `--step-3` | 22 → 26px | h3, card titles | 1.25 |
| `--step-1` | 19 → 22px | lede/thesis line | 1.5 |
| `--step-0` | 17 → 19px | body (§6 fixed) | 1.65 |
| `--step--1` | 12 → 13px | mono labels/chips, letter-spacing 0.06em, sentence case | 1.4 |

Measure: body ≤68ch. Copy style per §6: active voice, plain verbs, buttons say what they do.

### 1.3 Space, grid, breakpoints

- Spacing scale (px): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Section rhythm: 128px desktop (≥96 required by §9), 72px mobile.
- Grid: 12 columns, 24px gaps, max content width 1120px, centered.
- Turtle lanes (≥1200px): `--lane: clamp(88px, (100vw − 1120px)/2, 176px)` each side.
- Breakpoints: 720 (single→multi column), 1024 (full grid), 1200 (lanes guaranteed).
- Mobile <720: single column, turtle in fixed 44px right lane, wash density ~60%.

### 1.4 Motion tokens

- Scroll scrub: all narrative motion is `f(p)` — zero duration, zero timers (§4).
- Micro-easing toward scrub targets: 150ms (pen state), 200ms cap, `cubic-bezier(0.33, 0, 0.2, 1)`.
- Ink-settle (body copy entrance): opacity 0→1 + 4px rise over a short local scroll window.
- Turtle: pen-down scale 1.05 / tilt 6°; pen-up opacity 0.85, dashed trail at 30%.
- Boundary flourish: in-place rotation spanning ~240px of scrollY (interpretation of "≤400ms of scroll distance" at ~800px/s typical velocity; logged below).
- Reduced motion: finished states + opacity fades only. No-JS: finished states in markup; JS rewinds on boot.

### 1.5 Z-layers

`0` paper ground → `10` washes (behind content, `pointer-events: none`) → `20` content & inline SVG scenes → `30` turtle + its live stroke layer → `40` sticky top bar + progress hairline → `50` skip-link (focus).

---

## 2. Layout wireframe

### Desktop ≥1200px (lane · content 1120px · lane) — turtle route marked `●`, pen-up `╌`, crossings only between sections

```
┌────────────────────────────────────────────────────────────────────┐
│ ◆ [OWNER_NAME]                    Work · Notes · Contact  [Résumé] │ sticky 64px
│ ━━━━━━━━━━━━━━━ 1px progress hairline, current-accent tint ━━━━━━━ │
├────────┬──────────────────────────────────────────────────┬────────┤
│  lane  │ 1 HERO (~120vh, SIGNATURE 1)                     │  lane  │
│ ●──╮   │   [OWNER_NAME]  ← h1                             │        │
│    │   │   I build AI systems from first principles.      │        │
│    ╰───┼── axes ⟶ sine ⟶ resolves to underline, ● dot     │        │
│    ╌   │   ML engineer · physics & math background        │        │
│    ╌   │   [View work]  [Résumé ↓]                        │        │
├────●───┼──────────────────────────────────────────────────┼────────┤
│ orbit  │ 2 PHYSICS & MATH — ink only                      │        │
│ ⬡ vec  │   essay ¶s · 4 foundation cards (KaTeX each)     │        │
│ field  │   turtle: underline term, circle var, margin note│ note ← │
│ contour│   gradient-descent path steps into minimum ⟶     │        │
├────────┼──────────────────────────────────────────╌╌──────┼───●────┤
│        │ 3 AI / ML — first teal washes in margins         │ ≈≈≈    │
│        │   narrative · skill chips (3 groups)             │ net    │
│        │   decision boundary · embedding hulls            │ 3-4-2  │
├───●────┼──╌╌──────────────────────────────────────────────┼────────┤
│ ≈leaf≈ │ 4 COMPUTER VISION (SIGNATURE 2)                  │        │
│ bbox   │   ┌person 0.97┐ image reveals inside drawn box   │        │
│ reveal │   2–3 project mini-cards · pose skeleton on img 2│        │
├────────┼───────────────────────────────────────────╌╌─────┼───●────┤
│ ≈≈vio≈ │ 5 GENERATIVE AI (SIGNATURE 3, peak paint 9/10)   │ ≈rose≈ │
│ ≈rose≈ │   noise ⟶ blobs ⟶ forms ⟶ hero image (scrub)     │ ≈≈vio≈ │
│ blooms │   2–3 projects — text on ≥92% paper scrim        │ blooms │
├───●────┼──╌╌──────────────────────────────────────────────┼────────┤
│        │ 6 MLOPS — "color, disciplined"                   │        │
│        │   [data]→[train]→[registry]→[deploy]→[monitor]   │        │
│        │   node fills = collected palette · sparkline     │        │
│        │   stat chips (placeholder p95 · uptime · models) │        │
├────────┼────────────────────────────────────────────╌╌────┼───●────┤
│        │ 7 CASE STUDIES — 30-second skim zone             │ tape   │
│        │   card: Problem → Approach → Result → stack →lnk │ frames │
│        │   (arrows drawn on lead card only)               │        │
├───●────┼─╌╌───────────────────────────────────────────────┼────────┤
│ graph  │ 8 NOTES GARDEN — 7–9 node graph as index         │        │
│ ○─○─○  │   5–8 titles · dates · tags (kbd-operable)       │        │
├────────┼──────────────────────────────────────────────────┼──●─────┤
│        │ 9 CONTACT (SIGNATURE 4) — settled palette        │  │     │
│        │   warm outro · Email GitHub LinkedIn Scholar     │  ╰──●  │
│        │   [Download résumé]   ~signature~   🐢(painted)  │ rests  │
│        │   footer: "this page is a pure function of       │        │
│        │            scroll position."                     │        │
└────────┴──────────────────────────────────────────────────┴────────┘
```

### Mobile <720px

```
┌──────────────────────────────┬───┐
│ ◆ [OWNER]   ☰  [Résumé]      │   │  sticky; Résumé never hidden
├──────────────────────────────┤ t │
│ single column, 20px margins  │ u │  turtle pinned in 44px right
│ h1 44px · body 17px          │ r │  lane; straight path, small
│ washes at 60% density        │ t │  S-curves at boundaries;
│ KEEPS: all 4 signature       │ l │  never overlaps text
│ moments (simplified)         │ e │
│ DROPS: pose skeleton, vector │ ↓ │
│ field patch, embedding hulls │   │
└──────────────────────────────┴───┘
```

Turtle route summary (desktop): enter top-left → L lane (§2) → cross → R lane (§3) → cross → L lane (§4) → cross → R lane (§5) → cross → L lane (§6) → cross → R lane (§7) → cross → L lane (§8) → center (§9). Crossings happen in the 128px inter-section gaps, pen-up, with the ≤240px-scroll rotation flourish at each boundary.

---

## 3. The four signature moments

Local progress `s ∈ [0,1]` per scene; every keyframe is a scroll position, not a time.

**S1 · Hero — first fold resolves within ~120vh**
enter pen-up top-left (0–.10) → pen down: light axes, `ink-soft` 40% (.10–.30) → sine wave draws rightward, amplitude decaying (.30–.60) → resolves into the h1 underline (.60–.75) → plants cobalt dot at origin, 1.15→1.0 settle (.75–.80) → pen-up, exits toward §2 (.80–1). The dot is the site's first color and the promise of the paint arc.

**S2 · CV bounding-box reveal (lead image)**
bbox strokes draw (0–.25) → mono chip `person 0.97` fades (.25–.30) → image wash-reveals inside box via mask (.30–.55) → second box + chip (.55–.70) → segmentation tint scrubs 0→30%→0 (.70–1). Desktop adds pose skeleton on image 2 (dots, then bones). Mobile keeps only this bbox reveal (§10).

**S3 · GenAI noise→structure (hero visual) — peak paint**
turtle scribbles 3 noise strokes at frame edge (0–.20) → 4-step pre-rendered crossfade scrub: noise → coarse blobs → soft forms → final image (.20–.75) → contour frame completes, strokes settle to 20% (.75–.85) → diffusion-trajectory doodle: dots converging along a curve, arrowhead at the mode (.85–1). Violet + rose blooms reveal in both margins throughout. **Enforced visibly here:** every text block sits on a ≥92% `paper` scrim.

**S4 · Contact signature**
turtle arrives fully painted, all five plates lit, pen-up (0–.15) → draws the single-stroke signature (`SIGNATURE_SVG` or generated monoline from `OWNER_NAME`) (.15–.70) → pen-up, settles beside the action row with a final 6°-tilt rest (.70–.85) → footer caption already present (static). The only hand-lettered element on the site (§6.5).

---

## 4. The deliberate aesthetic risk

**The monochrome open.** The first ~200vh (Hero + Physics/Math) are almost colorless — ink on paper with exactly one cobalt dot. Portfolios compete on immediate color; we open with restraint and bet that live drawing + typography carry the fold, so the paint arc has somewhere to go and the GenAI peak means something.

Failure mode: a fast recruiter reads it as unfinished. Mitigations: (a) the hero must be compositionally strong in pure ink — that's the Phase 2 acceptance bar; (b) the Résumé button and "View work" anchor are visible before any scrolling; (c) first teal wash lands by ~28% of document scroll. If testing shows bounce, the §3 wash onset moves earlier — a one-variable tune that doesn't disturb the arc.

---

## 5. Self-critique against §2

| Ban / target | Verdict |
|---|---|
| Generic look 1: cream + high-contrast serif + terracotta | **Shares only the warm paper, which §2 sanctions as deliberate.** Display face is a hand-shaped grotesque, not a contrast serif; accent system is 5-hue scientific, not single-accent; **no terracotta**: `#D97757` and neighbors absent. Guard: `ember` (a hotter, yellower orange) first appears in §6 only, never in the hero/§2, never as large warm fields beside cream — so the first-impression frame can't read as look 1. |
| Generic look 2: near-black + acid green | N/A — light ground, multi-hue. |
| Generic look 3: broadsheet hairline grid | Section joins are turtle-drawn strokes and paint transitions, not hairline rules; generous 128px rhythm, no newspaper columns. The only hairline is the functional scroll-progress indicator. |
| Terminal/cyberpunk/neon/matrix | None. No glow: emphasis = `marker` underlay + ink strokes. |
| Cel-anime effects | Paint register is watercolor granulation from real texture assets (§7); no speed lines, no screentones. |
| Face on turtle | Shell, triangle head, four feet, optional tail. No eyes ever — enforced in the SVG source of truth, §3 of this doc. |
| Scroll hijacking | Native scroll only; rAF reads `scrollY` passively; anchors scroll natively. |
| Text over paint | Scrim token enforced at the component level: any text block whose ancestor band carries paint gets `--scrim` ≥ 0.92 automatically. Checked at peak paint in §5/§16 review. |
| playful but **serious** | No face, sentence case, flourishes only at boundaries (≤240px scroll each). |
| scientific but **warm** | Paper ground, serif essay voice, hand-drawn stroke wobble ≤1.5px amplitude (subtle, not comic). |
| colorful but **not childish** | Washes capped at 25% opacity; hues quoted small before they lead; §6 contains color inside diagram shapes. |
| technically deep but **readable** | Drawing law: turtle draws shapes never paragraphs; KaTeX typeset, annotated not animated. |
| personal but **professional** | One hand-lettered element total (signature). |
| handcrafted but **polished** | Uniform 2px stroke discipline; texture assets curated, not procedural noise. |

## 6. Self-critique against §16 (definition of done → design mechanism)

| §16 item | Mechanism decided now |
|---|---|
| Résumé ≤5s from anywhere | Persistent button in sticky bar at every breakpoint; also in hero and §9. |
| Story plays forward & rewinds; reload restores | Everything is `f(scrollY)` — no timers, no state machines with memory (§4 architecture below). |
| No-JS complete | Finished states are the markup default; JS adds a class, rewinds, and animates on top. |
| Reduced motion | Same finished states; only opacity fades; turtle static & painted at per-section rests. |
| No text over paint w/o scrim | `--scrim` token + component-level enforcement + §5 peak-paint visual check in Phase 4. |
| Exactly 4 signatures; no face; one hand-lettered element | Locked in §3 of this doc; anything else is mid/ambient weight. |
| No banned aesthetics; palette matches §5 | §5 hexes verbatim + 3 sanctioned darkened text variants (documented above). |
| Lighthouse ≥90/95/95; §13 budgets | Budget allocation below; measured in Phase 4 with reported numbers. |
| Cross-browser | Chrome/Firefox/Safari/iOS/Android in Phase 4; scroll-driven CSS is progressive enhancement with rAF fallback everywhere. |
| Placeholders listed in README | §11 protocol: bracketed tokens + `PLACEHOLDER` comments + README table. |

---

## 7. Decision log (unspecified in brief → chosen here)

| # | Decision | Why |
|---|---|---|
| 1 | **Stack: Astro 5, static output** (Node 22 confirmed on this machine) | Brief prefers Astro; component-per-section maps to §10; ships zero JS by default so the hand-written engine is the only JS; note stubs are file-based pages. |
| 2 | Scroll engine: single rAF loop + `Scene{start,end,update(s)}` registry; IntersectionObserver (±1 viewport) toggles the active set; path lengths precomputed at init; writes limited to `transform`/`opacity`/`stroke-dashoffset`; CSS `animation-timeline: scroll()` used where supported as progressive enhancement | Direct restatement of §4 into an implementable shape; ~200 lines. |
| 3 | Boundary flourish = ~240px of scrollY | "≤400ms of scroll distance" converted at ~800px/s typical scroll velocity, rounded down for slow scrollers. |
| 4 | Shell plates = five 72° sectors, clockwise from the head: cobalt → teal → leaf → violet → ember | Reads as both progress dial and palette legend at 30px; fill order = scroll order (§3). |
| 5 | Wash tinting = grayscale-alpha textures used as `mask-image` over a solid accent fill | One asset serves all hues; avoids `filter` color drift; §7 bans procedural — assets are real scans/paint, 10 files: 3 granulated washes, 3 blooms, 2 dry-brush, 1 sparse splatter, 1 deckle band. |
| 6 | Accent text variants `teal-text #0C7768`, `leaf-text #3D7929`, `ember-text #A55515` | Measured failures at 4.5:1 (4.02/3.27/2.98 on paper); §5 instructs darkening; variants hold hue, pass on both grounds. |
| 7 | Fonts: Bricolage 500+700, SS4 400+400i+600, Plex Mono 400+500, subset to used glyphs | Two weights per family (italic = style, not weight); budget ≈100KB + KaTeX subset ≈40KB ≤ 160KB (§13) — tight, tracked in Phase 4. |
| 8 | KaTeX fonts trimmed to Main-Regular, Math-Italic, Size1 and subset | Only four foundation-card equations + annotations; full KaTeX font set would blow §13. |
| 9 | JS budget allocation: engine ~6KB gz, scene wiring ~15KB, notes-graph interactivity ~4KB, no libraries — target ≤40KB of the 130KB cap | Headroom is the performance strategy; GSAP rejected (unneeded under this architecture). |
| 10 | Signature: generated single-stroke monoline from `[OWNER_NAME]` until `SIGNATURE_SVG` arrives | §6.5 explicitly permits; keeps S4 buildable now. |
| 11 | Turtle geometry: superellipse shell (n≈2.5), 30/22px, 2px strokes; head triangle echoes the Logo arrowhead | §3 allows circle or superellipse; superellipse reads better at 22px with five plates. |
| 12 | Edge maps: potrace via Python (3.13 confirmed) at build time, hand-simplified to 10–25 paths, committed | §14 requirement; Python present so the pipeline is scriptable and repeatable. |
| 13a | **Owner-directed (Phase 2 review): ink-write.** All body copy writes in word-by-word as the scroll window crosses each block; headings draw as letter outlines site-wide; the turtle idle-blinks (faceless squash, 2s cycle). | Owner override of §6.3's "never letter-by-letter" — implemented at WORD granularity as the readable middle ground (letter-level SVG outlines for body text would add megabytes and break §13). Real text preserved in DOM; no-JS/reduced-motion untouched. Idle blink = deliberate §4 timer exception. |
| 14 | **Owner-directed (post-launch): the black hole.** The hero's right half carries a gravitationally lensed accretion disk computed at runtime from the Schwarzschild geodesic equation (scenes/blackhole.js; lab with sliders and derivations in prototypes/blackhole.html). Hue encodes measured redshift (cobalt approaching, amber receding — the gold rim IS gravitational redshift); ink density follows tone-mapped flux; the cursor acts as an exact point lens and accretes dust. | Owner direction after rejecting an AI-mock hero (which was §2 ban pattern 1: cream + Didone + gold raster). Folded INTO signature moment 1 rather than added as a fifth — the hero remains one composition. Second sanctioned ambient-motion exception after the idle blink: own rAF loop, paused off-screen (IntersectionObserver) and on hidden tabs, static single frame under reduced motion, absent without JS or under 1024px (the hero is complete without it). Lens map builds in ≤4ms idle slices after load — zero long tasks, no worker. Resize never rebuilds (model-space grid, scaled at draw). |
| 13 | **Owner-directed (Phase 2 review): the vine.** The turtle's guide path renders as a visible ink trail growing behind it, with accent-colored branches (leaves/berries) sprouting as it passes — sparse in the ink chapter, lush after GenAI, five-hue bloom at Contact. | Owner request during the §15 approval loop; upgrades §3's optional faint trail into a page-scale motif. Constraints preserved: strokes-only (no paint over text), own z-layer below content, branches suppressed over text columns, mobile 44px reserved lane, fully rewindable f(scroll). |

## 8. Open items for the owner (§11 — ask, don't invent)

`OWNER_NAME` · tagline · role line · optional headshot · real case studies (Problem/Approach/Result + metrics) · note titles/dates/tags · Email/GitHub/LinkedIn/Scholar links · résumé PDF · optional `SIGNATURE_SVG`. Until supplied: bracketed tokens, clearly-fake `PLACEHOLDER`-commented projects, no fabricated metrics. All placeholders will be tabled in the README.

**Next:** Phase 1 — nine-section skeleton, real layout/typography/nav, zero animation, ≥95 Lighthouse accessibility, passes the 30-second skim test.
