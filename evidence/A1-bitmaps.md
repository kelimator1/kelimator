# A1 — Bitmaps (DefineBitsLossless / DefineBitsLossless2) — partial O10 evidence

Task: A1 — Decompile and Export Reference Build
Started: 2026-09-28T12:31:22Z
Ended: 2026-09-28T12:45:03Z
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Commands executed (exact):
- `artifacts/tools/ffdec/ffdec.sh -dumpSWF "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/tags.txt`
- `artifacts/tools/ffdec/ffdec.sh -format script:as,shape:svg,sprite:svg,image:png,sound:mp3_wav,text:plain,font:ttf -export script,shape,sprite,image,sound,text,font artifacts/decompiled/ "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"`
- `artifacts/tools/ffdec/ffdec.sh -swf2xml "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" artifacts/decompiled/tags.xml`
- `python3 artifacts/tools/a1-swf-inspect.py "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf" > artifacts/decompiled/swf-inspect.json`
- placement/usage parse: see `evidence/logs/A1-bitmap-usage.log`
Exit codes: 0 (all)
Output summary: 2 bitmap definitions read (dimensions/format/exports); shape-fill usage traced
Artifact SHA-256 hashes: `images/47.png` `366abdbfc11be54290e48f70d5c0104f0b5fcb47084fe76884c0183a0a84ee1a`, `images/86.png` `74710a87bbc5f61b3ab60d24d1c5b2892b3561b67b13bcb48ca2a559441cfa6e`
Result: PASS

---

## 1. Bitmap definitions (raw parse of the 2012 SWF)

| Character ID | Tag | BitmapFormat | Dimensions | Color table | zlib data | Uncompressed data |
|---|---|---|---|---|---|---|
| 47 | `DefineBitsLossless` (tag 20, payload 43,269 B) | 3 = 8-bit colormapped RGB | **550 × 400** | 128 colors (`bitmapColorTableSize=127`) | valid, 43,261 B | 221,184 B |
| 86 | `DefineBitsLossless2` (tag 36, payload 197 B) | 3 = 8-bit colormapped + alpha | **21 × 29** | 8 colors (`bitmapColorTableSize=7`) | valid, 189 B | 728 B |

FFDec's own parse in `tags.xml` reports the same (`bitmapWidth`/`bitmapHeight`/
`bitmapFormat`/`bitmapColorTableSize`). The 2007/EN build dimensions (768×550, 768×21)
**do not apply** to this build — the `[TBC → O10]` slot in `docs/01` §3 is updated
accordingly (see §5).

## 2. PNG exports

| Export | File | PNG | Channels | SHA-256 |
|---|---|---|---|---|
| `images/47.png` | 62,493 B | 550 × 400, 8-bit/color RGB, non-interlaced | no alpha (expected for `DefineBitsLossless`) | `366abdbf…` |
| `images/86.png` | 312 B | 21 × 29, 8-bit/color RGBA, non-interlaced | alpha (expected for `DefineBitsLossless2`) | `74710a87…` |

PNG IHDR dimensions were parsed independently and equal the raw definitions
(`a1-verify.py`, V2d — PASS).

## 3. Usage (where the bitmaps appear on stage)

Neither bitmap is referenced by `PlaceObject2` or `BUTTONRECORD`. Both are used as
**clipped bitmap fills** (`FILLSTYLE fillStyleType=65`) inside shapes
(`A1-bitmap-usage.log`):

- bitmap **47** → 1 fill inside **shape 48** (`DefineShape`, main timeline);
  `PlaceObject2 (chid: 48, dpt: 5)` on the main timeline.
- bitmap **86** → 1 fill inside **shape 87** (`DefineShape`, main timeline);
  `PlaceObject2 (chid: 87, dpt: 2)` inside **`DefineSprite` 88** (frame label `"on"`).

So bitmap 47 (550×400) is a full-stage background-type fill; bitmap 86 (21×29) is a small
fill used inside sprite 88. Exact geometry/transform mapping is A3's scope.

## 4. Verification

- Raw vs FFDec vs PNG dimensions: all match (V2d PASS, `A1-verify.log`).
- Both bitmaps have exports; the reference-completeness check passes (V2e PASS).
- Exports listed and hashed (`SHA256SUMS.txt`, 672 files).

## 5. `docs/01` §3 `[TBC → O10]` slot update (applied)

The bitmap-dimensions `[TBC]` slot in `docs/01-reverse-engineering.md` §3 was updated to
the confirmed 2012 values (550×400 and 21×29) with a pointer to this file.

## 6. O10 partial finding (item stays OPEN)

See `evidence/A1-export-manifest.md` §11 "docs/08 proposal" for the exact proposed note.
Summary: dimensions/format are closed with evidence (550×400 RGB, 21×29 RGBA, both
format 3); usage is narrowed to two shape fills and their placements. Full placement
geometry and visual confirmation remain with A3, so O10 stays OPEN.

## 7. Result

**PASS** — 2/2 bitmap definitions read and exported; dimensions/format confirmed by raw
parse, FFDec XML and PNG IHDR; usage locations recorded.
Raw logs: `evidence/logs/A1-bitmap-usage.log`, `evidence/logs/A1-verify.log`,
`evidence/logs/A1-artifact-types.log`.
