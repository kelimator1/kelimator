# Y3 — Karıştır/Sil Hit-Area Swap Fix (owner defect, wave Y)

Task: Y3 — Karıştır/Sil Hit-Area Swap Fix (owner defect, wave Y)
Started: 2026-09-29T10:03:20Z (first logged Y3 command — pre-fix unit run; all
raw output in `evidence/logs/Y3-*.log`)
Ended: 2026-09-29T10:06:34Z (final interaction rerun + hash capture; last test
command green)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact): §5 (all raw output in `evidence/logs/Y3-*.log`)
Exit codes: `npm test -- hud` **1** pre-fix (3 failed — defect reproduced) and
**0** post-fix (3 passed); `npm run e2e -- controls` **1** pre-fix (2 failed /
2 passed — Karıştır→delete and Sil→scramble observed) and **0** post-fix
(4 passed); `npm run e2e -- visual` 0 (18 passed); `npm run e2e --
playthrough:basic` 0 (1 passed); `npm run e2e -- interaction` 0 (6 passed);
`npm test` 0 (14 files / 238 tests); `npm run lint` 0; `npm run build` 0
(`tsc --noEmit && vite build`)
Output summary: `src/ui/hud.ts` — `CONTROL_RECTS` moved onto an exported pure
`CONTROL_ELEMENT_IDS` mapping (the two swapped lookups fixed:
`scramble → btn_kbuton`, `delete → btn_sbuton`; `submit → btn_ebuton`
unchanged) with `// evidence:` comments; `tests/hud-controls.test.ts` — 3 pure
node tests (mapping + catalog bbox equality + literal A3 coordinates);
`tests/e2e/controls/controls.spec.ts` — 4 raw-mouse-click tests at the CENTER
of the visible label bboxes in scaled stage coordinates (1.8×) + keyboard
spot-check; 15 raw logs
Artifact SHA-256 hashes: §8
Result: PASS

---

## 1. Defect and root cause

Owner-reported defect (authoritative, reproduced by the pre-fix runs in §4):
clicking "Karıştır" deleted the last letter and clicking "Sil" shuffled the
deck. The keyboard SPACE/ENTER/BACKSPACE paths were unaffected.

Root cause: `src/ui/hud.ts` `CONTROL_RECTS` mapped the two transparent
overlays onto each other's sprites — `scramble → layoutElement('btn_sbuton')`
and `delete → layoutElement('btn_kbuton')`. The borders of the visible sprites
are proven by `evidence/A3-diffs.md` §2 (2012 build, SWF frame 131):

| A3 row | name | display bbox (x0,y0,x1,y1) | label |
|---|---|---|---|
| 63 | `kbuton` | (156.25, 367.95, 232.35, 389.65) | Karıştır |
| 65 | `ebuton` | (232.85, 367.95, 302.15, 389.65) | Ekle |
| 105 (2012-only) | `sbuton` | (308.60, 367.95, 377.90, 389.65) | Sil |

The reference actions are decoded from the decompiled 2012 build
(`artifacts/decompiled/scripts/DefineButton2_<sprite>/BUTTONCONDACTION
on(release).as`, three files read verbatim):

```
DefineButton2_63/BUTTONCONDACTION on(release).as  →  on(release){ karistir(); }
DefineButton2_65/BUTTONCONDACTION on(release).as  →  on(release){ ekle(); }
DefineButton2_105/BUTTONCONDACTION on(release).as →  on(release){ sil(); }
```

Sprite 63 = `kbuton` = the "Karıştır" label ⇒ `scramble`; sprite 65 =
`ebuton` = "Ekle" ⇒ `submit`; sprite 105 = `sbuton` = "Sil" ⇒ `delete`.

## 2. Fix

`src/ui/hud.ts`: the four rectangles are now derived from one exported pure
mapping (the only place the control→element choice lives), and the swapped pair
is corrected (the pre-fix tree carried exactly the old values in the same
structure, see §4):

```ts
export const CONTROL_ELEMENT_IDS = {
  submit: 'btn_ebuton',
  scramble: 'btn_kbuton',
  delete: 'btn_sbuton',
  newRound: 'btn_ybuton',
} as const;

export const CONTROL_RECTS = {
  submit: layoutElement(CONTROL_ELEMENT_IDS.submit),
  scramble: layoutElement(CONTROL_ELEMENT_IDS.scramble),
  delete: layoutElement(CONTROL_ELEMENT_IDS.delete),
  newRound: layoutElement(CONTROL_ELEMENT_IDS.newRound),
} as const;
```

The doc block above the mapping carries the `// evidence:` comments citing the
three BUTTONCONDACTION files and the `evidence/A3-diffs.md` rows for 63/65/105
(§1). `submit → btn_ebuton` was already correct and is unchanged; keyboard
handling (`src/game/input.ts` / `src/main.ts`) is untouched.

## 3. Mapping table (control → element → reference action)

| Control | Catalog element | Sprite | Reference `on(release)` | BUTTONCONDACTION file | A3-diffs row, bbox (x0,y0,x1,y1) |
|---|---|---|---|---|---|
| `submit` | `btn_ebuton` | 65 | `ekle();` | `DefineButton2_65/BUTTONCONDACTION on(release).as` | row 65, (232.85, 367.95, 302.15, 389.65) |
| `scramble` | `btn_kbuton` | 63 | `karistir();` | `DefineButton2_63/BUTTONCONDACTION on(release).as` | row 63, (156.25, 367.95, 232.35, 389.65) |
| `delete` | `btn_sbuton` | 105 | `sil();` | `DefineButton2_105/BUTTONCONDACTION on(release).as` | 2012-only row 105, (308.60, 367.95, 377.90, 389.65) |
| `new-round` | `btn_ybuton` | 71 | (out of this defect's scope) | — | row 71, (445.8, 196.45, 544.1, 218.15) |

Catalog rectangles in `src/data/layout.json` are (x, y, w, h): `btn_kbuton`
(156.25, 367.95, 76.1, 21.7); `btn_ebuton` (232.85, 367.95, 69.3, 21.7);
`btn_sbuton` (308.6, 367.95, 69.3, 21.7) — asserted literally by
`tests/hud-controls.test.ts` against the exported mapping.

## 4. Regression tests (new)

### 4.1 `tests/hud-controls.test.ts` (pure node, no DOM)

Imports the exported `CONTROL_ELEMENT_IDS` / `CONTROL_RECTS` from
`src/ui/hud.ts` and `src/data/layout.json`; 3 tests:

1. mapping guard — `scramble=btn_kbuton`, `delete=btn_sbuton`,
   `submit=btn_ebuton`, `newRound=btn_ybuton`, plus
   control → mapped element → decoded reference action
   (`karistir`/`ekle`/`sil`) consistency;
2. each control rectangle equals the catalog bbox of the element the mapping
   names (`CONTROL_RECTS.scramble ==` `btn_kbuton` bbox etc.; the swapped pair
   would land on each other's bbox, and the widths differ 76.1 vs 69.3);
3. literal cross-check of the recorded A3 coordinates (156.25/232.85/308.6,
   y 367.95, h 21.7) against both the catalog and the exported rectangles,
   plus asset-id checks (`s63_btn_kbuton.svg`, `s65_btn_ebuton.svg`,
   `s105_btn_sbuton.svg`) and pairwise-distinct bboxes.

Pre-fix run (against the swapped mapping) — **3 failed**, exit 1,
`evidence/logs/Y3-hud-tests-pre-fix.log`:

```
AssertionError: expected { submit: 'btn_ebuton', …(3) } to deeply equal { submit: 'btn_ebuton', …(3) }
AssertionError: scramble rect: expected { x: 308.6, y: 367.95, w: 69.3, …(1) } to deeply equal { x: 156.25, y: 367.95, w: 76.1, …(1) }
Test Files  1 failed (1); Tests  3 failed (3)
```

Post-fix run — **3 passed**, exit 0, `evidence/logs/Y3-hud-tests.log`.

### 4.2 `tests/e2e/controls/controls.spec.ts` (scaled-stage label clicks)

4 tests; the controls are driven by raw `page.mouse.click` at the CENTER of the
visible label sprite (`[data-element="btn_*"]`) in scaled stage coordinates —
never by clicking a `data-testid` overlay. The point is computed from the
catalog rect and the rendered `stage-root` transform (1280×720 viewport ⇒ 1.8×
letterboxed stage) and cross-checked (≤0.5 px) against the sprite's rendered
Playwright bounding box. Each test additionally asserts the topmost
`.game-control` at that point is the matching overlay (`controlUnder`).

1. `btn_kbuton` center (Karıştır) → `lastAudioEvent === 'scramble'`, entry
   cleared, deck multiset restored and **deck order changed**;
2. `btn_sbuton` center (Sil) → `lastAudioEvent === 'delete'`, the entered
   letter removed and its tile/letter label restored;
3. `btn_ebuton` center (Ekle) → `lastAudioEvent === 'submitValid'`,
   found list `[AFİ]`, score 450 (bonus-free);
4. keyboard spot-check: SPACE → `scramble`, BACKSPACE (empty entry) →
   `delete`, typing `AFİ` + ENTER → `submitValid`, score 450.

Pre-fix run — **2 failed / 2 passed**, exit 1,
`evidence/logs/Y3-controls-pre-fix.log`:

```
1) clicking the CENTER of the Karıştır label (btn_kbuton) scrambles: event + deck order
   Expected: "scramble"  Received: "delete"   (Timeout 5000ms exceeded while waiting on the predicate)
2) clicking the CENTER of the Sil label (btn_sbuton) deletes the last entry letter
   Expected: "delete"  Received: "scramble"   (Timeout 5000ms exceeded while waiting on the predicate)
2 failed — [1] Karıştır …, [2] Sil …; 2 passed (20.8s)
```

The two pre-fix failures are the owner defect itself: the Karıştır label
dispatched the delete action and the Sil label dispatched the scramble action.
The Ekle-submit and keyboard tests passed pre-fix (the submit mapping was
already correct and the keyboard path never used `CONTROL_RECTS`).

Post-fix run — **4 passed**, exit 0, `evidence/logs/Y3-controls.log`.

## 5. Commands executed (exact) and exit codes

| # | Command (exact, from the repository root) | Exit |
|---|---|---|
| 1 | `npm test -- hud > evidence/logs/Y3-hud-tests-pre-fix.log 2>&1` | 1 (pre-fix: 3 failed) |
| 2 | `npm run e2e -- controls --reporter=line > evidence/logs/Y3-controls-pre-fix.log 2>&1` | 1 (pre-fix: 2 failed / 2 passed) |
| 3 | `npm test -- hud > evidence/logs/Y3-hud-tests.log 2>&1` | 0 (3 passed) |
| 4 | `npm run e2e -- controls --reporter=line > evidence/logs/Y3-controls.log 2>&1` | 0 (4 passed) |
| 5 | `npm run e2e -- visual --reporter=line > evidence/logs/Y3-visual.log 2>&1` | 0 (18 passed) |
| 6 | `npm run e2e -- playthrough:basic --reporter=line > evidence/logs/Y3-playthrough-basic.log 2>&1` | 0 (1 passed) |
| 7 | `npm run e2e -- interaction --reporter=line > evidence/logs/Y3-interaction.log 2>&1` | 0 (6 passed) |
| 8 | `npm test > evidence/logs/Y3-test-full.log 2>&1` | 0 (14 files / 238 tests) |
| 9 | `npm run lint > evidence/logs/Y3-lint.log 2>&1` | 0 |
| 10 | `npm run build > evidence/logs/Y3-build.log 2>&1` | 0 |
| 11 | `{ date -u; sw_vers; uname -m; hostname; node --version; npm --version; npx playwright --version; } > evidence/logs/Y3-env.log 2>&1` | 0 |
| 12 | `shasum -a 256 src/ui/hud.ts tests/hud-controls.test.ts tests/e2e/controls/controls.spec.ts evidence/logs/Y3-*.log \| tee evidence/logs/Y3-hashes.log` | 0 |

Regression notes: `npm run e2e -- visual` 18/18 (V5 state/dsf pairs + V7 +
Y2 credit omission) — the overlay rectangles are not painted, so the visual
states are unchanged; `playthrough:basic` 1/1 (FİNALİZM completion, Yeni Oyun);
`interaction` 6/6 (its `[data-testid="delete"]` click path and the O15 checks
still behave as before — the testid→handler binding is unchanged, only the
rectangle placement was fixed). Silent witness runs (EXECUTION.md §8): all
Playwright projects launch Chromium with `--mute-audio`; this task played no
sound and no external network was used.

## 6. Superseding note — `evidence/D5-lifecycle.md` (file NOT rewritten)

`evidence/D5-lifecycle.md` §6, lines 163–164, records the swapped mapping:

```
163:   four button sprites at the `src/data/layout.json` rectangles (`submit`
164:   btn_ebuton, `scramble` btn_sbuton, `delete` btn_kbuton, `new-round`
```

**SUPERSEDED (Y3, 2026-09-29):** the `scramble btn_sbuton` / `delete
btn_kbuton` element ids on D5 line 164 are wrong and are inverted here. The
authoritative mapping is `scramble → btn_kbuton` (sprite 63, `karistir();`) and
`delete → btn_sbuton` (sprite 105, `sil();`); `submit → btn_ebuton` (sprite 65,
`ekle();`) was and remains correct. Evidence: the three BUTTONCONDACTION files,
`evidence/A3-diffs.md` §2 rows 63/65/105 (§1) and the pre/post runs in §4 above.
D5's file is intentionally left unmodified (Y3 owned paths); this note is the
supersession of record until the owning task/orchestrator updates it.

## 7. Docs proposal (NOT applied — `docs/**` is not owned by Y3)

No `docs/**` file records the wrong element mapping, so no correction is
required there. For completeness, the following line is proposed for
`docs/05-game-core.md` §3 "Input rules" (mouse controls):

> Clicking the Karıştır/Sil/Ekle sprites (or their transparent overlays) runs
> the same action as SPACE/BACKSPACE/ENTER respectively; the overlay rectangles
> are keyed to `btn_kbuton`/`btn_sbuton`/`btn_ebuton` per the decompiled
> `on(release)` actions (Y3, `evidence/Y3-buttons.md` §3).

## 8. Artifact SHA-256 hashes

| Artifact | SHA-256 |
|---|---|
| `src/ui/hud.ts` (fixed) | `4c36519429767ec2492df43478daeee662f4b373e201f40ff96f518b3b6cac6f` |
| `tests/hud-controls.test.ts` (new) | `ab51eae943952d3152766623d997beff68e4231ade995024d489fac3984af0c9` |
| `tests/e2e/controls/controls.spec.ts` (new) | `419de258ceb5494f87abd762695fcdd693acd7ebd3af7ac29c068bc46310b1d6` |
| `evidence/logs/Y3-hud-tests-pre-fix.log` | `c0d216f851687a59decc60b3ed1a88a72acc28207cadfe7bf0e19fc7f054b59f` |
| `evidence/logs/Y3-hud-tests.log` | `2d8b9fd0ce08d386c5f5eef5c24ab6048dddd229d91bd843c43f82842c3bee8a` |
| `evidence/logs/Y3-controls-pre-fix.log` | `e57cb2d26d321c83f457db9b47627ff15c318abb55c2a210a8d895daa695164a` |
| `evidence/logs/Y3-controls.log` | `2dd9ec97157884382add1f8f2b127265220122a4793fd8e447271db8689b5559` |
| `evidence/logs/Y3-visual.log` | `d22cddc1756113103300d15584752279026b935dc26e83a34a7d09c57c222478` |
| `evidence/logs/Y3-playthrough-basic.log` | `6e45d9f9597cae0b91c5b086efe13e2d43ced6c6474b6e01f2a8431ccdbb3007` |
| `evidence/logs/Y3-interaction.log` | `382f8a84676d3a314266d240af072a86a33898635f628d3da173869f6112157c` |
| `evidence/logs/Y3-test-full.log` | `233803229b48590c68a87bbe6a65e4c3150b4160791e9db9b6c6e6d5571017f6` |
| `evidence/logs/Y3-lint.log` | `f15360226e6544f50b6eeaa5ce07acb3b18c913809260ba934fc9e02c9d185bd` |
| `evidence/logs/Y3-build.log` | `a31f03c3e8fd441b864caf6c9093232c6ab14ef827bcd6d7085225e82cb09d5f` |
| `evidence/logs/Y3-env.log` | `6bd33f06c8d6db2de841dc44d338a228ca2fb8a359b818eaf0e0069c8d5224bb` |
| `evidence/logs/Y3-hashes.log` | `1d8c6507bf267d03a4a5d323bea9828fc36277d152ba1f2cf60cd1ab8859bfbe` |

## 9. Result

**PASS** — the overlays now sit on the sprites whose decompiled `on(release)`
actions match their labels (`scramble → btn_kbuton`, `delete → btn_sbuton`,
`submit → btn_ebuton`): pre-fix the scaled-stage clicks produced
Karıştır→`delete` and Sil→`scramble` (2 e2e failures + 3 unit failures); post-fix
the controls suite is 4/4 and the unit suite 3/3. Visual (18/18),
playthrough:basic (1/1), interaction (6/6), full `npm test` (14 files / 238
tests), lint and build are green. No git operations were performed (task
instruction); no `docs/**` or `evidence/D5-lifecycle.md` content was modified.
Committing `task: Y3 karıştır/sil hit-area fix` is the orchestrator's step.
