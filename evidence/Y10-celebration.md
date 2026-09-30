# Y10 — Win Celebration + Results Screen (Option A, owner-modified)

Task: Y10 — win celebration + results screen (owner directive, Option A with owner modifications; queued behind Y8/Y9)
Started: 2026-09-30T03:45+03:00 (first artifact write: `tests/e2e/celebration/extract-win-series.py`)
Ended: 2026-09-30T06:05+03:00
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 ·
@playwright/test 1.63.0 · pinned Ruffle 0.6.0 web self-hosted (C3 asset) · muted Chromium
(`--mute-audio`, EXECUTION.md §8)

Result: **PASS** — the reference win sequence (SWF frames 132–241, `bravo`) and the
end/results screen are restored on the owner-modified terms: the bravo motion (day→night
crossfade, descending sun with its win tint, the wordmark's return/rise, the results card
slide-in at frames 222–241) and the looping firework burst of element `bottom_marquee`
(DefineSprite_170) are painted with data-derived, step-held CSS tracks; the results card is
the owner-edited `s166_hiscore_form.svg` (E-posta removed, `Ad Soyad` → `İsim`, no re-flow)
with live value fields and a placebo `İsim` form (zero network, nothing stored; the submit
runs the original button's local continue). Keyframe comparisons at the catalog offsets
(frames 132/159/186/214/241) pass at deviceScaleFactor 1 and 2 with the recorded allowances
(worst tolerant 1.518 %, limit 2.000 %); the win e2e/structural checks pass; every existing
suite stays green (visual 18, animation 8, interaction 6, playthrough 3, intro 14, status 3,
speaker 7, controls 4, timeout 1, offline 1, smoke 7, celebration 15, unit 242, lint/build 0).

---

## 1. Owner decision and scope

Option A with the owner modifications (task file; owner directive):

- restore the win sequence (SWF frames 132–241, ≈ 3.0556 s) and the end/results screen —
  previously unpainted (E3 coverage row 4: “End screen excluded… the app's celebration state
  keeps the board”; the exclusion had been bundled with the network score form);
- **results card: remove the `E-posta` field entirely; rename `Ad Soyad` → `İsim`**;
- keep everything else faithful: the bravo sequence (night sky + crescent moon + stars +
  firework burst + the `bottom_marquee` element), the card (`TEBRİKLER` / `Puanınız` /
  `Kelime Sayısı` / `Süre`), the form slide-in (`hiscore_form_motion`, frames 222–241) and
  **`Yeni Oyun` as the return path**;
- **zero network**: the submit flow is placebo/local only — no request, no data, nothing
  stored; the original button action is the local navigation `_root.gotoAndPlay("main")`
  (evidence/A2-labels.md §3, `DefineButton2_153`), and the rebuild implements the same local
  continue (see §5);
- the `İsim` input stays interactive locally (placebo).

No `docs/**` file, no `src/main.ts`, no `src/game/state.ts` and no
`../kelimator-nostalji/` path was touched (owned paths only; the orchestrator applies the
docs amendments proposed in §10).

## 2. Fireworks source (the task's investigation finding)

**Finding: the catalogue element `bottom_marquee` is the firework generator
(`DefineSprite_170`), and the “bottom marquee” name is a misnomer — the sprite contains a
single `havai` spark template and a frame-1 script that sprays 300 of them across one
random burst position; there is no scrolling marquee element.**

Evidence (`artifacts/decompiled/tags.xml`, committed; main-timeline placement at SWF frame
241, depth 49):

```
<item type="PlaceObject2Tag" characterId="170" depth="49" ... placeFlagHasRatio="true" placeFlagMove="false" ratio="240">
  <matrix type="MATRIX" ... translateX="48" translateY="67"/>
</item>
```

`DefineSprite_170` frame 1 (`DoActionTag actionBytes="…"`, verbatim from the decompiled
`artifacts/decompiled/scripts/DefineSprite_170/frame_1/DoAction.as`):

```actionscript
sayi = 300;
i = 0;
x = int(random(500)) + 50;
y = int(random(200)) + 50;
do
{
   duplicateMovieClip("havai","havai" + i,16384 + i);
   scale = int(random(30)) + 5;
   setProperty("havai" + i, _X, x);
   setProperty("havai" + i, _Y, y);
   setProperty("havai" + i, _xscale, scale);
   setProperty("havai" + i, _yscale, scale);
   rot = int(random(360)) + 1;
   setProperty("havai" + i, _rotation, rot);
   tellTarget("havai" + i)
   {
      gotoAndPlay(int(random(10)) + 1);
   }
   i += 1;
}
while(i < sayi);
```

- `x`/`y` are drawn **once** before the loop: all 300 sparks share one burst position
  (`x ∈ [50, 550)`, `y ∈ [50, 250)`); per spark: `scale ∈ [5, 34]` %, `rot ∈ [1, 360]°`,
  start frame `∈ [1, 10]` (matches the owner capture’s single-cluster appearance, e.g.
  `tests/fixtures/reference/playthrough/39-complete.png`).
- the spark is sprite 169 (`havai`): 60 frames of a rotating/scaling 4-armed cross
  (sprite 168 → shape 167, stroke colour cycling `#ff2b00 → #ffb700 → … → #0311ef`,
  `tags.xml` `DefineSpriteTag spriteId="168"`, extracted per frame);
- sprite 170 is placed at frame 241 (tx = 2.4, ty = 3.35) and its frame-65 script removes
  every duplicate: `i = 0; do { removeMovieClip("havai" + i); i += 1; } while(i < sayi);` —
  **the script has no `stop()`, the sprite’s 65-frame timeline loops**, so the reference’s
  end screen re-creates a *new* random burst every 65/36 s = 1.8056 s forever. This was
  observed live: the capture session’s “settled” wait never stabilized (spark ink cycling,
  report `loop.playing: true`, sample series `[0, 662, 442, 465, 0, 156, 0, 212, 304, …]`),
  and the two reference shots (`frame-241.png` spark-free at the frame-241 render,
  `frame-241-loop.png` a later mid-burst) document the loop.
- the frame-241 render itself is spark-free in the reference (`frame-241.png`): the
  duplicates appear on sprite frame 2; the rebuild’s lifecycle keyframes match that
  (`e3-win-spark-life`: hidden at 0 %, visible from 1.538462 %).

Rebuild implementation (`src/ui/animations.ts`, `src/ui/board.ts`,
`src/styles/animations.css`): the burst is drawn from
`createSeededRandom(WIN_FIREWORK_SEED = 2012)` with the reference’s call order and ranges
(the reference’s `random()` is unseeded, so its pattern differs run to run — recorded
deviation), 300 `.e3-win-havai` wrapper nodes (one burst position, per-spark
rotation/scale/phase), each with the step-held spark track (`e3-win-spark`, matrix + colour
+ opacity per sprite frame, 65-frame cycle, `infinite`) and the life-cycle keyframes; the
stroke width is scaled by `1/scale` so the rendered dots match the reference’s ≈ 1 px
sparks (the SWF stroke is sub-pixel after the 5–34 % container scale; measured on the
reference captures, evidence §7). No timers: every spark animation is a pure CSS track, so
tests can pause/seek it.

## 3. Win timeline mapping (data-derived, no invented values)

Extracted from `artifacts/decompiled/tags.xml` by
`tests/e2e/celebration/extract-win-series.py` (cross-checks its depth-7/47 values against
the committed `evidence/logs/Y8-main-tracks.json`) into
`evidence/logs/Y10-win-series.json`:

| track | frames | source (main timeline) | series |
|---|---|---|---|
| `intro_sky` (ch5) alpha | 132–241 | re-placed opaque at 132; fade 188–222 | 256 … 250 → 36 (0.1406) |
| `intro_layer3` (ch8) alpha | 132–241 | re-placed opaque at 132; fade 188–222 | 256 … 250 → 51 (0.1992) |
| `intro_glow` (ch20) ty | 133–222 | 90 per-frame moves; held to 241 | −56.05 … 288.1 px (`translateY = ty + 59.9` on the catalog box) |
| glow tint (`redMultTerm`/adds) | 133–222 | colour-transform moves | blend colour (255, 103, 51), `opacity = 1 − m/256` → 0.3594 (least-squares fit, max add residual 1) |
| `intro_logo` (ch29) tx/ty/scale | 131–202 | 72 moves; removed at 203 | top-left (1.88, 0.94) s=0.479 → centre (80.1, 227.7) s=1.0 → rises to (123.4, −88.2) s=0.769, hidden from 203 |
| `hiscore_form` (ch166) ty/alpha | 222–241 | 19 moves | 483.35 → 315.35 (overshoot, 237) → 329.35; alpha 0 → 1 (236) |
| `bottom_marquee` (ch170) | 241 | one placement | tx 2.4, ty 3.35 (burst origin) |

`tests/e2e/celebration/generate-win-keyframes.mjs` regenerates the step-held CSS blocks
(`/* @y10-generated:begin … end */` in `src/styles/animations.css`) from that series;
cadence 110/36 s (`steps(1, end)`, one stop per SWF frame — same pattern as Y8’s intro).
The controller mounts the win layer when the FSM enters `celebration`
(`src/ui/animations.ts` `applyWinVisuals`), pinning the wordmark overlay to its natural
380×104.6 box for the transform track (Y8 precedent), applying the moon’s 125/256 placement
alpha, the win sun tint and the burst, and hiding the board layout underneath
(`[data-testid="board"]:has(> .e3-win-layer-root) > .board-layer`).

## 4. Results card (owner edits) and the form

**Asset edit** (`tools/process-assets.mjs` `applyHiscoreFormOwnerEdits`, X2 precedent —
deterministic textual correction before SVGO, all counts asserted, source provenance kept):

1. `E-posta` label (text id 159 / `#text8`) and its input box (id 155 / `#text4`) are
   removed entirely (instance + definition; no re-flow of the remaining rows — everything
   else stays at its original position, per the owner’s “keep everything else faithful”);
2. `Ad Soyad` → `İsim`: the `#text7` glyph run is rebuilt with glyphs and advances read
   from the same asset at the same 0.2344 scale — `İ` (`font_Verdana__4`, from
   `TEBRİKLER`) 6.55, `s` 7.1, `i` 4.1 — left-aligned at the original leftMargin 4.0:
   `İ` 4.0, `s` 10.55, `i` 17.65, `m` 21.75;
3. glyph defs used only by the removed/old labels are dropped (`font_Verdana_A0`, `_-0`,
   `_p0`, `_t0`); shared glyphs (`E0`, `o0`, `s0`, `a0`) stay.

The manifest records `correction: "owner-card-edits"` for `svg/s166_hiscore_form.svg`.
Pipeline: 27668 → 22911 bytes, 0 mismatched pixels (SVGO render check), fresh pipeline
evidence under `evidence/visual/Y10/pipeline/s166_hiscore_form/` (the frozen
`evidence/visual/E1-svgo/s166_*` v1 record is untouched and remains the pre-edit record).

**Live fields** (`src/ui/board.ts` `HISCORE_FORM_FIELDS`): the three dynamic fields
(`toplampuan` 157, `toplamkelime` 156, `toplamsure` 163) render as live text at the SWF
field rects; values from the lifecycle snapshot — score (time bonus included, reference
`DefineSprite_166/frame_1`: `toplampuan = _root.puan`), found-word count
(`toplamkelime = _root.toplamkelime`) and elapsed seconds
(`toplamsure = _root.sure - _root.timer`; `sure` = 200, `frame_131` L31 — the snapshot now
exposes `totalSeconds` for this).

**Form** (`src/ui/hud.ts`, “results form only”): interactive `İsim` input at the SWF
`name` field rect (max 50 chars, Verdana bold 12 px), transparent `Gönder` hit area at the
button’s rect, the red centred `hata` line. On an empty name the original error string is
shown verbatim (`Lütfen adınızı yazınız`, `DefineButton2_153` L3–L6); otherwise the submit
runs the local continue (`newRound()` — see §5). The name input is never persisted and the
form is cleared when the celebration starts (no storage; the reference restored a
SharedObject value — owner decision removes that).

## 5. Placebo / zero-network proof and the return path

- The e2e test “the results form is local-only” records every `page.on('request')` after
  the win screen appears: the empty-name submit and the named submit both issue **zero
  requests**; `localStorage`/`sessionStorage` keys are unchanged and no typed name appears
  in storage. The reference posts to the excluded `hiscore.php` (C3 evidence
  `verify/reference/capture.mjs` `submitHiscoreForm`); the rebuild has no equivalent.
- **Return path**: the reference’s only end-screen button is the form’s `Gönder`
  (`ybuton`/Ekle/Karıştır/Sil are hidden by `frame_132`), whose tail action is
  `_root.gotoAndPlay("main")` (A2-labels §3). In the rebuild that local navigation is the
  evidenced `celebration → playing` transition (`state.ts` `GAME_TRANSITIONS`; `newRound()`
  reloads the round, as `init()`/`baslat()` do after the reference’s intro replay). The
  intro-replay difference is recorded here and in the docs proposal; `Yeni Oyun`
  (`btn_ybuton`) stays visible on the win screen as the owner-requested return affordance
  (the reference hides it — recorded deviation, D5 evidence §9.3). The e2e asserts both
  returns (submit → next round; Yeni Oyun → next round, board back).

## 6. Reference captures (C3 pattern, muted)

`tests/e2e/celebration/capture-celebration-reference.mjs` (Y8 pattern: pinned server +
Ruffle web build + fixture; plays the F2 completion script, pauses on the completion ENTER
with a 5 ms page-side pauser, steps the SWF one frame per play/pause pair, then labels every
shot against the win series with self-calibrated probes: card-panel edge, sky-alpha ladder
(night green −0.09, day green 157), glow-disc bottom edge (offset −4.7/−4.2 px, derived
from the sky-labelled shots) and the wordmark box). Captures:
`evidence/visual/Y10/reference-dsf{1,2}/frame-*.png` + `capture-report.json` (labels,
residuals, hashes, loop ink series). Measured frames (residuals in px):
frame 132 `paused-enter` (board cleared; the first board-clear render after the ENTER;
frames 132–134 are visually equivalent within ≤ 2.6 px of the wordmark box, so the ±1-frame
resolution is disclosed), 159 `glow-bottom` 1.45, 186 `glow-bottom` 0.95/1.45, 214 `sky`
0.519, 241 `panel` 0.85/1.15, plus `frame-241-loop.png` (a later looping-burst state).

## 7. Keyframe comparisons (V5) and the recorded deviations

Driven by `tests/e2e/celebration/celebration.spec.ts`: complete the round, pause the
`e3-win-*` animations and set `currentTime = offset·1000 + 0.05 ms` (the 6-decimal keyframe
percentages round the stop times by < 0.001 ms; the nudge stays inside the reference’s
1/36 s frame slot), screenshot the stage, diff through F1 (`verify/diff/diff.mjs`).
Recorded run `Y10_RECORD=1` (log `evidence/logs/Y10-e2e-celebration-recorded.log`;
artifacts `evidence/visual/Y10/win-f<frame>/dsf<dsf>/`):

| frame | offset (s) | dsf | raw | tolerant | ignored px | allowances | verdict |
|---|---|---|---|---|---|---|---|
| 132 | 0.0 | 1 | 1.439 % | **0.029 %** | 2300 | Yeni Oyun | PASS |
| 159 | 0.75 | 1 | 3.793 % | **1.199 %** | 2300 | Yeni Oyun | PASS |
| 186 | 1.5 | 1 | 3.092 % | **0.314 %** | 2300 | Yeni Oyun | PASS |
| 214 | 2.2778 | 1 | 0.695 % | **0.226 %** | 2300 | Yeni Oyun | PASS |
| 241 | 3.0278 | 1 | 3.241 % | **0.129 %** | 16474 | Yeni Oyun + card | PASS |
| 132 | 0.0 | 2 | 2.410 % | **1.185 %** | 9200 | Yeni Oyun | PASS |
| 159 | 0.75 | 2 | 3.282 % | **1.518 %** | 9200 | Yeni Oyun | PASS |
| 186 | 1.5 | 2 | 2.563 % | **0.596 %** | 9200 | Yeni Oyun | PASS |
| 214 | 2.2778 | 2 | 0.629 % | **0.249 %** | 9200 | Yeni Oyun | PASS |
| 241 | 3.0278 | 2 | 1.549 % | **0.140 %** | 65896 | Yeni Oyun + card | PASS |

Recorded deviations (no other allowances anywhere):

1. **Yeni Oyun** (`tests/e2e/visual-states.ts` `Y10_RETURN_BUTTON_RECT` = the button’s
   catalog bbox 445,196,100,23): the owner keeps the rebuild’s return button; the
   reference hides it at frame 132. It is applied to every win frame and its exact set is
   asserted in the reports.
2. **Results card at frame 241** (`Y10_CARD_OWNER_EDIT_RECTS` + `Y10_SESSION_VALUE_RECTS`):
   the owner edit rows (İsim label area; the removed E-posta row) and the two
   session-dependent value columns (`Puanınız`, `Süre` — the reference capture shows its
   own run’s values, e.g. 69400/60; the rebuild asserts its values at the state level and
   `Kelime Sayısı` = 35 stays pixel-compared with the labels, card shape, name field and
   `Gönder` button). The measured residual at 241 (0.129 %/0.140 %) is the card’s
   rasterization only.
3. **Random fireworks**: not pixel-comparable (unseeded reference RNG; new burst every
   65-frame sprite loop). The frame-241 render is spark-free in both implementations and is
   compared; the *active* burst is verified structurally (300 sparks, evidenced ranges,
   infinite 65/36 s cycles) and by the recorded app ink series
   `0,671,803,415,512,170,371,335,0,362,865,541,446,428,37,0,113,60,672,803,415` (max 865,
   dips to 0 at the cycle boundary) against the reference’s loop samples (dsf1
   `[0, 662, 442, 465, 0, 156, 0, 212, 304, 351, 235, 29, 27, 130]`).

## 8. Suites and commands (all from the repo root)

| # | Command (exact) | Exit | Result |
|---|---|---|---|
| 1 | `Y10_RECORD=1 npx playwright test tests/e2e/celebration/celebration.spec.ts --project=app --reporter=line` | 0 | **15 passed** (5 state/structure + 10 keyframes) |
| 2 | `npx playwright test --project=app tests/e2e/visual` | 0 | 18 passed |
| 3 | `… tests/e2e/animation` | 0 | 8 passed |
| 4 | `… tests/e2e/interaction` | 0 | 6 passed |
| 5 | `… tests/e2e/controls` | 0 | 4 passed |
| 6 | `… tests/e2e/speaker` | 0 | 7 passed |
| 7 | `… tests/e2e/status` | 0 | 3 passed |
| 8 | `… tests/e2e/timeout` | 0 | 1 passed |
| 9 | `… tests/e2e/offline` | 0 | 1 passed |
| 10 | `… tests/e2e/smoke` | 0 | 7 passed |
| 11 | `… tests/e2e/intro` | 0 | 14 passed |
| 12 | `… tests/e2e/playthrough` | 0 | 3 passed (F2 scripted 40 steps worst tolerant 0.872 %; S9 timeout 0.511 %; completion step keeps its state checks with the recorded exclusion reason) |
| 13 | `npm test` | 0 | 15 files, 242 tests |
| 14 | `npm run lint` | 0 | clean |
| 15 | `npm run build` | 0 | tsc + Vite (chunk-size warning only, documented D1 note) |
| 16 | `bash tools/verify-all.sh` | expected 1 | the 10 substantive steps PASS; step 11 `frozen evidence` reports the uncommitted Y10 files (expected pre-commit; the orchestrator’s closing run after the commit must be green) |

Logs: `evidence/logs/Y10-*` (svg pipeline, unit, lint, build, every suite, the recorded
celebration run, both reference-capture runs, verify-all). Suite command convention:
`npm run e2e -- celebration` (matches `tests/e2e/celebration/**`; the suite is not yet part
of `tools/verify-all.sh`, which the orchestrator owns).

## 9. Silent witness (EXECUTION.md §8)

All reference runs launch Chromium with `--mute-audio` (recorded in the capture reports);
no Ruffle CLI; no network beyond 127.0.0.1; every app run under Playwright’s muted Chromium;
no test asserts audibility; no audio was emitted.

## 10. Proposed amendments (orchestrator applies; no docs/** edits by Y10)

docs/08 entry (replaces the D5 §9.3 end-screen exclusion context and E3 row 4):

```
RESOLVED 2026-09-30 — task Y10 (owner decision Option A, modified): the win sequence
(SWF frames 132-241, `bravo`) and the end/results screen are restored. The bravo motion
(day->night sky/layer3 crossfade 188-222, descending sun with the (255,103,51) win tint,
the wordmark return/rise 131-202) and the results-card slide-in (222-241) are step-held CSS
tracks generated from artifacts/decompiled/tags.xml (evidence/logs/Y10-win-series.json;
evidence/Y10-celebration.md). The `bottom_marquee` element is the firework generator
(DefineSprite_170: one burst position, 300 `havai` sparks, 65-frame looping cycle - it has
no `stop()`; the rebuild draws a deterministic burst from a recorded seed and repeats it on
the same 65/36 s cycle). The results card is the owner-edited `s166_hiscore_form.svg`
(`E-posta` removed entirely, `Ad Soyad` -> `İsim`; process-time correction
`owner-card-edits`, manifest-recorded, E1 v1 record untouched) with live score/word/elapsed
fields. The `İsim` form is placebo-local: zero network, nothing stored; the empty-name gate
keeps `Lütfen adınızı yazınız`; a named submit performs the original button's local continue
(`_root.gotoAndPlay("main")` -> the celebration->playing `newRound()` path). `Yeni Oyun`
stays visible as the return path (recorded deviation: the reference hides it at frame 132).
V5: win keyframes 132/159/186/214/241 compared at dsf 1+2 (worst tolerant 1.518 %, limit
2 %); recorded allowances only: the Yeni Oyun rect on every frame and the results-card
owner-edit/session-value rects at 241. Evidence: evidence/Y10-celebration.md.
E3 coverage row 4 (`win`) is no longer excluded; `hiscore_form_motion` (row 7) and
`sprite_bottom_marquee_timeline` (row 24) are covered by the same suite.
```

docs/07 §4 amendment:

```
> Amendment 2026-09-30 (owner wave Y10): the win sequence (SWF frames 132-241) is a
> covered V5 surface. tests/e2e/celebration/celebration.spec.ts drives the app to the
> catalog offsets (0/0.75/1.5/2.2778/3.0278 s) with the win CSS tracks paused/seeked and
> compares against fresh pinned captures
> (tests/e2e/celebration/capture-celebration-reference.mjs;
> evidence/visual/Y10/reference-dsf{1,2}/) at deviceScaleFactor 1 and 2; tolerant basis
> unchanged (2 %). Recorded allowances: `Y10_RETURN_BUTTON_RECT` (the owner-kept Yeni Oyun
> button; the reference hides it at frame 132) on every win keyframe and
> `Y10_CARD_OWNER_EDIT_RECTS` + `Y10_SESSION_VALUE_RECTS` at frame 241 (owner card edits +
> session-dependent value columns); no other allowance exists.
```

docs/02 §7 note:

```
> 2026-09-30 (Y10): the restored results-card form is placebo/local — the `İsim` field and
> the `Gönder` button perform no request and store nothing (the reference posted to the
> excluded hiscore.php and kept a SharedObject); the button's local continue maps to the
> evidenced `celebration -> playing` path. Evidence: evidence/Y10-celebration.md §5.
```

docs/03 §1 naming note:

```
> 2026-09-30 (Y10): nested runtime sprites of a catalogued element are recorded as a
> `spark` (or `frames`) sub-record of the element's manifest entry; the firework spark is
> `s168_havai_spark.svg` under `svg/s170_bottom_marquee.svg` (correction
> `spark-current-color`: the baked frame-1 stroke becomes `currentColor` so the per-frame
> colour track can animate it).
```

## 11. SHA-256 (key artifacts; full list `evidence/logs/Y10-artifact-hashes.log`)

| Artifact | SHA-256 |
|---|---|
| `src/ui/animations.ts` | `3bebe77eb1ea21b34db97c87ef7a6979e8f4d89a744d0b96a9f1fd7345aca1fb` |
| `src/ui/board.ts` | `7dd854dace7652bd967d1db76da47a952931c3049758ed3cf391660fab721e5a` |
| `src/ui/hud.ts` | `b9fd5358f6040c2823b644e582319b1e63eb54813c1c40209219c31882e29072` |
| `src/game/lifecycle.ts` | `af579e823d04a4b2c3ad9b4ce6dbbc4a7984dfd1d40a2d910a6ec01b819ba60f` |
| `src/styles/animations.css` | `85534e22c81c8ec8411194e11110ade536299d62bfd4e3049f4b21fd5ddc9f42` |
| `tools/process-assets.mjs` | `6917bf83a8b0f6a7041286b341983553d6283d740445ff1ee7c262f8ca61c457` |
| `src/assets/manifest.json` | `8f5932c3eb4a34d3897ff4ccce8e1b17f49e7f5bffad1e5ad7fafe3bc92a3d53` |
| `src/assets/svg/s166_hiscore_form.svg` (owner-edited) | `ee4bdfdfb89d9ad8da310260a584e3f09e05bd8e3155e670c49d3e1d69d31f46` |
| `src/assets/svg/s168_havai_spark.svg` | `0e850059646c07d9f7671e846c4c581b4dc3b7c0969774958cf941bab445e4e2` |
| `tests/e2e/celebration/celebration.spec.ts` | `98becb4a17d07e4ecaceade6855de3a109fd6647fd1e85b2ea97a1556fd9f8b3` |
| `tests/e2e/celebration/capture-celebration-reference.mjs` | `d23b70ee2ec1ce95b5f5580b394be6ce6f482770aa5a72e3beda4b64ac4a38a5` |
| `tests/e2e/celebration/generate-win-keyframes.mjs` | `5e6adc0081ac05523c21af2bdffbf4fc95ba33ec0a1d5a07c054615d4d5a94f5` |
| `tests/e2e/celebration/extract-win-series.py` | `a9bbc6f950361d07358cd16da550f8f6515c2bc1e31cb1bb92bd4e94ba34aa96` |
| `tests/e2e/visual-states.ts` | `7198b71fc00ab179a2cb3cfbdf3cc2d9dd5db24ee8c796b84398bc02e2ac6b11` |
| `tests/e2e/playthrough/playthrough.spec.ts` | `6454c0a69f90c215ee733486c6bf13e982bd709749cb15271eda7648ea5fcdd1` |
| `evidence/logs/Y10-win-series.json` | `b2775540ed371617522f370b694031dcb80b141e193850aa8a0efc60b77d0ae2` |
| `evidence/visual/Y10/reference-dsf1/frame-132.png` | `9ae27d38f205bd163b610540a9f336613cb63d42547407f28b28637dd69f7b72` |
| `evidence/visual/Y10/reference-dsf1/frame-159.png` | `590ff9d90be5ba8dce4a2c8fe5c580dd93d46c20775908e47e21b565280893dc` |
| `evidence/visual/Y10/reference-dsf1/frame-186.png` | `ee725a517375917c8e894ee408a3e7c56d16d7a252334e2438a7321be496006d` |
| `evidence/visual/Y10/reference-dsf1/frame-214.png` | `3e7aca2c932f837f43576c0dee084d823a3766c8a326325a5f83f023525fd05c` |
| `evidence/visual/Y10/reference-dsf1/frame-241.png` | `8c04393e2c6630bcf30c2df639047a119de6e2331f73bd930e102b046e1de322` |
| `evidence/visual/Y10/reference-dsf1/frame-241-loop.png` | `a145f8b59ebd22ffa087a9742199b8739d8b2bd74509c7c05d67623b228e1095` |
| `evidence/visual/Y10/reference-dsf2/frame-132.png` | `8466945d897e4ad1ba1fdc828ab9a0ecd6001f248e3942920b3cd364b4e16c9d` |
| `evidence/visual/Y10/reference-dsf2/frame-159.png` | `b1d88ce5a841badbfca11784cddb1fc18e1c5aa4250cf0e8149fc84b0bf1e30b` |
| `evidence/visual/Y10/reference-dsf2/frame-186.png` | `76d4f38d3fa40c3b5ea5a640eb2e4a4406448117cfce2896a4051304a2e906d2` |
| `evidence/visual/Y10/reference-dsf2/frame-214.png` | `63a86cc2d4f99807ac626b021723cc55487006c96211343bc097b5538c09f9be` |
| `evidence/visual/Y10/reference-dsf2/frame-241.png` | `08b723b4c4e5c7abad2581851d6c27ae5f83b4d18ef6cd01f403cb513c38211d` |
| `evidence/visual/Y10/reference-dsf2/frame-241-loop.png` | `521848354dc020a66295859532e7f0e2a4684d5b5dd976c433b039ca5d9b4a6e` |
| raw card source `DefineSprite_166/1.svg` (input, unchanged) | `6645cdeb353e09ece37089af42ece4f18eb448ca5d7e60a3791f81334404343c` |
| raw spark source `DefineSprite_168/1.svg` (input, unchanged) | `d5e19cce12d21e6ba05b0df081711cf9803b20a7c7df1e7feef00d6d0dd66019` |
| reference SWF (input, unchanged) | `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` |
| C3 served fixture (input, unchanged) | `80506d3ef3b58a4d8fdb5779debd4819271d57a5635276963a5d01eab91cd8bf` |
| `evidence/logs/Y8-main-tracks.json` (input, cross-check) | `57a1a463d43c761a99a4f520bd1eeb51deaffc2d27bd39cdf87b117ec9ab8c23` |

## 12. Files changed (all inside the task’s owned paths)

- `src/game/lifecycle.ts` (snapshot `totalSeconds`), `src/ui/{animations,board,hud}.ts`,
  `src/styles/animations.css` (win layer + generated tracks)
- `tools/process-assets.mjs` (card correction, spark asset, manifest records),
  `src/assets/manifest.json`, `src/assets/svg/s166_hiscore_form.svg`,
  `src/assets/svg/s168_havai_spark.svg`
- `tests/e2e/celebration/{celebration.spec.ts,capture-celebration-reference.mjs,generate-win-keyframes.mjs,extract-win-series.py}`,
  `tests/e2e/visual-states.ts` (Y10 allowance rects), `tests/e2e/playthrough/playthrough.spec.ts`
  (completion-step reason only)
- `evidence/Y10-celebration.md`, `evidence/visual/Y10/**`, `evidence/logs/Y10-*`

Scratch probes stayed in `artifacts/y10-scratch/` (git-ignored, not committed).
