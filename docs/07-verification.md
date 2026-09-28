# 07 — Verification

All verification is empirical: commands produce pass/fail results; results are
recorded as evidence. No subjective sign-off without a recorded artifact.

---

## 1. Master test matrix

| ID | Scope | Type | Command | Pass criteria |
|---|---|---|---|---|
| T01 | Reference SWF integrity | V1 | `md5 <swf>` | equals `af059ff9d75cefbc244f03814b47be9c` |
| T02 | Extraction completeness | V2 | A1 manifest script | every expected export exists, non-empty |
| T03 | Sound files valid | V2 | `afinfo <file>` per sound | exit 0 for all |
| T04 | Constants resolved | V7 | `npm test -- constants` | no placeholder values for required fields; code constants match `data/constants.json` |
| T05 | Sound map consistency | V7 | `npm test -- soundmap` | code events ⊆ map; map entries have evidence |
| T06 | Rounds schema | V3 | `npx ajv-cli validate` | valid |
| T07 | Round fixtures | V4 | `npm test -- fixtures` | structural checks pass |
| T08 | Scoring engine | V4 | `npm test -- scoring` | oracle table below |
| T09 | Duplicate/edge input | V4 | `npm test -- input` | per resolved O04/O15 rules |
| T10 | Round generation idempotency | V8 | `tools/build-rounds.sh` twice | identical SHA-256 |
| T11 | Static visual states | V5 | `npm run e2e -- visual` | thresholds §4 met for S1–S10 |
| T12 | Animation keyframes | V5 | `npm run e2e -- animation` | thresholds §4 met at defined frame offsets |
| T13 | Playthrough | V6 | `npm run e2e -- playthrough` | score/list/state assertions per script |
| T14 | Runtime offline | V2 | Playwright offline mode | zero non-local requests; app functional |
| T15 | Full matrix | — | `tools/verify-all.sh` | exit 0 |

### Scoring oracle (T08; derived from `docs/02` §3)

| Input | Expected |
|---|---|
| 3-letter word, no bonus | 450 |
| 8-letter main word, no bonus | 3200 |
| 4-letter word containing bonus letter | 5800 |
| Remaining time 100 s at completion | +10000 |

Exact integer arithmetic; the oracle values are computed from the confirmed
formulas and asserted in unit tests.

## 2. Fixtures

- `tests/fixtures/rounds/` — archived round XMLs (see `docs/06` §5).
- `tests/fixtures/reference/` — reference screenshots and records produced by
  the capture harness (C3/F1) for the state matrix §3.
- `tests/fixtures/playthrough.json` — deterministic input script: the sequence
  of submitted words for the fixture round, chosen from the archived FİNALİZM
  word list (words only; no new material created).

## 3. Reference capture specification (C3)

- `verify/reference/index.html` embeds the Ruffle **web self-hosted** build
  (pinned release `v0.6.0` asset `ruffle-0.6.0-web-selfhosted.zip`; record its
  SHA-256 before use) and loads the reference SWF over HTTP.
- The SWF, the fixture `xml64.php`, and the Ruffle web files are served from
  the same static root so the game's relative fetch resolves locally.
- Playwright drives the reference and captures screenshots for the state
  matrix. Ad-network calls fail; this is expected and recorded. The earlier
  local run proved the build proceeds and requests `xml64.php`
  **[CONFIRMED-OBSERVED]**; if the capture harness observes a different flow,
  that observation is recorded and the harness waits for the round board state
  before proceeding (never infers).
- Capture artifacts: `tests/fixtures/reference/<state>.png` plus a JSON log of
  the interaction sequence used. Deterministic: fixture round is fixed.

## 4. Visual thresholds (V5)

- Canvas: 550 × 400 logical pixels at `deviceScaleFactor: 1` and `2`.
- Static states: per-pixel RGB Euclidean distance; a pixel is "mismatched" if
  distance > 30 (of 441.7 max); pass if mismatched ≤ 2.0 % of stage pixels.
- Animation checks: keyframe screenshots at the offsets defined in
  `data/animation.json`; pass if each keyframe meets the static threshold.
- Diff images for every checked state are stored under
  `evidence/visual/<state>/`; a failing state includes a heatmap and the
  numeric mismatch ratio.

## 5. State matrix (S1–S10)

| State | Trigger sequence (app and reference use the same) |
|---|---|
| S1 boot/initial | load page, wait for first stable frame |
| S2 idle board | round loaded; no input |
| S3 scrambled | press SPACE |
| S4 partial entry | click/type 3 tiles |
| S5 valid word | submit a 3-letter fixture word |
| S6 invalid word | submit a non-list entry |
| S7 bonus word | submit a fixture word containing the bonus letter |
| S8 all-found | submit every fixture word (scripted) |
| S9 timeout | wait out the timer (or stop timer per reference behavior) |
| S10 next round | start a new round after completion |

The exact interactions for S5–S10 are derived from `docs/02` [TBC] resolutions
and encoded in `tests/fixtures/playthrough.json`.

## 6. Gate checklists

- **G1**: T01–T03 pass; no OPEN critical items in A2/A3.
- **G2**: T06, T07, T10 pass.
- **G3**: T04, T05, T08, T09 pass; T13 basic variant passes.
- **G4**: T11, T12 pass.
- **G5**: T14, T15 pass; G1–G4 evidence complete.

## 7. Evidence format

Per run: command, exit code, summary, artifact hashes, `Result: PASS|FAIL`.
Failures are never edited away; a failing run is followed by a passing run
only after the root cause is fixed and both are recorded.
