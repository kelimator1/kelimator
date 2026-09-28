# A2 — Edge-case input rules (O15)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:55:00Z / 2026-09-28T13:30:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- reads of `frame_131/DoAction.as` (`onKeyDown`, `ekle`, `sil`, `karistir`, `duzenle`, `bittimi`), `DefineButton2_57/BUTTONCONDACTION on(release).as`, `DefineSprite_84` frames
- `grep -rn "bonus" artifacts/decompiled/scripts/`
- Ruffle cross-check logs `evidence/logs/A2-ruffle-*.log` (tile consumption / loading-state warnings)
Exit codes: 0 (all)
Output summary: rules for duplicates, re-submit, backspace on empty, scramble with entry, keys outside the deck, plus quirks recorded
Artifact SHA-256 hashes: `docs/02-mechanics-spec.md` `bc0178ae478d5e2f3ba392d1b15ab6bb56a7f81ad1703576a1b365817dcf7e04`
Result: PASS

---

## 1. Procedure

Enumerated every mutation of the entry (`kelime`), the deck (`buttonN._visible`),
the found list (`bulunanlar`) and the board (`sonuclarN_r`), and derived the
outcome for the edge cases listed in `docs/05` §7.

## 2. Rules (excerpt + conclusion)

**(a) Duplicate-letter words** — `frame_131/DoAction.as` `onKeyDown` L687-L708
(keyboard; the click path is `DefineButton2_57` L1-L13 with `this._visible = false`):

```
   i = 0;
   while(i < harfsayisi)
   {
      t = eval("button" + i);
      if(t.word == h && t._visible)
      {
         kelime += h;
         ...
         t._visible = false;
         ses_cikart("typer");
         kontrol();
         duzenle("ekle");
         break;
      }
      i++;
   }
```

Conclusion: the first *visible* tile carrying the letter is consumed; a letter
can be entered exactly as many times as tiles carry it; no tile ⇒ the key press
is a no-op (no sound). Deletion restores one matching tile (`sil()` L327-L337
scans for `t.word == j && !t._visible`).

**(b) Re-submitting a found word** — `frame_131/DoAction.as` `function ekle()`
L586-L609 and L656-L659:

```
   while(i < dizi.length)
   {
      if(kelime == dizi[i])
      {
         f = true;
         k = true;
         k = 0;
         while(k < bulunanlar.length)
         {
            if(kelime == bulunanlar[k])
            {
               f = false;
               k = false;
               break;
            }
            k++;
         }
   ...
         else
         {
            ses_cikart("boing");
         }
```

Conclusion: valid-but-found words are rejected: no score, `boing` (sound 30),
no board change, and the typed entry is **not** cleared (only a successful new
word clears it, L645-L653). The status sprite shows `Girildi` (frame 3).

**(c) Backspace with an empty entry** — `function sil()` L321-L339:

```
function sil()
{
   ses_cikart("backspace");
   duzenle("sil");
   j = kelime.substring(kelime.length - 1,kelime.length);
   i = 0;
   while(i < harfsayisi)
   {
      t = eval("button" + i);
      if(t.word == j && !t._visible)
```

Conclusion: the `backspace` sound (38) plays, `duzenle("sil")` does nothing
(guarded by `t > 0`, L413), the scan finds no tile for `""`, `kontrol()` resets
the status to frame 1. Net effect: sound only. Same for BACKSPACE after timeout
(blocked entirely by `bitti`).

**(d) Scramble with a partial entry** — `function karistir()` L306-L320:

```
function karistir()
{
   duzenle("temizle");
   kelime = "";
   ses_cikart("shuffle");
   ...
   shuffle();
   kontrol();
}
```

Conclusion: the entry is cleared and all tiles are returned to the deck
(including the bright ball, whose `gotur1` animation plays and whose
`bonusball` is reset — see `evidence/A2-bonus.md`); then the deck is reshuffled
and the status resets to frame 1. A scramble with an **empty** entry skips the
`duzenle("temizle")` body entirely, so a pending `bonusball` survives it.

**(e) Keys for letters not in the deck / not in the alphabet** — `onKeyDown`
L673-L685: codes outside the 29-entry `codes` table give `h = harf[29] =
undefined`, which no tile matches → no-op (no typer sound). Keys for deck-absent
letters are also no-ops.

**(f) Submit with an empty entry** — `ekle()`: no `dizi` match → falls through
to the buzz branch (`if(k)`, L665-L668) and `bittimi()`; `boing`/board state
unchanged.

**(g) Extra reference behavior (not required):** CTRL (`Key.isDown(17)`,
L730-L756) shuffles and re-enters the last successfully submitted word
(`songecerlikelime`); recorded for completeness only.

## 3. Quirks recorded for implementers

1. **Buzz flag leak** — `ekle()` uses the global `k` as the "invalid word" flag
   (`k = true` inside the valid branch, `k = false` at its end, `if(k) buzz`).
   In every normal path `bittimi()` (called at the end of `ekle()`) re-assigns
   `k` from `boardN` (truthy), so the buzz plays. The flag can be falsy only
   right after the CTRL path with an empty `songecerlikelime` (`k = 0`), where
   an invalid submit is silent. The rebuild should always play the invalid-word
   sound (the audible reference behavior).
2. **10-slot listing limit** — `tablociz()` (L230-L256) clamps each length to 10
   slots (`if(k > 10) { k = 10; }`); `ekle()` writes the score and only then
   tries to list the word (L614-L630). Words beyond the 10th of a length score
   but are not listed; completion (`bittimi()`) is based on the listed slots.
   The `bN` counters (bulunacaklar) decrement from the *true* count, so they can
   still show > 0 after the round completes.
3. **Key presses before the deck exists** — the key listener is installed at
   the end of the frame-131 script, i.e. before the async XML load completes;
   `button0..7` do not exist yet. The reference tolerates this (`setProperty`
   on missing targets is ignored; Ruffle logs `SetProperty: Invalid target
   String("buttonN")` — `evidence/logs/A2-ruffle-archived-fixture.log`), and the
   rebuild must ignore input until the round has started (`baslat()` sets
   `bitti = 0` for the new round).
4. **Exact-match, uppercase** — `kontrol()`/`ekle()` compare `kelime` to `dizi`
   with `==`; entries are built from the uppercase deck letters, so comparison
   is exact/case-sensitive (Turkish `İ`/`I` are distinct letters in the deck).

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
