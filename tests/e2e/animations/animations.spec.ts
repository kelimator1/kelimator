// tests/e2e/animations/animations.spec.ts — E3 animation suite (V5 + V2 + V7).
//
// V5 (docs/07-verification.md §4, Amendment 2026-09-28): the covered animation
// keyframes are compared with the reference captures taken by C3's scenario
// mode into tests/fixtures/reference/animations/<sequence>/ (driver:
// verify/reference/capture.mjs; scenarios: tests/e2e/animations/scenarios/).
// The app is driven through its real lifecycle to the same state at the same
// catalog offset (data/animation.json `keyframeOffsetsSec`); the F1 tool
// (verify/diff/diff.mjs) computes the anti-aliasing-tolerant ratio and the
// verdict is `tolerantMismatchRatio <= passRatio` (2.0 %).
//
// Covered set (documented in evidence/E3-animations.md; everything not listed
// there is excluded with a recorded reason):
//   board                     @ 0.0                     (frame 131, stopped)
//   sprite_wordball_timeline  @ 0.25 / 0.5278 / 0.8056 / 1.0556
// The wordball add path stops at the sprite's frame 10 (`getir` end state,
// DefineSprite_46/frame_10 stop()), so those four catalog offsets are the
// captured settle states; offset 0.0 is a mid-flight frame in the reference
// (the harness's click step overhead exceeds the 194 ms slide) and is recorded
// as not covered.
//
// Coverage update (task Y8, closes O23): the `intro` main-timeline span
// (frames 5–130) and its element motions (`intro_glow_motion`,
// `intro_logo_motion`) are now painted by the E3 intro timeline
// (src/ui/animations.ts + src/styles/animations.css). Their keyframe
// comparisons (catalog offsets 0 / 0.8611 / 1.75 / 2.6111 / 3.4722 s at
// deviceScaleFactor 1 + 2, folded with the boot preloader→intro→board e2e and
// the input-lock check) live in tests/e2e/intro/intro.spec.ts, which keeps this
// suite's covered set (and its count) unchanged. Reference captures:
// evidence/visual/Y8/reference-dsf{1,2}/frame-<F>.png
// (tests/e2e/intro/capture-intro-reference.mjs).
//
// Owner-approved allowance (tasks Y1/Y2): the covered keyframes pass the HD
// backdrop/knob `--ignore-rect` set plus the credit-omission region, combined
// in tests/e2e/visual-states.ts (`boardIgnoreRectArgs`/`boardIgnoreRects`), and
// the suite asserts the tool reports exactly that allowance.
//
// V2: the code timings (ANIMATION_SEQUENCES / `window.__animations.catalog()`)
// equal data/animation.json: frames, frames ÷ 36 durations, keyframe frames and
// offsets.
// V7: every animation trigger name is a D5 lifecycle event
// (src/game/lifecycle.ts `on*` callbacks) or, for sound-carrying sprites, a D4
// event name (data/sound-map.json `events` keys), and D5 actually plays those
// events (source scan).

import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_STATES } from '../../../src/game/state';
import { boardIgnoreRectArgs, boardIgnoreRects } from '../visual-states';

const REPO_ROOT = process.cwd();
const REFERENCE_DIR = path.join(REPO_ROOT, 'tests/fixtures/reference/animations');
const DATA_ANIMATION = path.join(REPO_ROOT, 'data/animation.json');
const SOUND_MAP_PATH = path.join(REPO_ROOT, 'data/sound-map.json');
const LIFECYCLE_SOURCE_PATH = path.join(REPO_ROOT, 'src/game/lifecycle.ts');
const DIFF_TOOL = path.join(REPO_ROOT, 'verify/diff/diff.mjs');
// Recorded evidence (E3) lives under evidence/visual/E3/; plain re-runs
// (verify-all/F3) write transient artifacts to test-results/; set E3_RECORD=1
// to record into the evidence directory again (E2 pattern).
const EVIDENCE_DIR = process.env.E3_RECORD
  ? path.join(REPO_ROOT, 'evidence/visual/E3')
  : path.join(REPO_ROOT, 'test-results/E3-live');

/**
 * Displayed round-clock second of the fresh reference captures (observed in
 * tests/fixtures/reference/animations/board/board-0.0.png; the board wait
 * ends at the first stable frame after the round starts). The app drives to
 * the same second so the timer value/gauge regions compare.
 */
const REFERENCE_SECOND = 199;
/** Round used by C3's served fixture (FİNALİZM); D5's TEST-ONLY selectRound. */
const REFERENCE_MAIN = 'FİNALİZM';
/**
 * App click point for tile slot 0. The reference scenario clicks the slot
 * centre (60, 330) (verify/reference/capture.mjs TILE_XS/TILE_Y); in the
 * rebuild the letter field covers that row, so the suite clicks the slot's
 * upper area (60, 310), which resolves to the tile-0 element (asserted below).
 */
const TILE0_CLICK = { x: 60, y: 310 };

interface DiffReport {
  schemaVersion: number;
  mismatchRatio: number;
  mismatchedPixels: number;
  totalPixels: number;
  mismatchThreshold: number;
  mismatchBBox: { x: number; y: number; width: number; height: number } | null;
  tolerantRadius: number;
  tolerantMismatchedPixels: number;
  tolerantMismatchRatio: number;
  tolerantMismatchBBox: { x: number; y: number; width: number; height: number } | null;
  passRatio: number;
  // Schema v3 (task Y1): opt-in region exclusions.
  ignoredRects: { x: number; y: number; w: number; h: number }[];
  ignoredPixels: number;
  pass: boolean;
}

interface CoveredKeyframe {
  sequence: string;
  offset: number;
  label: string;
  capture: string;
}

/** Documented covered set (evidence/E3-animations.md §2). */
const COVERED_KEYFRAMES: readonly CoveredKeyframe[] = [
  { sequence: 'board', offset: 0, label: '0.0', capture: 'board-0.0' },
  { sequence: 'sprite_wordball_timeline', offset: 0.25, label: '0.25', capture: 'wordball-0.25' },
  {
    sequence: 'sprite_wordball_timeline',
    offset: 0.5278,
    label: '0.5278',
    capture: 'wordball-0.5278',
  },
  {
    sequence: 'sprite_wordball_timeline',
    offset: 0.8056,
    label: '0.8056',
    capture: 'wordball-0.8056',
  },
  {
    sequence: 'sprite_wordball_timeline',
    offset: 1.0556,
    label: '1.0556',
    capture: 'wordball-1.0556',
  },
];

interface AnimationCatalogEntry {
  id: string;
  kind: string;
  state: string;
  elements: string[];
  frameStart: number;
  frameEnd: number;
  frames: number;
  durationSec: number;
  durationMs: number;
  keyframeFrames: number[];
  keyframeOffsetsSec: number[];
  trigger?: {
    source: string;
    state?: string;
    reason?: string;
    events?: string[];
    maxRemainingSeconds?: number;
  };
}

async function waitForDevHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return typeof window.__game !== 'undefined' && typeof window.__animations !== 'undefined';
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** Load the app, hide the harness fullscreen control, wait for the hooks. */
async function prepareApp(page: Page): Promise<void> {
  await page.goto('/');
  await waitForDevHooks(page);
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) {
      button.style.display = 'none';
    }
  });
}

/**
 * Drive the live app to the reference round and the recorded displayed second
 * (D5 `selectRound` is the documented TEST-ONLY hook, evidence/D5-lifecycle.md).
 */
async function driveToReferenceBoard(page: Page): Promise<void> {
  await page.evaluate((main) => {
    window.__game.selectRound(main);
  }, REFERENCE_MAIN);
  await page.waitForFunction(
    (second) => {
      const game = window.__game;
      return (
        game.state === 'playing' &&
        game.roundId === 'finalizm' &&
        game.remainingMs === second * 1000
      );
    },
    REFERENCE_SECOND,
  );
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

function runDiff(actual: string, reference: string, outDir: string): DiffReport {
  // Owner-approved allowance: the covered keyframes are board states (Y1:
  // backdrop + speaker; Y2: omitted credit sprites) at deviceScaleFactor 1.
  execFileSync(process.execPath, [DIFF_TOOL, actual, reference, outDir, ...boardIgnoreRectArgs(1)], {
    stdio: 'pipe',
  });
  const reportPath = path.join(outDir, 'report.json');
  expect(fs.existsSync(reportPath), `diff report written: ${reportPath}`).toBe(true);
  expect(fs.existsSync(path.join(outDir, 'heatmap.png')), 'heatmap artifact').toBe(true);
  return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as DiffReport;
}

async function captureStage(page: Page): Promise<Buffer> {
  return page.locator('[data-testid="stage-root"]').screenshot();
}

// ---------------------------------------------------------------------------
// V2 — code timings equal data/animation.json
// ---------------------------------------------------------------------------

test.describe('E3 V2 — animation timings equal the catalog', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('code durations/keyframes equal data/animation.json', async ({ page }) => {
    await prepareApp(page);
    const catalogJson = JSON.parse(fs.readFileSync(DATA_ANIMATION, 'utf8')) as {
      fps: number;
      sequences: {
        id: string;
        frameStart: number;
        frameEnd: number;
        frames: number;
        durationSec: number;
        keyframeFrames: number[];
        keyframeOffsetsSec: number[];
      }[];
    };
    const code = (await page.evaluate(() =>
      window.__animations!.catalog(),
    )) as unknown as AnimationCatalogEntry[];

    expect(code.length, 'catalogued sequences in code').toBe(catalogJson.sequences.length);
    expect(catalogJson.sequences.length).toBe(24);
    for (const raw of catalogJson.sequences) {
      const sequence = code.find((entry) => entry.id === raw.id);
      expect(sequence, `${raw.id} present in code`).toBeDefined();
      if (sequence === undefined) continue;
      expect(sequence.frames, `${raw.id} frames`).toBe(raw.frames);
      expect(sequence.frames, `${raw.id} frames = end - start + 1`).toBe(
        raw.frameEnd - raw.frameStart + 1,
      );
      // Duration derived from frames and the catalog fps, exactly.
      expect(Math.abs(sequence.durationSec - sequence.frames / catalogJson.fps)).toBeLessThan(
        1e-12,
      );
      expect(Math.abs(sequence.durationMs - (sequence.frames * 1000) / catalogJson.fps)).toBeLessThan(
        1e-9,
      );
      // Catalog value is the same duration rounded to 4 decimals (A3 V2c ±0.0005).
      expect(
        Math.abs(sequence.durationSec - raw.durationSec),
        `${raw.id} catalog durationSec`,
      ).toBeLessThanOrEqual(5e-4);
      expect(sequence.keyframeFrames, `${raw.id} keyframe frames`).toEqual(raw.keyframeFrames);
      expect(sequence.keyframeOffsetsSec.length, `${raw.id} keyframe offset count`).toBe(
        raw.keyframeOffsetsSec.length,
      );
      for (let index = 0; index < raw.keyframeOffsetsSec.length; index += 1) {
        expect(
          Math.abs(sequence.keyframeOffsetsSec[index]! - raw.keyframeOffsetsSec[index]!),
          `${raw.id} keyframe offset ${index}`,
        ).toBeLessThanOrEqual(5e-4);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// V7 — trigger names ⊆ D5 lifecycle events; sound clips use D4 event names
// ---------------------------------------------------------------------------

test.describe('E3 V7 — animation triggers', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('trigger names come from D5 lifecycle events and D4 audio events', async ({ page }) => {
    await prepareApp(page);
    const code = (await page.evaluate(() =>
      window.__animations!.catalog(),
    )) as unknown as AnimationCatalogEntry[];
    const soundMap = JSON.parse(fs.readFileSync(SOUND_MAP_PATH, 'utf8')) as {
      events: Record<string, unknown>;
    };
    const audioNames = new Set(Object.keys(soundMap.events));
    const lifecycleSource = fs.readFileSync(LIFECYCLE_SOURCE_PATH, 'utf8');
    // `source` -> the D5 `RoundLifecycleOptions` callback it must correspond to
    // (evidence/D5-lifecycle.md §2).
    const lifecycleCallbacks: Readonly<Record<string, string>> = {
      stateChanged: 'onStateChanged',
      roundStarted: 'onRoundStarted',
      roundCompleted: 'onRoundCompleted',
      changed: 'onChanged',
      tick: 'onTick',
    };

    expect(code.length).toBe(24);
    expect(code.filter((entry) => entry.trigger === undefined)).toEqual([]);
    const usedAudioEvents = new Set<string>();
    for (const entry of code) {
      const trigger = entry.trigger;
      expect(trigger, `${entry.id} has a trigger`).toBeDefined();
      if (trigger === undefined) continue;
      if (trigger.source === 'audio') {
        expect(trigger.events, `${entry.id} audio event list`).toBeDefined();
        expect(trigger.events!.length, `${entry.id} audio event list non-empty`).toBeGreaterThan(0);
        for (const event of trigger.events!) {
          expect(audioNames.has(event), `${entry.id} audio event "${event}" in sound-map.json`).toBe(
            true,
          );
          usedAudioEvents.add(event);
        }
        continue;
      }
      const callback = lifecycleCallbacks[trigger.source];
      expect(callback, `${entry.id} source "${trigger.source}" is a D5 lifecycle event`).toBeDefined();
      expect(lifecycleSource, `D5 exposes ${callback}`).toContain(callback!);
      if (trigger.source === 'stateChanged') {
        expect(GAME_STATES, `${entry.id} state "${trigger.state}"`).toContain(trigger.state);
      }
      if (trigger.source === 'tick' && trigger.maxRemainingSeconds !== undefined) {
        // The timer-bar gate (`bar.play()` below 10 s, evidence/A2-timer.md §2).
        expect(trigger.maxRemainingSeconds, `${entry.id} tick gate`).toBe(10);
      }
    }
    // D5 actually plays every event used by an audio trigger (no invented names).
    for (const event of usedAudioEvents) {
      expect(lifecycleSource, `D5 plays "${event}"`).toContain(`'${event}'`);
    }
  });

  test('entry change starts the wordball slide and delete slides it out', async ({ page }) => {
    await prepareApp(page);
    await driveToReferenceBoard(page);

    await page.mouse.click(TILE0_CLICK.x, TILE0_CLICK.y);
    const ball = page.locator('[data-element="wordball0"]');
    await expect(ball, 'clicked tile 0 adds the first ball').toHaveCount(1);
    await expect(ball, 'the add slide is applied').toHaveAttribute('data-anim', 'getir');
    expect(
      await page.evaluate(() => window.__animations!.plays('sprite_wordball_timeline')),
      'wordball sequence triggered',
    ).toBeGreaterThanOrEqual(1);
    // The slide must be over before the covered settle capture (8 frames / 36 fps).
    await expect(ball).not.toHaveClass(/e3-wordball-getir/, { timeout: 1000 });

    await page.keyboard.press('Backspace');
    const ghost = page.locator('[data-element="wordball0-ghost"]');
    await ghost.waitFor({ state: 'attached' });
    await expect(ghost, 'the remove slide is applied').toHaveAttribute('data-anim', 'gotur');
    await ghost.waitFor({ state: 'detached', timeout: 2000 });
    await expect(ball, 'the removed ball is gone').toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// V5 — covered animation keyframes vs the C3 scenario captures
// ---------------------------------------------------------------------------

test.describe('E3 V5 — animation keyframes', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  for (const covered of COVERED_KEYFRAMES) {
    test(`${covered.sequence} @ ${covered.label} s matches the reference capture`, async ({
      page,
    }) => {
      const reference = path.join(REFERENCE_DIR, covered.sequence, `${covered.capture}.png`);
      expect(
        fs.existsSync(reference),
        `reference capture present: tests/fixtures/reference/animations/${covered.sequence}/${covered.capture}.png`,
      ).toBe(true);

      await prepareApp(page);
      await driveToReferenceBoard(page);

      if (covered.sequence === 'sprite_wordball_timeline') {
        await page.mouse.click(TILE0_CLICK.x, TILE0_CLICK.y);
        await expect(page.locator('[data-element="wordball0"]')).toHaveCount(1);
        // Drive to the catalog offset (the slide is settled at >= 0.25 s).
        await page.waitForTimeout(covered.offset * 1000);
      }
      const actualBuffer = await captureStage(page);

      // Evidence layout per the E3 task template: `evidence/visual/E3/
      // <sequence>/<offset>.png` plus the F1 report and heatmap for the same
      // offset (renamed from the tool's fixed `report.json`/`heatmap.png`).
      const outDir = path.join(EVIDENCE_DIR, covered.sequence);
      fs.mkdirSync(outDir, { recursive: true });
      const actual = path.join(outDir, `${covered.label}.png`);
      fs.writeFileSync(actual, actualBuffer);

      const report = runDiff(actual, reference, outDir);
      fs.renameSync(
        path.join(outDir, 'report.json'),
        path.join(outDir, `${covered.label}.report.json`),
      );
      fs.renameSync(
        path.join(outDir, 'heatmap.png'),
        path.join(outDir, `${covered.label}.heatmap.png`),
      );
      const rawPercent = report.mismatchRatio * 100;
      const tolerantPercent = report.tolerantMismatchRatio * 100;
      // V2: raw metric fields stay present and numeric (monitoring only).
      expect(report.schemaVersion).toBeGreaterThanOrEqual(2);
      expect(typeof report.mismatchRatio).toBe('number');
      expect(Number.isFinite(report.mismatchRatio)).toBe(true);
      expect(Number.isInteger(report.mismatchedPixels)).toBe(true);
      expect(typeof report.mismatchBBox === 'object').toBe(true);
      expect(report.tolerantRadius).toBe(2);
      // Y1+Y2 allowance must be active and reported exactly (schema v3).
      expect(report.ignoredRects).toEqual(boardIgnoreRects(1));
      expect(report.ignoredPixels).toBeGreaterThan(0);
      console.log(
        `E3 ${covered.sequence} @ ${covered.label}s: raw=${rawPercent.toFixed(3)}% ` +
          `(${report.mismatchedPixels}/${report.totalPixels} px), ` +
          `tolerant=${tolerantPercent.toFixed(3)}% ` +
          `(${report.tolerantMismatchedPixels} px), ignoredPixels=${report.ignoredPixels}, ` +
          `pass=${report.pass}`,
      );
      expect(
        report.tolerantMismatchRatio,
        `${covered.sequence} @ ${covered.label}s tolerant mismatch ` +
          `${tolerantPercent.toFixed(3)}% (limit 2.000%)`,
      ).toBeLessThanOrEqual(report.passRatio);
      expect(report.pass).toBe(true);
    });
  }
});
