// licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
// https://creativecommons.org/licenses/by-sa/4.0/

// Manages one icosasphere shell of star dots for the Explodeworm detonation animation.
// Created by Explodeworm during _startExplosion(); owns its own InstancedMesh.

import { SphereGeometry, MeshBasicMaterial, InstancedMesh, Object3D } from 'three';
import { Icosasphere } from './icosasphere.js';
import { hsvToRgb } from './color.js';
import {
  MAX_H, STAR_INIT_RAD, STAR_MAX_RAD, STAR_MIN_COL_DIFF, STAR_MAX_COL_DIFF
} from './settings.js';

// Shared star geometry — one SphereGeometry for all ExplodeSphere instances
const _starGeo = new SphereGeometry(1, 6, 4);

// Reusable temp
const _dummy = new Object3D();

function _hsbWrap(h) {
  if (h < 0) return h + MAX_H;
  if (h > MAX_H) return h - MAX_H;
  return h;
}

export class ExplodeSphere {
  constructor(maxR, recurse, pulseStart, pulseTime, initHue, s, b, verticesGroup) {
    this._maxR = maxR;
    this._r = 0;
    this._starRad = STAR_INIT_RAD;
    this._pulseStart = pulseStart;
    this._pulseTime = pulseTime;
    this._pulseMid = pulseStart + pulseTime / 2;
    this._s = s;
    this._b = b;
    this._finished = false;

    const iSphere = new Icosasphere(recurse);
    this._stars = iSphere.getAllPoints();

    // Hue setup — port of Processing ExplodeSphere constructor
    this._initHue = initHue;
    this._curHue = initHue;

    const colDiff = STAR_MIN_COL_DIFF + Math.random() * (STAR_MAX_COL_DIFF - STAR_MIN_COL_DIFF);
    const targetHue = _hsbWrap(initHue + colDiff * (Math.random() >= 0.5 ? 1 : -1));

    let forward, backward;
    if (targetHue > initHue) {
      forward = targetHue - initHue;
      backward = -((initHue + MAX_H) - targetHue);
    } else {
      forward = (targetHue + MAX_H) - initHue;
      backward = -(initHue - targetHue);
    }
    const path = Math.abs(forward) < Math.abs(backward) ? forward : backward;
    this._hueStep = path / (this._pulseMid - pulseStart);

    this._mesh = new InstancedMesh(_starGeo, new MeshBasicMaterial(), this._stars.length);
    this._mesh.frustumCulled = false;
    verticesGroup.add(this._mesh);
  }

  // Port of Processing ExplodeSphere.update() verbatim
  update(animPerc, easedPerc) {
    if (this._finished) return;

    if (animPerc < this._pulseStart + this._pulseTime) {
      this._r = this._maxR * easedPerc;
      if (animPerc > this._pulseStart) {
        const freq = Math.PI * 2 / this._pulseTime;
        const cosVal = (Math.cos(freq * animPerc + Math.PI - freq * this._pulseStart) + 1) / 2;
        if (animPerc < this._pulseMid) {
          this._starRad = cosVal * (STAR_MAX_RAD - STAR_INIT_RAD) + STAR_INIT_RAD;
          this._curHue = _hsbWrap(this._initHue + this._hueStep * (animPerc - this._pulseStart));
        } else {
          this._starRad = cosVal * STAR_MAX_RAD;
        }
      }
    } else {
      this._finished = true;
    }
  }

  refreshMesh(pos) {
    const stars = this._stars;
    for (let i = 0; i < stars.length; i++) {
      _dummy.position.set(pos.x + stars[i].x * this._r, pos.y + stars[i].y * this._r, pos.z + stars[i].z * this._r);
      _dummy.scale.setScalar(this._starRad);
      _dummy.updateMatrix();
      this._mesh.setMatrixAt(i, _dummy.matrix);
    }
    this._mesh.instanceMatrix.needsUpdate = true;
    const { r, g, b } = hsvToRgb(this._curHue, this._s, this._b);
    this._mesh.material.color.setRGB(r, g, b);
    this._mesh.visible = !this._finished;
  }

  isFinished() { return this._finished; }

  dispose(verticesGroup) {
    verticesGroup.remove(this._mesh);
    // _starGeo is shared — don't dispose it
    this._mesh.material.dispose();
    this._mesh.dispose();  // frees the instanceMatrix GPU buffer
  }
}
