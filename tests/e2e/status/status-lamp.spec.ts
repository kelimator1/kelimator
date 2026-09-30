// tests/e2e/status/status-lamp.spec.ts — task Y9 status-lamp states.
//
// Owner-reported defect (evidence/Y9-status-lamp.md): the right-panel status
// capsule always showed sprite frame 1 (dark ball) and the live text in fixed
// `#000`. The reference sprite `DefineSprite_123` has three frames:
//   frame 1 = dark/blank ball (no text)      → idle
//   frame 2 = GREEN ball + `Geçerli` (#336600) → valid, not-yet-found entry
//   frame 3 = RED ball + `Girildi` (#ff0000)   → entry already found
// (`evidence/A2-strings.md` §2, text ids 119/122; `kontrol()` gotoAndStop).
//
// This suite drives the real lifecycle to each state and compares the app's
// capsule with the rendered reference frame at deviceScaleFactor 1 and 2:
//   - the reference composite is built inside the app page: the message and the
//     board's frame-1 ball are hidden and the raw FFDec frame (fixture, byte
//     copy of `artifacts/decompiled/sprites/DefineSprite_123/<n>.svg`, sha256
//     pinned below) is injected at the exact `status_ball` catalog box over the
//     real board backdrop — the same coordinates the app uses, so both sides
//     rasterise at the same position;
//   - ball region (x < 38 px): the app must be pixel-identical (raw
//     mismatchedPixels = 0) to the reference ball for all three states;
//   - text region (x >= 38 px): the kept live-text mechanism must be
//     pixel-faithful on the project's anti-aliasing-tolerant V5 basis
//     (docs/07 §4 amendment; tolerantMismatchRatio ≤ 2 %);
//   - text colours are probed exactly: the frame's fill (#336600 / #ff0000)
//     must occur in the live text's glyph bodies (and not in the idle/other
//     state).
// Crops are recorded under evidence/visual/Y9/ with `Y9_RECORD=1`, otherwise
// under test-results/Y9-live/ (evidence-freeze amendment; the F3 pattern).
//
// Silent witness run: the Playwright project launches Chromium with
// `--mute-audio` (EXECUTION.md §8).

import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from '../../../verify/diff/diff.mjs';

const REPO_ROOT = process.cwd();
const DIFF_TOOL = path.join(REPO_ROOT, 'verify/diff/diff.mjs');
const RECORD = process.env.Y9_RECORD === '1';
const OUT_DIR = RECORD
  ? path.join(REPO_ROOT, 'evidence/visual/Y9')
  : path.join(REPO_ROOT, 'test-results/Y9-live');

/** The app's status capsule box (src/data/layout.json `status_ball`). */
const STATUS_BOX = { x: 447.37, y: 238.45, w: 107.01, h: 34.81 };
const CLIP = { x: STATUS_BOX.x, y: STATUS_BOX.y, width: STATUS_BOX.w, height: STATUS_BOX.h };
/** Ball/text split: the frame's text run starts at x≈40.7, the ball/shadow ends before 38. */
const TEXT_LEFT = 38;

/** Raw reference frames (committed byte copies; sha256 pins asserted below). */
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests/e2e/status/fixtures/DefineSprite_123');
const FRAME_SHA256: Readonly<Record<1 | 2 | 3, string>> = {
  1: '2348abfa68337899981219856c3ba5f5564ea13b0318652e6ba3d2b3ef4c1816',
  2: 'c9c348c0deb10e6cb55b59a430121ec9448cb374e598783aaa0077cfd98dc922',
  3: 'a80a27e1f4b1ac625e39403f46ae351be408daa9fc1438ff84ed9afd2e45f48d',
};
const FRAMES: Record<number, string> = {};
for (const frame of [1, 2, 3] as const) {
  const file = path.join(FIXTURE_DIR, `${frame}.svg`);
  const bytes = fs.readFileSync(file);
  expect(sha256(bytes), `reference frame ${frame} fixture sha256`).toBe(FRAME_SHA256[frame]);
  FRAMES[frame] = bytes.toString('utf8');
}

/** Expected frame fills (sampled: evidence/Y9-status-lamp.md §2). */
const VALID_TEXT_COLOR = [0x33, 0x66, 0x00] as const;
const FOUND_TEXT_COLOR = [0xff, 0x00, 0x00] as const;

// ---------------------------------------------------------------------------
// Fixture round (same pattern as tests/e2e/interaction/interaction.spec.ts)
// ---------------------------------------------------------------------------

const ROUND_MAIN = 'FİNALİZM';
const SLOT_COUNT = 8;
const SLOT_X0 = 60;
const SLOT_PITCH = 60;
const SLOT_Y = 330;

interface RoundBank {
  readonly rounds: readonly {
    readonly id: string;
    readonly main: string;
    readonly words: Readonly<Record<string, readonly string[]>>;
  }[];
}

const ROUND = (() => {
  const bank = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/rounds.json'), 'utf8'),
  ) as RoundBank;
  const round = bank.rounds.find((candidate) => candidate.main === ROUND_MAIN);
  if (round === undefined) throw new Error(`${ROUND_MAIN} must be present in the round bank`);
  return round;
})();

const FIRST_WORD = ROUND.words['3']?.[0] ?? '';

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// ---------------------------------------------------------------------------
// Driving the app
// ---------------------------------------------------------------------------

async function prepareRound(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => typeof (window as unknown as { __game?: unknown }).__game !== 'undefined');
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) button.style.display = 'none';
  });
  await page.evaluate((main) => {
    (window as unknown as { __game: { selectRound(main: string): void } }).__game.selectRound(main);
  }, ROUND_MAIN);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __game: { roundId: string | null } }).__game.roundId),
    )
    .toBe(ROUND.id);
  await expect(page.locator('[data-element="letter0"]')).toHaveCount(1);
}

/** Click the first visible tile carrying `letter`; assert the entry updates. */
async function clickLetter(page: Page, letter: string, expectedEntry: string): Promise<void> {
  const slot = await page.evaluate(
    ({ wanted, slotCount }) => {
      for (let index = 0; index < slotCount; index += 1) {
        if (document.querySelector(`[data-element="letter${index}"]`)?.textContent === wanted) {
          return index;
        }
      }
      return -1;
    },
    { wanted: letter, slotCount: SLOT_COUNT },
  );
  expect(slot, `a visible tile carries ${letter}`).toBeGreaterThanOrEqual(0);
  const box = await page.locator(`[data-element="bosbuton${slot}"]`).boundingBox();
  expect(box, `socket ${slot} is rendered`).not.toBeNull();
  const center = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  expect(center.x, `tile ${slot} center x`).toBeCloseTo(SLOT_X0 + slot * SLOT_PITCH, 0);
  expect(center.y, `tile ${slot} center y`).toBeCloseTo(SLOT_Y, 0);
  await page.mouse.click(center.x, center.y);
  await expect(page.locator('[data-testid="entry"]')).toHaveText(expectedEntry);
  // E3 wordball "getir" slide: wait for its settle state before the screenshot.
  await expect(page.locator('.e3-wordball-getir')).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Capsule capture + comparison
// ---------------------------------------------------------------------------

/** Screenshot the capsule region as the app currently renders it. */
async function captureActual(page: Page, name: string): Promise<string> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, clip: CLIP });
  return file;
}

/**
 * Reference composite: hide the message + the board's frame-1 ball, inject the
 * raw reference frame at the capsule box over the live backdrop, screenshot.
 */
async function captureReference(page: Page, frame: 1 | 2 | 3, name: string): Promise<string> {
  const b64 = Buffer.from(FRAMES[frame], 'utf8').toString('base64');
  await page.evaluate(
    ({ box, frameB64 }) => {
      const message = document.querySelector('[data-testid="message"]');
      if (message instanceof HTMLElement) message.style.display = 'none';
      const ball = document.querySelector('[data-element="status_ball"]');
      if (ball instanceof HTMLElement) ball.style.visibility = 'hidden';
      const img = document.createElement('img');
      img.id = 'y9-status-reference';
      img.style.cssText =
        `position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;` +
        `height:${(box.w * 34.8) / 107}px;z-index:26000`;
      img.src = `data:image/svg+xml;base64,${frameB64}`;
      const root = document.querySelector('[data-testid="stage-root"]');
      if (!(root instanceof HTMLElement)) throw new Error('stage-root missing');
      root.appendChild(img);
      return img.decode();
    },
    { box: STATUS_BOX, frameB64: b64 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, clip: CLIP });
  await page.evaluate(() => {
    document.getElementById('y9-status-reference')?.remove();
    const message = document.querySelector('[data-testid="message"]');
    if (message instanceof HTMLElement) message.style.display = '';
    const ball = document.querySelector('[data-element="status_ball"]');
    if (ball instanceof HTMLElement) ball.style.visibility = '';
  });
  return file;
}

interface DiffReport {
  totalPixels: number;
  mismatchedPixels: number;
  mismatchRatio: number;
  tolerantMismatchedPixels: number;
  tolerantMismatchRatio: number;
  passRatio: number;
  pass: boolean;
}

function runDiff(actual: string, reference: string, outDir: string, ignoreRect?: string): DiffReport {
  const args = [DIFF_TOOL, actual, reference, outDir];
  if (ignoreRect !== undefined) args.push('--ignore-rect', ignoreRect);
  execFileSync(process.execPath, args, { stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8')) as DiffReport;
}

/** Compare one state: ball region must be exact, the capsule V5-tolerant. */
function compareState(
  actual: string,
  reference: string,
  label: string,
  dsf: number,
): { ball: DiffReport; capsule: DiffReport } {
  const img = decodePng(fs.readFileSync(actual));
  const textLeft = Math.min(Math.round(TEXT_LEFT * dsf), img.width - 1);
  const outDir = path.join(OUT_DIR, `diff-${label}-dsf${dsf}`);
  fs.mkdirSync(outDir, { recursive: true });
  // Ball region: ignore the text side → the ball must match the frame exactly.
  const ball = runDiff(
    actual,
    reference,
    outDir,
    `${textLeft},0,${img.width - textLeft},${img.height}`,
  );
  // Full capsule: the kept live text must stay within the V5 tolerant basis.
  const capsule = runDiff(actual, reference, outDir);
  return { ball, capsule };
}

/** Count pixels exactly equal to `rgb` inside the text region of a crop. */
function countTextFill(file: string, rgb: readonly [number, number, number], dsf: number): number {
  const img = decodePng(fs.readFileSync(file));
  const x0 = Math.min(Math.round(TEXT_LEFT * dsf), img.width);
  let count = 0;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = x0; x < img.width; x += 1) {
      const i = (y * img.width + x) * 4;
      if (img.data[i] === rgb[0] && img.data[i + 1] === rgb[1] && img.data[i + 2] === rgb[2]) {
        count += 1;
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// The three states at dsf 1 and 2
// ---------------------------------------------------------------------------

for (const dsf of [1, 2] as const) {
  test.describe(`status lamp states — deviceScaleFactor ${dsf}`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    test(`idle/valid/already-found match the sprite frames (dsf ${dsf})`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on('pageerror', (error) => pageErrors.push(error));

      await prepareRound(page);

      // ---- frame 1 (idle): dark ball, no text -----------------------------
      await expect(page.locator('[data-testid="message"]')).toBeHidden();
      await expect(page.locator('[data-element="status_ball"]')).toBeVisible();
      const idleActual = await captureActual(page, `actual-idle-dsf${dsf}`);
      const idleRef = await captureReference(page, 1, `reference-idle-dsf${dsf}`);
      const idle = compareState(idleActual, idleRef, 'idle', dsf);
      console.log(
        `Y9 idle dsf${dsf}: ball raw=${idle.ball.mismatchedPixels} | capsule raw=${idle.capsule.mismatchedPixels} tolerant=${idle.capsule.tolerantMismatchedPixels} (${(idle.capsule.tolerantMismatchRatio * 100).toFixed(3)}%)`,
      );
      // Idle = frame 1 exactly (ball + no text anywhere in the capsule).
      expect(idle.capsule.mismatchedPixels, 'idle capsule is frame 1 exactly').toBe(0);
      expect(countTextFill(idleActual, VALID_TEXT_COLOR, dsf), 'idle has no green text').toBe(0);
      expect(countTextFill(idleActual, FOUND_TEXT_COLOR, dsf), 'idle has no red text').toBe(0);

      // ---- frame 2 (valid): green ball + `Geçerli` ------------------------
      for (const [index, letter] of [...FIRST_WORD].entries()) {
        await clickLetter(page, letter, FIRST_WORD.slice(0, index + 1));
      }
      const message = page.locator('[data-testid="message"]');
      await expect(message).toHaveText('Geçerli');
      await expect(message.locator('.game-message-ball')).toHaveAttribute(
        'src',
        /s123_status_ball_f2\.svg/,
      );
      // The board's frame-1 ball is hidden while a coloured state is active.
      await expect(page.locator('[data-element="status_ball"]')).toBeHidden();
      await expect(page.locator('[data-testid="stage-root"]')).toHaveAttribute(
        'data-status-lamp',
        'valid',
      );
      const validActual = await captureActual(page, `actual-valid-dsf${dsf}`);
      const validRef = await captureReference(page, 2, `reference-valid-dsf${dsf}`);
      const valid = compareState(validActual, validRef, 'valid', dsf);
      console.log(
        `Y9 valid dsf${dsf}: ball raw=${valid.ball.mismatchedPixels} | capsule raw=${valid.capsule.mismatchedPixels} tolerant=${valid.capsule.tolerantMismatchedPixels} (${(valid.capsule.tolerantMismatchRatio * 100).toFixed(3)}%)`,
      );
      expect(valid.ball.mismatchedPixels, 'valid ball is frame 2 exactly').toBe(0);
      expect(
        valid.capsule.tolerantMismatchRatio,
        'valid capsule within the V5 tolerant basis',
      ).toBeLessThanOrEqual(valid.capsule.passRatio);
      expect(valid.capsule.pass, 'valid capsule pass').toBe(true);
      const greenPixels = countTextFill(validActual, VALID_TEXT_COLOR, dsf);
      expect(greenPixels, 'live `Geçerli` carries the frame fill #336600').toBeGreaterThan(20);
      expect(countTextFill(validActual, FOUND_TEXT_COLOR, dsf), 'no red text while valid').toBe(0);

      // ---- frame 3 (already found): red ball + `Girildi` ------------------
      await page.keyboard.press('Enter');
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { __game: { foundWords: string[] } }).__game.foundWords.length,
          ),
        )
        .toBe(1);
      await expect(message).toBeHidden();
      for (const [index, letter] of [...FIRST_WORD].entries()) {
        await clickLetter(page, letter, FIRST_WORD.slice(0, index + 1));
      }
      await expect(message).toHaveText('Girildi');
      await expect(message.locator('.game-message-ball')).toHaveAttribute(
        'src',
        /s123_status_ball_f3\.svg/,
      );
      await expect(page.locator('[data-testid="stage-root"]')).toHaveAttribute(
        'data-status-lamp',
        'already-found',
      );
      const foundActual = await captureActual(page, `actual-found-dsf${dsf}`);
      const foundRef = await captureReference(page, 3, `reference-found-dsf${dsf}`);
      const found = compareState(foundActual, foundRef, 'found', dsf);
      console.log(
        `Y9 found dsf${dsf}: ball raw=${found.ball.mismatchedPixels} | capsule raw=${found.capsule.mismatchedPixels} tolerant=${found.capsule.tolerantMismatchedPixels} (${(found.capsule.tolerantMismatchRatio * 100).toFixed(3)}%)`,
      );
      expect(found.ball.mismatchedPixels, 'found ball is frame 3 exactly').toBe(0);
      expect(
        found.capsule.tolerantMismatchRatio,
        'found capsule within the V5 tolerant basis',
      ).toBeLessThanOrEqual(found.capsule.passRatio);
      expect(found.capsule.pass, 'found capsule pass').toBe(true);
      const redPixels = countTextFill(foundActual, FOUND_TEXT_COLOR, dsf);
      expect(redPixels, 'live `Girildi` carries the frame fill #ff0000').toBeGreaterThan(20);
      expect(countTextFill(foundActual, VALID_TEXT_COLOR, dsf), 'no green text while found').toBe(0);

      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}

// ---------------------------------------------------------------------------
// Manifest record (task Y9): the processed frame assets are hash-pinned records
// of the sprite entry; the raw fixture frames are the same FFDec sources.
// ---------------------------------------------------------------------------

test.describe('status lamp pipeline records', () => {
  test('manifest records both processed frames with their source pins', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'src/assets/manifest.json'), 'utf8'),
    ) as {
      assets: Record<
        string,
        {
          sha256: string;
          frames?: readonly {
            frame: number;
            name: string;
            sha256: string;
            source: string;
            sourceSha256: string;
            correction: string;
          }[];
        }
      >;
    };
    const entry = manifest.assets['svg/s123_status_ball.svg'];
    expect(entry, 'status_ball entry').toBeDefined();
    expect(entry.frames, 'status_ball frames recorded').toHaveLength(2);
    for (const frame of [2, 3] as const) {
      const record = entry.frames?.find((candidate) => candidate.frame === frame);
      expect(record, `frame ${frame} record`).toBeDefined();
      if (record === undefined) continue;
      expect(record.name).toBe(`svg/s123_status_ball_f${frame}.svg`);
      expect(record.source).toBe(`artifacts/decompiled/sprites/DefineSprite_123/${frame}.svg`);
      expect(record.sourceSha256).toBe(FRAME_SHA256[frame]);
      expect(record.correction).toBe('strip-status-text');
      const rel = path.join(REPO_ROOT, 'src/assets', record.name);
      expect(sha256(fs.readFileSync(rel)), `frame ${frame} asset sha256`).toBe(record.sha256);
      // The pipeline asset carries no baked static text (correction applied).
      const svg = fs.readFileSync(rel, 'utf8');
      expect(svg, `frame ${frame} asset has no baked text`).not.toMatch(
        /font_Verdana|id="text0"|#text0/,
      );
      expect(svg, `frame ${frame} asset keeps the ball shapes`).toContain('id="shape0"');
    }
  });
});
