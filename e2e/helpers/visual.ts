import { type Page } from '@playwright/test';

const VISUAL_EPOCH = new Date('2026-01-01T00:00:00.000Z');
const VISUAL_SEED = 0x5eed1234;
const INITIAL_SETTLE_MS = 100;
const SCROLL_SETTLE_MS = 1000;
const FRAME_MS = 16;

export const VISUAL_PROJECTS: readonly string[] = [
  'iPhone SE',
  'iPad Mini',
  'Laptop 900',
  'Desktop 1440',
];

export const VISUAL_POSITIONS = [0, 0.3, 0.5, 0.8, 1] as const;

/**
 * Freeze time and seed randomness before page code runs so animated canvases
 * and generated particles produce repeatable visual-regression screenshots.
 */
export async function prepareDeterministicVisualPage(page: Page, path: string) {
  await page.clock.install({ time: VISUAL_EPOCH });
  await page.addInitScript((config) => {
    let state = config.seed;
    Math.random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };

    const queuedFrames = new Map<number, FrameRequestCallback>();
    let nextAnimationFrameId = 1;
    let animationTime = 0;

    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextAnimationFrameId++;
      queuedFrames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id: number) => {
      queuedFrames.delete(id);
    };

    (window as any).__visualFlushAnimationFrames = (count: number) => {
      for (let frame = 0; frame < count; frame++) {
        const callbacks = [...queuedFrames.values()];
        queuedFrames.clear();
        animationTime += config.frameMs;
        for (const callback of callbacks) callback(animationTime);
      }
    };
  }, { seed: VISUAL_SEED, frameMs: FRAME_MS });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.clock.runFor(INITIAL_SETTLE_MS);
  await page.evaluate((count) => (window as any).__visualFlushAnimationFrames(count),
    Math.ceil(INITIAL_SETTLE_MS / FRAME_MS));
  await page.waitForFunction(() => {
    const scrollTrigger = (window as any).ScrollTrigger;
    return scrollTrigger?.getAll?.().length > 0;
  }, { timeout: 10_000 }).catch(() => {
    // Pages without ScrollTrigger can still be captured deterministically.
  });
}

/** Set a scroll progress and advance the synthetic clock through GSAP settling. */
export async function scrollToDeterministicProgress(page: Page, progress: number) {
  await page.evaluate((nextProgress) => {
    const runway = document.getElementById('runway');
    if (!runway) return;
    const rect = runway.getBoundingClientRect();
    const runwayTop = rect.top + window.scrollY;
    const scrollRange = runway.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: runwayTop + scrollRange * nextProgress,
      behavior: 'instant' as ScrollBehavior,
    });
    (window as any).ScrollTrigger?.update?.();
  }, progress);
  await page.clock.runFor(SCROLL_SETTLE_MS);
  await page.evaluate((count) => (window as any).__visualFlushAnimationFrames(count),
    Math.ceil(SCROLL_SETTLE_MS / FRAME_MS));
}
