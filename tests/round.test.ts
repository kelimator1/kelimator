// tests/round.test.ts — task D1: round module (V4), frozen-schema cross-check
// (V3, ajv from devDependencies) and bank selection order (V2).
//
// Spec: docs/05-game-core.md §2 (Round model), §6 (sequential selection);
// docs/02-mechanics-spec.md §1 (checksum O03) and §3 (bonus O02);
// data/rounds.schema.json (frozen interface, C1); evidence/A2-bonus.md
// (bonusball mechanism incl. quirks), evidence/A2-checksum.md (no validation),
// evidence/B3-bank.md (bank, duplicate ids accepted).
//
// The bank is compared against a raw read of src/data/rounds.json so the test
// never depends on the loader to check the loader.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import constants from '../data/constants.json';
import {
  createBonusLetterTracker,
  createRoundSequence,
  createSeededRandom,
  parseRoundsDocument,
  RoundValidationError,
  ROUNDS,
  validateRoundsDocument,
  type BonusLetterTracker,
  type RandomSource,
} from '../src/game/round';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Raw file read (bytes parsed independently of the module's JSON import). */
const bankBytes = readFileSync(path.join(repoRoot, 'src', 'data', 'rounds.json'));
const bank = JSON.parse(bankBytes.toString('utf8')) as {
  schemaVersion: number;
  rounds: Array<{ id: string; main: string; letters: string[]; words: Record<string, string[]> }>;
};
const schema = JSON.parse(
  readFileSync(path.join(repoRoot, 'data', 'rounds.schema.json'), 'utf8'),
) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_ROUND = {
  id: 'abacilik',
  main: 'ABACILIK',
  letters: ['A', 'B', 'A', 'C', 'I', 'L', 'I', 'K'],
  words: { '3': ['ABA'], '4': [], '5': [], '6': [], '7': [], '8': ['ABACILIK'] },
};

function documentWith(round: unknown): unknown {
  return { schemaVersion: 1, rounds: [round] };
}

function cloneValidRound(): Record<string, unknown> {
  return structuredClone(VALID_ROUND);
}

/** parseRoundsDocument must reject `data`; returns the typed error. */
function rejectionOf(data: unknown): RoundValidationError {
  try {
    parseRoundsDocument(data, 'test-rounds.json');
  } catch (error) {
    if (error instanceof RoundValidationError) return error;
    throw error;
  }
  throw new Error('expected parseRoundsDocument to throw');
}

/** Scripted RNG: every roll returns `value`; records the requested ranges. */
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

/** Tracker whose very first roll is `value`. */
function trackerWithRoll(value: number): BonusLetterTracker {
  return createBonusLetterTracker(scriptedRandom(value).random);
}

/** Letter multiset of a word or letter list (display forms, code points). */
function letterCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of [...text]) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return counts;
}

function sameCounts(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [letter, count] of a) {
    if (b.get(letter) !== count) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// V3 — frozen schema validation
// ---------------------------------------------------------------------------

describe('src/data/rounds.json vs frozen schema (V3)', () => {
  it('validates with ajv (devDependency) and has zero errors', () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(bank);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('also passes the dependency-free compact validator (no runtime ajv)', () => {
    expect(validateRoundsDocument(bank)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Round load
// ---------------------------------------------------------------------------

describe('round bank load (docs/05 §2)', () => {
  it('loads the recorded bank size, first and last rounds', () => {
    expect(bank.rounds.length).toBe(7393);
    expect(ROUNDS.length).toBe(bank.rounds.length);
    expect(ROUNDS[0].id).toBe('abacilik');
    expect(ROUNDS[0].main).toBe('ABACILIK');
    expect(ROUNDS[ROUNDS.length - 1].id).toBe('sisirtme');
    expect(ROUNDS[ROUNDS.length - 1].main).toBe('ŞİŞİRTME');
  });

  it('exposes the docs/05 §2 Round fields (FİNALİZM spot check)', () => {
    const round = ROUNDS.find((item) => item.main === 'FİNALİZM');
    expect(round).toBeDefined();
    expect(round?.id).toBe('finalizm');
    expect(round?.main).toBe('FİNALİZM');
    expect(round?.letters).toEqual(['F', 'İ', 'N', 'A', 'L', 'İ', 'Z', 'M']);
    expect(round?.bonusLetter).toBeNull();
    expect(round?.words['8']).toEqual(['FİNALİZM']);
    expect(round?.words['7']).toEqual([]);
    expect(round?.words['3'][0]).toBe('AFİ');
  });

  it('starts every loaded round without a bonus letter (O02: bonusball = -1 at init)', () => {
    const withBonus = ROUNDS.filter((round) => round.bonusLetter !== null);
    expect(withBonus).toEqual([]);
  });

  it('accepts a valid minimal document and types it', () => {
    const parsed = parseRoundsDocument(documentWith(VALID_ROUND), 'test-rounds.json');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.rounds).toHaveLength(1);
    expect(parsed.rounds[0].main).toBe('ABACILIK');
    expect(parsed.rounds[0].bonusLetter).toBeNull();
    expect(parsed.rounds[0].words['8']).toEqual(['ABACILIK']);
  });

  it('loads duplicate id slugs without assuming uniqueness (docs/06 §4 amendment)', () => {
    const saklamak = ROUNDS.filter((round) => round.id === 'saklamak');
    expect(saklamak.map((round) => round.main)).toEqual(['SAKLAMAK', 'ŞAKLAMAK']);
  });
});

// ---------------------------------------------------------------------------
// Malformed documents — failing path in the error
// ---------------------------------------------------------------------------

describe('malformed rounds document rejected with failing path', () => {
  it('rejects non-objects at $', () => {
    expect(rejectionOf(null).issues.map((issue) => issue.path)).toEqual(['$']);
    expect(rejectionOf('nope').issues[0].path).toBe('$');
  });

  it('reports missing root properties', () => {
    const error = rejectionOf({});
    expect(error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['$.schemaVersion', '$.rounds']),
    );
    expect(error.message).toContain('$.rounds');
  });

  it('reports schemaVersion violations at $.schemaVersion', () => {
    const error = rejectionOf({ schemaVersion: 2, rounds: [VALID_ROUND] });
    expect(error.issues.map((issue) => issue.path)).toContain('$.schemaVersion');
    expect(error.message).toContain('$.schemaVersion');
  });

  it('reports root additional properties', () => {
    const error = rejectionOf({ schemaVersion: 1, rounds: [VALID_ROUND], extra: 1 });
    expect(error.issues.map((issue) => issue.path)).toContain('$.extra');
  });

  it('reports an empty rounds array (minItems 1) and non-array rounds', () => {
    const empty = rejectionOf({ schemaVersion: 1, rounds: [] });
    expect(empty.issues.map((issue) => issue.path)).toContain('$.rounds');
    const notArray = rejectionOf({ schemaVersion: 1, rounds: {} });
    expect(notArray.issues.map((issue) => issue.path)).toContain('$.rounds');
  });

  it('reports non-object round items', () => {
    const error = rejectionOf({ schemaVersion: 1, rounds: ['ABACILIK'] });
    expect(error.issues.map((issue) => issue.path)).toContain('$.rounds[0]');
  });

  it('reports a missing round property with its path', () => {
    const round = cloneValidRound();
    delete round.main;
    const error = rejectionOf(documentWith(round));
    expect(error.issues.map((issue) => issue.path)).toContain('$.rounds[0].main');
    expect(error.message).toContain('$.rounds[0].main');
  });

  it('reports id pattern violations', () => {
    const error = rejectionOf(documentWith({ ...cloneValidRound(), id: 'ABACILIK' }));
    expect(error.issues.map((issue) => issue.path)).toContain('$.rounds[0].id');
  });

  it('reports main length violations', () => {
    const error = rejectionOf(documentWith({ ...cloneValidRound(), main: 'ABACILI' }));
    expect(error.issues.map((issue) => issue.path)).toContain('$.rounds[0].main');
  });

  it('reports letters length and per-letter violations', () => {
    const short = rejectionOf(
      documentWith({ ...cloneValidRound(), letters: ['A', 'B', 'A', 'C', 'I', 'L', 'I'] }),
    );
    expect(short.issues.map((issue) => issue.path)).toContain('$.rounds[0].letters');

    const letter = cloneValidRound();
    (letter.letters as string[])[2] = '';
    const perLetter = rejectionOf(documentWith(letter));
    expect(perLetter.issues.map((issue) => issue.path)).toContain('$.rounds[0].letters[2]');
    expect(perLetter.message).toContain('$.rounds[0].letters[2]');

    const nonString = cloneValidRound();
    (nonString.letters as unknown[])[2] = 42;
    expect(rejectionOf(documentWith(nonString)).issues.map((issue) => issue.path)).toContain(
      '$.rounds[0].letters[2]',
    );
  });

  it('reports missing words keys and non-array lists', () => {
    const missing = cloneValidRound();
    delete (missing.words as Record<string, unknown>)['7'];
    expect(rejectionOf(documentWith(missing)).issues.map((issue) => issue.path)).toContain(
      '$.rounds[0].words.7',
    );

    const wrongType = cloneValidRound();
    (wrongType.words as Record<string, unknown>)['3'] = 'ABA';
    expect(rejectionOf(documentWith(wrongType)).issues.map((issue) => issue.path)).toContain(
      '$.rounds[0].words.3',
    );

    const wrongItem = cloneValidRound();
    (wrongItem.words as Record<string, unknown>)['3'] = [1];
    expect(rejectionOf(documentWith(wrongItem)).issues.map((issue) => issue.path)).toContain(
      '$.rounds[0].words.3[0]',
    );
  });

  it('reports additional round and words properties', () => {
    const extraRound = rejectionOf(documentWith({ ...cloneValidRound(), extra: true }));
    expect(extraRound.issues.map((issue) => issue.path)).toContain('$.rounds[0].extra');

    const extraKey = cloneValidRound();
    (extraKey.words as Record<string, unknown>)['9'] = [];
    expect(rejectionOf(documentWith(extraKey)).issues.map((issue) => issue.path)).toContain(
      '$.rounds[0].words.9',
    );

    const zeroPadded = cloneValidRound();
    (zeroPadded.words as Record<string, unknown>)['03'] = [];
    expect(rejectionOf(documentWith(zeroPadded)).issues.map((issue) => issue.path)).toContain(
      '$.rounds[0].words.03',
    );
  });

  it('collects every violation and names the source', () => {
    const error = rejectionOf({ schemaVersion: '1', rounds: [{ id: 'X' }] });
    expect(error.issues.length).toBeGreaterThan(1);
    expect(error.message).toContain('test-rounds.json');
    // the loader default source is the runtime artifact path
    try {
      parseRoundsDocument({});
      expect.unreachable('parseRoundsDocument must throw');
    } catch (thrown) {
      expect((thrown as Error).message).toContain('src/data/rounds.json');
    }
  });
});

// ---------------------------------------------------------------------------
// V2 — sequential selection equals file order
// ---------------------------------------------------------------------------

describe('sequential round selection equals file order (V2)', () => {
  it('yields length, first and last equal to the file (7393 rounds)', () => {
    const sequence = createRoundSequence();
    const selected = [];
    while (sequence.hasNext()) selected.push(sequence.next());

    expect(sequence.size).toBe(7393);
    expect(selected.length).toBe(bank.rounds.length);
    expect(selected[0].main).toBe(bank.rounds[0].main);
    expect(selected[selected.length - 1].main).toBe(bank.rounds[bank.rounds.length - 1].main);
    expect(selected.map((round) => round.main)).toEqual(bank.rounds.map((round) => round.main));
    expect(selected.map((round) => round.id)).toEqual(bank.rounds.map((round) => round.id));
  });

  it('tracks nextIndex, supports reset() and throws when exhausted', () => {
    const sequence = createRoundSequence();
    expect(sequence.nextIndex).toBe(0);
    expect(sequence.next()).toBe(ROUNDS[0]);
    expect(sequence.next()).toBe(ROUNDS[1]);
    expect(sequence.nextIndex).toBe(2);
    sequence.reset();
    expect(sequence.nextIndex).toBe(0);
    expect(sequence.next()).toBe(ROUNDS[0]);

    const tiny = createRoundSequence(ROUNDS.slice(0, 1));
    expect(tiny.hasNext()).toBe(true);
    expect(tiny.next()).toBe(ROUNDS[0]);
    expect(tiny.hasNext()).toBe(false);
    expect(() => tiny.next()).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// letters === multiset of main
// ---------------------------------------------------------------------------

describe('letters are the multiset of main', () => {
  it('holds for every round in the bank', () => {
    const problems: string[] = [];
    for (const round of ROUNDS) {
      if (round.letters.length !== 8) {
        problems.push(`${round.main}: ${round.letters.length} letters`);
        continue;
      }
      if (!sameCounts(letterCounts(round.letters.join('')), letterCounts(round.main))) {
        problems.push(`${round.main}: letters != multiset(main)`);
      }
    }
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bonus letter helper (O02)
// ---------------------------------------------------------------------------

describe('bonus letter helper (O02, evidence/A2-bonus.md)', () => {
  it('uses the recorded seed from data/constants.json (amendment 2026-09-28b)', () => {
    expect(constants.bonusLetter.seed).toBe(2012);
  });

  it('rolls random(1000) on adds while no bonus is pending, and only then', () => {
    const scripted = scriptedRandom(999);
    const tracker = createBonusLetterTracker(scripted.random);
    tracker.addLetter(1);
    tracker.addLetter(2);
    tracker.addLetter(3);
    expect(scripted.ranges).toEqual([1000, 1000, 1000]);

    const lucky = scriptedRandom(49);
    const luckyTracker = createBonusLetterTracker(lucky.random);
    luckyTracker.addLetter(1); // selects the bonus (bonusball = 1)
    luckyTracker.addLetter(2); // pending: no further roll
    luckyTracker.addLetter(3);
    expect(lucky.ranges).toEqual([1000]);
    expect(luckyTracker.ball).toBe(1);
  });

  it('treats rolls below 50 as lucky and the 50/1000 cut as not lucky', () => {
    expect(trackerWithRoll(49).ball).toBe(-1); // before any add
    const below = trackerWithRoll(49);
    below.addLetter(1);
    expect(below.ball).toBe(1); // bonusball = kelime.length AFTER the add
    expect(below.hasPendingBonus).toBe(true);

    const cut = trackerWithRoll(50);
    cut.addLetter(1);
    expect(cut.ball).toBe(-1);
    expect(cut.hasPendingBonus).toBe(false);

    const lowest = trackerWithRoll(0);
    lowest.addLetter(4);
    expect(lowest.ball).toBe(4);

    const highest = trackerWithRoll(999);
    highest.addLetter(8);
    expect(highest.ball).toBe(-1);
  });

  it('marks the NEXT added ball (the triggering add never lights) and pays on submit immediately', () => {
    const tracker = trackerWithRoll(49);
    tracker.addLetter(3); // entry has balls 0..2; bonusball = 3 = the next ball
    expect(tracker.ball).toBe(3);
    // Reference quirk (a): submitting right now still scores +5000 although no
    // bright ball was ever shown (evidence/A2-bonus.md §3 quirks).
    expect(tracker.hasPendingBonus).toBe(true);
  });

  it('resets when the bright ball is removed, not when another ball is removed', () => {
    const tracker = trackerWithRoll(49);
    tracker.addLetter(1); // bonusball = 1 (next ball)
    tracker.removeLastLetter(1); // removes ball 0 (ball != 0): pending survives
    expect(tracker.ball).toBe(1);
    tracker.addLetter(2); // mock re-add; pending, no roll
    expect(tracker.ball).toBe(1);
    tracker.removeLastLetter(2); // removes ball 1 == bonusball: reset
    expect(tracker.ball).toBe(-1);
    tracker.removeLastLetter(0); // empty entry: no-op, no crash
    expect(tracker.ball).toBe(-1);
  });

  it('clears on a non-empty entry clear and survives an empty-entry clear', () => {
    const tracker = trackerWithRoll(49);
    tracker.addLetter(1);
    tracker.clearEntry(0); // scramble with nothing typed: pending survives (quirk b)
    expect(tracker.ball).toBe(1);
    tracker.clearEntry(1); // valid submit / scramble with entry: reset
    expect(tracker.ball).toBe(-1);
  });

  it('keeps a pending bonus until the valid-submit clear (the +5000 window)', () => {
    const tracker = trackerWithRoll(49);
    tracker.addLetter(1);
    // Invalid submit keeps the entry: the tracker is not touched (buzz path),
    // and D3 adds scoring.bonusPoints for a valid submit while pending.
    expect(tracker.hasPendingBonus).toBe(true);
    tracker.clearEntry(1); // valid-submit clear (reference duzenle("temizle"))
    expect(tracker.hasPendingBonus).toBe(false);
    expect(tracker.ball).toBe(-1);
  });

  it('resets at round start via reset()', () => {
    const tracker = trackerWithRoll(49);
    tracker.addLetter(1);
    tracker.reset();
    expect(tracker.ball).toBe(-1);
    expect(tracker.hasPendingBonus).toBe(false);
  });

  it('is deterministic for the recorded seed (golden mulberry32 stream)', () => {
    const seed = constants.bonusLetter.seed;
    const first = createSeededRandom(seed);
    const second = createSeededRandom(seed);
    const streamA = Array.from({ length: 20 }, () => first.randomInt(1000));
    const streamB = Array.from({ length: 20 }, () => second.randomInt(1000));
    // Recorded in evidence/D1-round.md §4 (roll 0 of add 53 is the first
    // value below the 50/1000 cut).
    expect(streamA).toEqual([
      394, 477, 205, 796, 679, 724, 783, 670, 512, 414, 129, 798, 350, 552, 582, 523, 283,
      418, 115, 866,
    ]);
    expect(streamB).toEqual(streamA);
  });

  it('finds its first lucky roll for seed 2012 at round 7, letter 5 (add 53)', () => {
    const tracker = createBonusLetterTracker(createSeededRandom(constants.bonusLetter.seed));
    let found: { round: number; letter: number } | null = null;
    for (let round = 1; round <= 7 && found === null; round += 1) {
      for (let letter = 1; letter <= 8; letter += 1) {
        tracker.addLetter(letter);
        if (tracker.hasPendingBonus) {
          found = { round, letter };
          break;
        }
      }
      if (found === null) tracker.clearEntry(8); // valid submit at round end
    }
    expect(found).toEqual({ round: 7, letter: 5 });
    expect(tracker.ball).toBe(5);
  });

  it('createSeededRandom returns integers in [0, range)', () => {
    const random = createSeededRandom(constants.bonusLetter.seed);
    const values = Array.from({ length: 2000 }, () => random.randomInt(1000));
    expect(values.every((value) => Number.isInteger(value) && value >= 0 && value < 1000)).toBe(
      true,
    );
    expect(() => random.randomInt(0)).toThrow(RangeError);
  });
});
