# TASK Y3 — Karıştır/Sil Hit-Area Swap Fix (owner defect, wave Y)

- Workstream: Y (owner presentation wave)
- Parallel group: Y (serialized LAST — shared runtime; avoids HMR interference with Y1/Y2 runs)
- Depends on: D5, X1, Y2
- Owned paths: `src/ui/hud.ts` (`CONTROL_RECTS` lookups only), `tests/hud-controls.test.ts`, `tests/e2e/controls/**`, `evidence/Y3-*`, `evidence/logs/Y3-*`

## Inputs (owner-verified, authoritative)
- `artifacts/decompiled/scripts/DefineButton2_63/BUTTONCONDACTION on(release).as` → `karistir();` (sprite 63 = kbuton, x=156.25 — the "Karıştır" label)
- `artifacts/decompiled/scripts/DefineButton2_65/BUTTONCONDACTION on(release).as` → `ekle();` (sprite 65 = ebuton, x=232.85 — "Ekle")
- `artifacts/decompiled/scripts/DefineButton2_105/BUTTONCONDACTION on(release).as` → `sil();` (sprite 105 = sbuton, x=308.6 — "Sil")
- `evidence/A3-diffs.md` rows for 63/65/105 (instance names + positions)
- Current `src/ui/hud.ts` `CONTROL_RECTS`: `scramble → btn_sbuton`, `delete → btn_kbuton` (**swapped**); `submit → btn_ebuton` is correct

## Steps
1. Swap the two lookups: `scramble → btn_kbuton`, `delete → btn_sbuton` (submit unchanged); add `// evidence:` comments citing the BUTTONCONDACTION files + `evidence/A3-diffs.md`.
2. Regression tests:
   a) `tests/hud-controls.test.ts` — assert each control's rectangle equals the catalog bbox of the element whose reference action matches (scramble=btn_kbuton, delete=btn_sbuton, submit=btn_ebuton). Use a pure, exported rect source so the check runs without a DOM environment.
   b) `tests/e2e/controls/**` — click at the CENTER of the visible label bbox in scaled stage coordinates (NOT the testid): `btn_kbuton` → scramble (`window.__game.lastAudioEvent === 'scramble'`, deck order changes), `btn_sbuton` → delete (entry letter removed). Spot-check keyboard SPACE/ENTER/BACKSPACE unaffected.
3. Evidence: record the pre-fix failure and the post-fix pass; add a superseding note for the wrong mapping recorded in `evidence/D5-lifecycle.md` (~line 164) — do not rewrite D5's file; hashes.
4. This task is part of the wave's closing verification (G4 checks + full `tools/verify-all.sh` together with Y1/Y2).

## Unknowns
- None.

## Verify
- `npm test -- hud` (or the suite filter matching `tests/hud-controls.test.ts`) passes; `npm run e2e -- controls` passes.
- Full `npm test`, `npm run lint`, `npm run build` green; visual/playthrough/interaction unaffected.

## Evidence
- `evidence/Y3-buttons.md` (pre/post runs, mapping table, D5 superseding note, hashes)
- `evidence/logs/Y3-*`

## Done
- Verify passes; committed as `task: Y3 karıştır/sil hit-area fix`.
