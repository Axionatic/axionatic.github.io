import { test, expect } from '@playwright/test';
import { PORTFOLIO_PAGES, navigateToPortfolioPage } from '../helpers/pages';
import { scrollToProgress } from '../helpers/scroll';
import { minTouchDimension } from '../helpers/geometry';

/**
 * Issue 2 — Touch targets too small
 *
 * WCAG 2.5.8 requires minimum 44px touch target.
 * .pref-btn / .flow-btn base padding gives ~26px height;
 * mobile overrides shrink further to 20–24px.
 */

const MIN_TOUCH_SIZE = 44; // WCAG 2.5.8

const PAGES_WITH_BUTTONS: { name: string; path: string; selector: string }[] = [
  { name: 'jointly', path: '/portfolio/jointly/', selector: '.pref-btn' },
  { name: 'guestflow', path: '/portfolio/guestflow/', selector: '.flow-btn' },
];

for (const { name, path, selector } of PAGES_WITH_BUTTONS) {
  test(`${name}: ${selector} touch targets >= ${MIN_TOUCH_SIZE}px`, async ({ page }) => {
    await navigateToPortfolioPage(page, path);
    await scrollToProgress(page, 0.8);

    const buttons = page.locator(selector);
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      if (!box || box.width === 0) continue; // skip hidden
      const minDim = minTouchDimension({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.x + box.width,
        bottom: box.y + box.height,
      });
      expect(
        minDim,
        `${name} ${selector}[${i}] min dimension is ${minDim}px, needs ${MIN_TOUCH_SIZE}px`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    }
  });
}

// Also check both navigation links on all pages
for (const { name, path } of PORTFOLIO_PAGES) {
  test(`${name}: navigation links have >= ${MIN_TOUCH_SIZE}px touch targets`, async ({ page }) => {
    await navigateToPortfolioPage(page, path);

    const navigation = page.getByRole('navigation', { name: 'Navigation' });
    if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) <= 600) {
      const menuButton = navigation.getByRole('button', { name: 'Navigation menu' });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
    }

    await expect(navigation.getByRole('link')).toHaveCount(2);

    for (const linkName of ['Home', 'Portfolio']) {
      const link = navigation.getByRole('link', { name: linkName, exact: true });
      await expect(link).toBeVisible();

      const box = await link.boundingBox();
      expect(box, `${name} ${linkName} link has no bounding box`).toBeTruthy();
      if (!box) continue;

      const minDim = minTouchDimension({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.x + box.width,
        bottom: box.y + box.height,
      });
      expect(
        minDim,
        `${name} ${linkName} link min dimension is ${minDim}px, needs ${MIN_TOUCH_SIZE}px`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    }
  });
}
