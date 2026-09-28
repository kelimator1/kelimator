// src/game/round.ts — round model + loader (validates src/data/rounds.json)
// (docs/04-architecture.md §4; docs/05-game-core.md §2, §6; EXECUTION.md §5).
//
// Contract (docs/05 §1): this module owns the Round model, the validated round
// bank and sequential round selection. It never reads `data/constants.json`
// (the app loads constants once at bootstrap and passes typed values).
//
// Round identity: the array order of `src/data/rounds.json` (docs/06 §4
// amendment 2026-09-28: duplicate `id` slugs are accepted; ids must not be
// assumed unique — evidence/B3-bank.md §6).
//
// Checksum (`harf="9999"`): NONE. The 2012 client stores the 9999 entry in
// `kelimatorid` during `myOnLoad` but never compares, recomputes or branches on
// it; its only consumer was the excluded `hiscore.php` URL. The rebuilt bank
// carries no checksum field (frozen schema `data/rounds.schema.json`).
// evidence: evidence/A2-checksum.md §1–§3; docs/02-mechanics-spec.md §1 (O03).
//
// Bonus letter (O02): the reference starts every round with `bonusball = -1`
// (`init()`); a bonus is selected *while letters are added*: on every add while
// `bonusball == -1`, `bonusrnd = random(1000)`; when `bonusrnd < 50` (5 %)
// `bonusball = kelime.length` — the 0-based index of the NEXT ball, which is
// the ball that gets the bright ("getir1"/"gotur1") animation. The next valid
// submit scores +5000 while `bonusball > -1` (scoring: D3/D5 add
// `scoring.bonusPoints`); the reference clears the entry after a valid submit
// (`duzenle("temizle")`), which resets `bonusball` to -1. Deleting the bright
// ball resets it; clearing an EMPTY entry does not (scramble quirk).
// evidence: evidence/A2-bonus.md §2–§3; docs/02-mechanics-spec.md §3 (O02).

import roundsJson from '../data/rounds.json';

/** Source label used in load-time validation errors. */
export const ROUNDS_SOURCE = 'src/data/rounds.json';

// ---------------------------------------------------------------------------
// Round model (docs/05-game-core.md §2)
// ---------------------------------------------------------------------------

/** Word-list lengths present in a round (frozen schema keys "3".."8"). */
export type WordLength = 3 | 4 | 5 | 6 | 7 | 8;

/**
 * The 8 letters of `main` in main-word order. docs/05 §2 calls the field the
 * "multiset of main word letters"; the order is B3's recorded choice
 * (main-word order, evidence/B3-bank.md §1).
 */
export type RoundLetters = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

/** Word lists by length; display forms, sorted (docs/05 §2). */
export type RoundWords = Readonly<Record<WordLength, readonly string[]>>;

/**
 * One playable round (docs/05-game-core.md §2).
 *
 * `words` carries all six frozen keys. docs/05 §2 sketches `Record<3|4|5|6|7>`;
 * the frozen schema additionally requires the "8" list (which holds only the
 * main word, docs/02 §1 and every fixture), so the typed view is a superset of
 * the sketch — no key is dropped from the frozen data.
 *
 * `bonusLetter` is null at load: per O02 no bonus exists before the first added
 * letter (`bonusball = -1` in `init()`); the per-round dynamic selection is
 * owned by `createBonusLetterTracker` (evidence/A2-bonus.md §2–§3).
 */
export interface Round {
  readonly id: string; // stable slug of the main word (may repeat)
  readonly main: string; // 8-letter word (display form)
  readonly letters: RoundLetters; // multiset of main word letters
  readonly bonusLetter: string | null; // null until O02 selection during play
  readonly words: RoundWords; // display forms, sorted
}

/** Validated `src/data/rounds.json` document (frozen schema shape). */
export interface RoundsDocument {
  readonly schemaVersion: 1;
  readonly rounds: readonly Round[];
}

// ---------------------------------------------------------------------------
// Compact validator for the frozen schema (data/rounds.schema.json, C1)
// ---------------------------------------------------------------------------

/** One schema violation with a JSONPath-like path ("$.rounds[3].main"). */
export interface RoundValidationIssue {
  readonly path: string;
  readonly message: string;
}

/** Thrown when a rounds document violates the frozen schema (fail fast). */
export class RoundValidationError extends Error {
  readonly issues: readonly RoundValidationIssue[];

  constructor(source: string, issues: readonly RoundValidationIssue[]) {
    const details = issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    super(`${source}: ${issues.length} schema violation(s): ${details}`);
    this.name = 'RoundValidationError';
    this.issues = issues;
  }
}

// The literals below mirror the frozen data/rounds.schema.json constraints.
const ROUND_KEYS: readonly string[] = ['id', 'main', 'letters', 'words'];
const WORD_LENGTHS: readonly WordLength[] = [3, 4, 5, 6, 7, 8];
const ID_PATTERN = /^[a-z0-9-]+$/;
// evidence: data/rounds.schema.json — main minLength/maxLength 8, letters minItems/maxItems 8.
const ROUND_LETTER_COUNT = 8;
// evidence: data/rounds.schema.json — letters items minLength/maxLength 1.
const LETTER_CODE_POINTS = 1;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON Schema `minLength`/`maxLength` count Unicode code points. */
function codePointLength(value: string): number {
  return [...value].length;
}

function validateRound(value: unknown, index: number, issues: RoundValidationIssue[]): void {
  const path = `$.rounds[${index}]`;
  if (!isPlainObject(value)) {
    issues.push({ path, message: 'expected an object' });
    return;
  }

  for (const key of Object.keys(value)) {
    if (!ROUND_KEYS.includes(key)) {
      issues.push({
        path: `${path}.${key}`,
        message: 'additional property not allowed (id, main, letters, words only)',
      });
    }
  }

  if (!('id' in value)) {
    issues.push({ path: `${path}.id`, message: 'required property missing' });
  } else if (typeof value.id !== 'string') {
    issues.push({ path: `${path}.id`, message: `expected a string, got ${typeof value.id}` });
  } else if (!ID_PATTERN.test(value.id)) {
    issues.push({
      path: `${path}.id`,
      message: `expected pattern ${ID_PATTERN.source}, got ${JSON.stringify(value.id)}`,
    });
  }

  if (!('main' in value)) {
    issues.push({ path: `${path}.main`, message: 'required property missing' });
  } else if (typeof value.main !== 'string') {
    issues.push({ path: `${path}.main`, message: `expected a string, got ${typeof value.main}` });
  } else if (codePointLength(value.main) !== ROUND_LETTER_COUNT) {
    issues.push({
      path: `${path}.main`,
      message: `expected exactly 8 characters (minLength/maxLength 8), got ${codePointLength(value.main)}`,
    });
  }

  if (!('letters' in value)) {
    issues.push({ path: `${path}.letters`, message: 'required property missing' });
  } else if (!Array.isArray(value.letters)) {
    issues.push({ path: `${path}.letters`, message: `expected an array, got ${typeof value.letters}` });
  } else {
    if (value.letters.length !== ROUND_LETTER_COUNT) {
      issues.push({
        path: `${path}.letters`,
        message: `expected exactly 8 items (minItems/maxItems 8), got ${value.letters.length}`,
      });
    }
    value.letters.forEach((letter, letterIndex) => {
      const letterPath = `${path}.letters[${letterIndex}]`;
      if (typeof letter !== 'string') {
        issues.push({ path: letterPath, message: `expected a string, got ${typeof letter}` });
      } else if (codePointLength(letter) !== LETTER_CODE_POINTS) {
        issues.push({
          path: letterPath,
          message: `expected exactly 1 character (minLength/maxLength 1), got ${JSON.stringify(letter)}`,
        });
      }
    });
  }

  if (!('words' in value)) {
    issues.push({ path: `${path}.words`, message: 'required property missing' });
  } else if (!isPlainObject(value.words)) {
    issues.push({ path: `${path}.words`, message: `expected an object, got ${typeof value.words}` });
  } else {
    const words = value.words;
    for (const key of Object.keys(words)) {
      if (!WORD_LENGTHS.includes(Number(key) as WordLength) || String(Number(key)) !== key) {
        issues.push({
          path: `${path}.words.${key}`,
          message: 'additional property not allowed (keys 3, 4, 5, 6, 7, 8 only)',
        });
      }
    }
    for (const length of WORD_LENGTHS) {
      const listPath = `${path}.words.${length}`;
      const key = String(length);
      if (!(key in words)) {
        issues.push({ path: listPath, message: 'required property missing' });
        continue;
      }
      const list = words[key];
      if (!Array.isArray(list)) {
        issues.push({ path: listPath, message: `expected an array, got ${typeof list}` });
        continue;
      }
      list.forEach((word, wordIndex) => {
        if (typeof word !== 'string') {
          issues.push({
            path: `${listPath}[${wordIndex}]`,
            message: `expected a string, got ${typeof word}`,
          });
        }
      });
    }
  }
}

/**
 * Validate a parsed rounds document against the frozen schema constraints
 * (data/rounds.schema.json). Returns every violation; an empty array passes.
 * Dependency-free by design: no runtime dependency beyond the app itself
 * (docs/04 §1), so the frozen schema's constraints are re-implemented here —
 * the schema itself is the interface (EXECUTION.md §5 "frozen interfaces").
 */
export function validateRoundsDocument(data: unknown): RoundValidationIssue[] {
  const issues: RoundValidationIssue[] = [];
  if (!isPlainObject(data)) {
    issues.push({ path: '$', message: `expected an object, got ${data === null ? 'null' : typeof data}` });
    return issues;
  }

  for (const key of Object.keys(data)) {
    if (key !== 'schemaVersion' && key !== 'rounds') {
      issues.push({
        path: `$.${key}`,
        message: 'additional property not allowed (schemaVersion, rounds only)',
      });
    }
  }

  if (!('schemaVersion' in data)) {
    issues.push({ path: '$.schemaVersion', message: 'required property missing' });
  } else if (data.schemaVersion !== 1) {
    issues.push({
      path: '$.schemaVersion',
      message: `expected const 1, got ${JSON.stringify(data.schemaVersion)}`,
    });
  }

  if (!('rounds' in data)) {
    issues.push({ path: '$.rounds', message: 'required property missing' });
    return issues;
  }
  const rounds = data.rounds;
  if (!Array.isArray(rounds)) {
    issues.push({ path: '$.rounds', message: `expected an array, got ${typeof rounds}` });
    return issues;
  }
  if (rounds.length < 1) {
    issues.push({ path: '$.rounds', message: 'expected at least 1 item (minItems 1)' });
    return issues;
  }
  rounds.forEach((round, index) => validateRound(round, index, issues));
  return issues;
}

// ---------------------------------------------------------------------------
// Bank load (fail fast)
// ---------------------------------------------------------------------------

/** Post-validation view of one frozen round entry (internal). */
interface RawRound {
  readonly id: string;
  readonly main: string;
  readonly letters: readonly string[];
  readonly words: Readonly<Record<string, readonly string[]>>;
}

function toRound(raw: RawRound): Round {
  return {
    id: raw.id,
    main: raw.main,
    letters: raw.letters as unknown as RoundLetters,
    // O02: `bonusball = -1` at round start; no bonus letter exists yet
    // (evidence/A2-bonus.md §2–§3). The dynamic selection is owned by
    // createBonusLetterTracker below.
    bonusLetter: null,
    words: raw.words as unknown as RoundWords,
  };
}

/**
 * Validate a parsed rounds document and convert it to typed rounds. Throws
 * `RoundValidationError` naming every failing path (JSONPath-like) when the
 * document violates the frozen schema.
 */
export function parseRoundsDocument(data: unknown, source: string = ROUNDS_SOURCE): RoundsDocument {
  const issues = validateRoundsDocument(data);
  if (issues.length > 0) throw new RoundValidationError(source, issues);
  const document = data as { schemaVersion: 1; rounds: readonly RawRound[] };
  return {
    schemaVersion: 1,
    rounds: document.rounds.map(toRound),
  };
}

/**
 * The loaded, validated round bank. Validation runs at module load: a malformed
 * `src/data/rounds.json` fails fast (RoundValidationError with the failing
 * path(s)). The whole shipped bank validates at G2 (B3 evidence).
 */
export const ROUNDS: readonly Round[] = parseRoundsDocument(roundsJson, ROUNDS_SOURCE).rounds;

// ---------------------------------------------------------------------------
// Sequential round selection (docs/05 §6)
// ---------------------------------------------------------------------------

/**
 * Sequential round selection. docs/05 §6: `newRound()` picks the next round in
 * file order (no random selection, so playthroughs stay deterministic for
 * tests); the array order is the identity (duplicate ids are allowed).
 */
export interface RoundSequence {
  /** Number of rounds in the bank. */
  readonly size: number;
  /** 0-based index of the round `next()` will return. */
  readonly nextIndex: number;
  /** True while an unselected round remains. */
  hasNext(): boolean;
  /**
   * Next round in file order. Throws RangeError when the bank is exhausted;
   * docs/05 §6 does not define end-of-bank behavior, so the caller decides
   * (`reset()` restarts at the first round).
   */
  next(): Round;
  /** Restart at the first round of the bank. */
  reset(): void;
}

/** Create a selection cursor over `rounds` (defaults to the loaded bank). */
export function createRoundSequence(rounds: readonly Round[] = ROUNDS): RoundSequence {
  let index = 0;
  return {
    get size(): number {
      return rounds.length;
    },
    get nextIndex(): number {
      return index;
    },
    hasNext(): boolean {
      return index < rounds.length;
    },
    next(): Round {
      const round = rounds[index];
      if (round === undefined) {
        throw new RangeError(
          `round bank exhausted: no round at index ${index} (bank size ${rounds.length})`,
        );
      }
      index += 1;
      return round;
    },
    reset(): void {
      index = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Bonus letter (O02)
// ---------------------------------------------------------------------------

/**
 * Deterministic random source with Flash `random(n)` semantics: an integer in
 * [0, n). The bonus roll uses `random(1000)` (evidence/A2-bonus.md §2).
 */
export interface RandomSource {
  randomInt(range: number): number;
}

/**
 * Seeded RNG for the bonus roll. The seed is `data/constants.json`
 * `bonusLetter.seed` (2012) — amendment 2026-09-28b (docs/02 §8): a
 * deterministic-test implementation value, not a reference constant; the O02
 * distribution semantics are unchanged.
 *
 * Algorithm: mulberry32 (32-bit state, public-domain). The constants below are
 * algorithm internals of this deterministic test RNG, not game values.
 * // evidence: docs/02-mechanics-spec.md §8 amendment 2026-09-28b;
 * // data/constants.schema.json `bonusLetter.seed`; algorithm + golden stream
 * // recorded in evidence/D1-round.md §2.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    randomInt(range: number): number {
      if (!Number.isFinite(range) || range <= 0) {
        throw new RangeError(`randomInt(range): range must be > 0, got ${range}`);
      }
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const ratio = ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
      return Math.floor(ratio * range);
    },
  };
}

/** Reference `bonusrange = 1000` (init(), evidence/A2-bonus.md §2). */
// evidence: evidence/A2-bonus.md §2 (init: bonusrange = 1000);
// data/constants.json bonusLetter.selectionRule ("random(bonusrange=1000)").
const BONUS_RANGE = 1000;

/** Reference `bonusmin = 50` — the roll is lucky below this cut (5 %). */
// evidence: evidence/A2-bonus.md §2 (init: bonusmin = 50);
// data/constants.json bonusLetter.selectionRule ("bonusmin=50").
const BONUS_MIN = 50;

/**
 * Per-round reference `bonusball` state (O02). One tracker per round; create it
 * with `createSeededRandom(constants.bonusLetter.seed)` at round start.
 *
 * Consuming the evidenced semantics:
 * - every accepted letter add → `addLetter(entryLengthAfterAdd)`;
 * - BACKSPACE (before the last letter is removed) → `removeLastLetter(entryLengthBeforeRemove)`;
 * - valid submit / scramble (entry clear) → score first, then
 *   `clearEntry(entryLengthBeforeClear)`; D3 adds `scoring.bonusPoints` while
 *   `hasPendingBonus` is true before the clear;
 * - round start (`init()`) → `reset()` (already the initial state).
 */
export interface BonusLetterTracker {
  /**
   * Reference `bonusball`: -1 = no pending bonus, otherwise the 0-based index
   * of the ball that receives the bright animation when it is added. Value N
   * can be beyond the current entry (the assignment `bonusball = kelime.length`
   * happens while adding, so the NEXT ball lights; when the roll hits on the
   * 8th letter, N = 8 and no bright ball is ever shown — submit still pays).
   */
  readonly ball: number;
  /** True while `ball > -1` (the next valid submit pays the bonus). */
  readonly hasPendingBonus: boolean;
  /**
   * Reference add path (keyboard `onKeyDown`, tile `on(release)`): call AFTER
   * the letter was appended; `entryLengthAfterAdd` is the entry length
   * including the new letter. Rolls only while no bonus is pending.
   */
  addLetter(entryLengthAfterAdd: number): void;
  /**
   * Reference `duzenle("sil")`: call BEFORE the last letter is removed;
   * `entryLengthBeforeRemove` is the entry length at that moment. Resets when
   * the ball being removed is the pending bright ball.
   */
  removeLastLetter(entryLengthBeforeRemove: number): void;
  /**
   * Reference `duzenle("temizle")`: call when the entry is cleared (valid
   * submit, scramble). Resets only for a non-empty entry (`kelime.length > 0`);
   * clearing an empty entry leaves a pending bonus untouched (O02 quirk).
   */
  clearEntry(entryLengthBeforeClear: number): void;
  /** Reference `init()`: `bonusball = -1` (round start). */
  reset(): void;
}

/** Create the per-round O02 bonus tracker driven by `random`. */
export function createBonusLetterTracker(random: RandomSource): BonusLetterTracker {
  let ball = -1;
  return {
    get ball(): number {
      return ball;
    },
    get hasPendingBonus(): boolean {
      return ball > -1;
    },
    addLetter(entryLengthAfterAdd: number): void {
      if (ball !== -1) return;
      const roll = random.randomInt(BONUS_RANGE);
      if (roll < BONUS_MIN) {
        ball = entryLengthAfterAdd;
      }
    },
    removeLastLetter(entryLengthBeforeRemove: number): void {
      // evidence: evidence/A2-bonus.md §2 — duzenle("sil") checks `t > 0` and
      // the ball being removed (`kelime.length - 1` before removal).
      if (entryLengthBeforeRemove > 0 && ball === entryLengthBeforeRemove - 1) {
        ball = -1;
      }
    },
    clearEntry(entryLengthBeforeClear: number): void {
      // evidence: evidence/A2-bonus.md §2 — duzenle("temizle") resets only when
      // `kelime.length > 0`; an empty-entry clear is a no-op (quirk b).
      if (entryLengthBeforeClear > 0) {
        ball = -1;
      }
    },
    reset(): void {
      ball = -1;
    },
  };
}
