# C3 — Reference-harness repeat-capture stability (closes O20)

Task: C3 — Reference Harness (Ruffle Web + Static Fixtures)
Started: 2026-09-28T14:29:21Z (final matrix run 1 start; server-log marker)
Ended: 2026-09-28T15:33:00Z (dsf 1 + dsf 2 stability verified)
Host+OS: dev-host.home / hidden (macOS, arm64 / arm64 host)
Node v22.14.0 · Python 3.14.6 · @playwright/test 1.63.0

Commands executed (exact):
- `node verify/reference/capture.mjs --runs 2 > evidence/logs/C3-harness-run.log 2>&1` → exit 0 (dsf 1)
- `node verify/reference/capture.mjs --runs 2 --dsf 2 > evidence/logs/C3-harness-run-dsf2.log 2>&1` → exit 0 (dsf 2, 1100×800)
- `node verify/reference/check.mjs > evidence/logs/C3-check-output.log 2>&1` → exit 0 (ALL CHECKS PASS)
- per-state F1 diff via the harness `compareRuns()` (`verify/diff/diff.mjs`), 10 reports under `tests/fixtures/reference/stability/<state>/` and 10 under `tests/fixtures/reference/dsf2/stability/<state>/`
- `shasum -a 256` over both runs' captures (both scale factors)

Exit codes: 0 (all).

Output summary: two complete S1–S10 matrix runs on the reconstructed
Base64(UTF-8) fixture; every state passes the `docs/07` §4 static threshold
(max 1.22 % ≤ 2.0 %); S1 (intro) and S9 (timeout) are byte-identical across
runs; the residual differences are the reference's own randomness (random deck
shuffle, bonus ball, end-screen fireworks, timing-dependent score/time values),
each localized by the F1 bounding boxes and quantified.

Artifact SHA-256 hashes:
- `tests/fixtures/reference/stability-report.json` `e10f08054b6d0881388a3261160c20e6bc81b4b1f92e4b98063ded5e5f12a768`
- `tests/fixtures/reference/run1/interaction-log.json` `c4d2f45c640e2befb35e47542a4cf2a19897cbc206d058d2285919b96a62e5d9`
- `tests/fixtures/reference/run2/interaction-log.json` `389cfcc2766bcc2c8e9488ae42ebb21102bba6fc29bd9fb2075931f181dc678c`
- canonical `tests/fixtures/reference/interaction-log.json` `629b28c4d93b48212f7f6c5ada4267ff45c532901526f4ea471432b919343620`
- run 1 S1 = run 2 S1 = `396153fe4dc935d41a3a8bd709986a2b1238726f3c32e239bf3ef4681117ac26` (byte-identical)
- run 1 S9 = run 2 S9 = `20596e199148f26275c06b1eb3b4ad3f0649b7555e8dd281f000eed4e7fd47b7` (byte-identical)
- dsf 2: `tests/fixtures/reference/dsf2/stability-report.json` `04fc21b1c9512f8846b553daa7829abc22211fdd04b8bfc323910f8afc378609`; `dsf2/run1/interaction-log.json` `a6a2a78d84af18f2338a3f9ec87727dce86f6de59aca6706749cf51e8d54c68d`; `dsf2/run2/interaction-log.json` `bee2e39cedfe7e482de39430491c7b69a24c755c7f3205f3bc5c09b714f40a67`; S1 `ac5e86aa…` = S9 `1cf3a775…` (byte-identical pairs, full values in the report)

Result: PASS — O20 closed for the reconstructed fixture: the harness capture
mechanics are deterministic (byte-identical S1/S9, within-run stable streak = 3
for every capture that is preceded by a stable-frame wait), and all cross-run
differences are inherent reference randomness, measured per state and within
the static threshold.

---

## 1. Method

1. Two full matrix runs (same harness invocation, fresh browser context and
   fresh server session per run; run markers in `evidence/logs/C3-server.log`:
   run 1 `14:29:21.632Z`, run 2 `14:34:24.993Z`).
2. Per state: byte-hash comparison + the F1 pixel diff (threshold > 30 RGB
   distance, pass ≤ 2.0 % of stage pixels — `docs/07` §4).
3. Within-run stability: captures preceded by a stable-frame wait (3 identical
   consecutive stage frames, 150 ms apart) record the streak in the interaction
   logs; the affected actions record `stableAfter`.
4. Every state has per-action before/after diffs in the logs, so a difference
   can be located (bbox) and attributed to a reference behaviour.

## 2. Results (run 1 vs run 2; threshold 2.0 %)

| State | byte-identical | mismatch ratio | mismatch bbox | pass |
|---|---|---|---|---|
| S1 boot | **true** | 0.00000 | — | true |
| S2 idle board | false | 0.00781 | x 51–489, y 315–337 (tile letters) | true |
| S3 scrambled | false | 0.00149 | x 234–427, y 315–337 (tile letters) | true |
| S4 partial entry | false | 0.00149 | x 234–427, y 315–337 (tile letters) | true |
| S5 valid word | false | 0.00149 | x 234–427, y 315–337 (tile letters) | true |
| S6 invalid word | false | 0.00155 | x 234–530, y 134–337 (tiles + list) | true |
| S7 bonus word | false | 0.00355 | x 234–532, y 93–337 (tiles + entry + panel) | true |
| S8 all found | false | 0.01220 | x 222–549, y 64–357 (end screen) | true |
| S9 timeout | **true** | 0.00000 | — | true |
| S10 next round | false | 0.00599 | x 52–427, y 315–337 (tile letters) | true |

Aggregate: `allPass = true`, `allByteIdentical = false`. Within-run stability:
S1/S2/S9/S10 recorded stable streaks of 3; S3–S8 captures follow actions whose
`stableAfter` is true (their capture is taken immediately after the stable
window).

S2 self-check (V5) — byte hashes differ (`9859f24691…` vs `c79bfe9738…`), so
the stabilization is quantified: within-run S2 captures are byte-identical
(streak = 3); cross-run ratio **0.00781** (≤ 0.02); the bbox is the tile-letter
band only (x 51–489, y 315–337) — the reference's random `shuffle()`.

## 3. Cause of every cross-run difference (identified, not guessed)

1. **Random deck shuffle** (`frame_131` `shuffle()`, `random(harfsayisi)`) —
   the two runs' decks place the letters in different slots; the differences are
   confined to the letter glyph band on the tile row (measured bboxes above):
   S2 0.78 % (all slots), S3/S4/S5 0.15 %, S10 0.60 %.
2. **Bonus ball** (`random(1000) < 50` per appended letter, O02) — run 1's S7
   saw the bright ball on the first attempt (`maxBrightPixels = 223`); run 2's
   S7 never saw it in 40 attempts (`maxBrightPixels = 0`) yet the submission
   still scored the bonus (the roll can mark the *next* ball, which never
   arrived — A2's O02 "bonusball = next-added ball" rule), so the end-screen
   totals still include +5000. S7/S8 accordingly contain the ball/score state.
3. **Timing-dependent values** — the S7 retry budget is driven by the random
   bonus event (run 1: 1 attempt, S7 at +24.6 s; run 2: 40 attempts, S7 at
   +62.2 s), so the displayed countdown/score at S6–S8 differ between runs
   (e.g. the end-screen "Süre" 80 vs 119 s in the hiscore POST payloads) in
   addition to the shuffled letters.
4. **End-screen fireworks** — the all-found TEBRİKLER screen has continuously
   animating particles (never pixel-stable: measured streak 1 over 30 s); S8's
   1.22 % bbox is that screen region.

None of these are capture noise: they are the reference's own content.

## 4. Stabilization methods (quantitative evidence)

1. **Stable-frame sampling** (3 consecutive byte-identical frames, 150 ms
   apart) — removes within-tick jitter: S2/S10/S9/S1 streaks = 3; the timeout
   board (S9) is fully static → **byte-identical across runs (0 mismatch)**.
2. **Sun mask for S1** (`SUN_BOX` x 205–325, y 0–175) — the intro's only
   continuously animating element → **S1 byte-identical across runs**.
3. **State detectors instead of timing** — round board gated on the
   `xml64.php -> 200` server evidence; acceptance/completion detected from the
   reference (entry row cleared; `bittimi()` hides Karıştır/Ekle/Sil); the
   all-found end screen detected by measured probe pixels (panel
   `(204,204,51)`, sky `(10,22,30)`) — the fireworks never settle, so the
   capture is taken at the detected state and the residual is quantified (cause
   4).
4. **Reference's own return path for S9** — the end screen's "Gönder" starts
   round 2 (hiscore POST 501, local; next `xml64.php -> 200`), whose clock is
   waited out; the resulting timeout state is deterministic (byte-identical).

## 5. O20 conclusion

The reference harness is repeat-capture stable on the reconstructed fixture:
the capture pipeline adds no variance (S1 and S9 byte-identical; within-run
stable streak = 3), every state is within the `docs/07` §4 static threshold
(max 1.22 %), and the residual cross-run differences are the reference's own
randomness — deck shuffle, bonus ball (including the invisible-bonus case),
timing-dependent score/time values and end-screen fireworks — each localized to
a measured bbox and quantified. For downstream comparisons (E2/F2): reference
board states are arrangement-random; comparisons should expect the measured
≤1.22 % delta or account for the deck explicitly.

## 5b. DeviceScaleFactor 2 (1100×800) stability

The dsf 2 matrix (two full runs, same fixture and interaction sequence,
`node verify/reference/capture.mjs --runs 2 --dsf 2`; outputs under
`tests/fixtures/reference/dsf2/`) reproduces the dsf 1 discipline:

| State | byte-identical | mismatch ratio | mismatch bbox (device px) | pass |
|---|---|---|---|---|
| S1 boot | **true** | 0.00000 | — | true |
| S2 idle board | false | 0.00354 | tile letters + timer digits | true |
| S3 scrambled | false | 0.00513 | tile letters + timer digits | true |
| S4 partial entry | false | 0.00506 | tile letters + timer digits | true |
| S5 valid word | false | 0.00544 | tile letters + timer digits | true |
| S6 invalid word | false | 0.00967 | tile letters + timer digits | true |
| S7 bonus word | false | 0.00587 | tile letters + entry + timer | true |
| S8 all found | false | 0.00753 | end-screen fireworks (panel region) | true |
| S9 timeout | **true** | 0.00000 | — | true |
| S10 next round | false | 0.00520 | tile letters + timer digits | true |

- Every dsf 2 state is within the `docs/07` §4 threshold (max 0.97 %, S6);
  S1 and S9 are byte-identical, and S1's sun-masked ratio is 0 as well.
- Mismatch distribution measured per region: the tile-row letter bands (deck
  shuffle), the countdown digits in the right panel, and the S8 fireworks —
  the same causes as dsf 1.
- Both dsf 2 runs completed S8 before the round clock (`restarts=0`, completing
  word `İNFİAL`), took the return path (hiscore POST 501, next round), reached
  the round-2 timeout for S9 and started round 3 for S10.
- `check.mjs` `V2dsf2`/`V5dsf2` validate the set (30/30 screenshots at
  1100×800, 14/14 JSON; S2 within-run streak 3, cross-run 0.354 %); `Vmute`
  verifies the explicit `--mute-audio` flag in source and both dsf 2 manifests.
- The dsf 1 outputs are unchanged (hashes re-verified against the recorded
  values after the dsf 2 runs).

## 6. docs/08 proposal (single-writer: orchestrator applies)

```
RESOLVED 2026-09-28 — evidence/C3-stability.md — Repeat-capture stability over two full S1–S10 matrix runs with the reconstructed Base64(UTF-8) fixture: capture mechanics deterministic (S1 and the timeout state S9 byte-identical; within-run stable streak 3), every state within the docs/07 §4 static threshold (max 1.22 %), residual differences are the reference's own randomness (deck shuffle, bonus ball incl. the invisible-bonus case, timing-dependent score/time values, end-screen fireworks) each localized by the F1 bbox and quantified; stabilization = stable-frame sampling + measured region/state detectors (sun mask, tile-entry detectors, timer gauge, end-of-round button bar, end-screen probe pixels).
RESOLVED 2026-09-28 — evidence/C3-fixture-format.md — harness fixture = Base64(UTF-8) re-encoding of the archived xml64.php word list (input/script/output sha256 recorded; archived file unmodified)
```

The O20 line supersedes the pre-amendment wording: the fixture was reconstructed
on 2026-09-28 (O21), so the measurements above come from the two final matrix
runs on the served Base64(UTF-8) fixture.
