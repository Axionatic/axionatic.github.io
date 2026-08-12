'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

// Scene geometry (world units)
const BELT_LENGTH = 22;
const BELT_WIDTH = 3.2;
const BELT_Z = 2.0;
const BELT_THICKNESS = 0.3;
const BELT_SPEED = 3.0;
const RAIL_HEIGHT = 0.3;
const RAIL_WIDTH = 0.15;

const MACHINE_LENGTH = 5;
const MACHINE_DEPTH = 4.2;
const MACHINE_HEIGHT = 5.5;

const BLOCK_W = 1.3;
const BLOCK_D = 1.0;
const BLOCK_H = 0.3;
const SPAWN_INTERVAL = 0.65;

// Problem-state block colors
const BLOCK_COLORS = [
  [255, 153, 102],
  [255, 170, 85],
  [255, 204, 102],
  [255, 119, 102],
];
const DISCOLOR_COLORS = [
  [153, 153, 119],
  [136, 119, 119],
  [119, 136, 119],
  [102, 119, 102],
];

// Solution-state block colors (healthy greens)
const SOLUTION_COLORS = [
  [60, 200, 100],
  [40, 190, 110],
  [80, 210, 90],
  [50, 180, 120],
];

// Background
const BG_PROBLEM = [12, 5, 2];
const BG_SOLUTION = [2, 8, 12];

// Problem probabilities (at morph = 0)
const P_FALL = 0.50;
const P_CRACK = 0.70;
const P_DISCOLOR = 0.60;

// Fade in/out
const FADE_IN_DISTANCE = 2.0;
const FADE_OUT_START = BELT_LENGTH - 2.0;
const FADE_OUT_DISTANCE = 2.0;

// Fall animation
const FALL_DURATION = 2.0;
const BOUNCE_PHASE = 0.45;
const BOUNCE_HALF_CYCLES = 2.5;
const BOUNCE_Y_MAX = 1.3;
const BOUNCE_Z_HOP = 0.25;
const DROP_Y_DISTANCE = 4;
const DROP_Z_DISTANCE = 5;
const DROP_TILT_MAX = 2.5;

// Belt rumble (scales to 0 with morph)
const RUMBLE_Y_AMP = 0.04;
const RUMBLE_Z_AMP = 0.06;
const RUMBLE_Y_FREQ = 7;
const RUMBLE_Z_FREQ = 5;

// --- Scanner (headlamp on machine edge) ---
const SCANNER_X = 1.5;
const SCANNER_CONE_LEN = 3.0;

// --- Counter (gantry, red) ---
const COUNTER_X = 9.0;
const GANTRY_POST_W = 0.3;
const GANTRY_POST_D = 0.3;
const GANTRY_TOTAL_H = 4.5;
const GANTRY_BEAM_H = 0.25;
const GANTRY_UNIT_W = 0.8;
const GANTRY_UNIT_D = 0.5;
const GANTRY_UNIT_H = 0.5;
const HW_DROP_DISTANCE = 4;
const HW_MORPH_START = 0.20;
const HW_MORPH_END = 0.45;

// Scan flash
const SCAN_ACTIVE = 0.40;
const SCAN_FLASH_DURATION = 0.3;
const SCAN_BOUNCE_Z = 0.35;

// Dashboard reveal
const DASH_MORPH_START = 0.68;
const DASH_MORPH_END = 0.80;

// Narrative keyframes: [morphProgress, yMultiplier, opacity, blur]
const LINE_KEYFRAMES = [
  [[0, 0, 1, 0],      [0.10, 0, 1, 0],    [0.18, -1.5, 0, 8]],
  [[0.10, 0.5, 0, 8], [0.18, 0, 1, 0],     [0.30, 0, 1, 0],  [0.38, -1.5, 0, 8]],
  [[0.30, 0.5, 0, 8], [0.38, 0, 1, 0],     [0.50, 0, 1, 0],  [0.58, -1.5, 0, 8]],
  [[0.50, 0.5, 0, 8], [0.58, 0, 1, 0],     [0.70, 0, 1, 0],  [0.78, -1.5, 0, 8]],
  [[0.70, 0.5, 0, 8], [0.78, 0, 1, 0],     [0.88, 0, 1, 0], [0.95, -1.5, 0, 8]],
];
const NARRATIVE_COLORS = [
  'rgba(255, 180, 100, 0.85)',
  'rgba(255, 200, 140, 0.85)',
  'rgba(200, 220, 200, 0.85)',
  'rgba(100, 220, 160, 0.85)',
  'rgba(50, 230, 120, 0.85)',
];
const SCRUB_SMOOTHING = 0.8;
const SCROLL_HINT_THRESHOLD = 0.03;

// iPad dashboard data
const IPAD_ROWS = [
  { variety: 'Alyssum White', target: 72, active: true },
  { variety: 'Begonia Choc', target: 20 },
  { variety: 'Carnation Frag', target: 40 },
];
const IPAD_UNSCHED = { variety: 'Tomato Cherry', count: 3 };
const IPAD_START_FRAC = 2 / 3;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let canvas, ctx, dpr;
let W, H;
let isoScale, originX, originY;
let time = 0;
let blocks = [];
let spawnTimer = 0;
let rng;
let lastFrameTime = 0;
let morphProgress = 0;
let techProgress = 0;
let techFade = 1;
let lastScanTime = -1;
let ipadCounts = [];
let ipadActiveIdx = 0;

// DOM
let progressBar, scrollHint;
let narrativeLines = [];
let narrativeSides = [];
let headerPanelEl, titleOverlayEl;
let dashboardEl;
let ipadEls = {};
let zoneLeftPos = { x: 0, y: 0 };
let zoneRightPos = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function interpolateKeyframes(kf, t) {
  if (t <= kf[0][0]) return { y: kf[0][1], op: kf[0][2], blur: kf[0][3] || 0 };
  const last = kf[kf.length - 1];
  if (t >= last[0]) return { y: last[1], op: last[2], blur: last[3] || 0 };
  for (let i = 0; i < kf.length - 1; i++) {
    if (t >= kf[i][0] && t < kf[i + 1][0]) {
      const p = (t - kf[i][0]) / (kf[i + 1][0] - kf[i][0]);
      return {
        y: lerp(kf[i][1], kf[i + 1][1], p),
        op: lerp(kf[i][2], kf[i + 1][2], p),
        blur: lerp(kf[i][3] || 0, kf[i + 1][3] || 0, p)
      };
    }
  }
  return { y: last[1], op: last[2], blur: last[3] || 0 };
}

function computeZoneAnchors() {
  // Left zone: above-left of belt (high wy = screen-left in isometric)
  const leftAnchor = toScreen(5, BELT_WIDTH + 4, BELT_Z);
  // Right zone: below-right of belt (low wy = screen-right)
  const rightAnchor = toScreen(17, -4, BELT_Z);

  if (W <= 600) {
    // Mobile: both zones below the belt
    const belowBelt = toScreen(BELT_LENGTH * 0.5, BELT_WIDTH, 0);
    zoneLeftPos  = { x: W * 0.05,  y: Math.max(belowBelt.y + 30, H * 0.62) };
    zoneRightPos = { x: W * 0.52,  y: Math.max(belowBelt.y + 30, H * 0.62) };
  } else {
    zoneLeftPos  = { x: leftAnchor.x, y: leftAnchor.y };
    zoneRightPos = { x: rightAnchor.x, y: rightAnchor.y };
  }
}

// ---------------------------------------------------------------------------
// Isometric projection
// ---------------------------------------------------------------------------
function toScreenRaw(wx, wy, wz) {
  return {
    x: (wx - wy) * COS30,
    y: (wx + wy) * SIN30 - wz
  };
}

function toScreen(wx, wy, wz) {
  return {
    x: originX + (wx - wy) * COS30 * isoScale,
    y: originY + ((wx + wy) * SIN30 - wz) * isoScale
  };
}

function computeLayout() {
  const my = (BELT_WIDTH - MACHINE_DEPTH) / 2;
  const pts = [
    toScreenRaw(-MACHINE_LENGTH, my, MACHINE_HEIGHT + 0.5),
    toScreenRaw(-MACHINE_LENGTH, my + MACHINE_DEPTH, 0),
    toScreenRaw(BELT_LENGTH + 1, -0.5, BELT_Z + BELT_THICKNESS + BLOCK_H + 0.5),
    toScreenRaw(BELT_LENGTH + 1, BELT_WIDTH + 0.5, 0),
    toScreenRaw(-MACHINE_LENGTH, my, 0),
    toScreenRaw(BELT_LENGTH * 0.5, BELT_WIDTH + FALL_Y_DISTANCE_TOTAL(), -DROP_Z_DISTANCE * 0.3),
  ];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].x < minX) minX = pts[i].x;
    if (pts[i].x > maxX) maxX = pts[i].x;
    if (pts[i].y < minY) minY = pts[i].y;
    if (pts[i].y > maxY) maxY = pts[i].y;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const pad = 0.08;
  isoScale = Math.min(W * (1 - pad * 2) / rawW, H * (1 - pad * 2) / rawH);
  originX = W / 2 - ((maxX + minX) / 2) * isoScale;
  originY = H * 0.52 - ((maxY + minY) / 2) * isoScale;
}

function FALL_Y_DISTANCE_TOTAL() {
  return BOUNCE_Y_MAX + DROP_Y_DISTANCE;
}

// ---------------------------------------------------------------------------
// Draw isometric block
// ---------------------------------------------------------------------------
function drawIsoBlock(wx, wy, wz, bw, bd, bh, r, g, b, alpha, tiltY) {
  const tz = tiltY || 0;
  const B = toScreen(wx + bw, wy, wz);
  const C = toScreen(wx + bw, wy + bd, wz + tz);
  const D = toScreen(wx, wy + bd, wz + tz);
  const E = toScreen(wx, wy, wz + bh);
  const F = toScreen(wx + bw, wy, wz + bh);
  const G = toScreen(wx + bw, wy + bd, wz + bh + tz);
  const H2 = toScreen(wx, wy + bd, wz + bh + tz);

  ctx.globalAlpha = alpha;

  // Left face (darkest)
  ctx.fillStyle = 'rgb(' + Math.round(r * 0.5) + ',' + Math.round(g * 0.5) + ',' + Math.round(b * 0.5) + ')';
  ctx.beginPath();
  ctx.moveTo(H2.x, H2.y); ctx.lineTo(D.x, D.y);
  ctx.lineTo(C.x, C.y); ctx.lineTo(G.x, G.y);
  ctx.closePath(); ctx.fill();

  // Right face (medium)
  ctx.fillStyle = 'rgb(' + Math.round(r * 0.7) + ',' + Math.round(g * 0.7) + ',' + Math.round(b * 0.7) + ')';
  ctx.beginPath();
  ctx.moveTo(F.x, F.y); ctx.lineTo(B.x, B.y);
  ctx.lineTo(C.x, C.y); ctx.lineTo(G.x, G.y);
  ctx.closePath(); ctx.fill();

  // Top face (brightest)
  ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
  ctx.beginPath();
  ctx.moveTo(E.x, E.y); ctx.lineTo(F.x, F.y);
  ctx.lineTo(G.x, G.y); ctx.lineTo(H2.x, H2.y);
  ctx.closePath(); ctx.fill();

  // Edges
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(E.x, E.y); ctx.lineTo(F.x, F.y);
  ctx.lineTo(G.x, G.y); ctx.lineTo(H2.x, H2.y);
  ctx.closePath();
  ctx.moveTo(F.x, F.y); ctx.lineTo(B.x, B.y);
  ctx.moveTo(G.x, G.y); ctx.lineTo(C.x, C.y);
  ctx.moveTo(H2.x, H2.y); ctx.lineTo(D.x, D.y);
  ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y);
  ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Draw conveyor belt
// ---------------------------------------------------------------------------
function drawBelt() {
  const bz = BELT_Z;
  const bt = BELT_THICKNESS;

  // Support legs
  const legW = 0.4, legD = 0.4;
  const legs = [1.5, 7, 13, 19];
  for (let li = 0; li < legs.length; li++) {
    drawIsoBlock(legs[li], 0.3, 0, legW, legD, bz, 42, 42, 47, 1);
    drawIsoBlock(legs[li], BELT_WIDTH - legD - 0.3, 0, legW, legD, bz, 42, 42, 47, 1);
  }

  // Belt body
  drawIsoBlock(0, 0, bz, BELT_LENGTH, BELT_WIDTH, bt, 65, 65, 70, 1);

  // Belt segment lines (animated)
  const segSpacing = 1.6;
  const offset = (time * BELT_SPEED) % segSpacing;
  ctx.strokeStyle = 'rgba(85, 85, 90, 0.4)';
  ctx.lineWidth = 1;
  for (let sx = offset; sx <= BELT_LENGTH; sx += segSpacing) {
    const p1 = toScreen(sx, 0.05, bz + bt + 0.01);
    const p2 = toScreen(sx, BELT_WIDTH - 0.05, bz + bt + 0.01);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}

function drawRails() {
  drawIsoBlock(0, BELT_WIDTH, BELT_Z + BELT_THICKNESS, BELT_LENGTH, RAIL_WIDTH, RAIL_HEIGHT, 50, 50, 55, 1);
  drawIsoBlock(0, -RAIL_WIDTH, BELT_Z + BELT_THICKNESS, BELT_LENGTH, RAIL_WIDTH, RAIL_HEIGHT, 50, 50, 55, 1);
}

// ---------------------------------------------------------------------------
// Draw machine
// ---------------------------------------------------------------------------
function drawMachine() {
  const my = (BELT_WIDTH - MACHINE_DEPTH) / 2;

  drawIsoBlock(-MACHINE_LENGTH, my, 0, MACHINE_LENGTH, MACHINE_DEPTH, MACHINE_HEIGHT, 50, 50, 55, 1);

  drawIsoBlock(
    -MACHINE_LENGTH + 0.3, my + 0.3, MACHINE_HEIGHT,
    MACHINE_LENGTH - 0.6, MACHINE_DEPTH - 0.6, 0.2,
    38, 38, 42, 1
  );

  // Output slot
  const slotD = BLOCK_D + 0.5;
  const slotH = BLOCK_H + 0.7;
  const slotY = (BELT_WIDTH - slotD) / 2;
  drawIsoBlock(-0.12, slotY, BELT_Z + BELT_THICKNESS, 0.12, slotD, slotH, 12, 12, 15, 1);

  // Stack light — 3-layer housing with red/amber/green lamps
  const slY = (BELT_WIDTH + MACHINE_DEPTH) / 2;
  drawIsoBlock(
    -MACHINE_LENGTH / 2 - 0.15, slY - 0.15, MACHINE_HEIGHT,
    0.3, 0.3, 1.2,
    25, 25, 28, 1
  );

  const redAmt   = Math.max(0, 1 - morphProgress * 3);
  const amberAmt = Math.max(0, 1 - Math.abs(morphProgress - 0.2) * 6);
  const greenAmt = clamp(morphProgress * 3 - 0.5, 0, 1);

  const slRed   = toScreen(-MACHINE_LENGTH / 2, slY, MACHINE_HEIGHT + 1.0);
  const slAmber = toScreen(-MACHINE_LENGTH / 2, slY, MACHINE_HEIGHT + 0.7);
  const slGreen = toScreen(-MACHINE_LENGTH / 2, slY, MACHINE_HEIGHT + 0.4);

  // Red lamp (top)
  ctx.fillStyle = 'rgba(255, 50, 30, ' + (redAmt * 0.15) + ')';
  ctx.beginPath(); ctx.arc(slRed.x, slRed.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 50, 30, ' + redAmt + ')';
  ctx.beginPath(); ctx.arc(slRed.x, slRed.y, 3, 0, Math.PI * 2); ctx.fill();

  // Amber lamp (middle)
  ctx.fillStyle = 'rgba(255, 170, 0, ' + (amberAmt * 0.15) + ')';
  ctx.beginPath(); ctx.arc(slAmber.x, slAmber.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255, 170, 0, ' + amberAmt + ')';
  ctx.beginPath(); ctx.arc(slAmber.x, slAmber.y, 3, 0, Math.PI * 2); ctx.fill();

  // Green lamp (bottom)
  ctx.fillStyle = 'rgba(0, 204, 102, ' + (greenAmt * 0.15) + ')';
  ctx.beginPath(); ctx.arc(slGreen.x, slGreen.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0, 204, 102, ' + greenAmt + ')';
  ctx.beginPath(); ctx.arc(slGreen.x, slGreen.y, 3, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Draw scanner (headlamp module on machine edge + cone beam)
// ---------------------------------------------------------------------------
function drawScannerModule(dropZ, alpha) {
  if (alpha <= 0) return;

  const scanZ = BELT_Z + BELT_THICKNESS + 1.0 + dropZ;
  const scanY = (BELT_WIDTH - 0.7) / 2;

  // Mounting bracket (flat plate on machine face)
  drawIsoBlock(-0.4, scanY, scanZ - 0.2,
    0.55, 0.7, 0.2,
    55, 55, 62, alpha);

  // Headlamp housing (compact body)
  drawIsoBlock(-0.15, scanY + 0.05, scanZ,
    0.55, 0.6, 0.45,
    40, 130, 78, alpha);

  // Lens plate (thin bright face on +x side)
  drawIsoBlock(0.38, scanY + 0.1, scanZ + 0.05,
    0.08, 0.5, 0.35,
    70, 210, 120, alpha * 0.9);

  // Lens glow
  const lp = toScreen(0.46, scanY + 0.35, scanZ + 0.22);
  const pulse = 0.5 + Math.sin(time * 4) * 0.3;
  ctx.globalAlpha = alpha * pulse;
  ctx.fillStyle = 'rgba(0, 255, 120, 0.25)';
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 255, 120, 0.9)';
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawScannerCone(dropZ, alpha) {
  if (alpha <= 0) return;

  const pulse = 0.4 + Math.sin(time * 5) * 0.25;
  const a = alpha * pulse;

  // Cone tip (scanner lens)
  const tipZ = BELT_Z + BELT_THICKNESS + 1.0 + dropZ + 0.22;
  const tipY = BELT_WIDTH / 2;
  const tipX = 0.5;
  const tip = toScreen(tipX, tipY, tipZ);

  // Cone base on belt surface
  const baseZ = BELT_Z + BELT_THICKNESS + 0.01;
  const farX = tipX + SCANNER_CONE_LEN;
  const bl = toScreen(farX, 0.15, baseZ);
  const br = toScreen(farX, BELT_WIDTH - 0.15, baseZ);

  // Outer cone fill
  ctx.globalAlpha = a * 0.1;
  ctx.fillStyle = '#0c6';
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.closePath();
  ctx.fill();

  // Brighter inner cone
  const il = toScreen(farX * 0.7, BELT_WIDTH * 0.2, baseZ);
  const ir = toScreen(farX * 0.7, BELT_WIDTH * 0.8, baseZ);
  ctx.globalAlpha = a * 0.08;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(il.x, il.y);
  ctx.lineTo(ir.x, ir.y);
  ctx.closePath();
  ctx.fill();

  // Cone edge lines
  ctx.globalAlpha = a * 0.35;
  ctx.strokeStyle = 'rgba(0, 204, 102, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y); ctx.lineTo(bl.x, bl.y);
  ctx.moveTo(tip.x, tip.y); ctx.lineTo(br.x, br.y);
  ctx.stroke();

  // Scan line on belt surface
  ctx.globalAlpha = a * 0.5;
  ctx.strokeStyle = 'rgba(0, 204, 102, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Draw counter gantry (blue) — split for correct depth ordering
// ---------------------------------------------------------------------------
// In this isometric projection, high-y = closer to camera (lower-right on screen).
// So the low-y post is BEHIND the belt, and the high-y post is IN FRONT.
const GANTRY_BACK_Y = -GANTRY_POST_D - 0.15;   // low y — behind belt
const GANTRY_FRONT_Y = BELT_WIDTH + 0.15;       // high y — in front of belt

// Back post (low y) — drawn BEFORE belt so belt covers it
function drawGantryBackPost(x, dropZ, alpha) {
  if (alpha <= 0) return;
  const postX = x - GANTRY_POST_W / 2;
  drawIsoBlock(postX, GANTRY_BACK_Y, dropZ,
    GANTRY_POST_W, GANTRY_POST_D, GANTRY_TOTAL_H,
    60, 60, 68, alpha);
}

// Laser beam — from center of back post to center of front post
function drawCounterBeam(x, dropZ, alpha) {
  if (alpha <= 0) return;

  const backCenterY = GANTRY_BACK_Y + GANTRY_POST_D / 2;
  const frontCenterY = GANTRY_FRONT_Y + GANTRY_POST_D / 2;
  const beamZ = BELT_Z + BELT_THICKNESS + BLOCK_H + 0.25 + dropZ * 0.3;
  const p1 = toScreen(x, backCenterY, beamZ);
  const p2 = toScreen(x, frontCenterY, beamZ);

  const pulse = 0.5 + Math.sin(time * 8 + 1.5) * 0.3;

  ctx.globalAlpha = alpha * pulse;
  ctx.strokeStyle = 'rgba(0, 170, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.lineWidth = 8;
  ctx.globalAlpha = alpha * pulse * 0.2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// Cross beam, unit, and front post — front post drawn last to occlude laser
function drawGantryFront(x, unitR, unitG, unitB, dropZ, alpha) {
  if (alpha <= 0) return;

  const postX = x - GANTRY_POST_W / 2;
  const beamZ = dropZ + GANTRY_TOTAL_H;

  // Cross beam
  drawIsoBlock(postX, GANTRY_BACK_Y, beamZ,
    GANTRY_POST_W, GANTRY_FRONT_Y + GANTRY_POST_D - GANTRY_BACK_Y, GANTRY_BEAM_H,
    unitR, unitG, unitB, alpha);

  // Counter unit (hangs from beam center)
  const unitY = (BELT_WIDTH - GANTRY_UNIT_D) / 2;
  const unitZ = beamZ - GANTRY_UNIT_H;
  drawIsoBlock(x - GANTRY_UNIT_W / 2, unitY, unitZ,
    GANTRY_UNIT_W, GANTRY_UNIT_D, GANTRY_UNIT_H,
    unitR, unitG, unitB, alpha * 0.85);

  // Front post (high y — closest to camera, drawn last to occlude laser)
  drawIsoBlock(postX, GANTRY_FRONT_Y, dropZ,
    GANTRY_POST_W, GANTRY_POST_D, GANTRY_TOTAL_H,
    60, 60, 68, alpha);
}

// ---------------------------------------------------------------------------
// Block management
// ---------------------------------------------------------------------------
function spawnBlock() {
  const m = morphProgress;
  const pFall = P_FALL * Math.max(0, 1 - m * 2);
  const pCrack = P_CRACK * Math.max(0, 1 - m * 2);
  const pDiscolor = P_DISCOLOR * Math.max(0, 1 - m * 2);

  const willFall = rng() < pFall;
  const isCracked = rng() < pCrack;
  const isDiscolored = rng() < pDiscolor;

  let c;
  if (isDiscolored) {
    c = DISCOLOR_COLORS[Math.floor(rng() * DISCOLOR_COLORS.length)];
  } else {
    c = BLOCK_COLORS[Math.floor(rng() * BLOCK_COLORS.length)];
  }

  const ySpread = lerp(0.3, 0.05, m);

  blocks.push({
    wx: 0.3,
    wy: (BELT_WIDTH - BLOCK_D) / 2 + (rng() - 0.5) * ySpread,
    wz: BELT_Z + BELT_THICKNESS,
    r: c[0], g: c[1], b: c[2],
    willFall: willFall,
    isCracked: isCracked,
    isDiscolored: isDiscolored,
    fallDir: rng() > 0.5 ? 1 : -1,
    fallTriggerX: BELT_LENGTH * (0.2 + rng() * 0.45),
    fallProgress: 0,
    startY: 0,
    crackAngle: rng() * Math.PI,
    bouncePhase: rng() * Math.PI * 2,
    alpha: 1,
    scanned: false,
    counted: false,
    scanFlash: 0,
    countFlash: 0,
  });
}

function updateBlocks(dt) {
  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnBlock();
    spawnTimer -= SPAWN_INTERVAL;
  }

  const hwActive = morphProgress >= SCAN_ACTIVE;

  // Cancel scheduled falls once we transition to the good state
  if (morphProgress >= 0.5) {
    for (let j = 0; j < blocks.length; j++) {
      if (blocks[j].willFall && blocks[j].fallProgress === 0) {
        blocks[j].willFall = false;
      }
    }
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const bl = blocks[i];

    // Scan / count detection (offsets fine-tune visual alignment)
    if (hwActive && !bl.scanned && bl.wx + BLOCK_W / 2 >= 0.5 + SCANNER_CONE_LEN) {
      bl.scanned = true;
      bl.scanFlash = SCAN_FLASH_DURATION;
      lastScanTime = time;
      advanceIPadCount();
    }
    if (hwActive && !bl.counted && bl.wx >= COUNTER_X - 0.7) {
      bl.counted = true;
      bl.countFlash = SCAN_FLASH_DURATION;
    }

    if (bl.scanFlash > 0) bl.scanFlash = Math.max(0, bl.scanFlash - dt);
    if (bl.countFlash > 0) bl.countFlash = Math.max(0, bl.countFlash - dt);

    // Fall — in-progress falls continue; new falls only start below morph 0.5
    if (bl.willFall && bl.wx >= bl.fallTriggerX && (bl.fallProgress > 0 || morphProgress < 0.5)) {
      if (bl.fallProgress === 0) bl.startY = bl.wy;
      bl.fallProgress += dt / FALL_DURATION;
      if (bl.fallProgress > 1) bl.fallProgress = 1;

      const speedMult = bl.fallProgress < BOUNCE_PHASE
        ? 1.0
        : 1.0 - ((bl.fallProgress - BOUNCE_PHASE) / (1 - BOUNCE_PHASE)) * 0.7;
      bl.wx += BELT_SPEED * dt * speedMult;
    } else {
      bl.wx += BELT_SPEED * dt;
    }

    // Alpha: fade-in at machine end, fade-out at belt end
    const fadeIn = Math.min(1, bl.wx / FADE_IN_DISTANCE);
    const fadeOut = bl.wx > FADE_OUT_START
      ? Math.max(0, 1 - (bl.wx - FADE_OUT_START) / FADE_OUT_DISTANCE)
      : 1;
    bl.alpha = fadeIn * fadeOut;

    // Extra fade during fall drop phase
    if (bl.willFall && bl.fallProgress > BOUNCE_PHASE) {
      const dp = (bl.fallProgress - BOUNCE_PHASE) / (1 - BOUNCE_PHASE);
      bl.alpha *= Math.max(0, 1 - dp * 1.5);
    }

    if (bl.wx > BELT_LENGTH + 2 || bl.alpha <= 0) {
      blocks.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Draw blocks
// ---------------------------------------------------------------------------
function drawCrack(sx, sy, size) {
  ctx.strokeStyle = 'rgba(20, 10, 5, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - size, sy - size * 0.3);
  ctx.lineTo(sx - size * 0.2 + 1, sy + size * 0.15);
  ctx.lineTo(sx + size * 0.3, sy - size * 0.1);
  ctx.lineTo(sx + size, sy + size * 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + size * 0.05, sy - size * 0.45);
  ctx.lineTo(sx - size * 0.1, sy + size * 0.4);
  ctx.stroke();
}

function drawBlocks() {
  const sorted = blocks.slice().sort((a, b) => (a.wx + a.wy) - (b.wx + b.wy));

  const rumbleScale = Math.max(0, 1 - morphProgress * 2);
  const colorMorph = clamp(morphProgress * 1.5, 0, 1);
  const crackFade = clamp(1 - morphProgress * 2.5, 0, 1);

  for (let i = 0; i < sorted.length; i++) {
    const bl = sorted[i];
    if (bl.alpha <= 0) continue;

    // Morph block color toward solution
    const solIdx = Math.abs(Math.round(bl.bouncePhase * 10)) % SOLUTION_COLORS.length;
    const solC = SOLUTION_COLORS[solIdx];
    const drawR = Math.round(lerp(bl.r, solC[0], colorMorph));
    const drawG = Math.round(lerp(bl.g, solC[1], colorMorph));
    const drawB = Math.round(lerp(bl.b, solC[2], colorMorph));

    let drawX = bl.wx;
    let drawY = bl.wy;
    let drawZ = bl.wz;
    let tiltY = 0;

    // Belt rumble (decreases with morph)
    const isFalling = bl.willFall && bl.fallProgress > 0;
    if (!isFalling) {
      drawY += Math.sin(time * RUMBLE_Y_FREQ + bl.bouncePhase) * RUMBLE_Y_AMP * rumbleScale;
      drawZ += Math.abs(Math.sin(time * RUMBLE_Z_FREQ + bl.bouncePhase * 1.3)) * RUMBLE_Z_AMP * rumbleScale;
    }

    // Scan / count flash bounce
    if (bl.scanFlash > 0) {
      const ft = 1 - bl.scanFlash / SCAN_FLASH_DURATION;
      drawZ += Math.sin(ft * Math.PI) * SCAN_BOUNCE_Z;
    }
    if (bl.countFlash > 0) {
      const ft2 = 1 - bl.countFlash / SCAN_FLASH_DURATION;
      drawZ += Math.sin(ft2 * Math.PI) * SCAN_BOUNCE_Z;
    }

    // Two-phase fall animation
    if (isFalling) {
      const fp = bl.fallProgress;
      if (fp < BOUNCE_PHASE) {
        const bp = fp / BOUNCE_PHASE;
        const bounceT = bp * BOUNCE_HALF_CYCLES * Math.PI;
        const envelope = bp * bp;
        const osc = Math.abs(Math.sin(bounceT));
        drawY = bl.startY + bl.fallDir * osc * envelope * BOUNCE_Y_MAX;
        drawZ = bl.wz + osc * envelope * BOUNCE_Z_HOP;
        tiltY = -bl.fallDir * osc * envelope * 0.4;
      } else {
        const dp2 = (fp - BOUNCE_PHASE) / (1 - BOUNCE_PHASE);
        const ease = dp2 * dp2;
        drawY = bl.startY + bl.fallDir * (BOUNCE_Y_MAX + ease * DROP_Y_DISTANCE);
        drawZ = bl.wz + BOUNCE_Z_HOP - ease * DROP_Z_DISTANCE;
        tiltY = -bl.fallDir * ease * DROP_TILT_MAX;
      }
    }

    // Draw block with morphed color
    drawIsoBlock(drawX, drawY, drawZ, BLOCK_W, BLOCK_D, BLOCK_H,
      drawR, drawG, drawB, bl.alpha, tiltY);

    // Cell grid on top face
    if (bl.alpha > 0.3 && Math.abs(tiltY) < 1.5) {
      const halfTilt = (tiltY || 0) * 0.5;
      const m1 = toScreen(drawX + BLOCK_W / 2, drawY, drawZ + BLOCK_H);
      const m2 = toScreen(drawX + BLOCK_W / 2, drawY + BLOCK_D, drawZ + BLOCK_H + tiltY);
      const m3 = toScreen(drawX, drawY + BLOCK_D / 2, drawZ + BLOCK_H + halfTilt);
      const m4 = toScreen(drawX + BLOCK_W, drawY + BLOCK_D / 2, drawZ + BLOCK_H + halfTilt);
      ctx.globalAlpha = bl.alpha;
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);
      ctx.moveTo(m3.x, m3.y); ctx.lineTo(m4.x, m4.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Crack — fades out with morph
    if (bl.isCracked && bl.alpha > 0.2 && crackFade > 0.01) {
      const crackTilt = (tiltY || 0) * 0.5;
      const cp = toScreen(drawX + BLOCK_W / 2, drawY + BLOCK_D / 2,
        drawZ + BLOCK_H + crackTilt);
      ctx.globalAlpha = bl.alpha * crackFade;
      drawCrack(cp.x, cp.y, BLOCK_W * isoScale * 0.35);
      ctx.globalAlpha = 1;
    }

    // Scan flash glow (green)
    if (bl.scanFlash > 0 && bl.alpha > 0.1) {
      const fa = (bl.scanFlash / SCAN_FLASH_DURATION) * bl.alpha * 0.45;
      const gp = toScreen(drawX + BLOCK_W / 2, drawY + BLOCK_D / 2, drawZ + BLOCK_H);
      ctx.globalAlpha = fa;
      ctx.fillStyle = '#0c6';
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, BLOCK_W * isoScale * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Count flash glow (blue)
    if (bl.countFlash > 0 && bl.alpha > 0.1) {
      const fa2 = (bl.countFlash / SCAN_FLASH_DURATION) * bl.alpha * 0.45;
      const gp2 = toScreen(drawX + BLOCK_W / 2, drawY + BLOCK_D / 2, drawZ + BLOCK_H);
      ctx.globalAlpha = fa2;
      ctx.fillStyle = '#0af';
      ctx.beginPath();
      ctx.arc(gp2.x, gp2.y, BLOCK_W * isoScale * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function buildIPadRow(parent, data, cls) {
  const row = document.createElement('div');
  row.className = 'ipad-row' + (cls ? ' ' + cls : '');

  const top = document.createElement('div');
  top.className = 'ipad-row-top';

  const name = document.createElement('span');
  name.className = 'ipad-row-name';
  name.textContent = data.variety;

  const count = document.createElement('span');
  count.className = 'ipad-row-count';

  top.appendChild(name);
  top.appendChild(count);
  row.appendChild(top);

  const bar = document.createElement('div');
  bar.className = 'ipad-row-bar';
  const fill = document.createElement('div');
  fill.className = 'ipad-row-fill';
  bar.appendChild(fill);
  row.appendChild(bar);

  parent.appendChild(row);
  return { el: row, count: count, fill: fill, data: data };
}

function buildIPad() {
  const table = document.getElementById('ipad-table');
  const tbody = document.createElement('div');

  ipadCounts = [];
  ipadActiveIdx = 0;
  for (let i = 0; i < IPAD_ROWS.length; i++) {
    ipadCounts.push(Math.round(IPAD_ROWS[i].target * IPAD_START_FRAC));
  }

  ipadEls.rows = [];
  for (let i = 0; i < IPAD_ROWS.length; i++) {
    const cls = i === 0 ? 'active' : '';
    ipadEls.rows.push(buildIPadRow(tbody, IPAD_ROWS[i], cls));
  }

  const warn = document.createElement('div');
  warn.className = 'ipad-warn-banner';
  warn.textContent = 'UNSCHEDULED - ATTENTION REQUIRED';
  tbody.appendChild(warn);

  ipadEls.unsched = buildIPadRow(tbody, IPAD_UNSCHED, 'warn');
  ipadEls.progressFill = document.getElementById('ipad-progress-fill');
  ipadEls.progressText = document.getElementById('ipad-progress-text');
  ipadEls.varietyName = document.querySelector('.ipad-variety-name');

  table.appendChild(tbody);
}

function resetIPadCounts() {
  ipadActiveIdx = 0;
  for (let i = 0; i < IPAD_ROWS.length; i++) {
    ipadCounts[i] = Math.round(IPAD_ROWS[i].target * IPAD_START_FRAC);
  }
}

function advanceIPadCount() {
  if (ipadActiveIdx >= IPAD_ROWS.length) return;
  ipadCounts[ipadActiveIdx]++;
  if (ipadCounts[ipadActiveIdx] >= IPAD_ROWS[ipadActiveIdx].target) {
    ipadActiveIdx++;
    if (ipadActiveIdx >= IPAD_ROWS.length) resetIPadCounts();
  }
}

function updateDashboard() {
  const dashStart = W < 600 ? 0.70 : DASH_MORPH_START;
  const dashAlpha = clamp((morphProgress - dashStart) / (DASH_MORPH_END - dashStart), 0, 1) * techFade;
  dashboardEl.style.opacity = dashAlpha;
  dashboardEl.style.pointerEvents = dashAlpha > 0.5 ? 'auto' : 'none';
  if (dashAlpha <= 0) return;

  // Info panel — tracks the currently active variety
  const activeData = IPAD_ROWS[ipadActiveIdx];
  ipadEls.varietyName.textContent = activeData.variety;
  ipadEls.progressFill.style.width = (ipadCounts[ipadActiveIdx] / activeData.target * 100) + '%';
  ipadEls.progressText.textContent = ipadCounts[ipadActiveIdx] + '/' + activeData.target + ' trays';

  // Schedule rows — name + mini progress bar
  for (let i = 0; i < ipadEls.rows.length; i++) {
    const r = ipadEls.rows[i];
    r.count.textContent = ipadCounts[i] + '/' + r.data.target;
    r.fill.style.width = (ipadCounts[i] / r.data.target * 100) + '%';
    r.el.classList.toggle('active', i === ipadActiveIdx);
  }

  // Unscheduled row — static anomaly
  ipadEls.unsched.count.textContent = IPAD_UNSCHED.count + '/0';
  ipadEls.unsched.fill.style.width = '100%';

  // Scan flash — highlight active row when a block passes the scanner
  const flashOn = (time - lastScanTime) < 0.3;
  ipadEls.rows[ipadActiveIdx].el.classList.toggle('scan-flash', flashOn);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;
  time += dt;

  updateBlocks(dt);

  const m = morphProgress;

  // Background lerp
  const bgR = Math.round(lerp(BG_PROBLEM[0], BG_SOLUTION[0], m));
  const bgG = Math.round(lerp(BG_PROBLEM[1], BG_SOLUTION[1], m));
  const bgB = Math.round(lerp(BG_PROBLEM[2], BG_SOLUTION[2], m));
  ctx.fillStyle = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
  ctx.fillRect(0, 0, W, H);

  // Hardware morph (smoothstep)
  const hwT = clamp((m - HW_MORPH_START) / (HW_MORPH_END - HW_MORPH_START), 0, 1);
  const easeHw = hwT * hwT * (3 - 2 * hwT);
  const dropZ = (1 - easeHw) * HW_DROP_DISTANCE;
  const hwAlpha = easeHw;

  // Beam alpha (delayed — lasers activate after hardware settles)
  const beamAlpha = clamp((hwT - 0.7) / 0.3, 0, 1);

  // Counter back post (low y) drawn BEFORE belt so it sits behind the conveyor
  if (hwAlpha > 0.01) {
    drawGantryBackPost(COUNTER_X, dropZ, hwAlpha);
  }

  // Draw scene
  drawMachine();
  drawBelt();
  drawRails();
  drawBlocks();

  // Scanner headlamp + counter (beam then near post so post occludes beam)
  if (hwAlpha > 0.01) {
    drawScannerModule(dropZ, hwAlpha);
    drawScannerCone(dropZ, beamAlpha);
    drawCounterBeam(COUNTER_X, dropZ, beamAlpha);
    drawGantryFront(COUNTER_X, 30, 100, 160, dropZ, hwAlpha);
  }

  // Dashboard
  updateDashboard();

  // Narrative lines — positioned on either side of the belt
  for (let i = 0; i < narrativeLines.length; i++) {
    const kf = interpolateKeyframes(LINE_KEYFRAMES[i], m);
    const side = narrativeSides[i];
    const zone = (side === 'left') ? zoneLeftPos : zoneRightPos;
    const el = narrativeLines[i];

    el.style.opacity = kf.op * techFade;
    el.style.filter = kf.blur > 0.1 ? 'blur(' + kf.blur.toFixed(1) + 'px)' : 'none';
    el.style.left = zone.x + 'px';
    el.style.top = (zone.y + kf.y * 40) + 'px';
    el.style.transform = (side === 'left') ? 'translateX(-100%)' : 'none';
    el.style.textAlign = (side === 'left') ? 'right' : 'left';
  }

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  const container = document.getElementById('canvas-container');
  canvas = document.createElement('canvas');
  container.appendChild(canvas);
  ctx = canvas.getContext('2d');
  rng = alea('oasis-line');

  // DOM refs
  progressBar = document.getElementById('progress-bar');
  scrollHint = document.getElementById('scroll-hint');
  headerPanelEl = document.getElementById('header-panel');
  titleOverlayEl = document.getElementById('title-overlay');
  dashboardEl = document.getElementById('dashboard');

  const nlEls = document.querySelectorAll('.narrative-line');
  narrativeLines = [];
  narrativeSides = [];
  for (let i = 0; i < nlEls.length; i++) {
    narrativeLines.push(nlEls[i]);
    narrativeSides.push(nlEls[i].getAttribute('data-side') || (i % 2 === 0 ? 'left' : 'right'));
    nlEls[i].style.color = NARRATIVE_COLORS[i];
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout();
    computeZoneAnchors();
  }

  buildIPad();
  resize();
  window.addEventListener('resize', resize);
  document.fonts.ready.then(computeZoneAnchors);

  // GSAP ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // Main scroll-driven morph
  ScrollTrigger.create({
    trigger: '#runway',
    start: 'top top',
    end: 'bottom bottom',
    scrub: SCRUB_SMOOTHING,
    onUpdate: (self) => {
      morphProgress = self.progress;
      progressBar.style.width = (self.progress * 100) + '%';
      scrollHint.style.opacity = self.progress < SCROLL_HINT_THRESHOLD ? 1 : 0;
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

        titleOverlayEl.style.transform = 'scale(' + lerp(1, 0.55, p) + ')';

        // Hide fixed panels once fully in tech section
        const vis = p >= 1 ? 'hidden' : 'visible';
        dashboardEl.style.visibility = vis;
        for (let ni = 0; ni < narrativeLines.length; ni++) {
          narrativeLines[ni].style.visibility = vis;
        }

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
    for (let ri = 0; ri < techRows.length; ri++) {
      gsap.fromTo(techRows[ri],
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: techRows[ri],
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

  requestAnimationFrame(render);
}

document.addEventListener('DOMContentLoaded', init);
