# TASK F2 — E2E Playthrough (App vs Reference)

- Workstream: F (verification)
- Parallel group: 6
- Depends on: C3, D5, E1
- Owned paths: `tests/e2e/playthrough/**`, `tests/fixtures/playthrough.json`, `evidence/F2-*`, `evidence/visual/F2-*`

> Amendment 2026-09-28 (orchestrator): the reference side of F2 is driven by
> C3's scenario mode (`node verify/reference/capture.mjs --scenario …`,
> documented in `verify/reference/README.md`); do not edit `verify/reference/**`.
> Owned paths additionally include `tests/fixtures/reference/playthrough/**` for
> F2's reference captures. Silent witness runs apply. Recorded in
> `docs/08-open-items.md` (Amendments).

## Inputs
- `tests/fixtures/reference/` (C3 reference captures + interaction logs)
- `tests/fixtures/rounds/*.xml` (archived fixture rounds)
- `docs/07-verification.md` §1, §3, §5

## Steps
1. Define `tests/fixtures/playthrough.json`: a deterministic input script using
   the fixture round (FİNALİZM) word list — the sequence of words to submit,
   including: one 3-letter word (no bonus), one word containing the bonus
   letter, one invalid entry, one duplicate submission, then the remaining
   words to reach all-found. Every word comes from the archived fixture list
   (no new material).
2. Run the same script against:
   - the app (Playwright, `window.__game` assertions after each step:
     score equals the expected value from the scoring oracle, found list grows,
     state transitions match)
   - the reference harness (same inputs; capture screenshots at the same steps)
3. Compare app vs reference screenshots at each step (F1 tool, thresholds per
   `docs/07` §4) and produce a combined report.
4. Timeout variant: separate scripted case for the S9 state using the shortest
   possible path consistent with O01/O14 evidence.

## Unknowns
- All mechanics items (O01–O06, O13–O15) must be RESOLVED before start.

## Verify
- V6: `npm run e2e -- playthrough` passes: every step's assertions and diff
  thresholds hold; a machine-readable report is produced.
- V2: report lists every step with score, mismatch ratio, pass/fail.
- V5: timeout variant meets the static threshold for S9.

## Evidence
- `evidence/F2-playthrough.md` (summary + deviations, if any)
- `evidence/visual/F2/<step>/` (app vs reference + diff)
- `evidence/logs/F2-*.log`

## Done
- Verify passes; committed.
