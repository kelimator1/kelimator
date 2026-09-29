// src/game/input.ts — keyboard + pointer handling and the word-entry buffer
// (docs/05-game-core.md §1/§3; docs/02 §2; EXECUTION.md §5).
//
// Evidenced behavior (evidence/A2-input.md §2–§3, O04):
// - The 2012 client never matches characters: `myListener.onKeyDown` compares
//   `Key.getCode()` (Flash/Windows numeric key codes) against its 29-entry
//   `codes` table, positionally mapped to the Turkish uppercase `harf` table.
// - A letter is appended only while a visible deck tile carries it
//   (`t.word == h && t._visible`); otherwise the press is a no-op with no
//   typer sound. Keys outside the table (digits, punctuation, Q/W/X, arrows,
//   CTRL) fall through to `harf[29] = undefined` and do nothing.
// - SPACE = scramble (`karistir`), ENTER = submit (`ekle`), BACKSPACE = delete
//   last (`sil`); all gated by `if(!bitti)` (round not over). The reference's
//   extra CTRL behavior (`songecerlikelime`, evidence/A2-edges.md §2(g)) is
//   deliberately not implemented.
//
// Browser mapping (recorded in evidence/D2-input.md §2): `KeyboardEvent.keyCode`
// is the primary source — it uses the same Windows virtual-key values as Flash;
// `event.key` (produced character, Turkish-locale uppercase) and `event.code`
// (physical `Key[A-Z]` positions) are fallbacks for environments without usable
// keyCode (for example synthetic events; `keyCode` may be present but unmapped).
// `event.key` alone cannot distinguish the layout's dotless/dotted pair, so the
// numeric table stays primary (O04).
//
// Edge rules (evidence/A2-edges.md §2, O15) are implemented here and annotated
// per rule; word validation / scoring / found-list behavior is D3/D5's.

import type { Deck } from './tiles';

// ---------------------------------------------------------------------------
// Key tables (O04)
// ---------------------------------------------------------------------------

/**
 * Action-key names exactly as stored in `data/constants.json` `input`
 * (`scrambleKey`/`submitKey`/`deleteKey`). This module never reads the data
 * file (docs/05 §1: constants are loaded once at bootstrap); the V7 test
 * (`npm test -- input`) asserts these three strings equal the data values.
 * evidence: data/constants.json input; evidence/A2-input.md §3.
 */
export const ACTION_KEY_NAMES = Object.freeze({
  scramble: 'SPACE',
  submit: 'ENTER',
  delete: 'BACKSPACE',
} as const);

/** Union of the action-key names above. */
export type ActionKeyName = (typeof ACTION_KEY_NAMES)[keyof typeof ACTION_KEY_NAMES];

/** Flash `Key.isDown` codes of the action keys. */
// evidence: evidence/A2-input.md §2 — `Key.isDown(32)` SPACE, `Key.isDown(8)`
// BACKSPACE, `Key.isDown(13)` ENTER (frame_131/DoAction.as onKeyDown).
const ACTION_KEY_CODES: ReadonlyMap<number, ActionKeyName> = new Map<
  number,
  ActionKeyName
>([
  [32, ACTION_KEY_NAMES.scramble],
  [8, ACTION_KEY_NAMES.delete],
  [13, ACTION_KEY_NAMES.submit],
]);

/**
 * O04 letter table: Flash/Windows key codes → Turkish uppercase letters,
 * verbatim from the reference `harf`/`codes` arrays (frame_131/DoAction.as
 * `init()`; evidence/A2-input.md §2). Q, W and X are intentionally absent.
 */
export const LETTER_KEY_CODES: readonly (readonly [number, string])[] = [
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

/** The 29 evidenced letters of the reference alphabet (LETTER_KEY_CODES). */
const LETTERS: ReadonlySet<string> = new Set(LETTER_KEY_CODES.map(([, letter]) => letter));

const LETTER_BY_KEY_CODE: ReadonlyMap<number, string> = new Map(LETTER_KEY_CODES);

/** Browser fallback: `event.key` value → action name. */
const ACTION_BY_KEY: ReadonlyMap<string, ActionKeyName> = new Map<string, ActionKeyName>([
  [' ', ACTION_KEY_NAMES.scramble],
  ['Enter', ACTION_KEY_NAMES.submit],
  ['Backspace', ACTION_KEY_NAMES.delete],
]);

/** Browser fallback: `event.code` value → action name. */
const ACTION_BY_CODE: ReadonlyMap<string, ActionKeyName> = new Map<string, ActionKeyName>([
  ['Space', ACTION_KEY_NAMES.scramble],
  ['Enter', ACTION_KEY_NAMES.submit],
  ['Backspace', ACTION_KEY_NAMES.delete],
]);

/** `event.code` physical letter positions: `KeyA`..`KeyZ` (US-layout names). */
const LETTER_CODE_PATTERN = /^Key([A-Z])$/;

/**
 * Turkish uppercase of a produced character. The `tr-TR` locale keeps the
 * evidenced dotted/dotless pair: `i` → `İ` (O04 code 222) and `ı` → `I` (O04
 * code 73) — evidence/A2-input.md §2.
 */
function turkishUpper(text: string): string {
  return text.toLocaleUpperCase('tr-TR');
}

/** Map a produced character (`event.key`) to its evidenced letter, if any. */
function letterFromKey(key: string): string | undefined {
  if ([...key].length !== 1) {
    return undefined;
  }
  const upper = turkishUpper(key);
  return LETTERS.has(upper) ? upper : undefined;
}

/**
 * Map a physical key (`event.code`) to its evidenced letter, if any.
 * `KeyA`..`KeyZ` sit at the same positions in the Turkish-Q and US layouts for
 * the ASCII alphabet, with `KeyI` producing the dotless `ı` on Turkish-Q
 * (uppercase `I`). The Turkish-specific letters live on remapped positions
 * (codes `Quote`, `Semicolon`, `BracketLeft`, …) and are resolved through
 * keyCode/`key` only, so no positional guess is made here; Q/W/X are not in
 * the evidenced alphabet and resolve to nothing (O04).
 */
function letterFromCode(code: string): string | undefined {
  const match = LETTER_CODE_PATTERN.exec(code);
  const letter = match?.[1];
  if (letter === undefined || !LETTERS.has(letter)) {
    return undefined;
  }
  return letter;
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/** The subset of a DOM `KeyboardEvent` the resolver reads. */
export interface KeyEventLike {
  /** Legacy numeric code (same values as Flash `Key.getCode()` when present). */
  readonly keyCode?: number | undefined;
  /** Produced character (`KeyboardEvent.key`), used as fallback. */
  readonly key?: string | undefined;
  /** Physical key (`KeyboardEvent.code`), used as the last fallback. */
  readonly code?: string | undefined;
}

/** Result of resolving a key event against the O04 tables. */
export type KeyResolution =
  | { readonly kind: 'action'; readonly action: ActionKeyName }
  | { readonly kind: 'letter'; readonly letter: string }
  | { readonly kind: 'none' };

/**
 * Resolve one key event. Action keys (SPACE/ENTER/BACKSPACE) keep the D2
 * priority: `keyCode` (the evidenced `Key.isDown` codes) → `key` → `code`.
 * Letters use the Y7 priority: `key` (produced character, Turkish uppercase,
 * accepted only within the 29-letter alphabet) → `keyCode` (the evidenced O04
 * table) → `code` (physical `Key[A-Z]`). A field that maps to nothing does not
 * block the fallbacks (covers `keyCode = 0` and layout-specific values).
 * evidence: evidence/D2-input.md §2 (2026-09-29 amendment), evidence/Y7-i-key.md.
 */
export function resolveKey(event: KeyEventLike): KeyResolution {
  const keyCode = event.keyCode;
  const hasKeyCode = typeof keyCode === 'number' && Number.isFinite(keyCode);

  if (hasKeyCode) {
    const action = ACTION_KEY_CODES.get(keyCode);
    if (action !== undefined) {
      return { kind: 'action', action };
    }
  }

  const key = event.key;
  if (typeof key === 'string') {
    const action = ACTION_BY_KEY.get(key);
    if (action !== undefined) {
      return { kind: 'action', action };
    }
    // evidence: evidence/Y7-i-key.md §2 (probe reproduced in
    // evidence/logs/Y7-uckeytranslate.log) — measured on this Mac (layout
    // Turkish-QWERTY-PC; UCKeyTranslate): physical ANSI_I produces 'ı' and
    // ANSI_Quote produces 'i', while the browser reports layout-derived
    // keyCodes for these keys, so keyCode 73 arrives with a produced 'i' and
    // keyCode 222 with 'ı'. The produced character must win on every layout
    // ('i' → İ, 'ı' → I); the keyCode table stays the fallback for
    // synthetic/legacy events (evidence/D2-input.md §2, amendment 2026-09-29).
    const letter = letterFromKey(key);
    if (letter !== undefined) {
      return { kind: 'letter', letter };
    }
  }

  if (hasKeyCode) {
    const letter = LETTER_BY_KEY_CODE.get(keyCode);
    if (letter !== undefined) {
      return { kind: 'letter', letter };
    }
  }

  const code = event.code;
  if (typeof code === 'string') {
    const action = ACTION_BY_CODE.get(code);
    if (action !== undefined) {
      return { kind: 'action', action };
    }
    const letter = letterFromCode(code);
    if (letter !== undefined) {
      return { kind: 'letter', letter };
    }
  }

  return { kind: 'none' };
}

// ---------------------------------------------------------------------------
// Input events (docs/05 §1 outputs: entryChanged / submit / delete / scramble)
// ---------------------------------------------------------------------------

/** How a letter was added (audio differs: `letterKey` vs `tileClick`, D4). */
export type InputSource = 'key' | 'click';

/** Appended-letter event (the docs/05 §1 `entryChanged` output). */
export interface LetterInputEvent {
  readonly type: 'letter';
  readonly letter: string;
  /** Consumed tile instance. */
  readonly tileId: number;
  readonly source: InputSource;
  /** Entry length after the add (drives D1's O02 bonus roll). */
  readonly entryLengthAfter: number;
}

/** BACKSPACE event; `entryWasEmpty` is the O15(c) sound-only case. */
export interface DeleteInputEvent {
  readonly type: 'delete';
  readonly entryWasEmpty: boolean;
  /** Removed letter, or null when the entry was empty / no tile matched. */
  readonly letter: string | null;
  /** Restored tile instance, or null when nothing was restored. */
  readonly tileId: number | null;
  /** Entry length before the removal (drives D1's O02 bonus reset). */
  readonly entryLengthBefore: number;
}

/** SPACE event; `hadEntry` is the O15(d) partial-entry case. */
export interface ScrambleInputEvent {
  readonly type: 'scramble';
  readonly hadEntry: boolean;
  /** Entry length before the clear (drives D1's O02 bonus reset). */
  readonly entryLengthBefore: number;
}

/** ENTER event; word validation / found-list handling is D3/D5. */
export interface SubmitInputEvent {
  readonly type: 'submit';
  /** The entry as submitted (kept on rejected/found words, O15(b)). */
  readonly entry: string;
}

/** Why an input was ignored (no mutation, no sound). */
export type RejectReason =
  | 'locked'
  | 'unknown-key'
  | 'letter-not-in-deck'
  | 'no-available-tile'
  | 'invalid-tile'
  | 'tile-unavailable';

/** Ignored input; rejected events carry no typer sound (O04/O15(e)). */
export interface RejectedInputEvent {
  readonly type: 'rejected';
  readonly reason: RejectReason;
}

export type InputEvent =
  | LetterInputEvent
  | DeleteInputEvent
  | ScrambleInputEvent
  | SubmitInputEvent
  | RejectedInputEvent;

// ---------------------------------------------------------------------------
// Input controller
// ---------------------------------------------------------------------------

export interface InputControllerOptions {
  /** Deck the controller consumes from and restores into. */
  readonly deck: Deck;
  /**
   * Sink for every resolved input (docs/05 §1 outputs). D5 wires the HUD and
   * audio from these events; rejected events must not play the typer sound.
   */
  readonly onEvent?: (event: InputEvent) => void;
}

export interface InputController {
  /** Current word entry (display letters, appended order). */
  readonly entry: string;
  /** Reference `bitti` gate: true blocks every key and click. */
  readonly locked: boolean;
  /**
   * Set the input gate. The state machine (D5) locks during completion
   * sequences and before a round is active (docs/05 §3; evidence/A2-edges.md
   * §3 quirk 3); the reference sets `bitti = 0` only in `baslat()`.
   */
  setLocked(locked: boolean): void;
  /** Handle one key event (keydown) and return the resolved input event. */
  handleKey(event: KeyEventLike): InputEvent;
  /** Handle a click on tile instance `tileId`. */
  handleTileClick(tileId: number): InputEvent;
  /**
   * Reference successful-submit clear (`ekle()`: `duzenle("temizle")`,
   * `kelime = ""`, every tile visible again). D5/D3 call this only after a
   * valid new word; rejected/found submissions keep the entry (O15(b)).
   */
  clearEntry(): void;
}

/**
 * Create the per-round input controller for `deck`.
 *
 * Submit does not clear the entry by itself: the reference keeps the entry for
 * found words (`boing`, O15(b)) and clears it only for a valid new word, which
 * D3/D5 signal through `clearEntry()`.
 */
export function createInputController(options: InputControllerOptions): InputController {
  const { deck } = options;
  const letters: string[] = [];
  let locked = false;

  const emit = (event: InputEvent): InputEvent => {
    options.onEvent?.(event);
    return event;
  };

  const entry = (): string => letters.join('');

  /** Append via the first available instance carrying the letter. */
  const appendLetter = (letter: string, source: InputSource): InputEvent => {
    if (!deck.containsLetter(letter)) {
      // evidence: evidence/A2-edges.md §2(e) (O15) — keys for letters not in
      // the deck are no-ops (no typer sound either).
      return emit({ type: 'rejected', reason: 'letter-not-in-deck' });
    }
    const tileId = deck.consume(letter);
    if (tileId === null) {
      // evidence: evidence/A2-edges.md §2(a) (O15) — a letter can be entered
      // only as many times as tiles carry it; no visible tile ⇒ no-op.
      return emit({ type: 'rejected', reason: 'no-available-tile' });
    }
    letters.push(letter);
    return emit({ type: 'letter', letter, tileId, source, entryLengthAfter: letters.length });
  };

  /** BACKSPACE: remove the last letter and restore its tile. */
  const deleteLast = (): InputEvent => {
    // evidence: evidence/A2-edges.md §2(c) (O15) — BACKSPACE always reports a
    // delete; on an empty entry the reference plays the sound only.
    const entryLengthBefore = letters.length;
    if (entryLengthBefore === 0) {
      return emit({
        type: 'delete',
        entryWasEmpty: true,
        letter: null,
        tileId: null,
        entryLengthBefore,
      });
    }
    const last = letters[entryLengthBefore - 1];
    if (last === undefined) {
      return emit({
        type: 'delete',
        entryWasEmpty: true,
        letter: null,
        tileId: null,
        entryLengthBefore,
      });
    }
    // Reference sil(): restore the first hidden instance carrying the letter;
    // if no tile matches, the entry is left unchanged (sound still plays).
    const tileId = deck.restoreLastHidden(last);
    if (tileId === null) {
      return emit({
        type: 'delete',
        entryWasEmpty: false,
        letter: last,
        tileId: null,
        entryLengthBefore,
      });
    }
    letters.pop();
    return emit({
      type: 'delete',
      entryWasEmpty: false,
      letter: last,
      tileId,
      entryLengthBefore,
    });
  };

  /** SPACE: clear the entry and return every tile to the deck. */
  const scramble = (): InputEvent => {
    // evidence: evidence/A2-edges.md §2(d) (O15) — scramble clears a partial
    // entry and restores all tiles; an empty entry skips the clear (the
    // pending-bonus quirk stays with D1's O02 tracker, carried by hadEntry).
    const entryLengthBefore = letters.length;
    letters.length = 0;
    deck.restoreAll();
    return emit({
      type: 'scramble',
      hadEntry: entryLengthBefore > 0,
      entryLengthBefore,
    });
  };

  const handleKey = (event: KeyEventLike): InputEvent => {
    if (locked) {
      return emit({ type: 'rejected', reason: 'locked' });
    }
    const resolved = resolveKey(event);
    if (resolved.kind === 'none') {
      return emit({ type: 'rejected', reason: 'unknown-key' });
    }
    if (resolved.kind === 'letter') {
      return appendLetter(resolved.letter, 'key');
    }
    if (resolved.action === ACTION_KEY_NAMES.scramble) {
      return scramble();
    }
    if (resolved.action === ACTION_KEY_NAMES.submit) {
      // evidence: evidence/A2-edges.md §2(b)/(f) (O15) — the entry is
      // submitted as-is and is NOT cleared here: a found word keeps the entry
      // (boing) and an empty entry reaches D3's invalid-word buzz.
      return emit({ type: 'submit', entry: entry() });
    }
    // ACTION_KEY_NAMES.delete
    return deleteLast();
  };

  const handleTileClick = (tileId: number): InputEvent => {
    if (locked) {
      return emit({ type: 'rejected', reason: 'locked' });
    }
    // evidence: evidence/A2-input.md §2 — tile clicks append the clicked
    // tile's own letter and hide that instance (`this._visible = false`).
    const letter = deck.letterOf(tileId);
    if (letter === undefined) {
      return emit({ type: 'rejected', reason: 'invalid-tile' });
    }
    if (!deck.consumeTile(tileId)) {
      // A hidden tile cannot be clicked in the reference UI; kept as a guard.
      return emit({ type: 'rejected', reason: 'tile-unavailable' });
    }
    letters.push(letter);
    return emit({ type: 'letter', letter, tileId, source: 'click', entryLengthAfter: letters.length });
  };

  const clearEntry = (): void => {
    // evidence: evidence/A2-edges.md §2(b) (O15) — only a valid new word
    // clears the entry (duzenle("temizle") + kelime = "" + all tiles visible).
    letters.length = 0;
    deck.restoreAll();
  };

  return {
    get entry(): string {
      return entry();
    },
    get locked(): boolean {
      return locked;
    },
    setLocked(next: boolean): void {
      locked = next;
    },
    handleKey,
    handleTileClick,
    clearEntry,
  };
}
