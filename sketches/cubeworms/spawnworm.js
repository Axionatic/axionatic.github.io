// licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
// https://creativecommons.org/licenses/by-sa/4.0/

// Three-step spawn animation: facecubes grow at centre → split outward → main cube expands.
// Always constructed from a Sleepworm (copy constructor path).

import { Vector3 } from 'three';
import { Cubeworm } from './cubeworm.js';
import { Roamworm } from './roamworm.js';
import { getWormContext } from './wormcontext.js';
import { easeInOut } from './mathutils.js';
import {
  SPAWN_STROKEW, SPAWN_TRAIL_DELAY_MOD, ANIM_STEP_LEN,
  FACECUBE_SIZE, FACECUBE_DIST, MIN_FACECUBES, MAX_FACECUBES,
  FACE_BRIGHTNESS
} from './settings.js';

export class Spawnworm extends Cubeworm {
  constructor(source) {
    super(source);

    // Fresh position and facing for this spawn (Sleepworm had none)
    this._pos = this.getSpawnPos();
    this._facing = new Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    // _vel used by Roamworm thruster on transition; set to facing direction
    this._vel = this._facing.clone();

    // Facecube count
    this._facecubes = Math.round(
      Math.random() * (MAX_FACECUBES - MIN_FACECUBES) + MIN_FACECUBES
    );
    this._slot.setFacecubeCount(this._facecubes);
    this._nextTrailcube = this._trailSpawnDelay() + SPAWN_TRAIL_DELAY_MOD;
    this._strokeW = SPAWN_STROKEW;

    // Animation state — three sequential steps (0/1/2)
    this._animStep = 0;
    this._animFrame = 0;
    this._facecubeGrow = 0;
    this._facecubeSplit = 0;
    this._facecubeRot = 0;

    this.slot().setVisible(true);
    this.slot().updateMainScale(0); // main cube hidden until step 2
  }

  update() {
    const perc = easeInOut(this._animFrame / ANIM_STEP_LEN, 4); // quartic ease

    switch (this._animStep) {
      case 0: // FACECUBE_GROW: single facecube cluster grows at centre
        this._facecubeGrow = FACECUBE_SIZE * perc;
        break;
      case 1: // FACECUBE_SPLIT: facecubes spread to final positions
        this._facecubeSplit = FACECUBE_DIST * perc;
        break;
      case 2: // CUBEWORM_GROW: main cube expands, facecubes rotate
        this._facecubeRot = Math.PI * 2 * perc;
        break;
    }

    if (++this._animFrame >= ANIM_STEP_LEN) {
      this._animFrame = 0;
      // Snap step values to exact targets before advancing
      if (this._animStep === 0) this._facecubeGrow = FACECUBE_SIZE;
      if (this._animStep === 1) this._facecubeSplit = FACECUBE_DIST;
      this._animStep++;

      if (this._animStep > 2) {
        // The main loop re-reads worms[i] after update(), so the successor's
        // display() runs this frame, not ours — snap the main cube to full
        // size now or it stays permanently short of 1.0.
        this.slot().updateMainScale(1);
        const ctx = getWormContext();
        if (ctx.lure && ctx.lure.isActive()) {
          ctx.worms[this.id()] = new ctx.HypnowormClass(this);
        } else {
          ctx.worms[this.id()] = new Roamworm(this);
        }
      }
    }
  }

  // Completely override base display — do not call super.display()
  display() {
    this.calcFacingQuat(this._facing);
    this.slot().updateMainTransform(this._pos, this._facingQuat);
    // Main cube only visible in step 2, growing from 0 to 1
    this.slot().updateMainScale(
      this._animStep === 2 ? easeInOut(this._animFrame / ANIM_STEP_LEN, 4) : 0
    );
    this.slot().setEdgeWidth(SPAWN_STROKEW);
    this.slot().setFaceColor(this._cols.faceColor(FACE_BRIGHTNESS));
    this.slot().setEdgeColor(this._cols.vertColor());
    this.slot().updateFacecubes(
      this._facecubeSplit, this._facecubeGrow, this._facecubeRot,
      this._pos, this._facingQuat
    );
  }

  lurePlaced() {}
}
