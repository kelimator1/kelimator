# TASK F1 — Diff Tooling

- Workstream: F (verification)
- Parallel group: 1
- Depends on: none
- Owned paths: `verify/diff/**`, `evidence/F1-*`

## Steps
1. Implement `verify/diff/` as a small pinned Node tool:
   - input: two PNGs of identical dimensions (550×400 logical)
   - output: `report.json` with per-pixel mismatch ratio, max/mean RGB
     distance, and a heatmap PNG
   - threshold: mismatch = RGB Euclidean distance > 30; report the ratio
2. Self-test (must run before any other task uses the tool):
   - identical images → ratio 0, `pass: true`
   - a known-mutated copy (single 10×10 px block changed by +100 per channel)
     → the tool detects exactly the mutated region (assert coordinates/extent)
   - a size-mismatch input → clean error, non-zero exit
3. Provide a CLI: `node verify/diff/diff.mjs <a.png> <b.png> <outdir>`.

## Unknowns
- None.

## Verify
- V4: `npm test -- diff` runs the self-tests above and passes.
- V2: heatmap and report.json produced for the mutated case; JSON parses.
- V8: running the tool twice on the same inputs produces identical
  `report.json`.

## Evidence
- `evidence/F1-difftool.md` (self-test outputs, version pins)
- `evidence/logs/F1-*.log`

## Done
- Verify passes; committed. Tool is available for C3, E2, E3, F2.
