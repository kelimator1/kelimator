# Y6 — Top10 Button Omission (owner final presentation wave) — evidence

Task: Y6 — Top10 Button Omission (owner directive `tasks/Y6-top10-omission.md`;
reference action `artifacts/decompiled/scripts/DefineButton2_108/
"BUTTONCONDACTION on(release).as"`: `getURL("javascript:openWin('top10.php?r=
822741','top10',400,360)")`; README §2.2 fixed decision 2: no network features,
Top10 out of scope)
Started: 2026-09-29 16:38 +03 (pre-fix S2 capture run; first edit 16:39)
Ended: 2026-09-29 16:50 +03 (final evidence write after the last verification run)
Host+OS: dev-host.home / macOS, arm64 / arm64 host · Node v22.14.0 ·
@playwright/test 1.63.0
Result: **PASS** (final statuses in §7)

All browser work used muted Chromium (`--mute-audio`, playwright.config.ts);
no sound was played or decoded. No `docs/**` file was written (proposals in §9);
git state was not modified (add/commit/branch/stash not used);
`../kelimator-nostalji/` was not touched. The catalog/provenance files
(`data/layout.json`, `src/data/layout.json`, both `animation.json` files,
`src/assets/manifest.json`) and the s108 SVG asset were read only
(hashes in §5/§8). No network beyond the local dev server.

---

## 1. What changed

| Item | Change |
|---|---|
| `src/ui/board.ts` | `'btn_top10'` added to `OMITTED_ELEMENTS` with a dated evidence comment (Y2 style; cites the reference action, README §2.2, the owner directive, region `419,372,91,23` and the absence assertions); the element loop skips it **before any DOM node is created** (same skip as Y2 — no other code change) |
| `tests/e2e/visual-states.ts` | `'btn_top10'` dropped from `BOARD_ELEMENTS`; new Y6 section: owner region `Y6_TOP10_OMISSION_RECT = 419,372,91,23`, wired (stage-clipped) `Y6_TOP10_IGNORE_RECT = 419,372,91,23` (clip is a no-op — see §3), `y6Top10IgnoreRects/Args`; combined `boardIgnoreRects/Args` now = Y1 + Y2 + Y6 |
| `tests/e2e/visual.spec.ts` | owner-omission test extended: `[data-element="btn_top10"]` count **0** in the default render and in an explicit synthetic view (mirrors the Y2 assertions in the same test — see §4 for the test-count decision); header/allowance comments updated to Y1/Y2/Y6 |
| `tests/e2e/animations/**`, `tests/e2e/playthrough/**` | **not changed** — both suites already pass/assert the combined `boardIgnoreRectArgs(1)`/`boardIgnoreRects(1)`, so the Y6 region is wired in automatically (their headers keep the historical Y1/Y2 wording) |

No rendered element name, asset path or behavior changed for any other element.
`V7_SAMPLE` contains no `btn_top10` (checked; no change needed).

## 2. Omission mechanism (`src/ui/board.ts`)

`OMITTED_ELEMENTS` (extended; the new dated comment mirrors the Y2 note):

```ts
const OMITTED_ELEMENTS: ReadonlySet<string> = new Set([
  'credit_line',
  'credit_site',
  'btn_top10',
]);
```

The Y6 comment records: reference action `javascript:openWin('top10.php?…')`
(DefineButton2_108 action script), README §2.2 no-network decision, owner
directive `tasks/Y6-top10-omission.md`, omission region `419,372,91,23`, the
provenance rule (catalog + s108 untouched) and the absence assertions.

Element loop (`renderStaticLayer`) — unchanged; the skip remains the **first**
statement, before the catalog lookup, rect resolution and
`renderSvgElement`/`renderTextElement`:

```ts
for (const id of view.elements) {
  if (OMITTED_ELEMENTS.has(id)) {
    // Task Y2: skipped before any DOM node is created (no trace in the DOM).
    continue;
  }
  const element = ELEMENTS_BY_ID.get(id);
  ...
```

The default board view still lists `btn_top10` (`data/animation.json` sequence
`board`, line 98; `defaultBoardView()` only hides
`loading_banner`/`score_feedback`), so the default page render exercises the
skip — the absence assertions in §4 are not vacuous. Independent non-vacuity
evidence: the pre-fix S2 captures (§6) show the same catalog entry rendering
the button through the same code path before the edit.

## 3. Region derivation and overlap check

**Owner region** (`Y6_TOP10_OMISSION_RECT`): `419,372,91,23` = the integer
pixel coverage of the button's stage bbox (419.8, 372.95)–(509.25, 394.65)
(`floor` origin, `ceil` corner → x 419..509, y 372..394; 91×23 = 2 093 px at
dsf1). **Wired form** (`Y6_TOP10_IGNORE_RECT`): identical — the rect lies fully
inside the 550×400 stage (`x+w=510 ≤ 550`, `y+h=395 ≤ 400`), so the Y2-style
stage clip is a no-op at dsf 1 and 2 (dsf2: `838,744,182,46` inside 1100×800).
The 1.0 px stroke and ink of the asset (svg 89.45×21.7; A3-layout §6 reference
ink `421,374`–`505,390`) lie inside that coverage.

**Measured deviation** (evidence/visual/Y6/derivation/region-derive.mjs,
reading the F1 decoder; window = declared rect padded to `410,365,100,35` at
dsf1 — excludes the speaker x≥513.99 and every Y1 rect):

| Quantity (S2 idle board) | dsf1 | dsf2 (device px) | dsf2 ÷ 2 |
|---|---|---|---|
| post↔pre change mask (raw > 30), bbox | `420,373,87,20` | `840,746,174,40` | `420,373,87,20` |
| post↔pre change mask pixels | 1 704 | 6 889 | — |
| attribution mask (post↔ref > 30 ∧ pre↔ref ≤ 30), bbox | `421,373,86,19` | `840,746,173,39` | `420,373,86.5,19.5` |
| attribution mask pixels | 1 394 | 5 951 | — |
| attribution pixels outside the declared rect | **0** | **0** | — |
| post↔ref raw mismatches inside the declared rect | 1 735 (1 394 Y6 + 341 pre-existing) | 7 060 (5 951 Y6 + 1 109 pre-existing) | — |

**Union in dsf1 stage coordinates** (dsf2 folded 2×, the Y1 §5 convention):
change mask `420,373,87,20` (1 740 px) and attribution mask `420,373,87,20`
(1 714 px) — both fully inside the declared rect (left/top margins 1 px,
right 3 px, bottom 2 px). The pre-existing mismatches inside the rect stay
monitored and are excluded by the region like the rest (§6).

**F1 tool runs** (raw metric, threshold 30):
- `post↔pre` full image (`evidence/visual/Y6/pre-post-diff/dsf{1,2}/`,
  `Y6-prepost-diff.log`): dsf1 `mismatchedPixels=1704`, `mismatchBBox
  (420,373,87,20)`; dsf2 6 889 px, `(840,746,174,40)`. Both bboxs inside the
  wired rect — the whole render change due to the omission is confined to it.
- post↔reference on the cropped measurement window
  (`evidence/visual/Y6/derivation/window-dsf{1,2}-{post,pre}-vs-ref/`,
  `Y6-window-diff.log`; F1-CLI on
  `evidence/visual/Y6/crops/S2-dsf*-window-*.png`): dsf1 1 769/3 500 px
  (pre-fix baseline in the same window 391 px); dsf2 7 184/14 000 px (baseline
  1 356 px). The window raw counts frame the attribution counts
  (1 394/5 951; the mask counts only pixels mismatching post-fix but not
  pre-fix, the raw counts also include the pre-existing deviations).

**Overlap with the existing allowance** (probe; same math as Y2 §3, script
reads the committed `Y1_IGNORE_RECTS`):

| Set | dsf1 px | dsf2 px |
|---|---|---|
| Y1 union (`ignoredPixels` with Y1 only) | 62 720 | 250 880 |
| Y2 wired credit rect | 3 465 | 13 860 |
| Y1 ∪ Y2 (Y2 overlaps Y1 by 255/1 020) | 65 930 | 263 720 |
| Y6 wired Top10 rect | 2 093 | 8 372 |
| Y6 ∩ Y1 | **0** | **0** |
| Y6 ∩ Y2 | **0** | **0** |
| **combined union (Y1∪Y2∪Y6)** | **68 023** | **272 092** |

The suites report exactly these combined numbers in every board comparison
(`ignoredPixels=68023` at dsf1, `272092` at dsf2; visual/animation/playthrough)
— independent confirmation of the no-overlap computation
(`evidence/logs/Y6-region-derivation.log`, `evidence/visual/Y6/derivation/
region-derivation.json`).

**Renderer-level omission only.** The omission is a renderer skip: the layout
catalog entry (id + asset path), the animation-catalog id, the manifest entry
and the s108 asset all stay in the build as provenance (untouched, §5/§8). The
pre-existing wholesale eager asset glob is unchanged, so `vite build` still
inlines the s108 asset URL into the generic asset map and the dev server still
fetches its module wrapper (Y2 §5 E pattern); no board element resolves or
requests it because the skip runs before `assetUrl()`/DOM creation. There is
no data/provenance deletion and no behavior change beyond "no button painted,
no node created".

## 4. Absence assertions

Owner-omission test in `tests/e2e/visual.spec.ts` (describe "Y2 credit
omission", test "credit_line and credit_site are absent from the rendered
board") extended with two Y6 assertion contexts, mirroring the Y2 structure:

1. **Default render** (after `preparePage`, the default board view whose
   element list still contains `btn_top10`):
   `[data-element="btn_top10"]` count **0**.
2. **Explicit-view render** (TEST-ONLY `__visualTest.apply({ elements:
   ['board_backdrop', 'btn_top10'] })`): the backdrop renders (count 1) while
   `btn_top10` still creates **no DOM node** — the skip-before-creation
   invariant, not just the absence of a request.

**Test-count decision (recorded, not hidden):** the Y6 assertions share the
existing owner-omission test instead of adding a new one, so the visual suite
stays at **18 tests** (task Y6 VERIFY: "`npm run e2e -- visual` stays 18
passed") and the docs/07 §4 record ("Y2 credit omission" as the absence test)
stays valid. The Y2 assertions are unchanged and still run (verify-all and the
final visual log show test 18/18 green, now with the Y6 additions). Final run:
**1 passed** (test 18/18 of 18).

## 5. Grep proof — no runtime reference (`evidence/logs/Y6-grep-proof.log`)

A. **Asset-path references in runtime/test/tool code** — only the Y6 evidence
comment in `src/ui/board.ts` (line 570); excluding comment lines there is
**no** match (exit 1). No code line constructs `s108_btn_top10`.

B. **Element-id references in app source** — only the Y6 omission block
(comment + `OMITTED_ELEMENTS` entry); non-comment lines: exactly
`src/ui/board.ts:577: 'btn_top10',`.

C. **Test references** — absence assertions + the omission region helper only
(`tests/e2e/visual.spec.ts`, `tests/e2e/visual-states.ts` comment). Nothing in
`tests/e2e/animations/**`, `tests/e2e/playthrough/**`, unit tests or `V7_SAMPLE`.

D. **Catalog/provenance (kept untouched, data only):** `data/layout.json`
(1 × id), `src/data/layout.json` (2: id + asset path), both `animation.json`
(1 × id each), `src/assets/manifest.json` (4). Hashes unchanged (§8).

E. **Untouched-file proof:** the s108 asset hashes **exactly** to its manifest
pin `968d79293f07d1970a9698886351eefa3d5189b448a02226c2996d8a7f9a4f7f`; all
catalog/asset hashes equal the pre-task log (`Y6-pre-hashes.log` ≡
`Y6-source-hashes.log` untouched block).

F. **Built bundle** (`npm run build` after the edit; `dist/assets/
index-B3ukGsPw.js`): contains the imported layout-catalog string `btn_top10`
(6 ×) and the generic eager asset-map key/URL `s108_btn_top10` (3 ×; s108 is
3 792 B, below the 4 096 B inline limit, so Vite inlines it — no separate
`dist/assets` file). Same recorded pattern as Y2 §5 E: data/module URLs only —
no board element resolves them (A/B + §4).

## 6. Pre/post — visible result

| | Capture | SHA-256 |
|---|---|---|
| pre-fix (button visible) | `evidence/visual/Y6/pre/S2-dsf1-prefix.png` | `0143c77aadb6123c9b179eccaed7e4860d3204f23bede49417fe49bbd81acd59` |
| pre-fix (button visible) | `evidence/visual/Y6/pre/S2-dsf2-prefix.png` | `aa19028ab364f3c8f96fce296c407c8451ad084d6d5e34d98f6d89a4b43d3f71` |
| post-fix (button absent) | `evidence/visual/Y6/post/S2-dsf1-postfix.png` | `95f84a581b5e43941f3d688f69e1c47202ecc7aa27689b530b2986c4d3bbef79` |
| post-fix (button absent) | `evidence/visual/Y6/post/S2-dsf2-postfix.png` | `5b2a2a00801a45ffcc605a4976c9b634703c95906138e7ff533067ce5186d889` |

The pre-fix captures were taken before the first edit with the same S2 renderer
path (muted Chromium); they are **byte-identical to Y4's recorded after-captures**
(`evidence/Y4-knob-alpha.md` §8: `0143c77a…` / `aa19028a…`), independently
confirming the committed pre-Y6 tree state. The post-fix captures come from the
final visual run (re-run byte-identically after the last source revision —
`test-results/E2-live/S2/dsf{1,2}/actual.png` hashes equal the saved post
captures).

A rect-free `post↔pre` diff (F1 tool, raw > 30) shows the change is confined to
the button ink (whole-image mismatch bbox, §3):

| Pair | mismatched px | ratio | mismatch bbox | wired rect |
|---|---|---|---|---|
| dsf1 post↔pre | 1 704 | 0.775 % | `420,373,87,20` | `419,372,91,23` ✔ inside |
| dsf2 post↔pre | 6 889 | 0.783 % | `840,746,174,40` | `838,744,182,46` ✔ inside |

No other pixel changed anywhere on the stage. Before/after/reference region
crops (window `415,364,96,36`, dsf1 ×2): `evidence/visual/Y6/crops/
S2-dsf{1,2}-top10-{before,after,reference}.png` — before and reference show the
orange "Top10" button; after shows the bare backdrop (the visual confirmation
of the omission). Heatmaps of the `post↔pre` diff: `evidence/visual/Y6/
pre-post-diff/dsf{1,2}/heatmap.png`.

**Reference-relative effect** (§3, attribution mask): at S2 the omission
accounts for 1 394/1 735 raw mismatch pixels inside the region at dsf1
(5 951/7 060 at dsf2); the remainder (341/1 109) already mismatched pre-fix
(pre-existing backdrop/AA deviation that the region now also covers — recorded,
not hidden). The pre-existing mismatches **outside** the region stay counted
unchanged (window baseline pre-fix 391/1 356 px).

## 7. Suite results (final; logs in `evidence/logs/`)

| Suite | Command | Result |
|---|---|---|
| Visual (V5+V2+V7+Y2+Y6) | `npm run e2e -- visual` | **18 passed** (`Y6-visual.log`) — S2 tolerant 0.602 % (dsf1, was 0.659 % pre-Y6) / 0.170 % (dsf2, was 0.178 %); worst board states S4 0.891 % (dsf1) / S6 0.662 % (dsf2); S1 unchanged 0.062 %/0.015 % with `ignoredRects: []`; every board comparison reports `ignoredPixels=68023`/`272092` and the tool's `ignoredRects` equals the combined Y1+Y2+Y6 set (68 023 = 62 720 + 3 465 − 255 + 2 093; 272 092 = 4×68 023) |
| Animation (V5+V2+V7) | `npm run e2e -- animation` | **8 passed** (`Y6-animation.log`) — board @0.0 tolerant 0.629 % (was 0.685 %), wordball @0.25/0.5278/0.8056/1.0556 = 0.899/0.687/0.687/0.687 % (was 0.955/0.743/0.743/0.743 %); every keyframe `ignoredPixels=68023` |
| Playthrough (V6+V5) | `npm run e2e -- playthrough` | **3 passed** (`Y6-playthrough.log`) — 40 scripted steps, worst tolerant **1.217 %** (step `04-duplicate-FAL`; was 1.273 %); every compared step `ignoredPixels=68023`; 39-complete stays excluded as documented; S9 timeout variant tolerant **0.511 %** (was 0.567 %), app wait 200 441 ms |
| Unit tests | `npm test` | **14 files / 238 tests passed** (`Y6-test.log`) |
| Lint / build | `npm run lint` / `npm run build` | exit 0 / exit 0 (`Y6-lint.log`, `Y6-build.log`; pre-existing chunk-size warning only, bundle `dist/assets/index-B3ukGsPw.js`) |
| Offline (V2/T14, extra — closing matrix) | `npm run e2e -- offline` | **1 passed** (`Y6-offline.log`) — also exercises the post-Y6 `dist/` build: zero non-local requests |

Iteration record (kept, not hidden): (a) the Y6 absence assertions were folded
into the existing owner-omission test — adding a test would have moved the
visual suite to 19, contradicting the task VERIFY "stays 18 passed"; the
synthetic-view assertion proves the skip independently (§4). (b) The first
grep-proof draft classified the board.ts evidence comment as an asset-path
"reference"; §5 A now separates comment from code (the corrected log is the
committed one). (c) The visual suite was re-run after the final comment edit in
`visual-states.ts`; S2 captures are byte-identical across runs and the final
`Y6-visual.log` corresponds to the final source hashes in §8.

## 8. Hash inventory

| Artifact | SHA-256 (after Y6) |
|---|---|
| `src/ui/board.ts` | `98077fed098f3104b1f19a9e2c227934a2177d27b5622e98057fa4a65278e890` |
| `tests/e2e/visual-states.ts` | `e6b323671e8a63409bfb596f45b0787ca106da036343b3478a26d3cb03a31a84` |
| `tests/e2e/visual.spec.ts` | `042e57708ba53ec5f63de3caf1b8bbd52a0f3f33c87e0a079b3cd429b2a9afff` |
| `src/assets/svg/s108_btn_top10.svg` (untouched) | `968d79293f07d1970a9698886351eefa3d5189b448a02226c2996d8a7f9a4f7f` (= manifest pin) |
| `src/assets/manifest.json` (untouched) | `776fb3fd9af23cd427f9b67ec9a53c68f8553d4d593aa8b73b3ab6f193bfdb64` |
| `src/data/layout.json` (untouched) | `f25d873d96a648760172b293ff2f6b36cfe19c3c46a18d516b4e41d90b38253f` |
| `data/layout.json` (untouched) | `eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d` |
| `src/data/animation.json` = `data/animation.json` (untouched) | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |
| Reference fixtures `S2-idle-board.png` dsf1 / dsf2 (untouched) | `9859f246…b3cc33` / `a608218a…aeca24d` |

Pre-Y6 values (reconstructed from the record; the last editing task per file
is the source, and no later task touched the file — Y3 changed only `hud.ts` +
its specs, Y4 only `visual-states.ts` + assets/tooling, Y5 only `hud.ts` +
its probe/spec):

| Artifact | Pre-Y6 SHA-256 (source) | After Y6 |
|---|---|---|
| `src/ui/board.ts` | `58c1cac2ae2ef58215a7c310bc2375d0ca1248bef4bf1305cfc028005c7ee88f` (Y2 §8) | `98077fed…78e890` |
| `tests/e2e/visual-states.ts` | `2c51065046f1d01be6ad5d7fb1f64853533fc84e2a62c26e30750e0033d9e591` (Y4 §8) | `e6b32367…a31a84` |
| `tests/e2e/visual.spec.ts` | `c54013e0ec68a4220af6c46000b91145b59417100a73b738c983ed4ffd75b3e0` (Y2 §8) | `042e5770…a9afff` |

The untouched block is byte-identical to the pre-task log (`Y6-pre-hashes.log`
vs `Y6-source-hashes.log`, diff empty). Logs:
`evidence/logs/Y6-{pre-hashes,source-hashes,capture-hashes,prepost-diff,
window-diff,region-derivation,grep-proof,pre-visual-s2,visual,animation,
playthrough,test,lint,build,offline}.log`.

## 9. Proposed docs lines (single-writer: the orchestrator applies these)

**`docs/07-verification.md` §4 — new amendment (next letter after Y5's
"2026-09-29c"):**

> Amendment 2026-09-29d (owner final wave Y6): the rebuild omits the Top10
> button (`btn_top10` — DefineButton2_108; its reference action opens
> `top10.php` via `javascript:openWin` — `artifacts/decompiled/scripts/
> DefineButton2_108/"BUTTONCONDACTION on(release).as"` — and README §2.2 puts
> Top10 out of scope with the other network features) from the board render
> (owner directive `tasks/Y6-top10-omission.md`). `src/ui/board.ts`
> (`OMITTED_ELEMENTS`) skips it before any DOM node is created. Every
> static/animation/playthrough V5 comparison of a board state passes the
> owner-approved omission region `419,372,91,23` (integer pixel coverage of the
> button stage bbox (419.8,372.95)–(509.25,394.65)) as `--ignore-rect`; the
> region lies fully inside the stage, so the wired rect equals the declared
> rect at both deviceScaleFactors (dsf2 `838,744,182,46`). Measured omission
> deviation (raw > 30): bbox `420,373,87,20` at dsf 1 / `840,746,174,40` at
> dsf 2; union in dsf1 coordinates `420,373,87,20`, inside the region
> (attribution pixels outside: 0). The region does not overlap the Y1 set or
> the Y2 credit rect; combined `ignoredPixels` 68 023/272 092 at dsf 1/2.
> Catalog/animation/manifest entries and the s108 asset remain as provenance
> (untouched; hashes recorded; no runtime reference — renderer-level omission
> only). Thresholds unchanged; absence is asserted by `tests/e2e/
> visual.spec.ts` (owner-omission test, shared with Y2 so the suite stays at 18
> tests). Evidence: `evidence/Y6-top10.md`, matching entry in
> `docs/08-open-items.md`.

**`docs/08-open-items.md` — proposed Amendment entry** (a placeholder entry for
Y6 already exists at "Wave follow-up **Y6**"; the wording below is the final
version in the Y2 entry's format — if the placeholder is kept, only the
numbers/hashes sentence needs adding):

> - 2026-09-29 — Owner final wave Y6 (`docs/07` §4 omission region): the Top10
>   button (`btn_top10`, ch 108; reference action `javascript:openWin(
>   'top10.php?r=…')`, README §2.2 no-network decision) is omitted at renderer
>   level (`src/ui/board.ts` `OMITTED_ELEMENTS`, skip before DOM creation);
>   absence asserted in `tests/e2e/visual.spec.ts` (default + explicit view;
>   shares the Y2 omission test so the visual suite stays at 18). All board
>   comparisons pass the owner-approved omission region `419,372,91,23`
>   (fully inside the stage → wired = declared; no overlap with Y1/Y2;
>   combined `ignoredPixels` 68 023/272 092). `data/layout.json`,
>   `src/data/layout.json`, both `animation.json` files,
>   `src/assets/manifest.json` and the s108 asset untouched (provenance; asset
>   hash = manifest pin; no runtime reference). Suites re-run green (visual 18,
>   animation 8, playthrough 3; worst tolerant 1.217 %). Evidence:
>   `evidence/Y6-top10.md`.

## 10. Silent witness and hygiene

- Every browser run (pre/post captures, all three suites) used Chromium with
  `--mute-audio` (playwright.config.ts); no sound was played or decoded; no
  Ruffle run, no network beyond the local dev server.
- Writes only to the task's owned paths: `src/ui/board.ts`,
  `tests/e2e/visual-states.ts`, `tests/e2e/visual.spec.ts`, `evidence/Y6-*`,
  `evidence/visual/Y6/**`, `evidence/logs/Y6-*` (plus the mandated
  `npm run build` output in `dist/` and transient `test-results/`).
  No `docs/**` edit; no git state change; `../kelimator-nostalji/` untouched.
- The s108 asset and the four catalog/manifest files were read but never
  written (hash/mtime-style proof in §5 E and §8; the pre-task log equals the
  final untouched block).

## 11. Result

**PASS** — `btn_top10` is omitted before DOM creation (skip-before-creation
asserted for the default view and an explicit view), the owner-approved
omission region `419,372,91,23` is wired into all three comparison suites
through the shared Y1+Y2+Y6 helpers with the measured deviation
(`420,373,87,20` union at dsf1; 0 px outside) and the no-overlap union
(68 023/272 092) confirmed by the suites' `ignoredPixels`, the catalogs/assets
are untouched (hashes = pins; no runtime code reference), and
visual/animation/playthrough/unit/lint/build are green with ratios at or below
the pre-Y6 baselines. Evidence: this file, `evidence/visual/Y6/**`,
`evidence/logs/Y6-*`.
