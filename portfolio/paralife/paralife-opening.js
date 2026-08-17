'use strict';

(function () {
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };
  const between = (progress, start, end) => smooth((progress - start) / (end - start));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixRect = (from, to, t) => ({
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
  });

  // Build an SVG path from a list of points plus a sampler `at(f)` that walks it
  // by arc length, so a packet can ride the exact route the link draws.
  function polyline(pts) {
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
      const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segs.push(len);
      total += len;
    }
    total = total || 1;
    const at = (f) => {
      let dist = clamp01(f) * total;
      for (let i = 0; i < segs.length; i++) {
        if (dist <= segs[i] || i === segs.length - 1) {
          const u = segs[i] ? dist / segs[i] : 0;
          return { x: lerp(pts[i].x, pts[i + 1].x, u), y: lerp(pts[i].y, pts[i + 1].y, u) };
        }
        dist -= segs[i];
      }
      return pts[pts.length - 1];
    };
    return { d, at };
  }

  // Octilinear (CPU-trace) route from the edge of the server box to a client:
  // one 45° diagonal leg then a straight horizontal/vertical leg, the way traces
  // run on a circuit board. Starts where the route leaves the box perimeter, so
  // links terminate at the server's boundary rather than its centre.
  function serverTrace(cx, cy, hw, hh, tx, ty) {
    const dx = tx - cx, dy = ty - cy;
    const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const diag = Math.min(adx, ady);
    const elbow = { x: cx + sx * diag, y: cy + sy * diag };
    const edge = Math.min(hw, hh);
    if (diag >= edge) {
      // The diagonal leg leaves the box: start where it crosses the perimeter.
      const start = { x: cx + sx * edge, y: cy + sy * edge };
      return polyline([start, elbow, { x: tx, y: ty }]);
    }
    // The elbow sits inside the box; the straight leg is what leaves it.
    const start = adx > ady ? { x: cx + sx * hw, y: elbow.y } : { x: elbow.x, y: cy + sy * hh };
    return polyline([start, { x: tx, y: ty }]);
  }

  function clientPhase(progress, reducedMotion) {
    if (reducedMotion) return 'static';
    const local = clamp01((progress - 0.62) / 0.38);
    if (local < 0.18) return 'healthy';
    if (local < 0.36) return 'lagging';
    if (local < 0.55) return 'stalled';
    if (local < 0.76) return 'reconnecting';
    return 'recovered';
  }

  // One protagonist connection's durability story, on a free-running loop (like
  // the world tick) rather than scroll: its outbound queue overflows → STALLED,
  // the entity is held on the grid through a 10-tick grace window, the client
  // reconnects with a single-use resume token, and rebinds to the same entity.
  const LIFECYCLE_PERIOD = 9.0; // seconds for one full arc
  const GRACE_TICKS = 10;
  function durabilityState(ambientTime) {
    const f = (ambientTime / LIFECYCLE_PERIOD) % 1;
    if (f < 0.34) return { phase: 'healthy' };
    if (f < 0.66) {
      const g = (f - 0.34) / 0.32; // 0 → 1 across the grace window
      return { phase: 'stalled', grace: Math.max(0, Math.ceil((1 - g) * GRACE_TICKS)) };
    }
    if (f < 0.84) return { phase: 'reconnecting', back: (f - 0.66) / 0.18 };
    return { phase: 'recovered' };
  }

  function deriveState(progress, reducedMotion = false) {
    const p = clamp01(progress);
    const beat = p < 0.18 ? 'world'
      : p < 0.40 ? 'perception'
      : p < 0.62 ? 'emergence'
      : 'concurrency';

    return {
      beat,
      lineOpacities: [
        1 - between(p, 0.15, 0.20),
        between(p, 0.15, 0.20) * (1 - between(p, 0.37, 0.42)),
        between(p, 0.37, 0.42) * (1 - between(p, 0.59, 0.65)),
        between(p, 0.59, 0.65),
      ],
      fieldAmount: 1 - between(p, 0.13, 0.22),
      perceptionAmount: between(p, 0.13, 0.22) * (1 - between(p, 0.39, 0.49)),
      legendAmount: between(p, 0.39, 0.49) * (1 - between(p, 0.60, 0.70)),
      networkAmount: between(p, 0.60, 0.70),
      clientPhase: clientPhase(p, reducedMotion),
    };
  }

  function create(root) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('opening-visuals');
    const frame = document.getElementById('morph-frame');
    const observed = document.getElementById('observed-entity');
    const lines = Array.from(root.querySelectorAll('.opening-line'));
    const frameLayer = document.getElementById('frame-layer');
    const perceptionLayer = document.getElementById('perception-layer');
    const legendLayer = document.getElementById('legend-layer');
    const legendSpecies = Array.from(legendLayer.querySelectorAll('.legend-species'));
    const legendCycle = document.getElementById('legend-cycle');
    const networkLayer = document.getElementById('network-layer');
    const clientLayer = document.getElementById('network-clients');
    const linkLayer = document.getElementById('network-links');
    const serverLabel = document.getElementById('server-label');
    const reconnectPath = document.getElementById('reconnect-path');
    const recoveryLabel = document.getElementById('recovery-label');
    const perceptionLabel = document.getElementById('perception-label');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Sibling vision windows (windows[1..]). windows[0] is drawn by the
    // persistent #morph-frame / #observed-entity pair so it can morph on.
    const extraWindows = Array.from({ length: 3 }, (_, index) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.classList.add('vision-frame');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.classList.add('vision-dot');
      dot.setAttribute('r', '4');
      const label = document.createElementNS(SVG_NS, 'text');
      label.classList.add('vision-label');
      label.textContent = `ENTITY ${index + 2} VIEW`;
      perceptionLayer.append(rect, dot, label);
      return { rect, dot, label };
    });

    // The entity's roaming position (and the window that follows it) is computed
    // in paralife.js so the canvas cutout and these SVG frames never disagree;
    // each window arrives carrying its drifted rect and its `entity` dot.
    // A pool of connections; how many are shown scales with the viewport each
    // frame (like the vision windows), so the ring never looks sparse on a wide
    // display. The pool floor keeps client-03 (protagonist) and client-11
    // (reduced-motion recovered example) always present.
    const CLIENT_POOL = 32;
    const clients = Array.from({ length: CLIENT_POOL }, (_, index) => {
      const id = `client-${String(index).padStart(2, '0')}`;
      const group = document.createElementNS(SVG_NS, 'g');
      group.classList.add('network-client');
      group.dataset.clientId = id;
      group.dataset.identityMarker = id;
      group.style.setProperty('--client-color', ['#0cc', '#be8cff', '#ffa046'][index % 3]);
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.classList.add('client-identity-ring');
      ring.setAttribute('r', '8');
      const node = document.createElementNS(SVG_NS, 'circle');
      node.classList.add('client-node');
      node.setAttribute('r', '4');
      group.append(ring, node);
      clientLayer.appendChild(group);

      const link = document.createElementNS(SVG_NS, 'path');
      link.classList.add('network-link');
      link.dataset.clientId = id;
      linkLayer.appendChild(link);
      return { id, index, group, link };
    });

    // Concurrency beat animates on its own loop (like the world tick), not off
    // scroll: each tick the server pulses and a frame packet fans out to every
    // connection. A heartbeat ring behind the server, one packet per client.
    const serverPulse = document.createElementNS(SVG_NS, 'rect');
    serverPulse.classList.add('server-pulse');
    serverPulse.setAttribute('rx', '10');
    networkLayer.insertBefore(serverPulse, linkLayer);
    const packetLayer = document.createElementNS(SVG_NS, 'g');
    packetLayer.setAttribute('id', 'network-packets');
    networkLayer.insertBefore(packetLayer, clientLayer);
    clients.forEach((client) => {
      const packet = document.createElementNS(SVG_NS, 'circle');
      packet.classList.add('wire-packet');
      packet.setAttribute('r', '3');
      packetLayer.appendChild(packet);
      client.packet = packet;
    });

    // Durability arc overlays on the one protagonist connection: a grace-window
    // countdown while it is held, and a resume token that rides back to the
    // server to rebind. client-03 is the protagonist (its reconnect path already
    // routes here); everyone else stays healthy so the eye has one thing to hold.
    const PROTAGONIST = 'client-03';
    const graceLabel = document.createElementNS(SVG_NS, 'text');
    graceLabel.classList.add('grace-label');
    graceLabel.style.opacity = '0';
    const resumeToken = document.createElementNS(SVG_NS, 'circle');
    resumeToken.classList.add('resume-token');
    resumeToken.setAttribute('r', '4');
    resumeToken.style.opacity = '0';
    networkLayer.append(graceLabel, resumeToken);

    // Frame readout: one connection's 5×5 vision window (its per-entity
    // projection) collapsing into the compact text frame the server ships over
    // raw WebSocket. Desktop only, so the mobile diagram stays uncluttered.
    const frameInset = document.createElementNS(SVG_NS, 'g');
    frameInset.setAttribute('id', 'frame-inset');
    frameInset.style.opacity = '0';
    const insetLabel = document.createElementNS(SVG_NS, 'text');
    insetLabel.classList.add('inset-label');
    insetLabel.textContent = "one entity's view";
    const insetCells = Array.from({ length: 25 }, () => {
      const r = document.createElementNS(SVG_NS, 'rect');
      r.classList.add('inset-cell');
      frameInset.appendChild(r);
      return r;
    });
    const insetArrow = document.createElementNS(SVG_NS, 'text');
    insetArrow.classList.add('inset-arrow');
    insetArrow.textContent = 'projected · encoded ↓';
    const insetBytes = document.createElementNS(SVG_NS, 'text');
    insetBytes.classList.add('inset-bytes');
    const insetCaption = document.createElementNS(SVG_NS, 'text');
    insetCaption.classList.add('inset-caption');
    frameInset.append(insetLabel, insetArrow, insetBytes, insetCaption);
    networkLayer.appendChild(frameInset);

    // One stylised tick ~= 1.6 s (slower than the real 2 Hz, for legibility).
    // The pulse is deliberately unlabelled so it makes no false rate claim; the
    // static "SERVER · 2 Hz" label describes the server, not the animation.
    const TICK_PERIOD = 1.6;   // seconds per illustrated tick
    const FANOUT_START = 0.12; // packets leave after the tick's stages "run"
    const FANOUT_SPAN = 0.5;   // fraction of the tick spent in flight
    const FAN_STAGGER = 0.16;  // spread across connections, so it reads as fan-out

    function render({ progress, techFade, viewport, windows, ambientTime }) {
      const state = deriveState(progress, reduced.matches);
      const legendRect = viewport.width <= 800
        ? { x: viewport.width * 0.10, y: viewport.height * 0.32, width: viewport.width * 0.80, height: viewport.height * 0.42 }
        : { x: viewport.width * 0.18, y: viewport.height * 0.24, width: viewport.width * 0.64, height: viewport.height * 0.52 };
      const legendMorph = between(progress, 0.39, 0.49);
      const mobile = viewport.width <= 800;
      const server = mobile
        ? { x: viewport.width * 0.50, y: viewport.height * 0.73, width: 112, height: 64 }
        : { x: viewport.width * 0.70, y: viewport.height * 0.52, width: 128, height: 72 };
      const serverRect = {
        x: server.x - server.width / 2,
        y: server.y - server.height / 2,
        width: server.width,
        height: server.height,
      };
      const networkMorph = between(progress, 0.60, 0.70);
      const legendFrame = mixRect(windows[0].rect, legendRect, legendMorph);
      let currentFrame = mixRect(legendFrame, serverRect, networkMorph);
      if (reduced.matches) {
        currentFrame = state.beat === 'world' || state.beat === 'perception'
          ? windows[0].rect
          : state.beat === 'emergence' ? legendRect : serverRect;
      }
      const radiusX = mobile ? viewport.width * 0.38 : viewport.width * 0.24;
      const radiusY = mobile ? viewport.height * 0.22 : viewport.height * 0.30;

      svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
      frame.setAttribute('x', currentFrame.x.toFixed(2));
      frame.setAttribute('y', currentFrame.y.toFixed(2));
      frame.setAttribute('width', currentFrame.width.toFixed(2));
      frame.setAttribute('height', currentFrame.height.toFixed(2));
      frame.dataset.role = networkMorph > 0.98 ? 'server' : 'frame';
      frame.dataset.state = 'healthy';
      const primaryEntity = windows[0].entity;
      observed.setAttribute('cx', primaryEntity.x.toFixed(2));
      observed.setAttribute('cy', primaryEntity.y.toFixed(2));
      perceptionLabel.setAttribute('x', (windows[0].rect.x + windows[0].rect.width / 2).toFixed(2));
      perceptionLabel.setAttribute('y', (windows[0].rect.y - 10).toFixed(2));
      extraWindows.forEach((extra, index) => {
        const win = windows[index + 1];
        const on = !!win;
        extra.rect.style.display = on ? '' : 'none';
        extra.dot.style.display = on ? '' : 'none';
        extra.label.style.display = on ? '' : 'none';
        if (!on) return;
        extra.rect.setAttribute('x', win.rect.x.toFixed(2));
        extra.rect.setAttribute('y', win.rect.y.toFixed(2));
        extra.rect.setAttribute('width', win.rect.width.toFixed(2));
        extra.rect.setAttribute('height', win.rect.height.toFixed(2));
        extra.dot.setAttribute('cx', win.entity.x.toFixed(2));
        extra.dot.setAttribute('cy', win.entity.y.toFixed(2));
        extra.label.setAttribute('x', (win.rect.x + win.rect.width / 2).toFixed(2));
        extra.label.setAttribute('y', (win.rect.y - 10).toFixed(2));
      });
      const legendCenterX = legendRect.x + legendRect.width / 2;
      const legendStartY = legendRect.y + legendRect.height * 0.30;
      legendSpecies.forEach((label, index) => {
        label.setAttribute('x', legendCenterX.toFixed(2));
        label.setAttribute('y', (legendStartY + index * Math.min(54, legendRect.height * 0.14)).toFixed(2));
      });
      legendCycle.setAttribute('x', legendCenterX.toFixed(2));
      legendCycle.setAttribute('y', (legendRect.y + legendRect.height * 0.82).toFixed(2));

      // Tick clock: a free-running loop off ambientTime, gated to the beat and
      // stilled under reduced motion so the static diagram is undisturbed.
      const beatOn = state.networkAmount > 0.001 && !reduced.matches;
      const tickPhase = beatOn ? (ambientTime / TICK_PERIOD) % 1 : 0;
      const pulseT = smooth(clamp01(tickPhase / 0.45));
      const grow = lerp(0, 26, pulseT);
      serverPulse.setAttribute('x', (serverRect.x - grow).toFixed(2));
      serverPulse.setAttribute('y', (serverRect.y - grow).toFixed(2));
      serverPulse.setAttribute('width', (serverRect.width + grow * 2).toFixed(2));
      serverPulse.setAttribute('height', (serverRect.height + grow * 2).toFixed(2));
      serverPulse.style.opacity = beatOn ? ((1 - pulseT) * 0.5).toFixed(3) : '0';

      // The protagonist connection's phase is loop-driven while the beat plays;
      // reduced motion keeps the static summary; before the beat, all healthy.
      const dur = beatOn ? durabilityState(ambientTime) : null;
      const activePhase = reduced.matches ? state.clientPhase : (dur ? dur.phase : 'healthy');
      let protagonist = null;
      const hw = server.width / 2, hh = server.height / 2;
      const clientCount = Math.max(16, Math.min(30, Math.round(viewport.width / 52)));

      clients.forEach((client) => {
        const on = client.index < clientCount;
        client.group.style.display = on ? '' : 'none';
        client.link.style.display = on ? '' : 'none';
        client.packet.style.display = on ? '' : 'none';
        if (!on) return;
        const angle = -Math.PI / 2 + client.index * (Math.PI * 2 / clientCount);
        const ring = 0.82 + (client.index % 3) * 0.09;
        const x = server.x + Math.cos(angle) * radiusX * ring;
        const y = server.y + Math.sin(angle) * radiusY * ring;
        let clientState;
        if (reduced.matches) {
          clientState = client.id === 'client-03' ? 'stalled'
            : client.id === 'client-11' ? 'recovered'
            : 'healthy';
        } else if (beatOn && client.id === PROTAGONIST) {
          clientState = dur.phase;
        } else {
          clientState = 'healthy';
        }
        const route = serverTrace(server.x, server.y, hw, hh, x, y);
        client.group.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        client.link.setAttribute('d', route.d);
        client.group.dataset.state = clientState;
        client.link.dataset.state = clientState;
        if (client.id === PROTAGONIST) protagonist = { x, y, route };

        // Frame packet: leaves the server once the tick's stages have run, then
        // rides its trace out to the connection. A stalled/reconnecting client
        // receives nothing — its queue overflowed. Staggered so the fan reads.
        const cut = clientState === 'stalled' || clientState === 'reconnecting';
        const stagger = (client.index / clientCount) * FAN_STAGGER;
        const travel = beatOn && !cut ? smooth(clamp01((tickPhase - FANOUT_START - stagger) / FANOUT_SPAN)) : 0;
        const flying = travel > 0.001 && travel < 0.999;
        client.packet.style.opacity = flying ? '1' : '0';
        if (flying) {
          const pt = route.at(travel);
          client.packet.setAttribute('cx', pt.x.toFixed(2));
          client.packet.setAttribute('cy', pt.y.toFixed(2));
        }
      });

      // Reconnect trace + resume token ride the protagonist's own route.
      const pr = protagonist ? protagonist.route : serverTrace(server.x, server.y, hw, hh, server.x, server.y);
      reconnectPath.setAttribute('d', pr.d);
      reconnectPath.style.opacity = activePhase === 'reconnecting' ? '1' : '0';
      if (beatOn && dur.phase === 'reconnecting' && protagonist) {
        const pt = pr.at(1 - clamp01(dur.back)); // token travels client → server
        resumeToken.setAttribute('cx', pt.x.toFixed(2));
        resumeToken.setAttribute('cy', pt.y.toFixed(2));
        resumeToken.style.opacity = '1';
      } else {
        resumeToken.style.opacity = '0';
      }
      if (beatOn && dur.phase === 'stalled' && protagonist) {
        graceLabel.setAttribute('x', protagonist.x.toFixed(2));
        graceLabel.setAttribute('y', (protagonist.y - 16).toFixed(2));
        graceLabel.textContent = `grace ${dur.grace}`;
        graceLabel.style.opacity = '1';
      } else {
        graceLabel.style.opacity = '0';
      }

      // Frame readout: the vision window refreshes each tick, then the compact
      // frame beneath it shows what that projection actually ships on the wire.
      // Desktop parks it lower-left; mobile floats a tighter version in the gap
      // above the ring (the arrow line is dropped to save vertical space).
      frameInset.style.opacity = beatOn ? '1' : '0';
      if (beatOn) {
        const big = !mobile;
        const cell = big ? 30 : 14;
        const gridH = 5 * cell;
        insetLabel.style.fontSize = (big ? 15 : 13) + 'px';
        insetArrow.style.fontSize = (big ? 12 : 10) + 'px';
        insetBytes.style.fontSize = (big ? 19 : 14) + 'px';
        insetCaption.style.fontSize = (big ? 12 : 10) + 'px';
        const ix = big ? viewport.width * 0.05 : viewport.width * 0.08;
        let iy;
        if (mobile) {
          // Centre it in the gap between the copy and the top of the ring, so it
          // clears both on short phones where that gap is tight.
          const gapTop = viewport.height * 0.31;
          const gapBottom = server.y - radiusY * 0.82 - 16;
          const insetH = 12 + gridH + 42; // grid + bytes + caption incl. descenders
          iy = gapTop + Math.max(4, (gapBottom - gapTop - insetH) / 2) + 9;
        } else {
          // Left of the ring, below the copy — the two sit side by side. Clamped
          // so the taller box can't run off the bottom on a short desktop.
          iy = Math.min(viewport.height * 0.60, viewport.height - 270);
        }
        const gridTop = iy + (big ? 20 : 12);
        // Desktop left-aligns the readout; mobile centres it under the copy.
        const gridW = 5 * cell;
        const anchor = big ? 'start' : 'middle';
        const textX = big ? ix : viewport.width / 2;
        const gridX = big ? ix : viewport.width / 2 - gridW / 2;
        [insetLabel, insetArrow, insetBytes, insetCaption].forEach((t) => t.setAttribute('text-anchor', anchor));
        const tick = Math.floor(ambientTime / TICK_PERIOD);
        const species = ['#0cc', '#be8cff', '#ffa046'];
        insetLabel.setAttribute('x', textX.toFixed(2));
        insetLabel.setAttribute('y', iy.toFixed(2));
        insetCells.forEach((r, k) => {
          const gx = k % 5, gy = (k / 5) | 0;
          r.setAttribute('x', (gridX + gx * cell).toFixed(2));
          r.setAttribute('y', (gridTop + gy * cell).toFixed(2));
          r.setAttribute('width', String(cell - 2));
          r.setAttribute('height', String(cell - 2));
          const center = gx === 2 && gy === 2;
          const lit = (gx * 7 + gy * 13 + tick * 5) % 4 === 0;
          r.setAttribute('fill', center ? '#fff' : lit ? species[(gx + gy + tick) % 3] : 'rgba(0,204,204,0.05)');
        });
        const gridBottom = gridTop + gridH;
        const frame = `T|${String(tick % 1000).padStart(3, '0')}|0A1B|15/80|2|s7C1F`;
        insetArrow.style.display = big ? '' : 'none';
        insetArrow.setAttribute('x', textX.toFixed(2));
        insetArrow.setAttribute('y', (gridBottom + 24).toFixed(2));
        insetBytes.setAttribute('x', textX.toFixed(2));
        insetBytes.setAttribute('y', (gridBottom + (big ? 48 : 15)).toFixed(2));
        insetBytes.textContent = frame;
        insetCaption.setAttribute('x', textX.toFixed(2));
        insetCaption.setAttribute('y', (gridBottom + (big ? 70 : 30)).toFixed(2));
        insetCaption.textContent = `${frame.length} bytes · raw WebSocket`;
      }
      serverLabel.setAttribute('x', server.x.toFixed(2));
      serverLabel.setAttribute('y', (server.y + 4).toFixed(2));
      recoveryLabel.setAttribute('x', server.x.toFixed(2));
      recoveryLabel.setAttribute('y', (server.y + server.height / 2 + 26).toFixed(2));
      recoveryLabel.textContent = {
        stalled: 'connection stalled',
        reconnecting: 'reconnecting',
        recovered: 'same entity restored',
        static: 'stalled · reconnect available · same entity restored',
      }[activePhase] || '';
      recoveryLabel.style.opacity = ['stalled', 'reconnecting', 'recovered', 'static'].includes(activePhase) ? '1' : '0';

      root.dataset.activeBeat = state.beat;
      root.dataset.visionWindows = String(windows.length);
      root.dataset.clientPhase = activePhase;
      root.dataset.layout = mobile ? 'mobile' : 'desktop';
      root.dataset.reducedMotion = reduced.matches ? 'true' : 'false';
      root.style.opacity = techFade;
      lines.forEach((line, index) => {
        line.style.opacity = reduced.matches
          ? String(index === ['world', 'perception', 'emergence', 'concurrency'].indexOf(state.beat) ? 1 : 0)
          : state.lineOpacities[index].toFixed(3);
      });
      const fieldCompression = between(progress, 0.13, 0.20);
      lines[0].style.transform = reduced.matches
        ? 'translateY(-50%)'
        : `translateY(-50%) scale(${lerp(1, 0.65, fieldCompression).toFixed(3)})`;
      lines[1].style.transform = reduced.matches
        ? 'translate(-50%, -50%)'
        : `translate(-50%, -50%) scale(${lerp(0.82, 1, state.perceptionAmount).toFixed(3)})`;
      const frameAmount = Math.max(state.perceptionAmount, state.legendAmount, state.networkAmount);
      frameLayer.style.opacity = (frameAmount * techFade).toFixed(3);
      perceptionLayer.style.opacity = (state.perceptionAmount * techFade).toFixed(3);
      legendLayer.style.opacity = (state.legendAmount * techFade).toFixed(3);
      networkLayer.style.opacity = (state.networkAmount * techFade).toFixed(3);
      svg.style.opacity = String(techFade);
      svg.dataset.ambientPhase = reduced.matches ? '0' : String((ambientTime % 1).toFixed(3));
    }

    return { render };
  }

  window.ParalifeOpening = { deriveState, create };
}());
