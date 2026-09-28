# G3 — Playable core (gate check)

Task: gate G3 (EXECUTION.md §7.2; docs/07 §6)
Started: 2026-09-28T19:27Z
Ended: 2026-09-28T19:29Z
Host+OS: dev-host.home / macOS (arm64 / arm64 host)
Gate keeper: orchestrator (re-ran each check after the workers)

## Checklist

- [x] **All unit tests pass**
  - `npm test` → 217/217 passed across 12 files (D1–D5 + B2/B3/F1/C2-era suites),
    exit 0. D5-scoped: `npm test -- lifecycle` 23/23.
- [x] **Basic E2E playthrough passes (V6) on the app**
  - `npm run e2e -- playthrough:basic` → 1 passed (3.2 s): the D5 spec loads the
    app, selects the FİNALİZM bank round, submits the listed words via the real
    input path and completes the round, asserting `window.__game` values against
    the `docs/07` §1 oracle.
  - Static visual states (E2) remain green on the amended tolerant basis
    (16/16 comparisons ≤ 2 %; `npm run e2e -- visual` 17/17).
- [x] **Placeholder visuals allowed at this gate** — actual visuals are already
  integrated (E1/E2), so this allowance is moot.

## docs/07 §6 mapping

| Item | Result |
|---|---|
| T04 constants resolved | PASS (`npm test -- constants`, 3/3; V7 scan green) |
| T05 sound-map consistency | PASS (`npm test -- audio`, 17/17; commands `AUDIO_EVENT_NAMES` ≡ map keys) |
| T08 scoring engine | PASS (`npm test -- scoring`, 17/17; oracle table) |
| T09 duplicate/edge input | PASS (`npm test -- input`, 29/29 with O15 annotations) |
| T13 basic playthrough | PASS (`npm run e2e -- playthrough:basic`, 1/1) |

## Commands (exact, re-run by the orchestrator)

```
npm test                        # 217 passed, exit 0
npm test -- lifecycle           # 23 passed, exit 0
npm run e2e -- playthrough:basic# 1 passed, exit 0
npm run e2e -- visual           # 17 passed, exit 0 (tolerant V5)
npm run lint                    # exit 0
npm run build                   # exit 0
```

## Notes

- D5's wiring replaced C2-era `window.__game` placeholders; C2's smoke spec
  expectation is being updated in a C2 follow-up (1/7 failing by design, not a
  G3 condition). Basic playthrough and all unit suites are green.
- Open item O09/O10/O11 remain closed; no new OPEN items.

## Result

**PASS** — G3 conditions met; E3/F2 dispatched (visual fidelity wave).
