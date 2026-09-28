# TASK D3 — Scoring and Timer

- Workstream: D (core)
- Parallel group: 4
- Depends on: D1, A2 (constants resolved)
- Owned paths: `src/game/scoring.ts`, `src/game/timer.ts`, `tests/scoring.test.ts`, `tests/timer.test.ts`, `evidence/D3-*`

## Inputs
- `docs/02-mechanics-spec.md` §3, §4
- `data/constants.json` (scoring factors, timer values from O01/O02)
- `docs/07-verification.md` §1 (scoring oracle)

## Steps
1. Implement `scoring.ts` exactly per the confirmed formulas:
   - valid word `n² × factor`
   - bonus word adds `bonusPoints` once, only when the bonus letter is part of
     the word (rule from O02)
   - end-of-round time bonus `remainingSeconds × timeFactor`
2. Implement `timer.ts` per O01: initial value, tick interval, stop/pause
   semantics, expiry event. All values from `data/constants.json`.
3. Unit tests: the scoring oracle table from `docs/07` §1 exactly; timer
   ticking, expiry, and stop conditions; integer arithmetic (no float drift).

## Unknowns
- O01 and O02 must be RESOLVED before start (dependency); otherwise do not start.

## Verify
- V4: `npm test -- scoring` and `npm test -- timer` pass with the oracle values.
- V7: no numeric literal in these modules except via `data/constants.json`
  (test scans the source for digits and asserts every flagged literal has an
  `// evidence:` comment).
- V2: timer expiry fires exactly once per round (assertion).

## Evidence
- `evidence/D3-scoring-timer.md`
- `evidence/logs/D3-*.log`

## Done
- Verify passes; committed.
