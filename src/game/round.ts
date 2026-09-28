// src/game/round.ts — round model + loader (validates rounds.json) (docs/04-architecture.md §4). Stub: owned by task D1.
// Round model per docs/05-game-core.md §2 (exported interface only; no behavior).
export type Round = {
  id: string; // stable slug of the main word
  main: string; // 8-letter word (display form)
  letters: string[8]; // multiset of main word letters (display form)
  bonusLetter: string | null; // set at round start per O02 resolution
  words: Record<3 | 4 | 5 | 6 | 7, string[]>; // display forms, sorted
};
