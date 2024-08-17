"use strict";
/*
 * A fast javascript implementation of simplex noise by Jonas Wagner

Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
Better rank ordering method by Stefan Gustavson in 2012.

 Copyright (c) 2021 Jonas Wagner

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */
var F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6, F4 = (Math.sqrt(5) - 1) / 4, G4 = (5 - Math.sqrt(5)) / 20, grad3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]), grad4 = new Float32Array([0, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1, -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 1, 0, 1, 1, 1, 0, 1, -1, 1, 0, -1, 1, 1, 0, -1, -1, -1, 0, 1, 1, -1, 0, 1, -1, -1, 0, -1, 1, -1, 0, -1, -1, 1, 1, 0, 1, 1, 1, 0, -1, 1, -1, 0, 1, 1, -1, 0, -1, -1, 1, 0, 1, -1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, -1, 1, 1, 1, 0, 1, 1, -1, 0, 1, -1, 1, 0, 1, -1,
  -1, 0, -1, 1, 1, 0, -1, 1, -1, 0, -1, -1, 1, 0, -1, -1, -1, 0]), SimplexNoise = function (a) { a = void 0 === a ? Math.random : a; a = "function" == typeof a ? a : alea(a); this.p = buildPermutationTable(a); this.perm = new Uint8Array(512); this.permMod12 = new Uint8Array(512); for (a = 0; 512 > a; a++)this.perm[a] = this.p[a & 255], this.permMod12[a] = this.perm[a] % 12 };
SimplexNoise.prototype.noise2D = function (a, e) {
  var b = this.permMod12, d = this.perm, c = 0, f = 0, r = 0, m = (a + e) * F2, q = Math.floor(a + m), l = Math.floor(e + m); m = (q + l) * G2; var g = a - (q - m), h = e - (l - m); if (g > h) { var k = 1; var n = 0 } else k = 0, n = 1; var p = g - k + G2, w = h - n + G2; m = g - 1 + 2 * G2; var x = h - 1 + 2 * G2; q &= 255; l &= 255; var v = .5 - g * g - h * h; 0 <= v && (c = 3 * b[q + d[l]], v *= v, c = v * v * (grad3[c] * g + grad3[c + 1] * h)); g = .5 - p * p - w * w; 0 <= g && (f = 3 * b[q + k + d[l + n]], g *= g, f = g * g * (grad3[f] * p + grad3[f + 1] * w)); p = .5 - m * m - x * x; 0 <= p && (b = 3 * b[q + 1 + d[l + 1]], p *= p, r = p * p * (grad3[b] * m + grad3[b + 1] * x)); return 70 *
    (c + f + r)
};
SimplexNoise.prototype.noise3D = function (a, e, b) {
  var d = this.permMod12, c = this.perm, f = (a + e + b) * F3, r = Math.floor(a + f), m = Math.floor(e + f), q = Math.floor(b + f); f = (r + m + q) * G3; var l = a - (r - f); var g = e - (m - f), h = b - (q - f), k, n; if (l >= g) if (g >= h) { var p = 1; var w = k = 0; var x = n = 1; var v = 0 } else l >= h ? (p = 1, w = k = 0) : (k = p = 0, w = 1), n = 1, x = 0, v = 1; else g < h ? (k = p = 0, w = 1, n = 0, v = x = 1) : l < h ? (p = 0, k = 1, n = w = 0, v = x = 1) : (p = 0, k = 1, w = 0, x = n = 1, v = 0); var u = l - p + G3; var t = g - k + G3, B = h - w + G3; a = l - n + 2 * G3; var y = g - x + 2 * G3, z = h - v + 2 * G3; b = l - 1 + 3 * G3; e = g - 1 + 3 * G3; f = h - 1 + 3 * G3; r &= 255; m &= 255;
  q &= 255; var A = .6 - l * l - g * g - h * h; if (0 > A) l = 0; else { var C = 3 * d[r + c[m + c[q]]]; A *= A; l = A * A * (grad3[C] * l + grad3[C + 1] * g + grad3[C + 2] * h) } g = .6 - u * u - t * t - B * B; 0 > g ? u = 0 : (p = 3 * d[r + p + c[m + k + c[q + w]]], g *= g, u = g * g * (grad3[p] * u + grad3[p + 1] * t + grad3[p + 2] * B)); t = .6 - a * a - y * y - z * z; 0 > t ? a = 0 : (n = 3 * d[r + n + c[m + x + c[q + v]]], t *= t, a = t * t * (grad3[n] * a + grad3[n + 1] * y + grad3[n + 2] * z)); y = .6 - b * b - e * e - f * f; 0 > y ? d = 0 : (d = 3 * d[r + 1 + c[m + 1 + c[q + 1]]], y *= y, d = y * y * (grad3[d] * b + grad3[d + 1] * e + grad3[d + 2] * f)); return 32 * (l + u + a + d)
};
SimplexNoise.prototype.noise4D = function (a, e, b, d) {
  var c = this.perm, f = (a + e + b + d) * F4, r = Math.floor(a + f), m = Math.floor(e + f), q = Math.floor(b + f), l = Math.floor(d + f); f = (r + m + q + l) * G4; var g = a - (r - f); var h = e - (m - f); var k = b - (q - f), n = d - (l - f); d = b = f = e = 0; g > h ? e++ : f++; g > k ? e++ : b++; g > n ? e++ : d++; h > k ? f++ : b++; h > n ? f++ : d++; k > n ? b++ : d++; var p = 3 <= e ? 1 : 0, w = 3 <= f ? 1 : 0, x = 3 <= b ? 1 : 0, v = 3 <= d ? 1 : 0; var u = 2 <= e ? 1 : 0; var t = 2 <= f ? 1 : 0, B = 2 <= b ? 1 : 0, y = 2 <= d ? 1 : 0; a = 1 <= e ? 1 : 0; var z = 1 <= f ? 1 : 0, A = 1 <= b ? 1 : 0, C = 1 <= d ? 1 : 0, F = g - p + G4, G = h - w + G4, H = k - x + G4, I = n - v + G4, J = g - u + 2 * G4, K = h - t +
    2 * G4, L = k - B + 2 * G4, M = n - y + 2 * G4, N = g - a + 3 * G4, O = h - z + 3 * G4, P = k - A + 3 * G4, Q = n - C + 3 * G4; d = g - 1 + 4 * G4; b = h - 1 + 4 * G4; f = k - 1 + 4 * G4; e = n - 1 + 4 * G4; r &= 255; m &= 255; q &= 255; l &= 255; var D = .6 - g * g - h * h - k * k - n * n; if (0 > D) g = 0; else { var E = c[r + c[m + c[q + c[l]]]] % 32 * 4; D *= D; g = D * D * (grad4[E] * g + grad4[E + 1] * h + grad4[E + 2] * k + grad4[E + 3] * n) } h = .6 - F * F - G * G - H * H - I * I; 0 > h ? h = 0 : (k = c[r + p + c[m + w + c[q + x + c[l + v]]]] % 32 * 4, h *= h, h = h * h * (grad4[k] * F + grad4[k + 1] * G + grad4[k + 2] * H + grad4[k + 3] * I)); k = .6 - J * J - K * K - L * L - M * M; 0 > k ? u = 0 : (u = c[r + u + c[m + t + c[q + B + c[l + y]]]] % 32 * 4, k *= k, u = k * k * (grad4[u] * J + grad4[u +
      1] * K + grad4[u + 2] * L + grad4[u + 3] * M)); t = .6 - N * N - O * O - P * P - Q * Q; 0 > t ? a = 0 : (a = c[r + a + c[m + z + c[q + A + c[l + C]]]] % 32 * 4, t *= t, a = t * t * (grad4[a] * N + grad4[a + 1] * O + grad4[a + 2] * P + grad4[a + 3] * Q)); z = .6 - d * d - b * b - f * f - e * e; 0 > z ? c = 0 : (c = c[r + 1 + c[m + 1 + c[q + 1 + c[l + 1]]]] % 32 * 4, z *= z, c = z * z * (grad4[c] * d + grad4[c + 1] * b + grad4[c + 2] * f + grad4[c + 3] * e)); return 27 * (g + h + u + a + c)
}; function buildPermutationTable(a) { for (var e = new Uint8Array(256), b = 0; 256 > b; b++)e[b] = b; for (b = 0; 255 > b; b++) { var d = b + ~~(a() * (256 - b)), c = e[b]; e[b] = e[d]; e[d] = c } return e }
function alea(a) { var e = 0, b = 0, d = 0, c = 1, f = masher(); e = f(" "); b = f(" "); d = f(" "); e -= f(a); 0 > e && (e += 1); b -= f(a); 0 > b && (b += 1); d -= f(a); 0 > d && (d += 1); return function () { var r = 2091639 * e + 2.3283064365386963E-10 * c; e = b; b = d; return d = r - (c = r | 0) } } function masher() { var a = 4022871197; return function (e) { e = e.toString(); for (var b = 0; b < e.length; b++) { a += e.charCodeAt(b); var d = .02519603282416938 * a; a = d >>> 0; d -= a; d *= a; a = d >>> 0; d -= a; a += 4294967296 * d } return 2.3283064365386963E-10 * (a >>> 0) } };


// things that govern behaviour (and other useful constants)
const TAU = Math.PI * 2;
const NOISE = new SimplexNoise();
const FRAMERATE = 30;
const MAX_SECTORS = 50;
const SCALING = {
  'r': [250125, 8294400],
  'n': [22000, 120000]
};
const BACKGROUND = '#121212';
const SHOW_DOTS_RANGE = [0.1, 1, 0.1];
const V_MIN = 0.1;
const V_MOD_RANGE = [-1, 1.7, 0.15];
const V_BOOST_INIT = 5;
const V_BOOST_MIN = 1.1;
const V_BOOST_DECAY = 0.95;
const V_BOOST_MOD_RANGE = []
const NOISE_T_INC = 0.006;
const NOISE_XY_INC = 0.035;

// the sketch
const canvas = document.getElementById('drawHere');
const sketch = {
  'canvas': canvas,
  'ctx': canvas.getContext('2d'),
  'SHOW_DOTS': 0.7,
  'V_MOD': 0.5,
  'V_BOOST': 1,
  'NUM_DOTS': 0,
  'SECTOR_RES': 0,
  'V_SECTORS': 0,
  'H_SECTORS': 0,
  'V_OVERFLOW': 0,
  'H_OVERFLOW': 0,
  'cnvW': 0,
  'cnvW': 0,
  'frameNum': 0,
  'sectors': [],
  'dots': [],
  'velocityMult': 0.5,
  'CANVAS_ACTIVE': false,
  'IGNORE_NEXT_BOOST': false,
  'NEEDS_INIT': true,
};
sketch.ctx.filter = 'url(#remove-alpha)';

function init() {
  let pr = sketch.canvas.parentElement.getBoundingClientRect();
  sketch.cnvW = sketch.canvas.width = pr.width;
  sketch.cnvH = sketch.canvas.height = pr.height;
  setupSectors(sketch);
  setupDots(sketch);
  sketch.NEEDS_INIT = false;
}

function drawFrame() {
  try {
    // check if we need to re-init (e.g. on page resize)
    if (sketch.NEEDS_INIT) {
      init();
    }

    sketch.frameNum++;

    // background
    sketch.ctx.fillStyle = BACKGROUND;
    sketch.ctx.fillRect(0, 0, sketch.cnvW, sketch.cnvH);

    // sectors
    for (let i = 0; i < sketch.H_SECTORS; i++) {
      for (let j = 0; j < sketch.V_SECTORS; j++) {
        sketch.sectors[i][j].run(sketch);
      }
    }

    // dots: velocity
    if (sketch.V_BOOST > 1) {
      sketch.velocityMult = Math.max(Math.abs(sketch.V_MOD), sketch.V_BOOST) * (sketch.V_MOD < 0 ? -1 : 1);
      sketch.V_BOOST = sketch.V_BOOST < V_BOOST_MIN ? 1 : sketch.V_BOOST * V_BOOST_DECAY;
    } else {
      sketch.velocityMult = sketch.V_MOD;
    }
    sketch.velocityMult = Math.max(Math.abs(sketch.velocityMult), V_MIN) * (sketch.velocityMult < 0 ? -1 : 1);
    // dots: number to draw to screen
    let runCount = Math.floor(sketch.dots.length * sketch.SHOW_DOTS);
    // dots: run
    sketch.ctx.fillStyle = '#fff';
    sketch.ctx.beginPath();
    for (let i = 0; i < runCount; i++) {
      sketch.dots[i].update(sketch);
      sketch.dots[i].display(sketch);
    }
    sketch.ctx.fill();
  }
  catch (e) {
    init();
  }
  requestAnimationFrame(drawFrame);
}


function Sector(s, xInd, yInd) {
  this.xInd = xInd;           // x index
  this.yInd = yInd;           // y index
  this.x = xInd * s.SECTOR_RES; // x pos
  this.y = yInd * s.SECTOR_RES; // y pos
  this.n = 0;                 // noise value
}

Sector.prototype.run = function (s) {
  this.n = (
    NOISE.noise3D(this.xInd * NOISE_XY_INC, this.yInd * NOISE_XY_INC, s.frameNum * NOISE_T_INC) + 1
  ) * 0.5 + 0.2;
}


function Dot() { }
Dot.prototype = {
  initDot(s, fromEdge = false) {
    this.sx = Math.floor(Math.random() * s.sectors.length);    // x sector
    this.sy = Math.floor(Math.random() * s.sectors[0].length); // y sector
    if (fromEdge)
      this.x = s.V_MOD > 0 ? 1 : s.H_SECTORS * s.SECTOR_RES - 1;
    else
      this.x = (this.sx + Math.random()) * s.SECTOR_RES;       // x pos
    this.y = (this.sy + Math.random()) * s.SECTOR_RES;         // y pos
    this.dx = 0.5 + Math.random() * 0.5;                       // x velocity
    this.dy = (Math.random() - 0.5) * 0.5;                     // y velocity
  },

  update(s) {
    this.updateSecCoords(s);
    if (this.sx < 0 || this.sx >= s.sectors.length || this.sy < 0 || this.sy >= s.sectors[0].length) {
      this.initDot(s, true); // OOB, re-init
    }
    this.x += this.dx * s.velocityMult;
    this.y += this.dy * s.velocityMult;
  },

  display(s) {
    let r = s.sectors[this.sx][this.sy].n;
    s.ctx.rect(this.x - r, this.y - r, r * 2, r * 2);
  },

  updateSecCoords(s) {
    this.sx = Math.floor(this.x / s.SECTOR_RES);
    this.sy = Math.floor(this.y / s.SECTOR_RES);
  }
}

// number of sectors = 1 more than can fully fit on the screen
function setupSectors(s) {
  s.sectors = null;
  s.sectors = new Array();
  if (s.cnvW > s.cnvH) {
    s.SECTOR_RES = Math.round(s.cnvW / MAX_SECTORS);
    s.H_SECTORS = MAX_SECTORS + 1;
    s.V_SECTORS = Math.ceil(s.cnvH / s.cnvW * MAX_SECTORS);
  } else {
    s.SECTOR_RES = Math.round(s.cnvH / MAX_SECTORS);
    s.V_SECTORS = MAX_SECTORS + 1;
    s.H_SECTORS = Math.ceil(s.cnvW / s.cnvH * MAX_SECTORS);
  }

  s.H_OVERFLOW = s.H_SECTORS * s.SECTOR_RES - s.cnvW;
  s.V_OVERFLOW = s.V_SECTORS * s.SECTOR_RES - s.cnvH;

  for (let i = 0; i < s.H_SECTORS; i++) {
    s.sectors.push([]);
    for (let j = 0; j < s.V_SECTORS; j++) {
      s.sectors[i].push(new Sector(s, i, j));
    }
  }
}

function setupDots(s) {
  let cnvRes = s.cnvW * s.cnvH;
  let scalePerc = Math.max(Math.min((cnvRes - SCALING.r[0]) / (SCALING.r[1] - SCALING.r[0]), 1), 0);
  s.NUM_DOTS = Math.round(SCALING.n[0] + (SCALING.n[1] - SCALING.n[0]) * scalePerc);

  s.dots = null;
  s.dots = new Array();
  for (let i = 0; i < s.NUM_DOTS; i++) {
    let d = new Dot();
    d.initDot(s);
    s.dots.push(d);
  }
}

window.addEventListener('resize', () => {
  // canvases might need re-init on resize
  let pr = sketch.canvas.parentElement.getBoundingClientRect();
  if (pr.width != sketch.cnvW || pr.height != sketch.cnvH) {
    sketch.NEEDS_INIT = true;
  }
});

window.addEventListener('DOMContentLoaded', () => {
  init();
  handleInputs();
  requestAnimationFrame(drawFrame);
});

/**
 * Wire up event handlers
 */
function handleInputs() {
  // mouse interaction
  sketch.canvas.addEventListener('mousedown', () => sketch.CANVAS_ACTIVE = true);
  sketch.canvas.addEventListener('mouseup', () => sketch.CANVAS_ACTIVE = false);
  sketch.canvas.addEventListener('mousemove', e => {
    setVelocity(sketch, e.offsetX);
    if (sketch.CANVAS_ACTIVE)
      setDotVisibility(sketch, e.offsetY);
  });
  sketch.canvas.addEventListener('touchmove', e => {
    let t = e.changedTouches[e.changedTouches.length - 1];
    let r = sketch.canvas.getBoundingClientRect();
    setVelocity(sketch, Math.min(Math.max(t.pageX - r.left, 0), r.right));
    setDotVisibility(sketch, Math.min(Math.max(t.pageY - r.top, 0), r.bottom));
  });
  sketch.canvas.addEventListener('click', () => {
    if (sketch.IGNORE_NEXT_BOOST) {
      sketch.IGNORE_NEXT_BOOST = false;
    } else {
      sketch.V_BOOST = V_BOOST_INIT;
    }
  });
}

function setVelocity(s, offsetX) {
  let xPosPerc = offsetX / s.cnvW;
  s.V_MOD = V_MOD_RANGE[0] + (V_MOD_RANGE[1] - V_MOD_RANGE[0]) * xPosPerc;
}

function setDotVisibility(s, offsetY) {
  let yPosPerc = 1 - offsetY / s.cnvH;
  s.SHOW_DOTS = SHOW_DOTS_RANGE[0] + (SHOW_DOTS_RANGE[1] - SHOW_DOTS_RANGE[0]) * yPosPerc;
  s.IGNORE_NEXT_BOOST = true;
}