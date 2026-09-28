#!/usr/bin/env bash
# =============================================================================
# tools/verify-all.sh — T15 final matrix / G5 gate entry point (task F3).
#
# Runs the full required matrix in the task order (tasks/F3-final-matrix.md
# step 1, docs/07-verification.md §1/§6):
#
#   1. lint                          (npm run lint)
#   2. unit/integration              (npm test)                        [V4]
#   3. schema validations            (T06; all data/*.schema.json)     [V3]
#   4. fixtures                      (npm test -- fixtures)            [V4, T07]
#   5. idempotency                   (T10; build rounds twice)         [V8]
#   6. cross-consistency             (T04 npm test -- constants;
#                                     T05 npm test -- audio)            [V7]
#   7. visual regression             (npm run e2e -- visual)           [V5, T11]
#   8. animation checks              (npm run e2e -- animation)        [V5, T12]
#   9. playthrough                   (npm run e2e -- playthrough)      [V6, T13]
#  10. runtime offline               (npm run e2e -- offline)          [V2, T14]
#  11. frozen-evidence check         (no evidence/** modifications)
#
# Every step's exit code is recorded; the script exits 0 only when all steps
# PASS. Nothing under evidence/ is written here: the suites run WITHOUT the
# recording flags (C2/E2/E3/F2/F3_RECORD are unset), so all transient outputs
# go to test-results/ (evidence-freeze amendment 2026-09-28; F3 amendment
# 2026-09-29) and the final check `git status --porcelain -- evidence/` must
# report zero entries. The combined transcript is written to the project's
# non-committed `artifacts/` area (artifacts/verify-all/F3-verify-all.log;
# override with VERIFY_ALL_LOG_DIR): Playwright wipes its `test-results/`
# output directory at the start of every e2e run, so a transcript kept there
# would be deleted mid-matrix (caught by F3 attempt 1). The committed run log
# for task F3 is produced by copying the transcript to
# evidence/logs/F3-verify-all.log after a green run.
#
# Run from anywhere; the script cd's to the repository root.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

LOG_DIR="${VERIFY_ALL_LOG_DIR:-artifacts/verify-all}"
LOG_FILE="$LOG_DIR/F3-verify-all.log"
mkdir -p "$LOG_DIR"
: > "$LOG_FILE"

# A gate run is not a recording run: no suite may touch committed evidence.
unset C2_RECORD E2_RECORD E3_RECORD F2_RECORD F3_RECORD 2>/dev/null || true

STEP_NAMES=()
STEP_CODES=()
STEP_RESULTS=()

say() {
  printf '%s\n' "$*"
  printf '%s\n' "$*" >> "$LOG_FILE" || true
}

# run_step <name> <command...> — runs the command, streams its output to
# stdout and the transcript, records PASS/FAIL + exit code, never aborts.
# Only the command's own exit code (PIPESTATUS[0]) decides the verdict; a
# transcript write failure never flips a step.
run_step() {
  local name="$1"
  shift
  local code=0
  say ""
  say "===== [verify-all] STEP: $name ====="
  say "\$ $*"
  set +e
  "$@" 2>&1 | tee -a "$LOG_FILE"
  code=${PIPESTATUS[0]}
  set -e
  local result="PASS"
  if [ "$code" -ne 0 ]; then
    result="FAIL"
  fi
  say "===== [verify-all] $name: $result (exit $code) ====="
  STEP_NAMES+=("$name")
  STEP_CODES+=("$code")
  STEP_RESULTS+=("$result")
}

# --- Step functions ----------------------------------------------------------

# T06/V3: every data schema against its data file (strict: a missing data file
# is a failure, never silently skipped).
step_schemas() {
  local schema data
  while IFS=: read -r schema data; do
    [ -n "$schema" ] || continue
    echo "--- T06: $schema vs $data"
    if [ ! -f "$schema" ]; then
      echo "FAIL: schema file missing: $schema"
      return 1
    fi
    if [ ! -f "$data" ]; then
      echo "FAIL: data file missing: $data"
      return 1
    fi
    if ! npx ajv-cli validate -s "$schema" -d "$data"; then
      return 1
    fi
  done <<'EOF'
data/rounds.schema.json:src/data/rounds.json
data/constants.schema.json:data/constants.json
data/sound-map.schema.json:data/sound-map.json
data/layout.schema.json:data/layout.json
EOF
  echo "T06 PASS: all 4 schema/data pairs valid"
}

# T10/V8: build the round bank twice; both outputs must be byte-identical
# (SHA-256) and equal the committed artifact hash recorded by G2/O16
# (evidence/G2-gate.md; docs/08-open-items.md O16).
step_idempotency() {
  local recorded="7e4e149b3862b3f5ab77f755e8a8ae4215c2c8568a8ad30ee2311384b14b9a96"
  local first second
  echo "--- T10: node tools/build-rounds.mjs (run 1)"
  if ! node tools/build-rounds.mjs; then
    return 1
  fi
  first="$(shasum -a 256 src/data/rounds.json | awk '{print $1}')"
  echo "--- T10: node tools/build-rounds.mjs (run 2)"
  if ! node tools/build-rounds.mjs; then
    return 1
  fi
  second="$(shasum -a 256 src/data/rounds.json | awk '{print $1}')"
  echo "T10 run 1 sha256=$first"
  echo "T10 run 2 sha256=$second"
  echo "T10 recorded  sha256=$recorded"
  if [ "$first" != "$second" ]; then
    echo "T10 FAIL: rebuild hashes differ"
    return 1
  fi
  if [ "$first" != "$recorded" ]; then
    echo "T10 FAIL: hash drifted from the committed artifact"
    return 1
  fi
  echo "T10 PASS: identical SHA-256 across the two rebuilds and the committed artifact"
}

# T04/T05/V7: code constants and code audio events equal the data files.
step_cross_consistency() {
  echo "--- T04: npm test -- constants"
  if ! npm test -- constants; then
    return 1
  fi
  echo "--- T05: npm test -- audio (amended command, docs/07 §1)"
  if ! npm test -- audio; then
    return 1
  fi
  echo "T04/T05 PASS: constants and sound-map cross-consistency green"
}

# Frozen evidence: no entry of `git status --porcelain -- evidence/` may exist.
step_frozen_evidence() {
  local count
  count="$(git status --porcelain -- evidence/ | wc -l | tr -d ' ')"
  echo "evidence/ changed entries: $count (expected 0)"
  if [ "$count" -ne 0 ]; then
    echo "FAIL: evidence/ was modified during the gate run:"
    git status --porcelain -- evidence/
    return 1
  fi
  echo "frozen-evidence PASS: no evidence/** modifications"
}

# --- Matrix ------------------------------------------------------------------

say "tools/verify-all.sh — T15 final matrix (F3/G5)"
say "started: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
say "log: $LOG_FILE"

run_step "lint" npm run lint
run_step "unit/integration (npm test)" npm test
run_step "schema validations (T06)" step_schemas
run_step "fixtures (T07)" npm test -- fixtures
run_step "idempotency (T10)" step_idempotency
run_step "cross-consistency (T04/T05)" step_cross_consistency
run_step "visual (T11)" npm run e2e -- visual
run_step "animation (T12)" npm run e2e -- animation
run_step "playthrough (T13)" npm run e2e -- playthrough
run_step "offline (T14)" npm run e2e -- offline
run_step "frozen evidence check" step_frozen_evidence

# --- Summary -----------------------------------------------------------------

say ""
say "########## [verify-all] SUMMARY ##########"
failures=0
i=0
while [ "$i" -lt "${#STEP_NAMES[@]}" ]; do
  say "  ${STEP_RESULTS[$i]} exit=${STEP_CODES[$i]}  ${STEP_NAMES[$i]}"
  if [ "${STEP_CODES[$i]}" -ne 0 ]; then
    failures=$((failures + 1))
  fi
  i=$((i + 1))
done
say "steps: ${#STEP_NAMES[@]}  failures: $failures"
say "finished: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
say "transcript: $LOG_FILE (transient; copy to evidence/logs/F3-verify-all.log for the committed run log)"

if [ "$failures" -ne 0 ]; then
  say "RESULT: FAIL"
  exit 1
fi
say "RESULT: PASS — all ${#STEP_NAMES[@]} steps green"
exit 0
