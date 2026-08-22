'use strict';

(function () {
  const GLYPHS = Object.freeze({
    catalyst: Object.freeze({ glyph: '◬', color: '#ff9f43' }),
    membrane: Object.freeze({ glyph: '⊡', color: '#b47cf0' }),
    spore: Object.freeze({ glyph: '⊙', color: '#3fe0e8' }),
    bondedPair: Object.freeze({ glyph: '✶', color: '#e6c35c' }),
    rock: Object.freeze({ glyph: '■', color: '#9a9a9a' }),
    nutrient: Object.freeze({ glyph: '⬩', color: '#2f9e6a' }),
    compositeRoles: Object.freeze({
      locomotor: '⋈',
      feeder: '❖',
      attacker: '⨳',
      defender: '⊞',
      reproducer: '❉',
      sensor: '◉',
    }),
    toxin: Object.freeze({ glyph: '≋', color: '#e05a4e' }),
    mutagen: Object.freeze({ glyph: '※' }),
    lightning: Object.freeze({ glyph: '↯', color: '#f5e04c' }),
  });

  const GALLERY_PROFILE = Object.freeze({
    id: 'gallery',
    stepInterval: 0.12,
    settleSteps: 40,
    domainPatches: 8,
    domainRadius: 4,
    spiralCores: 0,
    coreRadius: 0,
    visibleOccupancy: 0.46,
  });

  const HERO_PROFILE = Object.freeze({
    id: 'hero',
    stepInterval: 0.11,
    settleSteps: 90,
    domainPatches: 10,
    domainRadius: 14,
    spiralCores: 7,
    coreRadius: 9,
    visibleOccupancy: 0.52,
  });

  const TAU = Math.PI * 2;
  const COMPOSITE_ROLES = Object.keys(GLYPHS.compositeRoles);
  const SPECIES_NAMES = ['catalyst', 'membrane', 'spore'];

  function wrap(value, span) {
    return value < 0 ? value + span : value >= span ? value - span : value;
  }

  function indexOf(world, x, y) {
    return wrap(y, world.rows) * world.cols + wrap(x, world.cols);
  }

  function stepDense(world) {
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const index = indexOf(world, x, y);
        const here = world.species[index];
        const predator = (here + 2) % 3;
        let predators = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx !== 0 || dy !== 0) {
              predators += world.species[indexOf(world, x + dx, y + dy)] === predator ? 1 : 0;
            }
          }
        }
        world.next[index] = predators >= 3 ? predator : here;
      }
    }
    const previous = world.species;
    world.species = world.next;
    world.next = previous;
  }

  function seedDomains(world, rng, profile) {
    const maxRadius = Math.max(1, (Math.min(world.cols, world.rows) >> 1) - 1);
    for (let patch = 0; patch < profile.domainPatches; patch++) {
      const cx = (rng() * world.cols) | 0;
      const cy = (rng() * world.rows) | 0;
      const species = (rng() * 3) | 0;
      const radius = Math.min(
        profile.id === 'hero' ? Math.round(profile.domainRadius * (0.6 + rng() * 0.8)) : profile.domainRadius,
        maxRadius,
      );
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            world.species[indexOf(world, cx + dx, cy + dy)] = species;
          }
        }
      }
    }

    for (let core = 0; core < profile.spiralCores; core++) {
      const cx = (rng() * world.cols) | 0;
      const cy = (rng() * world.rows) | 0;
      const chirality = rng() < 0.5 ? 1 : -1;
      const phase = rng() * TAU;
      const radius = Math.min(profile.coreRadius, maxRadius);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const angle = Math.atan2(dy, dx) * chirality + phase;
          const turn = ((angle % TAU) + TAU) % TAU;
          world.species[indexOf(world, cx + dx, cy + dy)] = ((turn / TAU) * 3) | 0;
        }
      }
    }
  }

  function placeOccupants(world, rng) {
    const available = [];
    for (let index = 0; index < world.total; index++) available.push(index);
    for (let i = available.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const swap = available[i]; available[i] = available[j]; available[j] = swap;
    }
    const take = () => available.pop();
    const place = (occupant) => {
      const index = take();
      if (index !== undefined) world.occupants[index] = occupant;
    };

    place({ kind: 'rock' });
    place({ kind: 'nutrient' });
    place({ kind: 'bondedPair', primarySpecies: 0, secondarySpecies: 1 });
    COMPOSITE_ROLES.forEach((role, index) => place({ kind: 'composite', role, species: index % 3 }));

    const extras = Math.max(0, Math.floor(world.total * 0.035) - 9);
    const kinds = ['rock', 'nutrient', 'bondedPair', 'composite'];
    for (let i = 0; i < extras; i++) {
      const kind = kinds[i % kinds.length];
      if (kind === 'bondedPair') {
        const primarySpecies = (rng() * 3) | 0;
        place({ kind, primarySpecies, secondarySpecies: (primarySpecies + 1) % 3 });
      } else if (kind === 'composite') {
        place({ kind, role: COMPOSITE_ROLES[i % COMPOSITE_ROLES.length], species: (rng() * 3) | 0 });
      } else {
        place({ kind });
      }
    }
  }

  function seedEnvironment(world, rng) {
    const patch = (target, cx, cy, radius, valueAt) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.hypot(dx, dy);
          if (distance > radius) continue;
          target[indexOf(world, cx + dx, cy + dy)] = valueAt(distance, radius);
        }
      }
    };

    for (let i = 0; i < 2; i++) {
      const radius = 2 + ((rng() * 3) | 0);
      patch(
        world.toxin,
        (rng() * world.cols) | 0,
        (rng() * world.rows) | 0,
        radius,
        (distance, r) => Math.max(1, Math.round(70 + (1 - distance / r) * 170)),
      );
    }
    for (let i = 0; i < 2; i++) {
      const radius = 2 + ((rng() * 2) | 0);
      const strain = (rng() * 8) | 0;
      patch(
        world.mutagen,
        (rng() * world.cols) | 0,
        (rng() * world.rows) | 0,
        radius,
        () => strain,
      );
    }

    const lx = (rng() * world.cols) | 0;
    const ly = (rng() * world.rows) | 0;
    for (let age = 0; age < 5; age++) {
      world.lightning.push({ index: indexOf(world, lx - age, ly + age), age });
    }
  }

  function createWorld({ cols, rows, seed, profile }) {
    const rng = alea(seed);
    const presentationRng = alea(`${seed}-presentation`);
    const total = cols * rows;
    const world = {
      cols, rows, total, profile,
      species: new Uint8Array(total),
      next: new Uint8Array(total),
      chaosSpecies: new Uint8Array(total),
      displayMask: new Uint8Array(total),
      thresholds: new Float32Array(total),
      occupants: Array(total).fill(null),
      toxin: new Uint8Array(total),
      mutagen: new Int16Array(total).fill(-1),
      lightning: [],
      tick: 0,
      revision: 0,
    };

    for (let index = 0; index < total; index++) {
      world.species[index] = (rng() * 3) | 0;
      world.displayMask[index] = presentationRng() < profile.visibleOccupancy ? 1 : 0;
      world.thresholds[index] = presentationRng();
    }
    seedDomains(world, rng, profile);
    world.chaosSpecies.set(world.species);
    placeOccupants(world, presentationRng);
    seedEnvironment(world, presentationRng);
    for (let i = 0; i < profile.settleSteps; i++) stepDense(world);
    for (let species = 0; species < 3; species++) {
      const visibleIndex = world.species.findIndex((value, index) =>
        value === species && world.occupants[index] === null
      );
      if (visibleIndex >= 0) world.displayMask[visibleIndex] = 1;
    }
    return world;
  }

  function advanceWorld(world) {
    stepDense(world);
    world.tick++;
    world.lightning = world.lightning
      .map((entry) => ({ index: entry.index, age: entry.age + 1 }))
      .filter((entry) => entry.age < 5);
    if (world.tick % 18 === 0) {
      const index = (world.tick * 2654435761 >>> 0) % world.total;
      world.lightning.push({ index, age: 0 });
    }
    world.revision++;
    return world;
  }

  function glyphFor(kind, variant = {}) {
    if (kind === 'composite') {
      const species = SPECIES_NAMES[variant.species] || variant.species || 'catalyst';
      return { glyph: GLYPHS.compositeRoles[variant.role], color: GLYPHS[species].color };
    }
    if (kind === 'mutagen') {
      return { glyph: GLYPHS.mutagen.glyph, color: `hsla(${(variant.strain * 47) % 360},70%,45%,0.4)` };
    }
    if (typeof kind === 'number') return GLYPHS[SPECIES_NAMES[kind]];
    return GLYPHS[kind];
  }

  function occupantGlyph(occupant) {
    if (!occupant) return null;
    if (occupant.kind === 'composite') return glyphFor('composite', occupant);
    return glyphFor(occupant.kind, occupant);
  }

  function wrappedDistance(a, b, span) {
    const direct = Math.abs(a - b);
    return Math.min(direct, span - direct);
  }

  function cellDim(world, x, y, windows, focusAmount, outsideDim) {
    if (!windows || windows.length === 0 || focusAmount <= 0) return 1;
    const inside = windows.some((window) =>
      wrappedDistance(x, window.cx, world.cols) <= window.radius &&
      wrappedDistance(y, window.cy, world.rows) <= window.radius
    );
    return inside ? 1 : 1 - focusAmount * (1 - outsideDim);
  }

  function renderWorld(ctx, world, options = {}) {
    const cellPx = options.cellPx || 16;
    const originX = options.originX || 0;
    const originY = options.originY || 0;
    const morph = options.morph === undefined ? 1 : options.morph;
    const alpha = options.alpha === undefined ? 1 : options.alpha;
    const focusAmount = options.focusAmount || 0;
    const outsideDim = options.outsideDim === undefined ? 0.16 : options.outsideDim;
    const windows = options.windows || [];
    const fontPx = Math.max(10, Math.round(cellPx * 0.86));

    if (options.clear !== false) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(originX, originY, world.cols * cellPx, world.rows * cellPx);
      ctx.restore();
    }

    ctx.save();
    ctx.font = `${fontPx}px "Courier New", Courier, "Liberation Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let index = 0; index < world.total; index++) {
      const x = index % world.cols;
      const y = (index / world.cols) | 0;
      const px = originX + x * cellPx;
      const py = originY + y * cellPx;
      const dim = cellDim(world, x, y, windows, focusAmount, outsideDim);

      if (world.toxin[index]) {
        ctx.globalAlpha = alpha * dim;
        ctx.fillStyle = `rgba(224,90,78,${(0.15 + 0.6 * world.toxin[index] / 255).toFixed(3)})`;
        ctx.fillRect(px, py, cellPx, cellPx);
      }
      if (world.mutagen[index] >= 0) {
        ctx.globalAlpha = alpha * dim;
        ctx.fillStyle = glyphFor('mutagen', { strain: world.mutagen[index] }).color;
        ctx.fillRect(px, py, cellPx, cellPx);
      }

      const settled = morph >= world.thresholds[index];
      const species = settled ? world.species[index] : world.chaosSpecies[index];
      const descriptor = occupantGlyph(world.occupants[index]) ||
        (world.displayMask[index] ? glyphFor(species) : null);
      if (!descriptor) continue;
      ctx.globalAlpha = alpha * dim * (settled ? 0.88 : 0.35);
      ctx.fillStyle = descriptor.color;
      ctx.fillText(descriptor.glyph, px + cellPx / 2, py + cellPx * 0.52);
    }

    for (const entry of world.lightning) {
      const x = entry.index % world.cols;
      const y = (entry.index / world.cols) | 0;
      const dim = cellDim(world, x, y, windows, focusAmount, outsideDim);
      ctx.globalAlpha = alpha * dim * (1 - entry.age / 5);
      ctx.fillStyle = GLYPHS.lightning.color;
      ctx.fillText(
        GLYPHS.lightning.glyph,
        originX + x * cellPx + cellPx / 2,
        originY + y * cellPx + cellPx * 0.52,
      );
    }
    ctx.restore();
  }

  window.ParalifeGlyphWorld = {
    GLYPHS,
    GALLERY_PROFILE,
    HERO_PROFILE,
    createWorld,
    advanceWorld,
    renderWorld,
    glyphFor,
  };
}());
