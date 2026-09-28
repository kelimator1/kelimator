# C3 — Speaker capture (X3 defect 3 / O24): reference ON/OFF frames

Task: C3 — Reference Harness (speaker-capture continuation; defect-3 verification, O24)
Started: 2026-09-28T20:44:00Z (continuation of the interrupted attempt at 20:36–20:39Z)
Ended: 2026-09-28T20:52:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host) · Node v22.14.0 · Python 3.14.6 · @playwright/test 1.63.0

Commands executed (exact; in order, from this task's shell history):

1. `node verify/reference/capture.mjs --scenario verify/reference/scenarios/speaker-probe.json --out tests/fixtures/reference/speaker-probe --runs 1 --port 8799` → exit 0 (fresh witness of the click/off probe; `evidence/logs/C3-speaker-scenario.log`, requests in `evidence/logs/C3-server.log`)
2. `node verify/reference/capture.mjs --scenario verify/reference/scenarios/speaker.json --out tests/fixtures/reference/speaker --runs 1 --port 8799` → exit 0 (canonical ON/OFF captures)
3. `node --input-type=module -e '<speaker-box pixel measurements; verify/diff/diff.mjs>'` → `evidence/logs/C3-speaker-measure.log` (`decodePng` + `compareImages` of `verify/diff/diff.mjs`)
4. `node verify/reference/check.mjs` → exit 0, new `Vspeaker` PASS (`evidence/logs/C3-speaker-check.log`)
5. `shasum -a 256 verify/reference/scenarios/speaker*.json verify/reference/{check,capture}.mjs verify/reference/README.md tests/fixtures/reference/speaker{,-probe}/* evidence/logs/C3-speaker-*.log` → `evidence/logs/C3-speaker-hashes.log`

Exit codes: 0 for every command above. No git; the read-only package `../kelimator-nostalji/` was not modified; no network beyond localhost.

## 1. What was captured and why the scenario reloads

Reference semantics (all verbatim in `evidence/X3-speaker.md` §1):

- `DefineButton2_90` (`spk_btn`, layout `btn_speaker`, center stage (530.8, 381.8)) carries
  `on(release)`: `vol` 1→0 (+ `stopAllSounds()`) or 0→1, then persists
  `remembervol.data.vol = _root.vol` (SharedObject `data`).
- `DefineSprite_88` frame `on` evaluates `_root.vol` and `gotoAndStop("off")` when
  `vol != 1`; frame `off` is the pale icon (`CXFORMWITHALPHA` mult 108, add 148,
  i.e. `channel' = channel*108/256 + 148`) with the sound waves (character 85) removed.
- The sprite evaluates `vol` when its frames are **entered** (`frame_1`/`frame_2` end in
  `stop()`), so a live in-session click changes `vol` but does not repaint the icon.

Measured (probe, `tests/fixtures/reference/speaker-probe/`, 550×400; box = x 505–549,
y 356–399, 45×44 = 1980 px; `compareImages().mismatchedPixels`):

| pair | meaning | mismatch in speaker box |
|---|---|---|
| `p0-before-away` → `p2-away-after-off` | plain click (then pointer away; `vol` = 0) | **0 px** |
| `p0-before-away` → `p3-away-after-on` | click again, pointer away (`vol` = 1) | **0 px** |
| `p0-before-away` → `p1-after-click-hover` | pointer resting on the button after the click | 403 px (button over-state rendering, **not** the off frame: 331 px from `speaker-off`) |

So a naive "capture, click, capture" would produce a mislabeled after-image (identical to
the before-image). `scenarios/speaker.json` therefore reaches the OFF frame through the
reference's **own persistence path**, exactly the boot flow of `frame_2/DoAction.as`:

```
board → waitStable → capture speaker-before (vol default 1 → "on")
click  button:speaker (531,382)            (on(release): vol = 0, persisted)
waitMs 1000 (flush) → reload → waitForState board → waitStable
capture speaker-off                        (boot restores vol = 0; sprite 88 → "off")
click  button:speaker (vol = 1, persisted) → reload → waitForState board → waitStable
capture speaker-on                         (round trip; on state restored)
```

Both clicks are the named target `button:speaker` (`CLICK_TARGETS.speaker` = (531, 382),
from `src/data/layout.json` `btn_speaker` / `PlaceObject2Tag` ch=90, depth 33; the
task's `coord:530.8,381.8` equivalent). `reload` is the scenario action added for this
path; documented in `verify/reference/README.md`.

## 2. Outputs (canonical, dsf 1, muted)

| File | Dims | SHA-256 |
|---|---|---|
| `tests/fixtures/reference/speaker/speaker-before.png` | 550×400 | `bb620e1ef8d73151dd899c1918a65aa2cc43e04bedfac7a0db8785fc9a6fb271` |
| `tests/fixtures/reference/speaker/speaker-off.png` | 550×400 | `2578c16f0a9e269f2f3a31cf63b21f45cd09fe3152b3f1d035df2fb58c94ec5d` |
| `tests/fixtures/reference/speaker/speaker-on.png` | 550×400 | `af21a62fd0a083c315dec853c29654f3fa973ea9827b38ad94bd364e62bb3243` |
| `tests/fixtures/reference/speaker/interaction-log.json` | — | `f22b7f8819942ed8a75ec18269e3800ec87511f4e79432d644c21d81702d2e2a` |
| `tests/fixtures/reference/speaker/scenario-report.json` | — | `d231233a7287ef054218e7bb435f2994868d13df637e8e77dae30a4f85ca23b4` |
| `tests/fixtures/reference/speaker-probe/p0-before-away.png` | 550×400 | `44d6c8efcb46b7ccc11c839551672ec71b06b9c5a4e8cdaeba2bb0cfc96fbe2a` |
| `tests/fixtures/reference/speaker-probe/p1-after-click-hover.png` | 550×400 | `fdb496e9fab6d46eaec58ccbd38d6d2b875495bfece87d056ce5bcef8a0515cf` |
| `tests/fixtures/reference/speaker-probe/p2-away-after-off.png` | 550×400 | `11ce8b1ee1942f74ca4b34ba6000c4a47480b2c0c0bcfec16dbd907322beb654` |
| `tests/fixtures/reference/speaker-probe/p3-away-after-on.png` | 550×400 | `bb552199e6a4ccacef18f20ae3c7ede42bdd121ab3d009aa5c623def3060fbd8` |
| `tests/fixtures/reference/speaker-probe/interaction-log.json` | — | `1e594eac60adf3ff88910d038771199eacb0acaf295110cd9fd01beddff0aa73` |
| `tests/fixtures/reference/speaker-probe/scenario-report.json` | — | `102cf8f2f0c06f004373f69e2467a60db48456c6178ddffe11de4b14dfda0eae` |
| `verify/reference/scenarios/speaker.json` | — | `911bfd841021ed7255ea6ce54fb9c901dded6c71c4ac075a0e580fe6d36c457a` |
| `verify/reference/scenarios/speaker-probe.json` | — | `9da2da6160d3b8f94f462ba41fc0ea0aa6969d887435bd1c5bc671bd2dc97b88` |
| `verify/reference/check.mjs` (Vspeaker added) | — | `6ed35858067490ea53417cc2caedafe10a1ffc60b33aa67c78f6ec76dadaa911` |
| `verify/reference/capture.mjs` (scenario reload/target; comment only since the interrupted run) | — | `1e30d3688dcba2b613a715cb542854982efcd5a197b7a0edec8deaa07aac51a0` |
| `verify/reference/README.md` (scenario docs: `reload`, `speaker`) | — | `3171315e1ce89faeb0fe208ba121ba2cd09b81cadb22cd85b86c3a10251908fe` |

Logs (final, after this task's writes):

| File | SHA-256 |
|---|---|
| `evidence/logs/C3-speaker-scenario.log` (both fresh runs; earlier interrupted attempt retained above them) | `31907e2c30c69c9b841600896e8077803b06faaa461e11eeaa34b61460d6d7bd` |
| `evidence/logs/C3-speaker-measure.log` | `40c83cd14b8a286d7bd950d63c930d17984ba4facb65abf573fc3c393bc324fd` |
| `evidence/logs/C3-speaker-check.log` | `edf592aa56d358b73b247ee5143984b2c46db036524fc3cbdc5ec0252fa51f9c` |
| `evidence/logs/C3-server.log` (appended by these runs) | `7c6682e575bb15ea46f7655bf49ea74ce816386b71bf37885610f47c734532cb` |

Run evidence (fresh runs, 2026-09-28T20:45:32–20:46:14Z; recorded in `C3-server.log` and the
JSONs):

- probe run: board `xml64.php?517729 -> 200`, all 13 steps ok, 4 captures 550×400.
- speaker run: board requests `?29462`, `?512947` (after first reload), `?520750` (after
  second reload), all `-> 200`, gauge 0.6783 and stable streak 3 on each board wait, all
  15 steps ok, 3 captures 550×400.
- `harness.launchArgs = ["--mute-audio"]`, viewport 550×400, `deviceScaleFactor = 1`
  in both interaction logs (silent witness runs, EXECUTION.md §8).
- `missingKeys = []` in both reports; `ok = true`.

## 3. Measured ON/OFF validity (box x 505–549, y 356–399)

| pair | mismatch | bbox (box-local) |
|---|---|---|
| `speaker-before` → `speaker-off` | **331 px** (16.72 %) | `{x:10,y:10,width:32,height:32}` = the speaker control (`btn_speaker` display bbox 513.99,364.74–547.53,398.83 in `src/data/layout.json`) |
| `speaker-before` → `speaker-on` | **0 px** | — (round trip restores the on frame pixel-exactly) |
| `speaker-off` → `speaker-on` | 331 px | same sprite box |

Pixel content inside the box: ON mean (221.3, 194.4, 156.7), dark px 258 (wave strokes
present); OFF mean (233.3, 212.6, 173.9), dark px 47 (waves removed, icon pale). The
sprite-88 frame-off `CXFORM` was checked against the raw tag values
(`multTerm 108, addTerm 148` — `artifacts/decompiled/tags.xml` L45951):

- of the 331 changed pixels, **240 match `round(channel*108/256 + 148)` within 1/255 in
  all three channels** (e.g. (531,368): on (0,0,0) → off (148,148,148) = `0·108/256+148`;
  (533,368): on (203,64,64) → off (234,175,175), predicted (234,175,175));
- the remaining 91 are the removed waves' stroke/edge pixels (e.g. (541,366):
  on (125,115,89) — a wave stroke — becomes the plain background (249,229,177)); they
  are not icon pixels.

This is the reference baseline for O24 (the rebuild's `feComponentTransfer` filter is
`slope 108/256, intercept 148/255` in `src/ui/hud.ts`; comparing the rendered rebuild
against `speaker-off.png` is the remaining O24 step — X3 filter, no semantics change).

## 4. check.mjs

`node verify/reference/check.mjs` → exit 0, `ALL CHECKS PASS`, including the new static
check (full output in `evidence/logs/C3-speaker-check.log`):

```
PASS  Vspeaker  speaker scenario artifacts: 3 captures at 550x400, JSONs parse; speaker-box mismatch OFF vs ON=331px, restored ON vs ON=0px
```

`Vspeaker` validates the committed `tests/fixtures/reference/speaker/` artifacts: the three
captures exist and decode to 550×400, the JSONs parse, report dims/sha256 match the files,
`ok = true`, no missing keys, `deviceScaleFactor = 1`, `--mute-audio` recorded, the OFF
capture differs from the ON capture inside the speaker box, and the restored ON capture
matches the initial ON there. Like V2 this is a static check of committed artifacts; the
scenario itself is reproducible with command 2 above (port 8799, muted, dsf 1). The
`speaker-probe` captures are supplementary justification (§1), not part of `Vspeaker`.

## 5. Notes

- The log `evidence/logs/C3-speaker-scenario.log` first contains the earlier interrupted
  attempt (runs at 20:38Z, prior artifacts, now superseded) and then the fresh witness
  runs at 20:45–20:46Z whose artifacts the hashes above describe. The scenario and code
  are unchanged between the two attempts except this continuation's documentation edits.
- The scenario reloads within the same browser context, so the SWF's persisted
  SharedObject (`vol`) is what carries the toggle across boots — nothing is stubbed or
  injected; only the page is reloaded.
- The fixture served is the reconstructed Base64 one (`80506d3e…`); the archived input was
  read-only and unchanged.

## 6. docs/08-open-items.md proposal (single-writer: orchestrator applies)

Status update for O24 (exact text proposal):

```
UPDATED 2026-09-28 — evidence/C3-speaker-capture.md — reference speaker ON/OFF frames captured for O24 (tests/fixtures/reference/speaker/: speaker-before/off/on, 550x400, dsf 1, muted; scenario scenarios/speaker.json; Vspeaker PASS in check.mjs exit 0). OFF vs ON differ by 331 px inside the speaker box; the icon pixels match the raw sprite-88 CXFORM (channel*108/256+148) within 1/255 and the waves (character 85) are removed. A plain in-session click does not repaint the sprite (0 px) — the OFF frame is reached via the reference's own persistence path (click -> reload). Remaining: compare the src/ui/hud.ts off filter against speaker-off.png; adjust the filter only if it differs.
```
