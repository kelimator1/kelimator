# Y2 — Credit Sprite Omission (owner final presentation wave) — evidence

Task: Y2 — Credit Sprite Omission (owner Task B; owner directive
`tasks/Y2-credit-omission.md`)
Started: 2026-09-29 (pre-fix S2 capture run, 12:39 +03; first edit 12:40)
Ended: 2026-09-29 (final evidence write after the last verification run)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host ·
Node v22.14.0 · @playwright/test 1.63.0
Result: **PASS** (final statuses in §7)

All browser work used muted Chromium (`--mute-audio`, EXECUTION.md §8); no sound
was played or decoded. No `docs/**` file was written; git state was not modified
(add/commit/branch/stash not used); `../kelimator-nostalji/` was not touched. The
catalog files (`data/layout.json`, `src/data/layout.json`), both credit SVG
assets and the animation catalogs were read only (hashes/provenance in §5/§8).

---

## 1. What changed

| Item | Change |
|---|---|
| `src/ui/board.ts` | explicit omission list `OMITTED_ELEMENTS` (`credit_line`, `credit_site`) with a dated `// evidence:` comment; the element loop skips them **before any DOM node is created**; the now-dead `ELEMENT_DELTA` entries for both were deleted and the emptied table + its two lookups removed |
| `tests/e2e/visual-states.ts` | both ids dropped from `BOARD_ELEMENTS`; new Y2 section: owner region `Y2_CREDIT_OMISSION_RECT = 0,367,105,36`, wired (stage-clipped) `Y2_CREDIT_IGNORE_RECT = 0,367,105,33`, `y2CreditIgnoreRects/Args`, combined `boardIgnoreRects/Args` (Y1 + Y2) |
| `tests/e2e/visual.spec.ts` | `credit_line` dropped from `V7_SAMPLE`; new “Y2 credit omission” test asserting both ids are absent from the rendered board (default view + an explicit synthetic view); allowance assertion now equals `boardIgnoreRects(dsf)` |
| `tests/e2e/animations/animations.spec.ts` | diff calls pass `boardIgnoreRectArgs(1)`; assertion equals `boardIgnoreRects(1)` |
| `tests/e2e/playthrough/playthrough.spec.ts` | diff calls pass `boardIgnoreRectArgs(1)`; assertion equals `boardIgnoreRects(1)` |

No rendered element name, asset path or behavior changed for any other element.

## 2. Omission mechanism (`src/ui/board.ts`)

`OMITTED_ELEMENTS` (new; dated comment cites the owner directive, the owner
omission region, catalog/sprite provenance and the absence assertion):

```ts
/**
 * Owner-approved element omission (owner final presentation wave, task Y2,
 * 2026-09-29): the two site credit sprites — `credit_line` (DefineSprite_97,
 * "Diğer oyunlar") and `credit_site` (DefineSprite_103, "kelimator.com") —
 * are not rendered by the rebuild. The element loop below skips these ids
 * before any DOM node is created, so they leave no trace in the DOM. ...
 * evidence: owner directive `tasks/Y2-credit-omission.md` (owner-approved
 * omission region 0,367,105,36); docs/08-open-items.md "Owner final
 * presentation wave Y1–Y2"; reference provenance: evidence/A3-layout.md §6 …;
 * evidence/E1-assets.md §7 …; absence assertions: tests/e2e/visual.spec.ts
 * "Y2 credit omission".
 */
const OMITTED_ELEMENTS: ReadonlySet<string> = new Set(['credit_line', 'credit_site']);
```

Element loop (`renderStaticLayer`) — the skip is the **first** statement, before
the catalog lookup, rect resolution and `renderSvgElement`/`renderTextElement`:

```ts
for (const id of view.elements) {
  if (OMITTED_ELEMENTS.has(id)) {
    // Task Y2: skipped before any DOM node is created (no trace in the DOM).
    continue;
  }
  const element = ELEMENTS_BY_ID.get(id);
  ...
```

The default board view still lists both ids (`data/animation.json` sequence
`board`, lines 116–117; `defaultBoardView()` only hides
`loading_banner`/`score_feedback`), so the default page render exercises the
skip — the absence assertions in §4 are not vacuous.

**Dead `ELEMENT_DELTA` entries removed.** The table’s only two entries were the
credit sprites (`credit_line`/`credit_site` +0.25/−0.25 px, E2-layout.md §7).
Both entries are deleted; because the table would then be empty and both
lookups dead, the emptied table and its two lookup blocks (inline-SVG branch and
`<img>` branch of `renderSvgElement`) were removed together; the historical
measurement note stays as a comment. This is behavior-preserving: no other
element ever had a delta and no code path could produce one.

## 3. Rect wiring and overlap check

- **Owner region:** `0,367,105,36` (visible sprite bbox union (0,367)–(105,403),
  task input). **Wired rect:** `0,367,105,33` — the F1 tool validates `x+w <=
  width` / `y+h <= height` (“the rect must lie fully inside the image”, schema
  v3), and the 550×400 stage clips the sprites at y=400 (un-clipped bbox reaches
  y=403). The three off-stage rows cannot appear in either image; nothing else
  is clipped. Coordinates are dsf1 stage pixels and scale ×dsf like the Y1 set
  (dsf2 wired rect `0,734,210,66`, inside 1100×800).
- The owner region itself is kept exported as `Y2_CREDIT_OMISSION_RECT`; the
  wired form is `Y2_CREDIT_IGNORE_RECT` (both names visible for review).
- **Wiring:** `boardIgnoreRectArgs(dsf)` = Y1 args (138 rects) followed by the
  Y2 credit arg; `boardIgnoreRects(dsf)` is the matching expected list. The
  three suites pass/assert it at every board comparison (`visual` all board
  states, `animation` all covered keyframes, `playthrough` every compared step
  and the S9 timeout variant). S1 (intro, no backdrop) still gets no allowance
  and asserts `ignoredRects: []`.
- **Overlap with Y1’s rects (checked; duplicates harmless):** the wired rect
  intersects exactly one Y1 rect, `[20,360,240,10]`, in the 367–370 band:
  85×3 = **255 px** at dsf1 (×4 = 1 020 px at dsf2). The tool counts overlapping
  pixels once; measured union:

  | Set | dsf1 px | dsf2 px |
  |---|---|---|
  | Y1 union (`ignoredPixels` with Y1 only, Y1 evidence §6) | 62 720 | 250 880 |
  | Y2 wired credit rect | 3 465 | 13 860 |
  | overlap (Y1 ∩ Y2) | 255 | 1 020 (= 255×4) |
  | **combined union** | **65 930** | **263 720** |

  The suites report exactly these combined numbers (`ignoredPixels=65930` in
  every visual/animation/playthrough board comparison at dsf1; `263720` at
  dsf2) —
  independent confirmation of the overlap computation.

Overlap-check command (one-off, reproducible; output in
`evidence/logs/Y2-rect-overlap.log`; script reads the committed
`Y1_IGNORE_RECTS` array and computes pixel-set unions):

```js
// y2-rect-overlap.mjs — parse tests/e2e/visual-states.ts, compute union/overlap
const y1 = [...src.slice(start, end).matchAll(/\[(\d+), (\d+), (\d+), (\d+)\]/g)]
  .map((m) => m.slice(1).map(Number));
const credit = [0, 367, 105, 33];
// cellsOf(rects) -> Set of y*10000+x; overlap = creditCells ∩ y1Cells
```

Result: `Y1 rects: 138; union 62720 px … overlap … 255 px; per Y1 rect:
20,360,240,10 -> 255 px; combined union: 65930 px … expected dsf2 263720`.

## 4. Absence assertions

New e2e test `Y2 credit omission › credit_line and credit_site are absent from
the rendered board` (`tests/e2e/visual.spec.ts`):

1. after loading the default board (whose view still lists both ids):
   `[data-element="credit_line"]` count **0**, `[data-element="credit_site"]`
   count **0**;
2. a view that explicitly requests `['board_backdrop','credit_line',
   'credit_site']` via the TEST-ONLY `__visualTest.apply` hook renders the
   backdrop (count 1) while both credit ids still create **no DOM node** —
   proving the skip-before-creation invariant, not just the absence of a
   request.

Result in the final visual run: **1 passed** (`Y2 credit omission`, test 18/18).

## 5. Grep proof — no runtime references (`evidence/logs/Y2-grep-proof.log`)

A. Direct asset-path references in runtime/test/tool code — **none**
(`grep -rn -E 's97_credit_line|s103_credit_site' src tests verify tools
index.html vite.config.ts --include='*.ts' … --exclude-dir=ruffle` → exit 1,
no match).

B. Element-id references in app source: only the omission block in
`src/ui/board.ts` (lines 539–552: comment + `OMITTED_ELEMENTS`).

C. Catalog provenance (kept untouched, data only): `src/data/layout.json`
credit entries + asset paths, `data/layout.json` ids, both `animation.json`
`board` sequence ids — unchanged.

D. Untouched-file proof: `data/layout.json` mtime Sep 28 16:36, `src/data/
layout.json` Sep 28 17:09 (both predate this task); the two SVG assets hash
**exactly** to their `src/assets/manifest.json` pins:
`s97_credit_line.svg` = `29ef27bf…c539`, `s103_credit_site.svg` = `58712f67…
94f`.

E. Recorded finding — pre-existing eager asset glob: the dev server fetches
*module wrappers* for every file matched by the generic
`import.meta.glob('../assets/**/*.{svg,png}', {eager:true, query:'?url'})` /
`…'../assets/svg/*.svg', {query:'?raw'})` (unchanged by Y2), and `vite build`
emits every matched asset. Observed during the first visual run (kept as
`evidence/logs/Y2-visual-run1-network-assert.log`): the only s97/s103 requests
are `…/s97_credit_line.svg?import&url`, `?import&raw` and the same for s103 —
i.e. Vite’s wholesale module load, **no bare asset/image request**. In the
bundle these URLs sit unused in the generic asset map because the omission skip
runs before `assetUrl()`; no board element resolves or requests them (A/B +
§4). The glob itself is unchanged and out of this task’s scope.

## 6. Pre/post — visible result

| | Capture | SHA-256 |
|---|---|---|
| pre-fix (credits visible) | `evidence/Y2/pre/S2-dsf1-prefix.png` | `8031e8d1…a3fbf` (= Y1’s after-S2 dsf1 capture byte-identically) |
| pre-fix (credits visible) | `evidence/Y2/pre/S2-dsf2-prefix.png` | `d427613c…6b5a8e` (= Y1’s after-S2 dsf2 capture) |
| post-fix (credits absent) | `evidence/Y2/post/S2-dsf1-postfix.png` | `e752ffcb…2220bd` |
| post-fix (credits absent) | `evidence/Y2/post/S2-dsf2-postfix.png` | `3dc0a798…2a87bcff` |

The pre-fix captures were taken before the first edit (same S2 renderer path;
byte-identical to the Y1 committed captures — deterministic). A rect-free diff
of post vs pre (F1 tool; `evidence/Y2/pre-post-diff/`) shows the change is
confined to the credit sprites:

| Pair | mismatched px | ratio | mismatch bbox | wired rect |
|---|---|---|---|---|
| dsf1 post↔pre | 3 084 | 1.402 % | (0, 369, 104×31) | (0, 367, 105×33) ✔ inside |
| dsf2 post↔pre | 12 336 | 1.402 % | (0, 738, 208×62) | (0, 734, 210×66) ✔ inside |

No other pixel changed anywhere on the stage: the omitted sprites’ ink is gone
and the reference-comparable backdrop pixels otherwise match pre-fix exactly.

## 7. Suite results (final; logs in `evidence/logs/`)

| Suite | Command | Result |
|---|---|---|
| Visual (V5+V2+V7+Y2) | `npm run e2e -- visual` | **18 passed** (`Y2-visual.log`) — S2 tolerant 0.658 % (dsf1, was 0.710 % with Y1 only) / 0.178 % (dsf2, was 0.254 %); S4 0.947 %, worst board state; S1 unchanged 0.062 %/0.015 % with no allowance; every board comparison reports `ignoredPixels=65930`/`263720` and the tool’s `ignoredRects` equals the combined set |
| Animation (V5+V2+V7) | `npm run e2e -- animation` | **8 passed** (`Y2-animation.log`) — board @0.0 tolerant 0.685 % (was 0.737 %), wordball @0.25/0.5278/0.8056/1.0556 = 0.955/0.743/0.743/0.743 % (was 1.031/0.795/0.795/0.795 %) |
| Playthrough (V6+V5) | `npm run e2e -- playthrough` | **3 passed** (`Y2-playthrough.log`) — 40 scripted steps, worst tolerant **1.273 %** (was 1.325 %); every step `ignoredPixels=65930`; S9 timeout variant tolerant **0.567 %** (was 0.619 %), app wait 200 287 ms |
| Unit tests | `npm test` | **13 files / 235 tests passed** (`Y2-test.log`) |
| Lint / build | `npm run lint` / `npm run build` | exit 0 / exit 0 (`Y2-lint.log`, `Y2-build.log`; pre-existing chunk-size warning only) |

Iteration record (kept, not hidden): the first visual run had the new absence
test fail only on an *extra* self-added assertion (“no s97/s103 asset request”)
because the pre-existing eager glob fetches the module wrappers (§5 E); the
assertion tested the wrong layer and was removed, all required DOM absence
assertions stayed. Run kept as `Y2-visual-run1-network-assert.log`; the clean
re-run is `Y2-visual.log`.

## 8. Hash inventory

| Artifact | Before (Y1 evidence §9) | After |
|---|---|---|
| `src/ui/board.ts` | `fc2ec4e8…b19e85` | `58c1cac2ae2ef58215a7c310bc2375d0ca1248bef4bf1305cfc028005c7ee88f` |
| `tests/e2e/visual-states.ts` | `3336e00d…75a477` | `f4c2b3a104dacb5e3b4cd0d16ba10e71a28fb8a3bba54085962c72fd0c4eec0e` |
| `tests/e2e/visual.spec.ts` | `17dd6bcb…6b6d91` | `c54013e0ec68a4220af6c46000b91145b59417100a73b738c983ed4ffd75b3e0` |
| `tests/e2e/animations/animations.spec.ts` | `bb52c827…7a6261` | `9bf3815e9a638303ae2409b674a41a07a9c42175becdf1740c564adde277b09c` |
| `tests/e2e/playthrough/playthrough.spec.ts` | `c01feb20…9800589` | `913a0c3239588e8dcbc0d4245afe21f76a623d291fdb4c4689c4b55c84c9beb0` |
| `src/assets/svg/s97_credit_line.svg` (untouched) | `29ef27bf…76c539` | `29ef27bfc18cad16e03a3ccebe79d046a78b2146f00be02530c88b3d8376c539` |
| `src/assets/svg/s103_credit_site.svg` (untouched) | `58712f67…87d94f` | `58712f673207cd4acc3bad05a06e2437e4cadfc71ed76efeac57142bc687d94f` |
| `src/data/layout.json` (untouched) | — | `f25d873d96a648760172b293ff2f6b36cfe19c3c46a18d516b4e41d90b38253f` |
| `data/layout.json` (untouched) | — | `eb8a098cab21df360cf24dea2f38c2b6b2e56cd16c248b4d6447ce51d3cb292d` |
| `src/data/animation.json` = `data/animation.json` (untouched) | — | `c263ed44b8d352ed72757821f0fd3cbebd58e5c5883dd124ec2229343ce9794e` |

Capture hashes: §6. Logs: `evidence/logs/Y2-visual.log`,
`Y2-visual-run1-network-assert.log`, `Y2-animation.log`, `Y2-playthrough.log`,
`Y2-test.log`, `Y2-lint.log`, `Y2-build.log`, `Y2-rect-overlap.log`,
`Y2-grep-proof.log`, `Y2-capture-hashes.log`, `Y2-source-hashes.log`,
`Y2-pre-visual-s2.log`.

## 9. Proposed docs lines (single-writer: the orchestrator applies these)

**`docs/07-verification.md` §4 — new amendment:**

> Amendment 2026-09-29b (owner final wave Y2): the rebuild intentionally omits
> the two site credit sprites (`credit_line` — DefineSprite_97 “Diğer oyunlar”;
> `credit_site` — DefineSprite_103 “kelimator.com”) from the board render
> (owner directive `tasks/Y2-credit-omission.md`). `src/ui/board.ts`
> (`OMITTED_ELEMENTS`) skips them before any DOM node is created; the former
> `ELEMENT_DELTA` entries for them are deleted. Every static/animation/
> playthrough V5 comparison of a board state passes the owner-approved omission
> region `0,367,105,36` (visible sprite bbox union) as `--ignore-rect`; the F1
> tool requires rects inside the image and the stage clips the sprites at
> y=400, so the wired rect is `0,367,105,33` (3 off-stage rows), scaled
> ×deviceScaleFactor per the Y1 convention. The region overlaps Y1’s
> `[20,360,240,10]` by 255 px (dsf1); overlaps are counted once (union
> `ignoredPixels` 65 930 / 263 720 at dsf1/dsf2). Catalog entries, animation
> entries and the s97/s103 assets remain as provenance (untouched; hashes
> recorded). Thresholds unchanged; absence is asserted by `tests/e2e/
> visual.spec.ts` (“Y2 credit omission”). Evidence: `evidence/Y2-credits.md`,
> matching entry in `docs/08-open-items.md` (Amendments).

**`docs/08-open-items.md` — proposed Amendment entry:**

> - 2026-09-29 — Owner final wave Y2 (`docs/07` §4 omission region): the two
>   site credit sprites (`credit_line`/`credit_site`) are omitted from the
>   board render (`src/ui/board.ts` `OMITTED_ELEMENTS`, skip before DOM
>   creation; dead `ELEMENT_DELTA` entries removed); absence asserted in
>   `tests/e2e/visual.spec.ts` (default + explicit view); all board
>   comparisons pass the owner-approved omission region `0,367,105,36` (wired
>   stage-clipped as `0,367,105,33`; 255 px overlap with Y1’s
>   `[20,360,240,10]`, union-counted). `data/layout.json`,
>   `src/data/layout.json` and the s97/s103 assets untouched (provenance;
>   asset hashes = manifest pins; grep shows no runtime reference). Suites
>   re-run green (visual 18, animation 8, playthrough 3; worst tolerant
>   1.273 %). Evidence: `evidence/Y2-credits.md`.

## 10. Silent witness and hygiene

- Every browser run (pre/post captures, all three suites) used Chromium with
  `--mute-audio` (playwright.config.ts); no sound was played or decoded; no
  Ruffle run, no network beyond the local dev server.
- Writes only to the task’s owned paths: `src/ui/board.ts`,
  `tests/e2e/visual-states.ts`, `tests/e2e/visual.spec.ts`,
  `tests/e2e/animations/animations.spec.ts`,
  `tests/e2e/playthrough/playthrough.spec.ts`, `evidence/Y2/**`,
  `evidence/logs/Y2-*`. No `docs/**` edit; no git state change;
  `../kelimator-nostalji/` untouched (its fixtures are read-only test inputs).
- `s97`/`s103` assets and the four catalog files were read but never written
  (mtime/hash proof in §5 D and §8).

## 11. Result

**PASS** — both credit sprites omitted before DOM creation (2/2), absence
assertions pass, the owner-approved omission region is wired into all three
comparison suites with the overlap to Y1’s set measured and union-verified, the
catalogs/assets are untouched (hashes = manifest pins; no runtime code
references the assets), and visual/animation/playthrough/unit/lint/build are
green with ratios at or below the Y1 baselines.
