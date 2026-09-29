# TASK Y4 — Speaker Knob Alpha Restore (owner defect from Y1)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (single task)
- Depends on: Y1 (HD remaster), Y2 (rect mechanics)
- Owned paths: `tools/process-assets.mjs` (HD_REMASTERS pin for bitmap 86), `src/assets/svg/s90_btn_speaker.svg`, `src/assets/manifest.json`, `tests/e2e/speaker/**`, `tests/e2e/visual-states.ts` (`Y1_IGNORE_RECTS` only, if the rect changes), `tests/e2e/visual.spec.ts` / `tests/e2e/animations/**` / `tests/e2e/playthrough/**` (only if rect wiring changes), `tests/assets.test.mjs`, `evidence/visual/Y1/derivation/final-rects.json` (consistency mirror), `evidence/visual/E1-svgo/s90_btn_speaker/**` (refresh), `evidence/Y4-*`, `evidence/visual/Y4/**`, `evidence/logs/Y4-*`

## Defect (owner-investigated, byte-verified)
- `artifacts/decompiled/images/86.png`: RGBA, transparent corners.
- `artifacts/hd-assets/ai86-8x.png`: RGBA, corners transparent (`8012f3d3…a13ce04`).
- The WebP embedded by Y1 in `s90_btn_speaker.svg` is **RGB** — alpha lost in the preview conversion → opaque black box behind the megaphone in the app.
- FIX ASSET staged: `artifacts/hd-assets/ai86-8x-alpha.webp` — RGBA, corners transparent, 8.9 KB, sha256 `a5a840abdca472e96d07325b7b6281ad1b0ee22e13700dc64a377bc13da29c45`.
- Note for the record: the Y1 allowance rect masked this visually (record the line in evidence).

## Steps
1. Replace the embedded payload in `src/assets/svg/s90_btn_speaker.svg` with `ai86-8x-alpha.webp` (deterministic pin in `tools/process-assets.mjs` `HD_REMASTERS`; re-run the pipeline); update `src/assets/manifest.json` hashes/source.
2. Audit the same bug class: only s48 (bitmap 47) and s90 embed rasters — confirm bitmap 47 is opaque by design (source has no alpha) and needs no change; record the audit.
3. Verify: speaker suite (3) + visual suite (18) green. Add a rendered-corner assertion (screenshot/decoded-pixel check or the speaker suite): the knob's surrounding pixels must NOT be opaque black, at dsf 1 AND 2. Re-measure the Y1 knob allowance rect `515,367,22,30`: can it shrink or drop? If the rect set changes, update `Y1_IGNORE_RECTS` (visual-states.ts) and the derivation mirror (`evidence/visual/Y1/derivation/final-rects.json`) consistently; re-run the affected suites.
4. Evidence: before/after crop of the knob region (dsf1+dsf2), audit result, rect re-measurement table, the allowance-masked-it note; hashes.

## Unknowns
- None.

## Verify
- Speaker suite green incl. the new corner assertion (dsf1+dsf2); `npm run e2e -- visual` 18/18 (with any updated rects); full `npm test`, `npm run lint`, `npm run build` green; pipeline idempotent.
- Closing: run the G4 quick checks + full `tools/verify-all.sh` (orchestrator).

## Evidence
- `evidence/Y4-knob-alpha.md` + `evidence/visual/Y4/**` + `evidence/logs/Y4-*`.

## Done
- Verify passes; committed as `task: Y4 knob alpha restore`; docs line proposed (if the allowance changed).
