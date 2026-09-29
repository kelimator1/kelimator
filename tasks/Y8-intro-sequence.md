# TASK Y8 — Intro/Welcome Sequence, HD Vector (closes O23)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (single task; queued behind Y6/Y7 — both committed)
- Depends on: D5 (boot FSM), E2 (board), E3 (animations), C3 (scenario harness), Y7
- Owned paths: `src/game/lifecycle.ts` + `src/main.ts` (boot sequencing only), `src/ui/animations.ts`, `src/styles/animations.css`, `tools/process-assets.mjs` + `src/assets/svg/**` + `src/assets/manifest.json` (ONLY if additional intro frames must be exported deterministically; no new bitmaps), `tests/e2e/intro/**`, `tests/e2e/animations/**` (coverage update), `evidence/Y8-*`, `evidence/visual/Y8/**`, `evidence/logs/Y8-*`

## Owner directive
On boot, play the reference intro exactly — night sky with crescent moon/stars → dawn → sunrise (the sun = `intro_glow` on its path) → falling "kelimatör" logo settling — then continue into the settled board exactly as today. Render in HD: all intro assets are already vector SVGs; animate with sub-pixel CSS transforms/opacity, reuse the existing `GLOW_GRADIENT` for the sun, do not rasterize, do not add new bitmaps. No skip buttons/accessibility extras — stay faithful to the reference.

## Evidence / pointers
- Catalogs: `data/animation.json` (intro main timeline frames 5–130 @36 fps, keyframes 5/36/68/99/130; `intro_glow_motion` ch20 depth7 frames 5–222, keyframes 5/59/114/168/222 (214 Move tags); `intro_logo_motion` ch29 depth47 frames 41–202, keyframes 41/81/122/162/202); `evidence/A3-timing.md`.
- Main-timeline element motions: sky ch5 depth5 (38 moves), layer3 ch8 depth9 (37), ground ch6 depth8, backdrop ch1; exact Move/CXFORM values in `artifacts/decompiled/tags.xml` + `artifacts/a3-captures/main_events.json` (frame/depth/chid list).
- Owner live reference capture of the whole intro (~90 ms/frame): `artifacts/o23-captures/frames/f*.png` + `marks.json` (night+moon f40 → dawn f44 → sunrise f48 → logo falling f54 → landing f62 → settled f69); canonical `tests/fixtures/reference/S1-boot.png` also exists.
- Identify HOW night→day is achieved (sky/layer3 movement and/or CXFORM) from `tags.xml`; implement accordingly — do not guess.

## Steps
1. Timing/sequencing: D5 boot plays preloader(1–4) → intro(5–130) before the first settled board; input stays locked during the intro (verify the reference's gating from evidence); duration/timing constants carry `// evidence:` refs; plays on every boot/reload like the reference.
2. E3: implement the intro timeline (sky/ground/layer3/backdrop movement + night→day, sun path, falling logo) with sub-pixel transforms on the existing SVG layers; 36 fps cadence from the catalogs. Reuse `GLOW_GRADIENT`; no rasterization/new bitmaps. If an intro visual frame is not yet among the processed assets, export it deterministically through `tools/process-assets.mjs` (docs/03 §1 naming; hash-pinned, idempotent) — vector only.
3. Verify: e2e boot sequence (preloader→intro→board) + keyframe comparisons at the catalog offsets vs reference captures, dsf 1+2 (use/extend the C3 scenario pattern as E3/F2 did; tolerant ≤2 % basis); existing suites stay green (visual 18/18 etc.).
4. Close O23 in `docs/08` (orchestrator applies the RESOLVED line + amendments), then the closing `tools/verify-all.sh` (expect 11/11), commit, report (task id + hashes + how the HD/vector requirement was met).

## Unknowns
- Any unresolvable fact (e.g. a missing intro asset with no deterministic source) → BLOCKER record; do not invent.

## Verify
- Boot e2e green; keyframe comparisons at catalog offsets pass at dsf 1+2; input locked during intro; `npm test`, `npm run lint`, `npm run build` green; visual/animation/playthrough/interaction unchanged; closing `tools/verify-all.sh` exit 0.

## Evidence
- `evidence/Y8-intro.md` + `evidence/visual/Y8/**` + logs `evidence/logs/Y8-*`; proposed O23 RESOLVED line + docs lines.

## Done
- Verify passes; committed as `task: Y8 intro sequence (O23)`.
