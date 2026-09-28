// src/main.ts — bootstrap (docs/04-architecture.md §4).
// This task (C2) mounts the stage shell only; gameplay state arrives with
// D1–D5 and must replace the placeholder hooks below.
import { mountStage } from './stage';

mountStage();

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
