// global settings - mess with these to alter sketch behaviour
var INIT_PX_PER_STAR = 12500; // initial number of stars - one per this many pixels
var MIN_TOPSPEED = 0.8; // minimum top speed for stars
var MAX_TOPSPEED = 3; // maximum top speed for stars
var MIN_RAD = 4; // minimum star radius
var MAX_RAD = 12; // maximum star radius
var LINK_MOD = 9; // modifier governing if stars are linked. Higher = longer links
var LERP_MOD = 16; // modifier governing number of lerp steps for links. Higher = fewer steps
//                    -- Careful! lower numbers for LERP_MOD will greatly impact performance
var ACCEL_MOD = 10; // modifier governing star acceleration
var FADE_DIST = 0.15; // links fade in over the first x% of distance/closeness
var PULSE_RATE = 20; // number of frames for a link to pulse

// some arrays to store info for stars
var starCount = 0; // counter for stars
var pulseLinks = false; // flag for whether links are solid or pulsed
var pulseSync = true; // flag for whether pulsed links are synchronised or not
var starPos = new Array(starCount); // position vectors
var starMaxV = new Array(starCount); // maximum velocities
var starVel = new Array(starCount); // velocity vectors
var starSize = new Array(starCount); // radii
var starR = new Array(starCount); // reds
var starG = new Array(starCount); // greens
var starB = new Array(starCount); // blues

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('drawHere');
  frameRate(30);
  colorMode(RGB, 255, 255, 255, 100);
  ellipseMode(RADIUS);

  // create initial stars
  const initStarCount = Math.ceil(windowWidth * windowHeight / INIT_PX_PER_STAR);
  for (var i = 0; i < initStarCount; i++) {
    addStar();
  }
}

function draw() {
  background(0);

  // if mouse button is pressed, attract stars to cursor
  if (mouseIsPressed) {
    for (var i = 0; i < starCount; i++) {
      var toCursor = p5.Vector.sub(createVector(mouseX, mouseY), starPos[i]);
      toCursor.normalize();
      toCursor.div(ACCEL_MOD); // limit acceleration according to modifier
      starVel[i].x = constrain(starVel[i].x + toCursor.x, -starMaxV[i], starMaxV[i]);
      starVel[i].y = constrain(starVel[i].y + toCursor.y, -starMaxV[i], starMaxV[i]);
    }
  }

  // apply star velocity
  for (var i = 0; i < starCount; i++) {
    // check pos + vel before applying to ensure we don't go OOB
    var newX = starPos[i].x + starVel[i].x;
    var newY = starPos[i].y + starVel[i].y;

    if (newX < 0 || newX > windowWidth) {
      starVel[i].x *= -1;
      newX = starPos[i].x + starVel[i].x;
    }
    if (newY < 0 || newY > windowHeight) {
      starVel[i].y *= -1;
      newY = starPos[i].y + starVel[i].y;
    }
    starPos[i].x = newX;
    starPos[i].y = newY;
  }

  // draw stars
  noStroke();
  for (var i = 0; i < starCount; i++) {
    fill(starR[i], starG[i], starB[i], 100);
    ellipse(starPos[i].x, starPos[i].y, starSize[i], starSize[i]);
  }

  // draw lines
  stroke(255, 255, 255, 100);
  strokeWeight(1);
  for (var i = 0; i < starCount; i++) {
    for (var j = i + 1; j < starCount; j++) {
      // first get magnitude of distance between stars
      var dist = p5.Vector.sub(starPos[j], starPos[i]);
      var distMag = abs(dist.mag());
      // then draw line if distance is less than combined radii * modifier
      var distThreshold = (starSize[i] + starSize[j]) * LINK_MOD;
      if (distMag > distThreshold) {
        continue;
      }

      // fade links in once stars cross minimum distance threshold
      var linkA = distMag / distThreshold;
      if (linkA < 1 - FADE_DIST) {
        linkA = 100;
      } else {
        linkA = map(linkA, 1, 1 - FADE_DIST, 0, 100);
      }

      // lerp steps for line colours = max difference between R, G & B ÷ modifier
      var diffR = starR[j] - starR[i];
      var diffG = starG[j] - starG[i];
      var diffB = starB[j] - starB[i];
      var lSteps = max(abs(round(diffR)), abs(round(diffG)), abs(round(diffB)));
      lSteps = round(lSteps / LERP_MOD);

      // lerp line colours (such loops. Many CPU cycles. Wow.)
      var rStep = diffR / lSteps;
      var gStep = diffG / lSteps;
      var bStep = diffB / lSteps;
      var xStep = (starPos[j].x - starPos[i].x) / lSteps;
      var yStep = (starPos[j].y - starPos[i].y) / lSteps;
      for (var k = 0; k < lSteps; k++) {
        // if links are set to pulsed, check whether we actually have to draw anything
        var pulseA = 1;
        if (pulseLinks) {
          var pulseOff = 0;
          if (!pulseSync) {
            // Should be random enough, probably
            pulseOff = (starSize[i] * starSize[j] * i * j) % TWO_PI;
          }
          pulseA = cos(frameCount * TWO_PI / PULSE_RATE + k / lSteps * TWO_PI + pulseOff);
        }
        if (pulseA <= 0) { continue; } // nothing to draw
        // find the colour at the midpoint of i+k and i+(k+1)
        stroke(starR[i] + rStep * (k + 0.5), starG[i] + gStep * (k + 0.5), starB[i] + bStep * (k + 0.5), linkA * pulseA);
        line(starPos[i].x + xStep * k, starPos[i].y + yStep * k, starPos[i].x + xStep * (k + 1), starPos[i].y + yStep * (k + 1));
      }
    }
  }

  // add/remove stars if up/down arrows are currently pressed. Always have at least one star
  if (keyIsDown(UP_ARROW)) {
    addStar();
  } else if (keyIsDown(DOWN_ARROW) && starCount > 1) {
    removeStar();
  }
}

// create a new star. Randomise as much of it as possible
function addStar() {
  starPos.push(createVector(random(0, windowWidth), random(0, windowHeight)));
  var maxV = random(MIN_TOPSPEED, MAX_TOPSPEED);
  starMaxV.push(maxV);
  // yes, yes, I should be applying max velocity to the magnitude, but meh - this is easier.
  starVel.push(createVector(random(-maxV, maxV), random(-maxV, maxV)));
  starSize.push(random(MIN_RAD, MAX_RAD));
  starR.push(round(random(0, 255)));
  starG.push(round(random(0, 255)));
  starB.push(round(random(0, 255)));
  starCount++;
}

// remove a star
function removeStar() {
  starCount--;
  starPos.pop();
  starVel.pop();
  starSize.pop();
  starR.pop();
  starG.pop();
  starB.pop();
}

// resize canvas and reset star count when window is resized
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  targetCount = Math.ceil(windowWidth * windowHeight / INIT_PX_PER_STAR);
  while (starCount < targetCount)
    addStar();

  while (starCount > targetCount)
    removeStar();
}

// switch between solid and pulsed links when spacebar is pressed
function keyPressed() {
  if (key === ' ') {
    pulseLinks = !pulseLinks;
  } else if (key === 'p') {
    pulseSync = !pulseSync;
  }
}
