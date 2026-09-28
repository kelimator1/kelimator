# TASK B3 — Round Generation and Bank

- Workstream: B (dictionary)
- Parallel group: 3
- Depends on: B2, C1 (frozen `data/rounds.schema.json`)
- Owned paths: `tools/build-rounds.*`, `tools/build-config.json`, `src/data/rounds.json`, `evidence/B3-*`, `docs/08-open-items.md` (status updates only)

## Inputs
- `tools/wordlist.txt` (B2)
- `data/rounds.schema.json` (C1; if missing → STOP, dependency violation)
- Fixtures: `../kelimator-nostalji/calistir/xml.php`,
  `../kelimator-nostalji/calistir/xml_eng.php`,
  `../kelimator-nostalji/kayitlar/sozluk_29749_kelime.xml`

## Steps
1. Implement `tools/build-rounds.*` exactly per `docs/06` §3:
   - candidates = 8-letter words from the normalized list
   - subwords = dictionary words with 3 ≤ len ≤ 7 whose letter multiset is
     contained in the candidate's multiset
   - main word added to the `"8"` list (only the candidate itself)
2. Threshold measurement (closes O16): generate banks for T ∈ {10, 15, 20, 25,
   30}; record bank sizes; select the largest T with bank ≥ 500; write T and
   its evidence path into `tools/build-config.json`. If none reaches 500,
   select T = 10 and open a BLOCKER item.
3. Emit `src/data/rounds.json` per the schema: sorted by `main`; word arrays
   sorted; stable formatting (2-space indent, trailing newline). `id` per the
   transliteration rule in `docs/06` §4 (implement and unit-test the table).
4. Fixture tests (per `docs/06` §5):
   - Structural checks for `finalizm`, `viroloji`, `leavings` fixtures.
   - Enumeration check with the archived dictionary fixture: for FİNALİZM,
     verify that every archived subword also present in the archived dictionary
     can be produced by the algorithm from the candidate's letters; record
     exceptions (expected only for dictionary gaps) with counts.
5. Idempotency: run the build twice; both outputs must be byte-identical.
6. Record: total rounds, chosen T, per-length statistics, output SHA-256.

## Unknowns
- O16 resolved here. No other OPEN items may be in scope.

> Amendment 2026-09-28 (orchestrator): Owned paths additionally include
> `tests/rounds-fixtures.test.mjs` — the structural/enumeration fixture tests
> and the `id` transliteration-table unit tests required by Verify
> (`npm test -- fixtures`). Silent witness runs apply (`EXECUTION.md` §8).
> Recorded in `docs/08-open-items.md` (Amendments).

## Verify
- V3: `npx ajv-cli validate -s data/rounds.schema.json -d src/data/rounds.json`
- V4: `npm test -- fixtures` — structural + enumeration tests pass; exceptions
  (if any) are listed with counts in evidence, not silenced.
- V8: two runs → identical SHA-256.
- V2: every round has `main` length exactly 8; `letters` length exactly 8.

## Evidence
- `evidence/B3-threshold.md` (measurement table; closes O16)
- `evidence/B3-bank.md` (stats, fixture test output, hashes)
- `evidence/logs/B3-*.log`

## Done
- Verify passes; O16 RESOLVED; `src/data/rounds.json` committed.
