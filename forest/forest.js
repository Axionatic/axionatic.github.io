var seeds = [];
var trees = [];
var leavesAlive = [];
var leavesDying = [];
/** @type {Array<{x: number, y: number}>} */
var groundPoints = [];
var groundY = [];
var treeColours = [[]];
var leafColours = [[]];
var clickWait = 0;

// constants that determine the behaviour of the ground spline
const GROUND_MIN_Y_PERC = 0.45;
const GROUND_MAX_Y_PERC = 0.65;
const GROUND_X_MIN_INTERVAL = 50;
const GROUND_X_MAX_INTERVAL = 100;

// constants for the base terrain sine wave
var GROUND_AMPLITUDE = 15;
var GROUND_PERIOD = 30;

// constants for the slopes that modify the base sine wave
var MIN_Y_OFFSET = -120;
var MAX_Y_OFFSET = 120;
var MIN_SLOPE_LEN = 25;
var MAX_SLOPE_LEN = 50;
var MIN_GRADIENT = 0;
var MAX_GRADIENT = 1;

// all the things that a seed can do
var SEED_FALLING = 0;
var SEED_RESTING = 1;
var SEED_DIGGING = 2;
var SEED_GROWING = 3;
var SEED_RADIUS = 3;
var SEED_MIN_REST = 60;
var SEED_MAX_REST = 120;
var SEED_MIN_DEPTH = 10;
var SEED_MAX_DEPTH = 20;
var SEED_MIN_DIG_SPEED = 0.04;
var SEED_MAX_DIG_SPEED = 0.4;

// instructions for growing trees
var BRANCH_GROWING = 100;
var BRANCH_MATURE = 101;
var TREE_MIN_GROW_SPEED = 0.1;
var TREE_MAX_GROW_SPEED = 0.4;
var TOTAL_FORK_ANGLE = 120; // how widely branches spread. This should be < 360
var UP_DIRECTION_DEGREES = 90; // don't change this. https://processing.org/tutorials/trig/
var MIN_BRANCH_DEPTH = 2; // # of times a tree can fork
var MAX_BRANCH_DEPTH = 4;
var FORK_CHANCE = 0.8;
var MIN_BRANCHES = 1.8; // # of branches a tree limb forks into
var MAX_BRANCHES = 5.35; // (subjected to round()ing, so need to -/+ 0.? to make random() fairer)
var MIN_FORK_THRESHOLD = 0.5; // at what percent of total growth does a limb fork?;
var MAX_FORK_THRESHOLD = 0.8;
var MIN_BRANCH_LEN = 30;
var MAX_BRANCH_LEN = 60;
var CHILD_BRANCH_MODIFIER = 0.75;

// make the leaves all pretty and stuff
var LEAF_HIDING = 200;
var LEAF_GROWING = 201;
var LEAF_MATURE = 202;
var LEAF_FALLING = 203;
var LEAF_DYING = 204;
var LEAF_MIN_RADIUS = 3;
var LEAF_MAX_RADIUS = 7;
var LEAF_MIN_HIDE_TIME = 360;
var LEAF_MAX_HIDE_TIME = 840;
var LEAF_MIN_MATURE_TIME = 360;
var LEAF_MAX_MATURE_TIME = 3000;
var LEAF_GROW_CHANCE = 0.6;
var LEAF_RANDOM_PALETTE_CHANCE = 0.1;
var LEAF_MIN_GROW_SPEED = 0.01;
var LEAF_MAX_GROW_SPEED = 0.04;
var LEAF_MIN_FALL_DISTANCE = 40;
var LEAF_MIN_FALL_RATE = 0.3;
var LEAF_MAX_FALL_RATE = 0.7;
var FLOAT_MIN_PERIOD = 0.7;
var FLOAT_MAX_PERIOD = 3.5;
var HFLOAT_MIN_AMPLITUDE = 0.75;
var HFLOAT_MAX_AMPLITUDE = 2.25;
var VFLOAT_MIN_AMPLITUDE = 0.55;
var VFLOAT_MAX_AMPLITUDE = 0.85;
var LEAF_FLOAT_PERIOD_MOD = 0.5; // larger leaves tend to have a longer period
var LEAF_FLOAT_AMP_MOD = 0.7; // leaves with longer periods tend to have larger amplitude
var LEAF_MIN_LAND_Y = 15;
var LEAF_MAX_LAND_Y = 100;

// did anyone really think that I would make something that *wasn't* full of bright colours?
var MIN_FADE_TIME = 40;
var MAX_FADE_TIME = 80;
var MAX_R = 255;
var MAX_G = 255;
var MAX_B = 255;
var MAX_ALPHA = 255;

// constants that affect living things (so deep)
var GRAVITY = 0.05;
var DECAY = 1.5;

/* Unfortunately, we can only use random with floats. However we need a fair
 * way of picking randomly from an array. If we had an array of size 3,
 * then the rounding would be more likely to pick second element, because:
 * round(random(0,2)) --> 0.0 to 0.4999 = 0, 0.5 to 1.4999 = 1, 1.5 to 2 = 2.
 *
 * in such a scenario the percentages for each element to be chosen are:
 * array[0] = 25%, array[1] = 50%, array[2] = 25.
 * this is remedied by subtracting 0.5 from the lower limit of our random(),
 * and adding 0.5 to the upper limit. (random() never returns the specified upper limit)
 */
var RANDOM_FIX = 0.5;

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('drawHere');
  frameRate(30);
  //pixelDensity(1);
  colorMode(RGB, MAX_R, MAX_G, MAX_B, MAX_ALPHA);
  ellipseMode(RADIUS);
  // CalcLand();
  CalcLandSpline();

  background(0);

  // draw ground
  // stroke(MAX_R, MAX_G, MAX_B, MAX_ALPHA);
  // strokeWeight(1);
  // for (var i = 0; i < groundY.length - 1; i++) {
  //   line(i, groundY[i], i + 1, groundY[i + 1]);
  // }
  drawLandSpine();
  findGroundYPoints();

  // I guess it's ok to just dump all this here?
  treeColours = [
    [color('#C6D8FF'), color('#71A9F7'), color('#6B5CA5'), color('#72195A'), color('#4C1036')],
    [color('#A5FFE5'), color('#8CC7A1'), color('#816E94'), color('#74226C'), color('#4B2142')],
    [color('#B02E0C'), color('#EB4511'), color('#C1BFB5'), color('#8EB1C7'), color('#FEFDFF')],
    [color('#1C3144'), color('#596F62'), color('#7EA16B'), color('#C3D898'), color('#70161E')],
    [color('#12355B'), color('#420039'), color('#D72638'), color('#FFA5A5'), color('#FF570A')],
    [color('#1C1C7F'), color('#CF5C36'), color('#EFC88B'), color('#F4E3B2'), color('#D3D5D7')],
    [color('#9BE564'), color('#D7F75B'), color('#D19C1D'), color('#7D451B'), color('#472C1B')],
    [color('#4C022C'), color('#DE3C4B'), color('#87F5FB'), color('#4C1E30'), color('#CEC3C1')],
    [color('#00274C'), color('#708D81'), color('#F4D58D'), color('#BF0603'), color('#8D0801')],
    [color('#E5D7E2'), color('#FF8811'), color('#143642'), color('#119EA0'), color('#B21911')]];

  leafColours = [
    [color('#007FB2'), color('#2D9599'), color('#70A288'), color('#DAB785'), color('#D5896F')],
    [color('#D0EFB1'), color('#B3D89C'), color('#7DC1AB'), color('#77A6B6'), color('#4D7298')],
    [color('#577590'), color('#F3CA40'), color('#F2A541'), color('#F08A4B'), color('#D78A76')],
    [color('#E8C547'), color('#6D80F2'), color('#4D5061'), color('#7287FF'), color('#CDD1C4')],
    [color('#5B0C21'), color('#CC2A3D'), color('#E5325F'), color('#FC9F94'), color('#FFB7C5')],
    [color('#61E294'), color('#7BCDBA'), color('#6E71AF'), color('#BD93D8'), color('#B47AEA')],
    [color('#FABC3C'), color('#FFB238'), color('#F19143'), color('#FF773D'), color('#F55536')],
    [color('#5BBA6F'), color('#3FA34D'), color('#2A9134'), color('#137547'), color('#054A29')],
    [color('#574AE2'), color('#222A68'), color('#654597'), color('#AB81CD'), color('#E2ADF2')],
    [color('#26547C'), color('#Ef476F'), color('#FFD166'), color('#06D6A0'), color('#FFFCF9')]];
}

function draw() {
  background(0);
  clickWait = max(clickWait - 1, 0);

  // draw ground
  // stroke(MAX_R, MAX_G, MAX_B, MAX_ALPHA);
  // strokeWeight(1);
  // for (var i = 0; i < groundY.length - 1; i++) {
  //   line(i, groundY[i], i + 1, groundY[i + 1]);
  // }
  drawLandSpine();

  // go through seeds backwards, because we delete dead seeds after running
  // (deleting while iterating forwards would mess things up)
  strokeWeight(2);
  for (var i = seeds.length - 1; i >= 0; i--) {
    seeds[i].Run();
    if (!seeds[i].isAlive()) {
      seeds.splice(i, 1);
    }
  }

  for (var i = 0; i < trees.length; i++) {
    trees[i].Run();
  }

  // draw leave on the ground behind other leaves
  for (var i = leavesDying.length - 1; i >= 0; i--) {
    leavesDying[i].Run();
    if (!leavesDying[i].isAlive()) {
      leavesDying.splice(i, 1);
    }
  }

  for (var i = leavesAlive.length - 1; i >= 0; i--) {
    leavesAlive[i].Run();
    if (leavesAlive[i].status == LEAF_DYING) {
      leavesDying.push(leavesAlive[i]);
      leavesAlive.splice(i, 1);
    }
  }
}

// it's the ciiiiiiircle of liiiiiife! (...kindof)
function mousePressed() {
  if (mouseY >= groundY[mouseX] || clickWait > 1)
    return; // either clicked below ground or clicked too quickly

  seeds.push(new Seed(mouseX, mouseY));
  clickWait = 5;
}

// from little things big things grow~
function Seed(x, y) {
  this.xPos = x;
  this.yPos = y;
  this.velocity = 0;
  this.alpha = MAX_ALPHA;
  this.status = SEED_FALLING;
  this.restTime = round(random(SEED_MIN_REST, SEED_MAX_REST));
  this.digDepth = round(random(SEED_MIN_DEPTH, SEED_MAX_DEPTH));
  this.landingY = groundY[x];

  // primary function bringing seed to life 
  this.Run = function () {
    this.Update();
    this.Display();
  };

  // tell the seed to do its seed thing 
  this.Update = function () {
    switch (this.status) {
      case SEED_FALLING:
        this.yPos += this.velocity;
        this.velocity += GRAVITY;
        // are we still falling?
        if (this.yPos >= this.landingY) { this.status = SEED_RESTING; }
        break;

      case SEED_RESTING:
        this.restTime--;
        if (this.restTime <= 0) { this.status = SEED_DIGGING; }
        break;

      // seed decelerates linearly as it digs, to a given minimum
      case SEED_DIGGING:
        var digSpeed = SEED_MAX_DIG_SPEED * (1 - ((this.yPos - this.landingY) / (this.digDepth)));
        digSpeed = digSpeed > SEED_MIN_DIG_SPEED ? digSpeed : SEED_MIN_DIG_SPEED;
        this.yPos += digSpeed;

        if (this.yPos >= this.landingY + this.digDepth) {
          // seed has germinated!
          trees.push(new Trunk(round(this.xPos), round(this.yPos)));
          this.status = SEED_GROWING;
        }
        break;

      case SEED_GROWING:
        this.alpha -= DECAY;
        this.alpha = this.alpha > 0 ? this.alpha : 0;
        break;
    }
  };

  // draw seed (he comments, unnecessarily)
  this.Display = function () {
    noStroke();
    fill(MAX_R, MAX_G, MAX_B, this.alpha);
    ellipse(this.xPos, this.yPos, SEED_RADIUS, SEED_RADIUS);
  };

  // seed has lived a fruitful life (quite literally)
  this.isAlive = function () {
    return (this.alpha > 0);
  };
}

// There are no trees. Only branches
// (sounds like the tag-line to our forest's favourite poor quality soap opera)
var Branch = function (x, y, depth, parent, angle, branchCols, leafCols) {
  this.children = [];
  this.parent = parent;
  this.leaf = null;
  this.status = BRANCH_GROWING;
  this.ancestorsGrown = false; // technically not necessary, saves CPU
  this.treeFullyGrown = false; // technically not necessary, saves CPU
  this.branchDepth = depth; // technically not necessary, saves CPU
  this.x1 = x; this.y1 = y;
  this.x2 = x; this.y2 = y;
  this.angle = angle;
  this.len = 0;
  this.willFork = false;
  this.forked = false;
  this.forkThreshold = 0;
  this.leafWait = 0;
  this.branchColours = branchCols;
  this.leafColours = leafCols;

  // each branch is shorter than its parent
  this.maxLen = random(MIN_BRANCH_LEN, MAX_BRANCH_LEN);
  this.maxLen *= pow(CHILD_BRANCH_MODIFIER, depth);

  // check if we are going to fork
  if ((this.branchDepth < MIN_BRANCH_DEPTH) ||
    ((this.branchDepth < MAX_BRANCH_DEPTH) && (random(1) < FORK_CHANCE))) {
    this.willFork = true;
    // randomise when we fork
    this.forkThreshold = random(MIN_FORK_THRESHOLD, MAX_FORK_THRESHOLD);
  }
};

Branch.prototype.Run = function () {
  this.Update();
  this.Display();

  //run child branches (if any)
  for (var i = 0; i < this.children.length; i++) {
    this.children[i].Run();
  }
};

Branch.prototype.Update = function () {
  // if we or the parent are still growing, recalc branch coords
  if (this.status == BRANCH_GROWING) {
    // growth decelerates linearly, to a given minimum
    var growth = TREE_MAX_GROW_SPEED * (1 - (this.len / this.maxLen));
    growth = growth > TREE_MIN_GROW_SPEED ? growth : TREE_MIN_GROW_SPEED;
    this.len += growth;

    // Check if it's time to put out new shoots
    if ((this.willFork) && (!this.forked) && ((this.len / this.maxLen) >= this.forkThreshold)) {
      this.Fork();
      this.forked = true;
    }
    // finished growing?
    if (this.len >= this.maxLen) {
      this.status = BRANCH_MATURE;
    }
    this.recalcCoords();
    stroke(this.branchColours.curCol);
  }
  else if (!this.ancestorsGrown) {
    // one or more ancestors still growing, update branch coords
    this.recalcCoords();
    this.ancestorsGrown = this.AllAncestorsGrown();
    stroke(this.branchColours.curCol);
  }
  else if (!this.treeFullyGrown) {
    // wait for entire tree fully grown before colour cycle animation
    this.CheckAddLeaf();
    this.treeFullyGrown = this.EntireTreeGrown();
    stroke(this.branchColours.curCol);

  }
  else { // tree fully grown, animate branch colours
    this.CheckAddLeaf();
    stroke(this.branchColours.Fade());
  }
};

Branch.prototype.Display = function () {
  line(this.x1, this.y1, this.x2, this.y2);
};

// branch forks into new, smaller branches
Branch.prototype.Fork = function () {
  var numChildren = round(random(MIN_BRANCHES, MAX_BRANCHES));
  for (var i = 0; i < numChildren; i++) {
    var twigAngle = this.CalcAngle(this.angle, i, numChildren);
    var p = new Palette(this.branchColours.colours);
    this.children[i] = new Branch(round(this.x2), round(this.y2), this.branchDepth + 1, this, twigAngle, p, this.leafColours);
  }
};

// calculate the angle that the new branch will grow at
Branch.prototype.CalcAngle = function (parentAngle, twigCount, totalTwigs) {
  // it's ok to go > 0 here because of the mysteries of trigonometry
  var firstTwigAngle = parentAngle - (TOTAL_FORK_ANGLE / 2);
  // we'll have a twig at the start *and* end of the given arc, hence the -1 here
  var twigIntervalAngle = TOTAL_FORK_ANGLE / (totalTwigs - 1);
  var twigAngle = firstTwigAngle + (twigIntervalAngle * twigCount);
  return twigAngle;
};

// if this is a leaf branch that doesnt have a, er, leaf, maybe grow one
Branch.prototype.CheckAddLeaf = function () {
  // don't grow leaves outside the window
  if ((this.x2 > -1) && (this.x2 < width)) {
    if ((this.children.length == 0) && (this.leafWait == 0) && (this.leaf == null)) {
      if (random(1) < LEAF_GROW_CHANCE) {
        // mix it up! Leaves have a small chance to get a random colour palette
        var p;
        if (random(1) < LEAF_RANDOM_PALETTE_CHANCE) {
          p = new Palette(GetLeafColours());
        }
        else {
          p = new Palette(this.leafColours);
        }
        this.leaf = new Leaf(this, this.x2, this.y2, p);
        leavesAlive.push(this.leaf);
        madeLeaf = true;
      }
      else {
        this.leafWait = round(random(LEAF_MIN_MATURE_TIME, LEAF_MAX_MATURE_TIME));
      }
    }
    else if (this.leafWait > 0) { this.leafWait--; }
  }
};

Branch.prototype.recalcCoords = function () {
  // calculate branch end point: time to break out our sohcahtoa
  var theta = radians(this.angle);
  this.x2 = this.x1 + (cos(theta) * this.len);
  this.y2 = this.y1 - (sin(theta) * this.len);

  // children needs to know that parent has moved
  for (var i = 0; i < this.children.length; i++) {
    this.children[i].SetX1Y1(this.x2, this.y2);
  }
};

Branch.prototype.SetX1Y1 = function (x, y) {
  this.x1 = x;
  this.y1 = y;
};

// I get the feeling that these next three functions are probably duplicating
// work in some way or another. Seemed the easiest way to go about it though...
Branch.prototype.AllAncestorsGrown = function () {
  if (this.parent.status == BRANCH_GROWING) {
    return false;
  }
  else {
    return this.parent.AllAncestorsGrown();
  }
};

Branch.prototype.EntireTreeGrown = function () {
  return this.parent.EntireTreeGrown();
};

Branch.prototype.AllChildrenGrown = function () {
  var allGrown = this.status == BRANCH_MATURE ? true : false;
  if (allGrown) {
    for (var i = 0; i < this.children.length; i++) {
      allGrown = this.children[i].AllChildrenGrown();
      if (!allGrown) { break; }
    }
  }
  return allGrown;
};

// the trunk is a branch that has no ancestors and a branch depth of 0
function Trunk(x, y) {
  Branch.call(this, x, y, 0, null, UP_DIRECTION_DEGREES, new Palette(GetTreeColours()), GetLeafColours());
  this.ancestorsGrown = true;
};

// inheritance in javascript is weird
Trunk.prototype = Object.create(Branch.prototype);
Trunk.prototype.constructor = Trunk;

Trunk.prototype.AllAncestorsGrown = function () {
  return true;
}

Trunk.prototype.EntireTreeGrown = function () {
  return this.AllChildrenGrown();
}

// I am a leaf on the wind; watch how I soar!
function Leaf(b, x, y, p) {
  this.parent = b;
  this.xPos = x;
  this.yPos = y;
  this.colours = p;
  this.xOffset = 0;
  this.yOffset = 0;
  this.status = LEAF_HIDING;
  this.radius = 0;
  this.alpha = MAX_ALPHA;

  // SO MANY RANDOM VARIABLES
  this.hideTime = round(random(LEAF_MIN_HIDE_TIME, LEAF_MAX_HIDE_TIME));
  this.matureTime = round(random(LEAF_MIN_MATURE_TIME, LEAF_MAX_MATURE_TIME));
  this.maxRadius = random(LEAF_MIN_RADIUS, LEAF_MAX_RADIUS);
  this.fallRate = random(LEAF_MIN_FALL_RATE, LEAF_MAX_FALL_RATE);
  this.period = random(FLOAT_MIN_PERIOD, FLOAT_MAX_PERIOD) * (1 + (this.maxRadius * LEAF_FLOAT_PERIOD_MOD));
  this.hAmplitude = random(HFLOAT_MIN_AMPLITUDE, HFLOAT_MAX_AMPLITUDE) * (1 + (this.period * LEAF_FLOAT_AMP_MOD));
  this.vAmplitude = random(VFLOAT_MIN_AMPLITUDE, VFLOAT_MAX_AMPLITUDE) * (1 + (this.period * LEAF_FLOAT_AMP_MOD));
  this.yLanding = random(LEAF_MIN_LAND_Y, LEAF_MAX_LAND_Y);

  this.Run = function () {
    this.Update();
    this.Display();
  };

  this.Update = function () {
    switch (this.status) {
      case LEAF_HIDING:
        this.hideTime--;
        if (this.hideTime <= 0) {
          this.status = LEAF_GROWING;
        }
        break;

      // growth speed decelerates linearly, to a given minimum
      case LEAF_GROWING:
        var growth = LEAF_MAX_GROW_SPEED * (1 - (this.radius / this.maxRadius));
        growth = growth > LEAF_MIN_GROW_SPEED ? growth : LEAF_MIN_GROW_SPEED;
        this.radius += growth;

        // finished growing?
        if (this.radius >= this.maxRadius) {
          this.status = LEAF_MATURE;
        }
        noStroke();
        fill(this.colours.curCol);
        break;

      // leaf soaks up the sun for a while
      case LEAF_MATURE:
        this.matureTime--;
        if (this.matureTime <= 0) {
          this.status = LEAF_FALLING;
          this.parent.leaf = null;
        }
        noStroke();
        fill(this.colours.Fade());
        break;

      // help, I've fallen and I can't get up!
      case LEAF_FALLING:
        if (((this.yPos - this.yOffset) - this.parent.y2 < LEAF_MIN_FALL_DISTANCE) ||
          ((this.yPos - this.yOffset) - groundY[round(constrain((this.xPos + this.xOffset), 0, width - 1))] < this.yLanding)) {
          // sine wave governs leaf path, cosine modifies rate of descent
          this.yPos += this.fallRate;
          var x = this.yPos - this.parent.y2;
          this.xOffset = sin(x / this.period) * this.hAmplitude;
          // does PI count as a magic number here? Need to phase-shift cosine wave
          this.yOffset = (cos(((2 * x) / this.period) + PI) * this.vAmplitude) + this.vAmplitude;
        }
        else {
          this.status = LEAF_DYING;
        }
        noStroke();
        fill(this.colours.Fade());
        break;

      // till thou return unto the ground; for out of it wast thou taken:
      // for dust thou art, and unto dust shalt thou return
      case LEAF_DYING:
        var theAlpha = this.alpha;
        this.alpha -= DECAY;
        this.alpha = this.alpha > 0 ? this.alpha : 0;
        // hack alpha into current colour (can't use bit-shifting in p5js?)
        var r = red(this.colours.curCol);
        var g = green(this.colours.curCol);
        var b = blue(this.colours.curCol);
        var a = round(this.alpha);
        noStroke();
        fill(r, g, b, a);
        break;
    }
  };

  this.Display = function () {
    if (this.status != LEAF_HIDING) {
      ellipse(this.xPos + this.xOffset, this.yPos - this.yOffset, this.radius, this.radius);
    }
  };

  this.isAlive = function () {
    return (this.alpha > 0);
  };
}

function Palette(colours) {
  this.colours = colours;
  this.curCol = 0;
  this.deltaR = 0; this.deltaG = 0; this.deltaB = 0;
  this.fadeFrame = 0;
  this.fadeTime = 0;

  this.nextCol = this.GetRandom();
  this.GetNextColour();
};

// fading from one colour to the next
Palette.prototype.Fade = function () {
  var r = constrain(red(this.curCol) + this.deltaR, 0, MAX_R);
  var g = constrain(green(this.curCol) + this.deltaG, 0, MAX_G);
  var b = constrain(blue(this.curCol) + this.deltaB, 0, MAX_B);
  var a = MAX_ALPHA;

  // time to pick the next colour to fade to?
  if (this.fadeFrame == this.fadeTime) {
    this.GetNextColour();
    this.fadeFrame = 0;
  }
  else {
    this.fadeFrame++;
  }
  this.curCol = color(r, g, b, a);
  return this.curCol;
}

// pick the next colour to cycle to. Calculate deltas for RGB
Palette.prototype.GetNextColour = function () {
  this.curCol = this.nextCol;
  while (this.nextCol === this.curCol) {
    this.nextCol = this.GetRandom();
  }

  // how long will this take?
  this.fadeTime = round(random(MIN_FADE_TIME, MAX_FADE_TIME));

  var curR = red(this.curCol);
  var curG = green(this.curCol);
  var curB = blue(this.curCol);
  var targetR = red(this.nextCol);
  var targetG = green(this.nextCol);
  var targetB = blue(this.nextCol);
  this.deltaR = (targetR - curR) / this.fadeTime;
  this.deltaG = (targetG - curG) / this.fadeTime;
  this.deltaB = (targetB - curB) / this.fadeTime;
}

Palette.prototype.GetRandom = function () {
  return this.colours[round(random(0 - RANDOM_FIX, this.colours.length - 1 + RANDOM_FIX))];
}

// generate points for a spline to represent the ground
function CalcLandSpline() {
  const getRandomXInc = () => round(random(GROUND_X_MIN_INTERVAL, GROUND_X_MAX_INTERVAL));
  const getRandomY = () => round(random(height * GROUND_MIN_Y_PERC, height * GROUND_MAX_Y_PERC));

  let nextX = 0;
  groundPoints.push({ 'x': nextX, 'y': getRandomY() });

  while (nextX < width) {
    nextX = min(nextX + getRandomXInc(), width);
    groundPoints.push({ 'x': nextX, 'y': getRandomY() });
  }
}

// draw the ground spline
function drawLandSpine() {
  noFill();
  stroke(MAX_R, MAX_G, MAX_B, MAX_ALPHA);
  strokeWeight(1);
  for (let i = 0; i < groundPoints.length - 1; i++) {
    const p = [
      groundPoints[max(i - 1, 0)],
      groundPoints[i],
      groundPoints[min(i + 1, groundPoints.length - 1)],
      groundPoints[min(i + 2, groundPoints.length - 1)]
    ]
    curve(p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
  }
}

// find ground Y coordinates for each X coordinate. Requires ground to be drawn first!
function findGroundYPoints() {
  // there is absolutely a proper way to calculate the intersection of a spline and a line,
  // but I can't be bothered. Just look for the first non-black pixel from the top down.
  const d = pixelDensity();
  console.log(d);
  loadPixels();
  for (let x = 0; x < width; x++) {
    let y = 0;
    // x * d makes sense, but y * d * width * d is not immediately obvious
    // the first * d accounts for pixel density horizontally, the second * d accounts for pixel density vertically
    while (pixels[(x * d + y * d * width * d) * 4] == 0 && y < height) {
      y++;
    }
    groundY[x] = y;
  }
}

// calculate land: sine wave +/- random "slopes"
function CalcLand() {
  // coords start at 0,0 so max X is actually width - 1
  var sketchWidth = width - 1;
  // lowest possible point of land
  var lowPoint = MIN_Y_OFFSET - (GROUND_AMPLITUDE * 2) - (MAX_SLOPE_LEN * MAX_GRADIENT);
  var curX = 0;
  var yOffset = round(random(MIN_Y_OFFSET, MAX_Y_OFFSET));

  // keep generating slopes and applying them to the base sine wave for the entire width
  while (curX < sketchWidth) {
    // length and gradient of next slope
    var slopeLen = CalcSlopeLen(sketchWidth - curX);
    var slopeDirection = CalcSlopeDir(yOffset);
    var slopeGrad = round(random(MIN_GRADIENT, MAX_GRADIENT));
    slopeGrad *= slopeDirection;

    // calculate y values (sinewave + current slope)
    for (var x = curX; x <= curX + slopeLen; x++) {
      var yBase = (GROUND_AMPLITUDE * sin(x / GROUND_PERIOD)) + (height + lowPoint);
      yOffset += slopeGrad;
      groundY[x] = round(yBase + yOffset);
    }
    curX += slopeLen;
  }
}

// randomly calculate the length of the next ground slope
// don't return a value longer than the remaining width of the screen!  
function CalcSlopeLen(remainingWidth) {
  if (remainingWidth < MIN_SLOPE_LEN) { // only a bit of space left, don't bother randomising
    return remainingWidth;
  }
  else if (remainingWidth < MAX_SLOPE_LEN) { // almost out of space! Still can random though
    return round(random(MIN_SLOPE_LEN, remainingWidth));
  }
  else { // enough space for normal random length
    return round(random(MIN_SLOPE_LEN, MAX_SLOPE_LEN));
  }
}

// randomly calculate if a slope is going upwards or downwards
// if we're above/below our stated max/min then slope back towards 0
function CalcSlopeDir(yOffset) {
  if (yOffset < MIN_Y_OFFSET) {
    return 1;
  }
  else if (yOffset > MAX_Y_OFFSET) {
    return -1;
  }
  else {
    return round(random(1)) == 1 ? 1 : -1;
  }
}

function GetTreeColours() {
  var i = round(random(0 - RANDOM_FIX, treeColours.length - 1 + RANDOM_FIX));
  return treeColours[i];
}

function GetLeafColours() {
  var i = round(random(0 - RANDOM_FIX, leafColours.length - 1 + RANDOM_FIX));
  return leafColours[i];
}
