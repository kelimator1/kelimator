# TASK Y6 — Top10 Button Omission (owner directive)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (single task)
- Depends on: Y2 (credit-omission mechanisms to mirror), E2/D5
- Owned paths: `src/ui/board.ts` (`OMITTED_ELEMENTS` + evidence comment), `tests/e2e/visual-states.ts` (`BOARD_ELEMENTS` + Top10 region helper), `tests/e2e/visual.spec.ts` (absence assertions + region wiring), `tests/e2e/animations/**` / `tests/e2e/playthrough/**` (only if region wiring needs it), `evidence/Y6-*`, `evidence/visual/Y6/**`, `evidence/logs/Y6-*`

## Context and inputs
- README §2.2 excludes Top10 (hiscore/network). Reference action: `artifacts/decompiled/scripts/DefineButton2_108/"BUTTONCONDACTION on(release).as"` (javascript `openWin` to `top10.php`). Owner directive: remove it from the build, mirroring the Y2 credit-omission pattern exactly.
- Element facts: id `btn_top10`, ch 108, depth 44, asset `src/assets/svg/s108_btn_top10.svg`, stage bbox (419.8, 372.95)–(509.25, 394.65).
- Y2 machinery to mirror: `OMITTED_ELEMENTS` skip-before-DOM in `src/ui/board.ts`; `Y2_CREDIT_IGNORE_RECT` helper + wiring in `tests/e2e/visual-states.ts`; the "Y2 credit omission" describe in `tests/e2e/visual.spec.ts`; derivation style in `evidence/Y2-credits.md`.
- Verified census (2026-09-29): renderer/test references are `src/ui/board.ts` (OMITTED set), `tests/e2e/visual-states.ts` (BOARD_ELEMENTS line 27); no `src/main.ts`/`src/ui/hud.ts` references. Data/provenance files exist and stay untouched.

## Steps
1. `src/ui/board.ts`: add `'btn_top10'` to `OMITTED_ELEMENTS` with an evidence comment (reference action + owner directive; same style as the Y2 note).
2. `tests/e2e/visual-states.ts`: remove `'btn_top10'` from `BOARD_ELEMENTS`; add a Top10-omission region helper mirroring `Y2_CREDIT_*` — start from the stage rect `419,372,91,23` and DERIVE it precisely like Y2 did: measure the union raw-deviation bbox at dsf 1 and dsf 2 with the F1 tool (app-after vs the reference capture) and record the derivation numbers.
3. `tests/e2e/visual.spec.ts`: assert `[data-element="btn_top10"]` count 0 (default render + explicit-view render, mirroring the Y2 describe); wire the new region into the comparisons exactly like the Y2 region.
4. Grep for any other `btn_top10` usages (e.g. `V7_SAMPLE`) and clean them consistently.
5. Keep `data/layout.json`, `src/data/layout.json`, `src/data/animation.json`, `src/assets/manifest.json` and the s108 asset exactly as-is (provenance); prove with a grep that no runtime reference remains.
6. Evidence `evidence/Y6-top10.md`: derivation numbers, before/after crop of the region (`evidence/visual/Y6/**`), grep proof, suite results, proposed docs lines (`docs/07` §4 region + `docs/08`), and the "renderer-level omission only" statement.

## Unknowns
- None.

## Verify
- Absence assertions pass; `npm run e2e -- visual` stays **18**; animation/playthrough unaffected; full `npm test`, `npm run lint`, `npm run build` green.
- Closing: `tools/verify-all.sh` exit 0 (orchestrator).

## Evidence
- `evidence/Y6-top10.md` + `evidence/visual/Y6/**` + logs `evidence/logs/Y6-*`.

## Done
- Verify passes; committed as `task: Y6 Top10 omission`.
