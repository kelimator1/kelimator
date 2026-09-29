# TASK Y1 — HD Asset Remaster (owner final wave; owner Task A)

- Workstream: Y (owner presentation wave)
- Parallel group: Y (serialized with Y2 — shared files)
- Depends on: E1, E2, E3, F2 (completed)
- Owned paths: `tools/process-assets.mjs`, `src/assets/svg/s48_board_backdrop.svg`, `src/assets/svg/s90_btn_speaker.svg`, `src/assets/manifest.json`, `src/ui/board.ts` (the two inline `<image>` elements' rendering only), `verify/diff/diff.mjs` + `verify/diff/diff.test.mjs` (opt-in `--ignore-rect`), `tests/e2e/visual.spec.ts`, `tests/e2e/visual-states.ts` (wiring only, if needed), `tests/e2e/animations/**`, `tests/e2e/playthrough/**`, `tests/e2e/speaker/**` (O25 re-check), `tests/assets.test.mjs`, `evidence/Y1-*`, `evidence/visual/Y1-*`, `evidence/visual/E1-svgo/**` (refresh for the two SVGs), `evidence/logs/Y1-*`

## Inputs (hash-pinned; verify before use)
- `artifacts/hd-assets/ai47-x4plus-8x.webp` — `58ac94a053dc3133bde957c15f4b23d03e6b1a0cdc4de0d8ba89e65c63cb958e` (preferred backdrop remaster; PNG master `efeaffcb…`)
- `artifacts/hd-assets/ai47-x4plus-4x.webp` — `888280e4484ae09b6a9a45fc37482e1afa5512092c2fdf62489da0512fb97662` (fallback ONLY if the 8x pass shows artifacts; decide from measured evidence, record)
- `artifacts/hd-assets/ai86-8x.webp` — `490794263c69e920a8f061088c33dff5d63cc5f47f8937727cb15163273dfa2f` (speaker knob remaster)
- Current `src/assets/svg/s48_board_backdrop.svg` (bitmap 47 embedded), `s90_btn_speaker.svg` (bitmap 86 embedded); `src/assets/manifest.json`
- Precedents: `evidence/X2-tile-glyph.md` (asset-pipeline modification + guard discipline), `evidence/E1-assets.md` (§4 SVG processing, §11 caveats), `verify/diff/README.md`, `evidence/E3-animations.md`/`evidence/F2-playthrough.md` (comparison suites)

## Steps
1. Verify the three input hashes; select 8x (or the 4x fallback with recorded artifact evidence).
2. In `tools/process-assets.mjs`, embed the WebP payloads into the two SVGs **deterministically** (hash-pinned inputs; when inputs are absent, keep the committed payload unchanged and log the skip — idempotent either way). Update `src/assets/manifest.json` (hashes; source = `artifacts/hd-assets/<file>` + sha256) and any hash checks.
3. `src/ui/board.ts`: switch those two inline `<image>` elements from `image-rendering: pixelated` to `smooth` (owner-approved deviation; `// evidence:` comment). Change nothing else.
4. `verify/diff/diff.mjs`: add an opt-in, repeatable `--ignore-rect x,y,w,h`; pixels inside are excluded from mismatch counting and reported (`ignoredRects`, `ignoredPixels`); raw/tolerant fields unchanged otherwise. README + tests: same-image with a rect → 0; a mutation inside the rect → invisible; a mutation outside → detected; determinism unchanged.
5. V5 allowance (docs/07 §4, owner-approved): derive the smallest rect set that covers the backdrop-visible mismatch areas — backdrop pixels NOT covered by overlaid UI elements — plus the speaker-knob rect from its bbox; NO blanket stage ignore; record the derivation (heatmaps + element coverage) in evidence. Wire the rects into the visual/animation/playthrough comparison calls; iterate until those suites are green.
6. Evidence: before/after captures at dsf 1 + 2 (550×400 / 1100×800) and one large-window capture; asset + artifact SHA-256s; the exact ignore-rect lists and rationale; SVGO/render preservation for the two SVGs.
7. O25 re-check: re-measure the knob region vs the reference capture with the new smooth HD knob; record whether O25 is resolved or superseded by the approved remaster allowance.

## Unknowns
- None blocking; the 8x-vs-4x choice is evidence-based.

## Verify
- `npm test` (incl. diff-tool and assets tests), `npm run lint`, `npm run build` green.
- `npm run e2e -- visual`, `-- animation`, `-- playthrough`, `-- speaker` green on the documented allowances.
- New evidence captures exist at the stated dimensions; hashes recorded.

## Evidence
- `evidence/Y1-remaster.md` + `evidence/visual/Y1/**` + `evidence/logs/Y1-*`; proposed docs lines for `docs/07` §4 and `docs/03` §2.

## Done
- Verify passes; committed as `task: Y1 HD asset remaster`; docs amendments applied by the orchestrator.
