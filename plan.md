# Agent build brief — "Drawn from first principles"

A scroll-driven, turtle-graphics portfolio website for an AI / ML engineer with a physics and mathematics background. This brief is complete and deliberate: every ambiguous decision has already been made. Execute it; do not substitute your own defaults for decided items.

---

## 0. Role and mission

You are the design engineer responsible for this site end to end. Deliver a complete, production-ready website: design tokens, layout, all nine sections, the scroll/animation engine, the paint and image asset pipeline, accessibility, performance, SEO, favicon, OG image, a 404 page, and a README documenting the scroll engine and content replacement.

Before writing any code, restate your plan in a short design document (tokens, layout wireframe, the four signature moments, one deliberate risk) and self-critique it against §2 and §16. Where something is genuinely unspecified, choose in the spirit of the feeling targets in §2, and log what you chose and why. Follow the build order in §15.

## 1. Concept

The site's thesis, stated on the page and embodied by it: **"AI systems, drawn from first principles."**

The core metaphor is Logo turtle graphics. A small geometric turtle travels down the page as the visitor scrolls, drawing the site's diagrams, annotations, and frames in ink. The page begins as ink line work on warm paper and gradually becomes a painting; the turtle itself begins as an empty outline and is fully painted by the end. The structure is a scroll-driven visual essay moving from theory (physics, math) through application (ML, vision, generative AI) to shipped systems (MLOps, case studies).

Two truths must coexist at all times: (a) it is a story you scroll through, and (b) it is a document a recruiter can skim in 30 seconds. **When the two conflict, scanning wins.**

## 2. Hard constraints and feeling targets

Banned outright:
- Terminal, hacker, cyberpunk, OS-chrome, or dark-mode-only aesthetics; matrix rain; neon or glow effects.
- Cel-shaded anime effects, speed lines, screentones, lens flares.
- A face on the turtle (no eyes, mouth, brows). It is a plotter cursor with a shell, not a character.
- Scroll hijacking, wheel capture, fake smooth-scroll, autoplaying sound.
- Body text placed over paint without a clean paper surface (§7).
- The three generic AI-design looks: (1) warm cream + high-contrast serif + terracotta/clay accent — **no terracotta anywhere, no #D97757 or neighbors**; (2) near-black + single acid-green accent; (3) broadsheet hairline-grid newspaper layout. This brief's warm paper base is a deliberate ink-and-watercolor decision, not a default — differentiate through the ink/wash treatment and the multi-hue scientific accent system in §5.

Feeling targets — when in doubt, the **second** adjective of each pair wins:
playful but **serious** · scientific but **warm** · colorful but **not childish** · technically deep but **readable** · personal but **professional** · handcrafted but **polished**.

Non-negotiables: conventional navigation; fully usable with JavaScript disabled; `prefers-reduced-motion` respected everywhere; original visual language — do not copy an existing site.

## 3. The turtle — exact specification

- **Form:** top-down geometric turtle, ~30px on desktop, ~22px on mobile. Shell = circle or gentle superellipse; head = small triangle (a deliberate nod to the Logo arrowhead cursor); four stub feet; optional short tail. 2px ink outline, flat fills, no gradients, no face.
- **Motion:** follows one continuous, author-defined SVG guide path spanning the entire document. The path lives mostly in the outer margins and gutters, crossing content zones only between sections. Orientation always equals the path tangent. Position is a pure function of scroll (§4).
- **Pen states:** *pen-down* (drawing): a solid ink stroke appears behind the head; turtle scales to 1.05 and tilts ~6°. *Pen-up* (traveling): no stroke, or a faint 30%-opacity dashed trail; turtle at 85% opacity. State transitions ease over ~150ms.
- **Shell fill:** the shell is divided into five plates. As each domain section is traversed, one plate fills with that section's accent hue, in scroll order: cobalt → teal → leaf → violet → ember (§5). The turtle is simultaneously the scroll-progress indicator and the site's palette legend. Fill level is a function of scroll: scrolling up un-fills.
- **Section boundaries:** pen lifts, the turtle performs a small in-place rotation flourish (≤400ms of scroll distance), pen drops.
- **Mobile (<720px):** turtle pinned to a right-gutter lane, reduced drawing set (§10 marks what survives), and it must never overlap text.
- **Finale:** the fully painted turtle draws the signature (§6), then rests beside the contact actions. The painted turtle is also the favicon and appears in the OG image.

## 4. Motion architecture — the page is a pure function of scroll

- Define one global progress `p = scrollY / (documentHeight − viewportHeight)`. Every animated property is a deterministic function of `p` or of a section-local progress derived from it. No timers drive visible animation; the only time-based motion permitted is micro-easing (≤200ms) toward the scroll-derived target.
- Consequences to preserve: scrolling up **rewinds** drawings and paint; reloading mid-page shows the correct mid-state; anchor links scroll natively and the story simply plays through.
- Implementation: a single `requestAnimationFrame` loop reads `scrollY` (passive listeners); precompute every path's `getTotalLength()` once at init; animate line work via `stroke-dasharray` / `stroke-dashoffset`; animate everything else via `transform` and `opacity` only. Progressive enhancement: where supported, use CSS scroll-driven animations (`animation-timeline: scroll()`) with the rAF loop as fallback.
- Activation: an `IntersectionObserver` activates each scene one viewport early and deactivates it one viewport late; inactive scenes must cost zero work per frame.
- **Reduced motion** (`prefers-reduced-motion: reduce`): every scene renders in its finished state — completed drawings, settled paint, turtle static and fully painted at its per-section resting point. Only simple opacity fades remain.
- **No JavaScript:** all finished states exist in the markup/CSS by default; JS rewinds to the start and layers animation on top after boot. Content is never hidden behind the animation system.

## 5. Color system

| Token | Hex | Role |
|---|---|---|
| `paper` | `#FCF8EF` | page ground |
| `paper-deep` | `#F4EDDF` | cards, alternate bands, scrims |
| `ink` | `#262219` | text, all turtle strokes |
| `ink-soft` | `#5B5344` | secondary text, captions |
| `cobalt` | `#2B59C3` | physics & math |
| `teal` | `#0E8A78` | AI / ML core |
| `leaf` | `#4E9B35` | computer vision |
| `violet` | `#7A4FD6` | generative AI |
| `ember` | `#E0731D` | MLOps & production |
| `marker` | `#F5C64F` | turtle's highlight/underline, sparing |
| `rose-wash` | `#D4537E` | GenAI-section washes only |

Rules:
- Body text is always `ink` on `paper` (≈7:1 contrast). Accents are never used for body copy — only strokes, fills, chips, and labels ≥14px at medium weight. Darken any accent used as text until it passes 4.5:1.
- Washes are the domain hue at 12–25% opacity. Each section leads with its own accent and may quote earlier accents at small scale — the palette accumulates just as the paint does.
- `marker` yellow appears only under turtle-drawn emphasis strokes.
- You may fine-tune any accent ±10% in saturation/lightness during implementation, but hue relationships and the warm paper base are fixed.

## 6. Typography and the drawing law

Typefaces (self-hosted, subset, `font-display: swap`, max two weights per family):
- **Display:** Bricolage Grotesque — characterful, slightly hand-shaped grotesque for headings and large numbers. (Deliberately *not* a high-contrast serif; see §2.)
- **Body:** Source Serif 4 — the essay voice. 17–19px fluid, line-height ~1.65, measure ≤68ch.
- **Utility:** IBM Plex Mono — labels, axis text, stat chips, turtle annotations. 12–13px, letterspaced, sentence case.
- **Math:** KaTeX, rendered at build time. The Computer Modern look is a deliberate signal to technical readers.

Fluid type scale via `clamp()`. Copy style: active voice, plain verbs, sentence case, specific over clever; buttons say exactly what they do ("Download résumé").

**The drawing law — the single most important rule set on the site:**
1. The turtle draws **shapes, never paragraphs**: arrows, underlines, circles, brackets, axes, boxes, leader lines, diagrams.
2. **Headings:** real text is always present in the DOM. The visible treatment is an SVG stroke-reveal of the heading's letter outlines synced to scroll, layered over visually-hidden real text (accessible to screen readers, selection, and search). Reduced-motion and no-JS users get plainly set headings.
3. **Body copy:** typeset, entering with a soft ink-settle (opacity fade + 4px rise) as the turtle passes. Never letter-by-letter animation.
4. **Equations:** typeset with KaTeX; the turtle *annotates* them — underlines a term, circles a variable, draws an arrow to a mono margin note.
5. Exactly **one hand-lettered element on the entire site**: the signature at Contact, drawn by the fully painted turtle. No handwriting fonts anywhere else. (Placeholder: `SIGNATURE_SVG` — if the owner supplies none, generate a tasteful single-stroke signature from `OWNER_NAME`.)

## 7. The paint system

- **Paint is assets, not code.** Prepare 8–12 genuine watercolor/ink-wash textures (pigment blooms, granulated washes, dry-brush strokes, sparse splatter) as grayscale PNG/AVIF with alpha. Tint them per section to the domain hue via CSS filters/blend modes, and reveal them with scroll-synced SVG masks or clip-paths. Banned: SVG turbulence filters, CSS blur blobs, gradient "watercolor."
- **Register:** ink and watercolor/gouache — painted-background warmth, granulation, deckled dry edges. Not cel animation (see §2 bans).
- **Placement law:** washes live in margins, gutters, section transitions, and behind non-text media. Maximum 15% opacity within 80px of any text. Body text always sits on solid `paper` or a ≥92%-opacity `paper` scrim — enforce this visibly even at peak paint. Once revealed, washes are static; they never drift independently.
- **Pacing arc** (paint level 0–10 per section):

| Section | Level | Character |
|---|---|---|
| 1. Hero | 1 | blank paper, a single accent dot |
| 2. Physics & math | 1 | ink only |
| 3. AI / ML | 3 | first teal washes in the margins |
| 4. Computer vision | 5 | leaf washes rising |
| 5. Generative AI | **9** | **peak**: violet + rose blooms across margins and transitions |
| 6. MLOps & production | 6 | same pigments, but contained *inside* diagram shapes — "color, disciplined" |
| 7. Case studies | 6 | full palette, structured, calm |
| 8. Notes garden | 4 | quiet mixed dots, one soft wash |
| 9. Contact | 7 | settled full palette, painted turtle, signature |

The arc is the emotional plot: raw creative energy peaks at Generative AI, then production engineering organizes it. Make that beat legible.

## 8. Image reveal system

**Primary mechanic — contour-first.** Every content image ships with a build-time edge-map SVG (traced key contours, 10–25 paths). On scroll, the turtle draws the contours (stroke-reveal), then the raster image wash-reveals inside the drawn frame via mask; the contours fade to ~20% and remain.

Sanctioned variants (only these three):
- **Computer vision:** the turtle draws bounding boxes with mono label chips (e.g. `person 0.97`); the image appears inside the box; an optional segmentation tint overlay at ~30% toggles with scroll.
- **Generative AI (one hero image):** noise → structure. Cross-fade through four pre-rendered steps (pure noise → coarse blobs → soft forms → final image), scrubbed by scroll. No runtime generation.
- **Case studies:** taped frame — the turtle draws a frame plus two tape corners; the screenshot fades in immediately. Calm and instant, so results stay scannable.

Requirements for all images: real `<img>` elements with meaningful `alt`, explicit `aspect-ratio` reserved (zero CLS), lazy-loaded below the fold, AVIF/WebP with fallbacks.

## 9. Layout, navigation, responsiveness

- **Sticky top bar:** mini turtle mark + `OWNER_NAME` on the left; links Work · Notes · Contact; a persistent **Résumé** button visible at every viewport size and scroll position. Beneath the bar, a 1px scroll-progress hairline tinted to the current section's accent.
- Skip-to-content link; stable section `id`s for deep links; native anchor scrolling.
- Grid: 12 columns, max content width 1120px. Generous whitespace — vertical rhythm ≥96px between sections on desktop. The outer gutters are the turtle's home: reserve ≥88px gutters at viewports ≥1200px.
- Breakpoints ≈720 / 1024. Mobile: single column, turtle in the right lane, wash density ~60%, all four signature moments preserved but simplified.
- Footer: a tiny mono caption — "this page is a pure function of scroll position." The site's one inside joke; keep it.

## 10. Section-by-section spec

Format: **Job / Content / Turtle draws / Paint / Weight.** Weights: SIGNATURE (exactly four on the whole site — spend the animation budget here), mid, ambient. Everything not listed as a drawing is typeset.

**1) Hero — SIGNATURE 1 of 4**
Job: identity and thesis inside 5 seconds. Content: `OWNER_NAME` in display type; thesis line (placeholder: "I build AI systems from first principles."); a sub-line of roles (ML engineer · physics & math background); two actions — "View work" (anchors to case studies) and "Résumé" (download). Turtle: enters top-left pen-up, drops the pen, draws light coordinate axes, then a sine wave that resolves into the underline of the name, plants a single cobalt dot at the origin, and heads down. The first fold completes within ~120vh. Paint: none but the dot.

**2) Physics & math foundation — mid**
Job: establish the foundation; this is the ink chapter. Content: 3–4 short essay paragraphs plus four foundation cards (mechanics · linear algebra · probability · optimization), each carrying one KaTeX equation. Turtle: draws an elliptical two-body orbit around the section marker; a small 5×5 vector-field patch; then contour lines with a gradient-descent path stepping into the minimum — this drawing is the literal bridge to the next section. It underlines one equation term, circles one variable, and draws an arrow to a mono margin note. Paint: ink only.

**3) AI / ML expertise — ambient rising to mid**
Content: short narrative plus grouped skill chips (learning theory, deep learning, tooling — placeholders). Turtle: draws a small feed-forward network (3–4–2 nodes), a decision boundary curving between two scattered point clouds (teal vs ink dots), and an embedding scatter with two hulls. Paint: first teal washes in the margins.

**4) Computer vision — SIGNATURE 2 of 4**
Content: two or three project mini-cards. Turtle: performs the bounding-box image reveal (§8) on the lead image, draws a pose skeleton over a second image, and scrubs a segmentation tint. Paint: leaf washes rising, one wash bleeding through the section transition. Mobile keeps the bounding-box reveal, drops the skeleton.

**5) Generative AI — SIGNATURE 3 of 4, peak paint**
Content: two or three projects with one hero visual. Turtle: begins scribbling noise strokes that resolve — via the §8 noise-to-structure scrub — into the hero image; adds a small diffusion-trajectory doodle (dots converging along a curve). Margins bloom with violet and rose washes; the richest moment on the site. The text-on-clean-paper rule must be visibly enforced here.

**6) Production MLOps & deployment — mid**
Content: narrative plus stat chips (placeholder metrics: p95 latency, uptime, models served — clearly marked as placeholders). Turtle: draws one clean pipeline diagram — data → train → registry → deploy → monitor — five rounded nodes with orthogonal connectors, where the node *fills* use the collected palette: this is "color, disciplined." The monitor node carries a tiny scroll-scrubbed sparkline. Paint: contained inside shapes only.

**7) Selected case studies — mid**
Content: two to four cards on a strict template — Problem (2 lines) → Approach (3 lines) → Result (metric-led line + two chips) → stack chips → link. This section must pass a 30-second recruiter skim on its own. Turtle: taped-frame reveals for screenshots; connective arrows Problem → Approach → Result on the lead card only. Paint: full palette, structured, calm.

**8) Notes / research garden — ambient**
Content: an intro line plus a list of 5–8 note titles with dates and tags (placeholders). Turtle: draws a small notes graph (7–9 nodes, curved edges) as a visual index; hovering or tapping a node highlights matching list items (also keyboard-operable). Paint: quiet — mixed-hue dots and one soft wash.

**9) Contact & résumé — SIGNATURE 4 of 4**
Content: a short, warm outro line; actions for Email, GitHub, LinkedIn, Scholar (placeholders); a prominent résumé download; optional location/timezone line. Turtle: arrives fully painted, draws the signature (§6), and rests beside the actions. Paint: settled full palette. Footer caption per §9.

## 11. Content placeholders — ask, don't invent

Request from the owner: `OWNER_NAME`, tagline, role line, optional headshot (if supplied, it receives the contour-first reveal), real case-study data on the §10 template, note titles, contact links, the résumé PDF, and optionally `SIGNATURE_SVG`.

Until provided: use bracketed tokens (`[OWNER_NAME]`) and realistic-but-clearly-fake placeholder projects, each marked `PLACEHOLDER` in an HTML comment. Never fabricate metrics that could read as real claims. List every remaining placeholder at the end of the README with replacement instructions.

## 12. Accessibility (WCAG 2.2 AA)

- Real text everywhere, including stroke-reveal headings (visually-hidden text or accessible SVG text).
- Correct landmarks and heading order; exactly one `h1`.
- Visible focus (2px ink outline, 2px offset), full keyboard operability, skip link, touch targets ≥44px, no hover-only information.
- Contrast: body ≥7:1, large text and labels ≥4.5:1 (darken accents as needed).
- `prefers-reduced-motion` and no-JS behavior exactly per §4. No meaning conveyed by motion or color alone; drawings that carry meaning get captions or alt text.

## 13. Performance budget — hard numbers, measured on a mid-range Android over 4G

- LCP < 2.5s · CLS < 0.1 · INP < 200ms · no scroll-frame task > 50ms.
- Total JS ≤ 130KB gzipped. Fonts ≤ 160KB total via subsetting. Each wash texture ≤ 60KB AVIF. Hero payload ≤ 500KB.
- Techniques: `content-visibility: auto` on below-fold sections; IntersectionObserver activation windows (§4); simplified/merged SVG paths with ≤ ~400 animated path segments live at once; `transform`/`opacity` only; zero layout reads inside the rAF loop after init.

## 14. Tech stack

- Static site. Preferred: Astro, or plain HTML/CSS/JS; a Next.js static export is acceptable. One page plus note stubs — no SPA router.
- **Write the scroll engine by hand** (~200 lines). It is itself a proof of craft for this portfolio. No jQuery, no Lottie; GSAP only if it fits inside the JS budget and you justify it.
- KaTeX rendered at build time. Animatable scenes are inline SVG; static imagery uses `<img>`.
- Edge maps generated at build time (autotrace/potrace then hand-simplify) and committed as assets.
- Deploy to static hosting (Netlify / Vercel / GitHub Pages) with proper caching headers, sitemap, meta and OG tags.
- Watch CSS specificity: avoid section-level and element-level selectors silently cancelling each other's spacing.

## 15. Build order and collaboration protocol

- **Phase 0 — Plan.** Restate tokens, an ASCII layout wireframe, the four signature moments, and one deliberate aesthetic risk. Self-critique against §2 (especially the generic-AI-looks ban) and §16. Share the plan; if the owner is unavailable, proceed and log decisions.
- **Phase 1 — Skeleton.** All nine sections with real layout, typography, navigation — zero animation. Must already pass the 30-second skim test and score ≥95 on Lighthouse accessibility.
- **Phase 2 — Vertical slice.** Hero + Generative AI fully animated: turtle engine, paint reveal, one image variant. Produce screenshots at three scroll positions on desktop and mobile; self-critique; iterate here until approved. **This slice is the executable style guide.**
- **Phase 3 — Replicate.** Roll the proven systems across the remaining sections; wire the turtle path end to end; shell plates; signature.
- **Phase 4 — Performance and accessibility pass.** Measure against §13, report the numbers, verify reduced-motion and no-JS states.
- **Phase 5 — Finish.** Content polish, favicon (painted turtle), OG image, 404 page (turtle pen-up: "Looks like I wandered off the path." + link home), README covering the scroll engine and content swapping.

## 16. Definition of done — verify each item and report results

- [ ] Résumé reachable within 5 seconds / one interaction from any scroll position on any device.
- [ ] The full story plays forward and rewinds by scrolling; reloading mid-page restores the correct state.
- [ ] With JavaScript disabled, all content, finished drawings, and images are visible; nothing is hidden.
- [ ] With `prefers-reduced-motion`, no scroll-scrubbed motion remains — finished states and fades only.
- [ ] No body text over paint without a paper scrim, checked in every section at peak paint.
- [ ] Exactly four signature moments; the turtle has no face; no handwriting except the signature.
- [ ] No banned aesthetics (terracotta accent, neon, cel splash, terminal chrome); palette matches §5.
- [ ] Lighthouse mobile: Performance ≥90, Accessibility ≥95, SEO ≥95; §13 budgets met with reported numbers.
- [ ] Verified in current Chrome, Firefox, Safari, iOS Safari, and Android Chrome.
- [ ] Every remaining placeholder token is listed in the README with replacement instructions.