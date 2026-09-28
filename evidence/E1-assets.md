# E1 — Asset Integration (evidence)

Task: E1 — Asset Integration
Started: 2026-09-28T13:57:26Z (first E1 command, baseline `npm run build`; §2)
Ended: 2026-09-28T14:09:44Z
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact): §2 and §10 (raw outputs in `evidence/logs/E1-*.log`)
Exit codes: 0 for every required command. One intermediate run failed and was fixed in scope:
`npm run lint` exited 1 on three `no-undef` errors for browser-context globals inside
`page.evaluate` callbacks in `tools/process-assets.mjs` (document/requestAnimationFrame);
fixed with an in-file `/* global ... */` directive — same dual-environment pattern as C3 —
the re-run exits 0 (`E1-v4-lint.log`). No other failure occurred; nothing was edited away.
Output summary: `tools/process-assets.mjs` (SVGO/img/sfx/text/layout/manifest pipeline),
36 SVGs optimized with zero pixel difference, 2 bitmaps as-is, 9 sounds hash-verified,
26 text-catalog copies, runtime `src/data/layout.json` + `src/data/animation.json`,
`src/assets/manifest.json` (73 assets), `tests/assets.test.mjs` (8 tests).
Artifact SHA-256 hashes: §9
Result: PASS

---

## 1. Deliverables and counts

| Deliverable | Count | Location |
|---|---|---|
| Optimized SVGs (`s<symbolId>_<slug>.svg`) | 36 | `src/assets/svg/` |
| Bitmap copies (`img_<id>_<w>x<h>.png`, as-is) | 2 | `src/assets/img/` |
| Sound copies (D4 names, hash-verified, untouched) | 9 | `src/assets/sfx/` |
| Text-catalog copies (`<symbolId>.txt`) | 26 | `src/assets/text/` |
| Runtime layout catalog (asset refs rewritten) | 62 elements | `src/data/layout.json` |
| Runtime animation catalog (byte copy) | 24 sequences | `src/data/animation.json` |
| Asset manifest (name → sha256 → source) | 73 entries | `src/assets/manifest.json` |
| Manifest coverage test | 8 tests | `tests/assets.test.mjs` |

Unique SVG assets = 36 (layout has 36 `kind:svg` elements, 1:1 with 36 distinct artifact
paths; checked: no shared asset among elements). Text assets = 26, sounds = 9 (A2 sound map).

## 2. Commands executed (exact) and exit codes

All commands were run from the repository root; `> log 2>&1` writes the raw output shown.

| # | Command (exact) | Exit | Log |
|---|---|---|---|
| 1 | `mkdir -p evidence/logs evidence/visual/E1-svgo` | 0 | — |
| 2 | `npm run build > evidence/logs/E1-baseline-build.log 2>&1` | 0 | baseline build |
| 3 | `npm test > evidence/logs/E1-baseline-test.log 2>&1` | 0 (47/47) | baseline test |
| 4 | `npm run lint > evidence/logs/E1-baseline-lint.log 2>&1` | 0 | baseline lint |
| 5 | `npm install --save-dev --save-exact svgo > evidence/logs/E1-install-svgo.log 2>&1` | 0 | install |
| 6 | `node --input-type=module -e "import { VERSION } from 'svgo'; console.log('svgo VERSION:', VERSION);" \| tee evidence/logs/E1-svgo-version.log` | 0 | version |
| 7 | `npm audit 2>&1 \| head -30 > evidence/logs/E1-npm-audit.log` | 0 | audit note §11.4 |
| 8 | `npm run build > evidence/logs/E1-postinstall-build.log 2>&1` | 0 | post-install C1 set |
| 9 | `npm test > evidence/logs/E1-postinstall-test.log 2>&1` | 0 (47/47) | post-install C1 set |
| 10 | `npm run lint > evidence/logs/E1-postinstall-lint.log 2>&1` | 0 | post-install C1 set |
| 11 | `node tools/process-assets.mjs all > evidence/logs/E1-process-assets-all.log 2>&1` | 0 | full pipeline (final rerun) |
| 12 | `node tools/process-assets.mjs svg` / `img` / `sfx` / `text` / `layout` / `manifest` | 0 each | `E1-svg-process.log`, `E1-img-process.log`, `E1-sfx-process.log`, `E1-text-process.log`, `E1-layout-process.log`, `E1-manifest-process.log` |
| 13 | `npm test -- assets > evidence/logs/E1-test-assets.log 2>&1` | 0 (8/8) | V4 assets filter |
| 14 | `npm test > evidence/logs/E1-v4-test-full.log 2>&1` | 0 (55/55) | V4 full suite |
| 15 | `npm run lint > evidence/logs/E1-v4-lint.log 2>&1` | 0 | V4 lint |
| 16 | `npm run build > evidence/logs/E1-v4-build.log 2>&1` | 0 | V4 build |
| 17 | `npx ajv-cli validate -s data/layout.schema.json -d src/data/layout.json > evidence/logs/E1-v3-layout-schema.log 2>&1` | 0 | runtime layout schema |

V2/V1/V5 verification commands are listed verbatim in §10. Baseline (2–4) and post-install
(8–10) runs establish that the only dependency change is the pinned `svgo` addition.

## 3. SVGO version and configuration

| Item | Value | Evidence |
|---|---|---|
| Version | **4.1.0** (`package.json`: `"svgo": "4.1.0"`, no range) | `E1-svgo-version.log`, §9 hashes |
| Install command | `npm install --save-dev --save-exact svgo` | `E1-install-svgo.log` |
| Config | `preset-default` with geometry/reference-affecting plugins disabled | `tools/process-assets.mjs` `SVGO_DISABLED_OVERRIDES` |
| Disabled overrides | cleanupIds, cleanupNumericValues, convertShapeToPath, convertEllipseToCircle, moveElemsAttrsToGroup, moveGroupAttrsToElems, collapseGroups, convertPathData, convertTransform, mergePaths, removeUselessStrokeAndFill | same |

Decision: docs/03 §1 requires SVGO optimization with **no geometry edits** and E1's pass
rule is zero mismatched pixels. The disabled plugins are exactly those that can move
coordinates, rewrite path/transform data, drop referenced ids, or drop paint attributes.
Everything else (proc-inst removal, metadata/ffdec-attribute removal, namespace clean-up,
attribute sorting, empty-container removal, id-unused defs removal) stays enabled.
Result: byte reduction on all 36 files with 0 mismatched pixels (§4).

## 4. SVG processing results (per asset)

Before = `artifacts/decompiled/**` or `artifacts/a3-captures/ffdec-2012-buttons/**` source;
After = committed `src/assets/svg/<name>`. Each pair was rendered in isolation (muted
Chromium, `--mute-audio`, fixed intrinsic-size viewport, `deviceScaleFactor: 1`) and
pixel-diffed with `node verify/diff/diff.mjs <before> <after> <outdir>`; pass =
`mismatchedPixels === 0`. `ink` = non-white pixels in the render (non-vacuity record).

| Name | Element | Source | Bytes before → after | Rendered ink px | Mismatched px | Evidence |
|---|---|---|---|---|---|---|
| s1_intro_backdrop.svg | intro_backdrop | artifacts/decompiled/shapes/1.svg | 1662 → 1503 | 220800 | 0 | evidence/visual/E1-svgo/s1_intro_backdrop/ |
| s3_logo_ornament.svg | logo_ornament | artifacts/decompiled/sprites/DefineSprite_3/1.svg | 833 → 728 | 775 | 0 | evidence/visual/E1-svgo/s3_logo_ornament/ |
| s5_intro_sky.svg | intro_sky | artifacts/decompiled/sprites/DefineSprite_5/1.svg | 1009 → 870 | 132655 | 0 | evidence/visual/E1-svgo/s5_intro_sky/ |
| s6_intro_ground.svg | intro_ground | artifacts/decompiled/shapes/6.svg | 456 → 316 | 88320 | 0 | evidence/visual/E1-svgo/s6_intro_ground/ |
| s8_intro_layer3.svg | intro_layer3 | artifacts/decompiled/sprites/DefineSprite_8/1.svg | 991 → 855 | 88160 | 0 | evidence/visual/E1-svgo/s8_intro_layer3/ |
| s12_preloader_progress.svg | preloader_progress | artifacts/decompiled/sprites/DefineSprite_12/1.svg | 1412 → 1228 | 1206 | 0 | evidence/visual/E1-svgo/s12_preloader_progress/ |
| s20_intro_glow.svg | intro_glow | artifacts/decompiled/shapes/20.svg | 972 → 807 | 6785 | 0 | evidence/visual/E1-svgo/s20_intro_glow/ |
| s21_clip_timerr.svg | clip_timerr | artifacts/decompiled/sprites/DefineSprite_21/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s21_clip_timerr/ |
| s23_clip_enter.svg | clip_enter | artifacts/decompiled/sprites/DefineSprite_23/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s23_clip_enter/ |
| s25_clip_shuffle.svg | clip_shuffle | artifacts/decompiled/sprites/DefineSprite_25/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s25_clip_shuffle/ |
| s27_clip_countdown.svg | clip_countdown | artifacts/decompiled/sprites/DefineSprite_27/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s27_clip_countdown/ |
| s29_intro_logo.svg | intro_logo | artifacts/decompiled/sprites/DefineSprite_29/1.svg | 17464 → 16134 | 20213 | 0 | evidence/visual/E1-svgo/s29_intro_logo/ |
| s31_clip_boing.svg | clip_boing | artifacts/decompiled/sprites/DefineSprite_31/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s31_clip_boing/ |
| s33_clip_fanfare.svg | clip_fanfare | artifacts/decompiled/sprites/DefineSprite_33/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s33_clip_fanfare/ |
| s35_clip_finishsound.svg | clip_finishsound | artifacts/decompiled/sprites/DefineSprite_35/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s35_clip_finishsound/ |
| s37_clip_typer.svg | clip_typer | artifacts/decompiled/sprites/DefineSprite_37/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s37_clip_typer/ |
| s39_clip_backspace.svg | clip_backspace | artifacts/decompiled/sprites/DefineSprite_39/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s39_clip_backspace/ |
| s41_clip_buzz.svg | clip_buzz | artifacts/decompiled/sprites/DefineSprite_41/1.svg | 308 → 147 | 0 | 0 | evidence/visual/E1-svgo/s41_clip_buzz/ |
| s46_wordball.svg | wordball | artifacts/decompiled/sprites/DefineSprite_46/2.svg | 3602 → 3312 | 0 | 0 | evidence/visual/E1-svgo/s46_wordball/ |
| s48_board_backdrop.svg | board_backdrop | artifacts/decompiled/shapes/48.svg | 84112 → 84027 | 220000 | 0 | evidence/visual/E1-svgo/s48_board_backdrop/ |
| s58_letter_tile.svg | letter_tile | artifacts/decompiled/sprites/DefineSprite_58/1.svg | 40951 → 35619 | 5478 | 0 | evidence/visual/E1-svgo/s58_letter_tile/ |
| s63_btn_kbuton.svg | btn_kbuton | artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_63/1_up.svg | 4936 → 4507 | 1219 | 0 | evidence/visual/E1-svgo/s63_btn_kbuton/ |
| s65_btn_ebuton.svg | btn_ebuton | artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_65/1_up.svg | 2744 → 2425 | 1277 | 0 | evidence/visual/E1-svgo/s65_btn_ebuton/ |
| s67_tile_socket.svg | tile_socket | artifacts/decompiled/sprites/DefineSprite_67/1.svg | 10941 → 10189 | 3529 | 0 | evidence/visual/E1-svgo/s67_tile_socket/ |
| s71_btn_ybuton.svg | btn_ybuton | artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_71/1_up.svg | 4792 → 4332 | 1575 | 0 | evidence/visual/E1-svgo/s71_btn_ybuton/ |
| s76_timer_bar.svg | timer_bar | artifacts/decompiled/sprites/DefineSprite_76/1.svg | 1928 → 1743 | 2153 | 0 | evidence/visual/E1-svgo/s76_timer_bar/ |
| s84_loading_banner.svg | loading_banner | artifacts/decompiled/sprites/DefineSprite_84/2.svg | 14376 → 12657 | 34253 | 0 | evidence/visual/E1-svgo/s84_loading_banner/ |
| s90_btn_speaker.svg | btn_speaker | artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_90/1_up.svg | 2743 → 2575 | 504 | 0 | evidence/visual/E1-svgo/s90_btn_speaker/ |
| s97_credit_line.svg | credit_line | artifacts/decompiled/sprites/DefineSprite_97/1.svg | 14348 → 11933 | 1645 | 0 | evidence/visual/E1-svgo/s97_credit_line/ |
| s103_credit_site.svg | credit_site | artifacts/decompiled/sprites/DefineSprite_103/1.svg | 14090 → 11679 | 1587 | 0 | evidence/visual/E1-svgo/s103_credit_site/ |
| s105_btn_sbuton.svg | btn_sbuton | artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_105/1_up.svg | 2622 → 2346 | 1312 | 0 | evidence/visual/E1-svgo/s105_btn_sbuton/ |
| s108_btn_top10.svg | btn_top10 | artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_108/1_up.svg | 4154 → 3792 | 1615 | 0 | evidence/visual/E1-svgo/s108_btn_top10/ |
| s111_score_feedback.svg | score_feedback | artifacts/decompiled/sprites/DefineSprite_111/7.svg | 471 → 393 | 0 | 0 | evidence/visual/E1-svgo/s111_score_feedback/ |
| s123_status_ball.svg | status_ball | artifacts/decompiled/sprites/DefineSprite_123/1.svg | 5961 → 5415 | 1032 | 0 | evidence/visual/E1-svgo/s123_status_ball/ |
| s166_hiscore_form.svg | hiscore_form | artifacts/decompiled/sprites/DefineSprite_166/1.svg | 31315 → 26126 | 46325 | 0 | evidence/visual/E1-svgo/s166_hiscore_form/ |
| s170_bottom_marquee.svg | bottom_marquee | artifacts/decompiled/sprites/DefineSprite_170/1.svg | 478 → 400 | 0 | 0 | evidence/visual/E1-svgo/s170_bottom_marquee/ |
| **Total (36)** | | | **272443 → 247381** | **882418** | **0** | summary.json |

Every per-asset `report.json` in `evidence/visual/E1-svgo/<name>/` shows
`mismatchedPixels: 0`, `maxDistance: 0`, `meanDistance: 0`, `pass: true`.

## 5. Bitmap decision procedure (docs/03 §2) — both as-is

Facts (A1 §3 / `evidence/A1-bitmaps.md`; A3 §1 / `evidence/A3-layout.md`; O10 resolution):

| Bitmap | Source export (IHDR) | Placement fact | Displayed size | Decision | sha256 (copy = source) |
|---|---|---|---|---|---|
| 47 | `artifacts/decompiled/images/47.png` (550×400) | clipped bitmap fill inside shape 48 (element `board_backdrop`, stage box (0.45,0) 550×400, SWF frame 131); never placed directly | 550×400 | displayed size = source size → as-is copy (step 2); no upscale (step 3), no SVG/CSS replacement (step 4) | `366abdbfc11be54290e48f70d5c0104f0b5fcb47084fe76884c0183a0a84ee1a` |
| 86 | `artifacts/decompiled/images/86.png` (21×29) | clipped bitmap fill inside shape 87 inside DefineSprite 88 (frame label "on"), inlined into `DefineButton2_90` (`btn_speaker`) up-state; never placed directly | 21×29 | displayed size = source size → as-is copy (step 2); no upscale (step 3), no SVG/CSS replacement (step 4) | `74710a87bbc5f61b3ab60d24d1c5b2892b3561b67b13bcb48ca2a559441cfa6e` |

The copies are byte-identical to the A1 exports (`sha256(copy) == sha256(source)`;
checked in `E1-img-process.log`). No re-encoding, no resampling, no creative edit: the SWF
payload is the only pixel truth for the 2012 build. Visual verification at DPR 1/2 is
E2's scope (docs/07 §4).

## 6. Sound verification (V1) — 9/9

Chain verified per sound: `sha256(src/assets/sfx/<file>) == sha256(artifacts/decompiled/sounds/<id>.mp3)
== A1 SHA256SUMS.txt row`, and `sounds/<id>.mp3 == sfx-raw/<id>.mp3.rawdata[2:]` with
`sha256(rawdata) == A1 export-manifest §6 sha256(SoundData)`. Sounds were only hashed
(`shasum`) and metadata-inspected (`afinfo`); nothing was played.

| Sound id | Runtime file | Bytes | sha256 (copy = A1 export = SHA256SUMS) | A1 §6 sha256(SoundData) (raw chain) |
|---|---|---|---|---|
| 22 | `sfx_22_enter.mp3` | 1950 | `1c3cd10320a9266fe1431d9aa46e8c6ec9d31add35313241d66f216ef0387fb2` | `ec752a2a6bd9c7c858df7aa0f2517e6187eedd06c68ddf68f6cd4665bbe99281` |
| 24 | `sfx_24_shuffle.mp3` | 4030 | `370bbc2eadd4a88aaa473dfaa59f5da0fd37b175b1f726edd245356bfa28cc3d` | `0c78e1799f31d4965a1b0ad78043f09013ba733ac8ff843b6ecc2ecc3903e2cf` |
| 26 | `sfx_26_countdown.mp3` | 910 | `0f878a5566c5931539b0ec8e0af9661a3447467235dc1443787f3f6e3ab350db` | `0653e7acb08cdb95fdae5c5526b2d2dd014130abf0507b0a63ab75f9d6956935` |
| 30 | `sfx_30_boing.mp3` | 1560 | `da643f2b8afbbfb8fac1baf9e310fdec7f453514706ac4d2a8304467150ead37` | `8820253d5cbc0f638e9bb5686cf92c5db46bd379477a7ac9c4165e928068394a` |
| 32 | `sfx_32_fanfare.mp3` | 21840 | `3ddbd6215e6259957ff1c7d7df24d26119ad98c522e19a91c0bd0c255e966d68` | `02adf288eefb614c89b402b05a27eb68d52219bc1fdf582db5618356033051ce` |
| 34 | `sfx_34_finishsound.mp3` | 2730 | `5db9654e0feb324a975822726dc41507dc2f8f30ab9154d3b329fcf9764c4ba1` | `d7d45d198b21e4632f1a90c43157462bbce49a449112c34fff890f1be140dac0` |
| 36 | `sfx_36_typer.mp3` | 1430 | `3f34ed813e98e8ac6df1d0f97540d4cd2e44242c8a28cda0ef345bacf7e242bf` | `24ad82f5fc0cf4a81652d6f8b9ee418769dd9f30828724fe3befc7627df072f6` |
| 38 | `sfx_38_backspace.mp3` | 1690 | `0ed0e6eac39dac1391f26266c31604d54ba3dcfc1829826911cdb24e793f752f` | `4c4ece8cdb665845cc4eab94e446c37c6e3ab94fe38a067b915f3ecdcff5a128` |
| 40 | `sfx_40_buzz.mp3` | 2730 | `832f7980db3c1d1b8b12ff89c933d9d4e9281d60d3ba6b656ccd6760dcb39395` | `9fa55a397002b5eb1720655b2d21ac495219e4244d9b2497c3013253101d89c5` |

`data/sound-map.json` names (`sfx_<id>_<slug>.mp3`) are kept exactly; the D4 copies were
left unmodified (idempotent re-run, §10). `afinfo` exits 0 for all 9 copies
(`E1-v1-afinfo.log`): durations/bitrates match A1 §6 (0.390/0.806/0.182/0.624/4.368/
0.546/0.286/0.338/0.546 s).

## 7. Runtime data mapping (src → runtime)

Method (`node tools/process-assets.mjs layout`): the A3 source hashes were asserted first
(`data/layout.json` `eb8a…292d`, `data/animation.json` `c263…794e`), then each element's
`asset` value was replaced **textually** in the raw layout text (exactly one occurrence per
ref). Python-float formatting (`50.0`) and all other bytes therefore stay A3-identical:
`diff data/layout.json src/data/layout.json` contains only the 62 asset lines
(`E1-layout-diff.log`; 248 diff lines = 62 hunks × 4). `src/data/animation.json` is a byte
copy (`cmp` identical). `data/` originals were not modified (hashes in §9).

| Element | Source asset | Runtime asset |
|---|---|---|
| intro_backdrop | `artifacts/decompiled/shapes/1.svg` | `src/assets/svg/s1_intro_backdrop.svg` |
| logo_ornament | `artifacts/decompiled/sprites/DefineSprite_3/1.svg` | `src/assets/svg/s3_logo_ornament.svg` |
| intro_sky | `artifacts/decompiled/sprites/DefineSprite_5/1.svg` | `src/assets/svg/s5_intro_sky.svg` |
| intro_ground | `artifacts/decompiled/shapes/6.svg` | `src/assets/svg/s6_intro_ground.svg` |
| intro_layer3 | `artifacts/decompiled/sprites/DefineSprite_8/1.svg` | `src/assets/svg/s8_intro_layer3.svg` |
| preloader_progress | `artifacts/decompiled/sprites/DefineSprite_12/1.svg` | `src/assets/svg/s12_preloader_progress.svg` |
| preloader_percent_value | `artifacts/decompiled/texts/14.txt` | `src/assets/text/14.txt` |
| preloader_percent_sign | `artifacts/decompiled/texts/16.txt` | `src/assets/text/16.txt` |
| preloader_loaded_bytes | `artifacts/decompiled/texts/17.txt` | `src/assets/text/17.txt` |
| preloader_total_bytes | `artifacts/decompiled/texts/18.txt` | `src/assets/text/18.txt` |
| preloader_slash | `artifacts/decompiled/texts/19.txt` | `src/assets/text/19.txt` |
| intro_glow | `artifacts/decompiled/shapes/20.svg` | `src/assets/svg/s20_intro_glow.svg` |
| clip_timerr | `artifacts/decompiled/sprites/DefineSprite_21/1.svg` | `src/assets/svg/s21_clip_timerr.svg` |
| clip_enter | `artifacts/decompiled/sprites/DefineSprite_23/1.svg` | `src/assets/svg/s23_clip_enter.svg` |
| clip_shuffle | `artifacts/decompiled/sprites/DefineSprite_25/1.svg` | `src/assets/svg/s25_clip_shuffle.svg` |
| clip_countdown | `artifacts/decompiled/sprites/DefineSprite_27/1.svg` | `src/assets/svg/s27_clip_countdown.svg` |
| intro_logo | `artifacts/decompiled/sprites/DefineSprite_29/1.svg` | `src/assets/svg/s29_intro_logo.svg` |
| clip_boing | `artifacts/decompiled/sprites/DefineSprite_31/1.svg` | `src/assets/svg/s31_clip_boing.svg` |
| clip_fanfare | `artifacts/decompiled/sprites/DefineSprite_33/1.svg` | `src/assets/svg/s33_clip_fanfare.svg` |
| clip_finishsound | `artifacts/decompiled/sprites/DefineSprite_35/1.svg` | `src/assets/svg/s35_clip_finishsound.svg` |
| clip_typer | `artifacts/decompiled/sprites/DefineSprite_37/1.svg` | `src/assets/svg/s37_clip_typer.svg` |
| clip_backspace | `artifacts/decompiled/sprites/DefineSprite_39/1.svg` | `src/assets/svg/s39_clip_backspace.svg` |
| clip_buzz | `artifacts/decompiled/sprites/DefineSprite_41/1.svg` | `src/assets/svg/s41_clip_buzz.svg` |
| wordball | `artifacts/decompiled/sprites/DefineSprite_46/2.svg` | `src/assets/svg/s46_wordball.svg` |
| board_backdrop | `artifacts/decompiled/shapes/48.svg` | `src/assets/svg/s48_board_backdrop.svg` |
| letter_tile | `artifacts/decompiled/sprites/DefineSprite_58/1.svg` | `src/assets/svg/s58_letter_tile.svg` |
| btn_kbuton | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_63/1_up.svg` | `src/assets/svg/s63_btn_kbuton.svg` |
| btn_ebuton | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_65/1_up.svg` | `src/assets/svg/s65_btn_ebuton.svg` |
| tile_socket | `artifacts/decompiled/sprites/DefineSprite_67/1.svg` | `src/assets/svg/s67_tile_socket.svg` |
| btn_ybuton | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_71/1_up.svg` | `src/assets/svg/s71_btn_ybuton.svg` |
| timer_bar | `artifacts/decompiled/sprites/DefineSprite_76/1.svg` | `src/assets/svg/s76_timer_bar.svg` |
| loading_banner | `artifacts/decompiled/sprites/DefineSprite_84/2.svg` | `src/assets/svg/s84_loading_banner.svg` |
| btn_speaker | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_90/1_up.svg` | `src/assets/svg/s90_btn_speaker.svg` |
| credit_line | `artifacts/decompiled/sprites/DefineSprite_97/1.svg` | `src/assets/svg/s97_credit_line.svg` |
| credit_site | `artifacts/decompiled/sprites/DefineSprite_103/1.svg` | `src/assets/svg/s103_credit_site.svg` |
| btn_sbuton | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_105/1_up.svg` | `src/assets/svg/s105_btn_sbuton.svg` |
| btn_top10 | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_108/1_up.svg` | `src/assets/svg/s108_btn_top10.svg` |
| score_feedback | `artifacts/decompiled/sprites/DefineSprite_111/7.svg` | `src/assets/svg/s111_score_feedback.svg` |
| timer_value | `artifacts/decompiled/texts/112.txt` | `src/assets/text/112.txt` |
| status_ball | `artifacts/decompiled/sprites/DefineSprite_123/1.svg` | `src/assets/svg/s123_status_ball.svg` |
| result_word_template | `artifacts/decompiled/texts/124.txt` | `src/assets/text/124.txt` |
| score_value | `artifacts/decompiled/texts/125.txt` | `src/assets/text/125.txt` |
| label_puan_black | `artifacts/decompiled/texts/127.txt` | `src/assets/text/127.txt` |
| label_puan_orange | `artifacts/decompiled/texts/128.txt` | `src/assets/text/128.txt` |
| label_sure_black | `artifacts/decompiled/texts/129.txt` | `src/assets/text/129.txt` |
| label_sure_orange | `artifacts/decompiled/texts/130.txt` | `src/assets/text/130.txt` |
| label_harf_3 | `artifacts/decompiled/texts/131.txt` | `src/assets/text/131.txt` |
| label_harf_8 | `artifacts/decompiled/texts/132.txt` | `src/assets/text/132.txt` |
| label_harf_4 | `artifacts/decompiled/texts/133.txt` | `src/assets/text/133.txt` |
| label_harf_5 | `artifacts/decompiled/texts/134.txt` | `src/assets/text/134.txt` |
| label_harf_6 | `artifacts/decompiled/texts/135.txt` | `src/assets/text/135.txt` |
| label_harf_7 | `artifacts/decompiled/texts/136.txt` | `src/assets/text/136.txt` |
| count_3 | `artifacts/decompiled/texts/137.txt` | `src/assets/text/137.txt` |
| count_8 | `artifacts/decompiled/texts/138.txt` | `src/assets/text/138.txt` |
| count_4 | `artifacts/decompiled/texts/139.txt` | `src/assets/text/139.txt` |
| count_5 | `artifacts/decompiled/texts/140.txt` | `src/assets/text/140.txt` |
| count_6 | `artifacts/decompiled/texts/141.txt` | `src/assets/text/141.txt` |
| count_7 | `artifacts/decompiled/texts/142.txt` | `src/assets/text/142.txt` |
| label_kelime_black | `artifacts/decompiled/texts/143.txt` | `src/assets/text/143.txt` |
| label_kelime_orange | `artifacts/decompiled/texts/144.txt` | `src/assets/text/144.txt` |
| hiscore_form | `artifacts/decompiled/sprites/DefineSprite_166/1.svg` | `src/assets/svg/s166_hiscore_form.svg` |
| bottom_marquee | `artifacts/decompiled/sprites/DefineSprite_170/1.svg` | `src/assets/svg/s170_bottom_marquee.svg` |

## 8. Manifest summary (`src/assets/manifest.json`)

`schemaVersion 1`; `generator tools/process-assets.mjs`; `svgo {version 4.1.0, preset-default,
disabledOverrides}`; `assets` (73 × name → sha256 → source, plus kind/element/symbol ids);
`data` (layout/animation source → runtime, source+file sha256, rewrite counts);
`references` (62 × element → source → runtime, §7). This is also the source→runtime mapping
record required by the task. Full hash table:

| Name | Kind | sha256 | Source |
|---|---|---|---|
| svg/s1_intro_backdrop.svg | svg | `e92f162dfba782a4d145d812decf512a76a54b3b918672a0d25a528bb1b48f06` | `artifacts/decompiled/shapes/1.svg` |
| svg/s3_logo_ornament.svg | svg | `f77c54f9e5231ab6228e54cb124dd4d6180e5e3588ab7546f58de289771bd39d` | `artifacts/decompiled/sprites/DefineSprite_3/1.svg` |
| svg/s5_intro_sky.svg | svg | `6cb660a0a7416d3c67fef7584b58138849795b9804b2c435cca31566fab2a4e7` | `artifacts/decompiled/sprites/DefineSprite_5/1.svg` |
| svg/s6_intro_ground.svg | svg | `fb21d4949ea1f319ee61abad8c07c1a28e3eda7ef760e48d4682527fc7c6c682` | `artifacts/decompiled/shapes/6.svg` |
| svg/s8_intro_layer3.svg | svg | `7a014bc53fcac0a305dc55e0b281b635ae783f1f41663d8a47777c3df3167af3` | `artifacts/decompiled/sprites/DefineSprite_8/1.svg` |
| svg/s12_preloader_progress.svg | svg | `43a5f9b97e773f1d7a8db3e044b4ee9c61f4be7f9158a2da3f0a75d9d3151719` | `artifacts/decompiled/sprites/DefineSprite_12/1.svg` |
| svg/s20_intro_glow.svg | svg | `87961cc404678e9a120559f5ab642c829c84b4a624ea1ba9f5882fe802a1f2e8` | `artifacts/decompiled/shapes/20.svg` |
| svg/s21_clip_timerr.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_21/1.svg` |
| svg/s23_clip_enter.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_23/1.svg` |
| svg/s25_clip_shuffle.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_25/1.svg` |
| svg/s27_clip_countdown.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_27/1.svg` |
| svg/s29_intro_logo.svg | svg | `0e349e067d17c64e5874f73af754daffefce1ba3e80ac587d51219895b1b4323` | `artifacts/decompiled/sprites/DefineSprite_29/1.svg` |
| svg/s31_clip_boing.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_31/1.svg` |
| svg/s33_clip_fanfare.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_33/1.svg` |
| svg/s35_clip_finishsound.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_35/1.svg` |
| svg/s37_clip_typer.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_37/1.svg` |
| svg/s39_clip_backspace.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_39/1.svg` |
| svg/s41_clip_buzz.svg | svg | `bc71b0d380cfd32105486c24062d2514f3118aaae7061ecdc18111c72f378528` | `artifacts/decompiled/sprites/DefineSprite_41/1.svg` |
| svg/s46_wordball.svg | svg | `f25873130dfab91477d1e572728ddd7e2155abfd53c517a5eabc0e5369b51c27` | `artifacts/decompiled/sprites/DefineSprite_46/2.svg` |
| svg/s48_board_backdrop.svg | svg | `ab35a24f2c6fae2d64a20ab35c806e12a320632a9d50fbc414550e22c8b7a9c3` | `artifacts/decompiled/shapes/48.svg` |
| svg/s58_letter_tile.svg | svg | `221c62620aa3fe51630e305aa477805b3f27df70f4375b439de9189c23e78783` | `artifacts/decompiled/sprites/DefineSprite_58/1.svg` |
| svg/s63_btn_kbuton.svg | svg | `593b2f0c27382d85681d0cc472a87daa3ba51a358498814f4d2025bfeb61dd9a` | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_63/1_up.svg` |
| svg/s65_btn_ebuton.svg | svg | `44d6aefffd03fafcb999a5ebf8cbdafddd118f870c95f5cdf6c3709bb697fae7` | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_65/1_up.svg` |
| svg/s67_tile_socket.svg | svg | `abc8dada0257df954e5b9faf703898bee3bd0071c0a99f585e511bfc0961b394` | `artifacts/decompiled/sprites/DefineSprite_67/1.svg` |
| svg/s71_btn_ybuton.svg | svg | `13c941d51366c9faccd4ca9b730d5023dddc8a782c38516540715a9188bb4e65` | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_71/1_up.svg` |
| svg/s76_timer_bar.svg | svg | `3616b85e620b625b91aeea9e4f88e9a83c6a02e36c7f330975c91d51adfdf9d6` | `artifacts/decompiled/sprites/DefineSprite_76/1.svg` |
| svg/s84_loading_banner.svg | svg | `11bd11dfd53eb0854b892b9765110dc72c4aebdf52083ded058c7618ec32d156` | `artifacts/decompiled/sprites/DefineSprite_84/2.svg` |
| svg/s90_btn_speaker.svg | svg | `bebd49f7bb99427b3d56612b9a8590f01c0be67dc14ad605cdd21859bdb025e1` | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_90/1_up.svg` |
| svg/s97_credit_line.svg | svg | `29ef27bfc18cad16e03a3ccebe79d046a78b2146f00be02530c88b3d8376c539` | `artifacts/decompiled/sprites/DefineSprite_97/1.svg` |
| svg/s103_credit_site.svg | svg | `58712f673207cd4acc3bad05a06e2437e4cadfc71ed76efeac57142bc687d94f` | `artifacts/decompiled/sprites/DefineSprite_103/1.svg` |
| svg/s105_btn_sbuton.svg | svg | `8850b8744fd771b1e4cba5ae410373ebbb7de62c69a636eb879d1510d5eba03c` | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_105/1_up.svg` |
| svg/s108_btn_top10.svg | svg | `968d79293f07d1970a9698886351eefa3d5189b448a02226c2996d8a7f9a4f7f` | `artifacts/a3-captures/ffdec-2012-buttons/DefineButton2_108/1_up.svg` |
| svg/s111_score_feedback.svg | svg | `edc0ecc17cfc6576520670a44360df5933a55445c3121f99062546847a0f982d` | `artifacts/decompiled/sprites/DefineSprite_111/7.svg` |
| svg/s123_status_ball.svg | svg | `1125adfcd729ab4bd9b27d708d6576afc866057e18f6f476b6f10bc6bf9ec82d` | `artifacts/decompiled/sprites/DefineSprite_123/1.svg` |
| svg/s166_hiscore_form.svg | svg | `fe2da4c2b8f642aee176146cced0a80cc276cf87e3d3b89963dbdeb34ef2466e` | `artifacts/decompiled/sprites/DefineSprite_166/1.svg` |
| svg/s170_bottom_marquee.svg | svg | `ae41ccbd423340a6ef733c93448d6d42506536324543d9ca6b4ace7c0f31cfd6` | `artifacts/decompiled/sprites/DefineSprite_170/1.svg` |
| img/img_47_550x400.png | bitmap | `366abdbfc11be54290e48f70d5c0104f0b5fcb47084fe76884c0183a0a84ee1a` | `artifacts/decompiled/images/47.png` |
| img/img_86_21x29.png | bitmap | `74710a87bbc5f61b3ab60d24d1c5b2892b3561b67b13bcb48ca2a559441cfa6e` | `artifacts/decompiled/images/86.png` |
| sfx/sfx_22_enter.mp3 | sound | `1c3cd10320a9266fe1431d9aa46e8c6ec9d31add35313241d66f216ef0387fb2` | `artifacts/decompiled/sounds/22.mp3` |
| sfx/sfx_24_shuffle.mp3 | sound | `370bbc2eadd4a88aaa473dfaa59f5da0fd37b175b1f726edd245356bfa28cc3d` | `artifacts/decompiled/sounds/24.mp3` |
| sfx/sfx_26_countdown.mp3 | sound | `0f878a5566c5931539b0ec8e0af9661a3447467235dc1443787f3f6e3ab350db` | `artifacts/decompiled/sounds/26.mp3` |
| sfx/sfx_30_boing.mp3 | sound | `da643f2b8afbbfb8fac1baf9e310fdec7f453514706ac4d2a8304467150ead37` | `artifacts/decompiled/sounds/30.mp3` |
| sfx/sfx_32_fanfare.mp3 | sound | `3ddbd6215e6259957ff1c7d7df24d26119ad98c522e19a91c0bd0c255e966d68` | `artifacts/decompiled/sounds/32.mp3` |
| sfx/sfx_34_finishsound.mp3 | sound | `5db9654e0feb324a975822726dc41507dc2f8f30ab9154d3b329fcf9764c4ba1` | `artifacts/decompiled/sounds/34.mp3` |
| sfx/sfx_36_typer.mp3 | sound | `3f34ed813e98e8ac6df1d0f97540d4cd2e44242c8a28cda0ef345bacf7e242bf` | `artifacts/decompiled/sounds/36.mp3` |
| sfx/sfx_38_backspace.mp3 | sound | `0ed0e6eac39dac1391f26266c31604d54ba3dcfc1829826911cdb24e793f752f` | `artifacts/decompiled/sounds/38.mp3` |
| sfx/sfx_40_buzz.mp3 | sound | `832f7980db3c1d1b8b12ff89c933d9d4e9281d60d3ba6b656ccd6760dcb39395` | `artifacts/decompiled/sounds/40.mp3` |
| text/14.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/14.txt` |
| text/16.txt | text | `bbf3f11cb5b43e700273a78d12de55e4a7eab741ed2abf13787a4d2dc832b8ec` | `artifacts/decompiled/texts/16.txt` |
| text/17.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/17.txt` |
| text/18.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/18.txt` |
| text/19.txt | text | `8a5edab282632443219e051e4ade2d1d5bbc671c781051bf1437897cbdfea0f1` | `artifacts/decompiled/texts/19.txt` |
| text/112.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/112.txt` |
| text/124.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/124.txt` |
| text/125.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/125.txt` |
| text/127.txt | text | `63da5e101298db1a17949928984a24ccea2e61bd129136efad9dc72fc68e2685` | `artifacts/decompiled/texts/127.txt` |
| text/128.txt | text | `63da5e101298db1a17949928984a24ccea2e61bd129136efad9dc72fc68e2685` | `artifacts/decompiled/texts/128.txt` |
| text/129.txt | text | `fbfceccd03c04d42f067a75626e504655ace250bc42f7a3ae15c6d08dd256505` | `artifacts/decompiled/texts/129.txt` |
| text/130.txt | text | `fbfceccd03c04d42f067a75626e504655ace250bc42f7a3ae15c6d08dd256505` | `artifacts/decompiled/texts/130.txt` |
| text/131.txt | text | `2cbc4cece9fd77290eca161eb0a416ff6d744fcaa3f9f36927d01631962c7775` | `artifacts/decompiled/texts/131.txt` |
| text/132.txt | text | `c2fa99bedc4754b3c5a2124b6adc73048247803988fd8ee046e9e5edf0f5a729` | `artifacts/decompiled/texts/132.txt` |
| text/133.txt | text | `cedb5c737f63857c1621557996df7b7982265a595a97aa5a6cab8eae29855071` | `artifacts/decompiled/texts/133.txt` |
| text/134.txt | text | `545e328ee9f38a8f9f7ed8b3d01264a333c12d2c7bb00f903271eb8a8ac0b44c` | `artifacts/decompiled/texts/134.txt` |
| text/135.txt | text | `d4edaa3bd95f58689cec5d1ead77b812efc549d959616459ee787c0f74e26ecd` | `artifacts/decompiled/texts/135.txt` |
| text/136.txt | text | `a6a6856e0b299c13c18d80e57fdbe3c0f81eb7171e0e848cf1c94789b8952fa9` | `artifacts/decompiled/texts/136.txt` |
| text/137.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/137.txt` |
| text/138.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/138.txt` |
| text/139.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/139.txt` |
| text/140.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/140.txt` |
| text/141.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/141.txt` |
| text/142.txt | text | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `artifacts/decompiled/texts/142.txt` |
| text/143.txt | text | `033ea5c71d3be090b1af8e9fdb672d5097e58a0d55f57864f1cd424c698885db` | `artifacts/decompiled/texts/143.txt` |
| text/144.txt | text | `033ea5c71d3be090b1af8e9fdb672d5097e58a0d55f57864f1cd424c698885db` | `artifacts/decompiled/texts/144.txt` |

## 9. Artifact SHA-256 hashes

| Artifact | SHA-256 |
|---|---|
| `tools/process-assets.mjs` | `c5cbd92d6c7e47c7733f61aab82657903cd2256e236110542c475c281e905c51` |
| `tests/assets.test.mjs` | `d7eb64e85129037cad585480d21f9f7fcb55c762b99586fb7738822350effe4f` |
| `src/assets/manifest.json` | `92f03463b54fde452ff38749aa6e1d39a886bef02492282d31effc5b0636d763` |
| `src/data/layout.json` | `f25d873d96a648760172b293ff2f6b36cfe19c3c46a18d516b4e41d90b38253f` |
| `src/data/animation.json` | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| `package.json` | `afebed243fffadca0b4aa8d4f1ea0f0cf7ea7fff519343fb1d1b8cf4bc7b2d89` |
| `package-lock.json` | `f9aa47228ee3c52ae1ffaea4e43bee95082bac18715fe866c1102fcd78c33a5a` |
| `evidence/visual/E1-svgo/summary.json` | `7d19ad1eb23d60c93ee416190976615b13a7db7b4db42aca5e0e3cefa78aa2cb` |
| `data/layout.json` (A3, unmodified) | `eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d` |
| `data/animation.json` (A3, unmodified) | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |

## 10. Verification results

### V2 — references resolve, SVG XML, image dimensions

```text
node -e "const fs=require('fs');const l=JSON.parse(fs.readFileSync('src/data/layout.json','utf8'));
  let ok=0,missing=[];for (const e of l.elements){ if(fs.existsSync(e.asset)) ok++;
  else missing.push(e.id+' -> '+e.asset); } console.log('V2a asset refs resolved: '+ok+'/'+l.elements.length);
  if(missing.length){console.log('MISSING: '+JSON.stringify(missing));process.exit(1);}"
→ exit 0, "V2a asset refs resolved: 62/62"          (E1-v2-refs.log)

# all 36 source SVGs (paths printed from data/layout.json)
node -e "…print unique svg assets…" | xargs xmllint --noout
→ exit 0, no output                                 (E1-v2-xml-source.log)
# all 36 runtime SVGs
xmllint --noout src/assets/svg/*.svg
→ exit 0, no output                                 (E1-v2-xml-runtime.log)

# PNG IHDR vs catalog values (tolerance ±0), runtime and source
node -e "…readUInt32BE(16/20) on 47/86 PNGs…"
→ exit 0, "PASS img_47_550x400.png IHDR=550x400 … PASS img_86_21x29.png IHDR=21x29"
                                                     (E1-v2-image-dims.log)
```

### V1 — manifest hashes; sound hashes equal A1

```text
shasum -a 256 src/assets/sfx/*.mp3                   (E1-v1-sfx-hashes.log)
node -e "…sha256(copy) == sha256(A1 export) == SHA256SUMS row per sound…"
→ exit 0, "V1 sounds: 9/9 match"                     (E1-v1-sfx-verify.log)
for f in src/assets/sfx/*.mp3; do afinfo "$f" >/dev/null; done
→ exit 0 for all 9                                  (E1-v1-afinfo.log)
```

Manifest hashes are recorded in `src/assets/manifest.json` and re-verified by
`tests/assets.test.mjs` (8/8).

### V5 self-check — SVGO before/after identical, every SVG

```text
node -e "…for each evidence/visual/E1-svgo/*/report.json assert mismatchedPixels===0 && pass===true…"
→ exit 0, "V5: 36 asset renders, 0 mismatched pixels, failures=[]"  (E1-v5-diff-verify.log)
```

Per-asset reports: `evidence/visual/E1-svgo/<name>/{before.png,after.png,report.json}`.
Totals: 36 assets, 272,443 → 247,381 bytes, 0 mismatched pixels
(`evidence/visual/E1-svgo/summary.json`).

### V4 — tests, lint, build

```text
npm test -- assets   → exit 0, 1 file, 8 tests passed   (E1-test-assets.log)
npm test             → exit 0, 5 files, 55 tests passed (E1-v4-test-full.log:
                        assets 8, audio 17, constants 3, stage 11, diff 16)
npm run lint         → exit 0                            (E1-v4-lint.log)
npm run build        → exit 0 (tsc --noEmit + vite build)(E1-v4-build.log)
npx ajv-cli validate -s data/layout.schema.json -d src/data/layout.json
                     → exit 0, "src/data/layout.json valid" (E1-v3-layout-schema.log)
node tools/process-assets.mjs all → exit 0               (E1-process-assets-all.log)
```

Idempotency (extra): `find src/assets src/data -type f | xargs shasum -a 256` before and
after the final `all` run → identical hash lists (all 77 files unchanged: 74 under
`src/assets/`, 3 under `src/data/`).

## 11. Notes, decisions, caveats

1. **Text-catalog destination (decision).** docs/03 §1 defines destinations only for
   shapes/sprites, bitmaps and sounds; static text is recreated as DOM text in components.
   The task requires every runtime `asset` ref to point at a committed `src/assets/...` path
   (fresh clones have no `artifacts/` — it is git-ignored), so the 26 A3 text-catalog files
   were copied to `src/assets/text/<symbolId>.txt` (source basename kept, byte copies;
   14 carry static strings, 12 are the dynamic fields that are empty at definition).
   `text` values and font metrics in the layout entries are unchanged.
2. **Blank renders are source properties, not harness failures.** 13 of 36 assets render
   blank in isolation and stay blank after optimization: 10 zero-size action/sound-only
   sprites (A3 §7.3), `s46_wordball` (FFDec export has every gradient `stop-opacity="0"`),
   `s111_score_feedback` (nested text 109 not inlined), `s170_bottom_marquee` (nested
   sprite 169 not inlined, A3 §7.4). The other 23 renders carry 882,418 ink pixels; the
   before/after pair of all 36 was still compared (0 mismatched pixels) and each image
   load was proven via `naturalWidth` (`summary.json`).
3. **`naturalWidth` rounding.** The guard requires `naturalWidth > 0` for positive-size
   assets (e.g. 551.8 → 552 is browser rounding); the render wrapper pins the exact
   fractional CSS size parsed from the SVG root, identically before and after.
4. **npm audit.** `npm audit` reports 2 high findings, both pre-existing in `ajv-cli`'s
   `fast-json-patch` (C1-era); they are not introduced by `svgo` and no dependency change
   beyond the pinned `svgo` devDependency was made (`E1-npm-audit.log`).
5. **Threshold note.** F1's diff tool passes at ≤ 2.0 % mismatch ratio, but E1's pass rule
   is stricter — zero mismatched pixels; every report is 0, so no threshold is relied on.
6. **`board_backdrop` keeps its embedded bitmap.** `s48_board_backdrop.svg` contains the
   550×400 bitmap 47 as a base64 fill (A3 §7.5); SVGO does not touch image payloads
   (before/after diff 0). `img_47/86` are the docs/03 §1 bitmap-destination copies.

## 12. Silent witness compliance (EXECUTION.md §8 amendment)

- The only browser work is the SVG render check; Chromium is launched as
  `chromium.launch({ args: ['--mute-audio'] })` in `tools/process-assets.mjs`.
- Sounds were verified with `shasum`/`afinfo` only; no sound was decoded for playback,
  no `play()` was called, no Ruffle was used, and no media player was opened.
- No test or command in this task emits audio.

## 13. Hand-offs

- **E2**: consume `src/data/layout.json` (asset refs now `src/assets/...`).
  `board_backdrop` (s48) still embeds bitmap 47; `img_86_21x29.png` corresponds to the
  bitmap inlined in `s90_btn_speaker.svg`. Text entries carry their strings/metrics in
  `text`/`font`; the `src/assets/text/*.txt` copies are provenance only.
- **E3**: `src/data/animation.json` is a byte copy (A3 sha256 unchanged); element ids match
  layout (test-asserted).
- **F2/F3**: `tools/verify-all.sh` picks up `src/data/layout.json` schema validation;
  `tests/assets.test.mjs` guards manifest coverage on every `npm test`.

## 14. Result

**PASS** — 36/36 SVGs optimized with zero pixel difference (SVGO 4.1.0, pinned); 2/2
bitmaps as-is with catalog-exact dimensions; 9/9 sounds hash-verified against A1 and left
unmodified; every runtime asset reference resolves to a committed `src/assets/...` file;
manifest covers all 73 assets; V4 green (`npm test -- assets` 8/8, full 55/55, lint 0,
build 0). Raw logs: `evidence/logs/E1-*.log`.

