# TASK X1 — Tile Center Click Fix (owner defect 1)

- Workstream: X (owner defect wave)
- Parallel group: X
- Depends on: E2, D5 (completed)
- Owned paths: `src/ui/board.ts` (tile letter label only), `tests/e2e/interaction/**`, `evidence/X1-*`, `evidence/logs/X1-*`

## Inputs
- `src/ui/board.ts` (letter `<span class="board-text" data-element="letterN">` sits above the tile SVG `data-element="buttonN"`), `src/main.ts` (read-only: click delegation accepts only `/^button(\d+)$/` from `closest('[data-element]')`)
- `evidence/A2-edges.md` (O15 behavior: duplicates, re-submit, backspace, scramble), `evidence/E2-layout.md`, `evidence/D5-lifecycle.md`

## Steps
1. Fix center clicks with exactly ONE delegation path: make letter labels transparent to pointer events (`pointer-events: none` on the tile letter labels) so clicks land on the `buttonN` node — or equivalently map `letterN → buttonN` in the handler; document the chosen mechanism.
2. New e2e suite under `tests/e2e/interaction/`: clicking the CENTER of a tile appends its letter at dsf 1 AND dsf 2; edge behavior (duplicate-letter use, delete, scramble, re-submit) still matches O15 evidence.
3. Keep the E2 visual states and D5 playthrough behavior green (run them).

## Unknowns
- None.

## Verify
- `npm run e2e -- interaction` passes (center-click tests at both deviceScaleFactors + edge checks).
- Full `npm test`, `npm run lint`, `npm run build` green; `npm run e2e -- visual` and `npm run e2e -- playthrough:basic` unchanged/green.

## Evidence
- `evidence/X1-tile-click.md` (root cause, fix mechanism, test output, before/after behavior)
- `evidence/logs/X1-*.log`

## Done
- Verify passes; committed as `task: X1 tile center click fix`.
