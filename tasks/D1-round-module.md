# TASK D1 — Round Module

- Workstream: D (core)
- Parallel group: 3
- Depends on: C2, C1 (frozen schemas)
- Owned paths: `src/game/round.ts`, `tests/round.test.ts`, `evidence/D1-*`

## Inputs
- `src/data/rounds.json` (B3; if missing, STOP — dependency violation)
- `data/rounds.schema.json` (C1)
- `docs/05-game-core.md` §2; `docs/02-mechanics-spec.md` §1 (checksum per O03)

## Steps
1. Implement `Round` loading from `src/data/rounds.json`:
   - schema validation at load (fail fast with the failing path in the error)
   - sequential round selection (deterministic order as emitted by B3)
   - expose typed `Round` per `docs/05` §2
2. Implement `bonusLetter` assignment at round start using the rule resolved by
   O02 (`data/constants.json`); if the rule is probabilistic, use a seeded RNG
   with the seed recorded in constants.
3. Apply the checksum/parsing semantics resolved by O03 (only what the evidence
   says; if O03 concluded "no client validation", implement none and record).
4. Unit tests: valid round loads; malformed round rejected with path; round
   order is stable; `letters` equals the multiset of `main`.

## Unknowns
- None remaining: O03 and O12 must be RESOLVED by A2 before this task starts;
  if either is OPEN → do not start (dependency violation).

## Verify
- V4: `npm test -- round` passes.
- V3: loading `src/data/rounds.json` with the schema validator produces zero
  errors (test asserts).
- V2: round selection sequence over the full bank equals the file order
  (test asserts first/last/len).

## Evidence
- `evidence/D1-round.md` (test output summary, hashes)
- `evidence/logs/D1-*.log`

## Done
- Verify passes; committed.
