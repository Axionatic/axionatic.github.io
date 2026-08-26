import { test, expect } from '@playwright/test';
import {
  PORTFOLIO_PAGES,
  navigateToPortfolioPage,
  type PortfolioPageName,
} from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';
import { isElementVisible } from '../helpers/geometry';
import {
  prepareDeterministicVisualPage,
  scrollToDeterministicProgress,
  VISUAL_POSITIONS,
  VISUAL_PROJECTS,
} from '../helpers/visual';

/**
 * Visual regression baselines + panel visibility timing checks.
 *
 * Takes deterministic screenshots at representative scroll positions and profiles.
 * Also verifies panel show/hide timing at key morph progress points.
 */

/** Panels that should be hidden early and visible late in the scroll. */
const PAGE_PANELS: Record<PortfolioPageName, string[]> = {
  paralife: [],
  jointly: ['#ranking'],
  oasis: ['#dashboard'],
  mystery: [],
  guestflow: [],
  bitbrush: ['#demo-panel'],
};

for (const { name, path } of PORTFOLIO_PAGES) {
  test(`${name}: visual regression at key scroll positions`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(!VISUAL_PROJECTS.includes(testInfo.project.name), 'representative visual profiles only');
    await prepareDeterministicVisualPage(page, path);

    for (const progress of VISUAL_POSITIONS) {
      await scrollToDeterministicProgress(page, progress);
      await expect.soft(page).toHaveScreenshot(
        `${name}-progress-${progress}.png`,
        { animations: 'disabled', maxDiffPixelRatio: 0.02 },
      );
    }
  });

  test(`${name}: panel visibility timing`, async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToPortfolioPage(page, path);

    const panels = PAGE_PANELS[name] ?? [];
    const violations: string[] = [];

    // Panels should be hidden at progress 0.0
    await scrollToProgress(page, 0.0);
    for (const sel of panels) {
      if (await isElementVisible(page, sel)) {
        violations.push(`${name}: ${sel} should be hidden at progress=0.0`);
      }
    }

    // Panels should be hidden at progress 0.3
    await scrollToProgress(page, 0.3);
    for (const sel of panels) {
      if (await isElementVisible(page, sel)) {
        violations.push(`${name}: ${sel} should be hidden at progress=0.3`);
      }
    }

    // Panels should be visible at progress 0.8 (for pages that have them)
    await scrollToProgress(page, 0.8);
    for (const sel of panels) {
      if (!(await isElementVisible(page, sel))) {
        violations.push(`${name}: ${sel} should be visible at progress=0.8`);
      }
    }

    // #scroll-hint should be visible at 0.0 and hidden at 0.1+
    await scrollToProgress(page, 0.0);
    const hintVisibleAt0 = await isElementVisible(page, '#scroll-hint');
    if (!hintVisibleAt0) {
      violations.push(`${name}: #scroll-hint should be visible at progress=0.0`);
    }

    await scrollToProgress(page, 0.1);
    const hintVisibleAt01 = await isElementVisible(page, '#scroll-hint');
    if (hintVisibleAt01) {
      violations.push(`${name}: #scroll-hint should be hidden at progress=0.1`);
    }

    expect(violations, `Visibility timing violations:\n${violations.join('\n')}`).toHaveLength(0);
  });
}
