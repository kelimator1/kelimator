# Y1 — HD Asset Remaster (owner final presentation wave) — evidence

Task: Y1 — HD Asset Remaster (owner Task A; owner-approved "better than original" backdrop/knob)
Started: 2026-09-29T08:50:11Z (first Y1 command, baseline `npm run e2e -- visual`; log mtime 11:50:11 +03)
Ended: 2026-09-29T09:29:58Z (local 12:29 +03; final evidence write after the last verification runs)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 · @playwright/test 1.63.0
Result: **PASS** (final statuses in §8)

All browser work used muted Chromium (`--mute-audio`, EXECUTION.md §8); no sound was
played, decoded for playback or opened anywhere. No `docs/**` file was edited; git
state was not modified (no add/commit/branch/stash; only a read-only status/log
peek at start-up); `../kelimator-nostalji/` was not touched.

---

## 1. Inputs and the 8x decision

| Input | SHA-256 | Role |
|---|---|---|
| `artifacts/hd-assets/ai47-x4plus-8x.webp` | `58ac94a053dc3133bde957c15f4b23d03e6b1a0cdc4de0d8ba89e65c63cb958e` | **chosen** backdrop remaster (4400×3200, lossy VP8 WebP, 519 308 B) |
| `artifacts/hd-assets/ai47-x4plus-8x.png` | `efeaffcb940325693d3d93379402fa60820565d5266ebae27aeb70b28904c122` | PNG master (21 074 842 B) |
| `artifacts/hd-assets/ai47-x4plus-4x.webp` | `888280e4484ae09b6a9a45fc37482e1afa5512092c2fdf62489da0512fb97662` | fallback — **not used** |
| `artifacts/hd-assets/ai86-8x.webp` | `490794263c69e920a8f061088c33dff5d63cc5f47f8937727cb15163273dfa2f` | speaker knob remaster (168×232, lossy VP8 WebP, 6 944 B) |
| `artifacts/hd-assets/ai86-8x.png` | `8012f3d3a138a3e9c12e87b9d718804c2f4dda703409be33efdfbebf0a13ce04` | PNG master (82 151 B) |

All five hashes match the task pins (`shasum -a 256`, recorded in
`evidence/logs/Y1-artifact-hashes.log`).

**8x chosen; measured basis** (`artifacts/y1-captures/webp-check.mjs`,
`evidence/logs/Y1-webp-fidelity.log`; muted Chromium decodes both files and diffs
them pixel-by-pixel):

| Payload | mean abs diff/channel | max channel diff | pixels > 30 RGB | share |
|---|---|---|---|---|
| ai47 8x WebP vs its PNG master | 1.024 | 40 | 62 / 14 080 000 | 0.00044 % |
| ai47 4x WebP vs its PNG master | 1.155 | 46 | 178 / 3 520 000 | 0.00506 % |
| ai86 8x WebP vs its PNG master | 2.173 | 102 | 270 / 38 976 | 0.693 % |

The 8x encode is *closer* to its lossless master than the 4x encode (mean 1.024 vs
1.155 per channel; 62 vs 178 pixels above the V5 threshold of 30). No artifact
criterion was met for falling back: the 8x payload has no structural deviations
(no PSNR cliff, no blocked regions — the >30 pixels are isolated lossy-edge
outliers), and the app captures in §6 were inspected for visible damage. The 4x
webp is therefore recorded as NOT used. (The knob has a single provided remaster.)
The backdrop is downscaled on display (8:1 at dsf1, 4:1 at dsf2), so the encode
loss is additionally averaged out; the visible result is the owner-presented HD
texture.

## 2. Pipeline change — deterministic payload embed (`tools/process-assets.mjs`)

`HD_REMASTERS` (new, documented in-file): maps `s48_board_backdrop.svg` →
`artifacts/hd-assets/ai47-x4plus-8x.webp` (pin `58ac94a0…`) and
`s90_btn_speaker.svg` → `artifacts/hd-assets/ai86-8x.webp` (pin `49079426…`).
`applyHdRemaster()` replaces exactly the one
`xlink:href="data:image/PNG;base64,…"` payload in the corrected source text with
`xlink:href="data:image/webp;base64,<pinned bytes>"` before SVGO. Guarantees:

- **hash-pinned**: artifact sha256 must equal the pin, and the decoded VP8
  dimensions must equal the recorded natural size (4400×3200 / 168×232), else the
  run fails loudly;
- **payload-count guard**: exactly one PNG data URI must exist (fail otherwise);
- **deterministic**: output is a pure function of the pinned bytes;
- **skippable**: when an artifact is absent, the SVG is not written at all (the
  committed payload is kept) and the entry is logged `… absent — committed
  payload kept, skipped`; the manifest still records the artifact source/pin.

SVGO is otherwise unchanged (`preset-default` + the pinned disabled overrides);
SVGO does not touch image payloads (X2/E1 §11.6). `manifestAssets()` now records
for the two assets: `source = artifacts/hd-assets/<file>`,
`sourceSha256 = <pin>`, `templateSource = <raw SVG export>`,
`remaster = { format: image/webp, naturalWidth, naturalHeight }`.

Commands (exact; logs in `evidence/logs/`):

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `node tools/process-assets.mjs svg` | 0 | 36 assets, **0 mismatched pixels**; s48 `693201 → 693116 B`, s90 `11588 → 11420 B` (`Y1-svg-process.log`) |
| 2 | `node tools/process-assets.mjs manifest` | 0 | 73 assets, 62 refs; the two entries updated (`Y1-manifest-process.log`) |
| 3 | `node tools/process-assets.mjs svg` + `manifest` (re-run) | 0/0 | hash list `find src/assets src/data` byte-identical (`Y1-svg-rerun2.log`; `v8-run1/2-hashes.txt`) — **V8 idempotent** |
| 4 | probe: `mv` both WebPs away → `svg` + `manifest` → `mv` back | 0/0 | both entries logged skipped; committed SVG + manifest hashes unchanged (`Y1-svg-skip-probe.log` / `Y1-manifest-skip-probe.log`); payload hashes restored `58ac94a0…` / `49079426…` (`HOLD-*.webp` round-trip) |

Only the two target SVGs changed in run #1 (`diff` of the 79-file hash snapshot:
exactly `s48_board_backdrop.svg` and `s90_btn_speaker.svg`;
`artifacts/y1-captures/before-pipeline-hashes.txt` vs `after-svg-hashes.txt`).
New hashes:

| Artifact | Before (pre-Y1) | After |
|---|---|---|
| `src/assets/svg/s48_board_backdrop.svg` | `ab35a24f2c6fae2d64a20ab35c806e12a320632a9d50fbc414550e22c8b7a9c3` | `b06c67bea1a6559c2be2fac9f2e15234f6a9d07df06a40bbea4f8802f6a6cb93` |
| `src/assets/svg/s90_btn_speaker.svg` | `bebd49f7bb99427b3d56612b9a8590f01c0be67dc14ad605cdd21859bdb025e1` | `9538d9b7323ecf743ab128854cc03d8485f3ac385e2f460d0b172702658a8591` |
| `src/assets/manifest.json` | `7a25f16754dda66669c732effd3be186e5a3a04ce96e76a2f7db368b3286949f` | `15a32cc534f7ed41ea9f2c4761c50d48579ebd06f13d85a4fef1d5a62f42a801` |
| `tools/process-assets.mjs` | `407f0eef8ef0a1643b319c4a8c7173aca3820579c9d648f3469dbed804988c38` | `75a2f27c5d62843a9d00f6311e4a1eb73724021fa587d905141c4e98a8920ae6` |

`tests/assets.test.mjs` gained a Y1 guard (one test per asset): positive structural
anchors; exactly one embedded WebP payload and no PNG payload; the payload decodes
as lossy VP8 with the pinned natural size; the manifest entry carries
`source`/`sourceSha256`/`templateSource`/`remaster` and the file sha256. Assets
suite: **11/11** (was 9; `Y1-test-1.log` full suite 13 files / **235 tests**, was
227). **Deliberate guard probe** (X2 discipline): temporarily flipping the s48
manifest `sourceSha256` to `deadbeef…` makes `npm test -- assets` fail with
exactly the Y1 guard (`expected 'deadbeef…' to be '58ac94a0…'`, 1 failed /
10 passed — `Y1-guard-probe.log`); the manifest was restored (hash `15a32cc5…`)
and the suite re-passed 11/11 (`Y1-guard-probe-restore.log`).

## 3. `src/ui/board.ts` — pixelated → smooth (owner-approved)

The inline-SVG raster path (s48 backdrop, s90 speaker) now pins
`image-rendering: smooth` at integer dpr ≥ 2 instead of `pixelated` (the E2-era
pin that reproduced Ruffle's nearest-neighbor upscale of the 2012 bitmaps,
E2-layout.md §6.4). Comment updated in-file with
`// evidence: evidence/Y1-remaster.md (owner-approved HD remaster allowance)`.
Nothing else changed (the branch, the dpr condition, the element delta logic).
New hash: `src/ui/board.ts` = `fc2ec4e86e611659d826bf7f9c73055574e5e13e76acfddee649484dfbb19e85`
(pre-Y1 `83ee124b…`, X2-era `1e4d6ec1…`).

## 4. `verify/diff/diff.mjs` — opt-in repeatable `--ignore-rect` (schema v3)

CLI: `node verify/diff/diff.mjs <a.png> <b.png> <outdir> [--ignore-rect x,y,w,h]...`
(repeatable). Semantics (documented in `verify/diff/README.md`):

- rects are validated (integers, `w,h ≥ 1`, fully inside the image) — any problem
  exits 1 with one clean stderr line, no files written;
- pixels inside the union of the rects are excluded from the **mismatch counting**
  (raw + tolerant counts, ratios, bboxes, `pass`); `maxDistance`/`meanDistance`
  keep their full-image definitions; the tolerant neighbourhood still reads the
  full image; `heatmap.png` is still the raw full-image view;
- new fixed-order fields `ignoredRects` (as given) and `ignoredPixels` (union
  count, overlaps once); `schemaVersion` is now **3**; without the option the
  report is the v2 report plus `ignoredRects: []` / `ignoredPixels: 0`;
- determinism retained (no timestamps/paths; identical command → byte-identical
  report + heatmap).

Self-tests (`verify/diff/diff.test.mjs`, **25 tests**, was 19): identical + rect →
0/0 with `ignoredPixels` = area; mutation inside rect → invisible (raw 0, tolerant
0, bbox null, `maxDistance` unchanged); mutation outside → detected unchanged
(100 raw / 36 tolerant core); overlapping rects count the union once; invalid
rects → exit 1 one clean line (5 failure modes); determinism with rects retained.
README updated (CLI, schema v3, ignore-rect semantics, self-test list).

## 5. Rect derivation (heatmaps + element coverage; smallest compact cover)

Procedure (all measurement scripts in `artifacts/y1-captures/`, raw logs in
`evidence/logs/Y1-*.log`; captures and intermediate images in
`evidence/visual/Y1/derivation/`):

1. **Before/after captures** (S2 idle board, the canonical board state):
   `evidence/visual/Y1/before/S2-dsf{1,2}-actual.png` (suite run before the Y1
   change) and `evidence/visual/Y1/after-S2-dsf{1,2}-actual.png` (after; raw
   suite numbers in §6).
2. **Backdrop-visible mask**: the same page with
   `[data-element="board_backdrop"] image` hidden, stage re-captured; a pixel is
   backdrop-visible when hiding the backdrop changes it
   (`artifacts/y1-captures/probe2-nobackdrop-dsf{1,2}.png`). Measured visible
   share: 72.9 % (dsf1) / 72.1 % (dsf2) — the overlaid UI elements cover the
   rest (element coverage from the live DOM; speaker box (513.98, 364.73,
   33.53×34.08), backdrop box (0.44, 0, 550×400)).
3. **Y1-attributable deviation mask** = visible ∧ `dist(app, reference) > 30` ∧
   `dist(before, reference) ≤ 30` (mismatch present now but not before Y1):
   3 108 px (dsf1) / 24 141 px (dsf2). Rendered:
   `evidence/visual/Y1/derivation/mask-newTarget-dsf{1,2}.png`;
   `S2-dsf{1,2}-report-no-rects.json` is the no-allowance report.
4. **Union in dsf1 stage coordinates** (dsf1 mask OR dsf2 mask downsampled 2×):
   10 915 px. Covered exactly with **10-px cells** (cells carrying ≥ 3 deviation
   pixels; greedy maximal rectangles) → **137 rects**; plus the **speaker-knob
   bbox** `(515, 367, 22, 30)` measured by hiding the knob `<image>` and
   diffing (dsf1 footprint (515,367,22,30), dsf2 (1030,735,44,58);
   `probe2-footprints.json`) → **138 rects, `Y1_IGNORE_RECTS`**
   (`tests/e2e/visual-states.ts`; JSON mirror
   `evidence/visual/Y1/derivation/final-rects.json`).
5. **Coverage achieved** (measured, `Y1-final-rects-v2.log`, `Y1-candidate-c10m3.log`):
   97.7 % of the Y1 deviation at dsf1 and 98.6 % at dsf2; area **28.4 % of the
   stage**; the residual deviation stays counted. Applied at native resolution
   per dsf (rects scaled ×dsf); overlay:
   `evidence/visual/Y1/derivation/final-rects-overlay.png`.
6. **No blanket stage ignore**: the set is disjoint regions derived from the
   deviation network and leaves most UI cores (tiles, glyphs, buttons) and all
   non-visible-backdrop pixels counted. Measured effect: post-allowance S2
   tolerant ratios are close to the pre-Y1 baseline (0.710 % vs 0.980 % at dsf1,
   0.254 % vs 0.281 % at dsf2 — the small difference is the AA-edge over-coverage
   inherent to block rects; recorded, not hidden).

Iteration record (kept, not hidden): a first allowance derived from the *full*
backdrop-visible mismatch mask (not only the Y1-attributable part) with 25
coarse rects covered 59.3 % of the stage and dropped the S2 tolerant ratios to
0.148 %/0.062 % — far below the pre-Y1 baseline, i.e. it absorbed the
pre-existing font/shape rasterization mismatch as well. That variant was
discarded and is preserved in `Y1-visual-with-rects.log` (run: 17 passed) and
the intermediate cover experiments (`Y1-cover*-experiment.log`); the final set
uses the Y1-attributable mask and the finer 10-px cells.

Wiring (three suites, `--ignore-rect` at the comparison call):

- `tests/e2e/visual.spec.ts`: board states (`view.elements` includes
  `board_backdrop`) pass `y1IgnoreRectArgs(dsf)`; **S1 (intro, no backdrop) gets
  no allowance** and asserts `ignoredRects: []`; board states assert the tool
  reports exactly `y1IgnoreRects(dsf)` and `ignoredPixels > 0`.
- `tests/e2e/animations/animations.spec.ts`: all covered keyframes pass the
  dsf1 args and assert the same.
- `tests/e2e/playthrough/playthrough.spec.ts`: every compared step (and the S9
  timeout variant) passes the dsf1 args and asserts the same; logs include
  `ignoredPixels`.
- The speaker e2e suite compares the app to itself (no reference diff) — no
  wiring needed.

## 6. Captures and before/after measurements

Captures (S2 idle board; before = pre-Y1 committed state, after = with the
remaster; stage 550×400 / 1100×800, plus one 1920×1080 page view):

| Capture | SHA-256 |
|---|---|
| `evidence/visual/Y1/before/S2-dsf1-actual.png` | `298eebec798c5bc8b26dc826e8444a6670f99c65a03292ee60477a8b4b5beb01` |
| `evidence/visual/Y1/before/S2-dsf2-actual.png` | `0363f7656a589cefc284411aa70101c7228bafbd4e5dc1b41999dee4d1ddd184` |
| `evidence/visual/Y1/after-S2-dsf1-actual.png` | `8031e8d1872087fb26ad62d6f3e9bd45b3147e2caaa9562bcb8a32985aaa3fbf` |
| `evidence/visual/Y1/after-S2-dsf2-actual.png` | `d427613cf8d75debe8244e7515838f3d44f39413d864ffce088ca3566b6b5a8e` |
| `evidence/visual/Y1/before-S2-window1920.png` | `13d3d415c5252a0e02c180fe619feca87c59bdf436a4fba88bb4df9821a585f8` |
| `evidence/visual/Y1/after-S2-window1920.png` | `bfe0392b867f19f324de7eda58c7788d095160604c3c36d450c2a8ac32f94f87` |

(The before window capture was taken by temporarily restoring the reconstructed
pre-Y1 SVGs in the working tree, capturing, then restoring the committed new
files — hashes re-verified.)

S2 comparison (F1 tool; `evidence/logs/Y1-visual-with-rects-c10m3.log`,
`evidence/visual/Y1/after-reports/`):

| Pair | raw | tolerant | ignoredPixels |
|---|---|---|---|
| before, dsf1 (no allowance) | 4.189 % | 0.980 % | — |
| before, dsf2 (no allowance) | 5.433 % | 0.281 % | — |
| after, dsf1, **no allowance** | 5.627 % | 1.167 % | — |
| after, dsf2, **no allowance** | 7.773 % | 1.134 % | — |
| after, dsf1, **with allowance** | 3.295 % | **0.710 %** | 62 720 |
| after, dsf2, **with allowance** | 3.259 % | **0.254 %** | 250 880 |

All 16 board-state/dsf comparisons (S2–S7, S10) and the S1 pair pass with the
allowance (§8).

**Render preservation for the two SVGs** (`artifacts/y1-captures/preservation/`,
`evidence/logs/Y1-preservation.log`; muted Chromium):

- the pre-Y1 processed files were reconstructed with the pinned SVGO options
  from the raw exports and match the committed pre-Y1 hashes byte-exactly
  (`ab35a24f…`, `bebd49f7…`) — the old/new diff basis is sound;
- payload-normalized structure: old vs new SVG text are **identical**
  (`xlink:href="data:…"` masked) → only the payload changed;
- SVGO preservation (refreshed `evidence/visual/E1-svgo/`): s48 `693201 →
  693116 B` and s90 `11588 → 11420 B`, both **0 mismatched pixels**
  (`before.png`/`after.png` byte-identical: s48 `ea9e1c24…`, s90 `3fd04a9e…`);
- s90 old vs new render: 381 px changed, tight bbox `(1, 2, 22, 30)` — exactly
  the knob pattern area; the waves/shape0 pixels are unchanged;
- s48 new render vs a minimal wrapper around the same WebP payload: **0 px**
  (`> 0` and `> 30` thresholds) → the pattern renders the remaster 1:1;
- the other 34 `evidence/visual/E1-svgo/` dirs were restored to their frozen
  v1/v2 states (verified file-by-file against the pre-task backup; only the two
  asset dirs + `summary.json` intentionally refreshed).

## 7. O25 re-check (speaker knob vs the reference, smooth HD knob)

Reproducible helper (committed): `node tests/e2e/speaker/o25-recheck.mjs <baseUrl>`
(manual run, muted Chromium; writes `evidence/visual/Y1/o25/`). Re-run from the
committed location reproduces the numbers below byte-identically
(`Y1-o25-recheck-final.log` = `Y1-o25-recheck.log` modulo the trailing note;
app ON = default volume, OFF = persisted `kelimator.volume = 0`, both muted,
dsf1, stage 550×400; reference =
`tests/fixtures/reference/speaker/speaker-{before,on,off}.png`):

| Pair | region | raw | tolerant | X3/O24 baseline (old pixelated knob) |
|---|---|---|---|---|
| app ON ↔ ref before/on | C3 box (505,356,45×44) | 34.242 % (678 px) | 10.758 % (213 px) | 23.535 % / 8.182 % |
| app ON ↔ ref before/on | knob bbox (515,367,22×30) | 83.030 % (548 px) | 45.000 % (297 px) | — |
| app OFF ↔ ref off | C3 box | 26.515 % (525 px) | 5.758 % (114 px) | 14.697 % / 1.818 % |
| app OFF ↔ ref off | knob bbox | 70.758 % (467 px) | 29.848 % (197 px) | — |

**O25 = SUPERSEDED** (owner-approved remaster allowance). The old O25 residual
was a *rasterization-phase* artifact of drawing the 2012 bitmap through the
inline pattern; with the approved HD knob the region difference is dominated by
the intentionally different remastered texture (and is inside the allowance rect
`(515,367,22,30)`), so the phase question no longer applies. The semantic
behavior (ON/OFF frames, waves, persistence) is unchanged and is verified by the
speaker suite (§8). Proposed docs/08 line in §10.

## 8. Suite results (final; logs in `evidence/logs/`)

| Suite | Command | Result |
|---|---|---|
| Visual (V5+V2+V7) | `npm run e2e -- visual` | **17 passed** — S1 raw 1.848 %/tolerant 0.062 % (dsf1), 1.451 %/0.015 % (dsf2), no allowance; S2–S7/S10 tolerant 0.669–0.999 % (dsf1), 0.254–0.746 % (dsf2) with the allowance (`Y1-visual-with-rects-c10m3.log`) |
| Animation (V5+V2+V7) | `npm run e2e -- animation` | **8 passed** — board @0.0 tolerant 0.737 %; wordball @0.25/0.5278/0.8056/1.0556 tolerant 1.031/0.795/0.795/0.795 % (`Y1-animation-with-rects.log`) |
| Playthrough (V6+V5) | `npm run e2e -- playthrough` | **3 passed** — 40 scripted steps, worst tolerant **1.325 %** (was 1.918 % without the allowance); S9 timeout variant raw 6.987 %/tolerant **0.619 %**, app wait 200 265 ms (`Y1-playthrough-with-rects-clean.log`) |
| Speaker (O24/O25 semantics) | `npm run e2e -- speaker` | **3 passed** (`Y1-speaker-final.log`) |
| Unit tests | `npm test` | **13 files / 235 tests passed** (`Y1-test-final.log`) |
| Lint / build | `npm run lint` / `npm run build` | exit 0 / exit 0 (tsc + Vite; pre-existing chunk-size warning only; `Y1-lint-final.log`, `Y1-build-final.log`) |

A first `playthrough` run (`Y1-playthrough-with-rects.log`) had the main test
pass (worst 1.325 %) and the S9 variant fail with `window.__game` undefined —
root cause: this worker's own before-window capture swapped the SVG files while
that run's dev server was live. The failing run is kept; the clean re-run
(`Y1-playthrough-with-rects-clean.log`) passes. No test or threshold was changed.

## 9. Hash inventory

Full lists: `evidence/logs/Y1-artifact-hashes.log` (sources + captures) and the
per-run logs. Key values:

| Artifact | SHA-256 |
|---|---|
| `src/ui/board.ts` | `fc2ec4e86e611659d826bf7f9c73055574e5e13e76acfddee649484dfbb19e85` |
| `tools/process-assets.mjs` | `75a2f27c5d62843a9d00f6311e4a1eb73724021fa587d905141c4e98a8920ae6` |
| `src/assets/svg/s48_board_backdrop.svg` | `b06c67bea1a6559c2be2fac9f2e15234f6a9d07df06a40bbea4f8802f6a6cb93` |
| `src/assets/svg/s90_btn_speaker.svg` | `9538d9b7323ecf743ab128854cc03d8485f3ac385e2f460d0b172702658a8591` |
| `src/assets/manifest.json` | `15a32cc534f7ed41ea9f2c4761c50d48579ebd06f13d85a4fef1d5a62f42a801` |
| `verify/diff/diff.mjs` | `1548ca36e650c5ce11e399ebe9326742683244a9fff89202226e4fbf29dc9f42` |
| `verify/diff/diff.test.mjs` | `c28199207c60466d8a9dd446ead861cc37e91670fbb97d69f47a81df925c96d4` |
| `verify/diff/README.md` | `ab40edf6a6dfd1d00de9e88ab5aa6fc366cde3b8e87556017caa710737e183b2` |
| `tests/assets.test.mjs` | `9ab46ffdb10221f97e48a3ac8221e3cd4467c0b34dc1e5feaf67f5a50ca1755b` |
| `tests/e2e/visual.spec.ts` | `17dd6bcb778fe5c0a7579a1cccb09afa14c1dad6fc004acaf13e61d0bd6b6d91` |
| `tests/e2e/visual-states.ts` | `3336e00dc9a940f39388835fb78de3cc0a28fb4c434d50e94e8707c26d75a477` |
| `tests/e2e/animations/animations.spec.ts` | `bb52c8274c6ce3a179b0fa23a4811b18105e9bf74ae3e932635513d8777a6261` |
| `tests/e2e/playthrough/playthrough.spec.ts` | `c01feb2091d26c093faac9c3e3b6bbf0c5fdea5ef460963b01641a01b9800589` |
| `tests/e2e/speaker/o25-recheck.mjs` (new helper) | `f2ecb2b9178c6a9b30b2d6e5005604b0494165665c2118057085e06d97b2ecd3` |
| `evidence/visual/Y1/derivation/final-rects.json` (wired 138 rects) | `f0fd54d1a0d07ff55d40fedacc5fae503951aa8b41f9e5548ff834884f19f758` |
| `evidence/visual/E1-svgo/summary.json` (refreshed) | `e989359381fd5b448194371683c69f1c1323b4c86587e148fb84c5b5a6543c68` |

## 10. Proposed docs lines (single-writer: the orchestrator applies these)

**`docs/07-verification.md` §4 — new amendment:**

> Amendment 2026-09-29 (owner final wave Y1): the static/animation/playthrough V5
> comparisons pass a region-scoped `--ignore-rect` allowance for the
> owner-approved HD remaster of bitmap 47 (board backdrop) and bitmap 86
> (speaker knob). The set (`Y1_IGNORE_RECTS`, 138 rects in dsf1 stage pixels,
> scaled by deviceScaleFactor; mirrored in
> `evidence/visual/Y1/derivation/final-rects.json`) covers 97.7 %/98.6 % of the
> Y1-attributable mismatch pixels at dsf 1/2 (derivation: render changed by the
> remaster ∧ backdrop visible ∧ newly mismatched > 30, S2, union of both
> deviceScaleFactors, 10-px cells with ≥ 3 deviation pixels, plus the measured
> knob bbox 515,367,22,30; `evidence/Y1-remaster.md` §5). It spans 28.4 % of the
> stage; there is no stage-wide ignore and states without the backdrop (S1)
> get no allowance. Pre-existing font/shape/bitmap rasterization mismatch
> outside the deviation network stays counted (post-allowance S2 tolerant
> 0.710 %/0.254 % vs pre-Y1 0.980 %/0.281 %; all board comparisons remain
> ≤ 1.0 %). Mechanism: `verify/diff` schema v3 `ignoredRects`/`ignoredPixels`
> (`--ignore-rect`), self-tested; thresholds unchanged. Evidence:
> `evidence/Y1-remaster.md` §4/§5/§8, matching entry in
> `docs/08-open-items.md` (Amendments).

**`docs/03-assets-and-visuals.md` §2 — new amendment (deviation record):**

> Amendment 2026-09-29 (owner final wave Y1): bitmaps 47 (550×400 board
> backdrop) and 86 (21×29 speaker knob) are replaced *inside their SVG assets*
> (`s48_board_backdrop.svg`, `s90_btn_speaker.svg`) by the owner-provided HD
> remasters (8x lossy WebP: 4400×3200 / 168×232; artifacts
> `ai47-x4plus-8x.webp` / `ai86-8x.webp`, sha256-pinned in
> `tools/process-assets.mjs` `HD_REMASTERS`) instead of the byte-identical 2012
> exports — an explicit, owner-approved deviation from the reference texture
> ("better than original"). The swap is deterministic (hash-pinned payload
> replacement before SVGO; absent artifacts keep the committed payload and log
> a skip; re-runs byte-identical), the manifest records the artifact as
> `source` + `sourceSha256` (+ `templateSource` provenance), and the assets test
> guards the payload and the manifest record. Rendering switches the inline
> bitmaps from `image-rendering: pixelated` to `smooth` (`src/ui/board.ts`);
> V5 applies the region-scoped allowance in `docs/07` §4. The 4x fallback was
> not used — measured encode fidelity was better for the 8x payload
> (mean 1.02/255 vs 1.16/255 per channel; 62 vs 178 pixels > 30 RGB vs the PNG
> master). Evidence: `evidence/Y1-remaster.md` §1–§3/§6.

**`docs/08-open-items.md` — proposed entries:**

- Amendments: `2026-09-29 — Owner final wave Y1 (docs/07 §4 allowance +
  docs/03 §2 deviation): HD remaster of bitmaps 47/86 embedded into s48/s90
  (8x WebP, hash-pinned, deterministic, skippable), smooth rendering, V5
  `--ignore-rect` set (138 rects, 28.4 % of stage, 97.7 %/98.6 % deviation
  coverage), suites re-run green. Evidence: evidence/Y1-remaster.md.`
- O25 status line:
  `SUPERSEDED 2026-09-29 — evidence/Y1-remaster.md §7 — the speaker-knob
  spatial residual (old 2012 bitmap drawn through the inline pattern at a
  0.5-px phase) is superseded by the owner-approved HD remaster of bitmap 86:
  the knob is now an intentionally different texture (ON C3 box raw 34.2 % /
  tolerant 10.8 %; knob bbox 83.0 %/45.0 %; OFF 26.5 %/5.8 %) and is covered by
  the approved allowance rect (515,367,22,30). Semantics (ON/OFF frames,
  persistence) unchanged and suite-verified.`

## 11. Silent witness and hygiene

- Every browser run (asset renders, probes, all suites) used Chromium with
  `--mute-audio`; no sound was played or decoded; no Ruffle run.
- No network access was needed; no `docs/**` file was written; git state was
  not modified (read-only status/log peek at start-up only);
  `../kelimator-nostalji/` was not touched.
- Owned-path discipline: writes only to the task's owned paths plus the
  uncommitted `artifacts/y1-captures/**` scratch area.

## 12. Result

**PASS** — 8x remaster chosen from measured fidelity; payloads embedded
deterministically (hash-pinned; absent-input skip proven; V8 byte-identical);
manifest + guards updated; smooth rendering; `--ignore-rect` tool + 6 new
self-tests; region-scoped allowance derived from heatmaps/element coverage and
wired into the visual/animation/playthrough suites; visual/animation/playthrough
green on the documented allowances with residuals near the pre-Y1 baseline;
O25 superseded with measurements; captures, hashes and proposed docs lines
recorded.
