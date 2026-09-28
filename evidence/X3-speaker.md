# X3 — Speaker Toggle (owner defect 3)

Task: X3 — Speaker Toggle (owner defect 3)
Started: 2026-09-28T20:25:52Z (first X3 artifact write, `src/audio/audio.ts`; local 23:25:52 +03)
Ended: 2026-09-28T20:34:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host) · Node v22.14.0 · Python 3.14.6
Commands executed (exact; full output in `evidence/logs/X3-*.log`):
- `npm test -- speaker` → `evidence/logs/X3-test-speaker.log`
- `npm run e2e -- speaker` → `evidence/logs/X3-e2e-speaker.log`
- `npm test` → `evidence/logs/X3-test-full.log`
- `npm run lint` → `evidence/logs/X3-lint.log`
- `npm run build` → `evidence/logs/X3-build.log`
- `npm run e2e -- visual` → `evidence/logs/X3-e2e-visual.log`
- `npm run e2e -- playthrough:basic` → `evidence/logs/X3-e2e-playthrough-basic.log`
Exit codes: 0 for every command above.
Output summary: reference semantics fully extracted (decompiled `DefineButton2_90` +
`DefineSprite_88` + boot/volume-gate scripts); speaker toggle implemented end-to-end
(`src/audio/audio.ts` `isMuted()`/`toggleMute()`, `src/ui/hud.ts` delegated listener +
sprite-88 "on"/"off" visual state on E2's rendered `btn_speaker` element); 9 unit tests
(`tests/speaker.test.ts`) and 3 e2e tests (`tests/e2e/speaker/speaker.spec.ts`) added.
Artifact SHA-256 hashes:
- `src/audio/audio.ts` `c3176d9e0158af0236b86a8282ad79f248eee72dcc853bc70fedd4a90613b2d5`
- `src/ui/hud.ts` `90e76a6c2aaa5bcfec69b3b98dead7c2ae0f957c9dce0716a5356b164d3e3e82`
- `tests/speaker.test.ts` `00d3e9659777ed7f0debd23449e462fb173fc6729a4188afbeb8c331f85c5797`
- `tests/e2e/speaker/speaker.spec.ts` `c5d8c083c41b2a88ebf3658d3e0c5675ee9b352f8caf7b074266a84caf7e8c91`
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
visuals. No labels were invented. The only interpretive step is the SWF CXFORM →
`feComponentTransfer` conversion (`mult/256`, `add/255`), recorded as the OPEN-item
proposal in §7.

Note (recorded, not changed): the reference sprite evaluates `_root.vol` on frame
`on`/`off` entry (`frame_1`/`frame_2` scripts end in `stop()`), so its icon repaints when
the button's state re-instantiates the sprite; the rebuild has a single rendered element,
so the HUD re-applies the same two frames immediately on toggle and after every E2
re-render. Observable state (`on` ⇔ `vol = 1`, `off` ⇔ `vol = 0`) is identical.

C3 scenario mode (read-only `--scenario`, muted) was **not run**: the semantics above are
fully evidenced from the decompiled ActionScript, and the harness appends its request log
to `evidence/logs/C3-server.log`, which is outside X3's owned paths (EXECUTION.md §1/§6).

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
- `syncSpeakerVisual` runs at mount, after every `update()` (i.e. after each E2 re-render)
  and on toggle; `destroy()` removes the listener.

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

- click mutes: `data-speaker="off"`, waves `display:none`, `kelimator.volume='0'`, icon
  region screenshot differs from the on state, BACKSPACE still records `delete` while
  muted; second click unmutes (`'100'`, waves visible, SPACE records `scramble`).
- reload persistence: muted boot shows `off` and still records `roundStart`; unmute
  persists `'100'` across another reload.
- clamp: stored `999` boots `on` (→100), stored `-5` boots `off` (→0), toggle to 100.

## 4. Verification (exact commands, results)

| Command | Result | Log |
|---|---|---|
| `npm test -- speaker` | 1 file, **9 passed**, exit 0 | `evidence/logs/X3-test-speaker.log` |
| `npm run e2e -- speaker` | **3 passed**, exit 0 | `evidence/logs/X3-e2e-speaker.log` |
| `npm test` | 13 files, **227 passed**, exit 0 | `evidence/logs/X3-test-full.log` |
| `npm run lint` | exit 0, no findings | `evidence/logs/X3-lint.log` |
| `npm run build` | `tsc --noEmit` + vite build green, exit 0 | `evidence/logs/X3-build.log` |
| `npm run e2e -- visual` | **17 passed** (S1–S7/S10 dsf1+dsf2, V7), exit 0 | `evidence/logs/X3-e2e-visual.log` |
| `npm run e2e -- playthrough:basic` | **1 passed**, exit 0 | `evidence/logs/X3-e2e-playthrough-basic.log` |

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
- Task input naming note (recorded, not a defect): the frame-label visual lives in
  `DefineSprite` **88** (frames `on`/`off`); **shape 87** is the bitmap-86 fill; the
  button is `DefineButton2` **90** (`spk_btn`).
- No git commands were run; `../kelimator-nostalji/` was not modified.

## 7. docs/08-open-items.md proposal (single-writer: orchestrator applies)

Resolution line for owner defect wave item (3) — exact text:

```
RESOLVED 2026-09-28 — evidence/X3-speaker.md — speaker `spk_btn` (DefineButton2_90) implemented: `on(release)` toggles `_root.vol` (0 = mute + stopAllSounds, 1 = full), persisted as `kelimator.volume` (D4 manager, default 100, clamp 0–100); E2's `btn_speaker` element gets the delegated listener plus the sprite-88 frames "on"/"off" (waves removed + frame-off CXFORM icon); 9 unit + 3 e2e tests, visual/playthrough suites unchanged.
```

OPEN-item proposal (pixel fidelity of the off frame; C3 scenario verification is
orchestrator-owned because the harness appends to `evidence/logs/C3-server.log`):

```
OPEN — X3 off-frame pixel fidelity: the sprite-88 frame "off" CXFORM (tags.xml: multTerm 108, addTerm 148) is mapped to an SVG feComponentTransfer (slope 108/256, intercept 148/255) in `src/ui/hud.ts`. Verify against a reference capture (C3 `--scenario`: click `btn_speaker` at stage (530.8, 381.8), capture before/after, muted) that the rendered off-state pixels match; if they differ, adjust the filter only (no semantics change).
```

## 8. Result

**PASS** — reference semantics fully evidenced; toggle, persistence
(`kelimator.volume`, default 100, clamp 0–100), audio gating and the on/off visual state
implemented end-to-end in the owned files; 9 unit + 3 e2e tests pass; full `npm test`,
`npm run lint`, `npm run build`, `npm run e2e -- visual` and `playthrough:basic` stay
green; one OPEN-item proposal recorded (off-frame pixel verification, §7).
