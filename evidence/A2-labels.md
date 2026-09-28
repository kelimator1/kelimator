# A2 — Labels and frame flow (O13)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:55:00Z / 2026-09-28T13:30:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `python3 "$TMPDIR"/swf-frames.py | tee "$TMPDIR"/frames.log` (raw top-level SWF walk:
  fps/frameCount + DoAction/FrameLabel frame numbers; log `evidence/logs/A2-swf-frames.log`)
- `python3` XFL parse of `artifacts/decompiled/fla/…/DOMDocument.xml` (label DOMFrame indexes)
- reads of `frame_131/DoAction.as` (`init`, `bittimi`, `tamamla`) and `frame_132/DoAction.as`
- `grep -o 'PlaceObject2 (chid: [0-9]*, dpt: [0-9]*, nm: "[^"]*")' artifacts/decompiled/tags.txt | sort -u`
Exit codes: 0 (all)
Output summary: authoritative frame→label/script map; transitions recorded; `constants.flows` and `docs/02` §4/§5 updated
Artifact SHA-256 hashes: `data/constants.json` `569cdda52c22a540d2b0b9f198db975e8f5d64fba39a57156c51e87ef302c8a1`; `artifacts/decompiled/header.txt` `23d6a2afca68b837a353c412857cc57ac56a32aaf41285b1b174e5b072aae521`
Result: PASS

---

## 1. Procedure

1. Parsed the uncompressed SWF tag stream directly (no FFDec re-run): split the
   body into top-level tags, count `ShowFrame` (tag 1) to get frame numbers, and
   print every `FrameLabel` (tag 43) and `DoAction` (tag 12) with its frame.
2. Cross-checked the four labels against the FLA `DOMDocument.xml` label layer
   (`<DOMFrame index="…" name="…">`, XFL indexes are 0-based → SWF frame = index+1).
3. Read the scripts on the label frames and every `gotoAndStop`/`gotoAndPlay`
   that targets a label.
4. Recorded the completion ("all words") and timeout paths.

## 2. Excerpts (verbatim)

Authoritative map (`evidence/logs/A2-swf-frames.log`, raw SWF walk):

```
fps=36.0 frameCount=241 frames-after=242
frame 1: DoAction len=10480        (MochiAds; see A2-mochi.md)
frame 2: DoAction len=191          (volume restore)
frame 3: DoAction len=46           (preloader bytes loaded)
frame 4: DoAction len=203          (preloader loop → gotoAndStop("main"))
frame 5: DoAction len=9998         (Base64/calcMD helpers)
frame 5: FrameLabel = 'main'
frame 61: DoAction len=1           (empty)
frame 130: FrameLabel = 'preall'
frame 131: DoAction len=10769      (round controller)
frame 131: FrameLabel = 'hepsiburda'
frame 132: DoAction len=858        (bravo/frame cleanup)
frame 132: FrameLabel = 'bravo'
frame 151: DoAction len=1          (empty)
frame 241: DoAction len=2          (stop())
```

FLA cross-check (`artifacts/decompiled/fla/kelimator_tr_2012_mochiads.fla`,
`DOMDocument.xml`, Labels Layer): `index="4" name="main"`,
`index="129" name="preall"`, `index="130" name="hepsiburda"`,
`index="131" name="bravo"` — identical to the raw walk (index+1).

Round start (all letters on stage, word list requested) —
`frame_131/DoAction.as` `function init()` L1-L5 + L109-L115 + L671 + L758-L759:

```
function init()
{
   ses_cikart("fanfare");
   rooturl = "";
   xmlurl = rooturl + "xml64.php";
   ...
   xml1.load(url);
}
...
init();
...
Key.addListener(myListener);
stop();
```

Completion — `frame_131/DoAction.as` `function bittimi()` L488-L513:

```
   if(t == p && t > 0)
   {
      puan += timer * timebonus;
      _root.bonus = timer * timebonus;
      puanmovie.gotoAndPlay(2);
      tellTarget("timerr")
      {
         gotoAndStop(1);
      }
      duzenle("temizle");
      ...
      tamamladi = 1;
      gotoAndStop("bravo");
      play();
   }
```

Bravo frame cleanup — `frame_132/DoAction.as` L51-L59:

```
ybuton._visible = false;
ebuton._visible = false;
sbuton._visible = false;
kbuton._visible = false;
Key.removeListener(myListener);
if(_root.tamamladi == 0)
{
   gotoAndStop("hepsiburda");
}
```

Timeout — `DefineSprite_21/frame_3/DoAction.as` L8-L19 (see A2-timeout.md).

`grep` for label targets in the scripts: `gotoAndStop("bravo")` (L511),
`gotoAndStop("hepsiburda")` (frame_132 L58), `gotoAndStop("main")`
(frame_4 L10), `_root.gotoAndPlay("main")` (DefineButton2_153 L35, excluded
score form), `gotoAndStop("st")` (DefineSprite_74 L2, timer bar),
`gotoAndStop("on"/"off")` (DefineSprite_88, sound button),
`gotoAndStop("getir"/"getir1"/"gotur"/"gotur1")` (wordball sprite labels).

## 3. Conclusion

| Label | SWF frame | Meaning |
|---|---|---|
| `main` | 5 | end of the preloader; start of the intro animation (timeline plays 5→130) |
| `preall` | 130 | one frame before all deck letters are on stage |
| `hepsiburda` | 131 | "all letters here": the intro's last frame **and** the gameplay/round-controller frame (script runs `init()` and `stop()`s here) |
| `bravo` | 132 | completion celebration; entered only from `bittimi()` with `tamamladi = 1`; plays 132→240 and stops at 241 |

- All words found → `gotoAndStop("bravo"); play();` (the celebration runs; the
  timeline stops at frame 241, where the results/score form lives — the form
  itself is excluded).
- Timeout → the timeline stays at frame 131; `tamamla()` reveals the board and
  shows the "Yeni Oyun" button (`evidence/A2-timeout.md`).
- The `if(tamamladi == 0) gotoAndStop("hepsiburda")` branch in the bravo frame
  is unreachable through the normal flow (only `bittimi()` enters `bravo`, and
  it sets `tamamladi = 1` first); recorded as a defensive/legacy path.
- Listing limit: `tablociz()` clamps each length's slot count to 10
  (`if(k > 10) { k = 10; }`) and creates at most 10 text fields per length;
  `bittimi()` completes when those listed slots are filled, so words beyond the
  first 10 of a length are playable but never listed and the `bN` counter can
  stay > 0 after completion.
- `constants.flows = { allFoundLabel: "hepsiburda", celebrationLabel: "bravo" }`.
- `stage` (header) values used by `constants.stage` come from
  `artifacts/decompiled/header.txt` L9/L11/L12/L13: `widthPx=550`,
  `heightPx=400`, `frameCount=241`, `frameRate=36`.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
