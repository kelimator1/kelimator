# TASK D5 — Round Lifecycle and State Machine

- Workstream: D (core)
- Parallel group: 5
- Depends on: D2, D3
- Owned paths: `src/game/state.ts`, `src/game/lifecycle.ts`, `src/ui/hud.ts`, `src/ui/message.ts`, `tests/lifecycle.test.ts`, `evidence/D5-*`

> Amendment 2026-09-28 (orchestrator): Owned paths additionally include
> `tests/e2e/playthrough/**` (the basic playthrough spec required by Verify V6,
> `npm run e2e -- playthrough:basic`) and `src/main.ts` bootstrap wiring for the
> game (state machine + HUD mount; E2's board mount stays intact).
> `tests/fixtures/playthrough.json` remains F2's file — keep the basic script
> inline in the spec. Also implement the test-only `window.__game.selectRound(main)`
> hook (`docs/04` §6 amendment) and own the production shuffle seed/advance plus
> the D2/D4 audio-wiring hand-offs (`evidence/D2-input.md` §6,
> `evidence/D4-audio.md`). SILENT witness runs apply (`EXECUTION.md` §8).
> Recorded in `docs/08-open-items.md` (Amendments).

## Inputs
- `docs/05-game-core.md` §1, §6
- `docs/02-mechanics-spec.md` §4, §5 (flows from O13/O14)
- `data/constants.json` (flow labels)

## Steps
1. Implement the finite state machine per the flow resolved by O13:
   boot → preloader → main → playing → completion sequence → new round.
   Every transition references its evidence.
2. Implement `lifecycle.ts`:
   - `newRound()`: sequential round selection, bonus letter, resets, timer
     start, deck init
   - `submit`: validation via D1's round set, scoring via D3, found-list update,
     message/audio events (audio integration hooks only; D4 owns playback)
   - completion on all-found and on timeout, per O13/O14 semantics
   - input lock during completion sequences
3. Implement HUD bindings (score, timer, counters, found list) and the message
   component for transient strings from O05.
4. Unit/integration tests: state transitions for a full fixture round driven
   programmatically (no UI): every word found → completion; timeout path;
   restart; input locked during sequences.

## Unknowns
- O13 and O14 must be RESOLVED before start. O19 (MochiAds removal) must be
  RESOLVED or EXCLUDED here; the startup path must contain no ad calls.

## Verify
- V4: `npm test -- lifecycle` passes.
- V6 (basic): `npm run e2e -- playthrough:basic` — the app completes a fixture
  round with a scripted word sequence; `window.__game` assertions match
  `docs/07` §1 oracle values.
- V2: source scan (test) asserts zero occurrences of ad-network identifiers
  (from O19) in `src/`.

## Evidence
- `evidence/D5-lifecycle.md`
- `evidence/logs/D5-*.log`

## Done
- Verify passes; committed. Registers task C2/D1–D5 as done for gate G3.
