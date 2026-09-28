# TASK B1 — TDK Headword Acquisition

- Workstream: B (dictionary)
- Parallel group: 1
- Depends on: none
- Owned paths: `artifacts/tdk/**`, `evidence/B1-*`

## Inputs
- `docs/06-dictionary-and-rounds.md` §1
- Fixture cross-check: `../kelimator-nostalji/kayitlar/sozluk_29749_kelime.xml`

## Steps
1. Probe the TDK Güncel Türkçe Sözlük search behavior on `sozluk.gov.tr`:
   - Send sample queries (e.g., `"kelime"`, `"aba"`) and record the JSON
     response shape, result caps, and pagination behavior.
   - Test whether substring probing can enumerate entries: query two-letter
     substrings and record coverage (do results include compound words whose
     headword contains the substring?).
2. Decide the acquisition method **from the probe results**:
   - If enumeration is feasible: iterate substring probes (start with all
     one- and two-letter substrings; extend to three-letter probes where a
     two-letter query hits the result cap), minimum 1 request per second,
     cache every raw response under `artifacts/tdk/raw/`.
   - If enumeration is not feasible: write `evidence/B1-feasibility.md` with
     the probe evidence and open a BLOCKER item. Do not switch sources.
3. Extract headwords from cached responses; collect unique values.
4. Write `artifacts/tdk/headwords.txt`: one word per line, sorted (byte order),
   UTF-8.
5. Record: request count, unique headword count, file SHA-256.
6. Overlap statistics vs the archived fixture dictionary (count of fixture
   words present in the snapshot; record as informational only).

## Unknowns
- None assigned. Produces evidence for O17 (entry-type inspection).

## Verify
- V2: `artifacts/tdk/headwords.txt` exists; line count > 10,000 (if lower,
  record finding and BLOCKER — do not force).
- V1: SHA-256 recorded; re-running extraction from cache reproduces the same
  file hash (cache determinism).
- V2: no line is empty; every line matches `^[\p{L}]+$` (Unicode letters).

## Evidence
- `evidence/B1-acquisition.md` (method, probes, counts, hash)
- `evidence/B1-feasibility.md` (only if enumeration fails)
- `evidence/logs/B1-*.log` (request log summary; not full bodies)

## Done
- Verify passes; BLOCKER not required.
