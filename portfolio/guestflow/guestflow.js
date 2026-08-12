'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MOBILE_BREAKPOINT = 600;
const TABLET_BREAKPOINT = 1200;
const SCALE_DIVISOR = 800;
const FRAME_DT = 0.016;

// Website cards — identical generic listing squares, stacked on the right
const SITE_COUNT = 5;
const SITE_SIZE_FRAC = 0.075;
const SITE_GAP_Y_FRAC = 0.03;
const SITE_AREA_RIGHT = 0.72;
const SITE_AREA_TOP = 0.08;
const OTA_LABELS = ['stay-ez.com', 'book-me.net', 'air-rent.com', 'nest-bnb.io', 'quick-stay.co'];
const GUESTFLOW_LABEL = 'Your website';

// Booking triangles
const TRIANGLE_BASE_SIZE = 16;
const TRIANGLE_SPEED = 0.0044;
const SPAWN_INTERVAL = 1.8;
const MAX_TRIANGLES = 8;
const TRIANGLE_COLORS = [
  [255, 150, 50],
  [255, 170, 70],
  [255, 130, 40],
  [240, 160, 60],
  [255, 140, 45],
];

// Dollar signs
const DOLLAR_RISE_SPEED = 30;
const DOLLAR_FADE_SPEED = 0.7;
const DOLLAR_BASE_SIZE = 26;

// Background morph
const BG_BAD = [10, 5, 8];
const BG_GOOD = [5, 8, 18];

// Good-state transformation
const GUESTFLOW_GROW_FACTOR = 2.2;
const OTHER_SHRINK_FACTOR = 0.8;
const GUESTFLOW_SHIFT_LEFT = 0.10;

// Booking targeting
const GUESTFLOW_WEIGHT_MAX = 0.75;
const SPAWN_INTERVAL_GOOD = 0.5;
const MAX_TRIANGLES_GOOD = 20;

// Good-state booking colors (blue-green)
const GOOD_TRIANGLE_COLORS = [
  [0, 200, 200],
  [0, 180, 220],
  [0, 220, 180],
  [50, 210, 200],
  [0, 210, 190],
];

// Guestflow card glow
const GF_GLOW_PULSE_SPEED = 2.0;
const GF_GLOW_MIN = 0.15;
const GF_GLOW_MAX = 0.35;

// Impact ripple
const RIPPLE_EXPAND_SPEED = 80;
const RIPPLE_FADE_SPEED = 1.8;
const RIPPLE_MAX_RADIUS_SCALE = 35;

// Pipeline panel reveal
const PIPELINE_MORPH_START = 0.65;
const PIPELINE_FADE_RANGE = 0.25;
const PIPELINE_INTERACT_THRESHOLD = 0.5;
const BAR_GAP_DESKTOP = 10;
const BAR_GAP_MOBILE = 6;
const BAR_ROW_HEIGHT_INIT = 48;

// Narrative
const NARRATIVE_SLIDE_PX = 240;

// Scroll
const SCRUB_SMOOTHING = 0.8;
const SCROLL_HINT_THRESHOLD = 0.03;

// ---------------------------------------------------------------------------
// Component data (pipeline bars)
// ---------------------------------------------------------------------------
const COMPONENTS = [
  { name: 'Webhook Receiver', listing: 10, availability: 1,  booking: 2 },
  { name: 'Schema Validator', listing: 9,  availability: 4,  booking: 8 },
  { name: 'Token Cache',      listing: 5,  availability: 10, booking: 7 },
  { name: 'CMS Sync Engine',  listing: 10, availability: 1,  booking: 1 },
  { name: 'Calendar Cache',   listing: 6,  availability: 10, booking: 4 },
  { name: 'Booking Pipeline', listing: 1,  availability: 1,  booking: 10 },
];

const FLOW_KEYS = ['listing', 'availability', 'booking'];

const BAR_COLORS = ['#0cc', '#0af', '#08f', '#0ea', '#4df', '#5cf'];

const COMPONENT_TIPS = [
  [
    'Receives Guesty listing events via Svix HMAC-signed webhooks',
    'Idle \u2014 availability requests come from the calendar widget',
    'Receives reservation.new confirmation after booking completes',
  ],
  [
    'Validates webhook payloads with hand-written Zod schemas',
    'Validates date range and listing ID query parameters',
    'Validates guest details, dates, and occupancy for quote creation',
  ],
  [
    'Retrieves Webflow API token for CMS write operations',
    'Two-layer cache (memory + CF Cache API) \u2014 5 tokens/day limit',
    'Retrieves Guesty token for Booking Engine API quote creation',
  ],
  [
    'Maps Guesty fields \u2192 Webflow CMS slugs, upserts/deletes items',
    'Idle \u2014 availability data served directly, not stored in CMS',
    'Idle \u2014 bookings are Guesty reservations, no CMS update needed',
  ],
  [
    'Invalidates cached months for affected listings',
    'Per-listing, per-month cache with 1-hour TTL + webhook invalidation',
    'Verifies date availability before allowing quote creation',
  ],
  [
    'Idle \u2014 listing sync doesn\'t involve bookings',
    'Idle \u2014 availability queries are read-only',
    'Quote via Guesty API, payment via Tokenization SDK (PCI-compliant)',
  ],
];

// One entry per .narrative-line, in order. Each keyframe is [progress, slide, opacity].
// Must stay the same length as the markup — a missing entry breaks the render loop.
const LINE_KEYFRAMES = [
  [[0, 0, 1], [0.13, 0, 1], [0.20, 1, 0]],
  [[0.16, 1, 0], [0.23, 0, 1], [0.33, 0, 1], [0.40, 1, 0]],
  [[0.36, 1, 0], [0.43, 0, 1], [0.53, 0, 1], [0.60, 1, 0]],
  [[0.56, 1, 0], [0.63, 0, 1], [0.73, 0, 1], [0.80, 1, 0]],
  [[0.76, 1, 0], [0.83, 0, 1], [1.0, 0, 1]],
];

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

function quadBezier(sx, sy, cx, cy, ex, ey, t) {
  const u = 1 - t;
  return {
    x: u * u * sx + 2 * u * t * cx + t * t * ex,
    y: u * u * sy + 2 * u * t * cy + t * t * ey,
  };
}

function quadBezierAngle(sx, sy, cx, cy, ex, ey, t) {
  const u = 1 - t;
  const dx = 2 * u * (cx - sx) + 2 * t * (ex - cx);
  const dy = 2 * u * (cy - sy) + 2 * t * (ey - cy);
  return Math.atan2(dy, dx);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let canvas, ctx, dpr;
let W, H, S;
let morphProgress = 0;
let time = 0;
let techProgress = 0;
let techFade = 1;

let sites = [];
let currentSites = [];
let guestflowIdx = 2;
let bookings = [];
let dollars = [];
let ripples = [];
let spawnTimer = 0;

let progressBar, scrollHint;
let narrativeLines = [];
let pipelineEl, pipelineBarsEl, tooltipEl, headerPanelEl;
let titleOverlayEl, narrativePanelEl;
let barEls = [];
let currentFlow = 0;
let rowHeight = BAR_ROW_HEIGHT_INIT;

// ---------------------------------------------------------------------------
// Scoring & ranking
// ---------------------------------------------------------------------------
function computeScores() {
  const key = FLOW_KEYS[currentFlow];
  return COMPONENTS.map((c) => c[key]);
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
    bar.label.textContent = '#' + (i + 1) + '\u2002' + COMPONENTS[idx].name;
    bar.fill.style.boxShadow = i === 0 ? '0 0 12px ' + BAR_COLORS[idx] : 'none';
  }
}

function getTooltipHTML(compIdx) {
  const c = COMPONENTS[compIdx];
  const score = c[FLOW_KEYS[currentFlow]];
  const tip = COMPONENT_TIPS[compIdx][currentFlow];

  let activity;
  if (score >= 8) activity = '<span class="tooltip-pos">High activity</span>';
  else if (score >= 4) activity = '<span style="color:#fc6">Medium activity</span>';
  else activity = '<span class="tooltip-neg">Low / Idle</span>';

  return '<div class="tooltip-name">' + c.name + '</div>' +
         '<div>' + activity + '</div>' +
         '<div style="color:rgba(255,255,255,0.7);margin-top:4px">' + tip + '</div>';
}

// ---------------------------------------------------------------------------
// Generate website cards — identical listing pages on right side
// ---------------------------------------------------------------------------
function generateSites() {
  sites = [];
  const size = Math.min(W, H) * SITE_SIZE_FRAC;
  const gap = H * SITE_GAP_Y_FRAC;
  const count = W <= MOBILE_BREAKPOINT ? 4 : SITE_COUNT;

  if (W <= MOBILE_BREAKPOINT) {
    // Mobile: centered vertical column with larger cards
    const mobileSize = W * 0.19;
    const colGap = mobileSize * 0.45;
    const totalH = count * mobileSize + (count - 1) * colGap;
    const ox = (W - mobileSize) / 2;
    const oy = (H - totalH) / 2;
    const midIdx = Math.floor(count / 2);
    let otaIdx = 0;
    for (let i = 0; i < count; i++) {
      sites.push({
        x: ox,
        y: oy + i * (mobileSize + colGap),
        w: mobileSize,
        h: mobileSize,
        label: i === midIdx ? GUESTFLOW_LABEL : OTA_LABELS[otaIdx++],
      });
    }
    guestflowIdx = midIdx;
  } else {
    // Desktop/tablet: vertical stack on right
    const startX = W * SITE_AREA_RIGHT - size / 2;
    const totalH = count * size + (count - 1) * gap;
    const startY = H * SITE_AREA_TOP + (H * (1 - SITE_AREA_TOP * 2) - totalH) / 2;
    const midIdx = Math.floor(count / 2);
    let otaIdx = 0;
    for (let i = 0; i < count; i++) {
      sites.push({
        x: startX,
        y: startY + i * (size + gap),
        w: size,
        h: size,
        label: i === midIdx ? GUESTFLOW_LABEL : OTA_LABELS[otaIdx++],
      });
    }
    guestflowIdx = midIdx;
  }
}

// ---------------------------------------------------------------------------
// Compute current site positions/sizes based on morph progress
// ---------------------------------------------------------------------------
function computeCurrentSites(t) {
  if (!sites.length) return [];
  const result = [];
  const gfBase = sites[guestflowIdx];
  const gfCenterY = gfBase.y + gfBase.h / 2;
  const gfGrowH = gfBase.h * t * (GUESTFLOW_GROW_FACTOR - 1);

  for (let i = 0; i < sites.length; i++) {
    const base = sites[i];
    if (i === guestflowIdx) {
      const grow = 1 + t * (GUESTFLOW_GROW_FACTOR - 1);
      const gfW = base.w * grow;
      const gfH = base.h * grow;
      result.push({
        x: W <= MOBILE_BREAKPOINT ? (W - gfW) / 2 : lerp(base.x, base.x - W * GUESTFLOW_SHIFT_LEFT, t),
        y: base.y - (gfH - base.h) / 2,
        w: gfW,
        h: gfH,
        isGuestflow: true,
        morph: t,
        label: base.label,
      });
    } else {
      const shrink = 1 - t * (1 - OTHER_SHRINK_FACTOR);
      const siteCenterY = base.y + base.h / 2;
      const pushMult = W <= MOBILE_BREAKPOINT ? 0.8 : 0.5;
      const push = Math.sign(siteCenterY - gfCenterY) * gfGrowH * pushMult;
      const shrunkW = base.w * shrink;
      result.push({
        x: W <= MOBILE_BREAKPOINT ? (W - shrunkW) / 2 : base.x,
        y: base.y + push,
        w: shrunkW,
        h: base.h * shrink,
        isGuestflow: false,
        morph: t,
        label: base.label,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Draw a single website card — morphs based on scroll state
// ---------------------------------------------------------------------------
function drawSite(site) {
  const x = site.x, y = site.y, w = site.w, h = site.h;
  const t = site.morph || 0;
  const isGF = site.isGuestflow;
  const fontSize = Math.round(Math.max(13, w * 0.22));

  if (isGF) {
    // Guestflow card — starts grey, morphs to blue-green, grows, gains detail
    const pulse = Math.sin(time * GF_GLOW_PULSE_SPEED) * 0.5 + 0.5;
    const glowAlpha = t * lerp(GF_GLOW_MIN, GF_GLOW_MAX, pulse);

    // Lerped accent color: grey → blue-green
    const acR = Math.round(lerp(100, 0, t));
    const acG = Math.round(lerp(100, 200, t));
    const acB = Math.round(lerp(100, 210, t));

    // Outer glow (only visible as morph progresses)
    ctx.shadowColor = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + glowAlpha + ')';
    ctx.shadowBlur = 20 * t;

    // Card background
    ctx.fillStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.08, 0.18, t) + ')';
    ctx.fillRect(x, y, w, h);

    // Card border
    ctx.strokeStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.35, 0.75, t) + ')';
    ctx.lineWidth = lerp(1, 1.5, t);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Header bar
    ctx.fillStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.18, 0.40, t) + ')';
    ctx.fillRect(x + 1, y + 1, w - 2, h * 0.08);

    // Image placeholder
    ctx.fillStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.12, 0.28, t) + ')';
    ctx.fillRect(x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.34);

    // Title line
    ctx.fillStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.22, 0.45, t) + ')';
    ctx.fillRect(x + w * 0.08, y + h * 0.54, w * 0.70, lerp(3, 4, t));

    // Description lines
    ctx.fillStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.12, 0.30, t) + ')';
    ctx.fillRect(x + w * 0.08, y + h * 0.62, w * 0.80, 2);
    ctx.fillRect(x + w * 0.08, y + h * 0.68, w * 0.60, 2);

    // Extra content fades in with morph
    if (t > 0.3) {
      const ea = (t - 0.3) / 0.7;

      // Calendar block
      ctx.fillStyle = 'rgba(0, 200, 210, ' + (0.22 * ea) + ')';
      ctx.fillRect(x + w * 0.08, y + h * 0.74, w * 0.38, h * 0.10);

      // Price block
      ctx.fillStyle = 'rgba(0, 220, 180, ' + (0.25 * ea) + ')';
      ctx.fillRect(x + w * 0.52, y + h * 0.74, w * 0.40, h * 0.10);

      // Book button
      ctx.fillStyle = 'rgba(0, 200, 200, ' + (0.40 * ea) + ')';
      ctx.fillRect(x + w * 0.25, y + h * 0.88, w * 0.50, h * 0.06);

      // Pulsing availability dot
      const dotAlpha = ea * (0.5 + pulse * 0.5);
      ctx.fillStyle = 'rgba(50, 255, 150, ' + dotAlpha + ')';
      ctx.beginPath();
      ctx.arc(x + w * 0.90, y + h * 0.04, 3 * (1 + t), 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.font = fontSize + 'px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(' + acR + ',' + acG + ',' + acB + ',' + lerp(0.4, 0.7, t) + ')';
    if (W <= MOBILE_BREAKPOINT) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(site.label, x + w / 2, y + h + 4);
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(site.label, x + w + 12, y + h / 2);
    }
  } else {
    // OTA cards — orange style, fading with morph
    const fadeAlpha = 1 - t * 0.4;
    ctx.globalAlpha = fadeAlpha;

    ctx.fillStyle = 'rgba(255, 130, 50, 0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 140, 60, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(255, 150, 50, 0.30)';
    ctx.fillRect(x + 1, y + 1, w - 2, h * 0.08);
    ctx.fillStyle = 'rgba(255, 140, 60, 0.20)';
    ctx.fillRect(x + w * 0.10, y + h * 0.16, w * 0.80, h * 0.32);
    ctx.fillStyle = 'rgba(255, 150, 50, 0.35)';
    ctx.fillRect(x + w * 0.10, y + h * 0.56, w * 0.65, 3);
    ctx.fillStyle = 'rgba(255, 140, 60, 0.20)';
    ctx.fillRect(x + w * 0.10, y + h * 0.66, w * 0.75, 2);
    ctx.fillRect(x + w * 0.10, y + h * 0.74, w * 0.55, 2);
    ctx.fillStyle = 'rgba(255, 150, 50, 0.30)';
    ctx.fillRect(x + w * 0.10, y + h * 0.85, w * 0.35, h * 0.08);

    // Label
    ctx.font = fontSize + 'px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(255, 150, 50, ' + (0.5 * fadeAlpha) + ')';
    if (W <= MOBILE_BREAKPOINT) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(site.label, x + w / 2, y + h + 4);
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(site.label, x + w + 12, y + h / 2);
    }

    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Spawn a booking triangle — weighted toward guestflow as morph progresses
// ---------------------------------------------------------------------------
function spawnBooking() {
  const effectiveMax = Math.round(lerp(MAX_TRIANGLES, MAX_TRIANGLES_GOOD, morphProgress));
  if (bookings.length >= effectiveMax || !currentSites.length) return;

  // Weight toward guestflow site as morph increases
  let targetIdx;
  const gfWeight = morphProgress * GUESTFLOW_WEIGHT_MAX;
  if (Math.random() < gfWeight) {
    targetIdx = guestflowIdx;
  } else {
    targetIdx = Math.floor(Math.random() * currentSites.length);
    // Exclude guestflow from random picks until morph kicks in
    if (targetIdx === guestflowIdx && morphProgress < 0.15) {
      targetIdx = (guestflowIdx + 1) % currentSites.length;
    }
  }

  const target = currentSites[targetIdx];
  const startY = H * (0.08 + Math.random() * 0.84);
  const endX = target.x + target.w * 0.5;
  const endY = target.y + target.h * 0.5;

  // Control point — somewhere in the left-centre, creating a gentle arc
  const cpx = W * (0.12 + Math.random() * 0.22);
  const cpy = (startY + endY) / 2 + (Math.random() - 0.5) * H * 0.3;

  const colorIdx = Math.floor(Math.random() * TRIANGLE_COLORS.length);

  bookings.push({
    progress: 0,
    sx: -15,
    sy: startY,
    cpx: cpx,
    cpy: cpy,
    ex: endX,
    ey: endY,
    targetIdx: targetIdx,
    isGuestflow: targetIdx === guestflowIdx,
    color: TRIANGLE_COLORS[colorIdx],
    goodColor: GOOD_TRIANGLE_COLORS[colorIdx],
    size: TRIANGLE_BASE_SIZE * (0.7 + Math.random() * 0.6) * S,
    opacity: 0.5 + Math.random() * 0.4,
    speed: TRIANGLE_SPEED * (0.7 + Math.random() * 0.6),
  });
}

// ---------------------------------------------------------------------------
// Update bookings — spawn, advance, convert to dollar on arrival
// ---------------------------------------------------------------------------
function updateBookings(dt) {
  const effectiveInterval = lerp(SPAWN_INTERVAL, SPAWN_INTERVAL_GOOD, morphProgress);
  spawnTimer += dt;
  if (spawnTimer >= effectiveInterval) {
    spawnTimer -= effectiveInterval;
    spawnBooking();
  }

  for (let i = bookings.length - 1; i >= 0; i--) {
    const b = bookings[i];
    b.progress += b.speed;

    // Track moving target site
    if (currentSites.length > b.targetIdx) {
      const target = currentSites[b.targetIdx];
      b.ex = target.x + target.w * 0.5;
      b.ey = target.y + target.h * 0.5;
    }

    if (b.progress >= 1) {
      // Spawn dollar sign at impact
      dollars.push({
        x: b.ex,
        y: b.ey,
        opacity: 0.9,
        size: DOLLAR_BASE_SIZE * S,
        isGuestflow: b.isGuestflow,
      });
      // Spawn ripple on guestflow impacts
      if (b.isGuestflow && morphProgress > 0.1) {
        ripples.push({
          x: b.ex,
          y: b.ey,
          radius: 5,
          maxRadius: RIPPLE_MAX_RADIUS_SCALE * S,
          opacity: 0.4 * morphProgress,
        });
      }
      bookings.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Update impact ripples
// ---------------------------------------------------------------------------
function updateRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += RIPPLE_EXPAND_SPEED * dt;
    r.opacity -= RIPPLE_FADE_SPEED * dt;
    if (r.opacity <= 0 || r.radius >= r.maxRadius) {
      ripples.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Update floating dollar signs
// ---------------------------------------------------------------------------
function updateDollars(dt) {
  for (let i = dollars.length - 1; i >= 0; i--) {
    const d = dollars[i];
    d.y -= DOLLAR_RISE_SPEED * dt;
    d.opacity -= DOLLAR_FADE_SPEED * dt;
    if (d.opacity <= 0) {
      dollars.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Draw a booking triangle — color morphs for guestflow-bound bookings
// ---------------------------------------------------------------------------
function drawBooking(b) {
  const pos = quadBezier(b.sx, b.sy, b.cpx, b.cpy, b.ex, b.ey, b.progress);
  const angle = quadBezierAngle(b.sx, b.sy, b.cpx, b.cpy, b.ex, b.ey, b.progress);

  // Fade in at start, fade out near impact
  const fadeIn = Math.min(1, b.progress * 8);
  const fadeOut = Math.min(1, (1 - b.progress) * 6);
  const alpha = b.opacity * fadeIn * fadeOut;

  // Color morph: guestflow-bound bookings shift from orange to blue-green
  let r = b.color[0], g = b.color[1], bl = b.color[2];
  if (b.isGuestflow && morphProgress > 0) {
    const colorT = Math.max(0, Math.min(1, (pos.x / W - 0.25) / 0.4)) * morphProgress;
    r = Math.round(lerp(b.color[0], b.goodColor[0], colorT));
    g = Math.round(lerp(b.color[1], b.goodColor[1], colorT));
    bl = Math.round(lerp(b.color[2], b.goodColor[2], colorT));
  }

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
  ctx.beginPath();
  ctx.moveTo(b.size, 0);
  ctx.lineTo(-b.size * 0.6, -b.size * 0.5);
  ctx.lineTo(-b.size * 0.6, b.size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Draw an impact ripple
// ---------------------------------------------------------------------------
function drawRipple(r) {
  ctx.globalAlpha = r.opacity;
  ctx.strokeStyle = '#0cc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Draw a floating dollar sign — blue-green for guestflow bookings
// ---------------------------------------------------------------------------
function drawDollar(d) {
  ctx.globalAlpha = d.opacity;
  ctx.fillStyle = d.isGuestflow && morphProgress > 0.2 ? '#0cc' : '#6b4';
  ctx.font = Math.round(d.size) + 'px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', d.x, d.y);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
  time += FRAME_DT;
  const t = morphProgress;

  // Background — morph from warm to cool
  const bgR = Math.round(lerp(BG_BAD[0], BG_GOOD[0], t));
  const bgG = Math.round(lerp(BG_BAD[1], BG_GOOD[1], t));
  const bgB = Math.round(lerp(BG_BAD[2], BG_GOOD[2], t));
  ctx.fillStyle = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
  ctx.fillRect(0, 0, W, H);

  // Compute current site states based on morph
  currentSites = computeCurrentSites(t);

  // Draw website cards
  for (let i = 0; i < currentSites.length; i++) {
    drawSite(currentSites[i]);
  }

  // Update and draw booking triangles
  updateBookings(FRAME_DT);
  for (let i = 0; i < bookings.length; i++) {
    drawBooking(bookings[i]);
  }

  // Update and draw impact ripples
  updateRipples(FRAME_DT);
  for (let i = 0; i < ripples.length; i++) {
    drawRipple(ripples[i]);
  }

  // Update and draw dollar signs
  updateDollars(FRAME_DT);
  for (let i = 0; i < dollars.length; i++) {
    drawDollar(dollars[i]);
  }

  // // Pipeline panel (disabled for now)
  // if (t < PIPELINE_MORPH_START) {
  //   pipelineEl.style.opacity = 0;
  //   pipelineEl.style.pointerEvents = 'none';
  //   if (W > TABLET_BREAKPOINT) headerPanelEl.classList.remove('shifted');
  // } else {
  //   var pAlpha = Math.min(1, (t - PIPELINE_MORPH_START) / PIPELINE_FADE_RANGE) * techFade;
  //   pipelineEl.style.opacity = pAlpha;
  //   pipelineEl.style.pointerEvents = pAlpha > PIPELINE_INTERACT_THRESHOLD ? 'auto' : 'none';
  //   if (W > TABLET_BREAKPOINT) {
  //     if (techProgress > 0) headerPanelEl.classList.remove('shifted');
  //     else headerPanelEl.classList.add('shifted');
  //   }
  //   for (var i = 0; i < barEls.length; i++) {
  //     barEls[i].fill.style.width = (barEls[i].normalizedW * pAlpha * 100) + '%';
  //   }
  // }

  for (let i = 0; i < narrativeLines.length; i++) {
    const kf = interpolateKeyframes(LINE_KEYFRAMES[i], t);
    narrativeLines[i].style.opacity = kf.op;
    narrativeLines[i].style.transform = 'translateX(' + (-Math.abs(kf.y) * NARRATIVE_SLIDE_PX) + 'px)';
  }

  requestAnimationFrame(render);
}

// ---------------------------------------------------------------------------
// Build pipeline bars
// ---------------------------------------------------------------------------
function buildBars() {
  pipelineBarsEl.innerHTML = '';
  barEls = [];

  for (let i = 0; i < COMPONENTS.length; i++) {
    const bar = document.createElement('div');
    bar.className = 'pipeline-bar';
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('role', 'listitem');
    bar.style.setProperty('--bar-color', BAR_COLORS[i]);

    const track = document.createElement('div');
    track.className = 'pipeline-track';
    bar.appendChild(track);

    const fill = document.createElement('div');
    fill.className = 'pipeline-fill';
    bar.appendChild(fill);

    const label = document.createElement('span');
    label.className = 'pipeline-label';
    bar.appendChild(label);

    pipelineBarsEl.appendChild(bar);
    barEls.push({ el: bar, fill: fill, label: label, compIdx: i, rank: i, normalizedW: 0 });

    (function (idx, barEl) {
      function showTooltip() {
        tooltipEl.innerHTML = getTooltipHTML(idx);
        tooltipEl.style.top = (pipelineBarsEl.offsetTop + barEl.offsetTop) + 'px';
        tooltipEl.classList.add('visible');
      }
      function hideTooltip() {
        tooltipEl.classList.remove('visible');
      }
      barEl.addEventListener('mouseenter', showTooltip);
      barEl.addEventListener('mouseleave', hideTooltip);
      barEl.addEventListener('focus', showTooltip);
      barEl.addEventListener('blur', hideTooltip);
      barEl.addEventListener('touchstart', function(e) {
        e.preventDefault();
        showTooltip();
        var hide = function() { hideTooltip(); document.removeEventListener('touchstart', hide); };
        setTimeout(function() { document.addEventListener('touchstart', hide); }, 0);
      }, { passive: false });
    })(i, bar);
  }

  recalcRowHeight();
  updateBars();
}

function recalcRowHeight() {
  if (!barEls.length) return;
  const gap = W < MOBILE_BREAKPOINT ? BAR_GAP_MOBILE : BAR_GAP_DESKTOP;
  rowHeight = barEls[0].el.offsetHeight + gap;
  pipelineBarsEl.style.height = (COMPONENTS.length * rowHeight) + 'px';
}

function positionPipeline() {
  if (W <= TABLET_BREAKPOINT) {
    const hpBottom = headerPanelEl.getBoundingClientRect().bottom;
    const pipeH = pipelineEl.offsetHeight;
    const availH = H - hpBottom;
    const top = hpBottom + Math.max(12, (availH - pipeH) / 2);
    pipelineEl.style.top = Math.round(top) + 'px';
    pipelineEl.style.bottom = 'auto';
    headerPanelEl.classList.remove('shifted');
  } else {
    pipelineEl.style.top = '';
    pipelineEl.style.bottom = '';
  }
}

// ---------------------------------------------------------------------------
// Flow switching
// ---------------------------------------------------------------------------
function switchFlow(idx) {
  currentFlow = idx;
  const btns = document.querySelectorAll('.flow-btn');
  for (let i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', i === idx);
  }
  updateBars();
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
  pipelineEl = document.getElementById('pipeline');
  pipelineBarsEl = document.getElementById('pipeline-bars');
  tooltipEl = document.getElementById('tooltip');
  titleOverlayEl = document.getElementById('title-overlay');
  narrativePanelEl = document.getElementById('narrative-panel');

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    S = Math.min(W, H) / SCALE_DIVISOR;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generateSites();
    recalcRowHeight();
    updateBars();
    positionPipeline();
  }

  buildBars();
  resize();
  window.addEventListener('resize', resize);

  // Flow buttons
  const flowBtns = document.querySelectorAll('.flow-btn');
  for (let i = 0; i < flowBtns.length; i++) {
    (function (idx) {
      flowBtns[idx].addEventListener('click', () => {
        switchFlow(idx);
      });
    })(i);
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
    ScrollTrigger.create({
      trigger: techContent,
      start: 'top 90%',
      end: 'top 30%',
      scrub: SCRUB_SMOOTHING,
      onUpdate: (self) => {
        const p = self.progress;
        techFade = 1 - p;
        techProgress = p;

        narrativePanelEl.style.opacity = 1 - p;

        // Shrink title
        titleOverlayEl.style.transform = 'scale(' + lerp(1, 0.55, p) + ')';

        // Hide fixed panels once fully in tech section
        const vis = p >= 1 ? 'hidden' : 'visible';
        pipelineEl.style.visibility = vis;
        narrativePanelEl.style.visibility = vis;

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
