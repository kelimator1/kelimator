// tests/e2e/celebration/celebration.spec.ts — Y10 win celebration + results
// screen (task Y10, owner decision Option A).
//
// Surfaces:
//
// 1. Completion: the all-found round plays the bravo sequence (SWF frames
//    132-241; night sky + crescent moon + stars, the descending sun, the
//    wordmark motion, the results card rise and the looping firework burst of
//    element `bottom_marquee` = DefineSprite_170). State/DOM assertions only —
//    no audio assertions (silent witness runs, EXECUTION.md §8).
// 2. The results form (owner edits): `İsim` input interactive, `E-posta`
//    removed, `Gönder` placebo/local only — **zero network, nothing stored**;
//    the empty-name gate keeps the original error string; a named submit runs
//    the reference button's local navigation (`_root.gotoAndPlay("main")`
//    semantics recorded in evidence/Y10-celebration.md §form) and Yeni Oyun
//    returns to the next round exactly as before.
// 3. Keyframe comparisons (V5) at the catalogued `win` keyframes (frames
//    132/159/186/214/241 = offsets 0/0.75/1.5/2.2778/3.0278 s) against the
//    fresh reference captures (evidence/visual/Y10/reference-dsf{1,2}/,
//    captured by tests/e2e/celebration/capture-celebration-reference.mjs).
//    Frames 132-214 carry no owner allowance; frame 241 passes the recorded
//    results-card allowance (tests/e2e/visual-states.ts
//    `y10ResultsAllowance*`: owner card edits + session-dependent value
//    columns) and asserts the tool reports exactly it.
// 4. Fireworks structure: 300 `havai` sparks in the evidenced random ranges,
//    the 65-frame burst cycle repeating (sprite 170 has no `stop()`), and the
//    sprite-170 frame-1 render (frame 241) still spark-free like the
//    reference capture.
// 5. Asset guards: the owner-edited card asset carries `İsim` and no
//    `E-posta` markers and the manifest records the correction + the spark
//    sub-record (X2/Y9 guard pattern).

import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  y10ResultsAllowanceArgs,
  y10ResultsAllowanceRects,
  y10ReturnButtonArgs,
  y10ReturnButtonRects,
} from '../visual-states';

const REPO_ROOT = process.cwd();
const REFERENCE_ROOT = path.join(REPO_ROOT, 'evidence/visual/Y10');
const DATA_ANIMATION = path.join(REPO_ROOT, 'data/animation.json');
const DIFF_TOOL = path.join(REPO_ROOT, 'verify/diff/diff.mjs');
const ROUNDS_PATH = path.join(REPO_ROOT, 'src/data/rounds.json');
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/assets/manifest.json');
const EVIDENCE_DIR = process.env.Y10_RECORD
  ? path.join(REPO_ROOT, 'evidence/visual/Y10')
  : path.join(REPO_ROOT, 'test-results/Y10-live');

/** Catalogued `win` keyframes (frame ↔ offset, data/animation.json). */
const WIN_KEYFRAMES = [
  { frame: 132, offset: 0, label: '0.0' },
  { frame: 159, offset: 0.75, label: '0.75' },
  { frame: 186, offset: 1.5, label: '1.5' },
  { frame: 214, offset: 2.2778, label: '2.2778' },
  { frame: 241, offset: 3.0278, label: '3.0278' },
];

const ROUND_MAIN = 'FİNALİZM';

// ---------------------------------------------------------------------------
// Driving the app (same O04 key mapping as the F2 playthrough suite)
// ---------------------------------------------------------------------------
const POSITION_KEYS: Readonly<Record<number, string>> = {
  186: 'Semicolon',
  191: 'Slash',
  219: 'BracketLeft',
  220: 'Backslash',
  221: 'BracketRight',
  222: 'Quote',
};

const LETTER_KEY_CODES = new Map<string, number>([
  ['A', 65], ['B', 66], ['C', 67], ['Ç', 220], ['D', 68], ['E', 69], ['F', 70],
  ['G', 71], ['Ğ', 219], ['H', 72], ['I', 73], ['İ', 222], ['J', 74], ['K', 75],
  ['L', 76], ['M', 77], ['N', 78], ['O', 79], ['Ö', 191], ['P', 80], ['Q', 81],
  ['R', 82], ['S', 83], ['Ş', 186], ['T', 84], ['U', 85], ['Ü', 221], ['V', 86],
  ['W', 87], ['X', 88], ['Y', 89], ['Z', 90],
]);

function playwrightKeyName(keyCode: number): string {
  if (keyCode >= 65 && keyCode <= 90) return `Key${String.fromCharCode(keyCode)}`;
  const name = POSITION_KEYS[keyCode];
  if (name === undefined) throw new Error(`no Playwright key name for key code ${keyCode}`);
  return name;
}

const LISTED_WORDS: readonly string[] = (() => {
  const doc = JSON.parse(fs.readFileSync(ROUNDS_PATH, 'utf8')) as {
    rounds: Array<{ main: string; words: Record<string, string[]> }>;
  };
  const round = doc.rounds.find((candidate) => candidate.main === ROUND_MAIN);
  if (round === undefined) throw new Error(`${ROUND_MAIN} round in the bank`);
  return [3, 4, 5, 6, 7, 8].flatMap((length) =>
    (round.words[String(length)] ?? []).slice(0, 10),
  );
})();

async function hideHarnessChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) button.style.display = 'none';
  });
}

async function stageReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function readGame(page: Page): Promise<{
  state: string;
  roundId: string | null;
  score: number;
  foundWords: readonly string[];
  remainingMs: number;
  lastAudioEvent: string | null;
}> {
  return page.evaluate(() => ({
    state: window.__game.state,
    roundId: window.__game.roundId,
    score: window.__game.score,
    foundWords: [...window.__game.foundWords],
    remainingMs: window.__game.remainingMs,
    lastAudioEvent: window.__game.lastAudioEvent,
  }));
}

/** Completes the listed round quickly (the fast path used by the visual checks). */
async function completeRound(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(async () => (await readGame(page)).state, { timeout: 30_000 }).toBe('playing');
  await hideHarnessChrome(page);
  await stageReady(page);
  await page.evaluate((main: string) => window.__game.selectRound(main), ROUND_MAIN);
  for (const word of LISTED_WORDS) {
    for (const letter of word) {
      const keyCode = LETTER_KEY_CODES.get(letter);
      expect(keyCode, `no O04 key code for ${letter}`).toBeDefined();
      await page.keyboard.press(playwrightKeyName(keyCode!));
    }
    await page.keyboard.press('Enter');
  }
  await expect.poll(async () => (await readGame(page)).state, { timeout: 15_000 }).toBe(
    'celebration',
  );
}

interface DiffReport {
  schemaVersion: number;
  mismatchRatio: number;
  tolerantRadius: number;
  tolerantMismatchRatio: number;
  passRatio: number;
  ignoredRects: { x: number; y: number; w: number; h: number }[];
  ignoredPixels: number;
  pass: boolean;
}

function runDiff(actual: string, reference: string, outDir: string, args: string[]): DiffReport {
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync(process.execPath, [DIFF_TOOL, actual, reference, outDir, ...args], {
    stdio: 'pipe',
  });
  const report = JSON.parse(
    fs.readFileSync(path.join(outDir, 'report.json'), 'utf8'),
  ) as DiffReport;
  expect(report.schemaVersion).toBeGreaterThanOrEqual(2);
  expect(report.tolerantRadius).toBe(2);
  return report;
}

// ---------------------------------------------------------------------------
// State / form tests
// ---------------------------------------------------------------------------

test.describe('Y10 win celebration', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('completion plays the bravo sequence into the results card', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await completeRound(page);

    const game = await readGame(page);
    expect(game.foundWords).toHaveLength(LISTED_WORDS.length);

    // The win layer is mounted above the board; the board layout itself stays
    // in the DOM (E2 V7 geometry) but is not painted.
    const layer = page.locator('.e3-win-layer-root');
    await expect(layer).toHaveCount(1);
    for (const id of [
      'intro_backdrop',
      'logo_ornament',
      'intro_sky',
      'intro_ground',
      'intro_layer3',
      'intro_glow',
      'intro_logo',
      'hiscore_form',
      'bottom_marquee',
      'btn_ybuton',
    ]) {
      await expect(layer.locator(`[data-element="${id}"]`), `${id} in the win layer`).toHaveCount(1);
    }
    const boardHidden = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.board-static')!).visibility,
    );
    expect(boardHidden).toBe('hidden');

    // Results card values (reference DefineSprite_166 frame 1 script):
    // score (time bonus included), found count, elapsed whole seconds.
    const expectedElapsed = 200 - Math.floor(game.remainingMs / 1000);
    const values = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.e3-win-card-value')).map((node) => node.textContent),
    );
    expect(values).toEqual([String(game.score), String(game.foundWords.length), String(expectedElapsed)]);

    // The win timeline runs with the catalog duration (110 frames / 36 fps).
    const animations = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.animationName?.startsWith('e3-win'))
        .map((animation) => ({
          name: animation.animationName,
          duration: animation.effect?.getTiming().duration,
          iterations: animation.effect?.getTiming().iterations,
        })),
    );
    const timeline = animations.filter(
      (animation) => !animation.name.startsWith('e3-win-spark'),
    );
    for (const name of ['e3-win-sky', 'e3-win-layer3', 'e3-win-glow', 'e3-win-logo', 'e3-win-form']) {
      const found = timeline.find((animation) => animation.name === name);
      expect(found, `${name} running`).toBeDefined();
      expect(found!.duration, `${name} duration`).toBeCloseTo((110 * 1000) / 36, 3);
    }

    // The results form is live and interactive; the return affordance is up.
    await expect(page.locator('[data-testid="results-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="results-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-round"]')).toBeVisible();
    await page.locator('[data-testid="results-name"]').click();
    await page.keyboard.type('Deneme');
    await expect(page.locator('[data-testid="results-name"]')).toHaveValue('Deneme');

    // Input stays locked for the game (celebration): letters/ENTER change nothing.
    const before = await readGame(page);
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Enter');
    const after = await readGame(page);
    expect(after.state).toBe('celebration');
    expect(after.foundWords).toEqual(before.foundWords);
    expect(after.score).toBe(before.score);

    // Yeni Oyun returns to the next round exactly as before (new round live,
    // the win layer gone, the board painted again).
    await page.locator('[data-testid="new-round"]').click();
    await expect.poll(async () => (await readGame(page)).state, { timeout: 5_000 }).toBe('playing');
    await expect(page.locator('.e3-win-layer-root')).toHaveCount(0);
    await expect(page.locator('[data-element="letter0"]')).toHaveCount(1);
    const next = await readGame(page);
    expect(next.roundId).not.toBeNull();
    expect(next.roundId).not.toBe('finalizm');
    expect(pageErrors).toEqual([]);
  });

  test('the results form is local-only: zero requests, nothing stored', async ({ page }) => {
    test.setTimeout(120_000);
    await completeRound(page);
    // Everything after the win screen is network-free.
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    const storageBefore = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));

    // Empty name: the original gate error, no navigation, no request.
    await page.locator('[data-testid="results-submit"]').click();
    await expect(page.locator('[data-testid="results-error"]')).toHaveText(
      'Lütfen adınızı yazınız',
    );
    expect((await readGame(page)).state).toBe('celebration');

    // Named submit: the reference button's local navigation
    // (`_root.gotoAndPlay("main")` -> next round); no request, nothing stored.
    await page.locator('[data-testid="results-name"]').fill('Kelimatör');
    await page.locator('[data-testid="results-submit"]').click();
    await expect.poll(async () => (await readGame(page)).state, { timeout: 5_000 }).toBe('playing');
    expect(requests, 'no request during the placebo submit flow').toEqual([]);
    const storageAfter = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    expect(storageAfter).toEqual(storageBefore);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain('Kelimatör');
  });

  test('fireworks: 300 sparks in the evidenced ranges, cycling every 65 frames', async ({ page }) => {
    test.setTimeout(120_000);
    await completeRound(page);
    // At the frame-241 render the burst is still empty (the reference capture
    // frame-241.png shows no sparks; the duplicates appear on sprite frame 2):
    // freeze the timeline at the frame-241 offset (3.0278 s) and read the
    // burst wrapper of the first cycle.
    const atPlacement = await page.evaluate(async (offsetMs: number) => {
      const animations = document
        .getAnimations()
        .filter((animation) => animation.animationName?.startsWith('e3-win'));
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = offsetMs;
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return getComputedStyle(document.querySelector('.e3-win-havai')!).visibility;
    }, WIN_KEYFRAMES[4]!.offset * 1000);
    expect(atPlacement, 'frame-241 render is spark-free').toBe('hidden');

    // Resume and wait for the burst to appear (sprite frame 2, +1/36 s).
    await page.evaluate(() => {
      for (const animation of document
        .getAnimations()
        .filter((candidate) => candidate.animationName?.startsWith('e3-win'))) {
        animation.play();
      }
    });
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => getComputedStyle(document.querySelector('.e3-win-havai')!).visibility,
          ),
        { timeout: 5_000 },
      )
      .toBe('visible');
    const burst = await page.evaluate(() => {
      const wrappers = Array.from(document.querySelectorAll<HTMLElement>('.e3-win-havai'));
      const sparks = Array.from(document.querySelectorAll<HTMLElement>('.e3-win-spark'));
      const transform = (node: HTMLElement): { rot: number; scale: number } => {
        const match = /rotate\((-?[\d.]+)deg\) scale\((-?[\d.]+)\)/.exec(
          node.style.transform,
        );
        return { rot: Number(match?.[1]), scale: Number(match?.[2]) };
      };
      return {
        wrappers: wrappers.length,
        sparks: sparks.length,
        xs: wrappers.map((node) => Number.parseFloat(node.style.left)),
        ys: wrappers.map((node) => Number.parseFloat(node.style.top)),
        transforms: wrappers.map(transform),
        delays: sparks.map((node) => Number.parseFloat(node.style.animationDelay)),
        life: wrappers[0]?.getAnimations()[0]?.effect?.getTiming(),
        track: sparks[0]?.getAnimations()[0]?.effect?.getTiming(),
      };
    });
    expect(burst.wrappers).toBe(300); // reference: `sayi = 300`
    expect(burst.sparks).toBe(300);
    // One burst position (x/y are drawn once before the duplicate loop).
    expect(new Set(burst.xs).size).toBe(1);
    expect(new Set(burst.ys).size).toBe(1);
    const x = burst.xs[0]!;
    const y = burst.ys[0]!;
    expect(x).toBeGreaterThanOrEqual(50);
    expect(x).toBeLessThan(550); // int(random(500)) + 50
    expect(y).toBeGreaterThanOrEqual(50);
    expect(y).toBeLessThan(250); // int(random(200)) + 50
    for (const { rot, scale } of burst.transforms) {
      expect(rot).toBeGreaterThanOrEqual(1);
      expect(rot).toBeLessThanOrEqual(360);
      expect(scale).toBeGreaterThanOrEqual(0.05);
      expect(scale).toBeLessThanOrEqual(0.34);
    }
    for (const delay of burst.delays) {
      // gotoAndPlay(int(random(10)) + 1) -> phase 0..9 frames (negative delay).
      expect(delay).toBeLessThanOrEqual(0);
      expect(delay).toBeGreaterThanOrEqual((-9 * 1000) / 36);
    }
    // The sprite-170 cycle (65 frames) repeats forever (no `stop()`).
    expect(burst.life!.duration).toBeCloseTo((65 * 1000) / 36, 3);
    expect(burst.track!.duration).toBeCloseTo((65 * 1000) / 36, 3);
    expect(burst.life!.iterations).toBe(Infinity);
    expect(burst.track!.iterations).toBe(Infinity);

    // Spark ink: sample a bit more than two 65-frame cycles; the series must
    // show the burst re-appearing (a rise from the faded/gap phase to a
    // bright burst phase happens at least twice).
    const series: number[] = [];
    const started = Date.now();
    while (Date.now() - started < 4300) {
      series.push(await sparkInk(page));
      await page.waitForTimeout(140);
    }
    const max = Math.max(...series);
    let rises = 0;
    for (let index = 1; index < series.length; index += 1) {
      if (series[index - 1]! < 50 && series[index]! > 150) rises += 1;
    }
    console.log(`Y10 fireworks ink series (max ${max}): ${series.join(',')}`);
    expect(max, 'burst ink present').toBeGreaterThan(100);
    expect(rises, 'the 65-frame burst cycle repeats').toBeGreaterThanOrEqual(2);
  });

  test('card asset: owner edits applied, no E-posta markers, manifest records it', () => {
    const svg = fs.readFileSync(path.join(REPO_ROOT, 'src/assets/svg/s166_hiscore_form.svg'), 'utf8');
    for (const anchor of ['id="shape0"', 'id="button0"', 'id="text3"', 'id="text7"', 'id="text14"']) {
      expect(svg, `anchor ${anchor}`).toContain(anchor);
    }
    for (const glyph of [
      '#font_Verdana__4', // İ
      '#font_Verdana_s0',
      '#font_Verdana_i0',
      '#font_Verdana_m0',
    ]) {
      expect(svg, `İsim glyph ${glyph}`).toContain(glyph);
    }
    for (const marker of [
      'characterId="159"',
      '#text8',
      'id="text8"',
      'characterId="155"',
      '#text4',
      'id="text4"',
      'font_Verdana_A0',
      'font_Verdana_-0',
      'font_Verdana_p0',
      'font_Verdana_t0',
    ]) {
      expect(svg, `no E-posta/old-label marker ${marker}`).not.toContain(marker);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
      assets: Record<
        string,
        Record<string, unknown> & { spark?: Array<Record<string, unknown>> }
      >;
    };
    const card = manifest.assets['svg/s166_hiscore_form.svg'];
    expect(card, 'card manifest entry').toBeDefined();
    expect(card!.correction).toBe('owner-card-edits');
    const marquee = manifest.assets['svg/s170_bottom_marquee.svg'];
    expect(marquee, 'marquee manifest entry').toBeDefined();
    const spark = marquee!.spark?.[0];
    expect(spark, 'spark sub-record').toBeDefined();
    expect(spark!.source).toBe('artifacts/decompiled/sprites/DefineSprite_168/1.svg');
    expect(spark!.correction).toBe('spark-current-color');
    const sparkFile = path.join(
      REPO_ROOT,
      String(spark!.name).replace('svg/', 'src/assets/svg/').replace('svg/svg/', 'src/assets/svg/'),
    );
    expect(fs.existsSync(sparkFile), `spark file ${sparkFile}`).toBe(true);
    const sparkSvg = fs.readFileSync(sparkFile, 'utf8');
    expect(sparkSvg.match(/stroke="currentColor"/g) ?? []).toHaveLength(2);
    expect(sparkSvg).not.toContain('#ff2b00');
  });
});

// ---------------------------------------------------------------------------
// Keyframe comparisons (V5)
// ---------------------------------------------------------------------------

for (const dsf of [1, 2] as const) {
  test.describe(`Y10 win keyframes — deviceScaleFactor ${dsf}`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    for (const keyframe of WIN_KEYFRAMES) {
      test(`win @ ${keyframe.label} s (frame ${keyframe.frame}) matches the reference capture`, async ({
        page,
      }) => {
        test.setTimeout(150_000);
        const reference = path.join(
          REFERENCE_ROOT,
          `reference-dsf${dsf}`,
          `frame-${String(keyframe.frame).padStart(3, '0')}.png`,
        );
        expect(fs.existsSync(reference), `reference capture present: ${reference}`).toBe(true);

        await completeRound(page);
        // Freeze the win timeline at the catalog offset (deterministic; no
        // wall-clock waits). The sparks are hidden at 3.0278 s (their cycle
        // starts at frame 2), so the frame-241 render is spark-free like the
        // reference capture.
        const info = await page.evaluate(async (offsetMs: number) => {
          await document.fonts.ready;
          const animations = document
            .getAnimations()
            .filter((animation) => animation.animationName?.startsWith('e3-win'));
          for (const animation of animations) {
            animation.pause();
            // +0.05 ms: the generated keyframe stops round to 6 decimal
            // percentages, so the catalog offset can fall a hair *before* the
            // target frame's stop (steps(1, end) would then still hold the
            // previous frame for <0.001 ms). The nudge stays inside the
            // reference's 1/36 s frame slot.
            animation.currentTime = offsetMs + 0.05;
          }
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          return { count: animations.length, state: window.__game.state };
        }, keyframe.offset * 1000);
        expect(info.count).toBeGreaterThan(0);
        expect(info.state).toBe('celebration');

        const outDir = path.join(EVIDENCE_DIR, `win-f${keyframe.frame}`, `dsf${dsf}`);
        fs.mkdirSync(outDir, { recursive: true });
        const actual = path.join(outDir, 'actual.png');
        await page.locator('[data-testid="stage-root"]').screenshot({ path: actual });

        // Every win frame carries the recorded Yeni Oyun deviation (the owner
        // keeps the return button; the reference hides it at frame 132); the
        // frame-241 card adds the results-card allowance (owner edits +
        // session-dependent value columns).
        const allowance =
          keyframe.frame === 241
            ? [...y10ReturnButtonArgs(dsf), ...y10ResultsAllowanceArgs(dsf)]
            : y10ReturnButtonArgs(dsf);
        const report = runDiff(actual, reference, outDir, allowance);
        fs.renameSync(
          path.join(outDir, 'report.json'),
          path.join(outDir, `${keyframe.label}.report.json`),
        );
        fs.renameSync(
          path.join(outDir, 'heatmap.png'),
          path.join(outDir, `${keyframe.label}.heatmap.png`),
        );
        expect(report.ignoredRects).toEqual([
          ...y10ReturnButtonRects(dsf),
          ...(keyframe.frame === 241 ? y10ResultsAllowanceRects(dsf) : []),
        ]);
        expect(report.ignoredPixels).toBeGreaterThan(0);
        const rawPercent = report.mismatchRatio * 100;
        const tolerantPercent = report.tolerantMismatchRatio * 100;
        console.log(
          `Y10 win frame ${keyframe.frame} dsf${dsf}: raw=${rawPercent.toFixed(3)}% ` +
            `tolerant=${tolerantPercent.toFixed(3)}% ignoredPixels=${report.ignoredPixels} ` +
            `pass=${report.pass}`,
        );
        expect(
          report.tolerantMismatchRatio,
          `win frame ${keyframe.frame} dsf${dsf} tolerant mismatch ` +
            `${tolerantPercent.toFixed(3)}% (limit 2.000%)`,
        ).toBeLessThanOrEqual(report.passRatio);
        expect(report.pass).toBe(true);
      });
    }
  });
}

// The catalog cross-check (V2): the suite drives the offsets it asserts.
test.describe('Y10 win catalog cross-check', () => {
  test('win keyframes match data/animation.json', () => {
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
    const win = catalog.sequences.find((sequence) => sequence.id === 'win')!;
    expect(win.frameStart).toBe(132);
    expect(win.frameEnd).toBe(241);
    expect(win.frames).toBe(110);
    expect(win.keyframeFrames).toEqual(WIN_KEYFRAMES.map((keyframe) => keyframe.frame));
    for (let index = 0; index < WIN_KEYFRAMES.length; index += 1) {
      expect(
        Math.abs(win.keyframeOffsetsSec[index]! - WIN_KEYFRAMES[index]!.offset),
      ).toBeLessThanOrEqual(5e-4);
    }
  });
});

/** Spark ink of the firework burst (same metric as the reference capture). */
async function sparkInk(page: Page): Promise<number> {
  const shot = await page.locator('[data-testid="stage-root"]').screenshot();
  const { decodePng } = (await import('../../../verify/diff/diff.mjs')) as {
    decodePng: (input: Buffer) => { width: number; height: number; data: Uint8ClampedArray };
  };
  const img = decodePng(shot);
  let ink = 0;
  for (let y = 30; y < 190; y += 1) {
    for (let x = 30; x < 550; x += 1) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i]!;
      const g = img.data[i + 1]!;
      const b = img.data[i + 2]!;
      if ((r - b > 80 && r > 150) || (g - b > 80 && g > 150) || (b - r > 50 && b > 120 && b - g > 40)) {
        ink += 1;
      }
    }
  }
  return ink;
}
