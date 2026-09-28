# A1 — Export Manifest (Reference Build)

Task: A1 — Decompile and Export Reference Build
Started: 2026-09-28T12:31:22Z
Ended: 2026-09-28T12:45:03Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact): see §3 (all raw outputs in `evidence/logs/A1-*.log`)
Exit codes: all recorded commands exited 0 (final verification run: 0)
Output summary: full FFDec 26.3.0 export of the 2012 reference SWF to `artifacts/decompiled/` (see §4) plus raw SWF inspections; all V-checks PASS
Artifact SHA-256 hashes: see §12
Result: PASS

---

## 1. Tooling

| Item | Value | Evidence |
|---|---|---|
| Java | `openjdk version "17.0.20.1" 2026-08-18` (Homebrew, 64-Bit Server VM) | `evidence/logs/A1-install.log` |
| FFDec / JPEXS | **v26.3.0** (`JPEXS Free Flash Decompiler v.26.3.0`) | `evidence/logs/A1-install.log`, `A1-ffdec-help.log` |
| Distribution | GitHub release `version26.3.0` (published 2026-09-14), asset `ffdec_26.3.0.zip` | release API response / `A1-install.log` |
| Download URL | `https://github.com/jindrapetrik/jpexs-decompiler/releases/download/version26.3.0/ffdec_26.3.0.zip` | `A1-install.log` |
| Archive size | 19,871,169 bytes | `A1-install.log` |
| Archive SHA-256 | `35f4930eb7c380afe66f2117f90b006deac0631473ad7500bb39c78f68645ecd` | `A1-install.log` |
| Install path | `artifacts/tools/ffdec/` (`unzip -q -o … -d artifacts/tools/ffdec`) | — |

CLI flags were **not assumed**; they were confirmed with `-help` / `-help -export` before use
(logs `evidence/logs/A1-ffdec-help.log`, `A1-ffdec-help-export.log`). Exactly these were used:

- `<ffdec.sh> -help` and `<ffdec.sh> -help -export`
- `<ffdec.sh> -header <swf>` — prints header values
- `<ffdec.sh> -dumpSWF <swf>` — prints the tag listing
- `<ffdec.sh> -swf2xml <swf> <out.xml>` — full tag structure as XML
- `<ffdec.sh> -format <formats> -export <itemtypes> <outdir> <infile>` — export
- FLA format version: `fla:cs6` — FFDec's own default (confirmed via `-listconfigs`:
  `lastFlaExportVersion[CS6]`; `lastFlaExportCompressed[true]`).

FFDec instances were run strictly one at a time (serialized).

## 2. Source verification (V1)

Command: `md5`, `shasum -a 256`, `file`, `stat -f %z` on
`../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`

| Fact | Value |
|---|---|
| MD5 (expected `af059ff9d75cefbc244f03814b47be9c`) | `af059ff9d75cefbc244f03814b47be9c` — **match** |
| SHA-256 | `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` |
| Size | 188,830 bytes |
| `file` | `Macromedia Flash data (compressed), version 6` |

Log: `evidence/logs/A1-source-verify.log`. V1 = PASS.

## 3. Export commands (exact, in order)

```text
artifacts/tools/ffdec/ffdec.sh -header "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/header.txt
artifacts/tools/ffdec/ffdec.sh -dumpSWF "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/tags.txt
artifacts/tools/ffdec/ffdec.sh -format script:as,shape:svg,sprite:svg,image:png,sound:mp3_wav,text:plain,font:ttf -export script,shape,sprite,image,sound,text,font artifacts/decompiled/ "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"
artifacts/tools/ffdec/ffdec.sh -format fla:cs6 -export fla artifacts/decompiled/fla/kelimator_tr_2012_mochiads.fla "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"
artifacts/tools/ffdec/ffdec.sh -swf2xml "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" artifacts/decompiled/tags.xml
```

Logs: `A1-header.log`, `A1-tags.log`, `A1-export.log` (FFDec: `Export finished … OK`),
`A1-fla.log` (`Export finished … OK`), `A1-swf2xml.log`. Exit code 0 for every command.

FLA path note: FFDec treats the second `-export fla` argument as an output *directory*
it places `<input>.fla` into, so the produced file is
`artifacts/decompiled/fla/kelimator_tr_2012_mochiads.fla/kelimator_tr_2012_mochiads.fla`.

Non-FFDec inspection tools written for A1 (allowed by the task):

```text
python3 artifacts/tools/a1-swf-inspect.py <swf> > artifacts/decompiled/swf-inspect.json
python3 artifacts/tools/a1-swf-inspect.py --summary <swf>
python3 artifacts/tools/a1-verify.py "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" artifacts/decompiled "../kelimator-nostalji/sesler"
```

## 4. Manifest — `docs/01` §3 inventory → exported file(s)

FFDec's CLI decides its own subdirectory names; the mapping below is the required
expected-inventory → actual-export mapping (the plan's proposed target names are listed
for traceability).

| Expected output (§3 row) | Proposed target path | Actual exported path(s) | Count / status |
|---|---|---|---|
| FLA (timeline/layout reference) | `artifacts/decompiled/fla/` | `artifacts/decompiled/fla/kelimator_tr_2012_mochiads.fla/kelimator_tr_2012_mochiads.fla` | 1 file, 850,134 B, zip/XFL (see §9) |
| ActionScript (all scripts) | `artifacts/decompiled/as/` | `artifacts/decompiled/scripts/**/*.as` | 60 files (49 DoAction + 10 BUTTONCONDACTION + 1 CLIPACTIONRECORD); 58 non-empty, 2 empty (`frame_61/DoAction.as`, `frame_151/DoAction.as`) |
| Shapes/sprites as SVG | `artifacts/decompiled/svg/` | `artifacts/decompiled/shapes/*.svg` (47) and `artifacts/decompiled/sprites/DefineSprite_<id>/*.svg` (474 in 37 dirs) | 521 SVGs, all well-formed XML |
| Images as PNG | `artifacts/decompiled/img/` | `artifacts/decompiled/images/47.png`, `images/86.png` | 2 PNG, dimensions verified |
| Sounds per sound ID | `artifacts/decompiled/sfx/` | `artifacts/decompiled/sounds/<id>.mp3` (9) + raw payloads `artifacts/decompiled/sfx-raw/<id>.mp3.rawdata` (9) | 9 MP3 + 1 `-1.wav` (empty stream export, see `A1-stream.md`) |
| Text/fonts | `artifacts/decompiled/text/` | `artifacts/decompiled/texts/*.txt` (62) + `artifacts/decompiled/fonts/*.ttf` (3) | 62 text files (41 non-empty, 21 dynamic fields empty at definition) + 3 TTF |
| Header data | `artifacts/decompiled/header.txt` | `artifacts/decompiled/header.txt` | 187 B (see §5) |
| Tag inventory | `artifacts/decompiled/tags.txt` | `artifacts/decompiled/tags.txt` | 191,647 B / 1,879 lines (FFDec `-dumpSWF`) |
| (extra, cross-check) | — | `artifacts/decompiled/tags.xml` | 9,054,330 B, FFDec `-swf2xml` full structure |
| (extra, cross-check) | — | `artifacts/decompiled/swf-inspect.json` | 23,410 B, raw binary tag parse |

Export completeness (`a1-verify.py`, V2e):

- every DefineShape/2/3 (47) → `shapes/<id>.svg`; every DefineSprite (37) → `sprites/DefineSprite_<id>/`;
  every bitmap (2) → `images/<id>.png`; every DefineText/2/EditText (62) → `texts/<id>.txt`;
  every DefineSound (9) → `sounds/<id>.mp3`.
- every `PlaceObject2`-referenced character id has an exported counterpart;
  every `StartSound` target has an exported MP3.
- raw tag counts (top level) match the `[CONFIRMED]` inventory in `docs/01` §3 exactly:
  ShowFrame 241, DefineShape 33, DefineShape2 2, DefineShape3 12, DefineText 15,
  DefineEditText 47, DefineButton2 10, DefineSprite 37, DefineSound 9,
  DefineBitsLossless 1, DefineBitsLossless2 1, SoundStreamHead2 1, FrameLabel 4,
  DoAction 10, Protect 1; plus DefineFont2 3 (top-level; see `A1-fonts.md`).

## 5. Header data (`artifacts/decompiled/header.txt`, raw)

```text
[header]
fileSize=348735
version=6
compression=ZLIB
encrypted=false
gfx=false
displayRect=[0, 0, 11000, 8000]
width=11000
widthPx=550
height=8000
heightPx=400
frameCount=241
frameRate=36
```

Cross-check (raw binary parse, `swf-inspect.json`): CWS/ZLIB, version 6,
stage 550×400 px, 36.0 fps, 241 frames — identical. Background color from tags:
`SetBackgroundColor FF FF FF` (white).

## 6. Sound payload verification (V2, empirical from SWF tag data)

Definitions: docs/01 §3 byte sizes equal the **full DefineSound tag payload length**
(7 fixed bytes: SoundId UI16 + sound-format byte + SoundSampleCount UI32, then SoundData).
All 9 sounds: MP3, mono (8 × 22050 Hz, ID 30 × 11025 Hz).

| Sound ID | docs/01 §3 size (= tag payload) | raw tag payload (parsed) | raw SoundData length | exported file | exported size | export == SoundData[2:] | sha256(SoundData) |
|---|---|---|---|---|---|---|---|
| 22 | 1959 | 1959 | 1952 | `sounds/22.mp3` | 1950 | yes | `ec752a2a6bd9c7c858df7aa0f2517e6187eedd06c68ddf68f6cd4665bbe99281` |
| 24 | 4039 | 4039 | 4032 | `sounds/24.mp3` | 4030 | yes | `0c78e1799f31d4965a1b0ad78043f09013ba733ac8ff843b6ecc2ecc3903e2cf` |
| 26 | 919 | 919 | 912 | `sounds/26.mp3` | 910 | yes | `0653e7acb08cdb95fdae5c5526b2d2dd014130abf0507b0a63ab75f9d6956935` |
| 30 | 1569 | 1569 | 1562 | `sounds/30.mp3` | 1560 | yes | `8820253d5cbc0f638e9bb5686cf92c5db46bd379477a7ac9c4165e928068394a` |
| 32 | 21849 | 21849 | 21842 | `sounds/32.mp3` | 21840 | yes | `02adf288eefb614c89b402b05a27eb68d52219bc1fdf582db5618356033051ce` |
| 34 | 2739 | 2739 | 2732 | `sounds/34.mp3` | 2730 | yes | `d7d45d198b21e4632f1a90c43157462bbce49a449112c34fff890f1be140dac0` |
| 36 | 1439 | 1439 | 1432 | `sounds/36.mp3` | 1430 | yes | `24ad82f5fc0cf4a81652d6f8b9ee418769dd9f30828724fe3befc7627df072f6` |
| 38 | 1699 | 1699 | 1692 | `sounds/38.mp3` | 1690 | yes | `4c4ece8cdb665845cc4eab94e446c37c6e3ab94fe38a067b915f3ecdcff5a128` |
| 40 | 2739 | 2739 | 2732 | `sounds/40.mp3` | 2730 | yes | `9fa55a397002b5eb1720655b2d21ac495219e4244d9b2497c3013253101d89c5` |

**All 9 tag payload lengths match `docs/01` §3 byte sizes exactly** (1959, 4039, 919,
1569, 21849, 2739, 1439, 1699, 2739). FFDec's MP3 export is byte-identical to
`SoundData[2:]` for every sound (it strips the 2-byte SWF MP3 prefix; it adds no header
bytes). Raw payloads are dumped to `artifacts/decompiled/sfx-raw/`.

afinfo (exit 0 for all 10 exported sound files; full log `A1-sounds-afinfo.log`):
durations 0.390 / 0.806 / 0.182 / 0.624 / 4.368 / 0.546 / 0.286 / 0.338 / 0.546 s;
bit rate 40 kbps (ID 30: 20 kbps); `file`: MPEG ADTS layer III, v2 (ID 30: v2.5), mono.
`file` prints 24 kbps for ID 30, afinfo prints 20000 bps; afinfo (and docs/01 §3, "20 kbps")
agree — recorded as a `file`-tool table artifact, not a mismatch of the payload.

## 7. `../kelimator-nostalji/sesler/` copies — verified, not assumed

| Local file | Size | SHA-256 | Relation to 2012 raw SoundData |
|---|---|---|---|
| `sound_1_id21_fmt2_r2.mp3.fixed.mp3` | 1953 | `0dbb7009fc16a2997888a14723438afd3f9c0ce2ad0f0bc61ae9168027802a35` | `0x00 + raw SoundData` (sound 22) |
| `sound_2_id23_fmt2_r2.mp3.fixed.mp3` | 4033 | `3f9c98b37c853600acf8edf8768921117c93157ce08f2ecf65a7f0e612f50217` | `0x00 + raw SoundData` (sound 24) |
| `sound_3_id25_fmt2_r2.mp3.fixed.mp3` | 913 | `58e86971869cb855d7e8f441ed3c72c4ce7bcda9a026cc471fafaaa63e1d1745` | `0x00 + raw SoundData` (sound 26) |
| `sound_4_id29_fmt2_r2.mp3.fixed.mp3` | 1563 | `7fd476b917288c3253ee7b92a9ddd0e025ea4225ffe2fac9154accc2c7c3752c` | `0x00 + raw SoundData` (sound 30) |
| `sound_5_id31_fmt2_r2.mp3.fixed.mp3` | 21843 | `6128b1dec22dda243ceffff943695f845e93059888cb08db24fd53024c24fc8a` | `0x00 + raw SoundData` (sound 32) |
| `sound_6_id33_fmt2_r2.mp3.fixed.mp3` | 2733 | `472b1d08a9aff893c719639850da8f38f8e2abbe470e3446d756c87c5f83e35d` | `0x00 + raw SoundData` (sound 34) |
| `sound_7_id35_fmt2_r2.mp3.fixed.mp3` | 1433 | `0d425ffbd69436b821afcff1bf6cc9f23e38491ed00a3b5c56171a856ca9e50d` | `0x00 + raw SoundData` (sound 36) |
| `sound_8_id37_fmt2_r2.mp3.fixed.mp3` | 1693 | `d1886b3d3be1ee7025b145735ce6d5fd1ce9a5853e5149b2aa55de894cdef94e` | `0x00 + raw SoundData` (sound 38) |
| `sound_9_id39_fmt2_r2.mp3.fixed.mp3` | 2733 | `caf26cc94a3bb6f3694de114c21dcd82e6737a1874d8b3e6a0ca4692b7dd922c` | `0x00 + raw SoundData` (sound 40) |

The `_idNN` numbers inside these filenames (21, 23, 25, …) are **not** the 2012 SWF sound
IDs (which are 22, 24, 26, 30, 32, 34, 36, 38, 40). The byte content is verified to be the
2012 build's payload with one leading `0x00` byte; any later reuse must key on hashes,
not on these filenames.

## 8. Other verification results (raw logs under `evidence/logs/`)

- `python3 artifacts/tools/a1-verify.py …` → `RESULT: PASS (0 failures)` (`A1-verify.log`).
- SVG: 521/521 parse as well-formed XML via `xml.dom.minidom`; no empty SVGs.
- PNG: `images/47.png` = 550×400 8-bit RGB; `images/86.png` = 21×29 8-bit RGBA
  (match the raw definitions; details in `evidence/A1-bitmaps.md`).
- Fonts: 3 TTF exports; details in `evidence/A1-fonts.md`.
- Sound stream: no content; details in `evidence/A1-stream.md`.
- Artifact types log: `A1-artifact-types.log`; TTF table dump: `A1-ttf-inspect.log`.
- V1 (MD5) re-confirmed by `a1-verify.py` (source MD5 check run before export:
  `A1-source-verify.log`).

## 9. FLA structure (CS6 zipped XFL)

- `DOMDocument.xml`: `xflVersion="2.2"`, `frameRate="36"`, `backgroundColor="#ffffff"`,
  generator `JPEXS Free Flash Decompiler v.26.3.0`.
- `PublishSettings.xml` present.
- `LIBRARY/`: 90 entries — 78 `Symbol N.xml`, 2 bitmaps (`Bitmap 47.png`, `Bitmap 86.png`),
  9 sounds (`sound22.wav` … `sound40.wav`), 1 directory entry.
- `bin/`: 11 data files. Zip total: 103 entries, 850,134 bytes.
- FLA-internal symbol names are FFDec-generated; mapping FLA symbols to SWF character IDs
  is layout work (A3).

## 10. O19-related observations (input for A2; not a removal analysis)

- The MochiAds runtime code appears in exactly one exported script:
  `artifacts/decompiled/scripts/frame_1/DoAction.as` (`grep -rl MochiAd artifacts/decompiled/scripts`).
  Its top-level DoAction tag is the 10,480-byte payload (tag #3 in `tags.txt`).
- O19 stays OPEN; A2 owns the removal analysis (`evidence/A2-mochi.md`).

## 11. docs/08 proposal (items stay OPEN)

Proposed partial-finding notes for `docs/08-open-items.md` (transcription is the
orchestrator's job; A1 must not edit that file):

- **O09 — Font names/styles used by the 2012 build**
  Partial (A1): three `DefineFont2` records, all `fontName="Verdana"` (NUL-terminated in
  the tag), `languageCode=1`, no `DefineFontInfo` tags in the SWF:
  id 13 = Bold, 1512 glyphs, wideOffsets/wideCodes, hasLayout;
  id 15 = Regular, 114 glyphs, wideCodes only;
  id 126 = Bold Italic, 1512 glyphs, wideOffsets/wideCodes.
  Exports: `artifacts/decompiled/fonts/{13,15,126}_Verdana.ttf`; styles independently
  confirmed from the TTF `head.macStyle` / `OS/2.usWeightClass` tables. Usage:
  `DefineText` ids 16, 19 → font 15; `DefineText` ids 60, 64, 69, 104, 106, 119, 122,
  158–161, 164, 165 → font 13; `DefineEditText` 40 fields → font 13, id 112 → font 15,
  ids 127–130, 143, 144 → font 126. Evidence: `evidence/A1-fonts.md`; still OPEN pending
  A3 text metrics.
- **O10 — Bitmap dimensions and usage locations in the 2012 build**
  Partial (A1): two bitmaps, both format 3 (8-bit colormapped): id 47
  `DefineBitsLossless` 550×400 (128 colors), id 86 `DefineBitsLossless2` 21×29
  (8 colors + alpha). Neither is placed by `PlaceObject2`; both are used as clipped
  bitmap fills (`fillStyleType=65`) inside shapes: bitmap 47 → shape 48 (main timeline,
  depth 5), bitmap 86 → shape 87 (inside `DefineSprite 88`, frame label `"on"`, depth 2).
  Exports: `images/47.png` (550×400 RGB), `images/86.png` (21×29 RGBA). The 2007/EN
  dimensions (768×550, 768×21) do **not** apply to this build. Evidence:
  `evidence/A1-bitmaps.md`; still OPEN pending A3 placement mapping.
- **O11 — Streaming sound (`SoundStreamHead2`) content and purpose**
  Partial (A1): 38 `SoundStreamHead2` tags (1 top-level + 37 inside `DefineSprite`s), all
  byte-identical 4-byte payloads `0a 00 00 00` (playback 22050 Hz / 16-bit / mono;
  `streamSoundCompression=0`, `streamSoundSampleCount=0`); zero `SoundStreamBlock`
  tags in the entire SWF. FFDec exports it as `sounds/-1.wav` = 44-byte RIFF/WAVE header
  with 0 audio bytes (afinfo: duration 0.000000). Conclusion: no streaming audio content
  exists in the 2012 build. Evidence: `evidence/A1-stream.md`; still OPEN pending
  A2/A3 audible confirmation.

## 12. Artifact SHA-256 hashes

| Artifact | SHA-256 |
|---|---|
| `artifacts/decompiled/header.txt` | `23d6a2afca68b837a353c412857cc57ac56a32aaf41285b1b174e5b072aae521` |
| `artifacts/decompiled/tags.txt` | `f162cac65cf8c3c61bae2465f9f6e97df45a71a784b69cefb43cb61c57f2d10c` |
| `artifacts/decompiled/tags.xml` | `c5290f02ea0d8bedec255fa64c476877f41adf09bbf92aa565e90f2bb5523765` |
| `artifacts/decompiled/swf-inspect.json` | `666ed90d631ea1d2c70479dff1a894ff57fb890b409585ab78c1619ca2a6caeb` |
| `artifacts/decompiled/…/kelimator_tr_2012_mochiads.fla` (FLA) | `794098bcf76eb0763dbd3f38d3d66d828456ff4d6ca9f529bfd365d26ed22241` |
| `artifacts/decompiled/fonts/13_Verdana.ttf` | `1bb1e1533d6613413decf917d7210610d1a96f22421817ff796caf6abbcd9236` |
| `artifacts/decompiled/fonts/15_Verdana.ttf` | `43d7bc512a031765477e5ed5cb41d8454eb05646fe8fc94dbf5377df5a7195b7` |
| `artifacts/decompiled/fonts/126_Verdana.ttf` | `682fedbdb3d922a9b79efa0d6cd67cb547667190393d07215d6a8276d401de58` |
| `artifacts/decompiled/images/47.png` | `366abdbfc11be54290e48f70d5c0104f0b5fcb47084fe76884c0183a0a84ee1a` |
| `artifacts/decompiled/images/86.png` | `74710a87bbc5f61b3ab60d24d1c5b2892b3561b67b13bcb48ca2a559441cfa6e` |
| `artifacts/decompiled/sounds/22.mp3` … `40.mp3` + `-1.wav` | see `sounds` rows in §6/§7 and `A1-verify.log` |
| `artifacts/decompiled/SHA256SUMS.txt` (all 672 exported files, sorted) | `743b91fa624f1af23315095516de085c3abff8d456597125df40e4b6154ee43d` |
| `artifacts/tools/a1-swf-inspect.py` | `01053cc576b060235ebb6a645f96fa81629ae89b318abbec38b82ffdd5de70b6` |
| `artifacts/tools/a1-verify.py` | `d33d78ddaa7bfc3a0681f937b0f014c6c48684ffbbdc1996e5eeed183416693c` |
| source SWF | `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` |

Full per-file hashes: `artifacts/decompiled/SHA256SUMS.txt` (672 files).

## 13. Result

**PASS** — all V1/V2 checks pass; every expected export class is present with non-empty
files; sound count = 9 with payload sizes matching `docs/01` §3 exactly; all sounds pass
`afinfo`; all 521 SVGs are well-formed XML. Raw logs: `evidence/logs/A1-*.log`.
