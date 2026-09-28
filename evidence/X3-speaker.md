# X3 — Speaker Toggle (owner defect 3) + O24 follow-up

Task: X3 — Speaker Toggle (owner defect 3); O24 follow-up (reference pixel verification + swap timing)
Started: 2026-09-28T20:25:52Z (first X3 artifact write, `src/audio/audio.ts`; local 23:25:52 +03)
O24 continuation: 2026-09-28T20:56Z → 2026-09-28T21:05Z (C3 speaker captures committed and read; app
captures, whole-stage + region diffs, attribution, timing change, tests; artifact timestamps in `evidence/X3-o24/`)
Ended: 2026-09-28T21:07:31Z (evidence finalization; last verification log 21:05:03Z)
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host) · Node v22.14.0 · Python 3.14.6
Commands executed (exact; full output in `evidence/logs/X3-*.log`):
- `npm test -- speaker` → `evidence/logs/X3-test-speaker.log`
- `npm run e2e -- speaker` → `evidence/logs/X3-e2e-speaker.log`
- `npm run e2e -- visual` → `evidence/logs/X3-e2e-visual.log`
- `npm run e2e -- playthrough:basic` → `evidence/logs/X3-e2e-playthrough-basic.log`
- `npm test` → `evidence/logs/X3-test-full.log`
- `npm run lint` → `evidence/logs/X3-lint.log`
- `npm run build` → `evidence/logs/X3-build.log`
- `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5273 --strictPort` (background) +
  `node tests/e2e/speaker/capture-states.mjs http://127.0.0.1:5273/` → O24 captures, whole-stage diffs,
  region diffs, attribution → `evidence/X3-o24/**`, `evidence/logs/X3-o24-verify.log`
- `node --input-type=module -e '<E2 S2 actual × X3 app ON × C3 ref ON, speaker-box crop>'` →
  `evidence/logs/X3-o24-s2-cross-check.log`
Exit codes: 0 for every command above.
Output summary: reference semantics fully extracted (decompiled `DefineButton2_90` +
`DefineSprite_88` + boot/volume-gate scripts); speaker toggle implemented end-to-end
(`src/audio/audio.ts` `isMuted()`/`toggleMute()`, `src/ui/hud.ts` delegated listener +
sprite-88 "on"/"off" visual state on E2's rendered `btn_speaker` element, applied at
boot/render from the persisted volume only); 9 unit tests (`tests/speaker.test.ts`) and
3 e2e tests (`tests/e2e/speaker/speaker.spec.ts`) added; O24 verified against the C3
reference captures at dsf 1 (`evidence/X3-o24/`, §7).
Artifact SHA-256 hashes:
- `src/audio/audio.ts` `c3176d9e0158af0236b86a8282ad79f248eee72dcc853bc70fedd4a90613b2d5`
- `src/ui/hud.ts` `b39934fbfcc04bcdc2b1a32909a98fccd513652262831a3d6bf35d805733f52d`
- `tests/speaker.test.ts` `96a110e74e685766f411bfeb9ff173d453e271a3fe4b1d0153154e97e02b58ae`
- `tests/e2e/speaker/speaker.spec.ts` `1dc8ef598f6842dda601f4e9e3cd470a68e52ec2f937d69cad3d35c2e869c6d8`
- `tests/e2e/speaker/capture-states.mjs` `58e945390884740f1ad2c7ba855542ba953313180657d9664eaa0f8029be7102`
- `evidence/X3-o24/app-speaker-on.png` `eecd63e0ced5eba5fa5d77b83b870b809bc4095db3c952ae667926677f8fac37`
- `evidence/X3-o24/app-speaker-off.png` `d8341f932b0d9046f6d988b945684fb182e81cbab1d12982c33c39740bccb2f2`
- `evidence/X3-o24/analysis.json` `3dd03f2d6552acf59a21a88c626830f692782ef00caac9df7254000ea9fecac4`
Result: PASS

---

## 1. Reference semantics (evidence first — fully evidenced)

### 1.1 Control identity chain (what "the speaker button" actually is)

The task input says "button/sprite 87 (frame label `on`; bitmap 86)". The raw
tag/export chain is (each step verbatim from the artifacts):

- `evidence/A1-bitmaps.md` §3 (L50-L51):
  > - bitmap **86** → 1 fill inside **shape 87** (`DefineShape`, main timeline);
  >   `PlaceObject2 (chid: 87, dpt: 2)` inside **`DefineSprite` 88** (frame label `"on"`).
- `artifacts/decompiled/tags.xml` L45936-L45956 — `DefineSpriteTag` `spriteId="88"`,
  `frameCount="2"`: frame 1 `FrameLabelTag name="on"` (L45940), frame 2
  `FrameLabelTag name="off"` (L45950). Character ids 85 (waves) and 87 (bitmap-86 icon)
  are placed at depths 1/2 (L45941-L45946).
- `artifacts/decompiled/tags.xml` L45984-L46005 — `DefineButton2Tag buttonId="90"`:
  up/over/down button records reference `characterId="88"` (hittest = shape 89), and its
  `BUTTONCONDACTION` carries the `on(release)` action (L46004).
- `artifacts/decompiled/tags.xml` L46007 — placement:
  `<item type="PlaceObject2Tag" characterId="90" depth="33" ... name="spk_btn" .../>`
  (`translateX="10610" translateY="7636"` → 530.5 / 381.8 stage px); same line in
  `artifacts/decompiled/tags.txt` L949:
  `PlaceObject2 (chid: 90, dpt: 33, nm: "spk_btn")`.
- `src/data/layout.json` `btn_speaker` (L554-L568): display bbox
  `(513.99, 364.74, 547.53, 398.83)`, asset `src/assets/svg/s90_btn_speaker.svg`,
  evidence string "button 'spk_btn' (sound on/off)".
- `evidence/E1-assets.md` §9 (L139) confirms `s90_btn_speaker.svg` is the up-state
  export that inlines bitmap 86 (shape 87) inside `DefineSprite` 88.

So: **shape 87** fills bitmap 86; **sprite 88** carries the frames `on`/`off`;
**button 90** (instance `spk_btn`, layout element `btn_speaker`) carries the click
action. No other speaker-related script exists anywhere in `artifacts/decompiled/scripts/`
(`grep -rln "speaker\|vol" …` returns exactly the six files cited below).

### 1.2 The `on(release)` handler — verbatim

`artifacts/decompiled/scripts/DefineButton2_90/BUTTONCONDACTION on(release).as`
(symbol `DefineButton2_90/BUTTONCONDACTION`, L1-L13):

```actionscript
on(release){
   if(_root.vol)
   {
      _root.vol = 0;
      stopAllSounds();
   }
   else
   {
      _root.vol = 1;
   }
   remembervol = SharedObject.getLocal("data");
   remembervol.data.vol = _root.vol;
}
```

### 1.3 Boot restore and volume gate — verbatim

`artifacts/decompiled/scripts/frame_2/DoAction.as` L1-L9 (boot; default `vol = 1`):

```actionscript
remembervol = SharedObject.getLocal("data");
if(remembervol.data.vol != undefined)
{
   _root.vol = remembervol.data.vol;
}
else
{
   vol = 1;
}
```

`artifacts/decompiled/scripts/frame_131/DoAction.as` L130-L140 (every sound):

```actionscript
function ses_cikart(obj)
{
   stopAllSounds();
   if(vol)
   {
      tellTarget(obj)
      {
         gotoAndPlay(2);
      }
   }
}
```

`artifacts/decompiled/scripts/DefineSprite_21/frame_3/DoAction.as` L4 (countdown gate):
`if(_root.timer < 10 && _root.timer > 0 && _root.vol)`, L15 `if(_root.vol)` (finish sound).

### 1.4 The on/off visual frames — verbatim

`artifacts/decompiled/scripts/DefineSprite_88/frame_1/DoAction.as` L1-L5 (frame `on`):

```actionscript
if(_root.vol != 1)
{
   gotoAndStop("off");
}
stop();
```

`artifacts/decompiled/scripts/DefineSprite_88/frame_2/DoAction.as` L1-L5 (frame `off`):

```actionscript
if(_root.vol == 1)
{
   gotoAndStop("on");
}
stop();
```

Frame shapes (raw tag dump, `artifacts/decompiled/tags.xml` sprite 88):
- frame `on`: depth 1 = character **85** (the sound waves, `DefineShapeTag shapeId="85"`;
  exported `artifacts/decompiled/sprites/DefineSprite_88/1.svg` = shape 85 + shape 87),
  depth 2 = character **87** (bitmap 86 icon).
- frame `off`: `RemoveObject2Tag depth="1"` (L45948 — waves removed) + depth-2 move with
  the color transform (L45951-L45952):
  `<colorTransform type="CXFORMWITHALPHA" alphaAddTerm="0" alphaMultTerm="256" blueAddTerm="148" blueMultTerm="108" greenAddTerm="148" greenMultTerm="108" hasAddTerms="true" hasMultTerms="true" nbits="10" redAddTerm="148" redMultTerm="108"/>`
  — i.e. the icon is drawn pale: `channel' = channel * 108/256 + 148` (alpha unchanged).
  `artifacts/decompiled/sprites/DefineSprite_88/2.svg` shows only shape 87 (no waves);
  FFDec's frame SVG export does not apply the CXFORM, so the transform is taken from the
  raw tag dump.

### 1.5 Derived semantics table

| Reference event | Verbatim source | Rebuild mapping |
|---|---|---|
| click while `vol` truthy | `vol = 0; stopAllSounds();` (`DefineButton2_90` L2-L6) | `toggleMute()` → `setVolume(0)` (pauses pool) |
| click while `vol` falsy | `vol = 1;` (`DefineButton2_90` L7-L10) | `toggleMute()` → `setVolume(100)` (full scale) |
| persist after every toggle | `remembervol.data.vol = _root.vol` (L11-L12) | `setVolume` writes `kelimator.volume` (D4 decision record) |
| boot restore, default on | `frame_2/DoAction.as` L1-L9 | manager constructor reads `kelimator.volume`, default 100 |
| sound gate | `frame_131` L133 `if(vol)` | `play()` returns false at volume 0 (records the event) |
| visual on/off | sprite 88 frames `on`/`off` (L45936-L45954) | `data-speaker="on"/"off"`, waves character 85, frame-off CXFORM filter |

Exact semantics are **fully evidenced** for toggle, persistence, gating and both frame
visuals. No labels were invented. The SWF CXFORM → `feComponentTransfer` conversion
(`mult/256`, `add/255`) is the only interpretive step and is verified in §7 (O24).

Timing note (reconciled in §7.3): the reference sprite evaluates `_root.vol` when its
frames are entered (`frame_1`/`frame_2` scripts end in `stop()`), and the C3 probe measured
a plain click as 0 px changed. The rebuild therefore toggles the audio state + persistence
on click and applies the frame **at boot/render** from the persisted volume — never on the
click itself. Observable state (`on` ⇔ `vol = 1`, `off` ⇔ `vol = 0`) is identical.

C3's committed scenario run (`evidence/C3-speaker-capture.md`) provides the reference
ON/OFF frames (`tests/fixtures/reference/speaker/`); the app-side comparison is §7.

## 2. Implementation

### 2.1 `src/audio/audio.ts` (D4 surface extended, no D4 behavior changed)

- `AudioManager.isMuted(): boolean` — true at volume 0 (reference `vol` false).
- `AudioManager.toggleMute(): number` — `isMuted() ? setVolume(DEFAULT_VOLUME) : setVolume(MIN_VOLUME)`;
  the mute branch therefore runs `stopAllSounds()` (D4 `setVolume(0)`), the unmute branch
  restores full volume (reference `vol = 1`); neither branch plays a sound.
- Module-level `isMuted()` / `toggleMute()` operate on the app-wide manager (the same
  singleton `playAudioEvent`/`getLastAudioEvent` use).
- Persistence/clamping are unchanged D4 paths: `kelimator.volume`, default 100, clamp
  0–100, no write on boot read.

### 2.2 `src/ui/hud.ts` (control + visual state, E2 render untouched)

- A delegated `click` listener on `options.board` (the same board root `main.ts` already
  passes) — necessary because `board.apply` re-creates the speaker element on every
  render; no `src/ui/board.ts` / `src/main.ts` edit was needed or made.
- The element keeps its catalog `data-element="btn_speaker"` and `.board-svg` box; the
  HUD adds `data-speaker="on"|"off"` (frame labels), the `game-speaker` cursor class, and
  applies the frame-`off` visuals: hides the waves `use` (character 85, matched
  case-insensitively because the HTML parser lowercases `ffdec:characterId` →
  `ffdec:characterid`) and sets an SVG `feComponentTransfer` filter (slope 108/256,
  intercept 148/255, sRGB) on the icon `use` (character 87).
- `syncSpeakerVisual` runs at mount and after every `update()` (boot/render) and reads the
  persisted volume; the click handler does **not** call it — the reference sprite does not
  repaint on a plain click (C3 probe: 0 px, §7.3). `destroy()` removes the listener.

## 3. Tests

### 3.1 Unit — `tests/speaker.test.ts` (9 tests, silent fakes)

- on(release) semantics: mute → volume 0 + pool paused + persisted `'0'`; muted `play`
  returns false, records the event, starts nothing; unmute → volume 100 persisted, no
  resume (playCalls/pauseCalls unchanged), pool volume re-applied to 1.
- repeated toggles alternate exactly 0/100; unmute after a partial volume (37) goes to
  100 (reference `vol = 1`, boolean).
- persistence round-trip across fresh managers (0 → boot muted; 100 → boot on), default
  100 with no boot write, clamped stored values (`999→100`, `-3→0`, `abc→100`).
- `clampVolume` bounds (NaN/Infinity → default).
- module singleton: `getVolume`/`isMuted`/`toggleMute`/`playAudioEvent`/`getLastAudioEvent`
  through stubbed `localStorage` + a fake `Audio` global (nothing audible).

### 3.2 E2E — `tests/e2e/speaker/speaker.spec.ts` (3 tests, Chromium `--mute-audio`)

- click semantics: toggles the audio state + persistence only — `kelimator.volume`
  `'0'`/`'100'`, `lastAudioEvent` still records while muted (`delete`/`scramble`), and the
  icon is asserted **not** to repaint (speaker screenshots are byte-equal before/after the
  click — the C3 probe analogue).
- icon at boot/render: a render (SPACE/BACKSPACE) applies the persisted volume
  (`data-speaker="off"`, waves `display:none`; the restored ON screenshot is byte-equal to
  the initial ON); a reload boots the persisted frame (muted boot shows `off` and still
  records `roundStart`); unmute persists `'100'` across another reload.
- clamp: stored `999` boots `on` (→100), stored `-5` boots `off` (→0).

## 4. Verification (exact commands, results)

| Command | Result | Log |
|---|---|---|
| `npm test -- speaker` | 1 file, **9 passed**, exit 0 | `evidence/logs/X3-test-speaker.log` |
| `npm run e2e -- speaker` | **3 passed**, exit 0 | `evidence/logs/X3-e2e-speaker.log` |
| `npm run e2e -- visual` | **17 passed** (S1–S7/S10 dsf1+dsf2, V7), exit 0 | `evidence/logs/X3-e2e-visual.log` |
| `npm run e2e -- playthrough:basic` | **1 passed**, exit 0 | `evidence/logs/X3-e2e-playthrough-basic.log` |
| `npm test` | 13 files, **227 passed**, exit 0 | `evidence/logs/X3-test-full.log` |
| `npm run lint` | exit 0, no findings | `evidence/logs/X3-lint.log` |
| `npm run build` | `tsc --noEmit` + vite build green, exit 0 | `evidence/logs/X3-build.log` |
| `node tests/e2e/speaker/capture-states.mjs` (vite dev :5273, muted) | O24 captures, 3 whole-stage diffs, 3 region diffs, attribution, exit 0 | `evidence/logs/X3-o24-verify.log` |
| E2 S2 actual × app ON × C3 ref ON (speaker box) | 0 px / 466 px / 466 px, exit 0 | `evidence/logs/X3-o24-s2-cross-check.log` |

No regression: the visual suite ratio reports and the FİNALİZM playthrough are unchanged
(exit 0); E2's V7 layout cross-consistency passes.

## 5. Silent-witness compliance (EXECUTION.md §8)

- Unit tests inject fake elements and in-memory storage; no real `HTMLAudioElement` is
  constructed, nothing is played.
- E2E runs under the existing app project (`playwright.config.ts`
  `launchOptions: { args: ['--mute-audio'] }`); the suite never overrides it and asserts
  state/persistence, never audibility. `lastAudioEvent` is documented (docs/04 §6) as a
  state hook that records even while muted.
- The debuggable off-state filter is pure SVG; no audio API is touched by the HUD.

## 6. Hand-offs / notes

- `src/main.ts`, `src/ui/board.ts`, `src/data/layout.json`, `docs/**` were **not** touched
  (X3 owned paths only); the listener is self-wired from `hud.ts` to `audio.ts`.
- O24 reproducibility: `node tests/e2e/speaker/capture-states.mjs <vite-url>` regenerates the
  app captures, the whole-stage and region diffs and the attribution analysis under
  `evidence/X3-o24/` (manual run, not part of `npm run e2e`; Chromium is muted).
- Task input naming note (recorded, not a defect): the frame-label visual lives in
  `DefineSprite` **88** (frames `on`/`off`); **shape 87** is the bitmap-86 fill; the
  button is `DefineButton2` **90** (`spk_btn`).
- No git commands were run; `../kelimator-nostalji/` was not modified.

## 7. O24 — reference ON/OFF pixel verification (follow-up)

C3's committed speaker captures (`evidence/C3-speaker-capture.md`;
`tests/fixtures/reference/speaker/speaker-{before,on,off}.png`, 550×400, dsf 1, muted)
were used to pixel-verify the rebuild. App captures were taken at stage 550×400, dsf 1,
`--mute-audio`, from a dev server (`tests/e2e/speaker/capture-states.mjs`, outputs under
`evidence/X3-o24/`):

- ON: boot with no stored volume (`kelimator.volume` absent → default 100) →
  `data-speaker="on"`, waves visible; sha `eecd63e0…`.
- OFF: boot with persisted `kelimator.volume = 0` (the reference's own path) →
  `data-speaker="off"`, waves `display:none`; sha `d8341f93…`.

### 7.1 Diffs (F1 tool `verify/diff/diff.mjs`; region = box x505–549 y356–399, 45×44 = 1980 px, the C3 measurement box)

| Pair | Whole stage (220,000 px) raw / tolerant | Region (1,980 px) raw / tolerant |
|---|---|---|
| app ON ↔ ref `speaker-before` | 17,930 (8.150 %) / 6,968 (3.167 %) | 466 (23.535 %) / 162 (8.182 %) |
| app ON ↔ ref `speaker-on` | 18,008 (8.185 %) / 6,950 (3.159 %) | 466 (23.535 %) / 162 (8.182 %) |
| app OFF ↔ ref `speaker-off` | 17,733 (8.060 %) / 6,852 (3.115 %) | 291 (14.697 %) / 36 (1.818 %) |

Whole-stage ratios are context only: the reference captures show the fixture round while
the app boots its own round 1 (different deck letters, timer digits, revealed state), which
dominates the difference. Whole-stage reports `evidence/X3-o24/diff-*/report.json`; region
reports + cropped app/ref PNGs + heatmaps `evidence/X3-o24/region-*`.

### 7.2 Where the region residual comes from (attribution)

- **The frame-off mapping is exact.** Of the changed icon pixels whose ON colour is an
  opaque bitmap-86 palette colour, the app maps **18/18 within 2/255 (17 within 1/255)** of
  `round(c·108/256 + 148)`, no outliers; the reference maps 240/241 within 1/255 and its
  single outlier (box-local 31,13) is a removed wave stroke, not icon ink
  (`evidence/X3-o24/analysis.json`). No slope/intercept change was made — there is nothing
  for the mapping to absorb.
- **The residual is spatial, not colour.** The rebuild renders bitmap 86 through the inline
  SVG pattern at a ~0.5-px phase with bilinear resampling: best 1:1 match 237/609
  (**38.9 %**) vs the reference's 586/609 (**96.2 %**); best phase fit (dx, dy) = (0.5, 0.5)
  at (11, 12) with 551/825 (**66.8 %**) vs the reference's (0, 0) at (11, 11) with 723/825
  (**87.6 %**). The bitmap itself is byte-identical (sha `74710a87…` = A1 `images/86.png`);
  the app and reference simply rasterize it at different sub-pixel phases.
- **Pre-existing E2/E1 rendering gap, unchanged by X3.** E2's frozen
  `evidence/visual/E2/S2/dsf1/actual.png` equals the X3 app ON capture **0 px** in the
  speaker box, and both differ from the C3 reference by the same 466 px
  (`evidence/logs/X3-o24-s2-cross-check.log`).
- **Sampling-mode diagnostic** (runtime only, no code change): applying
  `image-rendering: pixelated` to the speaker image/svg moves the ON region from
  23.535 % raw / 8.182 % tolerant to **21.263 % / 5.556 %** — the phase remains, so the gap
  is not one sampling-mode switch away (`evidence/X3-o24/diag-app-speaker-on-pixelated.png`).

Conclusion: the OFF frame's colour mapping matches the reference baseline; the remaining
region difference is the speaker icon's rasterization phase produced by E2's inline-SVG
pattern placement, outside X3's owned files. Pixels cannot be made to match 1:1 from the
filter mapping, so a documented note plus a separate E2-side item are proposed (§8) instead
of an un-evidenced filter tweak.

### 7.3 Swap timing (reconciled with the C3 probe)

C3 measured a plain in-session click as **0 px** changed in the speaker box (probe
`p0-before-away` → `p2-away-after-off` / `p3-away-after-on`; only a pointer resting on the
button differs, 403 px, and that is the over-state, not the off frame —
`evidence/C3-speaker-capture.md` §1). This matches the sprite scripts: `frame_1`/`frame_2`
evaluate `_root.vol` on frame entry, then `stop()`, so the reference reaches OFF through
its own persistence path (click → reload → boot), which is exactly how the C3 OFF capture
was produced.

The rebuild was adjusted accordingly (`src/ui/hud.ts`): the click handler calls
`toggleMute()` only (the `vol` toggle + `stopAllSounds()` + persistence); `syncSpeakerVisual`
runs at mount and in every `update()` (boot/render) and reads the persisted volume. Tests
updated: the e2e now asserts click → storage/persistence + **no** icon repaint (screenshot
equality), a render applies the persisted frame, and boot/reload applies it from storage
(§3.2); `tests/speaker.test.ts` records that the icon timing is HUD-level (audio semantics
unchanged, 9/9).

## 8. docs/08-open-items.md proposal (single-writer: orchestrator applies)

Resolution line for owner defect wave item (3) — exact text (updated for O24):

```
RESOLVED 2026-09-28 — evidence/X3-speaker.md — speaker `spk_btn` (DefineButton2_90) implemented: `on(release)` toggles `_root.vol` (0 = mute + stopAllSounds, 1 = full), persisted as `kelimator.volume` (D4 manager, default 100, clamp 0–100); E2's `btn_speaker` element gets the delegated listener; the sprite-88 frames "on"/"off" are applied from the persisted volume at boot/render only (C3 probe: a plain click does not repaint, 0 px). 9 unit + 3 e2e tests; visual/playthrough suites unchanged.
```

O24 closure — exact text proposal:

```
RESOLVED 2026-09-29 — evidence/X3-speaker.md §7 — O24 closed: frame-off filter pixel-verified against tests/fixtures/reference/speaker/speaker-off.png at dsf 1 (region x505–549 y356–399: ON raw 23.5 %/tolerant 8.2 %, OFF raw 14.7 %/tolerant 1.8 %; whole stage ≈8.1 % raw, fixture-vs-boot-round context). The feComponentTransfer mapping (slope 108/256, intercept 148/255) equals the reference CXFORM on all measured opaque icon pixels (app 18/18 within 2/255, reference 240/241 within 1/255, its outlier a removed wave pixel) — no mapping change. The residual is spatial (app icon resampled at a 0.5-px phase; E2 S2 baseline == app ON 0 px, both 466 px from the reference), documented as a separate E2-side item. Timing reconciled: click toggles vol + persistence only; the icon applies at boot/render from the persisted volume.
```

New OPEN-item proposal (E2-owned rasterization phase; exact text):

```
OPEN — speaker icon rasterization phase (E2): the rebuild renders bitmap 86 through the inline SVG pattern at a 0.5-px phase with bilinear resampling, so the speaker box differs from the C3 reference (region ON raw 23.5 %/tolerant 8.2 %, OFF 14.7 %/1.8 %; bitmap match 38.9 % at 1:1 vs the reference's 96.2 %; best phase fit (0.5,0.5) 66.8 % vs 87.6 %). X3's frame-off filter adds no outliers (18/18 opaque pixels within 2/255); a runtime `image-rendering: pixelated` diagnostic only moves ON to 21.3 %/5.6 %. Fix would be integer-phase/sampling alignment in src/ui/board.ts (E2-owned). Evidence: evidence/X3-speaker.md §7, evidence/X3-o24/analysis.json, evidence/logs/X3-o24-s2-cross-check.log.
```

## 9. Result

**PASS** — reference semantics fully evidenced; toggle, persistence
(`kelimator.volume`, default 100, clamp 0–100), audio gating and the on/off visual state
implemented end-to-end in the owned files, with the icon applied at boot/render from the
persisted volume (C3 probe: no repaint on click); 9 unit + 3 e2e tests pass; full
`npm test`, `npm run lint`, `npm run build`, `npm run e2e -- visual` and
`playthrough:basic` stay green. O24 pixel verification: the OFF-frame filter mapping
matches the reference CXFORM (18/18 within 2/255; reference 240/241), region OFF raw
14.7 %/tolerant 1.8 %, with the residual attributed to the pre-existing E2 icon
rasterization phase (documented note + E2-side OPEN proposal in §8).
