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

  // Scroll-progress ranges shared by deriveState() and render(), so the diagram
  // assembly and the opacities driving it never drift. The intro is compressed
  // into [0, ~0.52] to free the tail for the durability arc (see DUR below).
  // LEGEND: vision windows → species legend. NETWORK: legend → server + ring.
  const LEGEND_MORPH = [0.30, 0.40];
  const NETWORK_MORPH = [0.44, 0.52];
  const range = (p, r) => between(p, r[0], r[1]);

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
    return durabilityFromScroll(progress).phase;
  }

  // One protagonist connection's durability story, scrubbed by scroll (not a free
  // clock) across the tail of the concurrency beat: its outbound queue overflows →
  // STALLED, the entity is held through a 10-tick grace window that counts down as
  // you scroll, the client reconnects with a single-use resume token, and rebinds
  // to the same entity. Scroll-driven so even a fast scroller sees every phase.
  const GRACE_TICKS = 10;
  const DUR = { stall: 0.58, reconnect: 0.72, recovered: 0.88 };
  function durabilityFromScroll(progress) {
    const p = clamp01(progress);
    if (p < DUR.stall) return { phase: 'healthy' };
    if (p < DUR.reconnect) {
      const g = (p - DUR.stall) / (DUR.reconnect - DUR.stall); // 0 → 1 across grace
      return { phase: 'stalled', grace: Math.max(0, Math.ceil((1 - g) * GRACE_TICKS)) };
    }
    if (p < DUR.recovered) {
      return { phase: 'reconnecting', back: (p - DUR.reconnect) / (DUR.recovered - DUR.reconnect) };
    }
    return { phase: 'recovered' };
  }

  function deriveState(progress, reducedMotion = false) {
    const p = clamp01(progress);
    const beat = p < 0.15 ? 'world'
      : p < 0.32 ? 'perception'
      : p < 0.48 ? 'emergence'
      : 'concurrency';

    return {
      beat,
      lineOpacities: [
        1 - between(p, 0.12, 0.17),
        between(p, 0.12, 0.17) * (1 - between(p, 0.28, 0.34)),
        between(p, 0.28, 0.34) * (1 - between(p, 0.44, 0.50)),
        between(p, 0.44, 0.50),
      ],
      fieldAmount: 1 - between(p, 0.10, 0.16),
      perceptionAmount: between(p, 0.10, 0.16) * (1 - range(p, LEGEND_MORPH)),
      legendAmount: range(p, LEGEND_MORPH) * (1 - range(p, NETWORK_MORPH)),
      networkAmount: range(p, NETWORK_MORPH),
      clientPhase: clientPhase(p, reducedMotion),
    };
  }

  function create(root) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const glyphApi = window.ParalifeGlyphWorld;
    const clientGlyphs = [
      glyphApi.glyphFor('catalyst'),
      glyphApi.glyphFor('membrane'),
      glyphApi.glyphFor('spore'),
    ];
    const perceptionGlyphs = [
      ...clientGlyphs,
      glyphApi.glyphFor('bondedPair'),
      glyphApi.glyphFor('composite', { role: 'attacker', species: 'catalyst' }),
    ];
    const svg = document.getElementById('opening-visuals');
    const frame = document.getElementById('morph-frame');
    const observed = document.getElementById('observed-entity');
    const lines = Array.from(root.querySelectorAll('.opening-line'));
    const frameLayer = document.getElementById('frame-layer');
    const perceptionLayer = document.getElementById('perception-layer');
    const legendLayer = document.getElementById('legend-layer');
    const legendSurface = document.getElementById('legend-surface');
    const legendSpecies = Array.from(legendLayer.querySelectorAll('.legend-species'));
    const legendDetails = Array.from(legendLayer.querySelectorAll('.legend-detail'));
    const legendCycle = document.getElementById('legend-cycle');
    const networkLayer = document.getElementById('network-layer');
    const networkSurface = document.getElementById('network-surface');
    const clientLayer = document.getElementById('network-clients');
    const linkLayer = document.getElementById('network-links');
    const serverLabel = document.getElementById('server-label');
    const durabilityTitle = document.getElementById('durability-title');
    const reconnectPath = document.getElementById('reconnect-path');
    const recoveryLabel = document.getElementById('recovery-label');
    const perceptionLabel = document.getElementById('perception-label');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Sibling vision windows (windows[1..]). windows[0] is drawn by the
    // persistent #morph-frame / #observed-entity pair so it can morph on.
    const extraWindows = Array.from({ length: 4 }, (_, index) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.classList.add('vision-frame');
      const dot = document.createElementNS(SVG_NS, 'text');
      dot.classList.add('vision-glyph');
      const descriptor = perceptionGlyphs[index + 1];
      dot.textContent = descriptor.glyph;
      dot.style.fill = descriptor.color;
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
      const identity = clientGlyphs[index % clientGlyphs.length];
      group.style.setProperty('--client-color', identity.color);
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.classList.add('client-identity-ring');
      ring.setAttribute('r', '8');
      const node = document.createElementNS(SVG_NS, 'text');
      node.classList.add('client-node');
      node.textContent = identity.glyph;
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
    const protagonistClient = clients.find((c) => c.id === PROTAGONIST);
    if (protagonistClient) protagonistClient.group.dataset.protagonist = 'true';
    const graceLabel = document.createElementNS(SVG_NS, 'text');
    graceLabel.classList.add('grace-label');
    graceLabel.style.opacity = '0';
    const resumeToken = document.createElementNS(SVG_NS, 'circle');
    resumeToken.classList.add('resume-token');
    resumeToken.setAttribute('r', '4');
    resumeToken.style.opacity = '0';
    // Filled pill behind the recovery label so the phase reads at a glance.
    // Inserted before #recovery-label so the text draws on top of the pill.
    const statePill = document.createElementNS(SVG_NS, 'rect');
    statePill.classList.add('state-pill');
    statePill.setAttribute('rx', '12');
    statePill.style.opacity = '0';
    networkLayer.insertBefore(statePill, recoveryLabel);
    networkLayer.append(graceLabel, resumeToken);

    // Frame readout: one connection's 5×5 vision window (its per-entity
    // projection) collapsing into the compact text frame the server ships over
    // raw WebSocket. Desktop only, so the mobile diagram stays uncluttered.
    const frameInset = document.createElementNS(SVG_NS, 'g');
    frameInset.setAttribute('id', 'frame-inset');
    frameInset.style.opacity = '0';
    const insetSurface = document.createElementNS(SVG_NS, 'rect');
    insetSurface.setAttribute('id', 'inset-surface');
    insetSurface.classList.add('content-surface');
    insetSurface.setAttribute('rx', '8');
    frameInset.appendChild(insetSurface);
    const insetCodec = document.createElementNS(SVG_NS, 'text');
    insetCodec.classList.add('inset-codec');
    insetCodec.textContent = 'PARA64 · high-efficiency codec';
    const insetLabel = document.createElementNS(SVG_NS, 'text');
    insetLabel.classList.add('inset-label');
    insetLabel.textContent = "one entity's view";
    const insetCells = Array.from({ length: 25 }, () => {
      const r = document.createElementNS(SVG_NS, 'rect');
      r.classList.add('inset-cell');
      const glyph = document.createElementNS(SVG_NS, 'text');
      glyph.classList.add('inset-glyph');
      frameInset.appendChild(r);
      frameInset.appendChild(glyph);
      return { rect: r, glyph };
    });
    const insetArrow = document.createElementNS(SVG_NS, 'text');
    insetArrow.classList.add('inset-arrow');
    const insetBytes = document.createElementNS(SVG_NS, 'text');
    insetBytes.classList.add('inset-bytes');
    const insetCaption = document.createElementNS(SVG_NS, 'text');
    insetCaption.classList.add('inset-caption');
    frameInset.append(insetCodec, insetLabel, insetArrow, insetBytes, insetCaption);
    networkLayer.appendChild(frameInset);

    // One stylised tick = 1 s. The pulse is deliberately unlabelled so it makes
    // no false rate claim; the static "SERVER · 2 Hz" label describes the
    // server, not this illustrated cadence.
    const TICK_PERIOD = 1.0;   // seconds per illustrated tick
    const FANOUT_START = 0.12; // packets leave after the tick's stages "run"
    const FANOUT_SPAN = 0.5;   // fraction of the tick spent in flight
    // Paralife's real wire alphabet (Base64Codec.java): digit-first, _- as 62/63.
    // fx = fixed-width, vr = variable-width — both big-endian, matching the codec.
    const A64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
    const fx = (v, w) => { let s = ''; for (let i = 0; i < w; i++) { s = A64[v & 63] + s; v >>= 6; } return s; };
    const vr = (v) => { let s = A64[v & 63]; v >>= 6; while (v > 0) { s = A64[v & 63] + s; v >>= 6; } return s; };
    const FAN_STAGGER = 0.16;  // spread across connections, so it reads as fan-out
    const WIRE_KINDS = ['C', 'M', 'S', 'D', 'N', 'T', '0', '1', '2', '3', '4', '5', 'R', 'F'];
    const ROLE_BY_KIND = ['locomotor', 'feeder', 'attacker', 'defender', 'reproducer', 'sensor'];

    function insetDescriptor(gx, gy, tick, center) {
      if (center) return { wireKind: 'C', species: 0, entityState: 0, envState: 0 };
      const hash = ((gx * 73856093) ^ (gy * 19349663) ^ (tick * 83492791)) >>> 0;
      const wireKind = hash % 100 < 42 ? WIRE_KINDS[hash % WIRE_KINDS.length] : undefined;
      const envState = hash % 11 === 0 ? 0x02 : hash % 13 === 0 ? 0x04 : 0;
      if (!wireKind && !envState) return null;
      return {
        wireKind,
        species: wireKind && /^[0-5]$/.test(wireKind) ? hash % 3 : undefined,
        entityState: 0,
        envState,
      };
    }

    function descriptorAppearance(descriptor) {
      const kind = descriptor.wireKind;
      if (kind === 'C') return glyphApi.glyphFor('catalyst');
      if (kind === 'M') return glyphApi.glyphFor('membrane');
      if (kind === 'S') return glyphApi.glyphFor('spore');
      if (kind === 'D' || kind === 'N' || kind === 'T') return glyphApi.glyphFor('bondedPair');
      if (kind && /^[0-5]$/.test(kind)) {
        return glyphApi.glyphFor('composite', { role: ROLE_BY_KIND[Number(kind)], species: descriptor.species });
      }
      if (kind === 'R') return glyphApi.glyphFor('rock');
      if (kind === 'F') return glyphApi.glyphFor('nutrient');
      if (descriptor.envState & 0x02) return glyphApi.glyphFor('toxin');
      return glyphApi.glyphFor('mutagen', { strain: 3 });
    }

    function descriptorPresence(descriptor) {
      return (descriptor.wireKind ? 1 : 0) | (descriptor.envState ? 2 : 0);
    }

    function render({ progress, techFade, viewport, windows, ambientTime }) {
      const state = deriveState(progress, reduced.matches);
      const legendRect = viewport.width <= 800
        ? { x: viewport.width * 0.10, y: viewport.height * 0.32, width: viewport.width * 0.80, height: viewport.height * 0.42 }
        : { x: viewport.width * 0.18, y: viewport.height * 0.24, width: viewport.width * 0.64, height: viewport.height * 0.52 };
      const legendMorph = range(progress, LEGEND_MORPH);
      const mobile = viewport.width <= 800;
      const server = mobile
        ? { x: viewport.width * 0.50, y: viewport.height * 0.73, width: 112, height: 64 }
        : { x: viewport.width * 0.64, y: viewport.height * 0.50, width: 128, height: 72 };
      const serverRect = {
        x: server.x - server.width / 2,
        y: server.y - server.height / 2,
        width: server.width,
        height: server.height,
      };
      const networkMorph = range(progress, NETWORK_MORPH);
      const legendFrame = mixRect(windows[0].rect, legendRect, legendMorph);
      let currentFrame = mixRect(legendFrame, serverRect, networkMorph);
      if (reduced.matches) {
        currentFrame = state.beat === 'world' || state.beat === 'perception'
          ? windows[0].rect
          : state.beat === 'emergence' ? legendRect : serverRect;
      }
      const radiusX = mobile ? viewport.width * 0.38 : viewport.width * 0.19;
      const radiusY = mobile ? viewport.height * 0.22 : viewport.height * 0.30;

      legendSurface.setAttribute('x', legendRect.x.toFixed(2));
      legendSurface.setAttribute('y', legendRect.y.toFixed(2));
      legendSurface.setAttribute('width', legendRect.width.toFixed(2));
      legendSurface.setAttribute('height', legendRect.height.toFixed(2));

      const networkPadX = mobile ? 14 : 32;
      const networkTop = server.y - radiusY - (mobile ? 34 : 52);
      const networkBottom = server.y + radiusY + (mobile ? 26 : 34);
      networkSurface.setAttribute('x', (server.x - radiusX - networkPadX).toFixed(2));
      networkSurface.setAttribute('y', networkTop.toFixed(2));
      networkSurface.setAttribute('width', (radiusX * 2 + networkPadX * 2).toFixed(2));
      networkSurface.setAttribute('height', (networkBottom - networkTop).toFixed(2));

      svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
      frame.setAttribute('x', currentFrame.x.toFixed(2));
      frame.setAttribute('y', currentFrame.y.toFixed(2));
      frame.setAttribute('width', currentFrame.width.toFixed(2));
      frame.setAttribute('height', currentFrame.height.toFixed(2));
      frame.dataset.role = networkMorph > 0.98 ? 'server' : 'frame';
      frame.dataset.state = 'healthy';
      const primaryEntity = windows[0].entity;
      observed.textContent = perceptionGlyphs[0].glyph;
      observed.style.fill = perceptionGlyphs[0].color;
      observed.setAttribute('x', primaryEntity.x.toFixed(2));
      observed.setAttribute('y', primaryEntity.y.toFixed(2));
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
        extra.dot.setAttribute('x', win.entity.x.toFixed(2));
        extra.dot.setAttribute('y', win.entity.y.toFixed(2));
        extra.label.setAttribute('x', (win.rect.x + win.rect.width / 2).toFixed(2));
        extra.label.setAttribute('y', (win.rect.y - 10).toFixed(2));
      });
      const legendCenterX = legendRect.x + legendRect.width / 2;
      const legendStartY = legendRect.y + legendRect.height * 0.18;
      legendSpecies.forEach((label, index) => {
        label.setAttribute('x', legendCenterX.toFixed(2));
        label.setAttribute('y', (legendStartY + index * Math.min(42, legendRect.height * 0.10)).toFixed(2));
      });
      const detailStartY = legendRect.y + legendRect.height * 0.54;
      legendDetails.forEach((label, index) => {
        label.setAttribute('x', legendCenterX.toFixed(2));
        label.setAttribute('y', (detailStartY + index * Math.min(30, legendRect.height * 0.07)).toFixed(2));
      });
      legendCycle.setAttribute('x', legendCenterX.toFixed(2));
      legendCycle.setAttribute('y', (legendRect.y + legendRect.height * 0.94).toFixed(2));

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

      // The protagonist connection's phase is scrubbed by scroll (not the tick
      // clock), so the disconnect/reconnect arc can't be scrolled past unseen;
      // reduced motion keeps the static summary.
      const dur = reduced.matches ? null : durabilityFromScroll(progress);
      const activePhase = reduced.matches ? state.clientPhase : dur.phase;
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
        } else if (client.id === PROTAGONIST) {
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
      if (dur && dur.phase === 'reconnecting' && protagonist) {
        const pt = pr.at(1 - clamp01(dur.back)); // token travels client → server
        resumeToken.setAttribute('cx', pt.x.toFixed(2));
        resumeToken.setAttribute('cy', pt.y.toFixed(2));
        resumeToken.style.opacity = '1';
      } else {
        resumeToken.style.opacity = '0';
      }
      if (dur && dur.phase === 'stalled' && protagonist) {
        graceLabel.setAttribute('x', protagonist.x.toFixed(2));
        graceLabel.setAttribute('y', (protagonist.y - 16).toFixed(2));
        graceLabel.textContent = `GRACE ${dur.grace}`;
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
        const lh = big ? 18 : 14; // codec badge → grid-label line height
        insetCodec.style.fontSize = (big ? 12 : 10) + 'px';
        insetLabel.style.fontSize = (big ? 15 : 13) + 'px';
        insetArrow.style.fontSize = (big ? 12 : 10) + 'px';
        insetBytes.style.fontSize = (big ? 16 : 12) + 'px';
        insetCaption.style.fontSize = (big ? 12 : 10) + 'px';
        let ix, iy;
        if (mobile) {
          ix = viewport.width * 0.08;
          // Centre it in the gap between the copy and the top of the ring, so it
          // clears both on short phones where that gap is tight.
          const gapTop = viewport.height * 0.31;
          const gapBottom = server.y - radiusY * 0.82 - 16;
          const insetH = lh + 12 + gridH + 42; // badge + grid + bytes + caption
          iy = gapTop + Math.max(4, (gapBottom - gapTop - insetH) / 2) + 9;
        } else {
          // Stack the readout directly beneath the concurrency copy, sharing its
          // left edge, so the text and this entity-view read as one left column.
          const copy = lines[3].getBoundingClientRect();
          ix = copy.left;
          iy = Math.min(copy.bottom + 40, viewport.height - 270);
        }
        const labelY = iy + lh;
        const gridTop = labelY + (big ? 20 : 12);
        // Desktop left-aligns the readout; mobile centres it under the copy.
        const gridW = 5 * cell;
        const anchor = big ? 'start' : 'middle';
        const textX = big ? ix : viewport.width / 2;
        const gridX = big ? ix : viewport.width / 2 - gridW / 2;
        const surfaceX = big ? ix - 18 : viewport.width * 0.04;
        const surfaceY = iy - (big ? 24 : 18);
        const surfaceWidth = big ? Math.min(viewport.width * 0.35, 470) : viewport.width * 0.92;
        insetSurface.setAttribute('x', surfaceX.toFixed(2));
        insetSurface.setAttribute('y', surfaceY.toFixed(2));
        insetSurface.setAttribute('width', surfaceWidth.toFixed(2));
        [insetCodec, insetLabel, insetArrow, insetBytes, insetCaption].forEach((t) => t.setAttribute('text-anchor', anchor));
        const tick = Math.floor(ambientTime / TICK_PERIOD);
        insetCodec.setAttribute('x', textX.toFixed(2));
        insetCodec.setAttribute('y', iy.toFixed(2));
        insetLabel.setAttribute('x', textX.toFixed(2));
        insetLabel.setAttribute('y', labelY.toFixed(2));
        // Lay out the grid and collect the lit (occupied) cells as we go — they
        // feed the s-block below, so the frame tracks the vision the reader sees.
        const litCells = [];
        insetCells.forEach((cellParts, k) => {
          const gx = k % 5, gy = (k / 5) | 0;
          const r = cellParts.rect;
          const glyph = cellParts.glyph;
          r.setAttribute('x', (gridX + gx * cell).toFixed(2));
          r.setAttribute('y', (gridTop + gy * cell).toFixed(2));
          r.setAttribute('width', String(cell - 2));
          r.setAttribute('height', String(cell - 2));
          glyph.setAttribute('x', (gridX + gx * cell + (cell - 2) / 2).toFixed(2));
          glyph.setAttribute('y', (gridTop + gy * cell + (cell - 2) / 2).toFixed(2));
          glyph.style.fontSize = Math.round(cell * 0.68) + 'px';
          const center = gx === 2 && gy === 2;
          const descriptor = insetDescriptor(gx, gy, tick, center);
          delete r.dataset.entry;
          if (!descriptor) {
            glyph.textContent = '';
            r.setAttribute('fill', 'rgba(0,204,204,0.05)');
            delete r.dataset.presence;
            delete r.dataset.wireKind;
            delete r.dataset.envState;
            return;
          }
          const appearance = descriptorAppearance(descriptor);
          const presence = descriptorPresence(descriptor);
          glyph.textContent = appearance.glyph;
          glyph.setAttribute('fill', center ? '#fff' : appearance.color);
          r.dataset.presence = String(presence);
          r.dataset.wireKind = descriptor.wireKind || '';
          r.dataset.envState = String(descriptor.envState || 0);
          if (descriptor.envState & 0x02) r.setAttribute('fill', 'rgba(224,90,78,0.38)');
          else if (descriptor.envState & 0x04) r.setAttribute('fill', glyphApi.glyphFor('mutagen', { strain: 3 }).color);
          else r.setAttribute('fill', 'rgba(0,204,204,0.05)');
          if (!center) litCells.push({ dx: gx - 2, dy: gy - 2, descriptor, cell: r });
        });
        const gridBottom = gridTop + gridH;
        // A real-shaped Paralife T-frame (SCHEMA §6.3.1), illustrative not exact:
        //   T | tickId(3) | curX(2)curY(2) | energy/max | sensorRadius | s<cells>
        // Position is held constant (the identity that survives the stall); energy
        // drifts; the s-block lists a few visible cells as <relCoord><presence><kind>.
        const rel = (d) => (d >= 0 ? '+' : '-') + A64[Math.abs(d)];
        const sBlock = litCells.slice(0, big ? 4 : 3).map(({ dx, dy, descriptor, cell: r }) => {
          const presence = descriptorPresence(descriptor);
          const entry = `${rel(dx)}${rel(dy)}${A64[presence]}` +
            `${descriptor.wireKind || ''}` +
            `${descriptor.entityState ? A64[descriptor.entityState] : ''}` +
            `${descriptor.envState ? A64[descriptor.envState] : ''}`;
          r.dataset.entry = entry;
          return entry;
        }).join(',');
        const energy = 24 + (tick % 25);
        const frame = `T|${fx(tick % 262144, 3)}|0A1B|${vr(energy)}/m|2|s${sBlock}`;
        insetArrow.style.display = big ? '' : 'none';
        insetArrow.setAttribute('x', textX.toFixed(2));
        insetArrow.setAttribute('y', (gridBottom + 24).toFixed(2));
        insetArrow.textContent = `${frame.length} B · raw WebSocket`;
        insetBytes.setAttribute('x', textX.toFixed(2));
        insetBytes.setAttribute('y', (gridBottom + (big ? 48 : 15)).toFixed(2));
        insetBytes.textContent = frame;
        insetCaption.setAttribute('x', textX.toFixed(2));
        insetCaption.setAttribute('y', (gridBottom + (big ? 70 : 30)).toFixed(2));
        insetCaption.textContent = 'T | tick | x y | energy/max | radius | s: cells';
        insetSurface.setAttribute('height', (gridBottom + (big ? 88 : 42) - surfaceY).toFixed(2));
      }
      serverLabel.setAttribute('x', server.x.toFixed(2));
      serverLabel.setAttribute('y', (server.y + 4).toFixed(2));
      // Illustration title: sits above the ring on desktop (over the server it
      // labels); under the header on mobile, where the ring hangs low.
      if (mobile) {
        durabilityTitle.setAttribute('x', (viewport.width / 2).toFixed(2));
        durabilityTitle.setAttribute('y', (viewport.height * 0.13).toFixed(2));
        durabilityTitle.style.fontSize = '13px';
      } else {
        durabilityTitle.setAttribute('x', server.x.toFixed(2));
        durabilityTitle.setAttribute('y', (server.y - radiusY - 22).toFixed(2));
        durabilityTitle.style.fontSize = '18px';
      }
      const pillY = server.y + server.height / 2 + 26;
      recoveryLabel.setAttribute('x', server.x.toFixed(2));
      recoveryLabel.setAttribute('y', pillY.toFixed(2));
      recoveryLabel.textContent = {
        stalled: 'CONNECTION STALLED',
        reconnecting: 'RECONNECTING',
        recovered: 'SAME ENTITY RESTORED',
        static: 'STALLED · RECONNECT · SAME ENTITY RESTORED',
      }[activePhase] || '';
      const showPill = ['stalled', 'reconnecting', 'recovered', 'static'].includes(activePhase);
      recoveryLabel.dataset.phase = activePhase;
      recoveryLabel.style.opacity = showPill ? '1' : '0';
      // Size the pill to the label each active frame (text length isn't known
      // ahead of time). Vertically centred on the label's optical middle.
      statePill.dataset.phase = activePhase;
      statePill.style.opacity = showPill ? '1' : '0';
      if (showPill) {
        const tw = recoveryLabel.getComputedTextLength();
        const padX = 16, ph = 26;
        statePill.setAttribute('x', (server.x - tw / 2 - padX).toFixed(2));
        statePill.setAttribute('y', (pillY - ph + 8).toFixed(2));
        statePill.setAttribute('width', (tw + padX * 2).toFixed(2));
        statePill.setAttribute('height', String(ph));
      }

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
      const fieldCompression = between(progress, 0.10, 0.17);
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
