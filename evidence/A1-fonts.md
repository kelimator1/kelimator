# A1 — Fonts (DefineFont2 records) — partial O09 evidence

Task: A1 — Decompile and Export Reference Build
Started: 2026-09-28T12:31:22Z
Ended: 2026-09-28T12:45:03Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `artifacts/tools/ffdec/ffdec.sh -dumpSWF "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/tags.txt`
- `artifacts/tools/ffdec/ffdec.sh -format script:as,shape:svg,sprite:svg,image:png,sound:mp3_wav,text:plain,font:ttf -export script,shape,sprite,image,sound,text,font artifacts/decompiled/ "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"`
- `artifacts/tools/ffdec/ffdec.sh -swf2xml "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" artifacts/decompiled/tags.xml`
- `python3 artifacts/tools/a1-swf-inspect.py "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/swf-inspect.json`
- `javap -classpath lib/ffdec_lib.jar -p -c com.jpexs.decompiler.flash.tags.DefineFont2Tag` (flag-order confirmation)
- font usage/table dumps: see `evidence/logs/A1-fonts-usage.log`, `A1-ttf-inspect.log`
Exit codes: 0 (all)
Output summary: 3 DefineFont2 records read and cross-checked; 3 TTF exports; usage per text id extracted
Artifact SHA-256 hashes: `fonts/13_Verdana.ttf` `1bb1e153…`, `fonts/15_Verdana.ttf` `43d7bc51…`, `fonts/126_Verdana.ttf` `682fedbd…` (full values in `A1-export-manifest.md` §12)
Result: PASS

---

## 1. DefineFont2 records (raw parse of the 2012 SWF)

`DefineFont2` tag count: **3** (all top level; no `DefineFont`/`DefineFont3`, no
`DefineFontInfo` tags anywhere in the file — 0 matches in `tags.txt`).

| Font ID | Name (tag) | Style flags | Glyphs | hasLayout | wideOffsets | wideCodes | Tag payload length |
|---|---|---|---|---|---|---|---|
| 13 | `Verdana` (8 bytes incl. NUL, `56657264616e6100`) | **Bold**, not italic | 1512 | true | true | true | 95,143 |
| 15 | `Verdana` (8 bytes incl. NUL) | **Regular** (neither bold nor italic) | 114 | true | false | true | 8,537 |
| 126 | `Verdana` (8 bytes incl. NUL) | **Bold + Italic** | 1512 | true | true | true | 97,441 |

`languageCode = 1` (Latin) for all three. Raw flag bytes: 0x8D (id 13), 0x84 (id 15),
0x8F (id 126); SWF packs the 8 `UB[1]` flags MSB-first in field order
(HasLayout, ShiftJIS, SmallText, ANSI, WideOffsets, WideCodes, Italic, Bold).

## 2. Cross-checks (independent)

1. **FFDec's own parse** (`tags.xml`, `DefineFont2Tag` attributes) — identical values:
   - id 13: `fontFlagsBold=true, fontFlagsItalic=false, fontFlagsHasLayout=true,
     fontFlagsWideOffsets=true, fontFlagsWideCodes=true`, ascent 1030, descent 215, leading 221
   - id 15: `fontFlagsBold=false, fontFlagsItalic=false, fontFlagsWideOffsets=false`, same metrics
   - id 126: `fontFlagsBold=true, fontFlagsItalic=true, fontFlagsWideOffsets=true`
2. **Flag-read direction** confirmed against the installed FFDec's own bytecode:
   `javap -p -c com.jpexs.decompiler.flash.tags.DefineFont2Tag` shows eight sequential
   `readUB(1)` calls in declaration order (see manifest §1 for the tool path). The TTF
   cross-check below independently agrees.
3. **Exported TTF tables** (`A1-ttf-inspect.log`) — style from `head.macStyle` and
   `OS/2.usWeightClass`/`fsSelection` (note: FFDec normalizes the TTF `name` table to
   "Verdana"/"Regular" for all three, so the name table is *not* usable as style evidence):

| Export | head.macStyle | OS/2 usWeightClass | OS/2 fsSelection | Interpretation |
|---|---|---|---|---|
| `fonts/13_Verdana.ttf` | 0x0001 (bold) | 700 | 0x0020 (BOLD) | Bold |
| `fonts/15_Verdana.ttf` | 0x0000 | 400 | 0x0040 (REGULAR) | Regular |
| `fonts/126_Verdana.ttf` | 0x0003 (bold+italic) | 700 | 0x0021 (ITALIC+BOLD) | Bold Italic |

   All three: `unitsPerEm=1024`, `cmap` present, TrueType outlines (glyf/loca).

## 3. Usage (which text records reference which font)

Parsed from `tags.xml` (`TEXTRECORD fontId`, `DefineEditTextTag fontId`):

- `DefineText` (static text): id 16, 19 → font **15** (Regular);
  ids 60, 64, 69, 104, 106, 119, 122, 158, 159, 160, 161, 164, 165 → font **13** (Bold).
- `DefineEditText` (dynamic): 40 fields → font **13**; id 112 → font **15**;
  ids 127, 128, 129, 130, 143, 144 → font **126** (Bold Italic).

## 4. Exports

`artifacts/decompiled/fonts/126_Verdana.ttf` (244,208 B),
`13_Verdana.ttf` (243,560 B), `15_Verdana.ttf` (23,676 B) — all `file`-verified as
`TrueType Font data`. Hashes in `A1-export-manifest.md` §12. `texts/*.txt` (62 files)
carry the machine-readable static text content as a complementary export.

## 5. O09 partial finding (item stays OPEN)

See `evidence/A1-export-manifest.md` §11 "docs/08 proposal" for the exact proposed note.
Summary: the 2012 build embeds three Verdana-family `DefineFont2` faces — Bold (13),
Regular (15, small 114-glyph subset), Bold Italic (126) — and uses no `DefineFontInfo`
style forcing; usage mapping recorded above. This closes the *names/styles* part only;
A3 still owns text metrics (glyph advances, kerning, sizes) and the O09 item stays OPEN.

## 6. Result

**PASS** — 3/3 font records read, names and styles confirmed by two independent sources
(FFDec tag parse; TTF style tables), exports present and hashed.
Raw logs: `evidence/logs/A1-fonts-usage.log`, `evidence/logs/A1-ttf-inspect.log`,
`evidence/logs/A1-tags.log`.
