# TASK X2 — Tile Template Glyph Removal (owner defect 2)

- Workstream: X (owner defect wave)
- Parallel group: X
- Depends on: E1 (completed)
- Owned paths: `tools/process-assets.mjs`, `src/assets/svg/s58_letter_tile.svg`, `src/assets/manifest.json`, `tests/assets.test.mjs`, `evidence/X2-*`, `evidence/visual/E1-svgo/**` (refresh for this asset), `evidence/logs/X2-*`

## Inputs
- `src/assets/svg/s58_letter_tile.svg` (currently embeds the authoring-time black "A" glyph from the FLA text field), source `artifacts/decompiled/shapes/58.svg`, `tools/process-assets.mjs`
- `evidence/E1-assets.md` (§4 SVG processing, §11 caveats), `verify/diff/README.md` (F1 tool, tolerant metric), `evidence/E2-layout.md` §6 (rasterization basis), C3 references `tests/fixtures/reference/S*.png`

## Steps
1. In the asset pipeline (`tools/process-assets.mjs`), remove the baked placeholder glyph from the tile template deterministically; every other tile pixel/geometry stays identical (record the exact removed element/paths).
2. Record before/after SHA-256 for source export, processed SVG and manifest entry; update `src/assets/manifest.json` and any hash checks that reference the old file.
3. Refresh the SVGO before/after preservation evidence for this asset (Playwright render check, muted).
4. Re-run S2–S7 app-vs-reference pixel pairs with F1's tool; record raw AND tolerant ratios per state (raw tile-area improvement expected; thresholds unchanged).
5. Add a regression guard: a structural check in `tests/assets.test.mjs` that the tile template carries no baked glyph (documented, deterministic; demonstrate it fails when the glyph is reintroduced — deliberate probe recorded, not committed). Do not loosen any threshold.

## Unknowns
- None.

## Verify
- `npm test -- assets` passes, including the new guard.
- `npm run e2e -- visual` green (existing thresholds).
- Manifest/hash checks green; SVGO preservation diff 0 for the refreshed asset.
- Full `npm test`, `npm run lint`, `npm run build` green.

## Evidence
- `evidence/X2-tile-glyph.md` (removal method, before/after hashes, S2–S7 raw+tolerant table, guard description + deliberate-probe result)
- `evidence/logs/X2-*.log`

## Done
- Verify passes; committed as `task: X2 tile template glyph removal`.
