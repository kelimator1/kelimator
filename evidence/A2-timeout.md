# A2 — Timeout semantics (O14)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:55:00Z / 2026-09-28T13:30:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- reads of `DefineSprite_21/frame_3/DoAction.as` (timeout block), `frame_131/DoAction.as` (`tamamla`, `bittimi`, `sil`, `duzenle`), `DefineSprite_76/frame_1/DoAction.as` (timer bar)
- `grep -rn "ses_cikart\|stopAllSounds\|\.play()\|gotoAndPlay(2)" artifacts/decompiled/scripts/`
Exit codes: 0 (all)
Output summary: timeout sequence extracted (mid-entry, stop-on-completion, bonus timing)
Artifact SHA-256 hashes: `data/constants.json` `569cdda52c22a540d2b0b9f198db975e8f5d64fba39a57156c51e87ef302c8a1`
Result: PASS

---

## 1. Procedure

Read the timer sprite's terminal branch and the functions it calls, then traced
what happens to an in-progress entry, the board, the buttons, the timer and the
time bonus.

## 2. Excerpts (verbatim)

Timeout branch — `artifacts/decompiled/scripts/DefineSprite_21/frame_3/DoAction.as` L4-L19:

```
if(_root.timer < 10 && _root.timer > 0 && _root.vol)
{
   _root.countdown.play();
}
if(_root.timer == 0)
{
   _root.bitti = 1;
   tellTarget("_root.countdown")
   {
      gotoAndStop(1);
   }
   if(_root.vol)
   {
      _root.finishsound.play();
   }
   _root.tamamla();
   gotoAndStop(1);
}
```

Reveal + button — `frame_131/DoAction.as` `function tamamla()` L515-L579 (head and tail):

```
function tamamla()
{
   status.gotoAndStop(1);
   duzenle("temizle");
   kelime = "";
   j = 0;
   while(j < harfsayisi)
   {
      t = eval("button" + j);
      t._visible = false;
      j++;
   }
   sbuton._visible = false;
   ebuton._visible = false;
   kbuton._visible = false;
   e = 3;
   while(e <= harfsayisi)
   {
      ... // fills every empty "sonuclarN_r" slot from dizi
   }
   ybuton._visible = true;
}
```

Key actions blocked after timeout — `frame_131/DoAction.as` L709-L729
(`if(Key.isDown(32)) { if(!bitti) { karistir(); } }` etc.); `bitti` is set to 0
only by `baslat()` (round start) and to 1 only by the timer branch above.

Timer stop on completion — `frame_131/DoAction.as` `bittimi()` L490-L496 (time
bonus is applied *before* the timer clip is stopped), and the same function
calls `gotoAndStop("bravo"); play();` (L511-L512).

Timer bar — `DefineSprite_76/frame_1/DoAction.as` L1-L6: bar scaled by
`_root.timex / _root.sure`; `if(xx <= 10) bar.play()` (animation in the last
10 seconds).

## 3. Conclusion

- **Mid-entry at timeout:** the entry (`kelime`) and its wordballs are cleared
  by `duzenle("temizle")`; no word is scored, no penalty applies; the deck tiles
  are hidden; every listed-but-unfound word is written into the board slots
  (`tamamla()`); the status indicator is reset; only the "Yeni Oyun" button
  stays visible.
- **Stop on completion:** when the last word is found, `bittimi()` adds
  `remaining integer seconds × 100` **once** to the score, shows the score popup
  (`puanmovie`, `_root.bonus = timer * timebonus`), stops the timer clip
  (`gotoAndStop(1)`), hides the deck, sets `tamamladi = 1` and jumps to
  `bravo`. No time bonus is applied on the timeout path.
- **Input after timeout:** `bitti = 1` disables SPACE/ENTER/BACKSPACE/CTRL;
  the "countdown" ticking sound is stopped; "finishsound" (sound id 34) plays
  once (gated by `_root.vol`).
- **Time-bonus timing:** the bonus uses the last integer `timer` value (the
  displayed seconds), so a fraction of a second is always lost; there is no
  grace period and no timeout-penalty mechanic.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
