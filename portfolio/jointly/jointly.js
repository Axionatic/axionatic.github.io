'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PARTICLE_COUNT = 80;
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 1200;
const SCALE_DIVISOR = 800;

// Particle group sizes (one per seller)
const GROUPS = [
  { size: 20 },
  { size: 18 },
  { size: 16 },
  { size: 14 },
  { size: 12 },
];

// Desktop positions computed dynamically — see computeDesktopPositions()

// Tech section positions (die-5 / quincunx pattern)
const TECH_POSITIONS = [
  { cx: 0.12, cy: 0.15 },
  { cx: 0.88, cy: 0.15 },
  { cx: 0.50, cy: 0.50 },
  { cx: 0.12, cy: 0.85 },
  { cx: 0.88, cy: 0.85 },
];

const MOBILE_GROUPS = [
  { cx: 0.25, cy: 0.38 },
  { cx: 0.70, cy: 0.35 },
  { cx: 0.20, cy: 0.58 },
  { cx: 0.65, cy: 0.56 },
  { cx: 0.45, cy: 0.72 },
];

// Desktop placement algorithm (fractions of min(W,H))
const GROUP_MARGIN_RADIUS = 0.10;
const CANDIDATE_GRID_STEP = 0.04;
const WALL_DISTANCE_WEIGHT = 0.67;

// Cluster ring geometry (fractions of min(W,H))
const INNER_RING_RADIUS = 0.04;
const OUTER_RING_RADIUS = 0.075;
const INNER_RING_COUNT = 6;

// Solution-state particle appearance
const SOLUTION_PARTICLE_SIZE = 6;
const SOLUTION_PARTICLE_OPACITY = 0.9;

// Problem-state scatter ranges (fractions of viewport)
const PROBLEM_X_OFFSET = 0.05;
const PROBLEM_X_SPAN = 0.90;
const PROBLEM_Y_OFFSET = 0.08;
const PROBLEM_Y_SPAN = 0.84;
const PROBLEM_SIZE_MIN = 3;
const PROBLEM_SIZE_RANGE = 8;
const PROBLEM_OPACITY_MIN = 0.5;
const PROBLEM_OPACITY_RANGE = 0.5;

// Connection lines
const CONNECTION_MORPH_START = 0.5;
const CONNECTION_FADE_RANGE = 0.3;
const CONNECTION_DIST_THRESHOLD = 0.08;
const CONNECTION_OPACITY = 0.25;

// Breathing & chaos animation
const HOLD_STRENGTH_SCALE = 5;
const BREATH_AMP_SCALE = 3;
const CHAOS_AMP_SCALE = 5;
const BREATH_FREQ_X = 0.5;
const BREATH_PHASE_X = 0.7;
const CHAOS_FREQ_X = 1.2;
const CHAOS_PHASE_X = 2.3;
const BREATH_FREQ_Y = 0.6;
const BREATH_PHASE_Y = 0.9;
const CHAOS_FREQ_Y = 0.9;
const CHAOS_PHASE_Y = 1.7;

// Glow halo (solution state)
const GLOW_MORPH_START = 0.7;
const GLOW_FADE_RANGE = 0.3;
const GLOW_ALPHA_SCALE = 0.12;
const GLOW_SIZE_SCALE = 2.5;

// Ranking panel reveal
const RANKING_MORPH_START = 0.65;
const RANKING_FADE_RANGE = 0.25;
const RANKING_INTERACT_THRESHOLD = 0.5;
const BAR_GAP_DESKTOP = 10;
const BAR_GAP_MOBILE = 6;
const BAR_ROW_HEIGHT_INIT = 48;

// Narrative
const LINE_GAP_PADDING = 4;
const LINE_GAP_FALLBACK = 40;

// Scroll
const SCRUB_SMOOTHING = 0.8;
const SCROLL_HINT_THRESHOLD = 0.03;

// Tooltip
const TOOLTIP_SCORE_SCALE = 10;

// Frame timing
const FRAME_DT = 0.016;

// Seller data
const SELLERS = [
  { name: 'BulkBazaar',  delivery: 7, price: 9, extras: 6, rating: 8 },
  { name: 'QuickShip',   delivery: 10, price: 5, extras: 4, rating: 7 },
  { name: 'ValueVault',  delivery: 4, price: 10, extras: 5, rating: 6 },
  { name: 'TrustTrade',  delivery: 6, price: 6, extras: 8, rating: 10 },
  { name: 'BonusBarn',   delivery: 5, price: 7, extras: 10, rating: 5 },
];

const ATTRS = ['delivery', 'price', 'extras', 'rating'];
const ATTR_LABELS = ['Delivery time', 'Price', 'Extras/Bonuses', 'Seller rating'];

const PREFERENCES = [
  { label: 'Low price, quick delivery', weights: [0.35, 0.40, 0.10, 0.15] },
  { label: 'Trusted seller, great addons', weights: [0.10, 0.15, 0.35, 0.40] },
  { label: 'Get it ASAP!', weights: [0.60, 0.15, 0.10, 0.15] },
];

const BAR_COLORS = ['#0cc', '#0af', '#08f', '#0ea', '#4df'];

// Narrative keyframes: per-line arrays of [morphProgress, offsetY_multiplier, opacity]
const LINE_KEYFRAMES = [
  [[0, 0, 1], [0.07, -1, 1], [0.31, -1, 1], [0.38, -1.5, 0]],
  [[0, 0.5, 0], [0.07, 0, 1], [0.31, 0, 1], [0.38, -1, 1], [0.62, -1, 1], [0.69, -1.5, 0]],
  [[0.31, 0.5, 0], [0.38, 0, 1], [0.62, 0, 1], [0.69, -1, 1], [0.93, -1, 1], [1.0, -1.5, 0]],
  [[0.62, 0.5, 0], [0.69, 0, 1], [0.93, 0, 1], [1.0, -1, 1]],
  [[0.93, 0.5, 0], [1.0, 0, 1]],
];

const PROBLEM_PALETTE = ['#f96', '#fa5', '#fc6', '#f76', '#e85'];
const SOLUTION_PALETTE = ['#0cc', '#0af', '#08f', '#0ea', '#4df'];

const BG_PROBLEM = [12, 5, 8];
const BG_SOLUTION = [5, 8, 18];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function measureLineGaps() {
  if (!narrativeLines.length) return;
  lineGaps = narrativeLines.map((el) => el.offsetHeight + LINE_GAP_PADDING);
}

// Pre-parse palettes
const PROBLEM_RGB = PROBLEM_PALETTE.map(hexToRgb);
const SOLUTION_RGB = SOLUTION_PALETTE.map(hexToRgb);

// Precompute group start indices
const GROUP_STARTS = [];
let _off = 0;
for (const g of GROUPS) { GROUP_STARTS.push(_off); _off += g.size; }

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let canvas, ctx, dpr;
let W, H, S;
let lineGaps = [];
let morphProgress = 0;
let time = 0;
let problemEls = [];
let solutionEls = [];
let techEls = [];
let techProgress = 0;
let progressBar, scrollHint;
let narrativeLines = [];
let rankingEl, rankingBarsEl, tooltipEl, headerPanelEl;
let titleOverlayEl, narrativeEl;
let narrativeOrigH = 0;
let techFade = 1;
let barEls = [];
let currentPref = 0;
let rowHeight = BAR_ROW_HEIGHT_INIT;

// ---------------------------------------------------------------------------
// Scoring & ranking
// ---------------------------------------------------------------------------
function computeScores() {
  const w = PREFERENCES[currentPref].weights;
  return SELLERS.map((s) => s.delivery * w[0] + s.price * w[1] + s.extras * w[2] + s.rating * w[3]);
}

function updateBars() {
  const scores = computeScores();
  const sorted = scores.map((sc, i) => ({ idx: i, score: sc }))
    .sort((a, b) => b.score - a.score);
  const maxScore = sorted[0].score;

  for (let i = 0; i < sorted.length; i++) {
    const idx = sorted[i].idx;
    const bar = barEls[idx];
    bar.rank = i;
    bar.normalizedW = sorted[i].score / maxScore;
    bar.el.style.top = (i * rowHeight) + 'px';
    bar.label.textContent = '#' + (i + 1) + '\u2002' + SELLERS[idx].name;
    bar.fill.style.boxShadow = i === 0 ? '0 0 12px ' + BAR_COLORS[idx] : 'none';
  }
}

function getTooltipHTML(sellerIdx) {
  const s = SELLERS[sellerIdx];
  const w = PREFERENCES[currentPref].weights;
  const avgs = ATTRS.map((attr) =>
    SELLERS.reduce((sum, seller) => sum + seller[attr], 0) / SELLERS.length
  );

  let html = '<div class="tooltip-name">' + s.name + "'s Offer</div>";
  for (let i = 0; i < ATTRS.length; i++) {
    const delta = Math.round((s[ATTRS[i]] - avgs[i]) * w[i] * TOOLTIP_SCORE_SCALE);
    const cls = delta >= 0 ? 'tooltip-pos' : 'tooltip-neg';
    const sign = delta >= 0 ? '+' : '';
    html += '<div class="' + cls + '">' + ATTR_LABELS[i] + ': ' + sign + delta + '</div>';
  }
  return html;
}

// ---------------------------------------------------------------------------
// Compute desktop group positions (farthest-point sampling in free space)
// ---------------------------------------------------------------------------
function computeDesktopPositions() {
  const titleImg = document.getElementById('title-overlay');
  const headerPanel = document.getElementById('header-panel');
  const tRect = titleImg.getBoundingClientRect();
  const hpRect = headerPanel.getBoundingClientRect();
  const rRect = rankingEl.getBoundingClientRect();

  const groupR = Math.min(W, H) * GROUP_MARGIN_RADIUS;

  // Allowed area: everything below the logo bottom edge
  const topBound = tRect.bottom + groupR;
  const edgeM = groupR;

  // Cutouts: the story text panel (header panel below logo) and ranking bars
  const exclusions = [
    { x1: hpRect.left - groupR, y1: topBound - groupR, x2: hpRect.right + groupR, y2: hpRect.bottom + groupR },
    { x1: rRect.left - groupR, y1: rRect.top - groupR, x2: rRect.right + groupR, y2: rRect.bottom + groupR },
  ];

  // Build candidate grid within allowed bounds
  const candidates = [];
  const step = Math.min(W, H) * CANDIDATE_GRID_STEP;

  for (let x = edgeM; x <= W - edgeM; x += step) {
    for (let y = topBound; y <= H - edgeM; y += step) {
      let blocked = false;
      for (let e = 0; e < exclusions.length; e++) {
        if (x >= exclusions[e].x1 && x <= exclusions[e].x2 &&
            y >= exclusions[e].y1 && y <= exclusions[e].y2) {
          blocked = true;
          break;
        }
      }
      if (!blocked) candidates.push([x, y]);
    }
  }

  if (candidates.length < 5) {
    return [
      { cx: 0.15, cy: 0.50 }, { cx: 0.40, cy: 0.45 },
      { cx: 0.12, cy: 0.70 }, { cx: 0.35, cy: 0.72 },
      { cx: 0.22, cy: 0.88 },
    ];
  }

  // Seed: candidate with max min-distance to any exclusion edge or screen edge
  let bestIdx = 0, bestVal = 0;
  for (let i = 0; i < candidates.length; i++) {
    const px = candidates[i][0], py = candidates[i][1];
    let minD = Math.min(px / WALL_DISTANCE_WEIGHT, (py - topBound + edgeM) / WALL_DISTANCE_WEIGHT, (W - px) / WALL_DISTANCE_WEIGHT, (H - py) / WALL_DISTANCE_WEIGHT);
    for (let e = 0; e < exclusions.length; e++) {
      const ex = exclusions[e];
      const dx = Math.max(ex.x1 - px, 0, px - ex.x2);
      const dy = Math.max(ex.y1 - py, 0, py - ex.y2);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minD) minD = d;
    }
    if (minD > bestVal) { bestVal = minD; bestIdx = i; }
  }

  const chosen = [candidates[bestIdx]];
  candidates.splice(bestIdx, 1);

  // Farthest-point sampling: maximise min distance to chosen points AND boundaries
  for (let n = 1; n < 5; n++) {
    bestIdx = 0; bestVal = 0;
    for (let i = 0; i < candidates.length; i++) {
      const px = candidates[i][0], py = candidates[i][1];
      // Treat viewport/top edges as walls — discounted so groups prefer spacing each other over walls
      let minD = Math.min(px / WALL_DISTANCE_WEIGHT, (W - px) / WALL_DISTANCE_WEIGHT, (py - topBound + edgeM) / WALL_DISTANCE_WEIGHT, (H - py) / WALL_DISTANCE_WEIGHT);
      for (let j = 0; j < chosen.length; j++) {
        const dx = px - chosen[j][0];
        const dy = py - chosen[j][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) minD = d;
      }
      if (minD > bestVal) { bestVal = minD; bestIdx = i; }
    }
    chosen.push(candidates[bestIdx]);
    candidates.splice(bestIdx, 1);
  }

  return chosen.map((p) => ({ cx: p[0] / W, cy: p[1] / H }));
}

// ---------------------------------------------------------------------------
// Generate problem state (scattered buyers)
// ---------------------------------------------------------------------------
function generateProblem() {
  const rng = alea('jointly');
  const els = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const c = PROBLEM_RGB[Math.floor(rng() * PROBLEM_RGB.length)];
    els.push({
      x: W * (PROBLEM_X_OFFSET + rng() * PROBLEM_X_SPAN),
      y: H * (PROBLEM_Y_OFFSET + rng() * PROBLEM_Y_SPAN),
      size: (PROBLEM_SIZE_MIN + rng() * PROBLEM_SIZE_RANGE) * S,
      opacity: PROBLEM_OPACITY_MIN + rng() * PROBLEM_OPACITY_RANGE,
      r: c[0], g: c[1], b: c[2],
    });
  }
  return els;
}

// ---------------------------------------------------------------------------
// Generate solution state (clustered groups)
// ---------------------------------------------------------------------------
function generateSolution() {
  const els = [];
  const innerR = Math.min(W, H) * INNER_RING_RADIUS;
  const outerR = Math.min(W, H) * OUTER_RING_RADIUS;
  const positions = W <= TABLET_BREAKPOINT ? MOBILE_GROUPS : computeDesktopPositions();

  for (let gi = 0; gi < GROUPS.length; gi++) {
    const grp = GROUPS[gi];
    const c = SOLUTION_RGB[gi];
    const gpos = positions[gi];

    for (let pi = 0; pi < grp.size; pi++) {
      let ox = 0, oy = 0;

      if (pi === 0) {
        // center particle
      } else if (pi <= INNER_RING_COUNT) {
        const a = ((pi - 1) / INNER_RING_COUNT) * Math.PI * 2;
        ox = Math.cos(a) * innerR;
        oy = Math.sin(a) * innerR;
      } else {
        const n = grp.size - (INNER_RING_COUNT + 1);
        const a2 = ((pi - (INNER_RING_COUNT + 1)) / n) * Math.PI * 2;
        ox = Math.cos(a2) * outerR;
        oy = Math.sin(a2) * outerR;
      }

      els.push({
        x: gpos.cx * W + ox,
        y: gpos.cy * H + oy,
        size: SOLUTION_PARTICLE_SIZE * S,
        opacity: SOLUTION_PARTICLE_OPACITY,
        r: c[0], g: c[1], b: c[2],
      });
    }
  }
  return els;
}

// ---------------------------------------------------------------------------
// Generate tech state (die-5 quincunx pattern)
// ---------------------------------------------------------------------------
function generateTechState() {
  const els = [];
  const innerR = Math.min(W, H) * INNER_RING_RADIUS;
  const outerR = Math.min(W, H) * OUTER_RING_RADIUS;

  for (let gi = 0; gi < GROUPS.length; gi++) {
    const grp = GROUPS[gi];
    const c = SOLUTION_RGB[gi];
    const gpos = TECH_POSITIONS[gi];

    for (let pi = 0; pi < grp.size; pi++) {
      let ox = 0, oy = 0;

      if (pi === 0) {
        // center particle
      } else if (pi <= INNER_RING_COUNT) {
        const a = ((pi - 1) / INNER_RING_COUNT) * Math.PI * 2;
        ox = Math.cos(a) * innerR;
        oy = Math.sin(a) * innerR;
      } else {
        const n = grp.size - (INNER_RING_COUNT + 1);
        const a2 = ((pi - (INNER_RING_COUNT + 1)) / n) * Math.PI * 2;
        ox = Math.cos(a2) * outerR;
        oy = Math.sin(a2) * outerR;
      }

      els.push({
        x: gpos.cx * W + ox,
        y: gpos.cy * H + oy,
        size: SOLUTION_PARTICLE_SIZE * S,
        opacity: SOLUTION_PARTICLE_OPACITY,
        r: c[0], g: c[1], b: c[2],
      });
    }
  }
  return els;
}

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
function generateScene() {
  problemEls = generateProblem();
  solutionEls = generateSolution();
  techEls = generateTechState();
}

// ---------------------------------------------------------------------------
// Draw connection lines (within-group, batched)
// ---------------------------------------------------------------------------
function drawConnections(positions, t) {
  if (t < CONNECTION_MORPH_START) return;
  const fadeIn = Math.min(1, (t - CONNECTION_MORPH_START) / CONNECTION_FADE_RANGE);
  const thresh2 = Math.pow(Math.min(W, H) * CONNECTION_DIST_THRESHOLD, 2);

  ctx.lineWidth = 1;

  for (let gi = 0; gi < GROUPS.length; gi++) {
    const start = GROUP_STARTS[gi];
    const end = start + GROUPS[gi].size;
    const c = SOLUTION_RGB[gi];

    ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (fadeIn * CONNECTION_OPACITY) + ')';
    ctx.beginPath();

    for (let i = start; i < end; i++) {
      for (let j = i + 1; j < end; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        if (dx * dx + dy * dy < thresh2) {
          ctx.moveTo(positions[i].x, positions[i].y);
          ctx.lineTo(positions[j].x, positions[j].y);
        }
      }
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
  time += FRAME_DT;
  const t = morphProgress;

  // Background
  const bgR = Math.round(lerp(BG_PROBLEM[0], BG_SOLUTION[0], t));
  const bgG = Math.round(lerp(BG_PROBLEM[1], BG_SOLUTION[1], t));
  const bgB = Math.round(lerp(BG_PROBLEM[2], BG_SOLUTION[2], t));
  ctx.fillStyle = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
  ctx.fillRect(0, 0, W, H);

  // Breathing amplitude
  const holdStrength = Math.max(0, 1 - Math.min(t, 1 - t) * HOLD_STRENGTH_SCALE);
  const breathAmp = holdStrength * BREATH_AMP_SCALE * S;
  const chaosAmp = (1 - t) * CHAOS_AMP_SCALE * S;

  // Compute current positions
  const positions = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = problemEls[i];
    const s = solutionEls[i];
    const bx = Math.sin(time * BREATH_FREQ_X + i * BREATH_PHASE_X) * breathAmp
             + Math.sin(time * CHAOS_FREQ_X + i * CHAOS_PHASE_X) * chaosAmp;
    const by = Math.cos(time * BREATH_FREQ_Y + i * BREATH_PHASE_Y) * breathAmp
             + Math.cos(time * CHAOS_FREQ_Y + i * CHAOS_PHASE_Y) * chaosAmp;
    let baseX = lerp(p.x, s.x, t);
    let baseY = lerp(p.y, s.y, t);
    if (techProgress > 0) {
      const te = techEls[i];
      baseX = lerp(baseX, te.x, techProgress);
      baseY = lerp(baseY, te.y, techProgress);
    }
    positions.push({
      x: baseX + bx,
      y: baseY + by,
    });
  }

  // Connection lines
  drawConnections(positions, t);

  // Particles
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = problemEls[i];
    const s = solutionEls[i];
    const pos = positions[i];
    const sz = lerp(p.size, s.size, t);
    const op = lerp(p.opacity, s.opacity, t);
    const cr = Math.round(lerp(p.r, s.r, t));
    const cg = Math.round(lerp(p.g, s.g, t));
    const cb = Math.round(lerp(p.b, s.b, t));

    // Glow halo in solution state
    if (t > GLOW_MORPH_START) {
      const ga = ((t - GLOW_MORPH_START) / GLOW_FADE_RANGE) * GLOW_ALPHA_SCALE * op;
      ctx.globalAlpha = ga;
      ctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, sz * GLOW_SIZE_SCALE, 0, Math.PI * 2);
      ctx.fill();
    }

    // Core particle
    ctx.globalAlpha = op;
    ctx.fillStyle = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ranking panel
  if (t < RANKING_MORPH_START) {
    rankingEl.style.opacity = 0;
    rankingEl.style.pointerEvents = 'none';
    if (W > TABLET_BREAKPOINT) headerPanelEl.classList.remove('shifted');
  } else {
    const alpha = Math.min(1, (t - RANKING_MORPH_START) / RANKING_FADE_RANGE) * techFade;
    rankingEl.style.opacity = alpha;
    rankingEl.style.pointerEvents = alpha > RANKING_INTERACT_THRESHOLD ? 'auto' : 'none';
    if (W > TABLET_BREAKPOINT) {
      if (techProgress > 0) headerPanelEl.classList.remove('shifted');
      else headerPanelEl.classList.add('shifted');
    }
    for (let i = 0; i < barEls.length; i++) {
      barEls[i].fill.style.width = (barEls[i].normalizedW * alpha * 100) + '%';
    }
  }

  // Narrative lines
  for (let i = 0; i < narrativeLines.length; i++) {
    const kf = interpolateKeyframes(LINE_KEYFRAMES[i], t);
    const gap = lineGaps[i] || LINE_GAP_FALLBACK;
    narrativeLines[i].style.opacity = kf.op;
    narrativeLines[i].style.transform = 'translateX(-50%) translateY(' + (kf.y * gap) + 'px)';
  }

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Build ranking bars
// ---------------------------------------------------------------------------
function buildBars() {
  rankingBarsEl.innerHTML = '';
  barEls = [];

  for (let i = 0; i < SELLERS.length; i++) {
    const bar = document.createElement('div');
    bar.className = 'ranking-bar';
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('role', 'listitem');
    bar.style.setProperty('--bar-color', BAR_COLORS[i]);

    const track = document.createElement('div');
    track.className = 'ranking-track';
    bar.appendChild(track);

    const fill = document.createElement('div');
    fill.className = 'ranking-fill';
    bar.appendChild(fill);

    const label = document.createElement('span');
    label.className = 'ranking-label';
    bar.appendChild(label);

    rankingBarsEl.appendChild(bar);
    barEls.push({ el: bar, fill: fill, label: label, sellerIdx: i, rank: i, normalizedW: 0 });

    const showTooltip = () => {
      tooltipEl.innerHTML = getTooltipHTML(i);
      tooltipEl.style.top = (rankingBarsEl.offsetTop + bar.offsetTop) + 'px';
      tooltipEl.classList.add('visible');
    };
    const hideTooltip = () => {
      tooltipEl.classList.remove('visible');
    };
    bar.addEventListener('mouseenter', showTooltip);
    bar.addEventListener('mouseleave', hideTooltip);
    bar.addEventListener('focus', () => { if (!tooltipEl._touchActive) showTooltip(); });
    bar.addEventListener('blur', () => { if (!tooltipEl._touchActive) hideTooltip(); });
    bar.addEventListener('touchstart', (e) => {
      e.preventDefault();
      tooltipEl._touchActive = true;
      // Clean up previous document listener
      if (tooltipEl._touchHide) {
        document.removeEventListener('touchstart', tooltipEl._touchHide);
        tooltipEl._touchHide = null;
      }
      // Clear outline from any previously active bar
      const prev = rankingBarsEl.querySelector('.touch-active');
      if (prev) prev.classList.remove('touch-active');
      // Toggle off if same bar tapped again
      if (tooltipEl.classList.contains('visible') && tooltipEl._activeIdx === i) {
        hideTooltip();
        tooltipEl._activeIdx = null;
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        tooltipEl._touchActive = false;
        return;
      }
      showTooltip();
      tooltipEl._activeIdx = i;
      bar.classList.add('touch-active');
      if (document.activeElement instanceof HTMLElement && document.activeElement !== bar) document.activeElement.blur();
      const hide = (ev) => {
        if (ev.target.closest('.ranking-bar')) return;
        tooltipEl._touchActive = true;
        hideTooltip();
        tooltipEl._activeIdx = null;
        const active = rankingBarsEl.querySelector('.touch-active');
        if (active) active.classList.remove('touch-active');
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        tooltipEl._touchActive = false;
        document.removeEventListener('touchstart', hide);
        tooltipEl._touchHide = null;
      };
      tooltipEl._touchHide = hide;
      tooltipEl._touchActive = false;
      setTimeout(() => document.addEventListener('touchstart', hide), 0);
    }, { passive: false });
  }

  recalcRowHeight();
  updateBars();
}

function recalcRowHeight() {
  if (!barEls.length) return;
  const gap = W < MOBILE_BREAKPOINT ? BAR_GAP_MOBILE : BAR_GAP_DESKTOP;
  rowHeight = barEls[0].el.offsetHeight + gap;
  rankingBarsEl.style.height = (SELLERS.length * rowHeight) + 'px';
}

function positionRanking() {
  if (W <= TABLET_BREAKPOINT) {
    const hpBottom = headerPanelEl.getBoundingClientRect().bottom;

    // Measure ranking content height
    const rankH = rankingEl.offsetHeight;

    // Center ranking vertically in available space below header
    const pad = 48; // breathing room above scroll-hint
    const availH = H - hpBottom - pad;
    const top = hpBottom + Math.max(12, (availH - rankH) / 2);

    rankingEl.style.top = Math.round(top) + 'px';
    rankingEl.style.bottom = 'auto';
    rankingEl.style.maxHeight = Math.round(availH) + 'px';
    headerPanelEl.classList.remove('shifted');
  } else {
    rankingEl.style.top = '';
    rankingEl.style.bottom = '';
    rankingEl.style.maxHeight = '';
  }
}

// ---------------------------------------------------------------------------
// Preference switching
// ---------------------------------------------------------------------------
function switchPreference(idx) {
  currentPref = idx;
  const btns = document.querySelectorAll('.pref-btn');
  for (let i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', i === idx);
  }
  updateBars();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  // Prevent mobile scroll-restoration so the page always starts at the top
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const container = document.getElementById('canvas-container');
  canvas = document.createElement('canvas');
  container.appendChild(canvas);
  ctx = canvas.getContext('2d');

  progressBar = document.getElementById('progress-bar');
  scrollHint = document.getElementById('scroll-hint');
  narrativeLines = Array.from(document.querySelectorAll('.narrative-line'));
  headerPanelEl = document.getElementById('header-panel');
  rankingEl = document.getElementById('ranking');
  rankingBarsEl = document.getElementById('ranking-bars');
  tooltipEl = document.getElementById('tooltip');
  titleOverlayEl = document.getElementById('title-overlay');
  narrativeEl = document.getElementById('narrative');
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    S = Math.min(W, H) / SCALE_DIVISOR;
    measureLineGaps();
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generateScene();
    recalcRowHeight();
    updateBars();
    positionRanking();
    if (narrativeEl) {
      const savedH = narrativeEl.style.height;
      narrativeEl.style.height = '';
      narrativeOrigH = narrativeEl.offsetHeight;
      narrativeEl.style.height = savedH;
    }
  }

  buildBars();
  resize();
  window.addEventListener('resize', resize);
  document.fonts.ready.then(measureLineGaps);

  // Set initial top to match the value the tech-content ScrollTrigger uses at p=0,
  // so the header doesn't jump when the trigger first fires.
  headerPanelEl.style.top = Math.round(H * 0.04) + 'px';

  // Preference buttons
  const prefBtns = document.querySelectorAll('.pref-btn');
  for (let i = 0; i < prefBtns.length; i++) {
    prefBtns[i].addEventListener('click', () => switchPreference(i));
  }

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
    // Fade out scroll-animation overlays when entering tech section
    ScrollTrigger.create({
      trigger: techContent,
      start: 'top 90%',
      end: 'top 30%',
      scrub: SCRUB_SMOOTHING,
      onUpdate: (self) => {
        const p = self.progress;
        techFade = 1 - p;
        techProgress = p;

        // Collapse narrative
        narrativeEl.style.opacity = 1 - p;
        if (narrativeOrigH) narrativeEl.style.height = (narrativeOrigH * (1 - p)) + 'px';

        // Shrink logo
        titleOverlayEl.style.transform = 'scale(' + lerp(1, 0.55, p) + ')';

        // Hide fixed panels once fully in tech section
        rankingEl.style.visibility = p >= 1 ? 'hidden' : 'visible';

        // Move panel up, then switch to absolute so it scrolls with content
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

    // Reveal tech rows on scroll
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

    // Reveal footer
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
