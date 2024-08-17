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


const FRAMERATE = 30;
const SECTOR_RES = 50;
const NUM_DOTS = 3500;
const DOT_MIN_WEIGHT = 1;
const DOT_MAX_WEIGHT = 2;
const DOT_MAX_V = 1;
const NOISE = new SimplexNoise();

let V_OVERFLOW = 0;
let H_OVERFLOW = 0;
let V_SECTORS = 0;
let H_SECTORS = 0;

let sectors = [];
let dots = [];
let redoSectors = false;

function setup() {
  H_SECTORS = int(windowWidth / SECTOR_RES) + 1;
  V_SECTORS = int(windowHeight / SECTOR_RES) + 1;
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('drawHere');

  frameRate(FRAMERATE);
  colorMode(HSB, 360, 100, 100, 100);
  rectMode(CENTER);
  noFill();
  setupSectors();
  setupDots();
  background(0, 0, 0, 100);
}

function draw() {
  background(0, 0, 0, 25);
  // recalc sectors after window resize
  if (redoSectors) {
    redoSectors = false;
    setupSectors();
    setupDots();
    background(0, 0, 0, 100);
  }
  try {
    // "centre" the canvas, kind of
    push();
    translate(-(H_OVERFLOW / 2), -(V_OVERFLOW / 2));
    // draw sectors
    strokeWeight(1);
    for (let i = 0; i < H_SECTORS; i++) {
      for (let j = 0; j < V_SECTORS; j++) {
        sectors[i][j].run();
      }
    }
    // draw dots
    for (let i = 0; i < dots.length; i++) {
      dots[i].run();
    }
    pop();
  } catch (error) {
    // sometimes resizing can break things, sort of race condition-y. Lazy reset and continue
    redoSectors = true;
  }
}

class Sector {
  constructor(xInd, yInd) {
    this.xInd = xInd;           // x index
    this.yInd = yInd;           // y index
    this.x = xInd * SECTOR_RES; // x pos
    this.y = yInd * SECTOR_RES; // y pos
    this.n = 0;                 // noise value
    this.fx = 0;                // x force
    this.fy = 0;                // y force
  }

  run() {
    this.update();
    // this.display();
  }

  update() {
    this.n = (NOISE.noise3D(this.xInd * 0.03, this.yInd * 0.03, frameCount * 0.002) + 1) * PI * 4;
    this.fx = Math.sin(this.n) * 0.1;
    this.fy = Math.cos(this.n) * 0.1;
  }

  display() {
    stroke((this.n % TWO_PI) / TWO_PI * 360, 75, 75, 100);
    push();
    translate(this.x + SECTOR_RES / 2 - SECTOR_RES / 20, this.y + SECTOR_RES / 2);
    rotate(this.n);
    rect(0, 0, SECTOR_RES / 10, SECTOR_RES - 2);
    pop();
  }
}

class Dot {
  constructor() {
    this.special = false; // who will be one of the chosen few?
    this.h = 0;           // hue
    this.s = 0;           // saturation
    this.init();
  }

  init() {
    this.x = random(0, width);                                    // x pos
    this.y = random(0, height);                                   // y pos
    this.w = random(DOT_MIN_WEIGHT, DOT_MAX_WEIGHT);              // stroke weight
    this.b = random((this.special ? 80 : 20), 100);               // brightness
    this.updateSecCoords();                                       // get sector coords (this.sx, this.sy)
    this.dx = sectors[this.sx][this.sy].fx + Math.random() - 0.5; // x velocity
    this.dy = sectors[this.sx][this.sy].fy + Math.random() - 0.5; // y velocity
  }

  run() {
    this.update();
    this.display();
  }

  update() {
    this.updateSecCoords();
    if (this.sx < 0 || this.sx >= sectors.length || this.sy < 0 || this.sy >= sectors[0].length) {
      this.init(); // OOB, re-init
    }
    this.dx = constrain(this.dx * 0.994 + sectors[this.sx][this.sy].fx * 0.095 /* + (Math.random() - 0.5) * 0.085 */, -DOT_MAX_V, DOT_MAX_V);
    this.dy = constrain(this.dy * 0.994 + sectors[this.sx][this.sy].fy * 0.095 /* + (Math.random() - 0.5) * 0.085 */, -DOT_MAX_V, DOT_MAX_V);
    this.x += this.dx;
    this.y += this.dy;

    if (this.special) { this.h = (this.h + 1) % 360; } // 🌈
  }

  display() {
    stroke(this.h, this.s, this.b);
    strokeWeight(this.w);
    point(this.x, this.y)
  }

  updateSecCoords() {
    this.sx = Math.floor(this.x / SECTOR_RES);
    this.sy = Math.floor(this.y / SECTOR_RES);
  }

  imSpecial() {
    this.special = true;
    this.h = random(0, 360);
    this.s = random(80, 100);
    this.b = random(80, 100);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  redoSectors = true; // flags sectors for redraw after current draw cycle is finished
}

// number of sectors = 1 more than can fully fit on the screen
function setupSectors() {
  sectors = [];
  H_SECTORS = int(windowWidth / SECTOR_RES) + 1;
  V_SECTORS = int(windowHeight / SECTOR_RES) + 1;
  H_OVERFLOW = SECTOR_RES - (windowWidth % SECTOR_RES);
  V_OVERFLOW = SECTOR_RES - (windowHeight % SECTOR_RES);
  for (let i = 0; i < H_SECTORS; i++) {
    sectors.push([]);
    for (let j = 0; j < V_SECTORS; j++) {
      sectors[i].push(new Sector(i, j));
    }
  }
}

function setupDots() {
  dots = [];
  for (let i = 0; i < NUM_DOTS; i++) {
    dots.push(new Dot());
  }

  // special dots (above other dots)
  let numSpecial = Math.round(NUM_DOTS / 8);
  for (let i = NUM_DOTS - numSpecial; i < NUM_DOTS; i++) {
    dots[i].imSpecial();
  }
}