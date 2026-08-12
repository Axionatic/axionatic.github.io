'use strict';

// ---------------------------------------------------------------------------
// Constants — background grid
// ---------------------------------------------------------------------------
const CELL_SIZE = 14;
const GRID_GAP = 1;
const FILL_RATIO = 0.65;
const NUM_PAINTERS = 10;
const PAINTER_WALK = 2;

const GRID_PALETTE = [
  '#00cccc', '#00aaff', '#0088ff', '#00eeaa', '#44ddff',
  '#ff6633', '#ff9966', '#ffcc66', '#ffaa55', '#ee8855',
  '#44ff44', '#66ff99', '#cc44ff', '#ff44cc', '#ffffff',
];

// Wavefront shimmer
const WAVE_FRAC = 0.04;
const WAVE_GLOW = 0.35;

// ---------------------------------------------------------------------------
// Constants — pixel font (variable-width, 5 rows tall, rendered at 2× scale)
// ---------------------------------------------------------------------------
// '#' = filled, '.' = empty
const FONT = {
  'A': ['.#.','#.#','###','#.#','#.#'],
  'C': ['.##','#..','#..','#..','.##'],
  'E': ['###','#..','##.','#..','###'],
  'I': ['###','.#.','.#.','.#.','###'],
  'L': ['#..','#..','#..','#..','###'],
  'M': ['#...#','##.##','#.#.#','#...#','#...#'],
  'N': ['#..#','##.#','#.##','#..#','#..#'],
  'P': ['##.','#.#','##.','#..','#..'],
  'R': ['##.','#.#','##.','#.#','#.#'],
  'S': ['.##','#..','.#.','..#','##.'],
  'T': ['###','.#.','.#.','.#.','.#.'],
  'U': ['#.#','#.#','#.#','#.#','.#.'],
  'V': ['#.#','#.#','#.#','.#.','.#.'],
  'X': ['#.#','.#.','.#.','.#.','#.#'],
  'Y': ['#.#','.#.','.#.','.#.','.#.'],
  ' ': ['..','..','..','..','..'],
};

const FONT_HEIGHT = 5;
const TEXT_SCALE = 2;       // each font pixel becomes a 2×2 block
const TEXT_MARGIN = 3;      // exclusion zone padding (cells) around widest word

const TEXT_WORDS = [
  { text: 'MULTIPLAYER', color: '#ff9966', glow: '#ff6633' },
  { text: 'PIXEL',       color: '#00cccc', glow: '#00aaff' },
  { text: 'CANVAS',      color: '#66ff99', glow: '#00eeaa' },
];
// Mobile: smaller pixel text rendered directly on canvas (not grid-aligned)
const MOBILE_TEXT_PX = 3;        // pixels per font pixel
const MOBILE_TEXT_WORDS = [
  { lines: ['MULTI', 'PLAYER'], color: '#ff9966', glow: '#ff6633' },
  { lines: ['PIXEL'],           color: '#00cccc', glow: '#00aaff' },
  { lines: ['CANVAS'],          color: '#66ff99', glow: '#00eeaa' },
];
const WORD_BUILD = 1.5;     // seconds — pixels appear in random order
const WORD_HOLD = 1.5;      // seconds — all visible
const WORD_UNDRAW = 0.7;    // seconds — pixels vanish in random order (faster)
const WORD_PAUSE = 0.3;     // seconds — gap before next word
const WORD_DURATION = WORD_BUILD + WORD_HOLD + WORD_UNDRAW + WORD_PAUSE;
const TEXT_FULL_CYCLE = WORD_DURATION * TEXT_WORDS.length;
const TEXT_MIN_COLS = 96;   // minimum grid cols to show pixel text (fits MULTIPLAYER at 2×)
const PIXEL_FADE_SLOTS = 4; // how many pixel-slots a fade-in/out spans

// ---------------------------------------------------------------------------
// Constants — demo panel & mini canvas
// ---------------------------------------------------------------------------
const DEMO_MORPH_START = 0.65;
const DEMO_FADE_RANGE = 0.25;
const DEMO_INTERACT_THRESH = 0.5;

// Scroll
const SCRUB_SMOOTH = 0.8;
const HINT_THRESH = 0.03;

// Auto-fill intro
const INTRO_TARGET = 0.12;
const INTRO_SPEED = 0.06;

// Frame
const FRAME_DT = 0.016;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shuffleIndices(n, rng) {
  const arr = [];
  for (let i = 0; i < n; i++) arr[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function inExclusion(col, row) {
  return textExclusion &&
    col >= textExclusion.minCol && col <= textExclusion.maxCol &&
    row >= textExclusion.minRow && row <= textExclusion.maxRow;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let canvas, ctx, dpr;
let W, H;
let gridCols, gridRows, gridOffsetX, gridOffsetY;
let fillOrder = [];
let colorBuckets = [];
let morphProgress = 0;
let introProgress = 0;
let time = 0;

let progressBar, scrollHint, headerPanelEl, demoPanelEl;
let titleOverlayEl, techSubtitleEl, mobileTaglineEl;
let techProgress = 0;
let techFade = 1;

// Pixel text
let textWords = [];
let mobileTextWords = [];  // mobile: canvas-pixel text (not grid-aligned)
let mobileTextPx = MOBILE_TEXT_PX;  // dynamic: scales to ~80% viewport width
let textExclusion = null;  // {minCol, maxCol, minRow, maxRow}
let zoneFillOrder = [];    // fills the text zone when demo panel appears

// ---------------------------------------------------------------------------
// Text exclusion zone (keeps background pixels away from the word area)
// ---------------------------------------------------------------------------
function computeTextExclusion() {
  textExclusion = null;
  if (gridCols < TEXT_MIN_COLS) return;

  // Measure widest word ("MULTIPLAYER") at scaled size
  const text = TEXT_WORDS[0].text;
  let wordW = 0;
  for (let ci = 0; ci < text.length; ci++) {
    const glyph = FONT[text[ci]];
    if (!glyph) continue;
    if (ci > 0) wordW += TEXT_SCALE;
    wordW += glyph[0].length * TEXT_SCALE;
  }

  const fontH = FONT_HEIGHT * TEXT_SCALE;
  const centerRow = Math.floor(gridRows / 2);
  const startCol = Math.floor((gridCols - wordW) / 2);
  const startRow = centerRow - Math.floor(fontH / 2);

  textExclusion = {
    minCol: Math.max(0, startCol - TEXT_MARGIN),
    maxCol: Math.min(gridCols - 1, startCol + wordW - 1 + TEXT_MARGIN),
    minRow: Math.max(0, startRow - TEXT_MARGIN),
    maxRow: Math.min(gridRows - 1, startRow + fontH - 1 + TEXT_MARGIN),
  };
}

// Pre-generate randomised fill for the exclusion zone (used when demo appears)
function generateZoneFill() {
  zoneFillOrder = [];
  if (!textExclusion) return;

  const rng = alea('bitbrush-zone');
  const cells = [];
  for (let col = textExclusion.minCol; col <= textExclusion.maxCol; col++) {
    for (let row = textExclusion.minRow; row <= textExclusion.maxRow; row++) {
      cells.push({ col: col, row: row, colorIdx: Math.floor(rng() * GRID_PALETTE.length) });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
  }
  zoneFillOrder = cells;
}

// ---------------------------------------------------------------------------
// Grid fill-order generation (clustered painters, respects exclusion zone)
// ---------------------------------------------------------------------------
function generateFillOrder() {
  const rng = alea('bitbrush-grid');
  fillOrder = [];
  const placed = {};

  const painters = [];
  for (let p = 0; p < NUM_PAINTERS; p++) {
    painters.push({
      cx: Math.floor(rng() * gridCols),
      cy: Math.floor(rng() * gridRows),
      colorIdx: Math.floor(rng() * GRID_PALETTE.length),
      radius: 3 + Math.floor(rng() * Math.min(gridCols, gridRows) * 0.15),
    });
  }

  const target = Math.floor(gridCols * gridRows * FILL_RATIO);
  const maxIter = target * 4;
  let iter = 0;

  while (fillOrder.length < target && iter < maxIter) {
    for (let p = 0; p < NUM_PAINTERS && fillOrder.length < target; p++) {
      const ptr = painters[p];
      const angle = rng() * Math.PI * 2;
      const dist = rng() * ptr.radius;
      const col = ((Math.round(ptr.cx + Math.cos(angle) * dist) % gridCols) + gridCols) % gridCols;
      const row = ((Math.round(ptr.cy + Math.sin(angle) * dist) % gridRows) + gridRows) % gridRows;
      const key = col * 10000 + row;
      if (!placed[key]) {
        placed[key] = true;
        if (!inExclusion(col, row)) {
          fillOrder.push({ col: col, row: row, colorIdx: ptr.colorIdx });
        }
      }
    }
    for (let p = 0; p < NUM_PAINTERS; p++) {
      painters[p].cx += Math.round((rng() - 0.5) * PAINTER_WALK * 2);
      painters[p].cy += Math.round((rng() - 0.5) * PAINTER_WALK * 2);
    }
    iter++;
  }

  buildColorBuckets();
}

function buildColorBuckets() {
  colorBuckets = [];
  for (let ci = 0; ci < GRID_PALETTE.length; ci++) colorBuckets[ci] = [];
  for (let i = 0; i < fillOrder.length; i++) {
    colorBuckets[fillOrder[i].colorIdx].push(i);
  }
}

// ---------------------------------------------------------------------------
// Pixel text — layout computation (2× scale, vertically centred, randomised)
// ---------------------------------------------------------------------------
function computeTextPixels() {
  textWords = [];
  if (gridCols < TEXT_MIN_COLS) return;

  const rng = alea('bitbrush-text');
  const fontH = FONT_HEIGHT * TEXT_SCALE;
  const centerRow = Math.floor(gridRows / 2);
  const startRow = centerRow - Math.floor(fontH / 2);

  for (let wi = 0; wi < TEXT_WORDS.length; wi++) {
    const wordDef = TEXT_WORDS[wi];
    const text = wordDef.text;
    const pixels = [];

    // Measure scaled word width
    let wordW = 0;
    for (let ci = 0; ci < text.length; ci++) {
      const glyph = FONT[text[ci]];
      if (!glyph) continue;
      if (ci > 0) wordW += TEXT_SCALE;
      wordW += glyph[0].length * TEXT_SCALE;
    }

    const startCol = Math.floor((gridCols - wordW) / 2);
    let curCol = startCol;

    for (let ci = 0; ci < text.length; ci++) {
      const glyph = FONT[text[ci]];
      if (!glyph) continue;
      const charW = glyph[0].length;
      if (ci > 0) curCol += TEXT_SCALE;

      for (let row = 0; row < glyph.length; row++) {
        for (let col = 0; col < charW; col++) {
          if (glyph[row][col] === '#') {
            for (let sy = 0; sy < TEXT_SCALE; sy++) {
              for (let sx = 0; sx < TEXT_SCALE; sx++) {
                pixels.push({
                  col: curCol + col * TEXT_SCALE + sx,
                  row: startRow + row * TEXT_SCALE + sy,
                  drawRank: 0,
                  undrawRank: 0,
                });
              }
            }
          }
        }
      }
      curCol += charW * TEXT_SCALE;
    }

    const drawOrder = shuffleIndices(pixels.length, rng);
    const undrawOrder = shuffleIndices(pixels.length, rng);
    for (let i = 0; i < drawOrder.length; i++) pixels[drawOrder[i]].drawRank = i;
    for (let i = 0; i < undrawOrder.length; i++) pixels[undrawOrder[i]].undrawRank = i;

    textWords.push({ pixels: pixels, color: wordDef.color, glow: wordDef.glow });
  }
}

// ---------------------------------------------------------------------------
// Mobile pixel text — layout computation (canvas-pixel, multi-line)
// ---------------------------------------------------------------------------
function computeMobileTextPixels() {
  mobileTextWords = [];
  if (gridCols >= TEXT_MIN_COLS) return; // desktop mode handles text

  // Compute dynamic pixel size so widest line fills ~82% of viewport width
  let maxLineW = 0;
  for (let wi = 0; wi < MOBILE_TEXT_WORDS.length; wi++) {
    for (let li = 0; li < MOBILE_TEXT_WORDS[wi].lines.length; li++) {
      const text = MOBILE_TEXT_WORDS[wi].lines[li];
      let lw = 0;
      for (let ci = 0; ci < text.length; ci++) {
        const glyph = FONT[text[ci]];
        if (!glyph) continue;
        if (ci > 0) lw += 1;  // inter-char gap in font-pixel units
        lw += glyph[0].length;
      }
      if (lw > maxLineW) maxLineW = lw;
    }
  }
  mobileTextPx = Math.max(MOBILE_TEXT_PX, Math.floor(W * 0.82 / maxLineW));

  const rng = alea('bitbrush-mobile-text');
  const px = mobileTextPx;
  const fontH = FONT_HEIGHT * px;
  const lineGap = px * 2;

  for (let wi = 0; wi < MOBILE_TEXT_WORDS.length; wi++) {
    const wordDef = MOBILE_TEXT_WORDS[wi];
    const pixels = [];

    // Measure total block height
    const totalH = wordDef.lines.length * fontH + (wordDef.lines.length - 1) * lineGap;
    const startY = Math.floor((H - totalH) / 2);

    for (let li = 0; li < wordDef.lines.length; li++) {
      const text = wordDef.lines[li];
      // Measure line width
      let lineW = 0;
      for (let ci = 0; ci < text.length; ci++) {
        const glyph = FONT[text[ci]];
        if (!glyph) continue;
        if (ci > 0) lineW += px;
        lineW += glyph[0].length * px;
      }

      const lineX = Math.floor((W - lineW) / 2);
      const lineY = startY + li * (fontH + lineGap);
      let curX = lineX;

      for (let ci = 0; ci < text.length; ci++) {
        const glyph = FONT[text[ci]];
        if (!glyph) continue;
        const charW = glyph[0].length;
        if (ci > 0) curX += px;

        for (let row = 0; row < glyph.length; row++) {
          for (let col = 0; col < charW; col++) {
            if (glyph[row][col] === '#') {
              pixels.push({
                x: curX + col * px,
                y: lineY + row * px,
                drawRank: 0,
                undrawRank: 0,
              });
            }
          }
        }
        curX += charW * px;
      }
    }

    const drawOrder = shuffleIndices(pixels.length, rng);
    const undrawOrder = shuffleIndices(pixels.length, rng);
    for (let i = 0; i < drawOrder.length; i++) pixels[drawOrder[i]].drawRank = i;
    for (let i = 0; i < undrawOrder.length; i++) pixels[undrawOrder[i]].undrawRank = i;

    mobileTextWords.push({ pixels: pixels, color: wordDef.color, glow: wordDef.glow });
  }
}

// ---------------------------------------------------------------------------
// Mobile pixel text — rendering
// ---------------------------------------------------------------------------
function renderMobileText(masterAlpha) {
  if (!mobileTextWords.length || masterAlpha <= 0) return;

  const cycleTime = time % TEXT_FULL_CYCLE;
  const wordIdx = Math.min(Math.floor(cycleTime / WORD_DURATION), mobileTextWords.length - 1);
  const wt = cycleTime - wordIdx * WORD_DURATION;
  const word = mobileTextWords[wordIdx];
  const total = word.pixels.length;
  const px = mobileTextPx;

  for (let i = 0; i < total; i++) {
    const p = word.pixels[i];
    let alpha = 0;

    if (wt < WORD_BUILD) {
      const buildProgress = (wt / WORD_BUILD) * total;
      if (p.drawRank < buildProgress) {
        alpha = Math.min(1, (buildProgress - p.drawRank) / PIXEL_FADE_SLOTS);
      }
    } else if (wt < WORD_BUILD + WORD_HOLD) {
      alpha = 1;
    } else if (wt < WORD_BUILD + WORD_HOLD + WORD_UNDRAW) {
      const undrawProgress = ((wt - WORD_BUILD - WORD_HOLD) / WORD_UNDRAW) * total;
      if (p.undrawRank >= undrawProgress) {
        alpha = Math.min(1, (p.undrawRank - undrawProgress) / PIXEL_FADE_SLOTS);
      }
    }

    alpha *= masterAlpha;
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = word.glow;
    ctx.fillRect(p.x - 1, p.y - 1, px + 2, px + 2);

    ctx.globalAlpha = alpha * 0.95;
    ctx.fillStyle = word.color;
    ctx.fillRect(p.x, p.y, px, px);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Background rendering
// ---------------------------------------------------------------------------
function renderBackground(t) {
  const count = Math.floor(t * fillOrder.length);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Faint grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = gridOffsetX; x <= W; x += CELL_SIZE) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, H);
  }
  for (let y = gridOffsetY; y <= H; y += CELL_SIZE) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(W, Math.round(y) + 0.5);
  }
  ctx.stroke();

  // Filled cells — batched by color (exclusion zone kept clear)
  ctx.globalAlpha = 0.88;
  for (let ci = 0; ci < GRID_PALETTE.length; ci++) {
    ctx.fillStyle = GRID_PALETTE[ci];
    const bucket = colorBuckets[ci];
    for (let j = 0; j < bucket.length; j++) {
      if (bucket[j] >= count) break;
      const p = fillOrder[bucket[j]];
      ctx.fillRect(
        gridOffsetX + p.col * CELL_SIZE,
        gridOffsetY + p.row * CELL_SIZE,
        CELL_SIZE - GRID_GAP, CELL_SIZE - GRID_GAP
      );
    }
  }
  ctx.globalAlpha = 1;

  // Wavefront glow
  const waveCount = Math.ceil(fillOrder.length * WAVE_FRAC);
  const waveStart = Math.max(0, count - waveCount);
  for (let i = waveStart; i < count; i++) {
    const age = (i - waveStart) / Math.max(1, count - waveStart - 1);
    const p = fillOrder[i];
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (WAVE_GLOW * (1 - age)).toFixed(3) + ')';
    ctx.fillRect(
      gridOffsetX + p.col * CELL_SIZE,
      gridOffsetY + p.row * CELL_SIZE,
      CELL_SIZE - GRID_GAP, CELL_SIZE - GRID_GAP
    );
  }

  // Zone fill: when demo panel appears, fill the text zone with background pixels
  const demoFrac = Math.max(0, Math.min(1, (t - DEMO_MORPH_START) / DEMO_FADE_RANGE));
  if (demoFrac > 0 && zoneFillOrder.length) {
    const zoneCount = Math.floor(demoFrac * zoneFillOrder.length);
    ctx.globalAlpha = 0.88;
    for (let i = 0; i < zoneCount; i++) {
      const zp = zoneFillOrder[i];
      ctx.fillStyle = GRID_PALETTE[zp.colorIdx];
      ctx.fillRect(
        gridOffsetX + zp.col * CELL_SIZE,
        gridOffsetY + zp.row * CELL_SIZE,
        CELL_SIZE - GRID_GAP, CELL_SIZE - GRID_GAP
      );
    }
    ctx.globalAlpha = 1;
  }

  // Pixel text overlay — fades out as demo appears and during tech transition
  const textAlpha = Math.min(techFade, 1 - demoFrac);
  renderText(textAlpha);
  renderMobileText(textAlpha);
}

// ---------------------------------------------------------------------------
// Pixel text — rendering (one word at a time, staggered random build/undraw)
// ---------------------------------------------------------------------------
function renderText(masterAlpha) {
  if (!textWords.length || masterAlpha <= 0) return;

  const cycleTime = time % TEXT_FULL_CYCLE;
  const wordIdx = Math.min(Math.floor(cycleTime / WORD_DURATION), textWords.length - 1);
  const wt = cycleTime - wordIdx * WORD_DURATION;
  const word = textWords[wordIdx];
  const total = word.pixels.length;
  const cs = CELL_SIZE - GRID_GAP;

  for (let i = 0; i < total; i++) {
    const px = word.pixels[i];
    let alpha = 0;

    if (wt < WORD_BUILD) {
      const buildProgress = (wt / WORD_BUILD) * total;
      if (px.drawRank < buildProgress) {
        alpha = Math.min(1, (buildProgress - px.drawRank) / PIXEL_FADE_SLOTS);
      }
    } else if (wt < WORD_BUILD + WORD_HOLD) {
      alpha = 1;
    } else if (wt < WORD_BUILD + WORD_HOLD + WORD_UNDRAW) {
      const undrawProgress = ((wt - WORD_BUILD - WORD_HOLD) / WORD_UNDRAW) * total;
      if (px.undrawRank >= undrawProgress) {
        alpha = Math.min(1, (px.undrawRank - undrawProgress) / PIXEL_FADE_SLOTS);
      }
    }

    alpha *= masterAlpha;
    if (alpha <= 0) continue;

    const x = gridOffsetX + px.col * CELL_SIZE;
    const y = gridOffsetY + px.row * CELL_SIZE;

    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = word.glow;
    ctx.fillRect(x - 2, y - 2, cs + 4, cs + 4);

    ctx.globalAlpha = alpha * 0.95;
    ctx.fillStyle = word.color;
    ctx.fillRect(x, y, cs, cs);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Main render loop
// ---------------------------------------------------------------------------
function render() {
  time += FRAME_DT;

  // Auto-fill intro animation
  if (introProgress < INTRO_TARGET) {
    introProgress = Math.min(INTRO_TARGET, introProgress + INTRO_SPEED * FRAME_DT);
  }
  const t = Math.max(morphProgress, introProgress);

  renderBackground(t);

  // Demo panel visibility (faded by techFade when entering tech section)
  if (t < DEMO_MORPH_START) {
    demoPanelEl.style.opacity = 0;
    demoPanelEl.style.pointerEvents = 'none';
  } else {
    const alpha = Math.min(1, (t - DEMO_MORPH_START) / DEMO_FADE_RANGE) * techFade;
    demoPanelEl.style.opacity = alpha;
    demoPanelEl.style.pointerEvents = alpha > DEMO_INTERACT_THRESH ? 'auto' : 'none';
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

  progressBar = document.getElementById('progress-bar');
  scrollHint = document.getElementById('scroll-hint');
  headerPanelEl = document.getElementById('header-panel');
  demoPanelEl = document.getElementById('demo-panel');
  titleOverlayEl = document.getElementById('title-overlay');
  techSubtitleEl = document.getElementById('tech-subtitle');
  mobileTaglineEl = document.getElementById('mobile-tagline');

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    gridCols = Math.ceil(W / CELL_SIZE) + 1;
    gridRows = Math.ceil(H / CELL_SIZE) + 1;
    gridOffsetX = (W - gridCols * CELL_SIZE) / 2;
    gridOffsetY = (H - gridRows * CELL_SIZE) / 2;

    computeTextExclusion();
    generateFillOrder();
    generateZoneFill();
    computeTextPixels();
    computeMobileTextPixels();
  }

  resize();
  window.addEventListener('resize', resize);

  // GSAP ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: '#runway',
    start: 'top top',
    end: 'bottom bottom',
    scrub: SCRUB_SMOOTH,
    onUpdate: (self) => {
      morphProgress = self.progress;
      progressBar.style.width = (self.progress * 100) + '%';
      scrollHint.style.opacity = self.progress < HINT_THRESH ? 1 : 0;
    }
  });

  // Tech content section transitions
  const techContent = document.getElementById('tech-content');
  if (techContent) {
    ScrollTrigger.create({
      trigger: techContent,
      start: 'top 90%',
      end: 'top 30%',
      scrub: SCRUB_SMOOTH,
      onUpdate: (self) => {
        const p = self.progress;
        techFade = 1 - p;
        techProgress = p;

        titleOverlayEl.style.transform = 'scale(' + lerp(1, 0.55, p) + ')';
        techSubtitleEl.style.opacity = p;
        if (mobileTaglineEl) mobileTaglineEl.style.opacity = 1 - p;

        // Hide fixed panels once fully in tech section
        demoPanelEl.style.visibility = p >= 1 ? 'hidden' : 'visible';

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
