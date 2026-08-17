// licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
// https://creativecommons.org/licenses/by-sa/4.0/

import * as THREE from 'three';
import {
  initRuntimeSettings, CAMERA_Z, NEAR_CLIP_DIVISOR, SKETCH_Z,
  MOUSE_SENSITIVITY, INIT_ZOOM, ZOOM_STEP, MIN_ZOOM, MAX_ZOOM,
  WORM_COUNT, L_F_X_LEN, L_F_Y_LEN, LURE_Z, FOV_Y
} from './settings.js';
import { RenderPipeline } from './renderpipeline.js';
import { TrailPool } from './trailpool.js';
import { ParticlePool } from './particlepool.js';
import { WormSlot } from './wormslot.js';
import { Sleepworm } from './sleepworm.js';
import { Hypnoworm } from './hypnoworm.js';
import { Lure } from './lure.js';
import { setWormContext, getWormContext } from './wormcontext.js';

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

// runtime settings (must be called before camera creation — CAMERA_Z depends on window height)
initRuntimeSettings(window.innerWidth, window.innerHeight);

// camera
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(
  60, aspect,
  CAMERA_Z / NEAR_CLIP_DIVISOR,
  10000
);
camera.position.z = CAMERA_Z;

// render pipeline (dual scenes + post-processing)
const pipeline = new RenderPipeline(renderer, camera);

// position both rotation groups at SKETCH_Z
pipeline.facesRotationGroup.position.z = SKETCH_Z;
pipeline.verticesRotationGroup.position.z = SKETCH_Z;

// trail pool (attached to both scenes' rotation groups)
const trailPool = new TrailPool(pipeline.facesRotationGroup, pipeline.verticesRotationGroup);

// particle pool
const particlePool = new ParticlePool(pipeline.facesRotationGroup, pipeline.verticesRotationGroup);

// Pre-set worm context before worm construction so Sleepworm stagger scan works
const worms = new Array(WORM_COUNT);
setWormContext({ worms, trailPool, lure: null });

// worm system
const edgesResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
for (let i = 0; i < WORM_COUNT; i++) {
  const slot = new WormSlot(
    pipeline.facesRotationGroup,
    pipeline.verticesRotationGroup,
    edgesResolution
  );
  worms[i] = new Sleepworm(i, slot);
}

// lure (created after worms so wormContext.lure is set after worm construction)
const lure = new Lure(pipeline.verticesRotationGroup, particlePool);
setWormContext({ worms, trailPool, lure, HypnowormClass: Hypnoworm });

// interaction state
const cumulativeQuat = new THREE.Quaternion();
let sketchScale = INIT_ZOOM;
const panOffset = new THREE.Vector2(0, 0);
let rotDragging = false;
let rotBaseX = 0, rotBaseY = 0;
let panDragging = false;
let panBaseX = 0, panBaseY = 0;

// apply initial scale and sync rotation groups
function syncGroups() {
  const pos = new THREE.Vector3(panOffset.x, panOffset.y, SKETCH_Z);
  const scale = new THREE.Vector3().setScalar(sketchScale * ZOOM_STEP);
  pipeline.syncRotationGroups(cumulativeQuat, pos, scale);
}
syncGroups();

// ─── Lure click unprojection ──────────────────────────────────────────────

function _unprojectLureClick(clientX, clientY) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const bx =  THREE.MathUtils.mapLinear(clientX - W / 2, -W / 2, W / 2, -L_F_X_LEN, L_F_X_LEN);
  const by = -THREE.MathUtils.mapLinear(clientY - H / 2, -H / 2, H / 2, -L_F_Y_LEN, L_F_Y_LEN);
  // Negate Y: Processing Y-down → Three.js Y-up
  const bPos = new THREE.Vector3(bx, by, LURE_Z);
  bPos.x -= panOffset.x; // un-pan
  bPos.y -= panOffset.y;
  bPos.applyQuaternion(cumulativeQuat.clone().conjugate()); // un-rotate
  bPos.multiplyScalar(1 / (sketchScale * ZOOM_STEP));       // un-zoom
  return bPos;
}

// ─── Input handlers ───────────────────────────────────────────────────────

// left-click: place or detonate lure
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) {
    if (lure.isDetonating()) return; // ignore while detonating
    if (lure.isActive()) {
      lure.detonate();
    } else {
      lure.activate(_unprojectLureClick(e.clientX, e.clientY));
    }
  }
});

// right-click drag rotation
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 2) {
    rotBaseX = e.clientX;
    rotBaseY = e.clientY;
    rotDragging = true;
    renderer.domElement.setPointerCapture(e.pointerId);
  }
});

// middle-click drag pan
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 1) {
    e.preventDefault();
    panBaseX = e.clientX;
    panBaseY = e.clientY;
    panDragging = true;
    renderer.domElement.setPointerCapture(e.pointerId);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (rotDragging) {
    const dx = e.clientX - rotBaseX;
    const dy = e.clientY - rotBaseY;
    if (dx !== 0 || dy !== 0) {
      const axis = new THREE.Vector3(-dy, dx, 0).normalize();
      const angle = Math.sqrt(dx * dx + dy * dy) * MOUSE_SENSITIVITY;
      const incrementalQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      cumulativeQuat.premultiply(incrementalQuat);
      cumulativeQuat.normalize();
      rotBaseX = e.clientX;
      rotBaseY = e.clientY;
    }
  }

  if (panDragging) {
    const dx = e.clientX - panBaseX;
    const dy = e.clientY - panBaseY;
    if (dx !== 0 || dy !== 0) {
      const frustumHeight = 2 * Math.tan(FOV_Y / 2) * (CAMERA_Z - SKETCH_Z);
      const worldPerPx = frustumHeight / (window.innerHeight * sketchScale * ZOOM_STEP);
      panOffset.x += dx * worldPerPx;
      panOffset.y -= dy * worldPerPx; // screen Y-down → world Y-up
      panBaseX = e.clientX;
      panBaseY = e.clientY;
    }
  }

  if (rotDragging || panDragging) syncGroups();
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button === 2) {
    rotDragging = false;
    renderer.domElement.releasePointerCapture(e.pointerId);
  }
  if (e.button === 1) {
    panDragging = false;
    renderer.domElement.releasePointerCapture(e.pointerId);
  }
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});

// scroll zoom
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = Math.sign(e.deltaY);
  sketchScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, sketchScale - delta));
  syncGroups();
}, { passive: false });

// backspace reset
window.addEventListener('keydown', (e) => {
  if (e.key === 'Backspace') {
    e.preventDefault();
    cumulativeQuat.identity();
    sketchScale = INIT_ZOOM;
    panOffset.set(0, 0);
    syncGroups();
  }
});

// resize handler
function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  initRuntimeSettings(w, h);
  camera.aspect = w / h;
  camera.near = CAMERA_Z / NEAR_CLIP_DIVISOR;
  camera.position.z = CAMERA_Z;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  pipeline.resize(renderer.domElement.width, renderer.domElement.height);
  edgesResolution.set(w, h);
  for (let i = 0; i < WORM_COUNT; i++) {
    worms[i].slot().updateResolution(w, h);
  }
}
window.addEventListener('resize', handleResize);

// A monitor move can change devicePixelRatio without firing resize —
// matchMedia is the reliable signal; re-arm per ratio (MDN pattern).
function watchPixelRatio() {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener('change', () => { handleResize(); watchPixelRatio(); }, { once: true });
}
watchPixelRatio();

// ─── Animation loop ───────────────────────────────────────────────────────

const FRAME_MS = 1000 / 60;
let lastTime = 0;
let frameCount = 0;

function step() {
  frameCount++;
  for (let i = 0; i < WORM_COUNT; i++) {
    worms[i].update();
    worms[i].display();
  }
  trailPool.update();

  lure.update(frameCount);
  lure.display();
}

function animate(now) {
  requestAnimationFrame(animate);
  if (now - lastTime < FRAME_MS) return;
  // Fixed-step with bounded catch-up: up to 4 logical steps per callback, so
  // non-60Hz-multiple refresh rates AND sub-60fps delivery (GPU load, power
  // throttling) both average 60 logical steps/sec, down to 15fps delivered;
  // below that, slow motion.
  // (+1e-6 step absorbs double-rounding: 4-frame debt can divide to 3.9999…)
  let steps = Math.floor((now - lastTime) / FRAME_MS + 1e-6);
  if (steps > 4) {
    // Genuine backlog: run the cap, carry at most two frames of the excess —
    // ordinary jitter near the cap boundary must not be mistaken for a stall
    // — and discard the rest, so a background-tab gap resumes cleanly with at
    // most two catch-up frames. Accepted residuals (discard = slow-motion,
    // never fast-forward): smooth σ=8ms jitter at the ~15fps boundary loses
    // ~1.4% of steps; recurring multi-frame stalls (GC, thermal throttling)
    // lose ~2-9% while they persist.
    lastTime = now - Math.min(now - (lastTime + 4 * FRAME_MS), 2 * FRAME_MS);
    steps = 4;
  } else {
    lastTime += steps * FRAME_MS;
  }
  while (steps-- > 0) step();

  pipeline.render();
}

requestAnimationFrame(animate);
