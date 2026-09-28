# TASK F3 — Final Matrix

- Workstream: F (verification)
- Parallel group: 7
- Depends on: all previous tasks
- Owned paths: `tools/verify-all.sh` (final), `evidence/F3-*`

## Steps
1. Finalize `tools/verify-all.sh` to run, in order:
   - lint (`npm run lint`)
   - unit/integration (`npm test`)
   - schema validations (T06; all `data/*.schema.json` vs their data files)
   - fixtures (`npm test -- fixtures`)
   - idempotency (T10; rebuild rounds, compare hash)
   - cross-consistency (T04, T05, V7 checks)
   - visual regression (`npm run e2e -- visual`)
   - animation checks (`npm run e2e -- animation`)
   - playthrough (`npm run e2e -- playthrough`)
   - offline check (T14; Playwright offline mode: zero non-local requests)
   The script aggregates results; exits 0 only if all pass.
2. Re-run gate checklists G1–G5 from `docs/07` §6; record each as complete with
   evidence refs.
3. Re-check README §2 fixed decisions: no network features; static build;
   Turkish only; scene scaling at the documented formula.
4. Produce the single final report `evidence/F3-final-report.md`.

## Unknowns
- None by design. If any task is incomplete or any item BLOCKER, F3 cannot
  pass — record and stop.

## Verify
- V2: `tools/verify-all.sh` exits 0.
- V2: `evidence/F3-final-report.md` contains: command list with exit codes,
  gate checklists, the fixed-decision checklist, and all artifact hashes.
- V2: `npm run build` output works when served from a folder with no network
  (assertion in T14).

## Evidence
- `evidence/F3-final-report.md`
- `evidence/logs/F3-*.log`

## Done
- Single green report; committed; project complete.
