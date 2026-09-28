# EXECUTION — Agent Operating Manual

This manual defines how the plan is executed. It is written for an orchestrating
AI agent with shell and file access, running on macOS, with no prior context.
Everything required is in this folder and the read-only
`../kelimator-nostalji/` directory.

**No guesses. No assumptions. No time estimates. Plan loyalty.**

---

## 1. Execution model

- **Orchestrator**: the main agent session. It schedules tasks from the DAG (§7),
  spawns one worker per ready task, collects evidence, runs gate checks, and
  makes git commits.
- **Workers**: fresh-context agent sessions. Each worker receives only:
  (a) its task file path, (b) this manual, (c) the doc sections its task
  references. A worker writes only inside its `Owned paths`.
- **Parallelism**: if the runtime supports concurrent workers, use up to
  **4 concurrent workers**. If it does not, execute tasks in topological order,
  one at a time. Dependencies are never violated.
- **File ownership**: each file is owned by exactly one task (the task that
  creates it). Any cross-task change goes through the owning task's
  verification. Two workers never write the same file.
- **Shared resources**: JPEXS/FFDec runs one instance at a time; network
  downloads are serialized. These are global locks.

## 2. Task file template

Every file in `tasks/` contains exactly these sections:

```
# TASK <ID> — <Title>
Workstream / Parallel group / Depends on
Owned paths      : directories/files this worker may write
Inputs           : exact files to read (paths; hashes where relevant)
Steps            : numbered, command-level actions
Unknowns         : IDs from docs/08-open-items.md; OPEN item => DO NOT START
Verify           : exact commands + expected result (verification types from §4)
Evidence         : file(s) to write under evidence/
Done             : exit checklist
```

A task is **done** only when `Verify` passes, `Evidence` is written, and any
`Unknowns` it was assigned to resolve are closed in `docs/08-open-items.md`.

## 3. Evidence protocol

- Every task writes `evidence/<ID>-<slug>.md` with a fixed header:

```
Task / Started (ISO) / Ended (ISO) / Host+OS
Commands executed (exact)
Exit codes
Output summary (what was produced)
Artifact SHA-256 hashes
Result: PASS | FAIL | BLOCKER
```

- Large raw logs go to `evidence/logs/<ID>-<name>.log` (plain text).
- Evidence files are committed together with the task's artifacts.
- Screenshots produced by visual checks live under `evidence/visual/<state>/`.

## 4. Verification types (catalog)

| Type | Meaning | Example command pattern |
|---|---|---|
| V1 | Hash equality | `shasum -a 256 <file>` equals recorded value |
| V2 | File count / format | `find … | wc -l`, `file`, `afinfo` exit 0 |
| V3 | Schema validation | `npx ajv-cli validate -s data/<x>.schema.json -d <file>` |
| V4 | Unit tests | `npm test` (Vitest) — all pass |
| V5 | Visual regression | Screenshot pairs + pixel diff, thresholds in `docs/07-verification.md` |
| V6 | E2E playthrough | Playwright scripted sequence, assertions via `window.__game` |
| V7 | Cross-consistency | Code constants `===` `data/*.json` values |
| V8 | Idempotency | Build/run twice → identical output hash |

Each task's `Verify` block names the types and the exact commands.

## 5. Unknowns protocol (no guessing)

- `docs/08-open-items.md` is the queue. Items have: ID, question, resolution
  procedure, evidence target, dependent tasks, status
  (`OPEN` / `RESOLVED` / `BLOCKER`).
- An item may be closed **only** by evidence produced via its documented
  procedure. Inference from similar builds, documentation, or "common sense" is
  not evidence.
- A task with an OPEN item in its `Unknowns` list must not start.
- **Frozen interfaces**: `data/rounds.schema.json`,
  `data/constants.schema.json`, `data/sound-map.schema.json` are created
  verbatim by C1 from their canonical specifications in `docs/`. Producers and
  consumers depend on these schemas; no drift is allowed without an explicit,
  dated amendment in the owning doc.
- Code constants carry `// evidence: <doc § / open-item ID>` comments. The
  cross-consistency test (V7) fails if a constant lacks evidence or mismatches
  `data/constants.json`.

## 6. Directory contract

- `artifacts/` — raw extracted/exported/downloaded data. **Not committed.**
- `evidence/`, `data/`, `src/`, `tools/`, `tests/`, `verify/` — committed.
- `../kelimator-nostalji/` — read-only source material. Never modified.
- Repository root = this folder. `git init` happens in C1; every completed task
  is committed with message `task: <ID> <short description>`.

## 7. DAG, parallel groups, and gates

### 7.1 Parallel groups

| Group | Tasks (run in parallel) | Depends on |
|---|---|---|
| 1 | A1, B1, C1, F1 | — |
| 2 | A2, A3, B2, C2, C3 | A1 → A2/A3 ; B1 → B2 ; C1 → C2/C3 ; F1 → (F2 later) |
| 3 | B3, D1 | B2 + C1 (frozen schemas) ; C2 + frozen schemas |
| 4 | D2, D3, D4, E1 | D1 → D2/D3 ; A2 → D3/D4 ; A3 → E1 ; C2 → E1 |
| 5 | D5, E2 | D2 + D3 → D5 ; E1 → E2 |
| 6 | E3, F2 | E2 + A3 → E3 ; C3 + D5 + E1 → F2 |
| 7 | F3 | all |

A group starts only when its dependencies are satisfied and the relevant gate
(§7.2) has passed.

### 7.2 Gates

**G1 — Reverse engineering complete** (after A1–A3)
- [ ] All A tasks PASS with evidence
- [ ] All OPEN items assigned to A2/A3 that are on the core-mechanics critical
      path are RESOLVED (no BLOCKER)
- [ ] Extraction inventory matches expected counts (§ `docs/01`)

**G2 — Data complete** (after B1–B3)
- [ ] `src/data/rounds.json` validates against `data/rounds.schema.json`
- [ ] Fixture tests pass
- [ ] Idempotency (V8) passes

**G3 — Playable core** (after C2, D1–D5)
- [ ] All unit tests pass
- [ ] Basic E2E playthrough passes (V6) on the app
- [ ] Placeholder visuals allowed at this gate

**G4 — Visual fidelity** (after E1–E3)
- [ ] Static-state pixel diffs within thresholds (`docs/07-verification.md` §4)
- [ ] Animation keyframe checks pass
- [ ] Sound-event mapping matches `data/sound-map.json`

**G5 — Final** (after F3)
- [ ] `tools/verify-all.sh` exits 0 (single green report)
- [ ] All G1–G4 checklists recorded as complete in evidence
- [ ] Fixed decisions (README §2) re-checked: zero network calls at runtime

## 8. Efficiency rules

- Front-load long/independent pipelines: A1, B1, C1, F1 start in group 1.
- FFDec performs a **single export pass**; do not re-open the SWF repeatedly.
- Cached downloads: skip if the recorded hash matches; re-download only on
  mismatch.
- Reuse of `../kelimator-nostalji/` artifacts is allowed **only** after hash
  verification against the 2012 reference build (sounds may byte-match; verify).
- Workers keep chat output minimal: large results go to files; the worker
  returns a short status line + evidence path.
- One final entry point: `tools/verify-all.sh`.

## 9. Failure and deviation policy

1. **Verification failure** → the task is FAILED with evidence. Fix within the
   task's scope; never patch downstream code or tests to hide a failure.
2. **Unresolvable fact** → `evidence/BLOCKER-<ID>.md` + mark the item BLOCKER
   in `docs/08-open-items.md`; stop that branch; continue independent branches.
3. **Plan cannot be executed as written** (tool missing, command impossible,
   contradiction) → BLOCKER protocol. Do not improvise an alternative silently.
4. **Amendments** to plan documents are allowed only with a dated
   `> Amendment:` note inside the affected document and a matching entry in
   `docs/08-open-items.md`. Amendment requires the orchestrator (not a worker)
   to act.
5. **Never guess a value to keep progressing.** A stopped branch is a correct
   outcome; an invented value is a project failure.
