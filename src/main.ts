// src/main.ts — bootstrap (docs/04-architecture.md §4).
// C2 mounts the stage shell; E2 mounts the static board layout into it.
// D5 wires the round lifecycle on top of that board (docs/05-game-core.md §6):
// state machine + HUD + status message + input + audio, plus the `window.__game`
// test hooks (docs/04 §6) and the dev-only E2 `__visualTest` hook, which stays
// intact.
import constants from '../data/constants.json';
import { getLastAudioEvent, playAudioEvent } from './audio/audio';
import { createRoundLifecycle, type LifecycleSnapshot } from './game/lifecycle';
import { isCompletionSequence, type GameState } from './game/state';
import { mountStage } from './stage';
import {
  defaultBoardView,
  mountBoard,
  type BoardView,
  type FoundWordView,
  type TileView,
} from './ui/board';
import { mountHud, type HudControlsVisibility } from './ui/hud';
import { mountMessage } from './ui/message';

const stage = mountStage();
const board = mountBoard(stage.root, defaultBoardView());
const message = mountMessage(stage.root);

// ---------------------------------------------------------------------------
// Game wiring
// ---------------------------------------------------------------------------

/** Frozen round-schema lengths (structural; values live in data/rounds.json). */
const WORD_LENGTHS = [3, 4, 5, 6, 7, 8] as const;

/**
 * E2's dev-only visual-state hook. While a test-applied view is active, the
 * live game stops repainting the board so the applied state stays stable for
 * screenshots (the timer keeps running model-side).
 */
declare global {
  interface Window {
    __visualTest?: { apply(view: BoardView): void };
  }
}

let visualOverride: BoardView | null = null;

const devServer = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
if (devServer) {
  window.__visualTest = {
    apply(view: BoardView): void {
      visualOverride = view;
      board.apply(view);
    },
  };
}

const hud = mountHud(stage.root, {
  board: board.element,
  onSubmit: (): void => {
    lifecycle.submitCurrent();
  },
  onScramble: (): void => {
    lifecycle.scramble();
  },
  onDelete: (): void => {
    lifecycle.deleteLast();
  },
  onNewRound: (): void => {
    lifecycle.newRound();
  },
});

let currentSnapshot: LifecycleSnapshot | null = null;

/** Tiles in display-slot order (`order[slot]` -> instance); hidden off-round. */
function tilesFor(snapshot: LifecycleSnapshot): TileView[] | undefined {
  const deck = snapshot.deck;
  if (deck === null) return undefined;
  const tilesHidden = snapshot.state !== 'playing';
  return deck.order.map((instanceId) => ({
    letter: deck.tiles[instanceId]?.letter ?? '',
    visible: !tilesHidden && deck.available[instanceId] === true,
  }));
}

/**
 * Board view for one lifecycle moment. The reference hides Ekle/Karıştır/Sil
 * at round end (`bittimi()` / `tamamla()`), which the element filter mirrors;
 * Yeni Oyun stays available (evidence/D5-lifecycle.md deviation note).
 */
function boardViewFor(snapshot: LifecycleSnapshot): BoardView {
  const base = defaultBoardView();
  const elements = snapshot.completionSequence
    ? base.elements.filter(
        (id) => id !== 'btn_ebuton' && id !== 'btn_sbuton' && id !== 'btn_kbuton',
      )
    : base.elements;
  const view: BoardView = {
    elements,
    slotCounts: WORD_LENGTHS.map((length) => snapshot.listedSlotCounts[length]),
    found: snapshot.listedFound.map(
      (listed): FoundWordView => ({ len: listed.length, index: listed.index, text: listed.word }),
    ),
    entry: snapshot.entry,
    counts: WORD_LENGTHS.map((length) => String(snapshot.remainingCounts[length])),
    score: String(snapshot.score),
    timer: { remaining: snapshot.remainingSeconds, total: constants.timer.initialSeconds },
  };
  const tiles = tilesFor(snapshot);
  if (tiles !== undefined) view.tiles = tiles;
  return view;
}

/** Tag the rendered tiles with the docs/05 §8 `tile-0..7` testids. */
function decorateTiles(boardElement: HTMLElement): void {
  for (const node of boardElement.querySelectorAll('[data-element^="button"]')) {
    if (!(node instanceof HTMLElement)) continue;
    const match = /^button(\d+)$/.exec(node.dataset.element ?? '');
    if (match === null) continue;
    node.dataset.testid = `tile-${match[1]}`;
  }
}

/** Reference button visibility: live controls only during a playable round. */
function controlsVisibleFor(state: GameState): HudControlsVisibility {
  const playing = state === 'playing';
  return {
    submit: playing,
    scramble: playing,
    delete: playing,
    newRound: playing || isCompletionSequence(state),
  };
}

function render(snapshot: LifecycleSnapshot): void {
  currentSnapshot = snapshot;
  if (visualOverride !== null) return;
  board.apply(boardViewFor(snapshot));
  decorateTiles(board.element);
  hud.update(snapshot);
  hud.setControls(controlsVisibleFor(snapshot.state));
  // O05 status message: live entry feedback (Geçerli / Girildi).
  message.showStatus(snapshot.entryStatus);
}

function onTimerTick(remainingSeconds: number): void {
  if (visualOverride !== null) return;
  hud.updateTimer(remainingSeconds, constants.timer.initialSeconds);
}

const lifecycle = createRoundLifecycle({
  constants: {
    timer: constants.timer,
    scoring: constants.scoring,
    bonusLetterSeed: constants.bonusLetter.seed,
  },
  playAudio: (event): void => {
    playAudioEvent(event);
  },
  onChanged: render,
  onTick: onTimerTick,
  onStateChanged: (change): void => {
    if (change.state === 'preloader') {
      // O05 loading banner (evidence/A2-strings.md §2, text ids 78/82/83).
      message.showLoading();
    }
  },
});

// Input wiring: keyboard (docs/05 §3) and tile clicks on E2's board.
document.addEventListener('keydown', (event): void => {
  const result = lifecycle.handleKey({
    keyCode: event.keyCode,
    key: event.key,
    code: event.code,
  });
  if (result.type !== 'rejected') event.preventDefault();
});

board.element.addEventListener('click', (event): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const node = target.closest('[data-element]');
  if (!(node instanceof HTMLElement)) return;
  const match = /^button(\d+)$/.exec(node.dataset.element ?? '');
  if (match === null) return;
  const snapshot = currentSnapshot;
  if (snapshot === null || snapshot.deck === null) return;
  const slot = Number(match[1]);
  const instanceId = snapshot.deck.order[slot];
  if (instanceId === undefined) return;
  lifecycle.handleTileClick(instanceId);
});

// ---------------------------------------------------------------------------
// Test hooks (docs/04-architecture.md §6)
// ---------------------------------------------------------------------------

export interface GameTestHooks {
  readonly state: GameState;
  readonly roundId: string | null;
  readonly foundWords: readonly string[];
  readonly score: number;
  readonly remainingMs: number;
  readonly lastAudioEvent: string | null;
  /** TEST-ONLY (docs/04 §6 amendment): play a specific bank round by `main`. */
  selectRound(main: string): void;
}

declare global {
  interface Window {
    __game: GameTestHooks;
  }
}

const gameTestHooks: GameTestHooks = {
  get state(): GameState {
    return lifecycle.state;
  },
  get roundId(): string | null {
    return lifecycle.round?.id ?? null;
  },
  get foundWords(): readonly string[] {
    return [...lifecycle.foundWords];
  },
  get score(): number {
    return lifecycle.score;
  },
  get remainingMs(): number {
    return lifecycle.remainingMs;
  },
  get lastAudioEvent(): string | null {
    return getLastAudioEvent();
  },
  selectRound(main: string): void {
    lifecycle.selectRound(main);
  },
};

window.__game = gameTestHooks;

// ---------------------------------------------------------------------------
// Boot: preloader → main → first round (O13 flow; evidence/A2-labels.md §2)
// ---------------------------------------------------------------------------

lifecycle.start();
lifecycle.newRound();
