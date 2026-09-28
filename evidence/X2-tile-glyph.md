# X2 — Tile Template Glyph Removal (evidence)

Task: X2 — Tile Template Glyph Removal (owner defect 2)
Started: 2026-09-28T20:23:49Z (first X2 artifact write: `evidence/logs/X2-baseline-hashes.log`; UTC)
Ended: 2026-09-28T20:43:03Z (`date -u` before this file was written)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 · @playwright/test 1.63.0

Commands executed (exact, repo root); raw output in `evidence/logs/`:

| # | Command (exact) | Exit | Log |
|---|---|---|---|
| 1 | `shasum -a 256 artifacts/decompiled/sprites/DefineSprite_58/1.svg src/assets/svg/s58_letter_tile.svg` (baseline) | 0 | `X2-baseline-hashes.log` |
| 2 | `node tools/process-assets.mjs svg > evidence/logs/X2-svg-process.log 2>&1` | 0 | 36 assets, 0 mismatched px |
| 3 | `node tools/process-assets.mjs manifest > evidence/logs/X2-manifest-process.log 2>&1` | 0 | only the s58 entry changed |
| 4 | `node <tmp>/x2-render.mjs …` + `node verify/diff/diff.mjs evidence/X2-tile-glyph/tile-old.png evidence/X2-tile-glyph/tile-new.png evidence/X2-tile-glyph/removal-diff > evidence/logs/X2-removal-diff.log 2>&1` | 0 | removal proof (old vs new processed render) |
| 5 | python exact-span extraction + SVGO re-derivation `> evidence/logs/X2-removed-elements.log 2>&1` | 0 | 7 spans / 1 232 bytes; re-derived sha = committed sha |
| 6 | `NO_COLOR=1 npm test -- assets > evidence/logs/X2-test-assets.log 2>&1` | 0 | 9/9 incl. new guard |
| 7 | probe: disable the correction in `tools/process-assets.mjs` (not committed), then `node tools/process-assets.mjs svg` / `manifest` and `NO_COLOR=1 npm test -- assets > evidence/logs/X2-probe-guard-fails.log 2>&1` | 1 | 8 passed / **1 failed (the X2 guard)** |
| 8 | restore the correction; `node tools/process-assets.mjs svg > evidence/logs/X2-svg-process-final.log 2>&1` + `… manifest > evidence/logs/X2-manifest-process-final.log 2>&1` | 0 | s58 back to the clean sha |
| 9 | `NO_COLOR=1 npm test -- assets > evidence/logs/X2-test-assets-final.log 2>&1` | 0 | 9/9 |
| 10 | `NO_COLOR=1 npm run e2e -- visual --reporter=line > evidence/logs/X2-e2e-visual.log 2>&1` | 0 | 17 passed |
| 11 | `NO_COLOR=1 npm run e2e -- visual --reporter=line > evidence/logs/X2-e2e-visual-final.log 2>&1` (final, quiet window) | 0 | 17 passed; reports copied to `evidence/X2-tile-glyph/e2-live/` |
| 12 | `NO_COLOR=1 npm test > evidence/logs/X2-test-full.log 2>&1` | 0 | 13 files, 227 tests |
| 13 | `NO_COLOR=1 npm run lint > evidence/logs/X2-lint.log 2>&1` | 0 | clean |
| 14 | `NO_COLOR=1 npm run build > evidence/logs/X2-build.log 2>&1` | 0 | tsc + Vite (pre-existing chunk-size warning only) |
| 15 | `shasum -a 256 … > evidence/logs/X2-artifact-hashes.log` | 0 | full hash list |

All browser work used muted Chromium (`--mute-audio`, EXECUTION.md §8); no sound was played.
All comparisons used F1's `verify/diff/diff.mjs` unchanged (schemaVersion 2, raw + tolerant,
`mismatchThreshold` 30, `passRatio` 0.02, `tolerantRadius` 2 — no threshold touched).

Result: **PASS** — glyph removed deterministically, every other tile pixel byte-identical,
SVGO preservation 0 px, S2–S7 raw improved, tolerant ≤ 2 %, guard proven by probe,
full test/lint/build/e2e green.

---

## 1. Defect and removal method

**Defect (owner-reported, confirmed).** `artifacts/decompiled/sprites/DefineSprite_58/1.svg`
(the `letter_tile` source export, unchanged since E1 commit `55528c2`) contains the
authoring-time placeholder "A" of the FLA text field as real FFDec geometry. The field is
dynamic at runtime (the rebuild draws the letter as DOM text — `src/ui/board.ts`
`renderTiles()`), and the reference capture never displays a baked letter; the artifact was
masked by the tolerant V5 basis (S2 dsf1 raw 4.53 % vs tolerant 0.97 %).

**Method (deterministic, in `tools/process-assets.mjs`).** New documented
`SVG_SOURCE_CORRECTIONS` map applies `stripLetterTilePlaceholderGlyph()` to the source text
of `s58_letter_tile.svg` only, *before* SVGO. Removal is textual: two `<use>` href sets are
deleted by exact-count regex, the three `<g id="…">` subtrees by a balanced `<g>`/`</g>`
scan. Every expected count is asserted (2 + 2 + 1 + 1 + 1 spans), and the function fails if
any `#text0` / `#text1` / `font_Verdana_A0` marker remains. Structural drift therefore fails
loudly instead of silently skipping the removal. The SVGO input and the "before" render are
the corrected text, so the 0-px SVGO rule certifies SVGO fidelity, not the removal (the
removal is certified separately in §3).

**Exact removed set — 7 spans, 1 232 bytes** (raw 40 951 → corrected 39 719; verbatim text in
`evidence/logs/X2-removed-elements.log`):

| # | Element (FFDec character) | Bytes | Role |
|---|---|---|---|
| 1–2 | `<use ffdec:characterId="52" … xlink:href="#text0"/>` | 2 × 130 | up + over button frames (char 52 instance) |
| 3–4 | `<use ffdec:characterId="55" … xlink:href="#text1"/>` | 2 × 132 | down + hittest frames (char 55 instance) |
| 5 | `<g id="text0">…</g>` | 240 | up/over text instance (black `#font_Verdana_A0` use) |
| 6 | `<g id="text1">…</g>` | 239 | down/hittest text instance (black `#font_Verdana_A0` use) |
| 7 | `<g id="font_Verdana_A0">…</g>` | 229 | the glyph outline path itself (the "A") |

**Independent check.** A Python re-implementation of exactly this span set applied to the raw
export, then optimized with the pinned SVGO options, reproduces the committed processed file
byte-for-byte: re-derived sha256 `4a2510f2…1062d0` = committed sha256
(`evidence/logs/X2-removed-elements.log`). No other source byte is affected.

## 2. Before → after SHA-256

| Artifact | Before | After |
|---|---|---|
| Source export `artifacts/decompiled/sprites/DefineSprite_58/1.svg` | `429c67e6b87dbd3cc2ffea55488a6d537dc594f1720e8e3c241e161a7fe4e815` | **unchanged** (not an owned path; removal happens at process time) |
| Processed `src/assets/svg/s58_letter_tile.svg` | `221c62620aa3fe51630e305aa477805b3f27df70f4375b439de9189c23e78783` | `4a2510f29f029f7cd4f5acbfacb48f2bb71c7f6dffdb16756b9ad971f01062d0` |
| Manifest entry `svg/s58_letter_tile.svg` (`src/assets/manifest.json`) | `221c6262…8783` | `4a2510f2…62d0` |
| `src/assets/manifest.json` file | `92f03463b54fde452ff38749aa6e1d39a886bef02492282d31effc5b0636d763` | `7a25f16754dda66669c732effd3be186e5a3a04ce96e76a2f7db368b3286949f` |
| `tools/process-assets.mjs` | `c5cbd92d6c7e47c7733f61aab82657903cd2256e236110542c475c281e905c51` (E1 §9) | `407f0eef8ef0a1643b319c4a8c7173aca3820579c9d648f3469dbed804988c38` |
| `tests/assets.test.mjs` | `d7eb64e85129037cad585480d21f9f7fcb55c762b99586fb7738822350effe4f` (E1 §9) | `cb0a44c090c372fc915b6d963f53a6ddaa023a3c541334854c453c0b75521880` |
| `evidence/visual/E1-svgo/summary.json` | `7d19ad1eb23d60c93ee416190976615b13a7db7b4db42aca5e0e3cefa78aa2cb` (E1 §9) | `508e9a8729e75ee7bda68786f2fd6f48a06db2950b5e405c46e30f13a56e1786` |
| `evidence/visual/E1-svgo/s58_letter_tile/report.json` | `d8bd0bd5e131759951fc14f4190a4b78b0aa735667c404f28ce30caa54bd312a` (v1) | `3f79772f9860b75ef74d3e3ab5bd4ecdd637658dff1b9c181444094b0e0f2271` (v2, 0 px) |

`manifest` regeneration changed exactly one asset entry (s58) — the `data` and `references`
sections are byte-identical; no hardcoded hash check referenced the old file (grep:
only the manifest itself and the frozen E1 evidence). `npm test -- assets` verifies every
manifest sha on disk (9/9 green).

## 3. SVGO preservation evidence (refreshed for this asset)

Pipeline run (`X2-svg-process-final.log`): `s58_letter_tile.svg: 39719 -> 34893 bytes,
ink=5478, mismatchedPixels=0` — before = the corrected source text (the SVGO input), after =
the processed SVG, both rendered in muted Chromium at the intrinsic size (165 × 115 clip,
deviceScaleFactor 1) and compared with F1's tool: **0 mismatched pixels**
(`evidence/visual/E1-svgo/s58_letter_tile/report.json`, `pass: true`). Renders:
`before.png` / `after.png` (identical bytes, sha256 `4808d940…e9343`). `summary.json` was
refreshed (s58 entry + totals); the other 35 assets' renders were byte-identical, so their
frozen v1 `report.json` files were restored — the diff of `evidence/visual/E1-svgo/` is
exactly the s58 pair plus `summary.json`.

**Removal proof (old vs new processed render).** The pre-X2 processed render
(`evidence/X2-tile-glyph/tile-old.png`, sha256 `8a604610…d99dd` — byte-identical to the old
E1 pair before/after) vs the new render (`tile-new.png` = pipeline `after.png`, sha256
`4808d940…e9343`), compared with F1's tool (`removal-diff/report.json`):

- raw mismatches 379 px, tolerant 105 px, tight bbox `(28, 63, 26, 26)` — the glyph box;
- exact per-pixel byte diff: **398 pixels differ, all inside the same bbox**; every pixel
  outside it is byte-identical → "every other tile pixel/geometry stays identical".

The old E1 preservation pair (raw export render, glyph present in both images) is superseded
by this refreshed pair; the old before.png is preserved as `tile-old.png`.

## 4. S2–S7 app-vs-reference (F1 tool, raw + tolerant; thresholds unchanged)

`npm run e2e -- visual` (E2 suite → `tests/e2e/visual.spec.ts` → F1 `verify/diff/diff.mjs`),
final run exit 0, **17/17 passed** (`X2-e2e-visual-final.log`; earlier identical run in
`X2-e2e-visual.log`). Per-state reports copied to `evidence/X2-tile-glyph/e2-live/<state>/dsf<dsf>/report.json`.
"Before" = `evidence/E2-layout.md` §11 (frozen); "after" = this run. Measurement tree:
`src/ui/board.ts` sha256 `1e4d6ec1427d2ad7fc7257e2e9e9dc5042d60fb2f8bb445590df6e4a4cd20c6c`,
`s58_letter_tile.svg` sha256 `4a2510f2…62d0`.

| state | dsf | raw before | raw after | Δ raw | tolerant before | tolerant after | mismatched px | tolerant px |
|---|---|---|---|---|---|---|---|---|
| S2 | 1 | 4.526 % | 4.189 % | −0.337 | 0.975 % | 0.980 % | 9 216 | 2 157 |
| S2 | 2 | 5.732 % | 5.433 % | −0.299 | 0.363 % | 0.281 % | 47 808 | 2 469 |
| S3 | 1 | 4.527 % | 4.190 % | −0.337 | 0.968 % | 0.974 % | 9 219 | 2 143 |
| S3 | 2 | 5.734 % | 5.435 % | −0.299 | 0.362 % | 0.280 % | 47 826 | 2 461 |
| S4 | 1 | 5.914 % | 5.703 % | −0.211 | 1.363 % | 1.359 % | 12 547 | 2 990 |
| S4 | 2 | 6.828 % | 6.629 % | −0.199 | 0.974 % | 0.915 % | 58 337 | 8 056 |
| S5 | 1 | 4.615 % | 4.278 % | −0.337 | 0.971 % | 0.977 % | 9 411 | 2 150 |
| S5 | 2 | 5.818 % | 5.519 % | −0.299 | 0.375 % | 0.292 % | 48 565 | 2 574 |
| S6 | 1 | 5.949 % | 5.730 % | −0.219 | 1.301 % | 1.304 % | 12 606 | 2 869 |
| S6 | 2 | 6.913 % | 6.719 % | −0.194 | 0.991 % | 0.940 % | 59 124 | 8 271 |
| S7 | 1 | 4.745 % | 4.408 % | −0.337 | 0.974 % | 0.980 % | 9 698 | 2 156 |
| S7 | 2 | 5.924 % | 5.625 % | −0.299 | 0.380 % | 0.298 % | 49 499 | 2 619 |

- Raw improved in all 12 S2–S7 pairs (S4/S6 hide 3 tiles, hence the smaller absolute drop);
  raw max S2–S7 = **6.719 %** (was 6.913 %, S6 dsf2), dsf1 max 5.730 % (was 5.949 %).
- Tolerant stayed ≤ 2 % everywhere; max S2–S7 = **1.359 %** (was 1.363 %, S4 dsf1). The
  ±0.005 pp dsf1 movements are the expected reference-side effect: some reference letter
  pixels previously found a ≤ 30-distance counterpart in the baked glyph and no longer do.
- Context from the same run: S1 1.848 % / 0.062 % and 1.451 % / 0.015 % — bit-identical to
  §11, proving the harness is deterministic and unchanged (S1 renders no tiles); S10 also
  improved (4.562 % / 0.925 %, 5.825 % / 0.411 %).
- No threshold was changed (`passRatio` 0.02, `tolerantRadius` 2, `mismatchThreshold` 30).

## 5. Regression guard + deliberate probe

**Guard** (`tests/assets.test.mjs`, describe `letter_tile template carries no baked
placeholder glyph (X2)`, deterministic, no I/O beyond the committed file):
positive anchors `id="button0"`, `id="shape0"`, `id="shape1"`, `xlink:href="#button0"` must be
present (no vacuous pass), and four absence markers must not match:
`/font_Verdana/` (FFDec glyph group/reference), `/#text[01]\b/` (placeholder frame
references), `/id="text[01]"/` (placeholder definitions), and the exact glyph outline path
data `M24.35 -14.35` (`convertPathData` is disabled, so it would survive SVGO verbatim).
`npm test -- assets`: 9/9 green (`X2-test-assets-final.log`).

**Deliberate probe (not committed).** The correction map entry in `tools/process-assets.mjs`
was temporarily commented out; `svg` + `manifest` were re-run, regenerating the *old*
defective artifact byte-for-byte (sha256 `221c6262…8783`) with a consistent manifest (so the
hash checks pass and only the guard can fail). `npm test -- assets` then reported
**8 passed / 1 failed**, failing exactly the X2 guard:
`AssertionError: no FFDec glyph group/reference: expected '<svg xmlns="…' not to match
/font_Verdana/` (`X2-probe-guard-fails.log`). The probe patch was reverted, the pipeline
re-run (s58 back to `4a2510f2…62d0`), and the suite re-passed 9/9
(`X2-test-assets-final.log`). Probe source/logs are evidence only; the working tree contains
the restored, fixed pipeline.

## 6. Silent witness compliance (EXECUTION.md §8)

- Every browser run (asset render check, E2 visual suite) used Chromium with `--mute-audio`;
  the e2e config carries `launchOptions: { args: ['--mute-audio'] }` for all projects.
- No sound was played, decoded for playback, or opened; this task produced no audio.
- No network access was used; no `docs/**` file and no `../kelimator-nostalji/` path was
  touched.

## 7. Proposed docs/07 §4 line (for the orchestrator; X2 writes no docs/**)

> §4 regression guard (X2, 2026-09-28): `tests/assets.test.mjs` asserts the `letter_tile`
> template carries no baked placeholder glyph (FFDec `font_Verdana_A0` / `text0` / `text1`
> markers absent, tile anchors present); `tools/process-assets.mjs` removes exactly that
> authoring-only subtree set from the source text before SVGO, proven by a deliberate
> local probe (`evidence/X2-tile-glyph.md` §5).

## 8. Notes and hand-offs

- The source export under `artifacts/` is intentionally unmodified (not an owned path); the
  removal is a process-time correction, re-derived byte-exactly in §1.
- Frozen E2 evidence (`evidence/visual/E2/**`) was not touched; the live S2–S7 re-run
  artifacts are recorded under `evidence/X2-tile-glyph/e2-live/` and in the logs above.
- `evidence/visual/E1-svgo/**` was refreshed only for this asset (s58 pair + summary.json);
  the other 35 v1 reports remain frozen (the current tool would upgrade them to v2, which is
  outside this task's scope).
- If X1's tile-click fix later changes `src/ui/board.ts`, F3 should re-measure; this
  evidence pins the board.ts sha used for the S2–S7 numbers (§4).
- `evidence/logs/X2-*` and `evidence/X2-tile-glyph/**` are this task's only new evidence
  files.
