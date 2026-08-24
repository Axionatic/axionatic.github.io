import { type Page } from '@playwright/test';

export const PORTFOLIO_PAGES = [
  { name: 'paralife', path: '/portfolio/paralife/' },
  { name: 'jointly', path: '/portfolio/jointly/' },
  { name: 'oasis', path: '/portfolio/oasis/' },
  { name: 'guestflow', path: '/portfolio/guestflow/' },
  { name: 'mystery', path: '/portfolio/mystery/' },
  { name: 'bitbrush', path: '/portfolio/bitbrush/' },
] as const;

export type PortfolioPageName = (typeof PORTFOLIO_PAGES)[number]['name'];

export const GALLERY_PATH = '/portfolio/';

/** Navigate to a portfolio page and wait for GSAP ScrollTrigger to initialise. */
export async function navigateToPortfolioPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // Wait for GSAP to register ScrollTrigger (all pages do this in DOMContentLoaded → init)
  await page.waitForFunction(() => {
    const st = (window as any).ScrollTrigger;
    return st && st.getAll && st.getAll().length > 0;
  }, { timeout: 10_000 }).catch(() => {
    // Some pages may not have ScrollTrigger — proceed anyway
  });
  // One rAF to let layout settle
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

/** Navigate to the portfolio gallery page. */
export async function navigateToGallery(page: Page) {
  await page.goto(GALLERY_PATH, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => new Promise(requestAnimationFrame));
}
