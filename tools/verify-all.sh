#!/usr/bin/env bash
# tools/verify-all.sh — single gate entry point (stub; finalized by task F3).
# Runs: lint, unit tests, schema validations, and (when present) Playwright suites.
# Exits non-zero on any failure.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[verify-all] lint"
npm run lint

echo "[verify-all] unit/integration tests"
npm test

echo "[verify-all] schema compilation"
shopt -s nullglob
schemas=(data/*.schema.json)
if [ "${#schemas[@]}" -eq 0 ]; then
  echo "[verify-all] FAIL: no schemas found under data/" >&2
  exit 1
fi
for schema in "${schemas[@]}"; do
  echo "[verify-all] compile $schema"
  npx ajv-cli compile -s "$schema"
done

echo "[verify-all] schema validation for present data files"
for schema in "${schemas[@]}"; do
  base="$(basename "$schema" .schema.json)"
  for candidate in "data/$base.json" "src/data/$base.json"; do
    if [ -f "$candidate" ]; then
      echo "[verify-all] validate -s $schema -d $candidate"
      npx ajv-cli validate -s "$schema" -d "$candidate"
    fi
  done
done

echo "[verify-all] Playwright suites (when present)"
specs="$(find tests/e2e verify -type f \( -name '*.spec.ts' -o -name '*.spec.js' -o -name '*.spec.mjs' \) 2>/dev/null || true)"
if [ -n "$specs" ]; then
  npm run e2e
else
  echo "[verify-all] no Playwright suites present — skipped"
fi

echo "[verify-all] OK"
