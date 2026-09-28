# A2 — Input handling (O04)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:50:00Z / 2026-09-28T13:25:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- reads of `artifacts/decompiled/scripts/frame_131/DoAction.as` (`init`, `myListener.onKeyDown`) and `DefineButton2_57/BUTTONCONDACTION on(release).as`
- `cat artifacts/decompiled/tags.txt` (key-related tags; instance names)
Exit codes: 0 (all)
Output summary: key-code table, action keys, click path and Turkish-letter mapping extracted; `constants.input` written
Artifact SHA-256 hashes: `data/constants.json` `569cdda52c22a540d2b0b9f198db975e8f5d64fba39a57156c51e87ef302c8a1`
Result: PASS

---

## 1. Procedure

Read the keyboard listener installed on the gameplay frame and the tile-click
handler; recorded which keys act, how letters are matched to deck tiles, and
how Turkish letters are encoded (Flash key codes).

## 2. Excerpts (verbatim)

Letter table — `artifacts/decompiled/scripts/frame_131/DoAction.as`
`function init()` L8-L9:

```
harf = new Array("A","B","C","Ç","D","E","F","G","Ğ","H","I","İ","J","K","L","M","N","O","Ö","P","R","S","Ş","T","U","Ü","V","Y","Z");
codes = new Array(65,66,67,220,68,69,70,71,219,72,73,222,74,75,76,77,78,79,191,80,82,83,186,84,85,221,86,89,90);
```

Key listener — `frame_131/DoAction.as` L672-L690 and L709-L729:

```
myListener = new Object();
myListener.onKeyDown = function()
{
   j = Key.getCode();
   i = 0;
   while(i < codes.length)
   {
      if(codes[i] == j)
      {
         break;
      }
      i++;
   }
   h = harf[i];
   i = 0;
   while(i < harfsayisi)
   {
      t = eval("button" + i);
      if(t.word == h && t._visible)
      {  ...  }
```

```
   if(Key.isDown(32)) { if(!bitti) { karistir(); } }        // SPACE  → scramble
   if(Key.isDown(8))  { if(!bitti) { sil(); } }            // BACKSPACE → delete
   if(Key.isDown(13)) { if(!bitti) { ekle(); } }           // ENTER  → submit
   if(Key.isDown(17)) { if(!bitti) { karistir(); ... } }   // CTRL   → extra (see below)
```

Tile click path — `artifacts/decompiled/scripts/DefineButton2_57/BUTTONCONDACTION on(release).as`
L1-L20: `_root.kelime += word;` + the same bonus roll + `_root.duzenle("ekle")`,
`this._visible = false;`, `_root.kontrol();`, `stopAllSounds();` and
`tellTarget("_root.typer") { gotoAndPlay(2); }` when `_root.vol` is set.

Tile vocabulary — `frame_131/DoAction.as` `function yerlestir()` L124-L126:
`x.word = enbuyukkelime.substring(i,i + 1);` (deck letters are the uppercase
letters of the round's main word).

Reference cross-check (Ruffle log, `evidence/logs/A2-ruffle.log`): with a
Base64 fixture the 8 deck tiles are created (`duplicateMovieClip`) and no
`SetProperty: Invalid target` warnings appear; with the archived plain-text
fixture only `button0`/`button1` exist (warnings for `button2`…`button7`).

## 3. Conclusion

- **Codes, not characters:** all input is matched by numeric Flash key codes
  (`Key.getCode()` / `Key.isDown()`), never by characters or layouts.
- **Letters:** only the 29 Turkish uppercase letters in `codes` are recognised;
  the array maps them positionally to `harf`. Turkish letters use their standard
  Flash/Windows key codes: `Ç=220, Ğ=219, İ=222, Ö=191, Ş=186, Ü=221`;
  codes absent from the table (digits, punctuation, Q/W/X, arrows…) fall through
  (`h = harf[29] = undefined`) and do nothing.
- A letter is only entered if a *visible* deck tile carries it (`t.word == h &&
  t._visible`) — the first such tile is consumed; otherwise nothing happens
  (no typer sound either).
- **Actions:** SPACE = scramble (`karistir`), BACKSPACE = delete last (`sil`),
  ENTER = submit (`ekle`). All four key actions are gated by `if(!bitti)`, i.e.
  blocked after the round has timed out.
- **Extra (reference-only):** CTRL (`Key.isDown(17)`) shuffles and then
  re-enters the letters of the last successfully submitted word
  (`songecerlikelime`, L730-L756). Not part of the official key list; documented
  for completeness so the rebuild does not accidentally treat it as required.
- Clicking a tile follows the same add path; the click path plays the typer
  sound via `_root.typer` and does not use the keyboard table.
- `constants.input` = `{ scrambleKey: "SPACE", submitKey: "ENTER", deleteKey: "BACKSPACE" }`.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
