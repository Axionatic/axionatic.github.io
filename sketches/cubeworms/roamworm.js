// licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
// https://creativecommons.org/licenses/by-sa/4.0/

// Primary active worm state. Drifts around propelled by thrusters, repelled by
// gravity wall, leaving trails, with pulsing glow edges.

import { Vector3 } from 'three';
import { Cubeworm } from './cubeworm.js';
import { Thruster } from './thruster.js';
import {
  MAX_SPEED, MIN_EDGE, MAX_EDGE, MIN_PULSE_SPEED, MAX_PULSE_SPEED,
  SPAWN_STROKEW, GRAV_PWR, WALL_RAD, FACECUBE_DIST, FACECUBE_SIZE
} from './settings.js';

// Reusable temp
const _grav = new Vector3();

export class Roamworm extends Cubeworm {
  constructor(idOrSource, slot) {
    super(idOrSource, slot);

    if (idOrSource instanceof Roamworm) {
      // Copy from Roamworm source — preserve thruster/pulse state
      const src = idOrSource;
      this._thruster = src._thruster;
      this._pulseSpeed = src._pulseSpeed;
      this._pulseAnim = src._pulseAnim;
    } else if (idOrSource instanceof Cubeworm) {
      // Transitioning from non-Roamworm Cubeworm (e.g. Spawnworm). Note:
      // Recoverworm extends Travelworm extends Roamworm, so it takes the
      // branch above and keeps its thruster/pulse state.
      // pos/vel/facecubes already initialised by source; just init roam-specific state.
      this._initRoam();
    } else {
      // Fresh construction (idOrSource is a number)
      this._initFresh();
      this._initRoam();
    }
  }

  // Initialise roamworm-specific state
  _initRoam() {
    this._pulseSpeed = Math.random() * (MAX_PULSE_SPEED - MIN_PULSE_SPEED) + MIN_PULSE_SPEED;
    // Inverse sine ensures edge width matches SPAWN_STROKEW at transition
    this._pulseAnim = Math.asin(2 * ((SPAWN_STROKEW - MIN_EDGE) / (MAX_EDGE - MIN_EDGE)) - 1);
    // Engines online — use existing velocity so rotation stays constant
    this._thruster = new Thruster(this._vel.clone());
  }

  update() {
    this._calcVelocity();
    this.calcFacingQuat(this._vel);
    this._glowPulse();
    this._cols.run();
    this.spawnTrail();
  }

  display() {
    super.display();
    this._slot.updateFacecubes(FACECUBE_DIST, FACECUBE_SIZE, 0, this._pos, this._facingQuat);
  }

  // Update velocity: fire thrusters + apply gravity wall repulsion, clamp speed
  _calcVelocity() {
    const accel = this._thruster.run();
    accel.add(this._modAcceleration());

    this._vel.add(accel);
    const speed = this._vel.length();
    const maxSpeed = this._maxSpeed();
    if (speed > maxSpeed) {
      this._vel.multiplyScalar(maxSpeed / speed);
    }
    this._pos.add(this._vel);
  }

  // Wall gravity repulsion — inverse square law pushes worms away from boundary
  _modAcceleration() {
    const distToWall = Math.max(WALL_RAD - this._pos.length(), 1);
    const gravPwr = GRAV_PWR / (distToWall * distToWall);
    _grav.copy(this._pos);
    if (_grav.lengthSq() > 1e-10) {
      _grav.normalize();
    }
    _grav.multiplyScalar(-gravPwr);
    return _grav;
  }

  // Pulse thickness of edge stroke for glow effect
  _glowPulse() {
    this._strokeW = MIN_EDGE + ((Math.sin(this._pulseAnim) + 1) / 2) * (MAX_EDGE - MIN_EDGE);
    this._pulseAnim += this._pulseSpeed;
  }

  // Max speed — overridden by Hypnoworm, Pushworm in later phases
  _maxSpeed() {
    return MAX_SPEED;
  }
}
