// tests/e2e/controls/controls.spec.ts — Y3 button hit-area (owner defect, wave Y).
//
// Run with: npm run e2e -- controls
//
// The defect: `src/ui/hud.ts` `CONTROL_RECTS` mapped `scramble → btn_sbuton`
// and `delete → btn_kbuton` (swapped), so the transparent overlay laid over
// the reference "Karıştır" sprite dispatched `sil()` and the overlay over
// "Sil" dispatched `karistir()` — clicking Karıştır deleted, clicking Sil
// shuffled. Keyboard SPACE/ENTER/BACKSPACE never used these rectangles and were
// unaffected; `submit → btn_ebuton` was already correct.
//
// This suite never clicks a `data-testid` control: every control click is a
// raw mouse click at the CENTER of the visible label sprite's rendered
// bounding box in SCALED stage coordinates (`[data-element="btn_*"]`; the
// 550×400 stage root carries `transform: scale(s)` — src/stage.ts). The point
// is computed from the catalog rect (src/data/layout.json) and the rendered
// stage metrics, then cross-checked against the sprite's own Playwright
// bounding box (which already includes the transform). The configured viewport
// 1280×720 letterboxes the stage at 1.8×, so the clicks are genuinely scaled.
//
// Reference mapping (decoded, not guessed):
// - DefineButton2_63/BUTTONCONDACTION on(release).as → `karistir();` (sprite 63
//   = `kbuton`, x=156.25 — "Karıştır").
// - DefineButton2_65/BUTTONCONDACTION on(release).as → `ekle();` (sprite 65
//   = `ebuton`, x=232.85 — "Ekle").
// - DefineButton2_105/BUTTONCONDACTION on(release).as → `sil();` (sprite 105
//   = `sbuton`, x=308.6 — "Sil").
// evidence: evidence/A3-diffs.md §2 rows 63/65/105; evidence/Y3-buttons.md.
//
// Silent witness runs (EXECUTION.md §8): the "app" project launches Chromium
// with `--mute-audio` (playwright.config.ts); assertions read
// `window.__game.lastAudioEvent` state, never audibility.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LETTER_KEY_CODES } from '../../../src/game/input';
import { scoreWord } from '../../../src/game/scoring';

// ---------------------------------------------------------------------------
// Fixture and catalog
// ---------------------------------------------------------------------------

const ROUND_MAIN = 'FİNALİZM';
const SLOT_COUNT = 8;
const STAGE_WIDTH = 550;
const STAGE_HEIGHT = 400;
/** Configured viewport (test.use below) letterboxes the stage at 1.8×. */
const EXPECTED_STAGE_SCALE = 1.8;

/** Label sprite under test → control testid whose overlay must cover it. */
const LABEL_CONTROL: Readonly<Record<string, string>> = {
  btn_kbuton: 'scramble',
  btn_sbuton: 'delete',
  btn_ebuton: 'submit',
};

interface RoundBank {
  readonly rounds: readonly {
    readonly id: string;
    readonly main: string;
    readonly letters: readonly string[];
    readonly words: Readonly<Record<string, readonly string[]>>;
  }[];
}

const ROUND = (() => {
  const bank = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'src/data/rounds.json'), 'utf8'),
  ) as RoundBank;
  const round = bank.rounds.find((candidate) => candidate.main === ROUND_MAIN);
  if (round === undefined) throw new Error(`${ROUND_MAIN} must be present in the round bank`);
  return round;
})();

const CONSTANTS = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'data/constants.json'), 'utf8'),
) as {
  scoring: { perLetterSquaredFactor: number; bonusPoints: number; timeFactor: number };
};

/** First listed 3-letter word (distinct letters) — the submit/keyboard fixture. */
const FIRST_WORD = ROUND.words['3']?.[0] ?? '';
// Fixture guards: the frozen bank (docs/05 §2); the first lucky bonus add is 53
// for seed 2012 (evidence/D1-round.md §4), so 3 adds are bonus-free.
expect(FIRST_WORD, 'FİNALİZM first listed 3-letter word').toBe('AFİ');
const FIRST_WORD_SCORE = scoreWord(FIRST_WORD, -1, CONSTANTS.scoring).totalPoints;
expect(FIRST_WORD_SCORE, 'bonus-free score of the fixture word').toBe(450);

interface LayoutElementJson {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const LAYOUT_ELEMENTS = (
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'src/data/layout.json'), 'utf8'),
  ) as { elements: readonly LayoutElementJson[] }
).elements;

function catalogRect(id: string): { x: number; y: number; w: number; h: number } {
  const element = LAYOUT_ELEMENTS.find((candidate) => candidate.id === id);
  if (element === undefined) {
    throw new Error(`src/data/layout.json is missing the ${id} element`);
  }
  return { x: element.x, y: element.y, w: element.w, h: element.h };
}

// ---------------------------------------------------------------------------
// Driving the app
// ---------------------------------------------------------------------------

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

function entry(page: Page) {
  return page.locator('[data-testid="entry"]');
}

/** Load the muted dev app and start the FİNALİZM fixture round. */
async function prepareRound(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof (window as unknown as { __game?: unknown }).__game !== 'undefined',
  );
  // Harness chrome (C2 fullscreen control) is not part of the game board.
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="fullscreen-button"]');
    if (button instanceof HTMLElement) {
      button.style.display = 'none';
    }
  });
  await page.evaluate((main) => {
    (window as unknown as { __game: { selectRound(main: string): void } }).__game.selectRound(main);
  }, ROUND_MAIN);
  await expect.poll(async () => (await readGame(page)).roundId).toBe(ROUND.id);
  await expect(page.locator('[data-element="letter0"]')).toHaveCount(1);
}

/** Letter of every runtime tile slot (`null` when no tile is rendered there). */
async function readSlotLetters(page: Page): Promise<(string | null)[]> {
  return page.evaluate((slotCount) => {
    const letters: (string | null)[] = [];
    for (let slot = 0; slot < slotCount; slot += 1) {
      letters.push(document.querySelector(`[data-element="letter${slot}"]`)?.textContent ?? null);
    }
    return letters;
  }, SLOT_COUNT);
}

/** Center of tile slot `slot`, read from the rendered socket (`bosbutonN`). */
async function tileCenter(page: Page, slot: number): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-element="bosbuton${slot}"]`).boundingBox();
  expect(box, `socket ${slot} is rendered`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/**
 * The E3 wordball "getir" slide runs 8/36 s up through the slot row
 * (src/styles/animations.css); wait for its settle state so a ball cannot
 * intercept the next click.
 */
async function waitForEntrySlide(page: Page): Promise<void> {
  await expect(page.locator('.e3-wordball-getir')).toHaveCount(0);
}

/**
 * Center of the visible label sprite `elementId` in scaled stage coordinates.
 * Computed from the catalog rect and the rendered stage metrics
 * (`stage-root` transform scale), then cross-checked (0.5 px) against the
 * sprite's own rendered bounding box. This is the click address: never a
 * `data-testid` control.
 */
async function labelCenter(page: Page, elementId: string): Promise<{ x: number; y: number }> {
  const stage = await page.locator('[data-testid="stage-root"]').boundingBox();
  expect(stage, 'stage root is rendered').not.toBeNull();
  const scaleX = stage!.width / STAGE_WIDTH;
  const scaleY = stage!.height / STAGE_HEIGHT;
  expect(scaleX, 'stage scale x (configured viewport)').toBeCloseTo(EXPECTED_STAGE_SCALE, 6);
  expect(scaleY, 'stage scale y (configured viewport)').toBeCloseTo(EXPECTED_STAGE_SCALE, 6);
  const rect = catalogRect(elementId);
  const expected = {
    x: stage!.x + (rect.x + rect.w / 2) * scaleX,
    y: stage!.y + (rect.y + rect.h / 2) * scaleY,
  };
  const box = await page.locator(`[data-element="${elementId}"]`).boundingBox();
  expect(box, `${elementId} label sprite is rendered`).not.toBeNull();
  const rendered = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  expect(expected.x, `${elementId} center x (catalog vs rendered)`).toBeCloseTo(rendered.x, 0);
  expect(expected.y, `${elementId} center y (catalog vs rendered)`).toBeCloseTo(rendered.y, 0);
  return rendered;
}

/** `data-testid` of the topmost control overlay at `point` (the click recipient). */
async function controlUnder(page: Page, point: { x: number; y: number }): Promise<string | null> {
  return page.evaluate(({ x, y }) => {
    const node = document.elementFromPoint(x, y);
    const overlay = node?.closest('.game-control');
    return overlay instanceof HTMLElement ? (overlay.dataset.testid ?? null) : null;
  }, point);
}

/** Click the center of the first visible tile carrying `letter`; assert the entry. */
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
  const center = await tileCenter(page, slot);
  await page.mouse.click(center.x, center.y);
  await expect(entry(page), `entry after clicking ${letter}`).toHaveText(expectedEntry);
  await waitForEntrySlide(page);
}

// ---------------------------------------------------------------------------
// Keyboard fixture (O04 numeric key codes → Playwright key names)
// ---------------------------------------------------------------------------

// Playwright US-layout key names for the O04 numeric key codes; the six
// Turkish letters sit on the positions whose (US) codes the reference table
// lists (evidence/A2-input.md §2, evidence/D2-input.md §2). Same mapping as
// tests/e2e/playthrough/playthrough:basic.spec.ts.
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

// ---------------------------------------------------------------------------
// Tests — raw clicks at the visible label centers, scaled stage coordinates
// ---------------------------------------------------------------------------

test.describe('Y3 Karıştır/Sil hit-area clicks (scaled stage)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  test('clicking the CENTER of the Karıştır label (btn_kbuton) scrambles: event + deck order', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await prepareRound(page);
    const before = await readSlotLetters(page);
    expect(before.filter((letter) => letter === null), 'all 8 tiles at round start').toEqual([]);
    expect([...before].sort()).toEqual([...ROUND.letters].sort());

    // Setup: enter one letter so the scramble also has an entry to clear.
    const center = await tileCenter(page, 0);
    await page.mouse.click(center.x, center.y);
    await expect(entry(page)).toHaveText(before[0]!);
    await waitForEntrySlide(page);

    const point = await labelCenter(page, 'btn_kbuton');
    await page.mouse.click(point.x, point.y);

    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('scramble');
    await expect(entry(page)).toHaveText('');
    expect(await controlUnder(page, point), 'overlay covering the Karıştır label').toBe(
      LABEL_CONTROL.btn_kbuton,
    );

    const after = await readSlotLetters(page);
    expect(after.filter((letter) => letter === null), 'every tile restored').toEqual([]);
    expect([...after].sort(), 'same deck multiset').toEqual([...before].sort());
    expect(after, 'deck order changed').not.toEqual(before);

    expect(pageErrors).toEqual([]);
  });

  test('clicking the CENTER of the Sil label (btn_sbuton) deletes the last entry letter', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await prepareRound(page);
    const letters = await readSlotLetters(page);
    const center = await tileCenter(page, 0);
    await page.mouse.click(center.x, center.y);
    await expect(entry(page)).toHaveText(letters[0]!);
    await waitForEntrySlide(page);
    await expect(page.locator('[data-testid="tile-0"]')).toHaveCount(0);

    const point = await labelCenter(page, 'btn_sbuton');
    await page.mouse.click(point.x, point.y);

    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('delete');
    await expect(entry(page)).toHaveText('');
    expect(await controlUnder(page, point), 'overlay covering the Sil label').toBe(
      LABEL_CONTROL.btn_sbuton,
    );

    // Delete restores the removed tile to its original slot.
    await expect(page.locator('[data-testid="tile-0"]')).toHaveCount(1);
    await expect(page.locator('[data-element="letter0"]')).toHaveText(letters[0]!);

    expect(pageErrors).toEqual([]);
  });

  test('clicking the CENTER of the Ekle label (btn_ebuton) submits a valid word', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await prepareRound(page);
    let expectedEntry = '';
    for (const letter of [...FIRST_WORD]) {
      expectedEntry += letter;
      await clickLetter(page, letter, expectedEntry);
    }
    await expect(page.locator('[data-testid="message"]')).toHaveText('Geçerli');

    const point = await labelCenter(page, 'btn_ebuton');
    await page.mouse.click(point.x, point.y);

    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('submitValid');
    expect(await controlUnder(page, point), 'overlay covering the Ekle label').toBe(
      LABEL_CONTROL.btn_ebuton,
    );
    const game = await readGame(page);
    expect(game.foundWords).toEqual([FIRST_WORD]);
    expect(game.score).toBe(FIRST_WORD_SCORE);
    await expect(entry(page)).toHaveText('');

    expect(pageErrors).toEqual([]);
  });

  test('keyboard SPACE/ENTER/BACKSPACE are unaffected (spot check)', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await prepareRound(page);

    // SPACE → scramble (empty entry is fine; the deck reshuffles).
    await page.keyboard.press('Space');
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('scramble');
    await expect(entry(page)).toHaveText('');

    // BACKSPACE on the empty entry → delete (sound-only path, O15(c)).
    await page.keyboard.press('Backspace');
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('delete');

    // Type the first listed 3-letter word and ENTER → valid submit.
    await typeWord(page, FIRST_WORD);
    await expect(entry(page)).toHaveText(FIRST_WORD);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('submitValid');
    const game = await readGame(page);
    expect(game.foundWords).toEqual([FIRST_WORD]);
    expect(game.score).toBe(FIRST_WORD_SCORE);

    expect(pageErrors).toEqual([]);
  });
});
