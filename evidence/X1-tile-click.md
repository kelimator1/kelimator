# X1 — Tile Center Click Fix (owner defect 1)

Task: X1 — Tile Center Click Fix (owner defect 1)
Started: 2026-09-28T20:25:21Z (first logged X1 command, environment capture; the
interaction suite was written immediately before it)
Ended: 2026-09-28T20:43:14Z (final artifact/log hash capture; last test command
`npm run e2e -- playthrough:basic` green)
Host+OS: dev-host.home / macOS (build hidden), arm64 / arm64 host
Commands executed (exact): §5 (all raw output in `evidence/logs/X1-*.log`)
Exit codes: `npm run e2e -- interaction` **1** pre-fix (6 failed — defect
reproduced) and **0** post-fix (6 passed); `npm test` 0 (13 files / 227 tests);
`npm run lint` 0; `npm run build` 0; `npm run e2e -- visual` 0 (17/17 passed);
`npm run e2e -- playthrough:basic` 0 (1 passed); `npx playwright test
interaction --list` 0 (6 tests)
Output summary: `src/ui/board.ts` — tile letter label made transparent to
pointer events (2 lines + comment, no other behavior touched);
`tests/e2e/interaction/interaction.spec.ts` — 6 new e2e tests (center clicks at
deviceScaleFactor 1 and 2 + O15 edge checks); 10 raw logs
Artifact SHA-256 hashes: §7
Result: PASS

---

## 1. Defect and root cause

The owner-reported defect (verified root cause, relied upon, not re-investigated
beyond reproduction): a click on the CENTER of a letter tile is dropped, while
edge clicks work.

- `src/ui/board.ts` renders each runtime tile as the SVG node
  `data-element="buttonN"` and then appends the letter field
  `<span class="board-text" data-element="letterN">` on a higher z-index
  (`board.ts` `renderTiles()`; the span box is 60×19 px with its top edge at
  `y = 319`, so it fully covers the tile's clickable center at `(60+60N, 330)`).
- `src/main.ts` has exactly one click-delegation path on the board element:
  `target.closest('[data-element]')` and `/^button(\d+)$/` — any other
  `data-element` value (including `letterN`) is ignored (`src/main.ts`
  L221–L234; read-only for X1).
- Therefore a click that lands on the glyph hit `letterN` and was dropped; a
  click that missed the glyph (tile edge/upper area) hit `buttonN` and worked.
  The E3 suite had recorded the workaround itself: “in the rebuild the letter
  field covers that row, so the suite clicks the slot's upper area (60, 310)”
  (`tests/e2e/animations/animations.spec.ts` L60–L64).

Pre-fix reproduction (the new suite run against the unfixed tree;
`evidence/logs/X1-interaction-pre-fix.log`, 6/6 failed):

```
Error: topmost [data-element] at tile 0 center
Expected: "button0"
Received: "letter0"
```

```
Locator:  locator('[data-testid="entry"]')
Expected: "A"
Received: ""
Timeout:  5000ms
```

Every center-click entry assertion failed the same way (list/detail in the
log); this is the “CENTER clicks die, EDGE clicks work” defect.

## 2. Chosen mechanism (one delegation path)

Fix: make the runtime tile letter labels transparent to pointer events in
`src/ui/board.ts` (`renderTiles()`), so a click on the glyph reaches the
`buttonN` node and the existing `/^button(\d+)$/` delegation accepts it:

```ts
    letter.textContent = tile.letter;
    // X1 (owner defect 1): the letter field sits directly over the tile's
    // clickable center (60×19 px box centered on the slot registration point)
    // and the delegation in src/main.ts routes only `buttonN` targets, so a
    // hit on this label was dropped. Chosen mechanism (single delegation
    // path): the label is transparent to pointer events, so every click
    // reaches the `buttonN` node naturally — no `letterN → buttonN` mapping
    // in the handler. evidence: evidence/X1-tile-click.md §2.
    letter.style.pointerEvents = 'none';
```

Why this mechanism was preferred over mapping `letterN → buttonN` in the
handler:

- One delegation path stays the single routing point: `src/main.ts` continues
  to accept only `buttonN`; no second accepted `data-element` form and no
  alias-parsing that could drift.
- No DOM-contract or visual change: `data-element`, `data-testid`
  (`tile-0..7`), z-index, text and metrics are untouched; `pointer-events`
  only affects hit-testing, never paint (V5/V7 below).
- It matches the reference structure: in the SWF the letter text field lives
  inside the tile button sprite (`s58_letter_tile.svg` embeds button 57 with
  the “word” text field), i.e. a click anywhere on the tile — glyph included —
  enters that tile's letter.

`src/main.ts` was NOT modified (hash in §7); `src/ui/board.ts` change is
limited to the tile letter label.

## 3. New e2e suite — `tests/e2e/interaction/interaction.spec.ts`

Fixture: the FİNALİZM bank round through the TEST-ONLY
`window.__game.selectRound(main)` hook (docs/04 §6 amendment; the E3/D5
pattern). Slot letters are read from the rendered board, never hardcoded, and
the click points are the measured reference slot centers
`(60 + 60*slot, 330)` (`verify/reference/capture.mjs` TILE_XS/TILE_Y;
frame_131/DoAction.as `_X = 60 + t*60`, `_Y = 330`), each cross-checked against
the rendered socket center before clicking. Browser muted by config
(`--mute-audio`); audio behavior asserted through `window.__game`.

6 tests (listed by `X1-interaction-list.log`):

1. **tile center clicks — deviceScaleFactor 1** — clicks the CENTER of all 8
   tiles in slot order; for each tile asserts the topmost `[data-element]` at
   the center is `buttonN` (the delegation input; pre-fix this is `letterN`),
   the entry appends that tile's own letter, `lastAudioEvent === 'tileClick'`,
   and after the run all 8 tiles/letter labels are consumed and the entry
   equals the deck in slot order.
2. **tile center clicks — deviceScaleFactor 2** — same assertions at dsf 2.
3. **O15(a)/(c) duplicate letters** — FİNALİZM's two İ tiles: first and second
   click append one İ each; a third İ press (keyboard, O04 code 222) is a
   no-op with no sound (entry and `lastAudioEvent` unchanged); two BACKSPACEs
   restore both tiles and the deck multiset matches the round start.
4. **O15(c) delete/backspace** — tile click consumes tile 0; the Sil control
   click deletes the last letter, restores that tile (`tile-0`, letter label
   and socket checks) and plays `delete`; BACKSPACE on an empty entry is
   sound-only (`delete`), entry and tiles unchanged.
5. **O15(d) scramble** — two clicked letters are cleared by SPACE, every tile
   returns (multiset unchanged; the deck reshuffles), `lastAudioEvent ===
   'scramble'`; a second SPACE with an empty entry still scrambles.
6. **O15(b)/(f) re-submit / empty submit** — the round's first listed 3-letter
   word (`AFİ`, read from `src/data/rounds.json`) is entered by tile-center
   clicks and submitted: score 450 (bonus-free; the first lucky bonus add is
   53 for seed 2012, evidence/D1-round.md §4), entry cleared. Re-entered and
   re-submitted: status `Girildi`, `submitAlreadyFound`, no score change,
   found list unchanged, entry kept (not cleared). Finally ENTER with an empty
   entry: `submitInvalid`, board state unchanged.

## 4. Verification results (same tree as this evidence)

| # | Check | Result | Log |
|---|---|---|---|
| 1 | `npm run e2e -- interaction` (pre-fix) | **6 failed** (defect reproduced; exit 1) | `X1-interaction-pre-fix.log` |
| 2 | `npm run e2e -- interaction` (post-fix) | **6 passed** (exit 0) | `X1-interaction.log` |
| 3 | `npx playwright test interaction --list` | 6 tests in 1 file (exit 0) | `X1-interaction-list.log` |
| 4 | `npm test` | 13 files / **227 tests passed** (exit 0) | `X1-test.log` |
| 5 | `npm run lint` | exit 0 | `X1-lint.log` |
| 6 | `npm run build` | exit 0 (`tsc --noEmit && vite build`) | `X1-build.log` |
| 7 | `npm run e2e -- visual` | **17 passed** (16 V5 state/dsf pairs + V7), exit 0 | `X1-visual.log` |
| 8 | `npm run e2e -- playthrough:basic` | **1 passed** (FİNALİZM full playthrough), exit 0 | `X1-playthrough-basic.log` |

The V5 tolerant ratios in the green visual run are unchanged from the E2
recorded range (e.g. S10 dsf2 tolerant 0.411 %), i.e. the pointer-events fix
has no visual effect. `npm test` includes the unit suites of the parallel
tasks present in the shared checkout at run time; all 227 passed.

### Environment interference observed (recorded, not hidden)

- One post-fix interaction run failed 2/6 with the app rebooting mid-test
  (Vite HMR full reload while parallel workers X2/X3 wrote shared `src/**`
  files on the shared dev server; page snapshot showed a re-booted sequential
  round — letters `C I B I L K A A`, score 0, timer 200). Log:
  `X1-interaction-hmr-interference.log`; the recorded rerun is green.
- One visual run failed `S2 dsf2` with
  `diff: cannot read actual.png: ENOENT` because a concurrent Playwright run
  cleaned the shared `test-results/` between the screenshot and the diff
  invocation; the rerun is green (recorded `X1-visual.log`). The transient
  failure log was superseded by that rerun; the quoted error is the full
  failure text.

Both incidents are cross-worker file/CLI activity in the shared checkout, not
product regressions; the final recorded runs for every check are green.

## 5. Commands executed (exact) and exit codes

| # | Command (exact, from the repository root) | Exit |
|---|---|---|
| 1 | `npx playwright test interaction --list` | 0 |
| 2 | `npm run e2e -- interaction --reporter=line > evidence/logs/X1-interaction-pre-fix.log 2>&1` | 1 (pre-fix) |
| 3 | `npm run e2e -- interaction --reporter=line > evidence/logs/X1-interaction.log 2>&1` | 0 |
| 4 | `npm run e2e -- interaction --reporter=line > evidence/logs/X1-interaction.log 2>&1` (same command; HMR-interference run moved to `X1-interaction-hmr-interference.log`) | 0 |
| 5 | `npx playwright test interaction --list > evidence/logs/X1-interaction-list.log 2>&1` | 0 |
| 6 | `npm test > evidence/logs/X1-test.log 2>&1` | 0 |
| 7 | `npm run lint > evidence/logs/X1-lint.log 2>&1` | 0 |
| 8 | `npm run build > evidence/logs/X1-build.log 2>&1` | 0 |
| 9 | `npm run e2e -- visual --reporter=line > evidence/logs/X1-visual.log 2>&1` | 0 |
| 10 | `npm run e2e -- playthrough:basic --reporter=line > evidence/logs/X1-playthrough-basic.log 2>&1` | 0 |
| 11 | `{ date -u …; sw_vers; uname -m; hostname; node --version; npm --version; npx playwright --version; } > evidence/logs/X1-env.log 2>&1` | 0 |
| 12 | `grep -n "pointerEvents" src/ui/board.ts` (sanity, §2) | 0 |

## 6. Docs proposal (NOT applied — `docs/**` is not owned by X1)

Per EXECUTION.md §9.4 only the orchestrator may amend docs. Proposed addition to
`docs/05-game-core.md` §3 “Input rules”, appended to the first bullet
(“Clicking a tile appends its letter (if available).”):

> Clicking anywhere on a tile enters its letter, including the letter glyph:
> the runtime letter field is pointer-events-transparent and the single click
> delegation matches only `buttonN` (`src/main.ts`); X1,
> `evidence/X1-tile-click.md` §2.

## 7. Artifact SHA-256 hashes

| Artifact | SHA-256 |
|---|---|
| `src/ui/board.ts` (fixed) | `1e4d6ec1427d2ad7fc7257e2e9e9dc5042d60fb2f8bb445590df6e4a4cd20c6c` |
| `tests/e2e/interaction/interaction.spec.ts` (new) | `0a7161de891a2e6c746b6a48a90a6f7832eb5bd8c2bd9ac2ca64c19044de5819` |
| `src/main.ts` (unchanged delegation, reference) | `7078f62036193e0b5c477a124db1a449cc89b4fcdac06b7c5da7985d075fa750` |
| `evidence/logs/X1-interaction-pre-fix.log` | `b1b29203ff9b6c5bed9ea4c7c46c091cc1c0fbc24b9aaf5e3c256b861528c1e9` |
| `evidence/logs/X1-interaction.log` | `a2e9df4fec681d197b2a9a741ec2cfeea626b8ee6ebec3de4375a109698f709c` |
| `evidence/logs/X1-interaction-hmr-interference.log` | `d10006ae48e50f28e0d08acc57657f86e9a306f05c88a9e63470d1e4efd1e64f` |
| `evidence/logs/X1-interaction-list.log` | `62879a1119dc991c580eeee5726591497e575b6c511fa76c6ff2cb43a8c2f757` |
| `evidence/logs/X1-test.log` | `811326f6918e4f1ce80d71e6e59ac7681da010e7c5480f1ebc82b5d3d2a565ad` |
| `evidence/logs/X1-lint.log` | `1127abec44245b91cc3e51990e56293ddb992d67248afcfa1440f5ffa3f11ad1` |
| `evidence/logs/X1-build.log` | `2735034ef7aa07dfabf38382dfd0f98db1c85c68e3f1b442a1f76c3d49ce4c08` |
| `evidence/logs/X1-visual.log` | `44dc2a163bbfac629e13d0f6ea744ac1de0cb3c166165ef9df6547e009b10a88` |
| `evidence/logs/X1-playthrough-basic.log` | `d98f7b65dd8a0d508082632723214c5fd239df41bd297b9b6ea274ef07308133` |
| `evidence/logs/X1-env.log` | `2bd5b7ef15cee0b332b9454212f3478ae977af133266a44e67880ff91a42be7a` |

## 8. Result

**PASS** — center clicks on all 8 tiles now append the correct letter at
deviceScaleFactor 1 and 2 (pre-fix suite: 6 failed; post-fix: 6 passed); the
O15 edge checks match `evidence/A2-edges.md`; E2 visual 17/17, D5
playthrough:basic, full `npm test` (227), lint and build are green. No git
operations were performed (task instruction); committing `task: X1 tile center
click fix` is the orchestrator's step.
