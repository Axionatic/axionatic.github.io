'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 1200;
const FRAME_DT = 0.016;

// Unhappy faces emitted by departing boxes
const UNHAPPY_FACES = ['😡', '☹️', '😭', '😖', '😞'];
const HAPPY_FACES = ['😃', '🤩', '😄', '😍', '😊'];

// Shape palette (warm earthy)
const SHAPE_COLORS = ['#6a4', '#e85', '#d44', '#8c6', '#da5'];
const GOOD_SHAPE_COLORS = ['#0cc', '#0af', '#08f', '#0ea', '#4df'];

// Background
const BG_COLOR = [12, 8, 5];
const GOOD_BG_COLOR = [5, 8, 18];

// Box animation timing (seconds)
const ENTER_DUR = 0.9;
const FILL_DUR = 1.8;
const PAUSE_DUR = 0.7;
const EXIT_DUR = 1.3;
const GAP_DUR = 0.5;
const SCENE_DUR = ENTER_DUR + FILL_DUR + PAUSE_DUR + EXIT_DUR + GAP_DUR;

// Box sizing (fraction of min(W, H))
const BOX_W_FRAC = 0.22;
const BOX_H_FRAC = 0.24;
const BOX_CY_FRAC = 0.50;
const SHAPE_R_FRAC = 0.028;
const GIANT_R_FRAC = 0.14;
const SHAPE_SPACING_FRAC = 2.8;

// Scene definitions
const SCENES = [
  { count: 2,  types: 'mixed',    symbol: null,          giant: false },
  { count: 6,  types: 'triangle', symbol: 'no-triangle', giant: false },
  { count: 16, types: 'mixed',    symbol: null,          giant: false },
  { count: 1,  types: 'circle',   symbol: null,          giant: true  },
  { count: 6,  types: 'square',   symbol: 'triangle',    giant: false },
];

// Bad/good sequential transition thresholds
const BAD_FADE_START = 0.28;
const BAD_FADE_DUR = 0.04;
const GOOD_FADE_START = 0.34;
const GOOD_FADE_DUR = 0.04;
const BG_TRANSITION_START = 0.28;
const BG_TRANSITION_END = 0.38;

// ILP Matrix animation
const MATRIX_ITEMS = ['🍎', '🍌', '🥕', '🥬', '🥔', '🍊', '🍇', '🥒'];
const MATRIX_BOXES = ['B1', 'B2', 'B3', 'B4', 'B5'];
const MATRIX_MORPH_START = 0.50;
const MATRIX_FADE_RANGE = 0.15;
const SOLVE_STEP_DUR = 0.0875;
const SOLVE_TRY_DUR = 0.045;
const SOLVE_PAUSE_DUR = 0.625;
const SOLVE_CONSTRAINT_DELAY = 0.1;
const SOLVE_BOX_MIN = 5;
const SOLVE_BOX_MAX = 7;
const SOLVE_BOX_SUM_CAP = 30;
const SOLVE_QTY_MIN = 15;
const SOLVE_QTY_MAX = 25;
const COUNT_UP_DUR = 0.3;

const SOLVE_CONSTRAINT_LABELS = ['value', 'diversity', 'balance'];

// Narrative keyframes: [morphProgress, offsetX_fraction, opacity]
// Lines slide in from right (x=1), settle center (x=0), exit left (x=-1)
const NARRATIVE_SLIDE_PX = 300;
const LINE_KEYFRAMES = [
  [[0, 0, 1], [0.07, 0, 1], [0.12, -1, 0]],
  [[0.07, 1, 0], [0.12, 0, 1], [0.31, 0, 1], [0.36, -1, 0]],
  [[0.31, 1, 0], [0.36, 0, 1], [0.55, 0, 1], [0.60, -1, 0]],
  [[0.55, 1, 0], [0.60, 0, 1], [0.80, 0, 1], [0.85, -1, 0]],
  [[0.80, 1, 0], [0.85, 0, 1], [1.0, 0, 1]],
];

// Scroll
const SCRUB_SMOOTHING = 0.8;
const SCROLL_HINT_THRESHOLD = 0.03;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function easeInCubic(t) { return t * t * t; }
function easeOutBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
}

function interpolateKeyframes(kf, t) {
  if (t <= kf[0][0]) return { y: kf[0][1], op: kf[0][2] };
  const last = kf[kf.length - 1];
  if (t >= last[0]) return { y: last[1], op: last[2] };
  for (let i = 0; i < kf.length - 1; i++) {
    if (t >= kf[i][0] && t < kf[i + 1][0]) {
      const p = (t - kf[i][0]) / (kf[i + 1][0] - kf[i][0]);
      return { y: lerp(kf[i][1], kf[i + 1][1], p), op: lerp(kf[i][2], kf[i + 1][2], p) };
    }
  }
  return { y: last[1], op: last[2] };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let canvas, ctx, dpr;
let W, H;
let morphProgress = 0;
let time = 0;
let techProgress = 0;
let progressBar, scrollHint;
let narrativeLines = [];
let headerPanelEl;
let titleOverlayEl, narrativeEl;
let techFade = 1;
let boxYOffset = 0;

// Box animation state
let animTime = 0;
let sceneIdx = 0;
let sceneStart = 0;
let shapes = [];
let prevTimestamp = 0;

// Good-state box animation
let goodAnimTime = 0;
let goodSceneStart = 0;
let goodShapes = [];
let goodSceneIdx = 0;

// ILP matrix state
let solveTime = 0;
let solveCycleIdx = 0;
let currentSolveSteps = [];
let currentQuantities = [];

// ---------------------------------------------------------------------------
// Box animation: shape generation
// ---------------------------------------------------------------------------
function generateSceneShapes() {
  const scene = SCENES[sceneIdx];
  const rng = alea('mystery-' + sceneIdx);
  shapes = [];

  const dim = Math.min(W, H);
  const bh = dim * BOX_H_FRAC;
  const sr = dim * SHAPE_R_FRAC;
  const rimY = -bh / 2;

  if (scene.giant) {
    shapes.push({
      type: 'circle',
      color: SHAPE_COLORS[2],
      size: dim * GIANT_R_FRAC,
      targetX: 0,
      targetY: -(bh * 0.25),
      delay: 0,
      overflow: false,
      falling: false,
      velY: 0,
      fallX: 0, fallY: 0, fallOpacity: 1,
    });
    return;
  }

  const count = scene.count;
  const cols = count <= 4 ? count : 3;
  const spacing = sr * SHAPE_SPACING_FRAC;
  const bw = dim * BOX_W_FRAC;

  for (let i = 0; i < count; i++) {
    let type;
    if (scene.types === 'mixed') {
      type = ['circle', 'triangle', 'square'][Math.floor(rng() * 3)];
    } else {
      type = scene.types;
    }
    const color = SHAPE_COLORS[Math.floor(rng() * SHAPE_COLORS.length)];

    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(count - row * cols, cols);

    const tx = (col - (rowCount - 1) / 2) * spacing;
    const ty = bh / 2 - sr * 1.5 - row * spacing;
    const isOverflow = ty < rimY;

    // Overflow shapes bounce off the rim and land beside the box
    let bounceTargetX = 0;
    if (isOverflow) {
      // Land on either side of the box, spread out randomly
      const side = (rng() < 0.5) ? -1 : 1;
      bounceTargetX = side * (bw / 2 + sr * 1.5 + rng() * sr * 3);
    }

    shapes.push({
      type: type,
      color: color,
      size: sr,
      targetX: tx,
      targetY: ty,
      delay: i / count,
      overflow: isOverflow,
      bounceTargetX: bounceTargetX,
      falling: false,
      velY: 0,
      fallX: 0, fallY: 0, fallOpacity: 1,
    });
  }
}

// ---------------------------------------------------------------------------
// Good-state: shape generation (9 shapes, even mix, blue-green)
// ---------------------------------------------------------------------------
function generateGoodShapes() {
  const rng = alea('mystery-good-' + goodSceneIdx);
  goodShapes = [];
  const dim = Math.min(W, H);
  const bh = dim * BOX_H_FRAC;
  const sr = dim * SHAPE_R_FRAC;
  const count = 9;
  const cols = 3;
  const spacing = sr * SHAPE_SPACING_FRAC;
  const types = ['circle', 'triangle', 'square'];

  for (let i = 0; i < count; i++) {
    const type = types[i % 3];
    const color = GOOD_SHAPE_COLORS[Math.floor(rng() * GOOD_SHAPE_COLORS.length)];
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(count - row * cols, cols);
    const tx = (col - (rowCount - 1) / 2) * spacing;
    const ty = bh / 2 - sr * 1.5 - row * spacing;

    goodShapes.push({
      type: type,
      color: color,
      size: sr,
      targetX: tx,
      targetY: ty,
      delay: i / count,
      overflow: false,
      falling: false,
      velY: 0,
      fallX: 0, fallY: 0, fallOpacity: 1,
    });
  }
}

// ---------------------------------------------------------------------------
// Box animation: drawing helpers
// ---------------------------------------------------------------------------
function drawShape(x, y, size, type, color, opacity) {
  if (opacity <= 0) return;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;

  if (type === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.866, y + size * 0.5);
    ctx.lineTo(x + size * 0.866, y + size * 0.5);
    ctx.closePath();
    ctx.fill();
  } else {
    const s = size * 0.85;
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
  }
}

function drawBoxSymbol(symbol, cx, cy, r, opacity) {
  if (!symbol) return;
  ctx.globalAlpha = opacity;

  if (symbol === 'triangle') {
    ctx.strokeStyle = 'rgba(0, 204, 204, 0.5)';
    ctx.lineWidth = 3;
    const s = r * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx - s * 0.866, cy + s * 0.5);
    ctx.lineTo(cx + s * 0.866, cy + s * 0.5);
    ctx.closePath();
    ctx.stroke();
  } else if (symbol === 'no-triangle') {
    const s = r * 0.55;
    ctx.strokeStyle = 'rgba(0, 204, 204, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx - s * 0.866, cy + s * 0.5);
    ctx.lineTo(cx + s * 0.866, cy + s * 0.5);
    ctx.closePath();
    ctx.stroke();
    // Prohibition circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    // Red diagonal
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.lineWidth = 4;
    const d = r * 0.9 * 0.707;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Box animation: main update & draw
// ---------------------------------------------------------------------------
function drawBoxAnimation(dt, fade) {
  if (fade <= 0) return;

  animTime += dt;
  const elapsed = animTime - sceneStart;

  // Advance to next scene
  if (elapsed >= SCENE_DUR) {
    sceneIdx = (sceneIdx + 1) % SCENES.length;
    sceneStart = animTime;
    generateSceneShapes();
    return;
  }

  // Gap between scenes — draw nothing
  if (elapsed > SCENE_DUR - GAP_DUR) return;

  const scene = SCENES[sceneIdx];
  const dim = Math.min(W, H);
  const bw = dim * BOX_W_FRAC;
  const bh = dim * BOX_H_FRAC;
  const sr = dim * SHAPE_R_FRAC;
  const boxCY = H * BOX_CY_FRAC - boxYOffset;
  const centerX = W * 0.5;

  // Phase boundaries
  const enterEnd = ENTER_DUR;
  const fillEnd = enterEnd + FILL_DUR;
  const pauseEnd = fillEnd + PAUSE_DUR;
  const exitEnd = pauseEnd + EXIT_DUR;

  // Box horizontal position
  let boxCX, exitT = 0;

  if (elapsed < enterEnd) {
    const t = clamp01(elapsed / ENTER_DUR);
    boxCX = lerp(-bw, centerX, easeOutCubic(t));
  } else if (elapsed < pauseEnd) {
    boxCX = centerX;
  } else if (elapsed < exitEnd) {
    exitT = clamp01((elapsed - pauseEnd) / EXIT_DUR);
    boxCX = lerp(centerX, W + bw, easeInCubic(exitT));
  } else {
    return;
  }

  // Box opacity fades on exit
  const boxOpacity = fade * (1 - exitT * exitT);

  // Squish + splay effect for giant circle
  let squishX = 1, squishY = 1, splayAngle = 0;
  if (scene.giant && elapsed > enterEnd) {
    const giantT = clamp01((elapsed - enterEnd) / (FILL_DUR * 0.5));
    const squish = easeOutBounce(giantT) * 0.3;
    squishX = 1 + squish * 0.3;
    squishY = 1 - squish * 0.4;
    splayAngle = squish * 0.7; // walls splay outward (radians)
  }

  const drawW = bw * squishX;
  const drawH = bh * squishY;
  const bLeft = boxCX - drawW / 2;
  const bRight = boxCX + drawW / 2;
  const bTop = boxCY - drawH / 2;
  const bBottom = boxCY + drawH / 2;

  // 1. Box background fill
  ctx.globalAlpha = boxOpacity * 0.04;
  ctx.fillStyle = '#0cc';
  ctx.fillRect(bLeft, bTop, drawW, drawH);

  // Pre-calculate all shape positions
  const shapeData = [];
  const dropDur = FILL_DUR * 0.4;

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const dropStart = enterEnd + shape.delay * FILL_DUR * 0.5;
    const dropT = clamp01((elapsed - dropStart) / dropDur);

    if (dropT <= 0) {
      shapeData.push(null);
      continue;
    }

    const fadeInT = clamp01(dropT * 4);
    let sx, sy, sOpacity;

    if (shape.overflow) {
      // Overflow shapes: fall toward the rim, bounce off it, tumble to the ground.
      // Use centerX so they stay put when the box exits right.
      const overflowRefX = centerX;
      const startY = bTop - dim * 0.35;
      const rimWorldY = boxCY - bh / 2;

      // Phase 1: fall from above to the rim (first 40% of drop)
      const fallToRimT = clamp01(dropT / 0.4);
      // Phase 2: bounce from rim to ground beside the box (next 60%)
      const bounceT = clamp01((dropT - 0.4) / 0.6);

      if (bounceT <= 0) {
        // Still falling toward the rim
        sx = overflowRefX + shape.targetX;
        sy = lerp(startY, rimWorldY, easeInCubic(fallToRimT));
        sOpacity = fadeInT * fade;
      } else {
        // Bouncing away from rim to ground
        const groundY = boxCY + bh / 2 + sr;
        const landX = overflowRefX + shape.bounceTargetX;
        sx = lerp(overflowRefX + shape.targetX, landX, easeOutCubic(bounceT));
        // Arc: rise briefly then fall to ground
        const arc = -Math.sin(bounceT * Math.PI) * dim * 0.08;
        sy = lerp(rimWorldY, groundY, bounceT) + arc;
        sOpacity = fade * (1 - bounceT * 0.6) * (1 - exitT);
      }
    } else if (shape.falling) {
      // Falling shapes (unused for overflow now, kept for extensibility)
      shape.velY += dt * dim * 1.2;
      shape.fallY += shape.velY * dt;
      shape.fallOpacity = Math.max(0, shape.fallOpacity - dt * 0.8);
      sx = shape.fallX;
      sy = shape.fallY;
      sOpacity = shape.fallOpacity * fade;
    } else {
      const startY = bTop - dim * 0.35;
      sx = boxCX + shape.targetX;
      sy = lerp(startY, boxCY + shape.targetY, easeOutBounce(dropT));
      sOpacity = fadeInT * boxOpacity;
    }

    shapeData.push({ x: sx, y: sy, opacity: sOpacity });
  }

  // 2. Draw inside shapes (behind box walls)
  for (let i = 0; i < shapes.length; i++) {
    if (!shapeData[i] || shapes[i].overflow) continue;
    const sd = shapeData[i];
    drawShape(sd.x, sd.y, shapes[i].size, shapes[i].type, shapes[i].color, sd.opacity);
  }

  // 3. Box outline (U-shape: walls in front of inside shapes)
  ctx.globalAlpha = boxOpacity * 0.4;
  ctx.strokeStyle = '#0cc';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (scene.giant && splayAngle > 0) {
    // Splayed walls — each side rotates outward from the bottom corner
    const lbx = bLeft, lby = bBottom;
    const rbx = bRight, rby = bBottom;
    const ltx = bLeft  - Math.sin(splayAngle) * drawH;
    const lty = bTop   - (1 - Math.cos(splayAngle)) * drawH * 0.3;
    const rtx = bRight + Math.sin(splayAngle) * drawH;
    const rty = bTop   - (1 - Math.cos(splayAngle)) * drawH * 0.3;
    ctx.beginPath();
    ctx.moveTo(ltx, lty);
    ctx.lineTo(lbx, lby);
    ctx.lineTo(rbx, rby);
    ctx.lineTo(rtx, rty);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(bLeft, bTop);
    ctx.lineTo(bLeft, bBottom);
    ctx.lineTo(bRight, bBottom);
    ctx.lineTo(bRight, bTop);
    ctx.stroke();
  }

  // 4. Box symbol (centred in box)
  if (scene.symbol) {
    const symSize = dim * SHAPE_R_FRAC * 1.4;
    drawBoxSymbol(scene.symbol, boxCX, boxCY, symSize, boxOpacity * 0.8);
  }

  // 5. Draw overflow shapes (in front of box walls)
  for (let i = 0; i < shapes.length; i++) {
    if (!shapeData[i] || !shapes[i].overflow) continue;
    const sd = shapeData[i];
    drawShape(sd.x, sd.y, shapes[i].size, shapes[i].type, shapes[i].color, sd.opacity);
  }

  // 6. Emoji during exit
  if (exitT > 0.05) {
    const emoji = UNHAPPY_FACES[sceneIdx % UNHAPPY_FACES.length];
    const emojiProgress = clamp01((exitT - 0.05) / 0.6);
    const emojiX = boxCX;
    const emojiY = bTop - dim * 0.02 - emojiProgress * dim * 0.15;
    let emojiOp = emojiProgress < 0.3 ? emojiProgress / 0.3 :
                  emojiProgress > 0.7 ? (1 - emojiProgress) / 0.3 : 1;
    emojiOp *= fade;

    ctx.globalAlpha = emojiOp;
    ctx.font = Math.round(dim * 0.06) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, emojiX, emojiY);
  }

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Good-state box animation
// ---------------------------------------------------------------------------
function drawGoodBoxAnimation(dt, fade) {
  if (fade <= 0) return;

  goodAnimTime += dt;
  let elapsed = goodAnimTime - goodSceneStart;

  if (elapsed >= SCENE_DUR) {
    goodSceneIdx++;
    goodSceneStart = goodAnimTime;
    elapsed = 0;
    generateGoodShapes();
  }

  if (elapsed > SCENE_DUR - GAP_DUR) return;

  const dim = Math.min(W, H);
  const bw = dim * BOX_W_FRAC;
  const bh = dim * BOX_H_FRAC;
  const boxCY = H * BOX_CY_FRAC - boxYOffset;
  const centerX = W * 0.5;

  const enterEnd = ENTER_DUR;
  const fillEnd = enterEnd + FILL_DUR;
  const pauseEnd = fillEnd + PAUSE_DUR;
  const exitEnd = pauseEnd + EXIT_DUR;

  let boxCX, exitT = 0;

  if (elapsed < enterEnd) {
    const t = clamp01(elapsed / ENTER_DUR);
    boxCX = lerp(-bw, centerX, easeOutCubic(t));
  } else if (elapsed < pauseEnd) {
    boxCX = centerX;
  } else if (elapsed < exitEnd) {
    exitT = clamp01((elapsed - pauseEnd) / EXIT_DUR);
    boxCX = lerp(centerX, W + bw, easeInCubic(exitT));
  } else {
    return;
  }

  const boxOpacity = fade * (1 - exitT * exitT);

  const bLeft = boxCX - bw / 2;
  const bRight = boxCX + bw / 2;
  const bTop = boxCY - bh / 2;
  const bBottom = boxCY + bh / 2;

  // Box background fill
  ctx.globalAlpha = boxOpacity * 0.06;
  ctx.fillStyle = '#0cc';
  ctx.fillRect(bLeft, bTop, bw, bh);

  // Shapes
  const dropDur = FILL_DUR * 0.4;

  for (let i = 0; i < goodShapes.length; i++) {
    const shape = goodShapes[i];
    const dropStart = enterEnd + shape.delay * FILL_DUR * 0.5;
    const dropT = clamp01((elapsed - dropStart) / dropDur);

    if (dropT <= 0) continue;

    const fadeInT = clamp01(dropT * 4);
    const startY = bTop - dim * 0.35;
    const sx = boxCX + shape.targetX;
    const sy = lerp(startY, boxCY + shape.targetY, easeOutBounce(dropT));
    const sOpacity = fadeInT * boxOpacity;

    drawShape(sx, sy, shape.size, shape.type, shape.color, sOpacity);
  }

  // Box outline
  ctx.globalAlpha = boxOpacity * 0.5;
  ctx.strokeStyle = '#0cc';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bLeft, bTop);
  ctx.lineTo(bLeft, bBottom);
  ctx.lineTo(bRight, bBottom);
  ctx.lineTo(bRight, bTop);
  ctx.stroke();

  // Happy emoji during exit
  if (exitT > 0.05) {
    const emoji = HAPPY_FACES[goodSceneIdx % HAPPY_FACES.length];
    const emojiProgress = clamp01((exitT - 0.05) / 0.6);
    const emojiX = boxCX;
    const emojiY = bTop - dim * 0.02 - emojiProgress * dim * 0.15;
    let emojiOp = emojiProgress < 0.3 ? emojiProgress / 0.3 :
                  emojiProgress > 0.7 ? (1 - emojiProgress) / 0.3 : 1;
    emojiOp *= fade;

    ctx.globalAlpha = emojiOp;
    ctx.font = Math.round(dim * 0.06) + 'px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, emojiX, emojiY);
  }

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// ILP Matrix: randomised solve-step generator
// ---------------------------------------------------------------------------
function generateSolveSteps() {
  const rng = alea('solve-' + solveCycleIdx);
  solveCycleIdx++;

  const ROWS = MATRIX_ITEMS.length;
  const COLS = MATRIX_BOXES.length;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  // --- Phase A: variety assignment ("start full, prune") ---

  // Each box picks a target variety count (5-7), capped
  const boxTarget = [];
  for (let c = 0; c < COLS; c++) {
    boxTarget[c] = SOLVE_BOX_MIN + Math.floor(rng() * (SOLVE_BOX_MAX - SOLVE_BOX_MIN + 1));
  }
  // Cap total to ensure visual variety
  while (boxTarget.reduce((a, b) => a + b, 0) > SOLVE_BOX_SUM_CAP) {
    let maxIdx = 0;
    for (let c = 1; c < COLS; c++) { if (boxTarget[c] > boxTarget[maxIdx]) maxIdx = c; }
    boxTarget[maxIdx]--;
  }

  // Start with every box having all varieties
  const target = [];
  for (let r = 0; r < ROWS; r++) {
    target[r] = [];
    for (let c = 0; c < COLS; c++) target[r][c] = true;
  }
  const boxCurrent = [];
  for (let c = 0; c < COLS; c++) boxCurrent[c] = ROWS;

  // Prune: shuffle varieties, remove from most-over-target box, repeat
  const varieties = [];
  for (let r = 0; r < ROWS; r++) varieties.push(r);

  while (true) {
    let anyOver = false;
    for (let c = 0; c < COLS; c++) { if (boxCurrent[c] > boxTarget[c]) { anyOver = true; break; } }
    if (!anyOver) break;

    shuffle(varieties);
    for (let vi = 0; vi < varieties.length; vi++) {
      const r = varieties[vi];
      // Find over-target boxes that have this variety, prefer most-over-target
      let best = [];
      let bestOver = 0;
      for (let c = 0; c < COLS; c++) {
        if (!target[r][c]) continue;
        const over = boxCurrent[c] - boxTarget[c];
        if (over <= 0) continue;
        if (over > bestOver) { bestOver = over; best = [c]; }
        else if (over === bestOver) { best.push(c); }
      }
      if (best.length > 0) {
        const c = best[Math.floor(rng() * best.length)];
        target[r][c] = false;
        boxCurrent[c]--;
      }
    }
  }

  // --- Phase B: quantity allocation ---

  const quantities = [];
  for (let r = 0; r < ROWS; r++) {
    quantities[r] = [];
    for (let c = 0; c < COLS; c++) quantities[r][c] = 0;
  }

  for (let c = 0; c < COLS; c++) {
    // Collect varieties in this box
    const boxVarieties = [];
    for (let r = 0; r < ROWS; r++) {
      if (target[r][c]) { boxVarieties.push(r); quantities[r][c] = 1; }
    }
    if (boxVarieties.length === 0) continue;

    const targetQty = SOLVE_QTY_MIN + Math.floor(rng() * (SOLVE_QTY_MAX - SOLVE_QTY_MIN + 1));
    let currentQty = boxVarieties.length; // each starts at 1

    while (currentQty < targetQty) {
      shuffle(boxVarieties);
      for (let i = 0; i < boxVarieties.length; i++) {
        const add = rng() > 0.66 ? 2 : 1;
        quantities[boxVarieties[i]][c] += add;
        currentQty += add;
        if (currentQty >= targetQty) break;
      }
    }
  }

  // --- Phase C: generate animation steps ---

  // Collect surviving cells as accepts, pruned cells as potential rejects
  const accepts = [];
  const pruned = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (target[r][c]) accepts.push({ r: r, c: c });
      else pruned.push({ r: r, c: c });
    }
  }
  shuffle(accepts);

  // Build step list: ~20% of accepts get a rejection step before them
  const steps = [];
  for (let i = 0; i < accepts.length; i++) {
    if (rng() < 0.2 && pruned.length > 0) {
      // Pick a pruned cell from the same column if possible
      const col = accepts[i].c;
      const colPruned = pruned.filter(p => p.c === col);
      if (colPruned.length > 0) {
        const pick = colPruned[Math.floor(rng() * colPruned.length)];
        steps.push({ r: pick.r, c: pick.c, ok: false });
      }
    }
    steps.push({ r: accepts[i].r, c: accepts[i].c, ok: true });
  }

  return { steps: steps, quantities: quantities };
}

// ---------------------------------------------------------------------------
// ILP Matrix: canvas-drawn constraint satisfaction animation
// ---------------------------------------------------------------------------
function drawMatrix(dt, fade) {
  if (fade <= 0) return;

  solveTime += dt;

  const ROWS = MATRIX_ITEMS.length;
  const COLS = MATRIX_BOXES.length;
  const conDur = SOLVE_CONSTRAINT_LABELS.length * SOLVE_CONSTRAINT_DELAY + 0.3;

  // Generate first set of steps (or regenerate at cycle boundary)
  if (currentSolveSteps.length === 0) {
    const result = generateSolveSteps();
    currentSolveSteps = result.steps;
    currentQuantities = result.quantities;
  }

  let solveDur = currentSolveSteps.length * SOLVE_STEP_DUR + 0.25;
  const cycleDur = solveDur + COUNT_UP_DUR + conDur + SOLVE_PAUSE_DUR;

  if (solveTime >= cycleDur) {
    solveTime -= cycleDur;
    const result = generateSolveSteps();
    currentSolveSteps = result.steps;
    currentQuantities = result.quantities;
    solveDur = currentSolveSteps.length * SOLVE_STEP_DUR + 0.25;
  }

  const ct = solveTime;

  // Precompute final assigned state (for glow phase)
  const finalAssigned = [];
  for (let r = 0; r < ROWS; r++) {
    finalAssigned[r] = [];
    for (let c = 0; c < COLS; c++) finalAssigned[r][c] = false;
  }
  for (let i = 0; i < currentSolveSteps.length; i++) {
    if (currentSolveSteps[i].ok) finalAssigned[currentSolveSteps[i].r][currentSolveSteps[i].c] = true;
  }

  // Sizing
  const dim = Math.min(W, H);
  let cellSz;
  if (W <= MOBILE_BREAKPOINT) {
    cellSz = W * 0.08;
  } else {
    cellSz = dim * 0.042;
  }
  const labelSz = cellSz * 1.1;
  const gap = cellSz * 0.1;
  const innerSz = cellSz - gap;

  const gridW = COLS * cellSz;
  const gridH = ROWS * cellSz;
  const titleH = cellSz * 0.8;
  const constraintH = cellSz * 1.6;
  const totalW = labelSz + gridW;
  const totalH = titleH + labelSz + gridH + constraintH;

  // Position: right side on desktop, centred lower on tablet/mobile
  let mx, my;
  if (W > TABLET_BREAKPOINT) {
    mx = W - totalW - W * 0.05;
    my = (H - totalH) * 0.4;
  } else {
    mx = (W - totalW) / 2;
    my = H * 0.56;
  }

  if (W <= MOBILE_BREAKPOINT) {
    const contentTop = 96;
    const contentBottom = H - 20;
    mx = (W - totalW) / 2;
    my = contentTop + Math.max(0, (contentBottom - contentTop - totalH) / 2);
  }

  const gridLeft = mx + labelSz;
  const gridTop = my + titleH + labelSz;

  // Title
  ctx.globalAlpha = fade * 0.6;
  ctx.fillStyle = '#0cc';
  ctx.font = Math.round(cellSz * 0.76) + 'px VT323, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ILP SOLVER', mx + totalW / 2, my + titleH / 2);

  // Column headers (text labels in VT323)
  const headerFontSz = Math.round(cellSz * 0.5);
  ctx.font = headerFontSz + "px VT323, monospace";
  ctx.fillStyle = '#0cc';
  for (let c = 0; c < COLS; c++) {
    ctx.globalAlpha = fade * 0.7;
    ctx.fillText(MATRIX_BOXES[c], gridLeft + c * cellSz + cellSz / 2, my + titleH + labelSz / 2);
  }

  // Row labels (emoji with cross-platform font stack)
  const emojiFontSz = Math.round(cellSz * 0.5);
  ctx.font = emojiFontSz + "px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  for (let r = 0; r < ROWS; r++) {
    ctx.globalAlpha = fade * 0.7;
    ctx.fillText(MATRIX_ITEMS[r], mx + labelSz / 2, gridTop + r * cellSz + cellSz / 2);
  }

  // Draw cells
  const cellFont = Math.round(cellSz * 0.4) + 'px VT323, monospace';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = gridLeft + c * cellSz + cellSz / 2;
      const cy = gridTop + r * cellSz + cellSz / 2;
      const hw = innerSz / 2;

      // Determine cell state from solve steps
      let assigned = false;
      let flashType = null;
      let flashAmt = 0;

      for (let i = 0; i < currentSolveSteps.length; i++) {
        const step = currentSolveSteps[i];
        if (step.r !== r || step.c !== c) continue;

        const stepStart = i * SOLVE_STEP_DUR;
        const el = ct - stepStart;
        if (el < 0) continue;

        if (el < SOLVE_TRY_DUR) {
          flashType = 'try';
          flashAmt = 0.5 + 0.5 * Math.sin(el / SOLVE_TRY_DUR * Math.PI);
        } else if (step.ok) {
          assigned = true;
          const age = el - SOLVE_TRY_DUR;
          if (age < 0.15) {
            flashType = 'accept';
            flashAmt = 1 - age / 0.15;
          }
        } else {
          const age = el - SOLVE_TRY_DUR;
          if (age < 0.5) {
            flashType = 'reject';
            flashAmt = Math.exp(-age * 5) * (0.5 + 0.5 * Math.cos(age * Math.PI * 8));
          }
        }
      }

      // Cell base
      roundRect(ctx, cx - hw, cy - hw, innerSz, innerSz, 3);
      if (assigned) {
        ctx.globalAlpha = fade * 0.12;
        ctx.fillStyle = '#0cc';
        ctx.fill();
        ctx.globalAlpha = fade * 0.35;
        ctx.strokeStyle = '#0cc';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Determine display quantity
        let displayQty = 1;
        const finalQty = (currentQuantities[r] && currentQuantities[r][c]) || 1;
        if (ct >= solveDur && finalQty > 1) {
          const countProgress = clamp01((ct - solveDur) / COUNT_UP_DUR);
          displayQty = 1 + Math.floor(countProgress * (finalQty - 1));
        } else if (ct >= solveDur + COUNT_UP_DUR) {
          displayQty = finalQty;
        }

        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = '#0cc';
        ctx.font = cellFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayQty.toString(), cx, cy);
      } else {
        ctx.globalAlpha = fade * 0.04;
        ctx.fillStyle = '#0cc';
        ctx.fill();
        ctx.globalAlpha = fade * 0.12;
        ctx.strokeStyle = '#0cc';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Flash overlays
      if (flashType === 'try') {
        roundRect(ctx, cx - hw, cy - hw, innerSz, innerSz, 3);
        ctx.globalAlpha = fade * flashAmt * 0.25;
        ctx.fillStyle = '#fa0';
        ctx.fill();
      } else if (flashType === 'accept') {
        roundRect(ctx, cx - hw, cy - hw, innerSz, innerSz, 3);
        ctx.globalAlpha = fade * flashAmt * 0.35;
        ctx.fillStyle = '#0cc';
        ctx.fill();
      } else if (flashType === 'reject') {
        roundRect(ctx, cx - hw, cy - hw, innerSz, innerSz, 3);
        ctx.globalAlpha = fade * flashAmt * 0.3;
        ctx.fillStyle = '#f44';
        ctx.fill();

        if (flashAmt > 0.3) {
          ctx.globalAlpha = fade * flashAmt * 0.7;
          ctx.fillStyle = '#f44';
          ctx.font = cellFont;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('\u2717', cx, cy);
        }
      }
    }
  }

  // Constraint labels (appear after solve + count-up)
  const constraintY = gridTop + gridH + constraintH * 0.55;
  const postSolveDur = solveDur + COUNT_UP_DUR;

  if (ct >= postSolveDur) {
    const conElapsed = ct - postSolveDur;
    const shown = Math.min(SOLVE_CONSTRAINT_LABELS.length,
                         Math.floor(conElapsed / SOLVE_CONSTRAINT_DELAY) + 1);

    let conFontSz = Math.min(Math.round(cellSz * 0.64), 18);
    ctx.font = conFontSz + 'px VT323, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const labels = [];
    let totalLabelW = 0;
    const spacing = cellSz * 0.2;
    for (let i = 0; i < shown; i++) {
      const text = '\u2713 ' + SOLVE_CONSTRAINT_LABELS[i];
      const w = ctx.measureText(text).width;
      labels.push({ text: text, w: w });
      totalLabelW += w;
    }
    totalLabelW += Math.max(0, shown - 1) * spacing;

    // Scale down if labels exceed available width
    if (totalLabelW > totalW) {
      conFontSz = Math.round(conFontSz * totalW / totalLabelW);
      ctx.font = conFontSz + 'px VT323, monospace';
      totalLabelW = 0;
      for (let i = 0; i < labels.length; i++) {
        labels[i].w = ctx.measureText(labels[i].text).width;
        totalLabelW += labels[i].w;
      }
      totalLabelW += Math.max(0, shown - 1) * spacing;
    }

    let conX = mx + (totalW - totalLabelW) / 2;

    for (let i = 0; i < shown; i++) {
      const age = conElapsed - i * SOLVE_CONSTRAINT_DELAY;
      const alpha = clamp01(age / 0.2);
      ctx.globalAlpha = fade * alpha * 0.7;
      ctx.fillStyle = '#0c6';
      ctx.fillText(labels[i].text, conX, constraintY);
      conX += labels[i].w + spacing;
    }
  }

  // Complete phase: pulse glow on assigned cells + OPTIMAL label
  if (ct >= postSolveDur + conDur) {
    const glowAge = ct - postSolveDur - conDur;
    const glowPulse = 0.5 + 0.5 * Math.sin(glowAge * 2.5);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!finalAssigned[r][c]) continue;

        const cx = gridLeft + c * cellSz + cellSz / 2;
        const cy = gridTop + r * cellSz + cellSz / 2;
        const hw = innerSz / 2;

        roundRect(ctx, cx - hw, cy - hw, innerSz, innerSz, 3);
        ctx.globalAlpha = fade * glowPulse * 0.1;
        ctx.fillStyle = '#0cc';
        ctx.fill();
      }
    }

    const optAlpha = clamp01(glowAge / 0.3);
    ctx.globalAlpha = fade * optAlpha * 0.8;
    ctx.fillStyle = '#0cc';
    ctx.font = Math.round(cellSz * 0.70) + 'px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPTIMAL', mx + totalW / 2, constraintY + constraintH * 0.6);
  }

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(timestamp) {
  // Delta time
  let dt;
  if (prevTimestamp) {
    dt = Math.min((timestamp - prevTimestamp) / 1000, 0.05);
  } else {
    dt = FRAME_DT;
  }
  prevTimestamp = timestamp;
  time += FRAME_DT;

  const t = morphProgress;

  // Bad/good sequential fade (no overlap)
  const badFade = 1 - clamp01((t - BAD_FADE_START) / BAD_FADE_DUR);
  const goodFade = clamp01((t - GOOD_FADE_START) / GOOD_FADE_DUR);

  // Background interpolation (smooth across full transition range)
  const bgT = clamp01((t - BG_TRANSITION_START) / (BG_TRANSITION_END - BG_TRANSITION_START));
  const bgR = Math.round(lerp(BG_COLOR[0], GOOD_BG_COLOR[0], bgT));
  const bgG = Math.round(lerp(BG_COLOR[1], GOOD_BG_COLOR[1], bgT));
  const bgB = Math.round(lerp(BG_COLOR[2], GOOD_BG_COLOR[2], bgT));
  ctx.fillStyle = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
  ctx.fillRect(0, 0, W, H);

  // ILP Matrix alpha (used for box offset on mobile)
  const matrixStart = W <= MOBILE_BREAKPOINT ? 0.94 : MATRIX_MORPH_START;
  const matrixFadeRange = W <= MOBILE_BREAKPOINT ? 0.05 : MATRIX_FADE_RANGE;
  const matrixAlpha = clamp01((t - matrixStart) / matrixFadeRange) * techFade;

  // On mobile, shift box animation up when matrix appears
  boxYOffset = W <= MOBILE_BREAKPOINT ? matrixAlpha * H * 0.18 : 0;

  // Box animations
  const boxSceneAlpha = W <= MOBILE_BREAKPOINT ? 1 - matrixAlpha : 1;
  if (badFade > 0) drawBoxAnimation(dt, badFade * techFade * boxSceneAlpha);
  if (goodFade > 0) drawGoodBoxAnimation(dt, goodFade * techFade * boxSceneAlpha);

  // ILP Matrix (canvas-drawn)
  if (matrixAlpha > 0) drawMatrix(dt, matrixAlpha);

  // Narrative lines (horizontal slide, vertically centred)
  // On phones, the final line gets a stable interval before yielding to the
  // solver. Larger layouts can continue showing copy alongside the matrix.
  const narrativeMatrixFade = W <= MOBILE_BREAKPOINT
    ? 1 - clamp01((t - 0.90) / 0.04)
    : 1;
  if (W <= MOBILE_BREAKPOINT) {
    narrativeEl.style.opacity = narrativeMatrixFade;
  }
  for (let i = 0; i < narrativeLines.length; i++) {
    const kf = interpolateKeyframes(LINE_KEYFRAMES[i], t);
    narrativeLines[i].style.opacity = kf.op * narrativeMatrixFade;
    narrativeLines[i].style.transform = 'translate(-50%, -50%) translateX(' + (kf.y * NARRATIVE_SLIDE_PX) + 'px)';
  }

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Tech row animations
// ---------------------------------------------------------------------------
function initPipelineParticles() {
  var dots = document.querySelectorAll('.flow-dot');
  if (!dots.length) return;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var boxTargets = [
    { x: 377, y: 57 },
    { x: 423, y: 57 },
    { x: 377, y: 123 },
    { x: 423, y: 123 },
  ];

  if (reducedMotion) {
    var staticX = [155, 180, 210, 260, 300, 335];
    dots.forEach(function(dot, i) {
      dot.setAttribute('cx', staticX[i]);
      dot.setAttribute('cy', '86');
      dot.setAttribute('opacity', '0.6');
    });
    return;
  }

  function animateDot(dot) {
    var target = boxTargets[Math.floor(Math.random() * 4)];
    var tl = gsap.timeline({ onComplete: function() { animateDot(dot); } });
    tl.set(dot, { attr: { cx: 135, cy: 86 }, opacity: 0 });
    tl.to(dot, { attr: { cx: 175, cy: 86 }, opacity: 1, duration: 0.5, ease: 'none' });
    tl.to(dot, { attr: { cx: 240, cy: 90 }, duration: 0.5, ease: 'power1.inOut' });
    tl.to(dot, { attr: { cx: 310, cy: 86 }, duration: 0.5, ease: 'none' });
    tl.to(dot, { attr: { cx: target.x, cy: target.y }, duration: 0.6, ease: 'power1.in' });
    tl.to(dot, { opacity: 0, duration: 0.3 });
  }

  dots.forEach(function(dot, i) {
    gsap.delayedCall(i * 0.6, function() { animateDot(dot); });
  });
}

function initDialsAndBars() {
  var scoreEl = document.getElementById('dial-score-value');
  if (!scoreEl) return;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var dialData = [
    [45, 200], [310, 110], [170, 330], [250, 60],
    [20, 280], [140, 350], [220, 85]
  ];
  var dialCenters = [
    '85 54', '45 77', '125 77', '85 100',
    '45 123', '125 123', '85 146'
  ];
  var barData = [
    [48, 114], [72, 120], [42, 108], [78, 118],
    [52, 110], [60, 116], [55, 113]
  ];

  // Gather elements
  var needles = [], glows = [], bars = [];
  for (var i = 0; i < 7; i++) {
    needles.push(document.getElementById('dial-needle-' + i));
    glows.push(document.getElementById('dial-glow-' + i));
    bars.push(document.getElementById('bar-fill-' + i));
  }
  if (!needles[0] || !bars[0]) return;

  // Reduced motion: static end state
  if (reducedMotion) {
    needles.forEach(function(n, i) {
      gsap.set(n, { rotation: dialData[i][1], svgOrigin: dialCenters[i] });
    });
    bars.forEach(function(b, i) {
      b.setAttribute('width', barData[i][1]);
      b.setAttribute('fill', 'rgba(0,204,204,0.6)');
    });
    glows.forEach(function(g) { g.setAttribute('opacity', '0.5'); });
    scoreEl.textContent = '94';
    scoreEl.setAttribute('fill', '#0cc');
    return;
  }

  // Set initial needle rotations
  needles.forEach(function(n, i) {
    gsap.set(n, { rotation: dialData[i][0], svgOrigin: dialCenters[i] });
  });

  // Single GSAP timeline
  var tl = gsap.timeline({
    yoyo: true, repeat: -1, repeatDelay: 1,
    defaults: { duration: 4, ease: 'power1.inOut' }
  });

  // Needles
  needles.forEach(function(n, i) {
    tl.to(n, { rotation: dialData[i][1], svgOrigin: dialCenters[i] }, 0);
  });
  // Bar widths + colours
  bars.forEach(function(b, i) {
    tl.to(b, { attr: { width: barData[i][1] } }, 0);
    tl.to(b, { fill: 'rgba(0,204,204,0.6)', duration: 4, ease: 'power1.inOut' }, 0);
  });
  // Glow pulse (bright at extremes, dim in middle)
  glows.forEach(function(g) {
    tl.fromTo(g, { opacity: 1 }, {
      keyframes: [
        { opacity: 0.2, duration: 2, ease: 'power1.inOut' },
        { opacity: 1, duration: 2, ease: 'power1.inOut' }
      ]
    }, 0);
  });
  // Score 71→94 with colour
  var proxy = { value: 71 };
  tl.to(proxy, {
    value: 94,
    onUpdate: function() {
      var v = Math.round(proxy.value);
      scoreEl.textContent = v;
      var t = (proxy.value - 71) / 23;
      var r = Math.round(255 * (1 - t));
      var g = Math.round(153 + 51 * t);
      var b = Math.round(102 + 102 * t);
      scoreEl.setAttribute('fill', 'rgb(' + r + ',' + g + ',' + b + ')');
    }
  }, 0);
}

function initMorphAnimation() {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  var items = [];
  for (var i = 0; i < 8; i++) items.push(document.getElementById('morph-item-' + i));
  var lines = [];
  var scores = [];
  for (var j = 0; j < 6; j++) {
    lines.push(document.getElementById('morph-line-' + j));
    scores.push(document.getElementById('morph-score-' + j));
  }
  var glowRect = document.getElementById('morph-glow');
  var subtitle = document.getElementById('morph-subtitle');

  if (!items[0] || !lines[0] || !glowRect || !subtitle) return;

  var ilpPositions = [
    { cx: 138, cy: 108 }, { cx: 165, cy: 105 }, { cx: 192, cy: 110 },
    { cx: 148, cy: 133 }, { cx: 178, cy: 137 }, { cx: 140, cy: 160 },
    { cx: 168, cy: 166 }, { cx: 195, cy: 158 },
  ];
  var ilpFills = [
    'rgba(0,204,204,0.6)', 'rgba(255,153,102,0.6)', 'rgba(102,204,102,0.6)',
    'rgba(255,204,0,0.55)', 'rgba(204,102,255,0.55)', 'rgba(255,102,102,0.55)',
    'rgba(102,204,204,0.55)', 'rgba(102,204,102,0.6)',
  ];
  var scoreData = [
    { m: 62, i: 95 }, { m: 45, i: 92 }, { m: 38, i: 96 },
    { m: 71, i: 94 }, { m: 80, i: 90 }, { m: 76, i: 97 },
  ];

  var dur = 3.5;
  var tl = gsap.timeline({
    yoyo: true,
    repeat: -1,
    repeatDelay: 1.5,
    defaults: { duration: dur, ease: 'power1.inOut' },
  });

  // Animate item positions and fills
  items.forEach(function(item, idx) {
    tl.to(item, { attr: { cx: ilpPositions[idx].cx, cy: ilpPositions[idx].cy } }, 0);
    tl.to(item, { fill: ilpFills[idx], duration: dur, ease: 'power1.inOut' }, 0);
  });

  // Animate line and glow colours
  lines.forEach(function(line) {
    tl.to(line, { stroke: 'rgba(0,204,204,0.3)', duration: dur, ease: 'power1.inOut' }, 0);
  });
  tl.to(glowRect, { fill: 'rgba(0,204,204,0.15)', duration: dur, ease: 'power1.inOut' }, 0);

  // Animate scores and subtitle via proxy
  var proxy = { t: 0 };
  tl.to(proxy, {
    t: 1,
    onUpdate: function() {
      var t = proxy.t;
      var r = Math.round(255 * (1 - t));
      var g = Math.round(153 + 51 * t);
      var b = Math.round(102 + 102 * t);
      var color = 'rgb(' + r + ',' + g + ',' + b + ')';
      scores.forEach(function(el, idx) {
        var val = Math.round(scoreData[idx].m + (scoreData[idx].i - scoreData[idx].m) * t);
        el.textContent = val;
        el.setAttribute('fill', color);
      });
      var total = Math.round(71 + 23 * t);
      subtitle.textContent = t < 0.5 ? 'Manual ' + total : 'ILP-optimal ' + total;
      subtitle.setAttribute('fill', color);
    },
  }, 0);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  const container = document.getElementById('canvas-container');
  canvas = document.createElement('canvas');
  container.appendChild(canvas);
  ctx = canvas.getContext('2d');

  progressBar = document.getElementById('progress-bar');
  scrollHint = document.getElementById('scroll-hint');
  narrativeLines = Array.from(document.querySelectorAll('.narrative-line'));
  headerPanelEl = document.getElementById('header-panel');
  titleOverlayEl = document.getElementById('title-overlay');
  narrativeEl = document.getElementById('narrative');
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generateSceneShapes();
    generateGoodShapes();
  }

  resize();
  window.addEventListener('resize', resize);

  // GSAP ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: '#runway',
    start: 'top top',
    end: 'bottom bottom',
    scrub: SCRUB_SMOOTHING,
    onUpdate: (self) => {
      const raw = self.progress;
      morphProgress = raw;
      progressBar.style.width = (raw * 100) + '%';
      scrollHint.style.opacity = raw < SCROLL_HINT_THRESHOLD ? 1 : 0;
    }
  });

  // Tech content section transitions
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
        techProgress = p;

        narrativeEl.style.opacity = 1 - p;

        titleOverlayEl.style.transform = 'scale(' + lerp(1, 0.55, p) + ')';

        // Hide fixed panels once fully in tech section
        narrativeEl.style.visibility = p >= 1 ? 'hidden' : 'visible';

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

  // Tech content row animations
  initPipelineParticles();
  initDialsAndBars();
  initMorphAnimation();

  requestAnimationFrame(render);
}

document.addEventListener('DOMContentLoaded', init);
