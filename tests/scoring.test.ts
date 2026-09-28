// tests/scoring.test.ts — task D3: scoring engine (V4 oracle, V7 source scan).
//
// Oracle (docs/07-verification.md §1 / T08, formulas docs/02 §3):
//   3-letter word, no bonus          -> 450
//   8-letter main word, no bonus     -> 3200
//   4-letter word containing bonus   -> 5800
//   remaining time 100 s             -> +10000
//
// The engine receives the scoring constants from data/constants.json through
// the caller (docs/05-game-core.md §1); the V7 scan asserts that neither D3
// module hardcodes a game value and that every flagged numeric literal in
// them carries an `// evidence:` comment. The scan covers both D3 modules, so
// `npm test -- scoring` and `npm test -- timer` each enforce the full claim.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import constants from '../data/constants.json';
import { createBonusLetterTracker, type RandomSource } from '../src/game/round';
import { NO_BONUS_BALL, scoreTimeBonus, scoreWord } from '../src/game/scoring';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** The two modules owned by D3 (V7 scan scope). */
const D3_MODULES = ['src/game/scoring.ts', 'src/game/timer.ts'] as const;

/** Game values that must never appear as code literals (from constants.json). */
const GAME_VALUES = [
  constants.timer.initialSeconds,
  constants.timer.tickMs,
  constants.scoring.perLetterSquaredFactor,
  constants.scoring.bonusPoints,
  constants.scoring.timeFactor,
];

/** Scripted RNG (same pattern as D1's tests): every roll returns `value`. */
function scriptedRandom(value: number): { random: RandomSource; ranges: number[] } {
  const ranges: number[] = [];
  return {
    ranges,
    random: {
      randomInt(range: number): number {
        ranges.push(range);
        return value;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// V7 scanner (shared shape with tests/timer.test.ts)
// ---------------------------------------------------------------------------

/** Blank out comments but keep line numbers (newlines preserved). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => {
      const commentStart = line.indexOf('//');
      return commentStart === -1 ? line : line.slice(0, commentStart);
    })
    .join('\n');
}

/**
 * Scan one module source: every numeric literal in code must carry an
 * `// evidence:` comment on its line or on the line above, and must not be a
 * game value from data/constants.json; the module must not read the JSON
 * directly (docs/05 §1). Returns human-readable problems.
 */
function scanModuleSource(source: string, label: string, gameValues: readonly number[]): string[] {
  const rawLines = source.split('\n');
  const codeLines = stripComments(source).split('\n');
  const problems: string[] = [];
  codeLines.forEach((code, index) => {
    const literals = code.match(/\d+(?:\.\d+)?/g) ?? [];
    if (literals.length === 0) return;
    const annotated =
      rawLines[index].includes('// evidence:') ||
      (index > 0 && rawLines[index - 1].includes('// evidence:'));
    for (const literal of literals) {
      if (!annotated) {
        problems.push(
          `${label}:${index + 1}: numeric literal ${literal} lacks an // evidence: comment`,
        );
      }
      if (gameValues.includes(Number(literal))) {
        problems.push(
          `${label}:${index + 1}: hardcoded game value ${literal} (must come from data/constants.json)`,
        );
      }
    }
  });
  if (codeLines.join('\n').includes('constants.json')) {
    problems.push(`${label}: module must not read data/constants.json directly (docs/05 §1)`);
  }
  return problems;
}

function scanModule(relativePath: string, gameValues: readonly number[]): string[] {
  return scanModuleSource(
    readFileSync(path.join(repoRoot, relativePath), 'utf8'),
    relativePath,
    gameValues,
  );
}

// ---------------------------------------------------------------------------
// V4 — docs/07 §1 oracle, exactly
// ---------------------------------------------------------------------------

describe('scoring oracle — docs/07-verification.md §1 (T08)', () => {
  it('3-letter word, no bonus -> 450', () => {
    const score = scoreWord('ABA', NO_BONUS_BALL, constants.scoring);
    expect(score.letterCount).toBe(3);
    expect(score.basePoints).toBe(450);
    expect(score.bonusApplied).toBe(false);
    expect(score.bonusPoints).toBe(0);
    expect(score.totalPoints).toBe(450);
  });

  it('8-letter main word, no bonus -> 3200', () => {
    const score = scoreWord('FİNALİZM', NO_BONUS_BALL, constants.scoring);
    expect(score.letterCount).toBe(8);
    expect(score.basePoints).toBe(3200);
    expect(score.bonusApplied).toBe(false);
    expect(score.totalPoints).toBe(3200);
  });

  it('4-letter word containing bonus letter -> 5800', () => {
    // O02: the bright ball is the ball at 0-based index `bonusball`; ball 1
    // of a 4-letter entry is inside the submitted word (evidence/A2-bonus.md
    // §2–§3).
    const score = scoreWord('KELİ', 1, constants.scoring);
    expect(score.letterCount).toBe(4);
    expect(score.basePoints).toBe(800);
    expect(score.bonusApplied).toBe(true);
    expect(score.bonusPoints).toBe(5000);
    expect(score.totalPoints).toBe(5800);
  });

  it('remaining time 100 s at completion -> +10000', () => {
    expect(scoreTimeBonus(100, constants.scoring)).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// V4 — formula details (docs/02 §3, docs/05 §4)
// ---------------------------------------------------------------------------

describe('formula details (docs/02 §3, docs/05 §4)', () => {
  const WORDS_BY_LENGTH = ['ABA', 'DÖRT', 'BEŞLİ', 'ALTILI', 'YEDİLİK', 'FİNALİZM'];

  it('base points = n² × perLetterSquaredFactor for letter counts 3..8', () => {
    WORDS_BY_LENGTH.forEach((word, index) => {
      const letterCount = index + 3;
      const score = scoreWord(word, NO_BONUS_BALL, constants.scoring);
      expect(score.letterCount).toBe(letterCount);
      expect(score.basePoints).toBe(
        letterCount * letterCount * constants.scoring.perLetterSquaredFactor,
      );
    });
  });

  it('adds bonusPoints exactly once for a bonus word', () => {
    const score = scoreWord('FİNALİZM', 7, constants.scoring);
    expect(score.bonusApplied).toBe(true);
    expect(score.bonusPoints).toBe(constants.scoring.bonusPoints);
    expect(score.totalPoints).toBe(3200 + 5000);
  });

  it('keeps every result an exact integer (no float drift)', () => {
    const values: number[] = [];
    for (let letterCount = 3; letterCount <= 8; letterCount += 1) {
      const word = 'X'.repeat(letterCount);
      values.push(scoreWord(word, NO_BONUS_BALL, constants.scoring).totalPoints);
      values.push(scoreWord(word, letterCount, constants.scoring).totalPoints);
    }
    for (let seconds = 0; seconds <= 200; seconds += 1) {
      values.push(scoreTimeBonus(seconds, constants.scoring));
    }
    expect(values.every((value) => Number.isInteger(value))).toBe(true);
  });

  it('time bonus is proportional to the last integer second', () => {
    expect(scoreTimeBonus(0, constants.scoring)).toBe(0);
    expect(scoreTimeBonus(1, constants.scoring)).toBe(constants.scoring.timeFactor);
    expect(scoreTimeBonus(199, constants.scoring)).toBe(199 * constants.scoring.timeFactor);
  });
});

// ---------------------------------------------------------------------------
// V4 — O02 bonus integration through D1's tracker (no duplicated RNG)
// ---------------------------------------------------------------------------

describe('bonus integration with the D1 BonusLetterTracker (O02)', () => {
  it('pays bonusPoints once while pending, then nothing after the submit clear', () => {
    const tracker = createBonusLetterTracker(scriptedRandom(49).random);
    tracker.addLetter(1); // lucky roll: bonusball = kelime.length = 1
    expect(tracker.hasPendingBonus).toBe(true);

    const first = scoreWord('KELİ', tracker.ball, constants.scoring);
    expect(first.totalPoints).toBe(5800);

    // Reference ekle(): the valid submit scores, then duzenle("temizle")
    // clears the entry (and the pending bonus).
    tracker.clearEntry(first.letterCount);
    expect(tracker.hasPendingBonus).toBe(false);
    expect(scoreWord('KELİ', tracker.ball, constants.scoring).totalPoints).toBe(800);
  });

  it('pays no bonus when the roll was not lucky (cut is 50 below 1000)', () => {
    const tracker = createBonusLetterTracker(scriptedRandom(50).random);
    tracker.addLetter(1);
    expect(tracker.hasPendingBonus).toBe(false);
    expect(scoreWord('KELİ', tracker.ball, constants.scoring).totalPoints).toBe(800);
  });

  it('preserves O02 quirk (a): pays although the lucky roll landed on the last added letter', () => {
    const tracker = createBonusLetterTracker(scriptedRandom(49).random);
    tracker.addLetter(4); // bonusball = 4 = entry length: no bright ball shown
    expect(tracker.ball).toBe(4);
    expect(tracker.hasPendingBonus).toBe(true);
    expect(scoreWord('KELİ', tracker.ball, constants.scoring).totalPoints).toBe(5800);
  });

  it('does not roll the RNG itself (scoring is a pure function of tracker.ball)', () => {
    const scripted = scriptedRandom(49);
    const tracker = createBonusLetterTracker(scripted.random);
    tracker.addLetter(1);
    const rollsAfterAdd = scripted.ranges.length;
    scoreWord('KELİ', tracker.ball, constants.scoring);
    expect(scripted.ranges.length).toBe(rollsAfterAdd);
  });
});

// ---------------------------------------------------------------------------
// V4 — structural input validation
// ---------------------------------------------------------------------------

describe('input validation (structural)', () => {
  it('rejects bonus balls below the sentinel and non-integers', () => {
    expect(() => scoreWord('KELİ', -2, constants.scoring)).toThrow(RangeError);
    expect(() => scoreWord('KELİ', 0.5, constants.scoring)).toThrow(RangeError);
  });

  it('rejects negative/non-integer remaining seconds and malformed constants', () => {
    expect(() => scoreTimeBonus(-1, constants.scoring)).toThrow(RangeError);
    expect(() => scoreTimeBonus(1.5, constants.scoring)).toThrow(RangeError);
    expect(() =>
      scoreWord('KELİ', NO_BONUS_BALL, { ...constants.scoring, timeFactor: -1 }),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// V7 — data/constants.json is the value source
// ---------------------------------------------------------------------------

describe('V7 — values come from data/constants.json; no hardcoded game literals', () => {
  it('data/constants.json carries the confirmed scoring values', () => {
    expect(constants.scoring).toEqual({
      perLetterSquaredFactor: 50,
      bonusPoints: 5000,
      timeFactor: 100,
    });
  });

  it('scans every D3 module source: no unannotated literal, no hardcoded game value', () => {
    const problems = D3_MODULES.flatMap((module) => scanModule(module, GAME_VALUES));
    expect(problems).toEqual([]);
  });

  it('scanner self-test: detects unannotated and hardcoded literals', () => {
    expect(scanModuleSource('const bad = 7;\n', '<self>', [])).toEqual([
      '<self>:1: numeric literal 7 lacks an // evidence: comment',
    ]);
    expect(scanModuleSource('// evidence: test\nconst bad = 50;\n', '<self>', [50])).toEqual([
      '<self>:2: hardcoded game value 50 (must come from data/constants.json)',
    ]);
    expect(scanModuleSource('// evidence: test\nconst ok = 50;\n', '<self>', [])).toEqual([]);
  });
});
