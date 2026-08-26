import { test, expect } from '@playwright/test';
import { PORTFOLIO_PAGES, navigateToPortfolioPage } from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';

/**
 * Issue 1 — Tooltip touch inaccessible
 *
 * Ranking/pipeline bars use mouseenter/mouseleave only.
 * Mobile users with touch can never see tooltips.
 *
 * Only jointly shows visible ranking bars at runtime.
 * Mystery hides ranking (canvas-drawn matrix replaces it).
 * Guestflow pipeline animation is disabled (commented out).
 */

const PAGES_WITH_TOOLTIPS: { name: string; path: string; barSelector: string }[] = [
  { name: 'jointly', path: '/portfolio/jointly/', barSelector: '.ranking-bar' },
];

for (const { name, path, barSelector } of PAGES_WITH_TOOLTIPS) {
  test(`${name}: tooltip appears on touch tap`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'touch-capable profiles only');

    await navigateToPortfolioPage(page, path);
    // Scroll to ~0.8 progress to reveal ranking bars
    await scrollToProgress(page, 0.8);

    const bars = page.locator(barSelector);
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThan(0);

    // Find first visible bar
    let targetBar = bars.first();
    for (let i = 0; i < barCount; i++) {
      const box = await bars.nth(i).boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        targetBar = bars.nth(i);
        break;
      }
    }

    // Tap (touch event) on the bar
    await targetBar.tap({ force: true });

    // Assert tooltip becomes visible
    const tooltip = page.locator('#tooltip');
    await expect(tooltip).toHaveClass(/visible/, { timeout: 2000 });
  });
}
