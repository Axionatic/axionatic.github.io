import { test, expect } from '@playwright/test';
import { PORTFOLIO_PAGES, navigateToPortfolioPage } from '../helpers/pages';
import { getBox, hasHorizontalOverflow, isContainedInViewport, rectsOverlap } from '../helpers/geometry';
import { scrollToProgress } from '../helpers/scroll';

test.beforeEach(async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) > 600, 'Phone-only regression coverage');
});

test.describe('mobile portfolio navigation menu', () => {
  for (const { name, path } of PORTFOLIO_PAGES) {
    test(`${name}: starts compact and reveals two usable destinations`, async ({ page }) => {
      await navigateToPortfolioPage(page, path);

      const nav = page.locator('[data-portfolio-nav]');
      const toggle = nav.locator('.nav-btn__toggle');
      const actions = nav.locator('.nav-btn__menu');
      const home = actions.getByRole('link', { name: 'Home' });
      const portfolio = actions.getByRole('link', { name: 'Portfolio' });

      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(actions).toBeHidden();
      const toggleBox = await getBox(toggle);
      expect(toggleBox.width).toBeGreaterThanOrEqual(44);
      expect(toggleBox.height).toBeGreaterThanOrEqual(44);
      expect(rectsOverlap(toggleBox, await getBox(page.locator('#header-panel')))).toBe(false);
      expect(rectsOverlap(toggleBox, await getBox(page.locator('#title-overlay')))).toBe(false);

      await toggle.click();

      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(actions).toBeVisible();
      await expect(home).toHaveAttribute('href', '/');
      await expect(portfolio).toHaveAttribute('href', '../');
      for (const link of [home, portfolio]) {
        const linkBox = await getBox(link);
        expect(linkBox.height).toBeGreaterThanOrEqual(44);
        expect(linkBox.width).toBeGreaterThanOrEqual(44);
      }
      const viewport = page.viewportSize()!;
      expect(isContainedInViewport(await getBox(actions), viewport.width, viewport.height)).toBe(true);
      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  }

  test('dismisses on outside tap and Escape, restoring focus after Escape', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/paralife/');
    const nav = page.locator('[data-portfolio-nav]');
    const toggle = nav.locator('.nav-btn__toggle');
    const actions = nav.locator('.nav-btn__menu');

    await toggle.click();
    await page.mouse.click(page.viewportSize()!.width - 8, page.viewportSize()!.height - 8);
    await expect(actions).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(actions).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('resets an open menu when crossing the phone breakpoint', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/paralife/');
    const nav = page.locator('[data-portfolio-nav]');
    const toggle = nav.locator('.nav-btn__toggle');
    const actions = nav.locator('.nav-btn__menu');

    await toggle.click();
    await page.setViewportSize({ width: 650, height: 800 });

    await expect(toggle).toBeHidden();
    await expect(actions).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await page.setViewportSize({ width: 600, height: 800 });
    await expect(toggle).toBeVisible();
    await expect(actions).toBeHidden();
  });

  test('keeps both destinations usable when the menu script does not load', async ({ page }) => {
    await page.route('**/portfolio/portfolio-nav.js', (route) => route.abort());
    await navigateToPortfolioPage(page, '/portfolio/paralife/');

    const nav = page.locator('[data-portfolio-nav]');
    await expect(nav.locator('.nav-btn__toggle')).toBeHidden();
    await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Portfolio' })).toBeVisible();
  });

  test('preserves the existing horizontal sketch navigation pill', async ({ page }) => {
    await page.goto('/sketches/bioluminescence/', { waitUntil: 'domcontentloaded' });

    const navigation = page.getByRole('navigation', { name: 'Navigation' });
    const homeBox = await getBox(navigation.getByRole('link', { name: 'Home' }));
    const backBox = await getBox(navigation.getByRole('link', { name: 'Back' }));
    const navBox = await getBox(navigation);

    expect(navBox.width).toBe(90); // 88px content width + 1px border on each side
    expect(navBox.height).toBe(74); // 72px content height + 1px border on each side
    expect(homeBox.y).toBe(backBox.y);
    expect(backBox.x).toBeGreaterThan(homeBox.x);
  });
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

  test('Oasis keeps mobile narrative timing at the 600px boundary', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
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

  test('Mystery restores its narrative after rotating out of the phone breakpoint', async ({ page }) => {
    await navigateToPortfolioPage(page, '/portfolio/mystery/');
    await scrollToProgress(page, 0.96);
    await expect(page.locator('#narrative')).toHaveCSS('opacity', '0');

    await page.setViewportSize({ width: 667, height: 375 });

    await expect(page.locator('.narrative-line').last()).toHaveCSS('opacity', '1');
    await expect(page.locator('#narrative')).toHaveCSS('opacity', '1');
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

  test('detail demo uses the available space below the restored mobile header', async ({ page }) => {
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
    expect(backgroundAlpha).toBeGreaterThanOrEqual(0.75);
  });
});
