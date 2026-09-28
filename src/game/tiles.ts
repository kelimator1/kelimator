// src/game/tiles.ts — deck of 8 letter-tile instances: availability states and
// the shuffle order operation (docs/05-game-core.md §1/§3; docs/02 §2;
// EXECUTION.md §5).
//
// Reference mapping (artifacts/decompiled/scripts/frame_131/DoAction.as):
// - `yerlestir()` creates `button0..button7`; `button<i>.word` is the i-th
//   character of the round's main word (duplicates possible) and `shuffle()`
//   runs immediately after creation.
// - Keyboard/click add scans `button0..7` in instance order for the first
//   `t.word == letter && t._visible` tile and consumes it (`_visible = false`)
//   — evidence/A2-input.md §2, evidence/A2-edges.md §2(a).
// - `sil()` restores the first hidden instance carrying the letter
//   (`t.word == j && !t._visible`) — evidence/A2-edges.md §2(c).
// - `karistir()` and a successful `ekle()` set every `_visible = true`
//   — evidence/A2-edges.md §2(b)/(d).
// - `shuffle()` assigns display slot j a deck index (`_X = 60 + t*60`); the
//   draw is a uniform pick among not-yet-placed deck indices (`deckN` /
//   `"empty"` acceptance loop) — evidence/A2-input.md §2.
//
// The seeded RNG is the project's single deterministic source: mulberry32 in
// src/game/round.ts `createSeededRandom` (amendment 2026-09-28b, docs/02 §8;
// golden stream in evidence/D1-round.md §4). `shuffleOrder` is pure: the same
// seed always reproduces the same permutation. Production seed handling is
// D5's hand-off (recorded in evidence/D2-input.md §6); this module only takes
// the seed.

import { createSeededRandom } from './round';

/** Number of tile instances per round. */
// evidence: docs/05-game-core.md §1 ("Deck of 8 tiles"); docs/02-mechanics-spec.md §2
// ("8 tiles per round"); frame_131/DoAction.as init() `harfsayisi = 8`.
export const DECK_SIZE = 8;

/** One tile instance (reference `button<i>`): stable id + its deck letter. */
export interface TileInstance {
  /** Instance index 0..DECK_SIZE-1 (`button<i>`); stable across shuffles. */
  readonly id: number;
  /** Uppercase display form, taken from the round's main word. */
  readonly letter: string;
}

/**
 * Tile state plus display order (the docs/05 §1 `deckChanged` / tile-state
 * output; `order[slot]` is the instance id shown in display slot `slot`).
 */
export interface DeckSnapshot {
  /** Instances in reference `button0..7` order. */
  readonly tiles: readonly TileInstance[];
  /** Per-instance availability (`true` = reference `_visible`), aligned with `tiles`. */
  readonly available: readonly boolean[];
  /** Display slot -> instance id (reference `shuffle<j> = deck<t>`). */
  readonly order: readonly number[];
}

/** Observer for the docs/05 §1 `deckChanged` output. */
export interface DeckOptions {
  /** Called after every availability/order change with a fresh snapshot. */
  readonly onDeckChanged?: (snapshot: DeckSnapshot) => void;
}

/**
 * A round's tile deck: fixed instances, per-instance availability, and the
 * display order produced by the shuffle operation.
 */
export interface Deck {
  /** Number of instances (DECK_SIZE). */
  readonly size: number;
  /** Instances in reference `button0..7` order. */
  tiles(): readonly TileInstance[];
  /** Current display order (`order[slot]` = instance id). */
  order(): readonly number[];
  /** Letter of instance `id`, or undefined for an out-of-range id. */
  letterOf(id: number): string | undefined;
  /** Reference `_visible` of instance `id`; false for out-of-range ids. */
  isAvailable(id: number): boolean;
  /** True when any instance (available or not) carries `letter`. */
  containsLetter(letter: string): boolean;
  /** Number of still-available instances carrying `letter` (duplicates counted). */
  availableCount(letter: string): number;
  /**
   * Reference keyboard add path: consume the first available instance carrying
   * `letter` in instance order; returns its id or null when none is available
   * (no-op, evidence/A2-edges.md §2(a)).
   */
  consume(letter: string): number | null;
  /**
   * Reference tile-click add path: consume the specific instance `id`;
   * returns false when the id is out of range or already consumed.
   */
  consumeTile(id: number): boolean;
  /**
   * Reference `sil()`: restore the first hidden instance carrying `letter` in
   * instance order; returns its id or null when no hidden instance matches
   * (evidence/A2-edges.md §2(c)).
   */
  restoreLastHidden(letter: string): number | null;
  /**
   * Reference `karistir()` / successful `ekle()`: make every tile visible
   * again. Returns how many instances were restored.
   */
  restoreAll(): number;
  /**
   * Shuffle the display order: `order[slot]` becomes the instance id in that
   * slot (reference `shuffle()`). Deterministic for a given seed; returns the
   * new order.
   */
  shuffle(seed: number): readonly number[];
  /** Fresh snapshot of the current deck state. */
  snapshot(): DeckSnapshot;
}

/**
 * Pure permutation of 0..count-1 for `seed`: `order[slot]` is the deck index
 * shown in display slot `slot` (reference `shuffle<j> = deck<t>`,
 * `_X = 60 + t*60`). One seeded draw per slot picks uniformly among the
 * not-yet-placed indices — the reference's `deckN` / `"empty"` acceptance loop
 * (evidence/A2-input.md §2; recorded seed/algorithm/golden: evidence/D2-input.md
 * §4). Deterministic: the same seed always yields the same permutation.
 */
export function shuffleOrder(count: number, seed: number): readonly number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`shuffleOrder: count must be a positive integer, got ${count}`);
  }
  const random = createSeededRandom(seed);
  const remaining = Array.from({ length: count }, (_, index) => index);
  const order: number[] = [];
  while (remaining.length > 0) {
    const pick = random.randomInt(remaining.length);
    const chosen = remaining[pick];
    if (chosen === undefined) {
      throw new Error(`shuffleOrder: pick ${pick} out of range for ${remaining.length} remaining`);
    }
    remaining.splice(pick, 1);
    order.push(chosen);
  }
  return order;
}

/**
 * Create a round deck from the round's letters (main-word order, duplicates
 * allowed). Throws RangeError unless exactly DECK_SIZE letters are given
 * (docs/05 §1; the frozen round schema guarantees 8, docs/05 §2).
 *
 * The display order starts as the identity; the reference calls `shuffle()`
 * right after `yerlestir()` creates the tiles, so callers start a round with
 * `deck.shuffle(seed)`.
 */
export function createDeck(letters: readonly string[], options: DeckOptions = {}): Deck {
  if (letters.length !== DECK_SIZE) {
    throw new RangeError(
      `createDeck: expected exactly ${DECK_SIZE} letters (docs/05 §1), got ${letters.length}`,
    );
  }
  const tiles: readonly TileInstance[] = letters.map((letter, index) =>
    Object.freeze({ id: index, letter }),
  );
  const available: boolean[] = Array.from({ length: DECK_SIZE }, () => true);
  let order: number[] = Array.from({ length: DECK_SIZE }, (_, index) => index);

  const snapshot = (): DeckSnapshot => ({
    tiles,
    available: [...available],
    order: [...order],
  });
  const notify = (): void => {
    options.onDeckChanged?.(snapshot());
  };

  const letterOf = (id: number): string | undefined => tiles[id]?.letter;
  const isAvailable = (id: number): boolean => available[id] === true;

  return {
    get size(): number {
      return DECK_SIZE;
    },
    tiles(): readonly TileInstance[] {
      return tiles;
    },
    order(): readonly number[] {
      return order;
    },
    letterOf,
    isAvailable,
    containsLetter(letter: string): boolean {
      return tiles.some((tile) => tile.letter === letter);
    },
    availableCount(letter: string): number {
      let count = 0;
      for (const tile of tiles) {
        if (tile.letter === letter && available[tile.id] === true) {
          count += 1;
        }
      }
      return count;
    },
    consume(letter: string): number | null {
      for (const tile of tiles) {
        if (tile.letter === letter && available[tile.id] === true) {
          available[tile.id] = false;
          notify();
          return tile.id;
        }
      }
      return null;
    },
    consumeTile(id: number): boolean {
      if (available[id] !== true) {
        return false;
      }
      available[id] = false;
      notify();
      return true;
    },
    restoreLastHidden(letter: string): number | null {
      for (const tile of tiles) {
        if (tile.letter === letter && available[tile.id] === false) {
          available[tile.id] = true;
          notify();
          return tile.id;
        }
      }
      return null;
    },
    restoreAll(): number {
      let restored = 0;
      for (const tile of tiles) {
        if (available[tile.id] === false) {
          available[tile.id] = true;
          restored += 1;
        }
      }
      if (restored > 0) {
        notify();
      }
      return restored;
    },
    shuffle(seed: number): readonly number[] {
      order = [...shuffleOrder(DECK_SIZE, seed)];
      notify();
      return order;
    },
    snapshot,
  };
}
