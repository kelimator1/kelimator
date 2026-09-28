# D5 — Round Lifecycle and State Machine

Task: D5 — Round Lifecycle and State Machine
Started: 2026-09-28T19:15:00Z (first artifact write, `src/game/state.ts`; file mtime)
Ended: 2026-09-28T19:35:40Z (`date -u`, after the final reruns and evidence
write)
Host+OS: dev-host.home / macOS (hidden, arm64 / arm64 host; Node v22.14.0,
npm 10.9.0, Playwright 1.63.0; `evidence/logs/D5-env.log`)
Commands executed (exact), exit codes and logs:

| # | Command | Exit | Log |
|---|---|---|---|
| 1 | `NO_COLOR=1 npm test -- lifecycle` | 0 | `evidence/logs/D5-test-lifecycle.log` |
| 2 | `NO_COLOR=1 npm test` | 0 | `evidence/logs/D5-test-full.log` |
| 3 | `NO_COLOR=1 npm run lint` | 0 | `evidence/logs/D5-lint.log` |
| 4 | `NO_COLOR=1 npm run build` | 0 | `evidence/logs/D5-build.log` |
| 5 | `NO_COLOR=1 npm run e2e -- playthrough:basic` | 0 | `evidence/logs/D5-e2e-playthrough-basic.log` |
| 6 | `NO_COLOR=1 npm run e2e -- visual` (supplementary, E2 regression) | 0 | `evidence/logs/D5-e2e-visual.log` |
| 7 | `NO_COLOR=1 npm run e2e -- smoke` (supplementary; stale C2 placeholder, §9.4) | 1 | `evidence/logs/D5-e2e-smoke.log` |
| 8 | `shasum -a 256 …` | 0 | `evidence/logs/D5-artifact-hashes.log`, `evidence/logs/D5-hashes.log` |
| 9 | `NO_COLOR=1 npm test` (final rerun after the manual dev server was stopped) | 0 | `evidence/logs/D5-final-rerun-test.log` |
| 10 | `NO_COLOR=1 npm run e2e -- playthrough:basic` (final rerun; Playwright started its own server) | 0 | `evidence/logs/D5-final-rerun-e2e.log` |

Output summary: implemented the O13 finite state machine, the round lifecycle
(new round, submit, cap-aware all-found completion, timeout completion, restart,
input lock), the HUD/status-message UI layer and the `src/main.ts` game wiring
with `window.__game` test hooks; 23 new lifecycle tests (V4/V2/V7) and the
scripted FİNALİZM playthrough (V6).

Artifact SHA-256 (full list in `evidence/logs/D5-hashes.log`):

| Artifact | SHA-256 |
|---|---|
| `src/game/state.ts` | `d9e9fc025075c0cb39f641fd78bc8bb0479a67d09426ed38d7e17f942f72fa3f` |
| `src/game/lifecycle.ts` | `d78520bf1f033267eb7968c3c05ec32d1776bad4112249a9e8536228dfb279a1` |
| `src/ui/hud.ts` | `04705e82acc8be3d879935bdf8f5de0f18aa5d5a39c6b7728f3182d2b0c00c98` |
| `src/ui/message.ts` | `9bcbebfab0a51169073c95d4c083adbde9821cd0d4a3a467b1d6d6fd2508eb33` |
| `src/main.ts` | `733d393990c26a556c6aca3ab63852b6707022c9876369467316b03578d38b88` |
| `tests/lifecycle.test.ts` | `b1f58340c3558dc0255fe37eb252602401d0afeb70ab69c30af8b76741678a18` |
| `tests/e2e/playthrough/playthrough:basic.spec.ts` | `b919ef7c8c4849c3b6e96f4a217888cee06942acd3ab381713031083347ccffb` |
| `data/constants.json` (input, unchanged) | `ea0684028be5eeb892a11ba3699c5dcc93a73f062b1939646df6ec8591e90661` |
| `src/data/rounds.json` (input, unchanged) | `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96` |
| `src/game/round.ts` (D1, unchanged) | `5a17d833d714b09a8247564a1e03c896cd24bedcd8b1311399d021aa2e6957bd` |
| `src/game/input.ts` (D2, unchanged) | `797cb8b0b9b5387d11595d0456b5660d547e0da8ac44b057d84d50dc8c3277fd` |
| `src/game/scoring.ts` (D3, unchanged) | `f9fd5123f938df262eb5a01e46db3705427222e70906891810aef30c69e98cb4` |
| `src/game/timer.ts` (D3, unchanged) | `4e256b5841d1f0d62dd644b0af020bf3800e70be0b7e0c572dfaa5024f84f76e` |
| `src/game/tiles.ts` (D2, unchanged) | `7d9c47fc3112c2d8ff8901d89c421cd53b12753f72ad6cc2fecd4d6684394b66` |

Result: PASS

---

## 1. Finite state machine (`src/game/state.ts`)

States are the reference main-timeline phases resolved by O13
(`evidence/A2-labels.md` §2–§3; `docs/02` §5). `GAME_TRANSITIONS` is the single
transition table; every entry carries an `// evidence:` reference in code.
`isInputLocked(state)` is `state !== 'playing'` (reference `bitti` gate:
`baslat()` sets `bitti = 0`, the completion sequences set it to 1 —
`evidence/A2-edges.md` §3, `evidence/A2-timeout.md` §3).

| From | To | Trigger in code | Evidence |
|---|---|---|---|
| `boot` | `preloader` | `lifecycle.start()` | frame 1 DoAction (MochiAds, removed by O19, `evidence/A2-mochi.md` §3) → frames 2–4 preloader (`evidence/A2-labels.md` §2) |
| `preloader` | `main` | `lifecycle.start()` | frame 4 `gotoAndStop("main")` (`evidence/A2-labels.md` §2) |
| `main` | `playing` | `lifecycle.newRound()` | label `main` frame 5 plays 5→130; frame 131 `init()`/`stop()`; `baslat()` starts the round once the list has loaded (`evidence/A2-labels.md` §3, `evidence/A2-timer.md` §2) |
| `playing` | `celebration` | last listed slot filled (`submit` → `completeAllFound()`) | `bittimi()` → `gotoAndStop("bravo"); play();` (`evidence/A2-labels.md` §2) |
| `playing` | `timeout` | timer expiry (`completeTimeout()`) | timer sprite frame 3 `if(_root.timer == 0)` → `tamamla()` on frame 131 (`evidence/A2-timeout.md` §2–§3) |
| `playing` | `playing` | `newRound()` while a round is live | `ybuton` (`DefineButton2_71`) → `init()`; `baslat()` resets `bitti = 0` (`evidence/A2-labels.md` §3 active, `evidence/A2-timeout.md` §3) |
| `celebration` | `playing` | `newRound()` (Yeni Oyun) | `bittimi()` shows `ybuton`; `DefineButton2_71` → `init()`; the results screen (excluded form) returned via `_root.gotoAndPlay("main")` (`evidence/A2-labels.md` §3; deviation §9.3) |
| `timeout` | `playing` | `newRound()` (Yeni Oyun) | `tamamla()` shows `ybuton`; `DefineButton2_71` → `init()` (`evidence/A2-timeout.md` §2–§3) |

Illegal transitions throw `IllegalTransitionError`; a same-state transition
where the table lists it (round restart) is a valid no-op for `onChange`
(asserted in tests).

## 2. Lifecycle API (`src/game/lifecycle.ts`)

```ts
createRoundLifecycle(options: RoundLifecycleOptions): RoundLifecycle
```

- `options.constants` — `timer` / `scoring` blocks and `bonusLetterSeed` passed
  from `data/constants.json` at bootstrap (docs/05 §1: modules never read the
  JSON). `options.rounds` defaults to the validated `ROUNDS` bank; `clock`,
  `playAudio`, `bonusRandom` and `shuffleSeedBase` are injectable for tests.
- Callbacks (docs/05 §1 outputs): `onStateChanged(change)`,
  `onRoundStarted(round)`, `onRoundCompleted('all-found'|'timeout')`,
  `onChanged(snapshot)`, `onTick(remainingSeconds)`.
- `start()`: `boot → preloader → main` (the bundle is already loaded; the
  preloader/intro are instant in the rebuild).
- `newRound()`: next bank round in file order (duplicate `id`s allowed; array
  order is identity, `docs/06` §4), fresh O02 tracker
  (`createBonusLetterTracker(createSeededRandom(bonusLetterSeed))`), deck from
  `round.letters` + seeded shuffle, input controller, state `playing`, input
  unlocked, `timer.start()` (200 s), score/found/reveal reset, audio
  `roundStart` (reference `init()` fanfare) and `onRoundStarted`.
- `selectRound(main)`: TEST-ONLY (docs/04 §6 amendment) — starts the first bank
  round with that `main` without advancing the sequential cursor (asserted).
- `submit(entry)` → `'valid' | 'already-found' | 'invalid' | 'ignored'`:
  - `ignored` when no round is live (state ≠ `playing`; no sound);
  - `invalid` (entry not in the round's full word set, incl. empty) → `buzz`
    (`submitInvalid`), no score, entry kept (O15(a)/(f));
  - `already-found` → `boing` (`submitAlreadyFound`), no score, entry kept
    (O15(b));
  - `valid` → `scoreWord(entry, tracker.ball, scoring)`, found list + counter,
    `enter` (`submitValid`), `bonus.clearEntry`, `input.clearEntry()` (entry +
    all tiles restored, reference `ekle()` success), completion check.
- `handleKey` / `handleTileClick` / `scramble()` / `deleteLast()` /
  `submitCurrent()`: the Ekle/Karıştır/Sil sprites call the same controller
  actions as ENTER/SPACE/BACKSPACE (`DefineButton2_65` → `ekle()`,
  `DefineButton2_105` → `karistir()`, `DefineButton2_63` → `sil()`).
- `snapshot()`: immutable UI input — state, roundIndex/id/main, score,
  timeBonus, remainingSeconds/Ms, entry, entryStatus (O05 `Geçerli`/`Girildi`),
  foundWords, listedFound (`{length,index,word,revealed}`), listedSlotCounts,
  remainingCounts (`b3`..`b8`), boardRevealed, inputLocked, completionSequence,
  deck snapshot.

## 3. Completion semantics (O13/O14)

- **Listing cap.** `listedSlotCount(length) = min(words[length].length, 10)`;
  the cap literal is `LISTING_CAP = 10` with the `if(k > 10) { k = 10; }`
  evidence (A2-labels §3; docs/02 §4).
- **All-found.** `bittimi()` logic: `filled === total && total > 0`, where
  `total = Σ min(listed)`, `filled = Σ min(foundCounts, listed)`. Words beyond
  the cap are playable/scored but never listed; `bN` counters can stay > 0
  after completion (asserted: FİNALİZM 10/10/10/4/0/1 slots → remaining
  18/31/7/0/0/0). Time bonus `remainingSeconds × timeFactor` is read from the
  last displayed integer second **before** `timer.stop()` (`bittimi()` order);
  timeout adds none. The board hides tiles and Ekle/Karıştır/Sil
  (`bittimi()`/frame 132); input locks.
- **Timeout.** Entry (and a pending O02 bonus) is discarded without scoring;
  every listed-but-unfound word is revealed into the row's free slots in
  word-list order (`tamamla()`); `finishsound` (`timeout`) plays; no time
  bonus; input locks; Yeni Oyun starts the next round.
- **Countdown sound.** `countdown` plays once per tick while
  `0 < remaining < 10` (`evidence/A2-sounds.md` §2, `evidence/A2-timer.md` §2);
  asserted exactly 9 times on the 200 s timeout path.

## 4. Production shuffle seed/advance (D2 hand-off)

`deck.shuffle(seed)` is called on every round deal (reference
`yerlestir()` → `shuffle()`) and on every SPACE scramble; the production seed
is `SHUFFLE_SEED_BASE + N`, where `SHUFFLE_SEED_BASE = 2012` (same recorded
deterministic value as `data/constants.json` `bonusLetter.seed`; a V7 test
asserts the equality) and `N` is the per-session shuffle count (0-based, shared
by deals and scrambles). First deal of a session = the D2 golden permutation
`shuffleOrder(8, 2012) = [3,4,1,6,5,7,2,0]` (asserted). The counter resets
with the session, so a scripted session is fully deterministic.

## 5. End-of-bank behavior

`docs/05` §6 is silent; D1's `next()` throws when exhausted and `reset()`
restarts (D1 evidence §6.5). Decision: `newRound()` cycles back to the first
round (`sequence.reset()`), so the game never dies at the bank end. Proposed
`docs/08` line in §9.2.

## 6. UI layer and wiring

- `src/ui/hud.ts` (`mountHud(root, {board, onSubmit, onScramble, onDelete,
  onNewRound})`): visually-hidden testid mirror (`score`, `timer`, `entry`,
  `counter-3`..`counter-8`, `found-list`), transparent click overlays for the
  four button sprites at the `src/data/layout.json` rectangles (`submit`
  btn_ebuton, `scramble` btn_sbuton, `delete` btn_kbuton, `new-round`
  btn_ybuton), and `updateTimer(remaining, initial)` which patches the E2
  board's `timer_value` and gauge in place — the countdown ticks without a
  board re-render (stable clicks; E2/E3 repaint safety).
- `src/ui/message.ts`: O05 strings verbatim — `Geçerli` (id 119), `Girildi`
  (id 122), `Kelimeler Yükleniyor\rLütfen Bekleyiniz...` (ids 78/82/83) —
  shown in the `status_ball` catalog box; the status is derived from
  `snapshot.entryStatus` (reference `kontrol()`), reset by a valid submit.
- `src/main.ts` (D5 wiring, E2's `mountBoard` mount intact): loads
  `data/constants.json` once, builds the board view per snapshot (tiles in
  `deck.order()` display slots, hidden outside `playing`; found slots, counters,
  score, timer; Ekle/Karıştır/Sil removed from the element set in the
  completion sequences), decorates tile elements with `tile-0..tile-7`,
  attaches the keyboard listener and tile-click delegation, installs
  `window.__game` (`state`, `roundId`, `foundWords`, `score`, `remainingMs`,
  `lastAudioEvent` from D4, `selectRound(main)`) and boots
  `start(); newRound();`.
- E2's dev-only `window.__visualTest.apply(view)` stays intact; while an
  applied visual state is active, game repaints (board and timer) are suspended
  so E2 screenshots stay stable — the E2 visual suite is green (§8 #6).

## 7. D2/D4 wiring map (implemented)

| Input event | Lifecycle action | Audio event (D4) |
|---|---|---|
| `letter` (`source: 'key'`) | `bonus.addLetter(entryLengthAfter)` | `letterKey` |
| `letter` (`source: 'click'`) | `bonus.addLetter(entryLengthAfter)` | `tileClick` |
| `delete` | `bonus.removeLastLetter(entryLengthBefore)` | `delete` |
| `scramble` | `bonus.clearEntry(entryLengthBefore)` + `deck.shuffle(base + N)` | `scramble` |
| `submit` valid | score + found list + `bonus.clearEntry` + `input.clearEntry()` | `submitValid` |
| `submit` already found | no score, entry kept | `submitAlreadyFound` |
| `submit` invalid/empty | no score, entry kept | `submitInvalid` |
| `rejected` | nothing | — (plays nothing) |
| round start | resets + `timer.start()` | `roundStart` |
| timer tick `remaining < 10 && > 0` | (no state change) | `countdown` |
| timer expiry | entry discard + reveal + lock | `timeout` |

`window.__game.lastAudioEvent` reads D4's `getLastAudioEvent()` (D4 hand-off).

## 8. Test summary

| # | Verify | Command | Result |
|---|---|---|---|
| 1 | V4 | `npm test -- lifecycle` | **1 file, 23/23 pass** — state machine (5), newRound (4), submit (6), completion (3), timeout (2), source scans (3) |
| 2 | full | `npm test` | **12 files, 217/217 pass** (was 194 before D5) |
| 3 | lint | `npm run lint` | 0 diagnostics |
| 4 | build | `npm run build` | exit 0; `dist/assets/index-B9B5-0p9.js` 4,791.63 kB (gzip 1,269.53 kB) with the expected >500 kB chunk warning (D1 note: the 12 MB bank inlines into the entry chunk once D5 imports `round.ts`; not a failure) |
| 5 | V6 | `npm run e2e -- playthrough:basic` | **1/1 pass**: FİNALİZM, invalid entry → scramble → first 3-letter oracle word (450) → duplicate (boing) → 33 more listed words (cap-aware 10/10/10/4/0/1) with per-step `window.__game` score/list/state assertions → all-found completion (celebration, time bonus = last integer second × 100, lock verified) → Yeni Oyun → sequential next round `ABAJURLU` |
| 6 | E2 regression | `npm run e2e -- visual` | **17/17 pass** (static states dsf1+dsf2 and the V7 layout check stay green with the game wired) |
| 7 | C2 smoke | `npm run e2e -- smoke` | 6/7: the `__game` placeholder assertion fails as expected — superseded by real hooks (§9.4) |
| 8 | V2 | `tests/lifecycle.test.ts` `V2: zero ad-network identifiers` | 0 hits over every text file in `src/` for the O19 identifiers (`MochiAd.showPreGameAd`, `_mochiad`/`mochiad_options`, `x.mochiads.com`, ad id `951545f2fdfbf4a6`) + scanner self-test |
| 9 | V7 | same file | lifecycle/state contain no hardcoded `200/1000/50/5000/100` (comments stripped) and never import `data/constants.json`; `SHUFFLE_SEED_BASE === constants.bonusLetter.seed` |

V6 oracle: expected scores are computed in Node from the same evidenced rules
(D1 O02 tracker semantics + D3 `scoreWord`, seed 2012), with a self-check
against D1's recorded golden stream (first lucky add = 53). Playwright cannot
import `src/game/round.ts` (its static `rounds.json` import needs an ESM import
attribute), hence the documented local oracle copy in the spec; any drift in
the golden fails the self-check loudly.

Final reruns after all edits (the manual dev server was stopped first):
`npm test` → 12 files / 217 tests, exit 0; `npm run e2e -- playthrough:basic`
→ 1/1, exit 0 (`evidence/logs/D5-final-rerun-*.log`).

Silent witness runs (`EXECUTION.md` §8): unit tests inject a recording audio
sink; the e2e runs under Playwright's `--mute-audio` Chromium; no test plays
audio or uses the network. The basic e2e does not need the documented shorter
path: full cap-aware completion (35 words) runs in ~2.5 s.

## 9. Deviations and proposed `docs/08` lines (orchestrator-owned)

1. **O05 messages are derived, not evented.** The reference status sprite is a
   live function of the entry (`kontrol()`), so the lifecycle exposes
   `snapshot().entryStatus` and `src/ui/message.ts` renders it; no separate
   message event was invented.
2. **Proposed line (end-of-bank):** "2026-09-28 — D5: `newRound()` cycles back
   to the first bank round when the sequence is exhausted (`reset()`);
   `docs/05` §6 is silent and D1's `next()` throws. Evidence:
   `evidence/D5-lifecycle.md` §5."
3. **Proposed line (new-round affordance):** "2026-09-28 — D5: the reference's
   results-screen return path sits in the excluded score form (`docs/02` §7),
   so the rebuild keeps Yeni Oyun (`btn_ybuton`, `data-testid="new-round"`)
   available during `celebration`/`timeout`; frame 132's hiding of
   Ekle/Karıştır/Sil is reproduced. Evidence: `evidence/D5-lifecycle.md` §6."
4. **Proposed line (C2 smoke follow-up):** "2026-09-28 — D5: the C2 smoke
   assertion for the placeholder `window.__game` hooks (state null, roundId
   null, remainingMs 0, lastAudioEvent null) is superseded by the wired hooks
   (`state: 'playing'`, `roundId: 'abacilik'`, `remainingMs: 200000`,
   `lastAudioEvent: 'roundStart'`); `tests/e2e/smoke.spec.ts` needs a follow-up
   C2 amendment. Evidence: `evidence/D5-lifecycle.md` §8 #7,
   `evidence/logs/D5-e2e-smoke.log`."
5. **Proposed line (production shuffle seed):** "2026-09-28 — D5: production
   deck-shuffle seed = `SHUFFLE_SEED_BASE` (2012, equal to
   `constants.bonusLetter.seed`) + per-session shuffle count (0-based; round
   deals and scrambles share the counter). Evidence:
   `evidence/D5-lifecycle.md` §4."
6. **E3 hand-off:** the lifecycle emits `stateChanged`, `roundStarted`,
   `roundCompleted(reason)` and `onTick` through its options; E3's animation
   triggers need an orchestrator-provided access point to the same instance
   (like D5's `src/main.ts` amendment), or it can consume the states directly.
7. **Playwright filter naming:** `npm run e2e -- playthrough:basic` is a file
   path regex; the basic spec is `tests/e2e/playthrough/playthrough:basic.spec.ts`
   (inside the owned directory) so the exact Verify command matches.

## 10. Reproduction

```sh
npm test -- lifecycle                     # V4 + V2 + V7 (23 tests)
npm run e2e -- playthrough:basic          # V6 basic playthrough
npm test && npm run lint && npm run build # gates
```
