// tests/e2e/speaker/corner-alpha.spec.ts — Y4 knob-alpha regression guard.
//
// Owner defect (Y1 follow-up): bitmap 86 (the 21x29 speaker-knob megaphone) has
// transparent corners/edges; the WebP payload Y1 embedded into
// `s90_btn_speaker.svg` was encoded RGB (alpha dropped), so the transparent
// region of the knob's draw box rendered as an opaque black chevron behind the
// megaphone. Task Y4 re-embeds the RGBA payload (`ai86-8x-alpha.webp`,
// hash-pinned in `tools/process-assets.mjs`); this suite guards the rendered
// result: the pixels where the bitmap is transparent must NOT be opaque black,
// at deviceScaleFactor 1 AND 2.
//
// Method: screenshot the stage, decode the PNG with the F1 tool's own decoder
// (`verify/diff/diff.mjs`, no new dependency) and check the fixed sample rects.
// The rects sit inside the bitmap's transparent top-left / bottom-left
// triangles in dsf1 stage pixels (bitmap draw box measured at (515,367,22,30);
// footprint evidence/Y1-remaster.md §5). Evidence for the choice
// (evidence/Y4-knob-alpha.md §3):
//   - reference captures (tests/fixtures/reference/speaker/speaker-*.png) show
//     plain backdrop at these pixels: (245,226,171)/(249,229,177);
//   - the pre-fix committed app capture (evidence/visual/Y1/after-S2-dsf1-actual
//     .png, dsf2 counterpart) shows (0..2, 0..2, 0..2) — opaque black — at every
//     sampled pixel, so this guard fails loudly on the Y1 payload;
//   - the post-fix capture shows the background again (evidence/Y4-knob-alpha.md).
//
// Silent witness (EXECUTION.md §8): the "app" project launches Chromium with
// `--mute-audio`; this suite never overrides that and asserts pixels only.
import { expect, test, type Page } from '@playwright/test';
import { decodePng } from '../../../verify/diff/diff.mjs';

const STAGE_SELECTOR = '[data-testid="stage-root"]';
const SPEAKER_SELECTOR = '[data-element="btn_speaker"]';

/**
 * Sample rects in dsf1 stage pixels inside the knob bitmap's transparent
 * corners (x, y, w, h). Scaled by the deviceScaleFactor like the Y1 allowance.
 */
const SAMPLE_RECTS: readonly (readonly [number, number, number, number])[] = [
  [517, 369, 3, 3], // transparent top-left triangle of bitmap 86
  [517, 393, 3, 2], // transparent bottom-left triangle of bitmap 86
];

/** The defect colour: an opaque (near-)black pixel. */
function isOpaqueBlack(r: number, g: number, b: number): boolean {
  return r < 16 && g < 16 && b < 16;
}

async function waitForBoard(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const board = document.querySelector('[data-testid="board"]');
    if (!(board instanceof HTMLElement)) {
      return false;
    }
    const images = Array.from(board.querySelectorAll('img'));
    return (
      images.length > 0 &&
      images.every(
        (image) =>
          image.complete &&
          (image.naturalWidth > 0 || image.clientWidth === 0 || image.clientHeight === 0),
      )
    );
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

for (const dsf of [1, 2] as const) {
  test.describe(`Y4 speaker-knob alpha (deviceScaleFactor ${dsf})`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    test('the transparent knob corners render as background, not opaque black', async ({
      page,
    }) => {
      const pageErrors: Error[] = [];
      page.on('pageerror', (error) => pageErrors.push(error));

      await page.goto('/');
      await waitForBoard(page);
      await expect(page.locator(SPEAKER_SELECTOR)).toHaveAttribute('data-speaker', 'on');

      const screenshot = await page.locator(STAGE_SELECTOR).screenshot();
      const image = decodePng(screenshot);
      expect(image.width, `stage width at dsf${dsf}`).toBe(550 * dsf);
      expect(image.height, `stage height at dsf${dsf}`).toBe(400 * dsf);

      for (const [x, y, w, h] of SAMPLE_RECTS) {
        for (let dy = 0; dy < h * dsf; dy++) {
          for (let dx = 0; dx < w * dsf; dx++) {
            const px = x * dsf + dx;
            const py = y * dsf + dy;
            const i = (py * image.width + px) * 4;
            const [r, g, b] = [image.data[i], image.data[i + 1], image.data[i + 2]];
            const where = `stage(${px},${py}) = rgb(${r},${g},${b}) at dsf${dsf}`;
            // The defect: RGB payload → alpha-0 bitmap pixels paint opaque black.
            expect(isOpaqueBlack(r, g, b), `${where} must not be opaque black`).toBe(false);
            // The measured post-fix background here is light (sum ≈ 600); the
            // defect renders sum ≈ 2. This upper guard catches a near-black
            // opaque regression that is not exactly 0,0,0.
            expect(r + g + b, `${where} must be a light background pixel (sum >= 150)`).toBeGreaterThanOrEqual(150);
          }
        }
      }

      expect(pageErrors).toEqual([]);
    });
  });
}
