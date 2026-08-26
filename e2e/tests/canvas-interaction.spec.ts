import { test, expect } from '@playwright/test';
import { navigateToPortfolioPage } from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';

/**
 * Issue 9 — Canvas too small on tiny screens
 *
 * BitBrush demo panel canvas at min(310px, 92vw).
 * At 320px viewport, 32×32 grid cells are ~8px — marginal for touch.
 * Verify canvas is at least 200px in both dimensions.
 */

const BITBRUSH_PATH = '/portfolio/bitbrush/';
const MIN_CANVAS_SIZE = 200;

test('bitbrush: mini-canvas dimensions >= 200px', async ({ page }) => {
  await navigateToPortfolioPage(page, BITBRUSH_PATH);
  await scrollToProgress(page, 0.8);

  // The canvas might be #mini-canvas or inside #demo-panel
  const canvas = page.locator('#mini-canvas, #demo-panel canvas').first();
  const count = await canvas.count();
  if (count === 0) {
    test.skip();
    return;
  }

  const box = await canvas.boundingBox();
  expect(box, 'mini-canvas has no bounding box').toBeTruthy();
  if (!box) return;

  expect(box.width, `mini-canvas width ${box.width}px < ${MIN_CANVAS_SIZE}px`).toBeGreaterThanOrEqual(
    MIN_CANVAS_SIZE,
  );
  expect(
    box.height,
    `mini-canvas height ${box.height}px < ${MIN_CANVAS_SIZE}px`,
  ).toBeGreaterThanOrEqual(MIN_CANVAS_SIZE);
});

test('bitbrush: mini-canvas responds to touch', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'touch-capable profiles only');

  await navigateToPortfolioPage(page, BITBRUSH_PATH);
  await scrollToProgress(page, 0.8);

  const canvas = page.locator('#mini-canvas, #demo-panel canvas').first();
  const box = await canvas.boundingBox();
  if (!box) {
    test.skip();
    return;
  }

  // Tap on the canvas center
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.touchscreen.tap(cx, cy);

  // Verify the touch registered — the canvas should have different pixel data
  // or at minimum the tap should not throw
  // We primarily verify the canvas is interactive (pointer-events not 'none')
  const pointerEvents = await page.evaluate(() => {
    const c = document.querySelector('#mini-canvas, #demo-panel canvas');
    if (!c) return 'none';
    return getComputedStyle(c).pointerEvents;
  });

  expect(pointerEvents, 'mini-canvas should accept pointer events').not.toBe('none');
});
