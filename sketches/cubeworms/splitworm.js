// licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
// https://creativecommons.org/licenses/by-sa/4.0/

// Worm state for fascinated worms that fail the survival roll (50% chance, other 50% → Explodeworm).
// Fragments the worm cube recursively; each fragment shrinks over time leaving
// a sinusoidally-blinking glimmer trail. Transitions to Sleepworm on completion.
//
// Source: cubeworm.pde:670–994

import {
  Vector3, Matrix4,
  MeshPhongMaterial, MeshBasicMaterial, InstancedMesh
} from 'three';
import { Cubeworm } from './cubeworm.js';
import { Sleepworm } from './sleepworm.js';
import { getWormContext } from './wormcontext.js';
import { unitBoxGeo, particleSphereGeo } from './geometry.js';
import {
  SHININESS, FACE_BRIGHTNESS,
  PUSH_SPEED_MOD, MAX_SPLIT_SPEED,
  MAX_SPLIT_DEPTH, MIN_SPLIT_FRAGS, MAX_SPLIT_FRAGS,
  SPLIT_VOL_BOOST, FRAG_DECAY, MAX_SPLIT_THETA,
  FRAG_CHANCE, FRAG_MIN_POINT, FRAG_MAX_POINT, F_P_MAX_SIZE_MOD,
  G_AVERAGE_SPAWN, G_MAX_RADIUS,
  G_MIN_SPAWN_XOFF, G_MAX_SPAWN_XOFF, G_MAX_SPAWN_YOFF,
  G_BLINK_TIME, G_MIN_ANIM, G_MAX_ANIM, G_BLINKS,
  GLIMMER_BLINK_MOD_MIN, GLIMMER_BLINK_MOD_MAX,
  G_INIT_SPEED_MOD, G_Y_SPEED_MOD, G_SPEED_DECAY,
  STROKE_W_INC, MAX_EDGE,
  WORM_SIZE, FACECUBE_SIZE
} from './settings.js';

const MAX_FRAG_INSTANCES    = 256;  // covers worst-case tree 1+3+9+27+81 + 8 facecubes
const MAX_GLIMMER_INSTANCES = 512;  // per-fragment glimmer overlap

// ─── Module-level reusables ────────────────────────────────────────────────

// Small LIFO pool for traversal temps (currentMatrix + subOrigin per recursion level).
// Max depth = MAX_SPLIT_DEPTH + 1 = 5, each level uses 2 entries → 10 max simultaneous.
const _travPool = Array.from({ length: 20 }, () => new Matrix4());
let   _travIdx  = 0;

// Shared temp matrices for matrix arithmetic (never stored; overwritten before each use)
const _mRx = new Matrix4();
const _mRy = new Matrix4();
const _mT  = new Matrix4();
const _mS  = new Matrix4();

// Shared scale vector for Matrix4.compose() — always (1,1,1)
const _identityScale = new Vector3(1, 1, 1);

// Per-display-call result counters, reset at the top of display()
let _faceResultIdx    = 0;
let _glimmerResultIdx = 0;

// ─── Fragment ──────────────────────────────────────────────────────────────
// Mirrors Processing's Fragment inner class exactly.

class Fragment {
  constructor(depth, speed, size) {
    this.depth    = depth;
    this.speed    = speed;
    this.initSize = size;
    this.size     = size;
    this.pos      = 0;

    // Sub-fragments get a random direction; depth-0 root flies straight
    this.rotX = depth > 0 ? Math.random() * Math.PI * 2 : 0;
    this.rotY = depth > 0 ? Math.random() * MAX_SPLIT_THETA : 0;

    this.willFragment = false;
    this.fragPoint    = 0;
    this.fragSizeMult = 0;
    this.fragPos      = 0;
    this._fragCount   = 0;
    this.subFragments = [];
    this.stillRunning = true;
    this.activeGlimmers = -1;  // -1 = one-before-first; update() activates on threshold crossing

    // Decide whether and when to fragment
    if (depth < MAX_SPLIT_DEPTH) {
      this.willFragment = Math.random() < Math.pow(FRAG_CHANCE, depth);
      if (this.willFragment) {
        const fragCount   = Math.round(Math.random() * (MAX_SPLIT_FRAGS - MIN_SPLIT_FRAGS) + MIN_SPLIT_FRAGS);
        this._fragCount   = fragCount;
        this.fragPoint    = size * (Math.random() * (FRAG_MAX_POINT - FRAG_MIN_POINT) + FRAG_MIN_POINT);
        const minMult     = 1 / (fragCount + 1);
        this.fragSizeMult = Math.random() * (minMult * F_P_MAX_SIZE_MOD - minMult) + minMult;
      }
    }

    // Pre-compute glimmer spawn thresholds (size values at which each glimmer activates)
    const tempTrail = [];
    const fragPtOrZero = this.willFragment ? this.fragPoint : 0;
    for (let i = Math.floor(size); i >= fragPtOrZero; i -= G_AVERAGE_SPAWN) {
      tempTrail.push(i + (Math.random() * (G_MAX_SPAWN_XOFF - G_MIN_SPAWN_XOFF) + G_MIN_SPAWN_XOFF));
    }
    if (this.willFragment) {
      for (let i = Math.floor(this.fragPoint * this.fragSizeMult); i >= 0; i -= G_AVERAGE_SPAWN) {
        tempTrail.push(i + (Math.random() * (G_MAX_SPAWN_XOFF - G_MIN_SPAWN_XOFF) + G_MIN_SPAWN_XOFF));
      }
    }
    const trailLen = tempTrail.length;

    this.glimmerTrail = new Float32Array(trailLen);
    this.trailX       = new Float32Array(trailLen);
    this.trailY       = new Float32Array(trailLen);
    this.trailRot     = new Float32Array(trailLen);
    this.trailRad     = new Float32Array(trailLen);
    this.trailSpeed   = new Float32Array(trailLen);
    this.glimmerSpeed = new Float32Array(trailLen);
    this.glimmerCount = new Int32Array(trailLen);
    this.trailAnim    = new Float32Array(trailLen);

    for (let i = 0; i < trailLen; i++) this.glimmerTrail[i] = tempTrail[i];

    // Clamp first/last entries against bad random offsets
    if (trailLen > 0) {
      this.glimmerTrail[0]           = Math.min(this.glimmerTrail[0], size);
      this.glimmerTrail[trailLen - 1] = Math.max(this.glimmerTrail[trailLen - 1], 0);
    }
  }

  // Returns true if this fragment or any sub-fragment is still running
  update() {
    if (this.stillRunning) {
      this.size -= FRAG_DECAY;
      this.pos  += this.speed;
      const fragRunning = this.size > 0;

      // Trigger subfragmentation once size crosses fragPoint
      if (this.willFragment && this.size <= this.fragPoint && this.size + FRAG_DECAY > this.fragPoint) {
        this._subFragment();
      }

      // Activate new glimmers whose size threshold has been crossed
      while (this.activeGlimmers < this.glimmerTrail.length - 1
          && this.glimmerTrail[this.activeGlimmers + 1] > this.size) {
        this.activeGlimmers++;
        this._initGlimmer(this.activeGlimmers);
      }

      // Update already-active glimmers (not the one just initialised this frame)
      let trailRunning = false;
      for (let i = 0; i < this.activeGlimmers; i++) {
        if (this._updateGlimmer(i)) trailRunning = true;
      }

      if (!fragRunning && !trailRunning) this.stillRunning = false;
    }

    // Recurse into sub-fragments (gated the same way as Processing's displaySubFrag*)
    let anyStillRunning = this.stillRunning;
    if (this.willFragment && this.size < this.fragPoint) {
      for (const sub of this.subFragments) {
        if (sub.update()) anyStillRunning = true;
      }
    }
    return anyStillRunning;
  }

  _subFragment() {
    // Split by volume (cube³), not by radius, then re-cube-root
    const volume  = this.size ** 3;
    this.fragPos  = this.pos;
    const mainVol = volume * this.fragSizeMult * SPLIT_VOL_BOOST;
    const subVol  = volume * (1 - this.fragSizeMult) * SPLIT_VOL_BOOST / this._fragCount;
    this.size     = mainVol ** (1 / 3);
    for (let i = 0; i < this._fragCount; i++) {
      this.subFragments.push(new Fragment(this.depth + 1, this.speed, subVol ** (1 / 3)));
    }
  }

  _initGlimmer(g) {
    this.trailX[g]       = ((this.initSize - this.size) / FRAG_DECAY) * this.speed;
    this.trailY[g]       = Math.random() * G_MAX_SPAWN_YOFF;
    this.trailRot[g]     = Math.random() * Math.PI * 2;
    this.trailRad[g]     = 0;
    this.trailSpeed[g]   = this.speed * G_INIT_SPEED_MOD;
    this.glimmerSpeed[g] = Math.random() * (G_MAX_ANIM - G_MIN_ANIM) + G_MIN_ANIM;
    this.glimmerCount[g] = Math.round(
      G_BLINKS * this.glimmerSpeed[g]
        * (Math.random() * (GLIMMER_BLINK_MOD_MAX - GLIMMER_BLINK_MOD_MIN) + GLIMMER_BLINK_MOD_MIN)
    );
    this.trailAnim[g]    = G_BLINK_TIME;
  }

  _updateGlimmer(g) {
    if (this.glimmerCount[g] < 1 && this.trailAnim[g] < -G_BLINK_TIME) return false;

    this.trailX[g]     += this.trailSpeed[g];
    this.trailY[g]     += this.trailSpeed[g] * G_Y_SPEED_MOD;
    this.trailSpeed[g] *= G_SPEED_DECAY;

    if (this.trailAnim[g] > 0) {
      const x = Math.PI * 2 * (this.trailAnim[g] / G_BLINK_TIME);
      this.trailRad[g] = ((Math.sin(x - Math.PI / 2) + 1) / 2) * G_MAX_RADIUS;
    } else {
      this.trailRad[g] = 0;
    }
    this.trailAnim[g] -= this.glimmerSpeed[g];

    if (this.trailAnim[g] < -G_BLINK_TIME && this.glimmerCount[g] > 0) {
      this.trailAnim[g] = G_BLINK_TIME;
      this.glimmerCount[g]--;
    }
    return true;
  }
}

// ─── _walkFrag ─────────────────────────────────────────────────────────────
// Recursively walks the Fragment tree, accumulating world-space Matrix4s for
// boxes → faceList and glimmer spheres → glimmerList (pre-allocated arrays).
//
// Uses a LIFO traversal pool (pool index restored on return) so simultaneous
// pool entries never exceed 2 × (MAX_SPLIT_DEPTH + 1) = 10.
//
// Coordinate system: Fragment.pos and trailX are scalar offsets along the
// local X axis established by _wormOriginMatrix.

function _walkFrag(frag, parentMatrix, faceList, glimmerList) {
  const savedIdx = _travIdx;

  // currentMatrix = parentMatrix × Rx(rotX) × Ry(rotY)
  const currentMatrix = _travPool[_travIdx++];
  _mRx.makeRotationX(frag.rotX);
  _mRy.makeRotationY(frag.rotY);
  currentMatrix.multiplyMatrices(parentMatrix, _mRx).multiply(_mRy);

  // Glimmers — drawn in local frame after rotX/rotY, before pos translation
  for (let i = 0; i < frag.activeGlimmers; i++) {
    if (frag.trailRad[i] > 0 && _glimmerResultIdx < glimmerList.length) {
      _mRx.makeRotationX(frag.trailRot[i]);
      _mT.makeTranslation(frag.trailX[i], frag.trailY[i], 0);
      _mS.makeScale(frag.trailRad[i], frag.trailRad[i], frag.trailRad[i]);
      glimmerList[_glimmerResultIdx].copy(currentMatrix).multiply(_mRx).multiply(_mT).multiply(_mS);
      _glimmerResultIdx++;
    }
  }

  // Sub-fragments branch off at fragPos along X
  if (frag.willFragment && frag.size < frag.fragPoint) {
    const subOrigin = _travPool[_travIdx++];
    _mT.makeTranslation(frag.fragPos, 0, 0);
    subOrigin.multiplyMatrices(currentMatrix, _mT);
    for (const sub of frag.subFragments) {
      _walkFrag(sub, subOrigin, faceList, glimmerList);
    }
  }

  // This fragment's box
  if (frag.size > 0 && _faceResultIdx < faceList.length) {
    _mT.makeTranslation(frag.pos, 0, 0);
    _mS.makeScale(frag.size, frag.size, frag.size);
    faceList[_faceResultIdx].copy(currentMatrix).multiply(_mT).multiply(_mS);
    _faceResultIdx++;
  }

  _travIdx = savedIdx;  // restore LIFO pool
}

// ─── Splitworm ─────────────────────────────────────────────────────────────

export class Splitworm extends Cubeworm {
  constructor(source) {
    super(source);  // copy-ctor: transfers pos, facingQuat, cols, slot, facecubes, etc.

    // Velocity away from lure — same formula as Pushworm / Processing Splitworm
    const lure   = getWormContext().lure;
    const expDir = new Vector3().subVectors(this._pos, lure.pos());
    const dirMag = expDir.length();
    const speed  = Math.min((1 / dirMag) * PUSH_SPEED_MOD, MAX_SPLIT_SPEED);
    if (expDir.lengthSq() > 1e-10) expDir.normalize();
    this._vel.copy(expDir).multiplyScalar(speed);
    this.calcFacingQuat(expDir);  // orient worm toward explosion direction

    // Hide slot — Splitworm renders via its own InstancedMeshes
    this._slot.setVisible(false);

    // Fragment tree: one root fragment for the main cube + one leaf per facecube
    this._fragments = [new Fragment(0, speed, WORM_SIZE)];
    for (let i = 0; i < this._facecubes; i++) {
      this._fragments.push(new Fragment(MAX_SPLIT_DEPTH, speed, FACECUBE_SIZE));
    }

    // Fixed worm-origin matrix — pos and facing are frozen at construction time;
    // Splitworm.update() never modifies _pos.
    this._wormOriginMatrix = new Matrix4().compose(this._pos, this._facingQuat, _identityScale);

    // Pre-allocated result buffers for _walkFrag (reused every display() call)
    this._faceMatList    = Array.from({ length: MAX_FRAG_INSTANCES },    () => new Matrix4());
    this._glimmerMatList = Array.from({ length: MAX_GLIMMER_INSTANCES }, () => new Matrix4());

    const fGroup = this._slot.facesGroup();
    const vGroup = this._slot.verticesGroup();

    // Fragment boxes — lit, in faces scene
    this._fragFaceMesh = new InstancedMesh(unitBoxGeo, new MeshPhongMaterial({ shininess: SHININESS }), MAX_FRAG_INSTANCES);
    this._fragFaceMesh.frustumCulled = false;
    this._fragFaceMesh.count = 0;
    fGroup.add(this._fragFaceMesh);

    // Fragment boxes — unlit glow copy, in vertices scene
    this._fragVertMesh = new InstancedMesh(unitBoxGeo, new MeshBasicMaterial(), MAX_FRAG_INSTANCES);
    this._fragVertMesh.frustumCulled = false;
    this._fragVertMesh.count = 0;
    vGroup.add(this._fragVertMesh);

    // Glimmer sparkle spheres — in vertices scene
    this._glimmerMesh = new InstancedMesh(particleSphereGeo, new MeshBasicMaterial(), MAX_GLIMMER_INSTANCES);
    this._glimmerMesh.frustumCulled = false;
    this._glimmerMesh.count = 0;
    vGroup.add(this._glimmerMesh);
  }

  update() {
    if (this._strokeW < MAX_EDGE) this._strokeW += STROKE_W_INC;
    // _cols.run() intentionally omitted — colors freeze at split time (matches Processing)

    let stillRunning = false;
    for (const frag of this._fragments) {
      if (frag.update()) stillRunning = true;
    }

    if (!stillRunning) {
      this._cleanup();
      getWormContext().worms[this._id] = new Sleepworm(this);
    }
  }

  display() {
    // Colors frozen from split time — read current values but don't advance _cols
    const faceColor = this._cols.faceColor(FACE_BRIGHTNESS);
    const vertColor = this._cols.vertColor();
    this._fragFaceMesh.material.color.copy(faceColor);
    this._fragFaceMesh.material.specular.copy(faceColor);
    this._fragVertMesh.material.color.copy(vertColor);
    this._glimmerMesh.material.color.copy(vertColor);

    // Walk fragment tree, collecting box and glimmer matrices
    _travIdx          = 0;
    _faceResultIdx    = 0;
    _glimmerResultIdx = 0;
    for (const frag of this._fragments) {
      _walkFrag(frag, this._wormOriginMatrix, this._faceMatList, this._glimmerMatList);
    }

    // Upload box matrices to both face and vertex instanced meshes
    const faceCount = _faceResultIdx;
    for (let i = 0; i < faceCount; i++) {
      this._fragFaceMesh.setMatrixAt(i, this._faceMatList[i]);
      this._fragVertMesh.setMatrixAt(i, this._faceMatList[i]);
    }
    this._fragFaceMesh.count = faceCount;
    this._fragVertMesh.count = faceCount;
    this._fragFaceMesh.instanceMatrix.needsUpdate = true;
    this._fragVertMesh.instanceMatrix.needsUpdate = true;

    // Upload glimmer sphere matrices
    const glimmerCount = _glimmerResultIdx;
    for (let i = 0; i < glimmerCount; i++) {
      this._glimmerMesh.setMatrixAt(i, this._glimmerMatList[i]);
    }
    this._glimmerMesh.count = glimmerCount;
    this._glimmerMesh.instanceMatrix.needsUpdate = true;
  }

  _cleanup() {
    const fGroup = this._slot.facesGroup();
    const vGroup = this._slot.verticesGroup();
    fGroup.remove(this._fragFaceMesh);
    vGroup.remove(this._fragVertMesh);
    vGroup.remove(this._glimmerMesh);
    // Dispose materials and the meshes themselves (frees their instanceMatrix
    // GPU buffers) — shared geometries must not be disposed
    this._fragFaceMesh.material.dispose();
    this._fragVertMesh.material.dispose();
    this._glimmerMesh.material.dispose();
    this._fragFaceMesh.dispose();
    this._fragVertMesh.dispose();
    this._glimmerMesh.dispose();
  }

  lurePlaced()    {}  // ignore beacon events while fragmenting
  lureDetonated() {}
}
