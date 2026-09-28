// tests/e2e/playthrough/playthrough:basic.spec.ts — D5 basic playthrough (V6;
// docs/07 §1 T13 basic variant, docs/07 §5 S2→S10 shape).
//
// File name: Playwright's CLI positional filter is a regex over the test file
// path (`createFiltersFromArguments`, playwright/lib/common), and the task's
// Verify command is `npm run e2e -- playthrough:basic`; the file name carries
// that filter token while staying inside the owned `tests/e2e/playthrough/`
// directory.
//
// Script (deterministic, no new material): load the app, select the FİNALİZM
// bank round through the test-only `window.__game.selectRound(main)` hook
// (docs/04 §6 amendment), then
//   step 2  type an invalid entry (FZMA) → buzz, entry kept (O15),
//   step 3  SPACE → scramble clears the entry,
//   step 4  submit the round's first listed 3-letter word (oracle row 1: 450),
//   step 5  submit it again → already-found, no score, entry kept (O15(b)),
//   step 6  submit the remaining listed-slot words (cap-aware: min(words, 10)
//           per length → 10/10/10/4/0/1 = 35 words for FİNALİZM),
//   step 7  every listed slot filled → completion (celebration, input locked,
//           time bonus from the last integer remaining second),
//   step 8  Yeni Oyun → the sequential next bank round (S10).
//
// Expected scores are computed in Node with the same D1 O02 tracker / D3
// scoring rules the app runs (seed from data/constants.json), so the oracle
// matches the app exactly, bonus rolls included. The bonus tracker is a local
// copy of the evidenced semantics because Playwright's ESM transform cannot
// load `src/game/round.ts` (it statically imports src/data/rounds.json, which
// Node ESM rejects without an import attribute); a self-check against D1's
// recorded golden stream (first lucky add 53 for seed 2012, evidence/D1-round.md
// §4) fails loudly if either implementation drifts.
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LETTER_KEY_CODES } from '../../../src/game/input';
import { scoreWord } from '../../../src/game/scoring';

const ROUND_MAIN = 'FİNALİZM';
const INVALID_ENTRY = 'FZMA';
const WORD_LENGTHS = [3, 4, 5, 6, 7, 8] as const;

const constants = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'data/constants.json'), 'utf8'),
) as {
  timer: { initialSeconds: number; tickMs: number };
  scoring: { perLetterSquaredFactor: number; bonusPoints: number; timeFactor: number };
  bonusLetter: { seed: number };
};

interface RawRound {
  readonly id: string;
  readonly main: string;
  readonly words: Readonly<Record<string, readonly string[]>>;
}

const ROUNDS = (
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/rounds.json'), 'utf8')) as {
    rounds: RawRound[];
  }
).rounds;

const ROUND = (() => {
  const round = ROUNDS.find((candidate) => candidate.main === ROUND_MAIN);
  expect(round, `${ROUND_MAIN} must be present in the round bank`).toBeDefined();
  return round!;
})();

/**
 * Cap-aware script: the first `min(count, 10)` words of each length — the
 * listed slots of the reference board (`tablociz()` clamps each length to 10).
 */
const SCRIPT: readonly string[] = WORD_LENGTHS.flatMap((length) =>
  (ROUND.words[String(length)] ?? []).slice(0, 10),
);

expect(SCRIPT, '10/10/10/4/0/1 listed slots').toHaveLength(35);
expect(SCRIPT).not.toContain(INVALID_ENTRY);

// ---------------------------------------------------------------------------
// Local oracle: O02 bonus tracker + D3 scoring (see header)
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class BonusOracle {
  private readonly random = mulberry32(constants.bonusLetter.seed);
  private ball = -1;
  private entryLength = 0;

  /** A letter was appended (length after the add). */
  type(): void {
    this.entryLength += 1;
    if (this.ball !== -1) return;
    if (Math.floor(this.random() * 1000) < 50) this.ball = this.entryLength;
  }

  /** The entry was cleared (valid submit / scramble); resets a pending bonus. */
  clear(): void {
    if (this.entryLength > 0) this.ball = -1;
    this.entryLength = 0;
  }

  get pendingBonus(): boolean {
    return this.ball > -1;
  }
}

// Self-check: seed 2012's first lucky add is add 53 (evidence/D1-round.md §4).
{
  const oracle = new BonusOracle();
  let firstLucky = -1;
  for (let add = 1; add <= 53; add += 1) {
    oracle.type();
    if (firstLucky === -1 && oracle.pendingBonus) firstLucky = add;
  }
  expect(firstLucky, 'D1 golden stream: first lucky add is 53').toBe(53);
}

// ---------------------------------------------------------------------------
// Driving the app
// ---------------------------------------------------------------------------

// Playwright US-layout key names for the O04 numeric key codes; the six
// Turkish letters sit on the positions whose (US) codes the reference table
// lists (evidence/A2-input.md §2, evidence/D2-input.md §2).
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

const ACTION_KEYS = { submit: 'Enter', scramble: 'Space', delete: 'Backspace' } as const;

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

async function typeWord(page: Page, word: string): Promise<void> {
  for (const letter of word) {
    const keyCode = LETTER_KEY_CODE.get(letter);
    expect(keyCode, `no O04 key code for ${letter}`).toBeDefined();
    await page.keyboard.press(playwrightKeyName(keyCode!));
  }
}

async function entryText(page: Page): Promise<string> {
  return (await page.locator('[data-testid="entry"]').textContent()) ?? '';
}

async function messageText(page: Page): Promise<string> {
  return (await page.locator('[data-testid="message"]').textContent()) ?? '';
}

test.describe('D5 basic playthrough', () => {
  test.setTimeout(180_000);

  test('FİNALİZM: scripted submissions fill every listed slot and complete', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    // Oracle state, fed by the exact typed-letter sequence (bonus rolls included).
    const bonus = new BonusOracle();
    let expectedScore = 0;
    const expectedFound: string[] = [];
    const simType = (word: string): void => {
      for (let index = 0; index < [...word].length; index += 1) bonus.type();
    };
    const simValid = (word: string): void => {
      const result = scoreWord(word, bonus.pendingBonus ? 0 : -1, {
        perLetterSquaredFactor: constants.scoring.perLetterSquaredFactor,
        bonusPoints: constants.scoring.bonusPoints,
        timeFactor: constants.scoring.timeFactor,
      });
      expectedScore += result.totalPoints;
      expectedFound.push(word);
      bonus.clear();
    };

    // Step 1 — load: the app boots into a live sequential round.
    await page.goto('/');
    await expect.poll(async () => (await readGame(page)).state).toBe('playing');
    const boot = await readGame(page);
    expect(boot.roundId).toBe(ROUNDS[0]!.id);
    expect(boot.foundWords).toEqual([]);
    expect(boot.score).toBe(0);

    // Step 2 — select the fixture round through the docs/04 §6 test hook.
    await page.evaluate((main) => {
      (window as unknown as { __game: { selectRound(main: string): void } }).__game.selectRound(
        main,
      );
    }, ROUND_MAIN);
    const selected = await readGame(page);
    expect(selected.roundId).toBe(ROUND.id);
    expect(selected.foundWords).toEqual([]);
    expect(selected.score).toBe(0);
    expect(selected.remainingMs).toBeGreaterThan(190_000);

    // Step 3 — invalid entry: buzz, entry kept, no score (O15(a)/(f)).
    simType(INVALID_ENTRY);
    await typeWord(page, INVALID_ENTRY);
    expect(await entryText(page)).toBe(INVALID_ENTRY);
    await page.keyboard.press(ACTION_KEYS.submit);
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('submitInvalid');
    const afterInvalid = await readGame(page);
    expect(afterInvalid.score).toBe(0);
    expect(afterInvalid.foundWords).toEqual([]);
    expect(await entryText(page)).toBe(INVALID_ENTRY);

    // Step 4 — SPACE clears the entry (scramble) and restores the deck.
    await page.keyboard.press(ACTION_KEYS.scramble);
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('scramble');
    expect(await entryText(page)).toBe('');
    bonus.clear();

    // Step 5 — first listed word: valid new word, oracle row 1 (450, no bonus).
    const first = SCRIPT[0]!;
    simType(first);
    await typeWord(page, first);
    expect(await entryText(page)).toBe(first);
    expect(await messageText(page)).toBe('Geçerli');
    await page.keyboard.press(ACTION_KEYS.submit);
    await expect.poll(async () => (await readGame(page)).foundWords.length).toBe(1);
    simValid(first);
    expect(expectedScore).toBe(450);
    let current = await readGame(page);
    expect(current.score).toBe(expectedScore);
    expect(current.foundWords).toEqual(expectedFound);
    expect(current.lastAudioEvent).toBe('submitValid');
    expect(current.state).toBe('playing');
    expect(await entryText(page)).toBe('');

    // Step 6 — re-submitting the found word: boing, no score, entry kept (O15(b)).
    simType(first);
    await typeWord(page, first);
    expect(await messageText(page)).toBe('Girildi');
    await page.keyboard.press(ACTION_KEYS.submit);
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('submitAlreadyFound');
    current = await readGame(page);
    expect(current.score).toBe(expectedScore);
    expect(current.foundWords).toEqual(expectedFound);
    expect(await entryText(page)).toBe(first);
    await page.keyboard.press(ACTION_KEYS.scramble);
    await expect.poll(async () => (await readGame(page)).lastAudioEvent).toBe('scramble');
    expect(await entryText(page)).toBe('');
    bonus.clear();

    // Step 7 — the remaining listed slots: score/list/state after every submit.
    for (const word of SCRIPT.slice(1)) {
      const isFinalWord = word === SCRIPT[SCRIPT.length - 1];
      simType(word);
      await typeWord(page, word);
      await page.keyboard.press(ACTION_KEYS.submit);
      simValid(word);
      await expect.poll(async () => (await readGame(page)).foundWords.length).toBe(
        expectedFound.length,
      );
      current = await readGame(page);
      if (isFinalWord) {
        // Completion applies the time bonus (step 8 asserts the formula).
        expect(current.state, `state after ${word}`).toBe('celebration');
        expect(current.remainingMs % constants.timer.tickMs).toBe(0);
        const bonusOnCompletion =
          (current.remainingMs / constants.timer.tickMs) * constants.scoring.timeFactor;
        expect(current.score, `score after ${word}`).toBe(expectedScore + bonusOnCompletion);
      } else {
        expect(current.score, `score after ${word}`).toBe(expectedScore);
        expect(current.state, `state after ${word}`).toBe('playing');
      }
      expect(current.foundWords, `found list after ${word}`).toEqual(expectedFound);
      expect(current.lastAudioEvent).toBe('submitValid');
    }

    // Step 8 — completion: every listed slot filled, time bonus from the last
    // integer remaining second, input locked (O13/O14).
    expect(expectedFound).toEqual(SCRIPT);
    current = await readGame(page);
    expect(current.state).toBe('celebration');
    expect(current.remainingMs % constants.timer.tickMs).toBe(0);
    const timeBonus =
      (current.remainingMs / constants.timer.tickMs) * constants.scoring.timeFactor;
    expect(current.score).toBe(expectedScore + timeBonus);
    expect(current.remainingMs).toBeGreaterThan(0);
    await page.keyboard.press('KeyA');
    const locked = await readGame(page);
    expect(locked.foundWords).toEqual(expectedFound);
    expect(locked.score).toBe(current.score);
    expect(locked.lastAudioEvent).toBe('submitValid');

    // Step 9 — Yeni Oyun starts the sequential next round (S10; the selectRound
    // hook did not advance the default cursor).
    await page.locator('[data-testid="new-round"]').click();
    await expect.poll(async () => (await readGame(page)).state).toBe('playing');
    const restarted = await readGame(page);
    expect(restarted.roundId).toBe(ROUNDS[1]!.id);
    expect(restarted.foundWords).toEqual([]);
    expect(restarted.score).toBe(0);
    expect(restarted.remainingMs).toBeGreaterThan(190_000);

    expect(pageErrors).toEqual([]);
  });
});
