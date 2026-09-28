// tests/e2e/interaction/interaction.spec.ts — X1 tile center clicks + O15 edge
// checks (owner defect 1; evidence/X1-tile-click.md).
//
// Root cause (owner-reported and reproduced below by the pre-fix run):
// `src/ui/board.ts` renders the tile letter field
// (`<span class="board-text" data-element="letterN">`) directly over the
// tile's clickable center, and `src/main.ts` delegates clicks from
// `closest('[data-element]')` through `/^button(\d+)$/` only — a click that
// lands on the glyph hits `letterN` and is dropped, while edge clicks work.
// Chosen fix (single delegation path, no handler mapping): the tile letter
// labels become transparent to pointer events (`pointer-events: none`), so the
// click reaches the `buttonN` node naturally. This suite asserts the
// delegation input at the tile center resolves to `buttonN`.
//
// Fixture: the FİNALİZM bank round through the TEST-ONLY
// `window.__game.selectRound` hook (docs/04 §6 amendment; the E3/D5 pattern).
// Slot letters are read from the rendered board, never hardcoded, so the
// seeded deck shuffle cannot make the suite flaky. Click addresses are the
// measured reference slot centers (verify/reference/capture.mjs
// TILE_XS/TILE_Y; frame_131/DoAction.as `_X = 60 + t*60`, `_Y = 330`).
//
// O15 edge rules checked through the same live board
// (evidence/A2-edges.md §2): duplicate-letter use (a), delete/backspace (c),
// scramble (d), re-submit of a found word (b) and submit with an empty entry
// (f). Letter adds stay far below the evidenced first lucky bonus add (53 for
// seed 2012; evidence/D1-round.md §4), so the expected scores are exact.

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { scoreWord } from '../../../src/game/scoring';

// ---------------------------------------------------------------------------
// Fixture and constants
// ---------------------------------------------------------------------------

const ROUND_MAIN = 'FİNALİZM';
const SLOT_COUNT = 8;
/** Measured reference slot centers: x = 60 + 60*slot, y = 330. */
const SLOT_X0 = 60;
const SLOT_PITCH = 60;
const SLOT_Y = 330;

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

/** First listed 3-letter word (distinct letters) — the re-submit fixture. */
const FIRST_WORD = ROUND.words['3']?.[0] ?? '';
// Fixture guards: the frozen bank (docs/05 §2) and the evidenced golden
// stream (first lucky bonus add is 53 for seed 2012, evidence/D1-round.md §4).
expect(FIRST_WORD, 'FİNALİZM first listed 3-letter word').toBe('AFİ');
const FIRST_WORD_SCORE = scoreWord(FIRST_WORD, -1, CONSTANTS.scoring).totalPoints;
expect(FIRST_WORD_SCORE, 'bonus-free score of the fixture word').toBe(450);

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

/** Number of rendered runtime tile letter labels (`letter0..letter7`). */
async function runtimeLetterCount(page: Page): Promise<number> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-element]')).filter((node) =>
      /^letter\d+$/.test((node as HTMLElement).dataset.element ?? ''),
    ).length,
  );
}

/**
 * Center of tile slot `slot`, read from the rendered socket (the socket
 * duplicate sits exactly under the tile). Asserts the point is the measured
 * reference slot center (60 + 60*slot, 330).
 */
async function tileCenter(page: Page, slot: number): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-element="bosbuton${slot}"]`).boundingBox();
  expect(box, `socket ${slot} is rendered`).not.toBeNull();
  const center = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
  expect(center.x, `tile ${slot} center x`).toBeCloseTo(SLOT_X0 + slot * SLOT_PITCH, 0);
  expect(center.y, `tile ${slot} center y`).toBeCloseTo(SLOT_Y, 0);
  return center;
}

/** `data-element` of the topmost element at `point` — the delegation input. */
async function hitElementAt(page: Page, point: { x: number; y: number }): Promise<string | null> {
  return page.evaluate(({ x, y }) => {
    const node = document.elementFromPoint(x, y);
    const holder = node?.closest('[data-element]');
    return holder instanceof HTMLElement ? (holder.dataset.element ?? null) : null;
  }, point);
}

/**
 * The E3 wordball "getir" slide runs 8/36 s up through the slot row
 * (src/styles/animations.css); wait for its settle state so a ball cannot
 * intercept the next tile-center click.
 */
async function waitForEntrySlide(page: Page): Promise<void> {
  await expect(page.locator('.e3-wordball-getir')).toHaveCount(0);
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
// Center clicks at both device scale factors
// ---------------------------------------------------------------------------

for (const dsf of [1, 2] as const) {
  test.describe(`tile center clicks — deviceScaleFactor ${dsf}`, () => {
    test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: dsf });

    test(`clicking the center of all 8 tiles enters their letters (dsf ${dsf})`, async ({
      page,
    }) => {
      const pageErrors: Error[] = [];
      page.on('pageerror', (error) => pageErrors.push(error));

      await prepareRound(page);
      const letters = await readSlotLetters(page);
      expect(
        letters.filter((letter) => letter === null || letter === ''),
        'every runtime tile shows its letter',
      ).toEqual([]);
      // The 8 tiles show exactly the FİNALİZM deck (duplicate İ included).
      expect([...letters].sort()).toEqual([...ROUND.letters].sort());

      let expectedEntry = '';
      for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
        const center = await tileCenter(page, slot);
        // Single delegation path: at the tile center the topmost element with
        // `data-element` must be `buttonN` (the letter label is
        // `pointer-events: none`), so src/main.ts's /^button(\d+)$/ match
        // accepts the click.
        expect(
          await hitElementAt(page, center),
          `topmost [data-element] at tile ${slot} center`,
        ).toBe(`button${slot}`);

        await page.mouse.click(center.x, center.y);
        expectedEntry += letters[slot] ?? '';
        await expect(entry(page), `entry after tile ${slot}`).toHaveText(expectedEntry);
        await waitForEntrySlide(page);
        expect((await readGame(page)).lastAudioEvent, `audio after tile ${slot}`).toBe(
          'tileClick',
        );
      }

      // The full run equals the deck in slot order and consumed every tile.
      expect(await entry(page).textContent()).toBe(letters.join(''));
      await expect(page.locator('[data-testid^="tile-"]')).toHaveCount(0);
      expect(await runtimeLetterCount(page)).toBe(0);
      const game = await readGame(page);
      expect(game.state).toBe('playing');
      expect(game.foundWords).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });
}

// ---------------------------------------------------------------------------
// O15 edge checks (evidence/A2-edges.md §2)
// ---------------------------------------------------------------------------

test.describe('O15 edge checks (evidence/A2-edges.md)', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('duplicate letters: one entry per tile, delete restores each (O15(a)/(c))', async ({
    page,
  }) => {
    await prepareRound(page);
    const letters = await readSlotLetters(page);
    const iSlots = letters
      .map((letter, slot) => ({ letter, slot }))
      .filter((item) => item.letter === 'İ')
      .map((item) => item.slot);
    expect(iSlots, 'FİNALİZM deck carries two İ tiles').toHaveLength(2);

    // First İ tile: the clicked tile is consumed, the entry gets its letter.
    const first = await tileCenter(page, iSlots[0]!);
    await page.mouse.click(first.x, first.y);
    await expect(entry(page)).toHaveText('İ');
    await waitForEntrySlide(page);
    await expect(page.locator(`[data-element="letter${iSlots[0]}"]`)).toHaveCount(0);

    // Second İ tile: the other instance still carries the letter.
    const second = await tileCenter(page, iSlots[1]!);
    await page.mouse.click(second.x, second.y);
    await expect(entry(page)).toHaveText('İİ');
    await waitForEntrySlide(page);
    expect(await runtimeLetterCount(page)).toBe(SLOT_COUNT - 2);

    // A third İ has no visible tile left: the key press is a no-op with no
    // sound (evidence/A2-edges.md §2(a)) — entry and last event stay put.
    await page.keyboard.press('Quote'); // O04 key code 222 = İ
    await expect(entry(page)).toHaveText('İİ');
    expect((await readGame(page)).lastAudioEvent).toBe('tileClick');

    // Delete restores one consumed tile per removal (§2(c)); after two
    // BACKSPACEs the deck multiset matches the round start.
    await page.keyboard.press('Backspace');
    await expect(entry(page)).toHaveText('İ');
    await page.keyboard.press('Backspace');
    await expect(entry(page)).toHaveText('');
    expect(await runtimeLetterCount(page)).toBe(SLOT_COUNT);
    expect([...(await readSlotLetters(page))].sort()).toEqual([...letters].sort());
  });

  test('delete/backspace: removes the last letter and restores its tile; empty delete is sound-only (O15(c))', async ({
    page,
  }) => {
    await prepareRound(page);
    const letters = await readSlotLetters(page);
    const center = await tileCenter(page, 0);
    await page.mouse.click(center.x, center.y);
    await expect(entry(page)).toHaveText(letters[0]!);
    await waitForEntrySlide(page);
    await expect(page.locator('[data-testid="tile-0"]')).toHaveCount(0);
    await expect(page.locator('[data-element="letter0"]')).toHaveCount(0);
    await expect(page.locator('[data-element="bosbuton0"]')).toHaveCount(1);

    // The Sil control reaches the same `sil()` path as BACKSPACE.
    await page.locator('[data-testid="delete"]').click();
    await expect(entry(page)).toHaveText('');
    await expect(page.locator('[data-testid="tile-0"]')).toHaveCount(1);
    await expect(page.locator('[data-element="letter0"]')).toHaveText(letters[0]!);
    expect((await readGame(page)).lastAudioEvent).toBe('delete');

    // BACKSPACE on the empty entry: sound only, nothing else changes (§2(c)).
    await page.keyboard.press('Backspace');
    await expect(entry(page)).toHaveText('');
    await expect(page.locator('[data-testid^="tile-"]')).toHaveCount(SLOT_COUNT);
    expect((await readGame(page)).lastAudioEvent).toBe('delete');
  });

  test('scramble: clears a partial entry and restores the whole deck (O15(d))', async ({
    page,
  }) => {
    await prepareRound(page);
    const before = await readSlotLetters(page);

    // Enter two letters through tile centers (click path).
    await clickLetter(page, before[0]!, before[0]!);
    await clickLetter(page, before[1]!, `${before[0]}${before[1]}`);
    expect(await runtimeLetterCount(page)).toBe(SLOT_COUNT - 2);

    await page.keyboard.press('Space');
    await expect(entry(page)).toHaveText('');
    expect((await readGame(page)).lastAudioEvent).toBe('scramble');
    // Every tile is back (the deck is reshuffled; the multiset is unchanged).
    expect(await runtimeLetterCount(page)).toBe(SLOT_COUNT);
    expect([...(await readSlotLetters(page))].sort()).toEqual([...before].sort());

    // SPACE with an empty entry still scrambles (entry stays empty).
    await page.keyboard.press('Space');
    await expect(entry(page)).toHaveText('');
    expect((await readGame(page)).lastAudioEvent).toBe('scramble');
  });

  test('re-submit: found word keeps the entry, scores nothing, boings; empty submit buzzes (O15(b)/(f))', async ({
    page,
  }) => {
    await prepareRound(page);

    // Enter the fixture word via tile centers and submit it (valid, new).
    let expectedEntry = '';
    for (const letter of [...FIRST_WORD]) {
      expectedEntry += letter;
      await clickLetter(page, letter, expectedEntry);
    }
    await expect(page.locator('[data-testid="message"]')).toHaveText('Geçerli');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('submitValid');
    let game = await readGame(page);
    expect(game.foundWords).toEqual([FIRST_WORD]);
    expect(game.score).toBe(FIRST_WORD_SCORE); // bonus-free (see header)
    await expect(entry(page)).toHaveText(''); // a valid new word clears the entry

    // Re-enter the same word: the status reads Girildi and re-submitting scores
    // nothing, keeps the entry and plays the already-found sound (§2(b)).
    expectedEntry = '';
    for (const letter of [...FIRST_WORD]) {
      expectedEntry += letter;
      await clickLetter(page, letter, expectedEntry);
    }
    await expect(page.locator('[data-testid="message"]')).toHaveText('Girildi');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe(
      'submitAlreadyFound',
    );
    game = await readGame(page);
    expect(game.foundWords).toEqual([FIRST_WORD]);
    expect(game.score).toBe(FIRST_WORD_SCORE);
    await expect(entry(page)).toHaveText(FIRST_WORD); // entry kept

    // ENTER with an empty entry: invalid buzz, board state unchanged (§2(f)).
    await page.keyboard.press('Space');
    await expect(entry(page)).toHaveText('');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('submitInvalid');
    game = await readGame(page);
    expect(game.foundWords).toEqual([FIRST_WORD]);
    expect(game.score).toBe(FIRST_WORD_SCORE);
    await expect(entry(page)).toHaveText('');
  });
});
