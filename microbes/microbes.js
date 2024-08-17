// inspired by "teleporting dots" https://www.openprocessing.org/sketch/462297/
// global settings - mess with these to alter sketch behaviour
const FRAMERATE = 60; //fps
const MAX_H = 360; // probably shouldn't change this...
const MAX_SBA = 100; // ...or this
const DOT_COUNT = 120; // number of dots
const MOUSE_INF_RAD = 300; // radius of mouse click influence
const MOUSE_INF_RND = 5; // random % multiplier for force on clicked dots
const ENERGY_MULT_STEP = 0.2; // increment for energy levels set by user
const DEFAULT_ENERGY = 2; // default/starting energy level

// dot settings
const MIN_STROKE = 5; // min dot stroke weight
const MAX_STROKE = 10; // max dot stroke weight
const MIN_WAIT = 0; // min dot frames until next dash
const MAX_WAIT = 25; // max dot frames until next dash
const MIN_D_TIME = 0.5; // min time dashing to destination in seconds
const MAX_D_TIME = 1; // max time dashing to destination in seconds
const MIN_EASE_POW = 3; // min ^x for dashing easing animation. Lower = smoother movement
const MAX_EASE_POW = 6; // max ^x for dashing easing animation. Higher = jerkier movement
const DEST_RAD = 170; // radius in px around specific dash destination dot can move to
const RAND_RAD = 200; // radius in px dot can move to from current pos when no specific dest
const MIN_PATH_LEN = 4; // min length of path array
const MAX_PATH_LEN = 8; // max length of path array
const MIN_PATH_OFF = 5; // min offset in pixels for point along path (from straight line)
const MAX_PATH_OFF = 25; // max offset in pixels for point along path (from straight line)
const DASH_ACCURACY = 9; // # of points used to map dash to curve path, including control
const DASH_TRAIL = 0.15; // % of curve path to draw as dash curve, including control points
const CLICK_COOLDOWN = 0.8; // clicked dots can be clicked again after this % of their dash
const DIST_R_MULT = 70; // distance to dest / this = path randomness multiplier

var cnv; // canvas object
var dots; // array of dots
var mouseActive; // is mouse currently over canvas?
var ENERGY_MULT; // multiplier for dot movement activity, set by user

function setup() {
  frameRate(FRAMERATE);
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('drawHere');
  cnv.mouseOver(setMouseActive);
  cnv.mouseOut(setMouseInactive);
  colorMode(HSB, MAX_H, MAX_SBA, MAX_SBA, MAX_SBA);
  strokeJoin(ROUND)
  ENERGY_MULT = ENERGY_MULT_STEP * DEFAULT_ENERGY;

  // create dots
  dots = new Array(DOT_COUNT);
  for (var i = 0; i < DOT_COUNT; i++) {
    dots[i] = new Dot();
  }
}

// keep track of the mouse
function setMouseActive() { mouseActive = true; }
function setMouseInactive() { mouseActive = false; }

function draw() {
  background(0, 0, MAX_SBA / 20, MAX_SBA);
  // run and draw dots
  noFill();
  for (var i = 0; i < DOT_COUNT; i++) {
    dots[i].update();
    dots[i].display(false); // true/false to show/hide dot paths
  }

  // noStroke();
  // fill(0, 0, 100);
  // text("Energy Level: " + round(ENERGY_MULT / ENERGY_MULT_STEP), 20, 20);
}

// dot object
function Dot() {
  // declare member variables here for sanity
  this.posX = []; // dot X pos / X positions while dashing
  this.posY = []; // dot Y pos / Y positions while dashing
  this.posLen = 0; // length of position arrays
  this.pathX = []; // list of X coords for curve describing dash path
  this.pathY = []; // list of Y coords for curve describing dash path
  this.c = color; // color
  this.strWeight = 0; // stroke weight
  this.nextDash = 0; // countdown until next dash
  this.dashInc = 0; // % to increment through dash animation per frame
  this.dashPerc = 0; // percentage way through dash animation
  this.easePow = 0; // power used for animation easing when dashing
  this.clicked = false; // record if current dash is due to mouse click

  // randomise dot initial properties
  this.posX[0] = random(0, width);
  this.posY[0] = random(0, height);
  for (let i = 1; i < DASH_ACCURACY; i++) {
    this.posX[i] = this.posX[0];
    this.posY[i] = this.posY[0];
  }
  let dashTime = random(MIN_D_TIME, MAX_D_TIME);
  this.dashInc = 1 / (dashTime * FRAMERATE);
  this.prepareNextDash(true, undefined, undefined, RAND_RAD, false, false);
  // dots slowly come to life at first. Rargh magic numbers! >_<
  this.nextDash = round(random(0, MAX_WAIT * 10));
  this.easePow = random(MIN_EASE_POW, MAX_EASE_POW);
  this.c = color(random(0, MAX_H),
    random(MAX_SBA / 2, MAX_SBA),
    random(MAX_SBA / 2, MAX_SBA),
    MAX_SBA);
  this.strWeight = random(MIN_STROKE, MAX_STROKE);
}

// run dot behaviour
Dot.prototype.update = function () {
  if (this.nextDash > 0) {
    // still waiting for next dash
    this.nextDash--;
    return;
  }
  //dashing! Calc points along curve path forming dash subcurve
  this.dashPerc += this.dashInc; // allow dashPerc > 1 so trailing curve can finish animation
  this.posX = [];
  this.posY = [];
  for (let i = 0; i < DASH_ACCURACY; i++) {
    // Calc movement animation (easing is different for path from a click)
    let posPerc = constrain(this.dashPerc - (DASH_TRAIL / DASH_ACCURACY) * i, 0, 1);
    if (this.clicked)
      posPerc = this.easeOut(posPerc, this.easePow);
    else
      posPerc = this.animEase(posPerc, this.easePow);

    let v = this.calcPosOnPath(posPerc);
    this.posX.push(v.x);
    this.posY.push(v.y);
  }

  // check if we've finished dashing
  if (this.dashPerc > 1 + DASH_TRAIL) {
    // tell dot where to dash next, depending if we're chasing the mouse or not
    if (mouseActive) {
      this.prepareNextDash(true, mouseX, mouseY, DEST_RAD, true, false);
    } else {
      this.prepareNextDash(true, undefined, undefined, RAND_RAD, false, false);
    }
  }
}

// draw dot to canvas
Dot.prototype.display = function (showPath) {
  if (showPath) {
    stroke(0, 0, 100, 100);
    strokeWeight(1);
    beginShape();
    curveVertex(this.pathX[0], this.pathY[0]);
    for (let i = 0; i <= this.pathLen; i++) {
      curveVertex(this.pathX[i], this.pathY[i]);
    }
    curveVertex(this.pathX[this.pathLen], this.pathY[this.pathLen]);
    endShape();

    strokeWeight(4);
    for (let i = 0; i <= this.pathLen; i++) {
      point(this.pathX[i], this.pathY[i]);
    }
  }

  // draw a line if we're moving or a dot if we're not
  stroke(this.c);
  strokeWeight(this.strWeight);
  if (this.nextDash <= 0) {
    beginShape();
    // first and last points are control points, not displayed
    curveVertex(this.posX[0], this.posY[0]);
    for (let i = 1; i < DASH_ACCURACY - 1; i++) {
      curveVertex(this.posX[i], this.posY[i]);
    }
    curveVertex(this.posX[DASH_ACCURACY - 1], this.posY[DASH_ACCURACY - 1]);
    endShape();

  } else {
    point(this.posX[0], this.posY[0]);
  }
}

// prepare dot data for the next dash
Dot.prototype.prepareNextDash = function (delay, xDest, yDest, destRad, allowOOB, clicked) {
  // position (check if we've been given a destination)
  if ((xDest === undefined) || (yDest === undefined)) {
    // choose random destination
    let v = p5.Vector.random2D().mult(random(0, destRad) * ENERGY_MULT);
    xDest = this.posX[0] + v.x;
    yDest = this.posY[0] + v.y;
  } else {
    // move somewhere specific. Possibly within a certain radius of target dest
    if (destRad > 0) {
      // choose a random spot inside the target radius
      let v = p5.Vector.random2D().mult(random(0, destRad));
      xDest += v.x;
      yDest += v.y;
    }
  }
  // if moving OOB is not allowed replace OOB destinations with random ones
  if ((allowOOB === undefined) || (!allowOOB)) {
    if ((xDest < 0) || (xDest > width) || (yDest < 0) || (yDest > height)) {
      xDest = random(0, width);
      yDest = random(0, height);
    }
  }

  // plot random points along the path to our chosen destination for curves
  this.pathLen = round(random(MIN_PATH_LEN, MAX_PATH_LEN));
  this.pathX[0] = this.posX[0];
  this.pathY[0] = this.posY[0];
  let destVect = p5.Vector.sub(createVector(xDest, yDest),
    createVector(this.posX[0], this.posY[0]));
  // further destinations have more erratic paths
  let rnd = max(destVect.mag() / DIST_R_MULT, 1);
  for (let i = 1; i < this.pathLen; i++) {
    let v = p5.Vector.mult(destVect, i / this.pathLen);
    // inject randomness
    v.add(p5.Vector.random2D().mult(random(MIN_PATH_OFF, MAX_PATH_OFF) * ENERGY_MULT * rnd));
    this.pathX[i] = this.posX[0] + v.x;
    this.pathY[i] = this.posY[0] + v.y;
  }
  this.pathX[this.pathLen] = xDest;
  this.pathY[this.pathLen] = yDest;

  // delay (if we have one)
  if (delay)
    this.nextDash = round(random(MIN_WAIT, MAX_WAIT));
  else
    this.nextDash = 0;

  // animation
  this.dashPerc = 0;

  // dash caused by click?
  if (clicked === undefined)
    this.clicked = false;
  else
    this.clicked = clicked;
}

// for a given % way through dash animation, return coords along dash curve
Dot.prototype.calcPosOnPath = function (perc) {
  // find current position on current curve section
  let secPerc = perc * (this.pathLen);
  let p1 = int(secPerc); // curve point 1
  let p2 = min(p1 + 1, this.pathLen); // curve point 2
  let c1 = max(p1 - 1, 0); // control point 1
  let c2 = min(p2 + 1, this.pathLen); // control point 2
  secPerc -= p1;

  let x = curvePoint(this.pathX[c1], this.pathX[p1], this.pathX[p2], this.pathX[c2], secPerc);
  let y = curvePoint(this.pathY[c1], this.pathY[p1], this.pathY[p2], this.pathY[c2], secPerc);
  return createVector(x, y);
}

// being pushed by a mouseclick basically interrupts everything except for previous clicks
Dot.prototype.mousePush = function (v) {
  // argument v is the vector from the mouse pos to dot's current pos
  // the closer dot is to click, the further it gets pushed
  let force = 1 - v.mag() / MOUSE_INF_RAD;
  force = force * MOUSE_INF_RAD * random(1, 1 + MOUSE_INF_RND);
  let destV = p5.Vector.mult(v.normalize(), force);
  this.prepareNextDash(false, this.posX[0] + destV.x, this.posY[0] + destV.y, 0, true, true);
}

// animation easing for dot movement
// acceleration until half-way, then identical deceleration (returns 0 to 1)
Dot.prototype.animEase = function (perc, power) {
  perc *= 2; // easy way to split anim percentage into 2 steps
  if (perc < 1) {
    return pow(perc, power) / 2;
  } else {
    perc--; // percentage into deceleration
    return 1 - (pow(1 - perc, power) / 2);
  }
}

// use ease-out only for mouse clicks (start quick & decelerate)
Dot.prototype.easeOut = function (perc, power) {
  return 1 - pow(1 - perc, power);
}

// mouse click interrupts everything to push dots away
function mouseClicked() {
  for (var i = 0; i < DOT_COUNT; i++) {
    // check if dot is close enough to be affected. Ignore (most) dots already clicked
    let d = dots[i];
    if ((d.clicked) && (d.dashPerc < CLICK_COOLDOWN)) { continue; }
    var v = p5.Vector.sub(createVector(d.posX[0], d.posY[0]), createVector(mouseX, mouseY));
    if (v.mag() < MOUSE_INF_RAD) {
      // dot being pushed by mouse!
      d.mousePush(v);
    }
  }
}

// touch signals mouse should be active
function touchStarted() {
  setMouseActive()
}

// resize canvas when window is resized
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// let user set dot energy levels
function keyPressed() {
  let n = int(key);
  if ((!isNaN(n)) && (n > 0) && (n < 10)) {
    ENERGY_MULT = n * ENERGY_MULT_STEP;
  }
}
