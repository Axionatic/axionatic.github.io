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
  expect((await openingState(page, 0.50)).beat).toBe('emergence');
  expect((await openingState(page, 0.70)).beat).toBe('concurrency');

  expect((await openingState(page, 0.66)).clientPhase).toBe('healthy');
  expect((await openingState(page, 0.72)).clientPhase).toBe('lagging');
  expect((await openingState(page, 0.79)).clientPhase).toBe('stalled');
  expect((await openingState(page, 0.86)).clientPhase).toBe('reconnecting');
  expect((await openingState(page, 0.96)).clientPhase).toBe('recovered');
  expect((await openingState(page, 0.86)).clientPhase).toBe('reconnecting');
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

  for (const [progress, beat] of [[0.10, 'world'], [0.30, 'perception'], [0.50, 'emergence']] as const) {
    await scrollToProgress(page, progress);
    await expect(page.locator('#opening-story')).toHaveAttribute('data-active-beat', beat);
    await expect(page.locator(`.opening-line[data-beat="${beat}"]`)).toHaveCSS('opacity', '1');
  }

  await scrollToProgress(page, 0.30);
  const before = await page.locator('#morph-frame').evaluate((el) => ({
    x: el.getAttribute('x'), y: el.getAttribute('y'),
    width: el.getAttribute('width'), height: el.getAttribute('height'),
  }));
  await page.waitForTimeout(500);
  const sameScrollLater = await page.locator('#morph-frame').evaluate((el) => ({
    x: el.getAttribute('x'), y: el.getAttribute('y'),
    width: el.getAttribute('width'), height: el.getAttribute('height'),
  }));
  expect(sameScrollLater).toEqual(before);
  await scrollToProgress(page, 0.50);
  await expect(page.locator('#morph-frame')).toHaveCSS('opacity', '1');
  await expect(page.locator('#legend-layer')).toHaveCSS('opacity', '1');
  await scrollToProgress(page, 0.30);
  const after = await page.locator('#morph-frame').evaluate((el) => ({
    x: el.getAttribute('x'), y: el.getAttribute('y'),
    width: el.getAttribute('width'), height: el.getAttribute('height'),
  }));
  expect(after).toEqual(before);
});

test('client failure lifecycle is scroll-bound and preserves node identity', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await expect(page.locator('.network-client')).toHaveCount(18);

  const sample = page.locator('.network-client[data-client-id="client-03"]');
  const snapshots: Record<string, { transform: string | null; marker: string | null }> = {};

  for (const [progress, phase] of [[0.72, 'lagging'], [0.79, 'stalled'], [0.86, 'reconnecting'], [0.96, 'recovered']] as const) {
    await scrollToProgress(page, progress);
    await expect(page.locator('#opening-story')).toHaveAttribute('data-client-phase', phase);
    await expect(sample).toHaveAttribute('data-state', phase);
    snapshots[phase] = await sample.evaluate((el) => ({
      transform: el.getAttribute('transform'),
      marker: el.getAttribute('data-identity-marker'),
    }));
  }

  expect(new Set(Object.values(snapshots).map((s) => s.transform)).size).toBe(1);
  expect(new Set(Object.values(snapshots).map((s) => s.marker)).size).toBe(1);

  await scrollToProgress(page, 0.79);
  await expect(sample).toHaveAttribute('data-state', 'stalled');
  await scrollToProgress(page, 0.96);
  await expect(page.locator('#recovery-label')).toHaveCSS('opacity', '1');
});

test('healthy clients remain healthy while affected clients stall', async ({ page }) => {
  await navigateToPortfolioPage(page, PARALIFE_PATH);
  await scrollToProgress(page, 0.79);
  await expect(page.locator('.network-client[data-client-id="client-03"]')).toHaveAttribute('data-state', 'stalled');
  await expect(page.locator('.network-client[data-client-id="client-11"]')).toHaveAttribute('data-state', 'stalled');
  await expect(page.locator('.network-client[data-client-id="client-04"]')).toHaveAttribute('data-state', 'healthy');
  await expect(page.locator('#morph-frame')).toHaveAttribute('data-state', 'healthy');
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
  const cellPx = viewportWidth < 600 ? 12 : 16;
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

  await scrollToProgress(page, 0.50);
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
