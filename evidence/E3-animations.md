# E3 — Animations (evidence)

Task: E3 — Animations
Started: 2026-09-28T19:45:18Z (first E3 artifact write: `tests/e2e/animations/scenarios/board.json` mtime; UTC)
Ended: 2026-09-28T20:09:29Z (`date -u` after the final command; evidence file written immediately after)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host · Node v22.14.0 · @playwright/test 1.63.0

Commands executed (exact) and exit codes; raw output in `evidence/logs/`:

| # | Command (exact, repo root) | Exit | Log |
|---|---|---|---|
| 1 | `node verify/reference/capture.mjs --scenario tests/e2e/animations/scenarios/board.json --out tests/fixtures/reference/animations/board --port 8801 --runs 1 > evidence/logs/E3-capture-board.log 2>&1` | 0 | 3 steps, 1 capture (550×400) |
| 2 | `node verify/reference/capture.mjs --scenario tests/e2e/animations/scenarios/wordball.json --out tests/fixtures/reference/animations/sprite_wordball_timeline --port 8801 --runs 1 > evidence/logs/E3-capture-wordball.log 2>&1` | 0 | 12 steps, 5 captures (550×400) |
| 3 | `NO_COLOR=1 npm run e2e -- animation --reporter=line > evidence/logs/E3-e2e-animation-iter1.log 2>&1` | 1 | spec import path bug (fixed in scope; run kept) |
| 4 | `NO_COLOR=1 npm run e2e -- animation --reporter=line > evidence/logs/E3-e2e-animation-iter2.log 2>&1` | 0 | 8 passed |
| 5 | `NO_COLOR=1 npm run e2e -- visual --reporter=line > evidence/logs/E3-e2e-visual-regression.log 2>&1` | 0 | 17 passed (E2 regression) |
| 6 | `NO_COLOR=1 npm run e2e -- playthrough:basic --reporter=line > evidence/logs/E3-e2e-playthrough-regression.log 2>&1` | 0 | 1 passed (D5 regression) |
| 7 | `E3_RECORD=1 NO_COLOR=1 npm run e2e -- animation --reporter=line > evidence/logs/E3-e2e-animation-recorded.log 2>&1` | 0 | 8 passed; `evidence/visual/E3/` artifacts written |
| 8 | `NO_COLOR=1 npm test > evidence/logs/E3-test-full.log 2>&1` | 0 | 12 files, 217 tests |
| 9 | `NO_COLOR=1 npm run lint > evidence/logs/E3-lint.log 2>&1` | 0 | clean |
| 10 | `NO_COLOR=1 npm run build > evidence/logs/E3-build.log 2>&1` | 0 | tsc + Vite; chunk-size warning only (documented D1 note) |
| 11 | `NO_COLOR=1 npm run e2e -- animation --reporter=line > evidence/logs/E3-e2e-animation-final.log 2>&1` | 0 | 8 passed (after the last spec revision) |
| 12 | `npx eslint tests/e2e/animations/animations.spec.ts` | 0 | clean |
| 13 | `npm run e2e -- animation > evidence/logs/E3-e2e-animation-bare.log 2>&1` (the task’s exact Verify command) | 0 | 8 passed |
| 14 | `shasum -a 256 … > evidence/logs/E3-artifact-hashes.log` | 0 | full hash list |

All reference runs used C3's scenario mode with the pinned Ruffle web build,
the reconstructed fixture and Chromium `--mute-audio` (silent witness runs,
`EXECUTION.md` §8); port 8801 (server started/stopped by the harness). Scratch
probes and capture staging live in `artifacts/e3-captures/` (uncommitted).

Result: **PASS** — V5 on the documented covered set, V2 and V7; no regressions.

---

## 1. Deliverables

| Deliverable | Location | Notes |
|---|---|---|
| Animation timing registry + triggers + presentation controller | `src/ui/animations.ts` | all 24 sequences: durations `frames / 36`, catalog keyframe offsets, trigger bindings; wordball `getir`/`gotur` slides; no game-state access |
| Slide keyframes | `src/styles/animations.css` | per-frame translateY for `getir` (frames 2–10) and `gotur` (frames 11–19) of DefineSprite_46; `calc(8s / 36)` per slide |
| E3 e2e suite (V5/V2/V7) | `tests/e2e/animations/animations.spec.ts` | 8 tests; `npm run e2e -- animation` |
| C3 scenario scripts | `tests/e2e/animations/scenarios/board.json`, `wordball.json` | reference capture points at the catalog offsets |
| Fresh reference captures | `tests/fixtures/reference/animations/board/`, `…/sprite_wordball_timeline/` | PNGs + C3 `scenario-report.json`/`interaction-log.json` |
| App-vs-reference reports | `evidence/visual/E3/<sequence>/<offset>.png` + `.report.json` + `.heatmap.png` | F1 tool (schemaVersion 2) |
| Animation-trigger wiring | `src/main.ts` | D5 lifecycle callbacks + D4 audio hand-off only; E2 mount and D5 game wiring untouched |

Trigger model (V7): non-audio triggers use the D5 `RoundLifecycleOptions`
callback names (`stateChanged` → `onStateChanged`, `changed` → `onChanged`,
`tick` → `onTick`, `roundStarted`, `roundCompleted`); the ten sound-carrying
clip sprites trigger on the D4 event names of `data/sound-map.json`
(`submitValid`, `scramble`, `countdown`, `submitAlreadyFound`, `roundStart`,
`timeout`, `letterKey`, `tileClick`, `delete`, `submitInvalid`). No new events
were introduced; the controller is presentation-only (CSS classes/ghosts on
E2's board element, `plays`/`lastSequence` counters for tests).

## 2. Reference captures (C3 scenario mode)

`tests/fixtures/reference/animations/board/board-0.0.png` — sequence `board`
(frame 131, offset 0.0). Steps: `waitForState board` (xml64.php 200 + stable
frame + timer gauge, 7569 ms) → `waitStable` (885 ms) → capture (47 ms).
The reference clock reads 199 s at the capture (the suite drives the app to the
same second).

`tests/fixtures/reference/animations/sprite_wordball_timeline/wordball-*.png` —
sequence `sprite_wordball_timeline` (frames 1–39, offsets 0/0.25/0.5278/0.8056/
1.0556). Steps: board wait → stable → `click tile:0` (307 ms) → capture
`wordball-0.0` (71 ms) → `waitMs 190` → capture `0.25` → `waitMs 278` →
`0.5278` → `waitMs 278` → `0.8056` → `waitMs 250` → `1.0556`. The add path
plays the sprite from label `getir` (frame 2) to frame 10 and stops there
(`DefineSprite_46/frame_10/DoAction.as` `stop()`), so the four later captures
record the held settle state (0.25 = 0.5278 = 0.8056 byte-identical; 1.0556
differs only in the timer digit, raw 0.020 %). `wordball-0.0` is a mid-slide
frame: the ball’s red disc spans y 276–304 (centre 290) vs rest y 241–277
(centre 259) → +31 px below rest, i.e. between the sprite’s frame 3 (+39.4 px)
and frame 4 (+27.35 px); the harness click step took 307 ms > the 194 ms slide,
and no frame index is recorded — offset 0.0 is therefore **not** a defined
keyframe state (see §3, row 19).

## 3. Coverage table (all 24 catalogued sequences)

“Covered” = driven in the app to the catalog offset and pixel-checked against
the fresh reference capture (V5). Every gap carries its evidence-based reason.
Sequence ids and spans: `data/animation.json`; sprite geometry: `src/data/layout.json`.

| # | Sequence (frames / duration) | Covered | Reason for the gap |
|---|---|---|---|
| 1 | `preloader` (1–4 / 0.1111 s) | — | Loading is synchronous in the rebuild (D5 `start()` runs `preloader → main` instantly, evidence/D5-lifecycle.md §2); there is no rebuilt preloader frame to sample at 0/0.0278/0.0556/0.0833 s. |
| 2 | `intro` (5–130 / 3.5 s) | — | `main` completes before the first paint (same D5 note); the harness has no frame-5 anchor for the reference intro (only its stable frame is captured by the C3 matrix, and the sun animates continuously — S1’s masked stability), so no catalog offset is reachable as a defined state. |
| 3 | `board` (131 / 0.0278 s) | **@ 0.0** | — |
| 4 | `win` (132–241 / 3.0556 s) | — | End screen excluded from the rebuild (docs/02 §7; E2’s verified states are S1–S7 and S10); the app’s `celebration` state keeps the board. |
| 5 | `intro_glow_motion` (5–222 / 6.0556 s) | — | Element motion on the intro timeline; not painted by the rebuild (row 2). |
| 6 | `intro_logo_motion` (41–202 / 4.5 s) | — | Same (intro not painted). |
| 7 | `hiscore_form_motion` (222–241 / 0.5556 s) | — | End-screen form (excluded, row 4). |
| 8 | `sprite_preloader_progress_timeline` (2 / 0.0556 s) | — | Preloader-only element (row 1). |
| 9 | `sprite_clip_timerr_timeline` (4 / 0.1111 s) | — | Action/sound-only sprite: `layout.json` geometry `—`, 0×0 box, no pixels in any reference state. Trigger wired to D5 `tick` (V7). |
| 10 | `sprite_clip_enter_timeline` (11 / 0.3056 s) | — | Action/sound-only (0×0); D4 event `submitValid` (V7). |
| 11 | `sprite_clip_shuffle_timeline` (29 / 0.8056 s) | — | Action/sound-only (0×0); D4 `scramble` (V7). |
| 12 | `sprite_clip_countdown_timeline` (4 / 0.1111 s) | — | Action/sound-only (0×0); D4 `countdown` (V7). |
| 13 | `sprite_clip_boing_timeline` (12 / 0.3333 s) | — | Action/sound-only (0×0); D4 `submitAlreadyFound` (V7). |
| 14 | `sprite_clip_fanfare_timeline` (12 / 0.3333 s) | — | Action/sound-only (0×0); D4 `roundStart` (V7). |
| 15 | `sprite_clip_finishsound_timeline` (5 / 0.1389 s) | — | Action/sound-only (0×0); D4 `timeout` (V7). |
| 16 | `sprite_clip_typer_timeline` (7 / 0.1944 s) | — | Action/sound-only (0×0); D4 `letterKey`/`tileClick` (V7). |
| 17 | `sprite_clip_backspace_timeline` (11 / 0.3056 s) | — | Action/sound-only (0×0); D4 `delete` (V7). |
| 18 | `sprite_clip_buzz_timeline` (15 / 0.4167 s) | — | Action/sound-only (0×0); D4 `submitInvalid` (V7). |
| 19 | `sprite_wordball_timeline` (39 / 1.0833 s) | **@ 0.25, 0.5278, 0.8056, 1.0556** | @ 0.0 not covered: reference capture is a mid-slide frame (centre +31 px ≈ frame 3–4) — the harness click step (307 ms) exceeds the 194 ms `getir` slide and no frame index is recorded. See §2. |
| 20 | `sprite_timer_bar_timeline` (2 / 0.0556 s) | — | Plays only while the clock is ≤ 10 s (`bar.play()`, evidence/A2-timer.md §2) — a ≈190 s reference wait; the rebuild’s gauge is a continuous fill already verified at the state/second level (D5 + E2), and 2 frames at 27.8 ms are below the harness’s step-timing resolution. |
| 21 | `sprite_loading_banner_timeline` (4 / 0.1111 s) | — | The banner is stopped at its empty frame on the board (`defaultBoardView()` hides it; C3 S2 shows no banner); its loading state is instantaneous in the rebuild (row 1). |
| 22 | `sprite_score_feedback_timeline` (37 / 1.0278 s) | — | Plays on a valid submit; the FFDec export is blank (`s111` — “nested text 109 not inlined”, evidence/E1-assets.md §11.2) and the rebuild paints no feedback (C3 S5 settle shows none). A pixel check would need movie content that is not in any exported asset. |
| 23 | `sprite_status_ball_timeline` (3 / 0.0833 s) | — | Its frames are `gotoAndStop` states picked by `kontrol()` (evidence/A2-strings.md §2), not a played timeline — there are no time offsets to sample; the states are exercised by E2 S4–S7 and D5 tests. |
| 24 | `sprite_bottom_marquee_timeline` (65 / 1.8056 s) | — | Win-screen frame-241 element (excluded, row 4). |

## 4. V5 results per covered keyframe

App drives: `window.__game.selectRound('FİNALİZM')` (D5 TEST-ONLY hook), waits
for `roundId === 'finalizm'` and the recorded displayed second 199
(`remainingMs === 199000`), then captures the `stage-root` (550×400 at dsf 1).
Wordball tests click tile slot 0 (see §9) and wait the catalog offset before the
capture. Verdicts from the F1 tool, `tolerantMismatchRatio <= 0.02`
(anti-aliasing-tolerant basis, docs/07 §4 Amendment 2026-09-28):

| Sequence | Offset (s) | Reference capture (SHA-256) | Raw | Tolerant | Limit | Verdict |
|---|---|---|---|---|---|---|
| `board` | 0.0 | `4a6f9bfd…` (board-0.0.png) | 4.846 % (10 661 px) | **1.011 %** (2 225 px) | 2.0 % | PASS |
| `sprite_wordball_timeline` | 0.25 | `26a9ec53…` (wordball-0.25.png) | 5.158 % (11 347 px) | **1.103 %** (2 427 px) | 2.0 % | PASS |
| `sprite_wordball_timeline` | 0.5278 | `26a9ec53…` (wordball-0.5278.png) | 5.158 % (11 347 px) | **1.103 %** (2 427 px) | 2.0 % | PASS |
| `sprite_wordball_timeline` | 0.8056 | `26a9ec53…` (wordball-0.8056.png) | 5.158 % (11 347 px) | **1.103 %** (2 427 px) | 2.0 % | PASS |
| `sprite_wordball_timeline` | 1.0556 | `f13dd446…` (wordball-1.0556.png) | 5.165 % (11 362 px) | **1.104 %** (2 429 px) | 2.0 % | PASS |

Report/heatmap/capture per row: `evidence/visual/E3/<sequence>/<offset>.{png,report.json,heatmap.png}`
(15 files; hashes in `evidence/logs/E3-artifact-hashes.log`). Raw values stay
recorded/monitored as in E2; the residual is the same fixed Chromium-vs-Ruffle
rasterization gap (evidence/E2-layout.md §6/§11), here also including the
reference-vs-app deck shuffle and the ball letter.

## 5. V2 — code durations equal `data/animation.json`

`tests/e2e/animations/animations.spec.ts` “code durations/keyframes equal
data/animation.json”: all 24 sequences present; `frames` equal and equal
`frameEnd − frameStart + 1`; `durationSec === frames / fps` exact (≤ 1e-12) and
within the A3 V2c tolerance (±0.0005) of the catalog’s rounded value;
`keyframeFrames` equal; keyframe offsets within ±0.0005. PASS.
Input hash unchanged: `data/animation.json` = `src/data/animation.json` =
`c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e`.

## 6. V7 — trigger names ⊆ D5 lifecycle events; D4 names for sound clips

Same suite, “trigger names come from D5 lifecycle events and D4 audio events”:
all 24 sequences have a trigger; every non-audio `source` has its
`on<Source>` callback in `src/game/lifecycle.ts` (source scan); every
`stateChanged` state ∈ `GAME_STATES`; every audio event name ∈
`data/sound-map.json` `events` keys **and** appears as a `play('<event>')` call
in `src/game/lifecycle.ts`; the timer-bar tick gate is 10 s. PASS. Behavioral
check in the same suite: a tile click applies `getir` (and `plays`
increments), Backspace attaches the `gotur` ghost and detaches it after the
slide. PASS.

## 7. Regressions (this task’s changes only touch E3-owned files)

| Check | Command | Result |
|---|---|---|
| E2 V5 suite (unchanged) | `npm run e2e -- visual` | 17 passed (16 comparisons + V7) |
| D5 V6 playthrough | `npm run e2e -- playthrough:basic` | 1 passed |
| Unit tests | `npm test` | 12 files, 217 tests passed |
| Lint | `npm run lint` | clean |
| Build | `npm run build` | exit 0 (bundle contains the E3 keyframes) |

`src/main.ts` changes are limited to the animation wiring
(`createAnimationController`, `beforeRender`/`afterRender` around the board
repaint, callbacks on the existing lifecycle outputs, dev-only
`window.__animations` hook next to E2’s `__visualTest`); D5’s game wiring and
E2’s board mount are intact.

## 8. Silent witness compliance (EXECUTION.md §8)

All reference runs: C3 scenario mode → Chromium launched with `--mute-audio`
(recorded in the interaction logs) and Ruffle CLI was never used. All app runs:
Playwright config launches Chromium with `--mute-audio`; the suite asserts
`window.__game.lastAudioEvent`-independent behavior only (state/DOM/pixels) and
never audibility. No audio was emitted by any run.

## 9. Recorded notes (no silent deviations)

1. **Tile click point.** The reference scenario clicks the slot centre
   (60, 330) (`capture.mjs` `TILE_XS`/`TILE_Y`). In the rebuild the slot’s
   letter field covers that row (clicks on it are not delegated to the tile by
   D5’s `closest('[data-element]')` check), so the app suite clicks (60, 310) —
   the same slot, above the glyph row. Both add the slot-0 letter; asserted by
   the suite (ball appears, `plays` increments).
2. **Evidence layout.** Per-keyframe files are
   `evidence/visual/E3/<sequence>/<offset>.png` with `<offset>.report.json` and
   `<offset>.heatmap.png` (the F1 tool’s fixed `report.json`/`heatmap.png` are
   renamed per offset).
3. **Re-runs.** The suite writes to `test-results/E3-live/` unless
   `E3_RECORD=1` (recorded run #7). The pre-final iteration (#3) failed on a
   spec import path (fixed in scope); both logs are kept.
4. **Scratch.** `artifacts/e3-captures/` holds the probe scripts, dev-server
   logs and staging diffs used to measure feasibility (uncommitted; `artifacts/`
   is git-ignored).
5. **C3 server log.** The scenario runs append their request evidence to
   `evidence/logs/C3-server.log` (harness behaviour, recorded; C3-owned file
   not edited).

## 10. Artifact SHA-256 (key; full list in `evidence/logs/E3-artifact-hashes.log`)

| Artifact | SHA-256 |
|---|---|
| `src/ui/animations.ts` | `db4a2a5801f9b948f6b31591b41bf429f05858ce7578f77220e32f88dcc4b1ef` |
| `src/styles/animations.css` | `0375a170cf71ddd60cf10c49741d11ec8a2edabb97fbba16149c71a500ac88e3` |
| `src/main.ts` | `7078f62036193e0b5c477a124db1a449cc89b4fcdac06b7c5da7985d075fa750` |
| `tests/e2e/animations/animations.spec.ts` | `a8f1be77e8df5b9f7d248e8d10d14dfb2aa5371ecf1ea27c207d89d048968633` |
| `tests/e2e/animations/scenarios/board.json` | `8b5d16b3e4e8781c6b73d6581c198e00f3f72b6378e64cf0f2824bb45d2f8366` |
| `tests/e2e/animations/scenarios/wordball.json` | `7110c1ef6384d41476d56688ad833a7bb564a6cab68b33d46a78d1688fde06c7` |
| `tests/fixtures/reference/animations/board/board-0.0.png` | `4a6f9bfdd04c85b64465a3cf1e902c6ff8a45538b6b71bcbefc21af252865339` |
| `tests/fixtures/reference/animations/sprite_wordball_timeline/wordball-0.25.png` | `26a9ec5333f13cb1c2ece1b5dd569d57dad529f3334ef7f00d5d84b32d9650f3` |
| `data/animation.json` (input, unchanged) | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| `data/sound-map.json` (input, unchanged) | `fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09` |
