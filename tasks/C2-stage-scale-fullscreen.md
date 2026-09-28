# TASK C2 — Stage, Scaling, Fullscreen

- Workstream: C (application)
- Parallel group: 2
- Depends on: C1
- Owned paths: `src/stage.ts`, `src/ui/**` (stage shell only), `tests/stage.test.ts`, `evidence/C2-*`

## Inputs
- `docs/04-architecture.md` §2, §6
- `data/constants.json` (A2; if absent, use the placeholder stage values from
  `docs/02` §8 for layout testing only — never for gameplay values)

## Steps
1. Implement the stage shell: a `550 × 400` logical root, a viewport wrapper
   computing `scale = min(vw/550, vh/400)`, centered by transform; letterbox
   filled with the extracted background color when available, otherwise the
   documented fallback.
2. Recompute on `resize`, `orientationchange`, `fullscreenchange`.
3. Fullscreen: `requestFullscreen()` on a user gesture element; same scale
   formula inside fullscreen.
4. Add `data-testid` stage shell elements per `docs/04` §6 and expose
   `window.__game` (state getter scaffolding only in this task).
5. Unit tests for the scale function across a viewport matrix (e.g.,
   `320×480`, `550×400`, `1920×1080`, `3840×2160`, one ultra-wide) asserting
   `scale = min(vw/550, vh/400)` and center offsets.

## Unknowns
- None.

## Verify
- V4: `npm test -- stage` passes for the full viewport matrix.
- V5 (smoke): `npm run e2e -- smoke` — page loads; stage root has the computed
  scale (± 0.01 px); letterbox color matches the computed value; screenshot is
  non-blank (recorded).
- V2: fullscreen toggle does not change the computed scale for the same
  viewport dimensions (test assertion).

## Evidence
- `evidence/C2-stage.md` (matrix results, smoke screenshots list)
- `evidence/visual/C2-smoke/` (screenshots)

## Done
- Verify passes; committed.
