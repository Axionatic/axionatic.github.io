# Paralife Opening Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Paralife’s opening narrative panel, unsupported live-server HUD, and isolated socket annotation with the approved four-beat, scroll-morphed narrative while leaving `#tech-content` unchanged.

**Architecture:** Add a focused `paralife-opening.js` controller that owns pure progress-to-state derivation, deterministic narrative-observer geometry, narrative DOM state, one persistent SVG frame, and the client constellation. Keep the cellular automaton in `paralife.js`; it passes normalized scroll progress, viewport geometry, and ambient time to the opening controller, while canvas dimming consumes the controller’s same scroll-derived observer target. Playwright tests assert the pure state contract, visible beat choreography, time-invariant and reverse-scroll geometry, stable client identity, responsive containment, reduced motion, and the unchanged handoff to `#tech-content`.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, SVG, Canvas 2D, GSAP 3.12.5/ScrollTrigger, Playwright 1.52.

## Global Constraints

- Scope is limited to the opening runway on `/portfolio/paralife/`; do not change `#tech-content` markup, copy, illustrations, or ordering.
- Keep the existing `500vh` runway initially.
- Use explicit beat ranges: `0.00–0.18`, `0.18–0.40`, `0.40–0.62`, `0.62–1.00`.
- The cellular-automaton world runs continuously and must not reseed or reset between beats.
- Failure state is a pure function of normalized scroll progress; only ambient healthy-client pulses may use wall-clock time.
- Narrative copy remains real DOM text in document order; decorative SVG is `aria-hidden="true"`.
- Under `prefers-reduced-motion: reduce`, use opacity transitions, omit changing population counts, and show static stalled/recovered examples.
- Do not display the removed `1,000 sessions`, `45 ms`, or `110 B` HUD claims. The only permitted server metric in the opening is the implemented `2 Hz` cadence.
- Use colour plus stable identity marker, line treatment, and state label for lag/recovery; colour alone is insufficient.
- Do not add a rendering dependency.

---

## File Structure

- Create `portfolio/paralife/paralife-opening.js`: pure scroll-state derivation, SVG/client construction, responsive geometry, reduced-motion behavior, and DOM/SVG rendering.
- Modify `portfolio/paralife/index.html`: approved four-line semantic narrative, shared SVG overlay shell, script inclusion, removal of the legacy HUD; preserve `#tech-content` byte-for-byte.
- Modify `portfolio/paralife/paralife.js`: retain simulation ownership, expose observer geometry/species state to the opening controller, remove legacy narrative/HUD code, and preserve the existing tech handoff.
- Modify `portfolio/paralife/paralife.css`: four-beat typography/overlay styling, responsive final-beat composition, reduced-motion styling, and removal of legacy HUD rules.
- Create `e2e/tests/paralife-opening.spec.ts`: focused behavior and regression coverage.
- Modify `e2e/tests/scroll-sweep-sizing.spec.ts`: include Paralife’s new fixed overlays in the shared viewport sweep.

---

### Task 1: Lock the state contract and semantic markup

**Files:**
- Create: `portfolio/paralife/paralife-opening.js`
- Modify: `portfolio/paralife/index.html:39-65,248-253`
- Modify: `portfolio/paralife/paralife.js:82-85,296-350,403-414,455-462`
- Modify: `portfolio/paralife/paralife.css:28-56,376-381`
- Create: `e2e/tests/paralife-opening.spec.ts`

**Interfaces:**
- Produces: `window.ParalifeOpening.deriveState(progress: number, reducedMotion?: boolean): OpeningState`.
- `OpeningState` shape: `{ beat, lineOpacities, fieldAmount, perceptionAmount, legendAmount, networkAmount, clientPhase }`.
- Produces DOM roots `#opening-story` and `#opening-visuals`, four `.opening-line[data-beat]` elements, and SVG groups `#perception-layer`, `#legend-layer`, `#network-layer`.

- [ ] **Step 1: Write the failing semantic/state tests**

Create `e2e/tests/paralife-opening.spec.ts` with:

```ts
import { test, expect, type Page } from '@playwright/test';
import { navigateToPortfolioPage } from '../helpers/pages';
import { scrollToProgress, scrollToTechSection } from '../helpers/scroll';

const PARALIFE_PATH = '/portfolio/paralife/';

async function openingState(page: Page, progress: number, reducedMotion = false) {
  return page.evaluate(
    ({ p, reduced }) => (window as any).ParalifeOpening.deriveState(p, reduced),
    { p: progress, reduced: reducedMotion },
  );
}

test('opening exposes the approved semantic narrative and no legacy HUD', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  await expect(page.locator('#opening-story .opening-line')).toHaveText([
    'Three species locked in a rock-paper-scissors battle for survival.',
    'Every entity acts independently, seeing only what lies within reach.',
    'Simple local rules become spiral waves, shifting niches and population cycles.',
    'They act concurrently, but the world must advance as one coherent reality.',
  ]);
  await expect(page.locator('#opening-visuals')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#hud')).toHaveCount(0);
  await expect(page.getByText('one entity — one socket')).toHaveCount(0);
});

test('opening state uses unequal beats and scroll-bound client phases', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  expect((await openingState(page, 0.10)).beat).toBe('world');
  expect((await openingState(page, 0.30)).beat).toBe('perception');
  expect((await openingState(page, 0.50)).beat).toBe('emergence');
  expect((await openingState(page, 0.70)).beat).toBe('concurrency');

  expect((await openingState(page, 0.66)).clientPhase).toBe('healthy');
  expect((await openingState(page, 0.72)).clientPhase).toBe('lagging');
  expect((await openingState(page, 0.79)).clientPhase).toBe('stalled');
  expect((await openingState(page, 0.86)).clientPhase).toBe('reconnecting');
  expect((await openingState(page, 0.96)).clientPhase).toBe('recovered');
  expect((await openingState(page, 0.86)).clientPhase).toBe('reconnecting');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `e2e/`:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440"
```

Expected: FAIL because `#opening-story` and `window.ParalifeOpening` do not exist and `#hud` is still present.

- [ ] **Step 3: Add the approved semantic shell without touching `#tech-content`**

In `portfolio/paralife/index.html`, replace only lines 39–65 with:

```html
  <section id="opening-story" aria-label="Paralife story">
    <p class="opening-line" data-beat="world">Three species locked in a rock-paper-scissors battle for survival.</p>
    <p class="opening-line" data-beat="perception">Every entity acts independently, seeing only what lies within reach.</p>
    <p class="opening-line" data-beat="emergence">Simple local rules become spiral waves, shifting niches and population cycles.</p>
    <p class="opening-line" data-beat="concurrency">They act concurrently, but the world must advance as one coherent reality.</p>
  </section>

  <svg id="opening-visuals" aria-hidden="true" focusable="false">
    <g id="frame-layer">
      <rect id="morph-frame" rx="10"/>
    </g>
    <g id="perception-layer">
      <circle id="observed-entity" r="5"/>
      <text id="perception-label">ENTITY VIEW</text>
    </g>
    <g id="legend-layer">
      <text class="legend-species legend-catalyst">CATALYST</text>
      <text class="legend-species legend-membrane">MEMBRANE</text>
      <text class="legend-species legend-spore">SPORE</text>
      <text id="legend-cycle">CATALYST → MEMBRANE → SPORE → CATALYST</text>
    </g>
    <g id="network-layer">
      <g id="network-links"></g>
      <g id="network-clients"></g>
      <text id="server-label">SERVER · 2 Hz</text>
      <path id="reconnect-path"/>
      <text id="recovery-label">same entity restored</text>
    </g>
  </svg>
```

Insert the new controller script after `prng.js` and before `paralife.js`:

```html
  <script src="../../utils/prng.js"></script>
  <script src="paralife-opening.js"></script>
  <script src="paralife.js"></script>
```

Do not edit anything between `<div id="tech-content">` and its closing `</div>`.

Add a temporary compatibility bridge in `paralife.js` so this task leaves a working page before Task 2 installs the full controller:

```js
// DOM declarations: remove hudEl and hud value references.
let progressBar, scrollHint, headerPanelEl, narrativePanelEl;
let titleOverlayEl;
let narrativeLines = [];

// init(): point the existing narrative lifecycle at the new semantic DOM.
narrativePanelEl = document.getElementById('opening-story');
narrativeLines = Array.prototype.slice.call(document.querySelectorAll('.opening-line'));
```

Delete the HUD DOM lookups, the complete `updateHud()` function, the `updateHud()` call in `render()`, and `hudEl.style.visibility = vis` in the tech-content ScrollTrigger. Keep the old `updateNarrative()` temporarily; Task 2 replaces its equal-slice behavior with `ParalifeOpening.create(...).render(...)`.

For this intermediate commit, update the legacy selectors in `paralife.css` from `#narrative-panel` to `#opening-story` and from `.narrative-line` to `.opening-line`, including the 800 px media query. Remove all `#hud`/`.hud-*` rules. Task 2 replaces these compatibility styles with the four distinct beat treatments.

- [ ] **Step 4: Implement the pure state function**

Create `portfolio/paralife/paralife-opening.js` with the exact public boundary:

```js
'use strict';

(function () {
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };
  const between = (progress, start, end) => smooth((progress - start) / (end - start));

  function clientPhase(progress, reducedMotion) {
    if (reducedMotion) return 'static';
    const local = clamp01((progress - 0.62) / 0.38);
    if (local < 0.18) return 'healthy';
    if (local < 0.36) return 'lagging';
    if (local < 0.55) return 'stalled';
    if (local < 0.76) return 'reconnecting';
    return 'recovered';
  }

  function deriveState(progress, reducedMotion = false) {
    const p = clamp01(progress);
    const beat = p < 0.18 ? 'world'
      : p < 0.40 ? 'perception'
      : p < 0.62 ? 'emergence'
      : 'concurrency';

    return {
      beat,
      lineOpacities: [
        1 - between(p, 0.15, 0.20),
        between(p, 0.15, 0.20) * (1 - between(p, 0.37, 0.42)),
        between(p, 0.37, 0.42) * (1 - between(p, 0.59, 0.65)),
        between(p, 0.59, 0.65),
      ],
      fieldAmount: 1 - between(p, 0.13, 0.22),
      perceptionAmount: between(p, 0.13, 0.22) * (1 - between(p, 0.39, 0.49)),
      legendAmount: between(p, 0.39, 0.49) * (1 - between(p, 0.60, 0.70)),
      networkAmount: between(p, 0.60, 0.70),
      clientPhase: clientPhase(p, reducedMotion),
    };
  }

  window.ParalifeOpening = { deriveState };
}());
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440"
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add portfolio/paralife/index.html portfolio/paralife/paralife-opening.js portfolio/paralife/paralife.js portfolio/paralife/paralife.css e2e/tests/paralife-opening.spec.ts
git commit -m "feat(paralife): define opening story states"
```

---

### Task 2: Morph field typography through perception and emergence

**Files:**
- Modify: `portfolio/paralife/paralife-opening.js`
- Modify: `portfolio/paralife/paralife.js:34-48,208-316,396-462`
- Modify: `portfolio/paralife/paralife.css:28-136,371-405`
- Modify: `e2e/tests/paralife-opening.spec.ts`

**Interfaces:**
- Consumes: `ParalifeOpening.deriveState` from Task 1.
- Produces: `ParalifeOpening.create(root: HTMLElement): OpeningController`.
- `OpeningController.render(input)` consumes `{ progress, techFade, viewport, ambientTime }`.
- Produces `deterministicObserverGeometry(progress, viewport): { frame, entity }`, where `frame` is `{ x, y, width, height }` and `entity` is `{ x, y }`, all in CSS pixels.
- Narrative observer/frame geometry is derived only from scroll progress and viewport dimensions; it never consumes time-driven simulation observer coordinates.

- [ ] **Step 1: Add failing tests for the first three visual beats and reversibility**

Append to `e2e/tests/paralife-opening.spec.ts`:

```ts
test('first three beats morph through one shared frame and reverse cleanly', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  await scrollToProgress(page, 0.10);
  const fieldStart = await page.locator('.opening-line[data-beat="world"]').evaluate(
    (el) => getComputedStyle(el).transform,
  );
  await scrollToProgress(page, 0.17);
  const fieldCompressed = await page.locator('.opening-line[data-beat="world"]').evaluate(
    (el) => getComputedStyle(el).transform,
  );
  expect(fieldCompressed).not.toBe(fieldStart);

  for (const [progress, beat] of [[0.10, 'world'], [0.30, 'perception'], [0.50, 'emergence']] as const) {
    await scrollToProgress(page, progress);
    await expect(page.locator('#opening-story')).toHaveAttribute('data-active-beat', beat);
    await expect(page.locator(`.opening-line[data-beat="${beat}"]`)).toHaveCSS('opacity', '1');
  }

  await scrollToProgress(page, 0.30);
  const before = await page.locator('#morph-frame').evaluate((el) => ({
    x: el.getAttribute('x'), y: el.getAttribute('y'),
    width: el.getAttribute('width'), height: el.getAttribute('height'),
  }));
  await page.waitForTimeout(500);
  const sameScrollLater = await page.locator('#morph-frame').evaluate((el) => ({
    x: el.getAttribute('x'), y: el.getAttribute('y'),
    width: el.getAttribute('width'), height: el.getAttribute('height'),
  }));
  expect(sameScrollLater).toEqual(before);
  await scrollToProgress(page, 0.50);
  await expect(page.locator('#morph-frame')).toHaveCSS('opacity', '1');
  await expect(page.locator('#legend-layer')).toHaveCSS('opacity', '1');
  await scrollToProgress(page, 0.30);
  const after = await page.locator('#morph-frame').evaluate((el) => ({
    x: el.getAttribute('x'), y: el.getAttribute('y'),
    width: el.getAttribute('width'), height: el.getAttribute('height'),
  }));
  expect(after).toEqual(before);
});
```

Use `toHaveCSS('opacity', '1')` only after the one-second GSAP settle in `scrollToProgress`; the approved hold ranges make these sampled points fully opaque.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440" -g "first three beats"
```

Expected: FAIL because no controller writes `data-active-beat`, persistent frame opacity, or deterministic frame geometry.

- [ ] **Step 3: Add the opening controller and shared-frame geometry**

Extend `paralife-opening.js` with:

```js
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixRect = (from, to, t) => ({
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
  });

  function deterministicObserverGeometry(progress, viewport) {
    const mobile = viewport.width <= 800;
    const frameWidth = mobile
      ? viewport.width * 0.86
      : Math.min(viewport.width * 0.52, 680);
    const frameHeight = mobile
      ? viewport.height * 0.42
      : Math.min(viewport.height * 0.46, 460);
    const start = mobile
      ? { x: viewport.width * 0.50, y: viewport.height * 0.55 }
      : { x: viewport.width * 0.54, y: viewport.height * 0.54 };
    const end = mobile
      ? { x: viewport.width * 0.50, y: viewport.height * 0.55 }
      : { x: viewport.width * 0.50, y: viewport.height * 0.56 };
    const travel = between(progress, 0.18, 0.40);
    const center = { x: lerp(start.x, end.x, travel), y: lerp(start.y, end.y, travel) };
    return {
      frame: {
        x: center.x - frameWidth / 2,
        y: center.y - frameHeight / 2,
        width: frameWidth,
        height: frameHeight,
      },
      entity: { x: center.x, y: center.y },
    };
  }

  function create(root) {
    const svg = document.getElementById('opening-visuals');
    const frame = document.getElementById('morph-frame');
    const observed = document.getElementById('observed-entity');
    const lines = Array.from(root.querySelectorAll('.opening-line'));
    const frameLayer = document.getElementById('frame-layer');
    const perceptionLayer = document.getElementById('perception-layer');
    const legendLayer = document.getElementById('legend-layer');
    const networkLayer = document.getElementById('network-layer');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function render({ progress, techFade, viewport, ambientTime }) {
      const state = deriveState(progress, reduced.matches);
      const observer = deterministicObserverGeometry(progress, viewport);
      const legendRect = viewport.width <= 800
        ? { x: viewport.width * 0.10, y: viewport.height * 0.32, width: viewport.width * 0.80, height: viewport.height * 0.42 }
        : { x: viewport.width * 0.18, y: viewport.height * 0.24, width: viewport.width * 0.64, height: viewport.height * 0.52 };
      const legendMorph = between(progress, 0.39, 0.49);
      const currentFrame = mixRect(observer.frame, legendRect, legendMorph);

      svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
      frame.setAttribute('x', currentFrame.x.toFixed(2));
      frame.setAttribute('y', currentFrame.y.toFixed(2));
      frame.setAttribute('width', currentFrame.width.toFixed(2));
      frame.setAttribute('height', currentFrame.height.toFixed(2));
      observed.setAttribute('cx', observer.entity.x.toFixed(2));
      observed.setAttribute('cy', observer.entity.y.toFixed(2));

      root.dataset.activeBeat = state.beat;
      root.dataset.clientPhase = state.clientPhase;
      root.style.opacity = techFade;
      lines.forEach((line, index) => {
        line.style.opacity = reduced.matches
          ? String(index === ['world', 'perception', 'emergence', 'concurrency'].indexOf(state.beat) ? 1 : 0)
          : state.lineOpacities[index].toFixed(3);
      });
      const fieldCompression = between(progress, 0.13, 0.20);
      lines[0].style.transform = reduced.matches
        ? 'translateY(-50%)'
        : `translateY(-50%) scale(${lerp(1, 0.42, fieldCompression).toFixed(3)})`;
      lines[1].style.transform = reduced.matches
        ? 'translate(-50%, -50%)'
        : `translate(-50%, -50%) scale(${lerp(0.82, 1, state.perceptionAmount).toFixed(3)})`;
      const frameAmount = Math.max(state.perceptionAmount, state.legendAmount, state.networkAmount);
      frameLayer.style.opacity = (frameAmount * techFade).toFixed(3);
      perceptionLayer.style.opacity = (state.perceptionAmount * techFade).toFixed(3);
      legendLayer.style.opacity = (state.legendAmount * techFade).toFixed(3);
      networkLayer.style.opacity = (state.networkAmount * techFade).toFixed(3);
      svg.style.opacity = String(techFade);
      svg.dataset.ambientPhase = reduced.matches ? '0' : String((ambientTime % 1).toFixed(3));
    }

    return { render };
  }
```

Export both functions at the end:

```js
  window.ParalifeOpening = { deriveState, deterministicObserverGeometry, create };
```

- [ ] **Step 4: Feed observer geometry from the existing simulation**

In `paralife.js`:

1. Remove HUD constants, HUD DOM references, `updateNarrative`, and `updateHud`.
2. Remove dead narrative/observer constants `VISION_START`, `VISION_FULL`, `NARRATIVE_HOLD`, `OBSERVER_DRIFT`, `PANEL_BREAKPOINT`, `OBSERVER_BAND_WIDE`, and `OBSERVER_BAND_NARROW`.
3. Remove dead observer state `observerX`, `observerY`, `observerVX`, `observerVY`, and `observerBand`; remove observer initialization from `seedWorld()`, the complete `moveObserver()` function, its call from `render()`, and the observer-band assignment from `rebuildWorld()`.
4. Keep `VISION_RADIUS`, `OUTSIDE_DIM`, `morphProgress`, `techFade`, and the cellular-automaton simulation.
5. Change `visionAmount()` to use the approved perception interval and fade before concurrency:

```js
function visionAmount() {
  const enter = smoothstep(clamp01((morphProgress - 0.13) / 0.09));
  const leave = smoothstep(clamp01((morphProgress - 0.56) / 0.12));
  return enter * (1 - leave);
}
```

6. Replace the wandering observer lookup with the controller’s deterministic target:

```js
function getNarrativeObserverCell() {
  const geometry = window.ParalifeOpening.deterministicObserverGeometry(
    morphProgress,
    { width: W, height: H },
  );
  return {
    x: clamp(Math.floor((geometry.entity.x - offsetX) / cellPx), 0, cols - 1),
    y: clamp(Math.floor((geometry.entity.y - offsetY) / cellPx), 0, rows - 1),
  };
}
```

In `drawWorld()`, replace `Math.round(observerX/Y)` with `getNarrativeObserverCell()`. This makes the canvas dimming use the same scroll-derived target as the SVG marker.

7. Remove the `drawVisionBox(...)` call and delete the complete `drawVisionBox()` function, including its white entity `fillRect`. The SVG is the sole owner of frame, marker, and label rendering.
8. Construct `openingController` during `init()`:

```js
openingController = window.ParalifeOpening.create(document.getElementById('opening-story'));
```

9. After `drawWorld()` in `render()`, call:

```js
openingController.render({
  progress: morphProgress,
  techFade,
  viewport: { width: W, height: H },
  ambientTime: time,
});
```

10. In the tech-content ScrollTrigger, replace direct narrative/HUD visibility writes with `#opening-story` and `#opening-visuals` visibility; retain the existing header parking logic unchanged.

- [ ] **Step 5: Replace legacy opening CSS with beat 1–3 styles**

In `paralife.css`, remove `#narrative-panel`, `.narrative-line`, and all HUD rules. Add:

```css
#opening-story,
#opening-visuals {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.opening-line {
  position: absolute;
  margin: 0;
  opacity: 0;
  text-shadow: 0 3px 24px rgba(0, 0, 0, 0.95);
  will-change: opacity, transform;
}

.opening-line[data-beat="world"] {
  left: 8vw;
  right: 8vw;
  top: 42%;
  transform: translateY(-50%);
  text-align: center;
  font: 600 clamp(30px, 5vw, 72px)/1.05 system-ui, sans-serif;
  letter-spacing: -0.035em;
  color: rgba(255, 183, 104, 0.94);
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.68) 18% 82%, transparent);
  padding: 0.35em 4vw;
}

.opening-line[data-beat="perception"] {
  left: 50%;
  top: 52%;
  width: min(560px, 70vw);
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: clamp(18px, 2.4vw, 30px);
  color: rgba(220, 205, 255, 0.94);
}

.opening-line[data-beat="emergence"] {
  left: 50%;
  bottom: 16%;
  width: min(720px, 80vw);
  transform: translateX(-50%);
  text-align: center;
  font-size: clamp(18px, 2.4vw, 30px);
  color: rgba(80, 235, 215, 0.94);
}

#morph-frame {
  fill: rgba(0, 20, 22, 0.18);
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 1;
  stroke-dasharray: 5 5;
}

#observed-entity { fill: #fff; filter: drop-shadow(0 0 7px #fff); }
#perception-label,
#legend-layer text,
#network-layer text { font-family: 'Share Tech Mono', monospace; }
```

Do not add a live population counter. The static species names/cycle are sufficient.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440"
```

Expected: 3 tests PASS, including identical frame geometry after forward/reverse scroll.

- [ ] **Step 7: Commit Task 2**

```powershell
git add portfolio/paralife/paralife-opening.js portfolio/paralife/paralife.js portfolio/paralife/paralife.css e2e/tests/paralife-opening.spec.ts
git commit -m "feat(paralife): morph opening story beats"
```

---

### Task 3: Build the deterministic client/server constellation

**Files:**
- Modify: `portfolio/paralife/paralife-opening.js`
- Modify: `portfolio/paralife/paralife.css`
- Modify: `e2e/tests/paralife-opening.spec.ts`

**Interfaces:**
- Consumes: `OpeningController.render` and `OpeningState.clientPhase`.
- Produces: 18 stable `.network-client[data-client-id]` groups and matching `.network-link[data-client-id]` paths.
- Affected clients are fixed as `client-03` and `client-11`; their SVG groups are never replaced between phases.

- [ ] **Step 1: Add failing lifecycle and identity tests**

Append:

```ts
test('client failure lifecycle is scroll-bound and preserves node identity', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await expect(page.locator('.network-client')).toHaveCount(18);

  const sample = page.locator('.network-client[data-client-id="client-03"]');
  const snapshots: Record<string, { transform: string | null; marker: string | null }> = {};

  for (const [progress, phase] of [[0.72, 'lagging'], [0.79, 'stalled'], [0.86, 'reconnecting'], [0.96, 'recovered']] as const) {
    await scrollToProgress(page, progress);
    await expect(page.locator('#opening-story')).toHaveAttribute('data-client-phase', phase);
    await expect(sample).toHaveAttribute('data-state', phase);
    snapshots[phase] = await sample.evaluate((el) => ({
      transform: el.getAttribute('transform'),
      marker: el.getAttribute('data-identity-marker'),
    }));
  }

  expect(new Set(Object.values(snapshots).map((s) => s.transform)).size).toBe(1);
  expect(new Set(Object.values(snapshots).map((s) => s.marker)).size).toBe(1);

  await scrollToProgress(page, 0.79);
  await expect(sample).toHaveAttribute('data-state', 'stalled');
  await scrollToProgress(page, 0.96);
  await expect(page.locator('#recovery-label')).toHaveCSS('opacity', '1');
});

test('healthy clients remain healthy while affected clients stall', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.79);
  await expect(page.locator('.network-client[data-client-id="client-03"]')).toHaveAttribute('data-state', 'stalled');
  await expect(page.locator('.network-client[data-client-id="client-11"]')).toHaveAttribute('data-state', 'stalled');
  await expect(page.locator('.network-client[data-client-id="client-04"]')).toHaveAttribute('data-state', 'healthy');
  await expect(page.locator('#morph-frame')).toHaveAttribute('data-state', 'healthy');
});
```

- [ ] **Step 2: Run the lifecycle tests and verify RED**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440" -g "client|healthy clients"
```

Expected: FAIL because no client groups or phase rendering exist.

- [ ] **Step 3: Generate a deterministic constellation once**

In `create(root)`, build clients before returning the controller:

```js
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const clientLayer = document.getElementById('network-clients');
    const linkLayer = document.getElementById('network-links');
    const clients = Array.from({ length: 18 }, (_, index) => {
      const id = `client-${String(index).padStart(2, '0')}`;
      const group = document.createElementNS(SVG_NS, 'g');
      group.classList.add('network-client');
      group.dataset.clientId = id;
      group.dataset.identityMarker = id;
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.classList.add('client-identity-ring');
      ring.setAttribute('r', '8');
      const node = document.createElementNS(SVG_NS, 'circle');
      node.classList.add('client-node');
      node.setAttribute('r', '4');
      group.append(ring, node);
      clientLayer.appendChild(group);

      const link = document.createElementNS(SVG_NS, 'path');
      link.classList.add('network-link');
      link.dataset.clientId = id;
      linkLayer.appendChild(link);
      return { id, index, group, link };
    });
```

Do not recreate these groups in `render`; stable DOM identity is part of the visual contract.

- [ ] **Step 4: Lay out clients and apply scroll-derived state**

Inside `render`, calculate server/client geometry deterministically:

```js
      const mobile = viewport.width <= 800;
      const server = mobile
        ? { x: viewport.width * 0.50, y: viewport.height * 0.68, width: 112, height: 64 }
        : { x: viewport.width * 0.70, y: viewport.height * 0.52, width: 128, height: 72 };
      const radiusX = mobile ? viewport.width * 0.38 : viewport.width * 0.24;
      const radiusY = mobile ? viewport.height * 0.22 : viewport.height * 0.30;
      const affected = new Set(['client-03', 'client-11']);

      clients.forEach((client) => {
        const angle = -Math.PI / 2 + client.index * (Math.PI * 2 / clients.length);
        const ring = 0.82 + (client.index % 3) * 0.09;
        const x = server.x + Math.cos(angle) * radiusX * ring;
        const y = server.y + Math.sin(angle) * radiusY * ring;
        client.group.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        client.link.setAttribute('d', `M ${server.x.toFixed(2)} ${server.y.toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`);
        client.group.dataset.state = affected.has(client.id) ? state.clientPhase : 'healthy';
        client.link.dataset.state = affected.has(client.id) ? state.clientPhase : 'healthy';
      });
```

Morph `#morph-frame` from `legendRect` into the rectangle centred on `server` during progress `0.60–0.70`, keep `data-state="healthy"`, and set the label at its center. There is no second server rectangle: the persistent shared frame becomes the server node. Derive reconnect-path visibility and `#recovery-label` opacity only from `state.clientPhase`:

- `healthy`: normal links, no warning label.
- `lagging`: affected links dashed and labelled `lagging`.
- `stalled`: affected links hidden; identity rings remain visible; label `connection stalled`.
- `reconnecting`: reconnect path visible and dashed; label `reconnecting`.
- `recovered`: normal links restored; label `same entity restored`.

For `static`, render `client-03` as stalled and `client-11` as recovered simultaneously; all other clients and the server remain healthy.

- [ ] **Step 5: Add non-colour lifecycle styling**

Add CSS:

```css
.network-link {
  fill: none;
  stroke: rgba(0, 204, 204, 0.36);
  stroke-width: 1;
}

.client-node { fill: var(--client-color, #0cc); }
.client-identity-ring { fill: none; stroke: rgba(255, 255, 255, 0.44); stroke-width: 1; }
.network-client[data-state="lagging"] .client-identity-ring { stroke-dasharray: 2 3; stroke-width: 2; }
.network-client[data-state="stalled"] .client-identity-ring { stroke: #f96; stroke-dasharray: 1 3; stroke-width: 2; }
.network-client[data-state="reconnecting"] .client-identity-ring { stroke: #fc6; stroke-dasharray: 5 3; stroke-width: 2; }
.network-client[data-state="recovered"] .client-identity-ring { stroke: #0ea; stroke-width: 2; }
.network-link[data-state="lagging"],
.network-link[data-state="reconnecting"] { stroke-dasharray: 6 5; }
.network-link[data-state="stalled"] { opacity: 0; }
#morph-frame[data-role="server"] { fill: rgba(0, 204, 204, 0.10); stroke: #0cc; stroke-width: 1.5; stroke-dasharray: none; }
#reconnect-path { fill: none; stroke: #fc6; stroke-width: 2; stroke-dasharray: 7 5; }
```

Assign client species colours by `index % 3`; do not use colour to distinguish identity.

- [ ] **Step 6: Run lifecycle tests and verify GREEN**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440" -g "client|healthy clients"
```

Expected: 2 tests PASS; `client-03` retains one transform and identity marker across every phase.

- [ ] **Step 7: Commit Task 3**

```powershell
git add portfolio/paralife/paralife-opening.js portfolio/paralife/paralife.css e2e/tests/paralife-opening.spec.ts
git commit -m "feat(paralife): show client recovery flow"
```

---

### Task 4: Complete responsive, reduced-motion, and handoff behavior

**Files:**
- Modify: `portfolio/paralife/paralife-opening.js`
- Modify: `portfolio/paralife/paralife.js`
- Modify: `portfolio/paralife/paralife.css`
- Modify: `e2e/tests/paralife-opening.spec.ts`
- Modify: `e2e/tests/scroll-sweep-sizing.spec.ts:17-23`

**Interfaces:**
- Consumes: completed `OpeningController`.
- Produces: `#opening-story[data-layout="desktop|mobile"]` and `data-reduced-motion="true|false"` for deterministic inspection.

- [ ] **Step 1: Add failing responsive, reduced-motion, and tech-handoff tests**

Append:

```ts
test('concurrency copy is left of the network on desktop and above it on mobile', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.86);

  const copy = await page.locator('.opening-line[data-beat="concurrency"]').boundingBox();
  const server = await page.locator('#morph-frame[data-role="server"]').boundingBox();
  expect(copy).not.toBeNull();
  expect(server).not.toBeNull();
  if (page.viewportSize()!.width > 800) {
    expect(copy!.x + copy!.width).toBeLessThan(server!.x);
  } else {
    expect(copy!.y + copy!.height).toBeLessThan(server!.y);
  }
});

test('responsive narrative geometry clears chrome and stays inside its visual frame', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  await scrollToProgress(page, 0.30);
  const perceptionCopy = await page.locator('.opening-line[data-beat="perception"]').boundingBox();
  const perceptionFrame = await page.locator('#morph-frame').boundingBox();
  const header = await page.locator('#header-panel').boundingBox();
  const nav = await page.locator('.nav-btn').boundingBox();
  expect(perceptionCopy).not.toBeNull();
  expect(perceptionFrame).not.toBeNull();
  expect(header).not.toBeNull();
  expect(nav).not.toBeNull();
  expect(perceptionCopy!.x).toBeGreaterThanOrEqual(perceptionFrame!.x - 2);
  expect(perceptionCopy!.y).toBeGreaterThanOrEqual(perceptionFrame!.y - 2);
  expect(perceptionCopy!.x + perceptionCopy!.width).toBeLessThanOrEqual(perceptionFrame!.x + perceptionFrame!.width + 2);
  expect(perceptionCopy!.y + perceptionCopy!.height).toBeLessThanOrEqual(perceptionFrame!.y + perceptionFrame!.height + 2);
  expect(perceptionFrame!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 2);
  const frameOverlapsNav = !(
    perceptionFrame!.x + perceptionFrame!.width <= nav!.x ||
    perceptionFrame!.x >= nav!.x + nav!.width ||
    perceptionFrame!.y + perceptionFrame!.height <= nav!.y ||
    perceptionFrame!.y >= nav!.y + nav!.height
  );
  expect(frameOverlapsNav).toBe(false);

  await scrollToProgress(page, 0.50);
  const legend = await page.locator('#legend-layer').boundingBox();
  const legendFrame = await page.locator('#morph-frame').boundingBox();
  expect(legend).not.toBeNull();
  expect(legendFrame).not.toBeNull();
  expect(legend!.x).toBeGreaterThanOrEqual(legendFrame!.x - 2);
  expect(legend!.y).toBeGreaterThanOrEqual(legendFrame!.y - 2);
  expect(legend!.x + legend!.width).toBeLessThanOrEqual(legendFrame!.x + legendFrame!.width + 2);
  expect(legend!.y + legend!.height).toBeLessThanOrEqual(legendFrame!.y + legendFrame!.height + 2);
});

test('reduced motion shows static stalled and recovered examples', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.86);

  await expect(page.locator('#opening-story')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('#opening-story')).toHaveAttribute('data-client-phase', 'static');
  await expect(page.locator('.network-client[data-client-id="client-03"]')).toHaveAttribute('data-state', 'stalled');
  await expect(page.locator('.network-client[data-client-id="client-11"]')).toHaveAttribute('data-state', 'recovered');
  await expect(page.locator('#legend-layer')).not.toContainText(/\d+%|\d+ entities/);
});

test('opening hands off without changing technical content', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToTechSection(page);

  await expect(page.locator('#opening-story')).toBeHidden();
  await expect(page.locator('#opening-visuals')).toBeHidden();
  await expect(page.locator('#tech-content .row-title')).toHaveText([
    'One writer, a thousand readers',
    'The deadlock that taught me Loom',
    "Slow clients don't get to win",
    'Proving a rewrite changed nothing',
  ]);
  await expect(page.locator('#tech-content .row')).toHaveCount(4);
});
```

- [ ] **Step 2: Add Paralife overlays to the shared sizing sweep**

In `e2e/tests/scroll-sweep-sizing.spec.ts`, add:

```ts
  paralife: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#opening-story', '#opening-visuals'],
```

to `TRACKED_ELEMENTS`.

- [ ] **Step 3: Run desktop and mobile focused tests and verify RED**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440" --project="iPhone SE"
```

Expected: responsive/reduced/handoff tests FAIL until layout attributes, media-query behavior, and final visibility are wired.

- [ ] **Step 4: Implement responsive composition and media-query state**

In the controller’s `render`:

```js
      const mobile = viewport.width <= 800;
      root.dataset.layout = mobile ? 'mobile' : 'desktop';
      root.dataset.reducedMotion = reduced.matches ? 'true' : 'false';
```

Add CSS:

```css
.opening-line[data-beat="concurrency"] {
  left: 6vw;
  top: 38%;
  width: min(390px, 34vw);
  font-size: clamp(20px, 2.5vw, 34px);
  color: rgba(255, 255, 255, 0.94);
}

@media (max-width: 800px) {
  .opening-line[data-beat="world"] {
    left: 4vw;
    right: 4vw;
    top: 38%;
    font-size: clamp(28px, 9vw, 46px);
  }

  .opening-line[data-beat="perception"],
  .opening-line[data-beat="emergence"] {
    width: 84vw;
    font-size: clamp(18px, 5vw, 24px);
  }

  .opening-line[data-beat="concurrency"] {
    left: 7vw;
    right: 7vw;
    top: 18%;
    width: auto;
    text-align: center;
    font-size: clamp(19px, 5.4vw, 26px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .opening-line,
  #opening-visuals * {
    transition: opacity 120ms linear;
    animation: none !important;
  }
}
```

Keep 18 nodes on desktop. On widths at or below 800 px, hide `client-12` through `client-17` with `display:none` and do not shrink the remaining identity rings below 16 CSS pixels in diameter.

- [ ] **Step 5: Make reduced-motion rendering static**

In `render`, when `reduced.matches`:

- snap the shared frame to the current beat’s target rectangle instead of interpolating geometry;
- set exactly one narrative line to opacity `1` and all others to `0`;
- set `client-03` to `stalled`, `client-11` to `recovered`, and every other client to `healthy`;
- hide `#reconnect-path` and show a static `stalled · reconnect available` label beside `client-03` plus `same entity restored` beside `client-11`;
- set ambient pulse phase to `0` and do not update it from `ambientTime`.

- [ ] **Step 6: Preserve the existing tech handoff**

In the tech-content ScrollTrigger:

```js
const openingStoryEl = document.getElementById('opening-story');
const openingVisualsEl = document.getElementById('opening-visuals');
```

On update, apply `techFade` through the controller, and at `p >= 1` set both opening elements to `visibility: hidden`; restore `visibility: visible` when scrolling back. Keep these existing behaviors unchanged:

- `titleOverlayEl` scales from `1` to `0.55`;
- `headerPanelEl` changes from fixed to absolute at `self.end + 16`;
- tech rows retain their existing `top 85%` ScrollTriggers;
- footer retains its existing `top 98%` ScrollTrigger.

- [ ] **Step 7: Run focused and shared regression tests**

Run from `e2e/`:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440" --project="iPhone SE"
npm test -- tests/scroll-sweep-sizing.spec.ts tests/viewport-overflow.spec.ts tests/scroll-reachability.spec.ts --project="Desktop 1440" --project="iPhone SE"
```

Expected: all selected tests PASS with no viewport overflow, collapsed overlay, or unreachable tech footer.

- [ ] **Step 8: Commit Task 4**

```powershell
git add portfolio/paralife/paralife-opening.js portfolio/paralife/paralife.js portfolio/paralife/paralife.css e2e/tests/paralife-opening.spec.ts e2e/tests/scroll-sweep-sizing.spec.ts
git commit -m "fix(paralife): harden opening across viewports"
```

---

### Task 5: Verify the finished opening and stop at the agreed boundary

**Files:**
- Verify only; do not expand implementation scope.

**Interfaces:**
- Consumes the completed opening and existing full portfolio suite.
- Produces verification evidence; no new feature surface.

- [ ] **Step 1: Verify the implementation diff is opening-only**

Run from the repository root:

```powershell
git diff HEAD~4 -- portfolio/paralife/index.html
git diff HEAD~4 -- portfolio/paralife/paralife.css portfolio/paralife/paralife.js portfolio/paralife/paralife-opening.js
git diff HEAD~4 -- e2e/tests/paralife-opening.spec.ts e2e/tests/scroll-sweep-sizing.spec.ts
```

Inspect the HTML diff and confirm there are no changed lines between `<div id="tech-content">` and its closing `</div>`.

- [ ] **Step 2: Run the complete Playwright suite**

Run from `e2e/`:

```powershell
npm test
```

Expected: all projects and tests PASS with zero failures.

- [ ] **Step 3: Run a headed visual scroll check at the two boundary viewports**

Run:

```powershell
npm test -- tests/paralife-opening.spec.ts --project="Desktop 1440" --headed
npm test -- tests/paralife-opening.spec.ts --project="iPhone SE" --headed
```

Verify visually while the tests scroll:

- the world does not flash, reseed, or reset;
- beats 1–4 are readable and morph in the intended order;
- reverse scrolling reconstructs earlier states;
- desktop concurrency copy is left of the constellation;
- mobile concurrency copy is above the constellation;
- stalled clients preserve their ring/ID and healthy clients continue pulsing;
- the opening yields cleanly to the unchanged technical rows.

- [ ] **Step 4: Stop**

Report the commands and results. Do not redesign or edit `#tech-content`; that is the next separately reviewed phase.
