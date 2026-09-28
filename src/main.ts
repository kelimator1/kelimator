// src/main.ts — bootstrap (docs/04-architecture.md §4).
// C2 mounts the stage shell; E2 mounts the static board layout into it.
// Gameplay state arrives with D1–D5 and must replace the placeholder hooks
// below.
import { mountStage } from './stage';
import { defaultBoardView, mountBoard, type BoardView } from './ui/board';

const stage = mountStage();
const board = mountBoard(stage.root, defaultBoardView());

// TEST-ONLY visual-state hook (task E2): the observed static states of
// docs/07 §5 are applied by tests/e2e/visual.spec.ts through this hook; it is
// installed on the dev server only and contains no gameplay logic. The states
// themselves live under tests/e2e/ (owned by E2).
declare global {
  interface Window {
    __visualTest?: { apply(view: BoardView): void };
  }
}

const devServer = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
if (devServer) {
  window.__visualTest = {
    apply(view: BoardView): void {
      board.apply(view);
    },
  };
}

/**
 * Read-only state access for E2E tests (docs/04-architecture.md §6).
 * Scaffolding only in C2: the game state machine (D5) and the other modules
 * provide the real values; until then every hook reports "not wired yet".
 */
export interface GameTestHooks {
  readonly state: string | null;
  readonly roundId: string | null;
  readonly foundWords: readonly string[];
  readonly score: number;
  readonly remainingMs: number;
  readonly lastAudioEvent: string | null;
}

declare global {
  interface Window {
    __game: GameTestHooks;
  }
}

const gameTestHooks: GameTestHooks = Object.freeze({
  get state(): string | null {
    return null;
  },
  get roundId(): string | null {
    return null;
  },
  get foundWords(): readonly string[] {
    return [];
  },
  get score(): number {
    return 0;
  },
  get remainingMs(): number {
    return 0;
  },
  get lastAudioEvent(): string | null {
    return null;
  },
});

window.__game = gameTestHooks;
