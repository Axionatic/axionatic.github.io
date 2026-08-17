"use strict";

// Quad layout (ring, scroll-down first then left):
//   TL(3) | TR(0)  ← default view
//   ------+------
//   BL(2) | BR(1)
/** @type {{ tx: number, ty: number }[]} */
const QUADS = [
  { tx: -1, ty:  0 },  // 0: TR — default view
  { tx: -1, ty: -1 },  // 1: BR
  { tx:  0, ty: -1 },  // 2: BL
  { tx:  0, ty:  0 },  // 3: TL
];

// [quad][arrowKey] → target quad index | null (boundary)
/** @type {Record<string, number|null>[]} */
const NAV_MAP = [
  { ArrowDown: 1, ArrowLeft:  3, ArrowUp:   null, ArrowRight: null }, // TR(0)
  { ArrowLeft: 2, ArrowUp:    0, ArrowRight: null, ArrowDown:  null }, // BR(1)
  { ArrowUp:   3, ArrowRight: 1, ArrowDown:  null, ArrowLeft:  null }, // BL(2)
  { ArrowRight: 0, ArrowDown: 2, ArrowUp:    null, ArrowLeft:  null }, // TL(3)
];

// Bounce offset: page nudges this direction to simulate hitting a wall
/** @type {Record<string, [number, number]>} */
const BOUNCE_OFFSET = {
  ArrowUp:    [0,   30],
  ArrowDown:  [0,  -30],
  ArrowLeft:  [30,   0],
  ArrowRight: [-30,  0],
};

// Corner markers: corner position → quad index that direction points to
/** @type {{ quad: number, label: string, corner: string, name: string }[]} */
const MARKERS = [
  { quad: 3, label: '\u2196', corner: 'nav-tl', name: 'BitBrush' },    // ↖ → TL(3)
  { quad: 0, label: '\u2197', corner: 'nav-tr', name: 'Hero' },        // ↗ → TR(0)
  { quad: 2, label: '\u2199', corner: 'nav-bl', name: 'Sketches' },    // ↙ → BL(2)
  { quad: 1, label: '\u2198', corner: 'nav-br', name: 'Portfolio' },   // ↘ → BR(1)
];

/** @type {number} */
const SCROLL_PER_QUAD = 1600;  // px of wheel deltaY per full quad
/** @type {number} */
const LERP_FACTOR = 0.12;     // per-frame exponential decay (scroll only)
/** @type {number} */
const MS_PER_QUAD = 2000;      // arrow/marker animation speed

// Favicon rect coords, indexed to match QUADS (0:TR, 1:BR, 2:BL, 3:TL)
/** @type {{ x: number, y: number }[]} */
const FAVICON_RECTS = [
  { x: 17, y: 5 },   // 0: TR
  { x: 17, y: 17 },  // 1: BR
  { x: 5,  y: 17 },  // 2: BL
  { x: 5,  y: 5 },   // 3: TL
];
/** @type {number} */
const FAVICON_SCROLL_THRESHOLD = 2 / 3;  // scroll-lerp progress before the favicon commits to the approaching quad

/** @type {HTMLElement} */
const page = document.getElementById('page');
/** @type {HTMLLinkElement} */
const faviconLink = document.querySelector('link[rel="icon"]');

// --- State ---

/** @type {number} */
let position = 0;        // float, unbounded (normalized only for rendering)
/** @type {number} */
let targetPosition = 0;  // lerp target (scroll wheel)
/** @type {{ startPos: number, endPos: number, startTime: number, duration: number } | null} */
let arrowAnim = null;    // active timed animation, or null
/** @type {boolean} */
let isBouncing = false;  // CSS-transition bounce in progress
/** @type {number} */
let faviconQuad = 0;     // matches favicon.svg's shipped default (TR)

// --- Helpers ---

/**
 * Map a ring position to a CSS translate pair (px).
 * Interpolates between adjacent quad corners.
 * @param {number} t
 * @returns {[number, number]}
 */
function getRawTranslate(t) {
  t = ((t % 4) + 4) % 4;
  const seg = Math.floor(t), f = t - seg;
  const a = QUADS[seg], b = QUADS[(seg + 1) % 4];
  const tx = (a.tx + (b.tx - a.tx) * f) * window.innerWidth;
  const ty = (a.ty + (b.ty - a.ty) * f) * window.innerHeight;
  return [tx, ty];
}

/**
 * Return the quad index closest to the current position.
 * @returns {number}
 */
function nearestQuad() {
  return ((Math.round(position) % 4) + 4) % 4;
}

/**
 * Find the nearest ring position that maps to targetQuad.
 * Searches ±3 integer offsets from the current position.
 * @param {number} targetQuad
 * @returns {number|null}
 */
function findTargetPosition(targetQuad) {
  const base = Math.round(position);
  let best = null, bestDist = Infinity;
  for (let offset = -3; offset <= 3; offset++) {
    const candidate = base + offset;
    if (((candidate % 4) + 4) % 4 === targetQuad) {
      const dist = Math.abs(candidate - position);
      if (dist < bestDist) { bestDist = dist; best = candidate; }
    }
  }
  return best;
}

/**
 * Build a favicon data URI with the given quad lit, matching favicon.svg's structure.
 * @param {number} litQuad
 * @returns {string}
 */
function faviconHref(litQuad) {
  const rects = FAVICON_RECTS.map((r, i) =>
    `<rect x="${r.x}" y="${r.y}" width="10" height="10" rx="1.5"${i === litQuad ? '' : ' opacity="0.22"'}/>`
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#000"/><g fill="#0cc">${rects}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Swap the favicon to reflect the given quad, if it isn't already showing it.
 * @param {number} quad
 * @returns {void}
 */
function setFaviconQuad(quad) {
  if (quad === faviconQuad) return;
  faviconQuad = quad;
  faviconLink.href = faviconHref(quad);
}

/**
 * Cancel any active CSS-transition bounce and restore instant transforms.
 * @returns {void}
 */
function cancelBounce() {
  if (isBouncing) {
    isBouncing = false;
    page.style.transition = 'none';
  }
}

// --- Timed navigation (arrow keys + markers) ---

/**
 * Start a timed ease-in-out animation to the given quad.
 * @param {number} targetQuad
 * @returns {void}
 */
function navigateToQuad(targetQuad) {
  cancelBounce();
  const endPos = findTargetPosition(targetQuad);
  if (endPos === null) return;
  const distance = Math.abs(endPos - position);
  if (distance < 0.001) return;
  arrowAnim = {
    startPos: position,
    endPos,
    startTime: performance.now(),
    duration: distance * MS_PER_QUAD,
  };
  targetPosition = endPos;
}

// --- CSS-transition bounce (matches original feel) ---

/**
 * Nudge the page in the direction of the blocked key, then spring back.
 * @param {string} key
 * @returns {void}
 */
function bounce(key) {
  if (isBouncing) return;
  isBouncing = true;
  arrowAnim = null;
  targetPosition = position;  // kill scroll momentum

  const [bx, by] = BOUNCE_OFFSET[key];
  const [baseTx, baseTy] = getRawTranslate(position);

  page.style.transition = 'transform 0.12s ease-out';
  page.style.transform = `translate(${baseTx + bx}px, ${baseTy + by}px)`;

  setTimeout(() => {
    if (!isBouncing) return;  // cancelled by scroll/key
    page.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)';
    page.style.transform = `translate(${baseTx}px, ${baseTy}px)`;
    setTimeout(() => {
      if (!isBouncing) return;
      isBouncing = false;
      page.style.transition = 'none';
    }, 280);
  }, 130);
}

// --- Corner markers ---

const markerEls = MARKERS.map(m => {
  const el = document.createElement('div');
  el.className = `nav-marker ${m.corner}`;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Navigate to ${m.name}`);
  const span = document.createElement('span');
  span.textContent = m.label;
  el.appendChild(span);
  el.addEventListener('click', () => navigateToQuad(m.quad));
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateToQuad(m.quad);
    }
  });
  document.body.appendChild(el);
  return { el, quad: m.quad };
});

/**
 * Hide the marker pointing to the quad we're currently on (no self-navigation).
 * @returns {void}
 */
function updateMarkers() {
  const nq = nearestQuad();
  for (const m of markerEls) {
    const hidden = m.quad === nq;
    m.el.classList.toggle('hidden', hidden);
    m.el.setAttribute('tabindex', hidden ? '-1' : '0');
  }
}

// --- Scroll wheel ---

window.addEventListener('wheel', e => {
  e.preventDefault();
  cancelBounce();
  arrowAnim = null;
  let delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 40;       // Firefox line mode
  else if (e.deltaMode === 2) delta *= 800;  // page mode
  targetPosition += delta / SCROLL_PER_QUAD;
}, { passive: false });

// --- Direction-based navigation (shared by keys + touch) ---

/**
 * Navigate in the given arrow-key direction from the current position.
 * @param {string} key  ArrowUp | ArrowDown | ArrowLeft | ArrowRight
 */
function handleNavKey(key) {
  const norm = ((position % 4) + 4) % 4;
  const seg = Math.floor(norm);
  const f = norm - seg;
  const quadA = seg;
  const quadB = (seg + 1) % 4;

  if (f < 0.001 || f > 0.999) {
    const currentQuad = f < 0.001 ? quadA : quadB;
    const target = NAV_MAP[currentQuad][key];
    if (target !== null) navigateToQuad(target);
    else bounce(key);
    return;
  }

  const targetA = NAV_MAP[quadA][key];
  const targetB = NAV_MAP[quadB][key];

  if (targetA === null && targetB === null) {
    bounce(key);
  } else if (targetA !== null && targetB !== null) {
    navigateToQuad(f < 0.5 ? targetA : targetB);
  } else {
    navigateToQuad(targetA !== null ? targetA : targetB);
  }
}

// --- Arrow keys ---

window.addEventListener('keydown', e => {
  if (!(e.key in NAV_MAP[0])) return;
  handleNavKey(e.key);
});

// --- Touch swipe ---

/** @type {number} */
let touchStartX = 0;
/** @type {number} */
let touchStartY = 0;
/** @type {number} Minimum px distance for a swipe to register. */
const SWIPE_THRESHOLD = 50;

/** @param {Event} e */
function isBitbrushTouch(e) {
  return e.target.closest && !!e.target.closest('.bitbrush-widget');
}

window.addEventListener('touchstart', e => {
  if (isBitbrushTouch(e)) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', e => {
  if (isBitbrushTouch(e)) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', e => {
  if (isBitbrushTouch(e)) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

  const key = absDx > absDy
    ? (dx > 0 ? 'ArrowLeft' : 'ArrowRight')
    : (dy > 0 ? 'ArrowUp'   : 'ArrowDown');
  handleNavKey(key);
});

// --- rAF loop ---

/**
 * Per-frame update: advance animation, lerp scroll, write transform, sync markers.
 * @returns {void}
 */
function tick() {
  requestAnimationFrame(tick);

  if (arrowAnim) {
    // Timed ease-in-out animation (arrow keys / marker clicks)
    const elapsed = performance.now() - arrowAnim.startTime;
    const t = Math.min(elapsed / arrowAnim.duration, 1);
    position = arrowAnim.startPos + (arrowAnim.endPos - arrowAnim.startPos) * easeInOutCubic(t);
    if (t >= 1) {
      position = arrowAnim.endPos;
      targetPosition = position;
      arrowAnim = null;
      // Normalize: strip full rotations so position stays near [0, 4)
      const fullRot = Math.floor(position / 4);
      if (fullRot !== 0) { position -= fullRot * 4; targetPosition -= fullRot * 4; }
      setFaviconQuad(nearestQuad());
    }
  } else if (!isBouncing) {
    // Lerp toward target (scroll wheel)
    const dt = targetPosition - position;
    if (Math.abs(dt) > 0.0001) {
      position += dt * LERP_FACTOR;
      // Commit the favicon once we're mostly into the quad we're heading toward
      const floorPos = Math.floor(position);
      const frac = position - floorPos;
      if (dt > 0 && frac >= FAVICON_SCROLL_THRESHOLD) {
        setFaviconQuad((((floorPos + 1) % 4) + 4) % 4);
      } else if (dt < 0 && (1 - frac) >= FAVICON_SCROLL_THRESHOLD) {
        setFaviconQuad(((floorPos % 4) + 4) % 4);
      }
    } else {
      position = targetPosition;
      // Normalize: strip full rotations so position stays near [0, 4)
      const fullRot = Math.floor(position / 4);
      if (fullRot !== 0) { position -= fullRot * 4; targetPosition -= fullRot * 4; }
      // No favicon call here: nearestQuad()'s 0.5 rounding would contradict the
      // 2/3 threshold above for a scroll that comes to rest short of it (e.g.
      // settling at 0.6) — the in-flight check is the sole source of truth.
    }
  }

  // Write transform (unless CSS-transition bounce owns it)
  if (!isBouncing) {
    const [tx, ty] = getRawTranslate(position);
    page.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  updateMarkers();
  if (typeof updateShaderPosition === 'function') updateShaderPosition(position);
}

// Initialise: set transform immediately to prevent flash, then start loop
const [initX, initY] = getRawTranslate(0);
page.style.transform = `translate(${initX}px, ${initY}px)`;
requestAnimationFrame(tick);
