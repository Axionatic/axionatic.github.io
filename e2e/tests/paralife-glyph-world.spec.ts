import { test, expect } from '@playwright/test';
import { navigateToGallery } from '../helpers/pages';
import { navigateToPortfolioPage } from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';

test('Paralife exposes the approved glyph catalogue and concrete profiles', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop 1440');
  await navigateToGallery(page);

  const contract = await page.evaluate(() => {
    const api = (window as any).ParalifeGlyphWorld;
    return api && {
      glyphs: api.GLYPHS,
      gallery: api.GALLERY_PROFILE,
      hero: api.HERO_PROFILE,
    };
  });

  expect(contract).toBeTruthy();
  expect(contract.glyphs).toMatchObject({
    catalyst: { glyph: '◬', color: '#ff9f43' },
    membrane: { glyph: '⊡', color: '#b47cf0' },
    spore: { glyph: '⊙', color: '#3fe0e8' },
    bondedPair: { glyph: '✶', color: '#e6c35c' },
    rock: { glyph: '■', color: '#9a9a9a' },
    nutrient: { glyph: '⬩', color: '#2f9e6a' },
    toxin: { glyph: '≋', color: '#e05a4e' },
    lightning: { glyph: '↯', color: '#f5e04c' },
  });
  expect(contract.glyphs.compositeRoles).toEqual({
    locomotor: '⋈', feeder: '❖', attacker: '⨳', defender: '⊞', reproducer: '❉', sensor: '◉',
  });
  expect(contract.gallery).toMatchObject({
    id: 'gallery', stepInterval: 0.12, settleSteps: 40,
    domainPatches: 8, domainRadius: 4, spiralCores: 0, coreRadius: 0, visibleOccupancy: 0.46,
  });
  expect(contract.hero).toMatchObject({
    id: 'hero', stepInterval: 0.11, settleSteps: 90,
    domainPatches: 10, domainRadius: 14, spiralCores: 7, coreRadius: 9, visibleOccupancy: 0.52,
  });
});

test('Paralife worlds are deterministic, dense, isolated, and advance once per call', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop 1440');
  await navigateToGallery(page);

  const result = await page.evaluate(() => {
    const api = (window as any).ParalifeGlyphWorld;
    const options = { cols: 30, rows: 20, seed: 'contract', profile: api.HERO_PROFILE };
    const a = api.createWorld(options);
    const b = api.createWorld(options);
    const beforeB = Array.from(b.species);
    const visibleCandidates = a.occupants.reduce(
      (count: number, occupant: unknown) => count + (occupant === null ? 1 : 0), 0,
    );
    const visibleSpecies = a.displayMask.reduce(
      (count: number, visible: number, index: number) => count + (visible && a.occupants[index] === null ? 1 : 0), 0,
    );
    const occupantKinds = a.occupants.filter(Boolean).map((entry: any) => entry.kind);
    const compositeRoles = a.occupants.filter((entry: any) => entry?.kind === 'composite').map((entry: any) => entry.role);

    api.advanceWorld(a);

    return {
      deterministic: JSON.stringify(beforeB) === JSON.stringify(Array.from(api.createWorld(options).species)),
      dense: Array.from(a.species).every((value: any) => value === 0 || value === 1 || value === 2),
      visibleRatio: visibleSpecies / visibleCandidates,
      occupantKinds,
      compositeRoles,
      revisionA: a.revision,
      revisionB: b.revision,
      bUnchanged: JSON.stringify(beforeB) === JSON.stringify(Array.from(b.species)),
      tickA: a.tick,
    };
  });

  expect(result.deterministic).toBe(true);
  expect(result.dense).toBe(true);
  expect(result.visibleRatio).toBeGreaterThanOrEqual(0.45);
  expect(result.visibleRatio).toBeLessThanOrEqual(0.55);
  expect(new Set(result.occupantKinds)).toEqual(new Set(['rock', 'nutrient', 'bondedPair', 'composite']));
  expect(new Set(result.compositeRoles)).toEqual(new Set([
    'locomotor', 'feeder', 'attacker', 'defender', 'reproducer', 'sensor',
  ]));
  expect(result).toMatchObject({ revisionA: 1, revisionB: 0, bUnchanged: true, tickA: 1 });
});

test('Paralife layers render glyphs, environment washes, and an ageing lightning trail', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop 1440');
  await navigateToGallery(page);

  const result = await page.evaluate(() => {
    const api = (window as any).ParalifeGlyphWorld;
    const world = api.createWorld({ cols: 24, rows: 16, seed: 'layers', profile: api.GALLERY_PROFILE });
    const canvas = document.createElement('canvas');
    canvas.width = 24 * 16;
    canvas.height = 16 * 16;
    const ctx = canvas.getContext('2d')!;
    const snapshot = () => JSON.stringify({
      species: Array.from(world.species),
      next: Array.from(world.next),
      chaosSpecies: Array.from(world.chaosSpecies),
      displayMask: Array.from(world.displayMask),
      thresholds: Array.from(world.thresholds),
      occupants: world.occupants,
      toxin: Array.from(world.toxin),
      mutagen: Array.from(world.mutagen),
      lightning: world.lightning,
      tick: world.tick,
      revision: world.revision,
    });
    const beforeRender = snapshot();
    api.renderWorld(ctx, world, { cellPx: 16, morph: 1, alpha: 1 });
    const renderWasPure = snapshot() === beforeRender;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let coloredPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] || pixels[i + 1] || pixels[i + 2]) coloredPixels++;
    }
    const initialAges = world.lightning.map((entry: any) => entry.age);
    api.advanceWorld(world);
    return {
      coloredPixels,
      renderWasPure,
      toxinCells: Array.from(world.toxin).filter(Number).length,
      mutagenCells: Array.from(world.mutagen).filter((value: any) => value >= 0).length,
      initialAges,
      advancedAges: world.lightning.map((entry: any) => entry.age),
      composite: api.glyphFor('composite', { role: 'attacker', species: 2 }),
      mutagen: api.glyphFor('mutagen', { strain: 3 }),
    };
  });

  expect(result.coloredPixels).toBeGreaterThan(500);
  expect(result.renderWasPure).toBe(true);
  expect(result.toxinCells).toBeGreaterThan(0);
  expect(result.mutagenCells).toBeGreaterThan(0);
  expect(result.initialAges).toEqual([0, 1, 2, 3, 4]);
  expect(result.advancedAges).toEqual([1, 2, 3, 4]);
  expect(result.composite).toEqual({ glyph: '⨳', color: '#3fe0e8' });
  expect(result.mutagen).toEqual({ glyph: '※', color: 'hsla(141,70%,45%,0.4)' });
});

test('the Paralife gallery card paints the roguelike glyph vocabulary', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop 1440');
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    (window as any).__canvasGlyphs = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      (window as any).__canvasGlyphs.push(String(text));
      return original.call(this, text, ...args as [number, number, number?]);
    };
  });
  await navigateToGallery(page);

  const glyphs = new Set<string>(await page.evaluate(() => (window as any).__canvasGlyphs));
  expect(Array.from(glyphs)).toEqual(expect.arrayContaining(['◬', '⊡', '⊙', '✶', '■', '⬩']));
});

test('the Paralife hero paints the shared glyph ecosystem', async ({ page }, testInfo) => {
  test.skip(!['Desktop 1440', 'iPhone SE'].includes(testInfo.project.name));
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    (window as any).__canvasGlyphs = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      (window as any).__canvasGlyphs.push(String(text));
      return original.call(this, text, ...args as [number, number, number?]);
    };
  });
  await navigateToPortfolioPage(page, '/portfolio/paralife/');

  const result = await page.evaluate(() => ({
    apiLoaded: !!(window as any).ParalifeGlyphWorld,
    glyphs: Array.from(new Set((window as any).__canvasGlyphs)) as string[],
  }));
  expect(result.apiLoaded).toBe(true);
  expect(result.glyphs).toEqual(expect.arrayContaining(['◬', '⊡', '⊙', '✶', '■', '⬩']));
});

test('the opening uses glyphs for perception, legend, clients, and the wire inset', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop 1440');
  await navigateToPortfolioPage(page, '/portfolio/paralife/');

  await scrollToProgress(page, 0.30);
  await expect(page.locator('#observed-entity')).toHaveJSProperty('tagName', 'text');
  await expect(page.locator('#observed-entity')).toHaveText(/[◬⊡⊙]/);
  expect(await page.locator('.vision-glyph:visible').count()).toBeGreaterThan(0);

  await scrollToProgress(page, 0.38);
  await expect(page.locator('#legend-layer')).toContainText('◬');
  await expect(page.locator('#legend-layer')).toContainText('⋈');
  await expect(page.locator('#legend-layer')).toContainText('↯');

  await scrollToProgress(page, 0.65);
  await expect(page.locator('.client-node').first()).toHaveJSProperty('tagName', 'text');
  await expect(page.locator('.client-node').first()).toHaveText(/[◬⊡⊙]/);
  expect(await page.locator('#frame-inset .inset-glyph').count()).toBe(25);
});

test('wire inset glyphs and compact entries share one descriptor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop 1440');
  await navigateToPortfolioPage(page, '/portfolio/paralife/');
  await scrollToProgress(page, 0.65);

  const result = await page.locator('#frame-inset .inset-cell[data-entry]').evaluateAll((cells) => {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
    const bytes = document.querySelector('.inset-bytes')?.textContent || '';
    return cells.map((cell) => {
      const entry = cell.getAttribute('data-entry') || '';
      const wireKind = cell.getAttribute('data-wire-kind');
      const envState = Number(cell.getAttribute('data-env-state') || 0);
      const presence = Number(cell.getAttribute('data-presence'));
      return {
        entry,
        shown: bytes.includes(entry),
        presence,
        expectedPresence: (wireKind ? 1 : 0) | (envState ? 2 : 0),
        encodedPresence: alphabet.indexOf(entry.charAt(4)),
        envState,
      };
    });
  });

  const shownCells = result.filter((cell) => cell.shown);
  expect(shownCells.length).toBeGreaterThan(0);
  for (const cell of shownCells) {
    expect(cell.presence).toBe(cell.expectedPresence);
    expect(cell.encodedPresence).toBe(cell.expectedPresence);
    expect([0, 0x02, 0x04]).toContain(cell.envState);
  }
});
