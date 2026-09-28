// tests/e2e/timeout/reveal-colour.spec.ts — X4: timeout reveal colour.
//
// Defect (owner defect wave X4; root cause by F2, relied upon as verified):
// the reference `tamamla()` (artifacts/decompiled/scripts/frame_131/
// DoAction.as L568–570) reveals every listed-but-unfound word at timeout with
// `d.textColor = 16737792` (#ff6600); the rebuild rendered all `.board-slot`
// words black (`src/ui/board.ts`) and `src/main.ts` dropped the lifecycle's
// `revealed` flag. Measured effect: F2's S9 tolerant mismatch 2.0145 % > 2.000 %
// (evidence/F2-playthrough.md §6/§7.1). The fix wires the flag through and
// colours revealed slots only.
//
// Focused test scope: assert that at timeout the player-found slot (FAL) stays
// black and every revealed listed slot renders rgb(255, 102, 0), and that the
// found slot is black before the timeout as well.
//
// Timeout mechanism: a real 200 s wait is prohibitive for a focused check, so
// the expiry is driven through the app's own wall clock (src/game/timer.ts
// computes `remaining` from `performance.now()` + `setTimeout`) with
// Playwright's fake clock API: `page.clock.install()` before load, then
// `fastForward(201_000)`. The countdown's pending boundary fires once with
// `remaining = 0` and runs the app's real `onExpired` → `completeTimeout()`
// path — the same lifecycle transition as the waited-out clock. No app hook is
// added, used or invented here; F2's S9 variant (real 200 s wait) remains the
// authoritative reference comparison and is re-run by the task.
//
// Fixture: FİNALİZM bank round through the TEST-ONLY `window.__game.selectRound`
// hook (docs/04 §6 amendment). Expected slots are derived from
// `src/data/rounds.json` with the lifecycle's `listedWords()` rule
// (`min(words, 10)` listed slots; found words first, then the reveal fills
// unfound words in word-list order), so nothing is guessed.

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LETTER_KEY_CODES } from '../../../src/game/input';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const ROUND_MAIN = 'FİNALİZM';
/** Player-found fixture word: bank-listed, spelled with plain ASCII letters. */
const FOUND_WORD = 'FAL';
const WORD_LENGTHS = [3, 4, 5, 6, 7, 8] as const;
/**
 * Listed-slot cap per length (`tablociz()`: `if(k > 10) { k = 10; }`).
 * evidence: evidence/A2-labels.md §3; same constant as F2's suite fixture.
 */
const LISTING_CAP = 10;
/** `tamamla()` L570 `16737792` = #ff6600; the app's `label_*_orange` value. */
const REVEAL_COLOR = 'rgb(255, 102, 0)';
/** `.board-slot` default: words found by the player keep black. */
const FOUND_COLOR = 'rgb(0, 0, 0)';

interface RoundBank {
  readonly rounds: readonly {
    readonly id: string;
    readonly main: string;
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

const LISTED = WORD_LENGTHS.map((length) => ({
  length,
  /** Listed words in bank order (`min(words, LISTING_CAP)`), as the slots show them. */
  listed: (ROUND.words[String(length)] ?? []).slice(0, LISTING_CAP),
  /** Full word list of the length (source of the reveal fill). */
  all: ROUND.words[String(length)] ?? [],
}));

/** Fixture guard: the found word must be listed on the 3-letter row. */
expect(LISTED.find((row) => row.length === 3)?.listed, 'FAL is a listed word').toContain(
  FOUND_WORD,
);

interface ExpectedSlot {
  readonly length: number;
  readonly index: number;
  readonly word: string;
  readonly revealed: boolean;
}

/**
 * Slots after the timeout reveal, mirroring `lifecycle.ts` `listedWords()`:
 * words already found keep their slots (in found order), then the remaining
 * listed slots are filled from the full word list in order, skipping found
 * words. Only {@link FOUND_WORD} is found in this test.
 */
const EXPECTED_SLOTS: readonly ExpectedSlot[] = LISTED.flatMap(({ length, listed, all }) => {
  const found = listed.filter((word) => word === FOUND_WORD);
  const filled = [...found];
  if (filled.length < listed.length) {
    for (const word of all) {
      if (filled.length >= listed.length) break;
      if (!found.includes(word)) filled.push(word);
    }
  }
  return filled.map((word, index) => ({ length, index, word, revealed: word !== FOUND_WORD }));
});

// ---------------------------------------------------------------------------
// Driving the app (O04 key codes; the F2/interaction suite pattern)
// ---------------------------------------------------------------------------

const LETTER_KEY_CODE = new Map(LETTER_KEY_CODES.map(([code, letter]) => [letter, code]));

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

async function pressWord(page: Page, word: string): Promise<void> {
  for (const letter of word) {
    const keyCode = LETTER_KEY_CODE.get(letter);
    expect(keyCode, `no O04 key code for ${letter}`).toBeDefined();
    await page.keyboard.press(playwrightKeyName(keyCode!));
  }
}

interface GameRead {
  readonly state: string;
  readonly roundId: string | null;
  readonly foundWords: readonly string[];
  readonly score: number;
  readonly remainingMs: number;
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
        };
      }
    ).__game;
    return {
      state: game.state,
      roundId: game.roundId,
      foundWords: [...game.foundWords],
      score: game.score,
      remainingMs: game.remainingMs,
    };
  });
}

interface SlotRead {
  readonly element: string;
  readonly text: string;
  readonly color: string;
}

/** Every rendered `slot_<len>_<j>` box with its text and resolved colour. */
async function readSlots(page: Page): Promise<SlotRead[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="board"] .board-slot')).map((node) => {
      const element = node as HTMLElement;
      return {
        element: element.dataset.element ?? '',
        text: element.textContent ?? '',
        color: getComputedStyle(element).color,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('X4 timeout reveal colour', () => {
  test.use({ viewport: { width: 550, height: 400 }, deviceScaleFactor: 1 });

  test('FİNALİZM: revealed slots render #ff6600 at timeout; found slots stay black', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    // Fake wall clock installed before load (see the header): the app boots,
    // starts the round countdown and expires it against the same code path.
    await page.clock.install();
    await page.goto('/');
    await page.waitForFunction(
      () => typeof (window as unknown as { __game?: unknown }).__game !== 'undefined',
    );
    await expect.poll(async () => (await readGame(page)).state).toBe('playing');

    // Harness chrome has no counterpart in the reference (the F2 S9 pattern).
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="fullscreen-button"]');
      if (button instanceof HTMLElement) button.style.display = 'none';
    });

    await page.evaluate(() => {
      (
        window as unknown as { __game: { selectRound(main: string): void } }
      ).__game.selectRound('FİNALİZM');
    });
    await expect.poll(async () => (await readGame(page)).roundId).toBe('finalizm');

    // Player-found word (non-revealed path).
    await pressWord(page, FOUND_WORD);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readGame(page)).foundWords).toEqual([FOUND_WORD]);

    // Non-revealed unchanged before the timeout: the single filled slot is the
    // found word, rendered with the default black.
    const slotsBefore = await readSlots(page);
    expect(slotsBefore.length).toBe(
      LISTED.reduce((count, row) => count + row.listed.length, 0),
      'listed slot boxes on the board',
    );
    expect(slotsBefore.filter((slot) => slot.text !== '')).toEqual([
      { element: 'slot_3_0', text: FOUND_WORD, color: FOUND_COLOR },
    ]);

    const before = await readGame(page);

    // Expire the countdown (200 s + margin) through the real timer path.
    await page.clock.fastForward(201_000);
    await expect.poll(async () => (await readGame(page)).state).toBe('timeout');

    const after = await readGame(page);
    expect(after.foundWords).toEqual([FOUND_WORD]);
    expect(after.remainingMs).toBe(0);
    // O14: the timeout path pays no time bonus — the score is unchanged.
    expect(after.score).toBe(before.score);

    // All listed slots are filled by the reveal, in the lifecycle's order.
    const filled = (await readSlots(page)).filter((slot) => slot.text !== '');
    expect(filled.map(({ element, text }) => ({ element, text }))).toEqual(
      EXPECTED_SLOTS.map((slot) => ({
        element: `slot_${slot.length}_${slot.index}`,
        text: slot.word,
      })),
    );

    // Colour rule (the X4 assertion): every revealed word #ff6600, the
    // player-found word black — non-revealed slots are unaffected.
    for (const expectedSlot of EXPECTED_SLOTS) {
      const rendered = filled.find(
        (slot) => slot.element === `slot_${expectedSlot.length}_${expectedSlot.index}`,
      );
      expect(rendered, `${expectedSlot.word} rendered`).toBeDefined();
      expect(rendered!.color, `${rendered!.element} ${expectedSlot.word}`).toBe(
        expectedSlot.revealed ? REVEAL_COLOR : FOUND_COLOR,
      );
    }
    expect(filled.filter((slot) => slot.text === FOUND_WORD).map((slot) => slot.color)).toEqual([
      FOUND_COLOR,
    ]);
    expect(filled.filter((slot) => slot.text !== FOUND_WORD).length).toBe(
      EXPECTED_SLOTS.length - 1,
    );
    expect(
      filled
        .filter((slot) => slot.text !== FOUND_WORD)
        .every((slot) => slot.color === REVEAL_COLOR),
      'every unfound listed word is revealed in #ff6600',
    ).toBe(true);

    expect(pageErrors).toEqual([]);
  });
});
