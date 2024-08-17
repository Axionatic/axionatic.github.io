"use strict";

/**
 * A dot that floats around the canvas, gravitationally attracted to the cursor
 * @typedef {Object} Dot
 * @property {{x: number, y: number}} pos dot position
 * @property {{x: number, y: number}} vel dot velocity
 * @property {number} vMax max velocity
 * @property {{x: number, y: number}} vMod velocity modifier
 * @property {number} rad dot current radius
 * @property {number} rMin dot min radius
 * @property {number} rMax dot max radius
 * @property {number} rInc dot radius increment/decrement
 */


/** The ID of the canvas on which dots will be drawn to */
const CANVAS_ID = 'drawHere';
/** The ID of the page element that dots will try to spawn around */
const SPAWN_ID = 'dots_target';

/** Number of dots, based on canvas area */
const PIXELS_PER_DOT = 200;
/** Minimum allowed number of dots */
const MIN_DOTS = 5000;
/** Maximum allowed number of dots */
const MAX_DOTS = 20000;
/** Number of seconds to draw all queued dots */
const DOTS_LOAD_S = 2.5;
/** Gravitational constant */
const GRAVITY = 7500;
/** Minimum gravitational attraction (helps keeps dots on canvas) */
const MIN_G = 0.033;
/** Maximum gravitational attraction */
const MAX_G = 0.1;
/** Min dot maximum velocity */
const MIN_MAX_V = 1.9;
/** Max dot maximum velocity */
const MAX_MAX_V = 6.25;
/** Min dot minimum radius */
const MIN_MIN_RAD = 0.1;
/** Max dot minimum radius */
const MAX_MIN_RAD = 0.4;
/** Min dot maximum radius */
const MIN_MAX_RAD = 0.8;
/** Max dot maximum radius */
const MAX_MAX_RAD = 1.6;
/** Min dot radius increment/decrement */
const MIN_RAD_I = 0.009;
/** Max dot radius increment/decrement */
const MAX_RAD_I = 0.085;
/** Radius of explosion _as a percentage of canvas width_ that pushes drops on click */
const EX_RAD = 0.33;
/** Strength of click explosion */
const EX_STR = 11;
/** Explosion force decay */
const EX_DECAY = 0.985;
/** Set explode to 0 if current magnitude is below this */
const EX_DONE = 0.01;
/** The backgroun colour of the canvas */
const CNV_BACKGROUND = '#121212';

/** @type {CanvasRenderingContext2D} */ //@ts-ignore
const ctx = document.getElementById(CANVAS_ID).getContext('2d', { alpha: false });
/** @type {Array<Dot>} */
const dots = [];


// things that we'll calculate and re-calculate at runtime
let targetDots = 0;
let addCount = 0;
let mouseX = 0;
let mouseY = 0;
let dotInitX = 0;
let dotInitY = 0;
let dotInitSRad = 0;
let cLeft = 0;
let cTop = 0;
let mouseMoved = false;

/** Get ready to draw */
function init() {
  // init canvas
  const rect = ctx.canvas.parentElement?.getBoundingClientRect() ?? { width: 0, height: 0 };
  ctx.canvas.width = rect.width;
  ctx.canvas.height = rect.height;

  // find canvas pos on page
  const r = ctx.canvas.getBoundingClientRect();
  cLeft = window.scrollX + r.left;
  cTop = window.scrollY + r.top;

  // find dot spawn point
  const spawn = document.getElementById(SPAWN_ID);
  if (spawn) {
    const hRect = spawn.getBoundingClientRect();
    dotInitX = hRect.left + hRect.width * 0.5 - r.left;
    dotInitY = hRect.top + hRect.height * 0.5 - r.top;
    dotInitSRad = Math.max(hRect.width, hRect.height) * 0.5;
  } else {
    dotInitX = ctx.canvas.width * 0.5;
    dotInitY = ctx.canvas.height * 0.5;
    dotInitSRad = Math.max(ctx.canvas.width, ctx.canvas.height) * 0.5;
  }

  // add/remove dots if needed
  targetDots = Math.min(Math.max(Math.round(ctx.canvas.width * ctx.canvas.height / PIXELS_PER_DOT), MIN_DOTS), MAX_DOTS);
  const dotsDiff = targetDots - dots.length;
  if (dotsDiff > 0) {
    addCount = Math.max(Math.ceil(dotsDiff / (DOTS_LOAD_S * 60)), 1);
  }
  if (dotsDiff < 0) {
    dots.splice(0, -dotsDiff);
  }
}

/** Make a dot */
function makeDot() {
  // dots in circle around origin. Have dots prefer larger initial radius
  const initPos = Math.random() * Math.PI * 2;
  const initMag = Math.sqrt(1 - Math.pow(Math.random() - 1, 2)) * dotInitSRad;
  const minRadius = rand(MIN_MIN_RAD, MAX_MIN_RAD);
  const maxRadius = rand(MIN_MAX_RAD, MAX_MAX_RAD);
  dots.push({
    pos: { x: dotInitX + Math.sin(initPos) * initMag, y: dotInitY + Math.cos(initPos) * initMag },
    vel: { x: rand(-0.1, 0.1), y: rand(-0.1, 0.1) },
    vMax: rand(MIN_MAX_V, MAX_MAX_V),
    vMod: { x: 0, y: 0 },
    rad: rand(minRadius, maxRadius),
    rMin: minRadius,
    rMax: maxRadius,
    rInc: rand(MIN_RAD_I, MAX_RAD_I) * (Math.random() < 0.5 ? 1 : -1),
  });
}

/** Run calcs for dots and render  */
function drawFrame() {
  const maxW = ctx.canvas.width;
  const maxH = ctx.canvas.height;
  ctx.fillStyle = CNV_BACKGROUND;
  ctx.fillRect(0, 0, maxW, maxH);

  if (!mouseMoved) {
    mouseMoved = (mouseX != 0 || mouseY != 0);
  }

  // add a dot if we haven't hit target amount yet
  if (dots.length < targetDots) {
    for (let i = 0; i < addCount; i++) makeDot();
  }

  ctx.fillStyle = '#fff';
  for (const d of dots) {
    // skip gravity if mouse isn't yet active
    if (mouseMoved) {
      // calc dist to cursor
      const toCX = mouseX - d.pos.x;
      const toCY = mouseY - d.pos.y;
      // get magnitude and calc gravity
      const toCMag = Math.sqrt(toCX * toCX + toCY * toCY);
      const grav = Math.min(Math.max(GRAVITY / (toCMag * toCMag), MIN_G), MAX_G);

      // apply to velocity and constrain
      d.vel.x = Math.min(Math.max(d.vel.x + toCX / toCMag * grav, -d.vMax), d.vMax);
      d.vel.y = Math.min(Math.max(d.vel.y + toCY / toCMag * grav, -d.vMax), d.vMax);
    }

    // move dot. Don't let dot go wildly OOB
    d.pos.x = Math.min(Math.max(d.pos.x + d.vel.x + d.vMod.x, -5), maxW + 5);
    d.pos.y = Math.min(Math.max(d.pos.y + d.vel.y + d.vMod.y, -5), maxH + 5);

    // decay explosion velocity if required
    if (d.vMod.x || d.vMod.y) {
      const xDecayed = d.vMod.x * EX_DECAY;
      const yDecayed = d.vMod.y * EX_DECAY;
      d.vMod.x = Math.abs(xDecayed) < EX_DONE ? 0 : xDecayed;
      d.vMod.y = Math.abs(yDecayed) < EX_DONE ? 0 : yDecayed;
    }

    // skip visuals if OOB
    if (d.pos.x - d.rad > maxW || d.pos.y - d.rad > maxH || d.pos.x + d.rad < 0 || d.pos.y + d.rad < 0)
      continue;

    // animate radius. Reverse radius anim direction if needed
    d.rad += d.rInc;
    if (d.rad > d.rMax || d.rad < d.rMin)
      d.rInc *= -1;

    // draw!
    ctx.fillRect(d.pos.x - d.rad, d.pos.y - d.rad, d.rad * 2, d.rad * 2);
  };
  requestAnimationFrame(drawFrame);
}

/** @param {MouseEvent|TouchEventq} e */
function moveMouse(e) {
  // update mouse pos over canvas
  mouseX = e.pageX - cLeft;
  mouseY = e.pageY - cTop;
}                                             

/** @param {TouchEvent} e */
function handleTouches(e) {
  // update mouse pos over canvas
  e.preventDefault();
  moveMouse(e.touches[0]);
}

function clickDots() {
  const exRad = ctx.canvas.width * EX_RAD;
  for (const d of dots) {
    const xDist = d.pos.x - mouseX;
    const yDist = d.pos.y - mouseY;
    // skip dots out of range part one: skip magnitude calc if unnecessary
    if (Math.abs(xDist) > exRad || Math.abs(yDist) > exRad)
      continue;

    const distMag = Math.sqrt(xDist * xDist + yDist * yDist);
    // skip dots out of range part two
    if (distMag > exRad)
      continue;

    // calc explosion strength and assign x and y portions
    const exStr = (1 - distMag / exRad) * EX_STR;
    d.vMod.x = xDist / distMag * exStr;
    d.vMod.y = yDist / distMag * exStr;
  }
}

/**
 * Get a random value between min and max
 * @param {number} min 
 * @param {number} max 
 * @returns number
 */
function rand(min, max) {
  return min + Math.random() * (max - min);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.addEventListener('mousemove', moveMouse);
  document.addEventListener('click', clickDots);
  document.addEventListener('touchstart', handleTouches);
  document.addEventListener('touchmove', handleTouches);
  addEventListener('resize', init);
  requestAnimationFrame(drawFrame);
});
