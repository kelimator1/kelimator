# TASK D2 — Input and Tiles

- Workstream: D (core)
- Parallel group: 4
- Depends on: D1
- Owned paths: `src/game/tiles.ts`, `src/game/input.ts`, `tests/input.test.ts`, `evidence/D2-*`

## Inputs
- `docs/05-game-core.md` §3, §7
- `docs/02-mechanics-spec.md` §2 (edge rules from O15)
- `data/constants.json` (key map, per O04)

## Steps
1. Implement `tiles.ts`: deck of 8 tile instances (duplicate-aware), per-tile
   availability states, and the shuffle order operation.
2. Implement `input.ts` with the exact key mapping from `data/constants.json`
   (resolved by O04): letters, SPACE (scramble), ENTER (submit), BACKSPACE
   (delete). Pointer clicks on tiles append the tile's letter.
3. Implement the edge-case rules exactly as resolved by O15: duplicate-letter
   use, re-submission, backspace on empty, scramble with partial entry, letters
   not in the deck. Each rule carries `// evidence:` referencing the O15
   resolution.
4. Unit tests covering: every edge case; key mapping incl. Turkish letters;
   deck availability accounting with duplicates; shuffle is a permutation
   (multiset equality) and is deterministic under the recorded seed.

## Unknowns
- O04 and O15 must be RESOLVED (by A2) before start; otherwise do not start.

## Verify
- V4: `npm test -- input` passes; every edge-case test annotated with its O15
  rule ID.
- V7: key names in code match `data/constants.json` exactly (test asserts).
- V2: shuffle test proves multiset equality and deterministic output for the
  recorded seed (assertions present).

## Evidence
- `evidence/D2-input.md` (rule IDs exercised, test summary)
- `evidence/logs/D2-*.log`

## Done
- Verify passes; committed.
