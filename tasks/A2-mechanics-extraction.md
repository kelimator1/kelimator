# TASK A2 — Mechanics Extraction (Constants, Events, Flows)

- Workstream: A (reverse engineering)
- Parallel group: 2
- Depends on: A1
- Owned paths: `data/constants.json`, `data/sound-map.json`, `evidence/A2-*`, `docs/02-mechanics-spec.md` (TBC slots only), `docs/08-open-items.md` (status updates only)

> Amendment 2026-09-28 (orchestrator): Owned paths additionally include
> `tests/constants.test.mjs` — the file the Verify block's V7 dry-run
> (`npm test -- constants`) requires. Orchestration note: concurrent workers do
> not edit `docs/08-open-items.md`; A2 proposes the exact status lines in its
> evidence and the orchestrator applies them after verification. Recorded in
> `docs/08-open-items.md` (Amendments).

> Amendment 2026-09-28b (orchestrator): `data/sound-map.json` `sounds[].file`
> values follow the `docs/03` §1 naming convention
> (`sfx_<soundId>_<slug>.mp3`; slugs are the SWF's evidenced clip identifiers).
> The A1 export path (`artifacts/decompiled/sounds/<id>.mp3`) is recorded in
> evidence, not in the file value. Rationale: D4/E1 copy and the runtime loads
> by these names (`docs/03` §1, task D4 step 3). Recorded in
> `docs/08-open-items.md` (Amendments).

## Inputs
- `artifacts/decompiled/as/**` (A1)
- `artifacts/decompiled/header.txt`, `tags.txt`
- `docs/02-mechanics-spec.md`, `docs/05-game-core.md` §4–§7

## Steps
1. Read the decompiled scripts in the order defined in `docs/01` §4.
2. Resolve, in this order, with verbatim evidence excerpts (file + symbol +
   line reference) recorded in evidence files:
   - O01 timer: initial seconds, tick interval, pause semantics
   - O02 bonus letter: selection rule (all code paths)
   - O03 checksum: whether the client validates `harf="9999"`
   - O04 input: key handling (codes vs characters) incl. Turkish letters
   - O05 strings: exact user-visible strings and conditions
   - O06 sounds: every sound call site → sound ID mapping
   - O12 `kelimatorid` / `Base64.decode`: usage; classify EXCLUDED or required
   - O13 labels: `preall`, `hepsiburda`, `bravo` transitions
   - O14 timeout semantics (mid-entry, stop-on-completion, bonus timing)
   - O15 edge-case input rules
   - O19 MochiAds removal points (ensure game flow without the ad)
3. Cross-check each resolved mechanic against the reference build in the
   `../kelimator-nostalji/` Ruffle setup **only where A1 evidence is
   inconclusive**; observations are recorded as screenshots/log lines.
4. Write `data/constants.json` (schema: `data/constants.schema.json`, created
   by C1; if C1 output is missing, STOP — dependency violation).
5. Write `data/sound-map.json` (shape: `docs/03` §5) with file names matching
   A1's exports.
6. Update the `[TBC]` slots in `docs/02-mechanics-spec.md` with `[CONFIRMED]`
   tags + evidence refs. Do not record code blocks longer than one line per
   item; store only the extracted value/behavior, not wholesale code.

## Unknowns
- O01–O06, O12–O15, O19 must all be RESOLVED by this task. Any item that cannot
  be resolved from available artifacts → BLOCKER entry; do NOT write a guessed
  value into `constants.json` (schema forbids placeholders for required
  fields).

## Verify
- V3: `npx ajv-cli validate -s data/constants.schema.json -d data/constants.json`
- V3: `npx ajv-cli validate -s data/sound-map.schema.json -d data/sound-map.json`
- V2: every sound referenced in `sound-map.json` exists under
  `artifacts/decompiled/sfx/` with the recorded byte size.
- V7 dry-run: constants fields all contain evidence strings; no `""`/`0`
  placeholders for required fields (checked by `npm test -- constants`, which
  uses the schema's `required` annotations).

## Evidence
- `evidence/A2-timer.md`, `-bonus.md`, `-checksum.md`, `-input.md`, `-strings.md`,
  `-sounds.md`, `-kelimatorid.md`, `-labels.md`, `-timeout.md`, `-edges.md`,
  `-mochi.md`
- Each evidence file: procedure, excerpt reference, conclusion.

## Done
- Verify passes; O01–O06, O12–O15, O19 marked RESOLVED in `docs/08-open-items.md`
  with evidence refs; docs/02 updated.
