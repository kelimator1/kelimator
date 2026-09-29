# TASK Y9 — Status Lamp States: Geçerli/Girildi (owner-reported)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (queued behind Y8 — shares board/message/animations surfaces)
- Depends on: Y8, D5 (lifecycle/message), E2 (board), E3 (status sequence)
- Owned paths: `src/ui/message.ts`, `src/ui/board.ts` (status ball rendering only), `tools/process-assets.mjs` + `src/assets/svg/**` + `src/assets/manifest.json` (only if frames 2/3 need deterministic processing), `src/styles/**` (only if the state styles live there), `tests/e2e/status/**`, `tests/e2e/visual-states.ts` / `tests/e2e/visual.spec.ts` (only if status-region expectations need updating), `evidence/Y9-*`, `evidence/visual/Y9/**`, `evidence/logs/Y9-*`

## Defect (owner-investigated; owner-approved fix)
- The right-panel status capsule (element `status_ball`, sprite 123, bbox ~(447.4,238.4,107×34.8)) always shows its frame-1 dark ball, and `message.ts` draws the live text in fixed black.
- Reference sprite frames: **1 = blank/dark ball**; **2 = GREEN ball + green "Geçerli"**; **3 = RED ball + red "Girildi"**.

## Evidence
- Raw frames: `artifacts/decompiled/sprites/DefineSprite_123/{1,2,3}.svg` (frame 2/3 rendered proofs + live-app comparison in the owner session).
- Text ids 119/122 and the `gotoAndStop(2/3)` logic: `evidence/A2-strings.md` §2.
- Current app: `src/ui/message.ts` renders text only (`#000`, `STATUS_BOX`); the board renders only the frame-1 asset `s123_status_ball.svg`; E3's `sprite_status_ball_timeline` catalog entry does not drive any frame swap.

## Steps
1. Implement the three visual states exactly: idle (dark ball, no text), valid (green ball + "Geçerli" in the frame's green), already-found (red ball + "Girildi" in the frame's red). Source the ball graphics/text colours from the exported frames — or render frames 2/3 directly if that matches better — and decide with evidence; keep the live-text mechanism if it stays pixel-faithful.
2. Verify: sample/record the exact colours from the reference frames; add a status-state test (green/red/dark at dsf 1+2; before/after crops as evidence, like the owner's comparison sheet); keep visual states S2–S10 green (update any status-region expectations if needed); run the closing `tools/verify-all.sh`.
3. Amendment note (O05 area) + evidence + commit + report (task id + hashes).

## Unknowns
- None blocking; the frames-vs-live-text choice is evidence-based.

## Verify
- Status-state test green (dark/green/red at dsf 1+2); exact sampled colours recorded; before/after crops committed; visual 18/18 (or updated intentionally with recorded expectations); full `npm test`, `npm run lint`, `npm run build`; closing `tools/verify-all.sh` exit 0.

## Evidence
- `evidence/Y9-status-lamp.md` + `evidence/visual/Y9/**` + logs `evidence/logs/Y9-*`; proposed O05-area amendment line.

## Done
- Verify passes; committed as `task: Y9 status lamp states`.
