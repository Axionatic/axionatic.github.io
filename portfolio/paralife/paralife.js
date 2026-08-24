'use strict';

// Paralife hero: the shared roguelike glyph world. Its dense three-species
// automaton still produces the spiral waves; a presentation mask and layered
// occupants give the portfolio the same visual language as Paralife itself.

// -- World -------------------------------------------------------------------
// Cells are deliberately large. Below ~16px the field reads as static rather
// than as a pattern — the spiral arms are several cells wide, so small cells
// put the structure below the eye's resolving power at a glance.
const CELL_PX = 18;
const CELL_PX_MOBILE = 16;
const MOBILE_BREAKPOINT = 600;
const WORLD_ALPHA = 0.82;
const VIGNETTE = 0.82;           // darkens the edges so panels stay readable

// -- Vision scoping ----------------------------------------------------------
const VISION_RADIUS = 5;         // cells visible around the observed entity
const OUTSIDE_DIM = 0.16;        // brightness of redacted cells when fully scoped
const WINDOWS_MAX = 5;
const VISION_AREA_RATIO = 0.40;  // max fraction of the perception band occupied by frames

// -- Scroll ------------------------------------------------------------------
const SCRUB_SMOOTHING = 0.8;
const RESEED_DEBOUNCE_MS = 150;  // wait for a window drag to settle before reseeding
const SCROLL_HINT_THRESHOLD = 0.03;
const WORLD_FLOOR = 0.18;        // how much world still shows behind the tech rows

const FRAME_DT = 0.016;

// -- State -------------------------------------------------------------------
let canvas, ctx, dpr;
let brightWorldCanvas, dimWorldCanvas;
let worldRasterKey = '';
let W, H;
let cols, rows, cellPx, offsetX, offsetY;
let worldState;
let stepTimer = 0;
let time = 0;
let morphProgress = 0;
let techFade = 1;                // 1 while the world is on show, 0 once tech rows take over
let reseedTimer = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let progressBar, scrollHint, headerPanelEl, narrativePanelEl, openingVisualsEl;
let titleOverlayEl, perceptionLineEl;
let openingController;

// ---------------------------------------------------------------------------
// World helpers
// ---------------------------------------------------------------------------

/** Shortest wrapped distance along one axis. */
function wrapDelta(a, b, span) {
  let d = a - b;
  if (d > span / 2) d -= span;
  if (d < -span / 2) d += span;
  return d;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function visionAmount() {
  const enter = smoothstep(clamp01((morphProgress - 0.10) / 0.06));
  const leave = smoothstep(clamp01((morphProgress - 0.30) / 0.10));
  return enter * (1 - leave);
}

/** Observed-entity windows, snapped to the cell grid so the SVG frames sit
 *  exactly on the undimmed cells. Frames fill no more than the configured
 *  share of the clear band between the header and perception copy, then pack
 *  into the most horizontal centred grid that fits. */
function visionWindows() {
  const winCells = VISION_RADIUS * 2 + 1;
  const winPx = winCells * cellPx;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const headerBottom = headerPanelEl.getBoundingClientRect().bottom;
  const copyTop = perceptionLineEl.getBoundingClientRect().top;
  const band = {
    x: rem,
    y: headerBottom + rem,
    width: Math.max(0, W - rem * 2),
    height: Math.max(0, copyTop - rem - (headerBottom + rem)),
  };
  const bandArea = band.width * band.height;
  const frameArea = winPx * winPx;
  let count = clamp(Math.floor((bandArea * VISION_AREA_RATIO) / frameArea), 1, WINDOWS_MAX);
  let columns = 1;

  while (count > 1) {
    columns = 0;
    for (let candidate = count; candidate >= 1; candidate--) {
      const rows = Math.ceil(count / candidate);
      if (band.width / candidate >= winPx + rem && band.height / rows >= winPx + rem) {
        columns = candidate;
        break;
      }
    }
    if (columns) break;
    count--;
  }
  if (count === 1) columns = 1;

  const rows = Math.ceil(count / columns);
  const slots = [];
  for (let row = 0; row < rows; row++) {
    const items = Math.min(columns, count - row * columns);
    const slotWidth = band.width / items;
    const slotHeight = band.height / rows;
    for (let column = 0; column < items; column++) {
      slots.push({
        centerX: band.x + (column + 0.5) * slotWidth,
        centerY: band.y + (row + 0.5) * slotHeight,
        bounds: {
          x: band.x + column * slotWidth + rem / 2,
          y: band.y + row * slotHeight + rem / 2,
          width: slotWidth - rem,
          height: slotHeight - rem,
        },
      });
    }
  }
  const bandCenterX = band.x + band.width / 2;
  const bandCenterY = band.y + band.height / 2;
  slots.sort((a, b) => {
    const distanceA = Math.hypot(a.centerX - bandCenterX, a.centerY - bandCenterY);
    const distanceB = Math.hypot(b.centerX - bandCenterX, b.centerY - bandCenterY);
    return distanceA - distanceB || a.centerY - b.centerY || a.centerX - b.centerX;
  });
  return slots.map((slot) => {
    const minCx = Math.ceil((slot.bounds.x - offsetX) / cellPx) + VISION_RADIUS;
    const maxCx = Math.floor((slot.bounds.x + slot.bounds.width - winPx - offsetX) / cellPx) + VISION_RADIUS;
    const minCy = Math.ceil((slot.bounds.y - offsetY) / cellPx) + VISION_RADIUS;
    const maxCy = Math.floor((slot.bounds.y + slot.bounds.height - winPx - offsetY) / cellPx) + VISION_RADIUS;
    const cx = clamp(Math.round((slot.centerX - offsetX) / cellPx - 0.5), minCx, maxCx);
    const cy = clamp(Math.round((slot.centerY - offsetY) / cellPx - 0.5), minCy, maxCy);
    return {
      cx, cy,
      bounds: slot.bounds,
      rect: {
        x: offsetX + (cx - VISION_RADIUS) * cellPx,
        y: offsetY + (cy - VISION_RADIUS) * cellPx,
        width: winCells * cellPx,
        height: winCells * cellPx,
      },
      center: {
        x: offsetX + (cx + 0.5) * cellPx,
        y: offsetY + (cy + 0.5) * cellPx,
      },
    };
  });
}

/** Each observed entity roams inside its home slot; its perception window — the
 *  undimmed cutout and the dashed SVG frame — travels with it. Everything snaps
 *  to the cell grid: the dot steps cell to cell, and the frame keeps hugging the
 *  bright cells, so the whole view reads as a discrete sampling of the world. */
function driftEntities(windows) {
  windows.forEach((win, i) => {
    const ampX = Math.max(0, Math.min(win.rect.width * 0.18, (win.bounds.width - win.rect.width) / 2));
    const ampY = Math.max(0, Math.min(win.rect.height * 0.18, (win.bounds.height - win.rect.height) / 2));
    const ex = reducedMotion.matches ? win.center.x
      : win.center.x + Math.sin(time * 0.45 + i * 2.1) * ampX;
    const ey = reducedMotion.matches ? win.center.y
      : win.center.y + Math.cos(time * 0.31 + i * 1.4) * ampY;
    const minCx = Math.ceil((win.bounds.x - offsetX) / cellPx) + VISION_RADIUS;
    const maxCx = Math.floor((win.bounds.x + win.bounds.width - win.rect.width - offsetX) / cellPx) + VISION_RADIUS;
    const minCy = Math.ceil((win.bounds.y - offsetY) / cellPx) + VISION_RADIUS;
    const maxCy = Math.floor((win.bounds.y + win.bounds.height - win.rect.height - offsetY) / cellPx) + VISION_RADIUS;
    const cx = clamp(Math.round((ex - offsetX) / cellPx - 0.5), minCx, maxCx);
    const cy = clamp(Math.round((ey - offsetY) / cellPx - 0.5), minCy, maxCy);
    win.cx = cx;
    win.cy = cy;
    win.rect.x = offsetX + (cx - VISION_RADIUS) * cellPx;
    win.rect.y = offsetY + (cy - VISION_RADIUS) * cellPx;
    win.entity = { x: offsetX + (cx + 0.5) * cellPx, y: offsetY + (cy + 0.5) * cellPx };
  });
}

function drawWorld(windows) {
  const vision = visionAmount();
  // The world only recedes once the tech rows start arriving — driven by the
  // tech-content trigger, not the runway, so there is no blank stretch between.
  const globalFade = lerp(WORLD_FLOOR, 1, techFade);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (globalFade <= 0.001) return;

  rebuildWorldRasters();

  ctx.save();
  ctx.globalAlpha = globalFade * (1 - vision);
  ctx.drawImage(brightWorldCanvas, 0, 0, W, H);
  if (vision > 0) {
    ctx.globalAlpha = globalFade * vision;
    ctx.drawImage(dimWorldCanvas, 0, 0, W, H);

    // Restore the bright raster inside each moving perception window. Glyphs
    // are cached by world revision; only these cheap image clips move per frame.
    for (const window of windows) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(window.rect.x, window.rect.y, window.rect.width, window.rect.height);
      ctx.clip();
      ctx.globalAlpha = globalFade * vision;
      ctx.drawImage(brightWorldCanvas, 0, 0, W, H);
      ctx.restore();
    }
  }
  ctx.restore();

  drawVignette();
}

function prepareRasterCanvas(existing) {
  const raster = existing || document.createElement('canvas');
  if (raster.width !== W * dpr || raster.height !== H * dpr) {
    raster.width = W * dpr;
    raster.height = H * dpr;
  }
  return raster;
}

function paintWorldRaster(raster, alpha) {
  const rasterCtx = raster.getContext('2d');
  rasterCtx.setTransform(1, 0, 0, 1, 0, 0);
  rasterCtx.clearRect(0, 0, raster.width, raster.height);
  rasterCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  window.ParalifeGlyphWorld.renderWorld(rasterCtx, worldState, {
    cellPx,
    originX: offsetX,
    originY: offsetY,
    morph: 1,
    alpha,
    clear: false,
  });
}

function rebuildWorldRasters() {
  const profileId = worldState.profile && worldState.profile.id || 'world';
  const key = [W, H, dpr, cols, rows, cellPx, profileId, worldState.revision].join(':');
  if (key === worldRasterKey) return;

  brightWorldCanvas = prepareRasterCanvas(brightWorldCanvas);
  dimWorldCanvas = prepareRasterCanvas(dimWorldCanvas);
  paintWorldRaster(brightWorldCanvas, WORLD_ALPHA);
  paintWorldRaster(dimWorldCanvas, WORLD_ALPHA * OUTSIDE_DIM);
  worldRasterKey = key;
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

  const stepInterval = window.ParalifeGlyphWorld.HERO_PROFILE.stepInterval;
  if (stepTimer >= stepInterval) {
    stepTimer -= stepInterval;
    window.ParalifeGlyphWorld.advanceWorld(worldState);
  }

  const windows = visionWindows();
  driftEntities(windows);
  drawWorld(windows);
  openingController.render({
    progress: morphProgress,
    techFade,
    viewport: { width: W, height: H },
    windows,
    ambientTime: time,
  });

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/** Cheap: canvas bitmap only. Safe to run on every resize event. */
function resizeCanvas() {
  // clientWidth, not innerWidth: the fixed SVG overlay is sized excluding the
  // scrollbar, and its viewBox must match or every shape lands slightly off.
  W = document.documentElement.clientWidth;
  H = document.documentElement.clientHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Grid metrics, and a reseed only if the grid actually changed shape. World
 *  creation performs settling passes, so it must not run on every resize event. */
function rebuildWorld() {
  cellPx = W < MOBILE_BREAKPOINT ? CELL_PX_MOBILE : CELL_PX;
  const nextCols = Math.ceil(W / cellPx) + 1;
  const nextRows = Math.ceil(H / cellPx) + 1;
  offsetX = (W - nextCols * cellPx) / 2;
  offsetY = (H - nextRows * cellPx) / 2;

  if (worldState && nextCols === cols && nextRows === rows) return;

  cols = nextCols;
  rows = nextRows;
  worldState = window.ParalifeGlyphWorld.createWorld({
    cols,
    rows,
    seed: 'paralife-world',
    profile: window.ParalifeGlyphWorld.HERO_PROFILE,
  });
  worldRasterKey = '';
}

function resize() {
  resizeCanvas();
  rebuildWorld();
}

function init() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  document.getElementById('canvas-container').appendChild(canvas);

  progressBar = document.getElementById('progress-bar');
  scrollHint = document.getElementById('scroll-hint');
  headerPanelEl = document.getElementById('header-panel');
  narrativePanelEl = document.getElementById('opening-story');
  perceptionLineEl = narrativePanelEl.querySelector('.opening-line[data-beat="perception"]');
  narrativePanelEl.dataset.visionAreaRatio = String(VISION_AREA_RATIO);
  openingVisualsEl = document.getElementById('opening-visuals');
  titleOverlayEl = document.getElementById('title-overlay');
  openingController = window.ParalifeOpening.create(narrativePanelEl);

  resize();
  // The canvas follows the window immediately; the expensive world rebuild
  // waits for the drag to settle. Grid metrics only change in rebuildWorld().
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

  initTechAnimations();
  render();
}

// ---------------------------------------------------------------------------
// Tech-section SVG animations. Each SVG's markup is its resting/reduced-motion
// state; the timelines reset it with .set() and loop.
// ---------------------------------------------------------------------------
function initArchAnimation() {
  const dot = document.getElementById('arch-dot');
  const leaves = [0, 1, 2].map(i => document.getElementById('arch-d' + i));
  const queues = [0, 1, 2].map(i => document.getElementById('arch-q' + i));
  const leafX = [100, 250, 400];

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });
  tl.fromTo('#arch-hub-glow', { opacity: 1 }, { opacity: 0.3, duration: 0.5 }, 0);
  tl.set(dot, { attr: { cy: 46 }, opacity: 1 }, 0);
  tl.to(dot, { attr: { cy: 274 }, duration: 1.2, ease: 'none' }, 0);
  tl.to(dot, { opacity: 0, duration: 0.1 }, 1.2);
  leaves.forEach((d, i) => {
    tl.set(d, { attr: { cx: 250, cy: 274 }, opacity: 1 }, 1.2);
    tl.to(d, { attr: { cx: leafX[i], cy: 300 }, duration: 0.4, ease: 'power1.in' }, 1.2);
    tl.to(d, { opacity: 0, duration: 0.1 }, 1.6);
    tl.fromTo(queues[i], { attr: { width: 0 } }, { attr: { width: 60 }, duration: 0.3, ease: 'power2.out' }, 1.6);
    tl.to(queues[i], { attr: { width: 0 }, duration: 0.4, ease: 'power2.in' }, 1.9 + i * 0.05);
  });
}

function initPinAnimation() {
  const chip = id => document.getElementById(id);
  const a = ['pin-a0', 'pin-a1', 'pin-a2'].map(chip);
  const b = ['pin-b0', 'pin-b1', 'pin-b2'].map(chip);
  const countA = { v: 16 };
  const countEl = document.getElementById('pin-count-a');

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });

  // Reset: all chips queued on the right, rails clean, verdicts hidden.
  // GSAP x/y on SVG <g> are absolute translate values.
  tl.set([...a, ...b], { opacity: 1 });
  a.forEach((c, i) => tl.set(c, { x: 340 + i * 52, y: 52 }));
  b.forEach((c, i) => tl.set(c, { x: 340 + i * 52, y: 190 }));
  tl.set('#pin-a0 rect', { fill: 'rgba(190,140,255,0.15)', stroke: 'rgba(190,140,255,0.6)' });
  tl.set('#pin-rail-a', { fill: 'rgba(0,204,204,0.12)', stroke: 'rgba(0,204,204,0.5)' });
  tl.set(['#pin-verdict-a', '#pin-verdict-b'], { opacity: 0 });
  tl.call(() => { countA.v = 16; countEl.textContent = '16'; });

  // Lane A: first VT mounts, blocks, pins the carrier; the rest never mount.
  tl.to(a[0], { x: 40, duration: 0.6, ease: 'power2.out' }, 0);
  tl.to(a[1], { x: 340, duration: 0.6, ease: 'power2.out' }, 0);
  tl.to(a[2], { x: 392, duration: 0.6, ease: 'power2.out' }, 0);
  tl.to('#pin-a0 rect', { fill: 'rgba(255,102,51,0.35)', stroke: '#f96', duration: 0.3 }, 0.9);
  tl.to('#pin-rail-a', { fill: 'rgba(255,102,51,0.18)', stroke: 'rgba(255,102,51,0.7)', duration: 0.3 }, 0.9);
  tl.to([a[1], a[2]], { x: '-=6', duration: 0.12, yoyo: true, repeat: 5, ease: 'power1.inOut' }, 1.3);
  tl.to([a[1], a[2]], { opacity: 0.4, duration: 0.4 }, 1.3);
  tl.to('#pin-verdict-a', { opacity: 1, duration: 0.3 }, 1.3);
  tl.to(countA, {
    v: 0, duration: 1.5, ease: 'none',
    onUpdate: () => { countEl.textContent = Math.round(countA.v); }
  }, 1.3);

  // Lane B: each VT mounts, blocks, unmounts (parks above the rail), next mounts.
  b.forEach((c, i) => {
    const t = i * 0.9;
    tl.to(c, { x: 40, duration: 0.5, ease: 'power2.out' }, t);
    for (let j = i + 1; j < 3; j++) tl.to(b[j], { x: 340 + (j - i - 1) * 52, duration: 0.5, ease: 'power2.out' }, t);
    tl.to(c, { x: 40 + i * 52, y: 128, opacity: 0.35, duration: 0.4, ease: 'power2.in' }, t + 0.6);
  });
  tl.to('#pin-verdict-b', { opacity: 1, duration: 0.3 }, 1.3);
}

function initBackpressureAnimation() {
  const grace = { v: 10 };
  const graceEl = document.getElementById('bp-grace');
  const badge = document.getElementById('bp-badge');
  const badgeText = document.getElementById('bp-badge-text');
  const setBadge = (state) => () => {
    badge.setAttribute('class', 'bp-badge bp-badge-' + state);
    badgeText.textContent = state;
  };
  const setGrace = () => { graceEl.textContent = 'grace: ' + Math.round(grace.v) + ' ticks'; };

  function build(reconnect) {
    const tl = gsap.timeline({ onComplete: () => build(!reconnect) });
    // Reset: draining fine, entity alive.
    tl.set('#bp-queue', { attr: { height: 30, y: 178 }, fill: '#0cc' });
    tl.set('#bp-entity', { opacity: 1 });
    tl.set('#bp-ring', { opacity: 0, strokeDashoffset: 0 });
    tl.set('#bp-token', { opacity: 0, attr: { cx: 330, cy: 120 } });
    tl.call(() => { grace.v = 10; setGrace(); });
    tl.call(setBadge('active'));

    // Tick frames arrive; slow socket — queue climbs to the cap.
    tl.fromTo('#bp-frame', { attr: { x: 66 }, opacity: 1 }, { attr: { x: 150 }, opacity: 0.2, duration: 0.45, ease: 'none', repeat: 4 }, 0);
    tl.to('#bp-queue', { attr: { height: 176, y: 32 }, duration: 2.2, ease: 'power1.in' }, 0);

    // Full: session stalls, entity dims, grace countdown runs.
    tl.to('#bp-queue', { fill: '#f96', duration: 0.3 }, 2.2);
    tl.call(setBadge('stalled'), null, 2.2);
    tl.to('#bp-entity', { opacity: 0.35, duration: 0.3 }, 2.2);
    tl.to('#bp-ring', { opacity: 1, duration: 0.2 }, 2.2);
    const countdown = reconnect ? 1.2 : 2.4;
    tl.to('#bp-ring', { strokeDashoffset: reconnect ? 75 : 151, duration: countdown, ease: 'none' }, 2.5);
    tl.to(grace, { v: reconnect ? 5 : 0, duration: countdown, ease: 'none', onUpdate: setGrace }, 2.5);

    const t = 2.5 + countdown;
    if (reconnect) {
      // Resume token rebinds the client to the same entity; queue drains.
      tl.to('#bp-token', { opacity: 1, duration: 0.1 }, t);
      tl.to('#bp-token', { attr: { cx: 430, cy: 120 }, duration: 0.5, ease: 'power2.inOut' }, t);
      tl.to('#bp-token', { opacity: 0, duration: 0.1 }, t + 0.5);
      tl.to('#bp-entity', { opacity: 1, duration: 0.2 }, t + 0.5);
      tl.to('#bp-ring', { opacity: 0, duration: 0.3 }, t + 0.5);
      tl.call(setBadge('active'), null, t + 0.5);
      tl.to('#bp-queue', { attr: { height: 30, y: 178 }, fill: '#0cc', duration: 0.6, ease: 'power2.out' }, t + 0.5);
      tl.to({}, { duration: 1.0 });
    } else {
      // Grace expires: entity dropped.
      tl.to('#bp-entity', { opacity: 0, duration: 0.4 }, t);
      tl.to('#bp-ring', { opacity: 0, duration: 0.4 }, t);
      tl.call(setBadge('expired'), null, t);
      tl.to({}, { duration: 1.2 });
    }
  }
  build(true);
}

function initTechAnimations() {
  if (reducedMotion.matches) return;
  initArchAnimation();
  initPinAnimation();
  initBackpressureAnimation();
}

document.addEventListener('DOMContentLoaded', init);
