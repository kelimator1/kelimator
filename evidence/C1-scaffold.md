# C1 — Project Scaffold and Frozen Interfaces

Task: C1 — Project Scaffold and Frozen Interfaces
Started: 2026-09-28T12:31:30Z
Ended: 2026-09-28T12:36:40Z
Host+OS: dev-host.home / hidden
Commands executed (exact): full list with exit codes and raw logs in §4 "Verification results"; primary verification commands:
  - `npm run build`
  - `npm test`
  - `npm run lint`
  - `npx ajv-cli compile -s data/{rounds,constants,sound-map,layout}.schema.json`
  - `diff -u <extracted docs/06 §4 block> data/rounds.schema.json`
  - `tools/verify-all.sh`
Exit codes: build 0 · test 0 · lint 0 · ajv compile 4×0 · rounds diff 0 · verify-all.sh 0 (all other commands below)
Output summary: git repo initialized (no add/commit — orchestrator owns the commit); Vite + strict TypeScript npm project with pinned devDependencies and committed `package-lock.json`; `src/` layout exactly per `docs/04` §4 (interface-only stubs); four frozen schemas under `data/` (rounds verbatim from `docs/06` §4, diff-verified); executable `tools/verify-all.sh` stub; npm scripts `dev`, `build`, `test`, `lint`, `e2e`.
Artifact SHA-256 hashes:
  44fd8ead39a03f890c9934be94d9c673a19137f8fa4ad6eca575aaedd8e148fc  data/rounds.schema.json
  60ff0693dec47ee3e6cdfc68688479988ed2c7ec4686ece1b5304c5fe5ac3447  data/constants.schema.json
  1ebac08dfed6859cbc414ba8ad5984707b45f73f27cab88a671964d2b11186ac  data/sound-map.schema.json
  089e2fd4facae3803a59974181d5ab1dc641cfa149b698c460e9640ab160d96a  data/layout.schema.json
  62ea8fde39d000c1510f3b3189521653b5009ee078aada505518d53e917e8a43  package-lock.json
  855d8fab3eba751d79a75a7f4e886609f6c2836c8c484545312a46f453522d98  tools/verify-all.sh
Result: PASS

---

## 1. Versions (pinned, exact)

Host tools: node v22.14.0 · npm 10.9.0 · git 2.53.0 · macOS
(`evidence/logs/C1-versions.log`, `evidence/logs/C1-install.log`)

Installed with `npm install --save-dev --save-exact` (all exact pins in `package.json`, locked in `package-lock.json`):

| Package | Version |
|---|---|
| @eslint/js | 10.0.1 |
| @playwright/test | 1.63.0 |
| @types/node | 26.6.3 |
| ajv-cli | 5.0.0 |
| eslint | 10.11.0 |
| globals | 17.12.0 |
| prettier | 3.9.9 |
| typescript | 6.0.3 |
| typescript-eslint | 8.70.1 |
| vite | 8.3.1 |
| vitest | 5.0.2 |

`npx ajv-cli` resolves to the local pinned `node_modules/ajv-cli@5.0.0`
(proved with `npx --no-install ajv-cli compile -s data/rounds.schema.json` →
exit 0; symlink `node_modules/.bin/ajv -> ../ajv-cli/dist/index.js`):
`evidence/logs/C1-ajv-local.log`.

`npm audit`: 2 high-severity findings, both in `ajv-cli`'s dependency
`fast-json-patch <3.1.1`. Intentionally not "fixed": `npm audit fix --force`
would install `ajv-cli@0.6.0`, breaking the required pin. `ajv-cli` is a
dev/build-time validator, not runtime code.
(`evidence/logs/C1-hashes-tree-audit.log`)

## 2. Repository / project files

- `git init` executed in the repository root; branch `master` (git default).
  No `git add` / `git commit` was run (orchestrator stages and commits after
  verification, per worker instructions). The task's "initial commit exists"
  item is fulfilled by that orchestrator commit.
  (`evidence/logs/C1-git-init.log`)
- `.gitignore` covers `artifacts/`, `node_modules/`, `dist/`,
  Playwright/coverage output and OS files. Verified with
  `git check-ignore -v` (`evidence/logs/C1-gitignore.log`).
- `package.json` — scripts exactly as `docs/04` §7:
  - `dev`   → `vite`
  - `build` → `tsc --noEmit && vite build` (strict typecheck then static build)
  - `test`  → `vitest run`
  - `lint`  → `eslint .`
  - `e2e`   → `playwright test`
- `package-lock.json` present (committed by the orchestrator).
- `tsconfig.json` — `"strict": true`, ES2022 target, bundler resolution,
  `noEmit`, plus `noUnusedLocals`/`noUnusedParameters`; covers `src/` and the
  three config files.
- `vite.config.ts` — `base: './'` so `dist/` works when served from any local
  folder (`docs/04` §3, offline constraint).
- `vitest.config.ts` — discovers tests under BOTH `tests/**` and `verify/**`
  (`<dir>/**/*.test.{ts,mts,js,mjs}`), `passWithNoTests: true` so an empty
  suite exits 0. This is the passWithNoTests option, NOT a placeholder smoke
  test: no test files were created (tests/ and verify/ belong to other
  workers). `npm test` output: "No test files found, exiting with code 0".
- `playwright.config.ts` — scaffold only (no `webServer`): suites are
  `tests/e2e/**/*.spec.{ts,js,mjs}` and `verify/**/*.spec.{ts,js,mjs}`.
  App/reference suite options are added by the owning tasks (C2/C3/E2/E3/F2).
  With no specs present yet, `npx playwright test --list` reports
  "Total: 0 tests in 0 files" and exits 1 — expected at scaffold time;
  `tools/verify-all.sh` runs e2e only when spec files exist.
- `eslint.config.js` (flat config), `.prettierrc.json` (Prettier defaults),
  `.prettierignore`, `index.html` (minimal Vite entry loading `src/main.ts`).

`src/` layout exactly per `docs/04` §4 — stubs with exported interfaces only,
no behavior:

```
src/main.ts            bootstrap stub
src/stage.ts           scaler, fullscreen, viewport handling (C2)
src/game/state.ts      finite state machine (D5)
src/game/round.ts      exported `Round` type per docs/05 §2 (D1)
src/game/tiles.ts      deck + tile states (D2)
src/game/input.ts      keyboard + pointer handling (D2)
src/game/scoring.ts    scoring engine (D3)
src/game/timer.ts      countdown (D3)
src/game/lifecycle.ts  round start/end, completion sequences (D5)
src/ui/board.ts        layout rendering (E2)
src/ui/hud.ts          counters, found list, score (D5)
src/ui/message.ts      transient messages (D5)
src/audio/audio.ts     event→sound mapping consumer (D4)
src/data/.gitkeep      generated data files arrive from A2/A3/B3/E1
```

All other stubs are `export {};` with a one-line contract comment. The only
exported type is `Round` from `docs/05-game-core.md` §2.

## 3. Frozen interface files — decisions and evidence

### 3.1 `data/rounds.schema.json` — verbatim

Extracted byte-for-byte from the canonical block in `docs/06` §4 (awk between
the ```` ```json ```` fences) and diffed:

- `diff -u <extracted block> data/rounds.schema.json` → exit 0, no output.
- SHA-256 equality: extracted block = file =
  `44fd8ead39a03f890c9934be94d9c673a19137f8fa4ad6eca575aaedd8e148fc`.
- Logs: `evidence/logs/C1-rounds-extract.log`, `evidence/logs/C1-rounds-diff.log`.

### 3.2 Finding: the other three canonical blocks are shapes, not JSON Schemas

`docs/02` §8, `docs/03` §5 and `docs/03` §6 label their blocks
"canonical shape"; they are example instances of the data files, not JSON
Schema documents. A verbatim copy cannot satisfy the C1 Verify (`npx ajv-cli
compile -s <file>` exits 0). Probe (raw output in
`evidence/logs/C1-verbatim-probe.log`):

```
npx ajv-cli compile -s <verbatim docs/02 §8 block>  → exit 1
  error: strict mode: unknown keyword: "schemaVersion"
npx ajv-cli compile -s <verbatim docs/03 §5 block>  → exit 1 (same)
npx ajv-cli compile -s <verbatim docs/03 §6 block>  → exit 1 (same)
```

Therefore C1 authored draft-07 schemas that encode those canonical shapes.
No key was renamed; every key of the canonical blocks appears with the same
spelling and nesting. Interpretation decisions (all explicit, no invented
values):

- Every key shown in a canonical block is marked `required` (this is the
  "required" annotation A2's V7 dry-run is specified to read).
- Objects with an enumerated key set use `additionalProperties: false`
  (same style as the rounds schema); map-style objects
  (`constants.evidence`, `sound-map.sounds`, `sound-map.events`) accept
  arbitrary keys via `additionalProperties: { ... }`.
- `layout.elements[].kind`: the canonical block writes the union notation
  `"svg|bitmap|text"`; the schema encodes it as
  `"enum": ["svg", "bitmap", "text"]` (A3's task text lists
  "kind (svg | bitmap | text)" as the three alternatives).
- `layout.elements[].font.align`: plain `"type": "string"` — the block shows
  only `"left"`, so no enum values are invented.
- Numeric fields are plain `"type": "number"`: the spec says zeros are
  placeholders ("schema allows 0 only as 'unresolved'"); replacement is
  enforced downstream by A2's V7 dry-run over the required annotations, not by
  schema minimums.
- `schemaVersion` is `{"const": 1}` in all four schemas (canonical blocks show
  `1`; matches the verbatim rounds schema).

Schema self-tests (`evidence/logs/C1-schema-selftest.log`):
- docs/02 §8 block validates against `data/constants.schema.json` → valid.
- docs/03 §5 block validates against `data/sound-map.schema.json` → valid.
- docs/03 §6 block → invalid only at `/elements/0/kind` (the literal union
  notation); with the notation replaced by a concrete `"svg"` the same block
  validates → valid.

## 4. Verification results

| # | Check | Exact command | Exit | Log |
|---|---|---|---|---|
| V2 | Build | `npm run build` | 0 | `evidence/logs/C1-build.log` |
| V2 | Unit tests (empty suite, `passWithNoTests: true`) | `npm test` | 0 | `evidence/logs/C1-test.log` |
| V2 | Lint | `npm run lint` | 0 | `evidence/logs/C1-lint.log` |
| V3 | Schema compile ×4 | `npx ajv-cli compile -s data/<x>.schema.json` | 0,0,0,0 | `evidence/logs/C1-ajv-compile.log` |
| V3 | Schemas parse as JSON ×4 | `node -e "JSON.parse(...)"` | 0,0,0,0 | `evidence/logs/C1-ajv-compile.log` |
| V2 | Rounds schema verbatim | `diff -u <extracted docs/06 §4 block> data/rounds.schema.json` | 0 | `evidence/logs/C1-rounds-diff.log` |
| — | Single gate entry point (stub) | `tools/verify-all.sh` | 0 | `evidence/logs/C1-verify-all.log` |
| — | Dev server smoke (extra) | `npm run dev -- --port 5199 --strictPort` + `curl` | HTTP 200, killed | `evidence/logs/C1-dev.log` |
| — | Vitest filter path used by F1 (extra) | `npm test -- diff` | 0 | `evidence/logs/C1-test-filter.log` |
| — | Ignore rules (extra) | `git check-ignore -v artifacts dist node_modules .DS_Store` | 0 | `evidence/logs/C1-gitignore.log` |
| — | Final re-run after all writes | `npm run build` / `npm test` / `npm run lint` / `tools/verify-all.sh` | 0,0,0,0 | `evidence/logs/C1-final-rerun.log` |

F1 integration (orchestrator requirement): vitest `include` covers
`tests/**` AND `verify/**` for `*.test.{ts,mts,js,mjs}`. Since no writer may
place files in `verify/` from C1, discovery was proved by glob matching
(`node:path.matchesGlob`):
`verify/diff/pngdiff.test.mjs` → true, `tests/stage.test.ts` → true,
`verify/reference/capture.spec.ts` → false (Playwright, not Vitest).
(`evidence/logs/C1-scaffold-checks.log`)

`tools/verify-all.sh` stub (executable, mode `-rwxr-xr-x`): lint → unit tests
→ `npx ajv-cli compile` for every `data/*.schema.json` → `ajv-cli validate`
for any present `data/<x>.json` / `src/data/<x>.json` → `npm run e2e` only if
Playwright spec files exist. `set -euo pipefail`; exits non-zero on any
failure. F3 replaces it with the final gate matrix.

## 5. Notes for the orchestrator

1. No `git add` / `git commit` was executed (worker instruction overrides the
   task's step 7). All scaffold files are untracked and ready to stage;
   `dist/`, `node_modules/`, `artifacts/` are ignored.
2. Cross-document location discrepancy (not a C1 blocker, affects A2/A3
   Verify): `docs/04` §5 says `src/data/constants.json` (A2) and
   `src/data/layout.json`, `src/data/animation.json` (A3), while the task files
   for A2/A3 write and validate `data/constants.json`, `data/sound-map.json`,
   `data/layout.json`, `data/animation.json`. `tools/verify-all.sh` accepts
   either location for schema validation. A dated amendment is the plan's
   mechanism if a single location must be fixed.
3. `npm run e2e` currently exits 1 ("No tests found") because no Playwright
   suite exists yet; this is expected and excluded from C1's Verify. C2/E2/E3/
   F2 add specs to `tests/e2e/**`, C3 to `verify/**`.
4. `src/data/` holds only `.gitkeep`; the generated JSON files are produced by
   A2/A3/B3/E1 per `docs/04` §5.
5. The four schema files are frozen interfaces; any later change requires the
   amendment protocol (`EXECUTION.md` §5).

---

## 6. Follow-up (eslint ignores for vendored Ruffle)

Added: 2026-09-28T13:31Z — config hygiene only, no behavior change. Scope of the
follow-up: `eslint.config.js`, `evidence/C1-*`, `evidence/logs/C1-*` only.

**Problem.** Repo-wide `npm run lint` failed with 598 errors (baseline logged):
594 from the pinned Ruffle web self-hosted distribution vendored by C3 at
`verify/reference/ruffle/**` (third-party code ESLint walked), plus 4 genuine
`no-undef` errors in C3's hand-written `verify/reference/capture.mjs` —
`document` used inside Playwright `page.evaluate` callbacks, which execute in
the browser context while the script itself runs in Node.

**Change (exact diff, `eslint.config.js`).**

```diff
--- eslint.config.js.before
+++ eslint.config.js
@@ -5,7 +5,17 @@
 
 export default tseslint.config(
   {
-    ignores: ['dist/**', 'node_modules/**', 'artifacts/**', 'evidence/**'],
+    ignores: [
+      'dist/**',
+      'node_modules/**',
+      'artifacts/**',
+      'evidence/**',
+      // Vendored third-party reference material: pinned Ruffle web self-hosted
+      // distribution (task C3) and any other minified bundles. Hand-written
+      // C3 harness scripts outside this directory stay linted.
+      'verify/reference/ruffle/**',
+      '**/*.min.js',
+    ],
   },
   js.configs.recommended,
   ...tseslint.configs.recommended,
@@ -23,4 +33,11 @@
     ],
     languageOptions: { globals: globals.node },
   },
+  {
+    // C3 harness scripts run in Node but embed browser-context callbacks
+    // (Playwright `page.evaluate`), so they see both global sets. Not ignored —
+    // every rule still applies.
+    files: ['verify/reference/**/*.{ts,mts,js,mjs}'],
+    languageOptions: { globals: { ...globals.node, ...globals.browser } },
+  },
 );
```

Nothing else is ignored: `verify/reference/**` hand-written scripts, `verify/diff/**`
(F1), `tests/**`, `tools/**`, `src/**`, root configs and the scripts under
`verify/reference/` remain linted.

**Scope proof** (deliberate-error probe content via `--stdin-filename`; the
real files were not modified — `verify/**` is not C1-owned):

```
verify/reference/ruffle/web/ruffle.js → "File ignored because of a matching ignore pattern" (0 errors)
verify/reference/capture.mjs          → still linted: typo'd `foo` reported as no-undef;
                                        `document` and `process` both resolve (node+browser globals)
```

**Commands and exit codes** (raw log: `evidence/logs/C1-lint-ignores.log`):

| Command | Exit |
|---|---|
| `npm run lint` (before) | 1 (598 errors: 594 vendored + 4 capture.mjs) |
| `npm run lint` (after, repo-wide) | 0 |
| `npx eslint --no-warn-ignored verify/reference/ruffle/web/ruffle.js` | 0 (ignored) |
| `npx eslint verify/reference/capture.mjs` | 0 (linted clean) |
| `npm test` | 0 — 3 files, 30 tests passed (`tests/constants.test.mjs`, `tests/stage.test.ts`, `verify/diff/diff.test.mjs`) |
| `npm run build` | 0 |
| `npx ajv-cli compile -s data/{rounds,constants,sound-map,layout}.schema.json` | 0, 0, 0, 0 |

The `npm test` run above is also live evidence of the C1 requirement that
Vitest discovers `verify/**` tests: F1's `verify/diff/diff.test.mjs` ran
(16 tests) alongside `tests/**`.

New `eslint.config.js` SHA-256:
`df93ec86e482e4392141d96d8235b89a62b919a6cbc57701e689526f4161046b`
(previous: `3cd8a8b070cd08e314fec47ff7e4ab2680c94205a9aafb7cb6775b22122c2cff`).
C3's `verify/reference/capture.mjs` as linted in this run:
`8cd288522ca2ba24d574f14877394d32bcc12259cc3abab9607b7a783e7e4f0`.

Notes: the ignore is path-based, so it keeps matching while C3 continues to
write into `verify/reference/ruffle/`. The vendored tree also contains
`verify/reference/__pycache__/server.cpython-314.pyc` (compiled Python cache,
not an ESLint concern); if it should not be committed, the orchestrator owns
`.gitignore` changes (this follow-up was restricted to `eslint.config.js` and
C1 evidence). No git commands were run; no other config or task file was
touched.
