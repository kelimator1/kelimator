// src/game/lifecycle.ts — round start/end orchestration and the completion
// sequences (docs/04-architecture.md §4; docs/05-game-core.md §1/§6;
// docs/02-mechanics-spec.md §4/§5; O13/O14: evidence/A2-labels.md,
// evidence/A2-timeout.md).
//
// Reference flow reproduced here (`frame_131/DoAction.as`):
// - `init()` → clear board/slots, `bonusball = -1`, `puan = 0`, load word list,
//   `yerlestir()` + `tablociz()` → `baslat()`: timer starts, input unlocked;
// - `ekle()` (ENTER / Ekle button): valid new word → slot assign, score
//   (`n² × puankatsayi`, +5000 while `bonusball > -1`), `b`-counter decrement,
//   "enter" sound, clear entry, `bittimi()`; already-found → "boing", entry
//   kept; unknown → "buzz", entry kept (O15);
// - `bittimi()`: completes when every *listed* slot is filled (each length's
//   listed count is `min(words, 10)` — `if(k > 10) { k = 10; }`); adds
//   `timer × timebonus` from the last displayed integer second, stops the
//   timer, hides the tiles, `gotoAndStop("bravo")` (O13);
// - timeout (`DefineSprite_21/frame_3`): `bitti = 1`, "finishsound", entry
//   discarded without scoring, tiles hidden, every listed-but-unfound word
//   revealed in place; no time bonus (O14).
//
// Modules never read `data/constants.json` (docs/05 §1): the app loads it once
// at bootstrap and passes `LifecycleConstants`. Audio is emitted through D4's
// event names (evidence/D2-input.md §6.5 wiring map); `rejected` input events
// play nothing. This module is DOM-free and clock-injectable: tests drive a
// fake clock and a recording `playAudio` — no UI, no real time, no sound
// (silent witness runs, EXECUTION.md §8).

import { playAudioEvent, type AudioEventName } from '../audio/audio';
import {
  createInputController,
  type InputController,
  type InputEvent,
  type KeyEventLike,
} from './input';
import {
  createBonusLetterTracker,
  createRoundSequence,
  createSeededRandom,
  ROUNDS,
  type BonusLetterTracker,
  type RandomSource,
  type Round,
  type RoundSequence,
  type WordLength,
} from './round';
import { scoreTimeBonus, scoreWord, type ScoringConstants } from './scoring';
import {
  createStateMachine,
  isCompletionSequence,
  isInputLocked,
  type GameState,
  type StateChange,
} from './state';
import { createDeck, type Deck, type DeckSnapshot } from './tiles';
import { createTimer, type CountdownTimer, type TimerClock, type TimerConstants } from './timer';

// ---------------------------------------------------------------------------
// Constants (evidence-annotated; values passed from data/constants.json are
// never literals here)
// ---------------------------------------------------------------------------

/**
 * Base seed of the production deck shuffle. The reference reshuffles with the
 * unseeded Flash `random()`; the rebuild's deck shuffle is a seeded
 * permutation (D2) whose production seed source/advance is D5's hand-off
 * (evidence/D2-input.md §6.1). Decision recorded in `evidence/D5-lifecycle.md`:
 * the Nth shuffle of the session (round deal and each SPACE scramble share one
 * counter) uses `SHUFFLE_SEED_BASE + N`, 0-based.
 */
// evidence: evidence/D2-input.md §4/§6.1 (D5 owns the production seed);
// data/constants.json `bonusLetter.seed` = 2012 (amendment 2026-09-28b) is the
// recorded deterministic value this base uses; V7 test asserts base === seed.
export const SHUFFLE_SEED_BASE = 2012;

/**
 * Listing cap: at most 10 words per length get a board slot.
 * evidence: evidence/A2-labels.md §3 (`tablociz()`: `if(k > 10) { k = 10; }`
 * and at most 10 text fields per length); `bittimi()` completes when those
 * listed slots are filled.
 */
export const LISTING_CAP = 10;

/**
 * Countdown sound window: `_root.countdown.play()` while `timer < 10 &&
 * timer > 0` (and the timer bar animates below 10 s).
 * evidence: evidence/A2-sounds.md §2 ("countdown (<10 s)");
 * evidence/A2-timer.md §2 (`DefineSprite_76/frame_1`: `if(xx <= 10) bar.play()`).
 */
const COUNTDOWN_SECONDS = 10;

/** Word lengths of the frozen round schema, in ascending order. */
// evidence: data/rounds.schema.json (keys 3..8); docs/05-game-core.md §2.
const WORD_LENGTHS: readonly WordLength[] = [3, 4, 5, 6, 7, 8];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Why the round ended (docs/05 §1 `roundCompleted(reason)`). */
export type CompletionReason = 'all-found' | 'timeout';

/**
 * `submit` decision (evidence/D2-input.md §6.5: submit → D3's
 * submitValid/submitAlreadyFound/submitInvalid decision).
 * `ignored` = no round is live (input locked); nothing happens and no sound
 * plays.
 */
export type SubmitOutcome = 'valid' | 'already-found' | 'invalid' | 'ignored';

/**
 * Live entry-status message (O05 status sprite): `valid` while the entry is a
 * valid, not-yet-found word ("Geçerli"), `already-found` while it is in the
 * found list ("Girildi"), `null` otherwise.
 * evidence: evidence/A2-strings.md §2 (`kontrol()`: `status.gotoAndStop(2)` for
 * `dizi`, frame 3 for `bulunanlar`; the found pass runs last).
 */
export type EntryStatus = 'valid' | 'already-found' | null;

/** One filled board slot (listed word), in board order. */
export interface ListedWordView {
  readonly length: WordLength;
  /** Zero-based slot index in the length's row. */
  readonly index: number;
  readonly word: string;
  /** True when filled by the timeout reveal rather than by the player. */
  readonly revealed: boolean;
}

/** Immutable view of one lifecycle moment (the UI's single render input). */
export interface LifecycleSnapshot {
  readonly state: GameState;
  /** Bank index of the current round (array order is identity, docs/06 §4). */
  readonly roundIndex: number;
  readonly roundId: string | null;
  readonly main: string | null;
  readonly score: number;
  /** Time bonus added by the all-found completion (0 otherwise). */
  readonly timeBonus: number;
  readonly remainingSeconds: number;
  /** `remainingSeconds × 1000` (docs/04 §6 hook; the timer is integer-second). */
  readonly remainingMs: number;
  readonly entry: string;
  readonly entryStatus: EntryStatus;
  readonly foundWords: readonly string[];
  /** Filled listed slots (found words first, then timeout reveals). */
  readonly listedFound: readonly ListedWordView[];
  /** Listed slot count per length: `min(words.length, LISTING_CAP)`. */
  readonly listedSlotCounts: Readonly<Record<WordLength, number>>;
  /** Reference `b3`..`b8` counters: total words minus found words per length. */
  readonly remainingCounts: Readonly<Record<WordLength, number>>;
  /** True after the timeout reveal (`tamamla()`), false otherwise. */
  readonly boardRevealed: boolean;
  readonly inputLocked: boolean;
  readonly completionSequence: boolean;
  readonly deck: DeckSnapshot | null;
}

/** The typed constant blocks the bootstrap passes in (docs/05 §1). */
export interface LifecycleConstants {
  readonly timer: TimerConstants;
  readonly scoring: ScoringConstants;
  /** `data/constants.json` `bonusLetter.seed` (O02, amendment 2026-09-28b). */
  readonly bonusLetterSeed: number;
}

/** Options for {@link createRoundLifecycle}; every side effect is injectable. */
export interface RoundLifecycleOptions {
  /** Constants loaded once at bootstrap (docs/05 §1). */
  readonly constants: LifecycleConstants;
  /** Round bank; defaults to the validated `src/data/rounds.json` bank. */
  readonly rounds?: readonly Round[];
  /** Wall clock for the countdown; tests inject a fake. */
  readonly clock?: TimerClock;
  /** Audio sink; defaults to D4's `playAudioEvent`. Tests inject a recorder. */
  readonly playAudio?: (event: AudioEventName) => void;
  /** docs/05 §1 output: fires on every real state change. */
  readonly onStateChanged?: (change: StateChange) => void;
  /** docs/05 §1 output: fires when a round becomes playable. */
  readonly onRoundStarted?: (round: Round) => void;
  /** docs/05 §1 output: fires once when the round ends. */
  readonly onRoundCompleted?: (reason: CompletionReason) => void;
  /** Structural change (round/entry/deck/score/found/state): redraw the UI. */
  readonly onChanged?: (snapshot: LifecycleSnapshot) => void;
  /** Timer start and every 1000 ms boundary (docs/05 §5 `tick(remaining)`). */
  readonly onTick?: (remainingSeconds: number) => void;
  /** Deck shuffle base seed; defaults to {@link SHUFFLE_SEED_BASE}. */
  readonly shuffleSeedBase?: number;
  /** Bonus RNG override for tests; defaults to `bonusLetterSeed` mulberry32. */
  readonly bonusRandom?: RandomSource;
}

/** Round lifecycle contract: start, submit, complete, restart. */
export interface RoundLifecycle {
  readonly state: GameState;
  readonly score: number;
  readonly foundWords: readonly string[];
  readonly remainingSeconds: number;
  readonly remainingMs: number;
  readonly entry: string;
  readonly round: Round | null;
  readonly roundIndex: number;
  /** Fresh immutable view for the UI. */
  snapshot(): LifecycleSnapshot;
  /** `boot → preloader → main` (frames 1→5; the bundle is already loaded). */
  start(): void;
  /**
   * Start the next round in bank order (docs/05 §6; ids may repeat — array
   * order is identity): resets score/found/reveal, creates the deck (seeded
   * shuffle), the O02 bonus tracker and the input controller, starts the timer
   * and unlocks input.
   */
  newRound(): Round;
  /**
   * TEST-ONLY (docs/04 §6 amendment): play a specific bank round, selected by
   * its `main` display form (first match). Does not advance the sequential
   * cursor.
   */
  selectRound(main: string): Round;
  /**
   * Validate + score `entry` against the current round (reference `ekle()`
   * core). Returns the decision; audio follows the D2 §6.5 wiring map.
   */
  submit(entry: string): SubmitOutcome;
  /** Handle one key event through the input controller (SPACE/ENTER/BACKSPACE/letters). */
  handleKey(event: KeyEventLike): InputEvent;
  /** Handle a click on tile instance `tileId`. */
  handleTileClick(tileId: number): InputEvent;
  /** `sbuton` (Karıştır) → `karistir()`: same path as SPACE. */
  scramble(): InputEvent;
  /** `kbuton` (Sil) → `sil()`: same path as BACKSPACE. */
  deleteLast(): InputEvent;
  /** `ebuton` (Ekle) → `ekle()`: same path as ENTER. */
  submitCurrent(): InputEvent;
}

const LOCKED_EVENT: InputEvent = Object.freeze({ type: 'rejected', reason: 'locked' } as const);

function zeroCounts(): Record<WordLength, number> {
  return { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
}

/** Create the per-session round lifecycle. */
export function createRoundLifecycle(options: RoundLifecycleOptions): RoundLifecycle {
  const rounds: readonly Round[] = options.rounds ?? ROUNDS;
  const sequence: RoundSequence = createRoundSequence(rounds);
  const play: (event: AudioEventName) => void =
    options.playAudio ?? ((event) => playAudioEvent(event));

  // -------------------------------------------------------------------------
  // Mutable session state
  // -------------------------------------------------------------------------

  let pendingIndex: number | null = null;
  let roundIndex = -1;
  let round: Round | null = null;
  let deck: Deck | null = null;
  let input: InputController | null = null;
  let bonus: BonusLetterTracker | null = null;
  let score = 0;
  let timeBonus = 0;
  let foundWords: string[] = [];
  let foundCounts: Record<WordLength, number> = zeroCounts();
  let foundSet = new Set<string>();
  let wordSet = new Set<string>();
  let revealed = false;
  let shuffleCount = 0;

  const fsm = createStateMachine({
    onChange: (change: StateChange): void => {
      syncInputLock();
      options.onStateChanged?.(change);
    },
  });

  const timer: CountdownTimer = createTimer({
    constants: options.constants.timer,
    onTick: (remainingSeconds: number): void => {
      // evidence: evidence/A2-sounds.md §2 — the countdown sound restarts every
      // 1000 ms while `timer < 10 && timer > 0` (O01 tick = 1000 ms).
      if (fsm.state === 'playing' && remainingSeconds > 0 && remainingSeconds < COUNTDOWN_SECONDS) {
        play('countdown');
      }
      options.onTick?.(remainingSeconds);
    },
    onExpired: (): void => {
      completeTimeout();
    },
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function syncInputLock(): void {
    input?.setLocked(isInputLocked(fsm.state));
  }

  function listedSlotCount(length: WordLength): number {
    return round === null ? 0 : Math.min(round.words[length].length, LISTING_CAP);
  }

  function remainingCounts(): Record<WordLength, number> {
    const counts = zeroCounts();
    if (round !== null) {
      for (const length of WORD_LENGTHS) {
        counts[length] = round.words[length].length - foundCounts[length];
      }
    }
    return counts;
  }

  function listedWords(): ListedWordView[] {
    const current = round;
    if (current === null) return [];
    const views: ListedWordView[] = [];
    for (const length of WORD_LENGTHS) {
      const listed = listedSlotCount(length);
      if (listed === 0) continue;
      const foundOfLength = foundWords.filter((word) => [...word].length === length);
      const slots = foundOfLength.slice(0, listed);
      if (revealed && slots.length < listed) {
        // evidence: evidence/A2-timeout.md §2 (`tamamla()`): every listed but
        // unfound word is written into the row's next free slots, in word-list
        // order; words already in the row are skipped.
        for (const word of current.words[length]) {
          if (slots.length >= listed) break;
          if (!foundSet.has(word)) slots.push(word);
        }
      }
      slots.forEach((word, index) => {
        views.push({ length, index, word, revealed: !foundSet.has(word) });
      });
    }
    return views;
  }

  function entryStatusOf(entry: string): EntryStatus {
    if (entry === '') return null;
    if (foundSet.has(entry)) return 'already-found';
    if (wordSet.has(entry)) return 'valid';
    return null;
  }

  function snapshot(): LifecycleSnapshot {
    const current = round;
    return {
      state: fsm.state,
      roundIndex,
      roundId: current?.id ?? null,
      main: current?.main ?? null,
      score,
      timeBonus,
      remainingSeconds: timer.remainingSeconds,
      // evidence: evidence/D3-scoring-timer.md §6 (remainingMs = integer
      // second × the evidenced tick, one displayed second).
      remainingMs: timer.remainingSeconds * options.constants.timer.tickMs,
      entry: input?.entry ?? '',
      entryStatus: entryStatusOf(input?.entry ?? ''),
      foundWords: [...foundWords],
      listedFound: listedWords(),
      listedSlotCounts: listedSlotCountsView(),
      remainingCounts: remainingCounts(),
      boardRevealed: revealed,
      inputLocked: isInputLocked(fsm.state),
      completionSequence: isCompletionSequence(fsm.state),
      deck: deck?.snapshot() ?? null,
    };
  }

  function listedSlotCountsView(): Record<WordLength, number> {
    const counts = zeroCounts();
    for (const length of WORD_LENGTHS) {
      counts[length] = listedSlotCount(length);
    }
    return counts;
  }

  function notifyChanged(): void {
    options.onChanged?.(snapshot());
  }

  function isAllFound(): boolean {
    let total = 0;
    let filled = 0;
    for (const length of WORD_LENGTHS) {
      const listed = listedSlotCount(length);
      total += listed;
      filled += Math.min(foundCounts[length], listed);
    }
    // evidence: evidence/A2-labels.md §2 (`if(t == p && t > 0)` in `bittimi()`:
    // every listed slot filled and at least one listed slot exists).
    return total > 0 && filled === total;
  }

  /** Next shuffle seed: base + session shuffle count, 0-based (module header). */
  function nextShuffleSeed(): number {
    const base = options.shuffleSeedBase ?? SHUFFLE_SEED_BASE;
    const seed = base + shuffleCount;
    shuffleCount += 1;
    return seed;
  }

  function completeAllFound(): void {
    // evidence: evidence/A2-labels.md §2 (`bittimi()`): `puan += timer *
    // timebonus` from the last displayed integer second, then the timer clip is
    // stopped (`gotoAndStop(1)`) — O14: no time bonus on the timeout path.
    timeBonus = scoreTimeBonus(timer.remainingSeconds, options.constants.scoring);
    score += timeBonus;
    timer.stop();
    fsm.transition('celebration');
    options.onRoundCompleted?.('all-found');
    notifyChanged();
  }

  function completeTimeout(): void {
    if (fsm.state !== 'playing') return;
    // evidence: evidence/A2-timeout.md §2–§3: `tamamla()` runs
    // `duzenle("temizle")` (entry + pending bonus discarded, no scoring), hides
    // the tiles and reveals every listed-but-unfound word; `finishsound` plays.
    const entryLength = input?.entry.length ?? 0;
    bonus?.clearEntry(entryLength);
    input?.clearEntry();
    revealed = true;
    play('timeout');
    fsm.transition('timeout');
    options.onRoundCompleted?.('timeout');
    notifyChanged();
  }

  function handleInput(event: InputEvent): void {
    switch (event.type) {
      case 'letter':
        bonus?.addLetter(event.entryLengthAfter);
        // evidence: evidence/D2-input.md §6.5 wiring map: keyboard `letter` →
        // `letterKey`, tile click → `tileClick` (D4 `source` field).
        play(event.source === 'click' ? 'tileClick' : 'letterKey');
        notifyChanged();
        return;
      case 'delete':
        // evidence: evidence/D2-input.md §6.5: delete → `delete`; the tracker
        // call is the D1 O02 reset before/after removal (same argument).
        bonus?.removeLastLetter(event.entryLengthBefore);
        play('delete');
        notifyChanged();
        return;
      case 'scramble':
        // evidence: evidence/D2-input.md §6.5: scramble → `scramble`;
        // `karistir()` also reshuffles the deck (reference `shuffle()`), whose
        // production seed/advance is D5's (module header).
        bonus?.clearEntry(event.entryLengthBefore);
        deck?.shuffle(nextShuffleSeed());
        play('scramble');
        notifyChanged();
        return;
      case 'submit':
        submit(event.entry);
        return;
      case 'rejected':
        // evidence: evidence/D2-input.md §6.5 — rejected events play nothing.
        return;
    }
  }

  function action(event: KeyEventLike): InputEvent {
    return input?.handleKey(event) ?? LOCKED_EVENT;
  }

  function takeNextRoundIndex(): number {
    if (pendingIndex !== null) {
      const index = pendingIndex;
      pendingIndex = null;
      return index;
    }
    if (!sequence.hasNext()) {
      // docs/05 §6 does not define end-of-bank behavior; decision (recorded in
      // evidence/D5-lifecycle.md): the session cycles back to the first round.
      sequence.reset();
    }
    const index = sequence.nextIndex;
    sequence.next();
    return index;
  }

  function newRound(): Round {
    const index = takeNextRoundIndex();
    const next = rounds[index];
    if (next === undefined) {
      throw new RangeError(`round bank exhausted: no round at index ${index}`);
    }
    roundIndex = index;
    round = next;

    wordSet = new Set<string>();
    for (const length of WORD_LENGTHS) {
      for (const word of next.words[length]) wordSet.add(word);
    }
    foundWords = [];
    foundCounts = zeroCounts();
    foundSet = new Set<string>();
    score = 0;
    timeBonus = 0;
    revealed = false;

    // O02: a fresh seeded tracker per round (`init()` resets `bonusball = -1`).
    bonus = createBonusLetterTracker(
      options.bonusRandom ?? createSeededRandom(options.constants.bonusLetterSeed),
    );
    deck = createDeck(next.letters);
    // Reference `yerlestir()` → `shuffle()` on every round deal (D2 §6.1).
    deck.shuffle(nextShuffleSeed());
    input = createInputController({ deck, onEvent: handleInput });

    if (fsm.state !== 'playing') {
      fsm.transition('playing');
    }
    syncInputLock();
    // evidence: evidence/A2-timer.md §2 — `baslat()` starts the countdown only
    // after the word list has loaded; every round starts at `initialSeconds`.
    timer.start();
    // evidence: evidence/A2-sounds.md §2 — `init()` plays "fanfare" at round
    // start (`roundStart` in data/sound-map.json).
    play('roundStart');
    options.onRoundStarted?.(next);
    notifyChanged();
    return next;
  }

  function selectRound(main: string): Round {
    const index = rounds.findIndex((candidate) => candidate.main === main);
    if (index === -1) {
      throw new Error(`selectRound: no round with main ${JSON.stringify(main)} in the bank`);
    }
    pendingIndex = index;
    return newRound();
  }

  function submit(entry: string): SubmitOutcome {
    if (fsm.state !== 'playing') return 'ignored';
    if (!wordSet.has(entry)) {
      // evidence: evidence/A2-strings.md §2 (`ekle()` buzz branch); empty
      // entries reach this branch too (O15(f), evidence/A2-edges.md §2(f)).
      play('submitInvalid');
      return 'invalid';
    }
    if (foundSet.has(entry)) {
      // evidence: evidence/A2-edges.md §2(b) (O15): re-submitting a found word
      // plays "boing", scores nothing and keeps the entry.
      play('submitAlreadyFound');
      return 'already-found';
    }

    // Valid new word — reference `ekle()` order: slot assign, score, counter,
    // sound, clear entry, completion check.
    const wordScore = scoreWord(entry, bonus?.ball ?? -1, options.constants.scoring);
    score += wordScore.totalPoints;
    const length = [...entry].length as WordLength;
    foundWords.push(entry);
    foundSet.add(entry);
    foundCounts[length] += 1;
    play('submitValid');
    bonus?.clearEntry([...entry].length);
    input?.clearEntry();
    notifyChanged();
    if (isAllFound()) {
      completeAllFound();
    }
    return 'valid';
  }

  return {
    get state(): GameState {
      return fsm.state;
    },
    get score(): number {
      return score;
    },
    get foundWords(): readonly string[] {
      return [...foundWords];
    },
    get remainingSeconds(): number {
      return timer.remainingSeconds;
    },
    get remainingMs(): number {
      // evidence: evidence/D3-scoring-timer.md §6 (integer second × tick).
      return timer.remainingSeconds * options.constants.timer.tickMs;
    },
    get entry(): string {
      return input?.entry ?? '';
    },
    get round(): Round | null {
      return round;
    },
    get roundIndex(): number {
      return roundIndex;
    },
    snapshot,
    start(): void {
      // evidence: evidence/A2-labels.md §2 — pages frames 1–4 (preloader) then
      // frame 4 `gotoAndStop("main")`; the bundle is already loaded here.
      fsm.transition('preloader');
      fsm.transition('main');
    },
    newRound,
    selectRound,
    submit,
    handleKey: (event: KeyEventLike): InputEvent => action(event),
    handleTileClick: (tileId: number): InputEvent => input?.handleTileClick(tileId) ?? LOCKED_EVENT,
    scramble: (): InputEvent => action({ key: ' ' }),
    deleteLast: (): InputEvent => action({ key: 'Backspace' }),
    submitCurrent: (): InputEvent => action({ key: 'Enter' }),
  };
}
