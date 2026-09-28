# X4 — Timeout Reveal Colour (owner defect wave extension; found by F2)

Task: X4 — Timeout Reveal Colour (found by F2)
Started: 2026-09-28T20:59:22Z (first artifact write, `tests/e2e/timeout/reveal-colour.spec.ts`;
the session began earlier with the task file, `evidence/F2-playthrough.md` §6/§7.1 and the
source reads)
Ended: 2026-09-28T21:10:24Z (`date -u` after the final artifact/log hash capture)
Host+OS: dev-host.home / macOS (hidden), arm64 / arm64 host (Node v22.14.0,
npm 10.9.0, Playwright 1.63.0, vitest 5.0.2)

Commands executed (exact), exit codes and logs:

| # | Command | Exit | Log |
|---|---|---|---|
| 1 | `NO_COLOR=1 npm run e2e -- timeout --reporter=line` (post-fix, first run) | 0 | `evidence/logs/X4-focused-timeout.log` (1 passed, 1.8 s) |
| 2 | `NO_COLOR=1 npm run e2e -- timeout --reporter=line` (temporary pre-fix state) | **1** | `evidence/logs/X4-focused-prefix.log` (defect reproduced: `slot_3_1 AFİ` expected `rgb(255, 102, 0)`, received `rgb(0, 0, 0)`) |
| 3 | `NO_COLOR=1 npm run e2e -- timeout --reporter=line` (after exact restore) | 0 | `evidence/logs/X4-focused-green.log` (1 passed, 1.7 s) |
| 4 | `NO_COLOR=1 npm run e2e -- playthrough --reporter=line` (F2 suite, live mode) | 0 | `evidence/logs/X4-playthrough.log` (3 passed: basic + 40-step playthrough + S9; S9 raw 7.730 % tolerant **0.901 %** pass=true stable=true) |
| 5 | `NO_COLOR=1 npm run e2e -- playthrough -g "S9" --reporter=line` (repeat, machine-readable record) | 0 | `evidence/logs/X4-playthrough-s9.log` (raw 7.730 % tolerant **0.901 %** pass=true stable=true) |
| 6 | `NO_COLOR=1 npm run e2e -- visual --reporter=line` | 0 | `evidence/logs/X4-visual.log` (17/17 passed) |
| 7 | `NO_COLOR=1 npm run e2e -- interaction --reporter=line` | 0 | `evidence/logs/X4-interaction.log` (6/6 passed) |
| 8 | `NO_COLOR=1 npm test` | 0 | `evidence/logs/X4-test-full.log` (13 files / 227 tests passed) |
| 9 | `NO_COLOR=1 npm run lint` | 0 | `evidence/logs/X4-lint.log` (0 diagnostics) |
| 10 | `NO_COLOR=1 npm run build` | 0 | `evidence/logs/X4-build.log` (expected >500 kB chunk warning) |
| 11 | `node --input-type=module -e '…'` (exact-`#ff6600` ink probe, §4) | 0 | `evidence/logs/X4-reveal-ink-probe.log` |
| 12 | `shasum -a 256 …` (sources/logs/records; F2 files untouched) | 0 | `evidence/logs/X4-artifact-hashes.log`, `X4-source-hashes.log`, `X4-f2-untouched.log` |

Output summary: `src/ui/board.ts` — `FoundWordView.revealed` + one
`REVEALED_SLOT_COLOR` constant + the revealed-slot colour branch (3 hunks, no other
behaviour touched; E2's layout render and X1's pointer-events fix intact);
`src/main.ts` — the `revealed` flag mapped from `snapshot.listedFound` into the board
view (1 hunk); `tests/e2e/timeout/reveal-colour.spec.ts` — 1 focused e2e test (clock-driven
timeout; asserts revealed slots `rgb(255, 102, 0)`, the found slot black before and after).
F2's S9 variant now passes: tolerant **0.901 %** (was **2.0145 %**), raw 7.730 %
(17 006/220 000 px; tolerant 1 983/220 000). All other gates green.

Artifact SHA-256 hashes: §7
Result: PASS

---

## 1. Reference excerpt (verified cause, relied upon)

`artifacts/decompiled/scripts/frame_131/DoAction.as` L566–571 (`tamamla()`):

```
         if(v)
         {
            set("sonuclar" add e add "_" add s,dizi[t]);
            d = eval("s" + e + "_" + s);
            d.textColor = 16737792;
            s++;
         }
```

`16737792 = 0xFF6600` (#ff6600) — every listed-but-unfound word revealed at timeout is
coloured; words already found (present in `sonuclar`) are skipped by the `if(v)` guard and
keep the field's default black (F2's `38-valid` control: found words black on both sides,
`evidence/F2-playthrough.md` §6).

## 2. Change (owned paths only)

`src/ui/board.ts`:

```ts
export interface FoundWordView {
  /** Word length 3..8 = box row. */
  len: number;
  /** Zero-based slot in the row. */
  index: number;
  text: string;
  /** True when filled by the timeout reveal (`tamamla()`), not by the player. */
  revealed?: boolean;
}
```

```ts
/**
 * Timeout-reveal text colour. Reference `tamamla()`
 * (artifacts/decompiled/scripts/frame_131/DoAction.as L568–570) writes every
 * listed-but-unfound word into the row and sets `d.textColor = 16737792`
 * (#ff6600) on it; words already found by the player keep the default field
 * colour (black — measured on both sides at F2's `38-valid` control step,
 * evidence/F2-playthrough.md §6). evidence: evidence/X4-reveal-colour.md §2.
 */
const REVEALED_SLOT_COLOR = '#ff6600';
```

```ts
      const found = view.found?.find((word) => word.len === row.len && word.index === j);
      if (found !== undefined) {
        box.textContent = found.text;
        if (found.revealed === true) {
          // Timeout reveal (`tamamla()` L568–570): unfound listed words render
          // #ff6600; player-found words keep the field's default black.
          box.style.color = REVEALED_SLOT_COLOR;
        }
      }
```

`src/main.ts` (`boardViewFor()`): the lifecycle's `ListedWordView.revealed` is now mapped
instead of dropped:

```ts
    found: snapshot.listedFound.map(
      (listed): FoundWordView => ({
        len: listed.length,
        index: listed.index,
        text: listed.word,
        // X4: `tamamla()` colours every timeout-revealed word #ff6600
        // (evidence/F2-playthrough.md §6/§7.1); found words stay black.
        revealed: listed.revealed,
      }),
    ),
```

Untouched (integrity): E2's layout render (static layer, geometry, `TEXT_STYLE`, catalog
rects) and X1's tile-label `letter.style.pointerEvents = 'none'` in `renderTiles()` are
unchanged; the `revealed` field is optional, so all other `FoundWordView` producers
(`tests/e2e/visual-states.ts`) and consumers keep working. `FoundWordView.revealed`
defaults to the black path for every non-timeout state.

## 3. Focused test — `tests/e2e/timeout/reveal-colour.spec.ts`

- Fixture: `FİNALİZM` via the TEST-ONLY `window.__game.selectRound` hook; the player-found
  word is `FAL` (bank-listed). Expected slots are derived from `src/data/rounds.json` with
  the lifecycle's `listedWords()` rule (`min(words, 10)` listed slots; found words first,
  then the reveal fills unfound words in word-list order) — nothing is guessed.
- Timeout mechanism (narrowest evidenced alternative; documented in the spec header): a
  real 200 s wait is prohibitive for a focused check and the app exposes **no** timeout
  hook (`window.__game` has `selectRound` only; inventing one is forbidden). The test
  installs Playwright's fake clock **before load** (`page.clock.install()`) and calls
  `fastForward(201_000)`. The app's own countdown (`src/game/timer.ts`) computes
  `remaining` from `performance.now()` + `setTimeout`, so the pending boundary fires once
  with `remaining = 0` and runs the genuine `onExpired` → `completeTimeout()` transition —
  the same lifecycle path as F2's waited-out S9 (which remains the authoritative reference
  comparison and is re-run by this task, §4/§5).
- Assertions: before the timeout the single filled slot (`slot_3_0 FAL`) is
  `rgb(0, 0, 0)` (non-revealed unchanged); after the timeout the state is `timeout`,
  `remainingMs = 0`, the score is unchanged (O14: no time bonus), all 35 listed slots are
  filled in reveal order, `slot_3_0 FAL` is still `rgb(0, 0, 0)`, and every other filled
  slot is `rgb(255, 102, 0)`.
- Sensitivity: a temporary pre-fix state (colour branch removed, everything else
  identical) fails the test exactly at the revealed colour — `slot_3_1 AFİ` expected
  `rgb(255, 102, 0)`, received `rgb(0, 0, 0)` (`evidence/logs/X4-focused-prefix.log`);
  the source was restored byte-identically (diff vs backup + SHA-256 match,
  `83ee124b…6531`, `X4-source-hashes.log`) and the test passed again (1.7 s).

## 4. S9 result — before/after

| Metric | F2 pre-fix (frozen `evidence/F2-report.json`, hash unchanged) | X4 post-fix (F2 suite re-run) |
|---|---|---|
| raw ratio | 0.0787182 (7.872 %; 17 318 px) | 0.0773 (7.730 %; 17 006 px) |
| **tolerant ratio** | **0.0201455 (2.0145 %; 4 432 px)** | **0.0090136 (0.901 %; 1 983 px)** |
| threshold | 0.020 (2.000 %) | 0.020 (2.000 %) |
| pass | false | true |
| app wait | 200 248 ms | 200 432 ms (suite) / 200 377 ms (repeat) |
| stable final frame | true | true |
| all state checks | true | true (`score`, `found`, `state`, `revealed`, `inputLocked`) |

Robustness: the full F2 suite run and the repeat S9-only run measured the same tolerant
ratio 0.901 % (well inside 2.000 %); the 40-step playthrough stayed green (worst step
tolerant 1.740 % at `04-duplicate-FAL`, no step above threshold). The tolerant pixel delta
vs the pre-fix state (−2 449 px) matches F2's ≈2 337 px estimate for the missing colour.

Auxiliary direct measurement (exact-`#ff6600` pixel count; word-list scan region
x∈[30,370), y∈[40,210) covers box rows 3–8, `X4-reveal-ink-probe.log`):

| Capture | exact `#ff6600` stage | in word-list region | exact `#000` in region |
|---|---|---|---|
| reference (`tests/fixtures/reference/playthrough/timeout/timeout.png` copy) | 4 948 | 2 424 | 3 709 |
| app post-fix (`test-results/F2-live/timeout/actual.png`) | 4 878 | 2 278 | 3 536 |
| app pre-fix (`evidence/visual/F2/timeout/actual.png`, F2 frozen) | 2 600 (HUD labels only) | **0** | 6 121 |

The post-fix app draws the reference's revealed-word ink (`#ff6600` exactly); the pre-fix
app had zero orange pixels in the word list — 2 585 more black pixels there than the
post-fix run (2 412 more than the reference).

Machine-readable S9 records copied from the live run (evidence freeze: live runs write
`test-results/F2-live/**`, which Playwright clears on the next run; F2's frozen evidence
was not touched): `evidence/logs/X4-s9-live-report.json`, `X4-s9-step.json`,
`X4-s9-diff-report.json` (tolerant 0.0090136 ≤ 0.02, 1 983/220 000 px, pass true).

## 5. Commands and exit codes

See the header table. Raw logs: `evidence/logs/X4-focused-timeout.log`,
`X4-focused-prefix.log`, `X4-focused-green.log`, `X4-playthrough.log`,
`X4-playthrough-s9.log`, `X4-visual.log`, `X4-interaction.log`, `X4-test-full.log`,
`X4-lint.log`, `X4-build.log`.

## 6. Deviations, integrity notes

1. F2's suite was run in **live mode** (no `F2_RECORD`), so F2's frozen
   `evidence/F2-report.json` / `evidence/visual/F2/**` were not overwritten (evidence-freeze
   amendment 2026-09-28). The S9 machine-readable records needed for the ratio were copied
   into `evidence/logs/X4-s9-*.json`; F2's own files hash-check unchanged
   (`X4-f2-untouched.log`: `playthrough.spec.ts` `6d6ee47e…`, `build-scenario.mjs`
   `372c6e07…`, `tests/fixtures/playthrough.json` `aa8a1e4f…`,
   `evidence/F2-report.json` `f5301efa…` — all equal F2's recorded values).
2. The focused test's expiry is clock-driven (see §3); the real 200 s wait path is
   exercised by F2's S9 re-run (twice, §4). No app hook was added, used or invented; the
   board itself exposes no testable DOM render path under vitest (no DOM environment
   installed), so the focused check is an e2e spec under the owned path
   `tests/e2e/timeout/**`.
3. No `docs/**` edit (owned-path rule). Proposed `docs/08-open-items.md` line (for the
   orchestrator; style of the X1/X2 entries):

   > - 2026-09-29 — X4 timeout reveal colour (`src/ui/board.ts`/`src/main.ts`): the
   >   lifecycle's `ListedWordView.revealed` flag now reaches the board view and revealed
   >   (timeout) slots render the reference's `#ff6600` (16737792, `tamamla()` L568–570);
   >   player-found slots keep black. Focused e2e `tests/e2e/timeout/reveal-colour.spec.ts`
   >   (fake-clock expiry through the real timer path; pre-fix run fails on the revealed
   >   colour) + F2's S9 re-runs: tolerant 2.0145 % → 0.901 % (raw 7.730 %), pass.
   >   Evidence: `evidence/X4-reveal-colour.md`.
4. Silent witness runs (EXECUTION.md §8): every Playwright run launched Chromium with
   `--mute-audio` (playwright.config.ts); audio behaviour was never verified by
   audibility; no network beyond the local Vite server. No git commands were used.

## 7. Artifact SHA-256

| Artifact | SHA-256 |
|---|---|
| `src/ui/board.ts` | `83ee124b58308fec8661ac72aca2e2d7ebb3869abdae5807adc66e87fe638531` |
| `src/main.ts` | `94a89d24c84890d8d8fbaccbc7c36bb7bc4abde0af1a5a24504981336eaf128e` |
| `tests/e2e/timeout/reveal-colour.spec.ts` | `9e9461dd0af3c4ec0125ad0deff8f6ee128f7b035befd972b7ef81ac12278c57` |
| `evidence/logs/X4-focused-timeout.log` | `711a9a3dd0bab6380f614b0132b7a5af19da3c95050e39cd6b0e76eb679921be` |
| `evidence/logs/X4-focused-prefix.log` | `7a937dd3d345489e95eac44ecf98ce9590876c7ff009912f62bf39e8280959b1` |
| `evidence/logs/X4-focused-green.log` | `4ec8c88f2418ef2ad42d3e47f0bd9168510af5268debd44d1ab95a3ff5e42750` |
| `evidence/logs/X4-playthrough.log` | `63a5c26ee1ce401857f539c29664d534a0c79399cbca4a1400d807b61bed22ca` |
| `evidence/logs/X4-playthrough-s9.log` | `0d33571525ddc8225d263b15aa77816f7730d292c3f82cca5b674c7e0bf9576a` |
| `evidence/logs/X4-s9-live-report.json` | `8805683e6941aea5e889e8373dbb3e2599ca202347d0cbea94f7883874b8b924` |
| `evidence/logs/X4-s9-step.json` | `8302f2359828b6cc4e17e484eafca2f9fb46443e084b127647c866eca054ac8d` |
| `evidence/logs/X4-s9-diff-report.json` | `726a9124be47ad4d05ace56ef31b6797e48bf8334dc0254c5bfd1d0c41396b91` |
| `evidence/logs/X4-visual.log` | `be2e7a9e85df185d754946dd12d9eb1e9e4cae9bed27b4fdca2593bf4e9d12dc` |
| `evidence/logs/X4-interaction.log` | `393a1ff8d1446f8f3a6753831338a1f737d4d788c0e9a60b6e85b7e0c44241f6` |
| `evidence/logs/X4-test-full.log` | `d996c99b9b14ca7ac3ff4975e97f23611ae016fc19cb419d8beade8fcc1ab020` |
| `evidence/logs/X4-lint.log` | `1127abec44245b91cc3e51990e56293ddb992d67248afcfa1440f5ffa3f11ad1` |
| `evidence/logs/X4-build.log` | `e2b15025f85bd7cd758da04fd497575a32b8e5db3ef6b3e8a07858e84e4d6571` |
| `evidence/logs/X4-reveal-ink-probe.log` | `b6bc75e3aa96fb0dfe8cc9cc39fd654e86b6289f16eafd7a41a78f7c3b0631ee` |
| `evidence/logs/X4-source-hashes.log` | `64ba7a7df68718d3d241d700bb2656fe4245047bcfd51e9ecec24bf794d2a307` |
| `evidence/logs/X4-f2-untouched.log` | `8a5e6015979d63a65077882e0675658ca39be0f709da0189209c1950e83e1c31` |
| `evidence/logs/X4-artifact-hashes.log` (hash manifest; §7 rows above) | `f85c81065a285b261aa7175f9e9ce345b6f648d562aa6a6b7ec59a9329697125` |
