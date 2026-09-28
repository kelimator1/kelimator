# 05 — Game Core

Module contracts and behavior rules for the playable core. Behavior comes from
`docs/02-mechanics-spec.md`; this document defines **how** it is implemented.
No value in this document overrides the mechanics spec.

---

## 1. Module contracts

| Module | Responsibility | Inputs | Outputs / Events |
|---|---|---|---|
| `state.ts` | Finite state machine | transitions from lifecycle/input | `stateChanged(state)` |
| `round.ts` | Load + validate one round from `rounds.json` | `rounds.json`, `data/rounds.schema.json` | `Round` object |
| `tiles.ts` | Deck of 8 tiles; per-tile availability; shuffle order | round letters; input events | tile state; `deckChanged` |
| `input.ts` | Keyboard + pointer; entry buffer | key events, tile clicks | `entryChanged`, `submit`, `delete`, `scramble` |
| `scoring.ts` | Score, bonus, time bonus | constants; submit events | `scoreChanged` |
| `timer.ts` | Countdown | constants (initial, tick) | `tick(remaining)`, `expired` |
| `lifecycle.ts` | Round start/end orchestration; completion sequence | events from core + timer | `roundStarted`, `roundCompleted(reason)` |
| `audio.ts` | Maps game events to sounds via `sound-map.json` | events; volume | `lastAudioEvent` (test hook) |
| `hud.ts` | Score, timer, counters, found list | state changes | DOM updates |

Rules:
- Modules never read `data/constants.json` directly; the app loads it once at
  bootstrap and passes typed values.
- Every constant in code carries `// evidence:` (V7 enforces).

## 2. Round model

```ts
type Round = {
  id: string;              // stable slug of the main word
  main: string;            // 8-letter word (display form)
  letters: string[8];      // multiset of main word letters (display form)
  bonusLetter: string | null; // set at round start per O02 resolution
  words: Record<3|4|5|6|7, string[]>; // display forms, sorted
};
```

- Validation: schema check at load (dev build hard-fails; prod build logs and
  picks the next valid round — but in this project all rounds validate at G2).
- Word comparison is exact-match on display forms (Turkish casing per `docs/06`).

## 3. Input rules

- Clicking a tile appends its letter (if available).
- Typing a letter: appends the tile instance with that letter (duplicate
  handling per O15).
- SPACE → scramble; ENTER → submit; BACKSPACE → remove last.
- During the completion sequence, input is locked (state machine enforces).
- Key handling uses `event.key`; mapping table (including Turkish letters)
  recorded from A2 findings on the original (O04).

> Amendment 2026-09-28 (orchestrator): browser key resolution is
> `KeyboardEvent.keyCode`-primary (O04's numeric table 65…Ç 220…Ü 221) with
> `event.key` (Turkish-locale uppercase) and `event.code` (`Key[A-Z]`)
> fallbacks; `event.key` alone cannot distinguish `I`/`İ` (evidence:
> `evidence/D2-input.md` §6.2). Matching entry in `docs/08-open-items.md`
> (Amendments).

> Amendment 2026-09-28d (orchestrator): clicking anywhere on a tile enters its
> letter, including the glyph itself — the runtime letter field is
> pointer-events-transparent and the single click delegation matches only
> `buttonN` (`src/main.ts`); defect fix X1, `evidence/X1-tile-click.md` §2.
> Matching entry in `docs/08-open-items.md` (Amendments).

## 4. Scoring implementation

- Valid word: `n² × perLetterSquaredFactor`.
- If word contains `bonusLetter` (case-normalized): add `bonusPoints` once.
- Word already found: behavior per O15.
- Round end: add `remainingSeconds × timeFactor` (integer seconds).
- All arithmetic on integers; display formatting matches reference (A3).

## 5. Timer

- Countdown from `initialSeconds`, tick `tickMs` (values from O01).
- Expiry → `roundCompleted('timeout')`. Completion sequence semantics per O14.
- Timer display format matches reference (A3 text catalog).

## 6. Round lifecycle

1. `newRound()`: pick next round (sequential order from `rounds.json`; no
   random selection to keep playthroughs deterministic for tests), set bonus
   letter, reset entry/score/found; start timer.
2. `submit`: validate, score, update found list, play mapped sounds.
3. All words found → completion sequence (`hepsiburda` → `bravo` per O13);
   apply time bonus; input locked; "new round" affordance according to the
   reference flow.
4. Timeout → completion sequence without celebration (reference behavior per
   O13/O14).

## 7. Edge cases (must be resolved by A2 before implementation)

| Case | Resolution |
|---|---|
| Duplicate-letter words (e.g., İİ) | O15 |
| Re-submitting found word | O15 |
| Backspace with empty entry | O15 |
| Scramble with partial entry | O15 |
| Timer expiry mid-entry | O14 |
| All-found triggered by last word | O13 |
| Key input for letters not in the deck | O04/O15 |

## 8. Test hooks

- `window.__game` getters: `state`, `roundId`, `foundCount`, `score`,
  `remainingMs`, `lastAudioEvent`.
- `data-testid` on all interactive elements (`tile-0..7`, `entry`, `submit`,
  `scramble`, `delete`, `new-round`, `score`, `timer`, `found-list`).
- Determinism: round order is sequential; E2E uses fixture rounds so expected
  scores are computable from the mechanics spec.

## 9. Open questions

See `docs/08-open-items.md` — items O01, O02, O04, O05, O13, O14, O15.
