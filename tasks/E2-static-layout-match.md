# TASK E2 — Static Layout Match

- Workstream: E (visuals)
- Parallel group: 5
- Depends on: E1
- Owned paths: `src/ui/board.ts` (layout rendering), `src/styles/**`, `evidence/E2-*`, `evidence/visual/E2-*`

> Amendment 2026-09-28 (orchestrator): Owned paths additionally include
> `tests/e2e/**` (the visual suite required by `npm run e2e -- visual`) and
> `src/main.ts` bootstrap wiring for the board mount only (the stage-shell
> wiring from C2 must stay intact). Reference fixtures at
> `deviceScaleFactor: 2` are produced by C3 under
> `tests/fixtures/reference/dsf2/` — do not capture your own reference.
> Silent witness runs apply (`EXECUTION.md` §8). Recorded in
> `docs/08-open-items.md` (Amendments).

## Inputs
- `src/data/layout.json` (E1)
- `tests/fixtures/reference/*.png` (C3)
- `docs/03-assets-and-visuals.md` §4; `docs/07-verification.md` §3–§4

## Steps
1. Render every element from `layout.json` at its exact stage coordinates with
   its exact style values (position, size, colors, typography).
2. Anti-aliasing/text-rendering: adjust only font size/leading/letter-spacing
   as numeric style values until the thresholds pass; every adjustment is
   recorded with its before/after diff ratio in evidence.
3. Run the pixel-diff comparison for static states S1–S7 and S10 (from
   `docs/07` §5) against the reference screenshots:
   - diff tool from F1 (`verify/diff/`)
   - pass criteria: mismatched ratio ≤ 2.0% per the threshold definition.
4. For each failing state: locate regions via the diff heatmap, fix the layout
   value (never the threshold), re-run, record the iteration result.

## Unknowns
- All layout-affecting items (O05/O08/O18) must be RESOLVED before start.

## Verify
- V5: `npm run e2e -- visual` passes for S1–S7 and S10 at both
  `deviceScaleFactor` 1 and 2 (recorded report per state).
- V2: every diff report has a numeric mismatch ratio and a heatmap artifact.
- V7: rendered style values equal `src/data/layout.json` values (test compares
  key element styles).

## Evidence
- `evidence/E2-layout.md` (iteration log: change → diff ratio)
- `evidence/visual/E2/<state>/diff-*.png` + `report.json`
- `evidence/logs/E2-*.log`

## Done
- Verify passes; committed.
