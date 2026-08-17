// licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
// https://creativecommons.org/licenses/by-sa/4.0/

// Worm state for fascinated worms that fail the detonation survival roll.
// Fuse phase: rushes outward (inherits Pushworm velocity decay).
// Explosion phase: three concentric icosasphere shells of pulsing star spheres;
// facecubes fly outward as comet trails. Transitions to Sleepworm on completion.

import { Vector3, Object3D, MeshBasicMaterial, InstancedMesh } from 'three';
import { Pushworm } from './pushworm.js';
import { Sleepworm } from './sleepworm.js';
import { ExplodeSphere } from './explodesphere.js';
import { getWormContext } from './wormcontext.js';
import { easeOutCubic, invEaseInQuint } from './mathutils.js';
import { facecubeGeo } from './geometry.js';
import {
  MAX_EXP_SPEED, EXP_DET_SPEED, MAX_INIT_SPEED_MOD,
  EXP_PULSE_INC, EXP_SPHERE_COUNT, EXP_OUTER_SPHERE_RECURSE,
  EXP_OUTER_SPHERE_RAD, EXPLODE_SPEED, STAR_PULSE_BEGIN,
  FACECUBE_DIST, FACECUBE_SIZE, FACECUBE_EXP_DIST,
  FACETRAIL_SPAWN_FREQ, FACETRAIL_DECAY,
  MAX_FACECUBES, MAX_EDGE, WORM_SIZE, FACE_BRIGHTNESS
} from './settings.js';

// Module-level reusables
const _ringDir = new Vector3();
const _dummy = new Object3D();

export class Explodeworm extends Pushworm {
  constructor(source) {
    super(source);  // Pushworm ctor: sets vel direction away from lure

    this._curSpeed = MAX_EXP_SPEED * (1 + Math.random() * MAX_INIT_SPEED_MOD);
    this._resetSpeed = EXP_DET_SPEED;
    this._vel.normalize().multiplyScalar(this._curSpeed);

    this._exploding = false;
    this._explodePerc = 0;
    this._drawWorm = true;
    // _faceTrails: [{dist, size}]. Last element = head (not decayed). Initial head parked at normal ring.
    this._faceTrails = [{ dist: FACECUBE_DIST, size: FACECUBE_SIZE }];
    this._frameCount = 0;
    this._spheres = [];
    this._faceTrailMesh = null;
  }

  // ─── Overrides ────────────────────────────────────────────────────────────

  // Called by Pushworm.update() when _curSpeed <= _resetSpeed
  _convertWorm() { this._startExplosion(); }

  update() {
    if (!this._exploding) {
      this._pulseSpeed += EXP_PULSE_INC;
      super.update();  // Pushworm.update() → decays _curSpeed → calls _convertWorm()
    } else if (this._explodePerc >= 1) {
      this._updateExplosionFinished();
    } else {
      this._updateExplosionActive();
    }
  }

  display() {
    this._slot.updateMainTransform(this._pos, this._facingQuat);
    this._slot.setEdgeColor(this._cols.vertColor());
    this._slot.setEdgeWidth(this._strokeW);

    if (!this._exploding) {
      // Fuse phase: normal rendering
      this._slot.setFaceColor(this._cols.faceColor(FACE_BRIGHTNESS));
      this._slot.updateFacecubes(FACECUBE_DIST, FACECUBE_SIZE, 0, this._pos, this._facingQuat);
    } else {
      // Explosion phase
      this._slot.setMainVisible(this._drawWorm);
      if (this._drawWorm) this._slot.setFaceColor(this._cols.faceColor(FACE_BRIGHTNESS));
      this._renderFaceTrails();
      this._renderStars();
    }
  }

  lurePlaced()    {}  // ignore new lures while exploding
  lureDetonated() {}  // ignore re-detonation

  // ─── Explosion start ──────────────────────────────────────────────────────

  _startExplosion() {
    this._strokeW = MAX_EDGE;
    this._slot.setFacecubesVisible(false);  // hide normal facecube ring

    const vGroup = this._slot.verticesGroup();
    const pulseTime = (1 - STAR_PULSE_BEGIN) / EXP_SPHERE_COUNT;
    let recurse = EXP_OUTER_SPHERE_RECURSE;  // starts at 3

    for (let i = EXP_SPHERE_COUNT - 1; i >= 0; i--) {
      const maxR = EXP_OUTER_SPHERE_RAD * (i + 1) / EXP_SPHERE_COUNT;
      const pulseStart = STAR_PULSE_BEGIN + pulseTime * i;
      this._spheres[i] = new ExplodeSphere(
        maxR, recurse, pulseStart, pulseTime,
        this._cols.vertHue(), this._cols.vertSat(), this._cols.vertBright(), vGroup
      );
      recurse = Math.max(recurse - 1, 0);
    }

    // Face trail InstancedMesh: MAX_FACECUBES * 15 slots (peak ~12 simultaneous trail points per facecube)
    const mat = new MeshBasicMaterial({ color: 0xffffff });
    this._faceTrailMesh = new InstancedMesh(facecubeGeo, mat, MAX_FACECUBES * 16);
    this._faceTrailMesh.count = 0;
    this._faceTrailMesh.frustumCulled = false;
    vGroup.add(this._faceTrailMesh);

    this._exploding = true;
  }

  // ─── Explosion active ─────────────────────────────────────────────────────

  _updateExplosionActive() {
    this._explodePerc = Math.min(this._explodePerc + EXPLODE_SPEED, 1);
    const easedPerc = easeOutCubic(this._explodePerc);

    for (const s of this._spheres) s.update(this._explodePerc, easedPerc);

    this._updateExplodingFacecubes(easedPerc);

    // Hide main worm cube once outermost sphere exceeds WORM_SIZE/2
    if (this._drawWorm && this._spheres[this._spheres.length - 1]._r > WORM_SIZE / 2) {
      this._drawWorm = false;
    }

    this._frameCount++;
  }

  _updateExplodingFacecubes(easedPerc) {
    const facecubeSize = FACECUBE_SIZE * invEaseInQuint(this._explodePerc);
    const headDist = FACECUBE_EXP_DIST * easedPerc;

    if (this._frameCount % FACETRAIL_SPAWN_FREQ === 0) {
      this._faceTrails.push({ dist: headDist, size: facecubeSize });
    } else {
      this._faceTrails[this._faceTrails.length - 1].dist = headDist;
      this._faceTrails[this._faceTrails.length - 1].size = facecubeSize;
    }

    // Decay all but last (head); remove dead
    for (let i = this._faceTrails.length - 2; i >= 0; i--) {
      this._faceTrails[i].size -= FACETRAIL_DECAY;
      if (this._faceTrails[i].size <= 0) this._faceTrails.splice(i, 1);
    }
  }

  // ─── Explosion finished ───────────────────────────────────────────────────

  _updateExplosionFinished() {
    // Decay remaining trail points including head
    for (let i = this._faceTrails.length - 1; i >= 0; i--) {
      this._faceTrails[i].size -= FACETRAIL_DECAY;
      if (this._faceTrails[i].size <= 0) this._faceTrails.splice(i, 1);
    }
    if (this._faceTrails.length === 0) {
      this._finishExplosion();
    }
  }

  _finishExplosion() {
    const vGroup = this._slot.verticesGroup();
    for (const s of this._spheres) s.dispose(vGroup);
    this._spheres = [];
    vGroup.remove(this._faceTrailMesh);
    this._faceTrailMesh.material.dispose();  // geometry is shared, don't dispose
    this._faceTrailMesh.dispose();           // frees the instanceMatrix GPU buffer
    this._faceTrailMesh = null;
    getWormContext().worms[this._id] = new Sleepworm(this);
  }

  // ─── Display helpers ──────────────────────────────────────────────────────

  _renderFaceTrails() {
    let instanceIdx = 0;
    const TWO_PI = Math.PI * 2;
    const col = this._cols.vertColor();

    for (let i = 0; i < this._facecubes; i++) {
      const theta = i * TWO_PI / this._facecubes;
      _ringDir.set(0, Math.sin(theta), Math.cos(theta)).applyQuaternion(this._facingQuat);

      for (const tp of this._faceTrails) {
        _dummy.position.copy(this._pos).addScaledVector(_ringDir, tp.dist);
        _dummy.scale.setScalar(tp.size / FACECUBE_SIZE);  // facecubeGeo is FACECUBE_SIZE × FACECUBE_SIZE
        _dummy.updateMatrix();
        this._faceTrailMesh.setMatrixAt(instanceIdx++, _dummy.matrix);
      }
    }

    this._faceTrailMesh.count = instanceIdx;
    this._faceTrailMesh.material.color.copy(col);
    this._faceTrailMesh.instanceMatrix.needsUpdate = true;
  }

  _renderStars() {
    for (const s of this._spheres) s.refreshMesh(this._pos);
  }
}
