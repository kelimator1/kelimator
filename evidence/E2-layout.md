# E2 — Static Layout Match (evidence)

Task: E2 — Static Layout Match
Started: 2026-09-28T15:17:00Z (first E2 command, `npm run build > evidence/logs/E2-build-1.log 2>&1`)
Ended: 2026-09-28T17:55:00Z (final evidence write; last commands `npm run e2e -- visual`, `npm test`, `npm run lint`, `npm run build`)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact): §2 (all raw output in `evidence/logs/E2-*.log`)
Exit codes: see §2 — `npm run e2e -- visual` **0** (17 passed: 16 V5 comparisons on
the amended tolerant basis + V7); `npm test` 0 (58/58), `npm run lint` 0,
`npm run build` 0.
Output summary: `src/ui/board.ts` (catalog renderer + runtime duplicates),
`src/main.ts` (board mount + dev-only test hook), `tests/e2e/visual.spec.ts`
(V5/V2/V7 suite), `tests/e2e/visual-states.ts` (observed state fixtures),
16 × `evidence/visual/E2/<state>/dsf{1,2}/{actual.png,heatmap.png,report.json}`
(report schemaVersion 2).
Artifact SHA-256 hashes: §8
Result: PASS — final V5 verdict on the amended (anti-aliasing-tolerant) basis:
all 16 state/dsf pairs ≤ 2.0 % tolerant (min 0.015 % S1 dsf2, max 1.363 % S4
dsf1), raw ratios recorded unchanged (4.5–6.9 % board states). The pre-amendment
FAIL history (raw basis) is preserved in §3/§4/§6 and resolved in §11; the
threshold (2.0 %) was never changed. V2 and V7 pass; §6 records the raw-basis
blocker analysis that motivated the amendment.

---

## 1. Deliverables

| Deliverable | Location |
|---|---|
| Board renderer (catalog elements + runtime duplicates) | `src/ui/board.ts` |
| Board mount + dev-only visual-test hook | `src/main.ts` |
| Visual suite (V5 pixel diffs, V2 artifact checks, V7 cross-consistency) | `tests/e2e/visual.spec.ts` |
| Reference-observed state fixtures (TEST-ONLY) | `tests/e2e/visual-states.ts` |
| Per-state diff artifacts (report.json + heatmap.png + actual.png) | `evidence/visual/E2/<state>/dsf{1,2}/` |
| Raw command logs | `evidence/logs/E2-*.log` |

Rendering contract implemented in `src/ui/board.ts`:

- Every `src/data/layout.json` element renders at its catalog box (wrapper
  element carries `data-element="<id>"`, exact `left/top/width/height`), with
  SVG assets scaled uniformly to the catalog width (asset natural aspect;
  evidence/A3-layout.md §7.2 for the two credit sprites).
- Text typography per `font` metrics: Verdana stack, catalog size/bold/align;
  the six `label_*_{black,orange}` labels use the build's bold-italic face
  (font 126; evidence/A1-fonts.md §3). Glyph colors (orange `#ff6600`, black)
  are read from the C3 captures (the catalog schema has no color field).
- Runtime duplicates (test-only observed content) follow
  `artifacts/decompiled/scripts/frame_131/DoAction.as`:
  tiles/sockets `x = 60 + j*60, y = 330` (L99–104), entry balls
  `x = i*40 + (550 - t*40)/2 + 10, y = 263` (L379–396), found-word boxes from
  `tablociz()` (L232–269: rows 3..8 at x = 36/70/112/162/220/286, w =
  32/40/48/56/64/72, pitch 16, height 14), counters `b3..b8`, score `puan`,
  timer `sure=200`.
- Two asset-export deviations are recreated from reference-sampled profiles
  (recorded as measured deviations, §7): the intro glow (FFDec export loses
  the focal gradient) and the wordball ball (FFDec export has zero-opacity
  gradient stops; evidence/E1-assets.md §11.2 lists s46 blank).
- Numeric text tuning (allowed by task step 2) is a per-element table in
  `board.ts` (`TEXT_STYLE`: size/line-height/letter-spacing plus the Flash
  text-field inset as `text-indent`/`padding-right`); every value below is
  reproduced from the C3 captures. Elements with a tuned size/weight are
  marked `data-font-size-tuned` so V7 can distinguish catalog values from
  recorded tuning.

## 2. Commands executed (exact) and exit codes

All commands were run from the repository root; `> log 2>&1` writes the raw output shown.

| # | Command (exact) | Exit | Log |
|---|---|---|---|
| 1 | `npm run build > evidence/logs/E2-build-1.log 2>&1` | 0 | build 46 modules |
| 2 | `npm run lint > evidence/logs/E2-lint-1.log 2>&1` | 0 | first lint (board.ts) |
| 3 | `npm run e2e -- visual -g "deviceScaleFactor 1" --reporter=line > evidence/logs/E2-visual-iter1-dsf1.log 2>&1` | 1 | first run: `waitForBoard` bug (zero-size SVG assets never report `naturalWidth`), fixed in scope |
| 4 | `npm run e2e -- visual -g "deviceScaleFactor 1" --reporter=line > evidence/logs/E2-visual-iter2-dsf1.log 2>&1` | 1 | first complete dsf1 diff (§4 iter 1) |
| 5 | `npm run build > evidence/logs/E2-build-2.log 2>&1` | 0 | after text colors/aspect fixes |
| 6 | `npm run e2e -- visual -g "deviceScaleFactor 1" --reporter=line > evidence/logs/E2-visual-iter3-dsf1.log 2>&1` | 1 | iter 2 |
| 7 | `npm run e2e -- visual -g "S1-boot\|S2-idle\|S4-partial" --reporter=line > evidence/logs/E2-visual-iter4.log 2>&1` | 1 | iter 3 (+ first dsf2 numbers) |
| 8 | `npm run e2e -- visual -g "S2-idle\|S7-bonus" --reporter=line > evidence/logs/E2-visual-iter5.log 2>&1` | 1 | iter 4 |
| 9 | `npm run e2e -- visual -g "S2-idle" --reporter=line > evidence/logs/E2-visual-iter6.log 2>&1` | 1 | iter 5 |
| 10 | `npm run e2e -- visual -g "S2-idle" --reporter=line > evidence/logs/E2-visual-iter7.log 2>&1` | 1 | iter 6 |
| 11 | `npm run e2e -- visual --reporter=line > evidence/logs/E2-visual-iter8.log 2>&1` | 1 | iter 7 (regression; deltas via `translate` resample the SVG) |
| 12 | `npm run e2e -- visual -g "S2-idle" --reporter=line > evidence/logs/E2-visual-iter9.log 2>&1` | 1 | iter 8 |
| 13 | `npm run e2e -- visual -g "S2-idle" --reporter=line > evidence/logs/E2-visual-iter10.log 2>&1` | 1 | iter 9 |
| 14 | `npm run e2e -- visual -g "S2-idle" --reporter=line > evidence/logs/E2-visual-iter11.log 2>&1` | 1 | iter 10 |
| 15 | `npm run build > evidence/logs/E2-build-5.log 2>&1` / `...-build-6.log` / `...-build-7.log` / `...-build-8.log` | 0 | inline-SVG bitmap path, hairline frames, glow radius/stops |
| 16 | `npm run e2e -- visual -g "S2-idle\|S4-partial" --reporter=line > evidence/logs/E2-visual-iter12.log 2>&1` | 1 | iter 10 |
| 17 | `npm run e2e -- visual -g "S2-idle" --reporter=line > evidence/logs/E2-visual-iter13.log 2>&1` | 1 | iter 11 |
| 18 | `npm run e2e -- visual -g "S1-boot" --reporter=line > evidence/logs/E2-visual-iter14.log 2>&1` | 1 | iter 12 |
| 19 | `npm run e2e -- visual -g "S1-boot" --reporter=line > evidence/logs/E2-visual-iter15.log 2>&1` | 1 | iter 13 |
| 20 | `npm run e2e -- visual -g "S1-boot" --reporter=line > evidence/logs/E2-visual-iter16.log 2>&1` | 0 | iter 14 — S1 passes |
| 21 | `npm run e2e -- visual --reporter=line > evidence/logs/E2-visual-final.log 2>&1` | 1 | **final V5 run, all 16 comparisons recorded** |
| 22 | `npm test > evidence/logs/E2-test-final.log 2>&1` | 0 | Vitest 5 files / 58 tests |
| 23 | `npm run lint > evidence/logs/E2-lint-final.log 2>&1` | 0 | ESLint clean |
| 24 | `npm run build > evidence/logs/E2-build-final.log 2>&1` | 0 | tsc + Vite build |
| 25 | `npm run e2e -- smoke --reporter=line > evidence/logs/E2-smoke-check.log 2>&1` | 0 | C2 stage-shell smoke still passes with the board mounted (7/7) |
| 26 | `npm run e2e -- visual --reporter=line > evidence/logs/E2-visual-tolerant.log 2>&1` | 0 | **post-amendment final V5 run**: 17 passed (16 tolerant comparisons + V7); report schemaVersion 2 |

The F1 diff tool is invoked inside the suite per state/dsf exactly as
`node verify/diff/diff.mjs <actual.png> <reference.png> <outdir>`
(exit 0 in all 16 runs; verdict read from `report.json`).

## 3. Verification results

| Type | Command | Result |
|---|---|---|
| V5 | `npm run e2e -- visual` | **PASS (final)** — all 16 state/dsf comparisons pass the amended tolerant criterion (`tolerantMismatchRatio ≤ 0.02`, `tolerantRadius` 2; §11 and `evidence/logs/E2-visual-tolerant.log`). Pre-amendment history on the raw basis: S1 passed (1.848 % / 1.451 %), S2–S7/S10 exceeded 2.0 % raw; per-state `report.json` (v2) + `heatmap.png` recorded for every run |
| V2 | every diff report has `mismatchRatio` + `heatmap.png` | PASS — asserted in `tests/e2e/visual.spec.ts` for all 16 comparisons (48 artifacts present); the raw fields (`mismatchRatio`, `mismatchedPixels`, `mismatchBBox`, …) are still present and numeric alongside the tolerant ones |
| V7 | rendered boxes/styles vs `src/data/layout.json` | PASS — `tests/e2e/visual.spec.ts` “E2 V7 layout cross-consistency”: 16 sampled elements (board_backdrop, intro_logo, timer_bar, btn_ybuton, credit_line, status_ball, letter_tile, tile_socket, label_puan_orange, label_kelime_orange, label_sure_black, label_harf_3, count_3, timer_value, score_value, label_puan_black): boxes ±0.1 px, font family contains Verdana, weight/align per catalog, size = catalog or recorded tuning |
| V4 | `npm test` | PASS — 55/55 |
| — | `npm run lint` | PASS — exit 0 |
| — | `npm run build` | PASS — exit 0 |

## 4. Iteration log (change → diff ratio per state/dsf)

Ratios are the tool's raw `report.json.mismatchRatio` (%) — the monitored
metric; the amended pass basis (`tolerantMismatchRatio`) is tabulated in §11.
dsf1 unless noted. “—” = state not part of that run.

| Iter | Change (numeric/layout value only) | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S10 | log |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First complete dsf1 run: catalog elements + runtime duplicates, glyph colors missing, credit sprites letterboxed (`<img>` aspect), sockets drawn in all states, glow = raw SVG asset | 12.475 | 5.529 | 5.525 | 6.995 | 5.675 | 7.087 | 5.819 | 5.953 | `E2-visual-iter2-dsf1.log` |
| 2 | Text colors (`#ff6600` for the three `*_orange` labels); uniform-width asset scaling (credit letterboxing); per-element text tuning v1; timer overlays; sockets only in board states; intro glow from sampled profile | 3.846 | 4.937 | 4.933 | 6.431 | 5.082 | 6.540 | 5.211 | 5.308 | `E2-visual-iter3-dsf1.log` |
| 3 | Same + first dsf2 comparisons (dsf2 content not yet per-dsf) | 3.846 | 4.937 | — | 6.431 | — | — | — | — | `E2-visual-iter4.log` |
| 4 | Re-tuned 14 px bold-italic labels (14.5/0/20), score 14.5, timer 7.5 | — | 4.818 | — | — | — | — | 5.044 | — | `E2-visual-iter6.log` |
| 5 | Harf labels 8.6/−0.1/17 + `text-indent: 2px`; counts 7.5/−0.4/16 + `padding-right: 3px`; score 14/0/21 + 2 px; timer value 8/0/14 + z-index 50 (digits were covered by the gauge overlay); per-dsf state content | — | 4.615 | — | — | — | — | — | — | `E2-visual-iter7.log` |
| 6 | Sub-pixel deltas applied via CSS `translate` (tiles, letters, buttons, credits) — regression: translate resamples the SVG | 3.846 | 5.198 | 5.200 | 6.447 | 5.275 | 6.489 | 5.390 | 5.571 (dsf2 3.619/8.293/8.295/9.341/8.366/9.415/8.450/8.685) | `E2-visual-iter8.log` |
| 7 | Deltas via layout `left/top` (crisp), plus grid dy −0.25 / letter dx +0.25 | — | 5.482 | — | — | — | — | — | — | `E2-visual-iter9.log` |
| 8 | Revert grid/letter nudges (they were blur artefacts, not alignment) | — | 4.827 | — | — | — | — | — | — | `E2-visual-iter10.log` |
| 9 | Remove button deltas; keep credit sprites +0.25/−0.25 | — | 4.555 | — | — | — | — | — | — | `E2-visual-iter11.log` |
| 10 | Inline SVG for raster-bearing assets (`image-rendering: pixelated` at integer dpr ≥ 2); box frames as inset shadow | — | 4.526 | — | 5.914 | — | — | — | — | `E2-visual-iter12.log` (dsf2 S2 6.176, S4 7.272) |
| 11 | Found-word frames repainted as four background bands (borders/shadows are clamped/snapped at 0.5 px; bands land on the reference device pixels) | — | 4.526 | — | — | — | — | — | — | `E2-visual-iter13.log` (dsf2 S2 5.732) |
| 12 | Intro glow radius `closest-side` (default `farthest-corner` clipped the alpha fade at the sprite edge) | 3.203 | — | — | — | — | — | — | — | `E2-visual-iter14.log` (dsf2 S1 2.729) |
| 13 | Glow outer opacity stops refitted to the sampled reference profile (alpha 0.97/0.80/0.45 at 72/82/89 %) | 2.533 | — | — | — | — | — | — | — | `E2-visual-iter15.log` (dsf2 S1 2.005) |
| 14 | Falling logo +1 px x/y (measured best integer offset in the S1 capture: 3433 vs 4667 px in the logo box) | **1.848 ✓** | — | — | — | — | — | — | — | `E2-visual-iter16.log` (dsf2 S1 **1.451 ✓**) |
| **15** | **Final run (all 16)** | **1.848 ✓** | **4.526** | **4.527** | **5.914** | **4.615** | **5.949** | **4.745** | **4.899** | `E2-visual-final.log` |

Final dsf2 row: S1 **1.451 ✓**, S2 5.732, S3 5.734, S4 6.828, S5 5.818,
S6 6.913, S7 5.924, S10 6.124 (`E2-visual-final.log`).

Post-iteration leak check (numbers in §6): S2 dsf1 = 9 957 px mismatch
(4.526 %): tiles 2 866, right panel 2 991 (labels 1 240, `Kelime/Süre` 724,
timer bar 296, Puan 148, score 21), credits 1 505, buttons 1 403, speaker 466,
boxes 140, status 102, tray 88.

## 5. V2 artifact inventory (evidence/visual/E2)

16 directories, each with `actual.png`, `report.json` (schemaVersion 2: numeric
raw `mismatchRatio`/`mismatchedPixels`/`mismatchBBox` **and** the amended
`tolerantRadius`/`tolerantMismatchedPixels`/`tolerantMismatchRatio` fields plus
the `pass` verdict), `heatmap.png` (raw metric; 550×400 at dsf1, 1100×800 at
dsf2). All generated by `verify/diff/diff.mjs`; text logs in
`evidence/logs/E2-visual-*.log`.

## 6. Blocker analysis — the residual S2–S10 gap (no threshold touched)

S1 passes at both deviceScaleFactors, which shows the workflow works: two
systematic defects were found and fixed there (the intro glow’s CSS radius was
clipped by the element boundary — `closest-side` fixed 2 906 → 18 px mismatch;
the falling logo sat 1 px off — measured best integer offset fixed 4 667 →
3 433 px). For the board states the residual is not a layout defect; the
following measurements (raw analysis reproducible from the recorded
`actual.png`/`heatmap.png` pairs) isolate it:

1. **Geometry is correct.** On the board bitmap (≈55 % of the stage) our render
   equals the reference pixel-for-pixel at dsf1 at every sampled point (e.g.
   (100,100), (275,150), (500,300): RGB distance 0). All catalog boxes are
   within ±0.1 px (V7). Board panel, tray, counters, boxes, sockets, tile
   grid, buttons, credits and status all land on the reference coordinates;
   the heatmap shows 1–2 px yellow bands around every vector edge, not
   displaced blocks (84 % of mismatched pixels have ≥ 2 mismatched
   4-neighbours — edge-band signature).
2. **The reference itself is deterministic.** C3’s two reference runs differ by
   0.78 % on S2 and that difference is exactly the tile-letter row (different
   random shuffle; `tests/fixtures/reference/stability/S2-idle-board/report.json`).
   Everything else is byte-stable, i.e. the remaining board-state mismatches
   are ours versus Ruffle’s deterministic rasterization.
3. **Text rasterization cannot be reproduced by Chromium text.** The reference
   draws dynamic text with Ruffle’s own glyph rasterizer (soft, ~80 % black
   cores at 1 px stems); measured on `3 harfli:` the reference’s glyph run is
   36 px at cap 8 px, while the documented Verdana stack advances 44.4 px for
   the same string (Verdana Bold) and 38.5 px (Verdana Regular). Numeric
   tuning (size/letter-spacing/line-height/text-indent) minimises but cannot
   remove the difference: best per-label band ≈ 151/901 px (6 labels →
   1 240 px at dsf1, 4 711 px at dsf2). Weight 400 variants, generic-fallback
   family variants and mixed configurations were measured (calibration logs)
   and are equal or worse than the shipped values; font family/weight are kept
   at the catalog values so V7 stays exact.
4. **dsf2 adds bitmap sampling.** Ruffle upscales the embedded 550×400 bitmap
   with nearest-neighbour at dsf2 (tray region: mean RGB distance 4.7 vs 13.9
   for a smooth upscale). The board now renders that asset inline with
   `image-rendering: pixelated` at integer dpr ≥ 2 (S2 dsf2 7.79 % → 5.73 %);
   the remainder is the same glyph/shape rasterization gap.
5. **No threshold or tool change was made.** All reported ratios come from
   `verify/diff/diff.mjs` unchanged (`mismatchThreshold` 30, `passRatio` 0.02).

Consequence: the pass criterion (≤ 2.0 % per state) is met for S1 but not for
the board states, whose mismatch is dominated by glyph/shape edge
rasterization: at dsf1 the right panel contributes ≈2 460 px, tiles ≈2 750 px,
credits ≈1 435 px and buttons ≈1 000 px — all at their measured optima
(integer-offset scans over these regions find no better placement and the
>60-distance minima confirm the placements). Reaching ≤ 2 % for S2–S10 would
require changing the verification basis (e.g. re-rendering the reference
through the same browser pipeline) or re-authoring text/shape rasterization —
both outside this task’s owned paths and outside its “never patch the
threshold / never invent data” rules. Per `EXECUTION.md` §9 this is reported as
FAIL with this analysis; the orchestrator decides on an amendment.

## 7. Recorded deviations and measured values (no invented data)

| Item | Source of the value | Where |
|---|---|---|
| Label glyph colors `#ff6600` / `#000000` | dominant glyph color in `tests/fixtures/reference/S2-idle-board.png` (255,102,0 / 0,0,0) | `TEXT_COLOR` in `board.ts` |
| Intro glow gradient stops | sampled radial profile of `S1-boot.png` row y=66 (f2ca1f → f4cc33 → f5cf49 → f6d260 → f8d576 → alpha 0.97/0.80/0.45 at 72/82/89 % → 0 at r = 46.75, radius `closest-side`) | `GLOW_GRADIENT` in `board.ts` |
| Falling logo position (81, 228) | measured best integer offset in `S1-boot.png` (mismatch 3 433 vs 4 667 px at (80, 227); S1 dsf2 total 31 846 → 12 772 px with all S1 fixes) | `introView()` in `tests/e2e/visual-states.ts` |
| Ball gradient (3 layers) and letter style (24 px, −1 px) | sampled color grid of `S4-partial-entry.png` ball 0 (top highlight 233,216,216; mid 192,29,29; bottom 254,160,160) | `.board-ball*` in `board.ts` |
| Text tuning table (`TEXT_STYLE`) | per-element calibration against the C3 captures (size/line-height/letter-spacing/indent/inset) | `board.ts`, iteration log §4 |
| Runtime grid constants | `frame_131/DoAction.as` L99–104, L122, L232–269, L379–396 | `board.ts` |
| Sub-pixel credit delta (+0.25/−0.25 px) | crisp-method minimisation of the bottom-left credit region (1 639 → 1 505 px) | `ELEMENT_DELTA` in `board.ts` |
| Hairline field frame (1 device px) | measured reference frames at dsf1 (x = 36/68) and dsf2 (device x = 72/136, 1 device px) | `renderSlots` in `board.ts` |
| `image-rendering: pixelated` for embedded bitmaps at dpr ≥ 2 | §6.4 measurement | `renderSvgElement` in `board.ts` |

## 8. Artifact SHA-256 hashes

Sources (full):

```
0e37c08ea4d5a2a4c29ebea6e208cee0f122db15acb035315e685054d3548c14  src/ui/board.ts
2fa1356ecc4a32aa14b78205e67a2618114f906e36532733faa76d466e7d3ea1  src/main.ts
dc1fe5295e9277fb76f40a284eee13bb6d8efa04a69286bc5bc528005424b903  tests/e2e/visual.spec.ts
c9e7d99ffd3c0b4af8c716e68f0f3752f1ad50ebe5e8254476ccc71759a24ff8  tests/e2e/visual-states.ts
```

Per-state diff reports (schemaVersion 2; first 16 hex digits shown; full hashes
recomputable with `shasum -a 256 evidence/visual/E2/<state>/dsf<dsf>/report.json`):

| state | dsf1 | dsf2 |
|---|---|---|
| S1 | `d0779f1b644a081f` | `51b575f411835dac` |
| S2 | `9ca5245b4ba01bb9` | `fd0ae85e935fe4de` |
| S3 | `c93f630922fa09e8` | `efd21e95f54f7dc3` |
| S4 | `9feed00509fa03e4` | `b2e51e6e5d229ac4` |
| S5 | `81402e665fa79751` | `05d720689622ee91` |
| S6 | `a4943b5d94e0215c` | `643ca37e6d089588` |
| S7 | `13d2a328ad4dd2d4` | `f1c6bde773ade3ff` |
| S10 | `18a2592d02c6ac5f` | `fef23fa5f6df6d6f` |

## 9. Silent witness compliance (EXECUTION.md §8)

No audio anywhere: Playwright runs inherit the C2 `--mute-audio` launch
option (playwright.config.ts, unchanged); no additional browser was launched
in this task’s final runs; no Ruffle instance was started by E2; all
reference material was consumed as committed PNG/JSON fixtures only.

## 10. Hand-offs

- **F1/F3**: the F1 tool is used unchanged; all 16 reports/heatmaps are
  committed under `evidence/visual/E2/`.
- **E3**: the renderer exposes `defaultBoardView()`, `introSequenceElements()`
  and the generic `apply(view)` handle; animation work can extend the view
  model with keyframed `overrides`. The intro state values (glow/logo
  positions per dsf) are in `tests/e2e/visual-states.ts`.
- **Orchestrator**: §6 is the raw-basis analysis that motivated the V5
  amendment; §11 is the post-amendment resolution. Re-running the suite is
  `npm run e2e -- visual` (dev server is started by Playwright).

## 11. Resolution (2026-09-28 V5 amendment)

The raw-basis FAIL documented above was accepted by the orchestrator; the
verification basis — not the threshold — changed (docs/07-verification.md §4
“Amendment 2026-09-28”, matching entry in `docs/08-open-items.md` Amendments).
The F1 tool now emits `schemaVersion: 2` reports: the raw metric is unchanged
and remains monitored, and the `pass` verdict is
`tolerantMismatchRatio <= 0.02` (`tolerantRadius = 2`, symmetric 5×5
anti-aliasing-tolerant comparison; deterministic, raw values unchanged).

`tests/e2e/visual.spec.ts` consumes the tool’s tolerant fields directly — the
suite never re-implements the algorithm. It asserts `tolerantRadius === 2`,
keeps the raw fields (`mismatchRatio`, `mismatchedPixels`, `mismatchBBox`, …)
as numeric V2 checks, and evaluates V5 on `tolerantMismatchRatio`.

All 16 comparisons were re-run on 2026-09-28 through the tool (round trip
verified: the raw values in the v2 reports equal the pre-amendment values
recorded in §4/§8):

| state | dsf1 raw | dsf1 tolerant | dsf2 raw | dsf2 tolerant |
|---|---|---|---|---|
| S1 | 1.848 % | 0.062 % | 1.451 % | 0.015 % |
| S2 | 4.526 % | 0.975 % | 5.732 % | 0.363 % |
| S3 | 4.527 % | 0.968 % | 5.734 % | 0.362 % |
| S4 | 5.914 % | 1.363 % | 6.828 % | 0.974 % |
| S5 | 4.615 % | 0.971 % | 5.818 % | 0.375 % |
| S6 | 5.949 % | 1.301 % | 6.913 % | 0.991 % |
| S7 | 4.745 % | 0.974 % | 5.924 % | 0.380 % |
| S10 | 4.899 % | 0.918 % | 6.124 % | 0.494 % |

All 16 tolerant ratios are ≤ 2.0 % (min 0.015 % S1 dsf2, max 1.363 % S4 dsf1).
The 2.0 % threshold was not changed; the raw ratios stay recorded in every
`report.json` (schemaVersion 2) and are unchanged from the pre-amendment runs.

Post-amendment verification: `npm run e2e -- visual` exit 0 (17 passed:
16 V5 comparisons + V7 — `evidence/logs/E2-visual-tolerant.log`), `npm test`
exit 0 (58/58 — `E2-test-final.log`), `npm run lint` exit 0
(`E2-lint-final.log`), `npm run build` exit 0 (`E2-build-final.log`), C2 smoke
7/7 with the board mounted (`E2-smoke-check.log`). Updated artifact hashes: §8.

Result: **PASS** — S1–S7, S10 at deviceScaleFactor 1 and 2.
