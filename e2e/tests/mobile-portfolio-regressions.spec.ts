import { test, expect } from '@playwright/test';
import { PORTFOLIO_PAGES, navigateToPortfolioPage } from '../helpers/pages';
import { getBox, rectsOverlap } from '../helpers/geometry';
import { scrollToProgress, scrollToTechSection } from '../helpers/scroll';

test.beforeEach(async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) > 600, 'Phone-only regression coverage');
});

test.describe('mobile portfolio top bar', () => {
  for (const { name, path } of PORTFOLIO_PAGES) {
    test(`${name}: navigation and project identity share a collision-free top bar`, async ({ page }) => {
      await navigateToPortfolioPage(page, path);

      const nav = page.locator('.nav-btn--pill');
      const links = nav.locator('.nav-btn__link');
      const header = page.locator('#header-panel');
      const navBox = await getBox(nav);
      const headerBox = await getBox(header);
      const firstLinkBox = await getBox(links.nth(0));
      const secondLinkBox = await getBox(links.nth(1));

      expect(firstLinkBox.y).toBeCloseTo(secondLinkBox.y, 0);
      expect(firstLinkBox.width).toBeGreaterThanOrEqual(44);
      expect(firstLinkBox.height).toBeGreaterThanOrEqual(44);
      expect(secondLinkBox.width).toBeGreaterThanOrEqual(44);
      expect(secondLinkBox.height).toBeGreaterThanOrEqual(44);
      expect(rectsOverlap(navBox, headerBox)).toBe(false);
      expect(Math.abs(navBox.y - headerBox.y)).toBeLessThanOrEqual(2);

      await scrollToTechSection(page);
      await expect(header).toHaveCSS('position', 'fixed');
      expect(rectsOverlap(await getBox(nav), await getBox(header))).toBe(false);
    });
  }
});

test.describe('Paralife phone choreography', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/paralife/');
  });

  test('PARA64 readout accompanies Perception, not Concurrency', async ({ page }) => {
    await scrollToProgress(page, 0.22);
    await expect(page.locator('#frame-inset')).toHaveCSS('opacity', '1');

    await scrollToProgress(page, 0.68);
    await expect(page.locator('#frame-inset')).toHaveCSS('opacity', '0');
  });

  test('Emergence copy does not cover the species legend', async ({ page }) => {
    await scrollToProgress(page, 0.40);
    const copy = await getBox(page.locator('[data-beat="emergence"]'));
    const legend = await getBox(page.locator('#legend-surface'));
    expect(rectsOverlap(copy, legend)).toBe(false);
  });

  test('Concurrency keeps a compact network story', async ({ page }) => {
    await scrollToProgress(page, 0.68);

    await expect(page.locator('#durability-title')).toHaveCSS('display', 'none');
    const visibleClients = await page.locator('.network-client').evaluateAll((clients) =>
      clients.filter((client) => getComputedStyle(client).display !== 'none').length,
    );
    expect(visibleClients).toBeLessThanOrEqual(12);
  });
});

test.describe('phone narrative handoffs', () => {
  test('Oasis finishes its final line before revealing the dashboard', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/oasis/');
    await scrollToProgress(page, 0.82);

    const finalLineOpacity = await page.locator('.narrative-line').last().evaluate((line) =>
      Number(getComputedStyle(line).opacity),
    );
    const dashboardOpacity = await page.locator('#dashboard').evaluate((dashboard) =>
      Number(getComputedStyle(dashboard).opacity),
    );
    expect(finalLineOpacity).toBeGreaterThanOrEqual(0.8);
    expect(dashboardOpacity).toBeLessThanOrEqual(0.05);
  });

  test('Mystery reserves three lines for every narrative message', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/mystery/');

    const dimensions = await page.locator('#narrative').evaluate((panel) => {
      const panelStyle = getComputedStyle(panel);
      const lineStyle = getComputedStyle(panel.querySelector('.narrative-line')!);
      return {
        height: panel.getBoundingClientRect().height,
        required:
          Number.parseFloat(lineStyle.lineHeight) * 3 +
          Number.parseFloat(panelStyle.paddingTop) +
          Number.parseFloat(panelStyle.paddingBottom),
      };
    });
    expect(dimensions.height).toBeGreaterThanOrEqual(dimensions.required - 1);
  });

  test('Mystery keeps its final line readable before the solver handoff', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/mystery/');
    await scrollToProgress(page, 0.88);

    const opacity = await page.locator('.narrative-line').last().evaluate((line) =>
      Number(getComputedStyle(line).opacity),
    );
    expect(opacity).toBeGreaterThanOrEqual(0.8);

    await scrollToProgress(page, 0.96);
    await expect(page.locator('#narrative')).toHaveCSS('opacity', '0');
  });
});

test.describe('Guestflow phone layout', () => {
  test('narrative reserves three lines above the scroll hint', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/guestflow/');

    const panel = page.locator('#narrative-panel');
    const dimensions = await panel.evaluate((element) => {
      const panelStyle = getComputedStyle(element);
      const lineStyle = getComputedStyle(element.querySelector('.narrative-line')!);
      return {
        height: element.getBoundingClientRect().height,
        required:
          Number.parseFloat(lineStyle.lineHeight) * 3 +
          Number.parseFloat(panelStyle.paddingTop) +
          Number.parseFloat(panelStyle.paddingBottom),
      };
    });
    const panelBox = await getBox(panel);
    const hintBox = await getBox(page.locator('#scroll-hint'));

    expect(dimensions.height).toBeGreaterThanOrEqual(dimensions.required - 1);
    expect(hintBox.y - panelBox.bottom).toBeGreaterThanOrEqual(8);
  });

  test('background uses six targets in a 2 by 3 grid', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/guestflow/');
    const canvas = page.locator('#canvas-container canvas');

    await expect(canvas).toHaveAttribute('data-site-layout', '2x3');
    await expect(canvas).toHaveAttribute('data-site-count', '6');
  });

  test('Guestflow describes customers consistently as hosts', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/guestflow/');
    const pageText = (await page.locator('body').innerText()).toLowerCase();
    expect(pageText).not.toMatch(/\b(client|tenant)s?\b/);
    expect(pageText).toContain('one worker per host');

    await page.goto('/portfolio/');
    const tagline = await page.locator('[data-project="guestflow"] .tagline').innerText();
    expect(tagline.toLowerCase()).not.toMatch(/\b(client|tenant)s?\b/);
    expect(tagline).toBe('Multi-host direct booking platform');
  });
});

test.describe('BitBrush phone containment', () => {
  test('homepage prioritises the complete widget over the redundant tagline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.bitbrush-widget-tagline')).toHaveCSS('display', 'none');
    await expect(page.locator('.bitbrush-widget-content')).toHaveCSS('justify-content', 'flex-start');

    const fits = await page.locator('.bitbrush-widget-content').evaluate((panel) => {
      const container = panel.querySelector('#bitbrush-container') as HTMLElement;
      container.replaceChildren();
      container.style.height = '450px';
      return panel.scrollHeight <= panel.clientHeight + 1;
    });
    expect(fits).toBe(true);
  });

  test('detail demo uses the available space below the mobile top bar', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/bitbrush/');
    const demo = page.locator('#demo-panel');
    await demo.locator('#bitbrush-container').evaluate((container) => {
      const fixture = document.createElement('div');
      fixture.style.height = '480px';
      container.replaceChildren(fixture);
    });

    const headerBox = await getBox(page.locator('#header-panel'));
    const demoBox = await getBox(demo);
    const viewportHeight = page.viewportSize()!.height;
    const scrolls = await demo.evaluate((panel) => panel.scrollHeight > panel.clientHeight + 1);
    const backgroundAlpha = await page.locator('#header-panel').evaluate((header) => {
      const match = getComputedStyle(header).backgroundColor.match(/[\d.]+/g);
      return match && match.length === 4 ? Number(match[3]) : 1;
    });

    expect(demoBox.y).toBeGreaterThanOrEqual(headerBox.bottom + 8);
    expect(demoBox.bottom).toBeLessThanOrEqual(viewportHeight - 8);
    expect(scrolls).toBe(false);
    expect(backgroundAlpha).toBeGreaterThanOrEqual(0.85);
  });
});
