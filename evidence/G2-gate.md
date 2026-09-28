# G2 — Data complete (gate check)

Task: gate G2 (EXECUTION.md §7.2)
Started: 2026-09-28T18:36Z
Ended: 2026-09-28T18:38Z
Host+OS: dev-host.home / macOS (arm64 / arm64 host)
Gate keeper: orchestrator (re-ran each check after the workers)

## Checklist

- [x] **`src/data/rounds.json` validates against `data/rounds.schema.json`**
  - `npx ajv-cli validate -s data/rounds.schema.json -d src/data/rounds.json`
    → `src/data/rounds.json valid` (exit 0)
  - 7,393 rounds; every `main` length 8 and every `letters` length 8 (checked
    independently); rounds sorted by `main` (ABACILIK … ŞİŞİRTME).
- [x] **Fixture tests pass**
  - `npm test -- fixtures` → 20/20 passed (finalizm + leavings + viroloji
    structural checks, finalizm enumeration 83/83, id table, bank invariants).
  - Full suite: 97/97 passed, 0 skipped.
- [x] **Idempotency (V8) passes**
  - `node tools/build-rounds.mjs` re-run reproduces
    `7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96`
    (byte-identical to the committed artifact).

## Commands (exact, re-run by the orchestrator)

```
npx ajv-cli validate -s data/rounds.schema.json -d src/data/rounds.json   # valid, exit 0
npm test -- fixtures                                                       # 20 passed, exit 0
npm test                                                                   # 97 passed, exit 0
node tools/build-rounds.mjs                                                # exit 0; output hash identical
shasum -a 256 src/data/rounds.json                                         # 7e4e149b…b9a96
```

## Context

- Threshold measurement (O16): T=30, bank 7,393 ≥ 500; sizes for
  T ∈ {10,15,20,25,30} = 8,935 / 8,638 / 8,269 / 7,834 / 7,393
  (`evidence/B3-threshold.md`, `tools/build-config.json`).
- The `viroloji` fixture BLOCKER (O22) was resolved before this gate: fixture
  provided from the cited Wayback capture and the gated test activated
  (`evidence/B3-viroloji-blocker.md`).
- `id` duplicates are accepted by amendment (`docs/06` §4; 33 bank pairs).

## Result

**PASS** — G2 conditions met; group 3 may proceed (D1 dispatched).
