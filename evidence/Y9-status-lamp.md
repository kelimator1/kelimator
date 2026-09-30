# Y9 — Status lamp states: `Geçerli` / `Girildi` (owner-reported)

Task: Y9 (owner presentation wave follow-up; owner-reported defect, owner-approved fix)
Started/Ended: 2026-09-29 (first write `test-results/Y9-render/`) / 2026-09-30
Host+OS: dev-host.home / macOS, arm64 / arm64 host · Node v22.14.0 ·
@playwright/test 1.63.0 · muted Chromium (`--mute-audio`, EXECUTION.md §8)

Result: **PASS** — the right-panel status capsule renders its three evidenced
states: idle = frame-1 dark ball (no text), `Geçerli` = frame-2 green ball +
live green text `#336600`, `Girildi` = frame-3 red ball + live red text
`#ff0000`. The two coloured ball frames are processed deterministically from the
FFDec sprite export (static text stripped, sha256-pinned, manifest-recorded);
the ball regions of all three states are **raw-exact (0 mismatched pixels)**
against the reference frames at deviceScaleFactor 1 and 2, the kept live text
stays within the project's anti-aliasing-tolerant V5 basis (worst 0.144 %,
limit 2.000 %). Status suite 3/3, visual 18/18, animation 8/8, interaction 6/6,
playthrough 3/3, full app e2e 72/72, unit 242/242; lint/build exit 0.

---

## 1. Defect, reference behaviour and fix

Owner-reported (investigated, owner-approved fix): the capsule always showed the
frame-1 dark ball and `src/ui/message.ts` drew the live text in fixed `#000`.

Reference behaviour (`evidence/A2-strings.md` §2, `frame_131/DoAction.as`
`kontrol()` L259–L279): the status sprite `DefineSprite_123` (`status_ball`,
depth 52) is switched with `gotoAndStop()`:

```
status.gotoAndStop(1);
while (i < dizi.length)     { if (kelime == dizi[i])      status.gotoAndStop(2); }
while (i < bulunanlar.length){ if (kelime == bulunanlar[i]) status.gotoAndStop(3); }
```

| state | condition (lifecycle) | sprite frame | ball | text (text id) |
|---|---|---|---|---|
| idle | entry empty / not a listed word | frame 1 | dark (frame export) | — |
| valid | `entry` equals a word of `dizi` and is not in `bulunanlar` (`EntryStatus 'valid'`) | frame 2 | green | `Geçerli` (119) |
| already found | `entry` is in `bulunanlar` (`'already-found'`; the found pass runs last, so it wins) | frame 3 | red | `Girildi` (122) |

`ekle()` resets the status to frame 1 after a valid submission; the loading
banner text (ids 78/82/83) is unaffected.

Fix (files, all inside the Y9-owned paths):

- `tools/process-assets.mjs` — `STATUS_BALL_FRAMES`: frames 2/3 of
  `DefineSprite_123` are processed into
  `src/assets/svg/s123_status_ball_f2.svg` / `s123_status_ball_f3.svg`
  (docs/03 §1 naming `s<symbolId>_<slug>.svg` with the documented extra-frame
  suffix, §4; source sha256 pins; deterministic static-text strip; same SVGO
  0-mismatched-pixel render verification as the 36 layout assets; their
  pipeline evidence is written under `evidence/visual/Y9/pipeline/`).
- `src/assets/svg/s123_status_ball_f{2,3}.svg` + `src/assets/manifest.json` —
  the frames are recorded as `frames` of the existing
  `svg/s123_status_ball.svg` entry (name, sha256, source, sourceSha256,
  correction) so the frozen `tests/assets.test.mjs` per-kind entry counts stay
  exactly 36 svg / 2 bitmap / 26 text / 9 sound; the sprite's own asset
  (`s123_status_ball.svg`, frame 1) is byte-identical to before
  (`1125adfc…c82d`).
- `src/ui/message.ts` — the capsule now renders the state: an `<img>` with the
  frame's ball asset under the (kept) live text span; text colour and slot come
  from the frames; `role="status"` text content stays the verbatim O05 string.
- `src/ui/board.ts` — status-ball rule only: when the message marks the stage
  root `data-status-lamp="valid|already-found"`, the board's frame-1 ball is
  hidden (`visibility: hidden`), because the frame-2/3 ball fully replaces
  frame 1 and overlaying would double-blend the antialiased edge. The idle
  path (frame 1, no attribute) is unchanged.
- `tests/e2e/status/**` — the status suite, the committed reference-frame
  fixtures and the measurement/capture harnesses (below).

## 2. Sampled colours (exact command + values)

Command (reproducible; log `evidence/logs/Y9-frame-colours.log`):

```
node tests/e2e/status/capture-status-evidence.mjs
```

It renders the three committed reference frames
(`tests/e2e/status/fixtures/DefineSprite_123/{1,2,3}.svg`, byte copies of
`artifacts/decompiled/sprites/DefineSprite_123/{1,2,3}.svg`) at
deviceScaleFactor 4 and samples exact RGB values (probe points in frame
coordinates: ball centre (18.45,17.4), ball top highlight (13.0,10.0), first
glyph stem (41.6,16.0)).

Declared fills of the exported frames (authoritative, from the frame SVG
source):

| frame | ball base | ball shading | highlight | text fill |
|---|---|---|---|---|
| 1 | `#000000` | `#000000` | `#ffffff` | — |
| 2 | `#00cc00` | `#008000` | `#7fff7f` | `#336600` |
| 3 | `#ea0000` | `#800000` | `#ff7f7f` | `#ff0000` |

Sampled render values (dsf4):

```
frame 1: ball centre 133,133,133 | ball highlight 68,68,68
frame 1: exact pixels per declared fill #ffffff x700111 | #000000 x82
frame 2: ball centre 67,218,67 | ball highlight 34,190,34 | first-glyph stem 51,102,0
frame 2: exact pixels per declared fill #336600 x65210 | #7fff7f x893 | #008000 x0 | #00cc00 x0
frame 3: ball centre 227,67,67 | ball highlight 200,34,34 | first-glyph stem 255,0,0
frame 3: exact pixels per declared fill #ff0000 x58832 | #ff7f7f x1096 | #800000 x0 | #ea0000 x0
```

Notes: the glyph stem samples **`51,102,0` = `#336600`** (frame 2) and
**`255,0,0` = `#ff0000`** (frame 3) exactly. The ball base/shading fills
(`#00cc00`/`#008000`/`#ea0000`/`#800000`) never appear as exact rendered
pixels — the frame's gradient overlays always blend over them — so the ball
renders as the sampled gradient values (centre `67,218,67` / `227,67,67`).
The text record values match the SVG fills (`DefineText` 119/122:
`textHeight 280` twips = 14 px, colour `#336600` / `#ff0000`; tags.xml).

## 3. Decision: frames vs live text (measured)

Chosen: **swap the ball asset per state + keep the live-text mechanism**
(option a of the task), with the ball graphics sourced from the exported frames
2/3 (static text stripped deterministically) and the text colours from the
frames.

Measurements (all through the F1 diff tool, `verify/diff/diff.mjs`; the
reference side is the raw FFDec frame injected at the exact `status_ball`
catalog box over the live board backdrop — same coordinates and rasterisation
for both sides):

1. Isolated frame-vs-live-text harness
   (`node tests/e2e/status/render-status-frames.mjs`,
   log `evidence/logs/Y9-frame-harness.log`): a live Verdana-bold run against
   the frame's baked Verdana-bold outline run has raw differences of ≈ 5–12 %
   of the capsule (glyph hinting/advance-level AA) but only 0–9 pixels outside
   the tolerant radius-2 basis (≤ 0.25 %).
2. In-situ size/position sweep in the app
   (`node tests/e2e/status/tune-live-text.mjs`,
   log `evidence/logs/Y9-live-text-sweep.log`): candidates 13.9–14.2 px ×
   top 15.0/15.25 px × kerning normal/none, valid + found, dsf 1+2. The
   minimum total tolerant mismatches is **size 14.2 px / top 15 px** (chosen);
   kerning made no difference (Verdana bold pair kerning has no effect here).
3. Final suite numbers (below): ball regions **raw 0** in every state/dsf;
   text-region residual worst **tolerant 5 px = 0.144 %** of the capsule
   (found/dsf1), valid/dsf1 0.000 %.

Why keep the live text: on the project's V5 pass basis (docs/07 §4 amendment,
tolerant radius 2, raw metric monitoring-only) the live text stays
pixel-faithful with a ~14× margin, it keeps the O05 string as the real
user-visible text content (the e2e status assertions read it), and it avoids
hiding a DOM text layer behind a baked image. The alternative (rendering the
frames directly, i.e. with their baked glyph outlines) was measured to be
raw-exact but would have retired the live text to a hidden layer; the measured
residual is rasterisation-only and does not justify that. The ball itself has
no live counterpart, so it is rendered from the frames exactly (raw 0).

## 4. Pipeline detail (deterministic, hash-pinned)

`tools/process-assets.mjs` `STATUS_BALL_FRAMES` + `stripStatusFrameText()`:

- source pins (asserted before processing):
  frame 2 `c9c348c0…dc922`, frame 3 `a80a27e1…45f48d`;
- strip (counts asserted; ball anchors `shape0`/`sprite0`/`shape2` kept): the
  frame's single `<use ffdec:characterId="119|122">`, the `<g id="text0">`
  definition and every `<g id="font_Verdana_*">` glyph outline group;
- SVGO with the pinned options, render-verified 0 mismatched pixels
  (before = corrected source, after = optimized);
- extra proof per frame: raw frame render vs corrected render differences are
  confined to the text area (F1 `mismatchBBox` x≥36, text bbox
  `40,10,54,14` / `40,10,47,14`; removed ink 1434→1036 / 1418→1036 px);
- outputs (committed): `s123_status_ball_f2.svg` `3665021f…a2dc25`,
  `s123_status_ball_f3.svg` `a59f1fea…aeb62`; manifest
  `src/assets/manifest.json` `3b524b91…f51b04` records both frames under
  `svg/s123_status_ball.svg → frames[]` (the 36-svg entry count is unchanged;
  `tests/assets.test.mjs` green).
- Pipeline evidence: `evidence/visual/Y9/pipeline/s123_status_ball_f{2,3}/`
  (`raw.png`, `before.png`, `after.png`, `raw-diff.json`, `report.json`) +
  `evidence/visual/Y9/pipeline/summary.json`. The frozen E1/SVGO evidence of
  the 36 layout assets was restored untouched after the pipeline run (the
  current diff tool writes schema v3 reports; the E1 record stays as
  committed).

## 5. State mapping in the app (lifecycle events)

`src/game/lifecycle.ts` `entryStatusOf()` → `LifecycleSnapshot.entryStatus` →
`src/main.ts` `render()` → `message.showStatus()` (one call per render):

- `null` (no entry, entry not listed) → frame 1: message hidden, board's
  `status_ball` (catalog asset `s123_status_ball.svg`) visible, no text;
- `'valid'` → frame 2: ball `s123_status_ball_f2.svg`, text `Geçerli`
  `#336600`, stage root marked `data-status-lamp="valid"` (board ball hidden);
- `'already-found'` → frame 3: ball `s123_status_ball_f3.svg`, text `Girildi`
  `#ff0000`, stage root marked `data-status-lamp="already-found"`.

The loading banner (`showLoading()`) is unchanged: no ball, centred 10 px text,
no lamp marker. Strings remain verbatim O05 (`Geçerli` / `Girildi`).

## 6. Tests and captures

Status suite (owner defect test): `tests/e2e/status/status-lamp.spec.ts`,
log `evidence/logs/Y9-e2e-status.log` — **3 passed** (state test at dsf 1 and
dsf 2 + the manifest-record guard). Reported numbers:

| state | dsf | ball region raw (text ignored) | capsule raw | capsule tolerant | limit |
|---|---|---|---|---|---|
| idle | 1 | 0 | 0 | 0 (0.000 %) | 2 % |
| valid | 1 | 0 | 413 | 0 (0.000 %) | 2 % |
| found | 1 | 0 | 375 | 5 (0.144 %) | 2 % |
| idle | 2 | 0 | 0 | 0 (0.000 %) | 2 % |
| valid | 2 | 0 | 1427 | 3 (0.022 %) | 2 % |
| found | 2 | 0 | 1149 | 2 (0.014 %) | 2 % |

The test also asserts: exact text fill pixels present (`> 20` px of `#336600` /
`#ff0000`), no cross-state text colour, the ball asset per state, the board
ball hidden while coloured, and the stage-root lamp attribute. Crops
(`nodes/../Y9_RECORD=1` or the capture script):

- `evidence/visual/Y9/comparison-sheet-dsf{1,2}.png` — owner-style sheet,
  columns *before (pre-fix appearance reproduced) | after (app) | reference
  frame*, rows idle / valid / found;
- `evidence/visual/Y9/{actual,before,reference}-{idle,valid,found}-dsf{1,2}.png`;
- `evidence/visual/Y9/diff-*/report.json` (F1 reports for each state/dsf).

Regression matrix (logs `evidence/logs/Y9-e2e-*.log`):

| suite | result |
|---|---|
| `npm run e2e -- status` | 3 passed |
| `npm run e2e -- visual` | 18 passed (S2–S10 unchanged, no status-region expectation updates needed) |
| `npm run e2e -- animation` | 8 passed |
| `npm run e2e -- interaction` | 6 passed |
| `npm run e2e -- playthrough` | 3 passed |
| all app e2e (`--project=app`) | 72 passed |
| `npm test` | 242 passed (15 files) |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |

## 7. Hashes

| artifact | sha256 |
|---|---|
| `src/assets/svg/s123_status_ball_f2.svg` | `3665021f4b1058fec4baba815cc0f238df2a299d50b679bb1d49a71392a2dc25` |
| `src/assets/svg/s123_status_ball_f3.svg` | `a59f1fea46d864291c075e0bc5a2634549334cb24ef0e2195f674a27a28aeb62` |
| `src/assets/svg/s123_status_ball.svg` (unchanged) | `1125adfcd729ab4bd9b27d708d6576afc866057e18f6f476b6f10bc6bf9ec82d` |
| `src/assets/manifest.json` (after update) | `3b524b91490d29caf7dc482f204c6edcf71ca5391773caa53953180c5df51b04` |
| raw frame source `DefineSprite_123/2.svg` (pin) | `c9c348c0deb10e6cb55b59a430121ec9448cb374e598783aaa0077cfd98dc922` |
| raw frame source `DefineSprite_123/3.svg` (pin) | `a80a27e1f4b1ac625e39403f46ae351be408daa9fc1438ff84ed9afd2e45f48d` |
| fixture `tests/e2e/status/fixtures/DefineSprite_123/1.svg` | `2348abfa68337899981219856c3ba5f5564ea13b0318652e6ba3d2b3ef4c1816` |
| fixture `…/2.svg` | `c9c348c0deb10e6cb55b59a430121ec9448cb374e598783aaa0077cfd98dc922` |
| fixture `…/3.svg` | `a80a27e1f4b1ac625e39403f46ae351be408daa9fc1438ff84ed9afd2e45f48d` |

## 8. docs/08 proposals (orchestrator applies; no docs/ edits by Y9)

Amendments entry (O05 area):

> 2026-09-30 — Task **Y9** closure (owner-reported status lamp):
> `DefineSprite_123` (`status_ball`) renders its three evidenced frames — idle
> frame 1 (dark ball, board catalog asset, no text), frame 2 (green ball + live
> `Geçerli` `#336600`), frame 3 (red ball + live `Girildi` `#ff0000`). Frames
> 2/3 are processed to ball-only assets `s123_status_ball_f2.svg` /
> `s123_status_ball_f3.svg` (deterministic static-text strip, source
> sha256-pinned, docs/03 §1 naming with the extra-frame suffix `_f<frame>`)
> and recorded as the `frames[]` sub-records of the sprite's existing
> `svg/s123_status_ball.svg` manifest entry (top-level per-kind entry counts
> unchanged: 36 svg / 2 bitmap / 26 text / 9 sound). The live-text mechanism is
> kept (worst-tolerant 0.144 % vs the rendered frames, limit 2.000 %; ball
> regions raw-exact 0 px); the board hides its frame-1 ball while a coloured
> state is active (`data-status-lamp` on the stage root). Evidence:
> `evidence/Y9-status-lamp.md`.

docs/03 §1 naming note (optional, same source):

> Extra sprite frames use the suffix `_f<frame>` (`s<symbolId>_<slug>_f<frame>.svg`);
> the frames of a sprite are recorded inside the sprite's manifest entry
> (`frames[]`) so the layout-asset entry counts stay stable.

## 9. Logs

- `evidence/logs/Y9-frame-colours.log` — frame colour sampling + capture run
- `evidence/logs/Y9-frame-harness.log` — isolated frame vs live-text harness
- `evidence/logs/Y9-live-text-sweep.log` — in-situ size/position sweep
- `evidence/logs/Y9-e2e-status.log`, `…-visual.log`, `…-animation.log`,
  `…-interaction.log`, `…-playthrough.log`, `…-all.log`
- `evidence/logs/Y9-test-full.log`, `…-lint.log`, `…-build.log`
