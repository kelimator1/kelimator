# D4 — Audio Manager

Task: D4 — Audio Manager
Started: 2026-09-28T13:39:19Z (first D4 artifact write, `src/audio/audio.ts`; source reading preceded it)
Ended: 2026-09-28T13:43:25Z
Host+OS: dev-host.home / macOS (Darwin, arm64 / arm64 host)
Commands executed (exact): §6 (all command output in `evidence/logs/D4-*.log`)
Exit codes: §6 — 0 for every required command (V4/V7/V1 + typecheck/lint); the only non-zero
exit was the supplementary Vite check whose pass criterion was wrong (`D4-vite-asset-check.log`,
exit 1); the corrected check exits 0 (`D4-vite-asset-check-corrected.log`)
Output summary: `src/audio/audio.ts` (event→sound mapping, pooled playback, volume persistence);
`tests/audio.test.ts` (17 tests, V4/V7); 9 byte-identical sound copies under `src/assets/sfx/`
(V1, 9/9 SHA-256 match against the A1 exports)
Artifact SHA-256 hashes: `src/audio/audio.ts` `df74620f8ae96cc63b6fd4690b4afd9406c49a67af0d865c5d7666c4baa9b0c2`;
`tests/audio.test.ts` `07441ed74f0641f96954dedb2922fe36eeaa12e83cf04096faf37f1e074efb11`;
`data/sound-map.json` `fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09` (unchanged
frozen interface, equals the A2-recorded value); per-sound hashes in §2
Result: PASS

---

## 1. Scope

Implemented `src/audio/audio.ts` (task steps 1–2), bootstrapped `src/assets/sfx/**` from the A1
exports (step 3) and added `tests/audio.test.ts` (step 4). `data/sound-map.json` was read only;
`src/main.ts` (C2-owned), `package.json`, `tsconfig.json` and `playwright.config.ts` were not
touched. No git commands were run. No sound was emitted or played at any point — all tests and
build checks used injected fake elements (§7, EXECUTION.md §8 "Silent witness runs").

## 2. Assets — id → runtime file → bytes → SHA-256 (V1)

Sources are the A1 FFDec exports; destinations are the bootstrapped copies for E1. Copy command
log: `evidence/logs/D4-copy-sfx.log`; hash proof: `evidence/logs/D4-v1-hashes.log`.
SHA-256(source) = SHA-256(destination) for all 9 (V1 PASS).

| Sound id | `data/sound-map.json` file | Bytes | SHA-256 (source = destination) |
|---|---|---|---|
| 22 | `sfx_22_enter.mp3` | 1950 | `1c3cd10320a9266fe1431d9aa46e8c6ec9d31add35313241d66f216ef0387fb2` |
| 24 | `sfx_24_shuffle.mp3` | 4030 | `370bbc2eadd4a88aaa473dfaa59f5da0fd37b175b1f726edd245356bfa28cc3d` |
| 26 | `sfx_26_countdown.mp3` | 910 | `0f878a5566c5931539b0ec8e0af9661a3447467235dc1443787f3f6e3ab350db` |
| 30 | `sfx_30_boing.mp3` | 1560 | `da643f2b8afbbfb8fac1baf9e310fdec7f453514706ac4d2a8304467150ead37` |
| 32 | `sfx_32_fanfare.mp3` | 21840 | `3ddbd6215e6259957ff1c7d7df24d26119ad98c522e19a91c0bd0c255e966d68` |
| 34 | `sfx_34_finishsound.mp3` | 2730 | `5db9654e0feb324a975822726dc41507dc2f8f30ab9154d3b329fcf9764c4ba1` |
| 36 | `sfx_36_typer.mp3` | 1430 | `3f34ed813e98e8ac6df1d0f97540d4cd2e44242c8a28cda0ef345bacf7e242bf` |
| 38 | `sfx_38_backspace.mp3` | 1690 | `0ed0e6eac39dac1391f26266c31604d54ba3dcfc1829826911cdb24e793f752f` |
| 40 | `sfx_40_buzz.mp3` | 2730 | `832f7980db3c1d1b8b12ff89c933d9d4e9281d60d3ba6b656ccd6760dcb39395` |

Sources: `artifacts/decompiled/sounds/<id>.mp3` (A1 manifest §6; sizes match exactly). The
source hashes also equal the A1 `artifacts/decompiled/SHA256SUMS.txt` rows for these exports.
Destinations `src/assets/sfx/` are bootstrap copies for E1's later finalization:
**hand-off — E1 owns `src/assets/sfx/**`** (its task step 1: "Sounds: verify each file matches A1
hashes; copy to `src/assets/sfx/`"). The copies here are byte-identical, so E1's hash check
should pass without re-copying; E1 may replace the tree if its own procedure records so.

## 3. Map coverage — 10 events → 9 sounds (V7)

`src/audio/audio.ts` imports `data/sound-map.json` (`resolveJsonModule`) and derives its event
union and `AUDIO_EVENT_NAMES` **from the map keys**; no event name is invented in code
(docs/03 §5). `tests/audio.test.ts` asserts three ways (all pass):

1. the 10 map keys equal the 10 call-site names tabulated in `evidence/A2-sounds.md` §2
   (`roundStart, scramble, delete, submitValid, submitAlreadyFound, submitInvalid, letterKey,
   tileClick, countdown, timeout`);
2. `AUDIO_EVENT_NAMES` equals the same 10 names;
3. the 9 `sounds` keys equal the A1 `DefineSound` ids `22 24 26 30 32 34 36 38 40`, every
   referenced id exists, every `file` matches docs/03 §1 `^sfx_\d+_[a-z]+\.mp3$` and every
   event carries non-empty call-site evidence (docs/07 T05 "map entries have evidence").

Event → file routing is tested per event (`play(event)` sets the mapped file's URL on a pooled
fake element) and reproduced in a production Vite build (§6.6).

| Event | Sound id | File |
|---|---|---|
| `roundStart` | 32 | `sfx_32_fanfare.mp3` |
| `scramble` | 24 | `sfx_24_shuffle.mp3` |
| `delete` | 38 | `sfx_38_backspace.mp3` |
| `submitValid` | 22 | `sfx_22_enter.mp3` |
| `submitAlreadyFound` | 30 | `sfx_30_boing.mp3` |
| `submitInvalid` | 40 | `sfx_40_buzz.mp3` |
| `letterKey` | 36 | `sfx_36_typer.mp3` |
| `tileClick` | 36 | `sfx_36_typer.mp3` |
| `countdown` | 26 | `sfx_26_countdown.mp3` |
| `timeout` | 34 | `sfx_34_finishsound.mp3` |

Playback behavior mirrors the evidenced reference calls (no guessing):
- `stopAllSounds()` before each sound — `ses_cikart` order (`frame_131/DoAction.as` L130-L140;
  tile click `DefineButton2_57/BUTTONCONDACTION on(release).as` L14-L20); the manager pauses the
  pool before each play.
- Pooled elements, no seeking and no resampling: `AudioElementLike` exposes no `currentTime` and
  no `playbackRate`; a re-trigger takes the next idle pooled element; payloads are the original
  MP3 bytes.
- `lastAudioEvent` is a state hook: it records the last requested event even while muted
  (E2E asserts the mapping, never audibility — EXECUTION.md §8).

## 4. Volume persistence — decision record

- Key: `kelimator.volume` (docs/04-architecture.md §3; mirrors the reference's `remembervol`
  shared object). Value: integer **0–100**.
- **Default = 100, taken from the reference (not a fallback).**
  `artifacts/decompiled/scripts/frame_2/DoAction.as` L1-L9: on boot the SWF reads
  `remembervol = SharedObject.getLocal("data")`, restores `_root.vol` when
  `remembervol.data.vol != undefined`, else sets `vol = 1` (full volume). Full volume
  (`vol = 1`) maps to 100 on the fixed 0–100 scale. The reference stores a boolean 0/1 and gates
  every sound on the truthy `vol` (`frame_131/DoAction.as` L133 `if(vol)`; timer gate
  `DefineSprite_21/frame_3/DoAction.as` L4); the 0–100 scale itself is the interface fixed by
  docs/04 §3 / the D4 task, so the mapping is 0 → muted, 100 → `vol = 1`.
- Boot: the manager constructor performs the storage read (bootstrap load); reads never write
  back (the reference persists only on toggle, `DefineButton2_90/BUTTONCONDACTION on(release).as`
  L11-L12).
- Clamping: `setVolume` and stored-value loads clamp/round to 0–100; blank, non-numeric or
  non-finite stored values fall back to the default; a throwing `localStorage` degrades to
  in-memory without breaking gameplay.
- Muting (`setVolume(0)`) stops current playback, mirroring the mute branch of the sound button
  (`DefineButton2_90...` L2-L6 `stopAllSounds()`).
- Tests: default, persistence round-trip, set/load clamping (`150→100`, `-20→0`, `999→100`,
  `-3→0`, `42.4→42`, `''`/`'abc'`→100), element volume application, throwing storage.

## 5. O11 disposition — EXCLUDED

Per the orchestrator's D4 dispatch (and the task's Unknowns text), O11 is treated as **EXCLUDED**
from D4: A1 evidence (`evidence/A1-stream.md` §§1–3) shows all 38 `SoundStreamHead2` tags are
byte-identical empty declarations (`streamSoundSampleCount=0`) with zero `SoundStreamBlock` tags,
and A2 confirms "No streaming sound is involved" (`evidence/A2-sounds.md` §3). No streaming/music
element is integrated; the 9 `DefineSound` MP3s are the complete audio surface.
Note: `docs/08-open-items.md` still lists O11 as OPEN (A1 partial wording); the orchestrator
applies the EXCLUDED decision there (workers do not edit `docs/08`).

## 6. Verification (exact commands, exit codes, logs)

1. **Step 3 copy** — `mkdir -p src/assets/sfx` + 9 `cp artifacts/decompiled/sounds/<id>.mp3
   src/assets/sfx/<file>` (exact commands in the log); exit 0; sizes match A1 §6.
   Log: `evidence/logs/D4-copy-sfx.log`.
2. **V1** — `node --input-type=module -e '<script: for each sounds[] entry, sha256(source export)
   vs sha256(dst copy)>'` → `RESULT: PASS (9/9 byte-identical)`, exit 0; plus
   `shasum -a 256 src/assets/sfx/*.mp3 artifacts/decompiled/sounds/{22,24,26,30,32,34,36,38,40}.mp3`,
   exit 0. Log: `evidence/logs/D4-v1-hashes.log` (hashes in §2).
3. **V4/V7** — `npm test -- audio` → 1 file, **17 tests passed**, exit 0.
   Log: `evidence/logs/D4-test-audio.log`.
4. **V4 full suite** — `npm test` → 4 files, **47 tests passed** (audio 17, constants 3, stage 11,
   diff 16), exit 0. Log: `evidence/logs/D4-test-full.log`.
5. **Supplementary** — `npx tsc --noEmit` exit 0; `npx eslint src/audio/audio.ts
   tests/audio.test.ts` exit 0. Log: `evidence/logs/D4-typecheck-lint.log`.
6. **Supplementary build check (asset bundling)** — a temporary Vite production build outside the
   repo (`$TMPDIR/d4-vite-asset-check`, cleaned up afterwards) with a virtual entry that drives
   `createAudioManager` for all 10 events and hashes each resolved `src` against the source
   payloads: **10/10 events, 9/9 payloads byte-identical** (8 assets < 4 KB are inlined by Vite as
   `data:audio/mpeg;base64,...`, the 21,840 B fanfare is emitted as a file), exit 0.
   Logs: `evidence/logs/D4-vite-asset-check-corrected.log`.
   *First attempt (recorded, not hidden):* `D4-vite-asset-check.log` reported `RESULT: FAIL`
   because its criterion counted emitted `.mp3` files only (1) and ignored inlined data URIs;
   `D4-vite-inspect.log` / `D4-vite-inspect2.log` found all 9 payloads present in the bundle.
   `src/audio/audio.ts` was **not modified** between the two runs — the root cause was the check,
   not the implementation; the corrected check re-verifies by payload hash.

## 7. Silent witness compliance (EXECUTION.md §8 amendment)

- No test constructs a real `HTMLAudioElement`: every manager under test receives an injected
  fake element factory; the module-level test stubs the `Audio` global with a fake class and
  `localStorage` with an in-memory object.
- The supplementary build check also injects fake elements; nothing calls `play()` on a real
  element, no Ruffle and no system media player were used, and no command emitted sound.
- `AudioElementLike` deliberately omits `currentTime`/`playbackRate` so seeking/resampling cannot
  be introduced through this interface.

## 8. Hand-offs

- **D5**: wire the test hook into `window.__game`: `getLastAudioEvent()` from `src/audio/audio.ts`
  is the `lastAudioEvent` source (docs/04 §6, docs/05 §8); the C2-owned `src/main.ts` currently
  returns `null` and D4 was not allowed to edit it. Gameplay calls `playAudioEvent(eventName)`
  (`AudioEventName` union derived from the map). The volume toggle (reference `DefineButton2_90`)
  maps to `getVolume()` / `setVolume(v)`.
- **E1**: `src/assets/sfx/**` bootstrapped here (9 byte-identical files, §2); E1 finalizes/owns
  that tree.
- **Orchestrator / docs**: `docs/07-verification.md` T05 names `npm test -- soundmap`, while the
  D4 task owns `tests/audio.test.ts` and Verify says `npm test -- audio`. D4 cannot create
  `tests/soundmap.test.ts` or edit `docs/07`; reconcile via amendment or a later task.
- **Bundle note for E1/E2/F2**: Vite bundles the sfx map correctly; assets under the 4 KB
  `assetsInlineLimit` arrive as data URIs, which is expected and verified byte-identical (§6.6).

## 9. Result

**PASS** — V4 (`npm test -- audio`, 17/17; full `npm test`, 47/47), V7 (event names equal the
`data/sound-map.json` keys and the A2 call-site table), V1 (9/9 copies byte-identical to the A1
exports) all pass; volume default 100 is evidence-backed; O11 recorded as EXCLUDED; hand-offs
documented above.
