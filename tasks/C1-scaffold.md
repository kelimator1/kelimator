# TASK C1 — Project Scaffold and Frozen Interfaces

- Workstream: C (application)
- Parallel group: 1
- Depends on: none
- Owned paths: repository root (git init, package files, configs), `src/main.ts` (bootstrap stub only), `data/**` (schema files), `tools/verify-all.sh` (stub), `evidence/C1-*`

## Inputs
- `docs/04-architecture.md` (§1, §4, §7)
- `docs/02-mechanics-spec.md` §8 (constants schema spec)
- `docs/03-assets-and-visuals.md` §5, §6 (sound-map and layout schemas)
- `docs/06-dictionary-and-rounds.md` §4 (rounds schema, verbatim)

## Steps
1. `git init`; commit a `.gitignore` covering `artifacts/`, `node_modules/`,
   build output, and OS files.
2. Initialize the app: Vite + TypeScript (strict), npm with committed
   `package-lock.json`. Install and pin: Vitest, Playwright, ESLint, Prettier.
   Record exact versions in evidence.
3. Create the `src/` layout exactly as `docs/04` §4 (empty module stubs with
   exported interfaces only — no behavior yet).
4. Create the frozen interface files **verbatim**:
   - `data/rounds.schema.json` (from `docs/06` §4)
   - `data/constants.schema.json` (from `docs/02` §8; mark required fields)
   - `data/sound-map.schema.json` (from `docs/03` §5)
   - `data/layout.schema.json` (from `docs/03` §6)
5. Add `tools/verify-all.sh` stub that runs: lint, unit tests, schema
   validations, and (when present) Playwright suites; exits non-zero on any
   failure.
6. Add npm scripts: `dev`, `build`, `test`, `lint`, `e2e`.
7. Commit as `task: C1 scaffold`.

## Unknowns
- None.

## Verify
- V2: `npm run build` exits 0; `npm test` exits 0 (empty suite allowed,
  clearly reported); `npm run lint` exits 0.
- V3: all four schema files parse as JSON and validate themselves against the
  JSON Schema meta-schema via `npx ajv-cli compile -s <file>` (each exits 0).
- V2: `data/rounds.schema.json` content equals the canonical block in
  `docs/06` §4 (diff against the extracted block; exit 0).

## Evidence
- `evidence/C1-scaffold.md` (versions, commands, hashes of the schema files)
- `evidence/logs/C1-*.log`

## Done
- Verify passes; initial commit exists.
