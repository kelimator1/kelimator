# 01 — Reverse Engineering Procedure (Reference Build)

Goal: produce a complete, verified extraction of the 2012 reference SWF and a
reference capture setup usable by all later tasks.

Status tags used across docs: **[CONFIRMED]** (verified in this project),
**[TBC]** (to be confirmed by a named task), **[EXCLUDED]** (out of scope).

---

## 1. Tooling

| Tool | Purpose | Notes |
|---|---|---|
| JPEXS FFDec | Decompile ActionScript; export shapes/sprites/SVG, images, sounds, fonts, FLA | Verify exact CLI flags with `-help` before use; do not assume flag names |
| Java runtime | FFDec dependency | Record `java -version` in evidence |
| Ruffle 0.6.0 (local) | Running the original build for behavioral/visual comparison | `../kelimator-nostalji/Ruffle.app/Contents/MacOS/ruffle` |
| Static HTTP server | Needed because the SWF resolves `xml64.php` relative to its own URL | Pattern proven in `../kelimator-nostalji/calistir/sunucu.py` |
| `afinfo`, `shasum`, `file` | Verification utilities (macOS) | — |

Install FFDec only from its official distribution; record the version.

## 2. Source verification (do first)

1. Confirm `../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`
   exists; record `shasum -a 256` and `md5`.
2. MD5 must equal `af059ff9d75cefbc244f03814b47be9c`. If not, re-download from
   the Wayback URL in `README.md` §1 and re-check.
3. If unavailable: BLOCKER.

## 3. Extraction checklist (single FFDec pass)

Export everything in one session to `artifacts/decompiled/`:

| Output | Target path | Contents |
|---|---|---|
| FLA | `artifacts/decompiled/fla/` | Timeline structure, symbol library (layout reference) |
| ActionScript | `artifacts/decompiled/as/` | All scripts, per symbol/frame |
| Shapes/sprites | `artifacts/decompiled/svg/` | SVG exports of every shape/sprite used on stage |
| Images | `artifacts/decompiled/img/` | Bitmap exports (PNG) |
| Sounds | `artifacts/decompiled/sfx/` | Sound exports per sound ID |
| Text/fonts | `artifacts/decompiled/text/` | Read DefineFont2 names/styles; read static text content where machine-readable |
| Header data | `artifacts/decompiled/header.txt` | SWF version, stage size, frame rate, frame count |
| Tag inventory | `artifacts/decompiled/tags.txt` | Full tag listing with IDs/counts |

Known inventory to check completeness against **[CONFIRMED]** (prior analysis):

- Tags (top level): ShowFrame 241; DefineShape 33; DefineShape2 2;
  DefineShape3 12; DefineText 15; DefineEditText 47; DefineButton2 10;
  DefineSprite 37; DefineSound 9; DefineBitsLossless 1; DefineBitsLossless2 1;
  SoundStreamHead2 1; FrameLabel 4; DoAction 10; Protect 1
- Frame labels: `main`, `preall`, `hepsiburda`, `bravo`
- Sound definitions (IDs): 22, 24, 26, 30, 32, 34, 36, 38, 40 — all MP3, mono;
  eight at 22050 Hz (40 kbps), ID 30 at 11025 Hz (20 kbps)
- Sound payload byte sizes: 1959, 4039, 919, 1569, 21849, 2739, 1439, 1699, 2739
  (payloads byte-identical in size to the 2007 build; byte-level identity to be
  verified here)
- Bitmap definitions: 1 lossless + 1 lossless2 (dimensions **[CONFIRMED A1]**:
  550×400 for lossless id 47, 21×29 for lossless2 id 86; the 2007/EN values
  768×550 and 768×21 do not apply to this build; see `evidence/A1-bitmaps.md`)
- MochiAds code present (startup ad). Mark its scripts/tags for removal in A2;
  never execute its network calls.

Export completeness rule: every shape/sprite/image/sound referenced by the
timeline must appear as an exported file. Any mismatch is a FAIL.

## 4. Reading order for the decompiled material (feeds A2/A3)

1. Header file → FPS, frame count, stage size (feeds animation timings).
2. Frame labels and timeline frames → state flow.
3. Main timeline scripts → startup, preloader, game flow.
4. Sprite scripts → per-element logic (tiles, buttons, timer, scoring).
5. Static text + dynamic text (DefineEditText) → visible strings and their
   variable bindings.
6. Bitmap usage (PlaceObject2 references) → where each bitmap appears.
7. Sound triggers (`ses_cikart` call sites; StartSound/stream) → event map.

## 5. Reference capture setup (hand-off to C3)

- The SWF must be served over HTTP (proven pattern: local static server; the
  game then requests `xml64.php?<number>` relative to itself).
- Fixture serving: place the archived round fixture as `xml64.php` next to the
  SWF (same directory) so the round is deterministic.
- Observed behavior **[CONFIRMED-OBSERVED]**: with the MochiAds endpoint
  unreachable, the build proceeds and requests `xml64.php` (verified in an
  earlier local run, request served with HTTP 200).
- Exact capture mechanics (Ruffle web embedding, Playwright) are specified in
  `docs/07-verification.md` §3 and implemented in C3/F1.

## 6. Verification (task A1)

- V1: reference SWF MD5 matches.
- V2: every expected export class exists and is non-empty; counts satisfy §3.
- V2: every exported sound passes `afinfo` (exit 0); every SVG parses
  (well-formed XML; no empty files).
- Evidence: `evidence/A1-export-manifest.md`, `evidence/logs/A1-*.log`.

## 7. Outputs

- `artifacts/decompiled/**` (not committed)
- `evidence/A1-*.md`
- Hand-off notes appended to `docs/02-mechanics-spec.md` and
  `docs/03-assets-and-visuals.md` **only** in their designated `[TBC]` slots,
  with evidence references.
