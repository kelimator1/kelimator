// tests/input.test.ts — task D2: tiles + input modules.
//
// V4: every O15 edge rule is exercised and annotated with its rule ID
// (evidence/A2-edges.md §2(a)–(g)).
// V7: the action-key names in src/game/input.ts equal data/constants.json
// `input` exactly (asserted; the module itself never reads the data file).
// V2: shuffle is a permutation (multiset equality) and deterministic for the
// recorded seed 2012 (golden permutation recorded in evidence/D2-input.md §4).
// Y7: the produced character (`event.key`) wins for letters over the numeric
// keyCode table (measured dotted/dotless conflict; evidence/Y7-i-key.md §2);
// action keys keep the keyCode → key → code priority per D2.
//
// Spec: docs/05-game-core.md §1/§3; docs/02-mechanics-spec.md §2;
// data/constants.json input (O04); evidence/A2-input.md §2 (numeric key table,
// Turkish letters, visible-tile gate); evidence/A2-edges.md §2 (O15 rules).

import { describe, expect, it } from 'vitest';
import constants from '../data/constants.json';
import {
  ACTION_KEY_NAMES,
  LETTER_KEY_CODES,
  createInputController,
  resolveKey,
  type InputEvent,
} from '../src/game/input';
import {
  DECK_SIZE,
  createDeck,
  shuffleOrder,
  type Deck,
  type DeckSnapshot,
} from '../src/game/tiles';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** docs/02 §2 example: FİNALİZM carries two İ (duplicate-letter round). */
const FINALIZM: readonly string[] = [...'FİNALİZM'];

/** O04 table, transcribed independently from evidence/A2-input.md §2. */
const O04_TABLE: readonly (readonly [number, string])[] = [
  [65, 'A'],
  [66, 'B'],
  [67, 'C'],
  [220, 'Ç'],
  [68, 'D'],
  [69, 'E'],
  [70, 'F'],
  [71, 'G'],
  [219, 'Ğ'],
  [72, 'H'],
  [73, 'I'],
  [222, 'İ'],
  [74, 'J'],
  [75, 'K'],
  [76, 'L'],
  [77, 'M'],
  [78, 'N'],
  [79, 'O'],
  [191, 'Ö'],
  [80, 'P'],
  [82, 'R'],
  [83, 'S'],
  [186, 'Ş'],
  [84, 'T'],
  [85, 'U'],
  [221, 'Ü'],
  [86, 'V'],
  [89, 'Y'],
  [90, 'Z'],
];

/** Recorded test seed (same deterministic-test value as constants `bonusLetter.seed`). */
const RECORDED_SEED = 2012;
/** Golden permutation for RECORDED_SEED over 8 slots (evidence/D2-input.md §4). */
const RECORDED_ORDER: readonly number[] = [3, 4, 1, 6, 5, 7, 2, 0];

function deckRecorder(): { deck: Deck; snapshots: DeckSnapshot[] } {
  const snapshots: DeckSnapshot[] = [];
  const deck = createDeck(FINALIZM, {
    onDeckChanged: (snapshot) => snapshots.push(snapshot),
  });
  return { deck, snapshots };
}

function controllerWith(deck: Deck): {
  controller: ReturnType<typeof createInputController>;
  events: InputEvent[];
} {
  const events: InputEvent[] = [];
  const controller = createInputController({
    deck,
    onEvent: (event) => events.push(event),
  });
  return { controller, events };
}

function letterCounts(letters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) ?? 0) + 1);
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
// V7 — key names vs data/constants.json
// ---------------------------------------------------------------------------

describe('V7 — action key names vs data/constants.json', () => {
  it('ACTION_KEY_NAMES matches constants.input exactly', () => {
    expect(ACTION_KEY_NAMES.scramble).toBe(constants.input.scrambleKey);
    expect(ACTION_KEY_NAMES.submit).toBe(constants.input.submitKey);
    expect(ACTION_KEY_NAMES.delete).toBe(constants.input.deleteKey);
  });

  it('the three action keys resolve to the exact constants names', () => {
    expect(resolveKey({ keyCode: 32 })).toEqual({
      kind: 'action',
      action: constants.input.scrambleKey,
    });
    expect(resolveKey({ keyCode: 13 })).toEqual({
      kind: 'action',
      action: constants.input.submitKey,
    });
    expect(resolveKey({ keyCode: 8 })).toEqual({
      kind: 'action',
      action: constants.input.deleteKey,
    });
    expect(resolveKey({ key: ' ' })).toEqual({ kind: 'action', action: constants.input.scrambleKey });
    expect(resolveKey({ code: 'Enter' })).toEqual({
      kind: 'action',
      action: constants.input.submitKey,
    });
    expect(resolveKey({ code: 'Backspace' })).toEqual({
      kind: 'action',
      action: constants.input.deleteKey,
    });
  });
});

// ---------------------------------------------------------------------------
// O04 — numeric key table, Turkish letters, browser fallbacks
// ---------------------------------------------------------------------------

describe('O04 — key mapping (evidence/A2-input.md §2)', () => {
  it('LETTER_KEY_CODES equals the 29 evidenced (code, letter) pairs', () => {
    expect(LETTER_KEY_CODES).toEqual(O04_TABLE);
  });

  it('every evidenced numeric code resolves to its letter', () => {
    for (const [code, letter] of O04_TABLE) {
      expect(resolveKey({ keyCode: code })).toEqual({ kind: 'letter', letter });
    }
  });

  it('Turkish letters use their evidenced Flash codes', () => {
    expect(resolveKey({ keyCode: 220 })).toEqual({ kind: 'letter', letter: 'Ç' });
    expect(resolveKey({ keyCode: 219 })).toEqual({ kind: 'letter', letter: 'Ğ' });
    expect(resolveKey({ keyCode: 222 })).toEqual({ kind: 'letter', letter: 'İ' });
    expect(resolveKey({ keyCode: 191 })).toEqual({ kind: 'letter', letter: 'Ö' });
    expect(resolveKey({ keyCode: 186 })).toEqual({ kind: 'letter', letter: 'Ş' });
    expect(resolveKey({ keyCode: 221 })).toEqual({ kind: 'letter', letter: 'Ü' });
  });

  it('codes absent from the O04 table resolve to none (Q/W/X, digits, CTRL…)', () => {
    for (const code of [81, 87, 88, 48, 37, 39, 17, 16, 18, 9, 27]) {
      expect(resolveKey({ keyCode: code })).toEqual({ kind: 'none' });
    }
  });

  it('key fallback uppercases with the Turkish locale (i→İ, ı→I)', () => {
    expect(resolveKey({ key: 'a' })).toEqual({ kind: 'letter', letter: 'A' });
    expect(resolveKey({ key: 'i' })).toEqual({ kind: 'letter', letter: 'İ' });
    expect(resolveKey({ key: 'ı' })).toEqual({ kind: 'letter', letter: 'I' });
    expect(resolveKey({ key: 'ç' })).toEqual({ kind: 'letter', letter: 'Ç' });
    expect(resolveKey({ key: 'ğ' })).toEqual({ kind: 'letter', letter: 'Ğ' });
    expect(resolveKey({ key: 'ö' })).toEqual({ kind: 'letter', letter: 'Ö' });
    expect(resolveKey({ key: 'ş' })).toEqual({ kind: 'letter', letter: 'Ş' });
    expect(resolveKey({ key: 'ü' })).toEqual({ kind: 'letter', letter: 'Ü' });
    expect(resolveKey({ key: 'İ' })).toEqual({ kind: 'letter', letter: 'İ' });
    expect(resolveKey({ key: 'I' })).toEqual({ kind: 'letter', letter: 'I' });
    expect(resolveKey({ key: 'q' })).toEqual({ kind: 'none' });
    expect(resolveKey({ key: '1' })).toEqual({ kind: 'none' });
    expect(resolveKey({ key: 'Dead' })).toEqual({ kind: 'none' });
    expect(resolveKey({ key: '' })).toEqual({ kind: 'none' });
  });

  it('Y7 conflict: a produced i/ı beats the layout-derived keyCode (measured)', () => {
    // evidence/Y7-i-key.md §2 — on the measured Mac (layout Turkish-QWERTY-PC)
    // the browser reports keyCode 73 for a produced 'i' and keyCode 222 for
    // 'ı'; the produced character must win on every layout. The keyCode-only
    // rows above stay the fallback for synthetic/legacy events.
    expect(resolveKey({ keyCode: 73, key: 'i' })).toEqual({ kind: 'letter', letter: 'İ' });
    expect(resolveKey({ keyCode: 222, key: 'ı' })).toEqual({ kind: 'letter', letter: 'I' });
  });

  it('code fallback maps physical Key[A-Z] positions (KeyI → I on Turkish-Q)', () => {
    expect(resolveKey({ code: 'KeyA' })).toEqual({ kind: 'letter', letter: 'A' });
    expect(resolveKey({ code: 'KeyI' })).toEqual({ kind: 'letter', letter: 'I' });
    expect(resolveKey({ code: 'KeyZ' })).toEqual({ kind: 'letter', letter: 'Z' });
    expect(resolveKey({ code: 'KeyQ' })).toEqual({ kind: 'none' });
    expect(resolveKey({ code: 'Semicolon' })).toEqual({ kind: 'none' });
    expect(resolveKey({ code: 'Digit1' })).toEqual({ kind: 'none' });
  });

  it('letters: key wins over keyCode/code; a keyCode letter is the fallback', () => {
    expect(resolveKey({ keyCode: 65, key: 'b', code: 'KeyB' })).toEqual({
      kind: 'letter',
      letter: 'B',
    });
    expect(resolveKey({ keyCode: 222, key: 'a', code: 'KeyA' })).toEqual({
      kind: 'letter',
      letter: 'A',
    });
    expect(resolveKey({ keyCode: 73, code: 'KeyB' })).toEqual({ kind: 'letter', letter: 'I' });
    expect(resolveKey({ keyCode: 0, key: 'b', code: 'KeyB' })).toEqual({
      kind: 'letter',
      letter: 'B',
    });
    expect(resolveKey({ keyCode: 0, code: 'KeyB' })).toEqual({ kind: 'letter', letter: 'B' });
    expect(resolveKey({})).toEqual({ kind: 'none' });
    expect(resolveKey({ key: 'Enter' })).toEqual({ kind: 'action', action: 'ENTER' });
    expect(resolveKey({ key: 'Backspace' })).toEqual({ kind: 'action', action: 'BACKSPACE' });
    expect(resolveKey({ code: 'Space' })).toEqual({ kind: 'action', action: 'SPACE' });
  });
});

// ---------------------------------------------------------------------------
// tiles — instances, availability accounting, deckChanged
// ---------------------------------------------------------------------------

describe('tiles — deck of 8 instances (docs/05 §1)', () => {
  it('keeps main-word order and duplicate letters as separate instances', () => {
    const { deck } = deckRecorder();
    expect(deck.size).toBe(DECK_SIZE);
    expect(deck.tiles().map((tile) => tile.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(deck.tiles().map((tile) => tile.letter)).toEqual(FINALIZM);
    expect(deck.order()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(deck.availableCount('İ')).toBe(2);
    expect(deck.isAvailable(1)).toBe(true);
    expect(deck.isAvailable(99)).toBe(false);
    expect(deck.containsLetter('Ş')).toBe(false);
  });

  it('rejects letter lists that are not exactly 8 long', () => {
    expect(() => createDeck(['A', 'B'])).toThrow(RangeError);
    expect(() => createDeck([...FINALIZM, 'A'])).toThrow(RangeError);
  });

  it('consume() takes the first available instance in button order', () => {
    const { deck } = deckRecorder();
    expect(deck.consume('İ')).toBe(1);
    expect(deck.consume('İ')).toBe(5);
    expect(deck.availableCount('İ')).toBe(0);
    expect(deck.consume('İ')).toBeNull();
    expect(deck.containsLetter('İ')).toBe(true);
    expect(deck.consume('Ş')).toBeNull();
  });

  it('restoreLastHidden() restores the first hidden instance (reference sil())', () => {
    const { deck } = deckRecorder();
    deck.consume('İ');
    deck.consume('İ');
    expect(deck.restoreLastHidden('İ')).toBe(1);
    expect(deck.restoreLastHidden('İ')).toBe(5);
    expect(deck.restoreLastHidden('İ')).toBeNull();
    expect(deck.availableCount('İ')).toBe(2);
  });

  it('consumeTile() consumes a specific instance; restoreAll() brings all back', () => {
    const { deck } = deckRecorder();
    expect(deck.consumeTile(5)).toBe(true);
    expect(deck.consumeTile(5)).toBe(false);
    expect(deck.isAvailable(5)).toBe(false);
    deck.consume('F');
    expect(deck.restoreAll()).toBe(2);
    expect(deck.restoreAll()).toBe(0);
    expect(deck.tiles().every((tile) => deck.isAvailable(tile.id))).toBe(true);
  });

  it('emits deckChanged snapshots only for actual changes', () => {
    const { deck, snapshots } = deckRecorder();
    expect(snapshots).toHaveLength(0);
    deck.consume('F');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.available[0]).toBe(false);
    deck.consume('Ş'); // no instance carries Ş
    expect(snapshots).toHaveLength(1);
    deck.restoreLastHidden('F');
    expect(snapshots).toHaveLength(2);
    deck.restoreAll(); // already all visible
    expect(snapshots).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// V2 — shuffle is a permutation and deterministic for the recorded seed
// ---------------------------------------------------------------------------

describe('V2 — shuffle permutation + determinism (recorded seed 2012)', () => {
  it('shuffleOrder(8, 2012) equals the recorded golden permutation', () => {
    expect(shuffleOrder(DECK_SIZE, RECORDED_SEED)).toEqual(RECORDED_ORDER);
  });

  it('same seed → same permutation across calls (determinism)', () => {
    expect(shuffleOrder(DECK_SIZE, RECORDED_SEED)).toEqual(RECORDED_ORDER);
    expect(shuffleOrder(DECK_SIZE, RECORDED_SEED)).toEqual(RECORDED_ORDER);
    expect(shuffleOrder(DECK_SIZE, 7)).toEqual([0, 1, 7, 5, 4, 3, 2, 6]);
  });

  it('multiset equality: every index 0..7 appears exactly once', () => {
    for (const seed of [0, 1, 7, 2012, 99999]) {
      const order = shuffleOrder(DECK_SIZE, seed);
      expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(new Set(order).size).toBe(DECK_SIZE);
    }
  });

  it('deck.shuffle(seed) applies the permutation and preserves the letter multiset', () => {
    const { deck, snapshots } = deckRecorder();
    expect(deck.shuffle(RECORDED_SEED)).toEqual(RECORDED_ORDER);
    expect(deck.order()).toEqual(RECORDED_ORDER);
    expect(snapshots).toHaveLength(1);
    const lettersInOrder: string[] = [];
    for (const id of deck.order()) {
      const letter = deck.letterOf(id);
      if (letter !== undefined) lettersInOrder.push(letter);
    }
    expect(lettersInOrder).toHaveLength(DECK_SIZE);
    expect(sameCounts(letterCounts(lettersInOrder), letterCounts(FINALIZM))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// O15 — edge rules through the input controller
// ---------------------------------------------------------------------------

describe('O15 — edge rules (evidence/A2-edges.md §2)', () => {
  it('O15(a) duplicate-letter words consume one tile instance each; none left ⇒ no-op', () => {
    const { deck, snapshots } = deckRecorder();
    const { controller, events } = controllerWith(deck);

    expect(controller.handleKey({ keyCode: 222 })).toMatchObject({
      type: 'letter',
      letter: 'İ',
      tileId: 1,
      source: 'key',
      entryLengthAfter: 1,
    });
    expect(controller.handleKey({ keyCode: 222 })).toMatchObject({
      type: 'letter',
      letter: 'İ',
      tileId: 5,
      entryLengthAfter: 2,
    });
    expect(controller.entry).toBe('İİ');
    expect(deck.availableCount('İ')).toBe(0);

    const snapshotsBefore = snapshots.length;
    expect(controller.handleKey({ keyCode: 222 })).toEqual({
      type: 'rejected',
      reason: 'no-available-tile',
    });
    expect(controller.entry).toBe('İİ');
    expect(snapshots.length).toBe(snapshotsBefore); // consumed already ⇒ no typer event
    expect(events[events.length - 1]).toEqual({
      type: 'rejected',
      reason: 'no-available-tile',
    });

    // Deletion restores one matching instance each (reference sil()).
    expect(controller.handleKey({ keyCode: 8 })).toMatchObject({
      type: 'delete',
      entryWasEmpty: false,
      letter: 'İ',
      tileId: 1,
    });
    expect(controller.entry).toBe('İ');
    expect(controller.handleKey({ keyCode: 8 })).toMatchObject({
      type: 'delete',
      entryWasEmpty: false,
      letter: 'İ',
      tileId: 5,
    });
    expect(controller.entry).toBe('');
    expect(deck.availableCount('İ')).toBe(2);
  });

  it('O15(a) pointer clicks append the clicked instance letter', () => {
    const { deck } = deckRecorder();
    const { controller } = controllerWith(deck);

    expect(controller.handleTileClick(5)).toMatchObject({
      type: 'letter',
      letter: 'İ',
      tileId: 5,
      source: 'click',
      entryLengthAfter: 1,
    });
    expect(controller.handleTileClick(5)).toEqual({
      type: 'rejected',
      reason: 'tile-unavailable',
    });
    expect(controller.handleTileClick(0)).toMatchObject({
      type: 'letter',
      letter: 'F',
      tileId: 0,
      source: 'click',
      entryLengthAfter: 2,
    });
    expect(controller.handleTileClick(8)).toEqual({ type: 'rejected', reason: 'invalid-tile' });
    expect(controller.entry).toBe('İF');
  });

  it('O15(b) re-submitting a found word keeps the entry; only a valid new word clears it', () => {
    const { deck } = deckRecorder();
    const { controller, events } = controllerWith(deck);

    for (const keyCode of [70, 222, 78]) controller.handleKey({ keyCode }); // F İ N
    expect(controller.entry).toBe('FİN');

    // D3 rejects a found word (boing); the reference keeps the entry, so the
    // controller must not clear it on submit.
    expect(controller.handleKey({ keyCode: 13 })).toEqual({ type: 'submit', entry: 'FİN' });
    expect(controller.handleKey({ keyCode: 13 })).toEqual({ type: 'submit', entry: 'FİN' });
    expect(controller.entry).toBe('FİN');
    expect(events.filter((event) => event.type === 'submit')).toHaveLength(2);

    // Successful new word: D3/D5 call clearEntry() (all tiles visible again).
    controller.clearEntry();
    expect(controller.entry).toBe('');
    expect(deck.availableCount('F')).toBe(1);
    expect(deck.availableCount('İ')).toBe(2);
    expect(deck.availableCount('N')).toBe(1);
  });

  it('O15(c) BACKSPACE on an empty entry is sound only', () => {
    const { deck, snapshots } = deckRecorder();
    const { controller } = controllerWith(deck);

    const snapshotsBefore = snapshots.length;
    expect(controller.handleKey({ keyCode: 8 })).toEqual({
      type: 'delete',
      entryWasEmpty: true,
      letter: null,
      tileId: null,
      entryLengthBefore: 0,
    });
    expect(controller.entry).toBe('');
    expect(snapshots.length).toBe(snapshotsBefore);

    // Also after deleting the last letter: the next BACKSPACE is empty again.
    controller.handleKey({ keyCode: 70 }); // F
    expect(controller.handleKey({ keyCode: 8 })).toMatchObject({ entryWasEmpty: false });
    expect(controller.handleKey({ keyCode: 8 })).toMatchObject({ entryWasEmpty: true });
    expect(controller.entry).toBe('');
  });

  it('O15(d) scramble clears a partial entry and returns every tile', () => {
    const { deck, snapshots } = deckRecorder();
    const { controller } = controllerWith(deck);

    controller.handleKey({ keyCode: 70 }); // F → instance 0
    controller.handleKey({ keyCode: 222 }); // İ → instance 1
    expect(controller.entry).toBe('Fİ');

    expect(controller.handleKey({ keyCode: 32 })).toEqual({
      type: 'scramble',
      hadEntry: true,
      entryLengthBefore: 2,
    });
    expect(controller.entry).toBe('');
    expect(deck.availableCount('F')).toBe(1);
    expect(deck.availableCount('İ')).toBe(2);

    // Empty entry: hadEntry = false, no tile restore (the O02 empty-entry
    // quirk stays with D1's tracker; evidence/A2-edges.md §2(d)).
    const snapshotsBefore = snapshots.length;
    expect(controller.handleKey({ keyCode: 32 })).toEqual({
      type: 'scramble',
      hadEntry: false,
      entryLengthBefore: 0,
    });
    expect(controller.entry).toBe('');
    expect(snapshots.length).toBe(snapshotsBefore);
  });

  it('O15(e) keys for letters not in the deck are no-ops (no typer sound)', () => {
    const { deck, snapshots } = deckRecorder();
    const { controller } = controllerWith(deck);

    const snapshotsBefore = snapshots.length;
    // Ş is evidenced (code 186) but FİNALİZM has no Ş.
    expect(controller.handleKey({ keyCode: 186 })).toEqual({
      type: 'rejected',
      reason: 'letter-not-in-deck',
    });
    // Q/W/X are not in the O04 alphabet at all → unknown key.
    expect(controller.handleKey({ keyCode: 81 })).toEqual({
      type: 'rejected',
      reason: 'unknown-key',
    });
    expect(controller.handleKey({ key: 'q' })).toEqual({
      type: 'rejected',
      reason: 'unknown-key',
    });
    expect(controller.entry).toBe('');
    expect(snapshots.length).toBe(snapshotsBefore);
  });

  it('O15(f) ENTER with an empty entry is emitted (invalid-word buzz path)', () => {
    const { deck } = deckRecorder();
    const { controller } = controllerWith(deck);
    expect(controller.handleKey({ keyCode: 13 })).toEqual({ type: 'submit', entry: '' });
    expect(controller.entry).toBe('');
  });

  it('O15(g) the reference CTRL extra behavior is not implemented', () => {
    expect(resolveKey({ keyCode: 17 })).toEqual({ kind: 'none' });
    expect(resolveKey({ key: 'Control', code: 'ControlLeft' })).toEqual({ kind: 'none' });

    const { deck } = deckRecorder();
    const { controller } = controllerWith(deck);
    expect(controller.handleKey({ keyCode: 17, key: 'Control', code: 'ControlLeft' })).toEqual({
      type: 'rejected',
      reason: 'unknown-key',
    });
    expect(controller.entry).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Gating + bonus-length reporting (O04 `bitti`, O02 hand-off values)
// ---------------------------------------------------------------------------

describe('input gating and O02 length reporting', () => {
  it('locked (bitti) blocks keys and clicks without mutations', () => {
    const { deck, snapshots } = deckRecorder();
    const { controller } = controllerWith(deck);

    controller.setLocked(true);
    expect(controller.locked).toBe(true);
    expect(controller.handleKey({ keyCode: 65 })).toEqual({ type: 'rejected', reason: 'locked' });
    expect(controller.handleTileClick(0)).toEqual({ type: 'rejected', reason: 'locked' });
    expect(controller.entry).toBe('');
    expect(snapshots).toHaveLength(0);

    controller.setLocked(false);
    expect(controller.handleKey({ keyCode: 65 })).toMatchObject({
      type: 'letter',
      letter: 'A',
      tileId: 3,
    });
  });

  it('reports entry lengths for D1’s O02 tracker', () => {
    const { deck } = deckRecorder();
    const { controller } = controllerWith(deck);

    expect(controller.handleKey({ keyCode: 70 })).toMatchObject({
      type: 'letter',
      entryLengthAfter: 1,
    });
    expect(controller.handleKey({ keyCode: 8 })).toMatchObject({
      type: 'delete',
      entryLengthBefore: 1,
      entryWasEmpty: false,
    });
    expect(controller.handleKey({ keyCode: 78 })).toMatchObject({
      type: 'letter',
      entryLengthAfter: 1,
    });
    expect(controller.handleKey({ keyCode: 32 })).toMatchObject({
      type: 'scramble',
      entryLengthBefore: 1,
      hadEntry: true,
    });
  });
});
