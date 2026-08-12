'use strict';

// Paralife hero: a toroidal cyclic cellular automaton with three species in a
// rock-paper-scissors cycle — the same spiral-wave behaviour the server exists
// to produce. Scrolling narrows the world down to what a single entity can
// actually see, then hands over to the tech rows.

// -- World -------------------------------------------------------------------
// Cells are deliberately large. Below ~16px the field reads as static rather
// than as a pattern — the spiral arms are several cells wide, so small cells
// put the structure below the eye's resolving power at a glance.
const CELL_PX = 16;              // target cell size in CSS pixels
const CELL_PX_MOBILE = 12;
const MOBILE_BREAKPOINT = 600;
const STEP_INTERVAL = 0.11;      // seconds between automaton steps
const BEAT_THRESHOLD = 3;        // predator neighbours needed to convert a cell
const DOMAIN_PATCHES = 10;       // broad single-species regions the fronts cut across
const DOMAIN_R = 14;
const SPIRAL_CORES = 7;          // three-species defects; each winds into a spiral
const CORE_R = 9;
const SETTLE_STEPS = 90;         // run before first paint so the page opens mid-pattern
const CELL_ALPHA = 0.30;         // the world is a backdrop, not the subject
const VIGNETTE = 0.82;           // darkens the edges so panels stay readable
const TAU = Math.PI * 2;

// Three species in a cycle: 0 eats 1, 1 eats 2, 2 eats 0.
const SPECIES = [
  { name: 'catalyst', rgb: [0, 204, 204] },
  { name: 'membrane', rgb: [190, 140, 255] },
  { name: 'spore',    rgb: [255, 160, 70] },
];
const SPECIES_COUNT = SPECIES.length;

// -- Vision scoping ----------------------------------------------------------
const VISION_RADIUS = 5;         // cells visible around the observed entity
const OUTSIDE_DIM = 0.16;        // brightness of redacted cells when fully scoped

// -- Scroll ------------------------------------------------------------------
const SCRUB_SMOOTHING = 0.8;
const RESEED_DEBOUNCE_MS = 150;  // wait for a window drag to settle before reseeding
const SCROLL_HINT_THRESHOLD = 0.03;
const WORLD_FLOOR = 0.18;        // how much world still shows behind the tech rows

const FRAME_DT = 0.016;

// -- State -------------------------------------------------------------------
let canvas, ctx, dpr;
let W, H;
let cols, rows, cellPx, offsetX, offsetY;
let grid, next;
let stepTimer = 0;
let time = 0;
let morphProgress = 0;
let techFade = 1;                // 1 while the world is on show, 0 once tech rows take over
let reseedTimer = null;
let rng;

let progressBar, scrollHint, headerPanelEl, narrativePanelEl, openingVisualsEl;
let titleOverlayEl;
let openingController;

// ---------------------------------------------------------------------------
// World helpers
// ---------------------------------------------------------------------------

/** Toroidal index — every edge wraps to the opposite side. */
function idx(x, y) {
  const wx = x < 0 ? x + cols : x >= cols ? x - cols : x;
  const wy = y < 0 ? y + rows : y >= rows ? y - rows : y;
  return wy * cols + wx;
}

/** Shortest wrapped distance along one axis. */
function wrapDelta(a, b, span) {
  let d = a - b;
  if (d > span / 2) d -= span;
  if (d < -span / 2) d += span;
  return d;
}

function seedWorld() {
  grid = new Uint8Array(cols * rows);
  next = new Uint8Array(cols * rows);

  // idx() wraps a single period, so no seed may reach further than half the
  // grid or its writes fall outside the array. Caps the radii on tiny screens.
  const maxR = (Math.min(cols, rows) >> 1) - 1;

  for (let i = 0; i < grid.length; i++) {
    grid[i] = (rng() * SPECIES_COUNT) | 0;
  }

  // Broad single-species domains. Per-cell noise on its own burns down into
  // fine turbulence; domains leave long clean fronts for the waves to run along.
  for (let p = 0; p < DOMAIN_PATCHES; p++) {
    const cx = (rng() * cols) | 0;
    const cy = (rng() * rows) | 0;
    const species = (rng() * SPECIES_COUNT) | 0;
    const r = Math.min(Math.round(DOMAIN_R * (0.6 + rng() * 0.8)), maxR);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        grid[idx(cx + dx, cy + dy)] = species;
      }
    }
  }

  // A point where all three species meet is a topological defect: the
  // rock-paper-scissors cycle around it cannot resolve, so it winds into a
  // spiral. Seeding the defects directly is what makes the arms appear —
  // random noise nucleates them only rarely, and never in the first seconds.
  for (let p = 0; p < SPIRAL_CORES; p++) {
    const cx = (rng() * cols) | 0;
    const cy = (rng() * rows) | 0;
    const chirality = rng() < 0.5 ? 1 : -1;   // both handednesses, so it isn't uniform
    const phase = rng() * TAU;
    const cr = Math.min(CORE_R, maxR);
    for (let dy = -cr; dy <= cr; dy++) {
      for (let dx = -cr; dx <= cr; dx++) {
        if (dx * dx + dy * dy > cr * cr) continue;
        const a = Math.atan2(dy, dx) * chirality + phase;
        const t = ((a % TAU) + TAU) % TAU;
        grid[idx(cx + dx, cy + dy)] = ((t / TAU) * SPECIES_COUNT) | 0;
      }
    }
  }

  // Let the arms wind before the first frame, so the page never opens on noise.
  for (let i = 0; i < SETTLE_STEPS; i++) step();

}

/** One automaton step: a cell falls to the species that eats it, once enough
 *  of its neighbours are that species. Wrapping makes the world a torus. */
function step() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const here = grid[idx(x, y)];
      const predator = (here + SPECIES_COUNT - 1) % SPECIES_COUNT;
      let count = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (grid[idx(x + dx, y + dy)] === predator) count++;
        }
      }

      next[idx(x, y)] = count >= BEAT_THRESHOLD ? predator : here;
    }
  }

  const swap = grid;
  grid = next;
  next = swap;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function visionAmount() {
  const enter = smoothstep(clamp01((morphProgress - 0.13) / 0.09));
  const leave = smoothstep(clamp01((morphProgress - 0.56) / 0.12));
  return enter * (1 - leave);
}

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

function drawWorld() {
  const vision = visionAmount();
  // The world only recedes once the tech rows start arriving — driven by the
  // tech-content trigger, not the runway, so there is no blank stretch between.
  const globalFade = lerp(WORLD_FLOOR, 1, techFade);
  const observer = getNarrativeObserverCell();
  const ox = observer.x;
  const oy = observer.y;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (globalFade <= 0.001) return;

  // No gap between cells. Grid lines made the field read as a spreadsheet and
  // broke up the wave fronts, which are the whole point of the image.
  const size = cellPx;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const species = SPECIES[grid[idx(x, y)]];

      // Cells outside the observed entity's reach are dimmed, not deleted —
      // the server redacts them from that entity's frame the same way.
      const dx = Math.abs(wrapDelta(x, ox, cols));
      const dy = Math.abs(wrapDelta(y, oy, rows));
      const inside = Math.max(dx, dy) <= VISION_RADIUS;
      const dim = inside ? 1 : lerp(1, OUTSIDE_DIM, vision);

      const alpha = CELL_ALPHA * dim * globalFade;
      if (alpha < 0.012) continue;

      const rgb = species.rgb;
      ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
      ctx.fillRect(offsetX + x * cellPx, offsetY + y * cellPx, size, size);
    }
  }

  drawVignette();
}

/** Radial darkening so the header and side panels always have contrast. */
function drawVignette() {
  const g = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.10,
    W / 2, H / 2, Math.max(W, H) * 0.66
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,' + VIGNETTE + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function render() {
  time += FRAME_DT;
  stepTimer += FRAME_DT;

  if (stepTimer >= STEP_INTERVAL) {
    stepTimer -= STEP_INTERVAL;
    step();
  }

  drawWorld();
  openingController.render({
    progress: morphProgress,
    techFade,
    viewport: { width: W, height: H },
    ambientTime: time,
  });

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/** Cheap: canvas bitmap only. Safe to run on every resize event. */
function resizeCanvas() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Grid metrics, and a reseed only if the grid actually changed shape.
 *  seedWorld() runs SETTLE_STEPS full-grid passes — tens of milliseconds on a
 *  large display — so it must not run on every resize event. */
function rebuildWorld() {
  cellPx = W < MOBILE_BREAKPOINT ? CELL_PX_MOBILE : CELL_PX;
  const nextCols = Math.ceil(W / cellPx) + 1;
  const nextRows = Math.ceil(H / cellPx) + 1;
  offsetX = (W - nextCols * cellPx) / 2;
  offsetY = (H - nextRows * cellPx) / 2;

  if (grid && nextCols === cols && nextRows === rows) return;

  cols = nextCols;
  rows = nextRows;
  seedWorld();
}

function resize() {
  resizeCanvas();
  rebuildWorld();
}

function init() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  document.getElementById('canvas-container').appendChild(canvas);

  rng = alea('paralife-world');

  progressBar = document.getElementById('progress-bar');
  scrollHint = document.getElementById('scroll-hint');
  headerPanelEl = document.getElementById('header-panel');
  narrativePanelEl = document.getElementById('opening-story');
  openingVisualsEl = document.getElementById('opening-visuals');
  titleOverlayEl = document.getElementById('title-overlay');
  openingController = window.ParalifeOpening.create(narrativePanelEl);

  resize();
  // The canvas follows the window immediately; the expensive reseed waits for
  // the drag to settle. Grid metrics only change inside rebuildWorld(), so the
  // world stays consistent with `grid` in between.
  window.addEventListener('resize', () => {
    resizeCanvas();
    clearTimeout(reseedTimer);
    reseedTimer = setTimeout(rebuildWorld, RESEED_DEBOUNCE_MS);
  });

  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: '#runway',
    start: 'top top',
    end: 'bottom bottom',
    scrub: SCRUB_SMOOTHING,
    onUpdate: (self) => {
      morphProgress = self.progress;
      progressBar.style.width = (morphProgress * 100) + '%';

      // Hide outright as well as fade — opacity alone can be left mid-transition
      // when the scrub jumps a long way in one frame.
      const showHint = morphProgress < SCROLL_HINT_THRESHOLD;
      scrollHint.style.opacity = showHint ? 1 : 0;
      scrollHint.style.visibility = showHint ? 'visible' : 'hidden';
    }
  });

  const techContent = document.getElementById('tech-content');
  if (techContent) {
    ScrollTrigger.create({
      trigger: techContent,
      start: 'top 90%',
      end: 'top 30%',
      scrub: SCRUB_SMOOTHING,
      onUpdate: (self) => {
        const p = self.progress;

        techFade = 1 - p;
        narrativePanelEl.style.opacity = techFade;

        titleOverlayEl.style.transform = 'scale(' + lerp(1, 0.55, p) + ')';

        const vis = p >= 1 ? 'hidden' : 'visible';
        narrativePanelEl.style.visibility = vis;
        openingVisualsEl.style.visibility = vis;

        // Once fully scrolled in, let the header scroll away with the content.
        if (p >= 1) {
          // Park at the trigger's own end rather than the live scroll
          // position: scrollY can overshoot `end` between two onUpdate calls
          // on a fast or momentum scroll, which stranded the panel in the
          // middle of the tech rows. Assigned on every update, not just on
          // the transition, so it survives a resize recomputing `end`.
          headerPanelEl.style.position = 'absolute';
          headerPanelEl.style.top = (self.end + 16) + 'px';
        } else {
          headerPanelEl.style.position = 'fixed';
          headerPanelEl.style.top = lerp(H * 0.04, 16, p) + 'px';
        }
      }
    });

    const techRows = techContent.querySelectorAll('.row');
    for (let i = 0; i < techRows.length; i++) {
      gsap.fromTo(techRows[i],
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: techRows[i],
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }

    const techFooter = techContent.querySelector('.tech-footer');
    if (techFooter) {
      gsap.fromTo(techFooter,
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: techFooter,
            start: 'top 98%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }
  }

  render();
}

document.addEventListener('DOMContentLoaded', init);
