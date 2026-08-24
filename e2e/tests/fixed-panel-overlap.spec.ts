import { test, expect } from '@playwright/test';
import {
  PORTFOLIO_PAGES,
  navigateToPortfolioPage,
  type PortfolioPageName,
} from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';
import { rectsOverlap } from '../helpers/geometry';
import { type Page } from '@playwright/test';

/**
 * Issues 4 & 10 — Fixed panels overlap at 375px; z-index stacking obscures nav-btn
 *
 * Multiple fixed elements (#header-panel, #ranking/#dashboard/#pipeline, .nav-btn, #progress-bar)
 * compete for limited screen real estate. At mid-scroll, overlapping panels can obscure
 * the nav-btn so it's not clickable.
 *
 * #header-panel has pointer-events: none, so it never blocks interaction.
 * We skip overlap checks involving non-interactive elements (pointer-events: none).
 */

// Map pages to their fixed interactive panel selectors
const PAGE_PANELS: Record<PortfolioPageName, string[]> = {
  paralife: ['#header-panel', '.nav-btn'],
  jointly: ['#header-panel', '#ranking', '.nav-btn'],
  oasis: ['#header-panel', '#dashboard', '.nav-btn'],
  guestflow: ['#header-panel', '#pipeline', '#narrative-panel', '.nav-btn'],
  mystery: ['#header-panel', '#narrative', '.nav-btn'],
  bitbrush: ['#header-panel', '#demo-panel', '.nav-btn'],
};

const SWEEP_POSITIONS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

interface PanelInfo {
  selector: string;
  box: { x: number; y: number; width: number; height: number; right: number; bottom: number };
  interactive: boolean;
}

async function isInteractive(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    return getComputedStyle(el).pointerEvents !== 'none';
  }, selector);
}

for (const { name, path } of PORTFOLIO_PAGES) {
  test(`${name}: fixed panels do not overlap across scroll sweep`, async ({ page }) => {
    test.setTimeout(60_000);
    await navigateToPortfolioPage(page, path);

    const selectors = PAGE_PANELS[name] || [];
    const violations: string[] = [];

    for (const progress of SWEEP_POSITIONS) {
      await scrollToProgress(page, progress);

      const panels: PanelInfo[] = [];
      for (const sel of selectors) {
        const el = page.locator(sel).first();
        const box = await el.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          panels.push({
            selector: sel,
            box: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              right: box.x + box.width,
              bottom: box.y + box.height,
            },
            interactive: await isInteractive(page, sel),
          });
        }
      }

      for (let i = 0; i < panels.length; i++) {
        for (let j = i + 1; j < panels.length; j++) {
          const a = panels[i];
          const b = panels[j];
          if (!a.interactive || !b.interactive) continue;
          if (rectsOverlap(a.box, b.box)) {
            violations.push(
              `progress=${progress}: ${a.selector} overlaps ${b.selector}`,
            );
          }
        }
      }
    }

    expect(violations, `${name} overlap violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test(`${name}: nav-btn is clickable (not obscured by panels)`, async ({ page }) => {
    await navigateToPortfolioPage(page, path);
    await scrollToProgress(page, 0.5);

    const backLink = page.locator('.nav-btn');
    const box = await backLink.boundingBox();
    if (!box) {
      test.skip();
      return;
    }

    // Check elementFromPoint at the center of the nav-btn
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const topElement = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        // Walk up to find if nav-btn is this element or an ancestor
        let node: Element | null = el;
        while (node) {
          if (node.classList.contains('nav-btn')) return 'nav-btn';
          node = node.parentElement;
        }
        return el.tagName + (el.id ? '#' + el.id : '');
      },
      [centerX, centerY] as const,
    );

    expect(topElement, `${name}: elementFromPoint at nav-btn center should be the nav-btn`).toBe(
      'nav-btn',
    );
  });
}
