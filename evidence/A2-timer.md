# A2 — Timer (O01)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:50:00Z / 2026-09-28T13:25:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `grep -rn "timer\|sure" artifacts/decompiled/scripts --include='*.as'`
- `python3 "$TMPDIR"/swf-frames.py` (top-level SWF tag walk: `fps=36 frameCount=241`; frame labels + DoAction frame numbers)
- `python3 "$TMPDIR"/swf-parse.py` (DefineSprite 21 frame/script inventory)
- `cat -n artifacts/decompiled/header.txt`
- `afinfo artifacts/decompiled/sounds/*.mp3` (timer-related sounds only, see A2-sounds.md)
- Ruffle run: `./Ruffle.app/Contents/MacOS/ruffle --volume 0 http://127.0.0.1:8791/kelimator_tr_2012_mochiads.swf` (see A2-kelimatorid.md; server log line `GET /xml64.php?408468 → 200`)
Exit codes: 0 (all)
Output summary: timer constants, tick semantics and pause/resume points extracted; `data/constants.json` timer block written
Artifact SHA-256 hashes: `data/constants.json` `569cdda52c22a540d2b0b9f198db975e8f5d64fba39a57156c51e87ef302c8a1`; `artifacts/decompiled/header.txt` `23d6a2afca68b837a353c412857cc57ac56a32aaf41285b1b174e5b072aae521`
Result: PASS

---

## 1. Procedure

1. Located the countdown state in the decompiled scripts (`grep` above; besides the
   controller `frame_131/DoAction.as` and the timer sprite `DefineSprite_21`, the
   only other hits are `DefineSprite_76/frame_1/DoAction.as` reading
   `_root.timex` for the timer bar and `DefineButton2_153` reading `toplamsure`
   for the excluded score form).
2. Read the timer sprite (SWF chid 21, stage instance `timerr`, `tags.txt` line
   `PlaceObject2 (chid: 21, dpt: 80, nm: "timerr")`) and its frame scripts.
3. Read the main timeline controller script that starts/stops the timer.
4. Derived the tick period from the SWF frame rate (`header.txt`) and the timer
   sprite's frame loop.
5. Cross-checked the round start path with the reference run: the SWF fetches
   `xml64.php` and the timer only starts after that load (`baslat()` from
   `tablociz()` from `myOnLoad`). Ruffle log: `Loaded SWF version 6, resolution
   550x400 @ 36 FPS`; server log `GET /xml64.php?408468 HTTP/1.1 200`.

## 2. Excerpts (verbatim)

| Field | Source (file + symbol + line) | Verbatim |
|---|---|---|
| initial value | `artifacts/decompiled/scripts/frame_131/DoAction.as` `function init()` L31-L33 | `sure = 200;` / `timex = sure;` / `timer = sure;` |
| stage FPS | `artifacts/decompiled/header.txt` L13 (A1 §5; sha256 above) | `frameRate=36` |
| frame count | `artifacts/decompiled/header.txt` L12 | `frameCount=241` |
| countdown formula | `artifacts/decompiled/scripts/DefineSprite_21/frame_3/DoAction.as` L1-L3 | `set("_root.timerr",int(_root.sure - (getTimer() - t) / 1000));` / `set("_root.timer",int(_root.timerr));` / `set("_root.timex",_root.timer);` |
| tick origin | `DefineSprite_21/frame_2/DoAction.as` L1 | `t = getTimer();` |
| sprite loop | `DefineSprite_21/frame_4/DoAction.as` L1 | `gotoAndPlay(3);` |
| pause (round start) | `frame_131/DoAction.as` `function init()` L39-L42 | `tellTarget("timerr") { gotoAndStop(1); }` |
| start/resume | `frame_131/DoAction.as` `function baslat()` L210-L213 | `tellTarget("timerr") { gotoAndPlay(2); }` |
| pause (all found) | `frame_131/DoAction.as` `function bittimi()` L493-L496 | `tellTarget("timerr") { gotoAndStop(1); }` (after `puan += timer * timebonus;`) |
| pause (timeout) | `DefineSprite_21/frame_3/DoAction.as` L8-L19 | `if(_root.timer == 0) { _root.bitti = 1; ... _root.tamamla(); gotoAndStop(1); }` |
| time bonus | `frame_131/DoAction.as` `function bittimi()` L490-L491 | `puan += timer * timebonus;` / `_root.bonus = timer * timebonus;` (with `timebonus = 100;`, L27) |

Frame timing of the timer sprite: frames 2 (capture `t`), 3 (compute), 4
(`gotoAndPlay(3)`) — the redraw cycle is 2 frames. At 36 fps that is
`2000/36 = 55.56 ms`; the *displayed/decremented* value only changes when the
integer part crosses, i.e. once per 1000 ms of wall clock (`/1000` above).

## 3. Conclusion

- `timer.initialSeconds = 200` (fresh countdown each round; `sure` is never modified elsewhere — `grep` shows only L31-L33).
- `timer.tickMs = 1000`: the countdown unit is 1000 ms of wall-clock time
  (`int(sure - (getTimer() - t)/1000)`); the timer sprite redraws every 2 frames
  (55.56 ms at 36 fps) but the value changes once per second.
- Pause semantics: the timer clip is stopped (`gotoAndStop(1)`) by `init()`
  before the round, by `bittimi()` when all words are found, and by itself at
  `timer == 0`; it is started only by `baslat()`, which runs when the word list
  has loaded (`myOnLoad` → `yerlestir` → `tablociz` → `baslat`). Because frame 2
  re-captures `t` on every start, a (hypothetical) resume restarts from 200 s —
  in the original flow the timer is started exactly once per round.
- The end-of-round time bonus is `remaining seconds × 100` using the last
  displayed integer `timer` value (integer truncation, i.e. the player loses the
  fractional second), added once when the last word is found.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal" (single consolidated block).
