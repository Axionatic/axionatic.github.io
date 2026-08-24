import { test, expect } from '@playwright/test';
import {
  PORTFOLIO_PAGES,
  navigateToPortfolioPage,
  type PortfolioPageName,
} from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';
import { isElementVisible, isContainedInViewport, hasHorizontalOverflow, rectsOverlap } from '../helpers/geometry';
import { type Page } from '@playwright/test';

/**
 * Dense scroll-sweep overlap & containment tests.
 *
 * For each portfolio page, scroll through 11 positions (0.0–1.0 in 0.1 steps)
 * and verify:
 * - No AABB overlap between visible interactive elements
 * - Each visible element is contained within the viewport (±2px)
 * - No horizontal page overflow
 */

const INTERACTIVE_ELEMENTS: Record<PortfolioPageName, string[]> = {
  paralife: ['.nav-btn'],
  jointly: ['.nav-btn', '#ranking'],
  oasis: ['.nav-btn', '#dashboard'],
  mystery: ['.nav-btn'],
  guestflow: ['.nav-btn', '#narrative-panel'],
  bitbrush: ['.nav-btn', '#demo-panel'],
};

const CONTAINMENT_ELEMENTS: Record<PortfolioPageName, string[]> = {
  paralife: ['#header-panel', '#title-overlay', '.nav-btn', '#opening-story', '#opening-visuals'],
  jointly: ['#header-panel', '#title-overlay', '.nav-btn', '#ranking', '#narrative'],
  oasis: ['#header-panel', '#title-overlay', '.nav-btn', '#dashboard'],
  mystery: ['#header-panel', '#title-overlay', '.nav-btn', '#narrative'],
  guestflow: ['#header-panel', '#title-overlay', '.nav-btn', '#narrative-panel'],
  bitbrush: ['#header-panel', '#title-overlay', '.nav-btn', '#demo-panel'],
};

const PROGRESS_STEPS = Array.from({ length: 11 }, (_, i) => +(i * 0.1).toFixed(1));

interface ElementBox {
  selector: string;
  box: { x: number; y: number; width: number; height: number; right: number; bottom: number };
}

async function getVisibleElementBoxes(page: Page, selectors: string[]): Promise<ElementBox[]> {
  const results: ElementBox[] = [];
  for (const sel of selectors) {
    const visible = await isElementVisible(page, sel);
    if (!visible) continue;
    const bb = await page.locator(sel).first().boundingBox();
    if (!bb || bb.width <= 0 || bb.height <= 0) continue;
    results.push({
      selector: sel,
      box: {
        x: bb.x,
        y: bb.y,
        width: bb.width,
        height: bb.height,
        right: bb.x + bb.width,
        bottom: bb.y + bb.height,
      },
    });
  }
  return results;
}

for (const { name, path } of PORTFOLIO_PAGES) {
  test(`${name}: no interactive overlap or viewport escape across full scroll sweep`, async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToPortfolioPage(page, path);

    const viewport = page.viewportSize()!;
    const interactiveSelectors = INTERACTIVE_ELEMENTS[name] ?? [];
    const containmentSelectors = CONTAINMENT_ELEMENTS[name] ?? [];
    const violations: string[] = [];

    for (const progress of PROGRESS_STEPS) {
      await scrollToProgress(page, progress);

      // Check interactive element overlap
      const interactive = await getVisibleElementBoxes(page, interactiveSelectors);
      for (let i = 0; i < interactive.length; i++) {
        for (let j = i + 1; j < interactive.length; j++) {
          const a = interactive[i];
          const b = interactive[j];
          if (rectsOverlap(a.box, b.box)) {
            violations.push(
              `${name} at progress=${progress}: ${a.selector} overlaps ${b.selector}`,
            );
          }
        }
      }

      // Check viewport containment
      const containment = await getVisibleElementBoxes(page, containmentSelectors);
      for (const el of containment) {
        if (!isContainedInViewport(el.box, viewport.width, viewport.height)) {
          violations.push(
            `${name} at progress=${progress}: ${el.selector} escapes viewport ` +
            `(box: ${Math.round(el.box.x)},${Math.round(el.box.y)} ${Math.round(el.box.width)}×${Math.round(el.box.height)}, ` +
            `viewport: ${viewport.width}×${viewport.height})`,
          );
        }
      }

      // Check horizontal overflow
      if (await hasHorizontalOverflow(page)) {
        violations.push(
          `${name} at progress=${progress}: page has horizontal overflow`,
        );
      }
    }

    expect(violations, `Overlap/containment violations:\n${violations.join('\n')}`).toHaveLength(0);
  });
}
