# Y4 — Speaker Knob Alpha Restore (owner defect from Y1) — evidence

Task: Y4 — knob alpha restore (`tasks/Y4-knob-alpha-restore.md`)
Started: 2026-09-29T14:06:33+03 (first Y4 command, alpha-asset verification; log mtime 14:06:33 +03)
Ended: 2026-09-29T14:26:22+03 (last evidence write after the final suite runs)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 · @playwright/test 1.63.0
Result: **PASS** (final statuses in §7)

All browser work used muted Chromium (`--mute-audio`, EXECUTION.md §8; Playwright
project launch args). No sound was played or decoded. No `docs/**` file was
edited (proposals in §9); git state was not touched; `../kelimator-nostalji/`
was not touched. No network access.

---

## 1. Defect and the fix asset (verified before use)

Byte facts (all re-measured locally; commands in `evidence/logs/Y4-*.log`):

| Source | Format | Alpha |
|---|---|---|
| `artifacts/decompiled/images/86.png` | PNG color type 6 (RGBA), 21×29 | real alpha: minA 0, maxA 255, 216 of 609 pixels < 255 |
| `artifacts/hd-assets/ai86-8x.png` (Y1 master) | PNG color type 6 (RGBA), 168×232 | corners alpha 0 |
| `artifacts/hd-assets/ai86-8x.webp` (Y1 pin, RGB) | WebP `VP8 ` chunk only (no VP8X/ALPH) | **alpha dropped** |
| `artifacts/hd-assets/ai86-8x-alpha.webp` (Y4 pin) | WebP `VP8X` + `ALPH` + `VP8 ` chunks, 9 086 B | true alpha |

`evidence/logs/Y4-alpha-verify.log` (muted Chromium decode of the staged asset):

- sha256 `a5a840abdca472e96d07325b7b6281ad1b0ee22e13700dc64a377bc13da29c45`
  == the task pin (verified before any use);
- 168×232, all four corner pixels `[0,0,0,0]` (alpha 0), minA 0 / maxA 255;
- the master paint is the same remaster: corner alphas match the PNG master and
  the RGB channels over the opaque pixels differ only by lossy-encode noise
  (mean distance 5.69/255, 70 of 21 914 opaque pixels > 30 — comparable to the
  Y1 RGB encode fidelity measurement, `evidence/Y1-remaster.md` §1).

Why it rendered black: the embedded `VP8 ` payload is opaque; bitmap 86's
transparent corner triangles (alpha mask of `images/86.png`) were painted from
the encoder's chroma/black residual → an opaque black chevron behind the
megaphone (before crop, §6).

## 2. Pipeline fix — deterministic RGBA payload pin (`tools/process-assets.mjs`)

- `HD_REMASTERS['s90_btn_speaker.svg']` now points at
  `artifacts/hd-assets/ai86-8x-alpha.webp` with sha256
  `a5a840ab…da29c45` (bitmap 47's pin is unchanged); comment records the Y4
  defect and the RGBA variant.
- The pinned-size reader was extended (`webpVp8Size` → `webpSize`): the simple
  lossy `VP8 ` container keeps the Y1 path (frame sync code + 14-bit size); the
  extended `VP8X` container (the alpha asset) is read from its 24-bit
  canvas-minus-one fields. Hash pin + dimension assertion + single-payload
  guard + absent-input skip are unchanged.
- The `VP8X` version check reads the same canvas size the pipeline asserts:
  168×232 (`Y4-svg-process.log` line for s90).

Pipeline runs (logs in `evidence/logs/`):

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `node tools/process-assets.mjs svg` | 0 | 36 assets, **0 mismatched pixels**; s90 `14444 → 14276 B`, ink 582 (`Y4-svg-process.log`) |
| 2 | `node tools/process-assets.mjs manifest` | 0 | 73 assets, 62 refs; s90 entry updated (`Y4-manifest-process.log`) |
| 3 | re-run #1 + #2 | 0/0 | full target hash list byte-identical (`Y4-rerun-hashes.log`) — **idempotent** |

Only the intended bytes changed (`Y4-post-pipeline2-restored-hashes.log` vs
`Y4-pre-pipeline-hashes.log`):

| Artifact | Before | After |
|---|---|---|
| `src/assets/svg/s90_btn_speaker.svg` | `9538d9b7323ecf743ab128854cc03d8485f3ac385e2f460d0b172702658a8591` | `19141e3d9f05a133410082c749dee30e8da77dda4eaa092aad7cf6dbe5a9dc1b` |
| `src/assets/manifest.json` | `15a32cc534f7ed41ea9f2c4761c50d48579ebd06f13d85a4fef1d5a62f42a801` | `776fb3fd9af23cd427f9b67ec9a53c68f8553d4d593aa8b73b3ab6f193bfdb64` |

The embedded payload was verified byte-identical to the pinned artifact
(base64 → sha256 `a5a840ab…` = `sha256(artifacts/hd-assets/ai86-8x-alpha.webp)`);
the manifest records `source` = the artifact, `sourceSha256` = the pin and keeps
`templateSource` provenance.

**Frozen E1 report side effect (kept clean).** `svg` regenerates all 36 assets
and rewrites `evidence/visual/E1-svgo/**`; the 34 non-remaster asset dirs hold
*frozen* v2-schema `report.json` files (Y1 deliberately restored them), while the
current tool emits v3. All 34 were restored byte-exactly from the Y1 backup
(`artifacts/y1-captures/E1-svgo-backup/`, hashes verified against the
pre-pipeline snapshot before the restore; `Y4-post-pipeline-restored-hashes.log`).
The refresh required by the task is confined to `s90_btn_speaker/**` (§5) plus
`summary.json` (necessarily rewritten by the pipeline; same convention as Y1).

## 3. Same-bug-class audit — only s48 (bitmap 47) and s90 embed rasters

Audit result: **bitmap 47 is opaque by design; no change needed.** Measured:

| Fact | Value |
|---|---|
| `artifacts/decompiled/images/47.png` | PNG color type 2 (truecolor, **no alpha channel**), 550×400; decoded minA = maxA = 255, 0 non-opaque pixels |
| `artifacts/hd-assets/ai47-x4plus-8x.png` (master) | color type 2, opaque |
| `artifacts/hd-assets/ai47-x4plus-8x.webp` (pin) | RIFF chunks: `VP8 ` only (no `VP8X`/`ALPH`) — RGB encode, correct for the source |
| `src/assets/svg/s48_board_backdrop.svg` | the bitmap is a `fill:url(#PatternID_48_1)` rect covering the full 550×400 stage box; nothing relies on transparency |

So the Y1 encode for bitmap 47 did **not** lose anything: there is no alpha in
the 2012 source, in the PNG master, or in the owner remaster. The assets guard
now pins this too (`alpha: false` for s48, `alpha: true` for s90 —
`tests/assets.test.mjs`).

## 4. Rendered-corner guard (`tests/e2e/speaker/corner-alpha.spec.ts`)

New speaker-suite spec (2 tests, dsf 1 and 2). It screenshots the stage, decodes
the PNG with the F1 tool's own decoder (`verify/diff/diff.mjs`) and asserts the
sample pixels in bitmap 86's transparent corners are NOT opaque black (and are
light, sum ≥ 150):

- sample rects (dsf1 stage px): `(517,369,3,3)` and `(517,393,3,2)` — inside the
  bitmap's transparent top-left / bottom-left triangles (bitmap draw box
  measured at `(515,367,22,30)`, `evidence/Y1-remaster.md` §5); scaled ×dsf at
  dsf 2;
- reference values at those pixels (`speaker-before.png`): `245,226,171` /
  `249,229,177` (light backdrop);
- **pre-fix committed capture** (`evidence/visual/Y1/after-S2-dsf{1,2}-actual.png`):
  `rgb(1,1,1)` at every sampled pixel, dsf 1 and 2 — the guard targets a real,
  recorded regression state;
- post-fix capture (`evidence/visual/Y4/after-S2-dsf1-actual.png`): `249-255,
  225-230, 176-179` (light) at every sampled pixel.

**Deliberate guard probe** (`Y4-corner-probe.log`; X2/Y1 discipline): the
pre-fix payload SVG was reconstructed byte-exactly
(`evidence/visual/Y4/probe/s90_btn_speaker-rgb-probe.svg`, sha256
`9538d9b7…` = the Y1 committed s90 bytes) and swapped in; the corner spec then
failed at both dsf with `stage(517,369) = rgb(1,1,1) … must not be opaque black`
and `stage(1034,738) = rgb(1,1,1) …` (exit 1). The fixed file was restored
(sha `19141e3d…` verified). Probe result: the guard fires on the defect and only
on the defect.

The assets guard (`tests/assets.test.mjs`) was probed the same way: with the old
RGB payload in place, `npx vitest run tests/assets.test.mjs` fails with
`svg/s90_btn_speaker.svg alpha channel: expected false to be true` plus the file
sha mismatch (`Y4-assets-guard-probe.log`); restored and re-passing (11/11 in
the full run §7).

Note for the record: the corner sample pixels also lie inside other Y1
allowance 10-px cells, so the *visual* suite alone still would not flag a
corner regression — the new speaker-suite guard is the enforcement point (the
same masking property as §5's "masked by the allowance" line).

## 5. Allowance rect re-measurement `(515,367,22,30)` (`tests/e2e/speaker/knob-rect-remeasure.mjs`)

Method (mirrors Y1): the visual suite's S2 captures
(`test-results/E2-live/S2/dsf{1,2}/actual.png`, muted Chromium, stage 550×800 /
1100×800) against `tests/fixtures/reference/S2-idle-board.png` /
`tests/fixtures/reference/dsf2/S2-idle-board.png`; the F1 tool
(`compareImages`/`runComparison`, same call the suites make) for aggregates and
its documented per-pixel definitions for the tight bboxes (RGB distance > 30;
radius-2 symmetric tolerance). Mirror read from
`evidence/visual/Y1/derivation/final-rects.json`; Y2 rect `0,367,105,33`.
Raw numbers: `Y4-remeasure-final.log` / `evidence/visual/Y4/remeasure/analysis.json`.

Inside the current knob rect `(515,367,22,30)`, with the knob rect itself
removed from the allowance (dsf1 stage pixels; dsf2 divided by 2, union):

| Measure | pre-fix (Y1 RGB) | post-fix (Y4 alpha) | post-fix union dsf1/2 |
|---|---|---|---|
| raw mismatch (> 30) | 257 px dsf1 / 907 px dsf2 | 229 px dsf1 / 782 px dsf2 | bbox `515,370,22,20` |
| tolerant-unmatched | 99 px dsf1 / 452 px dsf2 | 75 px dsf1 / 356 px dsf2 | bbox `515,370,21,20` |
| raw bbox (dsf device) | dsf1 `515,370,22,20`; dsf2 `1031,740,42,40` | dsf1 `515,370,22,20`; dsf2 `1031,740,42,40` | — |

- The deviation that the Y1 rect also covered in rows 367–369 (top) and
  390–396 (bottom) is gone: those rows contained the transparent-corner black
  box; the remaining owner-approved knob texture deviation lives in
  `y 370–389` only.
- Candidate shrink `(515,370,22,20)` (the union raw bbox; it also covers the
  tolerant union): run through the F1 tool on S2 dsf1/dsf2 →
  ignoredPixels `65 930`/`263 720` and tolerant `0.659 %`/`0.178 %`, byte-for-byte
  the same pass basis as the old rect (`candidate-dsf{1,2}/report.json`) — i.e.
  the shrunk rect excludes exactly the pixels that still deviate and no longer
  masks the defect rows.
- Dropping the rect entirely was measured too: without it, S2 tolerant rises to
  `0.693 %` (dsf1) / `0.219 %` (dsf2) — still passing, but 229/782 raw and
  75/356 tolerant pixels of *owner-approved* remaster texture would enter the
  verification budget. Rejected: keep the smallest rect that covers the
  deviation.

**Decision: shrink `(515,367,22,30)` → `(515,370,22,20)`.** Applied consistently
(verified equal, 138 rects each):

- `tests/e2e/visual-states.ts` `Y1_IGNORE_RECTS` (last entry; derivation comment
  updated with the Y4 re-measurement);
- `evidence/visual/Y1/derivation/final-rects.json` (last entry; JSON format
  unchanged);
- suites that consume the allowance re-run: visual **18/18**, animations
  **8/8**, playthrough **3/3** (§7). The Y1 overlay image
  (`final-rects-overlay.png`) is left as Y1 history.

The knob rect masked the defect: pre-fix, all opaque-black pixels of the defect
(159 dsf1 / 832 dsf2 inside the draw box) lay inside the Y1 knob rect (plus
nearby cells), so the visual suite stayed green while the app visibly showed the
black chevron — the defect was caught by the owner, not by the suite. The Y4
corner guard (§4) closes that hole, and the shrunk rect no longer covers the
rows where the defect lived.

## 6. Before/after knob crops (dsf 1 + 2)

Crops of the C3 box `(505,356,45,44)` ×dsf; `evidence/visual/Y4/`:

| File | SHA-256 | Size |
|---|---|---|
| `knob-before-dsf1.png` | `41d1b0b3e86063ecdcd7543b4e3d10889f67ee928ab2bb2753b9ee6a041a3de2` | 45×44 |
| `knob-before-dsf1-zoom.png` (×8) | `1bb37a4ff2bb9059788f321634f99fb7d8a40b0706bfe90e74719fc6ae2d2720` | 360×352 |
| `knob-after-dsf1.png` | `1a92250e35cdf63f4abf6212c900c98678cff7910ceadb1b00cf1677c57e5a0f` | 45×44 |
| `knob-after-dsf1-zoom.png` (×8) | `5ea1d113a63e1538b60a10f576de263b92c9725a684d3ffe9887c2e808acb0ed` | 360×352 |
| `knob-before-dsf2.png` | `84abab85e01f8aa8443d606f71a1c0c363dc1c2e1c985edd4efc032ddfea0992` | 90×88 |
| `knob-before-dsf2-zoom.png` (×4) | `217fbeda381c574c90c44e5c922e4a40309d96d533d0a17f5655ddce617da70e` | 360×352 |
| `knob-after-dsf2.png` | `c74818de8ecb51ef2d68aaed5e73f484993430ae798a819194d5baac06f8f539` | 90×88 |
| `knob-after-dsf2-zoom.png` (×4) | `f5a5459528734b0881503a3d584f9d40066197f8c3ca079f42dbed6ea062a739` | 360×352 |

Sources: before = `evidence/visual/Y1/after-S2-dsf{1,2}-actual.png` (the exact
pre-fix committed state; `8031e8d1…`/`d427613c…`), after =
`evidence/visual/Y4/after-S2-dsf{1,2}-actual.png` (`0143c77a…`/`aa19028a…`,
copied from the final visual-suite captures). The before crops show the opaque
black chevron around the megaphone; the after crops show the megaphone over the
light backdrop.

**E1-SVGO s90 render preservation (refreshed).** The pipeline refreshed
`evidence/visual/E1-svgo/s90_btn_speaker/**` for the new payload: standalone
SVG render before==after (`before.png` = `after.png` =
`5a55329e7293bad06929285f0e3cbcde346ed1eacfd9859822099b40c5acfd3c`),
`mismatchedPixels: 0`, source `14444 → 14276 B`, ink 582
(`Y4-svg-process.log`); `summary.json` refreshed
(`a5dd9378…`, artifact/sha of the new pin). The other 35 E1 dirs are untouched
(§2).

## 7. Final suite results (logs in `evidence/logs/`)

| Suite | Command | Result |
|---|---|---|
| Speaker (O24/O25 semantics + new Y4 corner guard) | `npm run e2e -- speaker` | **5 passed** (3 existing + corner spec dsf1/dsf2) — `Y4-speaker-final.log`; guard probe `Y4-corner-probe.log` |
| Visual (V5+V2+V7+Y2) | `npm run e2e -- visual` | **18 passed** — S2 dsf1 raw 2.678 %/tolerant **0.659 %** (1449 px, ignored 65 930), dsf2 2.654 %/**0.178 %** (1568 px, ignored 263 720) with the shrunk rect; S1 no allowance — `Y4-visual-final.log` |
| Animation (V5+V2+V7) | `npm run e2e -- animation` | **8 passed** — board @0.0 tolerant 0.685 %, wordball 0.744–0.980 %, ignored 65 930 — `Y4-animation.log` |
| Playthrough (V6+V5) | `npm run e2e -- playthrough` | **3 passed** — 40 steps, worst tolerant **1.273 %**; S9 timeout 0.568 %, app wait 200 019 ms — `Y4-playthrough.log` |
| Unit tests | `npm test` | **14 files / 238 tests passed** (assets 11/11 incl. the alpha guard) — `Y4-test.log` |
| Lint / build | `npm run lint` / `npm run build` | exit 0 / exit 0 (tsc + Vite; pre-existing chunk-size warning only) — `Y4-lint.log`, `Y4-build.log` |
| Pipeline | `node tools/process-assets.mjs svg` + `manifest` (×2) | exit 0; idempotent (`Y4-svg-rerun.log`, `Y4-rerun-hashes.log`) |

## 8. Hash inventory

| Artifact | SHA-256 |
|---|---|
| `tools/process-assets.mjs` | `2466052edf44addf444e45e1e62a6e357634c6c40a1918254a9dad7945e15a5a` |
| `tests/assets.test.mjs` | `7698293a75ebb76f2cbd61212314f5d293be31778ae0dd12409e243cdd37a6bb` |
| `tests/e2e/visual-states.ts` | `2c51065046f1d01be6ad5d7fb1f64853533fc84e2a62c26e30750e0033d9e591` |
| `tests/e2e/speaker/corner-alpha.spec.ts` (new) | `c528b947910d580e1fe8cbfa83da0c9a452a72a67ec44b524d2b4fb789f01922` |
| `tests/e2e/speaker/knob-rect-remeasure.mjs` (new) | `b1fc382bc12f0569c5c6ee5c30bf59d73982d75be4a8a42a0c92a3105b2bb90e` |
| `src/assets/svg/s90_btn_speaker.svg` | `19141e3d9f05a133410082c749dee30e8da77dda4eaa092aad7cf6dbe5a9dc1b` |
| `src/assets/manifest.json` | `776fb3fd9af23cd427f9b67ec9a53c68f8553d4d593aa8b73b3ab6f193bfdb64` |
| `evidence/visual/Y1/derivation/final-rects.json` | `0adb8540bdc354e0fa39a8a29fe4f5cda5490d9b01839ae393714c9eff9e31e0` |
| `evidence/visual/E1-svgo/s90_btn_speaker/before.png` = `after.png` | `5a55329e7293bad06929285f0e3cbcde346ed1eacfd9859822099b40c5acfd3c` |
| `evidence/visual/E1-svgo/summary.json` (refreshed) | `a5dd9378eef88f6fe5a2a53d8a87b96bb2cd07d254d47871744561d43af87907` |
| `evidence/visual/Y4/probe/s90_btn_speaker-rgb-probe.svg` (probe = pre-fix bytes) | `9538d9b7323ecf743ab128854cc03d8485f3ac385e2f460d0b172702658a8591` |
| `evidence/visual/Y4/after-S2-dsf1-actual.png` | `0143c77aadb6123c9b179eccaed7e4860d3204f23bede49417fe49bbd81acd59` |
| `evidence/visual/Y4/after-S2-dsf2-actual.png` | `aa19028ab364f3c8f96fce296c407c8451ad084d6d5e34d98f6d89a4b43d3f71` |
| staged fix input `artifacts/hd-assets/ai86-8x-alpha.webp` (not modified) | `a5a840abdca472e96d07325b7b6281ad1b0ee22e13700dc64a377bc13da29c45` |

## 9. Proposed docs lines (single-writer: the orchestrator applies these)

**`docs/03-assets-and-visuals.md` §2 — amendment (follow-up to the Y1 record):**

> Amendment 2026-09-29 (owner final wave Y4, defect from Y1): the Y1 WebP encode
> of bitmap 86 embedded in `s90_btn_speaker.svg` dropped the alpha channel, so
> the knob's transparent corners rendered as an opaque black chevron in the app
> (the Y1 reference-diff allowance masked the pixels, so the visual suite stayed
> green; the owner caught it). The pin in `tools/process-assets.mjs`
> `HD_REMASTERS` is now the RGBA encode `artifacts/hd-assets/ai86-8x-alpha.webp`
> (extended WebP `VP8X`/`ALPH`/`VP8`, 168×232, sha256 `a5a840ab…da29c45`); the
> size reader understands both containers; the manifest records the new
> artifact/sha; `tests/assets.test.mjs` asserts s90 declares alpha (and s48
> stays the opaque RGB payload — bitmap 47 has no alpha in its source, audited).
> Deterministic/byte-identical pipeline re-runs proven. Evidence:
> `evidence/Y4-knob-alpha.md` §1–§5.

**`docs/07-verification.md` §4 — amendment (allowance update):**

> Amendment 2026-09-29 (owner final wave Y4): after restoring bitmap 86's alpha,
> the Y1 speaker-knob allowance rect was re-measured with the F1 tool on the S2
> captures: the remaining remaster deviation bbox (raw > 30, union dsf 1/2 in
> dsf1 stage coordinates) is `515,370,22,20`, so `Y1_IGNORE_RECTS` shrank from
> `515,367,22,30` to `515,370,22,20` (mirror
> `evidence/visual/Y1/derivation/final-rects.json` updated; effective ignored
> pixels unchanged: 65 930/263 720; S2 tolerant 0.659 %/0.178 %; all board
> comparisons remain ≤ 2 %). The new rendered-corner regression guard
> (`tests/e2e/speaker/corner-alpha.spec.ts`, dsf 1+2) asserts the knob's
> transparent pixels are not opaque black. Evidence:
> `evidence/Y4-knob-alpha.md` §4/§5/§7.

**`docs/08-open-items.md` — proposed entry:**

- Fixed defect: `2026-09-29 — Y4 knob alpha restore: Y1's RGB WebP (bitmap 86)
  rendered transparent corners opaque black (masked by the Y1 allowance);
  RGBA payload `ai86-8x-alpha.webp` (`a5a840ab…`) pinned/embedded, manifest +
  assets guard (alpha assertion) updated, rendered-corner e2e guard added
  (dsf 1/2; probe-verified), knob allowance rect shrunk 515,367,22,30 →
  515,370,22,20; suites green. Evidence: evidence/Y4-knob-alpha.md.`

## 10. Silent witness and hygiene

- Every browser run (pipeline SVGO renders, all e2e suites, the guard probe)
  used Chromium with `--mute-audio`; no sound was played or decoded; no Ruffle
  run. No network access.
- No `docs/**` file was written (proposals above), no git operation, and
  `../kelimator-nostalji/` was not touched.
- Owned-path discipline: source edits limited to the task-owned files
  (`tools/process-assets.mjs`, `src/assets/svg/s90_btn_speaker.svg`,
  `src/assets/manifest.json`, `tests/assets.test.mjs`, `tests/e2e/speaker/**`,
  `tests/e2e/visual-states.ts`, `evidence/visual/Y1/derivation/final-rects.json`,
  `evidence/visual/E1-svgo/s90_btn_speaker/**`, `evidence/Y4-*`,
  `evidence/visual/Y4/**`, `evidence/logs/Y4-*`). The 34 frozen E1 dirs were
  restored byte-exactly after the pipeline refresh (§2); `summary.json` was
  refreshed by the pipeline (Y1 convention).

## 11. Result

**PASS** — RGBA payload pinned, embedded and manifest-recorded (byte-identity
and idempotency proven); bitmap-47 audit recorded (opaque by design, no change);
rendered-corner guard added and probe-verified at dsf 1 and 2; knob allowance
rect re-measured and shrunk consistently in the wiring and the derivation
mirror; speaker 5/5, visual 18/18, animation 8/8, playthrough 3/3, unit
238/238, lint/build exit 0; before/after crops, hashes and proposed docs lines
recorded.
