# G4 — Visual fidelity (gate check)

Task: gate G4 (EXECUTION.md §7.2; docs/07 §6)
Started: 2026-09-28T22:05Z
Ended: 2026-09-29T00:10Z (after the X1–X4 defect wave)
Host+OS: dev-host.home / macOS (arm64 / arm64 host)
Gate keeper: orchestrator (re-ran the checks after the defect wave)

## Checklist

- [x] **Static-state pixel diffs within thresholds** (`docs/07` §4, tolerant
      basis, ≤ 2.0 %)
  - E2: S1–S7 + S10 at dsf 1 and 2 → 16/16 comparisons pass (max 1.363 %);
    `npm run e2e -- visual` 17/17. X2 removed the baked tile glyph and refreshed
    the ratios (raw max 6.719 %, tolerant max 1.359 %).
  - F2 playthrough: 40 steps app-vs-reference + S9 variant → all pass
    (worst step 1.740 %; S9 0.901 % after X4's reveal-colour fix).
- [x] **Animation keyframe checks pass**
  - E3: covered timeline sequences (board, wordball slide) at catalog offsets →
    8/8 e2e, keyframes ≤ 1.104 %; coverage rule recorded in `docs/07` §4
    amendment; durations/triggers V2/V7 across all 24 sequences.
  - Known divergence O23 (intro/preloader timed motion) recorded OPEN with a
    resolution procedure; not a G4 blocker under the recorded coverage rule.
- [x] **Sound-event mapping matches `data/sound-map.json`**
  - `npm test -- audio` 17/17 (event names ≡ map keys); X3 added the speaker
    toggle with persisted volume; O24 closed (filter mapping exact); O25
    (icon 0.5-px phase) recorded OPEN, E2-side.

## Commands (exact, re-run by the orchestrator)

```
npm run e2e -- visual        # 17 passed, exit 0
npm run e2e -- animation     # 8 passed, exit 0
npm run e2e -- interaction   # 6 passed, exit 0
npm run e2e -- timeout       # focused reveal-colour spec passes, exit 0
npm run e2e -- playthrough   # 3 passed (incl. S9 ≈ 3.4 min), exit 0
npm run e2e -- speaker       # 3 passed, exit 0
npm test                     # 227/227, exit 0
npm test -- audio            # 17/17, exit 0
npm run lint                 # exit 0
npm run build                # exit 0
```

## Notes

- Defect wave X1–X4 (owner directive) closed: tile center clicks, baked tile
  glyph, speaker toggle, timeout reveal colour.
- Open items carried to the final report: O23 (intro/preloader timed motion),
  O25 (speaker icon spatial residual).
- All thresholds unchanged throughout.

## Result

**PASS** — G4 conditions met; F3 dispatched for the final G5 matrix.
