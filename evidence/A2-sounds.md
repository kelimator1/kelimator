# A2 — Sound events (O06)

Task: A2 — Mechanics Extraction (Events) + Constants
Started/Ended: 2026-09-28T12:55:00Z / 2026-09-28T13:30:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `grep -rn "ses_cikart\|stopAllSounds\|\.play()\|gotoAndPlay(2)" artifacts/decompiled/scripts/`
- `python3 "$TMPDIR"/swf-parse.py` (StartSound tags inside each DefineSprite; full dump `evidence/logs/A2-sounds-sprites.log`)
- `grep -o 'PlaceObject2 (chid: [0-9]*, dpt: [0-9]*, nm: "[^"]*")' artifacts/decompiled/tags.txt | sort -u` (same log)
- `for id in 22 24 26 30 32 34 36 38 40; do stat -f %z artifacts/decompiled/sounds/$id.mp3; afinfo artifacts/decompiled/sounds/$id.mp3; done`
- reads of `frame_131/DoAction.as`, `DefineSprite_21/frame_3/DoAction.as`, `DefineButton2_57`, `DefineSprite_27/frame_4`
- follow-up (amendment 2026-09-28b): `npx ajv-cli validate -s data/sound-map.schema.json -d data/sound-map.json`, V2 per-id cross-check script and `npm test` → `evidence/logs/A2-verify.log`; `shasum -a 256 data/sound-map.json`
Exit codes: 0 (all; `afinfo` 0 for every file; ajv-cli 0; `npm test` 0)
Output summary: 10 call sites mapped to the 9 sound ids; `data/sound-map.json` written with `docs/03` §1 runtime names (`sfx_<id>_<slug>.mp3`) and byte sizes + durations recorded
Artifact SHA-256 hashes: `data/sound-map.json` `fb31fbca633c70682dce34d6c6f27388391da9ad44510ef4486f4a1198297b09` (post-rename; pre-rename value `4ce1b112…` superseded)
Result: PASS

---

## 1. Procedure

1. Grepped every sound trigger (`ses_cikart`, `.play()`, `stopAllSounds`,
   direct `tellTarget`) across all 60 scripts.
2. For each trigger, resolved the named clip on the stage via `tags.txt`
   instance names (`nm:`), then read the matching `DefineSprite`'s `StartSound`
   tag from the raw SWF to obtain the DefineSound id.
3. Verified each exported MP3 exists with its byte size and decoded duration
   (`stat`, `afinfo`; full log `evidence/logs/A2-sounds-afinfo.log`).
4. Wrote `data/sound-map.json` (`sounds` keyed by sound id with the `docs/03`
   §1 runtime file name, `events` keyed by event name with call-site evidence);
   the per-sound mapping to the A1 export is in §3.

## 2. Clip → sprite → sound id (evidence chain)

`ses_cikart(obj)` (`frame_131/DoAction.as` L130-L140): `stopAllSounds();` then
`if(vol) { tellTarget(obj) { gotoAndPlay(2); } }` — each named clip plays its
`StartSound` when its frame 2 starts.

| Event (call site) | Call site (verbatim) | Stage instance | Sprite chid | StartSound id |
|---|---|---|---|---|
| round start | `ses_cikart("fanfare");` (`frame_131/DoAction.as` L3, in `init()`) | `fanfare` | 33 | **32** |
| scramble | `ses_cikart("shuffle");` (`frame_131/DoAction.as` L310 in `karistir()`) | `shuffle` | 25 | **24** |
| delete | `ses_cikart("backspace");` (`frame_131/DoAction.as` L323 in `sil()`) | `backspace` | 39 | **38** |
| valid submit | `ses_cikart("enter");` (`frame_131/DoAction.as` L644 in `ekle()`) | `enter` | 23 | **22** |
| already-found submit | `ses_cikart("boing");` (`frame_131/DoAction.as` L658 in `ekle()`) | `boing` | 31 | **30** |
| invalid submit | `ses_cikart("buzz");` (`frame_131/DoAction.as` L667 in `ekle()`) | `buzz` | 41 | **40** |
| letter typed | `ses_cikart("typer");` (`frame_131/DoAction.as` L702 in `onKeyDown`) | `typer` | 37 | **36** |
| tile clicked | `stopAllSounds();` + `tellTarget("_root.typer") { gotoAndPlay(2); }` (`DefineButton2_57/…on(release).as` L14-L20) | `typer` | 37 | **36** |
| countdown (<10 s) | `_root.countdown.play();` (`DefineSprite_21/frame_3/DoAction.as` L4-L7) | `countdown` | 27 | **26** |
| timeout | `_root.finishsound.play();` (`DefineSprite_21/frame_3/DoAction.as` L14-L18) | `finishsound` | 35 | **34** |

Instance names from `tags.txt` (verbatim, sorted output includes):
`PlaceObject2 (chid: 23, dpt: 82, nm: "enter")`,
`PlaceObject2 (chid: 25, dpt: 84, nm: "shuffle")`,
`PlaceObject2 (chid: 27, dpt: 86, nm: "countdown")`,
`PlaceObject2 (chid: 31, dpt: 88, nm: "boing")`,
`PlaceObject2 (chid: 33, dpt: 90, nm: "fanfare")`,
`PlaceObject2 (chid: 35, dpt: 92, nm: "finishsound")`,
`PlaceObject2 (chid: 37, dpt: 94, nm: "typer")`,
`PlaceObject2 (chid: 39, dpt: 96, nm: "backspace")`,
`PlaceObject2 (chid: 41, dpt: 98, nm: "buzz")`.
Raw SWF parse (StartSound inside the sprite, frame 2 of each): 23→22, 25→24,
27→26, 31→30, 33→32, 35→34, 37→36, 39→38, 41→40.

Countdown repetition — `DefineSprite_27/frame_4/DoAction.as` L1-L7:

```
if(getTimer() - t < 1000)
{
   gotoAndPlay(3);
}
else
{
   gotoAndPlay(2);
}
```

so while `timer < 10` the countdown sound restarts every 1000 ms.

Volume gate — `frame_131/DoAction.as` L130-L140 (`if(vol)`), the sound button
`DefineButton2_90` toggles `_root.vol` (and persists it in the `data` shared
object); `frame_2/DoAction.as` restores it on boot.

## 3. Naming and files (V2 table)

**Naming decision (amendment 2026-09-28b):** `docs/03` §1 fixes the runtime sound
name as `sfx_<soundId>_<slug>.mp3`; a slug is the SWF's evidenced clip
identifier from §2 (stage instance name via `tags.txt`/FLA — `enter`, `shuffle`,
`countdown`, `boing`, `fanfare`, `finishsound`, `typer`, `backspace`, `buzz`),
not an invented name. `sounds[].file` in `data/sound-map.json` therefore holds
the runtime file name; the A1 export path below is the byte source and is
recorded in evidence only.

| Sound id | slug (clip identifier) | `sounds[id].file` (runtime, `docs/03` §1) | A1 export path | A1 bytes | `afinfo` duration |
|---|---|---|---|---|---|
| 22 | `enter` | `sfx_22_enter.mp3` | `artifacts/decompiled/sounds/22.mp3` | 1950 | 0.390000 sec |
| 24 | `shuffle` | `sfx_24_shuffle.mp3` | `artifacts/decompiled/sounds/24.mp3` | 4030 | 0.806000 sec |
| 26 | `countdown` | `sfx_26_countdown.mp3` | `artifacts/decompiled/sounds/26.mp3` | 910 | 0.182000 sec |
| 30 | `boing` | `sfx_30_boing.mp3` | `artifacts/decompiled/sounds/30.mp3` | 1560 | 0.624000 sec |
| 32 | `fanfare` | `sfx_32_fanfare.mp3` | `artifacts/decompiled/sounds/32.mp3` | 21840 | 4.368000 sec |
| 34 | `finishsound` | `sfx_34_finishsound.mp3` | `artifacts/decompiled/sounds/34.mp3` | 2730 | 0.546000 sec |
| 36 | `typer` | `sfx_36_typer.mp3` | `artifacts/decompiled/sounds/36.mp3` | 1430 | 0.286000 sec |
| 38 | `backspace` | `sfx_38_backspace.mp3` | `artifacts/decompiled/sounds/38.mp3` | 1690 | 0.338000 sec |
| 40 | `buzz` | `sfx_40_buzz.mp3` | `artifacts/decompiled/sounds/40.mp3` | 2730 | 0.546000 sec |

V2 follow-up cross-check (`evidence/logs/A2-verify.log`, run after the rename):
a script re-derived each id→slug pair from the SWF evidence alone
(`tags.txt` `nm:` instance name of the sprite whose frame 2 `StartSound`s that
id) and compared it with `sounds[id].file` — all nine match
(`22→enter, 24→shuffle, 26→countdown, 30→boing, 32→fanfare, 34→finishsound,
36→typer, 38→backspace, 40→buzz`); for each `soundId` the A1 export
`artifacts/decompiled/sounds/<id>.mp3` exists and its byte size equals A1
manifest §6 (1950/4030/910/1560/21840/2730/1430/1690/2730) — **PASS, 9/9**
(plus `npx ajv-cli validate -s data/sound-map.schema.json -d data/sound-map.json`
→ `data/sound-map.json valid`, exit 0; `npm test` exit 0).

Raw tag payloads (A1 §6) live at `artifacts/decompiled/sfx-raw/<id>.mp3.rawdata`
(2 bytes larger each; the exported MP3 is byte-identical to `SoundData[2:]`).
No streaming sound is involved (`evidence/A1-stream.md`).

## 4. Conclusion

Ten call sites map onto the nine DefineSound ids; `data/sound-map.json` lists
all nine sounds with their `docs/03` §1 runtime names and durations (A1 export
source and sizes in §3), and all ten events with exact call-site evidence. No
event name was invented that does not correspond to a call site, and no slug was
invented — every slug is an evidenced SWF clip identifier. Notable quirks:
`ses_cikart` stops all sounds before playing a new one, the countdown sound
repeats once per second, and the "buzz" (invalid) sound is skipped in the rare
case where the global `k` still holds a falsy value from the CTRL path
(L730-L737) — see `evidence/A2-edges.md` §3.

## 5. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
