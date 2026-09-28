# TASK X4 — Timeout Reveal Colour (found by F2)

- Workstream: X (owner defect wave extension)
- Parallel group: X
- Depends on: D5, E2; diagnosis by F2
- Owned paths: `src/ui/board.ts` (revealed slot styling), `src/main.ts` (reveal-flag wiring only), `tests/e2e/timeout/**`, `evidence/X4-*`, `evidence/logs/X4-*`

## Inputs
- `evidence/F2-playthrough.md` §7.1 — diagnosis: reference `tamamla()` (`artifacts/decompiled/scripts/frame_131/DoAction.as` L568–570) sets revealed words `#ff6600`; the rebuild renders them `#000` (`src/ui/board.ts` `.board-slot`) and `src/main.ts` drops the `revealed` flag; ≈2 337 tolerant px, S9 tolerant 2.0145 % > 2.000 % (≈0.95 % without it)
- `evidence/A2-timeout.md` (O14: on timeout the unfound listed words are revealed), `src/ui/board.ts`, `src/main.ts`, `verify/diff/README.md` (F1 tool)

## Steps
1. Wire the `revealed` flag from the lifecycle through `src/main.ts` into `src/ui/board.ts` slot rendering; revealed (unfound at timeout) words render `#ff6600` per the excerpt; non-revealed slots unchanged.
2. Focused test under `tests/e2e/timeout/**` (or a unit test if the board exposes a testable render path — do not invent hooks; if a real 200 s wait is prohibitive for the focused test, document the narrowest evidenced alternative): assert revealed words render `#ff6600` and non-revealed are unaffected.
3. Re-run F2's suite (`npm run e2e -- playthrough`) and confirm the S9 variant now passes; record the new tolerant ratio.

## Unknowns
- None.

## Verify
- Focused test passes; `npm run e2e -- playthrough` green (S9 ≤ 2.000 %).
- Full `npm test`, `npm run lint`, `npm run build` green.

## Evidence
- `evidence/X4-reveal-colour.md` (excerpt refs, change, tests, new S9 ratio)
- `evidence/logs/X4-*.log`

## Done
- Verify passes; committed as `task: X4 timeout reveal colour`; F2 re-run confirmatory.
