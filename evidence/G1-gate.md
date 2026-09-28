# G1 — Reverse engineering complete (gate check)

Task: gate G1 (EXECUTION.md §7.2)
Started: 2026-09-28T13:55Z
Ended: 2026-09-28T16:56+03:00 (approx; see command log below)
Host+OS: dev-host.home / macOS (arm64 / arm64 host)
Gate keeper: orchestrator (re-ran each task's Verify block after the worker)

## Checklist

- [x] **All A tasks PASS with evidence**
  - A1 — PASS: `evidence/A1-export-manifest.md` (commit c447af1). Re-verified by
    the orchestrator: source MD5 `af059ff9d75cefbc244f03814b47be9c`; 9/9 sound
    payloads match `docs/01` §3 byte sizes; 10/10 exported sounds pass `afinfo`;
    521/521 SVGs well-formed XML; `artifacts/decompiled/SHA256SUMS.txt` 672/672 OK.
  - A2 — PASS: `evidence/A2-mochi.md` §4 (commit a0c8f2a). Re-verified:
    `npx ajv-cli validate` both data files exit 0; `npm test -- constants` 3/3;
    whole suite 30/30; sound-map rename follow-up re-verified (9/9).
  - A3 — PASS: `evidence/A3-layout.md` §9 (commit 1adac95 at time of check).
    Re-verified: `npx ajv-cli validate -s data/layout.schema.json -d data/layout.json`
    exit 0; 62 elements; every asset reference resolves; `data/animation.json`
    24 sequences at fps 36 with numeric spans/durations.
- [x] **OPEN items assigned to A2/A3 on the core-mechanics critical path are
      RESOLVED (no BLOCKER)**
  - A2: O01 O02 O03 O04 O05 O06 O12 O13 O14 O15 O19 — RESOLVED.
  - A3: O07 O08 O18 — RESOLVED; O05 strings confirmed against the catalog.
  - Subsequent closes from A1+A3/A2 evidence: O09, O10, O11 (EXCLUDED), all
    RESOLVED; docs/08 has no BLOCKER entries.
- [x] **Extraction inventory matches expected counts (`docs/01` §3)**
  - Top-level tag counts identical to the `[CONFIRMED]` inventory (ShowFrame 241,
    DefineShape 33/2/12, DefineText 15, DefineEditText 47, DefineButton2 10,
    DefineSprite 37, DefineSound 9, DefineBitsLossless 1(+2), SoundStreamHead2 1,
    FrameLabel 4, DoAction 10, Protect 1); 4 frame labels; 9 sounds with exact
    payload sizes.

## Commands (exact, re-run by the orchestrator)

```
md5 ../kelimator-nostalji/calistir/kelimator_tr_2012_mochiads.swf            # af059ff9d75cefbc244f03814b47be9c
python3 artifacts/tools/a1-verify.py <swf> artifacts/decompiled <sesler>     # RESULT: PASS (0 failures)
afinfo <each of 10 exported sound files>                                      # 0 failures
python3 <minidom parse of 521 SVG files>                                      # 521 svgs, 0 bad, 0 empty
shasum -a 256 -c artifacts/decompiled/SHA256SUMS.txt                          # 672/672 OK
npx ajv-cli validate -s data/constants.schema.json -d data/constants.json     # valid
npx ajv-cli validate -s data/sound-map.schema.json -d data/sound-map.json     # valid
npx ajv-cli validate -s data/layout.schema.json -d data/layout.json           # valid
npm test                                                                      # 0 (suite green at time of check)
```

## Result

**PASS** — G1 conditions are met; dependent groups may proceed (E1 dispatched
with O08/O09/O10/O18 resolved; B2/B3 wait on B1 as per the DAG).

Amendment trail affecting G1: `docs/08-open-items.md` (Amendments, 2026-09-28).
