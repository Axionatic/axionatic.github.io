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
