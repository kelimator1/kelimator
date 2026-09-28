# TASK B2 — Word List Normalization and Filtering

- Workstream: B (dictionary)
- Parallel group: 2
- Depends on: B1
- Owned paths: `tools/wordlist.txt`, `data/blocklist.txt`, `tools/normalize-wordlist.*`, `evidence/B2-*`, `docs/08-open-items.md` (status updates only)

## Inputs
- `artifacts/tdk/headwords.txt` (B1)

## Steps
1. Implement `tools/normalize-wordlist.*` (Node or Python; committed) applying
   `docs/06` §2 steps exactly:
   - Turkish upper-casing (`i → İ`, `ı → I`); display form = comparison form
   - Charset filter: only the 29 core Turkish letters; drop everything else
     (including circumflex forms and any word containing other characters)
   - Length ≥ 3; single token
2. Inspect the snapshot for entry types (abbreviations, proper nouns, phrases)
   and record what was found; apply only the filters already specified in
   `docs/06` §2 (no new filter without an explicit recorded decision). Close
   O17 with the findings and the applied decisions.
3. Create `data/blocklist.txt` (one word per line, upper case) with the initial
   offensive-term list; every entry recorded with its basis in evidence.
   Blocklisted words are removed from the output.
4. Produce `tools/wordlist.txt`: sorted, deduplicated, one word per line.
5. Record per-step counts (input → after casing → after charset → after shape
   → after blocklist) and the output SHA-256.

## Unknowns
- O17 resolved here. If the snapshot contains structures requiring a new rule
  not in `docs/06`, do NOT improvise: open a BLOCKER and stop.

> Amendment 2026-09-28 (orchestrator): Owned paths additionally include
> `tests/normalize-wordlist.test.mjs` — the unit tests required by Verify V4
> (`npm test -- normalize`). Silent witness runs apply (`EXECUTION.md` §8).
> Recorded in `docs/08-open-items.md` (Amendments).

## Verify
- V2: output file exists; > 10,000 lines; all lines match
  `^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$`; no duplicates (sort -u stable).
- V4: unit tests for the normalizer: casing cases (`i→İ`, `ı→I`, mixed),
  circumflex rejection (`KÂSE` dropped), punctuation rejection, blocklist
  application.
- V1: output SHA-256 recorded; rerun produces identical hash (V8).

## Evidence
- `evidence/B2-normalization.md` (step counts, tests, hash)
- `evidence/B2-filters.md` (entry-type findings; closes O17)
- `evidence/logs/B2-*.log`

## Done
- Verify passes; O17 RESOLVED; `tools/wordlist.txt` committed.
