// tests/e2e/smoke.spec.ts — C2 stage-shell smoke test (V5 + V2).
// Run with: npm run e2e -- smoke
// Verifies: page loads; applied scale equals min(vw/550, vh/400) ± 0.01 px;
// letterbox color equals the documented fallback; screenshots are non-blank
// (recorded under evidence/visual/C2-smoke/ with C2_RECORD=1; live runs write
// transient screenshots to test-results/c2-smoke-live/); fullscreen keeps the same scale
// formula for unchanged viewport dimensions.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeStageMetrics,
  LETTERBOX_FALLBACK,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from '../../src/stage';

const TOLERANCE_PX = 0.01;
// Chromium quantizes getBoundingClientRect to 1/64 px LayoutUnits, so an exact
// computed offset can read back up to one unit lower. Offsets therefore allow
// the 0.01 px task tolerance plus that documented browser quantization.
const RECT_QUANTIZATION_PX = 1 / 64;
const OFFSET_TOLERANCE_PX = TOLERANCE_PX + RECT_QUANTIZATION_PX;
// Recorded evidence (C2) lives under evidence/visual/C2-smoke/ and stays frozen.
// Live re-runs (verify-all / F3) write transient screenshots to test-results/;
// set C2_RECORD=1 to record into the evidence directory again.
const EVIDENCE_DIR = process.env.C2_RECORD
  ? path.resolve(process.cwd(), 'evidence/visual/C2-smoke')
  : path.resolve(process.cwd(), 'test-results/c2-smoke-live');

const VIEWPORT_MATRIX = [
  { width: 320, height: 480 },
  { width: 550, height: 400 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 3440, height: 1440 }, // ultra-wide
];

interface AppliedMetrics {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
}

async function readAppliedMetrics(page: Page): Promise<AppliedMetrics> {
  return page.evaluate((stageWidth) => {
    const root = document.querySelector('[data-testid="stage-root"]');
    if (!(root instanceof HTMLElement)) {
      throw new Error('stage-root element not found');
    }
    const rect = root.getBoundingClientRect();
    return {
      scale: rect.width / stageWidth,
      offsetX: rect.left,
      offsetY: rect.top,
    };
  }, STAGE_WIDTH);
}

async function countScreenshotColors(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('2d canvas context unavailable');
    }
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      if (colors.size > 8) {
        return colors.size;
      }
    }
    return colors.size;
  }, png.toString('base64'));
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test.describe('C2 stage shell smoke', () => {
  test('page loads with the stage shell and read-only __game hooks', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');

    await expect(page.locator('[data-testid="stage-shell"]')).toBeVisible();
    await expect(page.locator('[data-testid="stage-root"]')).toBeVisible();
    await expect(page.locator('[data-testid="fullscreen-button"]')).toBeVisible();

    const hooks = await page.evaluate(() => {
      const game = (window as unknown as { __game?: Record<string, unknown> }).__game;
      if (game === undefined) {
        return null;
      }
      return {
        state: game['state'],
        roundId: game['roundId'],
        foundWords: game['foundWords'],
        score: game['score'],
        remainingMs: game['remainingMs'],
        lastAudioEvent: game['lastAudioEvent'],
      };
    });

    expect(hooks).toEqual({
      state: null,
      roundId: null,
      foundWords: [],
      score: 0,
      remainingMs: 0,
      lastAudioEvent: null,
    });

    // docs/04 §2 step 2: the orientationchange listener recomputes without
    // changing the (unchanged) viewport metrics and without page errors.
    const appViewport = page.viewportSize() ?? { width: 1280, height: 720 };
    const expected = computeStageMetrics(appViewport.width, appViewport.height);
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    const afterOrientationChange = await readAppliedMetrics(page);
    expect(Math.abs(afterOrientationChange.scale - expected.scale)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
    expect(pageErrors).toEqual([]);
  });

  for (const viewport of VIEWPORT_MATRIX) {
    test(`viewport ${viewport.width}x${viewport.height}: scale, letterbox, non-blank screenshot`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const expected = computeStageMetrics(viewport.width, viewport.height);

      await expect
        .poll(
          async () => {
            const applied = await readAppliedMetrics(page);
            return (
              Math.abs(applied.scale - expected.scale) <= TOLERANCE_PX &&
              Math.abs(applied.offsetX - expected.offsetX) <= OFFSET_TOLERANCE_PX &&
              Math.abs(applied.offsetY - expected.offsetY) <= OFFSET_TOLERANCE_PX
            );
          },
          {
            message:
              `expected scale ${expected.scale.toFixed(6)} ` +
              `(offset ${expected.offsetX.toFixed(2)}, ${expected.offsetY.toFixed(2)}) ` +
              `for ${viewport.width}x${viewport.height}`,
          },
        )
        .toBe(true);

      const applied = await readAppliedMetrics(page);
      // Centered on both axes: margins are symmetric and non-negative
      // (2 × quantization allowance because both offsets read back quantized).
      const centeringTolerance = 2 * RECT_QUANTIZATION_PX + TOLERANCE_PX;
      expect(
        Math.abs(applied.offsetX * 2 + STAGE_WIDTH * applied.scale - viewport.width),
      ).toBeLessThanOrEqual(centeringTolerance);
      expect(
        Math.abs(applied.offsetY * 2 + STAGE_HEIGHT * applied.scale - viewport.height),
      ).toBeLessThanOrEqual(centeringTolerance);
      expect(applied.offsetX).toBeGreaterThanOrEqual(0);
      expect(applied.offsetY).toBeGreaterThanOrEqual(0);

      const letterbox = await page
        .locator('[data-testid="stage-shell"]')
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(letterbox).toBe(hexToRgb(LETTERBOX_FALLBACK));

      const screenshotPath = path.join(
        EVIDENCE_DIR,
        `smoke-${viewport.width}x${viewport.height}.png`,
      );
      const png = await page.screenshot({ path: screenshotPath });
      expect(png.byteLength).toBeGreaterThan(0);

      const distinctColors = await countScreenshotColors(page, png);
      expect(distinctColors).toBeGreaterThan(1);
      expect(fs.statSync(screenshotPath).size).toBeGreaterThan(0);
    });
  }

  test('fullscreen toggle keeps the scale formula for unchanged viewport dimensions (V2)', async ({
    page,
  }) => {
    const viewport = { width: 1280, height: 720 };
    await page.setViewportSize(viewport);
    await page.goto('/');

    const before = await readAppliedMetrics(page);
    const expected = computeStageMetrics(viewport.width, viewport.height);
    expect(Math.abs(before.scale - expected.scale)).toBeLessThanOrEqual(TOLERANCE_PX);

    await page.locator('[data-testid="fullscreen-button"]').click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(true);

    const fullscreenState = await page.evaluate(() => {
      const element = document.fullscreenElement;
      return {
        isStageShell: element?.getAttribute('data-testid') === 'stage-shell',
        width: element?.clientWidth ?? 0,
        height: element?.clientHeight ?? 0,
      };
    });
    expect(fullscreenState.isStageShell).toBe(true);
    // Same viewport dimensions inside headless fullscreen: scale must not change.
    expect(fullscreenState.width).toBe(viewport.width);
    expect(fullscreenState.height).toBe(viewport.height);

    const expectedInFullscreen = computeStageMetrics(
      fullscreenState.width,
      fullscreenState.height,
    );
    await expect
      .poll(async () => {
        const applied = await readAppliedMetrics(page);
        return Math.abs(applied.scale - expectedInFullscreen.scale) <= TOLERANCE_PX;
      })
      .toBe(true);

    const during = await readAppliedMetrics(page);
    expect(Math.abs(during.scale - before.scale)).toBeLessThanOrEqual(TOLERANCE_PX);

    // docs/04 §2: ESC is handled natively by the browser. Headless Chromium
    // does not route the ESC key to the fullscreen controller, so the native
    // exit is invoked through the same DOM API the browser runs on ESC.
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    const after = await readAppliedMetrics(page);
    expect(Math.abs(after.scale - before.scale)).toBeLessThanOrEqual(TOLERANCE_PX);
  });
});
