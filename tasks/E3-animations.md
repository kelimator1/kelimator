# TASK E3 — Animations

- Workstream: E (visuals)
- Parallel group: 6
- Depends on: E2, A3
- Owned paths: `src/ui/animations.ts`, `src/styles/animations.css`, `evidence/E3-*`, `evidence/visual/E3-*`

## Inputs
- `src/data/animation.json` (A3/E1): sequence names, frame spans, derived
  durations, keyframe offsets
- `tests/fixtures/reference/` animation keyframes (C3 captures, if the matrix
  includes them; otherwise capture per `docs/07` §3)

## Steps
1. Implement each animation sequence from the catalog with the exact duration
   and keyframe timing (durations = frames ÷ FPS, from evidence).
   Animations are presentation only; they must not mutate game state.
2. Wire animation triggers to lifecycle events (D5 events only — no new
   events).
3. Capture keyframe screenshots of the app at the catalog offsets and
   pixel-diff against the reference captures.
4. Sound synchronization: animations that trigger sounds must use the D4 event
   names (V7 check).

## Unknowns
- O07 must be RESOLVED (A3); O11 must be RESOLVED or EXCLUDED before start.

## Verify
- V5: `npm run e2e -- animation` passes for every catalogued sequence at all
  recorded keyframe offsets (≤ 2.0% threshold per keyframe).
- V7: animation trigger names ⊆ lifecycle event names (test).
- V2: animation durations in code equal `animation.json` values (test).

## Evidence
- `evidence/E3-animations.md` (sequence list, diff summary)
- `evidence/visual/E3/<sequence>/<offset>.png` + report
- `evidence/logs/E3-*.log`

## Done
- Verify passes; committed. Registers E tasks as done for gate G4.
