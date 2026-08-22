# Drawn from first principles

A scroll-driven, turtle-graphics portfolio for an AI/ML engineer with a physics and mathematics background. The full brief lives in [plan.md](plan.md); the Phase 0 design document (tokens, wireframe, signature moments, decision log) lives in [DESIGN.md](DESIGN.md).

**Thesis, stated and embodied:** "AI systems, drawn from first principles." A geometric turtle travels down the page as you scroll, drawing the site's diagrams in ink while the page gradually becomes a painting. The whole story is a pure function of scroll position.

## Status — all phases complete

| Phase | Scope | State |
|---|---|---|
| 0 — Plan | Design doc, tokens, wireframe, self-critique | ✅ ([DESIGN.md](DESIGN.md)) |
| 1 — Skeleton | Nine sections, real layout/type/nav, zero animation | ✅ |
| 2 — Vertical slice | Hero + GenAI animated; owner-directed additions (vine, ink-write, blink) | ✅ |
| 3 — Replicate | All seven remaining scenes, signature, pen states end to end | ✅ |
| 4 — Perf & a11y | Budgets measured (below), no-JS / reduced-motion verified by screenshot | ✅ |
| 5 — Finish | Painted favicon, OG image, 404, sitemap/robots/caching headers | ✅ |

## Measured numbers (§13/§16, Lighthouse mobile emulation on the built site)

- **Performance 97 · Accessibility 100 · Best Practices 100 · SEO 100**
- LCP **2.34 s** (< 2.5 budget) · CLS **0.001** (< 0.1) · TBT **0 ms** (< 200 INP proxy)
- Scroll frames during a full sweep: **max 8 ms, avg 6.9 ms** (< 50 ms budget), vine at full density
- Boot main-thread work: 171 ms (was 887 ms before math-sampled path geometry)
- JS **21.4 KB raw / 8.2 KB gzip** (≤ 130 KB budget) — the entire engine, turtle, vine, and scenes
- Fonts on the wire: our six loaded subsets 100.3 KB + KaTeX's four faces 53.6 KB = **153.9 KB** (≤ 160). The italic face (18.4 KB) loads only if italic text is added — that would exceed the cap by ~12 KB; trim elsewhere if you introduce italics.
- HTML 27 KB gzip · hero wire weight ≈ 86 KB before below-fold lazy images
- Textures ≤ 56 KB each (≤ 60); noise→structure sequence 206 KB total, lazy
- Cross-browser: verified in headless Chromium (desktop + mobile emulation). **Firefox, Safari, iOS Safari, and Android Chrome on real hardware remain an owner task** (§16) — the animation stack is standards-only (rAF, dasharray, IntersectionObserver), so no known risks.

## Deploy — read this before the first push

The site is hard-wired to the GitHub **user page** origin (`https://ibtisam-mohammad.github.io`),
which currently serves the old Quartz "Small Diary". The two cannot share one origin.
This repo has no git remote yet, so nothing is live — but the first push decides everything:

1. **Push this repo as `Ibtisam-Mohammad/ibtisam-mohammad.github.io`** (the user-page repo,
   replacing the Quartz site — the portfolio absorbs the diary: all notes now live at
   `/notes/…` here, and `public/fara-7b/index.html` redirect-stubs the old diary URL).
   Any other repo name serves the site at a subpath where every root-absolute URL breaks.
2. In that repo's **Settings → Pages**, set **Source: GitHub Actions** (the workflow in
   `.github/workflows/deploy.yml` handles build + deploy on pushes to `main`).
3. If you ever move to a custom domain instead: set it in `astro.config.mjs` (`site`),
   `public/robots.txt`, add a `public/CNAME` file, and rerun `python scripts/make-og.py`.
4. `public/_headers` is Netlify-format and ignored by GitHub Pages (harmless; useful if
   the host ever changes).

## Deploy (any static host)

Any static host. `dist/` is the site. Netlify reads [public/_headers](public/_headers) for caching (translate for Vercel/Pages). The configured canonical host is `https://ibtisam-mohammad.github.io`; rerun `python scripts/make-og.py` after changing the public identity or social preview design.

## Run it

```sh
npm install
npm run dev       # dev server
npm run build     # static build to dist/
npm run preview   # serve dist/
```

## Analytics

The site includes a conditional GoatCounter integration. It emits no tracking script
until `PUBLIC_GOATCOUNTER_ENDPOINT` is configured. Create a free GoatCounter site and
set the endpoint to `https://YOUR-SITE-CODE.goatcounter.com/count`.

For GitHub Pages deployments, add a repository **Variable** named
`GOATCOUNTER_ENDPOINT` with that endpoint. This is deliberately a variable rather than
a secret: the endpoint is included in the public page source and is not a credential.
The deployment workflow passes it to Astro at build time.

Tracked automatically: page visits, referrers, UTM campaigns, location, browser,
operating system, and screen width. GoatCounter's main dashboard totals page visits
and custom events together, so this portfolio deliberately keeps conversion events
out of the primary property. Never put names, email addresses, job titles, or other
personal data in UTM parameters.

For local verification, copy [`.env.example`](.env.example) to `.env.local` and set
your endpoint. `.env.local` is ignored by Git.

Stack: Astro 5 (static output, no client framework), KaTeX rendered at build time, self-hosted subset fonts. The scroll engine is hand-written vanilla JS — no animation libraries.

## The scroll engine (src/scripts/)

- `engine.js` — one rAF loop reads `scrollY`; every animated property is a pure function of global or scene-local progress. Scenes register `{el, measure, update(s)}`; an IntersectionObserver (±1 viewport) keeps inactive scenes at zero per-frame cost; `[data-draw]` paths get stroke-dasharray reveals with slack for stretched viewBoxes. Resize and document-height changes re-measure everything.
- `turtle.js` — builds the guide path through per-section lane waypoints (Catmull-Rom → cubics), maps scroll to arc length piecewise, orients to the path tangent, drives pen state, plate fills, and the boundary flourish. Waypoints with `vy` track pinned (sticky) scenes.
- `scenes/hero.js`, `scenes/genai.js` — the two Phase 2 signature scenes; the pattern for Phase 3.
- `vine.js` — owner-directed addition: the guide path rendered as a visible ink trail that grows exactly behind the turtle, with RECURSIVE procedural branches (trunk → branch → twig, three levels deep in the lower half) carrying leaves and berries in the section accents. Density ramps quadratically with depth — bare stem in the ink chapter, five-hue thicket by Contact — and free margins grow extra-dense. Text safety: clusters shrink as they approach the content column (proximity-scaled length and recursion depth) and never sprout inside it; the trail begins only after the hero so the first fold stays blank paper. Own z-layer below content; mobile reserves a 44px right lane. Tuning knobs at the top of the file (`SPACING_*`, `LEN_*`, `MAX_ELEMENTS`, sub-branch ramps in `buildBranch`).
- `scenes/ink.js` — ink-write (owner override of §6.3): body copy writes itself in word by word as each block crosses its scroll window; chips, equations, buttons, and figures reveal as whole units in document order; blocks carry a subtle 4px rise. Word spans preserve plain text flow (copy/paste, wrapping, screen-reader order). Reversible; no-JS/reduced-motion DOM is never touched.
- `scenes/headings.js` — §6 rule 2 site-wide: every section h2 is a stroke-reveal of its real letter outlines (fontTools-extracted from the display font, `scripts/gen_heading_paths.py`), drawn glyph-by-glyph in scroll sync, then filled. Real text always underneath for AT/search/selection; plain headings for no-JS/reduced-motion. Add a heading: extend `HEADINGS` in the script, rerun it, pass `glyphId` to `SectionHeader`.
- `main.js` — boots only when `html.anim` is set (JS present and no reduced-motion preference). No JS → finished states in markup. Reduced motion → same finished states, no scrubbing. Also hosts the idle blink: after ~2.4s without scrolling the turtle breathes and gives a quick faceless squash-blink (owner request; the one deliberate timer exception to §4 — it stops the instant scrolling resumes and never runs under reduced motion).

Asset pipelines (`scripts/`): `make-washes.py` (watercolor alpha textures), `make-genai-steps.py` (noise→structure sequence), `gen_heading_paths.py` (letter outlines via fontTools), `screenshot.mjs` (review harness: 3 scroll positions × desktop/mobile + no-JS + reduced-motion).

## Structure

```
src/
  layouts/Base.astro        head, skip link, top bar, footer
  components/               TurtleMark, SectionHeader, Equation (KaTeX), TopBar, SiteFooter
  sections/                 one file per section, §10 order
  styles/tokens.css         the design tokens (single source of truth)
  styles/global.css         fonts, reset, typography, layout, utilities
public/fonts/               woff2, subset per §6
public/resume.pdf           public résumé download
```

## Private and illustrative content

The copy, links, metrics, and case studies are backed by the public GitHub profile and current
résumé. Seven project notes are published as static pages under `/notes/`. Client imagery is
intentionally represented by privacy-safe illustrations.

| Item | Where | Replace with |
|---|---|---|
| Headshot | not yet placed | Optional — receives the contour-first reveal (§8) if supplied |
| Signature | `src/sections/Contact.astro` (generated single-stroke) | Optional `SIGNATURE_SVG` — swap the two paths + dot inside `.signature` |
| Project imagery | `public/img/cv-*.webp`, `shot-*.webp` | Stylized recreations by design (client work is private); swap only if shareable assets appear |
