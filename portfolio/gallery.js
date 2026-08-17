'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Cycle timing
// ═══════════════════════════════════════════════════════════════════════════
const CYCLE = 5.0;
const PH_CHAOS = 0.4;    // hold chaos
const PH_MORPH = 2.3;    // morph 0→1
const PH_ORDER = 1.3;    // hold solution
const PH_FADE_OUT = 0.5;  // dissolve out
const PH_FADE_IN = 0.5;   // dissolve in (morph reset)

function getCycleState(elapsed) {
  let t = elapsed % CYCLE;
  if (t < PH_CHAOS) return { morph: 0, opacity: 1 };
  t -= PH_CHAOS;
  if (t < PH_MORPH) return { morph: smoothstep(t / PH_MORPH), opacity: 1 };
  t -= PH_MORPH;
  if (t < PH_ORDER) return { morph: 1, opacity: 1 };
  t -= PH_ORDER;
  if (t < PH_FADE_OUT) return { morph: 1, opacity: 1 - t / PH_FADE_OUT };
  t -= PH_FADE_OUT;
  return { morph: 0, opacity: t / PH_FADE_IN };
}

// ═══════════════════════════════════════════════════════════════════════════
// Renderer registry
// ═══════════════════════════════════════════════════════════════════════════
const RENDERERS = {
  jointly:   { init: initJointly,   render: renderJointly },
  oasis:     { init: initOasis,     render: renderOasis },
  guestflow: { init: initGuestflow, render: renderGuestflow },
  mystery:   { init: initMystery,   render: renderMystery },
  bitbrush:  { init: initBitbrush,  render: renderBitbrush },
  paralife:  { init: initParalife,  render: renderParalife },
};

// ── Title palette echo ──────────────────────────────────────────────────────
const TITLE_PALETTES = {
  jointly:   [[249,102,51],[0,204,204],[250,170,85],[0,170,255],[68,221,255]],
  oasis:     [[255,153,102],[60,200,100],[0,204,204],[80,210,90],[255,204,102]],
  guestflow: [[255,150,50],[0,200,200],[0,180,220],[0,220,180],[255,170,70]],
  mystery:   [[106,170,68],[0,204,204],[232,85,85],[0,170,255],[0,238,170]],
  bitbrush:  [[0,204,204],[68,255,68],[255,102,51],[204,68,255],[0,170,255]],
  paralife:  [[0,204,204],[190,140,255],[255,160,70],[0,238,170],[68,221,255]],
};

function getTitleLetterIntensity(projectId, morph, i, count) {
  if (projectId === 'guestflow') {
    // Linear sweep — no easing, mechanical feel
    const offset = (i / (count - 1)) * 0.5;
    return clamp01((morph - offset) / 0.5);
  }
  if (projectId === 'bitbrush') {
    // Snappy pseudo-random fill order, softened with short ease
    const order = [4, 1, 7, 2, 8, 0, 5, 3, 6];
    const rank = order[i % order.length];
    const threshold = rank / (count - 1) * 0.85;
    return smoothstep(clamp01((morph - threshold) / 0.15));
  }
  // Eased left-to-right sweep (jointly, oasis, mystery)
  const offset = (i / (count - 1)) * 0.5;
  return smoothstep(clamp01((morph - offset) / 0.5));
}


// ═══════════════════════════════════════════════════════════════════════════
// Jointly — particle clusters
// ═══════════════════════════════════════════════════════════════════════════
const JN_BG0 = [20, 12, 5], JN_BG1 = [5, 10, 20];
const JN_C0 = [[249,102,51],[250,170,85],[252,198,102],[247,119,102],[232,85,85]];
const JN_C1 = [[0,204,204],[0,170,255],[0,136,255],[0,238,170],[68,221,255]];

function initJointly(w, h) {
  const rng = alea('jointly-th');
  const s = Math.min(w, h);
  // Flattened into the top half — the caption plate owns the bottom ~45%.
  const centers = [
    [0.22*w, 0.22*h], [0.78*w, 0.22*h], [0.50*w, 0.33*h],
    [0.22*w, 0.44*h], [0.78*w, 0.44*h],
  ];
  const particles = [];
  for (let g = 0; g < 5; g++) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng() * 0.4;
      const r = s * 0.09 * (0.5 + rng() * 0.5);
      particles.push({
        g: g,
        cx: rng() * w, cy: rng() * h,
        sx: centers[g][0] + Math.cos(a) * r,
        sy: centers[g][1] + Math.sin(a) * r,
        ph: rng() * 6.28, sp: 0.4 + rng() * 0.6,
        sz: 3.5 + rng() * 4,
      });
    }
  }
  return { p: particles };
}

function renderJointly(ctx, w, h, morph, time, state) {
  const sm = smoothstep(morph);
  ctx.fillStyle = rgbStr(lerpRgb(JN_BG0, JN_BG1, sm));
  ctx.fillRect(0, 0, w, h);

  const ps = state.p;
  const drift = (1 - sm) * 18;
  const pos = [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    pos.push([
      lerp(p.cx + Math.sin(time * p.sp + p.ph) * drift, p.sx, sm),
      lerp(p.cy + Math.cos(time * p.sp * 0.7 + p.ph) * drift, p.sy, sm),
    ]);
  }

  // Connection lines
  if (sm > 0.35) {
    const la = (sm - 0.35) / 0.65 * 0.2;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        if (ps[i].g !== ps[j].g) continue;
        ctx.strokeStyle = rgbaStr(JN_C1[ps[i].g], la);
        ctx.beginPath();
        ctx.moveTo(pos[i][0], pos[i][1]);
        ctx.lineTo(pos[j][0], pos[j][1]);
        ctx.stroke();
      }
    }
  }

  // Glow halos
  if (sm > 0.7) {
    const ga = (sm - 0.7) / 0.3 * 0.12;
    for (let i = 0; i < ps.length; i++) {
      ctx.fillStyle = rgbaStr(JN_C1[ps[i].g], ga);
      ctx.beginPath();
      ctx.arc(pos[i][0], pos[i][1], ps[i].sz * 3, 0, 6.28);
      ctx.fill();
    }
  }

  // Particles
  for (let i = 0; i < ps.length; i++) {
    ctx.fillStyle = rgbStr(lerpRgb(JN_C0[ps[i].g], JN_C1[ps[i].g], sm));
    ctx.beginPath();
    ctx.arc(pos[i][0], pos[i][1], ps[i].sz, 0, 6.28);
    ctx.fill();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Oasis — conveyor belt with scanner beam
// ═══════════════════════════════════════════════════════════════════════════
const OA_BG0 = [12, 5, 2], OA_BG1 = [2, 8, 12];
const OA_BC0 = [[255,153,102],[255,170,85],[255,204,102],[255,119,102]];
const OA_BC1 = [[60,200,100],[40,190,110],[80,210,90],[50,180,120]];
const OA_SCAN = [0, 204, 204];

function initOasis(w, h) {
  const rng = alea('oasis-th');
  const blocks = [];
  for (let i = 0; i < 6; i++) {
    blocks.push({
      x: 0.10 + i * 0.16,
      ci: Math.floor(rng() * 4),
      wobble: (rng() - 0.5) * 0.08,
      crack: rng() < 0.4,
    });
  }
  return { blocks: blocks };
}

function renderOasis(ctx, w, h, morph, time, state) {
  const sm = smoothstep(morph);
  ctx.fillStyle = rgbStr(lerpRgb(OA_BG0, OA_BG1, sm));
  ctx.fillRect(0, 0, w, h);

  const beltY = h * 0.42, beltH = h * 0.04;
  const bw = w * 0.09, bh = h * 0.16;

  // Belt
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, beltY, w, beltH);
  const spacing = w / 12;
  const off = (time * 40) % spacing;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let x = -spacing + off; x < w + spacing; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, beltY + 2); ctx.lineTo(x, beltY + beltH - 2); ctx.stroke();
  }

  // Scanner position
  const scanX = lerp(-0.05, 1.05, sm) * w;

  // Blocks
  for (let i = 0; i < state.blocks.length; i++) {
    const b = state.blocks[i];
    const bx = b.x * w, by = beltY - bh;
    const sp = clamp01((scanX - (bx - bw / 2)) / (bw * 1.5));
    const col = lerpRgb(OA_BC0[b.ci], OA_BC1[b.ci], sp);
    const wob = b.wobble * (1 - sp);

    ctx.save();
    ctx.translate(bx, by + bh / 2);
    ctx.rotate(wob * Math.sin(time * 2 + i));
    ctx.fillStyle = rgbStr(col);
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

    if (b.crack && sp < 0.5) {
      ctx.strokeStyle = 'rgba(0,0,0,' + (0.4 * (1 - sp * 2)) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.1, -bh * 0.3);
      ctx.lineTo(bw * 0.15, bh * 0.1);
      ctx.lineTo(-bw * 0.05, bh * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Scanner beam
  if (sm > 0.03) {
    const ba = Math.min(1, sm * 4) * 0.7;
    ctx.strokeStyle = rgbaStr(OA_SCAN, ba * 0.3);
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(scanX, beltY - bh - 12); ctx.lineTo(scanX, beltY + beltH + 6); ctx.stroke();
    ctx.strokeStyle = rgbaStr(OA_SCAN, ba);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(scanX, beltY - bh - 12); ctx.lineTo(scanX, beltY + beltH + 6); ctx.stroke();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Guestflow — booking flow convergence
// ═══════════════════════════════════════════════════════════════════════════
const GF_BG0 = [10, 5, 8], GF_BG1 = [5, 8, 18];
const GF_TC0 = [[255,150,50],[255,170,70],[255,130,40]];
const GF_TC1 = [[0,200,200],[0,180,220],[0,220,180]];
const GF_ACCENT = [0, 204, 204];

function initGuestflow(w, h) {
  const rng = alea('guestflow-th');
  // The hub sat at 0.62h with its lower half under the caption plate.
  const sites = [
    { x: 0.20, y: 0.20, gf: false },
    { x: 0.52, y: 0.13, gf: false },
    { x: 0.82, y: 0.20, gf: false },
    { x: 0.48, y: 0.42, gf: true },
  ];
  const tris = [];
  for (let i = 0; i < 10; i++) {
    const from = Math.floor(rng() * 4);
    const to = (from + 1 + Math.floor(rng() * 3)) % 4;
    tris.push({
      from: from, to: to,
      biasGF: rng() < 0.7,
      offset: rng(),
      speed: 0.25 + rng() * 0.35,
      ci: Math.floor(rng() * 3),
    });
  }
  return { sites: sites, tris: tris };
}

function renderGuestflow(ctx, w, h, morph, time, state) {
  const sm = smoothstep(morph);
  const s = Math.min(w, h);
  ctx.fillStyle = rgbStr(lerpRgb(GF_BG0, GF_BG1, sm));
  ctx.fillRect(0, 0, w, h);

  const sz = s * 0.10;
  const sites = state.sites;
  const pos = [];
  for (let i = 0; i < sites.length; i++) {
    const si = sites[i];
    const size = si.gf ? sz * lerp(1, 2.2, sm) : sz * lerp(1, 0.8, sm);
    const sx = si.x * w + (si.gf ? lerp(0, -w * 0.04, sm) : 0);
    pos.push({ x: sx, y: si.y * h, size: size, gf: si.gf });
  }

  // Triangles
  const triSize = s * 0.022;
  for (let i = 0; i < state.tris.length; i++) {
    const tri = state.tris[i];
    const t = ((time * tri.speed + tri.offset) % 1);
    const gfBlend = tri.biasGF ? clamp01((sm - 0.3) * 3) : 0;
    const from = pos[tri.from];
    const toX = lerp(pos[tri.to].x, pos[3].x, gfBlend);
    const toY = lerp(pos[tri.to].y, pos[3].y, gfBlend);
    const tx = lerp(from.x, toX, t);
    const ty = lerp(from.y, toY, t);
    const angle = Math.atan2(toY - from.y, toX - from.x);
    const col = lerpRgb(GF_TC0[tri.ci], GF_TC1[tri.ci], sm);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(angle);
    ctx.fillStyle = rgbaStr(col, 0.75);
    ctx.beginPath();
    ctx.moveTo(triSize, 0);
    ctx.lineTo(-triSize * 0.6, triSize * 0.55);
    ctx.lineTo(-triSize * 0.6, -triSize * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Site cards
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i];
    if (p.gf && sm > 0.3) {
      ctx.fillStyle = rgbaStr(GF_ACCENT, (sm - 0.3) * 0.2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.5, 0, 6.28);
      ctx.fill();
    }
    const cc = p.gf ? lerpRgb([60,50,60], GF_ACCENT, sm) : lerpRgb([60,50,60], [30,60,70], sm);
    ctx.fillStyle = rgbStr(cc);
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Mystery Manager — shape sorting
// ═══════════════════════════════════════════════════════════════════════════
const MY_BG0 = [12, 8, 5], MY_BG1 = [5, 8, 18];
const MY_C0 = [[106,170,68],[232,85,85],[212,68,68],[140,198,68],[218,170,85]];
const MY_C1 = [[0,204,204],[0,170,255],[0,136,255],[0,238,170],[68,221,255]];

function initMystery(w, h) {
  const rng = alea('mystery-th');
  const shapes = [];
  const types = ['circle', 'triangle', 'square'];
  for (let t = 0; t < 3; t++) {
    for (let i = 0; i < 5; i++) {
      shapes.push({
        type: types[t],
        cx: rng() * w * 0.7 + w * 0.15,
        cy: rng() * h * 0.7 + h * 0.15,
        sx: (0.25 + t * 0.25) * w,
        // Sorted rows stay above the caption plate, which owns the bottom ~45%.
        sy: (0.22 + i * 0.075) * h,
        ph: rng() * 6.28,
        sp: 0.3 + rng() * 0.5,
        ci: Math.floor(rng() * 5),
        rot: rng() * 6.28,
      });
    }
  }
  return { shapes: shapes };
}

function renderMystery(ctx, w, h, morph, time, state) {
  const sm = smoothstep(morph);
  const s = Math.min(w, h);
  ctx.fillStyle = rgbStr(lerpRgb(MY_BG0, MY_BG1, sm));
  ctx.fillRect(0, 0, w, h);

  const r = s * 0.033;
  for (let i = 0; i < state.shapes.length; i++) {
    const sh = state.shapes[i];
    const drift = (1 - sm) * 12;
    const x = lerp(sh.cx + Math.sin(time * sh.sp + sh.ph) * drift, sh.sx, sm);
    const y = lerp(sh.cy + Math.cos(time * sh.sp * 0.8 + sh.ph) * drift, sh.sy, sm);
    const rot = lerp(sh.rot + time * 0.5, 0, sm);
    ctx.fillStyle = rgbStr(lerpRgb(MY_C0[sh.ci], MY_C1[sh.ci], sm));

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (sh.type === 'circle') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill();
    } else if (sh.type === 'square') {
      ctx.fillRect(-r, -r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(r, r * 0.9);
      ctx.lineTo(-r, r * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Column labels (solution state)
  if (sm > 0.6) {
    const la = (sm - 0.6) / 0.4 * 0.35;
    ctx.textAlign = 'center';
    ctx.font = (s * 0.05) + 'px monospace';
    ctx.fillStyle = 'rgba(255,255,255,' + la + ')';
    ctx.fillText('\u25CF', 0.25 * w, 0.12 * h);
    ctx.fillText('\u25B2', 0.50 * w, 0.12 * h);
    ctx.fillText('\u25A0', 0.75 * w, 0.12 * h);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// BitBrush — pixel wavefront fill
// ═══════════════════════════════════════════════════════════════════════════
const BB_PAL = [
  [0,204,204],[0,170,255],[0,136,255],[0,238,170],[68,221,255],
  [255,102,51],[255,153,102],[255,204,102],[255,170,85],[238,136,85],
  [68,255,68],[102,255,153],[204,68,255],[255,68,204],[255,255,255],
];

function initBitbrush(w, h) {
  const rng = alea('bitbrush-th');
  const cs = Math.max(5, Math.min(11, Math.floor(Math.min(w, h) / 32)));
  const gap = 1;
  const cols = Math.floor(w / (cs + gap));
  const rows = Math.floor(h / (cs + gap));
  const ox = (w - cols * (cs + gap) + gap) / 2;
  const oy = (h - rows * (cs + gap) + gap) / 2;
  const total = cols * rows;

  // Shuffle fill order
  const order = [];
  for (let i = 0; i < total; i++) order.push(i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }

  const colors = [];
  for (let i = 0; i < total; i++) colors.push(BB_PAL[Math.floor(rng() * BB_PAL.length)]);

  return { cols: cols, rows: rows, cs: cs, gap: gap, ox: ox, oy: oy, order: order, colors: colors, total: total };
}

function renderBitbrush(ctx, w, h, morph, time, state) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const cs = state.cs, gap = state.gap;
  const filled = Math.floor(lerp(0.08, 0.7, morph) * state.total);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= state.cols; c++) {
    const x = state.ox + c * (cs + gap);
    ctx.beginPath(); ctx.moveTo(x, state.oy); ctx.lineTo(x, state.oy + state.rows * (cs + gap)); ctx.stroke();
  }
  for (let r = 0; r <= state.rows; r++) {
    const y = state.oy + r * (cs + gap);
    ctx.beginPath(); ctx.moveTo(state.ox, y); ctx.lineTo(state.ox + state.cols * (cs + gap), y); ctx.stroke();
  }

  // Filled cells
  const frontier = Math.max(0, filled - Math.floor(state.total * 0.03));
  for (let i = 0; i < filled; i++) {
    const idx = state.order[i];
    const col = idx % state.cols;
    const row = (idx / state.cols) | 0;
    const x = state.ox + col * (cs + gap);
    const y = state.oy + row * (cs + gap);
    const color = state.colors[idx];

    if (i >= frontier) {
      const glow = 0.35 * (1 - (i - frontier) / (filled - frontier + 1));
      ctx.fillStyle = rgbaStr(color, 0.55 + glow);
    } else {
      ctx.fillStyle = rgbaStr(color, 0.55);
    }
    ctx.fillRect(x, y, cs, cs);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Paralife — toroidal rock-paper-scissors cellular automaton
// Chaos (noise) dissolves into the spiral waves the simulation produces.
// ═══════════════════════════════════════════════════════════════════════════
const PL_SPECIES = [[0,204,204],[190,140,255],[255,160,70]];
const PL_BEAT = 3;          // predator neighbours needed to convert a cell
const PL_STEP = 0.12;       // seconds between automaton steps
const PL_SETTLE = 40;       // steps run at init so the thumbnail opens mid-pattern
const PL_PATCHES = 8;
const PL_PATCH_R = 4;

function plIdx(state, x, y) {
  const c = state.cols, r = state.rows;
  const wx = x < 0 ? x + c : x >= c ? x - c : x;
  const wy = y < 0 ? y + r : y >= r ? y - r : y;
  return wy * c + wx;
}

function plStep(state) {
  const grid = state.grid, next = state.next;
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const here = grid[plIdx(state, x, y)];
      const predator = (here + 2) % 3;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (grid[plIdx(state, x + dx, y + dy)] === predator) count++;
        }
      }
      next[plIdx(state, x, y)] = count >= PL_BEAT ? predator : here;
    }
  }
  state.grid = next;
  state.next = grid;
}

function initParalife(w, h) {
  const rng = alea('paralife-th');
  const cs = Math.max(4, Math.min(9, Math.floor(Math.min(w, h) / 30)));
  const cols = Math.max(4, Math.floor(w / cs));
  const rows = Math.max(4, Math.floor(h / cs));
  const total = cols * rows;

  const state = {
    cs: cs, cols: cols, rows: rows, total: total,
    ox: (w - cols * cs) / 2,
    oy: (h - rows * cs) / 2,
    grid: new Uint8Array(total),
    next: new Uint8Array(total),
    noise: new Uint8Array(total),
    threshold: new Float32Array(total),
    stepTime: 0,
    lastTime: 0
  };

  for (let i = 0; i < total; i++) {
    state.grid[i] = (rng() * 3) | 0;
    state.threshold[i] = rng();
  }

  for (let p = 0; p < PL_PATCHES; p++) {
    const cx = (rng() * cols) | 0, cy = (rng() * rows) | 0;
    const species = (rng() * 3) | 0;
    for (let dy = -PL_PATCH_R; dy <= PL_PATCH_R; dy++) {
      for (let dx = -PL_PATCH_R; dx <= PL_PATCH_R; dx++) {
        if (dx * dx + dy * dy > PL_PATCH_R * PL_PATCH_R) continue;
        state.grid[plIdx(state, cx + dx, cy + dy)] = species;
      }
    }
  }

  // Keep the un-evolved field as the "chaos" end of the morph.
  state.noise.set(state.grid);
  for (let i = 0; i < PL_SETTLE; i++) plStep(state);

  return state;
}

function renderParalife(ctx, w, h, morph, time, state) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Advance the automaton on wall-clock, independent of the morph cycle.
  const dt = Math.max(0, Math.min(0.25, time - state.lastTime));
  state.lastTime = time;
  state.stepTime += dt;
  while (state.stepTime >= PL_STEP) {
    state.stepTime -= PL_STEP;
    plStep(state);
  }

  const cs = state.cs;
  const size = cs > 5 ? cs - 1 : cs;

  for (let i = 0; i < state.total; i++) {
    // Per-cell threshold dissolves noise into the settled pattern.
    const settled = morph > state.threshold[i];
    const species = settled ? state.grid[i] : state.noise[i];
    const col = i % state.cols;
    const row = (i / state.cols) | 0;
    const alpha = settled ? 0.72 : 0.28;
    ctx.fillStyle = rgbaStr(PL_SPECIES[species], alpha);
    ctx.fillRect(state.ox + col * cs, state.oy + row * cs, size, size);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Thumbnail manager
// ═══════════════════════════════════════════════════════════════════════════
class Thumbnail {
  constructor(card) {
    this.card = card;
    this.canvas = card.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.projectId = card.dataset.project;
    this.active = false;
    this.elapsed = 0;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.state = null;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.dpr = window.devicePixelRatio || 1;
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.state = RENDERERS[this.projectId].init(this.w, this.h);
    this.drawStatic();
  }

  /** The resting frame, drawn at the resolved end of the morph — the
   *  composition each renderer is built to arrive at. Resting at the chaos end
   *  instead left every idle card showing scattered noise. */
  drawStatic() {
    if (!this.state) return;
    RENDERERS[this.projectId].render(this.ctx, this.w, this.h, 1, 0, this.state);
  }

  activate() {
    if (this.active) return;
    this.active = true;
    // Start right where the order hold ends, so the first frame still matches
    // the resting composition (no snap) but the fade to chaos begins at once
    // instead of waiting out the full order hold.
    this.elapsed = PH_CHAOS + PH_MORPH + PH_ORDER;
    this.card.classList.add('active');
    activeCount++;
    if (activeCount === 1) startLoop();
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    this.card.classList.remove('active');
    activeCount--;
    this.drawStatic();
  }

  render(dt) {
    if (!this.active || !this.state) return;
    this.elapsed += dt;
    const s = getCycleState(this.elapsed);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = s.opacity;
    RENDERERS[this.projectId].render(ctx, this.w, this.h, s.morph, this.elapsed, this.state);
    ctx.restore();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Gallery initialization
// ═══════════════════════════════════════════════════════════════════════════
const thumbs = [];
let activeCount = 0;
let loopRunning = false;
let lastTime = 0;

const titleSpans = [];
let titleBlend = 0;
let titlePal = null;
let titleProjectId = null;
let titleCycle = { morph: 0, opacity: 1 };

// ── Full-page background canvas (desktop only) ────────────────────────────
let bgCanvas = null;
let bgCtx = null;
let bgW = 0, bgH = 0;
let bgState = null;
let bgActiveThumb = null;
let bgEnabled = false;

const BG_SCALE = 2.5; // render at reduced logical size so shapes appear larger
// Below the gallery's 768px breakpoint the grid is single-column and the echo
// swamps it. The touch/desktop branch is chosen once at load, so a desktop
// window dragged narrow would otherwise keep painting it.
const BG_MIN_WIDTH = 769;

function initBgCanvas() {
  bgCanvas = document.getElementById('bg-canvas');
  if (!bgCanvas) return;
  bgCtx = bgCanvas.getContext('2d');
  resizeBgCanvas();
}

function resizeBgCanvas() {
  if (!bgCanvas) return;
  bgEnabled = window.innerWidth >= BG_MIN_WIDTH;
  bgCanvas.style.display = bgEnabled ? '' : 'none';
  if (!bgEnabled) {
    // Drop the mirrored state so nothing stale is held while gated off.
    bgActiveThumb = null;
    bgState = null;
    bgCanvas.style.opacity = '0';
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  bgW = window.innerWidth / BG_SCALE;
  bgH = window.innerHeight / BG_SCALE;
  // Render at full viewport resolution so CSS scaling doesn't blur
  bgCanvas.width = window.innerWidth * dpr;
  bgCanvas.height = window.innerHeight * dpr;
  // Scale the context so renderers draw in their small coordinate space
  // but the output fills the high-res canvas
  bgCtx.setTransform(dpr * BG_SCALE, 0, 0, dpr * BG_SCALE, 0, 0);
  if (bgActiveThumb) {
    bgState = RENDERERS[bgActiveThumb.projectId].init(bgW, bgH);
  }
}

function startLoop() {
  if (loopRunning) return;
  loopRunning = true;
  lastTime = 0;
  requestAnimationFrame(mainLoop);
}

function mainLoop(ts) {
  let dt = lastTime ? (ts - lastTime) / 1000 : 0;
  lastTime = ts;
  if (dt > 0.1) dt = 0.1;

  let active = null;
  for (let i = 0; i < thumbs.length; i++) {
    thumbs[i].render(dt);
    if (thumbs[i].active) active = thumbs[i];
  }

  // Background canvas: mirror whichever thumbnail is active
  if (bgCanvas && bgEnabled) {
    if (active && active !== bgActiveThumb) {
      bgActiveThumb = active;
      bgState = RENDERERS[active.projectId].init(bgW, bgH);
      bgCanvas.style.opacity = '0.3';
    } else if (!active && bgActiveThumb) {
      bgActiveThumb = null;
      bgState = null;
      bgCanvas.style.opacity = '0';
    }

    if (bgActiveThumb && bgState) {
      const s = getCycleState(bgActiveThumb.elapsed);
      bgCtx.save();
      bgCtx.clearRect(0, 0, bgW, bgH);
      bgCtx.globalAlpha = s.opacity;
      const r = RENDERERS[bgActiveThumb.projectId];
      (r.bg || r.render)(bgCtx, bgW, bgH, s.morph, bgActiveThumb.elapsed, bgState);
      bgCtx.restore();
    }
  }

  // Title palette echo — driven by the active card's morph cycle
  if (titleSpans.length > 0) {
    if (active) {
      titlePal = TITLE_PALETTES[active.projectId];
      titleProjectId = active.projectId;
      titleCycle = getCycleState(active.elapsed);
      titleBlend = Math.min(1, titleBlend + dt * 2);
    } else {
      titleBlend = Math.max(0, titleBlend - dt * 1.5);
    }

    const count = titleSpans.length;
    for (let i = 0; i < count; i++) {
      if (titleBlend > 0 && titlePal) {
        const li = getTitleLetterIntensity(titleProjectId, titleCycle.morph, i, count);
        const intensity = titleBlend * titleCycle.opacity * li;
        const col = titlePal[i % titlePal.length];
        titleSpans[i].style.color = rgbStr(lerpRgb([255, 255, 255], col, intensity));
      } else {
        titleSpans[i].style.color = '';
      }
    }
  }

  if (activeCount > 0 || titleBlend > 0) {
    requestAnimationFrame(mainLoop);
  } else {
    loopRunning = false;
  }
}

// ── Desktop idle autoplay ──────────────────────────────────────────────────
let idleTimer = null;
let idleCycleTimer = null;
let idleThumb = null;
let idleIndex = 0;
let idleRunning = false;
const visibleSet = new Set();
let userInteracting = false;
const IDLE_DELAY = 2000;  // ms before autoplay starts
const IDLE_GAP = 800;     // ms pause between cards

function startIdleTimer() {
  stopIdle();
  idleTimer = setTimeout(beginIdle, IDLE_DELAY);
}

function stopIdle() {
  clearTimeout(idleTimer);
  clearTimeout(idleCycleTimer);
  if (idleThumb) {
    idleThumb.deactivate();
    idleThumb = null;
  }
  idleRunning = false;
}

function beginIdle() {
  if (userInteracting) return;
  idleRunning = true;
  playNextIdle();
}

function playNextIdle() {
  if (!idleRunning || userInteracting) return;

  // Collect visible thumbs in DOM order
  const visible = [];
  for (let i = 0; i < thumbs.length; i++) {
    if (visibleSet.has(thumbs[i].card)) visible.push(thumbs[i]);
  }
  if (visible.length === 0) { idleRunning = false; return; }

  idleIndex = idleIndex % visible.length;
  const thumb = visible[idleIndex];
  thumb.activate();
  idleThumb = thumb;

  // Deactivate just before the cycle wraps to avoid a second-loop flash
  idleCycleTimer = setTimeout(() => {
    if (!idleRunning) return;
    thumb.deactivate();
    idleThumb = null;
    idleIndex = (idleIndex + 1) % visible.length;
    idleCycleTimer = setTimeout(playNextIdle, IDLE_GAP);
  }, (CYCLE - PH_FADE_IN) * 1000);
}

// ── Init ───────────────────────────────────────────────────────────────────
function initGallery() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const titleEl = document.getElementById('title-text');
  if (titleEl) {
    const text = titleEl.textContent;
    titleEl.textContent = '';
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement('span');
      span.textContent = text[i];
      titleEl.appendChild(span);
      titleSpans.push(span);
    }
  }

  const cards = document.querySelectorAll('.card[data-project]');
  for (let i = 0; i < cards.length; i++) {
    thumbs.push(new Thumbnail(cards[i]));
  }

  // Reduced motion still gets the artwork — one settled frame per card, drawn
  // once. Only the animation is withheld, not the design.
  if (reducedMotion) {
    window.addEventListener('resize', () => {
      for (let i = 0; i < thumbs.length; i++) thumbs[i].resize();
    });
    return;
  }

  const isTouch = window.matchMedia('(hover: none)').matches;

  if (isTouch) {
    // Mobile: IntersectionObserver, one card at a time
    let current = null;
    const observer = new IntersectionObserver((entries) => {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const thumb = thumbForCard(entry.target);
        if (!thumb) continue;
        if (entry.isIntersecting) {
          if (current && current !== thumb) current.deactivate();
          thumb.activate();
          current = thumb;
        } else if (thumb === current) {
          thumb.deactivate();
          current = null;
        }
      }
    }, { threshold: 0.5 });

    for (let i = 0; i < cards.length; i++) observer.observe(cards[i]);
  } else {
    // Desktop: full-page background canvas
    initBgCanvas();

    // Desktop: track visibility for idle autoplay
    const visObserver = new IntersectionObserver((entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) visibleSet.add(entries[i].target);
        else visibleSet.delete(entries[i].target);
      }
    }, { threshold: 0.3 });

    for (let i = 0; i < cards.length; i++) visObserver.observe(cards[i]);

    // Desktop: hover + focus (interrupts idle)
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      card.addEventListener('mouseenter', () => {
        userInteracting = true;
        stopIdle();
        thumbForCard(card).activate();
      });
      card.addEventListener('mouseleave', () => {
        thumbForCard(card).deactivate();
        userInteracting = false;
        startIdleTimer();
      });
      card.addEventListener('focusin', () => {
        userInteracting = true;
        stopIdle();
        thumbForCard(card).activate();
      });
      card.addEventListener('focusout', () => {
        thumbForCard(card).deactivate();
        userInteracting = false;
        startIdleTimer();
      });
    }

    // Start initial idle countdown
    startIdleTimer();
  }

  window.addEventListener('resize', () => {
    for (let i = 0; i < thumbs.length; i++) thumbs[i].resize();
    if (bgCanvas) resizeBgCanvas();
  });
}

function thumbForCard(card) {
  for (let i = 0; i < thumbs.length; i++) {
    if (thumbs[i].card === card) return thumbs[i];
  }
  return null;
}

document.addEventListener('DOMContentLoaded', initGallery);
