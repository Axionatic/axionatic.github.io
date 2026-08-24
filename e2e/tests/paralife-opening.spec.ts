import { test, expect, type Page } from '@playwright/test';
import { navigateToPortfolioPage } from '../helpers/pages';
import { scrollToProgress, scrollToTechSection } from '../helpers/scroll';

const PARALIFE_PATH = '/portfolio/paralife/';

async function openingState(page: Page, progress: number, reducedMotion = false) {
  return page.evaluate(
    ({ p, reduced }) => (window as any).ParalifeOpening.deriveState(p, reduced),
    { p: progress, reduced: reducedMotion },
  );
}

test('opening exposes the approved semantic narrative and no legacy HUD', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  await expect(page.locator('#opening-story .opening-line')).toHaveText([
    'Three species locked in a rock-paper-scissors battle for survival.',
    'Every entity acts independently, seeing only what lies within reach.',
    'Simple local rules become spiral waves, shifting niches and population cycles.',
    'They act concurrently, but the world must advance as one coherent reality.',
  ]);
  await expect(page.locator('#opening-visuals')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#hud')).toHaveCount(0);
  await expect(page.getByText('one entity — one socket')).toHaveCount(0);
});

test('opening state uses unequal beats and scroll-bound client phases', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  expect((await openingState(page, 0.10)).beat).toBe('world');
  expect((await openingState(page, 0.30)).beat).toBe('perception');
  expect((await openingState(page, 0.40)).beat).toBe('emergence');
  expect((await openingState(page, 0.70)).beat).toBe('concurrency');

  expect((await openingState(page, 0.55)).clientPhase).toBe('healthy');
  expect((await openingState(page, 0.65)).clientPhase).toBe('stalled');
  expect((await openingState(page, 0.80)).clientPhase).toBe('reconnecting');
  expect((await openingState(page, 0.90)).clientPhase).toBe('recovered');
  expect((await openingState(page, 0.65)).clientPhase).toBe('stalled');
});

test('first three beats morph through one shared frame and reverse cleanly', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  await scrollToProgress(page, 0.10);
  const fieldStart = await page.locator('.opening-line[data-beat="world"]').evaluate(
    (el) => getComputedStyle(el).transform,
  );
  await scrollToProgress(page, 0.17);
  const fieldCompressed = await page.locator('.opening-line[data-beat="world"]').evaluate(
    (el) => getComputedStyle(el).transform,
  );
  expect(fieldCompressed).not.toBe(fieldStart);

  for (const [progress, beat] of [[0.10, 'world'], [0.22, 'perception'], [0.38, 'emergence']] as const) {
    await scrollToProgress(page, progress);
    await expect(page.locator('#opening-story')).toHaveAttribute('data-active-beat', beat);
    await expect(page.locator(`.opening-line[data-beat="${beat}"]`)).toHaveCSS('opacity', '1');
  }

  await scrollToProgress(page, 0.30);
  const readFrame = () => page.locator('#morph-frame').evaluate((el) => ({
    x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')),
    width: Number(el.getAttribute('width')), height: Number(el.getAttribute('height')),
  }));
  const before = await readFrame();
  await page.waitForTimeout(500);
  const sameScrollLater = await readFrame();
  // Frame size is a pure function of scroll; its position now tracks the
  // observed entity, which roams within its window (~±0.18 of the width).
  expect(sameScrollLater.width).toBe(before.width);
  expect(sameScrollLater.height).toBe(before.height);
  expect(Math.abs(sameScrollLater.x - before.x)).toBeLessThanOrEqual(before.width);
  expect(Math.abs(sameScrollLater.y - before.y)).toBeLessThanOrEqual(before.width);
  await scrollToProgress(page, 0.40);
  await expect(page.locator('#morph-frame')).toHaveCSS('opacity', '1');
  await expect(page.locator('#legend-layer')).toHaveCSS('opacity', '1');
  await scrollToProgress(page, 0.30);
  const after = await readFrame();
  // Scrubbing away and back restores the scroll-driven size and drift band.
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(before.width);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(before.width);
});

test('durability follows scroll forward and reverse while preserving node identity', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  const w = page.viewportSize()!.width;
  const expectedClients = Math.max(16, Math.min(30, Math.round(w / 52)));
  const node = page.locator('.network-client[data-client-id="client-03"]');
  const marker = await node.getAttribute('data-identity-marker');
  const glyph = await node.locator('.client-node').textContent();

  for (const [progress, phase] of [[0.55, 'healthy'], [0.65, 'stalled'], [0.80, 'reconnecting'], [0.90, 'recovered'], [0.65, 'stalled']] as const) {
    await scrollToProgress(page, progress);
    await expect(page.locator('#opening-story')).toHaveAttribute('data-client-phase', phase);
    await expect(node).toHaveAttribute('data-state', phase);
    await expect(node).toHaveAttribute('data-identity-marker', marker!);
    await expect(node.locator('.client-node')).toHaveText(glyph!);
  }
  expect(await page.locator('.network-client:visible').count()).toBe(expectedClients);
});

test('packet motion keeps its autonomous clock at a fixed scroll position', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.65);

  const healthyPacket = page.locator('.wire-packet').nth(4);
  await expect.poll(async () => Number(await healthyPacket.evaluate((packet) => getComputedStyle(packet).opacity))).toBe(1);
  const before = await healthyPacket.evaluate((packet) => `${packet.getAttribute('cx')},${packet.getAttribute('cy')}`);
  await expect.poll(async () => healthyPacket.evaluate((packet) =>
    getComputedStyle(packet).opacity === '1'
      ? `${packet.getAttribute('cx')},${packet.getAttribute('cy')}`
      : before
  )).not.toBe(before);
  await expect(page.locator('#opening-story')).toHaveAttribute('data-client-phase', 'stalled');
});

test('only the protagonist connection stalls; the rest stay healthy', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.65);

  const states = await page.evaluate(() => {
    const s = (id: string) => document.querySelector(`.network-client[data-client-id="${id}"]`)?.getAttribute('data-state');
    return { c3: s('client-03'), c4: s('client-04'), c11: s('client-11'), frame: document.getElementById('morph-frame')?.getAttribute('data-state') };
  });
  expect(states.c3).toBe('stalled');
  expect(states.c4).toBe('healthy');
  expect(states.c11).toBe('healthy');
  expect(states.frame).toBe('healthy');
});

test('concurrency copy is left of the network on desktop and above it on mobile', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.86);

  const copy = await page.locator('.opening-line[data-beat="concurrency"]').boundingBox();
  const server = await page.locator('#morph-frame[data-role="server"]').boundingBox();
  expect(copy).not.toBeNull();
  expect(server).not.toBeNull();
  if (page.viewportSize()!.width > 800) {
    expect(copy!.x + copy!.width).toBeLessThan(server!.x);
  } else {
    expect(copy!.y + copy!.height).toBeLessThan(server!.y);
  }
});

test('opening content sits on localized translucent surfaces', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  const copySurface = await page.locator('.opening-line[data-beat="world"]').evaluate((line) => {
    const style = getComputedStyle(line, '::before');
    return { background: style.backgroundColor, backdropFilter: style.backdropFilter };
  });
  expect(copySurface.background).toMatch(/rgba\([^)]*, 0\.[6-9]/);
  expect(copySurface.backdropFilter).toContain('blur');

  await scrollToProgress(page, 0.40);
  const legendSurface = page.locator('#legend-surface');
  const legendFrame = page.locator('#morph-frame');
  await expect(legendSurface).toBeVisible();
  const [surfaceBox, frameBox] = await Promise.all([
    legendSurface.boundingBox(),
    legendFrame.boundingBox(),
  ]);
  expect(surfaceBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  expect(Math.abs(surfaceBox!.x - frameBox!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(surfaceBox!.y - frameBox!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(surfaceBox!.width - frameBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(surfaceBox!.height - frameBox!.height)).toBeLessThanOrEqual(2);

  await scrollToProgress(page, 0.65);
  await expect(page.locator('#network-surface')).toBeVisible();
  await expect(page.locator('#inset-surface')).toBeVisible();
});

test('responsive narrative geometry clears chrome and stays inside its visual frame', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);

  await scrollToProgress(page, 0.30);
  const perceptionCopy = await page.locator('.opening-line[data-beat="perception"]').boundingBox();
  const perceptionFrame = await page.locator('#morph-frame').boundingBox();
  const header = await page.locator('#header-panel').boundingBox();
  const nav = await page.locator('.nav-btn').boundingBox();
  expect(perceptionCopy).not.toBeNull();
  expect(perceptionFrame).not.toBeNull();
  expect(header).not.toBeNull();
  expect(nav).not.toBeNull();

  // The dashed frame hugs the actual vision window: (2*5+1) cells square.
  const viewportWidth = page.viewportSize()!.width;
  const cellPx = viewportWidth < 600 ? 16 : 18;
  const windowPx = 11 * cellPx;
  expect(Math.abs(perceptionFrame!.width - windowPx)).toBeLessThanOrEqual(2);
  expect(Math.abs(perceptionFrame!.height - windowPx)).toBeLessThanOrEqual(2);

  // As many windows as fit the viewport: 1 on mobile, several on desktop.
  const windowCount = Number(await page.locator('#opening-story').getAttribute('data-vision-windows'));
  if (viewportWidth > 800) {
    expect(windowCount).toBeGreaterThanOrEqual(2);
  } else {
    expect(windowCount).toBe(1);
  }
  await expect(page.locator('.vision-frame:visible')).toHaveCount(windowCount - 1);

  // Copy sits clear of the window, below the band.
  expect(perceptionCopy!.y).toBeGreaterThanOrEqual(perceptionFrame!.y + perceptionFrame!.height - 2);
  expect(perceptionFrame!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 2);
  const frameOverlapsNav = !(
    perceptionFrame!.x + perceptionFrame!.width <= nav!.x ||
    perceptionFrame!.x >= nav!.x + nav!.width ||
    perceptionFrame!.y + perceptionFrame!.height <= nav!.y ||
    perceptionFrame!.y >= nav!.y + nav!.height
  );
  expect(frameOverlapsNav).toBe(false);

  await scrollToProgress(page, 0.40);
  const legend = await page.locator('#legend-layer').boundingBox();
  const legendFrame = await page.locator('#morph-frame').boundingBox();
  expect(legend).not.toBeNull();
  expect(legendFrame).not.toBeNull();
  expect(legend!.x).toBeGreaterThanOrEqual(legendFrame!.x - 2);
  expect(legend!.y).toBeGreaterThanOrEqual(legendFrame!.y - 2);
  expect(legend!.x + legend!.width).toBeLessThanOrEqual(legendFrame!.x + legendFrame!.width + 2);
  expect(legend!.y + legend!.height).toBeLessThanOrEqual(legendFrame!.y + legendFrame!.height + 2);
});

test('reduced motion shows static stalled and recovered examples', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.86);

  await expect(page.locator('#opening-story')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('#opening-story')).toHaveAttribute('data-client-phase', 'static');
  await expect(page.locator('.network-client[data-client-id="client-03"]')).toHaveAttribute('data-state', 'stalled');
  await expect(page.locator('.network-client[data-client-id="client-11"]')).toHaveAttribute('data-state', 'recovered');
  await expect(page.locator('#legend-layer')).not.toContainText(/\d+%|\d+ entities/);
});

test('opening hands off without changing technical content', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToTechSection(page);

  await expect(page.locator('#opening-story')).toBeHidden();
  await expect(page.locator('#opening-visuals')).toBeHidden();
  await expect(page.locator('#tech-content .row-title')).toHaveText([
    'One writer, a thousand readers',
    'The deadlock that taught me Loom',
    "Slow clients don't get to win",
    'Proving a rewrite changed nothing',
  ]);
  await expect(page.locator('#tech-content .row')).toHaveCount(4);
});
