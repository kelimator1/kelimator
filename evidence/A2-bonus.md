# A2 — Bonus letter (O02)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:50:00Z / 2026-09-28T13:25:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `grep -rn "bonus" artifacts/decompiled/scripts/`
- `cat "artifacts/decompiled/scripts/DefineButton2_57/BUTTONCONDACTION on(release).as"`
- `cat "artifacts/decompiled/scripts/DefineSprite_111/frame_7/DoAction.as"`
- reads of `frame_131/DoAction.as` (init, duzenle, ekle, onKeyDown)
Exit codes: 0 (all)
Output summary: bonus selection rule traced through all code paths; `constants.bonusLetter.selectionRule` written
Artifact SHA-256 hashes: `data/constants.json` `569cdda52c22a540d2b0b9f198db975e8f5d64fba39a57156c51e87ef302c8a1`
Result: PASS

---

## 1. Procedure

1. `grep -rn "bonus"` found every occurrence: `frame_131/DoAction.as`,
   `DefineButton2_57` (tile click) and `DefineSprite_111/frame_7` (score popup).
2. Read all four code paths that read or write `bonusball`/`bonusrnd`:
   (a) keyboard letter add, (b) tile click letter add, (c) `duzenle()` (entry
   add/delete/clear animations), (d) `ekle()` (submit scoring).
3. Derived the observable rule and the reset conditions.

## 2. Excerpts (verbatim)

Initialisation — `artifacts/decompiled/scripts/frame_131/DoAction.as` `function init()` L28-L30:

```
bonusball = -1;
bonusrange = 1000;
bonusmin = 50;
```

Selection, keyboard path — `frame_131/DoAction.as` `myListener.onKeyDown` L690-L704
(`h` is the letter matching the pressed key code):

```
if(t.word == h && t._visible)
{
   kelime += h;
   if(bonusball == -1)
   {
      bonusrnd = random(bonusrange);
      if(bonusrnd < bonusmin)
      {
         bonusball = kelime.length;
      }
   }
   ...
   duzenle("ekle");
```

Selection, mouse path — `artifacts/decompiled/scripts/DefineButton2_57/BUTTONCONDACTION on(release).as` L1-L9:

```
on(release){
   _root.kelime += word;
   if(_root.bonusball == -1)
   {
      bonusrnd = random(_root.bonusrange);
      if(bonusrnd < _root.bonusmin)
      {
         _root.bonusball = _root.kelime.length;
      }
   }
   _root.duzenle("ekle");
```

Bright-ball animation uses the 0-based ball index — `frame_131/DoAction.as`
`function duzenle(act)` L381-L396:

```
if(act == "ekle")
{
   r = eval("wordball" + (kelime.length - 1));
   tellTarget(r)
   {
      if(_root.bonusball == _root.kelime.length - 1)
      {
         gotoAndStop("getir1");
         play();
      }
      else
      {
         gotoAndStop("getir");
         play();
      }
   }
```

Removal of the bonus ball clears it — `frame_131/DoAction.as` `duzenle()` L426-L440
(`duzenle("sil")` is called by `sil()` *before* the last letter is removed, so
`kelime.length - 1` is the ball being removed):

```
r = eval("wordball" + (kelime.length - 1));
tellTarget(r)
{
   if(_root.bonusball == _root.kelime.length - 1)
   {
      gotoAndStop("gotur1");
      play();
      _root.bonusball = -1;
   }
```

Clear resets it (only for a non-empty entry) — `duzenle()` L357 + L379-L380:

```
if(act == "temizle" && kelime.length > 0)
{
   ...
   bonusball = -1;
}
```

Scoring — `frame_131/DoAction.as` `function ekle()` L631-L640 (inside the
valid-new-word branch; `puankatsayi = 50`, L26):

```
if(bonusball > -1)
{
   _root.bonus = kelime.length * kelime.length * puankatsayi + 5000;
   puan += kelime.length * kelime.length * puankatsayi + 5000;
}
else
{
   _root.bonus = kelime.length * kelime.length * puankatsayi;
   puan += kelime.length * kelime.length * puankatsayi;
}
```

Score popup reads `_root.bonus` — `DefineSprite_111/frame_7/DoAction.as` L1:
`bonuss = _root.bonus;` (text field `bonuss`, DefineEditText chid 109).

## 3. Conclusion

- **Selection:** on *every* letter added (typed or clicked) while `bonusball == -1`,
  `bonusrnd = random(1000)`; if `bonusrnd < 50` (5%) then `bonusball = kelime.length`
  — the 0-based index of the *next* ball to be added. Because `duzenle("ekle")`
  compares against `kelime.length - 1`, the bright ("getir1"/"gotur1") animation
  lands on the ball added *after* the lucky roll; the ball that triggered the roll
  itself never shows the bright animation.
- **Scoring:** the next valid submitted word scores `n² × 50 + 5000` while
  `bonusball > -1`; if the bonus ball is deleted (`duzenle("sil")` index match) or
  the entry is cleared after a submit/scramble with a non-empty entry
  (`duzenle("temizle")`), `bonusball` returns to -1 and no bonus is paid.
- **Quirks (recorded for D5/E3):** (a) if the player submits immediately after the
  lucky roll (no further letter), +5000 is paid although no bright ball was ever
  shown; (b) `duzenle("temizle")` on an *empty* entry (e.g. scramble with nothing
  typed) does **not** reset `bonusball`, so a pending bonus survives that scramble;
  (c) the roll is per added letter, so an n-letter entry has a `1 - 0.95ⁿ` chance
  that a bonus was selected at some point (8 letters ≈ 33.7%).
- `constants.bonusLetter.selectionRule` records the rule; the official page's
  "contains the bright letter" description matches the effective behavior because
  the bright ball is inside the submitted entry exactly while `bonusball > -1`.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
