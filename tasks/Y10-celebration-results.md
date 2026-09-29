# TASK Y10 — Win Celebration + Results Screen (Option A, owner-modified)

- Workstream: Y (owner presentation wave follow-up)
- Parallel group: Y (queued behind Y8 and Y9 — shares celebration/win surfaces, assets, tests)
- Depends on: Y8, Y9, D5 (celebration state), E3 (animations), C3 (harness)
- Owned paths: `src/game/lifecycle.ts` (celebration/results wiring only), `src/ui/animations.ts`, `src/styles/animations.css`, `src/ui/board.ts` (card/marquee rendering), `src/ui/hud.ts` (results form only), `tools/process-assets.mjs` + `src/assets/**` + `src/assets/manifest.json` (fireworks/card/marquee assets; deterministic, hash-pinned), `tests/e2e/celebration/**`, `tests/e2e/visual-states.ts` / `tests/e2e/visual.spec.ts` (celebration states), `tests/e2e/playthrough/**` (completion path), `evidence/Y10-*`, `evidence/visual/Y10/**`, `evidence/logs/Y10-*`

## Owner decision (Option A, with modifications)
Restore the win sequence (frames 132–241, ~3.0556 s) and the end/results screen — previously unpainted (E3 coverage row 4: "End screen excluded… the app's celebration state keeps the board"; the exclusion had been bundled with the network score form). Owner modifications:
- **Results card: REMOVE the "E-posta" field entirely. RENAME "Ad Soyad" → "İsim".**
- Keep EVERYTHING ELSE faithful: the bravo sequence (night sky + crescent moon + stars + orange fireworks + bottom marquee, frames 132–241), the results card (`TEBRİKLER` / `Puanınız` / `Kelime Sayısı` / `Süre`), the form slide-in (`hiscore_form_motion`, frames 222–241), and `Yeni Oyun` as the return path.
- **ZERO network**: the submit flow is placebo/local only — no request, no data, nothing stored (note in docs/evidence). Preserve the original UX: the original button action is a local navigation (`_root.gotoAndPlay("main")`; see the A2-labels grep) — implement the same local continue/navigate behavior.
- The "İsim" input stays interactive locally (placebo), same look/feel as the original field otherwise.

## Steps
1. Sweep the win-timeline data + assets from the SWF: night-sky layers (`intro_backdrop`/`intro_sky`/`intro_ground`/`intro_layer3` already extracted), the **fireworks source** (identify the exact sprite/anim from `tags.xml` / frame_132–241 placements), the card sprite 166 text ids (119/122-style evidence), and the marquee (`s170_bottom_marquee`).
2. Implement via the existing E3 animation + D5 celebration wiring (`SEQUENCE_TRIGGERS` already binds `win` / `hiscore_form_motion` / `bottom_marquee` to `'celebration'`); the card gets the owner edits: no E-posta, label `İsim` (asset edit with a dated amendment, X2/Y2 precedent; manifest/hash updates consistent; keep provenance).
3. Verify: C3 reference keyframes for the celebration where capturable (fireworks/motion) + record the owner-modified-card deviations explicitly; add the completion e2e/visual checks; update the E3 coverage row 4 (no longer excluded, with the removed-email deviation) via orchestrator amendment.
4. Suites + closing `tools/verify-all.sh` + commit + report (task id + hashes).

## Unknowns
- Fireworks source identification is investigation-first; if a fact cannot be evidenced, record it precisely (no invented behaviour).

## Verify
- Celebration e2e/visual checks pass (capturable keyframes ≤ 2 % tolerant; card deviations documented); form is local-only (zero requests; nothing stored); `Yeni Oyun` returns to main exactly as today; existing suites green; full `npm test`, `npm run lint`, `npm run build`; closing `tools/verify-all.sh` exit 0.

## Evidence
- `evidence/Y10-celebration.md` + `evidence/visual/Y10/**` + logs `evidence/logs/Y10-*`; proposed amendments (E3 row 4 / docs/07 / docs/02 §7 note that the form is placebo-local).

## Done
- Verify passes; committed as `task: Y10 win celebration + results`.
