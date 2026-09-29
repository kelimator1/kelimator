# Y8 — Intro/Welcome Sequence, HD Vector (closes O23)

Task: Y8 — intro sequence (owner directive, closes O23; serialized after Y6/Y7)
Started: 2026-09-29T18:50+03:00 (first write: `evidence/logs/Y8-main-tracks.json`)
Ended: 2026-09-29T22:55+03:00
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 ·
@playwright/test 1.63.0 · pinned Ruffle 0.6.0 web self-hosted (C3 asset)

Result: **PASS** — boot plays preloader(1–4) → intro(5–130) → first settled board on every
boot/reload; the intro is rendered in HD vector (existing SVGs, sub-pixel CSS
transforms/opacity, `GLOW_GRADIENT` reused for the sun, no rasterization, no new bitmaps);
input locked during the intro; keyframe comparisons at all five catalog offsets pass at
deviceScaleFactor 1 and 2 (worst tolerant 1.386 %, limit 2.000 %); boot e2e + unit suite
green; full visual 18 / animation 8 / playthrough 3 / interaction 6 / controls 4 /
speaker 7 / timeout 1 / offline 1 / intro 14, unit 242, lint/build exit 0; the 10
substantive `tools/verify-all.sh` steps PASS (step 11 `frozen evidence` reports the
uncommitted Y8 files — expected until the orchestrator commits; see §8).

---

## 1. Night→day mechanism (the task's investigation finding)

**Finding: night→day is an alpha crossfade of two day layers over static night layers —
not a CXFORM colour shift of the night elements.**

- The night layers (`intro_backdrop` ch1 depth 2 with the black field + `#ffffde` stars,
  `logo_ornament` ch3 depth 3 = the crescent moon at alpha 125/256) are **static** for the
  whole intro: `tags.xml` has exactly one `PlaceObject2Tag` each (place frame 2, no Move,
  no Remove) and no colour transform change.
- The day sky (`intro_sky` ch5 depth 5) is placed at frame 2 with `alphaMultTerm="36"`
  (14.1 %) and every frame 6–40 carries a `PlaceObject2Tag placeFlagMove="true"` with an
  **alpha-only** `CXFORMWITHALPHA` (42, 48, 54 … 250); frame 41 carries the *identity*
  colour transform (empty `<colorTransform>` → alpha 256/256 = opaque). From frame 41 to
  130 the sky is fully opaque, covering the night backdrop + moon → **dawn→day**.
- The golden ground surface (`intro_layer3` ch8 depth 9) mirrors the same alpha ramp
  (place alpha 51, moves 57 … 250, identity at frame 41) over the static black ground
  (`intro_ground` ch6 depth 8, no transform) → the ground brightens from dark brown to
  golden in the same window.
- Excerpts (`artifacts/decompiled/tags.xml`, main timeline; SHA-256
  `c5290f02ea0d8bedec255fa64c476877f41adf09bbf92aa565e90f2bb5523765`):
  - line 234: `PlaceObject2Tag characterId="5" depth="5" … placeFlagHasColorTransform="true"` +
    line 236 `<colorTransform type="CXFORMWITHALPHA" alphaMultTerm="36" …/>`;
  - line 41071 (frame 5→6): depth 5 move with `alphaMultTerm="42"`; line 41078:
    depth 9 move with `alphaMultTerm="57"`;
  - line 41148/41151 (frame 40): depth 5 `alphaMultTerm="250"`, depth 9 `alphaMultTerm="250"`;
  - line 41249 (frame 41): depth 5 move with an **empty** `colorTransform` element
    (identity → alpha 256); the same at 41256 for depth 9.
- The sun (`intro_glow` ch20 depth 7) rises **behind** ground/layer3 (depth 7 < 8 < 9):
  place frame 5 `tx=5202 ty=5982` with the colour transform
  `redMultTerm=46 redAddTerm=209 greenMultTerm=46 greenAddTerm=125 blueMultTerm=46 blueAddTerm=42`
  (= a linear blend toward `C=(255,152,51)` with `t = 1 − mult/256 = 0.8203`; the adds are
  `(1−t)·C` rounded), then 214 Move tags to frame 129
  (`ty −58 twips = −2.9 px`/frame, `t → 0`) — reproduced with the existing
  `GLOW_GRADIENT` (`src/ui/board.ts`) plus an orange overlay whose opacity steps
  `1 − redMultTerm/256` (see §6).
- The falling wordmark (`intro_logo` ch29 depth 47): place frame 41
  `tx=5356 ty=−900 scaleX=0.7886658`, 86 Move tags to frame 202 (intro part 41–130:
  fall → settle at (267.8, 280) scale 1.0 → shrink/move to the top-left board position
  (91.8, 26) scale 0.4791) — reproduced as translate+scale with `transform-origin: 0 0`.

Per-frame series extracted from `tags.xml` (frame → alpha / ty / scale) and used by the
implementation and the reference-frame labelling:
`evidence/logs/Y8-main-tracks.json` (all main-timeline tracks, depths 2/3/5/7/8/9/47) and
`evidence/logs/Y8-intro-series.json` (the series the CSS keyframes are generated from,
SHA-256 `d0a4461e…`).

Owner live reference cross-check (`artifacts/o23-captures/`, ~90 ms/frame; the marks
`f40 → night+moon, f44 → dawn, f48 → sunrise, f54 → logo falling, f62 → landing,
f69 → settled`): the measured sun-top edge maps to SWF frames with the calibrated +7 px
warm-core offset (§3.1):

| o23 frame | t (ms) | sun top y | mapped SWF frame | owner note |
|---|---|---|---|---|
| f40 | 3494 | 228 | 15.8 | night+moon |
| f44 | 3867 | 187 | 29.9 | dawn |
| f46 | 4076 | 167 | 36.8 | — |
| f48 | 4243 | 150 | 42.7 | sunrise (sky fully faded at frame 41) |

The owner's sky probe at (500,60) confirms the same ramp: f40 (31,63,86) = 40 % alpha,
f47 (75,153,208) ≈ 250/256, f48+ (77,157,213) = full — exactly the frames 6–40 alpha
series of `tags.xml`.

## 2. Boot sequencing (D5) — played on every boot/reload

`src/game/lifecycle.ts`: `start()` keeps the synchronous `boot → preloader` transition and,
when boot timings are supplied (the production path), schedules
`preloader(1–4) → main(5–130) → newRound()` through an injectable scheduler. An explicit
round start (`selectRound`, Yeni Oyun) cancels the pending boot chain and passes
`preloader → main → playing` (no double round; the boot timer cannot fire mid-round).
Without boot timings `start()` keeps the pre-Y8 synchronous path (unit tests).

`src/main.ts` passes `boot: bootTimingsMs()` (4/36 s = 111.1 ms preloader; 126/36 s =
3500 ms intro; `src/ui/animations.ts` derives both from `data/animation.json`), renders the
preloader/main board views on the state changes and keeps the dev-only
`window.__bootLog` state history.

Evidence of the sequence (e2e, `tests/e2e/intro/intro.spec.ts`):
`__bootLog` = `boot → preloader → main → playing`; preloader span 111–300 ms
(setTimeout/paint jitter; catalog 111.1 ms), intro span ≈ 3502 ms (catalog 3500 ms);
the intro state renders the intro element set (in the raised boot layer, §6), the first
settled board follows automatically with the round tiles. The intro replays on reload
(`intro_sky`/`intro_logo` on stage again, then `playing`). Input stays locked while the FSM
is in `preloader`/`main`: letter/SPACE/ENTER/BACKSPACE keys and a tile-area click leave
`state === 'main'`, `score === 0`, `foundWords === []` (the reference defines its key
handlers in `frame_131/DoAction.as` only — `myListener.onKeyDown`, `Key.isDown` — and
`frame_5/DoAction.as` has none; `bitti = 0` is set only by `baslat()`, evidence/A2-input.md
§3 / evidence/A2-edges.md §3).

## 3. Reference keyframe captures (extend the C3 scenario pattern)

`tests/e2e/intro/capture-intro-reference.mjs` uses the C3 ingredients — the pinned
`verify/reference/server.py` + Ruffle 0.6.0 web self-hosted build + the reconstructed
Base64(UTF-8) fixture; Chromium launched with `--mute-audio`; no CLI, no network beyond
127.0.0.1 — and adds what the scenario engine cannot do for the intro (no state trigger
between preloader and board, evidence/E3-animations.md §3 rows 1–2/5–6): a
capture-while-playing loop over the SWF canvas plus per-shot measurement against the
main-timeline series, keeping the best capture per target frame. Frame 5 additionally needs
a *paused* capture (the reference's ad gate resumes the preloader loop and the first
rendered tick lands on frame 6; a page-side pauser + sub-frame 10 ms steps catch frame 5;
the state is verified by the offset-free sky alpha 36/256).

### 3.1 Measurement model and the sun-edge offset

The warm-pixel blob of the sun is the disc's *saturated core*, not the geometric disc: the
radial gradient fades to transparent at the rim, so the warm threshold
(`r−b ≥ 40`, `r ≥ 180`, `g ≥ 90`, `b ≤ 205`) cuts inside it. Derivation (day sky behind):
`alpha(r) = (1−r)/(1−0.7686)`; tinted colour `(248+7t, 241−89t, 162−111t)`;
`r−b = alpha·(86+118t) − 136(1−alpha) = 40` → `alpha = 176/(222+118t)`; the top edge sits
`(1−r)·R = alpha·0.2314·46.75 px` below the geometric top — +6.5 px at t = 0.60 (frame 38),
+7.1 px at t = 0.40, +7.8 px at t = 0.19. The estimator uses **+7 px top / −8.5 px
bottom**, and for frames 5–41 the sky-alpha ramp (an offset-free ruler:
`alpha = green(500,60)/157`, the full-fade value measured identically in
`tests/fixtures/reference/S1-boot.png`, its dsf2 counterpart, the o23 f69 frame and the C3
board captures) validates/prefers the label. Validation measurements on the delivered
captures:

| capture | sky alpha (measured) | catalog alpha | sun top (measured) | predicted top (+7) | sun bottom | predicted bottom (−8.5) |
|---|---|---|---|---|---|---|
| frame 36 dsf1 | 138/157 = 0.879 | 225/256 = 0.879 | 170 | 169.45 | 235 (band) | 262.0 (clipped) |
| frame 68 dsf1 | 1.000 | 1.000 | 76 | 78.7 | 155 | 154.95 |
| frame 99 dsf1 | 1.000 | 1.000 | 0 (clipped) | −22.8 (clipped) | 63 | 64.75 |

Frame 130 (the intro's last frame) is labelled by the fully-in-band wordmark union box
(predicted vs measured bbox residual 13.96 px² over a 181.8×51.2 px box), and frame 5 by
the sky alpha. Every capture's `measuredFrame` equals its target (`capture-report.json`).

### 3.2 Stability (byte identity across independent runs)

Sessions run in fresh browser contexts; two independent `dsf1` runs and two `dsf2` runs
were recorded (plus a third `dsf1` run after the capture-source change to the canvas
element):

| frame | dsf1 run1 | dsf1 run2 | dsf1 run3 (canvas) | dsf2 run1 | dsf2 run2 |
|---|---|---|---|---|---|
| 5 | `9f43f9d8…` | `9f43f9d8…` | `9f43f9d8…` | `3235d57f…` | `3235d57f…` |
| 36 | `30392a59…` | `30392a59…` | `30392a59…` | `d4b86e07…` | `d4b86e07…` |
| 68 | `5bf35a81…` | `5bf35a81…` | `5bf35a81…` | `b765f90e…` | `b765f90e…`* |
| 99 | `f1be3083…` | `f1be3083…` | `f1be3083…` | `d5e2dc12…` | `d5e2dc12…` |
| 130 | `0d3f5e2c…` | `0d3f5e2c…` | `0d3f5e2c…` | `dd116c19…` | `dd116c19…` |

\* dsf2 frame 68: the re-run was captured in a separate invocation
(`ref2-dsf2-run3`, `3d80d648…`); the two images differ in exactly 4 pixels of an 9×2 px
sun-edge patch (max channel-sum delta 67; mean |Δ| 0.0003) — Ruffle's sub-pixel edge phase;
the other 879 996/880 000 pixels are byte-identical. Canonical captures:
`evidence/visual/Y8/reference-dsf1/frame-*.png` (SHA-256 in §10) and
`evidence/visual/Y8/reference-dsf2/frame-*.png` (+ each directory's `capture-report.json`
with the per-session shot counts, candidate hits, measured features and residuals).

## 4. Keyframe comparisons (V5) at the catalog offsets, dsf 1 + 2

The app is driven to the catalog offset deterministically: the five intro CSS animations
are paused and `currentTime` is set to `offset × 1000` (no wall-clock waits), then the
stage is captured and compared with the reference capture through the F1 tool
(`verify/diff/diff.mjs`, tolerant radius 2, no owner allowance — the intro has none).
Recorded run (`Y8_RECORD=1`, `evidence/logs/Y8-e2e-intro-recorded.log`); artifacts:
`evidence/visual/Y8/intro-f<frame>/dsf<dsf>/{actual.png,<offset>.report.json,<offset>.heatmap.png}`.

| frame | offset (s) | dsf | raw | tolerant | limit | verdict |
|---|---|---|---|---|---|---|
| 5 | 0.0 | 1 | 0.344 % | **0.015 %** | 2 % | PASS |
| 36 | 0.8611 | 1 | 0.877 % | **0.000 %** (1 px) | 2 % | PASS |
| 68 | 1.75 | 1 | 2.771 % | **0.193 %** | 2 % | PASS |
| 99 | 2.6111 | 1 | 3.511 % | **1.142 %** | 2 % | PASS |
| 130 | 3.4722 | 1 | 1.886 % | **0.021 %** | 2 % | PASS |
| 5 | 0.0 | 2 | 0.232 % | **0.004 %** | 2 % | PASS |
| 36 | 0.8611 | 2 | 0.629 % | **0.093 %** | 2 % | PASS |
| 68 | 1.75 | 2 | 2.247 % | **0.422 %** | 2 % | PASS |
| 99 | 2.6111 | 2 | 3.002 % | **1.386 %** | 2 % | PASS |
| 130 | 3.4722 | 2 | 1.399 % | **0.156 %** | 2 % | PASS |

The residual is the fixed Chromium-vs-Ruffle rasterization gap (evidence/E2-layout.md
§6/§11) plus the soft sun gradient's 2–3 px edge band (worst at frame 99, where the sun is
clipped at the stage top).

## 5. Implementation (E3 visual + cadence)

- `src/styles/animations.css`: five generated keyframe blocks
  (`e3-intro-sky`, `e3-intro-layer3`, `e3-intro-glow-path`, `e3-intro-glow-tint`,
  `e3-intro-logo-v`) with one stop per SWF frame, `steps(1, end)` and duration
  `calc(126s / 36)` — the app shows exactly the SWF frame's value in its 1/36 s slot, like
  the reference's per-frame Move tags. Values come from `evidence/logs/Y8-intro-series.json`
  (never hand-edited). The sun path is relative to the catalog box (layout.json
  `intro_glow` y = −104.9 = the frame-129 state): the track starts at translateY(359 px)
  (frame 5) and ends at 0 (frame 129) — a cross-check that the A3 display bbox is the
  frame-129/131 position.
- `src/ui/animations.ts`: arms the tracks on the *boot-layer* nodes when the FSM enters
  `main`, attaches the sun tint layer (a child of the existing `.board-glow` element that
  repeats `GLOW_GRADIENT`'s alpha profile with the blend colour `(255,152,51)`), applies
  the preloader static alphas (sky 36/256, layer3 51/256, moon 125/256), and raises the
  boot layer above the mounted board layout via a single stacking-context wrapper
  (`.e3-boot-layer-root`, z-index 30 000; the boot nodes keep the reference depth order
  through their inline z-index values). While the wrapper is present the board layout is
  `visibility: hidden` (the reference has no board elements before frame 131; the DOM stays
  for the E2 V7 geometry check) and the speaker's `data-speaker` marker is cleared (its
  sprite is placed at frame 131 only).
- Assets: **no new assets** — `intro_backdrop`, `logo_ornament`, `intro_sky`,
  `intro_ground`, `intro_layer3`, `intro_glow`, `intro_logo` are the existing processed
  SVGs (`src/assets/svg/s1/s3/s5/s6/s8/s20/s29_*.svg`), the sun's base uses the existing
  `GLOW_GRADIENT`, the wordmark overlay renders its SVG at the natural 375.4×104.6 box and
  is animated by transform only (no rasterization; `src/assets/manifest.json` unchanged —
  `tools/process-assets.mjs` was not needed). The `intro` wordball/clip sprites remain
  0×0/blank templates, as in the catalog.

## 6. Suites and commands (all from the repo root)

| # | Command (exact) | Exit | Result |
|---|---|---|---|
| 1 | `npm run e2e -- intro --reporter=line` | 0 | 14 passed (recorded variant `Y8_RECORD=1`, ratios §4) |
| 2 | `npm run e2e -- visual` | 0 | 18 passed |
| 3 | `npm run e2e -- animation` | 0 | 8 passed |
| 4 | `npm run e2e -- playthrough` | 0 | 3 passed |
| 5 | `npm run e2e -- interaction` | 0 | 6 passed |
| 6 | `npm run e2e -- controls` | 0 | 4 passed |
| 7 | `npm run e2e -- speaker` | 0 | 7 passed |
| 8 | `npm run e2e -- timeout` | 0 | 1 passed |
| 9 | `npm run e2e -- offline` | 0 | 1 passed |
| 10 | `npm run e2e` (all) | 1 | 68 passed, 1 failed — `smoke.spec.ts` asserts `state === 'playing'` immediately after `page.goto` (the pre-O23 synchronous boot); with the intro the honest state is `preloader`/`main`. The spec is outside Y8's owned paths and its expectation is superseded by the owner directive; smoke is not part of the F3/verify-all matrix (§8). |
| 11 | `npm test` | 0 | 15 files, 242 tests (239 + 3 boot-sequence tests) |
| 12 | `npm run lint` | 0 | clean |
| 13 | `npm run build` | 0 | tsc + Vite (chunk-size warning only, documented D1 note) |
| 14 | `tools/verify-all.sh` | 1 | 10/11 steps PASS; step 11 `frozen evidence` reports the uncommitted Y8 files (expected pre-commit; the orchestrator's closing run after the commit must be green) |

Logs: `evidence/logs/Y8-*` (unit, lint, build, each suite, the full run, the recorded intro
run, the reference-capture log and the two series JSONs).

## 7. Silent witness (EXECUTION.md §8)

All reference runs launch Chromium with `--mute-audio` (recorded in
`capture-report.json` `launchArgs`); no Ruffle CLI was used; no network beyond
127.0.0.1; no audio assertions anywhere.

## 8. docs/08 proposal — closes O23 (orchestrator applies)

```
RESOLVED 2026-09-29 — evidence/Y8-intro.md — boot intro reproduced from the SWF main-timeline tracks: preloader(1–4) → intro(5–130) → first settled board on every boot/reload with input locked during the intro; night→day is an alpha crossfade of intro_sky (alpha 36/256 → 256/256, frames 6–41) and intro_layer3 over the static night backdrop/stars + moon — not a CXFORM shift; the sun is intro_glow on its 125-move path (2.9 px/frame, tint (255,152,51) fading out) behind ground/layer3; the wordmark falls/settles/shrinks on its 86-move track. Implemented in HD vector (existing SVGs, sub-pixel CSS transforms/opacity, steps(1,end) at 36 fps, GLOW_GRADIENT reused, no rasterization, no new bitmaps); keyframe comparisons at the catalog offsets 0/0.8611/1.75/2.6111/3.4722 s pass at dsf 1+2 (worst tolerant 1.386 %, limit 2 %); suites: intro 14, visual 18, animation 8, playthrough 3, interaction 6, controls 4, speaker 7, timeout 1, offline 1, unit 242, lint/build exit 0; smoke 1 (immediate-state assertion superseded by the boot sequence).
```

Amendment lines the orchestrator may add to `docs/07` §4:

```
> Amendment 2026-09-29 (owner wave Y8, closes O23): the boot intro timeline
> (SWF frames 5–130) is a covered V5 surface. Its keyframe checks run in
> tests/e2e/intro/intro.spec.ts against fresh pinned captures
> (tests/e2e/intro/capture-intro-reference.mjs; evidence/visual/Y8/reference-dsf{1,2}/)
> at deviceScaleFactor 1 and 2, tolerant basis unchanged (2 %); the intro
> keyframes carry no owner allowance. The board-state element set stays mounted
> underneath the raised boot layer (visibility only) so E2's V7 geometry check
> and the speaker/kernel pixel guards keep their load-time contract. E3's
> animations suite count is unchanged (coverage note added).
```

docs/02 §5 flow note (optional, same wave):

```
> 2026-09-29 (Y8): the rebuild's boot now plays the reference intro before the
> first round (`boot → preloader(1–4) → main(5–130) → playing`); the word list is
> local, so the first round starts when the intro ends (the reference starts
> `baslat()` when `init()`'s xml64.php response arrives after frame 131).
```

## 9. SHA-256 (key artifacts)

| Artifact | SHA-256 |
|---|---|
| `src/game/lifecycle.ts` | `536a56d02a7e2158cbdc05e891da2604b8d9b57509c140608b33b7114678d8e7` |
| `src/main.ts` | `a18ac6454c7b4f80d4bb6f5fd31f3b3ab29283158db4fa8b13b4e5354d37156b` |
| `src/ui/animations.ts` | `9b163b7dc0bda6a152d53aaf3fea44592eae63228db624bc69947ce6a2b34f30` |
| `src/styles/animations.css` | `ed61dc2c38118e45c5304a82f14d097f1e4d3fe953cb49a367acadadcc232445` |
| `tests/e2e/intro/intro.spec.ts` | `fd209b8efb016dfc57b9d05ee7adc32ce625f0a07bbde51e093f55645d082d0c` |
| `tests/e2e/intro/capture-intro-reference.mjs` | `fd8717f5885453cc8b6c1eb27140ea445b3b3239bfc6ba25d4e939cb7a591be6` |
| `tests/e2e/intro/boot-sequence.test.ts` | `0c0205a5d2af7cfda86ed82bc6ef7fa295b3c060f5a411cbe983d2b0162395a0` |
| `evidence/logs/Y8-main-tracks.json` | `57a1a463d43c761a99a4f520bd1eeb51deaffc2d27bd39cdf87b117ec9ab8c23` |
| `evidence/logs/Y8-intro-series.json` | `d0a4461e85ca46981fe1485ff3d6d671d4371ac7c1e253648cbd0d6edb1be8c0` |
| `evidence/visual/Y8/reference-dsf1/frame-005.png` | `9f43f9d83c0743f5e497d32d2799d05b9b67221fe3555eaf892c2a7dfcaeda5a` |
| `evidence/visual/Y8/reference-dsf1/frame-036.png` | `30392a591c3560c13129770e023458a20f9362346f212f264ee1f7f073993fe0` |
| `evidence/visual/Y8/reference-dsf1/frame-068.png` | `5bf35a810842f1ca364dbf650fcc69f310512ea38ec08d773039e9a65e315a1b` |
| `evidence/visual/Y8/reference-dsf1/frame-099.png` | `f1be30838d93133e8169e243e93243451e0bd4baec7982edaa4f38f7afb8ebaa` |
| `evidence/visual/Y8/reference-dsf1/frame-130.png` | `0d3f5e2c84bcc57ec73f389bb42b5cbb20595fb99f9e6d5fea5ffa51bdf46dc4` |
| `evidence/visual/Y8/reference-dsf2/frame-005.png` | `3235d57fadbb44d548b0119ede87ddaf59d877f7df449cb22f61a8ebde056026` |
| `evidence/visual/Y8/reference-dsf2/frame-036.png` | `d4b86e075bc2b961c647ed30611c72fa4330caee4d31b580f026b5de112fe4e6` |
| `evidence/visual/Y8/reference-dsf2/frame-068.png` | `b765f90e0d6bad1b9e6603a14fdc84cfb91c61ad9453981608535b14f34bdb11` |
| `evidence/visual/Y8/reference-dsf2/frame-099.png` | `d5e2dc1270f0783fcd25504f050e4ae91afe495eb79319d0720f92e57979ea5f` |
| `evidence/visual/Y8/reference-dsf2/frame-130.png` | `dd116c1980e564e4b66c8aecb971fb9998aff168199ac1c9e421f8cc3c90c741` |
| `data/animation.json` (input, unchanged) | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| `src/data/layout.json` (input, unchanged) | `f25d873d96a648760172b293ff2f6b36cfe19c3c46a18d516b4e41d90b38253f` |
| reference SWF (input, unchanged) | `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` |
| C3 served fixture (input, unchanged) | `80506d3ef3b58a4d8fdb5779debd4819271d57a5635276963a5d01eab91cd8bf` |
| `tests/fixtures/reference/S1-boot.png` (input, unchanged) | `396153fe4dc935d41a3a8bd709986a2b1238726f3c32e239bf3ef4681117ac26` |

Owner-capture provenance (`artifacts/o23-captures/`, git-ignored scratch): 70 frames +
`marks.json`; used for the night→day cross-check and the sun/sky ramp validation only.

## 10. Files changed (all inside the task's owned paths)

- `src/game/lifecycle.ts` (boot sequencing), `src/main.ts` (boot wiring + views + hooks)
- `src/ui/animations.ts`, `src/styles/animations.css` (intro timeline, boot layer)
- `tests/e2e/intro/{intro.spec.ts,capture-intro-reference.mjs,boot-sequence.test.ts}` (new)
- `tests/e2e/animations/animations.spec.ts` (coverage note only; count unchanged)
- `evidence/Y8-intro.md`, `evidence/visual/Y8/**`, `evidence/logs/Y8-*`

Scratch probes stayed in `artifacts/y8-captures/` (git-ignored, not committed).
