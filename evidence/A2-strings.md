# A2 — User-visible strings and conditions (O05)

Task: A2 — Mechanics Extraction (Constants, Events, Flows)
Started/Ended: 2026-09-28T12:50:00Z / 2026-09-28T13:25:00Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `for f in artifacts/decompiled/texts/*.txt; do ...; done` (non-empty text contents)
- `grep -o 'DefineEditText (chid: [0-9]*, vn: "[^"]*")' artifacts/decompiled/tags.txt | sort -u`
- `python3` recursive SWF walk (top-level + DefineSprite placement of text ids; see `/tmp` walker in A2-labels.md)
- reads of `frame_131/DoAction.as` (`kontrol`, `tablociz`, `tamamla`) and `DefineSprite_123` frames
Exit codes: 0 (all)
Output summary: complete static/dynamic string inventory with display conditions; `docs/02` §2/§6 slots updated
Artifact SHA-256 hashes: `artifacts/decompiled/tags.txt` `f162cac65cf8c3c61bae2465f9f6e97df45a71a784b69cefb43cb61c57f2d10c`; `docs/02-mechanics-spec.md` `bc0178ae478d5e2f3ba392d1b15ab6bb56a7f81ad1703576a1b365817dcf7e04`
Result: PASS

---

## 1. Procedure

1. Dumped every non-empty export in `artifacts/decompiled/texts/*.txt` (62 files;
   filename = SWF text character id).
2. Read the `DefineEditText` variable bindings from `tags.txt`.
3. Traced which text ids are placed by which symbol/frame (raw SWF walk) and
   which code paths assign the bound variables.
4. Split into: gameplay strings (required), results-screen strings (needed
   without the excluded form), excluded screen strings.

## 2. String inventory (verbatim from the exports)

Gameplay frame 131 (`hepsiburda`, placement verified by the SWF walk):

| Text id | Text | Kind | Shown when |
|---|---|---|---|
| 60 | `Karıştır` | static (scramble button) | during gameplay (after `baslat()`) |
| 64 | `Ekle` | static (submit button) | during gameplay |
| 69 | `Yeni Oyun` | static (new-round button) | `tamamla()` (timeout) / `bittimi()` (completion); hidden by `frame_132` |
| 104 | `Sil` | static (delete button) | during gameplay |
| 125 | dynamic `vn:"puan"` | HUD score | always; set by scoring |
| 112 | dynamic `vn:"timer"` | HUD time | always; written by the timer sprite |
| 124 | dynamic `vn:"kelime"` | HUD word entry | always; set/cleared by `duzenle()` |
| 127, 128 | `Puan` | static HUD labels | always |
| 129, 130 | `Süre` | static HUD labels | always |
| 143, 144 | `Kelime` | static HUD labels | always |
| 131-136 | `3 harfli:` … `8 harfli:` | static counter labels | always |
| 137-142 | dynamic `vn:"b3"`…`vn:"b8"` | per-length counters | always; decremented on each valid word |
| 119 | `Geçerli` | static, inside `status` sprite frame 2 | entry equals a word of `dizi` and is not in `bulunanlar` |
| 122 | `Girildi` | static, inside `status` sprite frame 3 | entry is in `bulunanlar` (already found) |
| 52, 55 | `A` | static (default tile letter) | tile symbol default until `word` is set |
| 109 | dynamic `vn:"bonuss"` | score-popup value | `puanmovie` frame 7: `bonuss = _root.bonus;` |
| 78, 82, 83 | `Kelimeler Yükleniyor\rLütfen Bekleyiniz...` (CR 0x0D between the two lines) | static, inside `xmlload` sprite frames 2/3/4 | while the round XML is being fetched/parsed |
| 16, 19 | `%`, `/` | static preloader | while the SWF itself loads (frames 2-4) |

Results screen (reached after `bravo`, only the display part is required; the
`Ad Soyad`/`E-posta`/`Gönder` form is excluded per `docs/02` §7):

| Text id | Text | Source |
|---|---|---|
| 165 | `TEBRİKLER` | `DefineSprite 166` frame 1 |
| 160 | `Puanınız` | `DefineSprite 166` frame 1 |
| 161 | `Kelime Sayısı` | `DefineSprite 166` frame 1 |
| 164 | `Süre` | `DefineSprite 166` frame 1 |
| 156, 157, 163 | dynamic `vn:"toplamkelime"`, `"toplampuan"`, `"toplamsure"` | set by `DefineSprite_166/frame_1/DoAction.as` L14-L16 |

Excluded screens (per `docs/02` §7 — recorded, not rebuilt):

| Text id | Text | Where |
|---|---|---|
| 106 | `Top10` | Top10 button |
| 92, 93, 94 | `Diğer oyunlar` | external game links |
| 99, 100, 101 | `kelimator.com` | site links |
| 158, 159 | `Ad Soyad`, `E-posta` | score form (sprite 166) |
| 148, 150, 152 | `Gönder` | score form submit button |

Condition excerpts (verbatim) — `frame_131/DoAction.as` `function kontrol()` L259-L279:

```
   status.gotoAndStop(1);
   i = 0;
   while(i < dizi.length)
   {
      if(kelime == dizi[i])
      {
         status.gotoAndStop(2);
      }
      i++;
   }
   i = 0;
   while(i < bulunanlar.length)
   {
      if(kelime == bulunanlar[i])
      {
         status.gotoAndStop(3);
      }
      i++;
   }
```

(the `bulunanlar` pass runs last, so an already-found word shows frame 3 =
`Girildi`; a valid new word shows frame 2 = `Geçerli`; anything else frame 1 =
blank state).

`DefineSprite_166/frame_1/DoAction.as` L14-L16 (results values):

```
toplampuan = _root.puan;
toplamkelime = _root.toplamkelime;
toplamsure = _root.sure - _root.timer;
```

## 3. Conclusion

All gameplay and results-screen strings are extracted from the exports with
their display conditions; layout/typography remains O08 (A3). No user-visible
string is invented in the rebuild; the excluded screens' strings are listed so
they are not reintroduced.

## 4. docs/08 proposal

See `evidence/A2-mochi.md` §"docs/08 proposal".
