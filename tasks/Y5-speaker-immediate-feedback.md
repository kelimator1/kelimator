# TASK Y5 — Speaker Toggle: Immediate Visual Feedback (owner follow-up)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (single task)
- Depends on: X3 (speaker toggle), Y4 (knob alpha restore)
- Owned paths: `src/ui/hud.ts` (`onSpeakerClick` + the immediate `syncSpeakerVisual` call only), `tests/e2e/speaker/**`, `evidence/Y5-*`, `evidence/visual/Y5/**`, `evidence/logs/Y5-*`

## Defect story (owner-investigated; root cause certain)
- Every click toggles the persisted volume reliably (36/36 inset-grid points; 43/43 instrumented clicks hit `btn_speaker`; rapid clicks 100→0→100→0→100). No dead zones.
- BUT the icon does not repaint at click time (current behavior is faithful to the reference: C3 probe 0 px on a plain click; the sprite only re-evaluates `vol` on frame entry). With no feedback users click again — a fast-even click count toggles straight back (dblclick: 100→100) — so it "sometimes does nothing", and the icon appears to flip on unrelated later renders.
- Owner decision: behave like a simple toggle — flip the icon immediately on click. **Do NOT add click debouncing** (a double-click flipping twice is normal toggle behavior; the fix is instant feedback, not input filtering).

## Steps
1. `src/ui/hud.ts` `onSpeakerClick`: after `toggleMute()`, call `syncSpeakerVisual(options.board)` so the icon (waves hide/show + pale off-filter + `data-speaker`) updates immediately.
2. `tests/e2e/speaker/speaker.spec.ts`: replace the "no repaint on click" assertions with immediate-feedback assertions — after click: `data-speaker` flips `'off'` (waves hidden; screenshot differs from ON) with NO intervening render; click again: flips back `'on'` immediately. Keep the reload/persistence coverage.
3. Dated amendment: deliberate deviation from the measured reference behavior (immediate repaint vs 0 px on a plain click) — owner preference for usable feedback; add a SUPERSEDING note for the X3/O24 timing record in the NEW evidence file (do not rewrite old evidence).
4. Evidence: pre/post probes showing the icon flips per click (dsf 1 + 2), the grid/parity findings above, suite results.
5. Re-run: speaker suite + visual + full closing matrix (`tools/verify-all.sh`, orchestrator); commit; report task id + hashes.

## Unknowns
- None.

## Verify
- Speaker suite green with the new immediate-feedback assertions (dsf 1+2 where applicable); `npm run e2e -- visual` green; full `npm test`, `npm run lint`, `npm run build` green; closing `tools/verify-all.sh` exit 0.

## Evidence
- `evidence/Y5-speaker-feedback.md` + probes under `evidence/visual/Y5/**` + logs `evidence/logs/Y5-*`.

## Done
- Verify passes; committed as `task: Y5 speaker immediate feedback`.
