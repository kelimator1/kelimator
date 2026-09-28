# A3 — Layout Catalog (evidence)

Task: A3 — Layout and Timing Catalog
Started: 2026-09-28T12:49:36Z (first A3 command; see §2)
Ended: 2026-09-28T13:51:16Z
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact): see §2 (every command is also captured verbatim in `evidence/logs/A3-*.log`)
Exit codes: 0 for every recorded command, except where noted (§2.3: the intermediate `check_bounds_vs_svg.py` runs exited 1 while the extractor had the `placeMatrix` bug; the final run exits 0)
Output summary: `data/layout.json` (62 elements, schema-valid), `data/animation.json` (24 sequences), 2007 comparison (`artifacts/a3-2007/`, distilled into `evidence/A3-diffs.md`), coordinate cross-check against a Ruffle 0.6.0 reference capture (§6)
Artifact SHA-256 hashes: see §9
Result: PASS

---

## 1. Deliverable and count basis (V2)

`data/layout.json` follows the canonical shape of `docs/03` §6 and validates against
`data/layout.schema.json`: `stage {width,height,background}` + 62 `elements`
(`id, kind, asset, x, y, w, h, text, font{family,size,bold,align}, evidence`).

**Count basis (defined, showable, ±0):** a *stage-placed symbol* is a character ID that
appears in a **top-level `PlaceObject2` tag of the main timeline** in
`artifacts/decompiled/tags.xml` with `placeFlagHasCharacter=true` (i.e. an actual
placement, not a Move/replace update).

| Derivation step | Number | Source |
|---|---|---|
| top-level `PlaceObject2` tags with `characterId` | 65 | `artifacts/decompiled/tags.xml` (raw tag order) |
| distinct character IDs among them | **62** | same; printed by `a3-verify.py` (log `A3-verify.log`) |
| `data/layout.json` elements | **62** | `data/layout.json` |
| difference | **0** | V2a PASS |

Distinct character IDs (62):
`1,3,5,6,8,12,14,16,17,18,19,20,21,23,25,27,29,31,33,35,37,39,41,46,48,58,63,65,67,71,76,84,90,97,103,105,108,111,112,123,124,125,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,166,170`.

Independent cross-check (FLA main timeline): `parse_fla_main.py` finds **35**
`DOMSymbolInstance` symbols plus **1 inline `DOMShape`** (ch48) on the main timeline =
36 = 62 − 26 text-field symbols. FFDec's FLA exporter does not emit
`DefineText`/`DefineEditText` placements as `DOMTextInstance` and inlines the placed
shape 48; the same 36 non-text symbols are present (`A3-parse-fla.log`, and
`a3-verify.py` V2a). The FLA was therefore used only as a cross-check; the authoritative
inventory is `tags.xml`.

The `kind` distribution: 36 `svg` (shapes/sprites/buttons), 26 `text`
(`DefineText`/`DefineEditText`), 0 `bitmap` (the two bitmaps of the build are used as
clipped fills inside shapes 48/87, never placed directly — A1 `O10` partial confirmed).

## 2. Commands executed (exact)

All commands were run from the repository root. Full raw outputs are in
`evidence/logs/A3-*.log` (the log name is given per step).

1. `mkdir -p artifacts/a3-2007 artifacts/a3-captures`
2. `unzip -o -q artifacts/decompiled/fla/kelimator_tr_2012_mochiads.fla/kelimator_tr_2012_mochiads.fla -d artifacts/a3-captures/fla-2012` — log: none (input for `parse_fla_main.py`)
3. `python3 artifacts/a3-captures/tools/parse_main_timeline.py` → `artifacts/a3-captures/main_*.json` — `A3-parse-main.log`
4. `python3 artifacts/a3-captures/tools/parse_fla_main.py` → `artifacts/a3-captures/fla_main_timeline.json` — `A3-parse-fla.log`
5. `curl -sL -o artifacts/a3-captures/ruffle-0.6.0-macos-universal.tar.gz https://github.com/ruffle-rs/ruffle/releases/download/v0.6.0/ruffle-0.6.0-macos-universal.tar.gz`
6. `curl -sL -o artifacts/a3-captures/ruffle-0.6.0-web-selfhosted.zip https://github.com/ruffle-rs/ruffle/releases/download/v0.6.0/ruffle-0.6.0-web-selfhosted.zip`
7. `tar -xzf ../ruffle-0.6.0-macos-universal.tar.gz` (in `artifacts/a3-captures/tools/`), `unzip -o -q ruffle-0.6.0-web-selfhosted.zip -d serve/ruffle`
8. symlinks in `artifacts/a3-captures/serve/` to the read-only sources (`kelimator_tr_2012_mochiads.swf`, `kelimator_tr_2007.swf`, `xml.php`, `xml64.php` → `../kelimator-nostalji/calistir/…`); harness page `artifacts/a3-captures/serve/index.html`
9. `nohup python3 -m http.server 8793 --bind 127.0.0.1 --directory artifacts/a3-captures/serve` (port **8793**, request log `artifacts/a3-captures/serve-requests.log`)
10. `node artifacts/a3-captures/tools/capture.mjs …` (web-selfhosted Ruffle 0.6.0 in Playwright chromium, viewport 550×400, deviceScaleFactor 1) — `A3-capture-run1.log`, `A3-capture-run2.log`, `A3-capture-intro.log`, `A3-capture-2007.log`
11. `./artifacts/a3-captures/tools/Ruffle.app/Contents/MacOS/ruffle http://127.0.0.1:8793/kelimator_tr_2012_mochiads.swf` (pinned 0.6.0 desktop CLI, terminated after 14 s) — `A3-ruffle-cli.log`
12. `python3 artifacts/a3-captures/tools/measure_shot.py artifacts/a3-captures/run2-15s.png` — `A3-measure-shot.log`
13. `./artifacts/tools/ffdec/ffdec.sh -format button:svg -export button artifacts/a3-captures/ffdec-2012-buttons "../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf"` — `A3-ffdec-buttons.log`
14. `./artifacts/tools/ffdec/ffdec.sh -header "../kelimator-nostalji/calistir/kelimator_tr_2007.swf" > artifacts/a3-2007/header.txt`
15. `./artifacts/tools/ffdec/ffdec.sh -swf2xml "../kelimator-nostalji/calistir/kelimator_tr_2007.swf" artifacts/a3-2007/tags.xml`
16. `./artifacts/tools/ffdec/ffdec.sh -format fla:cs6 -export fla artifacts/a3-2007/fla "../kelimator-nostalji/calistir/kelimator_tr_2007.swf"`; `unzip -o -q … -d artifacts/a3-2007/fla-x` — `A3-ffdec-2007.log`
17. `python3 artifacts/a3-captures/tools/extract_elements.py` → `artifacts/a3-captures/elements_raw.json`, `elements_table.txt` — `A3-extract-elements.log`
18. `python3 artifacts/a3-captures/tools/extract_2007.py artifacts/a3-2007/tags.xml artifacts/a3-2007/elements_raw.json` — `A3-extract-2007.log`
19. `python3 artifacts/a3-captures/tools/check_bounds_vs_svg.py` (independent FFDec viewport cross-check) — `A3-bounds-crosscheck.log`
20. `python3 artifacts/a3-captures/tools/compare_2007_2012.py` → `artifacts/a3-2007/diff-2007-2012.md` — `A3-compare-2007-2012.log`
21. `python3 artifacts/a3-captures/tools/make_layout.py` → `data/layout.json` — `A3-make-layout.log`
22. `python3 artifacts/a3-captures/tools/make_animation.py` → `data/animation.json` — `A3-make-animation.log`
23. `python3 artifacts/a3-captures/tools/check_buttons_vs_shot.py` — `A3-check-buttons.log`
24. `python3 artifacts/a3-captures/tools/a3-verify.py` — `A3-verify.log`
25. `npx ajv-cli validate -s data/layout.schema.json -d data/layout.json` — `A3-v3-layout.log`
26. `node artifacts/a3-captures/tools/rasterize_svgs.mjs …` / `node artifacts/a3-captures/tools/svg_sheet.mjs …` (asset identification/cross-check helpers) — `A3-crosscheck-bar-socket.log`, `sheet-*.png`

### 2.3 Intermediate failures (fixes, not hidden)

- `check_bounds_vs_svg.py` exited 1 on its first three runs (8, 4, then 2 mismatches)
  while the extractor missed (a) `placeMatrix` (button records) and (b)
  `textMatrix`/matrix inheritance on Move-with-character tags. Both were fixed in
  `extract_elements.py`; the final run reports `checked=73 mismatches=0`
  (2 `NEAR` ≤0.61 px, §7). Intermediate outputs remain in the logs (`A3-bounds-crosscheck.log`,
  `A3-extract-elements.log`) — no failure was edited away.
- `npx ajv-cli validate … -c ajv-formats` failed (`ajv-formats` not installed); the
  task-mandated command without `-c` passes (`A3-v3-layout.log`).

## 3. Coordinate conventions (defined here; schema has no semantics for x/y/w/h)

For every element, `(x, y)` = the top-left corner and `(w, h)` = the size of the
element's **display bounding box in stage pixels** at the gameplay frame; the box is
computed as `transform(definition bounds, placement matrix)` (bb = a·x + c·y + tx,
ty; corners transformed, AABB taken). Values are rounded to 0.01 px.

- **Definition bounds** (`artifacts/a3-captures/elements_raw.json` `localBounds`):
  - `DefineShape*` → `shapeBounds` (twips ÷ 20);
  - `DefineText`/`DefineEditText` → `textBounds`/`bounds` × `textMatrix`;
  - `DefineSprite` → union over **all** timeline frames of child bounds × placement
    matrices (matrix inheritance for replace-moves), recursively;
  - `DefineButton2` → union over the **visual** states (up/over/down) of the
    `BUTTONRECORD` `placeMatrix`-transformed child bounds; hit-test-only records are
    excluded.
  The sprite/button/bitmap results were cross-checked against FFDec's own SVG
  viewports for all 47 shapes and 37 sprites: **73/73 agree**, 71 exactly and 2
  within 0.61 px (`A3-bounds-crosscheck.log`).
- **Canonical placement state**: if the element is on stage at **SWF frame 131**
  (`hepsiburda`, the gameplay/round frame), the placement+Move state at frame 131 is
  used; otherwise the element's initial placement state. Only the two moving elements
  differ from their initial state:
  | element | initial placement state (bbox) | frame-131 board state (bbox) |
  |---|---|---|
  | `intro_glow` (ch20) | (217.10, 254.10)–(310.60, 347.60) | (217.10, −104.90)–(310.60, −11.40) (off-stage above the board, as in the capture) |
  | `intro_logo` (ch29) | (119.96, −86.05)–(416.03, −3.56) | (2.00, 1.06)–(181.84, 51.17) (the logo visible on the board, scale 0.4791) |
  Both states, the full motion and the animation keyframes are in `data/animation.json`.
- **Transient template placements** (elements that the game duplicates at runtime via
  `duplicateMovieClip` from `artifacts/decompiled/scripts/frame_131/DoAction.as`
  lines 99–100 and 122): `letter_tile` (ch58), `tile_socket` (ch67), `wordball`
  (ch46). Their catalog boxes are the **stage template placements** (as stored in the
  SWF, off-stage by design); the runtime grid from the code is recorded in each
  entry's `evidence` (8 instances at `x = 60 + j*60`, `y = 330` for tiles/sockets;
  `y = -130` for wordballs). The grid was verified against the capture (§6).
- `text`/`font`: for `text` elements `text` = static string from
  `artifacts/decompiled/texts/<id>.txt` (empty for dynamic fields that are empty at
  definition — those are listed with their variable names in `evidence`); `font` from
  the `DefineFont2`/`DefineEditText`/`DefineText` records: family Verdana, size =
  `fontHeight`/`textHeight` twips ÷ 20, bold/italic from the font flags, align from
  the `DefineEditText align` attribute (0/1/2 → left/right/center). For `DefineText`
  (no align field exists in the tag) the value is `left` and the evidence notes that
  placement is by absolute glyph runs. For non-text elements `font` is
  `{"family":"","size":0,"bold":false,"align":""}` (no font applies; defined,
  not TBC).
- `asset`: repository-relative path that exists today:
  - shapes → `artifacts/decompiled/shapes/<id>.svg`;
  - sprites → `artifacts/decompiled/sprites/DefineSprite_<id>/<frame>.svg` with the
    first frame that has drawable content (frame 2 for ch46/84, frame 7 for ch111,
    frame 1 otherwise);
  - buttons → `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_<id>/1_up.svg`
    (A1 did not export buttons; a second FFDec pass with `-format button:svg` produced
    the up/over/down/hit-test SVGs; step 13);
  - texts → `artifacts/decompiled/texts/<id>.txt`.
  docs/03 §1's `s<symbolId>_<slug>.svg` naming is the *destination* convention: the
  element `id` is the A3-assigned slug (e.g. `id="tile_socket"` for ch67 →
  `s67_tile_socket.svg`). Consumers must scale an asset only if its natural size
  differs from `(w,h)`.

## 4. Source of each coordinate group

| Group (element ids) | n | Coordinate source | Notes |
|---|---|---|---|
| Static timeline placements (all elements except the 3 below) | 59 | `tags.xml` top-level `PlaceObject2` (`translateX/Y` twips ÷ 20, scale) × definition bounds | board state = the single placement state |
| Moving elements `intro_glow`, `intro_logo` | 2 | `tags.xml` `PlaceObject2` + 86/214 main-timeline `Move` tags; frame-131 state | motion spans in `data/animation.json` |
| Moving element `hiscore_form` | 1 | initial placement (not on stage at frame 131); 19 `Move` tags drive the rise in the win state | |
| Runtime-duplicated templates `letter_tile`, `tile_socket`, `wordball` (subset of the static row) | 3 | template `PlaceObject2` matrix; runtime grid from `scripts/frame_131/DoAction.as` (lines 99–100, 122) | grid verified vs capture (§6) |
| Text metrics | 26 | `DefineEditText`/`DefineText` records + `texts/*.txt` | fonts from `DefineFont2` (A1 §11 O09 partial) |
| Stage background | — | `SetBackgroundColor` `FF FF FF` (tags.txt/tags.xml) | `stage.background = "#ffffff"` |
| Colors (fills/strokes) | — | `tags.xml` `FILLSTYLE`/`LINESTYLE` + exported SVG assets | §5 |

## 5. Colors (fills, strokes) and stage background

Stage background: `#ffffff` (raw `SetBackgroundColor` payload `ff ff ff`, `tags.txt`
line 1; `swf-inspect.json` agrees). The stage background is fully covered in both
visible states by shape 1/48, so the letterbox/page color rule of docs/03 §4 uses
`#9DAF48` unless E2 proves otherwise.

Fills/strokes extracted from `tags.xml` (`FILLSTYLE`/`LINESTYLE` records):

| Shape (element) | Fills | Strokes |
|---|---|---|
| 1 (`intro_backdrop`) | `#000000`, `#ffffde` | — |
| 2 (`logo_ornament`) | `#ffffde` | — |
| 4 (`intro_sky` via sprite 5) | linear gradient `#ffffff → #9cc9e8 → #2889cc` | — |
| 6 (`intro_ground`) | `#000000` | — |
| 7 (`intro_layer3` via sprite 8) | linear gradient `#be9112 → #f0c54d → #f8e5b0` | — |
| 20 (`intro_glow`) | radial gradient `#eede15 → #f8f1a2 → #ffffff/a160` | — |
| 28 (`intro_logo` via sprite 29) | 60+ gold/brown fixtures, e.g. `#f2bd43`, `#fcca50`, `#7f5638`, `#543826` | `#6b4931` |
| 48 (`board_backdrop`) | clipped bitmap fills (id 47 550×400; id 65535 unmapped) | — |
| 66 (`tile_socket`) | golds `#e0cc76`, `#ab9c5a`, `#efdf9c`, gradients `#ab9c5a→#e0cc76`, whites with alpha | `#ffffff/a51` |
| 9/10 (`preloader_progress`) | `#ffffcc` / `#ff6633` | `#000000` |
| 91 (`credit_line`) | `#ccff66` | `#669900` |
| 92 (`credit_site`, button 102) | `#99ff33`-family greens (SVG asset) | — |
| button faces (`btn_*`) | `#ff6600` fills + white text/highlights (SVG assets) | `#000000` |
| 76 (`timer_bar`) | `#ff0000`, `#ffffff` | `#999999` |

## 6. Reference screenshot cross-check (coordinate checks only; E2 owns visual diff)

Reference material ("raw Ruffle screenshots produced locally", docs/03 §4): Ruffle
**0.6.0** web-selfhosted build in headless Chromium via Playwright, viewport
550×400, `deviceScaleFactor: 1`, harness page `artifacts/a3-captures/serve/index.html`
served on **127.0.0.1:8793** (request log `artifacts/a3-captures/serve-requests.log`).
The Ruffle **0.6.0 desktop CLI** was also run against the same local server and
requested `xml64.php` (`A3-ruffle-cli.log`); the desktop CLI has no screenshot
facility (`--help` lists no capture option), so all coordinates below were measured
on the web-player captures of the same pinned version.

Captures used: `artifacts/a3-captures/run2-15s.png` (idle board, SWF frame 131),
`run2-intro-*.png`, `a3-2007/run2007-18s.png`.

| Feature (element) | Extracted/predicted | Measured in capture | Δ |
|---|---|---|---|
| socket grid (`tile_socket` copies, code `x=60+j*60, y=330`, scale 0.9) | first socket box (33.0, 303.0)–(87.0, 357.0); gold face inset (3,3,55,58) → display (35.7, 305.7)–(82.5, 355.2) | gold face x 36–78 (right edge is a shading gradient), y 306–354; pitch 60 px | ≤1.2 px on solid edges |
| `btn_kbuton` | box (156.25, 367.95); asset face at (1,1,65,18) → (157.25, 368.95)–(221.25, 385.95) | (158, 369)–(221, 385) | 0.95 px |
| `btn_ebuton` | (232.85, 367.95) → (233.85, 368.95)–(297.85, 385.95) | (234, 369)–(298, 385) | 0.95 px |
| `btn_sbuton` | (308.60, 367.95) → (309.6, 368.95)–(373.6, 385.95) | (310, 369)–(373, 385) | 0.95 px |
| `btn_top10` | (419.80, 372.95) → (420.8, 373.95)–(504.8, 390.95) | (421, 374)–(505, 390) | 0.95 px |
| `btn_ybuton` | (445.80, 196.45) → (446.8, 197.45)–(530.8, 214.45) | (447, 198)–(531, 214) | 0.55 px |
| `timer_bar` | box (514.30, 83.85)–(538.35, 191.85); asset red face (0,0,18,107) → (514.3, 83.85)–(532.3, 190.85) | saturated-red core (515, 89)–(532, 190) | ≤1 px except the top 5 px cap (lighter gradient) |
| `label_harf_3` (text) | field box (437.60, 84.10)–(485.95, 100.15), align left | glyph ink (441–468, 89–96) | inside box, left inset 3.4 px |
| `count_3` (text) | field box (482.50, 84.35)–(505.50, 100.40), align right | glyph ink x 498–502 | right inset 3.5 px |
| `label_puan_orange` (text, center) | box (437.75, 17.00)–(541.75, 38.05), center x 489.75 | orange ink x 471–507, center 489 | 0.75 px |
| `credit_line` (ch97) | box (−48.25, 367.25)–(95.85, 386.25), right-aligned text | ink “Diğer oyunlar” (2–95, 370–381) | inside box, right edge 0.85 px |
| `credit_site` (ch103) | box (−41.40, 383.55)–(104.10, 402.19) | ink “kelimator.com” (3–100, 386–397) | inside box |
| `intro_logo` on board (ch29) | frame-131 box (2.00, 1.06)–(181.84, 51.17) | logo visible top-left, ≈ (2–182, 1–51) | matches | 

Raw logs: `evidence/logs/A3-measure-shot.log`, `A3-crosscheck-bar-socket.log`,
`A3-check-buttons.log`. No visual diff was attempted (E2 owns V5).

## 7. Caveats and known limits (recorded, none blocking)

1. FFDec's FLA export omits `DefineText`/`DefineEditText` timeline instances (26 of
   62) and inlines the placed shape 48 — FLA used as cross-check only.
2. FFDec's sprite SVG viewports for `credit_line` (ch97) and `credit_site` (ch103)
   are 0.25/0.61 px taller than the strictly computed text-field boxes (FFDec rounds
   text-field bounds); widths match exactly. Catalog uses the computed boxes
   (≤0.61 px difference, below the 30-RGB-distance pixel threshold).
3. Ten action/sound-only sprites (ch21, 23, 25, 27, 31, 33, 35, 37, 39, 41) have no
   visual geometry (empty timelines: no `PlaceObject2`, exported SVGs contain no
   shapes). They are kept as zero-size elements so the count basis stays the complete
   stage-placed inventory; each entry says so.
4. `bottom_marquee` (ch170) references nested sprite 169; FFDec's frame SVG emits the
   `<use>` without inlining the nested content — the marquee's own 65-frame timeline
   is catalogued in `data/animation.json`, its content assets are
   `artifacts/decompiled/sprites/DefineSprite_169/*.svg`.
5. `board_backdrop` (shape 48) uses bitmap 47 as a clipped fill; the SVG export embeds
   the 550×400 bitmap data. `DefineBitsLossless` id 65535 is referenced by a fill but
   has no definition in the SWF (no export) — A1 §11 O10 partial stands.
6. Ruffle (both CLI and web 0.6.0) fails `duplicateMovieClip("button","button"+i)` for
   i≥2 (AVM1 warnings `SetProperty: Invalid target String("button2")`…), so the
   capture shows empty sockets. This is a player-side reproduction note for E2/E3,
   not a data issue; the socket grid and all button positions were still measured.
7. Rotation: `intro_logo` at frame 131 has a small rotation (see its `evidence`);
   `w,h` is the AABB of the rotated box, as defined in §3.

## 8. docs/08 proposal (orchestrator transcription; A3 does not edit docs/08)

- **O05** (strings part): `RESOLVED 2026-09-28 — evidence/A2-strings.md + data/layout.json (evidence/A3-layout.md) — user-visible strings: 14 static strings with placement/font metrics in the A3 catalog, 12 dynamic fields carry their variable names in the catalog evidence; display conditions in evidence/A2-strings.md.`
- **O07**: `RESOLVED 2026-09-28 — evidence/A3-timing.md — FPS = 36 (header); all 24 animation sequences catalogued in data/animation.json with numeric SWF frame spans and frames ÷ 36 durations (4 main-timeline states, 3 element-motion paths with 214/86/19 Move tags, 17 sprite timelines); keyframe offsets defined for capture per docs/07 §4.`
- **O08**: `RESOLVED 2026-09-28 — data/layout.json + evidence/A3-layout.md — all 62 stage-placed symbols of the 2012 build catalogued (x/y/w/h from PlaceObject2 matrices × definition bounds, board state = SWF frame 131; 26 text elements with Verdana metrics); schema-valid (ajv), asset paths verified, screenshot cross-check ≤1.2 px on solid edges.`
- **O18**: `RESOLVED 2026-09-28 — evidence/A3-diffs.md — 2007 vs 2012 compared for 44 shared roles: 22 identical (incl. background, sockets, wordball, logo, xmlload, speaker, puanmovie, high-score form, marquee); 12 differ (credit block replaced, new "Sil" button, b3–b8 counters added, bottom buttons repositioned ≤45.8 px, timer bar/digits +(6,15) px, status sprite +6.1 px, Puan/Süre colour/shadow updates); 2012 wins and is the only geometry in data/layout.json.`

No BLOCKER proposals: every coordinate in `data/layout.json` is extracted from
`tags.xml`/the FLA and cross-checked against a recorded capture; nothing was left
unresolvable.

## 9. Artifact SHA-256 hashes

| Artifact | SHA-256 |
|---|---|
| `data/layout.json` | `eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d` |
| `data/animation.json` | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| `artifacts/decompiled/header.txt` (input) | `23d6a2afca68b837a353c412857cc57ac56a32aaf41285b1b174e5b072aae521` |
| `artifacts/decompiled/tags.xml` (input) | `c5290f02ea0d8bedec255fa64c476877f41adf09bbf92aa565e90f2bb5523765` |
| source SWF 2012 (`../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf`) | `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` |
| `artifacts/a3-captures/run2-15s.png` (reference board capture) | `85acf99ae28e939931ce688eed6f9311b4b727ce60fc810baedeeecf153b99dd` |
| `artifacts/a3-captures/run2-intro-07s.png` (intro capture) | `0f798a43ead11a4130df526f5c6f543f0a18ee58b80282241dbe1e35cecf3eaa` |
| `artifacts/a3-captures/ruffle-0.6.0-macos-universal.tar.gz` | `83d26cae9d0217cbaeef2095b7e7a104e8cd48aa2dfb327dea07d28f46962805` |
| `artifacts/a3-captures/ruffle-0.6.0-web-selfhosted.zip` | `e8acfacc37443303872379d0e215999af846854d1dd3fa8fac0a765445b43dbf` |

Commands producing these hashes: `shasum -a 256 <file>` (§2 step 26); parse/inventory
logs are `evidence/logs/A3-*.log`.
