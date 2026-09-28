// src/game/scoring.ts — scoring engine (docs/04-architecture.md §4;
// docs/05-game-core.md §4; docs/02-mechanics-spec.md §3).
//
// Confirmed formulas (docs/02 §3, [CONFIRMED: 2004 official page]):
//   valid word : letterCount² × perLetterSquaredFactor
//   bonus word : the same, plus bonusPoints once, while the O02 bonus is
//                pending (`bonusball > -1`)
//   time bonus : remaining integer seconds × timeFactor (all-found completion
//                only; the timeout path adds no time bonus — O14)
//
// Constants arrive from data/constants.json via the caller (docs/05 §1:
// modules never read the JSON directly; the app loads it once at bootstrap and
// passes typed values). All arithmetic is integer arithmetic (docs/05 §4).
//
// Bonus condition (O02): the reference scores
//   `if(bonusball > -1) { ... + 5000 }` — the bright ball is inside the
// submitted entry exactly while `bonusball > -1`, and a submit immediately
// after a lucky roll on the last added letter still pays although no bright
// ball was shown yet (recorded quirk (a), evidence/A2-bonus.md §3). The single
// RNG owner is D1's `BonusLetterTracker` (round.ts); callers pass
// `tracker.ball` here — this module never rolls and never touches the RNG.
// evidence: evidence/A2-bonus.md §2–§3; docs/02-mechanics-spec.md §3 (O02).

/** The `scoring` block of data/constants.json, supplied by the caller. */
export interface ScoringConstants {
  /** `scoring.perLetterSquaredFactor` — the 2004 formula factor. */
  readonly perLetterSquaredFactor: number;
  /** `scoring.bonusPoints` — one-time bonus when the bonus applies. */
  readonly bonusPoints: number;
  /** `scoring.timeFactor` — points per remaining second at completion. */
  readonly timeFactor: number;
}

/**
 * Structural integer zero: additive identity and the lower bound of the
 * non-negative inputs. Not a game value — every game value arrives through
 * `ScoringConstants` from data/constants.json.
 */
// evidence: structural literal — no mechanics meaning; game values are passed in.
const ZERO = 0;

/**
 * Reference `bonusball` sentinel meaning "no bonus is pending" (`init()` sets
 * `bonusball = -1` at round start; O02).
 */
// evidence: evidence/A2-bonus.md §2 — init(): bonusball = -1.
export const NO_BONUS_BALL = -1;

/** Integer breakdown of one accepted word (all fields are integers). */
export interface WordScore {
  /** Number of letters of the accepted word (code points). */
  readonly letterCount: number;
  /** `letterCount² × perLetterSquaredFactor`. */
  readonly basePoints: number;
  /** True while the O02 bonus applies (`bonusBall > -1`). */
  readonly bonusApplied: boolean;
  /** `bonusPoints` once when applied, otherwise zero. */
  readonly bonusPoints: number;
  /** `basePoints + bonusPoints`. */
  readonly totalPoints: number;
}

// Structural: input validation only — rejects values that can never come from
// the confirmed flow, so the integer-arithmetic guarantee (docs/05 §4) holds.
function assertIntegerAtLeast(value: number, label: string, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be an integer >= ${minimum}, got ${value}`);
  }
}

function assertScoringConstants(constants: ScoringConstants): void {
  assertIntegerAtLeast(constants.perLetterSquaredFactor, 'perLetterSquaredFactor', ZERO);
  assertIntegerAtLeast(constants.bonusPoints, 'bonusPoints', ZERO);
  assertIntegerAtLeast(constants.timeFactor, 'timeFactor', ZERO);
}

/**
 * Score one valid submitted word (reference `ekle()` valid-new-word branch).
 *
 * `entry` is the accepted word in display form; its letter count is the
 * reference `kelime.length` (code points). `bonusBall` is
 * `BonusLetterTracker.ball` (round.ts, O02): any value > -1 adds
 * `bonusPoints` exactly once, per the reference `if(bonusball > -1)` branch.
 * Invalid and already-found words are rejected by the caller (O15) and are
 * never scored here.
 */
export function scoreWord(
  entry: string,
  bonusBall: number,
  constants: ScoringConstants,
): WordScore {
  assertIntegerAtLeast(bonusBall, 'bonusBall', NO_BONUS_BALL);
  assertScoringConstants(constants);
  const letterCount = [...entry].length;
  const basePoints = letterCount * letterCount * constants.perLetterSquaredFactor;
  const bonusApplied = bonusBall > NO_BONUS_BALL;
  const bonusPoints = bonusApplied ? constants.bonusPoints : ZERO;
  return {
    letterCount,
    basePoints,
    bonusApplied,
    bonusPoints,
    totalPoints: basePoints + bonusPoints,
  };
}

/**
 * End-of-round time bonus: `remainingSeconds × timeFactor` (reference
 * `puan += timer * timebonus` in `bittimi()`). Applied once on the all-found
 * completion only, from the last displayed integer second; the timeout path
 * adds no time bonus (O14, evidence/A2-timeout.md §2–§3).
 */
export function scoreTimeBonus(remainingSeconds: number, constants: ScoringConstants): number {
  assertIntegerAtLeast(remainingSeconds, 'remainingSeconds', ZERO);
  assertScoringConstants(constants);
  return remainingSeconds * constants.timeFactor;
}
