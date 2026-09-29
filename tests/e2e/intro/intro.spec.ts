// tests/e2e/intro/intro.spec.ts — Y8 boot intro suite (task Y8, closes O23).
//
// Two verification surfaces:
//
// 1. Boot sequencing (D5 + E3): on every boot/reload the app plays
//    preloader(SWF frames 1–4, 4/36 s) → intro(frames 5–130, 126/36 s) →
//    the first settled board, with input locked while the FSM is in
//    `preloader`/`main` (evidence/A2-input.md §3, evidence/A2-edges.md §3:
//    the reference key handlers exist only in frame_131). The state history is
//    read from the dev-server `window.__bootLog` hook (src/main.ts) and the
//    preloader/intro durations are cross-checked against the catalog
//    (data/animation.json sequences `preloader`/`intro` at 36 fps).
//
// 2. Keyframe comparisons (V5): the intro timeline is driven to the catalog
//    offsets (`data/animation.json` `intro.keyframeOffsetsSec` = 0 / 0.8611 /
//    1.75 / 2.6111 / 3.4722 s for frames 5 / 36 / 68 / 99 / 130) by pausing
//    the five CSS animations and setting `currentTime` (deterministic — no
//    wall-clock waits), then compared at deviceScaleFactor 1 and 2 with the
//    fresh reference captures from tests/e2e/intro/capture-intro-reference.mjs
//    (evidence/visual/Y8/reference-dsf{1,2}/frame-<F>.png; measured frames
//    recorded in evidence/Y8-intro.md §3). The F1 tool's anti-aliasing-tolerant
//    ratio is the pass basis (tolerantMismatchRatio ≤ 2.0 %); the intro has no
//    owner-approved allowances (no board backdrop, no omitted elements).
//
// Reference provenance: `ruffle-player` pause/live captures of the original
// 2012 build through the C3 server + pinned Ruffle 0.6.0 + Base64 fixture,
// muted Chromium (EXECUTION.md §8).

import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const REFERENCE_ROOT = path.join(REPO_ROOT, 'evidence/visual/Y8');
const DATA_ANIMATION = path.join(REPO_ROOT, 'data/animation.json');
const DIFF_TOOL = path.join(REPO_ROOT, 'verify/diff/diff.mjs');
const EVIDENCE_DIR = process.env.Y8_RECORD
  ? path.join(REPO_ROOT, 'evidence/visual/Y8')
  : path.join(REPO_ROOT, 'test-results/Y8-live');

/** Catalog keyframes of the `intro` sequence (frames ↔ offsets). */
const INTRO_KEYFRAMES = [
  { frame: 5, offset: 0, label: '0.0' },
  { frame: 36, offset: 0.8611, label: '0.8611' },
  { frame: 68, offset: 1.75, label: '1.75' },
  { frame: 99, offset: 2.6111, label: '2.6111' },
  { frame: 130, offset: 3.4722, label: '3.4722' },
];

interface DiffReport {
  schemaVersion: number;
  mismatchRatio: number;
  mismatchedPixels: number;
  totalPixels: number;
  tolerantRadius: number;
  tolerantMismatchedPixels: number;
  tolerantMismatchRatio: number;
  passRatio: number;
  ignoredRects: { x: number; y: number; w: number; h: number }[];
  ignoredPixels: number;
  pass: boolean;
}

interface BootLogEntryView {
  state: string;
  atMs: number;
}

function runDiff(actual: string, reference: string, outDir: string): DiffReport {
  execFileSync(process.execPath, [DIFF_TOOL, actual, reference, outDir], { stdio: 'pipe' });
  expect(fs.existsSync(path.join(outDir, 'report.json')), 'diff report written').toBe(true);
  expect(fs.existsSync(path.join(outDir, 'heatmap.png')), 'heatmap artifact').toBe(true);
  return JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8')) as DiffReport;
}

function hideHarnessChrome(page: Page): Promise<void> {
  return page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) button.style.display = 'none';
  });
}

async function waitForState(page: Page, state: string): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const log = window.__bootLog;
      return Array.isArray(log) && log.some((entry) => entry.state === expected);
    },
    state,
  );
}

function bootLogOf(page: Page): Promise<BootLogEntryView[]> {
  return page.evaluate(() => (window.__bootLog ?? []) as unknown as BootLogEntryView[]);
}

test.describe('Y8 boot sequence (O23)', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('boot plays preloader → intro → first board with catalog-derived spans', async ({ page }) => {
    const catalog = JSON.parse(fs.readFileSync(DATA_ANIMATION, 'utf8')) as {
      fps: number;
      sequences: { id: string; frames: number }[];
    };
    const preloader = catalog.sequences.find((sequence) => sequence.id === 'preloader')!;
    const intro = catalog.sequences.find((sequence) => sequence.id === 'intro')!;
    expect(catalog.fps).toBe(36);
    expect(preloader.frames).toBe(4);
    expect(intro.frames).toBe(126);
    // `data/animation.json` stores `durationSec`; the catalog-derived span in ms
    // is frames × 1000 / fps (same derivation as src/ui/animations.ts).
    const preloaderMsCatalog = (preloader.frames * 1000) / catalog.fps;
    const introMsCatalog = (intro.frames * 1000) / catalog.fps;

    await page.goto('/');
    await hideHarnessChrome(page);
    await waitForState(page, 'main');

    // The intro state renders the intro element set in the raised boot layer.
    const bootLayer = page.locator('.e3-boot-layer-root');
    await expect(bootLayer).toHaveCount(1);
    for (const id of [
      'intro_backdrop',
      'intro_sky',
      'intro_ground',
      'intro_layer3',
      'intro_glow',
      'intro_logo',
      'logo_ornament',
    ]) {
      await expect(bootLayer.locator(`[data-element="${id}"]`), `${id} in boot layer`).toHaveCount(1);
    }
    await expect(bootLayer.locator('.e3-intro-glow-tint')).toHaveCount(1);
    // The board layout stays mounted underneath (E2 V7 samples it from the
    // first paint) and no round tiles exist while the intro is on stage.
    await expect(page.locator('[data-element="board_backdrop"]')).toHaveCount(1);
    // The static `letter_tile` template is part of the mounted board layout;
    // the runtime letter slots (`letter0..7`) only exist once the round starts.
    await expect(
      page.locator('[data-element^="letter"]:not([data-element="letter_tile"])'),
    ).toHaveCount(0);
    // The boot layer is one stacking context above the board layout.
    const wrapperZ = await bootLayer.evaluate((node) => getComputedStyle(node).zIndex);
    expect(Number(wrapperZ)).toBeGreaterThan(21000);
    // The five intro animations run with the catalog duration.
    const animations = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.animationName?.startsWith('e3-intro'))
        .map((animation) => ({
          name: animation.animationName,
          duration: animation.effect?.getTiming().duration,
        })),
    );
    expect(animations).toHaveLength(5);
    for (const animation of animations) {
      expect(animation.duration, `${animation.name} duration`).toBe(3500);
    }

    // The first settled board follows automatically (no input, no test hook).
    await waitForState(page, 'playing');
    expect(await page.evaluate(() => window.__game.state)).toBe('playing');
    await expect(page.locator('[data-element="board_backdrop"]')).toHaveCount(1);
    await expect(page.locator('[data-element="letter0"]')).toHaveCount(1);

    const log = await bootLogOf(page);
    const states = log.map((entry) => entry.state);
    expect(states.slice(0, 4)).toEqual(['boot', 'preloader', 'main', 'playing']);
    const at = (state: string): number => log.find((entry) => entry.state === state)!.atMs;
    const preloaderMs = at('main') - at('preloader');
    const introMs = at('playing') - at('main');
    // Catalog-derived spans with a scheduler tolerance (setTimeout jitter; the
    // preloader is only 111 ms and can be delayed by the boot paint).
    expect(preloaderMs).toBeGreaterThanOrEqual(0);
    expect(Math.abs(preloaderMs - preloaderMsCatalog)).toBeLessThanOrEqual(300);
    expect(Math.abs(introMs - introMsCatalog)).toBeLessThanOrEqual(250);
  });

  test('input stays locked during the intro', async ({ page }) => {
    await page.goto('/');
    await hideHarnessChrome(page);
    await waitForState(page, 'main');

    // Keys (letter, SPACE, ENTER, BACKSPACE) and a tile click change nothing:
    // the reference defines its key handlers in frame_131 only
    // (artifacts/decompiled/scripts/frame_131/DoAction.as; frame_5 has none).
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.mouse.click(60, 330);
    const during = await page.evaluate(() => ({
      state: window.__game.state,
      score: window.__game.score,
      foundWords: window.__game.foundWords,
      lastAudioEvent: window.__game.lastAudioEvent,
    }));
    expect(during.state).toBe('main');
    expect(during.score).toBe(0);
    expect(during.foundWords).toEqual([]);
    // No round was live, so nothing was accepted and the last audio event is
    // still the pre-round state ('roundStart' only plays once the board starts).
    expect(during.lastAudioEvent === null || during.lastAudioEvent === 'roundStart').toBe(true);
  });

  test('the intro replays on reload (boot/presentation state only)', async ({ page }) => {
    await page.goto('/');
    await hideHarnessChrome(page);
    await waitForState(page, 'main');
    await waitForState(page, 'playing');

    await page.reload({ waitUntil: 'load' });
    await hideHarnessChrome(page);
    await waitForState(page, 'main');
    // The intro is replaying (intro layers on stage in the boot layer).
    await expect(page.locator('.e3-boot-layer-root [data-element="intro_sky"]')).toHaveCount(1);
    await expect(page.locator('.e3-boot-layer-root [data-element="intro_logo"]')).toHaveCount(1);
    await waitForState(page, 'playing');
    const log = await bootLogOf(page);
    expect(log.map((entry) => entry.state).slice(0, 4)).toEqual([
      'boot',
      'preloader',
      'main',
      'playing',
    ]);
  });
});

for (const dsf of [1, 2] as const) {
  test.describe(`Y8 intro keyframes — deviceScaleFactor ${dsf}`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    for (const keyframe of INTRO_KEYFRAMES) {
      test(`intro @ ${keyframe.label} s (frame ${keyframe.frame}) matches the reference capture`, async ({
        page,
      }) => {
        const reference = path.join(
          REFERENCE_ROOT,
          `reference-dsf${dsf}`,
          `frame-${String(keyframe.frame).padStart(3, '0')}.png`,
        );
        expect(fs.existsSync(reference), `reference capture present: ${reference}`).toBe(true);

        await page.goto('/');
        await hideHarnessChrome(page);
        await waitForState(page, 'main');

        // Drive the five intro animations to the catalog offset and freeze them
        // (deterministic — no wall-clock waits).
        const info = await page.evaluate(async (offsetMs) => {
          await document.fonts.ready;
          const animations = document
            .getAnimations()
            .filter((animation) => animation.animationName?.startsWith('e3-intro'));
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = offsetMs;
          }
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          return { count: animations.length, state: window.__game.state };
        }, keyframe.offset * 1000);
        expect(info.count).toBe(5);
        expect(info.state).toBe('main');

        const outDir = path.join(EVIDENCE_DIR, `intro-f${keyframe.frame}`, `dsf${dsf}`);
        fs.mkdirSync(outDir, { recursive: true });
        const actual = path.join(outDir, 'actual.png');
        await page.locator('[data-testid="stage-root"]').screenshot({ path: actual });

        const report = runDiff(actual, reference, outDir);
        fs.renameSync(
          path.join(outDir, 'report.json'),
          path.join(outDir, `${keyframe.label}.report.json`),
        );
        fs.renameSync(
          path.join(outDir, 'heatmap.png'),
          path.join(outDir, `${keyframe.label}.heatmap.png`),
        );
        const rawPercent = report.mismatchRatio * 100;
        const tolerantPercent = report.tolerantMismatchRatio * 100;
        expect(report.schemaVersion).toBeGreaterThanOrEqual(2);
        expect(report.tolerantRadius).toBe(2);
        // The intro keyframes carry no owner-approved allowance.
        expect(report.ignoredRects).toEqual([]);
        expect(report.ignoredPixels).toBe(0);
        console.log(
          `Y8 intro frame ${keyframe.frame} dsf${dsf}: raw=${rawPercent.toFixed(3)}% ` +
            `(${report.mismatchedPixels}/${report.totalPixels} px), ` +
            `tolerant=${tolerantPercent.toFixed(3)}% (${report.tolerantMismatchedPixels} px), ` +
            `pass=${report.pass}`,
        );
        expect(
          report.tolerantMismatchRatio,
          `intro frame ${keyframe.frame} dsf${dsf} tolerant mismatch ` +
            `${tolerantPercent.toFixed(3)}% (limit 2.000%)`,
        ).toBeLessThanOrEqual(report.passRatio);
        expect(report.pass).toBe(true);
      });
    }
  });
}

// The catalog entry cross-check (data/animation.json `intro`) is asserted here
// so the suite also guards the offsets it drives to (V2 pattern).
test.describe('Y8 intro catalog cross-check', () => {
  test('intro keyframes match data/animation.json', () => {
    const catalog = JSON.parse(fs.readFileSync(DATA_ANIMATION, 'utf8')) as {
      fps: number;
      sequences: {
        id: string;
        frameStart: number;
        frameEnd: number;
        frames: number;
        keyframeFrames: number[];
        keyframeOffsetsSec: number[];
      }[];
    };
    const intro = catalog.sequences.find((sequence) => sequence.id === 'intro')!;
    expect(intro.frameStart).toBe(5);
    expect(intro.frameEnd).toBe(130);
    expect(intro.frames).toBe(126);
    expect(intro.keyframeFrames).toEqual(INTRO_KEYFRAMES.map((keyframe) => keyframe.frame));
    for (let index = 0; index < INTRO_KEYFRAMES.length; index += 1) {
      expect(
        Math.abs(intro.keyframeOffsetsSec[index]! - INTRO_KEYFRAMES[index]!.offset),
      ).toBeLessThanOrEqual(5e-4);
    }
  });
});
