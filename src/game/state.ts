// src/game/state.ts — finite state machine of the round lifecycle
// (docs/04-architecture.md §4; docs/05-game-core.md §1/§3/§6; EXECUTION.md §5).
//
// The states are the reference main-timeline phases resolved by O13
// (evidence/A2-labels.md §2–§3; docs/02-mechanics-spec.md §5):
//
//   boot         frame 1          page/SWF start; the MochiAds frame-1 script is
//                                 removed (O19, evidence/A2-mochi.md §3)
//   preloader    frames 1–4       SWF byte preloader; frame 4 does
//                                 `gotoAndStop("main")`
//   main         frame 5          label `main`: intro animation; the timeline
//                                 plays 5→130
//   playing      frame 131        label `hepsiburda`: round controller; the
//                                 round starts once the word list has loaded
//                                 (`baslat()`)
//   celebration  frames 132–241   label `bravo`: all-words-found celebration;
//                                 entered only from `bittimi()`; the timeline
//                                 plays 132→240 and stops at 241
//   timeout      frame 131        timeout sequence in place: `tamamla()` reveals
//                                 the board on the gameplay frame
//
// Only `playing` accepts input: the reference gates every key on `if(!bitti)`
// and `bitti` is 0 only between `baslat()` and the completion sequence
// (evidence/A2-timeout.md §3; evidence/A2-edges.md §3; docs/05 §3).
//
// The module owns no game values and reads no data file (docs/05 §1): it only
// tracks the state and enforces the evidenced transition table.

/** The six evidenced lifecycle states, in main-timeline order. */
export const GAME_STATES = [
  'boot',
  'preloader',
  'main',
  'playing',
  'celebration',
  'timeout',
] as const;

/** One lifecycle state (the union of {@link GAME_STATES}). */
export type GameState = (typeof GAME_STATES)[number];

/**
 * The completion sequences: input is locked and the round is over.
 * - `celebration`: all words found (`bittimi()` → `gotoAndStop("bravo")`);
 * - `timeout`: the timer reached zero (`tamamla()` on frame 131).
 */
// evidence: docs/05-game-core.md §3 ("During the completion sequence, input is
// locked"); evidence/A2-labels.md §2 (`bittimi()`); evidence/A2-timeout.md §3.
export const COMPLETION_SEQUENCE_STATES: readonly GameState[] = ['celebration', 'timeout'];

/** True for `celebration` / `timeout` (docs/05 §3 completion sequences). */
export function isCompletionSequence(state: GameState): boolean {
  return COMPLETION_SEQUENCE_STATES.includes(state);
}

/**
 * Input gate per state. The reference only unlocks input while the round is
 * live (`baslat()` sets `bitti = 0`; `bittimi()` / the timeout branch set
 * `bitti = 1`; completion sequences and the intro/preloader keep it locked).
 */
// evidence: evidence/A2-edges.md §3 ("`bitti` set to 0 only by `baslat()`");
// evidence/A2-timeout.md §3 ("Input after timeout: `bitti = 1` disables
// SPACE/ENTER/BACKSPACE/CTRL"); docs/05-game-core.md §3.
export function isInputLocked(state: GameState): boolean {
  return state !== 'playing';
}

/**
 * Allowed transitions, each with its evidence. `playing → playing` is the
 * reference "Yeni Oyun" path during a live round (`ybuton` →
 * `DefineButton2_71` → `init()`), which restarts the round controller in
 * place; a same-state transition is a valid no-op for observers.
 */
export const GAME_TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  // evidence: evidence/A2-labels.md §2 (`frame 1: DoAction` MochiAds — removed
  // by O19; frames 2–4 preloader); docs/02 §5 (`boot → preloader`).
  boot: ['preloader'],
  // evidence: evidence/A2-labels.md §2 (`frame 4: DoAction (preloader loop →
  // gotoAndStop("main"))`).
  preloader: ['main'],
  // evidence: evidence/A2-labels.md §3 (label `main` at frame 5; timeline plays
  // 5→130; frame 131 runs `init()` and stops); evidence/A2-timer.md §2
  // (`baslat()` starts the round after the word list loads).
  main: ['playing'],
  // evidence: evidence/A2-labels.md §2 (`bittimi()` → `gotoAndStop("bravo")`);
  // evidence/A2-timeout.md §2 (`timer == 0` → `_root.tamamla()`); the restart
  // path is `DefineButton2_71` (`ybuton` → `init()`).
  playing: ['celebration', 'timeout', 'playing'],
  // evidence: evidence/A2-labels.md §3 (`bittimi()` sets `ybuton._visible =
  // true`; the end-of-round screen returns via the excluded form's
  // `_root.gotoAndPlay("main")`); the rebuild's Yeni Oyun starts the next round
  // through `DefineButton2_71` → `init()` (see D5 evidence deviation note).
  celebration: ['playing'],
  // evidence: evidence/A2-timeout.md §3 (`tamamla()` shows "Yeni Oyun");
  // `DefineButton2_71` (`ybuton` → `init()`) starts the next round.
  timeout: ['playing'],
};

/** One state change (docs/05 §1 output `stateChanged(state)`). */
export interface StateChange {
  readonly previous: GameState;
  readonly state: GameState;
}

/** Observer options for {@link createStateMachine}. */
export interface StateMachineOptions {
  /** Initial state; defaults to `boot` (the page starts at frame 1). */
  readonly initialState?: GameState;
  /** docs/05 §1 output: fires after every real state change. */
  readonly onChange?: (change: StateChange) => void;
}

/** The finite state machine contract (docs/05 §1). */
export interface StateMachine {
  readonly state: GameState;
  /** True while input must be rejected (see {@link isInputLocked}). */
  readonly inputLocked: boolean;
  /** True for the completion sequences (see {@link isCompletionSequence}). */
  readonly completionSequence: boolean;
  /** True when `next` is reachable from the current state. */
  can(next: GameState): boolean;
  /**
   * Move to `next`. Throws `Error` for a transition that is not in
   * {@link GAME_TRANSITIONS}; a same-state transition is allowed where the
   * table lists it (round restart) and does not fire `onChange`.
   */
  transition(next: GameState): StateChange;
}

/** Error thrown for a transition that the evidenced flow does not allow. */
export class IllegalTransitionError extends Error {
  readonly previous: GameState;
  readonly next: GameState;

  constructor(previous: GameState, next: GameState) {
    super(
      `illegal state transition ${previous} → ${next} (allowed: ${GAME_TRANSITIONS[
        previous
      ].join(', ')})`,
    );
    this.name = 'IllegalTransitionError';
    this.previous = previous;
    this.next = next;
  }
}

/** Create the lifecycle state machine (one per app session). */
export function createStateMachine(options: StateMachineOptions = {}): StateMachine {
  let state: GameState = options.initialState ?? 'boot';

  return {
    get state(): GameState {
      return state;
    },
    get inputLocked(): boolean {
      return isInputLocked(state);
    },
    get completionSequence(): boolean {
      return isCompletionSequence(state);
    },
    can(next: GameState): boolean {
      return GAME_TRANSITIONS[state].includes(next);
    },
    transition(next: GameState): StateChange {
      if (!GAME_TRANSITIONS[state].includes(next)) {
        throw new IllegalTransitionError(state, next);
      }
      const previous = state;
      state = next;
      const change: StateChange = { previous, state };
      if (previous !== next) {
        options.onChange?.(change);
      }
      return change;
    },
  };
}
