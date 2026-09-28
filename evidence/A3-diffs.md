# A3 — 2007 vs 2012 geometry comparison (evidence)

Task: A3 — Layout and Timing Catalog
Started: 2026-09-28T12:49:36Z
Ended: 2026-09-28T13:51:16Z
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact):
  ./artifacts/tools/ffdec/ffdec.sh -header "../kelimator-nostalji/calistir/kelimator_tr_2007.swf" > artifacts/a3-2007/header.txt
  ./artifacts/tools/ffdec/ffdec.sh -swf2xml "../kelimator-nostalji/calistir/kelimator_tr_2007.swf" artifacts/a3-2007/tags.xml
  ./artifacts/tools/ffdec/ffdec.sh -format fla:cs6 -export fla artifacts/a3-2007/fla "../kelimator-nostalji/calistir/kelimator_tr_2007.swf"
  unzip -o -q artifacts/a3-2007/fla/kelimator_tr_2007.fla -d artifacts/a3-2007/fla-x
  python3 artifacts/a3-captures/tools/extract_2007.py artifacts/a3-2007/tags.xml artifacts/a3-2007/elements_raw.json 130
  python3 artifacts/a3-captures/tools/compare_2007_2012.py
Exit codes: 0 for all (raw: evidence/logs/A3-ffdec-2007.log, A3-extract-2007.log, A3-compare-2007-2012.log)
Output summary: 44 matched roles compared; 22 identical, 12 differ, 10 non-visual (sound-clip) pairs; 2012-only additions listed; raw table artifacts/a3-2007/diff-2007-2012.md
Artifact SHA-256 hashes: 2007 source SWF 665c2489765782303c355c64e92f09372ef0a9e89fdf88fd7f990cd15eb50473; artifacts/a3-2007/tags.xml 16ea9a45a05469ded7d13054cbab28b8b85e6cf442246870ab2d8a7e4a71fe57; 2007 board capture artifacts/a3-captures/a3-2007/run2007-18s.png 44779892e2a0ac9ac9f5785660ff164c2af90ceb7a8d3d2152e4a8b9e1819bbf; data files per evidence/A3-layout.md §9
Result: PASS

---

## 1. Method

- Exports (serialized FFDec 26.3.0 passes, raw under `artifacts/a3-2007/`, all scratch):
  header (240 frames, 36 fps, 550×400), `-swf2xml` tag structure, FLA (unzipped to
  `artifacts/a3-2007/fla-x`).
- Source verification: 2007 SWF md5 `54f794c3c70fd8ce123e46cca8e0d39f`, sha256
  `665c2489765782303c355c64e92f09372ef0a9e89fdf88fd7f990cd15eb50473`; 2012 SWF
  md5 `af059ff9d75cefbc244f03814b47be9c` / sha256
  `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` (A1 verified).
- The same extraction algorithm (A3 scratch tools) was run on both builds;
  bounding rectangles are display bboxes at each build's gameplay frame
  (2012: SWF frame 131 `hepsiburda`; 2007: SWF frame 130 `hepsiburda` — the 2007
  build has 240 frames and one frame less of intro), falling back to the initial
  placement state for elements not on stage there.
- Matching: SWF instance name first (`timerr`, `enter`, `shuffle`, `countdown`,
  `boing`, `fanfare`, `finishsound`, `typer`, `backspace`, `buzz`, `wordball`,
  `button`, `kbuton`, `ebuton`, `bosbuton`, `ybuton`, `xmlload`, `spk_btn`,
  `puanmovie`, `status`), then same-character-id (1, 3, 5, 6, 8, 12, 14, 46, 48, 58),
  then role (glow ball, falling logo, red bar, Top10 button, timer digits field,
  credits, high-score form, marquee, found-word template, score field, labels).
- **2012 wins in all conflicts** (plan rule); the catalog `data/layout.json` uses
  the 2012 values only.

## 2. Generated comparison table

Bounding rectangles are display bboxes at each build's gameplay frame (2012: SWF frame 131 'hepsiburda'; 2007: SWF frame 130 'hepsiburda'), falling back to the initial placement state for elements not on stage there. px.

| role (2012 ch) | match basis | 2012 bbox (x0,y0,x1,y1) | 2007 bbox | Δx0 | Δy0 | Δw | Δh | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | same chid; full-stage intro background shape | (-0.85, 0.25, 550.95, 400.35) | (-0.85, 0.25, 550.95, 400.35) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 3 | same chid; logo ornament | (50.00, 37.00, 87.50, 87.00) | (50.00, 37.00, 87.50, 87.00) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 5 | same chid; intro sky layer | (-0.85, 0.20, 550.20, 240.70) | (-0.85, 0.20, 550.20, 240.70) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 6 | same chid; intro ground layer | (-0.85, 240.70, 550.95, 400.35) | (-0.85, 240.70, 550.95, 400.35) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 8 | same chid; intro layer-3 shape | (-0.90, 240.70, 549.70, 400.30) | (-0.90, 240.70, 549.70, 400.30) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 12 | same chid; preloader progress bar | (169.30, 176.85, 370.40, 182.85) | (169.30, 176.85, 370.40, 182.85) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 14 | same chid; preloader percent field | (380.95, 171.95, 419.95, 186.90) | (380.95, 171.95, 419.95, 186.90) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 16 | preloader static glyph (2012 ch16 / 2007 ch15) | (370.60, 176.25, 387.55, 183.15) | (370.60, 173.95, 385.35, 183.15) | +0.00 | +2.30 | +2.20 | -2.30 | DIFFERS |
| 17 | preloader field (2012 ch17 / 2007 ch16) | (233.45, 185.55, 272.45, 200.50) | (233.45, 185.55, 272.45, 200.50) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 18 | preloader field (2012 ch18 / 2007 ch17) | (278.45, 185.55, 317.45, 200.50) | (278.45, 185.55, 317.45, 200.50) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 19 | preloader static glyph (2012 ch19 / 2007 ch18) | (273.10, 189.75, 285.25, 197.95) | (273.80, 187.55, 283.40, 198.00) | -0.70 | +2.20 | +2.55 | -2.25 | DIFFERS |
| 20 | intro glow ball (2012 ch20 / 2007 ch19) | (217.10, -104.90, 310.60, -11.40) | (217.10, -104.90, 310.60, -11.40) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 21 | name 'timerr' | — | — | | | | | both non-visual / equal span |
| 23 | name 'enter' | — | — | | | | | both non-visual / equal span |
| 25 | name 'shuffle' | — | — | | | | | both non-visual / equal span |
| 27 | name 'countdown' | — | — | | | | | both non-visual / equal span |
| 29 | intro falling logo (2012 ch29 / 2007 ch28) | (2.00, 1.06, 181.84, 51.17) | (2.00, 1.06, 181.84, 51.17) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 31 | name 'boing' | — | — | | | | | both non-visual / equal span |
| 33 | name 'fanfare' | — | — | | | | | both non-visual / equal span |
| 35 | name 'finishsound' | — | — | | | | | both non-visual / equal span |
| 37 | name 'typer' | — | — | | | | | both non-visual / equal span |
| 39 | name 'backspace' | — | — | | | | | both non-visual / equal span |
| 41 | name 'buzz' | — | — | | | | | both non-visual / equal span |
| 46 | name 'wordball' | (701.85, 166.85, 751.85, 386.85) | (701.85, 166.85, 751.85, 386.85) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 48 | same chid; board state background shape | (0.45, 0.00, 550.45, 400.00) | (0.45, 0.00, 550.45, 400.00) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 58 | name 'button' (letter tile) | (694.17, -9.26, 812.22, 73.00) | (694.17, -9.26, 812.22, 73.00) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 63 | name 'kbuton' | (156.25, 367.95, 232.35, 389.65) | (150.67, 368.35, 250.07, 388.30) | +5.58 | -0.40 | -23.30 | +1.75 | DIFFERS |
| 65 | name 'ebuton' | (232.85, 367.95, 302.15, 389.65) | (278.62, 369.35, 378.02, 389.30) | -45.77 | -1.40 | -30.10 | +1.75 | DIFFERS |
| 67 | name 'bosbuton' (socket) | (690.40, 80.35, 744.40, 134.35) | (690.40, 80.35, 744.40, 134.35) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 71 | name 'ybuton' | (445.80, 196.45, 544.10, 218.15) | (440.62, 198.35, 540.02, 218.30) | +5.18 | -1.90 | -1.10 | +1.75 | DIFFERS |
| 76 | timer red bar (2012 ch76 / 2007 ch73) | (514.30, 83.85, 538.35, 191.85) | (508.30, 68.85, 532.35, 176.85) | +6.00 | +15.00 | +0.00 | +0.00 | DIFFERS |
| 84 | name 'xmlload' | (107.55, 88.50, 419.45, 198.50) | (107.55, 88.50, 419.45, 198.50) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 90 | name 'spk_btn' | (513.99, 364.74, 547.53, 398.83) | (513.99, 364.74, 547.53, 398.83) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 97 | bottom-left credit line 1 (2012 'Diğer oyunlar' / 2007 'levent@lg.web.tr') | (-48.25, 367.25, 95.85, 386.25) | (-26.15, 379.85, 119.35, 401.00) | -22.10 | -12.60 | -1.40 | -2.15 | DIFFERS |
| 108 | Top10 button (2012 ch108 / 2007 ch96, no name in either) | (419.80, 372.95, 509.25, 394.65) | (410.62, 371.35, 510.02, 391.30) | +9.18 | +1.60 | -9.95 | +1.75 | DIFFERS |
| 111 | name 'puanmovie' | (213.50, 96.88, 306.50, 264.40) | (213.50, 96.88, 306.50, 264.40) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 112 | timer digits field (2012 ch112 / 2007 ch101) | (513.00, 130.50, 534.00, 146.65) | (507.00, 115.50, 528.00, 131.65) | +6.00 | +15.00 | +0.00 | +0.00 | DIFFERS |
| 124 | found-word template field (role match: var 'kelime', identical bbox) | (694.85, 323.75, 1032.80, 368.75) | (694.85, 323.75, 1032.80, 368.75) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 125 | score value field (role match: var 'puan'; 2007 colour #ff6600 vs 2012 #000000) | (455.95, 39.90, 527.95, 60.95) | (455.95, 39.90, 527.95, 60.95) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 127 | 'Puan' label (role match; 2012 adds the black shadow copy ch128) | (438.45, 17.40, 542.45, 38.45) | (437.95, 17.90, 541.95, 38.95) | +0.50 | -0.50 | +0.00 | +0.00 | DIFFERS |
| 143 | 'Kelime' label (role match; 2012 adds ch144 and moves the label up) | (436.75, 63.40, 494.60, 84.45) | (445.95, 112.90, 501.95, 135.00) | -9.20 | -49.50 | +1.85 | -1.05 | DIFFERS |
| 123 | name 'status' | (447.37, 238.45, 554.38, 273.25) | (447.37, 238.45, 548.28, 273.25) | +0.00 | +0.00 | +6.10 | +0.00 | DIFFERS |
| 166 | high-score form (2012 ch166 / 2007 ch140) | (114.90, 368.85, 426.80, 537.85) | (114.90, 368.85, 426.80, 537.85) | +0.00 | +0.00 | +0.00 | +0.00 | identical |
| 170 | bottom marquee (2012 ch170 / 2007 ch144) | (-441.75, -2.68, 9.50, 12.38) | (-441.75, -2.68, 9.50, 12.38) | +0.00 | +0.00 | +0.00 | +0.00 | identical |

## 2012-only stage-placed symbols

| ch | type | name | bbox |
|---|---|---|---|
| 103 | DefineSpriteTag |  | (-41.40, 383.55, 104.10, 402.19) |
| 105 | DefineButton2Tag | sbuton | (308.60, 367.95, 377.90, 389.65) |
| 128 | DefineEditTextTag |  | (437.75, 17.00, 541.75, 38.05) |
| 129 | DefineEditTextTag |  | (500.75, 63.40, 541.15, 84.45) |
| 130 | DefineEditTextTag |  | (500.25, 62.90, 540.75, 83.95) |
| 131 | DefineEditTextTag |  | (437.60, 84.10, 485.95, 100.15) |
| 132 | DefineEditTextTag |  | (437.60, 175.60, 485.95, 191.65) |
| 133 | DefineEditTextTag |  | (437.60, 102.40, 485.95, 118.45) |
| 134 | DefineEditTextTag |  | (437.60, 120.70, 485.95, 136.75) |
| 135 | DefineEditTextTag |  | (437.60, 139.00, 485.95, 155.05) |
| 136 | DefineEditTextTag |  | (437.60, 157.30, 485.95, 173.35) |
| 137 | DefineEditTextTag |  | (482.50, 84.35, 505.50, 100.40) |
| 138 | DefineEditTextTag |  | (482.50, 175.85, 505.50, 191.90) |
| 139 | DefineEditTextTag |  | (482.50, 102.65, 505.50, 118.70) |
| 140 | DefineEditTextTag |  | (482.50, 120.95, 505.50, 137.00) |
| 141 | DefineEditTextTag |  | (482.50, 139.25, 505.50, 155.30) |
| 142 | DefineEditTextTag |  | (482.50, 157.55, 505.50, 173.60) |
| 144 | DefineEditTextTag |  | (436.25, 62.90, 494.25, 83.95) |

## 2007-only stage-placed symbols

| ch | type | name | bbox |
|---|---|---|---|

## 3. Summary of differences (12 non-identical roles)

| # | What changed 2007 → 2012 | Δb (px) |
|---|---|---|
| 1 | `intro` preloader glyphs 15→16 (`%`) and 18→19 (`/`): 2.2–2.3 px vertical shift, +2.2–2.6 px width | ≤2.6 |
| 2 | `kbuton` ("Karıştır"): moved right 5.6 px, 23.3 px narrower | ≤23.3 |
| 3 | `ebuton` ("Ekle"): moved left 45.8 px, 30.1 px narrower | ≤45.8 |
| 4 | `ybuton` ("Yeni Oyun"): moved right 5.2 px, 1.9 px up, 1.1 px narrower | ≤5.2 |
| 5 | Top10 button: moved right 9.2 px, 10.0 px narrower | ≤10.0 |
| 6 | red timer bar: shifted right 6 px / down 15 px (same size) | 16.2 |
| 7 | timer digits field: follows the bar (+6/+15 px) | 16.2 |
| 8 | bottom-left credit: 2007 "levent@lg.web.tr" (ch94) replaced by 2012 "Diğer oyunlar" (ch97) + "kelimator.com" (ch103); both text sprites moved/shrunk | ≤22.4 |
| 9 | `status` sprite: same origin, 6.1 px wider on the right | 6.1 |
| 10 | "Puan" label: 0.5 px offset; 2012 adds a black shadow copy (ch128) | 0.7 |
| 11 | "Kelime" label: moved up 49.5 px (2007 y 112.9; 2012 y 63.4), 1.85 px wider | 49.5 |
| 12 | score value field (`puan`): same box, colour changed #ff6600 (2007) → #000000 (2012) | colour |

2012-only stage-placed symbols (18): `sbuton` ("Sil" button, ch105) and the
"kelimator.com" line (ch103) are new; ch128/129/130 are black shadow copies of the
`Puan`/`Süre`/`Süre` labels; ch131–136 are six "N harfli:" labels and ch137–142 are
the `b3…b8` word counters (the 2007 build has **no** `b3…b8` editable fields at all —
verified against `artifacts/a3-2007/tags.xml`); ch144 is the second (`Kelime`) label
copy. No 2007-only stage-placed symbol remains unmatched after the role matches.

Everything else is byte-identical in geometry: full-stage intro background,
logo ornament, sky/ground/layer-3, progress bar, preloader percent field and fields
16/17 (2012 ids), glow ball, falling logo, all 10 sound clips' placement spans,
wordball, board backdrop (shape 48), letter tile (ch58), socket (ch67), xmlload,
speaker button, puanmovie, high-score form (ch166/ch140) and bottom marquee
(ch170/ch144) — identical bounding boxes.

## 4. Conclusion (O18)

The 2012 build is a rebuild of the 2007 layout with a redesigned bottom-left credit
block, a new "Sil" button, an added per-length counter column, revised button
positions/sizes in the bottom bar, the right-panel timer bar + timer field moved
down/right by (6, 15) px, a wider status sprite, and colour/shadow updates to the
`Puan`/`Süre`/`Kelime` labels. Per plan rule, **the 2012 geometry wins** and is what
`data/layout.json` and `data/animation.json` contain. No layout decision in this task
uses 2007 values except as comparison evidence.

## 5. References

- Raw generated table: `artifacts/a3-2007/diff-2007-2012.md` (uncommitted scratch;
  reproduced by `compare_2007_2012.py`).
- Raw 2007 extraction: `artifacts/a3-2007/elements_raw.json`, `elements_table.txt`.
- Raw logs: `evidence/logs/A3-ffdec-2007.log`, `A3-extract-2007.log`,
  `A3-compare-2007-2012.log`, `A3-capture-2007.log`.
- 2007 board capture used for visual orientation only (no measurement):
  `artifacts/a3-captures/a3-2007/run2007-18s.png` (Ruffle 0.6.0, same harness).

## 6. docs/08 proposal (O18)

```
RESOLVED 2026-09-28 — evidence/A3-diffs.md — 2007 vs 2012 compared for 44 shared roles: 22 identical (incl. background, sockets, wordball, logo, xmlload, speaker, puanmovie, high-score form, marquee); 12 differ (credit block replaced, new "Sil" button, b3–b8 counters added, bottom buttons repositioned ≤45.8 px, timer bar/digits +(6,15) px, status sprite +6.1 px, Puan/Süre colour/shadow updates); 2012 wins and is the only geometry in data/layout.json.
```

## 7. SHA-256

| Artifact | SHA-256 |
|---|---|
| 2007 source SWF | `665c2489765782303c355c64e92f09372ef0a9e89fdf88fd7f990cd15eb50473` |
| 2012 source SWF | `236ed9359719d061c4c9426c8533b126bffcb3466f7b5f818601b50bd7afbf39` |
| `artifacts/a3-2007/tags.xml` | `16ea9a45a05469ded7d13054cbab28b8b85e6cf442246870ab2d8a7e4a71fe57` |
| `artifacts/a3-2007/header.txt` | `f60ac55169ec0684239d42ac21452d53b999be89dfec9ecaf7cbbbc200ce607f` |
| `artifacts/a3-captures/a3-2007/run2007-18s.png` | `44779892e2a0ac9ac9f5785660ff164c2af90ceb7a8d3d2152e4a8b9e1819bbf` |
