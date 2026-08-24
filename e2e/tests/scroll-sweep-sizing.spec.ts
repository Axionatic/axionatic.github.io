import { test, expect } from '@playwright/test';
import {
  PORTFOLIO_PAGES,
  navigateToPortfolioPage,
  type PortfolioPageName,
} from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';
import { isElementVisible } from '../helpers/geometry';

/**
 * Dense scroll-sweep sizing tests.
 *
 * For each portfolio page, scroll through 11 positions (0.0–1.0 in 0.1 steps)
 * and verify that every visible tracked element has sane dimensions:
 * - width and height > 0
 * - width ≤ viewport width
 * - height ≤ viewport height
 * - #title-overlay width ≥ 60px when visible
 */

const TRACKED_ELEMENTS: Record<PortfolioPageName, string[]> = {
  paralife: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#opening-story', '#opening-visuals'],
  jointly: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#ranking', '#narrative'],
  oasis: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#dashboard'],
  mystery: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#narrative'],
  guestflow: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#narrative-panel'],
  bitbrush: ['#header-panel', '#title-overlay', '#scroll-hint', '.nav-btn', '#demo-panel'],
};

const PROGRESS_STEPS = Array.from({ length: 11 }, (_, i) => +(i * 0.1).toFixed(1));
for (const { name, path } of PORTFOLIO_PAGES) {
  test(`${name}: element sizing is sane across full scroll sweep`, async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToPortfolioPage(page, path);

    const viewport = page.viewportSize()!;
    const selectors = TRACKED_ELEMENTS[name] ?? [];
    const violations: string[] = [];

    for (const progress of PROGRESS_STEPS) {
      await scrollToProgress(page, progress);

      for (const sel of selectors) {
        const visible = await isElementVisible(page, sel);
        if (!visible) continue;

        const box = await page.locator(sel).first().boundingBox();
        if (!box) continue;

        if (box.width <= 0 || box.height <= 0) {
          violations.push(
            `${name} at progress=${progress}: ${sel} collapsed (${box.width}×${box.height})`,
          );
        }

        if (box.width > viewport.width + 2) {
          violations.push(
            `${name} at progress=${progress}: ${sel} width (${Math.round(box.width)}px) exceeds viewport (${viewport.width}px)`,
          );
        }

        if (box.height > viewport.height + 2) {
          violations.push(
            `${name} at progress=${progress}: ${sel} height (${Math.round(box.height)}px) exceeds viewport (${viewport.height}px)`,
          );
        }

        if (sel === '#title-overlay' && box.width < 60) {
          violations.push(
            `${name} at progress=${progress}: ${sel} width (${Math.round(box.width)}px) below readable minimum (60px)`,
          );
        }
      }
    }

    expect(violations, `Sizing violations:\n${violations.join('\n')}`).toHaveLength(0);
  });
}
