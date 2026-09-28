# F1 — Diff Tooling — Evidence

Task: F1 — Diff Tooling
Started: 2026-09-28T12:42:32Z
Ended: 2026-09-28T12:45:24Z
Host+OS: dev-host.home / hidden (macOS, zsh; Node v22.14.0, npm 10.9.0)

## Commands executed (exact)

Session transcript of commands, outputs and exit codes is in
`evidence/logs/F1-*.log`; the list below is the command-level index.

| # | Command | Exit | Log |
|---|---|---|---|
| 1 | `date -u +%Y-%m-%dT%H:%M:%SZ; node --version; npm --version; node -e "…crc32 probe…"; hostname; sw_vers -productVersion` | 0 | F1-env.log |
| 2 | `npm test -- diff` (initial run; 1 test failed) | 1 | F1-test-run1-failure.log (preserved) |
| 3 | `npm test -- diff` (after decoder fix; **V4 final**) | 0 | F1-test.log |
| 4 | `node verify/diff/fixtures.mjs evidence/F1-artifacts` | 0 | F1-run.log |
| 5 | `node verify/diff/diff.mjs evidence/F1-artifacts/base.png evidence/F1-artifacts/mutated.png evidence/F1-artifacts/mutated-run-1` | 0 | F1-run.log |
| 6 | `node verify/diff/diff.mjs evidence/F1-artifacts/base.png evidence/F1-artifacts/mutated.png evidence/F1-artifacts/mutated-run-2` | 0 | F1-run.log |
| 7 | `node verify/diff/diff.mjs evidence/F1-artifacts/base.png evidence/F1-artifacts/base.png evidence/F1-artifacts/identical-run` | 0 | F1-run.log |
| 8 | `shasum -a 256 evidence/F1-artifacts/mutated-run-{1,2}/report.json` (**V8**) | 0 | F1-run.log |
| 9 | `node -e "…parse all three report.json…"` (**V2**) | 0 | F1-run.log |
| 10 | `ls -l evidence/F1-artifacts …` | 0 | F1-run.log |
| 11 | `node verify/diff/diff.mjs` (no args → one usage line, stderr) | 1 | F1-usage.log |
| 12 | `node verify/diff/diff.mjs --help` (usage, stdout) | 0 | F1-usage.log |
| 13 | `node verify/diff/diff.mjs …/base.png <64x48.png> <outdir>` (size mismatch) | 1 | F1-usage.log |
| 14 | `file evidence/F1-artifacts/mutated-run-1/heatmap.png …/report.json` | 0 | F1-usage.log |
| 15 | `shasum -a 256 <tool files + all artifacts>` | 0 | F1-hashes.log |

Note on command 13: the first attempt used the temp path declared in the
worker brief (`/private/var/folders/kt/hj1k21b6g5…`, wrong/not writable);
the failure and the corrected run (using the actual `$TMPDIR`) are both in
F1-usage.log. Corrected result: `diff: size mismatch: base.png is 550x400,
small.png is 64x48`, exit 1, no report written.

## V4 — self-tests (`npm test -- diff`)

- Final: **16 tests passed, 1 test file passed, exit 0** (`evidence/logs/F1-test.log`).
- Initial run failed 1/16: truncated-PNG decode reported `missing IDAT chunk`
  instead of a truncation error (a PNG without IEND was also accepted). Root
  cause and fix recorded in `evidence/logs/F1-test-run1-failure.log`; decoder
  now rejects partial chunk headers and requires IEND. Failure kept on record
  per docs/07-verification.md §7.
- Covered: codec round-trip; non-PNG / truncated / CRC-corrupt inputs;
  threshold boundary (distance 30 = match, 31 = mismatch); alpha ignored
  (RGB-only distance, docs/07-verification.md §4); identical 550x400 stages →
  ratio 0 / `pass: true`; 10x10 block +100/channel → `mismatchBBox` equals the
  block, ratio exactly 100/220000; size mismatch / undecodable / missing file /
  wrong-argc → exit 1 + exactly one stderr line; `--help` → exit 0;
  determinism (two runs byte-identical `report.json` and `heatmap.png`).

## V2 — outputs for the mutated case

Parsed `evidence/F1-artifacts/mutated-run-1/report.json` (identical values in
run-2):

```json
{"schemaVersion":1,"tool":"verify/diff/diff.mjs","width":550,"height":400,
 "totalPixels":220000,"mismatchThreshold":30,"passRatio":0.02,
 "mismatchedPixels":100,"mismatchRatio":0.00045454545454545455,
 "maxDistance":173.20508075688772,"meanDistance":0.07872958216222185,
 "mismatchBBox":{"x":123,"y":45,"width":10,"height":10},"pass":true}
```

- Identical case (`identical-run/report.json`): `mismatchedPixels: 0`,
  `mismatchRatio: 0`, `maxDistance: 0`, `meanDistance: 0`,
  `mismatchBBox: null`, `pass: true` — **ratio 0, pass true** as required.
- Mutated case: exactly the 10x10 block at (123,45) detected, distance
  sqrt(3)*100 = 173.205… (> threshold 30), ratio 100/220000.
- `file` on artifacts: `PNG image data, 550 x 400, 8-bit/color RGBA,
  non-interlaced` (heatmap) and `JSON data` (report).

## V8 — idempotency

```
17e668b8990f179b61108a91cb3d9ffeeede06d1c6f05bccbcd1c24a39d7ce1c  mutated-run-1/report.json
17e668b8990f179b61108a91cb3d9ffeeede06d1c6f05bccbcd1c24a39d7ce1c  mutated-run-2/report.json
```

Byte-identical, different output directories. Heatmaps are byte-identical too
(see hashes below). No timestamps/paths/random ordering enter `report.json`.

## Usage / help / exit-code contract (raw)

- `node verify/diff/diff.mjs` → stderr: `diff: usage: node verify/diff/diff.mjs
  <a.png> <b.png> <outdir> (try --help)`, exit 1.
- `node verify/diff/diff.mjs --help` → usage block on stdout, exit 0.
- Size mismatch → one line `diff: size mismatch: …`, exit 1; success exit 0
  regardless of ratio (verdict in `pass`).

## Threshold check against docs/07-verification.md §4

- "a pixel is 'mismatched' if distance > 30 (of 441.7 max)" → implemented as
  strictly greater than 30 (boundary unit test: 30 matches, 31 mismatches);
  max constant `Math.sqrt(3*255*255) = 441.6729559300637`. **Consistent.**
- Nuance recorded: §4 also fixes the acceptance ratio — "pass if mismatched
  ≤ 2.0 % of stage pixels" — so `pass = mismatchedPixels <= totalPixels * 0.02`
  (`<=`, not `<`); the ratio itself is reported unrounded. Alpha is excluded
  (RGB-only definition). Both documented in `verify/diff/README.md`.
- §4 mentions stage capture at `deviceScaleFactor` 1 (550x400) and 2
  (1100x800); the tool is size-agnostic (any identical dimensions).

## Dependency decision

No npm dependency. PNG decode/encode implemented with `node:zlib`
(`inflateSync`, `deflateSync`, `crc32`) plus `Buffer`; `zlib.crc32` requires
Node ≥ 22.2.0, verified on v22.14.0 (`crc32("123456789") = cbf43926`, the
published check value). `verify/diff/` has no `package.json` and no
`node_modules`; rationale and evidence pointer also recorded in
`verify/diff/README.md` ("Implementation decision"). Alternative (pinned
`pngjs` via `npm install --prefix verify/diff`) intentionally not used.

## Artifact SHA-256 hashes

```
89dc4bcf1415ad5e9c76cc1570a96568b9a32a13ddf99648b7bae573d44c2b75  verify/diff/diff.mjs
5908d2f5680192ffdb6a0892b24f3fd4c6ffe0ad2c08f5d3495127eefc0d1dcc  verify/diff/fixtures.mjs
ab33e0b656cc7e4e56337f29336e7b9dc2bfe000de6ce895fb29ec3039918f70  verify/diff/diff.test.mjs
d6b098fd7cfd524312677a2ff2e3ee5563b139271e81c0a71ce3e266ad54762e  verify/diff/README.md
f256d4a52fd2ce0988aaa3f2347bdb6b2dd32bafb36be20939eb964f5cafd838  evidence/F1-artifacts/base.png
dbb35de6bc45f612fb486a0016b26b71dded6b6a051a611d13dae53d834f8ba8  evidence/F1-artifacts/mutated.png
17e668b8990f179b61108a91cb3d9ffeeede06d1c6f05bccbcd1c24a39d7ce1c  evidence/F1-artifacts/mutated-run-1/report.json
a7e7dc1edf64e0f24bc05939b3fe2fbbdf93cc0986e7e778c6063785faf2dabc  evidence/F1-artifacts/mutated-run-1/heatmap.png
17e668b8990f179b61108a91cb3d9ffeeede06d1c6f05bccbcd1c24a39d7ce1c  evidence/F1-artifacts/mutated-run-2/report.json
a7e7dc1edf64e0f24bc05939b3fe2fbbdf93cc0986e7e778c6063785faf2dabc  evidence/F1-artifacts/mutated-run-2/heatmap.png
b99589dee0f3def7067bb2c6c830314d54365dd625a4d596953619ddcd76d545  evidence/F1-artifacts/identical-run/report.json
b01bd3da03f0c3bab3489c758998093d8c045602c6974f0eb31e6cb4e4276bbd  evidence/F1-artifacts/identical-run/heatmap.png
```

(Full `shasum` output: `evidence/logs/F1-hashes.log`.)

## Files produced

- `verify/diff/diff.mjs` — the tool (CLI + exported API; zero deps).
- `verify/diff/fixtures.mjs` — deterministic fixture generator (also used by tests).
- `verify/diff/diff.test.mjs` — Vitest self-tests (`npm test -- diff`).
- `verify/diff/README.md` — stable `report.json` schema, exit-code contract,
  heatmap encoding, determinism notes for C3/E2/E3/F2.
- `evidence/F1-artifacts/` — raw inputs, reports, heatmaps for the recorded runs.
- `evidence/logs/F1-{env,test,test-run1-failure,run,usage,hashes}.log`.

Scope respected: writes only under `verify/diff/**` and `evidence/F1-*`; no
change to root `package.json`, `vitest.config.ts`, or any other C1-owned file;
no git commands run; `../kelimator-nostalji/` untouched.

Result: PASS

---

# Follow-up (lint fix) — 2026-09-28

Scope: fix ESLint `preserve-caught-error` errors in `verify/diff/diff.mjs`
only; no behavior change.

## Commands, outputs, exit codes

| # | Command | Exit | Log |
|---|---|---|---|
| F1 | `npm run lint` (before fix) | 1 | `evidence/logs/F1-lint-followup-before.log` |
| F2 | `npx eslint verify/diff/diff.mjs` (after fix) | **0** | `evidence/logs/F1-lint-followup-after.log` |
| F3 | `npm run lint` (after fix, repo-wide) | 1 | `evidence/logs/F1-lint-followup-after-full.log` |
| F4 | `npm test -- diff` (after fix) | 0 | `evidence/logs/F1-test-followup.log` |
| F5 | two CLI runs on the mutated pair + `shasum -a 256` + `cmp` (V8) | 0 | `evidence/logs/F1-v8-followup.log` |
| F6 | `shasum -a 256 verify/diff/*.mjs verify/diff/README.md` | 0 | `evidence/logs/F1-v8-followup.log` |

- F2: `verify/diff/diff.mjs` lints clean (exit 0).
- F4: **16 tests passed**, 1 test file passed, exit 0.
- F3 raw totals: `✖ 598 problems (598 errors, 0 warnings)` — see exact
  file split below. All remaining errors are in `verify/reference/**`
  (task C3's owned paths, created concurrently at 16:04–16:25 today);
  the three former `verify/diff/diff.mjs` errors are gone. Zero remaining
  errors in any F1 file.
- F5 V8: both new runs:
  `17e668b8990f179b61108a91cb3d9ffeeede06d1c6f05bccbcd1c24a39d7ce1c`
  — identical to the previously recorded hash, and
  `cmp -s` against `evidence/F1-artifacts/mutated-run-1/report.json`
  exits 0. Heatmaps also byte-identical to the recorded
  `a7e7dc1edf64e0f24bc05939b3fe2fbbdf93cc0986e7e778c6063785faf2dabc`.
  Exit 0 for both runs.

## Change made (behavior-neutral)

Three `catch` blocks in `verify/diff/diff.mjs` now pass `{ cause: err }` as the
second argument of the rethrown `Error` (`zlib inflate failed`, `cannot read`,
`cannot decode`). Error messages, CLI stdout/stderr text, exit codes,
`report.json` shape/values and PNG bytes are unchanged; only the (unused)
`error.cause` property is now attached, as the ESLint rule requires.

Updated `verify/diff/diff.mjs` SHA-256:
`616f265556d94a78b01ef925eccbd6e93c97e8cf6c1d9a68f28689a6be96af87`
(previous pre-fix value was `89dc4bcf1415ad5e9c76cc1570a96568b9a32a13ddf99648b7bae573d44c2b75`;
appended, marked superseding, in `evidence/logs/F1-hashes.log`).

## Repo-wide lint status (for the orchestrator; outside F1 write scope)

`npm run lint` currently exits 1 with 598 errors, all in C3-owned files —
F1's own files are clean:

```
  4  verify/reference/capture.mjs
114  verify/reference/ruffle/web/core.ruffle.c80159b526e567babaf5.js
115  verify/reference/ruffle/web/core.ruffle.f000070ea72f8ae4fe3a.js
365  verify/reference/ruffle/web/ruffle.js
```

`verify/reference/**` is task C3's owned path, and `eslint.config.js` is
C1-owned/pinned; both are outside the F1 follow-up's allowed write set, so
F1 does not modify them. Repo-wide `npm run lint` can only reach exit 0 after
C3 lints its own `capture.mjs` (or the orchestrator amends the C1 config to
ignore the vendored Ruffle bundle). Raw before/after outputs:
`evidence/logs/F1-lint-followup-before.log`,
`evidence/logs/F1-lint-followup-after-full.log`.

Follow-up result: F1 file clean; behavior byte-identical; repo-wide lint
blocked on C3-owned files (not an F1 failure).
