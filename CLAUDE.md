# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mark Dingwall's personal website ([mark-dingwall.github.io](https://mark-dingwall.github.io)), with portfolio pieces, creative coding sketches, and [BitBrush](https://github.com/mark-dingwall/BitBrush) - a multiplayer pixel canvas powered by Spring Boot. A static site — no build step, no package manager, no bundler. Open any `index.html` directly in a browser or use a local server (e.g. `python3 -m http.server`). Deploy by pushing to `main` (GitHub Pages). Live at [mark.dingwall.com.au](https://mark.dingwall.com.au)

## Architecture

### Homepage (`index.html` + `index.js` + `background.js` + `fireflies.js`)

- 2x2 quad navigation system with a WebGL shader background
- Default view is **TR (top-right)** containing the hero ("Mark Dingwall", "Creative coder")
- Quad layout (ring order: TR→BR→BL→TL):
  ```
  TL(3): BitBrush     |  TR(0): Hero  ← default view
  --------------------+---------------------
  BL(2): Sketches     |  BR(1): Portfolio
  ```
- Scroll down first (TR→BR), then left (BR→BL→TL); arrow keys + corner markers for direct navigation
- `background.js`: WebGL shader with per-quad noise textures and colour palettes, gravitational lensing effect, smooth texture/palette transitions between quads
- `fireflies.js`: overlay particle effect, colour-matched to the current shader palette
- `index.js`: quad navigation state machine — scroll wheel (lerp), arrow keys (ease-in-out), corner markers, boundary bounce
- Each quadrant's content is wrapped in `<div class="quadrant-content">` with frosted-glass styling (`backdrop-filter: blur`, with mobile fallback to opaque)
- Fonts: `VT323` (body), `Major Mono Display` (headings) from Google Fonts

### CSS Architecture

Shared CSS lives in `css/`. Each file is linked via `<link rel="stylesheet">` from HTML pages:

```
reset.css                     — global reset (box-sizing, margin, media)
css/
  home.css                    — homepage quad nav, canvases, nav markers
  nav-buttons.css             — shared nav-btn component (fixed icon buttons, pill variant, hover/touch states)
  sketch.css                  — shared by all sketch sub-pages (instructions banner, fullscreen canvas)
  sketch-gallery.css          — sketch gallery grid, frosted glass, grove toggle
  portfolio.css               — shared by all portfolio project pages (scroll scaffolding, row grid, arch SVG, tooltips, theming)
  portfolio-components.css    — shared flow-card, score-compare, flow-arrow/match, pulse keyframes, 600px collapse
  portfolio-gallery.css       — portfolio gallery card grid, hover states
```

- `portfolio.css` uses CSS custom properties (`--accent`, `--accent-rgb`) for accent colour theming. Default is cyan (`#0cc`); Oasis overrides to green (`#0c6`) via its page CSS `:root` override.
- `portfolio-components.css` extracts genuine cross-page duplicates: `.flow-card`/`.flow-label`/`.flow-detail` base, `.flow-compare`, `.flow-arrow`/`.flow-match` connectors, `.score-compare` family, `pulse-arrow`/`pulse-match` keyframes, 600px responsive collapse, and `prefers-reduced-motion`. Pages override font sizes or colours as needed.
- Portfolio project pages co-locate page-specific CSS alongside their HTML (e.g. `portfolio/jointly/jointly.css`). Load order: `portfolio.css` → `portfolio-components.css` → page-specific CSS.
- Sketch sub-pages: p5.js sketches need zero inline CSS. Three.js sketches (cubeworms, magnetites) add small inline overrides for `canvas { display: block }` and `#instructions` font. Flowsphere overrides `#instructions` font/colour.

### Sketch pages

All sketches live under `sketches/`: `sketches/sketchname/index.html` + `sketches/sketchname/sketchname.js`. The sketch gallery is at `sketches/index.html`.

Two kinds of sketch:

**Interactive p5.js sketches** — fullscreen canvas rendered to `<div id="drawHere">`. Pattern:
- Load p5.js from CDN: `https://cdn.jsdelivr.net/npm/p5@1.10.0/lib/p5.min.js`
- `setup()` creates canvas with `createCanvas(windowWidth, windowHeight)`, parents it to `#drawHere`
- `draw()` runs the animation loop at typically 30 fps
- Optional `<div id="instructions">` with a CSS animation that slides it off-screen after 3s
- Sketches in this style: `forest`, `microbes`, `bioluminescence`, `waterfall`, `drift1`, `drift2`, `constellations`

**Interactive Three.js / p5.js-EasyCam sketches** — `cubeworms` (Three.js), `flowsphere` (p5.js + EasyCam). Fullscreen canvas with mouse/touch controls.

### Title marquee

Every page uses this inline snippet to create a scrolling/rotating tab title:
```js
var m = 'Mark Dingwall - [Sketch Name] ', w = 0;
setInterval(() => { document.title = `${m.substring(w)}${m.substring(0, w)}`; w = (w + (m[w] == ' ' ? 2 : 1)) % m.length; }, 500);
```
Note the trailing space in `m` — it's intentional.

## Adding a New Sketch

1. Create `sketches/sketchname/` with `index.html`, `sketchname.js`, and a preview image (`sketchname.png` or `.jpg`)
2. Link `../../css/sketch.css` and `../../css/nav-buttons.css` in `<head>` (provides instructions banner, fullscreen canvas, and nav button styles). Keep the VT323 Google Fonts `<link>` tag.
3. Add a `<nav class="nav-btn nav-btn--pill">` with back (`../`) and home (`/`) links using the SVG icon markup from `sketches/forest/index.html`
4. Add to the gallery grid in `sketches/index.html`: a `.grid-cell` with `<a>`, `<img>`, `<h2>` (name), and `<p>` (tagline)
5. For p5.js sketches, follow the pattern in `sketches/forest/index.html` (zero inline CSS needed)
6. For Three.js sketches, follow `sketches/cubeworms/index.html` (small inline overrides for canvas/body)

## Conventions

- Black background (`#000`), white text (`#fff`), cyan links (`#0cc`), visited links magenta (`#c0c`)
- The SimplexNoise library is copied inline into JS files that need it (no import/module system)
- `forest.js` uses p5.js global mode; `microbes.js` / `bioluminescence.js` use the same pattern
- All constants are defined at the top of each sketch file with `ALL_CAPS` names
- p5.js sketches handle window resize via `windowResized()` → `resizeCanvas(windowWidth, windowHeight)`
