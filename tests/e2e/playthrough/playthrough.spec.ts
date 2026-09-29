// tests/e2e/playthrough/playthrough.spec.ts — F2 E2E playthrough (V6) + S9
// timeout variant (V5).
//
// Drives the app through the shared deterministic script
// `tests/fixtures/playthrough.json` (FİNALİZM, `window.__game.selectRound`,
// docs/04 §6) and asserts `window.__game` after every step (score per the
// docs/07 §1 oracle, found-list growth, state transitions, audio events,
// entry). Every step is screenshotted (550×400 stage) and compared with the
// C3 reference capture of the same step through F1's diff tool
// (verify/diff/diff.mjs); the pass basis is the anti-aliasing-tolerant ratio
// ≤ 0.02 (docs/07 §4, Amendment 2026-09-28). Owner-approved allowance (tasks
// Y1/Y2): every compared step passes the HD backdrop/knob `--ignore-rect` set
// plus the credit-omission region, combined in tests/e2e/visual-states.ts
// (`boardIgnoreRectArgs`/`boardIgnoreRects`), and the suite asserts the tool
// reports exactly that allowance. The combined machine-readable
// report is written to evidence/F2-report.json in record mode (F2_RECORD=1,
// frozen evidence) and to test-results/F2-live/F2-report.json otherwise
// (live runs; evidence-freeze amendment 2026-09-28).
//
// Oracle: the expected per-step state is computed at run time with D1's
// exported tracker and D3's scoring (imported from the Vite-served modules
// inside the page) driven with exactly the script's add/clear/submit order;
// nothing is guessed. The bonus-block metadata of the script (seed 2012,
// first lucky roll index 52 / add 53, bright ball index 1) is validated
// against the same simulation. Spot rows from docs/07 §1 are asserted
// (450 / 5800 / 3200).
//
// Deck parity (evidence/C3-stability.md §3/§5): the reference's deck shuffle is
// unseeded; the app's is the D2 seeded permutation. `deck-match.json` records
// the deck arrangement observed in the committed reference `00-selected`
// capture (and, where observable, the slot -> instance order) plus the first
// production shuffle count whose D2 permutation equals it. This spec re-runs
// that search over the D2 algorithm, advances the app to that deal, and asserts
// the rendered tile letters — so the pixel comparison measures rendering, not
// shuffle randomness. No threshold is altered.
//
// Bonus step: docs/07 §5 S7 defines the state as the submitted bonus word; the
// script's 19-bonus-word step submits ANİF with the D1 tracker's ball = 1
// (bright ball index), validated against the in-page simulation, and the +5000
// is asserted through the score oracle. The reference's pre-submit
// bright/orange ball is its own randomness (evidence/C3-stability.md §3) and is
// not painted by the rebuild (src/ui/animations.ts header: only the normal
// wordball slide is painted), so it is not a compared capture.
//
// Completion step (39-complete): the reference's all-found results screen is
// excluded from the rebuild (docs/02 §7; evidence/D5-lifecycle.md §9.3) — the
// app stays on the board in `celebration` while the reference shows the
// night-sky `bravo` screen (E2's scoped state list S1–S7/S10 follows the same
// exclusion). The step's app state/score/time-bonus assertions run and the
// reference end screen is captured (C3 waitForState hiscore-form), but a
// full-stage pixel comparison at this step is not applicable and is recorded
// as `comparison: excluded` with the documented reason — never as a pass.
//
// Silent witness runs (EXECUTION.md §8): Chromium is launched with
// `--mute-audio` (playwright.config.ts); no audio is played or verified by
// audibility.

import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { LETTER_KEY_CODES } from '../../../src/game/input';
import { boardIgnoreRectArgs, boardIgnoreRects } from '../visual-states';

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = path.join(REPO_ROOT, 'tests/fixtures/playthrough.json');
const REFERENCE_DIR = path.join(REPO_ROOT, 'tests/fixtures/reference/playthrough');
const DECK_MATCH_PATH = path.join(REFERENCE_DIR, 'deck-match.json');
const REFERENCE_SCENARIO_REPORT = path.join(REFERENCE_DIR, 'scenario-report.json');
const TIMEOUT_REFERENCE_DIR = path.join(REFERENCE_DIR, 'timeout');
const TIMEOUT_REFERENCE_SCENARIO_REPORT = path.join(TIMEOUT_REFERENCE_DIR, 'scenario-report.json');
const DIFF_TOOL = path.join(REPO_ROOT, 'verify/diff/diff.mjs');
const ROUNDS_PATH = path.join(REPO_ROOT, 'src/data/rounds.json');

// Frozen evidence is written only in record mode (evidence-freeze amendment
// 2026-09-28; the pattern of E2's visual suite).
const EVIDENCE_DIR = process.env.F2_RECORD
  ? path.join(REPO_ROOT, 'evidence/visual/F2')
  : path.join(REPO_ROOT, 'test-results/F2-live');
const REPORT_FILE = process.env.F2_RECORD
  ? path.join(REPO_ROOT, 'evidence/F2-report.json')
  : path.join(EVIDENCE_DIR, 'F2-report.json');

const ROUND_MAIN = 'FİNALİZM';
const ROUND_ID = 'finalizm';

// ---------------------------------------------------------------------------
// Script fixture
// ---------------------------------------------------------------------------

interface ScriptStep {
  readonly id: string;
  readonly action: 'select' | 'type' | 'submit' | 'clear';
  readonly word?: string;
  readonly entry?: string;
  readonly outcome?: 'valid' | 'invalid' | 'duplicate' | 'completion';
  readonly count?: number;
  readonly capture: string;
}

interface BonusEvent {
  readonly type: 'lucky' | 'paid';
  readonly word: string;
  readonly globalAdd?: number;
  readonly entryAdd?: number;
  readonly rollIndex?: number;
  readonly rollValue?: number;
  readonly ball: number;
  readonly bonusPoints?: number;
}

interface PlaythroughScript {
  readonly schemaVersion: number;
  readonly round: string;
  readonly bonus: {
    readonly seed: number;
    readonly designatedWord: string;
    readonly designatedStep: string;
    readonly firstLuckyRollIndex: number;
    readonly firstLuckyGlobalAdd: number;
    readonly firstLuckyRollValue: number;
    readonly brightBallIndex: number;
    readonly brightLetter: string;
    readonly allBonusEvents: readonly BonusEvent[];
  };
  readonly steps: readonly ScriptStep[];
}

interface DeckMatch {
  readonly arrangement: string;
  readonly instanceOrder: readonly number[];
  readonly selectRoundCalls: number;
  readonly seed: number;
}

const script = JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf8')) as PlaythroughScript;
const deckMatch = JSON.parse(fs.readFileSync(DECK_MATCH_PATH, 'utf8')) as DeckMatch;
const constants = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'data/constants.json'), 'utf8'),
) as {
  timer: { initialSeconds: number; tickMs: number };
  scoring: { perLetterSquaredFactor: number; bonusPoints: number; timeFactor: number };
  bonusLetter: { seed: number };
};

/** Bank round words (cap-aware listed slots use the same first-10 per length). */
const BANK_ROUND = (() => {
  const doc = JSON.parse(fs.readFileSync(ROUNDS_PATH, 'utf8')) as {
    rounds: Array<{ main: string; words: Record<string, string[]> }>;
  };
  const round = doc.rounds.find((candidate) => candidate.main === ROUND_MAIN);
  expect(round, `${ROUND_MAIN} round in the bank`).toBeDefined();
  return round!;
})();
const LISTED_WORDS = [3, 4, 5, 6, 7, 8].flatMap((length) =>
  (BANK_ROUND.words[String(length)] ?? []).slice(0, 10).map((word) => ({ length, word })),
);

// ---------------------------------------------------------------------------
// Driving the app
// ---------------------------------------------------------------------------

// Playwright US-layout key names for the O04 numeric key codes (D5 basic spec,
// evidence/D2-input.md §2).
const POSITION_KEYS: Readonly<Record<number, string>> = {
  186: 'Semicolon', // Ş
  191: 'Slash', // Ö
  219: 'BracketLeft', // Ğ
  220: 'Backslash', // Ç
  221: 'BracketRight', // Ü
  222: 'Quote', // İ
};

function playwrightKeyName(keyCode: number): string {
  if (keyCode >= 65 && keyCode <= 90) return `Key${String.fromCharCode(keyCode)}`;
  const name = POSITION_KEYS[keyCode];
  if (name === undefined) throw new Error(`no Playwright key name for key code ${keyCode}`);
  return name;
}

const LETTER_KEY_CODE = new Map(LETTER_KEY_CODES.map(([code, letter]) => [letter, code]));

async function typeWord(page: Page, word: string): Promise<void> {
  for (const letter of word) {
    const keyCode = LETTER_KEY_CODE.get(letter);
    expect(keyCode, `no O04 key code for ${letter}`).toBeDefined();
    await page.keyboard.press(playwrightKeyName(keyCode!));
  }
}

async function clearEntry(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await page.keyboard.press('Backspace');
}

interface GameRead {
  readonly state: string;
  readonly roundId: string | null;
  readonly foundWords: readonly string[];
  readonly score: number;
  readonly remainingMs: number;
  readonly lastAudioEvent: string | null;
}

async function readGame(page: Page): Promise<GameRead> {
  return page.evaluate(() => {
    const game = (
      window as unknown as {
        __game: {
          state: string;
          roundId: string | null;
          foundWords: readonly string[];
          score: number;
          remainingMs: number;
          lastAudioEvent: string | null;
        };
      }
    ).__game;
    return {
      state: game.state,
      roundId: game.roundId,
      foundWords: [...game.foundWords],
      score: game.score,
      remainingMs: game.remainingMs,
      lastAudioEvent: game.lastAudioEvent,
    };
  });
}

async function entryText(page: Page): Promise<string> {
  return (await page.locator('[data-testid="entry"]').textContent()) ?? '';
}

async function stageReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

/** Hide the C2 harness chrome that has no counterpart in the reference. */
async function hideHarnessChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) button.style.display = 'none';
  });
}

/**
 * Stable-frame check for app captures, mirroring C3's `waitStable` discipline
 * (3 identical consecutive stage frames, 150 ms apart; the timer digits only
 * change once per second, so a stable window exists between ticks). E3's
 * wordball slide animation ends with the ball in its settled position; captures
 * are taken only after the stage has stopped changing.
 */
async function waitForStageStable(
  page: Page,
  options: { samples?: number; intervalMs?: number; timeoutMs?: number } = {},
): Promise<{ stable: boolean; samples: number; elapsedMs: number }> {
  const samples = options.samples ?? 3;
  const intervalMs = options.intervalMs ?? 150;
  const timeoutMs = options.timeoutMs ?? 8000;
  const stage = page.locator('[data-testid="stage-root"]');
  const started = Date.now();
  let previous: Buffer | null = null;
  let streak = 0;
  let count = 0;
  while (Date.now() - started < timeoutMs) {
    const shot = await stage.screenshot();
    count += 1;
    streak = previous !== null && shot.equals(previous) ? streak + 1 : 1;
    if (streak >= samples) {
      return { stable: true, samples: count, elapsedMs: Date.now() - started };
    }
    previous = shot;
    await page.waitForTimeout(intervalMs);
  }
  return { stable: false, samples: count, elapsedMs: Date.now() - started };
}

// ---------------------------------------------------------------------------
// Oracle (D1 tracker + D3 scoring, computed in the page from the app modules)
// ---------------------------------------------------------------------------

interface OracleStepState {
  readonly score: number;
  readonly found: readonly string[];
  readonly entry: string;
  readonly state: string;
  readonly audio: string;
  readonly ball: number;
  /** Tracker ball immediately before the step's submit (submit steps only). */
  readonly ballBeforeSubmit: number | null;
}

interface OracleResult {
  readonly steps: readonly OracleStepState[];
  readonly bonusEvents: readonly BonusEvent[];
  readonly spotChecks: { readonly fal: number; readonly anifWithBonus: number; readonly finalizmBase: number };
}

async function simulateScript(page: Page): Promise<OracleResult> {
  return page.evaluate(
    async (input: {
      steps: ReadonlyArray<{
        action: string;
        word?: string;
        entry?: string;
        outcome?: string;
        count?: number;
      }>;
      seed: number;
      scoring: { perLetterSquaredFactor: number; bonusPoints: number; timeFactor: number };
    }) => {
      interface RandomSource {
        randomInt(range: number): number;
      }
      interface Tracker {
        readonly ball: number;
        readonly hasPendingBonus: boolean;
        addLetter(entryLengthAfterAdd: number): void;
        removeLastLetter(entryLengthBeforeRemove: number): void;
        clearEntry(entryLengthBeforeClear: number): void;
      }
      const roundModule = (await import('/src/game/round.ts')) as {
        createSeededRandom(seed: number): RandomSource;
        createBonusLetterTracker(random: RandomSource): Tracker;
      };
      const scoringModule = (await import('/src/game/scoring.ts')) as {
        scoreWord(
          word: string,
          bonusBall: number,
          scoring: { perLetterSquaredFactor: number; bonusPoints: number; timeFactor: number },
        ): { totalPoints: number };
      };

      const rolls: number[] = [];
      const inner = roundModule.createSeededRandom(input.seed);
      const recording: RandomSource = {
        randomInt(range: number): number {
          const value = inner.randomInt(range);
          rolls.push(value);
          return value;
        },
      };
      const tracker = roundModule.createBonusLetterTracker(recording);
      const bonusEvents: BonusEvent[] = [];
      const states: OracleStepState[] = [];

      let entryLength = 0;
      let globalAdd = 0;
      let score = 0;
      let state = 'playing';
      let audio = 'roundStart';
      const found: string[] = [];

      const addLetter = (step: { word?: string }): void => {
        globalAdd += 1;
        entryLength += 1;
        const previousBall = tracker.ball;
        tracker.addLetter(entryLength);
        if (previousBall === -1 && tracker.ball > -1) {
          bonusEvents.push({
            type: 'lucky',
            word: step.word ?? '',
            globalAdd,
            entryAdd: entryLength,
            rollIndex: rolls.length - 1,
            rollValue: rolls[rolls.length - 1],
            ball: tracker.ball,
          });
        }
        audio = 'letterKey';
      };

      for (const step of input.steps) {
        let entry = '';
        let ballBeforeSubmit: number | null = null;
        if (step.action === 'type') {
          const word = step.word ?? '';
          for (let i = 0; i < [...word].length; i += 1) addLetter(step);
          entry = word;
        } else if (step.action === 'clear') {
          for (let i = 0; i < (step.count ?? 0); i += 1) {
            tracker.removeLastLetter(entryLength);
            entryLength -= 1;
          }
          audio = 'delete';
        } else if (step.action === 'submit') {
          if (step.word) {
            for (let i = 0; i < [...step.word].length; i += 1) addLetter(step);
          }
          const word = step.word ?? step.entry ?? '';
          ballBeforeSubmit = tracker.ball;
          if (step.outcome === 'valid' || step.outcome === 'completion') {
            if (tracker.hasPendingBonus) {
              bonusEvents.push({
                type: 'paid',
                word,
                ball: tracker.ball,
                bonusPoints: input.scoring.bonusPoints,
              });
            }
            const result = scoringModule.scoreWord(word, tracker.ball, input.scoring);
            score += result.totalPoints;
            found.push(word);
            tracker.clearEntry(entryLength);
            entryLength = 0;
            audio = 'submitValid';
            if (step.outcome === 'completion') state = 'celebration';
          } else if (step.outcome === 'duplicate') {
            audio = 'submitAlreadyFound';
            entry = word;
          } else {
            audio = 'submitInvalid';
            entry = word;
          }
        }
        states.push({
          score,
          found: [...found],
          entry,
          state,
          audio,
          ball: tracker.ball,
          ballBeforeSubmit,
        });
      }

      return {
        steps: states,
        bonusEvents,
        spotChecks: {
          fal: scoringModule.scoreWord('FAL', -1, input.scoring).totalPoints,
          anifWithBonus: scoringModule.scoreWord('ANİF', 0, input.scoring).totalPoints,
          finalizmBase: scoringModule.scoreWord('FİNALİZM', -1, input.scoring).totalPoints,
        },
      };
    },
    {
      steps: script.steps.map((step) => ({
        action: step.action,
        ...(step.word === undefined ? {} : { word: step.word }),
        ...(step.entry === undefined ? {} : { entry: step.entry }),
        ...(step.outcome === undefined ? {} : { outcome: step.outcome }),
        ...(step.count === undefined ? {} : { count: step.count }),
      })),
      seed: constants.bonusLetter.seed,
      scoring: constants.scoring,
    },
  );
}

/** Re-runs the deck-match search with D2's exported shuffle algorithm. */
async function findDeckShuffleCount(page: Page): Promise<number | null> {
  return page.evaluate(
    async (input: { target: readonly number[]; base: number; max: number }) => {
      const tilesModule = (await import('/src/game/tiles.ts')) as {
        shuffleOrder(count: number, seed: number): readonly number[];
      };
      for (let k = 1; k <= input.max; k += 1) {
        const order = tilesModule.shuffleOrder(8, input.base + k);
        let same = order.length === input.target.length;
        for (let slot = 0; same && slot < order.length; slot += 1) {
          if (order[slot] !== input.target[slot]) same = false;
        }
        if (same) return k;
      }
      return null;
    },
    { target: deckMatch.instanceOrder, base: constants.bonusLetter.seed, max: 300000 },
  );
}

async function renderedTileLetters(page: Page): Promise<string> {
  return page.evaluate(() => {
    const letters: string[] = [];
    for (let slot = 0; slot < 8; slot += 1) {
      const element = document.querySelector(`[data-element="letter${slot}"]`);
      letters.push(element?.textContent?.trim() ?? '?');
    }
    return letters.join('');
  });
}

// ---------------------------------------------------------------------------
// Diff against the reference captures (F1 tool; V5 pass basis)
// ---------------------------------------------------------------------------

interface DiffRead {
  readonly report: {
    readonly schemaVersion: number;
    readonly tolerantRadius: number;
    readonly mismatchRatio: number;
    readonly tolerantMismatchRatio: number;
    readonly passRatio: number;
    // Schema v3 (task Y1): opt-in region exclusions.
    readonly ignoredRects: { x: number; y: number; w: number; h: number }[];
    readonly ignoredPixels: number;
    readonly pass: boolean;
  };
  readonly dir: string;
}

function runDiff(actual: string, reference: string, outDir: string): DiffRead {
  fs.mkdirSync(outDir, { recursive: true });
  // Owner-approved allowance: every compared step is a board state (Y1:
  // backdrop + speaker; Y2: omitted credit sprites) at deviceScaleFactor 1.
  execFileSync(process.execPath, [DIFF_TOOL, actual, reference, outDir, ...boardIgnoreRectArgs(1)], {
    stdio: 'pipe',
  });
  const reportPath = path.join(outDir, 'report.json');
  expect(fs.existsSync(reportPath), `diff report written: ${reportPath}`).toBe(true);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as DiffRead['report'];
  // V2: the raw and tolerant metrics stay present and numeric.
  expect(report.schemaVersion).toBeGreaterThanOrEqual(2);
  expect(report.tolerantRadius).toBe(2);
  expect(typeof report.mismatchRatio).toBe('number');
  expect(typeof report.tolerantMismatchRatio).toBe('number');
  // Y1+Y2 allowance must be active and reported exactly (schema v3).
  expect(report.ignoredRects).toEqual(boardIgnoreRects(1));
  expect(report.ignoredPixels).toBeGreaterThan(0);
  return { report, dir: outDir };
}

// ---------------------------------------------------------------------------
// Combined machine-readable report (V2)
// ---------------------------------------------------------------------------

interface StepRecord {
  index: number;
  id: string;
  capture: string;
  action: string;
  word: string | null;
  outcome: string | null;
  score: number;
  appScore: number;
  timeBonus: number | null;
  foundCount: number;
  entry: string;
  state: string;
  audio: string;
  checks: Record<string, boolean>;
  stableAtCapture: boolean;
  comparison: { excluded: boolean; reason?: string };
  mismatchRatio: number | null;
  tolerantMismatchRatio: number | null;
  pass: boolean | null;
  reference: string;
  artifacts: string | null;
}

interface F2Report {
  schemaVersion: number;
  task: string;
  generatedAt: string;
  reference: Record<string, unknown>;
  deckMatch: Record<string, unknown>;
  oracle: Record<string, unknown>;
  playthrough: { steps: StepRecord[] } | null;
  timeout: StepRecord | null;
  summary: Record<string, unknown>;
}

function loadReport(): F2Report {
  if (fs.existsSync(REPORT_FILE)) {
    return JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8')) as F2Report;
  }
  return {
    schemaVersion: 1,
    task: 'F2',
    generatedAt: new Date().toISOString(),
    reference: {},
    deckMatch: {},
    oracle: {},
    playthrough: null,
    timeout: null,
    summary: {},
  };
}

function refreshSummary(report: F2Report): void {
  const steps = [...(report.playthrough?.steps ?? []), ...(report.timeout ? [report.timeout] : [])];
  const compared = steps.filter((step) => step.pass !== null);
  const excluded = steps.filter((step) => step.pass === null);
  const ratios = compared.map((step) => step.tolerantMismatchRatio ?? 0);
  report.summary = {
    steps: steps.length,
    compared: compared.length,
    passed: compared.filter((step) => step.pass === true).length,
    excluded: excluded.length,
    excludedIds: excluded.map((step) => step.id),
    worstTolerantRatio: ratios.length === 0 ? null : Math.max(...ratios),
    allChecks: steps.every((step) => Object.values(step.checks).every((value) => value === true)),
    allComparedPass: compared.every((step) => step.pass === true),
    allPass: steps.every((step) => Object.values(step.checks).every((value) => value === true)) && compared.every((step) => step.pass === true),
  };
}

function saveReport(report: F2Report): void {
  report.generatedAt = new Date().toISOString();
  refreshSummary(report);
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Main test — scripted playthrough (V6, V2)
// ---------------------------------------------------------------------------

test.describe('F2 scripted playthrough', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('FİNALİZM: every step matches the docs/07 oracle and the reference capture', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    await expect.poll(async () => (await readGame(page)).state).toBe('playing');
    await hideHarnessChrome(page);
    await stageReady(page);

    // --- oracle: D1 tracker + D3 scoring over the exact script order ---------
    const oracle = await simulateScript(page);
    expect(oracle.spotChecks.fal, 'docs/07 §1: 3-letter no bonus').toBe(450);
    expect(oracle.spotChecks.anifWithBonus, 'docs/07 §1: 4-letter bonus word').toBe(5800);
    expect(oracle.spotChecks.finalizmBase, 'docs/07 §1: 8-letter base').toBe(3200);

    // Bonus metadata: validated against the simulation (never guessed).
    expect(
      oracle.bonusEvents
        .filter((event) => event.type === 'lucky')
        .map((event) => ({
          type: event.type,
          word: event.word,
          globalAdd: event.globalAdd,
          entryAdd: event.entryAdd,
          rollIndex: event.rollIndex,
          rollValue: event.rollValue,
          ball: event.ball,
        })),
    ).toEqual(script.bonus.allBonusEvents.filter((event) => event.type === 'lucky'));
    expect(
      oracle.bonusEvents
        .filter((event) => event.type === 'paid')
        .map((event) => ({
          type: event.type,
          word: event.word,
          ball: event.ball,
          bonusPoints: event.bonusPoints,
        })),
    ).toEqual(
      script.bonus.allBonusEvents
        .filter((event) => event.type === 'paid')
        .map((event) => ({
          type: event.type,
          word: event.word,
          ball: event.ball,
          bonusPoints: event.bonusPoints,
        })),
    );
    const bonusStepIndex = script.steps.findIndex((step) => step.id === script.bonus.designatedStep);
    expect(bonusStepIndex, 'designated bonus step exists').toBeGreaterThanOrEqual(0);
    expect(
      oracle.steps[bonusStepIndex]!.ballBeforeSubmit,
      'designated bonus step: bright ball index at submit',
    ).toBe(script.bonus.brightBallIndex);
    expect(script.bonus.designatedWord[script.bonus.brightBallIndex]).toBe(
      script.bonus.brightLetter,
    );

    // --- deck parity: advance to the deal the reference capture shows --------
    const foundCount = await findDeckShuffleCount(page);
    expect(foundCount, 'deck instance order is reachable by a production shuffle count').toBe(
      deckMatch.selectRoundCalls,
    );
    const advanceMs = await page.evaluate((calls: number) => {
      const started = performance.now();
      const game = (window as unknown as { __game: { selectRound(main: string): void } }).__game;
      for (let i = 0; i < calls; i += 1) game.selectRound('FİNALİZM');
      return performance.now() - started;
    }, deckMatch.selectRoundCalls);
    const rendered = await renderedTileLetters(page);
    expect(rendered, 'rendered deck matches the reference capture arrangement').toBe(
      deckMatch.arrangement,
    );
    const selected = await readGame(page);
    expect(selected.roundId).toBe(ROUND_ID);
    expect(selected.score).toBe(0);

    // --- reference side metadata (produced by the C3 scenario run) -----------
    const scenarioReport = JSON.parse(
      fs.readFileSync(REFERENCE_SCENARIO_REPORT, 'utf8'),
    ) as {
      ok: boolean;
      missingKeys: string[];
      steps: Array<{ ok: boolean; result?: { condition?: string; matched?: boolean } }>;
    };
    expect(scenarioReport.ok, 'reference scenario ran green').toBe(true);
    expect(scenarioReport.missingKeys, 'reference scenario had no missing key mappings').toEqual([]);
    const hiscoreStep = scenarioReport.steps.find(
      (step) => step.result?.condition === 'hiscore-form',
    );
    expect(hiscoreStep?.result?.matched, 'reference reached the all-found end screen').toBe(true);

    // --- report scaffold ------------------------------------------------------
    const report = loadReport();
    report.reference = {
      captures: path.relative(REPO_ROOT, REFERENCE_DIR),
      scenario: 'tests/fixtures/reference/playthrough/scenarios/playthrough.json',
      scenarioReport: path.relative(REPO_ROOT, REFERENCE_SCENARIO_REPORT),
      scenarioReportOk: scenarioReport.ok,
      runCommand:
        'node verify/reference/capture.mjs --scenario tests/fixtures/reference/playthrough/scenarios/playthrough.json --out tests/fixtures/reference/playthrough --runs 1 --port 8797',
      stateWait: 'hiscore-form matched (reference all-found end screen)',
    };
    report.deckMatch = {
      arrangement: deckMatch.arrangement,
      instanceOrder: deckMatch.instanceOrder,
      selectRoundCalls: deckMatch.selectRoundCalls,
      seed: deckMatch.seed,
      advanceMs: Math.round(advanceMs),
      renderedLetters: rendered,
      method:
        'reference deck observed in the committed 00-selected capture; app advanced to the first D2 shuffle count with the same rendered arrangement (instance order recorded; the reference İ instance mapping is unobservable in this capture set)',
    };
    report.oracle = {
      source: 'D1 createSeededRandom/createBonusLetterTracker + D3 scoreWord (Vite modules)',
      seed: constants.bonusLetter.seed,
      spotChecks: oracle.spotChecks,
      bonusEvents: oracle.bonusEvents,
    };
    report.playthrough = { steps: [] };

    // --- step loop ------------------------------------------------------------
    const completionStepId = '39-complete';
    const completionExclusionReason =
      'Reference all-found results screen (bravo/hiscore form) is excluded from the rebuild ' +
      '(docs/02 §7; evidence/D5-lifecycle.md §9.3); the app stays on the board in `celebration` ' +
      'while the reference shows the night-sky results screen. E2 scoped its state list to S1–S7/S10 ' +
      'for the same exclusion. App state/score/time-bonus are asserted; the reference end screen is ' +
      'captured via waitForState hiscore-form.';

    let worst = 0;
    for (const [index, step] of script.steps.entries()) {
      const expected = oracle.steps[index]!;
      let timeBonus: number | null = null;

      if (step.action === 'select') {
        // The deck advance above already selected the round; nothing to drive.
      } else if (step.action === 'type') {
        await typeWord(page, step.word ?? '');
        await expect.poll(async () => await entryText(page)).toBe(step.word ?? '');
      } else if (step.action === 'submit') {
        if (step.word !== undefined) {
          await typeWord(page, step.word);
          expect(await entryText(page), `entry before ${step.id}`).toBe(step.word);
        }
        if (step.entry !== undefined) {
          expect(await entryText(page), `entry before ${step.id}`).toBe(step.entry);
        }
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe(expected.audio);
      } else if (step.action === 'clear') {
        await clearEntry(page, step.count ?? 0);
        await expect.poll(async () => await entryText(page)).toBe('');
      }

      const current = await readGame(page);
      const entry = await entryText(page);

      const checks: Record<string, boolean> = {
        score: false,
        found: false,
        state: false,
        audio: false,
        entry: false,
      };
      checks.found = JSON.stringify(current.foundWords) === JSON.stringify(expected.found);
      checks.state = current.state === expected.state;
      checks.audio = current.lastAudioEvent === expected.audio;
      checks.entry = entry === expected.entry;
      if (step.outcome === 'completion') {
        checks.timeBonus = current.remainingMs % constants.timer.tickMs === 0;
        timeBonus = (current.remainingMs / constants.timer.tickMs) * constants.scoring.timeFactor;
        checks.score = current.score === expected.score + timeBonus;
      } else {
        checks.score = current.score === expected.score;
      }

      expect(checks.score, `${step.id} score (expected ${expected.score}${timeBonus ? ` + ${timeBonus} time bonus` : ''}, got ${current.score})`).toBe(true);
      expect(checks.found, `${step.id} found list`).toBe(true);
      expect(checks.state, `${step.id} state`).toBe(true);
      expect(checks.audio, `${step.id} lastAudioEvent`).toBe(true);
      expect(checks.entry, `${step.id} entry`).toBe(true);

      // Capture + compare at this step.
      const referencePath = path.join(REFERENCE_DIR, `${step.capture}.png`);
      expect(fs.existsSync(referencePath), `reference capture ${step.capture}.png exists`).toBe(
        true,
      );
      const outDir = path.join(EVIDENCE_DIR, step.capture);
      fs.mkdirSync(outDir, { recursive: true });
      const actualPath = path.join(outDir, 'actual.png');
      const stability = await waitForStageStable(page);
      await page.locator('[data-testid="stage-root"]').screenshot({ path: actualPath });
      fs.copyFileSync(referencePath, path.join(outDir, 'reference.png'));

      const excluded = step.id === completionStepId;
      let record: StepRecord;
      if (excluded) {
        record = {
          index,
          id: step.id,
          capture: step.capture,
          action: step.action,
          word: step.word ?? step.entry ?? null,
          outcome: step.outcome ?? null,
          score: expected.score,
          appScore: current.score,
          timeBonus,
          foundCount: current.foundWords.length,
          entry,
          state: current.state,
          audio: current.lastAudioEvent ?? '',
          checks,
          stableAtCapture: stability.stable,
          comparison: { excluded: true, reason: completionExclusionReason },
          mismatchRatio: null,
          tolerantMismatchRatio: null,
          pass: null,
          reference: path.relative(REPO_ROOT, referencePath),
          artifacts: path.relative(REPO_ROOT, outDir),
        };
      } else {
        const diff = runDiff(actualPath, referencePath, outDir);
        const tolerantPercent = diff.report.tolerantMismatchRatio * 100;
        console.log(
          `F2 ${step.id}: raw=${(diff.report.mismatchRatio * 100).toFixed(3)}% ` +
            `tolerant=${tolerantPercent.toFixed(3)}% ignoredPixels=${diff.report.ignoredPixels} ` +
            `pass=${diff.report.pass} stable=${stability.stable}`,
        );
        expect(
          diff.report.tolerantMismatchRatio,
          `${step.id} tolerant mismatch ratio ${tolerantPercent.toFixed(3)}% (limit 2.000%)`,
        ).toBeLessThanOrEqual(diff.report.passRatio);
        expect(diff.report.pass, `${step.id} diff pass`).toBe(true);
        worst = Math.max(worst, diff.report.tolerantMismatchRatio);
        record = {
          index,
          id: step.id,
          capture: step.capture,
          action: step.action,
          word: step.word ?? step.entry ?? null,
          outcome: step.outcome ?? null,
          score: expected.score,
          appScore: current.score,
          timeBonus,
          foundCount: current.foundWords.length,
          entry,
          state: current.state,
          audio: current.lastAudioEvent ?? '',
          checks,
          stableAtCapture: stability.stable,
          comparison: { excluded: false },
          mismatchRatio: diff.report.mismatchRatio,
          tolerantMismatchRatio: diff.report.tolerantMismatchRatio,
          pass: diff.report.pass,
          reference: path.relative(REPO_ROOT, referencePath),
          artifacts: path.relative(REPO_ROOT, outDir),
        };
      }
      fs.writeFileSync(
        path.join(outDir, 'step.json'),
        `${JSON.stringify(record, null, 2)}\n`,
      );
      report.playthrough!.steps.push(record);
      saveReport(report);
    }

    // --- completion assertions (O13/O14; docs/07 §1 time-bonus row) ----------
    const final = await readGame(page);
    expect(final.state).toBe('celebration');
    expect(final.foundWords).toEqual(oracle.steps[oracle.steps.length - 1]!.found);
    expect(final.remainingMs % constants.timer.tickMs).toBe(0);
    const lastExpected = oracle.steps[oracle.steps.length - 1]!;
    const finalTimeBonus = (final.remainingMs / constants.timer.tickMs) * constants.scoring.timeFactor;
    expect(final.score).toBe(lastExpected.score + finalTimeBonus);
    // Input locked after completion: a letter + ENTER change nothing.
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Enter');
    const locked = await readGame(page);
    expect(locked.score).toBe(final.score);
    expect(locked.foundWords).toEqual(final.foundWords);
    expect(locked.state).toBe('celebration');
    expect(locked.lastAudioEvent).toBe(final.lastAudioEvent);

    saveReport(report);
    expect(pageErrors).toEqual([]);
    console.log(
      `F2 playthrough: ${report.playthrough!.steps.length} steps, worst tolerant ratio ${worst * 100 === 0 ? '0' : (worst * 100).toFixed(3)}%`,
    );
  });
});

// ---------------------------------------------------------------------------
// S9 timeout variant (V5; O01/O14 shortest path — the 200 s clock is waited out)
// ---------------------------------------------------------------------------

test.describe('F2 S9 timeout variant', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('FİNALİZM: the clock is waited out and the timeout state matches the reference', async ({
    page,
  }) => {
    test.setTimeout(320_000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('/');
    await expect.poll(async () => (await readGame(page)).state).toBe('playing');
    await hideHarnessChrome(page);
    await stageReady(page);
    await page.evaluate(() => {
      const game = (window as unknown as { __game: { selectRound(main: string): void } }).__game;
      game.selectRound('FİNALİZM');
    });
    const started = Date.now();
    await expect
      .poll(async () => (await readGame(page)).state, { timeout: 230_000, intervals: [500] })
      .toBe('timeout');
    const durationMs = Date.now() - started;

    const current = await readGame(page);
    expect(current.score).toBe(0);
    expect(current.foundWords).toEqual([]);
    expect(current.remainingMs).toBe(0);

    // O14/O13: the timeout reveal fills every listed slot (10/10/10/4/0/1) with
    // the round's word-list order; tiles and action buttons are hidden.
    const revealed = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid="found-list"] li')).map((item) => ({
        length: Number((item as HTMLElement).dataset.length),
        index: Number((item as HTMLElement).dataset.index),
        word: item.textContent ?? '',
        revealed: (item as HTMLElement).dataset.revealed === 'true',
      }));
    });
    const expectedRevealed = (() => {
      const counters = new Map<number, number>();
      return LISTED_WORDS.map(({ length, word }) => {
        const index = counters.get(length) ?? 0;
        counters.set(length, index + 1);
        return { length, index, word, revealed: true };
      });
    })();
    expect(revealed).toEqual(expectedRevealed);
    const tileCount = await page.locator('[data-testid^="tile-"]').count();
    expect(tileCount, 'tiles hidden at timeout').toBe(0);
    const controls = await page.evaluate(() => {
      const hidden = (testid: string): boolean | null => {
        const element = document.querySelector(`[data-testid="${testid}"]`);
        return element instanceof HTMLElement ? element.hidden : null;
      };
      return {
        submit: hidden('submit'),
        scramble: hidden('scramble'),
        delete: hidden('delete'),
        newRound: hidden('new-round'),
      };
    });
    expect(controls).toEqual({ submit: true, scramble: true, delete: true, newRound: false });

    // Input lock: a letter and ENTER change nothing.
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Enter');
    const locked = await readGame(page);
    expect(locked.score).toBe(0);
    expect(locked.foundWords).toEqual([]);
    expect(locked.state).toBe('timeout');

    // Reference side: fresh round 1, clock waited out (C3 scenario).
    const referencePath = path.join(TIMEOUT_REFERENCE_DIR, 'timeout.png');
    expect(fs.existsSync(referencePath), 'reference timeout capture exists').toBe(true);
    const timeoutScenarioReport = JSON.parse(
      fs.readFileSync(TIMEOUT_REFERENCE_SCENARIO_REPORT, 'utf8'),
    ) as {
      ok: boolean;
      steps: Array<{ action: string; durationMs: number; result?: { condition?: string; matched?: boolean; waitedMs?: number } }>;
    };
    expect(timeoutScenarioReport.ok, 'reference timeout scenario ran green').toBe(true);
    const roundEnd = timeoutScenarioReport.steps.find(
      (step) => step.result?.condition === 'round-end',
    );
    expect(roundEnd?.result?.matched, 'reference reached the timeout state').toBe(true);

    const outDir = path.join(EVIDENCE_DIR, 'timeout');
    fs.mkdirSync(outDir, { recursive: true });
    const actualPath = path.join(outDir, 'actual.png');
    const stability = await waitForStageStable(page);
    await page.locator('[data-testid="stage-root"]').screenshot({ path: actualPath });
    fs.copyFileSync(referencePath, path.join(outDir, 'reference.png'));
    const diff = runDiff(actualPath, referencePath, outDir);
    const tolerantPercent = diff.report.tolerantMismatchRatio * 100;
    console.log(
      `F2 timeout: raw=${(diff.report.mismatchRatio * 100).toFixed(3)}% ` +
        `tolerant=${tolerantPercent.toFixed(3)}% ignoredPixels=${diff.report.ignoredPixels} ` +
        `pass=${diff.report.pass} appWaitMs=${durationMs} stable=${stability.stable}`,
    );

    const record: StepRecord = {
      index: script.steps.length,
      id: 'S9-timeout',
      capture: 'timeout',
      action: 'timeout',
      word: null,
      outcome: 'timeout',
      score: 0,
      appScore: current.score,
      timeBonus: null,
      foundCount: current.foundWords.length,
      entry: await entryText(page),
      state: current.state,
      audio: current.lastAudioEvent ?? '',
      checks: { score: true, found: true, state: true, revealed: true, inputLocked: true },
      stableAtCapture: stability.stable,
      comparison: { excluded: false },
      mismatchRatio: diff.report.mismatchRatio,
      tolerantMismatchRatio: diff.report.tolerantMismatchRatio,
      pass: diff.report.pass,
      reference: path.relative(REPO_ROOT, referencePath),
      artifacts: path.relative(REPO_ROOT, outDir),
    };
    fs.writeFileSync(path.join(outDir, 'step.json'), `${JSON.stringify(record, null, 2)}\n`);

    // The report records the measured step (score, ratio, pass/fail) before the
    // threshold assertion, so V2's machine-readable record exists even when the
    // state fails (docs/07 §4; EXECUTION.md §9.1 — a failing run is recorded,
    // never hidden).
    const report = loadReport();
    report.timeout = record;
    report.reference = {
      ...report.reference,
      timeoutScenario: 'tests/fixtures/reference/playthrough/scenarios/timeout.json',
      timeoutScenarioReport: path.relative(REPO_ROOT, TIMEOUT_REFERENCE_SCENARIO_REPORT),
      timeoutScenarioReportOk: timeoutScenarioReport.ok,
      timeoutRunCommand:
        'node verify/reference/capture.mjs --scenario tests/fixtures/reference/playthrough/scenarios/timeout.json --out tests/fixtures/reference/playthrough/timeout --runs 1 --port 8797',
    };
    report.timeout = {
      ...record,
      appWaitMs: durationMs,
      referenceWaitMs: roundEnd?.result?.waitedMs ?? null,
    } as StepRecord & { appWaitMs: number; referenceWaitMs: number | null };
    saveReport(report);

    expect(
      diff.report.tolerantMismatchRatio,
      `timeout tolerant mismatch ratio ${tolerantPercent.toFixed(3)}% (limit 2.000%)`,
    ).toBeLessThanOrEqual(diff.report.passRatio);
    expect(diff.report.pass).toBe(true);

    expect(pageErrors).toEqual([]);
  });
});
